"""Public-information Monte Carlo player for Emerald Skulls.

Search uses its own reproducible dice, never the game's seed or random stream.
Equivalent dice are grouped by face, so all legal ordinary/wild subsets can be
compared without searching permutations of identical dice. Rollouts use a cheap
risk-aware policy; the root compares complete-turn rewards, including dice costs,
saved reroll cubes and the finite gear pot.
"""

import math
import random
from dataclasses import dataclass, replace
from typing import Dict, List, Optional, Tuple

from game.emerald_skulls import BET_SPECS, DICE_COSTS, LEVEL_CAPACITY, _bet_wins, _payout_options


SEARCH_SAMPLES = 64
BET_SAMPLES = 256
MAX_ROLLOUT_STEPS = 36


@dataclass(frozen=True)
class Position:
    board: Tuple[Tuple[int, int], ...]
    hand: int
    supply: int
    floor: int
    cubes: int
    picks: int


@dataclass(frozen=True)
class Move:
    kind: str
    level: int = 0
    ordinary: int = 0
    wild: int = 0


def _position(view: Dict) -> Position:
    dice = view["dice"]
    active = next(player for player in view["players"] if player["player_id"] == view["active_player_id"])
    return Position(
        board=tuple(sorted((6 if die["face"] == "skull" else die["face"], die["level"])
                           for die in dice if die["zone"] == "board")),
        hand=sum(die["zone"] in {"pool", "rolled"} for die in dice),
        supply=sum(die["zone"] == "supply" for die in dice),
        floor=view["minimum_level"],
        cubes=active["reroll_cubes"],
        picks=view["nose_picks"],
    )


def _placements(position: Position, faces: Tuple[int, ...]) -> List[Move]:
    moves = []
    for level in range(position.floor, 6):
        free = LEVEL_CAPACITY[level] - sum(placed == level for _, placed in position.board)
        for ordinary in range(min(faces.count(level), free) + 1):
            for wild in range(min(faces.count(6), free - ordinary) + 1):
                if ordinary + wild:
                    moves.append(Move("place_dice", level, ordinary, wild))
    return moves


def _rescues(position: Position) -> List[Move]:
    moves = []
    if position.picks < 2 and (3, 3) in position.board:
        moves.append(Move("pick_nose"))
    if position.cubes:
        moves.append(Move("spend_reroll_cube"))
    return moves


def _transition(position: Position, move: Move) -> Tuple[Position, Optional[str]]:
    if move.kind == "place_dice":
        board = position.board + ((move.level, move.level),) * move.ordinary + ((6, move.level),) * move.wild
        next_position = replace(position, board=tuple(sorted(board)),
                                hand=position.hand - move.ordinary - move.wild, floor=move.level)
        if move.level == 5:
            return next_position, "double_out" if not next_position.hand else "gem_out"
        return next_position, "run_out" if not next_position.hand else None
    if move.kind == "spend_reroll_cube":
        added = int(position.supply > 0)
        return replace(position, hand=position.hand + added, supply=position.supply - added,
                       cubes=position.cubes - 1), None
    if move.kind == "pick_nose":
        board = list(position.board)
        board.remove((3, 3))
        return replace(position, board=tuple(board), hand=position.hand + 1,
                       floor=max(3, position.floor), picks=position.picks + 1), None
    if move.kind == "chicken_out":
        return position, "chicken_out"
    if move.kind == "accept_bust":
        return position, "bust_out"
    return position, None


class TurnSearch:
    def __init__(self, pot: int):
        self.pot = pot
        self._outcomes = {}
        self._estimates = {}

    def outcome(self, position: Position, result: str) -> Tuple[float, Dict, Tuple[str, ...]]:
        """Use the authoritative scoring and bet predicates for simulated endings."""
        key = (position.board, position.cubes, position.picks, result)
        if key not in self._outcomes:
            state = {
                "dice": [{"zone": "board", "face": "skull" if face == 6 else face, "level": level}
                         for face, level in position.board],
                "result": result,
                "nose_picks": position.picks,
            }
            options = _payout_options(state) or [{"gears": 0, "reroll_cubes": 0}]
            best = max(options, key=lambda option: (
                self.payout_value(option, position.cubes), option["reroll_cubes"]))
            wins = tuple(spec["bet_id"] for spec in BET_SPECS if _bet_wins(state, spec["bet_id"]))
            self._outcomes[key] = (self.payout_value(best, position.cubes), best, wins)
        return self._outcomes[key]

    def payout_value(self, payout: Dict, saved_cubes: int) -> float:
        gears = min(self.pot, payout["gears"])
        # Cubes are useful later, with diminishing returns; an emptied pot has
        # no future turns in which to spend them.
        future = min(1.0, max(0, self.pot - gears) / 12)
        return gears + future * 6 * math.log1p((saved_cubes + payout["reroll_cubes"]) / 5)

    def estimate(self, position: Position) -> float:
        """Fast continuation estimate used only inside rollout policy."""
        if position not in self._estimates:
            bank = self.outcome(position, "chicken_out")[0]
            base = self.outcome(position, "bust_out")[0]
            allowed = sum(
                sum(placed == level for _, placed in position.board) < LEVEL_CAPACITY[level]
                for level in range(position.floor, 6)
            )
            failure = ((5 - allowed) / 6) ** position.hand
            rescue_count = min(position.cubes, 2) + int(bool(_rescues(position)) and position.cubes == 0)
            failure **= 1 + rescue_count
            growth = 1.35 * position.hand + 0.65 * sum(face == 6 for face, _ in position.board)
            # Higher floors sharply restrict subsequent placements.
            growth *= (7 - position.floor) / 6
            self._estimates[position] = max(bank, base + (1 - failure) * (bank - base + growth))
        return self._estimates[position]

    def policy_move(self, position: Position, faces: Tuple[int, ...]) -> Move:
        placements = _placements(position, faces)
        if not placements:
            rescues = _rescues(position)
            return max(rescues, key=lambda move: self.estimate(_transition(position, move)[0])) if rescues else Move("accept_bust")

        def value(move: Move) -> Tuple[float, int, int]:
            next_position, result = _transition(position, move)
            score = self.outcome(next_position, result)[0] if result else self.estimate(next_position)
            return score, move.ordinary + move.wild, -move.level

        return max(placements, key=value)

    def playout(self, position: Position, rng: random.Random, post_place: bool = False) -> Tuple[Position, str]:
        for _ in range(MAX_ROLLOUT_STEPS):
            if post_place:
                bank = self.outcome(position, "chicken_out")[0]
                if self.estimate(position) <= bank + 0.15:
                    return position, "chicken_out"
            faces = tuple(rng.randint(1, 6) for _ in range(position.hand))
            move = self.policy_move(position, faces)
            position, result = _transition(position, move)
            if result:
                return position, result
            post_place = move.kind == "place_dice"
        # A bounded search cannot burn arbitrary stockpiles of cubes. Return a
        # legal conservative ending for the phase at the cutoff.
        return position, "chicken_out" if post_place else "bust_out"

    def evaluate(self, position: Position, move: Move, samples: int = SEARCH_SAMPLES) -> float:
        next_position, result = _transition(position, move)
        if result:
            return self.outcome(next_position, result)[0]
        total = 0.0
        for sample in range(samples):
            # Common random numbers reduce noise between candidate actions.
            final, result = self.playout(next_position, random.Random(93107 + sample), move.kind == "place_dice")
            total += self.outcome(final, result)[0]
        return total / samples


def _choose_bet(view: Dict, position: Position) -> Optional[Dict]:
    available = [bet for bet in view["betting_options"] if bet["available"]]
    if not available:
        return None
    search = TurnSearch(view["gear_supply"])
    expected = {bet["bet_id"]: 0.0 for bet in available}
    for sample in range(BET_SAMPLES):
        final, result = search.playout(position, random.Random(17011 + sample))
        _, payout, wins = search.outcome(final, result)
        remaining = max(0, view["gear_supply"] - payout["gears"])
        # Existing markers and card order get paid before a newly placed marker.
        for bet in view["betting_options"]:
            if bet["bet_id"] not in wins:
                continue
            occupied = len(bet["stack"])
            remaining = max(0, remaining - sum(bet["payouts"][:occupied]))
            if bet["bet_id"] in expected:
                expected[bet["bet_id"]] += min(remaining, bet["payouts"][occupied])
    best = max(available, key=lambda bet: (expected[bet["bet_id"]], -bet["card_number"]))
    # Keep a marker if no available outcome can pay in the simulated position.
    if expected[best["bet_id"]] <= 0:
        return None
    return {"type": "place_bet", "bet_id": best["bet_id"], "delay_ms": 350}


def choose_move(view: Dict) -> Optional[Dict]:
    """Choose a legal action using only the same public view as a human."""
    legal = view["legal_actions"]
    if not legal or view["game_over"]:
        return None
    position = _position(view)
    if "place_bet" in legal:
        return _choose_bet(view, position)
    if "roll" in legal:
        human_bettors = any(not player["is_bot"] and player["player_id"] != view["active_player_id"]
                            and player["bet_markers_left"] for player in view["players"])
        return {"type": "roll", "delay_ms": 4500 if human_bettors else 650}
    search = TurnSearch(view["gear_supply"])
    if "buy_dice" in legal:
        me = next(player for player in view["players"] if player["player_id"] == view["you"])
        choices = []
        for count, cost in DICE_COSTS.items():
            if cost <= me["gears"]:
                trial = replace(position, hand=count, supply=7 - count)
                value = TurnSearch(view["gear_supply"] + cost).evaluate(trial, Move("roll")) - cost
                choices.append((value, -cost, count))
        return {"type": "buy_dice", "count": max(choices)[2], "delay_ms": 350}
    if "choose_payout" in legal:
        best = max(view["payout_options"], key=lambda option: (
            search.payout_value(option, position.cubes), option["reroll_cubes"]))
        return {"type": "choose_payout", "option_id": best["option_id"], "delay_ms": 350}
    if "continue_roll" in legal:
        moves = [Move("chicken_out"), Move("continue_roll")]
    elif view["phase"] == "after_roll":
        faces = tuple(6 if die["face"] == "skull" else die["face"]
                      for die in view["dice"] if die["zone"] == "rolled")
        moves = _placements(position, faces) + _rescues(position)
        if "accept_bust" in legal:
            moves.append(Move("accept_bust"))
    else:
        return {"type": "next_turn", "delay_ms": 350} if "next_turn" in legal else None
    best = max(moves, key=lambda move: (search.evaluate(position, move), move.ordinary + move.wild, -move.level))
    action = {"type": best.kind, "delay_ms": 450}
    if best.kind == "place_dice":
        rolled = [die for die in view["dice"] if die["zone"] == "rolled"]
        ordinary = [die["die_id"] for die in rolled if die["face"] == best.level][:best.ordinary]
        wild = [die["die_id"] for die in rolled if die["face"] == "skull"][:best.wild]
        action.update(level=best.level, die_ids=ordinary + wild)
    elif best.kind == "pick_nose":
        action["die_id"] = next(die["die_id"] for die in view["dice"]
                                if die["zone"] == "board" and die["face"] == 3 and die["level"] == 3)
    return action
