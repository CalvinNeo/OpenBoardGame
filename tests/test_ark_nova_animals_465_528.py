from __future__ import annotations

import copy
import unittest

from game import ark_nova as rules
from tests import test_ark_nova_game as fixtures


# All 64 rows were checked against the printed card scans on 2026-09-22:
# https://github.com/PixelT/ArkNovaCardsManager/tree/67686265a98d423c6182dda63d967cdd92ffeb85/src/images/animal
# The independent structured cross-check was:
# https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards/blob/6f67a11b9a038d75bb327cd1abfe20165d6c0055/src/data/Animals.ts
# Card 482's scan settles the external omissions: water 1, rock 0. Its brown
# numeral 1 is Reptile House capacity, not a rock requirement. Petting animals
# have no standard enclosure requirement; size 1 denotes their special capacity.
# id|cost|size|water|rock|appeal|conservation|reputation|icons|conditions|enclosures|abilities
PRINTED_ROWS = """
465|10|1|0|0|4|0|0|primate,americas|-|standard:1|clever
466|12|3|0|0|6|0|0|primate,americas|-|standard:3|boost_cards
467|12|2|0|0|5|0|0|primate,americas|-|standard:2|clever
468|15|1|0|0|4|1|1|primate,americas|science*2|standard:1|-
469|13|5|1|0|9|0|0|reptile,africa|reptile*3|standard:5,reptile_house:3|snapping_2
470|13|2|0|0|6|0|0|reptile,africa|africa,reptile|standard:2,reptile_house:1|venom:2
471|22|3|0|0|6|1|0|reptile,africa|-|standard:3,reptile_house:2|sun_bathing:3
472|12|2|0|1|5|0|0|reptile,africa|-|standard:2,reptile_house:1|sun_bathing:3
473|9|1|0|0|3|0|0|reptile,africa|-|standard:1,reptile_house:0|sun_bathing:2
474|14|2|0|0|7|0|0|reptile,asia|reptile*2|standard:2,reptile_house:1|constriction
475|13|2|0|0|6|0|0|reptile,asia|science*2,animalsii|standard:2,reptile_house:1|hypnosis
476|14|3|0|0|2|0|0|reptile,asia|asia*2|standard:3,reptile_house:2|iconic_animal:asia
477|14|1|0|0|4|0|0|reptile,asia|-|standard:1,reptile_house:0|snapping_1
478|8|1|1|0|3|0|0|reptile,asia|-|standard:1,reptile_house:0|sun_bathing:2
479|18|4|1|0|7|0|0|reptile,americas|-|standard:4,reptile_house:2|snapping_1
480|16|4|1|0|6|0|0|reptile,americas|-|standard:4,reptile_house:2|snapping_1
481|30|3|0|0|8|2|1|reptile,americas|americas*2,animalsii|standard:3,reptile_house:2|sun_bathing:4
482|13|2|1|0|6|0|0|reptile,americas|partner_zoo|standard:2,reptile_house:1|constriction
483|16|2|0|0|7|0|0|reptile,americas|science*2|standard:2,reptile_house:1|constriction
484|9|1|1|0|4|0|0|reptile,europe|-|standard:1,reptile_house:1|-
485|10|1|0|0|2|0|0|reptile,europe|partner_zoo|standard:1,reptile_house:0|hypnosis
486|4|1|0|1|2|0|0|reptile,europe|-|standard:1,reptile_house:0|-
487|8|1|1|0|3|0|0|reptile,europe|-|standard:1,reptile_house:0|clever
488|4|1|1|0|2|0|0|reptile,europe|-|standard:1,reptile_house:0|-
489|23|5|1|0|9|0|0|reptile*2,australia|partner_zoo|standard:5,reptile_house:3|snapping_2
490|15|3|0|0|6|0|0|reptile,australia|-|standard:3,reptile_house:2|scavenging:2
491|12|2|0|1|5|0|0|reptile,australia|-|standard:2,reptile_house:1|sprint:1
492|10|2|0|1|5|0|0|reptile,australia|australia,science|standard:2,reptile_house:1|venom:2
493|6|1|0|1|3|0|0|reptile,australia|-|standard:1,reptile_house:0|-
494|20|5|0|0|8|0|0|bird,africa|-|standard:5,large_bird_aviary:4|sprint:2
495|14|4|0|0|4|1|0|bird,africa|-|standard:4,large_bird_aviary:1|-
496|10|3|0|0|4|0|0|bird,africa|-|standard:3,large_bird_aviary:1|scavenging:2
497|15|2|1|0|6|0|0|bird,africa|-|standard:2|posturing:1
498|9|1|0|0|3|1|0|bird,africa|science*2|standard:1,large_bird_aviary:1|-
499|16|5|0|0|6|0|0|bird,asia|-|standard:5,large_bird_aviary:1|scavenging:3
500|20|4|0|1|5|1|1|bird,asia|science|standard:4,large_bird_aviary:1|scavenging:3
501|18|3|0|0|7|0|0|bird,asia|asia|standard:3|posturing:2
502|13|2|0|0|6|0|0|bird,asia|-|standard:2|boost_building
503|11|1|0|0|4|0|1|bird,asia|bird*2|standard:1|perception_4
504|17|5|0|1|7|0|1|bird,americas|bird|standard:5,large_bird_aviary:1|scavenging:4
505|23|4|1|0|8|0|0|bird,americas|animalsii|standard:4,large_bird_aviary:1|determination
506|12|3|0|0|9|0|0|bird,americas|bird*3|standard:3,large_bird_aviary:1|scavenging:5
507|12|2|0|0|5|0|0|bird,americas|-|standard:2|sprint:1
508|16|1|0|0|4|0|0|bird,americas|partner_zoo|standard:1|posturing:3
509|20|5|0|1|7|0|0|bird,europe|animalsii|standard:5,large_bird_aviary:1|determination
510|9|4|0|0|4|0|0|bird,europe|europe|standard:4,large_bird_aviary:1|multiplier_building
511|16|3|1|0|7|0|0|bird,europe|-|standard:3|posturing:1
512|10|2|0|0|4|0|0|bird,europe|partner_zoo|standard:2|perception_4
513|12|1|0|0|3|0|0|bird,europe|-|standard:1|perception_4
514|22|5|0|0|7|0|0|bird,australia|australia*2|standard:5|peacocking
515|13|4|2|0|5|0|0|bird,australia|-|standard:4|action_building
516|12|3|0|0|6|0|0|bird,australia|partner_zoo|standard:3|multiplier_building
517|9|2|0|0|0|0|0|bird,australia|australia|standard:2|iconic_animal:australia
518|15|1|0|0|5|0|0|bird,australia|-|standard:1|posturing:1
519|7|1|0|0|0|0|0|petting_zoo_animal|-|petting_zoo:1|petting_zoo_animal
520|7|1|0|0|0|0|0|petting_zoo_animal|-|petting_zoo:1|petting_zoo_animal
521|7|1|0|0|0|0|1|petting_zoo_animal|-|petting_zoo:1|petting_zoo_animal
522|7|1|0|0|0|0|0|petting_zoo_animal|-|petting_zoo:1|inventive:1,petting_zoo_animal
523|7|1|0|0|0|0|0|petting_zoo_animal|-|petting_zoo:1|petting_zoo_animal
524|7|1|0|0|0|0|0|petting_zoo_animal|-|petting_zoo:1|digging:1,petting_zoo_animal
525|7|1|0|0|0|0|0|petting_zoo_animal|-|petting_zoo:1|petting_zoo_animal
526|7|1|0|0|0|0|0|petting_zoo_animal|-|petting_zoo:1|petting_zoo_animal
527|7|1|0|0|0|0|0|petting_zoo_animal|-|petting_zoo:1|petting_zoo_animal
528|7|1|0|0|0|0|0|petting_zoo_animal|-|petting_zoo:1|pouch:1,petting_zoo_animal
""".strip().splitlines()


def counted_tags(value: str) -> dict:
    if value == "-":
        return {}
    result = {}
    for token in value.split(","):
        tag, _, count = token.partition("*")
        result[tag] = int(count or 1)
    return result


def printed_abilities(value: str) -> list:
    if value == "-":
        return []
    result = []
    numeric_parameters = {
        "sprint": "draw_count", "scavenging": "draw_count", "sun_bathing": "maximum_cards",
        "pouch": "maximum_cards", "venom": "tokens_per_target", "inventive": "x_tokens",
        "digging": "maximum_repetitions", "posturing": "maximum_buildings",
    }
    for token in value.split(","):
        ability, _, parameter = token.partition(":")
        params = {}
        if ability in numeric_parameters:
            params[numeric_parameters[ability]] = int(parameter)
        if ability == "sun_bathing":
            params["money_per_card"] = 4
        if ability == "iconic_animal":
            params = {"continent": parameter, "maximum_appeal": 8}
        timing = "after_action" if ability in {
            "clever", "boost_cards", "boost_building", "determination", "action_building",
        } else "immediate"
        result.append((ability, params, timing))
    return result


class ArkNovaSecond64AnimalReferenceTests(unittest.TestCase):
    def test_printed_cost_rewards_and_icon_counts_for_all_64_animals(self):
        self.assertEqual([row.split("|")[0] for row in PRINTED_ROWS],
                         [str(card_id) for card_id in range(465, 529)])
        for row in PRINTED_ROWS:
            fields = row.split("|")
            with self.subTest(card_id=fields[0]):
                card = rules.ANIMAL_CARDS[fields[0]]
                self.assertEqual(card["play"]["base_money_cost"], int(fields[1]))
                self.assertEqual(card["printed_rewards"], dict(zip(
                    ("appeal", "conservation", "reputation"), map(int, fields[5:8]),
                )))
                self.assertEqual(card["printed_reward_timing"], "immediate")
                self.assertEqual({icon["tag"]: icon["count"] for icon in card["icons"]}, counted_tags(fields[8]))

    def test_printed_conditions_for_all_64_animals(self):
        for row in PRINTED_ROWS:
            fields = row.split("|")
            with self.subTest(card_id=fields[0]):
                expected = []
                for tag, count in counted_tags(fields[9]).items():
                    if tag == "partner_zoo":
                        expected.append({"kind": "partner_zoo", "minimum": count})
                    elif tag == "animalsii":
                        expected.append({"kind": "action_upgrade", "action": "animals", "minimum_level": 2})
                    else:
                        expected.append({"kind": "tag_count", "tag": tag, "minimum": count})
                self.assertCountEqual(rules.ANIMAL_CARDS[fields[0]]["play"]["conditions"], expected)
                self.assertEqual(
                    rules.ANIMAL_CARDS[fields[0]]["play"]["minimum_action_level_from_card_condition"],
                    2 if "animalsii" in fields[9] else 1,
                )

    def test_each_printed_condition_is_required_even_at_maximum_reputation(self):
        baseline = fixtures.ArkNovaGameTests().make_state()["players"]["p1"]
        for row in PRINTED_ROWS:
            fields = row.split("|")
            card_id = fields[0]
            printed = counted_tags(fields[9])
            player = copy.deepcopy(baseline)
            player["reputation"] = 15
            player["tags"] = {tag: count for tag, count in printed.items()
                              if tag not in {"partner_zoo", "animalsii"}}
            player["partner_zoos"] = ["africa"] if "partner_zoo" in printed else []
            player["action_cards"]["animals"]["upgraded"] = "animalsii" in printed
            card = rules.ANIMAL_CARDS[card_id]
            with self.subTest(card_id=card_id, condition="all met"):
                self.assertTrue(rules._card_conditions_met(player, card))
            for condition in printed:
                insufficient = copy.deepcopy(player)
                if condition == "partner_zoo":
                    insufficient["partner_zoos"] = []
                elif condition == "animalsii":
                    insufficient["action_cards"]["animals"]["upgraded"] = False
                else:
                    insufficient["tags"][condition] -= 1
                with self.subTest(card_id=card_id, missing=condition):
                    self.assertFalse(rules._card_conditions_met(insufficient, card))

    def test_printed_habitat_and_special_capacity_for_all_64_animals(self):
        for row in PRINTED_ROWS:
            fields = row.split("|")
            with self.subTest(card_id=fields[0]):
                card = rules.ANIMAL_CARDS[fields[0]]
                self.assertEqual(card["animal_size"], int(fields[2]))
                self.assertEqual(card["placement"]["adjacent_to"], {"water": int(fields[3]), "rock": int(fields[4])})
                expected = [{"type": item.split(":")[0], "required_spaces": int(item.split(":")[1])}
                            for item in fields[10].split(",")]
                self.assertEqual(card["enclosure_options"], expected)

    def test_printed_ability_parameters_and_timing_for_all_64_animals(self):
        for row in PRINTED_ROWS:
            fields = row.split("|")
            with self.subTest(card_id=fields[0]):
                actual = [(ability["ability"], ability["parameters"], ability["timing"])
                          for ability in rules.ANIMAL_CARDS[fields[0]]["abilities"]]
                self.assertEqual(actual, printed_abilities(fields[11]))

    def anaconda_state(self, cells):
        helper = fixtures.ArkNovaGameTests()
        state = helper.make_state()
        player = state["players"]["p1"]
        player["hand"] = []
        player["partner_zoos"] = ["africa"]
        player["action_cards"]["build"]["upgraded"] = True
        helper.set_slot(state, "p1", "animals", 2)
        building = rules._place_building(state, "p1", {
            "building_type": "standard_enclosure", "size": 2, "cells": cells,
        }, [], free=True)
        helper.add_hand_card(state, "p1", "482")
        return state, {"type": "animals", "plays": [{"card_id": "482", "enclosure_id": building["id"]}]}

    def test_anaconda_plays_by_water_without_rock_and_contributes_no_rock_icon(self):
        state, action = self.anaconda_state(["A3", "A4"])
        self.assertEqual(rules._adjacent_terrain(["A3", "A4"], "water"), 1)
        self.assertEqual(rules._adjacent_terrain(["A3", "A4"], "rock"), 0)
        _, error = rules.ArkNovaGame.apply_action(state, "p1", action)
        self.assertIsNone(error)
        player = state["players"]["p1"]
        self.assertIn("482", player["played_animals"])
        self.assertEqual(player["money"], 12)
        self.assertEqual(player["appeal"], 6)
        self.assertEqual(player["tags"].get("water", 0), 1)
        self.assertEqual(player["tags"].get("rock", 0), 0)

    def test_anaconda_still_rejects_a_dry_enclosure_transactionally(self):
        state, action = self.anaconda_state(["D6", "E6"])
        self.assertEqual(rules._adjacent_terrain(["D6", "E6"], "water"), 0)
        before = copy.deepcopy(state)
        _, error = rules.ArkNovaGame.apply_action(state, "p1", action)
        self.assertIn("water", error)
        self.assertEqual(state, before)

    def test_all_ten_petting_animals_require_one_free_petting_zoo_space(self):
        player = fixtures.ArkNovaGameTests().make_state()["players"]["p1"]
        for card_id in map(str, range(519, 529)):
            for kind in ("standard_enclosure", "reptile_house", "large_bird_aviary", "petting_zoo"):
                with self.subTest(card_id=card_id, kind=kind):
                    building = {"id": "test", "building_type": kind, "size": 5, "capacity": 3,
                                "used_capacity": 2, "occupied_by": [], "cells": ["A3"]}
                    player["map"]["buildings"] = [building]
                    _, _, error = rules._enclosure_for_animal(player, rules.ANIMAL_CARDS[card_id], "test")
                    if kind == "petting_zoo":
                        self.assertIsNone(error)
                        building["used_capacity"] = 3
                        _, _, error = rules._enclosure_for_animal(player, rules.ANIMAL_CARDS[card_id], "test")
                        self.assertIn("capacity", error)
                    else:
                        self.assertIn("enclosure type", error)

    def test_hypnosis_card_text_distinguishes_target_selection_from_delayed_action(self):
        for card_id in ("475", "485"):
            with self.subTest(card_id=card_id):
                card = rules.ANIMAL_CARDS[card_id]
                for text in (card["raw"]["effect_zh"], card["abilities"][0]["text_zh"]):
                    self.assertIn("先确定", text)
                    self.assertIn("当前行动全部结束并移动行动牌后", text)
                    self.assertNotIn("立即执行", text)
                    self.assertNotIn("然后继续结算本动物", text)


if __name__ == "__main__":
    unittest.main()
