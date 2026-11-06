import argparse
import copy
import json
import random
import statistics
import sys
import time
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from game.six_nimmt import SixNimmtGame


def random_action(state: dict, player_id: str, rng: random.Random) -> dict:
    actions = SixNimmtGame.get_legal_actions(state, player_id)
    if "select_card" in actions:
        return {"type": "select_card", "value": rng.choice(state["players"][player_id]["hand"])["value"]}
    if "choose_row" in actions:
        index = min(range(4), key=lambda position: sum(card["bulls"] for card in state["rows"][position]))
        return {"type": "choose_row", "row_index": index}
    return {"type": "ack_turn_summary"}


def play_round(initial: dict, candidate: str, seed: int, timings: list) -> dict:
    state = copy.deepcopy(initial)
    generators = {player_id: random.Random(seed * 100 + index)
                  for index, player_id in enumerate(state["players"])}
    for step in range(10 * (3 * len(generators) + 1)):
        if state["phase"] == "turn_summary" and state["turn"] == 10:
            return {player_id: player["score"] for player_id, player in state["players"].items()}
        for player_id in state["players"]:
            if not SixNimmtGame.get_legal_actions(state, player_id):
                continue
            if player_id == candidate:
                started = time.perf_counter()
                action = SixNimmtGame.bot_move(state, player_id)
                if action["type"] == "select_card":
                    timings.append((time.perf_counter() - started) * 1000)
            else:
                action = random_action(state, player_id, generators[player_id])
            _, error = SixNimmtGame.apply_action(state, player_id, action)
            if error:
                raise AssertionError((step, player_id, action, error))
            break
        else:
            raise AssertionError("Round stalled")
    raise AssertionError("Round did not finish")


def benchmark(count: int, seeds: int, seed: int) -> dict:
    baseline_scores, candidate_scores, timings, wins = [], [], [], []
    for offset in range(seeds):
        deal_seed = seed + offset
        players = [{"player_id": f"p{index}", "name": f"Bot {index}", "seat": index, "is_bot": True}
                   for index in range(count)]
        with patch("game.six_nimmt.random.shuffle", random.Random(deal_seed).shuffle):
            state = SixNimmtGame.init_game({"selection_timeout_sec": 0, "row_choice_timeout_sec": 0}, players)
        baseline = play_round(state, "", deal_seed, [])
        for candidate in state["players"]:
            result = play_round(state, candidate, deal_seed, timings)
            baseline_scores.append(baseline[candidate])
            candidate_scores.append(result[candidate])
            minimum = min(result.values())
            winners = sum(score == minimum for score in result.values())
            wins.append(1 / winners if result[candidate] == minimum else 0)
    ordered_times = sorted(timings)
    return {
        "players": count,
        "paired_rounds": len(candidate_scores),
        "random_mean_penalty": round(statistics.mean(baseline_scores), 3),
        "strategy_mean_penalty": round(statistics.mean(candidate_scores), 3),
        "mean_penalty_reduction": round(statistics.mean(baseline_scores) - statistics.mean(candidate_scores), 3),
        "strategy_win_share": round(statistics.mean(wins), 3),
        "selection_ms_mean": round(statistics.mean(timings), 3),
        "selection_ms_p95": round(ordered_times[int(0.95 * (len(ordered_times) - 1))], 3),
        "selection_ms_max": round(max(timings), 3),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Seat-rotated paired 6 nimmt! rounds against the original random bot.")
    parser.add_argument("--seeds", type=int, default=12)
    parser.add_argument("--seed", type=int, default=20261106)
    parser.add_argument("--players", type=int, nargs="+", default=[2, 4, 6, 10], choices=range(2, 11))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.seeds < 1:
        parser.error("--seeds must be positive")
    result = {"seed": args.seed, "seeds": args.seeds, "results": []}
    for count in args.players:
        entry = benchmark(count, args.seeds, args.seed)
        result["results"].append(entry)
        print(json.dumps(entry), flush=True)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
