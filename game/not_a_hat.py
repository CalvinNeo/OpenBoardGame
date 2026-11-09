"""似帽非帽 / That's Not a Hat (Ravensburger, 2023, Kasper Lapp).

A memory and bluffing party game. Every gift card shows one everyday object on
the front and an arrow plus a light or dark back on the reverse. Players slide
face-down gifts around the table and announce what they are handing over. The
receiver either accepts the gift or refuses it, and whoever was wrong about the
object takes the revealed card as a penalty. The game ends the moment somebody
collects a third penalty card, and the fewest penalties wins.

Hidden information in this game is *memory*, not ownership: the server always
knows what every card holds, but no viewer is ever told the object under a
face-down card, not even the player holding it.
"""
import random
from typing import Dict, List, Optional, Tuple

from game.not_a_hat_data import (
    ACTION_SCHEMA,
    CATEGORIES,
    CONFIG_SCHEMA,
    COPIES_PER_ITEM,
    ITEM_BY_KEY,
    ITEM_KEYS,
    ITEMS,
)


DEFAULT_CONFIG = {
    "max_penalties": 3,
    "starting_gifts": 1,
}

PHASE_MEMORIZE = "memorize"
PHASE_GIVING = "giving"
PHASE_RECEIVING = "receiving"
PHASE_REVIEW = "review"
PHASE_GAME_OVER = "game_over"

DIRECTION_LEFT = "left"
DIRECTION_RIGHT = "right"
BACK_LIGHT = "light"
BACK_DARK = "dark"

MAX_LOG_ENTRIES = 40


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _build_deck() -> List[Dict]:
    """Two copies of every object, so 110 cards, half of them light-backed."""
    cards: List[Dict] = []
    card_id = 0
    for key in ITEM_KEYS:
        for _ in range(COPIES_PER_ITEM):
            cards.append(
                {
                    "id": card_id,
                    "item": key,
                    "dir": random.choice([DIRECTION_LEFT, DIRECTION_RIGHT]),
                    "back": BACK_LIGHT if card_id % 2 == 0 else BACK_DARK,
                    "face_up": False,
                }
            )
            card_id += 1
    random.shuffle(cards)
    return cards


def _item_label(key: Optional[str]) -> Optional[Dict[str, str]]:
    item = ITEM_BY_KEY.get(key) if key else None
    if not item:
        return None
    return {"key": item["key"], "emoji": item["emoji"], "zh": item["zh"], "en": item["en"]}


def _card_view(card: Optional[Dict], reveal: bool = False) -> Optional[Dict]:
    """Public projection of a card. The object only leaks when it is face up."""
    if not card:
        return None
    view = {
        "id": card["id"],
        "dir": card["dir"],
        "back": card["back"],
        "face_up": bool(card["face_up"]),
    }
    if card["face_up"] or reveal:
        view["item"] = card["item"]
    return view


def _neighbor(state: Dict, player_id: str, direction: str) -> Optional[str]:
    order = state["turn_order"]
    if player_id not in order or len(order) < 2:
        return None
    index = order.index(player_id)
    step = -1 if direction == DIRECTION_LEFT else 1
    return order[(index + step) % len(order)]


def _push_log(state: Dict, entry: Dict) -> None:
    log = state.setdefault("log", [])
    log.append(entry)
    if len(log) > MAX_LOG_ENTRIES:
        del log[: len(log) - MAX_LOG_ENTRIES]


def _mark_revealed(state: Dict, card: Dict) -> None:
    state.setdefault("reveal_seq", {})[str(card["id"])] = state["seq"]


def _draw_shop_gift(state: Dict, player_id: str) -> Optional[Dict]:
    """Take the top card of the gift shop and show it to the whole table."""
    deck = state["deck"]
    if not deck:
        return None
    card = deck.pop(0)
    card["face_up"] = True
    _mark_revealed(state, card)
    _push_log(state, {"kind": "shop", "player": player_id, "item": card["item"]})
    return card


def _begin_pass(state: Dict, giver: str) -> None:
    """Hand the turn to `giver`, who now has to announce the gift out loud."""
    state["giver"] = giver
    state["receiver"] = None
    state["announced"] = None
    state["phase"] = PHASE_GIVING
    if state.get("pending") is None:
        stack = state["players"][giver]["stack"]
        if stack:
            # The oldest gift is turned face down the moment it is offered, so
            # nobody can simply read the answer off the board.
            stack[0]["face_up"] = False


def _penalty_counts(state: Dict) -> Dict[str, int]:
    return {pid: len(pdata["penalties"]) for pid, pdata in state["players"].items()}


def _game_should_end(state: Dict) -> bool:
    limit = int(state["config"]["max_penalties"])
    if any(count >= limit for count in _penalty_counts(state).values()):
        return True
    return not state["deck"]


def _finish_game(state: Dict) -> None:
    counts = _penalty_counts(state)
    best = min(counts.values()) if counts else 0
    state["scores"] = counts
    state["winners"] = sorted(pid for pid, value in counts.items() if value == best)
    state["phase"] = PHASE_GAME_OVER
    state["game_over"] = True
    state["giver"] = None
    state["receiver"] = None
    state["pending"] = None
    state["in_transit"] = None
    state["ready"] = []


def _start_first_pass(state: Dict) -> None:
    card = _draw_shop_gift(state, state["start_player"])
    if card is None:
        _finish_game(state)
        return
    state["pending"] = card
    _begin_pass(state, state["start_player"])


def _resolve_refusal(state: Dict) -> List[Dict]:
    card = state["in_transit"]
    giver = state["giver"]
    receiver = state["receiver"]
    announced = state["announced"]
    card["face_up"] = True
    _mark_revealed(state, card)
    honest = announced == card["item"]
    loser = receiver if honest else giver
    state["players"][loser]["penalties"].append(card)

    for entry in reversed(state["log"]):
        if entry.get("kind") == "pass" and entry.get("outcome") == "pending":
            entry["outcome"] = "refused"
            entry["actual"] = card["item"]
            break

    state["last_refusal"] = {
        "giver": giver,
        "receiver": receiver,
        "announced": announced,
        "actual": card["item"],
        "honest": honest,
        "loser": loser,
        "penalties": _penalty_counts(state),
    }
    state["in_transit"] = None
    state["announced"] = None
    state["receiver"] = None
    state["pending"] = None
    state["ready"] = []
    state["phase"] = PHASE_REVIEW
    return [
        {
            "type": "not_a_hat:refuse",
            "payload": {
                "giver": giver,
                "receiver": receiver,
                "announced": announced,
                "actual": card["item"],
                "honest": honest,
                "loser": loser,
            },
        }
    ]


def _close_review(state: Dict) -> List[Dict]:
    events: List[Dict] = []
    if _game_should_end(state):
        _finish_game(state)
        events.append({"type": "not_a_hat:game_over", "payload": {"winners": state["winners"]}})
        return events
    loser = state["last_refusal"]["loser"]
    card = _draw_shop_gift(state, loser)
    if card is None:
        _finish_game(state)
        events.append({"type": "not_a_hat:game_over", "payload": {"winners": state["winners"]}})
        return events
    state["pending"] = card
    _begin_pass(state, loser)
    events.append({"type": "not_a_hat:pass_started", "payload": {"giver": loser}})
    return events


class NotAHatGame:
    game_id = "not_a_hat"
    min_players = 3
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        if len(player_ids) < NotAHatGame.min_players:
            raise ValueError("not_a_hat needs at least 3 players")
        player_meta = {p["player_id"]: p for p in players}
        starting_gifts = max(1, min(2, int(cfg["starting_gifts"])))

        deck = _build_deck()
        if len(deck) < len(player_ids) * starting_gifts + 1:
            raise ValueError("deck too small for player count")

        state: Dict = {
            "deck": deck,
            "players": {},
            "turn_order": player_ids,
            "player_meta": player_meta,
            "config": cfg,
            "phase": PHASE_MEMORIZE,
            "seq": 0,
            "reveal_seq": {},
            "log": [],
            "ready": [],
            "giver": None,
            "receiver": None,
            "announced": None,
            "pending": None,
            "in_transit": None,
            "last_refusal": None,
            "start_player": player_ids[0],
            "bot_skill": {},
            "scores": {},
            "winners": [],
            "game_over": False,
        }

        for pid in player_ids:
            state["players"][pid] = {"stack": [], "penalties": []}
            for _ in range(starting_gifts):
                card = deck.pop(0)
                card["face_up"] = True
                _mark_revealed(state, card)
                state["players"][pid]["stack"].append(card)
            if player_meta[pid].get("is_bot"):
                state["bot_skill"][pid] = round(random.uniform(0.55, 0.92), 3)

        state["start_player"] = random.choice(player_ids)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        ready = state.get("ready", [])
        if phase == PHASE_MEMORIZE:
            return [] if player_id in ready else ["ready"]
        if phase == PHASE_GIVING:
            return ["give"] if player_id == state.get("giver") else []
        if phase == PHASE_RECEIVING:
            return ["accept", "refuse"] if player_id == state.get("receiver") else []
        if phase == PHASE_REVIEW:
            return [] if player_id in ready else ["continue"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict):
            return [], "invalid action"
        action_type = action.get("type")
        if action_type not in NotAHatGame.get_legal_actions(state, player_id):
            return [], "invalid action"

        state["seq"] = int(state.get("seq", 0)) + 1

        if action_type == "ready":
            state["ready"].append(player_id)
            events = [{"type": "not_a_hat:ready", "payload": {"player_id": player_id}}]
            if all(pid in state["ready"] for pid in state["turn_order"]):
                state["ready"] = []
                _start_first_pass(state)
                events.append(
                    {"type": "not_a_hat:pass_started", "payload": {"giver": state.get("giver")}}
                )
            return events, None

        if action_type == "continue":
            state["ready"].append(player_id)
            events = [{"type": "not_a_hat:continue", "payload": {"player_id": player_id}}]
            if all(pid in state["ready"] for pid in state["turn_order"]):
                state["ready"] = []
                events.extend(_close_review(state))
            return events, None

        if action_type == "give":
            item = action.get("item")
            if item not in ITEM_BY_KEY:
                return [], "unknown gift"
            giver = state["giver"]
            pending = state.get("pending")
            if pending is not None:
                card = pending
                state["pending"] = None
            else:
                stack = state["players"][giver]["stack"]
                if not stack:
                    return [], "no gift to give"
                card = stack.pop(0)
            card["face_up"] = False
            receiver = _neighbor(state, giver, card["dir"])
            if receiver is None:
                return [], "no neighbour to receive the gift"
            state["in_transit"] = card
            state["receiver"] = receiver
            state["announced"] = item
            state["phase"] = PHASE_RECEIVING
            _push_log(
                state,
                {
                    "kind": "pass",
                    "giver": giver,
                    "receiver": receiver,
                    "item": item,
                    "outcome": "pending",
                },
            )
            return [
                {
                    "type": "not_a_hat:give",
                    "payload": {"giver": giver, "receiver": receiver, "item": item},
                }
            ], None

        if action_type == "accept":
            receiver = state["receiver"]
            card = state["in_transit"]
            state["players"][receiver]["stack"].append(card)
            for entry in reversed(state["log"]):
                if entry.get("kind") == "pass" and entry.get("outcome") == "pending":
                    entry["outcome"] = "accepted"
                    break
            state["in_transit"] = None
            state["announced"] = None
            state["receiver"] = None
            _begin_pass(state, receiver)
            return [
                {"type": "not_a_hat:accept", "payload": {"player_id": receiver, "giver": receiver}}
            ], None

        if action_type == "refuse":
            return _resolve_refusal(state), None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        ready = set(state.get("ready", []))
        giver = state.get("giver")
        receiver = state.get("receiver")
        player_ids = sorted(
            state["player_meta"].keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        counts = _penalty_counts(state)

        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "stack": [_card_view(card) for card in pdata["stack"]],
                    "penalties": [card["item"] for card in pdata["penalties"]],
                    "penalty_count": counts.get(pid, 0),
                    "is_giver": pid == giver,
                    "is_receiver": pid == receiver,
                    "is_you": pid == viewer_id,
                    "ready": pid in ready,
                    "seat_index": state["turn_order"].index(pid) if pid in state["turn_order"] else 0,
                }
            )

        deck = state["deck"]
        shop_top = deck[0]["item"] if deck else None

        return {
            "game_id": NotAHatGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "seq": state.get("seq", 0),
            "round": len([e for e in state.get("log", []) if e.get("kind") == "pass"]),
            "players": players_view,
            "turn_order": list(state["turn_order"]),
            "giver": giver,
            "receiver": receiver,
            "announced": state.get("announced"),
            "announced_label": _item_label(state.get("announced")),
            "pending": _card_view(state.get("pending")),
            "pending_label": _item_label(
                state["pending"]["item"] if state.get("pending") else None
            ),
            "in_transit": _card_view(state.get("in_transit")),
            "shop_count": len(deck),
            "shop_top": shop_top,
            "shop_top_label": _item_label(shop_top),
            "ready": sorted(ready),
            "last_refusal": state.get("last_refusal"),
            "log": list(state.get("log", [])),
            "legal_actions": NotAHatGame.get_legal_actions(state, viewer_id),
            "game_over": bool(state.get("game_over")),
            "winners": list(state.get("winners", [])),
            "scores": dict(state.get("scores", {}) or counts),
            "start_player": state.get("start_player"),
            "items": [
                {
                    "key": item["key"],
                    "emoji": item["emoji"],
                    "zh": item["zh"],
                    "en": item["en"],
                    "category": item["category"],
                }
                for item in ITEMS
            ],
            "categories": list(CATEGORIES),
            "config": {
                "max_penalties": int(state["config"]["max_penalties"]),
                "starting_gifts": int(state["config"]["starting_gifts"]),
            },
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.not_a_hat_ai import choose_action

        if state.get("game_over"):
            return None
        if not NotAHatGame.get_legal_actions(state, bot_id):
            return None
        return choose_action(state, bot_id)

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload


__all__ = [
    "ACTION_SCHEMA",
    "CONFIG_SCHEMA",
    "DEFAULT_CONFIG",
    "NotAHatGame",
    "PHASE_GIVING",
    "PHASE_GAME_OVER",
    "PHASE_MEMORIZE",
    "PHASE_RECEIVING",
    "PHASE_REVIEW",
]
