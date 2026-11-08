import asyncio
import json
import random
import unittest
from copy import deepcopy
from tempfile import TemporaryDirectory
from typing import Dict, List, Optional
from unittest.mock import AsyncMock, patch

import app
from game.criminal_dance import CriminalDanceGame, _record_private_hand
from game.criminal_dance_ai import choose_action, infer_knowledge
from tests.test_criminal_dance import _players
from tests.test_room_session import DummySio


def _state(hands: List[List[str]], config: Optional[Dict] = None) -> Dict:
    state = CriminalDanceGame.init_game({"enable_boy": False, **(config or {})}, _players(len(hands)))
    state["current_player_id"] = "p1"
    state["current_turn_index"] = 0
    for player_id, card_types in zip(state["player_order"], hands):
        player = state["players"][player_id]
        player["hand"] = [
            {"id": f"{player_id}_card_{index}", "type": card_type}
            for index, card_type in enumerate(card_types)
        ]
        player["private_log"] = []
        player["private_clues"] = []
        _record_private_hand(state, player_id, player_id)
    return state


def _play(state: Dict, player_id: str, card_type: str, **extra: str) -> None:
    card = next(card for card in state["players"][player_id]["hand"] if card["type"] == card_type)
    _, error = CriminalDanceGame.apply_action(state, player_id, {"type": "play_card", "card_id": card["id"], **extra})
    if error:
        raise AssertionError(error)


def _know_criminal(state: Dict, viewer: str, holder: str) -> None:
    state["players"][viewer]["private_clues"].append({
        "turn": len(state["played"]), "criminal_holder_player_id": holder,
    })


class CriminalDanceAiTests(unittest.TestCase):
    def setUp(self):
        self.addCleanup(random.setstate, random.getstate())
        random.seed(6608)

    def _move_card(self, state, player_id="p1"):
        action = CriminalDanceGame.bot_move(state, player_id)
        self.assertIsNotNone(action)
        card = next(card for card in state["players"][player_id]["hand"] if card["id"] == action["card_id"])
        return card["type"], action

    def test_last_criminal_escapes(self):
        state = _state([["criminal"], ["detective"], ["civilian"]])
        card_type, action = self._move_card(state)
        self.assertEqual("criminal", card_type)
        _, error = CriminalDanceGame.apply_action(state, "p1", action)
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(["p1"], state["winner_ids"])

    def test_boy_identifies_player_ids_even_with_duplicate_names(self):
        players = _players(3)
        for player in players:
            player["name"] = "Same name"
        hands = _state([["boy", "detective"], ["civilian"], ["criminal"]])["players"]
        with patch("game.criminal_dance._deal_round_hands", return_value={
            player_id: player["hand"] for player_id, player in hands.items()
        }):
            state = CriminalDanceGame.init_game({"detective_activation_rule": "always"}, players)
        card_type, action = self._move_card(state)
        self.assertEqual("detective", card_type)
        self.assertEqual("p3", action["target_player_id"])

    def test_witness_knowledge_survives_public_discards_and_json_restore(self):
        state = _state([["witness", "detective", "civilian"], ["criminal", "civilian"], ["civilian", "civilian"]])
        _play(state, "p1", "witness", target_player_id="p2")
        _play(state, "p2", "civilian")
        _play(state, "p3", "civilian")
        restored = CriminalDanceGame.deserialize(json.loads(json.dumps(CriminalDanceGame.serialize(state))))
        knowledge = infer_knowledge(CriminalDanceGame.get_public_view(restored, "p1"))
        self.assertEqual(1.0, knowledge.criminal["p2"])
        self.assertEqual(0, knowledge.hands["p2"]["civilian"])
        card_type, action = self._move_card(restored)
        self.assertEqual("detective", card_type)
        self.assertEqual("p2", action["target_player_id"])

    def test_witness_precedes_uncertain_accusation(self):
        state = _state([
            ["witness", "detective", "civilian"],
            ["criminal", "civilian", "alibi"],
            ["civilian", "civilian", "alibi"],
        ])
        card_type, action = self._move_card(state)
        self.assertEqual("witness", card_type)
        self.assertIn(action["target_player_id"], ("p2", "p3"))

    def test_detective_waits_until_active(self):
        state = _state([["boy", "detective", "civilian", "civilian"], ["criminal"], ["civilian"]])
        _know_criminal(state, "p1", "p2")
        card_type, _ = self._move_card(state)
        self.assertNotEqual("detective", card_type)
        state["players"]["p1"]["hand"].pop()
        card_type, action = self._move_card(state)
        self.assertEqual("detective", card_type)
        self.assertEqual("p2", action["target_player_id"])

    def test_round_activation_rule_is_respected(self):
        state = _state([["detective"], ["criminal"], ["civilian"]], {"detective_activation_rule": "round_ge_2"})
        _know_criminal(state, "p1", "p2")
        for round_number, expected in ((1, "inactive"), (2, "caught")):
            with self.subTest(round_number=round_number):
                current = deepcopy(state)
                current["round_number"] = round_number
                action = CriminalDanceGame.bot_move(current, "p1")
                _, error = CriminalDanceGame.apply_action(current, "p1", action)
                self.assertIsNone(error)
                self.assertEqual(expected, current["played"][-1]["detective_result"])

    def test_public_alibi_block_leads_to_dog_instead_of_detective(self):
        state = _state([["dog", "detective", "civilian"], ["criminal", "alibi"], ["detective", "civilian"]])
        state.update(current_player_id="p3", current_turn_index=2)
        _play(state, "p3", "detective", target_player_id="p2")
        knowledge = infer_knowledge(CriminalDanceGame.get_public_view(state, "p1"))
        self.assertEqual(1.0, knowledge.criminal["p2"])
        self.assertIn("p2", knowledge.alibis)
        card_type, action = self._move_card(state)
        self.assertEqual("dog", card_type)
        self.assertEqual("p2", action["target_player_id"])

    def test_failed_accusation_eliminates_suspect(self):
        state = _state([["detective", "civilian"], ["civilian"], ["detective", "criminal"]])
        state.update(current_player_id="p3", current_turn_index=2)
        _play(state, "p3", "detective", target_player_id="p2")
        knowledge = infer_knowledge(CriminalDanceGame.get_public_view(state, "p1"))
        self.assertEqual(0.0, knowledge.criminal["p2"])
        card_type, action = self._move_card(state)
        self.assertEqual("detective", card_type)
        self.assertEqual("p3", action["target_player_id"])

    def test_dog_reveal_is_public_and_remembered(self):
        state = _state([["detective", "civilian"], ["criminal", "alibi"], ["dog", "civilian"]])
        state.update(current_player_id="p3", current_turn_index=2)
        with patch("game.criminal_dance.random.randrange", return_value=1):
            _play(state, "p3", "dog", target_player_id="p2")
        view = CriminalDanceGame.get_public_view(state, "p1")
        self.assertEqual("alibi", view["played"][-1]["dog_reveal"])
        knowledge = infer_knowledge(view)
        self.assertIn("p2", knowledge.alibis)
        self.assertLess(knowledge.criminal["p2"], knowledge.criminal["p3"])

    def test_passes_move_single_card_criminal_in_correct_direction(self):
        for card_type, recipient in (("info_control", "p4"), ("rumor", "p2")):
            with self.subTest(card_type=card_type):
                state = _state([
                    ["detective", "civilian"], [card_type, "civilian"],
                    ["criminal"], ["civilian", "civilian"],
                ])
                _know_criminal(state, "p1", "p3")
                state.update(current_player_id="p2", current_turn_index=1)
                _play(state, "p2", card_type)
                knowledge = infer_knowledge(CriminalDanceGame.get_public_view(state, "p1"))
                self.assertEqual(1.0, knowledge.criminal[recipient])
                self.assertEqual(0.0, knowledge.criminal["p3"])
                self.assertNotIn("p3", knowledge.hands)

    def test_trade_invalidates_old_witness_hand_without_assuming_hidden_pick(self):
        state = _state([
            ["detective", "dog"], ["trade", "civilian", "civilian"],
            ["criminal", "alibi"], ["civilian"],
        ])
        _record_private_hand(state, "p1", "p3")
        state.update(current_player_id="p2", current_turn_index=1)
        _play(state, "p2", "trade", target_player_id="p3", your_card_id="p2_card_1", target_card_id="p3_card_0")
        knowledge = infer_knowledge(CriminalDanceGame.get_public_view(state, "p1"))
        self.assertAlmostEqual(0.5, knowledge.criminal["p2"])
        self.assertAlmostEqual(0.5, knowledge.criminal["p3"])
        self.assertNotIn("p3", knowledge.hands)
        self.assertNotIn("target_card_id", state["played"][-1])

    def test_unrelated_trade_preserves_known_hand(self):
        state = _state([
            ["detective", "civilian"], ["trade", "civilian"],
            ["criminal", "alibi"], ["civilian", "civilian"],
        ])
        _record_private_hand(state, "p1", "p3")
        state.update(current_player_id="p2", current_turn_index=1)
        _play(state, "p2", "trade", target_player_id="p4", your_card_id="p2_card_1")
        knowledge = infer_knowledge(CriminalDanceGame.get_public_view(state, "p1"))
        self.assertEqual(1.0, knowledge.criminal["p3"])
        self.assertEqual(1, knowledge.hands["p3"]["alibi"])

    def test_bot_remembers_giving_away_its_own_criminal(self):
        state = _state([["trade", "criminal"], ["civilian"], ["civilian"]])
        _play(state, "p1", "trade", target_player_id="p2", your_card_id="p1_card_1")
        knowledge = infer_knowledge(CriminalDanceGame.get_public_view(state, "p1"))
        self.assertEqual(1.0, knowledge.criminal["p2"])
        self.assertEqual(0.0, knowledge.criminal["p1"])

    def test_criminal_keeps_alibi(self):
        state = _state([["criminal", "alibi", "civilian"], ["detective"], ["civilian"]])
        card_type, _ = self._move_card(state)
        self.assertEqual("civilian", card_type)

    def test_criminal_trades_before_being_forced_to_give_away_criminal(self):
        state = _state([["criminal", "trade", "civilian"], ["detective"], ["civilian"]])
        card_type, action = self._move_card(state)
        self.assertEqual("trade", card_type)
        self.assertEqual("p1_card_2", action["your_card_id"])
        self.assertNotIn("target_card_id", action)

    def test_accomplice_joins_imminent_escape(self):
        state = _state([["accomplice", "civilian"], ["criminal"], ["civilian"]])
        _know_criminal(state, "p1", "p2")
        card_type, action = self._move_card(state)
        self.assertEqual("accomplice", card_type)
        CriminalDanceGame.apply_action(state, "p1", action)
        _play(state, "p2", "criminal")
        self.assertEqual(["p1", "p2"], state["winner_ids"])

    def test_accomplice_does_not_catch_known_teammate(self):
        state = _state([["detective", "dog", "civilian"], ["criminal"], ["civilian"]])
        state["players"]["p1"]["is_accomplice"] = True
        _know_criminal(state, "p1", "p2")
        card_type, action = self._move_card(state)
        if card_type in ("detective", "dog"):
            self.assertNotEqual("p2", action["target_player_id"])
        _, error = CriminalDanceGame.apply_action(state, "p1", action)
        self.assertIsNone(error)
        self.assertFalse(state["game_over"])
        _play(state, "p2", "criminal")
        self.assertEqual(["p1", "p2"], state["winner_ids"])

    def test_accomplice_passes_criminal_to_short_hand(self):
        state = _state([["trade", "criminal", "civilian"], ["civilian"], ["civilian", "civilian", "civilian"]])
        state["players"]["p1"]["is_accomplice"] = True
        card_type, action = self._move_card(state)
        self.assertEqual("trade", card_type)
        self.assertEqual("p2", action["target_player_id"])
        self.assertEqual("p1_card_1", action["your_card_id"])

    def test_own_view_is_only_input_and_choice_does_not_mutate_state_or_rng(self):
        state = _state([["detective", "witness", "civilian"], ["criminal", "alibi"], ["dog", "civilian"]])
        before = deepcopy(state)
        random_before = random.getstate()
        action = CriminalDanceGame.bot_move(state, "p1")
        view = CriminalDanceGame.get_public_view(state, "p1")
        view_before = deepcopy(view)
        self.assertEqual(action, choose_action(view))
        self.assertEqual(view_before, view)
        self.assertEqual(before, state)
        self.assertEqual(random_before, random.getstate())
        state["players"]["p2"]["hand"], state["players"]["p3"]["hand"] = (
            state["players"]["p3"]["hand"], state["players"]["p2"]["hand"],
        )
        state["players"]["p2"]["private_log"] = ["Hidden evidence"]
        self.assertEqual(view_before, CriminalDanceGame.get_public_view(state, "p1"))
        self.assertEqual(action, CriminalDanceGame.bot_move(state, "p1"))

    def test_private_clues_are_owner_only_and_detached_from_state(self):
        state = _state([["witness", "civilian"], ["criminal", "alibi"], ["civilian"]])
        _play(state, "p1", "witness", target_player_id="p2")
        for viewer in ("p1", "p2", "p3", "spectator"):
            with self.subTest(viewer=viewer):
                view = CriminalDanceGame.get_public_view(state, viewer)
                for player in view["players"]:
                    if player["player_id"] != viewer:
                        self.assertEqual([], player["hand"])
                        self.assertEqual([], player["private_clues"])
                        self.assertEqual([], player["private_log"])
        view = CriminalDanceGame.get_public_view(state, "p1")
        snapshot = deepcopy(state)
        view["players"][0]["private_clues"][0]["card_types"].append("criminal")
        self.assertEqual(snapshot, state)
        self.assertNotIn("private_clues", state["played"][-1])

    def test_old_save_without_structured_clues_still_plays(self):
        state = _state([["witness", "detective"], ["criminal", "civilian"], ["civilian", "civilian"]])
        _play(state, "p1", "witness", target_player_id="p2")
        _play(state, "p2", "civilian")
        _play(state, "p3", "civilian")
        for player in state["players"].values():
            player.pop("private_clues")
        for entry in state["played"]:
            entry.pop("hand_counts_before")
            entry.pop("target_player_id", None)
        action = CriminalDanceGame.bot_move(state, "p1")
        self.assertIsNotNone(action)
        _, error = CriminalDanceGame.apply_action(state, "p1", action)
        self.assertIsNone(error)

    def test_unknown_player_and_wrong_turn_do_not_act(self):
        state = _state([["criminal"], ["detective"], ["civilian"]])
        self.assertIsNone(CriminalDanceGame.bot_move(state, "p2"))
        self.assertIsNone(CriminalDanceGame.bot_move(state, "spectator"))

    def test_last_trade_can_be_discarded_without_selecting_hidden_card(self):
        state = _state([["trade"], ["criminal"], []])
        card_type, action = self._move_card(state)
        self.assertEqual("trade", card_type)
        self.assertNotIn("your_card_id", action)
        self.assertNotIn("target_card_id", action)
        _, error = CriminalDanceGame.apply_action(state, "p1", action)
        self.assertIsNone(error)
        self.assertFalse(state["played"][-1]["trade_completed"])

    def test_target_cards_discard_without_effect_when_everyone_else_is_empty(self):
        for card_type in ("dog", "witness", "trade"):
            with self.subTest(card_type=card_type):
                state = _state([["criminal", card_type], [], []], {"dog_fail_behavior": "give_to_target"})
                chosen_type, action = self._move_card(state)
                self.assertEqual(card_type, chosen_type)
                self.assertNotIn("target_player_id", action)
                self.assertNotIn("your_card_id", action)
                _, error = CriminalDanceGame.apply_action(state, "p1", action)
                self.assertIsNone(error)
                self.assertEqual([{"id": "p1_card_0", "type": "criminal"}], state["players"]["p1"]["hand"])
                self.assertEqual(card_type, state["discard"][-1]["type"])
                self.assertIn("No effect", state["played"][-1]["result"])
                _play(state, "p1", "criminal")
                self.assertTrue(state["game_over"])
                self.assertEqual(["p1"], state["winner_ids"])

    def test_target_cards_cannot_skip_effect_or_target_empty_player_when_target_exists(self):
        for card_type in ("dog", "witness", "trade"):
            for target in (None, "p3"):
                with self.subTest(card_type=card_type, target=target):
                    state = _state([["criminal", card_type], ["civilian"], []])
                    before = deepcopy(state)
                    action = {"type": "play_card", "card_id": "p1_card_1"}
                    if target:
                        action["target_player_id"] = target
                    events, error = CriminalDanceGame.apply_action(state, "p1", action)
                    self.assertIsNotNone(error)
                    self.assertEqual([], events)
                    self.assertEqual(before, state)

    def test_seed_929_no_target_endgame_completes(self):
        random.seed(929)
        players = _players(3)
        for player in players:
            player["is_bot"] = True
        state = CriminalDanceGame.init_game({
            "scoring_enabled": False, "dog_fail_behavior": "give_to_target",
            "detective_activation_rule": "always", "boy_visibility_mode": "mutual",
        }, players)
        state["round_number"] = 2
        for _ in range(80):
            if state["game_over"]:
                break
            actor = state["current_player_id"]
            action = CriminalDanceGame.bot_move(state, actor)
            self.assertIsNotNone(action)
            _, error = CriminalDanceGame.apply_action(state, actor, action)
            self.assertIsNone(error)
        self.assertTrue(state["game_over"])

    def test_complete_rounds_across_player_counts_and_rules(self):
        for player_count in range(3, 9):
            for seed in range(18):
                with self.subTest(players=player_count, seed=seed):
                    random.seed(seed)
                    players = _players(player_count)
                    for player in players:
                        player["is_bot"] = True
                    state = CriminalDanceGame.init_game({
                        "scoring_enabled": False,
                        "detective_activation_rule": ("hand_leq_3", "round_ge_2", "always")[seed % 3],
                        "dog_fail_behavior": "give_to_target" if seed % 2 else "discard",
                        "enable_boy": seed % 4 != 0,
                        "enable_chief": seed % 4 == 0,
                        "boy_visibility_mode": "mutual" if seed % 2 else "boy_knows_criminal",
                    }, players)
                    state["round_number"] = 2 if seed % 2 else 1
                    for _ in range(160):
                        if state["game_over"]:
                            break
                        actor = state["current_player_id"]
                        knowledge = infer_knowledge(CriminalDanceGame.get_public_view(state, actor))
                        holder = next(
                            player_id for player_id, player in state["players"].items()
                            if any(card["type"] == "criminal" for card in player["hand"])
                        )
                        self.assertGreater(knowledge.criminal[holder], 0)
                        action = CriminalDanceGame.bot_move(state, actor)
                        self.assertIsNotNone(action)
                        _, error = CriminalDanceGame.apply_action(state, actor, action)
                        self.assertIsNone(error)
                    self.assertTrue(state["game_over"])
                    self.assertTrue(state["winner_ids"])

    def test_scored_matches_restart_without_retaining_old_clues(self):
        for player_count in (3, 8):
            with self.subTest(players=player_count):
                random.seed(player_count)
                players = _players(player_count)
                for player in players[1:]:
                    player["is_bot"] = True
                state = CriminalDanceGame.init_game({}, players)
                for _ in range(800):
                    if state["match_over"]:
                        break
                    if state["game_over"]:
                        round_number = state["round_number"]
                        _, error = CriminalDanceGame.apply_action(state, "p1", {"type": "play_again"})
                        self.assertIsNone(error)
                        self.assertEqual(round_number + 1, state["round_number"])
                        self.assertTrue(all(
                            clue["turn"] == 0
                            for player in state["players"].values() for clue in player["private_clues"]
                        ))
                    else:
                        actor = state["current_player_id"]
                        action = CriminalDanceGame.bot_move(state, actor)
                        self.assertIsNotNone(action)
                        _, error = CriminalDanceGame.apply_action(state, actor, action)
                        self.assertIsNone(error)
                self.assertTrue(state["match_over"])
                self.assertGreater(state["round_number"], 1)


class CriminalDanceAiRoomTests(unittest.IsolatedAsyncioTestCase):
    async def test_bot_trade_broadcast_is_private_and_bots_finish_round(self):
        state = _state([["civilian", "civilian", "civilian"], ["trade", "criminal", "civilian"], ["civilian"]])
        state.update(current_player_id="p2", current_turn_index=1)
        state["players"]["p2"]["is_accomplice"] = True
        players = [
            app.Player("p1", "P1", 0, "human"),
            app.Player("p2", "P2", 1, None, is_bot=True),
            app.Player("p3", "P3", 2, None, is_bot=True),
        ]
        for player in players:
            state["player_meta"][player.player_id]["is_bot"] = player.is_bot
        room = app.Room("criminal-ai-test", status="in_game", game_type="criminal_dance", players=players, game_state=state)
        sio = DummySio()
        tasks = []
        create_task = asyncio.create_task

        def capture_task(coroutine):
            task = create_task(coroutine)
            tasks.append(task)
            return task

        async def search(function, *args, **kwargs):
            return function(*args, **kwargs)

        with TemporaryDirectory() as directory, patch.object(app, "sio", sio), patch.object(app, "DATA_DIR", directory), \
                patch.dict(app.ROOMS, {room.room_id: room}), patch("app._emit_bot_progress", new=AsyncMock()), \
                patch("app._run_bot_search", new=search), patch("app.asyncio.sleep", new=AsyncMock()), \
                patch("app.asyncio.create_task", side_effect=capture_task):
            await app._maybe_run_bots(room)
            self.assertEqual(1, len(tasks))
            await asyncio.wait_for(tasks[0], timeout=2)
        self.assertTrue(state["game_over"])
        self.assertEqual(["p2", "p3"], state["winner_ids"])
        self.assertFalse(room.bot_running)
        updates = [item["payload"] for item in sio.emits if item["event"] == "game:state"]
        self.assertEqual(2, len(updates))
        for update in updates:
            event = next(event for event in update["events"] if event["type"] == "bot:action")
            self.assertEqual({"type": "play_card"}, event["payload"]["action"])
            for player in update["view"]["players"][1:]:
                self.assertEqual([], player["hand"])
                self.assertEqual([], player["private_clues"])
        self.assertNotIn("p2_card_1", json.dumps(updates[0]))
        self.assertEqual(["p1"], updates[-1]["view"]["round_waiting_player_ids"])

    async def test_catalog_marks_strategic_ai(self):
        catalog = {game["game_id"]: game for game in await app.api_list_games()}
        self.assertTrue(catalog["criminal_dance"]["has_strategic_ai"])


if __name__ == "__main__":
    unittest.main()
