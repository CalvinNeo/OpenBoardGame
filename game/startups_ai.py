"""A practice opponent using only the requesting player's public view."""

from typing import Dict, Optional

from game.startups import COMPANY_IDS, share_counts


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view["legal_actions"]
    if not legal:
        return None
    context = {key: view[key] for key in ("game_token", "round_number", "turn_number")}
    if "next_round" in legal:
        return {"type": "next_round", **context}
    own = next(player for player in view["players"] if player["player_id"] == view["you"])
    others = [player for player in view["players"] if player["player_id"] != view["you"]]
    hand = share_counts(view["hand"])
    totals = {company: own["shares"][company] + hand[company] for company in COMPANY_IDS}
    leading = {company: max(player["shares"][company] for player in others) for company in COMPANY_IDS}

    def value(company: str, count: int) -> float:
        rival = leading[company]
        income = sum(player["shares"][company] for player in others)
        if count == 0:
            return 0.0
        if count > rival:
            return 3 * income + min(count - rival, 3) * 0.65
        if count == rival:
            return -0.35 * count
        return -float(count) - max(0, rival - count - 1) * 0.2

    if view["phase"] == "take":
        candidates = []
        if "draw" in legal:
            # Drawing advances the finite deck and may find an uncontested share.
            candidates.append((1.7 - view["draw_cost"], {"type": "draw"}))
        for entry in view["market"]:
            card = entry["card"]
            if card["id"] not in view["legal_market_ids"]:
                continue
            company, coins = card["company"], entry["coins"]
            gain = value(company, totals[company] + 1) - value(company, totals[company])
            candidates.append((gain + coins + (0.4 if own["capital"] < 3 else 0),
                               {"type": "take_market", "card_id": card["id"]}))
        return {**max(candidates, key=lambda item: item[0])[1], **context} if candidates else None

    candidates = []
    for card in view["hand"]:
        company = card["company"]
        # Keeping shares in hand already counts at settlement. Investing mainly
        # claims fee exemptions; discarding removes an unwanted future liability.
        claim = own["shares"][company] + 1 > leading[company]
        invest_value = 0.35 + (0.6 if claim else 0) + max(0, totals[company] - leading[company]) * 0.08
        candidates.append((invest_value, {"type": "invest", "card_id": card["id"]}))
        if card["id"] in view["legal_discard_ids"]:
            gain = value(company, totals[company] - 1) - value(company, totals[company])
            candidates.append((gain - 0.25, {"type": "discard", "card_id": card["id"]}))
    return {**max(candidates, key=lambda item: item[0])[1], **context}
