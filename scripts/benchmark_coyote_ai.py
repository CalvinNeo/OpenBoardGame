import argparse
import json
import random
import statistics
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from game.coyote import CoyoteGame as Game
from game.coyote_ai import total_distribution


def baseline_action(view: Dict, policy: str, generator: random.Random) -> Dict:
    if "next_round" in view["legal_actions"]:
        return {"type": "next_round"}
    last_bid = view["last_bid"]
    minimum = last_bid + 1 if last_bid is not None else 1
    if policy == "original":
        if last_bid is None:
            return {"type": "bid", "bid": generator.randint(1, 6)}
        if generator.random() < 0.25:
            return {"type": "challenge"}
        return {"type": "bid", "bid": minimum + generator.randint(0, 2)}
    visible = tuple(sorted(player["card"] for player in view["players"]
                           if not player["eliminated"] and player["player_id"] != view["you"]))
    distribution = total_distribution(visible)
    truth = sum(probability for total, probability in distribution if last_bid is not None and total >= last_bid)
    if last_bid is not None and truth < 0.5:
        return {"type": "challenge"}
    candidates = [minimum] + [total for total, probability in distribution if total >= minimum]
    safe = [bid for bid in candidates if sum(probability for total, probability in distribution if total >= bid) >= 0.65]
    return {"type": "bid", "bid": max(safe, default=minimum)}


def play_game(count: int, seed: int, seat: int, policy: str) -> Tuple[bool, List[float]]:
    deal_random = random.Random(seed)
    decision_random = random.Random(seed * 1009 + seat)
    players = [{"player_id": f"p{index}", "name": f"Bot {index}", "seat": index, "is_bot": True}
               for index in range(count)]
    candidate = f"p{seat}"
    timings = []
    with patch("game.coyote.random.shuffle", deal_random.shuffle):
        state = Game.init_game({}, players)
        for step in range(3000):
            if state["game_over"]:
                return state["winner"] == candidate, timings
            actor = next(player_id for player_id in state["players"] if Game.get_legal_actions(state, player_id))
            if actor == candidate:
                started = time.perf_counter()
                action = Game.bot_move(state, actor)
                timings.append((time.perf_counter() - started) * 1000)
            else:
                action = baseline_action(Game.get_public_view(state, actor), policy, decision_random)
            _, error = Game.apply_action(state, actor, action)
            if error:
                raise AssertionError((count, seed, seat, step, action, error))
    raise AssertionError("game stalled")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seeds", type=int, default=20)
    parser.add_argument("--counts", type=int, nargs="+", default=[2, 3, 6, 10])
    parser.add_argument("--policies", nargs="+", choices=["original", "probability"], default=["original", "probability"])
    args = parser.parse_args()
    for policy in args.policies:
        for count in args.counts:
            wins, timings = [], []
            for seed in range(args.seeds):
                for seat in range(count):
                    won, samples = play_game(count, seed, seat, policy)
                    wins.append(won)
                    timings.extend(samples)
            timings.sort()
            print(json.dumps({"policy": policy, "players": count, "games": len(wins),
                              "win_rate": round(statistics.mean(wins), 4), "equal_strength_share": round(1 / count, 4),
                              "mean_ms": round(statistics.mean(timings), 2),
                              "p95_ms": round(timings[int(len(timings) * .95)], 2)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
