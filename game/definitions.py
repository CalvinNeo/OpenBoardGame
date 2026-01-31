from game.abraca_what import AbracaWhatGame
from game.cabo import CaboGame
from game.coyote import CoyoteGame
from game.decrypto import DecryptoGame
from game.draw_guess import DrawGuessGame
from game.registry import GameDefinition, register_game
from game.splendor import SplendorGame
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
