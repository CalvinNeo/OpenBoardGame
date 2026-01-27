from dataclasses import dataclass
from typing import Callable, Dict, List, Optional


SerializeFn = Callable[[Dict], Dict]


@dataclass(frozen=True)
class GameDefinition:
    game_id: str
    name: str
    min_players: int
    max_players: int
    turn_mode: str
    action_schema: Dict
    config_schema: Dict
    module: object
    serialize: SerializeFn
    deserialize: SerializeFn


_REGISTRY: Dict[str, GameDefinition] = {}


def register_game(definition: GameDefinition) -> None:
    if definition.game_id in _REGISTRY:
        raise ValueError(f"game already registered: {definition.game_id}")
    _REGISTRY[definition.game_id] = definition


def get_game(game_id: str) -> Optional[GameDefinition]:
    return _REGISTRY.get(game_id)


def list_games() -> List[GameDefinition]:
    return sorted(_REGISTRY.values(), key=lambda item: item.game_id)
