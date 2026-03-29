from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = REPO_ROOT / "designs" / "4.rule.md"
OUTPUT_DIR = REPO_ROOT / "designs" / "arknova" / "cards"

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


def parse_counted_item(raw: str) -> dict[str, int | str]:
    token = raw.strip()
    match = COUNTED_ITEM_RE.match(token)
    if not match:
        return {"label": token, "count": 1}
    count = int(match.group("count") or "1")
    return {"label": match.group("label").strip(), "count": count}


def parse_counted_list(raw: str) -> list[dict[str, int | str]]:
    text = raw.strip()
    if not text or text == "无":
        return []
    return [parse_counted_item(part) for part in text.split("、") if part.strip()]


def parse_scores(raw: str) -> dict[str, int]:
    scores = {
        "appeal": 0,
        "conservation": 0,
        "reputation": 0,
    }
    for chunk in raw.split("，"):
        token = chunk.strip()
        match = re.match(r"^(吸引力|保育|声望)(-?\d+)$", token)
        if not match:
            continue
        value = int(match.group(2))
        if match.group(1) == "吸引力":
            scores["appeal"] = value
        elif match.group(1) == "保育":
            scores["conservation"] = value
        elif match.group(1) == "声望":
            scores["reputation"] = value
    return scores


def parse_threshold_steps(raw: str) -> list[dict[str, str]]:
    steps: list[dict[str, str]] = []
    for chunk in raw.split("；"):
        token = chunk.strip()
        if not token:
            continue
        if "->" in token:
            requirement, reward = token.split("->", 1)
            steps.append(
                {
                    "requirement_raw": requirement.strip(),
                    "reward_raw": reward.strip(),
                }
            )
        else:
            steps.append({"requirement_raw": "", "reward_raw": token})
    return steps


def parse_animal_habitat(raw: str) -> tuple[int | None, str | None, list[str]]:
    parts = [part.strip() for part in raw.split("，") if part.strip()]
    size = None
    enclosure_type = None
    placement_requirements: list[str] = []
    if parts:
        match = re.match(r"^尺寸(\d+)$", parts[0])
        if match:
            size = int(match.group(1))
    if len(parts) >= 2:
        enclosure_type = parts[1]
    if len(parts) >= 3:
        placement_requirements = parts[2:]
    return size, enclosure_type, placement_requirements


def parse_sponsor_strength(raw: str) -> tuple[int | None, list[str]]:
    parts = [part.strip() for part in raw.split("，") if part.strip()]
    strength = None
    placement_requirements: list[str] = []
    if parts:
        match = re.match(r"^强度(\d+)$", parts[0])
        if match:
            strength = int(match.group(1))
    if len(parts) >= 2:
        placement_requirements = parts[1:]
    return strength, placement_requirements


def parse_animal_cards(lines: list[tuple[int, str]]) -> list[dict[str, object]]:
    cards = []
    for line_no, line in lines:
        parts = [part.strip() for part in line.split("｜")]
        card_id, name_zh, name_en = parse_name_field(parts[0])
        cost = int(strip_field(parts[1], "费用"))
        habitat_raw = parts[2]
        size, enclosure_type, placement_requirements = parse_animal_habitat(habitat_raw)
        conditions_raw = strip_field(parts[3], "条件：")
        tags_raw = strip_field(parts[4], "标签：")
        effect_text = strip_field(parts[5], "效果：")
        scores_raw = strip_field(parts[6], "分数：")
        cards.append(
            {
                "id": card_id,
                "card_type": "animal",
                "name_zh": name_zh,
                "name_en": name_en,
                "cost": cost,
                "habitat_raw": habitat_raw,
                "size": size,
                "enclosure_type": enclosure_type,
                "placement_requirements": placement_requirements,
                "conditions_raw": conditions_raw,
                "conditions": parse_counted_list(conditions_raw),
                "tags_raw": tags_raw,
                "tags": parse_counted_list(tags_raw),
                "effect_text_zh": effect_text,
                "scores_raw": scores_raw,
                "scores": parse_scores(scores_raw),
                "source_line": line_no,
            }
        )
    return cards


def parse_sponsor_cards(lines: list[tuple[int, str]]) -> list[dict[str, object]]:
    cards = []
    for line_no, line in lines:
        parts = [part.strip() for part in line.split("｜")]
        card_id, name_zh, name_en = parse_name_field(parts[0])
        cost = int(strip_field(parts[1], "费用"))
        strength_raw = parts[2]
        strength, placement_requirements = parse_sponsor_strength(strength_raw)
        conditions_raw = strip_field(parts[3], "条件：")
        tags_raw = strip_field(parts[4], "标签：")
        effect_text = strip_field(parts[5], "效果：")
        scores_raw = strip_field(parts[6], "分数：")
        cards.append(
            {
                "id": card_id,
                "card_type": "sponsor",
                "name_zh": name_zh,
                "name_en": name_en,
                "cost": cost,
                "strength_raw": strength_raw,
                "strength": strength,
                "placement_requirements": placement_requirements,
                "conditions_raw": conditions_raw,
                "conditions": parse_counted_list(conditions_raw),
                "tags_raw": tags_raw,
                "tags": parse_counted_list(tags_raw),
                "effect_text_zh": effect_text,
                "scores_raw": scores_raw,
                "scores": parse_scores(scores_raw),
                "source_line": line_no,
            }
        )
    return cards


def parse_conservation_projects(lines: list[tuple[int, str]]) -> list[dict[str, object]]:
    cards = []
    for line_no, line in lines:
        parts = [part.strip() for part in line.split("｜")]
        card_id, name_zh, name_en = parse_name_field(parts[0])
        project_type = strip_field(parts[1], "类型：")
        icon_raw = strip_field(parts[2], "图标：")
        support_thresholds_raw = strip_field(parts[3], "支持门槛：")
        placement_reward_raw = strip_field(parts[4], "放置奖励：")
        description_zh = strip_field(parts[5], "说明：")
        cards.append(
            {
                "id": card_id,
                "card_type": "conservation_project",
                "name_zh": name_zh,
                "name_en": name_en,
                "project_type": project_type,
                "project_type_code": PROJECT_TYPE_CODES.get(project_type, "unknown"),
                "icon_raw": icon_raw,
                "icons": parse_counted_list(icon_raw),
                "support_thresholds_raw": support_thresholds_raw,
                "support_thresholds": parse_threshold_steps(support_thresholds_raw),
                "placement_reward_raw": placement_reward_raw,
                "description_zh": description_zh,
                "source_line": line_no,
            }
        )
    return cards


def parse_final_scoring_cards(lines: list[tuple[int, str]]) -> list[dict[str, object]]:
    cards = []
    for line_no, line in lines:
        parts = [part.strip() for part in line.split("｜")]
        card_id, name_zh, name_en = parse_name_field(parts[0])
        description_zh = strip_field(parts[1], "说明：")
        scoring_raw = strip_field(parts[2], "计分：")
        cards.append(
            {
                "id": card_id,
                "card_type": "final_scoring",
                "name_zh": name_zh,
                "name_en": name_en,
                "description_zh": description_zh,
                "scoring_raw": scoring_raw,
                "scoring_steps": parse_threshold_steps(scoring_raw),
                "source_line": line_no,
            }
        )
    return cards


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    source_lines = SOURCE_PATH.read_text(encoding="utf-8").splitlines()

    animal_lines = extract_section(source_lines, SECTION_HEADINGS["animal_cards"])
    sponsor_lines = extract_section(source_lines, SECTION_HEADINGS["sponsor_cards"])
    conservation_lines = extract_section(source_lines, SECTION_HEADINGS["conservation_projects"])
    final_scoring_lines = extract_section(
        source_lines,
        SECTION_HEADINGS["final_scoring_cards"],
        stop_on_h2=True,
    )

    animal_cards = parse_animal_cards(animal_lines)
    sponsor_cards = parse_sponsor_cards(sponsor_lines)
    conservation_projects = parse_conservation_projects(conservation_lines)
    final_scoring_cards = parse_final_scoring_cards(final_scoring_lines)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    summary = {
        "animal_cards": len(animal_cards),
        "sponsor_cards": len(sponsor_cards),
        "conservation_projects": len(conservation_projects),
        "final_scoring_cards": len(final_scoring_cards),
    }
    summary["total_cards"] = sum(summary.values())

    document = {
        "schema_version": 1,
        "source": {
            "markdown_file": "designs/4.rule.md",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generator": "scripts/gen_arknova_cards_json.py",
            "scope": "Ark Nova base cards listed in the local rule summary",
            "section_headings": SECTION_HEADINGS,
        },
        "summary": summary,
        "animal_cards": animal_cards,
        "sponsor_cards": sponsor_cards,
        "conservation_projects": conservation_projects,
        "final_scoring_cards": final_scoring_cards,
    }

    write_json(OUTPUT_DIR / "cards.json", document)
    write_json(OUTPUT_DIR / "animal_cards.json", animal_cards)
    write_json(OUTPUT_DIR / "sponsor_cards.json", sponsor_cards)
    write_json(OUTPUT_DIR / "conservation_projects.json", conservation_projects)
    write_json(OUTPUT_DIR / "final_scoring_cards.json", final_scoring_cards)


if __name__ == "__main__":
    main()
