"""Deterministic public views used by the Patchwork browser acceptance test."""

import copy
import json

from game.patchwork import BOARD_SIZE, END_POSITION, PATCHES_BY_ID, PatchworkGame


def build_views() -> dict:
    players = [
        {"player_id": "p0", "name": "Calvin", "seat": 0, "is_bot": False},
        {"player_id": "p1", "name": "Mira", "seat": 1, "is_bot": False},
    ]
    state = PatchworkGame.init_game({"seed": 7}, copy.deepcopy(players))
    views = {}

    def save(name: str, viewer: str = "p0") -> None:
        views[name] = copy.deepcopy(PatchworkGame.get_public_view(state, viewer))

    save("start")
    state["current_turn"] = "p1"
    save("waiting")
    state["current_turn"] = "p0"

    patch_id = state["patch_circle"][state["neutral_index"]]
    patch = PATCHES_BY_ID[patch_id]
    state["players"]["p0"]["buttons"] = max(8, patch["cost_buttons"])
    save("ready_to_place")

    state["pending_special_patch"] = {
        "player_id": "p0",
        "position": 17,
        "remaining_target": 17,
    }
    state["current_turn"] = "p0"
    save("bonus_patch")
    state["pending_special_patch"] = None

    for player_id, player_state in state["players"].items():
        player_state["time_position"] = END_POSITION
        player_state["buttons"] = 24 if player_id == "p0" else 18
        player_state["quilt_board"] = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    state["game_over"] = True
    state["current_turn"] = None
    state["scores"] = {"p0": -18, "p1": -30}
    state["winner"] = ["p0"]
    save("game_over")

    return views


if __name__ == "__main__":
    print(json.dumps(build_views(), ensure_ascii=False))
