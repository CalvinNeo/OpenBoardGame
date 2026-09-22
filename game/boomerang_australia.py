"""Simultaneous drafting and scoring for Boomerang: Australia."""

import copy
import random
from collections import Counter
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

from game.boomerang_australia_data import (
    ACTIVITIES,
    ACTIVITY_POINTS,
    ANIMAL_VALUES,
    CARDS,
    COLLECTION_VALUES,
    REGIONS,
)


def _action_schema(action_type: str, properties: Dict) -> Dict:
    fields = {"type": {"const": action_type}, "round": {"type": "integer", "minimum": 1, "maximum": 4}, **properties}
    return {"type": "object", "properties": fields, "required": list(fields), "additionalProperties": False}


ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        _action_schema("draft_card", {"card_id": {"type": "string", "enum": list(CARDS)}, "pick": {"type": "integer", "minimum": 1, "maximum": 6}}),
        _action_schema("choose_activity", {"activity": {"enum": [None, *ACTIVITIES]}}),
        _action_schema("next_round", {}),
    ],
}
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {"direction_variant": {"type": "boolean", "default": False}, "seed": {"type": "integer"}},
    "additionalProperties": False,
}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _as_tuple(value):
    return tuple(_as_tuple(item) for item in value) if isinstance(value, (list, tuple)) else value


def _json_random_state(rng: random.Random) -> List:
    version, numbers, gaussian = rng.getstate()
    return [version, list(numbers), gaussian]


def _shuffle(state: Dict, cards: List[str]) -> None:
    rng = random.Random()
    rng.setstate(_as_tuple(state["rng_state"]))
    rng.shuffle(cards)
    state["rng_state"] = _json_random_state(rng)


def _direction(state: Dict) -> str:
    if len(state["turn_order"]) > 2 and state["config"]["direction_variant"] and state["round"] % 2 == 0:
        return "right"
    return "left"


def collection_points(cards: List[Dict]) -> int:
    """Score this round's collection icons, including the seven-point threshold."""
    value = sum(COLLECTION_VALUES.get(card.get("collection"), 0) for card in cards)
    return value * 2 if value <= 7 else value


def animal_points(cards: List[Dict]) -> int:
    """Every pair scores independently; unmatched animals do not score."""
    counts = Counter(card.get("animal") for card in cards)
    return sum((counts[animal] // 2) * value for animal, value in ANIMAL_VALUES.items())


def activity_points(count: int) -> int:
    return ACTIVITY_POINTS[min(count, len(ACTIVITY_POINTS) - 1)]


def _start_round(state: Dict) -> None:
    # Unused cards stay on top, in their existing order. Only used cards shuffle.
    used = [card_id for pid in state["turn_order"] for card_id in state["players"][pid]["cards"]]
    if state["round"] == 1:
        deck = list(CARDS)
        _shuffle(state, deck)
    else:
        _shuffle(state, used)
        deck = state["undealt"] + used
    for pid in state["turn_order"]:
        pdata = state["players"][pid]
        pdata["hand"] = []
        pdata["cards"] = []
    # Deal one card per seat per pass so reserved undealt cards are distributed.
    for _ in range(7):
        for pid in state["turn_order"]:
            state["players"][pid]["hand"].append(deck.pop(0))
    state["undealt"] = deck
    state["pending_cards"] = {}
    state["pending_activities"] = {}
    state["next_ready"] = []
    state["round_summary"] = []
    state["pick"] = 1
    state["phase"] = "draft"
    state["log"].append(f"Round {state['round']}: draft seven destinations; pass {_direction(state)}.")


def _resolve_draft(state: Dict) -> None:
    order = state["turn_order"]
    remaining = {}
    for pid in order:
        card_id = state["pending_cards"][pid]
        pdata = state["players"][pid]
        pdata["cards"].append(card_id)
        remaining[pid] = [item for item in pdata["hand"] if item != card_id]
    step = 1 if _direction(state) == "left" else -1
    for index, pid in enumerate(order):
        recipient = order[(index + step) % len(order)]
        state["players"][recipient]["hand"] = remaining[pid]
    state["pending_cards"] = {}
    if state["pick"] == 6:
        for pid in order:
            pdata = state["players"][pid]
            pdata["cards"].extend(pdata["hand"])
            pdata["hand"] = []
        state["phase"] = "choose_activity"
        state["log"].append(f"Round {state['round']}: all Throw cards revealed; Catch cards received.")
    else:
        state["pick"] += 1


def _round_previews(state: Dict) -> Dict:
    previews = {}
    for pid in state["turn_order"]:
        pdata = state["players"][pid]
        cards = [CARDS[card_id] for card_id in pdata["cards"]]
        visited = set(pdata["visited"])
        new_sites = [card_id for card_id in pdata["cards"] if card_id not in visited]
        complete = visited | set(new_sites)
        new_regions = [
            region for region, details in REGIONS.items()
            if region not in state["region_claims"] and set(details["cards"]) <= complete
        ]
        previews[pid] = {
            "throw_catch": abs(cards[0]["number"] - cards[-1]["number"]),
            "collections": collection_points(cards),
            "animals": animal_points(cards),
            "new_sites": new_sites,
            "new_regions": new_regions,
        }
    return previews


def _finish_round(state: Dict) -> None:
    # Calculate all completions before awarding any region: same-round ties share it.
    previews = _round_previews(state)
    summary = []
    for pid in state["turn_order"]:
        pdata = state["players"][pid]
        activity = state["pending_activities"][pid]
        count = sum(CARDS[card_id]["activity"] == activity for card_id in pdata["cards"]) if activity else 0
        points = activity_points(count) if activity else 0
        score = {"round": state["round"], **previews[pid], "activity": activity, "activity_score": points}
        score["round_points"] = (
            score["throw_catch"] + score["collections"] + score["animals"] + points
            + len(score["new_sites"]) + 3 * len(score["new_regions"])
        )
        score["cards"] = list(pdata["cards"])
        pdata["visited"].extend(score["new_sites"])
        pdata["region_bonuses"].extend(score["new_regions"])
        if activity is not None:
            pdata["activities"][activity] = points
        pdata["scores"].append(score)
        pdata["total"] += score["round_points"]
        summary.append({"player_id": pid, **copy.deepcopy(score)})
    for region in REGIONS:
        winners = [pid for pid in state["turn_order"] if region in previews[pid]["new_regions"]]
        if winners:
            state["region_claims"][region] = {"round": state["round"], "players": winners}
    state["round_summary"] = summary
    state["next_ready"] = []
    state["phase"] = "round_end"
    state["log"].append(f"Round {state['round']} scored. Every player must confirm the review.")


def _finish_game(state: Dict) -> None:
    def ranking(pid: str) -> Tuple[int, int]:
        pdata = state["players"][pid]
        return pdata["total"], sum(score["throw_catch"] for score in pdata["scores"])

    best = max(ranking(pid) for pid in state["turn_order"])
    state["winner"] = [pid for pid in state["turn_order"] if ranking(pid) == best]
    state["phase"] = "game_over"
    state["game_over"] = True
    state["log"].append("The four-round journey is complete.")


def _validate_saved_state(state: Dict) -> None:
    """Reject malformed saves before they can enter the room's live state."""
    def require(condition: bool) -> None:
        if not condition:
            raise ValueError("invalid Boomerang Australia saved state")

    def unique_ids(value: List, allowed) -> bool:
        return isinstance(value, list) and all(isinstance(item, str) and item in allowed for item in value) and len(value) == len(set(value))

    try:
        require(isinstance(state, dict) and state["game_id"] == "boomerang_australia" and state["version"] == 1)
        order = state["turn_order"]
        require(unique_ids(order, order) and 2 <= len(order) <= 4 and all(order))
        require(set(state["players"]) == set(order) and set(state["player_meta"]) == set(order))
        require(type(state["round"]) is int and 1 <= state["round"] <= 4)
        require(type(state["pick"]) is int and 1 <= state["pick"] <= 6)
        phase = state["phase"]
        require(phase in ("draft", "choose_activity", "round_end", "game_over"))
        require(type(state["game_over"]) is bool and state["game_over"] == (phase == "game_over"))
        require(state["current_turn"] is None)
        require(state["config"] == {"direction_variant": state["config"]["direction_variant"]})
        require(type(state["config"]["direction_variant"]) is bool)
        require(unique_ids(state["next_ready"], order))
        require(unique_ids(state["winner"], order) and bool(state["winner"]) == state["game_over"])
        require(isinstance(state["pending_cards"], dict) and set(state["pending_cards"]) <= set(order))
        require(isinstance(state["pending_activities"], dict) and set(state["pending_activities"]) <= set(order))
        require(all(value is None or value in ACTIVITIES for value in state["pending_activities"].values()))
        require(unique_ids(state["undealt"], CARDS) and len(state["undealt"]) == 28 - 7 * len(order))
        require(isinstance(state["log"], list) and all(isinstance(line, str) for line in state["log"]))
        require(isinstance(state["round_summary"], list))
        rng = random.Random()
        rng.setstate(_as_tuple(state["rng_state"]))
        all_cards = list(state["undealt"])
        scored_rounds = state["round"] - (phase in ("draft", "choose_activity"))
        for pid in order:
            meta = state["player_meta"][pid]
            require(isinstance(meta, dict) and meta.get("player_id", pid) == pid)
            require("name" not in meta or isinstance(meta["name"], str))
            require("seat" not in meta or type(meta["seat"]) is int)
            require("is_bot" not in meta or type(meta["is_bot"]) is bool)
            pdata = state["players"][pid]
            require(unique_ids(pdata["hand"], CARDS) and unique_ids(pdata["cards"], CARDS))
            expected_cards = state["pick"] - 1 if phase == "draft" else 7
            require(len(pdata["cards"]) == expected_cards and len(pdata["hand"]) == 7 - expected_cards)
            all_cards.extend(pdata["hand"] + pdata["cards"])
            require(unique_ids(pdata["visited"], CARDS) and unique_ids(pdata["region_bonuses"], REGIONS))
            require(isinstance(pdata["activities"], dict) and set(pdata["activities"]) <= set(ACTIVITIES))
            require(all(type(points) is int and points in ACTIVITY_POINTS for points in pdata["activities"].values()))
            require(isinstance(pdata["scores"], list) and len(pdata["scores"]) == scored_rounds)
            require(type(pdata["total"]) is int and pdata["total"] >= 0)
            scored_sites, scored_regions, scored_activities = [], [], {}
            for index, score in enumerate(pdata["scores"], 1):
                require(score["round"] == index and unique_ids(score["cards"], CARDS) and len(score["cards"]) == 7)
                require(unique_ids(score["new_sites"], score["cards"]) and unique_ids(score["new_regions"], REGIONS))
                require(all(type(score[key]) is int and score[key] >= 0 for key in ("throw_catch", "collections", "animals", "activity_score", "round_points")))
                require(score["round_points"] == score["throw_catch"] + score["collections"] + score["animals"] + score["activity_score"] + len(score["new_sites"]) + 3 * len(score["new_regions"]))
                activity = score["activity"]
                require(activity is None or activity in ACTIVITIES and activity not in scored_activities)
                if activity is not None:
                    scored_activities[activity] = score["activity_score"]
                scored_sites.extend(score["new_sites"])
                scored_regions.extend(score["new_regions"])
            require(pdata["visited"] == scored_sites and pdata["region_bonuses"] == scored_regions and pdata["activities"] == scored_activities)
            require(pdata["total"] == sum(score["round_points"] for score in pdata["scores"]))
            if pid in state["pending_cards"]:
                require(state["pending_cards"][pid] in pdata["hand"])
            if phase == "choose_activity" and pid in state["pending_activities"]:
                require(state["pending_activities"][pid] not in pdata["activities"])
        require(len(all_cards) == 28 and set(all_cards) == set(CARDS))
        if phase == "draft":
            require(len(state["pending_cards"]) < len(order) and not state["pending_activities"] and not state["next_ready"] and not state["round_summary"])
        else:
            require(state["pick"] == 6 and not state["pending_cards"])
            if phase == "choose_activity":
                require(len(state["pending_activities"]) < len(order) and not state["next_ready"] and not state["round_summary"])
            else:
                require(set(state["pending_activities"]) == set(order) and len(state["round_summary"]) == len(order))
                require(phase != "round_end" or len(state["next_ready"]) < len(order))
                require(phase != "game_over" or state["round"] == 4 and set(state["next_ready"]) == set(order))
        require(isinstance(state["region_claims"], dict) and set(state["region_claims"]) <= set(REGIONS))
        for region, claim in state["region_claims"].items():
            require(type(claim["round"]) is int and 1 <= claim["round"] <= scored_rounds)
            require(unique_ids(claim["players"], order) and bool(claim["players"]))
            require(set(claim["players"]) == {pid for pid in order if region in state["players"][pid]["region_bonuses"]})
        require(set(state["region_claims"]) == {region for pid in order for region in state["players"][pid]["region_bonuses"]})
    except (KeyError, TypeError, IndexError, AttributeError, OverflowError) as error:
        raise ValueError("invalid Boomerang Australia saved state") from error


def choose_bot_action(view: Dict) -> Optional[Dict]:
    """Choose only from the same filtered information available to this player."""
    legal = view["legal_actions"]
    if not legal:
        return None
    if "next_round" in legal:
        return {"type": "next_round", "round": view["round"]}
    if "choose_activity" in legal:
        options = [item for item in view["activity_options"] if not item["used"]]
        best = max(options, key=lambda item: (item["points"], item["count"]), default=None)
        # Preserve low-value activities for a later round; the final round uses the best.
        activity = best["id"] if best and (best["points"] >= 4 or view["round"] == 4) else None
        return {"type": "choose_activity", "activity": activity, "round": view["round"]}
    if "draft_card" not in legal or not view["hand"]:
        return None
    own = next(item for item in view["players"] if item["player_id"] == view["you"])
    cards = [card for card in own["cards"] if card]
    visited = set(own["visited"]) | {card["id"] for card in cards}
    animals = Counter(card["animal"] for card in cards)
    activities = Counter(card["activity"] for card in cards)

    def desirability(card: Dict) -> Tuple[float, str]:
        score = 1.5 if card["id"] not in visited else 0.0
        region = view["regions"][card["region"]]
        if card["region"] not in view.get("region_claims", {}):
            progress = len(set(region["cards"]) & visited)
            if card["id"] not in visited:
                score += (0.3, 0.7, 1.2, 3.0)[min(progress, 3)]
        score += (collection_points(cards + [card]) - collection_points(cards)) * 0.8
        animal = card["animal"]
        if animal:
            score += ANIMAL_VALUES[animal] * (0.8 if animals[animal] % 2 else 0.18)
        activity = card["activity"]
        if activity and activity not in own["activities"]:
            score += (activity_points(activities[activity] + 1) - activity_points(activities[activity])) * 0.7 + 0.25
        if not cards:
            # Extreme Throw numbers have a better expected distance from unknown Catch.
            score += abs(card["number"] - 4) * 0.3
        return score, card["id"]

    chosen = max(view["hand"], key=desirability)
    return {"type": "draft_card", "card_id": chosen["id"], "round": view["round"], "pick": view["pick"]}


class BoomerangAustraliaGame:
    game_id = "boomerang_australia"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = {} if config is None else copy.deepcopy(config)
        if not _CONFIG_VALIDATOR.is_valid(cfg) or ("seed" in cfg and type(cfg["seed"]) is not int):
            raise ValueError("invalid Boomerang Australia configuration")
        if not 2 <= len(players) <= 4:
            raise ValueError("Boomerang Australia requires 2–4 players")
        order = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in order]
        if len(set(ids)) != len(ids) or any(not isinstance(pid, str) or not pid for pid in ids):
            raise ValueError("player IDs must be unique nonempty strings")
        rng = random.Random(cfg.get("seed"))
        state = {
            "game_id": BoomerangAustraliaGame.game_id,
            "version": 1,
            "config": {"direction_variant": cfg.get("direction_variant", False)},
            "rng_state": _json_random_state(rng),
            "turn_order": ids,
            "current_turn": None,
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in order},
            "players": {pid: {"hand": [], "cards": [], "visited": [], "region_bonuses": [], "activities": {}, "scores": [], "total": 0} for pid in ids},
            "round": 1,
            "phase": "draft",
            "pick": 1,
            "undealt": [],
            "region_claims": {},
            "pending_cards": {},
            "pending_activities": {},
            "next_ready": [],
            "round_summary": [],
            "winner": [],
            "game_over": False,
            "log": [],
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id not in state["players"]:
            return []
        if state["phase"] == "draft" and player_id not in state["pending_cards"]:
            return ["draft_card"]
        if state["phase"] == "choose_activity" and player_id not in state["pending_activities"]:
            return ["choose_activity"]
        if state["phase"] == "round_end" and player_id not in state["next_ready"]:
            return ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if type(action["round"]) is not int or ("pick" in action and type(action["pick"]) is not int):
            return [], "round and pick must be integers"
        if player_id not in state["players"]:
            return [], "player not found"
        if state["game_over"]:
            return [], "game is over"
        if action["round"] != state["round"]:
            return [], "stale round"
        action_type = action["type"]
        if action_type == "next_round" and state["phase"] == "round_end" and player_id in state["next_ready"]:
            return [], None
        if action_type not in BoomerangAustraliaGame.get_legal_actions(state, player_id):
            return [], "action unavailable in this phase or already submitted"
        if action_type == "draft_card":
            if action["pick"] != state["pick"]:
                return [], "stale pick"
            if action["card_id"] not in state["players"][player_id]["hand"]:
                return [], "card is not in your hand"
            state["pending_cards"][player_id] = action["card_id"]
            if len(state["pending_cards"]) == len(state["turn_order"]):
                _resolve_draft(state)
        elif action_type == "choose_activity":
            activity = action["activity"]
            if activity is not None and activity in state["players"][player_id]["activities"]:
                return [], "activity already used"
            state["pending_activities"][player_id] = activity
            if len(state["pending_activities"]) == len(state["turn_order"]):
                _finish_round(state)
        else:
            state["next_ready"].append(player_id)
            if len(state["next_ready"]) == len(state["turn_order"]):
                if state["round"] == 4:
                    _finish_game(state)
                else:
                    state["round"] += 1
                    _start_round(state)
        # A submitted card and an uncommitted activity never appear in broadcasts.
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        viewer = state["players"].get(viewer_id)
        reveal_throw = state["phase"] != "draft"
        previews = _round_previews(state) if state["phase"] == "choose_activity" else {}
        players_view = []
        for index, pid in enumerate(state["turn_order"]):
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            cards = [CARDS[card_id] if reveal_throw or pid == viewer_id or position != 0 else None for position, card_id in enumerate(pdata["cards"])]
            submitted = pid in state["pending_cards"] if state["phase"] == "draft" else pid in state["pending_activities"] if state["phase"] == "choose_activity" else pid in state["next_ready"]
            players_view.append({
                "player_id": pid, "name": meta.get("name", pid), "seat": meta.get("seat", index), "is_bot": bool(meta.get("is_bot", False)),
                "submitted": submitted, "hand_count": len(pdata["hand"]), "cards": cards,
                "visited": pdata["visited"], "region_bonuses": pdata["region_bonuses"], "activities": pdata["activities"],
                "scores": pdata["scores"], "total": pdata["total"], "preview": previews.get(pid),
            })
        counts = Counter(CARDS[card_id]["activity"] for card_id in viewer["cards"]) if viewer else Counter()
        options = [{"id": activity, "count": counts[activity], "points": activity_points(counts[activity]), "used": activity in viewer["activities"]} for activity in ACTIVITIES] if viewer else []
        return copy.deepcopy({
            "game_id": BoomerangAustraliaGame.game_id,
            "phase": state["phase"], "round": state["round"], "pick": state["pick"], "direction": _direction(state),
            "you": viewer_id, "game_over": state["game_over"], "winner": state["winner"],
            "players": players_view, "hand": [CARDS[card_id] for card_id in viewer["hand"]] if viewer else [],
            "pending_card": state["pending_cards"].get(viewer_id), "pending_activity": state["pending_activities"].get(viewer_id),
            "activity_options": options, "legal_actions": BoomerangAustraliaGame.get_legal_actions(state, viewer_id),
            "next_ready": state["next_ready"], "regions": REGIONS, "catalog": CARDS, "region_claims": state["region_claims"],
            "log": state["log"], "config": state["config"], "round_summary": state["round_summary"],
            "activity_points": list(ACTIVITY_POINTS), "collection_values": COLLECTION_VALUES, "animal_values": ANIMAL_VALUES,
        })

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return choose_bot_action(BoomerangAustraliaGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        restored = copy.deepcopy(payload)
        _validate_saved_state(restored)
        return restored
