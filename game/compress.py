"""Compress (脑力压缩): record a growing binary sequence with eight note cards."""

import copy
import random
from typing import Dict, List, Optional, Tuple


NOTE_CARD_COUNT = 8
STARTING_LENGTH = 3
TARGET_LENGTH = 20
MAX_ERRORS = 2

DEFAULT_CONFIG = {
    "starting_length": STARTING_LENGTH,
    "target_length": TARGET_LENGTH,
    "max_errors": MAX_ERRORS,
}

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "starting_length": {"type": "integer", "enum": [2, 3, 4]},
        "target_length": {"type": "integer", "enum": [12, 16, 20]},
        "max_errors": {"type": "integer", "enum": [2, 3]},
    },
    "additionalProperties": False,
}

ACTION_SCHEMA = {
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"enum": ["write_note"]},
                "slot": {"type": "integer", "minimum": 0, "maximum": NOTE_CARD_COUNT - 1},
                "bit": {"type": "integer", "enum": [0, 1]},
            },
            "required": ["type", "slot", "bit"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"enum": ["hide_sequence", "next_round", "play_again"]}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"enum": ["answer"]},
                "bits": {"type": "string", "pattern": "^[01]{1,32}$"},
            },
            "required": ["type", "bits"],
            "additionalProperties": False,
        },
    ]
}


def _merge_config(config: Optional[Dict]) -> Dict:
    merged = dict(DEFAULT_CONFIG)
    if config:
        unknown = set(config) - set(DEFAULT_CONFIG)
        if unknown:
            raise ValueError("unknown Compress configuration")
        merged.update(config)
    for key in ("starting_length", "target_length", "max_errors"):
        if type(merged[key]) is not int:
            raise ValueError(f"{key} must be an integer")
    if merged["starting_length"] not in (2, 3, 4):
        raise ValueError("starting_length must be 2, 3 or 4")
    if merged["target_length"] not in (12, 16, 20) or merged["target_length"] < merged["starting_length"]:
        raise ValueError("target_length must be 12, 16 or 20")
    if merged["max_errors"] not in (2, 3):
        raise ValueError("max_errors must be 2 or 3")
    return merged


def _build_note_deck() -> List[Dict]:
    deck: List[Dict] = []
    card_number = 0
    for color in ("white", "black"):
        for bit in (0, 1):
            for _ in range(24):
                card_number += 1
                deck.append({
                    "id": f"compress-{card_number:03d}",
                    "color": color,
                    "bit": bit,
                })
    random.shuffle(deck)
    return deck


def _next_active_id(state: Dict, player_id: str) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    try:
        start = order.index(player_id)
    except ValueError:
        start = -1
    for offset in range(1, len(order) + 1):
        candidate = order[(start + offset) % len(order)]
        if not state["players"].get(candidate, {}).get("eliminated"):
            return candidate
    return None


def _active_ids(state: Dict) -> List[str]:
    return [pid for pid in state.get("turn_order", []) if not state["players"][pid].get("eliminated")]


def _sequence_text(bits: List[int]) -> str:
    return "".join(str(int(bit)) for bit in bits)


def _deal_notes(deck: List[Dict]) -> List[Dict]:
    if len(deck) < NOTE_CARD_COUNT:
        deck.extend(_build_note_deck())
    return [copy.deepcopy(deck.pop()) for _ in range(NOTE_CARD_COUNT)]


def _begin_round(state: Dict, *, first_round: bool = False) -> None:
    config = state["config"]
    if first_round:
        state["sequence"] = [random.randint(0, 1) for _ in range(config["starting_length"])]
    elif len(state["sequence"]) < config["target_length"]:
        state["sequence"].append(random.randint(0, 1))
    state["phase"] = "memorize"
    state["round_ready"] = []
    state["round_notes_written"] = {}
    state["round_summary"] = None


def _finish_game(state: Dict) -> None:
    active = _active_ids(state)
    if len(active) == 1:
        winners = active
    else:
        best = max((state["players"][pid]["score"] for pid in active), default=0)
        winners = [pid for pid in active if state["players"][pid]["score"] == best]
    if not winners:
        all_players = list(state.get("turn_order", []))
        best = max((state["players"][pid]["score"] for pid in all_players), default=0)
        winners = [pid for pid in all_players if state["players"][pid]["score"] == best]
    state["winner_ids"] = winners
    state["game_over"] = True
    state["phase"] = "game_over"
    state["current_turn"] = None


def _reset_game(state: Dict) -> None:
    config = state.get("config") or dict(DEFAULT_CONFIG)
    meta = state.get("player_meta") or {}
    players = [dict(value, player_id=pid) for pid, value in meta.items()]
    players.sort(key=lambda item: item.get("seat", 0))
    fresh = CompressGame.init_game(config, players)
    state.clear()
    state.update(fresh)


class CompressGame:
    game_id = "compress"
    min_players = 1
    max_players = 7

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        if not players:
            raise ValueError("Compress needs at least one player")
        deck = _build_note_deck()
        player_ids = [player["player_id"] for player in players]
        player_meta = {player["player_id"]: dict(player) for player in players}
        state_players = {}
        for pid in player_ids:
            notes = _deal_notes(deck)
            state_players[pid] = {
                "score": 0,
                "errors": 0,
                "eliminated": False,
                "notes": [{"card": card, "recorded_bit": None} for card in notes],
            }
        state = {
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "current_turn": player_ids[0],
            "sequence": [],
            "deck": deck,
            "phase": "memorize",
            "round": 1,
            "round_ready": [],
            "round_notes_written": {},
            "round_summary": None,
            "winner_ids": [],
            "game_over": False,
            "config": cfg,
        }
        _begin_round(state, first_round=True)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again"]
        pdata = state["players"][player_id]
        if pdata.get("eliminated"):
            return []
        phase = state.get("phase")
        if phase == "round_result":
            if player_id not in state.get("round_ready", []):
                return ["next_round"]
            return []
        if player_id != state.get("current_turn"):
            return []
        if phase == "memorize":
            return ["write_note", "hide_sequence"]
        if phase == "answering":
            return ["answer"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        action_type = action.get("type")
        events: List[Dict] = []
        pdata = state["players"][player_id]

        if action_type == "play_again":
            if not state.get("game_over"):
                return [], "game is not over"
            _reset_game(state)
            return [{"type": "compress:play_again", "payload": {"player_id": player_id}}], None

        if state.get("game_over") or pdata.get("eliminated"):
            return [], "game is over" if state.get("game_over") else "player eliminated"

        phase = state.get("phase")
        if action_type == "write_note":
            if phase != "memorize" or player_id != state.get("current_turn"):
                return [], "not in the note phase"
            slot = action.get("slot")
            bit = action.get("bit")
            if type(slot) is not int or not 0 <= slot < NOTE_CARD_COUNT:
                return [], "invalid note slot"
            if type(bit) is not int or bit not in (0, 1):
                return [], "invalid note bit"
            pdata["notes"][slot]["recorded_bit"] = bit
            state.setdefault("round_notes_written", {}).setdefault(player_id, [])
            if slot not in state["round_notes_written"][player_id]:
                state["round_notes_written"][player_id].append(slot)
            events.append({"type": "compress:note", "payload": {"player_id": player_id, "slot": slot}})
            return events, None

        if action_type == "hide_sequence":
            if phase != "memorize" or player_id != state.get("current_turn"):
                return [], "not in the note phase"
            state["phase"] = "answering"
            events.append({"type": "compress:hide", "payload": {"player_id": player_id}})
            return events, None

        if action_type == "answer":
            if phase != "answering" or player_id != state.get("current_turn"):
                return [], "not your turn to answer"
            bits = action.get("bits")
            if not isinstance(bits, str) or any(char not in "01" for char in bits):
                return [], "answer must contain only 0 and 1"
            expected = _sequence_text(state.get("sequence", []))
            if len(bits) != len(expected):
                return [], "answer length does not match the sequence"
            correct = bits == expected
            if correct:
                pdata["score"] += len(expected)
            else:
                pdata["errors"] += 1
                if pdata["errors"] >= state["config"]["max_errors"]:
                    pdata["eliminated"] = True
            active_after = _active_ids(state)
            next_player = _next_active_id(state, player_id)
            summary = {
                "player_id": player_id,
                "correct": correct,
                "submitted": bits,
                "expected": expected,
                "sequence_length": len(expected),
                "score": pdata["score"],
                "errors": pdata["errors"],
                "eliminated": pdata["eliminated"],
            }
            state["round_summary"] = summary
            state["current_turn"] = next_player
            if len(expected) >= state["config"]["target_length"] or len(active_after) <= 1:
                _finish_game(state)
            else:
                state["phase"] = "round_result"
                state["round_ready"] = []
            events.append({"type": "compress:answer", "payload": {"player_id": player_id, "correct": correct}})
            return events, None

        if action_type == "next_round":
            if phase != "round_result":
                return [], "not waiting for the next round"
            if player_id not in _active_ids(state):
                return [], "player eliminated"
            if player_id in state.get("round_ready", []):
                return [], "already ready"
            state.setdefault("round_ready", []).append(player_id)
            active = _active_ids(state)
            if set(active) == set(state["round_ready"]):
                state["round"] += 1
                _begin_round(state)
                events.append({"type": "compress:next_round", "payload": {"round": state["round"]}})
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        phase = state.get("phase")
        players_view = []
        for pid in state.get("turn_order", []):
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            row = {
                "player_id": pid,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "is_bot": meta.get("is_bot", False),
                "score": pdata.get("score", 0),
                "errors": pdata.get("errors", 0),
                "eliminated": pdata.get("eliminated", False),
                "note_count": sum(1 for note in pdata.get("notes", []) if note.get("recorded_bit") is not None),
            }
            if pid == viewer_id:
                row["notes"] = [
                    {
                        "slot": index,
                        "card_id": note["card"]["id"],
                        "card_bit": note["card"]["bit"],
                        "color": note["card"]["color"],
                        "recorded_bit": note.get("recorded_bit"),
                    }
                    for index, note in enumerate(pdata.get("notes", []))
                ]
            players_view.append(row)

        sequence = state.get("sequence", [])
        view = {
            "game_id": CompressGame.game_id,
            "you": viewer_id,
            "phase": phase,
            "round": state.get("round", 1),
            "current_turn": state.get("current_turn"),
            "players": players_view,
            "sequence_length": len(sequence),
            "sequence_tail": sequence[-NOTE_CARD_COUNT:] if phase != "memorize" else [],
            "memorize_sequence": list(sequence) if phase == "memorize" and viewer_id == state.get("current_turn") else None,
            "round_summary": state.get("round_summary"),
            "round_ready": len(state.get("round_ready", [])),
            "active_player_count": len(_active_ids(state)),
            "winner_ids": list(state.get("winner_ids", [])),
            "game_over": bool(state.get("game_over")),
            "config": dict(state.get("config", {})),
            "legal_actions": CompressGame.get_legal_actions(state, viewer_id),
        }
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") or bot_id not in state.get("players", {}):
            return None
        if bot_id not in CompressGame.get_legal_actions(state, bot_id):
            pass
        legal = CompressGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        if state.get("phase") == "memorize":
            written = state.get("round_notes_written", {}).get(bot_id, [])
            needed = min(NOTE_CARD_COUNT, len(state.get("sequence", [])))
            if len(written) < needed:
                slot = len(written)
                bit = state["sequence"][slot]
                return {"type": "write_note", "slot": slot, "bit": bit, "delay_ms": random.randint(250, 500)}
            return {"type": "hide_sequence", "delay_ms": random.randint(300, 600)}
        if state.get("phase") == "answering":
            answer = _sequence_text(state.get("sequence", []))
            if random.random() < 0.78:
                bits = answer
            else:
                index = random.randrange(len(answer))
                replacement = "1" if answer[index] == "0" else "0"
                bits = answer[:index] + replacement + answer[index + 1:]
            return {"type": "answer", "bits": bits, "delay_ms": random.randint(500, 1000)}
        if state.get("phase") == "round_result" and "next_round" in legal:
            return {"type": "next_round", "delay_ms": random.randint(350, 700)}
        if "play_again" in legal:
            return {"type": "play_again", "delay_ms": random.randint(500, 800)}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


CompressGame.__module__ = __name__
