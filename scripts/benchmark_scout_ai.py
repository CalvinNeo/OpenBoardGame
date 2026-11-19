import argparse
import copy
import json
import statistics
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from game.scout import (
    ScoutGame,
    _best_show_move,
    _combo_sort_key,
    _enumerate_scout_options,
    _flip_pending_hand,
)


def legacy_action(state: Dict, player_id: str) -> Optional[Dict]:
    player = state["players"][player_id]
    if state["phase"] == "choose_orientation":
        hand = player["pending_hand"]
        keep = _best_show_move(hand, None)
        flip = _best_show_move(_flip_pending_hand(hand), None)
        return {"type": "ready_hand", "flip": _combo_sort_key(flip["combo"]) > _combo_sort_key(keep["combo"])}
    hand, active_set = player["hand"], state.get("active_set")
    show = _best_show_move(hand, active_set)
    show_action = ({"type": "show", "start_index": show["start_index"], "end_index": show["end_index"]}
                   if show else None)
    if state.get("pending_scout_and_show_player") == player_id:
        return show_action or {"type": "finish_scout_and_show"}
    options = _enumerate_scout_options(hand, active_set)
    if state["variant"] == "base" and player.get("scout_and_show_available"):
        best_key, best_option, best_show = None, None, None
        for option in options:
            next_show = _best_show_move(option["next_hand"], option["next_active_set"])
            if next_show:
                key = (int(next_show["remaining_count"] == 0),
                       _combo_sort_key(next_show["combo"]), -next_show["start_index"])
                if best_key is None or key > best_key:
                    best_key, best_option, best_show = key, option, next_show
        if best_option and not (show and show["remaining_count"] == 0):
            if not show or _combo_sort_key(best_show["combo"]) > _combo_sort_key(show["combo"]):
                return {"type": "scout_and_show", **{key: best_option[key]
                        for key in ("take_side", "insert_index", "insert_face")}}
    if show_action:
        return show_action
    best_key, best_option = None, None
    for option in options:
        next_show = _best_show_move(option["next_hand"], option["next_active_set"])
        key = (int(bool(next_show and next_show["remaining_count"] == 0)), int(bool(next_show)),
               _combo_sort_key(next_show["combo"]) if next_show else (0, 0, 0), -len(option["next_hand"]))
        if best_key is None or key > best_key:
            best_key, best_option = key, option
    if best_option:
        return {"type": "scout", **{key: best_option[key]
                for key in ("take_side", "insert_index", "insert_face")}}
    return None


def play_game(initial: Dict, candidate: Optional[str], timings: List[float]) -> Dict:
    state = copy.deepcopy(initial)
    round_wins = {player_id: 0 for player_id in state["players"]}
    for _ in range(3000):
        if state.get("game_over"):
            return {"scores": {player_id: player["score"] for player_id, player in state["players"].items()},
                    "round_wins": round_wins}
        if state["phase"] == "choose_orientation":
            player_id = next(player_id for player_id, player in state["players"].items()
                             if not player["hand_ready"])
        else:
            player_id = state["current_turn"]
        started = time.perf_counter()
        action = (ScoutGame.bot_move(state, player_id) if player_id == candidate
                  else legacy_action(state, player_id))
        if player_id == candidate:
            timings.append((time.perf_counter() - started) * 1000)
        previous_summary = state.get("last_round_summary")
        _, error = ScoutGame.apply_action(state, player_id, action)
        if error:
            raise AssertionError((player_id, action, error))
        if state.get("last_round_summary") is not previous_summary:
            round_wins[state["last_round_summary"]["winner"]] += 1
    raise AssertionError("Scout game did not finish within 3000 actions")


def benchmark(count: int, seeds: int, seed: int) -> Dict:
    improvements, wins, round_wins, timings = [], [], [], []
    for offset in range(seeds):
        players = [{"player_id": f"p{seat}", "name": f"Bot {seat}", "seat": seat, "is_bot": True}
                   for seat in range(count)]
        initial = ScoutGame.init_game({"seed": seed + offset}, players)
        baseline = play_game(initial, None, [])
        for candidate in initial["players"]:
            result = play_game(initial, candidate, timings)
            scores = result["scores"]
            improvements.append(scores[candidate] - baseline["scores"][candidate])
            maximum = max(scores.values())
            wins.append((1.0 / sum(score == maximum for score in scores.values()))
                        if scores[candidate] == maximum else 0.0)
            round_wins.append(result["round_wins"][candidate] / initial["total_rounds"])
    ordered = sorted(timings)
    return {"players": count, "games": len(wins), "mean_score_gain_vs_legacy": round(statistics.mean(improvements), 3),
            "win_share": round(statistics.mean(wins), 3), "round_win_share": round(statistics.mean(round_wins), 3),
            "decision_ms_mean": round(statistics.mean(timings), 3),
            "decision_ms_p95": round(ordered[int(0.95 * (len(ordered) - 1))], 3),
            "decision_ms_max": round(max(timings), 3)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Seat-rotated Scout games against the original strongest-combo bot.")
    parser.add_argument("--seeds", type=int, default=20)
    parser.add_argument("--seed", type=int, default=20261119)
    parser.add_argument("--players", type=int, nargs="+", default=[2, 3, 4, 5], choices=[2, 3, 4, 5])
    args = parser.parse_args()
    if args.seeds < 1:
        parser.error("--seeds must be positive")
    for count in args.players:
        print(json.dumps(benchmark(count, args.seeds, args.seed)), flush=True)


if __name__ == "__main__":
    main()
