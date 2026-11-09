"""回忆三重奏 (Trio): a memory and deduction card game for 3-6 players.

Thirty-six cards, three copies of every number from 1 to 12. Each player sorts
their hand from low to high, and the leftovers lie face down in the middle. On
your turn you reveal up to three cards, one at a time, either by flipping a face
down card in the middle or by asking any player (yourself included) for their
lowest or highest remaining card. Three matching numbers become a trio you keep.
A single mismatch ends your turn at once and every revealed card goes back
exactly where it was.

Rules source and confidence table: designs/task191.md.
"""
import copy
import random
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


NUMBERS: Tuple[int, ...] = tuple(range(1, 13))
COPIES_PER_NUMBER = 3
DECK_SIZE = len(NUMBERS) * COPIES_PER_NUMBER
MAX_REVEALS = 3

# Board Game Arena setup table: hand size and centre cards per player count.
HAND_SIZE: Dict[int, int] = {3: 9, 4: 7, 5: 6, 6: 5}
TABLE_SIZE: Dict[int, int] = {3: 9, 4: 8, 5: 6, 6: 6}

MODE_SIMPLE = "simple"
MODE_SPICY = "spicy"
MODES = (MODE_SIMPLE, MODE_SPICY)
TRIOS_TO_WIN = {MODE_SIMPLE: 3, MODE_SPICY: 2}
LINK_SUM = 7
LINK_DIFFERENCE = 7
LUCKY_NUMBER = 7

STAGE_PLAY = "play"
STAGE_REVEAL = "reveal"
STAGE_GAME_OVER = "game_over"

MAX_LOG_ENTRIES = 60
MAX_HISTORY = 400
# Rounds of complete silence that mean nobody can ever complete a trio again.
STALEMATE_ROUNDS = 3


ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "reveal"},
                "turn": {"type": "integer", "minimum": 1},
                "source": {"enum": ["table", "hand"]},
                "index": {"type": "integer", "minimum": 0, "maximum": 8},
                "player": {"type": "string", "minLength": 1, "maxLength": 80},
                "end": {"enum": ["low", "high"]},
            },
            "required": ["type", "turn", "source"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "continue"}, "turn": {"type": "integer", "minimum": 1}},
            "required": ["type", "turn"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "play_again"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
        "mode": {"enum": list(MODES)},
    },
    "additionalProperties": False,
}

ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


# --- Cards ---------------------------------------------------------------

def build_deck() -> List[str]:
    """Every card id, three copies of each number."""
    return [
        f"n{number}-{copy_index}"
        for number in NUMBERS
        for copy_index in range(COPIES_PER_NUMBER)
    ]


DECK = frozenset(build_deck())


def card_number(card_id: str) -> int:
    return int(str(card_id)[1:].split("-", 1)[0])


def card_copy(card_id: str) -> int:
    return int(str(card_id).split("-", 1)[1])


def card_sort_key(card_id: str) -> Tuple[int, int]:
    return (card_number(card_id), card_copy(card_id))


def connected(first: int, second: int) -> bool:
    """Spicy mode link: the numbers differ by 7 or add up to 7."""
    return abs(first - second) == LINK_DIFFERENCE or first + second == LINK_SUM


def connections(number: int) -> List[int]:
    return sorted({other for other in NUMBERS if other != number and connected(number, other)})


# --- Small helpers -------------------------------------------------------

def _as_tuple(value):
    return tuple(_as_tuple(item) for item in value) if isinstance(value, (list, tuple)) else value


def _json_random_state(rng: random.Random) -> List:
    version, numbers, gaussian = rng.getstate()
    return [version, list(numbers), gaussian]


def _shuffle(state: Dict, items: List) -> None:
    rng = random.Random()
    rng.setstate(_as_tuple(state["rng_state"]))
    rng.shuffle(items)
    state["rng_state"] = _json_random_state(rng)


def _log(state: Dict, message: str) -> None:
    state["log"].append(message)
    if len(state["log"]) > MAX_LOG_ENTRIES:
        del state["log"][: len(state["log"]) - MAX_LOG_ENTRIES]


def _name(state: Dict, player_id: str) -> str:
    return state["player_meta"].get(player_id, {}).get("name", player_id)


def _current_player(state: Dict) -> Optional[str]:
    if state["stage"] != STAGE_PLAY:
        return None
    return state["turn_order"][state["turn_index"]]


def _rematch_target(state: Dict) -> int:
    """How many seats must press Play again.

    Only human seats count. The room only drives bots while a game is running,
    so a bot could never answer a rematch prompt and the table would deadlock.
    """
    humans = [
        pid for pid in state["turn_order"]
        if not state["player_meta"].get(pid, {}).get("is_bot", False)
    ]
    return max(1, len(humans))


def _claimed_numbers(state: Dict) -> List[int]:
    return [number for pid in state["turn_order"] for number in state["players"][pid]["trios"]]


def _revealed_table_indices(state: Dict) -> set:
    return {
        entry["index"]
        for entry in state["revealed"]
        if entry["source"] == "table"
    }


def available_points(state: Dict) -> List[Dict]:
    """Every reveal the board currently offers, regardless of whose turn it is."""
    used = _revealed_table_indices(state)
    points: List[Dict] = []
    for index, card in enumerate(state["table"]):
        if card is not None and index not in used:
            points.append({"source": "table", "index": index})
    for pid in state["turn_order"]:
        hand = state["players"][pid]["hand"]
        if not hand:
            continue
        points.append({"source": "hand", "player": pid, "end": "low"})
        if len(hand) > 1:
            points.append({"source": "hand", "player": pid, "end": "high"})
    return points


def reveal_points(state: Dict) -> List[Dict]:
    """Every legal reveal for whoever is holding the current turn."""
    if state["stage"] != STAGE_PLAY:
        return []
    return available_points(state)


def _point_key(point: Dict) -> Tuple:
    if point["source"] == "table":
        return ("table", point["index"])
    return ("hand", point["player"], point["end"])


def _take_card(state: Dict, point: Dict) -> Optional[str]:
    """Remove the card a reveal point refers to and hand it back."""
    if point["source"] == "table":
        index = point["index"]
        if not isinstance(index, int) or not 0 <= index < len(state["table"]):
            return None
        if index in _revealed_table_indices(state):
            return None
        card = state["table"][index]
        return card
    pid = point.get("player")
    end = point.get("end")
    if pid not in state["players"] or end not in ("low", "high"):
        return None
    hand = state["players"][pid]["hand"]
    if not hand:
        return None
    if end == "high" and len(hand) < 2:
        # The single remaining card is already the low end; asking for the high
        # end of a one card hand is the same card and is not offered twice.
        return None
    return hand[0] if end == "low" else hand[-1]


def _restore(state: Dict, entries: List[Dict]) -> None:
    """Put a failed turn's cards back exactly where they came from."""
    for entry in reversed(entries):
        if entry["source"] == "table":
            continue
        hand = state["players"][entry["player"]]["hand"]
        if entry["end"] == "low":
            hand.insert(0, entry["card"])
        else:
            hand.append(entry["card"])


# --- Win conditions ------------------------------------------------------

def _is_winner(state: Dict, player_id: str) -> bool:
    trios = state["players"][player_id]["trios"]
    if LUCKY_NUMBER in trios:
        return True
    needed = TRIOS_TO_WIN[state["config"]["mode"]]
    if len(trios) < needed:
        return False
    if state["config"]["mode"] == MODE_SIMPLE:
        return True
    for first in trios:
        for second in trios:
            if first != second and connected(first, second):
                return True
    return False


# --- Turn flow -----------------------------------------------------------

def _record_history(state: Dict, player_id: str, success: bool) -> None:
    state["history"].append({
        "turn": state["turn"],
        "player": player_id,
        "reveals": [dict(entry) for entry in state["revealed"]],
        "success": success,
        "number": state["revealed"][0]["number"] if state["revealed"] else None,
    })
    if len(state["history"]) > MAX_HISTORY:
        del state["history"][: len(state["history"]) - MAX_HISTORY]


def _start_turn(state: Dict) -> None:
    """Give the turn to the next player who still has something to reveal."""
    order = state["turn_order"]
    for _ in range(len(order)):
        state["turn_index"] = (state["turn_index"] + 1) % len(order)
        state["turn"] += 1
        candidate = order[state["turn_index"]]
        if available_points(state):
            state["stage"] = STAGE_PLAY
            state["continue_ready"] = []
            return
        _log(state, f"{_name(state, candidate)} 已经没有可以翻的牌，跳过。")
    # Nobody can reveal anything at all; the board is exhausted.
    state["stage"] = STAGE_GAME_OVER
    state["game_over"] = True


def _finish_turn(state: Dict, player_id: str, success: bool) -> None:
    number = state["revealed"][0]["number"] if state["revealed"] else None
    fresh = [entry["card"] for entry in state["revealed"] if entry["card"] not in state["seen"]]
    state["seen"].extend(fresh)
    if success:
        for entry in state["revealed"]:
            if entry["source"] == "table":
                state["table"][entry["index"]] = None
        state["players"][player_id]["trios"].append(number)
        _log(state, f"{_name(state, player_id)} 收走了 {number} 的三重奏！")
    else:
        _restore(state, state["revealed"])
        _log(state, f"{_name(state, player_id)} 翻牌失败，牌全部复原。")
    state["last_result"] = {
        "player": player_id,
        "success": success,
        "number": number,
        "cards": [entry["number"] for entry in state["revealed"]],
        "turn": state["turn"],
        "seq": state["seq"],
    }
    state["seq"] += 1
    _record_history(state, player_id, success)
    state["revealed"] = []
    state["quiet_turns"] = 0 if (success or fresh) else state["quiet_turns"] + 1

    if state["quiet_turns"] >= STALEMATE_ROUNDS * state["player_count"]:
        # Every player has flipped only cards the table already knew for three
        # full rounds. No trio can ever be completed, so the game is called.
        state["stage"] = STAGE_GAME_OVER
        state["game_over"] = True
        state["winner"] = None
        _log(state, "连续多轮没有人翻出新牌，也没有人收成三重奏，本局平局。")
        return

    if success and _is_winner(state, player_id):
        state["stage"] = STAGE_GAME_OVER
        state["game_over"] = True
        state["winner"] = player_id
        _log(state, f"{_name(state, player_id)} 达成胜利条件，赢得比赛！")
        return
    if success:
        state["stage"] = STAGE_REVEAL
        state["continue_ready"] = []
        return
    _start_turn(state)


def _reset_for_rematch(state: Dict) -> None:
    state["stage"] = STAGE_PLAY
    state["turn"] = 1
    state["turn_index"] = 0
    state["revealed"] = []
    state["history"] = []
    state["seen"] = []
    state["quiet_turns"] = 0
    state["last_result"] = None
    state["continue_ready"] = []
    state["rematch_ready"] = []
    state["game_over"] = False
    state["winner"] = None
    state["log"] = []
    _deal(state)


def _deal(state: Dict) -> None:
    count = state["player_count"]
    deck = build_deck()
    _shuffle(state, deck)
    hand_size = HAND_SIZE[count]
    for pid in state["turn_order"]:
        state["players"][pid]["hand"] = sorted(
            (deck.pop() for _ in range(hand_size)), key=card_sort_key
        )
        state["players"][pid]["trios"] = []
    table_size = TABLE_SIZE[count]
    state["table"] = [deck.pop() for _ in range(table_size)]
    _log(state, f"发牌完成：每人 {hand_size} 张手牌，桌面 {table_size} 张暗牌。")


# --- Bot -----------------------------------------------------------------
# A memory-and-deduction policy, so this game is listed in game/ai_metadata.py
# and Select Game shows the 🤖 marker.
#
# Information discipline: the bot reads its own hand, the cards currently face
# up, and the public reveal history. It never reads another player's hand or a
# face down table card from the state; everything else it knows is rebuilt by
# replaying reveals that every human at the table also saw.

def _replay_knowledge(state: Dict, bot_id: Optional[str] = None) -> Dict:
    """Rebuild what a perfect memory would retain from the public reveal log."""
    order = state["turn_order"]
    size = HAND_SIZE[state["player_count"]]
    known: Dict[str, Dict[int, str]] = {pid: {} for pid in order}
    table_known: Dict[int, str] = {}
    low = {pid: 0 for pid in order}
    high = {pid: 0 for pid in order}

    def observe(entry: Dict, low_count: Dict[str, int], high_count: Dict[str, int]) -> None:
        if entry["source"] == "table":
            table_known[entry["index"]] = entry["card"]
            return
        pid = entry["player"]
        if entry["end"] == "low":
            position = low_count[pid]
            low_count[pid] += 1
        else:
            position = size - 1 - high_count[pid]
            high_count[pid] += 1
        known[pid][position] = entry["card"]

    for record in state["history"]:
        temp_low = dict(low)
        temp_high = dict(high)
        for entry in record["reveals"]:
            observe(entry, temp_low, temp_high)
        # A failed turn puts every card back, so its reveals only teach us
        # where those cards sit; a claimed trio removes them for good.
        if record["success"]:
            low, high = temp_low, temp_high

    # The cards face up right now are public too, and temporarily off both ends.
    for entry in state["revealed"]:
        observe(entry, low, high)

    if bot_id in known:
        # A player reads their own hand, so every one of its slots is known. The
        # current hand is the original one with both ends trimmed, which pins
        # each card to its original position.
        for offset, card in enumerate(state["players"][bot_id]["hand"]):
            known[bot_id][low[bot_id] + offset] = card

    return {"known": known, "table": table_known, "low": low, "high": high, "size": size}


def _located_cards(state: Dict, bot_id: str, knowledge: Dict) -> set:
    located = set(state["players"][bot_id]["hand"])
    located.update(entry["card"] for entry in state["revealed"])
    for index, card in knowledge["table"].items():
        if index < len(state["table"]) and state["table"][index] == card:
            located.add(card)
    for pid in state["turn_order"]:
        located.update(knowledge["known"][pid].values())
    return located


def _free_pool(state: Dict, bot_id: str, knowledge: Dict) -> List[str]:
    """Cards whose position nobody at the table has seen yet."""
    gone = set(_claimed_numbers(state))
    located = _located_cards(state, bot_id, knowledge)
    return [
        card for card in build_deck()
        if card_number(card) not in gone and card not in located
    ]


def _hand_bounds(state: Dict, pid: str, position: int, knowledge: Dict) -> Tuple[int, int]:
    """Ascending order clamps an unknown hand slot between its known neighbours."""
    known = knowledge["known"][pid]
    lower = 0
    upper = len(NUMBERS) + 1
    for other, card in known.items():
        if other < position:
            lower = max(lower, card_number(card))
        elif other > position:
            upper = min(upper, card_number(card))
    return lower, upper


def _point_forecast(state: Dict, bot_id: str, knowledge: Dict, point: Dict, pool: List[str]) -> Dict:
    """What number a reveal point is expected to show, and how sure we are."""
    if point["source"] == "table":
        card = knowledge["table"].get(point["index"])
        if card and state["table"][point["index"]] == card:
            return {"card": card, "number": card_number(card), "certain": True, "odds": {}}
        candidates = pool
        position = None
    else:
        pid = point["player"]
        size = knowledge["size"]
        if point["end"] == "low":
            position = knowledge["low"][pid]
        else:
            position = size - 1 - knowledge["high"][pid]
        card = knowledge["known"][pid].get(position)
        if card:
            return {"card": card, "number": card_number(card), "certain": True, "odds": {}}
        if pid == bot_id:
            # The bot can read its own hand, so an unremembered slot is a bug guard.
            hand = state["players"][pid]["hand"]
            card = hand[0] if point["end"] == "low" else hand[-1]
            return {"card": card, "number": card_number(card), "certain": True, "odds": {}}
        lower, upper = _hand_bounds(state, pid, position, knowledge)
        # A sorted hand may hold duplicates, so the neighbours only clamp the
        # range inclusively.
        candidates = [item for item in pool if lower <= card_number(item) <= upper]
    if not candidates:
        candidates = pool
    odds: Dict[int, float] = {}
    for item in candidates:
        number = card_number(item)
        odds[number] = odds.get(number, 0.0) + 1.0 / len(candidates)
    return {"card": None, "number": None, "certain": False, "odds": odds}


def _apply_temp(point: Dict, temp: Dict) -> None:
    if point["source"] == "table":
        temp["table"].add(point["index"])
        return
    pid = point["player"]
    temp["low" if point["end"] == "low" else "high"][pid] += 1


def _known_options(state: Dict, knowledge: Dict, number: int, temp: Dict) -> List[Dict]:
    """Points that memory says will show `number`, given the reveals so far.

    Positions are recomputed every step because asking a player for their low
    card twice walks one slot deeper into that hand.
    """
    size = knowledge["size"]
    options: List[Dict] = []
    for index, card in enumerate(state["table"]):
        if card is None or index in temp["table"]:
            continue
        remembered = knowledge["table"].get(index)
        if remembered == card and card_number(card) == number:
            options.append({"source": "table", "index": index})
    for pid in state["turn_order"]:
        low_position = temp["low"][pid]
        high_position = size - 1 - temp["high"][pid]
        remaining = high_position - low_position + 1
        if remaining <= 0:
            continue
        known = knowledge["known"][pid]
        card = known.get(low_position)
        if card and card_number(card) == number:
            options.append({"source": "hand", "player": pid, "end": "low"})
        card = known.get(high_position)
        if remaining >= 2 and card and card_number(card) == number:
            options.append({"source": "hand", "player": pid, "end": "high"})
    return options


def _known_chain(state: Dict, knowledge: Dict, number: int, length: int) -> Optional[List[Dict]]:
    """A sequence of reveals of one number that memory can guarantee."""
    start = {
        "table": set(_revealed_table_indices(state)),
        "low": {pid: knowledge["low"][pid] for pid in state["turn_order"]},
        "high": {pid: knowledge["high"][pid] for pid in state["turn_order"]},
    }

    def search(chosen: List[Dict], temp: Dict) -> Optional[List[Dict]]:
        if len(chosen) == length:
            return list(chosen)
        for option in _known_options(state, knowledge, number, temp):
            chosen.append(option)
            nested = {
                "table": set(temp["table"]),
                "low": dict(temp["low"]),
                "high": dict(temp["high"]),
            }
            _apply_temp(option, nested)
            found = search(chosen, nested)
            chosen.pop()
            if found:
                return found
        return None

    return search([], start)


def _bot_reveal(state: Dict, bot_id: str) -> Optional[Dict]:
    knowledge = _replay_knowledge(state, bot_id)
    pool = _free_pool(state, bot_id, knowledge)
    points = reveal_points(state)
    if not points:
        return None
    revealed = state["revealed"]
    target = revealed[0]["number"] if revealed else None
    needed = MAX_REVEALS - len(revealed)
    forecasts = {
        _point_key(point): _point_forecast(state, bot_id, knowledge, point, pool)
        for point in points
    }

    # A chain memory can guarantee beats any gamble.
    if needed > 0:
        if target is not None:
            candidates = [target]
        else:
            candidates = sorted({
                forecast["number"] for forecast in forecasts.values()
                if forecast["certain"] and forecast["number"] is not None
            })
        for number in candidates:
            chain = _known_chain(state, knowledge, number, needed)
            if chain:
                return chain[0]

    if target is not None:
        # Keep the turn alive: rank by the chance of matching, and only use
        # certainty to break ties between points that can still match.
        best = None
        for point in points:
            forecast = forecasts[_point_key(point)]
            if forecast["certain"]:
                score = 1.0 if forecast["number"] == target else 0.0
            else:
                score = forecast["odds"].get(target, 0.0)
            # Nothing can match? Then spend the reveal on a card nobody has seen,
            # because flipping a card memory already holds teaches the table nothing.
            key = (
                score,
                0 if forecast["certain"] else 1,
                1 if (score > 0 and forecast["certain"]) else 0,
            )
            if best is None or key > best[0]:
                best = (key, point)
        return best[1] if best else points[0]

    # Opening reveal: start on the number with the most copies already pinned
    # down, so the follow up reveals have something to aim at.
    certain_counts: Dict[int, int] = {}
    for forecast in forecasts.values():
        if forecast["certain"] and forecast["number"] is not None:
            certain_counts[forecast["number"]] = certain_counts.get(forecast["number"], 0) + 1
    best = None
    for point in points:
        forecast = forecasts[_point_key(point)]
        if not forecast["certain"]:
            continue
        number = forecast["number"]
        # A copy whose slot is still unknown might turn up at an end, while a
        # copy already pinned inside a hand never will. Prefer the loose ones.
        loose = sum(1 for card in pool if card_number(card) == number)
        key = (certain_counts[number], loose)
        if best is None or key > best[0]:
            best = (key, point)
    if best:
        return best[1]

    # Nothing is pinned down: gather information, preferring a face down card.
    for point in points:
        if point["source"] == "table" and not forecasts[_point_key(point)]["certain"]:
            return point
    return points[0]


def _bot_choose_action(state: Dict, bot_id: str) -> Optional[Dict]:
    if state["stage"] == STAGE_GAME_OVER:
        return {"type": "play_again"}
    if state["stage"] == STAGE_REVEAL:
        return {"type": "continue", "turn": state["turn"]}
    if _current_player(state) != bot_id:
        return None
    point = _bot_reveal(state, bot_id)
    if point is None:
        return None
    action = {"type": "reveal", "turn": state["turn"], "source": point["source"]}
    if point["source"] == "table":
        action["index"] = point["index"]
    else:
        action["player"] = point["player"]
        action["end"] = point["end"]
    return action


# --- Serialization guard -------------------------------------------------

def _validate_saved_state(state: Dict) -> None:
    def require(condition: bool) -> None:
        if not condition:
            raise ValueError("invalid Trio saved state")

    try:
        require(isinstance(state, dict) and state["game_id"] == "trio" and state["version"] == 1)
        order = state["turn_order"]
        require(isinstance(order, list) and len(order) in HAND_SIZE)
        require(len(set(order)) == len(order) and all(isinstance(pid, str) and pid for pid in order))
        require(set(state["players"]) == set(order) and set(state["player_meta"]) == set(order))
        require(state["player_count"] == len(order))
        require(state["config"]["mode"] in MODES)
        require(state["stage"] in (STAGE_PLAY, STAGE_REVEAL, STAGE_GAME_OVER))
        require(type(state["game_over"]) is bool and state["game_over"] == (state["stage"] == STAGE_GAME_OVER))
        require(type(state["turn"]) is int and state["turn"] >= 1)
        require(type(state["turn_index"]) is int and 0 <= state["turn_index"] < len(order))
        require(state["winner"] is None or state["winner"] in order)
        require(isinstance(state["log"], list) and all(isinstance(line, str) for line in state["log"]))
        require(isinstance(state["history"], list))
        require(isinstance(state["seen"], list) and all(card in build_deck() for card in state["seen"]))
        require(type(state["quiet_turns"]) is int and state["quiet_turns"] >= 0)
        require(isinstance(state["revealed"], list) and len(state["revealed"]) <= MAX_REVEALS)
        require(isinstance(state["continue_ready"], list) and set(state["continue_ready"]) <= set(order))
        require(isinstance(state["rematch_ready"], list) and set(state["rematch_ready"]) <= set(order))

        table = state["table"]
        require(isinstance(table, list) and len(table) == TABLE_SIZE[len(order)])
        # A face up table card is still sitting in its slot, so it is counted once
        # through `revealed` below rather than twice.
        face_up = {
            entry["index"] for entry in state["revealed"] if entry["source"] == "table"
        }
        require(all(isinstance(index, int) and 0 <= index < len(table) for index in face_up))
        seen = [
            card for index, card in enumerate(table)
            if card is not None and index not in face_up
        ]
        gone = 0
        for pid in order:
            player = state["players"][pid]
            require(isinstance(player["hand"], list))
            require(player["hand"] == sorted(player["hand"], key=card_sort_key))
            require(isinstance(player["trios"], list))
            require(all(number in NUMBERS for number in player["trios"]))
            require(len(set(player["trios"])) == len(player["trios"]))
            gone += COPIES_PER_NUMBER * len(player["trios"])
            seen.extend(player["hand"])
        for entry in state["revealed"]:
            require(entry["source"] in ("table", "hand"))
            require(entry["card"] in build_deck())
            seen.append(entry["card"])
        require(len(seen) + gone == DECK_SIZE)
        require(len(set(seen)) == len(seen))
        require(all(card in DECK for card in seen))
        rng = random.Random()
        rng.setstate(_as_tuple(state["rng_state"]))
    except (KeyError, TypeError, IndexError, AttributeError, OverflowError, ValueError) as error:
        if isinstance(error, ValueError) and str(error).startswith("invalid Trio"):
            raise
        raise ValueError("invalid Trio saved state") from error


# --- Game module ---------------------------------------------------------

class TrioGame:
    game_id = "trio"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = {} if config is None else copy.deepcopy(config)
        if not CONFIG_VALIDATOR.is_valid(cfg):
            raise ValueError("invalid Trio configuration")
        if len(players) not in HAND_SIZE:
            raise ValueError("Trio requires 3-6 players")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if len(set(ids)) != len(ids) or any(not isinstance(pid, str) or not pid for pid in ids):
            raise ValueError("player IDs must be unique nonempty strings")
        rng = random.Random(cfg.get("seed"))
        state = {
            "game_id": TrioGame.game_id,
            "version": 1,
            "config": {"mode": cfg.get("mode", MODE_SIMPLE)},
            "rng_state": _json_random_state(rng),
            "turn_order": ids,
            "player_count": len(ids),
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in ordered},
            "players": {pid: {"hand": [], "trios": []} for pid in ids},
            "table": [],
            "revealed": [],
            "history": [],
            "seen": [],
            "quiet_turns": 0,
            "turn": 1,
            "turn_index": 0,
            "stage": STAGE_PLAY,
            "last_result": None,
            "continue_ready": [],
            "rematch_ready": [],
            "game_over": False,
            "winner": None,
            "seq": 0,
            "log": [],
        }
        _deal(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"]:
            return []
        if state["stage"] == STAGE_GAME_OVER:
            if player_id in state["rematch_ready"]:
                return []
            return [] if state["player_meta"].get(player_id, {}).get("is_bot", False) else ["play_again"]
        if state["stage"] == STAGE_REVEAL:
            return [] if player_id in state["continue_ready"] else ["continue"]
        if _current_player(state) != player_id:
            return []
        return ["reveal"] if reveal_points(state) else []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if player_id not in state["players"]:
            return [], "player not found"
        action_type = action["type"]
        if action_type != "play_again" and action.get("turn") != state["turn"]:
            return [], "stale turn"
        if action_type not in TrioGame.get_legal_actions(state, player_id):
            return [], "action unavailable in this stage"

        if action_type == "play_again":
            state["rematch_ready"].append(player_id)
            if len(state["rematch_ready"]) >= _rematch_target(state):
                _reset_for_rematch(state)
            return [], None

        if action_type == "continue":
            state["continue_ready"].append(player_id)
            if len(state["continue_ready"]) == len(state["turn_order"]):
                _start_turn(state)
            return [], None

        if len(state["revealed"]) >= MAX_REVEALS:
            return [], "this turn already revealed three cards"
        point = {"source": action["source"]}
        if action["source"] == "table":
            if "index" not in action:
                return [], "a table reveal needs an index"
            point["index"] = action["index"]
        else:
            if "player" not in action or "end" not in action:
                return [], "a hand reveal needs a player and an end"
            point["player"] = action["player"]
            point["end"] = action["end"]
        card = _take_card(state, point)
        if card is None:
            return [], "that card cannot be revealed"

        if point["source"] == "hand":
            hand = state["players"][point["player"]]["hand"]
            hand.remove(card)
        entry = {
            "source": point["source"],
            "player": point.get("player"),
            "end": point.get("end"),
            "index": point.get("index"),
            "card": card,
            "number": card_number(card),
        }
        state["revealed"].append(entry)
        first = state["revealed"][0]["number"]
        count = len(state["revealed"])
        if count == 1:
            return [], None
        if entry["number"] != first:
            _finish_turn(state, player_id, False)
            return [], None
        if count < MAX_REVEALS:
            return [], None
        _finish_turn(state, player_id, True)
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        reveal_all = state["stage"] == STAGE_GAME_OVER
        face_up = _revealed_table_indices(state)

        players_view = []
        for index, pid in enumerate(state["turn_order"]):
            player = state["players"][pid]
            meta = state["player_meta"][pid]
            mine = pid == viewer_id
            hand = player["hand"]
            players_view.append({
                "player_id": pid,
                "name": meta.get("name", pid),
                "seat": meta.get("seat", index),
                "is_bot": bool(meta.get("is_bot", False)),
                "is_you": mine,
                "hand_count": len(hand),
                "hand": [{"id": card, "number": card_number(card)} for card in hand]
                        if (mine or reveal_all) else None,
                "trios": list(player["trios"]),
                "is_current": pid == _current_player(state),
                "ready": pid in state["continue_ready"] or pid in state["rematch_ready"],
            })

        table_view = []
        for index, card in enumerate(state["table"]):
            shown = card is not None and (index in face_up or reveal_all)
            table_view.append({
                "index": index,
                "empty": card is None,
                "face_up": index in face_up,
                "number": card_number(card) if shown else None,
            })

        return copy.deepcopy({
            "game_id": TrioGame.game_id,
            "stage": state["stage"],
            "turn": state["turn"],
            "mode": state["config"]["mode"],
            "trios_to_win": TRIOS_TO_WIN[state["config"]["mode"]],
            "you": viewer_id,
            "current_player": _current_player(state),
            "players": players_view,
            "table": table_view,
            "revealed": [
                {
                    "source": entry["source"],
                    "player": entry["player"],
                    "end": entry["end"],
                    "index": entry["index"],
                    "number": entry["number"],
                }
                for entry in state["revealed"]
            ],
            "last_result": state["last_result"],
            "continue_ready": list(state["continue_ready"]),
            "rematch_ready": list(state["rematch_ready"]),
            "game_over": state["game_over"],
            "winner": state["winner"],
            "legal_actions": TrioGame.get_legal_actions(state, viewer_id),
            "log": list(state["log"]),
        })

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") and bot_id in state.get("rematch_ready", []):
            return None
        if not TrioGame.get_legal_actions(state, bot_id):
            return None
        return _bot_choose_action(state, bot_id)

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        restored = copy.deepcopy(payload)
        _validate_saved_state(restored)
        return restored


__all__ = [
    "ACTION_SCHEMA",
    "CONFIG_SCHEMA",
    "COPIES_PER_NUMBER",
    "DECK_SIZE",
    "HAND_SIZE",
    "MAX_REVEALS",
    "MODE_SIMPLE",
    "MODE_SPICY",
    "MODES",
    "STAGE_GAME_OVER",
    "STAGE_PLAY",
    "STAGE_REVEAL",
    "TABLE_SIZE",
    "TRIOS_TO_WIN",
    "TrioGame",
    "build_deck",
    "card_number",
    "connected",
    "connections",
    "reveal_points",
]
