from game.acquire import AcquireGame
from game.abraca_what import AbracaWhatGame
from game.ai_dixit import AiDixitGame
from game.age_of_war import AgeOfWarGame
from game.azul import AzulGame
from game.cabo import CaboGame
from game.cat_in_box import CatInBoxGame
from game.citadels import CitadelsGame
from game.criminal_dance import CriminalDanceGame
from game.coyote import CoyoteGame
from game.cyber_pictures import CyberPicturesGame
from game.davinci_code import DaVinciCodeGame
from game.decrypto import DecryptoGame
from game.dumb_questions import DumbQuestionsGame
from game.draw_guess import DrawGuessGame
from game.fang_niao import FangNiaoGame
from game.fake_artist import FakeArtistGame
from game.flip7 import Flip7Game
from game.forest_shuffle import ForestShuffleGame
from game.gold_rush import GoldRushGame
from game.gizmos import GizmosGame
from game.guandan import GuandanGame
from game.halli_galli import HalliGalliGame
from game.hanabi import HanabiGame
from game.impression_flower import ImpressionFlowerGame
from game.incan_gold import IncanGoldGame
from game.in_a_grove import InAGroveGame
from game.isle_of_skye import IsleOfSkyeGame
from game.istanbul import IstanbulGame
from game.kobayakawa import KobayakawaGame
from game.lost_code import LostCodeGame
from game.manila import ManilaGame
from game.patchwork import PatchworkGame
from game.perfect_mismatch import PerfectMismatchGame
from game.point_salad import PointSaladGame
from game.project_l import ProjectLGame
from game.ra import RaGame
from game.scout import ScoutGame
from game.six_nimmt import SixNimmtGame
from game.the_gang import TheGangGame
from game.things_in_rings import ThingsInRingsGame
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
from game.wavelength import WavelengthGame
from game.word_decode import WordDecodeGame
from game.wandering_towers import WanderingTowersGame
from game.tagiron import TagironGame
from game.turing_machine import TuringMachineGame

ACQUIRE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "play_tile"},
                "tile": {"type": "string", "minLength": 2, "maxLength": 3},
            },
            "required": ["type", "tile"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_chain"},
                "chain_id": {"type": "string", "enum": ["worldwide", "sackson", "festival", "imperial", "american", "continental", "tower"]},
            },
            "required": ["type", "chain_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "dispose_stock"},
                "sell": {"type": "integer", "minimum": 0},
                "trade": {"type": "integer", "minimum": 0},
                "hold": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "sell", "trade", "hold"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "buy_stocks"},
                "chain_ids": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["worldwide", "sackson", "festival", "imperial", "american", "continental", "tower"]},
                    "maxItems": 3,
                },
                "declare_end": {"type": "boolean"},
            },
            "required": ["type", "chain_ids", "declare_end"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "end_turn"},
                "declare_end": {"type": "boolean"},
            },
            "required": ["type", "declare_end"],
            "additionalProperties": False,
        },
    ],
}

ACQUIRE_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "seed": {
            "oneOf": [
                {"type": "integer"},
                {"type": "string", "minLength": 1, "maxLength": 80},
            ]
        }
    },
    "additionalProperties": False,
}

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

IN_A_GROVE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "peek_suspects"},
                "suspect_indexes": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0, "maximum": 2},
                    "minItems": 2,
                    "maxItems": 2,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "suspect_indexes"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "swap_with_victim"},
                "suspect_index": {"type": "integer", "minimum": 0, "maximum": 2},
            },
            "required": ["type", "suspect_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "skip_swap"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_bet"},
                "suspect_index": {"type": "integer", "minimum": 0, "maximum": 2},
            },
            "required": ["type", "suspect_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "next_round"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

IN_A_GROVE_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

TAGIRON_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "ask_question"},
                "question_id": {"type": "integer", "minimum": 1, "maximum": 21},
                "choice": {"type": "integer"},
            },
            "required": ["type", "question_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "guess_tiles"},
                "tiles": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "number": {"type": "integer", "minimum": 0, "maximum": 9},
                            "color": {"type": "string", "enum": ["red", "blue", "green"]},
                        },
                        "required": ["number", "color"],
                        "additionalProperties": False,
                    },
                    "minItems": 1,
                    "maxItems": 5,
                },
            },
            "required": ["type", "tiles"],
            "additionalProperties": False,
        },
    ],
}

TAGIRON_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

DAVINCI_CODE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "arrange_initial_tiles"},
                "ordered_tile_ids": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 1, "maxLength": 40},
                    "minItems": 1,
                },
            },
            "required": ["type", "ordered_tile_ids"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "guess_tile"},
                "target_player_id": {"type": "string", "minLength": 1, "maxLength": 80},
                "target_index": {"type": "integer", "minimum": 0},
                "declared_color": {"type": "string", "enum": ["dark", "light"]},
                "declared_value": {
                    "oneOf": [
                        {"type": "integer", "minimum": 0, "maximum": 11},
                        {"const": "dash"},
                    ]
                },
            },
            "required": ["type", "target_player_id", "target_index", "declared_color", "declared_value"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "continue_guess"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "stop_turn"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "reveal_own_tile"},
                "tile_index": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "tile_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "insert_pending_tile"},
                "insert_index": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "insert_index"],
            "additionalProperties": False,
        },
    ],
}

DAVINCI_CODE_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "mode": {"type": "string", "enum": ["standard", "advanced"]},
    },
    "additionalProperties": False,
}

GIZMOS_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "pick_energy"},
                "color": {"type": "string", "enum": ["red", "yellow", "blue", "black"]},
            },
            "required": ["type", "color"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "file_display"},
                "card_id": {"type": "string", "minLength": 1, "maxLength": 120},
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "build_display"},
                "card_id": {"type": "string", "minLength": 1, "maxLength": 120},
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "build_archive"},
                "card_id": {"type": "string", "minLength": 1, "maxLength": 120},
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "research"},
                "level": {"type": "integer", "enum": [1, 2, 3]},
            },
            "required": ["type", "level"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "resolve_research"},
                "choice": {"type": "string", "enum": ["none", "file", "build"]},
                "card_id": {"type": "string", "minLength": 1, "maxLength": 120},
                "return_order": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 1, "maxLength": 120},
                },
            },
            "required": ["type", "choice", "return_order"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "resolve_effect"},
                "effect_id": {"type": "integer", "minimum": 1},
            },
            "required": ["type", "effect_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "pass_effects"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "pass_turn"}}, "required": ["type"], "additionalProperties": False},
    ],
}

GIZMOS_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "seed": {
            "oneOf": [
                {"type": "integer"},
                {"type": "string"},
                {"type": "null"},
            ]
        },
    },
    "additionalProperties": False,
}

TURING_MACHINE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "set_proposal"},
                "code": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 1, "maximum": 5},
                    "minItems": 3,
                    "maxItems": 3,
                },
            },
            "required": ["type", "code"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "test_criterion"},
                "slot": {"type": "string", "minLength": 1, "maxLength": 8},
            },
            "required": ["type", "slot"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "next_round"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_guess"},
                "code": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 1, "maximum": 5},
                    "minItems": 3,
                    "maxItems": 3,
                },
            },
            "required": ["type", "code"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "give_up"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "update_notes"},
                "notes": {"type": "object"},
            },
            "required": ["type", "notes"],
            "additionalProperties": False,
        },
    ],
}

TURING_MACHINE_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "mode": {"type": "string", "enum": ["simple", "expert"]},
        "scenario_source": {"type": "string", "enum": ["preset", "random"]},
        "difficulty": {"type": "string", "enum": ["easy", "standard", "hard", "expert"]},
        "preset_id": {"type": "string", "minLength": 1, "maxLength": 80},
        "seed": {"type": "string", "maxLength": 80},
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

RA_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {"type": {"const": "draw_tile"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "invoke_ra"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "play_god"},
                "tile_ids": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 1, "maxLength": 40},
                    "minItems": 1,
                    "maxItems": 8,
                },
            },
            "required": ["type", "tile_ids"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "bid"}, "disk": {"type": "integer", "minimum": 1, "maximum": 16}},
            "required": ["type", "disk"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "pass"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "resolve_disaster"},
                "tile_ids": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 1, "maxLength": 40},
                    "maxItems": 8,
                },
            },
            "required": ["type", "tile_ids"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
    ],
}

RA_CONFIG_SCHEMA = {
    "type": "object",
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

FAKE_ARTIST_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "choose_color"}, "color": {"type": "string", "minLength": 1}},
            "required": ["type", "color"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_stroke"},
                "points": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                        "type": "array",
                        "minItems": 2,
                        "maxItems": 2,
                        "items": {"type": "number"},
                    },
                },
            },
            "required": ["type", "points"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "submit_vote"}, "target_id": {"type": "string", "minLength": 1}},
            "required": ["type", "target_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "submit_final_guess"}, "text": {"type": "string", "minLength": 1}},
            "required": ["type", "text"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "play_again"}}, "required": ["type"], "additionalProperties": False},
    ],
}

FAKE_ARTIST_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "rounds": {"type": "integer", "minimum": 1},
        "turn_time_sec": {"type": "number", "minimum": 1},
    },
    "additionalProperties": False,
}

THINGS_IN_RINGS_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_seed_clue"},
                "hand_index": {"type": "integer", "minimum": 0},
                "memberships": {
                    "type": "array",
                    "items": {"type": "boolean"},
                    "minItems": 1,
                    "maxItems": 3,
                },
            },
            "required": ["type", "hand_index", "memberships"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_play"},
                "hand_index": {"type": "integer", "minimum": 0},
                "zone_id": {"type": "string", "pattern": "^[01]{1,3}$"},
            },
            "required": ["type", "hand_index", "zone_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "judge_play"},
                "memberships": {
                    "type": "array",
                    "items": {"type": "boolean"},
                    "minItems": 1,
                    "maxItems": 3,
                },
            },
            "required": ["type", "memberships"],
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

THINGS_IN_RINGS_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "ring_count": {"type": "integer", "minimum": 1, "maximum": 3},
        "ring_types": {
            "type": "array",
            "items": {"type": "string", "enum": ["word", "attribute", "context"]},
            "minItems": 1,
            "maxItems": 3,
            "uniqueItems": True,
        },
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

WANDERING_TOWERS_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "play_card"},
                "card_index": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "card_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_target"},
                "target_type": {"type": "string", "enum": ["wizard", "tower"]},
                "target_id": {"type": "string"},
            },
            "required": ["type", "target_type", "target_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "reroll_dice"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "accept_roll"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "discard_move"}, "tower_id": {"type": "string"}},
            "required": ["type", "tower_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "cast_spell"},
                "spell": {"type": "string", "enum": ["move_wizard", "move_tower"]},
                "target_id": {"type": "string"},
            },
            "required": ["type", "spell", "target_id"],
            "additionalProperties": False,
        },
    ],
}

WANDERING_TOWERS_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

ISTANBUL_ACTION_SCHEMA = {
    "type": "object",
    "properties": {"type": {"type": "string"}},
    "required": ["type"],
    "additionalProperties": True,
}

ISTANBUL_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "layout": {"type": "string", "enum": ["standard", "random"]},
    },
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

AGE_OF_WAR_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "select_target"},
                "target_type": {"type": "string", "enum": ["central", "player"]},
                "castle_id": {"type": "string", "minLength": 1},
                "defender_id": {"type": "string"},
            },
            "required": ["type", "target_type", "castle_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "roll"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "fill_line"}, "line_index": {"type": "integer", "minimum": 0}},
            "required": ["type", "line_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "discard_die"}, "die_index": {"type": "integer", "minimum": 0}},
            "required": ["type", "die_index"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "play_again"}}, "required": ["type"], "additionalProperties": False},
    ],
}

AGE_OF_WAR_CONFIG_SCHEMA = {
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

DUMB_QUESTIONS_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "select_category"}, "category": {"type": "string"}},
            "required": ["type", "category"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "submit_answer"}, "answer_text": {"type": "string", "minLength": 1}},
            "required": ["type", "answer_text"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "reveal_next_card"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_card"},
                "slot": {"type": "integer", "minimum": 0, "maximum": 4},
                "card_id": {"type": "string", "minLength": 1},
            },
            "required": ["type", "slot", "card_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "move_card"},
                "slot": {"type": "integer", "minimum": 0, "maximum": 4},
                "direction": {"type": "string", "enum": ["up", "down"]},
            },
            "required": ["type", "slot", "direction"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "finish_ranking"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "continue_next_round"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "play_again"}}, "required": ["type"], "additionalProperties": False},
    ],
}

DUMB_QUESTIONS_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "rounds_per_guesser": {"type": "integer", "minimum": 1, "maximum": 3},
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

AZUL_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_tiles"},
                "source": {"type": "string", "enum": ["factory", "center"]},
                "source_index": {"type": "integer", "minimum": 0},
                "color": {"type": "string", "enum": ["blue", "yellow", "red", "black", "white"]},
                "target_row": {"type": "integer", "minimum": -1, "maximum": 4},
            },
            "required": ["type", "source", "color", "target_row"],
            "additionalProperties": False,
        },
    ],
}

AZUL_CONFIG_SCHEMA = {
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
                },
            },
            "required": ["type", "base_guess", "hidden_guesses"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "update_guess_draft"},
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
                },
            },
            "required": ["type", "base_guess", "hidden_guesses"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "end_game"}}, "required": ["type"], "additionalProperties": False},
    ],
}

WORD_DECODE_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "guess_time_limit_sec": {"type": "integer", "enum": [0, 60, 120]},
    },
    "additionalProperties": False,
}

PATCHWORK_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {"type": {"const": "advance"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "buy_patch"},
                "patch_id": {"type": "string"},
                "rotation": {"type": "integer", "enum": [0, 90, 180, 270]},
                "flip": {"type": "boolean"},
                "x": {"type": "integer", "minimum": 0, "maximum": 8},
                "y": {"type": "integer", "minimum": 0, "maximum": 8},
            },
            "required": ["type", "patch_id", "rotation", "flip", "x", "y"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_bonus_patch"},
                "x": {"type": "integer", "minimum": 0, "maximum": 8},
                "y": {"type": "integer", "minimum": 0, "maximum": 8},
            },
            "required": ["type", "x", "y"],
            "additionalProperties": False,
        },
    ],
}

PATCHWORK_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "seed": {"type": "integer"},
    },
    "additionalProperties": False,
}

ISLE_OF_SKYE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_prices"},
                "discard_tile_id": {"type": "string", "minLength": 1},
                "priced_tiles": {
                    "type": "array",
                    "minItems": 2,
                    "maxItems": 2,
                    "items": {
                        "type": "object",
                        "properties": {
                            "tile_id": {"type": "string", "minLength": 1},
                            "price": {"type": "integer", "minimum": 1},
                        },
                        "required": ["tile_id", "price"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["type", "discard_tile_id", "priced_tiles"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "buy_tile"},
                "seller_id": {"type": "string", "minLength": 1},
                "tile_id": {"type": "string", "minLength": 1},
            },
            "required": ["type", "seller_id", "tile_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "pass_buy"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_tile"},
                "tile_id": {"type": "string", "minLength": 1},
                "x": {"type": "integer"},
                "y": {"type": "integer"},
                "rotation": {"type": "integer", "enum": [0, 90, 180, 270]},
            },
            "required": ["type", "tile_id", "x", "y", "rotation"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "return_tile"},
                "tile_id": {"type": "string", "minLength": 1},
            },
            "required": ["type", "tile_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "finish_build"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

ISLE_OF_SKYE_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "seed": {"type": "integer"},
    },
    "additionalProperties": False,
}

FOREST_SHUFFLE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "draw_cards"},
                "sources": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "oneOf": [
                            {
                                "type": "object",
                                "properties": {"zone": {"const": "deck"}},
                                "required": ["zone"],
                                "additionalProperties": False,
                            },
                            {
                                "type": "object",
                                "properties": {"zone": {"const": "clearing"}, "card_id": {"type": "string", "minLength": 1}},
                                "required": ["zone", "card_id"],
                                "additionalProperties": False,
                            },
                        ],
                    },
                    "minItems": 1,
                    "maxItems": 2,
                },
            },
            "required": ["type", "sources"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "play_card"},
                "card_id": {"type": "string", "minLength": 1},
                "half_index": {"type": "integer", "minimum": 0, "maximum": 1},
                "target_tree_id": {"type": "string", "minLength": 1},
                "play_as": {"type": "string", "enum": ["sapling"]},
                "pay_card_ids": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 1},
                    "maxItems": 3,
                },
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "finish_pending"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "resolve_raccoon"},
                "card_ids": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 1},
                },
            },
            "required": ["type", "card_ids"],
            "additionalProperties": False,
        },
    ],
}

FOREST_SHUFFLE_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "opening_mulligan_if_no_tree": {"type": "boolean"},
        "seed": {"type": ["integer", "string"]},
    },
    "additionalProperties": False,
}

MANILA_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "bid"}, "amount": {"type": "integer", "minimum": 1}},
            "required": ["type", "amount"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "pass_bid"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "buy_stock"}, "cargo": {"type": "string"}},
            "required": ["type", "cargo"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "pay_bid"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "skip_buy"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "select_cargo"}, "cargo": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 3},
            },
            "required": ["type", "cargo"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "set_positions"},
                "positions": {"type": "array", "items": {"type": "integer", "minimum": 0, "maximum": 13}, "minItems": 3, "maxItems": 3},
            },
            "required": ["type", "positions"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_worker"},
                "location": {"type": "object"},
            },
            "required": ["type", "location"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "pass"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "pledge_stock"}, "cargo": {"type": "string"}},
            "required": ["type", "cargo"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "pilot_move"},
                "size": {"type": "string", "enum": ["small", "big"]},
                "cargo": {"type": "string"},
                "delta": {"type": "integer", "minimum": -2, "maximum": 2},
            },
            "required": ["type", "size", "cargo", "delta"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "pilot_split"},
                "size": {"type": "string", "enum": ["big"]},
                "cargo_a": {"type": "string"},
                "cargo_b": {"type": "string"},
                "delta_a": {"type": "integer", "minimum": -1, "maximum": 1},
                "delta_b": {"type": "integer", "minimum": -1, "maximum": 1},
            },
            "required": ["type", "size", "cargo_a", "cargo_b", "delta_a", "delta_b"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "pirate_action"},
                "mode": {"type": "string", "enum": ["board", "plunder", "skip"]},
                "cargo": {"type": "string"},
                "result": {"type": "string", "enum": ["port", "shipyard"]},
            },
            "required": ["type", "mode"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "play_again"}}, "required": ["type"], "additionalProperties": False},
    ],
}

MANILA_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "starting_cash": {"type": "integer", "minimum": 0},
        "initial_stocks": {"type": "integer", "minimum": 0},
        "loan_amount": {"type": "integer", "minimum": 0},
        "loan_repay": {"type": "integer", "minimum": 0},
    },
    "additionalProperties": False,
}

SCOUT_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "ready_hand"},
                "flip": {"type": "boolean"},
            },
            "required": ["type", "flip"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "show"},
                "start_index": {"type": "integer", "minimum": 0},
                "end_index": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "start_index", "end_index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "scout"},
                "take_side": {"type": "string", "enum": ["left", "right"]},
                "insert_index": {"type": "integer", "minimum": 0},
                "insert_face": {"type": "string", "enum": ["a", "b"]},
            },
            "required": ["type", "take_side", "insert_index", "insert_face"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "scout_and_show"},
                "take_side": {"type": "string", "enum": ["left", "right"]},
                "insert_index": {"type": "integer", "minimum": 0},
                "insert_face": {"type": "string", "enum": ["a", "b"]},
            },
            "required": ["type", "take_side", "insert_index", "insert_face"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "finish_scout_and_show"},
            },
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

SCOUT_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "seed": {"type": ["string", "integer", "number"]},
    },
    "additionalProperties": False,
}

CITADELS_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "draft_character"},
                "rank": {"type": "integer", "minimum": 1, "maximum": 9},
            },
            "required": ["type", "rank"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_income"},
                "choice": {"type": "string", "enum": ["gold", "cards"]},
            },
            "required": ["type", "choice"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_draw"},
                "card_id": {"type": "string", "minLength": 1},
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "collect_tax"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "use_assassin"},
                "target_rank": {"type": "integer", "minimum": 2, "maximum": 9},
            },
            "required": ["type", "target_rank"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "use_thief"},
                "target_rank": {"type": "integer", "minimum": 3, "maximum": 9},
            },
            "required": ["type", "target_rank"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "magician_swap"},
                "target_player_id": {"type": "string", "minLength": 1},
            },
            "required": ["type", "target_player_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "magician_redraw"},
                "card_ids": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 1},
                    "minItems": 1,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "card_ids"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "build"},
                "card_id": {"type": "string", "minLength": 1},
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "destroy_district"},
                "target_player_id": {"type": "string", "minLength": 1},
                "district_id": {"type": "string", "minLength": 1},
            },
            "required": ["type", "target_player_id", "district_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "end_turn"}}, "required": ["type"], "additionalProperties": False},
    ],
}

CITADELS_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "winning_city_size": {"type": "integer", "enum": [7, 8]},
    },
    "additionalProperties": False,
}

LOST_CODE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {"type": {"const": "roll_dice"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "pass_shortcut"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "take_shortcut"},
                "guesses": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0, "maximum": 8},
                    "minItems": 1,
                    "maxItems": 3,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "guesses"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "modify_die"},
                "die_index": {"type": "integer", "minimum": 0, "maximum": 2},
                "symbol": {"type": "string"},
            },
            "required": ["type", "die_index", "symbol"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "confirm_dice"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_guess"},
                "wheel_id": {"type": "string"},
                "min": {"type": "integer", "minimum": 0},
                "max": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "wheel_id", "min", "max"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "replace_stone"},
                "symbol": {"type": "string"},
            },
            "required": ["type", "symbol"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "skip_exchange"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_final_guesses"},
                "guesses": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "array",
                        "items": {"type": "integer", "minimum": 0, "maximum": 8},
                        "maxItems": 3,
                        "uniqueItems": True,
                    },
                },
            },
            "required": ["type", "guesses"],
            "additionalProperties": False,
        },
    ],
}

LOST_CODE_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "mode": {"type": "string", "enum": ["standard", "intro", "x_race"]},
        "deadly_shortcut": {"type": "boolean"},
        "curse_of_temple": {"type": "boolean"},
    },
    "additionalProperties": False,
}

CRIMINAL_DANCE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "play_card"},
                "card_id": {"type": "string", "minLength": 1},
                "target_player_id": {"type": "string", "minLength": 1},
                "your_card_id": {"type": "string", "minLength": 1},
                "target_card_id": {"type": "string", "minLength": 1},
            },
            "required": ["type", "card_id"],
            "additionalProperties": True,
        },
        {"type": "object", "properties": {"type": {"const": "play_again"}}, "required": ["type"], "additionalProperties": False},
    ],
}

CRIMINAL_DANCE_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "enable_boy": {"type": "boolean"},
        "enable_chief": {"type": "boolean"},
        "detective_activation_rule": {"type": "string", "enum": ["hand_leq_3", "round_ge_2", "always"]},
        "dog_fail_behavior": {"type": "string", "enum": ["discard", "give_to_target"]},
        "boy_visibility_mode": {"type": "string", "enum": ["boy_knows_criminal", "mutual"]},
        "scoring_enabled": {"type": "boolean"},
        "target_score_by_player_count": {
            "type": "object",
            "additionalProperties": {"type": "integer", "minimum": 1},
        },
    },
    "additionalProperties": False,
}

WAVELENGTH_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "submit_clue"}, "clue": {"type": "string", "minLength": 1, "maxLength": 200}},
            "required": ["type", "clue"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "submit_team_guess"}, "pos": {"type": "number", "minimum": -1.0, "maximum": 1.0}},
            "required": ["type", "pos"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "submit_side_guess"}, "side": {"type": "string", "enum": ["LEFT", "RIGHT"]}},
            "required": ["type", "side"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "continue_next_round"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

WAVELENGTH_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "target_score": {"type": "integer", "minimum": 1},
        "starting_score_second_team": {"type": "integer", "minimum": 0},
        "enable_catch_up_rule": {"type": "boolean"},
    },
    "additionalProperties": False,
}

GUANDAN_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "play"},
                "card_ids": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "minItems": 1,
                },
            },
            "required": ["type", "card_ids"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "pass"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "tribute_select"}, "card_id": {"type": "integer"}},
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "return_select"}, "card_id": {"type": "integer"}},
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "play_again"}}, "required": ["type"], "additionalProperties": False},
    ],
}

GUANDAN_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "hard_bomb_beats_soft": {"type": "boolean"},
        "require_partner_not_last_for_a": {"type": "boolean"},
        "bot_mode": {"type": "string", "enum": ["auto", "heuristic", "nn"]},
        "bot_nn_checkpoint": {"type": "string", "maxLength": 240},
    },
    "additionalProperties": False,
}

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
        game_id=GuandanGame.game_id,
        name="Guandan",
        min_players=GuandanGame.min_players,
        max_players=GuandanGame.max_players,
        turn_mode="turn",
        action_schema=GUANDAN_ACTION_SCHEMA,
        config_schema=GUANDAN_CONFIG_SCHEMA,
        module=GuandanGame,
        serialize=GuandanGame.serialize,
        deserialize=GuandanGame.deserialize,
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
        game_id=InAGroveGame.game_id,
        name="In a Grove",
        min_players=InAGroveGame.min_players,
        max_players=InAGroveGame.max_players,
        turn_mode="turn",
        action_schema=IN_A_GROVE_ACTION_SCHEMA,
        config_schema=IN_A_GROVE_CONFIG_SCHEMA,
        module=InAGroveGame,
        serialize=InAGroveGame.serialize,
        deserialize=InAGroveGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=TagironGame.game_id,
        name="Tagiron",
        min_players=TagironGame.min_players,
        max_players=TagironGame.max_players,
        turn_mode="turn",
        action_schema=TAGIRON_ACTION_SCHEMA,
        config_schema=TAGIRON_CONFIG_SCHEMA,
        module=TagironGame,
        serialize=TagironGame.serialize,
        deserialize=TagironGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=TuringMachineGame.game_id,
        name="Turing Machine",
        min_players=TuringMachineGame.min_players,
        max_players=TuringMachineGame.max_players,
        turn_mode="simultaneous",
        action_schema=TURING_MACHINE_ACTION_SCHEMA,
        config_schema=TURING_MACHINE_CONFIG_SCHEMA,
        module=TuringMachineGame,
        serialize=TuringMachineGame.serialize,
        deserialize=TuringMachineGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=DaVinciCodeGame.game_id,
        name="Da Vinci Code",
        min_players=DaVinciCodeGame.min_players,
        max_players=DaVinciCodeGame.max_players,
        turn_mode="turn",
        action_schema=DAVINCI_CODE_ACTION_SCHEMA,
        config_schema=DAVINCI_CODE_CONFIG_SCHEMA,
        module=DaVinciCodeGame,
        serialize=DaVinciCodeGame.serialize,
        deserialize=DaVinciCodeGame.deserialize,
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
        game_id=GizmosGame.game_id,
        name="Gizmos",
        min_players=GizmosGame.min_players,
        max_players=GizmosGame.max_players,
        turn_mode="turn",
        action_schema=GIZMOS_ACTION_SCHEMA,
        config_schema=GIZMOS_CONFIG_SCHEMA,
        module=GizmosGame,
        serialize=GizmosGame.serialize,
        deserialize=GizmosGame.deserialize,
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
        game_id=FakeArtistGame.game_id,
        name="A Fake Artist Goes to New York",
        min_players=FakeArtistGame.min_players,
        max_players=FakeArtistGame.max_players,
        turn_mode="turn",
        action_schema=FAKE_ARTIST_ACTION_SCHEMA,
        config_schema=FAKE_ARTIST_CONFIG_SCHEMA,
        module=FakeArtistGame,
        serialize=FakeArtistGame.serialize,
        deserialize=FakeArtistGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=ThingsInRingsGame.game_id,
        name="Things in Rings",
        min_players=ThingsInRingsGame.min_players,
        max_players=ThingsInRingsGame.max_players,
        turn_mode="turn",
        action_schema=THINGS_IN_RINGS_ACTION_SCHEMA,
        config_schema=THINGS_IN_RINGS_CONFIG_SCHEMA,
        module=ThingsInRingsGame,
        serialize=ThingsInRingsGame.serialize,
        deserialize=ThingsInRingsGame.deserialize,
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
        name="Flip7flash",
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
        game_id=IstanbulGame.game_id,
        name="Istanbul",
        min_players=IstanbulGame.min_players,
        max_players=IstanbulGame.max_players,
        turn_mode="turn",
        action_schema=ISTANBUL_ACTION_SCHEMA,
        config_schema=ISTANBUL_CONFIG_SCHEMA,
        module=IstanbulGame,
        serialize=IstanbulGame.serialize,
        deserialize=IstanbulGame.deserialize,
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
        game_id=AgeOfWarGame.game_id,
        name="Age of War",
        min_players=AgeOfWarGame.min_players,
        max_players=AgeOfWarGame.max_players,
        turn_mode="turn",
        action_schema=AGE_OF_WAR_ACTION_SCHEMA,
        config_schema=AGE_OF_WAR_CONFIG_SCHEMA,
        module=AgeOfWarGame,
        serialize=AgeOfWarGame.serialize,
        deserialize=AgeOfWarGame.deserialize,
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
        game_id=RaGame.game_id,
        name="Ra",
        min_players=RaGame.min_players,
        max_players=RaGame.max_players,
        turn_mode="turn",
        action_schema=RA_ACTION_SCHEMA,
        config_schema=RA_CONFIG_SCHEMA,
        module=RaGame,
        serialize=RaGame.serialize,
        deserialize=RaGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=ScoutGame.game_id,
        name="Scout",
        min_players=ScoutGame.min_players,
        max_players=ScoutGame.max_players,
        turn_mode="turn",
        action_schema=SCOUT_ACTION_SCHEMA,
        config_schema=SCOUT_CONFIG_SCHEMA,
        module=ScoutGame,
        serialize=ScoutGame.serialize,
        deserialize=ScoutGame.deserialize,
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
        game_id=AzulGame.game_id,
        name="Azul",
        min_players=AzulGame.min_players,
        max_players=AzulGame.max_players,
        turn_mode="turn",
        action_schema=AZUL_ACTION_SCHEMA,
        config_schema=AZUL_CONFIG_SCHEMA,
        module=AzulGame,
        serialize=AzulGame.serialize,
        deserialize=AzulGame.deserialize,
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

register_game(
    GameDefinition(
        game_id=WanderingTowersGame.game_id,
        name="Wandering Towers",
        min_players=WanderingTowersGame.min_players,
        max_players=WanderingTowersGame.max_players,
        turn_mode="turn",
        action_schema=WANDERING_TOWERS_ACTION_SCHEMA,
        config_schema=WANDERING_TOWERS_CONFIG_SCHEMA,
        module=WanderingTowersGame,
        serialize=WanderingTowersGame.serialize,
        deserialize=WanderingTowersGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=PatchworkGame.game_id,
        name="Patchwork",
        min_players=PatchworkGame.min_players,
        max_players=PatchworkGame.max_players,
        turn_mode="turn",
        action_schema=PATCHWORK_ACTION_SCHEMA,
        config_schema=PATCHWORK_CONFIG_SCHEMA,
        module=PatchworkGame,
        serialize=PatchworkGame.serialize,
        deserialize=PatchworkGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=IsleOfSkyeGame.game_id,
        name="Isle of Skye",
        min_players=IsleOfSkyeGame.min_players,
        max_players=IsleOfSkyeGame.max_players,
        turn_mode="turn",
        action_schema=ISLE_OF_SKYE_ACTION_SCHEMA,
        config_schema=ISLE_OF_SKYE_CONFIG_SCHEMA,
        module=IsleOfSkyeGame,
        serialize=IsleOfSkyeGame.serialize,
        deserialize=IsleOfSkyeGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=ForestShuffleGame.game_id,
        name="Forest Shuffle",
        min_players=ForestShuffleGame.min_players,
        max_players=ForestShuffleGame.max_players,
        turn_mode="turn",
        action_schema=FOREST_SHUFFLE_ACTION_SCHEMA,
        config_schema=FOREST_SHUFFLE_CONFIG_SCHEMA,
        module=ForestShuffleGame,
        serialize=ForestShuffleGame.serialize,
        deserialize=ForestShuffleGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=ManilaGame.game_id,
        name="Manila",
        min_players=ManilaGame.min_players,
        max_players=ManilaGame.max_players,
        turn_mode="turn",
        action_schema=MANILA_ACTION_SCHEMA,
        config_schema=MANILA_CONFIG_SCHEMA,
        module=ManilaGame,
        serialize=ManilaGame.serialize,
        deserialize=ManilaGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=CitadelsGame.game_id,
        name="Citadels",
        min_players=CitadelsGame.min_players,
        max_players=CitadelsGame.max_players,
        turn_mode="turn",
        action_schema=CITADELS_ACTION_SCHEMA,
        config_schema=CITADELS_CONFIG_SCHEMA,
        module=CitadelsGame,
        serialize=CitadelsGame.serialize,
        deserialize=CitadelsGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=LostCodeGame.game_id,
        name="The Lost Code",
        min_players=LostCodeGame.min_players,
        max_players=LostCodeGame.max_players,
        turn_mode="turn",
        action_schema=LOST_CODE_ACTION_SCHEMA,
        config_schema=LOST_CODE_CONFIG_SCHEMA,
        module=LostCodeGame,
        serialize=LostCodeGame.serialize,
        deserialize=LostCodeGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=CriminalDanceGame.game_id,
        name="Criminal Dance",
        min_players=CriminalDanceGame.min_players,
        max_players=CriminalDanceGame.max_players,
        turn_mode="turn",
        action_schema=CRIMINAL_DANCE_ACTION_SCHEMA,
        config_schema=CRIMINAL_DANCE_CONFIG_SCHEMA,
        module=CriminalDanceGame,
        serialize=CriminalDanceGame.serialize,
        deserialize=CriminalDanceGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=WavelengthGame.game_id,
        name="Wavelength",
        min_players=WavelengthGame.min_players,
        max_players=WavelengthGame.max_players,
        turn_mode="simultaneous",
        action_schema=WAVELENGTH_ACTION_SCHEMA,
        config_schema=WAVELENGTH_CONFIG_SCHEMA,
        module=WavelengthGame,
        serialize=WavelengthGame.serialize,
        deserialize=WavelengthGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=AcquireGame.game_id,
        name="Acquire",
        min_players=AcquireGame.min_players,
        max_players=AcquireGame.max_players,
        turn_mode="turn",
        action_schema=ACQUIRE_ACTION_SCHEMA,
        config_schema=ACQUIRE_CONFIG_SCHEMA,
        module=AcquireGame,
        serialize=AcquireGame.serialize,
        deserialize=AcquireGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=DumbQuestionsGame.game_id,
        name="Dumb Questions to Ask Your Friends",
        min_players=DumbQuestionsGame.min_players,
        max_players=DumbQuestionsGame.max_players,
        turn_mode="simultaneous",
        action_schema=DUMB_QUESTIONS_ACTION_SCHEMA,
        config_schema=DUMB_QUESTIONS_CONFIG_SCHEMA,
        module=DumbQuestionsGame,
        serialize=DumbQuestionsGame.serialize,
        deserialize=DumbQuestionsGame.deserialize,
    )
)
