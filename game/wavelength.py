import random
import time
from typing import Dict, List, Optional, Tuple

TEAM_IDS = ("A", "B")
SIDE_LEFT = "LEFT"
SIDE_RIGHT = "RIGHT"
SCORE_BANDS = (
    (0.12, 4),
    (0.24, 3),
    (0.38, 2),
)

DEFAULT_CONFIG = {
    "target_score": 10,
    "starting_score_second_team": 1,
    "enable_catch_up_rule": True,
}

BASE_SPECTRUM_CARDS = [
    {"id": "temperature", "left_label": "寒冷", "right_label": "炎热"},
    {"id": "volume", "left_label": "安静", "right_label": "吵闹"},
    {"id": "cleanliness", "left_label": "脏乱", "right_label": "整洁"},
    {"id": "risk", "left_label": "安全", "right_label": "危险"},
    {"id": "speed", "left_label": "缓慢", "right_label": "飞快"},
    {"id": "taste", "left_label": "难吃", "right_label": "美味"},
    {"id": "softness", "left_label": "坚硬", "right_label": "柔软"},
    {"id": "brightness", "left_label": "昏暗", "right_label": "明亮"},
    {"id": "price", "left_label": "便宜", "right_label": "昂贵"},
    {"id": "funny", "left_label": "严肃", "right_label": "搞笑"},
    {"id": "logic", "left_label": "感性", "right_label": "理性"},
    {"id": "freshness", "left_label": "陈旧", "right_label": "新鲜"},
    {"id": "power", "left_label": "弱小", "right_label": "强大"},
    {"id": "clean_ui", "left_label": "混乱", "right_label": "有序"},
    {"id": "spicy", "left_label": "清淡", "right_label": "辛辣"},
    {"id": "romance", "left_label": "平淡", "right_label": "浪漫"},
    {"id": "fancy", "left_label": "朴素", "right_label": "华丽"},
    {"id": "effort", "left_label": "轻松", "right_label": "费力"},
    {"id": "common", "left_label": "罕见", "right_label": "常见"},
    {"id": "maturity", "left_label": "幼稚", "right_label": "成熟"},
]


def _clamp_pos(value: object) -> Optional[float]:
    try:
        pos = float(value)
    except (TypeError, ValueError):
        return None
    if pos != pos:
        return None
    if pos < -1.0:
        pos = -1.0
    if pos > 1.0:
        pos = 1.0
    return round(pos, 4)


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if not config:
        return cfg
    target_score = config.get("target_score")
    try:
        target_score = int(target_score)
        if target_score >= 1:
            cfg["target_score"] = target_score
    except (TypeError, ValueError):
        pass
    second_start = config.get("starting_score_second_team")
    try:
        second_start = int(second_start)
        if second_start >= 0:
            cfg["starting_score_second_team"] = second_start
    except (TypeError, ValueError):
        pass
    catch_up = config.get("enable_catch_up_rule")
    if isinstance(catch_up, bool):
        cfg["enable_catch_up_rule"] = catch_up
    return cfg


def _team_for_player(order: List[str], player_id: str) -> Optional[str]:
    if player_id not in order:
        return None
    index = order.index(player_id)
    return TEAM_IDS[index % 2]


def _players_for_team(order: List[str], team_id: str) -> List[str]:
    if team_id not in TEAM_IDS:
        return []
    return [pid for idx, pid in enumerate(order) if TEAM_IDS[idx % 2] == team_id]


def _all_player_ids(state: Dict) -> List[str]:
    return list(state.get("turn_order", []))


def _bot_player_ids(state: Dict) -> List[str]:
    bots: List[str] = []
    for pid in _all_player_ids(state):
        meta = state.get("player_meta", {}).get(pid, {})
        if bool(meta.get("is_bot")):
            bots.append(pid)
    return bots


def _next_psychic_index(state: Dict, team_id: str) -> int:
    players = _players_for_team(state["turn_order"], team_id)
    if not players:
        return 0
    previous = int(state["psychic_index"].get(team_id, -1))
    return (previous + 1) % len(players)


def _current_psychic(state: Dict, team_id: str) -> Optional[str]:
    players = _players_for_team(state["turn_order"], team_id)
    if not players:
        return None
    index = int(state["psychic_index"].get(team_id, 0))
    return players[index % len(players)]


def _score_for_diff(diff: float) -> int:
    for width, points in SCORE_BANDS:
        if diff <= width:
            return points
    return 0


def _evaluate_side_guess(target: float, guess_pos: float, side_guess: str) -> bool:
    if side_guess == SIDE_LEFT:
        return target < guess_pos
    if side_guess == SIDE_RIGHT:
        return target > guess_pos
    return False


def _build_new_round(state: Dict, team_id: str) -> None:
    state["active_team"] = team_id
    index = _next_psychic_index(state, team_id)
    state["psychic_index"][team_id] = index
    card = state["deck"].pop() if state["deck"] else random.choice(BASE_SPECTRUM_CARDS)
    state["current_round"] = {
        "round_number": int(state.get("round_number", 0)) + 1,
        "active_team": team_id,
        "opponent_team": "B" if team_id == "A" else "A",
        "psychic_player_id": _current_psychic(state, team_id),
        "card": card,
        "target_center": round(random.uniform(-1.0, 1.0), 4),
        "clue_text": "",
        "guess_pos": None,
        "side_guess": None,
    }
    state["round_number"] = state["current_round"]["round_number"]
    state["phase"] = "psychic_clue"


def _game_winner(scores: Dict[str, int], target_score: int) -> Optional[str]:
    a = int(scores.get("A", 0))
    b = int(scores.get("B", 0))
    if a < target_score and b < target_score:
        return None
    if a == b:
        return None
    return "A" if a > b else "B"


def _start_tiebreak_if_needed(state: Dict) -> None:
    if state.get("tiebreak_pending"):
        return
    state["tiebreak_pending"] = ["A", "B"]


def _resolve_round(state: Dict) -> None:
    round_state = state["current_round"]
    active = round_state["active_team"]
    opponent = round_state["opponent_team"]
    target = float(round_state["target_center"])
    guess_pos = float(round_state["guess_pos"])
    side_guess = str(round_state["side_guess"])
    diff = abs(target - guess_pos)
    active_points = _score_for_diff(diff)
    side_correct = _evaluate_side_guess(target, guess_pos, side_guess)
    opponent_points = 0 if active_points == 4 else (1 if side_correct else 0)
    state["scores"][active] += active_points
    state["scores"][opponent] += opponent_points
    summary = {
        "round_number": round_state["round_number"],
        "active_team": active,
        "opponent_team": opponent,
        "psychic_player_id": round_state["psychic_player_id"],
        "card": round_state["card"],
        "clue_text": round_state["clue_text"],
        "target_center": target,
        "guess_pos": guess_pos,
        "side_guess": side_guess,
        "active_points": active_points,
        "opponent_points": opponent_points,
        "side_guess_correct": side_correct,
        "scores_after": dict(state["scores"]),
    }
    state["last_round_summary"] = summary
    state["history"].append(summary)
    target_score = int(state["config"]["target_score"])
    winner = _game_winner(state["scores"], target_score)
    if winner:
        state["winner"] = winner
        state["game_over"] = True
        state["phase"] = "game_over"
        state["pending_next_team"] = None
        return
    if state["scores"]["A"] >= target_score or state["scores"]["B"] >= target_score:
        _start_tiebreak_if_needed(state)
    next_team = opponent
    if state.get("tiebreak_pending"):
        pending = state["tiebreak_pending"]
        if pending and pending[0] == active:
            pending.pop(0)
        if not pending:
            if state["scores"]["A"] == state["scores"]["B"]:
                state["tiebreak_pending"] = ["A", "B"]
                next_team = "A"
            else:
                state["winner"] = "A" if state["scores"]["A"] > state["scores"]["B"] else "B"
                state["game_over"] = True
                state["phase"] = "game_over"
                state["pending_next_team"] = None
                return
        else:
            next_team = pending[0]
    elif (
        state["config"]["enable_catch_up_rule"]
        and active_points == 4
        and state["scores"][active] < state["scores"][opponent]
    ):
        next_team = active
    state["pending_next_team"] = next_team
    state["phase"] = "round_summary"
    state["continue_confirmed"] = list(_bot_player_ids(state))


class WavelengthGame:
    game_id = "wavelength"
    min_players = 4
    max_players = 16

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        ordered = [p["player_id"] for p in sorted(players, key=lambda item: item.get("seat", 0))]
        player_meta = {p["player_id"]: p for p in players}
        deck = list(BASE_SPECTRUM_CARDS)
        random.shuffle(deck)
        state = {
            "turn_order": ordered,
            "player_meta": player_meta,
            "config": cfg,
            "scores": {"A": 0, "B": int(cfg["starting_score_second_team"])},
            "psychic_index": {"A": -1, "B": -1},
            "deck": deck,
            "active_team": "A",
            "round_number": 0,
            "phase": "psychic_clue",
            "current_round": {},
            "last_round_summary": None,
            "history": [],
            "tiebreak_pending": [],
            "game_over": False,
            "winner": None,
            "pending_next_team": None,
            "continue_confirmed": [],
            "game_start_time": time.time(),
        }
        _build_new_round(state, "A")
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("player_meta", {}):
            return []
        if state.get("game_over"):
            return []
        round_state = state.get("current_round", {})
        phase = state.get("phase")
        active_team = round_state.get("active_team")
        opponent_team = round_state.get("opponent_team")
        psychic_id = round_state.get("psychic_player_id")
        team_id = _team_for_player(state.get("turn_order", []), player_id)
        if phase == "psychic_clue":
            if player_id == psychic_id:
                return ["submit_clue"]
            return []
        if phase == "team_guess":
            if team_id == active_team and player_id != psychic_id:
                return ["submit_team_guess"]
            return []
        if phase == "opponent_guess":
            if team_id == opponent_team:
                return ["submit_side_guess"]
            return []
        if phase == "round_summary":
            confirmed = set(state.get("continue_confirmed", []))
            if player_id not in confirmed:
                return ["continue_next_round"]
            return []
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        legal = WavelengthGame.get_legal_actions(state, player_id)
        action_type = action.get("type")
        if action_type not in legal:
            return [], "invalid action"
        events: List[Dict] = []
        round_state = state["current_round"]
        if action_type == "submit_clue":
            clue = action.get("clue")
            if not isinstance(clue, str):
                return [], "clue must be text"
            cleaned = " ".join(clue.strip().split())
            if not cleaned:
                return [], "clue required"
            round_state["clue_text"] = cleaned[:80]
            state["phase"] = "team_guess"
            events.append({"type": "wavelength:clue_submitted", "payload": {"player_id": player_id}})
            return events, None
        if action_type == "submit_team_guess":
            pos = _clamp_pos(action.get("pos"))
            if pos is None:
                return [], "invalid pos"
            round_state["guess_pos"] = pos
            state["phase"] = "opponent_guess"
            events.append({"type": "wavelength:team_guess_submitted", "payload": {"player_id": player_id, "pos": pos}})
            return events, None
        if action_type == "submit_side_guess":
            side = action.get("side")
            if side not in (SIDE_LEFT, SIDE_RIGHT):
                return [], "invalid side"
            round_state["side_guess"] = side
            events.append({"type": "wavelength:side_guess_submitted", "payload": {"player_id": player_id, "side": side}})
            _resolve_round(state)
            return events, None
        if action_type == "continue_next_round":
            next_team = state.get("pending_next_team")
            if next_team not in TEAM_IDS:
                return [], "round continuation unavailable"
            confirmed = set(state.get("continue_confirmed", []))
            confirmed.add(player_id)
            state["continue_confirmed"] = sorted(list(confirmed))
            total_players = len(_all_player_ids(state))
            events.append(
                {
                    "type": "wavelength:continue_clicked",
                    "payload": {"player_id": player_id, "confirmed_count": len(confirmed), "total_players": total_players},
                }
            )
            if len(confirmed) >= total_players:
                _build_new_round(state, next_team)
                state["pending_next_team"] = None
                state["continue_confirmed"] = []
                events.append({"type": "wavelength:round_continued", "payload": {"player_id": player_id}})
            return events, None
        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        order = state.get("turn_order", [])
        viewer_team = _team_for_player(order, viewer_id)
        round_state = state.get("current_round", {})
        active_team = round_state.get("active_team")
        opponent_team = round_state.get("opponent_team")
        psychic_id = round_state.get("psychic_player_id")
        phase = state.get("phase")
        show_target = bool(
            state.get("game_over")
            or phase == "round_summary"
            or (
                viewer_id == psychic_id
                and phase in ("psychic_clue", "team_guess", "opponent_guess", "round_summary")
            )
        )
        show_round_details = bool(phase != "round_summary" or state.get("game_over") or state.get("last_round_summary"))
        players_view = []
        for pid in order:
            meta = state["player_meta"].get(pid, {})
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "team_id": _team_for_player(order, pid),
                    "is_bot": bool(meta.get("is_bot")),
                    "is_psychic": bool(pid == psychic_id),
                }
            )
        return {
            "game_id": WavelengthGame.game_id,
            "phase": phase,
            "round": round_state.get("round_number", state.get("round_number")),
            "active_team": active_team,
            "opponent_team": opponent_team,
            "your_team": viewer_team,
            "your_role": "psychic" if viewer_id == psychic_id else "team",
            "psychic_player_id": psychic_id,
            "spectrum_card": round_state.get("card"),
            "clue_text": round_state.get("clue_text") or "",
            "team_guess_pos": round_state.get("guess_pos") if show_round_details else None,
            "side_guess": round_state.get("side_guess") if show_round_details else None,
            "target_center": round_state.get("target_center") if show_target else None,
            "scores": dict(state.get("scores", {})),
            "target_score": int(state.get("config", {}).get("target_score", DEFAULT_CONFIG["target_score"])),
            "last_round_summary": state.get("last_round_summary"),
            "history_tail": state.get("history", [])[-6:],
            "round_pause_summary": state.get("last_round_summary")
            if phase == "round_summary"
            else None,
            "continue_confirmed_player_ids": sorted(list(state.get("continue_confirmed", []))),
            "continue_total_players": len(_all_player_ids(state)),
            "tiebreak_pending": list(state.get("tiebreak_pending", [])),
            "winner": state.get("winner"),
            "game_over": bool(state.get("game_over")),
            "players": players_view,
            "legal_actions": WavelengthGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = WavelengthGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        if "submit_clue" in legal:
            return {"type": "submit_clue", "clue": "middle vibe", "delay_ms": 500}
        if "submit_team_guess" in legal:
            return {"type": "submit_team_guess", "pos": round(random.uniform(-0.9, 0.9), 2), "delay_ms": 500}
        if "submit_side_guess" in legal:
            return {"type": "submit_side_guess", "side": random.choice([SIDE_LEFT, SIDE_RIGHT]), "delay_ms": 500}
        if "continue_next_round" in legal:
            return {"type": "continue_next_round", "delay_ms": 600}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
