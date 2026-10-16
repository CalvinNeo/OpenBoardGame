"""Information-fair Power Grid policy.

The policy deliberately consumes only :meth:`PowerGridGame.get_public_view`.
It plans fuel and expansion together, prices fuel by the currently visible
market, and evaluates the actual number of cities a company can power.  The
search is intentionally small: a Power Grid company has at most four plants,
so enumerating the dispatch options is cheap and deterministic.
"""

from typing import Dict, List, Optional, Sequence, Tuple

from game.power_grid_data import PLANTS, RESOURCES


def _helpers():
    # Imported lazily to keep ``game.power_grid`` importable without a module
    # cycle when this policy is used directly by a benchmark or a test.
    from game.power_grid import dispatch_options, empty_resources, storage_valid
    return dispatch_options, empty_resources, storage_valid


def _prices(view: Dict) -> Dict[str, List[int]]:
    return {resource: list(view["resources"][resource].get("prices", []))
            for resource in RESOURCES}


def _fuel_cost(fuel: Dict[str, int], prices: Dict[str, List[int]]) -> int:
    return sum(sum(prices[resource][:max(0, amount)])
               for resource, amount in fuel.items())


def _plant_fuel_cost(plant: Dict, prices: Dict[str, List[int]]) -> float:
    resource = plant.get("resource")
    if resource in (None, "green"):
        return 0.0
    if resource == "hybrid":
        available = [prices[name][0] for name in ("coal", "oil") if prices.get(name)]
        return float(plant.get("intake", 0)) * min(available, default=0)
    if not prices.get(resource):
        return 0.0
    return float(plant.get("intake", 0)) * prices[resource][0]


def _player(view: Dict) -> Dict:
    return next(player for player in view["players"] if player["player_id"] == view["you"])


def _plant_ids(player: Dict) -> List[int]:
    return [int(plant["id"]) for plant in player.get("plants", [])]


def _max_powered(player: Dict, city_count: Optional[int] = None) -> int:
    dispatch_options, _, _ = _helpers()
    cities = len(player.get("cities", [])) if city_count is None else city_count
    options = dispatch_options(_plant_ids(player), player.get("resources", {}), cities)
    return max((option["powered"] for option in options), default=0)


def _opponent_power(view: Dict, own_id: str) -> int:
    return max((_max_powered(player) for player in view["players"]
                if player["player_id"] != own_id), default=0)


def _build_budget(view: Dict, additional: int) -> Optional[int]:
    """Conservative cost of adding ``additional`` cities this build phase."""
    if additional <= 0:
        return 0
    quotes = sorted(view.get("build_quotes", []), key=lambda quote: (quote["cost"], quote["city"]))
    if len(quotes) < additional:
        return None
    return sum(int(quote["cost"]) for quote in quotes[:additional])


def _resource_plan(view: Dict) -> Optional[Dict]:
    dispatch_options, empty_resources, storage_valid = _helpers()
    own = _player(view)
    plants = _plant_ids(own)
    money = int(own.get("money") or 0)
    city_count = len(own.get("cities", []))
    prices = _prices(view)
    supply = {resource: int(own["resources"].get(resource, 0))
              + int(view["resources"][resource].get("count", 0))
              for resource in RESOURCES}

    # One useful expansion at a time keeps a company solvent.  If the current
    # network already exceeds the plant capacity, still evaluate its present
    # load so an expensive extra fuel purchase is never made for no house.
    capacity = int(own.get("capacity", sum(PLANTS[n]["output"] for n in plants)))
    max_target = min(int(view.get("end_threshold", city_count + 1)),
                     max(city_count + 1, capacity))
    max_target = max(city_count, max_target)
    candidates: List[Tuple[Tuple[float, int, int, int], Dict[str, int]]] = []
    for target in range(city_count, max_target + 1):
        build_cost = _build_budget(view, target - city_count)
        if build_cost is None:
            continue
        for option in dispatch_options(plants, supply, target):
            buy = {resource: max(0, int(option["fuel"].get(resource, 0))
                                 - int(own["resources"].get(resource, 0)))
                   for resource in RESOURCES}
            if not any(buy.values()):
                buy = empty_resources()
            cost = _fuel_cost(buy, prices)
            total = {resource: int(own["resources"].get(resource, 0)) + buy[resource]
                     for resource in RESOURCES}
            if cost + build_cost > money or not storage_valid(plants, total):
                continue
            # Income pays for the fuel in the current round.  A modest house
            # bonus represents future revenue and makes an affordable, useful
            # expansion beat a no-op when their immediate cash is close.
            expansion_bonus = (target - city_count) * 10
            score = (float(option["income"] - cost + expansion_bonus),
                     int(option["powered"]), target - city_count, -cost)
            candidates.append((score, buy))
    if not candidates:
        return empty_resources()
    return max(candidates, key=lambda item: item[0])[1]


def _choose_auction(view: Dict, legal: Sequence[str]) -> Dict:
    own = _player(view)
    money = int(own.get("money") or 0)
    prices = _prices(view)
    quotes = sorted(view.get("build_quotes", []), key=lambda quote: (quote["cost"], quote["city"]))
    first_house = quotes[0]["cost"] if not own.get("cities") and quotes else 10
    if not own.get("cities"):
        reserve = first_house
    else:
        # A high numbered plant is useful only if the company can still pay
        # for the next two houses.  Keeping this reserve also prevents a bot
        # from spending nearly its whole treasury in a late auction and then
        # sitting out the building phase.
        reserve = min(40, max(12, first_house * 2 + 8))
    plant_limit = int(view.get("plant_limit", 4))
    plants = own.get("plants", [])

    def value(plant: Dict) -> Tuple[float, int, int]:
        resource = plant.get("resource")
        fuel = _plant_fuel_cost(plant, prices)
        output = int(plant.get("output", 0))
        # Green plants receive a small premium because they remain useful when
        # the resource market is empty.  Efficiency breaks equal-output ties.
        return (output * 7.0 - fuel * 1.35 + (2.0 if resource == "green" else 0.0),
                output, -int(plant.get("id", 0)))

    if view.get("auction"):
        auction = view["auction"]
        plant = next((candidate for candidate in view.get("market", [])
                      if candidate.get("id") == auction.get("plant")), None)
        if plant is None or "bid" not in legal:
            return {"type": "pass"}
        worst = min((int(candidate.get("output", 0)) for candidate in plants), default=0)
        gain = int(plant.get("output", 0)) - worst if len(plants) >= plant_limit else int(plant.get("output", 0))
        # A bid is allowed to exceed the card number only when it buys a real
        # improvement.  Always leave enough for the first house.
        surplus_value = max(0.0, gain * 6.0 - _plant_fuel_cost(plant, prices))
        maximum = min(money - reserve, int(plant.get("id", 0) + surplus_value))
        amount = int(auction.get("bid", 0)) + 1
        return {"type": "bid", "amount": amount} if amount <= maximum else {"type": "pass"}

    choices = [plant for plant in view.get("market", []) if plant.get("available")]
    choices = [plant for plant in choices if int(plant.get("id", 0)) <= money]
    if not choices:
        # In the first round ``auction`` is mandatory.  The market always has a
        # legal card, but retain a defensive fallback for malformed views.
        if "pass" in legal:
            return {"type": "pass"}
        available = [plant for plant in view.get("market", []) if plant.get("available")]
        chosen = min(available, key=lambda plant: int(plant.get("id", 3)), default={"id": 3})
        number = int(chosen.get("id", 3))
        return {"type": "auction", "plant": number, "amount": number}
    chosen = max(choices, key=value)
    worst = min((int(candidate.get("output", 0)) for candidate in plants), default=0)
    gain = int(chosen.get("output", 0)) - worst if len(plants) >= plant_limit else int(chosen.get("output", 0))
    surplus_value = max(0.0, gain * 6.0 - _plant_fuel_cost(chosen, prices))
    maximum = min(money - reserve, int(chosen.get("id", 0) + surplus_value))
    if int(view.get("round", 1)) == 1:
        # The first company must buy a plant, and the minimum legal bid is the
        # card number.  Do not spend the house reserve just to overpay.
        amount = int(chosen["id"])
    else:
        amount = min(int(chosen["id"]), max(0, maximum))
        if amount < int(chosen["id"]):
            return {"type": "pass"} if "pass" in legal else {"type": "auction", "plant": chosen["id"], "amount": chosen["id"]}
    return {"type": "auction", "plant": int(chosen["id"]), "amount": amount}


def _choose_replace(view: Dict) -> Dict:
    dispatch_options, empty_resources, storage_valid = _helpers()
    own = _player(view)
    plants = _plant_ids(own)
    new_plant = int(view["new_plant"])
    prices = _prices(view)
    resources = {resource: int(own["resources"].get(resource, 0)) for resource in RESOURCES}

    def retain(remaining: List[int]) -> Dict[str, int]:
        kept = empty_resources()
        # Retain expensive fuel first, but check the shared hybrid capacity on
        # every unit.  The resulting pool is always legal for the new fleet.
        order = sorted(RESOURCES, key=lambda resource: (
            prices[resource][0] if prices[resource] else 0, resource), reverse=True)
        for resource in order:
            for _ in range(resources[resource]):
                kept[resource] += 1
                if not storage_valid(remaining, kept):
                    kept[resource] -= 1
                    break
        return kept

    candidates = []
    for retired in plants:
        if retired == new_plant:
            continue
        remaining = [number for number in plants if number != retired]
        kept = retain(remaining)
        options = dispatch_options(remaining, kept, len(own.get("cities", [])))
        best_power = max((option["powered"] for option in options), default=0)
        efficiency = sum(_plant_fuel_cost(PLANTS[number], prices) for number in remaining)
        output = sum(PLANTS[number]["output"] for number in remaining)
        # First preserve actual current output, then lower running cost.  The
        # final id tie-break keeps reconnects deterministic.
        candidates.append(((best_power, output, -efficiency, -retired), retired, kept))
    if not candidates:
        retired = next(number for number in plants if number != new_plant)
        return {"type": "replace", "plant": retired, "resources": empty_resources()}
    _, retired, kept = max(candidates, key=lambda candidate: candidate[0])
    return {"type": "replace", "plant": retired, "resources": kept}


def _choose_power(view: Dict) -> Dict:
    own = _player(view)
    prices = _prices(view)
    options = view.get("dispatch_options", [])
    if not options:
        return {"type": "power", "plants": [], "hybrid_coal": 0}

    def score(option: Dict) -> Tuple[float, int, int, int]:
        fuel_cost = _fuel_cost(option.get("fuel", {}), prices)
        # Fuel is valued at its visible replacement cost.  This is crucial late
        # in the game: a high-priced plant may add one city for less income than
        # the fuel it consumes.  Prefer more powered cities on equal net value.
        return (float(option.get("income", 0)) - fuel_cost,
                int(option.get("powered", 0)), -fuel_cost,
                -len(option.get("plants", [])))

    option = max(options, key=score)
    return {"type": "power", "plants": list(option["plants"]),
            "hybrid_coal": int(option.get("hybrid_coal", 0))}


def _choose_build(view: Dict, legal: Sequence[str]) -> Dict:
    own = _player(view)
    quotes = [quote for quote in view.get("build_quotes", []) if quote.get("affordable")]
    if not quotes or "build" not in legal:
        return {"type": "done"}
    city_count = len(own.get("cities", []))
    capacity = int(own.get("capacity", 0))
    max_power_now = _max_powered(own)
    threshold = int(view.get("end_threshold", 99))
    # Grow toward the currently supported load.  Building beyond generation
    # capacity while the market still contains plants only strands cash in
    # houses that cannot earn income.  If every remaining plant is gone, use
    # the threshold to break the otherwise unavoidable empty-market stalemate.
    market_exhausted = not view.get("market") and int(view.get("deck_count", 0)) == 0
    can_expand = capacity > city_count or market_exhausted
    if not can_expand:
        return {"type": "done"}
    target = min(threshold, max(city_count + 1, max_power_now))
    if city_count >= target:
        return {"type": "done"}

    chosen = min(quotes, key=lambda quote: (int(quote["cost"]), quote["city"]))
    if city_count + 1 >= threshold:
        hypothetical = dict(own)
        hypothetical["cities"] = list(own.get("cities", [])) + [chosen["city"]]
        own_power = _max_powered(hypothetical)
        rival_power = _opponent_power(view, view["you"])
        # Opponents' money is intentionally hidden.  Only end the game when
        # the public power comparison is a strict win; a tie can be lost on cash.
        if own_power < rival_power or (own_power == rival_power and int(own.get("money") or 0) < 100):
            return {"type": "done"}
    return {"type": "build", "city": chosen["city"]}


def choose_bot_action(view: Dict) -> Optional[Dict]:
    """Choose one legal action using only a single player's public view."""
    legal = list(view.get("legal_actions", []))
    if not legal:
        return None
    if "next_round" in legal:
        return {"type": "next_round"}
    phase = view.get("phase")
    if phase == "auction":
        return _choose_auction(view, legal)
    if phase == "replace":
        return _choose_replace(view)
    if phase == "resources":
        buy = _resource_plan(view)
        if buy and any(buy.values()) and "buy_resources" in legal:
            return {"type": "buy_resources", "resources": buy}
        return {"type": "done"}
    if phase == "building":
        return _choose_build(view, legal)
    if phase == "bureaucracy":
        return _choose_power(view)
    return None

