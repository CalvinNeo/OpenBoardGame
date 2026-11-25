"""Take Time: simultaneous discussion, private hands and cooperative resolution."""

import copy
import random
import secrets
from collections import Counter
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

from game.take_time_data import (
    ACTION_SCHEMA, CLOCK_BY_ID, CLOCK_IDS, CLOCKS, CONFIG_SCHEMA, clock_route, segment_rule_labels,
)

_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _clock(state: Dict) -> Dict:
    clock = copy.deepcopy(CLOCK_BY_ID[state["clock_id"]])
    rotation = state.get("rotation", 0)
    clock["segments"] = [clock["segments"][(index - rotation) % 6] for index in range(6)]
    for index, boundary in clock.get("boundaries", {}).items():
        clock["segments"][(int(index) + rotation) % 6]["boundary"] = boundary
    return clock


def _log(state: Dict, message: str) -> None:
    state["log"].append(message)
    state["log"] = state["log"][-60:]


def _deal(state: Dict) -> None:
    state.pop("pending_clock", None)
    state["deal_number"] += 1
    rng = random.Random(f"{state['seed']}:{state['deal_number']}")
    # IDs are independent random nonces, never suit/value encodings or sorted ranks.
    deck = [{"id": f"c{rng.getrandbits(128):032x}", "color": color, "value": value}
            for color in ("solar", "lunar") for value in range(1, 13)]
    rng.shuffle(deck)
    state["deck"] = deck[12:]
    count = len(state["turn_order"])
    size = 12 // count
    state["players"] = {}
    for index, pid in enumerate(state["turn_order"]):
        cards = deck[index * size:(index + 1) * size]
        state["players"][pid] = {"hand": cards[:4], "reserve": cards[4:], "ready": False}
    state.update({
        "phase": "discussion", "current_turn": None, "board": [[] for _ in range(6)],
        "placed_count": 0, "face_up_used": 0, "hand_segment": 0,
        "targets": [4, 8, 12, 16, 20, 24], "result": None,
        "next_ready": [], "next_choice": None,
        "attempt_bonus": state["bonus"],
        "rotation": 0, "second_hand": CLOCK_BY_ID[state["clock_id"]].get("second_hand"),
    })
    if _clock(state)["metric"] == "difference":
        state["targets"] = [0, 1, 2, 4, 6, 8]
    _log(state, f"🕰️ {_clock(state)['name']} · Attempt {state['attempt']} · Discuss before looking.")


def _face_up_limit(state: Dict) -> int:
    return 0 if _clock(state)["no_face_up"] else len(state["turn_order"]) + state["attempt_bonus"]


def _choices(state: Dict) -> List[str]:
    if state["phase"] != "round_end":
        return []
    return ["advance", "finish"] if state["result"]["success"] else ["retry", "skip", "finish"]


def _legal_cards(view: Dict) -> List[Dict]:
    own = next((player for player in view["players"] if player["player_id"] == view["you"]), None)
    if not own:
        return []
    cards = [card for card in own["hand"] if card.get("value") is not None]
    mode = view["clock"]["play_order"]
    if mode == "leftmost":
        return cards[:1]
    if cards and mode in ("highest", "lowest"):
        extreme = (max if mode == "highest" else min)(card["value"] for card in cards)
        cards = [card for card in cards if card["value"] == extreme]
    return cards


def _legal_segments(state: Dict) -> List[int]:
    clock = _clock(state)
    required = clock["required_plays"].get(str(state["placed_count"] + 1))
    remaining = sum(len(player["hand"]) + len(player["reserve"]) for player in state["players"].values())
    segments = []
    for index, rule in enumerate(clock["segments"]):
        if rule.get("blocked") or (required is not None and required != index):
            continue
        second_hand = state.get("second_hand")
        if second_hand is not None and index in (second_hand, (second_hand + 3) % 6):
            continue
        final = remaining == 1 and not (rule.get("draw") and state.get("deck"))
        last = clock["required_plays"].get("last")
        if final and last is not None and last != index:
            continue
        segments.append(index)
    return segments


def _evaluate(state: Dict) -> Dict:
    clock = _clock(state)
    board = state["board"]
    sums = [sum(card["value"] for card in cards) for cards in board]
    values = sums if clock["metric"] == "sum" else [
        max(card["value"] for card in cards) - min(card["value"] for card in cards) if cards else 0
        for cards in board
    ]
    possible_starts = [start for start in range(6)
                       if all(values[(start + i) % 6] <= values[(start + i + 1) % 6] for i in range(5))]
    start = state["hand_segment"]
    if clock["movable_hand"] and start not in possible_starts and possible_starts:
        start = possible_starts[0]
    all_values = [card["value"] for cards in board for card in cards]
    low_segments = [index for index, rule in enumerate(clock["segments"]) if rule.get("extreme") == "lowest"]
    segments = []
    for index, cards in enumerate(board):
        rule = clock["segments"][index]
        checks = [{"label": "至少一张牌", "passed": bool(cards)}]
        if clock["cap"] is not None:
            checks.append({"label": f"总和 ≤ {clock['cap']}", "passed": sums[index] <= clock["cap"]})
        if index != start:
            previous = (index - 1) % 6
            checks.append({"label": f"{'差值' if clock['metric'] == 'difference' else '总和'} ≥ 时段 {previous + 1}",
                           "passed": values[index] >= values[previous]})
        predicates = []
        if "colors" in rule:
            predicates.append(Counter(card["color"] for card in cards) == Counter(rule["colors"]))
        if "count" in rule:
            predicates.append(len(cards) == rule["count"])
        if "range" in rule:
            predicates.append(rule["range"][0] <= sums[index] <= rule["range"][1])
        if "closest" in rule:
            distance = abs(sums[index] - rule["closest"])
            predicates.append(all(distance <= abs(total - rule["closest"]) for total in sums))
        if "extreme" in rule:
            if rule["extreme"] == "lowest" and len(low_segments) > 1:
                minima = [min((card["value"] for card in board[segment]), default=13) for segment in low_segments]
                remaining = []
                for segment, pile in enumerate(board):
                    values_in_pile = sorted(card["value"] for card in pile)
                    remaining.extend(values_in_pile[1:] if segment in low_segments else values_in_pile)
                predicates.append(all(board[segment] for segment in low_segments)
                                  and max(minima) <= min(remaining, default=13))
            else:
                extreme = (min if rule["extreme"] == "lowest" else max)(all_values, default=0)
                predicates.append(any(card["value"] == extreme for card in cards))
        if "forbidden" in rule:
            predicates.append(not any(card["value"] in rule["forbidden"] for card in cards))
        if "suit_extreme" in rule:
            modes = ("solar_lowest", "lunar_highest") if rule["suit_extreme"] == "both" else (rule["suit_extreme"],)
            passed = True
            for mode in modes:
                color, extreme_mode = mode.split("_")
                candidates = [card["value"] for pile in board for card in pile if card["color"] == color]
                extreme = (min if extreme_mode == "lowest" else max)(candidates, default=0)
                passed = passed and any(card["color"] == color and card["value"] == extreme for card in cards)
            predicates.append(passed)
        resolution_rule = {key: value for key, value in rule.items()
                           if key not in ("draw", "rotate", "blocked", "boundary")}
        checks.extend({"label": label, "passed": passed}
                      for label, passed in zip(segment_rule_labels(resolution_rule), predicates))
        boundary = rule.get("boundary")
        if boundary:
            difference = abs(sums[index] - sums[(index - 1) % 6])
            checks.append({"label": segment_rule_labels({"boundary": boundary})[0],
                           "passed": difference == 0 if boundary.get("equal") else difference >= boundary["gap"]})
        if "spread" in clock:
            checks.append({"label": f"全盘总和极差 ≤ {clock['spread']}",
                           "passed": max(sums) - min(sums) <= clock["spread"]})
        if "first_hand" in clock and index != clock["first_hand"]:
            previous = (index - 1) % 6
            checks.append({"label": f"首张牌 ≥ 时段 {previous + 1} 首张牌",
                           "passed": bool(cards and board[previous]) and cards[0]["value"] >= board[previous][0]["value"]})
        segments.append({"index": index, "sum": sums[index], "value": values[index],
                         "checks": checks, "passed": all(check["passed"] for check in checks)})
    return {"success": all(segment["passed"] for segment in segments), "segments": segments,
            "hand_segment": start, "planned_hand": state["hand_segment"],
            "clock_id": state["clock_id"], "attempt": state["attempt"]}


def _resolve(state: Dict) -> None:
    state["result"] = _evaluate(state)
    state["phase"] = "round_end"
    state["current_turn"] = None
    success = state["result"]["success"]
    if success:
        if state["clock_id"] not in state["completed"]:
            state["completed"].append(state["clock_id"])
        state["regrets"] = [cid for cid in state["regrets"] if cid != state["clock_id"]]
    else:
        state["bonus"] = min(3, state["bonus"] + 1)
    state["next_choice"] = "advance" if success else "retry"
    state["history"].append({"clock_id": state["clock_id"], "success": success, "attempt": state["attempt"]})
    state["history"] = state["history"][-100:]
    _log(state, "✅ Test passed. Review together." if success else "🔎 Test not passed. Review together; retry earns an extra face-up card (maximum +3).")


def _continue(state: Dict) -> None:
    choice = state["next_choice"]
    if choice == "select_clock":
        _select_clock(state, state.pop("pending_clock"))
        return
    if choice == "finish":
        state["phase"] = "game_over"
        state["game_over"] = True
        return
    if choice == "retry":
        state["attempt"] += 1
    else:
        if choice == "skip":
            if state["clock_id"] in state["regrets"]:
                state["regrets"].remove(state["clock_id"])
            state["regrets"].append(state["clock_id"])
        state["bonus"] = 0
        state["attempt"] = 1
        if state["queue"]:
            state["clock_id"] = state["queue"].pop(0)
        elif state["regrets"]:
            state["clock_id"] = state["regrets"][0]
        else:
            state["phase"] = "game_over"
            state["game_over"] = True
            return
    _deal(state)


def _select_clock(state: Dict, clock_id: str) -> None:
    itinerary = clock_route(clock_id)
    state.update({"clock_id": clock_id, "itinerary": itinerary, "queue": itinerary[1:],
                  "attempt": 1, "bonus": 0, "completed": [], "regrets": []})
    _deal(state)


class TakeTimeGame:
    game_id = "take_time"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not isinstance(config, dict) or not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("invalid Take Time configuration")
        if not 2 <= len(players) <= 4:
            raise ValueError("Take Time needs 2–4 players")
        ids = [player.get("player_id") for player in players]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique nonempty strings")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        first = config.get("start_clock", CLOCK_IDS[0])
        itinerary = clock_route(first)
        state = {
            "game_id": TakeTimeGame.game_id, "config": copy.deepcopy(config),
            "seed": config.get("seed", secrets.token_hex(16)), "deal_number": 0,
            "turn_order": [player["player_id"] for player in ordered],
            "player_meta": {player["player_id"]: {
                "name": player.get("name", player["player_id"]), "seat": player.get("seat", 0),
                "is_bot": bool(player.get("is_bot", False)),
            } for player in ordered},
            "clock_id": first, "itinerary": itinerary, "queue": itinerary[1:],
            "attempt": 1, "bonus": 0, "completed": [], "regrets": [],
            "history": [], "log": [], "game_over": False,
        }
        _deal(state)
        if "start_clock" not in config:
            state["phase"] = "setup"
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] == "setup":
            return ["select_clock"]
        if state["phase"] == "discussion":
            actions = [] if state["players"][player_id]["ready"] else ["ready"]
            if not any(player["ready"] for player in state["players"].values()):
                actions.extend(["set_plan", "select_clock"])
                if _clock(state)["movable_hand"]:
                    actions.append("set_hand")
            return actions
        if state["phase"] == "placement":
            return ["place"] if state["current_turn"] in (None, player_id) else []
        if state["phase"] == "round_end":
            return [] if player_id in state["next_ready"] else ["choose_next", "next_round", "select_clock"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "invalid Take Time action"
        kind = action["type"]
        if kind not in TakeTimeGame.get_legal_actions(state, player_id):
            return [], "action is not available to this player now"
        clock = _clock(state)
        # Complete every validation before any mutation, including direct calls that
        # bypass the room schema validator.
        if kind == "place":
            card = next((card for card in state["players"][player_id]["hand"]
                         if card["id"] == action["card_id"]), None)
            if card is None:
                return [], "select a card from your own hand"
            if action["face_up"] and state["face_up_used"] >= _face_up_limit(state):
                return [], "no face-up cards remaining"
            if action["segment"] not in _legal_segments(state):
                return [], "this segment is not available for this placement"
            mode = clock["play_order"]
            if mode == "leftmost" and card["id"] != state["players"][player_id]["hand"][0]["id"]:
                return [], "play your leftmost card"
            if mode in ("highest", "lowest"):
                extreme = (max if mode == "highest" else min)(
                    item["value"] for item in state["players"][player_id]["hand"])
                if card["value"] != extreme:
                    return [], f"play your {mode} card"
        if kind == "choose_next" and action["choice"] not in _choices(state):
            return [], "this continuation is not available"

        if kind == "select_clock":
            if state["phase"] == "round_end":
                state["pending_clock"] = action["clock_id"]
                state["next_choice"] = "select_clock"
                state["next_ready"] = []
            else:
                _select_clock(state, action["clock_id"])
        elif kind == "ready":
            state["players"][player_id]["ready"] = True
            if all(player["ready"] for player in state["players"].values()):
                state["phase"] = "placement"
                _log(state, "🤫 Silence begins. Anyone may place the first card.")
        elif kind == "set_plan":
            state["targets"][action["segment"]] = action["target"]
        elif kind == "set_hand":
            state["hand_segment"] = action["segment"]
        elif kind == "place":
            state["players"][player_id]["hand"].remove(card)
            state["placed_count"] += 1
            state["face_up_used"] += int(action["face_up"])
            state["board"][action["segment"]].append({
                **card, "owner": player_id, "face_up": action["face_up"], "order": state["placed_count"],
            })
            color = "☀️" if card["color"] == "solar" else "🌙"
            value = f" {card['value']}" if action["face_up"] else " face down"
            name = state["player_meta"][player_id]["name"]
            _log(state, f"{state['placed_count']}. {name} → {action['segment'] + 1}: {color}{value}")
            if len(state["turn_order"]) == 2 and state["placed_count"] == 4:
                for player in state["players"].values():
                    player["hand"].extend(player["reserve"])
                    player["reserve"] = []
                _log(state, "✉️ Both players picked up their two reserve cards.")
            rule = clock["segments"][action["segment"]]
            if rule.get("draw") and state.get("deck"):
                state["players"][player_id]["hand"].append(state["deck"].pop(0))
                _log(state, f"📥 {name} drew a card.")
            if "rotate" in rule:
                state["rotation"] = (state.get("rotation", 0) + rule["rotate"]) % 6
                if not clock["movable_hand"]:
                    state["hand_segment"] = (state["hand_segment"] + rule["rotate"]) % 6
                _log(state, "↻ Clock rotated clockwise." if rule["rotate"] == 1 else "↺ Clock rotated counterclockwise.")
            if state.get("second_hand") is not None:
                state["second_hand"] = (state["second_hand"] + 1) % 6
            if not any(player["hand"] or player["reserve"] for player in state["players"].values()):
                _resolve(state)
            else:
                turn_index = state["turn_order"].index(player_id)
                following = state["turn_order"][turn_index + 1:] + state["turn_order"][:turn_index + 1]
                state["current_turn"] = next(
                    candidate for candidate in following if state["players"][candidate]["hand"])
        elif kind == "choose_next":
            if state["next_choice"] != action["choice"]:
                state["next_choice"] = action["choice"]
                state["next_ready"] = []
                state.pop("pending_clock", None)
        elif kind == "next_round":
            state["next_ready"].append(player_id)
            if len(state["next_ready"]) == len(state["turn_order"]):
                _continue(state)
        return [{"type": "take_time:update", "payload": {"actor": player_id, "action": kind}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        review = state["phase"] in ("round_end", "game_over")

        def card_view(card: Dict, visible: bool) -> Dict:
            public = {key: card[key] for key in ("id", "color", "owner", "face_up", "order") if key in card}
            public["value"] = card["value"] if visible else None
            return public

        players = []
        for pid in state["turn_order"]:
            player = state["players"][pid]
            visible = pid == viewer_id and player["ready"]
            players.append({"player_id": pid, **state["player_meta"][pid], "ready": player["ready"],
                            "hand": [card_view(card, visible) for card in player["hand"]],
                            "reserve": [card_view(card, False) for card in player["reserve"]],
                            "next_ready": pid in state["next_ready"]})
        clock = copy.deepcopy(_clock(state))
        for index, rule in enumerate(clock["segments"]):
            rule["labels"] = segment_rule_labels(rule)
            for order, segment in clock["required_plays"].items():
                if segment == index:
                    rule["labels"].append("最后一张必须放这里" if order == "last" else f"第 {order} 张必须放这里")
        view = {
            "game_id": TakeTimeGame.game_id, "you": viewer_id, "phase": state["phase"],
            "clock": clock, "players": players, "current_turn": state["current_turn"],
            "hand_segment": state["hand_segment"], "targets": list(state["targets"]),
            "board": [[card_view(card, review or card["face_up"] or card["owner"] == viewer_id)
                       for card in cards] for cards in state["board"]],
            "placed_count": state["placed_count"], "face_up_used": state["face_up_used"],
            # During review the earned bonus belongs to the next attempt.
            "face_up_limit": _face_up_limit(state),
            "bonus": state["bonus"], "attempt": state["attempt"],
            "result": copy.deepcopy(state["result"]) if review else None,
            "next_choice": state["next_choice"], "next_choices": _choices(state),
            "pending_clock": state.get("pending_clock"), "second_hand": state.get("second_hand"),
            "rotation": state.get("rotation", 0), "deck_count": len(state.get("deck", [])),
            "next_ready": list(state["next_ready"]), "legal_actions": TakeTimeGame.get_legal_actions(state, viewer_id),
            "completed": list(state["completed"]), "regrets": list(state["regrets"]),
            "itinerary": list(state["itinerary"]),
            "catalog": [{key: item[key] for key in ("id", "name", "source", "chapter", "chapter_name", "number") if key in item}
                        for item in CLOCKS],
            "log": list(state["log"]), "game_over": state["game_over"],
            "journey_complete": all(cid in state["completed"] for cid in state["itinerary"]),
        }
        view["legal_card_ids"] = [card["id"] for card in _legal_cards(view)] if "place" in view["legal_actions"] else []
        view["legal_segments"] = _legal_segments(state) if "place" in view["legal_actions"] else []
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        # The decision helper gets the SAME redacted view as a human client.
        return _bot_from_view(TakeTimeGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


def _bot_from_view(view: Dict) -> Optional[Dict]:
    actions = view["legal_actions"]
    if "ready" in actions:
        # Leave the discussion plan editable until the humans choose to look.
        if any(not player["is_bot"] and not player["ready"] for player in view["players"]):
            return None
        return {"type": "ready"}
    if "next_round" in actions:
        return {"type": "next_round"}
    if "place" not in actions:
        return None
    clock = view["clock"]
    candidates = []
    for card in _legal_cards(view):
        for index in view["legal_segments"]:
            existing = view["board"][index]
            rule = clock["segments"][index]
            target = view["targets"][(index - view["hand_segment"]) % 6]
            known = sum(item["value"] if item["value"] is not None else 6.5 for item in existing)
            score = abs(known + card["value"] - target)
            if not existing:
                score -= 4
            expected_count = rule.get("count", len(rule["colors"]) if "colors" in rule else 2)
            if len(existing) >= expected_count:
                score += 35
            if "colors" in rule:
                available = Counter(rule["colors"]) - Counter(item["color"] for item in existing)
                if not available[card["color"]]:
                    score += 60
            if "range" in rule:
                low, high = rule["range"]
                score += max(0, known + card["value"] - high) * 8
                score += max(0, low - known - card["value"])
            if clock["cap"] is not None:
                score += max(0, known + card["value"] - clock["cap"]) * 10
            if clock["metric"] == "difference" and len(existing) == 1:
                old = existing[0]["value"] if existing[0]["value"] is not None else 6.5
                score = abs(abs(old - card["value"]) - target)
            empty = sum(not pile for pile in view["board"])
            remaining = sum(len(player["hand"]) + len(player["reserve"]) for player in view["players"])
            if existing and remaining <= empty:
                score += 1000
            candidates.append((score, card["value"], index, card["id"]))
    if not candidates:
        return None
    _, _, index, card_id = min(candidates)
    # Use the public quota; never infer teammates' hidden values to choose a reveal.
    available = view["face_up_limit"] - view["face_up_used"]
    reveal = available > 0 and (not view["board"][index] or 12 - view["placed_count"] <= available)
    return {"type": "place", "card_id": card_id, "segment": index, "face_up": reveal}
