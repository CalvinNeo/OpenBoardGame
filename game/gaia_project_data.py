"""Base-game facts for Gaia Project. See designs/task96.md for rule sources.

All visuals are rendered locally. No publisher artwork is distributed.
"""
from typing import Dict

TRACKS = ['terraforming', 'navigation', 'ai', 'gaia', 'economy', 'science']
TRACK_NAMES = dict(zip(TRACKS, ['地形改造', '航行', '人工智能', '盖亚计划', '经济', '科学']))
PLANETS = {
    'terra': {'name': '类地星', 'color': '#51a9ef', 'emoji': '🔵'},
    'oxide': {'name': '氧化星', 'color': '#f46b79', 'emoji': '🔴'},
    'volcanic': {'name': '火山星', 'color': '#f4a34e', 'emoji': '🟠'},
    'desert': {'name': '沙漠星', 'color': '#efd35d', 'emoji': '🟡'},
    'swamp': {'name': '沼泽星', 'color': '#b68a68', 'emoji': '🟤'},
    'titanium': {'name': '钛金星', 'color': '#a1a9be', 'emoji': '⚫'},
    'ice': {'name': '冰冻星', 'color': '#e7f2fc', 'emoji': '⚪'},
    'gaia': {'name': '盖亚星', 'color': '#65dc9b', 'emoji': '🟢'},
    'transdim': {'name': '超维星', 'color': '#b487ef', 'emoji': '🟣'},
    'lost': {'name': '失落星球', 'color': '#f6c5ec', 'emoji': '🌌'},
}
# The clockwise terraforming wheel, not the faction-board order.
WHEEL = ['terra', 'swamp', 'titanium', 'ice', 'oxide', 'volcanic', 'desert']
BUILDINGS = {
    'mine': {'name': '矿场', 'icon': '⛏', 'limit': 8, 'power': 1},
    'trading_station': {'name': '交易站', 'icon': '◆', 'limit': 4, 'power': 2},
    'lab': {'name': '研究所', 'icon': '⚗', 'limit': 3, 'power': 2},
    'institute': {'name': '行星学院', 'icon': '♜', 'limit': 1, 'power': 3},
    'academy_knowledge': {'name': '知识大学', 'icon': '♛', 'limit': 1, 'power': 3},
    'academy_qic': {'name': 'QIC 大学', 'icon': '♛', 'limit': 1, 'power': 3},
    'lost_mine': {'name': '失落矿场', 'icon': '☆', 'limit': 1, 'power': 1},
    'station': {'name': '空间站', 'icon': '⬡', 'limit': 6, 'power': 1},
}


def _faction(name: str, home: str, ability: str, institute: str, **overrides: object) -> Dict:
    result = dict(name=name, home=home, ability=ability, institute=institute,
                  credits=15, ore=4, knowledge=3, qic=1, power=[2, 4, 0],
                  start_track=None, income={'ore': 1, 'knowledge': 1}, pi_tokens=1)
    result.update(overrides)
    return result


FACTIONS = {
    'terrans': _faction('地球人 Terrans', 'terra', '盖亚区能量返回 II 碗。', '盖亚返回的能量还可按自由行动汇率兑换资源。', power=[4, 4, 0], start_track='gaia'),
    'lantids': _faction('兰蒂斯人 Lantids', 'terra', '可在对手星球共居建矿，无改造费；共居矿不可升级，不计星球种类或盖亚数量。', '共居建矿获得 2 知识。', credits=13, power=[4, 0, 0], pi_tokens=0),
    'xenos': _faction('异星人 Xenos', 'desert', '开局额外放置第三座矿场。', '联邦力量门槛降至 6；学院收入改为 1 QIC 与 4 充能。', start_track='ai', pi_tokens=0),
    'gleens': _faction('格伦星人 Gleens', 'desert', 'QIC 大学建好前获得的 QIC 改为矿石；盖亚适居费为 1 矿石；盖亚建矿额外 2 VP。', '立即获得专属联邦标记（1 矿石、1 知识、2 信用点）。', qic=0, start_track='navigation', pi_tokens=0),
    'taklons': _faction('塔克隆人 Taklons', 'swamp', '脑石算一枚能量，但在 III 碗消费时值 3 能量。', '接受被动充能时，额外获得一枚能量；可选先获得或后获得。'),
    'ambas': _faction('安巴斯人 Ambas', 'swamp', '基础矿石收入为 2；开局航行 1 级。', '每轮一次交换学院与自己的一座矿场。', start_track='navigation', income={'ore': 2, 'knowledge': 1}, pi_tokens=2),
    'hadsch_hallas': _faction('哈什哈拉人 Hadsch Hallas', 'oxide', '额外基础收入 3 信用点；开局经济 1 级。', '可以信用点代替能量兑换矿石、知识、QIC。', start_track='economy', income={'ore': 1, 'knowledge': 1, 'credits': 3}),
    'ivits': _faction('蜂人 Ivits', 'oxide', '开局只放学院；额外 1 QIC 收入；始终扩张同一联邦，卫星花费 QIC。', '每轮一次在航程内的太空放空间站，可作为航程起点和 1 联邦力量。', income={'ore': 1, 'knowledge': 1, 'qic': 1}),
    'geodens': _faction('晶矿星人 Geodens', 'volcanic', '开局地形改造 1 级。', '首次殖民尚未拥有的星球类型时获得 3 知识。', start_track='terraforming'),
    'bal_taks': _faction('炽炎族 Bal T’aks', 'volcanic', '学院建成前不可研究航行；可暂存可用改造器换 1 QIC，下轮归还。', '解除航行限制。QIC 大学特殊行动改为获得 4 信用点。', qic=0, power=[2, 2, 0], start_track='gaia'),
    'firaks': _faction('菲拉克斯人 Firaks', 'titanium', '基础知识收入 2。', '可将研究所降为交易站，免费研究一次；视作升级交易站。', ore=3, knowledge=2, income={'ore': 1, 'knowledge': 2}),
    'bescods': _faction('比斯科人 Bescods', 'titanium', '交易站产知识、研究所产信用点；学院／大学位置互换；每轮可免费推进最低研究轨道。', '钛金星上的建筑力量额外 +1。', knowledge=1, income={'ore': 1}, pi_tokens=2),
    'nevlas': _faction('内华拉人 Nevlas', 'ice', '可将 III 碗一枚能量移至盖亚区获得 1 知识；研究所收入为每座 2 充能。', 'III 碗每枚能量值 2；多余半枚能量不能留到另一次兑换。', knowledge=2, start_track='science'),
    'itars': _faction('伊塔星人 Itars', 'ice', '燃烧丢弃的能量进入盖亚区；知识大学收入为 3。', '盖亚阶段可丢弃盖亚区 4 枚能量获得一块科技，可重复。', ore=5, power=[4, 4, 0], income={'ore': 1, 'knowledge': 1, 'tokens': 1}),
}

BOOSTERS = {
    'ore_knowledge': dict(name='科研补给', income={'ore': 1, 'knowledge': 1}),
    'credits_qic': dict(name='量子补给', income={'credits': 2, 'qic': 1}),
    'tokens_ore': dict(name='能量补给', income={'tokens': 2, 'ore': 1}),
    'terraform': dict(name='地形改造', income={'credits': 2}, special='terraform'),
    'range': dict(name='远航', income={'charge': 2}, special='range'),
    'mines': dict(name='采矿网络', income={'ore': 1}, passing=['mines', 1]),
    'labs': dict(name='研究网络', income={'knowledge': 1}, passing=['labs', 3]),
    'trading': dict(name='贸易网络', income={'ore': 1}, passing=['trading', 2]),
    'institutes': dict(name='学府网络', income={'charge': 4}, passing=['big', 4]),
    'gaia': dict(name='盖亚网络', income={'credits': 4}, passing=['gaia', 1]),
}
TECHS = {
    'power_action': dict(name='能量中枢', special={'charge': 4}),
    'ore_qic': dict(name='量子矿物', immediate={'ore': 1, 'qic': 1}),
    'diversity': dict(name='星球知识', metric=['types', 1, 'knowledge']),
    'points': dict(name='技术突破', immediate={'vp': 7}),
    'ore_power': dict(name='采矿技术', income={'ore': 1, 'charge': 1}),
    'knowledge_credit': dict(name='研究资助', income={'knowledge': 1, 'credits': 1}),
    'credits': dict(name='金融技术', income={'credits': 4}),
    'structure_power': dict(name='巨型建筑', effect='大学和行星学院力量变为 4。'),
    'gaia_points': dict(name='盖亚文明', event=['gaia', 3]),
}
ADVANCED = {
    'qic_credits': dict(name='量子贸易', special={'qic': 1, 'credits': 5}),
    'ore_action': dict(name='深层开采', special={'ore': 3}),
    'knowledge_action': dict(name='研究中心', special={'knowledge': 3}),
    'mine_points': dict(name='矿业成就', metric=['mines', 2, 'vp']),
    'trading_points': dict(name='贸易成就', metric=['trading', 4, 'vp']),
    'federation_points': dict(name='联邦成就', metric=['federations', 5, 'vp']),
    'sector_points': dict(name='星区成就', metric=['sectors', 2, 'vp']),
    'gaia_points_advanced': dict(name='盖亚成就', metric=['gaia', 2, 'vp']),
    'sector_ore': dict(name='星区资源', metric=['sectors', 1, 'ore']),
    'pass_federations': dict(name='联邦协作', passing=['federations', 3]),
    'pass_labs': dict(name='科研协作', passing=['labs', 3]),
    'pass_types': dict(name='多样文明', passing=['types', 1]),
    'research_vp': dict(name='科学文明', event=['research', 2]),
    'mine_vp': dict(name='殖民文明', event=['mine', 3]),
    'trading_vp': dict(name='贸易文明', event=['trading', 3]),
}
ROUND_TILES = {
    'mines_1': dict(name='建矿 +2', event='mine', vp=2),
    'trading_3': dict(name='交易站 +3', event='trading', vp=3),
    'trading_4': dict(name='交易站 +4', event='trading', vp=4),
    'big_1': dict(name='大学／学院 +5', event='big', vp=5),
    'big_2': dict(name='大学／学院 +5', event='big', vp=5),
    'gaia_3': dict(name='盖亚建矿 +3', event='gaia', vp=3),
    'gaia_4': dict(name='盖亚建矿 +4', event='gaia', vp=4),
    'terraform': dict(name='每改造一步 +2', event='terraform', vp=2),
    'research': dict(name='每科研一级 +2', event='research', vp=2),
    'federation': dict(name='联邦标记 +5', event='federation', vp=5),
}
FINALS = {
    'federated': dict(name='联邦建筑', neutral=10),
    'buildings': dict(name='建筑总数', neutral=11),
    'types': dict(name='星球种类', neutral=5),
    'gaia': dict(name='盖亚星球', neutral=4),
    'sectors': dict(name='殖民星区', neutral=6),
    'satellites': dict(name='卫星总数', neutral=8),
}
FEDERATIONS = {
    'knowledge': dict(vp=6, knowledge=2), 'credits': dict(vp=7, credits=6),
    'ore': dict(vp=7, ore=2), 'tokens': dict(vp=8, tokens=2),
    'qic': dict(vp=8, qic=1), 'points': dict(vp=12),
    'gleens': dict(ore=1, knowledge=1, credits=2),
}
POWER_ACTIONS = {
    'knowledge_3': dict(cost={'power': 7}, gain={'knowledge': 3}),
    'terraform_2': dict(cost={'power': 5}, terraform=2),
    'ore_2': dict(cost={'power': 4}, gain={'ore': 2}),
    'credits_7': dict(cost={'power': 4}, gain={'credits': 7}),
    'knowledge_2': dict(cost={'power': 4}, gain={'knowledge': 2}),
    'terraform_1': dict(cost={'power': 3}, terraform=1),
    'tokens_2': dict(cost={'power': 3}, gain={'tokens': 2}),
    'tech': dict(cost={'qic': 4}, choice='tech'),
    'rescore': dict(cost={'qic': 3}, choice='federation'),
    'diversity': dict(cost={'qic': 2}, choice='types'),
}
CONVERSIONS = {
    'power_qic': ({'power': 4}, {'qic': 1}),
    'power_ore': ({'power': 3}, {'ore': 1}),
    'qic_ore': ({'qic': 1}, {'ore': 1}),
    'power_knowledge': ({'power': 4}, {'knowledge': 1}),
    'power_credits': ({'power': 1}, {'credits': 1}),
    'knowledge_credits': ({'knowledge': 1}, {'credits': 1}),
    'ore_credits': ({'ore': 1}, {'credits': 1}),
    'ore_token': ({'ore': 1}, {'tokens': 1}),
}


def _action(kind: str, props: Dict = None, required: tuple = ()) -> Dict:
    return {'type': 'object', 'properties': {'type': {'const': kind}, **(props or {})},
            'required': ['type', *required], 'additionalProperties': False}


_STRING = {'type': 'string', 'minLength': 1, 'maxLength': 50}
_HEXES = {'type': 'array', 'items': _STRING, 'uniqueItems': True, 'maxItems': 190}
_TRACK = {'type': 'string', 'enum': TRACKS}
_POWER = {'type': 'array', 'items': {'type': 'integer', 'minimum': 0, 'maximum': 100}, 'minItems': 3, 'maxItems': 3}
_PAY = {'power_tokens': _POWER, 'brain': {'type': 'boolean'}}
ACTION_SCHEMA = {'type': 'object', 'oneOf': [
    _action('choose_faction', {'faction': {'enum': list(FACTIONS)}}, ('faction',)),
    _action('place_initial', {'hex': _STRING}, ('hex',)),
    _action('choose_booster', {'booster': {'enum': list(BOOSTERS)}}, ('booster',)),
    _action('income', {'index': {'type': 'integer', 'minimum': 0, 'maximum': 30}, 'brain_first': {'type': 'boolean'}}, ('index',)),
    _action('gaia_finish'), _action('itars_tech'),
    _action('terrans_convert', {'resource': {'enum': ['credits', 'ore', 'knowledge', 'qic']}}, ('resource',)),
    _action('build', {'hex': _STRING, 'source': _STRING}, ('hex',)),
    _action('gaiaform', {'hex': _STRING, 'source': _STRING, **_PAY}, ('hex',)),
    _action('upgrade', {'hex': _STRING, 'building': {'enum': list(BUILDINGS)}}, ('hex', 'building')),
    _action('research', {'track': _TRACK}, ('track',)),
    _action('choose_tech', {'tile': _STRING, 'cover': _STRING}, ('tile',)),
    _action('choose_track', {'track': _TRACK}, ('track',)),
    _action('skip_track'), _action('lost_planet', {'hex': _STRING}, ('hex',)),
    _action('federation', {'hexes': _HEXES, 'token': {'enum': list(FEDERATIONS)}, **_PAY}, ('hexes', 'token')),
    _action('power_action', {'action': {'enum': list(POWER_ACTIONS)}, 'token_index': {'type': 'integer', 'minimum': 0, 'maximum': 30}}, ('action',)),
    _action('special', {'action': _STRING, 'hex': _STRING, 'track': _TRACK}, ('action',)),
    _action('convert', {'conversion': _STRING, 'count': {'type': 'integer', 'minimum': 1, 'maximum': 30}}, ('conversion',)),
    _action('burn', {'count': {'type': 'integer', 'minimum': 1, 'maximum': 30}, 'brain': {'type': 'boolean'}}, ('count',)),
    _action('power_preference', {'brain_first': {'type': 'boolean'}}, ('brain_first',)),
    _action('leech', {'accept': {'type': 'boolean'}, 'token_first': {'type': 'boolean'}, 'brain_first': {'type': 'boolean'}}, ('accept',)),
    _action('pass', {'booster': {'enum': list(BOOSTERS)}}),
    _action('end_turn'), _action('next_round'),
]}
CONFIG_SCHEMA = {'type': 'object', 'properties': {
    'seed': {'type': ['integer', 'string']}, 'variable_turn_order': {'type': 'boolean'}
}, 'additionalProperties': False}

# Sector planet positions cross-checked with the printed setup diagrams.
SECTOR_HEXES = [(0, -2), (-1, -1), (1, -2), (-2, 0), (0, -1), (2, -2), (-1, 0), (1, -1), (-2, 1), (0, 0), (2, -1), (-1, 1), (1, 0), (-2, 2), (0, 1), (2, 0), (-1, 2), (1, 1), (0, 2)]
SECTORS = {'1': {6: 'swamp', 7: 'terra', 8: 'desert', 10: 'transdim', 17: 'volcanic', 18: 'oxide'}, '2': {0: 'titanium', 1: 'volcanic', 7: 'ice', 10: 'desert', 11: 'swamp', 16: 'oxide', 17: 'transdim'}, '3': {0: 'transdim', 6: 'gaia', 10: 'titanium', 12: 'ice', 16: 'terra', 18: 'desert'}, '4': {0: 'titanium', 4: 'oxide', 8: 'ice', 11: 'volcanic', 12: 'swamp', 15: 'terra'}, '5': {0: 'ice', 5: 'transdim', 6: 'gaia', 10: 'oxide', 16: 'volcanic', 18: 'desert'}, '5outlined': {0: 'ice', 5: 'transdim', 6: 'gaia', 10: 'oxide', 16: 'volcanic'}, '6': {2: 'transdim', 6: 'swamp', 7: 'terra', 14: 'gaia', 15: 'desert', 17: 'transdim'}, '6outlined': {2: 'transdim', 7: 'terra', 14: 'gaia', 15: 'desert', 17: 'transdim'}, '7': {2: 'swamp', 3: 'transdim', 4: 'oxide', 11: 'gaia', 12: 'gaia', 18: 'titanium'}, '7outlined': {3: 'transdim', 4: 'gaia', 11: 'gaia', 12: 'swamp', 18: 'titanium'}, '8': {0: 'terra', 4: 'ice', 5: 'transdim', 11: 'volcanic', 12: 'titanium', 16: 'transdim'}, '9': {1: 'volcanic', 2: 'transdim', 5: 'ice', 11: 'titanium', 12: 'gaia', 13: 'swamp'}, '10': {2: 'transdim', 5: 'transdim', 6: 'desert', 12: 'gaia', 13: 'terra', 16: 'oxide'}}
MAP_LAYOUTS = {2: [('1', 5, -1), ('5outlined', 10, -3), ('2', 2, 4), ('3', 7, 2), ('6outlined', 12, 0), ('4', 4, 7), ('7outlined', 9, 5)], 4: [('10', 5, -1), ('1', 10, -3), ('5', 15, -5), ('9', 2, 4), ('2', 7, 2), ('3', 12, 0), ('6', 17, -2), ('8', 4, 7), ('4', 9, 5), ('7', 14, 3)]}
