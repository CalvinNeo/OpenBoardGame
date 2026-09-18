import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple


DIE_IDS = tuple(f"die-{index}" for index in range(1, 8))
DIE_FACES = (1, 2, 3, 4, 5, "skull")
DICE_COSTS = {3: 0, 4: 1, 5: 3, 6: 6, 7: 10}
LEVEL_CAPACITY = {1: 7, 2: 7, 3: 7, 4: 2, 5: 1}
PHASES = {
    "buy_dice",
    "await_roll",
    "after_roll",
    "post_place",
    "choose_payout",
    "turn_result",
    "game_over",
}

BET_SPECS = (
    {
        "bet_id": "pick_bust",
        "card_number": 1,
        "side": "left",
        "name": "Pick n' Bust",
        "description": "Bust Out after at least one Nose Pick",
        "payouts": [10, 8, 5],
    },
    {
        "bet_id": "mad_nargash",
        "card_number": 1,
        "side": "right",
        "name": "Mad Nargash",
        "description": "Gem Out with only skull dice",
        "payouts": [8, 5, 3],
    },
    {
        "bet_id": "grim_grin",
        "card_number": 2,
        "side": "left",
        "name": "Grim Grin",
        "description": "Run Out with dice only on the teeth",
        "payouts": [5, 3, 2],
    },
    {
        "bet_id": "emerald_skull",
        "card_number": 2,
        "side": "right",
        "name": "Emerald Skull",
        "description": "Double Out with a Full Skull",
        "payouts": [10, 8, 5],
    },
    {
        "bet_id": "busted_fowl",
        "card_number": 3,
        "side": "left",
        "name": "Busted Fowl",
        "description": "Bust Out or Chicken Out",
        "payouts": [5, 3, 2],
    },
    {
        "bet_id": "final_jewel",
        "card_number": 3,
        "side": "right",
        "name": "Final Jewel",
        "description": "Gem Out",
        "payouts": [2, 1],
    },
    {
        "bet_id": "empty_hands",
        "card_number": 4,
        "side": "left",
        "name": "Empty Hands",
        "description": "Run Out",
        "payouts": [2, 1],
    },
    {
        "bet_id": "empty_shiny",
        "card_number": 4,
        "side": "right",
        "name": "Empty n' Shiny",
        "description": "Double Out",
        "payouts": [5, 3, 2],
    },
)
BET_BY_ID = {spec["bet_id"]: spec for spec in BET_SPECS}


def _clean_config(config: Optional[Dict]) -> Dict:
    clean = {"betting_mode": "standard"}
    if isinstance(config, dict):
        seed = config.get("seed")
        if isinstance(seed, (str, int)) and not isinstance(seed, bool):
            clean["seed"] = seed
    return clean


def _ordered_players(players: List[Dict]) -> List[Dict]:
    return sorted(players, key=lambda item: (int(item.get("seat", 0)), str(item.get("player_id"))))


def _rng(state: Dict, purpose: str) -> random.Random:
    counter = int(state.get("rng_counter", 0))
    state["rng_counter"] = counter + 1
    seed = f"{state.get('base_seed')}:{state.get('game_index', 1)}:{counter}:{purpose}"
    return random.Random(seed)


def _player_name(state: Dict, player_id: str) -> str:
    return str(state.get("player_meta", {}).get(player_id, {}).get("name") or player_id)


def _record(state: Dict, events: List[Dict], event_type: str, message: str, **payload: object) -> None:
    sequence = int(state.get("activity_sequence", 0)) + 1
    state["activity_sequence"] = sequence
    item = {"sequence": sequence, "type": event_type, "message": message, **copy.deepcopy(payload)}
    state.setdefault("activity", []).append(item)
    state["activity"] = state["activity"][-100:]
    state["last_action"] = item
    events.append({"type": f"emerald_skulls:{event_type}", "payload": copy.deepcopy(payload)})


def _new_dice() -> List[Dict]:
    return [{"die_id": die_id, "face": None, "zone": "supply", "level": None} for die_id in DIE_IDS]


def _dice_in_zone(state: Dict, zone: str) -> List[Dict]:
    return [die for die in state.get("dice", []) if die.get("zone") == zone]


def _board_dice(state: Dict) -> List[Dict]:
    return _dice_in_zone(state, "board")


def _reset_turn_surface(state: Dict) -> None:
    state["phase"] = "buy_dice"
    state["chosen_dice_count"] = None
    state["dice_cost"] = 0
    state["dice"] = _new_dice()
    state["minimum_level"] = 1
    state["nose_picks"] = 0
    state["roll_count"] = 0
    state["bet_sequence"] = 0
    state["bet_stacks"] = {spec["bet_id"]: [] for spec in BET_SPECS}
    state["result"] = None
    state["payout_options"] = []
    state["turn_result"] = None
    state["review_ready"] = []
    for player_state in state["players"].values():
        player_state["bets"] = []
        player_state["ready"] = False


def _setup_match(state: Dict) -> None:
    state["rng_counter"] = 0
    state["turn_number"] = 1
    state["gear_supply"] = 40 * len(state["turn_order"])
    state["game_over"] = False
    state["winner_ids"] = []
    state["rematch_ready"] = []
    state["activity"] = []
    state["activity_sequence"] = 0
    state["last_action"] = None
    for player_state in state["players"].values():
        player_state.update(
            {
                "gears": 0,
                "reroll_cubes": 0,
                "bets": [],
                "ready": False,
                "last_tumbler_turn": 0,
            }
        )
    start_index = _rng(state, "starting-tumbler").randrange(len(state["turn_order"]))
    state["active_player_id"] = state["turn_order"][start_index]
    state["players"][state["active_player_id"]]["last_tumbler_turn"] = 1
    _reset_turn_surface(state)


def _available_bet_ids(state: Dict, player_id: str) -> List[str]:
    player_state = state.get("players", {}).get(player_id)
    if state.get("phase") != "await_roll" or not player_state or player_id == state.get("active_player_id"):
        return []
    if len(player_state.get("bets", [])) >= 2:
        return []
    available = []
    for spec in BET_SPECS:
        stack = state.get("bet_stacks", {}).get(spec["bet_id"], [])
        if len(stack) < len(spec["payouts"]):
            available.append(spec["bet_id"])
    return available


def _placement_options(state: Dict) -> Dict[int, List[str]]:
    rolled = _dice_in_zone(state, "rolled")
    options: Dict[int, List[str]] = {}
    minimum = int(state.get("minimum_level", 1))
    board_counts = {level: 0 for level in range(1, 6)}
    for die in _board_dice(state):
        board_counts[int(die["level"])] += 1
    for level in range(minimum, 6):
        free = LEVEL_CAPACITY[level] - board_counts[level]
        if free <= 0:
            continue
        matching = [
            str(die["die_id"])
            for die in rolled
            if die.get("face") == level or die.get("face") == "skull"
        ]
        if matching:
            options[level] = matching
    return options


def _can_pick_nose(state: Dict) -> bool:
    if int(state.get("nose_picks", 0)) >= 2:
        return False
    return any(
        die.get("zone") == "board" and die.get("level") == 3 and die.get("face") == 3
        for die in state.get("dice", [])
    )


def _out_includes(result: Optional[str], target: str) -> bool:
    if result == target:
        return True
    if result == "double_out" and target in {"gem_out", "run_out"}:
        return True
    return False


def _is_full_skull(state: Dict) -> bool:
    counts = {level: 0 for level in range(1, 6)}
    board = _board_dice(state)
    for die in board:
        counts[int(die["level"])] += 1
    return len(board) == 7 and counts[1] + counts[2] == 3 and counts[3] == 1 and counts[4] == 2 and counts[5] == 1


def _is_mad_nargash(state: Dict) -> bool:
    board = _board_dice(state)
    return bool(board) and _out_includes(state.get("result"), "gem_out") and all(
        die.get("face") == "skull" for die in board
    )


def _is_grim_grin(state: Dict) -> bool:
    board = _board_dice(state)
    return bool(board) and _out_includes(state.get("result"), "run_out") and all(
        int(die.get("level", 0)) in {1, 2} for die in board
    )


def _is_emerald_skull(state: Dict) -> bool:
    return state.get("result") == "double_out" and _is_full_skull(state)


def _bet_wins(state: Dict, bet_id: str) -> bool:
    result = state.get("result")
    if bet_id == "pick_bust":
        return result == "bust_out" and int(state.get("nose_picks", 0)) >= 1
    if bet_id == "mad_nargash":
        return _is_mad_nargash(state)
    if bet_id == "grim_grin":
        return _is_grim_grin(state)
    if bet_id == "emerald_skull":
        return _is_emerald_skull(state)
    if bet_id == "busted_fowl":
        return result in {"bust_out", "chicken_out"}
    if bet_id == "final_jewel":
        return _out_includes(result, "gem_out")
    if bet_id == "empty_hands":
        return _out_includes(result, "run_out")
    if bet_id == "empty_shiny":
        return result == "double_out"
    return False


def _standard_payout(state: Dict) -> Dict:
    result = state.get("result")
    if result == "bust_out":
        return {"option_id": "standard", "label": "Standard Payout", "gears": 0, "reroll_cubes": 0}
    high = result in {"run_out", "double_out"}
    gear_values = {1: 1, 2: 2 if high else 1, 4: 5 if high else 2, 5: 5 if high else 3}
    score_wilds = result in {"gem_out", "double_out"}
    gears = 0
    cubes = 0
    for die in _board_dice(state):
        if die.get("face") == "skull" and not score_wilds:
            continue
        level = int(die["level"])
        if level == 3:
            cubes += 1
        else:
            gears += gear_values[level]
    return {"option_id": "standard", "label": "Standard Payout", "gears": gears, "reroll_cubes": cubes}


def _payout_options(state: Dict) -> List[Dict]:
    if state.get("result") == "bust_out":
        return []
    options = [_standard_payout(state)]
    if _is_mad_nargash(state):
        options.append(
            {
                "option_id": "mad_nargash",
                "label": "Mad Nargash Jackpot",
                "gears": 5 * len(_board_dice(state)),
                "reroll_cubes": 0,
            }
        )
    if _is_grim_grin(state):
        ordinary_teeth = sum(
            1
            for die in _board_dice(state)
            if die.get("face") != "skull" and int(die.get("level", 0)) in {1, 2}
        )
        options.append(
            {
                "option_id": "grim_grin",
                "label": "Grim Grin Jackpot",
                "gears": 3 * ordinary_teeth,
                "reroll_cubes": 0,
            }
        )
    if _is_emerald_skull(state):
        options.append(
            {
                "option_id": "emerald_skull",
                "label": "Emerald Skull Jackpot",
                "gears": 30,
                "reroll_cubes": 0,
            }
        )
    return options


def _pay_gears(state: Dict, player_id: str, amount: int) -> Tuple[int, bool]:
    due = max(0, int(amount))
    paid = min(due, int(state.get("gear_supply", 0)))
    state["gear_supply"] = int(state.get("gear_supply", 0)) - paid
    state["players"][player_id]["gears"] = int(state["players"][player_id].get("gears", 0)) + paid
    return paid, int(state["gear_supply"]) == 0


def _winner_ids(state: Dict) -> List[str]:
    player_ids = list(state.get("turn_order", []))
    if not player_ids:
        return []
    best_gears = max(int(state["players"][pid].get("gears", 0)) for pid in player_ids)
    candidates = [pid for pid in player_ids if int(state["players"][pid].get("gears", 0)) == best_gears]
    if len(candidates) > 1:
        best_cubes = max(int(state["players"][pid].get("reroll_cubes", 0)) for pid in candidates)
        candidates = [pid for pid in candidates if int(state["players"][pid].get("reroll_cubes", 0)) == best_cubes]
    if len(candidates) > 1:
        most_recent = max(int(state["players"][pid].get("last_tumbler_turn", 0)) for pid in candidates)
        candidates = [pid for pid in candidates if int(state["players"][pid].get("last_tumbler_turn", 0)) == most_recent]
    return candidates


def _human_ids(state: Dict) -> List[str]:
    return [
        pid
        for pid in state.get("turn_order", [])
        if not bool(state.get("player_meta", {}).get(pid, {}).get("is_bot"))
    ]


def _finish_game(state: Dict) -> None:
    state["game_over"] = True
    state["phase"] = "game_over"
    state["winner_ids"] = _winner_ids(state)
    state["rematch_ready"] = [
        pid
        for pid in state.get("turn_order", [])
        if bool(state.get("player_meta", {}).get(pid, {}).get("is_bot"))
    ]


def _advance_turn(state: Dict) -> None:
    order = state["turn_order"]
    current = state["active_player_id"]
    next_index = (order.index(current) + 1) % len(order)
    state["turn_number"] = int(state.get("turn_number", 1)) + 1
    state["active_player_id"] = order[next_index]
    state["players"][order[next_index]]["last_tumbler_turn"] = state["turn_number"]
    _reset_turn_surface(state)


def _settle_turn(state: Dict, payout_option_id: Optional[str], events: List[Dict]) -> None:
    active = state["active_player_id"]
    options = {option["option_id"]: option for option in state.get("payout_options", [])}
    chosen = options.get(payout_option_id) if payout_option_id else None
    tumbler_due = int(chosen.get("gears", 0)) if chosen else 0
    tumbler_cubes = int(chosen.get("reroll_cubes", 0)) if chosen else 0
    tumbler_paid, exhausted = _pay_gears(state, active, tumbler_due)
    state["players"][active]["reroll_cubes"] = int(state["players"][active].get("reroll_cubes", 0)) + tumbler_cubes

    bet_awards = []
    if not exhausted:
        for spec in BET_SPECS:
            if not _bet_wins(state, spec["bet_id"]):
                continue
            for position, bet in enumerate(state["bet_stacks"].get(spec["bet_id"], [])):
                if position >= len(spec["payouts"]):
                    break
                due = int(spec["payouts"][position])
                paid, exhausted = _pay_gears(state, bet["player_id"], due)
                bet_awards.append(
                    {
                        "player_id": bet["player_id"],
                        "bet_id": spec["bet_id"],
                        "position": position + 1,
                        "due": due,
                        "paid": paid,
                    }
                )
                if exhausted:
                    break
            if exhausted:
                break

    state["turn_result"] = {
        "turn_number": int(state.get("turn_number", 1)),
        "tumbler_id": active,
        "result": state.get("result"),
        "payout_option_id": chosen.get("option_id") if chosen else None,
        "payout_label": chosen.get("label") if chosen else "No tumbler payout",
        "tumbler_gears_due": tumbler_due,
        "tumbler_gears_paid": tumbler_paid,
        "tumbler_reroll_cubes": tumbler_cubes,
        "bet_awards": bet_awards,
        "gear_supply_after": int(state.get("gear_supply", 0)),
        "supply_exhausted": exhausted,
        "nose_picks": int(state.get("nose_picks", 0)),
        "dice_count": int(state.get("chosen_dice_count") or 0),
        "dice_cost": int(state.get("dice_cost", 0)),
        "board": copy.deepcopy(_board_dice(state)),
    }
    _record(
        state,
        events,
        "turn_scored",
        f"{_player_name(state, active)} ended with {state.get('result', '').replace('_', ' ')}.",
        player_id=active,
        result=state.get("result"),
        gears=tumbler_paid,
        reroll_cubes=tumbler_cubes,
        supply_exhausted=exhausted,
    )
    if exhausted:
        _finish_game(state)
        return
    state["phase"] = "turn_result"
    state["review_ready"] = [
        pid
        for pid in state["turn_order"]
        if bool(state.get("player_meta", {}).get(pid, {}).get("is_bot"))
    ]
    for pid in state["review_ready"]:
        state["players"][pid]["ready"] = True
    if set(state["review_ready"]) >= set(state["turn_order"]):
        _advance_turn(state)


def _finish_outcome(state: Dict, result: str, events: List[Dict]) -> None:
    state["result"] = result
    state["payout_options"] = _payout_options(state)
    if len(state["payout_options"]) > 1:
        state["phase"] = "choose_payout"
        _record(
            state,
            events,
            "payout_choice",
            f"{_player_name(state, state['active_player_id'])} may choose a payout.",
            player_id=state["active_player_id"],
            result=result,
            option_ids=[option["option_id"] for option in state["payout_options"]],
        )
        return
    option_id = state["payout_options"][0]["option_id"] if state["payout_options"] else None
    _settle_turn(state, option_id, events)


def _assert_state(state: Dict) -> None:
    if state.get("game_id") != "emerald_skulls" or state.get("version") != 1:
        raise AssertionError("unsupported Emerald Skulls state")
    if state.get("phase") not in PHASES:
        raise AssertionError("invalid Emerald Skulls phase")
    if bool(state.get("game_over")) != (state.get("phase") == "game_over"):
        raise AssertionError("game_over must match the phase")
    order = state.get("turn_order", [])
    if not (2 <= len(order) <= 6) or len(order) != len(set(order)):
        raise AssertionError("invalid turn order")
    if state.get("active_player_id") not in order:
        raise AssertionError("unknown active player")
    dice = state.get("dice", [])
    if len(dice) != 7 or {die.get("die_id") for die in dice} != set(DIE_IDS):
        raise AssertionError("exactly seven stable dice are required")
    for die in dice:
        zone = die.get("zone")
        if zone not in {"supply", "pool", "rolled", "board"}:
            raise AssertionError("invalid die zone")
        if zone == "rolled" and die.get("face") not in DIE_FACES:
            raise AssertionError("rolled dice require a face")
        if zone == "board":
            if die.get("face") not in DIE_FACES or die.get("level") not in {1, 2, 3, 4, 5}:
                raise AssertionError("placed dice require a face and level")
            if die.get("face") != "skull" and die.get("face") != die.get("level"):
                raise AssertionError("ordinary die is on the wrong level")
        elif die.get("level") is not None:
            raise AssertionError("only board dice have levels")
        if zone in {"supply", "pool"} and die.get("face") is not None:
            raise AssertionError("unrolled dice may not expose stale faces")
    for level, capacity in LEVEL_CAPACITY.items():
        if sum(1 for die in dice if die.get("zone") == "board" and die.get("level") == level) > capacity:
            raise AssertionError("level capacity exceeded")
    total_gears = int(state.get("gear_supply", -1)) + sum(
        int(state["players"][pid].get("gears", 0)) for pid in order
    )
    if total_gears != 40 * len(order):
        raise AssertionError("gear tokens are not conserved")
    for pid in order:
        pdata = state["players"][pid]
        if int(pdata.get("gears", -1)) < 0 or int(pdata.get("reroll_cubes", -1)) < 0:
            raise AssertionError("player resources cannot be negative")
        if len(pdata.get("bets", [])) > 2:
            raise AssertionError("a gambler may place at most two bets")
    for spec in BET_SPECS:
        stack = state.get("bet_stacks", {}).get(spec["bet_id"], [])
        if len(stack) > len(spec["payouts"]):
            raise AssertionError("bet stack exceeds its payout capacity")


class EmeraldSkullsGame:
    game_id = "emerald_skulls"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        ordered = _ordered_players(players)
        if not (EmeraldSkullsGame.min_players <= len(ordered) <= EmeraldSkullsGame.max_players):
            raise ValueError("Emerald Skulls requires 2 to 6 players")
        player_ids = [str(player["player_id"]) for player in ordered]
        if len(player_ids) != len(set(player_ids)):
            raise ValueError("Emerald Skulls player IDs must be unique")
        clean_config = _clean_config(config)
        base_seed = clean_config.get("seed")
        if base_seed is None:
            base_seed = secrets.token_hex(16)
        state = {
            "version": 1,
            "game_id": EmeraldSkullsGame.game_id,
            "config": clean_config,
            "base_seed": str(base_seed),
            "rng_counter": 0,
            "game_index": 1,
            "turn_order": player_ids,
            "player_meta": {str(player["player_id"]): copy.deepcopy(player) for player in ordered},
            "players": {player_id: {} for player_id in player_ids},
        }
        _setup_match(state)
        _assert_state(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        active = state.get("active_player_id")
        if phase == "game_over":
            return [] if player_id in state.get("rematch_ready", []) else ["play_again"]
        if phase == "turn_result":
            return [] if player_id in state.get("review_ready", []) else ["next_turn"]
        if phase == "buy_dice":
            return ["buy_dice"] if player_id == active else []
        if phase == "await_roll":
            if player_id == active:
                return ["roll"]
            return ["place_bet"] if _available_bet_ids(state, player_id) else []
        if player_id != active:
            return []
        if phase == "after_roll":
            actions = []
            if _placement_options(state):
                actions.append("place_dice")
            if int(state["players"][player_id].get("reroll_cubes", 0)) > 0:
                actions.append("spend_reroll_cube")
            if _can_pick_nose(state):
                actions.append("pick_nose")
            if not _placement_options(state):
                actions.append("accept_bust")
            return actions
        if phase == "post_place":
            return ["continue_roll", "chicken_out"]
        if phase == "choose_payout":
            return ["choose_payout"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        action_type = action["type"]
        if action_type not in EmeraldSkullsGame.get_legal_actions(state, player_id):
            return [], "action is not legal now"
        events: List[Dict] = []

        if action_type == "buy_dice":
            count = action.get("count")
            if isinstance(count, bool) or not isinstance(count, int) or count not in DICE_COSTS:
                return [], "choose between 3 and 7 dice"
            cost = DICE_COSTS[count]
            if int(state["players"][player_id]["gears"]) < cost:
                return [], "not enough gears"
            state["players"][player_id]["gears"] -= cost
            state["gear_supply"] += cost
            state["chosen_dice_count"] = count
            state["dice_cost"] = cost
            for die in state["dice"][:count]:
                die["zone"] = "pool"
            state["phase"] = "await_roll"
            _record(
                state,
                events,
                "dice_bought",
                f"{_player_name(state, player_id)} chose {count} dice for {cost} gears.",
                player_id=player_id,
                count=count,
                cost=cost,
            )

        elif action_type == "place_bet":
            bet_id = action.get("bet_id")
            if bet_id not in _available_bet_ids(state, player_id):
                return [], "that bet is unavailable"
            state["bet_sequence"] = int(state.get("bet_sequence", 0)) + 1
            bet = {"bet_id": bet_id, "player_id": player_id, "sequence": state["bet_sequence"]}
            state["players"][player_id]["bets"].append(copy.deepcopy(bet))
            state["bet_stacks"][bet_id].append(copy.deepcopy(bet))
            _record(
                state,
                events,
                "bet_placed",
                f"{_player_name(state, player_id)} bet on {BET_BY_ID[bet_id]['name']}.",
                player_id=player_id,
                bet_id=bet_id,
                position=len(state["bet_stacks"][bet_id]),
            )

        elif action_type == "roll":
            pool = _dice_in_zone(state, "pool")
            if not pool:
                return [], "there are no dice to roll"
            state["roll_count"] = int(state.get("roll_count", 0)) + 1
            roller = _rng(state, f"turn-{state['turn_number']}-roll-{state['roll_count']}")
            for die in pool:
                die["face"] = roller.choice(DIE_FACES)
                die["zone"] = "rolled"
            state["phase"] = "after_roll"
            _record(
                state,
                events,
                "dice_rolled",
                f"{_player_name(state, player_id)} rolled {len(pool)} dice.",
                player_id=player_id,
                faces=[die["face"] for die in pool],
                roll_count=state["roll_count"],
            )
            if not _placement_options(state) and int(state["players"][player_id].get("reroll_cubes", 0)) <= 0 and not _can_pick_nose(state):
                _finish_outcome(state, "bust_out", events)

        elif action_type == "place_dice":
            level = action.get("level")
            die_ids = action.get("die_ids")
            if isinstance(level, bool) or not isinstance(level, int) or level not in {1, 2, 3, 4, 5}:
                return [], "invalid skull level"
            if not isinstance(die_ids, list) or not die_ids or any(not isinstance(die_id, str) for die_id in die_ids):
                return [], "choose at least one die"
            if len(die_ids) != len(set(die_ids)):
                return [], "die IDs must be unique"
            options = _placement_options(state)
            if level not in options or not set(die_ids) <= set(options[level]):
                return [], "those dice cannot be placed on that level"
            if len(die_ids) > LEVEL_CAPACITY[level] - sum(
                1 for die in _board_dice(state) if die.get("level") == level
            ):
                return [], "that level is full"
            selected = set(die_ids)
            for die in state["dice"]:
                if die.get("zone") != "rolled":
                    continue
                if die["die_id"] in selected:
                    die["zone"] = "board"
                    die["level"] = level
                else:
                    die["zone"] = "pool"
                    die["face"] = None
            state["minimum_level"] = max(int(state.get("minimum_level", 1)), level)
            _record(
                state,
                events,
                "dice_placed",
                f"{_player_name(state, player_id)} placed {len(die_ids)} dice on level {level}.",
                player_id=player_id,
                level=level,
                die_ids=list(die_ids),
            )
            pool_empty = not _dice_in_zone(state, "pool")
            if level == 5:
                _finish_outcome(state, "double_out" if pool_empty else "gem_out", events)
            elif pool_empty:
                _finish_outcome(state, "run_out", events)
            else:
                state["phase"] = "post_place"

        elif action_type == "spend_reroll_cube":
            if int(state["players"][player_id].get("reroll_cubes", 0)) <= 0:
                return [], "no reroll cubes available"
            state["players"][player_id]["reroll_cubes"] -= 1
            for die in _dice_in_zone(state, "rolled"):
                die["zone"] = "pool"
                die["face"] = None
            supply = _dice_in_zone(state, "supply")
            added = None
            if supply:
                added = supply[0]["die_id"]
                supply[0]["zone"] = "pool"
            state["phase"] = "await_roll"
            _record(
                state,
                events,
                "reroll_cube_spent",
                f"{_player_name(state, player_id)} spent a reroll cube.",
                player_id=player_id,
                added_die_id=added,
            )

        elif action_type == "pick_nose":
            die_id = action.get("die_id")
            target = next((die for die in state["dice"] if die.get("die_id") == die_id), None)
            if not target or target.get("zone") != "board" or target.get("level") != 3 or target.get("face") != 3:
                return [], "choose an ordinary 3 from the nose"
            if int(state.get("nose_picks", 0)) >= 2:
                return [], "both Nose Picks have been used"
            for die in _dice_in_zone(state, "rolled"):
                die["zone"] = "pool"
                die["face"] = None
            target["zone"] = "pool"
            target["face"] = None
            target["level"] = None
            state["nose_picks"] = int(state.get("nose_picks", 0)) + 1
            state["minimum_level"] = max(3, int(state.get("minimum_level", 1)))
            state["phase"] = "await_roll"
            _record(
                state,
                events,
                "nose_picked",
                f"{_player_name(state, player_id)} picked the nose and will reroll.",
                player_id=player_id,
                die_id=die_id,
                nose_picks=state["nose_picks"],
            )

        elif action_type == "continue_roll":
            state["phase"] = "await_roll"
            _record(
                state,
                events,
                "luck_pressed",
                f"{_player_name(state, player_id)} pressed their luck.",
                player_id=player_id,
            )

        elif action_type == "chicken_out":
            _finish_outcome(state, "chicken_out", events)

        elif action_type == "accept_bust":
            if _placement_options(state):
                return [], "a legal placement is available"
            _finish_outcome(state, "bust_out", events)

        elif action_type == "choose_payout":
            option_id = action.get("option_id")
            if option_id not in {option["option_id"] for option in state.get("payout_options", [])}:
                return [], "invalid payout option"
            _settle_turn(state, option_id, events)

        elif action_type == "next_turn":
            ready = state.setdefault("review_ready", [])
            if player_id not in ready:
                ready.append(player_id)
                state["players"][player_id]["ready"] = True
            _record(
                state,
                events,
                "next_turn_ready",
                f"{_player_name(state, player_id)} is ready for the next turn.",
                player_id=player_id,
            )
            if set(ready) >= set(state["turn_order"]):
                _advance_turn(state)

        elif action_type == "play_again":
            ready = state.setdefault("rematch_ready", [])
            if player_id not in ready:
                ready.append(player_id)
            events.append({"type": "emerald_skulls:rematch_ready", "payload": {"player_id": player_id}})
            if set(ready) >= set(state["turn_order"]):
                state["game_index"] = int(state.get("game_index", 1)) + 1
                _setup_match(state)
                _record(
                    state,
                    events,
                    "game_started",
                    f"Game {state['game_index']} started.",
                    game_index=state["game_index"],
                    active_player_id=state["active_player_id"],
                )

        _assert_state(state)
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for pid in state.get("turn_order", []):
            pdata = state["players"][pid]
            meta = state.get("player_meta", {}).get(pid, {})
            players.append(
                {
                    "player_id": pid,
                    "name": meta.get("name") or pid,
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "gears": int(pdata.get("gears", 0)),
                    "reroll_cubes": int(pdata.get("reroll_cubes", 0)),
                    "bets": copy.deepcopy(pdata.get("bets", [])),
                    "bet_markers_left": 2 - len(pdata.get("bets", [])),
                    "ready": pid in state.get("review_ready", []),
                    "rematch_ready": pid in state.get("rematch_ready", []),
                }
            )
        betting_options = []
        for spec in BET_SPECS:
            stack = state.get("bet_stacks", {}).get(spec["bet_id"], [])
            betting_options.append(
                {
                    **copy.deepcopy(spec),
                    "stack": copy.deepcopy(stack),
                    "available": spec["bet_id"] in _available_bet_ids(state, viewer_id),
                    "won": _bet_wins(state, spec["bet_id"]) if state.get("result") else None,
                }
            )
        placement_options = {
            str(level): die_ids for level, die_ids in _placement_options(state).items()
        } if viewer_id == state.get("active_player_id") and state.get("phase") == "after_roll" else {}
        return {
            "game_id": EmeraldSkullsGame.game_id,
            "you": viewer_id,
            "game_index": int(state.get("game_index", 1)),
            "phase": state.get("phase"),
            "turn_number": int(state.get("turn_number", 1)),
            "active_player_id": state.get("active_player_id"),
            "gear_supply": int(state.get("gear_supply", 0)),
            "players": players,
            "chosen_dice_count": state.get("chosen_dice_count"),
            "dice_cost": int(state.get("dice_cost", 0)),
            "dice": copy.deepcopy(state.get("dice", [])),
            "minimum_level": int(state.get("minimum_level", 1)),
            "nose_picks": int(state.get("nose_picks", 0)),
            "roll_count": int(state.get("roll_count", 0)),
            "betting_options": betting_options,
            "available_bet_ids": _available_bet_ids(state, viewer_id),
            "placement_options": placement_options,
            "result": state.get("result"),
            "payout_options": copy.deepcopy(state.get("payout_options", [])),
            "turn_result": copy.deepcopy(state.get("turn_result")),
            "review_ready": list(state.get("review_ready", [])),
            "review_progress": {
                "done": len(state.get("review_ready", [])),
                "total": len(state.get("turn_order", [])),
            },
            "game_over": bool(state.get("game_over")),
            "winner_ids": list(state.get("winner_ids", [])),
            "rematch_ready": list(state.get("rematch_ready", [])),
            "legal_actions": EmeraldSkullsGame.get_legal_actions(state, viewer_id),
            "activity": copy.deepcopy(state.get("activity", [])),
            "last_action": copy.deepcopy(state.get("last_action")),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = EmeraldSkullsGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        if "place_bet" in legal:
            available = _available_bet_ids(state, bot_id)
            if not available:
                return None
            ranked = sorted(
                available,
                key=lambda bet_id: (
                    -BET_BY_ID[bet_id]["payouts"][len(state["bet_stacks"][bet_id])],
                    BET_BY_ID[bet_id]["card_number"],
                    bet_id,
                ),
            )
            return {"type": "place_bet", "bet_id": ranked[0], "delay_ms": 300}
        if "buy_dice" in legal:
            gears = int(state["players"][bot_id].get("gears", 0))
            count = 5 if gears >= 3 else 4 if gears >= 1 else 3
            return {"type": "buy_dice", "count": count, "delay_ms": 350}
        if "roll" in legal:
            return {"type": "roll", "delay_ms": 700}
        if state.get("phase") == "after_roll":
            options = _placement_options(state)
            if options:
                board_counts = {
                    level: sum(
                        1
                        for die in _board_dice(state)
                        if int(die.get("level", 0)) == level
                    )
                    for level in options
                }
                level = min(
                    options,
                    key=lambda value: (
                        -min(len(options[value]), LEVEL_CAPACITY[value] - board_counts[value]),
                        value,
                    ),
                )
                free = LEVEL_CAPACITY[level] - board_counts[level]
                return {
                    "type": "place_dice",
                    "level": level,
                    "die_ids": options[level][:free],
                    "delay_ms": 450,
                }
            if "spend_reroll_cube" in legal:
                return {"type": "spend_reroll_cube", "delay_ms": 350}
            if "pick_nose" in legal:
                target = next(
                    die for die in state["dice"]
                    if die.get("zone") == "board" and die.get("level") == 3 and die.get("face") == 3
                )
                return {"type": "pick_nose", "die_id": target["die_id"], "delay_ms": 350}
            if "accept_bust" in legal:
                return {"type": "accept_bust", "delay_ms": 300}
        if "continue_roll" in legal:
            pool_count = len(_dice_in_zone(state, "pool"))
            if int(state.get("minimum_level", 1)) >= 4 and pool_count <= 1:
                return {"type": "chicken_out", "delay_ms": 350}
            return {"type": "continue_roll", "delay_ms": 350}
        if "choose_payout" in legal:
            best = max(
                state.get("payout_options", []),
                key=lambda option: (int(option.get("gears", 0)) + 2 * int(option.get("reroll_cubes", 0)), option["option_id"]),
            )
            return {"type": "choose_payout", "option_id": best["option_id"], "delay_ms": 350}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict):
            raise ValueError("invalid Emerald Skulls save payload")
        state = copy.deepcopy(payload)
        try:
            _assert_state(state)
        except AssertionError as exc:
            raise ValueError(f"invalid Emerald Skulls save payload: {exc}") from exc
        return state
