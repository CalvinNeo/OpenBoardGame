import random
from typing import Dict, List, Optional, Tuple

TREASURE_VALUES = [1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17]
HAZARD_TYPES = ["snake", "spider", "fire", "rockfall", "mummy"]
ARTIFACT_VALUES = [5, 5, 5, 10, 10]

DEFAULT_CONFIG: Dict = {}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _build_base_deck() -> List[Dict]:
    deck: List[Dict] = [{"type": "treasure", "value": value} for value in TREASURE_VALUES]
    for hazard in HAZARD_TYPES:
        for _ in range(3):
            deck.append({"type": "hazard", "hazard": hazard})
    return deck


def _artifact_value_for_round(round_no: int) -> int:
    if 1 <= round_no <= len(ARTIFACT_VALUES):
        return ARTIFACT_VALUES[round_no - 1]
    return ARTIFACT_VALUES[-1]


def _build_round_deck(state: Dict) -> List[Dict]:
    deck = [dict(card) for card in state.get("base_deck", [])]
    deck.append({"type": "artifact", "value": _artifact_value_for_round(state.get("current_round", 1))})
    random.shuffle(deck)
    return deck


def _players_in_cave(state: Dict) -> List[str]:
    return [
        pid
        for pid in state.get("turn_order", [])
        if state.get("players", {}).get(pid, {}).get("status") == "in_cave"
    ]


def _remove_hazard_from_base(state: Dict, hazard_type: str) -> bool:
    base_deck = state.get("base_deck", [])
    for idx, card in enumerate(base_deck):
        if card.get("type") == "hazard" and card.get("hazard") == hazard_type:
            base_deck.pop(idx)
            removed = state.setdefault("removed_hazards", {})
            removed[hazard_type] = removed.get(hazard_type, 0) + 1
            return True
    return False


def _award_artifact(state: Dict, player_id: str, value: int) -> None:
    pdata = state["players"][player_id]
    pdata["artifact_count"] = pdata.get("artifact_count", 0) + 1
    pdata["artifact_points"] = pdata.get("artifact_points", 0) + value


def _remove_artifacts_from_path(state: Dict, award_player: Optional[str] = None) -> int:
    removed = 0
    new_path = []
    for card in state.get("path_cards", []):
        if card.get("type") == "artifact":
            removed += 1
            if award_player:
                _award_artifact(state, award_player, int(card.get("value", 0)))
        else:
            new_path.append(card)
    state["path_cards"] = new_path
    return removed


def _distribute_remainders(state: Dict, leaving_players: List[str]) -> int:
    if not leaving_players:
        return 0
    count = len(leaving_players)
    total_awarded = 0
    for card in state.get("path_cards", []):
        if card.get("type") != "treasure":
            continue
        remainder = int(card.get("remainder", 0))
        if remainder <= 0:
            continue
        share = remainder // count
        if share <= 0:
            continue
        for pid in leaving_players:
            state["players"][pid]["hand_gems"] += share
        total_awarded += share * count
        card["remainder"] = remainder - share * count
    return total_awarded


def _end_round_safe(state: Dict, reason: str, events: List[Dict]) -> None:
    for pid in _players_in_cave(state):
        pdata = state["players"][pid]
        pdata["banked_gems"] += pdata["hand_gems"]
        pdata["hand_gems"] = 0
        pdata["status"] = "in_camp"
    artifacts_removed = _remove_artifacts_from_path(state)
    state["round_end_reason"] = reason
    state["round_end_hazard"] = None
    state["round_end_artifacts_removed"] = artifacts_removed
    events.append({"type": "incan_gold:round_end", "payload": {"reason": reason}})


def _end_round_bust(state: Dict, hazard_type: str, events: List[Dict]) -> None:
    for pid in _players_in_cave(state):
        pdata = state["players"][pid]
        pdata["hand_gems"] = 0
        pdata["status"] = "in_camp"
    artifacts_removed = _remove_artifacts_from_path(state)
    state["round_end_reason"] = "hazard"
    state["round_end_hazard"] = hazard_type
    state["round_end_artifacts_removed"] = artifacts_removed
    events.append({"type": "incan_gold:round_end", "payload": {"reason": "hazard", "hazard": hazard_type}})


def _maybe_finish_game(state: Dict) -> None:
    if state.get("current_round", 1) < state.get("max_rounds", len(ARTIFACT_VALUES)):
        state["phase"] = "round_end"
        return
    scores: Dict[str, int] = {}
    for pid, pdata in state.get("players", {}).items():
        scores[pid] = int(pdata.get("banked_gems", 0)) + int(pdata.get("artifact_points", 0))
    winners: List[str] = []
    if scores:
        max_score = max(scores.values())
        top_players = [pid for pid, score in scores.items() if score == max_score]
        if len(top_players) > 1:
            max_artifacts = max(state["players"][pid].get("artifact_count", 0) for pid in top_players)
            winners = [pid for pid in top_players if state["players"][pid].get("artifact_count", 0) == max_artifacts]
        else:
            winners = top_players
    state["winner"] = _sorted_player_ids(state, winners)
    state["game_over"] = True
    state["phase"] = "game_over"


def _sorted_player_ids(state: Dict, player_ids: List[str]) -> List[str]:
    meta = state.get("player_meta", {})
    return sorted(player_ids, key=lambda pid: meta.get(pid, {}).get("seat", 0))


def _reveal_card(state: Dict, events: List[Dict]) -> None:
    if not state.get("deck"):
        _end_round_safe(state, "deck_empty", events)
        _maybe_finish_game(state)
        return

    card = state["deck"].pop()
    state.setdefault("path_cards", []).append(card)
    card_type = card.get("type")
    if card_type == "treasure":
        active_players = _players_in_cave(state)
        active_count = len(active_players)
        if active_count > 0:
            value = int(card.get("value", 0))
            share = value // active_count
            remainder = value % active_count
            for pid in active_players:
                state["players"][pid]["hand_gems"] += share
            card["remainder"] = remainder
        else:
            card["remainder"] = int(card.get("value", 0))
    elif card_type == "hazard":
        hazard = card.get("hazard")
        hazard_counts = state.setdefault("hazard_counts", {})
        hazard_counts[hazard] = hazard_counts.get(hazard, 0) + 1
        if hazard_counts[hazard] >= 2:
            card["triggered"] = True
            card["removed"] = True
            _remove_hazard_from_base(state, hazard)
            _end_round_bust(state, hazard, events)
            _maybe_finish_game(state)
            return
    elif card_type == "artifact":
        card["remainder"] = 0

    events.append({"type": "incan_gold:reveal", "payload": {"card": _card_view(card)}})

    if not state.get("deck"):
        _end_round_safe(state, "deck_empty", events)
        _maybe_finish_game(state)
        return
    state["phase"] = "decision"


def _resolve_decisions(state: Dict, events: List[Dict]) -> None:
    decisions = state.get("decisions", {})
    active_players = _players_in_cave(state)
    leaving_players = [pid for pid in active_players if decisions.get(pid) == "leave"]

    if leaving_players:
        _distribute_remainders(state, leaving_players)
        if len(leaving_players) == 1:
            _remove_artifacts_from_path(state, award_player=leaving_players[0])
        else:
            _remove_artifacts_from_path(state)
        for pid in leaving_players:
            pdata = state["players"][pid]
            pdata["banked_gems"] += pdata["hand_gems"]
            pdata["hand_gems"] = 0
            pdata["status"] = "in_camp"

    state["decisions"] = {}

    if not _players_in_cave(state):
        _end_round_safe(state, "all_left", events)
        _maybe_finish_game(state)
        return
    _reveal_card(state, events)


def _start_round(state: Dict, events: Optional[List[Dict]] = None) -> None:
    if events is None:
        events = []
    state["deck"] = _build_round_deck(state)
    state["path_cards"] = []
    state["decisions"] = {}
    state["hazard_counts"] = {}
    state["round_end_reason"] = None
    state["round_end_hazard"] = None
    state["round_end_artifacts_removed"] = 0
    for pdata in state.get("players", {}).values():
        pdata["hand_gems"] = 0
        pdata["status"] = "in_cave"
    _reveal_card(state, events)


def _reset_game_state(state: Dict) -> None:
    config = state.get("config") or {}
    player_meta = state.get("player_meta") or {}
    players = []
    for pid, meta in player_meta.items():
        entry = dict(meta) if isinstance(meta, dict) else {}
        entry["player_id"] = pid
        players.append(entry)
    players.sort(key=lambda p: p.get("seat", 0))
    fresh_state = IncanGoldGame.init_game(config, players)
    state.clear()
    state.update(fresh_state)


def _card_view(card: Dict) -> Dict:
    return {
        "type": card.get("type"),
        "value": card.get("value"),
        "hazard": card.get("hazard"),
        "remainder": card.get("remainder", 0),
        "triggered": bool(card.get("triggered")),
    }


def _player_view(state: Dict, player_id: str) -> Dict:
    pdata = state["players"][player_id]
    total_score = int(pdata.get("banked_gems", 0)) + int(pdata.get("artifact_points", 0))
    return {
        "player_id": player_id,
        "banked_gems": pdata.get("banked_gems", 0),
        "hand_gems": pdata.get("hand_gems", 0),
        "status": pdata.get("status"),
        "artifact_count": pdata.get("artifact_count", 0),
        "artifact_points": pdata.get("artifact_points", 0),
        "total_score": total_score,
    }


class IncanGoldGame:
    game_id = "incan_gold"
    min_players = 3
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "banked_gems": 0,
                "hand_gems": 0,
                "status": "in_cave",
                "artifact_count": 0,
                "artifact_points": 0,
            }

        state = {
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "config": cfg,
            "base_deck": _build_base_deck(),
            "deck": [],
            "path_cards": [],
            "current_round": 1,
            "max_rounds": len(ARTIFACT_VALUES),
            "hazard_counts": {},
            "removed_hazards": {hazard: 0 for hazard in HAZARD_TYPES},
            "decisions": {},
            "round_end_reason": None,
            "round_end_hazard": None,
            "round_end_artifacts_removed": 0,
            "winner": None,
            "game_over": False,
            "phase": "decision",
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again"]
        phase = state.get("phase")
        if phase == "round_end":
            return ["next_round"]
        if phase != "decision":
            return []
        pdata = state["players"][player_id]
        if pdata.get("status") != "in_cave":
            return []
        if player_id in state.get("decisions", {}):
            return []
        return ["decide"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        if action_type == "play_again":
            if not state.get("game_over"):
                return [], "game not over"
            _reset_game_state(state)
            events.append({"type": "incan_gold:play_again", "payload": {"player_id": player_id}})
            return events, None

        if state.get("game_over"):
            return [], "game over"

        phase = state.get("phase")

        if action_type == "next_round":
            if phase != "round_end":
                return [], "invalid phase"
            if state.get("current_round", 1) >= state.get("max_rounds", len(ARTIFACT_VALUES)):
                return [], "game complete"
            state["current_round"] += 1
            _start_round(state, events)
            events.append({"type": "incan_gold:next_round", "payload": {"player_id": player_id}})
            return events, None

        if action_type == "decide":
            if phase != "decision":
                return [], "invalid phase"
            pdata = state["players"][player_id]
            if pdata.get("status") != "in_cave":
                return [], "not in cave"
            if player_id in state.get("decisions", {}):
                return [], "already decided"
            choice = action.get("choice")
            if choice not in ("continue", "leave"):
                return [], "invalid choice"
            state["decisions"][player_id] = choice
            events.append({"type": "incan_gold:decide", "payload": {"player_id": player_id, "choice": choice}})

            active_players = _players_in_cave(state)
            if active_players and all(pid in state["decisions"] for pid in active_players):
                _resolve_decisions(state, events)
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = state.get("turn_order", [])
        player_meta = state.get("player_meta", {})
        players_view = []
        for pid in player_ids:
            meta = player_meta.get(pid, {})
            entry = _player_view(state, pid)
            entry.update(
                {
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "decided": pid in state.get("decisions", {}),
                }
            )
            players_view.append(entry)

        decisions = state.get("decisions", {})
        decided_players = [pid for pid in player_ids if pid in decisions]
        active_players = _players_in_cave(state)

        return {
            "game_id": IncanGoldGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("current_round"),
            "max_rounds": state.get("max_rounds"),
            "deck_count": len(state.get("deck", [])),
            "path": [_card_view(card) for card in state.get("path_cards", [])],
            "players": players_view,
            "in_cave_count": len(active_players),
            "decided_count": len(decided_players),
            "your_decision": decisions.get(viewer_id),
            "round_end": {
                "reason": state.get("round_end_reason"),
                "hazard": state.get("round_end_hazard"),
                "artifacts_removed": state.get("round_end_artifacts_removed", 0),
            },
            "removed_hazards": dict(state.get("removed_hazards", {})),
            "hazard_counts": dict(state.get("hazard_counts", {})),
            "legal_actions": IncanGoldGame.get_legal_actions(state, viewer_id),
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
        phase = state.get("phase")
        if phase == "round_end":
            return {"type": "next_round"}
        if phase != "decision":
            return None
        pdata = state["players"][bot_id]
        if pdata.get("status") != "in_cave":
            return None
        if bot_id in state.get("decisions", {}):
            return None

        hand_gems = int(pdata.get("hand_gems", 0))
        hazard_counts = state.get("hazard_counts", {})
        hazards_seen = len([h for h in hazard_counts.values() if h])
        remaining_cards = len(state.get("deck", []))
        danger_types = [hazard for hazard, count in hazard_counts.items() if count >= 1]
        danger_cards = sum(
            1
            for card in state.get("deck", [])
            if card.get("type") == "hazard" and card.get("hazard") in danger_types
        )
        bust_prob = (danger_cards / remaining_cards) if remaining_cards > 0 else 1.0

        should_leave = False
        if hand_gems >= 20 or hazards_seen >= 3:
            should_leave = True
        elif hand_gems >= 12 and hazards_seen >= 2:
            should_leave = True
        elif hand_gems >= 8 and bust_prob >= 0.25:
            should_leave = True
        elif bust_prob >= 0.4:
            should_leave = True

        return {"type": "decide", "choice": "leave" if should_leave else "continue"}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
