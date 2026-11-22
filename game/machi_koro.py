import copy
import math
import random
from typing import Dict, List, Optional, Tuple

from game.machi_koro_data import CARDS, LANDMARKS


CONFIG_SCHEMA = {
    "type": "object", "properties": {
        "edition": {"enum": ["base", "harbor", "millionaires", "all"], "default": "all"},
        "market": {"enum": ["variable", "all"], "default": "variable"},
        "seed": {"type": "integer"},
    }, "additionalProperties": False,
}
ACTION_SCHEMA = {
    "type": "object", "properties": {
        "type": {"enum": ["roll", "reroll", "keep", "harbor", "activate", "choose", "buy", "build", "pass", "invest", "next_round"]},
        "dice": {"type": "integer", "enum": [1, 2]},
        "add": {"type": "boolean"}, "invest": {"type": "boolean"},
        "card": {"type": "string"}, "landmark": {"type": "string"}, "choice": {"type": "integer", "minimum": 0},
        "uid": {"type": "integer", "minimum": 1},
    }, "required": ["type"], "additionalProperties": False,
}


def _log(state: Dict, message: str) -> None:
    state["history"].append({"turn": state["turn_number"], "message": message})


def _name(state: Dict, player_id: str) -> str:
    return state["players"][player_id]["name"]


def _count(state: Dict, player_id: str, category: str) -> int:
    return sum(CARDS[card["id"]]["category"] == category for card in state["players"][player_id]["cards"])


def _owned(state: Dict, player_id: str, card_id: str) -> int:
    return sum(card["id"] == card_id for card in state["players"][player_id]["cards"])


def _instance(state: Dict, player_id: str, uid: int) -> Optional[Dict]:
    return next((card for card in state["players"][player_id]["cards"] if card["uid"] == uid), None)


def _new_card(state: Dict, card_id: str) -> Dict:
    card = {"id": card_id, "uid": state["next_uid"], "closed": False}
    state["next_uid"] += 1
    return card


def _gain(state: Dict, player_id: str, amount: int, reason: str) -> None:
    player = state["players"][player_id]
    change = max(-player["coins"], amount)
    player["coins"] += change
    if change:
        _log(state, f"{player['name']} {'+' if change > 0 else ''}{change} coins · {reason}")


def _pay(state: Dict, source: str, target: str, amount: int, reason: str) -> None:
    paid = min(state["players"][source]["coins"], max(0, amount))
    if source != target and paid:
        state["players"][source]["coins"] -= paid
        state["players"][target]["coins"] += paid
        _log(state, f"{_name(state, source)} → {_name(state, target)}: {paid} coins · {reason}")


def _refill(state: Dict) -> None:
    if state["config"]["market"] == "all":
        return
    while len(state["supply"]) < 10 and state["deck"]:
        card_id = state["deck"].pop()
        state["supply"][card_id] = state["supply"].get(card_id, 0) + 1


def _roll(state: Dict, dice: int) -> None:
    generator = random.Random(f"{state['seed']}:roll:{state['roll_serial']}")
    state["roll_serial"] += 1
    state["dice"] = [generator.randint(1, 6) for _ in range(dice)]
    _log(state, f"{_name(state, state['current_turn'])} rolled {' + '.join(map(str, state['dice']))}")


def _harbor_or_resolve(state: Dict) -> None:
    state["total"] = sum(state["dice"])
    if state["total"] >= 10 and "harbor" in state["players"][state["current_turn"]]["landmarks"]:
        state["phase"] = "harbor"
    else:
        _income(state)


def _choices(state: Dict, kind: str, choices: List[Dict]) -> None:
    if choices:
        state["pending"] = {"kind": kind, "choices": choices}
        state["phase"] = "choose"


def _next_moving_choice(state: Dict) -> None:
    if state.get("moving_remaining", 0) <= 0:
        return
    owner = state["current_turn"]
    choices = [{"give": card["uid"], "target": opponent}
               for card in state["players"][owner]["cards"] if CARDS[card["id"]]["color"] != "purple"
               for opponent in state["turn_order"] if opponent != owner]
    state["moving_remaining"] -= 1
    _choices(state, "moving_company", choices)


def _effect(state: Dict, owner: str, card: Dict, exhibition: bool = False) -> None:
    card_id = card["id"]
    data = CARDS[card_id]
    player = state["players"][owner]
    active = state["current_turn"]
    opponents = [player_id for player_id in state["turn_order"] if player_id != owner]
    reason = data["name"]
    if card["closed"]:
        card["closed"] = False
        _log(state, f"{player['name']} reopened {reason}")
        return
    landmarks = player["landmarks"]
    mall = int("shopping_mall" in landmarks and data["category"] in ("shop", "restaurant"))
    amount = None
    if card_id in ("wheat_field", "ranch", "forest", "flower_garden", "bakery"):
        amount = 1
    elif card_id == "convenience_store":
        amount = 3
    elif card_id == "mine":
        amount = 5
    elif card_id in ("apple_orchard", "vineyard"):
        amount = 3
    elif card_id in ("corn_field", "general_store") and len(landmarks) < 2:
        amount = 1 if card_id == "corn_field" else 2
    elif card_id in ("mackerel_boat", "tuna_boat") and "harbor" in landmarks:
        if card_id == "tuna_boat" and not state["tuna_roll"]:
            generator = random.Random(f"{state['seed']}:tuna:{state['turn_number']}")
            state["tuna_roll"] = [generator.randint(1, 6), generator.randint(1, 6)]
            _log(state, f"Tuna Boats rolled {' + '.join(map(str, state['tuna_roll']))}")
        amount = 3 if card_id == "mackerel_boat" else sum(state["tuna_roll"])
    elif card_id == "cheese_factory":
        amount = 3 * _count(state, owner, "animal")
    elif card_id == "furniture_factory":
        amount = 3 * _count(state, owner, "resource")
    elif card_id == "produce_market":
        amount = 2 * _count(state, owner, "grain")
    elif card_id == "flower_shop":
        amount = (1 + mall) * _owned(state, owner, "flower_garden")
        mall = 0
    elif card_id == "food_warehouse":
        amount = 2 * _count(state, owner, "restaurant")
    elif card_id == "soda_bottling_plant":
        amount = sum(_count(state, player_id, "restaurant") for player_id in state["turn_order"])
    elif card_id == "winery":
        amount = 6 * _owned(state, owner, "vineyard")
        card["closed"] = True
    elif card_id == "loan_office":
        amount = -2
    elif data["color"] == "red" and owner != active:
        due = {"cafe": 1, "family_restaurant": 2, "pizza_joint": 1, "hamburger_stand": 1}.get(card_id)
        if card_id == "sushi_bar" and "harbor" in landmarks:
            due = 3
        if card_id == "french_restaurant" and len(state["players"][active]["landmarks"]) >= 2:
            due = 5
        if card_id == "private_club" and len(state["players"][active]["landmarks"]) >= 3:
            due = state["players"][active]["coins"]
        if due is not None:
            _pay(state, active, owner, due + mall, reason)
    elif card_id in ("stadium", "publisher", "tax_office", "tech_startup"):
        for opponent in opponents:
            coins = state["players"][opponent]["coins"]
            due = {"stadium": 2, "publisher": _count(state, opponent, "shop") + _count(state, opponent, "restaurant"),
                   "tax_office": coins // 2 if coins >= 10 else 0, "tech_startup": player["investment"]}[card_id]
            _pay(state, opponent, owner, due, reason)
    elif card_id == "park":
        share = math.ceil(sum(other["coins"] for other in state["players"].values()) / len(state["players"]))
        for other in state["players"].values():
            other["coins"] = share
        _log(state, f"Park redistributed coins: {share} each")
    elif card_id == "tv_station":
        _choices(state, card_id, [{"target": opponent} for opponent in opponents])
    elif card_id == "demolition_company":
        _choices(state, card_id, [{"landmark": landmark} for landmark in landmarks])
    elif card_id == "moving_company":
        count = 1
        if not exhibition:
            for uid in list(state["income_queue"]):
                other = _instance(state, owner, uid)
                if other and other["id"] == "moving_company":
                    state["income_queue"].remove(uid)
                    if other["closed"]:
                        other["closed"] = False
                        _log(state, f"{player['name']} reopened Moving Company")
                    else:
                        count += 1
        _gain(state, owner, count * 4, reason)
        state["moving_remaining"] = count
        _next_moving_choice(state)
    elif card_id == "business_center":
        _choices(state, card_id, [{"skip": True}] + [
            {"give": own["uid"], "target": opponent, "take": other["uid"]}
            for own in player["cards"] if CARDS[own["id"]]["color"] != "purple"
            for opponent in opponents for other in state["players"][opponent]["cards"]
            if CARDS[other["id"]]["color"] != "purple"])
    elif card_id == "renovation_company":
        types = [card_id for card_id in state["card_ids"] if CARDS[card_id]["color"] != "purple"]
        _choices(state, card_id, [{"card": other} for other in types])
    elif card_id == "exhibit_hall" and not exhibition:
        _choices(state, card_id, [{"skip": True}] + [{"uid": other["uid"], "hall": card["uid"]}
                 for other in player["cards"] if CARDS[other["id"]]["color"] != "purple"])
    if amount is not None:
        _gain(state, owner, amount + (mall if amount >= 0 else 0), reason)


def _income(state: Dict) -> None:
    active = state["current_turn"]
    order = state["turn_order"]
    position = order.index(active)
    for offset in range(1, len(order)):
        owner = order[(position - offset) % len(order)]
        for card in state["players"][owner]["cards"]:
            if CARDS[card["id"]]["color"] == "red" and state["total"] in CARDS[card["id"]]["rolls"]:
                _effect(state, owner, card)
    for owner in order:
        if owner == active:
            continue
        for card in state["players"][owner]["cards"]:
            if CARDS[card["id"]]["color"] == "blue" and state["total"] in CARDS[card["id"]]["rolls"]:
                _effect(state, owner, card)
    state["income_queue"] = [card["uid"] for card in state["players"][active]["cards"]
                             if CARDS[card["id"]]["color"] != "red" and state["total"] in CARDS[card["id"]]["rolls"]]
    _advance_income(state)


def _available_income(state: Dict) -> List[int]:
    owner = state["current_turn"]
    valid = [uid for uid in state["income_queue"] if _instance(state, owner, uid)]
    ordinary = [uid for uid in valid if CARDS[_instance(state, owner, uid)["id"]]["color"] != "purple"]
    for special in ("demolition_company", "loan_office"):
        priority = [uid for uid in ordinary if _instance(state, owner, uid)["id"] == special]
        if priority:
            return priority
    before_moving = [uid for uid in ordinary if _instance(state, owner, uid)["id"] != "moving_company"]
    if before_moving:
        return before_moving
    if ordinary:
        return ordinary[:1]
    return valid


def _advance_income(state: Dict) -> None:
    if state["pending"]:
        return
    _next_moving_choice(state)
    if state["pending"]:
        return
    while True:
        choices = _available_income(state)
        if not choices:
            player = state["players"][state["current_turn"]]
            if state["city_hall"] and player["coins"] == 0:
                _gain(state, state["current_turn"], 1, "City Hall")
            state["phase"] = "build"
            return
        if len(choices) > 1:
            state["phase"] = "income"
            return
        uid = choices[0]
        state["income_queue"].remove(uid)
        _effect(state, state["current_turn"], _instance(state, state["current_turn"], uid))
        if state["pending"]:
            return


def _resolve_choice(state: Dict, choice: Dict) -> None:
    owner = state["current_turn"]
    player = state["players"][owner]
    kind = state["pending"]["kind"]
    state["pending"] = None
    if choice.get("skip"):
        return
    if kind == "tv_station":
        _pay(state, choice["target"], owner, 5, "TV Station")
    elif kind == "demolition_company":
        player["landmarks"].remove(choice["landmark"])
        _log(state, f"{player['name']} demolished {LANDMARKS[choice['landmark']]['name']}")
        _gain(state, owner, 8, "Demolition Company")
    elif kind in ("moving_company", "business_center"):
        other = state["players"][choice["target"]]
        given = _instance(state, owner, choice["give"])
        player["cards"].remove(given)
        other["cards"].append(given)
        _log(state, f"{player['name']} gave {CARDS[given['id']]['name']} to {other['name']}")
        if kind == "business_center":
            taken = _instance(state, choice["target"], choice["take"])
            other["cards"].remove(taken)
            player["cards"].append(taken)
            _log(state, f"{player['name']} received {CARDS[taken['id']]['name']}")
    elif kind == "renovation_company":
        for opponent in state["turn_order"]:
            affected = [card for card in state["players"][opponent]["cards"] if card["id"] == choice["card"] and not card["closed"]]
            for card in affected:
                card["closed"] = True
            if opponent != owner:
                _pay(state, opponent, owner, len(affected), "Renovation Company")
        _log(state, f"{CARDS[choice['card']]['name']} closed for renovation")
    elif kind == "exhibit_hall":
        hall = _instance(state, owner, choice["hall"])
        player["cards"].remove(hall)
        state["supply"]["exhibit_hall"] = state["supply"].get("exhibit_hall", 0) + 1
        _log(state, f"{player['name']} returned Exhibit Hall to the market")
        _effect(state, owner, _instance(state, owner, choice["uid"]), exhibition=True)


def _end_turn(state: Dict) -> None:
    player = state["players"][state["current_turn"]]
    if len(player["landmarks"]) == len(state["landmark_ids"]):
        state.update(game_over=True, phase="game_over", winner=[state["current_turn"]])
        _log(state, f"{player['name']} completed every landmark and won")
        return
    if state["extra_turn"]:
        _log(state, f"{player['name']} takes an extra turn · Amusement Park")
        _start_turn(state)
        return
    index = state["turn_order"].index(state["current_turn"])
    if index == len(state["turn_order"]) - 1:
        state["phase"] = "round_summary"
        state["ready"] = []
        state["round_summary"] = [{"player_id": player_id, "coins": person["coins"],
                                  "change": person["coins"] - state["round_start"][player_id],
                                  "landmarks": len(person["landmarks"]),
                                  "builds": [entry["name"] for entry in state["round_builds"] if entry["player_id"] == player_id]}
                                 for player_id, person in state["players"].items()]
    else:
        state["current_turn"] = state["turn_order"][index + 1]
        _start_turn(state)


def _after_build(state: Dict, built: bool) -> None:
    player = state["players"][state["current_turn"]]
    if not built and "airport" in player["landmarks"]:
        _gain(state, state["current_turn"], 10, "Airport")
    state["extra_turn"] = (len(state["dice"]) == 2 and state["dice"][0] == state["dice"][1]
                           and "amusement_park" in player["landmarks"])
    if len(player["landmarks"]) == len(state["landmark_ids"]):
        _end_turn(state)
    elif _owned(state, state["current_turn"], "tech_startup") and player["coins"] > 0:
        state["phase"] = "invest"
    else:
        _end_turn(state)


def _start_turn(state: Dict) -> None:
    state["turn_number"] += 1
    state.update(phase="roll", dice=[], total=None, rerolled=False, tuna_roll=[], pending=None, income_queue=[], extra_turn=False, moving_remaining=0)


class MachiKoroGame:
    game_id = "machi_koro"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = dict(config or {})
        if set(config) - {"edition", "market", "seed"} or config.get("edition", "all") not in ("base", "harbor", "millionaires", "all") or config.get("market", "variable") not in ("variable", "all") or ("seed" in config and type(config["seed"]) is not int):
            raise ValueError("invalid Machi Koro configuration")
        if not 2 <= len(players) <= 5:
            raise ValueError("Machi Koro requires 2–5 players")
        config.setdefault("edition", "all")
        config.setdefault("market", "all" if config["edition"] == "base" else "variable")
        expansions = {"base"}
        if config["edition"] in ("harbor", "all"):
            expansions.add("harbor")
        if config["edition"] in ("millionaires", "all"):
            expansions.add("millionaires")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        order = [player["player_id"] for player in ordered]
        if len(order) != len(set(order)):
            raise ValueError("duplicate player")
        seed = config.pop("seed", random.SystemRandom().randrange(2**63))
        state = {"config": config, "seed": seed, "players": {}, "turn_order": order, "current_turn": order[0],
                 "turn_number": 0, "round_number": 1, "phase": "roll", "next_uid": 1, "roll_serial": 0,
                 "history": [], "ready": [], "round_summary": [], "round_builds": [], "game_over": False, "winner": [],
                 "city_hall": "harbor" in expansions, "supply": {}, "deck": [],
                 "card_ids": [key for key, card in CARDS.items() if card["expansion"] in expansions],
                 "landmark_ids": [key for key, landmark in LANDMARKS.items() if landmark["expansion"] in expansions]}
        for person in ordered:
            state["players"][person["player_id"]] = {"name": person.get("name", person["player_id"]), "coins": 3,
                "landmarks": [], "investment": 0, "cards": [_new_card(state, "wheat_field"), _new_card(state, "bakery")]}
        for card_id, data in CARDS.items():
            if data["expansion"] in expansions:
                count = len(players) if data["color"] == "purple" else 6
                if config["market"] == "all":
                    state["supply"][card_id] = count
                else:
                    state["deck"].extend([card_id] * count)
        random.Random(seed).shuffle(state["deck"])
        _refill(state)
        state["round_start"] = {player_id: 3 for player_id in order}
        _start_turn(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id not in state["players"]:
            return []
        if state["phase"] == "round_summary":
            return [] if player_id in state["ready"] else ["next_round"]
        if player_id != state["current_turn"]:
            return []
        return {"roll": ["roll"], "reroll": ["reroll", "keep"], "harbor": ["harbor"],
                "income": ["activate"], "choose": ["choose"], "build": ["buy", "build", "pass"], "invest": ["invest"]}.get(state["phase"], [])

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not isinstance(action.get("type"), str) or action.get("type") not in MachiKoroGame.get_legal_actions(state, player_id):
            return [], "action not available"
        kind = action["type"]
        fields = {"roll": {"dice"}, "reroll": {"dice"}, "keep": set(), "harbor": {"add"}, "activate": {"uid"},
                  "choose": {"choice"}, "buy": {"card"}, "build": {"landmark"}, "pass": set(), "invest": {"invest"}, "next_round": set()}
        if set(action) != {"type"} | fields[kind]:
            return [], "invalid action fields"
        player = state["players"][player_id]
        if kind in ("roll", "reroll"):
            if type(action["dice"]) is not int or action["dice"] not in (1, 2) or (action["dice"] == 2 and "train_station" not in player["landmarks"]):
                return [], "two dice require a Train Station"
        if (kind == "harbor" and type(action["add"]) is not bool) or (kind == "invest" and type(action["invest"]) is not bool):
            return [], "expected a boolean"
        if kind == "activate" and (type(action["uid"]) is not int or action["uid"] not in _available_income(state)):
            return [], "choose an available income card"
        if kind == "choose" and (type(action["choice"]) is not int or action["choice"] not in range(len(state["pending"]["choices"]))):
            return [], "invalid choice"
        if kind == "buy":
            card_id = action["card"]
            if not isinstance(card_id, str) or card_id not in state["supply"] or CARDS[card_id]["cost"] > player["coins"] or (CARDS[card_id]["color"] == "purple" and _owned(state, player_id, card_id)):
                return [], "establishment unavailable or unaffordable"
        if kind == "build" and (not isinstance(action["landmark"], str) or action["landmark"] not in state["landmark_ids"] or action["landmark"] in player["landmarks"] or LANDMARKS[action["landmark"]]["cost"] > player["coins"]):
            return [], "landmark unavailable or unaffordable"
        if kind == "next_round":
            state["ready"].append(player_id)
            if len(state["ready"]) == len(state["players"]):
                state["round_number"] += 1
                state["round_start"] = {other_id: other["coins"] for other_id, other in state["players"].items()}
                state["round_builds"] = []
                state["current_turn"] = state["turn_order"][0]
                _start_turn(state)
        elif kind in ("roll", "reroll"):
            _roll(state, action["dice"])
            state["rerolled"] = kind == "reroll"
            if kind == "roll" and "radio_tower" in player["landmarks"]:
                state["phase"] = "reroll"
            else:
                _harbor_or_resolve(state)
        elif kind == "keep":
            _harbor_or_resolve(state)
        elif kind == "harbor":
            if action["add"]:
                state["total"] += 2
                _log(state, f"{player['name']} used Harbor: total {state['total']}")
            _income(state)
        elif kind == "activate":
            state["income_queue"].remove(action["uid"])
            _effect(state, player_id, _instance(state, player_id, action["uid"]))
            _advance_income(state)
        elif kind == "choose":
            _resolve_choice(state, state["pending"]["choices"][action["choice"]])
            _advance_income(state)
        elif kind in ("buy", "build", "pass"):
            if kind == "buy":
                card_id = action["card"]
                _gain(state, player_id, -CARDS[card_id]["cost"], f"Build {CARDS[card_id]['name']}")
                player["cards"].append(_new_card(state, card_id))
                state["supply"][card_id] -= 1
                if not state["supply"][card_id]:
                    del state["supply"][card_id]
                _log(state, f"{player['name']} built {CARDS[card_id]['name']}")
                state["round_builds"].append({"player_id": player_id, "name": CARDS[card_id]["name"]})
                _refill(state)
            elif kind == "build":
                landmark = action["landmark"]
                _gain(state, player_id, -LANDMARKS[landmark]["cost"], f"Build {LANDMARKS[landmark]['name']}")
                player["landmarks"].append(landmark)
                _log(state, f"{player['name']} built {LANDMARKS[landmark]['name']}")
                state["round_builds"].append({"player_id": player_id, "name": LANDMARKS[landmark]["name"]})
            else:
                _log(state, f"{player['name']} built nothing")
                state["round_builds"].append({"player_id": player_id, "name": "Built nothing"})
            _after_build(state, kind != "pass")
        elif kind == "invest":
            if action["invest"]:
                _gain(state, player_id, -1, "Tech Startup investment")
                player["investment"] += 1
            _end_turn(state)
        return [{"type": f"machi_koro:{kind}", "player_id": player_id}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: Optional[str]) -> Dict:
        view = {key: copy.deepcopy(state[key]) for key in ("config", "phase", "current_turn", "turn_number", "round_number", "dice", "total", "tuna_roll", "ready", "round_summary", "game_over", "winner", "landmark_ids", "city_hall")}
        legal = MachiKoroGame.get_legal_actions(state, viewer_id)
        view.update(game_id="machi_koro", you=viewer_id, legal_actions=legal,
                    players=[{"player_id": player_id, **copy.deepcopy(state["players"][player_id])} for player_id in state["turn_order"]],
                    catalog=copy.deepcopy(CARDS), landmarks=copy.deepcopy(LANDMARKS), supply=dict(state["supply"]), deck_count=len(state["deck"]),
                    history=copy.deepcopy(state["history"][-160:]),
                    pending=copy.deepcopy(state["pending"]), income_choices=_available_income(state) if state["phase"] == "income" else [])
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.machi_koro_ai import choose_move
        return choose_move(state, bot_id)

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
