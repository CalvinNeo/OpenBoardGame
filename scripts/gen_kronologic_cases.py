#!/usr/bin/env python3
"""Generate the fixed, original-compatible Kronologic case catalog.

The generated paths and stories are original project content.  No commercial
scenario, card table, starting layout, solution, or artwork is used here.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Dict, List, Sequence, Tuple


ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT_DIR / "game" / "assets" / "kronologic_cases.json"

CHARACTERS: Tuple[Dict[str, str], ...] = (
    {"id": "archivist", "name": "Archivist", "name_zh": "档案管理员", "emoji": "📚", "code": "AR", "pattern": "lines"},
    {"id": "conductor", "name": "Conductor", "name_zh": "指挥家", "emoji": "🎼", "code": "CO", "pattern": "diagonal"},
    {"id": "engineer", "name": "Engineer", "name_zh": "工程师", "emoji": "🧰", "code": "EN", "pattern": "dots"},
    {"id": "patron", "name": "Patron", "name_zh": "赞助人", "emoji": "🎩", "code": "PA", "pattern": "diamonds"},
    {"id": "singer", "name": "Singer", "name_zh": "歌唱家", "emoji": "🎤", "code": "SI", "pattern": "waves"},
    {"id": "courier", "name": "Courier", "name_zh": "信使", "emoji": "✉️", "code": "CU", "pattern": "crosshatch"},
)

LOCATIONS: Tuple[Dict[str, str], ...] = (
    {"id": "grand_hall", "name": "Grand Hall", "name_zh": "大厅", "emoji": "✨"},
    {"id": "archive", "name": "Archive", "name_zh": "档案室", "emoji": "📚"},
    {"id": "rehearsal", "name": "Rehearsal Room", "name_zh": "排练室", "emoji": "🎼"},
    {"id": "backstage", "name": "Backstage", "name_zh": "后台", "emoji": "🎭"},
    {"id": "dressing_room", "name": "Dressing Room", "name_zh": "化妆间", "emoji": "🪞"},
    {"id": "orchestra_pit", "name": "Orchestra Pit", "name_zh": "乐池", "emoji": "🎻"},
)

EDGES: Tuple[Tuple[str, str], ...] = (
    ("grand_hall", "archive"),
    ("grand_hall", "rehearsal"),
    ("grand_hall", "backstage"),
    ("archive", "dressing_room"),
    ("rehearsal", "orchestra_pit"),
    ("backstage", "dressing_room"),
    ("backstage", "orchestra_pit"),
)

CASE_SPECS: Tuple[Dict, ...] = (
    {
        "case_id": "sealed-score-01",
        "title": "The Missing Cue",
        "title_zh": "遗失的提示谱",
        "story": "A marked cue sheet changed hands during rehearsal. Find who met the Archivist alone, and identify where and when the exchange happened.",
        "story_zh": "排练期间，一份带有标记的提示谱被秘密转交。找出与档案管理员单独会面的人，并确定交接的地点和时间。",
        "difficulty": 1,
        "anchor_character_id": "archivist",
        "seed": "openboard-kronologic-missing-cue-v1",
        "solo_thresholds": {"gold_max": 8, "silver_max": 13},
    },
    {
        "case_id": "sealed-score-02",
        "title": "The Brass Key",
        "title_zh": "黄铜钥匙",
        "story": "A brass key was passed during the evening. Trace the Courier's only private meeting and identify the recipient, place, and time.",
        "story_zh": "今晚有人转交了一把黄铜钥匙。追查信使唯一一次单独会面，找出接收者、地点和时间。",
        "difficulty": 1,
        "anchor_character_id": "courier",
        "seed": "openboard-kronologic-brass-key-v1",
        "solo_thresholds": {"gold_max": 9, "silver_max": 14},
    },
    {
        "case_id": "sealed-score-03",
        "title": "Echoes Backstage",
        "title_zh": "后台回声",
        "story": "Someone delivered a secret instruction to the Conductor. Determine the person, room, and time of the Conductor's only private meeting.",
        "story_zh": "有人向指挥家传递了一条秘密指令。确定指挥家唯一一次单独会面的对象、房间和时间。",
        "difficulty": 2,
        "anchor_character_id": "conductor",
        "seed": "openboard-kronologic-echoes-v1",
        "solo_thresholds": {"gold_max": 10, "silver_max": 16},
    },
    {
        "case_id": "sealed-score-04",
        "title": "The Silent Mechanism",
        "title_zh": "无声机关",
        "story": "The Engineer quietly demonstrated a hidden mechanism to one person. Work out who attended, in which room, and at what time.",
        "story_zh": "工程师悄悄向一个人展示了隐藏机关。找出在场者、所在房间和具体时间。",
        "difficulty": 2,
        "anchor_character_id": "engineer",
        "seed": "openboard-kronologic-mechanism-v1",
        "solo_thresholds": {"gold_max": 11, "silver_max": 17},
    },
    {
        "case_id": "sealed-score-05",
        "title": "The Last Encore",
        "title_zh": "最后的返场",
        "story": "Before the final encore, the Singer held one private meeting. Identify the visitor, location, and exact time.",
        "story_zh": "最后一次返场之前，歌唱家进行了一次单独会面。找出来访者、地点和准确时间。",
        "difficulty": 3,
        "anchor_character_id": "singer",
        "seed": "openboard-kronologic-encore-v1",
        "solo_thresholds": {"gold_max": 12, "silver_max": 19},
    },
)


def _neighbors() -> Dict[str, List[str]]:
    result = {location["id"]: [] for location in LOCATIONS}
    for left, right in EDGES:
        result[left].append(right)
        result[right].append(left)
    for values in result.values():
        values.sort()
    return result


def _meetings(paths: Dict[str, List[str]], anchor_id: str) -> List[Dict]:
    character_ids = [character["id"] for character in CHARACTERS]
    result: List[Dict] = []
    for time_index in range(1, 6):
        location_id = paths[anchor_id][time_index]
        occupants = [
            character_id
            for character_id in character_ids
            if paths[character_id][time_index] == location_id
        ]
        if len(occupants) == 2:
            other_id = next(character_id for character_id in occupants if character_id != anchor_id)
            result.append(
                {
                    "character_id": other_id,
                    "location_id": location_id,
                    "time": time_index + 1,
                }
            )
    return result


def _generate_case(spec: Dict) -> Dict:
    rng = random.Random(spec["seed"])
    neighbors = _neighbors()
    character_ids = [character["id"] for character in CHARACTERS]
    location_ids = [location["id"] for location in LOCATIONS]

    for _attempt in range(200_000):
        starts = list(location_ids)
        rng.shuffle(starts)
        paths: Dict[str, List[str]] = {}
        for character_id, start in zip(character_ids, starts):
            path = [start]
            for _time in range(1, 6):
                path.append(rng.choice(neighbors[path[-1]]))
            paths[character_id] = path

        meetings = _meetings(paths, spec["anchor_character_id"])
        if len(meetings) != 1:
            continue

        # Avoid cases whose anchor simply alternates between two rooms.  The
        # additional route variety makes the structured notebook worthwhile.
        if len(set(paths[spec["anchor_character_id"]])) < 3:
            continue

        result = {key: value for key, value in spec.items() if key != "seed"}
        result["paths"] = paths
        return result

    raise RuntimeError(f"could not generate a valid case for {spec['case_id']}")


def build_catalog() -> Dict:
    cases = [_generate_case(spec) for spec in CASE_SPECS]
    signatures = {
        tuple(tuple(case["paths"][character["id"]]) for character in CHARACTERS)
        for case in cases
    }
    if len(signatures) != len(cases):
        raise RuntimeError("generated duplicate case paths")

    return {
        "schema_version": 1,
        "catalog_id": "original-compatible-v1",
        "catalog_status": "original-compatible",
        "commercial_scenarios_included": False,
        "content_notice": "Original Case Pack · Not the commercial scenarios",
        "content_notice_zh": "原创案件包 · 不含商业版案件",
        "characters": list(CHARACTERS),
        "locations": list(LOCATIONS),
        "edges": [list(edge) for edge in EDGES],
        "cases": cases,
    }


def main() -> None:
    catalog = build_catalog()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(catalog['cases'])} cases to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
