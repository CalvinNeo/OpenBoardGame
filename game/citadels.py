import random
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG = {
    "winning_city_size": 8,
}

CHARACTER_DEFINITIONS = {
    1: {"name_cn": "刺客", "name_en": "Assassin"},
    2: {"name_cn": "盗贼", "name_en": "Thief"},
    3: {"name_cn": "魔术师", "name_en": "Magician"},
    4: {"name_cn": "国王", "name_en": "King"},
    5: {"name_cn": "主教", "name_en": "Bishop"},
    6: {"name_cn": "商人", "name_en": "Merchant"},
    7: {"name_cn": "建筑师", "name_en": "Architect"},
    8: {"name_cn": "军阀", "name_en": "Warlord"},
    9: {"name_cn": "皇后", "name_en": "Queen"},
}

ROLE_TAX_COLORS = {
    4: "yellow",
    5: "blue",
    6: "green",
    8: "red",
}

COLOR_LABELS = {
    "yellow": "黄色",
    "blue": "蓝色",
    "green": "绿色",
    "red": "红色",
    "purple": "紫色",
}

DRAFT_CONFIG = {
    2: {"character_set": "classic8", "face_up": 0, "face_down": 1},
    3: {"character_set": "classic8", "face_up": 0, "face_down": 1},
    4: {"character_set": "classic8", "face_up": 2, "face_down": 1},
    5: {"character_set": "queen9", "face_up": 2, "face_down": 1},
    6: {"character_set": "queen9", "face_up": 1, "face_down": 1},
}

DISTRICT_LIBRARY = [
    {"name_cn": "神殿", "name_en": "Temple", "color": "blue", "cost": 1, "copies": 5, "text": ""},
    {"name_cn": "教堂", "name_en": "Church", "color": "blue", "cost": 2, "copies": 5, "text": ""},
    {"name_cn": "修道院", "name_en": "Monastery", "color": "blue", "cost": 3, "copies": 4, "text": ""},
    {"name_cn": "大教堂", "name_en": "Cathedral", "color": "blue", "cost": 5, "copies": 3, "text": ""},
    {"name_cn": "酒馆", "name_en": "Tavern", "color": "green", "cost": 1, "copies": 5, "text": ""},
    {"name_cn": "市场", "name_en": "Market", "color": "green", "cost": 2, "copies": 5, "text": ""},
    {"name_cn": "交易站", "name_en": "Trading Post", "color": "green", "cost": 2, "copies": 4, "text": ""},
    {"name_cn": "港口", "name_en": "Harbor", "color": "green", "cost": 4, "copies": 4, "text": ""},
    {"name_cn": "庄园", "name_en": "Manor", "color": "yellow", "cost": 3, "copies": 5, "text": ""},
    {"name_cn": "城堡", "name_en": "Castle", "color": "yellow", "cost": 4, "copies": 4, "text": ""},
    {"name_cn": "宫殿", "name_en": "Palace", "color": "yellow", "cost": 5, "copies": 3, "text": ""},
    {"name_cn": "市政厅", "name_en": "Town Hall", "color": "yellow", "cost": 5, "copies": 2, "text": ""},
    {"name_cn": "瞭望塔", "name_en": "Watchtower", "color": "red", "cost": 1, "copies": 5, "text": ""},
    {"name_cn": "监狱", "name_en": "Prison", "color": "red", "cost": 2, "copies": 4, "text": ""},
    {"name_cn": "兵营", "name_en": "Barracks", "color": "red", "cost": 3, "copies": 4, "text": ""},
    {"name_cn": "堡垒", "name_en": "Fortress", "color": "red", "cost": 5, "copies": 3, "text": ""},
    {
        "name_cn": "天文台",
        "name_en": "Observatory",
        "color": "purple",
        "cost": 5,
        "copies": 1,
        "text": "当前实现中无特殊效果。",
    },
    {
        "name_cn": "图书馆",
        "name_en": "Library",
        "color": "purple",
        "cost": 6,
        "copies": 1,
        "text": "当前实现中无特殊效果。",
    },
    {
        "name_cn": "实验室",
        "name_en": "Laboratory",
        "color": "purple",
        "cost": 5,
        "copies": 1,
        "text": "当前实现中无特殊效果。",
    },
    {
        "name_cn": "墓园",
        "name_en": "Graveyard",
        "color": "purple",
        "cost": 5,
        "copies": 1,
        "text": "当前实现中无特殊效果。",
    },
    {
        "name_cn": "铁匠铺",
        "name_en": "Smithy",
        "color": "purple",
        "cost": 5,
        "copies": 1,
        "text": "当前实现中无特殊效果。",
    },
    {
        "name_cn": "学堂",
        "name_en": "School of Magic",
        "color": "purple",
        "cost": 6,
        "copies": 1,
        "text": "计分时可视为任意一种颜色。",
        "counts_as_any_color": True,
    },
    {
        "name_cn": "大学",
        "name_en": "University",
        "color": "purple",
        "cost": 6,
        "copies": 1,
        "text": "计分时额外 +2。",
        "score_bonus": 2,
    },
    {
        "name_cn": "龙门客栈",
        "name_en": "Dragon Gate",
        "color": "purple",
        "cost": 6,
        "copies": 1,
        "text": "计分时额外 +2。",
        "score_bonus": 2,
    },
    {
        "name_cn": "城塞",
        "name_en": "Keep",
        "color": "purple",
        "cost": 3,
        "copies": 1,
        "text": "不能被军阀摧毁。",
        "protect_from_warlord": True,
    },
]


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        winning_city_size = config.get("winning_city_size")
        if winning_city_size in (7, 8):
            cfg["winning_city_size"] = int(winning_city_size)
    return cfg


def _role_name(rank: int) -> str:
    definition = CHARACTER_DEFINITIONS.get(rank, {})
    return definition.get("name_cn") or f"角色{rank}"


def _district_summary(card: Dict) -> Dict:
    return {
        "id": card["id"],
        "name_cn": card["name_cn"],
        "name_en": card["name_en"],
        "color": card["color"],
        "cost": card["cost"],
        "text": card.get("text", ""),
        "score_bonus": card.get("score_bonus", 0),
        "protect_from_warlord": bool(card.get("protect_from_warlord")),
        "counts_as_any_color": bool(card.get("counts_as_any_color")),
    }


def _build_district_deck() -> List[Dict]:
    deck: List[Dict] = []
    serial = 1
    for definition in DISTRICT_LIBRARY:
        for _ in range(int(definition["copies"])):
            deck.append(
                {
                    "id": f"district_{serial}",
                    "name_cn": definition["name_cn"],
                    "name_en": definition["name_en"],
                    "color": definition["color"],
                    "cost": int(definition["cost"]),
                    "text": definition.get("text", ""),
                    "score_bonus": int(definition.get("score_bonus", 0)),
                    "protect_from_warlord": bool(definition.get("protect_from_warlord")),
                    "counts_as_any_color": bool(definition.get("counts_as_any_color")),
                }
            )
            serial += 1
    random.shuffle(deck)
    return deck


def _draw_cards(state: Dict, count: int) -> List[Dict]:
    cards: List[Dict] = []
    deck = state["district_deck"]
    for _ in range(max(0, count)):
        if not deck:
            break
        cards.append(deck.pop())
    return cards


def _return_cards_to_bottom(state: Dict, cards: List[Dict]) -> None:
    if not cards:
        return
    state["district_deck"] = list(cards) + state["district_deck"]


def _player_order(players: List[Dict]) -> List[Dict]:
    return sorted(players, key=lambda item: item.get("seat", 0))


def _seat_neighbors(order: List[str], player_id: str) -> List[str]:
    if player_id not in order or len(order) <= 1:
        return []
    idx = order.index(player_id)
    return [
        order[(idx - 1) % len(order)],
        order[(idx + 1) % len(order)],
    ]


def _log(state: Dict, message: str) -> None:
    public_log = state.setdefault("public_log", [])
    public_log.append(message)
    if len(public_log) > 60:
        del public_log[:-60]


def _get_character_mode(player_count: int) -> str:
    return DRAFT_CONFIG[int(player_count)]["character_set"]


def _max_rank_for_mode(mode: str) -> int:
    return 9 if mode == "queen9" else 8


def _build_draft_steps(player_order: List[str]) -> List[Dict]:
    count = len(player_order)
    if count == 2:
        return [
            {"player_id": player_order[0], "discard_after": 0},
            {"player_id": player_order[1], "discard_after": 1},
            {"player_id": player_order[0], "discard_after": 1},
            {"player_id": player_order[1], "discard_after": 1},
        ]
    if count == 3:
        return [
            {"player_id": player_order[0], "discard_after": 0},
            {"player_id": player_order[1], "discard_after": 0},
            {"player_id": player_order[2], "discard_after": 0},
            {"player_id": player_order[0], "discard_after": 0},
            {"player_id": player_order[1], "discard_after": 0},
            {"player_id": player_order[2], "discard_after": 1},
        ]
    steps = [{"player_id": pid, "discard_after": 0} for pid in player_order]
    if steps:
        steps[-1]["discard_after"] = 1
    return steps


def _remove_face_up_role(pool: List[int]) -> Optional[int]:
    choices = [rank for rank in pool if rank != 4]
    if not choices:
        return None
    chosen = random.choice(choices)
    pool.remove(chosen)
    return chosen


def _start_round(state: Dict) -> None:
    player_count = len(state["turn_order"])
    draft_cfg = DRAFT_CONFIG[player_count]
    character_mode = _get_character_mode(player_count)
    max_rank = _max_rank_for_mode(character_mode)
    pool = list(range(1, max_rank + 1))
    random.shuffle(pool)

    face_up_removed: List[int] = []
    hidden_removed: List[int] = []
    for _ in range(int(draft_cfg["face_up"])):
        role = _remove_face_up_role(pool)
        if role is not None:
            face_up_removed.append(role)
    for _ in range(int(draft_cfg["face_down"])):
        if pool:
            hidden_removed.append(pool.pop())

    crown_holder = state["crown_holder"]
    order = list(state["turn_order"])
    if crown_holder not in order and order:
        crown_holder = order[0]
        state["crown_holder"] = crown_holder
    crown_index = order.index(crown_holder) if crown_holder in order else 0
    draft_order = order[crown_index:] + order[:crown_index]
    draft_steps = _build_draft_steps(draft_order)

    for pid in order:
        state["players"][pid]["chosen_ranks"] = []
        state["players"][pid]["revealed_ranks"] = []

    state["phase"] = "draft"
    state["character_mode"] = character_mode
    state["max_rank"] = max_rank
    state["draft_state"] = {
        "pool": list(pool),
        "current_player": draft_steps[0]["player_id"] if draft_steps else None,
        "steps": draft_steps,
        "step_index": 0,
        "face_up_removed": sorted(face_up_removed),
        "hidden_removed": list(hidden_removed),
    }
    state["turn_rank"] = 1
    state["active_turn"] = None
    state["killed_rank"] = None
    state["robbed_rank"] = None
    state["thief_player_id"] = None
    state["queen_deferred_player_id"] = None
    state["destroyed_districts"] = state.get("destroyed_districts", [])

    if face_up_removed:
        names = ", ".join(_role_name(rank) for rank in sorted(face_up_removed))
        _log(state, f"Round {state['round']} draft starts. Face-up removed: {names}.")
    else:
        _log(state, f"Round {state['round']} draft starts.")


def _get_rank_owner(state: Dict, rank: int) -> Optional[str]:
    for pid in state["turn_order"]:
        if rank in state["players"][pid]["chosen_ranks"]:
            return pid
    return None


def _build_limit_for_rank(rank: int) -> int:
    return 3 if rank == 7 else 1


def _tax_amount_for_player(state: Dict, player_id: str, rank: int) -> int:
    color = ROLE_TAX_COLORS.get(rank)
    if not color:
        return 0
    return sum(1 for card in state["players"][player_id]["city"] if card["color"] == color)


def _player_has_completed_city(state: Dict, player_id: str) -> bool:
    target = int(state["config"]["winning_city_size"])
    return len(state["players"][player_id]["city"]) >= target


def _trigger_queen_bonus_if_needed(state: Dict, player_id: str) -> None:
    king_owner = _get_rank_owner(state, 4)
    if not king_owner:
        return
    if king_owner not in _seat_neighbors(state["turn_order"], player_id):
        return
    if state.get("killed_rank") == 4:
        state["queen_deferred_player_id"] = player_id
        _log(state, "皇后与国王相邻，但国王已被刺杀，3 金将在回合结束时结算。")
        return
    state["players"][player_id]["gold"] += 3
    _log(state, f"{state['player_meta'][player_id]['name']} 的皇后因紧邻国王获得 3 金。")


def _start_role_turn(state: Dict, player_id: str, rank: int) -> None:
    player = state["players"][player_id]
    if rank not in player["revealed_ranks"]:
        player["revealed_ranks"].append(rank)

    if state.get("robbed_rank") == rank:
        thief_player_id = state.get("thief_player_id")
        if thief_player_id and thief_player_id in state["players"] and thief_player_id != player_id:
            amount = player["gold"]
            if amount > 0:
                player["gold"] = 0
                state["players"][thief_player_id]["gold"] += amount
                thief_name = state["player_meta"][thief_player_id]["name"]
                victim_name = state["player_meta"][player_id]["name"]
                _log(state, f"盗贼从 {victim_name} 处偷走了 {amount} 金，交给 {thief_name}。")

    state["active_turn"] = {
        "player_id": player_id,
        "rank": rank,
        "step": "choose_income",
        "collected_tax": False,
        "ability_used": False,
        "builds_used": 0,
        "build_limit": _build_limit_for_rank(rank),
        "draw_offer": [],
    }
    _log(state, f"{state['player_meta'][player_id]['name']} 揭示了 {_role_name(rank)}。")
    if rank == 9:
        _trigger_queen_bonus_if_needed(state, player_id)


def _finish_active_turn(state: Dict) -> None:
    if not state.get("active_turn"):
        return
    state["turn_rank"] = int(state["turn_rank"]) + 1
    state["active_turn"] = None
    _advance_turn_sequence(state)


def _apply_post_income_bonuses(state: Dict, player_id: str, rank: int) -> None:
    if rank == 6:
        state["players"][player_id]["gold"] += 1
        _log(state, f"{state['player_meta'][player_id]['name']} 的商人额外获得 1 金。")
    if rank == 7:
        cards = _draw_cards(state, 2)
        state["players"][player_id]["hand"].extend(cards)
        if cards:
            _log(state, f"{state['player_meta'][player_id]['name']} 的建筑师额外抽了 {len(cards)} 张牌。")


def _resolve_income_choice(state: Dict, choice: str) -> Optional[str]:
    active_turn = state.get("active_turn")
    if not active_turn or active_turn.get("step") != "choose_income":
        return "income not pending"
    player_id = active_turn["player_id"]
    rank = active_turn["rank"]
    if choice == "gold":
        state["players"][player_id]["gold"] += 2
        _log(state, f"{state['player_meta'][player_id]['name']} 选择拿 2 金。")
        _apply_post_income_bonuses(state, player_id, rank)
        active_turn["step"] = "main"
        return None
    if choice != "cards":
        return "invalid income choice"

    cards = _draw_cards(state, 2)
    if not cards:
        _log(state, f"{state['player_meta'][player_id]['name']} 选择摸牌，但牌库为空。")
        _apply_post_income_bonuses(state, player_id, rank)
        active_turn["step"] = "main"
        return None
    if len(cards) == 1:
        state["players"][player_id]["hand"].extend(cards)
        _log(state, f"{state['player_meta'][player_id]['name']} 抽到 1 张牌并直接收入手牌。")
        _apply_post_income_bonuses(state, player_id, rank)
        active_turn["step"] = "main"
        return None

    active_turn["step"] = "choose_draw"
    active_turn["draw_offer"] = cards
    _log(state, f"{state['player_meta'][player_id]['name']} 需要从 2 张牌中留 1 张。")
    return None


def _resolve_draw_pick(state: Dict, card_id: str) -> Optional[str]:
    active_turn = state.get("active_turn")
    if not active_turn or active_turn.get("step") != "choose_draw":
        return "draw choice not pending"
    draw_offer = list(active_turn.get("draw_offer", []))
    chosen = next((card for card in draw_offer if card["id"] == card_id), None)
    if not chosen:
        return "card not offered"
    remaining = [card for card in draw_offer if card["id"] != card_id]
    player_id = active_turn["player_id"]
    state["players"][player_id]["hand"].append(chosen)
    _return_cards_to_bottom(state, remaining)
    active_turn["draw_offer"] = []
    active_turn["step"] = "main"
    _log(state, f"{state['player_meta'][player_id]['name']} 留下了 {chosen['name_cn']}。")
    _apply_post_income_bonuses(state, player_id, active_turn["rank"])
    return None


def _begin_scoring(state: Dict) -> None:
    scores: Dict[str, Dict] = {}
    winning_city_size = int(state["config"]["winning_city_size"])
    for pid in state["turn_order"]:
        city = list(state["players"][pid]["city"])
        base_score = sum(card["cost"] for card in city)
        real_colors = {card["color"] for card in city}
        has_any_color_wild = any(card.get("counts_as_any_color") for card in city)
        full_color_bonus = 3 if len(real_colors) >= 5 or (has_any_color_wild and len(real_colors) >= 4) else 0
        completion_bonus = 0
        if len(city) >= winning_city_size:
            if pid == state.get("first_completed_city_player_id"):
                completion_bonus = 4
            else:
                completion_bonus = 2
        district_bonus = sum(int(card.get("score_bonus", 0)) for card in city)
        total_score = base_score + full_color_bonus + completion_bonus + district_bonus
        scores[pid] = {
            "base_score": base_score,
            "full_color_bonus": full_color_bonus,
            "completion_bonus": completion_bonus,
            "district_bonus": district_bonus,
            "total_score": total_score,
            "highest_revealed_rank": max(state["players"][pid]["revealed_ranks"] or [0]),
        }
    max_total = max((entry["total_score"] for entry in scores.values()), default=0)
    finalists = [pid for pid, entry in scores.items() if entry["total_score"] == max_total]
    if len(finalists) > 1:
        max_base = max(scores[pid]["base_score"] for pid in finalists)
        finalists = [pid for pid in finalists if scores[pid]["base_score"] == max_base]
    if len(finalists) > 1:
        max_rank = max(scores[pid]["highest_revealed_rank"] for pid in finalists)
        finalists = [pid for pid in finalists if scores[pid]["highest_revealed_rank"] == max_rank]

    state["scores"] = scores
    state["winner_ids"] = finalists
    state["game_over"] = True
    state["phase"] = "game_over"
    names = ", ".join(state["player_meta"][pid]["name"] for pid in finalists)
    _log(state, f"Game over. Winner: {names}.")


def _finish_round(state: Dict) -> None:
    killed_rank = state.get("killed_rank")
    if killed_rank:
        owner = _get_rank_owner(state, int(killed_rank))
        if owner:
            _log(state, f"本轮被刺杀的角色是 {_role_name(int(killed_rank))}。")

    deferred_player = state.get("queen_deferred_player_id")
    if deferred_player:
        king_owner = _get_rank_owner(state, 4)
        if king_owner and king_owner in _seat_neighbors(state["turn_order"], deferred_player):
            state["players"][deferred_player]["gold"] += 3
            _log(state, f"{state['player_meta'][deferred_player]['name']} 的皇后在回合结束时补发 3 金。")
        state["queen_deferred_player_id"] = None

    king_owner = _get_rank_owner(state, 4)
    if king_owner:
        state["crown_holder"] = king_owner
        _log(state, f"{state['player_meta'][king_owner]['name']} 获得了下轮皇冠。")

    if state.get("first_completed_city_player_id"):
        _begin_scoring(state)
        return

    state["round"] += 1
    _start_round(state)


def _advance_turn_sequence(state: Dict) -> None:
    while True:
        rank = int(state.get("turn_rank", 1))
        if rank > int(state.get("max_rank", 8)):
            _finish_round(state)
            return
        owner = _get_rank_owner(state, rank)
        if owner is None:
            _log(state, f"{_role_name(rank)} 不在本轮。")
            state["turn_rank"] = rank + 1
            continue
        if state.get("killed_rank") == rank:
            _log(state, f"{_role_name(rank)} 已被刺杀，跳过。")
            state["turn_rank"] = rank + 1
            continue
        state["phase"] = "turn"
        _start_role_turn(state, owner, rank)
        return


def _complete_draft_if_needed(state: Dict) -> None:
    draft_state = state.get("draft_state") or {}
    steps = draft_state.get("steps") or []
    if draft_state.get("step_index", 0) < len(steps):
        next_step = steps[draft_state["step_index"]]
        draft_state["current_player"] = next_step["player_id"]
        return
    draft_state["current_player"] = None
    state["phase"] = "turn"
    state["turn_rank"] = 1
    state["active_turn"] = None
    _log(state, "Draft complete. Reveal order begins.")
    _advance_turn_sequence(state)


def _can_build_card(player: Dict, card: Dict) -> bool:
    if player["gold"] < int(card["cost"]):
        return False
    return not any(built["name_cn"] == card["name_cn"] for built in player["city"])


def _resolve_build(state: Dict, card_id: str) -> Optional[str]:
    active_turn = state.get("active_turn")
    if not active_turn or active_turn.get("step") != "main":
        return "cannot build now"
    player_id = active_turn["player_id"]
    player = state["players"][player_id]
    if active_turn["builds_used"] >= active_turn["build_limit"]:
        return "build limit reached"
    card = next((entry for entry in player["hand"] if entry["id"] == card_id), None)
    if not card:
        return "card not in hand"
    if not _can_build_card(player, card):
        return "cannot build selected card"
    player["hand"] = [entry for entry in player["hand"] if entry["id"] != card_id]
    player["gold"] -= int(card["cost"])
    player["city"].append(card)
    active_turn["builds_used"] += 1
    _log(state, f"{state['player_meta'][player_id]['name']} 建造了 {card['name_cn']}。")
    if state.get("first_completed_city_player_id") is None and _player_has_completed_city(state, player_id):
        state["first_completed_city_player_id"] = player_id
        _log(state, f"{state['player_meta'][player_id]['name']} 率先完成城市。")
    return None


def _resolve_collect_tax(state: Dict) -> Optional[str]:
    active_turn = state.get("active_turn")
    if not active_turn or active_turn.get("step") != "main":
        return "cannot collect tax now"
    rank = active_turn["rank"]
    player_id = active_turn["player_id"]
    if rank not in ROLE_TAX_COLORS:
        return "role cannot collect tax"
    if active_turn.get("collected_tax"):
        return "tax already collected"
    amount = _tax_amount_for_player(state, player_id, rank)
    state["players"][player_id]["gold"] += amount
    active_turn["collected_tax"] = True
    _log(
        state,
        f"{state['player_meta'][player_id]['name']} 以 {_role_name(rank)} 收取了 {amount} 金税收。",
    )
    return None


def _resolve_assassin(state: Dict, target_rank: int) -> Optional[str]:
    active_turn = state.get("active_turn")
    if not active_turn or active_turn.get("rank") != 1 or active_turn.get("step") != "main":
        return "assassin not available"
    if active_turn.get("ability_used"):
        return "ability already used"
    if not isinstance(target_rank, int):
        return "invalid target"
    if target_rank < 2 or target_rank > int(state["max_rank"]):
        return "invalid target"
    state["killed_rank"] = target_rank
    active_turn["ability_used"] = True
    _log(state, f"刺客宣布暗杀 {_role_name(target_rank)}。")
    return None


def _resolve_thief(state: Dict, target_rank: int) -> Optional[str]:
    active_turn = state.get("active_turn")
    if not active_turn or active_turn.get("rank") != 2 or active_turn.get("step") != "main":
        return "thief not available"
    if active_turn.get("ability_used"):
        return "ability already used"
    if not isinstance(target_rank, int):
        return "invalid target"
    if target_rank < 3 or target_rank > int(state["max_rank"]):
        return "invalid target"
    if state.get("killed_rank") == target_rank:
        return "cannot rob assassinated role"
    state["robbed_rank"] = target_rank
    state["thief_player_id"] = active_turn["player_id"]
    active_turn["ability_used"] = True
    _log(state, f"盗贼宣布偷窃 {_role_name(target_rank)}。")
    return None


def _resolve_magician_swap(state: Dict, target_player_id: str) -> Optional[str]:
    active_turn = state.get("active_turn")
    if not active_turn or active_turn.get("rank") != 3 or active_turn.get("step") != "main":
        return "magician not available"
    if active_turn.get("ability_used"):
        return "ability already used"
    player_id = active_turn["player_id"]
    if target_player_id == player_id or target_player_id not in state["players"]:
        return "invalid target player"
    state["players"][player_id]["hand"], state["players"][target_player_id]["hand"] = (
        state["players"][target_player_id]["hand"],
        state["players"][player_id]["hand"],
    )
    active_turn["ability_used"] = True
    _log(
        state,
        f"{state['player_meta'][player_id]['name']} 与 {state['player_meta'][target_player_id]['name']} 交换了手牌。",
    )
    return None


def _resolve_magician_redraw(state: Dict, card_ids: List[str]) -> Optional[str]:
    active_turn = state.get("active_turn")
    if not active_turn or active_turn.get("rank") != 3 or active_turn.get("step") != "main":
        return "magician not available"
    if active_turn.get("ability_used"):
        return "ability already used"
    if not isinstance(card_ids, list) or not card_ids:
        return "must select cards"
    player_id = active_turn["player_id"]
    hand = state["players"][player_id]["hand"]
    unique_ids = set(card_ids)
    redraw_cards = [card for card in hand if card["id"] in unique_ids]
    if len(redraw_cards) != len(unique_ids):
        return "card not in hand"
    state["players"][player_id]["hand"] = [card for card in hand if card["id"] not in unique_ids]
    _return_cards_to_bottom(state, redraw_cards)
    new_cards = _draw_cards(state, len(redraw_cards))
    state["players"][player_id]["hand"].extend(new_cards)
    active_turn["ability_used"] = True
    _log(
        state,
        f"{state['player_meta'][player_id]['name']} 以魔术师重抽了 {len(redraw_cards)} 张牌。",
    )
    return None


def _warlord_destroy_targets(state: Dict, player_id: str) -> List[Dict]:
    active_turn = state.get("active_turn")
    if not active_turn or active_turn.get("rank") != 8 or active_turn.get("step") != "main":
        return []
    targets: List[Dict] = []
    warlord_gold = int(state["players"][player_id]["gold"])
    for target_player_id in state["turn_order"]:
        if _player_has_completed_city(state, target_player_id):
            continue
        if 5 in state["players"][target_player_id]["chosen_ranks"] and state.get("killed_rank") != 5:
            continue
        for district in state["players"][target_player_id]["city"]:
            if district.get("protect_from_warlord"):
                continue
            destroy_cost = max(0, int(district["cost"]) - 1)
            if warlord_gold < destroy_cost:
                continue
            targets.append(
                {
                    "player_id": target_player_id,
                    "district_id": district["id"],
                    "destroy_cost": destroy_cost,
                    "name_cn": district["name_cn"],
                }
            )
    return targets


def _resolve_warlord_destroy(state: Dict, target_player_id: str, district_id: str) -> Optional[str]:
    active_turn = state.get("active_turn")
    if not active_turn or active_turn.get("rank") != 8 or active_turn.get("step") != "main":
        return "warlord not available"
    if active_turn.get("ability_used"):
        return "ability already used"
    player_id = active_turn["player_id"]
    target_options = _warlord_destroy_targets(state, player_id)
    target = next(
        (
            item
            for item in target_options
            if item["player_id"] == target_player_id and item["district_id"] == district_id
        ),
        None,
    )
    if not target:
        return "invalid destroy target"
    target_player = state["players"][target_player_id]
    district = next((card for card in target_player["city"] if card["id"] == district_id), None)
    if not district:
        return "district not found"
    destroy_cost = int(target["destroy_cost"])
    state["players"][player_id]["gold"] -= destroy_cost
    target_player["city"] = [card for card in target_player["city"] if card["id"] != district_id]
    state.setdefault("destroyed_districts", []).append(district)
    active_turn["ability_used"] = True
    _log(
        state,
        f"{state['player_meta'][player_id]['name']} 用军阀摧毁了 "
        f"{state['player_meta'][target_player_id]['name']} 的 {district['name_cn']}。",
    )
    return None


def _apply_draft_pick(state: Dict, player_id: str, rank: int) -> Optional[str]:
    draft_state = state.get("draft_state")
    if not isinstance(draft_state, dict):
        return "draft not active"
    if draft_state.get("current_player") != player_id:
        return "not your draft turn"
    pool = draft_state.get("pool", [])
    if rank not in pool:
        return "rank not available"
    pool.remove(rank)
    state["players"][player_id]["chosen_ranks"].append(rank)
    _log(state, f"{state['player_meta'][player_id]['name']} 选定了一个角色。")

    steps = draft_state["steps"]
    step = steps[draft_state["step_index"]]
    discard_after = int(step.get("discard_after", 0))
    for _ in range(discard_after):
        if not pool:
            break
        removed = random.choice(pool)
        pool.remove(removed)
        draft_state["hidden_removed"].append(removed)
    draft_state["step_index"] += 1
    _complete_draft_if_needed(state)
    return None


def _summarize_players_for_view(state: Dict, viewer_id: str) -> List[Dict]:
    players_view: List[Dict] = []
    for pid in state["turn_order"]:
        player = state["players"][pid]
        meta = state["player_meta"][pid]
        revealed_ranks = sorted(player["revealed_ranks"])
        hidden_role_count = max(0, len(player["chosen_ranks"]) - len(revealed_ranks))
        players_view.append(
            {
                "player_id": pid,
                "name": meta["name"],
                "seat": meta["seat"],
                "gold": player["gold"],
                "hand_count": len(player["hand"]),
                "city_count": len(player["city"]),
                "city": [_district_summary(card) for card in player["city"]],
                "revealed_roles": [{"rank": rank, "name_cn": _role_name(rank)} for rank in revealed_ranks],
                "hidden_role_count": hidden_role_count if pid != viewer_id else 0,
                "your_hidden_roles": [
                    {"rank": rank, "name_cn": _role_name(rank), "revealed": rank in revealed_ranks}
                    for rank in player["chosen_ranks"]
                ]
                if pid == viewer_id
                else [],
                "has_crown": pid == state.get("crown_holder"),
                "completed_city": _player_has_completed_city(state, pid),
                "score": state.get("scores", {}).get(pid, {}).get("total_score"),
            }
        )
    return players_view


def _build_action_options(state: Dict, viewer_id: str) -> Dict:
    options = {
        "draft_roles": [],
        "assassin_targets": [],
        "thief_targets": [],
        "magician_swap_targets": [],
        "destroy_targets": [],
    }
    legal = CitadelsGame.get_legal_actions(state, viewer_id)
    if "draft_character" in legal:
        pool = state.get("draft_state", {}).get("pool", [])
        options["draft_roles"] = [{"rank": rank, "name_cn": _role_name(rank)} for rank in sorted(pool)]

    active_turn = state.get("active_turn")
    if not isinstance(active_turn, dict) or active_turn.get("player_id") != viewer_id:
        return options

    rank = active_turn["rank"]
    if rank == 1 and not active_turn.get("ability_used"):
        options["assassin_targets"] = [
            {"rank": target_rank, "name_cn": _role_name(target_rank)}
            for target_rank in range(2, int(state["max_rank"]) + 1)
        ]
    if rank == 2 and not active_turn.get("ability_used"):
        options["thief_targets"] = [
            {"rank": target_rank, "name_cn": _role_name(target_rank)}
            for target_rank in range(3, int(state["max_rank"]) + 1)
            if target_rank != state.get("killed_rank")
        ]
    if rank == 3 and not active_turn.get("ability_used"):
        options["magician_swap_targets"] = [
            {"player_id": pid, "name": state["player_meta"][pid]["name"]}
            for pid in state["turn_order"]
            if pid != viewer_id
        ]
    if rank == 8 and not active_turn.get("ability_used"):
        options["destroy_targets"] = [
            {
                **entry,
                "player_name": state["player_meta"][entry["player_id"]]["name"],
            }
            for entry in _warlord_destroy_targets(state, viewer_id)
        ]
    return options


class CitadelsGame:
    game_id = "citadels"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        ordered_players = _player_order(players)
        player_ids = [player["player_id"] for player in ordered_players]
        if len(player_ids) < CitadelsGame.min_players or len(player_ids) > CitadelsGame.max_players:
            raise ValueError("invalid player count")
        cfg = _merge_config(config)
        deck = _build_district_deck()
        player_meta = {player["player_id"]: player for player in ordered_players}
        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "gold": 2,
                "hand": _draw_cards({"district_deck": deck}, 4),
                "city": [],
                "chosen_ranks": [],
                "revealed_ranks": [],
            }
        crown_holder = random.choice(player_ids)
        state = {
            "config": cfg,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "players": state_players,
            "district_deck": deck,
            "phase": "draft",
            "round": 1,
            "crown_holder": crown_holder,
            "character_mode": _get_character_mode(len(player_ids)),
            "max_rank": _max_rank_for_mode(_get_character_mode(len(player_ids))),
            "turn_rank": 1,
            "active_turn": None,
            "draft_state": {},
            "killed_rank": None,
            "robbed_rank": None,
            "thief_player_id": None,
            "queen_deferred_player_id": None,
            "first_completed_city_player_id": None,
            "scores": {},
            "winner_ids": [],
            "public_log": [],
            "destroyed_districts": [],
            "game_over": False,
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        if state.get("phase") == "draft":
            draft_state = state.get("draft_state", {})
            if draft_state.get("current_player") == player_id:
                return ["draft_character"]
            return []

        active_turn = state.get("active_turn")
        if not isinstance(active_turn, dict) or active_turn.get("player_id") != player_id:
            return []

        step = active_turn.get("step")
        if step == "choose_income":
            return ["choose_income"]
        if step == "choose_draw":
            return ["choose_draw"]
        if step != "main":
            return []

        legal = ["end_turn"]
        rank = active_turn["rank"]
        player = state["players"][player_id]
        if rank in ROLE_TAX_COLORS and not active_turn.get("collected_tax"):
            legal.append("collect_tax")
        if active_turn["builds_used"] < active_turn["build_limit"] and any(
            _can_build_card(player, card) for card in player["hand"]
        ):
            legal.append("build")
        if rank == 1 and not active_turn.get("ability_used"):
            legal.append("use_assassin")
        elif rank == 2 and not active_turn.get("ability_used"):
            legal.append("use_thief")
        elif rank == 3 and not active_turn.get("ability_used"):
            if len(state["turn_order"]) > 1:
                legal.append("magician_swap")
            if player["hand"]:
                legal.append("magician_redraw")
        elif rank == 8 and not active_turn.get("ability_used") and _warlord_destroy_targets(state, player_id):
            legal.append("destroy_district")
        return legal

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict):
            return [], "invalid action"

        action_type = action.get("type")
        error: Optional[str] = None

        if state.get("phase") == "draft":
            if action_type != "draft_character":
                return [], "invalid draft action"
            rank = action.get("rank")
            if not isinstance(rank, int):
                return [], "invalid rank"
            error = _apply_draft_pick(state, player_id, rank)
            return [], error

        active_turn = state.get("active_turn")
        if not isinstance(active_turn, dict) or active_turn.get("player_id") != player_id:
            return [], "not your turn"

        if action_type == "choose_income":
            choice = action.get("choice")
            if not isinstance(choice, str):
                return [], "invalid choice"
            error = _resolve_income_choice(state, choice)
        elif action_type == "choose_draw":
            card_id = action.get("card_id")
            if not isinstance(card_id, str):
                return [], "invalid card_id"
            error = _resolve_draw_pick(state, card_id)
        elif action_type == "collect_tax":
            error = _resolve_collect_tax(state)
        elif action_type == "use_assassin":
            error = _resolve_assassin(state, action.get("target_rank"))
        elif action_type == "use_thief":
            error = _resolve_thief(state, action.get("target_rank"))
        elif action_type == "magician_swap":
            target_player_id = action.get("target_player_id")
            if not isinstance(target_player_id, str):
                return [], "invalid target_player_id"
            error = _resolve_magician_swap(state, target_player_id)
        elif action_type == "magician_redraw":
            card_ids = action.get("card_ids")
            error = _resolve_magician_redraw(state, card_ids)
        elif action_type == "build":
            card_id = action.get("card_id")
            if not isinstance(card_id, str):
                return [], "invalid card_id"
            error = _resolve_build(state, card_id)
        elif action_type == "destroy_district":
            target_player_id = action.get("target_player_id")
            district_id = action.get("district_id")
            if not isinstance(target_player_id, str) or not isinstance(district_id, str):
                return [], "invalid destroy target"
            error = _resolve_warlord_destroy(state, target_player_id, district_id)
        elif action_type == "end_turn":
            if active_turn.get("step") != "main":
                return [], "turn not ready to end"
            _finish_active_turn(state)
        else:
            return [], "invalid action"

        return [], error

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        draft_state = state.get("draft_state", {})
        active_turn = state.get("active_turn")
        viewer_hand = [_district_summary(card) for card in state["players"][viewer_id]["hand"]]
        your_roles = [
            {
                "rank": rank,
                "name_cn": _role_name(rank),
                "revealed": rank in state["players"][viewer_id]["revealed_ranks"],
            }
            for rank in state["players"][viewer_id]["chosen_ranks"]
        ]

        view = {
            "game_id": CitadelsGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "character_mode": state.get("character_mode"),
            "max_rank": state.get("max_rank"),
            "crown_holder": state.get("crown_holder"),
            "crown_holder_name": state["player_meta"].get(state.get("crown_holder"), {}).get("name"),
            "turn_rank": state.get("turn_rank"),
            "current_drafter": draft_state.get("current_player"),
            "current_turn_player": active_turn.get("player_id") if isinstance(active_turn, dict) else None,
            "current_turn_role": {
                "rank": active_turn["rank"],
                "name_cn": _role_name(active_turn["rank"]),
                "step": active_turn["step"],
                "builds_used": active_turn["builds_used"],
                "build_limit": active_turn["build_limit"],
                "collected_tax": active_turn["collected_tax"],
                "ability_used": active_turn["ability_used"],
                "draw_offer": [_district_summary(card) for card in active_turn.get("draw_offer", [])],
            }
            if isinstance(active_turn, dict)
            else None,
            "draft_face_up_removed": [
                {"rank": rank, "name_cn": _role_name(rank)}
                for rank in sorted(draft_state.get("face_up_removed", []))
            ],
            "players": _summarize_players_for_view(state, viewer_id),
            "your_hand": viewer_hand,
            "your_roles": your_roles,
            "legal_actions": CitadelsGame.get_legal_actions(state, viewer_id),
            "action_options": _build_action_options(state, viewer_id),
            "first_completed_city_player_id": state.get("first_completed_city_player_id"),
            "first_completed_city_name": state["player_meta"]
            .get(state.get("first_completed_city_player_id"), {})
            .get("name"),
            "winning_city_size": state["config"]["winning_city_size"],
            "recent_log": list(state.get("public_log", [])[-15:]),
            "scores": state.get("scores", {}),
            "winner_ids": list(state.get("winner_ids", [])),
            "game_over": bool(state.get("game_over")),
        }
        return view

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
