import asyncio
import json
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import socketio
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from game import GameDefinition, get_game, list_games
from game.decrypto import get_decrypto_word_packs
from game.decrypto_ai import get_bot_strategies

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
fastapi_app = FastAPI()
fastapi_app.mount("/static", StaticFiles(directory="static"), name="static")


@fastapi_app.get("/")
async def index():
    return FileResponse("static/index.html")


@fastapi_app.get("/api/decrypto/word_packs")
async def decrypto_word_packs():
    return {"packs": get_decrypto_word_packs()}


@fastapi_app.get("/api/decrypto/bot_strategies")
async def decrypto_bot_strategies():
    return {"strategies": get_bot_strategies()}


app = socketio.ASGIApp(sio, fastapi_app)


@dataclass
class Player:
    player_id: str
    name: str
    seat: int
    socket_id: Optional[str]
    ready: bool = False
    connected: bool = True
    is_bot: bool = False
    reconnect_token: str = ""
    last_seen: float = 0.0


@dataclass
class Room:
    room_id: str
    game_type: str = "cabo"
    status: str = "lobby"
    players: List[Player] = field(default_factory=list)
    state_version: int = 0
    game_state: Optional[Dict] = None
    bot_running: bool = False
    auto_save: bool = False
    source_room_id: Optional[str] = None


ROOMS: Dict[str, Room] = {}
SESSIONS: Dict[str, Dict] = {}
DATA_DIR = ".data"


def _generate_room_id() -> str:
    while True:
        rid = uuid.uuid4().hex[:6]
        if rid not in ROOMS:
            return rid


def _generate_reconnect_token() -> str:
    return uuid.uuid4().hex


def _get_room(room_id: str) -> Optional[Room]:
    return ROOMS.get(room_id)


def _get_game_definition(game_type: str) -> Optional[GameDefinition]:
    return get_game(game_type)


def _find_player(room: Room, player_id: str) -> Optional[Player]:
    for player in room.players:
        if player.player_id == player_id:
            return player
    return None


def _get_save_dir(room_id: str) -> str:
    return os.path.join(DATA_DIR, room_id)


def _save_room_state(room: Room) -> None:
    if not room.auto_save or not room.game_state:
        return
    room_dir = _get_save_dir(room.room_id)
    try:
        os.makedirs(room_dir, exist_ok=True)
        payload = {
            "room_id": room.room_id,
            "game_type": room.game_type,
            "room_status": room.status,
            "state_version": room.state_version,
            "saved_at": int(time.time()),
            "players": [
                {
                    "player_id": p.player_id,
                    "name": p.name,
                    "seat": p.seat,
                    "is_bot": p.is_bot,
                    "ready": p.ready,
                    "reconnect_token": p.reconnect_token,
                }
                for p in room.players
            ],
            "game_state": room.game_state,
        }
        tmp_path = os.path.join(room_dir, f".{room.state_version}.tmp")
        final_path = os.path.join(room_dir, f"{room.state_version}.save")
        with open(tmp_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=True)
        os.replace(tmp_path, final_path)
    except (OSError, TypeError, ValueError) as exc:
        print(f"auto-save failed for room {room.room_id}: {exc}")


def _get_latest_save_path(room_id: str) -> Optional[str]:
    room_dir = _get_save_dir(room_id)
    if not os.path.isdir(room_dir):
        return None
    latest_version = None
    latest_path = None
    for entry in os.scandir(room_dir):
        if not entry.is_file():
            continue
        if not entry.name.endswith(".save"):
            continue
        stem = entry.name[:-5]
        if not stem.isdigit():
            continue
        version = int(stem)
        if latest_version is None or version > latest_version:
            latest_version = version
            latest_path = entry.path
    return latest_path


def _load_latest_save(room_id: str) -> Optional[Dict]:
    latest_path = _get_latest_save_path(room_id)
    if not latest_path:
        return None
    try:
        with open(latest_path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def _list_load_summaries() -> List[Dict]:
    if not os.path.isdir(DATA_DIR):
        return []
    summaries = []
    for entry in os.scandir(DATA_DIR):
        if not entry.is_dir():
            continue
        payload = _load_latest_save(entry.name)
        if not payload:
            continue
        players = payload.get("players")
        summary_players = []
        if isinstance(players, list):
            for player in players:
                if not isinstance(player, dict):
                    continue
                summary_players.append(
                    {"name": player.get("name", "?"), "is_bot": bool(player.get("is_bot"))}
                )
        summaries.append(
            {
                "source_room_id": payload.get("room_id", entry.name),
                "game_type": payload.get("game_type"),
                "players": summary_players,
                "saved_at": payload.get("saved_at"),
                "state_version": payload.get("state_version"),
            }
        )
    return summaries


def _seat_list_payload(room: Room) -> List[Dict]:
    ordered_players = sorted(room.players, key=lambda p: p.seat)
    return [
        {
            "seat": p.seat,
            "name": p.name,
            "is_bot": p.is_bot,
            "connected": p.connected,
        }
        for p in ordered_players
    ]


async def _emit_room_state(room: Room) -> None:
    payload = {
        "room_id": room.room_id,
        "status": room.status,
        "game_type": room.game_type,
        "auto_save": room.auto_save,
        "source_room_id": room.source_room_id,
        "players": [
            {
                "player_id": p.player_id,
                "name": p.name,
                "seat": p.seat,
                "ready": p.ready,
                "connected": p.connected,
                "is_bot": p.is_bot,
            }
            for p in room.players
        ],
    }
    await sio.emit("room:state", payload, to=room.room_id)


def _room_list_payload() -> List[Dict]:
    rooms = []
    for room in ROOMS.values():
        game_def = _get_game_definition(room.game_type)
        max_players = game_def.max_players if game_def else len(room.players)
        rooms.append(
            {
                "room_id": room.room_id,
                "game_type": room.game_type,
                "status": room.status,
                "source_room_id": room.source_room_id,
                "player_count": len(room.players),
                "max_players": max_players,
                "players": [
                    {"name": p.name, "connected": p.connected, "is_bot": p.is_bot} for p in room.players
                ],
            }
        )
    rooms.sort(key=lambda r: r["room_id"])
    return rooms


def _room_blocking_players(room: Room) -> List[Dict]:
    return [{"name": p.name, "connected": p.connected} for p in room.players if not p.is_bot and p.connected]


async def _emit_room_list_update() -> None:
    await sio.emit("room:list_update", {"rooms": _room_list_payload()})


async def _emit_game_state(room: Room, events: Optional[List[Dict]] = None) -> None:
    if not room.game_state:
        return
    game_def = _get_game_definition(room.game_type)
    if not game_def:
        return
    game_module = game_def.module
    for player in room.players:
        if player.socket_id is None:
            continue
        view = game_module.get_public_view(room.game_state, player.player_id)
        payload = {
            "room_id": room.room_id,
            "state_version": room.state_version,
            "room_status": room.status,
            "game_type": room.game_type,
            "view": view,
            "events": events or [],
        }
        await sio.emit("game:state", payload, to=player.socket_id)


async def _send_error(sid: str, message: str) -> None:
    await sio.emit("system:error", {"message": message}, to=sid)


async def _leave_session(sid: str) -> None:
    session = SESSIONS.pop(sid, None)
    if not session:
        return
    room = _get_room(session.get("room_id"))
    if not room:
        return
    player = _find_player(room, session.get("player_id"))
    if not player:
        return
    await sio.leave_room(sid, room.room_id)
    if room.status == "lobby":
        room.players = [p for p in room.players if p.player_id != player.player_id]
        if not room.players:
            ROOMS.pop(room.room_id, None)
            await _emit_room_list_update()
            return
    else:
        player.connected = False
        player.socket_id = None
        player.last_seen = time.time()
    await _emit_room_state(room)
    await _emit_game_state(room)
    await _emit_room_list_update()


async def _maybe_run_bots(room: Room) -> None:
    if room.bot_running or room.status != "in_game" or not room.game_state:
        return
    game_def = _get_game_definition(room.game_type)
    if not game_def:
        return
    game_module = game_def.module

    async def _runner():
        room.bot_running = True
        try:
            while room.status == "in_game":
                state = room.game_state
                if state.get("game_over"):
                    break
                bot_action = None
                bot_player = None
                for candidate in room.players:
                    if not candidate.is_bot:
                        continue
                    action = game_module.bot_move(state, candidate.player_id)
                    if action:
                        bot_action = action
                        bot_player = candidate
                        break
                if not bot_action or not bot_player:
                    break
                events, error = game_module.apply_action(state, bot_player.player_id, bot_action)
                if error:
                    break
                bot_event = {
                    "type": "bot:action",
                    "payload": {
                        "player_id": bot_player.player_id,
                        "name": bot_player.name,
                        "action": bot_action,
                    },
                }
                events = [bot_event] + events
                room.state_version += 1
                if state.get("game_over"):
                    room.status = "game_over"
                _save_room_state(room)
                await _emit_game_state(room, events)
                await asyncio.sleep(0.25)
        finally:
            room.bot_running = False

    asyncio.create_task(_runner())


@sio.event
async def connect(sid, environ):
    await sio.emit("system:info", {"message": "connected"}, to=sid)
    await sio.emit("room:list", {"rooms": _room_list_payload()}, to=sid)


@sio.event
async def disconnect(sid):
    session = SESSIONS.pop(sid, None)
    if not session:
        return
    room = _get_room(session.get("room_id"))
    if not room:
        return
    player = _find_player(room, session.get("player_id"))
    if not player:
        return
    player.connected = False
    player.socket_id = None
    player.last_seen = time.time()
    await _emit_room_state(room)
    await _emit_game_state(room)
    await _emit_room_list_update()


@sio.on("room:create")
async def on_room_create(sid, data):
    name = (data or {}).get("name")
    game_type = (data or {}).get("game_type", "cabo")
    if not name:
        await _send_error(sid, "name required")
        return
    game_def = _get_game_definition(game_type)
    if not game_def:
        available = ", ".join(g.game_id for g in list_games())
        await _send_error(sid, f"unknown game_type (available: {available})")
        return
    await _leave_session(sid)
    room_id = _generate_room_id()
    player_id = uuid.uuid4().hex
    reconnect_token = _generate_reconnect_token()
    player = Player(
        player_id=player_id,
        name=name,
        seat=0,
        socket_id=sid,
        reconnect_token=reconnect_token,
        last_seen=time.time(),
    )
    room = Room(room_id=room_id, game_type=game_def.game_id, players=[player])
    ROOMS[room_id] = room
    SESSIONS[sid] = {"room_id": room_id, "player_id": player_id}
    await sio.enter_room(sid, room_id)
    await _emit_room_state(room)
    await sio.emit(
        "system:info",
        {
            "message": f"room created: {room_id}",
            "room_id": room_id,
            "player_id": player_id,
            "reconnect_token": reconnect_token,
            "name": name,
        },
        to=sid,
    )
    await _emit_room_list_update()


@sio.on("room:join")
async def on_room_join(sid, data):
    room_id = (data or {}).get("room_id")
    name = (data or {}).get("name")
    if not room_id or not name:
        await _send_error(sid, "room_id and name required")
        return
    room = _get_room(room_id)
    if not room:
        await _send_error(sid, "room not found")
        return
    if room.source_room_id:
        await sio.emit(
            "room:seat_list",
            {"room_id": room.room_id, "source_room_id": room.source_room_id, "seats": _seat_list_payload(room)},
            to=sid,
        )
        await _send_error(sid, "room loaded (claim a seat)")
        return
    game_def = _get_game_definition(room.game_type)
    if not game_def:
        await _send_error(sid, "room game not found")
        return
    if room.status != "lobby":
        await _send_error(sid, "room already started (use reconnect)")
        return
    for existing in room.players:
        if existing.name == name:
            if existing.connected:
                await _send_error(sid, "name already in use")
            else:
                await _send_error(sid, "player offline (use reconnect)")
            return
    if len(room.players) >= game_def.max_players:
        await _send_error(sid, "room full")
        return
    await _leave_session(sid)
    player_id = uuid.uuid4().hex
    seat = len(room.players)
    reconnect_token = _generate_reconnect_token()
    player = Player(
        player_id=player_id,
        name=name,
        seat=seat,
        socket_id=sid,
        reconnect_token=reconnect_token,
        last_seen=time.time(),
    )
    room.players.append(player)
    SESSIONS[sid] = {"room_id": room_id, "player_id": player_id}
    await sio.enter_room(sid, room_id)
    await _emit_room_state(room)
    await sio.emit(
        "system:info",
        {
            "message": f"joined room: {room_id}",
            "room_id": room_id,
            "player_id": player_id,
            "reconnect_token": reconnect_token,
            "name": name,
        },
        to=sid,
    )
    await _emit_room_list_update()


@sio.on("room:reconnect")
async def on_room_reconnect(sid, data):
    room_id = (data or {}).get("room_id")
    player_id = (data or {}).get("player_id")
    reconnect_token = (data or {}).get("reconnect_token")
    if not room_id or not player_id or not reconnect_token:
        await _send_error(sid, "room_id, player_id, reconnect_token required")
        return
    room = _get_room(room_id)
    if not room:
        await _send_error(sid, "room not found")
        return
    player = _find_player(room, player_id)
    if not player or player.is_bot:
        await _send_error(sid, "player not found")
        return
    if player.reconnect_token != reconnect_token:
        await _send_error(sid, "invalid reconnect token")
        return
    if player.connected:
        await _send_error(sid, "player already connected")
        return
    existing = SESSIONS.get(sid)
    if existing and (existing.get("room_id") != room_id or existing.get("player_id") != player_id):
        await _leave_session(sid)
    player.connected = True
    player.socket_id = sid
    player.last_seen = time.time()
    SESSIONS[sid] = {"room_id": room_id, "player_id": player_id}
    await sio.enter_room(sid, room_id)
    await _emit_room_state(room)
    await _emit_game_state(room)
    await sio.emit(
        "system:info",
        {
            "message": f"reconnected to room: {room_id}",
            "room_id": room_id,
            "player_id": player_id,
            "reconnect_token": reconnect_token,
            "name": player.name,
        },
        to=sid,
    )
    await _emit_room_list_update()


@sio.on("room:leave")
async def on_room_leave(sid, data):
    await _leave_session(sid)


@sio.on("room:ready")
async def on_room_ready(sid, data):
    ready = (data or {}).get("ready")
    session = SESSIONS.get(sid)
    if not session:
        await _send_error(sid, "not in room")
        return
    room = _get_room(session.get("room_id"))
    if not room:
        await _send_error(sid, "room not found")
        return
    player = _find_player(room, session.get("player_id"))
    if not player:
        await _send_error(sid, "player not found")
        return
    if room.status != "lobby":
        await _send_error(sid, "game already started")
        return
    player.ready = bool(ready)
    await _emit_room_state(room)


@sio.on("room:auto_save")
async def on_room_auto_save(sid, data):
    auto_save = (data or {}).get("auto_save")
    session = SESSIONS.get(sid)
    if not session:
        await _send_error(sid, "not in room")
        return
    room = _get_room(session.get("room_id"))
    if not room:
        await _send_error(sid, "room not found")
        return
    if room.status not in ("lobby", "game_over"):
        await _send_error(sid, "game already started")
        return
    room.auto_save = bool(auto_save)
    await _emit_room_state(room)


@sio.on("room:add_bot")
async def on_room_add_bot(sid, data):
    session = SESSIONS.get(sid)
    if not session:
        await _send_error(sid, "not in room")
        return
    room = _get_room(session.get("room_id"))
    if not room:
        await _send_error(sid, "room not found")
        return
    game_def = _get_game_definition(room.game_type)
    if not game_def:
        await _send_error(sid, "room game not found")
        return
    if room.status != "lobby":
        await _send_error(sid, "game already started")
        return
    if len(room.players) >= game_def.max_players:
        await _send_error(sid, "room full")
        return
    name = (data or {}).get("name") or f"Bot {len(room.players) + 1}"
    player_id = uuid.uuid4().hex
    seat = len(room.players)
    bot = Player(
        player_id=player_id,
        name=name,
        seat=seat,
        socket_id=None,
        ready=True,
        is_bot=True,
        reconnect_token=_generate_reconnect_token(),
        last_seen=time.time(),
    )
    room.players.append(bot)
    await _emit_room_state(room)
    await _emit_room_list_update()


@sio.on("room:remove_bot")
async def on_room_remove_bot(sid, data):
    session = SESSIONS.get(sid)
    if not session:
        await _send_error(sid, "not in room")
        return
    room = _get_room(session.get("room_id"))
    if not room:
        await _send_error(sid, "room not found")
        return
    if room.status != "lobby":
        await _send_error(sid, "game already started")
        return
    bot_index = None
    for idx in range(len(room.players) - 1, -1, -1):
        if room.players[idx].is_bot:
            bot_index = idx
            break
    if bot_index is None:
        await _send_error(sid, "no bots to remove")
        return
    room.players.pop(bot_index)
    for idx, player in enumerate(room.players):
        player.seat = idx
    await _emit_room_state(room)
    await _emit_room_list_update()


@sio.on("room:move_seat")
async def on_room_move_seat(sid, data):
    session = SESSIONS.get(sid)
    if not session:
        await _send_error(sid, "not in room")
        return
    room = _get_room(session.get("room_id"))
    if not room:
        await _send_error(sid, "room not found")
        return
    if room.status != "lobby":
        await _send_error(sid, "game already started")
        return
    player = _find_player(room, session.get("player_id"))
    if not player:
        await _send_error(sid, "player not found")
        return

    direction = (data or {}).get("direction")
    if direction not in ("up", "down"):
        await _send_error(sid, "invalid direction")
        return

    ordered_players = sorted(room.players, key=lambda p: p.seat)
    current_index = next(
        (idx for idx, candidate in enumerate(ordered_players) if candidate.player_id == player.player_id),
        None,
    )
    if current_index is None:
        await _send_error(sid, "player not found")
        return

    target_index = current_index - 1 if direction == "up" else current_index + 1
    if target_index < 0 or target_index >= len(ordered_players):
        return

    ordered_players[current_index], ordered_players[target_index] = (
        ordered_players[target_index],
        ordered_players[current_index],
    )
    for idx, candidate in enumerate(ordered_players):
        candidate.seat = idx
    room.players = ordered_players
    await _emit_room_state(room)
    await _emit_room_list_update()


@sio.on("room:start")
async def on_room_start(sid, data):
    session = SESSIONS.get(sid)
    if not session:
        await _send_error(sid, "not in room")
        return
    room = _get_room(session.get("room_id"))
    if not room:
        await _send_error(sid, "room not found")
        return
    game_def = _get_game_definition(room.game_type)
    if not game_def:
        await _send_error(sid, "room game not found")
        return
    if room.status not in ("lobby", "game_over"):
        await _send_error(sid, "game already started")
        return
    if len(room.players) < game_def.min_players:
        await _send_error(sid, "not enough players")
        return
    if not all(p.ready or p.is_bot for p in room.players):
        await _send_error(sid, "all players must be ready")
        return
    players_meta = [
        {
            "player_id": p.player_id,
            "name": p.name,
            "seat": p.seat,
            "is_bot": p.is_bot,
        }
        for p in room.players
    ]
    raw_config = (data or {}).get("config")
    config = raw_config if isinstance(raw_config, dict) else {}
    if room.status == "game_over" and not config and isinstance(room.game_state, dict):
        previous_config = room.game_state.get("config")
        if isinstance(previous_config, dict):
            config = previous_config
    try:
        room.game_state = game_def.module.init_game(config, players_meta)
    except ValueError as exc:
        await _send_error(sid, str(exc))
        return
    room.status = "in_game"
    room.state_version = 1
    _save_room_state(room)
    await _emit_room_state(room)
    await _emit_game_state(room, [])
    await _emit_room_list_update()
    await _maybe_run_bots(room)


@sio.on("room:list")
async def on_room_list(sid, data=None):
    await sio.emit("room:list", {"rooms": _room_list_payload()}, to=sid)


@sio.on("room:load_list")
async def on_room_load_list(sid, data=None):
    await sio.emit("room:load_list", {"saves": _list_load_summaries()}, to=sid)


@sio.on("room:load")
async def on_room_load(sid, data):
    source_room_id = (data or {}).get("source_room_id")
    if not source_room_id:
        await sio.emit("room:load_result", {"ok": False, "message": "source_room_id required"}, to=sid)
        return
    payload = _load_latest_save(source_room_id)
    if not payload:
        await sio.emit("room:load_result", {"ok": False, "message": "save not found"}, to=sid)
        return
    game_type = payload.get("game_type")
    if not game_type or not _get_game_definition(game_type):
        await sio.emit("room:load_result", {"ok": False, "message": "unknown game_type"}, to=sid)
        return
    game_state = payload.get("game_state")
    if not isinstance(game_state, dict):
        await sio.emit("room:load_result", {"ok": False, "message": "invalid game_state"}, to=sid)
        return
    saved_players = payload.get("players")
    if not isinstance(saved_players, list):
        await sio.emit("room:load_result", {"ok": False, "message": "invalid players list"}, to=sid)
        return
    room_id = _generate_room_id()
    players: List[Player] = []
    for idx, raw in enumerate(saved_players):
        if not isinstance(raw, dict):
            continue
        seat = raw.get("seat")
        if not isinstance(seat, int):
            seat = idx
        is_bot = bool(raw.get("is_bot"))
        reconnect_token = raw.get("reconnect_token") or _generate_reconnect_token()
        players.append(
            Player(
                player_id=raw.get("player_id") or uuid.uuid4().hex,
                name=raw.get("name", f"Player {seat + 1}"),
                seat=seat,
                socket_id=None,
                ready=bool(raw.get("ready")),
                connected=is_bot,
                is_bot=is_bot,
                reconnect_token=reconnect_token,
                last_seen=time.time(),
            )
        )
    raw_status = payload.get("room_status")
    status = raw_status if isinstance(raw_status, str) and raw_status else "in_game"
    try:
        state_version = int(payload.get("state_version") or 0)
    except (TypeError, ValueError):
        state_version = 0
    room = Room(
        room_id=room_id,
        game_type=game_type,
        status=status,
        players=players,
        state_version=state_version,
        game_state=game_state,
        source_room_id=payload.get("room_id", source_room_id),
    )
    ROOMS[room_id] = room
    await sio.emit(
        "room:load_result",
        {
            "ok": True,
            "room_id": room_id,
            "source_room_id": room.source_room_id,
        },
        to=sid,
    )
    await _emit_room_list_update()
    await _maybe_run_bots(room)


@sio.on("room:seat_list")
async def on_room_seat_list(sid, data):
    room_id = (data or {}).get("room_id")
    if not room_id:
        await _send_error(sid, "room_id required")
        return
    room = _get_room(room_id)
    if not room:
        await _send_error(sid, "room not found")
        return
    if not room.source_room_id:
        await _send_error(sid, "room not loadable")
        return
    await sio.emit(
        "room:seat_list",
        {"room_id": room.room_id, "source_room_id": room.source_room_id, "seats": _seat_list_payload(room)},
        to=sid,
    )


@sio.on("room:claim_seat")
async def on_room_claim_seat(sid, data):
    room_id = (data or {}).get("room_id")
    seat = (data or {}).get("seat")
    raw_name = (data or {}).get("name")
    name = str(raw_name).strip() if raw_name is not None else ""
    if not room_id or not name:
        await sio.emit(
            "room:claim_result",
            {"ok": False, "message": "room_id and name required"},
            to=sid,
        )
        return
    room = _get_room(room_id)
    if not room:
        await sio.emit("room:claim_result", {"ok": False, "message": "room not found"}, to=sid)
        return
    if not room.source_room_id:
        await sio.emit("room:claim_result", {"ok": False, "message": "room not loadable"}, to=sid)
        return
    try:
        seat = int(seat)
    except (TypeError, ValueError):
        await sio.emit("room:claim_result", {"ok": False, "message": "invalid seat"}, to=sid)
        return
    target = next((p for p in room.players if p.seat == seat), None)
    if not target:
        await sio.emit("room:claim_result", {"ok": False, "message": "seat not found"}, to=sid)
        return
    if target.is_bot:
        await sio.emit("room:claim_result", {"ok": False, "message": "seat is bot"}, to=sid)
        return
    if target.connected:
        await sio.emit("room:claim_result", {"ok": False, "message": "seat already claimed"}, to=sid)
        return
    await _leave_session(sid)
    target.name = name
    target.connected = True
    target.socket_id = sid
    target.last_seen = time.time()
    SESSIONS[sid] = {"room_id": room.room_id, "player_id": target.player_id}
    await sio.enter_room(sid, room.room_id)
    await sio.emit(
        "room:claim_result",
        {
            "ok": True,
            "room_id": room.room_id,
            "player_id": target.player_id,
            "reconnect_token": target.reconnect_token,
            "name": target.name,
        },
        to=sid,
    )
    await sio.emit(
        "system:info",
        {
            "message": f"claimed seat in room: {room.room_id}",
            "room_id": room.room_id,
            "player_id": target.player_id,
            "reconnect_token": target.reconnect_token,
            "name": target.name,
        },
        to=sid,
    )
    await _emit_room_state(room)
    await _emit_game_state(room)
    await _emit_room_list_update()


@sio.on("room:delete")
async def on_room_delete(sid, data):
    room_id = (data or {}).get("room_id")
    if not room_id:
        await _send_error(sid, "room_id required")
        return
    room = _get_room(room_id)
    if not room:
        await sio.emit("room:delete_result", {"room_id": room_id, "ok": False, "message": "room not found"}, to=sid)
        return
    blocking_players = _room_blocking_players(room)
    if blocking_players:
        await sio.emit(
            "room:delete_result",
            {"room_id": room_id, "ok": False, "blocking_players": blocking_players},
            to=sid,
        )
        return
    ROOMS.pop(room_id, None)
    await sio.emit("room:delete_result", {"room_id": room_id, "ok": True}, to=sid)
    await _emit_room_list_update()


@sio.on("game:action")
async def on_game_action(sid, data):
    session = SESSIONS.get(sid)
    if not session:
        await _send_error(sid, "not in room")
        return
    room = _get_room(session.get("room_id"))
    if not room or not room.game_state:
        await _send_error(sid, "game not found")
        return
    game_def = _get_game_definition(room.game_type)
    if not game_def:
        await _send_error(sid, "room game not found")
        return
    if room.status != "in_game":
        await _send_error(sid, "game not active")
        return
    action = (data or {}).get("action")
    if not isinstance(action, dict):
        await _send_error(sid, "invalid action")
        return
    player_id = session.get("player_id")
    events, error = game_def.module.apply_action(room.game_state, player_id, action)
    if error:
        await _send_error(sid, error)
        return
    if room.game_type == "splendor":
        player = _find_player(room, player_id)
        payload = {
            "player_id": player_id,
            "name": player.name if player else None,
            "action": action,
        }
        events = [{"type": "player:action", "payload": payload}] + (events or [])
    room.state_version += 1
    if room.game_state.get("game_over"):
        room.status = "game_over"
        await _emit_room_state(room)
        await _emit_room_list_update()
    _save_room_state(room)
    await _emit_game_state(room, events)
    await _maybe_run_bots(room)
