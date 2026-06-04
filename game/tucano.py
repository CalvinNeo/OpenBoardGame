import itertools
import random
from collections import Counter
from typing import Dict, List, Optional, Tuple


FRUITS: Dict[str, Dict] = {
    "papaya": {"name": "Papaya", "emoji": "🥭", "count": 5, "score": {1: -2, 2: 0, 3: 6, 4: 12, 5: 18}},
    "fig": {"name": "Fig", "emoji": "🟣", "count": 5, "score": {1: 0, 2: 3, 3: 7, 4: 12, 5: 15}},
    "coconut": {"name": "Coconut", "emoji": "🥥", "count": 5, "score": {1: 1, 2: 3, 3: 6, 4: 10, 5: 14}},
    "lime": {"name": "Lime", "emoji": "🟢", "count": 5, "score": {1: -1, 2: -3, 3: -6, 4: -10, 5: -15}},
    "pineapple": {"name": "Pineapple", "emoji": "🍍", "count": 5, "score": {1: -2, 2: -4, 3: -7, 4: -11, 5: -16}},
    "starfruit": {"name": "Starfruit", "emoji": "⭐", "count": 5, "score": {1: 0, 2: 2, 3: 5, 4: 9, 5: 14}},
    "blueberry": {"name": "Blueberry", "emoji": "🔵", "count": 4, "score": {1: -2, 2: 0, 3: 9, 4: 16}},
    "rambutan": {"name": "Rambutan", "emoji": "🔴", "count": 4, "score": {1: 1, 2: 4, 3: 8, 4: 13}},
    "lychee": {"name": "Lychee", "emoji": "⚪", "count": 4, "score": {1: 2, 2: 5, 3: 9, 4: 14}},
    "banana": {"name": "Banana", "emoji": "🍌", "count": 5, "majority": {"win": 1, "lose": 1}},
    "avocado": {"name": "Avocado", "emoji": "🥑", "count": 5, "majority": {"win": 2, "lose": 1}},
    "pomegranate": {"name": "Pomegranate", "emoji": "❤️", "count": 4, "majority": {"win": 1, "lose": 1}},
}

JOKER_COUNT = 2
TOUCAN_COUNTS = {"give": 4, "steal": 4, "flip": 4}


def _new_card(card_id: int, card_type: str, key: str) -> Dict:
    card = {"id": f"tu{card_id}", "type": card_type}
    if card_type == "fruit":
        card["fruit"] = key
    elif card_type == "joker":
        card["fruit"] = "joker"
    else:
        card["toucan"] = key
    return card


def _build_deck() -> List[Dict]:
    fruits: List[Dict] = []
    card_id = 1
    for fruit, spec in FRUITS.items():
        for _ in range(int(spec["count"])):
            fruits.append(_new_card(card_id, "fruit", fruit))
            card_id += 1
    for _ in range(JOKER_COUNT):
        fruits.append(_new_card(card_id, "joker", "joker"))
        card_id += 1
    random.shuffle(fruits)
    top_half = fruits[:29]
    bottom_half = fruits[29:]
    toucans: List[Dict] = []
    for toucan, count in TOUCAN_COUNTS.items():
        for _ in range(count):
            toucans.append(_new_card(card_id, "toucan", toucan))
            card_id += 1
    random.shuffle(toucans)
    bottom = bottom_half + toucans
    random.shuffle(bottom)
    return list(reversed(top_half + bottom))


def _sorted_player_ids(state: Dict, player_ids: Optional[List[str]] = None) -> List[str]:
    meta = state.get("player_meta", {})
    ids = list(player_ids) if player_ids is not None else list(meta.keys())
    return sorted(ids, key=lambda pid: meta.get(pid, {}).get("seat", 0))


def _next_player_id(state: Dict, current_pid: str) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    if current_pid not in order:
        return order[0]
    return order[(order.index(current_pid) + 1) % len(order)]


def _draw_card(state: Dict) -> Optional[Dict]:
    deck = state.get("deck", [])
    if not deck:
        return None
    return deck.pop()


def _setup_columns(state: Dict) -> None:
    state["columns"] = [[], [], []]
    for column_index, count in enumerate([1, 2, 1]):
        for _ in range(count):
            card = _draw_card(state)
            if card:
                state["columns"][column_index].append(card)


def _refresh_columns(state: Dict) -> None:
    if not state.get("deck"):
        return
    for column in state.get("columns", []):
        card = _draw_card(state)
        if card:
            column.append(card)


def _empty_counts() -> Dict[str, int]:
    return {fruit: 0 for fruit in FRUITS}


def _add_count(counts: Dict[str, int], fruit: str, amount: int = 1) -> None:
    counts[fruit] = int(counts.get(fruit, 0)) + amount
    if counts[fruit] <= 0:
        counts.pop(fruit, None)


def _public_counts(counts: Dict[str, int]) -> Dict[str, int]:
    return {fruit: int(count) for fruit, count in counts.items() if int(count) > 0}


def _nonempty_columns(state: Dict) -> int:
    return sum(1 for column in state.get("columns", []) if column)


def _complete_turn(state: Dict) -> None:
    _refresh_columns(state)
    if not state.get("deck") and _nonempty_columns(state) <= 1:
        _finalize_game(state)
        return
    state["current_turn"] = _next_player_id(state, state.get("current_turn"))
    state["phase"] = "draft"


def _fruit_score(fruit: str, count: int, all_counts: Dict[str, Dict[str, int]]) -> int:
    if count <= 0:
        return 0
    spec = FRUITS[fruit]
    if "majority" in spec:
        max_count = max((counts.get(fruit, 0) for counts in all_counts.values()), default=0)
        leaders = [pid for pid, counts in all_counts.items() if counts.get(fruit, 0) == max_count and max_count > 0]
        if len(leaders) == 1:
            return count * int(spec["majority"]["win"])
        return -count * int(spec["majority"]["lose"])
    table = spec["score"]
    capped = min(count, max(table))
    return int(table.get(capped, 0))


def _score_counts(all_counts: Dict[str, Dict[str, int]]) -> Dict[str, Dict]:
    result = {}
    for pid, counts in all_counts.items():
        breakdown = {}
        total = 0
        for fruit in FRUITS:
            count = int(counts.get(fruit, 0))
            points = _fruit_score(fruit, count, all_counts)
            if count or points:
                breakdown[fruit] = {"count": count, "points": points}
            total += points
        result[pid] = {"total": total, "breakdown": breakdown}
    return result


def _base_counts_for_player(pdata: Dict) -> Dict[str, int]:
    counts = Counter()
    counts.update(pdata.get("face_up", {}))
    counts.update(pdata.get("protected", {}))
    return dict(counts)


def _assign_jokers(state: Dict) -> Tuple[Dict[str, Dict[str, int]], Dict[str, Dict[str, int]]]:
    player_ids = _sorted_player_ids(state)
    base = {pid: _base_counts_for_player(state["players"][pid]) for pid in player_ids}
    joker_counts = {pid: int(state["players"][pid].get("jokers", 0)) for pid in player_ids}
    assignments = {pid: {} for pid in player_ids}
    fruit_keys = list(FRUITS.keys())

    for pid in player_ids:
        jokers = joker_counts[pid]
        if jokers <= 0:
            continue
        best_counts = None
        best_assignment = None
        best_score = None
        for choice in itertools.product(fruit_keys, repeat=jokers):
            trial = {other: dict(counts) for other, counts in base.items()}
            assignment = Counter(choice)
            for fruit, amount in assignment.items():
                trial[pid][fruit] = trial[pid].get(fruit, 0) + amount
            score = _score_counts(trial)[pid]["total"]
            if best_score is None or score > best_score:
                best_score = score
                best_counts = trial[pid]
                best_assignment = dict(assignment)
        if best_counts is not None:
            base[pid] = best_counts
            assignments[pid] = best_assignment or {}
    return base, assignments


def _finalize_game(state: Dict) -> None:
    counts, assignments = _assign_jokers(state)
    scores = _score_counts(counts)
    max_score = max((score["total"] for score in scores.values()), default=0)
    winners = [pid for pid, score in scores.items() if score["total"] == max_score]
    state["phase"] = "game_over"
    state["game_over"] = True
    state["current_turn"] = None
    state["scores"] = scores
    state["joker_assignments"] = assignments
    state["winner"] = _sorted_player_ids(state, winners)
    state["discarded_final_column"] = [card for column in state.get("columns", []) for card in column]
    state["columns"] = [[], [], []]


def _has_face_up_fruit(pdata: Dict, fruit: str) -> bool:
    return int(pdata.get("face_up", {}).get(fruit, 0)) > 0


def _can_resolve_toucan(state: Dict, player_id: str, toucan: str) -> bool:
    if toucan == "flip":
        return True
    if toucan == "give":
        if len(state.get("turn_order", [])) < 2:
            return False
        return any(count > 0 for count in state["players"][player_id].get("face_up", {}).values())
    if toucan == "steal":
        for pid, pdata in state.get("players", {}).items():
            if pid != player_id and any(count > 0 for count in pdata.get("face_up", {}).values()):
                return True
    return False


def _finish_one_toucan(state: Dict) -> None:
    pending = state.get("pending_toucans", [])
    if pending:
        pending.pop(0)
    if not pending:
        state["pending_toucans"] = []
        _complete_turn(state)


class TucanoGame:
    game_id = "tucano"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        player_ids = [p["player_id"] for p in players]
        state = {
            "deck": _build_deck(),
            "columns": [[], [], []],
            "players": {
                p["player_id"]: {
                    "face_up": {},
                    "protected": {},
                    "jokers": 0,
                    "taken_cards": 0,
                }
                for p in players
            },
            "turn_order": player_ids,
            "player_meta": {p["player_id"]: p for p in players},
            "current_turn": random.choice(player_ids) if player_ids else None,
            "phase": "draft",
            "pending_toucans": [],
            "last_taken": None,
            "scores": None,
            "joker_assignments": {},
            "winner": None,
            "game_over": False,
            "config": config or {},
        }
        _setup_columns(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over") or player_id != state.get("current_turn"):
            return []
        if state.get("phase") == "draft":
            return ["draft_column"]
        if state.get("phase") == "toucan":
            pending = state.get("pending_toucans", [])
            if not pending:
                return []
            toucan = pending[0]
            if _can_resolve_toucan(state, player_id, toucan):
                return ["resolve_toucan"]
            return ["skip_toucan"]
        return []

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

        if state.get("phase") == "draft":
            if action_type != "draft_column":
                return [], "invalid action"
            column_index = action.get("column")
            if not isinstance(column_index, int) or column_index < 0 or column_index >= 3:
                return [], "invalid column"
            column = state["columns"][column_index]
            if not column:
                return [], "empty column"
            state["columns"][column_index] = []
            pdata = state["players"][player_id]
            pending = []
            for card in column:
                if card["type"] == "fruit":
                    _add_count(pdata["face_up"], card["fruit"])
                elif card["type"] == "joker":
                    pdata["jokers"] = int(pdata.get("jokers", 0)) + 1
                elif card["type"] == "toucan":
                    pending.append(card["toucan"])
            pdata["taken_cards"] = int(pdata.get("taken_cards", 0)) + len(column)
            state["last_taken"] = {"player_id": player_id, "column": column_index, "cards": column}
            state["pending_toucans"] = pending
            events.append({"type": "tucano:draft", "payload": {"player_id": player_id, "column": column_index}})
            if pending:
                state["phase"] = "toucan"
            else:
                _complete_turn(state)
            return events, None

        if state.get("phase") == "toucan":
            pending = state.get("pending_toucans", [])
            if not pending:
                _complete_turn(state)
                return events, None
            toucan = pending[0]
            if action_type == "skip_toucan":
                if _can_resolve_toucan(state, player_id, toucan):
                    return [], "toucan can be resolved"
                events.append({"type": "tucano:toucan_skip", "payload": {"player_id": player_id, "toucan": toucan}})
                _finish_one_toucan(state)
                return events, None
            if action_type != "resolve_toucan":
                return [], "invalid action"

            pdata = state["players"][player_id]
            if toucan == "flip":
                for fruit, count in list(pdata.get("face_up", {}).items()):
                    _add_count(pdata["protected"], fruit, int(count))
                pdata["face_up"] = {}
                events.append({"type": "tucano:toucan", "payload": {"player_id": player_id, "toucan": "flip"}})
                _finish_one_toucan(state)
                return events, None

            target_id = action.get("target_player")
            fruit = action.get("fruit")
            if fruit not in FRUITS:
                return [], "invalid fruit"
            if target_id == player_id or target_id not in state.get("players", {}):
                return [], "invalid target"

            if toucan == "give":
                if not _has_face_up_fruit(pdata, fruit):
                    return [], "fruit not available"
                _add_count(pdata["face_up"], fruit, -1)
                _add_count(state["players"][target_id]["face_up"], fruit)
            elif toucan == "steal":
                target = state["players"][target_id]
                if not _has_face_up_fruit(target, fruit):
                    return [], "target fruit not available"
                _add_count(target["face_up"], fruit, -1)
                _add_count(pdata["face_up"], fruit)
            else:
                return [], "invalid toucan"

            events.append(
                {
                    "type": "tucano:toucan",
                    "payload": {"player_id": player_id, "toucan": toucan, "target_player": target_id, "fruit": fruit},
                }
            )
            _finish_one_toucan(state)
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for pid in _sorted_player_ids(state):
            pdata = state["players"][pid]
            meta = state["player_meta"].get(pid, {})
            score = (state.get("scores") or {}).get(pid)
            joker_assignment = (state.get("joker_assignments") or {}).get(pid, {})
            if score:
                score_counts = _base_counts_for_player(pdata)
                for fruit, count in joker_assignment.items():
                    score_counts[fruit] = score_counts.get(fruit, 0) + int(count)
            else:
                score_counts = dict(pdata.get("face_up", {}))
            players.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "face_up": _public_counts(pdata.get("face_up", {})),
                    "protected_count": sum(int(v) for v in pdata.get("protected", {}).values()),
                    "jokers": int(pdata.get("jokers", 0)),
                    "taken_cards": int(pdata.get("taken_cards", 0)),
                    "score_counts": _public_counts(score_counts),
                    "score": score["total"] if score else None,
                    "score_breakdown": score["breakdown"] if score else None,
                    "joker_assignment": joker_assignment,
                }
            )
        return {
            "game_id": TucanoGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_turn": state.get("current_turn"),
            "deck_count": len(state.get("deck", [])),
            "columns": state.get("columns", []),
            "players": players,
            "pending_toucans": list(state.get("pending_toucans", [])),
            "active_toucan": (state.get("pending_toucans") or [None])[0],
            "last_taken": state.get("last_taken"),
            "legal_actions": TucanoGame.get_legal_actions(state, viewer_id),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "fruit_defs": FRUITS,
            "uses_proxy_data": True,
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if bot_id != state.get("current_turn") or state.get("game_over"):
            return None
        if state.get("phase") == "draft":
            choices = [(len(column), index) for index, column in enumerate(state.get("columns", [])) if column]
            if not choices:
                return None
            _, index = max(choices)
            return {"type": "draft_column", "column": index}
        if state.get("phase") == "toucan":
            pending = state.get("pending_toucans", [])
            if not pending:
                return None
            toucan = pending[0]
            if not _can_resolve_toucan(state, bot_id, toucan):
                return {"type": "skip_toucan"}
            if toucan == "flip":
                return {"type": "resolve_toucan"}
            if toucan == "give":
                face_up = state["players"][bot_id].get("face_up", {})
                fruit = min((f for f, c in face_up.items() if c > 0), key=lambda f: FRUITS[f]["name"], default=None)
                targets = [pid for pid in state.get("turn_order", []) if pid != bot_id]
                if fruit and targets:
                    return {"type": "resolve_toucan", "fruit": fruit, "target_player": random.choice(targets)}
            if toucan == "steal":
                candidates = []
                for pid, pdata in state.get("players", {}).items():
                    if pid == bot_id:
                        continue
                    for fruit, count in pdata.get("face_up", {}).items():
                        if count > 0:
                            candidates.append((pid, fruit))
                if candidates:
                    target, fruit = random.choice(candidates)
                    return {"type": "resolve_toucan", "fruit": fruit, "target_player": target}
            return {"type": "skip_toucan"}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
