"""A small practice policy which receives only the player's public view."""

from typing import Dict, Optional

from game.skull_king import resolve_trick


def _strength(card: Dict, mode: Optional[str] = None) -> float:
    kind = mode if card["kind"] == "tigress" else card["kind"]
    if kind == "number":
        return card["rank"] / 14 + (1.0 if card["suit"] == "black" else 0)
    return {"escape": 0, "mermaid": 2.5, "pirate": 3.2, "skull_king": 3.8, "tigress": 3.2}[kind]


def choose_action(view: Dict) -> Optional[Dict]:
    actions = view["legal_actions"]
    if not actions:
        return None
    context = {key: view[key] for key in ("game_token", "round_number", "trick_number")}
    for kind in ("next_trick", "next_round"):
        if kind in actions:
            return {**context, "type": kind}
    if "bid" in actions:
        opponents = len(view["players"]) - 1 + bool(view["ghost"])
        estimate = 0.0
        for card in view["hand"]:
            kind = card["kind"]
            if kind == "number":
                high = card["rank"] / 14
                estimate += (0.15 + 0.7 * high ** 2 if card["suit"] == "black"
                             else high ** (2 + opponents / 2) / max(1.4, opponents))
            else:
                estimate += {"escape": 0, "mermaid": 0.48, "pirate": 0.72,
                             "tigress": 0.70, "skull_king": 0.9}[kind]
        bid = min(view["cards_dealt"], max(0, int(estimate + 0.45)))
        return {**context, "type": "bid", "bid": bid}
    own = next(player for player in view["players"] if player["player_id"] == view["you"])
    need = own["bid"] - own["won"]
    options = []
    for card in view["hand"]:
        if card["id"] not in view["legal_card_ids"]:
            continue
        for mode in ("escape", "pirate") if card["kind"] == "tigress" else (None,):
            play = {"player_id": view["you"], "card": card}
            if mode:
                play["mode"] = mode
            winning = resolve_trick(view["trick"] + [play])["winner_id"] == view["you"]
            strength = _strength(card, mode)
            # Once the bid is met, shed strong losing cards; otherwise prefer a
            # modest winner. Leading requires a strength estimate, not a sure win.
            if not view["trick"]:
                utility = strength if need > 0 else -strength
            elif need > 0:
                utility = (10 - strength if winning else -strength)
                if need >= len(view["hand"]):
                    utility = (10 if winning else 0) + strength
            else:
                utility = (10 + strength if not winning else -strength)
            options.append((utility, card["id"], mode))
    if not options:
        return None
    _, card_id, mode = max(options, key=lambda option: option[0])
    return {**context, "type": "play", "card_id": card_id, **({"mode": mode} if mode else {})}
