"""A practice opponent that only receives its own public view."""

from typing import Dict, Optional
import random

from game.natsumemo_data import activity_reward


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view["legal_actions"]
    if not legal:
        return None
    kind = legal[0]
    action = {"type": kind, "game_token": view["game_token"], "step": view["step"]}
    players = {p["player_id"]: p for p in view["players"]}
    own = players[view["you"]]
    if kind == "choose_role":
        action["role"] = own["role"] if own["role"] in view["role_choices"] else view["role_choices"][0]
    elif kind in ("propose", "respond"):
        card = view["card"]

        def value(day: int) -> float:
            attendees = [pid for pid, p in players.items() if all(cell is None for cell in
                         p["calendar"][view["week"] - 1][day:day + card["days"]])]
            reward = activity_reward(card, attendees, view["you"], players)
            missing = max(0, 25 - view["private"]["homework"])
            weeks_left = 5 - view["week"]
            weekly_goal = (missing + weeks_left - 1) // weeks_left
            free = sum(cell is None for cell in own["calendar"][view["week"] - 1])
            pages_per_day = 13 / 6 if view["week"] == 4 else 11 / 6
            expected_pages = (free - card["days"]) * pages_per_day + reward["homework"]
            # Reserve enough study time each week instead of accepting a late penalty.
            pressure = 10 if expected_pages < weekly_goal else 1
            fun = reward["points"] + 2 * reward["hearts"] + 3 * len(set(reward["titles"]) - set(own["titles"]))
            return (fun / card["days"] + pressure * (reward["homework"] / card["days"] - pages_per_day)
                    - (2 if day <= 2 < day + card["days"] else 0))

        if kind == "propose":
            action["day"] = max(view["legal_days"], key=value)
        else:
            action["attend"] = value(view["proposed_day"]) >= 0
    elif kind == "allocate":
        pending = view["private"]["pending"]
        # Keep building an existing friendship, without reading others' hearts.
        target = max(pending["recipients"], key=lambda pid: view["private"]["hearts"].get(pid, 0))
        action["hearts"] = {target: pending["amount"]}
    elif kind == "choose_die":
        action["value"] = random.Random(f"{view['game_token']}:{view['step']}:{view['you']}").randint(1, 6)
    return action
