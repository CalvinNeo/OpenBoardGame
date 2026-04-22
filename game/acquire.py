from __future__ import annotations

import random
from copy import deepcopy
from typing import Dict, List, Optional, Set, Tuple


BOARD_ROWS = "ABCDEFGHI"
BOARD_COLUMNS = list(range(1, 13))
BOARD_TILES = [f"{column}{row}" for row in BOARD_ROWS for column in BOARD_COLUMNS]
CHAIN_DEFS = [
    {"chain_id": "worldwide", "name": "Worldwide", "tier": 1},
    {"chain_id": "sackson", "name": "Sackson", "tier": 1},
    {"chain_id": "festival", "name": "Festival", "tier": 2},
    {"chain_id": "imperial", "name": "Imperial", "tier": 2},
    {"chain_id": "american", "name": "American", "tier": 2},
    {"chain_id": "continental", "name": "Continental", "tier": 3},
    {"chain_id": "tower", "name": "Tower", "tier": 3},
]
CHAIN_IDS = [entry["chain_id"] for entry in CHAIN_DEFS]
CHAIN_NAMES = {entry["chain_id"]: entry["name"] for entry in CHAIN_DEFS}
CHAIN_TIERS = {entry["chain_id"]: entry["tier"] for entry in CHAIN_DEFS}
STARTING_MONEY = 6000
HAND_LIMIT = 6
BANK_SHARES = 25
SAFE_CHAIN_SIZE = 11


def _tile_sort_key(tile: str) -> Tuple[int, int]:
    row = tile[-1]
    column = int(tile[:-1])
    return column, BOARD_ROWS.index(row)


def _adjacent_tiles(tile: str) -> List[str]:
    row = BOARD_ROWS.index(tile[-1])
    column = int(tile[:-1]) - 1
    neighbors: List[str] = []
    if column > 0:
        neighbors.append(f"{column}{BOARD_ROWS[row]}")
    if column < len(BOARD_COLUMNS) - 1:
        neighbors.append(f"{column + 2}{BOARD_ROWS[row]}")
    if row > 0:
        neighbors.append(f"{column + 1}{BOARD_ROWS[row - 1]}")
    if row < len(BOARD_ROWS) - 1:
        neighbors.append(f"{column + 1}{BOARD_ROWS[row + 1]}")
    return neighbors


def _build_chain_state() -> Dict[str, Dict]:
    chains: Dict[str, Dict] = {}
    for entry in CHAIN_DEFS:
        chains[entry["chain_id"]] = {
            "chain_id": entry["chain_id"],
            "name": entry["name"],
            "tier": entry["tier"],
            "active": False,
            "size": 0,
            "safe": False,
            "available_shares": BANK_SHARES,
        }
    return chains


def _price_for_tier_size(tier: int, size: int) -> int:
    if size <= 1:
        return 0
    if size == 2:
        offset = 0
    elif size == 3:
        offset = 1
    elif size == 4:
        offset = 2
    elif size == 5:
        offset = 3
    elif size <= 10:
        offset = 4
    elif size <= 20:
        offset = 5
    elif size <= 30:
        offset = 6
    elif size <= 40:
        offset = 7
    else:
        offset = 8
    return (tier + offset + 1) * 100


def _chain_price(state: Dict, chain_id: str) -> int:
    chain = state["chains"][chain_id]
    return _price_for_tier_size(chain["tier"], int(chain["size"]))


def _bonus_share(amount: int, split: int) -> int:
    if split <= 0:
        return 0
    return ((amount // split) // 100) * 100


def _stock_bonuses(state: Dict, chain_id: str) -> List[Dict]:
    chain = state["chains"][chain_id]
    base_price = _price_for_tier_size(chain["tier"], chain["size"])
    majority_bonus = base_price * 10
    minority_bonus = base_price * 5
    holdings = []
    for player_id in state["turn_order"]:
        count = int(state["players"][player_id]["stocks"][chain_id])
        if count > 0:
            holdings.append((player_id, count))
    if not holdings:
        return []
    holdings.sort(key=lambda item: item[1], reverse=True)
    top_count = holdings[0][1]
    majority = [player_id for player_id, count in holdings if count == top_count]
    if len(majority) > 1:
        share = _bonus_share(majority_bonus + minority_bonus, len(majority))
        return [{"player_id": player_id, "amount": share, "kind": "majority_tied"} for player_id in majority]
    if len(holdings) == 1:
        return [{"player_id": holdings[0][0], "amount": majority_bonus + minority_bonus, "kind": "sole_holder"}]
    second_count = holdings[1][1]
    minority = [player_id for player_id, count in holdings[1:] if count == second_count]
    payouts = [{"player_id": majority[0], "amount": majority_bonus, "kind": "majority"}]
    share = _bonus_share(minority_bonus, len(minority))
    payouts.extend({"player_id": player_id, "amount": share, "kind": "minority"} for player_id in minority)
    return payouts


def _recount_chain_sizes(state: Dict) -> None:
    counts = {chain_id: 0 for chain_id in CHAIN_IDS}
    for owner in state["board"].values():
        if owner in counts:
            counts[owner] += 1
    for chain_id in CHAIN_IDS:
        chain = state["chains"][chain_id]
        chain["size"] = counts[chain_id] if chain["active"] else 0
        chain["safe"] = chain["active"] and chain["size"] >= SAFE_CHAIN_SIZE
        held = sum(int(player["stocks"][chain_id]) for player in state["players"].values())
        chain["available_shares"] = max(0, BANK_SHARES - held)


def _orphan_cluster(board: Dict[str, str], roots: Set[str]) -> List[str]:
    pending = list(roots)
    seen: Set[str] = set()
    cluster: List[str] = []
    while pending:
        tile = pending.pop()
        if tile in seen:
            continue
        seen.add(tile)
        if board.get(tile) != "orphan":
            continue
        cluster.append(tile)
        for neighbor in _adjacent_tiles(tile):
            if neighbor not in seen:
                pending.append(neighbor)
    cluster.sort(key=_tile_sort_key)
    return cluster


def _neighbor_summary(state: Dict, tile: str) -> Dict:
    orphan_roots: Set[str] = set()
    chain_neighbors: Set[str] = set()
    for neighbor in _adjacent_tiles(tile):
        owner = state["board"].get(neighbor)
        if owner == "orphan":
            orphan_roots.add(neighbor)
        elif owner in state["chains"]:
            chain_neighbors.add(owner)
    orphan_cluster = _orphan_cluster(state["board"], orphan_roots) if orphan_roots else []
    return {
        "orphan_cluster": orphan_cluster,
        "chain_neighbors": sorted(chain_neighbors),
    }


def _inactive_chain_ids(state: Dict) -> List[str]:
    return [chain_id for chain_id in CHAIN_IDS if not state["chains"][chain_id]["active"]]


def _tile_play_status(state: Dict, tile: str) -> str:
    if tile in state["board"]:
        return "occupied"
    summary = _neighbor_summary(state, tile)
    chain_neighbors = summary["chain_neighbors"]
    orphan_cluster = summary["orphan_cluster"]
    safe_neighbors = [chain_id for chain_id in chain_neighbors if state["chains"][chain_id]["safe"]]
    if len(safe_neighbors) >= 2:
        return "dead"
    if chain_neighbors and len(chain_neighbors) >= 2:
        return "legal"
    if chain_neighbors:
        return "legal"
    if orphan_cluster and not _inactive_chain_ids(state):
        return "dead"
    return "legal"


def _remove_tile_from_hand(player_state: Dict, tile: str) -> bool:
    hand = player_state["hand"]
    if tile not in hand:
        return False
    hand.remove(tile)
    hand.sort(key=_tile_sort_key)
    return True


def _draw_tile(state: Dict, player_id: str) -> Optional[str]:
    if not state["draw_pile"]:
        return None
    tile = state["draw_pile"].pop()
    state["players"][player_id]["hand"].append(tile)
    state["players"][player_id]["hand"].sort(key=_tile_sort_key)
    return tile


def _stabilize_hand(state: Dict, player_id: str) -> None:
    player = state["players"][player_id]
    stalled = 0
    while len(player["hand"]) < HAND_LIMIT and state["draw_pile"] and stalled < 200:
        _draw_tile(state, player_id)
        stalled += 1
    changed = True
    while changed and stalled < 400:
        changed = False
        for tile in list(player["hand"]):
            status = _tile_play_status(state, tile)
            if status == "legal":
                continue
            player["discarded_dead_tiles"].append(tile)
            player["hand"].remove(tile)
            changed = True
        player["hand"].sort(key=_tile_sort_key)
        while len(player["hand"]) < HAND_LIMIT and state["draw_pile"]:
            _draw_tile(state, player_id)
            changed = True
            stalled += 1


def _advance_turn(state: Dict) -> None:
    if state.get("game_over"):
        state["current_turn"] = None
        state["turn_stage"] = "game_over"
        return
    if not state["turn_order"]:
        state["current_turn"] = None
        state["turn_stage"] = "game_over"
        return
    state["current_turn_index"] = (int(state["current_turn_index"]) + 1) % len(state["turn_order"])
    state["current_turn"] = state["turn_order"][state["current_turn_index"]]
    state["turn_stage"] = "play_tile"
    state["pending"] = None
    _stabilize_hand(state, state["current_turn"])


def _pending_merge_candidates(state: Dict, pending: Dict) -> List[str]:
    remaining = [chain_id for chain_id in pending["defunct_remaining"]]
    if not remaining:
        return []
    sizes = {chain_id: int(pending["chain_sizes"][chain_id]) for chain_id in remaining}
    smallest = min(sizes.values())
    return sorted([chain_id for chain_id in remaining if sizes[chain_id] == smallest], key=lambda item: (sizes[item], item))


def _merge_player_order(state: Dict, triggering_player_id: str, chain_id: str) -> List[str]:
    order = []
    start = state["turn_order"].index(triggering_player_id)
    for offset in range(len(state["turn_order"])):
        player_id = state["turn_order"][(start + offset) % len(state["turn_order"])]
        if state["players"][player_id]["stocks"][chain_id] > 0:
            order.append(player_id)
    return order


def _apply_chain_bonus(state: Dict, chain_id: str, events: List[Dict]) -> None:
    payouts = _stock_bonuses(state, chain_id)
    for payout in payouts:
        state["players"][payout["player_id"]]["money"] += payout["amount"]
    if payouts:
        events.append({"type": "acquire:bonus_paid", "payload": {"chain_id": chain_id, "payouts": payouts}})


def _begin_next_merge_step(state: Dict, events: List[Dict]) -> None:
    pending = state["pending"]
    if not pending or pending.get("type") != "merge":
        return
    if not pending.get("acquirer"):
        max_size = max(int(pending["chain_sizes"][chain_id]) for chain_id in pending["chains"])
        candidates = [chain_id for chain_id in pending["chains"] if int(pending["chain_sizes"][chain_id]) == max_size]
        if len(candidates) == 1:
            pending["acquirer"] = candidates[0]
            pending["defunct_remaining"] = [chain_id for chain_id in pending["chains"] if chain_id != pending["acquirer"]]
            events.append({"type": "acquire:merge_acquirer", "payload": {"chain_id": pending["acquirer"]}})
        else:
            pending["choice"] = "acquirer"
            pending["options"] = sorted(candidates)
            return
    candidates = _pending_merge_candidates(state, pending)
    if not candidates:
        acquirer = pending["acquirer"]
        defuncts = [chain_id for chain_id in pending["chains"] if chain_id != acquirer]
        for tile, owner in list(state["board"].items()):
            if owner in defuncts:
                state["board"][tile] = acquirer
        for tile in pending["absorbed_tiles"]:
            state["board"][tile] = acquirer
        for chain_id in pending["chains"]:
            if chain_id == acquirer:
                continue
            state["chains"][chain_id]["active"] = False
            state["chains"][chain_id]["size"] = 0
            state["chains"][chain_id]["safe"] = False
        state["pending"] = None
        _recount_chain_sizes(state)
        state["turn_stage"] = "buy"
        events.append({"type": "acquire:merge_complete", "payload": {"acquirer": acquirer}})
        return
    if len(candidates) > 1:
        pending["choice"] = "defunct"
        pending["options"] = candidates
        return
    defunct_chain = candidates[0]
    pending["current_defunct"] = defunct_chain
    pending["choice"] = None
    pending["options"] = []
    _apply_chain_bonus(state, defunct_chain, events)
    pending["dispose_order"] = _merge_player_order(state, pending["triggering_player_id"], defunct_chain)
    pending["dispose_index"] = 0
    if not pending["dispose_order"]:
        pending["defunct_remaining"] = [chain_id for chain_id in pending["defunct_remaining"] if chain_id != defunct_chain]
        _begin_next_merge_step(state, events)


def _resolve_merge_selection(state: Dict, chain_id: str, events: List[Dict]) -> Optional[str]:
    pending = state.get("pending")
    if not pending or pending.get("type") != "merge":
        return "no merge choice"
    if chain_id not in CHAIN_IDS:
        return "unknown chain"
    if pending.get("choice") == "acquirer":
        if chain_id not in pending["options"]:
            return "invalid acquirer"
        pending["acquirer"] = chain_id
        pending["defunct_remaining"] = [entry for entry in pending["chains"] if entry != chain_id]
        events.append({"type": "acquire:merge_acquirer", "payload": {"chain_id": chain_id}})
        _begin_next_merge_step(state, events)
        return None
    if pending.get("choice") == "defunct":
        if chain_id not in pending["options"]:
            return "invalid defunct chain"
        pending["current_defunct"] = chain_id
        pending["choice"] = None
        pending["options"] = []
        _apply_chain_bonus(state, chain_id, events)
        pending["dispose_order"] = _merge_player_order(state, pending["triggering_player_id"], chain_id)
        pending["dispose_index"] = 0
        if not pending["dispose_order"]:
            pending["defunct_remaining"] = [entry for entry in pending["defunct_remaining"] if entry != chain_id]
            _begin_next_merge_step(state, events)
        return None
    return "no chain choice pending"


def _dispose_stock(state: Dict, player_id: str, sell: int, trade: int, hold: int, events: List[Dict]) -> Optional[str]:
    pending = state.get("pending")
    if not pending or pending.get("type") != "merge" or not pending.get("current_defunct"):
        return "no stock disposal pending"
    order = pending.get("dispose_order") or []
    index = int(pending.get("dispose_index") or 0)
    if index >= len(order) or order[index] != player_id:
        return "not your disposal turn"
    defunct = pending["current_defunct"]
    acquirer = pending["acquirer"]
    holdings = int(state["players"][player_id]["stocks"][defunct])
    if min(sell, trade, hold) < 0:
        return "invalid stock counts"
    if sell + hold + trade * 2 != holdings:
        return "stock counts do not match holdings"
    if state["chains"][acquirer]["available_shares"] < trade:
        return "not enough acquiring shares"
    if sell > 0:
        state["players"][player_id]["money"] += sell * _price_for_tier_size(
            state["chains"][defunct]["tier"], int(pending["chain_sizes"][defunct])
        )
    state["players"][player_id]["stocks"][defunct] = hold
    state["players"][player_id]["stocks"][acquirer] += trade
    state["chains"][acquirer]["available_shares"] -= trade
    events.append(
        {
            "type": "acquire:dispose_stock",
            "payload": {
                "player_id": player_id,
                "defunct_chain": defunct,
                "acquirer": acquirer,
                "sell": sell,
                "trade": trade,
                "hold": hold,
            },
        }
    )
    pending["dispose_index"] = index + 1
    if pending["dispose_index"] >= len(order):
        pending["dispose_order"] = []
        pending["dispose_index"] = 0
        pending["current_defunct"] = None
        pending["defunct_remaining"] = [chain_id for chain_id in pending["defunct_remaining"] if chain_id != defunct]
        _recount_chain_sizes(state)
        _begin_next_merge_step(state, events)
    return None


def _can_end_game(state: Dict) -> bool:
    active_sizes = [int(chain["size"]) for chain in state["chains"].values() if chain["active"]]
    if not active_sizes:
        return False
    if any(size >= 41 for size in active_sizes):
        return True
    return all(size >= SAFE_CHAIN_SIZE for size in active_sizes)


def _finalize_game(state: Dict, events: List[Dict]) -> None:
    for chain_id in CHAIN_IDS:
        if not state["chains"][chain_id]["active"]:
            continue
        _apply_chain_bonus(state, chain_id, events)
    for player_id in state["turn_order"]:
        player = state["players"][player_id]
        for chain_id in CHAIN_IDS:
            shares = int(player["stocks"][chain_id])
            if shares <= 0:
                continue
            player["money"] += shares * _chain_price(state, chain_id)
            player["stocks"][chain_id] = 0
    state["game_over"] = True
    state["turn_stage"] = "game_over"
    state["current_turn"] = None
    state["pending"] = None
    max_money = max(int(state["players"][player_id]["money"]) for player_id in state["turn_order"])
    winners = [player_id for player_id in state["turn_order"] if int(state["players"][player_id]["money"]) == max_money]
    state["winner"] = winners
    events.append({"type": "acquire:game_over", "payload": {"winner": winners}})


def _play_tile(state: Dict, player_id: str, tile: str, events: List[Dict]) -> Optional[str]:
    if state.get("turn_stage") != "play_tile":
        return "must play a tile first"
    player = state["players"][player_id]
    if tile not in player["hand"]:
        return "tile not in hand"
    status = _tile_play_status(state, tile)
    if status != "legal":
        return "tile cannot be played"
    summary = _neighbor_summary(state, tile)
    orphan_cluster = summary["orphan_cluster"]
    chain_neighbors = summary["chain_neighbors"]
    if not _remove_tile_from_hand(player, tile):
        return "tile not in hand"
    state["last_played_tile"] = tile
    if not chain_neighbors and not orphan_cluster:
        state["board"][tile] = "orphan"
        state["turn_stage"] = "buy"
        events.append({"type": "acquire:place_orphan", "payload": {"player_id": player_id, "tile": tile}})
        _recount_chain_sizes(state)
        return None
    if not chain_neighbors and orphan_cluster:
        available = _inactive_chain_ids(state)
        if not available:
            player["hand"].append(tile)
            player["hand"].sort(key=_tile_sort_key)
            return "no chain available to found"
        state["pending"] = {
            "type": "founding",
            "tile": tile,
            "cluster_tiles": [tile] + orphan_cluster,
            "options": available,
            "founder": player_id,
        }
        events.append(
            {
                "type": "acquire:founding_pending",
                "payload": {"player_id": player_id, "tile": tile, "options": available},
            }
        )
        return None
    if len(chain_neighbors) == 1:
        chain_id = chain_neighbors[0]
        for placed in [tile] + orphan_cluster:
            state["board"][placed] = chain_id
        events.append(
            {
                "type": "acquire:expand_chain",
                "payload": {"player_id": player_id, "tile": tile, "chain_id": chain_id, "added_tiles": [tile] + orphan_cluster},
            }
        )
        _recount_chain_sizes(state)
        state["turn_stage"] = "buy"
        return None
    absorbed = [tile] + orphan_cluster
    chain_sizes = {chain_id: int(state["chains"][chain_id]["size"]) for chain_id in chain_neighbors}
    state["pending"] = {
        "type": "merge",
        "tile": tile,
        "triggering_player_id": player_id,
        "chains": list(chain_neighbors),
        "chain_sizes": chain_sizes,
        "acquirer": None,
        "defunct_remaining": [],
        "current_defunct": None,
        "dispose_order": [],
        "dispose_index": 0,
        "choice": None,
        "options": [],
        "absorbed_tiles": absorbed,
    }
    events.append(
        {
            "type": "acquire:merge_pending",
            "payload": {"player_id": player_id, "tile": tile, "chains": list(chain_neighbors)},
        }
    )
    _begin_next_merge_step(state, events)
    return None


class AcquireGame:
    game_id = "acquire"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) < 2 or len(players) > 6:
            raise ValueError("Acquire requires 2-6 players")
        rng = random.Random((config or {}).get("seed"))
        draw_pile = list(BOARD_TILES)
        rng.shuffle(draw_pile)
        ordered_players = list(players)
        initial_draws: List[Tuple[str, str]] = []
        for player in ordered_players:
            if not draw_pile:
                raise ValueError("not enough tiles")
            initial_draws.append((player["player_id"], draw_pile.pop()))
        initial_draws.sort(key=lambda item: _tile_sort_key(item[1]))
        turn_order = [player_id for player_id, _ in initial_draws]
        player_meta = {player["player_id"]: dict(player) for player in ordered_players}
        state_players: Dict[str, Dict] = {}
        for player_id in turn_order:
            state_players[player_id] = {
                "money": STARTING_MONEY,
                "stocks": {chain_id: 0 for chain_id in CHAIN_IDS},
                "hand": [],
                "start_tile": next(tile for pid, tile in initial_draws if pid == player_id),
                "discarded_dead_tiles": [],
            }
        state = {
            "board": {tile: "orphan" for _, tile in initial_draws},
            "draw_pile": draw_pile,
            "turn_order": turn_order,
            "current_turn_index": 0,
            "current_turn": turn_order[0],
            "turn_stage": "play_tile",
            "players": state_players,
            "player_meta": player_meta,
            "chains": _build_chain_state(),
            "config": dict(config or {}),
            "game_over": False,
            "winner": [],
            "pending": None,
            "last_played_tile": None,
        }
        for player_id in turn_order:
            _stabilize_hand(state, player_id)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_turn"):
            pending = state.get("pending")
            if pending and pending.get("type") == "merge" and pending.get("current_defunct"):
                order = pending.get("dispose_order") or []
                index = int(pending.get("dispose_index") or 0)
                if index < len(order) and order[index] == player_id:
                    return ["dispose_stock"]
            return []
        pending = state.get("pending")
        if pending:
            if pending.get("type") == "founding":
                return ["choose_chain"]
            if pending.get("type") == "merge":
                if pending.get("choice") in ("acquirer", "defunct"):
                    return ["choose_chain"]
                if pending.get("current_defunct"):
                    order = pending.get("dispose_order") or []
                    index = int(pending.get("dispose_index") or 0)
                    if index < len(order) and order[index] == player_id:
                        return ["dispose_stock"]
                return []
        if state.get("turn_stage") == "play_tile":
            return ["play_tile"]
        if state.get("turn_stage") == "buy":
            return ["buy_stocks"]
        if state.get("turn_stage") == "end_turn":
            return ["end_turn"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        events: List[Dict] = []
        action_type = action.get("type")
        pending = state.get("pending")
        if pending and pending.get("type") == "merge" and pending.get("current_defunct"):
            order = pending.get("dispose_order") or []
            index = int(pending.get("dispose_index") or 0)
            if index < len(order) and order[index] == player_id and action_type != "dispose_stock":
                return [], "must dispose merged stock"
        if action_type == "choose_chain":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if pending and pending.get("type") == "founding":
                chain_id = action.get("chain_id")
                if chain_id not in pending.get("options", []):
                    return [], "invalid chain"
                cluster_tiles = list(pending["cluster_tiles"])
                for tile in cluster_tiles:
                    state["board"][tile] = chain_id
                state["chains"][chain_id]["active"] = True
                state["pending"] = None
                _recount_chain_sizes(state)
                if state["chains"][chain_id]["available_shares"] > 0:
                    state["players"][player_id]["stocks"][chain_id] += 1
                    state["chains"][chain_id]["available_shares"] -= 1
                state["turn_stage"] = "buy"
                events.append(
                    {
                        "type": "acquire:found_chain",
                        "payload": {"player_id": player_id, "chain_id": chain_id, "tiles": cluster_tiles},
                    }
                )
                return events, None
            if pending and pending.get("type") == "merge":
                error = _resolve_merge_selection(state, action.get("chain_id"), events)
                return events, error
            return [], "no chain choice pending"
        if action_type == "dispose_stock":
            sell = int(action.get("sell", 0))
            trade = int(action.get("trade", 0))
            hold = int(action.get("hold", 0))
            error = _dispose_stock(state, player_id, sell, trade, hold, events)
            return events, error
        if player_id != state.get("current_turn"):
            return [], "not your turn"
        if action_type == "play_tile":
            error = _play_tile(state, player_id, action.get("tile"), events)
            return events, error
        if action_type == "buy_stocks":
            if state.get("turn_stage") != "buy":
                return [], "cannot buy stocks now"
            chain_ids = action.get("chain_ids")
            declare_end = bool(action.get("declare_end"))
            if not isinstance(chain_ids, list):
                return [], "chain_ids required"
            if len(chain_ids) > 3:
                return [], "cannot buy more than 3 stocks"
            total_cost = 0
            seen: List[str] = []
            for chain_id in chain_ids:
                if chain_id not in CHAIN_IDS:
                    return [], "unknown chain"
                chain = state["chains"][chain_id]
                if not chain["active"]:
                    return [], "can only buy active chains"
                if chain["available_shares"] <= 0:
                    return [], "share unavailable"
                price = _chain_price(state, chain_id)
                total_cost += price
                seen.append(chain_id)
                chain["available_shares"] -= 1
            player = state["players"][player_id]
            if player["money"] < total_cost:
                for chain_id in seen:
                    state["chains"][chain_id]["available_shares"] += 1
                return [], "not enough money"
            player["money"] -= total_cost
            for chain_id in chain_ids:
                player["stocks"][chain_id] += 1
            events.append(
                {
                    "type": "acquire:buy_stocks",
                    "payload": {"player_id": player_id, "chain_ids": list(chain_ids), "declare_end": declare_end},
                }
            )
            if declare_end:
                if not _can_end_game(state):
                    for chain_id in chain_ids:
                        player["stocks"][chain_id] -= 1
                        state["chains"][chain_id]["available_shares"] += 1
                    player["money"] += total_cost
                    return [], "end condition not met"
                _finalize_game(state, events)
                return events, None
            _advance_turn(state)
            events.append({"type": "acquire:end_turn", "payload": {"player_id": player_id, "next_player_id": state["current_turn"]}})
            return events, None
        if action_type == "end_turn":
            if state.get("turn_stage") != "end_turn":
                return [], "cannot end turn now"
            declare_end = bool(action.get("declare_end"))
            if declare_end:
                if not _can_end_game(state):
                    return [], "end condition not met"
                _finalize_game(state, events)
                return events, None
            _advance_turn(state)
            events.append({"type": "acquire:end_turn", "payload": {"player_id": player_id, "next_player_id": state["current_turn"]}})
            return events, None
        return [], "unknown action"

    @staticmethod
    def bot_move(state: Dict, player_id: str) -> Optional[Dict]:
        legal = AcquireGame.get_legal_actions(state, player_id)
        if not legal:
            return None
        pending = state.get("pending")
        if pending and "choose_chain" in legal:
            return {"type": "choose_chain", "chain_id": pending["options"][0]}
        if "dispose_stock" in legal and pending and pending.get("current_defunct"):
            holdings = int(state["players"][player_id]["stocks"][pending["current_defunct"]])
            trade = min(holdings // 2, int(state["chains"][pending["acquirer"]]["available_shares"]))
            sell = holdings - trade * 2
            return {"type": "dispose_stock", "sell": sell, "trade": trade, "hold": 0}
        if state.get("turn_stage") == "play_tile":
            for tile in list(state["players"][player_id]["hand"]):
                if _tile_play_status(state, tile) == "legal":
                    return {"type": "play_tile", "tile": tile}
            return None
        if state.get("turn_stage") == "buy":
            affordable: List[Tuple[int, str]] = []
            for chain_id in CHAIN_IDS:
                chain = state["chains"][chain_id]
                if chain["active"] and chain["available_shares"] > 0:
                    affordable.append((_chain_price(state, chain_id), chain_id))
            affordable.sort(key=lambda item: (item[0], item[1]))
            money = int(state["players"][player_id]["money"])
            picks: List[str] = []
            for price, chain_id in affordable:
                if len(picks) >= 3 or money < price:
                    break
                picks.append(chain_id)
                money -= price
            return {"type": "buy_stocks", "chain_ids": picks}
        if state.get("turn_stage") == "end_turn":
            return {"type": "end_turn", "declare_end": _can_end_game(state)}
        return None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        board_rows: List[List[Dict]] = []
        for row in BOARD_ROWS:
            row_cells: List[Dict] = []
            for column in BOARD_COLUMNS:
                tile = f"{column}{row}"
                owner = state["board"].get(tile)
                row_cells.append({"tile": tile, "owner": owner})
            board_rows.append(row_cells)
        players = []
        for player_id in state["turn_order"]:
            player = state["players"][player_id]
            hand_tiles = list(player["hand"]) if player_id == viewer_id else []
            hand_status = []
            if player_id == viewer_id:
                for tile in hand_tiles:
                    hand_status.append({"tile": tile, "status": _tile_play_status(state, tile)})
            players.append(
                {
                    "player_id": player_id,
                    "name": state["player_meta"].get(player_id, {}).get("name", player_id),
                    "money": int(player["money"]),
                    "stocks": dict(player["stocks"]),
                    "hand_count": len(player["hand"]),
                    "hand_tiles": hand_tiles,
                    "hand_status": hand_status,
                    "start_tile": player.get("start_tile"),
                }
            )
        chains = []
        for chain_id in CHAIN_IDS:
            chain = state["chains"][chain_id]
            chains.append(
                {
                    "chain_id": chain_id,
                    "name": chain["name"],
                    "tier": chain["tier"],
                    "active": bool(chain["active"]),
                    "size": int(chain["size"]),
                    "safe": bool(chain["safe"]),
                    "available_shares": int(chain["available_shares"]),
                    "price": _chain_price(state, chain_id) if chain["active"] else 0,
                }
            )
        pending = deepcopy(state.get("pending"))
        if pending and pending.get("type") == "merge" and pending.get("current_defunct"):
            order = pending.get("dispose_order") or []
            index = int(pending.get("dispose_index") or 0)
            pending["current_player"] = order[index] if index < len(order) else None
        return {
            "game_id": AcquireGame.game_id,
            "you": viewer_id,
            "current_turn": state.get("current_turn"),
            "turn_stage": state.get("turn_stage"),
            "game_over": bool(state.get("game_over")),
            "winner": list(state.get("winner") or []),
            "can_end_game": _can_end_game(state),
            "last_played_tile": state.get("last_played_tile"),
            "board_rows": board_rows,
            "players": players,
            "chains": chains,
            "pending": pending,
            "turn_order": list(state["turn_order"]),
        }

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return deepcopy(payload)
