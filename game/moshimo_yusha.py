"""Server-authoritative implementation of If You Have a Brave.

The physical game gives every player the same seven character cards.  Players
secretly remove two, then play four simultaneous cards.  The last card is a
private scoring objective.  All hidden hands stay in the server state and are
only included in the view for their owner.
"""

import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple


CARD_DEFINITIONS = [
    {
        "number": 1,
        "id": 1,
        "name": "Otherworldly Hero",
        "name_zh": "异世界勇者",
        "emoji": "🗡️",
        "ability": "Nullifies all Royal actions this round.",
        "single": "If a Royal is present, gain 2 Attack.",
        "multiple": "If a Royal is present, gain 1 Attack.",
        "victory": "No victory condition.",
    },
    {
        "number": 2,
        "id": 2,
        "name": "Miserable Slave",
        "name_zh": "哀怜的奴隶",
        "emoji": "⛓️",
        "ability": "",
        "single": "Gain 2 Faith.",
        "multiple": "Gain 1 Attack.",
        "victory": "The table has at least as many Attack as players.",
    },
    {
        "number": 3,
        "id": 3,
        "name": "Peaceful Citizen",
        "name_zh": "和平的市民",
        "emoji": "🏡",
        "ability": "",
        "single": "Gain 2 Gold.",
        "multiple": "Gain 1 Faith.",
        "victory": "Have strictly more Gold than every other player.",
    },
    {
        "number": 4,
        "id": 4,
        "name": "Greedy Merchant",
        "name_zh": "强欲的商人",
        "emoji": "💰",
        "ability": "",
        "single": "Gain 3 Gold.",
        "multiple": "Gain 1 Gold.",
        "victory": "Have strictly more total chips than every other player.",
    },
    {
        "number": 5,
        "id": 5,
        "name": "Gentle Archbishop",
        "name_zh": "温厚的大司教",
        "emoji": "⛪",
        "ability": "This player is protected from Royal actions.",
        "single": "Gain 1 Faith.",
        "multiple": "Gain 2 Faith.",
        "victory": "Have strictly more Faith than every other player.",
    },
    {
        "number": 6,
        "id": 6,
        "name": "Arrogant Royal",
        "name_zh": "傲慢的王族",
        "emoji": "👑",
        "ability": "",
        "single": "Take all chips from everyone else.",
        "multiple": "Every non-Royal player discards all chips.",
        "victory": "Nobody has any Attack.",
    },
    {
        "number": 7,
        "id": 7,
        "name": "Cheerful Jester",
        "name_zh": "愉快的道化师",
        "emoji": "🎭",
        "ability": "Everyone passes one hand card to the left.",
        "single": "Gain 1 Gold.",
        "multiple": "No chip effect.",
        "victory": "There is no winner other than a Jester.",
    },
]
CARD_BY_ID = {card["id"]: card for card in CARD_DEFINITIONS}
CARD_IDS = tuple(card["id"] for card in CARD_DEFINITIONS)

CHIP_TYPES = ("gold", "attack", "faith")
CHIP_META = {
    "gold": {"emoji": "🪙", "name": "Gold", "name_zh": "金币"},
    "attack": {"emoji": "⚔️", "name": "Attack", "name_zh": "攻击"},
    "faith": {"emoji": "✝️", "name": "Faith", "name_zh": "信仰"},
}

ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "properties": {
                "type": {"const": "discard"},
                "card_ids": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 1, "maximum": 7},
                    "minItems": 2,
                    "maxItems": 2,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "card_ids"],
            "additionalProperties": False,
        },
        {
            "properties": {
                "type": {"const": "play"},
                "card_id": {"type": "integer", "minimum": 1, "maximum": 7},
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {
            "properties": {
                "type": {"const": "pass_card"},
                "card_id": {"type": "integer", "minimum": 1, "maximum": 7},
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {
            "properties": {"type": {"const": "next_round"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "seed": {
            "oneOf": [
                {"type": "integer"},
                {"type": "string", "minLength": 1, "maxLength": 80},
            ]
        },
    },
    "additionalProperties": False,
}


def _ordered_players(players: List[Dict]) -> List[Dict]:
    return sorted(players, key=lambda item: (int(item.get("seat", 0)), str(item.get("player_id", ""))))


def _chips() -> Dict[str, int]:
    return {kind: 0 for kind in CHIP_TYPES}


def _player_name(state: Dict, player_id: str) -> str:
    return str(state.get("players", {}).get(player_id, {}).get("name") or player_id)


def _card(card_id: int) -> Dict:
    return copy.deepcopy(CARD_BY_ID[int(card_id)])


def _log(state: Dict, message: str) -> None:
    state.setdefault("history", []).append(message)
    state["history"] = state["history"][-80:]


def _all_ids(state: Dict) -> List[str]:
    return list(state.get("turn_order", []))


def _next_player(state: Dict, player_id: str) -> str:
    order = _all_ids(state)
    index = order.index(player_id)
    return order[(index + 1) % len(order)]


def _add_chip(state: Dict, player_id: str, chip: str, count: int) -> None:
    if chip not in CHIP_TYPES or count <= 0:
        return
    state["players"][player_id]["chips"][chip] += int(count)


def _chip_total(player: Dict) -> int:
    return sum(int(player.get("chips", {}).get(chip, 0)) for chip in CHIP_TYPES)


def _remove_all_chips(player: Dict) -> None:
    player["chips"] = _chips()


def _is_archbishop(state: Dict, player_id: str) -> bool:
    return state["pending_cards"].get(player_id) == 5


def _players_with(card_id: int, state: Dict) -> List[str]:
    return [pid for pid in _all_ids(state) if state["pending_cards"].get(pid) == card_id]


def _effect_entry(state: Dict, record: Dict, text: str, affected: Optional[List[str]] = None) -> None:
    entry = {"text": text}
    if affected is not None:
        entry["affected"] = list(affected)
    record["effects"].append(entry)
    _log(state, text)


def _resolve_standard_effects(state: Dict) -> Tuple[Dict, bool]:
    """Resolve cards 1–6 and return the public record and Jester presence."""
    pending = state["pending_cards"]
    royal_players = _players_with(6, state)
    hero_present = bool(_players_with(1, state))
    royal_present = bool(royal_players)
    royal_active = royal_present and not hero_present
    record = {
        "round": int(state["play_round"]),
        "cards": [
            {"player_id": pid, "card_id": pending[pid]}
            for pid in _all_ids(state)
        ],
        "effects": [],
        "royal_present": royal_present,
        "royal_blocked": royal_present and hero_present,
    }

    # Cards resolve in numeric order.  Hero's protection is known from the
    # simultaneous reveal, so the Royal can be safely handled at number 6.
    for card_id in range(1, 7):
        actors = _players_with(card_id, state)
        if not actors:
            continue
        multiple = len(actors) > 1
        if card_id == 1:
            if royal_present:
                gain = 1 if multiple else 2
                for pid in actors:
                    _add_chip(state, pid, "attack", gain)
                _effect_entry(
                    state,
                    record,
                    f"{', '.join(_player_name(state, pid) for pid in actors)} gained {gain} ⚔️ for facing the Royal.",
                    actors,
                )
        elif card_id == 2:
            chip, gain = ("attack", 1) if multiple else ("faith", 2)
            for pid in actors:
                _add_chip(state, pid, chip, gain)
            _effect_entry(state, record, f"{', '.join(_player_name(state, pid) for pid in actors)} gained {gain} {CHIP_META[chip]['emoji']}.", actors)
        elif card_id == 3:
            chip, gain = ("faith", 1) if multiple else ("gold", 2)
            for pid in actors:
                _add_chip(state, pid, chip, gain)
            _effect_entry(state, record, f"{', '.join(_player_name(state, pid) for pid in actors)} gained {gain} {CHIP_META[chip]['emoji']}.", actors)
        elif card_id == 4:
            gain = 1 if multiple else 3
            for pid in actors:
                _add_chip(state, pid, "gold", gain)
            _effect_entry(state, record, f"{', '.join(_player_name(state, pid) for pid in actors)} gained {gain} 🪙.", actors)
        elif card_id == 5:
            gain = 2 if multiple else 1
            for pid in actors:
                _add_chip(state, pid, "faith", gain)
            _effect_entry(state, record, f"{', '.join(_player_name(state, pid) for pid in actors)} gained {gain} ✝️ and are protected from the Royal.", actors)
        elif card_id == 6:
            if not royal_active:
                _effect_entry(state, record, "The Royal action was blocked by a Hero.", actors)
                continue
            if multiple:
                protected = set(pid for pid in _all_ids(state) if _is_archbishop(state, pid))
                affected = [pid for pid in _all_ids(state) if pid not in set(actors) and pid not in protected]
                for pid in affected:
                    _remove_all_chips(state["players"][pid])
                _effect_entry(state, record, "The Royals cleared every non-Royal player's chips.", affected)
            else:
                royal = actors[0]
                affected = []
                for pid in _all_ids(state):
                    if pid == royal or _is_archbishop(state, pid):
                        continue
                    for chip in CHIP_TYPES:
                        amount = int(state["players"][pid]["chips"][chip])
                        state["players"][royal]["chips"][chip] += amount
                        state["players"][pid]["chips"][chip] = 0
                    affected.append(pid)
                _effect_entry(state, record, f"{_player_name(state, royal)} took all unprotected chips.", affected)

    jester_players = _players_with(7, state)
    if jester_players:
        if len(jester_players) == 1:
            _add_chip(state, jester_players[0], "gold", 1)
            _effect_entry(state, record, f"{_player_name(state, jester_players[0])} gained 1 🪙 as the lone Jester.", jester_players)
        else:
            _effect_entry(state, record, "Multiple Jesters pass cards without a bonus chip.", jester_players)
    return record, bool(jester_players)


def _finish_resolution(state: Dict, record: Dict) -> None:
    state["last_resolution"] = copy.deepcopy(record)
    state.setdefault("round_history", []).append(copy.deepcopy(record))
    state["round_history"] = state["round_history"][-40:]
    state["pending_cards"] = {}
    state["pending_passes"] = {}
    state["phase"] = "round_review"
    state["next_round_ready"] = []


def _complete_pass_cards(state: Dict) -> Dict:
    selections = state["pending_passes"]
    order = _all_ids(state)
    for pid in order:
        card_id = selections.get(pid)
        if card_id not in state["players"][pid]["hand"]:
            raise ValueError("pass card is not in hand")
    outgoing = {pid: selections[pid] for pid in order}
    for pid, card_id in outgoing.items():
        state["players"][pid]["hand"].remove(card_id)
    for pid, card_id in outgoing.items():
        state["players"][_next_player(state, pid)]["hand"].append(card_id)
    record = state["last_resolution"]
    record.setdefault("effects", []).append({
        "text": "Everyone passed one hand card to the left.",
        "passed": [{"player_id": pid, "card_id": outgoing[pid]} for pid in order],
    })
    _log(state, "Everyone passed one hand card to the left.")
    _finish_resolution(state, record)
    return record


def _condition_holds(state: Dict, player_id: str, card_id: int, non_jester_winners: Optional[List[str]] = None) -> bool:
    player = state["players"][player_id]
    if card_id == 1:
        return False
    if card_id == 2:
        return sum(int(p["chips"]["attack"]) for p in state["players"].values()) >= len(state["turn_order"])
    if card_id == 3:
        value = int(player["chips"]["gold"])
        return all(value > int(state["players"][other]["chips"]["gold"]) for other in state["turn_order"] if other != player_id)
    if card_id == 4:
        value = _chip_total(player)
        return all(value > _chip_total(state["players"][other]) for other in state["turn_order"] if other != player_id)
    if card_id == 5:
        value = int(player["chips"]["faith"])
        return all(value > int(state["players"][other]["chips"]["faith"]) for other in state["turn_order"] if other != player_id)
    if card_id == 6:
        return sum(int(p["chips"]["attack"]) for p in state["players"].values()) == 0
    if card_id == 7:
        return not (non_jester_winners or [])
    return False


def _score_match(state: Dict) -> Dict:
    final_cards = {pid: state["players"][pid]["hand"][0] for pid in _all_ids(state)}
    non_jester_winners = []
    for pid, card_id in final_cards.items():
        if card_id != 7 and _condition_holds(state, pid, card_id):
            non_jester_winners.append(pid)
    winners = list(non_jester_winners)
    for pid, card_id in final_cards.items():
        if card_id == 7 and _condition_holds(state, pid, card_id, non_jester_winners):
            winners.append(pid)

    gain = 2 if len(winners) == 1 else 1 if winners else 0
    for pid in winners:
        state["players"][pid]["score"] += gain
    summary = {
        "match": int(state["match_number"]),
        "final_cards": {pid: _card(card_id) for pid, card_id in final_cards.items()},
        "winners": list(winners),
        "victory_points_gained": gain,
        "scores": {pid: int(state["players"][pid]["score"]) for pid in _all_ids(state)},
        "chips": {pid: copy.deepcopy(state["players"][pid]["chips"]) for pid in _all_ids(state)},
    }
    state["last_match_summary"] = summary
    state["winner_ids"] = [
        pid for pid in _all_ids(state)
        if int(state["players"][pid]["score"]) == max(
            (int(state["players"][other]["score"]) for other in _all_ids(state)),
            default=0,
        )
    ]
    if any(int(state["players"][pid]["score"]) >= 2 for pid in _all_ids(state)):
        state["game_over"] = True
        state["phase"] = "game_over"
        state["current_turn"] = None
        _log(state, "The match is over; the highest victory-point total wins.")
        return summary

    # Cards return for the next match.  Resource chips and victory points stay,
    # matching the physical game's multi-match scoring loop.
    state["match_number"] += 1
    state["play_round"] = 0
    state["discarded"] = []
    state["setup_submissions"] = {}
    state["pending_cards"] = {}
    state["pending_passes"] = {}
    state["last_resolution"] = None
    for player in state["players"].values():
        player["hand"] = list(CARD_IDS)
    state["phase"] = "setup_discard"
    _log(state, "All cards returned; choose two cards to discard for the next match.")
    return summary


def _start_play(state: Dict) -> None:
    state["phase"] = "playing"
    state["play_round"] = 1
    state["pending_cards"] = {}
    state["pending_passes"] = {}
    state["next_round_ready"] = []
    state["last_resolution"] = None
    _log(state, "Everyone has discarded; choose a card to play.")


class MoshimoYushaGame:
    game_id = "moshimo_yusha"
    min_players = 1
    max_players = 7

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not isinstance(config, dict):
            config = {}
        if set(config) - {"seed"}:
            raise ValueError("invalid If You Have a Brave configuration")
        seed = config.get("seed", secrets.token_hex(16))
        if not isinstance(seed, (int, str)) or isinstance(seed, bool) or (isinstance(seed, str) and not seed):
            raise ValueError("invalid seed")
        if not MoshimoYushaGame.min_players <= len(players) <= MoshimoYushaGame.max_players:
            raise ValueError("If You Have a Brave requires 1 to 7 players")
        ordered = _ordered_players(players)
        ids = [str(player.get("player_id")) for player in ordered]
        if any(not pid or pid == "None" for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique nonempty strings")
        state = {
            "game_id": MoshimoYushaGame.game_id,
            "version": 1,
            "game_instance_id": secrets.token_hex(12),
            "config": {"seed": seed},
            "seed": seed,
            "match_number": 1,
            "play_round": 0,
            "phase": "setup_discard",
            "turn_order": ids,
            "players": {},
            "setup_submissions": {},
            "discarded": [],
            "pending_cards": {},
            "pending_passes": {},
            "next_round_ready": [],
            "last_resolution": None,
            "last_match_summary": None,
            "round_history": [],
            "history": [],
            "winner_ids": [],
            "game_over": False,
            "current_turn": None,
        }
        for player in ordered:
            pid = str(player["player_id"])
            state["players"][pid] = {
                "name": str(player.get("name") or pid),
                "seat": int(player.get("seat", 0)),
                "is_bot": bool(player.get("is_bot", False)),
                "hand": list(CARD_IDS),
                "chips": _chips(),
                "score": 0,
            }
        _log(state, "Choose two cards to discard face down.")
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}) or state.get("game_over"):
            return []
        phase = state.get("phase")
        if phase == "setup_discard":
            return [] if player_id in state.get("setup_submissions", {}) else ["discard"]
        if phase == "playing":
            return [] if player_id in state.get("pending_cards", {}) else ["play"]
        if phase == "pass_cards":
            return [] if player_id in state.get("pending_passes", {}) else ["pass_card"]
        if phase == "round_review":
            return [] if player_id in state.get("next_round_ready", []) else ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        kind = action["type"]
        if kind not in MoshimoYushaGame.get_legal_actions(state, player_id):
            return [], "action is not available"
        player = state["players"][player_id]

        if kind == "discard":
            cards = action.get("card_ids")
            if not isinstance(cards, list) or len(cards) != 2 or len(set(cards)) != 2:
                return [], "choose two different cards"
            if any(type(card_id) is not int or card_id not in player["hand"] for card_id in cards):
                return [], "discard cards must be in your hand"
            player["hand"] = [card_id for card_id in player["hand"] if card_id not in cards]
            state["setup_submissions"][player_id] = list(cards)
            events = [{"type": "moshimo_yusha:discard_submitted", "payload": {"player_id": player_id}}]
            if len(state["setup_submissions"]) == len(state["turn_order"]):
                discarded = [card_id for pid in state["turn_order"] for card_id in state["setup_submissions"][pid]]
                random.Random(f"{state['seed']}:{state['match_number']}:discard").shuffle(discarded)
                state["discarded"] = discarded
                _start_play(state)
                events.append({"type": "moshimo_yusha:discard_revealed", "payload": {"cards": list(discarded)}})
            return events, None

        if kind == "play":
            card_id = action.get("card_id")
            if type(card_id) is not int or card_id not in player["hand"]:
                return [], "play card must be in your hand"
            player["hand"].remove(card_id)
            state["pending_cards"][player_id] = card_id
            events = [{"type": "moshimo_yusha:play_submitted", "payload": {"player_id": player_id}}]
            if len(state["pending_cards"]) == len(state["turn_order"]):
                record, has_jester = _resolve_standard_effects(state)
                if has_jester:
                    state["last_resolution"] = record
                    state["phase"] = "pass_cards"
                    state["pending_passes"] = {}
                    events.append({"type": "moshimo_yusha:pass_required", "payload": {}})
                else:
                    _finish_resolution(state, record)
                    events.append({"type": "moshimo_yusha:round_revealed", "payload": {"round": record}})
            return events, None

        if kind == "pass_card":
            card_id = action.get("card_id")
            if type(card_id) is not int or card_id not in player["hand"]:
                return [], "pass card must be in your hand"
            state["pending_passes"][player_id] = card_id
            events = [{"type": "moshimo_yusha:pass_submitted", "payload": {"player_id": player_id}}]
            if len(state["pending_passes"]) == len(state["turn_order"]):
                record = _complete_pass_cards(state)
                events.append({"type": "moshimo_yusha:round_revealed", "payload": {"round": record}})
            return events, None

        if kind == "next_round":
            state["next_round_ready"].append(player_id)
            events = [{"type": "moshimo_yusha:next_round_ready", "payload": {"player_id": player_id}}]
            if len(state["next_round_ready"]) == len(state["turn_order"]):
                state["next_round_ready"] = []
                if all(len(state["players"][pid]["hand"]) == 1 for pid in state["turn_order"]):
                    summary = _score_match(state)
                    events.append({"type": "moshimo_yusha:match_scored", "payload": {"summary": summary}})
                else:
                    state["play_round"] += 1
                    state["phase"] = "playing"
                    state["pending_cards"] = {}
                    state["pending_passes"] = {}
                    state["last_resolution"] = None
                    _log(state, f"Round {state['play_round']}: choose a card to play.")
            return events, None

        return [], "unsupported action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = viewer_id in state.get("players", {})
        players = []
        for pid in state.get("turn_order", []):
            pdata = state["players"][pid]
            players.append({
                "player_id": pid,
                "name": pdata["name"],
                "seat": pdata["seat"],
                "is_bot": bool(pdata.get("is_bot")),
                "card_count": len(pdata.get("hand", [])),
                "chips": copy.deepcopy(pdata.get("chips", _chips())),
                "score": int(pdata.get("score", 0)),
                "submitted": bool(
                    pid in state.get("pending_cards", {})
                    or pid in state.get("pending_passes", {})
                    or pid in state.get("setup_submissions", {})
                ),
            })
        view = {
            "game_id": MoshimoYushaGame.game_id,
            "game_instance_id": state.get("game_instance_id"),
            "you": viewer_id,
            "config": copy.deepcopy(state.get("config", {})),
            "phase": state.get("phase"),
            "match_number": int(state.get("match_number", 1)),
            "play_round": int(state.get("play_round", 0)),
            "players": players,
            "cards": copy.deepcopy(CARD_DEFINITIONS),
            "chips": copy.deepcopy(CHIP_META),
            "discarded": [_card(card_id) for card_id in state.get("discarded", [])],
            "last_resolution": copy.deepcopy(state.get("last_resolution")),
            "last_match_summary": copy.deepcopy(state.get("last_match_summary")),
            "round_history": copy.deepcopy(state.get("round_history", [])[-10:]),
            "history": list(state.get("history", [])[-30:]),
            "next_round_ready": list(state.get("next_round_ready", [])),
            "pending_count": len(state.get("pending_cards", {})),
            "pass_pending_count": len(state.get("pending_passes", {})),
            "winner_ids": list(state.get("winner_ids", [])),
            "game_over": bool(state.get("game_over")),
            "legal_actions": MoshimoYushaGame.get_legal_actions(state, viewer_id),
            "my_hand": [],
            "my_discarded": list(state.get("setup_submissions", {}).get(viewer_id, [])) if own else [],
        }
        if own:
            view["my_hand"] = [_card(card_id) for card_id in state["players"][viewer_id].get("hand", [])]
        # Reveal submitted cards only after everyone has submitted and they have
        # become part of the public resolution record.
        return view

    @staticmethod
    def bot_move(state: Dict, player_id: str) -> Optional[Dict]:
        if player_id not in state.get("players", {}) or not state["players"][player_id].get("is_bot"):
            return None
        legal = MoshimoYushaGame.get_legal_actions(state, player_id)
        if not legal:
            return None
        hand = list(state["players"][player_id].get("hand", []))
        rng = random.Random(f"{state.get('seed')}:{state.get('match_number')}:{state.get('play_round')}:{player_id}:{state.get('phase')}")
        if "discard" in legal:
            # Keep one scoring card and one interaction card when possible.
            discard = sorted(hand, key=lambda card_id: (card_id in (3, 4, 5), rng.random()))[:2]
            return {"type": "discard", "card_ids": discard}
        if "play" in legal:
            if not hand:
                return None
            # The final card is the objective; preserve it whenever another card
            # is available, while keeping the bot fully deterministic.
            choices = hand[:-1] if len(hand) > 1 else hand
            return {"type": "play", "card_id": rng.choice(choices)}
        if "pass_card" in legal:
            return {"type": "pass_card", "card_id": hand[0]} if hand else None
        if "next_round" in legal:
            return {"type": "next_round"}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict) or payload.get("game_id") != MoshimoYushaGame.game_id:
            raise ValueError("invalid If You Have a Brave save")
        state = copy.deepcopy(payload)
        if not isinstance(state.get("players"), dict) or not isinstance(state.get("turn_order"), list):
            raise ValueError("invalid If You Have a Brave players")
        for pid in state["turn_order"]:
            if pid not in state["players"]:
                raise ValueError("invalid If You Have a Brave player")
            pdata = state["players"][pid]
            if any(card_id not in CARD_BY_ID for card_id in pdata.get("hand", [])):
                raise ValueError("invalid hidden card")
            pdata.setdefault("chips", _chips())
            pdata.setdefault("score", 0)
        return state


def bot_move(state: Dict, player_id: str) -> Optional[Dict]:
    return MoshimoYushaGame.bot_move(state, player_id)

