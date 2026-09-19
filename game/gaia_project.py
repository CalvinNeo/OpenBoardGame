"""Server-authoritative Gaia Project base game (2–4 players)."""
import copy
import heapq
import random
from collections import Counter
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator
from game.gaia_project_data import (
    ACTION_SCHEMA, CONFIG_SCHEMA, ADVANCED, BOOSTERS, BUILDINGS, CONVERSIONS,
    FACTIONS, FEDERATIONS, FINALS, MAP_LAYOUTS, PLANETS, POWER_ACTIONS,
    ROUND_TILES, SECTOR_HEXES, SECTORS, TECHS, TRACKS, TRACK_NAMES, WHEEL,
)

_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)
DIRECTIONS = ((1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1))


class RuleError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuleError(message)


def distance(a: Dict, b: Dict) -> int:
    dq, dr = a['q'] - b['q'], a['r'] - b['r']
    return max(abs(dq), abs(dr), abs(dq + dr))


def _board(count: int) -> Dict:
    board = {}
    for sector, cq, cr in MAP_LAYOUTS[2 if count == 2 else 4]:
        for index, (q, r) in enumerate(SECTOR_HEXES):
            key = f'{sector}-{index}'
            board[key] = dict(id=key, q=cq + q, r=cr + r, sector=sector,
                              planet=SECTORS[sector].get(index), buildings={},
                              satellites=[], federations={}, gaiaformer=None)
    return board


def _neighbors(state: Dict) -> Dict:
    coords = {(h['q'], h['r']): key for key, h in state['board'].items()}
    return {key: [coords[(h['q'] + q, h['r'] + r)] for q, r in DIRECTIONS
                  if (h['q'] + q, h['r'] + r) in coords]
            for key, h in state['board'].items()}


def _owned(state: Dict, pid: str, structures_only: bool = False) -> List[Dict]:
    return [h for h in state['board'].values() if pid in h['buildings']
            and (not structures_only or h['buildings'][pid] != 'station')]


def _counts(state: Dict, pid: str) -> Counter:
    return Counter(h['buildings'][pid] for h in _owned(state, pid))


def _pi(state: Dict, pid: str) -> bool:
    return any(h['buildings'][pid] == 'institute' for h in _owned(state, pid))


def _active_techs(player: Dict) -> List[str]:
    return [t for t in player['techs'] if t not in player['covered']] + player['advanced']


def _metric(state: Dict, pid: str, kind: str) -> int:
    player = state['players'][pid]
    owned = _owned(state, pid, True)
    primary = [h for h in owned if not (player['faction'] == 'lantids' and len(h['buildings']) > 1)]
    counts = _counts(state, pid)
    return {
        'buildings': len(owned), 'federated': sum(pid in h['federations'] for h in owned),
        'types': len({h['planet'] for h in primary}),
        'gaia': sum(h['planet'] == 'gaia' for h in primary),
        'sectors': len({h['sector'] for h in owned}),
        'satellites': sum(pid in h['satellites'] for h in state['board'].values()) + counts['station'],
        'mines': counts['mine'] + counts['lost_mine'], 'labs': counts['lab'],
        'trading': counts['trading_station'],
        'big': counts['institute'] + counts['academy_knowledge'] + counts['academy_qic'],
        'federations': len(player['federations']),
    }[kind]


def _power_value(state: Dict, pid: str, h: Dict) -> int:
    kind = h['buildings'][pid]
    value = BUILDINGS[kind]['power']
    if value == 3 and 'structure_power' in _active_techs(state['players'][pid]):
        value = 4
    if state['players'][pid]['faction'] == 'bescods' and _pi(state, pid) and h['planet'] == 'titanium':
        value += 1
    return value


def charge_power(player: Dict, amount: int, brain_first: Optional[bool] = None) -> int:
    """Move actual tokens; a brainstone needs one charge per bowl, like a token."""
    first = player['brain_first'] if brain_first is None else brain_first
    charged = 0
    for _ in range(amount):
        bowl = 0 if player['power'][0] or player['brain'] == 0 else 1
        if not player['power'][bowl] and player['brain'] != bowl:
            break
        if player['brain'] == bowl and (first or not player['power'][bowl]):
            player['brain'] += 1
        else:
            player['power'][bowl] -= 1
            player['power'][bowl + 1] += 1
        charged += 1
    return charged


def _capacity(player: Dict) -> int:
    return 2 * player['power'][0] + player['power'][1] + (2 - player['brain'] if player['brain'] in (0, 1) else 0)


def _power_available(state: Dict, pid: str) -> int:
    p = state['players'][pid]
    factor = 2 if p['faction'] == 'nevlas' and _pi(state, pid) else 1
    return p['power'][2] * factor + (3 if p['brain'] == 2 else 0)


def _pay(state: Dict, pid: str, cost: Dict) -> None:
    p = state['players'][pid]
    for key, amount in cost.items():
        available = _power_available(state, pid) if key == 'power' else p[key]
        require(available >= amount, f'Not enough {key}: need {amount}, have {available}.')
    for key, amount in cost.items():
        if key != 'power':
            p[key] -= amount
            continue
        if p['brain'] == 2 and (p['brain_first'] or p['power'][2] < amount):
            p['brain'] = 0
            amount = max(0, amount - 3)
        factor = 2 if p['faction'] == 'nevlas' and _pi(state, pid) else 1
        tokens = (amount + factor - 1) // factor
        p['power'][2] -= tokens
        p['power'][0] += tokens


def _can_pay(state: Dict, pid: str, cost: Dict) -> bool:
    p = state['players'][pid]
    return all((_power_available(state, pid) if k == 'power' else p.get(k, 0)) >= v for k, v in cost.items())


def _gain(state: Dict, pid: str, gain: Dict) -> None:
    p = state['players'][pid]
    for key, amount in gain.items():
        if key == 'qic' and p['faction'] == 'gleens' and not _counts(state, pid)['academy_qic']:
            key = 'ore'
        if key == 'charge':
            charge_power(p, amount)
        elif key == 'tokens':
            p['power'][0] += amount
        else:
            p[key] = min(p[key] + amount, {'ore': 15, 'knowledge': 15, 'credits': 30}.get(key, 100000))


def _tokens_pay(player: Dict, amount: int, action: Dict, to_gaia: bool = False) -> None:
    chosen = action.get('power_tokens')
    brain = action.get('brain', False)
    if chosen is None:
        chosen = [0, 0, 0]
        remaining = amount
        for i in range(3):
            chosen[i] = min(remaining, player['power'][i])
            remaining -= chosen[i]
        brain = remaining == 1 and player['brain'] in (0, 1, 2)
    require(sum(chosen) + int(brain) == amount, 'Select exactly the required number of power tokens.')
    require(all(0 <= v <= player['power'][i] for i, v in enumerate(chosen)), 'Invalid power bowl payment.')
    require(not brain or player['brain'] in (0, 1, 2), 'The brainstone is not available.')
    player['power'] = [v - chosen[i] for i, v in enumerate(player['power'])]
    if to_gaia:
        player['gaia_power'] += sum(chosen)
    if brain:
        player['brain'] = 3 if to_gaia else None


def _score_event(state: Dict, pid: str, event: str, times: int = 1) -> None:
    if state['round'] == 0:
        return
    p = state['players'][pid]
    tile = ROUND_TILES[state['round_tiles'][state['round'] - 1]]
    if tile['event'] == event:
        p['vp'] += tile['vp'] * times
    for tech in _active_techs(p):
        spec = TECHS.get(tech, ADVANCED.get(tech, {}))
        if spec.get('event', [None])[0] == event:
            p['vp'] += spec['event'][1] * times


def _log(state: Dict, pid: Optional[str], message: str) -> None:
    state['log'].append(dict(round=state['round'], player_id=pid, message=message))
    state['log'] = state['log'][-120:]


def _queue(state: Dict, kind: str, pid: str, front: bool = False, **extra: object) -> None:
    pending = dict(kind=kind, player_id=pid, **extra)
    if front:
        state['pending'].insert(0, pending)
    else:
        state['pending'].append(pending)


def _federation_token(state: Dict, pid: str, token: str, source: str) -> None:
    state['players'][pid]['federations'].append(dict(token=token, green=token != 'points', source=source))
    _gain(state, pid, FEDERATIONS[token])
    _score_event(state, pid, 'federation')


def _green(player: Dict) -> int:
    return sum(f['green'] for f in player['federations'])


def _flip_green(player: Dict) -> None:
    token = next((f for f in player['federations'] if f['green']), None)
    require(token is not None, 'A green federation token is required.')
    token['green'] = False


def _can_research(state: Dict, pid: str, track: str) -> bool:
    p = state['players'][pid]
    if track not in TRACKS or p['research'][track] >= 5:
        return False
    if track == 'navigation' and p['faction'] == 'bal_taks' and not _pi(state, pid):
        return False
    if p['research'][track] == 4:
        return bool(_green(p)) and not any(o['research'][track] == 5 for o in state['players'].values())
    return True


def _research(state: Dict, pid: str, track: str, setup: bool = False) -> None:
    p = state['players'][pid]
    require(_can_research(state, pid, track), 'This research level is unavailable.')
    p['research'][track] += 1
    level = p['research'][track]
    if level == 5:
        _flip_green(p)
    if level == 3:
        charge_power(p, 3)
    if track == 'terraforming':
        if level in (1, 4):
            _gain(state, pid, {'ore': 2})
        elif level == 5:
            _federation_token(state, pid, state['terraform_token'], 'terraforming')
    elif track == 'navigation':
        if level in (1, 3):
            _gain(state, pid, {'qic': 1})
        elif level == 5:
            _queue(state, 'lost', pid, front=True)
    elif track == 'ai':
        _gain(state, pid, {'qic': [0, 1, 1, 2, 2, 4][level]})
    elif track == 'gaia':
        if level in (1, 3, 4):
            p['gaiaformers'] += 1
        elif level == 2:
            _gain(state, pid, {'tokens': 3})
        elif level == 5:
            _gain(state, pid, {'vp': 4 + _metric(state, pid, 'gaia')})
    elif track == 'economy' and level == 5:
        _gain(state, pid, {'ore': 3, 'credits': 6, 'charge': 6})
    elif track == 'science' and level == 5:
        _gain(state, pid, {'knowledge': 9})
    if not setup:
        _score_event(state, pid, 'research')
        _log(state, pid, f'{TRACK_NAMES[track]} → {level}')


def income_sources(state: Dict, pid: str) -> List[Dict]:
    p = state['players'][pid]
    if not p['faction']:
        return []
    c = _counts(state, pid)
    faction = FACTIONS[p['faction']]
    sources = [dict(source='种族', gain=faction['income'].copy())]
    mines = [0, 1, 2, 2, 3, 4, 5, 6, 7][c['mine']]
    credits = [0, 3, 7, 11, 16][c['trading_station']]
    knowledge = c['lab']
    if p['faction'] == 'bescods':
        credits, knowledge = [0, 3, 7, 12][c['lab']], c['trading_station']
    if p['faction'] == 'nevlas':
        knowledge = 0
        sources += [dict(source='研究所', gain={'charge': 2}) for _ in range(c['lab'])]
    if c['academy_knowledge']:
        knowledge += 3 if p['faction'] == 'itars' else 2
    sources.append(dict(source='建筑', gain=dict(ore=mines, credits=credits, knowledge=knowledge)))
    if c['institute']:
        sources.append(dict(source='行星学院', gain={'charge': 4}))
        extra = {'tokens': faction['pi_tokens']}
        if p['faction'] == 'xenos':
            extra['qic'] = 1
        if p['faction'] == 'gleens':
            extra['ore'] = 1
        sources.append(dict(source='行星学院', gain=extra))
    if p['booster']:
        sources.append(dict(source=BOOSTERS[p['booster']]['name'], gain=BOOSTERS[p['booster']]['income'].copy()))
    for t in _active_techs(p):
        if t in TECHS and 'income' in TECHS[t]:
            sources.append(dict(source=TECHS[t]['name'], gain=TECHS[t]['income'].copy()))
    level = p['research']['economy']
    if 0 < level < 5:
        sources.append(dict(source='经济', gain=dict(credits=[0, 2, 2, 3, 4][level], ore=[0, 0, 1, 1, 2][level], charge=level)))
    level = p['research']['science']
    if 0 < level < 5:
        sources.append(dict(source='科学', gain={'knowledge': level}))
    return sources


def _start_round(state: Dict) -> None:
    state['round'] += 1
    state['used_power'] = []
    state['passed'] = []
    state['ready'] = []
    state['round_start_vp'] = {pid: p['vp'] for pid, p in state['players'].items()}
    state['phase'] = 'income'
    state['income_pending'] = {}
    for pid, p in state['players'].items():
        p['used_special'] = []
        pending = []
        for source in income_sources(state, pid):
            _gain(state, pid, {k: v for k, v in source['gain'].items() if k not in ('charge', 'tokens')})
            for kind in ('charge', 'tokens'):
                if source['gain'].get(kind):
                    pending.append(dict(source=source['source'], gain={kind: source['gain'][kind]}))
        state['income_pending'][pid] = pending
    _advance_income(state)
    _log(state, None, f'第 {state["round"]} 轮 · {ROUND_TILES[state["round_tiles"][state["round"] - 1]]["name"]}')


def _advance_income(state: Dict) -> None:
    for pid in state['turn_order']:
        items = state['income_pending'][pid]
        # Ordering matters only if both charging and gaining tokens are present.
        if items and len({next(iter(s['gain'])) for s in items}) == 1:
            for item in items:
                _gain(state, pid, item['gain'])
            items.clear()
        if items:
            state['current_turn'] = pid
            return
    state['phase'] = 'gaia'
    state['gaia_queue'] = state['turn_order'].copy()
    for h in state['board'].values():
        if h['gaiaformer'] and h['planet'] == 'transdim':
            h['planet'] = 'gaia'
    for p in state['players'].values():
        p['gaiaformers'] += p['gaiaformers_held']
        p['gaiaformers_held'] = 0
        p['terrans_budget'] = p['gaia_power'] if p['faction'] == 'terrans' else 0
    _advance_gaia(state)


def _return_gaia(p: Dict) -> None:
    dest = 1 if p['faction'] == 'terrans' else 0
    p['power'][dest] += p['gaia_power']
    p['gaia_power'] = 0
    if p['brain'] == 3:
        p['brain'] = dest


def _advance_gaia(state: Dict) -> None:
    while state['gaia_queue']:
        pid = state['gaia_queue'][0]
        p = state['players'][pid]
        state['current_turn'] = pid
        if _pi(state, pid) and ((p['faction'] == 'terrans' and p['terrans_budget']) or
                              (p['faction'] == 'itars' and p['gaia_power'] >= 4)):
            return
        _return_gaia(p)
        state['gaia_queue'].pop(0)
    state['phase'] = 'action'
    state['current_turn'] = state['turn_order'][0]
    state['main_done'] = False


def _range_cost(state: Dict, pid: str, h: Dict, bonus: int = 0) -> int:
    level = state['players'][pid]['research']['navigation']
    reach = [1, 1, 2, 2, 3, 4][level] + bonus
    dist = min((distance(h, own) for own in _owned(state, pid)), default=1000)
    return max(0, (dist - reach + 1) // 2)


def _source(state: Dict, pid: str, source: str, gaia: bool = False) -> Tuple[int, int, Dict]:
    p = state['players'][pid]
    if not source or source == 'normal':
        return 0, 0, {}
    if source in ('booster_range', 'booster_terraform'):
        expected = 'range' if source == 'booster_range' else 'terraform'
        require(p['booster'] == expected and 'booster' not in p['used_special'], 'Booster action unavailable.')
        require(not gaia or expected == 'range', 'Terraforming steps cannot start a Gaia project.')
        return (1, 0, {}) if expected == 'terraform' else (0, 3, {})
    require(not gaia and source in ('terraform_1', 'terraform_2'), 'Invalid construction action.')
    require(source not in state['used_power'], 'This power action was already used.')
    spec = POWER_ACTIONS[source]
    return spec['terraform'], 0, spec['cost']


def _use_source(state: Dict, pid: str, source: str) -> None:
    if source.startswith('booster_'):
        state['players'][pid]['used_special'].append('booster')
    elif source in POWER_ACTIONS:
        state['used_power'].append(source)


def build_cost(state: Dict, pid: str, hex_id: str, source: str = 'normal') -> Dict:
    require(hex_id in state['board'], 'Unknown planet.')
    h, p = state['board'][hex_id], state['players'][pid]
    free, bonus, additional = _source(state, pid, source)
    require(h['planet'] not in (None, 'transdim'), 'Select a habitable planet.')
    require(pid not in h['buildings'], 'You already occupy this planet.')
    cohabit = p['faction'] == 'lantids' and bool(h['buildings'])
    require(not h['buildings'] or cohabit, 'This planet is occupied.')
    require(h['gaiaformer'] in (None, pid), 'Another player reserved this planet.')
    require(_counts(state, pid)['mine'] < 8, 'No mine available on your faction board.')
    qic = 0 if h['gaiaformer'] == pid else _range_cost(state, pid, h, bonus)
    cost = dict(credits=2, ore=1, qic=qic, **additional)
    steps = 0
    if not cohabit:
        if h['planet'] == 'gaia' and h['gaiaformer'] != pid:
            cost['ore' if p['faction'] == 'gleens' else 'qic'] += 1
        elif h['planet'] in WHEEL:
            delta = abs(WHEEL.index(h['planet']) - WHEEL.index(FACTIONS[p['faction']]['home']))
            steps = min(delta, 7 - delta)
            cost['ore'] += max(0, steps - free) * [3, 3, 2, 1, 1, 1][p['research']['terraforming']]
    require(_can_pay(state, pid, cost), 'Insufficient resources for this mine and its range / terraforming costs.')
    return dict(cost=cost, steps=steps, cohabit=cohabit)


def _leech(state: Dict, actor: str, h: Dict) -> None:
    order = state['turn_order']
    start = order.index(actor)
    for i in range(1, len(order)):
        pid = order[(start + i) % len(order)]
        nearby = [o for o in _owned(state, pid, True) if distance(h, o) <= 2]
        if not nearby:
            continue
        p = state['players'][pid]
        if _capacity(p) or (p['faction'] == 'taklons' and _pi(state, pid)):
            _queue(state, 'leech', pid, value=max(_power_value(state, pid, o) for o in nearby), hex=h['id'])


def _absorb(state: Dict, pid: str) -> None:
    adjacency = _neighbors(state)
    changed = True
    while changed:
        changed = False
        for h in _owned(state, pid):
            if pid in h['federations']:
                continue
            federation = next((state['board'][n]['federations'][pid] for n in adjacency[h['id']]
                               if pid in state['board'][n]['federations']), None)
            if federation is not None:
                h['federations'][pid] = federation
                changed = True


def _build(state: Dict, pid: str, action: Dict) -> None:
    h, p = state['board'][action['hex']], state['players'][pid]
    source = action.get('source', 'normal')
    info = build_cost(state, pid, h['id'], source)
    known = {o['planet'] for o in _owned(state, pid, True)}
    had_pi = _pi(state, pid)
    _pay(state, pid, info['cost'])
    _use_source(state, pid, source)
    h['buildings'][pid] = 'mine'
    if h['gaiaformer'] == pid:
        h['gaiaformer'] = None
        p['gaiaformers'] += 1
    if info['cohabit']:
        if had_pi:
            _gain(state, pid, {'knowledge': 2})
    else:
        if h['planet'] == 'gaia':
            _score_event(state, pid, 'gaia')
            if p['faction'] == 'gleens':
                p['vp'] += 2
        if p['faction'] == 'geodens' and had_pi and h['planet'] not in known:
            _gain(state, pid, {'knowledge': 3})
    _score_event(state, pid, 'mine')
    _score_event(state, pid, 'terraform', info['steps'])
    _absorb(state, pid)
    _leech(state, pid, h)
    _log(state, pid, f'建造矿场 · {h["id"]}')


def _upgrade_cost(state: Dict, pid: str, hex_id: str, building: str) -> Dict:
    require(hex_id in state['board'], 'Unknown structure.')
    h, p = state['board'][hex_id], state['players'][pid]
    old = h['buildings'].get(pid)
    require(old is not None and len(h['buildings']) == 1, 'A cohabiting mine cannot be upgraded.')
    big_from_trade = ['academy_knowledge', 'academy_qic'] if p['faction'] == 'bescods' else ['institute']
    big_from_lab = ['institute'] if p['faction'] == 'bescods' else ['academy_knowledge', 'academy_qic']
    targets = {'mine': ['trading_station'], 'trading_station': ['lab', *big_from_trade], 'lab': big_from_lab}
    require(building in targets.get(old, []), 'This upgrade path is unavailable.')
    require(_counts(state, pid)[building] < BUILDINGS[building]['limit'], 'No structure remaining.')
    if building == 'trading_station':
        neighbor = any(o != pid and distance(h, x) <= 2 for x in state['board'].values() for o, b in x['buildings'].items() if b != 'station')
        cost = dict(ore=2, credits=3 if neighbor else 6)
    elif building == 'lab':
        cost = dict(ore=3, credits=5)
    elif building == 'institute':
        cost = dict(ore=4, credits=6)
    else:
        cost = dict(ore=6, credits=6)
    require(_can_pay(state, pid, cost), 'Insufficient resources for this upgrade.')
    return cost


def _tech_options(state: Dict, pid: str) -> List[Dict]:
    p = state['players'][pid]
    options = [dict(tile=t, track=TRACKS[i] if i < 6 else None, covers=[])
               for i, t in enumerate(state['tech_market']) if t not in p['techs'] and state['tech_stock'][t] > 0]
    covers = [t for t in p['techs'] if t not in p['covered']]
    if _green(p) and covers:
        for track, tile in state['advanced_market'].items():
            if tile and p['research'][track] >= 4:
                options.append(dict(tile=tile, track=None, covers=covers.copy()))
    return options


def _choose_tech(state: Dict, pid: str, action: Dict) -> None:
    p = state['players'][pid]
    option = next((o for o in _tech_options(state, pid) if o['tile'] == action['tile']), None)
    require(option is not None, 'Technology unavailable or already owned.')
    tile = option['tile']
    if tile in ADVANCED:
        require(action.get('cover') in option['covers'], 'Choose an uncovered standard technology.')
        _flip_green(p)
        p['covered'].append(action['cover'])
        p['advanced'].append(tile)
        for track, t in state['advanced_market'].items():
            if t == tile:
                state['advanced_market'][track] = None
        spec = ADVANCED[tile]
    else:
        require('cover' not in action, 'Only advanced technology covers another tile.')
        p['techs'].append(tile)
        state['tech_stock'][tile] -= 1
        spec = TECHS[tile]
    _gain(state, pid, spec.get('immediate', {}))
    if 'metric' in spec:
        metric, amount, resource = spec['metric']
        _gain(state, pid, {resource: amount * _metric(state, pid, metric)})
    tracks = [option['track']] if option['track'] else TRACKS.copy()
    _queue(state, 'track', pid, front=True, tracks=tracks)
    _log(state, pid, f'获得科技 · {spec["name"]}')


def _pass_score(state: Dict, pid: str) -> None:
    p = state['players'][pid]
    specs = [BOOSTERS[p['booster']]] + [ADVANCED[t] for t in p['advanced']]
    for spec in specs:
        if 'passing' in spec:
            metric, value = spec['passing']
            p['vp'] += value * _metric(state, pid, metric)


def _final_score(state: Dict) -> None:
    scores = {pid: dict(in_game=p['vp'], research=4 * sum(max(0, v - 2) for v in p['research'].values()),
                        resources=(p['credits'] + p['ore'] + p['knowledge']) // 3, objectives={})
              for pid, p in state['players'].items()}
    for goal in state['final_tiles']:
        values = {pid: _metric(state, pid, goal) for pid in state['players']}
        if len(values) == 2:
            values['__neutral__'] = FINALS[goal]['neutral']
        ranks = sorted(set(values.values()), reverse=True)
        position = 0
        for value in ranks:
            tied = [pid for pid, count in values.items() if count == value]
            award = sum([18, 12, 6, 0][position:position + len(tied)]) // len(tied)
            for pid in tied:
                if pid in scores:
                    scores[pid]['objectives'][goal] = dict(count=value, vp=award)
            position += len(tied)
    for pid, score in scores.items():
        score['total'] = score['in_game'] + score['research'] + score['resources'] + sum(s['vp'] for s in score['objectives'].values())
        state['players'][pid]['vp'] = score['total']
    state['scores'] = scores
    best = max(s['total'] for s in scores.values())
    state['winner'] = [pid for pid, s in scores.items() if s['total'] == best]
    state['phase'], state['game_over'], state['current_turn'] = 'game_over', True, None
    _log(state, None, '六轮结束 · 终局计分完成')


def _next_turn(state: Dict) -> None:
    if len(state['passed']) == len(state['players']):
        state['round_summary'] = {pid: dict(vp=p['vp'], delta=p['vp'] - state['round_start_vp'][pid]) for pid, p in state['players'].items()}
        if state['round'] == 6:
            _final_score(state)
        else:
            state['phase'], state['current_turn'], state['ready'] = 'round_end', None, []
        return
    order = state['turn_order']
    start = order.index(state['current_turn'])
    state['current_turn'] = next(order[(start + i) % len(order)] for i in range(1, len(order) + 1) if order[(start + i) % len(order)] not in state['passed'])
    state['main_done'] = False


def _normalize_pending(state: Dict) -> None:
    while state['pending']:
        pending = state['pending'][0]
        pid = pending['player_id']
        if pending['kind'] == 'tech' and not _tech_options(state, pid):
            state['pending'].pop(0)
        elif pending['kind'] == 'track' and not any(_can_research(state, pid, t) for t in pending['tracks']):
            state['pending'].pop(0)
        else:
            break


def _actor(state: Dict) -> Optional[str]:
    return state['pending'][0]['player_id'] if state['pending'] else state['current_turn']


def _gaia_cost(state: Dict, pid: str, action: Dict) -> Dict:
    p = state['players'][pid]
    h = state['board'].get(action['hex'])
    require(h is not None and h['planet'] == 'transdim' and not h['gaiaformer'], 'Choose an unreserved Transdim planet.')
    require(p['gaiaformers'] > 0, 'No Gaiaformer available.')
    _, bonus, _ = _source(state, pid, action.get('source', 'normal'), True)
    cost = {'qic': _range_cost(state, pid, h, bonus)}
    level = p['research']['gaia']
    tokens = [100, 6, 6, 4, 3, 3][level]
    require(sum(p['power']) + int(p['brain'] in (0, 1, 2)) >= tokens, 'Not enough power tokens for a Gaia project.')
    require(_can_pay(state, pid, cost), 'Not enough QIC for this range.')
    return dict(cost=cost, tokens=tokens)


def _conversion(state: Dict, pid: str, conversion: str) -> Tuple[Dict, Dict]:
    p = state['players'][pid]
    if conversion in CONVERSIONS:
        return CONVERSIONS[conversion]
    if conversion.startswith('credits_') and p['faction'] == 'hadsch_hallas' and _pi(state, pid):
        key = conversion[8:]
        require(key in ('ore', 'knowledge', 'qic'), 'Invalid conversion.')
        return {'credits': 3 if key == 'ore' else 4}, {key: 1}
    if conversion == 'nevlas_knowledge' and p['faction'] == 'nevlas':
        return {'token_iii': 1}, {'knowledge': 1}
    if conversion == 'bal_taks_qic' and p['faction'] == 'bal_taks':
        return {'gaiaformers': 1}, {'qic': 1}
    raise RuleError('Conversion unavailable.')


def _apply_free(state: Dict, pid: str, action: Dict) -> None:
    p, kind = state['players'][pid], action['type']
    if kind == 'power_preference':
        p['brain_first'] = action['brain_first']
    elif kind == 'burn':
        count = action['count']
        if action.get('brain'):
            require(p['brain'] == 1 and p['power'][1] >= count * 2 - 1, 'Cannot burn to charge the brainstone.')
            p['brain'] = 2
            p['power'][1] -= 2 * count - 1
            p['power'][2] += count - 1
        else:
            require(p['power'][1] >= 2 * count, 'Need two tokens in bowl II for each burn.')
            p['power'][1] -= 2 * count
            p['power'][2] += count
        if p['faction'] == 'itars':
            p['gaia_power'] += count
    else:
        count = action.get('count', 1)
        cost, gain = _conversion(state, pid, action['conversion'])
        if 'token_iii' in cost:
            require(p['power'][2] >= count, 'Not enough tokens in bowl III.')
            p['power'][2] -= count
            p['gaia_power'] += count
        elif 'gaiaformers' in cost:
            require(p['gaiaformers'] >= count, 'No free Gaiaformer.')
            p['gaiaformers'] -= count
            p['gaiaformers_held'] += count
        else:
            _pay(state, pid, {k: v * count for k, v in cost.items()})
        _gain(state, pid, {k: v * count for k, v in gain.items()})
    _log(state, pid, {'burn': '燃烧能量', 'convert': '资源转换', 'power_preference': '更新脑石优先级'}[kind])


def _federate(state: Dict, pid: str, action: Dict) -> None:
    from game.gaia_project_federation import connected_components, minimum_satellites
    p = state['players'][pid]
    board, neighbors = state['board'], _neighbors(state)
    chosen = set(action['hexes'])
    require(chosen and chosen <= set(board), 'Choose buildings and connecting empty hexes.')
    ivits = p['faction'] == 'ivits'
    existing = {key for key, h in board.items() if pid in h['federations']}
    if ivits:
        chosen |= existing
    else:
        require(not chosen & existing, 'A structure can belong to only one federation.')
    owned = {h['id'] for h in _owned(state, pid)}
    # Adjacent buildings are inseparable, including along the proposed satellites.
    grew = True
    while grew:
        adjacent = {n for key in chosen for n in neighbors[key] if n in owned}
        grew = not adjacent <= chosen
        chosen |= adjacent
    buildings = chosen & owned
    require(buildings, 'A federation needs your structures.')
    for key in chosen - buildings:
        h = board[key]
        require(h['planet'] is None and all(b == 'station' for b in h['buildings'].values()), 'Satellites must be in space (opponent satellites and stations are allowed).')
        require(pid not in h['satellites'] or (ivits and key in existing), 'Satellite already belongs to a federation.')
    if not ivits:
        require(not chosen & existing and not any(n in existing for key in chosen for n in neighbors[key]), 'New federations cannot touch an existing federation.')
    require(len(connected_components(chosen, neighbors)) == 1, 'The federation must be connected.')
    previous = sum(f['source'] == 'board' for f in p['federations'])
    threshold = 7 * (previous + 1) if ivits else (6 if p['faction'] == 'xenos' and _pi(state, pid) else 7)
    strength = sum(_power_value(state, pid, board[key]) for key in buildings)
    require(strength >= threshold, f'Federation needs {threshold} power; selected {strength}.')
    new_satellites = chosen - owned - existing
    available = 25 - sum(pid in h['satellites'] for h in board.values())
    require(len(new_satellites) <= available, 'Not enough satellites remaining.')
    forbidden = set(existing) if not ivits else set()
    if not ivits:
        forbidden |= {n for key in existing for n in neighbors[key]}
    free = buildings | (existing if ivits else set())
    allowed = free | {key for key, h in board.items() if h['planet'] is None and all(b == 'station' for b in h['buildings'].values()) and key not in forbidden}
    clusters = connected_components(free, neighbors)
    strengths = [sum(_power_value(state, pid, board[key]) for key in cluster if key in owned) for cluster in clusters]
    # With no new satellites no cheaper route exists, avoiding a needless search.
    if new_satellites:
        cheaper = minimum_satellites(neighbors, allowed, clusters, free, len(new_satellites) - 1, strengths, threshold)
        require(cheaper >= len(new_satellites), f'A sufficient federation can be connected with {cheaper} satellites; remove unnecessary links / buildings.')
    token = action['token']
    require(state['federation_supply'].get(token, 0) > 0, 'Federation token unavailable.')
    if ivits:
        _pay(state, pid, {'qic': len(new_satellites)})
    else:
        _tokens_pay(p, len(new_satellites), action)
    state['federation_supply'][token] -= 1
    identifier = 0 if ivits else previous
    for key in chosen:
        board[key]['federations'][pid] = identifier
        if key in new_satellites:
            board[key]['satellites'].append(pid)
    _federation_token(state, pid, token, 'board')
    _log(state, pid, f'成立联邦 · 力量 {strength} · {len(new_satellites)} 卫星')


def _special(state: Dict, pid: str, action: Dict) -> None:
    p = state['players'][pid]
    which = action['action']
    require(which not in p['used_special'], 'Special action already used this round.')
    if which == 'academy':
        require(_counts(state, pid)['academy_qic'], 'Build the action academy first.')
        _gain(state, pid, {'credits': 4} if p['faction'] == 'bal_taks' else {'qic': 1})
    elif which in _active_techs(p):
        spec = TECHS.get(which, ADVANCED.get(which, {}))
        require('special' in spec, 'This technology has no action.')
        _gain(state, pid, spec['special'])
    elif which == 'bescods':
        require(p['faction'] == 'bescods', 'Faction action unavailable.')
        track = action.get('track')
        require(track in TRACKS and p['research'][track] == min(p['research'].values()), 'Choose a lowest-level research area.')
        _research(state, pid, track)
    elif which == 'ambas':
        require(p['faction'] == 'ambas' and _pi(state, pid), 'Institute ability unavailable.')
        h = state['board'].get(action.get('hex'))
        require(h is not None and h['buildings'].get(pid) == 'mine', 'Choose one of your mines.')
        institute = next(x for x in _owned(state, pid) if x['buildings'][pid] == 'institute')
        institute['buildings'][pid], h['buildings'][pid] = 'mine', 'institute'
    elif which == 'firaks':
        require(p['faction'] == 'firaks' and _pi(state, pid), 'Institute ability unavailable.')
        h = state['board'].get(action.get('hex'))
        require(h is not None and h['buildings'].get(pid) == 'lab', 'Choose a research lab.')
        require(_counts(state, pid)['trading_station'] < 4, 'No trading station remaining.')
        h['buildings'][pid] = 'trading_station'
        _score_event(state, pid, 'trading')
        _queue(state, 'track', pid, tracks=TRACKS.copy())
        _leech(state, pid, h)
        _log(state, pid, '研究所降为交易站')
        return  # A faction action, not a once-per-round orange special action.
    elif which == 'ivits':
        require(p['faction'] == 'ivits' and _pi(state, pid), 'Institute ability unavailable.')
        require(_counts(state, pid)['station'] < 6, 'No space station remaining.')
        h = state['board'].get(action.get('hex'))
        require(h is not None and h['planet'] is None and not h['buildings'], 'Choose space without a planet or station.')
        _pay(state, pid, {'qic': _range_cost(state, pid, h)})
        h['buildings'][pid] = 'station'
        _absorb(state, pid)
    else:
        raise RuleError('Special action unavailable.')
    p['used_special'].append(which)
    _log(state, pid, f'特殊行动 · {which}')


def _resolve_pending(state: Dict, pid: str, action: Dict) -> None:
    pending = state['pending'][0]
    kind, p = pending['kind'], state['players'][pid]
    if kind == 'leech':
        require(action['type'] == 'leech', 'Resolve the passive charge first.')
        if action['accept']:
            bonus = p['faction'] == 'taklons' and _pi(state, pid)
            if bonus and action.get('token_first', True):
                p['power'][0] += 1
            amount = min(pending['value'], _capacity(p), p['vp'] + 1)
            p['vp'] -= max(0, amount - 1)
            charge_power(p, amount, action.get('brain_first'))
            if bonus and not action.get('token_first', True):
                p['power'][0] += 1
            _log(state, pid, f'接受 {amount} 充能，花费 {max(0, amount - 1)} VP')
        state['pending'].pop(0)
    elif kind == 'tech':
        require(action['type'] == 'choose_tech', 'Choose a technology tile first.')
        state['pending'].pop(0)
        _choose_tech(state, pid, action)
    elif kind == 'track':
        require(action['type'] in ('choose_track', 'skip_track'), 'Choose a research area.')
        state['pending'].pop(0)
        if action['type'] == 'choose_track':
            require(action['track'] in pending['tracks'], 'This tile does not advance that research area.')
            _research(state, pid, action['track'])
    elif kind == 'lost':
        require(action['type'] == 'lost_planet', 'Place the Lost Planet first.')
        h = state['board'].get(action['hex'])
        require(h is not None and h['planet'] is None and not h['buildings'] and not h['satellites'], 'The Lost Planet needs completely empty space.')
        _pay(state, pid, {'qic': _range_cost(state, pid, h)})
        h['planet'], h['buildings'][pid] = 'lost', 'lost_mine'
        state['pending'].pop(0)
        _score_event(state, pid, 'mine')
        if p['faction'] == 'geodens' and _pi(state, pid):
            _gain(state, pid, {'knowledge': 3})
        _absorb(state, pid)
        _leech(state, pid, h)


def _apply(state: Dict, pid: str, action: Dict) -> None:
    kind, p = action['type'], state['players'][pid]
    require(not state['game_over'], 'The game is over.')
    if state['phase'] == 'round_end':
        require(kind == 'next_round' and pid not in state['ready'], 'Waiting for all players to confirm Next Round.')
        state['ready'].append(pid)
        if len(state['ready']) == len(state['players']):
            if state['config']['variable_turn_order']:
                state['turn_order'] = state['passed'].copy()
            else:
                seats = state['seat_order']
                first = seats.index(state['passed'][0])
                state['turn_order'] = seats[first:] + seats[:first]
            _start_round(state)
        return
    require(pid == _actor(state), 'It is not your turn.')
    if state['pending']:
        _resolve_pending(state, pid, action)
        _normalize_pending(state)
        return
    phase = state['phase']
    if phase == 'faction':
        require(kind == 'choose_faction', 'Choose a faction.')
        faction = action['faction']
        home = FACTIONS[faction]['home']
        require(not any(o['faction'] and FACTIONS[o['faction']]['home'] == home for o in state['players'].values()), 'This faction color is already taken.')
        p['faction'] = faction
        spec = FACTIONS[faction]
        for key in ('ore', 'knowledge', 'credits', 'qic'):
            p[key] = spec[key]
        p['power'] = spec['power'].copy()
        p['brain'] = 0 if faction == 'taklons' else None
        if spec['start_track']:
            _research(state, pid, spec['start_track'], True)
        remaining = [o for o in state['seat_order'] if state['players'][o]['faction'] is None]
        if remaining:
            state['current_turn'] = remaining[0]
        else:
            normal = [o for o in state['seat_order'] if state['players'][o]['faction'] != 'ivits']
            state['setup_queue'] = normal + list(reversed(normal))
            state['setup_queue'] += [o for o in normal if state['players'][o]['faction'] == 'xenos']
            state['setup_queue'] += [o for o in state['seat_order'] if state['players'][o]['faction'] == 'ivits']
            state['phase'], state['current_turn'] = 'placement', state['setup_queue'][0]
        _log(state, pid, f'选择 {spec["name"]}')
    elif phase == 'placement':
        require(kind == 'place_initial', 'Place a starting structure.')
        h = state['board'].get(action['hex'])
        require(h is not None and h['planet'] == FACTIONS[p['faction']]['home'] and not h['buildings'], 'Choose an empty home planet.')
        h['buildings'][pid] = 'institute' if p['faction'] == 'ivits' else 'mine'
        state['setup_queue'].pop(0)
        if not state['setup_queue']:
            state['phase'] = 'booster'
            state['setup_queue'] = list(reversed(state['seat_order']))
        state['current_turn'] = state['setup_queue'][0]
    elif phase == 'booster':
        require(kind == 'choose_booster' and action['booster'] in state['booster_market'], 'Choose an available booster.')
        p['booster'] = action['booster']
        state['booster_market'].remove(p['booster'])
        state['setup_queue'].pop(0)
        if state['setup_queue']:
            state['current_turn'] = state['setup_queue'][0]
        else:
            _start_round(state)
    elif phase == 'income':
        require(kind == 'income', 'Choose the next power income to receive.')
        items = state['income_pending'][pid]
        require(action['index'] < len(items), 'Income source is no longer available.')
        if 'brain_first' in action:
            p['brain_first'] = action['brain_first']
        _gain(state, pid, items.pop(action['index'])['gain'])
        _advance_income(state)
    elif phase == 'gaia':
        if kind == 'gaia_finish':
            _return_gaia(p)
            p['terrans_budget'] = 0
            state['gaia_queue'].pop(0)
            _advance_gaia(state)
        elif kind == 'terrans_convert':
            require(p['faction'] == 'terrans' and _pi(state, pid), 'Terrans institute required.')
            key = action['resource']
            cost = {'credits': 1, 'ore': 3, 'knowledge': 4, 'qic': 4}[key]
            require(p['terrans_budget'] >= cost, 'Not enough returning Gaia power.')
            p['terrans_budget'] -= cost
            _gain(state, pid, {key: 1})
        elif kind == 'itars_tech':
            require(p['faction'] == 'itars' and _pi(state, pid) and p['gaia_power'] >= 4, 'Itars institute and four Gaia tokens required.')
            require(_tech_options(state, pid), 'No available technology.')
            p['gaia_power'] -= 4
            _queue(state, 'tech', pid)
        else:
            raise RuleError('Resolve the Gaia phase first.')
    elif phase == 'action':
        require(pid not in state['passed'], 'You have passed.')
        if kind in ('convert', 'burn', 'power_preference'):
            _apply_free(state, pid, action)
            return
        if kind == 'end_turn':
            require(state['main_done'], 'Take one main action before ending your turn.')
            _next_turn(state)
            return
        require(not state['main_done'], 'You already took your main action; convert resources or End Turn.')
        if kind == 'build':
            require(action['hex'] in state['board'], 'Unknown planet.')
            _build(state, pid, action)
        elif kind == 'gaiaform':
            info = _gaia_cost(state, pid, action)
            _pay(state, pid, info['cost'])
            _tokens_pay(p, info['tokens'], action, True)
            p['gaiaformers'] -= 1
            state['board'][action['hex']]['gaiaformer'] = pid
            _use_source(state, pid, action.get('source', 'normal'))
            _log(state, pid, f'启动盖亚计划 · {action["hex"]}')
        elif kind == 'upgrade':
            cost = _upgrade_cost(state, pid, action['hex'], action['building'])
            _pay(state, pid, cost)
            h = state['board'][action['hex']]
            building = action['building']
            h['buildings'][pid] = building
            if building in ('lab', 'academy_knowledge', 'academy_qic'):
                _queue(state, 'tech', pid)
            if building == 'institute' and p['faction'] == 'gleens':
                _federation_token(state, pid, 'gleens', 'gleens')
            if building == 'trading_station':
                _score_event(state, pid, 'trading')
            if BUILDINGS[building]['power'] == 3:
                _score_event(state, pid, 'big')
            _leech(state, pid, h)
            _log(state, pid, f'升级 {BUILDINGS[building]["name"]} · {h["id"]}')
        elif kind == 'research':
            _pay(state, pid, {'knowledge': 4})
            _research(state, pid, action['track'])
        elif kind == 'federation':
            _federate(state, pid, action)
        elif kind == 'power_action':
            which = action['action']
            require(which not in state['used_power'], 'Action already used this round.')
            spec = POWER_ACTIONS[which]
            require('terraform' not in spec, 'Select a planet to use a terraforming action.')
            _pay(state, pid, spec['cost'])
            state['used_power'].append(which)
            _gain(state, pid, spec.get('gain', {}))
            if which == 'tech':
                require(_tech_options(state, pid), 'No technology available.')
                _queue(state, 'tech', pid)
            elif which == 'rescore':
                index = action.get('token_index', -1)
                require(0 <= index < len(p['federations']), 'Select one of your federation tokens.')
                _gain(state, pid, FEDERATIONS[p['federations'][index]['token']])
            elif which == 'diversity':
                _gain(state, pid, {'vp': 3 + _metric(state, pid, 'types')})
            _log(state, pid, f'公共行动 · {which}')
        elif kind == 'special':
            _special(state, pid, action)
        elif kind == 'pass':
            require(state['round'] == 6 or action.get('booster') in state['booster_market'], 'Choose a different available booster.')
            _pass_score(state, pid)
            old = p['booster']
            if state['round'] < 6:
                p['booster'] = action['booster']
                state['booster_market'].remove(p['booster'])
            else:
                p['booster'] = None
            state['booster_market'].append(old)
            state['passed'].append(pid)
            _log(state, pid, '放弃本轮')
            _next_turn(state)
            return
        else:
            raise RuleError('Unknown main action.')
        state['main_done'] = True
        _normalize_pending(state)
    else:
        raise RuleError('Invalid game phase.')


def action_options(state: Dict, pid: str) -> List[Dict]:
    """Concrete, already-priced choices for UI and bots; no client rule guesses."""
    if pid not in state['players'] or state['game_over']:
        return []
    options = []

    def add(kind: str, label: str, category: str = 'action', cost: Optional[Dict] = None, **params: object) -> None:
        options.append(dict(action=dict(type=kind, **params), label=label, category=category, cost=cost or {}))

    if state['phase'] == 'round_end':
        if pid not in state['ready']:
            add('next_round', 'Next Round', 'next')
        return options
    if _actor(state) != pid:
        return []
    p, phase = state['players'][pid], state['phase']
    if state['pending']:
        pending = state['pending'][0]
        kind = pending['kind']
        if kind == 'leech':
            bonus = p['faction'] == 'taklons' and _pi(state, pid)
            for first in ([True, False] if bonus else [False]):
                amount = min(pending['value'], _capacity(p) + (2 if first else 0), p['vp'] + 1)
                add('leech', f'接受 {amount} ⚡ / {max(0, amount - 1)} ⭐' + (' · 先获得能量' if first else ' · 后获得能量' if bonus else ''), 'decision', accept=True, token_first=first)
            add('leech', 'Decline', 'decision', accept=False)
        elif kind == 'tech':
            for o in _tech_options(state, pid):
                tile = o['tile']
                for cover in o['covers'] or [None]:
                    params = {'tile': tile}
                    if cover:
                        params['cover'] = cover
                    add('choose_tech', (TECHS.get(tile) or ADVANCED[tile])['name'] + (f' · 覆盖 {TECHS[cover]["name"]}' if cover else ''), 'technology', **params)
        elif kind == 'track':
            for track in pending['tracks']:
                if _can_research(state, pid, track):
                    add('choose_track', f'{TRACK_NAMES[track]} → {p["research"][track] + 1}', 'research', track=track)
            add('skip_track', 'Skip research', 'decision')
        elif kind == 'lost':
            for h in state['board'].values():
                cost = {'qic': _range_cost(state, pid, h)}
                if h['planet'] is None and not h['buildings'] and not h['satellites'] and _can_pay(state, pid, cost):
                    add('lost_planet', '放置失落星球', 'map', cost, hex=h['id'])
        return options
    if phase == 'faction':
        colors = {FACTIONS[o['faction']]['home'] for o in state['players'].values() if o['faction']}
        for faction, spec in FACTIONS.items():
            if spec['home'] not in colors:
                add('choose_faction', spec['name'], 'faction', faction=faction)
    elif phase == 'placement':
        for h in state['board'].values():
            if h['planet'] == FACTIONS[p['faction']]['home'] and not h['buildings']:
                add('place_initial', '放置起始建筑', 'map', hex=h['id'])
    elif phase == 'booster':
        for booster in state['booster_market']:
            add('choose_booster', BOOSTERS[booster]['name'], 'booster', booster=booster)
    elif phase == 'income':
        for index, item in enumerate(state['income_pending'][pid]):
            add('income', item['source'], 'income', index=index)
    elif phase == 'gaia':
        if p['faction'] == 'terrans':
            for key, cost in [('credits', 1), ('ore', 3), ('knowledge', 4), ('qic', 4)]:
                if p['terrans_budget'] >= cost:
                    add('terrans_convert', f'{cost} ⚡ → 1 {key}', 'decision', resource=key)
        elif p['faction'] == 'itars' and p['gaia_power'] >= 4 and _tech_options(state, pid):
            add('itars_tech', '4 盖亚能量 → 科技', 'decision')
        add('gaia_finish', 'Finish Gaia phase', 'next')
    elif phase == 'action':
        conversions = list(CONVERSIONS)
        if p['faction'] == 'hadsch_hallas' and _pi(state, pid):
            conversions += ['credits_ore', 'credits_knowledge', 'credits_qic']
        if p['faction'] == 'nevlas':
            conversions += ['nevlas_knowledge']
        if p['faction'] == 'bal_taks':
            conversions += ['bal_taks_qic']
        for conversion in conversions:
            cost, gain = _conversion(state, pid, conversion)
            limit = min((p['power'][2] if k == 'token_iii' else p['gaiaformers'] if k == 'gaiaformers' else _power_available(state, pid) if k == 'power' else p[k]) // v for k, v in cost.items())
            if limit:
                add('convert', conversion, 'free', cost, conversion=conversion)
                options[-1]['max_count'] = min(limit, 30)
                options[-1]['gain'] = gain
        if p['power'][1] >= 2:
            add('burn', '燃烧能量', 'free', count=1)
            options[-1]['max_count'] = p['power'][1] // 2
        if p['brain'] == 1 and p['power'][1]:
            add('burn', '燃烧并提升脑石', 'free', count=1, brain=True)
        if p['brain'] is not None:
            add('power_preference', 'Brainstone first' if not p['brain_first'] else 'Regular tokens first', 'free', brain_first=not p['brain_first'])
        if state['main_done']:
            add('end_turn', 'End Turn', 'next')
            return options
        sources = ['normal', 'booster_range', 'booster_terraform', 'terraform_1', 'terraform_2']
        for h in state['board'].values():
            if h['planet']:
                for source in sources:
                    try:
                        info = build_cost(state, pid, h['id'], source)
                        suffix = '' if source == 'normal' else ' · ' + source
                        add('build', '建造矿场' + suffix, 'map', info['cost'], hex=h['id'], source=source)
                    except RuleError:
                        pass
                for source in ['normal', 'booster_range']:
                    action = dict(type='gaiaform', hex=h['id'], source=source)
                    try:
                        info = _gaia_cost(state, pid, action)
                        add('gaiaform', '启动盖亚计划' + (' · 航程 +3' if source != 'normal' else ''), 'map', {**info['cost'], 'tokens': info['tokens']}, hex=h['id'], source=source)
                    except RuleError:
                        pass
            if pid in h['buildings']:
                for building in ['trading_station', 'lab', 'institute', 'academy_knowledge', 'academy_qic']:
                    try:
                        cost = _upgrade_cost(state, pid, h['id'], building)
                        add('upgrade', '升级 ' + BUILDINGS[building]['name'], 'map', cost, hex=h['id'], building=building)
                    except RuleError:
                        pass
        for track in TRACKS:
            if _can_research(state, pid, track) and p['knowledge'] >= 4:
                add('research', f'{TRACK_NAMES[track]} → {p["research"][track] + 1}', 'research', {'knowledge': 4}, track=track)
        for which, spec in POWER_ACTIONS.items():
            if which in state['used_power'] or 'terraform' in spec or not _can_pay(state, pid, spec['cost']):
                continue
            if which == 'rescore':
                for index, token in enumerate(p['federations']):
                    add('power_action', '重算联邦 · ' + token['token'], 'power', spec['cost'], action=which, token_index=index)
            elif which != 'tech' or _tech_options(state, pid):
                add('power_action', which, 'power', spec['cost'], action=which)
        candidates = []
        if _counts(state, pid)['academy_qic']:
            candidates.append(dict(type='special', action='academy'))
        candidates += [dict(type='special', action=t) for t in _active_techs(p) if 'special' in (TECHS.get(t) or ADVANCED[t])]
        if p['faction'] == 'bescods':
            candidates += [dict(type='special', action='bescods', track=t) for t in TRACKS if p['research'][t] == min(p['research'].values()) and _can_research(state, pid, t)]
        if _pi(state, pid):
            if p['faction'] in ('ambas', 'firaks'):
                needed = 'mine' if p['faction'] == 'ambas' else 'lab'
                candidates += [dict(type='special', action=p['faction'], hex=h['id']) for h in _owned(state, pid) if h['buildings'][pid] == needed and (needed != 'lab' or _counts(state, pid)['trading_station'] < 4)]
            elif p['faction'] == 'ivits' and _counts(state, pid)['station'] < 6:
                candidates += [dict(type='special', action='ivits', hex=h['id']) for h in state['board'].values() if h['planet'] is None and not h['buildings'] and _range_cost(state, pid, h) <= p['qic']]
        for action in candidates:
            if action['action'] not in p['used_special']:
                category = 'map' if 'hex' in action else 'special'
                label = (TECHS.get(action['action']) or ADVANCED.get(action['action']) or {}).get('name', action['action'])
                if 'track' in action:
                    label += ' · ' + TRACK_NAMES[action['track']]
                cost = {'qic': _range_cost(state, pid, state['board'][action['hex']])} if action['action'] == 'ivits' else {}
                add('special', label, category, cost, **{k: v for k, v in action.items() if k != 'type'})
        for booster in state['booster_market'] if state['round'] < 6 else [None]:
            params = {'booster': booster} if booster else {}
            add('pass', '放弃本轮' + (' · ' + BOOSTERS[booster]['name'] if booster else ''), 'pass', **params)
    return options


def _validate_state(state: Dict) -> None:
    require(state.get('version') == 1 and state.get('game_id') == 'gaia_project', 'Invalid Gaia Project save.')
    require(2 <= len(state['players']) <= 4, 'Invalid player count.')
    require(set(state['seat_order']) == set(state['players']) == set(state['turn_order']), 'Invalid turn order.')
    require(len(state['turn_order']) == len(state['players']), 'Duplicate player.')
    require(0 <= state['round'] <= 6, 'Invalid round.')
    require(len({(h['q'], h['r']) for h in state['board'].values()}) == len(state['board']), 'Overlapping map hexes.')
    for pid, p in state['players'].items():
        for k in ('ore', 'credits', 'knowledge', 'qic', 'vp', 'gaia_power', 'gaiaformers', 'gaiaformers_held'):
            require(type(p[k]) is int and p[k] >= 0, f'Invalid {k}.')
        require(p['ore'] <= 15 and p['knowledge'] <= 15 and p['credits'] <= 30, 'Resource capacity exceeded.')
        require(len(p['power']) == 3 and all(type(v) is int and v >= 0 for v in p['power']), 'Invalid power bowls.')
        require(p['brain'] in (None, 0, 1, 2, 3), 'Invalid brainstone.')
        require(set(p['research']) == set(TRACKS) and all(type(v) is int and 0 <= v <= 5 for v in p['research'].values()), 'Invalid research.')
        for kind, count in _counts(state, pid).items():
            require(kind in BUILDINGS and count <= BUILDINGS[kind]['limit'], 'Too many structures.')
    for track in TRACKS:
        require(sum(p['research'][track] == 5 for p in state['players'].values()) <= 1, 'Research level 5 is exclusive.')


class GaiaProjectGame:
    game_id = 'gaia_project'
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = dict(config or {})
        error = next(_CONFIG_VALIDATOR.iter_errors(config), None)
        if error:
            raise ValueError(error.message)
        require(2 <= len(players) <= 4, 'Gaia Project requires 2–4 players.')
        players = sorted(players, key=lambda p: p.get('seat', 0))
        ids = [p['player_id'] for p in players]
        require(len(set(ids)) == len(ids), 'Player IDs must be unique.')
        config.setdefault('seed', random.SystemRandom().randrange(2 ** 32))
        config.setdefault('variable_turn_order', False)
        rng = random.Random(config['seed'])
        techs = list(TECHS)
        rng.shuffle(techs)
        federations = {t: 3 for t in FEDERATIONS if t != 'gleens'}
        terraform = rng.choice(list(federations))
        federations[terraform] -= 1
        state = dict(version=1, game_id='gaia_project', config=config, board=_board(len(players)),
                     players={}, player_meta={p['player_id']: copy.deepcopy(p) for p in players},
                     seat_order=ids, turn_order=ids.copy(), current_turn=ids[0], phase='faction', round=0,
                     setup_queue=[], pending=[], passed=[], ready=[], main_done=False,
                     used_power=[], log=[], game_over=False, winner=[], scores=None,
                     tech_market=techs, tech_stock={t: 4 for t in TECHS},
                     advanced_market=dict(zip(TRACKS, rng.sample(list(ADVANCED), 6))),
                     booster_market=rng.sample(list(BOOSTERS), len(players) + 3),
                     federation_supply=federations, terraform_token=terraform,
                     round_tiles=rng.sample(list(ROUND_TILES), 6), final_tiles=rng.sample(list(FINALS), 2),
                     income_pending={}, gaia_queue=[], round_summary={}, round_start_vp={})
        for pid in ids:
            state['players'][pid] = dict(faction=None, ore=0, credits=0, knowledge=0, qic=0, vp=10,
                power=[0, 0, 0], gaia_power=0, brain=None, brain_first=True, research={t: 0 for t in TRACKS},
                gaiaformers=0, gaiaformers_held=0, terrans_budget=0, booster=None,
                techs=[], advanced=[], covered=[], federations=[], used_special=[])
        _validate_state(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        kinds = list(dict.fromkeys(o['action']['type'] for o in action_options(state, player_id)))
        if player_id in state['players'] and state['phase'] == 'action' and not state['pending'] and state['current_turn'] == player_id and not state['main_done']:
            kinds.append('federation')
        return kinds

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get('players', {}):
            return [], 'Unknown player.'
        error = next(_ACTION_VALIDATOR.iter_errors(action), None)
        if error:
            return [], 'Invalid action payload: ' + error.message
        candidate = copy.deepcopy(state)
        try:
            _apply(candidate, player_id, action)
            _validate_state(candidate)
        except (RuleError, KeyError, TypeError, IndexError) as exc:
            return [], str(exc) or 'Invalid action.'
        state.clear()
        state.update(candidate)
        return [{'type': 'gaia_project:action', 'payload': {'player_id': player_id, 'action': action['type']}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        view = {key: copy.deepcopy(state[key]) for key in ('phase', 'round', 'board', 'turn_order', 'passed',
                'ready', 'main_done', 'pending', 'booster_market', 'tech_market', 'tech_stock', 'advanced_market',
                'federation_supply', 'terraform_token', 'round_tiles', 'final_tiles', 'used_power', 'log',
                'round_summary', 'scores', 'winner', 'game_over')}
        view.update(game_id='gaia_project', you=viewer_id, current_turn=_actor(state),
                    turn_owner=state['current_turn'], options=action_options(state, viewer_id), players=[])
        for pid in state['seat_order']:
            p = copy.deepcopy(state['players'][pid])
            p.update(player_id=pid, name=state['player_meta'][pid].get('name', pid),
                     is_bot=bool(state['player_meta'][pid].get('is_bot')), income=income_sources(state, pid),
                     counts=dict(_counts(state, pid)), objectives={t: _metric(state, pid, t) for t in FINALS})
            view['players'].append(p)
        view['income_pending'] = copy.deepcopy(state['income_pending'].get(viewer_id, []))
        view['can_federate'] = (state['phase'] == 'action' and _actor(state) == viewer_id and not state['pending'] and not state['main_done'])
        view['definitions'] = copy.deepcopy(dict(factions=FACTIONS, planets=PLANETS, buildings=BUILDINGS,
            tracks=TRACK_NAMES, boosters=BOOSTERS, techs=TECHS, advanced=ADVANCED, rounds=ROUND_TILES,
            finals=FINALS, federations=FEDERATIONS, power_actions=POWER_ACTIONS, wheel=WHEEL))
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        options = action_options(state, bot_id)
        if not options:
            return None
        p = state['players'][bot_id]
        # Deterministic legal play, deliberately separate from official solo Automa.
        def value(option: Dict) -> float:
            a, cost = option['action'], option['cost']
            kind = a['type']
            priority = {'next_round': 1000, 'end_turn': 1000, 'choose_faction': 200,
                        'place_initial': 200, 'choose_booster': 200, 'income': 200,
                        'choose_track': 140, 'choose_tech': 160, 'lost_planet': 200,
                        'itars_tech': 120, 'terrans_convert': 100, 'gaia_finish': 0,
                        'research': 35, 'build': 45, 'upgrade': 40, 'special': 38,
                        'gaiaform': 18 if state['round'] < 5 else -20,
                        'power_action': 32, 'pass': -10, 'convert': -40,
                        'burn': -50, 'power_preference': -100, 'skip_track': -5}.get(kind, 0)
            if kind == 'leech':
                return 100 if a['accept'] else 0
            if kind == 'choose_faction':
                # Rotate choices by seed / seat so simulations exercise every faction.
                index = state['seat_order'].index(bot_id)
                faction_order = list(FACTIONS)
                offset = sum(ord(c) for c in str(state['config']['seed'])) + index * 3
                return priority - ((faction_order.index(a['faction']) - offset) % len(faction_order))
            if kind == 'place_initial':
                h = state['board'][a['hex']]
                own = _owned(state, bot_id)
                neighbors = sum(other['planet'] is not None and distance(h, other) <= 2 for other in state['board'].values())
                return priority + neighbors - (min(distance(h, x) for x in own) if own else 0)
            if kind == 'choose_booster' or kind == 'pass':
                return priority + (3 if a.get('booster') in ('ore_knowledge', 'mines', 'trading') else 0)
            if kind in ('research', 'choose_track'):
                track = a['track']
                priority += {'economy': 7, 'science': 6, 'terraforming': 4, 'navigation': 3, 'ai': 1, 'gaia': 0}[track]
                priority += 2 * p['research'][track]
            if kind == 'upgrade':
                priority += {'trading_station': 1, 'lab': 8, 'institute': 9, 'academy_knowledge': 4, 'academy_qic': 2}[a['building']]
            if kind == 'convert':
                # Only convert in direct service of a useful main action, preventing loops.
                if a['conversion'] == 'power_ore' and p['ore'] < 2:
                    priority = 60
                if a['conversion'] == 'power_credits' and p['credits'] < 3:
                    priority = 55
                if a['conversion'] == 'nevlas_knowledge' and p['knowledge'] < 4:
                    priority = 50
            return priority - cost.get('ore', 0) * 1.5 - cost.get('qic', 0) * 2 - cost.get('credits', 0) * 0.2
        action = copy.deepcopy(max(options, key=value)['action'])
        return action

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        state = copy.deepcopy(payload)
        try:
            _validate_state(state)
        except (KeyError, TypeError, RuleError) as exc:
            raise ValueError(f'Invalid Gaia Project save: {exc}') from exc
        return state
