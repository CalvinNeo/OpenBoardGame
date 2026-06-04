import random
from typing import Dict, List, Optional, Tuple

CITY_COUNT = 9
DICE_FACES = ["cloud", "lightning", "bird", "pirate", "blank", "blank"]
HAZARD_ORDER = ["cloud", "lightning", "bird", "pirate"]
EQUIPMENT_FOR_HAZARD = {
    "cloud": "compass",
    "lightning": "lightning_rod",
    "bird": "foghorn",
    "pirate": "cannon",
}
POWER_KINDS = {
    "jetpack",
    "ejection",
    "alternative_route",
    "wind_gust",
}

DEFAULT_CONFIG: Dict = {
    "target_score": 50,
}

TREASURE_VALUES_BY_CITY = {
    1: [1, 1, 2, 2, 2, 3, 3, 0],
    2: [2, 2, 3, 3, 4, 4, 5, 0],
    3: [3, 3, 4, 4, 5, 5, 6, 0],
    4: [4, 4, 5, 6, 6, 7, 8, 0],
    5: [6, 6, 7, 8, 8, 9, 10, 12, 0],
    6: [7, 8, 9, 10, 10, 12, 12, 14, 0],
    7: [9, 10, 11, 12, 13, 14, 15, 16, 0],
    8: [12, 13, 14, 15, 17, 18, 20, 22, 0],
    9: [14, 15, 16, 18, 20, 22, 25, 25, 30, 0],
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if isinstance(config, dict):
        for key, value in config.items():
            cfg[key] = value
    target_score = cfg.get("target_score")
    if not isinstance(target_score, int) or target_score < 1:
        cfg["target_score"] = DEFAULT_CONFIG["target_score"]
    return cfg


def _required_dice_for_destination(city_no: int) -> int:
    if city_no <= 4:
        return 2
    if city_no <= 7:
        return 3
    return 4


def _next_player_after(state: Dict, player_id: str) -> Optional[str]:
    order = state.get("turn_order", [])
    if player_id not in order or not order:
        return order[0] if order else None
    idx = order.index(player_id)
    return order[(idx + 1) % len(order)]


def _ship_order(state: Dict) -> List[str]:
    return [pid for pid in state.get("turn_order", []) if state["players"][pid].get("on_ship")]


def _ship_order_starting_after_captain(state: Dict) -> List[str]:
    captain = state.get("captain")
    ship = _ship_order(state)
    if captain not in ship:
        return ship
    idx = ship.index(captain)
    return ship[idx + 1 :] + ship[:idx]


def _next_on_ship_after(state: Dict, player_id: str) -> Optional[str]:
    ship = _ship_order(state)
    if not ship:
        return None
    if player_id not in ship:
        return ship[0]
    idx = ship.index(player_id)
    if len(ship) == 1:
        return ship[0]
    return ship[(idx + 1) % len(ship)]


def _new_state_card_id(state: Dict, prefix: str) -> str:
    value = int(state.get("next_card_id", 1))
    state["next_card_id"] = value + 1
    return f"{prefix}_{value}"


def _make_action_card(state: Dict, kind: str) -> Dict:
    if kind == "compass":
        return {"id": _new_state_card_id(state, "a"), "category": "equipment", "kind": kind}
    if kind == "lightning_rod":
        return {"id": _new_state_card_id(state, "a"), "category": "equipment", "kind": kind}
    if kind == "foghorn":
        return {"id": _new_state_card_id(state, "a"), "category": "equipment", "kind": kind}
    if kind == "cannon":
        return {"id": _new_state_card_id(state, "a"), "category": "equipment", "kind": kind}
    if kind == "turbo":
        return {"id": _new_state_card_id(state, "a"), "category": "wild", "kind": kind}
    return {"id": _new_state_card_id(state, "a"), "category": "power", "kind": kind}


def _make_treasure_card(state: Dict, city_no: int, value: int) -> Dict:
    if value == 0:
        return {"id": _new_state_card_id(state, "t"), "city": city_no, "kind": "telescope", "points": 0}
    return {"id": _new_state_card_id(state, "t"), "city": city_no, "kind": "points", "points": value}


def _build_action_deck(state: Dict) -> List[Dict]:
    deck: List[Dict] = []
    for _ in range(20):
        deck.append(_make_action_card(state, "compass"))
    for _ in range(18):
        deck.append(_make_action_card(state, "lightning_rod"))
    for _ in range(16):
        deck.append(_make_action_card(state, "foghorn"))
    for _ in range(14):
        deck.append(_make_action_card(state, "cannon"))
    for _ in range(8):
        deck.append(_make_action_card(state, "turbo"))
    for kind in ["jetpack", "ejection", "alternative_route", "wind_gust"]:
        for _ in range(2):
            deck.append(_make_action_card(state, kind))
    random.shuffle(deck)
    return deck


def _build_treasure_decks(state: Dict) -> Dict[int, List[Dict]]:
    decks: Dict[int, List[Dict]] = {}
    for city_no, values in TREASURE_VALUES_BY_CITY.items():
        cards = [_make_treasure_card(state, city_no, value) for value in values]
        random.shuffle(cards)
        decks[city_no] = cards
    return decks


def _reshuffle_action_deck(state: Dict) -> None:
    discard = state.get("action_discard", [])
    if not discard:
        return
    random.shuffle(discard)
    state.setdefault("action_deck", []).extend(discard)
    state["action_discard"] = []


def _draw_action_cards(state: Dict, player_id: str, count: int) -> List[Dict]:
    drawn: List[Dict] = []
    hand = state["players"][player_id]["hand"]
    for _ in range(count):
        if not state.get("action_deck"):
            _reshuffle_action_deck(state)
        if not state.get("action_deck"):
            break
        card = state["action_deck"].pop()
        hand.append(card)
        drawn.append(card)
    return drawn


def _draw_treasure(state: Dict, player_id: str, city_no: int) -> Optional[Dict]:
    deck = state.get("treasure_decks", {}).get(city_no, [])
    if not deck:
        return None
    card = deck.pop()
    state["players"][player_id]["treasures"].append(card)
    return card


def _remove_hand_card(state: Dict, player_id: str, card_id: str) -> Optional[Dict]:
    hand = state["players"][player_id]["hand"]
    for idx, card in enumerate(hand):
        if card.get("id") == card_id:
            return hand.pop(idx)
    return None


def _discard_action_card(state: Dict, card: Dict) -> None:
    state.setdefault("action_discard", []).append(card)


def _remove_telescope(state: Dict, player_id: str, treasure_id: Optional[str] = None) -> Optional[Dict]:
    treasures = state["players"][player_id]["treasures"]
    for idx, card in enumerate(treasures):
        if card.get("kind") != "telescope":
            continue
        if treasure_id and card.get("id") != treasure_id:
            continue
        return treasures.pop(idx)
    return None


def _player_total_score(state: Dict, player_id: str) -> int:
    return sum(int(card.get("points", 0)) for card in state["players"][player_id].get("treasures", []))


def _hand_counts(hand: List[Dict]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for card in hand:
        kind = card.get("kind")
        counts[kind] = counts.get(kind, 0) + 1
    return counts


def _hazard_counts_from_dice(dice_results: List[str]) -> Dict[str, int]:
    counts = {hazard: 0 for hazard in HAZARD_ORDER}
    for face in dice_results:
        if face in counts:
            counts[face] += 1
    return counts


def _normal_resolution_possible(hand: List[Dict], hazard_counts: Dict[str, int]) -> bool:
    counts = _hand_counts(hand)
    for hazard, need in hazard_counts.items():
        if counts.get(EQUIPMENT_FOR_HAZARD[hazard], 0) < need:
            return False
    return True


def _full_resolution_possible(hand: List[Dict], hazard_counts: Dict[str, int]) -> bool:
    counts = _hand_counts(hand)
    turbo_left = counts.get("turbo", 0)
    for hazard, need in hazard_counts.items():
        use_normal = min(counts.get(EQUIPMENT_FOR_HAZARD[hazard], 0), need)
        turbo_left -= max(0, need - use_normal)
        if turbo_left < 0:
            return False
    return True


def _consume_cards_for_resolution(state: Dict, player_id: str, hazard_counts: Dict[str, int]) -> List[Dict]:
    hand = state["players"][player_id]["hand"]
    consumed: List[Dict] = []
    for hazard in HAZARD_ORDER:
        need = int(hazard_counts.get(hazard, 0))
        if need <= 0:
            continue
        equipment_kind = EQUIPMENT_FOR_HAZARD[hazard]
        matching = [card for card in hand if card.get("kind") == equipment_kind]
        for card in matching[:need]:
            hand.remove(card)
            consumed.append(card)
        need -= min(len(matching), need)
        if need > 0:
            turbos = [card for card in hand if card.get("kind") == "turbo"]
            for card in turbos[:need]:
                hand.remove(card)
                consumed.append(card)
    for card in consumed:
        _discard_action_card(state, card)
    return consumed


def _award_city_treasure(state: Dict, player_id: str, city_no: int, summary: Optional[Dict] = None) -> None:
    card = _draw_treasure(state, player_id, city_no)
    if card and isinstance(summary, dict):
        summary.setdefault("rewards", []).append({"player_id": player_id, "treasure": _public_treasure(card)})


def _set_pending_passenger(state: Dict) -> None:
    captain = state.get("captain")
    pending = None
    for pid in _ship_order_starting_after_captain(state):
        if pid != captain:
            pending = pid
            break
    state["pending_passenger"] = pending


def _eligible_reroll_players(state: Dict) -> List[str]:
    if state.get("phase") != "reroll_window":
        return []
    captain = state.get("captain")
    eligible: List[str] = []
    for pid in _ship_order(state):
        hand = state["players"][pid]["hand"]
        kinds = {card.get("kind") for card in hand}
        if pid == captain and "alternative_route" in kinds:
            eligible.append(pid)
            continue
        if "wind_gust" in kinds and "blank" in state.get("dice_results", []):
            eligible.append(pid)
    return eligible


def _eligible_ejection_players(state: Dict) -> List[str]:
    if state.get("phase") != "ejection_window":
        return []
    targets = [pid for pid in _ship_order(state) if pid != state.get("captain")]
    if not targets:
        return []
    eligible: List[str] = []
    for pid in _ship_order(state):
        if any(card.get("kind") == "ejection" for card in state["players"][pid]["hand"]):
            eligible.append(pid)
    return eligible


def _eligible_special_players(state: Dict) -> List[str]:
    if state.get("phase") == "reroll_window":
        return _eligible_reroll_players(state)
    if state.get("phase") == "ejection_window":
        return _eligible_ejection_players(state)
    return []


def _reset_special_passes(state: Dict) -> None:
    state["special_passes"] = []


def _advance_to_passenger_choice(state: Dict) -> None:
    state["phase"] = "passenger_choice"
    _set_pending_passenger(state)
    if state.get("pending_passenger") is None:
        _advance_to_ejection_or_captain(state)


def _advance_to_ejection_or_captain(state: Dict) -> None:
    state["pending_passenger"] = None
    state["phase"] = "ejection_window"
    _reset_special_passes(state)
    if not _eligible_special_players(state):
        _advance_to_captain_action(state)


def _advance_to_captain_action(state: Dict) -> None:
    state["phase"] = "captain_action"
    state["special_passes"] = []


def _advance_after_roll(state: Dict) -> None:
    state["phase"] = "reroll_window"
    _reset_special_passes(state)
    if not _eligible_special_players(state):
        _advance_to_passenger_choice(state)


def _prepare_next_leg(state: Dict) -> None:
    state["dice_results"] = []
    state["hazard_counts"] = {hazard: 0 for hazard in HAZARD_ORDER}
    state["special_passes"] = []
    state["pending_passenger"] = None
    state["jetpack_pending"] = []
    state["jetpack_decisions"] = {}
    state["phase"] = "roll"


def _begin_journey(state: Dict, captain_id: str) -> None:
    state["journey_no"] = int(state.get("journey_no", 0)) + 1
    state["current_city"] = 1
    state["captain"] = captain_id
    state["journey_end_captain"] = None
    state["journey_summary"] = None
    state["next_ready"] = []
    for pid in state.get("turn_order", []):
        state["players"][pid]["on_ship"] = True
    _prepare_next_leg(state)


def _finish_game_if_needed(state: Dict) -> bool:
    target = int(state["config"].get("target_score", 50))
    player_ids = state.get("turn_order", [])
    scores = {pid: _player_total_score(state, pid) for pid in player_ids}
    if not any(score >= target for score in scores.values()):
        return False
    best = max(scores.values()) if scores else 0
    top = [pid for pid in player_ids if scores.get(pid, 0) == best]
    fewest = min(len(state["players"][pid]["treasures"]) for pid in top) if top else 0
    winners = [pid for pid in top if len(state["players"][pid]["treasures"]) == fewest]
    state["winner"] = winners
    state["game_over"] = True
    state["phase"] = "game_over"
    return True


def _end_journey(state: Dict, reason: str, summary: Dict) -> None:
    state["journey_end_captain"] = state.get("captain")
    state["journey_summary"] = {
        "reason": reason,
        "city": state.get("current_city"),
        "captain": state.get("captain"),
        **summary,
    }
    state["phase"] = "journey_end"
    state["next_ready"] = []
    for pid in state.get("turn_order", []):
        state["players"][pid]["on_ship"] = False


def _end_journey_after_crash(state: Dict, summary: Dict) -> None:
    _end_journey(state, "crash", summary)


def _resolve_move_success(state: Dict) -> Dict:
    summary: Dict = {"rewards": []}
    state["current_city"] += 1
    if state["current_city"] >= CITY_COUNT:
        state["current_city"] = CITY_COUNT
        for pid in _ship_order(state):
            _award_city_treasure(state, pid, CITY_COUNT, summary)
        _end_journey(state, "finish", summary)
        return summary
    next_captain = _next_on_ship_after(state, state.get("captain"))
    if next_captain:
        state["captain"] = next_captain
    _prepare_next_leg(state)
    return summary


def _roll_dice_for_leg(state: Dict) -> List[str]:
    target_city = min(CITY_COUNT, int(state.get("current_city", 1)) + 1)
    dice_count = _required_dice_for_destination(target_city)
    results = [random.choice(DICE_FACES) for _ in range(dice_count)]
    state["dice_results"] = results
    state["hazard_counts"] = _hazard_counts_from_dice(results)
    return results


def _public_action_card(card: Dict) -> Dict:
    kind = card.get("kind")
    symbol = {
        "compass": "🧭",
        "lightning_rod": "⚡",
        "foghorn": "📯",
        "cannon": "💣",
        "turbo": "🛠️",
        "jetpack": "🎒",
        "ejection": "🪂",
        "alternative_route": "🗺️",
        "wind_gust": "🌪️",
    }.get(kind, "❓")
    label = {
        "compass": "Compass",
        "lightning_rod": "Lightning Arrester",
        "foghorn": "Foghorn",
        "cannon": "Cannon",
        "turbo": "Turbo",
        "jetpack": "Jetpack",
        "ejection": "Ejection",
        "alternative_route": "Alternative Route",
        "wind_gust": "Wind Gust",
    }.get(kind, kind or "Card")
    return {
        "id": card.get("id"),
        "kind": kind,
        "category": card.get("category"),
        "label": label,
        "symbol": symbol,
    }


def _public_treasure(card: Dict) -> Dict:
    if card.get("kind") == "telescope":
        return {
            "id": card.get("id"),
            "kind": "telescope",
            "city": card.get("city"),
            "points": 0,
            "label": "🔭 Magic Spyglass",
        }
    return {
        "id": card.get("id"),
        "kind": "points",
        "city": card.get("city"),
        "points": int(card.get("points", 0)),
        "label": f"💎 {int(card.get('points', 0))}",
    }


def _player_name(state: Dict, player_id: str) -> str:
    meta = state.get("player_meta", {}).get(player_id, {})
    return meta.get("name") or player_id


class CelestiaGame:
    game_id = "celestia"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [player["player_id"] for player in sorted(players, key=lambda item: item.get("seat", 0))]
        player_meta = {player["player_id"]: player for player in players}
        state = {
            "config": cfg,
            "turn_order": player_ids,
            "player_meta": player_meta,
            "players": {},
            "next_card_id": 1,
            "action_deck": [],
            "action_discard": [],
            "treasure_decks": {},
            "captain": player_ids[0] if player_ids else None,
            "journey_no": 0,
            "current_city": 1,
            "phase": "roll",
            "dice_results": [],
            "hazard_counts": {hazard: 0 for hazard in HAZARD_ORDER},
            "pending_passenger": None,
            "special_passes": [],
            "jetpack_pending": [],
            "jetpack_decisions": {},
            "journey_end_captain": None,
            "journey_summary": None,
            "next_ready": [],
            "winner": [],
            "game_over": False,
        }
        for pid in player_ids:
            state["players"][pid] = {
                "hand": [],
                "treasures": [],
                "on_ship": True,
            }
        state["action_deck"] = _build_action_deck(state)
        state["treasure_decks"] = _build_treasure_decks(state)
        initial_cards = 8 if len(player_ids) <= 3 else 6
        for pid in player_ids:
            _draw_action_cards(state, pid, initial_cards)
        if player_ids:
            _begin_journey(state, player_ids[0])
            state["journey_no"] = 1
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again"]
        phase = state.get("phase")
        captain = state.get("captain")
        if phase == "journey_end":
            return [] if player_id in state.get("next_ready", []) else ["next_journey"]
        if phase == "roll":
            if player_id != captain:
                return []
            actions = ["roll_dice"]
            if _ship_order(state) == [captain]:
                actions.append("solo_leave")
            return actions
        if phase == "reroll_window":
            eligible = _eligible_special_players(state)
            if player_id not in eligible:
                return []
            actions = ["pass_special"]
            hand = state["players"][player_id]["hand"]
            kinds = {card.get("kind") for card in hand}
            if player_id == captain and "alternative_route" in kinds:
                actions.append("play_power")
            if "wind_gust" in kinds and "blank" in state.get("dice_results", []):
                actions.append("play_power")
            return actions
        if phase == "passenger_choice":
            return ["passenger_choice"] if player_id == state.get("pending_passenger") else []
        if phase == "ejection_window":
            eligible = _eligible_special_players(state)
            if player_id not in eligible:
                return []
            return ["pass_special", "play_power"]
        if phase == "captain_action":
            if player_id != captain:
                return []
            actions: List[str] = []
            hand = state["players"][captain]["hand"]
            hazards = state.get("hazard_counts", {})
            if _full_resolution_possible(hand, hazards):
                actions.append("captain_resolve")
            telescope_count = sum(1 for card in state["players"][captain]["treasures"] if card.get("kind") == "telescope")
            if telescope_count and not _normal_resolution_possible(hand, hazards):
                actions.append("captain_resolve")
            if not _normal_resolution_possible(hand, hazards):
                actions.append("captain_fail")
            return actions
        if phase == "jetpack_window":
            if player_id not in state.get("jetpack_pending", []):
                return []
            if player_id in state.get("jetpack_decisions", {}):
                return []
            return ["jetpack_decision"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        if action_type == "play_again":
            if not state.get("game_over"):
                return [], "game not over"
            players = []
            for pid in state.get("turn_order", []):
                meta = dict(state["player_meta"].get(pid, {}))
                meta["player_id"] = pid
                players.append(meta)
            fresh = CelestiaGame.init_game(state.get("config"), players)
            state.clear()
            state.update(fresh)
            events.append({"type": "celestia:play_again", "payload": {"player_id": player_id}})
            return events, None

        if state.get("game_over"):
            return [], "game over"

        phase = state.get("phase")

        if action_type == "next_journey":
            if phase != "journey_end":
                return [], "invalid phase"
            if player_id in state.get("next_ready", []):
                return [], "already ready"
            state["next_ready"].append(player_id)
            events.append({"type": "celestia:next_journey_ready", "payload": {"player_id": player_id}})
            if len(state["next_ready"]) < len(state.get("turn_order", [])):
                return events, None
            if _finish_game_if_needed(state):
                events.append({"type": "celestia:game_over", "payload": {"winner": state.get("winner", [])}})
                return events, None
            for pid in state.get("turn_order", []):
                _draw_action_cards(state, pid, 1)
            new_captain = _next_player_after(state, state.get("journey_end_captain"))
            if new_captain:
                _begin_journey(state, new_captain)
            events.append({"type": "celestia:journey_start", "payload": {"captain": state.get("captain")}})
            return events, None

        if action_type == "roll_dice":
            if phase != "roll" or player_id != state.get("captain"):
                return [], "not allowed"
            results = _roll_dice_for_leg(state)
            events.append({"type": "celestia:roll", "payload": {"player_id": player_id, "dice": list(results)}})
            _advance_after_roll(state)
            return events, None

        if action_type == "solo_leave":
            if phase != "roll" or player_id != state.get("captain"):
                return [], "not allowed"
            if _ship_order(state) != [player_id]:
                return [], "not alone"
            summary: Dict = {"rewards": []}
            _award_city_treasure(state, player_id, int(state.get("current_city", 1)), summary)
            events.append({"type": "celestia:solo_leave", "payload": {"player_id": player_id}})
            _end_journey(state, "solo_leave", summary)
            return events, None

        if action_type == "pass_special":
            if phase not in ("reroll_window", "ejection_window"):
                return [], "invalid phase"
            eligible = _eligible_special_players(state)
            if player_id not in eligible:
                return [], "not allowed"
            if player_id in state.get("special_passes", []):
                return [], "already passed"
            state["special_passes"].append(player_id)
            events.append({"type": "celestia:pass_special", "payload": {"player_id": player_id, "phase": phase}})
            if sorted(state["special_passes"]) != sorted(eligible):
                return events, None
            if phase == "reroll_window":
                _advance_to_passenger_choice(state)
            else:
                _advance_to_captain_action(state)
            return events, None

        if action_type == "play_power":
            if phase == "reroll_window":
                card_id = action.get("card_id")
                card = _remove_hand_card(state, player_id, card_id) if isinstance(card_id, str) else None
                if not card:
                    return [], "card not found"
                kind = card.get("kind")
                if kind == "alternative_route":
                    if player_id != state.get("captain"):
                        state["players"][player_id]["hand"].append(card)
                        return [], "only captain can use that"
                    indexes = action.get("dice_indexes")
                    if not isinstance(indexes, list) or not indexes:
                        state["players"][player_id]["hand"].append(card)
                        return [], "choose dice to reroll"
                    unique_indexes = sorted({idx for idx in indexes if isinstance(idx, int)})
                    if any(idx < 0 or idx >= len(state.get("dice_results", [])) for idx in unique_indexes):
                        state["players"][player_id]["hand"].append(card)
                        return [], "invalid die index"
                    for idx in unique_indexes:
                        state["dice_results"][idx] = random.choice(DICE_FACES)
                    state["hazard_counts"] = _hazard_counts_from_dice(state["dice_results"])
                elif kind == "wind_gust":
                    blank_indexes = [idx for idx, face in enumerate(state.get("dice_results", [])) if face == "blank"]
                    if not blank_indexes:
                        state["players"][player_id]["hand"].append(card)
                        return [], "no blank dice"
                    for idx in blank_indexes:
                        state["dice_results"][idx] = random.choice(DICE_FACES)
                    state["hazard_counts"] = _hazard_counts_from_dice(state["dice_results"])
                else:
                    state["players"][player_id]["hand"].append(card)
                    return [], "invalid power"
                _discard_action_card(state, card)
                _reset_special_passes(state)
                events.append(
                    {
                        "type": "celestia:play_power",
                        "payload": {"player_id": player_id, "kind": kind, "dice": list(state["dice_results"])},
                    }
                )
                if not _eligible_special_players(state):
                    _advance_to_passenger_choice(state)
                return events, None

            if phase == "ejection_window":
                card_id = action.get("card_id")
                target_player_id = action.get("target_player_id")
                card = _remove_hand_card(state, player_id, card_id) if isinstance(card_id, str) else None
                if not card:
                    return [], "card not found"
                if card.get("kind") != "ejection":
                    state["players"][player_id]["hand"].append(card)
                    return [], "invalid power"
                valid_targets = [pid for pid in _ship_order(state) if pid != state.get("captain")]
                if target_player_id not in valid_targets:
                    state["players"][player_id]["hand"].append(card)
                    return [], "invalid target"
                _discard_action_card(state, card)
                state["players"][target_player_id]["on_ship"] = False
                reward = _draw_treasure(state, target_player_id, int(state.get("current_city", 1)))
                _reset_special_passes(state)
                events.append(
                    {
                        "type": "celestia:play_power",
                        "payload": {
                            "player_id": player_id,
                            "kind": "ejection",
                            "target_player_id": target_player_id,
                            "reward": _public_treasure(reward) if reward else None,
                        },
                    }
                )
                if not _eligible_special_players(state):
                    _advance_to_captain_action(state)
                return events, None

            return [], "invalid phase"

        if action_type == "passenger_choice":
            if phase != "passenger_choice" or player_id != state.get("pending_passenger"):
                return [], "not allowed"
            choice = action.get("choice")
            if choice not in ("stay", "leave"):
                return [], "invalid choice"
            if choice == "leave":
                state["players"][player_id]["on_ship"] = False
                reward = _draw_treasure(state, player_id, int(state.get("current_city", 1)))
                events.append(
                    {
                        "type": "celestia:passenger_choice",
                        "payload": {"player_id": player_id, "choice": choice, "reward": _public_treasure(reward) if reward else None},
                    }
                )
            else:
                events.append({"type": "celestia:passenger_choice", "payload": {"player_id": player_id, "choice": choice}})
            _set_pending_passenger(state)
            if state.get("pending_passenger") == player_id:
                state["pending_passenger"] = None
            if state.get("pending_passenger") is None:
                _advance_to_ejection_or_captain(state)
            return events, None

        if action_type == "captain_resolve":
            if phase != "captain_action" or player_id != state.get("captain"):
                return [], "not allowed"
            method = action.get("method") or "cards"
            hazards = dict(state.get("hazard_counts", {}))
            hand = state["players"][player_id]["hand"]
            if method == "telescope":
                if _normal_resolution_possible(hand, hazards):
                    return [], "must use normal equipment"
                treasure_id = action.get("treasure_id")
                telescope = _remove_telescope(state, player_id, treasure_id if isinstance(treasure_id, str) else None)
                if not telescope:
                    return [], "no telescope"
                events.append({"type": "celestia:captain_resolve", "payload": {"player_id": player_id, "method": "telescope"}})
                _resolve_move_success(state)
                return events, None
            if not _full_resolution_possible(hand, hazards):
                return [], "cannot resolve with cards"
            consumed = _consume_cards_for_resolution(state, player_id, hazards)
            events.append(
                {
                    "type": "celestia:captain_resolve",
                    "payload": {
                        "player_id": player_id,
                        "method": "cards",
                        "cards": [_public_action_card(card) for card in consumed],
                    },
                }
            )
            _resolve_move_success(state)
            return events, None

        if action_type == "captain_fail":
            if phase != "captain_action" or player_id != state.get("captain"):
                return [], "not allowed"
            if _normal_resolution_possible(state["players"][player_id]["hand"], state.get("hazard_counts", {})):
                return [], "must use normal equipment"
            summary = {"rewards": [], "crashed": _ship_order(state)}
            pending = []
            for pid in _ship_order(state):
                if any(card.get("kind") == "jetpack" for card in state["players"][pid]["hand"]):
                    pending.append(pid)
            if pending:
                state["phase"] = "jetpack_window"
                state["jetpack_pending"] = pending
                state["jetpack_decisions"] = {}
                state["journey_summary"] = {
                    "reason": "crash",
                    "city": state.get("current_city"),
                    "captain": state.get("captain"),
                    **summary,
                }
            else:
                _end_journey_after_crash(state, summary)
            events.append({"type": "celestia:captain_fail", "payload": {"player_id": player_id}})
            return events, None

        if action_type == "jetpack_decision":
            if phase != "jetpack_window":
                return [], "invalid phase"
            if player_id not in state.get("jetpack_pending", []):
                return [], "not allowed"
            if player_id in state.get("jetpack_decisions", {}):
                return [], "already decided"
            use = bool(action.get("use"))
            reward = None
            if use:
                card = next((card for card in state["players"][player_id]["hand"] if card.get("kind") == "jetpack"), None)
                if not card:
                    return [], "no jetpack"
                state["players"][player_id]["hand"].remove(card)
                _discard_action_card(state, card)
                reward = _draw_treasure(state, player_id, int(state.get("current_city", 1)))
                state["journey_summary"].setdefault("rewards", []).append(
                    {"player_id": player_id, "treasure": _public_treasure(reward) if reward else None}
                )
            state["jetpack_decisions"][player_id] = use
            events.append(
                {
                    "type": "celestia:jetpack_decision",
                    "payload": {"player_id": player_id, "use": use, "reward": _public_treasure(reward) if reward else None},
                }
            )
            if len(state["jetpack_decisions"]) < len(state.get("jetpack_pending", [])):
                return events, None
            summary = state.get("journey_summary") or {"rewards": []}
            _end_journey_after_crash(state, summary)
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_views = []
        for pid in state.get("turn_order", []):
            meta = state.get("player_meta", {}).get(pid, {})
            pdata = state["players"][pid]
            score = _player_total_score(state, pid)
            reveal = pid == viewer_id or state.get("game_over")
            player_views.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "on_ship": pdata.get("on_ship", False),
                    "hand_count": len(pdata.get("hand", [])),
                    "treasure_count": len(pdata.get("treasures", [])),
                    "score": score if reveal else None,
                    "score_hidden": not reveal,
                    "treasures": [_public_treasure(card) for card in pdata.get("treasures", [])] if reveal else [],
                }
            )
        your = state["players"][viewer_id]
        ship = _ship_order(state)
        next_city = min(CITY_COUNT, int(state.get("current_city", 1)) + 1) if state.get("current_city", 1) < CITY_COUNT else None
        return {
            "game_id": CelestiaGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "journey_no": state.get("journey_no"),
            "current_city": state.get("current_city"),
            "next_city": next_city,
            "required_dice": _required_dice_for_destination(next_city) if next_city else 0,
            "captain": state.get("captain"),
            "ship_order": ship,
            "dice_results": list(state.get("dice_results", [])),
            "hazard_counts": dict(state.get("hazard_counts", {})),
            "pending_passenger": state.get("pending_passenger"),
            "special_passes": list(state.get("special_passes", [])),
            "special_phase": state.get("phase") if state.get("phase") in ("reroll_window", "ejection_window") else None,
            "players": player_views,
            "your_hand": [_public_action_card(card) for card in your.get("hand", [])],
            "your_treasures": [_public_treasure(card) for card in your.get("treasures", [])],
            "your_score": _player_total_score(state, viewer_id),
            "treasure_counts": {str(city_no): len(cards) for city_no, cards in state.get("treasure_decks", {}).items()},
            "legal_actions": CelestiaGame.get_legal_actions(state, viewer_id),
            "journey_summary": state.get("journey_summary"),
            "next_ready": list(state.get("next_ready", [])),
            "winner": list(state.get("winner", [])),
            "game_over": bool(state.get("game_over")),
            "config": dict(state.get("config", {})),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = CelestiaGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        phase = state.get("phase")
        if phase == "journey_end":
            return {"type": "next_journey"}
        if phase == "roll":
            if "solo_leave" in legal and state.get("current_city", 1) >= 5:
                return {"type": "solo_leave"}
            return {"type": "roll_dice"}
        if phase == "reroll_window":
            hand = state["players"][bot_id]["hand"]
            if bot_id == state.get("captain"):
                route = next((card for card in hand if card.get("kind") == "alternative_route"), None)
                if route and sum(state.get("hazard_counts", {}).values()) >= 3:
                    indexes = [idx for idx, face in enumerate(state.get("dice_results", [])) if face != "blank"]
                    if indexes:
                        return {"type": "play_power", "card_id": route["id"], "dice_indexes": indexes[:2]}
            gust = next((card for card in hand if card.get("kind") == "wind_gust"), None)
            if gust and "blank" in state.get("dice_results", []) and random.random() < 0.35:
                return {"type": "play_power", "card_id": gust["id"]}
            return {"type": "pass_special"}
        if phase == "passenger_choice":
            current_city = int(state.get("current_city", 1))
            danger = sum(state.get("hazard_counts", {}).values())
            choice = "leave" if current_city >= 5 or danger >= 3 else "stay"
            return {"type": "passenger_choice", "choice": choice}
        if phase == "ejection_window":
            hand = state["players"][bot_id]["hand"]
            eject = next((card for card in hand if card.get("kind") == "ejection"), None)
            targets = [pid for pid in _ship_order(state) if pid != state.get("captain")]
            if eject and targets and random.random() < 0.3:
                target = max(targets, key=lambda pid: _player_total_score(state, pid))
                return {"type": "play_power", "card_id": eject["id"], "target_player_id": target}
            return {"type": "pass_special"}
        if phase == "captain_action":
            hand = state["players"][bot_id]["hand"]
            hazards = state.get("hazard_counts", {})
            if _full_resolution_possible(hand, hazards):
                return {"type": "captain_resolve", "method": "cards"}
            telescope = next((card for card in state["players"][bot_id]["treasures"] if card.get("kind") == "telescope"), None)
            if telescope:
                return {"type": "captain_resolve", "method": "telescope", "treasure_id": telescope.get("id")}
            return {"type": "captain_fail"}
        if phase == "jetpack_window":
            return {"type": "jetpack_decision", "use": int(state.get("current_city", 1)) >= 4}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
