import random
from typing import Dict, List, Optional, Tuple


ROLES = [
    "wolf_keeper",
    "snake_hunter",
    "herb_collector",
    "alchemist",
    "fortune_teller",
    "assistant",
    "wizard",
    "witch",
    "druid",
    "warlock",
    "cutpurse",
    "begging_monk",
]

ROLE_DEFS = {
    "wolf_keeper": {"name": "Wolf Keeper", "emoji": "🩸", "kind": "resource", "full": "+3 red", "favor": "+1 red"},
    "snake_hunter": {"name": "Snake Hunter", "emoji": "⚪", "kind": "resource", "full": "+3 white", "favor": "+1 white"},
    "herb_collector": {"name": "Herb Collector", "emoji": "🌿", "kind": "resource", "full": "+3 green", "favor": "+1 green"},
    "alchemist": {"name": "Alchemist", "emoji": "⚗️", "kind": "gold", "full": "Pay 1 ingredient for 5 gold", "favor": "Pay 1 ingredient for 2 gold"},
    "fortune_teller": {"name": "Fortune Teller", "emoji": "🔮", "kind": "gold", "full": "Pay 1 gold for 2 vials", "favor": "Pay 1 gold for 1 vial"},
    "assistant": {"name": "Assistant", "emoji": "🧑‍🔬", "kind": "gold", "full": "Pay 1 gold for any 3 ingredients", "favor": "Pay 1 gold for any 1 ingredient"},
    "wizard": {"name": "Wizard", "emoji": "🧙", "kind": "cauldron", "stack": "copper", "full": "Buy copper cauldron", "favor": "Buy copper cauldron +2 gold"},
    "witch": {"name": "Witch", "emoji": "🧪", "kind": "cauldron", "stack": "iron", "full": "Buy iron cauldron", "favor": "Buy iron cauldron +2 gold"},
    "druid": {"name": "Druid", "emoji": "🍃", "kind": "cauldron", "stack": "silver", "full": "Buy silver cauldron", "favor": "Buy silver cauldron +2 gold"},
    "warlock": {"name": "Warlock", "emoji": "📖", "kind": "spell", "full": "Use current spell", "favor": "+1 gold"},
    "cutpurse": {"name": "Cutpurse", "emoji": "💰", "kind": "shelf", "stack": "gold_shelf", "full": "Collect gold tax toward shelf", "favor": "Lose 1 less gold to Cutpurse"},
    "begging_monk": {"name": "Begging Monk", "emoji": "🙏", "kind": "shelf", "stack": "ingredient_shelf", "full": "Collect ingredient tax toward shelf", "favor": "Lose 1 less ingredient to Monk"},
}

INGREDIENTS = ["red", "green", "white"]
RESOURCES = INGREDIENTS + ["gold", "vial"]

SPELLS = ["copia", "optio", "herba", "lupus", "serpens", "magus", "sanatio", "strix"]
SPELL_DEFS = {
    "copia": {"name": "Copia", "text": "Gain any 3 ingredients."},
    "optio": {"name": "Optio", "text": "Buy any top cauldron for its normal cost."},
    "herba": {"name": "Herba", "text": "Pay 1 green for 2 vials."},
    "lupus": {"name": "Lupus", "text": "Pay 1 red for 2 vials."},
    "serpens": {"name": "Serpens", "text": "Pay 1 white for 2 vials."},
    "magus": {"name": "Magus", "text": "Buy top copper with any ingredients of equal total count."},
    "sanatio": {"name": "Sanatio", "text": "Buy top silver with any ingredients of equal total count."},
    "strix": {"name": "Strix", "text": "Buy top iron with any ingredients of equal total count."},
}

CAULDRON_DATA = {
    "iron": [
        {"id": "iron_1", "cost": {"red": 1}, "vp": 2, "raven": False},
        {"id": "iron_2", "cost": {"red": 1}, "vp": 2, "raven": False},
        {"id": "iron_3", "cost": {"red": 1, "green": 1}, "vp": 3, "raven": False},
        {"id": "iron_4", "cost": {"red": 1, "green": 1}, "vp": 3, "raven": False},
        {"id": "iron_5", "cost": {"red": 2, "green": 1}, "vp": 4, "raven": True},
        {"id": "iron_6", "cost": {"red": 2, "green": 2}, "vp": 5, "raven": False},
        {"id": "iron_7", "cost": {"red": 3, "green": 2}, "vp": 6, "raven": True},
    ],
    "copper": [
        {"id": "copper_1", "cost": {"white": 1}, "vp": 2, "raven": False},
        {"id": "copper_2", "cost": {"white": 1}, "vp": 2, "raven": False},
        {"id": "copper_3", "cost": {"white": 1, "red": 1}, "vp": 3, "raven": False},
        {"id": "copper_4", "cost": {"white": 1, "red": 1}, "vp": 3, "raven": False},
        {"id": "copper_5", "cost": {"white": 2, "red": 1}, "vp": 4, "raven": True},
        {"id": "copper_6", "cost": {"white": 2, "red": 2}, "vp": 5, "raven": False},
        {"id": "copper_7", "cost": {"white": 3, "red": 2}, "vp": 6, "raven": True},
    ],
    "silver": [
        {"id": "silver_1", "cost": {"green": 1}, "vp": 2, "raven": False},
        {"id": "silver_2", "cost": {"green": 1}, "vp": 2, "raven": False},
        {"id": "silver_3", "cost": {"green": 1, "white": 1}, "vp": 3, "raven": False},
        {"id": "silver_4", "cost": {"green": 1, "white": 1}, "vp": 3, "raven": False},
        {"id": "silver_5", "cost": {"green": 2, "white": 1}, "vp": 4, "raven": True},
        {"id": "silver_6", "cost": {"green": 2, "white": 2}, "vp": 5, "raven": False},
        {"id": "silver_7", "cost": {"green": 3, "white": 2}, "vp": 6, "raven": True},
    ],
}

SHELF_DATA = {
    "gold_shelf": [
        {"id": "gold_shelf_1", "threshold": 3, "vp": 2, "raven": False},
        {"id": "gold_shelf_2", "threshold": 3, "vp": 2, "raven": False},
        {"id": "gold_shelf_3", "threshold": 4, "vp": 3, "raven": True},
        {"id": "gold_shelf_4", "threshold": 5, "vp": 4, "raven": False},
        {"id": "gold_shelf_5", "threshold": 6, "vp": 5, "raven": True},
    ],
    "ingredient_shelf": [
        {"id": "ingredient_shelf_1", "threshold": 3, "vp": 2, "raven": False},
        {"id": "ingredient_shelf_2", "threshold": 3, "vp": 2, "raven": False},
        {"id": "ingredient_shelf_3", "threshold": 4, "vp": 3, "raven": True},
        {"id": "ingredient_shelf_4", "threshold": 5, "vp": 4, "raven": False},
        {"id": "ingredient_shelf_5", "threshold": 6, "vp": 5, "raven": True},
    ],
}


def _copy_card(card: Dict, stack: str) -> Dict:
    copied = dict(card)
    copied["stack"] = stack
    return copied


def _empty_resources() -> Dict[str, int]:
    return {key: 0 for key in RESOURCES}


def _clean_amount(value) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return max(0, value)
    return 0


def _clean_ingredients(raw) -> Dict[str, int]:
    result = {key: 0 for key in INGREDIENTS}
    if isinstance(raw, dict):
        for key in INGREDIENTS:
            result[key] = _clean_amount(raw.get(key))
    return result


def _resource_total(resources: Dict, keys: List[str]) -> int:
    return sum(int(resources.get(key, 0)) for key in keys)


def _can_pay(player: Dict, cost: Dict[str, int]) -> bool:
    resources = player["resources"]
    return all(int(resources.get(key, 0)) >= int(value) for key, value in cost.items())


def _pay(player: Dict, cost: Dict[str, int]) -> None:
    for key, value in cost.items():
        player["resources"][key] = int(player["resources"].get(key, 0)) - int(value)


def _gain(player: Dict, gains: Dict[str, int]) -> None:
    for key, value in gains.items():
        if key in RESOURCES and int(value) > 0:
            player["resources"][key] = int(player["resources"].get(key, 0)) + int(value)


def _sorted_player_ids(state: Dict) -> List[str]:
    return sorted(state.get("player_meta", {}).keys(), key=lambda pid: state["player_meta"][pid].get("seat", 0))


def _next_seated(state: Dict, player_id: str) -> Optional[str]:
    order = _sorted_player_ids(state)
    if not order:
        return None
    if player_id not in order:
        return order[0]
    return order[(order.index(player_id) + 1) % len(order)]


def _next_with_hand(state: Dict, player_id: Optional[str]) -> Optional[str]:
    order = _sorted_player_ids(state)
    if not order:
        return None
    start = order.index(player_id) if player_id in order else -1
    for offset in range(1, len(order) + 1):
        pid = order[(start + offset) % len(order)]
        if state["players"][pid].get("hand_roles"):
            return pid
    return None


def _advance_response(state: Dict) -> None:
    active = state.get("active_role")
    if not active:
        return
    order = _sorted_player_ids(state)
    start = state.get("response_index", 0)
    while start < len(order):
        pid = order[start]
        state["response_index"] = start
        if pid == state.get("round_starter"):
            start += 1
            continue
        if active in state["players"][pid].get("hand_roles", []):
            state["current_player"] = pid
            state["phase"] = "respond"
            return
        state["round_passed"].append(pid)
        start += 1
    _begin_full_action(state)


def _begin_full_action(state: Dict) -> None:
    claimant = state.get("claimant")
    role = state.get("active_role")
    state["pending_action"] = {"player_id": claimant, "role": role, "strength": "full"}
    state["current_player"] = claimant
    state["phase"] = "resolve_action"


def _finish_pending_action(state: Dict, summary: str) -> None:
    pending = state.get("pending_action") or {}
    if pending.get("strength") == "full":
        state["last_round"] = {
            "set_number": state.get("set_number"),
            "round_number": state.get("round_number"),
            "role": pending.get("role"),
            "starter": state.get("round_starter"),
            "claimant": pending.get("player_id"),
            "participants": list(state.get("round_participants", [])),
            "favor_players": list(state.get("favor_players", [])),
            "passed": list(state.get("round_passed", [])),
            "summary": summary,
        }
        state["starter_player"] = pending.get("player_id")
        state["active_role"] = None
        state["round_starter"] = None
        state["claimant"] = None
        state["response_index"] = 0
        state["round_participants"] = []
        state["favor_players"] = []
        state["round_passed"] = []
        state["pending_action"] = None
        state["pause_ready"] = []
        state["current_player"] = None
        state["phase"] = "round_pause"
    else:
        state["pending_action"] = None
        state["response_index"] = int(state.get("response_index", 0)) + 1
        _advance_response(state)


def _all_hands_empty(state: Dict) -> bool:
    return all(not pdata.get("hand_roles") for pdata in state.get("players", {}).values())


def _raven_count(state: Dict) -> int:
    count = 0
    for pdata in state.get("players", {}).values():
        count += sum(1 for card in pdata.get("potions", []) if card.get("raven"))
        count += sum(1 for card in pdata.get("shelves", []) if card.get("raven"))
    return count


def _finalize_scores(state: Dict) -> None:
    scores = {}
    for pid, pdata in state.get("players", {}).items():
        card_points = sum(int(card.get("vp", 0)) for card in pdata.get("potions", []))
        card_points += sum(int(card.get("vp", 0)) for card in pdata.get("shelves", []))
        vials = int(pdata.get("resources", {}).get("vial", 0))
        resources = _resource_total(pdata.get("resources", {}), ["red", "green", "white", "gold"])
        total = card_points + vials
        scores[pid] = {"total": total, "cards": card_points, "vials": vials, "resources_tiebreak": resources}
    best = max((score["total"] for score in scores.values()), default=0)
    candidates = [pid for pid, score in scores.items() if score["total"] == best]
    best_resources = max((scores[pid]["resources_tiebreak"] for pid in candidates), default=0)
    winners = [pid for pid in candidates if scores[pid]["resources_tiebreak"] == best_resources]
    state["scores"] = scores
    state["winner"] = sorted(winners, key=lambda pid: state["player_meta"][pid].get("seat", 0))
    state["phase"] = "game_over"
    state["game_over"] = True
    state["current_player"] = None


def _start_selection(state: Dict) -> None:
    state["set_number"] = int(state.get("set_number", 0)) + 1
    state["phase"] = "select_roles"
    state["current_player"] = None
    state["selected_count"] = 0
    state["disabled_roles"] = []
    count = len(state.get("turn_order", []))
    if count in (3, 4):
        disabled_deck = state.setdefault("disabled_deck", [])
        if len(disabled_deck) < (2 if count == 3 else 1):
            disabled_deck.extend(random.sample(ROLES, len(ROLES)))
        draw_count = 2 if count == 3 else 1
        state["disabled_roles"] = [disabled_deck.pop() for _ in range(draw_count)]
    for pdata in state.get("players", {}).values():
        pdata["selected_roles"] = []
        pdata["hand_roles"] = []
        pdata["played_roles"] = []
    state["pause_ready"] = []


def _start_next_play(state: Dict) -> None:
    if _all_hands_empty(state):
        if state.get("spell_deck"):
            state["spell_deck"].append(state["spell_deck"].pop(0))
        if _raven_count(state) >= 4:
            _finalize_scores(state)
        else:
            _start_selection(state)
        return
    starter = state.get("starter_player")
    if starter not in state.get("players", {}) or not state["players"][starter].get("hand_roles"):
        starter = _next_with_hand(state, starter)
    state["current_player"] = starter
    state["phase"] = "play_role"


def _take_cauldron(state: Dict, player_id: str, stack: str, flexible_payment: Optional[Dict] = None, extra_gold: int = 0, extra_ingredient: Optional[str] = None) -> str:
    cards = state["cauldrons"].get(stack, [])
    if not cards:
        return "no card taken"
    card = cards[0]
    player = state["players"][player_id]
    cost = {key: int(value) for key, value in card.get("cost", {}).items()}
    if extra_gold:
        cost["gold"] = cost.get("gold", 0) + extra_gold
    if flexible_payment is not None:
        payment = _clean_ingredients(flexible_payment)
        if sum(payment.values()) != sum(int(v) for v in card.get("cost", {}).values()):
            return "invalid flexible payment"
        cost = payment
    if not _can_pay(player, cost):
        return "not enough resources"
    _pay(player, cost)
    taken = state["cauldrons"][stack].pop(0)
    player["potions"].append(taken)
    summary = f"took {stack} {taken['vp']} VP"
    if extra_ingredient in INGREDIENTS and int(player["resources"].get(extra_ingredient, 0)) > 0:
        player["resources"][extra_ingredient] -= 1
        player["resources"]["vial"] += 1
        summary += " and gained 1 vial"
    return summary


def _resolve_basic_action(state: Dict, player_id: str, role: str, strength: str, payload: Dict) -> Tuple[bool, str]:
    player = state["players"][player_id]
    full = strength == "full"
    if payload.get("skip"):
        return True, "skipped action"
    if role == "wolf_keeper":
        _gain(player, {"red": 3 if full else 1})
        return True, f"gained {3 if full else 1} red"
    if role == "snake_hunter":
        _gain(player, {"white": 3 if full else 1})
        return True, f"gained {3 if full else 1} white"
    if role == "herb_collector":
        _gain(player, {"green": 3 if full else 1})
        return True, f"gained {3 if full else 1} green"
    if role == "alchemist":
        color = payload.get("pay_ingredient")
        if color not in INGREDIENTS:
            return False, "choose ingredient to pay"
        if player["resources"].get(color, 0) <= 0:
            return False, "not enough ingredient"
        player["resources"][color] -= 1
        _gain(player, {"gold": 5 if full else 2})
        return True, f"paid {color} for {5 if full else 2} gold"
    if role == "fortune_teller":
        if player["resources"].get("gold", 0) <= 0:
            return False, "not enough gold"
        player["resources"]["gold"] -= 1
        _gain(player, {"vial": 2 if full else 1})
        return True, f"paid 1 gold for {2 if full else 1} vials"
    if role == "assistant":
        amount = 3 if full else 1
        gains = _clean_ingredients(payload.get("gain_ingredients"))
        if sum(gains.values()) != amount:
            return False, f"choose exactly {amount} ingredients"
        if player["resources"].get("gold", 0) <= 0:
            return False, "not enough gold"
        player["resources"]["gold"] -= 1
        _gain(player, gains)
        return True, f"paid 1 gold for {amount} ingredients"
    if role in ("wizard", "witch", "druid"):
        stack = ROLE_DEFS[role]["stack"]
        summary = _take_cauldron(state, player_id, stack, extra_gold=0 if full else 2, extra_ingredient=payload.get("extra_ingredient"))
        if summary in ("not enough resources", "invalid flexible payment"):
            return False, summary
        return True, summary
    if role == "warlock":
        if not full:
            _gain(player, {"gold": 1})
            return True, "gained 1 gold"
        return _resolve_spell(state, player_id, payload)
    if role == "cutpurse":
        if not full:
            return True, "protected against Cutpurse"
        return _resolve_cutpurse(state, player_id, payload)
    if role == "begging_monk":
        if not full:
            return True, "protected against Begging Monk"
        return _resolve_begging_monk_start(state, player_id, payload)
    return False, "unknown role"


def _resolve_spell(state: Dict, player_id: str, payload: Dict) -> Tuple[bool, str]:
    spell = (state.get("spell_deck") or [None])[0]
    player = state["players"][player_id]
    if spell == "copia":
        gains = _clean_ingredients(payload.get("gain_ingredients"))
        if sum(gains.values()) != 3:
            return False, "choose exactly 3 ingredients"
        _gain(player, gains)
        return True, "used Copia"
    if spell == "optio":
        stack = payload.get("stack")
        if stack not in CAULDRON_DATA:
            return False, "choose cauldron stack"
        summary = _take_cauldron(state, player_id, stack)
        if summary == "not enough resources":
            return False, summary
        return True, f"used Optio: {summary}"
    spell_cost = {"herba": "green", "lupus": "red", "serpens": "white"}
    if spell in spell_cost:
        color = spell_cost[spell]
        if player["resources"].get(color, 0) <= 0:
            return False, f"not enough {color}"
        player["resources"][color] -= 1
        player["resources"]["vial"] += 2
        return True, f"used {spell}"
    spell_stack = {"magus": "copper", "sanatio": "silver", "strix": "iron"}
    if spell in spell_stack:
        summary = _take_cauldron(state, player_id, spell_stack[spell], flexible_payment=payload.get("payment"))
        if summary in ("not enough resources", "invalid flexible payment"):
            return False, summary
        return True, f"used {spell}: {summary}"
    return False, "unknown spell"


def _maybe_take_shelf(state: Dict, player_id: str, stack: str) -> str:
    cards = state["shelves"].get(stack, [])
    if not cards:
        return "no shelf available"
    card = cards[0]
    stored = state["shelf_stored"][stack]
    total = stored["gold"] if stack == "gold_shelf" else _resource_total(stored, INGREDIENTS)
    if total < int(card["threshold"]):
        return f"stored {total}/{card['threshold']}"
    taken = state["shelves"][stack].pop(0)
    state["shelf_stored"][stack] = _empty_resources()
    state["players"][player_id]["shelves"].append(taken)
    return f"took {stack} {taken['vp']} VP"


def _resolve_cutpurse(state: Dict, player_id: str, payload: Dict) -> Tuple[bool, str]:
    stored = state["shelf_stored"]["gold_shelf"]
    stolen = 0
    for pid, pdata in state["players"].items():
        if pid == player_id:
            continue
        loss = int(pdata["resources"].get("gold", 0)) // 3
        if pid in state.get("favor_players", []):
            loss = max(0, loss - 1)
        if loss:
            pdata["resources"]["gold"] -= loss
            stored["gold"] += loss
            stolen += loss
    augment = _clean_amount(payload.get("augment_gold"))
    player = state["players"][player_id]
    if augment > int(player["resources"].get("gold", 0)):
        return False, "not enough gold to augment"
    player["resources"]["gold"] -= augment
    stored["gold"] += augment
    result = _maybe_take_shelf(state, player_id, "gold_shelf")
    return True, f"stole {stolen} gold, added {augment}; {result}"


def _resolve_begging_monk_start(state: Dict, player_id: str, payload: Dict) -> Tuple[bool, str]:
    augment = _clean_ingredients(payload.get("augment_ingredients"))
    if not _can_pay(state["players"][player_id], augment):
        return False, "not enough ingredients to augment"
    pending = []
    for pid, pdata in state["players"].items():
        if pid == player_id:
            continue
        total = _resource_total(pdata["resources"], INGREDIENTS)
        loss = total // 4
        if pid in state.get("favor_players", []):
            loss = max(0, loss - 1)
        if loss:
            pending.append({"player_id": pid, "amount": loss})
    state["monk_resolution"] = {"actor": player_id, "pending_losses": pending, "augment": augment}
    if pending:
        state["phase"] = "choose_loss"
        state["current_player"] = pending[0]["player_id"]
        return True, "collecting monk losses"
    return _finish_begging_monk(state)


def _finish_begging_monk(state: Dict) -> Tuple[bool, str]:
    info = state.get("monk_resolution") or {}
    actor = info.get("actor")
    augment = info.get("augment") or {}
    player = state["players"][actor]
    if not _can_pay(player, augment):
        return False, "not enough ingredients to augment"
    _pay(player, augment)
    for color, amount in augment.items():
        state["shelf_stored"]["ingredient_shelf"][color] += amount
    result = _maybe_take_shelf(state, actor, "ingredient_shelf")
    state["monk_resolution"] = None
    return True, f"added {sum(augment.values())} ingredients; {result}"


class WitchsBrewGame:
    game_id = "witchs_brew"
    min_players = 3
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not (3 <= len(players) <= 5):
            raise ValueError("Witch's Brew requires 3-5 players")
        player_ids = [p["player_id"] for p in players]
        spell_deck = list(SPELLS)
        random.shuffle(spell_deck)
        state = {
            "phase": "setup",
            "players": {
                p["player_id"]: {
                    "resources": {"red": 1, "green": 1, "white": 1, "gold": 2, "vial": 0},
                    "selected_roles": [],
                    "hand_roles": [],
                    "played_roles": [],
                    "potions": [],
                    "shelves": [],
                }
                for p in players
            },
            "player_meta": {p["player_id"]: p for p in players},
            "turn_order": player_ids,
            "starter_player": random.choice(player_ids),
            "current_player": None,
            "set_number": 0,
            "round_number": 0,
            "active_role": None,
            "round_starter": None,
            "claimant": None,
            "response_index": 0,
            "round_participants": [],
            "favor_players": [],
            "round_passed": [],
            "pending_action": None,
            "monk_resolution": None,
            "pause_ready": [],
            "last_round": None,
            "disabled_roles": [],
            "disabled_deck": random.sample(ROLES, len(ROLES)),
            "cauldrons": {stack: [_copy_card(card, stack) for card in cards] for stack, cards in CAULDRON_DATA.items()},
            "shelves": {stack: [_copy_card(card, stack) for card in cards] for stack, cards in SHELF_DATA.items()},
            "shelf_stored": {"gold_shelf": _empty_resources(), "ingredient_shelf": _empty_resources()},
            "spell_deck": spell_deck,
            "scores": None,
            "winner": [],
            "game_over": False,
            "config": config or {},
        }
        _start_selection(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        phase = state.get("phase")
        if phase == "select_roles":
            return ["select_roles"] if not state["players"][player_id].get("selected_roles") else []
        if phase == "play_role" and player_id == state.get("current_player"):
            return ["play_role"]
        if phase == "respond" and player_id == state.get("current_player"):
            return ["respond"]
        if phase == "resolve_action" and (state.get("pending_action") or {}).get("player_id") == player_id:
            return ["resolve_action"]
        if phase == "choose_loss" and player_id == state.get("current_player"):
            return ["choose_loss"]
        if phase == "round_pause" and player_id not in state.get("pause_ready", []):
            return ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        action_type = action.get("type")
        if state.get("game_over"):
            return [], "game over"

        if state.get("phase") == "select_roles":
            if action_type != "select_roles":
                return [], "select roles first"
            roles = action.get("roles")
            if not isinstance(roles, list) or len(roles) != 5:
                return [], "choose exactly 5 roles"
            if len(set(roles)) != 5 or any(role not in ROLES for role in roles):
                return [], "invalid roles"
            if any(role in state.get("disabled_roles", []) for role in roles):
                return [], "role disabled this set"
            pdata = state["players"][player_id]
            if pdata.get("selected_roles"):
                return [], "roles already selected"
            pdata["selected_roles"] = list(roles)
            pdata["hand_roles"] = list(roles)
            if all(state["players"][pid].get("selected_roles") for pid in state.get("turn_order", [])):
                _start_next_play(state)
            return [{"type": "witchs_brew:select_roles", "payload": {"player_id": player_id}}], None

        if state.get("phase") == "play_role":
            if action_type != "play_role":
                return [], "invalid action"
            if player_id != state.get("current_player"):
                return [], "not your turn"
            role = action.get("role")
            pdata = state["players"][player_id]
            if role not in pdata.get("hand_roles", []):
                return [], "role not in hand"
            pdata["hand_roles"].remove(role)
            pdata["played_roles"].append(role)
            order = _sorted_player_ids(state)
            state["round_number"] = int(state.get("round_number", 0)) + 1
            state["active_role"] = role
            state["round_starter"] = player_id
            state["claimant"] = player_id
            state["round_participants"] = [player_id]
            state["favor_players"] = []
            state["round_passed"] = []
            state["response_index"] = order.index(player_id) + 1
            _advance_response(state)
            return [{"type": "witchs_brew:play_role", "payload": {"player_id": player_id, "role": role}}], None

        if state.get("phase") == "respond":
            if action_type != "respond":
                return [], "invalid action"
            if player_id != state.get("current_player"):
                return [], "not your response"
            role = state.get("active_role")
            pdata = state["players"][player_id]
            if role not in pdata.get("hand_roles", []):
                state["response_index"] = int(state.get("response_index", 0)) + 1
                _advance_response(state)
                return [], None
            response = action.get("response")
            if response not in ("claim_full", "take_favor"):
                return [], "choose full or favor"
            pdata["hand_roles"].remove(role)
            pdata["played_roles"].append(role)
            state["round_participants"].append(player_id)
            if response == "claim_full":
                state["claimant"] = player_id
                state["response_index"] = int(state.get("response_index", 0)) + 1
                _advance_response(state)
                return [{"type": "witchs_brew:claim_full", "payload": {"player_id": player_id, "role": role}}], None
            state["favor_players"].append(player_id)
            if role in ("cutpurse", "begging_monk"):
                state["response_index"] = int(state.get("response_index", 0)) + 1
                _advance_response(state)
                return [{"type": "witchs_brew:favor", "payload": {"player_id": player_id, "role": role}}], None
            state["pending_action"] = {"player_id": player_id, "role": role, "strength": "favor"}
            state["phase"] = "resolve_action"
            return [{"type": "witchs_brew:favor", "payload": {"player_id": player_id, "role": role}}], None

        if state.get("phase") == "resolve_action":
            if action_type != "resolve_action":
                return [], "invalid action"
            pending = state.get("pending_action") or {}
            if pending.get("player_id") != player_id:
                return [], "not your action"
            ok, summary = _resolve_basic_action(state, player_id, pending.get("role"), pending.get("strength"), action)
            if not ok:
                return [], summary
            if state.get("phase") == "choose_loss":
                return [{"type": "witchs_brew:action", "payload": {"player_id": player_id, "summary": summary}}], None
            _finish_pending_action(state, summary)
            return [{"type": "witchs_brew:action", "payload": {"player_id": player_id, "summary": summary}}], None

        if state.get("phase") == "choose_loss":
            if action_type != "choose_loss":
                return [], "invalid action"
            if player_id != state.get("current_player"):
                return [], "not your loss choice"
            info = state.get("monk_resolution") or {}
            pending = info.get("pending_losses") or []
            if not pending or pending[0].get("player_id") != player_id:
                return [], "no pending loss"
            amount = int(pending[0].get("amount", 0))
            loss = _clean_ingredients(action.get("loss"))
            if sum(loss.values()) != amount:
                return [], f"choose exactly {amount} ingredients"
            player = state["players"][player_id]
            if not _can_pay(player, loss):
                return [], "not enough ingredients"
            _pay(player, loss)
            for color, count in loss.items():
                state["shelf_stored"]["ingredient_shelf"][color] += count
            pending.pop(0)
            if pending:
                state["current_player"] = pending[0]["player_id"]
                return [{"type": "witchs_brew:monk_loss", "payload": {"player_id": player_id, "loss": loss}}], None
            ok, summary = _finish_begging_monk(state)
            if not ok:
                return [], summary
            _finish_pending_action(state, summary)
            return [{"type": "witchs_brew:monk_loss", "payload": {"player_id": player_id, "loss": loss}}], None

        if state.get("phase") == "round_pause":
            if action_type != "next_round":
                return [], "invalid action"
            if player_id not in state["pause_ready"]:
                state["pause_ready"].append(player_id)
            if len(state["pause_ready"]) >= len(state.get("turn_order", [])):
                _start_next_play(state)
            return [{"type": "witchs_brew:next_round", "payload": {"player_id": player_id}}], None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for pid in _sorted_player_ids(state):
            pdata = state["players"][pid]
            meta = state["player_meta"].get(pid, {})
            selected = pdata.get("selected_roles", [])
            players.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "resources": dict(pdata.get("resources", {})),
                    "hand_count": len(pdata.get("hand_roles", [])),
                    "selected_count": len(selected),
                    "selected_ready": bool(selected),
                    "played_roles": list(pdata.get("played_roles", [])),
                    "potions": list(pdata.get("potions", [])),
                    "shelves": list(pdata.get("shelves", [])),
                }
            )
        you = state["players"].get(viewer_id, {})
        return {
            "game_id": WitchsBrewGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_player": state.get("current_player"),
            "starter_player": state.get("starter_player"),
            "set_number": state.get("set_number"),
            "round_number": state.get("round_number"),
            "active_role": state.get("active_role"),
            "round_starter": state.get("round_starter"),
            "claimant": state.get("claimant"),
            "round_participants": list(state.get("round_participants", [])),
            "favor_players": list(state.get("favor_players", [])),
            "round_passed": list(state.get("round_passed", [])),
            "pending_action": state.get("pending_action"),
            "monk_resolution": state.get("monk_resolution"),
            "disabled_roles": list(state.get("disabled_roles", [])),
            "pause_ready": list(state.get("pause_ready", [])),
            "last_round": state.get("last_round"),
            "players": players,
            "your_hand": list(you.get("hand_roles", [])),
            "your_selected": list(you.get("selected_roles", [])),
            "cauldrons": {stack: list(cards) for stack, cards in state.get("cauldrons", {}).items()},
            "shelves": {stack: list(cards) for stack, cards in state.get("shelves", {}).items()},
            "shelf_stored": state.get("shelf_stored", {}),
            "spell": (state.get("spell_deck") or [None])[0],
            "spell_deck": list(state.get("spell_deck", [])),
            "scores": state.get("scores"),
            "winner": state.get("winner", []),
            "game_over": state.get("game_over", False),
            "legal_actions": WitchsBrewGame.get_legal_actions(state, viewer_id),
            "role_defs": ROLE_DEFS,
            "spell_defs": SPELL_DEFS,
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = WitchsBrewGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        if "select_roles" in legal:
            disabled = set(state.get("disabled_roles", []))
            roles = [role for role in ROLES if role not in disabled]
            return {"type": "select_roles", "roles": random.sample(roles, 5)}
        if "play_role" in legal:
            hand = state["players"][bot_id].get("hand_roles", [])
            return {"type": "play_role", "role": hand[0]} if hand else None
        if "respond" in legal:
            return {"type": "respond", "response": random.choice(["claim_full", "take_favor"])}
        if "next_round" in legal:
            return {"type": "next_round"}
        if "choose_loss" in legal:
            amount = ((state.get("monk_resolution") or {}).get("pending_losses") or [{}])[0].get("amount", 0)
            resources = state["players"][bot_id]["resources"]
            loss = {key: 0 for key in INGREDIENTS}
            for key in INGREDIENTS:
                take = min(int(resources.get(key, 0)), amount - sum(loss.values()))
                loss[key] = take
                if sum(loss.values()) >= amount:
                    break
            return {"type": "choose_loss", "loss": loss}
        if "resolve_action" in legal:
            pending = state.get("pending_action") or {}
            role = pending.get("role")
            if role == "assistant":
                if pending.get("strength") == "full":
                    return {"type": "resolve_action", "gain_ingredients": {"red": 1, "green": 1, "white": 1}}
                return {"type": "resolve_action", "gain_ingredients": {"red": 1, "green": 0, "white": 0}}
            if role == "alchemist":
                return {"type": "resolve_action", "pay_ingredient": "red"}
            if role == "warlock" and (state.get("spell_deck") or [None])[0] == "copia":
                return {"type": "resolve_action", "gain_ingredients": {"red": 1, "green": 1, "white": 1}}
            return {"type": "resolve_action", "skip": True}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
