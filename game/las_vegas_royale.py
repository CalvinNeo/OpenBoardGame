"""Las Vegas Royale: three rounds, Biggies, chips and the sixteen casino tiles.

Rules: Ravensburger 26918, English and German manuals (2019), pp. 1-8.
Dice are physical pieces; their weight is computed separately from their number.
Pending decisions and the continuation queue are JSON data so reconnects and saves
can resume even when a different player must guess or divide a Black Box.
"""

import copy
import random
from collections import Counter
from typing import Dict, List, Optional, Tuple


NEUTRAL_ID = "__neutral__"
GRAY_ID = "__gray__"
TOTAL_ROUNDS = 3
CHIP_VALUE = 10000
BANKNOTES = tuple(value * 10000 for value, count in
                  ((3, 11), (4, 11), (5, 13), (6, 15), (7, 13), (8, 11), (9, 9), (10, 7))
                  for _ in range(count))
BLACK_BOX = (60000, 20000, 20000, 0, 0, 0)
TILE_PAIRS = (
    ("lucky_punch", "jackpot"), ("prime_time", "fifty_fifty"),
    ("high_five", "bad_luck"), ("pay_day", "power_play"),
    ("no_entry", "knockout"), ("block_it", "handicap"),
    ("black_box", "double_down"), ("nice_dice", "my_choice"),
)
TILE_NAMES = {
    "lucky_punch": "✊ Lucky Punch · 猜拳", "jackpot": "🎰 Jackpot · 累积大奖",
    "prime_time": "🎲 Prime Time · 黄金时段", "fifty_fifty": "↕ Fifty Fifty · 猜大小",
    "high_five": "🖐 High Five · 五骰大奖", "bad_luck": "💸 Bad Luck · 厄运",
    "pay_day": "💰 Pay Day · 发薪日", "power_play": "⚡ Power Play · 强势行动",
    "no_entry": "⛔ No Entry! · 禁止入内", "knockout": "🥊 Knockout? · 出局酒吧",
    "block_it": "⬜ Block It! · 灰骰阻挡", "handicap": "⬜ Handicap · 移除障碍",
    "black_box": "🎁 Black Box · 神秘盒", "double_down": "⏬ Double Down · 另开赌局",
    "nice_dice": "🎯 Nice Dice · 骰子奖励", "my_choice": "✨ My Choice · 我的选择",
}


def _name(state: Dict, pid: str) -> str:
    if pid == NEUTRAL_ID:
        return "中立骰 ⚪"
    if pid == GRAY_ID:
        return "灰骰 ⬜"
    return state["player_meta"][pid].get("name") or pid


def _log(state: Dict, message: str) -> None:
    state["log"].append({"round": state["round"], "text": message})


def _weight(die: Dict) -> int:
    return 2 if die["big"] else 1


def _pieces(state: Dict, pid: Optional[str] = None, location: Optional[str] = None) -> List[Dict]:
    return [die for die in state["pieces"] if (pid is None or die["player_id"] == pid)
            and (location is None or die["location"] == location)]


def _cash(state: Dict, pid: str) -> int:
    return sum(state["players"][pid]["banknotes"])


def _total(state: Dict, pid: str) -> int:
    return _cash(state, pid) + CHIP_VALUE * state["players"][pid]["chips"]


def _reward(state: Dict, pid: str, amount: int, reason: str) -> None:
    if not amount:
        return
    if amount < 30000:
        chips = amount // CHIP_VALUE
        state["players"][pid]["chips"] += chips
        _log(state, f"{_name(state, pid)} · {reason}：获得 {chips} 枚筹码 (🪙)。")
    else:
        state["players"][pid]["banknotes"].append(amount)
        _log(state, f"{_name(state, pid)} · {reason}：获得奖金 (💵 ${amount:,})。")


def _casino(state: Dict, face: int) -> Dict:
    casino = state["casinos"][face - 1]
    counts = {pid: 0 for pid in state["turn_order"]}
    for die in _pieces(state, location=f"casino:{face}"):
        counts[die["player_id"]] = counts.get(die["player_id"], 0) + _weight(die)
    counts[GRAY_ID] = casino["gray_dice"]
    positive = [(pid, count) for pid, count in counts.items() if count > 0]
    frequencies = Counter(count for _, count in positive)
    ranked = sorted(((pid, count) for pid, count in positive if frequencies[count] == 1),
                    key=lambda pair: pair[1], reverse=True)
    notes = sorted(casino["banknotes"], reverse=True)
    payouts = [{"player_id": pid, "amount": amount, "dice": count}
               for (pid, count), amount in zip(ranked, notes)]
    return {
        "face": face, "banknotes": notes, "dice": {pid: counts[pid] for pid in state["turn_order"]},
        "neutral_dice": counts.get(NEUTRAL_ID, 0), "gray_dice": counts[GRAY_ID],
        "tied_players": [pid for pid, count in positive if frequencies[count] > 1],
        "payouts": payouts,
        "returned": [amount for index, amount in enumerate(notes)
                     if index >= len(payouts) or payouts[index]["player_id"] not in state["players"]],
        "closed": state["closed_casino"] == face,
        "pieces": [copy.deepcopy(die) for die in _pieces(state, location=f"casino:{face}")],
    }


def _winner(state: Dict, face: int) -> Optional[str]:
    payouts = _casino(state, face)["payouts"]
    return payouts[0]["player_id"] if payouts else None


def _tile(state: Dict, face: int) -> Optional[Dict]:
    return next((tile for tile in state["tiles"] if tile["face"] == face), None)


def _left(state: Dict, pid: str) -> str:
    order = state["turn_order"]
    return order[(order.index(pid) + 1) % len(order)]


def _move(state: Dict, die: Dict, location: str, face: Optional[int] = None) -> None:
    die["location"] = location
    if face is not None:
        die["face"] = face
    for tile in state["tiles"]:
        if tile["id"] != "power_play" or not tile.get("owner"):
            continue
        result = _casino(state, tile["face"])
        counts = {**result["dice"], NEUTRAL_ID: result["neutral_dice"], GRAY_ID: result["gray_dice"]}
        owner_count = counts.get(tile["owner"], 0)
        if not owner_count or any(count >= owner_count for pid, count in counts.items() if pid != tile["owner"]):
            tile["owner"] = None


def _options_for_dice(pieces: List[Dict]) -> List[Dict]:
    """Interchangeable small dice need only one choice per location and face."""
    unique = {}
    for die in pieces:
        unique.setdefault((die["location"], die["face"], die["big"]), die)
    return list(unique.values())


def _die_label(die: Dict) -> str:
    return "大骰 🎲×2" if die["big"] else "小骰 🎲"


def _option(key: str, label: str, **data) -> Dict:
    return {"id": key, "label": label, **data}


def _ask(state: Dict, kind: str, actor: str, face: int, options: List[Dict], **context) -> None:
    if not options:
        return
    state["decision_seq"] += 1
    state["pending"] = {"id": state["decision_seq"], "kind": kind, "actor": actor,
                        "face": face, "options": options, "context": context}
    state.update(phase="royale_choice", current_turn=actor)


def _new_tile(tile_id: str, face: int) -> Dict:
    return {"id": tile_id, "face": face, "name": TILE_NAMES[tile_id], "owner": None,
            "jackpot": 30000, "track": 0, "groups": [1, 1, 2, 2, 3],
            "spaces": {"chip": 2, "cash": 3, "move": 4}, "last_roll": [], "last_result": ""}


def _start_round(state: Dict) -> None:
    pairs = [sorted(state["round_decks"][state["round"] - 1][i:i + 2], reverse=True)
             for i in range(0, 12, 2)]
    pairs.sort(key=lambda notes: (sum(notes), max(notes)))
    state.update(casinos=[{"face": i + 1, "banknotes": notes, "gray_dice": 0}
                          for i, notes in enumerate(pairs)],
                 pieces=[], closed_casino=None, pending=None, queue=[], round_summary=None,
                 round_results=[], next_ready=[], roll_ids=[], phase="roll", current_turn=state["start_player"])
    state["tiles"] = [_new_tile(random.choice(pair), face)
                      for face, pair in enumerate(random.sample(list(TILE_PAIRS), 3), 1)]
    state["round_start_totals"] = {}
    for pid, player in state["players"].items():
        player["chips"] += 2
        state["round_start_totals"][pid] = _total(state, pid)
        for index in range(8):
            state["pieces"].append({"id": f"{pid}:{index}", "player_id": pid, "big": index == 7,
                                    "face": 0, "location": "supply"})
    if len(state["players"]) == 2:
        for index in range(8):
            face = random.randint(1, 6)
            state["pieces"].append({"id": f"neutral:{index}", "player_id": NEUTRAL_ID,
                                    "big": index == 7, "face": face, "location": f"casino:{face}"})
    if any(tile["id"] == "handicap" for tile in state["tiles"]):
        for casino in state["casinos"]:
            casino["gray_dice"] = 1 if casino["face"] <= 3 else 2
    _log(state, f"Royale 第 {state['round']} / 3 轮：1–3 号赌场启用新小游戏，每人获得 2 枚筹码 (🪙)。")


def init_game(config: Dict, players: List[Dict]) -> Dict:
    if config.get("neutral_dice"):
        raise ValueError("Royale uses its own two-player neutral dice; disable the classic white-dice variant")
    if any(player["player_id"] == GRAY_ID for player in players):
        raise ValueError("reserved player ID")
    ids = [player["player_id"] for player in players]
    deck = list(BANKNOTES)
    random.shuffle(deck)
    state = {
        "game_id": "las_vegas", "version": 2, "config": {"edition": "royale", "neutral_dice": False},
        "players": {pid: {"banknotes": [], "chips": 0} for pid in ids},
        "player_meta": {p["player_id"]: copy.deepcopy(p) for p in players}, "turn_order": ids,
        "round_decks": [deck[i:i + 12] for i in range(0, 36, 12)], "banknote_deck": deck[36:],
        "round": 1, "turn": 1, "decision_seq": 0, "start_player": random.choice(ids),
        "log": [], "game_over": False, "winner": [], "final_results": [],
    }
    _start_round(state)
    return state


def _manipulate_options(state: Dict, actor: str) -> List[Dict]:
    options = [_option("skip", "Skip · 不移动骰子")]
    for die in _options_for_dice(_pieces(state, actor, "supply")):
        for face in range(1, 7):
            if face != state["closed_casino"]:
                options.append(_option(f"place:{die['id']}:{face}", f"{_die_label(die)} → 赌场 {face}",
                                       die=die["id"], face=face, operation="place"))
    for die in _options_for_dice(_pieces(state, actor)):
        if die["location"].startswith("casino:") and die["face"] != state["closed_casino"]:
            options.append(_option(f"return:{die['id']}", f"取回赌场 {die['face']} 的{_die_label(die)}",
                                   die=die["id"], operation="return"))
    return options


def _activate(state: Dict, face: int, actor: str, rolled: List[str], placed: List[str]) -> None:
    tile = _tile(state, face)
    if not tile:
        return
    kind = tile["id"]
    _log(state, f"{_name(state, actor)} 激活赌场 {face} · {TILE_NAMES[kind]}。")
    if kind == "lucky_punch":
        _ask(state, "lucky_hide", actor, face,
             [_option(str(n), f"藏 {n} 枚 · 猜错可得 {reward}", number=n)
              for n, reward in ((1, "2🪙"), (2, "$30K"), (3, "$40K"))])
    elif kind == "jackpot":
        dice = [random.randint(1, 6), random.randint(1, 6)]
        tile["last_roll"] = dice
        if sum(dice) == 7 or dice[0] == dice[1]:
            _reward(state, actor, tile["jackpot"], "Jackpot")
            tile["last_result"] = f"中奖 ${tile['jackpot']:,}"
            tile["jackpot"] = 30000
        else:
            tile["jackpot"] = min(80000, tile["jackpot"] + 10000)
            tile["last_result"] = f"未中奖 · 奖池升至 ${tile['jackpot']:,}"
        _log(state, f"Jackpot 🎲 {dice[0]} + {dice[1]}：{tile['last_result']}。")
    elif kind == "fifty_fifty":
        tile["track"] = 0
        tile["last_roll"] = [random.randint(1, 6), random.randint(1, 6)]
        _fifty_choice(state, actor, tile)
    elif kind == "high_five":
        if tile["owner"] is None and _casino(state, face)["dice"][actor] >= 5:
            tile["owner"] = actor
            _log(state, f"{_name(state, actor)} 取得五骰大奖标记 (🖐 $100,000)，轮末领取。")
    elif kind == "pay_day":
        amount = sum(bool(_pieces(state, actor, f"casino:{i}")) for i in range(1, 7)) * CHIP_VALUE
        _reward(state, actor, amount, "Pay Day")
    elif kind == "power_play":
        result = _casino(state, face)
        counts = {**result["dice"], NEUTRAL_ID: result["neutral_dice"], GRAY_ID: result["gray_dice"]}
        if counts[actor] > max(count for pid, count in counts.items() if pid != actor):
            tile["owner"] = actor
    elif kind == "no_entry":
        options = [_option(str(i), f"⛔ 关闭赌场 {i}", face=i) for i in range(1, 7)
                   if i not in (face, state["closed_casino"])]
        if state["closed_casino"] is not None:
            options.append(_option("skip", "Keep · 保持当前封锁"))
        _ask(state, kind, actor, face, options)
    elif kind == "knockout":
        for die in _pieces(state, actor, "knockout"):
            _move(state, die, "supply")
        order = state["turn_order"]
        start = order.index(actor)
        state["queue"][:0] = [{"kind": "knockout_choice", "actor": order[(start + i) % len(order)], "face": face}
                              for i in range(1, len(order))]
    elif kind == "block_it":
        options = [_option(f"{i}:{target}", f"{count}⬜ → 赌场 {target}", group=i, face=target)
                   for i, count in enumerate(tile["groups"]) if count
                   for target in range(1, 7) if target != state["closed_casino"]]
        _ask(state, kind, actor, face, options)
    elif kind == "handicap":
        labels = {"chip": "1🪙", "cash": "$30K", "move": "调整自己的骰子"}
        options = [_option(f"{i}:{reward}", f"移除赌场 {i} 的 1⬜ → {labels[reward]}", source=i, reward=reward)
                   for i in range(1, 7) if state["casinos"][i - 1]["gray_dice"] and i != state["closed_casino"]
                   for reward, count in tile["spaces"].items() if count]
        _ask(state, kind, actor, face, options + [_option("skip", "Skip · 不移除灰骰")])
    elif kind == "double_down":
        if face == state["closed_casino"]:
            return
        own = _pieces(state, actor, f"casino:{face}")
        small = [die for die in own if not die["big"]]
        big = [die for die in own if die["big"]]
        _ask(state, kind, actor, face,
             [_option(f"{n}:{b}", "Keep · 全部留在赌场" if n + b == 0 else f"转移 {n} 小骰 + {b} 大骰到 ⏬",
                      dice=[die["id"] for die in small[:n] + big[:b]])
              for n in range(len(small) + 1) for b in range(len(big) + 1)])
    elif kind == "nice_dice":
        options = [_option("skip", "Skip · 不放置奖励骰")]
        eligible = []
        for die in _pieces(state, actor):
            in_roll = die["id"] in rolled and die["location"] == "supply"
            just_placed = die["id"] in placed and die["location"] == f"casino:{face}" and face != state["closed_casino"]
            occupied = _pieces(state, location=f"nice:{die['face']}")
            if (in_roll or just_placed) and not (occupied and die["face"] == state["closed_casino"]):
                eligible.append(die)
        for die in _options_for_dice(eligible):
            options.append(_option(die["id"], f"{die['face']} 点{_die_label(die)} → 奖励格", die=die["id"]))
        _ask(state, kind, actor, face, options)
    elif kind == "my_choice":
        tile["last_roll"] = [random.randint(1, 6), random.randint(1, 6)]
        labels = {1: "+1🪙", 2: "+2🪙", 3: "+$30K", 4: "激活另一块小游戏板", 5: "调整自己的骰子", 6: "占据 $60K 奖励格"}
        _ask(state, kind, actor, face, [_option(str(n), f"🎲 {n} · {labels[n]}", number=n)
                                      for n in sorted(set(tile["last_roll"]))], rolled=rolled, placed=placed)


def _fifty_choice(state: Dict, actor: str, tile: Dict) -> None:
    reward = (0, 10000, 30000, 40000, 60000)[tile["track"]]
    options = [_option("stop", f"Collect · 领取 {'1🪙' if reward == 10000 else '$' + format(reward, ',')}")]
    if tile["track"] < 4:
        options += [_option("higher", "Higher · 下一次总点数更大"), _option("lower", "Lower · 下一次总点数更小")]
    _ask(state, "fifty_fifty", actor, tile["face"], options, total=sum(tile["last_roll"]), reward=reward)


def _resolve_choice(state: Dict, pending: Dict, option: Dict) -> None:
    kind, actor, face = pending["kind"], pending["actor"], pending["face"]
    context, key = pending["context"], option["id"]
    tile = _tile(state, face)
    if kind == "lucky_hide":
        _ask(state, "lucky_guess", _left(state, actor), face,
             [_option(str(n), f"猜 {n} 枚", number=n) for n in range(1, 4)], winner=actor, secret=option["number"])
    elif kind == "lucky_guess":
        number = context["secret"]
        success = option["number"] != number
        _log(state, f"Lucky Punch 揭晓：藏了 {number} 枚，{_name(state, actor)} 猜 {option['number']} 枚。")
        if success:
            _reward(state, context["winner"], {1: 20000, 2: 30000, 3: 40000}[number], "Lucky Punch")
        tile["last_result"] = "猜错，奖励已发放" if success else "猜中，无奖励"
    elif kind == "fifty_fifty":
        if key == "stop":
            _reward(state, actor, context["reward"], "Fifty Fifty")
            tile["last_result"] = f"领取 ${context['reward']:,} 等值奖励"
        else:
            previous = context["total"]
            tile["last_roll"] = [random.randint(1, 6), random.randint(1, 6)]
            total = sum(tile["last_roll"])
            success = total > previous if key == "higher" else total < previous
            _log(state, f"Fifty Fifty 🎲 {previous} → {total}：{'猜中' if success else '未猜中，本次奖励归零'}。")
            if success:
                tile["track"] += 1
                _fifty_choice(state, actor, tile)
            else:
                tile["last_result"] = "猜错，奖励归零"
    elif kind == "no_entry" and key != "skip":
        state["closed_casino"] = option["face"]
        tile["track"] = (tile["track"] + 1) % 6
        _reward(state, actor, (0, 20000, 0, 30000, 0, 10000)[tile["track"]], "No Entry!")
    elif kind == "knockout":
        die = next(die for die in state["pieces"] if die["id"] == option["die"])
        _move(state, die, "knockout")
    elif kind == "block_it":
        state["casinos"][option["face"] - 1]["gray_dice"] += tile["groups"][option["group"]]
        tile["groups"][option["group"]] = 0
        # Recheck Power Play when the imaginary gray player changes a majority.
        if state["pieces"]:
            _move(state, state["pieces"][0], state["pieces"][0]["location"])
    elif kind == "handicap" and key != "skip":
        state["casinos"][option["source"] - 1]["gray_dice"] -= 1
        tile["spaces"][option["reward"]] -= 1
        if option["reward"] == "move":
            _ask(state, "manipulate", actor, face, _manipulate_options(state, actor))
        else:
            _reward(state, actor, 10000 if option["reward"] == "chip" else 30000, "Handicap")
    elif kind in ("manipulate", "power") and key != "skip":
        die = next(die for die in state["pieces"] if die["id"] == option["die"])
        if option["operation"] == "return":
            _move(state, die, "supply")
        else:
            _move(state, die, f"casino:{option['face']}", option["face"])
            if kind == "power":
                state["queue"].insert(0, {"kind": "activate", "face": option["face"], "actor": actor,
                                          "rolled": [], "placed": [die["id"]]})
    elif kind == "double_down":
        for die in state["pieces"]:
            if die["id"] in option["dice"]:
                _move(state, die, "double_down")
    elif kind == "nice_dice" and key != "skip":
        die = next(die for die in state["pieces"] if die["id"] == option["die"])
        for previous in _pieces(state, location=f"nice:{die['face']}"):
            _move(state, previous, f"casino:{previous['face']}")
        _move(state, die, f"nice:{die['face']}")
    elif kind == "my_choice":
        number = option["number"]
        if number <= 3:
            _reward(state, actor, number * CHIP_VALUE, "My Choice")
        elif number == 4:
            _ask(state, "activate_other", actor, face,
                 [_option(str(t["face"]), f"赌场 {t['face']} · {t['name']}", face=t["face"])
                  for t in state["tiles"] if t["face"] != face], **context)
        elif number == 5:
            _ask(state, "manipulate", actor, face, _manipulate_options(state, actor))
        else:
            _ask(state, "golden", actor, face,
                 [_option(d["id"], f"放置{_die_label(d)} · 轮末 $60K", die=d["id"])
                  for d in _options_for_dice(_pieces(state, actor, "supply"))])
    elif kind == "activate_other":
        state["queue"].insert(0, {"kind": "activate", "face": option["face"], "actor": actor, **context})
    elif kind == "golden":
        for previous in _pieces(state, location="golden"):
            _move(state, previous, "supply")
        die = next(die for die in state["pieces"] if die["id"] == option["die"])
        _move(state, die, "golden")
    elif kind == "prime_time":
        for index, target in enumerate(context["roll"]):
            if option["mask"] & (1 << index):
                state["pieces"].append({"id": f"extra:{index}", "player_id": actor, "face": target,
                                        "big": False, "location": f"casino:{target}", "extra": True})
    elif kind == "black_split":
        groups = [[value for i, value in enumerate(BLACK_BOX) if bool(option["mask"] & (1 << i)) == side]
                  for side in (True, False)]
        _ask(state, "black_pick", context["winner"], face,
             [_option(str(i), f"盒 {'AB'[i]} · {len(group)} 块标记", group=i) for i, group in enumerate(groups)], groups=groups)
    elif kind == "black_pick":
        amount = sum(context["groups"][option["group"]])
        _reward(state, actor, amount, "Black Box")
        _log(state, f"Black Box 揭晓：选择的盒子合计 ${amount:,}。")


def _pay_fine(state: Dict, pid: str) -> None:
    player = state["players"][pid]
    amount = min(50000, _total(state, pid))
    remaining = amount
    # Pay money before chips. The digital bank keeps exact change as banknotes,
    # never creates spendable pass chips when giving change.
    while remaining and player["banknotes"]:
        note = min(player["banknotes"])
        player["banknotes"].remove(note)
        if note > remaining:
            player["banknotes"].append(note - remaining)
        remaining = max(0, remaining - note)
    player["chips"] -= remaining // CHIP_VALUE
    _log(state, f"{_name(state, pid)} · Bad Luck：支付罚金 (💸 ${amount:,})。")


def _begin_settlement(state: Dict) -> None:
    state["phase"] = "royale_settle"
    state["round_results"] = []
    state["queue"] += [{"kind": "prime", "face": t["face"]} for t in state["tiles"] if t["id"] == "prime_time"]
    state["queue"].append({"kind": "payouts"})


def _settle_payouts(state: Dict) -> None:
    state["round_results"] = [_casino(state, face) for face in range(1, 7)]
    for result in state["round_results"]:
        for payout in result["payouts"]:
            if payout["player_id"] in state["players"]:
                state["players"][payout["player_id"]]["banknotes"].append(payout["amount"])
                _log(state, f"赌场 {result['face']}：{_name(state, payout['player_id'])} 获得 💵 ${payout['amount']:,}。")
        state["banknote_deck"].extend(result["returned"])
    for tile in state["tiles"]:
        face, kind = tile["face"], tile["id"]
        if kind == "high_five" and tile["owner"]:
            _reward(state, tile["owner"], 100000, "High Five")
        elif kind == "nice_dice":
            for die in state["pieces"]:
                if die["location"].startswith("nice:"):
                    _reward(state, die["player_id"], die["face"] * CHIP_VALUE, "Nice Dice")
        elif kind == "my_choice":
            for die in _pieces(state, location="golden"):
                _reward(state, die["player_id"], 60000, "My Choice")
        elif kind == "double_down":
            counts = {pid: sum(_weight(d) for d in _pieces(state, pid, "double_down")) for pid in state["turn_order"]}
            frequencies = Counter(count for count in counts.values() if count)
            ranked = sorted((pid for pid in counts if counts[pid] and frequencies[counts[pid]] == 1),
                            key=lambda pid: counts[pid], reverse=True)
            for pid, amount in zip(ranked, (60000, 30000)):
                _reward(state, pid, amount, "Double Down")
        elif kind == "black_box":
            winner = _winner(state, face)
            if winner in state["players"]:
                state["queue"].append({"kind": "black_box", "face": face, "actor": _left(state, winner), "winner": winner})
    state["queue"].append({"kind": "finish_settlement"})


def _finish_settlement(state: Dict) -> None:
    for tile in state["tiles"]:
        if tile["id"] == "bad_luck":
            counts = _casino(state, tile["face"])["dice"]
            minimum = min(counts.values())
            for pid, count in counts.items():
                if count == minimum:
                    _pay_fine(state, pid)
    state.update(phase="round_end", current_turn=None, next_ready=[], roll_ids=[],
                 round_summary={"round": state["round"], "casinos": copy.deepcopy(state["round_results"]),
                                "earnings": [{"player_id": pid, "amount": _total(state, pid) - state["round_start_totals"][pid],
                                              "banknotes": []} for pid in state["turn_order"]],
                                "neutral_returned": sum(row["amount"] for c in state["round_results"] for row in c["payouts"]
                                                        if row["player_id"] not in state["players"])})
    _log(state, "本轮小游戏和赌场奖金均已结算，等待所有玩家确认。")


def _advance(state: Dict, actor: str) -> None:
    state["turn"] += 1
    state["roll_ids"] = []
    order = state["turn_order"]
    index = order.index(actor)
    for offset in range(1, len(order) + 1):
        pid = order[(index + offset) % len(order)]
        if _pieces(state, pid, "supply"):
            state.update(current_turn=pid, phase="roll")
            return
    _begin_settlement(state)


def _drain(state: Dict) -> None:
    while state["queue"] and not state["pending"]:
        task = state["queue"].pop(0)
        kind = task["kind"]
        if kind == "activate":
            _activate(state, task["face"], task["actor"], task["rolled"], task["placed"])
        elif kind == "advance":
            _advance(state, task["actor"])
        elif kind == "knockout_choice":
            pid = task["actor"]
            if len(_pieces(state, pid, "knockout")) < 2:
                _ask(state, "knockout", pid, task["face"],
                     [_option(d["id"], f"送入酒吧：{_die_label(d)}", die=d["id"])
                      for d in _options_for_dice(_pieces(state, pid, "supply"))])
        elif kind == "prime":
            winner = _winner(state, task["face"])
            if winner in state["players"]:
                dice = [random.randint(1, 6), random.randint(1, 6)]
                _tile(state, task["face"])["last_roll"] = dice
                options = [_option(str(mask), "Skip · 不加骰" if mask == 0 else "、".join(
                    f"🎲 {face} → 赌场 {face}" for index, face in enumerate(dice) if mask & (1 << index)), mask=mask)
                    for mask in range(4) if not any(mask & (1 << i) and face == state["closed_casino"] for i, face in enumerate(dice))]
                _ask(state, "prime_time", winner, task["face"], options, roll=dice)
        elif kind == "payouts":
            _settle_payouts(state)
        elif kind == "black_box":
            options = [_option(str(mask), " + ".join(f"${value // 1000}K" for i, value in enumerate(BLACK_BOX)
                                                    if mask & (1 << i)), mask=mask) for mask in range(1, 63)]
            _ask(state, "black_split", task["actor"], task["face"], options, winner=task["winner"])
        elif kind == "finish_settlement":
            _finish_settlement(state)


def get_legal_actions(state: Dict, pid: str) -> List[str]:
    if not isinstance(pid, str) or pid not in state["players"] or state["game_over"]:
        return []
    if state["phase"] == "round_end":
        return [] if pid in state["next_ready"] else ["next_round"]
    if state["current_turn"] != pid:
        return []
    if state["pending"]:
        return ["royale_choose"]
    if state["phase"] == "roll":
        actions = ["roll"]
        if any(t["id"] == "power_play" and t["owner"] == pid for t in state["tiles"]):
            actions.append("royale_power")
        return actions
    if state["phase"] == "place":
        available = any(d["face"] != state["closed_casino"] for d in state["pieces"] if d["id"] in state["roll_ids"])
        return (["place"] if available else []) + (["royale_pass"] if state["players"][pid]["chips"] or not available else [])
    return []


def _continue(state: Dict) -> None:
    if state["round"] == 3:
        rows = [{"player_id": pid, "total": _total(state, pid), "banknote_count": len(p["banknotes"]),
                 "chips": p["chips"]} for pid, p in state["players"].items()]
        rows.sort(key=lambda r: (r["total"], r["banknote_count"] + r["chips"]), reverse=True)
        previous, rank = None, 0
        for index, row in enumerate(rows, 1):
            score = (row["total"], row["banknote_count"] + row["chips"])
            if score != previous:
                rank = index
            row["rank"], previous = rank, score
        state.update(game_over=True, phase="game_over", current_turn=None, final_results=rows,
                     winner=[r["player_id"] for r in rows if r["rank"] == 1])
        return
    for result in reversed(state["round_results"]):
        if result["payouts"] and result["payouts"][0]["player_id"] in state["players"]:
            state["start_player"] = result["payouts"][0]["player_id"]
            break
    state["round"] += 1
    _start_round(state)


def apply_action(state: Dict, pid: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
    if action["type"] not in get_legal_actions(state, pid):
        return [], "action unavailable"
    if action["round"] != state["round"] or ("turn" in action and action["turn"] != state["turn"]):
        return [], "stale action"
    kind = action["type"]
    if kind == "royale_choose":
        pending = state["pending"]
        option = next((o for o in pending["options"] if o["id"] == action["option"]), None)
        if action["decision"] != pending["id"] or option is None:
            return [], "stale or invalid decision"
        state["pending"] = None
        _resolve_choice(state, pending, option)
        _drain(state)
    elif kind == "next_round":
        state["next_ready"].append(pid)
        if len(state["next_ready"]) == len(state["players"]):
            _continue(state)
    elif kind == "roll":
        own = _pieces(state, pid, "supply")
        for die in own:
            die["face"] = random.randint(1, 6)
        state.update(phase="place", roll_ids=[d["id"] for d in own])
        _log(state, f"{_name(state, pid)} 掷出 {len(own)} 枚骰子 (🎲)。")
    elif kind == "place":
        face = action["face"]
        placed = [d for d in state["pieces"] if d["id"] in state["roll_ids"] and d["face"] == face and d["location"] == "supply"]
        if face == state["closed_casino"] or not placed:
            return [], "casino closed or face unavailable"
        rolled = list(state["roll_ids"])
        for die in placed:
            _move(state, die, f"casino:{face}")
        _log(state, f"{_name(state, pid)} 在赌场 {face} 放置 {len(placed)} 枚骰子，排名计 {sum(_weight(d) for d in placed)}。")
        state["queue"] = [{"kind": "activate", "actor": pid, "face": face, "rolled": rolled, "placed": [d["id"] for d in placed]},
                          {"kind": "advance", "actor": pid}]
        _drain(state)
    elif kind == "royale_pass":
        if "place" in get_legal_actions(state, pid):
            state["players"][pid]["chips"] -= 1
            _log(state, f"{_name(state, pid)} 支付 1🪙，跳过本次投放。")
        else:
            _log(state, f"{_name(state, pid)} 只掷出被封锁的点数，本回合无法投放。")
        _advance(state, pid)
        _drain(state)
    elif kind == "royale_power":
        options = [o for o in _manipulate_options(state, pid) if o.get("operation") == "place"]
        state["queue"] = [{"kind": "advance", "actor": pid}]
        _ask(state, "power", pid, next(t["face"] for t in state["tiles"] if t["id"] == "power_play"), options)
    # Secret choices never appear in public action events.
    return [{"type": "las_vegas:royale", "payload": {"player_id": pid, "type": kind}}], None


def get_public_view(state: Dict, viewer: str) -> Dict:
    own = state["players"].get(viewer)
    pending = state["pending"]
    decision = None
    if pending:
        decision = {k: pending[k] for k in ("id", "kind", "actor", "face")}
        decision["options"] = [{"id": o["id"], "label": o["label"]} for o in pending["options"]] if pending["actor"] == viewer else []
        decision["total"] = pending["context"].get("total")
        decision["reward"] = pending["context"].get("reward")
        if pending["kind"] == "black_split" and pending["actor"] == viewer:
            decision["tokens"] = list(BLACK_BOX)
    roll = [d for d in state["pieces"] if d["id"] in state["roll_ids"]]
    result = {
        "game_id": "las_vegas", "you": viewer, "config": state["config"], "edition": "royale",
        "phase": state["phase"], "round": state["round"], "total_rounds": 3, "turn": state["turn"],
        "current_turn": state["current_turn"], "start_player": state["start_player"],
        "game_over": state["game_over"], "winner": state["winner"], "next_ready": state["next_ready"],
        "legal_actions": get_legal_actions(state, viewer), "roll": {"own": [d["face"] for d in roll], "neutral": []},
        "roll_pieces": roll, "casinos": [_casino(state, face) for face in range(1, 7)],
        "tiles": state["tiles"], "decision": decision, "closed_casino": state["closed_casino"],
        "tile_pieces": [d for d in state["pieces"] if d["location"] not in ("supply",) and not d["location"].startswith("casino:")],
        "round_summary": state["round_summary"], "final_results": state["final_results"], "log": state["log"],
        "your_banknotes": own["banknotes"] if own else [], "your_total": _total(state, viewer) if own else None,
        "your_cash": _cash(state, viewer) if own else None,
        "players": [{"player_id": pid, "name": _name(state, pid), "seat": state["player_meta"][pid].get("seat", 0),
                     "is_bot": bool(state["player_meta"][pid].get("is_bot")), "color": index,
                     "remaining": len(_pieces(state, pid, "supply")), "neutral_remaining": 0,
                     "big_remaining": any(d["big"] for d in _pieces(state, pid, "supply")),
                     "chips": state["players"][pid]["chips"], "banknote_count": len(state["players"][pid]["banknotes"]),
                     "total": _total(state, pid) if state["game_over"] or pid == viewer else None}
                    for index, pid in enumerate(state["turn_order"])],
    }
    return copy.deepcopy(result)


def choose_bot_action(view: Dict) -> Optional[Dict]:
    legal = view["legal_actions"]
    base = {"round": view["round"], "turn": view["turn"]}
    if "next_round" in legal:
        return {"type": "next_round", "round": view["round"]}
    if "royale_choose" in legal:
        decision = view["decision"]
        options = decision["options"]
        if decision["kind"] == "fifty_fifty":
            choice = "stop" if decision["reward"] >= 30000 else "higher" if decision["total"] < 7 else "lower"
            option = next((o for o in options if o["id"] == choice), options[0])
        elif decision["kind"] in ("lucky_hide", "lucky_guess", "black_split", "black_pick"):
            option = random.choice(options)
        else:
            option = next((o for o in reversed(options) if o["id"] != "skip"), options[0])
        return {"type": "royale_choose", **base, "decision": decision["id"], "option": option["id"]}
    if "roll" in legal:
        return {"type": "roll", **base}
    if "place" in legal:
        candidates = sorted(set(view["roll"]["own"]) - {view["closed_casino"]})
        def score(face: int) -> Tuple[int, int]:
            casino = view["casinos"][face - 1]
            extra = sum(_weight(d) for d in view["roll_pieces"] if d["face"] == face)
            counts = {**casino["dice"], NEUTRAL_ID: casino["neutral_dice"], GRAY_ID: casino["gray_dice"]}
            counts[view["you"]] += extra
            frequencies = Counter(n for n in counts.values() if n)
            ranked = sorted((pid for pid, n in counts.items() if n and frequencies[n] == 1), key=counts.get, reverse=True)
            amount = 0
            if view["you"] in ranked and ranked.index(view["you"]) < len(casino["banknotes"]):
                amount = casino["banknotes"][ranked.index(view["you"])]
            return amount + (20000 if face <= 3 else 0) - extra * 1500, -face
        return {"type": "place", **base, "face": max(candidates, key=score)}
    if "royale_pass" in legal:
        return {"type": "royale_pass", **base}
    return None
