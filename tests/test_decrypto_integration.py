import asyncio
import unittest
from unittest.mock import AsyncMock, patch

import app
from game import decrypto


class DecryptoIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_bot_runner_confirms_review_but_waits_for_human(self):
        players = [
            {"player_id": "human", "seat": 0, "name": "Alice", "is_bot": False},
            {"player_id": "bot1", "seat": 1, "name": "Bot 1", "is_bot": True},
            {"player_id": "bot2", "seat": 2, "name": "Bot 2", "is_bot": True},
            {"player_id": "bot3", "seat": 3, "name": "Bot 3", "is_bot": True},
        ]
        state = decrypto.DecryptoGame.init_game(None, players)
        for team_id in decrypto.TEAM_IDS:
            state["round_data"][team_id].update({
                "code": [1, 2, 3],
                "clues": ["first", "second", "third"],
                "clues_by": decrypto._current_encryptor(state, team_id),
                "decrypt_guess": [1, 2, 3],
            })
        decrypto._resolve_round(state)
        room = app.Room(
            room_id="decrypto-bot-review",
            game_type="decrypto",
            status="in_game",
            game_state=state,
            players=[
                app.Player(
                    player_id=player["player_id"],
                    name=player["name"],
                    seat=player["seat"],
                    socket_id=None,
                    is_bot=player["is_bot"],
                )
                for player in players
            ],
        )

        async def wait_for_bots():
            while room.bot_running:
                await asyncio.sleep(0.01)

        with patch.object(app, "_emit_game_state", new_callable=AsyncMock) as emit_state, \
             patch.object(app, "_emit_bot_progress", new_callable=AsyncMock), \
             patch.object(app, "_save_room_state"), \
             patch.object(decrypto, "pick_encryptor_clues", side_effect=AssertionError("No clue search during review")):
            await app._maybe_run_bots(room)
            await asyncio.wait_for(wait_for_bots(), timeout=5)
            self.assertEqual(state["next_round_ready"], ["bot1", "bot2", "bot3"])
            self.assertEqual(state["phase"], "round_end")
            self.assertEqual(state["round"], 1)
            self.assertEqual(emit_state.await_count, 3)
            self.assertEqual(room.state_version, 3)
            _, error = decrypto.DecryptoGame.apply_action(state, "human", {"type": "next_round"})
            self.assertIsNone(error)
            self.assertEqual(state["phase"], "encryption")
            self.assertEqual(state["round"], 2)


if __name__ == "__main__":
    unittest.main()
