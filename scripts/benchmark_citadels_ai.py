import argparse
import json
import random
import subprocess
import sys
import types
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from game.citadels import CitadelsGame


def benchmark(baseline_ref: str, player_counts: List[int], games: int, city_size: int) -> List[Dict]:
    source = subprocess.check_output(
        ["git", "show", f"{baseline_ref}:game/citadels.py"], cwd=ROOT, text=True,
    )
    baseline = types.ModuleType("citadels_baseline")
    exec(compile(source, "citadels_baseline", "exec"), baseline.__dict__)
    results = []
    for count in player_counts:
        wins = 0.0
        rounds = []
        for seed in range(games):
            random.seed(53000 + count * 100 + seed)
            players = [
                {"player_id": f"p{seat}", "name": f"Bot {seat}", "seat": seat, "is_bot": True}
                for seat in range(count)
            ]
            state = CitadelsGame.init_game({"winning_city_size": city_size}, players)
            hero = f"p{seed % count}"
            for unused in range(3000):
                if state["game_over"]:
                    break
                actor = next(player for player in state["turn_order"]
                             if CitadelsGame.get_legal_actions(state, player))
                strategy = CitadelsGame if actor == hero else baseline.CitadelsGame
                action = strategy.bot_move(state, actor)
                if action is None:
                    raise RuntimeError(f"No bot action: players={count}, seed={seed}, actor={actor}")
                _, error = CitadelsGame.apply_action(state, actor, action)
                if error:
                    raise RuntimeError(f"Illegal bot action {action}: {error}")
            if not state["game_over"]:
                raise RuntimeError(f"Game did not finish: players={count}, seed={seed}")
            if hero in state["winner_ids"]:
                wins += 1 / len(state["winner_ids"])
            rounds.append(state["round"])
        results.append({
            "players": count, "games": games,
            "new_ai_win_share": round(wins / games, 4),
            "equal_strength_reference": round(1 / count, 4),
            "mean_rounds": round(sum(rounds) / len(rounds), 2),
        })
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare one current Citadels bot against historical bots.")
    parser.add_argument("--baseline-ref", required=True)
    parser.add_argument("--games-per-count", type=int, default=40)
    parser.add_argument("--players", type=int, choices=range(2, 7), nargs="+", default=list(range(2, 7)))
    parser.add_argument("--city-size", type=int, choices=(7, 8), default=7)
    args = parser.parse_args()
    if args.games_per_count < 1:
        parser.error("--games-per-count must be positive")
    print(json.dumps(benchmark(args.baseline_ref, args.players, args.games_per_count, args.city_size), indent=2))


if __name__ == "__main__":
    main()
