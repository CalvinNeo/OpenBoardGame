"""Behavioral coverage for the Season One Rerolled hero roster."""

import copy
import itertools
import json
import random
import unittest
from collections import Counter

from game.dice_throne import ACTION_SCHEMA, DiceThroneGame as Game
from game.dice_throne_data import CARDS, DECKS, HEROES, STATUSES


ROSTER = (
    "barbarian", "moon_elf", "monk", "paladin", "ninja", "shadow_thief",
    "pyromancer", "treant",
)


class DiceThroneHeroTests(unittest.TestCase):
    def make_state(self, first="barbarian", second="moon_elf", seed=2701):
        state = Game.init_game(
            {"seed": seed},
            [
                {"player_id": "p0", "name": "Alice", "seat": 0, "is_bot": True},
                {"player_id": "p1", "name": "Bob", "seat": 1, "is_bot": True},
            ],
        )
        self.act(state, "p0", "choose_hero", hero=first)
        self.act(state, "p1", "choose_hero", hero=second)
        return state

    def act(self, state, pid, action_type, **fields):
        action = dict(fields, type=action_type, revision=state["revision"])
        events, error = Game.apply_action(state, pid, action)
        self.assertIsNone(error, (pid, action, state["phase"], error))
        self.assertTrue(events)
        return events

    def assert_rejected(self, state, pid, action_type, **fields):
        before = copy.deepcopy(state)
        action = dict(fields, type=action_type, revision=state["revision"])
        events, error = Game.apply_action(state, pid, action)
        self.assertTrue(error, action)
        self.assertEqual(events, [])
        self.assertEqual(state, before, "Rejected actions must preserve RNG and resources")

    def set_attack(self, state, pid="p0", values=None):
        hero = state["players"][pid]["hero"]
        values = values or [1] * 5
        state["phase"] = "targeting"
        state["current_player"] = pid
        state["rolls"] = 1
        state["players"][pid]["combat_points"] = 15
        state["dice"] = [
            {"value": value, "face": HEROES[hero]["dice_faces"][value - 1]}
            for value in values
        ]

    def matching_values(self, hero, ability):
        condition = ability["condition"]
        for values in itertools.combinations_with_replacement(range(1, 7), 5):
            symbols = Counter(HEROES[hero]["dice_faces"][value - 1] for value in values)
            if any(symbols[symbol] < count for symbol, count in condition.get("counts", {}).items()):
                continue
            straight = condition.get("straight")
            if straight and not any(
                set(range(start, start + straight)).issubset(values)
                for start in range(1, 8 - straight)
            ):
                continue
            return values
        self.fail(f"{hero}/{ability['id']} cannot be rolled on its hero's dice")

    def incoming_attack(self, hero="monk", damage=9, damage_type="normal", statuses=None, seed=5):
        state = self.make_state("moon_elf" if hero == "barbarian" else "barbarian", hero)
        state["phase"] = "defensive_roll"
        state["current_player"] = "p1"
        state["players"]["p1"]["statuses"] = dict(statuses or {})
        state["rng_state"] = random.Random(seed).getstate()
        state["pending_attack"] = {
            "attacker": "p0", "defender": "p1", "damage": damage,
            "damage_type": damage_type, "ability_id": "smack",
        }
        return state

    def finish_empty_turn(self, state, pid):
        self.act(state, pid, "end_phase")
        self.act(state, pid, "pass")
        self.act(state, pid, "end_phase")
        self.assertEqual(state["phase"], "round_review")

    def test_all_eight_heroes_can_be_selected_and_have_distinct_kits(self):
        self.assertEqual(set(HEROES), set(ROSTER))
        self.assertEqual(set(ACTION_SCHEMA["properties"]["hero"]["enum"]), set(ROSTER))
        ability_kits = set()
        for hero in ROSTER:
            with self.subTest(hero=hero):
                other = "moon_elf" if hero == "barbarian" else "barbarian"
                state = self.make_state(hero, other)
                self.assertEqual(state["phase"], "main_1")
                self.assertEqual(state["players"]["p0"]["hero"], hero)
                self.assertEqual(len(HEROES[hero]["dice_faces"]), 6)
                self.assertGreaterEqual(len(HEROES[hero]["abilities"]), 7)
                self.assertGreater(HEROES[hero]["defense"]["dice"], 0)
                ids = tuple(ability["id"] for ability in HEROES[hero]["abilities"])
                self.assertEqual(len(ids), len(set(ids)))
                ability_kits.add(ids)
        self.assertEqual(len(ability_kits), 8)

    def test_duplicate_and_unknown_hero_selections_are_atomic(self):
        for hero in ROSTER:
            with self.subTest(hero=hero):
                state = Game.init_game({"seed": 55}, [
                    {"player_id": "p0", "seat": 0},
                    {"player_id": "p1", "seat": 1},
                ])
                self.act(state, "p0", "choose_hero", hero=hero)
                self.assert_rejected(state, "p1", "choose_hero", hero=hero)
                self.assert_rejected(state, "p1", "choose_hero", hero="not_a_hero")

    def test_opening_hands_only_contain_own_hero_and_universal_cards(self):
        for first, second in itertools.combinations(ROSTER, 2):
            with self.subTest(first=first, second=second):
                state = self.make_state(first, second)
                for pid in ("p0", "p1"):
                    hero = state["players"][pid]["hero"]
                    hand = state["players"][pid]["hand"]
                    self.assertEqual(len(hand), 4)
                    self.assertTrue(set(hand).issubset(DECKS[hero]))
                    self.assertTrue(all(CARDS[cid]["hero"] in (None, hero) for cid in hand))

    def test_roll_values_match_hero_faces_and_kept_dice_survive_rerolls(self):
        for hero in ROSTER:
            with self.subTest(hero=hero):
                state = self.make_state(hero, "moon_elf" if hero == "barbarian" else "barbarian")
                state["current_player"] = "p0"
                self.act(state, "p0", "end_phase")
                self.act(state, "p0", "roll")
                self.assertEqual(len(state["dice"]), 5)
                first_die = copy.deepcopy(state["dice"][0])
                self.act(state, "p0", "toggle_keep", index=0)
                for _ in range(2):
                    self.act(state, "p0", "roll")
                    self.assertEqual(state["dice"][0], first_die)
                    for die in state["dice"]:
                        self.assertIn(die["value"], range(1, 7))
                        self.assertEqual(die["face"], HEROES[hero]["dice_faces"][die["value"] - 1])
                self.assert_rejected(state, "p0", "roll")

    def test_every_hero_can_attack_and_offer_defender_a_response(self):
        for hero in ROSTER:
            with self.subTest(hero=hero):
                state = self.make_state(hero, "moon_elf" if hero == "barbarian" else "barbarian")
                self.set_attack(state)
                ability = HEROES[hero]["abilities"][0]
                self.act(state, "p0", "use_ability", ability_id=ability["id"])
                self.assertEqual(state["phase"], "defensive_roll")
                self.assertEqual(state["current_player"], "p1")
                self.assertEqual(state["players"]["p1"]["health"], 50)
                self.assertIn("defend", Game.get_legal_actions(state, "p1"))
                self.act(state, "p1", "pass")
                self.assertLess(state["players"]["p1"]["health"], 50)
                self.assertEqual(state["phase"], "main_2")
                self.assertEqual(state["current_player"], "p0")
                self.assertFalse(state.get("pending_attack"))

    def test_each_hero_defense_resolves_and_releases_the_attack(self):
        for hero in ROSTER:
            with self.subTest(hero=hero):
                attacker_hero = "moon_elf" if hero == "barbarian" else "barbarian"
                state = self.make_state(attacker_hero, hero)
                state["players"]["p1"]["health"] = 30
                self.set_attack(state)
                self.act(state, "p0", "use_ability", ability_id=HEROES[attacker_hero]["abilities"][0]["id"])
                self.act(state, "p1", "defend")
                self.assertEqual(state["phase"], "main_2")
                self.assertEqual(state["current_player"], "p0")
                self.assertFalse(state.get("pending_attack"))
                self.assertGreater(state["players"]["p1"]["health"], 0)
                self.assertLessEqual(state["players"]["p1"]["health"], 50)

    def test_all_64_abilities_are_reachable_and_apply_their_statuses(self):
        for hero in ROSTER:
            for ability in HEROES[hero]["abilities"]:
                with self.subTest(hero=hero, ability=ability["id"]):
                    state = self.make_state(hero, "moon_elf" if hero == "barbarian" else "barbarian")
                    self.set_attack(state, values=self.matching_values(hero, ability))
                    state["players"]["p0"]["combat_points"] = 6
                    state["players"]["p0"]["health"] = 20
                    shown = next(item for item in Game.get_public_view(state, "p0")["abilities"]
                                 if item["id"] == ability["id"])
                    self.assertTrue(shown["available"])
                    self.act(state, "p0", "use_ability", ability_id=ability["id"])
                    if state["phase"] == "defensive_roll":
                        self.act(state, "p1", "pass")
                    self.assertEqual(state["phase"], "main_2")
                    for pid, key in (("p0", "self_status"), ("p1", "opponent_status")):
                        for status, count in Counter(ability.get(key, [])).items():
                            self.assertEqual(state["players"][pid]["statuses"].get(status, 0),
                                             min(count, STATUSES[status]["limit"]))
                    if ability.get("heal"):
                        self.assertGreater(state["players"]["p0"]["health"], 20)
                    if ability.get("gain_cp"):
                        self.assertEqual(state["players"]["p0"]["combat_points"], 6 + ability["gain_cp"])
                    if ability.get("draw"):
                        self.assertEqual(len(state["players"]["p0"]["hand"]), 4 + ability["draw"])

    def test_defense_symbols_trigger_each_heros_distinct_effects(self):
        # Seed 5 rolls 5, 3, 6, 3, 6: secondary, primary, rare symbols.
        expectations = {
            "barbarian": (22, 50, 2, {}),
            "moon_elf": (20, 49, 2, {}),
            "monk": (22, 49, 2, {}),
            "paladin": (23, 50, 3, {}),
            "pyromancer": (20, 49, 2, {"fire_mastery": 1}),
            "shadow_thief": (30, 50, 3, {"shadows": 1}),
            "treant": (23, 50, 2, {"seedling": 1}),
            "ninja": (30, 50, 2, {}),
        }
        for hero, (health, attacker_health, cp, statuses) in expectations.items():
            with self.subTest(hero=hero):
                attacker_hero = "moon_elf" if hero == "barbarian" else "barbarian"
                state = self.make_state(attacker_hero, hero)
                self.set_attack(state)
                self.act(state, "p0", "use_ability", ability_id=HEROES[attacker_hero]["abilities"][0]["id"])
                state["pending_attack"]["damage"] = 10
                state["players"]["p1"]["health"] = 30
                state["rng_state"] = random.Random(5).getstate()
                self.act(state, "p1", "defend")
                self.assertEqual(state["players"]["p1"]["health"], health)
                self.assertEqual(state["players"]["p0"]["health"], attacker_health)
                self.assertEqual(state["players"]["p1"]["combat_points"], cp)
                self.assertEqual(state["players"]["p1"]["statuses"], statuses)

    def test_defense_result_records_roll_and_resolved_effects_for_every_hero(self):
        # Seed 5 rolls 5, 3, 6, 3, 6; ninja then rolls a successful smoke bomb.
        expectations = {
            "barbarian": (0, 2, 0, {}, 10, 0),
            "moon_elf": (0, 0, 0, {}, 10, 1),
            "monk": (1, 0, 0, {"chi": 1}, 8, 1),
            "paladin": (2, 1, 1, {}, 8, 0),
            "pyromancer": (0, 0, 0, {"fire_mastery": 1}, 10, 1),
            "shadow_thief": (0, 0, 1, {"shadows": 1}, 0, 0),
            "treant": (1, 2, 0, {"seedling": 1}, 9, 0),
            "ninja": (1, 0, 0, {"smoke_bomb": 1}, 0, 0),
        }
        for hero, (prevented, healing, cp, statuses, taken, returned) in expectations.items():
            with self.subTest(hero=hero):
                state = self.incoming_attack(hero, damage=10)
                state["players"]["p1"]["health"] = 30
                self.act(state, "p1", "defend")
                defense = HEROES[hero]["defense"]
                values = [5, 3, 6, 3, 6][:defense["dice"]]
                self.assertEqual(state["defense_result"], {
                    "attacker": "p0", "defender": "p1", "hero": hero,
                    "defense_name": defense["name"],
                    "dice": [{"value": value, "face": HEROES[hero]["dice_faces"][value - 1]}
                             for value in values],
                    "attack_damage": 10, "prevented": prevented,
                    "healing": healing, "cp_gained": cp, "status_gains": statuses,
                    "damage_taken": taken, "returned_damage": returned,
                })
                self.assertEqual(state["defense_result"]["dice"], state["defense_dice"])
                self.assertEqual(state["players"]["p1"]["health"], 30 + healing - taken)
                self.assertEqual(state["players"]["p0"]["health"], 50 - returned)

    def test_defense_result_uses_capped_gains_and_roll_only_prevention(self):
        state = self.incoming_attack("paladin", damage=10)
        state["players"]["p1"]["combat_points"] = 15
        self.act(state, "p1", "defend")
        self.assertEqual(state["defense_result"]["healing"], 0)
        self.assertEqual(state["defense_result"]["cp_gained"], 0)

        state = self.incoming_attack("treant", damage=10,
                                     statuses={"seedling": STATUSES["seedling"]["limit"]})
        state["players"]["p1"]["health"] = 49
        self.act(state, "p1", "defend")
        self.assertEqual(state["defense_result"]["healing"], 1)
        self.assertEqual(state["defense_result"]["status_gains"], {})

        state = self.incoming_attack("moon_elf", damage=10, seed=0)
        state["pending_attack"]["prevent"] = 3
        self.act(state, "p1", "defend")
        self.assertEqual(state["defense_result"]["attack_damage"], 10)
        self.assertEqual(state["defense_result"]["prevented"], 4)
        self.assertEqual(state["defense_result"]["damage_taken"], 3)

        state = self.incoming_attack("paladin", damage=1)
        state["pending_attack"]["prevent"] = 6
        self.act(state, "p1", "defend")
        self.assertEqual(state["defense_result"]["prevented"], 0)
        self.assertEqual(state["defense_result"]["damage_taken"], 0)

    def test_defense_result_totals_mitigated_returns_from_all_sources(self):
        state = self.incoming_attack("monk", damage=10, statuses={"retribution": 1})
        state["players"]["p0"]["statuses"] = {"chi": 2}
        state["pending_attack"].update(prevent=2, return_damage=3)
        self.act(state, "p1", "defend")
        result = state["defense_result"]
        self.assertEqual(result["prevented"], 1)
        self.assertEqual(result["status_gains"], {"chi": 1})
        self.assertEqual(result["damage_taken"], 6)
        # Defense returns 1 + Retribution 4 - attacker's Chi 2 + separate return 3.
        self.assertEqual(result["returned_damage"], 6)
        self.assertEqual(state["players"]["p0"]["health"], 44)

    def test_defense_result_survives_review_and_game_over_but_clears_next_turn(self):
        state = self.incoming_attack()
        self.act(state, "p1", "defend")
        result = copy.deepcopy(state["defense_result"])
        self.assertEqual(state["phase"], "main_2")
        self.act(state, "p0", "end_phase")
        self.assertEqual(state["phase"], "round_review")
        self.assertEqual(state["defense_result"], result)
        self.act(state, "p0", "next_round")
        self.assertEqual(state["defense_result"], result)
        self.act(state, "p1", "next_round")
        self.assertEqual(state["phase"], "main_1")
        self.assertIsNone(state["defense_result"])
        self.assertEqual(state["defense_dice"], [])

        state = self.incoming_attack()
        state["players"]["p1"]["health"] = 1
        self.act(state, "p1", "defend")
        self.assertEqual(state["phase"], "game_over")
        self.assertIsNotNone(Game.get_public_view(state, "p1")["defense_result"])

    def test_new_offense_and_attack_clear_previous_defense_result(self):
        state = self.incoming_attack()
        self.act(state, "p1", "defend")
        state.update(phase="main_1", current_player="p0")
        self.act(state, "p0", "end_phase")
        self.assertIsNone(state["defense_result"])
        self.assertEqual(state["defense_dice"], [])

        state = self.incoming_attack()
        self.act(state, "p1", "defend")
        self.set_attack(state)
        self.act(state, "p0", "use_ability", ability_id="smack")
        self.assertEqual(state["phase"], "defensive_roll")
        self.assertIsNone(state["defense_result"])
        self.assertEqual(state["defense_dice"], [])

    def test_passing_defense_never_displays_a_roll_or_stale_result(self):
        for damage_type in ("normal", "undefendable", "ultimate"):
            with self.subTest(damage_type=damage_type):
                state = self.incoming_attack()
                self.act(state, "p1", "defend")
                state.update(phase="defensive_roll", current_player="p1", pending_attack={
                    "attacker": "p0", "defender": "p1", "damage": 3,
                    "damage_type": damage_type,
                })
                rng_before = copy.deepcopy(state["rng_state"])
                self.act(state, "p1", "pass")
                self.assertIsNone(state["defense_result"])
                self.assertEqual(state["defense_dice"], [])
                self.assertEqual(state["rng_state"], rng_before)

    def test_defense_result_public_view_and_save_restore_do_not_alias(self):
        state = self.incoming_attack()
        self.act(state, "p1", "defend")
        before = copy.deepcopy(state)
        for viewer in ("p0", "p1", "spectator"):
            with self.subTest(viewer=viewer):
                view = Game.get_public_view(state, viewer)
                self.assertEqual(view["defense_result"], state["defense_result"])
                view["defense_result"]["dice"][0]["value"] = 99
                view["defense_result"]["status_gains"]["chi"] = 99
                self.assertEqual(state, before)
        payload = Game.serialize(state)
        restored = Game.deserialize(json.loads(json.dumps(payload)))
        self.assertEqual(restored, state)
        payload["defense_result"]["dice"].clear()
        restored["defense_result"]["status_gains"].clear()
        self.assertEqual(state, before)
        # Old saves can retain legacy dice without claiming a new result.
        payload = Game.serialize(state)
        payload.pop("defense_result")
        self.assertIsNone(Game.deserialize(payload)["defense_result"])
        self.assertIsNone(Game.get_public_view(payload, "p1")["defense_result"])

    def test_chi_protect_and_retribution_apply_their_printed_mitigation(self):
        state = self.incoming_attack(damage=5, statuses={"chi": 3})
        self.act(state, "p1", "pass")
        self.assertEqual(state["players"]["p1"]["health"], 48)
        self.assertNotIn("chi", state["players"]["p1"]["statuses"])

        state = self.incoming_attack("paladin", damage=9, statuses={"protect": 1, "retribution": 1})
        self.act(state, "p1", "pass")
        self.assertEqual(state["players"]["p1"]["health"], 46)
        self.assertEqual(state["players"]["p0"]["health"], 45)
        self.assertEqual(state["players"]["p1"]["statuses"], {})

    def test_evasive_and_smoke_bomb_roll_successfully_or_fail_and_always_spend(self):
        for status in ("evasive", "smoke_bomb"):
            for seed, remaining in ((2, 50), (5, 43)):
                with self.subTest(status=status, seed=seed):
                    state = self.incoming_attack("ninja", damage=7, statuses={status: 1}, seed=seed)
                    self.act(state, "p1", "pass")
                    self.assertEqual(state["players"]["p1"]["health"], remaining)
                    self.assertNotIn(status, state["players"]["p1"]["statuses"])

    def test_shadows_prevent_normal_damage_but_ultimate_bypasses_tokens(self):
        state = self.incoming_attack("shadow_thief", statuses={"shadows": 1})
        self.act(state, "p1", "pass")
        self.assertEqual(state["players"]["p1"]["health"], 50)
        self.assertEqual(state["players"]["p1"]["statuses"], {"shadows": 1})

        statuses = {"shadows": 1, "chi": 5, "protect": 1, "evasive": 3, "smoke_bomb": 1, "cleanse": 1}
        state = self.make_state("barbarian", "shadow_thief")
        state["players"]["p1"]["statuses"] = dict(statuses)
        self.set_attack(state, values=[6] * 5)
        self.act(state, "p0", "use_ability", ability_id="rage")
        self.assertEqual(Game.get_legal_actions(state, "p1"), ["pass"])
        self.assert_rejected(state, "p1", "defend")
        self.act(state, "p1", "pass")
        self.assertEqual(state["phase"], "main_2")
        self.assertEqual(state["players"]["p1"]["health"], 35)
        for status, count in statuses.items():
            self.assertEqual(state["players"]["p1"]["statuses"][status], count)
        self.assertEqual(state["players"]["p1"]["statuses"]["stun"], 1)

    def test_divine_blessing_revives_once_and_then_allows_defeat(self):
        state = self.make_state("barbarian", "paladin")
        state["players"]["p1"]["statuses"] = {"blessing": 1}
        state["players"]["p1"]["health"] = 3
        self.set_attack(state, values=[6] * 5)
        self.act(state, "p0", "use_ability", ability_id="rage")
        self.act(state, "p1", "pass")
        self.assertEqual(state["players"]["p1"]["health"], 1)
        self.assertNotIn("blessing", state["players"]["p1"]["statuses"])
        self.assertFalse(state["game_over"])
        self.set_attack(state)
        self.act(state, "p0", "use_ability", ability_id="smack")
        self.act(state, "p1", "pass")
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p0"])

    def test_basic_upgrade_cards_improve_damage_for_each_hero(self):
        for hero in ROSTER:
            with self.subTest(hero=hero):
                state = self.make_state(hero, "moon_elf" if hero == "barbarian" else "barbarian")
                ability_id = HEROES[hero]["abilities"][0]["id"]
                baseline = copy.deepcopy(state)
                self.set_attack(baseline)
                self.act(baseline, "p0", "use_ability", ability_id=ability_id)
                base_damage = baseline["pending_attack"]["damage"]
                card_id = next(cid for cid, card in CARDS.items() if
                               card.get("hero") == hero and
                               card.get("ability") == ability_id and card.get("level") == 2)
                state["current_player"] = "p0"
                state["players"]["p0"]["hand"] = [card_id]
                state["players"]["p0"]["combat_points"] = 15
                self.act(state, "p0", "play_card", card_id=card_id)
                self.assertNotIn(card_id, state["players"]["p0"]["hand"])
                self.assertEqual(state["players"]["p0"]["combat_points"], 15 - CARDS[card_id]["cost"])
                self.set_attack(state)
                self.act(state, "p0", "use_ability", ability_id=ability_id)
                self.assertGreater(state["pending_attack"]["damage"], base_damage)

    def test_hero_action_cards_grant_their_actual_resources_and_statuses(self):
        cards = [(cid, card) for cid, card in CARDS.items()
                 if card.get("hero") and card["effect"] == "gain"]
        self.assertEqual({card["hero"] for _, card in cards}, set(ROSTER))
        for card_id, card in cards:
            with self.subTest(card=card_id):
                hero = card["hero"]
                state = self.make_state(hero, "moon_elf" if hero == "barbarian" else "barbarian")
                player = state["players"]["p0"]
                player["health"] = 20
                player["combat_points"] = 6
                player["hand"] = [card_id]
                state["current_player"] = "p0"
                self.act(state, "p0", "play_card", card_id=card_id,
                         target="p1" if card["target"] == "opponent" else "p0")
                self.assertEqual(player["hand"], [])
                self.assertEqual(player["health"], 20 + card.get("heal", 0))
                self.assertEqual(player["combat_points"], 6 - card["cost"] + card.get("gain_cp", 0))
                for pid, key in (("p0", "self_status"), ("p1", "opponent_status")):
                    self.assertEqual(state["players"][pid]["statuses"], dict(Counter(card.get(key, []))))

    def test_free_attacks_cp_cap_and_card_draw_cap(self):
        for hero in ROSTER:
            with self.subTest(hero=hero):
                state = self.make_state(hero, "moon_elf" if hero == "barbarian" else "barbarian")
                self.set_attack(state)
                state["players"]["p0"]["combat_points"] = 0
                self.act(state, "p0", "use_ability", ability_id=HEROES[hero]["abilities"][0]["id"])
                self.assertEqual(state["players"]["p0"]["combat_points"], 0)

        state = self.make_state("ninja", "paladin")
        state["current_player"] = "p0"
        player = state["players"]["p0"]
        player["combat_points"] = 14
        player["hand"] = ["getting_paid"]
        self.act(state, "p0", "play_card", card_id="getting_paid")
        self.assertEqual(player["combat_points"], 15)
        player["hand"] = ["triple_up", "ninja_slash_2", "ninja_slash_3", "six_it", "so_wild"]
        self.act(state, "p0", "play_card", card_id="triple_up")
        self.assertEqual(len(player["hand"]), 6)
        self.assertTrue(all(CARDS[cid]["hero"] in (None, "ninja") for cid in player["hand"]))

    def test_poison_burn_and_treant_companions_resolve_on_incoming_turn_only(self):
        state = self.make_state("treant", "pyromancer")
        active = state["current_player"]
        incoming = "p1" if active == "p0" else "p0"
        player = state["players"][incoming]
        player["health"] = 20
        player["statuses"] = {
            "burn": 1, "poison": 2, "fire_mastery": 3, "sapling": 1,
            "wellspring": 2,
        }
        self.finish_empty_turn(state, active)
        self.assertEqual(player["health"], 20)
        self.act(state, "p0", "next_round")
        self.act(state, "p1", "next_round")
        self.assertEqual(state["current_player"], incoming)
        self.assertEqual(player["health"], 20)  # 4 damage, 2 sapling heal, 2 wellspring heal.
        self.assertEqual(player["combat_points"], 4)  # One income CP and one sapling CP.
        self.assertEqual(player["statuses"], {"burn": 1, "poison": 2, "fire_mastery": 2})

    def test_delayed_poison_waits_until_affected_players_turn_ends(self):
        state = self.make_state("ninja", "shadow_thief")
        active = state["current_player"]
        player = state["players"][active]
        player["health"] = 20
        player["statuses"] = {"delayed_poison": 2}
        self.act(state, active, "end_phase")
        self.assertEqual(player["health"], 20)
        self.act(state, active, "pass")
        self.assertEqual(player["health"], 20)
        self.act(state, active, "end_phase")
        self.assertEqual(state["phase"], "round_review")
        self.assertEqual(player["health"], 14)
        self.assertNotIn("delayed_poison", player["statuses"])

    def test_barbed_vine_settles_rerolls_even_when_attacker_skips(self):
        for finish in ("confirm_roll", "pass"):
            with self.subTest(finish=finish):
                state = self.make_state("treant", "ninja")
                active = state["current_player"]
                player = state["players"][active]
                player["health"] = 20
                player["statuses"] = {"barbed_vine": 1}
                self.act(state, active, "end_phase")
                for _ in range(3):
                    self.act(state, active, "roll")
                self.act(state, active, finish)
                self.assertEqual(player["health"], 18)
                self.assertNotIn("barbed_vine", player["statuses"])

    def test_dice_cards_validate_inputs_before_spending_and_keep_symbol_value_consistent(self):
        state = self.make_state("ninja", "paladin")
        self.set_attack(state)
        player = state["players"]["p0"]
        player["hand"] = ["six_it", "so_wild", "tip_it", "samesies"]
        for card_id, fields in (
            ("six_it", {"index": 5}),
            ("so_wild", {"index": 0, "value": 7}),
            ("tip_it", {"index": 0, "value": 6}),
            ("samesies", {"index": 0, "source_index": 0}),
        ):
            with self.subTest(card=card_id):
                self.assert_rejected(state, "p0", "play_card", card_id=card_id, **fields)
        self.act(state, "p0", "play_card", card_id="six_it", index=0)
        self.act(state, "p0", "play_card", card_id="so_wild", index=1, value=4)
        self.act(state, "p0", "play_card", card_id="tip_it", index=1, value=5)
        self.act(state, "p0", "play_card", card_id="samesies", index=2, source_index=0)
        self.assertEqual([die["value"] for die in state["dice"]], [6, 5, 6, 1, 1])
        self.assertEqual([die["face"] for die in state["dice"]], ["mask", "star", "mask", "blade", "blade"])
        self.assertEqual(state["players"]["p0"]["combat_points"], 10)
        self.assertEqual(state["players"]["p0"]["hand"], [])

    def test_status_removal_preserves_companions_and_divine_blessing(self):
        state = self.make_state("monk", "treant")
        state["current_player"] = "p0"
        player = state["players"]["p0"]
        player["combat_points"] = 6
        player["hand"] = ["get_outta_here", "what_status"]
        state["players"]["p1"]["statuses"] = {"seedling": 1, "blessing": 1, "poison": 2}
        for status in ("seedling", "blessing", "not_a_status"):
            self.assert_rejected(state, "p0", "play_card", card_id="get_outta_here", target="p1", status=status)
        self.act(state, "p0", "play_card", card_id="get_outta_here", target="p1", status="poison")
        self.assertEqual(state["players"]["p1"]["statuses"]["poison"], 1)
        self.act(state, "p0", "play_card", card_id="what_status", target="p1")
        self.assertEqual(state["players"]["p1"]["statuses"], {"seedling": 1, "blessing": 1})

    def test_cleanse_blocks_negative_status_once_and_poison_stacks_are_capped(self):
        state = self.make_state("shadow_thief", "monk")
        state["current_player"] = "p0"
        player = state["players"]["p0"]
        player["combat_points"] = 15
        player["hand"] = ["shadow_thief_poison_tip"] * 5
        state["players"]["p1"]["statuses"] = {"cleanse": 1}
        self.act(state, "p0", "play_card", card_id="shadow_thief_poison_tip")
        self.assertEqual(state["players"]["p1"]["statuses"], {})
        for _ in range(4):
            self.act(state, "p0", "play_card", card_id="shadow_thief_poison_tip")
        self.assertEqual(state["players"]["p1"]["statuses"], {"poison": 3})

    def test_upgrade_purchase_requires_owned_card_and_rejects_downgrades_atomically(self):
        state = self.make_state("ninja", "monk")
        state["current_player"] = "p0"
        player = state["players"]["p0"]
        player["combat_points"] = 15
        player["hand"] = []
        self.assert_rejected(state, "p0", "buy_upgrade", ability_id="slash", level=2)
        player = state["players"]["p0"]
        player["hand"] = ["ninja_slash_2", "ninja_slash_3", "monk_center_yourself"]
        self.act(state, "p0", "buy_upgrade", ability_id="slash", level=3)
        self.assertEqual(player["upgrades"], [{"ability": "slash", "level": 3}])
        self.assertEqual(player["combat_points"], 12)
        self.assert_rejected(state, "p0", "buy_upgrade", ability_id="slash", level=2)
        self.assert_rejected(state, "p0", "play_card", card_id="monk_center_yourself")

    def test_cross_hero_ability_and_missing_card_are_rejected_atomically(self):
        state = self.make_state("ninja", "paladin")
        self.set_attack(state)
        self.assert_rejected(state, "p0", "use_ability", ability_id="smack")
        self.assert_rejected(state, "p0", "play_card", card_id="missing_card")
        self.assert_rejected(state, "p1", "use_ability", ability_id="smack")

    def test_review_waits_for_both_players_and_acknowledgment_order_does_not_choose_turn(self):
        for ready_order in (("p0", "p1"), ("p1", "p0")):
            with self.subTest(ready_order=ready_order):
                state = self.make_state("monk", "paladin")
                active = state["current_player"]
                incoming = "p1" if active == "p0" else "p0"
                old_cp = {pid: player["combat_points"] for pid, player in state["players"].items()}
                self.finish_empty_turn(state, active)
                self.assertEqual(state["phase"], "round_review")
                self.act(state, ready_order[0], "next_round")
                self.assertEqual(state["phase"], "round_review")
                self.assert_rejected(state, ready_order[0], "next_round")
                self.act(state, ready_order[1], "next_round")
                self.assertEqual(state["phase"], "main_1")
                self.assertEqual(state["current_player"], incoming)
                self.assertEqual(state["players"][active]["combat_points"], old_cp[active])
                self.assertEqual(state["players"][incoming]["combat_points"], old_cp[incoming] + 1)

    def test_json_save_restore_preserves_next_roll_for_every_hero(self):
        for hero in ROSTER:
            with self.subTest(hero=hero):
                state = self.make_state(hero, "moon_elf" if hero == "barbarian" else "barbarian")
                state["current_player"] = "p0"
                self.act(state, "p0", "end_phase")
                self.act(state, "p0", "roll")
                self.act(state, "p0", "toggle_keep", index=2)
                restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
                self.assertEqual(restored, state)
                self.act(state, "p0", "roll")
                self.act(restored, "p0", "roll")
                self.assertEqual(restored, state)
                restored["players"]["p0"]["hand"].clear()
                self.assertEqual(len(state["players"]["p0"]["hand"]), 4)

    def test_public_views_hide_decks_and_opponent_cards_and_do_not_alias(self):
        state = self.make_state("pyromancer", "treant")
        before = copy.deepcopy(state)
        private_keys = {"rng_state", "seed", "deck", "decks", "discard", "discards", "hand"}

        def assert_private_keys_absent(value):
            if isinstance(value, dict):
                self.assertFalse(private_keys.intersection(value))
                for child in value.values():
                    assert_private_keys_absent(child)
            elif isinstance(value, list):
                for child in value:
                    assert_private_keys_absent(child)

        for viewer in ("p0", "p1", "spectator"):
            with self.subTest(viewer=viewer):
                view = Game.get_public_view(state, viewer)
                assert_private_keys_absent(view)
                self.assertEqual(len(view["your_hand"]), 0 if viewer == "spectator" else 4)
                if viewer != "spectator":
                    self.assertEqual(
                        [card["id"] for card in view["your_hand"]],
                        state["players"][viewer]["hand"],
                    )
                view["players"][0]["statuses"].append({"id": "blind", "stacks": 3})
                view["your_hand"].clear()
                self.assertEqual(state, before)

    def test_bot_games_finish_for_all_28_unique_hero_pairings(self):
        for number, (first, second) in enumerate(itertools.combinations(ROSTER, 2)):
            with self.subTest(first=first, second=second):
                state = self.make_state(first, second, seed=2700 + number)
                for _ in range(1200):
                    if state["game_over"]:
                        break
                    ready = [pid for pid in state["turn_order"] if Game.get_legal_actions(state, pid)]
                    self.assertTrue(ready, state["phase"])
                    pid = ready[0]
                    action = Game.bot_move(state, pid)
                    self.assertIsNotNone(action, (state["phase"], pid))
                    action.pop("delay_ms", None)
                    events, error = Game.apply_action(state, pid, action)
                    self.assertIsNone(error, (state["phase"], pid, action, error))
                    self.assertTrue(events)
                self.assertTrue(state["game_over"], (first, second, state["turn_count"]))
                if not state["winner"]:
                    self.assertTrue(all(player["health"] == 0 for player in state["players"].values()))
                self.assertEqual(Game.get_legal_actions(state, "p0"), [])
                self.assertEqual(Game.get_legal_actions(state, "p1"), [])


if __name__ == "__main__":
    unittest.main()
