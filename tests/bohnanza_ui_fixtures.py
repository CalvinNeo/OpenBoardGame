import copy
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from game.bohnanza import BohnanzaGame as Game
from tests.test_bohnanza import make_state


def fixtures():
    output = {}
    state = make_state(5)
    state["player_meta"]["farmer1"]["name"] = "AlexandraVeryLongUnbrokenFarmerName"
    state["player_meta"]["farmer2"]["name"] = "名字很长的豆田主人用于检查布局"
    state["players"]["farmer0"].update(
        hand=["blue:0", "red:0", "soy:0", "blue:1", "chili:0", "garden:0", "green:0", "red:1"],
        fields=[["blue:2", "blue:3", "blue:4", "blue:5"], ["red:2", "red:3", "red:4"]],
        gold=["stink:0", "stink:1", "stink:2"],
    )
    for index, player_id in enumerate(state["turn_order"][1:], 1):
        state["players"][player_id]["fields"] = [[f"soy:{index}", f"soy:{index + 1}"], [f"green:{index}"]]
    output["plant"] = Game.get_public_view(state, "farmer0")
    state.update(phase="trade", market=["garden:1", "chili:1"])
    output["trade"] = Game.get_public_view(state, "farmer0")
    state["offer"] = {"from": "farmer1", "to": "farmer0", "give": ["soy:4"], "want": ["blue"]}
    output["incoming"] = Game.get_public_view(state, "farmer0")
    state["offer"] = {"from": "farmer0", "to": "farmer1", "give": ["garden:1"], "want": ["blue"]}
    output["outgoing"] = Game.get_public_view(state, "farmer0")
    state.update(phase="plant_traded", offer=None, market=[])
    state["players"]["farmer0"]["pending"] = ["garden:2", "garden:3", "green:7", "soy:8"]
    output["received"] = Game.get_public_view(state, "farmer0")
    state.update(phase="round_summary", next_round_ready=["farmer1", "farmer2"])
    output["review"] = Game.get_public_view(state, "farmer0")
    state["players"]["farmer0"]["pending"] = []
    state.update(phase="draw", exhaustions=2, deck=["stink:5"], current_turn="farmer0")
    Game.apply_action(state, "farmer0", {"type": "end_turn"})
    output["final"] = Game.get_public_view(state, "farmer0")
    output["spectator"] = Game.get_public_view(state, "visitor")
    for player_id in state["turn_order"]:
        Game.apply_action(state, player_id, {"type": "confirm"})
    output["ended"] = Game.get_public_view(state, "farmer0")
    three = make_state(3)
    output["three-fields"] = Game.get_public_view(three, "farmer0")
    return copy.deepcopy(output)


if __name__ == "__main__":
    print(json.dumps(fixtures()))
