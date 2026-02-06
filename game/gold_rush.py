import random
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG = {
    "mode": "hand",
}

MAX_GOLD_CARDS = 6
STARTING_TOKENS = 3

MINE_CATALOG = [
    {"id": 0, "name": "Lion", "color": "red"},
    {"id": 1, "name": "Bear", "color": "brown"},
    {"id": 2, "name": "Horse", "color": "blue"},
    {"id": 3, "name": "Elephant", "color": "gray"},
    {"id": 4, "name": "Donkey", "color": "green"},
]

GOLD_CARD_COUNTS = {
    0: 10,
    1: 10,
    2: 10,
    3: 8,
    4: 6,
    5: 4,
    6: 2,
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    if cfg.get("mode") not in ("hand", "classic"):
        cfg["mode"] = DEFAULT_CONFIG["mode"]
    return cfg


def _mine_ids_for_players(player_count: int) -> List[int]:
    if player_count == 2:
        return [0, 1, 2]
    return [0, 1, 2, 3, 4]


def _build_mines(mine_ids: List[int]) -> List[Dict]:
    catalog = {mine["id"]: mine for mine in MINE_CATALOG}
    mines: List[Dict] = []
    for mine_id in mine_ids:
        meta = catalog[mine_id]
        mines.append(
            {
                "id": meta["id"],
                "name": meta["name"],
                "color": meta["color"],
                "miners": [],
                "gold": [],
                "tokens": {},
            }
        )
    return mines


def _build_deck(mine_ids: List[int]) -> List[Dict]:
    deck: List[Dict] = []
    for mine_id in mine_ids:
        for _ in range(10):
            deck.append({"type": "miner", "mine_id": mine_id})
    for value, count in GOLD_CARD_COUNTS.items():
        for _ in range(count):
            deck.append({"type": "gold", "value": value})
    random.shuffle(deck)
    return deck


def _mine_by_id(state: Dict, mine_id: int) -> Optional[Dict]:
    for mine in state.get("mines", []):
        if mine.get("id") == mine_id:
            return mine
    return None


def _mine_gold_total(mine: Dict) -> int:
    return sum(card.get("value", 0) for card in mine.get("gold", []))


def _available_mines(state: Dict) -> List[Dict]:
    return [mine for mine in state.get("mines", []) if len(mine.get("gold", [])) < MAX_GOLD_CARDS]


def _next_player(state: Dict, current: Optional[str]) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    if current not in order:
        return order[0]
    idx = order.index(current)
    return order[(idx + 1) % len(order)]


def _next_player_with_hand(state: Dict, current: Optional[str]) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    start_idx = order.index(current) if current in order else -1
    for offset in range(1, len(order) + 1):
        pid = order[(start_idx + offset) % len(order)]
        if state["players"][pid]["hand"]:
            return pid
    return None


def _should_end_game(state: Dict) -> bool:
    mode = state.get("config", {}).get("mode")
    if mode == "classic":
        return not state.get("deck")
    if state.get("deck"):
        return False
    return all(not pdata.get("hand") for pdata in state.get("players", {}).values())


def _sorted_player_ids(state: Dict, player_ids: List[str]) -> List[str]:
    meta = state.get("player_meta", {})
    return sorted(player_ids, key=lambda pid: meta.get(pid, {}).get("seat", 0))


def _finalize_game(state: Dict) -> None:
    for pdata in state["players"].values():
        pdata["score"] = 0
    breakdown = []
    player_ids = list(state.get("players", {}).keys())
    for mine in state.get("mines", []):
        total_gold = _mine_gold_total(mine)
        tokens = mine.get("tokens", {})
        total_tokens = sum(tokens.values())
        share = total_gold // total_tokens if total_tokens > 0 else 0
        gains = {}
        for pid in player_ids:
            gain = share * tokens.get(pid, 0)
            gains[pid] = gain
            state["players"][pid]["score"] += gain
        breakdown.append(
            {
                "mine_id": mine.get("id"),
                "mine_name": mine.get("name"),
                "total_gold": total_gold,
                "total_tokens": total_tokens,
                "share": share,
                "remainder": total_gold - share * total_tokens,
                "tokens_by_player": dict(tokens),
                "gains_by_player": gains,
            }
        )

    winners: List[str] = []
    if player_ids:
        scores = {pid: state["players"][pid]["score"] for pid in player_ids}
        max_score = max(scores.values())
        top_players = [pid for pid, score in scores.items() if score == max_score]
        if len(top_players) > 1:
            max_tokens = max(state["players"][pid]["tokens_available"] for pid in top_players)
            winners = [pid for pid in top_players if state["players"][pid]["tokens_available"] == max_tokens]
        else:
            winners = top_players

    state["winner"] = _sorted_player_ids(state, winners)
    state["score_breakdown"] = breakdown
    state["pending_card"] = None
    state["pending_mine_id"] = None
    state["game_over"] = True
    state["phase"] = "game_over"


def _finish_turn(state: Dict) -> bool:
    state["pending_card"] = None
    state["pending_mine_id"] = None
    state["phase"] = "turn"
    mode = state.get("config", {}).get("mode")
    current = state.get("current_turn")
    if mode == "hand" and current and state.get("deck"):
        state["players"][current]["hand"].append(state["deck"].pop())

    if _should_end_game(state):
        _finalize_game(state)
        return True

    if mode == "hand" and not state.get("deck"):
        next_player = _next_player_with_hand(state, current)
        if not next_player:
            _finalize_game(state)
            return True
        state["current_turn"] = next_player
    else:
        state["current_turn"] = _next_player(state, current)
    return False


def _reset_game_state(state: Dict) -> None:
    config = state.get("config") or {}
    player_meta = state.get("player_meta") or {}
    players = []
    for pid, meta in player_meta.items():
        entry = dict(meta) if isinstance(meta, dict) else {}
        entry["player_id"] = pid
        players.append(entry)
    players.sort(key=lambda p: p.get("seat", 0))
    fresh_state = GoldRushGame.init_game(config, players)
    state.clear()
    state.update(fresh_state)


def _mine_total_tokens(mine: Dict) -> int:
    return sum(mine.get("tokens", {}).values())


def _mine_majority_owner(mine: Dict) -> Optional[str]:
    tokens = mine.get("tokens", {})
    if not tokens:
        return None
    max_tokens = max(tokens.values())
    leaders = [pid for pid, count in tokens.items() if count == max_tokens and count > 0]
    if len(leaders) != 1:
        return None
    return leaders[0]


class GoldRushGame:
    game_id = "gold_rush"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}
        mine_ids = _mine_ids_for_players(len(player_ids))
        mines = _build_mines(mine_ids)
        deck = _build_deck(mine_ids)

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "hand": [],
                "tokens_available": STARTING_TOKENS,
                "score": 0,
            }

        if cfg["mode"] == "hand":
            for _ in range(3):
                for pid in player_ids:
                    if deck:
                        state_players[pid]["hand"].append(deck.pop())

        return {
            "deck": deck,
            "players": state_players,
            "turn_order": player_ids,
            "current_turn": player_ids[0] if player_ids else None,
            "phase": "turn",
            "mines": mines,
            "pending_card": None,
            "pending_mine_id": None,
            "config": cfg,
            "player_meta": player_meta,
            "max_gold_cards": MAX_GOLD_CARDS,
            "winner": [],
            "score_breakdown": None,
            "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again"]
        if player_id != state.get("current_turn"):
            return []

        phase = state.get("phase")
        mode = state.get("config", {}).get("mode")
        if phase == "turn":
            if mode == "hand":
                return ["play_card"] if state["players"][player_id]["hand"] else []
            return ["draw_card"] if state.get("deck") else []
        if phase == "awaiting_invest":
            if state["players"][player_id]["tokens_available"] > 0:
                return ["invest"]
            return []
        if phase == "awaiting_gold_placement":
            return ["place_gold"] if _available_mines(state) else []
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
            _reset_game_state(state)
            events.append({"type": "gold_rush:play_again", "payload": {"player_id": player_id}})
            return events, None

        if state.get("game_over"):
            return [], "game over"

        phase = state.get("phase")
        mode = state.get("config", {}).get("mode")

        if phase == "turn":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if mode == "hand":
                if action_type != "play_card":
                    return [], "play_card required"
                hand_index = action.get("hand_index")
                if not isinstance(hand_index, int):
                    return [], "invalid hand_index"
                hand = state["players"][player_id]["hand"]
                if hand_index < 0 or hand_index >= len(hand):
                    return [], "hand_index out of range"
                card = hand.pop(hand_index)
            else:
                if action_type != "draw_card":
                    return [], "draw_card required"
                if not state.get("deck"):
                    return [], "deck empty"
                card = state["deck"].pop()

            events.append({"type": "gold_rush:play_card", "payload": {"player_id": player_id, "card": card}})
            card_type = card.get("type")
            if card_type == "miner":
                mine_id = card.get("mine_id")
                mine = _mine_by_id(state, mine_id)
                if not mine:
                    return [], "invalid mine"
                mine["miners"].append(card)
                if state["players"][player_id]["tokens_available"] > 0:
                    state["pending_card"] = card
                    state["pending_mine_id"] = mine_id
                    state["phase"] = "awaiting_invest"
                    return events, None
                ended = _finish_turn(state)
                if ended:
                    events.append({"type": "gold_rush:game_over"})
                return events, None

            if card_type == "gold":
                if not _available_mines(state):
                    events.append({"type": "gold_rush:burn_gold", "payload": {"player_id": player_id, "card": card}})
                    ended = _finish_turn(state)
                    if ended:
                        events.append({"type": "gold_rush:game_over"})
                    return events, None
                state["pending_card"] = card
                state["pending_mine_id"] = None
                state["phase"] = "awaiting_gold_placement"
                return events, None
            return [], "invalid card"

        if phase == "awaiting_invest":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if action_type != "invest":
                return [], "invest required"
            invest_flag = action.get("invest")
            if not isinstance(invest_flag, bool):
                return [], "invalid invest flag"
            mine_id = state.get("pending_mine_id")
            mine = _mine_by_id(state, mine_id)
            if not mine:
                return [], "invalid pending mine"
            if invest_flag:
                if state["players"][player_id]["tokens_available"] <= 0:
                    return [], "no tokens available"
                state["players"][player_id]["tokens_available"] -= 1
                mine["tokens"][player_id] = mine["tokens"].get(player_id, 0) + 1
            events.append(
                {"type": "gold_rush:invest", "payload": {"player_id": player_id, "invest": invest_flag}}
            )
            ended = _finish_turn(state)
            if ended:
                events.append({"type": "gold_rush:game_over"})
            return events, None

        if phase == "awaiting_gold_placement":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if action_type != "place_gold":
                return [], "place_gold required"
            mine_id = action.get("mine_id")
            if not isinstance(mine_id, int):
                return [], "invalid mine_id"
            mine = _mine_by_id(state, mine_id)
            if not mine:
                return [], "invalid mine"
            if len(mine.get("gold", [])) >= MAX_GOLD_CARDS:
                return [], "mine full"
            card = state.get("pending_card")
            if not card or card.get("type") != "gold":
                return [], "no pending gold"
            mine["gold"].append(card)
            events.append({"type": "gold_rush:place_gold", "payload": {"player_id": player_id, "mine_id": mine_id}})
            ended = _finish_turn(state)
            if ended:
                events.append({"type": "gold_rush:game_over"})
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = _sorted_player_ids(state, list(state.get("player_meta", {}).keys()))
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            player_view = {
                "player_id": pid,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "is_bot": meta.get("is_bot"),
                "score": pdata.get("score", 0),
                "tokens_available": pdata.get("tokens_available", 0),
                "hand_count": len(pdata.get("hand", [])),
            }
            if pid == viewer_id:
                player_view["hand"] = list(pdata.get("hand", []))
            players_view.append(player_view)

        mines_view = []
        for mine in state.get("mines", []):
            tokens_by_player = dict(mine.get("tokens", {}))
            for pid in player_ids:
                tokens_by_player.setdefault(pid, 0)
            mines_view.append(
                {
                    "id": mine.get("id"),
                    "name": mine.get("name"),
                    "color": mine.get("color"),
                    "miners_count": len(mine.get("miners", [])),
                    "gold_count": len(mine.get("gold", [])),
                    "gold_total": _mine_gold_total(mine),
                    "tokens_by_player": tokens_by_player,
                }
            )

        return {
            "game_id": GoldRushGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_turn": state.get("current_turn"),
            "mode": state.get("config", {}).get("mode"),
            "deck_count": len(state.get("deck", [])),
            "max_gold_cards": state.get("max_gold_cards", MAX_GOLD_CARDS),
            "players": players_view,
            "mines": mines_view,
            "pending_card": state.get("pending_card"),
            "legal_actions": GoldRushGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "winner": state.get("winner"),
            "score_breakdown": state.get("score_breakdown"),
            "config": {"mode": state.get("config", {}).get("mode")},
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id != state.get("current_turn"):
            return None

        phase = state.get("phase")
        mode = state.get("config", {}).get("mode")
        if phase == "turn":
            if mode == "hand":
                hand = state["players"][bot_id]["hand"]
                if not hand:
                    return None
                return GoldRushGame._bot_choose_hand_card(state, bot_id, hand)
            if state.get("deck"):
                return {"type": "draw_card"}
            return None

        if phase == "awaiting_invest":
            mine_id = state.get("pending_mine_id")
            mine = _mine_by_id(state, mine_id) if mine_id is not None else None
            mine_total = _mine_gold_total(mine) if mine else 0
            deck_count = len(state.get("deck", []))
            tokens_available = state["players"][bot_id]["tokens_available"]
            invest = tokens_available > 0 and (mine_total >= 4 or deck_count < 10)
            return {"type": "invest", "invest": invest}

        if phase == "awaiting_gold_placement":
            card = state.get("pending_card") or {}
            value = card.get("value", 0)
            mine_id = GoldRushGame._bot_choose_gold_mine(state, bot_id, value)
            if mine_id is None:
                return None
            return {"type": "place_gold", "mine_id": mine_id}

        return None

    @staticmethod
    def _bot_choose_hand_card(state: Dict, bot_id: str, hand: List[Dict]) -> Optional[Dict]:
        mines = state.get("mines", [])
        non_full_mines = [mine for mine in mines if len(mine.get("gold", [])) < MAX_GOLD_CARDS]

        def majority_mine_ids() -> List[int]:
            ids = []
            for mine in non_full_mines:
                if _mine_majority_owner(mine) == bot_id:
                    ids.append(mine["id"])
            return ids

        def opponent_majority_mines() -> List[Dict]:
            result = []
            for mine in non_full_mines:
                leader = _mine_majority_owner(mine)
                if leader and leader != bot_id:
                    result.append(mine)
            return result

        majority_ids = majority_mine_ids()
        high_gold_cards = [(idx, card) for idx, card in enumerate(hand) if card.get("type") == "gold" and card.get("value", 0) >= 3]
        if high_gold_cards and majority_ids:
            idx, card = max(high_gold_cards, key=lambda item: item[1].get("value", 0))
            return {"type": "play_card", "hand_index": idx}

        miner_cards = [(idx, card) for idx, card in enumerate(hand) if card.get("type") == "miner"]
        if miner_cards:
            deck_count = len(state.get("deck", []))
            tokens_available = state["players"][bot_id]["tokens_available"]
            if tokens_available > 0:
                def miner_score(entry: Tuple[int, Dict]) -> int:
                    mine = _mine_by_id(state, entry[1].get("mine_id"))
                    return _mine_gold_total(mine) if mine else 0

                for idx, card in sorted(miner_cards, key=miner_score, reverse=True):
                    mine = _mine_by_id(state, card.get("mine_id"))
                    mine_total = _mine_gold_total(mine) if mine else 0
                    if mine_total >= 4 or deck_count < 10:
                        return {"type": "play_card", "hand_index": idx}

        low_gold_cards = [(idx, card) for idx, card in enumerate(hand) if card.get("type") == "gold" and card.get("value", 0) < 3]
        if low_gold_cards:
            block_targets = [
                mine for mine in opponent_majority_mines() if len(mine.get("gold", [])) >= 4
            ]
            if block_targets:
                idx, _ = min(low_gold_cards, key=lambda item: item[1].get("value", 0))
                return {"type": "play_card", "hand_index": idx}

        gold_cards = [(idx, card) for idx, card in enumerate(hand) if card.get("type") == "gold"]
        if gold_cards:
            idx, _ = min(gold_cards, key=lambda item: item[1].get("value", 0))
            return {"type": "play_card", "hand_index": idx}

        if miner_cards:
            return {"type": "play_card", "hand_index": miner_cards[0][0]}
        return None

    @staticmethod
    def _bot_choose_gold_mine(state: Dict, bot_id: str, value: int) -> Optional[int]:
        non_full = [mine for mine in state.get("mines", []) if len(mine.get("gold", [])) < MAX_GOLD_CARDS]
        if not non_full:
            return None

        def mine_score(mine: Dict) -> int:
            return _mine_gold_total(mine)

        if value >= 3:
            owned = [mine for mine in non_full if _mine_majority_owner(mine) == bot_id]
            if owned:
                return max(owned, key=mine_score)["id"]
            neutral = [mine for mine in non_full if _mine_total_tokens(mine) == 0]
            if neutral:
                return neutral[0]["id"]
            return non_full[0]["id"]

        opponent_majority = [
            mine
            for mine in non_full
            if _mine_majority_owner(mine) not in (None, bot_id) and len(mine.get("gold", [])) >= 4
        ]
        if opponent_majority:
            return max(opponent_majority, key=mine_score)["id"]
        neutral = [mine for mine in non_full if _mine_total_tokens(mine) == 0]
        if neutral:
            return neutral[0]["id"]
        return non_full[0]["id"]

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
