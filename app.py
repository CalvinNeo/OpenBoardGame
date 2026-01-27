import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import socketio
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from game import CaboGame

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
fastapi_app = FastAPI()
fastapi_app.mount("/static", StaticFiles(directory="static"), name="static")


@fastapi_app.get("/")
async def index():
    return FileResponse("static/index.html")


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


@dataclass
class Room:
    room_id: str
    game_type: str = "cabo"
    status: str = "lobby"
    players: List[Player] = field(default_factory=list)
    state_version: int = 0
    game_state: Optional[Dict] = None
    bot_running: bool = False


ROOMS: Dict[str, Room] = {}
SESSIONS: Dict[str, Dict] = {}


def _generate_room_id() -> str:
    while True:
        rid = uuid.uuid4().hex[:6]
        if rid not in ROOMS:
            return rid


def _get_room(room_id: str) -> Optional[Room]:
    return ROOMS.get(room_id)


def _find_player(room: Room, player_id: str) -> Optional[Player]:
    for player in room.players:
        if player.player_id == player_id:
            return player
    return None


async def _emit_room_state(room: Room) -> None:
    payload = {
        "room_id": room.room_id,
        "status": room.status,
        "game_type": room.game_type,
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


async def _emit_game_state(room: Room, events: Optional[List[Dict]] = None) -> None:
    if not room.game_state:
        return
    for player in room.players:
        if player.socket_id is None:
            continue
        view = CaboGame.get_public_view(room.game_state, player.player_id)
        payload = {
            "room_id": room.room_id,
            "state_version": room.state_version,
            "room_status": room.status,
            "view": view,
            "events": events or [],
        }
        await sio.emit("game:state", payload, to=player.socket_id)


async def _send_error(sid: str, message: str) -> None:
    await sio.emit("system:error", {"message": message}, to=sid)


async def _maybe_run_bots(room: Room) -> None:
    if room.bot_running or room.status != "in_game" or not room.game_state:
        return

    async def _runner():
        room.bot_running = True
        try:
            while room.status == "in_game":
                current = room.game_state["current_turn"]
                player = _find_player(room, current)
                if not player or not player.is_bot:
                    break
                action = CaboGame.bot_move(room.game_state, current)
                if not action:
                    break
                events, error = CaboGame.apply_action(room.game_state, current, action)
                if error:
                    break
                room.state_version += 1
                if room.game_state["phase"] == "round_end":
                    room.status = "game_over"
                await _emit_game_state(room, events)
                await asyncio.sleep(0.3)
        finally:
            room.bot_running = False

    asyncio.create_task(_runner())


@sio.event
async def connect(sid, environ):
    await sio.emit("system:info", {"message": "connected"}, to=sid)


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
    await _emit_room_state(room)
    await _emit_game_state(room)


@sio.on("room:create")
async def on_room_create(sid, data):
    name = (data or {}).get("name")
    game_type = (data or {}).get("game_type", "cabo")
    if not name:
        await _send_error(sid, "name required")
        return
    if game_type != "cabo":
        await _send_error(sid, "only cabo supported")
        return
    room_id = _generate_room_id()
    player_id = uuid.uuid4().hex
    player = Player(player_id=player_id, name=name, seat=0, socket_id=sid)
    room = Room(room_id=room_id, game_type=game_type, players=[player])
    ROOMS[room_id] = room
    SESSIONS[sid] = {"room_id": room_id, "player_id": player_id}
    await sio.enter_room(sid, room_id)
    await _emit_room_state(room)
    await sio.emit(
        "system:info",
        {"message": f"room created: {room_id}", "player_id": player_id},
        to=sid,
    )


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
    if room.status != "lobby":
        await _send_error(sid, "room already started")
        return
    if len(room.players) >= CaboGame.max_players:
        await _send_error(sid, "room full")
        return
    player_id = uuid.uuid4().hex
    seat = len(room.players)
    player = Player(player_id=player_id, name=name, seat=seat, socket_id=sid)
    room.players.append(player)
    SESSIONS[sid] = {"room_id": room_id, "player_id": player_id}
    await sio.enter_room(sid, room_id)
    await _emit_room_state(room)
    await sio.emit(
        "system:info",
        {"message": f"joined room: {room_id}", "player_id": player_id},
        to=sid,
    )


@sio.on("room:leave")
async def on_room_leave(sid, data):
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
            return
    else:
        player.connected = False
        player.socket_id = None
    await _emit_room_state(room)
    await _emit_game_state(room)


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
    if room.status != "lobby":
        await _send_error(sid, "game already started")
        return
    if len(room.players) >= CaboGame.max_players:
        await _send_error(sid, "room full")
        return
    name = (data or {}).get("name") or f"Bot {len(room.players) + 1}"
    player_id = uuid.uuid4().hex
    seat = len(room.players)
    bot = Player(player_id=player_id, name=name, seat=seat, socket_id=None, ready=True, is_bot=True)
    room.players.append(bot)
    await _emit_room_state(room)


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
    if room.status != "lobby":
        await _send_error(sid, "game already started")
        return
    if len(room.players) < CaboGame.min_players:
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
    try:
        room.game_state = CaboGame.init_game({}, players_meta)
    except ValueError as exc:
        await _send_error(sid, str(exc))
        return
    room.status = "in_game"
    room.state_version = 1
    await _emit_game_state(room, [])
    await _maybe_run_bots(room)


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
    if room.status != "in_game":
        await _send_error(sid, "game not active")
        return
    action = (data or {}).get("action")
    if not isinstance(action, dict):
        await _send_error(sid, "invalid action")
        return
    player_id = session.get("player_id")
    events, error = CaboGame.apply_action(room.game_state, player_id, action)
    if error:
        await _send_error(sid, error)
        return
    room.state_version += 1
    if room.game_state["phase"] == "round_end":
        room.status = "game_over"
    await _emit_game_state(room, events)
    await _maybe_run_bots(room)
