import copy
import itertools
import random
from collections import Counter
from typing import Callable, Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


COLORS = ("red", "blue", "orange", "black")
TILES = {
    f"{color}_{number}_{duplicate}": {"color": color, "number": number, "joker": False}
    for color in COLORS for number in range(1, 14) for duplicate in range(2)
}
TILES.update({f"joker_{duplicate}": {"color": "joker", "number": 0, "joker": True}
              for duplicate in range(2)})
TABLE_SCHEMA = {
    "type": "array", "maxItems": 106,
    "items": {"type": "array", "minItems": 1, "maxItems": 13,
              "items": {"type": "string", "enum": list(TILES)}},
}
CONFIG_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "rounds": {"type": "integer", "minimum": 1, "maximum": 8, "default": 1},
        "seed": {"type": "integer"},
    },
}
ACTION_SCHEMA = {
    "type": "object", "additionalProperties": False, "required": ["type", "turn"],
    "properties": {
        "type": {"enum": ["preview", "reset", "commit", "draw", "next_round"]},
        "turn": {"type": "integer", "minimum": 1},
        "table": TABLE_SCHEMA,
    },
    "allOf": [{"if": {"properties": {"type": {"enum": ["preview", "commit"]}}},
               "then": {"required": ["table"]}}],
}
CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)
ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)


def meld_options(meld: List[str]) -> List[Dict]:
    if not 3 <= len(meld) <= 13 or len(set(meld)) != len(meld) or any(tile not in TILES for tile in meld):
        return []
    natural = [TILES[tile] for tile in meld if not TILES[tile]["joker"]]
    if not natural:
        return []
    options = []
    numbers = {tile["number"] for tile in natural}
    colors = {tile["color"] for tile in natural}
    jokers = [tile for tile in meld if TILES[tile]["joker"]]
    if len(meld) <= 4 and len(numbers) == 1 and len(colors) == len(natural):
        number = natural[0]["number"]
        for replacements in itertools.permutations([color for color in COLORS if color not in colors], len(jokers)):
            options.append({"kind": "group", "points": number * len(meld),
                            "bindings": {tile: (color, number) for tile, color in zip(jokers, replacements)}})
    if len(colors) == 1 and len(numbers) == len(natural):
        color = natural[0]["color"]
        for start in range(1, 15 - len(meld)):
            interval = set(range(start, start + len(meld)))
            if not numbers <= interval:
                continue
            for replacements in itertools.permutations(sorted(interval - numbers)):
                options.append({"kind": "run", "points": sum(interval),
                                "bindings": {tile: (color, number) for tile, number in zip(jokers, replacements)}})
    return options


def _structure_error(state: Dict, player_id: str, table: List[List[str]]) -> Optional[str]:
    flat = [tile for meld in table for tile in meld]
    original = {tile for meld in state["table"] for tile in meld}
    allowed = original | set(state["players"][player_id]["hand"])
    if len(flat) != len(set(flat)):
        return "A tile cannot appear twice."
    if not set(flat) <= allowed:
        return "You may only use table tiles and your own rack."
    if not original <= set(flat):
        return "Every existing table tile must remain on the table."
    if not state["players"][player_id]["opened"]:
        for meld in state["table"]:
            if meld not in table:
                return "Open with 30 points from your rack before rearranging the table."
        if any(set(meld) & original and meld not in state["table"] for meld in table):
            return "Your opening melds must use only your rack."
    return None


def _joker_error(state: Dict, player_id: str, table: List[List[str]]) -> Optional[str]:
    rack = set(state["players"][player_id]["hand"])
    for old_meld in state["table"]:
        for joker in (tile for tile in old_meld if TILES[tile]["joker"]):
            new_meld = next(meld for meld in table if joker in meld)
            old_options = meld_options(old_meld)
            new_options = meld_options(new_meld)
            old_natural = {tile for tile in old_meld if not TILES[tile]["joker"]}
            if old_natural <= set(new_meld) and any(
                old["bindings"][joker] == new["bindings"][joker]
                for old in old_options for new in new_options
            ):
                continue
            replacements = [meld for meld in table if old_natural <= set(meld) and joker not in meld]
            replaced = any(
                any((TILES[tile]["color"], TILES[tile]["number"]) == old["bindings"][joker]
                    for tile in set(meld) - old_natural if not TILES[tile]["joker"])
                for meld in replacements for old in old_options
            )
            if not replaced or len(set(new_meld) & rack) < 2:
                return "Replace a table joker with its natural tile, then reuse it with at least two rack tiles."
    return None


def validate_table(state: Dict, player_id: str, table: List[List[str]]) -> Optional[str]:
    error = _structure_error(state, player_id, table)
    if error:
        return error
    options = [meld_options(meld) for meld in table]
    if any(not choices for choices in options):
        return "Each meld needs 3–4 different colors of one number, or 3–13 consecutive numbers of one color."
    rack = set(state["players"][player_id]["hand"])
    if not rack.intersection(tile for meld in table for tile in meld):
        return "Play at least one tile from your rack, or draw."
    if not state["players"][player_id]["opened"]:
        points = sum(max(option["points"] for option in choices)
                     for meld, choices in zip(table, options) if set(meld) <= rack)
        if points < 30:
            return f"Your initial melds total {points}. At least 30 points are required."
    return _joker_error(state, player_id, table)


def _log(state: Dict, text: str) -> None:
    state["log"] = (state["log"] + [text])[-60:]


def _deal(state: Dict) -> None:
    deck = list(TILES)
    random.Random(state["round_seeds"][state["round"] - 1]).shuffle(deck)
    for player in state["players"].values():
        player["hand"] = [deck.pop() for _ in range(14)]
        player["opened"] = False
    state.update(pool=deck, table=[], draft=None, ready=[], passes=0, phase="play",
                 turn_index=(state["round"] - 1) % len(state["turn_order"]), round_result=None)
    _log(state, f"Round {state['round']}: 14 tiles dealt to each rack.")


def _finish_round(state: Dict, winner: Optional[str]) -> None:
    penalties = {pid: sum(30 if TILES[tile]["joker"] else TILES[tile]["number"] for tile in player["hand"])
                 for pid, player in state["players"].items()}
    if winner is None:
        lowest = min(penalties.values())
        winners = [pid for pid, penalty in penalties.items() if penalty == lowest]
        changes = {pid: lowest - penalty for pid, penalty in penalties.items()}
        reward = -sum(changes.values())
        for index, pid in enumerate(winners):
            changes[pid] = reward // len(winners) + (index < reward % len(winners))
    else:
        winners = [winner]
        changes = {pid: -penalty for pid, penalty in penalties.items()}
        changes[winner] = sum(penalties.values()) - penalties[winner]
    for pid, change in changes.items():
        state["players"][pid]["score"] += change
    state["round_result"] = {"winners": winners, "blocked": winner is None,
                             "penalties": penalties, "changes": changes}
    state["history"].append(copy.deepcopy(state["round_result"]))
    state["draft"] = None
    state["ready"] = []
    if state["round"] == state["config"]["rounds"]:
        state["phase"] = "game_over"
        state["game_over"] = True
        best = max(player["score"] for player in state["players"].values())
        state["winner"] = [pid for pid, player in state["players"].items() if player["score"] == best]
    else:
        state["phase"] = "round_review"
    _log(state, "Round finished. " + ("The pool is empty and everyone passed." if winner is None else "A rack is empty!"))


def _advance(state: Dict) -> None:
    state["turn"] += 1
    state["turn_index"] = (state["turn_index"] + 1) % len(state["turn_order"])
    state["draft"] = None


def _candidates(hand: List[str]) -> List[List[str]]:
    jokers = [tile for tile in hand if TILES[tile]["joker"]]
    natural = [tile for tile in hand if not TILES[tile]["joker"]]
    found = {}
    for number in range(1, 14):
        colors = [[tile for tile in natural if TILES[tile]["number"] == number and TILES[tile]["color"] == color]
                  for color in COLORS]
        for size in (3, 4):
            for joker_count in range(min(len(jokers), size - 1) + 1):
                for picked in itertools.combinations([choices for choices in colors if choices], size - joker_count):
                    for selected in itertools.product(*picked):
                        for wildcards in itertools.combinations(jokers, joker_count):
                            meld = list(selected) + list(wildcards)
                            found[tuple(sorted(meld))] = meld
    for color in COLORS:
        by_number = {number: [tile for tile in natural if TILES[tile]["color"] == color and TILES[tile]["number"] == number]
                     for number in range(1, 14)}
        for start in range(1, 12):
            for end in range(start + 2, 14):
                missing = [number for number in range(start, end + 1) if not by_number[number]]
                if len(missing) > len(jokers):
                    break
                for duplicate in (0, 1):
                    for wildcards in itertools.combinations(jokers, len(missing)):
                        meld = [by_number[number][min(duplicate, len(by_number[number]) - 1)]
                                for number in range(start, end + 1) if by_number[number]] + list(wildcards)
                        found[tuple(sorted(meld))] = meld
    return sorted(found.values(), key=lambda meld: (len(meld), sum(TILES[tile]["number"] for tile in meld)), reverse=True)


def _best_melds(hand: List[str], opening: bool) -> List[List[str]]:
    indices = {tile: index for index, tile in enumerate(hand)}
    candidates = [(sum(1 << indices[tile] for tile in meld), meld,
                   max(option["points"] for option in meld_options(meld))) for meld in _candidates(hand)]
    best = []
    best_value = (-1, -1)
    visited = set()
    budget = 4000

    def search(used: int, points: int, chosen: List[List[str]]) -> None:
        nonlocal best, best_value, budget
        key = (used, min(points, 30))
        if budget <= 0 or key in visited:
            return
        budget -= 1
        visited.add(key)
        value = (bin(used).count("1"), points)
        if (not opening or points >= 30) and value > best_value:
            best, best_value = list(chosen), value
        for mask, meld, score in candidates:
            if not used & mask:
                search(used | mask, points + score, chosen + [meld])

    search(0, 0, [])
    return best


def _tile_kind(tile: str) -> int:
    value = TILES[tile]
    return 52 + int(tile[-1]) if value["joker"] else COLORS.index(value["color"]) * 13 + value["number"] - 1


def _meld_patterns(tiles: List[str]) -> List[Tuple[Tuple[int, ...], int]]:
    present = {_tile_kind(tile) for tile in tiles}
    jokers = sorted(present & {52, 53})
    patterns = {}
    for number in range(13):
        available = [color * 13 + number for color in range(4) if color * 13 + number in present]
        for size in (3, 4):
            for wild_count in range(min(len(jokers), size - 1) + 1):
                for natural in itertools.combinations(available, size - wild_count):
                    for wild in itertools.combinations(jokers, wild_count):
                        patterns[natural + wild] = (number + 1) * size
    for color in range(4):
        for start in range(1, 12):
            for end in range(start + 2, 14):
                interval = tuple(color * 13 + number - 1 for number in range(start, end + 1))
                natural = tuple(kind for kind in interval if kind in present)
                missing = len(interval) - len(natural)
                if missing > len(jokers):
                    break
                for extra in range(min(len(jokers) - missing, len(natural) - 1) + 1):
                    for replaced in itertools.combinations(natural, extra):
                        kept = tuple(kind for kind in natural if kind not in replaced)
                        for wild in itertools.combinations(jokers, missing + extra):
                            kinds = kept + wild
                            patterns[kinds] = max(patterns.get(kinds, 0), sum(range(start, end + 1)))
    return list(patterns.items())


def _greedy_layout(state: Dict, bot_id: str) -> List[List[str]]:
    hand = list(state["players"][bot_id]["hand"])
    table = copy.deepcopy(state["table"])
    opened = state["players"][bot_id]["opened"]
    if opened:
        progress = True
        while progress:
            progress = False
            for tile in list(hand):
                if TILES[tile]["joker"]:
                    continue
                for index, meld in enumerate(table):
                    proposal = table[:index] + [meld + [tile]] + table[index + 1:]
                    if meld_options(meld + [tile]) and not _joker_error(state, bot_id, proposal):
                        table[index] = meld + [tile]
                        hand.remove(tile)
                        progress = True
                        break
    table.extend(_best_melds(hand, not opened))
    return table


def _layout_value(hand: List[str], table: List[List[str]], urgent: bool) -> Tuple[int, int]:
    played = set(tile for meld in table for tile in meld) & set(hand)
    remaining = [tile for tile in hand if tile not in played]
    penalty = sum(30 if TILES[tile]["joker"] else TILES[tile]["number"] for tile in played)
    potential = sum(18 for tile in remaining if TILES[tile]["joker"])
    natural = [TILES[tile] for tile in remaining if not TILES[tile]["joker"]]
    for first, second in itertools.combinations(natural, 2):
        if first["number"] == second["number"] and first["color"] != second["color"]:
            potential += 4
        elif first["color"] == second["color"]:
            gap = abs(first["number"] - second["number"])
            potential += 5 if gap == 1 else 2 if gap == 2 else 0
    return len(played), penalty * (3 if urgent else 1) + potential


def _search_layout(state: Dict, bot_id: str, table: List[List[str]], hand: List[str],
                   fixed: List[List[str]], consider: Callable[[List[List[str]]], None], limit: int = 80000) -> None:
    opened = state["players"][bot_id]["opened"]
    locked = [meld for meld in table if any(TILES[tile]["joker"] for tile in meld)] if opened else []
    board = [tile for meld in table if meld not in locked for tile in meld] if opened else []
    prefix = fixed if opened else fixed + table
    pools = {}
    for tile in board + sorted(hand):
        pools.setdefault(_tile_kind(tile), []).append(tile)
    size = 54 + len(locked)
    remaining = [len(pools.get(kind, [])) for kind in range(size)]
    rack_counts = Counter(_tile_kind(tile) for tile in hand)
    required = Counter(_tile_kind(tile) for tile in board)
    candidates = []
    for kinds, points in _meld_patterns(board + hand):
        candidates.append((sum(1 << kind for kind in kinds), kinds, points, ()))
    for index, meld in enumerate(locked):
        token = 54 + index
        remaining[token] = 1
        required[token] = 1
        base = {_tile_kind(tile) for tile in meld}
        old_options = meld_options(meld)
        own_pools = {}
        for tile in hand:
            own_pools.setdefault(_tile_kind(tile), []).append(tile)
        for kinds, points in _meld_patterns(meld + hand):
            if not base <= set(kinds):
                continue
            extras = tuple(kind for kind in kinds if kind not in base)
            if any(kind not in own_pools for kind in extras):
                continue
            extended = meld + [own_pools[kind][0] for kind in extras]
            options = meld_options(extended)
            if any(not any(old["bindings"][joker] == new["bindings"][joker]
                           for old in old_options for new in options)
                   for joker in meld if TILES[joker]["joker"]):
                continue
            consumed = extras + (token,)
            candidates.append((sum(1 << kind for kind in consumed), consumed, points, tuple(meld)))
    by_kind = [[] for _ in range(size)]
    candidates.sort(key=lambda candidate: (
        sum(required[kind] == 0 for kind in candidate[1]), len(candidate[1]), candidate[2]), reverse=True)
    for index, candidate in enumerate(candidates):
        for kind in candidate[1]:
            by_kind[kind].append(index)
    budget = {"checks": limit, "nodes": 6000}
    visited = set()
    selected = []
    initial = tuple(remaining)
    initial_required = sum(1 << kind for kind, count in required.items() if count)
    initial_present = sum(1 << kind for kind, count in enumerate(remaining) if count)

    def materialize() -> List[List[str]]:
        offsets = Counter()
        result = [list(meld) for meld in prefix]
        for index in selected:
            meld = list(candidates[index][3])
            for kind in candidates[index][1]:
                if kind < 54:
                    meld.append(pools[kind][offsets[kind]])
                    offsets[kind] += 1
            result.append(meld)
        return result

    def search(present: int, needed: int, blocked: int, points: int) -> None:
        if budget["checks"] <= 0 or budget["nodes"] <= 0:
            return
        budget["nodes"] -= 1
        key = (tuple(remaining), blocked, min(points, 30) if not opened else 0)
        if key in visited:
            return
        visited.add(key)
        if not needed and (opened or points >= 30):
            consider(materialize())
            if not any(remaining[kind] for kind in rack_counts):
                return
        available = present & ~blocked
        choices = None
        pivot = None
        kinds = needed or available
        while kinds:
            bit = kinds & -kinds
            kind = bit.bit_length() - 1
            kinds ^= bit
            feasible = []
            for index in by_kind[kind]:
                budget["checks"] -= 1
                if budget["checks"] < 0:
                    return
                if candidates[index][0] & available == candidates[index][0]:
                    feasible.append(index)
            if needed and not feasible:
                return
            if choices is None or len(feasible) < len(choices):
                choices, pivot = feasible, kind
                if len(choices) <= 1:
                    break
        if pivot is None:
            return
        for index in choices:
            changed_present, changed_needed = present, needed
            for kind in candidates[index][1]:
                remaining[kind] -= 1
                if remaining[kind] == 0:
                    changed_present &= ~(1 << kind)
                if remaining[kind] <= rack_counts[kind]:
                    changed_needed &= ~(1 << kind)
            selected.append(index)
            search(changed_present, changed_needed, blocked, points + candidates[index][2])
            selected.pop()
            for kind in candidates[index][1]:
                remaining[kind] += 1
        if not needed:
            search(present, needed, blocked | (1 << pivot), points)

    search(initial_present, initial_required, 0, 0)
    assert tuple(remaining) == initial


def _retrieval_plans(state: Dict, bot_id: str) -> List[Tuple[List[List[str]], List[str], List[List[str]]]]:
    hand = state["players"][bot_id]["hand"]
    plans = []
    for index, meld in enumerate(state["table"]):
        for joker in (tile for tile in meld if TILES[tile]["joker"]):
            meanings = {option["bindings"][joker] for option in meld_options(meld)}
            for replacement in hand:
                value = TILES[replacement]
                if (value["color"], value["number"]) not in meanings:
                    continue
                available = [tile for tile in hand if tile != replacement]
                own_pools = {}
                for tile in available + [joker]:
                    own_pools.setdefault(_tile_kind(tile), []).append(tile)
                for kinds, _ in _meld_patterns(available + [joker]):
                    if _tile_kind(joker) not in kinds:
                        continue
                    new_meld = [own_pools[kind][0] for kind in kinds]
                    if len(set(new_meld) & set(hand)) < 2:
                        continue
                    restored = [tile if tile != joker else replacement for tile in meld]
                    fixed = [restored, new_meld]
                    rest = [list(group) for position, group in enumerate(state["table"]) if position != index]
                    if validate_table(state, bot_id, rest + fixed):
                        continue
                    remaining = [tile for tile in available if tile not in new_meld]
                    plans.append((rest, remaining, fixed))
    plans.sort(key=lambda plan: _layout_value(hand, plan[0] + plan[2], False), reverse=True)
    return plans[:4]


def _choose_layout(state: Dict, bot_id: str) -> Optional[List[List[str]]]:
    hand = state["players"][bot_id]["hand"]
    opponents = [len(player["hand"]) for pid, player in state["players"].items() if pid != bot_id]
    urgent = min(opponents, default=14) <= 3 or len(state["pool"]) <= len(state["players"])
    best = None
    best_value = (-1, -1)

    def consider(table: List[List[str]]) -> None:
        nonlocal best, best_value
        value = _layout_value(hand, table, urgent)
        if value <= best_value or validate_table(state, bot_id, table):
            return
        best, best_value = table, value

    consider(_greedy_layout(state, bot_id))
    if best_value[0] == len(hand):
        return best
    _search_layout(state, bot_id, state["table"], list(hand), [], consider)
    if state["players"][bot_id]["opened"] and best_value[0] != len(hand):
        for table, remaining, fixed in _retrieval_plans(state, bot_id):
            consider(table + fixed)
            _search_layout(state, bot_id, table, remaining, fixed, consider, limit=20000)
            if best_value[0] == len(hand):
                break
    return best


class RummikubGame:
    game_id = "rummikub"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = copy.deepcopy(config or {})
        if not CONFIG_VALIDATOR.is_valid(cfg):
            raise ValueError("Invalid Rummikub configuration.")
        if not 2 <= len(players) <= 4:
            raise ValueError("Rummikub requires 2–4 players.")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if len(set(ids)) != len(ids) or any(not isinstance(pid, str) or not pid for pid in ids):
            raise ValueError("Player IDs must be unique nonempty strings.")
        rng = random.Random(cfg.get("seed"))
        rounds = cfg.get("rounds", 1)
        state = {
            "game_id": "rummikub", "version": 1, "config": {"rounds": rounds},
            "players": {pid: {"hand": [], "opened": False, "score": 0} for pid in ids},
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in ordered},
            "turn_order": ids, "round": 1, "turn": 1,
            "round_seeds": [rng.getrandbits(64) for _ in range(rounds)],
            "history": [], "log": [], "game_over": False, "winner": [],
        }
        _deal(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] == "round_review":
            return [] if player_id in state["ready"] else ["next_round"]
        if player_id != state["turn_order"][state["turn_index"]]:
            return []
        return ["preview", "reset", "commit", "draw"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action schema."
        if action["turn"] != state["turn"]:
            return [], "This turn has already ended."
        if action["type"] not in RummikubGame.get_legal_actions(state, player_id):
            return [], "It is not your turn."
        kind = action["type"]
        if kind == "next_round":
            state["ready"].append(player_id)
            if len(state["ready"]) == len(state["players"]):
                state["round"] += 1
                state["turn"] += 1
                _deal(state)
            return [], None
        if kind == "reset":
            state["draft"] = None
            return [], None
        if kind == "preview":
            error = _structure_error(state, player_id, action["table"])
            if error:
                return [], error
            state["draft"] = copy.deepcopy(action["table"])
            return [], None
        if kind == "draw":
            state["draft"] = None
            if state["pool"]:
                state["players"][player_id]["hand"].append(state["pool"].pop())
                state["passes"] = 0
                _log(state, f"{state['player_meta'][player_id]['name']} drew one tile.")
            else:
                state["passes"] += 1
                _log(state, f"{state['player_meta'][player_id]['name']} passed.")
            if state["passes"] >= len(state["players"]):
                _finish_round(state, None)
            _advance(state)
            return [], None
        table = action["table"]
        error = validate_table(state, player_id, table)
        if error:
            return [], error
        played = set(tile for meld in table for tile in meld) & set(state["players"][player_id]["hand"])
        state["players"][player_id]["hand"] = [tile for tile in state["players"][player_id]["hand"] if tile not in played]
        state["players"][player_id]["opened"] = True
        state["table"] = copy.deepcopy(table)
        state["passes"] = 0
        _log(state, f"{state['player_meta'][player_id]['name']} played {len(played)} tiles.")
        if not state["players"][player_id]["hand"]:
            _finish_round(state, player_id)
        _advance(state)
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        actor = state["turn_order"][state["turn_index"]]
        draft = state["draft"]
        return copy.deepcopy({
            "game_id": "rummikub", "you": viewer_id, "phase": state["phase"], "turn": state["turn"],
            "round": state["round"], "rounds": state["config"]["rounds"],
            "current_player": actor if state["phase"] == "play" else None,
            "players": [{"player_id": pid, "name": state["player_meta"][pid]["name"],
                         "count": len(state["players"][pid]["hand"]),
                         "opened": state["players"][pid]["opened"], "score": state["players"][pid]["score"],
                         "hand": state["players"][pid]["hand"] if viewer_id == pid or state["phase"] != "play" else None}
                        for pid in state["turn_order"]],
            "table": state["table"], "draft": draft, "pool_count": len(state["pool"]),
            "draft_error": validate_table(state, actor, draft) if draft is not None else None,
            "round_result": state["round_result"], "ready": state["ready"],
            "game_over": state["game_over"], "winner": state["winner"],
            "legal_actions": RummikubGame.get_legal_actions(state, viewer_id), "log": state["log"],
        })

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = RummikubGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        if "next_round" in legal:
            return {"type": "next_round", "turn": state["turn"]}
        table = _choose_layout(state, bot_id)
        if table is not None:
            return {"type": "commit", "turn": state["turn"], "table": table}
        return {"type": "draw", "turn": state["turn"]}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        state = copy.deepcopy(payload)
        try:
            if state["game_id"] != "rummikub" or state["version"] != 1:
                raise ValueError("Unknown Rummikub save version.")
            order = state["turn_order"]
            assert 2 <= len(order) <= 4 and len(set(order)) == len(order)
            assert set(order) == set(state["players"]) == set(state["player_meta"])
            assert CONFIG_VALIDATOR.is_valid(state["config"])
            assert 1 <= state["round"] <= state["config"]["rounds"]
            assert len(state["round_seeds"]) == state["config"]["rounds"]
            assert type(state["turn"]) is int and state["turn"] >= 1
            assert type(state["turn_index"]) is int and 0 <= state["turn_index"] < len(order)
            assert state["phase"] in ("play", "round_review", "game_over")
            assert state["game_over"] == (state["phase"] == "game_over")
            assert len(state["ready"]) == len(set(state["ready"])) and set(state["ready"]) <= set(order)
            tiles = state["pool"] + [tile for meld in state["table"] for tile in meld]
            for player in state["players"].values():
                tiles += player["hand"]
                assert type(player["opened"]) is bool and type(player["score"]) is int
            assert Counter(tiles) == Counter(TILES.keys())
            assert all(meld_options(meld) for meld in state["table"])
            assert Draft7Validator(TABLE_SCHEMA).is_valid(state["table"])
            if state["draft"] is not None:
                assert state["phase"] == "play" and Draft7Validator(TABLE_SCHEMA).is_valid(state["draft"])
                assert _structure_error(state, order[state["turn_index"]], state["draft"]) is None
        except (AssertionError, KeyError, TypeError, IndexError) as exc:
            raise ValueError("Invalid Rummikub save.") from exc
        return state
