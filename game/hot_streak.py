import copy
import hashlib
import json
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple


_CATALOG_PATH = Path(__file__).resolve().parent / "assets" / "hot_streak_data.json"
with _CATALOG_PATH.open("r", encoding="utf-8") as _catalog_file:
    CATALOG = json.load(_catalog_file)


RACERS = {item["id"]: item for item in CATALOG["racers"]}
RACER_IDS = [item["id"] for item in CATALOG["racers"]]
TRACK = CATALOG["track"]
SIDE_BETS = {item["id"]: item for item in CATALOG["side_bets"]}


def _validate_catalog() -> None:
    catalog_status = CATALOG.get("catalog_status")
    if catalog_status == "prototype":
        if not CATALOG.get("unverified"):
            raise ValueError("Hot Streak prototype catalog must list unverified data")
    elif not CATALOG.get("verified_against") or CATALOG.get("unverified"):
        raise ValueError("Hot Streak production catalog requires verification metadata")
    if not isinstance(CATALOG.get("catalog_version"), str) or not CATALOG["catalog_version"]:
        raise ValueError("Hot Streak catalog requires a version")
    if len(RACER_IDS) != 4 or len(set(RACER_IDS)) != 4:
        raise ValueError("Hot Streak catalog requires four unique racers")
    for racer in CATALOG["racers"]:
        if not all(racer.get(field) for field in ("name", "icon", "color", "pattern")):
            raise ValueError(f"Hot Streak racer presentation is incomplete: {racer.get('id')}")
        if racer.get("swerve") not in {"left", "right"}:
            raise ValueError(f"Hot Streak racer swerve is invalid: {racer.get('id')}")
    if int(TRACK.get("lane_count", 0)) != 4:
        raise ValueError("Hot Streak catalog requires four lanes")
    start = int(TRACK.get("start_position", -1))
    finish = int(TRACK.get("finish_position", -1))
    final_stretch = int(TRACK.get("final_stretch_start", -1))
    if start < 0 or finish <= start or not start < final_stretch < finish:
        raise ValueError("Hot Streak track coordinates are invalid")
    fold_cutoffs = list(TRACK.get("fold_cutoffs") or [])
    if fold_cutoffs != sorted(set(fold_cutoffs)) or any(value <= 0 or value >= finish for value in fold_cutoffs):
        raise ValueError("Hot Streak fold cutoffs are invalid")
    stars = TRACK.get("star_positions_by_lane") or {}
    for lane in range(4):
        lane_stars = list(stars.get(str(lane)) or [])
        if (
            not lane_stars
            or lane_stars != sorted(set(lane_stars))
            or any(not isinstance(value, int) or value < 0 or value >= finish for value in lane_stars)
        ):
            raise ValueError("Hot Streak star coordinates are invalid")

    template_ids = set()
    total_cards = 0
    starting_cards = 0
    starting_targets = set()
    target_counts = {racer_id: 0 for racer_id in RACER_IDS}
    all_count = 0
    single_effects = {"recover", "turn", "fall", "move", "star", "swerve"}
    all_effects = {"recover", "turn", "fall", "move"}
    for template in CATALOG.get("card_templates", []):
        template_id = template.get("id")
        copies = int(template.get("copies", 0))
        target = template.get("target")
        if not template_id or template_id in template_ids or copies < 1:
            raise ValueError("Hot Streak card template is invalid")
        if target not in set(RACER_IDS) | {"all"}:
            raise ValueError(f"Hot Streak card target is invalid: {target}")
        if not template.get("effects"):
            raise ValueError(f"Hot Streak card has no effects: {template_id}")
        allowed_effects = all_effects if target == "all" else single_effects
        for effect in template["effects"]:
            effect_type = effect.get("type")
            if effect_type not in allowed_effects:
                raise ValueError(f"Hot Streak card effect is unsupported: {template_id}/{effect_type}")
            if effect_type == "move" and not isinstance(effect.get("distance"), int):
                raise ValueError(f"Hot Streak move distance is invalid: {template_id}")
        template_ids.add(template_id)
        total_cards += copies
        if template.get("starting"):
            starting_cards += copies
            if target == "all" or copies != 1:
                raise ValueError(f"Hot Streak starting card is invalid: {template_id}")
            starting_targets.add(target)
        if target == "all":
            all_count += copies
        else:
            target_counts[target] += copies
    if total_cards != 53 or starting_cards != 4 or starting_targets != set(RACER_IDS) or all_count != 9:
        raise ValueError("Hot Streak catalog must contain 53 cards, four starters, and nine all-racer cards")
    if any(count != 11 for count in target_counts.values()):
        raise ValueError("Hot Streak catalog requires eleven cards per racer")

    ticket_stacks = CATALOG.get("ticket_stacks") or {}
    for stack_id in RACER_IDS + ["yes", "no"]:
        tiers = ticket_stacks.get(stack_id)
        if not isinstance(tiers, list) or len(tiers) != 3:
            raise ValueError(f"Hot Streak ticket stack is incomplete: {stack_id}")
        if [tier.get("tier") for tier in tiers] != [1, 2, 3]:
            raise ValueError(f"Hot Streak ticket tiers are invalid: {stack_id}")
        for tier in tiers:
            for mode in ("safe", "risky"):
                payout = tier.get(mode)
                if not isinstance(payout, dict) or not payout:
                    raise ValueError(f"Hot Streak ticket payout is incomplete: {stack_id}/{mode}")
                expected_keys = {"correct", "incorrect"} if stack_id in {"yes", "no"} else {"1", "2", "3", "4"}
                if set(payout) != expected_keys:
                    raise ValueError(f"Hot Streak ticket payout keys are invalid: {stack_id}/{mode}")
                if not all(isinstance(value, int) for value in payout.values()):
                    raise ValueError(f"Hot Streak ticket payout must be integral: {stack_id}/{mode}")
    side_bet_items = CATALOG.get("side_bets") or []
    supported_predicates = {
        "racer_bottom_two",
        "two_fallen",
        "two_at_finish",
        "any_dq",
        "fallen_final_stretch",
        "empty_stretch_first",
        "any_out_of_bounds",
        "shared_space",
        "any_knockout",
    }
    if len(side_bet_items) != 12 or len(SIDE_BETS) != 12:
        raise ValueError("Hot Streak catalog requires twelve side bets")
    for side_bet in side_bet_items:
        if not side_bet.get("label") or side_bet.get("predicate") not in supported_predicates:
            raise ValueError(f"Hot Streak side bet is invalid: {side_bet.get('id')}")
        if side_bet.get("predicate") == "racer_bottom_two" and side_bet.get("racer_id") not in RACER_IDS:
            raise ValueError(f"Hot Streak side bet racer is invalid: {side_bet.get('id')}")


_validate_catalog()


CARD_TEMPLATES = {template["id"]: template for template in CATALOG["card_templates"]}
CARD_INSTANCES: Dict[str, Dict] = {}
for _template in CATALOG["card_templates"]:
    for _copy_index in range(int(_template["copies"])):
        _instance_id = f"{_template['id']}:{_copy_index + 1}"
        CARD_INSTANCES[_instance_id] = {
            "instance_id": _instance_id,
            "template_id": _template["id"],
        }


def _next_rng(state: Dict, label: str) -> random.Random:
    counter = int(state.get("rng_counter", 0))
    material = f"{state.get('rng_seed')}:{counter}:{label}".encode("utf-8")
    digest = hashlib.sha256(material).digest()
    state["rng_counter"] = counter + 1
    return random.Random(int.from_bytes(digest[:16], "big"))


def _shuffle(state: Dict, values: List, label: str) -> List:
    result = list(values)
    _next_rng(state, label).shuffle(result)
    return result


def _card_template(card_id: str) -> Dict:
    instance = CARD_INSTANCES[card_id]
    return CARD_TEMPLATES[instance["template_id"]]


def _card_view(card_id: Optional[str]) -> Optional[Dict]:
    if not card_id or card_id not in CARD_INSTANCES:
        return None
    template = _card_template(card_id)
    target = template["target"]
    return {
        "instance_id": card_id,
        "template_id": template["id"],
        "target": target,
        "target_name": "Everyone" if target == "all" else RACERS[target]["name"],
        "target_icon": "🏁" if target == "all" else RACERS[target]["icon"],
        "label": template["label"],
        "effects": copy.deepcopy(template["effects"]),
        "starting": bool(template.get("starting")),
    }


def _ticket_stack_state() -> Dict[str, List[Dict]]:
    return copy.deepcopy(CATALOG["ticket_stacks"])


def _rotated_order(order: List[str], starting_index: int) -> List[str]:
    if not order:
        return []
    index = starting_index % len(order)
    return order[index:] + order[:index]


def _build_draft_sequence(order: List[str], starting_index: int, picks: int) -> List[str]:
    forward = _rotated_order(order, starting_index)
    sequence: List[str] = []
    for pass_index in range(picks):
        sequence.extend(forward if pass_index % 2 == 0 else list(reversed(forward)))
    return sequence


def _fresh_racers() -> Dict[str, Dict]:
    racers: Dict[str, Dict] = {}
    for lane, racer_id in enumerate(RACER_IDS):
        racers[racer_id] = {
            "racer_id": racer_id,
            "lane": lane,
            "position": int(TRACK["start_position"]),
            "facing": "forward",
            "fallen": False,
            "status": "active",
            "rank_start": None,
            "rank_end": None,
            "payout_rank": None,
            "dq_reason": None,
        }
    return racers


def _reset_race_board(state: Dict) -> None:
    state["racers"] = _fresh_racers()
    state["draw_pile"] = []
    state["burned_card_ids"] = []
    state["revealed_card_ids"] = []
    state["current_card_id"] = None
    state["race_cycle"] = 1
    state["fold_stage"] = 0
    state["track_back_edge"] = 0
    state["step_index"] = 0
    state["countdown"] = 3
    state["podium_groups"] = []
    state["race_log"] = []
    state["dq_history"] = []
    state["finish_history"] = []
    state["side_bet_tracker"] = {
        "latched": False,
        "result": None,
        "resolved": False,
        "evidence": None,
    }


def _prepare_betting(state: Dict) -> None:
    order = state["turn_order"]
    picks = 3 if len(order) == 2 else 2
    state["phase"] = "betting"
    state["ticket_stacks"] = _ticket_stack_state()
    state["draft_sequence"] = _build_draft_sequence(order, state["starting_player_index"], picks)
    state["draft_cursor"] = 0
    state["draft_counts"] = {player_id: 0 for player_id in order}
    state["submitted_cards_by_player"] = {}
    state["race_card_ids"] = []
    state["next_round_ready"] = []
    for player_id in order:
        state["players"][player_id]["bets"] = []
        state["players"][player_id]["submitted"] = False
        state["players"][player_id]["ready"] = False
    _reset_race_board(state)


def _draw_initial_cards(state: Dict) -> None:
    player_count = len(state["turn_order"])
    base_random_count = {2: 10, 3: 11, 4: 10, 5: 9, 6: 8, 7: 7, 8: 6}[player_count]
    hand_size = 4 if player_count == 2 else 3
    starter_ids = [card_id for card_id in CARD_INSTANCES if _card_template(card_id).get("starting")]
    nonstarter_ids = [card_id for card_id in CARD_INSTANCES if not _card_template(card_id).get("starting")]
    nonstarter_ids = _shuffle(state, nonstarter_ids, "initial-nonstarters")
    base = starter_ids + nonstarter_ids[:base_random_count]
    remaining = _shuffle(state, nonstarter_ids[base_random_count:], "initial-hands")
    for _ in range(hand_size):
        for player_id in state["turn_order"]:
            state["players"][player_id]["hand"].append(remaining.pop(0))
    state["base_race_card_ids"] = _shuffle(state, base, "initial-base")
    state["unused_card_ids"] = remaining


def _current_side_bet(state: Dict) -> Dict:
    return SIDE_BETS[state["current_side_bet_id"]]


def _current_drafter(state: Dict) -> Optional[str]:
    cursor = int(state.get("draft_cursor", 0))
    sequence = state.get("draft_sequence") or []
    if 0 <= cursor < len(sequence):
        return sequence[cursor]
    return None


def _start_race(state: Dict) -> None:
    cards = list(state.get("base_race_card_ids", []))
    for player_id in state["turn_order"]:
        cards.extend(state["submitted_cards_by_player"].get(player_id, []))
    if len(cards) != 18 or len(set(cards)) != 18:
        raise ValueError("Hot Streak race deck must contain eighteen unique cards")
    state["race_card_ids"] = cards
    shuffled = _shuffle(state, cards, f"race-{state['race_number']}-cycle-1")
    state["burned_card_ids"] = shuffled[:3]
    state["draw_pile"] = shuffled[3:]
    state["phase"] = "race_countdown"
    state["countdown"] = 3
    state["step_index"] = 0
    state["race_log"].append({"type": "race_ready", "race": state["race_number"]})


def _used_ranks(state: Dict) -> set:
    used = set()
    for racer in state["racers"].values():
        if racer.get("rank_start") is None:
            continue
        used.update(range(int(racer["rank_start"]), int(racer["rank_end"]) + 1))
    return used


def _latch_side_bet(state: Dict, predicate: str, evidence: Dict) -> None:
    side_bet = _current_side_bet(state)
    tracker = state["side_bet_tracker"]
    if side_bet.get("predicate") != predicate or tracker.get("latched"):
        return
    tracker.update(
        {
            "latched": True,
            "result": True,
            "resolved": True,
            "evidence": copy.deepcopy(evidence),
        }
    )
    state["race_log"].append(
        {"type": "side_bet_hit", "side_bet_id": side_bet["id"], "evidence": copy.deepcopy(evidence)}
    )


def _assign_finish(state: Dict, racer_id: str) -> None:
    racer = state["racers"][racer_id]
    if racer["status"] != "active":
        return
    free = sorted(set(range(1, 5)) - _used_ranks(state))
    if not free:
        return
    rank = free[0]
    racer.update(
        {
            "status": "finished",
            "rank_start": rank,
            "rank_end": rank,
            "payout_rank": rank,
            "fallen": False,
        }
    )
    state["podium_groups"].append(
        {"racer_ids": [racer_id], "rank_start": rank, "rank_end": rank, "kind": "finish"}
    )
    entry = {"racer_id": racer_id, "rank": rank, "step_index": state["step_index"]}
    state["finish_history"].append(entry)
    state["race_log"].append({"type": "finish", **entry})
    if rank == 1:
        others_in_stretch = [
            item["racer_id"]
            for item in state["racers"].values()
            if item["racer_id"] != racer_id
            and item["status"] == "active"
            and int(item["position"]) >= int(TRACK["final_stretch_start"])
        ]
        if not others_in_stretch:
            _latch_side_bet(state, "empty_stretch_first", {"winner": racer_id})


def _assign_dq_group(state: Dict, racer_ids: List[str], reason: str) -> None:
    unique_ids = []
    for racer_id in racer_ids:
        if racer_id in state["racers"] and state["racers"][racer_id]["status"] == "active" and racer_id not in unique_ids:
            unique_ids.append(racer_id)
    if not unique_ids:
        return
    free = sorted(set(range(1, 5)) - _used_ranks(state))
    occupied = sorted(free[-len(unique_ids) :])
    if not occupied:
        return
    rank_start = occupied[0]
    rank_end = occupied[-1]
    for racer_id in unique_ids:
        state["racers"][racer_id].update(
            {
                "status": "dq",
                "rank_start": rank_start,
                "rank_end": rank_end,
                "payout_rank": rank_end,
                "dq_reason": reason,
            }
        )
        entry = {
            "racer_id": racer_id,
            "reason": reason,
            "rank_start": rank_start,
            "rank_end": rank_end,
            "step_index": state["step_index"],
        }
        state["dq_history"].append(entry)
        state["race_log"].append({"type": "dq", **entry})
    state["podium_groups"].append(
        {
            "racer_ids": unique_ids,
            "rank_start": rank_start,
            "rank_end": rank_end,
            "kind": "dq",
            "reason": reason,
        }
    )
    _latch_side_bet(state, "any_dq", {"racer_ids": unique_ids, "reason": reason})
    if reason in {"side_out", "back_out", "folded_out"}:
        _latch_side_bet(state, "any_out_of_bounds", {"racer_ids": unique_ids, "reason": reason})
    if reason == "knockout":
        _latch_side_bet(state, "any_knockout", {"racer_ids": unique_ids})


def _resolve_collisions(state: Dict, mover_id: str) -> None:
    mover = state["racers"][mover_id]
    if mover["status"] != "active":
        return
    targets = [
        racer
        for racer_id, racer in state["racers"].items()
        if racer_id != mover_id
        and racer["status"] == "active"
        and racer["lane"] == mover["lane"]
        and racer["position"] == mover["position"]
    ]
    if not targets:
        return
    knockout_ids = [racer["racer_id"] for racer in targets if racer["fallen"]]
    for racer in targets:
        if not racer["fallen"]:
            racer["fallen"] = True
            state["race_log"].append(
                {"type": "knockdown", "mover_id": mover_id, "racer_id": racer["racer_id"]}
            )
    if knockout_ids:
        _assign_dq_group(state, knockout_ids, "knockout")


def _move_racer(
    state: Dict,
    racer_id: str,
    signed_distance: int,
    *,
    allow_finish: bool = True,
    collisions: bool = True,
) -> None:
    racer = state["racers"][racer_id]
    if racer["status"] != "active" or signed_distance == 0:
        return
    facing_sign = 1 if racer["facing"] == "forward" else -1
    intended_delta = (1 if signed_distance > 0 else -1) * facing_sign
    step_count = abs(int(signed_distance))
    was_fallen = bool(racer["fallen"])
    if was_fallen:
        step_count = 1
    for _ in range(step_count):
        old_position = int(racer["position"])
        next_position = old_position + intended_delta
        if intended_delta > 0 and next_position >= int(TRACK["finish_position"]):
            if allow_finish:
                _assign_finish(state, racer_id)
                return
            next_position = int(TRACK["finish_position"]) - 1
        if next_position < int(state.get("track_back_edge", 0)):
            _assign_dq_group(state, [racer_id], "back_out")
            return
        racer["position"] = next_position
        state["race_log"].append(
            {
                "type": "move",
                "racer_id": racer_id,
                "from": old_position,
                "to": next_position,
                "lane": racer["lane"],
            }
        )
        if was_fallen and (
            old_position >= int(TRACK["final_stretch_start"])
            or next_position >= int(TRACK["final_stretch_start"])
        ):
            _latch_side_bet(
                state,
                "fallen_final_stretch",
                {"racer_id": racer_id, "from": old_position, "to": next_position},
            )
        if collisions:
            _resolve_collisions(state, racer_id)
        if racer["status"] != "active":
            return


def _move_to_star(state: Dict, racer_id: str) -> None:
    racer = state["racers"][racer_id]
    if racer["status"] != "active":
        return
    direction = 1 if racer["facing"] == "forward" else -1
    if racer["fallen"]:
        _move_racer(state, racer_id, 1)
        return
    stars = sorted(TRACK["star_positions_by_lane"][str(racer["lane"])])
    position = int(racer["position"])
    candidates = [value for value in stars if value > position] if direction > 0 else [value for value in stars if value < position]
    if not candidates:
        state["race_log"].append({"type": "no_star", "racer_id": racer_id})
        return
    target = min(candidates) if direction > 0 else max(candidates)
    distance = abs(target - position)
    _move_racer(state, racer_id, distance)


def _swerve_racer(state: Dict, racer_id: str) -> None:
    racer = state["racers"][racer_id]
    if racer["status"] != "active":
        return
    relative = RACERS[racer_id]["swerve"]
    lane_delta = -1 if relative == "left" else 1
    if racer["facing"] == "backward":
        lane_delta *= -1
    old_lane = int(racer["lane"])
    next_lane = old_lane + lane_delta
    if next_lane < 0 or next_lane >= int(TRACK["lane_count"]):
        _assign_dq_group(state, [racer_id], "side_out")
        return
    racer["lane"] = next_lane
    state["race_log"].append(
        {"type": "swerve", "racer_id": racer_id, "from_lane": old_lane, "to_lane": next_lane}
    )
    _resolve_collisions(state, racer_id)


def _resolve_single_card(state: Dict, racer_id: str, effects: List[Dict]) -> None:
    racer = state["racers"][racer_id]
    if racer["status"] != "active":
        state["race_log"].append({"type": "no_effect", "racer_id": racer_id})
        return
    for effect in effects:
        if racer["status"] != "active":
            break
        effect_type = effect.get("type")
        if effect_type == "recover":
            racer["fallen"] = False
            racer["facing"] = "forward"
            state["race_log"].append({"type": "recover", "racer_id": racer_id})
        elif effect_type == "turn":
            racer["facing"] = "backward" if racer["facing"] == "forward" else "forward"
            state["race_log"].append(
                {"type": "turn", "racer_id": racer_id, "facing": racer["facing"]}
            )
        elif effect_type == "fall":
            if racer["fallen"]:
                _assign_dq_group(state, [racer_id], "knockout")
            else:
                racer["fallen"] = True
                state["race_log"].append({"type": "fall", "racer_id": racer_id})
        elif effect_type == "move":
            _move_racer(state, racer_id, int(effect.get("distance", 0)))
        elif effect_type == "star":
            _move_to_star(state, racer_id)
        elif effect_type == "swerve":
            _swerve_racer(state, racer_id)


def _resolve_all_card(state: Dict, effects: List[Dict]) -> None:
    snapshot = copy.deepcopy(state["racers"])
    results: Dict[str, Dict] = {}
    dq_ids: List[str] = []
    for racer_id in RACER_IDS:
        original = snapshot[racer_id]
        if original["status"] != "active":
            continue
        result = copy.deepcopy(original)
        crawled = False
        for effect in effects:
            effect_type = effect.get("type")
            if effect_type == "recover":
                result["fallen"] = False
                result["facing"] = "forward"
            elif effect_type == "turn":
                result["facing"] = "backward" if result["facing"] == "forward" else "forward"
            elif effect_type == "fall":
                if result["fallen"]:
                    result["status"] = "dq"
                    result["dq_reason"] = "knockout"
                else:
                    result["fallen"] = True
            elif effect_type == "move" and result["status"] == "active":
                distance = int(effect.get("distance", 0))
                if distance:
                    direction = (1 if distance > 0 else -1) * (1 if result["facing"] == "forward" else -1)
                    steps = 1 if result["fallen"] else abs(distance)
                    crawled = bool(result["fallen"])
                    destination = int(result["position"]) + direction * steps
                    if destination < int(state.get("track_back_edge", 0)):
                        result["status"] = "dq"
                        result["dq_reason"] = "back_out"
                    else:
                        result["position"] = min(destination, int(TRACK["finish_position"]) - 1)
        results[racer_id] = result
        if result["status"] == "dq":
            dq_ids.append(racer_id)
        elif crawled and (
            int(original["position"]) >= int(TRACK["final_stretch_start"])
            or int(result["position"]) >= int(TRACK["final_stretch_start"])
        ):
            _latch_side_bet(
                state,
                "fallen_final_stretch",
                {"racer_id": racer_id, "from": original["position"], "to": result["position"]},
            )
    for racer_id, result in results.items():
        if result["status"] == "active":
            state["racers"][racer_id].update(
                {
                    "position": result["position"],
                    "facing": result["facing"],
                    "fallen": result["fallen"],
                }
            )
            state["race_log"].append(
                {
                    "type": "all_move",
                    "racer_id": racer_id,
                    "from": snapshot[racer_id]["position"],
                    "to": result["position"],
                }
            )
    if dq_ids:
        reasons = {results[racer_id].get("dq_reason") for racer_id in dq_ids}
        reason = reasons.pop() if len(reasons) == 1 else "back_out"
        _assign_dq_group(state, dq_ids, reason)


def _evaluate_latched_side_bet(state: Dict) -> None:
    predicate = _current_side_bet(state).get("predicate")
    if state["side_bet_tracker"].get("latched"):
        return
    active = [racer for racer in state["racers"].values() if racer["status"] == "active"]
    if predicate == "two_fallen":
        fallen = [racer["racer_id"] for racer in active if racer["fallen"]]
        if len(fallen) >= 2:
            _latch_side_bet(state, predicate, {"racer_ids": fallen})
    elif predicate == "two_at_finish":
        at_finish = [
            racer["racer_id"]
            for racer in active
            if int(racer["position"]) == int(TRACK["finish_position"]) - 1
        ]
        if len(at_finish) >= 2:
            _latch_side_bet(state, predicate, {"racer_ids": at_finish})
    elif predicate == "shared_space":
        positions: Dict[Tuple[int, int], List[str]] = {}
        for racer in active:
            key = (int(racer["lane"]), int(racer["position"]))
            positions.setdefault(key, []).append(racer["racer_id"])
        matches = [(key, ids) for key, ids in positions.items() if len(ids) >= 2]
        if matches:
            (lane, position), racer_ids = matches[0]
            _latch_side_bet(
                state,
                predicate,
                {"racer_ids": racer_ids, "lane": lane, "position": position},
            )


def _resolve_card(state: Dict, card_id: str) -> None:
    template = _card_template(card_id)
    state["race_log"].append(
        {"type": "card", "card": _card_view(card_id), "step_index": state["step_index"]}
    )
    if template["target"] == "all":
        _resolve_all_card(state, template["effects"])
    else:
        _resolve_single_card(state, template["target"], template["effects"])
    _evaluate_latched_side_bet(state)


def _resolved_count(state: Dict) -> int:
    return sum(1 for racer in state["racers"].values() if racer["status"] != "active")


def _evaluate_final_side_bet(state: Dict) -> None:
    side_bet = _current_side_bet(state)
    tracker = state["side_bet_tracker"]
    if side_bet.get("predicate") == "racer_bottom_two":
        racer = state["racers"][side_bet["racer_id"]]
        result = int(racer.get("payout_rank") or 4) >= 3
        tracker.update(
            {
                "latched": result,
                "result": result,
                "resolved": True,
                "evidence": {
                    "racer_id": side_bet["racer_id"],
                    "payout_rank": racer.get("payout_rank"),
                },
            }
        )
    elif not tracker.get("resolved"):
        tracker.update({"result": False, "resolved": True, "evidence": None})


def _score_bet(state: Dict, bet: Dict) -> Tuple[int, Dict]:
    mode = bet["mode"]
    payout = bet["payout"]
    if bet["category"] == "racer":
        racer = state["racers"][bet["target"]]
        rank = int(racer.get("payout_rank") or 4)
        base = int(payout.get(str(rank), 0))
        hit = rank <= 3
        detail = {"rank": rank, "hit": hit}
    else:
        actual = bool(state["side_bet_tracker"].get("result"))
        predicted = bet["target"] == "yes"
        hit = actual == predicted
        base = int(payout["correct" if hit else "incorrect"])
        detail = {"prediction": bet["target"], "actual": actual, "hit": hit}
    multiplier = 2 if bet.get("doubled") else 1
    delta = base * multiplier
    return delta, {**detail, "mode": mode, "base": base, "multiplier": multiplier, "delta": delta}


def _finish_race(state: Dict) -> None:
    if state.get("phase") not in {"racing", "race_countdown"}:
        return
    active_ids = [racer_id for racer_id, racer in state["racers"].items() if racer["status"] == "active"]
    free = sorted(set(range(1, 5)) - _used_ranks(state))
    if active_ids:
        if len(active_ids) == 1 and len(free) == 1:
            racer = state["racers"][active_ids[0]]
            rank = free[0]
            racer.update(
                {
                    "status": "finished",
                    "rank_start": rank,
                    "rank_end": rank,
                    "payout_rank": rank,
                }
            )
            state["podium_groups"].append(
                {"racer_ids": active_ids, "rank_start": rank, "rank_end": rank, "kind": "remaining"}
            )
        elif len(active_ids) == len(free):
            for racer_id, rank in zip(active_ids, free):
                state["racers"][racer_id].update(
                    {
                        "status": "finished",
                        "rank_start": rank,
                        "rank_end": rank,
                        "payout_rank": rank,
                    }
                )
    _evaluate_final_side_bet(state)
    payouts: Dict[str, Dict] = {}
    for player_id in state["turn_order"]:
        pdata = state["players"][player_id]
        before = int(pdata["money"])
        ticket_lines = []
        total_delta = 0
        for bet in pdata.get("bets", []):
            delta, detail = _score_bet(state, bet)
            total_delta += delta
            ticket_lines.append({"bet": copy.deepcopy(bet), **detail})
        after = max(0, before + total_delta)
        pdata["money"] = after
        payouts[player_id] = {
            "money_before": before,
            "net": total_delta,
            "money_after": after,
            "tickets": ticket_lines,
        }
    summary = {
        "race_number": state["race_number"],
        "podium": copy.deepcopy(state["podium_groups"]),
        "racers": copy.deepcopy(state["racers"]),
        "side_bet": copy.deepcopy(_current_side_bet(state)),
        "side_bet_result": copy.deepcopy(state["side_bet_tracker"]),
        "payouts": payouts,
        "revealed_cards": [_card_view(card_id) for card_id in state["revealed_card_ids"]],
        "cycles": state["race_cycle"],
    }
    state["last_race_summary"] = summary
    state["race_history"].append(copy.deepcopy(summary))
    state["next_round_ready"] = []
    for pdata in state["players"].values():
        pdata["ready"] = False
    if int(state["race_number"]) >= 3:
        max_money = max(int(pdata["money"]) for pdata in state["players"].values())
        state["winner_ids"] = [
            player_id
            for player_id in state["turn_order"]
            if int(state["players"][player_id]["money"]) == max_money
        ]
        state["phase"] = "game_over"
        state["game_over"] = True
    else:
        state["phase"] = "race_result"


def _finish_if_ready(state: Dict) -> bool:
    if _resolved_count(state) < 3:
        return False
    _finish_race(state)
    return True


def _fold_and_reshuffle(state: Dict) -> Dict:
    cutoffs = TRACK["fold_cutoffs"]
    fold_stage = int(state.get("fold_stage", 0))
    dq_ids: List[str] = []
    cutoff = int(state.get("track_back_edge", 0))
    if fold_stage < len(cutoffs):
        cutoff = int(cutoffs[fold_stage])
        state["fold_stage"] = fold_stage + 1
        state["track_back_edge"] = cutoff
        dq_ids = [
            racer_id
            for racer_id, racer in state["racers"].items()
            if racer["status"] == "active" and int(racer["position"]) < cutoff
        ]
        _assign_dq_group(state, dq_ids, "folded_out")
    state["race_log"].append(
        {"type": "fold", "cutoff": cutoff, "fold_stage": state["fold_stage"], "dq_ids": dq_ids}
    )
    if _finish_if_ready(state):
        return {"cutoff": cutoff, "dq_ids": dq_ids, "continued": False}
    state["race_cycle"] = int(state["race_cycle"]) + 1
    shuffled = _shuffle(
        state,
        state["race_card_ids"],
        f"race-{state['race_number']}-cycle-{state['race_cycle']}",
    )
    state["burned_card_ids"] = shuffled[:3]
    state["draw_pile"] = shuffled[3:]
    return {"cutoff": cutoff, "dq_ids": dq_ids, "continued": True}


def _prepare_next_race(state: Dict) -> None:
    deal_count = 2 if len(state["turn_order"]) == 2 else 1
    pool = _shuffle(state, state["race_card_ids"], f"between-race-{state['race_number']}")
    for _ in range(deal_count):
        for player_id in state["turn_order"]:
            state["players"][player_id]["hand"].append(pool.pop(0))
    state["base_race_card_ids"] = pool
    previous_side_bet = state["current_side_bet_id"]
    state["side_bet_deck"].append(previous_side_bet)
    state["current_side_bet_id"] = state["side_bet_deck"].pop(0)
    state["race_number"] = int(state["race_number"]) + 1
    state["starting_player_index"] = (int(state["starting_player_index"]) + 1) % len(state["turn_order"])
    _prepare_betting(state)


class HotStreakGame:
    game_id = "hot_streak"
    min_players = 2
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        ordered_players = sorted(players, key=lambda item: int(item.get("seat", 0)))
        if not (HotStreakGame.min_players <= len(ordered_players) <= HotStreakGame.max_players):
            raise ValueError("Hot Streak requires 2–8 players")
        player_ids = [str(item["player_id"]) for item in ordered_players]
        if len(set(player_ids)) != len(player_ids):
            raise ValueError("Hot Streak player IDs must be unique")
        supplied_seed = (config or {}).get("seed")
        seed = str(supplied_seed) if supplied_seed is not None else str(random.SystemRandom().randrange(1 << 63))
        state = {
            "config": {},
            "catalog_version": CATALOG["catalog_version"],
            "catalog_status": CATALOG.get("catalog_status"),
            "rng_seed": seed,
            "rng_counter": 0,
            "game_index": 1,
            "phase": "betting",
            "race_number": 1,
            "turn_order": player_ids,
            "player_meta": {str(item["player_id"]): copy.deepcopy(item) for item in ordered_players},
            "players": {
                player_id: {
                    "money": 10,
                    "hand": [],
                    "bets": [],
                    "submitted": False,
                    "ready": False,
                }
                for player_id in player_ids
            },
            "unused_card_ids": [],
            "base_race_card_ids": [],
            "submitted_cards_by_player": {},
            "race_card_ids": [],
            "side_bet_deck": [],
            "current_side_bet_id": None,
            "last_race_summary": None,
            "race_history": [],
            "winner_ids": [],
            "game_over": False,
        }
        state["starting_player_index"] = _next_rng(state, "starting-player").randrange(len(player_ids))
        side_bet_ids = _shuffle(state, list(SIDE_BETS), "side-bets")
        state["current_side_bet_id"] = side_bet_ids.pop(0)
        state["side_bet_deck"] = side_bet_ids
        _draw_initial_cards(state)
        _prepare_betting(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "betting":
            return ["draft_ticket"] if _current_drafter(state) == player_id else []
        if phase == "card_selection":
            return [] if state["players"][player_id].get("submitted") else ["submit_race_cards"]
        if phase in {"race_countdown", "racing"}:
            return ["advance_race"]
        if phase == "race_result":
            return [] if player_id in set(state.get("next_round_ready", [])) else ["next_round"]
        if phase == "game_over":
            return ["play_again"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict):
            return [], "invalid action"
        action_type = action.get("type")
        if action_type not in HotStreakGame.get_legal_actions(state, player_id):
            return [], "invalid action"

        if action_type == "draft_ticket":
            stack_id = action.get("stack_id")
            mode = action.get("mode")
            if stack_id not in RACER_IDS + ["yes", "no"]:
                return [], "invalid ticket stack"
            if mode not in {"safe", "risky"}:
                return [], "invalid risk mode"
            stack = state["ticket_stacks"].get(stack_id) or []
            if not stack:
                return [], "ticket stack is empty"
            next_pick_number = int(state["draft_counts"][player_id]) + 1
            double_required = int(state["race_number"]) == 3 and next_pick_number == 2
            double_bet_id = action.get("double_bet_id")
            if double_required and not isinstance(double_bet_id, str):
                return [], "choose a bet to double"
            if not double_required and double_bet_id is not None:
                return [], "double choice is not allowed now"

            tier = stack.pop(0)
            bet_id = f"bet:{state['race_number']}:{player_id}:{next_pick_number}"
            category = "side" if stack_id in {"yes", "no"} else "racer"
            bet = {
                "bet_id": bet_id,
                "category": category,
                "target": stack_id,
                "tier": int(tier["tier"]),
                "mode": mode,
                "payout": copy.deepcopy(tier[mode]),
                "doubled": False,
            }
            state["players"][player_id]["bets"].append(bet)
            if double_required:
                target_id = bet_id if double_bet_id == "new" else double_bet_id
                candidates = {
                    item["bet_id"]: item for item in state["players"][player_id]["bets"]
                }
                if target_id not in candidates:
                    state["players"][player_id]["bets"].pop()
                    stack.insert(0, tier)
                    return [], "invalid double target"
                candidates[target_id]["doubled"] = True
            state["draft_counts"][player_id] = next_pick_number
            state["draft_cursor"] = int(state["draft_cursor"]) + 1
            events = [
                {
                    "type": "hot_streak:ticket_drafted",
                    "payload": {
                        "player_id": player_id,
                        "stack_id": stack_id,
                        "mode": mode,
                        "tier": bet["tier"],
                    },
                }
            ]
            if state["draft_cursor"] >= len(state["draft_sequence"]):
                state["phase"] = "card_selection"
                events.append({"type": "hot_streak:card_selection_started", "payload": {}})
            return events, None

        if action_type == "submit_race_cards":
            card_ids = action.get("card_ids")
            required = 2 if len(state["turn_order"]) == 2 else 1
            if not isinstance(card_ids, list) or len(card_ids) != required or len(set(card_ids)) != required:
                return [], f"choose exactly {required} race card(s)"
            hand = state["players"][player_id]["hand"]
            if any(card_id not in hand for card_id in card_ids):
                return [], "card is not in your hand"
            for card_id in card_ids:
                hand.remove(card_id)
            state["submitted_cards_by_player"][player_id] = list(card_ids)
            state["players"][player_id]["submitted"] = True
            events = [
                {
                    "type": "hot_streak:cards_submitted",
                    "payload": {"player_id": player_id, "count": required},
                }
            ]
            if len(state["submitted_cards_by_player"]) == len(state["turn_order"]):
                _start_race(state)
                events.append(
                    {"type": "hot_streak:race_started", "payload": {"race": state["race_number"]}}
                )
            return events, None

        if action_type == "advance_race":
            expected = action.get("expected_step_index")
            if not isinstance(expected, int) or expected != int(state.get("step_index", 0)):
                return [], "stale race step"
            state["step_index"] = int(state["step_index"]) + 1
            if state["phase"] == "race_countdown":
                state["countdown"] = max(0, int(state["countdown"]) - 1)
                if state["countdown"] == 0:
                    state["phase"] = "racing"
                return [
                    {
                        "type": "hot_streak:countdown",
                        "payload": {"remaining": state["countdown"]},
                    }
                ], None
            if state["draw_pile"]:
                card_id = state["draw_pile"].pop(0)
                state["current_card_id"] = card_id
                state["revealed_card_ids"].append(card_id)
                _resolve_card(state, card_id)
                ended = _finish_if_ready(state)
                events = [
                    {
                        "type": "hot_streak:card_revealed",
                        "payload": {"card": _card_view(card_id), "step_index": state["step_index"]},
                    }
                ]
                if ended:
                    events.append(
                        {"type": "hot_streak:race_scored", "payload": {"race": state["race_number"]}}
                    )
                return events, None
            fold_result = _fold_and_reshuffle(state)
            events = [{"type": "hot_streak:track_folded", "payload": fold_result}]
            if state["phase"] in {"race_result", "game_over"}:
                events.append(
                    {"type": "hot_streak:race_scored", "payload": {"race": state["race_number"]}}
                )
            return events, None

        if action_type == "next_round":
            ready = state.setdefault("next_round_ready", [])
            if player_id not in ready:
                ready.append(player_id)
                state["players"][player_id]["ready"] = True
            events = [
                {"type": "hot_streak:next_round_ready", "payload": {"player_id": player_id}}
            ]
            if len(ready) == len(state["turn_order"]):
                _prepare_next_race(state)
                events.append(
                    {"type": "hot_streak:next_race", "payload": {"race": state["race_number"]}}
                )
            return events, None

        if action_type == "play_again":
            players = [copy.deepcopy(state["player_meta"][pid]) for pid in state["turn_order"]]
            game_index = int(state.get("game_index", 1)) + 1
            replacement = HotStreakGame.init_game({}, players)
            replacement["game_index"] = game_index
            state.clear()
            state.update(replacement)
            return [
                {"type": "hot_streak:game_restarted", "payload": {"game_index": game_index}}
            ], None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        ready = set(state.get("next_round_ready", []))
        submitted = state.get("submitted_cards_by_player", {})
        players = []
        for player_id in state.get("turn_order", []):
            pdata = state["players"][player_id]
            meta = state["player_meta"].get(player_id, {})
            players.append(
                {
                    "player_id": player_id,
                    "name": meta.get("name") or player_id,
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "money": int(pdata.get("money", 0)),
                    "hand_count": len(pdata.get("hand", [])),
                    "bets": copy.deepcopy(pdata.get("bets", [])),
                    "submitted": bool(pdata.get("submitted")),
                    "submitted_count": len(submitted.get(player_id, [])),
                    "ready": player_id in ready,
                }
            )
        ticket_stacks = []
        for stack_id in RACER_IDS + ["yes", "no"]:
            remaining = state.get("ticket_stacks", {}).get(stack_id, [])
            ticket_stacks.append(
                {
                    "stack_id": stack_id,
                    "category": "side" if stack_id in {"yes", "no"} else "racer",
                    "label": stack_id.upper() if stack_id in {"yes", "no"} else RACERS[stack_id]["name"],
                    "icon": "✅" if stack_id == "yes" else "❌" if stack_id == "no" else RACERS[stack_id]["icon"],
                    "remaining": len(remaining),
                    "top": copy.deepcopy(remaining[0]) if remaining else None,
                }
            )
        racers = []
        for racer_id in RACER_IDS:
            racers.append({**copy.deepcopy(RACERS[racer_id]), **copy.deepcopy(state["racers"][racer_id])})
        side_bet = copy.deepcopy(_current_side_bet(state))
        view = {
            "game_id": HotStreakGame.game_id,
            "you": viewer_id,
            "game_index": int(state.get("game_index", 1)),
            "catalog_version": state.get("catalog_version"),
            "catalog_status": state.get("catalog_status"),
            "phase": state.get("phase"),
            "race_number": int(state.get("race_number", 1)),
            "race_total": 3,
            "players": players,
            "current_drafter": _current_drafter(state),
            "draft_progress": {
                "done": int(state.get("draft_cursor", 0)),
                "total": len(state.get("draft_sequence", [])),
            },
            "ticket_stacks": ticket_stacks,
            "current_side_bet": side_bet,
            "side_bet_tracker": copy.deepcopy(state.get("side_bet_tracker")),
            "base_race_cards": [_card_view(card_id) for card_id in state.get("base_race_card_ids", [])],
            "submission_progress": {
                "done": len(submitted),
                "total": len(state.get("turn_order", [])),
                "required_per_player": 2 if len(state.get("turn_order", [])) == 2 else 1,
            },
            "track": copy.deepcopy(TRACK),
            "racers": racers,
            "track_back_edge": int(state.get("track_back_edge", 0)),
            "fold_stage": int(state.get("fold_stage", 0)),
            "race_cycle": int(state.get("race_cycle", 1)),
            "countdown": int(state.get("countdown", 0)),
            "step_index": int(state.get("step_index", 0)),
            "current_card": _card_view(state.get("current_card_id")),
            "revealed_cards": [_card_view(card_id) for card_id in state.get("revealed_card_ids", [])],
            "race_log": copy.deepcopy(state.get("race_log", [])),
            "podium": copy.deepcopy(state.get("podium_groups", [])),
            "last_race_summary": copy.deepcopy(state.get("last_race_summary")),
            "race_history": copy.deepcopy(state.get("race_history", [])),
            "next_round_progress": {"done": len(ready), "total": len(state.get("turn_order", []))},
            "winner_ids": list(state.get("winner_ids", [])),
            "game_over": bool(state.get("game_over")),
            "legal_actions": HotStreakGame.get_legal_actions(state, viewer_id),
        }
        if viewer_id in state.get("players", {}):
            view["your_hand"] = [_card_view(card_id) for card_id in state["players"][viewer_id].get("hand", [])]
            view["your_submitted_cards"] = [
                _card_view(card_id) for card_id in submitted.get(viewer_id, [])
            ]
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = HotStreakGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        phase = state.get("phase")
        if phase == "betting":
            available = [
                stack_id
                for stack_id in RACER_IDS + ["yes", "no"]
                if state.get("ticket_stacks", {}).get(stack_id)
            ]
            if not available:
                return None
            existing_targets = {bet["target"] for bet in state["players"][bot_id].get("bets", [])}
            stack_id = next((item for item in available if item not in existing_targets), available[0])
            mode = "risky" if int(state["players"][bot_id]["money"]) >= 10 else "safe"
            action = {"type": "draft_ticket", "stack_id": stack_id, "mode": mode, "delay_ms": 350}
            next_pick = int(state["draft_counts"].get(bot_id, 0)) + 1
            if int(state["race_number"]) == 3 and next_pick == 2:
                bets = state["players"][bot_id].get("bets", [])
                action["double_bet_id"] = bets[0]["bet_id"] if bets else "new"
            return action
        if phase == "card_selection":
            required = 2 if len(state["turn_order"]) == 2 else 1
            hand = state["players"][bot_id].get("hand", [])
            return {"type": "submit_race_cards", "card_ids": hand[:required], "delay_ms": 350}
        if phase in {"race_countdown", "racing"}:
            return {
                "type": "advance_race",
                "expected_step_index": int(state.get("step_index", 0)),
                "delay_ms": 750,
            }
        if phase == "race_result":
            return {"type": "next_round", "delay_ms": 350}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
