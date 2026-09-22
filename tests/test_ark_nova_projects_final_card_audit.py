from __future__ import annotations

import copy
import unittest

from game import ark_nova as rules
from game import ark_nova_effects as effects
from tests import test_ark_nova_effects as effect_fixtures
from tests import test_ark_nova_game as game_fixtures


# Independent card audit fixtures: Ender Projects.ts / EndGames.ts originalArray,
# checked against the official glossary pp. 1, 5, 8 and the Marine Worlds
# replacement list. These values intentionally do not import generator tables.
FINAL_LADDERS = {
    "001": ("large_animal", [1, 2, 4, 5]),
    "002": ("small_animal", [3, 6, 8, 10]),
    "003": ("science", [3, 4, 5, 6]),
    "005": ("supported_projects", [3, 4, 5, 6]),
    "006": ("empty_land", [6, 12, 18, 24]),
    "007": ("reputation", [6, 9, 12, 15]),
    "008": ("sponsors", [3, 6, 8, 10]),
    "010": ("rock", [1, 3, 5, 7]),
    "011": ("water", [2, 4, 6, 8]),
}
COUNT_PROJECTS = {
    "101": ("any_animal_category", [5, 4, 3], [5, 3, 2]),
    "102": ("any_continent", [5, 4, 3], [5, 3, 2]),
    "103": ("africa", [5, 4, 2], [5, 3, 2]),
    "104": ("americas", [5, 4, 2], [5, 3, 2]),
    "105": ("australia", [5, 4, 2], [5, 4, 2]),
    "106": ("asia", [5, 4, 2], [5, 3, 2]),
    "107": ("europe", [5, 4, 2], [5, 4, 2]),
    "108": ("primate", [5, 4, 2], [5, 4, 2]),
    "109": ("reptile", [5, 4, 2], [5, 4, 2]),
    "110": ("predator", [5, 4, 2], [5, 4, 2]),
    "111": ("herbivore", [5, 4, 2], [5, 4, 2]),
    "112": ("bird", [5, 4, 2], [5, 4, 2]),
    "128": ("water", [5, 4, 2], [4, 3, 2]),
    "129": ("rock", [5, 4, 2], [4, 3, 2]),
    "130": ("small_animal", [8, 5, 2], [4, 3, 2]),
    "131": ("large_animal", [4, 3, 2], [4, 3, 2]),
    "132": ("science", [5, 4, 2], [4, 3, 2]),
}
RELEASE_PROJECTS = {
    "113": ("europe", ["416", "418", "419"]),
    "114": ("americas", ["411", "413", "414"]),
    "115": ("asia", ["406", "408", "409"]),
    "116": ("africa", ["401", "403", "404"]),
    "117": ("australia", ["421", "423", "424"]),
    "118": ("predator", ["401", "403", "404"]),
    "119": ("bird", ["494", "496", "497"]),
    "120": ("herbivore", ["426", "428", "429"]),
    "121": ("reptile", ["469", "471", "470"]),
    "122": ("primate", ["451", "454", "452"]),
}
BREEDING_PROJECTS = {
    "123": ("bird", "494"),
    "124": ("predator", "401"),
    "125": ("reptile", "469"),
    "126": ("herbivore", "426"),
    "127": ("primate", "452"),
}
BREEDING_REWARDS = [{"conservation": 2, "reputation": 2},
                    {"conservation": 1, "reputation": 2}, {"conservation": 2}]
ANIMAL_CATEGORIES = ["bird", "herbivore", "predator", "primate", "reptile", "bear", "petting_zoo_animal"]
CONTINENTS = ["africa", "americas", "asia", "australia", "europe"]
LARGE_ANIMALS = ["401", "402", "406", "407", "411", "412", "416"]
SMALL_ANIMALS = ["521", "522", "523", "524", "525", "526", "527", "528", "404", "405", "409", "410"]


class ArkNovaProjectsFinalCardAudit(unittest.TestCase):
    def set_metric(self, player, metric, value):
        player.pop("metrics", None)
        if metric == "large_animal":
            player["played_animals"] = LARGE_ANIMALS[:value]
        elif metric == "small_animal":
            player["played_animals"] = SMALL_ANIMALS[:value]
        elif metric in {"any_animal_category", "any_continent"}:
            tags = ANIMAL_CATEGORIES if metric == "any_animal_category" else CONTINENTS
            player["tags"] = {tag: 2 for tag in tags[:value]}
        elif metric == "supported_projects":
            player["supported_projects"] = [{"project_id": str(101 + index)} for index in range(value)]
        elif metric == "empty_land":
            land = [cell_id for cell_id, cell in rules.MAP_CELLS.items() if cell.get("buildable")]
            player["map"] = {"buildings": [], "occupancy": {cell: "built" for cell in land[value:]}}
        elif metric == "sponsors":
            player["played_sponsors"] = [str(201 + index) for index in range(value)]
        elif metric == "reputation":
            player["reputation"] = value
        else:
            player["tags"] = {metric: value}

    def context(self, state, card_id):
        return effects.EffectContext(state, "p1", card_id)

    def test_all_projects_allow_immediate_support_when_obtained_in_hand(self):
        for card_id, card in rules.PROJECT_CARDS.items():
            with self.subTest(card=card_id):
                self.assertTrue(card["play"]["may_support_from_hand"])
                self.assertTrue(card["play"]["must_support_immediately_when_played"])
                self.assertFalse(card.get("icons"))

    def test_all_eleven_final_cards_match_original_base_scoring_at_every_boundary(self):
        self.assertEqual(set(rules.FINAL_CARDS), set(FINAL_LADDERS) | {"004", "009"})
        for card_id, (metric, ladder) in FINAL_LADDERS.items():
            self.assertEqual([step["requirement"] for step in rules.FINAL_CARDS[card_id]["scoring_steps"]], ladder)
            for value in range(max(ladder) + 2):
                with self.subTest(card=card_id, value=value):
                    state = effect_fixtures.game_state()
                    self.set_metric(state["players"]["p1"], metric, value)
                    expected = sum(value >= threshold for threshold in ladder)
                    self.assertEqual(effects.score_final_card(card_id, self.context(state, card_id)), expected)
                    self.assertEqual(rules._score_final_card(state, "p1", card_id)[0], expected)

    def test_architectural_zoo_scores_actual_map_and_ignores_covered_terrain(self):
        for terrain in ("water", "rock"):
            with self.subTest(terrain=terrain):
                state = effect_fixtures.game_state()
                player = state["players"]["p1"]
                terrain_cells = [cell for cell in rules.MAP_CELLS.values() if cell.get("terrain") == terrain]
                # Cover the isolated target itself, and connect every remaining
                # terrain space. The covered hex is removed from the condition.
                target = next(cell for cell in terrain_cells if all(
                    neighbor not in {other["id"] for other in terrain_cells}
                    for neighbor in cell["neighbors"]
                ))
                blocked = set(target["neighbors"])
                covered = {target["id"]}
                for cell in terrain_cells:
                    if cell["id"] != target["id"]:
                        covered.add(next(neighbor for neighbor in cell["neighbors"] if neighbor not in blocked))
                player["map"]["occupancy"] = {cell: "building" for cell in covered}
                condition = f"all_{terrain}_spaces_connected"
                self.assertTrue(effects._map_condition(self.context(state, "004"), condition))
                direct = effects.score_final_card("004", self.context(state, "004"))
                rules._update_derived_metrics(player)
                self.assertTrue(player["map"]["conditions"][condition])
                self.assertEqual(rules._score_final_card(state, "p1", "004")[0], direct)
        state = effect_fixtures.game_state()
        self.assertEqual(effects.score_final_card("004", self.context(state, "004")), 0)
        state["players"]["p1"]["map"]["occupancy"] = {
            cell_id: "built" for cell_id, cell in rules.MAP_CELLS.items() if cell.get("buildable")
        }
        self.assertEqual(effects.score_final_card("004", self.context(state, "004")), 4)

    def test_biodiverse_zoo_compares_all_seven_icons_to_right_neighbor_and_caps_at_four(self):
        for wins in range(8):
            with self.subTest(wins=wins):
                state = effect_fixtures.game_state()
                state["players"]["p3"] = effect_fixtures.player_state()
                state["turn_order"] = ["p1", "p2", "p3"]
                state["players"]["p1"]["tags"] = {tag: 1 for tag in ANIMAL_CATEGORIES[:wins]}
                state["players"]["p2"]["tags"] = {tag: 9 for tag in ANIMAL_CATEGORIES}
                expected = min(4, wins)
                self.assertEqual(effects.score_final_card("009", self.context(state, "009")), expected)
                self.assertEqual(rules._score_final_card(state, "p1", "009")[0], expected)

    def test_all_seventeen_count_projects_match_tags_thresholds_and_rewards(self):
        for card_id, (metric, requirements, rewards) in COUNT_PROJECTS.items():
            card = rules.PROJECT_CARDS[card_id]
            self.assertEqual(card["metric"], metric)
            self.assertEqual([slot["requirement"]["value"] for slot in card["support_slots"]], requirements)
            self.assertEqual([slot["reward"] for slot in card["support_slots"]], [{"conservation": value} for value in rewards])
            for value in range(max(requirements) + 2):
                with self.subTest(card=card_id, value=value):
                    state = effect_fixtures.game_state()
                    self.set_metric(state["players"]["p1"], metric, value)
                    actual_value = min(value, 5) if metric == "any_continent" else value
                    expected = [index + 1 for index, requirement in enumerate(requirements) if actual_value >= requirement]
                    core = [slot["position"] for slot in card["support_slots"]
                            if rules._project_requirement_met(state, "p1", card, slot)]
                    self.assertEqual(core, expected)
                    self.assertEqual(effects.evaluate_conservation_project(card_id, self.context(state, card_id))["eligible_slots"], expected)

    def test_all_ten_release_projects_use_printed_size_bands_and_matching_animal_tags(self):
        for card_id, (tag, candidates) in RELEASE_PROJECTS.items():
            card = rules.PROJECT_CARDS[card_id]
            self.assertEqual(card["release_rules"]["animal_must_have_tag"], tag)
            self.assertEqual(card["new_project_bonus"], {"reputation": 1})
            self.assertEqual([(slot["requirement"]["minimum"], slot["requirement"]["maximum"])
                              for slot in card["support_slots"]], [(4, 5), (3, 3), (1, 2)])
            self.assertEqual([slot["reward"] for slot in card["support_slots"]],
                             [{"conservation": 5}, {"conservation": 4}, {"conservation": 3}])
            for position, animal_id in enumerate(candidates, 1):
                with self.subTest(card=card_id, animal=animal_id):
                    state = effect_fixtures.game_state()
                    player = state["players"]["p1"]
                    player["played_animals"] = [animal_id]
                    player["animal_records"] = [{"card_id": animal_id, "enclosure_size": 5}]
                    expected = [position]
                    self.assertEqual([slot["position"] for slot in card["support_slots"]
                                      if rules._project_requirement_met(state, "p1", card, slot, animal_id)], expected)
                    self.assertEqual(effects.evaluate_conservation_project(card_id, self.context(state, card_id))["eligible_slots"], expected)
            state = effect_fixtures.game_state()
            wrong_animal = next(animal for animal, data in rules.ANIMAL_CARDS.items() if not rules._card_icons(data).get(tag)
                                and rules._printed_standard_enclosure_size(data) > 0)
            state["players"]["p1"].update(played_animals=[wrong_animal], animal_records=[{"card_id": wrong_animal}])
            self.assertFalse(effects.evaluate_conservation_project(card_id, self.context(state, card_id))["eligible"])
            self.assertFalse(any(rules._project_requirement_met(state, "p1", card, slot, wrong_animal)
                                 for slot in card["support_slots"]))

    def test_all_five_breeding_projects_require_animal_and_its_own_continent_partner(self):
        for card_id, (tag, animal_id) in BREEDING_PROJECTS.items():
            card = rules.PROJECT_CARDS[card_id]
            self.assertEqual(card["breeding_rules"]["animal_must_have_tag"], tag)
            self.assertEqual([slot["reward"] for slot in card["support_slots"]], BREEDING_REWARDS)
            state = effect_fixtures.game_state()
            player = state["players"]["p1"]
            player["played_animals"] = [animal_id]
            for partners, expected in [([], []), (["europe"], []), (["africa"], [1, 2, 3])]:
                with self.subTest(card=card_id, partners=partners):
                    player["partner_zoos"] = partners
                    self.assertEqual([slot["position"] for slot in card["support_slots"]
                                      if rules._project_requirement_met(state, "p1", card, slot)], expected)
                    self.assertEqual(effects.evaluate_conservation_project(card_id, self.context(state, card_id))["eligible_slots"], expected)
            player["played_animals"] = []
            player["played_sponsors"] = ["249", "250", "252", "253"]
            rules._recompute_tags(player)
            self.assertFalse(effects.evaluate_conservation_project(card_id, self.context(state, card_id))["eligible"])

    def test_every_project_can_enter_from_hand_and_pays_each_printed_slot_without_adding_icons(self):
        self.assertEqual(set(rules.PROJECT_CARDS), set(COUNT_PROJECTS) | set(RELEASE_PROJECTS) | set(BREEDING_PROJECTS))
        helper = game_fixtures.ArkNovaGameTests()
        for card_id in sorted(rules.PROJECT_CARDS):
            for position in (1, 2, 3):
                with self.subTest(card=card_id, position=position):
                    state = helper.make_state()
                    player = state["players"]["p1"]
                    helper.set_slot(state, "p1", "association", 5)
                    state.update(projects=[], dynamic_projects=[], project_slots={}, blocked_project_slots=[], final_card_gate_reached=True)
                    player.update(conservation=10, reputation=6, milestones_resolved=[2, 5, 8], reputation_milestones_resolved=[5, 8])
                    player["action_cards"]["cards"]["upgraded"] = True
                    task = {"task": "support_project", "project_id": card_id, "slot": position, "reward_id": "money_12"}
                    if card_id in COUNT_PROJECTS:
                        metric, requirements, rewards = COUNT_PROJECTS[card_id]
                        self.set_metric(player, metric, requirements[position - 1])
                        reward = {"conservation": rewards[position - 1]}
                    elif card_id in RELEASE_PROJECTS:
                        animal_id = RELEASE_PROJECTS[card_id][1][position - 1]
                        player.update(played_animals=[animal_id], animal_records=[{"card_id": animal_id}])
                        rules._recompute_tags(player)
                        task["release_animal_id"] = animal_id
                        reward = {"conservation": [5, 4, 3][position - 1], "reputation": 1}
                    else:
                        player.update(played_animals=[BREEDING_PROJECTS[card_id][1]], partner_zoos=["africa"])
                        rules._recompute_tags(player)
                        reward = BREEDING_REWARDS[position - 1]
                    before_tags = dict(player["tags"])
                    helper.add_hand_card(state, "p1", card_id)
                    _, error = rules.ArkNovaGame.apply_action(state, "p1", {"type": "association", "tasks": [task]})
                    self.assertIsNone(error)
                    player = state["players"]["p1"]
                    self.assertEqual(player["conservation"], 10 + reward["conservation"])
                    self.assertEqual(player["reputation"], 6 + reward.get("reputation", 0))
                    self.assertEqual(player["conservation_markers_remaining"], 6)
                    self.assertNotIn(card_id, player["hand"])
                    self.assertIn(card_id, state["dynamic_projects"])
                    self.assertEqual(player["tags"], {} if card_id in RELEASE_PROJECTS else before_tags)
                    self.assertEqual(state["current_player"], "p2")

    def test_project_api_respects_repeated_support_exception_and_blocked_slots(self):
        helper = game_fixtures.ArkNovaGameTests()
        state = helper.make_state()
        player = state["players"]["p1"]
        state.update(projects=["103"], project_slots={"103": []}, blocked_project_slots=[])
        player["tags"] = {"africa": 5}
        for history_key in ("project_id", "card_id"):
            player["supported_projects"] = [{history_key: "103", "position": 1}]
            self.assertFalse(effects.evaluate_conservation_project("103", self.context(state, "103"))["eligible"])
            before = copy.deepcopy(state)
            with self.assertRaises(ValueError):
                effects.support_conservation_project("103", self.context(state, "103"), slot_position=2)
            self.assertEqual(state, before)
        player["supported_projects"] = []
        state["blocked_project_slots"] = [{"project_id": "103", "position": 1}]
        self.assertEqual(effects.evaluate_conservation_project("103", self.context(state, "103"))["eligible_slots"], [2, 3])
        player.update(played_animals=["401"], animal_records=[{"card_id": "401"}],
                      supported_projects=[{"project_id": "116", "position": 2}])
        self.assertFalse(effects.evaluate_conservation_project("116", self.context(state, "116"))["eligible"])
        player["played_sponsors"] = ["224"]
        player["active_effects"]["224"] = {"modifier": "release_project_bonus", "conservation": 1}
        self.assertEqual(effects.evaluate_conservation_project("116", self.context(state, "116"))["eligible_slots"], [1])
        state["projects"].append("116")
        effects.support_conservation_project("116", self.context(state, "116"), slot_position=1, animal_id="401")
        self.assertEqual(player["conservation"], 6)


if __name__ == "__main__":
    unittest.main()
