"""Practice bots using only the requesting player's filtered view."""

import random
from typing import Dict, Optional
from game.deception_data import CARDS_BY_ID, TILES_BY_ID


def _tags(means_id: str, clue_id: str) -> set:
    return set(CARDS_BY_ID[means_id]['tags'] + CARDS_BY_ID[clue_id]['tags'])


def _best_option(tile: Dict, solution: Dict) -> int:
    tags = set(CARDS_BY_ID[solution['means_id']]['tags']) if tile['id'] == 'cause' else _tags(solution['means_id'], solution['clue_id'])
    return max(range(6), key=lambda i: len(tags & set(TILES_BY_ID[tile['id']]['options'][i]['tags'])))


def choose_action(view: Dict) -> Optional[Dict]:
    legal, own = view['legal_actions'], view['private']
    if not legal or not own:
        return None
    base = {'case_token': view['case_token'], 'round': view['round']}
    def move(kind, **fields):
        return {**base, 'type': kind, **fields}
    if 'choose_crime' in legal:
        hand = next(p for p in view['players'] if p['player_id'] == view['you'])
        return move('choose_crime', means_id=random.choice(hand['means'])['id'], clue_id=random.choice(hand['clues'])['id'])
    if 'choose_location' in legal:
        tags = _tags(own['solution']['means_id'], own['solution']['clue_id'])
        tile = max(view['locations'], key=lambda t: max(len(tags & set(o['tags'])) for o in TILES_BY_ID[t['id']]['options']))
        return move('choose_location', tile_id=tile['id'])
    if 'place_marker' in legal:
        tile = next(tile for tile in view['scenes'] if tile['marker'] is None)
        return move('place_marker', tile_id=tile['id'], option=_best_option(tile, own['solution']))
    if 'replace_scene' in legal:
        tile = view['replacement']
        candidates = [t for t in view['scenes'] if not t['fixed']]
        # Replace the least informative existing scene according to this bot's legal knowledge.
        tags = _tags(own['solution']['means_id'], own['solution']['clue_id'])
        old = min(candidates, key=lambda t: len(tags & set(TILES_BY_ID[t['id']]['options'][t['marker']]['tags'])))
        return move('replace_scene', tile_id=tile['id'], replace_id=old['id'], option=_best_option(tile, own['solution']))
    if 'start_presentations' in legal:
        return move('start_presentations')
    if 'identify_witness' in legal:
        candidates = [p['player_id'] for p in view['players'] if p['player_id'] not in own['allies'] and p['player_id'] != view['forensic_id']]
        return move('identify_witness', target_id=random.choice(candidates))
    if 'next_round' in legal:
        return move('next_round')
    if 'end_presentation' not in legal:
        return None
    if 'accuse' in legal and view['round'] >= 2:
        suspects = own.get('suspects')
        attempted = {(a['target_id'], a['means_id'], a['clue_id']) for a in view['accusations']}
        options = []
        for player in view['players']:
            pid = player['player_id']
            if pid == view['you'] or (suspects and pid not in suspects):
                continue
            if own['role'] in ('murderer', 'accomplice') and pid in own['allies']:
                continue
            for means in player['means']:
                for clue in player['clues']:
                    key = (pid, means['id'], clue['id'])
                    if key in attempted:
                        continue
                    tags = _tags(means['id'], clue['id'])
                    score = 0
                    for tile in view['scenes']:
                        if tile['marker'] is None:
                            continue
                        match_tags = set(CARDS_BY_ID[means['id']]['tags']) if tile['id'] == 'cause' else tags
                        matches = match_tags & set(TILES_BY_ID[tile['id']]['options'][tile['marker']]['tags'])
                        score += (4 if tile['id'] == 'cause' else 1) * bool(matches)
                    options.append((score, key))
        if options:
            score = max(value[0] for value in options)
            pid, means, clue = random.choice([key for value, key in options if value == score])
            return move('accuse', target_id=pid, means_id=means, clue_id=clue)
    return move('end_presentation')
