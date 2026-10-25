(() => {
  'use strict';
  const panel = document.getElementById('gaiaProjectPanel');
  const header = document.getElementById('gaiaProjectHeaderActions');
  const help = document.getElementById('gaiaProjectHelpBtn');
  const hintButton = document.getElementById('gaiaProjectHintBtn');
  const explainButton = document.getElementById('gaiaProjectExplainBtn');
  let view = null;
  let selectedHex = null;
  let selectedOption = null;
  let activeTab = 'galaxy';
  let boosterDocked = false;
  let boosterSelected = null;
  let boosterScrollTop = 0;
  let boosterFocusPending = false;
  let boosterSwipe = null;
  let suppressBoosterClickUntil = 0;
  let passDialogOpen = false;
  let passDocked = false;
  let passSelected = null;
  let passScrollTop = 0;
  let legendOpen = false;
  let explainMode = false;
  let suppressClickUntil = 0;
  let federationMode = false;
  let federationHexes = new Set();
  let modal = null;
  let previousFocus = null;
  let viewKey = '';
  let mapZoom = 1;
  let mapCenter = null;
  let drag = null;
  let hintPopup = null;
  let hintTarget = null;
  let hintMode = null;
  let hintTimer = null;
  let hintHideTimer = null;
  let hintGesture = null;
  let consumedHintTap = null;
  // Token art follows the physical components: yellow credit discs, white ore cubes, blue knowledge discs,
  // green Q.I.C. cubes, magenta power discs, brown VP squares, hexagonal Gaiaformers, the purple Brainstone
  // and shield-shaped federation tokens. Numbers sit inside the token like the printed icons.
  const tokenSymbols = {
    credits: '<ellipse cx="16" cy="20" rx="13.5" ry="9" fill="#a67f08"/><ellipse cx="16" cy="15" rx="13.5" ry="9.5" fill="#f8d324" stroke="#8c6c04" stroke-width="1.2"/><ellipse cx="14" cy="12" rx="7" ry="3" fill="#fff" opacity=".28"/>',
    ore: '<path d="M4 10 L10 4 H30 L24 10 Z" fill="#fbfbfc" stroke="#6d7784" stroke-width="1.2" stroke-linejoin="round"/><path d="M24 10 L30 4 V24 L24 30 Z" fill="#aab2bc" stroke="#6d7784" stroke-width="1.2" stroke-linejoin="round"/><rect x="4" y="10" width="20" height="20" fill="#e9ecef" stroke="#6d7784" stroke-width="1.2" stroke-linejoin="round"/>',
    knowledge: '<ellipse cx="16" cy="20" rx="13.5" ry="9" fill="#196f9a"/><ellipse cx="16" cy="15" rx="13.5" ry="9.5" fill="#3bb7ec" stroke="#135e84" stroke-width="1.2"/><ellipse cx="14" cy="12" rx="7" ry="3" fill="#fff" opacity=".3"/>',
    qic: '<path d="M4 10 L10 4 H30 L24 10 Z" fill="#8be06a" stroke="#215f14" stroke-width="1.2" stroke-linejoin="round"/><path d="M24 10 L30 4 V24 L24 30 Z" fill="#3c8f29" stroke="#215f14" stroke-width="1.2" stroke-linejoin="round"/><rect x="4" y="10" width="20" height="20" fill="#5cc43c" stroke="#215f14" stroke-width="1.2" stroke-linejoin="round"/><g fill="#2a7a1b" opacity=".55"><circle cx="8.5" cy="14.5" r="1.4"/><circle cx="14" cy="14.5" r="1.4"/><circle cx="19.5" cy="14.5" r="1.4"/><circle cx="8.5" cy="20" r="1.4"/><circle cx="14" cy="20" r="1.4"/><circle cx="19.5" cy="20" r="1.4"/><circle cx="8.5" cy="25.5" r="1.4"/><circle cx="14" cy="25.5" r="1.4"/><circle cx="19.5" cy="25.5" r="1.4"/></g>',
    power: '<circle cx="16" cy="16" r="13" fill="#c73aa5" stroke="#7a1b66" stroke-width="1.4"/><ellipse cx="13" cy="11" rx="6" ry="3.2" fill="#fff" opacity=".22"/>',
    charge: '<path d="M5 15 A11.5 11.5 0 0 1 27 13" fill="none" stroke="#f0a2e2" stroke-width="2.2" stroke-linecap="round"/><path d="M23 9.5 L28 13.5 L22.5 15" fill="none" stroke="#f0a2e2" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="19" r="10.5" fill="#c73aa5" stroke="#7a1b66" stroke-width="1.4"/><ellipse cx="13.5" cy="15" rx="5" ry="2.6" fill="#fff" opacity=".22"/>',
    tokens: '<circle cx="16" cy="17" r="11.5" fill="#c73aa5" stroke="#7a1b66" stroke-width="1.4"/><ellipse cx="13.5" cy="13" rx="5.5" ry="2.8" fill="#fff" opacity=".22"/><circle cx="26" cy="7" r="5.2" fill="#fff" stroke="#7a1b66" stroke-width="1.2"/><path d="M26 4.4 V9.6 M23.4 7 H28.6" stroke="#7a1b66" stroke-width="1.6" stroke-linecap="round"/>',
    token_iii: '<circle cx="16" cy="14" r="11.5" fill="#c73aa5" stroke="#7a1b66" stroke-width="1.4"/><ellipse cx="13.5" cy="10" rx="5.5" ry="2.8" fill="#fff" opacity=".22"/><rect x="7" y="25" width="18" height="6" rx="2" fill="#2a1030" stroke="#8a4d80" stroke-width=".8"/><text x="16" y="29.8" font-size="5.6" font-weight="700" fill="#f3c9ec" text-anchor="middle" font-family="system-ui,sans-serif">III</text>',
    vp: '<rect x="3" y="3" width="26" height="26" rx="3" fill="#8a5a2b" stroke="#4a2c10" stroke-width="1.4"/><g stroke="#f6dea8" stroke-width="1" opacity=".42"><path d="M16 5 V27 M5 16 H27 M8 8 L24 24 M24 8 L8 24"/></g><rect x="7" y="7" width="18" height="18" fill="#9a6633" opacity=".65"/>',
    gaiaformers: '<path d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z" fill="#a9e6f7" stroke="#1f7f9e" stroke-width="1.4" stroke-linejoin="round"/><g stroke="#1f7f9e" stroke-width="1.5" stroke-linecap="round" opacity=".75"><path d="M16 7 V25 M8.2 11.5 L23.8 20.5 M23.8 11.5 L8.2 20.5"/><path d="M13 9.5 L16 11.5 L19 9.5 M13 22.5 L16 20.5 L19 22.5 M9 14 L11.5 16 L9 18 M23 14 L20.5 16 L23 18"/></g>',
    brain: '<path d="M16 2 L27 9 L29 20 L21 30 H11 L3 20 L5 9 Z" fill="#7c3fc7" stroke="#3d1a6b" stroke-width="1.3" stroke-linejoin="round"/><path d="M16 2 L27 9 L16 14 L5 9 Z" fill="#b48af0"/><path d="M5 9 L16 14 L11 30 L3 20 Z" fill="#9a63df"/><path d="M27 9 L29 20 L21 30 L16 14 Z" fill="#5f2aa3"/><path d="M16 14 L21 30 H11 Z" fill="#8a4fd6"/>',
    green_federation: '<path d="M16 2 L29 8 V20 L16 30 L3 20 V8 Z" fill="#1d6a35" stroke="#a8b0ba" stroke-width="2.2" stroke-linejoin="round"/><path d="M16 5 L19 11 L16 10 L13 11 Z M10.5 7 L14.5 11 L12 11.5 Z M21.5 7 L17.5 11 L20 11.5 Z" fill="#e4b73f"/><circle cx="16" cy="13" r="1.8" fill="#86e26a" stroke="#e4b73f" stroke-width=".8"/>',
    gray_federation: '<path d="M16 2 L29 8 V20 L16 30 L3 20 V8 Z" fill="#7b838c" stroke="#b8bec6" stroke-width="2.2" stroke-linejoin="round"/><path d="M16 5 L19 11 L16 10 L13 11 Z M10.5 7 L14.5 11 L12 11.5 Z M21.5 7 L17.5 11 L20 11.5 Z" fill="#c9ced4"/><circle cx="16" cy="13" r="1.8" fill="#9aa1a9" stroke="#c9ced4" stroke-width=".8"/>',
  };
  // Structure silhouettes use currentColor so one symbol serves every faction colour.
  const buildingSymbols = {
    mine: '<path d="M4 21 V11 H10 L13 6 H20 V21 Z"/><path d="M8 14 H10 V17 H8 Z" fill="#07111e" opacity=".45"/>',
    trading_station: '<path d="M3 21 V11 H21 V21 Z"/><path d="M2 11 L12 3 L22 11 Z"/><path d="M15.5 6.8 V2 H17.5 V8.4 Z" fill="#07111e" opacity=".45"/><path d="M9 14 H15 V18 H9 Z" fill="#07111e" opacity=".45"/>',
    lab: '<path d="M3 21 V14 A9 9 0 0 1 21 14 V21 Z"/><path d="M5 18 H19 V21 H5 Z" fill="#07111e" opacity=".35"/><circle cx="12" cy="12" r="2.2" fill="#07111e" opacity=".45"/>',
    institute: '<path d="M2 22 V12 H8 V6 H16 V12 H22 V22 Z"/><path d="M10 2 H14 V6 H10 Z"/><path d="M4 15 H7 V18 H4 Z M17 15 H20 V18 H17 Z M10.5 9 H13.5 V12 H10.5 Z" fill="#07111e" opacity=".45"/>',
    academy_knowledge: '<path d="M8 22 V8 L12 2 L16 8 V22 Z"/><path d="M3 22 V15 H8 M21 22 V15 H16" fill="none" stroke="currentColor" stroke-width="3"/><path d="M10.5 11 H13.5 V14 H10.5 Z M10.5 16 H13.5 V19 H10.5 Z" fill="#07111e" opacity=".45"/>',
    academy_qic: '<path d="M8 22 V8 L12 2 L16 8 V22 Z"/><path d="M3 22 V15 H8 M21 22 V15 H16" fill="none" stroke="currentColor" stroke-width="3"/><path d="M10.5 11 H13.5 V14 H10.5 Z M10.5 16 H13.5 V19 H10.5 Z" fill="#07111e" opacity=".45"/>',
    lost_mine: '<path d="M4 21 V11 H10 L13 6 H20 V21 Z"/><path d="M17 1 L18.2 4.1 L21.5 4.3 L18.9 6.3 L19.8 9.5 L17 7.7 L14.2 9.5 L15.1 6.3 L12.5 4.3 L15.8 4.1 Z" fill="#fff"/>',
    station: '<path d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="12" cy="12" r="2.5"/>',
  };
  const tokenNumberStyle = {credits: 'dark', ore: 'dark', gaiaformers: 'dark'};
  const tokenNumberY = {credits: 19.5, knowledge: 19.5, ore: 24.5, qic: 24.5, power: 20.5, charge: 23.5, tokens: 21.5, token_iii: 18.5, vp: 20.5, gaiaformers: 20.5, brain: 23};
  const tokenSprite = () => `<svg class="gaia-sprite" aria-hidden="true" focusable="false">${Object.entries(tokenSymbols).map(([k, body]) => `<symbol id="gtk-${k}" viewBox="0 0 32 32">${body}</symbol>`).join('')}${Object.entries(buildingSymbols).map(([k, body]) => `<symbol id="gbd-${k}" viewBox="0 0 24 24" fill="currentColor" stroke="#07111e" stroke-width="1" stroke-linejoin="round">${body}</symbol>`).join('')}</svg>`;
  const token = (key, number = '', size = '') => {
    const label = number === '' ? '' : String(number);
    const fontSize = label.length > 2 ? 9.5 : label.length > 1 ? 12 : 14.5;
    return `<svg class="gaia-tk gaia-tk-${key} ${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><use href="#gtk-${key}"/>${label ? `<text x="${['ore', 'qic'].includes(key) ? 14 : 16}" y="${tokenNumberY[key] || 20.5}" class="gaia-tk-num ${tokenNumberStyle[key] || 'light'}" font-size="${fontSize}">${esc(label)}</text>` : ''}</svg>`;
  };
  const building = (kind, fill, size = '') => `<svg class="gaia-bd ${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="color:${fill}"><use href="#gbd-${kind}"/></svg>`;
  const hintDefinitions = {
    credits: ['信用点 · 黄色圆片', '用于建造和升级建筑。最多储存 30；终局可计入剩余资源得分。'],
    ore: ['矿石 · 白色方块', '用于建造、升级和地形改造。最多储存 15。'],
    knowledge: ['知识 · 蓝色圆片', '通常支付 4 知识推进一级研究。最多储存 15。'],
    qic: ['QIC · 绿色量子智能方块', '可延长一次行动的航程、使盖亚星适居，或支付公共 QIC 行动。'],
    vp: ['胜利点 VP · 棕色方牌', '方牌中的数字是分数。通过建设、研究和计分目标得分，终局总分最高者获胜。'],
    power: ['能量费用 · 紫红圆片', '支付能量行动或资源兑换的费用；从 III 碗消费，使用后回到 I 碗。'],
    tokens: ['能量枚数 · 紫红圆片 +', '表示实体能量的数量；获得新能量时放入 I 碗。它与充能次数不同。'],
    charge: ['充能 · 带弧形箭头的紫红圆片', '表示移动能量的次数：先 I → II，I 碗空后再 II → III。'],
    token_iii: ['III 碗能量 · 紫红圆片', '这里按实体能量枚数计算；内华拉人可将其移至盖亚区换取知识。'],
    gaiaformers: ['盖亚改造器 · 雪花六边形', '用于将紫色超维星转为盖亚星。状态栏数字表示当前可以派出的数量。'],
    bowl_i: ['I 碗 · 待充能', '普通能量枚数。充能时先从这里移到 II 碗；不能直接消费。'],
    bowl_ii: ['II 碗 · 充能中', '普通能量枚数。I 碗空后可充至 III 碗；也可燃烧两枚，将其中一枚升至 III。'],
    bowl_iii: ['III 碗 · 可用能量', '普通能量枚数。可支付能量行动或资源兑换，使用后回到 I 碗；脑石另记。'],
    gaia_bowl: ['盖亚区 · 暂存能量', '暂存于盖亚区的普通能量，当前不能消费；通常在下轮盖亚阶段返回能量碗。'],
    brain: ['脑石 · 紫色宝石', '塔克隆人的特殊能量。显示所在能量碗；按一枚移动，在 III 碗消费时值 3 能量。'],
    green_federation: ['绿色联邦标记 · 绿面盾牌', '尚未使用的资格：翻至灰面可获取高级科技或进入研究第 5 级，每次分别消耗一枚。'],
    gray_federation: ['灰色联邦标记 · 灰面盾牌', '不能再用于获取高级科技或进入研究第 5 级；仍计入联邦数量，可重算标记奖励。'],
    objective: ['终局目标', '终局按此指标排名得分。两人局中的“中立”数字是参与排名的虚拟第三位玩家。'],
    seat: ['玩家标记', '数字对应玩家席位，颜色对应母星；标记所在格表示该玩家的研究等级。'],
    structure: ['建筑', '建筑剪影按玩家颜色显示：小屋矿场、尖顶交易站、圆顶研究所、宽楼行星学院、高塔学院、六边形空间站。'],
  };
  const resourceNames = Object.fromEntries(Object.entries(hintDefinitions).map(([key, value]) => [key, value[0].split(' · ')[0]]));
  const inlineTokens = html => html.replace(/(\d+)\s*(⚡|⭐)/g, (_, n, symbol) => token(symbol === '⚡' ? 'charge' : 'vp', n)).replace(/⚡/g, token('charge')).replace(/⭐/g, token('vp'));
  const metricNames = {mines: '矿场', labs: '研究所', trading: '交易站', big: '学院／大学', gaia: '盖亚星', federations: '联邦标记', types: '星球种类', sectors: '殖民星区'};
  const phaseNames = {faction: '选择种族', placement: '放置起始建筑', booster: '选择首轮推进器', income: '领取收入', gaia: '盖亚阶段', action: '行动阶段', round_end: '轮末回顾', game_over: '终局'};
  const mainLabels = {academy: '大学行动', bescods: '最低轨道研究', ambas: '交换行星学院', firaks: '降级研究所', ivits: '放置空间站', knowledge_3: '获得 3 知识', knowledge_2: '获得 2 知识', ore_2: '获得 2 矿石', credits_7: '获得 7 信用点', tokens_2: '获得 2 能量', tech: '获取科技', rescore: '重算联邦', diversity: '星球种类计分'};
  const explainText = {
    map: '点击星球查看它的类型、建筑与当前可执行行动。高亮边框表示有合法行动。建筑按玩家颜色显示剪影，下方数字是玩家席位：小屋矿场、尖顶交易站、圆顶研究所、宽楼行星学院、高塔学院、六边形空间站；雪花六边形是盖亚改造器。拖动平移星图，使用 Zoom 按钮缩放。手机在地图内滑动只平移星图，在地图外滑动可滚动页面。',
    research: '研究通常花费 4 点知识。研究轨道从 2 级推进到 3 级时，还会自动充能 3 次。推进到 5 级需要翻开一枚绿色联邦标记，而且每条轨道只能有一名玩家到达 5 级。经济和科学轨道到达 5 级时会给一次性奖励，之后不再提供 4 级的每轮收入。',
    technology: '升级研究所、大学或行星学院可以获得科技，也可以用 4 QIC 的公共行动获得科技，伊塔星人的学院能力也能获得科技。高级科技要求对应轨道至少 4 级，并且你要有一枚绿色联邦标记和一张尚未被覆盖的基础科技。拿到高级科技和推进到 5 级时，各自都会翻开一枚绿色联邦标记。',
    federation: '选择自己的建筑及连接它们的空白太空格。通常力量需达到 7（异星学院为 6），用尽量少的卫星连接；不能与已有联邦接触。每颗卫星弃一枚能量，蜂人改花 1 QIC 并扩张同一联邦。相邻建筑自动纳入。',
    free: '自由行动可在自己的主行动前后进行。转换不会结束回合；燃烧需要 II 碗两枚能量，弃一枚、另一枚升至 III。选择数量可把一次能量消费的收益合并，适用于脑石或双倍能量。',
    pass: '按当前推进器和高级科技获得放弃分，然后选择市场中的另一张推进器。新推进器在下一轮生效。最先放弃者成为下轮起始玩家；第六轮不再领取新推进器。',
    power: '公共能量／QIC 行动每轮全桌只能使用一次。地形改造行动需通过星球的建矿选项同时完成；不可先拿改造步数以后再用。',
    next: '主行动结束后可继续自由行动，再 End Turn。轮末必须所有玩家确认 Next Round 后才发下一轮收入。',
    player: '资源和研究均为公开信息。收入预览反映当前建筑、推进器和未覆盖科技；最高信用点 30、矿石与知识 15。盖亚区与三碗分开记录。',
    decision: '先处理当前选择，再继续主回合。邻居被动充能按照自己的邻近建筑力量，花费实际充能减 1 VP；不能主动选择少充，只能接受或拒绝。',
    faction: '依座次选种族，同一母星颜色不能重复。常驻能力立即生效，学院能力须建成行星学院。选择后需要在母星上放置初始建筑。',
    booster: '推进器提供本轮收入；有些还有一次特殊行动或放弃计分。开局逆序选择，之后在放弃时更换。',
    income: '能量收入按每个收入图标作为一个整体领取。可以选择先充能或先新增能量，以免浪费充能。',
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const me = () => view?.players.find(p => p.player_id === view.you);
  const player = id => view?.players.find(p => p.player_id === id);
  const defs = () => view.definitions;
  const color = id => { const p = player(id); return p?.faction ? defs().planets[defs().factions[p.faction].home].color : '#98a9c7'; };
  const seat = id => view.players.findIndex(p => p.player_id === id) + 1;
  const gaiaTerraformingSteps = planet => {
    const faction = me()?.faction;
    const home = faction ? defs().factions[faction]?.home : null;
    const wheel = defs().wheel || [];
    if (!home || !wheel.includes(planet)) return null;
    const delta = Math.abs(wheel.indexOf(planet) - wheel.indexOf(home));
    return Math.min(delta, wheel.length - delta);
  };
  const hintAttributes = (key, label = '') => `data-gaia-hint-key="${key}" data-gaia-hint="${esc(hintDefinitions[key][1])}" data-gaia-hint-name="${esc(key === 'seat' && label ? label : hintDefinitions[key][0])}" aria-label="${esc(label || hintDefinitions[key][0])}" data-gaia-explain="${esc(hintDefinitions[key].join('：'))}"`;
  const hint = (key, html, label = '', extraClass = '') => `<span class="gaia-hint-target ${extraClass}" ${hintAttributes(key, label)}>${html}</span>`;
  const resources = data => Object.entries(data || {}).filter(([k, n]) => tokenSymbols[k] && typeof n === 'number' && n).map(([k, n]) => hint(k, token(k, n), `${resourceNames[k]} ${n}`, 'gaia-tk-wrap')).join(' ');
  const info = kind => `data-gaia-explain="${esc(explainText[kind] || kind)}"`;
  const button = (label, command, extra = '', explanation = '') => `<button type="button" data-gaia-command="${command}" ${extra} ${explanation ? info(explanation) : ''}>${label}</button>`;
  const activeOptions = () => view?.options || [];
  const gaiaImmediateActionTypes = new Set(['place_initial', 'end_turn', 'next_round', 'leech']);
  const gaiaNeedsConfirmation = option => option && !gaiaImmediateActionTypes.has(option.action.type);
  const specText = spec => {
    if (!spec) return '';
    const parts = [];
    if (spec.income) parts.push('收入 ' + resources(spec.income));
    if (spec.immediate) parts.push('立即 ' + resources(spec.immediate));
    if (spec.special) parts.push(typeof spec.special === 'string' ? (spec.special === 'range' ? '行动：航程 +3 建矿／盖亚' : '行动：免费改造一步并建矿') : '每轮行动 ' + resources(spec.special));
    if (spec.passing) parts.push(`放弃：每${metricNames[spec.passing[0]] || spec.passing[0]} +${resources({vp:spec.passing[1]})}`);
    if (spec.metric) parts.push(`立即：每${metricNames[spec.metric[0]] || spec.metric[0]} +${resources({[spec.metric[2]]:spec.metric[1]})}`);
    if (spec.event) parts.push(`每次${({mine: '建矿', gaia: '盖亚建矿', research: '科研', trading: '升级交易站'})[spec.event[0]]} +${resources({vp:spec.event[1]})}`);
    if (spec.effect) parts.push(esc(spec.effect));
    return parts.join(' · ');
  };
  // The compact text above is useful on cards, but Explain needs to answer
  // the player's actual question: what changes when this level or tile is
  // reached, and when does that change take effect?
  const researchLevelExplanations = {
    terraforming: [
      '你还没有推进地形改造。普通星球每一步改造需要 3 矿石。',
      '达到 1 级后，普通星球每一步仍需要 3 矿石。推进到这一级时会立即获得 2 矿石。',
      '达到 2 级后，普通星球每一步改造只需要 2 矿石。',
      '达到 3 级后，普通星球每一步改造只需要 1 矿石。推进到这一级时还会立即充能 3 次。',
      '达到 4 级后，普通星球每一步改造仍只需要 1 矿石。推进到这一级时会立即获得 2 矿石。',
      '达到 5 级后，普通星球每一步改造只需要 1 矿石。推进到这一级时会获得预留的地形改造联邦标记。',
    ],
    navigation: [
      '航程是 1。你可以把新矿场建在距离自己建筑不超过 1 的位置。',
      '航程仍是 1。推进到这一级时会立即获得 1 QIC。',
      '航程提升到 2。你可以把新矿场建到距离自己建筑 2 格的位置。',
      '航程仍是 2。推进到这一级时会立即获得 1 QIC。',
      '航程提升到 3。你可以把新矿场建到距离自己建筑 3 格的位置。',
      '航程提升到 4。推进到这一级时会立即获得失落星球的殖民机会。',
    ],
    ai: [
      '人工智能轨道还没有提供额外 QIC。',
      '推进到这一级时会立即获得 1 QIC。',
      '推进到这一级时会立即获得 1 QIC。',
      '推进到这一级时会立即获得 2 QIC。',
      '推进到这一级时会立即获得 2 QIC。',
      '推进到这一级时会立即获得 4 QIC。',
    ],
    gaia: [
      '盖亚计划还没有解锁。你需要先推进盖亚计划轨道。',
      '达到 1 级后，每次盖亚计划需要把 6 枚能量送入盖亚区。推进到这一级时会立即获得 1 个盖亚改造器。',
      '达到 2 级后，每次盖亚计划仍需要 6 枚能量。推进到这一级时会立即获得 3 枚能量。',
      '达到 3 级后，每次盖亚计划只需要 4 枚能量。推进到这一级时会再获得 1 个盖亚改造器。',
      '达到 4 级后，每次盖亚计划只需要 3 枚能量。推进到这一级时会再获得 1 个盖亚改造器。',
      '达到 5 级后，每次盖亚计划需要 3 枚能量。推进到这一级时会立即获得 4 VP，并按你已经殖民的盖亚星数量再获得同样多的 VP。',
    ],
    economy: [
      '经济轨道还没有提供额外收入。',
      '从下一次收入阶段开始，每轮获得 2 个信用点和 1 次充能。',
      '从下一次收入阶段开始，每轮获得 2 个信用点、1 个矿石和 2 次充能。',
      '从下一次收入阶段开始，每轮获得 3 个信用点、1 个矿石和 3 次充能。',
      '从下一次收入阶段开始，每轮获得 4 个信用点、2 个矿石和 4 次充能。',
      '推进到这一级时立即获得 6 个信用点、3 个矿石和 6 次充能。达到 5 级后不再领取经济轨道的每轮收入。',
    ],
    science: [
      '科学轨道还没有提供额外知识收入。',
      '从下一次收入阶段开始，每轮获得 1 点知识。',
      '从下一次收入阶段开始，每轮获得 2 点知识。',
      '从下一次收入阶段开始，每轮获得 3 点知识。',
      '从下一次收入阶段开始，每轮获得 4 点知识。',
      '推进到这一级时立即获得 9 点知识。达到 5 级后不再领取科学轨道的每轮收入。',
    ],
  };
  const researchLevelExplain = (track, level) => {
    const trackName = defs().tracks[track] || track;
    const text = researchLevelExplanations[track]?.[level] || '这个研究等级目前没有可用说明。';
    return `${trackName}轨道第 ${level} 级：${text}`;
  };
  const technologyExplanations = {
    power_action: '每轮一次特殊行动。执行后立即把 4 次充能加入你的能量碗。',
    ore_qic: '拿到这张科技时，立即获得 1 个矿石和 1 个 QIC。',
    diversity: '拿到这张科技时，数一数你已经殖民的星球种类。每种星球立即获得 1 点知识。',
    points: '拿到这张科技时，立即获得 7 VP。',
    ore_power: '从下一次收入阶段开始，每轮获得 1 个矿石和 1 次充能。',
    knowledge_credit: '从下一次收入阶段开始，每轮获得 1 点知识和 1 个信用点。',
    credits: '从下一次收入阶段开始，每轮获得 4 个信用点。',
    structure_power: '你所有力量为 3 的三级建筑，力量都提升为 4。这个力量会用于联邦和给邻居充能。',
    gaia_points: '每当你完成一次盖亚建矿，额外获得 3 VP。',
    qic_credits: '每轮一次特殊行动。执行后获得 1 个 QIC 和 5 个信用点。',
    ore_action: '每轮一次特殊行动。执行后获得 3 个矿石。',
    knowledge_action: '每轮一次特殊行动。执行后获得 3 点知识。',
    mine_points: '拿到这张高级科技时，你每拥有一座矿场就立即获得 2 VP。失落矿场也算一座矿场。',
    trading_points: '拿到这张高级科技时，你每拥有一座交易站就立即获得 4 VP。',
    federation_points: '拿到这张高级科技时，你每拥有一个联邦标记就立即获得 5 VP。',
    sector_points: '拿到这张高级科技时，你每殖民一个星区就立即获得 2 VP。',
    gaia_points_advanced: '拿到这张高级科技时，你每拥有一颗盖亚星就立即获得 2 VP。',
    sector_ore: '拿到这张高级科技时，你每殖民一个星区就立即获得 1 个矿石。',
    pass_federations: '放弃本轮时，按你当时拥有的联邦标记数量获得 VP。每个联邦标记带来 3 VP。',
    pass_labs: '放弃本轮时，按你当时拥有的研究所数量获得 VP。每个研究所带来 3 VP。',
    pass_types: '放弃本轮时，按你当时已经殖民的星球种类获得 VP。每种星球带来 1 VP。',
    research_vp: '每当你把任意研究轨道推进 1 级，立即获得 2 VP。',
    mine_vp: '每当你建造一座矿场，立即获得 3 VP。',
    trading_vp: '每当你把建筑升级为交易站，立即获得 3 VP。',
  };
  const technologyExplain = (id, advanced = false) => {
    const kind = advanced ? '高级科技' : '基础科技';
    return `${kind}「${defs()[advanced ? 'advanced' : 'techs'][id]?.name || id}」：${technologyExplanations[id] || '这张科技的具体效果目前没有可用说明。'}`;
  };
  const optionLabel = o => {
    const a = o.action;
    if (a.type === 'convert') return `${resources(o.cost)} → ${resources(o.gain)}`;
    if (a.type === 'income') return `${esc(o.label)} · ${resources(view.income_pending[a.index]?.gain)}`;
    if (a.type === 'power_action') return esc(mainLabels[a.action] || o.label) + (a.token_index !== undefined ? ` · ${resources(defs().federations[me().federations[a.token_index].token])}` : '');
    if (a.type === 'special') return esc(mainLabels[a.action] || o.label) + (a.track ? ` · ${esc(defs().tracks[a.track])}` : '');
    if (a.type === 'build') return `${building('mine', color(view.you), 'inline')} 建造矿场` + ({normal: '', booster_range: ' · 推进器航程 +3', booster_terraform: ' · 推进器改造 1', terraform_1: ' · 公共改造 1', terraform_2: ' · 公共改造 2'}[a.source] || '');
    if (a.type === 'upgrade') return `${building(a.building, color(view.you), 'inline')} ${esc(o.label)}`;
    if (a.type === 'terrans_convert') return `${resources({power: Number(o.label)})} → ${resources({[a.resource]: 1})}`;
    return inlineTokens(esc(o.label));
  };
  function optionButton(o, index, full = false) {
    const description = o.action.booster ? specText(defs().boosters[o.action.booster]) : o.action.tile ? specText(defs().techs[o.action.tile] || defs().advanced[o.action.tile]) : '';
    const cost = o.action.type === 'convert' ? '' : resources(o.cost);
    return `<button type="button" class="gaia-option${selectedOption === index ? ' selected' : ''}" data-gaia-option="${index}" ${info(o.category)}><strong>${optionLabel(o)}</strong>${cost ? `<small>${cost}</small>` : ''}${(full || description) && description ? `<small>${description}</small>` : ''}</button>`;
  }
  function boosterSpecialText(special) {
    if (special === 'range') return '特殊行动：航程 +3 建矿／盖亚';
    if (special === 'terraform') return '特殊行动：免费改造一步并建矿';
    return typeof special === 'string' ? esc(special) : '';
  }
  function boosterEffectRows(spec) {
    if (!spec) return '<span class="gaia-booster-effect-empty">本轮没有额外收入或特殊效果</span>';
    const rows = [];
    if (spec.income) rows.push(`<span class="gaia-booster-effect-row"><b>收入</b><span>${resources(spec.income)}</span></span>`);
    if (spec.immediate) rows.push(`<span class="gaia-booster-effect-row"><b>立即</b><span>${resources(spec.immediate)}</span></span>`);
    if (spec.special) rows.push(`<span class="gaia-booster-effect-row"><b>特殊行动</b><span>${boosterSpecialText(spec.special)}</span></span>`);
    if (spec.passing) rows.push(`<span class="gaia-booster-effect-row"><b>放弃奖励</b><span>每${metricNames[spec.passing[0]] || esc(spec.passing[0])} +${resources({vp: spec.passing[1]})}</span></span>`);
    return rows.join('') || '<span class="gaia-booster-effect-empty">本轮没有额外收入或特殊效果</span>';
  }
  function renderBoosterCard(o, index, selectedId, mode = 'initial') {
    const booster = defs().boosters[o.action.booster];
    const boosterId = o.action.booster || '__pass__';
    const selected = selectedId === boosterId;
    const passCard = mode === 'pass' && !booster;
    return `<button type="button" class="gaia-booster-card${selected ? ' selected' : ''}${passCard ? ' gaia-booster-card-pass' : ''}" data-gaia-booster="${esc(boosterId)}" aria-pressed="${selected}" ${info('booster')}>
      <span class="gaia-booster-card-heading"><strong>${esc(passCard ? '结束本轮' : (booster?.name || o.label))}</strong><small>${passCard ? '不换推进器' : '推进器'}</small></span>
      <span class="gaia-booster-card-effect">${passCard ? '<span>第六轮不再领取新推进器</span>' : boosterEffectRows(booster)}</span>
    </button>`;
  }
  function selectedBoosterOption(choices) {
    return choices.find(({o}) => o.action.booster === boosterSelected)?.o || null;
  }
  function renderBoosterSelection(option, mode = 'initial') {
    if (!option) return '';
    const booster = defs().boosters[option.action.booster];
    const pass = mode === 'pass';
    return `<div class="gaia-booster-selected" aria-live="polite"><div><small>SELECTED</small><strong>${esc(pass && !booster ? '结束本轮' : (booster?.name || option.label))}</strong></div><div class="gaia-booster-selected-effects">${pass && !booster ? '<span>本轮不再领取新推进器</span>' : boosterEffectRows(booster)}</div><div class="gaia-confirm-buttons"><button type="button" data-gaia-command="${pass ? 'confirm-pass' : 'confirm-booster'}">${pass ? 'Confirm pass' : 'Confirm'}</button><button type="button" data-gaia-command="cancel-booster">Cancel</button></div></div>`;
  }
  function renderBoosterPrompt(mode = 'initial') {
    const initial = mode === 'initial';
    if (!me() || view.current_turn !== view.you) return '';
    if (initial && view.phase !== 'booster') return '';
    if (!initial && (view.phase !== 'action' || !passDialogOpen)) return '';
    const type = initial ? 'choose_booster' : 'pass';
    const choices = activeOptions().map((o, index) => ({o, index})).filter(({o}) => o.action.type === type);
    if (!choices.length) return '';
    const docked = initial ? boosterDocked : passDocked;
    const selectedId = initial ? boosterSelected : passSelected;
    const selected = choices.find(({o}) => (o.action.booster || '__pass__') === selectedId)?.o || null;
    const dockClass = docked ? 'gaia-booster-layer-docked' : 'gaia-booster-layer-floating';
    const utility = `${button('Help', 'booster-help')}${button(explainMode ? 'Explaining…' : 'Explain', 'booster-explain', `aria-pressed="${explainMode}"`)}`;
    const selectedBooster = selected && defs().boosters[selected.action.booster];
    const dockedBody = selected ? `<div class="gaia-booster-docked-summary"><small>当前选择</small><strong>${esc(!selectedBooster && !initial ? '结束本轮' : (selectedBooster?.name || selected.label))}</strong><span>${!selectedBooster && !initial ? '本轮不再领取新推进器' : boosterEffectRows(selectedBooster)}</span></div>${renderBoosterSelection(selected, mode)}` : '<p class="gaia-booster-docked-empty">主板已解锁。查看完毕后点击 Resume 继续选择。</p>';
    const title = initial ? '选择首轮推进器' : '放弃本轮并选择推进器';
    const intro = initial ? '按座次逆序选择一张。推进器收入在本轮收入阶段生效，特殊行动和放弃奖励在对应时机使用。' : '先结算本轮放弃奖励，再选择市场中的一张推进器。新推进器从下一轮收入开始生效。';
    return `<div class="gaia-booster-layer ${dockClass} ${initial ? '' : 'gaia-pass-layer'}" data-gaia-booster-layer data-gaia-booster-mode="${mode}">
      ${docked ? '' : '<div class="gaia-booster-scrim" aria-hidden="true"></div>'}
      <section class="gaia-booster-dialog" role="dialog" ${docked ? '' : 'aria-modal="true"'} aria-labelledby="gaiaBoosterTitle">
        <header class="gaia-booster-header"><div><small>${initial ? 'ROUND 1' : 'PASS'}</small><h2 id="gaiaBoosterTitle">${title}</h2></div><div class="gaia-booster-header-actions">${utility}<button type="button" class="gaia-booster-dock-button" data-gaia-command="toggle-booster-dock" aria-label="${docked ? '重新打开推进器选择窗口' : '暂时收起并查看主板'}">${docked ? 'Resume' : 'View board'}</button></div></header>
        ${docked ? dockedBody : `<p class="gaia-booster-intro">${intro}</p><div class="gaia-booster-grid" tabindex="0">${choices.map(({o, index}) => renderBoosterCard(o, index, selectedId, mode)).join('')}</div>${renderBoosterSelection(selected, mode)}`}
      </section>
    </div>`;
  }
  function hideHint() {
    clearTimeout(hintTimer);
    clearTimeout(hintHideTimer);
    if (hintTarget) {
      const ids = (hintTarget.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== 'gaiaInlineHint');
      if (ids.length) hintTarget.setAttribute('aria-describedby', ids.join(' '));
      else hintTarget.removeAttribute('aria-describedby');
    }
    hintPopup?.remove();
    hintPopup = null; hintTarget = null; hintMode = null;
  }
  function canShowHint() {
    return view && !panel.classList.contains('hidden') && !explainMode && !modal && Date.now() >= suppressClickUntil;
  }
  function showHint(target, mode) {
    if (!canShowHint()) return;
    if (mode === 'tooltip' && hintTarget === target && hintMode === mode) {
      clearTimeout(hintHideTimer);
      return;
    }
    hideHint();
    hintTarget = target; hintMode = mode;
    hintPopup = document.createElement('div');
    hintPopup.id = 'gaiaInlineHint';
    hintPopup.className = `gaia-hint-popup gaia-hint-${mode}`;
    hintPopup.setAttribute('role', mode === 'banner' ? 'status' : 'tooltip');
    if (mode === 'banner') {
      hintPopup.setAttribute('aria-live', 'polite');
      hintPopup.setAttribute('aria-atomic', 'true');
    }
    const title = document.createElement('strong');
    const description = document.createElement('span');
    title.textContent = target.dataset.gaiaHintName;
    description.textContent = target.dataset.gaiaHint;
    hintPopup.append(title, description);
    document.body.appendChild(hintPopup);
    const ids = target.getAttribute('aria-describedby');
    target.setAttribute('aria-describedby', `${ids ? ids + ' ' : ''}gaiaInlineHint`);
    const anchor = target.getBoundingClientRect();
    if (mode === 'banner') {
      // Keep the tapped badge visible, including near the bottom of the screen.
      if (anchor.bottom > innerHeight - hintPopup.offsetHeight - 24) hintPopup.classList.add('gaia-hint-banner-top');
      hintTimer = setTimeout(hideHint, 3000);
    } else {
      const width = hintPopup.offsetWidth, height = hintPopup.offsetHeight;
      const left = Math.max(12, Math.min(anchor.left + (anchor.width - width) / 2, innerWidth - width - 12));
      const top = anchor.bottom + height + 20 <= innerHeight ? anchor.bottom + 8 : Math.max(12, anchor.top - height - 8);
      hintPopup.style.left = `${left}px`;
      hintPopup.style.top = `${top}px`;
      hintPopup.addEventListener('pointerenter', () => clearTimeout(hintHideTimer));
      hintPopup.addEventListener('pointerleave', scheduleHintHide);
    }
  }
  function scheduleHintHide() {
    clearTimeout(hintHideTimer);
    hintHideTimer = setTimeout(() => {
      if (hintMode === 'tooltip' && !hintPopup?.matches(':hover') && !hintTarget?.matches(':hover, :focus-visible')) hideHint();
    }, 120);
  }
  function prepareHints() {
    // Badges inside action buttons remain separate tap targets, not nested buttons.
    panel.querySelectorAll('[data-gaia-hint]').forEach(target => {
      if (!target.closest('button, [role="button"], a, label, summary')) {
        target.tabIndex = 0;
        target.setAttribute('role', 'button');
      }
    });
  }
  function renderPowerBowls(p) {
    const bowl = (key, name, count, label) => hint(key, `<span class="gaia-bowl-name">${name}</span>${token('power', count, 'bowl')}`, label, 'gaia-bowl-chip');
    return `<div class="gaia-power-bowls">${['I','II','III'].map((name, i) => bowl(['bowl_i','bowl_ii','bowl_iii'][i], name, p.power[i], `${name} 碗，${p.power[i]} 枚普通能量`)).join('')}${bowl('gaia_bowl', 'Gaia', p.gaia_power, `盖亚区，${p.gaia_power} 枚普通能量`)}${p.brain !== null ? hint('brain', `${token('brain', '', 'bowl')}<span class="gaia-bowl-name">${['I','II','III','Gaia'][p.brain]}</span>`, `脑石位于 ${['I 碗','II 碗','III 碗','盖亚区'][p.brain]}`, 'gaia-bowl-chip gaia-brain-chip') : ''}${hint('gaiaformers', token('gaiaformers', p.gaiaformers, 'bowl'), `可用盖亚改造器 ${p.gaiaformers}`, 'gaia-bowl-chip')}</div>`;
  }
  function setExplain(on) {
    if (on) hideHint();
    explainMode = on;
    panel?.classList.toggle('gaia-explaining', on);
    explainButton?.setAttribute('aria-pressed', String(on));
  }
  function closeModal() {
    modal?.remove(); modal = null;
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  function openModal(title, html) {
    hideHint();
    closeModal();
    previousFocus = document.activeElement;
    modal = document.createElement('div');
    modal.className = 'gaia-modal';
    modal.innerHTML = `<section class="gaia-dialog" role="dialog" aria-modal="true" aria-labelledby="gaiaDialogTitle"><header><h2 id="gaiaDialogTitle">${esc(title)}</h2><button type="button" data-gaia-close>Close</button></header><div class="gaia-dialog-body">${html}</div></section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-gaia-close]')) closeModal(); });
    modal.querySelector('button').focus();
  }
  function showHelp() {
    setExplain(false);
    const factions = view ? Object.values(defs().factions).map(f => `<details><summary>${esc(f.name)}</summary><p>${esc(f.ability)}</p><p>行星学院：${esc(f.institute)}</p></details>`).join('') : '';
    const legend = ['credits', 'ore', 'knowledge', 'qic', 'power', 'charge', 'tokens', 'vp', 'gaiaformers', 'brain', 'green_federation', 'gray_federation'].map(key => `<span class="gaia-legend-item">${token(key, ['credits', 'ore', 'knowledge', 'qic', 'power', 'charge', 'tokens', 'vp', 'gaiaformers'].includes(key) ? 1 : '')} ${esc(hintDefinitions[key][0])}</span>`).join('');
    const structures = ['mine', 'trading_station', 'lab', 'institute', 'academy_knowledge', 'station'].map(kind => `<span class="gaia-legend-item">${building(kind, '#9ecbff')} ${esc(defs().buildings[kind].name)}</span>`).join('');
    openModal('Gaia Project · Help', `
      <p>2–4 人 · 基础版 · 六轮竞争。通过殖民、研究、科技、联邦和每轮目标获得最多 VP${token('vp')}；并列共同获胜。</p>
      <h3>标记图例</h3><div class="gaia-legend-grid">${legend}</div><div class="gaia-legend-grid">${structures}</div>
      <h3>开局与六轮</h3><p>选种族 → 蛇形放置两座矿场 → 逆序选推进器。异星人额外放第三矿，蜂人最后放一座学院。每轮依次领取收入、完成上轮盖亚计划、轮流行动，直到所有人放弃。轮末全员点击 <b>Next Round</b> 后才继续。</p>
      <h3>每回合一个主行动</h3><p>点击地图上的星球建矿、升级或启动盖亚计划；切换 Research 科研，或使用公共／特殊行动。主行动后仍能转换资源，然后 <b>End Turn</b>（直接执行）。需要确认的选择会显示 <b>Confirm</b>；起始放置和 <b>Next Round</b> 也会直接执行；点击空白或 Esc 取消当前选择。</p>
      <p>矿场：1 矿石${token('ore')} + 2 信用点${token('credits')}，另付改造与航程费用。普通星球按母星轮计算改造步数；每步初始 3 矿石，研究后降至 2／1。每花 1 QIC${token('qic')}，单次航程增加 2。绿星另付 1 QIC；自己改造器处免适居费且自动可达。</p>
      <p>矿场→交易站：2 矿石 + 6 信用点，有对手建筑两格内则只需 3 信用点。交易站→研究所：3 矿石 + 5 信用点；交易站→学院：4 矿石 + 6 信用点；研究所→大学：6 矿石 + 6 信用点。研究所／大学获得一块科技。</p>
      <h3>盖亚与能量</h3><p>超维星必须先派改造器${token('gaiaformers')}；从能量碗转移 6／4／3 枚能量${token('power')}到盖亚区，下轮收入之后完成改造。能量归还，改造器保留在星球上，直到建矿才收回。第六轮启动的计划不会完成。</p><p>${explainText.free}</p><p>邻居两格内建造／升级时，可按自己最高建筑力量充能${token('charge')}，花费充能数减 1 VP。必须全充或拒绝，仅在能量容量／VP 不足时减量。已经放弃也可接受充能。</p>
      <h3>研究、科技、联邦</h3><p>${explainText.research}</p><p>${explainText.technology}</p><p>${explainText.federation}</p>
      <h3>放弃与终局</h3><p>${explainText.pass}</p><p>六轮结束后，两个终局目标各按 18／12／6／0 VP 排名，并列均分所占名次；两人局加入印刷目标上的中立值。每条研究轨道从第三级起，每级 4 VP；剩余信用点、矿石、知识合计每 3 个换 1 VP。</p>
      <h3>本实现</h3><p>使用基础版标准七／十扇区地图与自由选族、普通起始放置；默认固定座次、首个放弃者下轮先手。支持 14 种族、全部基础科技／高级科技池与六轮结算。机器人为普通玩家规则下的练习对手；不包含单人 Automa、扩展和种族竞价。</p>
      <p><a href="https://www.feuerland-spiele.de/fileadmin/game/Gaia_Project/GAIA_PROJECT_EN_rules_Web.pdf" target="_blank" rel="noopener">Official rulebook</a></p><h3>种族能力</h3>${factions}`);
  }
  function renderMap() {
    const board = Object.values(view.board);
    const positions = board.map(h => ({h, x: h.q * 36, y: (h.r + h.q / 2) * 41.57}));
    const minX = Math.min(...positions.map(p => p.x)) - 27;
    const minY = Math.min(...positions.map(p => p.y)) - 27;
    const width = Math.max(...positions.map(p => p.x)) - minX + 27;
    const height = Math.max(...positions.map(p => p.y)) - minY + 27;
    const [cx, cy] = mapCenter || [minX + width / 2, minY + height / 2];
    const w = width / mapZoom, h = height / mapZoom;
    const legalHexes = new Set(activeOptions().map(o => o.action.hex).filter(Boolean));
    const shape = Array.from({length: 6}, (_, i) => `${(23 * Math.cos(i * Math.PI / 3)).toFixed(1)},${(23 * Math.sin(i * Math.PI / 3)).toFixed(1)}`).join(' ');
    const hexes = positions.map(({h: hex, x, y}) => {
      const planet = defs().planets[hex.planet];
      const chosen = selectedHex === hex.id || federationHexes.has(hex.id);
      const active = federationMode || legalHexes.has(hex.id);
      const occupants = Object.entries(hex.buildings);
      const sat = hex.satellites.map((id, i) => `<circle cx="${-9 + i * 6}" cy="13" r="2.5" fill="${color(id)}"/>`).join('');
      const structures = occupants.map(([id, building], i) => `<g transform="translate(${(i - (occupants.length - 1) / 2) * 15},0)"><use href="#gbd-${building}" x="-9" y="-11" width="18" height="18" style="color:${color(id)}"/><text y="17" class="gaia-seat" fill="${color(id)}">${seat(id)}</text></g>`).join('');
      const terraforming = gaiaTerraformingSteps(hex.planet);
      const terraformingBadge = terraforming === null ? '' : `<g class="gaia-terraform-badge" aria-hidden="true"><rect x="-21" y="-21" width="13" height="10" rx="3"/><text x="-14.5" y="-13.5">T${terraforming}</text></g>`;
      const federation = Object.keys(hex.federations).map((id, i) => `<circle r="${20 + i}" fill="none" stroke="${color(id)}" stroke-width="1.5" stroke-dasharray="2 2"/>`).join('');
      const title = `${hex.id} · ${planet?.name || '太空'}${terraforming === null ? '' : ` · 改造强度 T${terraforming}`}`;
      return `<g class="gaia-hex ${active ? 'available' : ''} ${chosen ? 'selected' : ''}" transform="translate(${x},${y})" role="button" tabindex="0" data-gaia-hex="${hex.id}" aria-label="${esc(title)}" ${info('map')}><title>${esc(title)}</title><polygon points="${shape}"/>${planet ? `<circle class="gaia-planet" r="15" fill="${planet.color}"/><ellipse cx="-4" cy="-5" rx="7" ry="4" fill="white" opacity=".17"/>` : '<circle r="1" fill="#59718d"/>'}${terraformingBadge}${structures}${sat}${hex.gaiaformer ? `<use href="#gtk-gaiaformers" x="-9" y="-9" width="18" height="18"/><circle r="10" fill="none" stroke="${color(hex.gaiaformer)}" stroke-width="1.5"/>` : ''}${federation}</g>`;
    }).join('');
    const sectors = [...new Set(board.map(h => h.sector))].map(sector => {
      const center = positions.find(p => p.h.id === `${sector}-9`);
      return `<text x="${center.x}" y="${center.y + 4}" class="gaia-sector">${esc(sector.replace('outlined', ''))}</text>`;
    }).join('');
    const mapModeLink = federationMode ? button('Actions', 'tab', 'data-gaia-tab="actions"') : '';
    return `<div class="gaia-map-tools">${button('−', 'zoom-out', 'aria-label="Zoom out"')}${button('Fit', 'fit')}${button('+', 'zoom-in', 'aria-label="Zoom in"')}${button(`Legend ${legendOpen ? '▾' : '▸'}`, 'toggle-legend', `aria-expanded="${legendOpen}" aria-controls="gaiaMapLegend"`)}${mapModeLink}<span>${federationMode ? '选择建筑与卫星连接格 · 完成后打开 Actions' : '点击星球查看主行动 · 拖动平移'}</span></div><div class="gaia-map-wrap"><svg id="gaiaGalaxy" viewBox="${cx - w / 2} ${cy - h / 2} ${w} ${h}" aria-label="Gaia Project galaxy" role="group">${hexes}${sectors}</svg></div><div class="gaia-terraform-note"><strong>改造强度</strong><span>T0–T3 表示按你的母星建矿前需要的改造步数；盖亚星使用盖亚计划。</span></div><div id="gaiaMapLegend"${legendOpen ? '' : ' hidden'}><div class="gaia-legend">${Object.entries(defs().planets).filter(([id]) => id !== 'lost').map(([, p]) => `<span><i style="background:${p.color}"></i>${esc(p.name)}</span>`).join('')}</div><div class="gaia-legend">${['mine', 'trading_station', 'lab', 'institute', 'academy_knowledge', 'station'].map(kind => hint('structure', `${building(kind, '#9ecbff', 'legend')}${esc(defs().buildings[kind].name)}`, defs().buildings[kind].name, 'gaia-legend-structure')).join('')}</div></div>`;
  }
  function renderResearch() {
    const descriptions = {
      terraforming: ['改造步成本 3 矿石', '+2 矿石；步成本 3', '步成本 2 矿石', '步成本 1 矿石', '+2 矿石', '获得预留联邦'],
      navigation: ['航程 1', '+1 QIC；航程 1', '航程 2', '+1 QIC；航程 2', '航程 3', '航程 4；失落星球'],
      ai: ['—', '+1 QIC', '+1 QIC', '+2 QIC', '+2 QIC', '+4 QIC'],
      gaia: ['不可改造', '1 改造器；6 能量', '+3 能量枚数', '2 改造器；4 能量', '3 改造器；3 能量', '+4 VP + 盖亚星数'],
      economy: ['—', '收入 2 信用点 1 充能', '收入 2 信用点 1 矿石 2 充能', '收入 3 信用点 1 矿石 3 充能', '收入 4 信用点 2 矿石 4 充能', '立即 6 信用点 3 矿石 6 充能'],
      science: ['—', '收入 1 知识', '收入 2 知识', '收入 3 知识', '收入 4 知识', '立即 9 知识'],
    };
    const describeLevel = (id, level) => descriptions[id][level].replace(/\+?(\d+) (信用点|矿石|充能|知识|QIC|VP|能量枚数|能量|改造器)/gu, (label, number, symbol) => {
      const key = {'信用点':'credits', '矿石':'ore', '充能':'charge', '知识':'knowledge', 'QIC':'qic', 'VP':'vp', '能量枚数':'tokens', '能量':'power', '改造器':'gaiaformers'}[symbol];
      return hint(key, `${label.startsWith('+') ? '+' : ''}${token(key, number, 'small')}`, `${resourceNames[key]} ${number}`, 'gaia-tk-wrap');
    });
    return `<div class="gaia-research">${Object.entries(defs().tracks).map(([id, name]) => `<section class="gaia-track"><h3>${esc(name)}</h3>${[5,4,3,2,1,0].map(level => {
      const option = activeOptions().findIndex(o => ['research','choose_track'].includes(o.action.type) && o.action.track === id && me()?.research[id] + 1 === level);
      const markers = view.players.filter(p => p.research[id] === level).map(p => `<b class="gaia-hint-target" style="background:${color(p.player_id)}" ${hintAttributes('seat', `${p.name}，第 ${seat(p.player_id)} 位玩家，${name} ${level} 级`)}>${seat(p.player_id)}</b>`).join('');
      return `<button type="button" class="gaia-level ${level === 5 ? 'gaia-top-level' : ''}" ${option >= 0 ? `data-gaia-option="${option}"` : 'disabled'} ${info(researchLevelExplain(id, level))}><strong>${level}${level === 5 ? ' ' + hint('green_federation', token('green_federation', '', 'small'), '', 'gaia-tk-wrap') : ''}</strong><span>${describeLevel(id, level)}</span><div class="gaia-markers">${markers}</div></button>`;
    }).join('')}</section>`).join('')}</div><p class="gaia-muted">2 → 3：额外充能 3 ${token('charge', 3, 'small')}。第 5 级：翻绿色联邦标记 ${token('green_federation', '', 'small')}，每轨仅一人。</p>`;
  }
  function renderTechnology() {
    return `<h3>基础科技</h3><div class="gaia-tech-grid">${view.tech_market.map((id, i) => {
      const option = activeOptions().findIndex(o => o.action.type === 'choose_tech' && o.action.tile === id);
      return `<button type="button" class="gaia-tech" ${option >= 0 ? `data-gaia-option="${option}"` : 'disabled'} ${info(technologyExplain(id))}><small>${i < 6 ? esc(Object.values(defs().tracks)[i]) : '任意研究'} · ${view.tech_stock[id]} left</small><strong>${esc(defs().techs[id].name)}</strong><span>${specText(defs().techs[id])}</span></button>`;
    }).join('')}</div><h3>高级科技</h3><div class="gaia-tech-grid">${Object.entries(view.advanced_market).map(([track, id]) => {
      const explanation = id ? technologyExplain(id, true) : `${defs().tracks[track]}轨道的高级科技已经被其他玩家拿走，目前不能选择。`;
      return `<div class="gaia-tech advanced" ${info(explanation)}><small>${esc(defs().tracks[track])} 4+ · 绿色联邦</small><strong>${id ? esc(defs().advanced[id].name) : 'Taken'}</strong><span>${id ? specText(defs().advanced[id]) : '—'}</span></div>`;
    }).join('')}</div><p class="gaia-muted">获取高级科技时，在右侧选择要覆盖的基础科技。</p>`;
  }
  const gaiaPlayerBuildingGroups = [
    {level: 'I', title: '一级建筑', kinds: ['mine', 'lost_mine']},
    {level: 'II', title: '二级建筑', kinds: ['trading_station', 'lab']},
    {level: 'III', title: '三级建筑', kinds: ['institute', 'academy_knowledge', 'academy_qic']},
    {level: 'SAT', title: '空间站', kinds: ['station']},
  ];
  const gaiaBuildingAbility = (p, kind) => {
    const supplied = p.building_abilities?.[kind]?.description;
    if (supplied) return esc(supplied);
    if (kind === 'institute') {
      return p.faction && defs().factions[p.faction]?.institute
        ? esc(defs().factions[p.faction].institute)
        : '选择种族后显示行星学院能力';
    }
    if (kind === 'academy_knowledge') {
      return `每轮收入 ${resources({knowledge: p.faction === 'itars' ? 3 : 2})}`;
    }
    if (kind === 'academy_qic') {
      return p.faction === 'bal_taks'
        ? `每轮一次特殊行动：获得 ${resources({credits: 4})}`
        : `每轮一次特殊行动：获得 ${resources({qic: 1})}`;
    }
    return '';
  };
  const gaiaIncomeTotal = sources => (sources || []).reduce((total, source) => {
    Object.entries(source.gain || {}).forEach(([key, amount]) => {
      if (typeof amount === 'number') total[key] = (total[key] || 0) + amount;
    });
    return total;
  }, {});
  function renderGaiaPlayerBoard(p) {
    const counts = p.counts || {};
    const supply = p.building_supply || {};
    const playerColor = color(p.player_id);
    return `<section class="gaia-player-board" aria-label="个人建筑版图">
      <div class="gaia-player-section-heading"><strong>个人版图 · 建筑</strong><span>已建 / 上限</span></div>
      <div class="gaia-building-groups">${gaiaPlayerBuildingGroups.map(group => `<section class="gaia-building-group gaia-building-group-${group.level.toLowerCase()}" aria-label="${esc(group.title)}">
        <h4><span>${group.level}</span>${esc(group.title)}</h4>
        <div class="gaia-building-list">${group.kinds.map(kind => {
          const definition = defs().buildings[kind];
          const summary = supply[kind] || {};
          const built = Number(summary.built ?? counts[kind] ?? 0);
          const limit = Number(summary.limit ?? definition?.limit ?? 0);
          const ability = group.level === 'III' ? gaiaBuildingAbility(p, kind) : '';
          return `<div class="gaia-building-row ${group.level === 'III' ? 'gaia-building-row-third' : ''} ${built ? 'built' : 'unbuilt'}">
            <div class="gaia-building-name">${building(kind, playerColor, 'inline')}<span>${esc(definition?.name || kind)}</span></div>
            <strong class="gaia-building-count">${built} / ${limit}</strong>
            ${ability ? `<div class="gaia-building-ability">${ability}</div>` : ''}
          </div>`;
        }).join('')}</div>
      </section>`).join('')}</div>
    </section>`;
  }
  function renderGaiaIncome(p) {
    const sources = p.income || [];
    const total = p.income_total || gaiaIncomeTotal(sources);
    return `<section class="gaia-income-panel" aria-label="本轮收入预览">
      <div class="gaia-income-total"><strong>本轮可获得</strong><div class="gaia-resources gaia-income-total-value">${resources(total) || '<span class="gaia-muted">—</span>'}</div></div>
      <details class="gaia-income-sources"><summary>收入来源 <span>${sources.length}</span></summary><div class="gaia-income-source-list">${sources.map(source => `<div class="gaia-income-source"><span>${esc(source.source)}</span><span class="gaia-resources">${resources(source.gain) || '<span class="gaia-muted">—</span>'}</span></div>`).join('')}</div></details>
    </section>`;
  }
  function renderGaiaFederations(p) {
    const federations = (p.federations || []).map(f => {
      const tokenKey = f.green ? 'green_federation' : 'gray_federation';
      const reward = resources(defs().federations[f.token]);
      return `<span class="gaia-federation-item">${hint(tokenKey, token(tokenKey), '', 'gaia-tk-wrap')}${reward || '<span class="gaia-muted">—</span>'}</span>`;
    }).join('');
    return `<div class="gaia-status-item gaia-status-federations"><strong>联邦</strong><div class="gaia-federation-list">${federations || '<span class="gaia-muted">—</span>'}</div></div>`;
  }
  function renderGaiaBooster(p) {
    const booster = p.booster && defs().boosters[p.booster];
    return `<div class="gaia-status-item gaia-status-booster"><strong>推进器</strong><span>${booster ? `${esc(booster.name)} · ${specText(booster)}` : '—'}</span></div>`;
  }
  function renderGaiaTech(p) {
    const techs = [
      ...(p.techs || []).map(t => ({id: t, advanced: false, definition: defs().techs[t], covered: (p.covered || []).includes(t)})),
      ...(p.advanced || []).map(t => ({id: t, advanced: true, definition: defs().advanced[t], covered: false})),
    ].filter(item => item.definition);
    return `<div class="gaia-status-item gaia-status-tech"><strong>科技</strong><div class="gaia-owned-tech">${techs.length ? techs.map(({id, advanced, definition, covered}) => `<span class="${covered ? 'covered' : ''}" ${info(technologyExplain(id, advanced))}>${esc(definition.name)} · ${specText(definition)}</span>`).join('') : '<span class="gaia-muted">—</span>'}</div></div>`;
  }
  function renderGaiaGoals() {
    const goals = view.final_tiles.map(id => hint('objective', `🏁 ${esc(defs().finals[id].name)}${view.players.length === 2 ? ` · 中立 ${defs().finals[id].neutral}` : ''}`)).join('');
    return `<div class="gaia-status-item gaia-status-goals"><strong>本局终局目标</strong><div>${goals || '<span class="gaia-muted">—</span>'}</div></div>`;
  }
  function renderGaiaDashboard(p) {
    return `<section class="gaia-dashboard" ${info('player')} aria-label="我的盖亚计划状态">
      <div class="gaia-dashboard-heading"><strong style="color:${color(view.you)}">${p.faction ? esc(defs().factions[p.faction].name) : esc(p.name)}</strong><span class="gaia-dashboard-vp">${hint('vp', token('vp', p.vp), `胜利点 ${p.vp}`, 'gaia-tk-wrap')} <small>VP</small></span></div>
      <div class="gaia-dashboard-resource-block"><strong>当前资源</strong><div class="gaia-resources gaia-dashboard-resources">${resources({credits:p.credits,ore:p.ore,knowledge:p.knowledge,qic:p.qic})}</div></div>
      <div class="gaia-dashboard-power-block"><strong>能量与改造器</strong>${renderPowerBowls(p)}</div>
      <div class="gaia-dashboard-status">${renderGaiaBooster(p)}${renderGaiaFederations(p)}${renderGaiaTech(p)}${renderGaiaGoals()}</div>
      ${renderGaiaIncome(p)}
    </section>`;
  }
  function renderPlayers() {
    return `<div class="gaia-player-grid">${view.players.map(p => {
      const self = p.player_id === view.you;
      const publicInfo = self ? '' : `<div class="gaia-player-public-status"><div class="gaia-current-resources"><span>当前资源</span><div class="gaia-resources">${resources({credits: p.credits, ore: p.ore, knowledge: p.knowledge, qic: p.qic}) || '—'}</div></div>${renderPowerBowls(p)}${renderGaiaBooster(p)}${renderGaiaFederations(p)}${renderGaiaTech(p)}</div>`;
      return `<article class="gaia-player-card ${self ? 'gaia-player-card-self' : ''}" data-gaia-player-id="${esc(p.player_id)}" style="--player-color:${color(p.player_id)}"><h3>${seat(p.player_id)} · ${esc(p.name)} ${self ? '(You)' : hint('vp', token('vp', p.vp), `胜利点 ${p.vp}`, 'gaia-tk-wrap')}</h3>${self ? '' : `<p class="gaia-player-faction">${p.faction ? esc(defs().factions[p.faction].name) : 'Choosing faction…'}</p>`}${publicInfo}${renderGaiaPlayerBoard(p)}</article>`;
    }).join('')}</div>`;
  }
  function renderResults() {
    if (!view.scores) return '';
    const players = [...view.players].sort((a,b) => b.vp - a.vp);
    return `<div class="gaia-results"><h3>🏆 ${view.winner.map(id => esc(player(id)?.name)).join(' · ')}</h3>${players.map(p => {
      const score = view.scores[p.player_id];
      return `<div class="gaia-result-row"><strong>${esc(p.name)} <b>${hint('vp', token('vp', score.total), `最终胜利点 ${score.total}`, 'gaia-tk-wrap')}</b></strong><span>局中 ${score.in_game} · 研究 ${score.research} · 资源 ${score.resources}</span><span>${Object.entries(score.objectives).map(([key,s]) => `${esc(defs().finals[key].name)} ${s.count} → ${s.vp} VP`).join(' / ')}</span></div>`;
    }).join('')}</div>`;
  }
  function renderFederation() {
    const picked = [...federationHexes];
    const selectedStructures = picked.filter(id => view.board[id].buildings[view.you]);
    const satellites = picked.filter(id => !view.board[id].buildings[view.you] && !view.board[id].federations.hasOwnProperty(view.you));
    const supply = Object.entries(view.federation_supply).filter(([, n]) => n > 0);
    return `<h3>🛰️ 联邦连接</h3><p class="gaia-muted">${selectedStructures.length} 个建筑 · ${satellites.length} 个卫星。相邻建筑和蜂人已有联邦会自动纳入；提交时检查最少卫星。</p><fieldset class="gaia-token-choice"><legend>Federation token</legend>${supply.map(([id, n], i) => `<label class="gaia-token-option"><input type="radio" name="gaiaFederationToken" value="${id}" ${i === 0 ? 'checked' : ''}><span>${token(id === 'points' ? 'gray_federation' : 'green_federation', '', 'small')}${resources(defs().federations[id])}<small>×${n}</small></span></label>`).join('')}</fieldset>${renderTokenPayment(satellites.length)}<div class="gaia-confirm-buttons">${button('Form Federation', 'form-federation', !picked.length ? 'disabled' : '', 'federation')}${button('Cancel', 'cancel')}</div>`;
  }
  function renderTokenPayment(required) {
    const p = me();
    if (!p || p.faction === 'ivits') return '';
    let remaining = required;
    const values = p.power.map(n => { const chosen = Math.min(n, remaining); remaining -= chosen; return chosen; });
    const brain = p.brain !== null && p.brain < 3;
    return `<fieldset class="gaia-token-payment"><legend>${token('power', '', 'small')} Power tokens · ${required} required</legend><div>${values.map((n,i) => `<label>${['I','II','III'][i]} <input type="number" min="0" max="${p.power[i]}" value="${n}" data-gaia-payment="${i}" aria-label="Pay tokens from bowl ${i+1}"></label>`).join('')}${brain ? `<label><input type="checkbox" id="gaiaPayBrain" ${remaining ? 'checked' : ''}> ${token('brain', '', 'small')} Brainstone</label>` : ''}</div></fieldset>`;
  }
  function renderSelection() {
    if (selectedOption === null) return '';
    const o = activeOptions()[selectedOption];
    if (!o) { selectedOption = null; return ''; }
    const tokenCost = o.action.type === 'gaiaform' ? o.cost.tokens : 0;
    return `<div class="gaia-confirm"><small>CONFIRM ACTION</small><h3>${optionLabel(o)}</h3><div class="gaia-resources">${resources(o.cost)}</div>${o.max_count > 1 ? `<label class="gaia-field">Quantity <input id="gaiaActionCount" type="number" min="1" max="${o.max_count}" value="1"></label>` : ''}${tokenCost ? renderTokenPayment(tokenCost) : ''}<div class="gaia-confirm-buttons">${button('Confirm', 'confirm', '', o.category)}${button('Cancel', 'cancel')}</div></div>`;
  }
  function renderActionsTab() {
    const p = me();
    const options = activeOptions();
    const pending = view.pending[0];
    if (!p) return '<h3>Spectating</h3><p class="gaia-muted">观察星图、研究与公开玩家信息。</p>';
    const isActing = view.current_turn === view.you || view.phase === 'round_end';
    if (view.phase === 'booster' && view.current_turn === view.you) return '';
    let html = '<section class="gaia-actions-page"><header class="gaia-actions-heading"><div><small>ACTIONS</small><h3>辅助行动</h3></div><button type="button" data-gaia-command="tab" data-gaia-tab="galaxy">查看 Galaxy</button></header>';
    if (federationMode) return html + renderFederation() + '</section>';
    if (view.phase === 'round_end') {
      html += `<h3>第 ${view.round} 轮结束</h3>${view.players.map(p => `<p>${esc(p.name)} <strong>${view.round_summary[p.player_id]?.delta >= 0 ? '+' : ''}${view.round_summary[p.player_id]?.delta} ${token('vp', '', 'small')}</strong> ${view.ready.includes(p.player_id) ? '✓' : ''}</p>`).join('')}<p>${view.ready.length} / ${view.players.length} ready</p>`;
    } else if (view.game_over) {
      return `${html}<h3>Game complete</h3><p>最终分项见星图上方。房主可通过房间 Start Game 开始新局。</p></section>`;
    } else if (!isActing) {
      html += `<h3>Waiting for ${esc(player(view.current_turn)?.name || 'players')}</h3><p class="gaia-muted">${phaseNames[view.phase] || ''}</p>`;
    } else if (pending) {
      html += `<h3>${({leech:`${token('charge', '', 'small')} 邻居充能`,tech:'🔬 选择科技',track:'🧠 选择研究',lost:'🌌 放置失落星球'})[pending.kind]}</h3>`;
    } else {
      html += `<h3>${view.main_done && view.phase === 'action' ? '主行动完成' : phaseNames[view.phase]}</h3>`;
    }
    if (selectedHex) {
      const hex = view.board[selectedHex];
      const terraforming = gaiaTerraformingSteps(hex.planet);
      const terraformingText = terraforming === null ? '' : `<span class="gaia-terraform-value">改造强度 T${terraforming}</span>`;
      html += `<div class="gaia-planet-info"><strong>${defs().planets[hex.planet]?.emoji || '✨'} ${esc(defs().planets[hex.planet]?.name || '太空')} · ${esc(hex.id)} ${terraformingText}</strong><p>${Object.entries(hex.buildings).map(([id, kind]) => `${esc(player(id)?.name)} · ${esc(defs().buildings[kind].name)}`).join('<br>') || (hex.gaiaformer ? '🌱 ' + esc(player(hex.gaiaformer)?.name) + ' 的改造器' : '尚未殖民')}</p></div>`;
    }
    html += renderSelection();
    const passOptions = options.filter(o => o.category === 'pass');
    if (isActing && view.phase === 'action' && !pending && passOptions.length) {
      html += `<div class="gaia-pass-action">${button(view.round < 6 ? 'Pass & choose booster' : 'Pass', 'open-pass-booster', 'class="gaia-pass-button"', 'pass')}</div>`;
    }
    const categories = ['decision','income','faction','booster','technology','next','special','power','free'];
    for (const category of categories) {
      const group = options.map((o,i) => [o,i]).filter(([o]) => {
        if (o.category !== category) return false;
        if (o.category === 'map') return false;
        return true;
      });
      if (!group.length) continue;
      const items = group.map(([o,i]) => optionButton(o,i)).join('');
      if (['free','pass','power'].includes(category)) {
        const titles = {free:'Free Actions', pass:'Pass & choose booster', power:'Power / QIC'};
        html += `<details class="gaia-action-group" ${category === 'free' && view.main_done ? 'open' : ''}><summary>${titles[category]} <span>${group.length}</span></summary><div class="gaia-options">${items}</div></details>`;
      } else html += `<div class="gaia-options ${category === 'faction' ? 'gaia-faction-options' : ''}">${items}</div>`;
    }
    if (view.can_federate) html += button('🛰️ Form Federation', 'federation', 'class="gaia-federation-button"', 'federation');
    if (view.phase === 'faction' && selectedOption !== null) {
      const selected = defs().factions[options[selectedOption]?.action.faction];
      if (selected) html += `<p>${esc(selected.ability)}</p><p>学院：${esc(selected.institute)}</p>`;
    }
    return html + '</section>';
  }
  function mapPlanetSummary(id) {
    const hex = view.board[id];
    if (!hex) return '';
    const planet = defs().planets[hex.planet];
    const terraforming = gaiaTerraformingSteps(hex.planet);
    const terraformingText = terraforming === null ? '' : ` · 改造强度 T${terraforming}`;
    const buildings = Object.entries(hex.buildings).map(([pid, kind]) => `${esc(player(pid)?.name || pid)} · ${esc(defs().buildings[kind]?.name || kind)}`).join('<br>');
    return `<div class="gaia-map-dialog-context"><strong>${planet?.emoji || '✨'} ${esc(planet?.name || '太空')} · ${esc(id)}${terraformingText}</strong><p>${buildings || (hex.gaiaformer ? `🌱 ${esc(player(hex.gaiaformer)?.name || '')} 的改造器` : '尚未殖民')}</p></div>`;
  }
  function openMapActionDialog(id) {
    const choices = activeOptions().map((o, index) => ({o, index})).filter(({o}) => o.category === 'map' && o.action.hex === id);
    const body = `${mapPlanetSummary(id)}${choices.length ? `<p class="gaia-muted">选择这颗星球上的主行动：</p><div class="gaia-map-dialog-options">${choices.map(({o, index}) => optionButton(o, index, true)).join('')}</div>` : '<p class="gaia-muted">当前局面没有可执行的主行动。你可以查看星球信息，或在 Actions 页签处理辅助行动。</p>'}`;
    openModal('主行动', body);
    if (!modal) return;
    modal.classList.add('gaia-map-action-dialog');
    modal.addEventListener('click', event => {
      const optionEl = event.target.closest('[data-gaia-option]');
      if (!optionEl) return;
      const option = activeOptions()[Number(optionEl.dataset.gaiaOption)];
      if (!option) return;
      closeModal();
      if (!gaiaNeedsConfirmation(option)) {
        if (option.action.type === 'place_initial') activeTab = 'galaxy';
        dispatch({...option.action});
        return;
      }
      activeTab = 'actions';
      selectedOption = Number(optionEl.dataset.gaiaOption);
      render();
      panel.querySelector('.gaia-confirm')?.scrollIntoView({block:'nearest', behavior:'smooth'});
    });
  }
  function renderGaiaHint() {
    if (!view) return '<p>当前还没有可以提示的 Gaia Project 局面。</p>';
    const p = me();
    if (!p) return '<p>你正在旁观这局游戏。可以查看 Galaxy、Research、Technology 和 Players。</p>';
    if (view.game_over) return '<p>本局已经结束。请查看上方的最终分数和两个终局目标。</p>';
    if (view.phase === 'round_end') {
      return `<p>第 ${view.round} 轮已经结束。等待所有玩家点击 <b>Next Round</b>，当前进度为 ${view.ready.length} / ${view.players.length}。</p>`;
    }
    if (view.phase === 'booster') {
      const count = activeOptions().filter(o => o.action.type === 'choose_booster').length;
      return `<p>现在是首轮推进器选择。按座次逆序从市场中选择一张推进器；当前可选 ${count} 张。点击推进器卡片即可查看收入和特殊行动。</p>`;
    }
    if (view.current_turn !== view.you) {
      return `<p>现在轮到 <b>${esc(player(view.current_turn)?.name || '另一位玩家')}</b>。你可以先查看 Galaxy、Research、Technology 或 Players，等对方完成 ${esc(phaseNames[view.phase] || '当前阶段')}。</p>`;
    }
    const options = activeOptions();
    const pending = view.pending[0];
    if (pending) {
      const pendingText = {leech:'决定是否接受邻居充能', tech:'选择一块科技', track:'选择一条研究轨道', lost:'放置失落星球'}[pending.kind] || '完成当前待处理选择';
      return `<p>请先${pendingText}。完成后才能继续当前回合。</p>`;
    }
    const groups = [];
    const mapCount = options.filter(o => o.category === 'map').length;
    if (mapCount) groups.push(`<li><b>主行动：</b>点击 Galaxy 中带高亮边框的星球，选择建造矿场、升级建筑或盖亚行动。</li>`);
    const names = {power:'Power / QIC', free:'Free Actions', special:'特殊行动', technology:'Technology', research:'Research', decision:'待处理决定', income:'领取收入', faction:'选择种族', next:'进入下一阶段'};
    [...new Set(options.map(o => o.category).filter(category => category !== 'map' && category !== 'pass'))].forEach(category => {
      const count = options.filter(o => o.category === category).length;
      const location = category === 'research'
        ? '请打开 Research 页签处理'
        : category === 'technology'
          ? '可在 Actions 页签处理，也可以打开 Technology 页签查看详情'
          : '可在 Actions 页签处理';
      groups.push(`<li><b>${names[category] || category}：</b>当前有 ${count} 个可选项，${location}。</li>`);
    });
    if (options.some(o => o.category === 'pass')) groups.push(`<li><b>Pass：</b>完成本轮后可以放弃，并选择下一轮推进器。</li>`);
    if (view.can_federate) groups.push('<li><b>联邦：</b>可以在 Actions 页签点击 Form Federation，然后回到 Galaxy 选择建筑和连接格。</li>');
    if (!groups.length) groups.push('<li>当前没有可执行的选项，请等待房间状态更新。</li>');
    return `<p>你现在可以做这些事：</p><ul class="gaia-hint-actions">${groups.join('')}</ul>${view.main_done ? '<p class="gaia-muted">主行动已经完成；仍可进行 Free Actions，或选择 Pass。</p>' : ''}`;
  }
  function render() {
    if (!view || !panel) return;
    finishMapDrag();
    if (hintMode === 'tooltip') hideHint();
    const p = me();
    const acting = view.current_turn === view.you;
    const roundTiles = view.round_tiles.map((id,i) => `<div class="gaia-round-tile ${view.round === i+1 ? 'current' : view.round > i+1 ? 'past' : ''}"><small>ROUND ${i+1}</small><strong>${esc(defs().rounds[id].name)}</strong></div>`).join('');
    const tabs = [['galaxy','Galaxy'],['actions','Actions'],['research','Research'],['technology','Technology'],['players','Players']];
    const main = activeTab === 'galaxy' ? renderMap() : activeTab === 'actions' ? renderActionsTab() : activeTab === 'research' ? renderResearch() : activeTab === 'technology' ? renderTechnology() : renderPlayers();
    const tabControls = '';
    panel.innerHTML = `${tokenSprite()}<div class="gaia-title"><div class="gaia-status ${acting ? 'your-turn' : ''}">${view.game_over ? 'Final scores' : acting ? 'Your turn' : 'Waiting'} <span>${esc(phaseNames[view.phase])}</span></div></div><div class="gaia-rounds">${roundTiles}</div>${p ? renderGaiaDashboard(p) : ''}${renderBoosterPrompt()}${renderBoosterPrompt('pass')}${renderResults()}<div class="gaia-layout"><section class="gaia-workspace"><nav class="gaia-tabs" aria-label="Game boards">${tabs.map(([id,label]) => button(label,'tab',`data-gaia-tab="${id}" class="${activeTab === id ? 'active' : ''}" aria-pressed="${activeTab === id}"`,id === 'galaxy' ? 'map' : id === 'players' ? 'player' : id)).join('')}</nav><div class="gaia-tab-content">${main}${tabControls}</div></section></div><details class="gaia-log"><summary>Game Log <span>${view.log.length}</span></summary><ol>${[...view.log].reverse().map(entry => `<li><small>R${entry.round} ${esc(player(entry.player_id)?.name || '')}</small> ${esc(entry.message)}</li>`).join('')}</ol></details>`;
    panel.classList.toggle('gaia-explaining', explainMode);
    prepareHints();
    const boosterGrid = panel.querySelector('.gaia-booster-grid');
    if (boosterGrid) {
      const mode = boosterGrid.closest('[data-gaia-booster-layer]')?.dataset.gaiaBoosterMode;
      const scrollTop = mode === 'pass' ? passScrollTop : boosterScrollTop;
      boosterGrid.scrollTop = Math.min(scrollTop, Math.max(0, boosterGrid.scrollHeight - boosterGrid.clientHeight));
    }
    if (boosterFocusPending) {
      boosterFocusPending = false;
      panel.querySelector('.gaia-booster-dock-button')?.focus({preventScroll:true});
    }
  }
  function cancelSelection() {
    selectedOption = null; selectedHex = null; federationMode = false; federationHexes.clear(); render();
  }
  function payment(action) {
    const inputs = panel.querySelectorAll('[data-gaia-payment]');
    if (inputs.length) {
      action.power_tokens = [...inputs].map(input => Number(input.value));
      action.brain = !!panel.querySelector('#gaiaPayBrain')?.checked;
    }
    return action;
  }
  function dispatch(action) {
    sendAction(action);
    selectedOption = null;
    // Keep the chosen planet for context until the server advances the state.
    federationMode = false; federationHexes.clear(); render();
  }
  panel?.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    const target = event.target.closest('[data-gaia-hint]');
    if (target) showHint(target, 'tooltip');
  }, true);
  panel?.addEventListener('pointerout', event => {
    const target = event.target.closest?.('[data-gaia-hint]');
    const related = event.relatedTarget;
    if (target && related && target.contains(related)) return;
    scheduleHintHide();
  }, true);
  panel?.addEventListener('focusin', event => {
    const target = event.target.closest('[data-gaia-hint]');
    if (target?.matches(':focus-visible')) showHint(target, 'tooltip');
  });
  panel?.addEventListener('focusout', scheduleHintHide);
  panel?.addEventListener('pointerdown', event => {
    const target = event.target.closest('[data-gaia-hint]');
    hintGesture = target && event.isPrimary && event.button === 0 && event.pointerType !== 'mouse' && canShowHint()
      ? {target, id:event.pointerId, x:event.clientX, y:event.clientY, moved:false} : null;
  }, true);
  panel?.addEventListener('pointermove', event => {
    if (hintGesture && Math.hypot(event.clientX - hintGesture.x, event.clientY - hintGesture.y) > 10) hintGesture.moved = true;
  }, true);
  panel?.addEventListener('pointercancel', () => { hintGesture = null; }, true);
  panel?.addEventListener('pointerup', event => {
    const gesture = hintGesture;
    hintGesture = null;
    if (!gesture || gesture.moved || gesture.id !== event.pointerId || !canShowHint()) return;
    if (event.target.closest('[data-gaia-hint]') !== gesture.target) return;
    showHint(gesture.target, 'banner');
    consumedHintTap = {target:gesture.target, until:Date.now() + 700};
    event.preventDefault(); event.stopPropagation();
  }, true);
  panel?.addEventListener('pointerdown', event => {
    const card = event.target.closest('[data-gaia-booster]');
    boosterSwipe = card && event.isPrimary && event.button === 0 && event.pointerType !== 'mouse'
      ? {id:event.pointerId, x:event.clientX, y:event.clientY, moved:false} : null;
  }, true);
  panel?.addEventListener('pointermove', event => {
    if (boosterSwipe && boosterSwipe.id === event.pointerId && Math.hypot(event.clientX - boosterSwipe.x, event.clientY - boosterSwipe.y) > 10) boosterSwipe.moved = true;
  }, true);
  panel?.addEventListener('pointercancel', () => { boosterSwipe = null; }, true);
  panel?.addEventListener('pointerup', event => {
    if (!boosterSwipe || boosterSwipe.id !== event.pointerId) return;
    if (boosterSwipe.moved) suppressBoosterClickUntil = Date.now() + 300;
    boosterSwipe = null;
  }, true);
  panel?.addEventListener('click', event => {
    const target = event.target.closest('[data-gaia-hint]');
    if (!target || !canShowHint()) return;
    // Looking up a cost badge must not select its parent action or cancel a selection.
    event.preventDefault(); event.stopImmediatePropagation();
    if (consumedHintTap?.target === target && Date.now() < consumedHintTap.until) {
      consumedHintTap = null;
      return;
    }
    const touch = event.pointerType ? event.pointerType !== 'mouse' : event.detail > 0 && matchMedia('(hover: none) and (pointer: coarse)').matches;
    showHint(target, touch ? 'banner' : 'tooltip');
  }, true);
  panel?.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest('[data-gaia-hint]');
    if (!target || target.tabIndex !== 0 || !canShowHint()) return;
    event.preventDefault(); event.stopImmediatePropagation();
    showHint(target, 'tooltip');
  }, true);
  document.addEventListener('pointerdown', event => {
    if (hintMode === 'tooltip' && hintTarget?.matches(':hover')) return;
    if (!event.target.closest('[data-gaia-hint], #gaiaInlineHint')) hideHint();
  }, true);
  document.addEventListener('scroll', () => { if (hintMode === 'tooltip' && !hintTarget?.matches(':hover')) hideHint(); }, true);
  window.addEventListener('resize', hideHint);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hideHint(); });
  panel?.addEventListener('click', event => {
    if (drag?.moved) return;
    const boosterCard = event.target.closest('[data-gaia-booster]');
    if (boosterCard) {
      if (Date.now() < suppressBoosterClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      const layer = boosterCard.closest('[data-gaia-booster-layer]');
      const mode = layer?.dataset.gaiaBoosterMode || 'initial';
      const grid = layer?.querySelector('.gaia-booster-grid');
      if (mode === 'pass') {
        if (grid) passScrollTop = grid.scrollTop;
        passSelected = boosterCard.dataset.gaiaBooster || null;
      } else {
        if (grid) boosterScrollTop = grid.scrollTop;
        boosterSelected = boosterCard.dataset.gaiaBooster || null;
      }
      render();
      const selectedId = mode === 'pass' ? passSelected : boosterSelected;
      [...panel.querySelectorAll(`[data-gaia-booster-layer][data-gaia-booster-mode="${mode}"] [data-gaia-booster]`)].find(el => el.dataset.gaiaBooster === selectedId)?.focus({preventScroll:true});
      return;
    }
    const optionEl = event.target.closest('[data-gaia-option]');
    if (optionEl) {
      const option = activeOptions()[Number(optionEl.dataset.gaiaOption)];
      if (!option) return;
      if (!gaiaNeedsConfirmation(option)) {
        dispatch({...option.action});
        return;
      }
      selectedOption = Number(optionEl.dataset.gaiaOption);
      if (activeTab !== 'actions' && activeTab !== 'galaxy') activeTab = 'actions';
      render();
      panel.querySelector('.gaia-confirm')?.scrollIntoView({block:'nearest', behavior:'smooth'});
      return;
    }
    const hexEl = event.target.closest('[data-gaia-hex]');
    if (hexEl) {
      const id = hexEl.dataset.gaiaHex;
      selectedOption = null;
      if (federationMode) { federationHexes.has(id) ? federationHexes.delete(id) : federationHexes.add(id); }
      else {
        selectedHex = selectedHex === id ? null : id;
        render();
        if (selectedHex) openMapActionDialog(id);
      }
      if (federationMode) render();
      return;
    }
    const commandEl = event.target.closest('[data-gaia-command]');
    if (commandEl) {
      const command = commandEl.dataset.gaiaCommand;
      if (command === 'toggle-booster-dock') {
        const layer = commandEl.closest('[data-gaia-booster-layer]');
        const mode = layer?.dataset.gaiaBoosterMode || 'initial';
        const grid = layer?.querySelector('.gaia-booster-grid');
        if (mode === 'pass') {
          if (grid) passScrollTop = grid.scrollTop;
          passDocked = !passDocked;
        } else {
          if (grid) boosterScrollTop = grid.scrollTop;
          boosterDocked = !boosterDocked;
        }
        render();
        const docked = mode === 'pass' ? passDocked : boosterDocked;
        if (!docked) {
          const selectedId = mode === 'pass' ? passSelected : boosterSelected;
          const selectedCard = selectedId && [...panel.querySelectorAll(`[data-gaia-booster-layer][data-gaia-booster-mode="${mode}"] [data-gaia-booster]`)].find(el => el.dataset.gaiaBooster === selectedId);
          (selectedCard || panel.querySelector('[data-gaia-booster]'))?.focus({preventScroll:true});
        }
      } else if (command === 'booster-help') showHelp();
      else if (command === 'booster-explain') { setExplain(!explainMode); commandEl.textContent = explainMode ? 'Explaining…' : 'Explain'; commandEl.setAttribute('aria-pressed', String(explainMode)); }
      else if (command === 'open-pass-booster') {
        passDialogOpen = true;
        passDocked = false;
        passSelected = null;
        passScrollTop = 0;
        boosterFocusPending = true;
        render();
      }
      else if (command === 'confirm-booster' && boosterSelected) {
        const option = activeOptions().find(o => o.action.type === 'choose_booster' && o.action.booster === boosterSelected);
        if (!option) return;
        boosterSelected = null;
        boosterDocked = false;
        dispatch({...option.action});
      } else if (command === 'cancel-booster') {
        const layer = commandEl.closest('[data-gaia-booster-layer]');
        if (layer?.dataset.gaiaBoosterMode === 'pass') passSelected = null;
        else boosterSelected = null;
        render();
      } else if (command === 'confirm-pass' && passSelected) {
        const option = activeOptions().find(o => o.action.type === 'pass' && (o.action.booster || '__pass__') === passSelected);
        if (!option) return;
        passDialogOpen = false;
        passDocked = false;
        passSelected = null;
        passScrollTop = 0;
        dispatch({...option.action});
      } else if (command === 'confirm' && selectedOption !== null) {
        const o = activeOptions()[selectedOption];
        if (!o) return;
        const action = {...o.action};
        if (o.max_count > 1) action.count = Number(panel.querySelector('#gaiaActionCount').value);
        if (action.type === 'gaiaform') payment(action);
        dispatch(action);
      } else if (command === 'cancel') cancelSelection();
      else if (command === 'toggle-legend') {
        legendOpen = !legendOpen;
        hideHint();
        panel.querySelector('#gaiaMapLegend').hidden = !legendOpen;
        commandEl.setAttribute('aria-expanded', String(legendOpen));
        commandEl.textContent = `Legend ${legendOpen ? '▾' : '▸'}`;
      }
      else if (command === 'tab') { activeTab = commandEl.dataset.gaiaTab; render(); }
      else if (command === 'federation') { federationMode = true; selectedOption = null; selectedHex = null; activeTab = 'galaxy'; render(); }
      else if (command === 'form-federation') { dispatch(payment({type:'federation', hexes:[...federationHexes], token:panel.querySelector('input[name="gaiaFederationToken"]:checked')?.value})); }
      else if (command === 'zoom-in') { mapZoom = Math.min(3, mapZoom + .5); render(); }
      else if (command === 'zoom-out') { mapZoom = Math.max(1, mapZoom - .5); render(); }
      else if (command === 'fit') { mapZoom = 1; mapCenter = null; render(); }
      return;
    }
    if (event.target.closest('[data-gaia-booster-layer],input,select,label,summary,details,a')) return;
    if (selectedHex || selectedOption !== null || federationMode) cancelSelection();
  });
  panel?.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-gaia-hex]')) {
      event.preventDefault(); event.target.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    }
  });
  function finishMapDrag(event) {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const finished = drag;
    drag = null;
    if (finished.moved) suppressClickUntil = Date.now() + 200;
    finished.svg.classList.remove('gaia-panning');
    if (finished.capture.hasPointerCapture(finished.pointerId)) finished.capture.releasePointerCapture(finished.pointerId);
  }
  panel?.addEventListener('pointerdown', event => {
    const svg = event.target.closest('#gaiaGalaxy');
    if (!svg || !event.isPrimary || event.button !== 0 || drag || explainMode) return;
    const box = svg.viewBox.baseVal;
    // Account for SVG letterboxing as well as zoom when translating finger movement.
    const transform = svg.getScreenCTM()?.inverse();
    if (!transform) return;
    drag = {x:event.clientX, y:event.clientY, moved:false, svg, center:[box.x+box.width/2,box.y+box.height/2], transform, pointerId:event.pointerId, capture:event.target};
    drag.capture.setPointerCapture(event.pointerId);
  });
  panel?.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
    if (Math.abs(dx)+Math.abs(dy) < 6) return;
    drag.moved = true;
    if (event.cancelable) event.preventDefault();
    drag.svg.classList.add('gaia-panning');
    const {a, b, c, d} = drag.transform;
    mapCenter = [drag.center[0] - dx*a - dy*c, drag.center[1] - dx*b - dy*d];
    const box = drag.svg.viewBox.baseVal;
    drag.svg.setAttribute('viewBox', `${mapCenter[0]-box.width/2} ${mapCenter[1]-box.height/2} ${box.width} ${box.height}`);
  }, {passive:false});
  document.addEventListener('pointerup', finishMapDrag);
  document.addEventListener('pointercancel', finishMapDrag);
  panel?.addEventListener('lostpointercapture', finishMapDrag);
  window.addEventListener('blur', () => finishMapDrag());
  document.addEventListener('pointerdown', event => {
    if (!explainMode || panel.classList.contains('hidden') || modal || event.target.closest('#gaiaProjectHeaderActions')) return;
    let target = event.target.closest('[data-gaia-explain]');
    if (!target) target = [...panel.querySelectorAll('button[data-gaia-explain]')].find(el => { const r=el.getBoundingClientRect(); return event.clientX>=r.left && event.clientX<=r.right && event.clientY>=r.top && event.clientY<=r.bottom; });
    event.preventDefault(); event.stopPropagation();
    suppressClickUntil = Date.now()+500;
    if (target) { const explanation=target.dataset.gaiaExplain; setExplain(false); openModal('Explain', `<p>${esc(explanation)}</p>`); }
  }, true);
  document.addEventListener('click', event => {
    if (panel?.classList.contains('hidden')) return;
    if (event.target.closest('#gaiaProjectHeaderActions,[data-gaia-close],.gaia-modal')) return;
    if (Date.now() < suppressClickUntil || explainMode) {
      event.preventDefault(); event.stopPropagation();
      const target=event.target.closest('[data-gaia-explain]');
      if (explainMode && target) { const explanation=target.dataset.gaiaExplain; setExplain(false); openModal('Explain', `<p>${esc(explanation)}</p>`); }
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (hintPopup) { hideHint(); return; }
      if (modal) { closeModal(); return; }
      if (explainMode) { setExplain(false); return; }
      const floatingBoosterLayer = panel && !panel.classList.contains('hidden') && panel.querySelector('.gaia-booster-layer-floating');
      if (floatingBoosterLayer) {
        if (floatingBoosterLayer.dataset.gaiaBoosterMode === 'pass') passDocked = true;
        else boosterDocked = true;
        render();
        return;
      }
      const passLayer = panel && !panel.classList.contains('hidden') && panel.querySelector('.gaia-pass-layer');
      if (passLayer) {
        passDialogOpen = false;
        passDocked = false;
        passSelected = null;
        passScrollTop = 0;
        render();
        return;
      }
      if (view && !panel.classList.contains('hidden')) cancelSelection();
    }
    if (event.key === 'Tab' && modal) {
      const focusable=[...modal.querySelectorAll('button,a,summary,input,select')];
      const first=focusable[0], last=focusable[focusable.length-1];
      if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
    } else if (event.key === 'Tab' && panel && !panel.classList.contains('hidden')) {
      const boosterDialog = panel.querySelector('.gaia-booster-layer-floating .gaia-booster-dialog');
      if (boosterDialog) {
        const focusable = [...boosterDialog.querySelectorAll('button,[href],input,select,summary')].filter(el => !el.disabled && el.offsetParent !== null);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (first && last && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    }
  });
  help?.addEventListener('click', showHelp);
  hintButton?.addEventListener('click', () => openModal('Hint · 当前可做什么', renderGaiaHint()));
  explainButton?.addEventListener('click', () => { closeModal(); setExplain(!explainMode); });
  window.showGaiaProjectHeaderActions = show => {
    if (header) header.style.display = show ? 'flex' : 'none';
    if (!show) { finishMapDrag(); hideHint(); setExplain(false); closeModal(); }
  };
  window.clearGaiaProjectState = () => {
    finishMapDrag(); hideHint(); hintGesture = null; consumedHintTap = null;
    legendOpen = false;
    view=null; selectedHex=null; selectedOption=null; boosterSelected=null; boosterDocked=false; boosterScrollTop=0; passDialogOpen=false; passDocked=false; passSelected=null; passScrollTop=0; boosterFocusPending=false; boosterSwipe=null; suppressBoosterClickUntil=0; viewKey=''; federationMode=false; federationHexes.clear(); activeTab='galaxy'; mapZoom=1; mapCenter=null; setExplain(false); closeModal(); if (panel) panel.innerHTML='';
  };
  window.renderGaiaProjectGameState = data => {
    const next = data.view;
    const key = `${data.room_id}|${data.state_version ?? ''}|${next.round}|${next.phase}|${next.current_turn}|${JSON.stringify(next.pending)}|${next.log.length}|${next.main_done}`;
    if (key !== viewKey) { selectedOption=null; federationMode=false; federationHexes.clear(); }
    const sameBoosterTurn = view && view.you === next.you && view.phase === 'booster' && next.phase === 'booster' && view.current_turn === next.current_turn && next.current_turn === next.you && viewKey.split('|')[0] === String(data.room_id);
    if (!sameBoosterTurn) { boosterSelected=null; boosterDocked=false; boosterScrollTop=0; }
    const samePassTurn = view && view.you === next.you && view.phase === 'action' && next.phase === 'action' && view.current_turn === next.current_turn && next.current_turn === next.you && viewKey.split('|')[0] === String(data.room_id);
    if (!samePassTurn) { passDialogOpen=false; passDocked=false; passSelected=null; passScrollTop=0; }
    if (next.phase === 'booster' && next.current_turn === next.you && (!view || view.phase !== 'booster' || view.current_turn !== next.current_turn || view.you !== next.you)) boosterFocusPending = true;
    if (next.phase === 'booster' && next.current_turn === next.you && boosterSelected && !next.options.some(o => o.action.type === 'choose_booster' && o.action.booster === boosterSelected)) boosterSelected = null;
    if (next.phase === 'action' && next.current_turn === next.you && passSelected && !next.options.some(o => o.action.type === 'pass' && (o.action.booster || '__pass__') === passSelected)) passSelected = null;
    if (viewKey && viewKey.split('|')[0] !== String(data.room_id)) { hideHint(); selectedHex=null; activeTab='galaxy'; legendOpen=false; mapZoom=1; mapCenter=null; }
    viewKey=key; view=next;
    if (currentGameType !== 'gaia_project') { currentGameType='gaia_project'; setGamePanelVisibility('gaia_project'); }
    if (view.phase==='faction' && activeTab==='galaxy') activeTab='actions';
    if (view.phase==='placement' && !selectedHex) activeTab='galaxy';
    render();
    if (typeof logGameEvents === 'function') logGameEvents(data);
  };
})();
