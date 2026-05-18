import random
from collections import Counter
from typing import Dict, List, Optional, Tuple


CIVILIZATIONS = ["astronomy", "agriculture", "writing", "religion", "art"]
MONUMENTS = [
    "fortress",
    "obelisk",
    "palace",
    "pyramid",
    "sphinx",
    "statue",
    "temple",
    "step_pyramid",
]
DISASTER_TARGETS = {
    "war": {"pharaoh"},
    "drought": {"nile", "flood"},
    "funeral": set(CIVILIZATIONS),
    "earthquake": set(MONUMENTS),
}
SUN_DISKS = {
    3: [[2, 5, 8, 13], [3, 6, 9, 14], [4, 7, 10, 15]],
    4: [[2, 6, 13], [3, 7, 14], [4, 8, 15], [5, 9, 16]],
    5: [[2, 7, 16], [3, 8, 15], [4, 9, 14], [5, 10, 13], [6, 11, 12]],
}
RA_TRACK_LIMIT = {2: 6, 3: 8, 4: 9, 5: 10}
TEMPORARY_KINDS = {"god", "gold", "flood", *CIVILIZATIONS}


def _tile(tile_id: str, kind: str, group: str, label: str) -> Dict:
    return {"id": tile_id, "kind": kind, "group": group, "label": label}


def _build_bag() -> List[Dict]:
    tiles: List[Dict] = []

    def add(count: int, kind: str, group: str, label: str) -> None:
        start = len(tiles)
        for idx in range(count):
            tiles.append(_tile(f"{kind}_{start + idx}", kind, group, label))

    add(30, "ra", "ra", "Ra")
    add(8, "god", "god", "God")
    add(5, "gold", "gold", "Gold")
    add(25, "pharaoh", "pharaoh", "Pharaoh")
    add(25, "nile", "river", "Nile")
    add(12, "flood", "river", "Flood")
    for kind in CIVILIZATIONS:
        add(5, kind, "civilization", kind.replace("_", " ").title())
    for kind in MONUMENTS:
        add(5, kind, "monument", kind.replace("_", " ").title())
    for kind, count in (("war", 2), ("drought", 2), ("funeral", 2), ("earthquake", 4)):
        add(count, kind, "disaster", kind.title())
    random.shuffle(tiles)
    return tiles


def _sorted_player_ids(state: Dict, player_ids: Optional[List[str]] = None) -> List[str]:
    meta = state.get("player_meta", {})
    ids = list(player_ids) if player_ids is not None else list(meta.keys())
    return sorted(ids, key=lambda pid: meta.get(pid, {}).get("seat", 0))


def _next_player_id(state: Dict, current_pid: Optional[str]) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    if current_pid not in order:
        return order[0]
    idx = order.index(current_pid)
    return order[(idx + 1) % len(order)]


def _available_disks(pdata: Dict) -> List[int]:
    return sorted(int(disk["value"]) for disk in pdata.get("sun_disks", []) if disk.get("ready"))


def _all_disks_spent(state: Dict) -> bool:
    return all(not _available_disks(pdata) for pdata in state.get("players", {}).values())


def _count_kinds(tiles: List[Dict]) -> Counter:
    return Counter(tile.get("kind") for tile in tiles)


def _remove_tile_ids(tiles: List[Dict], ids: set) -> List[Dict]:
    return [tile for tile in tiles if tile.get("id") not in ids]


def _find_tiles_by_ids(tiles: List[Dict], ids: List[str]) -> List[Dict]:
    wanted = set(ids)
    return [tile for tile in tiles if tile.get("id") in wanted]


def _current_bid(auction: Dict) -> int:
    bids = auction.get("bids", {})
    return max([0] + [int(value) for value in bids.values()])


def _start_auction(state: Dict, initiator: str, forced: bool) -> None:
    order = state.get("turn_order", [])
    start = _next_player_id(state, initiator)
    bid_order: List[str] = []
    if start in order:
        idx = order.index(start)
        bid_order = [order[(idx + offset) % len(order)] for offset in range(len(order))]
    state["phase"] = "auction"
    state["auction"] = {
        "initiator": initiator,
        "forced": bool(forced),
        "bid_order": bid_order,
        "cursor": 0,
        "bids": {},
        "passed": [],
    }
    state["ra_holder"] = initiator
    state["current_turn"] = bid_order[0] if bid_order else None


def _advance_turn(state: Dict, current_pid: str) -> None:
    next_pid = _next_player_id(state, current_pid)
    order = state.get("turn_order", [])
    for _ in range(len(order)):
        if next_pid is None:
            break
        if _available_disks(state["players"][next_pid]):
            state["current_turn"] = next_pid
            state["phase"] = "turn"
            state["auction"] = None
            return
        next_pid = _next_player_id(state, next_pid)
    _end_epoch(state, reason="all_sun_disks_spent")


def _score_epoch(state: Dict) -> Dict:
    player_ids = _sorted_player_ids(state)
    deltas = {pid: 0 for pid in player_ids}
    details = {pid: [] for pid in player_ids}
    counts = {pid: _count_kinds(state["players"][pid].get("tiles", [])) for pid in player_ids}

    for pid in player_ids:
        c = counts[pid]
        god_gold = c["god"] * 2 + c["gold"] * 3
        if c["god"]:
            details[pid].append(f"Gods +{c['god'] * 2}")
        if c["gold"]:
            details[pid].append(f"Gold +{c['gold'] * 3}")
        deltas[pid] += god_gold

        if c["flood"] > 0:
            river_score = c["flood"] + c["nile"]
            deltas[pid] += river_score
            details[pid].append(f"River +{river_score}")

        civ_types = sum(1 for kind in CIVILIZATIONS if c[kind] > 0)
        civ_score = 0
        if civ_types == 0:
            civ_score = -5
        elif civ_types >= 3:
            civ_score = {3: 5, 4: 10, 5: 15}[civ_types]
        if civ_score:
            deltas[pid] += civ_score
            details[pid].append(f"Civilization {civ_score:+d}")

    pharaoh_values = {pid: counts[pid]["pharaoh"] for pid in player_ids}
    if len(set(pharaoh_values.values())) > 1:
        high = max(pharaoh_values.values())
        low = min(pharaoh_values.values())
        for pid, value in pharaoh_values.items():
            if value == high:
                deltas[pid] += 5
                details[pid].append("Pharaohs +5")
            if value == low:
                deltas[pid] -= 2
                details[pid].append("Pharaohs -2")

    if int(state.get("epoch", 1)) == 3:
        disk_sums = {}
        for pid in player_ids:
            c = counts[pid]
            monument_types = sum(1 for kind in MONUMENTS if c[kind] > 0)
            monument_score = 0
            if 1 <= monument_types <= 6:
                monument_score += monument_types
            elif monument_types == 7:
                monument_score += 10
            elif monument_types == 8:
                monument_score += 15
            for kind in MONUMENTS:
                if c[kind] >= 3:
                    monument_score += {3: 5, 4: 10}.get(c[kind], 15)
            if monument_score:
                deltas[pid] += monument_score
                details[pid].append(f"Monuments +{monument_score}")
            disk_sums[pid] = sum(int(d["value"]) for d in state["players"][pid].get("sun_disks", []))
        if len(set(disk_sums.values())) > 1:
            high = max(disk_sums.values())
            low = min(disk_sums.values())
            for pid, value in disk_sums.items():
                if value == high:
                    deltas[pid] += 5
                    details[pid].append("Sun disks +5")
                if value == low:
                    deltas[pid] -= 5
                    details[pid].append("Sun disks -5")

    rows = []
    for pid in player_ids:
        state["players"][pid]["score"] += deltas[pid]
        rows.append(
            {
                "player_id": pid,
                "delta": deltas[pid],
                "score": state["players"][pid]["score"],
                "details": details[pid] or ["No score"],
            }
        )
    return {"epoch": state.get("epoch"), "rows": rows}


def _end_epoch(state: Dict, reason: str) -> None:
    state["auction_track"] = []
    state["auction"] = None
    summary = _score_epoch(state)
    summary["reason"] = reason
    state["last_epoch_summary"] = summary
    state["next_round_ready"] = []
    state["current_turn"] = None
    if int(state.get("epoch", 1)) >= 3:
        _finish_game(state)
        return
    state["phase"] = "epoch_pause"


def _finish_game(state: Dict) -> None:
    scores = {pid: state["players"][pid]["score"] for pid in state.get("turn_order", [])}
    if not scores:
        state["winner"] = []
    else:
        high = max(scores.values())
        tied = [pid for pid, score in scores.items() if score == high]
        if len(tied) > 1:
            best_disk = max(max(d["value"] for d in state["players"][pid]["sun_disks"]) for pid in tied)
            tied = [pid for pid in tied if max(d["value"] for d in state["players"][pid]["sun_disks"]) == best_disk]
        state["winner"] = _sorted_player_ids(state, tied)
    state["phase"] = "game_over"
    state["game_over"] = True


def _prepare_next_epoch(state: Dict) -> None:
    for pdata in state.get("players", {}).values():
        pdata["tiles"] = [tile for tile in pdata.get("tiles", []) if tile.get("kind") not in TEMPORARY_KINDS]
        for disk in pdata.get("sun_disks", []):
            disk["ready"] = True
    state["epoch"] = int(state.get("epoch", 1)) + 1
    state["auction_track"] = []
    state["ra_track"] = []
    state["phase"] = "turn"
    state["next_round_ready"] = []
    start = _next_player_id(state, state.get("ra_holder")) or state.get("turn_order", [None])[0]
    state["start_player"] = start
    state["current_turn"] = start


def _disaster_requirements(tiles: List[Dict], disasters: List[Dict]) -> Dict[str, int]:
    counts = _count_kinds(tiles)
    requirements = {}
    for disaster in disasters:
        kind = disaster.get("kind")
        targets = DISASTER_TARGETS.get(kind, set())
        available = sum(counts[target] for target in targets)
        requirements[kind] = min(2, available)
    return requirements


def _finish_gain_tiles(state: Dict, player_id: str, won_tiles: List[Dict], bid_disk: Optional[int], trigger_player: str) -> None:
    pdata = state["players"][player_id]
    disasters = [tile for tile in won_tiles if tile.get("group") == "disaster"]
    normal_tiles = [tile for tile in won_tiles if tile.get("group") != "disaster"]
    pdata.setdefault("tiles", []).extend(normal_tiles)
    requirements = _disaster_requirements(pdata.get("tiles", []), disasters)
    if sum(requirements.values()) > 0:
        state["phase"] = "disaster"
        state["current_turn"] = player_id
        state["pending_disaster"] = {
            "player_id": player_id,
            "disasters": disasters,
            "requirements": requirements,
            "bid_disk": bid_disk,
            "trigger_player": trigger_player,
        }
        return
    _complete_post_gain(state, player_id, bid_disk, trigger_player)


def _complete_post_gain(state: Dict, player_id: str, bid_disk: Optional[int], trigger_player: str) -> None:
    state["pending_disaster"] = None
    if bid_disk is not None:
        pdata = state["players"][player_id]
        center = state["center_disk"]
        pdata["sun_disks"] = [disk for disk in pdata.get("sun_disks", []) if int(disk["value"]) != int(bid_disk)]
        pdata["sun_disks"].append({"value": center, "ready": False})
        state["center_disk"] = int(bid_disk)
    state["auction_track"] = []
    if _all_disks_spent(state):
        _end_epoch(state, reason="all_sun_disks_spent")
        return
    _advance_turn(state, trigger_player)


def _resolve_auction(state: Dict) -> None:
    auction = state.get("auction") or {}
    bids = auction.get("bids", {})
    trigger_player = auction.get("initiator")
    if not bids:
        state["auction"] = None
        _advance_turn(state, trigger_player)
        return
    winner = max(bids.keys(), key=lambda pid: int(bids[pid]))
    bid_disk = int(bids[winner])
    won_tiles = list(state.get("auction_track", []))
    _finish_gain_tiles(state, winner, won_tiles, bid_disk, trigger_player)


class RaGame:
    game_id = "ra"
    min_players = 3
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        player_ids = [p["player_id"] for p in players]
        if len(player_ids) not in SUN_DISKS:
            raise ValueError("Ra supports 3 to 5 players")
        start_player = random.choice(player_ids) if player_ids else None
        state_players = {}
        for idx, pid in enumerate(player_ids):
            state_players[pid] = {
                "score": 10,
                "tiles": [],
                "sun_disks": [{"value": value, "ready": True} for value in SUN_DISKS[len(player_ids)][idx]],
            }
        return {
            "players": state_players,
            "turn_order": player_ids,
            "player_meta": {p["player_id"]: p for p in players},
            "epoch": 1,
            "phase": "turn",
            "start_player": start_player,
            "current_turn": start_player,
            "bag": _build_bag(),
            "auction_track": [],
            "ra_track": [],
            "center_disk": 1,
            "ra_holder": start_player,
            "auction": None,
            "pending_disaster": None,
            "next_round_ready": [],
            "last_epoch_summary": None,
            "winner": None,
            "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "turn":
            if player_id != state.get("current_turn"):
                return []
            actions = []
            pdata = state["players"][player_id]
            if len(state.get("auction_track", [])) < 8 and state.get("bag"):
                actions.append("draw_tile")
            if _available_disks(pdata):
                actions.append("invoke_ra")
            if any(tile.get("kind") == "god" for tile in pdata.get("tiles", [])) and any(
                tile.get("kind") != "god" for tile in state.get("auction_track", [])
            ):
                actions.append("play_god")
            return actions
        if phase == "auction":
            if player_id != state.get("current_turn"):
                return []
            auction = state.get("auction") or {}
            current = _current_bid(auction)
            can_bid = any(value > current for value in _available_disks(state["players"][player_id]))
            no_other_bids = not auction.get("bids")
            initiator_must_bid = (
                not auction.get("forced")
                and player_id == auction.get("initiator")
                and auction.get("cursor", 0) == len(auction.get("bid_order", [])) - 1
                and no_other_bids
            )
            actions = ["bid"] if can_bid else []
            if not initiator_must_bid:
                actions.append("pass")
            return actions
        if phase == "disaster":
            pending = state.get("pending_disaster") or {}
            return ["resolve_disaster"] if pending.get("player_id") == player_id else []
        if phase == "epoch_pause":
            return [] if player_id in state.get("next_round_ready", []) else ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        action_type = action.get("type")
        events: List[Dict] = []
        phase = state.get("phase")

        if phase == "turn":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if action_type == "draw_tile":
                if len(state.get("auction_track", [])) >= 8:
                    return [], "auction track is full"
                if not state.get("bag"):
                    return [], "bag empty"
                tile = state["bag"].pop()
                if tile.get("kind") == "ra":
                    state.setdefault("ra_track", []).append(tile)
                    events.append({"type": "ra:draw_ra", "payload": {"player_id": player_id}})
                    if len(state["ra_track"]) >= RA_TRACK_LIMIT.get(len(state.get("turn_order", [])), 8):
                        _end_epoch(state, reason="ra_track_full")
                        return events, None
                    _start_auction(state, player_id, forced=True)
                    return events, None
                state.setdefault("auction_track", []).append(tile)
                events.append({"type": "ra:draw_tile", "payload": {"player_id": player_id, "tile": tile}})
                _advance_turn(state, player_id)
                return events, None

            if action_type == "invoke_ra":
                if not _available_disks(state["players"][player_id]):
                    return [], "no ready sun disk"
                _start_auction(state, player_id, forced=False)
                events.append({"type": "ra:invoke", "payload": {"player_id": player_id}})
                return events, None

            if action_type == "play_god":
                tile_ids = action.get("tile_ids") or []
                if not isinstance(tile_ids, list) or not tile_ids:
                    return [], "choose at least one tile"
                pdata = state["players"][player_id]
                god_tiles = [tile for tile in pdata.get("tiles", []) if tile.get("kind") == "god"]
                if len(tile_ids) > len(god_tiles):
                    return [], "not enough god tiles"
                chosen = _find_tiles_by_ids(state.get("auction_track", []), tile_ids)
                if len(chosen) != len(set(tile_ids)):
                    return [], "unknown auction tile"
                if any(tile.get("kind") == "god" for tile in chosen):
                    return [], "cannot take god tiles with a god"
                spent_ids = {tile["id"] for tile in god_tiles[: len(chosen)]}
                pdata["tiles"] = _remove_tile_ids(pdata.get("tiles", []), spent_ids)
                state["auction_track"] = _remove_tile_ids(state.get("auction_track", []), {tile["id"] for tile in chosen})
                events.append({"type": "ra:play_god", "payload": {"player_id": player_id, "count": len(chosen)}})
                _finish_gain_tiles(state, player_id, chosen, None, player_id)
                return events, None
            return [], "invalid action"

        if phase == "auction":
            auction = state.get("auction") or {}
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if action_type == "bid":
                try:
                    disk = int(action.get("disk"))
                except (TypeError, ValueError):
                    return [], "invalid disk"
                if disk not in _available_disks(state["players"][player_id]):
                    return [], "sun disk is not ready"
                if disk <= _current_bid(auction):
                    return [], "bid must beat current bid"
                auction.setdefault("bids", {})[player_id] = disk
                events.append({"type": "ra:bid", "payload": {"player_id": player_id, "disk": disk}})
            elif action_type == "pass":
                if "pass" not in RaGame.get_legal_actions(state, player_id):
                    return [], "you must bid"
                auction.setdefault("passed", []).append(player_id)
                events.append({"type": "ra:pass", "payload": {"player_id": player_id}})
            else:
                return [], "invalid action"

            auction["cursor"] = int(auction.get("cursor", 0)) + 1
            if auction["cursor"] >= len(auction.get("bid_order", [])):
                _resolve_auction(state)
            else:
                state["current_turn"] = auction["bid_order"][auction["cursor"]]
            return events, None

        if phase == "disaster":
            pending = state.get("pending_disaster") or {}
            if pending.get("player_id") != player_id:
                return [], "not your disaster"
            if action_type != "resolve_disaster":
                return [], "invalid action"
            discard_ids = action.get("tile_ids") or []
            if not isinstance(discard_ids, list):
                return [], "invalid tile list"
            pdata = state["players"][player_id]
            selected = _find_tiles_by_ids(pdata.get("tiles", []), discard_ids)
            if len(selected) != len(set(discard_ids)):
                return [], "unknown tile"
            selected_counts = Counter(tile.get("kind") for tile in selected)
            for disaster, required in (pending.get("requirements") or {}).items():
                targets = DISASTER_TARGETS.get(disaster, set())
                actual = sum(selected_counts[target] for target in targets)
                if actual != required:
                    return [], f"{disaster} requires {required} discard(s)"
            allowed_targets = set()
            for disaster in (pending.get("requirements") or {}):
                allowed_targets.update(DISASTER_TARGETS.get(disaster, set()))
            if any(tile.get("kind") not in allowed_targets for tile in selected):
                return [], "selected tile does not match disaster"
            pdata["tiles"] = _remove_tile_ids(pdata.get("tiles", []), {tile["id"] for tile in selected})
            events.append({"type": "ra:disaster", "payload": {"player_id": player_id, "discarded": len(selected)}})
            _complete_post_gain(state, player_id, pending.get("bid_disk"), pending.get("trigger_player"))
            return events, None

        if phase == "epoch_pause":
            if action_type != "next_round":
                return [], "invalid action"
            ready = state.setdefault("next_round_ready", [])
            if player_id not in ready:
                ready.append(player_id)
            events.append({"type": "ra:next_round", "payload": {"player_id": player_id}})
            if len(ready) >= len(state.get("turn_order", [])):
                _prepare_next_epoch(state)
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = _sorted_player_ids(state)
        players = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"].get(pid, {})
            tiles = list(pdata.get("tiles", []))
            players.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "score": pdata.get("score", 0),
                    "sun_disks": sorted(pdata.get("sun_disks", []), key=lambda disk: disk.get("value", 0)),
                    "tiles": tiles,
                    "tile_counts": dict(_count_kinds(tiles)),
                    "ready_for_next": pid in state.get("next_round_ready", []),
                }
            )
        return {
            "game_id": RaGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "epoch": state.get("epoch"),
            "current_turn": state.get("current_turn"),
            "start_player": state.get("start_player"),
            "ra_holder": state.get("ra_holder"),
            "center_disk": state.get("center_disk"),
            "auction_track": list(state.get("auction_track", [])),
            "auction_limit": 8,
            "ra_track": list(state.get("ra_track", [])),
            "ra_limit": RA_TRACK_LIMIT.get(len(state.get("turn_order", [])), 8),
            "bag_count": len(state.get("bag", [])),
            "auction": state.get("auction"),
            "pending_disaster": state.get("pending_disaster"),
            "players": players,
            "legal_actions": RaGame.get_legal_actions(state, viewer_id),
            "last_epoch_summary": state.get("last_epoch_summary"),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        actions = RaGame.get_legal_actions(state, bot_id)
        if not actions:
            return None
        if "resolve_disaster" in actions:
            pending = state.get("pending_disaster") or {}
            pdata = state["players"][bot_id]
            chosen = []
            for disaster, required in (pending.get("requirements") or {}).items():
                targets = DISASTER_TARGETS.get(disaster, set())
                for tile in pdata.get("tiles", []):
                    if tile.get("kind") in targets and tile.get("id") not in chosen and len([x for x in chosen if x]) < 99:
                        chosen.append(tile["id"])
                        if sum(1 for tid in chosen if any(t["id"] == tid and t["kind"] in targets for t in pdata.get("tiles", []))) >= required:
                            break
            return {"type": "resolve_disaster", "tile_ids": chosen}
        if "next_round" in actions:
            return {"type": "next_round", "delay_ms": 300}
        if state.get("phase") == "auction":
            current = _current_bid(state.get("auction") or {})
            options = [value for value in _available_disks(state["players"][bot_id]) if value > current]
            if options and ("pass" not in actions or random.random() < 0.35):
                return {"type": "bid", "disk": min(options)}
            return {"type": "pass"}
        if "play_god" in actions and random.random() < 0.2:
            targets = [tile["id"] for tile in state.get("auction_track", []) if tile.get("kind") != "god"]
            if targets:
                return {"type": "play_god", "tile_ids": [targets[0]]}
        if "draw_tile" in actions and len(state.get("auction_track", [])) < 7:
            return {"type": "draw_tile"}
        if "invoke_ra" in actions:
            return {"type": "invoke_ra"}
        return {"type": "draw_tile"} if "draw_tile" in actions else None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
