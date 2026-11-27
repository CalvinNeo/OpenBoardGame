import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from game.modern_art import ModernArtGame as Game
from tests.test_modern_art import action, give, make_game


def fixtures():
    output = {}
    state = make_game(5)
    state["player_meta"]["player1"]["name"] = "Alexandra Long Collector 名字"
    output["five-players"] = Game.get_public_view(state, "player0")
    state = make_game()
    give(state, "player0", *state["deck"][:12])
    output["long-hand"] = Game.get_public_view(state, "player0")
    for kind in ("open", "once", "sealed", "fixed", "double"):
        state = make_game()
        card = f"lite_metal-{kind}-0"
        give(state, "player0", card)
        Game.apply_action(state, "player0", action(state, "offer", cards=[card]))
        if kind == "fixed":
            Game.apply_action(state, "player0", action(state, "set_price", amount=10))
        output[kind] = Game.get_public_view(state, "player1")
        if kind == "sealed":
            Game.apply_action(state, "player1", action(state, "bid", amount=10))
            Game.apply_action(state, "player2", action(state, "bid", amount=13))
            output["sealed-wait"] = Game.get_public_view(state, "player1")
            Game.apply_action(state, "player0", action(state, "bid", amount=10))
            output["auction-end"] = Game.get_public_view(state, "player1")
    state = make_game()
    for _ in range(5000):
        if state["phase"] == "round_end":
            output.setdefault("season-end", Game.get_public_view(state, "player0"))
            if state["round"] == 4:
                output["final"] = Game.get_public_view(state, "player0")
                break
        for player_id in state["turn_order"]:
            move = Game.bot_move(state, player_id)
            if move:
                Game.apply_action(state, player_id, move)
                break
    output["spectator"] = Game.get_public_view(state, "spectator")
    return output


if __name__ == "__main__":
    print(json.dumps(fixtures()))
