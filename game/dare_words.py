"""胆敢造词：轮流翻单字卡，抢先用桌面上的字造出至少三个字的词句。"""

import copy
import random
import secrets
import unicodedata
from collections import Counter
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


# Room setup picks the phrase-length floor: three keeps the classic rules while
# four and five make every claim harder to reach.
MIN_PHRASE_CHOICES: Tuple[int, ...] = (3, 4, 5)
DEFAULT_MIN_PHRASE_CHARS = 3
MAX_PHRASE_CHARS = 24
DECK_SIZES = {"short": 60, "full": 100}
DEFAULT_DECK_SIZE = "full"

# Single-character cards. Common function characters repeat so the table can
# always grow into a readable phrase.
DECK_CHARACTERS: Tuple[str, ...] = (
    "的", "的", "了", "了", "不", "不", "我", "我", "你", "你", "是", "是",
    "在", "在", "有", "有", "大", "大", "小", "小", "好", "好", "人", "人",
    "天", "天", "上", "上", "太", "很", "也", "都", "会", "要", "里", "中",
    "下", "外", "前", "后", "东", "西", "南", "北", "日", "月", "星", "云",
    "雨", "风", "火", "水", "山", "猫", "狗", "猪", "鸡", "牛", "羊", "马",
    "鸟", "龙", "虎", "花", "草", "树", "果", "米", "饭", "菜", "肉", "鱼",
    "车", "门", "家", "国", "城", "路", "书", "钱", "船", "机", "王", "兵",
    "贼", "师", "生", "老", "少", "男", "女", "心", "爱", "爸", "妈", "飞",
    "跑", "跳", "吃", "睡",
)

SHORT_DECK_CHARACTERS: Tuple[str, ...] = (
    "的", "的", "了", "了", "不", "不", "我", "我", "你", "你", "是", "是",
    "在", "在", "有", "有", "大", "大", "小", "小", "好", "好", "天", "上",
    "人", "中", "里", "下", "猫", "狗", "猪", "鸡", "牛", "羊", "马", "鸟",
    "花", "草", "树", "果", "米", "饭", "菜", "肉", "鱼", "车", "门", "家",
    "国", "城", "路", "书", "日", "月", "风", "火", "水", "山", "太", "很",
)

EXTRA_DECK_CHARACTERS: Tuple[str, ...] = tuple(
    "他她它们这那个些谁哪"
    "来去看听说读写想做玩"
    "买卖拿放开关坐站走到"
    "回过给让把被能可就还"
    "吗呢吧啊着得地和与或"
    "又再才只最真更多高长"
    "新旧快慢冷热红黄蓝绿"
    "白黑金银光电雪冰海河"
    "湖江石土沙竹叶林森木"
    "春夏秋冬早晚年时分秒"
    "今明昨午夜空阳亮温暖"
    "手脚头眼耳口鼻牙脸发"
    "身体面皮肚背足指血骨"
    "哥姐弟妹爷奶儿子朋友"
    "学文字语词话诗歌画笔"
    "纸本包衣裤鞋帽床桌椅"
    "窗灯钟杯碗筷锅刀盘瓶"
    "茶酒汤蛋糖盐油醋饼饺"
    "桃梨瓜豆麦橙橘葡萄蕉"
    "一二三四五六七八九十"
)

# Bot vocabulary. Every character must exist in the full deck; a unit test keeps
# the two lists in sync so bots never submit an impossible phrase.
BOT_PHRASES: Tuple[str, ...] = (
    "大米饭", "老虎机", "老师好", "有钱人", "猫吃鱼", "狗吃肉", "大老虎", "吃米饭",
    "吃水果", "下雨了", "我爱你", "是不是", "在不在", "好不好", "吃不下", "中国人",
    "外国人", "老王家", "鸡飞狗跳", "大有人在", "大鱼大肉", "东西南北", "不上不下", "大大小小",
    "有山有水", "有花有草", "有鸡有鱼", "大人小人", "门前树下", "老虎吃人", "老牛吃草", "山上有虎",
    "水中有鱼", "有人有钱", "车上吃饭", "猫太少了", "雨太大了", "风太大了", "牛在吃草", "羊在吃草",
    "鸡在吃米", "鱼在水中", "鸟在天上", "人在城里", "我在家里",
)

# Longer bot vocabulary, only consulted when the room asks for five-character
# phrases. The three and four character games keep using BOT_PHRASES alone so
# their pace does not change.
BOT_PHRASES_LONG: Tuple[str, ...] = (
    "猫吃大米饭", "猫在吃大米", "老牛在吃草", "老虎在吃人", "大鱼在水中",
    "小鸟在天上", "老王家有猫", "我在家里吃", "有钱人不少", "大猫在树上",
)

# Fallback grammar. When no dictionary word fits, a bot still builds a readable
# phrase by filling simple Chinese sentence patterns from the cards on the table.
ROLE_CHARACTERS: Dict[str, Tuple[str, ...]] = {
    "noun": ("猫", "狗", "猪", "鸡", "牛", "羊", "马", "鸟", "龙", "虎", "鱼", "肉", "菜", "饭", "米",
             "果", "花", "草", "树", "人", "天", "山", "水", "火", "风", "雨", "云", "日", "月", "星",
             "车", "门", "家", "国", "城", "路", "书", "钱", "船", "机", "王", "兵", "贼", "师", "生",
             "男", "女", "爸", "妈", "心"),
    "verb": ("吃", "睡", "跑", "跳", "飞"),
    "pron": ("我", "你", "他"),
    "adj": ("大", "小", "好", "老", "少"),
}
BOT_PATTERNS: Tuple[Tuple[str, ...], ...] = (
    ("noun", "verb", "noun"),
    ("pron", "verb", "noun"),
    ("pron", "的", "noun"),
    ("noun", "的", "noun"),
    ("verb", "了", "noun"),
    ("noun", "verb", "了"),
    ("pron", "verb", "了"),
    ("adj", "的", "noun"),
    ("pron", "是", "noun"),
    ("noun", "是", "noun"),
    ("pron", "在", "noun"),
    ("noun", "在", "noun"),
    ("pron", "有", "noun"),
    ("noun", "有", "noun"),
    ("pron", "不", "verb"),
    ("noun", "不", "verb"),
    ("pron", "要", "verb"),
    ("noun", "要", "verb"),
    ("pron", "会", "verb"),
    ("noun", "会", "verb"),
    # Longer patterns. They only matter once the room raises the phrase minimum,
    # and the ones without a verb slot also work on the short deck, which carries
    # no action characters at all.
    ("noun", "在", "noun", "上"),
    ("noun", "在", "noun", "里"),
    ("noun", "在", "noun", "中"),
    ("noun", "在", "noun", "下"),
    ("pron", "是", "adj", "的"),
    ("noun", "是", "adj", "的"),
    ("pron", "不", "是", "noun"),
    ("noun", "不", "是", "noun"),
    ("noun", "太", "adj", "了"),
    ("noun", "verb", "了", "noun"),
    ("pron", "不", "verb", "noun"),
    ("noun", "不", "verb", "noun"),
    ("pron", "要", "verb", "noun"),
    ("pron", "会", "verb", "noun"),
    ("adj", "的", "noun", "在", "noun"),
    ("pron", "的", "noun", "在", "noun"),
    ("pron", "是", "adj", "的", "noun"),
    ("pron", "不", "是", "adj", "的"),
    ("noun", "不", "是", "adj", "的"),
    ("adj", "的", "adj", "的", "noun"),
    ("pron", "有", "adj", "的", "noun"),
    ("adj", "的", "noun", "verb", "noun"),
    ("pron", "的", "noun", "verb", "noun"),
    ("noun", "在", "noun", "上", "verb"),
)

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "deck_size": {"enum": sorted(DECK_SIZES)},
        "min_chars": {"enum": list(MIN_PHRASE_CHOICES)},
    },
    "additionalProperties": False,
}
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"enum": ["flip", "claim", "vote", "next_round", "finish_game", "play_again"]},
        "game_token": {"type": "string"},
        "window_id": {"type": "integer", "minimum": 0},
        "phrase": {"type": "string", "minLength": 1, "maxLength": MAX_PHRASE_CHARS},
        "accept": {"type": "boolean"},
    },
    "required": ["type", "game_token", "window_id"],
    "additionalProperties": False,
}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _is_han(character: str) -> bool:
    code = ord(character)
    return 0x3400 <= code <= 0x4DBF or 0x4E00 <= code <= 0x9FFF


def normalize_phrase(value: str) -> str:
    """Collapse a submitted phrase to bare Han characters."""
    text = unicodedata.normalize("NFKC", value if isinstance(value, str) else "")
    return "".join(character for character in text if not character.isspace())


def build_deck(deck_size: str) -> List[str]:
    source = SHORT_DECK_CHARACTERS if deck_size == "short" else DECK_CHARACTERS
    counts = Counter(source)
    common = [character for character in source if counts[character] > 1]
    candidates = [character for character in source if counts[character] == 1]
    candidates.extend(EXTRA_DECK_CHARACTERS)
    random.shuffle(candidates)
    deck = common + candidates[:DECK_SIZES[deck_size] - len(common)]
    random.shuffle(deck)
    return deck


def _row_characters(state: Dict) -> List[str]:
    return [card["char"] for card in state["row"]]


def _min_chars(state: Dict) -> int:
    """The phrase-length floor chosen when the room started."""
    value = state.get("min_chars", DEFAULT_MIN_PHRASE_CHARS)
    return value if type(value) is int and value in MIN_PHRASE_CHOICES else DEFAULT_MIN_PHRASE_CHARS


def _blocked(state: Dict, player_id: str) -> bool:
    """A failed claim only unlocks after one more card reaches the table."""
    return state["blocked"].get(player_id) == state["flips"]


def validate_phrase(state: Dict, phrase: str) -> Tuple[Optional[List[int]], Optional[str]]:
    """Return the card ids a phrase consumes, or the reason it is illegal."""
    characters = normalize_phrase(phrase)
    minimum = _min_chars(state)
    if len(characters) < minimum:
        return None, f"至少要用 {minimum} 个字。"
    if len(characters) > MAX_PHRASE_CHARS:
        return None, f"最多 {MAX_PHRASE_CHARS} 个字。"
    for character in characters:
        if not _is_han(character):
            return None, "只能用汉字，不能加标点、字母或数字。"
    available: Dict[str, List[int]] = {}
    for card in state["row"]:
        available.setdefault(card["char"], []).append(card["card_id"])
    card_ids: List[int] = []
    for character in characters:
        pool = available.get(character)
        if not pool:
            return None, f"「{character}」不在桌面上。" if character not in _row_characters(state) else f"「{character}」不够用。"
        card_ids.append(pool.pop(0))
    return card_ids, None


def _voter_ids(state: Dict, claimer_id: str) -> List[str]:
    return [player_id for player_id in state["turn_order"] if player_id != claimer_id]


def _is_game_over(state: Dict) -> bool:
    return not state["deck"] and len(state["row"]) < _min_chars(state)


def _finish(state: Dict) -> None:
    scores = {player_id: player["score"] for player_id, player in state["players"].items()}
    best = max(scores.values()) if scores else 0
    state["winner"] = [player_id for player_id in state["turn_order"] if scores[player_id] == best]
    state["game_over"] = True
    state["phase"] = "game_over"
    state["claim"] = None
    state["ready"] = []
    state["window_id"] += 1


def _resolve_claim(state: Dict) -> None:
    claim = state["claim"]
    claimer_id = claim["player_id"]
    accepts = [player_id for player_id, accepted in claim["votes"].items() if accepted]
    rejects = [player_id for player_id, accepted in claim["votes"].items() if not accepted]
    accepted = len(accepts) > len(rejects)
    used = set(claim["card_ids"])
    if accepted:
        state["row"] = [card for card in state["row"] if card["card_id"] not in used]
        player = state["players"][claimer_id]
        player["score"] += len(claim["card_ids"])
        player["cards"] += len(claim["card_ids"])
    else:
        state["blocked"][claimer_id] = state["flips"]
    result = {
        "round": state["round"],
        "player_id": claimer_id,
        "player_name": state["players"][claimer_id]["name"],
        "phrase": claim["phrase"],
        "characters": list(claim["phrase"]),
        "card_ids": list(claim["card_ids"]),
        "accepted": accepted,
        "cards": len(claim["card_ids"]),
        "accepts": accepts,
        "rejects": rejects,
        "votes": dict(claim["votes"]),
    }
    state["history"].append(result)
    state["last_result"] = result
    state["claim"] = None
    state["ready"] = []
    state["window_id"] += 1
    if _is_game_over(state):
        _finish(state)
    else:
        state["phase"] = "reveal"


def _bot_phrase(state: Dict) -> Optional[str]:
    """Prefer a real word, then fall back to function-character grammar."""
    minimum = _min_chars(state)
    vocabulary = BOT_PHRASES + BOT_PHRASES_LONG if minimum >= 5 else BOT_PHRASES
    available: Dict[str, int] = {}
    for character in _row_characters(state):
        available[character] = available.get(character, 0) + 1
    best: Optional[str] = None
    for phrase in vocabulary:
        if len(phrase) < minimum:
            continue
        needed: Dict[str, int] = {}
        for character in phrase:
            needed[character] = needed.get(character, 0) + 1
        if all(available.get(character, 0) >= count for character, count in needed.items()):
            if best is None or len(phrase) > len(best):
                best = phrase
    if best:
        return best
    return _compose_phrase(state, available)


def _compose_phrase(state: Dict, available: Dict[str, int]) -> Optional[str]:
    """Fill a sentence pattern with table cards, keeping every slot in its role."""
    minimum = _min_chars(state)
    for pattern in BOT_PATTERNS:
        if len(pattern) < minimum:
            continue
        used: Dict[str, int] = {}
        picked: List[str] = []
        for slot in pattern:
            if len(slot) == 1:
                character = slot
            else:
                candidates = list(ROLE_CHARACTERS[slot])
                random.shuffle(candidates)
                character = next(
                    (item for item in candidates if available.get(item, 0) - used.get(item, 0) > 0),
                    None,
                )
            if character is None or available.get(character, 0) - used.get(character, 0) <= 0:
                picked = []
                break
            used[character] = used.get(character, 0) + 1
            picked.append(character)
        if len(picked) != len(pattern):
            continue
        candidate = "".join(picked)
        card_ids, error = validate_phrase(state, candidate)
        if not error and card_ids:
            return candidate
    return None


class DareWordsGame:
    game_id = "dare_words"
    min_players = 2
    max_players = 8
    supported_player_counts = tuple(range(2, 9))

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = config if isinstance(config, dict) else {}
        if not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("Dare to Make Words only accepts a full or short deck "
                             "and a 3, 4 or 5 character phrase minimum.")
        deck_size = config.get("deck_size", DEFAULT_DECK_SIZE)
        min_chars = config.get("min_chars", DEFAULT_MIN_PHRASE_CHARS)
        if type(min_chars) is not int or min_chars not in MIN_PHRASE_CHOICES:
            raise ValueError("The phrase minimum must be 3, 4 or 5 characters.")
        metadata = []
        for index, player in enumerate(players):
            if not isinstance(player, dict) or not isinstance(player.get("player_id"), str) or not player["player_id"]:
                raise ValueError("Player IDs must be nonempty strings.")
            seat = player.get("seat", index)
            if type(seat) is not int or seat < 0:
                raise ValueError("Seats must be nonnegative integers.")
            metadata.append({
                "player_id": player["player_id"], "seat": seat,
                "name": str(player.get("name") or player["player_id"]),
                "is_bot": bool(player.get("is_bot")), "score": 0, "cards": 0,
            })
        metadata.sort(key=lambda player: player["seat"])
        ids = [player["player_id"] for player in metadata]
        if not DareWordsGame.min_players <= len(ids) <= DareWordsGame.max_players:
            raise ValueError(f"Dare to Make Words needs {DareWordsGame.min_players} to {DareWordsGame.max_players} players.")
        if len(set(ids)) != len(ids) or len({player["seat"] for player in metadata}) != len(ids):
            raise ValueError("Player IDs and seats must be unique.")
        deck = build_deck(deck_size)
        return {
            "game_id": DareWordsGame.game_id, "version": 1,
            "config": {"deck_size": deck_size, "min_chars": min_chars},
            "deck_size": deck_size, "min_chars": min_chars,
            "game_token": secrets.token_hex(16), "window_id": 0, "revision": 0,
            "turn_order": ids, "players": {player["player_id"]: player for player in metadata},
            "phase": "flipping", "round": 1,
            "deck": deck, "initial_deck": list(deck),
            "row": [], "next_card_id": 1, "flips": 0,
            "flipper": ids[0], "claim": None, "last_result": None,
            "history": [], "ready": [], "blocked": {},
            "game_over": False, "winner": [],
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"]:
            return []
        if state["game_over"]:
            return ["play_again"]
        phase = state["phase"]
        if phase == "flipping":
            actions: List[str] = []
            if player_id == state["flipper"] and state["deck"]:
                actions.append("flip")
            if len(state["row"]) >= _min_chars(state) and not _blocked(state, player_id):
                actions.append("claim")
            if not state["deck"]:
                actions.append("finish_game")
            return actions
        if phase == "voting":
            claim = state["claim"]
            if player_id != claim["player_id"] and player_id not in claim["votes"]:
                return ["vote"]
            return []
        if phase == "reveal":
            return [] if player_id in state["ready"] else ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action schema."
        if type(action["window_id"]) is not int:
            return [], "Invalid action window."
        if action["game_token"] != state["game_token"] or action["window_id"] != state["window_id"]:
            return [], "This action belongs to an old game or round."
        kind = action["type"]
        required = {"claim": {"phrase"}, "vote": {"accept"}}
        expected = {"type", "game_token", "window_id"} | required.get(kind, set())
        if set(action) != expected:
            return [], "Unexpected or missing action fields."
        if kind not in DareWordsGame.get_legal_actions(state, player_id):
            return [], "Action unavailable right now."

        if kind == "play_again":
            fresh = DareWordsGame.init_game(state["config"], [
                {**state["players"][pid], "score": 0, "cards": 0} for pid in state["turn_order"]
            ])
            state.clear()
            state.update(fresh)
            state["revision"] += 1
            return [{"type": "dare_words:play_again", "payload": {"player_id": player_id}}], None

        if kind == "flip":
            character = state["deck"].pop(0)
            card_id = state["next_card_id"]
            state["next_card_id"] += 1
            state["row"].append({"card_id": card_id, "char": character})
            state["flips"] += 1
            state["flipper"] = state["turn_order"][(state["turn_order"].index(player_id) + 1) % len(state["turn_order"])]
            state["window_id"] += 1
            events = [{"type": "dare_words:flip", "payload": {"player_id": player_id, "char": character}}]
        elif kind == "claim":
            card_ids, error = validate_phrase(state, action["phrase"])
            if error:
                return [], error
            state["claim"] = {
                "player_id": player_id,
                "phrase": normalize_phrase(action["phrase"]),
                "card_ids": card_ids,
                "votes": {},
                "round": state["round"],
            }
            state["phase"] = "voting"
            state["window_id"] += 1
            events = [{"type": "dare_words:claim", "payload": {
                "player_id": player_id, "phrase": state["claim"]["phrase"],
            }}]
        elif kind == "vote":
            claim = state["claim"]
            claim["votes"][player_id] = bool(action["accept"])
            events = [{"type": "dare_words:vote", "payload": {"player_id": player_id}}]
            if len(claim["votes"]) == len(_voter_ids(state, claim["player_id"])):
                _resolve_claim(state)
        elif kind == "finish_game":
            state["last_result"] = {
                "round": state["round"], "player_id": player_id,
                "player_name": state["players"][player_id]["name"],
                "phrase": "", "characters": [], "card_ids": [], "accepted": False,
                "cards": 0, "accepts": [], "rejects": [], "votes": {}, "ended": True,
            }
            _finish(state)
            events = [{"type": "dare_words:finish", "payload": {"player_id": player_id}}]
        else:  # next_round
            state["ready"].append(player_id)
            events = [{"type": "dare_words:next_round", "payload": {"player_id": player_id}}]
            if len(state["ready"]) == len(state["turn_order"]):
                state["round"] += 1
                state["ready"] = []
                state["window_id"] += 1
                if _is_game_over(state):
                    _finish(state)
                else:
                    state["phase"] = "flipping"
        state["revision"] += 1
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        claim = state["claim"]
        claim_view = None
        if claim:
            voters = _voter_ids(state, claim["player_id"])
            claim_view = {
                "player_id": claim["player_id"],
                "player_name": state["players"][claim["player_id"]]["name"],
                "phrase": claim["phrase"],
                "characters": list(claim["phrase"]),
                "card_ids": list(claim["card_ids"]),
                "votes_cast": len(claim["votes"]),
                "votes_needed": len(voters),
                "voted": sorted(claim["votes"]),
                "your_vote": claim["votes"].get(viewer_id),
                "is_you": claim["player_id"] == viewer_id,
            }
        players = []
        for player_id in state["turn_order"]:
            player = state["players"][player_id]
            players.append({
                "player_id": player_id, "name": player["name"], "seat": player["seat"],
                "is_bot": player["is_bot"], "score": player["score"], "cards": player["cards"],
                "is_flipper": player_id == state["flipper"] and not state["game_over"],
                "is_you": player_id == viewer_id,
                "is_claimer": bool(claim and claim["player_id"] == player_id),
                "has_voted": bool(claim and player_id in claim["votes"]),
                "blocked": _blocked(state, player_id),
                "ready": player_id in state["ready"],
            })
        view = {
            "game_id": DareWordsGame.game_id, "you": viewer_id,
            "game_token": state["game_token"], "window_id": state["window_id"],
            "revision": state["revision"], "phase": state["phase"], "round": state["round"],
            "config": dict(state["config"]), "deck_size": state["deck_size"],
            "deck_remaining": len(state["deck"]), "deck_total": DECK_SIZES[state["deck_size"]],
            "row": [dict(card) for card in state["row"]],
            "flipper": state["flipper"], "current_turn": state["flipper"],
            "min_chars": _min_chars(state), "max_chars": MAX_PHRASE_CHARS,
            "flips": state["flips"], "claim": claim_view,
            "last_result": copy.deepcopy(state["last_result"]),
            "history": copy.deepcopy(state["history"]),
            "ready": list(state["ready"]), "you_ready": viewer_id in state["ready"],
            "players": players, "game_over": state["game_over"], "winner": list(state["winner"]),
            "legal_actions": DareWordsGame.get_legal_actions(state, viewer_id),
        }
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if bot_id not in state["players"]:
            return None
        actions = DareWordsGame.get_legal_actions(state, bot_id)
        if not actions:
            return None
        base = {"game_token": state["game_token"], "window_id": state["window_id"]}
        if "play_again" in actions:
            return None
        if "vote" in actions:
            return {**base, "type": "vote", "accept": random.random() < 0.75,
                    "delay_ms": random.randint(500, 1100)}
        if "next_round" in actions:
            return {**base, "type": "next_round", "delay_ms": random.randint(600, 1100)}
        phrase = _bot_phrase(state) if "claim" in actions else None
        if phrase and random.random() < 0.7:
            return {**base, "type": "claim", "phrase": phrase, "delay_ms": random.randint(900, 1800)}
        if "flip" in actions:
            return {**base, "type": "flip", "delay_ms": random.randint(600, 1200)}
        if "finish_game" in actions:
            return {**base, "type": "finish_game", "delay_ms": random.randint(1200, 2000)}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        try:
            state = copy.deepcopy(payload)
            if (not isinstance(state, dict) or state.get("game_id") != DareWordsGame.game_id
                    or type(state.get("version")) is not int or state["version"] != 1):
                raise ValueError("Invalid Dare to Make Words save.")
            saved_config = state.get("config")
            if not isinstance(saved_config, dict) or not _CONFIG_VALIDATOR.is_valid(saved_config):
                raise ValueError("Invalid saved config.")
            deck_size = saved_config.get("deck_size", DEFAULT_DECK_SIZE)
            min_chars = saved_config.get("min_chars", DEFAULT_MIN_PHRASE_CHARS)
            if (state.get("deck_size") != deck_size
                    or state.get("min_chars", min_chars) != min_chars):
                raise ValueError("Invalid saved deck size.")
            # Saves written before the phrase minimum became configurable carry
            # neither key, so both are normalized to the classic three.
            state["config"] = {"deck_size": deck_size, "min_chars": min_chars}
            state["min_chars"] = min_chars
            players = [state["players"][player_id] for player_id in state["turn_order"]]
            baseline = DareWordsGame.init_game(state["config"], players)
            if state["turn_order"] != baseline["turn_order"]:
                raise ValueError("Invalid saved players.")
            if not isinstance(state["game_token"], str) or len(state["game_token"]) != 32:
                raise ValueError("Invalid saved game token.")
            if state["phase"] not in ("flipping", "voting", "reveal", "game_over"):
                raise ValueError("Invalid saved phase.")
            if state["phase"] == "voting" and not isinstance(state.get("claim"), dict):
                raise ValueError("Invalid saved claim.")
            if state["phase"] != "voting" and state.get("claim") is not None:
                raise ValueError("Invalid saved claim.")
            if type(state["flips"]) is not int or state["flips"] < 0 or state["flips"] > DECK_SIZES[deck_size]:
                raise ValueError("Invalid saved flips.")
            source = list(SHORT_DECK_CHARACTERS if deck_size == "short" else DECK_CHARACTERS)
            if "initial_deck" in state:
                initial_deck = state["initial_deck"]
                if (not isinstance(initial_deck, list) or len(initial_deck) != DECK_SIZES[deck_size]
                        or any(not isinstance(character, str) or len(character) != 1
                               for character in initial_deck)):
                    raise ValueError("Invalid saved initial deck.")
                source_counts = Counter(source)
                initial_counts = Counter(initial_deck)
                common_counts = Counter({character: count for character, count in source_counts.items()
                                         if count > 1})
                if (initial_counts - Counter(source + list(EXTRA_DECK_CHARACTERS))
                        or common_counts - initial_counts):
                    raise ValueError("Invalid saved initial deck.")
                source = initial_deck
            drawn = [card["char"] for card in state["row"]]
            for entry in state["history"]:
                # Rejected claims leave their cards on the table, so they are already in the row.
                if entry["accepted"]:
                    drawn.extend(entry["characters"])
            if sorted(drawn + list(state["deck"])) != sorted(source):
                raise ValueError("Invalid saved deck contents.")
            if type(state["next_card_id"]) is not int or state["next_card_id"] != state["flips"] + 1:
                raise ValueError("Invalid saved card ids.")
            if any(type(card.get("card_id")) is not int or card["card_id"] < 1 for card in state["row"]):
                raise ValueError("Invalid saved row.")
            if len({card["card_id"] for card in state["row"]}) != len(state["row"]):
                raise ValueError("Invalid saved row.")
            scores = {player_id: state["players"][player_id]["score"] for player_id in state["turn_order"]}
            claimed = sum(entry["cards"] for entry in state["history"] if entry["accepted"])
            if sum(scores.values()) != claimed:
                raise ValueError("Invalid saved scores.")
            if state["game_over"] != (state["phase"] == "game_over"):
                raise ValueError("Invalid saved result.")
            best = max(scores.values()) if scores else 0
            expected_winner = [player_id for player_id in state["turn_order"] if scores[player_id] == best]
            if state["winner"] != (expected_winner if state["game_over"] else []):
                raise ValueError("Invalid saved winners.")
        except (KeyError, TypeError, IndexError, AttributeError) as error:
            raise ValueError("Invalid Dare to Make Words save.") from error
        return state
