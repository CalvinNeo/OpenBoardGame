"""Curated Ark Nova base-card rules used by the card-data generator.

The local markdown contains the complete card list and the text printed in the
main text box.  This module adds rule timing, the effects represented only by
icons on Sponsor cards, and official glossary clarifications.  It intentionally
contains no card artwork.
"""

from __future__ import annotations


SOURCE_REFERENCES = [
    {
        "kind": "official_rulebook",
        "title": "Ark Nova Rulebook",
        "url": "https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006",
        "used_for": ["action_cards", "play_costs", "turn_timing", "association_tasks"],
    },
    {
        "kind": "official_glossary",
        "title": "Ark Nova Glossary",
        "url": "https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544",
        "used_for": ["animal_abilities", "sponsor_effects", "release_projects"],
    },
    {
        "kind": "official_faq",
        "title": "Ark Nova FAQ v2",
        "url": "https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-FAQ-v2.pdf?v=1754428544",
        "used_for": ["edge_cases", "ability_interactions"],
    },
    {
        "kind": "community_database",
        "title": "Next Ark Nova Cards",
        "url": "https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards",
        "used_for": ["card_ids", "names", "localized_text", "metadata_cross_check"],
    },
    {
        "kind": "community_database",
        "title": "Ark Nova Cards Manager",
        "url": "https://github.com/PixelT/ArkNovaCardsManager",
        "used_for": ["visual_cross_check_only"],
    },
    {
        "kind": "steam_workshop_component_reference",
        "title": "方舟动物园 Ark Nova (Tabletop Simulator Workshop)",
        "url": "https://steamcommunity.com/sharedfiles/filedetails/?id=3527313436",
        "used_for": ["unique_building_footprints", "component_cross_check"],
        "note": "Only derived rules and hex geometry are shipped; no Workshop artwork is copied.",
    },
]


TAG_CODES = {
    "非洲": "africa",
    "美洲": "americas",
    "澳洲": "australia",
    "亚洲": "asia",
    "欧洲": "europe",
    "鸟类": "bird",
    "食肉类": "predator",
    "爬行类": "reptile",
    "食草类": "herbivore",
    "灵长类": "primate",
    "萌宠动物": "petting_zoo_animal",
    "熊类": "bear",
    "科研": "science",
    "水域": "water",
    "岩石": "rock",
    "任意动物类目": "any_animal_category",
    "任意大洲": "any_continent",
    "小型动物": "small_animal",
    "大型动物": "large_animal",
}


ACTION_CARDS = [
    {
        "id": "cards",
        "name_zh": "卡牌",
        "name_en": "Cards",
        "common": {
            "break_steps_before_resolution": 2,
            "hand_limit_checked_during_break_only": True,
        },
        "sides": {
            "I": {
                "level": 1,
                "summary_zh": "先推进休息2格。强度1–5依次抽/弃：1/1、1/0、2/1、2/0、3/1；强度5可改为精准拿牌。",
                "draw_discard_by_strength": {
                    "1": {"draw": 1, "discard": 1},
                    "2": {"draw": 1, "discard": 0},
                    "3": {"draw": 2, "discard": 1},
                    "4": {"draw": 2, "discard": 0},
                    "5": {"draw": 3, "discard": 1},
                },
                "snap_at_strength": [5],
                "draw_sources": ["deck"],
            },
            "II": {
                "level": 2,
                "summary_zh": "先推进休息2格。强度1–5依次抽/弃：1/0、2/1、2/0、3/1、4/1；强度3–5可精准拿牌；可从声望范围抽牌并可越过声望9。",
                "draw_discard_by_strength": {
                    "1": {"draw": 1, "discard": 0},
                    "2": {"draw": 2, "discard": 1},
                    "3": {"draw": 2, "discard": 0},
                    "4": {"draw": 3, "discard": 1},
                    "5": {"draw": 4, "discard": 1},
                },
                "snap_at_strength": [3, 4, 5],
                "draw_sources": ["deck", "display_within_reputation_range"],
                "allows_reputation_above_9": True,
            },
        },
        "snap_rule_zh": "拿取展示区任意1张牌；无需在声望范围内，回合结束时再补展示区。",
    },
    {
        "id": "build",
        "name_zh": "建造",
        "name_en": "Build",
        "common": {"money_per_hex": 2, "must_follow_adjacency_rules": True},
        "sides": {
            "I": {
                "level": 1,
                "summary_zh": "建造恰好1个建筑，面积不超过行动强度，每格2金币；可建标准围栏、贩售亭、休憩亭和萌宠馆。",
                "building_count": 1,
                "maximum_total_hexes": "action_strength",
                "allowed": ["standard_enclosure", "kiosk", "pavilion", "petting_zoo"],
            },
            "II": {
                "level": 2,
                "summary_zh": "建造一个或多个不同建筑，总面积不超过行动强度，每格2金币；新增可建大型鸟舍和爬虫馆。",
                "building_count": "one_or_more_different_buildings",
                "maximum_total_hexes": "action_strength",
                "allowed": [
                    "standard_enclosure",
                    "kiosk",
                    "pavilion",
                    "petting_zoo",
                    "reptile_house",
                    "large_bird_aviary",
                ],
            },
        },
    },
    {
        "id": "animals",
        "name_zh": "动物",
        "name_en": "Animals",
        "common": {
            "resolve_each_animal_fully_in_play_order": True,
            "partner_zoo_discount_per_matching_continent_icon": 3,
        },
        "sides": {
            "I": {
                "level": 1,
                "summary_zh": "只能从手牌打动物；强度1–5最多打0、1、1、1、2张。",
                "maximum_cards_by_strength": {"1": 0, "2": 1, "3": 1, "4": 1, "5": 2},
                "sources": ["hand"],
            },
            "II": {
                "level": 2,
                "summary_zh": "可从手牌或声望范围打动物，展示牌额付文件夹金币；强度1–5最多打1、1、2、2、2张；强度5先得1声望。",
                "maximum_cards_by_strength": {"1": 1, "2": 1, "3": 2, "4": 2, "5": 2},
                "sources": ["hand", "display_within_reputation_range"],
                "display_surcharge": "folder_number",
                "strength_5_bonus": {"reputation": 1},
            },
        },
    },
    {
        "id": "association",
        "name_zh": "协会",
        "name_en": "Association",
        "common": {
            "task_strengths": {
                "gain_2_reputation": 2,
                "take_partner_zoo": 3,
                "take_university": 4,
                "support_conservation_project": 5,
            },
            "workers_for_repeated_same_task": "1 worker normally; 2 if one of your workers is already there; unavailable if three are already there",
        },
        "sides": {
            "I": {
                "level": 1,
                "summary_zh": "执行恰好1项协会任务，任务强度不超过行动强度。",
                "tasks": "exactly_one",
                "maximum_total_strength": "action_strength",
            },
            "II": {
                "level": 2,
                "summary_zh": "执行一项或多项不同任务，总强度不超过行动强度；至少执行1项任务后可捐赠1次；可从声望范围打保育项目并支付文件夹金币。",
                "tasks": "one_or_more_different_tasks",
                "maximum_total_strength": "action_strength",
                "may_donate_once_after_at_least_one_task": True,
                "donation": "pay the smallest visible donation amount; after all finite spaces are used, pay 12",
                "may_play_project_from_display": True,
                "display_surcharge": "folder_number",
            },
        },
    },
    {
        "id": "sponsors",
        "name_zh": "赞助商",
        "name_en": "Sponsors",
        "common": {"base_money_cost": 0},
        "sides": {
            "I": {
                "level": 1,
                "summary_zh": "从手牌打恰好1张强度不超过X的赞助商；或推进休息X格并得X金币。",
                "play": "exactly_one_sponsor_from_hand_with_strength_at_most_action_strength",
                "alternative": "advance_break_by_X_and_gain_X_money",
            },
            "II": {
                "level": 2,
                "summary_zh": "从手牌/声望范围打一张或多张赞助商，总强度不超过X+1，展示牌额付文件夹金币；或推进休息X格并得2X金币。",
                "play": "one_or_more_sponsors_with_total_strength_at_most_action_strength_plus_1",
                "sources": ["hand", "display_within_reputation_range"],
                "display_surcharge": "folder_number",
                "alternative": "advance_break_by_X_and_gain_2X_money",
            },
        },
    },
]


def _ability(
    name_zh: str,
    name_en: str,
    timing: str,
    cascade: str,
    rules_zh: str,
    *,
    parameters: list[str] | None = None,
    edge_cases_zh: list[str] | None = None,
) -> dict[str, object]:
    return {
        "name_zh": name_zh,
        "name_en": name_en,
        "timing": timing,
        "cascade": cascade,
        "parameters": parameters or [],
        "rules_zh": rules_zh,
        "edge_cases_zh": edge_cases_zh or [],
    }


ANIMAL_ABILITY_DEFINITIONS = {
    "sprint": _ability("疾跑", "Sprint", "immediate", "draw_cards", "从牌库抽取N张牌。", parameters=["draw_count"]),
    "pack": _ability("群居", "Pack", "immediate", "scaling_reward", "按自己动物园中的食肉类图标数，每个获得1吸引力；本牌图标也计入。"),
    "hunter": _ability("狩猎", "Hunter", "immediate", "reveal_and_choose", "展示牌库顶N张牌，至多保留其中1张动物牌，其余弃掉。", parameters=["reveal_count"], edge_cases_zh=["若没有动物牌，全部弃掉。"]),
    "clever": _ability("机灵", "Clever", "after_action", "reposition_action", "完成整个动物行动后，可将任意1张行动牌移到槽位1。"),
    "boost_association": _ability("推动：协会", "Boost: Association", "after_action", "reposition_action", "完成动物行动后，可将协会行动牌移到槽位1或5。"),
    "boost_building": _ability("推动：建造", "Boost: Build", "after_action", "reposition_action", "完成动物行动后，可将建造行动牌移到槽位1或5。"),
    "boost_cards": _ability("推动：卡牌", "Boost: Cards", "after_action", "reposition_action", "完成动物行动后，可将卡牌行动牌移到槽位1或5。"),
    "boost_sponsors": _ability("推动：赞助商", "Boost: Sponsors", "after_action", "reposition_action", "完成动物行动后，可将赞助商行动牌移到槽位1或5。"),
    "boost_animal": _ability("推动：动物", "Boost: Animals", "after_action", "reposition_action", "完成动物行动后，可将动物行动牌移到槽位1或5。"),
    "action_association": _ability("行动：协会", "Action: Association", "after_action", "extra_specific_action", "完成动物行动后，按协会牌当前槽位、升级面和修正正常执行一次协会行动。", edge_cases_zh=["必须执行指定行动，不能改做获得X标记的替代行动。"]),
    "action_building": _ability("行动：建造", "Action: Build", "after_action", "extra_specific_action", "完成动物行动后，按建造牌当前槽位、升级面和修正正常执行一次建造行动。", edge_cases_zh=["必须执行指定行动，不能改做获得X标记的替代行动。"]),
    "action_cards": _ability("行动：卡牌", "Action: Cards", "after_action", "extra_specific_action", "完成动物行动后，按卡牌牌当前槽位、升级面和修正正常执行一次卡牌行动。", edge_cases_zh=["必须执行指定行动，不能改做获得X标记的替代行动。"]),
    "action_sponsors": _ability("行动：赞助商", "Action: Sponsors", "after_action", "extra_specific_action", "完成动物行动后，按赞助商牌当前槽位、升级面和修正正常执行一次赞助商行动。", edge_cases_zh=["必须执行指定行动，不能改做获得X标记的替代行动。"]),
    "inventive": _ability("创造力", "Inventive", "immediate", "gain_x_tokens", "获得N枚X标记，上限仍为5。", parameters=["x_tokens"]),
    "inventive_bear": _ability("创造力：熊", "Inventive: Bear", "immediate", "scaling_reward", "按所有动物园中的熊类图标获得X标记，最多3枚。"),
    "inventive_primate": _ability("创造力：灵长类", "Inventive: Primates", "immediate", "threshold_reward", "自己有1/3/5个灵长类图标时，分别获得1/2/3枚X标记。"),
    "full_throated": _ability("呼唤", "Full-throated", "immediate", "hire_worker", "从个人板最低的协会事务员储存位雇佣1名事务员。", edge_cases_zh=["若已全部雇佣则无效果。"]),
    "jumping": _ability("跳跃", "Jumping", "immediate", "advance_break", "将休息标记推进N格并获得N金币。", parameters=["break_steps", "money"], edge_cases_zh=["若到达最后一格，先得1枚X标记，回合结束后再结算休息。"]),
    "multiplier_association": _ability("双重：协会", "Multiplier: Association", "immediate", "future_multi_action", "在协会行动牌上放1枚双倍标记；下次执行时，每枚标记都让该行动以相同强度多执行一次。", edge_cases_zh=["多枚双倍标记可以叠加。", "X标记只增强其中一次子行动；全部子行动完成后才处理“行动后”效果和休息。", "使用后或下次休息时归还。"]),
    "multiplier_building": _ability("双重：建造", "Multiplier: Build", "immediate", "future_multi_action", "在建造行动牌上放1枚双倍标记；下次执行时，每枚标记都让该行动以相同强度多执行一次。", edge_cases_zh=["多枚双倍标记可以叠加。", "X标记只增强其中一次子行动；全部子行动完成后才处理“行动后”效果和休息。", "使用后或下次休息时归还。"]),
    "multiplier_cards": _ability("双重：卡牌", "Multiplier: Cards", "immediate", "future_multi_action", "在卡牌行动牌上放1枚双倍标记；下次执行时，每枚标记都让该行动以相同强度多执行一次。", edge_cases_zh=["多枚双倍标记可以叠加。", "X标记只增强其中一次子行动；全部子行动完成后才处理“行动后”效果和休息。", "使用后或下次休息时归还。"]),
    "multiplier_sponsors": _ability("双重：赞助商", "Multiplier: Sponsors", "immediate", "future_multi_action", "在赞助商行动牌上放1枚双倍标记；下次执行时，每枚标记都让该行动以相同强度多执行一次。", edge_cases_zh=["多枚双倍标记可以叠加。", "X标记只增强其中一次子行动；全部子行动完成后才处理“行动后”效果和休息。", "使用后或下次休息时归还。"]),
    "iconic_animal": _ability("标志性动物", "Iconic Animal", "immediate", "global_scaling_reward", "按所有动物园中指定大洲图标的总数获得吸引力，最多8。", parameters=["continent", "maximum_appeal"]),
    "sun_bathing": _ability("日光浴", "Sunbathing", "immediate", "discard_for_money", "最多卖出N张手牌，每张获得4金币并置入弃牌堆。", parameters=["maximum_cards", "money_per_card"]),
    "pouch": _ability("育儿袋", "Pouch", "immediate", "tuck_cards", "最多把N张手牌压在本牌下，每张获得2吸引力。", parameters=["maximum_cards"], edge_cases_zh=["压在牌下的牌不再有任何功能；放归该动物时一并弃掉且不失去这部分吸引力。"]),
    "resistance": _ability("抵抗", "Resistance", "immediate", "gain_final_scoring_card", "抽2张终局计分牌，保留1张、弃1张。", edge_cases_zh=["达到10保育时可从自己所有终局计分牌中任选1张弃掉；终局结算其余全部。"]),
    "assertion": _ability("执着", "Assertion", "immediate", "fetch_base_project", "从未使用的基础保育项目中任选1张加入手牌，之后可按通常规则打到协会板上方。"),
    "digging": _ability("刨挖", "Digging", "immediate", "repeatable_choice", "依次选择最多N次：弃展示区1张并立刻补牌，或弃手牌1张后从牌库抽1张。", parameters=["maximum_repetitions"]),
    "sponsor_magnet": _ability("招商", "Sponsor Magnet", "immediate", "take_display_cards", "把展示区内全部赞助商牌加入手牌；忽略声望范围，回合结束时再补展示区。"),
    "flock_animal": _ability("群集动物", "Flock Animal", "during_placement", "shared_enclosure", "可与已在园内、所需围栏尺寸至少为N的食草动物共享其已占用围栏；否则仍可正常占用围栏。", parameters=["minimum_host_enclosure_size"], edge_cases_zh=["同一只食草动物可承载多只群集动物。"]),
    "venom": _ability("毒液", "Venom", "immediate", "opponent_action_debuff", "每名吸引力至少5且在你之前的玩家获得N枚毒液标记，依次放到其最低且未放毒液的行动牌上。", parameters=["tokens_per_target"], edge_cases_zh=["同一行动牌不能有两枚毒液。", "使用中毒行动时移除其毒液；若回合结束仍未移除任何毒液，须支付2金币。", "把中毒行动牌用于获得X标记的替代行动也会移除毒液（已持有5枚X而无法执行时除外）。", "休息时移除全部毒液。"]),
    "dominance": _ability("支配", "Dominance", "immediate", "fetch_specific_base_project", "若指定动物类目的基础保育项目未在游戏中，将它加入手牌。", parameters=["project_tag"]),
    "pilfering_1": _ability("偷窃1", "Pilfering 1", "immediate", "opponent_choice_loss", "吸引力最高且至少为5的目标选择：给你5金币，或让你随机拿其1张手牌。", edge_cases_zh=["并列目标由你选择；目标缺少一种资源时只能给另一种。"]),
    "pilfering_2": _ability("偷窃2", "Pilfering 2", "immediate", "opponent_choice_loss_twice", "依次对吸引力最高的玩家和保育最高的玩家各结算一次偷窃；保育目标须至少有1保育。", edge_cases_zh=["若两次命中同一玩家，也要依次结算；该玩家第二次可以改选另一种损失。"]),
    "snapping_1": _ability("捕捉1", "Snapping 1", "immediate", "take_display_card", "从展示区任选1张牌加入手牌，忽略声望范围；回合结束时补展示区。"),
    "snapping_2": _ability("捕捉2", "Snapping 2", "immediate", "take_display_card_twice", "依次从展示区任选1张牌两次；可选择在两次之间补牌。"),
    "constriction": _ability("缠绕", "Constriction", "immediate", "opponent_action_debuff", "每名至少有5吸引力的玩家，每有一条计分轨领先你便获得1枚缠绕，放到其最高且未放缠绕的行动牌上；该牌本次强度-2。", edge_cases_zh=["结算顺序可放在本动物印刷吸引力之前或之后。", "同一行动牌不能有两枚缠绕；双倍行动的每个子行动都减2。", "缠绕牌到槽位1/2时可能变成-1/0，须用足够X标记升到至少1，或改做获得X标记的替代行动。", "行动结算后移除该标记；休息时移除所有剩余标记。"]),
    "hypnosis": _ability("催眠", "Hypnosis", "after_action", "borrow_opponent_action", "完成动物行动后，选择吸引力最高且至少为5的玩家槽位1、2或3的一张行动牌，按该玩家的升级面执行并把该牌移到槽位1。", edge_cases_zh=["可用自己的X标记；目标牌上的毒液/缠绕生效。", "不能使用双倍标记。", "独特建筑能否覆盖个人板的建造II格，仍看自己的建造牌是否升级。", "若目标是自己则无效。"]),
    "scavenging": _ability("食腐", "Scavenging", "immediate", "draw_from_discard", "将弃牌堆面朝下洗匀，随机抽N张，保留1张并弃掉其余。", parameters=["draw_count"]),
    "posturing": _ability("姿态", "Posturing", "immediate", "free_build", "最多N次免费放置1个贩售亭或休憩亭，仍遵守通常放置规则。", parameters=["maximum_buildings"]),
    "perception_2": _ability("洞察力2", "Perception 2", "immediate", "draw_and_keep", "从牌库抽2张，保留1张并弃1张。"),
    "perception_4": _ability("洞察力4", "Perception 4", "immediate", "draw_and_keep", "从牌库抽4张，保留2张并弃2张。"),
    "determination": _ability("果断", "Determination", "after_action", "extra_any_action", "完成动物行动后，任选另一张行动牌正常执行一次，并按通常规则移动。", edge_cases_zh=["与指定的“行动：X”不同，果断允许选择获得X标记的替代行动。"]),
    "peacocking": _ability("炫耀", "Peacocking", "immediate", "free_special_enclosure", "如可能，免费放置大型鸟舍；无需建造行动II，但仍遵守放置规则。"),
    "petting_zoo_animal": _ability("萌宠动物", "Petting Zoo Animal", "immediate", "scaling_reward", "按自己园内萌宠类图标总数，每个获得3吸引力；因此第1/2/3只分别令总收益增加3/6/9。", edge_cases_zh=["只能拥有1座萌宠馆，因此通常最多容纳3只。", "萌宠动物也算小型动物。"]),
}


ANIMAL_ABILITY_PATTERNS = [
    ("boost_association", r"推动[:：]\s*协会"),
    ("boost_building", r"推动[:：]\s*建造"),
    ("boost_cards", r"推动[:：]\s*卡牌"),
    ("boost_sponsors", r"推动[:：]\s*赞助商"),
    ("boost_animal", r"推动[:：]\s*动物"),
    ("action_association", r"行动[:：]\s*协会"),
    ("action_building", r"行动[:：]\s*建造"),
    ("action_cards", r"行动[:：]\s*卡牌"),
    ("action_sponsors", r"行动[:：]\s*赞助商"),
    ("inventive_bear", r"创造力[:：]\s*熊"),
    ("inventive_primate", r"创造力[:：]\s*灵长类"),
    ("multiplier_association", r"双重[:：]\s*协会"),
    ("multiplier_building", r"双重[:：]\s*建造"),
    ("multiplier_cards", r"双重[:：]\s*卡牌"),
    ("multiplier_sponsors", r"双重[:：]\s*赞助商"),
    ("pilfering_1", r"偷窃\s*1"),
    ("pilfering_2", r"偷窃\s*2"),
    ("snapping_1", r"捕捉\s*1"),
    ("snapping_2", r"捕捉\s*2"),
    ("perception_4", r"洞察力\s*4"),
    ("sprint", r"疾跑"),
    ("pack", r"群居"),
    ("hunter", r"狩猎"),
    ("clever", r"机灵"),
    ("full_throated", r"呼唤"),
    ("jumping", r"跳跃"),
    ("inventive", r"创造力"),
    ("iconic_animal", r"标志性动物"),
    ("sun_bathing", r"日光浴"),
    ("pouch", r"育儿袋"),
    ("resistance", r"抵抗"),
    ("assertion", r"执着"),
    ("flock_animal", r"群集动物"),
    ("digging", r"刨挖"),
    ("sponsor_magnet", r"招商"),
    ("venom", r"毒液"),
    ("dominance", r"支配"),
    ("constriction", r"缠绕"),
    ("hypnosis", r"催眠"),
    ("scavenging", r"食腐"),
    ("posturing", r"姿态"),
    ("determination", r"果断"),
    ("peacocking", r"炫耀"),
    ("petting_zoo_animal", r"萌宠动物"),
]


# Timings correspond to the semicolon-separated effects in designs/4.rule.md.
SPONSOR_EFFECT_TIMINGS = {
    "201": ("income", "endgame"), "202": ("passive",), "203": ("passive",),
    "204": ("passive",), "205": (), "206": ("income",), "207": ("immediate",),
    "208": ("passive", "endgame"), "209": ("income",), "210": ("passive",),
    "211": ("passive",), "212": ("passive",), "213": ("passive",),
    "214": ("passive",), "215": ("setup_and_passive", "endgame"),
    "216": ("immediate",), "217": ("passive",),
    "218": ("setup_and_passive", "endgame"),
    "219": ("passive", "immediate"), "220": ("income",), "221": ("passive",),
    "222": ("immediate",), "223": (), "224": ("passive",),
    "225": ("passive", "endgame"), "226": ("endgame",),
    "227": ("immediate", "passive"), "228": ("passive",),
    "229": ("passive",), "230": ("passive",),
    "231": ("income",), "232": ("income",), "233": ("income",),
    "234": ("income",), "235": ("income",),
    "236": ("passive",), "237": ("passive",), "238": ("passive",),
    "239": ("passive",), "240": ("passive",),
    "241": ("passive", "endgame"), "242": ("passive", "endgame"),
    "243": ("passive", "immediate"), "244": ("passive", "immediate"),
    "245": ("passive", "immediate"), "246": ("passive", "immediate"),
    "247": ("passive", "immediate"), "248": ("passive",),
    "249": ("passive",), "250": ("passive",),
    "251": ("passive", "immediate", "endgame"), "252": ("passive",),
    "253": ("setup_and_passive",), "254": ("immediate",),
    "255": ("immediate",), "256": ("immediate",),
    "257": ("immediate", "income", "endgame"),
    "258": ("immediate", "endgame"), "259": ("immediate", "endgame"),
    "260": ("immediate", "endgame"), "261": ("endgame",),
    "262": ("passive", "immediate"), "263": ("passive", "immediate"),
    "264": ("immediate", "endgame"),
}


def _effect(timing: str, kind: str, text_zh: str) -> dict[str, str]:
    return {
        "timing": timing,
        "kind": kind,
        "cascade": "none",
        "text_zh": text_zh,
        "source": "official_glossary",
    }


# These effects are printed as icons outside the main text box and were absent
# from the community localization used to create designs/4.rule.md.
SPONSOR_EXTRA_EFFECTS = {
    "201": [_effect("immediate", "take_card", "打出时，从牌库抽1张，或拿取声望范围内的1张展示牌。")],
    "203": [
        _effect("immediate", "money_by_universities", "拥有1/2/3所大学时，获得2/5/10金币。"),
        _effect("endgame", "conservation_threshold", "拥有3所大学时，获得1保育。"),
    ],
    "204": [_effect("immediate", "money_per_icon", "自己每个科研图标获得2金币。")],
    "206": [_effect("immediate", "appeal_per_supported_project", "每个已支持的保育项目获得2吸引力。")],
    "208": [_effect("immediate", "appeal_per_icon", "自己每个科研图标获得1吸引力。")],
    "209": [
        _effect("immediate", "gain_x_token", "打出时获得1枚X标记。"),
        _effect("endgame", "conservation_threshold", "拥有3所大学时，获得1保育。"),
    ],
    "210": [
        _effect("immediate", "appeal_per_icon", "自己每个美洲图标获得1吸引力。"),
        _effect("endgame", "conservation_threshold", "拥有至少5个贩售亭时，获得1保育。"),
    ],
    "211": [
        _effect("immediate", "appeal_per_icon", "自己每个欧洲图标获得1吸引力。"),
        _effect("endgame", "conservation_threshold", "拥有至少5个已占用的1格标准围栏时，获得1保育。"),
    ],
    "212": [_effect("immediate", "appeal_per_icon", "自己每个澳洲图标获得1吸引力。")],
    "213": [_effect("immediate", "appeal_per_icon", "自己每个亚洲图标获得1吸引力。")],
    "214": [
        _effect("immediate", "appeal_per_icon", "自己每个非洲图标获得1吸引力。"),
        _effect("endgame", "appeal_per_x_token", "终局时，每枚持有的X标记获得1吸引力。"),
    ],
    "216": [_effect("endgame", "conservation_threshold", "声望至少9时，获得1保育。")],
    "217": [_effect("endgame", "appeal_threshold", "地图除水域、岩石外全部覆盖时，获得5吸引力。")],
    "219": [_effect("endgame", "appeal_per_pair", "每组1个水域图标加1个岩石图标获得2吸引力，最多计算3组。")],
    "220": [
        _effect("immediate", "gain_money", "打出时获得3金币。"),
        _effect("endgame", "conservation_threshold", "声望至少9时，获得1保育。"),
    ],
    "221": [_effect("endgame", "conservation_threshold", "覆盖所有边界格（不含水域、岩石）时，获得1保育。")],
    "224": [_effect("immediate", "gain_x_token", "打出时获得1枚X标记。")],
    "225": [_effect("immediate", "gain_x_token", "打出时获得1枚X标记。")],
    "228": [_effect("immediate", "money_per_small_animal", "自己每只小型动物获得2金币。")],
    "229": [_effect("immediate", "appeal_per_small_animal", "自己每只小型动物获得1吸引力。")],
    "230": [_effect("immediate", "appeal_per_large_animal", "自己每只大型动物获得2吸引力。")],
    "231": [_effect("immediate", "appeal_per_icon", "自己每个灵长类图标获得1吸引力。")],
    "232": [_effect("immediate", "appeal_per_icon", "自己每个爬行类图标获得1吸引力。")],
    "233": [_effect("immediate", "appeal_per_icon", "自己每个鸟类图标获得1吸引力。")],
    "234": [_effect("immediate", "appeal_per_icon", "自己每个食肉类图标获得1吸引力。")],
    "235": [_effect("immediate", "appeal_per_icon", "自己每个食草类图标获得1吸引力。")],
    "241": [_effect("immediate", "appeal_per_icon", "自己每个水域图标获得1吸引力。")],
    "242": [_effect("immediate", "appeal_per_icon_pair", "自己每2个岩石图标获得3吸引力。")],
    "243": [_effect("endgame", "conservation_threshold", "至少6个食草类图标时，获得1保育。")],
    "244": [_effect("endgame", "conservation_threshold", "至少6个鸟类图标时，获得1保育。")],
    "245": [_effect("endgame", "conservation_threshold", "至少6个水域图标时，获得1保育。")],
    "246": [_effect("endgame", "conservation_threshold", "至少6个岩石图标时，获得1保育。")],
    "247": [_effect("endgame", "conservation_threshold", "至少6个灵长类图标时，获得1保育。")],
}


def _unique_building_footprint(*cells: tuple[int, int]) -> dict[str, object]:
    """Return a canonical, rotation-ready polyhex footprint.

    The identity symbol printed on each tile is the (0, 0) anchor.  Coordinates
    use the same flat-top axial convention as map0.json.  The physical tile must
    stay colored-side-up, so rotations are legal but reflections are not.
    """

    return {
        "grid": "hex_axial",
        "orientation": "flat_top",
        "anchor_cell": {"q": 0, "r": 0},
        "cells": [{"q": q, "r": r} for q, r in cells],
        "cell_count": len(cells),
        "allowed_rotation_steps": [0, 1, 2, 3, 4, 5],
        "degrees_per_rotation_step": 60,
        "clockwise_rotation": "(q,r)->(-r,q+r)",
        "reflection_allowed": False,
        "source": "printed_card_diagram_cross_checked_with_steam_workshop_component",
    }


# The canonical direction of a tile is arbitrary during play; preserving the
# cell set and disallowing reflection preserves every physical placement.
UNIQUE_BUILDING_FOOTPRINTS = {
    "243": _unique_building_footprint((0, 0), (-1, 1), (1, 0)),
    "244": _unique_building_footprint((0, 0), (-1, 0), (1, -1), (1, 0)),
    "245": _unique_building_footprint((0, 0), (-1, 1), (1, 0), (1, 1)),
    "246": _unique_building_footprint((0, 0), (1, -1), (-1, 1), (-2, 2)),
    "247": _unique_building_footprint((0, 0), (-1, 0), (1, 0), (0, 1)),
    "248": _unique_building_footprint((0, 0), (-1, 0), (-2, 1), (1, 0)),
    "249": _unique_building_footprint((0, 0), (-1, 0), (1, 0)),
    "250": _unique_building_footprint((0, 0), (-1, 0), (1, -1), (0, 1)),
    "251": _unique_building_footprint((0, 0), (-1, 1), (1, 0), (2, -1)),
    "252": _unique_building_footprint((0, 0), (-1, 0), (1, -1), (2, -2)),
    "253": _unique_building_footprint((0, 0), (-2, 1), (-1, 1), (1, 0)),
    "254": _unique_building_footprint((0, 0), (-1, 0), (1, -1)),
    "255": _unique_building_footprint((0, 0), (1, 0)),
    "256": _unique_building_footprint((0, 0), (1, 0)),
    "257": _unique_building_footprint((0, 0), (1, 0)),
}

UNIQUE_BUILDING_SPONSOR_IDS = set(UNIQUE_BUILDING_FOOTPRINTS)


# Machine-readable interpretations of the final-scoring cards.  Threshold cards
# still keep their printed ladder in ``scoring_steps``; this registry defines
# exactly what is counted so the rules engine does not have to infer it from
# prose.  Card 004 and card 009 are independent-condition scorers instead.
FINAL_SCORING_RULES = {
    "001": {
        "kind": "metric_ladder",
        "metric": "large_animal_count",
        "definition_zh": "大型动物指需要尺寸4或5普通围栏的动物；特殊围栏里的动物不计。",
    },
    "002": {
        "kind": "metric_ladder",
        "metric": "small_animal_count",
        "definition_zh": "小型动物指需要尺寸1或2围栏的动物；宠物动物均视为小型动物。",
    },
    "003": {
        "kind": "metric_ladder",
        "metric": "science_icon_count",
        "definition_zh": "计算自己动物园中的研究图标。",
    },
    "004": {
        "kind": "independent_conditions",
        "conditions": [
            {
                "id": "all_water_spaces_connected",
                "reward": {"conservation": 1},
                "rule_zh": "地图上的每个水域格都至少邻接一个已覆盖的可建造格。",
            },
            {
                "id": "all_rock_spaces_connected",
                "reward": {"conservation": 1},
                "rule_zh": "地图上的每个岩石格都至少邻接一个已覆盖的可建造格。",
            },
            {
                "id": "all_buildable_border_spaces_covered",
                "reward": {"conservation": 1},
                "rule_zh": "地图边界上的所有可建造格均已覆盖。",
            },
            {
                "id": "all_buildable_spaces_covered",
                "reward": {"conservation": 1},
                "rule_zh": "地图上的所有可建造格均已覆盖。",
            },
        ],
        "building_spaces_exclude": ["water", "rock"],
        "connected_means": "orthogonally_adjacent_hex",
        "score_each_condition_once": True,
    },
    "005": {
        "kind": "metric_ladder",
        "metric": "supported_conservation_project_count",
        "definition_zh": "计算自己已支持的保育项目数量。",
    },
    "006": {
        "kind": "metric_ladder",
        "metric": "empty_buildable_hex_count",
        "definition_zh": "计算未被覆盖的可建造格；即使尚未升级建造行动牌，标有建造II限制的格也计入。",
        "include_build_ii_restricted_spaces": True,
    },
    "007": {
        "kind": "metric_ladder",
        "metric": "reputation",
        "definition_zh": "读取自己当前的声望值。",
    },
    "008": {
        "kind": "metric_ladder",
        "metric": "sponsor_card_count",
        "definition_zh": "计算自己已打出的赞助商牌数量。",
    },
    "009": {
        "kind": "compare_right_hand_neighbor",
        "metrics": ["bird", "herbivore", "predator", "primate", "reptile"],
        "comparison": "strictly_greater",
        "reward_per_won_metric": {"conservation": 1},
        "maximum_conservation": 4,
        "ties_score": False,
        "definition_zh": "分别比较五种动物类别图标；每种严格多于右手边玩家时得1保育，最多4保育。",
    },
    "010": {
        "kind": "metric_ladder",
        "metric": "rock_icon_count",
        "definition_zh": "计算自己动物园中的岩石图标。",
    },
    "011": {
        "kind": "metric_ladder",
        "metric": "water_icon_count",
        "definition_zh": "计算自己动物园中的水域图标。",
    },
}


DATA_CORRECTIONS = [
    {"card_id": "463", "field": "cost", "value": 11, "note_zh": "社区元数据曾误记为14；卡面为11。"},
    {"card_id": "482", "field": "placement", "value": {"water": 1, "rock": 1}, "note_zh": "补齐卡面左上角的临水、临岩要求。"},
    {"card_id": "251", "field": "placement", "value": {"water": 1}, "note_zh": "补齐北极熊展独特建筑的临水要求。"},
    {"card_id": "256", "field": "printed_rewards.appeal", "value": 4, "note_zh": "社区结构化数据漏记；卡面与官方词汇表均为4吸引力。"},
    {"card_id": "261", "field": "printed_rewards", "value": {"appeal": 1, "conservation": 1}, "note_zh": "补齐打出时的印刷奖励。"},
    {"card_id": "131", "field": "support_metric", "value": "large_animal", "note_zh": "修正社区数据误标的水域计数。"},
    {"card_id": "132", "field": "support_metric", "value": "science", "note_zh": "修正规则摘要误写的大型动物说明。"},
]
