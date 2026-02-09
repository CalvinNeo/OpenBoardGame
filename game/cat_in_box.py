import random
from typing import Dict, List, Optional, Tuple

COLORS = ["red", "blue", "yellow", "green"]
TRUMP_COLOR = "red"
CARDS_PER_NUMBER = 5
BID_OPTIONS = (1, 2, 3)

ROUND_CONFIGS = {
    2: {"max_number": 5, "hand_size": 10, "system_remove": 5, "discard_each": 0},
    3: {"max_number": 6, "hand_size": 10, "system_remove": 0, "discard_each": 1},
    4: {"max_number": 8, "hand_size": 10, "system_remove": 0, "discard_each": 1},
    5: {"max_number": 9, "hand_size": 9, "system_remove": 0, "discard_each": 1},
}


def _round_config(player_count: int) -> Dict:
    if player_count not in ROUND_CONFIGS:
        raise ValueError("unsupported player count")
    return dict(ROUND_CONFIGS[player_count])


def _build_deck(max_number: int) -> List[int]:
    deck = []
    for value in range(1, max_number + 1):
        deck.extend([value] * CARDS_PER_NUMBER)
    random.shuffle(deck)
    return deck


def _init_player_state() -> Dict:
    return {
        "hand": [],
        "tricks_won": 0,
        "bid": None,
        "color_available": {color: True for color in COLORS},
        "discarded": False,
        "score": 0,
    }


def _reset_round_state(state: Dict) -> None:
    for pdata in state["players"].values():
        pdata["hand"] = []
        pdata["tricks_won"] = 0
        pdata["bid"] = None
        pdata["color_available"] = {color: True for color in COLORS}
        pdata["discarded"] = False

    state["current_trick"] = []
    state["lead_color"] = None
    state["tricks_played"] = 0
    state["paradox_player"] = None


def _new_board(max_number: int) -> List[List[Optional[str]]]:
    return [[None for _ in range(max_number)] for _ in COLORS]


def _color_index(color: str) -> int:
    return COLORS.index(color)


def _slot_empty(state: Dict, color: str, value: int) -> bool:
    board = state["board"]
    row = _color_index(color)
    col = value - 1
    if col < 0 or col >= len(board[row]):
        return False
    return board[row][col] is None


def _has_valid_move(state: Dict, player_id: str) -> bool:
    pdata = state["players"][player_id]
    if not pdata["hand"]:
        return False
    available_colors = [color for color, ok in pdata["color_available"].items() if ok]
    if not available_colors:
        return False
    board = state["board"]
    max_number = state["max_number"]
    for value in pdata["hand"]:
        if value < 1 or value > max_number:
            continue
        col = value - 1
        for color in available_colors:
            row = _color_index(color)
            if board[row][col] is None:
                return True
    return False


def _next_player_id(state: Dict, current_id: str) -> Optional[str]:
    order = state["turn_order"]
    if not order:
        return None
    if current_id not in order:
        return order[0]
    idx = order.index(current_id)
    return order[(idx + 1) % len(order)]


def _resolve_trick(state: Dict) -> Optional[str]:
    trick = state.get("current_trick") or []
    if not trick:
        return None
    lead_color = state.get("lead_color")
    trump_cards = [entry for entry in trick if entry["color"] == TRUMP_COLOR]
    if trump_cards:
        winner = max(trump_cards, key=lambda entry: entry["value"])
    else:
        lead_cards = [entry for entry in trick if entry["color"] == lead_color]
        if not lead_cards:
            return None
        winner = max(lead_cards, key=lambda entry: entry["value"])
    return winner["player_id"]


def _largest_group(board: List[List[Optional[str]]], player_id: str) -> int:
    if not board:
        return 0
    rows = len(board)
    cols = len(board[0]) if board[0] else 0
    visited = [[False for _ in range(cols)] for _ in range(rows)]
    best = 0
    for r in range(rows):
        for c in range(cols):
            if visited[r][c]:
                continue
            if board[r][c] != player_id:
                continue
            stack = [(r, c)]
            visited[r][c] = True
            count = 0
            while stack:
                cr, cc = stack.pop()
                count += 1
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nr, nc = cr + dr, cc + dc
                    if nr < 0 or nr >= rows or nc < 0 or nc >= cols:
                        continue
                    if visited[nr][nc]:
                        continue
                    if board[nr][nc] != player_id:
                        continue
                    visited[nr][nc] = True
                    stack.append((nr, nc))
            best = max(best, count)
    return best


def _score_round(state: Dict, paradox_player: Optional[str]) -> Dict:
    board = state["board"]
    round_points = {}
    bonus_points = {}
    tricks = {}
    bids = {}
    totals = {}

    for pid, pdata in state["players"].items():
        tricks[pid] = pdata["tricks_won"]
        bids[pid] = pdata["bid"]
        bonus = _largest_group(board, pid)
        bonus_points[pid] = bonus

        if paradox_player == pid:
            delta = -1 * pdata["tricks_won"]
        else:
            delta = pdata["tricks_won"]
            if pdata["bid"] == pdata["tricks_won"]:
                delta += bonus
        round_points[pid] = delta
        pdata["score"] += delta
        totals[pid] = pdata["score"]

    summary = {
        "round": state["round"],
        "paradox_player": paradox_player,
        "tricks": tricks,
        "bids": bids,
        "bonus": bonus_points,
        "round_points": round_points,
        "total_scores": totals,
        "incomplete_trick": state.get("current_trick") if paradox_player else None,
    }
    return summary


def _next_round_start_index(state: Dict) -> int:
    total = len(state["turn_order"])
    return (state["round_start_index"] + 1) % total


def _start_round(state: Dict, start_player_id: str, round_number: int) -> None:
    config = _round_config(len(state["turn_order"]))
    max_number = config["max_number"]
    hand_size = config["hand_size"]
    system_remove = config["system_remove"]
    discard_each = config["discard_each"]

    _reset_round_state(state)

    deck = _build_deck(max_number)
    removed = []
    if system_remove:
        for _ in range(system_remove):
            if deck:
                removed.append(deck.pop())

    for pid in state["turn_order"]:
        hand = [deck.pop() for _ in range(hand_size)]
        hand.sort()
        state["players"][pid]["hand"] = hand

    state["deck"] = deck
    state["removed_cards"] = removed
    state["board"] = _new_board(max_number)
    state["max_number"] = max_number
    state["hand_size"] = hand_size
    state["discard_each"] = discard_each
    state["round"] = round_number
    state["round_start_player"] = start_player_id

    if discard_each > 0:
        state["phase"] = "discard"
        state["current_turn"] = None
    else:
        state["phase"] = "bidding"
        state["current_turn"] = None


def _maybe_trigger_paradox(state: Dict, events: List[Dict]) -> bool:
    if state.get("phase") != "trick":
        return False
    current = state.get("current_turn")
    if not current:
        return False
    if _has_valid_move(state, current):
        return False
    state["paradox_player"] = current
    summary = _score_round(state, current)
    state["last_round_summary"] = summary
    events.append({"type": "cat_in_box:paradox", "payload": {"player_id": current}})
    _finish_round(state)
    return True


def _finish_round(state: Dict) -> None:
    if state["round"] >= state["rounds_total"]:
        state["game_over"] = True
        state["phase"] = "game_over"
        state["current_turn"] = None
        scores = [pdata["score"] for pdata in state["players"].values()]
        if scores:
            best = max(scores)
            winners = [pid for pid, pdata in state["players"].items() if pdata["score"] == best]
        else:
            winners = []
        state["winners"] = winners
        return

    next_index = _next_round_start_index(state)
    state["round_start_index"] = next_index
    start_player = state["turn_order"][next_index]
    _start_round(state, start_player, state["round"] + 1)


class CatInBoxGame:
    game_id = "cat_in_box"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        player_ids = sorted(players, key=lambda item: item.get("seat", 0))
        turn_order = [p["player_id"] for p in player_ids]
        player_meta = {p["player_id"]: p for p in players}

        state_players = {pid: _init_player_state() for pid in turn_order}

        start_index = random.randrange(len(turn_order)) if turn_order else 0
        start_player = turn_order[start_index] if turn_order else None

        state = {
            "players": state_players,
            "turn_order": turn_order,
            "player_meta": player_meta,
            "round": 1,
            "rounds_total": len(turn_order),
            "round_start_index": start_index,
            "round_start_player": start_player,
            "phase": "discard",
            "current_turn": None,
            "current_trick": [],
            "lead_color": None,
            "tricks_played": 0,
            "board": [],
            "max_number": 0,
            "hand_size": 0,
            "discard_each": 0,
            "paradox_player": None,
            "last_round_summary": None,
            "game_over": False,
            "winners": [],
            "deck": [],
            "removed_cards": [],
            "config": {},
        }

        if turn_order:
            _start_round(state, start_player, 1)
        else:
            state["phase"] = "game_over"
            state["game_over"] = True
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        pdata = state["players"].get(player_id)
        if not pdata:
            return []
        phase = state.get("phase")
        if phase == "discard":
            if state.get("discard_each", 0) > 0 and not pdata.get("discarded"):
                return ["discard"]
            return []
        if phase == "bidding":
            if pdata.get("bid") is None:
                return ["bid"]
            return []
        if phase == "trick":
            if player_id != state.get("current_turn"):
                return []
            return ["play_card"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        pdata = state["players"].get(player_id)
        if not pdata:
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        if state["phase"] == "discard":
            if action_type != "discard":
                return [], "invalid action"
            if state.get("discard_each", 0) <= 0:
                return [], "discard not required"
            if pdata.get("discarded"):
                return [], "already discarded"
            card_value = action.get("card_value")
            if not isinstance(card_value, int):
                return [], "invalid card_value"
            if card_value not in pdata["hand"]:
                return [], "card not in hand"
            pdata["hand"].remove(card_value)
            pdata["discarded"] = True
            events.append({"type": "cat_in_box:discard", "payload": {"player_id": player_id}})

            if all(p.get("discarded") for p in state["players"].values()):
                state["phase"] = "bidding"
            return events, None

        if state["phase"] == "bidding":
            if action_type != "bid":
                return [], "invalid action"
            if pdata.get("bid") is not None:
                return [], "already bid"
            bid = action.get("bid")
            if not isinstance(bid, int) or bid not in BID_OPTIONS:
                return [], "invalid bid"
            pdata["bid"] = bid
            events.append({"type": "cat_in_box:bid", "payload": {"player_id": player_id, "bid": bid}})

            if all(p.get("bid") is not None for p in state["players"].values()):
                state["phase"] = "trick"
                state["current_turn"] = state["round_start_player"]
                state["current_trick"] = []
                state["lead_color"] = None
                _maybe_trigger_paradox(state, events)
            return events, None

        if state["phase"] == "trick":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if _maybe_trigger_paradox(state, events):
                return events, None
            if action_type != "play_card":
                return [], "invalid action"
            card_value = action.get("card_value")
            declared_color = action.get("color")
            if not isinstance(card_value, int):
                return [], "invalid card_value"
            if declared_color not in COLORS:
                return [], "invalid color"
            if card_value not in pdata["hand"]:
                return [], "card not in hand"
            if not pdata["color_available"].get(declared_color, False):
                return [], "color void"
            if not _slot_empty(state, declared_color, card_value):
                return [], "slot occupied"

            if not state["current_trick"]:
                state["lead_color"] = declared_color
            else:
                lead_color = state["lead_color"]
                if declared_color != lead_color and lead_color:
                    pdata["color_available"][lead_color] = False

            pdata["hand"].remove(card_value)
            row = _color_index(declared_color)
            col = card_value - 1
            state["board"][row][col] = player_id
            play_entry = {"player_id": player_id, "value": card_value, "color": declared_color}
            state["current_trick"].append(play_entry)
            events.append({"type": "cat_in_box:play", "payload": play_entry})

            if len(state["current_trick"]) >= len(state["turn_order"]):
                winner = _resolve_trick(state)
                if winner:
                    state["players"][winner]["tricks_won"] += 1
                    state["tricks_played"] += 1
                    events.append({"type": "cat_in_box:trick", "payload": {"winner": winner}})
                state["current_trick"] = []
                state["lead_color"] = None
                if all(len(p["hand"]) == 0 for p in state["players"].values()):
                    summary = _score_round(state, state.get("paradox_player"))
                    state["last_round_summary"] = summary
                    _finish_round(state)
                    return events, None
                state["current_turn"] = winner
                if _maybe_trigger_paradox(state, events):
                    return events, None
                return events, None

            state["current_turn"] = _next_player_id(state, player_id)
            _maybe_trigger_paradox(state, events)
            return events, None

        return [], "invalid phase"

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
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "hand_count": len(pdata["hand"]),
                    "tricks_won": pdata["tricks_won"],
                    "bid": pdata["bid"],
                    "score": pdata["score"],
                    "discarded": pdata.get("discarded", False),
                    "void_colors": [color for color, ok in pdata["color_available"].items() if not ok],
                    "color_available": dict(pdata["color_available"]),
                }
            )

        current_trick_view = []
        for entry in state.get("current_trick", []):
            current_trick_view.append(
                {
                    "player_id": entry["player_id"],
                    "name": state["player_meta"].get(entry["player_id"], {}).get("name"),
                    "color": entry["color"],
                    "value": entry["value"],
                }
            )

        your_hand = state["players"].get(viewer_id, {}).get("hand", [])
        your_hand_sorted = sorted(your_hand)
        your_colors = state["players"].get(viewer_id, {}).get("color_available", {})

        return {
            "game_id": CatInBoxGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "rounds_total": state.get("rounds_total"),
            "current_turn": state.get("current_turn"),
            "round_start_player": state.get("round_start_player"),
            "trump_color": TRUMP_COLOR,
            "lead_color": state.get("lead_color"),
            "max_number": state.get("max_number"),
            "colors": list(COLORS),
            "board": state.get("board"),
            "current_trick": current_trick_view,
            "tricks_played": state.get("tricks_played"),
            "players": players_view,
            "hand": your_hand_sorted,
            "your_colors": dict(your_colors),
            "legal_actions": CatInBoxGame.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "game_over": state.get("game_over", False),
            "winners": state.get("winners"),
            "config": state.get("config", {}),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        pdata = state["players"].get(bot_id)
        if not pdata:
            return None
        legal = CatInBoxGame.get_legal_actions(state, bot_id)
        if not legal:
            return None

        if state.get("phase") == "discard":
            if pdata["hand"]:
                return {"type": "discard", "card_value": random.choice(pdata["hand"])}
            return None

        if state.get("phase") == "bidding":
            return {"type": "bid", "bid": random.choice(list(BID_OPTIONS))}

        if state.get("phase") == "trick":
            if bot_id != state.get("current_turn"):
                return None
            if not _has_valid_move(state, bot_id):
                return None
            max_number = state.get("max_number", 0)
            board = state.get("board") or []
            options = []
            for value in pdata["hand"]:
                if value < 1 or value > max_number:
                    continue
                col_index = value - 1
                for color, available in pdata["color_available"].items():
                    if not available:
                        continue
                    row = _color_index(color)
                    if board[row][col_index] is None:
                        options.append((value, color))
            if not options:
                return None
            value, color = random.choice(options)
            return {"type": "play_card", "card_value": value, "color": color}

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
