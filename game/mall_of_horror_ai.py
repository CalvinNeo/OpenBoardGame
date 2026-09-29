"""Practice opponents; input is exactly the view a seated player receives."""

from typing import Dict, Optional


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view["legal_actions"]
    if not legal:
        return None
    pid = view["you"]
    own = [c for c in view["characters"] if c["alive"] and c["owner"] == pid]
    locs = {loc["id"]: loc for loc in view["locations"]}
    values = {"hide": 9, "weapon2": 8, "sprint": 7, "weapon1": 6, "hardware": 5, "threat": 4, "camera": 3}

    def danger(number: int) -> float:
        loc = locs[number]
        incoming = view["forecast"].count(number) if view["forecast"] and not view["revealed"] else 0
        zombies = loc["zombies"] + incoming
        if number == 4:
            return zombies * 2 + 2
        if number == 6 and zombies >= 4:
            return 8 + zombies
        return zombies - loc["strength"] + (1 if loc["occupants"] >= 4 else 0)

    fields = {}
    if "place" in legal:
        kind = "place"
        char = next(c for c in own if c["location"] is None)
        number = min(view["setup_locations"], key=lambda n: (
            sum(c["location"] == n for c in own) * 3 + locs[n]["occupants"] - (2 if n == 5 else 0), n))
        fields = {"character_id": char["id"], "destination": number}
    elif "distribute" in legal:
        kind = "distribute"
        cards = sorted(view["loot"], key=lambda c: -values[c["kind"]])
        others = [p for p in view["players"] if p["player_id"] != pid]
        recipient = min(others, key=lambda p: (p["points"], p["seat"]))["player_id"]
        fields = {"keep_id": cards[0]["id"], "give_id": cards[-1]["id"] if len(cards) > 1 else None,
                  "recipient_id": recipient if len(cards) > 1 else None}
    elif "choose_destination" in legal:
        kind = "choose_destination"
        number = min(view["destination_options"], key=lambda n: (
            danger(n) + (6 if locs[n]["capacity"] is not None and locs[n]["occupants"] >= locs[n]["capacity"] else 0)
            + (0 if n == 5 else 0.3), n))
        fields = {"destination": number}
    elif "place_zombie" in legal:
        kind = "place_zombie"
        number = max((loc["id"] for loc in view["locations"] if not loc["closed"]), key=lambda n: (
            sum(c["points"] for c in view["characters"] if c["alive"] and c["location"] == n), -n))
        fields = {"destination": number}
    elif "move" in legal:
        kind = "move"
        chars = {c["id"]: c for c in own}

        def move_cost(option: Dict) -> float:
            char = chars[option["character_id"]]
            before, after = danger(char["location"]), danger(option["actual_destination"])
            return (after - before) * char["points"] + after + (3 if option["sprint_card_id"] else 0)

        choice = min(view["move_options"], key=move_cost)
        fields = {k: choice[k] for k in ("character_id", "destination", "sprint_card_id")}
    elif "vote" in legal:
        kind = "vote"
        vote = view["vote"]
        candidates = vote["candidates"]
        if vote["kind"] != "victim":
            target = pid if pid in candidates else candidates[0]
        else:
            opponents = [p for p in candidates if p != pid] or candidates
            scores = {p["player_id"]: p["points"] for p in view["players"]}
            target = max(opponents, key=lambda p: (scores[p], -candidates.index(p)))
        fields = {"target_id": target}
    elif "sacrifice" in legal:
        kind = "sacrifice"
        choice = min((c for c in own if c["id"] in view["victim_options"]), key=lambda c: c["points"])
        fields = {"character_id": choice["id"]}
    elif "next_round" in legal:
        kind = "next_round"
    else:
        kind = "pass"
        hand = {c["id"]: c for c in view["hand"]}
        for option in view["card_options"]:
            card = hand[option["card_id"]]
            target = None
            use = card["kind"] == "camera"
            if view["phase"] == "cards" and view["vote"]["kind"] == "victim":
                loc = locs[view["vote"]["location"]]
                exposed = [c for c in own if c["location"] == loc["id"] and not c["hidden"]]
                use = bool(exposed) and loc["breached"] and card["kind"] in ("weapon1", "weapon2", "hardware", "hide")
                if use and option["character_ids"]:
                    target = max((c for c in own if c["id"] in option["character_ids"]), key=lambda c: c["points"])["id"]
            if use:
                kind = "play_card"
                fields = {"card_id": card["id"], "character_id": target}
                break
    return {"type": kind, "game_token": view["game_token"], "step": view["step"], **fields}
