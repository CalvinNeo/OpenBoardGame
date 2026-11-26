import copy
import hashlib
import json
import math
import random
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


CATALOG = json.loads((Path(__file__).parent / "assets/modern_art/catalog.json").read_text())
ARTISTS = CATALOG["artists"]
CARDS = {
    f"{artist['id']}-{kind}-{index}": {
        "id": f"{artist['id']}-{kind}-{index}", "artist": artist["id"], "kind": kind,
    }
    for artist in ARTISTS for kind, count in artist["counts"].items() for index in range(count)
}
CONFIG_SCHEMA = {"type": "object", "properties": {}, "additionalProperties": False}


def _schema(kind: str, fields: Dict) -> Dict:
    properties = {
        "type": {"const": kind}, "game_token": {"type": "string"},
        "round": {"type": "integer", "minimum": 1, "maximum": 4},
        "step": {"type": "integer", "minimum": 1}, **fields,
    }
    return {"type": "object", "properties": properties, "required": list(properties),
            "additionalProperties": False}


ACTION_SCHEMA = {"oneOf": [
    _schema("offer", {"cards": {"type": "array", "minItems": 1, "maxItems": 2,
                                "uniqueItems": True, "items": {"enum": list(CARDS)}}}),
    _schema("add", {"card": {"enum": list(CARDS)}}),
    *[_schema(kind, {"amount": {"type": "integer", "minimum": 0}})
      for kind in ("bid", "set_price")],
    *[_schema(kind, {}) for kind in ("pass", "buy", "next_round")],
]}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _after(state: Dict, player_id: str) -> List[str]:
    order = state["turn_order"]
    index = order.index(player_id)
    return order[index + 1:] + order[:index + 1]


def _log(state: Dict, text: str) -> None:
    state["log"].append({"round": state["round"], "text": text})


def _name(state: Dict, player_id: str) -> str:
    return state["player_meta"][player_id].get("name") or player_id


def _phase(state: Dict, phase: str, current: Optional[str] = None) -> None:
    state.update(phase=phase, current_turn=current, step=state["step"] + 1)


def _deal(state: Dict) -> None:
    count = CATALOG["deals"][str(len(state["turn_order"]))][state["round"] - 1]
    for player_id in state["turn_order"]:
        state["players"][player_id]["hand"].extend(state["deck"].pop() for _ in range(count))


def _next_offer(state: Dict, after: str) -> None:
    state["auction"] = None
    state["next_ready"] = []
    for player_id in _after(state, after):
        if state["players"][player_id]["hand"]:
            _phase(state, "offer", player_id)
            return
    _end_round(state)


def _end_round(state: Dict) -> None:
    ranked = sorted(ARTISTS, key=lambda artist: (-state["counts"][artist["id"]],
                                                ARTISTS.index(artist)))
    bonuses = {artist["id"]: 0 for artist in ARTISTS}
    for artist, bonus in zip(ranked[:3], (30, 20, 10)):
        if state["counts"][artist["id"]] > 0:
            bonuses[artist["id"]] = bonus
    values = {}
    for artist in ARTISTS:
        artist_id = artist["id"]
        state["values"][artist_id].append(bonuses[artist_id])
        values[artist_id] = sum(state["values"][artist_id]) if bonuses[artist_id] else 0
    rows = []
    for player_id in state["turn_order"]:
        player = state["players"][player_id]
        paintings = copy.deepcopy(player["gallery"])
        revenue = sum(values[CARDS[card]["artist"]] for card in paintings)
        player["cash"] += revenue
        player["income"] += revenue
        player["round_income"].append(revenue)
        rows.append({"player_id": player_id, "cards": paintings, "income": revenue})
        state["discard"].extend(paintings)
        player["gallery"] = []
    state["round_summary"] = {"round": state["round"], "counts": dict(state["counts"]),
                              "bonuses": bonuses, "values": values, "rows": rows}
    state["history"].append(copy.deepcopy(state["round_summary"]))
    state["next_ready"] = []
    if state["round"] == 4 or not any(player["hand"] for player in state["players"].values()):
        state["final_results"] = [{
            "player_id": player_id, "initial": 100, "income": player["income"],
            "sales": player["sales"], "spent": player["spent"], "total": player["cash"],
            "round_income": list(player["round_income"]),
        } for player_id, player in state["players"].items()]
        best = max(row["total"] for row in state["final_results"])
        state["winner"] = [row["player_id"] for row in state["final_results"] if row["total"] == best]
    _phase(state, "round_end")
    _log(state, "Season closed. Paintings sold to the bank.")


def _take_card(state: Dict, player_id: str, card_id: str) -> bool:
    state["players"][player_id]["hand"].remove(card_id)
    state["auction"]["cards"].append(card_id)
    artist_id = CARDS[card_id]["artist"]
    state["counts"][artist_id] += 1
    if state["counts"][artist_id] == 5 or not any(player["hand"] for player in state["players"].values()):
        state["discard"].extend(state["auction"]["cards"])
        state["round_ender"] = player_id
        _end_round(state)
        return True
    return False


def _start_bidding(state: Dict) -> None:
    auction = state["auction"]
    kind = CARDS[auction["cards"][-1]]["kind"]
    auction.update(kind=kind, high_bid=0, high_bidder=auction["auctioneer"],
                   passed=[], bids={}, price=None, queue=_after(state, auction["auctioneer"]))
    if kind == "fixed":
        _phase(state, "price", auction["auctioneer"])
    elif kind == "once":
        _phase(state, "once", auction["queue"][0])
    else:
        _phase(state, kind)


def _settle(state: Dict, buyer: str, amount: int) -> None:
    auction = state["auction"]
    player = state["players"][buyer]
    player["cash"] -= amount
    player["spent"] += amount
    owners = auction["owners"]
    payments = [amount] if len(owners) == 1 else [0, amount]
    for owner, payment in zip(owners, payments):
        if owner != buyer:
            state["players"][owner]["cash"] += payment
            state["players"][owner]["sales"] += payment
    player["gallery"].extend(auction["cards"])
    auction.update(buyer=buyer, paid=amount, payments=payments)
    state["next_ready"] = []
    _phase(state, "auction_end")
    _log(state, f"{_name(state, buyer)} acquired {len(auction['cards'])} painting(s) for {amount}K.")


def _matching(state: Dict, player_id: str) -> List[str]:
    artist_id = CARDS[state["auction"]["cards"][0]]["artist"]
    return [card for card in state["players"][player_id]["hand"]
            if CARDS[card]["artist"] == artist_id and CARDS[card]["kind"] != "double"]


class _ModernArtPolicy:
    def __init__(self, view: Dict) -> None:
        self.view = view
        self.order = [player["player_id"] for player in view["players"]]
        self.you = self.order.index(view["you"])
        self.artist_ids = [artist["id"] for artist in ARTISTS]
        self.counts = [view["counts"][artist_id] for artist_id in self.artist_ids]
        self.history = [sum(view["values"][artist_id]) for artist_id in self.artist_ids]
        self.hand = [self.artist_ids.index(CARDS[card]["artist"]) for card in view["hand"]]
        self.galleries = [[sum(CARDS[card]["artist"] == artist_id for card in player["gallery"])
                           for artist_id in self.artist_ids] for player in view["players"]]
        self.pressure = (0.6 if view["round"] == 4 else 0.4) / (len(self.order) - 1)
        facts = [self.counts, self.history, sorted(view["hand"]), self.galleries,
                 [player["hand_count"] for player in view["players"]], view["round"]]
        self.seed = int.from_bytes(hashlib.sha256(json.dumps(facts).encode()).digest()[:8], "big")
        self.scenarios = []
        self.forecasts = {}
        unseen = []
        for artist_index, artist in enumerate(ARTISTS):
            exposed = self.counts[artist_index] + sum(
                summary["counts"][artist["id"]] for summary in view["history"])
            remaining = sum(artist["counts"].values()) - exposed - self.hand.count(artist_index)
            unseen.extend([artist_index] * max(0, remaining))
        rng = random.Random(self.seed)
        for _ in range(32):
            shuffled = list(unseen)
            rng.shuffle(shuffled)
            hands = []
            for player_index, player in enumerate(view["players"]):
                if player_index == self.you:
                    hands.append(list(self.hand))
                else:
                    count = min(player["hand_count"], len(shuffled))
                    hands.append(shuffled[:count])
                    del shuffled[:count]
            self.scenarios.append(hands)

    def prices(self, counts: List[int]) -> List[float]:
        prices = [0.0] * len(ARTISTS)
        for artist_index, bonus in zip(sorted(range(len(ARTISTS)), key=lambda index: (-counts[index], index)), (30, 20, 10)):
            if counts[artist_index]:
                prices[artist_index] = self.history[artist_index] + bonus
        return prices

    def forecast(self, cards: Tuple[str, ...] = (), after: Optional[int] = None) -> Tuple[List[float], List[float]]:
        auction = self.view["auction"]
        if after is None:
            after = self.order.index(auction["auctioneer"]) if auction else self.you
        additions = tuple(self.artist_ids.index(CARDS[card]["artist"]) for card in cards)
        key = (tuple(sorted(additions)), after)
        if key in self.forecasts:
            return self.forecasts[key]
        counts = list(self.counts)
        for artist_index in additions:
            counts[artist_index] += 1
            if counts[artist_index] >= 5:
                result = self.prices(counts), [0.0] * len(ARTISTS)
                self.forecasts[key] = result
                return result
        totals, squares = [0.0] * len(ARTISTS), [0.0] * len(ARTISTS)
        for sample_index, sample in enumerate(self.scenarios):
            hands = [list(hand) for hand in sample]
            for artist_index in additions:
                hands[self.you].remove(artist_index)
            projected = list(counts)
            actor = (after + 1) % len(self.order)
            rng = random.Random(self.seed + sample_index)
            while any(hands):
                hand = hands[actor]
                if hand:
                    weights = [1 + 0.55 * projected[artist_index] + 0.015 * self.history[artist_index]
                               + 0.6 * self.galleries[actor][artist_index] + 0.3 * hand.count(artist_index)
                               for artist_index in hand]
                    chosen = rng.choices(hand, weights=weights)[0]
                    hand.remove(chosen)
                    projected[chosen] += 1
                    if projected[chosen] >= 5:
                        break
                actor = (actor + 1) % len(self.order)
            for artist_index, value in enumerate(self.prices(projected)):
                totals[artist_index] += value / len(self.scenarios)
                squares[artist_index] += value * value / len(self.scenarios)
        deviation = [math.sqrt(max(0, square - mean * mean)) for square, mean in zip(squares, totals)]
        self.forecasts[key] = totals, deviation
        return totals, deviation

    def portfolio(self, prices: List[float]) -> float:
        incomes = [sum(count * value for count, value in zip(gallery, prices)) for gallery in self.galleries]
        return incomes[self.you] - self.pressure * sum(income for index, income in enumerate(incomes) if index != self.you)

    def ending(self, cards: Tuple[str, ...]) -> bool:
        return any(self.counts[index] + sum(CARDS[card]["artist"] == artist_id for card in cards) >= 5
                   for index, artist_id in enumerate(self.artist_ids)) or sum(
                       player["hand_count"] for player in self.view["players"]) <= len(cards)

    def offer_score(self, cards: Tuple[str, ...], adding: bool = False) -> float:
        prices, deviation = self.forecast(cards, self.you)
        score = self.portfolio(prices)
        if not self.ending(cards):
            artist_index = self.artist_ids.index(CARDS[cards[0]]["artist"])
            count = len(cards) + (1 if adding else 0)
            value = max(0, prices[artist_index] - 0.15 * deviation[artist_index]) * count
            if CARDS[cards[0]]["kind"] == "double" and len(cards) == 1:
                companion_rate = sum(any(artist_index in hand for index, hand in enumerate(sample) if index != self.you)
                                     for sample in self.scenarios) / len(self.scenarios)
                score += value * (1 - companion_rate) - self.pressure * value * companion_rate
            else:
                score += value * (0.67 - 0.33 * self.pressure)
        for card in cards:
            artist_index = self.artist_ids.index(CARDS[card]["artist"])
            score -= 0.06 * (4 - self.view["round"]) * (self.history[artist_index] + 15)
        return score

    def choose_offer(self) -> Dict:
        candidates = []
        signatures = set()
        for card in self.view["hand"]:
            record = CARDS[card]
            signature = record["artist"], record["kind"]
            if signature in signatures:
                continue
            signatures.add(signature)
            candidates.append((card,))
            if record["kind"] == "double":
                companions = {}
                for other in self.view["hand"]:
                    if CARDS[other]["artist"] == record["artist"] and CARDS[other]["kind"] != "double":
                        companions.setdefault(CARDS[other]["kind"], other)
                candidates.extend((card, other) for other in companions.values())
        cards = max(candidates, key=lambda candidate: (self.offer_score(candidate), -len(candidate)))
        return {"type": "offer", "cards": list(cards)}

    def trade_score(self, buyer: int, price: int, value: float, auctioneer: int) -> float:
        changes = [0.0] * len(self.order)
        changes[buyer] += value - price
        if buyer != auctioneer:
            changes[auctioneer] += price
        return changes[self.you] - self.pressure * sum(change for index, change in enumerate(changes) if index != self.you)

    def bid(self) -> Optional[Dict]:
        auction = self.view["auction"]
        legal = self.view["legal_actions"]
        phase = self.view["phase"]
        prices, deviation = self.forecast()
        artist_index = self.artist_ids.index(CARDS[auction["cards"][0]]["artist"])
        count = len(auction["cards"])
        value = count * max(0, prices[artist_index] - 0.18 * deviation[artist_index])
        auctioneer = self.order.index(auction["auctioneer"])
        cash = self.view["cash"]
        if phase == "price":
            def price_score(price: int) -> float:
                remaining = 1.0
                result = 0.0
                for offset in range(1, len(self.order)):
                    buyer = (auctioneer + offset) % len(self.order)
                    acceptance = 0.0 if value <= 0 else max(0, min(1, (0.95 * value - price) / max(1, 0.6 * value)))
                    result += remaining * acceptance * self.trade_score(buyer, price, value, auctioneer)
                    remaining *= 1 - acceptance
                return result + remaining * self.trade_score(self.you, price, value, auctioneer)
            maximum = min(cash, math.floor(value))
            return {"type": "set_price", "amount": max(range(maximum + 1), key=price_score)}
        reserve = min(cash * 0.15, 5 * (4 - self.view["round"])) if cash > 15 else 0
        maximum = min(cash - reserve, value * (1 + self.pressure) / (2 + self.pressure) if self.you == auctioneer else value)
        limit = max(0, math.floor(maximum))
        if phase == "fixed":
            return {"type": "buy"} if "buy" in legal and auction["price"] <= limit else {"type": "pass"}
        if phase == "sealed":
            rng = random.Random(self.seed)
            trials = []
            for _ in range(48):
                trials.append([0 if rng.random() < 0.12 else max(0, round(value * rng.triangular(0.35, 1.0, 0.7)
                                * (0.6 if index == auctioneer else 1))) for index in range(len(self.order))])
            order = [(auctioneer + offset) % len(self.order) for offset in range(len(self.order))]
            def bid_score(amount: int) -> float:
                total = 0.0
                for bids in trials:
                    candidate = list(bids)
                    candidate[self.you] = amount
                    buyer = max(order, key=lambda index: candidate[index])
                    total += self.trade_score(buyer, candidate[buyer], value, auctioneer)
                return total
            return {"type": "bid", "amount": max(range(limit + 1), key=bid_score)}
        minimum = auction["high_bid"] + 1
        if "bid" in legal and minimum <= limit:
            if phase == "once" and auction["queue"][-1] != self.view["you"]:
                minimum = max(minimum, min(limit, math.floor(value * 0.7)))
            return {"type": "bid", "amount": minimum}
        return {"type": "pass"} if "pass" in legal else None

    def choose(self) -> Optional[Dict]:
        legal = self.view["legal_actions"]
        if "offer" in legal:
            return self.choose_offer()
        if "add" in legal:
            artist_id = CARDS[self.view["auction"]["cards"][0]]["artist"]
            matches = [(card,) for card in self.view["hand"]
                       if CARDS[card]["artist"] == artist_id and CARDS[card]["kind"] != "double"]
            best = max(matches, key=lambda candidate: self.offer_score(candidate, adding=True))
            prices, _ = self.forecast()
            pass_score = self.portfolio(prices) - self.pressure * prices[self.artist_ids.index(artist_id)]
            return {"type": "add", "card": best[0]} if self.offer_score(best, adding=True) >= pass_score else {"type": "pass"}
        if self.view["phase"] == "double":
            return {"type": "pass"}
        return self.bid()


def _choose_bot_action(view: Dict) -> Optional[Dict]:
    if not view["legal_actions"]:
        return None
    action = {"game_token": view["game_token"], "round": view["round"], "step": view["step"]}
    if "next_round" in view["legal_actions"]:
        return {**action, "type": "next_round"}
    choice = _ModernArtPolicy(view).choose()
    return {**action, **choice} if choice else None


class ModernArtGame:
    game_id = "modern_art"
    min_players = 3
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not _CONFIG_VALIDATOR.is_valid({} if config is None else config):
            raise ValueError("invalid Modern Art configuration")
        if not isinstance(players, list) or not 3 <= len(players) <= 5:
            raise ValueError("Modern Art requires 3–5 players")
        if any(not isinstance(player, dict) or not isinstance(player.get("player_id"), str)
               or not player["player_id"] or type(player.get("seat", 0)) is not int for player in players):
            raise ValueError("invalid player identity")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique")
        deck = list(CARDS)
        random.shuffle(deck)
        state = {
            "game_id": "modern_art", "version": 1, "config": {}, "game_token": uuid.uuid4().hex,
            "players": {player_id: {"cash": 100, "hand": [], "gallery": [], "income": 0,
                                     "sales": 0, "spent": 0, "round_income": []} for player_id in ids},
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in ordered},
            "turn_order": ids, "deck": deck, "discard": [], "round": 1, "step": 1,
            "revision": 0, "phase": "offer", "current_turn": ids[0], "round_ender": ids[0],
            "counts": {artist["id"]: 0 for artist in ARTISTS},
            "values": {artist["id"]: [] for artist in ARTISTS}, "auction": None,
            "next_ready": [], "round_summary": None, "history": [], "log": [],
            "game_over": False, "winner": [], "final_results": [],
        }
        _deal(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        phase = state["phase"]
        auction = state["auction"]
        if phase in ("auction_end", "round_end"):
            return [] if player_id in state["next_ready"] else ["next_round"]
        if phase == "sealed":
            return [] if player_id in auction["bids"] else ["bid"]
        if phase == "open":
            if player_id == auction["high_bidder"] and auction["high_bid"] > 0:
                return []
            actions = ["bid"] if state["players"][player_id]["cash"] > auction["high_bid"] else []
            return actions + ([] if player_id in auction["passed"] or player_id == auction["high_bidder"] else ["pass"])
        if state["current_turn"] != player_id:
            return []
        if phase == "offer":
            return ["offer"]
        if phase == "double":
            return (["add"] if _matching(state, player_id) else []) + ["pass"]
        if phase == "price":
            return ["set_price"]
        if phase == "fixed":
            return (["buy"] if state["players"][player_id]["cash"] >= auction["price"] else []) + ["pass"]
        if phase == "once":
            return (["bid"] if state["players"][player_id]["cash"] > auction["high_bid"] else []) + ["pass"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if any(type(action[key]) is not int for key in ("round", "step", "amount") if key in action):
            return [], "action numbers must be integers"
        if (action["game_token"], action["round"], action["step"]) != (state["game_token"], state["round"], state["step"]):
            return [], "stale game or turn"
        kind = action["type"]
        if kind not in ModernArtGame.get_legal_actions(state, player_id):
            return [], "action unavailable"
        player = state["players"][player_id]
        auction = state["auction"]
        phase = state["phase"]
        if kind == "offer":
            cards = action["cards"]
            if any(card not in player["hand"] for card in cards):
                return [], "card not in hand"
            if len(cards) == 2 and (CARDS[cards[0]]["kind"] != "double"
                                  or CARDS[cards[1]]["kind"] == "double"
                                  or CARDS[cards[0]]["artist"] != CARDS[cards[1]]["artist"]):
                return [], "a double needs one matching non-double painting"
            state["auction"] = {"cards": [], "owners": [player_id], "auctioneer": player_id,
                                "origin": player_id, "kind": CARDS[cards[0]]["kind"]}
            for card in cards:
                if _take_card(state, player_id, card):
                    break
            else:
                if CARDS[cards[-1]]["kind"] == "double":
                    state["auction"]["queue"] = _after(state, player_id)[:-1]
                    _phase(state, "double", state["auction"]["queue"][0])
                else:
                    _start_bidding(state)
            _log(state, f"{_name(state, player_id)} offered a painting.")
        elif kind == "add":
            if action["card"] not in _matching(state, player_id):
                return [], "a matching non-double painting is required"
            auction["owners"].append(player_id)
            auction["auctioneer"] = player_id
            if not _take_card(state, player_id, action["card"]):
                _start_bidding(state)
        elif kind == "set_price":
            if action["amount"] > player["cash"]:
                return [], "price must be affordable by the auctioneer"
            auction["price"] = action["amount"]
            auction["queue"] = _after(state, player_id)[:-1]
            _phase(state, "fixed", auction["queue"][0])
        elif kind == "buy":
            _settle(state, player_id, auction["price"])
        elif kind == "bid":
            amount = action["amount"]
            if amount > player["cash"] or (phase != "sealed" and amount <= auction["high_bid"]):
                return [], "bid must be affordable and exceed the current bid"
            if phase == "sealed":
                auction["bids"][player_id] = amount
                if len(auction["bids"]) == len(state["turn_order"]):
                    order = [auction["auctioneer"]] + _after(state, auction["auctioneer"])[:-1]
                    buyer = max(order, key=lambda candidate: auction["bids"][candidate])
                    _settle(state, buyer, auction["bids"][buyer])
            else:
                auction.update(high_bid=amount, high_bidder=player_id, passed=[])
                _log(state, f"{_name(state, player_id)} bid {amount}K.")
                if phase == "once":
                    auction["queue"].pop(0)
                    if auction["queue"]:
                        _phase(state, "once", auction["queue"][0])
                    else:
                        _settle(state, auction["high_bidder"], auction["high_bid"])
                else:
                    state["step"] += 1
        elif kind == "pass":
            if phase == "double":
                auction["queue"].pop(0)
                if auction["queue"]:
                    _phase(state, "double", auction["queue"][0])
                else:
                    _settle(state, auction["origin"], 0)
            elif phase in ("once", "fixed"):
                auction["queue"].pop(0)
                if auction["queue"]:
                    _phase(state, phase, auction["queue"][0])
                elif phase == "once":
                    _settle(state, auction["high_bidder"], auction["high_bid"])
                else:
                    _settle(state, auction["auctioneer"], auction["price"])
            else:
                auction["passed"].append(player_id)
                if len(auction["passed"]) == len(state["turn_order"]) - 1:
                    _settle(state, auction["high_bidder"], auction["high_bid"])
        elif kind == "next_round":
            state["next_ready"].append(player_id)
            if len(state["next_ready"]) == len(state["turn_order"]):
                if phase == "auction_end":
                    _next_offer(state, auction["auctioneer"])
                elif state["final_results"]:
                    state["game_over"] = True
                    _phase(state, "game_over")
                else:
                    state["round"] += 1
                    state["counts"] = {artist["id"]: 0 for artist in ARTISTS}
                    state["round_summary"] = None
                    _deal(state)
                    _next_offer(state, state["round_ender"])
        state["revision"] += 1
        return [{"type": "modern_art:action", "payload": {"player_id": player_id, "type": kind}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = state["players"].get(viewer_id, {})
        auction = copy.deepcopy(state["auction"])
        if auction:
            auction["submitted"] = list(auction.get("bids", {}))
            if state["phase"] == "sealed":
                auction["bids"] = {}
        view = {key: copy.deepcopy(state[key]) for key in (
            "game_id", "game_token", "round", "step", "revision", "phase", "current_turn",
            "counts", "values", "next_ready", "round_summary", "history", "log",
            "game_over", "winner", "final_results",
        )}
        view.update(you=viewer_id, config={}, artists=copy.deepcopy(ARTISTS),
                    card_catalog=copy.deepcopy(CARDS), auction=auction,
                    hand=list(own.get("hand", [])), cash=own.get("cash"),
                    your_bid=(state["auction"] or {}).get("bids", {}).get(viewer_id),
                    legal_actions=ModernArtGame.get_legal_actions(state, viewer_id),
                    deck_count=len(state["deck"]), players=[{
                        "player_id": player_id, "name": _name(state, player_id),
                        "seat": state["player_meta"][player_id].get("seat", 0),
                        "is_bot": bool(state["player_meta"][player_id].get("is_bot")),
                        "cash": player["cash"] if state["final_results"] or player_id == viewer_id else None,
                        "hand_count": len(player["hand"]), "gallery": list(player["gallery"]),
                    } for player_id, player in state["players"].items()])
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return _choose_bot_action(ModernArtGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
