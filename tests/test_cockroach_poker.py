import copy
import json
import random
import unittest
from collections import Counter

from game import CockroachPokerGame, get_game
from game.cockroach_poker import KINDS, _truth_probability


class CockroachPokerTestCase(unittest.TestCase):
    def setUp(self):
        self.random_state = random.getstate()
        random.seed(202)
        self.addCleanup(random.setstate, self.random_state)

    def make_game(self, count=3):
        return CockroachPokerGame.init_game({}, [
            {"player_id": f"seat-{index}", "name": f"Player {index}", "seat": index}
            for index in range(count)
        ])

    def act(self, state, actor, action_type, **fields):
        events, error = CockroachPokerGame.apply_action(state, actor, {
            "type": action_type, "revision": state["revision"], **fields
        })
        self.assertIsNone(error)
        self.assertEqual(events, [])

    def offer(self, state, claim=None):
        sender = state["active_player"]
        receiver = next(player for player in state["turn_order"] if player != sender)
        card = state["players"][sender]["hand"][0]
        self.act(state, sender, "offer", card=card["id"], target=receiver, claim=claim or card["kind"])
        return sender, receiver, card


class CockroachPokerTests(CockroachPokerTestCase):
    def test_deck_and_registration(self):
        self.assertEqual(get_game("cockroach_poker").module, CockroachPokerGame)
        for count in range(2, 7):
            state = self.make_game(count)
            cards = state["removed"] + [card for player in state["players"].values() for card in player["hand"]]
            self.assertEqual(len({card["id"] for card in cards}), 64)
            self.assertEqual(Counter(card["kind"] for card in cards), dict.fromkeys(KINDS, 8))
            self.assertEqual(len(state["removed"]), 10 if count == 2 else 0)
            sizes = [len(player["hand"]) for player in state["players"].values()]
            self.assertLessEqual(max(sizes) - min(sizes), 1)
            self.assertEqual(state["loss_limit"], 5 if count == 2 else 4)
        for count in (1, 7):
            with self.assertRaises(ValueError):
                self.make_game(count)

    def test_all_judgments_and_public_learning(self):
        for truthful in (True, False):
            for believe in (True, False):
                state = self.make_game()
                sender = state["active_player"]
                actual = state["players"][sender]["hand"][0]["kind"]
                claim = actual if truthful else next(kind for kind in KINDS if kind != actual)
                sender, receiver, card = self.offer(state, claim)
                self.act(state, receiver, "judge", believe=believe)
                collector = sender if truthful == believe else receiver
                self.assertEqual(state["players"][collector]["collection"], [card])
                self.assertEqual(state["active_player"], collector)
                self.assertEqual(state["phase"], "review")
                self.assertEqual(state["profiles"][sender]["truth" if truthful else "lie"], 1)
                self.assertEqual(state["profiles"][receiver]["believe" if believe else "doubt"], 1)

    def test_peek_commits_to_pass_and_last_receiver_must_judge(self):
        state = self.make_game()
        sender, receiver, card = self.offer(state)
        self.act(state, receiver, "peek")
        self.assertEqual(CockroachPokerGame.get_legal_actions(state, receiver), ["pass"])
        final = next(player for player in state["turn_order"] if player not in (sender, receiver))
        self.act(state, receiver, "pass", target=final, claim=card["kind"])
        self.assertEqual(CockroachPokerGame.get_legal_actions(state, final), ["judge"])
        self.act(state, final, "judge", believe=True)
        self.assertEqual(state["last_result"]["collector"], receiver)
        self.assertEqual(state["profiles"][sender]["truth"], 1)
        self.assertEqual(state["profiles"][receiver]["truth"], 1)

    def test_private_views_and_opaque_ids(self):
        state = self.make_game(4)
        sender, receiver, card = self.offer(state)
        others = [player for player in state["turn_order"] if player != sender]
        for viewer in others + ["spectator"]:
            view = CockroachPokerGame.get_public_view(state, viewer)
            self.assertIsNone(view["pending"]["card"])
            self.assertNotIn(card["id"], json.dumps(view))
            self.assertNotIn("removed", view)
            for player in view["players"]:
                self.assertNotIn("hand", player)
            self.assertEqual(len(view["hand"]), len(state["players"].get(viewer, {}).get("hand", [])))
        self.act(state, receiver, "peek")
        self.assertEqual(CockroachPokerGame.get_public_view(state, receiver)["pending"]["card"], card)
        self.assertIsNone(CockroachPokerGame.get_public_view(state, "spectator")["pending"]["card"])
        view = CockroachPokerGame.get_public_view(state, sender)
        view["pending"]["card"]["kind"] = "fake"
        self.assertEqual(state["pending"]["card"], card)
        self.assertTrue(all(kind not in card["id"] for kind in KINDS))

    def test_invalid_actions_are_atomic_and_replay_is_rejected(self):
        state = self.make_game()
        sender, receiver, card = self.offer(state)
        bad_actions = [
            (sender, {"type": "judge", "believe": True}),
            (receiver, {"type": "judge"}),
            (receiver, {"type": "judge", "believe": "yes"}),
            (receiver, {"type": "pass", "target": sender, "claim": "rat"}),
            (receiver, {"type": "judge", "believe": True, "extra": 1}),
        ]
        for actor, fields in bad_actions:
            before = copy.deepcopy(state)
            _, error = CockroachPokerGame.apply_action(state, actor, {"revision": state["revision"], **fields})
            self.assertIsNotNone(error)
            self.assertEqual(state, before)
        stale = {"revision": state["revision"], "type": "peek"}
        self.act(state, receiver, "peek")
        before = copy.deepcopy(state)
        for action in (stale, {"type": "pass", "revision": state["revision"], "target": sender, "claim": card["kind"]}):
            self.assertIsNotNone(CockroachPokerGame.apply_action(state, receiver, action)[1])
            self.assertEqual(state, before)

    def test_every_player_must_confirm_reveal(self):
        state = self.make_game()
        _, receiver, _ = self.offer(state)
        self.act(state, receiver, "judge", believe=False)
        for actor in state["turn_order"][:-1]:
            self.act(state, actor, "continue")
            self.assertEqual(state["phase"], "review")
            self.assertEqual(CockroachPokerGame.get_legal_actions(state, actor), [])
        self.act(state, state["turn_order"][-1], "continue")
        self.assertEqual(state["phase"], "offer")
        self.assertEqual(state["round"], 2)

    def test_simultaneous_confirmations_work_but_previous_reveal_is_stale(self):
        state = self.make_game()
        _, receiver, _ = self.offer(state)
        self.act(state, receiver, "judge", believe=False)
        simultaneous = {"type": "continue", "revision": state["revision"]}
        for actor in state["turn_order"]:
            self.assertIsNone(CockroachPokerGame.apply_action(state, actor, simultaneous)[1])
        self.assertEqual(state["phase"], "offer")
        _, receiver, _ = self.offer(state)
        self.act(state, receiver, "judge", believe=False)
        self.assertIsNotNone(CockroachPokerGame.apply_action(state, state["turn_order"][0], simultaneous)[1])
        self.assertEqual(state["ready"], [])

    def test_loss_limits_and_final_confirmation(self):
        for count in (2, 3):
            state = self.make_game(count)
            sender = state["active_player"]
            card = state["players"][sender]["hand"][0]
            state["players"][sender]["collection"] = [copy.deepcopy(card) for _ in range(state["loss_limit"] - 1)]
            _, receiver, _ = self.offer(state)
            self.act(state, receiver, "judge", believe=True)
            self.assertEqual(state["phase"], "final_review")
            self.assertFalse(state["game_over"])
            self.assertEqual(state["loser"], sender)
            self.assertEqual(state["loss_reason"], "same_kind")
            self.assertEqual(set(state["winners"]), set(state["turn_order"]) - {sender})
            for actor in state["turn_order"]:
                self.act(state, actor, "confirm")
            self.assertTrue(state["game_over"])

    def test_empty_hand_only_loses_when_opening_next_exchange(self):
        for believe in (True, False):
            state = self.make_game()
            sender = state["active_player"]
            state["players"][sender]["hand"] = state["players"][sender]["hand"][:1]
            _, receiver, _ = self.offer(state)
            self.assertFalse(state["game_over"])
            self.assertEqual(state["phase"], "receive")
            self.act(state, receiver, "judge", believe=believe)
            self.assertEqual(state["phase"], "final_review" if believe else "review")
            self.assertEqual(state["loss_reason"], "empty_hand" if believe else None)

    def test_two_players_cannot_peek_and_removed_cards_stay_hidden(self):
        state = self.make_game(2)
        _, receiver, _ = self.offer(state)
        self.assertEqual(CockroachPokerGame.get_legal_actions(state, receiver), ["judge"])
        self.assertIsNone(CockroachPokerGame.get_public_view(state, receiver)["pending"]["card"])
        self.assertNotIn("removed", CockroachPokerGame.get_public_view(state, receiver))

    def test_two_player_four_of_a_kind_is_not_yet_a_loss(self):
        state = self.make_game(2)
        sender = state["active_player"]
        card = state["players"][sender]["hand"][0]
        state["players"][sender]["collection"] = [copy.deepcopy(card) for _ in range(3)]
        _, receiver, _ = self.offer(state)
        self.act(state, receiver, "judge", believe=True)
        self.assertEqual(state["phase"], "review")
        self.assertIsNone(state["loser"])

    def test_collecting_all_eight_kinds_is_not_a_loss(self):
        state = self.make_game()
        sender = state["active_player"]
        card = state["players"][sender]["hand"][0]
        state["players"][sender]["collection"] = [{"id": kind, "kind": kind} for kind in KINDS if kind != card["kind"]]
        _, receiver, _ = self.offer(state)
        self.act(state, receiver, "judge", believe=True)
        self.assertEqual(state["phase"], "review")
        self.assertEqual(len(state["players"][sender]["collection"]), 8)

    def test_every_peeker_keeps_private_knowledge_through_long_chain(self):
        state = self.make_game(6)
        sender, receiver, card = self.offer(state)
        seen = [sender]
        while True:
            legal = CockroachPokerGame.get_legal_actions(state, receiver)
            if "peek" not in legal:
                self.assertEqual(len(seen), 5)
                self.assertEqual(legal, ["judge"])
                break
            self.act(state, receiver, "peek")
            seen.append(receiver)
            for viewer in state["turn_order"]:
                visible = CockroachPokerGame.get_public_view(state, viewer)["pending"]["card"]
                self.assertEqual(visible, card if viewer in seen else None)
            target = next(player_id for player_id in state["turn_order"] if player_id not in seen)
            self.act(state, receiver, "pass", target=target, claim="rat")
            receiver = target

    def test_save_load_is_detached_and_preserves_peek(self):
        state = self.make_game()
        _, receiver, _ = self.offer(state)
        self.act(state, receiver, "peek")
        restored = CockroachPokerGame.deserialize(json.loads(json.dumps(CockroachPokerGame.serialize(state))))
        self.assertEqual(state, restored)
        restored["pending"]["card"]["kind"] = "fake"
        self.assertNotEqual(state, restored)


class CockroachPokerAITests(CockroachPokerTestCase):
    def test_bot_exploits_believers_and_doubters_differently(self):
        state = self.make_game(2)
        actor = state["active_player"]
        target = next(player_id for player_id in state["turn_order"] if player_id != actor)
        lie_counts = []
        for believes in (True, False):
            profile = state["profiles"][target]
            profile["believe"] = 200 if believes else 0
            profile["doubt"] = 0 if believes else 200
            lies = 0
            for seed in range(120):
                random.seed(seed)
                action = CockroachPokerGame.bot_move(state, actor)
                actual = next(card["kind"] for card in state["players"][actor]["hand"] if card["id"] == action["card"])
                lies += actual != action["claim"]
            lie_counts.append(lies)
        self.assertGreater(lie_counts[0], lie_counts[1] + 25)

    def test_bot_never_reads_hidden_pending_or_opponent_hands(self):
        state = self.make_game(3)
        _, receiver, _ = self.offer(state)
        altered = copy.deepcopy(state)
        altered["pending"]["card"]["kind"] = "unreadable-hidden-card"
        for player_id, player in altered["players"].items():
            if player_id != receiver:
                for card in player["hand"]:
                    card["kind"] = "unreadable-hidden-card"
        for seed in range(20):
            random.seed(seed)
            first = CockroachPokerGame.bot_move(state, receiver)
            random.seed(seed)
            second = CockroachPokerGame.bot_move(altered, receiver)
            self.assertEqual(first, second)

    def test_bot_mixes_truth_and_bluff(self):
        state = self.make_game(2)
        actor = state["active_player"]
        observed = set()
        for seed in range(60):
            random.seed(seed)
            action = CockroachPokerGame.bot_move(state, actor)
            card = next(card for card in state["players"][actor]["hand"] if card["id"] == action["card"])
            observed.add(card["kind"] == action["claim"])
        self.assertEqual(observed, {True, False})

    def test_public_card_counting_eliminates_impossible_claim(self):
        state = self.make_game()
        sender, receiver, _ = self.offer(state, "rat")
        state["players"][receiver]["hand"] = []
        state["players"][receiver]["collection"] = [{"id": str(index), "kind": "rat"} for index in range(8)]
        view = CockroachPokerGame.get_public_view(state, receiver)
        self.assertEqual(_truth_probability(view, receiver, sender, "rat"), 0)
        self.assertEqual(CockroachPokerGame.bot_move(state, receiver), {
            "revision": state["revision"], "type": "judge", "believe": False
        })

    def test_bots_finish_and_preserve_all_cards(self):
        for count in range(2, 7):
            for seed in range(3):
                random.seed(seed)
                state = self.make_game(count)
                for _ in range(3000):
                    for actor in state["turn_order"]:
                        action = CockroachPokerGame.bot_move(state, actor)
                        if action:
                            self.assertIsNone(CockroachPokerGame.apply_action(state, actor, action)[1])
                    cards = state["removed"] + [card for player in state["players"].values() for card in player["hand"] + player["collection"]]
                    if state["pending"]:
                        cards.append(state["pending"]["card"])
                    self.assertEqual(len({card["id"] for card in cards}), 64)
                    if state["game_over"]:
                        break
                self.assertTrue(state["game_over"])
                self.assertEqual(len(state["winners"]), count - 1)
