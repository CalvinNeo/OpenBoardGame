import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple


DEFAULT_CONFIG = {"setup": "standard", "rounds": 1}
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "setup": {"enum": ["standard", "random"], "default": "standard"},
        "rounds": {"type": "integer", "minimum": 1, "maximum": 3, "default": 1},
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
    },
    "additionalProperties": False,
}
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"enum": ["roll", "move", "next_round"]},
        "piece_id": {"type": "string"},
    },
    "required": ["type"],
    "additionalProperties": False,
}


def score_tiles(tiles: List[Dict]) -> Dict:
    negatives = sorted((tile for tile in tiles if tile["value"] < 0), key=lambda tile: tile["value"])
    lucky_count = sum(tile["kind"] == "lucky" for tile in tiles)
    converted = [tile["id"] for tile in negatives[:lucky_count]]
    raw = sum(tile["value"] for tile in tiles)
    bonus = -2 * sum(tile["value"] for tile in negatives[:lucky_count])
    return {"score": raw + bonus, "raw": raw, "bonus": bonus,
            "lucky_count": lucky_count, "converted_ids": converted}


def _config(config: Optional[Dict]) -> Dict:
    config = {} if config is None else config
    if not isinstance(config, dict) or set(config) - {"setup", "rounds", "seed"}:
        raise ValueError("invalid That's Life! configuration")
    result = {**DEFAULT_CONFIG, **config}
    if result["setup"] not in ("standard", "random"):
        raise ValueError("invalid setup")
    if type(result["rounds"]) is not int or not 1 <= result["rounds"] <= 3:
        raise ValueError("rounds must be an integer from 1 to 3")
    seed = result.get("seed", 0)
    if type(seed) is not int and not (isinstance(seed, str) and 1 <= len(seed) <= 80):
        raise ValueError("invalid seed")
    return result


def _start_round(state: Dict) -> None:
    values = list(range(-1, -9, -1)) + [0] * 6 + list(range(8, 0, -1)) + list(range(-1, -11, -1))
    tiles = [{"id": "tile-{}".format(index), "kind": "lucky" if value == 0 else "points", "value": value}
             for index, value in enumerate(values)]
    if state["config"]["setup"] == "random":
        random.Random("{}:board:{}".format(state["base_seed"], state["round_number"])).shuffle(tiles)
    state["track"] = [{"id": "start", "kind": "start", "value": 0}] + tiles + [
        {"id": "finish", "kind": "finish", "value": 0}]
    pawn_count = 3 if len(state["turn_order"]) <= 4 else 2
    state["pieces"] = [{"id": "pawn-{}-{}".format(seat, number), "owner": player_id,
                        "number": number + 1, "position": "start", "kind": "pawn"}
                       for seat, player_id in enumerate(state["turn_order"])
                       for number in range(pawn_count)]
    protected = [tile for tile in tiles if tile["kind"] == "lucky" or tile["value"] in (7, 8)]
    state["pieces"] += [{"id": "guard-{}".format(index), "owner": None, "number": index + 1,
                         "position": tile["id"], "kind": "guard"} for index, tile in enumerate(protected)]
    for player in state["players"].values():
        player["tiles"] = []
    state.update(phase="roll", die=None, ready=[], round_summary=[], last_move=None,
                 current_turn=state["start_player"], turn_number=1)


def move_options(state: Dict, player_id: str) -> List[Dict]:
    if state["phase"] != "move" or state["current_turn"] != player_id:
        return []
    track = state["track"]
    positions = {tile["id"]: index for index, tile in enumerate(track)}
    options = []
    for piece in state["pieces"]:
        if piece["position"] == "finish":
            continue
        occupants = [other for other in state["pieces"] if other["position"] == piece["position"]]
        if piece["kind"] == "guard":
            if not any(other["kind"] == "pawn" for other in occupants):
                continue
        elif piece["owner"] != player_id:
            continue
        origin = track[positions[piece["position"]]]
        target = track[min(positions[origin["id"]] + state["die"], len(track) - 1)]
        collected = origin if len(occupants) == 1 and origin["kind"] not in ("start", "finish") else None
        options.append({"piece_id": piece["id"], "from": origin["id"], "to": target["id"],
                        "collect": copy.deepcopy(collected)})
    return options


def _finish_round(state: Dict) -> None:
    summary = []
    for player_id in state["turn_order"]:
        player = state["players"][player_id]
        result = score_tiles(player["tiles"])
        player["total_score"] += result["score"]
        player["total_lucky"] += result["lucky_count"]
        summary.append({"player_id": player_id, **result, "total_score": player["total_score"]})
    state["round_summary"] = summary
    state["score_history"].append(copy.deepcopy(summary))
    state["game_over"] = state["round_number"] == state["config"]["rounds"]
    state["phase"] = "game_over" if state["game_over"] else "round_summary"
    state["current_turn"] = None
    if state["game_over"]:
        best = max((player["total_score"], -player["total_lucky"]) for player in state["players"].values())
        state["winner_ids"] = [player_id for player_id, player in state["players"].items()
                               if (player["total_score"], -player["total_lucky"]) == best]


class ThatsLifeGame:
    game_id = "thats_life"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 2 <= len(players) <= 6:
            raise ValueError("That's Life! requires 2 to 6 players")
        meta = {player["player_id"]: dict(player) for player in players}
        if len(meta) != len(players):
            raise ValueError("player IDs must be unique")
        order = sorted(meta, key=lambda player_id: (meta[player_id].get("seat", 0), player_id))
        cfg = _config(config)
        seed = cfg.get("seed", secrets.token_hex(16))
        state = {"version": 1, "config": cfg, "base_seed": seed, "player_meta": meta,
                 "turn_order": order, "start_player": order[0], "round_number": 1,
                 "roll_count": 0, "game_over": False, "winner_ids": [], "history": [], "score_history": [],
                 "players": {player_id: {"tiles": [], "total_score": 0, "total_lucky": 0} for player_id in order}}
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] == "round_summary":
            return [] if player_id in state["ready"] else ["next_round"]
        if state["current_turn"] != player_id:
            return []
        return ["roll"] if state["phase"] == "roll" else ["move"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        kind = action["type"]
        if set(action) != ({"type", "piece_id"} if kind == "move" else {"type"}):
            return [], "invalid action fields"
        if kind == "next_round" and state["phase"] == "round_summary" and player_id in state["ready"]:
            return [], None
        if kind not in ThatsLifeGame.get_legal_actions(state, player_id):
            return [], "action not available"
        payload = {"player_id": player_id}
        if kind == "next_round":
            state["ready"].append(player_id)
            if set(state["ready"]) == set(state["turn_order"]):
                order = state["turn_order"]
                state["start_player"] = order[(order.index(state["start_player"]) + 1) % len(order)]
                state["round_number"] += 1
                _start_round(state)
        elif kind == "roll":
            state["die"] = random.Random("{}:die:{}".format(state["base_seed"], state["roll_count"])).randint(1, 6)
            state["roll_count"] += 1
            state["phase"] = "move"
            payload["die"] = state["die"]
        else:
            option = next((option for option in move_options(state, player_id)
                           if option["piece_id"] == action["piece_id"]), None)
            if option is None:
                return [], "piece cannot be moved"
            piece = next(piece for piece in state["pieces"] if piece["id"] == option["piece_id"])
            piece["position"] = option["to"]
            if option["collect"]:
                state["players"][player_id]["tiles"].append(copy.deepcopy(option["collect"]))
                state["track"] = [tile for tile in state["track"] if tile["id"] != option["from"]]
            payload.update(copy.deepcopy(option), die=state["die"], piece_kind=piece["kind"])
            state["last_move"] = copy.deepcopy(payload)
            state["history"].append(copy.deepcopy(payload))
            state["history"] = state["history"][-80:]
            active = {piece["owner"] for piece in state["pieces"]
                      if piece["kind"] == "pawn" and piece["position"] != "finish"}
            if not active:
                _finish_round(state)
            else:
                order = state["turn_order"]
                current = order.index(player_id)
                state["current_turn"] = next(order[(current + step) % len(order)]
                                             for step in range(1, len(order) + 1)
                                             if order[(current + step) % len(order)] in active)
                state["phase"] = "roll"
                state["turn_number"] += 1
        return [{"type": "thats_life:" + kind, "payload": payload}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: Optional[str]) -> Dict:
        players = []
        for player_id in state["turn_order"]:
            player = state["players"][player_id]
            players.append({**copy.deepcopy(state["player_meta"][player_id]),
                            "player_id": player_id, "tiles": copy.deepcopy(player["tiles"]),
                            "total_score": player["total_score"], **score_tiles(player["tiles"])})
        return {"game_id": ThatsLifeGame.game_id, "you": viewer_id,
                "config": {key: state["config"][key] for key in DEFAULT_CONFIG}, "players": players,
                **{key: copy.deepcopy(state[key]) for key in (
                    "phase", "current_turn", "turn_number", "round_number", "die", "track", "pieces", "ready",
                    "last_move", "history", "round_summary", "score_history", "game_over", "winner_ids")},
                "legal_actions": ThatsLifeGame.get_legal_actions(state, viewer_id),
                "move_options": move_options(state, viewer_id)}

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.thats_life_ai import choose_action

        action = choose_action(ThatsLifeGame.get_public_view(state, bot_id))
        return {**action, "delay_ms": 650} if action else None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
