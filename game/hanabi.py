import random
from typing import Dict, List, Optional, Tuple

COLORS = ["red", "yellow", "green", "blue", "white"]
RANKS = [1, 2, 3, 4, 5]
RANK_COUNTS = {
    1: 3,
    2: 2,
    3: 2,
    4: 2,
    5: 1,
}

MAX_CLUES = 8
MAX_FUSES = 3
MAX_LOG_ENTRIES = 50

COLOR_LABELS = {
    "red": "Red",
    "yellow": "Yellow",
    "green": "Green",
    "blue": "Blue",
    "white": "White",
}

DEFAULT_CONFIG: Dict = {}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _build_deck() -> List[Dict]:
    deck: List[Dict] = []
    for color in COLORS:
        for rank in RANKS:
            count = RANK_COUNTS[rank]
            for _ in range(count):
                deck.append({"color": color, "rank": rank})
    random.shuffle(deck)
    return deck


def _initial_hand_size(player_count: int) -> int:
    return 5 if player_count <= 3 else 4


def _init_knowledge() -> Dict:
    return {
        "known_color": None,
        "known_rank": None,
        "not_colors": [],
        "not_ranks": [],
    }


def _set_known_color(info: Dict, color: str) -> None:
    info["known_color"] = color
    info["not_colors"] = [c for c in COLORS if c != color]


def _set_known_rank(info: Dict, rank: int) -> None:
    info["known_rank"] = rank
    info["not_ranks"] = [r for r in RANKS if r != rank]


def _add_not_color(info: Dict, color: str) -> None:
    if info.get("known_color") == color:
        return
    not_colors = info.get("not_colors") or []
    if color not in not_colors:
        not_colors.append(color)
    info["not_colors"] = [c for c in COLORS if c in not_colors]


def _add_not_rank(info: Dict, rank: int) -> None:
    if info.get("known_rank") == rank:
        return
    not_ranks = info.get("not_ranks") or []
    if rank not in not_ranks:
        not_ranks.append(rank)
    info["not_ranks"] = sorted({r for r in not_ranks})


def _apply_clue(hand: List[Dict], knowledge: List[Dict], clue_type: str, value) -> List[int]:
    matched = []
    for idx, card in enumerate(hand):
        if clue_type == "color" and card["color"] == value:
            matched.append(idx)
        elif clue_type == "rank" and card["rank"] == value:
            matched.append(idx)
    if not matched:
        return []
    matched_set = set(matched)
    for idx, info in enumerate(knowledge):
        if idx in matched_set:
            if clue_type == "color":
                _set_known_color(info, value)
            else:
                _set_known_rank(info, int(value))
        else:
            if clue_type == "color":
                _add_not_color(info, value)
            else:
                _add_not_rank(info, int(value))
    return matched


def _advance_turn(state: Dict) -> None:
    order = state["turn_order"]
    if not order:
        state["current_turn"] = None
        return
    current = state.get("current_turn")
    if current not in order:
        state["current_turn"] = order[0]
        return
    idx = order.index(current)
    state["current_turn"] = order[(idx + 1) % len(order)]


def _calculate_score(state: Dict) -> int:
    return sum(int(value) for value in state["tableau"].values())


def _is_perfect(state: Dict) -> bool:
    return all(state["tableau"].get(color, 0) >= 5 for color in COLORS)


def _player_name(state: Dict, player_id: str) -> str:
    meta = state.get("player_meta", {}).get(player_id, {})
    return meta.get("name") or player_id


def _append_log(state: Dict, message: str) -> None:
    log = state.setdefault("log", [])
    log.append(message)
    if len(log) > MAX_LOG_ENTRIES:
        del log[:-MAX_LOG_ENTRIES]


def _set_game_over(state: Dict, reason: str) -> None:
    state["game_over"] = True
    state["end_reason"] = reason
    state["phase"] = "game_over"
    if reason == "defeat":
        _append_log(state, "Game over: defeat.")
    elif reason == "perfect":
        _append_log(state, "Perfect victory!")
    else:
        _append_log(state, "Game over: deck exhausted.")


def _maybe_end_game(state: Dict, triggered_last_round: bool) -> None:
    if state.get("game_over"):
        return
    if state["fuse_tokens"] <= 0:
        _set_game_over(state, "defeat")
        return
    if _is_perfect(state):
        _set_game_over(state, "perfect")
        return
    if state.get("final_rounds_remaining") is not None and not triggered_last_round:
        state["final_rounds_remaining"] -= 1
        if state["final_rounds_remaining"] <= 0:
            state["final_rounds_remaining"] = 0
            _set_game_over(state, "deck_exhausted")


def _build_discard_stats(discard_pile: List[Dict]) -> Dict:
    stats = {color: {rank: 0 for rank in RANKS} for color in COLORS}
    for card in discard_pile:
        color = card.get("color")
        rank = card.get("rank")
        if color in stats and rank in stats[color]:
            stats[color][rank] += 1
    return stats


class HanabiGame:
    game_id = "hanabi"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        deck = _build_deck()
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}
        hand_size = _initial_hand_size(len(player_ids))
        if len(deck) < hand_size * len(player_ids):
            raise ValueError("deck too small for player count")

        state_players = {}
        for pid in player_ids:
            hand = [deck.pop() for _ in range(hand_size)]
            knowledge = [_init_knowledge() for _ in hand]
            state_players[pid] = {"hand": hand, "knowledge": knowledge}

        start_player = random.choice(player_ids) if player_ids else None

        return {
            "deck": deck,
            "players": state_players,
            "turn_order": player_ids,
            "current_turn": start_player,
            "clue_tokens": MAX_CLUES,
            "fuse_tokens": MAX_FUSES,
            "tableau": {color: 0 for color in COLORS},
            "discard_pile": [],
            "final_rounds_remaining": None,
            "phase": "playing",
            "config": cfg,
            "player_meta": player_meta,
            "log": [],
            "end_reason": None,
            "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_turn"):
            return []
        actions = ["play"]
        if state["clue_tokens"] > 0 and len(state["turn_order"]) > 1:
            actions.append("give_clue")
        if state["clue_tokens"] < MAX_CLUES:
            actions.append("discard")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id != state.get("current_turn"):
            return [], "not your turn"
        pdata = state["players"].get(player_id)
        if not pdata:
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []
        triggered_last_round = False

        if action_type == "give_clue":
            if state["clue_tokens"] <= 0:
                return [], "no clue tokens"
            target_id = action.get("target_player_id")
            if not isinstance(target_id, str):
                return [], "invalid target"
            if target_id == player_id:
                return [], "cannot clue yourself"
            target = state["players"].get(target_id)
            if not target:
                return [], "target not found"
            clue_type = action.get("clue_type")
            value = action.get("value")
            if clue_type not in ("color", "rank"):
                return [], "invalid clue type"
            if clue_type == "color":
                if value not in COLORS:
                    return [], "invalid color"
            else:
                if not isinstance(value, int) or value not in RANKS:
                    return [], "invalid rank"
            matched = _apply_clue(target["hand"], target["knowledge"], clue_type, value)
            if not matched:
                return [], "clue value not in target hand"
            state["clue_tokens"] -= 1
            events.append(
                {
                    "type": "hanabi:clue",
                    "payload": {
                        "player_id": player_id,
                        "target_id": target_id,
                        "clue_type": clue_type,
                        "value": value,
                        "matched": matched,
                    },
                }
            )
            actor_name = _player_name(state, player_id)
            target_name = _player_name(state, target_id)
            if clue_type == "color":
                value_label = COLOR_LABELS.get(value, value)
                _append_log(state, f"{actor_name} hinted {target_name}: {value_label}.")
            else:
                _append_log(state, f"{actor_name} hinted {target_name}: {value}.")

        elif action_type == "discard":
            if state["clue_tokens"] >= MAX_CLUES:
                return [], "clue tokens already full"
            card_index = action.get("card_index")
            if not isinstance(card_index, int):
                return [], "invalid card index"
            hand = pdata["hand"]
            knowledge = pdata["knowledge"]
            if card_index < 0 or card_index >= len(hand):
                return [], "card index out of range"
            card = hand.pop(card_index)
            knowledge.pop(card_index)
            state["discard_pile"].append(card)
            state["clue_tokens"] = min(MAX_CLUES, state["clue_tokens"] + 1)

            events.append(
                {
                    "type": "hanabi:discard",
                    "payload": {
                        "player_id": player_id,
                        "card": {"color": card["color"], "rank": card["rank"]},
                    },
                }
            )
            actor_name = _player_name(state, player_id)
            card_label = f"{COLOR_LABELS.get(card['color'], card['color'])} {card['rank']}"
            _append_log(state, f"{actor_name} discarded {card_label}.")

            if state["deck"]:
                drawn = state["deck"].pop()
                hand.append(drawn)
                knowledge.append(_init_knowledge())
                if not state["deck"] and state.get("final_rounds_remaining") is None:
                    state["final_rounds_remaining"] = len(state["turn_order"]) - 1
                    triggered_last_round = True
                    _append_log(
                        state,
                        f"Deck empty: {state['final_rounds_remaining']} final turns remaining.",
                    )

        elif action_type == "play":
            card_index = action.get("card_index")
            if not isinstance(card_index, int):
                return [], "invalid card index"
            hand = pdata["hand"]
            knowledge = pdata["knowledge"]
            if card_index < 0 or card_index >= len(hand):
                return [], "card index out of range"
            card = hand.pop(card_index)
            knowledge.pop(card_index)
            color = card["color"]
            rank = card["rank"]
            current_rank = state["tableau"].get(color, 0)
            success = rank == current_rank + 1
            if success:
                state["tableau"][color] = rank
                if rank == 5 and state["clue_tokens"] < MAX_CLUES:
                    state["clue_tokens"] += 1
                events.append(
                    {
                        "type": "hanabi:play",
                        "payload": {
                            "player_id": player_id,
                            "card": {"color": color, "rank": rank},
                            "success": True,
                        },
                    }
                )
            else:
                state["discard_pile"].append(card)
                state["fuse_tokens"] -= 1
                events.append(
                    {
                        "type": "hanabi:misplay",
                        "payload": {
                            "player_id": player_id,
                            "card": {"color": color, "rank": rank},
                            "fuse_tokens": state["fuse_tokens"],
                        },
                    }
                )

            actor_name = _player_name(state, player_id)
            card_label = f"{COLOR_LABELS.get(color, color)} {rank}"
            if success:
                _append_log(state, f"{actor_name} played {card_label} successfully.")
            else:
                _append_log(state, f"{actor_name} misplayed {card_label}.")

            if state["deck"]:
                drawn = state["deck"].pop()
                hand.append(drawn)
                knowledge.append(_init_knowledge())
                if not state["deck"] and state.get("final_rounds_remaining") is None:
                    state["final_rounds_remaining"] = len(state["turn_order"]) - 1
                    triggered_last_round = True
                    _append_log(
                        state,
                        f"Deck empty: {state['final_rounds_remaining']} final turns remaining.",
                    )

        else:
            return [], "invalid action"

        _maybe_end_game(state, triggered_last_round)
        if not state.get("game_over"):
            _advance_turn(state)
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(
            state["player_meta"].keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        reveal_all = state.get("game_over", False)
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            hand_view = []
            for idx, card in enumerate(pdata["hand"]):
                info = pdata["knowledge"][idx]
                hidden = pid == viewer_id and not reveal_all
                hand_view.append(
                    {
                        "index": idx,
                        "color": None if hidden else card["color"],
                        "rank": None if hidden else card["rank"],
                        "hidden": hidden,
                        "known_color": info.get("known_color"),
                        "known_rank": info.get("known_rank"),
                        "not_colors": list(info.get("not_colors") or []),
                        "not_ranks": list(info.get("not_ranks") or []),
                    }
                )
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "hand": hand_view,
                    "hand_count": len(hand_view),
                }
            )

        score = _calculate_score(state)
        end_reason = state.get("end_reason")
        if end_reason == "defeat":
            score_display = f"0 Points (Standard Rules) / {score} Points (Current Board)"
            score_standard = 0
        else:
            score_display = f"{score} Points"
            score_standard = score

        return {
            "game_id": HanabiGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase", "playing"),
            "current_turn": state.get("current_turn"),
            "players": players_view,
            "clue_tokens": state["clue_tokens"],
            "fuse_tokens": state["fuse_tokens"],
            "max_clue_tokens": MAX_CLUES,
            "max_fuse_tokens": MAX_FUSES,
            "deck_count": len(state["deck"]),
            "tableau": dict(state["tableau"]),
            "discard_pile": list(state["discard_pile"]),
            "discard_stats": _build_discard_stats(state["discard_pile"]),
            "final_rounds_remaining": state.get("final_rounds_remaining"),
            "score": score,
            "score_standard": score_standard,
            "score_display": score_display,
            "end_reason": end_reason,
            "log": list(state.get("log") or []),
            "legal_actions": HanabiGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "config": {},
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id != state.get("current_turn"):
            return None
        if bot_id not in state.get("players", {}):
            return None

        other_players = [pid for pid in state["turn_order"] if pid != bot_id]
        if state["clue_tokens"] > 0 and other_players:
            target_id = random.choice(other_players)
            target_hand = state["players"][target_id]["hand"]
            if target_hand:
                card = random.choice(target_hand)
                if random.random() < 0.5:
                    return {
                        "type": "give_clue",
                        "target_player_id": target_id,
                        "clue_type": "color",
                        "value": card["color"],
                    }
                return {
                    "type": "give_clue",
                    "target_player_id": target_id,
                    "clue_type": "rank",
                    "value": card["rank"],
                }

        hand = state["players"][bot_id]["hand"]
        if not hand:
            return None
        card_index = random.randint(0, len(hand) - 1)
        if state["clue_tokens"] < MAX_CLUES and random.random() < 0.5:
            return {"type": "discard", "card_index": card_index}
        return {"type": "play", "card_index": card_index}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
