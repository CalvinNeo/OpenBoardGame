"""The Crew, both campaigns, with authoritative private-information rules."""

import copy
import itertools
import random
import secrets
import jsonschema
from typing import Dict, List, Optional, Tuple

from game.the_crew_data import SUITS, SEA_TASKS, mission_spec, task_text
from game.the_crew_tasks import evaluate_task

HELPER = "__the_crew_helper__"
DEFAULT_CONFIG = {"edition": 1, "mode": "campaign", "mission": 1, "task_count": 3,
                  "difficulty": 5, "order": "none", "communication": "normal"}
CONFIG_SCHEMA = {
    "type": "object", "properties": {
        "edition": {"type": "integer", "enum": [1, 2], "default": 1},
        "mode": {"enum": ["campaign", "custom"], "default": "campaign"},
        "mission": {"type": "integer", "minimum": 1, "maximum": 50, "default": 1},
        "task_count": {"type": "integer", "minimum": 1, "maximum": 10, "default": 3},
        "difficulty": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5},
        "order": {"enum": ["none", "numbered", "relative"], "default": "none"},
        "communication": {"enum": ["normal", "hidden", "none"], "default": "normal"},
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
    }, "additionalProperties": False,
}
CONTEXT = {"game_token": {"type": "string"}, "attempt_id": {"type": "integer"}, "step": {"type": "integer"}}
ACTION_FIELDS = {
    "take_task": {"task_id": {"type": "string"}, "actor": {"type": "string"}}, "pass_task": {},
    "respond": {"actor": {"type": "string"}, "yes": {"type": "boolean"}},
    "assign": {"player_id": {"type": "string"}},
    "tokens": {"first": {"type": "integer"}, "second": {"type": "integer"}}, "keep_tokens": {},
    "predict": {"task_id": {"type": "string"}, "value": {"type": "integer", "minimum": 0, "maximum": 13}},
    "ready": {}, "play": {"card_id": {"type": "string"}},
    "communicate": {"card_id": {"type": "string"}, "marker": {"enum": ["highest", "lowest", "only"]}},
    "distress": {"direction": {"enum": ["left", "right"]}},
    "distress_vote": {"yes": {"type": "boolean"}},
    "exchange": {"actor": {"type": "string"}, "card_id": {"type": "string"}},
    "handover": {"task_id": {"type": "string"}, "player_id": {"type": "string"}},
    "next_round": {}, "next_mission": {},
}
ACTION_SCHEMA = {"oneOf": [{"type": "object", "properties": {**CONTEXT, "type": {"const": kind}, **fields},
                            "required": ["type", *CONTEXT, *fields], "additionalProperties": False}
                           for kind, fields in ACTION_FIELDS.items()]}
ACTION_VALIDATOR = jsonschema.Draft7Validator(ACTION_SCHEMA)


def build_deck() -> List[Dict]:
    return [{"id": f"{s}_{n}", "suit": s, "rank": n} for s in SUITS for n in range(1, 5 if s == "trump" else 10)]


def resolve_trick(plays: List[Dict]) -> str:
    led = plays[0]["card"]["suit"]
    return max(plays, key=lambda p: (2 if p["card"]["suit"] == "trump" else 1 if p["card"]["suit"] == led else 0,
                                    p["card"]["rank"]))["player_id"]


def _rng(state: Dict, purpose: str) -> random.Random:
    return random.Random(f"{state['seed']}:{state['attempt_id']}:{purpose}")


def _config(config: Optional[Dict]) -> Dict:
    cfg = {} if config is None else config
    try:
        jsonschema.validate(cfg, CONFIG_SCHEMA)
    except jsonschema.ValidationError as exc:
        raise ValueError("invalid The Crew configuration") from exc
    cfg = {**DEFAULT_CONFIG, **cfg}
    if cfg["edition"] == 2 and cfg["mode"] == "campaign" and cfg["mission"] > 32:
        raise ValueError("Deep Sea has 32 campaign missions")
    return cfg


def _controller(state: Dict, actor: str) -> str:
    return state["captain"] if actor == HELPER else actor


def _hand(state: Dict, actor: str) -> List[Dict]:
    if actor != HELPER:
        return state["players"][actor]["hand"]
    return [col[-1] for i, col in enumerate(state["helper_columns"]) if col and i not in state["helper_pending"]]


def _all_hand(state: Dict, actor: str) -> List[Dict]:
    return [c for col in state["helper_columns"] for c in col] if actor == HELPER else _hand(state, actor)


def _transition(state: Dict, phase: str, actor: Optional[str] = None) -> None:
    state.update(phase=phase, current_turn=actor, ready=[], step=state["step"] + 1)


def _deal(state: Dict, index: int = 0) -> None:
    deck = build_deck()
    rng = _rng(state, f"deal:{index}")
    state["helper_columns"], state["helper_pending"] = [], []
    if len(state["humans"]) == 2:
        top = deck.pop()
        rng.shuffle(deck)
        lower = [deck.pop() for _ in range(7)]
        state["helper_columns"] = [[c, deck.pop()] for c in lower]
        deck.append(top)
    rng.shuffle(deck)
    for pid in state["humans"]:
        state["players"][pid] = {"hand": []}
    for i, card in enumerate(deck):
        state["players"][state["humans"][i % len(state["humans"]) ]]["hand"].append(card)
    for pid in state["humans"]:
        state["players"][pid]["hand"].sort(key=lambda c: (SUITS.index(c["suit"]), c["rank"]))
    state["captain"] = next(p for p in state["humans"] if any(c["id"] == "trump_4" for c in _hand(state, p)))
    state["total_tricks"] = 40 // len(state["seats"])


def _draw_tasks(state: Dict) -> List[Dict]:
    spec = state["spec"]
    if state["config"]["edition"] == 1:
        cards = [c for c in build_deck() if c["suit"] != "trump"]
        _rng(state, "tasks").shuffle(cards)
        tasks = [{"id": f"planet_{c['id']}", "kind": "winCards", "cards": [c["id"]]} for c in cards[:spec["count"]]]
        for i, token in enumerate(spec["tokens"]): tasks[i]["token"] = token
        return tasks
    if spec["special"] == "finale":
        return [copy.deepcopy(t) for t in SEA_TASKS if
                (t["kind"] == "trickCount" and t["count"] == 0) or
                (t["kind"] == "consecutiveTricks" and ((t["count"] == 3 and t["op"] == "exact") or (t["count"] == 2 and t["op"] == "atLeast"))) or
                (t["kind"] == "nthTrick" and t.get("alsoLast"))]
    cards = copy.deepcopy(SEA_TASKS)
    _rng(state, "tasks").shuffle(cards)
    tasks, left = [], spec["difficulty"]
    for task in cards:
        cost = task["difficulty"][len(state["seats"]) - 3]
        if 0 < cost <= left:
            tasks.append(task)
            left -= cost
            if not left: break
    return tasks


def _impossible_deal(state: Dict) -> bool:
    for t in state["tasks"]:
        for pid in state["seats"]:
            ids = {c["id"] for c in _all_hand(state, pid)}
            rockets = {i for i in range(1, 5) if f"trump_{i}" in ids}
            condition = t.get("redealIf")
            if condition == "allSubmarines" and len(rockets) == 4: return True
            if condition == "sub234" and {2, 3, 4} <= rockets: return True
            if condition == "sub1and4or123" and ({1, 4} <= rockets or {1, 2, 3} <= rockets): return True
            if condition == "sub2and4or123" and ({2, 4} <= rockets or {1, 2, 3} <= rockets): return True
            if t["kind"] == "winWith" and t.get("suit") == "trump" and len(rockets) == 4 and t.get("captureCard") in ids: return True
    return False


def _draw_compatible_tasks(state: Dict) -> List[Dict]:
    # In a single draft round a seat cannot own conflicting first/only-last
    # objectives. Replace an objectively contradictory draw without an attempt.
    tasks = _draw_tasks(state)
    if len(tasks) > len(state["seats"]): return tasks
    seen, replacement = set(), copy.deepcopy(SEA_TASKS)
    _rng(state, "replacement").shuffle(replacement)
    for i, task in enumerate(tasks):
        def required(t):
            if t["kind"] != "nthTrick": return set()
            return ({state["total_tricks"]} if t["n"] == 0 else set(range(1, t.get("count", 1) + 1))) | ({state["total_tricks"]} if t.get("alsoLast") else set())
        needs = required(task)
        if seen & needs:
            cost = task["difficulty"][len(state["seats"]) - 3]
            alt = next(t for t in replacement if t["id"] not in {x["id"] for x in tasks} and
                       t["difficulty"][len(state["seats"]) - 3] == cost and not required(t))
            tasks[i] = copy.deepcopy(alt)
            needs = set()
        seen.update(needs)
    return tasks


def _start_attempt(state: Dict) -> None:
    cfg = state["config"]
    state["attempt_id"] += 1
    state["spec"] = mission_spec(cfg["edition"], state["mission"], cfg if cfg["mode"] == "custom" else None)
    spec = state["spec"]
    communication = spec["communication"]
    if communication.startswith("random"):
        state["terrain_card"] = _rng(state, "terrain").choice([c for c in build_deck() if c["suit"] != "trump"])
        communication = ["normal", "hidden", "shared"][(state["terrain_card"]["rank"] - 1) // 3]
    else: state["terrain_card"] = None
    state.update(communication=communication, shared_tokens=len(state["seats"]) - 2,
                 communications={p: [] for p in state["seats"]}, responses={}, volunteers=[],
                 selected_members=[], predictions={}, trick=[], tricks=[], trick_number=1,
                 trick_result=None, result=None, distress_proposal=None, exchange_cards={},
                 distress_used=False, handover_used=False, completed_order=[],
                 status_notes=[], ready=[], draft_index=0, mute=None, target=None)
    _deal(state)
    state["tasks"] = _draw_compatible_tasks(state) if cfg["edition"] == 2 else _draw_tasks(state)
    for i in range(1, 1001):
        if not _impossible_deal(state): break
        _deal(state, i)
    else: raise ValueError("could not generate a feasible deal")
    for task in state["tasks"]:
        task.update(owner=None, status="pending", progress=[])
    captain = state["captain"]
    n = state["seats"].index(captain)
    state["draft_order"] = state["seats"][n:] + state["seats"][:n]
    special = spec["special"]
    if special == "all_pink":
        holder = next(p for p in state["seats"] if any(c["id"] == "pink_9" for c in _all_hand(state, p)))
        state["pink_holder"] = holder
        state["target"] = state["seats"][(state["seats"].index(holder) + 1) % len(state["seats"])]
    else: state["pink_holder"] = None
    if special in ("swap_tokens", "move_token"):
        _transition(state, "tokens", captain)
    elif special in ("sick", "decision", "one_plain", "ends_plain", "distribution"):
        _transition(state, "responses")
    elif special in ("mute", "one_owner", "captain_or_one", "relay"):
        _transition(state, "assign", captain)
    elif special in ("volunteer", "two_volunteers"):
        state["volunteer_queue"] = state["draft_order"][1:] + [captain]
        _transition(state, "volunteer", state["volunteer_queue"][0])
    else:
        _start_draft(state)


def _start_draft(state: Dict) -> None:
    if state["spec"]["special"] == "no_captain":
        state["draft_order"] = [p for p in state["draft_order"] if p != state["captain"]]
    if not any(t["owner"] is None for t in state["tasks"]):
        _preflight(state)
    else:
        _transition(state, "draft", state["draft_order"][0])


def _preflight(state: Dict) -> None:
    if any(t["kind"] == "predictTricks" and t["id"] not in state["predictions"] for t in state["tasks"]):
        _transition(state, "predict")
    else:
        _transition(state, "preflight")


def _start_trick(state: Dict, leader: str) -> None:
    i = state["seats"].index(leader)
    state["trick_order"] = state["seats"][i:] + state["seats"][:i]
    state["trick"] = []
    _transition(state, "playing", leader)


def legal_cards(state: Dict, player_id: str) -> List[str]:
    if state["phase"] != "playing" or _controller(state, state["current_turn"]) != player_id: return []
    hand = _hand(state, state["current_turn"])
    led = state["trick"][0]["card"]["suit"] if state["trick"] else None
    follow = [c for c in hand if c["suit"] == led]
    return [c["id"] for c in follow or hand]


def communication_options(state: Dict, pid: str) -> List[Dict]:
    if pid not in state["humans"] or pid == state["mute"]: return []
    phase = state["phase"]
    if phase not in ("preflight", "playing", "trick_review"): return []
    if phase == "playing" and state["trick"]: return []
    if state["result"]: return []
    upcoming = state["trick_number"] + (phase == "trick_review")
    comm = state["communication"]
    if comm == "none" or comm.startswith("delay") and upcoming < int(comm[-1]): return []
    if state["spec"]["communication"] == "random_delay2" and upcoming < 2: return []
    if state["spec"]["special"] == "captain_or_one" and state["target"] != state["captain"] and upcoming > 1: return []
    if comm == "shared":
        if state["shared_tokens"] <= 0: return []
    elif state["communications"][pid]: return []
    hand = _hand(state, pid)
    shown = {m["card"]["id"] for m in state["communications"][pid]}
    result = []
    for c in hand:
        if c["suit"] == "trump" or c["id"] in shown: continue
        suited = [o["rank"] for o in hand if o["suit"] == c["suit"]]
        markers = ["only"] if len(suited) == 1 else [m for m, value in (("highest", max(suited)), ("lowest", min(suited))) if c["rank"] == value]
        if markers: result.append({"card_id": c["id"], "markers": markers})
    return result


def _eligible_tasks(state: Dict, actor: str) -> List[str]:
    tasks = [t for t in state["tasks"] if t["owner"] is None and (t.get("captainMaySelect", True) or actor != state["captain"])]
    if tasks and state["spec"]["special"] == "hardest_captain" and state["draft_index"] == 0:
        cost = max(t["difficulty"][len(state["seats"]) - 3] for t in tasks)
        tasks = [t for t in tasks if t["difficulty"][len(state["seats"]) - 3] == cost]
    if state["spec"]["special"] == "two_volunteers":
        if actor not in state["volunteers"]: return []
        needs = [p for p in state["volunteers"] if not any(t["owner"] == p for t in state["tasks"])]
        if len(tasks) <= len(needs) and actor not in needs: return []
    return [t["id"] for t in tasks]


def _can_pass(state: Dict) -> bool:
    return (state["config"]["edition"] == 2 and state["spec"]["special"] not in ("free", "two_volunteers") and
            len(state["tasks"]) < len(state["draft_order"]) and
            sum(t["owner"] is None for t in state["tasks"]) < len(state["draft_order"]) - state["draft_index"])


def _assignable(state: Dict) -> List[str]:
    special = state["spec"]["special"]
    seats = state["seats"]
    if special in ("decision", "mute"): return [p for p in seats if p != state["captain"]]
    if special == "relay": return [p for p in seats if p not in state["selected_members"]]
    if special in ("one_owner", "captain_or_one") and any(not t.get("captainMaySelect", True) for t in state["tasks"]):
        return [p for p in seats if p != state["captain"]]
    if special == "distribution":
        task = next(t for t in state["tasks"] if t["owner"] is None)
        counts = {p: sum(t["owner"] == p for t in state["tasks"]) for p in seats}
        floor, ceil = len(state["tasks"]) // len(seats), (len(state["tasks"]) + len(seats) - 1) // len(seats)
        left = sum(t["owner"] is None for t in state["tasks"]) - 1
        return [p for p in seats if counts[p] < ceil and
                sum(max(0, floor - counts[q] - (p == q)) for q in seats) <= left and
                (p != state["captain"] or task.get("captainMaySelect", True))]
    return seats[:]


def _planet_order(state: Dict) -> Optional[str]:
    tricks = state["tricks"]
    last = tricks[-1]
    captured = {p["card"]["id"] for p in last["plays"]}
    fresh = [t for t in state["tasks"] if t["cards"][0] in captured and t["status"] == "pending"]
    if any(t["owner"] != last["winner"] for t in fresh): return "目标牌被其他成员收取。"
    prior = set(state["completed_order"])
    for order in itertools.permutations(fresh):
        done = set(prior)
        for task in order:
            token = task.get("token")
            if isinstance(token, int) and token != len(done) + 1: break
            if token == "omega" and len(done) + 1 != len(state["tasks"]): break
            if isinstance(token, str) and token.startswith(">"):
                before = [t["id"] for t in state["tasks"] if isinstance(t.get("token"), str) and t["token"].startswith(">") and len(t["token"]) < len(token)]
                if not set(before) <= done: break
            if token == "omega" and state["spec"]["special"] == "omega_last" and last["number"] != state["total_tricks"]: break
            done.add(task["id"])
        else:
            for task in order:
                task["status"] = "complete"
                state["completed_order"].append(task["id"])
            return None
    return "任务完成次序不符合标记。"


def _special_result(state: Dict) -> Tuple[bool, Optional[str]]:
    special, tricks = state["spec"]["special"], state["tricks"]
    seats, captain = state["seats"], state["captain"]
    end = len(tricks) == state["total_tricks"]
    counts = {p: sum(t["winner"] == p for t in tricks) for p in seats}
    winning = [next(p["card"] for p in t["plays"] if p["player_id"] == t["winner"]) for t in tricks]
    target = state["target"]
    if special in ("sick", "one_plain", "ends_plain", "relay"):
        if special == "sick": return end, "指定成员赢了墩。" if counts[target] else None
        if special == "one_plain":
            bad = counts[target] > 1 or any(c["suit"] == "trump" for c, t in zip(winning, tricks) if t["winner"] == target)
            return end and counts[target] == 1, "指定成员必须恰好用彩色牌赢一墩。" if bad else None
        first, last = (target, target) if special == "ends_plain" else state["selected_members"]
        for t, c in zip(tricks, winning):
            front = t["number"] <= (1 if special == "ends_plain" else 4)
            back = t["number"] == state["total_tricks"]
            bad = t["winner"] != first if front else t["winner"] != last if back else t["winner"] in (first, last)
            if special == "ends_plain" and (front or back) and c["suit"] == "trump": bad = True
            if bad: return False, "指定成员的首墩／末墩分工未完成。"
        return end, None
    if special in ("one_low", "two_low"):
        return sum(c["suit"] != "trump" and c["rank"] == 1 for c in winning) >= (1 if special == "one_low" else 2), None
    if special in ("rockets", "ordered_rockets"):
        used = [p["card"]["rank"] for t in tricks for p in t["plays"] if p["card"]["suit"] == "trump"]
        won = [c["rank"] for c in winning if c["suit"] == "trump"]
        if len(used) != len(won) or special == "ordered_rockets" and won != list(range(1, len(won) + 1)):
            return False, "有王牌未能赢墩，或王牌赢墩次序错误。"
        return len(won) == 4, None
    if special == "no_nine": return end, "彩色 9 赢了墩。" if any(c["suit"] != "trump" and c["rank"] == 9 for c in winning) else None
    if special in ("balance", "balance_captain", "balance_nine", "balance_one"):
        if special in ("balance_nine", "balance_one"):
            rank = 9 if special == "balance_nine" else 1
            counts = {p: sum(c["card"]["suit"] != "trump" and c["card"]["rank"] == rank for t in tricks if t["winner"] == p for c in t["plays"]) for p in seats}
        if max(counts.values()) - min(counts.values()) > 1: return False, "成员间的累计数量相差超过 1。"
        if special == "balance_captain" and (tricks[0]["winner"] != captain or end and tricks[-1]["winner"] != captain):
            return False, "指挥官没有赢得第一墩或最后一墩。"
        return end, None
    if special == "all_pink":
        owned = [p["card"] for t in tricks if t["winner"] == target for p in t["plays"] if p["card"]["suit"] == "pink"]
        bad = any(p["card"]["suit"] == "pink" for t in tricks if t["winner"] != target for p in t["plays"])
        return len(owned) == 9, "粉色牌被其他成员收取。" if bad else None
    if special == "no_pink_trump_lead":
        return end, "以粉色牌或王牌领出了。" if any(t["plays"][0]["card"]["suit"] in ("pink", "trump") for t in tricks) else None
    if special == "first_ahead":
        first = tricks[0]["winner"]
        return end, "首墩胜者未能保持赢墩数严格领先。" if any(counts[first] <= counts[p] for p in seats if p != first) else None
    if special == "yellow_last":
        for t in tricks:
            for i, p in enumerate(t["plays"]):
                if p["card"]["id"] == "yellow_5":
                    ok = t["number"] == state["total_tricks"] and i == len(seats) - 1
                    return ok, None if ok else "黄 5 没有作为全局最后一张牌打出。"
        return False, None
    return True, None


def _finish_attempt(state: Dict, success: bool, reason: str) -> None:
    state["result"] = {"success": success, "reason": reason, "mission": state["mission"], "attempt": state["attempt"],
                       "counted_attempts": state["attempt"] + int(state["distress_active"])}
    state["journal"].append(copy.deepcopy(state["result"]))
    _transition(state, "mission_review")


def _finish_trick(state: Dict) -> None:
    winner = resolve_trick(state["trick"])
    trick = {"number": state["trick_number"], "winner": winner, "plays": copy.deepcopy(state["trick"])}
    state["tricks"].append(trick)
    state["trick_result"] = trick
    state["helper_pending"] = []
    error = None
    if state["config"]["edition"] == 1: error = _planet_order(state)
    else:
        for task in state["tasks"]:
            task["status"] = evaluate_task(task, task["owner"], state["tricks"], state["seats"], state["captain"], state["total_tricks"], state["predictions"].get(task["id"]))
            if task["status"] == "failed": error = "任务失败：" + task_text(task, len(state["seats"]))
    special_ok, special_error = _special_result(state)
    error = error or special_error
    if error:
        _finish_attempt(state, False, error)
    elif all(t["status"] == "complete" for t in state["tasks"]) and special_ok:
        _finish_attempt(state, True, "全部任务完成。")
    elif len(state["tricks"]) == state["total_tricks"]:
        _finish_attempt(state, False, "手牌已打完，仍有任务未完成。")
    else:
        _transition(state, "trick_review")


def _take_card(state: Dict, actor: str, card_id: str) -> Dict:
    if actor == HELPER:
        for i, col in enumerate(state["helper_columns"]):
            if col and col[-1]["id"] == card_id and i not in state["helper_pending"]:
                state["helper_pending"].append(i)
                return col.pop()
    hand = state["players"][actor]["hand"]
    c = next(c for c in hand if c["id"] == card_id)
    hand.remove(c)
    return c


def _random_exchange(state: Dict) -> None:
    rng, passed = _rng(state, "mission12_exchange"), {}
    # A communicated card remains on the table; the random draw is from the
    # concealed hand. The helper uses available face-up cards in the two-seat variant.
    for pid in state["seats"]:
        shown = {m["card"]["id"] for m in state["communications"][pid]}
        choices = [c for c in _hand(state, pid) if c["id"] not in shown]
        passed[pid] = _take_card(state, pid, rng.choice(choices)["id"])
    _deliver_exchange(state, passed, 1)
    state["status_notes"].append("第一墩后的随机换牌已完成。")


def _deliver_exchange(state: Dict, passed: Dict, direction: int) -> None:
    for i, actor in enumerate(state["seats"]):
        recipient = state["seats"][(i + direction) % len(state["seats"])]
        if recipient == HELPER:
            col = state["helper_pending"][0]
            state["helper_columns"][col].append(passed[actor])
        else:
            state["players"][recipient]["hand"].append(passed[actor])
            state["players"][recipient]["hand"].sort(key=lambda c: (SUITS.index(c["suit"]), c["rank"]))
    state["helper_pending"] = []


class TheCrewGame:
    game_id, min_players, max_players = "the_crew", 2, 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 2 <= len(players) <= 5: raise ValueError("The Crew requires 2 to 5 players")
        cfg = _config(config)
        meta = {p["player_id"]: dict(p) for p in players}
        if len(meta) != len(players) or HELPER in meta: raise ValueError("invalid player IDs")
        order = sorted(meta, key=lambda p: (meta[p].get("seat", 0), p))
        state = {"version": 1, "config": cfg, "game_token": secrets.token_hex(16), "seed": cfg.get("seed", secrets.token_hex(16)),
                 "player_meta": meta, "humans": order, "seats": order + ([HELPER] if len(order) == 2 else []),
                 "players": {}, "mission": cfg["mission"], "attempt": 1, "attempt_id": 0, "step": 0, "revision": 0,
                 "journal": [], "distress_active": False, "game_over": False, "winner_ids": []}
        _start_attempt(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["humans"] or state["game_over"]: return []
        phase, captain = state["phase"], state["captain"]
        controls = [p for p in state["seats"] if _controller(state, p) == player_id]
        current = state["current_turn"]
        actions = []
        if phase == "tokens" and player_id == captain: actions = ["tokens", "keep_tokens"]
        elif phase == "responses" and any(p not in state["responses"] for p in controls): actions = ["respond"]
        elif phase == "assign" and player_id == captain: actions = ["assign"]
        elif phase == "volunteer" and current in controls: actions = ["respond"]
        elif phase == "draft":
            free = state["spec"]["special"] in ("free", "two_volunteers")
            if (free and any(_eligible_tasks(state, p) for p in controls)) or current in controls:
                if any(_eligible_tasks(state, p) for p in controls) if free else _eligible_tasks(state, current): actions.append("take_task")
                if not free and _can_pass(state): actions.append("pass_task")
        elif phase == "predict" and any(t["kind"] == "predictTricks" and t["owner"] in controls and t["id"] not in state["predictions"] for t in state["tasks"]): actions = ["predict"]
        elif phase == "preflight":
            if player_id not in state["ready"]: actions.append("ready")
            if not state["distress_used"] and not any(state["communications"].values()): actions.append("distress")
            if len(state["seats"]) == 5 and state["config"]["edition"] == 1 and state["config"]["mode"] == "campaign" and state["mission"] >= 25 and not state["handover_used"] and any(t["owner"] == player_id for t in state["tasks"]): actions.append("handover")
        elif phase == "distress_vote" and player_id not in state["distress_proposal"]["votes"]: actions = ["distress_vote"]
        elif phase == "exchange" and any(p not in state["exchange_cards"] for p in controls): actions = ["exchange"]
        elif phase == "playing" and current in controls: actions = ["play"]
        elif phase == "trick_review" and player_id not in state["ready"]: actions = ["next_round"]
        elif phase == "mission_review" and player_id not in state["ready"]: actions = ["next_mission"]
        if communication_options(state, player_id): actions.append("communicate")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not isinstance(action.get("type"), str) or action["type"] not in ACTION_FIELDS:
            return [], "invalid action"
        if not ACTION_VALIDATOR.is_valid(action): return [], "invalid action fields or values"
        kind = action["type"]
        keys = {"type", *CONTEXT, *ACTION_FIELDS[kind]}
        if set(action) != keys: return [], "invalid action fields"
        if action["game_token"] != state["game_token"] or any(type(action[k]) is not int or action[k] != state[k] for k in ("attempt_id", "step")):
            return [], "stale action; refresh the game state"
        if kind in ("ready", "next_round", "next_mission") and player_id in state["ready"]: return [], None
        if kind not in TheCrewGame.get_legal_actions(state, player_id): return [], "action not available"
        candidate = copy.deepcopy(state)
        try:
            error = _apply(candidate, player_id, action)
        except (KeyError, TypeError, ValueError, IndexError, StopIteration):
            return [], "invalid action values"
        if error: return [], error
        candidate["revision"] += 1
        state.clear()
        state.update(candidate)
        # No action payload is broadcast: predictions and exchanges are private.
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        controls = [p for p in state["seats"] if _controller(state, p) == viewer_id]
        task_views = []
        first_unassigned = next((t["id"] for t in state["tasks"] if t["owner"] is None), None)
        hidden_decision = state["spec"]["special"] == "decision" and state["phase"] in ("responses", "assign")
        for task in state["tasks"]:
            hidden = hidden_decision or (state["spec"]["special"] == "distribution" and task["owner"] is None and task["id"] != first_unassigned)
            if hidden:
                task_views.append({"id": f"hidden_{len(task_views)}", "hidden": True, "owner": None})
                continue
            t = copy.deepcopy(task)
            t["text"] = task_text(task, len(state["seats"]))
            if "difficulty" in t: t["cost"] = t["difficulty"][len(state["seats"]) - 3]
            prediction = state["predictions"].get(t["id"])
            t["prediction_locked"] = prediction is not None
            if task["kind"] == "predictTricks" and (task["reveal"] == "open" or task["owner"] in controls or state["result"]): t["prediction"] = prediction
            if state["tricks"] and task["status"] == "pending" and task["kind"] in ("winCards", "winValue", "winColor", "winColors", "winSubmarines", "collectAllColors", "collectAllOfOneColor", "collectEqualColor", "collectMoreColor"):
                # Only task-relevant captured cards are tabled by the physical rules.
                def relevant(card):
                    k = task["kind"]
                    if k == "winCards": return card["id"] in task["cards"]
                    if k == "winValue": return card["suit"] != "trump" and card["rank"] == task["value"]
                    if k == "winColor": return card["suit"] == task["suit"]
                    if k == "winColors": return card["suit"] in [p["suit"] for p in task["parts"]]
                    if k == "winSubmarines": return card["suit"] == "trump"
                    if k == "collectEqualColor": return card["suit"] in (task["a"], task["b"])
                    if k == "collectMoreColor": return card["suit"] in (task["more"], task["less"])
                    return card["suit"] != "trump"
                t["progress"] = [copy.deepcopy(p["card"]) for trick in state["tricks"] if trick["winner"] == task["owner"] for p in trick["plays"] if relevant(p["card"])]
            task_views.append(t)
        view = {k: copy.deepcopy(state[k]) for k in ("game_token", "attempt_id", "step", "revision", "mission", "attempt", "phase", "current_turn", "captain", "trick_number", "total_tricks", "trick", "trick_result", "ready", "result", "game_over", "winner_ids", "journal", "communication", "communications", "shared_tokens", "spec", "terrain_card", "responses", "target", "pink_holder", "volunteers", "selected_members", "distress_active", "distress_used", "status_notes")}
        current = state["current_turn"]
        view.update(game_id="the_crew", you=viewer_id, config={k: v for k, v in state["config"].items() if k != "seed"}, tasks=task_views,
                    players=[{"player_id": p, "name": ("JARVIS" if state["config"]["edition"] == 1 else "Tonoja") if p == HELPER else state["player_meta"][p].get("name", p),
                              "helper": p == HELPER, "is_bot": False if p == HELPER else bool(state["player_meta"][p].get("is_bot")),
                              "hand_count": len(_all_hand(state, p)), "won": sum(t["winner"] == p for t in state["tricks"])} for p in state["seats"]],
                    hand=copy.deepcopy(_hand(state, viewer_id)) if viewer_id in state["humans"] else [],
                    helper=[{"card": copy.deepcopy(col[-1]) if col and i not in state["helper_pending"] else None,
                             "covered": bool(len(col) > 1 or col and i in state["helper_pending"])} for i, col in enumerate(state["helper_columns"])],
                    controlled_seats=controls, legal_actions=TheCrewGame.get_legal_actions(state, viewer_id),
                    legal_card_ids=legal_cards(state, viewer_id), communication_options=communication_options(state, viewer_id),
                    task_choices={p: _eligible_tasks(state, p) for p in controls} if state["phase"] == "draft" else {},
                    assignable=_assignable(state) if state["phase"] == "assign" and viewer_id == state["captain"] else [],
                    exchange_pending=[p for p in controls if p not in state["exchange_cards"]] if state["phase"] == "exchange" else [],
                    exchange_submitted=list(state["exchange_cards"]),
                    volunteer_remaining=len(state.get("volunteer_queue", [])),
                    proposal=copy.deepcopy(state["distress_proposal"]),
                    current_controller=_controller(state, current) if current else None)
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.the_crew_ai import choose_action
        action = choose_action(TheCrewGame.get_public_view(state, bot_id))
        return {**action, "delay_ms": 300} if action else None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


def _apply(state: Dict, pid: str, action: Dict) -> Optional[str]:
    kind, current = action["type"], state["current_turn"]
    special = state["spec"]["special"]
    if kind in ("take_task", "pass_task"):
        free = special in ("free", "two_volunteers")
        actor = action.get("actor", current)
        if kind == "take_task":
            if actor not in state["seats"] or _controller(state, actor) != pid or (not free and actor != current): return "not your task selection turn"
            if action["task_id"] not in _eligible_tasks(state, actor): return "choose an available task"
            next(t for t in state["tasks"] if t["id"] == action["task_id"])["owner"] = actor
        state["draft_index"] += 1
        if all(t["owner"] for t in state["tasks"]): _preflight(state)
        else:
            nxt = state["draft_order"][state["draft_index"] % len(state["draft_order"])]
            _transition(state, "draft", nxt)
            if not free and not _eligible_tasks(state, nxt) and not _can_pass(state):
                _finish_attempt(state, False, "剩余任务无法由当前成员领取；本次分配失败。")
    elif kind == "respond":
        actor = action["actor"]
        if type(action["yes"]) is not bool or actor not in state["seats"] or _controller(state, actor) != pid: return "invalid response"
        if state["phase"] == "volunteer":
            if actor != current: return "wait for your response turn"
            remaining = len(state["volunteer_queue"])
            need = (2 if special == "two_volunteers" else 1) - len(state["volunteers"])
            if not action["yes"] and remaining <= need: return "the remaining crew must volunteer"
            if action["yes"] and special == "volunteer" and actor == state["captain"] and any(not t.get("captainMaySelect", True) for t in state["tasks"]):
                _finish_attempt(state, False, "指挥官无法领取比较指挥官赢墩数的任务；需重新尝试。")
                return None
            if action["yes"]: state["volunteers"].append(actor)
            state["volunteer_queue"].pop(0)
            if len(state["volunteers"]) == (2 if special == "two_volunteers" else 1):
                if special == "volunteer":
                    for t in state["tasks"]: t["owner"] = actor
                    _preflight(state)
                else: _start_draft(state)
            else: _transition(state, "volunteer", state["volunteer_queue"][0])
        else:
            if actor in state["responses"]: return "response already submitted"
            state["responses"][actor] = action["yes"]
            if len(state["responses"]) == len(state["seats"]): _transition(state, "assign", state["captain"])
    elif kind == "assign":
        target = action["player_id"]
        if target not in _assignable(state): return "choose an eligible crew member"
        if special == "relay":
            state["selected_members"].append(target)
            if len(state["selected_members"]) == 2: _preflight(state)
            else: _transition(state, "assign", state["captain"])
        elif special == "distribution":
            next(t for t in state["tasks"] if t["owner"] is None)["owner"] = target
            state["responses"] = {}
            if all(t["owner"] for t in state["tasks"]): _preflight(state)
            else: _transition(state, "responses")
        else:
            state["target"] = target
            if special == "mute":
                state["mute"] = target
                _start_draft(state)
            else:
                if special in ("decision", "one_owner", "captain_or_one"):
                    for t in state["tasks"]:
                        if target == state["captain"] and not t.get("captainMaySelect", True): return "captain cannot take a captain-comparison task"
                        t["owner"] = target
                _preflight(state)
    elif kind in ("tokens", "keep_tokens"):
        if kind == "tokens":
            a, b = action["first"], action["second"]
            if type(a) is not int or type(b) is not int or a == b or not (0 <= a < len(state["tasks"]) and 0 <= b < len(state["tasks"])): return "choose two different tasks"
            first, second = state["tasks"][a], state["tasks"][b]
            if not first.get("token") or special == "move_token" and second.get("token"): return "move from a marked task to an unmarked task"
            first["token"], second["token"] = second.get("token"), first.get("token")
        _start_draft(state)
    elif kind == "predict":
        task = next(t for t in state["tasks"] if t["id"] == action["task_id"])
        value = action["value"]
        if task["kind"] != "predictTricks" or _controller(state, task["owner"]) != pid or task["id"] in state["predictions"]: return "prediction not available"
        if type(value) is not int or not 0 <= value <= state["total_tricks"]: return "invalid predicted trick count"
        state["predictions"][task["id"]] = value
        if all(t["kind"] != "predictTricks" or t["id"] in state["predictions"] for t in state["tasks"]): _preflight(state)
    elif kind == "communicate":
        options = communication_options(state, pid)
        if not any(o["card_id"] == action["card_id"] and action["marker"] in o["markers"] for o in options): return "communication must show your highest, lowest or only card of a color"
        card = next(c for c in _hand(state, pid) if c["id"] == action["card_id"])
        state["communications"][pid].append({"card": copy.deepcopy(card), "marker": "unknown" if state["communication"] == "hidden" else action["marker"], "played": False})
        if state["communication"] == "shared": state["shared_tokens"] -= 1
        # A new public signal deserves a fresh readiness decision.
        if state["phase"] in ("preflight", "trick_review"): _transition(state, state["phase"])
    elif kind == "distress":
        if action["direction"] not in ("left", "right"): return "choose left or right"
        state["distress_proposal"] = {"direction": action["direction"], "votes": {pid: True}}
        _transition(state, "distress_vote")
    elif kind == "distress_vote":
        if type(action["yes"]) is not bool: return "invalid vote"
        if not action["yes"]:
            state["distress_proposal"] = None
            _transition(state, "preflight")
        else:
            state["distress_proposal"]["votes"][pid] = True
            if len(state["distress_proposal"]["votes"]) == len(state["humans"]):
                state["distress_active"] = state["distress_used"] = True
                _transition(state, "exchange")
    elif kind == "exchange":
        actor, card_id = action["actor"], action["card_id"]
        if actor not in state["seats"] or _controller(state, actor) != pid or actor in state["exchange_cards"]: return "exchange not available"
        if not any(c["id"] == card_id and c["suit"] != "trump" for c in _hand(state, actor)): return "pass one non-trump card"
        state["exchange_cards"][actor] = card_id
        if len(state["exchange_cards"]) == len(state["seats"]):
            passed = {p: _take_card(state, p, state["exchange_cards"][p]) for p in state["seats"]}
            _deliver_exchange(state, passed, 1 if state["distress_proposal"]["direction"] == "left" else -1)
            state["distress_proposal"] = None
            _transition(state, "preflight")
    elif kind == "handover":
        task = next(t for t in state["tasks"] if t["id"] == action["task_id"])
        target = action["player_id"]
        if task["owner"] != pid or target not in state["seats"] or target == pid: return "choose your task and another crew member"
        task["owner"] = target
        state["handover_used"] = True
        _transition(state, "preflight")
    elif kind == "play":
        if action["card_id"] not in legal_cards(state, pid): return "you must follow the led suit if possible"
        card = _take_card(state, current, action["card_id"])
        state["trick"].append({"player_id": current, "card": card})
        for m in state["communications"][current]:
            if m["card"]["id"] == card["id"]: m["played"] = True
        if len(state["trick"]) == len(state["seats"]): _finish_trick(state)
        else:
            state["current_turn"] = state["trick_order"][len(state["trick"])]
            state["step"] += 1
    elif kind in ("ready", "next_round", "next_mission"):
        state["ready"].append(pid)
        if len(state["ready"]) == len(state["humans"]):
            if kind == "ready":
                _start_trick(state, state["captain"])
            elif kind == "next_round":
                if special == "exchange" and state["trick_number"] == 1: _random_exchange(state)
                state["trick_number"] += 1
                _start_trick(state, state["trick_result"]["winner"])
            elif state["result"]["success"] and (state["config"]["mode"] == "custom" or state["mission"] == (50 if state["config"]["edition"] == 1 else 32)):
                state["game_over"] = True
                state["winner_ids"] = state["humans"][:] if state["result"]["success"] else []
                _transition(state, "game_over")
            else:
                if state["result"]["success"]:
                    state["mission"] += 1
                    state["attempt"] = 1
                    state["distress_active"] = False
                else: state["attempt"] += 1
                _start_attempt(state)
    return None
