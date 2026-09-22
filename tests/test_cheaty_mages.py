import copy
import json
import random
import unittest
from collections import Counter

from game.cheaty_mages import CheatyMagesGame, _build_deck, _finish_round
from game.cheaty_mages_data import FIGHTERS, JUDGES, SPELLS


def players(count=3):
    return [{"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": True}
            for i in range(count)]


class CheatyMagesTest(unittest.TestCase):
    def setUp(self):
        random.seed(115)

    def scene(self, count=3, judge="tad"):
        state = CheatyMagesGame.init_game({}, players(count))
        state["deck"] = _build_deck()
        state["discard"] = []
        state["effects"] = []
        state["spell_serial"] = 0
        state["log"] = []
        state.update(phase="casting", current_turn="p0", start_player="p0")
        fighter_ids = ["goblin", "orc", "skeleton", "ghost", "dragon"]
        state["fighters"] = [dict(copy.deepcopy(FIGHTERS[key]), slot=i + 1, spells=[])
                             for i, key in enumerate(fighter_ids)]
        state["fighter_deck"] = [key for key in FIGHTERS if key not in fighter_ids]
        state["fighter_discard"] = []
        state["judge"] = copy.deepcopy(JUDGES[judge])
        state["judge_deck"] = [key for key in JUDGES if key != judge]
        state["judge_discard"] = []
        for index, (pid, player) in enumerate(state["players"].items()):
            player.update(hand=[], bets=[1], passed=False, known=[], refill_done=False)
            self.give(state, pid, "cure" if index < 4 else "magic_missile")
        return state

    def take(self, state, key):
        for index, card in enumerate(state["deck"]):
            if card["key"] == key:
                return state["deck"].pop(index)
        self.fail(f"No unused {key} in fixture")

    def give(self, state, pid, key):
        card = self.take(state, key)
        state["players"][pid]["hand"].append(card)
        return card

    def attach(self, state, slot, key, owner="p1", hidden=False):
        state["spell_serial"] += 1
        entry = {"id": f"s{state['spell_serial']}", "owner": owner, "card": self.take(state, key),
                 "hidden": hidden, "attachments": [], "bribed": False}
        state["fighters"][slot - 1]["spells"].append(entry)
        return entry

    def effect(self, state, key, owner="p0"):
        state["spell_serial"] += 1
        entry = {"id": f"s{state['spell_serial']}", "owner": owner, "card": self.take(state, key),
                 "hidden": False, "attachments": [], "target_type": "judge" if key == "confusion" else "player",
                 "target_id": state["judge"]["id"] if key == "confusion" else owner}
        state["effects"].append(entry)
        return entry

    def act(self, state, pid, kind, **kwargs):
        action = {"type": kind, "round": state["round"], **kwargs}
        if kind != "next_round":
            action["turn"] = state["turn"]
        events, error = CheatyMagesGame.apply_action(state, pid, action)
        self.assertIsNone(error, (pid, action, error))
        self.assertTrue(events)
        return action

    def cast(self, state, key, pid="p0", **kwargs):
        card = self.give(state, pid, key)
        state["current_turn"] = pid
        self.act(state, pid, "cast", card_id=card["id"], **kwargs)
        return card

    def moves(self, state, pid="p0", kind=None):
        moves = CheatyMagesGame.get_public_view(state, pid)["legal_moves"]
        return [move for move in moves if kind is None or move["type"] == kind]

    def assert_rejected(self, state, pid, action):
        before = copy.deepcopy(state)
        events, error = CheatyMagesGame.apply_action(state, pid, action)
        self.assertIsNotNone(error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def assert_conserved(self, state):
        cards = state["deck"] + state["discard"]
        cards += [card for player in state["players"].values() for card in player["hand"]]
        cards += [entry["card"] for fighter in state["fighters"] for entry in fighter["spells"]]
        cards += [entry["card"] for entry in state["effects"]]
        self.assertEqual(len(cards), 72)
        self.assertEqual(len({card["id"] for card in cards}), 72)
        self.assertEqual(Counter(card["key"] for card in cards),
                         Counter({key: card["count"] for key, card in SPELLS.items()}))
        fighter_ids = [fighter["id"] for fighter in state["fighters"]]
        fighter_ids += state["fighter_deck"] + state["fighter_discard"]
        self.assertEqual(Counter(fighter_ids), Counter(FIGHTERS.keys()))
        judges = [state["judge"]["id"]] + state["judge_deck"] + state["judge_discard"]
        # During refill the outgoing judge is recorded until the next one is drawn.
        if state["phase"] == "refill":
            judges.remove(state["judge"]["id"])
        self.assertEqual(Counter(judges), Counter(JUDGES.keys()))

    def acknowledge_all(self, state):
        for pid in state["turn_order"]:
            self.act(state, pid, "next_round")

    def test_inventory_matches_classic_component_counts(self):
        self.assertEqual((len(SPELLS), sum(card["count"] for card in SPELLS.values())), (36, 72))
        self.assertEqual((len(FIGHTERS), len(JUDGES)), (10, 8))
        self.assertEqual({card["power"] for card in FIGHTERS.values()}, set(range(1, 11)))
        self.assertEqual({key for key, card in FIGHTERS.items() if card["reverse"]}, {"skeleton", "ghost"})
        self.assertEqual(Counter(card["kind"] for card in _build_deck()),
                         {"direct": 24, "enchant": 31, "support": 17})
        for card in list(SPELLS.values()) + list(FIGHTERS.values()) + list(JUDGES.values()):
            for key in ("id", "name", "name_zh", "icon", "description"):
                self.assertTrue(card[key])

    def test_initial_hands_coins_and_conservation_for_all_player_counts(self):
        for count, size in ((3, 8), (4, 8), (5, 6), (6, 5)):
            with self.subTest(count=count):
                state = CheatyMagesGame.init_game(None, players(count))
                self.assertTrue(all(len(player["hand"]) == size and player["coins"] == 2
                                    for player in state["players"].values()))
                self.assertEqual(state["phase"], "betting")
                self.assertEqual(len(self.moves(state, state["current_turn"])), 25)
                self.assert_conserved(state)

    def test_invalid_configuration_and_players_are_rejected(self):
        for config in ({"unknown": True}, [], False, "settings"):
            with self.subTest(config=config), self.assertRaises(ValueError):
                CheatyMagesGame.init_game(config, players())
        for count in (0, 2, 7):
            with self.subTest(count=count), self.assertRaises(ValueError):
                CheatyMagesGame.init_game({}, players(count))
        for ids in (["p0", "p0", "p2"], ["p0", "", "p2"]):
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                CheatyMagesGame.init_game({}, [{"player_id": pid, "seat": i} for i, pid in enumerate(ids)])

    def test_betting_is_private_ordered_and_requires_one_to_three_unique_slots(self):
        state = CheatyMagesGame.init_game({}, players())
        starter = state["current_turn"]
        self.act(state, starter, "bet", slots=[3, 1])
        other = state["current_turn"]
        for viewer in (other, "spectator"):
            view = CheatyMagesGame.get_public_view(state, viewer)
            row = next(player for player in view["players"] if player["player_id"] == starter)
            self.assertEqual(row["bet_count"], 2)
            self.assertIsNone(row["bets"])
        self.assertEqual(CheatyMagesGame.get_public_view(state, starter)["your_bets"], [1, 3])
        self.act(state, other, "bet", slots=[2])
        self.act(state, state["current_turn"], "bet", slots=[1, 2, 3])
        self.assertEqual((state["phase"], state["current_turn"]), ("casting", starter))

    def test_invalid_actions_never_mutate_state(self):
        state = CheatyMagesGame.init_game({}, players())
        pid = state["current_turn"]
        base = {"type": "bet", "round": 1, "turn": 1, "slots": [1]}
        bad = [None, [], {}, {**base, "slots": []}, {**base, "slots": [1, 1]},
               {**base, "slots": [1, 2, 3, 4]}, {**base, "slots": [6]},
               {**base, "slots": [True]}, {**base, "round": True},
               {**base, "turn": 0}, {**base, "turn": 2}, {**base, "round": 2},
               {**base, "extra": 1}, {key: value for key, value in base.items() if key != "turn"}]
        for action in bad:
            with self.subTest(action=action):
                self.assert_rejected(state, pid, action)
        self.assert_rejected(state, "spectator", base)
        wrong_player = next(other for other in state["turn_order"] if other != pid)
        self.assert_rejected(state, wrong_player, base)
        self.act(state, pid, "bet", slots=[1])
        self.assert_rejected(state, pid, base)

    def test_each_numeric_spell_has_correct_visibility_and_strength(self):
        for key, card in SPELLS.items():
            if card["effect"] != "power":
                continue
            with self.subTest(key=key):
                state = self.scene()
                self.cast(state, key, target=1)
                entry = state["fighters"][0]["spells"][0]
                self.assertEqual(entry["hidden"], card["kind"] == "enchant")
                _finish_round(state)
                result = state["round_summary"]["fighters"][0]
                self.assertEqual(result["power"], 1 + card["power"])
                self.assertEqual(result["mana"], card["mana"])
                self.assert_conserved(state)

    def test_hidden_spell_identity_totals_hand_and_bet_are_private(self):
        state = self.scene()
        card = self.cast(state, "giant_growth", target=1)
        owner = CheatyMagesGame.get_public_view(state, "p0")
        self.assertEqual(owner["fighters"][0]["known_power"], 13)
        for viewer in ("p1", "p2", "spectator"):
            view = CheatyMagesGame.get_public_view(state, viewer)
            fighter = view["fighters"][0]
            self.assertIsNone(fighter["spells"][0]["card"])
            self.assertEqual((fighter["known_power"], fighter["known_mana"], fighter["hidden_count"]), (1, 0, 1))
            self.assertNotIn(card["id"], json.dumps(view, ensure_ascii=False))
            self.assertNotIn(card["name_zh"], json.dumps(view["log"], ensure_ascii=False))
        spectator = CheatyMagesGame.get_public_view(state, "spectator")
        self.assertEqual((spectator["your_hand"], spectator["your_bets"], spectator["legal_moves"]), ([], [], []))

    def test_detect_magic_reveals_only_to_caster_and_only_existing_spells(self):
        state = self.scene()
        first = self.attach(state, 1, "strengthen", hidden=True)
        self.cast(state, "detect_magic", target=1)
        second = self.attach(state, 1, "weaken", owner="p2", hidden=True)
        self.assertIn(first["id"], state["players"]["p0"]["known"])
        self.assertNotIn(second["id"], state["players"]["p0"]["known"])
        view = CheatyMagesGame.get_public_view(state, "p0")
        self.assertIsNotNone(view["fighters"][0]["spells"][0]["card"])
        self.assertIsNone(view["fighters"][0]["spells"][1]["card"])
        self.assertIsNone(CheatyMagesGame.get_public_view(state, "spectator")["fighters"][0]["spells"][0]["card"])

    def test_discard_peek_works_under_spell_ban_and_reflection(self):
        state = self.scene(judge="adoth")
        self.attach(state, 1, "weaken", hidden=True)
        self.attach(state, 1, "reflection")
        card = self.give(state, "p0", "detect_magic")
        self.assertFalse(any(move.get("card_id") == card["id"] for move in self.moves(state, kind="cast")))
        self.act(state, "p0", "peek", card_id=card["id"], target=1)
        self.assertEqual(len(state["players"]["p0"]["known"]), 1)
        self.assertIn(card, state["discard"])
        self.assert_conserved(state)

    def test_pass_is_permanent_and_last_active_player_can_take_multiple_turns(self):
        state = self.scene()
        self.act(state, "p0", "pass")
        self.act(state, "p1", "pass")
        self.assertEqual(self.moves(state, "p0"), [])
        card = self.give(state, "p2", "healing")
        self.act(state, "p2", "cast", card_id=card["id"], target=1)
        self.assertEqual(state["current_turn"], "p2")
        self.act(state, "p2", "pass")
        self.assertEqual(state["phase"], "round_end")

    def test_dispel_exposes_removed_hidden_spell_and_can_remove_player_effect(self):
        state = self.scene()
        hidden = self.attach(state, 1, "strengthen", hidden=True)
        self.cast(state, "dispel_magic", spell_id=hidden["id"])
        self.assertEqual(state["fighters"][0]["spells"], [])
        self.assertIn(hidden["card"], CheatyMagesGame.get_public_view(state, "spectator")["discard"])
        effect = self.effect(state, "invisibility", "p1")
        self.cast(state, "dispel_magic", spell_id=effect["id"])
        self.assertEqual(state["effects"], [])
        self.assert_conserved(state)

    def test_recall_draws_one_and_cannot_recycle_itself_from_empty_pile(self):
        state = self.scene()
        card = self.give(state, "p0", "recall")
        expected = state["deck"][-1]["id"]
        before = len(state["players"]["p0"]["hand"])
        self.act(state, "p0", "cast", card_id=card["id"])
        self.assertEqual(len(state["players"]["p0"]["hand"]), before)
        self.assertIn(expected, [card["id"] for card in state["players"]["p0"]["hand"]])
        self.assertIn(card, state["discard"])
        self.assert_conserved(state)
        state = self.scene()
        card = self.give(state, "p0", "recall")
        state["players"]["p1"]["hand"].extend(state["deck"])
        state["deck"] = []
        self.act(state, "p0", "cast", card_id=card["id"])
        self.assertNotIn(card, state["players"]["p0"]["hand"])
        self.assertEqual(state["discard"], [card])
        self.assert_conserved(state)

    def test_amnesia_waits_for_target_selection_and_resumes_after_caster(self):
        state = self.scene()
        chosen = self.give(state, "p2", "meteor_strike")
        self.cast(state, "amnesia", player_id="p2")
        self.assertEqual((state["phase"], state["current_turn"]), ("discarding", "p2"))
        self.assertEqual(self.moves(state, "p0"), [])
        self.act(state, "p2", "discard", cards=[chosen["id"]])
        self.assertEqual((state["phase"], state["current_turn"]), ("casting", "p1"))
        self.assertIn(chosen, state["discard"])
        self.assert_conserved(state)

    def test_amnesia_can_target_self_only_with_another_card_to_discard(self):
        state = self.scene()
        card = self.give(state, "p0", "amnesia")
        own_cure = state["players"]["p0"]["hand"][0]
        self.act(state, "p0", "cast", card_id=card["id"], player_id="p0")
        self.act(state, "p0", "discard", cards=[own_cure["id"]])
        self.assertEqual(state["current_turn"], "p1")
        state = self.scene()
        card = self.give(state, "p0", "amnesia")
        other = state["players"]["p0"]["hand"].pop(0)
        state["discard"].append(other)
        self.assertFalse(any(move.get("player_id") == "p0" for move in self.moves(state, kind="cast")))

    def test_imitation_swaps_one_private_bet_and_is_unavailable_for_single_bet(self):
        state = self.scene()
        state["players"]["p0"]["bets"] = [1, 3]
        self.cast(state, "imitation", from_slot=3, to_slot=5)
        self.assertEqual(state["players"]["p0"]["bets"], [1, 5])
        self.assertIsNone(CheatyMagesGame.get_public_view(state, "p1")["players"][0]["bets"])
        state = self.scene()
        card = self.give(state, "p0", "imitation")
        self.assertFalse(any(move.get("card_id") == card["id"] for move in self.moves(state, kind="cast")))

    def test_dimension_door_discards_old_judge_confusion_but_preserves_player_effect(self):
        state = self.scene()
        confusion = self.effect(state, "confusion")
        invisibility = self.effect(state, "invisibility")
        old_judge = state["judge"]["id"]
        expected = state["judge_deck"][-1]
        self.cast(state, "dimension_door")
        self.assertEqual(state["judge"]["id"], expected)
        self.assertIn(old_judge, state["judge_discard"])
        self.assertIn(confusion["card"], state["discard"])
        self.assertIn(invisibility, state["effects"])
        self.assert_conserved(state)

    def test_confusion_skips_all_judgments_but_not_casting_bans(self):
        state = self.scene(judge="lester")
        self.attach(state, 1, "giant_growth")
        self.attach(state, 1, "power_awakening")
        self.attach(state, 2, "healing")
        self.cast(state, "confusion")
        _finish_round(state)
        self.assertTrue(state["round_summary"]["judge"]["ignored"])
        self.assertTrue(all(result["verdict"] is None for result in state["round_summary"]["fighters"]))
        state = self.scene(judge="orlair")
        self.effect(state, "confusion")
        card = self.give(state, "p0", "healing")
        self.assertFalse(any(move.get("card_id") == card["id"] for move in self.moves(state, kind="cast")))

    def test_invisibility_bypasses_bans_for_owner_only_and_dispel_revokes_future_permission(self):
        state = self.scene(judge="zapp")
        self.cast(state, "invisibility")
        self.assertEqual(state["current_turn"], "p1")
        card = self.give(state, "p1", "meteor_strike")
        self.assertFalse(any(move.get("card_id") == card["id"] for move in self.moves(state, "p1", "cast")))
        self.cast(state, "refresh", target=1)
        protected_card = state["fighters"][0]["spells"][0]
        effect = state["effects"][0]
        self.cast(state, "dispel_magic", pid="p1", spell_id=effect["id"])
        self.assertIn(protected_card, state["fighters"][0]["spells"])
        state["current_turn"] = "p0"
        card = self.give(state, "p0", "giant_growth")
        self.assertFalse(any(move.get("card_id") == card["id"] for move in self.moves(state, kind="cast")))

    def test_prismatic_allows_optional_hidden_direct_without_changing_type_or_bans(self):
        state = self.scene()
        self.cast(state, "prismatic_ray")
        self.assertEqual(state["current_turn"], "p1")
        self.cast(state, "healing", target=1)
        self.cast(state, "fireball", target=2, face_down=True)
        self.assertFalse(state["fighters"][0]["spells"][0]["hidden"])
        self.assertTrue(state["fighters"][1]["spells"][0]["hidden"])
        self.assertEqual(state["fighters"][1]["spells"][0]["card"]["kind"], "direct")
        state["judge"] = copy.deepcopy(JUDGES["orlair"])
        state["current_turn"] = "p0"
        card = self.give(state, "p0", "healing")
        self.assertFalse(any(move.get("card_id") == card["id"] for move in self.moves(state, kind="cast")))

    def test_metamorphosis_preserves_slot_spells_and_bets_but_changes_fighter(self):
        state = self.scene()
        old = state["fighters"][0]["id"]
        expected = state["fighter_deck"][-1]
        spell = self.attach(state, 1, "strengthen", hidden=True)
        self.cast(state, "metamorphosis", target=1)
        fighter = state["fighters"][0]
        self.assertEqual((fighter["id"], fighter["slot"], fighter["spells"]), (expected, 1, [spell]))
        self.assertEqual(state["players"]["p0"]["bets"], [1])
        self.assertIn(old, state["fighter_discard"])
        self.assert_conserved(state)

    def test_alteration_preserves_hidden_identity_owner_and_peek_knowledge(self):
        state = self.scene()
        entry = self.attach(state, 1, "strengthen", hidden=True)
        state["players"]["p2"]["known"].append(entry["id"])
        self.cast(state, "alteration", spell_id=entry["id"], target=2)
        self.assertEqual(state["fighters"][0]["spells"], [])
        self.assertEqual(state["fighters"][1]["spells"], [entry])
        self.assertTrue(entry["hidden"])
        self.assertEqual(entry["owner"], "p1")
        self.assertIsNotNone(CheatyMagesGame.get_public_view(state, "p2")["fighters"][1]["spells"][0]["card"])
        self.assertIsNone(CheatyMagesGame.get_public_view(state, "p0")["fighters"][1]["spells"][0]["card"])
        self.assert_conserved(state)

    def test_reflection_is_face_up_and_protects_everything_except_itself(self):
        state = self.scene()
        original = self.attach(state, 1, "strengthen", hidden=True)
        self.cast(state, "reflection", target=1)
        reflection = state["fighters"][0]["spells"][1]
        self.assertFalse(reflection["hidden"])
        for key in ("healing", "detect_magic", "metamorphosis", "dispel_magic", "alteration"):
            self.give(state, "p0", key)
        state["current_turn"] = "p0"
        moves = self.moves(state, kind="cast")
        self.assertFalse(any(move.get("target") == 1 for move in moves))
        self.assertFalse(any(move.get("spell_id") == original["id"] for move in moves))
        self.assertTrue(any(move.get("spell_id") == reflection["id"] for move in moves))
        self.act(state, "p0", "cast", **{key: value for key, value in next(
            move for move in moves if move.get("spell_id") == reflection["id"] and "target" not in move
        ).items() if key not in ("type", "round", "turn")})
        self.assertEqual(state["fighters"][0]["spells"], [original])

    def test_anti_magic_field_removes_reflection_and_all_other_spells(self):
        state = self.scene()
        one = self.attach(state, 1, "strengthen", hidden=True)
        two = self.attach(state, 1, "reflection")
        self.cast(state, "anti_magic_field", target=1)
        self.assertEqual(state["fighters"][0]["spells"], [])
        self.assertIn(one["card"], state["discard"])
        self.assertIn(two["card"], state["discard"])
        self.assert_conserved(state)

    def test_mana_boost_seal_negative_mana_and_undead_power_inversion(self):
        state = self.scene()
        for key in ("healing", "magic_missile", "paralyze", "mana_seal"):
            self.attach(state, 3, key)
        self.attach(state, 1, "mana_seal")
        self.attach(state, 2, "mana_boost")
        _finish_round(state)
        results = state["round_summary"]["fighters"]
        self.assertEqual((results[0]["mana"], results[0]["power"]), (-5, 1))
        self.assertEqual((results[1]["mana"], results[1]["power"]), (5, 2))
        self.assertEqual((results[2]["mana"], results[2]["power"]), (4, 9))

    def test_prize_doubling_stacks_before_bet_multiplier_and_triple_bet_rounds_up(self):
        for double_count, expected in ((0, [10, 5, 3]), (1, [20, 10, 5]), (2, [40, 20, 10])):
            with self.subTest(double_count=double_count):
                state = self.scene()
                self.attach(state, 4, "meteor_strike")  # Undead Ghost gains ten power.
                for _ in range(double_count):
                    self.attach(state, 4, "cause_unpopularity")
                for pid, bets in zip(state["turn_order"], ([4], [1, 4], [1, 2, 4])):
                    state["players"][pid]["bets"] = list(bets)
                _finish_round(state)
                self.assertEqual(state["round_summary"]["winner_slot"], 4)
                self.assertEqual([row["amount"] for row in state["round_summary"]["earnings"]], expected)

    def test_all_judge_bans_and_foul_play_permissions(self):
        for judge in JUDGES:
            with self.subTest(judge=judge):
                state = self.scene(judge=judge)
                cards = [self.give(state, "p0", key) for key in ("healing", "refresh", "recall", "metamorphosis")]
                for card in cards:
                    banned = card["kind"] in JUDGES[judge]["bans"] or (card["forbidden"] and "forbidden" in JUDGES[judge]["bans"])
                    self.assertEqual(any(move.get("card_id") == card["id"] for move in self.moves(state, kind="cast")), not banned)
                state["round"] = state["total_rounds"]
                for card in cards:
                    available = [move for move in self.moves(state, kind="cast") if move.get("card_id") == card["id"]]
                    self.assertTrue(available)
                    banned = card["kind"] in JUDGES[judge]["bans"] or (card["forbidden"] and "forbidden" in JUDGES[judge]["bans"])
                    self.assertEqual(all(move.get("bribe", False) for move in available), banned)

    def test_bribe_costs_exactly_two_and_unpaid_or_unaffordable_cast_is_rejected(self):
        state = self.scene(judge="adoth")
        state["round"] = state["total_rounds"]
        card = self.give(state, "p0", "giant_growth")
        action = {"type": "cast", "round": state["round"], "turn": state["turn"], "card_id": card["id"], "target": 1}
        self.assert_rejected(state, "p0", action)
        self.act(state, "p0", "cast", card_id=card["id"], target=1, bribe=True)
        self.assertEqual(state["players"]["p0"]["coins"], 0)
        self.assertTrue(state["fighters"][0]["spells"][0]["bribed"])
        state["current_turn"] = "p0"
        second = self.give(state, "p0", "refresh")
        self.assertFalse(any(move.get("card_id") == second["id"] for move in self.moves(state, kind="cast")))

    def test_judge_limit_is_strict_and_dispel_restores_base_power_and_prize(self):
        for judge, expected in (("lawty", "dispel"), ("adoth", "eject")):
            with self.subTest(judge=judge):
                state = self.scene(judge=judge)
                self.attach(state, 1, "giant_growth")  # Exactly ten is allowed.
                self.attach(state, 2, "shrink")
                self.attach(state, 2, "cause_unpopularity")  # Thirteen is punished.
                _finish_round(state)
                first, second = state["round_summary"]["fighters"][:2]
                self.assertIsNone(first["verdict"])
                self.assertEqual(second["verdict"], expected)
                if expected == "dispel":
                    self.assertEqual((second["power"], second["prize"]), (2, 8))

    def test_every_fixed_judge_uses_its_own_exact_mana_boundary(self):
        exact_cards = {10: ["giant_growth"], 12: ["power_awakening", "might"],
                       15: ["giant_growth", "mana_boost"]}
        for judge_id, judge in JUDGES.items():
            if judge["limit"] is None:
                continue
            for excessive in (False, True):
                with self.subTest(judge=judge_id, excessive=excessive):
                    state = self.scene(judge=judge_id)
                    for key in exact_cards[judge["limit"]]:
                        self.attach(state, 1, key)
                    if excessive:
                        self.attach(state, 1, "healing")
                    _finish_round(state)
                    result = state["round_summary"]["fighters"][0]
                    self.assertEqual(result["mana"], judge["limit"] + int(excessive))
                    self.assertEqual(result["verdict"], judge["verdict"] if excessive else None)
        state = self.scene(judge="tad")
        for key in ("giant_growth", "shrink", "power_awakening", "paralyze"):
            self.attach(state, 1, key)
        _finish_round(state)
        self.assertIsNone(state["round_summary"]["fighters"][0]["verdict"])

    def test_casting_invalid_targets_private_ids_and_replays_do_not_mutate_state(self):
        state = self.scene()
        card = self.give(state, "p0", "healing")
        base = {"type": "cast", "round": state["round"], "turn": state["turn"],
                "card_id": card["id"], "target": 1}
        for changes in ({"target": 0}, {"target": 6}, {"target": True},
                        {"card_id": "missing"}, {"card_id": state["players"]["p1"]["hand"][0]["id"]},
                        {"spell_id": "private-target"}, {"player_id": "p2"},
                        {"bribe": True}, {"bribe": 1}, {"face_down": True}, {"turn": 0}):
            with self.subTest(changes=changes):
                self.assert_rejected(state, "p0", {**base, **changes})
        self.act(state, "p0", "cast", card_id=card["id"], target=1)
        self.assert_rejected(state, "p0", base)

    def test_recall_recycles_existing_discard_without_duplicating_cards(self):
        state = self.scene()
        recall = self.give(state, "p0", "recall")
        discarded = self.take(state, "healing")
        state["discard"].append(discarded)
        state["players"]["p1"]["hand"].extend(state["deck"])
        state["deck"] = []
        self.act(state, "p0", "cast", card_id=recall["id"])
        self.assertIn(discarded, state["players"]["p0"]["hand"])
        self.assertEqual(state["discard"], [recall])
        self.assert_conserved(state)

    def test_lester_dispels_at_four_and_ejects_over_fifteen(self):
        state = self.scene(judge="lester")
        self.attach(state, 1, "might")
        self.attach(state, 2, "mana_boost")
        self.attach(state, 3, "giant_growth")
        self.attach(state, 3, "haste")
        _finish_round(state)
        verdicts = [fighter["verdict"] for fighter in state["round_summary"]["fighters"]]
        self.assertEqual(verdicts, ["dispel", None, "eject", "dispel", "dispel"])

    def test_ferine_uses_one_revealed_spell_for_all_fighters_then_discards_it(self):
        for key, limit, verdict in (("healing", 10, "eject"), ("might", 15, "dispel"), ("recall", 5, "dispel")):
            with self.subTest(key=key):
                state = self.scene(judge="ferine")
                card = self.take(state, key)
                state["deck"].append(card)
                _finish_round(state)
                resolved = state["round_summary"]["judge"]
                self.assertEqual((resolved["limit"], resolved["verdict"]), (limit, verdict))
                self.assertEqual(resolved["drawn_card"]["id"], card["id"])
                self.assertIn(card, state["discard"])
                self.assert_conserved(state)

    def test_tied_final_power_uses_higher_printed_power(self):
        state = self.scene()
        self.attach(state, 1, "strengthen")
        self.attach(state, 1, "energy_boost")  # Goblin totals ten, tied with Dragon.
        _finish_round(state)
        self.assertEqual(state["round_summary"]["winner_slot"], 5)

    def test_round_end_reveals_all_and_requires_every_player_to_acknowledge(self):
        state = self.scene()
        self.attach(state, 1, "strengthen", hidden=True)
        _finish_round(state)
        view = CheatyMagesGame.get_public_view(state, "spectator")
        self.assertIsNotNone(view["fighters"][0]["spells"][0]["card"])
        self.assertTrue(all(player["bets"] is not None for player in view["players"]))
        summary = copy.deepcopy(state["round_summary"])
        self.act(state, "p2", "next_round")
        self.act(state, "p0", "next_round")
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["round_summary"], summary)
        self.assert_rejected(state, "p0", {"type": "next_round", "round": 1})
        self.assert_rejected(state, "spectator", {"type": "next_round", "round": 1})
        self.act(state, "p1", "next_round")
        self.assertEqual(state["phase"], "refill")
        self.assertTrue(all(not fighter["spells"] for fighter in state["fighters"]))
        self.assert_conserved(state)

    def test_all_fighters_ejected_extends_match_without_paying_anyone(self):
        state = self.scene(judge="adoth")
        combos = [("giant_growth", "healing"), ("shrink", "fireball"),
                  ("power_awakening", "might"), ("paralyze", "cripple"), ("haste", "slow")]
        for slot, keys in enumerate(combos, 1):
            for key in keys:
                self.attach(state, slot, key)
        _finish_round(state)
        self.assertEqual((state["round"], state["total_rounds"]), (1, 4))
        self.assertTrue(state["round_summary"]["cancelled"])
        self.assertIsNone(state["round_summary"]["winner_slot"])
        self.assertTrue(all(player["coins"] == 2 for player in state["players"].values()))
        self.acknowledge_all(state)
        while state["phase"] == "refill":
            self.act(state, state["current_turn"], "discard", cards=[])
        self.assertEqual((state["round"], state["total_rounds"], state["phase"]), (2, 4, "betting"))
        self.assert_conserved(state)

    def test_refill_uses_discard_before_draw_caps_and_richest_next_starter(self):
        for count, replenish, limit in ((3, 4, 8), (4, 4, 8), (5, 3, 6), (6, 3, 6)):
            with self.subTest(count=count):
                state = CheatyMagesGame.init_game({}, players(count))
                state.update(phase="casting", current_turn="p0", start_player="p0")
                for player in state["players"].values():
                    player["bets"] = [1]
                state["players"]["p1"]["coins"] = 100
                _finish_round(state)
                self.acknowledge_all(state)
                discarded = [card["id"] for card in state["players"]["p0"]["hand"][:2]]
                starting = len(state["players"]["p0"]["hand"])
                self.act(state, "p0", "discard", cards=discarded)
                self.assertEqual(len(state["players"]["p0"]["hand"]), min(starting - 2 + replenish, limit))
                while state["phase"] == "refill":
                    self.act(state, state["current_turn"], "discard", cards=[])
                self.assertEqual(state["current_turn"], "p1")
                self.assertEqual(state["round"], 2)
                self.assertTrue(all(len(player["hand"]) <= limit for player in state["players"].values()))
                self.assert_conserved(state)

    def test_final_round_waits_for_acknowledgment_then_uses_coins_and_remaining_hand(self):
        state = self.scene()
        state["round"] = 3
        state["players"]["p0"]["coins"] = 10
        state["players"]["p1"]["coins"] = 10
        state["players"]["p2"]["coins"] = 9
        self.give(state, "p1", "healing")
        self.give(state, "p2", "fireball")
        _finish_round(state)
        self.assertFalse(state["game_over"])
        before_hands = {pid: copy.deepcopy(player["hand"]) for pid, player in state["players"].items()}
        self.acknowledge_all(state)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p1"])
        self.assertEqual({pid: player["hand"] for pid, player in state["players"].items()}, before_hands)
        self.assertEqual(self.moves(state), [])
        state = self.scene()
        state["round"] = 3
        _finish_round(state)
        self.acknowledge_all(state)
        self.assertEqual(state["winner"], ["p0", "p1", "p2"])

    def test_public_views_and_serialization_are_independent_deep_copies(self):
        state = self.scene()
        self.attach(state, 1, "strengthen", hidden=True)
        self.effect(state, "invisibility")
        before = copy.deepcopy(state)
        view = CheatyMagesGame.get_public_view(state, "p0")
        view["players"][0]["coins"] = 999
        view["your_hand"][0]["power"] = 999
        view["effects"][0]["card"]["name"] = "changed"
        view["fighters"][0]["spells"].clear()
        serialized = CheatyMagesGame.serialize(state)
        restored = CheatyMagesGame.deserialize(serialized)
        self.assertEqual(restored, state)
        serialized["players"]["p0"]["hand"].clear()
        restored["deck"].clear()
        self.assertEqual(state, before)

    def test_bot_only_uses_public_information(self):
        state = self.scene()
        self.attach(state, 1, "strengthen", owner="p1", hidden=True)
        private_variant = copy.deepcopy(state)
        entry = private_variant["fighters"][0]["spells"][0]
        entry["card"] = dict(entry["card"], **SPELLS["shrink"])
        private_variant["players"]["p1"]["bets"] = [2, 3, 5]
        private_variant["players"]["p1"]["hand"][0]["power"] = 999
        # Public bet count must remain unchanged for an identical information set.
        private_variant["players"]["p1"]["bets"] = [5]
        self.assertEqual(CheatyMagesGame.get_public_view(state, "p0"),
                         CheatyMagesGame.get_public_view(private_variant, "p0"))
        self.assertEqual(CheatyMagesGame.bot_move(state, "p0"), CheatyMagesGame.bot_move(private_variant, "p0"))

    def test_bots_complete_three_to_six_player_games_with_conservation(self):
        for count in range(3, 7):
            for seed in range(4):
                with self.subTest(count=count, seed=seed):
                    random.seed(seed)
                    state = CheatyMagesGame.init_game({}, players(count))
                    for step in range(1200):
                        self.assert_conserved(state)
                        if state["game_over"]:
                            break
                        if state["phase"] == "round_end":
                            pid = next(pid for pid in state["turn_order"] if pid not in state["next_ready"])
                        else:
                            pid = state["current_turn"]
                        action = CheatyMagesGame.bot_move(state, pid)
                        self.assertIsNotNone(action, (count, seed, state["phase"], pid))
                        _, error = CheatyMagesGame.apply_action(state, pid, action)
                        self.assertIsNone(error, (count, seed, step, action, error))
                    self.assertTrue(state["game_over"], (count, seed, state["phase"]))
                    self.assertGreaterEqual(state["total_rounds"], 3)
                    self.assertTrue(state["winner"])


if __name__ == "__main__":
    unittest.main()
