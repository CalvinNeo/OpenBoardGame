"""Deterministic public views for the Ponzi Scheme layout regression."""
import copy
import json

from game.ponzi_scheme import PonziSchemeGame as Game, _settle


def views() -> dict:
    names = ["Alice", "Bob", "Catherine", "Diego", "Evelyn"]
    players = [{"player_id": name.lower(), "name": name, "seat": index}
               for index, name in enumerate(names)]
    state = Game.init_game({"seed": 100, "advanced": True}, players)
    result = {"initial": Game.get_public_view(state, "alice")}
    for index, player in enumerate(state["players"].values()):
        player["cash"] = 120
        player["industries"].update(transport=2, grain=1, media=index % 3)
        player["debts"] = [{**card, "remaining": position + 1}
                           for position, card in enumerate(state["market"][:3])]
    state["round"] = 4
    result["funding"] = Game.get_public_view(state, "alice")
    state["phase"] = "trading"
    result["trading"] = Game.get_public_view(state, "alice")
    basic = copy.deepcopy(state)
    basic["config"]["advanced"] = False
    result["basic_trading"] = Game.get_public_view(basic, "alice")
    for player in basic["players"].values():
        player["industries"] = dict.fromkeys(player["industries"], 0)
    result["pass_only"] = Game.get_public_view(basic, "alice")
    _, error = Game.apply_action(state, "alice", {
        "type": "offer_trade", "target": "bob", "industry": "transport", "amount": 25,
    })
    assert error is None, error
    result["offer"] = Game.get_public_view(state, "bob")
    result["private_offer"] = Game.get_public_view(state, "catherine")
    state["players"]["bob"]["cash"] = 0
    result["sell_only"] = Game.get_public_view(state, "bob")
    state["players"]["bob"]["cash"] = 120
    state.update(phase="market_remove", current_turn="alice", offer=None)
    result["remove"] = Game.get_public_view(state, "alice")
    state.update(phase="crash_discard", crashed=True)
    result["crash"] = Game.get_public_view(state, "alice")
    _settle(state)
    result["review"] = Game.get_public_view(state, "alice")
    state["players"]["bob"]["cash"] = 0
    for card in state["players"]["bob"]["debts"]:
        card["remaining"] = 1
    _settle(state)
    result["game_over"] = Game.get_public_view(state, "alice")
    stress = copy.deepcopy(result["funding"])
    for player in stress["players"]:
        player["name"] = "LongInvestorName<&>" * 5
    stress["players"][0]["cash"] = 123456789
    stress["log"] = ["Public industry transfer " * 12] * 50
    stress["players"][0]["debts"] *= 12
    result["stress"] = stress
    small = Game.init_game({"seed": 101}, players[:3])
    result["three_players"] = Game.get_public_view(small, "alice")
    return result


if __name__ == "__main__":
    print(json.dumps(views()))
