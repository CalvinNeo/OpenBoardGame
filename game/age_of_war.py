import json
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple

DICE_FACES = ["I1", "I2", "I3", "A", "C", "D"]

ASSET_PATH = Path(__file__).resolve().parent / "assets" / "age_of_war.json"


def _load_assets() -> Dict:
    with ASSET_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


ASSETS = _load_assets()
CLANS = {clan["id"]: clan for clan in ASSETS.get("clans", [])}
CASTLES = {castle["id"]: castle for castle in ASSETS.get("castles", [])}
CASTLE_ORDER = [castle["id"] for castle in ASSETS.get("castles", [])]

DEFAULT_CONFIG: Dict = {}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _decode_die(code: str) -> Tuple[str, Optional[int]]:
    if code.startswith("I"):
        try:
            return "infantry", int(code[1:])
        except ValueError:
            return "infantry", 1
    if code == "A":
        return "archery", None
    if code == "C":
        return "cavalry", None
    if code == "D":
        return "daimyo", None
    return "infantry", 1


def _roll_dice(count: int) -> List[str]:
    return [random.choice(DICE_FACES) for _ in range(count)]


def _pick_infantry_subset(infantry: List[Tuple[int, int]], required: int) -> Optional[List[int]]:
    if required <= 0:
        return []
    n = len(infantry)
    best: Optional[Tuple[int, int, List[int]]] = None
    for mask in range(1, 1 << n):
        total = 0
        indices = []
        for idx in range(n):
            if mask & (1 << idx):
                die_index, value = infantry[idx]
                total += value
                indices.append(die_index)
        if total >= required:
            candidate = (len(indices), total, indices)
            if best is None or candidate < best:
                best = candidate
    if not best:
        return None
    return best[2]


def _match_line(dice_pool: List[str], requirements: List[Dict]) -> Optional[List[int]]:
    type_indices = {"archery": [], "cavalry": [], "daimyo": [], "infantry": []}
    for idx, code in enumerate(dice_pool):
        die_type, value = _decode_die(code)
        type_indices[die_type].append((idx, value or 0))

    used: List[int] = []

    infantry_req = None
    for req in requirements:
        if req.get("type") == "infantry":
            infantry_req = req
            continue
        req_type = req.get("type")
        count = int(req.get("count", 1))
        available = type_indices.get(req_type, [])
        if len(available) < count:
            return None
        selected = available[:count]
        used.extend(index for index, _ in selected)
        type_indices[req_type] = available[count:]

    if infantry_req:
        required_sum = int(infantry_req.get("sum", 0))
        infantry_indices = _pick_infantry_subset(type_indices["infantry"], required_sum)
        if infantry_indices is None:
            return None
        used.extend(infantry_indices)

    return sorted(set(used))


def _remove_dice(dice_pool: List[str], indices: List[int]) -> None:
    for idx in sorted(indices, reverse=True):
        if 0 <= idx < len(dice_pool):
            dice_pool.pop(idx)


def _castle_lines(castle_id: str, bonus_daimyo: bool) -> List[Dict]:
    castle = CASTLES[castle_id]
    lines = []
    for line in castle.get("battle_lines", []):
        lines.append({"requirements": [dict(req) for req in line], "bonus": False})
    if bonus_daimyo:
        lines.append({"requirements": [{"type": "daimyo", "count": 1}], "bonus": True})
    return lines


def _start_turn(state: Dict) -> None:
    state["phase"] = "select_target"
    state["target"] = None
    state["target_lines"] = []
    state["filled_lines"] = []
    state["dice_remaining"] = 7
    state["dice_pool"] = []


def _advance_turn(state: Dict) -> None:
    order = state.get("turn_order", [])
    if not order:
        return
    current = state.get("current_player")
    if current not in order:
        state["current_player"] = order[0]
    else:
        idx = order.index(current)
        state["current_player"] = order[(idx + 1) % len(order)]
    _start_turn(state)


def _player_castles(state: Dict, player_id: str) -> List[str]:
    pdata = state.get("players", {}).get(player_id, {})
    return list(pdata.get("castles", []))


def _is_castle_locked(state: Dict, player_id: str, castle_id: str) -> bool:
    pdata = state.get("players", {}).get(player_id, {})
    locked = set(pdata.get("locked_clans", []))
    clan_id = CASTLES[castle_id]["clan"]
    return clan_id in locked


def _check_clan_completion(state: Dict, player_id: str, events: Optional[List[Dict]] = None) -> None:
    pdata = state["players"][player_id]
    owned = set(pdata.get("castles", []))
    locked = set(pdata.get("locked_clans", []))
    for clan_id, clan in CLANS.items():
        if clan_id in locked:
            continue
        clan_castles = set(clan.get("castle_ids", []))
        if clan_castles and clan_castles.issubset(owned):
            locked.add(clan_id)
            if events is not None:
                events.append({"type": "age_of_war:lock_clan", "payload": {"player_id": player_id, "clan": clan_id}})
    pdata["locked_clans"] = sorted(locked)


def _compute_score(state: Dict, player_id: str) -> int:
    pdata = state.get("players", {}).get(player_id, {})
    owned = set(pdata.get("castles", []))
    locked = set(pdata.get("locked_clans", []))
    score = 0
    for clan_id, clan in CLANS.items():
        clan_castles = set(clan.get("castle_ids", []))
        if clan_id in locked:
            score += int(clan.get("set_bonus", 0))
        else:
            for cid in clan_castles.intersection(owned):
                score += int(CASTLES[cid].get("points", 0))
    return score


def _available_targets(state: Dict, player_id: str) -> Tuple[List[str], List[Tuple[str, str]]]:
    central = list(state.get("central_castles", []))
    opponent_targets: List[Tuple[str, str]] = []
    for pid, pdata in state.get("players", {}).items():
        if pid == player_id:
            continue
        for cid in pdata.get("castles", []):
            if _is_castle_locked(state, pid, cid):
                continue
            opponent_targets.append((pid, cid))
    return central, opponent_targets


def _target_line_view(state: Dict, line: Dict) -> Dict:
    requirements = line.get("requirements", [])
    can_fill = False
    if state.get("phase") == "assign":
        can_fill = _match_line(state.get("dice_pool", []), requirements) is not None
    return {
        "requirements": requirements,
        "bonus": bool(line.get("bonus")),
        "can_fill": can_fill,
    }


def _castle_view(state: Dict, castle_id: str, owner_id: Optional[str], viewer_id: str, selectable: bool) -> Dict:
    castle = CASTLES[castle_id]
    clan_id = castle.get("clan")
    clan = CLANS.get(clan_id, {})
    return {
        "id": castle_id,
        "name": castle.get("name"),
        "name_zh": castle.get("name_zh"),
        "clan": clan_id,
        "clan_name": clan.get("name"),
        "clan_name_zh": clan.get("name_zh"),
        "points": castle.get("points"),
        "battle_lines": castle.get("battle_lines", []),
        "owner_id": owner_id,
        "locked": bool(owner_id and _is_castle_locked(state, owner_id, castle_id)),
        "selectable": selectable,
    }


class AgeOfWarGame:
    game_id = "age_of_war"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {"castles": [], "locked_clans": []}

        state = {
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "current_player": player_ids[0] if player_ids else None,
            "config": cfg,
            "central_castles": list(CASTLE_ORDER),
            "phase": "select_target",
            "target": None,
            "target_lines": [],
            "filled_lines": [],
            "dice_remaining": 7,
            "dice_pool": [],
            "winner": None,
            "game_over": False,
        }
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again"]
        if player_id != state.get("current_player"):
            return []
        phase = state.get("phase")
        if phase == "select_target":
            actions = ["select_target"]
            if not state.get("target") and not state.get("dice_pool") and state.get("dice_remaining", 0) > 0:
                actions.append("roll")
            return actions
        if phase == "roll":
            return ["roll"]
        if phase == "assign":
            return ["fill_line", "discard_die"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        if action_type == "play_again":
            if not state.get("game_over"):
                return [], "game not over"
            players = list(state.get("turn_order", []))
            player_meta = state.get("player_meta", {})
            config = dict(state.get("config", {}))
            state.clear()
            state.update(AgeOfWarGame.init_game(config, [player_meta[pid] for pid in players]))
            events.append({"type": "age_of_war:play_again", "payload": {"player_id": player_id}})
            return events, None

        if state.get("game_over"):
            return [], "game over"

        if player_id != state.get("current_player"):
            return [], "not your turn"

        phase = state.get("phase")

        if action_type == "select_target":
            if phase != "select_target":
                return [], "invalid phase"
            if state.get("target"):
                return [], "target already selected"
            target_type = action.get("target_type")
            castle_id = action.get("castle_id")
            if castle_id not in CASTLES:
                return [], "unknown castle"
            if target_type == "central":
                if castle_id not in state.get("central_castles", []):
                    return [], "castle not available"
                state["target"] = {"type": "central", "castle_id": castle_id}
                state["target_lines"] = _castle_lines(castle_id, False)
                state["filled_lines"] = []
                state["phase"] = "assign" if state.get("dice_pool") else "roll"
                events.append({"type": "age_of_war:select_target", "payload": {"player_id": player_id, "castle_id": castle_id}})
                return events, None
            if target_type == "player":
                defender_id = action.get("defender_id")
                if defender_id not in state.get("players", {}):
                    return [], "unknown defender"
                if defender_id == player_id:
                    return [], "cannot attack self"
                if castle_id not in state["players"][defender_id].get("castles", []):
                    return [], "castle not owned"
                if _is_castle_locked(state, defender_id, castle_id):
                    return [], "castle locked"
                state["target"] = {"type": "player", "castle_id": castle_id, "defender_id": defender_id}
                state["target_lines"] = _castle_lines(castle_id, True)
                state["filled_lines"] = []
                state["phase"] = "assign" if state.get("dice_pool") else "roll"
                events.append(
                    {
                        "type": "age_of_war:select_target",
                        "payload": {"player_id": player_id, "castle_id": castle_id, "defender_id": defender_id},
                    }
                )
                return events, None
            return [], "invalid target"

        if action_type == "roll":
            if phase == "select_target":
                if state.get("target"):
                    return [], "invalid phase"
                if state.get("dice_pool"):
                    return [], "dice already rolled"
                remaining = int(state.get("dice_remaining", 0))
                if remaining <= 0:
                    return [], "no dice"
                state["dice_pool"] = _roll_dice(remaining)
                events.append({"type": "age_of_war:roll", "payload": {"player_id": player_id, "dice": list(state["dice_pool"])}})
                return events, None
            if phase != "roll":
                return [], "invalid phase"
            remaining = int(state.get("dice_remaining", 0))
            if remaining <= 0:
                return [], "no dice"
            state["dice_pool"] = _roll_dice(remaining)
            state["phase"] = "assign"
            events.append({"type": "age_of_war:roll", "payload": {"player_id": player_id, "dice": list(state["dice_pool"])}})
            return events, None

        if action_type == "discard_die":
            if phase != "assign":
                return [], "invalid phase"
            die_index = action.get("die_index")
            if not isinstance(die_index, int):
                return [], "invalid die"
            if die_index < 0 or die_index >= len(state.get("dice_pool", [])):
                return [], "die out of range"
            state["dice_pool"].pop(die_index)
            remaining = len(state["dice_pool"])
            state["dice_pool"] = []
            state["dice_remaining"] = remaining
            events.append({"type": "age_of_war:discard", "payload": {"player_id": player_id, "index": die_index}})
            if state["dice_remaining"] <= 0:
                events.append({"type": "age_of_war:attack_fail", "payload": {"player_id": player_id}})
                _advance_turn(state)
            else:
                state["phase"] = "roll"
            return events, None

        if action_type == "fill_line":
            if phase != "assign":
                return [], "invalid phase"
            line_index = action.get("line_index")
            if not isinstance(line_index, int):
                return [], "invalid line"
            target_lines = state.get("target_lines", [])
            if line_index < 0 or line_index >= len(target_lines):
                return [], "line out of range"
            if line_index in state.get("filled_lines", []):
                return [], "line already filled"
            line = target_lines[line_index]
            match = _match_line(state.get("dice_pool", []), line.get("requirements", []))
            if match is None:
                return [], "line not fillable"
            _remove_dice(state["dice_pool"], match)
            remaining = len(state["dice_pool"])
            state["dice_pool"] = []
            state["dice_remaining"] = remaining
            state.setdefault("filled_lines", []).append(line_index)
            events.append(
                {
                    "type": "age_of_war:fill_line",
                    "payload": {"player_id": player_id, "line_index": line_index, "dice_used": match},
                }
            )

            if len(state["filled_lines"]) >= len(state.get("target_lines", [])):
                target = state.get("target")
                if not target:
                    return events, "missing target"
                castle_id = target.get("castle_id")
                if target.get("type") == "central":
                    if castle_id in state.get("central_castles", []):
                        state["central_castles"].remove(castle_id)
                elif target.get("type") == "player":
                    defender_id = target.get("defender_id")
                    if defender_id in state.get("players", {}):
                        defender_castles = state["players"][defender_id].get("castles", [])
                        if castle_id in defender_castles:
                            defender_castles.remove(castle_id)
                state["players"][player_id].setdefault("castles", []).append(castle_id)
                _check_clan_completion(state, player_id, events)
                events.append(
                    {
                        "type": "age_of_war:capture",
                        "payload": {"player_id": player_id, "castle_id": castle_id, "target": target},
                    }
                )

                if not state.get("central_castles"):
                    scores = {pid: _compute_score(state, pid) for pid in state.get("turn_order", [])}
                    if scores:
                        max_score = max(scores.values())
                        winners = [pid for pid, score in scores.items() if score == max_score]
                    else:
                        winners = []
                    state["winner"] = winners
                    state["game_over"] = True
                    state["phase"] = "game_over"
                    return events, None

                _advance_turn(state)
                return events, None

            if state.get("dice_remaining", 0) <= 0:
                events.append({"type": "age_of_war:attack_fail", "payload": {"player_id": player_id}})
                _advance_turn(state)
                return events, None

            state["phase"] = "roll"
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_meta = state.get("player_meta", {})
        players_view = []
        for pid in state.get("turn_order", []):
            meta = player_meta.get(pid, {})
            pdata = state.get("players", {}).get(pid, {})
            castles = pdata.get("castles", [])
            castle_views = []
            for cid in castles:
                selectable = False
                if state.get("phase") == "select_target" and state.get("current_player") == viewer_id:
                    if pid != viewer_id and not _is_castle_locked(state, pid, cid):
                        selectable = True
                castle_views.append(_castle_view(state, cid, pid, viewer_id, selectable))
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "score": _compute_score(state, pid),
                    "locked_clans": list(pdata.get("locked_clans", [])),
                    "castles": castle_views,
                }
            )

        central_castles = []
        selectable_central = state.get("phase") == "select_target" and state.get("current_player") == viewer_id
        for cid in state.get("central_castles", []):
            central_castles.append(_castle_view(state, cid, None, viewer_id, selectable_central))

        target = state.get("target")
        target_view = None
        if target:
            castle_id = target.get("castle_id")
            owner_id = target.get("defender_id") if target.get("type") == "player" else None
            target_view = _castle_view(state, castle_id, owner_id, viewer_id, False)
            target_view["target_type"] = target.get("type")
            target_view["defender_id"] = target.get("defender_id")

        lines_view = []
        for idx, line in enumerate(state.get("target_lines", [])):
            line_view = _target_line_view(state, line)
            line_view["index"] = idx
            line_view["filled"] = idx in state.get("filled_lines", [])
            lines_view.append(line_view)

        return {
            "game_id": AgeOfWarGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_player": state.get("current_player"),
            "dice_pool": list(state.get("dice_pool", [])),
            "dice_remaining": state.get("dice_remaining"),
            "target": target_view,
            "target_lines": lines_view,
            "central_castles": central_castles,
            "players": players_view,
            "legal_actions": AgeOfWarGame.get_legal_actions(state, viewer_id),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "config": state.get("config", {}),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        if bot_id != state.get("current_player"):
            return None
        phase = state.get("phase")
        if phase == "select_target":
            central, opponents = _available_targets(state, bot_id)
            if central:
                castle_id = random.choice(central)
                return {"type": "select_target", "target_type": "central", "castle_id": castle_id}
            if opponents:
                defender_id, castle_id = random.choice(opponents)
                return {
                    "type": "select_target",
                    "target_type": "player",
                    "defender_id": defender_id,
                    "castle_id": castle_id,
                }
            return None
        if phase == "roll":
            return {"type": "roll"}
        if phase == "assign":
            lines = state.get("target_lines", [])
            fillable = []
            for idx, line in enumerate(lines):
                if idx in state.get("filled_lines", []):
                    continue
                if _match_line(state.get("dice_pool", []), line.get("requirements", [])) is not None:
                    fillable.append(idx)
            if fillable:
                return {"type": "fill_line", "line_index": random.choice(fillable)}
            if state.get("dice_pool"):
                return {"type": "discard_die", "die_index": random.randrange(len(state["dice_pool"]))}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
