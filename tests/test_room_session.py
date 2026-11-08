import asyncio
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import app


class DummySio:
    def __init__(self):
        self.emits = []
        self.entered = []
        self.left = []
        self.environ = {}
        self.disconnected = []

    async def emit(self, event, payload, to=None):
        self.emits.append({"event": event, "payload": payload, "to": to})

    async def enter_room(self, sid, room_id):
        self.entered.append((sid, room_id))

    async def leave_room(self, sid, room_id):
        self.left.append((sid, room_id))

    def get_environ(self, sid):
        return self.environ.setdefault(sid, {})

    async def disconnect(self, sid):
        self.disconnected.append(sid)
        await app.disconnect(sid)
        self.environ.pop(sid, None)


class RoomSessionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._original_sio = app.sio
        app.sio = DummySio()
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio = self._original_sio
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def _create_room(self, sid, name, game_type="cabo", config=None):
        payload = {"name": name, "game_type": game_type}
        if config is not None:
            payload["config"] = config
        await app.on_room_create(sid, payload)
        return app.SESSIONS[sid]["room_id"]

    async def test_cleanup_empty_removes_only_rooms_without_connected_humans(self):
        active_room_id = await self._create_room("sid-active", "Alice")
        active_session = dict(app.SESSIONS["sid-active"])
        offline_player = app.Player("offline", "Bob", 0, None, connected=False)
        bot_player = app.Player("bot", "Bot", 1, None, is_bot=True)
        app.ROOMS.update(
            {
                "empty": app.Room("empty"),
                "offline": app.Room("offline", status="game_over", players=[offline_player]),
                "bots": app.Room("bots", status="in_game", players=[bot_player]),
                "mixed": app.Room("mixed", status="in_game", players=[offline_player, bot_player]),
            }
        )
        app.sio.emits.clear()

        await app.on_room_cleanup_empty("sid-requester", {})

        self.assertEqual(set(app.ROOMS), {active_room_id})
        self.assertEqual(app.SESSIONS["sid-active"], active_session)
        self.assertEqual(
            app.sio.emits[0],
            {
                "event": "room:cleanup_empty_result",
                "payload": {"ok": True, "deleted_count": 4, "room_ids": ["bots", "empty", "mixed", "offline"]},
                "to": "sid-requester",
            },
        )
        update = app.sio.emits[1]
        self.assertEqual(update["event"], "room:list_update")
        self.assertIsNone(update["to"])
        self.assertEqual([room["room_id"] for room in update["payload"]["rooms"]], [active_room_id])

    async def test_cleanup_empty_is_safe_when_no_rooms_can_be_deleted(self):
        room_id = await self._create_room("sid-active", "Alice")
        app.sio.emits.clear()

        await app.on_room_cleanup_empty("sid-requester")

        self.assertEqual(set(app.ROOMS), {room_id})
        result = app.sio.emits[0]
        self.assertEqual(result["event"], "room:cleanup_empty_result")
        self.assertEqual(result["payload"], {"ok": True, "deleted_count": 0, "room_ids": []})
        self.assertEqual(result["to"], "sid-requester")
        self.assertEqual(app.sio.emits[1]["event"], "room:list_update")

    async def test_create_cleans_previous_lobby_session(self):
        sid = "sid-1"
        room_id_first = await self._create_room(sid, "Alice")
        self.assertIn(room_id_first, app.ROOMS)

        room_id_second = await self._create_room(sid, "Alice")

        self.assertIn(room_id_second, app.ROOMS)
        self.assertNotIn(room_id_first, app.ROOMS)
        self.assertEqual(app.SESSIONS[sid]["room_id"], room_id_second)

    async def test_felix_bot_card_is_private_but_bid_is_public(self):
        action = {"type": "choose_card", "card_id": "red_cat_-8"}
        self.assertEqual(app._public_bot_action("felix", action), {"type": "choose_card"})
        bid = {"type": "bid", "amount": 7}
        self.assertEqual(app._public_bot_action("felix", bid), bid)
        self.assertEqual(action, {"type": "choose_card", "card_id": "red_cat_-8"})

    async def test_rebel_princess_bot_choices_are_sanitized(self):
        actions = [
            {"type": "pass_cards", "card_ids": ["pet-8", "queen-10", "prince-10"]},
            {"type": "setup_choice", "card_ids": ["queen-10", "prince-10"]},
            {"type": "setup_choice", "card_id": "queen-2"},
            {"type": "choose_card", "card_id": "pet-8"},
            {"type": "play_card", "card_id": "prince-10", "use_snow_white": False},
            {"type": "use_princess", "give_card_id": "pet-8"},
            {"type": "use_princess", "keep_card_id": "queen-2"},
            {"type": "use_princess", "hand_card_id": "queen-10", "trick_card_id": "pet-8"},
        ]
        for action in actions:
            with self.subTest(action=action):
                original = dict(action)
                self.assertEqual(app._public_bot_action("rebel_princess", action), {"type": action["type"]})
                self.assertEqual(action, original)

    async def test_bomb_busters_bot_action_is_sanitized(self):
        action = {
            "type": "dual_cut",
            "own_wire_id": "w-secret-own-slot",
            "target_wire_id": "w-public-target",
        }

        public_action = app._public_bot_action("bomb_busters", action)

        self.assertEqual(public_action, {"type": "dual_cut"})
        self.assertNotIn("own_wire_id", public_action)

    async def test_take_time_bot_action_and_room_seed_are_private(self):
        action = {"type": "place", "card_id": "private-card", "segment": 0, "face_up": False}
        self.assertEqual(app._public_bot_action("take_time", action), {"type": "place"})
        room_id = await self._create_room("sid-tt", "Alice", "take_time", {"seed": 123, "start_clock": "open_sky"})
        room_states = [item["payload"] for item in app.sio.emits if item["event"] == "room:state"]
        self.assertTrue(room_states)
        self.assertNotIn("seed", room_states[-1]["game_config"])
        self.assertEqual(room_states[-1]["game_config"]["start_clock"], "open_sky")
        self.assertEqual(app.ROOMS[room_id].game_config["seed"], 123)

    async def test_take_time_room_start_and_private_views(self):
        room_id = await self._create_room("sid-tt-1", "Alice", "take_time")
        await app.on_room_join("sid-tt-2", {"room_id": room_id, "name": "Bob"})
        await app.on_room_ready("sid-tt-1", {"ready": True})
        await app.on_room_ready("sid-tt-2", {"ready": True})
        await app.on_room_start("sid-tt-1", {})
        self.assertEqual(app.ROOMS[room_id].game_state["phase"], "discussion")
        await app.on_game_action("sid-tt-1", {"action": {"type": "ready"}})
        payloads = [item for item in app.sio.emits if item["event"] == "game:state"]
        alice_view = next(item["payload"]["view"] for item in reversed(payloads) if item["to"] == "sid-tt-1")
        bob_view = next(item["payload"]["view"] for item in reversed(payloads) if item["to"] == "sid-tt-2")
        alice_id = app.SESSIONS["sid-tt-1"]["player_id"]
        alice_hand = next(player["hand"] for player in alice_view["players"] if player["player_id"] == alice_id)
        bob_sees = next(player["hand"] for player in bob_view["players"] if player["player_id"] == alice_id)
        self.assertTrue(all(card["value"] is not None for card in alice_hand))
        self.assertTrue(all(card["value"] is None for card in bob_sees))

    async def test_wriggle_roulette_bot_grab_is_sanitized(self):
        action = {"type": "grab", "count": 4, "cycle_no": 7}

        public_action = app._public_bot_action("wriggle_roulette", action)

        self.assertEqual(public_action, {"type": "grab"})
        self.assertNotIn("count", public_action)

    async def test_skull_bot_card_and_target_choices_are_sanitized(self):
        self.assertEqual(
            app._public_bot_action("skull", {"type": "play_card", "card_type": "skull"}),
            {"type": "play_card"},
        )
        self.assertEqual(
            app._public_bot_action(
                "skull", {"type": "reveal_card", "target_player_id": "private-player"}
            ),
            {"type": "reveal_card"},
        )

    async def test_catan_starfarers_private_bot_actions_are_sanitized(self):
        discard = {
            "type": "discard_resources",
            "resources": {"ore": 2, "fuel": 1},
        }
        encounter = {"type": "choose_encounter", "choice": "option_b"}

        self.assertEqual(
            app._public_bot_action("catan_starfarers", discard),
            {"type": "discard_resources"},
        )
        self.assertEqual(
            app._public_bot_action("catan_starfarers", encounter),
            {"type": "choose_encounter"},
        )

    async def test_catan_starfarers_creation_language_is_kept_when_game_starts(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(
            sid_owner,
            "Alice",
            game_type="catan_starfarers",
            config={"setup_mode": "explorer", "language": "zh"},
        )
        await app.on_room_join("sid-bob", {"room_id": room_id, "name": "Bob"})
        await app.on_room_join("sid-cara", {"room_id": room_id, "name": "Cara"})
        for player in app.ROOMS[room_id].players:
            player.ready = True

        await app.on_room_start(
            sid_owner,
            {"config": {"setup_mode": "beginner", "language": "en"}},
        )

        room = app.ROOMS[room_id]
        self.assertEqual(room.game_config, {"setup_mode": "explorer", "language": "zh"})
        self.assertEqual(room.game_state["config"], room.game_config)
        self.assertEqual(room.status, "in_game")

    async def test_blokus_start_persists_selected_bot_strategy(self):
        room_id = "blokus-strategy"
        players = [
            app.Player(
                player_id=f"p{seat}",
                name=f"Player {seat}",
                seat=seat,
                socket_id=f"sid-{seat}",
                ready=True,
                seat_claimed=True,
            )
            for seat in range(4)
        ]
        app.ROOMS[room_id] = app.Room(
            room_id=room_id,
            game_type="blokus",
            players=players,
            host_player_id="p0",
        )
        app.SESSIONS["sid-0"] = {"room_id": room_id, "player_id": "p0"}

        await app.on_room_start("sid-0", {"config": {"bot_strategy": "territory"}})

        room = app.ROOMS[room_id]
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_config, {"bot_strategy": "territory"})
        self.assertEqual(room.game_state["config"], room.game_config)

    async def test_catan_starfarers_creation_rejects_unknown_language(self):
        sid = "sid-1"

        await app.on_room_create(
            sid,
            {
                "name": "Alice",
                "game_type": "catan_starfarers",
                "config": {"setup_mode": "beginner", "language": "fr"},
            },
        )

        self.assertNotIn(sid, app.SESSIONS)
        error = next(event for event in reversed(app.sio.emits) if event["event"] == "system:error")
        self.assertIn("language", error["payload"]["message"])

    async def test_join_cleans_previous_lobby_session(self):
        sid_owner = "sid-owner"
        room_id_a = await self._create_room(sid_owner, "Alice")
        sid_host = "sid-host"
        room_id_b = await self._create_room(sid_host, "Bob")

        await app.on_room_join(sid_owner, {"room_id": room_id_b, "name": "Alice"})

        self.assertNotIn(room_id_a, app.ROOMS)
        self.assertEqual(app.SESSIONS[sid_owner]["room_id"], room_id_b)
        self.assertEqual(len(app.ROOMS[room_id_b].players), 2)

    async def test_invalid_create_does_not_clear_existing_session(self):
        sid = "sid-1"
        room_id = await self._create_room(sid, "Alice")

        await app.on_room_create(sid, {"game_type": "cabo"})

        self.assertIn(room_id, app.ROOMS)
        self.assertEqual(app.SESSIONS[sid]["room_id"], room_id)

    async def test_create_marks_host_ready(self):
        sid = "sid-1"
        room_id = await self._create_room(sid, "Alice")

        room = app.ROOMS[room_id]
        self.assertTrue(room.players[0].ready)

        room_state_events = [event for event in app.sio.emits if event["event"] == "room:state"]
        self.assertTrue(room_state_events)
        self.assertTrue(room_state_events[-1]["payload"]["players"][0]["ready"])

    async def test_citadels_can_start_after_mobile_connection_is_replaced(self):
        room_id = await self._create_room("mobile-old", "Alice", "citadels")
        room = app.ROOMS[room_id]
        player = room.players[0]
        for _ in range(3):
            await app.on_room_add_bot("mobile-old", {})
        payload = {
            "room_id": room_id,
            "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        }

        # The old socket has not expired yet when a phone opens a new one.
        await app.on_room_reconnect("mobile-new", payload)
        await app.disconnect("mobile-old")

        self.assertNotIn("mobile-old", app.SESSIONS)
        self.assertIn(("mobile-old", room_id), app.sio.left)
        self.assertTrue(player.connected)
        self.assertEqual(player.socket_id, "mobile-new")
        self.assertEqual(len(room.players), 4)
        await app.on_room_remove_bot("mobile-new", {})
        await app.on_room_add_bot("mobile-new", {})
        await app.on_room_start("mobile-new", {})
        self.assertEqual(room.status, "in_game")
        self.assertEqual(len(room.game_state["players"]), 4)

    async def test_reconnect_with_wrong_token_keeps_current_connection(self):
        room_id = await self._create_room("mobile-old", "Alice", "citadels")
        player = app.ROOMS[room_id].players[0]
        await app.on_room_reconnect("untrusted", {
            "room_id": room_id,
            "player_id": player.player_id,
            "reconnect_token": "wrong-token",
        })
        self.assertEqual(player.socket_id, "mobile-old")
        self.assertIn("mobile-old", app.SESSIONS)
        self.assertNotIn("untrusted", app.SESSIONS)

    async def test_reconnect_same_socket_is_idempotent(self):
        room_id = await self._create_room("mobile", "Alice", "citadels")
        player = app.ROOMS[room_id].players[0]
        await app.on_room_reconnect("mobile", {
            "room_id": room_id,
            "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        self.assertEqual(len(app.ROOMS[room_id].players), 1)
        self.assertEqual(app.SESSIONS["mobile"]["player_id"], player.player_id)
        self.assertFalse(any(event["event"] == "system:error" for event in app.sio.emits))

    async def test_leave_during_reconnect_does_not_restore_session(self):
        room_id = await self._create_room("old-browser", "Alice")
        room = app.ROOMS[room_id]
        room.status = "in_game"
        player = room.players[0]
        paused = asyncio.Event()
        resume = asyncio.Event()
        original_emit = app.sio.emit

        async def delayed_emit(event, payload, to=None):
            if event == "room:session_replaced":
                paused.set()
                await resume.wait()
            await original_emit(event, payload, to=to)

        app.sio.emit = delayed_emit
        reconnect = asyncio.create_task(app.on_room_reconnect("new-browser", {
            "room_id": room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        }))
        try:
            await asyncio.wait_for(paused.wait(), 1)
            await app.on_room_leave("new-browser", {"room_id": room_id})
        finally:
            resume.set()
            await reconnect

        self.assertFalse(player.connected)
        self.assertIsNone(player.socket_id)
        self.assertNotIn("new-browser", app.SESSIONS)
        self.assertFalse(any(event["event"] == "system:info" and event["to"] == "new-browser"
                             for event in app.sio.emits))

    async def test_disconnect_during_reconnect_does_not_restore_session(self):
        room_id = await self._create_room("old-browser", "Alice")
        player = app.ROOMS[room_id].players[0]
        original_leave = app.sio.leave_room

        async def disconnect_while_replacing(sid, target_room_id):
            await original_leave(sid, target_room_id)
            if sid == "old-browser":
                await app.disconnect("new-browser")

        app.sio.leave_room = disconnect_while_replacing
        await app.on_room_reconnect("new-browser", {
            "room_id": room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })

        self.assertFalse(player.connected)
        self.assertIsNone(player.socket_id)
        self.assertNotIn("new-browser", app.SESSIONS)

    async def test_logout_during_room_switch_cancels_pending_reconnect(self):
        first_room_id = await self._create_room("browser", "Alice")
        target_room_id = await self._create_room("other-browser", "Alice")
        target = app.ROOMS[target_room_id].players[0]
        await app.disconnect("other-browser")
        original_leave = app.sio.leave_room

        async def logout_while_leaving(sid, room_id):
            await original_leave(sid, room_id)
            if room_id == first_room_id:
                result = await app.on_room_logout("browser", {"preserve_seat": True})
                self.assertEqual(result, {"ok": True})

        app.sio.leave_room = logout_while_leaving
        await app.on_room_reconnect("browser", {
            "room_id": target_room_id, "player_id": target.player_id,
            "reconnect_token": target.reconnect_token,
        })

        self.assertNotIn("browser", app.SESSIONS)
        self.assertFalse(target.connected)
        self.assertIsNone(target.socket_id)

    async def test_leave_does_not_mark_a_replacement_connection_offline(self):
        room_id = await self._create_room("old-browser", "Alice")
        room = app.ROOMS[room_id]
        room.status = "in_game"
        player = room.players[0]
        original_leave = app.sio.leave_room

        async def reconnect_while_leaving(sid, target_room_id):
            await original_leave(sid, target_room_id)
            if sid == "old-browser":
                await app.on_room_reconnect("new-browser", {
                    "room_id": room_id, "player_id": player.player_id,
                    "reconnect_token": player.reconnect_token,
                })

        app.sio.leave_room = reconnect_while_leaving
        await app.on_room_leave("old-browser", {})

        self.assertTrue(player.connected)
        self.assertEqual(player.socket_id, "new-browser")
        self.assertIn("new-browser", app.SESSIONS)

    async def test_logout_removes_authenticated_stale_connections_only(self):
        room_id = await self._create_room("stale-browser", "Alice")
        room = app.ROOMS[room_id]
        room.status = "in_game"
        player = room.players[0]
        other_room_id = await self._create_room("other-browser", "Bob")
        result = await app.on_room_logout("refreshed-browser", {"rooms": {
            room_id: {"player_id": player.player_id, "reconnect_token": player.reconnect_token},
        }})

        self.assertEqual(result, {"ok": True})
        self.assertFalse(player.connected)
        self.assertIsNone(player.socket_id)
        self.assertEqual(room.players, [player])
        self.assertNotIn("stale-browser", app.SESSIONS)
        self.assertIn("stale-browser", app.sio.disconnected)
        self.assertIn("other-browser", app.SESSIONS)
        self.assertTrue(app.ROOMS[other_room_id].players[0].connected)

    async def test_logout_rejects_wrong_credentials_for_another_socket(self):
        room_id = await self._create_room("browser", "Alice")
        player = app.ROOMS[room_id].players[0]
        await app.on_room_logout("untrusted", {"rooms": {
            room_id: {"player_id": player.player_id, "reconnect_token": "wrong-token"},
        }})
        self.assertTrue(player.connected)
        self.assertEqual(player.socket_id, "browser")
        self.assertIn("browser", app.SESSIONS)
        self.assertNotIn("browser", app.sio.disconnected)

    async def test_copy_logout_preserves_lobby_credentials_for_new_connection(self):
        room_id = await self._create_room("browser", "Alice")
        player = app.ROOMS[room_id].players[0]
        credentials = {"room_id": room_id, "player_id": player.player_id,
                       "reconnect_token": player.reconnect_token}
        result = await app.on_room_logout("browser", {"preserve_seat": True})
        self.assertEqual(result, {"ok": True})
        self.assertEqual(app.ROOMS[room_id].players, [player])
        self.assertFalse(player.connected)

        await app.on_room_reconnect("browser", credentials)
        self.assertNotIn("browser", app.SESSIONS)
        self.assertFalse(player.connected)

        await app.on_room_reconnect("returning-browser", credentials)
        self.assertTrue(player.connected)
        self.assertEqual(player.socket_id, "returning-browser")

    async def test_regular_logout_removes_lobby_seat_and_blocks_late_creation(self):
        room_id = await self._create_room("browser", "Alice")
        result = await app.on_room_logout("browser", {})
        self.assertEqual(result, {"ok": True})
        self.assertNotIn(room_id, app.ROOMS)
        self.assertNotIn("browser", app.SESSIONS)
        await app.on_room_create("browser", {"name": "Alice", "game_type": "cabo"})
        self.assertEqual(app.ROOMS, {})
        self.assertNotIn("browser", app.SESSIONS)

    async def test_logout_retry_removes_only_current_authenticated_offline_lobby_seat(self):
        room_id = await self._create_room("browser", "Alice")
        player = app.ROOMS[room_id].players[0]
        other_room_id = await self._create_room("previous-browser", "Alice")
        other_player = app.ROOMS[other_room_id].players[0]
        await app.disconnect("browser")
        await app.disconnect("previous-browser")
        result = await app.on_room_logout("retry-browser", {"room_id": room_id, "rooms": {
            room_id: {"player_id": player.player_id, "reconnect_token": player.reconnect_token},
            other_room_id: {"player_id": other_player.player_id, "reconnect_token": other_player.reconnect_token},
        }})
        self.assertEqual(result, {"ok": True})
        self.assertNotIn(room_id, app.ROOMS)
        self.assertEqual(app.ROOMS[other_room_id].players, [other_player])

    async def test_logout_acknowledgement_waits_for_cleanup(self):
        room_id = await self._create_room("browser", "Alice")
        paused = asyncio.Event()
        resume = asyncio.Event()
        original_leave = app.sio.leave_room

        async def delayed_leave(sid, target_room_id):
            paused.set()
            await resume.wait()
            await original_leave(sid, target_room_id)

        app.sio.leave_room = delayed_leave
        logout = asyncio.create_task(app.on_room_logout("browser", {}))
        try:
            await asyncio.wait_for(paused.wait(), 1)
            self.assertFalse(logout.done())
            self.assertNotIn("browser", app.SESSIONS)
            self.assertNotIn(room_id, app.ROOMS)
        finally:
            resume.set()
            result = await logout
        self.assertEqual(result, {"ok": True})

    async def test_reconnect_between_saved_lobbies_preserves_both_seats(self):
        first_room_id = await self._create_room("first-browser", "Alice")
        first_player = app.ROOMS[first_room_id].players[0]
        await app.disconnect("first-browser")
        second_room_id = await self._create_room("second-browser", "Alice")
        second_player = app.ROOMS[second_room_id].players[0]
        credentials = {
            room_id: {"room_id": room_id, "player_id": player.player_id,
                      "reconnect_token": player.reconnect_token}
            for room_id, player in [(first_room_id, first_player), (second_room_id, second_player)]
        }

        for target_room_id in [first_room_id, second_room_id, first_room_id]:
            await app.on_room_reconnect("second-browser", credentials[target_room_id])
            self.assertEqual(set(app.ROOMS), {first_room_id, second_room_id})
            self.assertEqual(app.SESSIONS["second-browser"]["room_id"], target_room_id)
            for saved_room_id, player in [(first_room_id, first_player), (second_room_id, second_player)]:
                self.assertEqual(app.ROOMS[saved_room_id].players, [player])
                self.assertEqual(player.connected, saved_room_id == target_room_id)
                self.assertEqual(player.socket_id, "second-browser" if player.connected else None)
                self.assertEqual(player.reconnect_token, credentials[saved_room_id]["reconnect_token"])
                self.assertEqual(player.seat, 0)
                self.assertTrue(player.ready)
                self.assertTrue(player.seat_claimed)
        self.assertFalse(any(event["event"] == "system:error" for event in app.sio.emits))

    async def test_reconnect_between_rooms_preserves_the_crew_host(self):
        crew_room_id = await self._create_room("host", "Alice", "the_crew")
        crew_room = app.ROOMS[crew_room_id]
        original_host = crew_room.players[0]
        await app.on_room_join("partner", {"room_id": crew_room_id, "name": "Bob"})
        other_room_id = await self._create_room("previous-browser", "Alice")
        other_player = app.ROOMS[other_room_id].players[0]
        await app.disconnect("previous-browser")

        await app.on_room_reconnect("host", {
            "room_id": other_room_id,
            "player_id": other_player.player_id,
            "reconnect_token": other_player.reconnect_token,
        })

        self.assertEqual(crew_room.host_player_id, original_host.player_id)
        self.assertFalse(original_host.connected)
        self.assertEqual(len(crew_room.players), 2)
        await app.on_room_reconnect("host", {
            "room_id": crew_room_id,
            "player_id": original_host.player_id,
            "reconnect_token": original_host.reconnect_token,
        })
        self.assertEqual(crew_room.host_player_id, original_host.player_id)
        self.assertTrue(original_host.connected)
        self.assertEqual(app.ROOMS[other_room_id].players, [other_player])
        self.assertFalse(other_player.connected)

    async def test_invalid_saved_room_credentials_keep_current_lobby_session(self):
        current_room_id = await self._create_room("current", "Alice")
        other_room_id = await self._create_room("other", "Bob")
        current_player = app.ROOMS[current_room_id].players[0]
        other_player = app.ROOMS[other_room_id].players[0]

        await app.on_room_reconnect("current", {
            "room_id": other_room_id,
            "player_id": other_player.player_id,
            "reconnect_token": "wrong-token",
        })

        self.assertEqual(app.SESSIONS["current"]["room_id"], current_room_id)
        self.assertEqual(app.ROOMS[current_room_id].players, [current_player])
        self.assertTrue(current_player.connected)
        self.assertEqual(current_player.socket_id, "current")
        self.assertEqual(other_player.socket_id, "other")
        self.assertFalse(app.sio.left)

    async def test_room_snapshot_has_start_limits_without_fetching_game_list(self):
        await self._create_room("mobile", "Alice", "citadels")
        snapshot = next(event["payload"] for event in reversed(app.sio.emits)
                        if event["event"] == "room:state")
        self.assertEqual(snapshot["min_players"], 2)
        self.assertEqual(snapshot["max_players"], 6)
        self.assertFalse(snapshot["supports_memories"])

    async def test_forest_shuffle_creation_language_is_kept_when_game_starts(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(
            sid_owner,
            "Alice",
            game_type="forest_shuffle",
            config={"language": "zh"},
        )
        sid_bob = "sid-bob"
        await app.on_room_join(sid_bob, {"room_id": room_id, "name": "Bob"})
        for player in app.ROOMS[room_id].players:
            player.ready = True

        await app.on_room_start(sid_owner, {"config": {"language": "en"}})

        room = app.ROOMS[room_id]
        self.assertEqual(room.game_config, {"language": "zh"})
        self.assertEqual(room.game_state["config"]["language"], "zh")
        room_state = next(
            event for event in reversed(app.sio.emits) if event["event"] == "room:state"
        )
        self.assertEqual(room_state["payload"]["game_config"]["language"], "zh")

    async def test_forest_shuffle_creation_rejects_unknown_language(self):
        sid = "sid-1"

        await app.on_room_create(
            sid,
            {"name": "Alice", "game_type": "forest_shuffle", "config": {"language": "fr"}},
        )

        self.assertNotIn(sid, app.SESSIONS)
        error = next(event for event in reversed(app.sio.emits) if event["event"] == "system:error")
        self.assertIn("language", error["payload"]["message"])

    async def test_reconnect_leaves_previous_session_but_preserves_seat(self):
        sid_old = "sid-old"
        room_id_old = await self._create_room(sid_old, "Alice")

        sid_host = "sid-host"
        room_id_new = await self._create_room(sid_host, "Bob")
        target_player = app.ROOMS[room_id_new].players[0]
        target_player.connected = False
        target_player.socket_id = None

        await app.on_room_reconnect(
            sid_old,
            {
                "room_id": room_id_new,
                "player_id": target_player.player_id,
                "reconnect_token": target_player.reconnect_token,
            },
        )

        self.assertIn(room_id_old, app.ROOMS)
        previous_player = app.ROOMS[room_id_old].players[0]
        self.assertFalse(previous_player.connected)
        self.assertIsNone(previous_player.socket_id)
        self.assertIn((sid_old, room_id_old), app.sio.left)
        self.assertEqual(app.SESSIONS[sid_old]["room_id"], room_id_new)
        self.assertTrue(target_player.connected)
        self.assertEqual(target_player.socket_id, sid_old)

    async def test_reconnect_marks_in_game_player_offline(self):
        sid_old = "sid-old"
        room_id_old = await self._create_room(sid_old, "Alice")
        old_room = app.ROOMS[room_id_old]
        old_room.status = "in_game"
        old_room.game_state = {"started": True}
        old_player = old_room.players[0]

        sid_host = "sid-host"
        room_id_new = await self._create_room(sid_host, "Bob")
        target_player = app.ROOMS[room_id_new].players[0]
        target_player.connected = False
        target_player.socket_id = None

        await app.on_room_reconnect(
            sid_old,
            {
                "room_id": room_id_new,
                "player_id": target_player.player_id,
                "reconnect_token": target_player.reconnect_token,
            },
        )

        self.assertIn(room_id_old, app.ROOMS)
        self.assertFalse(old_player.connected)
        self.assertIsNone(old_player.socket_id)
        self.assertEqual(app.SESSIONS[sid_old]["room_id"], room_id_new)

    async def test_reconnect_allows_loaded_room(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(sid_owner, "Alice")
        room = app.ROOMS[room_id]
        room.source_room_id = "source-room"
        player = room.players[0]
        player.connected = False
        player.socket_id = None
        app.SESSIONS.pop(sid_owner, None)

        sid_new = "sid-new"
        await app.on_room_reconnect(
            sid_new,
            {
                "room_id": room_id,
                "player_id": player.player_id,
                "reconnect_token": player.reconnect_token,
            },
        )

        self.assertTrue(player.connected)
        self.assertEqual(player.socket_id, sid_new)
        self.assertEqual(app.SESSIONS[sid_new]["room_id"], room_id)

    async def test_claim_seat_rejects_second_claim(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(sid_owner, "Alice")
        room = app.ROOMS[room_id]
        room.source_room_id = "source-room"
        player = room.players[0]
        player.connected = False
        player.socket_id = None
        player.seat_claimed = False
        app.SESSIONS.pop(sid_owner, None)

        sid_claim = "sid-claim"
        await app.on_room_claim_seat(
            sid_claim,
            {"room_id": room_id, "seat": 0, "name": "Alice"},
        )

        first_result = next(
            event for event in reversed(app.sio.emits) if event["event"] == "room:claim_result"
        )
        self.assertTrue(first_result["payload"]["ok"])

        sid_again = "sid-again"
        await app.on_room_claim_seat(
            sid_again,
            {"room_id": room_id, "seat": 0, "name": "Bob"},
        )

        second_result = next(
            event for event in reversed(app.sio.emits) if event["event"] == "room:claim_result"
        )
        self.assertFalse(second_result["payload"]["ok"])
        self.assertEqual(second_result["payload"]["message"], "seat already claimed")

    async def test_move_seat_swaps_order(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(sid_owner, "Alice")
        sid_bob = "sid-bob"
        await app.on_room_join(sid_bob, {"room_id": room_id, "name": "Bob"})

        await app.on_room_move_seat(sid_bob, {"direction": "up"})

        room = app.ROOMS[room_id]
        alice = next(player for player in room.players if player.name == "Alice")
        bob = next(player for player in room.players if player.name == "Bob")
        self.assertEqual(bob.seat, 0)
        self.assertEqual(alice.seat, 1)
        self.assertEqual(room.players[0].player_id, bob.player_id)
        self.assertEqual(room.players[1].player_id, alice.player_id)

    async def test_reopen_moves_players_to_new_room(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(sid_owner, "Alice", game_type="gold_rush")
        sid_bob = "sid-bob"
        await app.on_room_join(sid_bob, {"room_id": room_id, "name": "Bob"})
        room = app.ROOMS[room_id]
        room.status = "in_game"
        room.game_state = {"config": {"mode": "classic"}}
        old_players = {p.name: (p.player_id, p.reconnect_token) for p in room.players}

        await app.on_room_reopen(sid_owner, {})

        new_room_id = app.SESSIONS[sid_owner]["room_id"]
        self.assertNotEqual(new_room_id, room_id)
        self.assertNotIn(room_id, app.ROOMS)
        self.assertIn(new_room_id, app.ROOMS)
        new_room = app.ROOMS[new_room_id]
        self.assertEqual(new_room.status, "in_game")
        self.assertEqual(new_room.game_type, "gold_rush")
        self.assertEqual(new_room.game_state["config"]["mode"], "classic")
        ordered = sorted(new_room.players, key=lambda p: p.seat)
        self.assertEqual([p.name for p in ordered], ["Alice", "Bob"])
        for player in new_room.players:
            old_player_id, old_token = old_players[player.name]
            self.assertEqual(player.player_id, old_player_id)
            self.assertEqual(player.reconnect_token, old_token)

        self.assertEqual(app.SESSIONS[sid_bob]["room_id"], new_room_id)
        self.assertIn((sid_owner, room_id), app.sio.left)
        self.assertIn((sid_bob, room_id), app.sio.left)
        self.assertIn((sid_owner, new_room_id), app.sio.entered)
        self.assertIn((sid_bob, new_room_id), app.sio.entered)

    async def test_reopen_turing_random_scenario_uses_new_seed(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(sid_owner, "Alice", game_type="turing_machine")
        room = app.ROOMS[room_id]
        room.status = "in_game"
        room.game_state = {
            "config": {
                "mode": "simple",
                "scenario_source": "random",
                "difficulty": "standard",
                "preset_id": "",
                "seed": "previous-seed",
            }
        }

        await app.on_room_reopen(sid_owner, {})

        new_room_id = app.SESSIONS[sid_owner]["room_id"]
        new_config = app.ROOMS[new_room_id].game_state["config"]
        self.assertEqual(new_config["scenario_source"], "random")
        self.assertEqual(len(new_config["seed"]), 8)
        self.assertNotEqual(new_config["seed"], "previous-seed")

    async def test_reopen_guandan_starts_a_fresh_deal(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(sid_owner, "Alice", game_type="guandan")
        for index, name in enumerate(("Bob", "Carol", "Dave"), start=2):
            await app.on_room_join(f"sid-{index}", {"room_id": room_id, "name": name})
        room = app.ROOMS[room_id]
        for player in room.players:
            player.ready = True

        await app.on_room_start(sid_owner, {})

        original_state = room.game_state
        owner_id = room.players[0].player_id
        original_state["players"][owner_id]["hand"].pop()
        original_state["round_number"] = 4

        await app.on_room_reopen(sid_owner, {})

        new_room_id = app.SESSIONS[sid_owner]["room_id"]
        new_room = app.ROOMS[new_room_id]
        self.assertNotEqual(new_room_id, room_id)
        self.assertEqual(new_room.status, "in_game")
        self.assertEqual(new_room.game_type, "guandan")
        self.assertIsNot(new_room.game_state, original_state)
        self.assertEqual(new_room.game_state["phase"], "playing")
        self.assertEqual(new_room.game_state["round_number"], 1)
        self.assertEqual(len(new_room.game_state["players"]), 4)
        for player_state in new_room.game_state["players"].values():
            self.assertEqual(len(player_state["hand"]), 27)

    async def test_auto_save_allows_in_game_enable(self):
        sid = "sid-owner"
        room_id = await self._create_room(sid, "Alice")
        room = app.ROOMS[room_id]
        room.status = "in_game"
        room.game_state = {"started": True}
        app.sio.emits.clear()

        await app.on_room_auto_save(sid, {"auto_save": True})

        self.assertTrue(room.auto_save)
        self.assertFalse(any(event["event"] == "system:error" for event in app.sio.emits))

    async def test_auto_save_cannot_disable_after_enabled(self):
        sid = "sid-owner"
        room_id = await self._create_room(sid, "Alice")
        room = app.ROOMS[room_id]
        room.auto_save = True
        app.sio.emits.clear()

        await app.on_room_auto_save(sid, {"auto_save": False})

        self.assertTrue(room.auto_save)
        errors = [event for event in app.sio.emits if event["event"] == "system:error"]
        self.assertTrue(errors)
        self.assertEqual(errors[-1]["payload"]["message"], "auto-save already enabled")

    async def test_guandan_checkpoint_api_lists_supported_files(self):
        with TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / "alpha.pt").write_text("x", encoding="utf-8")
            (root / "beta.pth").write_text("x", encoding="utf-8")
            (root / "notes.txt").write_text("x", encoding="utf-8")
            original_dir = app.GUANDAN_CHECKPOINT_DIR
            try:
                app.GUANDAN_CHECKPOINT_DIR = root
                payload = await app.guandan_checkpoints()
            finally:
                app.GUANDAN_CHECKPOINT_DIR = original_dir

        self.assertEqual(
            payload,
            {
                "checkpoints": [
                    {"label": "alpha.pt", "path": "alpha.pt"},
                    {"label": "beta.pth", "path": "beta.pth"},
                ]
            },
        )
