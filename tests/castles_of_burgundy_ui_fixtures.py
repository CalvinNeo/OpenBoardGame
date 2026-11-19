import copy
import json

from game.castles_of_burgundy import CastlesOfBurgundyGame as Game


def build_fixtures() -> dict:
    players = [
        {"player_id": "alice", "name": "Alice", "seat": 0},
        {"player_id": "bob", "name": "Bob", "seat": 1},
    ]
    state = Game.init_game({"seed": 97}, players)
    viewer = state["current_turn"]
    state["players"][viewer].update(workers=12, silver=6)
    fixtures = {"initial": Game.get_public_view(state, viewer)}
    for kind in ("ship", "building", "knowledge"):
        state["players"][viewer]["storage"].append(state["supply"][kind].pop())
    fixtures["storage"] = Game.get_public_view(state, viewer)
    full = copy.deepcopy(state)
    full["players"][viewer]["estate"][0]["tile"] = {
        "id": "test-knowledge-6", "kind": "knowledge", "number": 6,
    }
    fixtures["full"] = Game.get_public_view(full, viewer)
    ship = copy.deepcopy(state)
    ship["players"][viewer]["storage"] = ship["players"][viewer]["storage"][:1]
    option = next(option for option in Game.get_public_view(ship, viewer)["options"]
                  if option["action"]["type"] == "place")
    _, error = Game.apply_action(ship, viewer, option["action"])
    if error or ship["pending"]["kind"] != "ship":
        raise RuntimeError(f"Could not create ship UI fixture: {error}")
    fixtures["ship"] = Game.get_public_view(ship, viewer)
    review = Game.init_game({"seed": 97}, players)
    for _ in range(20):
        current = review["current_turn"]
        options = Game.get_public_view(review, current)["options"]
        option = next((option for option in options if option["action"]["type"] == "workers"), None)
        if option is None:
            option = next(option for option in options if option["action"]["type"] == "end_turn")
        _, error = Game.apply_action(review, current, option["action"])
        if error:
            raise RuntimeError(f"Could not create round review UI fixture: {error}")
        if review["phase"] == "round_end":
            break
    fixtures["review"] = Game.get_public_view(review, viewer)
    fixtures["spectator"] = Game.get_public_view(state, None)
    finished = copy.deepcopy(fixtures["storage"])
    finished.update(game_over=True, winner=[viewer], options=[], final_scores={
        viewer: {"total": 123, "during_game": 100, "goods": 4, "silver": 6,
                 "workers": 3, "knowledge": 10, "knowledge_details": {"15": 6, "24": 4}},
    })
    fixtures["finished"] = finished
    four = Game.init_game({"seed": 97}, players + [
        {"player_id": "carol", "name": "Carol with a longer display name", "seat": 2},
        {"player_id": "david", "name": "David", "seat": 3},
    ])
    fixtures["four"] = Game.get_public_view(four, four["current_turn"])
    return fixtures


if __name__ == "__main__":
    print(json.dumps(build_fixtures()))
