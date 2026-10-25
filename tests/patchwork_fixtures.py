"""Deterministic public views used by the Patchwork browser acceptance test."""

import copy
import json

from game.patchwork import (
    BOARD_SIZE, END_POSITION, PATCHES_BY_ID, PatchworkGame,
    _maybe_finalize_game, _transform_shape,
)


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
    save("spectator", "visitor")
    state["current_turn"] = "p1"
    save("waiting")
    state["current_turn"] = "p0"

    choices = ["patch_28", "patch_16", "patch_31"]
    state["patch_circle"] = choices + [patch_id for patch_id in state["patch_circle"] if patch_id not in choices]
    state["neutral_index"] = 0
    state["players"]["p0"]["buttons"] = 20
    save("placement")
    save("placement_spectator", "visitor")
    state["players"]["p0"]["buttons"] = 0
    save("no_cash")
    state["players"]["p0"]["buttons"] = 20
    state["players"]["p0"]["quilt_board"][4][4] = "leather_20"
    save("occupied")
    state["player_meta"]["p0"]["name"] = '<img src=x onerror="window.patchworkInjected=true">'
    state["player_meta"]["p1"]["name"] = "VeryLongUnbrokenPlayerNameToCheckEveryLayoutAndDialog"
    save("long_names")
    for player in players:
        state["player_meta"][player["player_id"]]["name"] = player["name"]

    state["pending_special_patch"] = {
        "player_id": "p0",
        "position": 20,
        "remaining_target": 20,
    }
    state["current_turn"] = "p0"
    save("bonus_patch")
    save("bonus_spectator", "visitor")
    state["pending_special_patch"]["player_id"] = "p1"
    state["current_turn"] = "p1"
    save("bonus_waiting")
    state["pending_special_patch"] = None
    state["current_turn"] = "p0"
    state["players"]["p0"]["quilt_board"] = [[None] * BOARD_SIZE for _ in range(BOARD_SIZE)]
    events, error = PatchworkGame.apply_action(state, "p0", {
        "type": "buy_patch", "patch_id": "patch_28", "rotation": 0, "flip": False, "x": 0, "y": 0,
    })
    assert error is None, error
    save("after_purchase")
    state["players"]["p0"]["time_position"] = 32
    state["players"]["p1"]["time_position"] = 34
    state["current_turn"] = "p0"
    state["claimed_leathers"] = [20, 26, 32]
    save("midgame")
    state["patch_circle"] = ["patch_16"]
    state["neutral_index"] = 0
    save("one_patch")
    state["patch_circle"] = []
    save("empty_market")

    for player_id, player_state in state["players"].items():
        player_state["time_position"] = END_POSITION
        player_state["buttons"] = 24 if player_id == "p0" else 18
        player_state["quilt_board"] = [["patch_28" if column < 7 and row < 7 else None for column in range(BOARD_SIZE)] for row in range(BOARD_SIZE)]
    state["special_tile_available"] = False
    state["players"]["p0"]["has_special_tile"] = True
    state["first_to_finish"] = "p1"
    _maybe_finalize_game(state, [])
    save("game_over")
    save("game_over_spectator", "visitor")

    return views


if __name__ == "__main__":
    orientations = {
        patch_id: {
            f"{rotation}:{str(flip).lower()}": _transform_shape(patch["cells"], rotation, flip)
            for rotation in (0, 90, 180, 270) for flip in (False, True)
        }
        for patch_id, patch in PATCHES_BY_ID.items()
    }
    print(json.dumps({"views": build_views(), "orientations": orientations}, ensure_ascii=False))
