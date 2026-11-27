import copy
import itertools
import json
import math
import random
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


CATALOG = json.loads((Path(__file__).parent / "assets/bag_of_chips/catalog.json").read_text())
COLORS = tuple(entry["id"] for entry in CATALOG["colors"])
TOTALS = {entry["id"]: entry["count"] for entry in CATALOG["colors"]}
OBJECTIVES = {entry["id"]: entry for entry in CATALOG["objectives"]}
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {"seed": {"type": "integer"}},
    "additionalProperties": False,
}
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"enum": ["discard", "place", "reveal_last", "next_round", "confirm_end", "play_again"]},
        "round": {"type": "integer", "minimum": 1},
        "step": {"type": "integer", "minimum": 1},
        "cards": {"type": "array", "items": {"type": "integer", "minimum": 1, "maximum": 36},
                  "uniqueItems": True, "minItems": 1, "maxItems": 2},
    },
    "required": ["type", "round", "step"],
    "additionalProperties": False,
}
ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def objective_value(card: Dict, counts: Dict[str, int], last: Optional[str]) -> Tuple[bool, int]:
    kind = card["kind"]
    colors = card.get("colors", [])
    if kind == "each":
        success = all(counts.get(color, 0) >= card["amount"] for color in COLORS)
    elif kind == "minimum":
        success = all(counts.get(color, 0) >= amount for color, amount in card["needs"].items())
    elif kind == "equal":
        success = counts.get(colors[0], 0) == counts.get(colors[1], 0)
    elif kind == "last":
        success = last == colors[0]
    elif kind == "absent":
        success = counts.get(colors[0], 0) == 0
    elif kind == "per":
        success = counts.get(colors[0], 0) > 0
    else:
        success = counts.get(colors[0], 0) > counts.get(colors[1], 0)
    points = card["points"] or 0
    if kind == "per":
        points *= counts.get(colors[0], 0)
    return success, points if success else 0


@lru_cache(maxsize=512)
def expected_objectives(observed: Tuple[int, ...]) -> Dict[int, Tuple[float, float]]:
    remaining = tuple(TOTALS[color] - observed[index] for index, color in enumerate(COLORS))
    draws = 14 - sum(observed)
    denominator = math.comb(sum(remaining), draws)
    values = {card_id: [0.0, 0.0] for card_id in OBJECTIVES}
    ranges = [range(min(amount, draws) + 1) for amount in remaining]
    for addition in itertools.product(*ranges):
        if sum(addition) != draws:
            continue
        weight = math.prod(math.comb(amount, taken) for amount, taken in zip(remaining, addition)) / denominator
        counts = {color: observed[index] + addition[index] for index, color in enumerate(COLORS)}
        for card_id, card in OBJECTIVES.items():
            if card["kind"] == "last":
                probability = addition[COLORS.index(card["colors"][0])] / draws
                values[card_id][0] += weight * probability
                values[card_id][1] += weight * probability * card["points"]
            else:
                success, points = objective_value(card, counts, None)
                values[card_id][0] += weight * success
                values[card_id][1] += weight * points
    return {card_id: tuple(value) for card_id, value in values.items()}


def _random(state: Dict) -> random.Random:
    generator = random.Random()
    saved = state["random_state"]
    generator.setstate((saved[0], tuple(saved[1]), saved[2]))
    return generator


def _start_round(state: Dict) -> None:
    generator = _random(state)
    bag = [color for color, amount in TOTALS.items() for unused in range(amount)]
    deck = list(OBJECTIVES)
    generator.shuffle(bag)
    generator.shuffle(deck)
    state.update(bag=bag, drawn=[], phase=1, stage="discard", submitted=[], ready=[], summary=None)
    state["step"] += 1
    state["random_state"] = generator.getstate()
    for player in state["players"].values():
        player.update(hand=deck[:6], discarded=[], negative=None, positive=[], round_score=None)
        del deck[:6]
    state["drawn"] = [state["bag"].pop() for unused in range(5)]


def _settle(state: Dict) -> None:
    counts = Counter(state["drawn"])
    rows = []
    instant = []
    for player_id, player in state["players"].items():
        breakdown = []
        lost = False
        for card_id in [player["negative"]] + player["positive"]:
            card = OBJECTIVES[card_id]
            success, points = objective_value(card, counts, state["drawn"][-1])
            negative = card_id == player["negative"]
            skipped = lost and not negative
            if skipped:
                points = 0
            if success and card.get("special"):
                if negative:
                    lost = True
                else:
                    instant.append(player_id)
            breakdown.append({"card": copy.deepcopy(card), "negative": negative, "success": success,
                              "points": -points if negative else points, "skipped": skipped})
        score = sum(item["points"] for item in breakdown)
        player["round_score"] = score
        rows.append({"player_id": player_id, "name": state["player_meta"][player_id]["name"],
                     "cards": breakdown, "score": score, "lost": lost, "awarded": 0})
    if instant:
        state["winners"] = instant
    else:
        eligible = sorted((row for row in rows if not row["lost"]), key=lambda row: row["score"], reverse=True)
        if eligible:
            firsts = [row for row in eligible if row["score"] == eligible[0]["score"]]
            for row in firsts:
                row["awarded"] = 1 if len(rows) == 2 else 2
            if len(firsts) == 1 and len(rows) > 2 and len(eligible) > 1:
                for row in eligible[1:]:
                    if row["score"] == eligible[1]["score"]:
                        row["awarded"] = 1
        for row in rows:
            state["players"][row["player_id"]]["rewards"] += row["awarded"]
        ranking = sorted(rows, key=lambda row: (state["players"][row["player_id"]]["rewards"],
                                                not row["lost"], row["score"]), reverse=True)
        best = ranking[0]
        if state["players"][best["player_id"]]["rewards"] >= state["target"]:
            tied = [row for row in ranking
                    if (state["players"][row["player_id"]]["rewards"], row["lost"], row["score"])
                    == (state["players"][best["player_id"]]["rewards"], best["lost"], best["score"])]
            if len(tied) == 1:
                state["winners"] = [best["player_id"]]
    for row in rows:
        row["rewards"] = state["players"][row["player_id"]]["rewards"]
    state["summary"] = {"round": state["round"], "rows": rows, "instant": bool(instant)}
    state["history"].append(copy.deepcopy(state["summary"]))
    state["stage"] = "final_review" if state["winners"] else "round_over"
    state["ready"] = []


class BagOfChipsGame:
    game_id = "bag_of_chips"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("Invalid Bag of Chips configuration")
        if not 2 <= len(players) <= 6 or len({player["player_id"] for player in players}) != len(players):
            raise ValueError("Bag of Chips needs 2–6 distinct players")
        generator = random.Random(config.get("seed"))
        state = {"game_id": "bag_of_chips", "players": {player["player_id"]: {"rewards": 0} for player in players},
                 "player_meta": copy.deepcopy({player["player_id"]: player for player in players}),
                 "turn_order": [player["player_id"] for player in players], "round": 1, "step": 0,
                 "target": 3 if len(players) == 2 else 4, "game_over": False,
                 "winners": [], "history": [], "config": copy.deepcopy(config), "random_state": generator.getstate()}
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"]:
            return []
        stage = state["stage"]
        if stage in ("discard", "place"):
            return [] if player_id in state["submitted"] else [stage]
        if stage == "game_over":
            return ["play_again"]
        if player_id in state["ready"]:
            return []
        return [{"reveal": "reveal_last", "round_over": "next_round", "final_review": "confirm_end"}[stage]]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict, rng: Optional[random.Random] = None) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action"
        if action["round"] != state["round"] or action["step"] != state["step"]:
            return [], "The table has changed. Please choose again."
        action_type = action["type"]
        if action_type not in BagOfChipsGame.get_legal_actions(state, player_id):
            return [], "This action is not available"
        player = state["players"][player_id]
        cards = action.get("cards", [])
        if action_type in ("discard", "place"):
            required = 2 if action_type == "discard" and state["phase"] == 1 else 1
            if len(cards) != required or any(card not in player["hand"] for card in cards):
                return [], f"Select {required} card(s) from your hand"
            if action_type == "discard":
                player["hand"] = [card for card in player["hand"] if card not in cards]
                player["discarded"].extend(cards)
            else:
                player["negative"] = cards[0]
                player["positive"] = [card for card in player["hand"] if card != cards[0]]
            state["submitted"].append(player_id)
            if len(state["submitted"]) == len(state["players"]):
                state["phase"] += 1
                draw_count = {2: 4, 3: 3, 4: 1}[state["phase"]]
                state["drawn"].extend(state["bag"].pop() for unused in range(draw_count))
                state["stage"] = "discard" if state["phase"] == 2 else "place" if state["phase"] == 3 else "reveal"
                state["submitted"] = []
                state["step"] += 1
        elif cards:
            return [], "This action does not accept cards"
        elif action_type == "play_again":
            fresh = BagOfChipsGame.init_game({}, list(state["player_meta"].values()))
            fresh["step"] = state["step"] + 1
            state.clear()
            state.update(fresh)
        else:
            state["ready"].append(player_id)
            if len(state["ready"]) == len(state["players"]):
                state["step"] += 1
                if action_type == "reveal_last":
                    state["drawn"].append(state["bag"].pop())
                    _settle(state)
                elif action_type == "next_round":
                    state["round"] += 1
                    _start_round(state)
                else:
                    state["stage"] = "game_over"
                    state["game_over"] = True
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        revealed = state["stage"] not in ("discard", "place")
        players = []
        for player_id, player in state["players"].items():
            meta = state["player_meta"][player_id]
            players.append({"player_id": player_id, "name": meta.get("name", "Player"),
                            "seat": meta.get("seat"), "is_bot": bool(meta.get("is_bot")),
                            "rewards": player["rewards"], "round_score": player["round_score"],
                            "submitted": player_id in state["submitted"], "ready": player_id in state["ready"],
                            "hand_count": len(player["hand"]), "discard_count": len(player["discarded"]),
                            "hand": [copy.deepcopy(OBJECTIVES[card]) for card in player["hand"]]
                            if viewer_id == player_id else [],
                            "discarded": [copy.deepcopy(OBJECTIVES[card]) for card in player["discarded"]]
                            if viewer_id == player_id else [],
                            "negative": copy.deepcopy(OBJECTIVES[player["negative"]])
                            if player["negative"] and (revealed or viewer_id == player_id) else None,
                            "positive": [copy.deepcopy(OBJECTIVES[card]) for card in player["positive"]]
                            if revealed or viewer_id == player_id else []})
        return {"game_id": "bag_of_chips", "you": viewer_id, "round": state["round"], "step": state["step"],
                "phase": state["phase"], "stage": state["stage"], "players": players,
                "drawn": list(state["drawn"]), "bag_count": len(state["bag"]), "target": state["target"],
                "colors": copy.deepcopy(CATALOG["colors"]), "summary": copy.deepcopy(state["summary"]),
                "history": copy.deepcopy(state["history"]), "winners": list(state["winners"]),
                "game_over": state["game_over"], "legal_actions": BagOfChipsGame.get_legal_actions(state, viewer_id)}

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = BagOfChipsGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        action = {"type": legal[0], "round": state["round"], "step": state["step"]}
        if legal[0] not in ("discard", "place"):
            return action
        observed = Counter(state["drawn"])
        estimates = expected_objectives(tuple(observed[color] for color in COLORS))
        hand = state["players"][bot_id]["hand"]

        def utility(kept: Tuple[int, ...]) -> Tuple[float, int]:
            alternatives = []
            for negative in kept:
                value = sum((-1 if card_id == negative else 1) * estimates[card_id][1] for card_id in kept)
                for card_id in kept:
                    if OBJECTIVES[card_id].get("special"):
                        value += (-1200 if card_id == negative else 1600) * estimates[card_id][0]
                alternatives.append((value, negative))
            return max(alternatives)

        if legal[0] == "place":
            action["cards"] = [utility(tuple(hand))[1]]
        else:
            amount = 2 if state["phase"] == 1 else 1
            choices = itertools.combinations(hand, len(hand) - amount)
            kept = max(choices, key=lambda choice: utility(choice)[0])
            action["cards"] = [card for card in hand if card not in kept]
        return action

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
