"""Ponzi Scheme: public debts, private cash, and compulsory two-way trades."""

import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

from game.ponzi_scheme_data import (
    ACTION_SCHEMA, CONFIG_SCHEMA, INDUSTRIES, INDUSTRY_SUPPLY, LUXURIES,
    build_cards,
)

_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def industry_points(count: int) -> int:
    return count * (count + 1) // 2


def wealth_points(cash: int) -> int:
    return sum(cash >= threshold for threshold in (30, 56, 78, 96))


def _name(state: Dict, pid: str) -> str:
    return state["player_meta"][pid]["name"]


def _log(state: Dict, message: str) -> None:
    state["log"].append(message)
    state["log"] = state["log"][-100:]
    state["round_notes"].append(message)


def _order(state: Dict, start: str) -> List[str]:
    ids = state["turn_order"]
    index = ids.index(start)
    return ids[index:] + ids[:index]


def _shuffle(state: Dict, cards: List[Dict]) -> None:
    # Only the private save contains this seed/counter. Reconnects do not reseed.
    rng = random.Random(f"{state['seed']}:{state['shuffle_count']}")
    rng.shuffle(cards)
    state["shuffle_count"] += 1


def _refill_market(state: Dict) -> None:
    while len(state["market"]) < 9:
        if not state["deck"]:
            if not state["discard"]:
                break
            state["deck"] = state["discard"]
            state["discard"] = []
            _shuffle(state, state["deck"])
        state["market"].append(state["deck"].pop())
    state["market"].sort(key=lambda card: (card["principal"], card["id"]))


def _fund_options(state: Dict, pid: str) -> List[Dict]:
    options = []
    for industry, count in state["players"][pid]["industries"].items():
        if count >= 3 or not state["supply"][industry]:
            continue
        for card in state["market"][count * 3:(count + 1) * 3]:
            options.append({"type": "fund", "industry": industry, "card_id": card["id"]})
    return options


def _trade_targets(state: Dict, pid: str) -> List[Dict]:
    own = state["players"][pid]["industries"]
    return [{"target": other, "industry": industry}
            for other in state["turn_order"] if other != pid
            for industry, count in own.items()
            if count > 0 and state["players"][other]["industries"][industry] > 0]


def _crash_choices(state: Dict, pid: str) -> List[str]:
    industries = state["players"][pid]["industries"]
    largest = max(industries.values())
    return [industry for industry, count in industries.items() if count == largest and count > 0]


def _start_phase(state: Dict, phase: str) -> None:
    state["phase"] = phase
    state["phase_order"] = _order(state, state["start_player"])
    state["phase_index"] = 0
    state["current_turn"] = state["phase_order"][0]


def _pass_marker(state: Dict) -> None:
    ids = state["turn_order"]
    state["start_player"] = ids[(ids.index(state["start_player"]) + 1) % len(ids)]
    _start_phase(state, "market_remove")


def _advance(state: Dict) -> None:
    state["phase_index"] += 1
    if state["phase_index"] < len(state["phase_order"]):
        state["current_turn"] = state["phase_order"][state["phase_index"]]
    elif state["phase"] == "funding":
        if state["round"] == 1 and not state["config"]["first_round_trading"]:
            _log(state, "首轮跳过暗盘交易，传递起始标记。")
            _pass_marker(state)
        else:
            _start_phase(state, "trading")
    else:
        _pass_marker(state)


def _finalize(state: Dict) -> None:
    results = []
    for pid in state["turn_order"]:
        player = state["players"][pid]
        industry_score = sum(industry_points(count) for count in player["industries"].values())
        luxury_score = sum(LUXURIES[lid]["points"] for lid in player["luxuries"])
        wealth_score = 0 if state["config"]["advanced"] else wealth_points(player["cash"])
        results.append({"player_id": pid, "bankrupt": player["bankrupt"],
                        "industry_points": industry_score, "wealth_points": wealth_score,
                        "luxury_points": luxury_score,
                        "total": None if player["bankrupt"] else industry_score + wealth_score + luxury_score,
                        "highest_fund": max((card["principal"] for card in player["debts"]), default=0)})
    survivors = [row for row in results if not row["bankrupt"]]
    best = max(((row["total"], row["highest_fund"]) for row in survivors), default=None)
    state["winner"] = [row["player_id"] for row in survivors if (row["total"], row["highest_fund"]) == best]
    state["results"] = results
    state["game_over"] = True
    state["phase"] = "game_over"
    state["current_turn"] = None
    _log(state, "🏁 游戏结束：" + ("、".join(_name(state, pid) for pid in state["winner"]) + " 获胜。"
                                if state["winner"] else "所有玩家破产，无人获胜。"))


def _settle(state: Dict) -> None:
    steps = 2 if state["crashed"] else 1
    payments = []
    # Resolve everyone, even after finding a bankrupt player: insolvency is simultaneous.
    for pid in state["turn_order"]:
        player = state["players"][pid]
        for card in player["debts"]:
            card["remaining"] = max(0, card["remaining"] - steps)
        due = [card for card in player["debts"] if card["remaining"] == 0]
        required = sum(card["interest"] for card in due)
        player["bankrupt"] = player["cash"] < required
        if not player["bankrupt"]:
            player["cash"] -= required
            for card in due:
                card["remaining"] = card["period"]
        payments.append({"player_id": pid, "due": required,
                         "paid": 0 if player["bankrupt"] else required,
                         "bankrupt": player["bankrupt"], "cards": copy.deepcopy(due)})
        _log(state, f"{_name(state, pid)} {'无法支付' if player['bankrupt'] else '支付'} 💵 {required} 利息"
                    + ("，破产。" if player["bankrupt"] else "。"))
    state["wheel_steps"] += steps
    state["current_turn"] = None
    state["next_ready"] = []
    if any(player["bankrupt"] for player in state["players"].values()):
        _finalize(state)
    else:
        state["phase"] = "round_end"
    state["last_round"] = {"round": state["round"], "crashed": state["crashed"],
                           "steps": steps, "payments": payments,
                           "notes": list(state["round_notes"])}


def _next_crash_player(state: Dict) -> None:
    while state["phase_index"] < len(state["phase_order"]):
        pid = state["phase_order"][state["phase_index"]]
        if _crash_choices(state, pid):
            state["current_turn"] = pid
            return
        state["phase_index"] += 1
    _settle(state)


def _check_crash(state: Dict) -> None:
    bears = [card for card in state["market"] if card["bear"]]
    state["crashed"] = len(bears) >= len(state["turn_order"])
    if not state["crashed"]:
        _settle(state)
        return
    state["market"] = [card for card in state["market"] if not card["bear"]]
    state["deck"].extend(state["discard"] + bears)
    state["discard"] = []
    _shuffle(state, state["deck"])
    _refill_market(state)
    _log(state, f"🐻 {len(bears)} 张熊牌触发市场崩盘！每人弃一个最多的行业，时间前进两格。")
    # The replacement market can contain bears; do not trigger another crash this round.
    _start_phase(state, "crash_discard")
    _next_crash_player(state)


def _respond(state: Dict, response: str) -> None:
    offer = state["offer"]
    source, target = offer["source"], offer["target"]
    amount, industry = offer["amount"], offer["industry"]
    if response == "sell":
        buyer, seller = source, target
        state["players"][target]["cash"] += amount
    else:
        buyer, seller = target, source
        state["players"][target]["cash"] -= amount
        state["players"][source]["cash"] += 2 * amount
    state["players"][seller]["industries"][industry] -= 1
    state["players"][buyer]["industries"][industry] += 1
    state["trade_history"].append({"round": state["round"], "buyer": buyer, "seller": seller,
                                   "industry": industry, "amount": amount})
    state["trade_history"] = state["trade_history"][-100:]
    _log(state, f"✉️ {_name(state, seller)} → {_name(state, buyer)}：{INDUSTRIES[industry]['icon']} {INDUSTRIES[industry]['name']} ×1（价格保密）。")
    state["offer"] = None
    state["phase"] = "trading"
    _advance(state)


class PonziSchemeGame:
    game_id = "ponzi_scheme"
    min_players = 3
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not isinstance(config, dict) or not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("invalid Ponzi Scheme configuration")
        if not 3 <= len(players) <= 5:
            raise ValueError("Ponzi Scheme requires 3–5 players")
        ids = [player.get("player_id") for player in players]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(ids) != len(set(ids)):
            raise ValueError("player IDs must be unique nonempty strings")
        if "seed" in config and type(config["seed"]) not in (str, int):
            raise ValueError("seed must be a string or integer")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        state = {
            "game_id": PonziSchemeGame.game_id,
            "config": {"advanced": config.get("advanced", False),
                       "first_round_trading": config.get("first_round_trading", False)},
            "seed": config.get("seed", secrets.token_hex(16)), "shuffle_count": 0,
            "turn_order": ids, "start_player": ids[0], "players": {}, "player_meta": {},
            "round": 1, "phase": "funding", "current_turn": ids[0],
            "phase_order": list(ids), "phase_index": 0, "market": [], "deck": [],
            "discard": [], "removed": [], "supply": {key: INDUSTRY_SUPPLY for key in INDUSTRIES},
            "luxuries": list(LUXURIES), "offer": None, "trade_history": [],
            "crashed": False, "wheel_steps": 0, "next_ready": [], "last_round": None,
            "round_notes": [], "log": [], "winner": [], "results": [], "game_over": False,
        }
        for index, player in enumerate(ordered):
            pid = player["player_id"]
            state["player_meta"][pid] = {"name": player.get("name", pid), "seat": index,
                                         "is_bot": bool(player.get("is_bot", False))}
            state["players"][pid] = {"cash": 0, "industries": {key: 0 for key in INDUSTRIES},
                                      "debts": [], "luxuries": [], "bankrupt": False}
        for card in build_cards():
            state["market" if card["starting"] else "deck"].append(card)
        _shuffle(state, state["deck"])
        _refill_market(state)
        _log(state, "💵 第 1 轮开始：从市场募资，建立自己的产业。")
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        phase = state["phase"]
        if phase == "round_end":
            return [] if player_id in state["next_ready"] else ["next_round"]
        if state["current_turn"] != player_id:
            return []
        if phase == "funding":
            return ["pass"] + (["fund"] if _fund_options(state, player_id) else [])
        if phase == "trading":
            actions = ["pass"] + (["offer_trade"] if _trade_targets(state, player_id) else [])
            if state["config"]["advanced"] and any(
                    LUXURIES[lid]["cost"] <= state["players"][player_id]["cash"] for lid in state["luxuries"]):
                actions.append("buy_luxury")
            return actions
        if phase == "trade_response":
            return ["respond_trade"]
        if phase == "market_remove":
            return ["remove_fund"] if state["market"] else []
        if phase == "crash_discard":
            return ["discard_industry"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "invalid Ponzi Scheme action"
        kind = action["type"]
        if kind not in PonziSchemeGame.get_legal_actions(state, player_id):
            return [], "action is not available to this player now"
        player = state["players"][player_id]
        # Validate every action before touching cash, cards, phase, or the private shuffle counter.
        if kind == "fund" and action not in _fund_options(state, player_id):
            return [], "choose an available industry and a fund from its matching row"
        if kind == "offer_trade":
            if {"target": action["target"], "industry": action["industry"]} not in _trade_targets(state, player_id):
                return [], "both players must own the chosen industry"
            if type(action["amount"]) is not int or not 0 <= action["amount"] <= player["cash"]:
                return [], "offer must be a whole amount within your available cash"
        if kind == "respond_trade" and action["response"] == "buy" and player["cash"] < state["offer"]["amount"]:
            return [], "not enough cash to buy; sell the industry instead"
        if kind == "buy_luxury":
            if action["luxury"] not in state["luxuries"] or player["cash"] < LUXURIES[action["luxury"]]["cost"]:
                return [], "luxury is unavailable or too expensive"
        if kind == "remove_fund" and not any(card["id"] == action["card_id"] for card in state["market"]):
            return [], "fund is not in the current market"
        if kind == "discard_industry" and action["industry"] not in _crash_choices(state, player_id):
            return [], "discard one of your largest industries"

        if kind == "fund":
            card = next(card for card in state["market"] if card["id"] == action["card_id"])
            state["market"].remove(card)
            player["debts"].append({**card, "remaining": card["period"]})
            player["cash"] += card["principal"]
            player["industries"][action["industry"]] += 1
            state["supply"][action["industry"]] -= 1
            _log(state, f"{_name(state, player_id)} 募资 💵 {card['principal']}，取得 {INDUSTRIES[action['industry']]['icon']}；每 {card['period']} 格付息 {card['interest']}。")
            _refill_market(state)
            _advance(state)
        elif kind == "pass":
            _log(state, f"{_name(state, player_id)} 跳过{'募资' if state['phase'] == 'funding' else '交易'}。")
            _advance(state)
        elif kind == "offer_trade":
            player["cash"] -= action["amount"]
            state["offer"] = {"source": player_id, "target": action["target"],
                              "industry": action["industry"], "amount": action["amount"]}
            state["phase"] = "trade_response"
            state["current_turn"] = action["target"]
            _log(state, f"✉️ {_name(state, player_id)} 向 {_name(state, action['target'])} 发起 {INDUSTRIES[action['industry']]['icon']} 暗盘交易。")
        elif kind == "respond_trade":
            _respond(state, action["response"])
        elif kind == "buy_luxury":
            lid = action["luxury"]
            state["luxuries"].remove(lid)
            player["cash"] -= LUXURIES[lid]["cost"]
            player["luxuries"].append(lid)
            _log(state, f"{_name(state, player_id)} 购入 {LUXURIES[lid]['icon']} {LUXURIES[lid]['name']}。")
            _advance(state)
        elif kind == "remove_fund":
            card = next(card for card in state["market"] if card["id"] == action["card_id"])
            state["market"].remove(card)
            state["removed" if card["starting"] else "discard"].append(card)
            _log(state, f"{_name(state, player_id)} 移除 💵 {card['principal']} 资金牌"
                        + ("（起始牌永久出局）。" if card["starting"] else "。"))
            _refill_market(state)
            _check_crash(state)
        elif kind == "discard_industry":
            industry = action["industry"]
            player["industries"][industry] -= 1
            state["supply"][industry] += 1
            _log(state, f"🐻 {_name(state, player_id)} 归还 {INDUSTRIES[industry]['icon']} ×1。")
            state["phase_index"] += 1
            _next_crash_player(state)
        elif kind == "next_round":
            state["next_ready"].append(player_id)
            if len(state["next_ready"]) == len(state["turn_order"]):
                state["round"] += 1
                state["crashed"] = False
                state["next_ready"] = []
                state["round_notes"] = []
                _start_phase(state, "funding")
                _log(state, f"💵 第 {state['round']} 轮开始。")
        return [{"type": "ponzi_scheme:update", "payload": {"actor": player_id, "action": kind}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for pid in state["turn_order"]:
            player = state["players"][pid]
            players.append({"player_id": pid, **state["player_meta"][pid],
                            "cash": player["cash"] if pid == viewer_id else None,
                            "industries": dict(player["industries"]), "debts": copy.deepcopy(player["debts"]),
                            "luxuries": list(player["luxuries"]), "bankrupt": player["bankrupt"],
                            "industry_points": sum(industry_points(n) for n in player["industries"].values()),
                            "due_next": sum(card["interest"] for card in player["debts"] if card["remaining"] <= 1),
                            "due_crash": sum(card["interest"] for card in player["debts"] if card["remaining"] <= 2)})
        offer = state["offer"]
        public_offer = None
        if offer:
            public_offer = {key: offer[key] for key in ("source", "target", "industry")}
            if viewer_id in (offer["source"], offer["target"]):
                public_offer["amount"] = offer["amount"]
        legal = PonziSchemeGame.get_legal_actions(state, viewer_id)
        view = {
            "game_id": PonziSchemeGame.game_id, "you": viewer_id, "phase": state["phase"],
            "round": state["round"], "advanced": state["config"]["advanced"],
            "first_round_trading": state["config"]["first_round_trading"],
            "current_turn": state["current_turn"], "start_player": state["start_player"],
            "players": players, "market": copy.deepcopy(state["market"]), "supply": dict(state["supply"]),
            "industry_defs": copy.deepcopy(INDUSTRIES), "luxury_defs": copy.deepcopy(LUXURIES),
            "luxuries": list(state["luxuries"]), "deck_count": len(state["deck"]),
            "discard": copy.deepcopy(state["discard"]), "removed": copy.deepcopy(state["removed"]),
            "offer": public_offer, "bear_count": sum(card["bear"] for card in state["market"]),
            "crashed": state["crashed"], "wheel_steps": state["wheel_steps"],
            "next_ready": list(state["next_ready"]), "last_round": copy.deepcopy(state["last_round"]),
            "log": list(state["log"]), "results": copy.deepcopy(state["results"]),
            "winner": list(state["winner"]), "game_over": state["game_over"], "legal_actions": legal,
            "fund_options": _fund_options(state, viewer_id) if "fund" in legal else [],
            "trade_targets": _trade_targets(state, viewer_id) if "offer_trade" in legal else [],
            "crash_choices": _crash_choices(state, viewer_id) if "discard_industry" in legal else [],
            "private_trades": [copy.deepcopy(trade) for trade in state["trade_history"]
                               if viewer_id in (trade["buyer"], trade["seller"])],
        }
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return _bot_from_view(PonziSchemeGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


def _bot_from_view(view: Dict) -> Optional[Dict]:
    legal = view["legal_actions"]
    if not legal:
        return None
    own = next(player for player in view["players"] if player["player_id"] == view["you"])
    if "next_round" in legal:
        return {"type": "next_round"}
    if "respond_trade" in legal:
        offer = view["offer"]
        seller = next(player for player in view["players"] if player["player_id"] == offer["source"])
        enough = own["cash"] - offer["amount"] >= own["due_crash"]
        prefer_buy = own["industries"][offer["industry"]] >= seller["industries"][offer["industry"]]
        return {"type": "respond_trade", "response": "buy" if enough and prefer_buy else "sell"}
    if "discard_industry" in legal:
        return {"type": "discard_industry", "industry": view["crash_choices"][0]}
    if "remove_fund" in legal:
        needs_time = own["due_crash"] > own["cash"]
        card = max(view["market"], key=lambda card: (
            int(card["bear"]) if needs_time else 0, card["interest"] / card["period"], card["principal"]))
        return {"type": "remove_fund", "card_id": card["id"]}
    if "fund" in legal:
        cards = {card["id"]: card for card in view["market"]}

        def utility(option: Dict) -> float:
            card = cards[option["card_id"]]
            immediate = card["interest"] if card["period"] <= 2 else 0
            survival = min(0, own["cash"] + card["principal"] - own["due_crash"] - immediate)
            return (card["principal"] - 2.5 * card["interest"] / card["period"]
                    + 6 * (own["industries"][option["industry"]] + 1) + 10 * survival)

        return max(view["fund_options"], key=utility)
    if "buy_luxury" in legal:
        choices = [lid for lid in view["luxuries"]
                   if own["cash"] - view["luxury_defs"][lid]["cost"] >= own["due_crash"] * 2 + 25]
        if choices:
            return {"type": "buy_luxury", "luxury": choices[0]}
    if "offer_trade" in legal and own["cash"] > own["due_crash"] + 5:
        target = max(view["trade_targets"], key=lambda option: own["industries"][option["industry"]])
        amount = min(own["cash"] - own["due_crash"], 6 + 4 * own["industries"][target["industry"]])
        return {"type": "offer_trade", **target, "amount": amount}
    return {"type": "pass"} if "pass" in legal else None
