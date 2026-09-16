import copy
import itertools
import json
import random
import secrets
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


BEAN_IDS = ("garden", "red", "soy", "green", "stink", "blue")
BEAN_NAMES = {
    "garden": "Garden Bean",
    "red": "Red Bean",
    "soy": "Soy Bean",
    "green": "Green Bean",
    "stink": "Stink Bean",
    "blue": "Blue Bean",
}
DIE_TEMPLATES = {
    "dark": ("blue", "garden", "stink", "stink", "soy", "soy"),
    "light": ("stink", "red", "blue", "blue", "green", "green"),
}
DIE_SPECS = (
    ("dark-1", "dark"),
    ("dark-2", "dark"),
    ("light-1", "light"),
    ("light-2", "light"),
    ("light-3", "light"),
)
TOTAL_CARD_COUNT = 55
WINNING_SCORE = 10
CATALOG_PATH = Path(__file__).with_name("assets") / "bohnanza_dice_cards.json"


def matches_order(dice_faces: Sequence[str], order: Dict) -> bool:
    """Return whether distinct dice can fill every slot in one alternative."""

    faces = list(dice_faces)
    for alternative in order.get("alternatives", []):
        slots = sorted(alternative.get("slots", []), key=lambda slot: len(slot.get("allowed", [])))
        if len(slots) > len(faces):
            continue
        used = [False] * len(faces)

        def assign(slot_index: int) -> bool:
            if slot_index >= len(slots):
                return True
            allowed = slots[slot_index].get("allowed", [])
            for die_index, face in enumerate(faces):
                if used[die_index] or face not in allowed:
                    continue
                used[die_index] = True
                if assign(slot_index + 1):
                    return True
                used[die_index] = False
            return False

        if assign(0):
            return True
    return False


def _matched_slot_count(dice_faces: Sequence[str], order: Dict) -> int:
    faces = list(dice_faces)
    best = 0
    for alternative in order.get("alternatives", []):
        slots = sorted(alternative.get("slots", []), key=lambda slot: len(slot.get("allowed", [])))
        used = [False] * len(faces)

        def search(slot_index: int, matched: int) -> None:
            nonlocal best
            best = max(best, matched)
            if slot_index >= len(slots):
                return
            search(slot_index + 1, matched)
            allowed = slots[slot_index].get("allowed", [])
            for die_index, face in enumerate(faces):
                if used[die_index] or face not in allowed:
                    continue
                used[die_index] = True
                search(slot_index + 1, matched + 1)
                used[die_index] = False

        search(0, 0)
    return best


def _all_first_rolls() -> Iterable[Tuple[str, ...]]:
    return itertools.product(
        DIE_TEMPLATES["dark"],
        DIE_TEMPLATES["dark"],
        DIE_TEMPLATES["light"],
        DIE_TEMPLATES["light"],
        DIE_TEMPLATES["light"],
    )


def _load_catalog() -> Tuple[Dict, Dict[str, Dict], Dict[str, Dict]]:
    with CATALOG_PATH.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)
    if raw.get("schema_version") != 1:
        raise ValueError("unsupported Bohnanza Dice card catalog schema")
    if raw.get("catalog_id") != "original-compatible-v1":
        raise ValueError("unexpected Bohnanza Dice card catalog")
    if raw.get("catalog_status") != "original-compatible":
        raise ValueError("card catalog must disclose its compatible status")
    if raw.get("official_component_count") != TOTAL_CARD_COUNT:
        raise ValueError("Bohnanza Dice catalog component count must be 55")

    library = raw.get("order_library")
    cards = raw.get("cards")
    if not isinstance(library, dict) or not isinstance(cards, list) or len(cards) != TOTAL_CARD_COUNT:
        raise ValueError("Bohnanza Dice catalog must contain an order library and 55 cards")

    valid_beans = set(BEAN_IDS)
    normalized_orders: Dict[str, Dict] = {}
    for order_id, order in library.items():
        if not isinstance(order_id, str) or not isinstance(order, dict):
            raise ValueError("invalid order definition")
        alternatives = order.get("alternatives")
        if not isinstance(alternatives, list) or not alternatives:
            raise ValueError(f"order {order_id} has no alternatives")
        for alternative in alternatives:
            slots = alternative.get("slots") if isinstance(alternative, dict) else None
            if not isinstance(slots, list) or not 1 <= len(slots) <= 5:
                raise ValueError(f"order {order_id} has invalid slots")
            for slot in slots:
                allowed = slot.get("allowed") if isinstance(slot, dict) else None
                if not isinstance(allowed, list) or not allowed or len(allowed) != len(set(allowed)):
                    raise ValueError(f"order {order_id} has invalid allowed beans")
                if not set(allowed) <= valid_beans:
                    raise ValueError(f"order {order_id} contains an unknown bean")

        successes = sum(1 for faces in _all_first_rolls() if matches_order(faces, order))
        if successes <= 0:
            raise ValueError(f"order {order_id} is impossible with the five dice")
        probability = successes / (6**5)
        stored_probability = order.get("first_roll_probability")
        if isinstance(stored_probability, bool) or not isinstance(stored_probability, (int, float)):
            raise ValueError(f"order {order_id} has no first-roll probability")
        if abs(float(stored_probability) - probability) > 0.00000051:
            raise ValueError(f"order {order_id} has an incorrect first-roll probability")
        normalized = copy.deepcopy(order)
        normalized["id"] = order_id
        normalized["first_roll_probability"] = probability
        normalized["first_roll_percent"] = round(probability * 100, 1)
        normalized_orders[order_id] = normalized

    normalized_cards: Dict[str, Dict] = {}
    signatures = set()
    for card in cards:
        card_id = card.get("id") if isinstance(card, dict) else None
        order_ids = card.get("orders_bottom_to_top") if isinstance(card, dict) else None
        if not isinstance(card_id, str) or card_id in normalized_cards:
            raise ValueError("card IDs must be unique strings")
        if not isinstance(order_ids, list) or len(order_ids) != 5:
            raise ValueError(f"card {card_id} must contain five orders")
        if any(order_id not in normalized_orders for order_id in order_ids):
            raise ValueError(f"card {card_id} references an unknown order")
        signature = tuple(order_ids)
        if signature in signatures:
            raise ValueError(f"card {card_id} duplicates another card")
        signatures.add(signature)
        probabilities = [normalized_orders[order_id]["first_roll_probability"] for order_id in order_ids]
        if any(probabilities[index] < probabilities[index + 1] for index in range(4)):
            raise ValueError(f"card {card_id} does not progress from easier to harder orders")
        normalized_cards[card_id] = {
            "id": card_id,
            "orders_bottom_to_top": [copy.deepcopy(normalized_orders[order_id]) for order_id in order_ids],
        }

    metadata = {
        "schema_version": raw["schema_version"],
        "catalog_id": raw["catalog_id"],
        "catalog_status": raw["catalog_status"],
        "official_component_count": raw["official_component_count"],
        "description": raw.get("description", ""),
    }
    return metadata, normalized_orders, normalized_cards


CATALOG, ORDER_LIBRARY, CARD_BY_ID = _load_catalog()
EXPECTED_CARD_IDS = frozenset(CARD_BY_ID)


def advance_orders(card: object, completed_count: int, dice_faces: Sequence[str]) -> int:
    card_data = CARD_BY_ID.get(card) if isinstance(card, str) else card
    if not isinstance(card_data, dict):
        raise ValueError("unknown harvest card")
    progress = max(0, min(5, int(completed_count)))
    orders = card_data.get("orders_bottom_to_top", [])
    while progress < len(orders) and matches_order(dice_faces, orders[progress]):
        progress += 1
    return progress


def _safe_config(config: Optional[Dict]) -> Dict:
    clean: Dict = {"catalog_id": CATALOG["catalog_id"]}
    if isinstance(config, dict):
        seed = config.get("seed")
        if isinstance(seed, (str, int)) and not isinstance(seed, bool):
            clean["seed"] = seed
    return clean


def _sorted_player_ids(player_meta: Dict[str, Dict]) -> List[str]:
    return sorted(player_meta, key=lambda pid: (int(player_meta[pid].get("seat", 0)), pid))


def _rotated_order(state: Dict, first_player_id: str) -> List[str]:
    order = list(state.get("turn_order", []))
    if first_player_id not in order:
        return order
    index = order.index(first_player_id)
    return order[index:] + order[:index]


def _next_player(state: Dict, player_id: str) -> str:
    order = state["turn_order"]
    return order[(order.index(player_id) + 1) % len(order)]


def _rng(state: Dict, purpose: str) -> random.Random:
    counter = int(state.get("rng_counter", 0))
    state["rng_counter"] = counter + 1
    seed = f"{state.get('base_seed')}:{state.get('game_index', 1)}:{counter}:{purpose}"
    return random.Random(seed)


def _score(player_state: Dict) -> int:
    return len(player_state.get("single_coin_card_ids", [])) + (5 if player_state.get("five_coin_marker") else 0)


def _card_view(card_id: str) -> Dict:
    return copy.deepcopy(CARD_BY_ID[card_id])


def _all_card_ids_in_state(state: Dict) -> List[str]:
    card_ids = list(state.get("draw_deck", []))
    for player_state in state.get("players", {}).values():
        card_ids.append(player_state.get("top_card_id"))
        card_ids.append(player_state.get("cover_card_id"))
        card_ids.extend(player_state.get("single_coin_card_ids", []))
    return card_ids


def _assert_card_conservation(state: Dict) -> None:
    card_ids = _all_card_ids_in_state(state)
    if len(card_ids) != TOTAL_CARD_COUNT:
        raise AssertionError(f"expected {TOTAL_CARD_COUNT} harvest cards, found {len(card_ids)}")
    if None in card_ids or len(card_ids) != len(set(card_ids)):
        raise AssertionError("duplicate or missing Bohnanza Dice card instance")
    if set(card_ids) != EXPECTED_CARD_IDS:
        raise AssertionError("Bohnanza Dice card catalog mismatch")


def _assert_dice_conservation(state: Dict) -> None:
    dice = state.get("dice", [])
    expected_ids = {die_id for die_id, _ in DIE_SPECS}
    if len(dice) != 5 or {die.get("id") for die in dice} != expected_ids:
        raise AssertionError("Bohnanza Dice must contain exactly five stable dice")
    for die in dice:
        if die.get("zone") not in {"cup", "current_roll", "bean_field"}:
            raise AssertionError("invalid die zone")
        if die.get("zone") == "cup" and die.get("face") is not None:
            raise AssertionError("dice in the cup may not expose stale faces")
        if die.get("zone") != "cup" and die.get("face") not in BEAN_IDS:
            raise AssertionError("rolled dice require a valid bean face")


def _assert_state(state: Dict) -> None:
    _assert_card_conservation(state)
    _assert_dice_conservation(state)
    if bool(state.get("game_over")) != (state.get("phase") == "game_over"):
        raise AssertionError("game_over must agree with the phase")
    for player_state in state.get("players", {}).values():
        if not 0 <= int(player_state.get("completed_count", -1)) <= 5:
            raise AssertionError("card progress is outside 0..5")


def _record(state: Dict, events: List[Dict], event_type: str, payload: Dict, message: str) -> None:
    sequence = int(state.get("activity_sequence", 0)) + 1
    state["activity_sequence"] = sequence
    item = {"sequence": sequence, "type": event_type, "message": message, **copy.deepcopy(payload)}
    state.setdefault("activity", []).append(item)
    state["activity"] = state["activity"][-80:]
    state["last_action"] = item
    events.append({"type": f"bohnanza_dice:{event_type}", "payload": copy.deepcopy(payload)})


def _draw_card(state: Dict) -> str:
    if not state.get("draw_deck"):
        raise AssertionError("draw deck exhausted without recycling")
    return state["draw_deck"].pop()


def _new_dice() -> List[Dict]:
    return [{"id": die_id, "template": template, "face": None, "zone": "cup"} for die_id, template in DIE_SPECS]


def _reset_turn_dice(state: Dict) -> None:
    for die in state["dice"]:
        die["face"] = None
        die["zone"] = "cup"
    state["current_roll_id"] = None
    state["current_roll_die_ids"] = []
    state["roll_count_this_turn"] = 0
    state["repeat_used"] = False
    state["active_final_check_done"] = False
    state["decision_origin"] = None
    state["harvest_queue"] = []
    state["harvest_contexts"] = {}


def _setup_game(state: Dict) -> None:
    deck = list(EXPECTED_CARD_IDS)
    deck.sort()
    _rng(state, "harvest-card-shuffle").shuffle(deck)
    state["draw_deck"] = deck
    for player_id in state["turn_order"]:
        state["players"][player_id] = {
            "top_card_id": _draw_card(state),
            "cover_card_id": _draw_card(state),
            "completed_count": 0,
            "single_coin_card_ids": [],
            "five_coin_marker": False,
        }
    state["active_player_id"] = _rng(state, "starting-player").choice(state["turn_order"])
    state["phase"] = "await_roll"
    state["game_over"] = False
    state["turn_number"] = 1
    state["roll_sequence"] = 0
    state["winner_ids"] = []
    state["rematch_ready"] = []
    state["final_phase"] = False
    state["final_trigger"] = None
    state["activity"] = []
    state["activity_sequence"] = 0
    state["last_action"] = None
    state["dice"] = _new_dice()
    _reset_turn_dice(state)
    _assert_state(state)


def _advance_player_orders(state: Dict, player_id: str, dice_faces: Sequence[str], events: List[Dict], source: str) -> int:
    player_state = state["players"][player_id]
    before = int(player_state.get("completed_count", 0))
    after = advance_orders(player_state["top_card_id"], before, dice_faces)
    player_state["completed_count"] = after
    gained = after - before
    if gained:
        _record(
            state,
            events,
            "orders_advanced",
            {"player_id": player_id, "gained": gained, "completed_count": after, "source": source},
            f"{player_id} completed {gained} order{'s' if gained != 1 else ''}.",
        )
    return gained


def _queue_phase(origin: str) -> str:
    return {"after_roll": "harvest_decision", "turn_end": "turn_end_harvest", "final": "final_harvest"}[origin]


def _open_harvest_queue(state: Dict, origin: str, order: Sequence[str], contexts: Dict[str, Optional[List[str]]]) -> None:
    queue = [player_id for player_id in order if state["players"][player_id]["completed_count"] >= 3]
    state["decision_origin"] = origin
    state["harvest_queue"] = queue
    state["harvest_contexts"] = {player_id: copy.deepcopy(contexts.get(player_id)) for player_id in queue}
    if queue:
        state["phase"] = _queue_phase(origin)


def _current_roll_faces(state: Dict) -> List[str]:
    return [die["face"] for die in state["dice"] if die.get("zone") == "current_roll"]


def _field_faces(state: Dict) -> List[str]:
    return [die["face"] for die in state["dice"] if die.get("zone") == "bean_field"]


def _resolve_roll(state: Dict, events: List[Dict], reason: str) -> None:
    cup_dice = [die for die in state["dice"] if die.get("zone") == "cup"]
    if not cup_dice:
        raise AssertionError("cannot roll an empty cup")
    rng = _rng(state, f"roll:{state.get('turn_number')}:{reason}")
    for die in cup_dice:
        die["face"] = rng.choice(DIE_TEMPLATES[die["template"]])
        die["zone"] = "current_roll"
    state["roll_sequence"] = int(state.get("roll_sequence", 0)) + 1
    state["roll_count_this_turn"] = int(state.get("roll_count_this_turn", 0)) + 1
    state["current_roll_id"] = f"roll-{state['roll_sequence']}"
    state["current_roll_die_ids"] = [die["id"] for die in cup_dice]
    faces = [die["face"] for die in cup_dice]
    _record(
        state,
        events,
        "roll",
        {"player_id": state["active_player_id"], "roll_id": state["current_roll_id"], "dice": [{"id": die["id"], "face": die["face"]} for die in cup_dice], "reason": reason},
        f"{state['active_player_id']} rolled {len(cup_dice)} dice.",
    )

    active = state["active_player_id"]
    for player_id in state["turn_order"]:
        if player_id != active:
            _advance_player_orders(state, player_id, faces, events, "current_roll")
    order = _rotated_order(state, _next_player(state, active))
    contexts = {player_id: (None if player_id == active else list(faces)) for player_id in order}
    _open_harvest_queue(state, "after_roll", order, contexts)
    if not state["harvest_queue"]:
        state["phase"] = "after_roll"
        state["decision_origin"] = None
        state["harvest_contexts"] = {}


def _advance_turn(state: Dict, events: List[Dict]) -> None:
    previous = state["active_player_id"]
    state["active_player_id"] = _next_player(state, previous)
    state["turn_number"] = int(state.get("turn_number", 1)) + 1
    _reset_turn_dice(state)
    state["phase"] = "await_roll"
    _record(
        state,
        events,
        "turn_started",
        {"player_id": state["active_player_id"], "turn_number": state["turn_number"]},
        f"It is now {state['active_player_id']}'s turn.",
    )


def _finish_active_turn(state: Dict, events: List[Dict]) -> None:
    active = state["active_player_id"]
    faces = _field_faces(state)
    if len(faces) != 5:
        raise AssertionError("active player may only check orders with all five field dice")
    _advance_player_orders(state, active, faces, events, "bean_field")
    state["active_final_check_done"] = True
    order = _rotated_order(state, active)
    contexts = {player_id: (list(faces) if player_id == active else None) for player_id in order}
    _open_harvest_queue(state, "turn_end", order, contexts)
    if not state["harvest_queue"]:
        state["decision_origin"] = None
        state["harvest_contexts"] = {}
        _advance_turn(state, events)


def _available_draw_capacity(state: Dict) -> int:
    recyclable = sum(
        5
        for player_state in state["players"].values()
        if not player_state.get("five_coin_marker") and len(player_state.get("single_coin_card_ids", [])) >= 5
    )
    return len(state.get("draw_deck", [])) + recyclable


def _ensure_draw_capacity(state: Dict, needed: int, first_player_id: str, events: List[Dict]) -> None:
    if _available_draw_capacity(state) < needed:
        raise AssertionError("harvest card conservation cannot satisfy the draw")
    candidate_order = _rotated_order(state, first_player_id)
    while len(state["draw_deck"]) < needed:
        candidate = next(
            (
                player_id
                for player_id in candidate_order
                if not state["players"][player_id].get("five_coin_marker")
                and len(state["players"][player_id].get("single_coin_card_ids", [])) >= 5
            ),
            None,
        )
        if candidate is None:
            raise AssertionError("no eligible five-coin exchange")
        player_state = state["players"][candidate]
        recycled = player_state["single_coin_card_ids"][:5]
        player_state["single_coin_card_ids"] = player_state["single_coin_card_ids"][5:]
        player_state["five_coin_marker"] = True
        state["draw_deck"].extend(recycled)
        _rng(state, f"recycle:{candidate}").shuffle(state["draw_deck"])
        _record(
            state,
            events,
            "cards_recycled",
            {"player_id": candidate, "card_count": 5},
            f"{candidate} exchanged five coin cards for a 5-coin marker.",
        )


def _finish_game(state: Dict, events: List[Dict]) -> None:
    scores = {player_id: _score(player_state) for player_id, player_state in state["players"].items()}
    winning_score = max(scores.values(), default=0)
    state["winner_ids"] = [player_id for player_id in state["turn_order"] if scores[player_id] == winning_score]
    state["phase"] = "game_over"
    state["game_over"] = True
    state["harvest_queue"] = []
    state["harvest_contexts"] = {}
    state["decision_origin"] = None
    state["rematch_ready"] = [
        player_id
        for player_id in state["turn_order"]
        if bool(state.get("player_meta", {}).get(player_id, {}).get("is_bot"))
    ]
    _record(
        state,
        events,
        "game_over",
        {"winner_ids": list(state["winner_ids"]), "scores": scores},
        "The final harvest is complete.",
    )


def _enter_final_phase(state: Dict, events: List[Dict], trigger_player_id: str, origin: str) -> None:
    retained_faces = _current_roll_faces(state) if origin == "after_roll" else None
    state["final_phase"] = True
    state["final_trigger"] = {
        "player_id": trigger_player_id,
        "score": _score(state["players"][trigger_player_id]),
        "origin": origin,
        "retained_roll_faces": copy.deepcopy(retained_faces),
    }
    for die in state["dice"]:
        if die.get("zone") in {"current_roll", "cup"}:
            if die.get("face") is None:
                raise AssertionError("final phase cannot bank an unrolled die")
            die["zone"] = "bean_field"
    state["current_roll_die_ids"] = []
    _record(
        state,
        events,
        "final_phase",
        {"player_id": trigger_player_id, "score": state["final_trigger"]["score"], "origin": origin},
        f"{trigger_player_id} reached {state['final_trigger']['score']} coins. Final harvest begins.",
    )
    active = state["active_player_id"]
    field_faces = _field_faces(state)
    if not state.get("active_final_check_done"):
        _advance_player_orders(state, active, field_faces, events, "final_bean_field")
        state["active_final_check_done"] = True
    order = _rotated_order(state, active)
    contexts: Dict[str, Optional[List[str]]] = {}
    for player_id in order:
        if player_id == active:
            contexts[player_id] = list(field_faces)
        elif origin == "after_roll":
            contexts[player_id] = copy.deepcopy(retained_faces)
        else:
            contexts[player_id] = None
    _open_harvest_queue(state, "final", order, contexts)
    if not state["harvest_queue"]:
        _finish_game(state, events)


def _resume_after_queue(state: Dict, events: List[Dict], origin: str) -> None:
    state["decision_origin"] = None
    state["harvest_contexts"] = {}
    if origin == "after_roll":
        state["phase"] = "after_roll"
    elif origin == "turn_end":
        _advance_turn(state, events)
    elif origin == "final":
        _finish_game(state, events)
    else:
        raise AssertionError("unknown harvest checkpoint")


def _apply_harvest(state: Dict, player_id: str, events: List[Dict]) -> None:
    player_state = state["players"][player_id]
    completed = int(player_state["completed_count"])
    reward = completed - 2
    origin = state["decision_origin"]
    context = copy.deepcopy(state.get("harvest_contexts", {}).get(player_id))
    _ensure_draw_capacity(state, reward, player_id, events)

    harvested_card = player_state["top_card_id"]
    player_state["single_coin_card_ids"].append(harvested_card)
    bonus_cards = [_draw_card(state) for _ in range(reward - 1)]
    player_state["single_coin_card_ids"].extend(bonus_cards)
    player_state["top_card_id"] = player_state["cover_card_id"]
    player_state["cover_card_id"] = _draw_card(state)
    player_state["completed_count"] = 0
    if context:
        _advance_player_orders(state, player_id, context, events, f"harvest:{origin}")
    score = _score(player_state)
    _record(
        state,
        events,
        "harvest",
        {"player_id": player_id, "reward": reward, "completed_count": completed, "score": score},
        f"{player_id} harvested {reward} coin{'s' if reward != 1 else ''}.",
    )

    if score >= WINNING_SCORE and not state.get("final_phase"):
        _enter_final_phase(state, events, player_id, origin)
        return

    if player_state["completed_count"] < 3:
        state["harvest_queue"].pop(0)
        state.get("harvest_contexts", {}).pop(player_id, None)
    if not state["harvest_queue"]:
        _resume_after_queue(state, events, origin)


class BohnanzaDiceGame:
    game_id = "bohnanza_dice"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not (BohnanzaDiceGame.min_players <= len(players) <= BohnanzaDiceGame.max_players):
            raise ValueError("Bohnanza: Das Würfelspiel requires 2 to 5 players")
        player_meta = {player["player_id"]: dict(player) for player in players}
        if len(player_meta) != len(players):
            raise ValueError("player IDs must be unique")
        clean_config = _safe_config(config)
        base_seed = clean_config.get("seed")
        if base_seed is None:
            base_seed = secrets.token_hex(16)
        state = {
            "version": 1,
            "game_id": BohnanzaDiceGame.game_id,
            "config": clean_config,
            "base_seed": base_seed,
            "rng_counter": 0,
            "game_index": 1,
            "turn_order": _sorted_player_ids(player_meta),
            "player_meta": player_meta,
            "players": {},
        }
        _setup_game(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "game_over":
            return [] if player_id in state.get("rematch_ready", []) else ["play_again"]
        if phase in {"harvest_decision", "turn_end_harvest", "final_harvest"}:
            if state.get("harvest_queue", [None])[0] == player_id:
                return ["harvest", "keep_growing"]
            return []
        if player_id != state.get("active_player_id"):
            return []
        if phase == "await_roll":
            return ["roll"]
        if phase == "after_roll":
            actions = ["save_dice"]
            if not state.get("repeat_used") and state.get("current_roll_die_ids"):
                actions.append("repeat_roll")
            return actions
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        action_type = action["type"]
        legal_actions = BohnanzaDiceGame.get_legal_actions(state, player_id)
        if action_type not in legal_actions:
            return [], "action is not legal now"
        events: List[Dict] = []

        if action_type == "roll":
            if any(die.get("zone") != "cup" for die in state.get("dice", [])):
                return [], "all five dice must be in the cup"
            _resolve_roll(state, events, "turn_start")

        elif action_type == "repeat_roll":
            current = [die for die in state["dice"] if die.get("zone") == "current_roll"]
            if not current:
                return [], "there are no current dice to repeat"
            state["repeat_used"] = True
            for die in current:
                die["zone"] = "cup"
                die["face"] = None
            _record(
                state,
                events,
                "repeat_roll",
                {"player_id": player_id, "die_count": len(current)},
                f"{player_id} used the once-per-turn repeat.",
            )
            _resolve_roll(state, events, "repeat")

        elif action_type == "save_dice":
            die_ids = action.get("die_ids")
            if not isinstance(die_ids, list) or not die_ids or any(not isinstance(die_id, str) for die_id in die_ids):
                return [], "choose at least one die to save"
            if len(die_ids) != len(set(die_ids)):
                return [], "die IDs must be unique"
            current_ids = {die["id"] for die in state["dice"] if die.get("zone") == "current_roll"}
            if not set(die_ids) <= current_ids:
                return [], "only dice from the current roll can be saved"
            for die in state["dice"]:
                if die["id"] in die_ids:
                    die["zone"] = "bean_field"
                elif die.get("zone") == "current_roll":
                    die["zone"] = "cup"
                    die["face"] = None
            state["current_roll_die_ids"] = []
            _record(
                state,
                events,
                "dice_saved",
                {"player_id": player_id, "die_ids": list(die_ids)},
                f"{player_id} saved {len(die_ids)} dice in the bean field.",
            )
            if any(die.get("zone") == "cup" for die in state["dice"]):
                _resolve_roll(state, events, "after_save")
            else:
                _finish_active_turn(state, events)

        elif action_type == "harvest":
            completed = int(state["players"][player_id].get("completed_count", 0))
            reward = completed - 2
            if reward not in {1, 2, 3}:
                return [], "at least three orders are required to harvest"
            if _available_draw_capacity(state) < reward:
                return [], "not enough harvest cards are available"
            _apply_harvest(state, player_id, events)

        elif action_type == "keep_growing":
            origin = state["decision_origin"]
            state["harvest_queue"].pop(0)
            state.get("harvest_contexts", {}).pop(player_id, None)
            _record(
                state,
                events,
                "keep_growing",
                {"player_id": player_id, "final": origin == "final"},
                f"{player_id} {'finished without harvesting' if origin == 'final' else 'kept growing'}.",
            )
            if not state["harvest_queue"]:
                _resume_after_queue(state, events, origin)

        elif action_type == "play_again":
            ready = state.setdefault("rematch_ready", [])
            if player_id not in ready:
                ready.append(player_id)
            events.append({"type": "bohnanza_dice:rematch_ready", "payload": {"player_id": player_id}})
            if set(ready) >= set(state["turn_order"]):
                state["game_index"] = int(state.get("game_index", 1)) + 1
                _setup_game(state)
                events.append(
                    {
                        "type": "bohnanza_dice:game_started",
                        "payload": {"active_player_id": state["active_player_id"], "game_index": state["game_index"]},
                    }
                )

        _assert_state(state)
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for player_id in state.get("turn_order", []):
            player_state = state["players"][player_id]
            meta = state.get("player_meta", {}).get(player_id, {})
            players.append(
                {
                    "player_id": player_id,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "top_card": _card_view(player_state["top_card_id"]),
                    "cover_card": _card_view(player_state["cover_card_id"]),
                    "completed_count": int(player_state.get("completed_count", 0)),
                    "single_coin_count": len(player_state.get("single_coin_card_ids", [])),
                    "five_coin_marker": bool(player_state.get("five_coin_marker")),
                    "score": _score(player_state),
                    "rematch_ready": player_id in state.get("rematch_ready", []),
                }
            )
        legal_actions = BohnanzaDiceGame.get_legal_actions(state, viewer_id)
        head = state.get("harvest_queue", [None])[0] if state.get("harvest_queue") else None
        offer = None
        if head:
            completed = int(state["players"][head]["completed_count"])
            offer = {"player_id": head, "completed_count": completed, "reward": completed - 2, "final": state.get("phase") == "final_harvest"}
        return {
            "game_id": BohnanzaDiceGame.game_id,
            "you": viewer_id,
            "catalog": copy.deepcopy(CATALOG),
            "phase": state.get("phase"),
            "game_over": bool(state.get("game_over")),
            "final_phase": bool(state.get("final_phase")),
            "final_trigger": copy.deepcopy(state.get("final_trigger")),
            "turn_number": int(state.get("turn_number", 1)),
            "active_player_id": state.get("active_player_id"),
            "players": players,
            "dice": copy.deepcopy(state.get("dice", [])),
            "roll_sequence": int(state.get("roll_sequence", 0)),
            "roll_count_this_turn": int(state.get("roll_count_this_turn", 0)),
            "current_roll_id": state.get("current_roll_id"),
            "current_roll_die_ids": list(state.get("current_roll_die_ids", [])),
            "repeat_used": bool(state.get("repeat_used")),
            "decision_origin": state.get("decision_origin"),
            "harvest_queue": list(state.get("harvest_queue", [])),
            "harvest_offer": offer,
            "draw_deck_count": len(state.get("draw_deck", [])),
            "winning_score": WINNING_SCORE,
            "winner_ids": list(state.get("winner_ids", [])),
            "rematch_ready": list(state.get("rematch_ready", [])),
            "legal_actions": legal_actions,
            "selectable_die_ids": list(state.get("current_roll_die_ids", [])) if "save_dice" in legal_actions else [],
            "activity": copy.deepcopy(state.get("activity", [])),
            "last_action": copy.deepcopy(state.get("last_action")),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = BohnanzaDiceGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        if "roll" in legal:
            return {"type": "roll", "delay_ms": 300}
        if "harvest" in legal:
            completed = int(state["players"][bot_id]["completed_count"])
            score = _score(state["players"][bot_id])
            opponents = [_score(state["players"][pid]) for pid in state["turn_order"] if pid != bot_id]
            should_harvest = state.get("phase") == "final_harvest" or completed >= 4 or score >= 9 or max(opponents, default=0) >= 8
            return {"type": "harvest" if should_harvest else "keep_growing", "delay_ms": 350}
        if "save_dice" in legal:
            current = [die for die in state["dice"] if die.get("zone") == "current_roll"]
            player_state = state["players"][bot_id]
            next_index = int(player_state.get("completed_count", 0))
            orders = CARD_BY_ID[player_state["top_card_id"]]["orders_bottom_to_top"]
            target = orders[min(next_index, 4)]
            options: List[Tuple[Tuple[int, int], List[str]]] = []
            for count in range(1, len(current) + 1):
                for subset in itertools.combinations(current, count):
                    faces = [die["face"] for die in subset]
                    options.append(((_matched_slot_count(faces, target), -count), [die["id"] for die in subset]))
            best_match = max((score[0] for score, _ in options), default=0)
            if "repeat_roll" in legal and best_match == 0 and len(current) > 1:
                return {"type": "repeat_roll", "delay_ms": 350}
            best_score = max(score for score, _ in options)
            best_ids = min(ids for score, ids in options if score == best_score)
            return {"type": "save_dice", "die_ids": best_ids, "delay_ms": 350}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict):
            raise ValueError("invalid Bohnanza Dice save payload")
        state = copy.deepcopy(payload)
        if state.get("version") != 1 or state.get("game_id") != BohnanzaDiceGame.game_id:
            raise ValueError("unsupported Bohnanza Dice save payload")
        if state.get("config", {}).get("catalog_id") != CATALOG["catalog_id"]:
            raise ValueError("save uses a different Bohnanza Dice card catalog")
        _assert_state(state)
        return state
