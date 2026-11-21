from typing import Dict, Optional

from game.thats_life import score_tiles


def choose_action(view: Dict) -> Optional[Dict]:
    actions = view["legal_actions"]
    if not actions:
        return None
    if "move" not in actions:
        return {"type": actions[0]}
    own = next(player for player in view["players"] if player["player_id"] == view["you"])
    tiles = {tile["id"]: tile for tile in view["track"]}
    pieces = {piece["id"]: piece for piece in view["pieces"]}
    positions = {tile["id"]: index for index, tile in enumerate(view["track"])}

    def utility(option: Dict) -> float:
        piece = pieces[option["piece_id"]]
        collected = option["collect"]
        value = 0.0
        if collected:
            value += 3 * (score_tiles(own["tiles"] + [collected])["score"] - own["score"])
            if collected["kind"] == "lucky":
                value += 8
        destination = tiles[option["to"]]
        occupants = [other for other in pieces.values() if other["position"] == option["to"]]
        if piece["kind"] == "pawn":
            prospective = score_tiles(own["tiles"] + [destination])["score"] - own["score"]
            value += (5 if destination["kind"] == "lucky" else prospective) * (0.4 if occupants else 0.8)
            value -= 0.025 * positions[option["to"]]
            if destination["kind"] == "finish":
                value -= 2 if any(tile["value"] > 0 or tile["kind"] == "lucky" for tile in tiles.values()) else -2
        else:
            origin = tiles[option["from"]]
            owners = [other["owner"] for other in pieces.values()
                      if other["position"] == origin["id"] and other["kind"] == "pawn"]
            worth = 5 if origin["kind"] == "lucky" else origin["value"]
            value += worth * (0.8 if owners and all(owner == view["you"] for owner in owners) else -0.7)
            if any(other["owner"] == view["you"] for other in occupants):
                value += 1 if destination["value"] < 0 else -1
        return value

    best = max(view["move_options"], key=utility)
    return {"type": "move", "piece_id": best["piece_id"]}
