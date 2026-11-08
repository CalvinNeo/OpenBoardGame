"""Server-authoritative 12 Rivers (Good Games Publishing, 2025).

Rules source and the reconstructed board topology are documented in
designs/task187.md.
"""

import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple

from game.twelve_rivers_data import (
    ALPACA_CARDS,
    ALPACA_CARD_IDS,
    ALPACA_SLOTS,
    BANNER,
    CARD_EACH,
    CARD_MOST,
    COLOR_EACH,
    COLOR_MOST,
    DOWNSTREAM,
    EARTH,
    FAIRY_EACH,
    FAIRY_KINDS,
    FAIRY_META,
    FAIRY_MOST,
    FAIRY_PER_KIND,
    FAIRY_PER_PLAYER,
    FAIRY_SPOTS,
    FAIRY_SPOTS_FOR_STRETCH,
    FIRE,
    FULL_EACH,
    INSTRUMENT,
    INTROVERTED_OBJECTIVES,
    LANTERN,
    LIGHT,
    MARKAYA_BY_ID,
    MARKAYA_DISPLAY_SIZE,
    MARKAYA_IDS,
    MARKAYA_TILES,
    MARKERS_PER_PLAYER,
    NET,
    OBJECTIVE_META,
    PEARL_COLORS,
    PEARL_COUNTS,
    PEARL_META,
    PEARL_POINTS,
    RAINBOW,
    SEA_COST,
    SEA_ID,
    SELF_FIVE_DIFF,
    SELF_FOUR_SAME,
    SELF_FULL,
    STARTING_HAND,
    STARTING_MARKAYA,
    STARTING_MARKAYA_IDS,
    STATUE,
    STRETCH_BY_ID,
    STRETCH_ORDER,
    STRETCHES,
    STUMP,
    SUPPLIES,
    SUPPLY_DISPLAY_SIZE,
    SUPPLY_KINDS,
    SUPPLY_META,
    SUPPLY_PER_KIND,
    TOTAL_ROUNDS,
    TRACK_SPACES,
    VILLAGE_COSTS,
    VILLAGE_IDS,
    WATER,
    WIND,
    active_river_count,
    fairy_spot_order,
    is_stretch_active,
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
        "type": {"enum": [
            "place_marker", "use_fairy", "take_pearl", "take_sea_pearls",
            "befriend", "deliver", "next_round",
        ]},
        "revision": {"type": "integer", "minimum": 0},
        "kind": {"enum": ["earth"]},
        "space": {"type": "string", "maxLength": 24},
        "from": {"type": "string", "maxLength": 24},
        "to": {"type": "string", "maxLength": 24},
        "spot": {"type": "string", "maxLength": 24},
        "fire": {"type": "integer", "minimum": 0, "maximum": 2},
        "wind": {"type": "boolean"},
        "net": {"type": "boolean"},
        "water": {"type": "boolean"},
        "instrument": {"type": "boolean"},
        "pay": {"type": "object", "properties": {
            kind: {"type": "integer", "minimum": 0, "maximum": 12} for kind in SUPPLY_KINDS
        }, "additionalProperties": False},
        "pairs": {"type": "array", "maxItems": 6, "items": {
            "type": "object",
            "properties": {
                "kind": {"enum": list(SUPPLY_KINDS)},
                "fire": {"type": "integer", "minimum": 0, "maximum": 2},
                "spot": {"type": "string", "maxLength": 24},
                "from": {"type": "string", "maxLength": 24},
                "to": {"type": "string", "maxLength": 24},
            },
            "required": ["kind"],
            "additionalProperties": False,
        }},
        "take": {"type": "array", "maxItems": 12, "items": {"enum": list(PEARL_COLORS)}},
        "swap_out": {"type": "array", "maxItems": 12, "items": {"enum": list(PEARL_COLORS)}},
        "index": {"type": "integer", "minimum": 0, "maximum": MARKAYA_DISPLAY_SIZE - 1},
        "moves": {"type": "array", "maxItems": 12, "items": {"type": "object"}},
    },
    "required": ["type"],
    "additionalProperties": False,
}

ACTION_REQUIRED = {
    "place_marker": {"space"},
    "use_fairy": {"kind", "moves"},
    "take_pearl": set(),
    "take_sea_pearls": set(),
    "befriend": {"index"},
    "deliver": {"moves"},
    "next_round": set(),
}
ACTION_OPTIONAL = {
    "place_marker": {"pay", "fire", "wind", "pairs"},
    "use_fairy": set(),
    "take_pearl": {"take", "swap_out", "net", "water"},
    "take_sea_pearls": {"take", "swap_out"},
    "befriend": {"instrument"},
    "deliver": set(),
    "next_round": set(),
}
ACTION_FIELDS = {kind: required | optional for kind, (required, optional) in
                 ((k, (ACTION_REQUIRED[k], ACTION_OPTIONAL[k])) for k in ACTION_REQUIRED)}

EXPLORATION_PAIRS = (BANNER, LANTERN, SUPPLIES)
COLLECTION_PAIRS = (NET, INSTRUMENT)


# ------------------------------------------------------------------- logging
def _log(state: Dict, text: str) -> None:
    state["log"].append({"round": state["round"], "text": text})
    state["log"] = state["log"][-150:]


def _name(state: Dict, pid: str) -> str:
    return state["player_meta"][pid].get("name", pid)


# -------------------------------------------------------------- space helpers
def _parse_space(space_id: str) -> Tuple[str, Optional[str], int]:
    """Return (area, stretch_id, slot) for a board space id."""
    if space_id == SEA_ID:
        return "sea", None, 1
    if space_id in VILLAGE_IDS:
        return "village", None, VILLAGE_IDS.index(space_id) + 1
    if "#" in space_id:
        stretch_id, _, slot = space_id.partition("#")
        if stretch_id in STRETCH_BY_ID and slot.isdigit():
            index = int(slot)
            if 1 <= index <= STRETCH_BY_ID[stretch_id]["slots"]:
                return "river", stretch_id, index
    return "", None, 0


def space_cost(space_id: str) -> int:
    """Cards to discard (positive) or gain (negative) for a board space."""
    area, stretch_id, slot = _parse_space(space_id)
    if area == "river":
        return STRETCH_BY_ID[stretch_id]["cost"]
    if area == "sea":
        return SEA_COST
    if area == "village":
        return VILLAGE_COSTS[slot - 1]
    raise ValueError("unknown board space")


def board_spaces(player_count: int) -> List[str]:
    """Every placeable space, in board reading order."""
    spaces: List[str] = []
    for stretch_id in STRETCH_ORDER:
        if not is_stretch_active(stretch_id, player_count):
            continue
        for slot in range(1, STRETCH_BY_ID[stretch_id]["slots"] + 1):
            spaces.append(f"{stretch_id}#{slot}")
    spaces.append(SEA_ID)
    spaces.extend(VILLAGE_IDS)
    return spaces


def _occupied(state: Dict, space_id: str) -> bool:
    return space_id in state["placements"]


# ---------------------------------------------------------------- deck helpers
def _reshuffle_supply(state: Dict) -> None:
    rng = random.Random(f'{state["seed"]}:supply:{state["revision"]}:{len(state["supply_discard"])}')
    pile = state["supply_discard"]
    rng.shuffle(pile)
    state["supply_deck"] = pile + state["supply_deck"]
    state["supply_discard"] = []


def _draw_supply(state: Dict) -> Optional[str]:
    if not state["supply_deck"]:
        if not state["supply_discard"]:
            return None
        _reshuffle_supply(state)
    if not state["supply_deck"]:
        return None
    return state["supply_deck"].pop()


def _refill_display(state: Dict) -> None:
    for _ in range(8):
        while len(state["supply_display"]) < SUPPLY_DISPLAY_SIZE:
            card = _draw_supply(state)
            if card is None:
                return
            state["supply_display"].append(card)
        if len(set(state["supply_display"])) > 1:
            return
        # All three face-up cards match: reshuffle them with the discards.
        state["supply_discard"].extend(state["supply_display"])
        state["supply_display"] = []


def _take_supply_card(state: Dict, pid: str, source: Optional[str] = None) -> Optional[str]:
    """Take one card from the display or the deck, refilling the display."""
    player = state["players"][pid]
    card = None
    if source and source.startswith("display:"):
        index = int(source.split(":", 1)[1])
        if 0 <= index < len(state["supply_display"]):
            card = state["supply_display"].pop(index)
            _refill_display(state)
    if card is None:
        card = _draw_supply(state)
    if card is not None:
        player["hand"][card] += 1
    return card


def _grant_cards(state: Dict, pid: str, count: int, source: Optional[str] = None) -> int:
    taken = 0
    for _ in range(count):
        if _take_supply_card(state, pid, source if taken == 0 else None) is not None:
            taken += 1
        else:
            break
    return taken


def _draw_pearl(state: Dict) -> Optional[str]:
    if not state["bag"]:
        return None
    return state["bag"].pop()


# ----------------------------------------------------------------- alpaca cards
def _claim_alpaca_cards(state: Dict, pid: str) -> List[str]:
    """Claim every open alpaca card the player now satisfies."""
    alpaca = state["players"][pid]["alpaca"]
    counts = {color: alpaca.count(color) for color in PEARL_COLORS}
    claimed = []
    for card in ALPACA_CARDS:
        if state["alpaca_cards"].get(card["id"]) is not None:
            continue
        if counts.get(card["color"], 0) >= card["count"]:
            state["alpaca_cards"][card["id"]] = pid
            state["players"][pid]["alpaca_cards"].append(card["id"])
            claimed.append(card["id"])
            _log(state, f'{_name(state, pid)} completed an alpaca goal and took {card["id"]} (4 points).')
    return claimed


# -------------------------------------------------------------------- markaya
def _new_markaya(tile_id: str) -> Dict:
    tile = MARKAYA_BY_ID[tile_id]
    return {
        "tile": tile_id,
        "spots": [{"color": color, "pearl": None} for color in tile["spots"]],
    }


def markaya_full(entry: Dict) -> bool:
    return all(spot["pearl"] is not None for spot in entry["spots"])


def markaya_pearls(entry: Dict) -> List[str]:
    return [spot["pearl"] for spot in entry["spots"] if spot["pearl"] is not None]


def _spot_accepts(spot: Dict, color: str) -> bool:
    return spot["pearl"] is None and spot["color"] in (RAINBOW, color)


# ------------------------------------------------------------------ init game
def _player_count(state: Dict) -> int:
    return len(state["seat_order"])


def _prepare_round(state: Dict, first: bool) -> None:
    """Preparation phase: pearls, fairies, Markaya refresh."""
    count = _player_count(state)
    rivers = active_river_count(count)
    if not first:
        for index in range(1, rivers + 1):
            pearl = _draw_pearl(state)
            if pearl is None:
                break
            state["pools"][f"r1s{index}"].append(pearl)
    kind = STUMP if state["round"] % 2 == 1 else STATUE
    order = fairy_spot_order(kind)
    placed = 0
    for spot_id in order[:count]:
        if not state["fairy_supply"]:
            break
        fairy = state["fairy_supply"].pop()
        state["fairy_spots"][spot_id].append(fairy)
        placed += 1
    if not first:
        state["markaya_deck"] = state["markaya_display"] + state["markaya_deck"]
        state["markaya_display"] = []
    while len(state["markaya_display"]) < MARKAYA_DISPLAY_SIZE and state["markaya_deck"]:
        state["markaya_display"].append(state["markaya_deck"].pop(0))
    state["phase"] = "exploration"
    state["stage"] = None
    state["river_index"] = 0
    _log(state, f'Round {state["round"]}: {rivers} rivers refilled, {placed} fairies appeared, '
         f'{len(state["markaya_display"])} Markaya on offer.')


def _init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 2 <= len(players) <= 4:
            raise ValueError("12 Rivers requires 2-4 players")
        cfg = {} if config is None else config
        if not isinstance(cfg, dict) or set(cfg) - {"seed"}:
            raise ValueError("invalid 12 Rivers configuration")
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

        bag = [color for color in PEARL_COLORS for _ in range(PEARL_COUNTS[color])]
        rng.shuffle(bag)
        fairies = [kind for kind in FAIRY_KINDS for _ in range(FAIRY_PER_KIND)]
        rng.shuffle(fairies)
        fairy_supply = fairies[:FAIRY_PER_PLAYER * len(seats)]
        supply_deck = [kind for kind in SUPPLY_KINDS for _ in range(SUPPLY_PER_KIND)]
        rng.shuffle(supply_deck)
        markaya_deck = list(MARKAYA_IDS)
        rng.shuffle(markaya_deck)
        starting = list(STARTING_MARKAYA_IDS[:len(seats)])
        rng.shuffle(starting)

        state = {
            "version": 1,
            "seed": seed,
            "config": {},
            "player_meta": meta,
            "seat_order": seats,
            "order": order,
            "players": {
                pid: {
                    "color": index,
                    "starting_markaya": starting[index],
                    "markaya": [_new_markaya(starting[index])],
                    "alpaca": [],
                    "alpaca_cards": [],
                    "hand": dict.fromkeys(SUPPLY_KINDS, 0),
                    "fairies": dict.fromkeys(FAIRY_KINDS, 0),
                    "deliver_done": False,
                    "ready_next": False,
                }
                for index, pid in enumerate(seats)
            },
            "track": [],
            "placements": {},
            "pools": {stretch_id: [] for stretch_id in STRETCH_ORDER},
            "sea": [],
            "bag": bag,
            "fairy_supply": fairy_supply,
            "fairy_spots": {spot["id"]: [] for spot in FAIRY_SPOTS},
            "markaya_deck": markaya_deck,
            "markaya_display": [],
            "supply_deck": supply_deck,
            "supply_discard": [],
            "supply_display": [],
            "alpaca_cards": {card_id: None for card_id in ALPACA_CARD_IDS},
            "phase": "exploration",
            "stage": None,
            "round": 1,
            "river_index": 0,
            "village_index": 0,
            "revision": 0,
            "log": [],
            "game_over": False,
            "winner_ids": [],
            "final_results": [],
        }
        marker = 0
        for _ in range(MARKERS_PER_PLAYER):
            for pid in order:
                state["track"].append({"pid": pid, "marker": marker})
                marker += 1
        for pid in seats:
            _grant_cards(state, pid, STARTING_HAND)
        _refill_display(state)
        for index in range(1, active_river_count(len(seats)) + 1):
            pearl = _draw_pearl(state)
            if pearl is None:
                break
            state["pools"][f"r1s{index}"].append(pearl)
        _prepare_round(state, first=True)
        _log(state, "Twelve rivers, five rounds. Place your family markers and catch the pearls.")
        return state

# ------------------------------------------------------------- turn machinery
def current_actor(state: Dict) -> Optional[str]:
    """The player who must act right now, if the game waits on a single seat."""
    if state["game_over"]:
        return None
    phase = state["phase"]
    if phase == "exploration":
        return state["track"][0]["pid"] if state["track"] else None
    if phase == "collection":
        stage = state["stage"]
        if stage == "river":
            space = _current_river_space(state)
            if space is None:
                return None
            return state["placements"][space]["pid"]
        if stage == "sea":
            if _occupied(state, SEA_ID):
                return state["placements"][SEA_ID]["pid"]
            return None
        if stage == "village":
            for village_id in VILLAGE_IDS:
                if _occupied(state, village_id):
                    return state["placements"][village_id]["pid"]
            return None
        return None
    return None


def _current_river_space(state: Dict) -> Optional[str]:
    """Lowest occupied slot of the stretch the river cursor currently sits on."""
    index = state["river_index"]
    if index >= len(STRETCH_ORDER):
        return None
    stretch_id = STRETCH_ORDER[index]
    stretch = STRETCH_BY_ID[stretch_id]
    for slot in range(1, stretch["slots"] + 1):
        space = f"{stretch_id}#{slot}"
        if _occupied(state, space):
            return space
    return None


def _return_marker(state: Dict, space_id: str) -> None:
    """Take a marker off the board and put it on the rearmost track space."""
    placement = state["placements"].pop(space_id)
    state["track"].append({"pid": placement["pid"], "marker": placement["marker"]})


def _cascade_river(state: Dict) -> None:
    """Push pearls one stretch further whenever the current one is marker-free."""
    while state["river_index"] < len(STRETCH_ORDER):
        if _current_river_space(state) is not None:
            return
        stretch_id = STRETCH_ORDER[state["river_index"]]
        pearls = state["pools"][stretch_id]
        state["pools"][stretch_id] = []
        target = DOWNSTREAM[stretch_id]
        if target == SEA_ID:
            state["sea"].extend(pearls)
        else:
            state["pools"][target].extend(pearls)
        state["river_index"] += 1


def _begin_collection(state: Dict) -> None:
    state["phase"] = "collection"
    state["stage"] = "river"
    state["river_index"] = 0
    state["village_index"] = 0
    _log(state, "The dam is pulled: pearls roll down the twelve rivers.")
    _cascade_river(state)
    _maybe_advance_stage(state)


def _maybe_advance_stage(state: Dict) -> None:
    """Skip through stages that nobody has to act in."""
    while state["phase"] == "collection":
        stage = state["stage"]
        if stage == "river":
            _cascade_river(state)
            if _current_river_space(state) is not None:
                return
            state["stage"] = "sea"
            continue
        if stage == "sea":
            if _occupied(state, SEA_ID):
                return
            state["stage"] = "village"
            continue
        if stage == "village":
            if any(_occupied(state, vid) for vid in VILLAGE_IDS):
                return
            state["stage"] = "deliver"
            for pid in state["seat_order"]:
                state["players"][pid]["deliver_done"] = False
            continue
        return


def _begin_round_end(state: Dict) -> None:
    state["phase"] = "round_end"
    state["stage"] = None
    for pid in state["seat_order"]:
        state["players"][pid]["ready_next"] = False
    _log(state, f'Round {state["round"]} is scored. Review the table, then continue.')


def _start_next_round(state: Dict) -> None:
    if state["round"] >= TOTAL_ROUNDS:
        _finish_game(state)
        return
    state["round"] += 1
    _prepare_round(state, first=False)


def _finish_game(state: Dict) -> None:
    state["phase"] = "game_over"
    state["stage"] = None
    state["game_over"] = True
    results = score_game(state)
    state["final_results"] = results
    best = max((row["total"] for row in results), default=0)
    state["winner_ids"] = [row["player_id"] for row in results if row["total"] == best]
    names = ", ".join(_name(state, pid) for pid in state["winner_ids"])
    _log(state, f"Game over. {names} win with {best} reputation.")


# ------------------------------------------------------------- action helpers
def _check_action(state: Dict, pid: str, action: Dict) -> str:
    if not isinstance(action, dict) or not isinstance(action.get("type"), str):
        raise ValueError("invalid action")
    kind = action["type"]
    if kind not in ACTION_REQUIRED:
        raise ValueError("unknown action")
    allowed = {"type", "revision"} | ACTION_REQUIRED[kind] | ACTION_OPTIONAL[kind]
    if set(action) - allowed:
        raise ValueError("unexpected action fields")
    if ACTION_REQUIRED[kind] - set(action):
        raise ValueError("missing action fields")
    if "revision" in action:
        if type(action["revision"]) is not int or action["revision"] != state["revision"]:
            if state["phase"] != "collection" or state["stage"] != "deliver":
                raise ValueError("stale action; use the latest game state")
    if kind not in TwelveRiversGame.get_legal_actions(state, pid):
        raise ValueError("action is not available for this player")
    return kind


def _hand_total(player: Dict) -> int:
    return sum(player["hand"].values())


def _take_fairies_at(state: Dict, pid: str, stretch_id: str) -> List[str]:
    """Collect every fairy sitting on the bank left of this stretch."""
    taken: List[str] = []
    for spot_id in FAIRY_SPOTS_FOR_STRETCH.get(stretch_id, []):
        stack = state["fairy_spots"][spot_id]
        while stack:
            fairy = stack.pop()
            state["players"][pid]["fairies"][fairy] += 1
            taken.append(fairy)
    return taken


def _free_alpaca(player: Dict) -> int:
    return ALPACA_SLOTS - len(player["alpaca"])


def _apply_pearl_gain(state: Dict, pid: str, take: List[str], swap_out: List[str]) -> None:
    player = state["players"][pid]
    for color in swap_out:
        player["alpaca"].remove(color)
    player["alpaca"].extend(take)
    _claim_alpaca_cards(state, pid)


def _validate_take(state: Dict, pid: str, pool: List[str], take: List[str],
                   swap_out: List[str], limit: int) -> None:
    player = state["players"][pid]
    if not isinstance(take, list) or not isinstance(swap_out, list):
        raise ValueError("invalid pearl selection")
    if len(take) > limit:
        raise ValueError(f"you may take at most {limit} pearl(s) here")
    remaining = list(pool)
    for color in take:
        if color not in remaining:
            raise ValueError("that pearl is not available here")
        remaining.remove(color)
    if len(set(swap_out)) != len(swap_out):
        pass
    free = _free_alpaca(player)
    needed = max(0, len(take) - free)
    if len(swap_out) != needed:
        raise ValueError(f"swap out exactly {needed} pearl(s) from your alpaca")
    alpaca = list(player["alpaca"])
    for color in swap_out:
        if color not in alpaca:
            raise ValueError("that pearl is not on your alpaca")
        alpaca.remove(color)


def _apply_place_marker(state: Dict, pid: str, action: Dict) -> None:
    player = state["players"][pid]
    space = action.get("space")
    if not isinstance(space, str):
        raise ValueError("choose a board space")
    area, stretch_id, slot = _parse_space(space)
    if not area:
        raise ValueError("choose a board space")
    if area == "river" and not is_stretch_active(stretch_id, _player_count(state)):
        raise ValueError("that river is not in play this game")
    if _occupied(state, space):
        raise ValueError("that space is already taken")

    wind = bool(action.get("wind"))
    fire = action.get("fire", 0)
    if type(fire) is not int or fire < 0:
        raise ValueError("invalid fire fairy count")
    if wind and player["fairies"][WIND] < 1:
        raise ValueError("you have no wind fairy")
    if fire > player["fairies"][FIRE]:
        raise ValueError("you do not have that many fire fairies")

    cost = space_cost(space)
    pay = action.get("pay") or {}
    if not isinstance(pay, dict) or set(pay) - set(SUPPLY_KINDS):
        raise ValueError("invalid payment")
    paid = 0
    for kind, count in pay.items():
        if type(count) is not int or count < 0:
            raise ValueError("invalid payment")
        if count > player["hand"][kind]:
            raise ValueError("you do not have those cards")
        paid += count

    gained = 0
    if wind:
        if paid:
            raise ValueError("a wind fairy means you pay nothing")
    elif cost > 0:
        if paid + fire != cost:
            raise ValueError(f"this space costs {cost} supply card(s)")
    elif cost < 0:
        if paid or fire:
            raise ValueError("this space gives you a card instead of costing one")
        gained = -cost
    elif paid or fire:
        raise ValueError("this space is free")

    for kind, count in pay.items():
        player["hand"][kind] -= count
        state["supply_discard"].extend([kind] * count)
    player["fairies"][FIRE] -= fire
    if wind:
        player["fairies"][WIND] -= 1

    marker = state["track"].pop(0)
    state["placements"][space] = {"pid": pid, "marker": marker["marker"]}

    fairies: List[str] = []
    if area == "river":
        fairies = _take_fairies_at(state, pid, stretch_id)
    if gained:
        _grant_cards(state, pid, gained)

    label = _space_label(space)
    extra = ""
    if fairies:
        extra = " and picked up " + ", ".join(FAIRY_META[f]["emoji"] for f in fairies)
    _log(state, f"{_name(state, pid)} camped at {label}{extra}.")

    _apply_pairs(state, pid, action.get("pairs") or [])
    if not state["track"]:
        _begin_collection(state)


def _space_label(space_id: str) -> str:
    area, stretch_id, slot = _parse_space(space_id)
    if area == "sea":
        return "the sea"
    if area == "village":
        return f"village space {slot}"
    stretch = STRETCH_BY_ID[stretch_id]
    return f"river row {stretch['row']} stretch {stretch['index']} slot {slot}"


def _apply_pairs(state: Dict, pid: str, pairs: List[Dict]) -> None:
    if not isinstance(pairs, list):
        raise ValueError("invalid card pairs")
    player = state["players"][pid]
    spent = {kind: 0 for kind in SUPPLY_KINDS}
    fire_used = 0
    for pair in pairs:
        if not isinstance(pair, dict):
            raise ValueError("invalid card pair")
        kind = pair.get("kind")
        if kind not in EXPLORATION_PAIRS:
            raise ValueError("that card has no exploration effect")
        fire = pair.get("fire", 0)
        if type(fire) is not int or not 0 <= fire <= 2:
            raise ValueError("invalid fire fairy count")
        needed = 2 - fire
        if spent[kind] + needed > player["hand"][kind]:
            raise ValueError("you do not have that pair")
        spent[kind] += needed
        fire_used += fire
    if fire_used > player["fairies"][FIRE]:
        raise ValueError("you do not have that many fire fairies")
    for kind, count in spent.items():
        player["hand"][kind] -= count
        state["supply_discard"].extend([kind] * count)
    player["fairies"][FIRE] -= fire_used
    for pair in pairs:
        kind = pair["kind"]
        if kind == BANNER:
            _effect_banner(state, pid)
        elif kind == LANTERN:
            _effect_lantern(state, pid, pair.get("spot"))
        elif kind == SUPPLIES:
            _effect_supplies(state, pid, pair.get("from"), pair.get("to"))


def _effect_banner(state: Dict, pid: str) -> None:
    for index, entry in enumerate(state["track"]):
        if entry["pid"] == pid:
            marker = state["track"].pop(index)
            state["track"].insert(0, marker)
            _log(state, f"{_name(state, pid)} played a banner pair and moved a marker to the front.")
            return
    raise ValueError("you have no unplaced marker to move")


def _effect_lantern(state: Dict, pid: str, spot_id: Optional[str]) -> None:
    if not isinstance(spot_id, str) or spot_id not in state["fairy_spots"]:
        raise ValueError("choose a fairy on the board")
    stack = state["fairy_spots"][spot_id]
    if not stack:
        raise ValueError("there is no fairy there")
    fairy = stack.pop()
    state["players"][pid]["fairies"][fairy] += 1
    _log(state, f"{_name(state, pid)} played a lantern pair and took a {FAIRY_META[fairy]['emoji']} fairy.")


def _effect_supplies(state: Dict, pid: str, source: Optional[str], target: Optional[str]) -> None:
    if not isinstance(source, str) or source not in state["placements"]:
        raise ValueError("choose one of your placed markers")
    if state["placements"][source]["pid"] != pid:
        raise ValueError("that marker is not yours")
    if not isinstance(target, str):
        raise ValueError("choose a destination")
    area, stretch_id, slot = _parse_space(target)
    if not area:
        raise ValueError("choose a destination")
    if area == "river" and not is_stretch_active(stretch_id, _player_count(state)):
        raise ValueError("that river is not in play this game")
    if _occupied(state, target):
        raise ValueError("that space is already taken")
    placement = state["placements"].pop(source)
    state["placements"][target] = placement
    fairies: List[str] = []
    if area == "river":
        fairies = _take_fairies_at(state, pid, stretch_id)
    extra = ""
    if fairies:
        extra = " and picked up " + ", ".join(FAIRY_META[f]["emoji"] for f in fairies)
    _log(state, f"{_name(state, pid)} played a supplies pair and moved a marker to {_space_label(target)}{extra}.")

# --------------------------------------------------------- collection actions
def _apply_take_pearl(state: Dict, pid: str, action: Dict) -> None:
    space = _current_river_space(state)
    if space is None or state["placements"].get(space, {}).get("pid") != pid:
        raise ValueError("it is not your turn to collect")
    player = state["players"][pid]
    stretch_id = space.split("#", 1)[0]
    pool = state["pools"][stretch_id]

    net = bool(action.get("net"))
    water = bool(action.get("water"))
    limit = 1
    cards_needed = 0
    if net:
        limit += 1
        cards_needed = 2
        if player["hand"][NET] < cards_needed:
            raise ValueError("you need a pair of fishing nets")
    if water:
        limit += 1
        if player["fairies"][WATER] < 1:
            raise ValueError("you have no water fairy")

    take = action.get("take") or []
    swap_out = action.get("swap_out") or []
    _validate_take(state, pid, pool, take, swap_out, limit)

    if net:
        player["hand"][NET] -= cards_needed
        state["supply_discard"].extend([NET] * cards_needed)
    if water:
        player["fairies"][WATER] -= 1

    for color in take:
        pool.remove(color)
    _apply_pearl_gain(state, pid, take, swap_out)

    if take:
        pretty = ", ".join(PEARL_META[c]["emoji"] for c in take)
        _log(state, f"{_name(state, pid)} caught {pretty} at {_space_label(space)}.")
    else:
        _log(state, f"{_name(state, pid)} let the pearls roll on at {_space_label(space)}.")

    _return_marker(state, space)
    _cascade_river(state)
    _maybe_advance_stage(state)


def _apply_take_sea(state: Dict, pid: str, action: Dict) -> None:
    if not _occupied(state, SEA_ID) or state["placements"][SEA_ID]["pid"] != pid:
        raise ValueError("it is not your turn to collect")
    take = action.get("take") or []
    swap_out = action.get("swap_out") or []
    _validate_take(state, pid, state["sea"], take, swap_out, len(state["sea"]))
    for color in take:
        state["sea"].remove(color)
    _apply_pearl_gain(state, pid, take, swap_out)
    pretty = ", ".join(PEARL_META[c]["emoji"] for c in take) if take else "nothing"
    _log(state, f"{_name(state, pid)} scooped {pretty} from the sea.")
    _return_marker(state, SEA_ID)
    _maybe_advance_stage(state)


def _apply_befriend(state: Dict, pid: str, action: Dict) -> None:
    village_id = next((vid for vid in VILLAGE_IDS if _occupied(state, vid)), None)
    if village_id is None or state["placements"][village_id]["pid"] != pid:
        raise ValueError("it is not your turn to befriend")
    player = state["players"][pid]
    index = action.get("index")
    display = state["markaya_display"]
    if type(index) is not int or not 0 <= index < len(display):
        raise ValueError("choose one of the Markaya on offer")
    tile_id = display.pop(index)
    tile = MARKAYA_BY_ID[tile_id]
    player["markaya"].append(_new_markaya(tile_id))
    if tile["cards"]:
        _grant_cards(state, pid, tile["cards"])
    _log(state, f"{_name(state, pid)} befriended {tile['name_zh']} (+{tile['cards']} camp cards).")

    if action.get("instrument"):
        if player["hand"][INSTRUMENT] < 2:
            raise ValueError("you need a pair of instruments")
        slot = VILLAGE_IDS.index(village_id)
        target = next((vid for vid in VILLAGE_IDS[slot + 1:] if not _occupied(state, vid)), None)
        if target is None:
            raise ValueError("there is no free village space to the right")
        player["hand"][INSTRUMENT] -= 2
        state["supply_discard"].extend([INSTRUMENT] * 2)
        placement = state["placements"].pop(village_id)
        state["placements"][target] = placement
        _log(state, f"{_name(state, pid)} played an instrument pair and moved along the village.")
        return

    _return_marker(state, village_id)
    _maybe_advance_stage(state)


def _apply_deliver(state: Dict, pid: str, action: Dict) -> None:
    player = state["players"][pid]
    moves = action.get("moves") or []
    if not isinstance(moves, list):
        raise ValueError("invalid delivery")
    lights = 0
    for move in moves:
        if not isinstance(move, dict):
            raise ValueError("invalid delivery")
        tile_index = move.get("tile")
        spot_index = move.get("spot")
        pearl_index = move.get("pearl")
        use_light = bool(move.get("light"))
        if type(tile_index) is not int or not 0 <= tile_index < len(player["markaya"]):
            raise ValueError("choose one of your Markaya")
        entry = player["markaya"][tile_index]
        if type(spot_index) is not int or not 0 <= spot_index < len(entry["spots"]):
            raise ValueError("choose a storage spot")
        spot = entry["spots"][spot_index]
        if spot["pearl"] is not None:
            raise ValueError("that storage spot is already filled")
        if type(pearl_index) is not int or not 0 <= pearl_index < len(player["alpaca"]):
            raise ValueError("choose a pearl on your alpaca")
        color = player["alpaca"][pearl_index]
        if use_light:
            if player["fairies"][LIGHT] - lights < 1:
                raise ValueError("you have no light fairy")
            lights += 1
        elif not _spot_accepts(spot, color):
            raise ValueError("that pearl does not match the storage spot")
        spot["pearl"] = color
        if use_light:
            spot["color"] = RAINBOW
        player["alpaca"].pop(pearl_index)
    player["fairies"][LIGHT] -= lights
    player["deliver_done"] = True
    if moves:
        _log(state, f"{_name(state, pid)} delivered {len(moves)} pearl(s) to their Markaya.")
    if all(state["players"][p]["deliver_done"] for p in state["seat_order"]):
        _begin_round_end(state)


def _apply_use_fairy(state: Dict, pid: str, action: Dict) -> None:
    kind = action.get("kind")
    if kind != EARTH:
        raise ValueError("that fairy cannot be used right now")
    player = state["players"][pid]
    if player["fairies"][EARTH] < 1:
        raise ValueError("you have no earth fairy")
    moves = action.get("moves") or []
    if not isinstance(moves, list) or not moves or len(moves) > 3:
        raise ValueError("move between 1 and 3 pearls")
    for move in moves:
        if not isinstance(move, dict):
            raise ValueError("invalid earth fairy move")
        target_tile = move.get("tile")
        target_spot = move.get("spot")
        if type(target_tile) is not int or not 0 <= target_tile < len(player["markaya"]):
            raise ValueError("choose one of your Markaya")
        entry = player["markaya"][target_tile]
        if type(target_spot) is not int or not 0 <= target_spot < len(entry["spots"]):
            raise ValueError("choose a storage spot")
        spot = entry["spots"][target_spot]
        if spot["pearl"] is not None:
            raise ValueError("that storage spot is already filled")
        source_tile = move.get("from_tile")
        if source_tile is None:
            pearl_index = move.get("pearl")
            if type(pearl_index) is not int or not 0 <= pearl_index < len(player["alpaca"]):
                raise ValueError("choose a pearl on your alpaca")
            color = player["alpaca"][pearl_index]
            if not _spot_accepts(spot, color):
                raise ValueError("that pearl does not match the storage spot")
            spot["pearl"] = color
            player["alpaca"].pop(pearl_index)
        else:
            if type(source_tile) is not int or not 0 <= source_tile < len(player["markaya"]):
                raise ValueError("choose a source Markaya")
            source = player["markaya"][source_tile]
            source_spot = move.get("from_spot")
            if type(source_spot) is not int or not 0 <= source_spot < len(source["spots"]):
                raise ValueError("choose a source storage spot")
            origin = source["spots"][source_spot]
            if origin["pearl"] is None:
                raise ValueError("that storage spot is empty")
            color = origin["pearl"]
            if not _spot_accepts(spot, color):
                raise ValueError("that pearl does not match the storage spot")
            origin["pearl"] = None
            spot["pearl"] = color
    player["fairies"][EARTH] -= 1
    _log(state, f"{_name(state, pid)} used an earth fairy to move {len(moves)} pearl(s).")


def _apply_next_round(state: Dict, pid: str) -> None:
    state["players"][pid]["ready_next"] = True
    if all(state["players"][p]["ready_next"] for p in state["seat_order"]):
        _start_next_round(state)


# ------------------------------------------------------------------- scoring
def _delivered_counts(player: Dict) -> Dict[str, int]:
    counts = {color: 0 for color in PEARL_COLORS}
    for entry in player["markaya"]:
        for color in markaya_pearls(entry):
            counts[color] += 1
    return counts


def _strictly_most(values: Dict[str, int], pid: str) -> bool:
    mine = values.get(pid, 0)
    if mine <= 0:
        return False
    return all(other == pid or value < mine for other, value in values.items())


def score_game(state: Dict) -> List[Dict]:
    seats = state["seat_order"]
    players = state["players"]
    delivered = {pid: _delivered_counts(players[pid]) for pid in seats}
    fairies = {pid: sum(players[pid]["fairies"].values()) for pid in seats}
    hands = {pid: _hand_total(players[pid]) for pid in seats}
    full_counts = {pid: sum(1 for entry in players[pid]["markaya"] if markaya_full(entry))
                   for pid in seats}

    results = []
    for pid in seats:
        player = players[pid]
        pearl_points = sum(PEARL_POINTS[color] * count for color, count in delivered[pid].items())
        bonus_total = 0
        bonuses = []
        ordered = list(player["markaya"])
        for entry in ordered:
            tile = MARKAYA_BY_ID[entry["tile"]]
            objective = tile["objective"]
            color = tile["color"]
            pearls = markaya_pearls(entry)
            points = 0
            if objective == FULL_EACH:
                points = 3 * full_counts[pid]
            elif objective == COLOR_EACH:
                points = 2 * delivered[pid][color]
            elif objective == FAIRY_EACH:
                points = 2 * fairies[pid]
            elif objective == COLOR_MOST:
                totals = {other: delivered[other][color] for other in seats}
                points = tile["points"] if _strictly_most(totals, pid) else 0
            elif objective == FAIRY_MOST:
                points = 6 if _strictly_most(fairies, pid) else 0
            elif objective == CARD_EACH:
                points = hands[pid]
            elif objective == CARD_MOST:
                points = 5 if _strictly_most(hands, pid) else 0
            elif objective == SELF_FULL:
                points = 8 if markaya_full(entry) else 0
            elif objective == SELF_FOUR_SAME:
                if pearls and max(pearls.count(c) for c in set(pearls)) >= 4:
                    points = 6
            elif objective == SELF_FIVE_DIFF:
                if len(set(pearls)) >= 5:
                    points = 5
            if points:
                bonus_total += points
                bonuses.append({"tile": entry["tile"], "objective": objective, "points": points})
        alpaca_points = 4 * len(player["alpaca_cards"])
        results.append({
            "player_id": pid,
            "name": state["player_meta"][pid].get("name", pid),
            "pearls": pearl_points,
            "bonuses": bonus_total,
            "bonus_detail": bonuses,
            "alpaca": alpaca_points,
            "alpaca_cards": list(player["alpaca_cards"]),
            "total": pearl_points + bonus_total + alpaca_points,
        })
    results.sort(key=lambda row: (-row["total"], row["player_id"]))
    return results

# -------------------------------------------------------------- game interface
def _apply(state: Dict, pid: str, action: Dict, kind: str) -> None:
    if kind == "place_marker":
        _apply_place_marker(state, pid, action)
    elif kind == "take_pearl":
        _apply_take_pearl(state, pid, action)
    elif kind == "take_sea_pearls":
        _apply_take_sea(state, pid, action)
    elif kind == "befriend":
        _apply_befriend(state, pid, action)
    elif kind == "deliver":
        _apply_deliver(state, pid, action)
    elif kind == "use_fairy":
        _apply_use_fairy(state, pid, action)
    elif kind == "next_round":
        _apply_next_round(state, pid)


class TwelveRiversGame:
    game_id = "twelve_rivers"
    min_players = 2
    max_players = 4
    supported_player_counts = (2, 3, 4)

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        return _init_game(config, players)

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        player = state["players"][player_id]
        phase = state["phase"]
        if phase == "exploration":
            if current_actor(state) != player_id:
                return []
            actions = ["place_marker"]
            if player["fairies"][EARTH] > 0:
                actions.append("use_fairy")
            return actions
        if phase == "collection":
            stage = state["stage"]
            if stage == "deliver":
                return [] if player["deliver_done"] else ["deliver", "use_fairy"] \
                    if player["fairies"][EARTH] > 0 else ["deliver"]
            if current_actor(state) != player_id:
                return []
            if stage == "river":
                return ["take_pearl"]
            if stage == "sea":
                return ["take_sea_pearls"]
            if stage == "village":
                return ["befriend"]
            return []
        if phase == "round_end":
            return [] if player["ready_next"] else ["next_round"]
        return []

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
        return [{"type": "twelve_rivers:update",
                 "payload": {"phase": state["phase"], "stage": state["stage"],
                             "round": state["round"]}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        count = _player_count(state)
        actor = current_actor(state)
        players = []
        for pid in state["seat_order"]:
            player, meta = state["players"][pid], state["player_meta"][pid]
            mine = pid == viewer_id
            players.append({
                "player_id": pid,
                "name": meta.get("name", pid),
                "seat": meta.get("seat", 0),
                "is_bot": bool(meta.get("is_bot")),
                "color": player["color"],
                "alpaca": list(player["alpaca"]),
                "alpaca_cards": list(player["alpaca_cards"]),
                "markaya": copy.deepcopy(player["markaya"]),
                "fairies": dict(player["fairies"]) if mine or state["game_over"] else None,
                "fairy_count": sum(player["fairies"].values()),
                "hand": dict(player["hand"]) if mine or state["game_over"] else None,
                "hand_count": _hand_total(player),
                "deliver_done": player["deliver_done"],
                "ready_next": player["ready_next"],
                "markers_on_track": sum(1 for entry in state["track"] if entry["pid"] == pid),
                "markers_on_board": sum(1 for spot in state["placements"].values() if spot["pid"] == pid),
            })
        own = state["players"].get(viewer_id)
        view = {
            "game_id": TwelveRiversGame.game_id,
            "you": viewer_id,
            "phase": state["phase"],
            "stage": state["stage"],
            "round": state["round"],
            "total_rounds": TOTAL_ROUNDS,
            "revision": state["revision"],
            "seat_order": list(state["seat_order"]),
            "players": players,
            "current_actor": actor,
            "track": [dict(entry) for entry in state["track"]],
            "placements": {space: dict(spot) for space, spot in state["placements"].items()},
            "pools": {stretch_id: list(pearls) for stretch_id, pearls in state["pools"].items()},
            "sea": list(state["sea"]),
            "bag_count": len(state["bag"]),
            "fairy_spots": {spot_id: list(stack) for spot_id, stack in state["fairy_spots"].items()},
            "fairy_supply_count": len(state["fairy_supply"]),
            "markaya_display": list(state["markaya_display"]),
            "markaya_deck_count": len(state["markaya_deck"]),
            "supply_display": list(state["supply_display"]),
            "supply_deck_count": len(state["supply_deck"]),
            "supply_discard_count": len(state["supply_discard"]),
            "alpaca_cards": dict(state["alpaca_cards"]),
            "active_rivers": active_river_count(count),
            "player_count": count,
            "game_over": state["game_over"],
            "winner_ids": list(state["winner_ids"]),
            "final_results": copy.deepcopy(state["final_results"]),
            "log": list(state["log"]),
            "legal_actions": TwelveRiversGame.get_legal_actions(state, viewer_id),
            "board": {
                "stretches": [
                    {
                        "id": stretch["id"],
                        "row": stretch["row"],
                        "index": stretch["index"],
                        "cost": stretch["cost"],
                        "slots": stretch["slots"],
                        "rivers": list(stretch["rivers"]),
                        "active": is_stretch_active(stretch["id"], count),
                        "downstream": DOWNSTREAM[stretch["id"]],
                    }
                    for stretch in STRETCHES
                ],
                "order": list(STRETCH_ORDER),
                "village": list(VILLAGE_COSTS),
                "sea_cost": SEA_COST,
                "fairy_spots": [dict(spot) for spot in FAIRY_SPOTS],
                "spaces": board_spaces(count),
            },
            "catalog": {
                "pearls": {color: {"points": PEARL_POINTS[color], **PEARL_META[color]}
                           for color in PEARL_COLORS},
                "supplies": {kind: dict(SUPPLY_META[kind]) for kind in SUPPLY_KINDS},
                "fairies": {kind: dict(FAIRY_META[kind]) for kind in FAIRY_KINDS},
                "objectives": {key: dict(value) for key, value in OBJECTIVE_META.items()},
                "alpaca_cards": [dict(card) for card in ALPACA_CARDS],
                "markaya": {tile["id"]: {
                    "id": tile["id"],
                    "name_zh": tile["name_zh"],
                    "name_en": tile["name_en"],
                    "cards": tile["cards"],
                    "spots": list(tile["spots"]),
                    "objective": tile["objective"],
                    "color": tile["color"],
                    "points": tile["points"],
                } for tile in MARKAYA_TILES + STARTING_MARKAYA},
            },
        }
        if own is not None:
            view["you_alpaca"] = list(own["alpaca"])
            view["you_hand"] = dict(own["hand"])
            view["you_fairies"] = dict(own["fairies"])
            view["you_markaya"] = copy.deepcopy(own["markaya"])
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.twelve_rivers_ai import choose_bot_action
        view = TwelveRiversGame.get_public_view(state, bot_id)
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


