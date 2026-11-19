import argparse
import json
from pathlib import Path
import subprocess
import sys
import types
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from game.natsumemo import NatsumemoGame
from game.natsumemo_ai import choose_action


def benchmark(baseline_ref: str, player_counts: List[int], games: int) -> List[Dict]:
    source = subprocess.check_output(
        ["git", "show", f"{baseline_ref}:game/natsumemo_ai.py"], cwd=ROOT, text=True,
    )
    baseline = types.ModuleType("natsumemo_baseline")
    exec(compile(source, "natsumemo_baseline", "exec"), baseline.__dict__)
    results = []
    for count in player_counts:
        wins = 0.0
        scores = {"new": [], "baseline": []}
        pages = {"new": [], "baseline": []}
        for seed in range(games):
            players = [{"player_id": str(seat), "seat": seat} for seat in range(count)]
            state = NatsumemoGame.init_game({"seed": seed}, players)
            hero = str(seed % count)
            state["game_token"] = f"benchmark:{seed}:{hero}:{count}"
            for unused in range(1500):
                if state["game_over"]:
                    break
                actor = next(pid for pid in state["turn_order"]
                             if NatsumemoGame.get_legal_actions(state, pid))
                policy = choose_action if actor == hero else baseline.choose_action
                action = policy(NatsumemoGame.get_public_view(state, actor))
                error = NatsumemoGame.apply_action(state, actor, action)[1]
                if error:
                    raise RuntimeError(f"Illegal action {action}: {error}")
            if not state["game_over"]:
                raise RuntimeError(f"Game did not finish: players={count}, seed={seed}")
            if hero in state["winner_ids"]:
                wins += 1 / len(state["winner_ids"])
            for row in state["scores"]:
                kind = "new" if row["player_id"] == hero else "baseline"
                scores[kind].append(row["total"])
                pages[kind].append(state["players"][row["player_id"]]["homework"])
        results.append({
            "players": count, "games": games, "new_ai_win_share": round(wins / games, 4),
            "equal_strength_reference": round(1 / count, 4),
            "mean_score": {kind: round(sum(values) / len(values), 2) for kind, values in scores.items()},
            "mean_homework": {kind: round(sum(values) / len(values), 2) for kind, values in pages.items()},
            "homework_shortfall_rate": {
                kind: round(sum(value < 25 for value in values) / len(values), 4)
                for kind, values in pages.items()
            },
        })
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare one current Natsumemo bot against historical bots.")
    parser.add_argument("--baseline-ref", required=True)
    parser.add_argument("--games-per-count", type=int, default=20)
    parser.add_argument("--players", type=int, choices=range(3, 7), nargs="+", default=list(range(3, 7)))
    args = parser.parse_args()
    if args.games_per_count < 1:
        parser.error("--games-per-count must be positive")
    print(json.dumps(benchmark(args.baseline_ref, args.players, args.games_per_count), indent=2))


if __name__ == "__main__":
    main()
