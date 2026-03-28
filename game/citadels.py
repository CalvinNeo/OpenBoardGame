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


def _player_city_value(state: Dict, player_id: str) -> int:
    city = state["players"][player_id]["city"]
    return len(city) * 10 + sum(int(card["cost"]) for card in city)


def _role_slots_per_player(state: Dict) -> int:
    return 2 if len(state["turn_order"]) <= 3 else 1


def _public_known_role_owner(state: Dict, viewer_id: str, rank: int) -> Optional[str]:
    for player_id in state["turn_order"]:
        if rank in state["players"][player_id]["revealed_ranks"]:
            return player_id
    viewer_roles = state["players"].get(viewer_id, {}).get("chosen_ranks", [])
    if rank in viewer_roles:
        return viewer_id
    return None


def _public_hidden_role_slots(state: Dict, viewer_id: str) -> Dict[str, int]:
    slots: Dict[str, int] = {}
    default_slots = _role_slots_per_player(state)
    for player_id in state["turn_order"]:
        revealed_count = len(state["players"][player_id]["revealed_ranks"])
        if player_id == viewer_id:
            total_known = len(state["players"][player_id].get("chosen_ranks", []))
            slots[player_id] = max(0, total_known - revealed_count)
        else:
            slots[player_id] = max(0, default_slots - revealed_count)
    return slots


def _public_hidden_role_ranks(state: Dict, viewer_id: str) -> List[int]:
    hidden_ranks: List[int] = []
    face_up_removed = set(state.get("draft_state", {}).get("face_up_removed", []))
    for rank in range(1, int(state["max_rank"]) + 1):
        if rank in face_up_removed:
            continue
        if _public_known_role_owner(state, viewer_id, rank) is not None:
            continue
        hidden_ranks.append(rank)
    return hidden_ranks


def _public_possible_role_holders(state: Dict, viewer_id: str, rank: int) -> List[str]:
    if rank in set(state.get("draft_state", {}).get("face_up_removed", [])):
        return []
    known_owner = _public_known_role_owner(state, viewer_id, rank)
    if known_owner is not None:
        return [known_owner]
    hidden_slots = _public_hidden_role_slots(state, viewer_id)
    viewer_hidden_roles = set(
        rank_value
        for rank_value in state["players"].get(viewer_id, {}).get("chosen_ranks", [])
        if rank_value not in state["players"].get(viewer_id, {}).get("revealed_ranks", [])
    )
    holders: List[str] = []
    for player_id in state["turn_order"]:
        if hidden_slots.get(player_id, 0) <= 0:
            continue
        if player_id == viewer_id:
            if rank in viewer_hidden_roles:
                return [viewer_id]
            continue
        holders.append(player_id)
    return holders


def _public_role_in_play_prior(state: Dict, viewer_id: str, rank: int) -> float:
    known_owner = _public_known_role_owner(state, viewer_id, rank)
    if known_owner is not None:
        return 1.0
    holders = _public_possible_role_holders(state, viewer_id, rank)
    if not holders:
        return 0.0
    hidden_ranks = _public_hidden_role_ranks(state, viewer_id)
    total_hidden_slots = sum(_public_hidden_role_slots(state, viewer_id).values())
    if not hidden_ranks:
        return 0.0
    return min(1.0, total_hidden_slots / max(1, len(hidden_ranks)))


def _is_city_color_complete_with_card(state: Dict, player_id: str, card: Dict) -> bool:
    colors = {district["color"] for district in state["players"][player_id]["city"]}
    if card["counts_as_any_color"]:
        return len(colors) >= 4
    colors.add(card["color"])
    return len(colors) >= 5


def _district_keep_score(state: Dict, player_id: str, card: Dict, rank: Optional[int] = None) -> int:
    player = state["players"][player_id]
    city = player["city"]
    score = int(card["cost"]) * 4
    score += int(card.get("score_bonus", 0)) * 8
    if card.get("counts_as_any_color"):
        score += 8
    if card.get("protect_from_warlord"):
        score += 6
    existing_colors = {district["color"] for district in city}
    if card["color"] not in existing_colors:
        score += 5
    if _is_city_color_complete_with_card(state, player_id, card):
        score += 12
    if len(city) + 1 >= int(state["config"]["winning_city_size"]):
        score += 30
    elif len(city) + 1 == int(state["config"]["winning_city_size"]) - 1:
        score += 10
    if rank in ROLE_TAX_COLORS and ROLE_TAX_COLORS[rank] == card["color"]:
        score += 6
    return score


def _district_build_score(state: Dict, player_id: str, card: Dict, rank: Optional[int] = None) -> int:
    player = state["players"][player_id]
    active_turn = state.get("active_turn") or {}
    score = _district_keep_score(state, player_id, card, rank) + 10
    remaining_gold = int(player["gold"]) - int(card["cost"])
    remaining_builds = int(active_turn.get("build_limit", 1)) - int(active_turn.get("builds_used", 0)) - 1
    if remaining_builds > 0:
        other_cards = [entry for entry in player["hand"] if entry["id"] != card["id"]]
        if any(
            not any(built["name_cn"] == entry["name_cn"] for built in player["city"] + [card])
            and entry["cost"] <= remaining_gold
            for entry in other_cards
        ):
            score += 8
    if remaining_gold == 0:
        score += 1
    return score


def _best_buildable_card(state: Dict, player_id: str, rank: Optional[int] = None) -> Optional[Dict]:
    player = state["players"][player_id]
    buildable = [card for card in player["hand"] if _can_build_card(player, card)]
    if not buildable:
        return None
    return max(
        buildable,
        key=lambda card: (
            _district_build_score(state, player_id, card, rank),
            int(card["cost"]),
            card["name_cn"],
        ),
    )


def _best_tax_matching_build(state: Dict, player_id: str, rank: int) -> Optional[Dict]:
    tax_color = ROLE_TAX_COLORS.get(rank)
    if not tax_color:
        return None
    player = state["players"][player_id]
    matching = [
        card
        for card in player["hand"]
        if card["color"] == tax_color and _can_build_card(player, card)
    ]
    if not matching:
        return None
    return max(
        matching,
        key=lambda card: (
            _district_build_score(state, player_id, card, rank),
            int(card["cost"]),
            card["name_cn"],
        ),
    )


def _best_draw_choice(state: Dict, player_id: str, offered_cards: List[Dict], rank: Optional[int] = None) -> Optional[Dict]:
    if not offered_cards:
        return None
    return max(
        offered_cards,
        key=lambda card: (
            _district_keep_score(state, player_id, card, rank),
            int(card["cost"]),
            card["name_cn"],
        ),
    )


def _draft_role_score(state: Dict, player_id: str, rank: int) -> int:
    player = state["players"][player_id]
    hand = player["hand"]
    city = player["city"]
    gold = int(player["gold"])
    winning_city_size = int(state["config"]["winning_city_size"])
    city_count = len(city)
    matching_tax = sum(1 for card in city if card["color"] == ROLE_TAX_COLORS.get(rank))
    affordable_count = sum(1 for card in hand if _can_build_card(player, card))
    other_players = [pid for pid in state["turn_order"] if pid != player_id]
    highest_other_city = max((len(state["players"][pid]["city"]) for pid in other_players), default=0)
    highest_other_gold = max((int(state["players"][pid]["gold"]) for pid in other_players), default=0)

    base_scores = {
        1: 74,
        2: 76,
        3: 73,
        4: 82,
        5: 78,
        6: 84,
        7: 88,
        8: 80,
        9: 68,
    }
    score = base_scores.get(rank, 50)
    score += matching_tax * 6

    if rank == 1 and highest_other_city >= winning_city_size - 1:
        score += 18
    if rank == 2:
        score += highest_other_gold * 2
    if rank == 3:
        if len(hand) <= 2:
            score += 12
        if max((len(state["players"][pid]["hand"]) for pid in other_players), default=0) >= len(hand) + 2:
            score += 10
    if rank == 4:
        if player_id != state.get("crown_holder"):
            score += 8
        if city_count >= winning_city_size - 2:
            score += 8
    if rank == 5 and city_count >= winning_city_size - 1:
        score += 12
    if rank == 6:
        if gold < 3:
            score += 7
        if affordable_count > 0:
            score += 4
    if rank == 7:
        score += affordable_count * 5
        if len(hand) <= 3:
            score += 8
        if city_count >= winning_city_size - 2:
            score += 10
    if rank == 8:
        score += 10 if highest_other_city >= winning_city_size - 1 else 0
        score += 8 if any(len(state["players"][pid]["city"]) > city_count for pid in other_players) else 0
    if rank == 9 and len(state["turn_order"]) >= 5:
        if state.get("crown_holder") in _seat_neighbors(state["turn_order"], player_id):
            score += 6

    return score


def _best_draft_rank(state: Dict, player_id: str) -> Optional[int]:
    pool = list(state.get("draft_state", {}).get("pool", []))
    if not pool:
        return None
    return max(
        pool,
        key=lambda rank: (
            _draft_role_score(state, player_id, rank),
            -rank,
        ),
    )


def _public_role_interest_score(state: Dict, player_id: str, rank: int) -> int:
    player = state["players"][player_id]
    city = player["city"]
    city_count = len(city)
    gold = int(player["gold"])
    hand_count = len(player["hand"])
    winning_city_size = int(state["config"]["winning_city_size"])
    matching_tax = sum(1 for card in city if card["color"] == ROLE_TAX_COLORS.get(rank))
    highest_other_city = max(
        (len(state["players"][pid]["city"]) for pid in state["turn_order"] if pid != player_id),
        default=0,
    )

    base = {
        1: 60,
        2: 58,
        3: 46,
        4: 54,
        5: 48,
        6: 56,
        7: 64,
        8: 55,
        9: 42,
    }.get(rank, 40)
    score = base + matching_tax * 10

    if rank == 1 and highest_other_city >= winning_city_size - 1:
        score += 12
    if rank == 2:
        richest_other = max(
            (int(state["players"][pid]["gold"]) for pid in state["turn_order"] if pid != player_id),
            default=0,
        )
        score += richest_other * 2
        if gold <= 2:
            score += 6
    if rank == 3:
        if hand_count <= 2:
            score += 10
        if hand_count == 0:
            score += 12
    if rank == 4:
        if player_id != state.get("crown_holder"):
            score += 8
        if city_count >= winning_city_size - 2:
            score += 5
    if rank == 5:
        if city_count >= winning_city_size - 1:
            score += 14
    if rank == 6:
        if gold <= 3:
            score += 8
        if hand_count >= 2:
            score += 4
    if rank == 7:
        score += hand_count * 4
        if city_count >= winning_city_size - 2:
            score += 16
    if rank == 8:
        score += gold * 3
        if highest_other_city >= winning_city_size - 1:
            score += 14
    if rank == 9 and len(state["turn_order"]) >= 5:
        if state.get("crown_holder") in _seat_neighbors(state["turn_order"], player_id):
            score += 12

    return score


def _public_holder_threat_score(state: Dict, player_id: str) -> int:
    player = state["players"][player_id]
    return (
        len(player["city"]) * 14
        + int(player["gold"]) * 3
        + len(player["hand"]) * 2
    )


def _assassin_target_rank_score(state: Dict, viewer_id: str, target_rank: int) -> float:
    candidates = _public_possible_role_holders(state, viewer_id, target_rank)
    candidates = [player_id for player_id in candidates if player_id != viewer_id]
    if not candidates:
        return -1.0
    role_threat = {
        2: 48,
        3: 56,
        4: 82,
        5: 74,
        6: 88,
        7: 92,
        8: 84,
        9: 68,
    }.get(target_rank, 40)
    best_holder_score = max(
        _public_role_interest_score(state, player_id, target_rank) + _public_holder_threat_score(state, player_id)
        for player_id in candidates
    )
    prior = _public_role_in_play_prior(state, viewer_id, target_rank)
    return prior * (role_threat + best_holder_score)


def _best_assassin_target(state: Dict, viewer_id: str) -> Optional[int]:
    candidates = list(range(2, int(state["max_rank"]) + 1))
    if not candidates:
        return None
    viable = [
        (rank, _assassin_target_rank_score(state, viewer_id, rank))
        for rank in candidates
    ]
    viable = [entry for entry in viable if entry[1] >= 0]
    if not viable:
        return None
    return max(viable, key=lambda entry: (entry[1], -entry[0]))[0]


def _best_thief_target(state: Dict, viewer_id: str) -> Optional[int]:
    candidates = [
        rank
        for rank in range(3, int(state["max_rank"]) + 1)
        if rank != state.get("killed_rank")
    ]
    if not candidates:
        return None

    def rank_score(rank: int) -> float:
        holders = [player_id for player_id in _public_possible_role_holders(state, viewer_id, rank) if player_id != viewer_id]
        if not holders:
            return -1.0
        prior = _public_role_in_play_prior(state, viewer_id, rank)
        base = {
            3: 50,
            4: 78,
            5: 60,
            6: 90,
            7: 86,
            8: 76,
            9: 72,
        }.get(rank, 40)
        richest_holder_estimate = max(
            int(state["players"][player_id]["gold"]) * 5
            + _public_role_interest_score(state, player_id, rank)
            + _public_holder_threat_score(state, player_id)
            for player_id in holders
        )
        return prior * (base + richest_holder_estimate)

    viable = [(rank, rank_score(rank)) for rank in candidates]
    viable = [entry for entry in viable if entry[1] >= 0]
    if not viable:
        return None
    return max(viable, key=lambda entry: (entry[1], -entry[0]))[0]


def _best_magician_action(state: Dict, player_id: str) -> Optional[Dict]:
    player = state["players"][player_id]
    hand = list(player["hand"])
    buildable_cards = [card for card in hand if _can_build_card(player, card)]
    other_players = [pid for pid in state["turn_order"] if pid != player_id]
    if other_players:
        swap_target = max(other_players, key=lambda pid: len(state["players"][pid]["hand"]))
        swap_target_hand = len(state["players"][swap_target]["hand"])
        if (not hand and swap_target_hand > 0) or (swap_target_hand >= len(hand) + 2 and not buildable_cards):
            return {"type": "magician_swap", "target_player_id": swap_target}

    redraw_candidates = sorted(
        hand,
        key=lambda card: (
            _district_keep_score(state, player_id, card),
            int(card["cost"]),
            card["name_cn"],
        ),
    )
    if redraw_candidates and (not buildable_cards or len(hand) >= 4):
        redraw_count = 0
        redraw_ids: List[str] = []
        for card in redraw_candidates:
            if redraw_count >= 3:
                break
            is_unbuildable = card["cost"] > int(player["gold"])
            low_value = _district_keep_score(state, player_id, card) <= 18
            if is_unbuildable or low_value or not buildable_cards:
                redraw_ids.append(card["id"])
                redraw_count += 1
        if redraw_ids:
            return {"type": "magician_redraw", "card_ids": redraw_ids}
    return None


def _best_destroy_target(state: Dict, player_id: str) -> Optional[Dict]:
    targets = _warlord_destroy_targets(state, player_id)
    if not targets:
        return None
    winning_city_size = int(state["config"]["winning_city_size"])

    def target_score(target: Dict) -> int:
        target_player_id = target["player_id"]
        city_count = len(state["players"][target_player_id]["city"])
        district = next(
            (card for card in state["players"][target_player_id]["city"] if card["id"] == target["district_id"]),
            None,
        )
        district_cost = int(district["cost"]) if district else 0
        score = _player_city_value(state, target_player_id)
        score += district_cost * 4
        score -= int(target["destroy_cost"]) * 3
        if city_count >= winning_city_size - 1:
            score += 30
        if target_player_id != player_id:
            score += 4
        return score

    return max(
        targets,
        key=lambda target: (
            target_score(target),
            -int(target["destroy_cost"]),
            target["name_cn"],
        ),
    )


def _choose_income_for_bot(state: Dict, player_id: str, rank: int) -> str:
    player = state["players"][player_id]
    hand = player["hand"]
    buildable_now = [card for card in hand if _can_build_card(player, card)]
    if rank == 7:
        if buildable_now and len(hand) >= 2:
            return "gold"
        return "cards"
    if len(hand) <= 1:
        return "cards"
    if any(int(card["cost"]) <= int(player["gold"]) + 2 for card in hand):
        return "gold"
    if not buildable_now and len(hand) >= 3:
        return "cards"
    if buildable_now and len(player["city"]) >= int(state["config"]["winning_city_size"]) - 2:
        return "gold"
    return "cards" if len(hand) <= 2 else "gold"


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
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None

        if state.get("phase") == "draft":
            draft_state = state.get("draft_state") or {}
            if draft_state.get("current_player") != bot_id:
                return None
            rank = _best_draft_rank(state, bot_id)
            if rank is None:
                return None
            return {"type": "draft_character", "rank": rank}

        active_turn = state.get("active_turn")
        if not isinstance(active_turn, dict) or active_turn.get("player_id") != bot_id:
            return None

        rank = int(active_turn["rank"])
        step = active_turn.get("step")
        if step == "choose_income":
            return {"type": "choose_income", "choice": _choose_income_for_bot(state, bot_id, rank)}
        if step == "choose_draw":
            best_card = _best_draw_choice(state, bot_id, list(active_turn.get("draw_offer", [])), rank)
            if not best_card:
                return None
            return {"type": "choose_draw", "card_id": best_card["id"]}
        if step != "main":
            return None

        legal = set(CitadelsGame.get_legal_actions(state, bot_id))
        if "use_assassin" in legal:
            target_rank = _best_assassin_target(state, bot_id)
            if target_rank is not None:
                return {"type": "use_assassin", "target_rank": target_rank}
        if "use_thief" in legal:
            target_rank = _best_thief_target(state, bot_id)
            if target_rank is not None:
                return {"type": "use_thief", "target_rank": target_rank}

        if rank == 3 and not active_turn.get("ability_used") and "build" not in legal:
            magician_action = _best_magician_action(state, bot_id)
            if magician_action:
                return magician_action

        tax_build = _best_tax_matching_build(state, bot_id, rank)
        if tax_build and "build" in legal and "collect_tax" in legal and not active_turn.get("collected_tax"):
            return {"type": "build", "card_id": tax_build["id"]}

        if "collect_tax" in legal:
            return {"type": "collect_tax"}

        if "destroy_district" in legal:
            destroy_target = _best_destroy_target(state, bot_id)
            if destroy_target:
                return {
                    "type": "destroy_district",
                    "target_player_id": destroy_target["player_id"],
                    "district_id": destroy_target["district_id"],
                }

        if "build" in legal:
            best_build = _best_buildable_card(state, bot_id, rank)
            if best_build:
                return {"type": "build", "card_id": best_build["id"]}

        if rank == 3 and not active_turn.get("ability_used"):
            magician_action = _best_magician_action(state, bot_id)
            if magician_action:
                return magician_action

        if "end_turn" in legal:
            return {"type": "end_turn"}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
