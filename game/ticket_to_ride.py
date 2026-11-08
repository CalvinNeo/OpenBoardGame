"""Server-authoritative Ticket to Ride (North America, 2004 base game)."""

import copy
import random
import secrets
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from game.ticket_to_ride_data import (
    ALL_CARD_TYPES,
    CARDS_PER_COLOR,
    CARD_COLORS,
    CITIES,
    DESTINATIONS,
    DESTINATION_IDS,
    DOUBLE_ROUTE_MAX_PLAYERS,
    DRAW_TICKETS,
    DRAW_TICKETS_MIN_KEEP,
    FACE_UP_LOCOMOTIVE_LIMIT,
    FACE_UP_SLOTS,
    LOCOMOTIVE,
    LOCOMOTIVE_CARDS,
    LONGEST_PATH_BONUS,
    ROUTES,
    ROUTE_IDS,
    ROUTE_POINTS,
    STARTING_HAND,
    STARTING_TICKETS,
    STARTING_TICKETS_MIN_KEEP,
    TRAINS_PER_PLAYER,
    route_pair_key,
)

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "maxLength": 80}]},
    },
    "additionalProperties": False,
}
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"enum": ["keep_tickets", "draw_card", "claim_route", "draw_tickets", "pass"]},
        "revision": {"type": "integer", "minimum": 0},
        "tickets": {"type": "array", "items": {"type": "string"},
                    "uniqueItems": True, "maxItems": STARTING_TICKETS},
        "source": {"enum": ["deck", "face_up"]},
        "index": {"type": "integer", "minimum": 0, "maximum": FACE_UP_SLOTS - 1},
        "route": {"type": "string", "maxLength": 80},
        "cards": {"type": "object", "properties": {
            color: {"type": "integer", "minimum": 0, "maximum": 6} for color in ALL_CARD_TYPES},
            "additionalProperties": False},
    },
    "required": ["type"],
    "additionalProperties": False,
}

ACTION_FIELDS = {
    "keep_tickets": {"tickets"},
    "draw_card": {"source", "index"},
    "claim_route": {"route", "cards"},
    "draw_tickets": set(),
    "pass": set(),
}

# Longest-path search is exponential in theory; the board is sparse enough that a
# bounded search always finishes, and the cap keeps a pathological claim set safe.
_PATH_SEARCH_BUDGET = 400_000


def _empty_hand() -> Dict[str, int]:
    return dict.fromkeys(ALL_CARD_TYPES, 0)


def _log(state: Dict, text: str) -> None:
    state["log"].append({"round": state["round"], "text": text})
    state["log"] = state["log"][-120:]


def _name(state: Dict, pid: str) -> str:
    return state["player_meta"][pid].get("name", pid)


def hand_size(hand: Dict[str, int]) -> int:
    return sum(hand.values())


# ---------------------------------------------------------------- deck helpers

def _draw_train_card(state: Dict) -> Optional[str]:
    """Take one card off the deck, reshuffling the discards when it runs dry."""
    if not state["deck"]:
        if not state["discard"]:
            return None
        rng = random.Random(f'{state["seed"]}:reshuffle:{state["revision"]}:{len(state["discard"])}')
        rng.shuffle(state["discard"])
        state["deck"] = state["discard"]
        state["discard"] = []
    if not state["deck"]:
        return None
    return state["deck"].pop()


def _refill_face_up(state: Dict) -> None:
    """Top the display back up to five cards, honouring the locomotive limit."""
    for _ in range(FACE_UP_SLOTS * 4):
        while len(state["face_up"]) < FACE_UP_SLOTS:
            card = _draw_train_card(state)
            if card is None:
                return
            state["face_up"].append(card)
        locomotives = sum(card == LOCOMOTIVE for card in state["face_up"])
        if locomotives < FACE_UP_LOCOMOTIVE_LIMIT:
            return
        # Three or more locomotives showing: scrap the whole display and redeal.
        state["discard"].extend(state["face_up"])
        state["face_up"] = []


def _take_face_up(state: Dict, index: int) -> str:
    card = state["face_up"].pop(index)
    _refill_face_up(state)
    return card


def _draw_ticket_cards(state: Dict, count: int) -> List[str]:
    drawn = []
    for _ in range(count):
        if not state["ticket_deck"]:
            break
        drawn.append(state["ticket_deck"].pop(0))
    return drawn


# ------------------------------------------------------------- claiming routes

def payment_options(hand: Dict[str, int], route: Dict) -> List[Dict[str, object]]:
    """Every legal way to pay for a route, cheapest in locomotives first."""
    length = int(route["length"])
    color = route["color"]
    options: List[Dict[str, object]] = []
    for primary in CARD_COLORS:
        if color != "gray" and primary != color:
            continue
        available = hand.get(primary, 0)
        locomotives = hand.get(LOCOMOTIVE, 0)
        low = max(0, length - locomotives)
        for used in range(low, min(length, available) + 1):
            options.append({"color": primary, "count": used, "locomotives": length - used})
    # A pure locomotive set is legal on any route, including coloured ones.
    if hand.get(LOCOMOTIVE, 0) >= length:
        options.append({"color": LOCOMOTIVE, "count": 0, "locomotives": length})
    unique: List[Dict[str, object]] = []
    seen = set()
    for option in options:
        key = (option["color"], option["count"], option["locomotives"])
        if key not in seen:
            seen.add(key)
            unique.append(option)
    unique.sort(key=lambda o: (o["locomotives"], -o["count"], o["color"]))
    return unique


def cards_to_dict(option: Dict[str, object]) -> Dict[str, int]:
    cards = _empty_hand()
    if option["count"]:
        cards[str(option["color"])] = int(option["count"])
    if option["locomotives"]:
        cards[LOCOMOTIVE] = int(option["locomotives"])
    return cards


def _payment_from_cards(route: Dict, cards: Dict[str, int]) -> Optional[Dict[str, object]]:
    """Normalise a submitted card dict into a single validated payment option."""
    if not isinstance(cards, dict):
        return None
    total = 0
    primary_color = None
    primary_count = 0
    for color, count in cards.items():
        if color not in ALL_CARD_TYPES or type(count) is not int or count < 0:
            return None
        if count:
            total += count
            if color == LOCOMOTIVE:
                continue
            if primary_color is not None:
                return None  # never mix two colours on one route
            primary_color, primary_count = color, count
    if total != int(route["length"]):
        return None
    locomotives = cards.get(LOCOMOTIVE, 0)
    route_color = route["color"]
    if primary_color is None:
        return {"color": LOCOMOTIVE, "count": 0, "locomotives": locomotives}
    if route_color != "gray" and primary_color != route_color:
        return None
    return {"color": primary_color, "count": primary_count, "locomotives": locomotives}


def route_blocked_reason(state: Dict, pid: str, route_id: str) -> Optional[str]:
    """Why this route cannot be claimed right now, or None when it is open."""
    route = ROUTES.get(route_id)
    if route is None:
        return "unknown route"
    owner = state["claimed"].get(route_id)
    if owner is not None:
        return "already claimed"
    pair = route_pair_key(route_id)
    siblings = [rid for rid in ROUTE_IDS if route_pair_key(rid) == pair]
    for sibling in siblings:
        if state["claimed"].get(sibling) == pid:
            return "you already own the parallel route"
        if sibling != route_id and state["claimed"].get(sibling) is not None:
            if len(state["players"]) <= DOUBLE_ROUTE_MAX_PLAYERS:
                return "the parallel route closes this one in a 2-3 player game"
    player = state["players"][pid]
    if player["trains"] < int(route["length"]):
        return "not enough trains"
    return None


def claimable_routes(state: Dict, pid: str) -> List[str]:
    player = state["players"].get(pid)
    if not player:
        return []
    result = []
    for route_id in ROUTE_IDS:
        if route_blocked_reason(state, pid, route_id) is not None:
            continue
        if payment_options(player["hand"], ROUTES[route_id]):
            result.append(route_id)
    return result


# ------------------------------------------------------------------- scoring

def longest_path(state: Dict, pid: str) -> int:
    """Longest continuous line of one player's trains (no train counted twice)."""
    route_ids = state["players"][pid]["routes"]
    if not route_ids:
        return 0
    adjacency: Dict[str, List[Tuple[str, str, int]]] = defaultdict(list)
    for route_id in route_ids:
        route = ROUTES[route_id]
        length = int(route["length"])
        adjacency[route["a"]].append((route["b"], route_id, length))
        adjacency[route["b"]].append((route["a"], route_id, length))
    best = 0
    used: set = set()
    budget = [_PATH_SEARCH_BUDGET]

    def walk(city: str, total: int) -> None:
        nonlocal best
        if total > best:
            best = total
        if budget[0] <= 0:
            return
        for other, route_id, length in adjacency[city]:
            if route_id in used:
                continue
            budget[0] -= 1
            used.add(route_id)
            walk(other, total + length)
            used.discard(route_id)
            if budget[0] <= 0:
                return

    for city in list(adjacency):
        walk(city, 0)
        if budget[0] <= 0:
            break
    return best


def connected_cities(state: Dict, pid: str) -> Dict[str, set]:
    """Component label per city for one player's claimed network."""
    parent: Dict[str, str] = {city: city for city in CITIES}

    def find(city: str) -> str:
        while parent[city] != city:
            parent[city] = parent[parent[city]]
            city = parent[city]
        return city

    for route_id in state["players"][pid]["routes"]:
        route = ROUTES[route_id]
        a, b = find(route["a"]), find(route["b"])
        if a != b:
            parent[a] = b
    groups: Dict[str, set] = defaultdict(set)
    for city in CITIES:
        groups[find(city)].add(city)
    return {city: groups[find(city)] for city in CITIES}


def ticket_completed(state: Dict, pid: str, ticket_id: str) -> bool:
    ticket = DESTINATIONS[ticket_id]
    groups = connected_cities(state, pid)
    return ticket["b"] in groups[ticket["a"]]


def score_game(state: Dict) -> None:
    lengths = {pid: longest_path(state, pid) for pid in state["seat_order"]}
    best_length = max(lengths.values()) if lengths else 0
    results = []
    for pid in state["seat_order"]:
        player = state["players"][pid]
        completed, missed = [], []
        for ticket_id in player["tickets"]:
            (completed if ticket_completed(state, pid, ticket_id) else missed).append(ticket_id)
        bonus = LONGEST_PATH_BONUS if lengths[pid] == best_length and best_length > 0 else 0
        ticket_points = sum(DESTINATIONS[t]["points"] for t in completed)
        penalty = sum(DESTINATIONS[t]["points"] for t in missed)
        total = player["route_points"] + ticket_points - penalty + bonus
        results.append({
            "player_id": pid,
            "route_points": player["route_points"],
            "routes": len(player["routes"]),
            "trains_left": player["trains"],
            "completed": completed,
            "missed": missed,
            "ticket_points": ticket_points,
            "penalty": penalty,
            "longest_path": lengths[pid],
            "longest_bonus": bonus,
            "total": total,
        })
    results.sort(key=lambda r: (r["total"], len(r["completed"]), r["longest_bonus"]), reverse=True)
    best = results[0] if results else None
    if best:
        key = (best["total"], len(best["completed"]), best["longest_bonus"])
        state["winner_ids"] = [r["player_id"] for r in results
                               if (r["total"], len(r["completed"]), r["longest_bonus"]) == key]
    state["final_results"] = results
    state["game_over"] = True
    state["phase"] = "game_over"
    state["stage"] = "action"
    state["current_turn"] = None
    state["final_turns"] = []
    winners = " · ".join(_name(state, pid) for pid in state["winner_ids"])
    _log(state, f"Final scores are in. 🏆 {winners}")


# ------------------------------------------------------------- turn machinery

def _end_turn(state: Dict) -> None:
    """Advance to the next player, opening or closing the final round."""
    pid = state["current_turn"]
    state["round"] += 1
    player = state["players"][pid]
    order = state["order"]
    if not state["last_round"] and player["trains"] <= 2:
        # Everyone takes exactly one more turn, the trigger included, in seat order.
        state["last_round"] = True
        start = order.index(pid)
        state["final_turns"] = [order[(start + 1 + step) % len(order)]
                               for step in range(len(order))]
        _log(state, f'{_name(state, pid)} is down to {player["trains"]} 🚃 — final round!')
    elif state["last_round"] and pid in state["final_turns"]:
        state["final_turns"].remove(pid)

    if state["last_round"]:
        if not state["final_turns"]:
            score_game(state)
            return
        state["current_turn"] = state["final_turns"][0]
        state["phase"] = "final_round"
    else:
        state["current_turn"] = order[(order.index(pid) + 1) % len(order)]
        state["phase"] = "playing"
    state["stage"] = "action"
    state["draws_left"] = 0
    state["drew_face_up_locomotive"] = False


def _begin_setup(state: Dict) -> None:
    state["phase"] = "setup"
    state["stage"] = "choosing_tickets"
    state["current_turn"] = None
    for pid in state["seat_order"]:
        state["players"][pid]["pending_tickets"] = _draw_ticket_cards(state, STARTING_TICKETS)


def _maybe_start_play(state: Dict) -> None:
    if state["phase"] != "setup":
        return
    if not all(state["players"][pid]["ready"] for pid in state["seat_order"]):
        return
    state["phase"] = "playing"
    state["stage"] = "action"
    state["round"] = 1
    state["current_turn"] = state["order"][0]
    _log(state, f'{_name(state, state["order"][0])} goes first.')


# ------------------------------------------------------------------- legality

def _can_draw_cards(state: Dict) -> bool:
    return bool(state["deck"] or state["discard"] or state["face_up"])


def _can_draw_tickets(state: Dict) -> bool:
    return bool(state["ticket_deck"])


class TicketToRideGame:
    game_id = "ticket_to_ride"
    min_players = 2
    max_players = 5
    supported_player_counts = (2, 3, 4, 5)

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 2 <= len(players) <= 5:
            raise ValueError("Ticket to Ride requires 2-5 players")
        cfg = {} if config is None else config
        if not isinstance(cfg, dict) or set(cfg) - {"seed"}:
            raise ValueError("invalid Ticket to Ride configuration")
        seed = cfg.get("seed", secrets.token_hex(16))
        if type(seed) is not int and not (isinstance(seed, str) and len(seed) <= 80):
            raise ValueError("invalid seed")

        meta = {p["player_id"]: {k: p[k] for k in ("player_id", "name", "seat", "is_bot") if k in p}
                for p in players}
        if len(meta) != len(players) or any(not isinstance(pid, str) or not pid for pid in meta):
            raise ValueError("player IDs must be unique non-empty strings")
        seats = sorted(meta, key=lambda pid: (meta[pid].get("seat", 0), pid))

        rng = random.Random(seed)
        order = list(seats)
        rng.shuffle(order)
        # Play proceeds clockwise from whoever was drawn to start.
        start = order[0]
        seats_from_start = seats[seats.index(start):] + seats[:seats.index(start)]

        deck = [color for color in CARD_COLORS for _ in range(CARDS_PER_COLOR)]
        deck += [LOCOMOTIVE] * LOCOMOTIVE_CARDS
        rng.shuffle(deck)
        ticket_deck = list(DESTINATION_IDS)
        rng.shuffle(ticket_deck)

        state = {
            "version": 1,
            "seed": seed,
            "config": {},
            "player_meta": meta,
            "seat_order": seats,
            "order": seats_from_start,
            "players": {pid: {"trains": TRAINS_PER_PLAYER, "hand": _empty_hand(),
                              "tickets": [], "pending_tickets": [], "routes": [],
                              "route_points": 0, "ready": False} for pid in seats},
            "claimed": {},
            "deck": deck,
            "discard": [],
            "face_up": [],
            "ticket_deck": ticket_deck,
            "phase": "setup",
            "stage": "choosing_tickets",
            "current_turn": None,
            "round": 0,
            "revision": 0,
            "draws_left": 0,
            "drew_face_up_locomotive": False,
            "last_round": False,
            "final_turns": [],
            "log": [],
            "game_over": False,
            "winner_ids": [],
            "final_results": [],
        }
        for pid in seats:
            for _ in range(STARTING_HAND):
                card = _draw_train_card(state)
                if card:
                    state["players"][pid]["hand"][card] += 1
        _refill_face_up(state)
        _begin_setup(state)
        _log(state, "North America · keep at least 2 of your 3 🎫 destination tickets.")
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] == "setup":
            return [] if state["players"][player_id]["ready"] else ["keep_tickets"]
        if state["current_turn"] != player_id:
            return []
        if state["stage"] == "drawing":
            return ["draw_card"]
        if state["stage"] == "choosing_tickets":
            return ["keep_tickets"]
        actions = []
        if _can_draw_cards(state):
            actions.append("draw_card")
        if claimable_routes(state, player_id):
            actions.append("claim_route")
        if _can_draw_tickets(state):
            actions.append("draw_tickets")
        if not actions:
            actions.append("pass")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        try:
            kind = _check_action(state, player_id, action)
            draft = copy.deepcopy(state)
            _apply(draft, player_id, action, kind)
        except ValueError as error:
            return [], str(error)
        draft["revision"] += 1
        state.clear()
        state.update(draft)
        return [{"type": "ticket_to_ride:update",
                 "payload": {"phase": state["phase"], "round": state["round"]}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for pid in state["seat_order"]:
            player, meta = state["players"][pid], state["player_meta"][pid]
            mine = pid == viewer_id
            players.append({
                "player_id": pid,
                "name": meta.get("name", pid),
                "seat": meta.get("seat", 0),
                "is_bot": bool(meta.get("is_bot")),
                "trains": player["trains"],
                "routes": list(player["routes"]),
                "route_points": player["route_points"],
                "hand_count": hand_size(player["hand"]),
                "ticket_count": len(player["tickets"]),
                "hand": dict(player["hand"]) if mine or state["game_over"] else None,
                "tickets": list(player["tickets"]) if mine or state["game_over"] else None,
                "pending_tickets": list(player["pending_tickets"]) if mine else None,
                "ready": player["ready"],
            })
        view = {key: state[key] for key in (
            "phase", "stage", "current_turn", "round", "revision", "order", "seat_order",
            "last_round", "final_turns", "draws_left", "drew_face_up_locomotive",
            "winner_ids", "final_results", "game_over", "log")}
        view.update(
            game_id=TicketToRideGame.game_id,
            you=viewer_id,
            players=players,
            face_up=list(state["face_up"]),
            deck_count=len(state["deck"]),
            discard_count=len(state["discard"]),
            ticket_deck_count=len(state["ticket_deck"]),
            claimed=dict(state["claimed"]),
            cities=CITIES,
            routes=ROUTES,
            destinations=DESTINATIONS,
            route_points=ROUTE_POINTS,
            claimable=claimable_routes(state, viewer_id) if not state["game_over"] else [],
            longest_path={pid: longest_path(state, pid) for pid in state["seat_order"]},
            legal_actions=TicketToRideGame.get_legal_actions(state, viewer_id),
        )
        own = state["players"].get(viewer_id)
        if own:
            view["ticket_status"] = {t: ticket_completed(state, viewer_id, t) for t in own["tickets"]}
        else:
            view["ticket_status"] = {}
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.ticket_to_ride_ai import choose_bot_action
        view = TicketToRideGame.get_public_view(state, bot_id)
        action = choose_bot_action(view)
        if action is None:
            return None
        action["revision"] = view["revision"]
        return action

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


# ------------------------------------------------------------------ validation

def _check_action(state: Dict, pid: str, action: Dict) -> str:
    if not isinstance(action, dict) or not isinstance(action.get("type"), str):
        raise ValueError("invalid action")
    kind = action["type"]
    if kind not in ACTION_FIELDS:
        raise ValueError("unknown action")
    expected = {"type"} | ACTION_FIELDS[kind]
    if kind == "draw_card":
        if action.get("source") not in ("deck", "face_up"):
            raise ValueError("draw from the deck or the face-up display")
        if action["source"] != "face_up":
            expected.discard("index")
    if set(action) - expected - {"revision"}:
        raise ValueError("missing or unexpected action fields")
    if set(expected) - set(action):
        raise ValueError("missing or unexpected action fields")
    if "revision" in action:
        if type(action["revision"]) is not int or action["revision"] != state["revision"]:
            # Simultaneous setup keeps every seat on the same view; other phases
            # must not act on a stale snapshot.
            if state["phase"] != "setup":
                raise ValueError("stale action; use the latest game state")
    if kind not in TicketToRideGame.get_legal_actions(state, pid):
        raise ValueError("action is not available for this player")
    return kind


def _apply(state: Dict, pid: str, action: Dict, kind: str) -> None:
    player = state["players"][pid]
    if kind == "keep_tickets":
        _apply_keep_tickets(state, pid, action["tickets"])
    elif kind == "draw_card":
        _apply_draw_card(state, pid, action)
    elif kind == "claim_route":
        _apply_claim_route(state, pid, action)
    elif kind == "draw_tickets":
        drawn = _draw_ticket_cards(state, DRAW_TICKETS)
        if not drawn:
            raise ValueError("no destination tickets left")
        player["pending_tickets"] = drawn
        state["stage"] = "choosing_tickets"
        _log(state, f'{_name(state, pid)} drew {len(drawn)} 🎫 destination tickets.')
    elif kind == "pass":
        _log(state, f'{_name(state, pid)} had nothing left to do and passed.')
        _end_turn(state)


def _apply_keep_tickets(state: Dict, pid: str, tickets: List[str]) -> None:
    player = state["players"][pid]
    offered = list(player["pending_tickets"])
    if not isinstance(tickets, list) or any(t not in offered for t in tickets):
        raise ValueError("choose from the tickets you were offered")
    if len(set(tickets)) != len(tickets):
        raise ValueError("duplicate tickets")
    setup = state["phase"] == "setup"
    minimum = STARTING_TICKETS_MIN_KEEP if setup else DRAW_TICKETS_MIN_KEEP
    if len(tickets) < minimum:
        raise ValueError(f"keep at least {minimum} destination ticket(s)")
    player["tickets"].extend(tickets)
    # Unkept tickets go back to the bottom of the deck.
    for ticket in offered:
        if ticket not in tickets:
            state["ticket_deck"].append(ticket)
    player["pending_tickets"] = []
    if setup:
        player["ready"] = True
        _log(state, f'{_name(state, pid)} kept {len(tickets)} 🎫 destination tickets.')
        _maybe_start_play(state)
    else:
        _log(state, f'{_name(state, pid)} kept {len(tickets)} of {len(offered)} 🎫.')
        _end_turn(state)


def _apply_draw_card(state: Dict, pid: str, action: Dict) -> None:
    player = state["players"][pid]
    if state["stage"] != "drawing":
        state["stage"] = "drawing"
        state["draws_left"] = 2
        state["drew_face_up_locomotive"] = False
    source = action["source"]
    if source == "face_up":
        index = action["index"]
        if type(index) is not int or not 0 <= index < len(state["face_up"]):
            raise ValueError("choose one of the face-up cards")
        card = state["face_up"][index]
        if card == LOCOMOTIVE and state["draws_left"] == 1:
            raise ValueError("a face-up 🚂 Locomotive cannot be your second card")
        card = _take_face_up(state, index)
        player["hand"][card] += 1
        if card == LOCOMOTIVE:
            state["draws_left"] = 0
            state["drew_face_up_locomotive"] = True
        else:
            state["draws_left"] -= 1
    else:
        card = _draw_train_card(state)
        if card is None:
            raise ValueError("the draw pile is empty")
        player["hand"][card] += 1
        state["draws_left"] -= 1
    if state["draws_left"] <= 0:
        _end_turn(state)


def _apply_claim_route(state: Dict, pid: str, action: Dict) -> None:
    player = state["players"][pid]
    route_id = action["route"]
    if not isinstance(route_id, str):
        raise ValueError("invalid route")
    reason = route_blocked_reason(state, pid, route_id)
    if reason is not None:
        raise ValueError(reason)
    route = ROUTES[route_id]
    option = _payment_from_cards(route, action["cards"])
    if option is None:
        raise ValueError("those cards do not pay for this route")
    cards = action["cards"]
    for color, count in cards.items():
        if count > player["hand"].get(color, 0):
            raise ValueError("you do not hold those cards")
    for color, count in cards.items():
        if count:
            player["hand"][color] -= count
            state["discard"].extend([color] * count)
    player["routes"].append(route_id)
    player["trains"] -= int(route["length"])
    points = ROUTE_POINTS[int(route["length"])]
    player["route_points"] += points
    state["claimed"][route_id] = pid
    _log(state, f'{_name(state, pid)} claimed {route["a"]} → {route["b"]} for {points} points.')
    _end_turn(state)
