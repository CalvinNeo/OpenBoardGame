from typing import Dict, List, Optional

ENERGY_TYPES = ("red", "yellow", "blue", "black")
ENERGY_NAMES = {
    "red": "Heat",
    "yellow": "Electric",
    "blue": "Atomic",
    "black": "Battery",
    "generic": "Any",
}
ENERGY_EMOJI = {
    "red": "🔴",
    "yellow": "🟡",
    "blue": "🔵",
    "black": "⚫",
    "generic": "🌈",
}

GIZMO_PANEL_EMOJI = {
    "file": "🗂️",
    "pick": "🫳",
    "build": "🛠️",
    "converter": "🔁",
    "upgrade": "➕",
    "generic": "✨",
}


def _effect_summary(effect: Dict) -> str:
    kind = effect["kind"]
    if kind == "draw_random":
        amount = int(effect.get("amount", 1))
        return f"Draw {amount} random energy"
    if kind == "pick_energy":
        amount = int(effect.get("amount", 1))
        colors = effect.get("colors") or list(ENERGY_TYPES)
        if len(colors) == len(ENERGY_TYPES):
            return f"Pick {amount} energy from row"
        icons = "/".join(ENERGY_EMOJI[color] for color in colors)
        return f"Pick {amount} {icons} from row"
    if kind == "gain_vp":
        return f"Gain {int(effect.get('amount', 1))} VP"
    if kind == "perform_file":
        return "Perform 1 File action"
    if kind == "perform_research":
        return "Perform 1 Research action"
    if kind == "free_build_level1":
        return "Build 1 Level 1 Gizmo for free"
    if kind == "upgrade_storage":
        return f"Storage +{int(effect.get('amount', 1))}"
    if kind == "upgrade_file":
        return f"File limit +{int(effect.get('amount', 1))}"
    if kind == "upgrade_research":
        return f"Research +{int(effect.get('amount', 1))}"
    if kind == "upgrade_disable_file":
        return "You can no longer File"
    if kind == "upgrade_disable_research":
        return "You can no longer Research"
    if kind == "discount_level2":
        return f"Level 2 builds cost {int(effect.get('amount', 1))} less"
    if kind == "discount_archive":
        return f"Archive builds cost {int(effect.get('amount', 1))} less"
    if kind == "discount_research":
        return f"Research builds cost {int(effect.get('amount', 1))} less"
    if kind == "extra_score_storage":
        return "End game: score = stored energy"
    if kind == "extra_score_tokens":
        return "End game: score = VP tokens"
    if kind == "convert_specific_to_any":
        return f"{ENERGY_EMOJI[effect['source']]} -> any color"
    if kind == "convert_any_to_any":
        return "Any 1 energy -> any color"
    if kind == "convert_specific_to_double":
        return f"{ENERGY_EMOJI[effect['source']]} counts as 2 {ENERGY_EMOJI[effect['source']]}"
    if kind == "convert_specific_up_to_two_to_any":
        return f"1 or 2 {ENERGY_EMOJI[effect['source']]} -> same amount of any color"
    if kind == "convert_each_specific_to_double":
        icons = "".join(ENERGY_EMOJI[color] for color in effect.get("sources", []))
        return f"For each {icons}, 1 counts as 2 of that color"
    return kind


def _trigger_summary(trigger: Optional[Dict]) -> str:
    if not trigger:
        return "Built"
    kind = trigger["kind"]
    if kind == "on_file":
        return "After File"
    if kind == "on_pick":
        colors = trigger.get("colors") or list(ENERGY_TYPES)
        icons = "/".join(ENERGY_EMOJI[color] for color in colors)
        return f"After Pick {icons}"
    if kind == "on_build":
        colors = trigger.get("colors") or list(ENERGY_TYPES)
        icons = "/".join(ENERGY_EMOJI[color] for color in colors)
        return f"After Build {icons}"
    if kind == "on_build_from_archive":
        return "After Build from Archive"
    if kind == "on_build_level":
        return f"After Build Level {int(trigger.get('level', 2))}"
    return kind


def make_card(
    card_id: str,
    *,
    level: int,
    panel: str,
    energy_type: str,
    cost: int,
    vp: int,
    trigger: Optional[Dict] = None,
    effect: Optional[Dict] = None,
    immediate_on_build: bool = False,
) -> Dict:
    summary = _effect_summary(effect or {"kind": "none"})
    if trigger:
        text = f"{_trigger_summary(trigger)}: {summary}"
    elif immediate_on_build:
        text = f"Built: {summary}"
    else:
        text = summary
    title = f"{GIZMO_PANEL_EMOJI.get(panel, '•')} {summary}"
    return {
        "id": card_id,
        "level": level,
        "panel": panel,
        "energy_type": energy_type,
        "cost": cost,
        "vp": vp,
        "trigger": trigger,
        "effect": effect,
        "immediate_on_build": immediate_on_build,
        "title": title,
        "text": text,
    }


STARTING_GIZMO = make_card(
    "start_file_draw_1",
    level=0,
    panel="file",
    energy_type="generic",
    cost=0,
    vp=0,
    trigger={"kind": "on_file"},
    effect={"kind": "draw_random", "amount": 1},
)


def _build_level_1_cards() -> List[Dict]:
    cards: List[Dict] = []

    for color in ENERGY_TYPES:
        cards.append(
            make_card(
                f"l1_file_pick_{color}",
                level=1,
                panel="file",
                energy_type=color,
                cost=1,
                vp=1,
                trigger={"kind": "on_file"},
                effect={"kind": "pick_energy", "amount": 1, "colors": [color]},
            )
        )

    for color in ENERGY_TYPES:
        for index in range(2):
            cards.append(
                make_card(
                    f"l1_pick_{color}_draw_{index + 1}",
                    level=1,
                    panel="pick",
                    energy_type=color,
                    cost=1,
                    vp=1,
                    trigger={"kind": "on_pick", "colors": [color]},
                    effect={"kind": "draw_random", "amount": 1},
                )
            )

    build_specs = [
        ("red", ["yellow", "blue"]),
        ("red", ["yellow", "black"]),
        ("yellow", ["red", "blue"]),
        ("yellow", ["red", "black"]),
        ("blue", ["yellow", "black"]),
        ("blue", ["red", "yellow"]),
        ("black", ["red", "blue"]),
        ("black", ["yellow", "blue"]),
    ]
    for index, (trigger_color, allowed_colors) in enumerate(build_specs):
        cards.append(
            make_card(
                f"l1_build_{trigger_color}_pick_{index + 1}",
                level=1,
                panel="build",
                energy_type=allowed_colors[0],
                cost=2,
                vp=1,
                trigger={"kind": "on_build", "colors": [trigger_color]},
                effect={"kind": "pick_energy", "amount": 1, "colors": allowed_colors},
            )
        )

    for color in ENERGY_TYPES:
        cards.append(
            make_card(
                f"l1_convert_{color}_to_any",
                level=1,
                panel="converter",
                energy_type=color,
                cost=1,
                vp=0,
                effect={"kind": "convert_specific_to_any", "source": color},
            )
        )
    for index, color in enumerate(ENERGY_TYPES):
        cards.append(
            make_card(
                f"l1_convert_any_to_any_{index + 1}",
                level=1,
                panel="converter",
                energy_type=color,
                cost=1,
                vp=0,
                effect={"kind": "convert_any_to_any"},
            )
        )

    for color in ENERGY_TYPES:
        cards.append(
            make_card(
                f"l1_upgrade_storage_{color}",
                level=1,
                panel="upgrade",
                energy_type=color,
                cost=1,
                vp=0,
                effect={"kind": "upgrade_storage", "amount": 1},
            )
        )
    cards.append(
        make_card(
            "l1_upgrade_file_red",
            level=1,
            panel="upgrade",
            energy_type="red",
            cost=2,
            vp=0,
            effect={"kind": "upgrade_file", "amount": 1},
        )
    )
    cards.append(
        make_card(
            "l1_upgrade_file_yellow",
            level=1,
            panel="upgrade",
            energy_type="yellow",
            cost=2,
            vp=0,
            effect={"kind": "upgrade_file", "amount": 1},
        )
    )
    cards.append(
        make_card(
            "l1_upgrade_research_blue",
            level=1,
            panel="upgrade",
            energy_type="blue",
            cost=2,
            vp=0,
            effect={"kind": "upgrade_research", "amount": 1},
        )
    )
    cards.append(
        make_card(
            "l1_upgrade_research_black",
            level=1,
            panel="upgrade",
            energy_type="black",
            cost=2,
            vp=0,
            effect={"kind": "upgrade_research", "amount": 1},
        )
    )
    return cards


def _build_level_2_cards() -> List[Dict]:
    cards: List[Dict] = []

    pick_pairs = [
        ("red", "yellow"),
        ("red", "blue"),
        ("red", "black"),
        ("yellow", "blue"),
        ("yellow", "black"),
        ("blue", "black"),
        ("red", "yellow"),
        ("blue", "black"),
    ]
    for index, (a, b) in enumerate(pick_pairs):
        cards.append(
            make_card(
                f"l2_pick_{a}_{b}_{index + 1}",
                level=2,
                panel="pick",
                energy_type=a,
                cost=3,
                vp=2,
                trigger={"kind": "on_pick", "colors": [a, b]},
                effect={"kind": "draw_random", "amount": 1},
            )
        )

    for index, color in enumerate(ENERGY_TYPES):
        cards.append(
            make_card(
                f"l2_build_archive_pick2_{color}",
                level=2,
                panel="build",
                energy_type=color,
                cost=4,
                vp=2,
                trigger={"kind": "on_build_from_archive"},
                effect={"kind": "pick_energy", "amount": 2, "colors": list(ENERGY_TYPES)},
            )
        )

    build_pick_specs = [
        ("red", "yellow", ["yellow", "blue"]),
        ("yellow", "blue", ["red", "blue"]),
        ("blue", "black", ["yellow", "black"]),
        ("red", "black", ["red", "yellow"]),
        ("yellow", "black", ["blue", "black"]),
        ("red", "blue", ["red", "black"]),
        ("red", "yellow", ["red", "yellow"]),
        ("blue", "black", ["blue", "black"]),
    ]
    for index, (a, b, allowed) in enumerate(build_pick_specs):
        cards.append(
            make_card(
                f"l2_build_{a}_{b}_pick_{index + 1}",
                level=2,
                panel="build",
                energy_type=allowed[0],
                cost=4,
                vp=2,
                trigger={"kind": "on_build", "colors": [a, b]},
                effect={"kind": "pick_energy", "amount": 1, "colors": allowed},
            )
        )

    vp_specs = [
        ("red", "yellow"),
        ("yellow", "blue"),
        ("blue", "black"),
        ("red", "black"),
    ]
    for index, (a, b) in enumerate(vp_specs):
        cards.append(
            make_card(
                f"l2_build_{a}_{b}_vp",
                level=2,
                panel="build",
                energy_type=b,
                cost=4,
                vp=3,
                trigger={"kind": "on_build", "colors": [a, b]},
                effect={"kind": "gain_vp", "amount": 1},
            )
        )

    for color in ENERGY_TYPES:
        for index in range(2):
            cards.append(
                make_card(
                    f"l2_convert_{color}_double_{index + 1}",
                    level=2,
                    panel="converter",
                    energy_type=color,
                    cost=3,
                    vp=1,
                    effect={"kind": "convert_specific_to_double", "source": color},
                )
            )
        cards.append(
            make_card(
                f"l2_convert_{color}_up_to_two",
                level=2,
                panel="converter",
                energy_type=color,
                cost=4,
                vp=1,
                effect={"kind": "convert_specific_up_to_two_to_any", "source": color},
            )
        )

    cards.append(
        make_card(
            "l2_upgrade_storage",
            level=2,
            panel="upgrade",
            energy_type="red",
            cost=3,
            vp=1,
            effect={"kind": "upgrade_storage", "amount": 1},
        )
    )
    cards.append(
        make_card(
            "l2_upgrade_file",
            level=2,
            panel="upgrade",
            energy_type="yellow",
            cost=3,
            vp=1,
            effect={"kind": "upgrade_file", "amount": 1},
        )
    )
    cards.append(
        make_card(
            "l2_upgrade_research",
            level=2,
            panel="upgrade",
            energy_type="blue",
            cost=3,
            vp=1,
            effect={"kind": "upgrade_research", "amount": 1},
        )
    )
    cards.append(
        make_card(
            "l2_upgrade_discount_level2",
            level=2,
            panel="upgrade",
            energy_type="black",
            cost=4,
            vp=1,
            effect={"kind": "discount_level2", "amount": 1},
        )
    )
    return cards


def _build_level_3_cards() -> List[Dict]:
    cards: List[Dict] = []

    generic_effects = [
        {"kind": "draw_random", "amount": 3},
        {"kind": "gain_vp", "amount": 2},
        {"kind": "perform_file"},
        {"kind": "perform_research"},
    ]
    for index, effect in enumerate(generic_effects):
        cards.append(
            make_card(
                f"l3_generic_{index + 1}",
                level=3,
                panel="generic",
                energy_type="generic",
                cost=7,
                vp=7,
                effect=effect,
                immediate_on_build=True,
            )
        )

    upgrade_defs = [
        ("l3_upgrade_disable_file", "red", 5, 5, {"kind": "upgrade_disable_file"}),
        ("l3_upgrade_disable_research", "yellow", 5, 5, {"kind": "upgrade_disable_research"}),
        ("l3_upgrade_extra_storage", "blue", 6, 5, {"kind": "extra_score_storage"}),
        ("l3_upgrade_extra_tokens", "black", 6, 5, {"kind": "extra_score_tokens"}),
        ("l3_upgrade_discount_archive_red", "red", 5, 4, {"kind": "discount_archive", "amount": 1}),
        ("l3_upgrade_discount_archive_blue", "blue", 5, 4, {"kind": "discount_archive", "amount": 1}),
        ("l3_upgrade_discount_research_yellow", "yellow", 5, 4, {"kind": "discount_research", "amount": 1}),
        ("l3_upgrade_discount_research_black", "black", 5, 4, {"kind": "discount_research", "amount": 1}),
    ]
    for card_id, color, cost, vp, effect in upgrade_defs:
        cards.append(make_card(card_id, level=3, panel="upgrade", energy_type=color, cost=cost, vp=vp, effect=effect))

    build_cards = [
        ("l3_build_level2_pick2_red", "red", {"kind": "on_build_level", "level": 2}, {"kind": "pick_energy", "amount": 2, "colors": list(ENERGY_TYPES)}),
        ("l3_build_level2_pick2_blue", "blue", {"kind": "on_build_level", "level": 2}, {"kind": "pick_energy", "amount": 2, "colors": list(ENERGY_TYPES)}),
        ("l3_build_file_red", "red", {"kind": "on_build", "colors": ["red", "yellow"]}, {"kind": "perform_file"}),
        ("l3_build_file_yellow", "yellow", {"kind": "on_build", "colors": ["blue", "yellow"]}, {"kind": "perform_file"}),
        ("l3_build_research_blue", "blue", {"kind": "on_build", "colors": ["blue", "red"]}, {"kind": "perform_research"}),
        ("l3_build_research_red", "red", {"kind": "on_build", "colors": ["yellow", "black"]}, {"kind": "perform_research"}),
        ("l3_build_free_level1_black", "black", {"kind": "on_build", "colors": ["black", "blue"]}, {"kind": "free_build_level1"}),
        ("l3_build_free_level1_yellow", "yellow", {"kind": "on_build", "colors": ["red", "black"]}, {"kind": "free_build_level1"}),
        ("l3_file_draw3_red", "red", {"kind": "on_file"}, {"kind": "draw_random", "amount": 3}),
        ("l3_file_draw3_black", "black", {"kind": "on_file"}, {"kind": "draw_random", "amount": 3}),
        ("l3_file_vp2_blue", "blue", {"kind": "on_file"}, {"kind": "gain_vp", "amount": 2}),
        ("l3_file_vp2_yellow", "yellow", {"kind": "on_file"}, {"kind": "gain_vp", "amount": 2}),
        ("l3_archive_vp2_red", "red", {"kind": "on_build_from_archive"}, {"kind": "gain_vp", "amount": 2}),
        ("l3_archive_vp2_black", "black", {"kind": "on_build_from_archive"}, {"kind": "gain_vp", "amount": 2}),
        ("l3_build_vp2_blue", "blue", {"kind": "on_build", "colors": ["blue", "yellow"]}, {"kind": "gain_vp", "amount": 2}),
        ("l3_build_vp2_yellow", "yellow", {"kind": "on_build", "colors": ["red", "black"]}, {"kind": "gain_vp", "amount": 2}),
    ]
    for card_id, color, trigger, effect in build_cards:
        cards.append(
            make_card(
                card_id,
                level=3,
                panel="build" if effect["kind"] != "draw_random" and trigger["kind"] != "on_file" else "file",
                energy_type=color,
                cost=6,
                vp=5 if effect["kind"] in {"perform_file", "perform_research", "free_build_level1"} else 4,
                trigger=trigger,
                effect=effect,
            )
        )

    converter_defs = [
        ("l3_convert_red_up_to_two", "red", {"kind": "convert_specific_up_to_two_to_any", "source": "red"}),
        ("l3_convert_blue_up_to_two", "blue", {"kind": "convert_specific_up_to_two_to_any", "source": "blue"}),
        ("l3_convert_pair_yellow_black", "yellow", {"kind": "convert_each_specific_to_double", "sources": ["yellow", "black"]}),
        ("l3_convert_pair_red_blue", "black", {"kind": "convert_each_specific_to_double", "sources": ["red", "blue"]}),
    ]
    for card_id, color, effect in converter_defs:
        cards.append(make_card(card_id, level=3, panel="converter", energy_type=color, cost=5, vp=4, effect=effect))

    while len(cards) < 36:
        filler_index = len(cards) + 1
        color = ENERGY_TYPES[(filler_index - 1) % len(ENERGY_TYPES)]
        cards.append(
            make_card(
                f"l3_filler_vp_{filler_index}",
                level=3,
                panel="build",
                energy_type=color,
                cost=6,
                vp=4,
                trigger={"kind": "on_build", "colors": [color]},
                effect={"kind": "gain_vp", "amount": 1},
            )
        )
    return cards[:36]


LEVEL_1_CARDS = _build_level_1_cards()
LEVEL_2_CARDS = _build_level_2_cards()
LEVEL_3_CARDS = _build_level_3_cards()
ALL_CARD_DEFS = LEVEL_1_CARDS + LEVEL_2_CARDS + LEVEL_3_CARDS + [STARTING_GIZMO]
CARD_DEFS_BY_ID = {card["id"]: card for card in ALL_CARD_DEFS}
