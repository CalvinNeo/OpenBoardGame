from game.abraca_what import AbracaWhatGame
from game.ai_dixit import AiDixitGame
from game.cabo import CaboGame
from game.coyote import CoyoteGame
from game.decrypto import DecryptoGame
from game.draw_guess import DrawGuessGame
from game.flip7 import Flip7Game
from game.halli_galli import HalliGalliGame
from game.impression_flower import ImpressionFlowerGame
from game.perfect_mismatch import PerfectMismatchGame
from game.registry import GameDefinition, register_game
from game.splendor import SplendorGame
from game.blokus import BlokusGame
from game.skull import SkullGame

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
        {"type": "object", "properties": {"type": {"const": "play_again"}}, "required": ["type"], "additionalProperties": False},
    ],
}

FLIP7_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "target_score": {"type": "integer", "minimum": 1},
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

BLOKUS_ACTION_SCHEMA = {
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
    ],
}

PERFECT_MISMATCH_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "slider_count": {"type": "integer", "minimum": 1, "maximum": 5},
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
        name="Flip 7",
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
