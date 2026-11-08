"""Deterministic The Mind UI fixtures: python3 -m tests.the_mind_ui prints JSON views.

Only used by tests/the_mind.browser.cjs for responsive layout and interaction QA.
No endpoints are added to the production application.
"""
import copy
import json

from game.the_mind import TheMindGame as Game, _deal


NAMES = ["Alex", "Morgan", "Jamie", "Riley"]


def make(count, seed=147):
    people = [{"player_id": "p%d" % index, "name": NAMES[index], "seat": index} for index in range(count)]
    return Game.init_game({"seed": seed}, people)


def act(state, player_id, kind, **fields):
    action = {"type": kind, "game_token": state["game_token"], "window_id": state["window_id"]}
    action.update(fields)
    _, error = Game.apply_action(state, player_id, action)
    if error:
        raise ValueError(error)


def playing(state, hands, level):
    state["level"] = level
    for player_id, hand in zip(state["turn_order"], hands):
        state["players"][player_id]["hand"] = sorted(hand)
    state["phase"] = "playing"
    state["window_id"] += 1
    return state


def build():
    views = {}

    state = make(2)
    views["focus"] = Game.get_public_view(state, "p0")
    ready = copy.deepcopy(state)
    act(ready, "p0", "ready")
    views["focus_waiting"] = Game.get_public_view(ready, "p0")

    four = playing(make(4), [[7, 41, 92], [71, 73], [61, 63], [67]], 3)
    four["pile"] = [{"player_id": "p1", "card": 3}, {"player_id": "p2", "card": 5}, {"player_id": "p3", "card": 6}]
    four["discarded"] = [{"player_id": "p2", "card": 4, "reason": "mistake"}]
    four["log"].extend([
        {"kind": "new_level", "level": 3},
        {"kind": "play", "level": 3, "player_id": "p1", "card": 3},
        {"kind": "play", "level": 3, "player_id": "p2", "card": 5},
        {"kind": "mistake", "level": 3, "player_id": "p2", "cards": [{"player_id": "p2", "card": 4}]},
        {"kind": "play", "level": 3, "player_id": "p3", "card": 6},
    ])
    views["playing"] = Game.get_public_view(four, "p0")
    views["playing_spectator"] = Game.get_public_view(four, "visitor")

    empty = playing(make(3), [[], [58, 77], [64]], 2)
    empty["pile"] = [{"player_id": "p0", "card": 12}]
    views["playing_empty_hand"] = Game.get_public_view(empty, "p0")

    mistake = playing(make(2), [[80, 90], [20, 30]], 3)
    act(mistake, "p0", "play", card=80)
    views["mistake"] = Game.get_public_view(mistake, "p0")

    vote = playing(make(3), [[12, 88], [34, 67], [51, 95]], 2)
    act(vote, "p1", "request_star")
    views["star_vote"] = Game.get_public_view(vote, "p0")
    act(vote, "p0", "vote_star", agree=True)
    views["star_vote_voted"] = Game.get_public_view(vote, "p0")

    star = playing(make(2), [[15, 60], [22, 70]], 2)
    act(star, "p0", "request_star")
    act(star, "p1", "vote_star", agree=True)
    views["star_used"] = Game.get_public_view(star, "p0")

    cleared = playing(make(2), [[10], [20]], 2)
    act(cleared, "p0", "play", card=10)
    act(cleared, "p1", "play", card=20)
    views["round_end"] = Game.get_public_view(cleared, "p0")
    act(cleared, "p0", "next_round")
    views["round_end_confirmed"] = Game.get_public_view(cleared, "p0")

    life = playing(make(2), [[11], [21]], 3)
    act(life, "p0", "play", card=11)
    act(life, "p1", "play", card=21)
    views["round_end_life"] = Game.get_public_view(life, "p1")

    won = playing(make(2), [[10], [20]], 12)
    act(won, "p0", "play", card=10)
    act(won, "p1", "play", card=20)
    views["game_over_win"] = Game.get_public_view(won, "p0")

    lost = playing(make(2), [[80], [20]], 3)
    lost["lives"] = 1
    act(lost, "p0", "play", card=80)
    views["game_over_lose"] = Game.get_public_view(lost, "p0")

    big = make(2, seed=99)
    big["level"] = 12
    _deal(big)
    views["big_hand"] = Game.get_public_view(big, "p0")

    maxed = copy.deepcopy(views["playing"])
    maxed["lives"] = 5
    maxed["stars"] = 3
    views["maxed"] = maxed

    long_names = copy.deepcopy(views["playing"])
    for entry in long_names["players"]:
        entry["name"] = "VeryLongUnbrokenPlayerNameForResponsiveLayout" + entry["player_id"]
    long_names["players"][0]["name"] = "<img src=x onerror=1>"
    long_names["players"][2]["is_bot"] = True
    views["long_names"] = long_names

    return views


if __name__ == "__main__":
    print(json.dumps(build()))
