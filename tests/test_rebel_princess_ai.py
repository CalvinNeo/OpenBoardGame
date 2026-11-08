import copy
import random
import unittest
from unittest.mock import patch

from jsonschema import Draft7Validator

from game import get_game
from game.ai_metadata import STRATEGIC_AI_GAME_IDS
from game.rebel_princess import PRINCESSES, ROUND_CARDS, RebelPrincessGame, _deal_new_round, _make_card


def _card(card_id):
    suit, rank = card_id.split("-")
    return _make_card(suit, int(rank))


def _players(count):
    return [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index} for index in range(count)]


def _position(hands, trick=(), effect="once_upon_a_time", player_id="p3", **changes):
    state = RebelPrincessGame.init_game({}, _players(len(hands)))
    state.update({
        "round_card_id": effect,
        "round_cards": [effect] * 5,
        "phase": "trick",
        "current_turn": player_id,
        "current_trick": [
            {"player_id": owner, "card": _card(card_id), "order": index,
             "was_void": was_void, "face_down": False, "snow_zero": False}
            for index, (owner, card_id, was_void) in enumerate(trick)
        ],
        "lead_suit": _card(trick[0][1])["suit"] if trick else None,
        "current_required_suit": _card(trick[0][1])["suit"] if trick else None,
        "leader": trick[0][0] if trick else player_id,
        **changes,
    })
    for owner, cards in hands.items():
        state["players"][owner]["hand"] = [_card(card_id) for card_id in cards]
        state["players"][owner]["princess_used"] = True
    return state


def _round_cards(state):
    cards = []
    for player in state["players"].values():
        for key in ("hand", "won_cards", "set_aside", "pending_pass"):
            cards.extend(player.get(key, []))
        for key in ("reserved_last_card", "gift_card"):
            if player.get(key):
                cards.append(player[key])
    cards.extend(entry["card"] for entry in state["current_trick"])
    cards.extend(state.get("gift_cards", []))
    cards.extend(item["card"] for item in (state.get("sleeping_beauty") or {}).get("pool", []))
    drawn = (state.get("scheherazade") or {}).get("drawn")
    if drawn:
        cards.append(drawn)
    return sorted(card["id"] for card in cards)


class RebelPrincessAiTests(unittest.TestCase):
    def setUp(self):
        self.random_state = random.getstate()
        random.seed(80)
        self.validator = Draft7Validator(get_game("rebel_princess").action_schema)

    def tearDown(self):
        random.setstate(self.random_state)

    def assert_action(self, state, expected, player_id="p3"):
        before = copy.deepcopy(state)
        random_state = random.getstate()
        action = RebelPrincessGame.bot_move(state, player_id)
        self.assertEqual(state, before)
        self.assertEqual(random.getstate(), random_state)
        self.assertEqual(action, expected)
        self.validator.validate(action)
        _, error = RebelPrincessGame.apply_action(state, player_id, action)
        self.assertIsNone(error)
        return action

    def test_registered_as_strategic_ai(self):
        self.assertIn("rebel_princess", STRATEGIC_AI_GAME_IDS)

    def test_waits_for_own_turn_and_ignores_unknown_players(self):
        state = _position({"p0": ["queen-1"], "p1": ["queen-2"], "p2": ["queen-3"]}, player_id="p0")
        self.assertIsNone(RebelPrincessGame.bot_move(state, "unknown"))
        self.assertIsNone(RebelPrincessGame.bot_move(state, "p1"))
        state["players"]["p1"].update({"princess": "pea_princess", "princess_used": False})
        self.assertIsNone(RebelPrincessGame.bot_move(state, "p1"))
        state["game_over"] = True
        self.assertIsNone(RebelPrincessGame.bot_move(state, "p0"))

    def test_passes_frog_and_dangerous_high_cards(self):
        state = _position({"p0": [], "p1": [], "p2": [],
                           "p3": ["queen-1", "fairy-1", "pet-2", "pet-8", "prince-10", "queen-10"]}, phase="pass")
        action = RebelPrincessGame.bot_move(state, "p3")
        self.assertEqual(set(action["card_ids"]), {"pet-8", "prince-10", "queen-10"})
        self.assert_action(state, action)
        self.assertIsNone(RebelPrincessGame.bot_move(state, "p3"))

    def test_reserves_a_low_safe_card(self):
        state = _position({"p0": [], "p1": [], "p2": [], "p3": ["pet-8", "queen-10", "fairy-1"]},
                          effect="late_to_the_ball", phase="reserve_last")
        self.assert_action(state, {"type": "setup_choice", "card_id": "fairy-1"})

    def test_reveals_the_smallest_suit(self):
        state = _position({"p0": [], "p1": [], "p2": [], "p3": ["pet-8", "queen-10", "fairy-1"]},
                          effect="crystal_clear", phase="reveal_suit")
        self.assert_action(state, {"type": "setup_choice", "suit": "prince"})

    def test_blind_second_half_passes_dangerous_cards(self):
        state = _position({"p0": [], "p1": [], "p2": [],
                           "p3": ["queen-1", "fairy-1", "pet-2", "pet-8", "prince-10", "queen-10"]},
                          effect="blind_mans_bluff", phase="split_hand")
        action = RebelPrincessGame.bot_move(state, "p3")
        self.assertEqual(set(action["card_ids"]), {"pet-8", "prince-10", "queen-10"})
        self.assert_action(state, action)

    def test_discards_frog_during_card_selection_phases(self):
        for phase in ("gift", "trick_pass", "sleeping_beauty_collect"):
            with self.subTest(phase=phase):
                state = _position({"p0": ["queen-2"], "p1": ["queen-3"], "p2": ["queen-4"],
                                   "p3": ["pet-8", "queen-10", "fairy-1"]}, phase=phase)
                if phase == "sleeping_beauty_collect":
                    state["sleeping_beauty"] = {"player": "p0", "pool": []}
                self.assert_action(state, {"type": "choose_card", "card_id": "pet-8"})

    def test_follows_suit_and_sheds_highest_losing_card(self):
        state = _position({"p0": [], "p1": [], "p2": [], "p3": ["queen-2", "queen-7", "queen-10", "pet-8"]},
                          [("p0", "queen-8", False), ("p1", "fairy-10", True), ("p2", "queen-3", False)])
        self.assert_action(state, {"type": "play_card", "card_id": "queen-7"})

    def test_avoids_winning_the_frog(self):
        state = _position({"p0": [], "p1": [], "p2": [], "p3": ["pet-2", "pet-10"]},
                          [("p0", "pet-9", False), ("p1", "pet-8", False), ("p2", "pet-5", False)])
        self.assert_action(state, {"type": "play_card", "card_id": "pet-2"})

    def test_discards_frog_when_void(self):
        state = _position({"p0": [], "p1": [], "p2": [], "p3": ["pet-8", "prince-10", "fairy-1"]},
                          [("p0", "queen-3", False), ("p1", "queen-2", False), ("p2", "queen-9", False)])
        self.assert_action(state, {"type": "play_card", "card_id": "pet-8"})

    def test_unavoidable_win_sheds_high_card(self):
        state = _position({"p0": [], "p1": [], "p2": [], "p3": ["queen-9", "queen-10"]},
                          [("p0", "queen-2", False), ("p1", "pet-8", True), ("p2", "queen-3", False)])
        self.assert_action(state, {"type": "play_card", "card_id": "queen-10"})

    def test_seeks_negative_fairy_points(self):
        state = _position({"p0": [], "p1": [], "p2": [], "p3": ["fairy-2", "fairy-7"]},
                          [("p0", "fairy-5", False), ("p1", "prince-2", True), ("p2", "fairy-3", False)],
                          effect="single_fairy")
        self.assert_action(state, {"type": "play_card", "card_id": "fairy-7"})

    def test_special_winning_rules(self):
        cases = [
            ("royal_decree", ["queen-3", "queen-6"],
             [("p0", "fairy-9", False), ("p1", "pet-8", True), ("p2", "queen-4", True)], "queen-3", {}),
            ("poisoned_apple", ["pet-7", "pet-9"],
             [("p0", "queen-9", False), ("p1", "pet-8", True), ("p2", "queen-10", False)], "pet-7", {}),
            ("upside_down", ["pet-2", "pet-10"],
             [("p0", "pet-9", False), ("p1", "pet-8", False), ("p2", "pet-6", False)], "pet-10", {}),
            ("midnight_makeover", ["fairy-10", "queen-2"],
             [("p0", "queen-9", False), ("p1", "pet-8", True), ("p2", "queen-7", False)], "queen-2", {}),
            ("pass_the_bouquet", ["pet-2", "pet-10"],
             [("p0", "queen-9", False), ("p1", "pet-9", True), ("p2", "pet-8", False)], "pet-2",
             {"current_required_suit": "pet"}),
        ]
        for effect, hand, trick, expected, changes in cases:
            with self.subTest(effect=effect):
                state = _position({"p0": [], "p1": [], "p2": [], "p3": hand}, trick, effect=effect, **changes)
                self.assert_action(state, {"type": "play_card", "card_id": expected})

    def test_double_trick_sums_both_cards(self):
        trick = [("p0", "queen-5", False), ("p1", "pet-8", True), ("p2", "queen-3", False),
                 ("p3", "queen-4", False), ("p0", "queen-6", False), ("p1", "fairy-2", True),
                 ("p2", "queen-7", False)]
        state = _position({"p0": [], "p1": [], "p2": [], "p3": ["queen-2", "queen-10"]},
                          trick, effect="prince_always_rings_twice")
        self.assert_action(state, {"type": "play_card", "card_id": "queen-2"})

    def test_snow_white_avoids_penalty_and_respects_inversions(self):
        for inversions in (0, 1):
            with self.subTest(inversions=inversions):
                state = _position({"p0": [], "p1": [], "p2": [], "p3": ["queen-7", "pet-10"]},
                                  [("p0", "queen-2", False), ("p1", "pet-8", True), ("p2", "queen-3", False)],
                                  rank_inversions=inversions)
                state["players"]["p3"].update({"princess": "snow_white", "princess_used": False})
                expected = {"type": "play_card", "card_id": "queen-7"}
                if not inversions:
                    expected["use_snow_white"] = True
                self.assert_action(state, expected)

    def test_pea_princess_forces_a_higher_reply(self):
        state = _position({"p0": ["fairy-2"], "p1": ["pet-9", "prince-2"], "p2": ["pet-2", "pet-10"]},
                          [("p0", "pet-8", False)], player_id="p1")
        state["players"]["p1"].update({"princess": "pea_princess", "princess_used": False})
        state["players"]["p2"]["revealed_suit"] = "pet"
        self.assert_action(state, {"type": "play_card", "card_id": "pet-9", "use_pea_princess": True}, "p1")

    def test_mulan_replaces_a_penalty_winner(self):
        state = _position({"p0": [], "p1": [], "p2": [], "p3": ["queen-1", "prince-2"]},
                          [("p0", "queen-2", False), ("p1", "pet-8", True), ("p2", "queen-3", False),
                           ("p3", "queen-10", False)], phase="mulan")
        state["players"]["p3"].update({"princess": "mulan", "princess_used": False})
        self.assert_action(state, {"type": "use_princess", "card_id": "queen-1"})

    def test_sleeping_beauty_keeps_a_safe_card(self):
        state = _position({"p0": ["fairy-2"], "p1": ["fairy-3"], "p2": ["fairy-4"], "p3": ["fairy-5"]},
                          phase="sleeping_beauty_keep")
        state["sleeping_beauty"] = {"player": "p3", "pool": [
            {"from": f"p{index}", "card": _card(card_id)}
            for index, card_id in enumerate(["pet-8", "prince-10", "queen-10", "queen-1"])
        ]}
        self.assert_action(state, {"type": "use_princess", "keep_card_id": "queen-1"})

    def test_haggle_recovers_frog_without_duplicating_captured_cards(self):
        state = _position({"p0": ["fairy-2"], "p1": ["fairy-3"], "p2": ["fairy-4"], "p3": ["queen-10"]},
                          effect="haggle_with_the_hag", phase="haggle")
        state["players"]["p3"]["won_cards"] = [_card("pet-8"), _card("queen-9")]
        state["pending_haggle"] = {"winner": "p3", "trick_cards": [_card("pet-8")]}
        before = _round_cards(state)
        self.assert_action(state, {"type": "use_princess", "hand_card_id": "queen-10", "trick_card_id": "pet-8"})
        self.assertEqual(_round_cards(state), before)
        self.assertEqual([card["id"] for card in state["players"]["p3"]["hand"]], ["pet-8"])
        self.assertEqual([card["id"] for card in state["players"]["p3"]["won_cards"]], ["queen-9", "queen-10"])

    def test_haggle_skips_an_unprofitable_exchange(self):
        state = _position({"p0": ["fairy-2"], "p1": ["fairy-3"], "p2": ["fairy-4"], "p3": ["pet-8"]},
                          effect="haggle_with_the_hag", phase="haggle")
        state["players"]["p3"]["won_cards"] = [_card("queen-1")]
        state["pending_haggle"] = {"winner": "p3", "trick_cards": [_card("queen-1")]}
        self.assert_action(state, {"type": "skip"})

    def test_invalid_haggle_does_not_remove_a_hand_card(self):
        state = _position({"p0": [], "p1": [], "p2": [], "p3": ["queen-10"]},
                          effect="haggle_with_the_hag", phase="haggle")
        state["players"]["p3"]["won_cards"] = [_card("pet-8")]
        state["pending_haggle"] = {"winner": "p3", "trick_cards": [_card("pet-8")]}
        before = copy.deepcopy(state)
        _, error = RebelPrincessGame.apply_action(state, "p3", {
            "type": "use_princess", "hand_card_id": "queen-10", "trick_card_id": "fairy-1",
        })
        self.assertEqual(error, "invalid exchange")
        self.assertEqual(state, before)

    def test_scheherazade_accepts_only_an_improvement(self):
        for given, drawn, expected in (
            ("pet-8", "queen-1", {"type": "use_princess", "give_card_id": "pet-8"}),
            ("queen-1", "pet-8", {"type": "skip"}),
        ):
            with self.subTest(drawn=drawn):
                state = _position({"p0": [], "p1": [], "p2": [], "p3": [given]}, phase="scheherazade_decide")
                state["scheherazade"] = {"player": "p3", "target": "p0", "drawn": _card(drawn)}
                self.assert_action(state, expected)

    def test_cinderella_inverts_a_dangerous_high_hand(self):
        state = _position({"p0": ["queen-1", "queen-2"], "p1": ["queen-3", "queen-4"],
                           "p2": ["queen-5", "queen-6"], "p3": ["queen-9", "queen-10"]})
        state["players"]["p3"].update({"princess": "cinderella", "princess_used": False})
        for player in state["players"].values():
            player["revealed_suit"] = "queen"
        self.assert_action(state, {"type": "use_princess"})
        self.assertTrue(state["players"]["p3"]["princess_used"])
        self.assertEqual(RebelPrincessGame.bot_move(state, "p3")["type"], "play_card")

    def test_lead_control_abilities_can_act_before_another_players_turn(self):
        for princess in ("little_mermaid", "ice_princess"):
            with self.subTest(princess=princess):
                state = _position({"p0": ["pet-2", "fairy-10"], "p1": ["fairy-5", "fairy-7"],
                                   "p2": ["fairy-6", "fairy-8"], "p3": ["pet-10", "pet-9"]}, player_id="p0")
                state["players"]["p3"].update({"princess": princess, "princess_used": False})
                for player_id, suit in (("p0", "pet"), ("p1", "fairy"), ("p2", "fairy")):
                    state["players"][player_id]["revealed_suit"] = suit
                action = RebelPrincessGame.bot_move(state, "p3")
                self.assertEqual(action["type"], "use_princess")
                if princess == "little_mermaid":
                    self.assertNotEqual(action["suit"], "prince")
                self.assert_action(state, action)
                self.assertTrue(state["players"]["p3"]["princess_used"])
                self.assertIsNone(RebelPrincessGame.bot_move(state, "p3"))

    def test_card_exchange_abilities_are_initiated_with_a_dangerous_hand(self):
        for princess in ("sleeping_beauty", "scheherazade"):
            with self.subTest(princess=princess):
                state = _position({"p0": ["queen-2"], "p1": ["fairy-2"], "p2": ["prince-2"],
                                   "p3": ["pet-8", "queen-3"]})
                state["players"]["p3"].update({"princess": princess, "princess_used": False})
                action = RebelPrincessGame.bot_move(state, "p3")
                self.assertEqual(action["type"], "use_princess")
                if princess == "scheherazade":
                    self.assertNotEqual(action["target_player_id"], "p3")
                self.assert_action(state, action)
                self.assertEqual(state["phase"], "sleeping_beauty_collect" if princess == "sleeping_beauty" else "scheherazade_decide")

    def test_legal_cards_honor_parity_forced_leads_and_pea_constraint(self):
        cases = [
            ("odds_and_evens", ["queen-2", "queen-4", "queen-7"],
             [("p0", "queen-9", False), ("p1", "pet-8", True), ("p2", "queen-3", False)], "queen-7", {}),
            ("once_upon_a_time", ["pet-8", "queen-2"], [], "queen-2", {"forced_lead_suit": "queen"}),
            ("once_upon_a_time", ["queen-2", "queen-6"],
             [("p0", "queen-9", False), ("p1", "pet-8", True), ("p2", "queen-3", False)], "queen-6",
             {"pea_constraint": True}),
        ]
        for effect, hand, trick, expected, changes in cases:
            with self.subTest(effect=effect, changes=changes):
                state = _position({"p0": ["fairy-2"], "p1": ["fairy-3"], "p2": ["fairy-4"], "p3": hand},
                                  trick, effect=effect, **changes)
                self.assert_action(state, {"type": "play_card", "card_id": expected})

    def test_dancing_queens_accounts_for_previous_captures(self):
        state = _position({"p0": [], "p1": [], "p2": [], "p3": ["queen-4", "queen-10"]},
                          [("p0", "queen-6", False), ("p1", "fairy-5", True), ("p2", "queen-3", False)],
                          effect="dancing_queens")
        state["players"]["p3"]["won_cards"] = [_card("prince-10")]
        self.assert_action(state, {"type": "play_card", "card_id": "queen-4"})

    def test_pocahontas_hands_off_an_unwanted_lead(self):
        state = _position({"p0": ["fairy-2"], "p1": ["fairy-3"], "p2": ["fairy-4"], "p3": ["queen-10"]},
                          phase="pocahontas", pending_pocahontas="p3")
        state["players"]["p3"].update({"princess": "pocahontas", "princess_used": False})
        for player in state["players"].values():
            player["revealed_suit"] = "fairy"
        self.assert_action(state, {"type": "use_princess", "target_player_id": "p0"})

    def test_hidden_hands_and_face_down_cards_do_not_affect_decisions(self):
        state = _position({"p0": ["queen-2", "prince-2"], "p1": ["queen-3", "prince-3"],
                           "p2": ["queen-4", "prince-4"], "p3": ["queen-7", "queen-10", "pet-8"]},
                          [("p0", "queen-5", False), ("p1", "queen-6", False), ("p2", "queen-9", False)],
                          effect="masquerade_ball")
        for entry in state["current_trick"][1:]:
            entry["face_down"] = True
        changed = copy.deepcopy(state)
        changed["players"]["p0"]["hand"], changed["players"]["p2"]["hand"] = (
            changed["players"]["p2"]["hand"], changed["players"]["p0"]["hand"])
        changed["current_trick"][1]["card"], changed["current_trick"][2]["card"] = (
            changed["current_trick"][2]["card"], changed["current_trick"][1]["card"])
        self.assertEqual(RebelPrincessGame.get_public_view(state, "p3"), RebelPrincessGame.get_public_view(changed, "p3"))
        self.assertEqual(RebelPrincessGame.bot_move(state, "p3"), RebelPrincessGame.bot_move(changed, "p3"))

    def test_hidden_gifts_and_set_aside_cards_do_not_affect_decisions(self):
        for effect in ("wedding_gift", "after_party", "late_to_the_ball"):
            with self.subTest(effect=effect):
                state = _position({"p0": ["queen-2", "prince-2"], "p1": ["queen-3", "prince-3"],
                                   "p2": ["queen-4", "prince-4"], "p3": ["queen-7", "queen-10", "pet-8"]},
                                  effect=effect)
                changed = copy.deepcopy(state)
                if effect == "wedding_gift":
                    state["gift_cards"] = [_card("fairy-1")]
                    changed["gift_cards"] = [_card("fairy-10")]
                elif effect == "after_party":
                    state["players"]["p0"]["set_aside"] = [_card("fairy-1")]
                    changed["players"]["p0"]["set_aside"] = [_card("fairy-10")]
                else:
                    state["players"]["p0"]["reserved_last_card"] = _card("fairy-1")
                    changed["players"]["p0"]["reserved_last_card"] = _card("fairy-10")
                self.assertEqual(RebelPrincessGame.bot_move(state, "p3"), RebelPrincessGame.bot_move(changed, "p3"))

    def test_policy_input_does_not_expose_opponents_private_cards(self):
        state = RebelPrincessGame.init_game({}, _players(4))
        with patch("game.rebel_princess_ai.choose_action", return_value=None) as policy:
            RebelPrincessGame.bot_move(state, "p0")
        view = policy.call_args.args[0]
        self.assertNotIn("gift_cards", view)
        for player in view["players"]:
            self.assertNotIn("hand", player)
            self.assertNotIn("won_cards", player)
            self.assertNotIn("set_aside", player)
            self.assertNotIn("pending_pass", player)

    def _finish_round(self, state):
        expected_cards = _round_cards(state)
        for step in range(400):
            if state["phase"] in ("round_pause", "game_over"):
                return
            for player_id in state["turn_order"]:
                action = RebelPrincessGame.bot_move(state, player_id)
                if action:
                    self.validator.validate(action)
                    phase = state["phase"]
                    _, error = RebelPrincessGame.apply_action(state, player_id, action)
                    self.assertIsNone(error, (phase, player_id, action))
                    self.assertEqual(_round_cards(state), expected_cards, (phase, player_id, action))
                    break
            else:
                self.fail(f'No bot action in {state["phase"]}, step {step}')
        self.fail(f'Round stuck in {state["phase"]}')

    def test_every_round_finishes_for_three_to_six_players(self):
        for count in range(3, 7):
            for round_index, round_card in enumerate(ROUND_CARDS):
                with self.subTest(players=count, round=round_card["id"]):
                    random.seed(count * 100 + round_index)
                    state = RebelPrincessGame.init_game({}, _players(count))
                    for index, player in enumerate(state["players"].values()):
                        player["princess"] = PRINCESSES[(round_index + index) % len(PRINCESSES)]["id"]
                    state["round_cards"][0] = round_card["id"]
                    _deal_new_round(state, "p0", 0)
                    self._finish_round(state)
                    self.assertEqual(state["phase"], "round_pause")

    def test_full_five_round_games_finish(self):
        for count in range(3, 7):
            with self.subTest(players=count):
                random.seed(800 + count)
                state = RebelPrincessGame.init_game({}, _players(count))
                for round_index in range(5):
                    self._finish_round(state)
                    if round_index < 4:
                        for player_id in state["turn_order"]:
                            self.assert_action(state, {"type": "next_round_ready"}, player_id)
                self.assertTrue(state["game_over"])
                self.assertTrue(state["winners"])


if __name__ == "__main__":
    unittest.main()
