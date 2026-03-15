from game.abraca_what import AbracaWhatGame
from game.ai_dixit import AiDixitGame
from game.cabo import CaboGame
from game.cat_in_box import CatInBoxGame
from game.coyote import CoyoteGame
from game.cyber_pictures import CyberPicturesGame
from game.decrypto import DecryptoGame
from game.draw_guess import DrawGuessGame
from game.fang_niao import FangNiaoGame
from game.flip7 import Flip7Game
from game.gold_rush import GoldRushGame
from game.halli_galli import HalliGalliGame
from game.hanabi import HanabiGame
from game.impression_flower import ImpressionFlowerGame
from game.incan_gold import IncanGoldGame
from game.kobayakawa import KobayakawaGame
from game.perfect_mismatch import PerfectMismatchGame
from game.point_salad import PointSaladGame
from game.project_l import ProjectLGame
from game.six_nimmt import SixNimmtGame
from game.the_gang import TheGangGame
from game.yahtzee import YahtzeeGame
from game.registry import GameDefinition, register_game
from game.splendor import SplendorGame
from game.splendor_pokemon import PokemonSplendorGame
from game.blokus import BlokusGame
from game.blitz_sketch import BlitzSketchGame
from game.carcassonne import CarcassonneGame
from game.skull import SkullGame
from game.trekking_history import TrekkingHistoryGame
from game.texas_holdem import TexasHoldemGame
from game.word_decode import WordDecodeGame

CABO_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "initial_peek"},
                "slots": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0, "maximum": 3},
                    "minItems": 2,
                    "maxItems": 2,
                },
            },
            "required": ["type", "slots"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "draw_deck"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "draw_discard"}, "slot": {"type": "integer", "minimum": 0, "maximum": 3}},
            "required": ["type", "slot"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "replace_card"}, "slot": {"type": "integer", "minimum": 0, "maximum": 3}},
            "required": ["type", "slot"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "discard_drawn"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "attempt_match"},
                "slots": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0, "maximum": 3},
                    "minItems": 2,
                    "maxItems": 4,
                },
            },
            "required": ["type", "slots"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "call_cabo"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "use_choice_action"},
                "choice_type": {"type": "string", "enum": ["peek", "spy", "swap"]},
                "target": {"type": "object"},
            },
            "required": ["type", "choice_type", "target"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
    ],
}

CABO_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "target_score": {"type": "integer", "minimum": 1},
        "shooting_moon": {"type": "boolean"},
        "score_reset": {"type": "boolean"},
        "double_swap": {"type": "boolean"},
        "deck_counts": {
            "type": "object",
            "additionalProperties": {"type": "integer", "minimum": 0},
        },
    },
    "additionalProperties": False,
}

COYOTE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "bid"}, "bid": {"type": "integer", "minimum": 1}},
            "required": ["type", "bid"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "challenge"}}, "required": ["type"], "additionalProperties": False},
    ],
}

COYOTE_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "max_penalties": {"type": "integer", "minimum": 1},
    },
    "additionalProperties": False,
}

SKULL_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "play_card"}, "card_type": {"enum": ["rose", "skull"]}},
            "required": ["type", "card_type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "start_bid"}, "bid": {"type": "integer", "minimum": 1}},
            "required": ["type", "bid"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "raise_bid"}, "bid": {"type": "integer", "minimum": 1}},
            "required": ["type", "bid"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "pass_bid"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "reveal_card"}, "target_player_id": {"type": "string"}},
            "required": ["type", "target_player_id"],
            "additionalProperties": False,
        },
    ],
}

SKULL_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "target_wins": {"type": "integer", "minimum": 1},
    },
    "additionalProperties": False,
}

CAT_IN_BOX_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "discard"},
                "card_value": {"type": "integer", "minimum": 1, "maximum": 9},
            },
            "required": ["type", "card_value"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "bid"},
                "bid": {"type": "integer", "enum": [1, 2, 3]},
            },
            "required": ["type", "bid"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "play_card"},
                "card_value": {"type": "integer", "minimum": 1, "maximum": 9},
                "color": {"type": "string", "enum": ["red", "blue", "yellow", "green"]},
            },
            "required": ["type", "card_value", "color"],
            "additionalProperties": False,
        },
    ],
}

CAT_IN_BOX_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

TREKKING_HISTORY_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_card"},
                "slot_index": {"type": "integer", "minimum": 0, "maximum": 5},
                "spend_crystals": {"type": "integer", "minimum": 0},
                "wild_choices": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0, "maximum": 3},
                },
            },
            "required": ["type", "slot_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_ancestor"},
                "spend_crystals": {"type": "integer", "minimum": 0},
                "wild_choices": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0, "maximum": 3},
                },
            },
            "required": ["type", "wild_choices"],
            "additionalProperties": False,
        },
    ],
}

TREKKING_HISTORY_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

KOBAYAKAWA_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {"type": {"const": "draw_card"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "keep_drawn"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "discard_drawn"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "replace_kobayakawa"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "fight"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "pass"}}, "required": ["type"], "additionalProperties": False},
    ],
}

KOBAYAKAWA_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "starting_tokens": {"type": "integer", "minimum": 0},
        "end_mode": {"type": "string", "enum": ["bankrupt", "rounds"]},
        "round_limit": {"type": "integer", "minimum": 1},
    },
    "additionalProperties": False,
}

SIX_NIMMT_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "select_card"}, "value": {"type": "integer", "minimum": 1, "maximum": 104}},
            "required": ["type", "value"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "choose_row"}, "row_index": {"type": "integer", "minimum": 0, "maximum": 3}},
            "required": ["type", "row_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "ack_turn_summary"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

SIX_NIMMT_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "selection_timeout_sec": {"type": "number", "minimum": 0},
        "row_choice_timeout_sec": {"type": "number", "minimum": 0},
    },
    "additionalProperties": False,
}

DRAW_GUESS_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "submit_drawing"}, "image_data": {"type": "string", "minLength": 1}},
            "required": ["type", "image_data"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "submit_guess"}, "text": {"type": "string", "minLength": 1}},
            "required": ["type", "text"],
            "additionalProperties": False,
        },
    ],
}

DRAW_GUESS_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "language": {"type": "string", "enum": ["en", "zh"]},
        "guess_method": {"type": "string", "enum": ["normal", "cv"]},
        "show_answer_length": {"type": "boolean"},
        "prompt_pool": {
            "type": "array",
            "items": {
                "oneOf": [
                    {"type": "string"},
                    {
                        "type": "object",
                        "properties": {"text": {"type": "string"}, "quickdraw": {"type": "string"}},
                        "required": ["text"],
                        "additionalProperties": False,
                    },
                ]
            },
        },
    },
    "additionalProperties": False,
}

BLITZ_SKETCH_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_drawing"},
                "image_data": {"type": "string", "minLength": 1},
                "index": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "image_data"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "submit_guess"}, "text": {"type": "string", "minLength": 1}},
            "required": ["type", "text"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "skip_guess"}}, "required": ["type"], "additionalProperties": False},
    ],
}

BLITZ_SKETCH_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "draw_total": {"type": "integer", "minimum": 1},
        "guess_total": {"type": "integer", "minimum": 1},
        "draw_time_sec": {"type": "number", "enum": [1, 1.5, 2, 2.5, 3, 4]},
        "skip_reveal_sec": {"type": "integer", "minimum": 0},
    },
    "additionalProperties": False,
}

CYBER_PICTURES_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "submit_crafting"}, "submission": {"type": "object"}},
            "required": ["type", "submission"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_guesses"},
                "guesses": {"type": "object", "additionalProperties": {"type": "string"}},
            },
            "required": ["type", "guesses"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
    ],
}

CYBER_PICTURES_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "allow_duplicate_targets": {"type": "boolean"},
        "disabled_tools": {"type": "array", "items": {"type": "string"}},
    },
    "additionalProperties": False,
}

FLIP7_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {"type": {"const": "flip"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "stay"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "choose_target"}, "target_player_id": {"type": "string"}},
            "required": ["type", "target_player_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
    ],
}

FLIP7_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "target_score": {"type": "integer", "minimum": 1},
    },
    "additionalProperties": False,
}

YAHTZEE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {"type": {"const": "roll"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "toggle_lock"}, "index": {"type": "integer", "minimum": 0, "maximum": 4}},
            "required": ["type", "index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "score"},
                "category": {
                    "type": "string",
                    "enum": [
                        "ones",
                        "twos",
                        "threes",
                        "fours",
                        "fives",
                        "sixes",
                        "three_kind",
                        "four_kind",
                        "full_house",
                        "small_straight",
                        "large_straight",
                        "yahtzee",
                        "chance",
                    ],
                },
            },
            "required": ["type", "category"],
            "additionalProperties": False,
        },
    ],
}

YAHTZEE_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

HALLI_GALLI_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {"type": {"const": "flip"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "ring"}}, "required": ["type"], "additionalProperties": False},
    ],
}

HALLI_GALLI_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "deck_mode": {"type": "string", "enum": ["base", "extended"]},
        "flip_reveal_delay_ms": {"type": "integer", "minimum": 0},
        "flip_wait_ms": {"type": "integer", "minimum": 0},
    },
    "additionalProperties": False,
}

GOLD_RUSH_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "play_card"}, "hand_index": {"type": "integer", "minimum": 0}},
            "required": ["type", "hand_index"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "draw_card"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "invest"}, "invest": {"type": "boolean"}},
            "required": ["type", "invest"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "place_gold"}, "mine_id": {"type": "integer", "minimum": 0, "maximum": 4}},
            "required": ["type", "mine_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "play_again"}}, "required": ["type"], "additionalProperties": False},
    ],
}

GOLD_RUSH_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "mode": {"type": "string", "enum": ["hand", "classic"]},
    },
    "additionalProperties": False,
}

INCAN_GOLD_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "decide"}, "choice": {"type": "string", "enum": ["continue", "leave"]}},
            "required": ["type", "choice"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "play_again"}}, "required": ["type"], "additionalProperties": False},
    ],
}

INCAN_GOLD_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

AI_DIXIT_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_story"},
                "card_id": {"type": "string", "minLength": 1},
                "clue": {"type": "string", "minLength": 1},
            },
            "required": ["type", "card_id", "clue"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "submit_card"}, "card_id": {"type": "string", "minLength": 1}},
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "submit_vote"}, "card_id": {"type": "string", "minLength": 1}},
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
    ],
}

AI_DIXIT_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "deck_root": {"type": "string"},
        "selected_decks": {"type": "array", "items": {"type": "string"}},
        "hand_size": {"type": "integer", "minimum": 1},
        "target_score": {"type": "integer", "minimum": 1},
        "reshuffle_discard": {"type": "boolean"},
        "player_colors": {"type": "array", "items": {"type": "string"}},
    },
    "additionalProperties": False,
}

IMPRESSION_FLOWER_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "submit_drawing"}, "image_data": {"type": "string", "minLength": 1}},
            "required": ["type", "image_data"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_matches"},
                "matches": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {"drawing_id": {"type": "string"}, "word": {"type": "string"}},
                        "required": ["drawing_id", "word"],
                        "additionalProperties": False,
                    },
                    "minItems": 1,
                },
            },
            "required": ["type", "matches"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "review_vote"},
                "drawing_id": {"type": "string"},
                "vote": {"type": "integer", "enum": [-1, 0, 1]},
            },
            "required": ["type", "drawing_id", "vote"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "continue_game"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "end_game"}}, "required": ["type"], "additionalProperties": False},
    ],
}

IMPRESSION_FLOWER_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "word_pool": {"type": "array", "items": {"type": "string"}},
        "rounds_per_guesser": {"type": "integer", "minimum": 1},
        "base_stamps": {"type": "integer", "minimum": 1},
        "score_mode": {"type": "string", "enum": ["round", "fixed"]},
        "score_per_correct": {"type": "integer", "minimum": 1},
        "allow_review_votes": {"type": "boolean"},
        "stamp_shapes": {
            "type": "array",
            "items": {"type": "string", "enum": ["circle", "triangle", "square", "bar"]},
        },
        "stamp_colors": {"type": "array", "items": {"type": "string"}},
        "stamp_size": {"type": "integer", "minimum": 1},
        "bar_ratio": {"type": "number", "minimum": 0.01},
        "canvas_size": {"type": "integer", "minimum": 1},
        "mask_size": {"type": "integer", "minimum": 1},
    },
    "additionalProperties": False,
}

DECRYPTO_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_clues"},
                "clues": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 1},
                    "minItems": 3,
                    "maxItems": 3,
                },
            },
            "required": ["type", "clues"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_decrypt"},
                "guess": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 1, "maximum": 4},
                    "minItems": 3,
                    "maxItems": 3,
                },
            },
            "required": ["type", "guess"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_intercept"},
                "guess": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 1, "maximum": 4},
                    "minItems": 3,
                    "maxItems": 3,
                },
            },
            "required": ["type", "guess"],
            "additionalProperties": False,
        },
    ],
}

DECRYPTO_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "word_packs": {"type": "array", "items": {"type": "string"}},
        "max_rounds": {"type": "integer", "minimum": 1},
        "bot_strategy": {"type": "string"},
        "bot_clue_directness": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "additionalProperties": False,
}

ABRACA_WHAT_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "cast_spell"},
                "spell_type": {"type": "integer", "minimum": 0, "maximum": 7},
            },
            "required": ["type", "spell_type"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "roll_dice"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "take_secret"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "end_turn"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "start_next_round"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

ABRACA_WHAT_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "target_score": {"type": "integer", "minimum": 1},
    },
    "additionalProperties": False,
}

SPLENDOR_TOKEN_COUNTS_SCHEMA = {
    "type": "object",
    "properties": {
        "white": {"type": "integer", "minimum": 0},
        "blue": {"type": "integer", "minimum": 0},
        "green": {"type": "integer", "minimum": 0},
        "red": {"type": "integer", "minimum": 0},
        "black": {"type": "integer", "minimum": 0},
        "gold": {"type": "integer", "minimum": 0},
    },
    "additionalProperties": False,
}

SPLENDOR_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_tokens"},
                "colors": {
                    "type": "array",
                    "items": {"enum": ["white", "blue", "green", "red", "black"]},
                    "minItems": 3,
                    "maxItems": 3,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "colors"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_tokens_same"},
                "color": {"enum": ["white", "blue", "green", "red", "black"]},
            },
            "required": ["type", "color"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "reserve_market"},
                "tier": {"enum": ["tier1", "tier2", "tier3"]},
                "index": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "tier", "index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "reserve_deck"},
                "tier": {"enum": ["tier1", "tier2", "tier3"]},
            },
            "required": ["type", "tier"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "buy_market"},
                "tier": {"enum": ["tier1", "tier2", "tier3"]},
                "index": {"type": "integer", "minimum": 0},
                "payment": SPLENDOR_TOKEN_COUNTS_SCHEMA,
            },
            "required": ["type", "tier", "index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "buy_reserved"},
                "reserved_index": {"type": "integer", "minimum": 0},
                "payment": SPLENDOR_TOKEN_COUNTS_SCHEMA,
            },
            "required": ["type", "reserved_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "discard_tokens"},
                "tokens": SPLENDOR_TOKEN_COUNTS_SCHEMA,
            },
            "required": ["type", "tokens"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_noble"},
                "noble_id": {"type": "string"},
            },
            "required": ["type", "noble_id"],
            "additionalProperties": False,
        },
    ],
}

SPLENDOR_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "target_score": {"type": "integer", "minimum": 1},
    },
    "additionalProperties": False,
}

SPLENDOR_POKEMON_TOKEN_COUNTS_SCHEMA = {
    "type": "object",
    "properties": {
        "red": {"type": "integer", "minimum": 0},
        "blue": {"type": "integer", "minimum": 0},
        "yellow": {"type": "integer", "minimum": 0},
        "green": {"type": "integer", "minimum": 0},
        "pink": {"type": "integer", "minimum": 0},
        "purple": {"type": "integer", "minimum": 0},
    },
    "additionalProperties": False,
}

SPLENDOR_POKEMON_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_tokens"},
                "colors": {
                    "type": "array",
                    "items": {"enum": ["red", "blue", "yellow", "green", "pink"]},
                    "minItems": 1,
                    "maxItems": 3,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "colors"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_tokens_same"},
                "color": {"enum": ["red", "blue", "yellow", "green", "pink"]},
            },
            "required": ["type", "color"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "reserve_market"},
                "tier": {"enum": ["lv1", "lv2", "lv3"]},
                "index": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "tier", "index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "reserve_deck"},
                "tier": {"enum": ["lv1", "lv2", "lv3"]},
            },
            "required": ["type", "tier"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "buy_market"},
                "tier": {"enum": ["lv1", "lv2", "lv3", "rare", "legendary"]},
                "index": {"type": "integer", "minimum": 0},
                "payment": SPLENDOR_POKEMON_TOKEN_COUNTS_SCHEMA,
            },
            "required": ["type", "tier", "index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "buy_reserved"},
                "reserved_index": {"type": "integer", "minimum": 0},
                "payment": SPLENDOR_POKEMON_TOKEN_COUNTS_SCHEMA,
            },
            "required": ["type", "reserved_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "evolve"},
                "base_id": {"type": "string"},
                "target_id": {"type": "string"},
            },
            "required": ["type", "base_id", "target_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "skip_evolution"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "discard_tokens"},
                "tokens": SPLENDOR_POKEMON_TOKEN_COUNTS_SCHEMA,
            },
            "required": ["type", "tokens"],
            "additionalProperties": False,
        },
    ],
}

SPLENDOR_POKEMON_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "target_score": {"type": "integer", "minimum": 1},
    },
    "additionalProperties": False,
}

POINT_SALAD_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_point"},
                "pile_index": {"type": "integer", "minimum": 0, "maximum": 2},
                "flip_ids": {"type": "array", "items": {"type": "integer", "minimum": 1}},
            },
            "required": ["type", "pile_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_veggies"},
                "positions": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0, "maximum": 5},
                    "minItems": 1,
                    "maxItems": 2,
                },
                "flip_ids": {"type": "array", "items": {"type": "integer", "minimum": 1}},
            },
            "required": ["type", "positions"],
            "additionalProperties": False,
        },
    ],
}

POINT_SALAD_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

BLOKUS_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_piece"},
                "piece_id": {"type": "string"},
                "rotation": {"type": "integer", "enum": [0, 90, 180, 270]},
                "flip": {"type": "boolean"},
                "x": {"type": "integer", "minimum": 0, "maximum": 19},
                "y": {"type": "integer", "minimum": 0, "maximum": 19},
            },
            "required": ["type", "piece_id", "rotation", "flip", "x", "y"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "give_up"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

BLOKUS_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

PERFECT_MISMATCH_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "set_slider"},
                "slider_index": {"type": "integer", "minimum": 0},
                "value": {"type": "integer", "minimum": 0, "maximum": 10},
            },
            "required": ["type", "slider_index", "value"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_guess"},
                "choice_index": {"type": "integer", "minimum": 0, "maximum": 4},
            },
            "required": ["type", "choice_index"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "reveal"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "next_round"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "play_again"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

PERFECT_MISMATCH_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "slider_count": {"type": "integer", "minimum": 1, "maximum": 5},
    },
    "additionalProperties": False,
}

HANABI_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "give_clue"},
                "target_player_id": {"type": "string"},
                "clue_type": {"type": "string", "enum": ["color", "rank"]},
                "value": {"oneOf": [{"type": "string"}, {"type": "integer"}]},
            },
            "required": ["type", "target_player_id", "clue_type", "value"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "discard"},
                "card_index": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "card_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "play"},
                "card_index": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "card_index"],
            "additionalProperties": False,
        },
    ],
}

HANABI_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "final_round_countdown": {"type": "boolean"},
    },
    "additionalProperties": False,
}

THE_GANG_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "move_rank"},
                "player_id": {"type": "string"},
                "to_index": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "player_id", "to_index"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "toggle_ready"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "reveal_next"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "mulligan"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "spy"}, "target_player_id": {"type": "string"}},
            "required": ["type", "target_player_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "lock_in"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "play_again"}}, "required": ["type"], "additionalProperties": False},
    ],
}

THE_GANG_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "mode": {"type": "string", "enum": ["novice", "normal", "expert"]},
        "starting_lives": {"type": "integer", "minimum": 1},
        "max_lives": {"type": "integer", "minimum": 1},
        "starting_tokens": {"type": "integer", "minimum": 0},
        "token_drop_rate": {"type": "number", "minimum": 0, "maximum": 1},
        "round_time_limit_sec": {"type": "integer", "minimum": 0},
        "ready_countdown_ms": {"type": "integer", "minimum": 0},
        "odds_samples": {"type": "integer", "minimum": 10},
    },
    "additionalProperties": False,
}

FANG_NIAO_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "play_birds"},
                "bird_type": {
                    "type": "string",
                    "enum": [
                        "flamingo",
                        "owl",
                        "toucan",
                        "duck",
                        "pelican",
                        "parrot",
                        "sparrow",
                        "magpie",
                    ],
                },
                "row_index": {"type": "integer", "minimum": 0, "maximum": 3},
                "side": {"type": "string", "enum": ["left", "right"]},
            },
            "required": ["type", "bird_type", "row_index", "side"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "bank_birds"},
                "bird_type": {
                    "type": "string",
                    "enum": [
                        "flamingo",
                        "owl",
                        "toucan",
                        "duck",
                        "pelican",
                        "parrot",
                        "sparrow",
                        "magpie",
                    ],
                },
            },
            "required": ["type", "bird_type"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "end_turn"}}, "required": ["type"], "additionalProperties": False},
    ],
}

FANG_NIAO_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

CARCASSONNE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_tile"},
                "x": {"type": "integer"},
                "y": {"type": "integer"},
                "rotation": {"type": "integer", "enum": [0, 90, 180, 270]},
            },
            "required": ["type", "x", "y", "rotation"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_meeple"},
                "feature": {"type": "string", "enum": ["road", "city", "field", "monastery"]},
                "segment": {"type": ["integer", "null"], "minimum": 0},
            },
            "required": ["type", "feature", "segment"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "skip_meeple"}}, "required": ["type"], "additionalProperties": False},
    ],
}

CARCASSONNE_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

PROJECT_L_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {"type": {"const": "take_level1"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_puzzle"},
                "source": {"const": "market"},
                "deck": {"type": "string", "enum": ["white", "black"]},
                "index": {"type": "integer", "minimum": 0, "maximum": 3},
            },
            "required": ["type", "source", "deck", "index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_puzzle"},
                "source": {"const": "deck"},
                "deck": {"type": "string", "enum": ["white", "black"]},
            },
            "required": ["type", "source", "deck"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "upgrade_piece"},
                "from_piece_id": {"type": "string"},
                "to_piece_id": {"type": "string"},
            },
            "required": ["type", "from_piece_id", "to_piece_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_piece"},
                "puzzle_index": {"type": "integer", "minimum": 0},
                "piece_id": {"type": "string"},
                "rotation": {"type": "integer", "enum": [0, 90, 180, 270]},
                "flip": {"type": "boolean"},
                "row": {"type": "integer", "minimum": 0},
                "col": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "puzzle_index", "piece_id", "rotation", "flip", "row", "col"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "master_action"},
                "placements": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "puzzle_index": {"type": "integer", "minimum": 0},
                            "piece_id": {"type": "string"},
                            "rotation": {"type": "integer", "enum": [0, 90, 180, 270]},
                            "flip": {"type": "boolean"},
                            "row": {"type": "integer", "minimum": 0},
                            "col": {"type": "integer", "minimum": 0},
                        },
                        "required": ["puzzle_index", "piece_id", "rotation", "flip", "row", "col"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["type", "placements"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "finishing_place"},
                "puzzle_index": {"type": "integer", "minimum": 0},
                "piece_id": {"type": "string"},
                "rotation": {"type": "integer", "enum": [0, 90, 180, 270]},
                "flip": {"type": "boolean"},
                "row": {"type": "integer", "minimum": 0},
                "col": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "puzzle_index", "piece_id", "rotation", "flip", "row", "col"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "finishing_done"}}, "required": ["type"], "additionalProperties": False},
    ],
}

PROJECT_L_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

TEXAS_HOLDEM_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {"type": {"const": "fold"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "check"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "call"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "all_in"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "bet"}, "amount": {"type": "integer", "minimum": 1}},
            "required": ["type", "amount"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "raise"}, "amount": {"type": "integer", "minimum": 1}},
            "required": ["type", "amount"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_hand"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "rebuy"}}, "required": ["type"], "additionalProperties": False},
    ],
}

TEXAS_HOLDEM_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "starting_chips": {"type": "integer", "minimum": 1},
        "small_blind": {"type": "integer", "minimum": 1},
        "big_blind": {"type": "integer", "minimum": 1},
    },
    "additionalProperties": False,
}

WORD_DECODE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_hints"},
                "hints": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 2,
                    "maxItems": 2,
                },
            },
            "required": ["type", "hints"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_guesses"},
                "base_guess": {"type": "string"},
                "hidden_guesses": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "target_player_id": {"type": "string"},
                            "guess": {"type": "string"},
                        },
                        "required": ["target_player_id", "guess"],
                        "additionalProperties": False,
                    },
                    "minItems": 1,
                },
            },
            "required": ["type", "base_guess", "hidden_guesses"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "end_game"}}, "required": ["type"], "additionalProperties": False},
    ],
}

WORD_DECODE_CONFIG_SCHEMA = {"type": "object", "properties": {}, "additionalProperties": False}

register_game(
    GameDefinition(
        game_id=CaboGame.game_id,
        name="Cabo",
        min_players=CaboGame.min_players,
        max_players=CaboGame.max_players,
        turn_mode="turn",
        action_schema=CABO_ACTION_SCHEMA,
        config_schema=CABO_CONFIG_SCHEMA,
        module=CaboGame,
        serialize=CaboGame.serialize,
        deserialize=CaboGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=TexasHoldemGame.game_id,
        name="Texas Hold'em",
        min_players=TexasHoldemGame.min_players,
        max_players=TexasHoldemGame.max_players,
        turn_mode="turn",
        action_schema=TEXAS_HOLDEM_ACTION_SCHEMA,
        config_schema=TEXAS_HOLDEM_CONFIG_SCHEMA,
        module=TexasHoldemGame,
        serialize=TexasHoldemGame.serialize,
        deserialize=TexasHoldemGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=CoyoteGame.game_id,
        name="Coyote",
        min_players=CoyoteGame.min_players,
        max_players=CoyoteGame.max_players,
        turn_mode="turn",
        action_schema=COYOTE_ACTION_SCHEMA,
        config_schema=COYOTE_CONFIG_SCHEMA,
        module=CoyoteGame,
        serialize=CoyoteGame.serialize,
        deserialize=CoyoteGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=SixNimmtGame.game_id,
        name="6 nimmt!",
        min_players=SixNimmtGame.min_players,
        max_players=SixNimmtGame.max_players,
        turn_mode="simultaneous",
        action_schema=SIX_NIMMT_ACTION_SCHEMA,
        config_schema=SIX_NIMMT_CONFIG_SCHEMA,
        module=SixNimmtGame,
        serialize=SixNimmtGame.serialize,
        deserialize=SixNimmtGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=SplendorGame.game_id,
        name="Splendor",
        min_players=SplendorGame.min_players,
        max_players=SplendorGame.max_players,
        turn_mode="turn",
        action_schema=SPLENDOR_ACTION_SCHEMA,
        config_schema=SPLENDOR_CONFIG_SCHEMA,
        module=SplendorGame,
        serialize=SplendorGame.serialize,
        deserialize=SplendorGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=PokemonSplendorGame.game_id,
        name="Splendor: Pokemon",
        min_players=PokemonSplendorGame.min_players,
        max_players=PokemonSplendorGame.max_players,
        turn_mode="turn",
        action_schema=SPLENDOR_POKEMON_ACTION_SCHEMA,
        config_schema=SPLENDOR_POKEMON_CONFIG_SCHEMA,
        module=PokemonSplendorGame,
        serialize=PokemonSplendorGame.serialize,
        deserialize=PokemonSplendorGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=PointSaladGame.game_id,
        name="Point Salad",
        min_players=PointSaladGame.min_players,
        max_players=PointSaladGame.max_players,
        turn_mode="turn",
        action_schema=POINT_SALAD_ACTION_SCHEMA,
        config_schema=POINT_SALAD_CONFIG_SCHEMA,
        module=PointSaladGame,
        serialize=PointSaladGame.serialize,
        deserialize=PointSaladGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=AbracaWhatGame.game_id,
        name="Abraca What",
        min_players=AbracaWhatGame.min_players,
        max_players=AbracaWhatGame.max_players,
        turn_mode="turn",
        action_schema=ABRACA_WHAT_ACTION_SCHEMA,
        config_schema=ABRACA_WHAT_CONFIG_SCHEMA,
        module=AbracaWhatGame,
        serialize=AbracaWhatGame.serialize,
        deserialize=AbracaWhatGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=SkullGame.game_id,
        name="Skull",
        min_players=SkullGame.min_players,
        max_players=SkullGame.max_players,
        turn_mode="turn",
        action_schema=SKULL_ACTION_SCHEMA,
        config_schema=SKULL_CONFIG_SCHEMA,
        module=SkullGame,
        serialize=SkullGame.serialize,
        deserialize=SkullGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=CatInBoxGame.game_id,
        name="Cat in the Box",
        min_players=CatInBoxGame.min_players,
        max_players=CatInBoxGame.max_players,
        turn_mode="turn",
        action_schema=CAT_IN_BOX_ACTION_SCHEMA,
        config_schema=CAT_IN_BOX_CONFIG_SCHEMA,
        module=CatInBoxGame,
        serialize=CatInBoxGame.serialize,
        deserialize=CatInBoxGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=DrawGuessGame.game_id,
        name="Draw & Guess",
        min_players=DrawGuessGame.min_players,
        max_players=DrawGuessGame.max_players,
        turn_mode="simultaneous",
        action_schema=DRAW_GUESS_ACTION_SCHEMA,
        config_schema=DRAW_GUESS_CONFIG_SCHEMA,
        module=DrawGuessGame,
        serialize=DrawGuessGame.serialize,
        deserialize=DrawGuessGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=BlitzSketchGame.game_id,
        name="Blitz Sketch",
        min_players=BlitzSketchGame.min_players,
        max_players=BlitzSketchGame.max_players,
        turn_mode="simultaneous",
        action_schema=BLITZ_SKETCH_ACTION_SCHEMA,
        config_schema=BLITZ_SKETCH_CONFIG_SCHEMA,
        module=BlitzSketchGame,
        serialize=BlitzSketchGame.serialize,
        deserialize=BlitzSketchGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=CyberPicturesGame.game_id,
        name="Cyber Pictures",
        min_players=CyberPicturesGame.min_players,
        max_players=CyberPicturesGame.max_players,
        turn_mode="simultaneous",
        action_schema=CYBER_PICTURES_ACTION_SCHEMA,
        config_schema=CYBER_PICTURES_CONFIG_SCHEMA,
        module=CyberPicturesGame,
        serialize=CyberPicturesGame.serialize,
        deserialize=CyberPicturesGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=DecryptoGame.game_id,
        name="Decrypto",
        min_players=DecryptoGame.min_players,
        max_players=DecryptoGame.max_players,
        turn_mode="simultaneous",
        action_schema=DECRYPTO_ACTION_SCHEMA,
        config_schema=DECRYPTO_CONFIG_SCHEMA,
        module=DecryptoGame,
        serialize=DecryptoGame.serialize,
        deserialize=DecryptoGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=WordDecodeGame.game_id,
        name="猜字解底",
        min_players=WordDecodeGame.min_players,
        max_players=WordDecodeGame.max_players,
        turn_mode="simultaneous",
        action_schema=WORD_DECODE_ACTION_SCHEMA,
        config_schema=WORD_DECODE_CONFIG_SCHEMA,
        module=WordDecodeGame,
        serialize=WordDecodeGame.serialize,
        deserialize=WordDecodeGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=ImpressionFlowerGame.game_id,
        name="Impression Flower",
        min_players=ImpressionFlowerGame.min_players,
        max_players=ImpressionFlowerGame.max_players,
        turn_mode="simultaneous",
        action_schema=IMPRESSION_FLOWER_ACTION_SCHEMA,
        config_schema=IMPRESSION_FLOWER_CONFIG_SCHEMA,
        module=ImpressionFlowerGame,
        serialize=ImpressionFlowerGame.serialize,
        deserialize=ImpressionFlowerGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=BlokusGame.game_id,
        name="Blokus",
        min_players=BlokusGame.min_players,
        max_players=BlokusGame.max_players,
        turn_mode="turn",
        action_schema=BLOKUS_ACTION_SCHEMA,
        config_schema=BLOKUS_CONFIG_SCHEMA,
        module=BlokusGame,
        serialize=BlokusGame.serialize,
        deserialize=BlokusGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=ProjectLGame.game_id,
        name="Project L",
        min_players=ProjectLGame.min_players,
        max_players=ProjectLGame.max_players,
        turn_mode="turn",
        action_schema=PROJECT_L_ACTION_SCHEMA,
        config_schema=PROJECT_L_CONFIG_SCHEMA,
        module=ProjectLGame,
        serialize=ProjectLGame.serialize,
        deserialize=ProjectLGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=AiDixitGame.game_id,
        name="AI Dixit",
        min_players=AiDixitGame.min_players,
        max_players=AiDixitGame.max_players,
        turn_mode="simultaneous",
        action_schema=AI_DIXIT_ACTION_SCHEMA,
        config_schema=AI_DIXIT_CONFIG_SCHEMA,
        module=AiDixitGame,
        serialize=AiDixitGame.serialize,
        deserialize=AiDixitGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=Flip7Game.game_id,
        name="flip7flash",
        min_players=Flip7Game.min_players,
        max_players=Flip7Game.max_players,
        turn_mode="turn",
        action_schema=FLIP7_ACTION_SCHEMA,
        config_schema=FLIP7_CONFIG_SCHEMA,
        module=Flip7Game,
        serialize=Flip7Game.serialize,
        deserialize=Flip7Game.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=YahtzeeGame.game_id,
        name="Yahtzee",
        min_players=YahtzeeGame.min_players,
        max_players=YahtzeeGame.max_players,
        turn_mode="turn",
        action_schema=YAHTZEE_ACTION_SCHEMA,
        config_schema=YAHTZEE_CONFIG_SCHEMA,
        module=YahtzeeGame,
        serialize=YahtzeeGame.serialize,
        deserialize=YahtzeeGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=GoldRushGame.game_id,
        name="Gold Rush",
        min_players=GoldRushGame.min_players,
        max_players=GoldRushGame.max_players,
        turn_mode="turn",
        action_schema=GOLD_RUSH_ACTION_SCHEMA,
        config_schema=GOLD_RUSH_CONFIG_SCHEMA,
        module=GoldRushGame,
        serialize=GoldRushGame.serialize,
        deserialize=GoldRushGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=IncanGoldGame.game_id,
        name="Incan Gold",
        min_players=IncanGoldGame.min_players,
        max_players=IncanGoldGame.max_players,
        turn_mode="simultaneous",
        action_schema=INCAN_GOLD_ACTION_SCHEMA,
        config_schema=INCAN_GOLD_CONFIG_SCHEMA,
        module=IncanGoldGame,
        serialize=IncanGoldGame.serialize,
        deserialize=IncanGoldGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=KobayakawaGame.game_id,
        name="Kobayakawa",
        min_players=KobayakawaGame.min_players,
        max_players=KobayakawaGame.max_players,
        turn_mode="turn",
        action_schema=KOBAYAKAWA_ACTION_SCHEMA,
        config_schema=KOBAYAKAWA_CONFIG_SCHEMA,
        module=KobayakawaGame,
        serialize=KobayakawaGame.serialize,
        deserialize=KobayakawaGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=HalliGalliGame.game_id,
        name="Halli Galli",
        min_players=HalliGalliGame.min_players,
        max_players=HalliGalliGame.max_players,
        turn_mode="turn",
        action_schema=HALLI_GALLI_ACTION_SCHEMA,
        config_schema=HALLI_GALLI_CONFIG_SCHEMA,
        module=HalliGalliGame,
        serialize=HalliGalliGame.serialize,
        deserialize=HalliGalliGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=PerfectMismatchGame.game_id,
        name="Perfect Mismatch",
        min_players=PerfectMismatchGame.min_players,
        max_players=PerfectMismatchGame.max_players,
        turn_mode="simultaneous",
        action_schema=PERFECT_MISMATCH_ACTION_SCHEMA,
        config_schema=PERFECT_MISMATCH_CONFIG_SCHEMA,
        module=PerfectMismatchGame,
        serialize=PerfectMismatchGame.serialize,
        deserialize=PerfectMismatchGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=HanabiGame.game_id,
        name="Hanabi",
        min_players=HanabiGame.min_players,
        max_players=HanabiGame.max_players,
        turn_mode="turn",
        action_schema=HANABI_ACTION_SCHEMA,
        config_schema=HANABI_CONFIG_SCHEMA,
        module=HanabiGame,
        serialize=HanabiGame.serialize,
        deserialize=HanabiGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=TheGangGame.game_id,
        name="The Gang",
        min_players=TheGangGame.min_players,
        max_players=TheGangGame.max_players,
        turn_mode="simultaneous",
        action_schema=THE_GANG_ACTION_SCHEMA,
        config_schema=THE_GANG_CONFIG_SCHEMA,
        module=TheGangGame,
        serialize=TheGangGame.serialize,
        deserialize=TheGangGame.deserialize,
    )
)
register_game(
    GameDefinition(
        game_id=FangNiaoGame.game_id,
        name="Square Bird",
        min_players=FangNiaoGame.min_players,
        max_players=FangNiaoGame.max_players,
        turn_mode="turn",
        action_schema=FANG_NIAO_ACTION_SCHEMA,
        config_schema=FANG_NIAO_CONFIG_SCHEMA,
        module=FangNiaoGame,
        serialize=FangNiaoGame.serialize,
        deserialize=FangNiaoGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=CarcassonneGame.game_id,
        name="Carcassonne",
        min_players=CarcassonneGame.min_players,
        max_players=CarcassonneGame.max_players,
        turn_mode="turn",
        action_schema=CARCASSONNE_ACTION_SCHEMA,
        config_schema=CARCASSONNE_CONFIG_SCHEMA,
        module=CarcassonneGame,
        serialize=CarcassonneGame.serialize,
        deserialize=CarcassonneGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=TrekkingHistoryGame.game_id,
        name="Trekking through History",
        min_players=TrekkingHistoryGame.min_players,
        max_players=TrekkingHistoryGame.max_players,
        turn_mode="turn",
        action_schema=TREKKING_HISTORY_ACTION_SCHEMA,
        config_schema=TREKKING_HISTORY_CONFIG_SCHEMA,
        module=TrekkingHistoryGame,
        serialize=TrekkingHistoryGame.serialize,
        deserialize=TrekkingHistoryGame.deserialize,
    )
)
