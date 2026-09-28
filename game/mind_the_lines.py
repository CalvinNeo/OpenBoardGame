"""Mind the Lines: cooperative drawing restricted to an original line network."""

import copy
import math
import random
import secrets
import time
from typing import Dict, List, Optional, Tuple
from functools import lru_cache

from game.mind_the_lines_data import WORD_POOLS, generate_board, word_outline


TOTAL_ROUNDS = 4
DEFAULT_CONFIG = {"difficulty": "easy", "draw_seconds": 120}
CONFIG_SCHEMA = {
    "type": "object", "properties": {
        "difficulty": {"type": "string", "enum": ["easy", "hard"], "default": "easy"},
        "draw_seconds": {"type": "integer", "enum": [0, 120, 180], "default": 120},
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
    }, "additionalProperties": False,
}
_COMMON_ACTION = {"type": {"type": "string"}, "round_token": {"type": "string", "minLength": 1}}
_DRAWING_FIELDS = {
    "segments": {"type": "array", "maxItems": 1000, "uniqueItems": True,
                 "items": {"type": "integer", "minimum": 0}},
    "side": {"type": "integer", "enum": [0, 1]},
    "rotation": {"type": "integer", "enum": [0, 1, 2, 3]},
    "seq": {"type": "integer", "minimum": 0},
}


def _action_variant(kinds: List[str], extra: Optional[Dict] = None) -> Dict:
    fields = {**_COMMON_ACTION, **(extra or {})}
    fields["type"] = {"enum": kinds}
    return {"type": "object", "properties": fields, "required": list(fields), "additionalProperties": False}


ACTION_SCHEMA = {"oneOf": [
    _action_variant(["ready", "next_round"]),
    _action_variant(["save_drawing", "submit_drawing"], _DRAWING_FIELDS),
    _action_variant(["eliminate"], {"card_id": {"type": "string", "minLength": 1},
                                  "revision": {"type": "integer", "minimum": 0}}),
]}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _config(config: Optional[Dict]) -> Dict:
    cfg = {} if config is None else config
    if not isinstance(cfg, dict) or set(cfg) - {"difficulty", "draw_seconds", "seed"}:
        raise ValueError("invalid Mind the Lines configuration")
    difficulty, seconds = cfg.get("difficulty", "easy"), cfg.get("draw_seconds", 120)
    if difficulty not in ("easy", "hard"):
        raise ValueError("difficulty must be easy or hard")
    if type(seconds) is not int or seconds not in (0, 120, 180):
        raise ValueError("draw_seconds must be 0, 120 or 180")
    if "seed" in cfg and type(cfg["seed"]) is not int and not (
            isinstance(cfg["seed"], str) and 1 <= len(cfg["seed"]) <= 80):
        raise ValueError("invalid seed")
    return {**DEFAULT_CONFIG, **cfg}


def _word_view(word: Dict) -> Dict:
    return {field: word[field] for field in ("id", "zh", "en")}


def _event(kind: str, **payload: object) -> Dict:
    return {"type": f"mind_the_lines:{kind}", "payload": payload}


def _start_round(state: Dict) -> None:
    state.update(phase="ready", round_token=secrets.token_hex(16), deadline_ms=None,
                 current_turn=None, cards=[], eliminations=[], last_round_summary=None)
    count = len(state["turn_order"]) * state["words_per_player"]
    # A full game consumes at most 64 words. Both difficulties contain 64.
    words = [state["word_deck"].pop() for _ in range(count * 2)]
    for index, pid in enumerate(state["turn_order"]):
        start = index * state["words_per_player"]
        own = words[start:start + state["words_per_player"]]
        state["players"][pid].update(words=copy.deepcopy(own), ready=False, submitted=False,
                                    next_round_ready=False,
                                    drawing={"segments": [], "side": 0, "rotation": 0, "seq": -1})
        state["cards"].extend({**word, "owner_id": pid} for word in own)
    state["cards"].extend({**word, "owner_id": None} for word in words[count:])
    rng = random.Random(f'{state["base_seed"]}:cards:{state["round"]}')
    rng.shuffle(state["cards"])


def _begin_oracle(state: Dict) -> None:
    for player in state["players"].values():
        player["submitted"] = True
    state.update(phase="oracle", deadline_ms=None, current_turn=state["start_player"])


def _score_round(state: Dict) -> None:
    mistakes = sum(card.get("eliminated_by") is not None and card["owner_id"] is not None
                   for card in state["cards"])
    state["errors"] += mistakes
    claims = []
    for pid in state["turn_order"]:
        claims.append({"player_id": pid, "words": [
            {**_word_view(card), "eliminated_by": card.get("eliminated_by")}
            for card in state["cards"] if card["owner_id"] == pid
        ]})
    summary = {"round": state["round"], "errors": mistakes, "total_errors": state["errors"],
               "claims": claims, "cards": copy.deepcopy(state["cards"])}
    state["last_round_summary"] = summary
    state["round_history"].append(copy.deepcopy(summary))
    lost = state["errors"] > state["error_limit"]
    finished = lost or state["round"] == TOTAL_ROUNDS
    state.update(phase="game_over" if finished else "round_result", current_turn=None,
                 game_over=finished, outcome=("loss" if lost else "win") if finished else None,
                 success=(not lost) if finished else None,
                 winner_ids=list(state["turn_order"]) if finished and not lost else [])


def resolve_timeout(state: Dict, now_ms: int) -> List[Dict]:
    """Lock current drafts exactly once when the server drawing deadline expires."""
    deadline = state.get("deadline_ms")
    if state.get("phase") != "drawing" or deadline is None or now_ms < deadline:
        return []
    _begin_oracle(state)
    state["revision"] += 1
    return [_event("drawing_timeout", round=state["round"]), _event("oracle_started", round=state["round"])]


def _drawing_error(state: Dict, player_id: str, action: Dict) -> Optional[str]:
    side, rotation, seq, segments = (action.get(k) for k in ("side", "rotation", "seq", "segments"))
    if type(side) is not int or side not in (0, 1):
        return "invalid board side"
    if type(rotation) is not int or rotation not in (0, 1, 2, 3):
        return "invalid board rotation"
    if type(seq) is not int or seq < 0:
        return "invalid drawing sequence"
    if not isinstance(segments, list) or len(segments) > 1000:
        return "invalid segments"
    board = state["boards"][state["players"][player_id]["board_id"]]
    limit = len(board["sides"][side])
    if any(type(segment) is not int or not 0 <= segment < limit for segment in segments):
        return "invalid segment ID"
    if len(set(segments)) != len(segments):
        return "duplicate segment ID"
    return None


class MindTheLinesGame:
    game_id = "mind_the_lines"
    min_players = 2
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not MindTheLinesGame.min_players <= len(players) <= MindTheLinesGame.max_players:
            raise ValueError("Mind the Lines requires 2 to 8 players")
        if any(not isinstance(p, dict) or not isinstance(p.get("player_id"), str)
               or not p["player_id"] for p in players):
            raise ValueError("invalid player")
        meta = {p["player_id"]: copy.deepcopy(p) for p in players}
        if len(meta) != len(players):
            raise ValueError("player IDs must be unique")
        order = sorted(meta, key=lambda pid: (meta[pid].get("seat", 0), pid))
        cfg = _config(config)
        seed = cfg.get("seed", secrets.token_hex(16))
        deck = [_word_view(word) for word in WORD_POOLS[cfg["difficulty"]]]
        random.Random(f"{seed}:words").shuffle(deck)
        boards = {f"board-{i + 1}": generate_board(seed, f"board-{i + 1}") for i in range(len(order))}
        state = {
            "version": 1, "config": cfg, "base_seed": seed, "word_deck": deck,
            "player_meta": meta, "turn_order": order, "start_player": order[0],
            "players": {pid: {"board_id": f"board-{i + 1}"} for i, pid in enumerate(order)},
            "boards": boards, "round": 1, "total_rounds": TOTAL_ROUNDS, "revision": 0,
            "words_per_player": 2 if len(players) <= 3 else 1,
            "errors": 0, "error_limit": len(order), "round_history": [],
            "game_over": False, "outcome": None, "success": None, "winner_ids": [],
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        player = state["players"].get(player_id)
        if player is None or state["game_over"]:
            return []
        if state["phase"] == "ready" and not player["ready"]:
            return ["ready"]
        if state["phase"] == "drawing" and not player["submitted"]:
            if state["deadline_ms"] is not None and _now_ms() >= state["deadline_ms"]:
                return []
            return ["save_drawing", "submit_drawing"]
        if state["phase"] == "oracle" and state["current_turn"] == player_id:
            return ["eliminate"]
        if state["phase"] == "round_result" and not player["next_round_ready"]:
            return ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state["players"]:
            return [], "unknown player"
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        kind = action["type"]
        extra = set(_DRAWING_FIELDS) if kind in ("save_drawing", "submit_drawing") else (
            {"card_id", "revision"} if kind == "eliminate" else set())
        if kind not in ("ready", "save_drawing", "submit_drawing", "eliminate", "next_round") or set(action) != {"type", "round_token"} | extra:
            return [], "invalid action fields"
        if action["round_token"] != state["round_token"]:
            return [], "stale round token"
        player = state["players"][player_id]
        if kind == "ready" and player["ready"]:
            return [], None
        if kind == "next_round" and state["phase"] == "round_result" and player["next_round_ready"]:
            return [], None
        if kind == "eliminate":
            if not isinstance(action["card_id"], str) or type(action["revision"]) is not int or action["revision"] < 0:
                return [], "invalid elimination"
            # Exact retries of accepted requests remain harmless across turn changes.
            if any(e["player_id"] == player_id and e["revision"] == action["revision"] and
                   e["card_id"] == action["card_id"] for e in state["eliminations"]):
                return [], None
            if action["revision"] != state["revision"]:
                return [], "stale revision"
        drawing = None
        if kind in ("save_drawing", "submit_drawing"):
            error = _drawing_error(state, player_id, action)
            if error:
                return [], error
            drawing = {key: copy.deepcopy(action[key]) for key in _DRAWING_FIELDS}
            drawing["segments"].sort()
            current = player["drawing"]
            if drawing["seq"] == current["seq"] and drawing != current:
                return [], "drawing sequence already used"
            if player["submitted"]:
                if drawing == current and kind == "submit_drawing":
                    return [], None
                return [], "drawing already submitted"
            if state["phase"] == "drawing" and drawing["seq"] < current["seq"]:
                return [], None
        if kind not in MindTheLinesGame.get_legal_actions(state, player_id):
            return [], "action not available"
        events = []
        if kind == "ready":
            player["ready"] = True
            events.append(_event("ready", player_id=player_id))
            if all(p["ready"] for p in state["players"].values()):
                seconds = state["config"]["draw_seconds"]
                state.update(phase="drawing", deadline_ms=_now_ms() + seconds * 1000 if seconds else None)
                events.append(_event("drawing_started", round=state["round"], deadline_ms=state["deadline_ms"]))
        elif kind in ("save_drawing", "submit_drawing"):
            if kind == "save_drawing" and drawing == player["drawing"]:
                return [], None
            player["drawing"] = drawing
            if kind == "submit_drawing":
                player["submitted"] = True
                events.append(_event("drawing_submitted", player_id=player_id))
                if all(p["submitted"] for p in state["players"].values()):
                    _begin_oracle(state)
                    events.append(_event("oracle_started", round=state["round"]))
        elif kind == "eliminate":
            card = next((c for c in state["cards"] if c["id"] == action["card_id"]), None)
            if card is None or card.get("eliminated_by") is not None:
                return [], "card not available"
            card["eliminated_by"] = player_id
            state["eliminations"].append({"player_id": player_id, "card_id": card["id"], "revision": state["revision"]})
            events.append(_event("eliminated", player_id=player_id, card_id=card["id"]))
            needed = len(state["turn_order"]) * state["words_per_player"]
            if len(state["eliminations"]) == needed:
                _score_round(state)
                events.append(_event("round_scored", round=state["round"], errors=state["last_round_summary"]["errors"],
                                     total_errors=state["errors"]))
                if state["game_over"]:
                    events.append(_event("game_over", outcome=state["outcome"]))
            else:
                order = state["turn_order"]
                state["current_turn"] = order[(order.index(player_id) + 1) % len(order)]
        elif kind == "next_round":
            player["next_round_ready"] = True
            events.append(_event("next_round_ready", player_id=player_id))
            if all(p["next_round_ready"] for p in state["players"].values()):
                order = state["turn_order"]
                old_boards = [state["players"][pid]["board_id"] for pid in order]
                for index, pid in enumerate(order):
                    state["players"][pid]["board_id"] = old_boards[(index - 1) % len(order)]
                state["start_player"] = order[(order.index(state["start_player"]) + 1) % len(order)]
                state["round"] += 1
                _start_round(state)
                events.append(_event("round_started", round=state["round"]))
        state["revision"] += 1
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: Optional[str]) -> Dict:
        phase = state["phase"]
        revealed = phase in ("round_result", "game_over")
        public_art = phase in ("oracle", "round_result", "game_over")
        own = state["players"].get(viewer_id)
        players = []
        for pid in state["turn_order"]:
            meta, player = state["player_meta"][pid], state["players"][pid]
            players.append({"player_id": pid, "name": meta.get("name", pid), "seat": meta.get("seat", 0),
                            "is_bot": bool(meta.get("is_bot")),
                            **{key: player[key] for key in ("ready", "submitted", "next_round_ready")}})
        view = {
            "game_id": MindTheLinesGame.game_id, "you": viewer_id, "phase": phase,
            "round": state["round"], "total_rounds": TOTAL_ROUNDS,
            "round_token": state["round_token"], "revision": state["revision"],
            "config": {key: state["config"][key] for key in DEFAULT_CONFIG},
            "players": players, "current_turn": state["current_turn"], "start_player": state["start_player"],
            "deadline_ms": state["deadline_ms"], "server_now_ms": _now_ms(),
            "errors": state["errors"], "error_limit": state["error_limit"], "words_per_player": state["words_per_player"],
            "legal_actions": MindTheLinesGame.get_legal_actions(state, viewer_id),
            "drawings": [], "cards": [], "your_words": [], "your_board": None, "your_drawing": None,
            "last_round_summary": copy.deepcopy(state["last_round_summary"]) if revealed else None,
            "round_history": copy.deepcopy(state["round_history"]), "game_over": state["game_over"],
            "success": state["success"], "outcome": state["outcome"], "winner_ids": list(state["winner_ids"]),
        }
        if own:
            view.update(your_words=copy.deepcopy(own["words"]),
                        your_board=copy.deepcopy(state["boards"][own["board_id"]]),
                        your_drawing=copy.deepcopy(own["drawing"]))
        if public_art:
            for card in state["cards"]:
                shown = {**_word_view(card), "eliminated_by": card.get("eliminated_by")}
                if revealed:
                    shown["owner_id"] = card["owner_id"]
                view["cards"].append(shown)
            for pid in state["turn_order"]:
                player = state["players"][pid]
                drawing = player["drawing"]
                board = state["boards"][player["board_id"]]
                shown = {"player_id": pid, "board_id": board["id"],
                         "lines": copy.deepcopy(board["sides"][drawing["side"]]),
                         **copy.deepcopy(drawing)}
                if revealed:
                    shown["words"] = copy.deepcopy(player["words"])
                view["drawings"].append(shown)
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        # The strategy receives precisely the same redacted view as a human.
        return choose_bot_action(MindTheLinesGame.get_public_view(state, bot_id))

    resolve_timeout = staticmethod(resolve_timeout)

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


def _point_distance(x: float, y: float, line: List[float]) -> float:
    a, b, c, d = line
    dx, dy = c - a, d - b
    fraction = max(0, min(1, ((x - a) * dx + (y - b) * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(x - a - fraction * dx, y - b - fraction * dy)


def _rotate(line: List[float], rotation: int) -> List[float]:
    a, b, c, d = line
    for _ in range(rotation):
        a, b, c, d = 1000 - b, a, 1000 - d, c
    return [a, b, c, d]


def _outline_slot(word_id: str, slot: int, slots: int) -> List[List[float]]:
    outline = word_outline(word_id)
    if slots == 1:
        return outline
    # Two unlabelled images share a board, as required for two/three players.
    return [[a * .48 + slot * 500 + 10, b * .66 + 160,
             c * .48 + slot * 500 + 10, d * .66 + 160] for a, b, c, d in outline]


def _project_outline(lines: List[List[float]], outline: List[List[float]]) -> List[int]:
    """Snap a symbolic outline onto existing short lines only."""
    selected = set()
    buckets = {}
    for index, line in enumerate(lines):
        cx, cy = (line[0] + line[2]) / 2, (line[1] + line[3]) / 2
        buckets.setdefault((int(cx // 100), int(cy // 100)), []).append(index)
    for target in outline:
        a, b, c, d = target
        steps = max(1, math.ceil(math.hypot(c - a, d - b) / 35))
        for i in range(steps + 1):
            x, y = a + (c - a) * i / steps, b + (d - b) * i / steps
            best, cost = None, float("inf")
            tlen = math.hypot(c - a, d - b) or 1
            bx, by = int(x // 100), int(y // 100)
            nearby = [index for gx in range(bx - 1, bx + 2) for gy in range(by - 1, by + 2)
                      for index in buckets.get((gx, gy), [])]
            for index in nearby or range(len(lines)):
                segment = lines[index]
                sx, sy = segment[2] - segment[0], segment[3] - segment[1]
                length = math.hypot(sx, sy) or 1
                direction = abs(((c - a) * sx + (d - b) * sy) / (tlen * length))
                distance = _point_distance(x, y, segment) + 32 * (1 - direction)
                if distance < cost:
                    best, cost = index, distance
            if best is not None:
                selected.add(best)
    return sorted(selected)


@lru_cache(maxsize=2048)
def _project_word(lines: tuple, word_id: str, slot: int, slots: int) -> frozenset:
    return frozenset(_project_outline(lines, _outline_slot(word_id, slot, slots)))


def choose_bot_action(view: Dict) -> Optional[Dict]:
    """A basic geometric practice bot; it never inspects hidden card ownership."""
    legal = view.get("legal_actions", [])
    token = view["round_token"]
    if "ready" in legal:
        return {"type": "ready", "round_token": token, "delay_ms": 350}
    if "next_round" in legal:
        return {"type": "next_round", "round_token": token, "delay_ms": 500}
    if "submit_drawing" in legal:
        lines = view["your_board"]["sides"][0]
        words = view["your_words"]
        outline = [line for slot, word in enumerate(words)
                   for line in _outline_slot(word["id"], slot, len(words))]
        return {"type": "submit_drawing", "round_token": token, "segments": _project_outline(lines, outline),
                "side": 0, "rotation": 0, "seq": view["your_drawing"]["seq"] + 1, "delay_ms": 900}
    if "eliminate" in legal:
        own = {word["id"] for word in view["your_words"]}
        candidates = [card for card in view["cards"] if card.get("eliminated_by") is None and card["id"] not in own]
        if not candidates:
            candidates = [card for card in view["cards"] if card.get("eliminated_by") is None]
        # Compare publicly visible ink to each candidate's outline. This simple
        # recognizer is approximate on human drawings and intentionally has no
        # access to assignments, the deck, or other players' private drafts.
        scores = {card["id"]: 0.0 for card in candidates}
        for drawing in view["drawings"]:
            if drawing["player_id"] == view["you"]:
                continue
            lines = tuple(tuple(_rotate(line, drawing["rotation"])) for line in drawing["lines"])
            ink = set(drawing["segments"])
            for card in candidates:
                for slot in range(view["words_per_player"]):
                    expected = _project_word(lines, card["id"], slot, view["words_per_player"])
                    visible = ink if view["words_per_player"] == 1 else {
                        index for index in ink if (lines[index][0] + lines[index][2]) / 2 // 500 == slot}
                    similarity = len(expected & visible) / max(1, len(expected | visible))
                    scores[card["id"]] = max(scores[card["id"]], similarity)
        chosen = min(candidates, key=lambda c: (scores[c["id"]], c["id"]))
        return {"type": "eliminate", "round_token": token, "card_id": chosen["id"],
                "revision": view["revision"], "delay_ms": 500}
    return None
