import random
from collections import Counter
from typing import Dict, List, Optional, Tuple

from game.gizmos_data import CARD_DEFS_BY_ID, ENERGY_EMOJI, ENERGY_TYPES, GIZMO_PANEL_EMOJI, LEVEL_1_CARDS, LEVEL_2_CARDS, LEVEL_3_CARDS, STARTING_GIZMO

DEFAULT_CONFIG = {
    "seed": None,
}

DISPLAY_SLOTS = {1: 4, 2: 3, 3: 2}
ENERGY_PER_COLOR = 13
ENERGY_ROW_SIZE = 6
STARTING_STORAGE_LIMIT = 5
STARTING_FILE_LIMIT = 1
STARTING_RESEARCH_AMOUNT = 3
MAX_LEVEL_3_IN_GAME = 16


def _merge_config(config: Optional[Dict]) -> Dict:
    merged = dict(DEFAULT_CONFIG)
    if isinstance(config, dict):
        merged.update(config)
    return merged


def _seed_to_int(seed_value: Optional[object]) -> int:
    if seed_value is None:
        return random.randrange(1, 2**31 - 1)
    if isinstance(seed_value, bool):
        return 1 if seed_value else 0
    if isinstance(seed_value, int):
        return seed_value
    text = str(seed_value)
    total = 0
    for char in text:
        total = (total * 131 + ord(char)) % (2**31 - 1)
    return total or 1


def _next_rng(state: Dict) -> random.Random:
    seed = int(state.get("rng_seed", 1))
    counter = int(state.get("rng_counter", 0))
    state["rng_counter"] = counter + 1
    return random.Random(seed + counter)


def _shuffle_in_place(values: List[str], rng: random.Random) -> None:
    rng.shuffle(values)


def _card_def(card_id: str) -> Dict:
    return CARD_DEFS_BY_ID[card_id]


def _card_level(card_id: str) -> int:
    return int(_card_def(card_id)["level"])


def _build_energy_types(card_id: str) -> List[str]:
    energy_type = _card_def(card_id)["energy_type"]
    if energy_type == "generic":
        return list(ENERGY_TYPES)
    return [energy_type]


def _insert_energy_into_bag(state: Dict, color: str) -> None:
    bag = state["energy_bag"]
    rng = _next_rng(state)
    if not bag:
        bag.append(color)
        return
    index = rng.randrange(0, len(bag) + 1)
    bag.insert(index, color)


def _refill_energy_row(state: Dict) -> None:
    bag = state["energy_bag"]
    row = state["energy_row"]
    while len(row) < ENERGY_ROW_SIZE and bag:
        row.append(bag.pop())


def _draw_random_energy(state: Dict, player: Dict, amount: int) -> int:
    gained = 0
    for _ in range(max(0, int(amount))):
        if len(player["storage"]) >= int(player["storage_limit"]):
            break
        bag = state["energy_bag"]
        if not bag:
            break
        player["storage"].append(bag.pop())
        gained += 1
    _refill_energy_row(state)
    return gained


def _player_score_now(player: Dict) -> int:
    return int(player.get("printed_vp", 0)) + int(player.get("vp_tokens_total", 0))


def _player_total_score(player: Dict) -> int:
    total = _player_score_now(player)
    for award in player.get("extra_awards", []):
        if award == "extra_score_storage":
            total += len(player.get("storage", []))
        elif award == "extra_score_tokens":
            total += int(player.get("vp_tokens_total", 0))
    return total


def _player_active_count(player: Dict) -> int:
    return len(player.get("active", []))


def _find_card_in_display(state: Dict, card_id: str) -> Optional[Tuple[int, int]]:
    for level_key, cards in state["display"].items():
        for index, value in enumerate(cards):
            if value == card_id:
                return int(level_key), index
    return None


def _draw_display_card(state: Dict, level: int) -> Optional[str]:
    deck = state["decks"][str(level)]
    if not deck:
        return None
    return deck.pop()


def _refill_display_slot(state: Dict, level: int, index: int) -> None:
    replacement = _draw_display_card(state, level)
    state["display"][str(level)][index] = replacement


def _remove_display_card(state: Dict, card_id: str) -> Optional[Tuple[int, int]]:
    found = _find_card_in_display(state, card_id)
    if not found:
        return None
    level, index = found
    state["display"][str(level)][index] = None
    return level, index


def _storage_counts(player: Dict) -> Counter:
    return Counter(player.get("storage", []))


def _make_counts_tuple(counts: Counter) -> Tuple[int, int, int, int]:
    return tuple(int(counts.get(color, 0)) for color in ENERGY_TYPES)


def _counts_from_tuple(counts_tuple: Tuple[int, int, int, int]) -> Counter:
    counts = Counter()
    for index, color in enumerate(ENERGY_TYPES):
        if counts_tuple[index]:
            counts[color] = int(counts_tuple[index])
    return counts


def _remove_colors_from_storage(storage: List[str], spend_order: List[str]) -> None:
    for color in spend_order:
        try:
            storage.remove(color)
        except ValueError as exc:
            raise ValueError(f"missing energy {color}") from exc


def _use_plain_generic_plan(player: Dict, cost: int) -> Optional[Dict]:
    if cost <= 0:
        return {"spend_order": [], "used_converters": []}
    counts = _storage_counts(player)
    if sum(counts.values()) < cost:
        return None
    ordered_colors = sorted(ENERGY_TYPES, key=lambda color: (-counts.get(color, 0), ENERGY_TYPES.index(color)))
    spend_order: List[str] = []
    remaining = cost
    for color in ordered_colors:
        take = min(counts.get(color, 0), remaining)
        spend_order.extend([color] * take)
        remaining -= take
        if remaining <= 0:
            break
    if remaining > 0:
        return None
    return {"spend_order": spend_order, "used_converters": []}


def _converter_candidates(player: Dict, state: Dict) -> List[Tuple[str, Dict]]:
    used = set(state.get("used_gizmos_this_turn", []))
    converters: List[Tuple[str, Dict]] = []
    for card_id in player.get("active", []):
        if card_id in used:
            continue
        card = _card_def(card_id)
        if card.get("panel") == "converter" and isinstance(card.get("effect"), dict):
            converters.append((card_id, card["effect"]))
    return converters


def _search_color_payment(player: Dict, state: Dict, target_color: str, required: int) -> Optional[Dict]:
    counts = _storage_counts(player)
    if required <= 0:
        return {"spend_order": [], "used_converters": []}

    converters = _converter_candidates(player, state)
    converter_effects = tuple((card_id, effect["kind"], tuple(effect.get("sources", [])), effect.get("source")) for card_id, effect in converters)
    best_holder = {"value": None}

    def update_best(spend_order: List[str], used_converters: List[str]) -> None:
        candidate = {
            "spend_order": list(spend_order),
            "used_converters": list(used_converters),
        }
        best = best_holder["value"]
        score = (len(candidate["used_converters"]), len(candidate["spend_order"]), tuple(candidate["spend_order"]))
        if best is None:
            best_holder["value"] = (score, candidate)
            return
        if score < best[0]:
            best_holder["value"] = (score, candidate)

    memo: Dict[Tuple[int, Tuple[int, int, int, int], int], bool] = {}

    def dfs(index: int, counts_tuple: Tuple[int, int, int, int], remaining: int, spend_order: List[str], used_converters: List[str]) -> None:
        if remaining <= 0:
            update_best(spend_order, used_converters)
            return
        if index >= len(converter_effects):
            counts_map = _counts_from_tuple(counts_tuple)
            available_plain = int(counts_map.get(target_color, 0))
            if available_plain >= remaining:
                update_best(spend_order + [target_color] * remaining, used_converters)
            return

        state_key = (index, counts_tuple, remaining)
        if state_key in memo:
            return

        dfs(index + 1, counts_tuple, remaining, spend_order, used_converters)

        counts_map = _counts_from_tuple(counts_tuple)
        card_id, kind, sources_tuple, source_color = converter_effects[index]

        if kind == "convert_specific_to_any":
            if counts_map.get(source_color, 0) > 0:
                next_counts = Counter(counts_map)
                next_counts[source_color] -= 1
                dfs(
                    index + 1,
                    _make_counts_tuple(next_counts),
                    remaining - 1,
                    spend_order + [source_color],
                    used_converters + [card_id],
                )

        elif kind == "convert_any_to_any":
            for color in ENERGY_TYPES:
                if counts_map.get(color, 0) <= 0:
                    continue
                next_counts = Counter(counts_map)
                next_counts[color] -= 1
                dfs(
                    index + 1,
                    _make_counts_tuple(next_counts),
                    remaining - 1,
                    spend_order + [color],
                    used_converters + [card_id],
                )

        elif kind == "convert_specific_to_double":
            if source_color == target_color and counts_map.get(source_color, 0) > 0:
                next_counts = Counter(counts_map)
                next_counts[source_color] -= 1
                dfs(
                    index + 1,
                    _make_counts_tuple(next_counts),
                    remaining - 2,
                    spend_order + [source_color],
                    used_converters + [card_id],
                )

        elif kind == "convert_specific_up_to_two_to_any":
            if counts_map.get(source_color, 0) > 0:
                next_counts = Counter(counts_map)
                next_counts[source_color] -= 1
                dfs(
                    index + 1,
                    _make_counts_tuple(next_counts),
                    remaining - 1,
                    spend_order + [source_color],
                    used_converters + [card_id],
                )
            if counts_map.get(source_color, 0) > 1:
                next_counts = Counter(counts_map)
                next_counts[source_color] -= 2
                dfs(
                    index + 1,
                    _make_counts_tuple(next_counts),
                    remaining - 2,
                    spend_order + [source_color, source_color],
                    used_converters + [card_id],
                )

        elif kind == "convert_each_specific_to_double":
            if target_color in sources_tuple and counts_map.get(target_color, 0) > 0:
                next_counts = Counter(counts_map)
                next_counts[target_color] -= 1
                dfs(
                    index + 1,
                    _make_counts_tuple(next_counts),
                    remaining - 2,
                    spend_order + [target_color],
                    used_converters + [card_id],
                )

        memo[state_key] = True

    dfs(0, _make_counts_tuple(counts), required, [], [])
    if not best_holder["value"]:
        return None
    return best_holder["value"][1]


def _best_build_plan(state: Dict, player: Dict, card_id: str, source: str, free_level1: bool = False) -> Optional[Dict]:
    card = _card_def(card_id)
    if free_level1:
        if int(card["level"]) != 1:
            return None
        return {"spend_order": [], "used_converters": [], "final_cost": 0}

    cost = int(card["cost"])
    if card["energy_type"] == "generic":
        plan = _use_plain_generic_plan(player, cost)
        if not plan:
            return None
        plan["final_cost"] = cost
        return plan

    discount = 0
    if int(card["level"]) == 2:
        discount += int(player["discounts"].get("level2", 0))
    if source == "archive":
        discount += int(player["discounts"].get("archive", 0))
    if source == "research":
        discount += int(player["discounts"].get("research", 0))
    final_cost = max(0, cost - discount)
    plan = _search_color_payment(player, state, card["energy_type"], final_cost)
    if not plan:
        return None
    plan["final_cost"] = final_cost
    return plan


def _pay_build_cost(state: Dict, player: Dict, plan: Dict) -> None:
    spend_order = list(plan.get("spend_order", []))
    if spend_order:
        _remove_colors_from_storage(player["storage"], spend_order)
        for color in spend_order:
            _insert_energy_into_bag(state, color)
    for converter_id in plan.get("used_converters", []):
        if converter_id not in state["used_gizmos_this_turn"]:
            state["used_gizmos_this_turn"].append(converter_id)
    _refill_energy_row(state)


def _effect_label(card_id: str) -> str:
    card = _card_def(card_id)
    return f"{GIZMO_PANEL_EMOJI.get(card['panel'], '•')} {card['text']}"


def _enqueue_effect(state: Dict, card_id: str, effect: Dict, from_build: bool = False) -> None:
    if not effect:
        return
    state["next_effect_id"] += 1
    state["pending_effects"].append(
        {
            "effect_id": state["next_effect_id"],
            "source_card_id": card_id,
            "effect": dict(effect),
            "label": _effect_label(card_id),
            "from_build": from_build,
        }
    )


def _trigger_matches(trigger: Dict, action_meta: Dict) -> bool:
    kind = trigger.get("kind")
    if kind == "on_file":
        return action_meta.get("kind") == "file"
    if kind == "on_pick":
        return action_meta.get("kind") == "pick" and action_meta.get("color") in set(trigger.get("colors", []))
    if kind == "on_build":
        if action_meta.get("kind") != "build":
            return False
        built_types = set(action_meta.get("built_energy_types", []))
        return bool(built_types.intersection(set(trigger.get("colors", []))))
    if kind == "on_build_from_archive":
        return action_meta.get("kind") == "build" and action_meta.get("source") == "archive"
    if kind == "on_build_level":
        return action_meta.get("kind") == "build" and int(action_meta.get("level", 0)) == int(trigger.get("level", 0))
    return False


def _queue_triggers_for_action(state: Dict, player_id: str, action_meta: Dict, ignore_card_id: Optional[str] = None) -> None:
    player = state["players"][player_id]
    used = set(state.get("used_gizmos_this_turn", []))
    for card_id in player.get("active", []):
        if card_id == ignore_card_id:
            continue
        if card_id in used:
            continue
        card = _card_def(card_id)
        trigger = card.get("trigger")
        if trigger and _trigger_matches(trigger, action_meta):
            _enqueue_effect(state, card_id, card.get("effect"), from_build=action_meta.get("kind") == "build")


def _apply_static_upgrade(player: Dict, card: Dict) -> None:
    effect = card.get("effect") or {}
    kind = effect.get("kind")
    if kind == "upgrade_storage":
        player["storage_limit"] += int(effect.get("amount", 1))
    elif kind == "upgrade_file":
        player["file_limit"] += int(effect.get("amount", 1))
    elif kind == "upgrade_research":
        player["research_amount"] += int(effect.get("amount", 1))
    elif kind == "upgrade_disable_file":
        player["can_file"] = False
    elif kind == "upgrade_disable_research":
        player["can_research"] = False
    elif kind == "discount_level2":
        player["discounts"]["level2"] += int(effect.get("amount", 1))
    elif kind == "discount_archive":
        player["discounts"]["archive"] += int(effect.get("amount", 1))
    elif kind == "discount_research":
        player["discounts"]["research"] += int(effect.get("amount", 1))
    elif kind in {"extra_score_storage", "extra_score_tokens"}:
        player["extra_awards"].append(kind)


def _arm_final_round_if_needed(state: Dict, player_id: str) -> None:
    if state["final_round"]["active"]:
        return
    player = state["players"][player_id]
    if int(player.get("level3_count", 0)) >= 4 or _player_active_count(player) >= 16:
        state["final_round"]["active"] = True
        state["final_round"]["triggered_by"] = player_id


def _finish_game(state: Dict) -> None:
    contenders = list(state["turn_order"])
    if not contenders:
        state["winner"] = []
        state["game_over"] = True
        state["phase"] = "game_over"
        return

    max_score = max(_player_total_score(state["players"][pid]) for pid in contenders)
    contenders = [pid for pid in contenders if _player_total_score(state["players"][pid]) == max_score]
    if len(contenders) > 1:
        max_active = max(_player_active_count(state["players"][pid]) for pid in contenders)
        contenders = [pid for pid in contenders if _player_active_count(state["players"][pid]) == max_active]
    if len(contenders) > 1:
        max_storage = max(len(state["players"][pid]["storage"]) for pid in contenders)
        contenders = [pid for pid in contenders if len(state["players"][pid]["storage"]) == max_storage]
    if len(contenders) > 1:
        order_index = {pid: index for index, pid in enumerate(state["turn_order"])}
        furthest = max(order_index[pid] for pid in contenders)
        contenders = [pid for pid in contenders if order_index[pid] == furthest]

    state["winner"] = contenders[:1]
    state["game_over"] = True
    state["phase"] = "game_over"


def _end_turn(state: Dict) -> None:
    order = state["turn_order"]
    if not order:
        _finish_game(state)
        return
    current = state["current_turn"]
    current_index = order.index(current)
    next_index = (current_index + 1) % len(order)
    next_player = order[next_index]
    state["current_turn"] = next_player
    state["base_action_taken"] = False
    state["bonus_context"] = None
    state["pending_effects"] = []
    state["used_gizmos_this_turn"] = []
    state["research_context"] = None
    if state["final_round"]["active"] and next_player == order[0]:
        _finish_game(state)
        return
    state["phase"] = "action"


def _advance_after_resolution(state: Dict) -> None:
    if state.get("game_over"):
        return
    if state.get("research_context"):
        state["phase"] = "research"
        return
    if state.get("bonus_context"):
        state["phase"] = "bonus_action"
        return
    if state["pending_effects"]:
        state["phase"] = "choose_effect"
        return
    if state.get("base_action_taken"):
        _end_turn(state)
        return
    state["phase"] = "action"


def _perform_file_from_display(state: Dict, player_id: str, card_id: str) -> Optional[Dict]:
    player = state["players"][player_id]
    if not player.get("can_file", True):
        raise ValueError("file disabled")
    if len(player["archive"]) >= int(player["file_limit"]):
        raise ValueError("archive full")
    found = _remove_display_card(state, card_id)
    if not found:
        raise ValueError("card not in display")
    level, index = found
    player["archive"].append(card_id)
    _refill_display_slot(state, level, index)
    return {"kind": "file", "card_id": card_id, "level": level}


def _perform_pick_from_row(state: Dict, player_id: str, color: str) -> Optional[Dict]:
    player = state["players"][player_id]
    if len(player["storage"]) >= int(player["storage_limit"]):
        raise ValueError("storage full")
    if color not in state["energy_row"]:
        raise ValueError("energy not available")
    state["energy_row"].remove(color)
    player["storage"].append(color)
    _refill_energy_row(state)
    return {"kind": "pick", "color": color}


def _complete_build(state: Dict, player_id: str, card_id: str, source: str, plan: Dict, removed_display: Optional[Tuple[int, int]]) -> Dict:
    player = state["players"][player_id]
    card = _card_def(card_id)

    _pay_build_cost(state, player, plan)

    if source == "archive":
        player["archive"].remove(card_id)
    elif source == "display" and removed_display:
        level, index = removed_display
        _refill_display_slot(state, level, index)

    player["active"].append(card_id)
    player["printed_vp"] += int(card.get("vp", 0))
    if int(card.get("level", 0)) == 3:
        player["level3_count"] += 1
    if card.get("panel") == "upgrade":
        _apply_static_upgrade(player, card)
    if card.get("immediate_on_build"):
        _enqueue_effect(state, card_id, card.get("effect"), from_build=True)
    _arm_final_round_if_needed(state, player_id)

    return {
        "kind": "build",
        "card_id": card_id,
        "level": int(card.get("level", 0)),
        "source": source,
        "built_energy_types": _build_energy_types(card_id),
        "used_converters": list(plan.get("used_converters", [])),
    }


def _perform_build_from_display(state: Dict, player_id: str, card_id: str, free_level1: bool = False) -> Dict:
    found = _find_card_in_display(state, card_id)
    if not found:
        raise ValueError("card not in display")
    level, index = found
    plan = _best_build_plan(state, state["players"][player_id], card_id, "display", free_level1=free_level1)
    if not plan:
        raise ValueError("cannot afford")
    state["display"][str(level)][index] = None
    return _complete_build(state, player_id, card_id, "display", plan, (level, index))


def _perform_build_from_archive(state: Dict, player_id: str, card_id: str, free_level1: bool = False) -> Dict:
    player = state["players"][player_id]
    if card_id not in player["archive"]:
        raise ValueError("card not in archive")
    plan = _best_build_plan(state, player, card_id, "archive", free_level1=free_level1)
    if not plan:
        raise ValueError("cannot afford")
    return _complete_build(state, player_id, card_id, "archive", plan, None)


def _start_research(state: Dict, player_id: str, level: int) -> None:
    player = state["players"][player_id]
    if not player.get("can_research", True):
        raise ValueError("research disabled")
    deck = state["decks"][str(level)]
    if not deck:
        raise ValueError("deck empty")
    count = min(int(player["research_amount"]), len(deck))
    drawn = [deck.pop() for _ in range(count)]
    state["research_context"] = {
        "player_id": player_id,
        "level": level,
        "drawn": drawn,
    }
    state["phase"] = "research"


def _return_research_cards_to_bottom(deck: List[str], ordered_ids: List[str]) -> None:
    for card_id in reversed(ordered_ids):
        deck.insert(0, card_id)


def _resolve_research_choice(state: Dict, player_id: str, action: Dict) -> Tuple[Optional[Dict], Optional[str]]:
    context = state.get("research_context")
    if not context or context.get("player_id") != player_id:
        return None, "no research to resolve"
    drawn = list(context.get("drawn", []))
    level = int(context.get("level", 1))
    choice = action.get("choice")
    if choice not in {"none", "file", "build"}:
        return None, "invalid research choice"

    chosen_card_id = action.get("card_id")
    if choice == "none":
        chosen_card_id = None
    else:
        if not isinstance(chosen_card_id, str) or chosen_card_id not in drawn:
            return None, "invalid research card"

    remaining = [card_id for card_id in drawn if card_id != chosen_card_id]
    requested_order = action.get("return_order")
    if not isinstance(requested_order, list):
        requested_order = remaining
    if Counter(requested_order) != Counter(remaining) or len(requested_order) != len(remaining):
        return None, "invalid return order"

    meta: Optional[Dict] = None
    player = state["players"][player_id]

    if choice == "file":
        if not player.get("can_file", True):
            return None, "file disabled"
        if len(player["archive"]) >= int(player["file_limit"]):
            return None, "archive full"
        player["archive"].append(chosen_card_id)
        meta = {"kind": "file", "card_id": chosen_card_id, "level": level, "source": "research"}
    elif choice == "build":
        plan = _best_build_plan(state, player, chosen_card_id, "research")
        if not plan:
            return None, "cannot afford"
        _pay_build_cost(state, player, plan)
        card = _card_def(chosen_card_id)
        player["active"].append(chosen_card_id)
        player["printed_vp"] += int(card.get("vp", 0))
        if int(card.get("level", 0)) == 3:
            player["level3_count"] += 1
        if card.get("panel") == "upgrade":
            _apply_static_upgrade(player, card)
        if card.get("immediate_on_build"):
            _enqueue_effect(state, chosen_card_id, card.get("effect"), from_build=True)
        _arm_final_round_if_needed(state, player_id)
        meta = {
            "kind": "build",
            "card_id": chosen_card_id,
            "level": int(card.get("level", 0)),
            "source": "research",
            "built_energy_types": _build_energy_types(chosen_card_id),
            "used_converters": list(plan.get("used_converters", [])),
        }

    _return_research_cards_to_bottom(state["decks"][str(level)], list(requested_order))
    state["research_context"] = None
    return meta, None


def _effect_is_resolvable(state: Dict, player_id: str, effect_item: Dict) -> bool:
    player = state["players"][player_id]
    effect = effect_item.get("effect") or {}
    kind = effect.get("kind")
    if kind in {"draw_random", "gain_vp"}:
        return True
    if kind == "pick_energy":
        if len(player["storage"]) >= int(player["storage_limit"]):
            return False
        allowed = set(effect.get("colors") or list(ENERGY_TYPES))
        return any(color in allowed for color in state["energy_row"])
    if kind == "perform_file":
        return bool(player.get("can_file", True)) and len(player["archive"]) < int(player["file_limit"]) and any(
            card_id for cards in state["display"].values() for card_id in cards if card_id
        )
    if kind == "perform_research":
        return bool(player.get("can_research", True)) and any(state["decks"][level] for level in state["decks"])
    if kind == "free_build_level1":
        for cards in state["display"].values():
            for card_id in cards:
                if card_id and _card_level(card_id) == 1:
                    return True
        return any(_card_level(card_id) == 1 for card_id in player["archive"])
    return False


def _build_card_view(state: Dict, viewer_id: str, player_id: str, card_id: str, source: Optional[str] = None) -> Dict:
    card = _card_def(card_id)
    viewer_player = state["players"].get(viewer_id) if viewer_id in state["players"] else None
    buildable = False
    if viewer_player and viewer_id == state.get("current_turn") and source in {"display", "archive", "research"}:
        free_level1 = bool(state.get("bonus_context") and state["bonus_context"].get("kind") == "build_free_level1")
        plan = _best_build_plan(state, viewer_player, card_id, source, free_level1=free_level1)
        buildable = plan is not None and (not free_level1 or int(card["level"]) == 1)
    return {
        "id": card["id"],
        "level": int(card["level"]),
        "panel": card["panel"],
        "panel_icon": GIZMO_PANEL_EMOJI.get(card["panel"], "•"),
        "energy_type": card["energy_type"],
        "energy_icon": ENERGY_EMOJI.get(card["energy_type"], "🌈"),
        "cost": int(card["cost"]),
        "vp": int(card["vp"]),
        "title": card["title"],
        "text": card["text"],
        "buildable": buildable,
        "source": source,
        "trigger": card.get("trigger"),
        "effect": card.get("effect"),
    }


def _public_player_view(state: Dict, viewer_id: str, player_id: str) -> Dict:
    player = state["players"][player_id]
    meta = state["player_meta"][player_id]
    grouped_active = {"file": [], "pick": [], "build": [], "converter": [], "upgrade": [], "generic": []}
    for card_id in player.get("active", []):
        card_view = _build_card_view(state, viewer_id, player_id, card_id)
        grouped_active[card_view["panel"]].append(card_view)
    archive_view = [_build_card_view(state, viewer_id, player_id, card_id, source="archive" if player_id == viewer_id else None) for card_id in player.get("archive", [])]
    return {
        "player_id": player_id,
        "name": meta.get("name"),
        "seat": meta.get("seat"),
        "is_bot": meta.get("is_bot", False),
        "storage": list(player.get("storage", [])),
        "storage_limit": int(player.get("storage_limit", STARTING_STORAGE_LIMIT)),
        "file_limit": int(player.get("file_limit", STARTING_FILE_LIMIT)),
        "research_amount": int(player.get("research_amount", STARTING_RESEARCH_AMOUNT)),
        "archive": archive_view,
        "active": grouped_active,
        "vp_tokens_total": int(player.get("vp_tokens_total", 0)),
        "printed_vp": int(player.get("printed_vp", 0)),
        "score_now": _player_score_now(player),
        "projected_score": _player_total_score(player),
        "level3_count": int(player.get("level3_count", 0)),
        "can_file": bool(player.get("can_file", True)),
        "can_research": bool(player.get("can_research", True)),
    }


def _phase_legal_actions(state: Dict, player_id: str) -> List[str]:
    if state.get("game_over"):
        return []
    if player_id != state.get("current_turn"):
        return []
    player = state["players"][player_id]
    phase = state.get("phase")
    if phase == "action":
        actions: List[str] = []
        if len(player["storage"]) < int(player["storage_limit"]) and state["energy_row"]:
            actions.append("pick_energy")
        if player.get("can_file", True) and len(player["archive"]) < int(player["file_limit"]):
            if any(card_id for cards in state["display"].values() for card_id in cards if card_id):
                actions.append("file_display")
        if any(_best_build_plan(state, player, card_id, "display") for cards in state["display"].values() for card_id in cards if card_id):
            actions.append("build_display")
        if any(_best_build_plan(state, player, card_id, "archive") for card_id in player["archive"]):
            actions.append("build_archive")
        if player.get("can_research", True) and any(state["decks"][level] for level in state["decks"]):
            actions.append("research")
        if not actions:
            actions.append("pass_turn")
        return actions
    if phase == "choose_effect":
        if not state.get("pending_effects"):
            return []
        return ["resolve_effect", "pass_effects"]
    if phase == "bonus_action":
        context = state.get("bonus_context") or {}
        kind = context.get("kind")
        if kind == "pick":
            allowed = set(context.get("allowed_colors") or list(ENERGY_TYPES))
            if len(player["storage"]) >= int(player["storage_limit"]):
                return []
            if any(color in allowed for color in state["energy_row"]):
                return ["pick_energy"]
            return []
        if kind == "file":
            if player.get("can_file", True) and len(player["archive"]) < int(player["file_limit"]):
                if any(card_id for cards in state["display"].values() for card_id in cards if card_id):
                    return ["file_display"]
            return []
        if kind == "research":
            if player.get("can_research", True) and any(state["decks"][level] for level in state["decks"]):
                return ["research"]
            return []
        if kind == "build_free_level1":
            actions: List[str] = []
            if any(card_id and _card_level(card_id) == 1 for cards in state["display"].values() for card_id in cards):
                actions.append("build_display")
            if any(_card_level(card_id) == 1 for card_id in player["archive"]):
                actions.append("build_archive")
            return actions
        return []
    if phase == "research":
        return ["resolve_research"]
    return []


def _current_prompt(state: Dict, player_id: str) -> Dict:
    prompt: Dict[str, object] = {"phase": state.get("phase")}
    if player_id != state.get("current_turn"):
        return prompt
    if state.get("phase") == "choose_effect":
        prompt["pending_effects"] = [
            {
                "effect_id": item["effect_id"],
                "label": item["label"],
                "resolvable": _effect_is_resolvable(state, player_id, item),
                "kind": item["effect"].get("kind"),
            }
            for item in state.get("pending_effects", [])
        ]
    elif state.get("phase") == "bonus_action":
        context = state.get("bonus_context") or {}
        prompt["bonus_context"] = dict(context)
    elif state.get("phase") == "research":
        context = state.get("research_context") or {}
        prompt["research"] = {
            "level": context.get("level"),
            "cards": [_build_card_view(state, player_id, player_id, card_id, source="research") for card_id in context.get("drawn", [])],
        }
    return prompt


def _complete_action_resolution(state: Dict, player_id: str, action_meta: Dict, ignore_card_id: Optional[str] = None) -> None:
    _queue_triggers_for_action(state, player_id, action_meta, ignore_card_id=ignore_card_id)
    _advance_after_resolution(state)


def _handle_effect_resolution(state: Dict, player_id: str, effect_item: Dict) -> None:
    effect = effect_item["effect"]
    kind = effect.get("kind")
    if kind == "draw_random":
        _draw_random_energy(state, state["players"][player_id], int(effect.get("amount", 1)))
        _advance_after_resolution(state)
        return
    if kind == "gain_vp":
        state["players"][player_id]["vp_tokens_total"] += int(effect.get("amount", 1))
        _advance_after_resolution(state)
        return
    if kind == "pick_energy":
        state["bonus_context"] = {
            "kind": "pick",
            "allowed_colors": list(effect.get("colors") or list(ENERGY_TYPES)),
            "remaining": int(effect.get("amount", 1)),
        }
        state["phase"] = "bonus_action"
        return
    if kind == "perform_file":
        state["bonus_context"] = {"kind": "file"}
        state["phase"] = "bonus_action"
        return
    if kind == "perform_research":
        state["bonus_context"] = {"kind": "research"}
        state["phase"] = "bonus_action"
        return
    if kind == "free_build_level1":
        state["bonus_context"] = {"kind": "build_free_level1"}
        state["phase"] = "bonus_action"
        return
    _advance_after_resolution(state)


class GizmosGame:
    game_id = "gizmos"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) < GizmosGame.min_players or len(players) > GizmosGame.max_players:
            raise ValueError("invalid player count")

        cfg = _merge_config(config)
        seed = _seed_to_int(cfg.get("seed"))
        rng = random.Random(seed)

        ordered_players = sorted(players, key=lambda entry: int(entry.get("seat", 0)))
        player_ids = [entry["player_id"] for entry in ordered_players]

        level1 = [card["id"] for card in LEVEL_1_CARDS]
        level2 = [card["id"] for card in LEVEL_2_CARDS]
        level3_all = [card["id"] for card in LEVEL_3_CARDS]
        rng.shuffle(level1)
        rng.shuffle(level2)
        rng.shuffle(level3_all)
        level3 = level3_all[:MAX_LEVEL_3_IN_GAME]

        energy_bag = []
        for color in ENERGY_TYPES:
            energy_bag.extend([color] * ENERGY_PER_COLOR)
        rng.shuffle(energy_bag)

        state_players = {}
        player_meta = {}
        for entry in ordered_players:
            pid = entry["player_id"]
            player_meta[pid] = dict(entry)
            state_players[pid] = {
                "storage": [],
                "archive": [],
                "active": [STARTING_GIZMO["id"]],
                "storage_limit": STARTING_STORAGE_LIMIT,
                "file_limit": STARTING_FILE_LIMIT,
                "research_amount": STARTING_RESEARCH_AMOUNT,
                "can_file": True,
                "can_research": True,
                "discounts": {"level2": 0, "archive": 0, "research": 0},
                "extra_awards": [],
                "vp_tokens_total": 0,
                "printed_vp": 0,
                "level3_count": 0,
            }

        state = {
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "current_turn": player_ids[0] if player_ids else None,
            "phase": "action",
            "base_action_taken": False,
            "bonus_context": None,
            "research_context": None,
            "pending_effects": [],
            "used_gizmos_this_turn": [],
            "next_effect_id": 0,
            "decks": {
                "1": level1,
                "2": level2,
                "3": level3,
            },
            "display": {
                "1": [None] * DISPLAY_SLOTS[1],
                "2": [None] * DISPLAY_SLOTS[2],
                "3": [None] * DISPLAY_SLOTS[3],
            },
            "energy_bag": energy_bag,
            "energy_row": [],
            "final_round": {"active": False, "triggered_by": None},
            "winner": [],
            "game_over": False,
            "config": cfg,
            "rng_seed": seed,
            "rng_counter": 0,
        }

        for level, count in DISPLAY_SLOTS.items():
            for index in range(count):
                state["display"][str(level)][index] = _draw_display_card(state, level)
        _refill_energy_row(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return _phase_legal_actions(state, player_id)

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id != state.get("current_turn"):
            return [], "not your turn"
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []
        phase = state.get("phase")

        try:
            if phase == "action":
                if state.get("base_action_taken"):
                    return [], "action already taken"
                if action_type == "pick_energy":
                    color = action.get("color")
                    if color not in ENERGY_TYPES:
                        return [], "invalid color"
                    meta = _perform_pick_from_row(state, player_id, color)
                    state["base_action_taken"] = True
                    events.append({"type": "gizmos:pick_energy", "player_id": player_id, "color": color})
                    _complete_action_resolution(state, player_id, meta)
                    return events, None

                if action_type == "file_display":
                    card_id = action.get("card_id")
                    if not isinstance(card_id, str):
                        return [], "invalid card"
                    meta = _perform_file_from_display(state, player_id, card_id)
                    state["base_action_taken"] = True
                    events.append({"type": "gizmos:file_display", "player_id": player_id, "card_id": card_id})
                    _complete_action_resolution(state, player_id, meta)
                    return events, None

                if action_type == "build_display":
                    card_id = action.get("card_id")
                    if not isinstance(card_id, str):
                        return [], "invalid card"
                    meta = _perform_build_from_display(state, player_id, card_id)
                    state["base_action_taken"] = True
                    events.append({"type": "gizmos:build_display", "player_id": player_id, "card_id": card_id})
                    _complete_action_resolution(state, player_id, meta, ignore_card_id=card_id)
                    return events, None

                if action_type == "build_archive":
                    card_id = action.get("card_id")
                    if not isinstance(card_id, str):
                        return [], "invalid card"
                    meta = _perform_build_from_archive(state, player_id, card_id)
                    state["base_action_taken"] = True
                    events.append({"type": "gizmos:build_archive", "player_id": player_id, "card_id": card_id})
                    _complete_action_resolution(state, player_id, meta, ignore_card_id=card_id)
                    return events, None

                if action_type == "research":
                    level = action.get("level")
                    if level not in {1, 2, 3}:
                        return [], "invalid level"
                    _start_research(state, player_id, int(level))
                    state["base_action_taken"] = True
                    events.append({"type": "gizmos:research", "player_id": player_id, "level": level})
                    return events, None

                if action_type == "pass_turn":
                    if GizmosGame._has_any_base_action(state, player_id):
                        return [], "base action available"
                    state["base_action_taken"] = True
                    _advance_after_resolution(state)
                    events.append({"type": "gizmos:pass_turn", "player_id": player_id})
                    return events, None
                return [], "unknown action"

            if phase == "choose_effect":
                if action_type == "pass_effects":
                    state["pending_effects"] = []
                    _advance_after_resolution(state)
                    events.append({"type": "gizmos:pass_effects", "player_id": player_id})
                    return events, None
                if action_type != "resolve_effect":
                    return [], "must resolve effect"
                effect_id = action.get("effect_id")
                if not isinstance(effect_id, int):
                    return [], "invalid effect"
                effect_item = next((item for item in state["pending_effects"] if item["effect_id"] == effect_id), None)
                if not effect_item:
                    return [], "effect not found"
                if not _effect_is_resolvable(state, player_id, effect_item):
                    return [], "effect not resolvable"
                state["pending_effects"] = [item for item in state["pending_effects"] if item["effect_id"] != effect_id]
                source_card_id = effect_item["source_card_id"]
                if source_card_id not in state["used_gizmos_this_turn"]:
                    state["used_gizmos_this_turn"].append(source_card_id)
                events.append({"type": "gizmos:resolve_effect", "player_id": player_id, "card_id": source_card_id})
                _handle_effect_resolution(state, player_id, effect_item)
                return events, None

            if phase == "bonus_action":
                context = state.get("bonus_context") or {}
                kind = context.get("kind")
                if kind == "pick":
                    if action_type != "pick_energy":
                        return [], "must pick energy"
                    color = action.get("color")
                    allowed = set(context.get("allowed_colors") or list(ENERGY_TYPES))
                    if color not in allowed:
                        return [], "color not allowed"
                    meta = _perform_pick_from_row(state, player_id, color)
                    events.append({"type": "gizmos:bonus_pick", "player_id": player_id, "color": color})
                    _queue_triggers_for_action(state, player_id, meta)
                    remaining = int(context.get("remaining", 1)) - 1
                    if remaining > 0:
                        state["bonus_context"]["remaining"] = remaining
                        state["phase"] = "bonus_action"
                    else:
                        state["bonus_context"] = None
                        _advance_after_resolution(state)
                    return events, None

                if kind == "file":
                    if action_type != "file_display":
                        return [], "must file a display card"
                    card_id = action.get("card_id")
                    if not isinstance(card_id, str):
                        return [], "invalid card"
                    meta = _perform_file_from_display(state, player_id, card_id)
                    state["bonus_context"] = None
                    events.append({"type": "gizmos:bonus_file", "player_id": player_id, "card_id": card_id})
                    _complete_action_resolution(state, player_id, meta)
                    return events, None

                if kind == "research":
                    if action_type != "research":
                        return [], "must research"
                    level = action.get("level")
                    if level not in {1, 2, 3}:
                        return [], "invalid level"
                    _start_research(state, player_id, int(level))
                    events.append({"type": "gizmos:bonus_research", "player_id": player_id, "level": level})
                    return events, None

                if kind == "build_free_level1":
                    card_id = action.get("card_id")
                    if not isinstance(card_id, str):
                        return [], "invalid card"
                    if action_type == "build_display":
                        meta = _perform_build_from_display(state, player_id, card_id, free_level1=True)
                        events.append({"type": "gizmos:bonus_build_display", "player_id": player_id, "card_id": card_id})
                    elif action_type == "build_archive":
                        meta = _perform_build_from_archive(state, player_id, card_id, free_level1=True)
                        events.append({"type": "gizmos:bonus_build_archive", "player_id": player_id, "card_id": card_id})
                    else:
                        return [], "must build a level 1 gizmo"
                    state["bonus_context"] = None
                    _complete_action_resolution(state, player_id, meta, ignore_card_id=card_id)
                    return events, None
                return [], "invalid bonus context"

            if phase == "research":
                if action_type != "resolve_research":
                    return [], "must resolve research"
                meta, error = _resolve_research_choice(state, player_id, action)
                if error:
                    return [], error
                bonus_context = state.get("bonus_context") or {}
                if bonus_context.get("kind") == "research":
                    state["bonus_context"] = None
                if meta:
                    event_type = "gizmos:research_build" if meta["kind"] == "build" else "gizmos:research_file"
                    events.append({"type": event_type, "player_id": player_id, "card_id": meta["card_id"]})
                    _complete_action_resolution(state, player_id, meta, ignore_card_id=meta["card_id"] if meta["kind"] == "build" else None)
                else:
                    events.append({"type": "gizmos:research_none", "player_id": player_id})
                    _advance_after_resolution(state)
                return events, None

            return [], "invalid phase"
        except ValueError as exc:
            return [], str(exc)

    @staticmethod
    def _has_any_base_action(state: Dict, player_id: str) -> bool:
        player = state["players"][player_id]
        if len(player["storage"]) < int(player["storage_limit"]) and state["energy_row"]:
            return True
        if player.get("can_file", True) and len(player["archive"]) < int(player["file_limit"]):
            if any(card_id for cards in state["display"].values() for card_id in cards if card_id):
                return True
        if any(_best_build_plan(state, player, card_id, "display") for cards in state["display"].values() for card_id in cards if card_id):
            return True
        if any(_best_build_plan(state, player, card_id, "archive") for card_id in player["archive"]):
            return True
        if player.get("can_research", True) and any(state["decks"][level] for level in state["decks"]):
            return True
        return False

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players_view = [_public_player_view(state, viewer_id, pid) for pid in state["turn_order"]]

        display_view = {}
        for level_key, cards in state["display"].items():
            display_view[level_key] = [
                _build_card_view(state, viewer_id, viewer_id, card_id, source="display") if card_id else None for card_id in cards
            ]

        return {
            "you": viewer_id,
            "phase": state["phase"],
            "current_turn": state["current_turn"],
            "players": players_view,
            "display": display_view,
            "energy_row": list(state["energy_row"]),
            "energy_bag_count": len(state["energy_bag"]),
            "final_round": dict(state["final_round"]),
            "winner": list(state.get("winner", [])),
            "game_over": bool(state.get("game_over", False)),
            "legal_actions": GizmosGame.get_legal_actions(state, viewer_id),
            "prompt": _current_prompt(state, viewer_id),
            "config": {"seed": state["config"].get("seed")},
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") or bot_id != state.get("current_turn"):
            return None
        player = state["players"][bot_id]
        phase = state.get("phase")

        if phase == "choose_effect":
            for item in state.get("pending_effects", []):
                if _effect_is_resolvable(state, bot_id, item):
                    return {"type": "resolve_effect", "effect_id": item["effect_id"]}
            return {"type": "pass_effects"}

        if phase == "bonus_action":
            context = state.get("bonus_context") or {}
            kind = context.get("kind")
            if kind == "pick":
                allowed = set(context.get("allowed_colors") or list(ENERGY_TYPES))
                for color in state["energy_row"]:
                    if color in allowed:
                        return {"type": "pick_energy", "color": color}
                return None
            if kind == "file":
                for cards in state["display"].values():
                    for card_id in cards:
                        if card_id:
                            return {"type": "file_display", "card_id": card_id}
                return None
            if kind == "research":
                for level in (3, 2, 1):
                    if state["decks"][str(level)]:
                        return {"type": "research", "level": level}
                return None
            if kind == "build_free_level1":
                for cards in state["display"].values():
                    for card_id in cards:
                        if card_id and _card_level(card_id) == 1:
                            return {"type": "build_display", "card_id": card_id}
                for card_id in player["archive"]:
                    if _card_level(card_id) == 1:
                        return {"type": "build_archive", "card_id": card_id}
                return None
            return None

        if phase == "research":
            context = state.get("research_context") or {}
            drawn = list(context.get("drawn", []))
            buildable = [card_id for card_id in drawn if _best_build_plan(state, player, card_id, "research")]
            if buildable:
                best = max(buildable, key=lambda cid: (_card_def(cid)["vp"], _card_level(cid)))
                remaining = [card_id for card_id in drawn if card_id != best]
                return {"type": "resolve_research", "choice": "build", "card_id": best, "return_order": remaining}
            if player.get("can_file", True) and len(player["archive"]) < int(player["file_limit"]) and drawn:
                remaining = [card_id for card_id in drawn[1:]]
                return {"type": "resolve_research", "choice": "file", "card_id": drawn[0], "return_order": remaining}
            return {"type": "resolve_research", "choice": "none", "return_order": drawn}

        if phase != "action":
            return None

        affordable_display = []
        for cards in state["display"].values():
            for card_id in cards:
                if card_id and _best_build_plan(state, player, card_id, "display"):
                    affordable_display.append(card_id)
        affordable_archive = [card_id for card_id in player["archive"] if _best_build_plan(state, player, card_id, "archive")]

        if affordable_display:
            best = max(affordable_display, key=lambda cid: (_card_def(cid)["vp"], _card_level(cid)))
            return {"type": "build_display", "card_id": best}
        if affordable_archive:
            best = max(affordable_archive, key=lambda cid: (_card_def(cid)["vp"], _card_level(cid)))
            return {"type": "build_archive", "card_id": best}

        if player.get("can_file", True) and len(player["archive"]) < int(player["file_limit"]):
            for level in ("3", "2", "1"):
                for card_id in state["display"][level]:
                    if card_id:
                        return {"type": "file_display", "card_id": card_id}

        if player.get("can_research", True):
            for level in (3, 2, 1):
                if state["decks"][str(level)]:
                    return {"type": "research", "level": level}

        if len(player["storage"]) < int(player["storage_limit"]):
            for color in state["energy_row"]:
                return {"type": "pick_energy", "color": color}

        return {"type": "pass_turn"}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
