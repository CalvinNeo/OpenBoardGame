import json
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple


TILE_NUMBERS = [0, 1, 2, 3, 4, 6, 7, 8, 9]
COLOR_ORDER = {"red": 0, "blue": 1, "green": 0}
ALLOWED_COLORS = ("red", "blue", "green")

DEFAULT_CONFIG: Dict = {}

_QUESTIONS_CACHE: Optional[List[Dict]] = None


def _questions_path() -> Path:
    return Path(__file__).resolve().parent / "assets" / "tagiron_questions.json"


def _load_questions() -> List[Dict]:
    global _QUESTIONS_CACHE
    if _QUESTIONS_CACHE is not None:
        return list(_QUESTIONS_CACHE)

    path = _questions_path()
    if not path.exists():
        raise ValueError("tagiron questions config not found")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise ValueError("tagiron questions config must be a list")

    questions: List[Dict] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        qid = entry.get("id")
        text = entry.get("text")
        qtype = entry.get("type")
        if not isinstance(qid, int) or not isinstance(text, str) or not isinstance(qtype, str):
            continue
        questions.append(dict(entry))

    if not questions:
        raise ValueError("tagiron questions config is empty")

    _QUESTIONS_CACHE = list(questions)
    return list(questions)


def _question_index() -> Dict[int, Dict]:
    return {q["id"]: q for q in _load_questions()}


def _build_question_deck(player_count: int) -> Tuple[List[int], List[int]]:
    questions = _load_questions()
    allowed = []
    for question in questions:
        blocked = question.get("not_for_player_counts")
        if isinstance(blocked, list) and player_count in blocked:
            continue
        allowed.append(question)
    deck = [q["id"] for q in allowed]
    random.shuffle(deck)
    pool = deck[:6]
    deck = deck[6:]
    return deck, pool


def _build_tile_deck() -> List[Dict]:
    deck = []
    for number in TILE_NUMBERS:
        deck.append({"number": number, "color": "red"})
        deck.append({"number": number, "color": "blue"})
    deck.append({"number": 5, "color": "green"})
    deck.append({"number": 5, "color": "green"})
    random.shuffle(deck)
    return deck


def _sort_tiles(tiles: List[Dict]) -> List[Dict]:
    return sorted(tiles, key=lambda t: (int(t.get("number", 0)), COLOR_ORDER.get(t.get("color"), 99)))


def _active_player_ids(state: Dict) -> List[str]:
    return [pid for pid in state["turn_order"] if not state["players"][pid]["eliminated"]]


def _advance_turn(state: Dict) -> None:
    active = _active_player_ids(state)
    if not active:
        state["current_turn"] = None
        return
    current = state.get("current_turn")
    if current not in active:
        state["current_turn"] = active[0]
        return
    order = state["turn_order"]
    idx = order.index(current)
    for offset in range(1, len(order) + 1):
        pid = order[(idx + offset) % len(order)]
        if pid in active:
            state["current_turn"] = pid
            return


def _update_round(state: Dict) -> None:
    active = _active_player_ids(state)
    if not active:
        return
    counts = [int(state["round_actions"].get(pid, 0)) for pid in active]
    if counts:
        state["round"] = min(counts) + 1


def _positions_of_number(tiles: List[Dict], number: int) -> List[int]:
    return [idx + 1 for idx, tile in enumerate(tiles) if tile.get("number") == number]


def _pairs_same_color(tiles: List[Dict]) -> List[List[int]]:
    pairs: List[List[int]] = []
    for idx in range(len(tiles) - 1):
        if tiles[idx].get("color") == tiles[idx + 1].get("color"):
            pairs.append([idx + 1, idx + 2])
    return pairs


def _pairs_sequential(tiles: List[Dict]) -> List[List[int]]:
    pairs: List[List[int]] = []
    for idx in range(len(tiles) - 1):
        left = int(tiles[idx].get("number", 0))
        right = int(tiles[idx + 1].get("number", 0))
        if right - left == 1:
            pairs.append([idx + 1, idx + 2])
    return pairs


def _sum_tiles(tiles: List[Dict]) -> int:
    return sum(int(tile.get("number", 0)) for tile in tiles)


def _sum_color(tiles: List[Dict], color: str) -> int:
    return sum(int(tile.get("number", 0)) for tile in tiles if tile.get("color") == color)


def _count_color(tiles: List[Dict], color: str) -> int:
    return sum(1 for tile in tiles if tile.get("color") == color)


def _count_even(tiles: List[Dict]) -> int:
    return sum(1 for tile in tiles if int(tile.get("number", 0)) % 2 == 0)


def _count_odd(tiles: List[Dict]) -> int:
    return sum(1 for tile in tiles if int(tile.get("number", 0)) % 2 == 1)


def _count_pairs(tiles: List[Dict]) -> int:
    counts: Dict[int, int] = {}
    for tile in tiles:
        number = int(tile.get("number", 0))
        counts[number] = counts.get(number, 0) + 1
    return sum(1 for value in counts.values() if value >= 2)


def _range_diff(tiles: List[Dict]) -> int:
    if not tiles:
        return 0
    values = [int(tile.get("number", 0)) for tile in tiles]
    return max(values) - min(values)


def _middle_three(tiles: List[Dict]) -> List[Dict]:
    if len(tiles) <= 3:
        return tiles
    start = max(0, (len(tiles) - 3) // 2)
    return tiles[start : start + 3]


def _middle_tile(tiles: List[Dict]) -> Optional[Dict]:
    if not tiles:
        return None
    return tiles[len(tiles) // 2]


def _answer_question(question: Dict, tiles: List[Dict], choice: Optional[int]) -> Dict:
    qtype = question.get("type")
    if qtype == "where_number":
        number = int(question.get("number", 0))
        return {"kind": "positions", "positions": _positions_of_number(tiles, number)}
    if qtype == "where_number_choice":
        choices = question.get("choices")
        if not isinstance(choices, list) or choice not in choices:
            raise ValueError("missing or invalid choice")
        return {"kind": "positions", "positions": _positions_of_number(tiles, int(choice))}
    if qtype == "sum_middle_three":
        return {"kind": "number", "value": _sum_tiles(_middle_three(tiles))}
    if qtype == "middle_gt_4":
        middle = _middle_tile(tiles)
        value = bool(middle and int(middle.get("number", 0)) > 4)
        return {"kind": "boolean", "value": value}
    if qtype == "neighbor_same_color":
        return {"kind": "pairs", "pairs": _pairs_same_color(tiles)}
    if qtype == "sequential_order":
        return {"kind": "pairs", "pairs": _pairs_sequential(tiles)}
    if qtype == "sum_left_three":
        return {"kind": "number", "value": _sum_tiles(tiles[:3])}
    if qtype == "sum_right_three":
        return {"kind": "number", "value": _sum_tiles(tiles[-3:])}
    if qtype == "sum_color":
        color = question.get("color")
        return {"kind": "number", "value": _sum_color(tiles, str(color))}
    if qtype == "count_color":
        color = question.get("color")
        return {"kind": "number", "value": _count_color(tiles, str(color))}
    if qtype == "count_even":
        return {"kind": "number", "value": _count_even(tiles)}
    if qtype == "count_odd":
        return {"kind": "number", "value": _count_odd(tiles)}
    if qtype == "count_pairs":
        return {"kind": "number", "value": _count_pairs(tiles)}
    if qtype == "range_diff":
        return {"kind": "number", "value": _range_diff(tiles)}
    if qtype == "sum_all":
        return {"kind": "number", "value": _sum_tiles(tiles)}
    raise ValueError("unknown question type")


def _validate_guess_tile(tile: Dict) -> Optional[str]:
    if not isinstance(tile, dict):
        return "invalid tile"
    color = tile.get("color")
    number = tile.get("number")
    if color not in ALLOWED_COLORS:
        return "invalid color"
    if not isinstance(number, int):
        return "invalid number"
    if number == 5 and color != "green":
        return "invalid 5 color"
    if number != 5 and color == "green":
        return "invalid green number"
    if number not in TILE_NUMBERS and number != 5:
        return "invalid number"
    return None


def _tiles_equal(left: List[Dict], right: List[Dict]) -> bool:
    if len(left) != len(right):
        return False
    for idx, tile in enumerate(left):
        other = right[idx]
        if tile.get("number") != other.get("number") or tile.get("color") != other.get("color"):
            return False
    return True


def _build_public_players(state: Dict, viewer_id: str) -> List[Dict]:
    ordered_ids = sorted(state["player_meta"].keys(), key=lambda pid: state["player_meta"][pid].get("seat", 0))
    players = []
    for pid in ordered_ids:
        meta = state["player_meta"][pid]
        pdata = state["players"][pid]
        players.append(
            {
                "player_id": pid,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "is_bot": meta.get("is_bot", False),
                "eliminated": pdata["eliminated"],
                "tile_count": len(pdata["tiles"]),
            }
        )
    return players


class TagironGame:
    game_id = "tagiron"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        player_count = len(players)
        deck = _build_tile_deck()
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        state_players: Dict[str, Dict] = {}
        tiles_per_player = 5 if player_count <= 3 else 4
        for pid in player_ids:
            tiles = _sort_tiles([deck.pop() for _ in range(tiles_per_player)])
            state_players[pid] = {"tiles": tiles, "eliminated": False, "turns_taken": 0}

        central_tiles: List[Dict] = []
        if player_count == 3:
            central_tiles = _sort_tiles([deck.pop() for _ in range(5)])
        elif player_count == 4:
            central_tiles = _sort_tiles([deck.pop() for _ in range(4)])

        question_deck, question_pool = _build_question_deck(player_count)

        round_actions = {pid: 0 for pid in player_ids}

        return {
            "config": {**DEFAULT_CONFIG, **(config or {})},
            "players": state_players,
            "central_tiles": central_tiles,
            "turn_order": player_ids,
            "current_turn": player_ids[0] if player_ids else None,
            "question_deck": question_deck,
            "question_pool": question_pool,
            "player_meta": player_meta,
            "round": 1,
            "round_actions": round_actions,
            "round_end_target": None,
            "winners": [],
            "log": [],
            "turn_index": 0,
            "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        pdata = state["players"].get(player_id)
        if not pdata or pdata["eliminated"]:
            return []
        if player_id != state.get("current_turn"):
            return []
        return ["ask_question", "guess_tiles"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        pdata = state["players"].get(player_id)
        if not pdata or pdata["eliminated"]:
            return [], "unknown player"
        if player_id != state.get("current_turn"):
            return [], "not your turn"

        action_type = action.get("type")
        events: List[Dict] = []

        if action_type == "ask_question":
            question_id = action.get("question_id")
            if not isinstance(question_id, int):
                return [], "invalid question"
            if question_id not in state["question_pool"]:
                return [], "question not in pool"
            question = _question_index().get(question_id)
            if not question:
                return [], "unknown question"
            choice = action.get("choice")
            answers: Dict[str, Dict] = {}
            player_ids = list(state["players"].keys())
            if question.get("shared_info"):
                targets = player_ids
            elif len(player_ids) == 4:
                targets = player_ids
            else:
                targets = [pid for pid in player_ids if pid != player_id]
            for target in targets:
                tiles = state["players"][target]["tiles"]
                try:
                    answers[target] = _answer_question(question, tiles, choice)
                except ValueError as exc:
                    return [], str(exc)

            state["turn_index"] = int(state.get("turn_index", 0)) + 1
            state["round_actions"][player_id] = int(state["round_actions"].get(player_id, 0)) + 1
            pdata["turns_taken"] = int(pdata.get("turns_taken", 0)) + 1
            _update_round(state)
            state["question_pool"].remove(question_id)
            if state["question_deck"]:
                state["question_pool"].append(state["question_deck"].pop(0))

            log_entry = {
                "type": "question",
                "turn": state["turn_index"],
                "round": state["round"],
                "asker": player_id,
                "question_id": question_id,
                "question_text": question.get("text"),
                "choice": choice,
                "shared_info": bool(question.get("shared_info")),
                "answers": answers,
            }
            state["log"].append(log_entry)
            events.append({"type": "tagiron:question", "payload": log_entry})
            _advance_turn(state)
            return events, None

        if action_type == "guess_tiles":
            guess_tiles = action.get("tiles")
            if not isinstance(guess_tiles, list) or not guess_tiles:
                return [], "invalid guess"
            for tile in guess_tiles:
                error = _validate_guess_tile(tile)
                if error:
                    return [], error

            player_count = len(state["players"])
            if player_count == 2:
                opponent_ids = [pid for pid in state["players"].keys() if pid != player_id]
                if not opponent_ids:
                    return [], "no opponent"
                target_tiles = state["players"][opponent_ids[0]]["tiles"]
                target_label = "opponent"
            else:
                target_tiles = state["central_tiles"]
                target_label = "center"
            if len(guess_tiles) != len(target_tiles):
                return [], "guess length mismatch"

            state["turn_index"] = int(state.get("turn_index", 0)) + 1
            state["round_actions"][player_id] = int(state["round_actions"].get(player_id, 0)) + 1
            pdata["turns_taken"] = int(pdata.get("turns_taken", 0)) + 1
            _update_round(state)
            correct = _tiles_equal(guess_tiles, target_tiles)
            log_entry = {
                "type": "guess",
                "turn": state["turn_index"],
                "round": state["round"],
                "player_id": player_id,
                "target": target_label,
                "tiles": guess_tiles,
                "correct": correct,
            }
            state["log"].append(log_entry)
            events.append({"type": "tagiron:guess", "payload": log_entry})

            if correct:
                winners = set(state.get("winners") or [])
                winners.add(player_id)
                state["winners"] = list(winners)
                if state.get("round_end_target") is None:
                    state["round_end_target"] = state["round_actions"][player_id]
            else:
                if player_count > 2:
                    pdata["eliminated"] = True
                    _update_round(state)
                    remaining = _active_player_ids(state)
                    if len(remaining) == 1:
                        state["game_over"] = True
                        state["winners"] = remaining
                        return events, None

            _advance_turn(state)

            target = state.get("round_end_target")
            if target is not None:
                active = _active_player_ids(state)
                if active and all(state["round_actions"].get(pid, 0) >= target for pid in active):
                    state["game_over"] = True
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        question_index = _question_index()
        question_pool = []
        for qid in state.get("question_pool", []):
            question = question_index.get(qid)
            if not question:
                continue
            question_pool.append(
                {
                    "id": qid,
                    "text": question.get("text"),
                    "shared_info": bool(question.get("shared_info")),
                    "choices": question.get("choices"),
                }
            )

        players = _build_public_players(state, viewer_id)
        your_tiles = []
        pdata = state["players"].get(viewer_id)
        if pdata:
            for idx, tile in enumerate(pdata.get("tiles", [])):
                your_tiles.append({"position": idx + 1, "color": tile.get("color"), "number": tile.get("number")})

        player_count = len(state.get("players", {}))
        if player_count == 2:
            target_type = "opponent"
            target_count = len(pdata.get("tiles", [])) if pdata else 0
        else:
            target_type = "center"
            target_count = len(state.get("central_tiles", []))

        revealed = None
        if state.get("game_over"):
            revealed = {
                "players": {
                    pid: list(state["players"][pid]["tiles"]) for pid in state["players"].keys()
                },
                "center": list(state.get("central_tiles", [])),
            }

        return {
            "phase": "game_over" if state.get("game_over") else "playing",
            "round": state.get("round", 1),
            "current_turn": state.get("current_turn"),
            "you": viewer_id,
            "players": players,
            "your_tiles": your_tiles,
            "central_count": len(state.get("central_tiles", [])),
            "question_pool": question_pool,
            "log": list(state.get("log", [])),
            "winners": list(state.get("winners", [])),
            "guess_target": {"type": target_type, "count": target_count},
            "legal_actions": TagironGame.get_legal_actions(state, viewer_id),
            "revealed": revealed,
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        pdata = state["players"].get(bot_id)
        if not pdata or pdata["eliminated"]:
            return None
        if bot_id != state.get("current_turn"):
            return None

        legal = TagironGame.get_legal_actions(state, bot_id)
        if "guess_tiles" in legal and pdata.get("turns_taken", 0) >= 2 and random.random() < 0.25:
            player_count = len(state["players"])
            if player_count == 2:
                target_len = len(pdata.get("tiles", []))
            else:
                target_len = len(state.get("central_tiles", []))
            deck = _build_tile_deck()
            guess = random.sample(deck, k=min(target_len, len(deck)))
            guess = _sort_tiles(guess)
            return {"type": "guess_tiles", "tiles": guess}

        if "ask_question" in legal:
            pool = list(state.get("question_pool", []))
            if not pool:
                return None
            question_id = random.choice(pool)
            question = _question_index().get(question_id)
            if not question:
                return None
            choice = None
            choices = question.get("choices")
            if isinstance(choices, list) and choices:
                choice = random.choice(choices)
            payload = {"type": "ask_question", "question_id": question_id}
            if choice is not None:
                payload["choice"] = choice
            return payload
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
