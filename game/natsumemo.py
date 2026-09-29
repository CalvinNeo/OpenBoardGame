"""Natsumemo: four weeks of plans, private decisions and summer homework."""

import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple

from game.natsumemo_data import CARDS, TITLES, activity_reward, study_card, homework_reward


CONFIG_SCHEMA = {
    "type": "object", "properties": {
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
    }, "additionalProperties": False,
}
_FIELDS = {
    "choose_role": {"role": {"enum": ["boy", "girl"]}},
    "propose": {"day": {"type": "integer", "minimum": 0, "maximum": 6}},
    "respond": {"attend": {"type": "boolean"}},
    "choose_die": {"value": {"type": "integer", "minimum": 1, "maximum": 6}},
    "allocate": {"hearts": {"type": "object", "maxProperties": 5,
                            "additionalProperties": {"type": "integer", "minimum": 0, "maximum": 2}}},
    "next_round": {},
}
ACTION_SCHEMA = {"oneOf": [
    {"type": "object", "properties": {
        "type": {"const": kind}, "game_token": {"type": "string"},
        "step": {"type": "integer", "minimum": 0}, **fields},
     "required": ["type", "game_token", "step", *fields], "additionalProperties": False}
    for kind, fields in _FIELDS.items()
]}


def available_starts(calendar: List, duration: int) -> List[int]:
    return [day for day in range(8 - duration) if all(cell is None for cell in calendar[day:day + duration])]


def _phase(state: Dict, phase: str) -> None:
    state.update(phase=phase, step=state["step"] + 1, ready=[])


def _next_player(state: Dict, pid: str) -> str:
    order = state["turn_order"]
    return order[(order.index(pid) + 1) % len(order)]


def _record(state: Dict, pid: str, card: Dict, day: int, reward: Dict) -> None:
    player = state["players"][pid]
    week = state["week"] - 1
    entry = {"id": f"{state['week']}:{state['event_number']}:{day}", "name": card["name"],
             "emoji": card["emoji"], "kind": card["kind"], "start": day, "duration": card["days"]}
    for offset in range(card["days"]):
        player["calendar"][week][day + offset] = {
            **entry, "points": reward["points"] if offset == card["days"] - 1 else None}
    player["week_scores"][week] += reward["points"]
    player["homework"] = min(30, player["homework"] + reward.get("homework", 0))
    for title in reward.get("titles", []):
        if title not in player["titles"]:
            player["titles"].append(title)


def _hearts(state: Dict, pid: str, recipients: List[str], amount: int) -> None:
    if amount and recipients:
        state["pending_hearts"][pid] = {"amount": amount, "recipients": recipients}


def _review(state: Dict) -> None:
    _phase(state, "allocate" if state["pending_hearts"] else state["review_kind"])


def _study(state: Dict) -> None:
    card = study_card(state["week"])
    state.update(card=card, proposed_day=2, pending_hearts={}, choices={}, event_dice={}, review_kind="week_review")
    attendees = [pid for pid in state["turn_order"] if state["players"][pid]["calendar"][state["week"] - 1][2] is None]
    rows = []
    for pid in state["turn_order"]:
        player = state["players"][pid]
        before = player["week_scores"][state["week"] - 1]
        private = {"study_pages": 0, "rolls": []}
        if pid in attendees:
            reward = activity_reward(card, attendees, pid, state["players"])
            _record(state, pid, card, 2, reward)
            private["study_pages"] = reward["homework"]
            _hearts(state, pid, [other for other in attendees if other != pid], reward["hearts"])
        for day, cell in enumerate(player["calendar"][state["week"] - 1]):
            if cell is not None:
                continue
            roll = random.Random(f"{state['base_seed']}:homework:{state['week']}:{pid}:{day}").randint(1, 6)
            reward = homework_reward(state["week"], roll)
            _record(state, pid, {"kind": "homework", "name": "暑假作业", "emoji": "✏️", "days": 1}, day, reward)
            private["rolls"].append({"day": day, "die": roll, **reward})
        player["study_results"].append(private)
        rows.append({"player_id": pid, "points": player["week_scores"][state["week"] - 1] - before,
                     "week_score": player["week_scores"][state["week"] - 1]})
    state["result"] = {"kind": "study", "week": state["week"], "name": card["name"],
                       "participants": attendees, "rows": rows}
    state["history"].append(copy.deepcopy(state["result"]))
    _review(state)


def _draw_event(state: Dict) -> None:
    if state["event_number"] >= 6:
        _study(state)
        return
    deck = state["decks"][state["week"] - 1]
    for _ in state["turn_order"]:
        calendar = state["players"][state["speaker"]]["calendar"][state["week"] - 1]
        for _ in range(len(deck)):
            card_id = deck.pop(0)
            if available_starts(calendar, CARDS[card_id]["days"]):
                state.update(card=copy.deepcopy(CARDS[card_id]), event_number=state["event_number"] + 1,
                             proposed_day=None, choices={}, event_dice={}, pending_hearts={}, result=None)
                _phase(state, "propose")
                return
            deck.append(card_id)
        state["speaker"] = _next_player(state, state["speaker"])
    # No remaining card fits any player's calendar; no proposal can be made.
    _study(state)


def _settle_event(state: Dict) -> None:
    attendees = [pid for pid in state["turn_order"] if state["choices"][pid]]
    card, rows = state["card"], []
    if card.get("contest") == "roll" and (len(attendees) > 1 or card["mechanic"] == "bugs"):
        state["event_dice"] = {pid: random.Random(
            f"{state['base_seed']}:event:{state['week']}:{state['event_number']}:{pid}").randint(1, 6)
            for pid in attendees}
    rewards = {pid: activity_reward(card, attendees, pid, state["players"], state["event_dice"]) for pid in attendees}
    for pid, reward in rewards.items():
        _record(state, pid, card, state["proposed_day"], reward)
        player = state["players"][pid]
        player["visits"][card["kind"]] = player["visits"].get(card["kind"], 0) + 1
        _hearts(state, pid, [other for other in attendees if other != pid], reward["hearts"])
        rows.append({"player_id": pid, "points": reward["points"], "titles": reward["titles"]})
    state["result"] = {"kind": "event", "week": state["week"], "event_number": state["event_number"],
                       "name": card["name"], "emoji": card["emoji"], "day": state["proposed_day"],
                       "days": card["days"], "participants": attendees, "rows": rows,
                       "dice": dict(state["event_dice"])}
    state["history"].append(copy.deepcopy(state["result"]))
    state["review_kind"] = "event_review"
    _review(state)


def final_scores(state: Dict) -> Tuple[List[Dict], List[Dict]]:
    """Compute scoring without mutating the game. Equal zero allocations tie too."""
    heart_points = {pid: 0 for pid in state["turn_order"]}
    contests = []
    for target in state["turn_order"]:
        amounts = {pid: state["players"][pid]["hearts"][target] for pid in state["turn_order"] if pid != target}
        highest = max(amounts.values())
        winners = [pid for pid, value in amounts.items() if value == highest]
        points = 10 if len(winners) == 1 else 5
        for pid in winners:
            heart_points[pid] += points
        contests.append({"target": target, "amounts": amounts, "winners": winners, "points": points})
    scores = []
    for pid in state["turn_order"]:
        player = state["players"][pid]
        titles = list(player["titles"])
        if player["homework"] == 30 and "prepared" not in titles:
            titles.append("prepared")
        homework = -10 * max(0, 25 - player["homework"]) + 2 * max(0, player["homework"] - 25)
        row = {"player_id": pid, "activities": sum(player["week_scores"]), "homework": homework,
               "titles": len(titles) ** 2, "hearts": heart_points[pid], "title_ids": titles}
        row["total"] = sum(row[key] for key in ("activities", "homework", "titles", "hearts"))
        scores.append(row)
    return sorted(scores, key=lambda row: -row["total"]), contests


class NatsumemoGame:
    game_id = "natsumemo"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 3 <= len(players) <= 6:
            raise ValueError("Natsumemo requires 3 to 6 players")
        cfg = {} if config is None else config
        if not isinstance(cfg, dict) or set(cfg) - {"seed"}:
            raise ValueError("invalid Natsumemo configuration")
        seed = cfg.get("seed", secrets.token_hex(16))
        if not (type(seed) is int or isinstance(seed, str) and 1 <= len(seed) <= 80):
            raise ValueError("invalid seed")
        meta = {player["player_id"]: dict(player) for player in players}
        if len(meta) != len(players):
            raise ValueError("player IDs must be unique")
        order = sorted(meta, key=lambda pid: (meta[pid].get("seat", 0), pid))
        rng = random.Random(seed)
        decks = [[key for key, card in CARDS.items() if card["week"] == week] for week in range(1, 5)]
        for deck in decks:
            rng.shuffle(deck)
        first = rng.choice(order)
        return {
            "version": 1, "game_token": secrets.token_hex(12), "step": 0, "revision": 0,
            "config": copy.deepcopy(cfg), "base_seed": seed, "player_meta": meta, "turn_order": order,
            "players": {pid: {"role": "boy" if i % 2 == 0 else "girl", "role_confirmed": False,
                              "calendar": [[None] * 7 for _ in range(4)], "week_scores": [0] * 4,
                              "homework": 0, "hearts": {other: 0 for other in order if other != pid},
                              "titles": [], "visits": {}, "study_results": []} for i, pid in enumerate(order)},
            "phase": "setup", "week": 1, "event_number": 0, "first_speaker": first, "speaker": first,
            "decks": decks, "card": None, "proposed_day": None, "choices": {}, "event_dice": {}, "pending_hearts": {},
            "ready": [], "result": None, "history": [], "game_over": False, "winner_ids": [],
            "scores": [], "heart_contests": [], "review_kind": None,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        phase = state["phase"]
        if phase == "setup":
            return [] if state["players"][player_id]["role_confirmed"] else ["choose_role"]
        if phase == "propose":
            return ["propose"] if player_id == state["speaker"] else []
        if phase == "respond":
            return [] if player_id in state["choices"] else ["respond"]
        if phase == "contest":
            return ["choose_die"] if state["choices"].get(player_id) and player_id not in state["event_dice"] else []
        if phase == "allocate":
            return ["allocate"] if player_id in state["pending_hearts"] else []
        if phase in ("event_review", "week_review"):
            return [] if player_id in state["ready"] else ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state["players"] or not isinstance(action, dict):
            return [], "invalid player or action"
        kind = action.get("type")
        if not isinstance(kind, str) or kind not in _FIELDS or set(action) != {"type", "game_token", "step", *_FIELDS[kind]}:
            return [], "invalid action fields"
        if action["game_token"] != state["game_token"] or type(action["step"]) is not int or action["step"] != state["step"]:
            return [], "stale action; refresh the game state"
        if kind not in NatsumemoGame.get_legal_actions(state, player_id):
            return [], "action not available"
        player = state["players"][player_id]
        if kind == "choose_role":
            role = action["role"]
            if role not in ("boy", "girl"):
                return [], "invalid role"
            count = sum(p["role_confirmed"] and p["role"] == role for p in state["players"].values())
            if count >= (len(state["players"]) + 1) // 2:
                return [], "choose the other role to keep the group balanced"
        elif kind == "propose":
            if type(action["day"]) is not int or action["day"] not in available_starts(player["calendar"][state["week"] - 1], state["card"]["days"]):
                return [], "event must fit consecutive free days in this week"
        elif kind == "respond":
            if type(action["attend"]) is not bool:
                return [], "attend must be a boolean"
        elif kind == "choose_die":
            if type(action["value"]) is not int or not 1 <= action["value"] <= 6:
                return [], "choose a die value from 1 to 6"
        elif kind == "allocate":
            allocation, pending = action["hearts"], state["pending_hearts"][player_id]
            if not isinstance(allocation, dict) or any(
                    target not in pending["recipients"] or type(amount) is not int or not 0 <= amount <= pending["amount"]
                    for target, amount in allocation.items()) or sum(allocation.values()) != pending["amount"]:
                return [], "allocate all hearts to other participants in this activity"

        # Everything above is validation. Rejected actions must be atomic.
        state["revision"] += 1
        if kind == "choose_role":
            player.update(role=action["role"], role_confirmed=True)
            if all(p["role_confirmed"] for p in state["players"].values()):
                _draw_event(state)
        elif kind == "propose":
            state["proposed_day"] = action["day"]
            state["choices"] = {pid: False for pid in state["turn_order"] if action["day"] not in
                                available_starts(state["players"][pid]["calendar"][state["week"] - 1], state["card"]["days"])}
            _phase(state, "respond")
        elif kind == "respond":
            state["choices"][player_id] = action["attend"]
            if len(state["choices"]) == len(state["players"]):
                if state["card"].get("contest") == "choose" and sum(state["choices"].values()) > 1:
                    _phase(state, "contest")
                else:
                    _settle_event(state)
        elif kind == "choose_die":
            state["event_dice"][player_id] = action["value"]
            if len(state["event_dice"]) == sum(state["choices"].values()):
                _settle_event(state)
        elif kind == "allocate":
            for target, amount in action["hearts"].items():
                player["hearts"][target] += amount
            del state["pending_hearts"][player_id]
            if not state["pending_hearts"]:
                _phase(state, state["review_kind"])
        elif kind == "next_round":
            state["ready"].append(player_id)
            if len(state["ready"]) == len(state["players"]):
                if state["phase"] == "event_review":
                    state["speaker"] = _next_player(state, state["speaker"])
                    _draw_event(state)
                elif state["week"] < 4:
                    state["first_speaker"] = _next_player(state, state["first_speaker"])
                    state.update(week=state["week"] + 1, event_number=0, speaker=state["first_speaker"])
                    _draw_event(state)
                else:
                    state["scores"], state["heart_contests"] = final_scores(state)
                    for row in state["scores"]:
                        state["players"][row["player_id"]]["titles"] = row["title_ids"]
                    maximum = state["scores"][0]["total"]
                    state["winner_ids"] = [row["player_id"] for row in state["scores"] if row["total"] == maximum]
                    state["game_over"] = True
                    _phase(state, "game_over")
        # Neither simultaneous decisions nor private allocations enter event logs.
        return [{"type": "natsumemo:updated", "payload": {"phase": state["phase"]}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = state["players"].get(viewer_id)
        legal = NatsumemoGame.get_legal_actions(state, viewer_id)
        players = []
        for pid in state["turn_order"]:
            player, meta = state["players"][pid], state["player_meta"][pid]
            public = {"player_id": pid, "name": meta.get("name", pid), "is_bot": bool(meta.get("is_bot")),
                      **{key: player[key] for key in ("role", "role_confirmed", "calendar", "week_scores", "titles", "visits")}}
            if state["game_over"]:
                public.update(homework=player["homework"], hearts=player["hearts"])
            players.append(public)
        capacity = (len(players) + 1) // 2
        role_choices = [role for role in ("boy", "girl") if sum(p["role_confirmed"] and p["role"] == role for p in players) < capacity]
        return copy.deepcopy({
            "game_id": "natsumemo", "you": viewer_id, "players": players, "titles": TITLES,
            **{key: state[key] for key in ("game_token", "step", "revision", "phase", "week", "event_number",
                                           "speaker", "first_speaker", "card", "proposed_day", "ready", "result",
                                           "history", "game_over", "winner_ids", "scores", "heart_contests", "review_kind")},
            "legal_actions": legal, "role_choices": role_choices,
            "legal_days": available_starts(own["calendar"][state["week"] - 1], state["card"]["days"])
                          if own and state["card"] else [],
            "submitted": list(state["choices"]) if state["phase"] == "respond" else [],
            "contest_players": [pid for pid in state["turn_order"] if state["choices"].get(pid)] if state["phase"] == "contest" else [],
            "dice_submitted": list(state["event_dice"]) if state["phase"] == "contest" else [],
            "allocation_pending": list(state["pending_hearts"]),
            "private": {"homework": own["homework"], "hearts": own["hearts"], "study_results": own["study_results"],
                        "choice": state["choices"].get(viewer_id), "die": state["event_dice"].get(viewer_id),
                        "pending": state["pending_hearts"].get(viewer_id)} if own else None,
        })

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.natsumemo_ai import choose_action

        action = choose_action(NatsumemoGame.get_public_view(state, bot_id))
        return {**action, "delay_ms": 350} if action else None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
