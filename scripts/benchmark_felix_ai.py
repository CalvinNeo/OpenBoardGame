"""Seat-balanced Felix benchmark against the original random/one-third-cash bot."""

import argparse
import json
import math
import random
import statistics
import sys
import time
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from game.felix import FelixGame as Game
from game.felix_ai import choose_action


def baseline(view, source):
    legal = view["legal_actions"]
    own = next(player for player in view["players"] if player["player_id"] == view["you"])
    if "next_round" in legal:
        return {"type": "next_round"}
    if "choose_card" in legal:
        card = source.choice(view["your_hand"])
        return {"type": "choose_card", "card_id": card["id"]}
    if "buy_for_one" in legal:
        return {"type": "buy_for_one"}
    if "bid" in legal and view["current_bid"] < max(1, own["mice"] // 3):
        return {"type": "bid", "amount": view["current_bid"] + 1}
    return {"type": "pass"}


def play_game(count, seed, new_seats):
    players = [{"player_id": f"p{seat}", "name": f"Player {seat}", "seat": seat, "is_bot": True}
               for seat in range(count)]
    with patch("game.felix.random", random.Random(seed)):
        state = Game.init_game({}, players)
    sources = {f"p{seat}": random.Random(seed * 1009 + seat) for seat in range(count)}
    new_ids = {f"p{seat}" for seat in new_seats}
    timings = {phase: [] for phase in ("choose_card", "auction", "last_chance", "round_summary")}
    for actions in range(5000):
        if state["game_over"]:
            return {"players": count, "seed": seed, "new_seats": sorted(new_seats),
                    "winners": state["winner"], "scores": state["final_results"]["scores"],
                    "actions": actions}, timings
        player_id = next(owner for owner in state["turn_order"] if Game.get_legal_actions(state, owner))
        view = Game.get_public_view(state, player_id)
        started = time.perf_counter()
        if player_id in new_ids:
            action = choose_action(view)
            timings[state["phase"]].append((time.perf_counter() - started) * 1000)
        else:
            action = baseline(view, sources[player_id])
        _, error = Game.apply_action(state, player_id, action)
        if error:
            raise AssertionError((count, seed, new_seats, player_id, action, error))
    raise AssertionError((count, seed, new_seats, "action limit exceeded"))


def latency(samples):
    if not samples:
        return {"decisions": 0}
    ordered = sorted(samples)
    return {"decisions": len(samples), "mean_ms": round(statistics.mean(samples), 3),
            "p95_ms": round(ordered[math.ceil(0.95 * len(ordered)) - 1], 3),
            "max_ms": round(ordered[-1], 3)}


def summarize(records):
    result = {"games": len(records)}
    for label in ("new", "baseline"):
        rows = []
        for record in records:
            for owner, scores in record["scores"].items():
                is_new = int(owner[1:]) in record["new_seats"]
                if is_new != (label == "new"):
                    continue
                wins = 1 / len(record["winners"]) if owner in record["winners"] else 0
                rank = 1 + sum((other["score"], other["cat_score"]) > (scores["score"], scores["cat_score"])
                               for other in record["scores"].values())
                rows.append({"score": scores["score"], "win_credit": wins, "rank": rank})
        if rows:
            result[label] = {"player_games": len(rows), "mean_score": round(statistics.mean(row["score"] for row in rows), 3),
                             "win_share_per_player": round(statistics.mean(row["win_credit"] for row in rows), 4),
                             "mean_rank": round(statistics.mean(row["rank"] for row in rows), 3)}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seeds", type=int, default=12)
    parser.add_argument("--seed-start", type=int, default=0)
    parser.add_argument("--players", type=int, nargs="+", choices=(3, 4, 5), default=[3, 4, 5])
    parser.add_argument("--new-count", type=int, default=1)
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    if args.seeds < 1 or not 1 <= args.new_count <= min(args.players):
        parser.error("seeds must be positive and new-count must fit every requested table")
    records = []
    timings = {phase: [] for phase in ("choose_card", "auction", "last_chance", "round_summary")}
    started = time.perf_counter()
    for count in args.players:
        for seed in range(args.seed_start, args.seed_start + args.seeds):
            for seat in range(count):
                new_seats = {(seat + offset) % count for offset in range(args.new_count)}
                record, samples = play_game(count, seed, new_seats)
                records.append(record)
                for phase, values in samples.items():
                    timings[phase].extend(values)
    result = {"settings": {"seeds": args.seeds, "seed_start": args.seed_start, "new_count": args.new_count},
              "overall": summarize(records),
              "by_players": {str(count): summarize([record for record in records if record["players"] == count])
                             for count in args.players},
              "latency": {phase: latency(values) for phase, values in timings.items()},
              "elapsed_seconds": round(time.perf_counter() - started, 3)}
    print(json.dumps(result, indent=2))
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps({**result, "records": records}, indent=2) + "\n")


if __name__ == "__main__":
    main()
