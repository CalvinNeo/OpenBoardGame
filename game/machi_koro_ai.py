from typing import Dict, Optional

from game.machi_koro_data import CARDS, LANDMARKS
from game.machi_koro import _available_income, _count, _instance, _owned


def _income_value(state: Dict, player_id: str, card_id: str) -> float:
    player = state["players"][player_id]
    landmarks = player["landmarks"]
    mall = int("shopping_mall" in landmarks and CARDS[card_id]["category"] in ("shop", "restaurant"))
    values = {
        "wheat_field": 1, "ranch": 1, "bakery": 1, "cafe": 1, "convenience_store": 3,
        "forest": 1, "mine": 5, "family_restaurant": 2, "apple_orchard": 3,
        "flower_garden": 1, "pizza_joint": 1, "hamburger_stand": 1, "vineyard": 3,
        "corn_field": int(len(landmarks) < 2), "general_store": 2 * int(len(landmarks) < 2),
        "sushi_bar": 3 * int("harbor" in landmarks), "mackerel_boat": 3 * int("harbor" in landmarks),
        "tuna_boat": 7 * int("harbor" in landmarks), "cheese_factory": 3 * _count(state, player_id, "animal"),
        "furniture_factory": 3 * _count(state, player_id, "resource"),
        "produce_market": 2 * _count(state, player_id, "grain"),
        "flower_shop": _owned(state, player_id, "flower_garden"),
        "food_warehouse": 2 * _count(state, player_id, "restaurant"),
        "soda_bottling_plant": sum(_count(state, other, "restaurant") for other in state["turn_order"]),
        "winery": 3 * _owned(state, player_id, "vineyard"), "loan_office": -2,
        "stadium": 2 * (len(state["players"]) - 1), "tv_station": 4, "business_center": 2,
        "publisher": sum(_count(state, other, "shop") + _count(state, other, "restaurant")
                         for other in state["turn_order"] if other != player_id),
        "tax_office": sum(state["players"][other]["coins"] // 2 for other in state["turn_order"]
                          if other != player_id and state["players"][other]["coins"] >= 10),
        "tech_startup": player["investment"] * (len(state["players"]) - 1),
        "french_restaurant": 4, "private_club": 12, "exhibit_hall": 3,
        "renovation_company": 3, "park": 1, "demolition_company": -4,
        "moving_company": 2,
    }
    return float(values.get(card_id, 0) + mall)


def _probability(rolls: list, dice: int, harbor: bool = False) -> float:
    totals = range(1, 7) if dice == 1 else [first + second for first in range(1, 7) for second in range(1, 7)]
    return sum(total in rolls or (harbor and total >= 10 and total + 2 in rolls) for total in totals) / len(totals)


def _card_value(state: Dict, player_id: str, card_id: str) -> float:
    player = state["players"][player_id]
    card = CARDS[card_id]
    dice_options = (1, 2) if "train_station" in player["landmarks"] else (1,)
    probability = max(_probability(card["rolls"], dice, "harbor" in player["landmarks"]) for dice in dice_options)
    multiplier = len(state["players"]) if card["color"] == "blue" else len(state["players"]) - 1 if card["color"] == "red" else 1
    value = _income_value(state, player_id, card_id)
    if card_id == "flower_shop" and "shopping_mall" in player["landmarks"]:
        value = 2 * _owned(state, player_id, "flower_garden")
    return probability * value * multiplier


def _total_value(state: Dict, player_id: str, total: int) -> float:
    value = 0.0
    for owner, player in state["players"].items():
        for card in player["cards"]:
            data = CARDS[card["id"]]
            if total not in data["rolls"] or card["closed"]:
                continue
            if owner == player_id and data["color"] != "red":
                value += _income_value(state, owner, card["id"])
            elif owner != player_id and data["color"] == "red":
                value -= _income_value(state, owner, card["id"])
            elif owner != player_id and data["color"] == "blue":
                value -= 0.18 * _income_value(state, owner, card["id"])
    return value


def _roll_value(state: Dict, player_id: str, total: int) -> float:
    choices = [total, total + 2] if total >= 10 and "harbor" in state["players"][player_id]["landmarks"] else [total]
    return max(_total_value(state, player_id, choice) for choice in choices)


def _best_dice(state: Dict, player_id: str) -> int:
    if "train_station" not in state["players"][player_id]["landmarks"]:
        return 1
    single = sum(_roll_value(state, player_id, total) for total in range(1, 7)) / 6
    double = sum(_roll_value(state, player_id, first + second) for first in range(1, 7) for second in range(1, 7)) / 36
    if "amusement_park" in state["players"][player_id]["landmarks"]:
        double += max(0.5, double / 6)
    return 2 if double > single else 1


def _choice_score(state: Dict, player_id: str, choice: Dict) -> float:
    kind = state["pending"]["kind"]
    if choice.get("skip"):
        return 0
    if kind == "tv_station":
        return min(5, state["players"][choice["target"]]["coins"])
    if kind == "demolition_company":
        return -LANDMARKS[choice["landmark"]]["cost"]
    if kind in ("business_center", "moving_company"):
        given = _instance(state, player_id, choice["give"])
        value = -_card_value(state, player_id, given["id"])
        if kind == "business_center":
            taken = _instance(state, choice["target"], choice["take"])
            value += _card_value(state, player_id, taken["id"])
        return value
    if kind == "renovation_company":
        return sum((1 if owner != player_id else -2) * sum(card["id"] == choice["card"] and not card["closed"] for card in player["cards"])
                   for owner, player in state["players"].items())
    if kind == "exhibit_hall":
        card = _instance(state, player_id, choice["uid"])
        return _income_value(state, player_id, card["id"]) - 5 if not card["closed"] else -5
    return 0


def choose_move(state: Dict, bot_id: str) -> Optional[Dict]:
    from game.machi_koro import MachiKoroGame
    legal = MachiKoroGame.get_legal_actions(state, bot_id)
    if not legal:
        return None
    player = state["players"][bot_id]
    phase = state["phase"]
    if "next_round" in legal:
        return {"type": "next_round"}
    if phase == "roll":
        return {"type": "roll", "dice": _best_dice(state, bot_id)}
    if phase == "reroll":
        dice = _best_dice(state, bot_id)
        totals = list(range(1, 7)) if dice == 1 else [first + second for first in range(1, 7) for second in range(1, 7)]
        expected = sum(_roll_value(state, bot_id, total) for total in totals) / len(totals)
        return {"type": "reroll", "dice": dice} if expected > _roll_value(state, bot_id, sum(state["dice"])) + 0.25 else {"type": "keep"}
    if phase == "harbor":
        return {"type": "harbor", "add": _total_value(state, bot_id, state["total"] + 2) > _total_value(state, bot_id, state["total"])}
    if phase == "income":
        def activation_score(uid: int) -> float:
            card = _instance(state, bot_id, uid)
            if card["id"] == "loan_office":
                return 100
            if card["id"] in ("moving_company", "demolition_company"):
                return -100
            return 0 if card["closed"] else _income_value(state, bot_id, card["id"])
        return {"type": "activate", "uid": max(_available_income(state), key=activation_score)}
    if phase == "choose":
        choices = state["pending"]["choices"]
        return {"type": "choose", "choice": max(range(len(choices)), key=lambda index: _choice_score(state, bot_id, choices[index]))}
    if phase == "invest":
        return {"type": "invest", "invest": player["coins"] >= 8 and player["investment"] < 5}
    remaining = [landmark for landmark in state["landmark_ids"] if landmark not in player["landmarks"]]
    priorities = {"harbor": 0, "train_station": 1, "shopping_mall": 2, "amusement_park": 3, "radio_tower": 4, "airport": 5}
    next_landmark = min(remaining, key=lambda landmark: priorities[landmark])
    engine = sum(_card_value(state, bot_id, card["id"]) for card in player["cards"])
    affordable = [card_id for card_id, count in state["supply"].items() if count and CARDS[card_id]["cost"] <= player["coins"]
                  and not (CARDS[card_id]["color"] == "purple" and _owned(state, bot_id, card_id))]
    best = max(affordable, key=lambda card_id: _card_value(state, bot_id, card_id) / max(1, CARDS[card_id]["cost"]), default=None)
    if len(remaining) == 1 or engine >= 2.5 or state["round_number"] > 22:
        if player["coins"] >= LANDMARKS[next_landmark]["cost"]:
            return {"type": "build", "landmark": next_landmark}
        if best == "loan_office" and len(remaining) == 1 and LANDMARKS[next_landmark]["cost"] - player["coins"] <= 5:
            return {"type": "buy", "card": best}
        return {"type": "pass"}
    if next_landmark in ("harbor", "train_station") and player["coins"] >= LANDMARKS[next_landmark]["cost"]:
        return {"type": "build", "landmark": next_landmark}
    if best and _card_value(state, bot_id, best) > 0:
        return {"type": "buy", "card": best}
    if player["coins"] >= LANDMARKS[next_landmark]["cost"]:
        return {"type": "build", "landmark": next_landmark}
    return {"type": "pass"}
