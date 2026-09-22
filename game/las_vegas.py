"""Las Vegas (2012): four rounds of dice placement and casino payouts."""

import copy
import random
from collections import Counter
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


TOTAL_ROUNDS = 4
NEUTRAL_ID = "__neutral__"
BANKNOTES = tuple(
    amount for amount, count in (
        (10000, 6), (20000, 8), (30000, 8), (40000, 6), (50000, 6),
        (60000, 5), (70000, 5), (80000, 5), (90000, 5),
    ) for _ in range(count)
)
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {"neutral_dice": {"type": "boolean", "default": False}},
    "additionalProperties": False,
}


def _action_schema(action_type: str, fields: Dict) -> Dict:
    properties = {"type": {"const": action_type},
                  "round": {"type": "integer", "minimum": 1}}
    properties.update(fields)
    return {"type": "object", "properties": properties,
            "required": list(properties), "additionalProperties": False}


ACTION_SCHEMA = {"oneOf": [
    _action_schema("roll", {"turn": {"type": "integer", "minimum": 1}}),
    _action_schema("place", {"turn": {"type": "integer", "minimum": 1},
                             "face": {"type": "integer", "minimum": 1, "maximum": 6}}),
    _action_schema("next_round", {}),
]}
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)


def _name(state: Dict, player_id: str) -> str:
    if player_id == NEUTRAL_ID:
        return "白骰 (⚪)"
    return state["player_meta"][player_id].get("name") or player_id


def _log(state: Dict, text: str) -> None:
    state["log"].append({"round": state["round"], "text": text})


def _casino_result(casino: Dict) -> Dict:
    """Compute the public payout preview, including every positive-count tie."""
    participants = [(pid, count) for pid, count in casino["dice"].items() if count > 0]
    if casino["neutral_dice"]:
        participants.append((NEUTRAL_ID, casino["neutral_dice"]))
    frequencies = Counter(count for _, count in participants)
    tied = [pid for pid, count in participants if frequencies[count] > 1]
    eligible = sorted(((pid, count) for pid, count in participants
                       if frequencies[count] == 1), key=lambda item: item[1], reverse=True)
    notes = sorted(casino["banknotes"], reverse=True)
    payouts = [{"player_id": pid, "amount": amount, "dice": count}
               for (pid, count), amount in zip(eligible, notes)]
    returned = [amount for index, amount in enumerate(notes)
                if index >= len(payouts) or payouts[index]["player_id"] == NEUTRAL_ID]
    return {"face": casino["face"], "banknotes": notes,
            "dice": copy.deepcopy(casino["dice"]), "neutral_dice": casino["neutral_dice"],
            "tied_players": tied, "payouts": payouts, "returned": returned}


def _start_round(state: Dict) -> None:
    count = len(state["turn_order"])
    neutral = state["config"]["neutral_dice"]
    neutral_per_player = (4 if count == 2 else 2) if neutral else 0
    for player in state["players"].values():
        player.update(remaining=8, neutral_remaining=neutral_per_player)
    casinos = []
    for face in range(1, 7):
        notes = []
        while sum(notes) < 50000:
            notes.append(state["banknote_deck"].pop(0))
        casinos.append({"face": face, "banknotes": sorted(notes, reverse=True),
                        "dice": {pid: 0 for pid in state["turn_order"]}, "neutral_dice": 0})
    if neutral and count == 3:
        for _ in range(2):
            casinos[random.randint(1, 6) - 1]["neutral_dice"] += 1
    state.update(phase="roll", current_turn=state["start_player"], casinos=casinos,
                 roll={"own": [], "neutral": []}, next_ready=[], round_summary=None)
    _log(state, f"第 {state['round']} / {TOTAL_ROUNDS} 轮开始，"
                f"{_name(state, state['start_player'])} 先掷骰 (🎲)。")


def _settle_round(state: Dict) -> None:
    results = [_casino_result(casino) for casino in state["casinos"]]
    earnings = {pid: [] for pid in state["turn_order"]}
    neutral_returned = 0
    for result in results:
        face = result["face"]
        if result["tied_players"]:
            names = "、".join(_name(state, pid) for pid in result["tied_players"])
            _log(state, f"赌场 (🎰 {face})：{names} 因骰子数量相同被取消资格。")
        for payout in result["payouts"]:
            pid, amount = payout["player_id"], payout["amount"]
            if pid == NEUTRAL_ID:
                neutral_returned += amount
                _log(state, f"赌场 (🎰 {face})：白骰 (⚪) 的奖金 (💵 ${amount:,}) 回到牌库底。")
            else:
                state["players"][pid]["banknotes"].append(amount)
                earnings[pid].append(amount)
                _log(state, f"赌场 (🎰 {face})：{_name(state, pid)} 获得奖金 (💵 ${amount:,})。")
        # Resolve casinos in numerical order; returned notes retain descending value order.
        state["banknote_deck"].extend(result["returned"])
    state.update(
        phase="round_end", current_turn=None, roll={"own": [], "neutral": []}, next_ready=[],
        round_summary={
            "round": state["round"], "casinos": results,
            "earnings": [{"player_id": pid, "amount": sum(earnings[pid]),
                          "banknotes": earnings[pid]} for pid in state["turn_order"]],
            "neutral_returned": neutral_returned,
        },
    )
    # Casinos remain display snapshots until everyone has reviewed the settlement.
    _log(state, f"第 {state['round']} 轮结算完成，等待所有玩家确认。")


def _finish_game(state: Dict) -> None:
    results = [{"player_id": pid, "total": sum(state["players"][pid]["banknotes"]),
                "banknote_count": len(state["players"][pid]["banknotes"])}
               for pid in state["turn_order"]]
    results.sort(key=lambda row: (row["total"], row["banknote_count"]), reverse=True)
    previous, rank = None, 0
    for index, row in enumerate(results, 1):
        score = (row["total"], row["banknote_count"])
        if score != previous:
            rank = index
        row["rank"] = rank
        previous = score
    winners = [row["player_id"] for row in results if row["rank"] == 1]
    state.update(phase="game_over", current_turn=None, game_over=True,
                 winner=winners, final_results=results)
    names = "、".join(_name(state, pid) for pid in winners)
    _log(state, f"游戏结束，{names} 获胜！")


def _continue_game(state: Dict) -> None:
    if state["round"] == TOTAL_ROUNDS:
        _finish_game(state)
        return
    order = state["turn_order"]
    state["start_player"] = order[(order.index(state["start_player"]) + 1) % len(order)]
    state["round"] += 1
    _start_round(state)


def _advance_turn(state: Dict, actor: str) -> None:
    state["turn"] += 1
    state["roll"] = {"own": [], "neutral": []}
    order = state["turn_order"]
    index = order.index(actor)
    for offset in range(1, len(order) + 1):
        candidate = order[(index + offset) % len(order)]
        player = state["players"][candidate]
        if player["remaining"] + player["neutral_remaining"]:
            state.update(phase="roll", current_turn=candidate)
            return
    _settle_round(state)


class LasVegasGame:
    game_id = "las_vegas"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("invalid Las Vegas configuration")
        if not isinstance(players, list) or not 2 <= len(players) <= 5:
            raise ValueError("Las Vegas requires 2–5 players")
        if any(not isinstance(player, dict) or not isinstance(player.get("player_id"), str)
               or not player["player_id"] or player["player_id"] == NEUTRAL_ID
               for player in players):
            raise ValueError("player IDs must be unique nonempty strings and not __neutral__")
        if any(type(player.get("seat", 0)) is not int for player in players):
            raise ValueError("player seats must be integers")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique nonempty strings")
        neutral = config.get("neutral_dice", False)
        if neutral and len(ids) == 5:
            raise ValueError("neutral dice require 2–4 players")
        deck = list(BANKNOTES)
        random.shuffle(deck)
        state = {
            "game_id": LasVegasGame.game_id, "version": 1, "config": {"neutral_dice": neutral},
            "players": {pid: {"remaining": 0, "neutral_remaining": 0, "banknotes": []}
                        for pid in ids},
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in ordered},
            "turn_order": ids, "banknote_deck": deck, "round": 1, "turn": 1,
            "start_player": random.choice(ids), "current_turn": None,
            "roll": {"own": [], "neutral": []}, "casinos": [], "next_ready": [],
            "round_summary": None, "final_results": [], "log": [], "winner": [],
            "game_over": False,
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if not isinstance(player_id, str) or player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] == "round_end" and player_id not in state["next_ready"]:
            return ["next_round"]
        if state["current_turn"] == player_id:
            if state["phase"] == "roll":
                return ["roll"]
            if state["phase"] == "place":
                return ["place"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if any(type(action[key]) is not int for key in ("round", "turn", "face") if key in action):
            return [], "action numbers must be integers"
        if action["type"] not in LasVegasGame.get_legal_actions(state, player_id):
            return [], "action unavailable"
        if action["round"] != state["round"]:
            return [], "stale round"
        action_type = action["type"]
        if action_type == "next_round":
            state["next_ready"].append(player_id)
            if len(state["next_ready"]) == len(state["turn_order"]):
                _continue_game(state)
            return [{"type": "las_vegas:ready", "payload": {"player_id": player_id}}], None
        if action["turn"] != state["turn"]:
            return [], "stale turn"
        player = state["players"][player_id]
        if action_type == "roll":
            dice = {"own": [random.randint(1, 6) for _ in range(player["remaining"])],
                    "neutral": [random.randint(1, 6) for _ in range(player["neutral_remaining"])]}
            state.update(roll=dice, phase="place")
            _log(state, f"{_name(state, player_id)} 掷出 {len(dice['own'])} 枚自己的骰子 (🎲)"
                        f"和 {len(dice['neutral'])} 枚白骰 (⚪)。")
            return [{"type": "las_vegas:rolled", "payload": {
                "player_id": player_id, "roll": copy.deepcopy(dice)}}], None
        face = action["face"]
        own_count = state["roll"]["own"].count(face)
        neutral_count = state["roll"]["neutral"].count(face)
        if not own_count + neutral_count:
            return [], "face unavailable in the current roll"
        casino = state["casinos"][face - 1]
        casino["dice"][player_id] += own_count
        casino["neutral_dice"] += neutral_count
        player["remaining"] -= own_count
        player["neutral_remaining"] -= neutral_count
        _log(state, f"{_name(state, player_id)} 在赌场 (🎰 {face}) 放置 {own_count} 枚自己的骰子 (🎲)"
                    f"和 {neutral_count} 枚白骰 (⚪)。")
        _advance_turn(state, player_id)
        return [{"type": "las_vegas:placed", "payload": {
            "player_id": player_id, "face": face, "own": own_count,
            "neutral": neutral_count}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = state["players"].get(viewer_id, {})
        finished = state["game_over"]
        casinos = []
        for casino in state["casinos"]:
            result = _casino_result(casino)
            # Returned notes are shown as actual settlement details at round end only.
            result.pop("returned")
            casinos.append(result)
        view = {
            "game_id": LasVegasGame.game_id, "you": viewer_id, "config": state["config"],
            "phase": state["phase"], "round": state["round"], "total_rounds": TOTAL_ROUNDS,
            "turn": state["turn"], "current_turn": state["current_turn"],
            "start_player": state["start_player"], "game_over": finished, "winner": state["winner"],
            "next_ready": state["next_ready"],
            "legal_actions": LasVegasGame.get_legal_actions(state, viewer_id),
            "roll": state["roll"], "casinos": casinos, "round_summary": state["round_summary"],
            "final_results": state["final_results"], "log": state["log"],
            "your_banknotes": own.get("banknotes", []),
            "your_total": sum(own["banknotes"]) if own else None,
            "players": [{
                "player_id": pid, "name": _name(state, pid),
                "seat": state["player_meta"][pid].get("seat", 0),
                "is_bot": bool(state["player_meta"][pid].get("is_bot")), "color": index,
                "remaining": state["players"][pid]["remaining"],
                "neutral_remaining": state["players"][pid]["neutral_remaining"],
                "banknote_count": len(state["players"][pid]["banknotes"]),
                "total": sum(state["players"][pid]["banknotes"]) if finished or pid == viewer_id else None,
            } for index, pid in enumerate(state["turn_order"])],
        }
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return _choose_bot_action(LasVegasGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


def _choose_bot_action(view: Dict) -> Optional[Dict]:
    """Choose using only the same public board and private purse the bot may see."""
    legal = view["legal_actions"]
    if "next_round" in legal:
        return {"type": "next_round", "round": view["round"]}
    base = {"round": view["round"], "turn": view["turn"]}
    if "roll" in legal:
        return {"type": "roll", **base}
    if "place" not in legal:
        return None
    own_roll, neutral_roll = view["roll"]["own"], view["roll"]["neutral"]
    candidates = sorted(set(own_roll + neutral_roll))
    if not candidates:
        return None
    player_id = view["you"]

    def payout(result: Dict) -> int:
        return next((row["amount"] for row in result["payouts"]
                     if row["player_id"] == player_id), 0)

    def score(face: int) -> Tuple[float, int, int]:
        casino = copy.deepcopy(view["casinos"][face - 1])
        before = payout(casino)
        own_count, neutral_count = own_roll.count(face), neutral_roll.count(face)
        casino["dice"][player_id] += own_count
        casino["neutral_dice"] += neutral_count
        result = _casino_result(casino)
        after = payout(result)
        # Reward the new claim and its improvement, while preserving dice for later turns.
        value = 1.1 * (after - before) + 0.35 * after - 2500 * own_count - 500 * neutral_count
        # A neutral-only placement is useful if it cancels or displaces an opponent's claim.
        before_others = sum(row["amount"] for row in casino["payouts"]
                            if row["player_id"] not in (player_id, NEUTRAL_ID))
        after_others = sum(row["amount"] for row in result["payouts"]
                           if row["player_id"] not in (player_id, NEUTRAL_ID))
        value += 0.12 * (before_others - after_others)
        return value, -(own_count + neutral_count), -face

    return {"type": "place", **base, "face": max(candidates, key=score)}
