from typing import Dict, Optional

from game.marrakech import DIE_FACES, MarrakechGame, advance_assam, connected_area, legal_placements


def _expected_payment(state: Dict, player_id: str, direction: int) -> float:
    total = 0.0
    for steps in DIE_FACES:
        destination, _ = advance_assam({**state["assam"], "direction": direction}, steps)
        tile = state["board"][destination["y"]][destination["x"]]
        if tile and tile["owner"] != player_id and not state["players"][tile["owner"]]["eliminated"]:
            due = len(connected_area(state, destination["x"], destination["y"]))
            total += min(state["players"][player_id]["coins"], due) * 2
            if due > state["players"][player_id]["coins"]:
                total += 100
    return total / len(DIE_FACES)


def choose_move(state: Dict, player_id: str) -> Optional[Dict]:
    actions = MarrakechGame.get_legal_actions(state, player_id)
    if not actions:
        return None
    if actions == ["roll"]:
        return {"type": "roll"}
    if actions == ["orient"]:
        directions = [direction for direction in range(4) if direction != (state["assam"]["direction"] + 2) % 4]
        direction = min(directions, key=lambda candidate: _expected_payment(state, player_id, candidate))
        return {"type": "orient", "direction": direction}
    placements = legal_placements(state)
    color = state["players"][player_id]["rugs"][0]
    next_player = next((
        state["turn_order"][(state["turn_order"].index(player_id) + offset) % len(state["turn_order"])]
        for offset in range(1, len(state["turn_order"]))
        if not state["players"][state["turn_order"][(state["turn_order"].index(player_id) + offset) % len(state["turn_order"])]]["eliminated"]
    ), player_id)

    def evaluate(cells: list) -> float:
        saved = [state["board"][row][column] for column, row in cells]
        value = sum(1 if not tile else 2 if tile["owner"] != player_id else 0 for tile in saved)
        try:
            for column, row in cells:
                state["board"][row][column] = {"owner": player_id, "color": color, "rug_id": state["next_rug_id"]}
            directions = [direction for direction in range(4) if direction != (state["assam"]["direction"] + 2) % 4]
            threat = min(_expected_payment(state, next_player, direction) for direction in directions)
            area = max(len(connected_area(state, column, row)) for column, row in cells)
            return value + 0.45 * threat + 0.12 * area
        finally:
            for (column, row), tile in zip(cells, saved):
                state["board"][row][column] = tile

    return {"type": "place", "cells": max(placements, key=evaluate)} if placements else None
