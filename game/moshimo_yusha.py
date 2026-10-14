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
from collections import Counter

from jsonschema import Draft7Validator


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
        "ability": "",
        "single": "Everyone passes one hand card to the left (Senate excluded).",
        "multiple": "Each Jester gains 1 Gold.",
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

# Windows change only when the shared phase changes; independent submissions
# from different seats can therefore carry the same window id.
ACTION_SCHEMA = {"oneOf": [
    {"type": "object", "properties": {
        "type": {"const": kind},
        "game_instance_id": {"type": "string"},
        "window_id": {"type": "integer", "minimum": 0},
        **fields,
    }, "required": ["type", "game_instance_id", "window_id", *fields], "additionalProperties": False}
    for kind, fields in {
        "discard": {"card_ids": {"type": "array", "items": {"type": "integer", "minimum": 1, "maximum": 7},
                                  "minItems": 2, "maxItems": 2, "uniqueItems": True}},
        "play": {"card_id": {"type": "integer", "minimum": 1, "maximum": 7}},
        "pass_card": {"card_id": {"type": "integer", "minimum": 1, "maximum": 7}},
        "next_round": {},
    }.items()
]}
CONFIG_SCHEMA = {"type": "object", "properties": {
    "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
}, "additionalProperties": False}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)
REVIEW_PHASES = ("setup_review", "round_review", "match_review")
PHASES = (*REVIEW_PHASES, "setup_discard", "playing", "pass_cards", "game_over")


def _chips() -> Dict[str, int]:
    return dict.fromkeys(CHIP_TYPES, 0)


def _participants(state: Dict) -> Dict:
    return {**state["players"], **state["senators"]}


def _name(state: Dict, pid: str) -> str:
    return _participants(state)[pid]["name"]


def _card(card_id: int) -> Dict:
    return copy.deepcopy(CARD_BY_ID[card_id])


def _log(state: Dict, message: str) -> None:
    state["history"].append(message)
    state["history"] = state["history"][-80:]


def _phase(state: Dict, phase: str) -> None:
    state["phase"] = phase
    state["window_id"] += 1
    state["next_round_ready"] = []


def _new_match(state: Dict) -> None:
    state["match_number"] += 1
    state.update(play_round=0, discarded=[], played=[], setup_submissions={}, pending_cards={},
                 pending_passes={}, last_resolution=None, last_match_summary=None, pass_memory={},
                 winner_ids=[])
    for pid, player in _participants(state).items():
        player.update(hand=list(CARD_IDS), chips=_chips())
        if pid in state["senators"]:
            rng = random.Random(f"{state['seed']}:{state['match_number']}:{pid}")
            rng.shuffle(player["hand"])
            state["setup_submissions"][pid] = [player["hand"].pop(), player["hand"].pop()]
    _phase(state, "setup_discard")
    _log(state, f"Match {state['match_number']}: choose two cards to discard face down.")


def _add_effect(state: Dict, record: Dict, text: str, affected: List[str]) -> None:
    record["effects"].append({"text": text, "affected": affected})
    _log(state, text)


def _resolve_cards(state: Dict) -> None:
    players = _participants(state)
    pending = state["pending_cards"]
    before = {pid: copy.deepcopy(p["chips"]) for pid, p in players.items()}
    groups = {cid: [pid for pid in state["table_order"] if pending[pid] == cid] for cid in CARD_IDS}
    record = {"match": state["match_number"], "round": state["play_round"],
              "cards": [{"player_id": pid, "card_id": pending[pid]} for pid in state["table_order"]],
              "effects": [], "before": before, "after": {}, "royal_blocked": bool(groups[1] and groups[6])}
    for cid, actors in groups.items():
        if not actors:
            continue
        multi = len(actors) > 1
        chip, gain = None, 0
        if cid == 1:
            if groups[6]:
                chip, gain = "attack", 1 if multi else 2
            else:
                _add_effect(state, record, "🗡️ No Royal appeared; the Hero gains no chips.", actors)
        elif cid == 2:
            chip, gain = ("attack", 1) if multi else ("faith", 2)
        elif cid == 3:
            chip, gain = ("faith", 1) if multi else ("gold", 2)
        elif cid == 4:
            chip, gain = "gold", 1 if multi else 3
        elif cid == 5:
            chip, gain = "faith", 2 if multi else 1
        elif cid == 6:
            if groups[1]:
                _add_effect(state, record, "🗡️ The Hero blocked all Royal actions.", actors + groups[1])
            else:
                victims = [pid for pid in players if pid not in actors and pid not in groups[5]]
                for pid in victims:
                    if not multi:
                        for kind in CHIP_TYPES:
                            players[actors[0]]["chips"][kind] += players[pid]["chips"][kind]
                    players[pid]["chips"] = _chips()
                text = "👑 Multiple Royals cleared all unprotected non-Royal chips." if multi else f"👑 {_name(state, actors[0])} took all unprotected chips."
                _add_effect(state, record, text, actors + victims)
                if groups[5]:
                    _add_effect(state, record, "⛪ The Archbishop kept their chips.", groups[5])
        elif cid == 7 and multi:
            chip, gain = "gold", 1
        if chip:
            for pid in actors:
                players[pid]["chips"][chip] += gain
            _add_effect(state, record, f"{CARD_BY_ID[cid]['emoji']} {', '.join(_name(state, pid) for pid in actors)}: +{gain} {CHIP_META[chip]['emoji']}.", actors)
    state["played"].extend(record["cards"])
    state["last_resolution"] = record
    state["pending_cards"] = {}
    state["pass_memory"] = {}
    if len(groups[7]) == 1 and len(state["turn_order"]) > 1:
        _add_effect(state, record, "🎭 Choose one card to pass left. Senate seats are skipped.", state["turn_order"][:])
        _phase(state, "pass_cards")
    else:
        if len(groups[7]) == 1:
            _add_effect(state, record, "🎭 No other player can receive a card; the Senate does not exchange hands.", groups[7])
        _finish_resolution(state)


def _finish_resolution(state: Dict) -> None:
    record = state["last_resolution"]
    record["after"] = {pid: copy.deepcopy(p["chips"]) for pid, p in _participants(state).items()}
    state["round_history"].append(copy.deepcopy(record))
    state["round_history"] = state["round_history"][-12:]
    state["pending_passes"] = {}
    _phase(state, "round_review")


def _pass_cards(state: Dict) -> None:
    outgoing = state["pending_passes"]
    order = state["turn_order"]
    # Remove every outgoing card before any incoming card is added.
    for pid, cid in outgoing.items():
        state["players"][pid]["hand"].remove(cid)
    for i, pid in enumerate(order):
        receiver = order[(i + 1) % len(order)]
        state["players"][receiver]["hand"].append(outgoing[pid])
        state["pass_memory"][pid] = {"sent": outgoing[pid], "to": receiver,
                                    "received": outgoing[order[(i - 1) % len(order)]],
                                    "from": order[(i - 1) % len(order)]}
    _add_effect(state, state["last_resolution"], "🎭 Each player passed one card left; the cards remain private.", order[:])
    _finish_resolution(state)


def _condition_holds(state: Dict, pid: str, cid: int) -> bool:
    players = _participants(state)
    attack_total = sum(p["chips"]["attack"] for p in players.values())
    if cid == 2:
        return attack_total >= len(players)
    if cid in (3, 4, 5):
        def value(player: Dict) -> int:
            return sum(player["chips"].values()) if cid == 4 else player["chips"]["gold" if cid == 3 else "faith"]
        return all(value(players[pid]) > value(p) for other, p in players.items() if other != pid)
    if cid == 6:
        return attack_total == 0
    return False


def _score_match(state: Dict) -> None:
    players = _participants(state)
    final_cards = {pid: p["hand"][0] for pid, p in players.items()}
    winners = [pid for pid, cid in final_cards.items() if _condition_holds(state, pid, cid)]
    if not winners:
        winners = [pid for pid, cid in final_cards.items() if cid == 7]
    gain = 2 if len(winners) == 1 else 1 if winners else 0
    for pid in winners:
        players[pid]["score"] += gain
    state["last_match_summary"] = {
        "match": state["match_number"], "final_cards": {pid: _card(cid) for pid, cid in final_cards.items()},
        "winners": winners, "victory_points_gained": gain,
        "scores": {pid: p["score"] for pid, p in players.items()},
        "chips": {pid: copy.deepcopy(p["chips"]) for pid, p in players.items()},
    }
    state["game_over"] = any(p["score"] >= 2 for p in players.values())
    if state["game_over"]:
        best = max(p["score"] for p in players.values())
        state["winner_ids"] = [pid for pid, p in players.items() if p["score"] == best]
    _phase(state, "game_over" if state["game_over"] else "match_review")
    _log(state, f"Match {state['match_number']} scored: {', '.join(_name(state, pid) for pid in winners) or 'no winners'}; +{gain} 🏆.")


def _advance(state: Dict) -> None:
    if state["phase"] == "match_review":
        _new_match(state)
    elif state["phase"] == "round_review" and state["play_round"] == 4:
        _score_match(state)
    else:
        state["play_round"] += 1
        state.update(pending_cards={}, pending_passes={}, last_resolution=None, pass_memory={})
        _phase(state, "playing")
        # Senate hands were shuffled once at setup. They draw the next card
        # without revealing it until all room seats have selected.
        for pid, senator in state["senators"].items():
            state["pending_cards"][pid] = senator["hand"].pop()


class MoshimoYushaGame:
    game_id = "moshimo_yusha"
    min_players = 1
    max_players = 7

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("Invalid If You Have a Brave configuration")
        if not 1 <= len(players) <= 7:
            raise ValueError("If You Have a Brave requires 1–7 players")
        ids = [p.get("player_id") for p in players]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("Player IDs must be unique nonempty strings")
        ordered = sorted(players, key=lambda p: p.get("seat", 0))
        state = {
            "game_id": MoshimoYushaGame.game_id, "version": 2,
            "game_instance_id": secrets.token_hex(12), "window_id": 0, "revision": 0,
            "config": {}, "seed": config.get("seed", secrets.token_hex(16)),
            "players": {}, "senators": {}, "turn_order": [p["player_id"] for p in ordered],
            "table_order": [], "match_number": 0, "history": [], "round_history": [],
            "game_over": False, "current_turn": None,
        }
        for i, raw in enumerate(ordered):
            state["players"][raw["player_id"]] = {"name": str(raw.get("name") or raw["player_id"]),
                "seat": i, "is_bot": bool(raw.get("is_bot")), "score": 0}
        for i in range(max(0, 3 - len(players))):
            pid = f"senate-{secrets.token_hex(8)}"
            state["senators"][pid] = {"name": f"Senate {i + 1}", "seat": len(players) + i,
                                       "is_bot": True, "score": 0}
        state["table_order"] = list(_participants(state))
        _new_match(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        phase = state["phase"]
        field, kind = {"setup_discard": ("setup_submissions", "discard"),
                       "playing": ("pending_cards", "play"),
                       "pass_cards": ("pending_passes", "pass_card")}.get(phase, (None, None))
        if field:
            return [] if player_id in state[field] else [kind]
        if phase in REVIEW_PHASES and player_id not in state["next_round_ready"]:
            return ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not _ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action"
        numeric_fields = [action["window_id"], *action.get("card_ids", [])]
        if "card_id" in action:
            numeric_fields.append(action["card_id"])
        if any(type(value) is not int for value in numeric_fields):
            return [], "Invalid action"
        if (action["game_instance_id"] != state["game_instance_id"]
                or action["window_id"] != state["window_id"]):
            return [], "This action is from an earlier window. Refresh your view."
        kind = action["type"]
        if kind not in MoshimoYushaGame.get_legal_actions(state, player_id):
            return [], "Action is not available"
        player = state["players"][player_id]
        if kind == "discard":
            cards = action["card_ids"]
            if any(cid not in player["hand"] for cid in cards):
                return [], "Choose two cards from your hand"
            for cid in cards:
                player["hand"].remove(cid)
            state["setup_submissions"][player_id] = cards[:]
            if len(state["setup_submissions"]) == len(state["table_order"]):
                # Sorting the pooled cards discards ownership and timing clues.
                state["discarded"] = sorted(cid for cards in state["setup_submissions"].values() for cid in cards)
                _phase(state, "setup_review")
                _log(state, "The anonymous discard pool is revealed. Review it before round 1.")
        elif kind in ("play", "pass_card"):
            cid = action["card_id"]
            if cid not in player["hand"]:
                return [], "Choose a card from your hand"
            if kind == "play":
                player["hand"].remove(cid)
                state["pending_cards"][player_id] = cid
                if len(state["pending_cards"]) == len(state["table_order"]):
                    _resolve_cards(state)
            else:
                state["pending_passes"][player_id] = cid
                if len(state["pending_passes"]) == len(state["turn_order"]):
                    _pass_cards(state)
        else:
            state["next_round_ready"].append(player_id)
            if len(state["next_round_ready"]) == len(state["turn_order"]):
                _advance(state)
        state["revision"] += 1
        # Private card selections never enter shared action events.
        return [{"type": "moshimo_yusha:updated", "payload": {"player_id": player_id, "action": kind}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = _participants(state)
        field = {"setup_discard": "setup_submissions", "playing": "pending_cards",
                 "pass_cards": "pending_passes"}.get(state["phase"])
        submitted = list(state[field]) if field else []
        return {
            "game_id": MoshimoYushaGame.game_id, "game_instance_id": state["game_instance_id"],
            "window_id": state["window_id"], "revision": state["revision"], "you": viewer_id, "config": {},
            "phase": state["phase"], "match_number": state["match_number"], "play_round": state["play_round"],
            "turn_order": state["turn_order"][:], "submitted": submitted,
            "players": [{"player_id": pid, "name": p["name"], "is_bot": p["is_bot"],
                         "is_senate": pid in state["senators"], "seat": p["seat"],
                         "card_count": len(p["hand"]), "chips": copy.deepcopy(p["chips"]),
                         "score": p["score"], "submitted": pid in submitted}
                        for pid, p in players.items()],
            "cards": copy.deepcopy(CARD_DEFINITIONS), "chips": copy.deepcopy(CHIP_META),
            "discarded": [_card(cid) for cid in state["discarded"]], "played": copy.deepcopy(state["played"]),
            "last_resolution": copy.deepcopy(state["last_resolution"]),
            "last_match_summary": copy.deepcopy(state["last_match_summary"]),
            "history": state["history"][-30:], "round_history": copy.deepcopy(state["round_history"]),
            "next_round_ready": state["next_round_ready"][:], "game_over": state["game_over"],
            "winner_ids": state["winner_ids"][:],
            "legal_actions": MoshimoYushaGame.get_legal_actions(state, viewer_id),
            "my_hand": [_card(cid) for cid in players[viewer_id]["hand"]] if viewer_id in state["players"] else [],
            "my_submission": copy.deepcopy(state[field].get(viewer_id)) if field and viewer_id in state["players"] else None,
            "my_exchange": copy.deepcopy(state["pass_memory"].get(viewer_id)),
        }

    @staticmethod
    def bot_move(state: Dict, player_id: str) -> Optional[Dict]:
        if player_id not in state["players"] or not state["players"][player_id]["is_bot"]:
            return None
        return bot_from_view(MoshimoYushaGame.get_public_view(state, player_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        """Check private save invariants before a restored room becomes visible."""
        try:
            state = copy.deepcopy(payload)
            if state["game_id"] != MoshimoYushaGame.game_id or state["version"] != 2:
                raise ValueError("Unsupported save version")
            players = _participants(state)
            order = state["turn_order"]
            if (not 1 <= len(order) <= 7 or len(set(order)) != len(order) or set(order) != set(state["players"])
                    or set(state["players"]) & set(state["senators"])
                    or list(players) != state["table_order"] or state["phase"] not in PHASES
                    or state["game_over"] != (state["phase"] == "game_over")):
                raise ValueError("Invalid players or phase")
            for field in ("window_id", "revision", "match_number", "play_round"):
                if type(state[field]) is not int or state[field] < 0:
                    raise ValueError("Invalid counter")
            if not 0 <= state["play_round"] <= 4 or not isinstance(state["game_instance_id"], str):
                raise ValueError("Invalid window")
            def check_cards(cards: List[int]) -> None:
                if not isinstance(cards, list) or any(type(cid) is not int or cid not in CARD_BY_ID for cid in cards):
                    raise ValueError("Invalid cards")
            all_cards = []
            for p in players.values():
                check_cards(p["hand"])
                all_cards.extend(p["hand"])
                if (set(p["chips"]) != set(CHIP_TYPES) or any(type(x) is not int or x < 0 for x in p["chips"].values())
                        or type(p["score"]) is not int or p["score"] < 0):
                    raise ValueError("Invalid chips or score")
            if state["phase"] == "setup_discard":
                for cards in state["setup_submissions"].values():
                    check_cards(cards)
                    all_cards.extend(cards)
            else:
                check_cards(state["discarded"])
                all_cards.extend(state["discarded"])
            all_cards.extend(row["card_id"] for row in state["played"])
            all_cards.extend(state["pending_cards"].values())
            if Counter(all_cards) != Counter({cid: len(players) for cid in CARD_IDS}):
                raise ValueError("Cards are not conserved")
            if (len(set(state["next_round_ready"])) != len(state["next_round_ready"])
                    or not set(state["next_round_ready"]) <= set(order)
                    or not set(state["pending_cards"]) <= set(players)
                    or not set(state["pending_passes"]) <= set(order)):
                raise ValueError("Invalid submissions")
            for pid, cid in state["pending_passes"].items():
                if cid not in players[pid]["hand"]:
                    raise ValueError("Invalid exchange")
            # Exercise the full projection to reject missing required fields.
            MoshimoYushaGame.get_public_view(state, order[0])
            return state
        except (KeyError, TypeError, AttributeError, IndexError) as exc:
            raise ValueError("Invalid If You Have a Brave save") from exc


def bot_from_view(view: Dict) -> Optional[Dict]:
    """Decisions only use the same information available to a human seat."""
    legal = view["legal_actions"]
    if not legal:
        return None
    rng = random.Random(f"{view['game_instance_id']}:{view['window_id']}:{view['you']}")
    hand = [c["id"] for c in view["my_hand"]]
    kind = legal[0]
    fields = {}
    if kind == "discard":
        fields["card_ids"] = rng.sample(hand, 2)
    elif kind in ("play", "pass_card"):
        # Prefer to keep a currently achievable final objective near the end,
        # but allow diverse choices so identical starting hands do not lockstep.
        own = next(p for p in view["players"] if p["player_id"] == view["you"])
        others = [p for p in view["players"] if p["player_id"] != view["you"]]
        def keep(cid: int) -> float:
            if cid == 1:
                return -2
            if cid == 2:
                return 2 if sum(p["chips"]["attack"] for p in view["players"]) >= len(view["players"]) else 0
            if cid in (3, 4, 5):
                value = lambda p: sum(p["chips"].values()) if cid == 4 else p["chips"]["gold" if cid == 3 else "faith"]
                return 2 if all(value(own) > value(p) for p in others) else 0
            if cid == 6:
                return 2 if not sum(p["chips"]["attack"] for p in view["players"]) else -1
            return 0.5
        if len(hand) <= 2:
            fields["card_id"] = min(hand, key=lambda cid: keep(cid) + rng.random())
        else:
            fields["card_id"] = rng.choice(hand)
    return {"type": kind, **fields, "game_instance_id": view["game_instance_id"], "window_id": view["window_id"]}
