// Public base-game rule data, mirrored from game/terra_nova_data.py and POWER_ACTIONS.
// Loaded before terra_nova.js so Help is complete before a game starts.
(() => {
    "use strict";
    const rules = {
    "factions": {
        "djinn": {
            "id": "djinn",
            "name": "水精灵",
            "name_en": "Water Sprites",
            "terrain": "lake",
            "color": "#3286c6",
            "side": "A",
            "starting_coins": 7,
            "starting_houses": 2,
            "income_coins": 2,
            "income_power": 0,
            "house_income": [
                3,
                3,
                3,
                0,
                0,
                1,
                0,
                0
            ],
            "house_power_income": [
                0,
                0,
                0,
                0,
                2,
                0,
                1,
                0
            ],
            "trading_post_income": [
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 3,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                }
            ],
            "palace_left_income": {
                "coins": 0,
                "power": 2
            },
            "town_threshold_6": true,
            "ability": "每次建立城镇，额外获得 4 分。",
            "left_ability": "每轮一次，在任意空置湖泊免费建造房屋，无需在范围内。",
            "right_ability": "建立城镇所需建筑价值降至 6，仍须至少 4 栋建筑。"
        },
        "merfolk": {
            "id": "merfolk",
            "name": "海獭",
            "name_en": "Sea Dogs",
            "terrain": "lake",
            "color": "#3286c6",
            "side": "B",
            "starting_coins": 7,
            "starting_houses": 2,
            "income_coins": 2,
            "income_power": 0,
            "house_income": [
                3,
                3,
                3,
                2,
                0,
                1,
                0,
                0
            ],
            "house_power_income": [
                0,
                0,
                0,
                0,
                2,
                0,
                1,
                0
            ],
            "trading_post_income": [
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                }
            ],
            "palace_left_income": {
                "coins": 0,
                "power": 4
            },
            "town_threshold_6": false,
            "ability": "可选择跨越一格河流建立城镇。",
            "left_ability": "建成时立即免费提升一级航运。",
            "right_ability": "每轮一次，免费将一栋房屋升级为贸易站。"
        },
        "golems": {
            "id": "golems",
            "name": "魔像",
            "name_en": "Golems",
            "terrain": "wasteland",
            "color": "#c9584e",
            "side": "A",
            "starting_coins": 7,
            "starting_houses": 2,
            "income_coins": 2,
            "income_power": 0,
            "house_income": [
                3,
                2,
                2,
                2,
                0,
                1,
                0,
                0
            ],
            "house_power_income": [
                0,
                0,
                0,
                0,
                2,
                0,
                1,
                0
            ],
            "trading_post_income": [
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                }
            ],
            "palace_left_income": {
                "coins": 0,
                "power": 4
            },
            "town_threshold_6": true,
            "ability": "退出时，1 或 2 座贸易站得 2 分；3 座得 3 分；4 座得 4 分。",
            "left_ability": "原需两把铲的地形改造只需一把铲。",
            "right_ability": "建立城镇所需建筑价值降至 6，仍须至少 4 栋建筑。"
        },
        "ifrits": {
            "id": "ifrits",
            "name": "火精灵",
            "name_en": "Fire Sprites",
            "terrain": "wasteland",
            "color": "#c9584e",
            "side": "B",
            "starting_coins": 7,
            "starting_houses": 2,
            "income_coins": 2,
            "income_power": 0,
            "house_income": [
                3,
                3,
                3,
                2,
                0,
                1,
                0,
                0
            ],
            "house_power_income": [
                0,
                0,
                0,
                0,
                2,
                0,
                1,
                0
            ],
            "trading_post_income": [
                {
                    "coins": 2,
                    "power": 2
                },
                {
                    "coins": 2,
                    "power": 2
                },
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                }
            ],
            "palace_left_income": {
                "coins": 0,
                "power": 4
            },
            "town_threshold_6": false,
            "ability": "每项魔力行动的消耗减少 1 魔力，不适用于魔力兑换。",
            "left_ability": "建成时立即免费改造一格任意边缘空地并免费建屋，无需在范围内，不算用铲。",
            "right_ability": "退出时，每个包含边缘建筑的独立聚落得 1 分。"
        },
        "goblins": {
            "id": "goblins",
            "name": "矮妖",
            "name_en": "Leprechauns",
            "terrain": "swamp",
            "color": "#55536c",
            "side": "A",
            "starting_coins": 7,
            "starting_houses": 2,
            "income_coins": 2,
            "income_power": 0,
            "house_income": [
                3,
                3,
                3,
                3,
                0,
                2,
                0,
                0
            ],
            "house_power_income": [
                0,
                0,
                0,
                0,
                3,
                0,
                2,
                0
            ],
            "trading_post_income": [
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 3,
                    "power": 2
                },
                {
                    "coins": 3,
                    "power": 2
                }
            ],
            "palace_left_income": {
                "coins": 5,
                "power": 2
            },
            "town_threshold_6": true,
            "ability": "每使用一把铲获得 2 魔力，免费铲也算。",
            "left_ability": "建成时立即获得 6 魔力。",
            "right_ability": "建立城镇所需建筑价值降至 6，仍须至少 4 栋建筑。"
        },
        "inventors": {
            "id": "inventors",
            "name": "发明家",
            "name_en": "Inventors",
            "terrain": "swamp",
            "color": "#55536c",
            "side": "B",
            "starting_coins": 7,
            "starting_houses": 2,
            "income_coins": 2,
            "income_power": 0,
            "house_income": [
                3,
                2,
                2,
                2,
                0,
                1,
                0,
                0
            ],
            "house_power_income": [
                0,
                0,
                0,
                0,
                2,
                0,
                1,
                0
            ],
            "trading_post_income": [
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 1,
                    "power": 1
                },
                {
                    "coins": 1,
                    "power": 1
                }
            ],
            "palace_left_income": {
                "coins": 0,
                "power": 2
            },
            "town_threshold_6": false,
            "ability": "其他种族每建一栋房屋，双人局获得 2 魔力，三至四人局获得 1 魔力。",
            "left_ability": "可重复花费 6 魔力，免费改造范围内空地并直接建造贸易站；不算用铲，算升级贸易站。",
            "right_ability": "每建一栋房屋获得 2 分。"
        },
        "fairies": {
            "id": "fairies",
            "name": "仙灵",
            "name_en": "Fairies",
            "terrain": "forest",
            "color": "#3e9464",
            "side": "A",
            "starting_coins": 7,
            "starting_houses": 2,
            "income_coins": 2,
            "income_power": 2,
            "house_income": [
                3,
                3,
                3,
                2,
                0,
                1,
                0,
                0
            ],
            "house_power_income": [
                0,
                0,
                0,
                0,
                2,
                0,
                1,
                0
            ],
            "trading_post_income": [
                {
                    "coins": 3,
                    "power": 2
                },
                {
                    "coins": 3,
                    "power": 2
                },
                {
                    "coins": 3,
                    "power": 1
                },
                {
                    "coins": 3,
                    "power": 1
                }
            ],
            "palace_left_income": {
                "coins": 2,
                "power": 3
            },
            "town_threshold_6": true,
            "ability": "每轮收入额外获得 2 魔力。",
            "left_ability": "每轮一次，花费 2 魔力获得一次带一把免费铲的改造建造行动，建屋仍需 4 钱。",
            "right_ability": "建立城镇所需建筑价值降至 6，仍须至少 4 栋建筑。"
        },
        "druids": {
            "id": "druids",
            "name": "德鲁伊",
            "name_en": "Druids",
            "terrain": "forest",
            "color": "#3e9464",
            "side": "B",
            "starting_coins": 7,
            "starting_houses": 2,
            "income_coins": 2,
            "income_power": 0,
            "house_income": [
                3,
                3,
                3,
                2,
                0,
                1,
                0,
                0
            ],
            "house_power_income": [
                0,
                0,
                0,
                0,
                2,
                0,
                1,
                0
            ],
            "trading_post_income": [
                {
                    "coins": 3,
                    "power": 1
                },
                {
                    "coins": 3,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                }
            ],
            "palace_left_income": {
                "coins": 0,
                "power": 4
            },
            "town_threshold_6": false,
            "ability": "在允许魔力兑换时，可反复花费 3 魔力获得 2 分。",
            "left_ability": "退出时，每个独立聚落获得 2 魔力。",
            "right_ability": "每次将房屋升级为贸易站获得 3 分。"
        },
        "sun_worshippers": {
            "id": "sun_worshippers",
            "name": "拜日族",
            "name_en": "Sun Worshippers",
            "terrain": "desert",
            "color": "#d9ad48",
            "side": "A",
            "starting_coins": 5,
            "starting_houses": 3,
            "income_coins": 2,
            "income_power": 0,
            "house_income": [
                3,
                3,
                3,
                2,
                0,
                1,
                0,
                0
            ],
            "house_power_income": [
                0,
                0,
                0,
                0,
                2,
                0,
                1,
                0
            ],
            "trading_post_income": [
                {
                    "coins": 2,
                    "power": 2
                },
                {
                    "coins": 2,
                    "power": 2
                },
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 2,
                    "power": 1
                }
            ],
            "palace_left_income": {
                "coins": 0,
                "power": 2
            },
            "town_threshold_6": true,
            "ability": "初始放置 3 栋房屋，第三栋在所有玩家放完前两栋之后放置。",
            "left_ability": "每轮一次，免费改造同大陆上直接相邻空地，可支付通常费用立即建屋；不算用铲。",
            "right_ability": "建立城镇所需建筑价值降至 6，仍须至少 4 栋建筑。"
        },
        "felines": {
            "id": "felines",
            "name": "沙猫",
            "name_en": "Sand Cats",
            "terrain": "desert",
            "color": "#d9ad48",
            "side": "B",
            "starting_coins": 7,
            "starting_houses": 2,
            "income_coins": 2,
            "income_power": 0,
            "house_income": [
                3,
                3,
                0,
                2,
                0,
                1,
                0,
                0
            ],
            "house_power_income": [
                0,
                0,
                0,
                0,
                2,
                0,
                1,
                0
            ],
            "trading_post_income": [
                {
                    "coins": 2,
                    "power": 2
                },
                {
                    "coins": 2,
                    "power": 2
                },
                {
                    "coins": 2,
                    "power": 1
                },
                {
                    "coins": 3,
                    "power": 1
                }
            ],
            "palace_left_income": {
                "coins": 0,
                "power": 2
            },
            "town_threshold_6": false,
            "ability": "其他种族每升级一栋建筑，双人局获得 2 钱，三至四人局获得 1 钱。",
            "left_ability": "贸易站升级费用变为邻敌 5 钱、不邻敌 7 钱。",
            "right_ability": "退出时，每栋不邻接河流的建筑获得 1 分。"
        }
    },
    "bonus_tiles": {
        "A": {
            "id": "A",
            "name": "开拓",
            "income": {
                "coins": 2,
                "power": 0
            },
            "special": "spade"
        },
        "B": {
            "id": "B",
            "name": "丰收",
            "income": {
                "coins": 6,
                "power": 0
            }
        },
        "C": {
            "id": "C",
            "name": "远航",
            "income": {
                "coins": 0,
                "power": 3
            },
            "sailing_bonus": 1
        },
        "D": {
            "id": "D",
            "name": "繁荣",
            "income": {
                "coins": 3,
                "power": 3
            }
        },
        "E": {
            "id": "E",
            "name": "宫殿",
            "income": {
                "coins": 0,
                "power": 4
            },
            "pass_event": "palace",
            "pass_points": 4
        },
        "F": {
            "id": "F",
            "name": "商贸",
            "income": {
                "coins": 0,
                "power": 2
            },
            "pass_event": "trading_post",
            "pass_points": 2
        },
        "G": {
            "id": "G",
            "name": "家园",
            "income": {
                "coins": 2,
                "power": 0
            },
            "pass_event": "house",
            "pass_points": 1
        },
        "H": {
            "id": "H",
            "name": "航海",
            "income": {
                "coins": 0,
                "power": 3
            },
            "pass_event": "sailing",
            "pass_points": 3
        }
    },
    "round_tiles": {
        "house_1": {
            "id": "house_1",
            "name": "建造房屋",
            "event": "house",
            "points": 2
        },
        "house_2": {
            "id": "house_2",
            "name": "建造房屋",
            "event": "house",
            "points": 2
        },
        "trading_post_1": {
            "id": "trading_post_1",
            "name": "升级贸易站",
            "event": "trading_post",
            "points": 3
        },
        "trading_post_2": {
            "id": "trading_post_2",
            "name": "升级贸易站",
            "event": "trading_post",
            "points": 3
        },
        "palace": {
            "id": "palace",
            "name": "升级宫殿",
            "event": "palace",
            "points": 5
        },
        "town": {
            "id": "town",
            "name": "建立城镇",
            "event": "town",
            "points": 5
        },
        "sailing": {
            "id": "sailing",
            "name": "提升航运",
            "event": "sailing",
            "points": 2
        },
        "spade": {
            "id": "spade",
            "name": "使用铲子",
            "event": "spade",
            "points": 2
        }
    },
    "town_tiles": {
        "coins": {
            "id": "coins",
            "name": "富庶之城",
            "score": 5,
            "coins": 6
        },
        "power": {
            "id": "power",
            "name": "魔力之城",
            "score": 6,
            "power": 8
        },
        "points": {
            "id": "points",
            "name": "荣耀之城",
            "score": 9
        },
        "sailing": {
            "id": "sailing",
            "name": "航海之城",
            "score": 4,
            "sailing": 1
        }
    },
    "bridge_sites": [
        {
            "id": "bridge_1",
            "cell_ids": [
                "A5",
                "C5"
            ]
        },
        {
            "id": "bridge_2",
            "cell_ids": [
                "A8",
                "B9"
            ]
        },
        {
            "id": "bridge_3",
            "cell_ids": [
                "B2",
                "C1"
            ]
        },
        {
            "id": "bridge_4",
            "cell_ids": [
                "B3",
                "C5"
            ]
        },
        {
            "id": "bridge_5",
            "cell_ids": [
                "B6",
                "C5"
            ]
        },
        {
            "id": "bridge_6",
            "cell_ids": [
                "B9",
                "C8"
            ]
        },
        {
            "id": "bridge_7",
            "cell_ids": [
                "C3",
                "D1"
            ]
        },
        {
            "id": "bridge_8",
            "cell_ids": [
                "C3",
                "D4"
            ]
        },
        {
            "id": "bridge_9",
            "cell_ids": [
                "C3",
                "E3"
            ]
        },
        {
            "id": "bridge_10",
            "cell_ids": [
                "C7",
                "D5"
            ]
        },
        {
            "id": "bridge_11",
            "cell_ids": [
                "C8",
                "D9"
            ]
        },
        {
            "id": "bridge_12",
            "cell_ids": [
                "D7",
                "E6"
            ]
        },
        {
            "id": "bridge_13",
            "cell_ids": [
                "D7",
                "E9"
            ]
        },
        {
            "id": "bridge_14",
            "cell_ids": [
                "D7",
                "F7"
            ]
        },
        {
            "id": "bridge_15",
            "cell_ids": [
                "E5",
                "G5"
            ]
        },
        {
            "id": "bridge_16",
            "cell_ids": [
                "E6",
                "F7"
            ]
        },
        {
            "id": "bridge_17",
            "cell_ids": [
                "E6",
                "G6"
            ]
        },
        {
            "id": "bridge_18",
            "cell_ids": [
                "F3",
                "G5"
            ]
        },
        {
            "id": "bridge_19",
            "cell_ids": [
                "F3",
                "H3"
            ]
        },
        {
            "id": "bridge_20",
            "cell_ids": [
                "F7",
                "G6"
            ]
        },
        {
            "id": "bridge_21",
            "cell_ids": [
                "G2",
                "H3"
            ]
        },
        {
            "id": "bridge_22",
            "cell_ids": [
                "G2",
                "I2"
            ]
        },
        {
            "id": "bridge_23",
            "cell_ids": [
                "G8",
                "H6"
            ]
        },
        {
            "id": "bridge_24",
            "cell_ids": [
                "G8",
                "I8"
            ]
        },
        {
            "id": "bridge_25",
            "cell_ids": [
                "H10",
                "I9"
            ]
        }
    ],
    "power_actions": {
        "bridge_3": {
            "name": "🌉 Bridge",
            "power": 3,
            "kind": "bridge"
        },
        "bridge_4": {
            "name": "🌉 Bridge",
            "power": 4,
            "kind": "bridge"
        },
        "sailing": {
            "name": "⛵ Advance sailing",
            "power": 4,
            "kind": "sailing"
        },
        "coins": {
            "name": "💰 Gain 7 coins",
            "power": 4,
            "kind": "coins"
        },
        "spade_1": {
            "name": "⛏️ One free spade",
            "power": 4,
            "kind": "spade"
        },
        "spade_2": {
            "name": "⛏️ Two free spades",
            "power": 6,
            "kind": "spade"
        }
    },
    "sailing_points": [
        0,
        2,
        3,
        4
    ],
    "terrain_ring": [
        "lake",
        "forest",
        "wasteland",
        "desert",
        "swamp"
    ]
};
    const freeze = (value) => {
        if (value && typeof value === "object" && !Object.isFrozen(value)) {
            Object.values(value).forEach(freeze);
            Object.freeze(value);
        }
        return value;
    };
    window.TERRA_NOVA_RULES = freeze(rules);
})();
