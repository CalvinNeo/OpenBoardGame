import random
from collections import Counter
from typing import Dict, List, Optional, Tuple

CATEGORY_ORDER = [
    "ones",
    "twos",
    "threes",
    "fours",
    "fives",
    "sixes",
    "three_kind",
    "four_kind",
    "full_house",
    "small_straight",
    "large_straight",
    "yahtzee",
    "chance",
]

CATEGORY_LABELS = {
    "ones": "Ones",
    "twos": "Twos",
    "threes": "Threes",
    "fours": "Fours",
    "fives": "Fives",
    "sixes": "Sixes",
    "three_kind": "Three of a Kind",
    "four_kind": "Four of a Kind",
    "full_house": "Full House",
    "small_straight": "Small Straight",
    "large_straight": "Large Straight",
    "yahtzee": "Yahtzee",
    "chance": "Chance",
}

UPPER_CATEGORIES = CATEGORY_ORDER[:6]
LOWER_CATEGORIES = CATEGORY_ORDER[6:]

UPPER_VALUE_TO_CATEGORY = {
    1: "ones",
    2: "twos",
    3: "threes",
    4: "fours",
    5: "fives",
    6: "sixes",
}

DEFAULT_CONFIG: Dict = {}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _roll_die() -> int:
    return random.randint(1, 6)


def _roll_dice(dice: List[int], locked: List[bool], force_all: bool = False) -> None:
    for idx in range(len(dice)):
        if force_all or not locked[idx]:
            dice[idx] = _roll_die()


def _is_yahtzee(dice: List[int]) -> bool:
    return len(set(dice)) == 1 and dice[0] != 0


def _sum_dice(dice: List[int]) -> int:
    return sum(dice)


def _upper_score(dice: List[int], value: int) -> int:
    return sum(d for d in dice if d == value)


def _score_three_kind(dice: List[int]) -> int:
    counts = Counter(dice)
    if max(counts.values(), default=0) >= 3:
        return _sum_dice(dice)
    return 0


def _score_four_kind(dice: List[int]) -> int:
    counts = Counter(dice)
    if max(counts.values(), default=0) >= 4:
        return _sum_dice(dice)
    return 0


def _score_full_house(dice: List[int]) -> int:
    counts = sorted(Counter(dice).values())
    if counts == [5] or counts == [2, 3]:
        return 25
    return 0


def _score_small_straight(dice: List[int]) -> int:
    unique = set(dice)
    sequences = [
        {1, 2, 3, 4},
        {2, 3, 4, 5},
        {3, 4, 5, 6},
    ]
    for seq in sequences:
        if seq.issubset(unique):
            return 30
    return 0


def _score_large_straight(dice: List[int]) -> int:
    unique = sorted(set(dice))
    if unique == [1, 2, 3, 4, 5] or unique == [2, 3, 4, 5, 6]:
        return 40
    return 0


def _score_yahtzee(dice: List[int]) -> int:
    if _is_yahtzee(dice):
        return 50
    return 0


def _score_category(dice: List[int], category: str) -> int:
    if category == "ones":
        return _upper_score(dice, 1)
    if category == "twos":
        return _upper_score(dice, 2)
    if category == "threes":
        return _upper_score(dice, 3)
    if category == "fours":
        return _upper_score(dice, 4)
    if category == "fives":
        return _upper_score(dice, 5)
    if category == "sixes":
        return _upper_score(dice, 6)
    if category == "three_kind":
        return _score_three_kind(dice)
    if category == "four_kind":
        return _score_four_kind(dice)
    if category == "full_house":
        return _score_full_house(dice)
    if category == "small_straight":
        return _score_small_straight(dice)
    if category == "large_straight":
        return _score_large_straight(dice)
    if category == "yahtzee":
        return _score_yahtzee(dice)
    if category == "chance":
        return _sum_dice(dice)
    return 0


def _joker_state(dice: List[int], score_sheet: Dict[str, Optional[int]]) -> Optional[Dict]:
    if not _is_yahtzee(dice):
        return None
    if score_sheet.get("yahtzee") != 50:
        return None
    face = dice[0]
    upper_category = UPPER_VALUE_TO_CATEGORY.get(face)
    if upper_category and score_sheet.get(upper_category) is None:
        return {"mode": "forced_upper", "forced": upper_category, "face": face}
    lower_empty = [cat for cat in LOWER_CATEGORIES if score_sheet.get(cat) is None]
    if lower_empty:
        return {
            "mode": "lower_choice",
            "allowed": lower_empty,
            "face": face,
            "upper": upper_category,
        }
    upper_empty = [cat for cat in UPPER_CATEGORIES if score_sheet.get(cat) is None]
    if upper_empty:
        return {
            "mode": "forced_zero",
            "allowed": upper_empty,
            "face": face,
            "upper": upper_category,
        }
    return None


def _joker_lower_score(category: str, dice: List[int]) -> int:
    if category == "full_house":
        return 25
    if category == "small_straight":
        return 30
    if category == "large_straight":
        return 40
    if category in ("three_kind", "four_kind", "chance"):
        return _sum_dice(dice)
    return _score_category(dice, category)


def _allowed_categories(dice: List[int], score_sheet: Dict[str, Optional[int]]) -> Tuple[List[str], Optional[Dict]]:
    empty = [cat for cat in CATEGORY_ORDER if score_sheet.get(cat) is None]
    joker = _joker_state(dice, score_sheet)
    if not joker:
        return empty, None
    mode = joker.get("mode")
    if mode == "forced_upper":
        return [joker["forced"]], joker
    if mode == "lower_choice":
        return list(joker.get("allowed", [])), joker
    if mode == "forced_zero":
        return list(joker.get("allowed", [])), joker
    return empty, joker


def _calculate_possible_scores(dice: List[int], score_sheet: Dict[str, Optional[int]]) -> Tuple[Dict[str, int], List[str], Optional[Dict]]:
    allowed, joker = _allowed_categories(dice, score_sheet)
    scores: Dict[str, int] = {}
    if not allowed:
        return scores, allowed, joker
    if joker and joker.get("mode") == "forced_zero":
        for cat in allowed:
            scores[cat] = 0
        return scores, allowed, joker
    if joker and joker.get("mode") == "lower_choice":
        for cat in allowed:
            scores[cat] = _joker_lower_score(cat, dice)
        return scores, allowed, joker
    for cat in allowed:
        scores[cat] = _score_category(dice, cat)
    return scores, allowed, joker


def _upper_total(score_sheet: Dict[str, Optional[int]]) -> int:
    return sum(score_sheet.get(cat, 0) or 0 for cat in UPPER_CATEGORIES)


def _lower_total(score_sheet: Dict[str, Optional[int]]) -> int:
    return sum(score_sheet.get(cat, 0) or 0 for cat in LOWER_CATEGORIES)


def _upper_bonus(upper_total: int) -> int:
    return 35 if upper_total >= 63 else 0


def _score_sheet_complete(score_sheet: Dict[str, Optional[int]]) -> bool:
    return all(score_sheet.get(cat) is not None for cat in CATEGORY_ORDER)


def _total_score(player: Dict) -> int:
    upper = _upper_total(player["score_sheet"])
    lower = _lower_total(player["score_sheet"])
    bonus = _upper_bonus(upper)
    yahtzee_bonus = int(player.get("yahtzee_bonus", 0))
    return upper + lower + bonus + yahtzee_bonus


def _advance_turn(state: Dict) -> None:
    order = state["turn_order"]
    if not order:
        state["current_player"] = None
        return
    current = state["current_player"]
    if current not in order:
        state["current_player"] = order[0]
        return
    idx = order.index(current)
    next_idx = (idx + 1) % len(order)
    if next_idx == 0:
        state["current_round"] += 1
    state["current_player"] = order[next_idx]


def _reset_turn_state(state: Dict) -> None:
    state["dice"] = [0, 0, 0, 0, 0]
    state["locked"] = [False, False, False, False, False]
    state["roll_count"] = 0
    state["phase"] = "rolling"


class YahtzeeGame:
    game_id = "yahtzee"
    min_players = 1
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "score_sheet": {cat: None for cat in CATEGORY_ORDER},
                "yahtzee_bonus": 0,
            }

        state = {
            "players": state_players,
            "turn_order": player_ids,
            "current_player": player_ids[0] if player_ids else None,
            "current_round": 1,
            "dice": [0, 0, 0, 0, 0],
            "locked": [False, False, False, False, False],
            "roll_count": 0,
            "phase": "rolling",
            "config": cfg,
            "player_meta": player_meta,
            "winner": None,
            "game_over": False,
        }
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_player"):
            return []
        roll_count = int(state.get("roll_count", 0))
        if roll_count <= 0:
            return ["roll"]
        if roll_count < 3:
            return ["roll", "toggle_lock", "score"]
        return ["score"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state["players"]:
            return [], "unknown player"
        if state.get("game_over"):
            return [], "game over"
        if player_id != state.get("current_player"):
            return [], "not your turn"

        action_type = action.get("type")
        events: List[Dict] = []

        if action_type == "roll":
            roll_count = int(state.get("roll_count", 0))
            if roll_count >= 3:
                return [], "no rolls remaining"
            if roll_count == 0:
                state["locked"] = [False, False, False, False, False]
                _roll_dice(state["dice"], state["locked"], force_all=True)
            else:
                _roll_dice(state["dice"], state["locked"], force_all=False)
            state["roll_count"] = roll_count + 1
            state["phase"] = "scoring" if state["roll_count"] >= 3 else "rolling"
            events.append(
                {
                    "type": "yahtzee:roll",
                    "payload": {
                        "player_id": player_id,
                        "dice": list(state["dice"]),
                        "roll_count": state["roll_count"],
                    },
                }
            )
            return events, None

        if action_type == "toggle_lock":
            roll_count = int(state.get("roll_count", 0))
            if roll_count <= 0:
                return [], "roll first"
            if roll_count >= 3:
                return [], "cannot lock after final roll"
            try:
                index = int(action.get("index"))
            except (TypeError, ValueError):
                return [], "invalid index"
            if index < 0 or index >= len(state["locked"]):
                return [], "invalid index"
            state["locked"][index] = not state["locked"][index]
            events.append(
                {
                    "type": "yahtzee:toggle_lock",
                    "payload": {
                        "player_id": player_id,
                        "index": index,
                        "locked": state["locked"][index],
                    },
                }
            )
            return events, None

        if action_type == "score":
            roll_count = int(state.get("roll_count", 0))
            if roll_count <= 0:
                return [], "roll first"
            category = action.get("category")
            if category not in CATEGORY_ORDER:
                return [], "invalid category"
            pdata = state["players"][player_id]
            score_sheet = pdata["score_sheet"]
            if score_sheet.get(category) is not None:
                return [], "category already filled"

            scores, allowed, joker = _calculate_possible_scores(state["dice"], score_sheet)
            if category not in allowed:
                return [], "category not allowed"
            score = scores.get(category)
            if score is None:
                return [], "invalid score"
            score_sheet[category] = int(score)
            if joker:
                pdata["yahtzee_bonus"] = int(pdata.get("yahtzee_bonus", 0)) + 100
            events.append(
                {
                    "type": "yahtzee:score",
                    "payload": {
                        "player_id": player_id,
                        "category": category,
                        "score": score,
                        "yahtzee_bonus": pdata.get("yahtzee_bonus", 0),
                    },
                }
            )

            if all(_score_sheet_complete(p["score_sheet"]) for p in state["players"].values()):
                state["game_over"] = True
                state["phase"] = "game_over"
                scores_map = {pid: _total_score(pdata) for pid, pdata in state["players"].items()}
                max_score = max(scores_map.values()) if scores_map else 0
                state["winner"] = [pid for pid, total in scores_map.items() if total == max_score]
                return events, None

            _advance_turn(state)
            _reset_turn_state(state)
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(
            state["player_meta"].keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            upper = _upper_total(pdata["score_sheet"])
            lower = _lower_total(pdata["score_sheet"])
            bonus = _upper_bonus(upper)
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "score_sheet": pdata["score_sheet"],
                    "upper_total": upper,
                    "lower_total": lower,
                    "upper_bonus": bonus,
                    "yahtzee_bonus": pdata.get("yahtzee_bonus", 0),
                    "total": upper + lower + bonus + int(pdata.get("yahtzee_bonus", 0)),
                    "filled": sum(1 for cat in CATEGORY_ORDER if pdata["score_sheet"].get(cat) is not None),
                }
            )

        possible_scores: Dict[str, int] = {}
        allowed_categories: List[str] = []
        joker_view: Optional[Dict] = None
        current_player = state.get("current_player")
        if current_player and not state.get("game_over") and int(state.get("roll_count", 0)) > 0:
            pdata = state["players"].get(current_player)
            if pdata:
                possible_scores, allowed_categories, joker = _calculate_possible_scores(
                    state["dice"], pdata["score_sheet"]
                )
                if joker:
                    joker_view = {
                        "mode": joker.get("mode"),
                        "forced_category": joker.get("forced"),
                        "upper_category": joker.get("upper"),
                        "allowed_categories": allowed_categories,
                    }

        return {
            "game_id": YahtzeeGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_round": state.get("current_round"),
            "current_player": current_player,
            "roll_count": state.get("roll_count", 0),
            "dice": list(state.get("dice", [])),
            "locked": list(state.get("locked", [])),
            "players": players_view,
            "possible_scores": possible_scores,
            "allowed_categories": allowed_categories,
            "joker": joker_view,
            "category_order": list(CATEGORY_ORDER),
            "category_labels": dict(CATEGORY_LABELS),
            "legal_actions": YahtzeeGame.get_legal_actions(state, viewer_id),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state["players"]:
            return None
        if bot_id != state.get("current_player"):
            return None
        roll_count = int(state.get("roll_count", 0))
        if roll_count <= 0:
            return {"type": "roll"}
        if roll_count < 3 and random.random() < 0.6:
            return {"type": "roll"}
        pdata = state["players"][bot_id]
        scores, allowed, _ = _calculate_possible_scores(state["dice"], pdata["score_sheet"])
        if not allowed:
            return None
        best_category = max(scores.items(), key=lambda item: item[1])[0]
        return {"type": "score", "category": best_category}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
