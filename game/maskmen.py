"""Maskmen: six-suit shedding with a season-long partial strength order."""

import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple


MASKS = ("orange", "pink", "grey", "blue", "purple", "green")
COPIES = 10
CONFIG_SCHEMA = {
    "type": "object", "properties": {
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
    }, "additionalProperties": False,
}
_CONTEXT = {
    "game_token": {"type": "string"},
    "season": {"type": "integer", "minimum": 1},
    "bout": {"type": "integer", "minimum": 1},
    "turn_number": {"type": "integer", "minimum": 0},
}
ACTION_SCHEMA = {"oneOf": [
    {"type": "object", "properties": {**_CONTEXT, "type": {"const": kind}, **fields},
     "required": ["type", *_CONTEXT, *fields], "additionalProperties": False}
    for kind, fields in [
        ("play", {"mask": {"enum": list(MASKS)}, "count": {"type": "integer", "minimum": 1, "maximum": 3}}),
        ("pass", {}), ("next_round", {}), ("next_season", {}),
    ]
]}


def strength_closure(relations: List[List[str]]) -> Dict[str, set]:
    """Reachable weaker masks; disconnected branches stay incomparable."""
    weaker = {mask: set() for mask in MASKS}
    for strong, weak in relations:
        weaker[strong].add(weak)
    for middle in MASKS:
        for strong in MASKS:
            if middle in weaker[strong]:
                weaker[strong].update(weaker[middle])
    return weaker


def play_options(hand: Dict[str, int], introduced: List[str], relations: List[List[str]],
                 top: Optional[Dict]) -> List[Dict]:
    """Pure legal move generator shared by validation, the UI and the public bot."""
    weaker = strength_closure(relations)
    options = []
    for mask in MASKS:
        count = hand.get(mask, 0)
        if not count:
            continue
        if top is None:
            sizes = range(1, min(count, 3 if mask in introduced else 1) + 1)
            reason = "lead" if mask in introduced else "debut"
        elif mask == top["mask"] or mask in weaker[top["mask"]]:
            continue
        elif top["mask"] in weaker[mask]:
            sizes, reason = [top["count"]], "stronger"
        else:
            sizes, reason = [top["count"] + 1], "establish"
        options.extend({"mask": mask, "count": size, "reason": reason}
                       for size in sizes if size <= min(count, 3))
    return options


def hand_size(hand: Dict[str, int]) -> int:
    return sum(hand.values())


def _start_bout(state: Dict, leader: str) -> None:
    state.update(phase="playing", current_turn=leader, leader=leader, top=None,
                 passed=[], ready=[], bout_plays=[], bout_result=None)


def _start_season(state: Dict) -> None:
    rng = random.Random(f'{state["base_seed"]}:season:{state["season"]}')
    deck = [mask for mask in MASKS for _ in range(COPIES)]
    rng.shuffle(deck)
    count = 15 if len(state["turn_order"]) <= 4 else 60 // len(state["turn_order"])
    for pid in state["turn_order"]:
        cards = deck[:count]
        del deck[:count]
        state["players"][pid]["hand"] = {mask: cards.count(mask) for mask in MASKS}
        state["players"][pid]["season_points"] = None
    state.update(unused=deck, cards_dealt=count, relations=[], introduced=[],
                 played_counts={mask: 0 for mask in MASKS}, finish_order=[],
                 season_result=None, bout=1, history=[])
    _start_bout(state, state["season_leader"])


def _next_player(state: Dict, after: str, candidates: List[str]) -> str:
    order = state["turn_order"]
    start = order.index(after)
    return next(order[(start + offset) % len(order)] for offset in range(1, len(order) + 1)
                if order[(start + offset) % len(order)] in candidates)


def championship_winners(state: Dict) -> List[str]:
    """Points, championships, latest championship, then final-season finish."""
    if len(state["turn_order"]) == 2:
        return [pid for pid in state["turn_order"] if state["players"][pid]["wins"] >= 3]
    def standing(pid: str) -> tuple:
        player = state["players"][pid]
        return (player["score"], player["wins"], player["last_win"], -state["finish_order"].index(pid))
    return [max(state["turn_order"], key=standing)]


def _finish_season(state: Dict, remaining: List[str]) -> None:
    state["finish_order"].extend(remaining)
    rows = []
    for index, pid in enumerate(state["finish_order"]):
        player = state["players"][pid]
        points = -1 if index == len(state["turn_order"]) - 1 else 2 if index == 0 else 1 if index == 1 else 0
        player["score"] += points
        player["season_points"] = points
        if index == 0:
            player["wins"] += 1
            player["last_win"] = state["season"]
        rows.append({"player_id": pid, "place": index + 1, "points": points,
                     "score": player["score"], "wins": player["wins"],
                     "remaining": hand_size(player["hand"])})
    result = {"season": state["season"], "players": rows, "next_leader": state["finish_order"][-1]}
    state["season_result"] = result
    state["score_history"].append(copy.deepcopy(result))
    done = (any(p["wins"] == 3 for p in state["players"].values()) if len(rows) == 2 else state["season"] == 4)
    state.update(current_turn=None, ready=[], game_over=done, phase="game_over" if done else "season_review")
    if done:
        state["winner_ids"] = championship_winners(state)


def _advance(state: Dict, actor: str) -> None:
    remaining = [pid for pid in state["turn_order"] if hand_size(state["players"][pid]["hand"])]
    if len(remaining) <= 1:
        _finish_season(state, remaining)
        return
    contenders = [pid for pid in remaining if pid not in state["passed"]]
    if len(contenders) <= 1:
        # A player who goes out leaves the bout. The sole unpassed player leads;
        # if none remain, the next occupied seat inherits the lead.
        leader = contenders[0] if contenders else _next_player(state, actor, remaining)
        state.update(phase="round_review", current_turn=None, ready=[],
                     bout_result={"last_player": state["top"]["player_id"], "next_leader": leader})
    else:
        state["current_turn"] = _next_player(state, actor, contenders)


class MaskmenGame:
    game_id = "maskmen"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 2 <= len(players) <= 6:
            raise ValueError("Maskmen requires 2 to 6 players")
        cfg = {} if config is None else config
        if not isinstance(cfg, dict) or set(cfg) - {"seed"}:
            raise ValueError("invalid Maskmen configuration")
        seed = cfg.get("seed", secrets.token_hex(16))
        if type(seed) is not int and not (isinstance(seed, str) and 1 <= len(seed) <= 80):
            raise ValueError("invalid seed")
        meta = {p["player_id"]: dict(p) for p in players}
        if len(meta) != len(players):
            raise ValueError("player IDs must be unique")
        order = sorted(meta, key=lambda pid: (meta[pid].get("seat", 0), pid))
        state = {
            "version": 1, "config": dict(cfg), "base_seed": seed, "game_token": secrets.token_hex(12),
            "player_meta": meta, "turn_order": order,
            "players": {pid: {"hand": {}, "score": 0, "wins": 0, "last_win": 0} for pid in order},
            "season": 1, "season_leader": random.Random(f"{seed}:start").choice(order),
            "turn_number": 0, "revision": 0, "score_history": [], "winner_ids": [], "game_over": False,
        }
        _start_season(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        phase = state["phase"]
        if phase in ("round_review", "season_review"):
            return [] if player_id in state["ready"] else ["next_round" if phase == "round_review" else "next_season"]
        if phase != "playing" or state["current_turn"] != player_id:
            return []
        options = play_options(state["players"][player_id]["hand"], state["introduced"], state["relations"], state["top"])
        return (["play"] if options else []) + (["pass"] if state["top"] else [])

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state["players"]:
            return [], "unknown player"
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        kind = action["type"]
        fields = {"type", *_CONTEXT} | ({"mask", "count"} if kind == "play" else set())
        if set(action) != fields:
            return [], "invalid action fields"
        for key in _CONTEXT:
            if type(action[key]) is not type(state[key]) or action[key] != state[key]:
                return [], "stale action; refresh the table"
        if kind == "play":
            if not isinstance(action["mask"], str) or action["mask"] not in MASKS or type(action["count"]) is not int:
                return [], "invalid cards"
        review = {"round_review": "next_round", "season_review": "next_season"}.get(state["phase"])
        if kind == review and player_id in state["ready"]:
            return [], None
        if kind not in MaskmenGame.get_legal_actions(state, player_id):
            return [], "action not available"
        if kind == "play":
            options = play_options(state["players"][player_id]["hand"], state["introduced"], state["relations"], state["top"])
            if not any(move["mask"] == action["mask"] and move["count"] == action["count"] for move in options):
                return [], "that combination cannot beat the table"

        state["revision"] += 1
        if kind == review:
            state["ready"].append(player_id)
            if len(state["ready"]) == len(state["turn_order"]):
                if kind == "next_round":
                    leader = state["bout_result"]["next_leader"]
                    state["bout"] += 1
                    _start_bout(state, leader)
                else:
                    state["season_leader"] = state["season_result"]["next_leader"]
                    state["season"] += 1
                    _start_season(state)
            return [{"type": "maskmen:ready", "payload": {"player_id": player_id}}], None

        state["turn_number"] += 1
        record = {"type": kind, "player_id": player_id, "bout": state["bout"], "turn_number": state["turn_number"]}
        if kind == "pass":
            state["passed"].append(player_id)
        else:
            mask, count = action["mask"], action["count"]
            top = state["top"]
            record.update(mask=mask, count=count, new_relation=None)
            if top and top["mask"] not in strength_closure(state["relations"])[mask]:
                relation = [mask, top["mask"]]
                state["relations"].append(relation)
                record["new_relation"] = relation
            if mask not in state["introduced"]:
                state["introduced"].append(mask)
            state["players"][player_id]["hand"][mask] -= count
            state["played_counts"][mask] += count
            state["top"] = {"mask": mask, "count": count, "player_id": player_id}
            state["bout_plays"].append(copy.deepcopy(record))
            if not hand_size(state["players"][player_id]["hand"]):
                state["finish_order"].append(player_id)
                record["place"] = len(state["finish_order"])
        state["history"].append(record)
        state["history"] = state["history"][-120:]
        _advance(state, player_id)
        events = [{"type": "maskmen:" + kind, "payload": copy.deepcopy(record)}]
        if state["phase"] in ("season_review", "game_over"):
            events.append({"type": "maskmen:scored", "payload": copy.deepcopy(state["season_result"])})
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = state["players"].get(viewer_id)
        legal = MaskmenGame.get_legal_actions(state, viewer_id)
        weaker = strength_closure(state["relations"])
        players = []
        for pid in state["turn_order"]:
            player, meta = state["players"][pid], state["player_meta"][pid]
            players.append({
                "player_id": pid, "name": meta.get("name", pid), "seat": meta.get("seat", 0),
                "is_bot": bool(meta.get("is_bot")), "card_count": hand_size(player["hand"]),
                "score": player["score"], "wins": player["wins"], "season_points": player["season_points"],
                "place": state["finish_order"].index(pid) + 1 if pid in state["finish_order"] else None,
                "passed": pid in state["passed"], "ready": pid in state["ready"],
            })
        view = {key: copy.deepcopy(state[key]) for key in (
            "game_token", "season", "bout", "turn_number", "revision", "phase", "current_turn", "leader",
            "cards_dealt", "top", "introduced", "relations", "played_counts", "bout_plays", "bout_result",
            "ready", "finish_order", "season_result", "history", "score_history", "winner_ids", "game_over",
        )}
        view.update(game_id=MaskmenGame.game_id, you=viewer_id, config={}, players=players,
                    two_player=len(players) == 2, unused_count=len(state["unused"]),
                    your_hand=copy.deepcopy(own["hand"]) if own else {},
                    strength={mask: [other for other in MASKS if other in weaker[mask]] for mask in MASKS},
                    legal_actions=legal, legal_plays=play_options(own["hand"], state["introduced"], state["relations"], state["top"])
                    if "play" in legal else [])
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.maskmen_ai import choose_action

        action = choose_action(MaskmenGame.get_public_view(state, bot_id))
        return {**action, "delay_ms": 350} if action else None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
