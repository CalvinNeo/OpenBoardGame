from game.cabo import CaboGame
from game.draw_guess import DrawGuessGame
from game.registry import GameDefinition, register_game
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
