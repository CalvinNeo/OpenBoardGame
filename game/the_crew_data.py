"""Mechanical mission data; descriptions are original summaries, not story text."""

import json
from pathlib import Path
from typing import Dict

SUITS = ("blue", "green", "yellow", "pink", "trump")
LABELS = {"blue": "蓝色🔵", "green": "绿色🟢", "yellow": "黄色🟡", "pink": "粉色🩷", "trump": "王牌⬛"}
SEA_TASKS = json.loads((Path(__file__).parent / "assets/the_crew/deep_sea_tasks.json").read_text())
SEA_BY_ID = {task["id"]: task for task in SEA_TASKS}

# count, tokens, communication, special rule. A numeric token gives absolute
# completion order, > tokens give relative order, and omega is the final task.
PLANET_MISSIONS = [
    (1, [], "normal", ""), (2, [], "normal", ""), (2, [1, 2], "normal", ""),
    (3, [], "normal", ""), (0, [], "normal", "sick"), (3, [">", ">>"], "hidden", ""),
    (3, ["omega"], "normal", ""), (3, [1, 2, 3], "normal", ""), (0, [], "normal", "one_low"),
    (4, [], "normal", ""), (4, [1], "normal", "mute"), (4, ["omega"], "normal", "exchange"),
    (0, [], "normal", "rockets"), (4, [">", ">>", ">>>"], "hidden", ""), (4, [1, 2, 3, 4], "normal", ""),
    (0, [], "normal", "no_nine"), (2, [], "normal", "no_nine"), (5, [], "delay2", ""),
    (5, [1], "delay3", ""), (2, [], "normal", "decision"), (5, [1, 2], "hidden", ""),
    (5, [">", ">>", ">>>", ">>>>"], "normal", ""), (5, [1, 2, 3, 4, 5], "normal", "swap_tokens"),
    (6, [], "normal", "distribution"), (6, [">", ">>"], "hidden", ""), (0, [], "normal", "two_low"),
    (3, [], "normal", "decision"), (6, [1, "omega"], "delay3", ""), (0, [], "hidden", "balance"),
    (6, [">", ">>", ">>>"], "delay2", ""), (6, [1, 2, 3], "normal", ""),
    (7, [], "normal", "distribution"), (0, [], "normal", "one_plain"), (0, [], "normal", "balance_captain"),
    (7, [">", ">>", ">>>"], "normal", ""), (7, [1, 2], "normal", "distribution"),
    (4, [], "normal", "decision"), (8, [], "delay3", ""), (8, [">", ">>", ">>>"], "hidden", ""),
    (8, [1, 2, 3], "normal", "move_token"), (0, [], "normal", "ends_plain"), (9, [], "normal", ""),
    (9, [], "normal", "distribution"), (0, [], "normal", "ordered_rockets"),
    (9, [">", ">>", ">>>"], "normal", ""), (0, [], "normal", "all_pink"), (10, [], "normal", ""),
    (3, ["omega"], "normal", "omega_last"), (10, [">", ">>", ">>>"], "normal", ""),
    (0, [], "normal", "relay"),
]

# The timed scenarios use the publisher's untimed alternatives. Difficulty is a
# sum of task costs, never a count of tasks. Verified against the logbook scans.
SEA_MISSIONS = [
    (1, "normal", ""), (2, "normal", ""), (3, "normal", ""), (4, "normal", ""),
    (5, "normal", ""), (5, "normal", "one_owner"), (6, "normal", ""), (0, "normal", "balance_nine"),
    (7, "hidden", ""), (4, "normal", "captain_or_one"), (8, "shared", ""), (0, "normal", "no_pink_trump_lead"),
    (5, "normal", "captain_or_one"), (6, "hidden", "volunteer"), (6, "shared", "volunteer"), (6, "none", "volunteer"),
    (9, "normal", "free"), (9, "normal", ""), (9, "normal", "hardest_captain"), (10, "random", ""),
    (0, "random", "balance_one"), (11, "random", ""), (0, "random_delay2", "first_ahead"), (12, "random", ""),
    (12, "random", "no_captain"), (12, "random", "two_volunteers"), (0, "random", "yellow_last"),
    (14, "normal", "free"), (15, "normal", "free"), (16, "normal", "free"), (17, "normal", "free"),
    (0, "normal", "finale"),
]

SPECIAL_TEXT = {
    "sick": "指挥官听取 Good / Bad 后指定一名成员；该成员整局不能赢墩。",
    "one_low": "用一张彩色 1 赢得一墩。", "two_low": "用彩色 1 赢得两墩。",
    "mute": "指挥官指定另一位成员，该成员本次不能通讯。",
    "exchange": "第一墩结算后，每人从右邻剩余手牌中随机取得一张牌，同时交换。",
    "rockets": "四张王牌各自作为最大牌赢得一墩。",
    "ordered_rockets": "依次用王牌 1、2、3、4 各赢一墩（中间可穿插其他墩）。",
    "no_nine": "整次任务不能由彩色 9 赢墩。",
    "decision": "任务暂不公开；各人只回答 Yes / No，指挥官指定另一位成员领取全部任务。",
    "distribution": "指挥官逐张亮出并分配任务；各人回答 Yes / No，最终每人的任务数相差不超过 1。",
    "swap_tokens": "开始选任务前，指挥官可按全队决定交换两个任务的次序标记。",
    "move_token": "开始选任务前，指挥官可按全队决定把一个次序标记移到无标记的任务上。",
    "balance": "每墩结算时，各人的已赢墩数最多相差 1。",
    "one_plain": "指挥官听取 Yes / No 后指定一人；该人恰好赢一墩，且不能用王牌赢该墩。",
    "balance_captain": "各人已赢墩数最多相差 1；指挥官必须赢第一墩和最后一墩。",
    "ends_plain": "指定一人仅赢第一墩与最后一墩；两墩均不能用王牌获胜。",
    "all_pink": "粉 9 的持有者公开身份，其左邻必须收齐九张粉色牌。",
    "omega_last": "Ω 对应的目标牌必须在最后一墩被正确收取。",
    "relay": "指定两人：一人仅赢第 1–4 墩，另一人仅赢末墩；其他成员赢中间所有墩。",
    "one_owner": "全队决定由一位成员领取全部任务，不得透露手牌。",
    "captain_or_one": "指挥官领取全部任务，或交给愿意接手的成员；转交后仅首墩前可通讯。",
    "volunteer": "从指挥官左邻起，每人只回答一次 Yes / No；第一位同意者领取全部任务，最后一位不可拒绝。",
    "two_volunteers": "从指挥官左邻起选出两位志愿者，自由分配任务；两人至少各领一个。",
    "balance_nine": "任何时候各人收取的彩色 9 最多相差 1。",
    "balance_one": "任何时候各人收取的彩色 1 最多相差 1。",
    "no_pink_trump_lead": "整次任务不能以粉色牌或王牌领出。",
    "hardest_captain": "指挥官先领取一个当前难度最高的任务，再顺时针选取其余任务。",
    "first_ahead": "首墩胜者的累计赢墩数必须始终严格多于每位其他成员；第二墩起才能通讯。",
    "no_captain": "任务顺时针分配，但指挥官始终跳过，不领取任务。",
    "yellow_last": "黄 5 必须作为最后一墩的最后一张牌打出，不能成为未出的余牌。",
    "free": "自由领取任务，可以讨论意愿，但不能透露手牌；任务数不必均分。",
    "finale": "使用指定的四张终局任务卡，按通常顺序分配。",
}


def mission_spec(edition: int, number: int, custom: Dict = None) -> Dict:
    if custom:
        return {"count": custom["task_count"], "difficulty": custom["difficulty"],
                "tokens": list(range(1, custom["task_count"] + 1)) if custom["order"] == "numbered" else
                [">" * i for i in range(1, min(4, custom["task_count"]) + 1)] if custom["order"] == "relative" else [],
                "communication": custom["communication"], "special": "", "text": "自由任务：完成所有个人目标。"}
    if edition == 1:
        count, tokens, communication, special = PLANET_MISSIONS[number - 1]
        return {"count": count, "tokens": tokens[:], "communication": communication,
                "special": special, "text": SPECIAL_TEXT.get(special, "完成全部目标牌任务。")}
    difficulty, communication, special = SEA_MISSIONS[number - 1]
    return {"difficulty": difficulty, "count": 0, "tokens": [], "communication": communication,
            "special": special, "text": SPECIAL_TEXT.get(special, "完成全部任务；任务难度总和须等于关卡难度。")}


def card_label(card_id: str) -> str:
    suit, rank = card_id.rsplit("_", 1)
    return f"{LABELS[suit]} {rank}"


def task_text(task: Dict, count: int) -> str:
    k = task["kind"]
    amount = task.get("count", 1)
    exact = "恰好" if task.get("op") == "exact" else "至少"
    if k == "winCards":
        return "收取 " + "、".join(map(card_label, task["cards"])) + ("，且在最后一墩" if task.get("inTrick") == 0 else "")
    if k == "winValue": return f"收取{exact} {amount} 张彩色 {task['value']}"
    if k == "winColor": return f"收取{exact} {amount} 张{LABELS[task['suit']]}牌"
    if k == "winColors": return "、".join(f"恰好 {p['count']} 张{LABELS[p['suit']]}牌" for p in task["parts"])
    if k == "avoid":
        suits = task.get("suits", [task["suit"]] if "suit" in task else ["trump"] if task.get("submarines") else [])
        return "不能收取 " + ("／".join(LABELS[s] for s in suits) if suits else "彩色 " + "／".join(map(str, task.get("values", [task.get("value")]))))
    if k == "winWith":
        tool = "王牌⬛" if task.get("suit") == "trump" else f"彩色 {task['value']}"
        target = card_label(task["captureCard"]) if "captureCard" in task else f"另一张彩色 {task['captureValue']}" if "captureValue" in task else "一墩"
        return f"用{tool}作为最大牌赢得{target}"
    if k == "winSubmarines": return f"收取恰好 {amount} 张王牌⬛" + (f"，只能是{card_label(task['onlyCard'])}" if "onlyCard" in task else "")
    if k == "trickCount": return f"恰好赢 {amount} 墩"
    if k == "skipFirstTricks": return f"不能赢前 {amount} 墩"
    if k == "consecutiveTricks":
        return "不能连赢两墩" if task["op"] == "none" else f"{'全局只赢' if task['op'] == 'exact' else '至少连赢'} {amount} 墩" + ("，且必须连续" if task["op"] == "exact" else "")
    if k == "nthTrick":
        return ("只能赢" if task.get("only") else "必须赢") + ("最后一墩" if task["n"] == 0 else "第一和最后一墩" if task.get("alsoLast") else f"前 {amount} 墩")
    if k == "predictTricks": return f"{'秘密' if task['reveal'] == 'hidden' else '公开'}预测赢墩数，最终必须恰好相等"
    if k == "compareTricks":
        who = {"eachOther": "每位其他成员", "othersCombined": "其他成员合计", "captain": "指挥官（自己不能是指挥官）"}[task["vs"]]
        return f"赢墩数{ {'moreThan':'多于','fewerThan':'少于','equalTo':'等于'}[task['op']] }{who}"
    if k == "collectAllColors": return "四种彩色牌各收取至少一张"
    if k == "collectAllOfOneColor": return "收齐任意一种颜色的九张牌"
    if k == "collectEqualColor": return f"{'同一墩' if task['inTrick'] else '全局'}收取同样多的{LABELS[task['a']]}与{LABELS[task['b']]}，各至少一张"
    if k == "collectMoreColor": return f"收取{LABELS[task['more']]}多于{LABELS[task['less']]}（后者可为 0）"
    if k == "noLead": return "不能用 " + "／".join(LABELS[s] for s in task["suits"]) + " 领出"
    if k == "trickFilter":
        rule = {"allEven": "全为偶数", "allOdd": "全为奇数", "allLt": "全小于 7", "allGt": "全大于 5"}[task["filter"]]
        return f"赢一墩：牌的点数{rule}，不能含王牌"
    if k == "trickSum":
        limit = "22 或 23" if "targets" in task else str(task["target"][count - 3])
        return f"赢一墩：总点数{ {'lt':'小于','gte':'至少','eq':'等于'}[task['op']] } {limit}，不能含王牌"
    raise ValueError(f"unsupported task kind: {k}")
