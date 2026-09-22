"""Verified 16-card base set. Artwork is deliberately not bundled."""

RULES_VERSION = "black-maze-deep-base-1"
SOURCES = {
    "publisher": "https://www.yellowsubmarine.co.jp/hobbybase/game/reddoor/card.htm",
    "faq": "https://humaoz.wixsite.com/ozplanning/q-a-akaitobira",
    "cards": "https://note.com/hobby_base/n/n16e387d27cf7",
}

# name, Japanese name, icon, count, effect. Descriptions are our own summaries.
_CARDS = (
    ("silver_key", "银钥匙", "銀の鍵", "🔑", 3,
     "暗置持有。全桌持有三把钥匙时可以尝试出口；三把全是银钥匙才会成功。"),
    ("killer_key", "杀人鬼的钥匙", "殺人鬼の鍵", "🗝️", 1,
     "首次取得必须暗置持有，并成为杀人鬼。失去钥匙或死亡都不会解除身份。"),
    ("trap", "杀人鬼的陷阱", "殺人鬼の罠", "☠️", 1,
     "公开后死亡；防弹背心可免死一次并移除。无论是否死亡，归还全部持有物，连同陷阱重洗场地。"),
    ("empty", "空房", "何も無い部屋", "🚪", 2,
     "暗置放回原位置，不发生效果。之后仍可再次打开。"),
    ("exit", "逃生出口", "脱出口", "🚪✨", 1,
     "可以暗置放回。全桌持有三把钥匙时可以公开并尝试逃脱：三银则普通人全体胜；混入杀人鬼钥匙则杀人鬼全体胜。"),
    ("inspect", "看破违和感", "違和感の看破", "👁️", 1,
     "可以暗置放回，或公开此牌并翻开其他玩家的一张暗钥匙。银钥匙留在原持有人面前明置；杀人鬼钥匙移出本局，其持有人仍是杀人鬼。"),
    ("vest", "防弹背心", "防弾チョッキ", "🦺", 1,
     "公开持有。抵挡一次陷阱或射击后移出本局；保护后仍归还其他持有物并重洗场地。"),
    ("gun", "手枪", "拳銃", "🔫", 1,
     "公开持有。只有打开有子弹的房间时才能选择射击；射击本身不消耗手枪。"),
    ("ammo", "有子弹的房间", "弾丸のある部屋", "🔸", 1,
     "可暗置放回；持有手枪时可公开并射击一名存活玩家。命中者死亡（背心可保护），归还其持有物，连同此房间重洗场地。"),
    ("gas", "催眠瓦斯", "催眠ガス", "💨", 2,
     "公开并移出本局。归还自己的全部持有物，所有场地牌重新暗置洗牌；没有持有物也洗牌。"),
    ("clue", "不起眼的线索", "小さな手掛かり", "🔎", 2,
     "此牌公开留场。私下查看另一张暗门，然后原位放回；查看不触发效果，也不会让你成为杀人鬼。"),
)
CARD_DEFS = {
    key: {"name": name, "name_ja": ja, "icon": icon, "count": count, "text": effect}
    for key, name, ja, icon, count, effect in _CARDS
}
KEYS = ("silver_key", "killer_key")
ITEMS = ("vest", "gun")
CONFIG_SCHEMA = {
    "type": "object", "properties": {"seed": {"type": ["integer", "string"]}},
    "additionalProperties": False,
}


def _action(kind, **properties):
    fields = {"type": {"const": kind}, **properties}
    return {"type": "object", "properties": fields, "required": list(fields),
            "additionalProperties": False}


_TOKEN = {"type": "string", "minLength": 1, "maxLength": 100}
_INT = {"type": "integer", "minimum": 1}
ACTION_SCHEMA = {"oneOf": [
    _action("open_door", door_id=_TOKEN, board_epoch=_INT, turn_id=_INT),
    _action("resolve_door", choice={"enum": ["use", "return", "escape"]}, effect_id=_TOKEN),
    _action("choose_target", target_id=_TOKEN, effect_id=_TOKEN),
    _action("ack_private", effect_id=_TOKEN),
    _action("ack_review", review_id=_TOKEN),
    _action("set_next_mode", mode={"enum": ["again", "finish"]}, review_id=_TOKEN),
    _action("next_round", review_id=_TOKEN),
]}
