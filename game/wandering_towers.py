import random
from typing import Dict, List, Optional, Tuple

BOARD_SIZE = 16
TOWER_COUNT = 9

DEFAULT_CONFIG: Dict = {}

DEFAULT_DECK_COUNTS = [
    {"target": "wizard", "value": 1, "count": 6},
    {"target": "wizard", "value": 2, "count": 6},
    {"target": "wizard", "value": 3, "count": 5},
    {"target": "wizard", "value": 4, "count": 4},
    {"target": "wizard", "value": 5, "count": 3},
    {"target": "tower", "value": 1, "count": 6},
    {"target": "tower", "value": 2, "count": 6},
    {"target": "tower", "value": 3, "count": 5},
    {"target": "tower", "value": 4, "count": 4},
    {"target": "tower", "value": 5, "count": 3},
    {"target": "either", "value": 1, "count": 6},
    {"target": "either", "value": 2, "count": 6},
    {"target": "either", "value": 3, "count": 5},
    {"target": "either", "value": 4, "count": 4},
    {"target": "either", "value": 5, "count": 3},
    {"target": "wizard", "dice": 1, "count": 3},
    {"target": "wizard", "dice": 2, "count": 2},
    {"target": "wizard", "dice": 3, "count": 1},
    {"target": "tower", "dice": 1, "count": 3},
    {"target": "tower", "dice": 2, "count": 2},
    {"target": "tower", "dice": 3, "count": 1},
    {"target": "either", "dice": 1, "count": 3},
    {"target": "either", "dice": 2, "count": 2},
    {"target": "either", "dice": 3, "count": 1},
]

SPELLS = {
    "move_wizard": {"cost": 2, "target": "wizard", "steps": 1},
    "move_tower": {"cost": 1, "target": "tower", "steps": 2},
}

PLAYER_SETUP = {
    1: {"wizards": 12, "potions": 6, "cards_per_turn": 1},
    2: {"wizards": 5, "potions": 6, "cards_per_turn": 2},
    3: {"wizards": 4, "potions": 5, "cards_per_turn": 2},
    4: {"wizards": 4, "potions": 5, "cards_per_turn": 2},
    5: {"wizards": 3, "potions": 4, "cards_per_turn": 2},
    6: {"wizards": 3, "potions": 4, "cards_per_turn": 2},
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _build_deck(cfg: Dict) -> List[Dict]:
    raw_counts = cfg.get("deck_counts") if isinstance(cfg, dict) else None
    counts = DEFAULT_DECK_COUNTS
    if isinstance(raw_counts, list) and raw_counts:
        counts = raw_counts

    deck: List[Dict] = []
    card_id = 1
    for entry in counts:
        if not isinstance(entry, dict):
            continue
        target = entry.get("target")
        if target not in ("wizard", "tower", "either"):
            continue
        count = entry.get("count")
        try:
            count = int(count)
        except (TypeError, ValueError):
            continue
        if count <= 0:
            continue
        value = entry.get("value")
        dice = entry.get("dice")
        if value is not None:
            try:
                value = int(value)
            except (TypeError, ValueError):
                value = None
        if dice is not None:
            try:
                dice = int(dice)
            except (TypeError, ValueError):
                dice = None
        if value is None and dice is None:
            continue
        if value is not None and value <= 0:
            continue
        if dice is not None and dice <= 0:
            continue
        for _ in range(count):
            deck.append(
                {
                    "id": f"c{card_id}",
                    "target": target,
                    "value": value,
                    "dice": dice or 0,
                }
            )
            card_id += 1
    random.shuffle(deck)
    return deck


def _ghost_lights() -> List[int]:
    lights = [0] * BOARD_SIZE
    for idx in range(1, 4):
        lights[idx] = 3
    for idx in range(4, 7):
        lights[idx] = 2
    for idx in range(7, 10):
        lights[idx] = 1
    return lights


def _next_player(state: Dict, current: str) -> str:
    order = state["turn_order"]
    if current not in order:
        return order[0]
    idx = order.index(current)
    return order[(idx + 1) % len(order)]


def _player_to_right(state: Dict, player_id: str) -> str:
    order = state["turn_order"]
    if player_id not in order:
        return order[-1]
    idx = order.index(player_id)
    return order[(idx - 1) % len(order)]


def _reshape_deck_if_needed(state: Dict) -> bool:
    if state["deck"]:
        return True
    if not state["discard"]:
        return False
    state["deck"] = state["discard"]
    state["discard"] = []
    random.shuffle(state["deck"])
    return True


def _draw_to_hand(state: Dict, player_id: str, target: int = 3) -> None:
    pdata = state["players"][player_id]
    while len(pdata["hand"]) < target:
        if not _reshape_deck_if_needed(state):
            return
        if not state["deck"]:
            return
        pdata["hand"].append(state["deck"].pop())


def _find_wizard(state: Dict, wizard_id: str) -> Optional[Tuple[int, int]]:
    for idx, cell in enumerate(state["board"]):
        for layer_idx, layer in enumerate(cell):
            if layer["type"] == "wizards" and wizard_id in layer["wizard_ids"]:
                return idx, layer_idx
    return None


def _tower_positions(state: Dict) -> Dict[str, Tuple[int, int]]:
    positions: Dict[str, Tuple[int, int]] = {}
    for idx, cell in enumerate(state["board"]):
        for layer_idx, layer in enumerate(cell):
            if layer["type"] == "tower":
                positions[layer["tower_id"]] = (idx, layer_idx)
    return positions


def _visible_wizards(state: Dict) -> Dict[str, int]:
    visible: Dict[str, int] = {}
    for idx, cell in enumerate(state["board"]):
        if cell and cell[-1]["type"] == "wizards":
            for wid in cell[-1]["wizard_ids"]:
                visible[wid] = idx
    return visible


def _cell_has_any_wizards(cell: List[Dict]) -> bool:
    for layer in cell:
        if layer["type"] == "wizards" and layer["wizard_ids"]:
            return True
    return False


def _top_tower_layer(cell: List[Dict]) -> Optional[Dict]:
    for layer in reversed(cell):
        if layer["type"] == "tower":
            return layer
    return None


def _wizard_capacity_ok(cell: List[Dict]) -> bool:
    if not cell:
        return True
    top = cell[-1]
    if top["type"] != "wizards":
        return True
    return len(top["wizard_ids"]) < 6


def _move_wizard(state: Dict, wizard_id: str, steps: int) -> Tuple[bool, Optional[int]]:
    location = _find_wizard(state, wizard_id)
    if location is None:
        return False, None
    src_idx, layer_idx = location
    dest_idx = (src_idx + steps) % BOARD_SIZE
    if dest_idx == state["ravenskeep_pos"]:
        layer = state["board"][src_idx][layer_idx]
        layer["wizard_ids"].remove(wizard_id)
        if not layer["wizard_ids"]:
            state["board"][src_idx].pop(layer_idx)
        state["wizards"][wizard_id]["status"] = "ravenskeep"
        return True, dest_idx
    dest_cell = state["board"][dest_idx]
    if not _wizard_capacity_ok(dest_cell):
        return False, None
    src_layer = state["board"][src_idx][layer_idx]
    src_layer["wizard_ids"].remove(wizard_id)
    if not src_layer["wizard_ids"]:
        state["board"][src_idx].pop(layer_idx)
    if dest_cell and dest_cell[-1]["type"] == "wizards":
        dest_cell[-1]["wizard_ids"].append(wizard_id)
    else:
        dest_cell.append({"type": "wizards", "wizard_ids": [wizard_id]})
    return True, dest_idx


def _move_tower(state: Dict, tower_id: str, steps: int) -> Optional[bool]:
    positions = _tower_positions(state)
    if tower_id not in positions:
        return None
    src_idx, layer_idx = positions[tower_id]
    dest_idx = (src_idx + steps) % BOARD_SIZE
    if dest_idx == state["ravenskeep_pos"]:
        return None
    src_cell = state["board"][src_idx]
    moving_stack = src_cell[layer_idx:]
    state["board"][src_idx] = src_cell[:layer_idx]
    dest_cell = state["board"][dest_idx]
    covered = bool(dest_cell) and dest_cell[-1]["type"] == "wizards"
    dest_cell.extend(moving_stack)
    if any(layer["type"] == "ravenskeep" for layer in moving_stack):
        state["ravenskeep_pos"] = dest_idx
    return covered


def _remove_ravenskeep(state: Dict) -> None:
    pos = state["ravenskeep_pos"]
    cell = state["board"][pos]
    for idx in range(len(cell) - 1, -1, -1):
        if cell[idx]["type"] == "ravenskeep":
            cell.pop(idx)
            break


def _place_ravenskeep(state: Dict, pos: int) -> None:
    state["board"][pos].append({"type": "ravenskeep"})
    state["ravenskeep_pos"] = pos


def _move_ravenskeep(state: Dict) -> None:
    start = state["ravenskeep_pos"]
    _remove_ravenskeep(state)
    for offset in range(1, BOARD_SIZE + 1):
        idx = (start + offset) % BOARD_SIZE
        cell = state["board"][idx]
        if _cell_has_any_wizards(cell):
            continue
        if not cell:
            _place_ravenskeep(state, idx)
            return
        top_tower = _top_tower_layer(cell)
        if top_tower and state["towers"][top_tower["tower_id"]]["has_shield"]:
            _place_ravenskeep(state, idx)
            return
    _place_ravenskeep(state, start)


def _player_meets_goal(state: Dict, player_id: str) -> bool:
    pdata = state["players"][player_id]
    for wid in pdata["wizard_ids"]:
        if state["wizards"][wid]["status"] != "ravenskeep":
            return False
    return pdata["potions"]["empty"] == 0


def _assign_winners(state: Dict) -> None:
    candidates = [pid for pid in state["turn_order"] if _player_meets_goal(state, pid)]
    if not candidates:
        state["winner"] = []
        return
    full_counts = {pid: state["players"][pid]["potions"]["full"] for pid in candidates}
    max_full = max(full_counts.values())
    winners = [pid for pid, count in full_counts.items() if count == max_full]
    state["winner"] = winners


def _end_game(state: Dict) -> None:
    state["game_over"] = True
    state["phase"] = "game_over"
    if len(state["turn_order"]) == 1:
        pid = state["turn_order"][0]
        if _player_meets_goal(state, pid):
            score = len(state["discard"])
            state["solo_score"] = score
            state["solo_result"] = "success" if score < 30 else "complete"
            state["winner"] = [pid]
        else:
            state["solo_score"] = len(state["discard"])
            state["solo_result"] = "fail"
            state["winner"] = []
        return
    _assign_winners(state)


def _check_end_trigger(state: Dict, player_id: str) -> None:
    if state.get("final_round"):
        return
    if not _player_meets_goal(state, player_id):
        return
    state["final_round"] = True
    state["final_round_end_player"] = _player_to_right(state, state["start_player"])


def _end_turn(state: Dict, player_id: str) -> None:
    _draw_to_hand(state, player_id)
    if len(state["turn_order"]) == 1:
        if _player_meets_goal(state, player_id):
            _end_game(state)
            return
        if not state["deck"] and not state["discard"]:
            _end_game(state)
            return
    else:
        _check_end_trigger(state, player_id)
        if state.get("final_round") and player_id == state.get("final_round_end_player"):
            _end_game(state)
            return
    state["current_player"] = _next_player(state, player_id)
    state["cards_played"] = 0
    state["pending"] = None


def _legal_wizard_targets(state: Dict, player_id: Optional[str], steps: int, any_owner: bool) -> List[str]:
    visible = _visible_wizards(state)
    result: List[str] = []
    for wid, pos in visible.items():
        owner = state["wizards"][wid]["owner"]
        if not any_owner and owner != player_id:
            continue
        dest = (pos + steps) % BOARD_SIZE
        if dest == state["ravenskeep_pos"]:
            result.append(wid)
            continue
        if _wizard_capacity_ok(state["board"][dest]):
            result.append(wid)
    return result


def _legal_tower_targets(state: Dict, steps: int) -> List[str]:
    positions = _tower_positions(state)
    legal = []
    for tid, (pos, _depth) in positions.items():
        dest = (pos + steps) % BOARD_SIZE
        if dest == state["ravenskeep_pos"]:
            continue
        legal.append(tid)
    return legal


def _legal_targets_for_card(state: Dict, player_id: str, card: Dict, steps: int) -> Dict[str, List[str]]:
    targets: Dict[str, List[str]] = {}
    if card["target"] in ("wizard", "either"):
        targets["wizard"] = _legal_wizard_targets(state, player_id, steps, any_owner=False)
    if card["target"] in ("tower", "either"):
        targets["tower"] = _legal_tower_targets(state, steps)
    return targets


def _legal_targets_for_spell(state: Dict, spell_id: str) -> Dict[str, List[str]]:
    spell = SPELLS[spell_id]
    if spell["target"] == "wizard":
        return {"wizard": _legal_wizard_targets(state, None, spell["steps"], any_owner=True)}
    return {"tower": _legal_tower_targets(state, spell["steps"])}


class WanderingTowersGame:
    game_id = "wandering_towers"
    min_players = 1
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        start_player = player_ids[0] if player_ids else None
        if player_ids:
            start_player = random.choice(player_ids)

        setup = PLAYER_SETUP.get(len(player_ids), PLAYER_SETUP[2])
        cards_per_turn = setup["cards_per_turn"]

        board: List[List[Dict]] = [[] for _ in range(BOARD_SIZE)]
        towers: Dict[str, Dict] = {}
        for idx in range(1, TOWER_COUNT + 1):
            tower_id = f"T{idx}"
            has_shield = idx % 2 == 1
            towers[tower_id] = {"has_shield": has_shield}
            board[idx].append({"type": "tower", "tower_id": tower_id})

        board[0].append({"type": "ravenskeep"})

        state_players: Dict[str, Dict] = {}
        wizards: Dict[str, Dict] = {}
        for pid in player_ids:
            wizard_ids = [f"{pid}_w{idx + 1}" for idx in range(setup["wizards"])]
            for wid in wizard_ids:
                wizards[wid] = {"owner": pid, "status": "board"}
            state_players[pid] = {
                "hand": [],
                "wizard_ids": wizard_ids,
                "potions": {"empty": setup["potions"], "full": 0, "spent": 0},
            }

        ghost_lights = _ghost_lights()
        placement_order = list(player_ids)
        if start_player in placement_order:
            start_idx = placement_order.index(start_player)
            placement_order = placement_order[start_idx:] + placement_order[:start_idx]

        tower_idx = 1
        placement_queues = {pid: list(state_players[pid]["wizard_ids"]) for pid in placement_order}
        remaining = True
        while remaining:
            remaining = False
            for pid in placement_order:
                queue = placement_queues.get(pid, [])
                if not queue:
                    continue
                wid = queue.pop(0)
                remaining = True
                while tower_idx <= TOWER_COUNT:
                    cap = ghost_lights[tower_idx]
                    cell = board[tower_idx]
                    current = 0
                    if cell and cell[-1]["type"] == "wizards":
                        current = len(cell[-1]["wizard_ids"])
                    if current < cap:
                        if cell and cell[-1]["type"] == "wizards":
                            cell[-1]["wizard_ids"].append(wid)
                        else:
                            cell.append({"type": "wizards", "wizard_ids": [wid]})
                        break
                    tower_idx += 1

        deck = _build_deck(cfg)
        discard: List[Dict] = []
        for pid in player_ids:
            for _ in range(3):
                if not deck:
                    break
                state_players[pid]["hand"].append(deck.pop())

        return {
            "config": cfg,
            "players": state_players,
            "player_meta": player_meta,
            "wizards": wizards,
            "towers": towers,
            "board": board,
            "ravenskeep_pos": 0,
            "deck": deck,
            "discard": discard,
            "turn_order": player_ids,
            "current_player": start_player,
            "start_player": start_player,
            "cards_played": 0,
            "cards_per_turn": cards_per_turn,
            "pending": None,
            "final_round": False,
            "final_round_end_player": None,
            "phase": "turn",
            "winner": [],
            "game_over": False,
            "solo_score": None,
            "solo_result": None,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_player"):
            return []
        pending = state.get("pending")
        actions: List[str] = []
        if pending:
            if pending.get("stage") == "dice":
                if pending.get("rerolls_left", 0) > 0:
                    actions.append("reroll_dice")
                legal = pending.get("legal_targets", {})
                if legal.get("wizard") or legal.get("tower"):
                    actions.append("choose_target")
                else:
                    actions.append("accept_roll")
            else:
                actions.append("choose_target")
            return actions

        cards_played = state.get("cards_played", 0)
        if cards_played < state.get("cards_per_turn", 2):
            if state["players"][player_id]["hand"]:
                actions.append("play_card")
                if cards_played == 0:
                    actions.append("discard_move")

        for spell_id, spell in SPELLS.items():
            if state["players"][player_id]["potions"]["full"] >= spell["cost"]:
                targets = _legal_targets_for_spell(state, spell_id)
                if any(targets.values()):
                    actions.append("cast_spell")
                    break
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if player_id != state.get("current_player"):
            return [], "not your turn"

        events: List[Dict] = []
        action_type = action.get("type")
        pending = state.get("pending")

        if pending:
            if action_type == "reroll_dice":
                if pending.get("stage") != "dice":
                    return [], "no dice to reroll"
                if pending.get("rerolls_left", 0) <= 0:
                    return [], "no rerolls left"
                roll = random.randint(1, 6)
                pending["roll"] = roll
                pending["steps"] = roll
                pending["rerolls_left"] = pending.get("rerolls_left", 0) - 1
                legal = _legal_targets_for_card(state, player_id, pending["card"], roll)
                pending["legal_targets"] = legal
                events.append({"type": "wandering_towers:reroll", "payload": {"roll": roll}})
                if not legal.get("wizard") and not legal.get("tower") and pending["rerolls_left"] <= 0:
                    state["pending"] = None
                    events.append({"type": "wandering_towers:fizzle", "payload": {"reason": "no_targets"}})
                    if state.get("cards_played", 0) >= state.get("cards_per_turn", 2):
                        _end_turn(state, player_id)
                return events, None

            if action_type == "accept_roll":
                if pending.get("stage") != "dice":
                    return [], "no pending roll"
                legal = pending.get("legal_targets", {})
                if legal.get("wizard") or legal.get("tower"):
                    return [], "targets available"
                state["pending"] = None
                events.append({"type": "wandering_towers:fizzle", "payload": {"reason": "no_targets"}})
                if state.get("cards_played", 0) >= state.get("cards_per_turn", 2):
                    _end_turn(state, player_id)
                return events, None

            if action_type == "choose_target":
                target_type = action.get("target_type")
                target_id = action.get("target_id")
                card = pending.get("card")
                if not card:
                    return [], "missing card"
                if card["target"] != "either" and target_type != card["target"]:
                    return [], "invalid target_type"
                steps = pending.get("steps")
                if not isinstance(steps, int) or steps <= 0:
                    return [], "invalid steps"
                legal_targets = pending.get("legal_targets") or _legal_targets_for_card(state, player_id, card, steps)
                if target_type == "wizard":
                    if target_id not in legal_targets.get("wizard", []):
                        return [], "illegal wizard"
                    moved, _dest = _move_wizard(state, target_id, steps)
                    if not moved:
                        return [], "move failed"
                    events.append({"type": "wandering_towers:move_wizard", "payload": {"wizard_id": target_id, "steps": steps}})
                    state["pending"] = None
                    if state["wizards"][target_id]["status"] == "ravenskeep":
                        _move_ravenskeep(state)
                        events.append({"type": "wandering_towers:ravenskeep_move"})
                        _end_turn(state, player_id)
                        return events, None
                elif target_type == "tower":
                    if target_id not in legal_targets.get("tower", []):
                        return [], "illegal tower"
                    covered = _move_tower(state, target_id, steps)
                    if covered is None:
                        return [], "move failed"
                    if covered:
                        pdata = state["players"][player_id]
                        if pdata["potions"]["empty"] > 0:
                            pdata["potions"]["empty"] -= 1
                            pdata["potions"]["full"] += 1
                            events.append({"type": "wandering_towers:fill_potion", "payload": {"player_id": player_id}})
                    events.append({"type": "wandering_towers:move_tower", "payload": {"tower_id": target_id, "steps": steps}})
                    state["pending"] = None
                else:
                    return [], "unknown target_type"

                if not state.get("game_over") and state.get("pending") is None:
                    if state.get("cards_played", 0) >= state.get("cards_per_turn", 2):
                        _end_turn(state, player_id)
                return events, None

            return [], "invalid pending action"

        if action_type == "play_card":
            if state.get("cards_played", 0) >= state.get("cards_per_turn", 2):
                return [], "no cards left"
            hand = state["players"][player_id]["hand"]
            card_index = action.get("card_index")
            try:
                card_index = int(card_index)
            except (TypeError, ValueError):
                return [], "invalid card_index"
            if card_index < 0 or card_index >= len(hand):
                return [], "card_index out of range"
            card = hand.pop(card_index)
            state["discard"].append(card)
            state["cards_played"] = state.get("cards_played", 0) + 1
            events.append({"type": "wandering_towers:play_card", "payload": {"player_id": player_id}})

            if card.get("dice"):
                roll = random.randint(1, 6)
                legal = _legal_targets_for_card(state, player_id, card, roll)
                pending = {
                    "stage": "dice",
                    "card": card,
                    "roll": roll,
                    "steps": roll,
                    "rerolls_left": int(card.get("dice", 0)) - 1,
                    "legal_targets": legal,
                }
                if not legal.get("wizard") and not legal.get("tower") and pending["rerolls_left"] <= 0:
                    events.append({"type": "wandering_towers:fizzle", "payload": {"reason": "no_targets"}})
                    if state.get("cards_played", 0) >= state.get("cards_per_turn", 2):
                        _end_turn(state, player_id)
                else:
                    state["pending"] = pending
                    events.append({"type": "wandering_towers:roll", "payload": {"roll": roll}})
                return events, None

            steps = card.get("value")
            if not isinstance(steps, int) or steps <= 0:
                events.append({"type": "wandering_towers:fizzle", "payload": {"reason": "invalid_card"}})
                if state.get("cards_played", 0) >= state.get("cards_per_turn", 2):
                    _end_turn(state, player_id)
                return events, None
            legal = _legal_targets_for_card(state, player_id, card, steps)
            if not legal.get("wizard") and not legal.get("tower"):
                events.append({"type": "wandering_towers:fizzle", "payload": {"reason": "no_targets"}})
                if state.get("cards_played", 0) >= state.get("cards_per_turn", 2):
                    _end_turn(state, player_id)
                return events, None
            state["pending"] = {
                "stage": "target",
                "card": card,
                "steps": steps,
                "legal_targets": legal,
            }
            return events, None

        if action_type == "discard_move":
            if state.get("cards_played", 0) != 0:
                return [], "cannot discard after playing"
            tower_id = action.get("tower_id")
            if not isinstance(tower_id, str):
                return [], "invalid tower_id"
            hand = state["players"][player_id]["hand"]
            if hand:
                state["discard"].extend(hand)
                state["players"][player_id]["hand"] = []
            covered = _move_tower(state, tower_id, 1)
            if covered is None:
                return [], "illegal tower move"
            if covered:
                pdata = state["players"][player_id]
                if pdata["potions"]["empty"] > 0:
                    pdata["potions"]["empty"] -= 1
                    pdata["potions"]["full"] += 1
                    events.append({"type": "wandering_towers:fill_potion", "payload": {"player_id": player_id}})
            events.append({"type": "wandering_towers:discard_move", "payload": {"tower_id": tower_id}})
            _end_turn(state, player_id)
            return events, None

        if action_type == "cast_spell":
            spell_id = action.get("spell")
            if spell_id not in SPELLS:
                return [], "invalid spell"
            spell = SPELLS[spell_id]
            pdata = state["players"][player_id]
            if pdata["potions"]["full"] < spell["cost"]:
                return [], "not enough potions"
            target_id = action.get("target_id")
            if not isinstance(target_id, str):
                return [], "invalid target"
            targets = _legal_targets_for_spell(state, spell_id)
            if spell["target"] == "wizard":
                if target_id not in targets.get("wizard", []):
                    return [], "illegal wizard"
                moved, _dest = _move_wizard(state, target_id, spell["steps"])
                if not moved:
                    return [], "move failed"
                events.append({"type": "wandering_towers:spell", "payload": {"spell": spell_id, "target_id": target_id}})
                pdata["potions"]["full"] -= spell["cost"]
                pdata["potions"]["spent"] += spell["cost"]
                if state["wizards"][target_id]["status"] == "ravenskeep":
                    _move_ravenskeep(state)
                    events.append({"type": "wandering_towers:ravenskeep_move"})
                    _end_turn(state, player_id)
                return events, None
            if target_id not in targets.get("tower", []):
                return [], "illegal tower"
            covered = _move_tower(state, target_id, spell["steps"])
            if covered is None:
                return [], "move failed"
            events.append({"type": "wandering_towers:spell", "payload": {"spell": spell_id, "target_id": target_id}})
            pdata["potions"]["full"] -= spell["cost"]
            pdata["potions"]["spent"] += spell["cost"]
            if covered:
                if pdata["potions"]["empty"] > 0:
                    pdata["potions"]["empty"] -= 1
                    pdata["potions"]["full"] += 1
                    events.append({"type": "wandering_towers:fill_potion", "payload": {"player_id": player_id}})
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(
            state["player_meta"].keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            in_ravenskeep = 0
            for wid in pdata["wizard_ids"]:
                if state["wizards"][wid]["status"] == "ravenskeep":
                    in_ravenskeep += 1
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "hand_count": len(pdata["hand"]),
                    "potions": dict(pdata["potions"]),
                    "wizards_total": len(pdata["wizard_ids"]),
                    "wizards_in_ravenskeep": in_ravenskeep,
                }
            )

        visible = _visible_wizards(state)
        wizards_view = []
        for wid, wdata in state["wizards"].items():
            pos = visible.get(wid)
            wizards_view.append(
                {
                    "wizard_id": wid,
                    "owner_id": wdata["owner"],
                    "position": pos,
                    "visible": pos is not None,
                    "in_ravenskeep": wdata["status"] == "ravenskeep",
                }
            )

        towers_view = []
        positions = _tower_positions(state)
        for tid, tdata in state["towers"].items():
            pos = positions.get(tid)
            if pos:
                towers_view.append(
                    {
                        "tower_id": tid,
                        "position": pos[0],
                        "depth": pos[1],
                        "has_shield": tdata["has_shield"],
                    }
                )

        cells = []
        for idx, cell in enumerate(state["board"]):
            layers = []
            for layer in cell:
                if layer["type"] == "tower":
                    tdata = state["towers"][layer["tower_id"]]
                    layers.append(
                        {
                            "type": "tower",
                            "tower_id": layer["tower_id"],
                            "has_shield": tdata["has_shield"],
                        }
                    )
                elif layer["type"] == "wizards":
                    entries = []
                    for wid in layer["wizard_ids"]:
                        entries.append(
                            {
                                "wizard_id": wid,
                                "owner_id": state["wizards"][wid]["owner"],
                            }
                        )
                    layers.append({"type": "wizards", "wizards": entries})
                elif layer["type"] == "ravenskeep":
                    layers.append({"type": "ravenskeep"})
            cells.append({"index": idx, "layers": layers})

        pending_view = None
        pending = state.get("pending")
        if pending:
            pending_view = {
                "stage": pending.get("stage"),
                "card": {
                    "target": pending["card"]["target"],
                    "value": pending["card"].get("value"),
                    "dice": pending["card"].get("dice", 0),
                },
                "steps": pending.get("steps"),
                "roll": pending.get("roll"),
                "rerolls_left": pending.get("rerolls_left"),
                "legal_targets": pending.get("legal_targets", {}),
            }

        spell_targets = {}
        if viewer_id == state.get("current_player") and not state.get("pending"):
            for spell_id, spell in SPELLS.items():
                if state["players"][viewer_id]["potions"]["full"] >= spell["cost"]:
                    spell_targets[spell_id] = _legal_targets_for_spell(state, spell_id)

        return {
            "game_id": WanderingTowersGame.game_id,
            "you": viewer_id,
            "current_player": state.get("current_player"),
            "cards_played": state.get("cards_played", 0),
            "cards_per_turn": state.get("cards_per_turn", 2),
            "deck_count": len(state.get("deck", [])),
            "discard_count": len(state.get("discard", [])),
            "hand": state["players"].get(viewer_id, {}).get("hand", []),
            "players": players_view,
            "board": cells,
            "ravenskeep_pos": state.get("ravenskeep_pos"),
            "wizards": wizards_view,
            "towers": towers_view,
            "pending": pending_view,
            "legal_actions": WanderingTowersGame.get_legal_actions(state, viewer_id),
            "spell_targets": spell_targets,
            "final_round": state.get("final_round", False),
            "final_round_end_player": state.get("final_round_end_player"),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "solo_score": state.get("solo_score"),
            "solo_result": state.get("solo_result"),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        if bot_id != state.get("current_player"):
            return None

        pending = state.get("pending")
        if pending:
            stage = pending.get("stage")
            legal = pending.get("legal_targets", {}) or {}
            wizard_targets = list(legal.get("wizard") or [])
            tower_targets = list(legal.get("tower") or [])
            has_targets = bool(wizard_targets or tower_targets)
            if stage == "dice":
                rerolls_left = int(pending.get("rerolls_left") or 0)
                if has_targets:
                    if wizard_targets and tower_targets:
                        if random.random() < 0.6:
                            return {
                                "type": "choose_target",
                                "target_type": "wizard",
                                "target_id": random.choice(wizard_targets),
                            }
                        return {
                            "type": "choose_target",
                            "target_type": "tower",
                            "target_id": random.choice(tower_targets),
                        }
                    if wizard_targets:
                        return {
                            "type": "choose_target",
                            "target_type": "wizard",
                            "target_id": random.choice(wizard_targets),
                        }
                    return {
                        "type": "choose_target",
                        "target_type": "tower",
                        "target_id": random.choice(tower_targets),
                    }
                if rerolls_left > 0:
                    return {"type": "reroll_dice"}
                return {"type": "accept_roll"}
            if stage == "target":
                if wizard_targets and tower_targets:
                    if random.random() < 0.6:
                        return {
                            "type": "choose_target",
                            "target_type": "wizard",
                            "target_id": random.choice(wizard_targets),
                        }
                    return {
                        "type": "choose_target",
                        "target_type": "tower",
                        "target_id": random.choice(tower_targets),
                    }
                if wizard_targets:
                    return {
                        "type": "choose_target",
                        "target_type": "wizard",
                        "target_id": random.choice(wizard_targets),
                    }
                if tower_targets:
                    return {
                        "type": "choose_target",
                        "target_type": "tower",
                        "target_id": random.choice(tower_targets),
                    }
            return None

        legal_actions = WanderingTowersGame.get_legal_actions(state, bot_id)
        if "play_card" in legal_actions:
            hand = state["players"][bot_id].get("hand", [])
            if hand:
                return {"type": "play_card", "card_index": random.randrange(len(hand))}

        if "discard_move" in legal_actions:
            towers = _legal_tower_targets(state, 1)
            if towers:
                return {"type": "discard_move", "tower_id": random.choice(towers)}

        if "cast_spell" in legal_actions:
            for spell_id in SPELLS.keys():
                targets = _legal_targets_for_spell(state, spell_id)
                if spell_id == "move_wizard" and targets.get("wizard"):
                    return {
                        "type": "cast_spell",
                        "spell": spell_id,
                        "target_id": random.choice(targets["wizard"]),
                    }
                if spell_id == "move_tower" and targets.get("tower"):
                    return {
                        "type": "cast_spell",
                        "spell": spell_id,
                        "target_id": random.choice(targets["tower"]),
                    }

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
