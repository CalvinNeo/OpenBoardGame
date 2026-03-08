import random
from typing import Dict, List, Optional, Tuple

BIRD_CONFIGS = [
    {"id": "flamingo", "name": "火烈鸟", "count": 7, "small": 2, "big": 3, "rarity": "极稀有"},
    {"id": "owl", "name": "猫头鹰", "count": 10, "small": 3, "big": 4, "rarity": "稀有"},
    {"id": "toucan", "name": "大嘴鸟", "count": 10, "small": 3, "big": 4, "rarity": "稀有"},
    {"id": "duck", "name": "鸭子", "count": 10, "small": 3, "big": 4, "rarity": "稀有"},
    {"id": "pelican", "name": "鹈鹕", "count": 10, "small": 3, "big": 4, "rarity": "稀有"},
    {"id": "parrot", "name": "鹦鹉", "count": 13, "small": 4, "big": 6, "rarity": "普通"},
    {"id": "sparrow", "name": "麻雀", "count": 16, "small": 4, "big": 6, "rarity": "普通"},
    {"id": "magpie", "name": "喜鹊", "count": 20, "small": 5, "big": 7, "rarity": "常见"},
]

BIRD_IDS = [cfg["id"] for cfg in BIRD_CONFIGS]
BIRD_CONFIG_BY_ID = {cfg["id"]: cfg for cfg in BIRD_CONFIGS}

DEFAULT_CONFIG: Dict = {}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _build_deck() -> List[str]:
    deck: List[str] = []
    for cfg in BIRD_CONFIGS:
        deck.extend([cfg["id"]] * int(cfg["count"]))
    random.shuffle(deck)
    return deck


def _ensure_deck(state: Dict) -> None:
    if state["deck"]:
        return
    if not state["discard"]:
        return
    state["deck"] = list(state["discard"])
    state["discard"] = []
    random.shuffle(state["deck"])


def _reshuffle_deck(state: Dict) -> None:
    if state["discard"]:
        state["deck"].extend(state["discard"])
        state["discard"] = []
    random.shuffle(state["deck"])


def _draw_card(state: Dict) -> Optional[str]:
    _ensure_deck(state)
    if not state["deck"]:
        return None
    return state["deck"].pop()


def _draw_cards(state: Dict, count: int) -> List[str]:
    drawn: List[str] = []
    for _ in range(count):
        card = _draw_card(state)
        if card is None:
            break
        drawn.append(card)
    return drawn


def _deal_cards(state: Dict, player_id: str, count: int) -> int:
    drawn = _draw_cards(state, count)
    state["players"][player_id]["hand"].extend(drawn)
    return len(drawn)


def _setup_row(state: Dict) -> List[str]:
    row: List[str] = []
    seen = set()
    while len(seen) < 3:
        card = _draw_card(state)
        if card is None:
            break
        if card in seen:
            state["discard"].append(card)
            continue
        row.append(card)
        seen.add(card)
    return row


def _refill_row_until_different(state: Dict, row_index: int) -> None:
    row: List[str] = []
    first_type: Optional[str] = None
    while True:
        card = _draw_card(state)
        if card is None:
            break
        row.append(card)
        if first_type is None:
            first_type = card
            continue
        if card != first_type:
            break
    state["rows"][row_index] = row


def _refill_row_if_single_type(state: Dict, row_index: int) -> None:
    row = list(state["rows"][row_index])
    if not row:
        _refill_row_until_different(state, row_index)
        return
    first_type = row[0]
    if any(card != first_type for card in row):
        return
    while True:
        card = _draw_card(state)
        if card is None:
            break
        row.append(card)
        if card != first_type:
            break
    state["rows"][row_index] = row


def _next_player(state: Dict, current_id: Optional[str]) -> Optional[str]:
    order = state["turn_order"]
    if not order:
        return None
    if current_id not in order:
        return order[0]
    idx = order.index(current_id)
    return order[(idx + 1) % len(order)]


def _count_in_hand(hand: List[str]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for card in hand:
        counts[card] = counts.get(card, 0) + 1
    return counts


def _bankable_types(hand: List[str]) -> List[str]:
    counts = _count_in_hand(hand)
    bankable = []
    for bird_type, count in counts.items():
        cfg = BIRD_CONFIG_BY_ID.get(bird_type)
        if not cfg:
            continue
        if count >= int(cfg["small"]):
            bankable.append(bird_type)
    return bankable


def _check_win(collection: Dict[str, int]) -> bool:
    diversity = sum(1 for count in collection.values() if count >= 1) >= 7
    big_sets = sum(1 for count in collection.values() if count >= 3)
    return diversity or big_sets >= 2


def _format_last_action(action_type: str, payload: Dict) -> Dict:
    return {"type": action_type, **payload}


class FangNiaoGame:
    game_id = "fang_niao"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}
        state_players = {pid: {"hand": [], "collection": {}} for pid in player_ids}

        state = {
            "config": cfg,
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "current_turn": random.choice(player_ids) if player_ids else None,
            "phase": "lay",
            "rows": [],
            "deck": _build_deck(),
            "discard": [],
            "winner": None,
            "game_over": False,
            "last_action": None,
        }

        state["rows"] = [_setup_row(state) for _ in range(4)]

        for pid in player_ids:
            _deal_cards(state, pid, 8)
        for pid in player_ids:
            card = _draw_card(state)
            if card is None:
                continue
            collection = state["players"][pid]["collection"]
            collection[card] = collection.get(card, 0) + 1

        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_turn"):
            return []
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "lay":
            return ["play_birds"] if state["players"][player_id]["hand"] else []
        if phase == "bank":
            actions = ["end_turn"]
            if _bankable_types(state["players"][player_id]["hand"]):
                actions.insert(0, "bank_birds")
            return actions
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game is over"
        if player_id not in state.get("players", {}):
            return [], "player not found"
        if player_id != state.get("current_turn"):
            return [], "not your turn"

        action_type = action.get("type")
        if action_type == "play_birds":
            if state.get("phase") != "lay":
                return [], "not in lay phase"
            bird_type = action.get("bird_type")
            if bird_type not in BIRD_CONFIG_BY_ID:
                return [], "invalid bird type"
            try:
                row_index = int(action.get("row_index"))
            except (TypeError, ValueError):
                return [], "invalid row"
            if row_index < 0 or row_index >= len(state["rows"]):
                return [], "invalid row"
            side = action.get("side")
            if side not in ("left", "right"):
                return [], "invalid side"

            hand = state["players"][player_id]["hand"]
            cards_to_play = [card for card in hand if card == bird_type]
            if not cards_to_play:
                return [], "bird not in hand"
            state["players"][player_id]["hand"] = [card for card in hand if card != bird_type]

            row = state["rows"][row_index]
            match_index = -1
            if row:
                if side == "left":
                    for idx, card in enumerate(row):
                        if card == bird_type:
                            match_index = idx
                            break
                else:
                    for idx in range(len(row) - 1, -1, -1):
                        if row[idx] == bird_type:
                            match_index = idx
                            break

            captured_cards: List[str] = []
            if match_index >= 0:
                if side == "left":
                    captured_cards = row[:match_index]
                    if captured_cards:
                        row = cards_to_play + row[match_index:]
                    else:
                        row = cards_to_play + row
                else:
                    captured_cards = row[match_index + 1 :]
                    if captured_cards:
                        row = row[: match_index + 1] + cards_to_play
                    else:
                        row = row + cards_to_play
            else:
                row = cards_to_play + row if side == "left" else row + cards_to_play

            drew = 0
            if captured_cards:
                state["players"][player_id]["hand"].extend(captured_cards)
            else:
                drew = _deal_cards(state, player_id, 2)

            state["rows"][row_index] = row
            if not row:
                _refill_row_until_different(state, row_index)
            elif captured_cards:
                _refill_row_if_single_type(state, row_index)

            state["phase"] = "bank"
            state["last_action"] = _format_last_action(
                "play",
                {
                    "player_id": player_id,
                    "bird_type": bird_type,
                    "row_index": row_index,
                    "side": side,
                    "captured": len(captured_cards),
                    "drew": drew,
                },
            )
            return [], None

        if action_type == "bank_birds":
            if state.get("phase") != "bank":
                return [], "not in bank phase"
            bird_type = action.get("bird_type")
            if bird_type not in BIRD_CONFIG_BY_ID:
                return [], "invalid bird type"
            hand = state["players"][player_id]["hand"]
            count = sum(1 for card in hand if card == bird_type)
            cfg = BIRD_CONFIG_BY_ID[bird_type]
            small = int(cfg["small"])
            big = int(cfg["big"])
            if count < small:
                return [], "not enough birds to bank"
            keep = 2 if count >= big else 1
            state["players"][player_id]["hand"] = [card for card in hand if card != bird_type]
            collection = state["players"][player_id]["collection"]
            collection[bird_type] = collection.get(bird_type, 0) + keep
            if count > keep:
                state["discard"].extend([bird_type] * (count - keep))

            state["last_action"] = _format_last_action(
                "bank",
                {"player_id": player_id, "bird_type": bird_type, "kept": keep, "discarded": count - keep},
            )

            if _check_win(collection):
                state["game_over"] = True
                state["winner"] = player_id
                state["phase"] = "game_over"
            return [], None

        if action_type == "end_turn":
            if state.get("phase") != "bank":
                return [], "not in bank phase"
            pdata = state["players"][player_id]
            reset = False
            if len(pdata["hand"]) == 0:
                reset = True
                for pid, other in state["players"].items():
                    if pid == player_id:
                        continue
                    if other["hand"]:
                        state["discard"].extend(other["hand"])
                        other["hand"] = []
                _reshuffle_deck(state)
                for pid in state["turn_order"]:
                    _deal_cards(state, pid, 8)

            state["current_turn"] = _next_player(state, player_id)
            state["phase"] = "lay"
            state["last_action"] = _format_last_action(
                "end",
                {"player_id": player_id, "reset": reset},
            )
            return [], None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(
            state["player_meta"].keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "hand_count": len(pdata["hand"]),
                    "collection": dict(pdata["collection"]),
                }
            )

        viewer_data = state["players"].get(viewer_id, {"hand": [], "collection": {}})

        return {
            "game_id": FangNiaoGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_turn": state.get("current_turn"),
            "rows": state.get("rows", []),
            "deck_count": len(state.get("deck", [])),
            "discard_count": len(state.get("discard", [])),
            "players": players_view,
            "hand": list(viewer_data.get("hand", [])),
            "collection": dict(viewer_data.get("collection", {})),
            "legal_actions": FangNiaoGame.get_legal_actions(state, viewer_id),
            "bird_config": BIRD_CONFIGS,
            "bankable": _bankable_types(list(viewer_data.get("hand", []))),
            "last_action": state.get("last_action"),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "config": dict(state.get("config", {})),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id != state.get("current_turn"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        phase = state.get("phase")
        pdata = state["players"][bot_id]
        if phase == "lay":
            if not pdata["hand"]:
                return None
            bird_type = random.choice(pdata["hand"])
            row_index = random.randrange(len(state["rows"])) if state.get("rows") else 0
            side = random.choice(["left", "right"])
            return {"type": "play_birds", "bird_type": bird_type, "row_index": row_index, "side": side}
        if phase == "bank":
            bankable = _bankable_types(pdata["hand"])
            if bankable and random.random() < 0.7:
                bird_type = random.choice(bankable)
                return {"type": "bank_birds", "bird_type": bird_type}
            return {"type": "end_turn"}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
