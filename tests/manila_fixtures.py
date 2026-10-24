import copy
import json
import random

from game.manila import ManilaGame, _init_boat


def build_views() -> dict:
    random.seed(24)
    players = [
        {"player_id": "p0", "name": "Calvin", "seat": 0, "is_bot": False},
        {"player_id": "p1", "name": "Mira", "seat": 1, "is_bot": False},
        {"player_id": "p2", "name": "Jun", "seat": 2, "is_bot": False},
        {"player_id": "p3", "name": "Sora", "seat": 3, "is_bot": False},
        {"player_id": "p4", "name": "Alex", "seat": 4, "is_bot": False},
    ]
    state = ManilaGame.init_game(None, copy.deepcopy(players))
    state["current_player"] = "p0"
    state["round"] = 3
    state["price_track"] = {"nutmeg": 5, "silk": 10, "ginseng": 20, "jade": 5}
    state["players"]["p0"]["stocks"] = {"nutmeg": 1, "silk": 2, "ginseng": 0, "jade": 1}
    state["players"]["p0"]["pledged"] = {"nutmeg": 0, "silk": 0, "ginseng": 1, "jade": 0}
    state["auction"].update(highest_bid=5, leader="p1", bids={"p0": 0, "p1": 5, "p2": 3, "p3": 0, "p4": 0})
    views = {}

    def save(name: str, viewer: str = "p0") -> None:
        views[name] = copy.deepcopy(ManilaGame.get_public_view(state, viewer))

    save("auction")
    save("auction_waiting", "p2")
    state["harbormaster"] = "p0"
    state["harbormaster_bid"] = 12
    state["phase"] = "harbormaster_pay"
    state["players"]["p0"]["cash"] = 2
    save("payment")
    state["players"]["p0"]["cash"] = 26
    state["phase"] = "harbormaster_buy"
    save("buy")
    save("buy_waiting", "p2")
    state["phase"] = "harbormaster_cargo"
    save("cargo")
    state["cargo_slots"] = ["nutmeg", "ginseng", "jade"]
    state["phase"] = "harbormaster_position"
    save("positions")
    save("positions_waiting", "p2")
    state["boats"] = {
        "nutmeg": _init_boat("nutmeg", 8),
        "ginseng": _init_boat("ginseng", 5),
        "jade": _init_boat("jade", 10),
    }
    state["boats"]["nutmeg"].update(seats=["p1", None, None], last_roll=4)
    state["boats"]["ginseng"].update(seats=["p0", None, "p2", None], last_roll=3)
    state["boats"]["jade"].update(seats=[None, "p3", None], last_roll=6)
    state["board"]["port"]["A"] = "p2"
    state["board"]["shipyard"]["B"] = "p3"
    state["board"]["pirates"]["captain"] = "p4"
    state["players"]["p0"]["workers_available"] = 2
    state["phase"] = "placement"
    save("placement")
    save("waiting", "p2")
    save("spectator", "visitor")
    state["players"]["p0"]["cash"] = 0
    save("no_cash")
    state["players"]["p0"]["workers_available"] = 0
    save("no_workers")
    state["players"]["p0"]["cash"] = 26
    state["players"]["p0"]["workers_available"] = 2
    state["player_meta"]["p1"]["name"] = "VeryLongUnbrokenPlayerNameToVerifyNoOverflowAtAnyViewport"
    state["player_meta"]["p2"]["name"] = "名字很长的商人验证容器和对话框都不会溢出"
    state["player_meta"]["p3"]["name"] = '<img src=x onerror="window.manilaInjected=true">'
    save("long_names")
    state["current_player"] = "p1"
    save("long_waiting")
    state["current_player"] = "p0"
    for player in players:
        state["player_meta"][player["player_id"]]["name"] = player["name"]
    state["phase"] = "pilot"
    state["board"]["pilots"] = {"big": "p0", "small": "p1"}
    state["pending_pilots"] = ["big", "small"]
    save("pilot_big")
    save("pilot_waiting", "p2")
    state["board"]["pilots"] = {"big": "p1", "small": "p0"}
    state["pending_pilots"] = ["small"]
    save("pilot_small")
    state["phase"] = "pirate"
    state["board"]["pirates"] = {"captain": "p0", "pirate": "p1"}
    state["pirate_pending"] = ["p0", "p1"]
    state["pirate_targets"] = ["nutmeg", "jade"]
    state["pirate_day"] = 2
    state["boats"]["nutmeg"]["position"] = 13
    state["boats"]["jade"]["position"] = 13
    save("pirate_board")
    state["boats"]["nutmeg"]["seats"] = ["p2", "p3", "p4"]
    save("pirate_full")
    state["pirate_day"] = 3
    state["pirate_pending"] = ["p0"]
    save("pirate_plunder")
    save("pirate_waiting", "p2")
    state["phase"] = "round_end"
    state["current_player"] = None
    state["boats"]["nutmeg"].update(plundered=True, plunder_result="shipyard")
    state["boats"]["jade"].update(arrived=True, arrived_slot="A")
    state["port_arrivals"]["A"] = "jade"
    state["round_ledger"] = {
        "p0": {"earn": {"Pirate Plunder": 12, "Pledge Loan": 12}, "spend": {"Harbormaster Bid": 5, "Seat Ginseng #1": 3}},
        "p1": {"earn": {"Pirate Plunder": 12}, "spend": {"Pirates": 5}},
        "p2": {"earn": {"Port A": 6}, "spend": {"Port A": 4, "Seat Nutmeg #1": 2}},
        "p3": {"earn": {"Ship Jade": 30, "Shipyard B": 8}, "spend": {"Seat Jade #2": 4}},
        "p4": {"earn": {}, "spend": {"Insurance Payout": 20}},
    }
    state["players"]["p1"]["round_ready"] = True
    save("review")
    state["players"]["p0"]["round_ready"] = True
    save("ready")
    save("review_spectator", "visitor")
    state["phase"] = "game_over"
    state["game_over"] = True
    state["winner"] = ["p0", "p3"]
    state["price_track"]["ginseng"] = 30
    save("finished")
    save("finished_spectator", "visitor")
    return views


if __name__ == "__main__":
    print(json.dumps(build_views()))
