"""Ponzi Scheme numeric components (9 starting, 47 normal, 16 bear cards).

The 72-card transcription is adapted from the MIT-licensed project
peter-de-boer/ponzischeme_webapp, commit ddabfce7884aa04473fc98f4445a7077095f5c95.
See designs/ponzi_scheme_card_data.md for sources, checks, and its license.
No artwork or UI assets are taken from that project or the commercial game.
"""

from typing import Dict, List, Optional

INDUSTRY_SUPPLY = 15
INDUSTRIES = {
    "transport": {"name": "交通", "icon": "🚂", "color": "blue"},
    "grain": {"name": "粮食", "icon": "🌾", "color": "gold"},
    "media": {"name": "传媒", "icon": "📻", "color": "green"},
    "estate": {"name": "地产", "icon": "🏠", "color": "rose"},
}
LUXURIES = {
    "jewels": {"name": "珠宝", "icon": "💍", "cost": 30, "points": 1},
    "car": {"name": "名车", "icon": "🚘", "cost": 56, "points": 2},
    "yacht": {"name": "游艇", "icon": "🛥️", "cost": 78, "points": 3},
    "penthouse": {"name": "豪宅", "icon": "🏙️", "cost": 96, "points": 4},
}

# (principal received ONCE, recurring period, interest paid EACH period).
FUND_MANIFEST = (
    (9, 5, 8), (10, 5, 9), (11, 5, 10), (12, 5, 11),
    (13, 4, 10), (14, 4, 11), (15, 4, 12), (16, 4, 13),
    (17, 3, 11), (18, 3, 12), (19, 3, 13), (20, 3, 14),
    (21, 5, 26), (22, 5, 28), (23, 5, 30), (24, 5, 32),
    (25, 4, 27), (26, 4, 29), (27, 4, 31), (28, 4, 33),
    (29, 3, 26), (30, 3, 27), (31, 3, 28), (32, 3, 29),
    (33, 5, 57), (34, 5, 59), (35, 5, 61), (36, 5, 63),
    (37, 4, 53), (38, 4, 55), (39, 4, 57), (40, 4, 59),
    (41, 3, 46), (42, 3, 48), (43, 3, 50), (44, 3, 52),
    (45, 5, 102), (46, 5, 105), (47, 5, 108), (48, 5, 111),
    (49, 4, 91), (50, 4, 93), (51, 4, 95), (52, 4, 98),
    (53, 3, 75), (54, 3, 77), (55, 3, 79), (56, 3, 81),
    (57, 5, 162), (58, 5, 165), (59, 5, 168), (60, 5, 171),
    (61, 4, 140), (62, 4, 143), (63, 4, 146), (64, 4, 149),
    (65, 3, 114), (66, 3, 116), (67, 3, 118), (68, 3, 120),
    (69, 3, 122), (70, 3, 124), (71, 3, 126), (72, 3, 128),
    (73, 3, 130), (74, 3, 132), (75, 3, 134), (76, 3, 136),
    (77, 3, 138), (78, 3, 140), (79, 3, 142), (80, 3, 144),
)


def build_cards() -> List[Dict]:
    return [{"id": f"fund-{principal}", "principal": principal, "period": period,
             "interest": interest, "starting": principal <= 17, "bear": principal >= 65}
            for principal, period, interest in FUND_MANIFEST]


def _action(kind: str, fields: Optional[Dict] = None) -> Dict:
    fields = fields or {}
    return {"type": "object", "properties": {"type": {"const": kind}, **fields},
            "required": ["type", *fields], "additionalProperties": False}


_ID = {"type": "string", "minLength": 1, "maxLength": 128}
_INDUSTRY = {"enum": list(INDUSTRIES)}
ACTION_SCHEMA = {"type": "object", "oneOf": [
    _action("fund", {"industry": _INDUSTRY, "card_id": _ID}),
    _action("pass"),
    _action("offer_trade", {"target": _ID, "industry": _INDUSTRY,
                            "amount": {"type": "integer", "minimum": 0}}),
    _action("respond_trade", {"response": {"enum": ["sell", "buy"]}}),
    _action("buy_luxury", {"luxury": {"enum": list(LUXURIES)}}),
    _action("remove_fund", {"card_id": _ID}),
    _action("discard_industry", {"industry": _INDUSTRY}),
    _action("next_round"),
]}
CONFIG_SCHEMA = {"type": "object", "properties": {
    "advanced": {"type": "boolean", "default": False},
    "first_round_trading": {"type": "boolean", "default": False},
    "seed": {"type": ["integer", "string"], "maxLength": 128},
}, "additionalProperties": False}
