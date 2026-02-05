import random
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG = {
    "slider_count": 3,
}

ATTRIBUTE_DECK = [
    "危险的",
    "令人尴尬的",
    "被高估的",
    "性感的",
    "无聊的",
    "有用的",
    "令人费解的",
    "令人紧张的",
    "令人感动的",
    "让人想哭的",
    "滑稽的",
    "荒唐的",
    "低俗的",
    "有仪式感的",
    "复古的",
    "反差感强的",
    "可靠的",
    "虚伪的",
    "复杂的",
    "暧昧的",
    "阴暗的",
    "存在感强的",
    "矫情的",
    "温柔的",
    "刻薄的",
    "热情的",
    "禁忌的",
    "邪恶的",
    "高贵的",
    "别扭的",
    "令人讨厌的",
    "令人着迷的",
    "令人害怕的",
    "令人兴奋的",
    "令人厌倦的",
    "令人怀念的",
    "有毒的",
    "压迫感强的",
    "让人上瘾的",
    "让人想逃的",
    "颠覆性的",
    "创造性的",
    "夸张的",
    "呆板的",
    "浪漫的",
    "有画面感的",
    "流行的",
    "戏剧性的",
    "理想主义的",
    "卑鄙的",
    "敷衍的",
    "稳重的",
    "冒险的",
    "固执的",
    "令人好奇的",
    "让人不安的",
    "让人想吐槽的",
    "粘糊糊的",
    "幼稚的",
    "佛系的",
    "令人反感的",
    "让人想分享的",
    "让人嫉妒的",
    "令人羞耻的",
    "充满争议的",
    "值得炫耀的",
    "让人敬畏的",
    "令人疲惫的",
    "令人疯狂的",
    "令人心动的",
    "昂贵的",
]

TASK_CARDS = [
    ["核弹", "初恋", "马桶塞", "蒙娜丽莎", "蟑螂"],
    ["特朗普", "微波炉", "资本主义", "挖鼻孔", "独角兽"],
    ["太阳", "网红直播", "快递员", "黑洞", "泡面"],
    ["外星人", "婚姻", "闹钟", "汉堡王", "哲学"],
    ["章鱼", "爱情电影", "剃须刀", "考试", "垃圾分类"],
    ["恐龙", "中年危机", "VR游戏", "榴莲", "地铁"],
    ["希特勒", "小确幸", "便利店", "噩梦", "小猫"],
    ["人工智能", "口香糖", "篮球明星", "空气污染", "奶奶的拥抱"],
    ["吸血鬼", "周一早晨", "加班", "游乐园", "洗衣机"],
    ["火山", "前任", "彩票", "图书馆", "口罩"],
    ["宇宙飞船", "熊孩子", "辣椒", "新冠", "无人岛"],
    ["旧照片", "名牌包", "考古遗址", "地震", "冷笑话"],
    ["高速公路", "暗恋", "臭豆腐", "地狱", "瑜伽"],
    ["摇滚乐", "老板的训话", "牙医", "海浪", "垃圾邮件"],
    ["偶像", "电梯", "谎言", "机场安检", "鬼故事"],
    ["猫咪视频", "末日", "初中数学", "红酒", "游戏外挂"],
    ["机器人", "寺庙", "泥石流", "便当", "健身房"],
    ["黑洞", "恋综节目", "青蛙", "手榴弹", "博物馆"],
    ["超跑", "贫穷", "鸽子", "垃圾桶", "程序员"],
    ["神明", "拖延症", "酒精", "房贷", "游泳池"],
    ["医生", "烂尾楼", "彩票中奖", "黑胶唱片", "社交恐惧"],
    ["流浪狗", "直播带货", "失眠", "诺贝尔奖", "迷宫"],
    ["熊猫", "核酸检测", "失恋", "电锯", "乌托邦"],
    ["王子", "诈骗电话", "电梯故障", "蹦极", "夏天的蚊子"],
    ["老宅", "人工降雨", "审判", "泡脚桶", "月球基地"],
    ["外卖骑手", "公司团建", "断网", "陨石", "烤面包机"],
    ["保温杯", "天才", "地铁安检", "雪崩", "枕边风"],
    ["小学生", "股市崩盘", "香水", "荒野求生", "玻璃栈道"],
]


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    slider_count = cfg.get("slider_count", DEFAULT_CONFIG["slider_count"])
    try:
        slider_count = int(slider_count)
    except (TypeError, ValueError):
        raise ValueError("slider_count must be an integer") from None
    if slider_count < 1 or slider_count > 5:
        raise ValueError("slider_count must be between 1 and 5")
    cfg["slider_count"] = slider_count
    return cfg


def _build_task_deck() -> List[int]:
    indices = list(range(len(TASK_CARDS)))
    random.shuffle(indices)
    return indices


def _draw_task_card(state: Dict) -> None:
    deck = state.get("task_deck")
    if not deck:
        deck = _build_task_deck()
        state["task_deck"] = deck
    card_index = deck.pop()
    words = list(TASK_CARDS[card_index])
    target_index = random.randrange(len(words))
    state["current_card"] = {"words": words, "target_index": target_index}


def _draw_attributes(count: int) -> List[Dict]:
    if count <= 0:
        return []
    pool = list(ATTRIBUTE_DECK)
    if len(pool) >= count:
        picks = random.sample(pool, count)
    else:
        picks = []
        while len(picks) < count:
            random.shuffle(pool)
            picks.extend(pool)
        picks = picks[:count]
    random.shuffle(picks)
    pairs = []
    for idx in range(0, count, 2):
        left = picks[idx]
        right = picks[idx + 1]
        if random.random() < 0.5:
            left, right = right, left
        pairs.append({"left_attr": left, "right_attr": right, "value": None})
    return pairs


def _leader_id(state: Dict) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    index = state.get("leader_index", 0)
    if index < 0 or index >= len(order):
        return order[0]
    return order[index]


def _setup_round(state: Dict) -> None:
    _draw_task_card(state)
    slider_count = state["config"]["slider_count"]
    state["sliders"] = _draw_attributes(slider_count * 2)
    state["active_slider_index"] = 0
    state["guesses"] = {}
    state["guess_order"] = 0
    state["phase"] = "leader_set"
    state["leader_id"] = _leader_id(state)


def _player_order(state: Dict) -> List[str]:
    return list(state.get("turn_order", []))


def _score_round(state: Dict) -> Dict:
    leader_id = state["leader_id"]
    target_index = state["current_card"]["target_index"]
    guesses = state.get("guesses", {})
    guesser_ids = [pid for pid in _player_order(state) if pid != leader_id]
    summary_guesses = []
    correct_count = 0

    for pid in guesser_ids:
        entry = guesses.get(pid)
        order = entry.get("order") if entry else None
        choice_index = entry.get("choice") if entry else None
        correct = entry is not None and choice_index == target_index
        points = 0
        if correct and order is not None:
            if order == 1:
                points = 3
            elif order == 2:
                points = 2
            else:
                points = 1
            state["players"][pid]["score"] += points
            correct_count += 1
        summary_guesses.append(
            {
                "player_id": pid,
                "name": state["player_meta"][pid]["name"],
                "choice_index": choice_index,
                "order": order,
                "correct": correct,
                "points": points,
            }
        )

    leader_delta = correct_count
    if guesser_ids:
        if correct_count == 0:
            leader_delta -= 1
        elif correct_count == len(guesser_ids):
            leader_delta += 1

    if leader_id is not None:
        state["players"][leader_id]["score"] += leader_delta

    return {
        "leader_id": leader_id,
        "target_index": target_index,
        "target_word": state["current_card"]["words"][target_index],
        "words": list(state["current_card"]["words"]),
        "correct_count": correct_count,
        "guess_count": len(guesser_ids),
        "leader_delta": leader_delta,
        "guesses": summary_guesses,
    }


def _maybe_finish_game(state: Dict) -> None:
    order = _player_order(state)
    if not order:
        state["game_over"] = True
        state["phase"] = "game_over"
        state["winner"] = None
        return
    scores = {pid: state["players"][pid]["score"] for pid in order}
    max_score = max(scores.values()) if scores else 0
    winners = [pid for pid, score in scores.items() if score == max_score]
    state["winner"] = winners
    state["game_over"] = True
    state["phase"] = "game_over"


def _reset_game_state(state: Dict) -> None:
    config = state.get("config") or {}
    player_meta = state.get("player_meta") or {}
    players = []
    for pid, meta in player_meta.items():
        entry = dict(meta) if isinstance(meta, dict) else {}
        entry["player_id"] = pid
        players.append(entry)
    players.sort(key=lambda p: p.get("seat", 0))
    fresh_state = PerfectMismatchGame.init_game(config, players)
    state.clear()
    state.update(fresh_state)


class PerfectMismatchGame:
    game_id = "perfect_mismatch"
    min_players = 2
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        state_players = {pid: {"score": 0} for pid in player_ids}
        state = {
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "leader_index": 0,
            "round": 1,
            "config": cfg,
            "task_deck": _build_task_deck(),
            "current_card": {"words": [], "target_index": 0},
            "sliders": [],
            "active_slider_index": 0,
            "guesses": {},
            "guess_order": 0,
            "phase": "leader_set",
            "leader_id": None,
            "last_round_summary": None,
            "winner": None,
            "game_over": False,
        }
        _setup_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again"]
        leader_id = state.get("leader_id")
        actions = []
        phase = state.get("phase")
        sliders = state.get("sliders", [])

        if phase in ("leader_set", "guessing") and player_id == leader_id:
            if state.get("active_slider_index", 0) < len(sliders):
                actions.append("set_slider")
            if phase == "guessing" and state.get("active_slider_index", 0) >= len(sliders):
                actions.append("reveal")

        if phase == "guessing" and player_id != leader_id:
            if player_id not in state.get("guesses", {}):
                actions.append("submit_guess")

        if phase == "reveal" and player_id == leader_id:
            actions.append("next_round")

        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []
        phase = state.get("phase")
        leader_id = state.get("leader_id")

        if action_type == "play_again":
            if not state.get("game_over"):
                return [], "game not over"
            _reset_game_state(state)
            events.append({"type": "mismatch:play_again", "payload": {"player_id": player_id}})
            return events, None

        if state.get("game_over"):
            return [], "game over"

        if action_type == "set_slider":
            if player_id != leader_id:
                return [], "not leader"
            if phase not in ("leader_set", "guessing"):
                return [], "invalid phase"
            slider_index = action.get("slider_index")
            value = action.get("value")
            if not isinstance(slider_index, int):
                return [], "invalid slider_index"
            if not isinstance(value, int):
                return [], "invalid value"
            sliders = state.get("sliders", [])
            if slider_index < 0 or slider_index >= len(sliders):
                return [], "slider out of range"
            if slider_index != state.get("active_slider_index"):
                return [], "slider not active"
            if value < 0 or value > 10:
                return [], "value out of range"
            sliders[slider_index]["value"] = value
            state["active_slider_index"] = slider_index + 1
            if phase == "leader_set":
                state["phase"] = "guessing"
            events.append(
                {
                    "type": "mismatch:set_slider",
                    "payload": {"leader_id": player_id, "slider_index": slider_index, "value": value},
                }
            )
            return events, None

        if action_type == "submit_guess":
            if phase != "guessing":
                return [], "guessing not open"
            if player_id == leader_id:
                return [], "leader cannot guess"
            if player_id in state.get("guesses", {}):
                return [], "already guessed"
            choice_index = action.get("choice_index")
            if not isinstance(choice_index, int):
                return [], "invalid choice_index"
            words = state.get("current_card", {}).get("words", [])
            if choice_index < 0 or choice_index >= len(words):
                return [], "choice out of range"
            state["guess_order"] += 1
            state.setdefault("guesses", {})[player_id] = {
                "choice": choice_index,
                "order": state["guess_order"],
            }
            events.append(
                {
                    "type": "mismatch:guess",
                    "payload": {"player_id": player_id, "order": state["guess_order"]},
                }
            )
            return events, None

        if action_type == "reveal":
            if player_id != leader_id:
                return [], "not leader"
            if phase != "guessing":
                return [], "invalid phase"
            if state.get("active_slider_index", 0) < len(state.get("sliders", [])):
                return [], "sliders not complete"
            summary = _score_round(state)
            state["last_round_summary"] = summary
            if state.get("leader_index", 0) + 1 >= len(_player_order(state)):
                _maybe_finish_game(state)
            else:
                state["phase"] = "reveal"
            events.append({"type": "mismatch:reveal", "payload": summary})
            return events, None

        if action_type == "next_round":
            if player_id != leader_id:
                return [], "not leader"
            if phase != "reveal":
                return [], "invalid phase"
            state["leader_index"] = int(state.get("leader_index", 0)) + 1
            state["round"] = int(state.get("round", 1)) + 1
            _setup_round(state)
            events.append({"type": "mismatch:next_round", "payload": {"round": state["round"]}})
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(
            state["player_meta"].keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        leader_id = state.get("leader_id")
        players_view = []
        guess_map = state.get("guesses", {})
        for pid in player_ids:
            meta = state["player_meta"][pid]
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "score": state["players"][pid]["score"],
                    "guessed": pid in guess_map,
                    "guess_order": guess_map.get(pid, {}).get("order"),
                }
            )

        target_index = None
        if viewer_id == leader_id or state.get("phase") in ("reveal", "game_over"):
            target_index = state["current_card"]["target_index"]

        your_guess = guess_map.get(viewer_id)
        sliders_view = [
            {
                "left_attr": slider["left_attr"],
                "right_attr": slider["right_attr"],
                "value": slider.get("value"),
            }
            for slider in state.get("sliders", [])
        ]

        return {
            "game_id": PerfectMismatchGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "leader_id": leader_id,
            "players": players_view,
            "words": state.get("current_card", {}).get("words", []),
            "sliders": sliders_view,
            "active_slider_index": state.get("active_slider_index", 0),
            "target_index": target_index,
            "your_guess": your_guess,
            "last_round_summary": state.get("last_round_summary"),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "config": {"slider_count": state["config"]["slider_count"]},
            "legal_actions": PerfectMismatchGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        phase = state.get("phase")
        leader_id = state.get("leader_id")

        if phase in ("leader_set", "guessing") and bot_id == leader_id:
            slider_index = state.get("active_slider_index", 0)
            if slider_index < len(state.get("sliders", [])):
                return {
                    "type": "set_slider",
                    "slider_index": slider_index,
                    "value": random.randint(0, 10),
                    "delay_ms": random.randint(400, 900),
                }
            if phase == "guessing":
                return {"type": "reveal", "delay_ms": random.randint(600, 1200)}

        if phase == "guessing" and bot_id != leader_id:
            if bot_id not in state.get("guesses", {}):
                words = state.get("current_card", {}).get("words", [])
                if not words:
                    return None
                return {
                    "type": "submit_guess",
                    "choice_index": random.randrange(len(words)),
                    "delay_ms": random.randint(500, 1500),
                }

        if phase == "reveal" and bot_id == leader_id:
            return {"type": "next_round", "delay_ms": random.randint(700, 1200)}

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
