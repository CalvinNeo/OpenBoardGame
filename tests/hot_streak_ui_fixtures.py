import copy
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from game.hot_streak import HotStreakGame


LONG_NAMES = [
    "Alexandra Featherstonehaugh",
    "名字很长的玩家检查换行",
    "Maximilian von Habsburg-Lothringen",
    "Beatrice Withaverylongunbrokensurname",
    "Chen",
    "Dmitri",
    "Emilie Rousseau",
    "Sam",
]


def new_game(count: int, seed: int, long_names: bool = False) -> dict:
    players = [
        {
            "player_id": f"p{index + 1}",
            "name": LONG_NAMES[index] if long_names else f"Player {index + 1}",
            "seat": index,
            "is_bot": False,
        }
        for index in range(count)
    ]
    return HotStreakGame.init_game({"seed": seed}, players)


def apply(state: dict, player_id: str, action: dict) -> None:
    _, error = HotStreakGame.apply_action(state, player_id, action)
    if error:
        raise AssertionError(f"{action}: {error}")


def draft_one(state: dict) -> None:
    player_id = state["draft_sequence"][state["draft_cursor"]]
    stack_id = next(stack for stack, tickets in state["ticket_stacks"].items() if tickets)
    action = {"type": "draft_ticket", "stack_id": stack_id, "mode": "safe"}
    if state["race_number"] == 3 and state["draft_counts"][player_id] == 1:
        action["double_bet_id"] = "new"
    apply(state, player_id, action)


def finish_draft(state: dict) -> None:
    while state["phase"] == "betting":
        draft_one(state)


def submit_cards(state: dict, skip: str = "") -> None:
    required = 2 if len(state["turn_order"]) == 2 else 1
    for player_id in state["turn_order"]:
        if player_id != skip:
            apply(state, player_id, {
                "type": "submit_race_cards",
                "card_ids": state["players"][player_id]["hand"][:required],
            })


def advance(state: dict) -> None:
    player_id = next(player_id for player_id in state["turn_order"]
                     if "advance_race" in HotStreakGame.get_legal_actions(state, player_id))
    apply(state, player_id, {
        "type": "advance_race", "expected_step_index": state["step_index"],
    })


def finish_race(state: dict) -> None:
    for step in range(500):
        if state["phase"] not in {"racing", "race_countdown"}:
            return
        advance(state)
    raise AssertionError("Race did not finish")


def ready_all(state: dict) -> None:
    for player_id in state["turn_order"]:
        if "next_round" in HotStreakGame.get_legal_actions(state, player_id):
            apply(state, player_id, {"type": "next_round"})


def fixtures() -> dict:
    views = {}
    state = new_game(5, 11)
    viewer = state["draft_sequence"][state["draft_cursor"]]
    views["betting_self"] = HotStreakGame.get_public_view(state, viewer)
    views["betting_other"] = HotStreakGame.get_public_view(state, "p1" if viewer != "p1" else "p2")
    views["spectator"] = HotStreakGame.get_public_view(state, "spectator")

    state = new_game(8, 23, long_names=True)
    viewer = state["draft_sequence"][state["draft_cursor"]]
    views["betting_eight_long"] = HotStreakGame.get_public_view(state, viewer)
    finish_draft(state)
    submit_cards(state)
    finish_race(state)
    views["result_eight_long"] = HotStreakGame.get_public_view(state, viewer)

    state = new_game(5, 41)
    finish_draft(state)
    submit_cards(state, skip="p1")
    views["card_selection"] = HotStreakGame.get_public_view(state, "p1")
    views["card_submitted"] = HotStreakGame.get_public_view(state, "p2")

    state = new_game(2, 43)
    finish_draft(state)
    views["card_selection_two"] = HotStreakGame.get_public_view(state, "p1")

    state = new_game(6, 53)
    finish_draft(state)
    submit_cards(state)
    views["countdown"] = HotStreakGame.get_public_view(state, "p1")
    for step in range(9):
        advance(state)
    views["racing"] = HotStreakGame.get_public_view(state, "p1")
    crowded = copy.deepcopy(views["racing"])
    for racer in crowded["racers"]:
        racer.update(status="active", lane=1, position=6, fallen=True, facing="backward")
    views["racing_crowded"] = crowded
    finish_race(state)
    views["race_result"] = HotStreakGame.get_public_view(state, "p1")
    apply(state, "p1", {"type": "next_round"})
    views["race_ready"] = HotStreakGame.get_public_view(state, "p1")

    state = new_game(6, 71)
    finish_draft(state)
    submit_cards(state)
    for step in range(500):
        if state.get("track_back_edge", 0) > 0 or state["phase"] not in {"racing", "race_countdown"}:
            break
        advance(state)
    views["racing_folded"] = HotStreakGame.get_public_view(state, "p1")

    state = new_game(4, 31)
    for race in range(2):
        finish_draft(state)
        submit_cards(state)
        finish_race(state)
        ready_all(state)
    while state["phase"] == "betting":
        player_id = state["draft_sequence"][state["draft_cursor"]]
        if state["draft_counts"][player_id] == 1:
            views["betting_race3_double"] = HotStreakGame.get_public_view(state, player_id)
            break
        draft_one(state)
    finish_draft(state)
    submit_cards(state)
    finish_race(state)
    views["game_over"] = HotStreakGame.get_public_view(state, "p1")
    return views


if __name__ == "__main__":
    print(json.dumps(fixtures(), ensure_ascii=False))
