from __future__ import annotations

import copy
import unittest

from game import ark_nova as rules
from game import ark_nova_effects as effects
from tests.test_ark_nova_effects import game_state, context, player_state


# Independent reference, audited 2026-09-22 against all 64 printed card scans:
# https://github.com/PixelT/ArkNovaCardsManager/tree/67686265a98d423c6182dda63d967cdd92ffeb85/src/images/animal
# Cross-checked with the typed card transcription (not this repository's source):
# https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards/blob/6f67a11b9a038d75bb327cd1abfe20165d6c0055/src/data/Animals.ts
# Scans settle two external data issues: 463 costs 11, not PixelT's JSON value
# of 14; 464 has no rock requirement, despite Ender's NaN. The numeral on the
# low-resolution 462 enclosure hex is unreadable; both transcriptions say 3.
# Fields: id|cost|size|water|rock|appeal|conservation|reputation|tags|conditions|abilities
# Asterisks express repeated icons. These are all standard-enclosure-only animals.
PRINTED_ROWS = """
401|17|5|0|0|6|0|0|predator*2,africa|-|sprint:3
402|16|4|0|0|9|0|0|predator,africa|predator*3|pack
403|20|3|0|1|7|1|0|predator,africa|partner_zoo|hunter:4
404|9|2|0|0|4|0|0|predator,africa|-|hunter:2
405|8|1|0|0|3|0|0|predator,africa|-|clever
406|30|5|0|0|10|2|1|predator,asia|asia*3|-
407|26|4|2|0|8|2|1|predator,asia|science*2|-
408|14|3|0|0|6|0|0|predator,bear,asia|-|boost_association
409|16|2|0|0|5|0|0|predator,bear,asia|partner_zoo|action_association
410|7|1|0|0|3|0|0|predator,asia|-|hunter:1
411|22|5|0|0|9|0|0|predator,bear,americas|predator*2,animalsii|inventive_bear,full_throated
412|16|4|0|0|8|0|0|predator,americas|americas|hunter:4
413|10|3|0|1|5|0|0|predator,americas|-|jumping:3
414|11|2|0|1|4|0|0|predator,bear,americas|-|inventive:1
415|11|1|0|0|4|0|0|predator,bear,americas|-|boost_association
416|20|5|1|0|8|0|0|predator,bear,europe|bear,animalsii|multiplier_association,full_throated
417|12|4|0|0|4|0|0|predator,europe|-|pack
418|11|3|0|0|2|0|0|predator,europe|europe*2|iconic_animal:europe
419|5|2|0|0|3|0|0|predator,europe|-|boost_animal
420|4|1|0|0|3|0|0|predator,europe|europe|hunter:1
421|17|5|1|1|8|0|0|predator,australia|animalsii|full_throated
422|18|4|1|0|7|1|0|predator,australia|partner_zoo|sun_bathing:3
423|17|3|1|0|6|0|0|predator,australia|-|pack
424|13|2|0|0|3|0|0|predator,australia|-|pack
425|11|1|0|0|4|0|1|predator,australia|science|pouch:1
426|36|5|0|0|10|0|1|herbivore,africa*2|animalsii|resistance
427|24|4|0|1|9|0|0|herbivore,africa|science|assertion
428|16|3|0|0|7|0|0|herbivore,africa|-|boost_sponsors
429|12|2|0|0|6|0|1|herbivore,africa|africa*3|boost_sponsors,flock_animal:2
430|15|2|1|0|6|0|0|herbivore,africa|partner_zoo|action_sponsors
431|33|5|1|0|8|1|0|herbivore,asia*2|animalsii|resistance
432|25|4|0|0|9|0|0|herbivore,asia|animalsii|assertion
433|27|3|0|0|10|2|1|herbivore,bear,asia|herbivore,bear,partner_zoo|-
434|16|2|0|0|6|0|0|herbivore,bear,asia|science*2|multiplier_sponsors
435|17|2|0|0|5|0|1|herbivore,asia|-|digging:3
436|18|5|0|0|4|0|0|herbivore,americas*2|americas*3|iconic_animal:americas
437|13|4|0|0|5|0|0|herbivore,americas|americas|sponsor_magnet
438|12|3|0|0|5|0|0|herbivore,americas|-|flock_animal:3
439|10|2|0|0|4|0|0|herbivore,americas|-|flock_animal:2
440|15|2|0|1|4|1|0|herbivore,americas|-|digging:2
441|19|5|0|0|6|0|0|herbivore,europe*2|partner_zoo|sponsor_magnet
442|19|4|0|0|7|0|0|herbivore,europe|herbivore*2|multiplier_sponsors,flock_animal:4
443|12|3|0|0|5|0|0|herbivore,europe|-|flock_animal:3
444|10|2|0|2|5|0|0|herbivore,europe|-|jumping:2
445|8|1|0|0|3|0|0|herbivore,europe|-|digging:2
446|25|5|2|0|9|1|0|herbivore,australia*2|animalsii|digging:4
447|23|4|0|0|7|0|0|herbivore,australia|-|pouch:2,flock_animal:4
448|21|3|0|1|8|0|1|herbivore,bear,australia|australia|pouch:2
449|10|2|1|0|4|0|0|herbivore,australia|-|venom:1
450|9|2|0|0|4|0|0|herbivore,australia|-|pouch:1
451|32|5|0|1|10|2|0|primate,asia|primate*2,animalsii|dominance:primate
452|10|1|0|0|1|0|0|primate,africa|africa*2|iconic_animal:africa
453|20|4|0|0|8|0|0|primate,africa|africa|action_cards
454|12|3|0|1|6|0|0|primate,africa|-|sun_bathing:3
455|13|3|0|0|6|0|0|primate,africa|-|clever
456|13|2|0|0|6|0|0|primate,africa|partner_zoo|pilfering_1
457|28|5|0|0|9|2|0|primate*2,africa|primate*3|multiplier_cards
458|18|3|1|0|7|0|0|primate,asia|asia|pilfering_2
459|17|4|0|0|7|0|1|primate,asia|science|inventive_primate
460|12|2|0|0|5|0|0|primate,asia|-|clever
461|14|1|0|0|3|0|2|primate,asia|partner_zoo|jumping:4
462|13|3|0|1|6|0|0|primate,asia|-|jumping:3
463|11|2|0|0|5|0|0|primate,americas|partner_zoo|pilfering_1
464|17|4|0|0|6|1|0|primate,americas|primate|inventive_primate
""".strip().splitlines()


def icon_counts(value: str) -> dict:
    if value == '-':
        return {}
    result = {}
    for token in value.split(','):
        name, _, count = token.partition('*')
        result[name] = int(count or 1)
    return result


def printed_conditions(value: str) -> list:
    result = []
    for tag, count in icon_counts(value).items():
        if tag == 'partner_zoo':
            result.append({'kind': 'partner_zoo', 'minimum': count})
        elif tag == 'animalsii':
            result.append({'kind': 'action_upgrade', 'action': 'animals', 'minimum_level': 2})
        else:
            result.append({'kind': 'tag_count', 'tag': tag, 'minimum': count})
    return result


def printed_abilities(value: str) -> list:
    if value == '-':
        return []
    result = []
    for token in value.split(','):
        ability, _, parameter = token.partition(':')
        params = {}
        if ability == 'sprint':
            params = {'draw_count': int(parameter)}
        elif ability == 'hunter':
            params = {'reveal_count': int(parameter)}
        elif ability == 'jumping':
            params = {'break_steps': int(parameter), 'money': int(parameter)}
        elif ability == 'inventive':
            params = {'x_tokens': int(parameter)}
        elif ability == 'iconic_animal':
            params = {'continent': parameter, 'maximum_appeal': 8}
        elif ability == 'sun_bathing':
            params = {'maximum_cards': int(parameter), 'money_per_card': 4}
        elif ability == 'pouch':
            params = {'maximum_cards': int(parameter)}
        elif ability == 'flock_animal':
            params = {'minimum_host_enclosure_size': int(parameter)}
        elif ability == 'digging':
            params = {'maximum_repetitions': int(parameter)}
        elif ability == 'venom':
            params = {'tokens_per_target': int(parameter)}
        elif ability == 'dominance':
            params = {'project_tag': parameter}
        timing = 'immediate'
        if ability == 'clever' or ability.startswith(('boost_', 'action_')):
            timing = 'after_action'
        elif ability == 'flock_animal':
            timing = 'during_placement'
        result.append((ability, params, timing))
    return result


class ArkNovaFirst64AnimalReferenceTests(unittest.TestCase):
    def test_every_card_matches_independently_checked_printed_fields(self) -> None:
        self.assertEqual([row.split('|')[0] for row in PRINTED_ROWS],
                         [str(card_id) for card_id in range(401, 465)])
        for row in PRINTED_ROWS:
            fields = row.split('|')
            card_id = fields[0]
            cost, size, water, rock, appeal, conservation, reputation = map(int, fields[1:8])
            with self.subTest(card_id=card_id):
                card = rules.ANIMAL_CARDS[card_id]
                self.assertEqual(card['play']['base_money_cost'], cost)
                self.assertEqual(card['animal_size'], size)
                self.assertEqual(card['placement']['adjacent_to'], {'water': water, 'rock': rock})
                self.assertEqual(card['enclosure_options'], [{'type': 'standard', 'required_spaces': size}])
                self.assertEqual(card['printed_rewards'], {
                    'appeal': appeal, 'conservation': conservation, 'reputation': reputation,
                })
                self.assertEqual(card['printed_reward_timing'], 'immediate')
                self.assertEqual({icon['tag']: icon['count'] for icon in card['icons']},
                                 icon_counts(fields[8]))
                self.assertEqual(card['play']['conditions'], printed_conditions(fields[9]))
                self.assertEqual(card['play']['minimum_action_level_from_card_condition'],
                                 2 if 'animalsii' in fields[9] else 1)
                self.assertEqual([(a['ability'], a['parameters'], a['timing'])
                                  for a in card['abilities']], printed_abilities(fields[10]))
                self.assertEqual(effects.ANIMAL_BY_ID[card_id], card)

    def test_each_printed_condition_is_required_by_the_engine(self) -> None:
        for row in PRINTED_ROWS:
            fields = row.split('|')
            card_id = fields[0]
            printed = icon_counts(fields[9])
            player = player_state()
            player['tags'] = {tag: count for tag, count in printed.items()
                              if tag not in {'partner_zoo', 'animalsii'}}
            if 'partner_zoo' in printed:
                player['partner_zoos'] = ['africa']
            if 'animalsii' in printed:
                player['action_cards']['animals']['upgraded'] = True
            card = rules.ANIMAL_CARDS[card_id]
            with self.subTest(card_id=card_id, condition='all met'):
                self.assertTrue(rules._card_conditions_met(player, card))
            for condition in printed:
                insufficient = copy.deepcopy(player)
                if condition == 'partner_zoo':
                    insufficient['partner_zoos'] = []
                elif condition == 'animalsii':
                    insufficient['action_cards']['animals']['upgraded'] = False
                else:
                    insufficient['tags'][condition] -= 1
                with self.subTest(card_id=card_id, missing=condition):
                    self.assertFalse(rules._card_conditions_met(insufficient, card))

    def test_printed_jumping_distances_and_money_resolve_for_each_card(self) -> None:
        for card_id, amount in [('413', 3), ('444', 2), ('461', 4), ('462', 3)]:
            with self.subTest(card_id=card_id):
                state = game_state()
                state['break_position'] = 1
                before = state['players']['p1']['money']
                effects.execute_ability('jumping', context(state, card_id))
                self.assertEqual(state['break_position'], 1 + amount)
                self.assertEqual(state['players']['p1']['money'], before + amount)

    def test_printed_iconic_animals_count_all_zoos_and_cap_at_eight(self) -> None:
        for card_id, continent in [('418', 'europe'), ('436', 'americas'), ('452', 'africa')]:
            for other_icons, expected in [(2, 5), (8, 8)]:
                with self.subTest(card_id=card_id, other_icons=other_icons):
                    state = game_state()
                    state['players']['p1']['tags'] = {continent: 3}
                    state['players']['p2']['tags'] = {continent: other_icons}
                    effects.execute_ability('iconic_animal', context(state, card_id))
                    self.assertEqual(state['players']['p1']['appeal'], expected)

    def test_bear_and_primate_inventive_use_their_distinct_printed_counts(self) -> None:
        state = game_state()
        state['players']['p1']['tags'] = {'bear': 1}
        state['players']['p2']['tags'] = {'bear': 4}
        effects.execute_ability('inventive_bear', context(state, '411'))
        self.assertEqual(state['players']['p1']['x_tokens'], 3)
        for card_id in ['459', '464']:
            for icons, expected in [(1, 1), (2, 1), (3, 2), (4, 2), (5, 3), (6, 3)]:
                with self.subTest(card_id=card_id, primate_icons=icons):
                    state = game_state()
                    state['players']['p1']['tags'] = {'primate': icons}
                    state['players']['p2']['tags'] = {'primate': 20}
                    effects.execute_ability('inventive_primate', context(state, card_id))
                    self.assertEqual(state['players']['p1']['x_tokens'], expected)


if __name__ == '__main__':
    unittest.main()
