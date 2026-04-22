import random
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG = {
    "rounds_per_guesser": 1,
}

CATEGORY_LABELS = {
    "player": "玩家",
    "number": "数字",
    "creature": "生物",
    "food": "食物",
    "item": "物品",
    "celebrity": "名人",
}

QUESTION_POOL = {
    "player": [
        "如果今天必须把在场一个人派去和外星人谈判，大家最可能派谁？",
        "如果所有人都要去荒岛生活一个月，谁最可能第一天就想回家？",
        "如果在场的人要组偶像团体，谁最像会抢 C 位？",
        "如果必须选一个人来假装是你多年好友，谁最像真的能骗过别人？",
        "如果今晚突然停电，谁最像会立刻开始讲鬼故事？",
        "如果大家一起创业，谁最可能在第三天就想辞职？",
        "如果全场只能留一个人负责点外卖，谁最不容易点错？",
        "如果必须选一个人去参加恋综，谁最可能第一集就引爆话题？",
    ],
    "number": [
        "如果今天所有人的电量百分比都要变成同一个数字，哪个数字最丢人？",
        "如果一个年龄会被全世界永久停住，哪个数字最尴尬？",
        "如果一个数字会变成今年最不吉利的房号，最像是哪一个？",
        "如果闹钟只能设成同一个时间，哪个数字最让人绝望？",
        "如果彩票号码里必须带一个最不靠谱的数字，最像是哪一个？",
        "如果密码只剩一个重复数字，哪个数字最像会被秒猜到？",
        "如果一个数字代表“今天别出门”，最像会是哪一个？",
        "如果考试分数只能停在一个数字，哪个最让人无话可说？",
    ],
    "creature": [
        "如果所有动物都变成家政阿姨，哪种动物最让人不放心？",
        "如果必须和一种动物同住一周，哪种最容易让人精神崩溃？",
        "如果一种动物突然会说人话，哪种最容易说出伤人的真话？",
        "如果动物都来竞选班长，哪种最像靠气势当选？",
        "如果一种动物要开脱口秀专场，哪种最可能爆红？",
        "如果一种动物出现在你床底下，哪种最让人瞬间清醒？",
        "如果动物也要打工，哪种最适合做保安？",
        "如果必须把一种动物纹在身上，哪种最容易后悔？",
    ],
    "food": [
        "如果婚礼上只能端一道最不合时宜的菜，大家觉得会是哪道？",
        "如果有一种食物最像深夜发消息说“睡了吗”，会是哪种？",
        "如果办公室下午茶只能留一种最容易引发争议的食物，会是哪种？",
        "如果一种食物最像前任，最可能会是什么？",
        "如果一道菜最适合在地铁上偷吃，最可能会是什么？",
        "如果一种食物会成为最差安慰奖，大家最怕拿到哪个？",
        "如果考试前必须吃一种最不吉利的食物，最像是哪种？",
        "如果一种食物会被大家票选为“最像渣男”，会是哪种？",
    ],
    "item": [
        "如果一种物品最不适合出现在第一次约会现场，会是什么？",
        "如果末日来了只能抱着一种物品跑，哪种最像会被带错？",
        "如果一种物品会在深夜自动发朋友圈，最容易发疯文的是哪个？",
        "如果一种物品最像会在会议上突然背刺你，最可能是哪种？",
        "如果一种物品最适合当吵架时的和好礼物，最不像的是哪个？",
        "如果一种物品掉在路上最容易让人装作没看见，会是什么？",
        "如果一种物品最适合当分手纪念品，哪种最荒唐？",
        "如果一种物品最像会偷偷评判你的人生，最可能是哪种？",
    ],
    "celebrity": [
        "如果要请一位名人来主持最失控的同学会，最像会是谁？",
        "如果一种名人最适合在你崩溃时打电话来骂醒你，会是谁？",
        "如果要选一位名人当临时室友，大家最担心谁半夜不睡觉？",
        "如果某位名人最像会把你的秘密写进歌里，最可能是谁？",
        "如果一种名人最不适合教人低调，大家觉得会是谁？",
        "如果一种名人最适合出演“迟到也理直气壮”的角色，会是谁？",
        "如果有位名人最像会把团建变成个人秀，最可能是谁？",
        "如果要选一位名人来当最夸张的婚礼证婚人，会是谁？",
    ],
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        cfg.update(config)
    raw_rounds = cfg.get("rounds_per_guesser", DEFAULT_CONFIG["rounds_per_guesser"])
    try:
        rounds_per_guesser = int(raw_rounds)
    except (TypeError, ValueError):
        raise ValueError("rounds_per_guesser must be an integer") from None
    if rounds_per_guesser < 1 or rounds_per_guesser > 3:
        raise ValueError("rounds_per_guesser must be between 1 and 3")
    cfg["rounds_per_guesser"] = rounds_per_guesser
    return cfg


def _build_category_decks() -> Dict[str, List[Dict]]:
    decks: Dict[str, List[Dict]] = {}
    for category, questions in QUESTION_POOL.items():
        cards = [
            {
                "card_id": f"{category}_{index}",
                "category": category,
                "question_text": text,
            }
            for index, text in enumerate(questions, start=1)
        ]
        random.shuffle(cards)
        decks[category] = cards
    return decks


def _draw_round_cards(state: Dict, category: str, count: int = 5) -> List[Dict]:
    decks = state["category_decks"]
    pool = QUESTION_POOL.get(category, [])
    deck = decks.setdefault(category, [])
    if len(pool) < count:
        raise ValueError(f"category {category} needs at least {count} questions")
    if len(deck) < count:
        deck = [
            {
                "card_id": f"{category}_{index}",
                "category": category,
                "question_text": text,
            }
            for index, text in enumerate(pool, start=1)
        ]
        random.shuffle(deck)
        decks[category] = deck
    return [deck.pop() for _ in range(count)]


def _sorted_player_ids(state: Dict) -> List[str]:
    return list(state.get("turn_order", []))


def _guesser_id(state: Dict) -> Optional[str]:
    order = _sorted_player_ids(state)
    if not order:
        return None
    index = int(state.get("guesser_index", 0))
    return order[index % len(order)]


def _round_answerer_ids(state: Dict) -> List[str]:
    guesser_id = _guesser_id(state)
    return [pid for pid in _sorted_player_ids(state) if pid != guesser_id]


def _next_round_setup(state: Dict) -> None:
    guesser_id = _guesser_id(state)
    state["guesser_id"] = guesser_id
    state["phase"] = "category_selection"
    state["selected_category"] = None
    state["round_cards"] = []
    state["target_card_id"] = None
    state["target_question"] = None
    state["shuffled_card_order"] = []
    state["answers"] = {}
    state["revealed_count"] = 0
    state["pending_card_id"] = None
    state["placements"] = {}
    state["last_round_summary"] = None


def _insert_card_at_slot(placements: Dict[int, str], slot: int, card_id: str) -> bool:
    if slot not in placements:
        placements[slot] = card_id
        return True

    empty_above = next((index for index in range(slot + 1, 5) if index not in placements), None)
    if empty_above is not None:
        for index in range(empty_above, slot, -1):
            placements[index] = placements[index - 1]
        placements[slot] = card_id
        return True

    empty_below = next((index for index in range(slot - 1, -1, -1) if index not in placements), None)
    if empty_below is not None:
        for index in range(empty_below, slot):
            placements[index] = placements[index + 1]
        placements[slot] = card_id
        return True

    return False


def _score_current_round(state: Dict) -> Dict:
    target_card_id = state.get("target_card_id")
    guessed_slot = None
    for slot, card_id in state.get("placements", {}).items():
        if card_id == target_card_id:
            guessed_slot = int(slot)
            break
    points = guessed_slot if guessed_slot is not None else 0
    guesser_id = state.get("guesser_id")
    if guesser_id in state.get("players", {}):
        state["players"][guesser_id]["score"] += points

    by_id = {card["card_id"]: card for card in state.get("round_cards", [])}
    slots = []
    for slot in range(5):
        card_id = state.get("placements", {}).get(slot)
        card = by_id.get(card_id, {})
        slots.append(
            {
                "slot": slot,
                "card_id": card_id,
                "question_text": card.get("question_text"),
                "is_target": card_id == target_card_id,
            }
        )
    answers = [
        {
            "player_id": pid,
            "name": state["player_meta"][pid]["name"],
            "answer_text": state.get("answers", {}).get(pid, ""),
        }
        for pid in _round_answerer_ids(state)
    ]
    summary = {
        "category": state.get("selected_category"),
        "category_label": CATEGORY_LABELS.get(state.get("selected_category"), state.get("selected_category", "-")),
        "guesser_id": guesser_id,
        "target_card_id": target_card_id,
        "target_question": state.get("target_question"),
        "guessed_slot": guessed_slot,
        "points": points,
        "slots": slots,
        "answers": answers,
    }
    state["last_round_summary"] = summary
    return summary


def _finish_or_advance_game(state: Dict) -> None:
    total_rounds = int(state.get("total_rounds", 0))
    if int(state.get("round", 1)) >= total_rounds:
        scores = {pid: player["score"] for pid, player in state.get("players", {}).items()}
        best = max(scores.values()) if scores else 0
        winners = [pid for pid, score in scores.items() if score == best]
        state["winner_ids"] = winners
        state["game_over"] = True
        state["phase"] = "game_over"
        return
    state["phase"] = "reveal"


def _reset_game_state(state: Dict) -> None:
    config = state.get("config") or {}
    player_meta = state.get("player_meta") or {}
    players = []
    for pid, meta in player_meta.items():
        entry = dict(meta) if isinstance(meta, dict) else {}
        entry["player_id"] = pid
        players.append(entry)
    players.sort(key=lambda item: item.get("seat", 0))
    fresh_state = DumbQuestionsGame.init_game(config, players)
    state.clear()
    state.update(fresh_state)


class DumbQuestionsGame:
    game_id = "dumb_questions"
    min_players = 3
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [player["player_id"] for player in players]
        player_meta = {player["player_id"]: player for player in players}
        guesser_index = random.randrange(len(player_ids)) if player_ids else 0
        state = {
            "players": {pid: {"score": 0} for pid in player_ids},
            "player_meta": player_meta,
            "turn_order": player_ids,
            "config": cfg,
            "guesser_index": guesser_index,
            "guesser_id": None,
            "round": 1,
            "total_rounds": len(player_ids) * cfg["rounds_per_guesser"],
            "phase": "category_selection",
            "selected_category": None,
            "category_decks": _build_category_decks(),
            "round_cards": [],
            "target_card_id": None,
            "target_question": None,
            "shuffled_card_order": [],
            "answers": {},
            "revealed_count": 0,
            "pending_card_id": None,
            "placements": {},
            "last_round_summary": None,
            "winner_ids": [],
            "game_over": False,
        }
        _next_round_setup(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again"]
        phase = state.get("phase")
        guesser_id = state.get("guesser_id")
        if phase == "category_selection":
            return ["select_category"] if player_id == guesser_id else []
        if phase == "answering":
            return ["submit_answer"] if player_id != guesser_id else []
        if phase == "guessing" and player_id == guesser_id:
            actions: List[str] = []
            if not state.get("pending_card_id") and int(state.get("revealed_count", 0)) < len(state.get("shuffled_card_order", [])):
                actions.append("reveal_next_card")
            if state.get("pending_card_id"):
                actions.append("place_card")
            return actions
        if phase == "reveal" and player_id == guesser_id:
            return ["continue_next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []
        phase = state.get("phase")
        guesser_id = state.get("guesser_id")

        if action_type == "play_again":
            if not state.get("game_over"):
                return [], "game not over"
            _reset_game_state(state)
            events.append({"type": "dumb_questions:play_again", "payload": {"player_id": player_id}})
            return events, None

        if state.get("game_over"):
            return [], "game over"

        if action_type == "select_category":
            if phase != "category_selection":
                return [], "invalid phase"
            if player_id != guesser_id:
                return [], "not guesser"
            category = action.get("category")
            if category not in QUESTION_POOL:
                return [], "invalid category"
            round_cards = _draw_round_cards(state, category)
            target_card = round_cards[0]
            shuffled_cards = list(round_cards)
            random.shuffle(shuffled_cards)
            state["selected_category"] = category
            state["round_cards"] = round_cards
            state["target_card_id"] = target_card["card_id"]
            state["target_question"] = target_card["question_text"]
            state["shuffled_card_order"] = [card["card_id"] for card in shuffled_cards]
            state["phase"] = "answering"
            events.append({"type": "dumb_questions:select_category", "payload": {"player_id": player_id, "category": category}})
            return events, None

        if action_type == "submit_answer":
            if phase != "answering":
                return [], "invalid phase"
            if player_id == guesser_id:
                return [], "guesser cannot answer"
            answer_text = " ".join(str(action.get("answer_text") or "").split())
            if not answer_text:
                return [], "answer required"
            state.setdefault("answers", {})[player_id] = answer_text
            if all(state["answers"].get(pid) for pid in _round_answerer_ids(state)):
                state["phase"] = "guessing"
            events.append({"type": "dumb_questions:submit_answer", "payload": {"player_id": player_id}})
            return events, None

        if action_type == "reveal_next_card":
            if phase != "guessing":
                return [], "invalid phase"
            if player_id != guesser_id:
                return [], "not guesser"
            if state.get("pending_card_id"):
                return [], "place current card first"
            revealed_count = int(state.get("revealed_count", 0))
            order = state.get("shuffled_card_order", [])
            if revealed_count >= len(order):
                return [], "no cards left"
            card_id = order[revealed_count]
            state["revealed_count"] = revealed_count + 1
            state["pending_card_id"] = card_id
            events.append({"type": "dumb_questions:reveal_card", "payload": {"player_id": player_id, "card_id": card_id}})
            return events, None

        if action_type == "place_card":
            if phase != "guessing":
                return [], "invalid phase"
            if player_id != guesser_id:
                return [], "not guesser"
            slot = action.get("slot")
            if not isinstance(slot, int):
                return [], "invalid slot"
            if slot < 0 or slot > 4:
                return [], "slot out of range"
            card_id = action.get("card_id")
            pending_card_id = state.get("pending_card_id")
            if not pending_card_id:
                return [], "no revealed card"
            if card_id != pending_card_id:
                return [], "card does not match pending card"
            placements = state.setdefault("placements", {})
            if not _insert_card_at_slot(placements, slot, card_id):
                return [], "board is full"
            state["pending_card_id"] = None
            if len(placements) >= 5:
                _score_current_round(state)
                _finish_or_advance_game(state)
            events.append(
                {
                    "type": "dumb_questions:place_card",
                    "payload": {"player_id": player_id, "slot": slot, "card_id": card_id},
                }
            )
            return events, None

        if action_type == "continue_next_round":
            if phase != "reveal":
                return [], "invalid phase"
            if player_id != guesser_id:
                return [], "not guesser"
            order = _sorted_player_ids(state)
            if not order:
                return [], "no players"
            state["round"] = int(state.get("round", 1)) + 1
            state["guesser_index"] = (int(state.get("guesser_index", 0)) + 1) % len(order)
            _next_round_setup(state)
            events.append({"type": "dumb_questions:next_round", "payload": {"round": state["round"]}})
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(state.get("player_meta", {}).keys(), key=lambda pid: state["player_meta"][pid].get("seat", 0))
        players = []
        answers = state.get("answers", {})
        guesser_id = state.get("guesser_id")
        for pid in player_ids:
            meta = state["player_meta"][pid]
            players.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "score": state["players"][pid]["score"],
                    "is_guesser": pid == guesser_id,
                    "answered": bool(answers.get(pid)),
                }
            )

        card_by_id = {card["card_id"]: card for card in state.get("round_cards", [])}
        board_slots = []
        for slot in range(5):
            card_id = state.get("placements", {}).get(slot)
            card = card_by_id.get(card_id, {})
            board_slots.append(
                {
                    "slot": slot,
                    "card_id": card_id,
                    "question_text": card.get("question_text"),
                    "is_target": bool(card_id and card_id == state.get("target_card_id") and state.get("phase") in ("reveal", "game_over")),
                }
            )

        pending_card = None
        pending_card_id = state.get("pending_card_id")
        if pending_card_id:
            card = card_by_id.get(pending_card_id, {})
            pending_card = {
                "card_id": pending_card_id,
                "question_text": card.get("question_text"),
            }

        visible_answers: List[Dict] = []
        if state.get("phase") in ("guessing", "reveal", "game_over"):
            visible_answers = [{"answer_text": answers.get(pid, "")} for pid in _round_answerer_ids(state)]

        prompt_question = None
        if state.get("phase") == "answering" and viewer_id != guesser_id:
            prompt_question = state.get("target_question")
        elif state.get("phase") in ("reveal", "game_over"):
            prompt_question = state.get("target_question")

        status_text = ""
        phase = state.get("phase")
        if phase == "category_selection":
            status_text = "Guesser chooses one category."
        elif phase == "answering":
            status_text = "Answerers submit honest answers. Guesser waits."
        elif phase == "guessing":
            status_text = "Guesser reveals one card at a time and locks each card into one score slot."
        elif phase == "reveal":
            status_text = "Round scored. Guesser can continue."
        elif phase == "game_over":
            status_text = "Game over."

        return {
            "game_id": DumbQuestionsGame.game_id,
            "you": viewer_id,
            "phase": phase,
            "round": state.get("round", 1),
            "total_rounds": state.get("total_rounds", 0),
            "guesser_id": guesser_id,
            "players": players,
            "categories": [
                {"id": category, "label": label}
                for category, label in CATEGORY_LABELS.items()
            ],
            "selected_category": state.get("selected_category"),
            "selected_category_label": CATEGORY_LABELS.get(state.get("selected_category"), "-"),
            "prompt_question": prompt_question,
            "answers": visible_answers,
            "board_slots": board_slots,
            "pending_card": pending_card,
            "revealed_count": state.get("revealed_count", 0),
            "total_cards": 5,
            "status_text": status_text,
            "last_round_summary": state.get("last_round_summary"),
            "winner_ids": state.get("winner_ids", []),
            "game_over": state.get("game_over", False),
            "config": {"rounds_per_guesser": state["config"]["rounds_per_guesser"]},
            "legal_actions": DumbQuestionsGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        phase = state.get("phase")
        guesser_id = state.get("guesser_id")
        if phase == "category_selection" and bot_id == guesser_id:
            return {
                "type": "select_category",
                "category": random.choice(list(CATEGORY_LABELS.keys())),
                "delay_ms": random.randint(400, 900),
            }
        if phase == "answering" and bot_id != guesser_id:
            if state.get("answers", {}).get(bot_id):
                return None
            return {
                "type": "submit_answer",
                "answer_text": random.choice(["当然是我", "太离谱了", "这题很难装", "我第一反应就是这个"]),
                "delay_ms": random.randint(500, 1100),
            }
        if phase == "guessing" and bot_id == guesser_id:
            if state.get("pending_card_id"):
                return {
                    "type": "place_card",
                    "slot": random.randint(0, 4),
                    "card_id": state["pending_card_id"],
                    "delay_ms": random.randint(500, 1000),
                }
            if int(state.get("revealed_count", 0)) < len(state.get("shuffled_card_order", [])):
                return {"type": "reveal_next_card", "delay_ms": random.randint(400, 900)}
        if phase == "reveal" and bot_id == guesser_id:
            return {"type": "continue_next_round", "delay_ms": random.randint(700, 1200)}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
