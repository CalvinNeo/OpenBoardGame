"""Real public views for the Royale browser regression checks."""
import copy
import json
import random

from game.las_vegas import LasVegasGame as Game
from game import las_vegas_royale as royale


def views():
    random.seed(71)
    players = [{"player_id": f"p{i}", "seat": i, "name": name} for i, name in enumerate(
        ["Calvin", "Mira", "Kai", "Jun", "LongPlayerName<&>" * 5])]
    state = Game.init_game({"edition": "royale"}, players)
    state.update(current_turn="p0", start_player="p0")
    result = {"initial": Game.get_public_view(state, "p0")}
    for i, die in enumerate(royale._pieces(state, "p0")):
        die["face"] = 1 if i == 7 else i % 6 + 1
    state.update(phase="place", roll_ids=[d["id"] for d in royale._pieces(state, "p0")])
    state["closed_casino"] = 6
    state["casinos"][1]["gray_dice"] = 3
    result["playing"] = Game.get_public_view(state, "p0")
    result["spectator"] = Game.get_public_view(state, "visitor")
    ids = list(royale.TILE_NAMES)
    for i in range(0, len(ids), 3):
        sample = copy.deepcopy(state)
        sample["tiles"] = [royale._new_tile(tile_id, face) for face, tile_id in enumerate(ids[i:i + 3], 1)]
        result[f"tiles{i}"] = Game.get_public_view(sample, "p0")
    for tile_id in ids:
        sample = copy.deepcopy(state)
        sample.update(tiles=[royale._new_tile(tile_id, 1), royale._new_tile("pay_day", 2),
                             royale._new_tile("high_five", 3)], pending=None, queue=[], closed_casino=None)
        sample["casinos"][3]["gray_dice"] = 2
        placed = royale._pieces(sample, "p0")[0]
        royale._move(sample, placed, "casino:1", 1)
        if tile_id == "my_choice":
            royale._ask(sample, "my_choice", "p0", 1,
                        [royale._option(str(n), f"选择 {n}", number=n) for n in range(1, 7)],
                        rolled=sample["roll_ids"], placed=[placed["id"]])
        else:
            royale._activate(sample, 1, "p0", sample["roll_ids"], [placed["id"]])
            royale._drain(sample)
        if sample["pending"]:
            actor = sample["pending"]["actor"]
            result[tile_id] = Game.get_public_view(sample, actor)
            if tile_id == "lucky_punch":
                Game.apply_action(sample, actor, {"type": "royale_choose", "round": 1, "turn": 1,
                                                 "decision": sample["pending"]["id"], "option": "3"})
                result["lucky_guess"] = Game.get_public_view(sample, "p1")
                result["lucky_waiting"] = Game.get_public_view(sample, "p0")
    sample = copy.deepcopy(state)
    sample.update(tiles=[royale._new_tile("black_box", 1)], closed_casino=None, pending=None, queue=[])
    die = royale._pieces(sample, "p0")[0]
    royale._move(sample, die, "casino:1", 1)
    royale._begin_settlement(sample)
    royale._drain(sample)
    result["black_split"] = Game.get_public_view(sample, "p1")
    result["black_waiting"] = Game.get_public_view(sample, "p0")
    Game.apply_action(sample, "p1", {"type": "royale_choose", "round": 1, "turn": 1,
                                    "decision": sample["pending"]["id"], "option": "7"})
    result["black_pick"] = Game.get_public_view(sample, "p0")
    Game.apply_action(sample, "p0", {"type": "royale_choose", "round": 1, "turn": 1,
                                    "decision": sample["pending"]["id"], "option": "0"})
    result["settled"] = Game.get_public_view(sample, "p0")
    sample["round"] = 3
    for pid in sample["turn_order"]:
        Game.apply_action(sample, pid, {"type": "next_round", "round": 3})
    result["final"] = Game.get_public_view(sample, "p0")
    return result


if __name__ == "__main__":
    print(json.dumps(views()))
