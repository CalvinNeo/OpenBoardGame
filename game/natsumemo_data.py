"""Natsumemo card effects, checked against the Traditional Chinese card faces.

Sources and the complete numerical inventory are recorded in designs/task142.md.
Only rules data is reproduced; the client uses its own CSS and emoji artwork.
"""

from typing import Dict, List, Optional


TITLES = {
    "caretaker": "基地管理员", "solo_gamer": "单人玩家", "swimmer": "游泳健将",
    "regular": "常客", "firestarter": "生火专家", "zoologist": "动物博士",
    "lifeguard": "自称救生员", "family": "和睦的家庭", "grandchild": "乖孙",
    "solitaire": "左右互搏", "entomologist": "昆虫博士", "festival": "夜市通",
    "detective": "少年侦探", "survivor": "求生大师", "candy": "零食评论家",
    "fireworks": "烟火师", "peter_pan": "彼得潘", "park": "年票 VIP",
    "slacker": "偷懒虫", "super_slacker": "超级偷懒虫", "prepared": "预习达人",
}


def _card(week: int, kind: str, name: str, emoji: str, days: int, mechanic: str,
          values: List[int], solo: Optional[int], title: str, hearts: int = 1,
          homework: int = 0) -> Dict:
    descriptions = {
        "repeat": "自己第 1 / 2 / 3–4 次参加：⭐ 3 / 6 / 10。",
        "same": f"角色相同：⭐ {values[0]}；男女混合：⭐ {values[-1]}。",
        "even": f"偶数人参加：⭐ {values[0]}；奇数人：⭐ {values[-1]}。",
        "balanced": f"男孩和女孩人数相等：⭐ {values[0]}；否则：⭐ {values[-1]}。",
        "pair": f"恰好 2 人参加：⭐ {values[0]}；3 人以上：⭐ {values[-1]}。",
        "fixed": f"每人 ⭐ {values[0]}，不受参加人数影响。",
        "candy": "自己前两周每参加过一次活动得 ⭐ 1，含学习会，不含在家写作业。",
        "roll": f"各掷一骰：唯一最高 ⭐ {values[0]}；并列最高各 ⭐ {values[1] if len(values) > 1 else 0}；其他人 ⭐ {values[-1]}。",
        "choose": f"各自秘密选 1–6 点：唯一最高 ⭐ {values[0]}；并列最高各 ⭐ {values[1] if len(values) > 1 else 0}；其他人 ⭐ {values[-1]}。",
        "bugs": "各掷一骰：" + ("⚀：⭐ 3；⚁–⚃：⭐ 5；⚄–⚅：⭐ 6。" if week == 2 else "⚀–⚁：⭐ 3；⚂–⚄：⭐ 7；⚅：⭐ 10。"),
    }
    description = descriptions[mechanic]
    if mechanic == "fixed":
        if homework:
            description += f"完成 ✏️ {homework} 页。"
        description += f"获得 🏅 {TITLES[title]}。"
    else:
        description += f"\n独自参加：{'按上述计分' if solo is None else f'⭐ {solo}'}，获得 🏅 {TITLES[title]}。"
        description += f"\n多人参加每人分配 ❤️ {hearts}。"
    return {"id": f"w{week}_{kind}", "week": week, "kind": kind, "name": name, "emoji": emoji,
            "days": days, "mechanic": mechanic, "values": values, "solo": solo, "title": title,
            "hearts": hearts, "homework": homework, "description": description,
            "contest": "choose" if mechanic == "choose" else "roll" if mechanic in ("roll", "bugs") else None}


# Order follows the printed card numbers, nine unique cards per week.
_SPECS = [
    (1, "base", "盖秘密基地", "🛖", 1, "repeat", [3, 6, 10, 10], None, "caretaker"),
    (1, "video", "打电动", "🎮", 1, "roll", [6, 8, 4], 2, "solo_gamer"),
    (1, "pool", "游泳池", "🏊", 1, "same", [3, 6], 2, "swimmer"),
    (1, "shopping", "买东西", "🛍️", 1, "pair", [7, 4], 2, "regular"),
    (1, "bbq", "烧烤", "🍖", 1, "even", [6, 3], 2, "firestarter"),
    (1, "zoo", "动物园", "🦁", 1, "same", [6, 4], 2, "zoologist"),
    (1, "sea", "海水浴场", "🏖️", 2, "same", [7, 10], 6, "lifeguard", 2),
    (1, "family", "家庭旅游", "🚆", 2, "fixed", [8], None, "family", 0, 2),
    (1, "grandparents", "看望祖父母", "🏡", 3, "fixed", [12], None, "grandchild", 0, 3),
    (2, "base", "盖秘密基地", "🛖", 1, "repeat", [3, 6, 10, 10], None, "caretaker"),
    (2, "boardgames", "玩桌游", "🎲", 1, "choose", [8, 4, 6], 2, "solitaire"),
    (2, "bugs", "抓虫", "🪲", 1, "bugs", [3, 5, 5, 5, 6, 6], None, "entomologist"),
    (2, "festival", "夜市", "🏮", 1, "balanced", [8, 6], 3, "festival"),
    (2, "bbq", "烧烤", "🍖", 1, "even", [7, 3], 2, "firestarter"),
    (2, "explore", "街头探险", "🧭", 1, "same", [7, 5], 2, "detective"),
    (2, "camp", "露营", "🏕️", 2, "even", [10, 8], 6, "survivor", 2),
    (2, "sea", "海水浴场", "🏖️", 2, "same", [7, 12], 6, "lifeguard", 2),
    (2, "abroad", "出国旅游", "✈️", 3, "fixed", [18], None, "family", 0),
    (3, "base", "盖秘密基地", "🛖", 1, "repeat", [3, 6, 10, 10], None, "caretaker"),
    (3, "video", "打电动", "🎮", 1, "roll", [7, 8, 4], 2, "solo_gamer"),
    (3, "candy", "零食店", "🍬", 1, "candy", [0], 2, "candy"),
    (3, "fireworks", "烟火大会", "🎆", 1, "balanced", [9, 6], 2, "fireworks"),
    (3, "zoo", "动物园", "🦁", 1, "same", [7, 5], 2, "zoologist"),
    (3, "camp", "露营", "🏕️", 2, "even", [12, 8], 6, "survivor", 2),
    (3, "sleepover", "过夜悄悄话", "🛌", 2, "same", [12, 10], 6, "peter_pan", 2),
    (3, "family", "家庭旅游", "🚆", 2, "fixed", [8], None, "family", 0, 2),
    (3, "grandparents", "看望祖父母", "🏡", 3, "fixed", [12], None, "grandchild", 0, 3),
    (4, "base", "盖秘密基地", "🛖", 1, "repeat", [3, 6, 10, 10], None, "caretaker"),
    (4, "boardgames", "玩桌游", "🎲", 1, "choose", [10, 4, 8], 2, "solitaire"),
    (4, "pool", "游泳池", "🏊", 1, "same", [5, 8], 2, "swimmer"),
    (4, "park", "游乐园", "🎡", 1, "balanced", [10, 8], 4, "park"),
    (4, "explore", "街头探险", "🧭", 1, "same", [9, 5], 2, "detective"),
    (4, "bugs", "抓虫", "🪲", 1, "bugs", [3, 3, 7, 7, 7, 10], None, "entomologist"),
    (4, "shopping", "买东西", "🛍️", 1, "pair", [10, 6], 2, "regular"),
    (4, "sleepover", "过夜悄悄话", "🛌", 2, "same", [16, 10], 6, "peter_pan", 2),
    (4, "abroad", "出国旅游", "✈️", 3, "fixed", [24], None, "family", 0),
]
CARDS = {card["id"]: card for card in (_card(*spec) for spec in _SPECS)}


def study_card(week: int) -> Dict:
    points, homework = (2, 3) if week == 4 else (3, 2)
    return {"id": f"study_{week}", "week": week, "kind": "study", "name": "周三学习会", "emoji": "📚",
            "days": 1, "mechanic": "study", "values": [points], "homework": homework, "hearts": 1,
            "description": f"多人：⭐ {points}、✏️ {homework} 页、❤️ 1。\n独自参加：只完成 ✏️ {homework + 1} 页。"}


def activity_reward(card: Dict, attendees: List[str], pid: str, players: Dict,
                    dice: Optional[Dict] = None) -> Dict:
    """Resolve a printed effect; without dice, return an estimate for the bot."""
    count, mechanic, values = len(attendees), card["mechanic"], card["values"]
    reward = {"points": 0, "homework": card.get("homework", 0),
              "hearts": card["hearts"] if count > 1 else 0, "titles": []}
    if mechanic == "study":
        reward.update(points=values[0] if count > 1 else 0,
                      homework=card["homework"] + (1 if count == 1 else 0))
        return reward
    if mechanic == "fixed":
        reward.update(points=values[0], titles=[card["title"]])
        return reward
    if count == 1:
        reward["titles"] = [card["title"]]
        if card["solo"] is not None:
            reward["points"] = card["solo"]
            return reward
    roles = [players[p]["role"] for p in attendees]
    if mechanic == "repeat":
        points = values[min(3, players[pid]["visits"].get(card["kind"], 0))]
    elif mechanic == "same":
        points = values[0 if len(set(roles)) == 1 else 1]
    elif mechanic == "even":
        points = values[count % 2]
    elif mechanic == "balanced":
        points = values[0 if roles.count("boy") == roles.count("girl") else 1]
    elif mechanic == "pair":
        points = values[0 if count == 2 else 1]
    elif mechanic == "candy":
        points = len({cell["id"] for week in players[pid]["calendar"][:2] for cell in week
                      if cell and cell["kind"] != "homework"})
    elif mechanic == "bugs":
        points = values[dice[pid] - 1] if dice and pid in dice else sum(values) / 6
    elif mechanic in ("roll", "choose"):
        if not dice:
            points = sum(values) / 3
        else:
            maximum = max(dice.values())
            points = values[2] if dice[pid] < maximum else values[1] if list(dice.values()).count(maximum) > 1 else values[0]
    else:
        raise ValueError("unknown activity effect")
    reward["points"] = points
    return reward


def homework_reward(week: int, die: int) -> Dict:
    if week == 4:
        return {"points": 5 if die <= 2 else 0, "homework": 0 if die <= 2 else 4 if die == 6 else 3,
                "titles": ["super_slacker"] if die <= 2 else []}
    return {"points": 3 if die == 1 else 0, "homework": 0 if die == 1 else 3 if die == 6 else 2,
            "titles": ["slacker"] if die == 1 else []}
