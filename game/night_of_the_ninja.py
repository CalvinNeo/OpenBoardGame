"""Night of the Ninja: standard multiplayer rules with explicit online windows.

Honor uses independent uniform 2/3/4 draws; the public rulebook does not give
physical token frequencies. All decisions, including bots, respect private views.
"""
import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

PHASES = ("spy", "mystic", "trickster", "blind_assassin", "shinobi")
TRICKSTERS = ("shapeshifter", "gravedigger", "troublemaker", "spirit_merchant", "thief", "judge")
CARD_INFO = {
    "spy": ("密探", "Spy", "👁️"), "mystic": ("秘术师", "Mystic", "🔮"),
    "shapeshifter": ("换形师", "Shapeshifter", "🔀"), "gravedigger": ("掘墓人", "Gravedigger", "🪦"),
    "troublemaker": ("捣乱者", "Troublemaker", "📣"), "spirit_merchant": ("灵魂商人", "Spirit Merchant", "⚖️"),
    "thief": ("盗贼", "Thief", "💰"), "judge": ("判官", "Judge", "⚔️"),
    "blind_assassin": ("盲刺客", "Blind Assassin", "🗡️"), "shinobi": ("上忍", "Shinobi", "🥷"),
    "mirror_monk": ("镜僧", "Mirror Monk", "🪞"), "martyr": ("殉道者", "Martyr", "🌟"),
    "mastermind": ("幕后主使", "Mastermind", "🧠"),
}
CARDS = {}
for _phase_name in PHASES:
    for _rank in range(1, 7):
        _kind = TRICKSTERS[_rank - 1] if _phase_name == "trickster" else _phase_name
        _id = f"{_kind}_{_rank}"
        CARDS[_id] = {"id": _id, "kind": _kind, "phase": _phase_name, "rank": _rank,
                      "zh": CARD_INFO[_kind][0], "name": CARD_INFO[_kind][1], "emoji": CARD_INFO[_kind][2]}
for _kind in ("mirror_monk", "martyr", "mastermind"):
    CARDS[_kind] = {"id": _kind, "kind": _kind, "phase": "special", "rank": 0,
                    "zh": CARD_INFO[_kind][0], "name": CARD_INFO[_kind][1], "emoji": CARD_INFO[_kind][2]}

CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": "integer"}}, "additionalProperties": False}
ACTION_SCHEMA = {
    "type": "object", "properties": {
        "type": {"enum": ["draft", "reveal", "target", "decide", "react", "mastermind", "next_round"]},
        "game_token": {"type": "string"}, "window_id": {"type": "integer", "minimum": 0},
        "card_id": {"type": "string"},
        "card_ids": {"type": "array", "items": {"type": "string"}, "uniqueItems": True, "maxItems": 3},
        "targets": {"type": "array", "items": {"type": "string"}, "uniqueItems": True, "maxItems": 2},
        "mode": {"enum": ["house", "honor"]}, "token_index": {"type": "integer", "minimum": 0},
        "own_index": {"type": "integer", "minimum": 0},
        "choice": {"enum": ["continue", "kill", "spare", "swap", "keep", "reveal", "conceal", "play", "hold", "accept", "mirror_monk", "martyr"]},
        "reveal": {"type": "boolean"},
    }, "required": ["type", "game_token", "window_id"], "additionalProperties": False,
}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _rng(state: Dict) -> random.Random:
    state["rng_counter"] += 1
    return random.Random(f"{state['seed']}:{state['rng_counter']}")


def _phase(state: Dict, phase: str) -> None:
    state["phase"] = phase
    state["window_id"] += 1


def _alive(state: Dict) -> List[str]:
    return [p for p in state["turn_order"] if state["players"][p]["alive"]]


def _log(state: Dict, message: str) -> None:
    state["log"].append({"round": state["round"], "text": message})
    state["log"] = state["log"][-100:]


def _name(state: Dict, pid: str) -> str:
    return state["player_meta"][pid]["name"]


def _observe(state: Dict, viewer: str, target: str, **extra) -> Dict:
    house = copy.deepcopy(state["players"][target]["house"])
    note = {"target": target, "house": house, "round": state["round"], "uncertain": False, **extra}
    state["players"][viewer]["notes"].append(copy.deepcopy(note))
    if viewer == target:
        state["players"][viewer].update(remembered_house=house, house_uncertain=False)
    return note


def _expose(state: Dict, pid: str) -> None:
    state["players"][pid]["revealed"] = True
    for viewer in state["turn_order"]:
        _observe(state, viewer, pid)


def _honor(state: Dict, pid: str) -> None:
    state["players"][pid]["honor"].append(_rng(state).choice([2, 3, 4]))
    _log(state, f"{_name(state, pid)} 获得荣誉 🌟。")


def _start_round(state: Dict) -> None:
    ids = state["turn_order"]
    houses = [{"clan": clan, "rank": rank} for clan in ("crane", "lotus") for rank in range(1, len(ids) // 2 + 1)]
    if len(ids) % 2:
        houses.append({"clan": "ronin", "rank": 0})
    rng = _rng(state)
    rng.shuffle(houses)
    deck = list(CARDS)
    rng.shuffle(deck)
    for pid, house in zip(ids, houses):
        player = state["players"][pid]
        player.update(house=house, remembered_house=copy.deepcopy(house), house_uncertain=False,
                      alive=True, revealed=False, hand=[], packet=[deck.pop() for _ in range(3)], notes=[])
    state.update(undealt=deck, discard=[], table=[], submissions={}, draft_step=1, night_index=0,
                 queue=[], active=None, pending=None, current_turn=None, next_ready=[],
                 round_summary=None, round_start_counts={p: len(state['players'][p]['honor']) for p in ids})
    _phase(state, "draft")
    _log(state, f"第 {state['round']} 夜开始，家族重新分配。")


def _start_reveal(state: Dict) -> None:
    state.update(submissions={}, current_turn=None, active=None, pending=None)
    _phase(state, "reveal" if state["night_index"] < len(PHASES) else "mastermind")
    if not _alive(state):
        _score(state)


def _next_card(state: Dict) -> None:
    state.update(active=None, pending=None, current_turn=None)
    while state["queue"]:
        active = state["queue"].pop(0)
        if not state["players"][active["player_id"]]["alive"]:
            active["status"] = "cancelled"
            continue
        state["active"] = active
        state["current_turn"] = active["player_id"]
        active["status"] = "acting"
        kind = CARDS[active["card_id"]]["kind"]
        if kind in ("thief", "judge"):
            _expose(state, active["player_id"])
        if kind == "gravedigger":
            options = _rng(state).sample(state["discard"], min(2, len(state["discard"])))
            state["pending"] = {"kind": kind, "options": options}
            _phase(state, "decide")
        else:
            _phase(state, "target")
            if not _targets(state):
                _log(state, "没有可选目标，效果跳过。")
                active["status"] = "done"
                continue
        return
    state["night_index"] += 1
    _start_reveal(state)


def _finish_card(state: Dict) -> None:
    state["active"]["status"] = "done"
    _next_card(state)


def _targets(state: Dict) -> List[str]:
    actor = state["current_turn"]
    kind = CARDS[state["active"]["card_id"]]["kind"]
    if kind in ("blind_assassin", "shinobi", "judge"):
        return _alive(state)
    if kind == "thief":
        own = len(state["players"][actor]["honor"])
        return [p for p in state["turn_order"] if len(state["players"][p]["honor"]) > own]
    if kind == "shapeshifter":
        return state["turn_order"][:]
    return [p for p in state["turn_order"] if p != actor]


def _kill(state: Dict, pid: str) -> None:
    state["players"][pid]["alive"] = False
    _log(state, f"{_name(state, pid)} 倒下了 💀，身份暂不揭晓。")


def _attack(state: Dict, target: str) -> None:
    actor = state["active"]["player_id"]
    kind = CARDS[state["active"]["card_id"]]["kind"]
    _log(state, f"{_name(state, actor)} 刺杀 {_name(state, target)}。")
    if kind == "judge":
        _kill(state, target)
        _finish_card(state)
    else:
        state["pending"] = {"kind": "attack", "attacker": actor, "target": target}
        state["current_turn"] = target
        _phase(state, "react")


def _target(state: Dict, action: Dict) -> None:
    actor = state["current_turn"]
    kind = CARDS[state["active"]["card_id"]]["kind"]
    targets = action["targets"][:]
    target = targets[0]
    _log(state, f"{_name(state, actor)} 使用 {CARD_INFO[kind][0]} {CARD_INFO[kind][2]}：" + "、".join(_name(state, p) for p in targets) + "。")
    pending = {"kind": kind, "targets": targets}
    if kind in ("blind_assassin", "judge"):
        _attack(state, target)
        return
    if kind == "thief":
        token = state["players"][target]["honor"].pop(action["token_index"])
        state["players"][actor]["honor"].append(token)
        _finish_card(state)
        return
    if kind == "spirit_merchant" and action["mode"] == "honor":
        pending["seen_honor"] = state["players"][target]["honor"][action["token_index"]]
        pending["seen_index"] = action["token_index"]
    else:
        pending["observations"] = [_observe(state, actor, p) for p in targets]
    if kind == "mystic":
        hand = state["players"][target]["hand"]
        pending["seen_card"] = _rng(state).choice(hand) if hand else None
        state["players"][actor]["notes"][-1]["ninja_card"] = pending["seen_card"]
    state["pending"] = pending
    _phase(state, "decide")


def _decide(state: Dict, action: Dict) -> None:
    actor = state["current_turn"]
    pending = state["pending"]
    kind, choice = pending["kind"], action["choice"]
    if kind == "shinobi" and choice == "kill":
        _attack(state, pending["targets"][0])
        return
    if kind == "shapeshifter":
        a, b = pending["targets"]
        if choice == "swap":
            state["players"][a]["house"], state["players"][b]["house"] = state["players"][b]["house"], state["players"][a]["house"]
        # Invalidate equally for swap AND keep: no view may reveal this choice.
        for viewer in state["players"].values():
            for note in viewer["notes"]:
                if note["target"] in (a, b):
                    note["uncertain"] = True
        for pid in (a, b):
            state["players"][pid].update(house_uncertain=True, revealed=False)
            _observe(state, actor, pid)
        _log(state, "换形师完成秘密选择；被选中者不能重新查看身份。")
    elif kind == "troublemaker" and choice == "reveal":
        _expose(state, pending["targets"][0])
        _log(state, "捣乱者公开了目标身份。")
    elif kind == "spirit_merchant" and choice == "swap":
        own = state["players"][actor]["honor"]
        other = state["players"][pending["targets"][0]]["honor"]
        i, j = action["own_index"], action["token_index"]
        own[i], other[j] = other[j], own[i]
        _log(state, "灵魂商人交换了一枚荣誉 ⚖️。")
    elif kind == "gravedigger" and pending["options"]:
        card = action["card_id"]
        state["discard"].remove(card)
        if choice == "play":
            entry = {"player_id": actor, "card_id": card, "status": "queued", "recovered": True}
            state["table"].append(entry)
            state["queue"].insert(0, entry)
            _log(state, f"{_name(state, actor)} 立即使用找回的 {CARDS[card]['zh']}。")
        else:
            state["players"][actor]["hand"].append(card)
            _log(state, f"{_name(state, actor)} 秘密保留一张找回的忍者牌。")
    _finish_card(state)


def _score(state: Dict) -> None:
    survivors = _alive(state)
    masters = [p for p, cards in state["submissions"].items() if cards and p in survivors]
    winning_clan = state["players"][masters[0]]["house"]["clan"] if masters else None
    reason = "mastermind" if masters else "ranks"
    if not masters:
        ranks = {clan: sorted(state["players"][p]["house"]["rank"] for p in survivors
                              if state["players"][p]["house"]["clan"] == clan) for clan in ("crane", "lotus")}
        # Missing survivors compare below every actual rank, including tied prefixes.
        crane, lotus = (ranks[c] + [99] * (5 - len(ranks[c])) for c in ("crane", "lotus"))
        winning_clan = "crane" if crane < lotus else "lotus" if lotus < crane else None
        if winning_clan is None:
            reason = "tie"
    awarded = []
    for pid in state["turn_order"]:
        p = state["players"][pid]
        earns = ((winning_clan in ("crane", "lotus") and p["house"]["clan"] == winning_clan)
                 or (reason == "tie" and p["alive"])
                 or (p["alive"] and p["house"]["clan"] == "ronin"))
        if earns:
            _honor(state, pid)
            awarded.append(pid)
    totals = {p: sum(state["players"][p]["honor"]) for p in state["turn_order"]}
    best = max(totals.values())
    state["game_over"] = best >= 10
    state["winner"] = [p for p in state["turn_order"] if totals[p] == best] if state["game_over"] else []
    state["round_summary"] = {"winning_clan": winning_clan, "reason": reason, "awarded": awarded,
                               "masterminds": masters, "token_delta": {p: len(state['players'][p]['honor']) - state['round_start_counts'][p] for p in state['turn_order']}}
    state.update(current_turn=None, active=None, pending=None, next_ready=[], submissions={})
    _phase(state, "game_over" if state["game_over"] else "round_end")
    _log(state, "夜晚结束，揭晓家族并结算荣誉。")


def _validate_fields(state: Dict, actor: str, a: Dict) -> Optional[str]:
    """Validate every branch before any mutation (including RNG use)."""
    base = {"type", "game_token", "window_id"}
    allowed = set()
    kind = a["type"]
    player = state["players"][actor]
    if kind == "draft":
        allowed = {"card_id"}
        if a.get("card_id") not in player["packet"]:
            return "Choose one card from your packet."
    elif kind == "reveal":
        allowed = {"card_ids"}
        if "card_ids" not in a or any(c not in player["hand"] or CARDS[c]["phase"] != PHASES[state["night_index"]] for c in a["card_ids"]):
            return "Choose cards of the current phase, or pass."
    elif kind == "target":
        allowed = {"targets"}
        effect = CARDS[state["active"]["card_id"]]["kind"]
        targets = a.get("targets", [])
        if len(targets) != (2 if effect == "shapeshifter" else 1) or any(p not in _targets(state) for p in targets):
            return "Choose eligible targets."
        target = state["players"][targets[0]]
        if effect == "spirit_merchant":
            allowed.add("mode")
            if a.get("mode") not in ("house", "honor"):
                return "Choose house or honor."
        if effect == "thief" or (effect == "spirit_merchant" and a.get("mode") == "honor"):
            allowed.add("token_index")
            if a.get("token_index", -1) not in range(len(target["honor"])):
                return "Choose an existing honor token."
    elif kind == "decide":
        allowed = {"choice"}
        pending = state["pending"]
        effect = pending["kind"]
        choices = {"spy": ["continue"], "mystic": ["continue"], "shinobi": ["kill", "spare"],
                   "shapeshifter": ["swap", "keep"], "troublemaker": ["reveal", "conceal"],
                   "spirit_merchant": ["swap", "keep"], "gravedigger": ["play", "hold"] if pending.get("options") else ["continue"]}[effect]
        if a.get("choice") not in choices:
            return "Choose an available resolution."
        if effect == "spirit_merchant" and a["choice"] == "swap":
            allowed |= {"own_index", "token_index"}
            other = state["players"][pending["targets"][0]]
            if a.get("own_index", -1) not in range(len(player["honor"])) or a.get("token_index", -1) not in range(len(other["honor"])):
                return "Both players need an honor token to swap."
        if effect == "gravedigger" and pending["options"]:
            allowed.add("card_id")
            if a.get("card_id") not in pending["options"]:
                return "Choose one of the two recovered cards."
            if a["choice"] == "play" and CARDS[a["card_id"]]["phase"] == "special":
                return "Reaction and Mastermind cards must be held for their timing."
    elif kind == "react":
        allowed = {"choice"}
        if a.get("choice") not in ("accept", "mirror_monk", "martyr"):
            return "Choose a response."
        if a["choice"] != "accept" and a["choice"] not in player["hand"]:
            return "That reaction is not in your hand."
    elif kind == "mastermind":
        allowed = {"reveal"}
        if "reveal" not in a or (a["reveal"] and "mastermind" not in player["hand"]):
            return "Mastermind is not in your hand."
    if set(a) != base | allowed:
        return "Unexpected or missing action fields."
    return None


class NightOfTheNinjaGame:
    game_id = "night_of_the_ninja"
    min_players = 4
    max_players = 11

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not _CONFIG_VALIDATOR.is_valid(config) or isinstance(config.get("seed"), bool):
            raise ValueError("Invalid Ninja configuration.")
        if not 4 <= len(players) <= 11:
            raise ValueError("Night of the Ninja needs 4–11 players.")
        players = sorted(players, key=lambda p: p.get("seat", 0))
        ids = [p["player_id"] for p in players]
        if len(set(ids)) != len(ids) or any(not isinstance(p, str) or not p for p in ids):
            raise ValueError("Player IDs must be unique nonempty strings.")
        state = {"game_id": NightOfTheNinjaGame.game_id, "version": 1, "config": copy.deepcopy(config), "game_token": secrets.token_hex(16),
                 "seed": config.get("seed", secrets.token_hex(16)), "rng_counter": 0, "window_id": 0, "revision": 0,
                 "players": {p: {"honor": []} for p in ids}, "turn_order": ids,
                 "player_meta": {p["player_id"]: {**p, "name": p.get("name") or p["player_id"]} for p in players},
                 "round": 1, "log": [], "winner": [], "game_over": False}
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id not in state["players"]:
            return []
        phase = state["phase"]
        if phase == "round_end":
            return [] if player_id in state["next_ready"] else ["next_round"]
        if phase == "draft" or (phase in ("reveal", "mastermind") and state["players"][player_id]["alive"]):
            return [] if player_id in state["submissions"] else [phase]
        if phase in ("target", "decide", "react") and player_id == state["current_turn"]:
            return [phase]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action schema."
        if any(type(action[k]) is not int for k in ("window_id", "token_index", "own_index") if k in action):
            return [], "Action numbers must be integers."
        if action["game_token"] != state["game_token"] or action["window_id"] != state["window_id"]:
            return [], "This action belongs to an old game or window."
        if action["type"] not in NightOfTheNinjaGame.get_legal_actions(state, player_id):
            return [], "Action unavailable, or already submitted."
        error = _validate_fields(state, player_id, action)
        if error:
            return [], error
        kind = action["type"]
        player = state["players"][player_id]
        if kind == "draft":
            state["submissions"][player_id] = action["card_id"]
            if len(state["submissions"]) == len(state["turn_order"]):
                packets = {}
                for pid, card in state["submissions"].items():
                    p = state["players"][pid]
                    p["packet"].remove(card)
                    p["hand"].append(card)
                    packets[pid] = p["packet"][:]
                if state["draft_step"] == 1:
                    ids = state["turn_order"]
                    for i, pid in enumerate(ids):
                        state["players"][ids[(i + 1) % len(ids)]]["packet"] = packets[pid]
                    state.update(submissions={}, draft_step=2)
                    _phase(state, "draft")
                else:
                    for p in state["players"].values():
                        state["discard"].extend(p["packet"])
                        p["packet"] = []
                    _log(state, "两轮选牌完成；进入密探阶段。")
                    _start_reveal(state)
        elif kind == "reveal":
            state["submissions"][player_id] = action["card_ids"][:]
            if len(state["submissions"]) == len(_alive(state)):
                entries = []
                for pid, cards in state["submissions"].items():
                    for card in cards:
                        state["players"][pid]["hand"].remove(card)
                        entries.append({"player_id": pid, "card_id": card, "status": "queued", "recovered": False})
                        _log(state, f"{_name(state, pid)} 亮出 {CARDS[card]['zh']} #{CARDS[card]['rank']}。")
                entries.sort(key=lambda e: CARDS[e["card_id"]]["rank"])
                state["table"].extend(entries)
                state["queue"] = entries
                state["submissions"] = {}
                _next_card(state)
        elif kind == "target":
            _target(state, action)
        elif kind == "decide":
            _decide(state, action)
        elif kind == "react":
            reaction = action["choice"]
            if reaction != "accept":
                player["hand"].remove(reaction)
                state["table"].append({"player_id": player_id, "card_id": reaction, "status": "done", "recovered": False})
                _log(state, f"{_name(state, player_id)} 使用 {CARD_INFO[reaction][0]}。")
            if reaction == "mirror_monk":
                _kill(state, state["pending"]["attacker"])
            else:
                if reaction == "martyr":
                    _honor(state, player_id)
                _kill(state, player_id)
            _finish_card(state)
        elif kind == "mastermind":
            state["submissions"][player_id] = action["reveal"]
            if len(state["submissions"]) == len(_alive(state)):
                for pid, reveal in state["submissions"].items():
                    if reveal:
                        state["players"][pid]["hand"].remove("mastermind")
                        state["table"].append({"player_id": pid, "card_id": "mastermind", "status": "done", "recovered": False})
                _score(state)
        else:
            state["next_ready"].append(player_id)
            if len(state["next_ready"]) == len(state["turn_order"]):
                state["round"] += 1
                _start_round(state)
        state["revision"] += 1
        return [{"type": "night_of_the_ninja:action", "payload": {"player_id": player_id, "type": kind}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = state["players"].get(viewer_id, {})
        review = state["phase"] in ("round_end", "game_over")
        legal = NightOfTheNinjaGame.get_legal_actions(state, viewer_id)
        active = state["active"]
        pending = state["pending"] if state["current_turn"] == viewer_id or state["phase"] == "react" else None
        view = {"game_id": NightOfTheNinjaGame.game_id, "you": viewer_id, "game_token": state["game_token"],
                "window_id": state["window_id"], "revision": state["revision"], "round": state["round"],
                "phase": state["phase"], "draft_step": state["draft_step"], "current_turn": state["current_turn"],
                "night_phase": PHASES[state["night_index"]] if state["night_index"] < 5 else "house_reveal",
                "hand": [CARDS[c] for c in own.get("hand", [])], "packet": [CARDS[c] for c in own.get("packet", [])],
                "your_house": own.get("house") if review or own.get("revealed") else own.get("remembered_house"),
                "house_uncertain": own.get("house_uncertain", False) and not review and not own.get("revealed", False),
                "honor": own.get("honor", []), "score": sum(own.get("honor", [])), "notes": own.get("notes", []),
                "legal_actions": legal, "submitted": list(state["submissions"]), "active": active,
                "pending": pending, "table": state["table"], "next_ready": state["next_ready"],
                "round_summary": state["round_summary"], "game_over": state["game_over"], "winner": state["winner"],
                "log": state["log"], "catalog": list(CARDS.values()),
                "targets": _targets(state) if "target" in legal else [],
                "players": [{"player_id": pid, "name": _name(state, pid), "alive": p["alive"],
                             "house": p["house"] if review or p["revealed"] else None,
                             "honor_count": len(p["honor"]), "score": sum(p["honor"]) if state["game_over"] else None,
                             "hand_count": len(p["hand"]), "seat": state["player_meta"][pid].get("seat", 0)}
                            for pid, p in state["players"].items()]}
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return _choose_bot_action(NightOfTheNinjaGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        state = copy.deepcopy(payload)
        if not isinstance(state, dict) or state.get("version") != 1 or state.get("game_id") != NightOfTheNinjaGame.game_id:
            raise ValueError("Invalid Ninja save.")
        try:
            if not 4 <= len(state["turn_order"]) <= 11 or set(state["turn_order"]) != set(state["players"]):
                raise ValueError("Invalid saved players.")
            if state["phase"] not in ("draft", "reveal", "target", "decide", "react", "mastermind", "round_end", "game_over"):
                raise ValueError("Invalid saved phase.")
            # Restore shared references lost in a JSON round trip.
            table = {(e["player_id"], e["card_id"]): e for e in state["table"]}
            state["queue"] = [table[(e["player_id"], e["card_id"])] for e in state["queue"]]
            if state["active"]:
                e = state["active"]
                state["active"] = table[(e["player_id"], e["card_id"]) ]
            NightOfTheNinjaGame.get_public_view(state, state["turn_order"][0])
        except (KeyError, TypeError, IndexError) as exc:
            raise ValueError("Invalid Ninja save.") from exc
        return state


def _choose_bot_action(view: Dict) -> Optional[Dict]:
    legal = view["legal_actions"]
    if not legal:
        return None
    kind = legal[0]
    action = {"type": kind, "game_token": view["game_token"], "window_id": view["window_id"]}
    own = view["your_house"] or {}
    known = {n["target"]: n["house"] for n in view["notes"] if not n["uncertain"]}
    known.update({p["player_id"]: p["house"] for p in view["players"] if p["house"]})
    players = {p["player_id"]: p for p in view["players"]}
    def enemy(pid):
        house = known.get(pid)
        if pid == view["you"]:
            return -100
        if not house or view["house_uncertain"]:
            return 1
        return (8 - house["rank"]) if house["clan"] != own.get("clan") else -10
    if kind == "draft":
        weights = {"mastermind": 10, "mirror_monk": 8, "shinobi": 8, "spy": 6, "mystic": 7,
                   "judge": 7, "blind_assassin": 5, "martyr": 6, "thief": 5, "shapeshifter": 3,
                   "gravedigger": 6, "troublemaker": 4, "spirit_merchant": 3}
        action["card_id"] = max(view["packet"], key=lambda c: weights[c["kind"]] - c["rank"] * .12)["id"]
    elif kind == "reveal":
        action["card_ids"] = [c["id"] for c in view["hand"] if c["phase"] == view["night_phase"]]
    elif kind == "target":
        effect = CARDS[view["active"]["card_id"]]["kind"]
        targets = view["targets"]
        if effect == "shapeshifter":
            action["targets"] = sorted(targets, key=enemy, reverse=True)[:2]
        else:
            target = max(targets, key=(lambda p: (p not in known, p != view["you"])) if effect in ("spy", "mystic", "troublemaker") else enemy)
            action["targets"] = [target]
            if effect == "spirit_merchant":
                action["mode"] = "honor" if players[target]["honor_count"] and view["honor"] else "house"
                if action["mode"] == "honor":
                    action["token_index"] = 0
            elif effect == "thief":
                action["token_index"] = 0
    elif kind == "decide":
        pending = view["pending"]
        effect = pending["kind"]
        choice = {"spy": "continue", "mystic": "continue", "shapeshifter": "keep", "troublemaker": "reveal", "spirit_merchant": "keep", "shinobi": "spare", "gravedigger": "continue"}[effect]
        if effect == "shinobi":
            choice = "kill" if enemy(pending["targets"][0]) > 0 else "spare"
        elif effect == "spirit_merchant" and view["honor"] and pending.get("seen_honor", 0) > min(view["honor"]):
            choice = "swap"
            action.update(own_index=view["honor"].index(min(view["honor"])), token_index=pending["seen_index"])
        elif effect == "gravedigger" and pending["options"]:
            card = max(pending["options"], key=lambda c: CARDS[c]["kind"] in ("shinobi", "judge", "mastermind"))
            action["card_id"] = card
            choice = "hold" if CARDS[card]["phase"] == "special" else "play"
        action["choice"] = choice
    elif kind == "react":
        hand = [c["kind"] for c in view["hand"]]
        action["choice"] = "mirror_monk" if "mirror_monk" in hand else "martyr" if "martyr" in hand else "accept"
    elif kind == "mastermind":
        action["reveal"] = any(c["kind"] == "mastermind" for c in view["hand"])
    return action
