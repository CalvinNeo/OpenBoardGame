from __future__ import annotations

import json
import re
from pathlib import Path

from arknova_card_reference import (
    ACTION_CARDS,
    ANIMAL_ABILITY_DEFINITIONS,
    ANIMAL_ABILITY_PATTERNS,
    DATA_CORRECTIONS,
    FINAL_SCORING_RULES,
    SOURCE_REFERENCES,
    SPONSOR_EFFECT_TIMINGS,
    SPONSOR_EXTRA_EFFECTS,
    TAG_CODES,
    UNIQUE_BUILDING_FOOTPRINTS,
    UNIQUE_BUILDING_SPONSOR_IDS,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = REPO_ROOT / "designs" / "4.rule.md"
OUTPUT_DIR = REPO_ROOT / "game" / "assets" / "ark_nova"
CATALOG_PATH = REPO_ROOT / "designs" / "ark_nova" / "card_catalog.md"

SECTION_HEADINGS = {
    "animal_cards": "### 动物牌（基础）",
    "sponsor_cards": "### 赞助商牌（基础）",
    "conservation_projects": "### 保育项目（基础）",
    "final_scoring_cards": "### 终局计分卡（基础）",
}

PROJECT_TYPE_CODES = {
    "基础": "base",
    "放归野外": "release",
    "繁育": "breeding",
    "普通": "standard",
}

NAME_RE = re.compile(r"^- (\d+) (.+?)（(.+?)）$")
COUNTED_ITEM_RE = re.compile(r"^(?P<label>.+?)(?:×(?P<count>\d+))?$")
TRACK_NAMES = {"吸引力": "appeal", "保育": "conservation", "声望": "reputation", "金币": "money"}
TIMING_ORDER = {"immediate": 0, "setup_and_passive": 1, "passive": 2, "after_action": 3, "income": 4, "endgame": 5}


def extract_section(lines: list[str], heading: str, *, stop_on_h2: bool = False) -> list[tuple[int, str]]:
    start_idx = None
    for index, line in enumerate(lines):
        if line == heading:
            start_idx = index + 1
            break
    if start_idx is None:
        raise ValueError(f"Missing section heading: {heading}")

    section: list[tuple[int, str]] = []
    for index in range(start_idx, len(lines)):
        line = lines[index]
        if line.startswith("### "):
            break
        if stop_on_h2 and line.startswith("## "):
            break
        if re.match(r"^- \d+ ", line):
            section.append((index + 1, line))
    return section


def parse_name_field(raw: str) -> tuple[str, str, str]:
    match = NAME_RE.match(raw.strip())
    if not match:
        raise ValueError(f"Unsupported name field: {raw}")
    return match.group(1), match.group(2), match.group(3)


def strip_field(raw: str, prefix: str) -> str:
    if not raw.startswith(prefix):
        raise ValueError(f"Expected prefix {prefix!r} in {raw!r}")
    return raw[len(prefix) :].strip()


def strip_markup(raw: str) -> str:
    return raw.replace("**", "").replace("<br>", " ").strip()


def parse_counted_item(raw: str) -> tuple[str, int]:
    token = raw.strip()
    match = COUNTED_ITEM_RE.match(token)
    if not match:
        return token, 1
    return match.group("label").strip(), int(match.group("count") or "1")


def split_counted_list(raw: str) -> list[tuple[str, int]]:
    text = raw.strip()
    if not text or text == "无":
        return []
    return [parse_counted_item(part) for part in text.split("、") if part.strip()]


def parse_tags(raw: str) -> list[dict[str, int | str]]:
    tags = []
    for label, count in split_counted_list(raw):
        if label not in TAG_CODES:
            raise ValueError(f"Unknown Ark Nova tag: {label!r}")
        tags.append({"tag": TAG_CODES[label], "count": count})
    return tags


def parse_conditions(raw: str) -> list[dict[str, int | str]]:
    conditions: list[dict[str, int | str]] = []
    for label, count in split_counted_list(raw):
        if label == "合作动物园":
            conditions.append({"kind": "partner_zoo", "minimum": count})
        elif label == "动物行动II":
            conditions.append({"kind": "action_upgrade", "action": "animals", "minimum_level": 2})
        elif label == "赞助商行动II":
            conditions.append({"kind": "action_upgrade", "action": "sponsors", "minimum_level": 2})
        elif match := re.fullmatch(r"声望至少(\d+)", label):
            conditions.append(
                {"kind": "track_threshold", "track": "reputation", "operator": ">=", "value": int(match.group(1))}
            )
        elif match := re.fullmatch(r"吸引力不高于(\d+)", label):
            conditions.append(
                {"kind": "track_threshold", "track": "appeal", "operator": "<=", "value": int(match.group(1))}
            )
        elif label in TAG_CODES:
            conditions.append({"kind": "tag_count", "tag": TAG_CODES[label], "minimum": count})
        else:
            raise ValueError(f"Unknown Ark Nova play condition: {label!r}")
    return conditions


def parse_rewards(raw: str) -> dict[str, int]:
    rewards: dict[str, int] = {}
    for track_zh, value in re.findall(r"(吸引力|保育|声望|金币)\+?(-?\d+)", strip_markup(raw)):
        rewards[TRACK_NAMES[track_zh]] = int(value)
    return rewards


def parse_scores(raw: str) -> dict[str, int]:
    rewards = {"appeal": 0, "conservation": 0, "reputation": 0}
    rewards.update(parse_rewards(raw))
    return rewards


def parse_adjacency(parts: list[str]) -> dict[str, int]:
    adjacency = {"water": 0, "rock": 0}
    for part in parts:
        match = re.fullmatch(r"(水域|岩石)相邻(\d+)", part)
        if match:
            adjacency["water" if match.group(1) == "水域" else "rock"] = int(match.group(2))
    return adjacency


def parse_animal_habitat(raw: str) -> dict[str, object]:
    parts = [part.strip() for part in raw.split("，") if part.strip()]
    size_match = re.fullmatch(r"尺寸(\d+)", parts[0])
    if not size_match:
        raise ValueError(f"Unknown animal size: {raw}")
    size = int(size_match.group(1))
    enclosure_raw = parts[1]
    enclosure_options: list[dict[str, int | str]] = []

    if enclosure_raw.startswith("标准围栏"):
        enclosure_options.append({"type": "standard", "required_spaces": size})
        special_match = re.fullmatch(r"标准围栏:(爬虫馆|鸟禽馆)\((\d+)\)", enclosure_raw)
        if special_match:
            enclosure_options.append(
                {
                    "type": "reptile_house" if special_match.group(1) == "爬虫馆" else "large_bird_aviary",
                    "required_spaces": int(special_match.group(2)),
                }
            )
        elif enclosure_raw != "标准围栏":
            raise ValueError(f"Unknown enclosure option: {enclosure_raw}")
    else:
        special_match = re.fullmatch(r"需特殊围栏:萌宠馆\((\d+)\)", enclosure_raw)
        if not special_match:
            raise ValueError(f"Unknown enclosure option: {enclosure_raw}")
        enclosure_options.append({"type": "petting_zoo", "required_spaces": int(special_match.group(1))})

    return {
        "animal_size": size,
        "enclosure_options": enclosure_options,
        "placement": {"adjacent_to": parse_adjacency(parts[2:])},
        "raw_zh": raw,
    }


def parse_sponsor_strength(raw: str) -> tuple[int, dict[str, int]]:
    parts = [part.strip() for part in raw.split("，") if part.strip()]
    match = re.fullmatch(r"强度(\d+)", parts[0])
    if not match:
        raise ValueError(f"Unknown Sponsor strength: {raw}")
    return int(match.group(1)), parse_adjacency(parts[1:])


def extract_integer(text: str, pattern: str, default: int | None = None) -> int | None:
    match = re.search(pattern, text)
    return int(match.group(1)) if match else default


def ability_parameters(key: str, text: str, animal_size: int) -> dict[str, object]:
    if key == "sprint":
        return {"draw_count": extract_integer(text, r"抓取(\d+)张")}
    if key == "hunter":
        return {"reveal_count": extract_integer(text, r"顶端的(\d+)张")}
    if key == "jumping":
        count = extract_integer(text, r"推进(\d+)格")
        return {"break_steps": count, "money": count}
    if key == "inventive":
        return {"x_tokens": extract_integer(text, r"获得(\d+)", 1)}
    if key == "iconic_animal":
        continents = {"africa", "americas", "asia", "australia", "europe"}
        continent = next((code for label, code in TAG_CODES.items() if label in text and code in continents), None)
        return {"continent": continent, "maximum_appeal": extract_integer(text, r"最多(\d+)", 8)}
    if key == "sun_bathing":
        return {"maximum_cards": extract_integer(text, r"最多(\d+)张"), "money_per_card": 4}
    if key == "pouch":
        return {"maximum_cards": extract_integer(text, r"最多(\d+)张")}
    if key == "digging":
        return {"maximum_repetitions": extract_integer(text, r"最多(\d+)次")}
    if key == "flock_animal":
        return {"minimum_host_enclosure_size": animal_size}
    if key == "venom":
        return {"tokens_per_target": extract_integer(text, r"获得(\d+)枚", 1)}
    if key == "dominance":
        project_tag = next((code for label, code in TAG_CODES.items() if f"“{label}”" in text), None)
        return {"project_tag": project_tag}
    if key == "scavenging":
        return {"draw_count": extract_integer(text, r"抓取(\d+)张")}
    if key == "posturing":
        return {"maximum_buildings": extract_integer(text, r"最多(\d+)次")}
    return {}


def parse_animal_abilities(effect_text: str, animal_size: int) -> list[dict[str, object]]:
    if effect_text == "无":
        return []

    found: dict[int, tuple[int, str]] = {}
    for key, label_pattern in ANIMAL_ABILITY_PATTERNS:
        pattern = re.compile(rf"(?:^|；)\s*(?:{label_pattern})\s*[:：]")
        for match in pattern.finditer(effect_text):
            start = match.start()
            candidate = (match.end(), key)
            if start not in found or candidate[0] > found[start][0]:
                found[start] = candidate

    if not found:
        raise ValueError(f"No known animal ability in: {effect_text}")

    starts = sorted(found)
    if effect_text[: starts[0]].strip(" ；"):
        raise ValueError(f"Unparsed animal ability prefix: {effect_text}")

    abilities = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(effect_text)
        key = found[start][1]
        segment = effect_text[start:end].strip(" ；")
        definition = ANIMAL_ABILITY_DEFINITIONS[key]
        abilities.append(
            {
                "ability": key,
                "name_zh": definition["name_zh"],
                "timing": definition["timing"],
                "cascade": definition["cascade"],
                "parameters": ability_parameters(key, segment, animal_size),
                "text_zh": strip_markup(segment),
            }
        )
    return abilities


def sponsor_effect_kind(text: str, timing: str) -> str:
    plain = strip_markup(text)
    if "放置到" in plain or "建造" in plain or "饲养区" in plain:
        return "build_or_placement"
    if "行动" in plain and ("执行" in plain or "打出" in plain):
        return "action_modifier"
    if "费用减" in plain or "少支付" in plain:
        return "discount"
    if "卡牌" in plain or "牌库" in plain or "展示区" in plain:
        return "card_flow"
    if "保护项目" in plain or "保育" in plain:
        return "conservation"
    if "Money" in plain or "金币" in plain:
        return "money"
    if "Appeal" in plain or "吸引力" in plain:
        return "appeal"
    if "XToken" in plain or "X标记" in plain:
        return "x_token"
    if timing == "passive":
        return "trigger_or_rule_modifier"
    return "rule_text"


def sponsor_effect_cascade(text: str) -> str:
    plain = strip_markup(text)
    if "再打出1个小型动物" in plain:
        return "play_animal"
    if "打出一张赞助商卡牌" in plain:
        return "play_sponsor"
    if "行动卡牌" in plain and ("Slot-1" in plain or "槽位1" in plain):
        return "reposition_action"
    if "多建造" in plain:
        return "extra_build"
    if "免费建造" in plain or "免费放置" in plain:
        return "free_build"
    if "放置奖励" in plain and ("额外" in plain or "另一个" in plain):
        return "placement_bonus"
    return "none"


def parse_sponsor_effects(card_id: str, effect_text: str) -> list[dict[str, object]]:
    pieces = [] if effect_text == "无" else [part.strip() for part in effect_text.split("；") if part.strip()]
    timings = SPONSOR_EFFECT_TIMINGS[card_id]
    if len(pieces) != len(timings):
        raise ValueError(f"Sponsor {card_id}: {len(pieces)} effects but {len(timings)} timings")

    effects: list[dict[str, object]] = []
    for index, (piece, timing) in enumerate(zip(pieces, timings), start=1):
        effects.append(
            {
                "id": f"{card_id}-printed-{index}",
                "timing": timing,
                "kind": sponsor_effect_kind(piece, timing),
                "cascade": sponsor_effect_cascade(piece),
                "text_zh": strip_markup(piece),
                "source": "localized_card_text",
            }
        )
    for index, extra in enumerate(SPONSOR_EXTRA_EFFECTS.get(card_id, []), start=1):
        effects.append({"id": f"{card_id}-glossary-{index}", **extra})
    effects.sort(key=lambda item: TIMING_ORDER[str(item["timing"])])
    return effects


def parse_animal_cards(lines: list[tuple[int, str]]) -> list[dict[str, object]]:
    cards = []
    for line_no, line in lines:
        parts = [part.strip() for part in line.split("｜")]
        card_id, name_zh, name_en = parse_name_field(parts[0])
        cost = int(strip_field(parts[1], "费用"))
        habitat = parse_animal_habitat(parts[2])
        conditions_raw = strip_field(parts[3], "条件：")
        tags_raw = strip_field(parts[4], "标签：")
        effect_text = strip_field(parts[5], "效果：")
        scores_raw = strip_field(parts[6], "分数：")
        conditions = parse_conditions(conditions_raw)
        cards.append(
            {
                "id": card_id,
                "card_type": "animal",
                "name": {"zh": name_zh, "en": name_en},
                "play": {
                    "action": "animals",
                    "base_money_cost": cost,
                    "conditions": conditions,
                    "minimum_action_level_from_card_condition": 2
                    if any(c.get("action") == "animals" for c in conditions)
                    else 1,
                    "hand_source": True,
                    "display_source": {
                        "requires_action_level": 2,
                        "within_reputation_range": True,
                        "surcharge": "folder_number",
                    },
                },
                "animal_size": habitat["animal_size"],
                "enclosure_options": habitat["enclosure_options"],
                "placement": habitat["placement"],
                "icons": parse_tags(tags_raw),
                "printed_rewards": parse_scores(scores_raw),
                "printed_reward_timing": "immediate",
                "abilities": parse_animal_abilities(effect_text, int(habitat["animal_size"])),
                "raw": {
                    "habitat_zh": habitat["raw_zh"],
                    "conditions_zh": conditions_raw,
                    "icons_zh": tags_raw,
                    "effect_zh": strip_markup(effect_text),
                },
                "source_line": line_no,
            }
        )
    return cards


def unique_building(
    card_id: str,
    name_zh: str,
    adjacency: dict[str, int],
    effect_text: str,
) -> dict[str, object] | None:
    if card_id not in UNIQUE_BUILDING_SPONSOR_IDS:
        return None
    border_match = re.search(r"放置到(?:至少)?(\d+)个边界格", effect_text)
    return {
        "id": f"sponsor-{card_id}",
        "name_zh": name_zh,
        "money_cost": 0,
        "is_enclosure": False,
        "placement": {
            "adjacent_to": adjacency,
            "minimum_border_spaces": int(border_match.group(1)) if border_match else 0,
            "may_ignore_existing_building_adjacency": card_id == "257",
            "usual_building_rules_apply": True,
            "build_II_required_on_marked_map_spaces": True,
        },
        "footprint": UNIQUE_BUILDING_FOOTPRINTS[card_id],
    }


def parse_sponsor_cards(lines: list[tuple[int, str]]) -> list[dict[str, object]]:
    cards = []
    for line_no, line in lines:
        parts = [part.strip() for part in line.split("｜")]
        card_id, name_zh, name_en = parse_name_field(parts[0])
        base_cost = int(strip_field(parts[1], "费用"))
        strength_raw = parts[2]
        strength, adjacency = parse_sponsor_strength(strength_raw)
        conditions_raw = strip_field(parts[3], "条件：")
        tags_raw = strip_field(parts[4], "标签：")
        effect_text = strip_field(parts[5], "效果：")
        scores_raw = strip_field(parts[6], "分数：")
        conditions = parse_conditions(conditions_raw)
        effects = parse_sponsor_effects(card_id, effect_text)
        building = unique_building(card_id, name_zh, adjacency, effect_text)
        card: dict[str, object] = {
            "id": card_id,
            "card_type": "sponsor",
            "name": {"zh": name_zh, "en": name_en},
            "play": {
                "action": "sponsors",
                "strength_required": strength,
                "base_money_cost": base_cost,
                "conditions": conditions,
                "minimum_action_level_from_card_condition": 2
                if any(c.get("action") == "sponsors" for c in conditions)
                else 1,
                "hand_source": True,
                "display_source": {
                    "requires_action_level": 2,
                    "within_reputation_range": True,
                    "surcharge": "folder_number",
                },
            },
            "icons": parse_tags(tags_raw),
            "printed_rewards": parse_scores(scores_raw),
            "printed_reward_timing": "immediate",
            "effects": effects,
            "timing_summary": sorted(
                {str(effect["timing"]) for effect in effects}, key=lambda value: TIMING_ORDER[value]
            ),
            "counts_own_icons_for_own_effects": True,
            "raw": {
                "strength_zh": strength_raw,
                "conditions_zh": conditions_raw,
                "icons_zh": tags_raw,
                "effect_zh": strip_markup(effect_text),
            },
            "source_line": line_no,
        }
        if building:
            card["unique_building"] = building
            if not any(effect["kind"] == "build_or_placement" for effect in effects):
                effects.append(
                    {
                        "id": f"{card_id}-unique-building",
                        "timing": "immediate",
                        "kind": "build_or_placement",
                        "cascade": "free_build",
                        "text_zh": f"免费放置“{name_zh}”独特建筑，并遵守通常建筑放置规则。",
                        "source": "official_glossary",
                    }
                )
                effects.sort(key=lambda item: TIMING_ORDER[str(item["timing"])])
                card["timing_summary"] = sorted(
                    {str(effect["timing"]) for effect in effects}, key=lambda value: TIMING_ORDER[value]
                )
        cards.append(card)
    return cards


def parse_project_requirement(raw: str, metric: str) -> dict[str, int | str]:
    requirement = strip_markup(raw)
    if match := re.fullmatch(r"围栏尺寸(\d+)", requirement):
        return {"kind": "released_animal_enclosure_size", "value": int(match.group(1))}
    if requirement == "满足繁育条件":
        return {"kind": "breeding_match"}
    if requirement.isdigit():
        return {"kind": "metric_count", "metric": metric, "value": int(requirement)}
    return {"kind": "rule_text", "value": requirement}


def parse_project_steps(raw: str, metric: str) -> list[dict[str, object]]:
    steps = []
    for position, chunk in enumerate(raw.split("；"), start=1):
        requirement_raw, reward_raw = (part.strip() for part in chunk.split("->", 1))
        steps.append(
            {
                "position": position,
                "requirement": parse_project_requirement(requirement_raw, metric),
                "reward": parse_rewards(reward_raw),
                "raw_zh": strip_markup(chunk),
            }
        )
    return steps


def parse_conservation_projects(lines: list[tuple[int, str]]) -> list[dict[str, object]]:
    cards = []
    for line_no, line in lines:
        parts = [part.strip() for part in line.split("｜")]
        card_id, name_zh, name_en = parse_name_field(parts[0])
        project_type_zh = strip_field(parts[1], "类型：")
        project_type = PROJECT_TYPE_CODES[project_type_zh]
        icon_raw = strip_field(parts[2], "图标：")
        metric = TAG_CODES[icon_raw]
        thresholds_raw = strip_field(parts[3], "支持门槛：")
        placement_reward_raw = strip_field(parts[4], "放置奖励：")
        description_zh = strip_markup(strip_field(parts[5], "说明："))
        project: dict[str, object] = {
            "id": card_id,
            "card_type": "conservation_project",
            "name": {"zh": name_zh, "en": name_en},
            "project_type": project_type,
            "deck_group": "base_setup" if project_type == "base" else "zoo_deck",
            "metric": metric,
            "play": {
                "action": "association",
                "association_task_strength": 5,
                "may_support_from_hand": project_type != "base",
                "must_support_immediately_when_played": project_type != "base",
                "display_source": {
                    "requires_action_level": 2,
                    "within_reputation_range": True,
                    "surcharge": "folder_number",
                },
            },
            "support_slots": parse_project_steps(thresholds_raw, metric),
            "new_project_bonus": parse_rewards(placement_reward_raw),
            "description_zh": description_zh,
            "source_line": line_no,
        }
        if project_type == "release":
            project["release_rules"] = {
                "animal_must_have_tag": metric,
                "reward_slot_requires_exact_printed_enclosure_size": True,
                "lose_only_printed_appeal": True,
                "remove_animal_icons_and_card": True,
                "flip_smallest_possible_occupied_matching_enclosure": True,
                "special_enclosure": "remove the printed number of player tokens; only fall back to a standard enclosure if impossible",
                "newly_played_project_grants_reputation": 1,
            }
        if project_type == "breeding":
            project["breeding_rules"] = {
                "animal_must_have_tag": metric,
                "requires_partner_zoo_matching_one_of_that_animals_continents": True,
                "same_eligibility_for_all_slots": True,
                "choose_any_unoccupied_reward_slot": True,
            }
        cards.append(project)
    return cards


def parse_final_steps(raw: str) -> list[dict[str, object]]:
    steps = []
    for chunk in raw.split("；"):
        requirement_raw, reward_raw = (part.strip() for part in chunk.split("->", 1))
        requirement: int | str = int(requirement_raw) if requirement_raw.isdigit() else strip_markup(requirement_raw)
        steps.append(
            {
                "requirement": requirement,
                "reward": parse_rewards(reward_raw),
                "raw_zh": strip_markup(chunk),
            }
        )
    return steps


def parse_final_scoring_cards(lines: list[tuple[int, str]]) -> list[dict[str, object]]:
    cards = []
    for line_no, line in lines:
        parts = [part.strip() for part in line.split("｜")]
        card_id, name_zh, name_en = parse_name_field(parts[0])
        description_zh = strip_markup(strip_field(parts[1], "说明："))
        scoring_raw = strip_field(parts[2], "计分：")
        cards.append(
            {
                "id": card_id,
                "card_type": "final_scoring",
                "name": {"zh": name_zh, "en": name_en},
                "timing": "endgame",
                "description_zh": description_zh,
                "scoring_steps": parse_final_steps(scoring_raw),
                "scoring_rule": FINAL_SCORING_RULES[card_id],
                "maximum_conservation": 4,
                "source_line": line_no,
            }
        )
    return cards


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def condition_text(conditions: list[dict[str, object]]) -> str:
    if not conditions:
        return "无"
    rendered = []
    for condition in conditions:
        kind = condition["kind"]
        if kind == "tag_count":
            rendered.append(f"{condition['tag']}≥{condition['minimum']}")
        elif kind == "partner_zoo":
            rendered.append(f"partner_zoo≥{condition['minimum']}")
        elif kind == "action_upgrade":
            rendered.append(f"{condition['action']} II")
        elif kind == "track_threshold":
            rendered.append(f"{condition['track']}{condition['operator']}{condition['value']}")
    return "、".join(rendered)


def reward_text(rewards: dict[str, int]) -> str:
    nonzero = [f"{key} {value:+d}" for key, value in rewards.items() if value]
    return "、".join(nonzero) if nonzero else "—"


def escape_cell(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", "<br>")


def write_catalog(
    animal_cards: list[dict[str, object]],
    sponsor_cards: list[dict[str, object]],
    projects: list[dict[str, object]],
    final_cards: list[dict[str, object]],
) -> None:
    lines = [
        "# 方舟动物园基础版卡牌与能力目录",
        "",
        "> 机器数据位于 `game/assets/ark_nova/`。本目录只整理规则与数值，不包含商业卡图。",
        "",
        "## 口径",
        "",
        "- 内容牌共 235 张：动物 128、赞助商 64、保育项目 32、终局计分 11。另列出 5 类基础行动牌的 I/II 面。",
        "- 243–257 号赞助商的 15 块独特建筑已按地图 0 同款 flat-top 轴向坐标录入；允许六向旋转，但彩色面必须朝上，因此不能镜像。",
        "- `immediate` 在卡牌结算时执行；`after_action` 等整个动物行动结束再执行；`during_placement` 在安置动物步骤执行；`setup_and_passive` 打出时先放标记并继续保留持续规则；`passive` 监听之后的事件；`income` 在休息收入阶段执行；`endgame` 在最终计分时执行。",
        "- `cascade` 字段明确会继续触发什么：额外行动、移动行动牌、再打动物/赞助商、免费建造或额外放置奖励；`none` 表示只结算当前效果。",
        "- 卡牌会为自己的效果提供图标；双图标计两次。左侧打出条件不算图标，卡牌右上图标、合作动物园、大学以及临水/临岩要求才计入。",
        "- 动物金币费用还会受到同洲合作动物园影响：每个匹配的大洲图标减 3 金币。展示区直接打出动物/赞助商需要升级对应行动，并额外支付文件夹编号。",
        "",
        "## 基础行动牌",
        "",
        "| 行动 | I 面 | II 面 |",
        "|---|---|---|",
    ]
    for action in ACTION_CARDS:
        side_i = action["sides"]["I"]["summary_zh"]
        side_ii = action["sides"]["II"]["summary_zh"]
        lines.append(f"| {action['name_zh']} | {escape_cell(side_i)} | {escape_cell(side_ii)} |")

    lines.extend(
        [
            "",
            f"## 能力词典（{len(ANIMAL_ABILITY_DEFINITIONS)} 项）",
            "",
            "| key | 中文 / 英文 | 时机 | 级联类型 | 规则摘要 | 关键例外 |",
            "|---|---|---|---|---|---|",
        ]
    )
    for key, definition in ANIMAL_ABILITY_DEFINITIONS.items():
        edge_cases = "；".join(definition["edge_cases_zh"]) or "—"
        lines.append(
            f"| `{key}` | {definition['name_zh']} / {definition['name_en']} | {definition['timing']} | {definition['cascade']} | {escape_cell(definition['rules_zh'])} | {escape_cell(edge_cases)} |"
        )

    lines.extend(
        [
            "",
            f"## 动物牌（{len(animal_cards)} 张）",
            "",
            "| ID | 名称 | 金币 | 围栏 / 邻接 | 打出条件 | 图标 | 印刷收益 | 能力（时机） |",
            "|---|---|---:|---|---|---|---|---|",
        ]
    )
    for card in animal_cards:
        enclosure = " / ".join(f"{item['type']}:{item['required_spaces']}" for item in card["enclosure_options"])
        adjacency = card["placement"]["adjacent_to"]
        adjacent = ", ".join(f"{key}≥{value}" for key, value in adjacency.items() if value)
        if adjacent:
            enclosure += f"；{adjacent}"
        icons = "、".join(f"{item['tag']}×{item['count']}" for item in card["icons"])
        abilities = "；".join(f"{item['name_zh']}[{item['timing']}]" for item in card["abilities"]) or "—"
        lines.append(
            f"| {card['id']} | {escape_cell(card['name']['zh'])}<br>{escape_cell(card['name']['en'])} | {card['play']['base_money_cost']} | {escape_cell(enclosure)} | {condition_text(card['play']['conditions'])} | {escape_cell(icons)} | {reward_text(card['printed_rewards'])} | {escape_cell(abilities)} |"
        )

    lines.extend(
        [
            "",
            f"## 赞助商牌（{len(sponsor_cards)} 张）",
            "",
            "| ID | 名称 | 强度 | 打出条件 | 图标 / 印刷收益 | 效果（已按时机拆分） |",
            "|---|---|---:|---|---|---|",
        ]
    )
    for card in sponsor_cards:
        icons = "、".join(f"{item['tag']}×{item['count']}" for item in card["icons"]) or "—"
        icon_rewards = f"{icons}；{reward_text(card['printed_rewards'])}"
        effects = "<br>".join(f"{effect['timing']}：{effect['text_zh']}" for effect in card["effects"]) or "—"
        lines.append(
            f"| {card['id']} | {escape_cell(card['name']['zh'])}<br>{escape_cell(card['name']['en'])} | {card['play']['strength_required']} | {condition_text(card['play']['conditions'])} | {escape_cell(icon_rewards)} | {escape_cell(effects)} |"
        )

    lines.extend(
        [
            "",
            "## 独特建筑轮廓（15 块）",
            "",
            "坐标以建筑身份图标所在格为 `(0,0)`；顺时针旋转一步使用 `(q,r)→(-r,q+r)`。只允许 0–5 共六个旋转步，不允许镜像。",
            "",
            "| 卡牌 | 建筑 | 格数 | canonical cells | 放置限制 |",
            "|---|---|---:|---|---|",
        ]
    )
    for card in sponsor_cards:
        building = card.get("unique_building")
        if not building:
            continue
        footprint = building["footprint"]
        cells = " ".join(f"({cell['q']},{cell['r']})" for cell in footprint["cells"])
        placement = building["placement"]
        restrictions = []
        for terrain, minimum in placement["adjacent_to"].items():
            if minimum:
                restrictions.append(f"相邻{terrain}≥{minimum}")
        if placement["minimum_border_spaces"]:
            restrictions.append(f"覆盖边界格≥{placement['minimum_border_spaces']}")
        if placement["may_ignore_existing_building_adjacency"]:
            restrictions.append("无需与已有建筑相邻")
        restrictions.append("通常放置规则")
        lines.append(
            f"| {card['id']} | {escape_cell(building['name_zh'])} | {footprint['cell_count']} | `{cells}` | {escape_cell('；'.join(restrictions))} |"
        )

    lines.extend(
        [
            "",
            f"## 保育项目（{len(projects)} 张）",
            "",
            "| ID | 名称 | 类型 / 指标 | 支持格 | 新项目奖励 / 规则 |",
            "|---|---|---|---|---|",
        ]
    )
    for card in projects:
        slots = "；".join(slot["raw_zh"] for slot in card["support_slots"])
        special = reward_text(card["new_project_bonus"])
        if card["project_type"] == "release":
            special += "；放归动物的已占用围栏尺寸须与奖励格完全相同"
        elif card["project_type"] == "breeding":
            special += "；动物标签匹配且有与其大洲相同的合作动物园"
        lines.append(
            f"| {card['id']} | {escape_cell(card['name']['zh'])}<br>{escape_cell(card['name']['en'])} | {card['project_type']} / {card['metric']} | {escape_cell(slots)} | {escape_cell(special)} |"
        )

    lines.extend(
        [
            "",
            f"## 终局计分牌（{len(final_cards)} 张）",
            "",
            "| ID | 名称 | 类型 / 指标 | 说明 | 计分 |",
            "|---|---|---|---|---|",
        ]
    )
    for card in final_cards:
        scoring = "；".join(step["raw_zh"] for step in card["scoring_steps"])
        rule = card["scoring_rule"]
        metric = rule.get("metric", rule["kind"])
        lines.append(
            f"| {card['id']} | {escape_cell(card['name']['zh'])}<br>{escape_cell(card['name']['en'])} | {rule['kind']} / {metric} | {escape_cell(card['description_zh'])} | {escape_cell(scoring)} |"
        )

    lines.extend(["", "## 已核对的资料差异", "", "| 卡牌 | 字段 | 采用值 | 说明 |", "|---|---|---|---|"])
    for correction in DATA_CORRECTIONS:
        value = json.dumps(correction["value"], ensure_ascii=False, separators=(",", ":"))
        lines.append(
            f"| {correction['card_id']} | `{correction['field']}` | `{escape_cell(value)}` | {correction['note_zh']} |"
        )

    lines.extend(["", "## 来源", ""])
    for source in SOURCE_REFERENCES:
        lines.append(f"- [{source['title']}]({source['url']})：{', '.join(source['used_for'])}")
    lines.append("")
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_PATH.write_text("\n".join(lines), encoding="utf-8")


def validate_ids(cards: list[dict[str, object]], first: int, last: int) -> None:
    actual = [int(card["id"]) for card in cards]
    expected = list(range(first, last + 1))
    if actual != expected:
        raise ValueError(f"Card IDs differ: expected {first}-{last}, got {actual[:3]}...{actual[-3:]}")


def main() -> None:
    source_lines = SOURCE_PATH.read_text(encoding="utf-8").splitlines()
    animals = parse_animal_cards(extract_section(source_lines, SECTION_HEADINGS["animal_cards"]))
    sponsors = parse_sponsor_cards(extract_section(source_lines, SECTION_HEADINGS["sponsor_cards"]))
    projects = parse_conservation_projects(extract_section(source_lines, SECTION_HEADINGS["conservation_projects"]))
    final_cards = parse_final_scoring_cards(
        extract_section(source_lines, SECTION_HEADINGS["final_scoring_cards"], stop_on_h2=True)
    )

    validate_ids(animals, 401, 528)
    validate_ids(sponsors, 201, 264)
    validate_ids(projects, 101, 132)
    validate_ids(final_cards, 1, 11)

    summary = {
        "animal_cards": len(animals),
        "sponsor_cards": len(sponsors),
        "conservation_projects": len(projects),
        "final_scoring_cards": len(final_cards),
        "content_cards": len(animals) + len(sponsors) + len(projects) + len(final_cards),
        "action_card_types": len(ACTION_CARDS),
        "action_card_faces": len(ACTION_CARDS) * 2,
        "ability_definitions": len(ANIMAL_ABILITY_DEFINITIONS),
        "unique_building_footprints": len(UNIQUE_BUILDING_FOOTPRINTS),
    }
    unique_buildings = [
        card["unique_building"] for card in sponsors if "unique_building" in card
    ]
    document = {
        "schema_version": 3,
        "scope": "Ark Nova base game, multiplayer rules, no expansions and no solo replacements",
        "source_markdown": "designs/4.rule.md",
        "generator": "scripts/gen_arknova_cards_json.py",
        "summary": summary,
        "rules": {
            "cards_count_their_own_icons": True,
            "double_icons_count_twice": True,
            "conditions_on_left_edge_do_not_count_as_icons": True,
            "normal_effect_timing": "immediate_unless_text_says_after_finishing",
            "after_action_effects_wait_until_action_card_is_moved_to_slot_1": True,
            "simultaneous_effect_order": "active_player_choice",
            "card_text_overrides_general_rules": True,
            "action_upgrade_gained_during_an_action_is_usable_from_the_next_action": True,
            "new_upgrade_counts_immediately_for_card_conditions": True,
            "bonuses_gained_mid_action_may_be_spent_later_in_that_action": True,
            "x_token_limit": 5,
            "unique_buildings_on_build_II_map_spaces_require_your_build_action_to_be_upgraded": True,
            "unique_buildings_must_be_placed_colored_side_up": True,
            "unique_buildings_may_rotate_but_may_not_be_reflected": True,
        },
        "sources": SOURCE_REFERENCES,
        "data_corrections": DATA_CORRECTIONS,
        "action_cards": ACTION_CARDS,
        "abilities": ANIMAL_ABILITY_DEFINITIONS,
        "animal_cards": animals,
        "sponsor_cards": sponsors,
        "unique_buildings": unique_buildings,
        "conservation_projects": projects,
        "final_scoring_cards": final_cards,
    }

    write_json(OUTPUT_DIR / "cards.json", document)
    write_json(OUTPUT_DIR / "animal_cards.json", animals)
    write_json(OUTPUT_DIR / "sponsor_cards.json", sponsors)
    write_json(OUTPUT_DIR / "unique_buildings.json", unique_buildings)
    write_json(OUTPUT_DIR / "conservation_projects.json", projects)
    write_json(OUTPUT_DIR / "final_scoring_cards.json", final_cards)
    write_json(OUTPUT_DIR / "action_cards.json", ACTION_CARDS)
    write_json(OUTPUT_DIR / "abilities.json", ANIMAL_ABILITY_DEFINITIONS)
    write_catalog(animals, sponsors, projects, final_cards)

    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
