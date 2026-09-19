"""Verified introductory clock and explicitly original Take Time exercises.

Rules: Libellud TT_RULES_EN_WEB.pdf and TT_LEAFLET_EN.pdf (2025).
Only awakening_1 reproduces an official clock, shown on rulebook pages 8–9.
"""

from typing import Dict, List


def _clock(clock_id: str, name: str, rules: Dict = None, **options) -> Dict:
    return {
        "id": clock_id,
        "name": name,
        "source": "original_practice",
        "cap": 24,
        "movable_hand": False,
        "no_face_up": False,
        "play_order": "any",
        "metric": "sum",
        "segments": [dict((rules or {}).get(i, {})) for i in range(6)],
        "required_plays": {},
        **options,
    }


CLOCKS: List[Dict] = [
    _clock("awakening_1", "苏醒 · 官方入门", {0: {"colors": ["solar"]}, 5: {"count": 3}},
           source="official_1_1", cap=None),
    _clock("open_sky", "晴空", {}),
    _clock("sun_and_moon", "日月相伴", {0: {"colors": ["solar"]},
           3: {"colors": ["solar", "lunar"]}, 5: {"count": 3}}),
    _clock("windows", "时光之窗", {1: {"range": [6, 10]}, 4: {"range": [16, 22]}}),
    _clock("echoes", "回声", {1: {"closest": 9}, 4: {"closest": 18}}),
    _clock("first_and_last", "始与终", {}, required_plays={"1": 0, "2": 1, "12": 5}),
    _clock("silent_night", "静夜", {5: {"count": 3}}, no_face_up=True),
    _clock("high_tide", "潮起", {}, play_order="highest"),
    _clock("low_tide", "潮落", {}, play_order="lowest"),
    _clock("orbit", "星轨", {0: {"extreme": "lowest"}, 3: {"extreme": "highest"}},
           movable_hand=True),
    _clock("pairs", "双星", {i: {"count": 2} for i in range(6)}, movable_hand=True),
    _clock("differences", "光与影", {i: {"count": 2} for i in range(6)},
           movable_hand=True, metric="difference"),
]
CLOCK_BY_ID = {clock["id"]: clock for clock in CLOCKS}
CLOCK_IDS = list(CLOCK_BY_ID)


def segment_rule_labels(rule: Dict) -> List[str]:
    labels = []
    if "colors" in rule:
        colors = rule["colors"]
        labels.append("恰好 " + " + ".join("☀️" if color == "solar" else "🌙" for color in colors))
    if "count" in rule:
        labels.append(f"恰好 {rule['count']} 张牌")
    if "range" in rule:
        labels.append(f"总和 {rule['range'][0]}–{rule['range'][1]}")
    if "closest" in rule:
        labels.append(f"全盘最接近 {rule['closest']}（可并列）")
    if "extreme" in rule:
        labels.append("含全场最小牌" if rule["extreme"] == "lowest" else "含全场最大牌")
    return labels


def _action(action_type: str, fields: Dict = None) -> Dict:
    fields = fields or {}
    return {
        "type": "object",
        "properties": {"type": {"const": action_type}, **fields},
        "required": ["type", *fields],
        "additionalProperties": False,
    }


ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        _action("ready"),
        _action("set_plan", {"segment": {"type": "integer", "minimum": 0, "maximum": 5},
                             "target": {"type": "integer", "minimum": 0, "maximum": 36}}),
        _action("set_hand", {"segment": {"type": "integer", "minimum": 0, "maximum": 5}}),
        _action("place", {"card_id": {"type": "string", "minLength": 1, "maxLength": 40},
                          "segment": {"type": "integer", "minimum": 0, "maximum": 5},
                          "face_up": {"type": "boolean"}}),
        _action("choose_next", {"choice": {"enum": ["retry", "advance", "skip", "finish"]}}),
        _action("next_round"),
    ],
}

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "start_clock": {"enum": CLOCK_IDS},
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "maxLength": 80}]},
    },
    "additionalProperties": False,
}
