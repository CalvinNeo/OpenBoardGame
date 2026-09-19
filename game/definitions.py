from game.acquire import AcquireGame
from game.abraca_what import AbracaWhatGame
from game.ai_dixit import AiDixitGame
from game.age_of_war import AgeOfWarGame
from game.ark_nova import ArkNovaGame
from game.gaia_project import GaiaProjectGame
from game.gaia_project_data import ACTION_SCHEMA as GAIA_PROJECT_ACTION_SCHEMA, CONFIG_SCHEMA as GAIA_PROJECT_CONFIG_SCHEMA
from game.azul import AzulGame
from game.bohnanza_dice import BohnanzaDiceGame
from game.bomb_busters import BombBustersGame
from game.cabo import CaboGame
from game.castles_of_burgundy import CastlesOfBurgundyGame
from game.castles_of_burgundy_data import ACTION_SCHEMA as BURGUNDY_ACTION_SCHEMA, CONFIG_SCHEMA as BURGUNDY_CONFIG_SCHEMA
from game.cat_in_box import CatInBoxGame
from game.celestia import CelestiaGame
from game.century_spice_road import CenturySpiceRoadGame
from game.citadels import CitadelsGame
from game.criminal_dance import CriminalDanceGame
from game.coyote import CoyoteGame
from game.cyber_pictures import CyberPicturesGame
from game.davinci_code import DaVinciCodeGame
from game.decrypto import DecryptoGame
from game.dumb_questions import DumbQuestionsGame
from game.draw_guess import DrawGuessGame
from game.emerald_skulls import EmeraldSkullsGame
from game.fang_niao import FangNiaoGame
from game.fake_artist import FakeArtistGame
from game.felix import FelixGame
from game.flip7 import Flip7Game
from game.forest_shuffle import ForestShuffleGame
from game.gold_rush import GoldRushGame
from game.gizmos import GizmosGame
from game.guandan import GuandanGame
from game.halli_galli import HalliGalliGame
from game.hanabi import HanabiGame
from game.high_society import HighSocietyGame
from game.hot_streak import HotStreakGame
from game.impression_flower import ImpressionFlowerGame
from game.incan_gold import IncanGoldGame
from game.in_a_grove import InAGroveGame
from game.isle_of_skye import IsleOfSkyeGame
from game.istanbul import IstanbulGame
from game.kobayakawa import KobayakawaGame
from game.kronologic import KronologicGame
from game.lost_code import LostCodeGame
from game.manila import ManilaGame
from game.nine_upper import NineUpperGame
from game.patchwork import PatchworkGame
from game.perfect_mismatch import PerfectMismatchGame
from game.point_salad import PointSaladGame
from game.poison import PoisonGame
from game.ponzi_scheme import PonziSchemeGame
from game.ponzi_scheme_data import ACTION_SCHEMA as PONZI_SCHEME_ACTION_SCHEMA, CONFIG_SCHEMA as PONZI_SCHEME_CONFIG_SCHEMA
from game.project_l import ProjectLGame
from game.ra import RaGame
from game.rebel_princess import RebelPrincessGame
from game.scout import ScoutGame
from game.six_nimmt import SixNimmtGame
from game.the_gang import TheGangGame
from game.take_time import TakeTimeGame
from game.eternal_decks import EternalDecksGame
from game.eternal_decks_data import ACTION_SCHEMA as ETERNAL_DECKS_ACTION_SCHEMA, CONFIG_SCHEMA as ETERNAL_DECKS_CONFIG_SCHEMA
from game.take_time_data import ACTION_SCHEMA as TAKE_TIME_ACTION_SCHEMA, CONFIG_SCHEMA as TAKE_TIME_CONFIG_SCHEMA
from game.things_in_rings import ThingsInRingsGame
from game.yahtzee import YahtzeeGame
from game.registry import GameDefinition, register_game
from game.splendor import SplendorGame
from game.splendor_pokemon import PokemonSplendorGame
from game.blokus import BlokusGame
from game.blitz_sketch import BlitzSketchGame
from game.carcassonne import CarcassonneGame
from game.catan_starfarers import CatanStarfarersGame
from game.skull import SkullGame
from game.subtext import SubtextGame
from game.trekking_history import TrekkingHistoryGame
from game.texas_holdem import TexasHoldemGame
from game.wavelength import WavelengthGame
from game.word_decode import WordDecodeGame
from game.wandering_towers import WanderingTowersGame
from game.tagiron import TagironGame
from game.tacta import TactaGame
from game.turing_machine import TuringMachineGame
from game.tucano import TucanoGame
from game.witchs_brew import WitchsBrewGame
from game.wriggle_roulette import WriggleRouletteGame

register_game(
    GameDefinition(
        game_id=PonziSchemeGame.game_id,
        name="Ponzi Scheme",
        name_zh="庞氏骗局",
        min_players=PonziSchemeGame.min_players,
        max_players=PonziSchemeGame.max_players,
        turn_mode="turn",
        action_schema=PONZI_SCHEME_ACTION_SCHEMA,
        config_schema=PONZI_SCHEME_CONFIG_SCHEMA,
        module=PonziSchemeGame,
        serialize=PonziSchemeGame.serialize,
        deserialize=PonziSchemeGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=EternalDecksGame.game_id,
        name="Eternal Decks",
        name_zh="永恒牌",
        min_players=EternalDecksGame.min_players,
        max_players=EternalDecksGame.max_players,
        turn_mode="turn",
        action_schema=ETERNAL_DECKS_ACTION_SCHEMA,
        config_schema=ETERNAL_DECKS_CONFIG_SCHEMA,
        module=EternalDecksGame,
        serialize=EternalDecksGame.serialize,
        deserialize=EternalDecksGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=TakeTimeGame.game_id,
        name="Take Time",
        name_zh="时序谜局",
        min_players=TakeTimeGame.min_players,
        max_players=TakeTimeGame.max_players,
        turn_mode="turn",
        action_schema=TAKE_TIME_ACTION_SCHEMA,
        config_schema=TAKE_TIME_CONFIG_SCHEMA,
        module=TakeTimeGame,
        serialize=TakeTimeGame.serialize,
        deserialize=TakeTimeGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=GaiaProjectGame.game_id,
        name="Gaia Project",
        name_zh="盖亚计划",
        min_players=GaiaProjectGame.min_players,
        max_players=GaiaProjectGame.max_players,
        turn_mode="turn",
        action_schema=GAIA_PROJECT_ACTION_SCHEMA,
        config_schema=GAIA_PROJECT_CONFIG_SCHEMA,
        module=GaiaProjectGame,
        serialize=GaiaProjectGame.serialize,
        deserialize=GaiaProjectGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=CastlesOfBurgundyGame.game_id,
        name="The Castles of Burgundy",
        name_zh="勃艮第城堡",
        min_players=CastlesOfBurgundyGame.min_players,
        max_players=CastlesOfBurgundyGame.max_players,
        turn_mode="turn",
        action_schema=BURGUNDY_ACTION_SCHEMA,
        config_schema=BURGUNDY_CONFIG_SCHEMA,
        module=CastlesOfBurgundyGame,
        serialize=CastlesOfBurgundyGame.serialize,
        deserialize=CastlesOfBurgundyGame.deserialize,
    )
)

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

HIGH_SOCIETY_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "bid"},
                "money_values": {
                    "type": "array",
                    "items": {"type": "integer", "enum": [1000, 2000, 3000, 4000, 6000, 8000, 10000, 12000, 15000, 20000, 25000]},
                    "minItems": 1,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "money_values"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "pass"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_faux_pas_discard"},
                "card_id": {"type": "string", "pattern": "^luxury_(10|[1-9])$"},
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
    ],
}

HIGH_SOCIETY_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

POISON_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "play_card"},
                "card_id": {
                    "type": "string",
                    "pattern": r"^poison-(?:(?:red|blue|purple)-(?:1|2|4|5|7)|toxic-4)-\d{2}$",
                    "maxLength": 32,
                },
                "cauldron_index": {"type": "integer", "minimum": 0, "maximum": 2},
            },
            "required": ["type", "card_id", "cauldron_index"],
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
            "properties": {"type": {"const": "play_again"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

POISON_CONFIG_SCHEMA = {
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

BOHNANZA_DICE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {"type": {"const": "roll"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "save_dice"},
                "die_ids": {
                    "type": "array",
                    "items": {"type": "string", "pattern": r"^(?:dark-[12]|light-[123])$"},
                    "minItems": 1,
                    "maxItems": 5,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "die_ids"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "repeat_roll"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "harvest"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "keep_growing"}},
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

BOHNANZA_DICE_CONFIG_SCHEMA = {
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

EMERALD_SKULLS_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "buy_dice"},
                "count": {"type": "integer", "minimum": 3, "maximum": 7},
            },
            "required": ["type", "count"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_bet"},
                "bet_id": {
                    "type": "string",
                    "enum": [
                        "pick_bust",
                        "mad_nargash",
                        "grim_grin",
                        "emerald_skull",
                        "busted_fowl",
                        "final_jewel",
                        "empty_hands",
                        "empty_shiny",
                    ],
                },
            },
            "required": ["type", "bet_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "roll"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_dice"},
                "level": {"type": "integer", "minimum": 1, "maximum": 5},
                "die_ids": {
                    "type": "array",
                    "items": {"type": "string", "pattern": "^die-[1-7]$"},
                    "minItems": 1,
                    "maxItems": 7,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "level", "die_ids"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "spend_reroll_cube"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "pick_nose"},
                "die_id": {"type": "string", "pattern": "^die-[1-7]$"},
            },
            "required": ["type", "die_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"enum": ["continue_roll", "chicken_out", "accept_bust", "next_turn", "play_again"]}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_payout"},
                "option_id": {
                    "type": "string",
                    "enum": ["standard", "mad_nargash", "grim_grin", "emerald_skull"],
                },
            },
            "required": ["type", "option_id"],
            "additionalProperties": False,
        },
    ],
}

EMERALD_SKULLS_CONFIG_SCHEMA = {
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

WRIGGLE_ROULETTE_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "grab"},
                "count": {"type": "integer", "minimum": 0, "maximum": 6},
                "cycle_no": {"type": "integer", "minimum": 1},
            },
            "required": ["type", "count", "cycle_no"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "ready_reveal"},
                "cycle_no": {"type": "integer", "minimum": 1},
            },
            "required": ["type", "cycle_no"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "next_round"},
                "round_no": {"type": "integer", "minimum": 1},
            },
            "required": ["type", "round_no"],
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

WRIGGLE_ROULETTE_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

CATAN_STARFARERS_RESOURCE_BUNDLE_SCHEMA = {
    "type": "object",
    "properties": {
        resource: {"type": "integer", "minimum": 0, "maximum": 20}
        for resource in ("ore", "fuel", "carbon", "food", "goods")
    },
    "additionalProperties": False,
}

CATAN_STARFARERS_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {
                    "enum": [
                        "roll_production",
                        "cancel_trade_offer",
                        "start_flight",
                        "read_encounter_prompt",
                        "reveal_encounter_result",
                        "end_flight",
                        "next_turn",
                        "play_again",
                        "withdraw_trade_response",
                    ]
                }
            },
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "discard_resources"},
                "resources": CATAN_STARFARERS_RESOURCE_BUNDLE_SCHEMA,
            },
            "required": ["type", "resources"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_steal_target"},
                "target_player_id": {"type": "string", "minLength": 1, "maxLength": 80},
            },
            "required": ["type", "target_player_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "open_trade_offer"},
                "give": CATAN_STARFARERS_RESOURCE_BUNDLE_SCHEMA,
                "want": CATAN_STARFARERS_RESOURCE_BUNDLE_SCHEMA,
            },
            "required": ["type", "give", "want"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_trade_response"},
                "response": {"type": "string", "enum": ["accept", "counter"]},
                "give": CATAN_STARFARERS_RESOURCE_BUNDLE_SCHEMA,
                "want": CATAN_STARFARERS_RESOURCE_BUNDLE_SCHEMA,
            },
            "required": ["type", "response"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "accept_trade_response"},
                "response_player_id": {"type": "string", "minLength": 1, "maxLength": 80},
            },
            "required": ["type", "response_player_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "trade_with_supply"},
                "give_resource": {"type": "string", "enum": ["ore", "fuel", "carbon", "food", "goods"]},
                "receive_resource": {"type": "string", "enum": ["ore", "fuel", "carbon", "food", "goods"]},
            },
            "required": ["type", "give_resource", "receive_resource"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "build_ship"},
                "ship_type": {"type": "string", "enum": ["colony", "trade"]},
                "spaceport_id": {"type": "string", "minLength": 1, "maxLength": 160},
            },
            "required": ["type", "ship_type", "spaceport_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "build_spaceport"},
                "colony_id": {"type": "string", "minLength": 1, "maxLength": 160},
            },
            "required": ["type", "colony_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "build_upgrade"},
                "upgrade_type": {"type": "string", "enum": ["booster", "cannon", "freight"]},
            },
            "required": ["type", "upgrade_type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_encounter"},
                "choice": {"type": "string", "minLength": 1, "maxLength": 40},
            },
            "required": ["type", "choice"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "move_ship_step"},
                "ship_id": {"type": "string", "minLength": 1, "maxLength": 160},
                "node_id": {"type": "string", "minLength": 1, "maxLength": 80},
            },
            "required": ["type", "ship_id", "node_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"enum": ["finish_ship_move", "establish_colony", "establish_trade_station"]},
                "ship_id": {"type": "string", "minLength": 1, "maxLength": 160},
            },
            "required": ["type", "ship_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_friendship_card"},
                "card_id": {"type": "string", "minLength": 1, "maxLength": 80},
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
    ],
}

CATAN_STARFARERS_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "setup_mode": {
            "type": "string",
            "enum": ["beginner", "strategic", "explorer", "wild_space"],
        },
        "language": {"type": "string", "enum": ["en", "zh"]},
    },
    "additionalProperties": False,
}

BOMB_BUSTERS_WIRE_ID_SCHEMA = {
    "type": "string",
    "pattern": r"^w-[0-9a-f]{16}$",
    "maxLength": 18,
}

BOMB_BUSTERS_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_initial_info"},
                "wire_id": BOMB_BUSTERS_WIRE_ID_SCHEMA,
            },
            "required": ["type", "wire_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "dual_cut"},
                "own_wire_id": BOMB_BUSTERS_WIRE_ID_SCHEMA,
                "target_wire_id": BOMB_BUSTERS_WIRE_ID_SCHEMA,
            },
            "required": ["type", "own_wire_id", "target_wire_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "double_detector_cut"},
                "own_wire_id": BOMB_BUSTERS_WIRE_ID_SCHEMA,
                "target_wire_ids": {
                    "type": "array",
                    "items": BOMB_BUSTERS_WIRE_ID_SCHEMA,
                    "minItems": 2,
                    "maxItems": 2,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "own_wire_id", "target_wire_ids"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "resolve_detector_choice"},
                "wire_id": BOMB_BUSTERS_WIRE_ID_SCHEMA,
            },
            "required": ["type", "wire_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "solo_cut"},
                "wire_ids": {
                    "type": "array",
                    "items": BOMB_BUSTERS_WIRE_ID_SCHEMA,
                    "minItems": 2,
                    "maxItems": 4,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "wire_ids"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "reveal_red_wires"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "continue_mission"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

BOMB_BUSTERS_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "practice_preset": {
            "type": "string",
            "enum": ["short_practice", "standard_practice", "high_risk_practice"],
        }
    },
    "additionalProperties": False,
}

FELIX_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_card"},
                "card_id": {"type": "string", "minLength": 3, "maxLength": 40},
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "bid"},
                "amount": {"type": "integer", "minimum": 1, "maximum": 200},
            },
            "required": ["type", "amount"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "pass"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "buy_for_one"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
    ],
}

FELIX_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

TACTA_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_card"},
                "deck_end": {"type": "string", "enum": ["top", "bottom"]},
                "face": {"type": "string", "enum": ["front", "back"]},
                "source_connector_id": {"type": "string", "pattern": "^c[0-9]+$"},
                "target_card_id": {"type": "string", "minLength": 3, "maxLength": 80},
                "target_connector_id": {"type": "string", "pattern": "^c[0-9]+$"},
                "symmetry_index": {"type": "integer", "minimum": 0, "maximum": 23},
                "board_revision": {"type": "integer", "minimum": 0},
            },
            "required": [
                "type",
                "deck_end",
                "face",
                "source_connector_id",
                "target_card_id",
                "target_connector_id",
                "symmetry_index",
                "board_revision",
            ],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "place_isolated"},
                "deck_end": {"type": "string", "enum": ["top", "bottom"]},
                "face": {"type": "string", "enum": ["front", "back"]},
                "isolated_slot_id": {"type": "string", "pattern": "^iso_[0-9]+_[0-9]+$"},
                "board_revision": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "deck_end", "face", "isolated_slot_id", "board_revision"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_pass_suit"},
                "suit": {"type": "string", "enum": ["circle", "square", "triangle"]},
            },
            "required": ["type", "suit"],
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

TACTA_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "mode": {"type": "string", "enum": ["standard", "quick", "limited_space", "sabotage"]},
        "active_suits": {
            "type": "array",
            "items": {"type": "string", "enum": ["circle", "square", "triangle"]},
            "minItems": 1,
            "maxItems": 3,
            "uniqueItems": True,
        },
        "seed": {
            "oneOf": [
                {"type": "integer"},
                {"type": "string", "minLength": 1, "maxLength": 80},
            ]
        },
    },
    "additionalProperties": False,
}

SUBTEXT_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_drawing"},
                "drawing": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 100,
                    "items": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 300,
                        "items": {
                            "type": "array",
                            "minItems": 2,
                            "maxItems": 2,
                            "items": {"type": "number", "minimum": 0, "maximum": 1},
                        },
                    },
                },
            },
            "required": ["type", "drawing"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_guess"},
                "slot_id": {"type": "string", "pattern": "^[A-G]$"},
            },
            "required": ["type", "slot_id"],
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
            "properties": {"type": {"const": "play_again"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

SUBTEXT_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "word_column": {"type": "integer", "minimum": 1, "maximum": 5},
        "seed": {
            "oneOf": [
                {"type": "integer"},
                {"type": "string", "minLength": 1, "maxLength": 80},
            ]
        },
    },
    "additionalProperties": False,
}

REBEL_PRINCESS_ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {
            "type": "string",
            "enum": [
                "pass_cards",
                "setup_choice",
                "choose_card",
                "play_card",
                "use_princess",
                "skip",
                "next_round_ready",
            ],
        },
        "card_id": {"type": "string", "minLength": 3, "maxLength": 20},
        "card_ids": {
            "type": "array",
            "items": {"type": "string", "minLength": 3, "maxLength": 20},
            "maxItems": 12,
            "uniqueItems": True,
        },
        "suit": {"type": "string", "enum": ["queen", "fairy", "pet", "prince"]},
        "target_player_id": {"type": "string", "minLength": 1, "maxLength": 80},
        "hand_card_id": {"type": "string", "minLength": 3, "maxLength": 20},
        "trick_card_id": {"type": "string", "minLength": 3, "maxLength": 20},
        "give_card_id": {"type": "string", "minLength": 3, "maxLength": 20},
        "keep_card_id": {"type": "string", "minLength": 3, "maxLength": 20},
        "use_snow_white": {"type": "boolean"},
        "use_pea_princess": {"type": "boolean"},
    },
    "required": ["type"],
    "additionalProperties": False,
}

REBEL_PRINCESS_CONFIG_SCHEMA = {
    "type": "object",
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
            "properties": {"type": {"const": "draw_discard"}, "slot": {"type": "integer", "minimum": 0}},
            "required": ["type", "slot"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "replace_card"}, "slot": {"type": "integer", "minimum": 0}},
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
                    "items": {"type": "integer", "minimum": 0},
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
                    "minItems": 1,
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
    "properties": {
        "inspection_mode": {"type": "string", "enum": ["choose_one", "both"], "default": "choose_one"},
    },
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

TUCANO_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "draft_column"},
                "column": {"type": "integer", "minimum": 0, "maximum": 2},
            },
            "required": ["type", "column"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "resolve_toucan"},
                "fruit": {"type": "string", "minLength": 1, "maxLength": 40},
                "target_player": {"type": "string", "minLength": 1, "maxLength": 80},
            },
            "required": ["type"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "skip_toucan"}}, "required": ["type"], "additionalProperties": False},
    ],
}

TUCANO_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

WITCHS_BREW_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "select_roles"},
                "roles": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 1, "maxLength": 40},
                    "minItems": 5,
                    "maxItems": 5,
                },
            },
            "required": ["type", "roles"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "play_role"},
                "role": {"type": "string", "minLength": 1, "maxLength": 40},
            },
            "required": ["type", "role"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "respond"},
                "response": {"type": "string", "enum": ["claim_full", "take_favor"]},
            },
            "required": ["type", "response"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "resolve_action"},
                "skip": {"type": "boolean"},
                "pay_ingredient": {"type": "string", "enum": ["red", "green", "white"]},
                "gain_ingredients": {"type": "object", "additionalProperties": {"type": "integer", "minimum": 0}},
                "extra_ingredient": {"type": "string", "enum": ["red", "green", "white"]},
                "stack": {"type": "string", "enum": ["iron", "copper", "silver"]},
                "payment": {"type": "object", "additionalProperties": {"type": "integer", "minimum": 0}},
                "augment_gold": {"type": "integer", "minimum": 0},
                "augment_ingredients": {"type": "object", "additionalProperties": {"type": "integer", "minimum": 0}},
            },
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_loss"},
                "loss": {"type": "object", "additionalProperties": {"type": "integer", "minimum": 0}},
            },
            "required": ["type", "loss"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_round"}}, "required": ["type"], "additionalProperties": False},
    ],
}

WITCHS_BREW_CONFIG_SCHEMA = {
    "type": "object",
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

NINE_UPPER_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "select_difficulty"},
                "difficulty": {"type": "integer", "minimum": 1, "maximum": 3},
            },
            "required": ["type", "difficulty"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_statement"},
                "statement": {"type": "string", "minLength": 1, "maxLength": 280},
            },
            "required": ["type", "statement"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "skip_term"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "choose_honest"},
                "player_id": {"type": "string", "minLength": 1},
            },
            "required": ["type", "player_id"],
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
            "properties": {"type": {"const": "play_again"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

NINE_UPPER_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "rounds_per_thinker": {"type": "integer", "minimum": 1, "maximum": 2},
        "seed": {
            "oneOf": [
                {"type": "integer"},
                {"type": "string", "minLength": 1, "maxLength": 80},
            ]
        },
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
        {
            "type": "object",
            "properties": {"type": {"const": "ready_next_round"}},
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
        "language": {"type": "string", "enum": ["en", "zh"]},
        "opening_mulligan_if_no_tree": {"type": "boolean"},
        "seed": {"type": ["integer", "string"]},
    },
    "additionalProperties": False,
}

ARK_NOVA_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "keep_initial_cards"},
                "card_ids": {
                    "type": "array",
                    "items": {"type": "string", "pattern": "^[1-5][0-9]{2}$"},
                    "minItems": 4,
                    "maxItems": 4,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "card_ids"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "cards"},
                "choose_effect_order": {"type": "boolean"},
                "choose_card_sources": {"type": "boolean"},
                "mode": {"type": "string", "enum": ["draw", "snap"]},
                "x_tokens": {"type": "integer", "minimum": 0, "maximum": 5},
                "use_multiplier_tokens": {"type": "integer", "minimum": 0, "maximum": 8},
                "display_card_id": {"type": "string", "pattern": "^[1-5][0-9]{2}$"},
                "market_card_ids": {
                    "type": "array",
                    "items": {"type": "string", "pattern": "^[1-5][0-9]{2}$"},
                    "maxItems": 4,
                    "uniqueItems": True,
                },
                "discard_ids": {
                    "type": "array",
                    "items": {"type": "string", "pattern": "^[1-5][0-9]{2}$"},
                    "maxItems": 4,
                    "uniqueItems": True,
                },
            },
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "build"},
                "choose_effect_order": {"type": "boolean"},
                "x_tokens": {"type": "integer", "minimum": 0, "maximum": 5},
                "use_multiplier_tokens": {"type": "integer", "minimum": 0, "maximum": 8},
                "buildings": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 5,
                    "items": {
                        "type": "object",
                        "properties": {
                            "building_type": {"type": "string", "minLength": 1, "maxLength": 80},
                            "building_id": {"type": "string", "minLength": 1, "maxLength": 80},
                            "size": {"type": "integer", "minimum": 1, "maximum": 5},
                            "cells": {
                                "type": "array",
                                "items": {"type": "string", "pattern": "^[A-I][1-7]$"},
                                "minItems": 1,
                                "maxItems": 5,
                                "uniqueItems": True,
                            },
                        },
                        "required": ["building_type", "cells"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["type", "buildings"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "animals"},
                "continue_action": {"type": "boolean"},
                "choose_effect_order": {"type": "boolean"},
                "x_tokens": {"type": "integer", "minimum": 0, "maximum": 5},
                "use_multiplier_tokens": {"type": "integer", "minimum": 0, "maximum": 8},
                "gain_reputation": {"type": "boolean"},
                "plays": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 2,
                    "items": {
                        "type": "object",
                        "properties": {
                            "card_id": {
                                "type": "string",
                                "pattern": "^(?:4[0-9]{2}|5(?:[01][0-9]|2[0-8]))$",
                            },
                            "enclosure_id": {"type": "string", "minLength": 1, "maxLength": 80},
                            "source": {"type": "string", "enum": ["hand", "display"]},
                        },
                        "required": ["card_id", "enclosure_id"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["type", "plays"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "association"},
                "choose_effect_order": {"type": "boolean"},
                "x_tokens": {"type": "integer", "minimum": 0, "maximum": 5},
                "use_multiplier_tokens": {"type": "integer", "minimum": 0, "maximum": 8},
                "tasks": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 4,
                    "items": {
                        "type": "object",
                        "properties": {
                            "task": {
                                "type": "string",
                                "enum": [
                                    "reputation",
                                    "gain_2_reputation",
                                    "partner_zoo",
                                    "take_partner_zoo",
                                    "university",
                                    "take_university",
                                    "support_project",
                                    "support_conservation_project",
                                ],
                            },
                            "continent": {"type": "string", "enum": ["africa", "americas", "asia", "australia", "europe"]},
                            "university_id": {"type": "string", "minLength": 1, "maxLength": 80},
                            "project_id": {"type": "string", "pattern": "^1[0-3][0-9]$"},
                            "project_card_id": {"type": "string", "pattern": "^1[0-3][0-9]$"},
                            "slot": {"type": "integer", "minimum": 1, "maximum": 3},
                            "slot_position": {"type": "integer", "minimum": 1, "maximum": 3},
                            "release_animal_id": {
                                "type": "string",
                                "pattern": "^(?:4[0-9]{2}|5(?:[01][0-9]|2[0-8]))$",
                            },
                            "animal_id": {
                                "type": "string",
                                "pattern": "^(?:4[0-9]{2}|5(?:[01][0-9]|2[0-8]))$",
                            },
                            "wild_token_card_id": {"type": "string", "enum": ["215", "218"]},
                            "wild_token_card_ids": {
                                "type": "array", "maxItems": 2, "uniqueItems": True,
                                "items": {"type": "string", "enum": ["215", "218"]},
                            },
                            "reward_id": {"type": "string", "minLength": 1, "maxLength": 80},
                        },
                        "required": ["task"],
                        "additionalProperties": False,
                    },
                },
                "donate": {"oneOf": [{"type": "boolean"}, {"type": "integer", "minimum": 2, "maximum": 12}]},
            },
            "required": ["type", "tasks"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "sponsors"},
                "continue_action": {"type": "boolean"},
                "choose_effect_order": {"type": "boolean"},
                "mode": {"type": "string", "enum": ["play", "break"]},
                "x_tokens": {"type": "integer", "minimum": 0, "maximum": 5},
                "use_multiplier_tokens": {"type": "integer", "minimum": 0, "maximum": 8},
                "card_ids": {
                    "type": "array",
                    "items": {"type": "string", "pattern": "^2[0-6][0-9]$"},
                    "maxItems": 6,
                    "uniqueItems": True,
                },
                "unique_building_placements": {"type": "object"},
            },
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "gain_x"},
                "action_card": {"type": "string", "enum": ["cards", "build", "animals", "association", "sponsors"]},
                "use_multiplier_tokens": {"type": "integer", "minimum": 0, "maximum": 8},
            },
            "required": ["type", "action_card"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "skip_extra_action"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "resolve_choice"},
                "choice_id": {"type": "string", "minLength": 1, "maxLength": 160},
                "selection": {},
            },
            "required": ["type", "choice_id", "selection"],
            "additionalProperties": False,
        },
    ],
}

ARK_NOVA_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
        "map_id": {"const": "map0"},
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
            "properties": {"type": {"const": "next_round"}},
            "required": ["type"],
            "additionalProperties": False,
        },
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

CENTURY_SPICE_ROAD_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "play"},
                "card_id": {"type": "string"},
                "upgrades": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["yellow", "red", "green"]},
                    "maxItems": 3,
                },
                "times": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "acquire"},
                "index": {"type": "integer", "minimum": 0, "maximum": 5},
                "payments": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["yellow", "red", "green", "brown"]},
                    "maxItems": 5,
                },
            },
            "required": ["type", "index", "payments"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "rest"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "claim"},
                "index": {"type": "integer", "minimum": 0, "maximum": 4},
            },
            "required": ["type", "index"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "discard"},
                "spices": {
                    "type": "object",
                    "properties": {
                        "yellow": {"type": "integer", "minimum": 0},
                        "red": {"type": "integer", "minimum": 0},
                        "green": {"type": "integer", "minimum": 0},
                        "brown": {"type": "integer", "minimum": 0},
                    },
                    "additionalProperties": False,
                },
            },
            "required": ["type", "spices"],
            "additionalProperties": False,
        },
    ],
}

CENTURY_SPICE_ROAD_CONFIG_SCHEMA = {
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

CELESTIA_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {"type": {"const": "roll_dice"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "solo_leave"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "passenger_choice"},
                "choice": {"type": "string", "enum": ["stay", "leave"]},
            },
            "required": ["type", "choice"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "play_power"},
                "card_id": {"type": "string"},
                "target_player_id": {"type": "string"},
                "dice_indexes": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0, "maximum": 3},
                    "maxItems": 4,
                },
            },
            "required": ["type", "card_id"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "pass_special"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "captain_resolve"},
                "method": {"type": "string", "enum": ["cards", "telescope"]},
                "treasure_id": {"type": "string"},
            },
            "required": ["type", "method"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "captain_fail"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "type": {"const": "jetpack_decision"},
                "use": {"type": "boolean"},
            },
            "required": ["type", "use"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "next_journey"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "play_again"}}, "required": ["type"], "additionalProperties": False},
    ],
}

CELESTIA_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "target_score": {"type": "integer", "minimum": 1},
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

HOT_STREAK_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "draft_ticket"},
                "stack_id": {
                    "type": "string",
                    "enum": ["blaze", "dash", "ripple", "comet", "yes", "no"],
                },
                "mode": {"type": "string", "enum": ["safe", "risky"]},
                "double_bet_id": {"type": ["string", "null"], "minLength": 1, "maxLength": 160},
            },
            "required": ["type", "stack_id", "mode"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "submit_race_cards"},
                "card_ids": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 3, "maxLength": 100},
                    "minItems": 1,
                    "maxItems": 2,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "card_ids"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "advance_race"},
                "expected_step_index": {"type": "integer", "minimum": 0},
            },
            "required": ["type", "expected_step_index"],
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
            "properties": {"type": {"const": "play_again"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

HOT_STREAK_CONFIG_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
}

KRONOLOGIC_CHARACTER_IDS = ["archivist", "conductor", "engineer", "patron", "singer", "courier"]
KRONOLOGIC_LOCATION_IDS = ["grand_hall", "archive", "rehearsal", "backstage", "dressing_room", "orchestra_pit"]
KRONOLOGIC_CASE_IDS = [
    "sealed-score-01",
    "sealed-score-02",
    "sealed-score-03",
    "sealed-score-04",
    "sealed-score-05",
]
KRONOLOGIC_ANSWER_PROPERTIES = {
    "type": {"type": "string"},
    "character_id": {"type": "string", "enum": KRONOLOGIC_CHARACTER_IDS},
    "location_id": {"type": "string", "enum": KRONOLOGIC_LOCATION_IDS},
    "time": {"type": "integer", "minimum": 1, "maximum": 6},
}

KRONOLOGIC_ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "ask"},
                "query_type": {"const": "time"},
                "location_id": {"type": "string", "enum": KRONOLOGIC_LOCATION_IDS},
                "time": {"type": "integer", "minimum": 1, "maximum": 6},
            },
            "required": ["type", "query_type", "location_id", "time"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "ask"},
                "query_type": {"const": "character"},
                "location_id": {"type": "string", "enum": KRONOLOGIC_LOCATION_IDS},
                "character_id": {"type": "string", "enum": KRONOLOGIC_CHARACTER_IDS},
            },
            "required": ["type", "query_type", "location_id", "character_id"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {**KRONOLOGIC_ANSWER_PROPERTIES, "type": {"const": "start_accusation"}},
            "required": ["type", "character_id", "location_id", "time"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {**KRONOLOGIC_ANSWER_PROPERTIES, "type": {"const": "join_accusation"}},
            "required": ["type", "character_id", "location_id", "time"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "decline_accusation"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "ready_next_turn"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "set_note_mark"},
                "time": {"type": "integer", "minimum": 1, "maximum": 6},
                "location_id": {"type": "string", "enum": KRONOLOGIC_LOCATION_IDS},
                "character_id": {"type": "string", "enum": KRONOLOGIC_CHARACTER_IDS},
                "mark": {"type": "string", "enum": ["unknown", "possible", "excluded", "confirmed"]},
            },
            "required": ["type", "time", "location_id", "character_id", "mark"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "set_note_count"},
                "query_type": {"const": "time"},
                "location_id": {"type": "string", "enum": KRONOLOGIC_LOCATION_IDS},
                "time": {"type": "integer", "minimum": 1, "maximum": 6},
                "count": {"type": ["integer", "null"], "minimum": 0, "maximum": 6},
            },
            "required": ["type", "query_type", "location_id", "time", "count"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "set_note_count"},
                "query_type": {"const": "character"},
                "location_id": {"type": "string", "enum": KRONOLOGIC_LOCATION_IDS},
                "character_id": {"type": "string", "enum": KRONOLOGIC_CHARACTER_IDS},
                "count": {"type": ["integer", "null"], "minimum": 0, "maximum": 6},
            },
            "required": ["type", "query_type", "location_id", "character_id", "count"],
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

KRONOLOGIC_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "language": {"type": "string", "enum": ["zh", "en"]},
        "case_source": {"type": "string", "enum": ["random", "preset"]},
        "difficulty": {"type": "string", "enum": ["any", "1", "2", "3"]},
        "case_id": {"type": "string", "enum": KRONOLOGIC_CASE_IDS},
        "seed": {
            "oneOf": [
                {"type": "integer"},
                {"type": "string", "maxLength": 80},
            ]
        },
    },
    "additionalProperties": False,
}

register_game(
    GameDefinition(
        game_id=CaboGame.game_id,
        name="Cabo",
        name_zh="卡波",
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
        name_zh="掼蛋",
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
        name_zh="德州扑克",
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
        name_zh="猜狐狸",
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
        name_zh="竹林之中",
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
        name_zh="逻辑对决",
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
        name_zh="图灵机",
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
        name_zh="达芬奇密码",
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
        name_zh="谁是牛头王",
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
        name_zh="巧妙装置",
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
        name_zh="璀璨宝石",
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
        name_zh="璀璨宝石：宝可梦",
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
        name_zh="得分沙拉",
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
        name_zh="出包魔法师",
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
        name_zh="骷髅牌",
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
        name_zh="盒中猫",
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
        name_zh="你画我猜",
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
        name_zh="极速画猜",
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
        name_zh="伪装艺术",
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
        name_zh="环中物语",
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
        name_zh="赛博猜图",
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
        name_zh="截码战",
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
        name_zh="猜字解底",
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
        name_zh="印象花语",
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
        name_zh="角斗士棋",
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
        name_zh="L计划",
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
        name_zh="AI 画物语",
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
        name_zh="翻转七",
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
        name_zh="快艇骰子",
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
        name_zh="伊斯坦堡",
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
        name_zh="淘金热",
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
        name_zh="印加宝藏",
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
        game_id=CelestiaGame.game_id,
        name="Celestia",
        name_zh="空中之城",
        min_players=CelestiaGame.min_players,
        max_players=CelestiaGame.max_players,
        turn_mode="turn",
        action_schema=CELESTIA_ACTION_SCHEMA,
        config_schema=CELESTIA_CONFIG_SCHEMA,
        module=CelestiaGame,
        serialize=CelestiaGame.serialize,
        deserialize=CelestiaGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=AgeOfWarGame.game_id,
        name="Age of War",
        name_zh="战国时代",
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
        name_zh="小早川",
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
        game_id=TucanoGame.game_id,
        name="Tucano",
        name_zh="巨嘴鸟",
        min_players=TucanoGame.min_players,
        max_players=TucanoGame.max_players,
        turn_mode="turn",
        action_schema=TUCANO_ACTION_SCHEMA,
        config_schema=TUCANO_CONFIG_SCHEMA,
        module=TucanoGame,
        serialize=TucanoGame.serialize,
        deserialize=TucanoGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=WitchsBrewGame.game_id,
        name="Witch's Brew",
        name_zh="女巫的佳酿",
        min_players=WitchsBrewGame.min_players,
        max_players=WitchsBrewGame.max_players,
        turn_mode="turn",
        action_schema=WITCHS_BREW_ACTION_SCHEMA,
        config_schema=WITCHS_BREW_CONFIG_SCHEMA,
        module=WitchsBrewGame,
        serialize=WitchsBrewGame.serialize,
        deserialize=WitchsBrewGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=RaGame.game_id,
        name="Ra",
        name_zh="太阳神",
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
        game_id=RebelPrincessGame.game_id,
        name="Rebel Princess",
        name_zh="叛逆公主",
        min_players=RebelPrincessGame.min_players,
        max_players=RebelPrincessGame.max_players,
        turn_mode="turn",
        action_schema=REBEL_PRINCESS_ACTION_SCHEMA,
        config_schema=REBEL_PRINCESS_CONFIG_SCHEMA,
        module=RebelPrincessGame,
        serialize=RebelPrincessGame.serialize,
        deserialize=RebelPrincessGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=ScoutGame.game_id,
        name="Scout",
        name_zh="马戏星探",
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
        name_zh="德国心脏病",
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
        name_zh="绝妙误解",
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
        name_zh="花火",
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
        name_zh="纸牌帮",
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
        name_zh="方鸟",
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
        name_zh="卡卡颂",
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
        name_zh="花砖物语",
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
        name_zh="历史奇旅",
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
        name_zh="巫师飞塔",
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
        name_zh="拼布艺术",
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
        name_zh="斯凯岛",
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
        name_zh="森森不息",
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
        game_id=ArkNovaGame.game_id,
        name="Ark Nova",
        name_zh="方舟动物园",
        min_players=ArkNovaGame.min_players,
        max_players=ArkNovaGame.max_players,
        turn_mode="turn",
        action_schema=ARK_NOVA_ACTION_SCHEMA,
        config_schema=ARK_NOVA_CONFIG_SCHEMA,
        module=ArkNovaGame,
        serialize=ArkNovaGame.serialize,
        deserialize=ArkNovaGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=ManilaGame.game_id,
        name="Manila",
        name_zh="马尼拉",
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
        name_zh="富饶之城",
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
        game_id=CenturySpiceRoadGame.game_id,
        name="Century: Spice Road",
        name_zh="香料之路",
        min_players=CenturySpiceRoadGame.min_players,
        max_players=CenturySpiceRoadGame.max_players,
        turn_mode="turn",
        action_schema=CENTURY_SPICE_ROAD_ACTION_SCHEMA,
        config_schema=CENTURY_SPICE_ROAD_CONFIG_SCHEMA,
        module=CenturySpiceRoadGame,
        serialize=CenturySpiceRoadGame.serialize,
        deserialize=CenturySpiceRoadGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=LostCodeGame.game_id,
        name="The Lost Code",
        name_zh="迷失代码",
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
        name_zh="犯人在跳舞",
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
        name_zh="电波同步",
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
        name_zh="并购",
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
        name_zh="问非所答",
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

register_game(
    GameDefinition(
        game_id=NineUpperGame.game_id,
        name="9UPPER",
        name_zh="瞎掰王",
        min_players=NineUpperGame.min_players,
        max_players=NineUpperGame.max_players,
        turn_mode="simultaneous",
        action_schema=NINE_UPPER_ACTION_SCHEMA,
        config_schema=NINE_UPPER_CONFIG_SCHEMA,
        module=NineUpperGame,
        serialize=NineUpperGame.serialize,
        deserialize=NineUpperGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=HighSocietyGame.game_id,
        name="High Society",
        name_zh="上流社会",
        min_players=HighSocietyGame.min_players,
        max_players=HighSocietyGame.max_players,
        turn_mode="turn",
        action_schema=HIGH_SOCIETY_ACTION_SCHEMA,
        config_schema=HIGH_SOCIETY_CONFIG_SCHEMA,
        module=HighSocietyGame,
        serialize=HighSocietyGame.serialize,
        deserialize=HighSocietyGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=FelixGame.game_id,
        name="Felix: The Cat in the Sack",
        name_zh="袋中菲力猫",
        min_players=FelixGame.min_players,
        max_players=FelixGame.max_players,
        turn_mode="turn",
        action_schema=FELIX_ACTION_SCHEMA,
        config_schema=FELIX_CONFIG_SCHEMA,
        module=FelixGame,
        serialize=FelixGame.serialize,
        deserialize=FelixGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=TactaGame.game_id,
        name="TACTA",
        name_zh="塔克塔",
        min_players=TactaGame.min_players,
        max_players=TactaGame.max_players,
        turn_mode="turn",
        action_schema=TACTA_ACTION_SCHEMA,
        config_schema=TACTA_CONFIG_SCHEMA,
        module=TactaGame,
        serialize=TactaGame.serialize,
        deserialize=TactaGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=SubtextGame.game_id,
        name="Subtext",
        name_zh="画外之意",
        min_players=SubtextGame.min_players,
        max_players=SubtextGame.max_players,
        turn_mode="simultaneous",
        action_schema=SUBTEXT_ACTION_SCHEMA,
        config_schema=SUBTEXT_CONFIG_SCHEMA,
        module=SubtextGame,
        serialize=SubtextGame.serialize,
        deserialize=SubtextGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=HotStreakGame.game_id,
        name="Hot Streak",
        name_zh="火热连胜",
        min_players=HotStreakGame.min_players,
        max_players=HotStreakGame.max_players,
        turn_mode="turn",
        action_schema=HOT_STREAK_ACTION_SCHEMA,
        config_schema=HOT_STREAK_CONFIG_SCHEMA,
        module=HotStreakGame,
        serialize=HotStreakGame.serialize,
        deserialize=HotStreakGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=PoisonGame.game_id,
        name="Poison",
        name_zh="毒药",
        min_players=PoisonGame.min_players,
        max_players=PoisonGame.max_players,
        turn_mode="turn",
        action_schema=POISON_ACTION_SCHEMA,
        config_schema=POISON_CONFIG_SCHEMA,
        module=PoisonGame,
        serialize=PoisonGame.serialize,
        deserialize=PoisonGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=BohnanzaDiceGame.game_id,
        name="Bohnanza: Das Würfelspiel",
        name_zh="种豆：骰子游戏",
        min_players=BohnanzaDiceGame.min_players,
        max_players=BohnanzaDiceGame.max_players,
        turn_mode="turn",
        action_schema=BOHNANZA_DICE_ACTION_SCHEMA,
        config_schema=BOHNANZA_DICE_CONFIG_SCHEMA,
        module=BohnanzaDiceGame,
        serialize=BohnanzaDiceGame.serialize,
        deserialize=BohnanzaDiceGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=EmeraldSkullsGame.game_id,
        name="Emerald Skulls",
        name_zh="翡翠骰骨",
        min_players=EmeraldSkullsGame.min_players,
        max_players=EmeraldSkullsGame.max_players,
        turn_mode="turn",
        action_schema=EMERALD_SKULLS_ACTION_SCHEMA,
        config_schema=EMERALD_SKULLS_CONFIG_SCHEMA,
        module=EmeraldSkullsGame,
        serialize=EmeraldSkullsGame.serialize,
        deserialize=EmeraldSkullsGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=WriggleRouletteGame.game_id,
        name="Wriggle Roulette",
        name_zh="鳗载而归",
        min_players=WriggleRouletteGame.min_players,
        max_players=WriggleRouletteGame.max_players,
        turn_mode="turn",
        action_schema=WRIGGLE_ROULETTE_ACTION_SCHEMA,
        config_schema=WRIGGLE_ROULETTE_CONFIG_SCHEMA,
        module=WriggleRouletteGame,
        serialize=WriggleRouletteGame.serialize,
        deserialize=WriggleRouletteGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=CatanStarfarersGame.game_id,
        name="CATAN: Starfarers",
        name_zh="星际卡坦",
        min_players=CatanStarfarersGame.min_players,
        max_players=CatanStarfarersGame.max_players,
        turn_mode="turn",
        action_schema=CATAN_STARFARERS_ACTION_SCHEMA,
        config_schema=CATAN_STARFARERS_CONFIG_SCHEMA,
        module=CatanStarfarersGame,
        serialize=CatanStarfarersGame.serialize,
        deserialize=CatanStarfarersGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=BombBustersGame.game_id,
        name="Bomb Busters",
        name_zh="炸弹克星",
        min_players=BombBustersGame.min_players,
        max_players=BombBustersGame.max_players,
        turn_mode="turn",
        action_schema=BOMB_BUSTERS_ACTION_SCHEMA,
        config_schema=BOMB_BUSTERS_CONFIG_SCHEMA,
        module=BombBustersGame,
        serialize=BombBustersGame.serialize,
        deserialize=BombBustersGame.deserialize,
    )
)

register_game(
    GameDefinition(
        game_id=KronologicGame.game_id,
        name="Kronologic: Paris 1920",
        name_zh="时空神探：巴黎 1920",
        min_players=KronologicGame.min_players,
        max_players=KronologicGame.max_players,
        turn_mode="turn",
        action_schema=KRONOLOGIC_ACTION_SCHEMA,
        config_schema=KRONOLOGIC_CONFIG_SCHEMA,
        module=KronologicGame,
        serialize=KronologicGame.serialize,
        deserialize=KronologicGame.deserialize,
    )
)
