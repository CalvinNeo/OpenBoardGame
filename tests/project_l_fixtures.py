"""Deterministic public views for the Project L browser acceptance test."""

import copy
import json
import random

from game.project_l import PIECE_DEFS, PUZZLES, ProjectLGame


def build_views() -> dict:
    random.seed(37)
    players = [
        {"player_id": "p0", "name": "Alex", "seat": 0},
        {"player_id": "p1", "name": "Robin", "seat": 1},
        {"player_id": "p2", "name": "Sam", "seat": 2},
        {"player_id": "p3", "name": "Taylor", "seat": 3},
    ]
    state = ProjectLGame.init_game({}, players)
    state["current_turn"] = "p0"
    state["market"] = {"white": [1, 2, 3, 4], "black": [33, 34, 35, 36]}
    views = {}

    def save(name: str, viewer: str = "p0") -> None:
        views[name] = copy.deepcopy(ProjectLGame.get_public_view(state, viewer))

    save("start")
    for player_id in ["p1", "p2", "p3"]:
        state["players"][player_id]["active_puzzles"] = [
            {"card_id": 5, "placed": []},
            {"card_id": 6, "placed": []},
        ]
    state["players"]["p1"]["active_puzzles"][0]["placed"] = [
        {"piece_id": "L1_I", "row": 0, "col": 0, "rotation": 0, "flip": False},
    ]
    state["players"]["p0"]["active_puzzles"] = [
        {"card_id": 1, "placed": []},
        {"card_id": 2, "placed": []},
    ]
    state["players"]["p0"]["inventory"] = ["L1_I", "L1_I", "L2_I", "L3_V", "L4_T"]
    save("placement")
    save("spectator", "visitor")
    state["current_turn"] = "p1"
    save("waiting")
    state["current_turn"] = "p0"
    state["players"]["p0"]["active_puzzles"][0]["placed"] = [
        {"piece_id": "L1_I", "row": 0, "col": 0, "rotation": 0, "flip": False},
    ]
    save("occupied")
    state["players"]["p0"]["active_puzzles"][0]["placed"] = []
    blank_origin = next(
        card_id for card_id, puzzle in PUZZLES.items()
        if puzzle["height"] >= 2 and puzzle["width"] >= 2
        and puzzle["grid"][0][:2] == [0, 1]
        and puzzle["grid"][1][:2] == [1, 1]
    )
    state["players"]["p0"]["active_puzzles"] = [{"card_id": blank_origin, "placed": []}]
    save("blank_origin")

    largest = sorted(PUZZLES, key=lambda card_id: PUZZLES[card_id]["width"] * PUZZLES[card_id]["height"], reverse=True)[:4]
    state["players"]["p0"]["active_puzzles"] = [{"card_id": card_id, "placed": []} for card_id in largest]
    state["players"]["p0"]["inventory"] = list(PIECE_DEFS) * 8
    state["players"]["p0"]["completed_puzzles"] = list(PUZZLES)[:28]
    state["players"]["p0"]["score"] = 18
    save("full")
    state["player_meta"]["p0"]["name"] = '<img src=x onerror="window.projectLInjected=true">'
    state["player_meta"]["p1"]["name"] = "AnExtremelyLongUnbrokenPlayerNameThatMustNotOverflowTheBoard"
    save("long_names")
    state["player_meta"]["p0"]["name"] = "Alex"
    state["player_meta"]["p1"]["name"] = "Robin"
    state["black_deck"] = []
    state["end_triggered"] = True
    state["market"]["black"] = [None] * 4
    save("final_round")
    state["players"]["p0"]["active_puzzles"] = [{"card_id": 1, "placed": []}]
    state["phase"] = "finishing"
    state["current_turn"] = None
    state["current_ap"] = 0
    state["players"]["p0"]["finishing_placed"] = 2
    save("finishing")
    state["players"]["p0"]["finishing_done"] = True
    save("finishing_waiting")
    state["phase"] = "game_over"
    state["game_over"] = True
    state["scores"] = {"p0": 16, "p1": 8, "p2": 6, "p3": 4}
    state["winner"] = ["p0"]
    save("game_over")
    return views


if __name__ == "__main__":
    print(json.dumps(build_views(), ensure_ascii=False))
