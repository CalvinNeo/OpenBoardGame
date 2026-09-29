"""Deception: Murder in Hong Kong, with an original bilingual practice deck."""

import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple

from game.deception_data import (
    CAUSE, CLUES, LOCATIONS, MEANS, SCENES, TILES_BY_ID,
    public_card, public_tile,
)

CONFIG_SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'properties': {
        'cards_per_type': {'type': 'integer', 'enum': [3, 4, 5], 'default': 4},
        'accomplice': {'type': 'boolean', 'default': False},
        'witness': {'type': 'boolean', 'default': False},
        'seed': {'oneOf': [{'type': 'integer'}, {'type': 'string', 'minLength': 1, 'maxLength': 80}]},
    },
}
ACTION_FIELDS = {
    'choose_crime': {'means_id', 'clue_id'}, 'choose_location': {'tile_id'},
    'place_marker': {'tile_id', 'option'},
    'replace_scene': {'tile_id', 'replace_id', 'option'},
    'start_presentations': set(), 'end_presentation': set(), 'next_round': set(),
    'accuse': {'target_id', 'means_id', 'clue_id'},
    'identify_witness': {'target_id'}, 'discuss': {'text'},
}
ACTION_SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'required': ['type', 'case_token', 'round'],
    'properties': {
        'type': {'enum': list(ACTION_FIELDS)},
        'case_token': {'type': 'string', 'minLength': 1, 'maxLength': 80},
        'round': {'type': 'integer', 'minimum': 1, 'maximum': 3},
        **{field: {'type': 'string', 'minLength': 1, 'maxLength': 80}
           for field in ('means_id', 'clue_id', 'tile_id', 'replace_id', 'target_id')},
        'option': {'type': 'integer', 'minimum': 0, 'maximum': 5},
        'text': {'type': 'string', 'minLength': 1, 'maxLength': 300},
    },
}


def _config(config: Optional[Dict], count: int) -> Dict:
    cfg = {'cards_per_type': 4, 'accomplice': False, 'witness': False}
    if config is not None:
        if not isinstance(config, dict) or set(config) - set(CONFIG_SCHEMA['properties']):
            raise ValueError('invalid Deception configuration')
        cfg.update(config)
    if type(cfg['cards_per_type']) is not int or cfg['cards_per_type'] not in (3, 4, 5):
        raise ValueError('cards_per_type must be 3, 4, or 5')
    if any(type(cfg[key]) is not bool for key in ('accomplice', 'witness')):
        raise ValueError('role options must be boolean')
    if cfg['witness'] and not cfg['accomplice']:
        raise ValueError('Witness requires Accomplice')
    if count < 6 and (cfg['accomplice'] or cfg['witness']):
        raise ValueError('Accomplice and Witness require at least 6 players')
    seed = cfg.get('seed')
    if 'seed' in cfg and type(seed) is not int and not (isinstance(seed, str) and 1 <= len(seed) <= 80):
        raise ValueError('invalid seed')
    return cfg


def _role_id(state: Dict, role: str) -> Optional[str]:
    return next((pid for pid, value in state['roles'].items() if value == role), None)


def _finish(state: Dict, team: str, reason: str) -> None:
    state.update(phase='game_over', game_over=True, winner_team=team, end_reason=reason, current_turn=None)
    state['winner_ids'] = [pid for pid in state['order']
                           if (state['roles'][pid] in ('murderer', 'accomplice')) == (team == 'murderer')]


def _record(state: Dict, kind: str, **fields) -> Dict:
    entry = {'type': kind, 'round': state['round'], **fields}
    state['history'].append(entry)
    # Keep forensic evidence and accusations even during a long text discussion.
    message_indices = [i for i, item in enumerate(state['history']) if item['type'] == 'message']
    if len(message_indices) > 120:
        del state['history'][message_indices[0]]
    return entry


def _can_discuss(state: Dict, pid: str) -> bool:
    if pid == state['forensic_id']:
        return False
    if state['phase'] == 'reversal':
        return state['roles'][pid] in ('murderer', 'accomplice')
    if state['phase'] == 'presentation':
        return state['current_turn'] == pid
    return state['phase'] in ('evidence', 'discussion', 'round_review') and any(
        tile['marker'] is not None for tile in state['scenes'])


class DeceptionGame:
    game_id = 'deception'
    min_players = 4
    max_players = 12

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 4 <= len(players) <= 12:
            raise ValueError('Deception requires 4 to 12 players')
        meta = {p['player_id']: dict(p) for p in players}
        if len(meta) != len(players):
            raise ValueError('player IDs must be unique')
        cfg = _config(config, len(players))
        rng = random.Random(cfg.get('seed', secrets.token_hex(16)))
        order = sorted(meta, key=lambda pid: (meta[pid].get('seat', 0), pid))
        role_deck = ['forensic', 'murderer']
        role_deck += ['accomplice'] if cfg['accomplice'] else []
        role_deck += ['witness'] if cfg['witness'] else []
        role_deck += ['investigator'] * (len(order) - len(role_deck))
        rng.shuffle(role_deck)
        roles = dict(zip(order, role_deck))
        forensic = next(pid for pid in order if roles[pid] == 'forensic')
        decks = [[card['id'] for card in source] for source in (MEANS, CLUES)]
        for deck in decks:
            rng.shuffle(deck)
        hands = {}
        for pid in order:
            hands[pid] = {kind: [deck.pop() for _ in range(cfg['cards_per_type'])]
                          if pid != forensic else [] for kind, deck in zip(('means', 'clues'), decks)}
        scenes = [tile['id'] for tile in SCENES]
        rng.shuffle(scenes)
        return {
            'version': 1, 'config': cfg, 'case_token': secrets.token_hex(16), 'round': 1,
            'revision': 0, 'phase': 'crime', 'order': order, 'meta': meta, 'roles': roles,
            'forensic_id': forensic, 'hands': hands, 'solution': None,
            'badges': {pid: pid != forensic for pid in order}, 'scenes': [], 'scene_deck': scenes,
            'replacement': None, 'discarded_scenes': [], 'history': [], 'accusations': [],
            'current_turn': None, 'presentation_order': order[order.index(forensic) + 1:] + order[:order.index(forensic)],
            'presentation_index': 0, 'next_round_ready': [], 'witness_guess': None,
            'winner_ids': [], 'winner_team': None, 'end_reason': None, 'game_over': False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state['roles'] or state['game_over']:
            return []
        phase, role = state['phase'], state['roles'][player_id]
        legal = []
        if phase == 'crime' and role == 'murderer':
            legal.append('choose_crime')
        if role == 'forensic':
            if phase == 'scene_setup':
                legal.append('choose_location')
            if phase == 'evidence':
                legal.append('replace_scene' if state['replacement'] else 'place_marker')
            if phase == 'discussion':
                legal.append('start_presentations')
        if phase == 'presentation' and player_id == state['current_turn']:
            legal.append('end_presentation')
        if phase == 'round_review' and player_id not in state['next_round_ready']:
            legal.append('next_round')
        if (state['solution'] and state['badges'][player_id]
                and phase in ('scene_setup', 'evidence', 'discussion', 'presentation', 'round_review')):
            legal.append('accuse')
        if phase == 'reversal' and role == 'murderer':
            legal.append('identify_witness')
        if _can_discuss(state, player_id):
            legal.append('discuss')
        return legal

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not isinstance(action.get('type'), str):
            return [], 'invalid action'
        kind = action['type']
        fields = ACTION_FIELDS.get(kind)
        if fields is None or set(action) != fields | {'type', 'case_token', 'round'}:
            return [], 'invalid action fields'
        if (action['case_token'] != state['case_token'] or type(action['round']) is not int
                or action['round'] != state['round']):
            return [], 'stale case or round; refresh your view'
        if player_id not in state['roles']:
            return [], 'unknown player'
        if kind not in DeceptionGame.get_legal_actions(state, player_id):
            return [], 'action not available'
        for field in fields - {'option'}:
            maximum = 300 if field == 'text' else 80
            if not isinstance(action[field], str) or not 1 <= len(action[field].strip()) <= maximum:
                return [], 'invalid ' + field
        if 'option' in fields and (type(action['option']) is not int or not 0 <= action['option'] < 6):
            return [], 'invalid marker option'
        # Complete every validation before mutation, including schema-bypass callers.
        if kind in ('choose_crime', 'accuse'):
            target = player_id if kind == 'choose_crime' else action['target_id']
            if target not in state['hands'] or (kind == 'accuse' and target == player_id):
                return [], 'choose another player'
            hand = state['hands'][target]
            if action['means_id'] not in hand['means'] or action['clue_id'] not in hand['clues']:
                return [], 'choose one means and one clue from the same player'
        if kind == 'choose_location' and action['tile_id'] not in {tile['id'] for tile in LOCATIONS}:
            return [], 'invalid location tile'
        if kind == 'place_marker':
            scene = next((tile for tile in state['scenes'] if tile['id'] == action['tile_id']), None)
            if scene is None or scene['marker'] is not None:
                return [], 'this tile already has a marker or is unavailable'
        if kind == 'replace_scene':
            scene = next((tile for tile in state['scenes'] if tile['id'] == action['replace_id']), None)
            if (scene is None or TILES_BY_ID[scene['id']]['fixed']
                    or state['replacement'] != action['tile_id']):
                return [], 'replace an ordinary scene using the drawn tile'
        if kind == 'identify_witness' and (action['target_id'] not in state['roles'] or action['target_id'] == player_id):
            return [], 'choose another player'

        entry = None
        if kind == 'choose_crime':
            state['solution'] = {'player_id': player_id, 'means_id': action['means_id'], 'clue_id': action['clue_id']}
            state['phase'] = 'scene_setup'
            entry = _record(state, 'crime_selected')  # Never expose the actor or cards.
        elif kind == 'choose_location':
            state['scenes'] = [{'id': tile_id, 'marker': None} for tile_id in
                               [CAUSE['id'], action['tile_id']] + [state['scene_deck'].pop() for _ in range(4)]]
            state['phase'] = 'evidence'
            entry = _record(state, 'location', tile_id=action['tile_id'])
        elif kind == 'place_marker':
            scene['marker'] = action['option']
            entry = _record(state, 'marker', tile_id=scene['id'], option=action['option'])
            if all(tile['marker'] is not None for tile in state['scenes']):
                state['phase'] = 'discussion'
        elif kind == 'replace_scene':
            old = {**scene, 'round': state['round'] - 1}
            state['discarded_scenes'].append(old)
            scene.update(id=action['tile_id'], marker=action['option'])
            state['replacement'] = None
            state['phase'] = 'discussion'
            entry = _record(state, 'replacement', tile_id=scene['id'], option=action['option'], replaced_id=old['id'])
        elif kind == 'start_presentations':
            state.update(phase='presentation', presentation_index=0, current_turn=state['presentation_order'][0])
            entry = _record(state, 'presentations')
        elif kind == 'end_presentation':
            entry = _record(state, 'presented', player_id=player_id)
            state['presentation_index'] += 1
            if state['presentation_index'] < len(state['presentation_order']):
                state['current_turn'] = state['presentation_order'][state['presentation_index']]
            elif state['round'] == 3:
                _finish(state, 'murderer', 'three_rounds')
            else:
                state.update(phase='round_review', current_turn=None, next_round_ready=[])
        elif kind == 'next_round':
            state['next_round_ready'].append(player_id)
            if set(state['next_round_ready']) == set(state['order']):
                state['round'] += 1
                state.update(phase='evidence', next_round_ready=[], replacement=state['scene_deck'].pop())
                entry = _record(state, 'new_round')
        elif kind == 'accuse':
            correct = state['solution'] == {'player_id': action['target_id'], 'means_id': action['means_id'], 'clue_id': action['clue_id']}
            state['badges'][player_id] = False
            entry = _record(state, 'accusation', player_id=player_id, target_id=action['target_id'],
                            means_id=action['means_id'], clue_id=action['clue_id'], correct=correct)
            state['accusations'].append(copy.deepcopy(entry))
            if correct:
                if state['config']['witness']:
                    state.update(phase='reversal', current_turn=_role_id(state, 'murderer'))
                else:
                    _finish(state, 'investigators', 'solved')
            elif not any(state['badges'].values()):
                _finish(state, 'murderer', 'badges_exhausted')
        elif kind == 'identify_witness':
            state['witness_guess'] = action['target_id']
            found = state['roles'][action['target_id']] == 'witness'
            _finish(state, 'murderer' if found else 'investigators', 'witness_found' if found else 'witness_safe')
            entry = _record(state, 'witness_guess', player_id=action['target_id'], correct=found)
        elif kind == 'discuss':
            entry = _record(state, 'message', player_id=player_id, text=action['text'].strip())
        state['revision'] += 1
        events = [{'type': 'deception:update', 'payload': copy.deepcopy(entry)}] if entry else []
        if state['game_over']:
            events.append({'type': 'deception:game_over', 'payload': {'winner_team': state['winner_team']}})
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        role = state['roles'].get(viewer_id)
        reveal = state['game_over']
        arrested = state['phase'] == 'reversal'
        murderer = _role_id(state, 'murderer')
        private = None
        if role:
            private = {'role': role}
            if role in ('forensic', 'murderer', 'accomplice'):
                private['solution'] = copy.deepcopy(state['solution'])
                private['allies'] = [pid for pid in state['order'] if state['roles'][pid] in ('murderer', 'accomplice')]
            if role == 'witness':
                # Seat order carries no information about which culprit is the murderer.
                private['suspects'] = [pid for pid in state['order'] if state['roles'][pid] in ('murderer', 'accomplice')]
        players = [{
            'player_id': pid, 'name': state['meta'][pid].get('name', pid),
            'is_bot': bool(state['meta'][pid].get('is_bot')), 'seat': state['meta'][pid].get('seat', 0),
            'role': state['roles'][pid] if reveal or pid == state['forensic_id'] or (arrested and pid == murderer) else None,
            'badge': state['badges'][pid],
            'means': [public_card(cid) for cid in state['hands'][pid]['means']],
            'clues': [public_card(cid) for cid in state['hands'][pid]['clues']],
        } for pid in state['order']]
        return {
            'game_id': 'deception', 'you': viewer_id, 'private': private,
            'case_token': state['case_token'], 'round': state['round'], 'revision': state['revision'],
            'config': {k: v for k, v in state['config'].items() if k != 'seed'},
            'phase': state['phase'], 'players': players, 'forensic_id': state['forensic_id'],
            'current_turn': state['current_turn'], 'presentation_order': list(state['presentation_order']),
            'presentation_index': state['presentation_index'],
            'scenes': [public_tile(tile['id'], tile['marker']) for tile in state['scenes']],
            'discarded_scenes': [{**public_tile(tile['id'], tile['marker']), 'round': tile['round']}
                                 for tile in state['discarded_scenes']],
            'locations': [public_tile(tile['id']) for tile in LOCATIONS] if role == 'forensic' and state['phase'] == 'scene_setup' else [],
            'replacement': public_tile(state['replacement']) if role == 'forensic' and state['replacement'] else None,
            'history': copy.deepcopy(state['history']), 'accusations': copy.deepcopy(state['accusations']),
            'next_round_ready': list(state['next_round_ready']),
            'legal_actions': DeceptionGame.get_legal_actions(state, viewer_id),
            'solution': copy.deepcopy(state['solution']) if reveal or arrested else None,
            'witness_guess': state['witness_guess'] if reveal else None,
            'winner_ids': list(state['winner_ids']), 'winner_team': state['winner_team'],
            'end_reason': state['end_reason'], 'game_over': reveal,
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.deception_ai import choose_action
        action = choose_action(DeceptionGame.get_public_view(state, bot_id))
        return {**action, 'delay_ms': 550} if action else None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
