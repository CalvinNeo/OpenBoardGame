from __future__ import annotations

from collections import Counter
from copy import deepcopy
from itertools import combinations_with_replacement
from typing import Dict, List, Optional, Tuple

from game.acquire import (
    BOARD_TILES,
    CHAIN_IDS,
    _adjacent_tiles,
    _chain_price,
    _neighbor_summary,
    _price_for_tier_size,
    _recount_chain_sizes,
    _stock_bonuses,
    _tile_play_status,
)


def _position(view: Dict) -> Dict:
    return {
        "board": {
            cell["tile"]: cell["owner"]
            for row in view["board_rows"]
            for cell in row
            if cell["owner"]
        },
        "chains": {chain["chain_id"]: dict(chain) for chain in view["chains"]},
        "players": {
            player["player_id"]: {
                "money": player["money"],
                "stocks": dict(player["stocks"]),
                "hand": list(player["hand_tiles"]),
            }
            for player in view["players"]
        },
        "turn_order": list(view["turn_order"]),
    }


def _financial_copy(position: Dict) -> Dict:
    return {
        **position,
        "chains": {chain_id: dict(chain) for chain_id, chain in position["chains"].items()},
        "players": {
            player_id: {**player, "stocks": dict(player["stocks"])}
            for player_id, player in position["players"].items()
        },
    }


def _quotes(position: Dict) -> Dict[str, Tuple[float, float]]:
    board = position["board"]
    empty_count = len(BOARD_TILES) - len(board)
    revival = min(0.4, max(0.0, (empty_count - 12) / 160))
    known_hand = {tile for player in position["players"].values() for tile in player["hand"]}
    quotes = {}
    for chain_id, chain in position["chains"].items():
        if not chain["active"]:
            price = _price_for_tier_size(chain["tier"], 2)
            quotes[chain_id] = (price * revival, revival * 0.5)
            continue
        frontier = {
            neighbor
            for tile, owner in board.items()
            if owner == chain_id
            for neighbor in _adjacent_tiles(tile)
            if neighbor not in board
        }
        frontier = {tile for tile in frontier if _tile_play_status(position, tile) == "legal"}
        growth = min(10, int(len(frontier) * 0.3 + len(frontier & known_hand) * 0.8))
        price = _chain_price(position, chain_id)
        future_price = _price_for_tier_size(chain["tier"], chain["size"] + growth)
        expected_price = price + (future_price - price) * 0.6
        quotes[chain_id] = (expected_price, 0.8 * expected_price / max(1, price))
    return quotes


def _equities(position: Dict, quotes: Optional[Dict] = None) -> Dict[str, float]:
    values = {}
    for player_id, player in position["players"].items():
        money = player["money"]
        values[player_id] = money + (0.25 * min(1200, money) if quotes is not None else 0)
    for chain_id, chain in position["chains"].items():
        if quotes is None:
            price = _chain_price(position, chain_id)
            bonus_factor = 1.0 if chain["active"] else 0.0
        else:
            price, bonus_factor = quotes[chain_id]
        for player_id, player in position["players"].items():
            values[player_id] += player["stocks"][chain_id] * price
        bonus_position = position
        if not chain["active"] and quotes is not None:
            bonus_position = {
                **position,
                "chains": {**position["chains"], chain_id: {**chain, "size": 2}},
            }
        for payout in _stock_bonuses(bonus_position, chain_id):
            values[payout["player_id"]] += payout["amount"] * bonus_factor
        if quotes is not None and chain["active"] and chain["available_shares"] > 0:
            for player_id, player in position["players"].items():
                opposition = max(
                    other["stocks"][chain_id]
                    for other_id, other in position["players"].items()
                    if other_id != player_id
                )
                lead = min(3, max(0, player["stocks"][chain_id] - opposition))
                values[player_id] += lead * price * 0.1
    return values


def _advantage(values: Dict[str, float], player_id: str) -> float:
    opponents = [value for other_id, value in values.items() if other_id != player_id]
    return values[player_id] - 0.75 * max(opponents) - 0.25 * sum(opponents) / len(opponents)


def _score(position: Dict, player_id: str, quotes: Optional[Dict] = None) -> float:
    return _advantage(_equities(position, quotes if quotes is not None else _quotes(position)), player_id)


def _hand_potential(position: Dict, player_id: str) -> float:
    if all(chain["active"] for chain in position["chains"].values()):
        return 0.0
    for tile in position["players"][player_id]["hand"]:
        summary = _neighbor_summary(position, tile)
        if tile not in position["board"] and summary["orphan_cluster"] and not summary["chain_neighbors"]:
            return 300.0
    return 0.0


def _buy_action(position: Dict, player_id: str, can_end: bool) -> Dict:
    quotes = _quotes(position)
    choices = [
        chain_id for chain_id in CHAIN_IDS
        if position["chains"][chain_id]["active"] and position["chains"][chain_id]["available_shares"] > 0
    ]
    best_score = float("-inf")
    best_picks: List[str] = []
    best_finish = None
    best_finish_score = (float("-inf"), float("-inf"))
    for count in range(4):
        for picks in combinations_with_replacement(choices, count):
            quantities = Counter(picks)
            if any(quantity > position["chains"][chain_id]["available_shares"] for chain_id, quantity in quantities.items()):
                continue
            cost = sum(_chain_price(position, chain_id) for chain_id in picks)
            if cost > position["players"][player_id]["money"]:
                continue
            trial = _financial_copy(position)
            trial["players"][player_id]["money"] -= cost
            for chain_id, quantity in quantities.items():
                trial["players"][player_id]["stocks"][chain_id] += quantity
                trial["chains"][chain_id]["available_shares"] -= quantity
            score = _score(trial, player_id, quotes)
            if score > best_score:
                best_score, best_picks = score, list(picks)
            if can_end:
                values = _equities(trial)
                margin = values[player_id] - max(value for other_id, value in values.items() if other_id != player_id)
                finish_score = (margin, values[player_id])
                if margin >= 0 and finish_score > best_finish_score:
                    best_finish_score, best_finish = finish_score, list(picks)
    return {
        "type": "buy_stocks",
        "chain_ids": best_finish if best_finish is not None else best_picks,
        "declare_end": best_finish is not None,
    }


def _apply_disposal(position: Dict, player_id: str, defunct: str, acquirer: str, price: int, action: Dict) -> None:
    player = position["players"][player_id]
    returned = player["stocks"][defunct] - action["hold"]
    player["money"] += action["sell"] * price
    player["stocks"][defunct] = action["hold"]
    player["stocks"][acquirer] += action["trade"]
    position["chains"][defunct]["available_shares"] += returned
    position["chains"][acquirer]["available_shares"] -= action["trade"]


def _disposal_action(position: Dict, player_id: str, defunct: str, acquirer: str, price: int, quotes: Dict) -> Dict:
    holdings = position["players"][player_id]["stocks"][defunct]
    max_trade = min(holdings // 2, position["chains"][acquirer]["available_shares"])
    best_action = {"type": "dispose_stock", "sell": holdings, "trade": 0, "hold": 0}
    best_score = float("-inf")
    for trade in range(max_trade + 1):
        for hold in range(holdings - trade * 2 + 1):
            action = {"type": "dispose_stock", "sell": holdings - trade * 2 - hold, "trade": trade, "hold": hold}
            trial = _financial_copy(position)
            _apply_disposal(trial, player_id, defunct, acquirer, price, action)
            score = _score(trial, player_id, quotes)
            if score > best_score:
                best_score, best_action = score, action
    return best_action


def _merged_position(position: Dict, pending: Dict, acquirer: str) -> Dict:
    trial = deepcopy(position)
    for tile, owner in list(trial["board"].items()):
        if owner in pending["chains"]:
            trial["board"][tile] = acquirer
    for tile in pending["absorbed_tiles"]:
        trial["board"][tile] = acquirer
    for chain_id in pending["chains"]:
        trial["chains"][chain_id]["active"] = chain_id == acquirer
    _recount_chain_sizes(trial)
    return trial


def _project_merger(position: Dict, pending: Dict, acquirer: str, first_defunct: Optional[str] = None) -> Dict:
    trial = _merged_position(position, pending, acquirer)
    remaining = pending.get("defunct_remaining") or [chain_id for chain_id in pending["chains"] if chain_id != acquirer]
    defuncts = sorted(remaining, key=lambda chain_id: (pending["chain_sizes"][chain_id], chain_id != first_defunct, chain_id))
    start = trial["turn_order"].index(pending["triggering_player_id"])
    order = trial["turn_order"][start:] + trial["turn_order"][:start]
    quotes = _quotes(trial)
    for defunct in defuncts:
        bonus_position = {
            **trial,
            "chains": {
                **trial["chains"],
                defunct: {**trial["chains"][defunct], "size": pending["chain_sizes"][defunct]},
            },
        }
        for payout in _stock_bonuses(bonus_position, defunct):
            trial["players"][payout["player_id"]]["money"] += payout["amount"]
        price = _chain_price(bonus_position, defunct)
        for player_id in order:
            if trial["players"][player_id]["stocks"][defunct] > 0:
                action = _disposal_action(trial, player_id, defunct, acquirer, price, quotes)
                _apply_disposal(trial, player_id, defunct, acquirer, price, action)
    return trial


def _founded_position(position: Dict, player_id: str, tiles: List[str], chain_id: str) -> Dict:
    trial = deepcopy(position)
    for tile in tiles:
        trial["board"][tile] = chain_id
    trial["chains"][chain_id]["active"] = True
    if trial["chains"][chain_id]["available_shares"] > 0:
        trial["players"][player_id]["stocks"][chain_id] += 1
    _recount_chain_sizes(trial)
    return trial


def _tile_score(position: Dict, player_id: str, tile: str) -> float:
    trial = deepcopy(position)
    trial["players"][player_id]["hand"].remove(tile)
    summary = _neighbor_summary(trial, tile)
    chains = summary["chain_neighbors"]
    tiles = [tile] + summary["orphan_cluster"]
    if len(chains) > 1:
        sizes = {chain_id: trial["chains"][chain_id]["size"] for chain_id in chains}
        pending = {"chains": chains, "chain_sizes": sizes, "absorbed_tiles": tiles, "triggering_player_id": player_id}
        projections = [
            _project_merger(trial, pending, chain_id)
            for chain_id in chains if sizes[chain_id] == max(sizes.values())
        ]
    elif not chains and summary["orphan_cluster"]:
        projections = [
            _founded_position(trial, player_id, tiles, chain_id)
            for chain_id in CHAIN_IDS if not trial["chains"][chain_id]["active"]
        ]
    else:
        for placed in tiles:
            trial["board"][placed] = chains[0] if chains else "orphan"
        _recount_chain_sizes(trial)
        projections = [trial]
    return max(_score(projected, player_id) + _hand_potential(projected, player_id) for projected in projections)


def choose_action(view: Dict) -> Optional[Dict]:
    player_id = view["you"]
    if view["game_over"] or not any(player["player_id"] == player_id for player in view["players"]):
        return None
    position = _position(view)
    pending = view.get("pending")
    if pending and pending["type"] == "merge" and pending.get("current_defunct"):
        if pending.get("current_player") != player_id:
            return None
        defunct, acquirer = pending["current_defunct"], pending["acquirer"]
        price = _price_for_tier_size(position["chains"][defunct]["tier"], pending["chain_sizes"][defunct])
        projected = _merged_position(position, pending, acquirer)
        return _disposal_action(projected, player_id, defunct, acquirer, price, _quotes(projected))
    if view["current_turn"] != player_id:
        return None
    if pending:
        scores = {}
        for chain_id in pending["options"]:
            if pending["type"] == "founding":
                trial = _founded_position(position, player_id, pending["cluster_tiles"], chain_id)
            elif pending.get("choice") == "acquirer":
                trial = _project_merger(position, pending, chain_id)
            else:
                trial = _project_merger(position, pending, pending["acquirer"], chain_id)
            scores[chain_id] = _score(trial, player_id)
        if scores:
            return {"type": "choose_chain", "chain_id": max(scores, key=scores.get)}
        return None
    if view["turn_stage"] == "play_tile":
        tiles = [tile for tile in position["players"][player_id]["hand"] if _tile_play_status(position, tile) == "legal"]
        if tiles:
            return {"type": "play_tile", "tile": max(tiles, key=lambda tile: _tile_score(position, player_id, tile))}
    if view["turn_stage"] == "buy":
        return _buy_action(position, player_id, view["can_end_game"])
    if view["turn_stage"] == "end_turn":
        values = _equities(position)
        return {"type": "end_turn", "declare_end": view["can_end_game"] and values[player_id] == max(values.values())}
    return None
