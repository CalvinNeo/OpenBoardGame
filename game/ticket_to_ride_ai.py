"""Heuristic Ticket to Ride policy: plan ticket paths, then feed that plan."""

import heapq
from collections import defaultdict
from typing import Dict, List, Optional, Sequence, Set, Tuple

from game.ticket_to_ride_data import (
    CARD_COLORS,
    DESTINATIONS,
    LOCOMOTIVE,
    ROUTES,
    ROUTE_POINTS,
    route_pair_key,
)

# A route on a ticket's shortest remaining path is worth far more than raw points.
TICKET_ROUTE_BONUS = 8.0
BIG_TICKET_BONUS = 3.0
CONTESTED_BONUS = 0.7
LONGEST_PATH_WEIGHT = 0.20
# Claiming is only attractive once the hand is deep enough to keep options open.
HAND_COMFORT = 10
HAND_HOARD = 26
TICKET_DRAW_TRAINS = 30
UNREACHABLE = 1 << 30

# Both tracks of a double route share a key, so closing one can close the other.
_PAIR_GROUPS: Dict[Tuple[str, str], List[str]] = defaultdict(list)
for _route_id in ROUTES:
    _PAIR_GROUPS[route_pair_key(_route_id)].append(_route_id)
PAIR_GROUPS: Dict[Tuple[str, str], List[str]] = dict(_PAIR_GROUPS)


def _me(view: Dict) -> Dict:
    return next((p for p in view["players"] if p["player_id"] == view["you"]), {})


def _blocked_routes(view: Dict) -> Set[str]:
    """Routes no one may claim any more, from this seat's point of view."""
    claimed = view["claimed"]
    blocked = {route_id for route_id, owner in claimed.items() if owner != view["you"]}
    small_game = len(view["players"]) <= 3
    for group in PAIR_GROUPS.values():
        owners = [claimed.get(route_id) for route_id in group]
        taken = [owner for owner in owners if owner is not None]
        if not taken:
            continue
        for route_id in group:
            if route_id in claimed:
                continue
            # One player never takes both tracks, and a 2-3 player game closes
            # the second track as soon as the first is taken.
            if small_game or view["you"] in taken:
                blocked.add(route_id)
    return blocked


def _shortest_path(blocked: Set[str], owned: Set[str], start: str, goal: str) -> Tuple[int, List[str]]:
    """Cheapest chain of routes between two cities; trains already placed are free."""
    graph: Dict[str, List[Tuple[str, str, int]]] = defaultdict(list)
    for route_id, route in ROUTES.items():
        if route_id in blocked:
            continue
        cost = 0 if route_id in owned else int(route["length"])
        graph[route["a"]].append((route["b"], route_id, cost))
        graph[route["b"]].append((route["a"], route_id, cost))
    distances = {start: 0}
    paths: Dict[str, List[str]] = {start: []}
    queue = [(0, start)]
    while queue:
        distance, city = heapq.heappop(queue)
        if distance != distances.get(city):
            continue
        if city == goal:
            return distance, paths[city]
        for other, route_id, cost in graph[city]:
            candidate = distance + cost
            if candidate < distances.get(other, UNREACHABLE):
                distances[other] = candidate
                paths[other] = paths[city] + [route_id]
                heapq.heappush(queue, (candidate, other))
    return UNREACHABLE, []


def _open_tickets(view: Dict) -> List[str]:
    status = view.get("ticket_status", {})
    return [t for t in (_me(view).get("tickets") or []) if not status.get(t)]


def _plan(view: Dict) -> Tuple[Set[str], Dict[str, int]]:
    """Routes that still have to be claimed for the bot's open tickets."""
    blocked = _blocked_routes(view)
    owned = set(_me(view).get("routes") or [])
    wanted: Set[str] = set()
    cost: Dict[str, int] = {}
    for ticket_id in _open_tickets(view):
        ticket = DESTINATIONS[ticket_id]
        distance, path = _shortest_path(blocked, owned, ticket["a"], ticket["b"])
        if distance >= UNREACHABLE:
            continue
        for route_id in path:
            if route_id not in owned:
                wanted.add(route_id)
                cost[route_id] = int(ROUTES[route_id]["length"])
    return wanted, cost


def _ticket_cost(view: Dict, ticket_id: str) -> Tuple[int, List[str]]:
    """Trains still required for one ticket, and the routes that would do it."""
    blocked = _blocked_routes(view)
    owned = set(_me(view).get("routes") or [])
    ticket = DESTINATIONS[ticket_id]
    distance, path = _shortest_path(blocked, owned, ticket["a"], ticket["b"])
    if distance >= UNREACHABLE:
        return UNREACHABLE, []
    return distance, [r for r in path if r not in owned]


def _color_needs(view: Dict, wanted: Set[str]) -> Dict[str, int]:
    """How many cards of each colour the plan still needs."""
    hand = _me(view).get("hand") or {}
    needs = dict.fromkeys(list(CARD_COLORS) + [LOCOMOTIVE], 0)
    for route_id in sorted(wanted):
        route = ROUTES[route_id]
        length = int(route["length"])
        color = route["color"]
        if color == "gray":
            color = max(CARD_COLORS, key=lambda c: (hand.get(c, 0) - needs[c], c))
        needs[color] += length
    return {color: max(0, count - hand.get(color, 0)) for color, count in needs.items()}


def _contested(view: Dict, route_id: str) -> bool:
    """True when an opponent's trains already touch one end of this route."""
    route = ROUTES[route_id]
    ends = {route["a"], route["b"]}
    for other_id, owner in view["claimed"].items():
        if owner == view["you"]:
            continue
        other = ROUTES[other_id]
        if ends & {other["a"], other["b"]}:
            return True
    return False


def _cheapest_payment(hand: Dict[str, int], route: Dict) -> Optional[Dict[str, int]]:
    """Spend the fewest wilds, and prefer the colour we hold most of."""
    length = int(route["length"])
    color = route["color"]
    best: Optional[Tuple[Tuple[int, int], Dict[str, object]]] = None
    for primary in CARD_COLORS:
        if color != "gray" and primary != color:
            continue
        available = hand.get(primary, 0)
        locomotives = hand.get(LOCOMOTIVE, 0)
        for used in range(max(0, length - locomotives), min(length, available) + 1):
            option = {"color": primary, "count": used, "locomotives": length - used}
            key = (int(option["locomotives"]), -used)
            if best is None or key < best[0]:
                best = (key, option)
    if hand.get(LOCOMOTIVE, 0) >= length and (best is None or length < best[0][0]):
        best = ((length, 0), {"color": LOCOMOTIVE, "count": 0, "locomotives": length})
    if best is None:
        return None
    option = best[1]
    cards: Dict[str, int] = {}
    if option["count"]:
        cards[str(option["color"])] = int(option["count"])
    if option["locomotives"]:
        cards[LOCOMOTIVE] = int(option["locomotives"])
    return cards


def _best_claim(view: Dict, wanted: Set[str]) -> Optional[Tuple[float, bool, str, Dict[str, int]]]:
    hand = _me(view).get("hand") or {}
    big_ticket = any(DESTINATIONS[t]["points"] >= 13 for t in _open_tickets(view))
    best = None
    for route_id in view["claimable"]:
        route = ROUTES[route_id]
        length = int(route["length"])
        planned = route_id in wanted
        score = ROUTE_POINTS[length] / length + LONGEST_PATH_WEIGHT * length
        if planned:
            score += TICKET_ROUTE_BONUS + (BIG_TICKET_BONUS if big_ticket else 0.0)
        if _contested(view, route_id):
            score += CONTESTED_BONUS
        payment = _cheapest_payment(hand, route)
        if payment is None:
            continue
        if best is None or score > best[0]:
            best = (score, planned, route_id, payment)
    return best


def _keep_tickets(view: Dict) -> List[str]:
    """Keep the ticket set with the best points-per-train return."""
    pending = _me(view).get("pending_tickets") or []
    if not pending:
        return []
    setup = view["phase"] == "setup"
    minimum = 2 if setup else 1
    trains = int(_me(view).get("trains", 45))
    blocked = _blocked_routes(view)
    owned = set(_me(view).get("routes") or [])

    options = []
    for ticket_id in pending:
        ticket = DESTINATIONS[ticket_id]
        distance, path = _shortest_path(blocked, owned, ticket["a"], ticket["b"])
        options.append((ticket_id, int(ticket["points"]), distance, path))

    # Budget keeps a little slack for opportunistic scoring and the final round.
    budget = max(6, trains - (10 if setup else 6))
    subsets: List[Sequence[int]] = []
    size = len(options)
    for mask in range(1, 1 << size):
        chosen = [i for i in range(size) if mask & (1 << i)]
        if len(chosen) >= minimum:
            subsets.append(chosen)

    best_set, best_value = None, None
    for chosen in subsets:
        points = sum(options[i][1] for i in chosen)
        cost = 0
        routes: Set[str] = set()
        feasible = True
        for i in chosen:
            distance, path = options[i][2], options[i][3]
            if distance >= UNREACHABLE:
                feasible = False
                break
            for route_id in path:
                if route_id not in routes:
                    routes.add(route_id)
                    cost += int(ROUTES[route_id]["length"])
        if not feasible:
            continue
        over = max(0, cost - budget)
        value = points - 1.35 * cost - 4.0 * over
        if best_value is None or value > best_value:
            best_set, best_value = chosen, value
    if best_set is None:
        best_set = sorted(range(size), key=lambda i: options[i][2])[:minimum]
    return [options[i][0] for i in best_set]


def _pick_card(view: Dict, wanted: Set[str]) -> Dict:
    needs = _color_needs(view, wanted)
    hand = _me(view).get("hand") or {}
    held = sum(hand.values())
    second = view["stage"] == "drawing" and view["draws_left"] == 1
    best_index, best_value = None, 0.0
    for index, card in enumerate(view["face_up"]):
        if card == LOCOMOTIVE and second:
            continue
        if card == LOCOMOTIVE:
            value = 3.4 if held < 26 else 1.6
        else:
            value = 1.0 + 1.7 * min(2, needs.get(card, 0))
        if value > best_value:
            best_index, best_value = index, value
    if best_index is not None and best_value >= 1.9:
        return {"type": "draw_card", "source": "face_up", "index": best_index}
    if not view["deck_count"] and not view["discard_count"] and best_index is not None:
        return {"type": "draw_card", "source": "face_up", "index": best_index}
    return {"type": "draw_card", "source": "deck"}


def choose_bot_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions") or []
    if not legal:
        return None
    if "keep_tickets" in legal:
        return {"type": "keep_tickets", "tickets": _keep_tickets(view)}

    wanted, _ = _plan(view)
    if view["stage"] == "drawing":
        return _pick_card(view, wanted)

    me = _me(view)
    hand_size = sum((me.get("hand") or {}).values())
    trains = int(me.get("trains", 45))
    open_tickets = _open_tickets(view)
    claim = _best_claim(view, wanted) if "claim_route" in legal else None

    if claim:
        score, planned, route_id, cards = claim
        if planned:
            # Ticket routes come first; they are the only reliable big points.
            return {"type": "claim_route", "route": route_id, "cards": cards}
        if not open_tickets:
            # Every ticket is done: bank raw points and the longest line.
            if hand_size >= HAND_COMFORT or view["last_round"] or score >= 3.6:
                return {"type": "claim_route", "route": route_id, "cards": cards}
        elif hand_size >= HAND_HOARD or (view["last_round"] and score >= 3.6):
            return {"type": "claim_route", "route": route_id, "cards": cards}

    if "draw_card" in legal:
        return _pick_card(view, wanted)
    if claim:
        return {"type": "claim_route", "route": claim[2], "cards": claim[3]}
    if "draw_tickets" in legal and trains >= TICKET_DRAW_TRAINS and not open_tickets:
        return {"type": "draw_tickets"}
    if "pass" in legal:
        return {"type": "pass"}
    return None
