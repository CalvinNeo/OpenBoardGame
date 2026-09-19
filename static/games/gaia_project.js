(() => {
  'use strict';
  const panel = document.getElementById('gaiaProjectPanel');
  const header = document.getElementById('gaiaProjectHeaderActions');
  const help = document.getElementById('gaiaProjectHelpBtn');
  const explainButton = document.getElementById('gaiaProjectExplainBtn');
  let view = null;
  let selectedHex = null;
  let selectedOption = null;
  let activeTab = 'galaxy';
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
  const icons = {credits: '💳', ore: '⛏️', knowledge: '🧠', qic: '🟩', vp: '⭐', power: '⚡', tokens: '🟣', charge: '⚡', token_iii: 'Ⅲ', gaiaformers: '🌱'};
  const resourceNames = {credits: '信用点', ore: '矿石', knowledge: '知识', qic: 'QIC', vp: 'VP', power: '能量', tokens: '能量枚数', charge: '充能', token_iii: 'III 碗能量', gaiaformers: '改造器'};
  const metricNames = {mines: '矿场', labs: '研究所', trading: '交易站', big: '学院／大学', gaia: '盖亚星', federations: '联邦标记', types: '星球种类', sectors: '殖民星区'};
  const phaseNames = {faction: '选择种族', placement: '放置起始建筑', booster: '选择首轮推进器', income: '领取收入', gaia: '盖亚阶段', action: '行动阶段', round_end: '轮末回顾', game_over: '终局'};
  const mainLabels = {academy: '大学行动', bescods: '最低轨道研究', ambas: '交换行星学院', firaks: '降级研究所', ivits: '放置空间站', knowledge_3: '获得 3 知识', knowledge_2: '获得 2 知识', ore_2: '获得 2 矿石', credits_7: '获得 7 信用点', tokens_2: '获得 2 能量', tech: '获取科技', rescore: '重算联邦', diversity: '星球种类计分'};
  const explainText = {
    map: '点击星球查看它的类型、建筑与当前可执行行动。高亮边框表示有合法行动。地图中的数字是玩家席位；⛏ 矿场、◆ 交易站、⚗ 研究所、♜ 学院、♛ 大学、⬡ 空间站。滚轮不会放大页面，使用 Zoom 按钮放大星图。',
    research: '研究通常花费 4 知识。2→3 级额外充能 3。5 级需翻一枚绿色联邦标记，每条轨道仅一人可到达。经济／科学 5 级为一次奖励，不再提供 4 级收入。',
    technology: '研究所和大学升级、4 QIC 公共行动、伊塔盖亚能力可获得科技。高级科技需对应轨道 4 级、绿色联邦标记和未覆盖基础科技；获得高级科技与推进到 5 级分别消耗一枚绿色标记。',
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
  const resources = data => Object.entries(data || {}).filter(([k, n]) => icons[k] && typeof n === 'number' && n).map(([k, n]) => `<span title="${esc(resourceNames[k] || k)}">${icons[k] || ''} ${esc(n)}</span>`).join(' ');
  const info = kind => `data-gaia-explain="${esc(explainText[kind] || kind)}"`;
  const button = (label, command, extra = '', explanation = '') => `<button type="button" data-gaia-command="${command}" ${extra} ${explanation ? info(explanation) : ''}>${label}</button>`;
  const activeOptions = () => view?.options || [];
  const specText = spec => {
    if (!spec) return '';
    const parts = [];
    if (spec.income) parts.push('收入 ' + resources(spec.income));
    if (spec.immediate) parts.push('立即 ' + resources(spec.immediate));
    if (spec.special) parts.push(typeof spec.special === 'string' ? (spec.special === 'range' ? '行动：航程 +3 建矿／盖亚' : '行动：免费改造一步并建矿') : '每轮行动 ' + resources(spec.special));
    if (spec.passing) parts.push(`放弃：每${metricNames[spec.passing[0]] || spec.passing[0]} +${spec.passing[1]} ⭐`);
    if (spec.metric) parts.push(`立即：每${metricNames[spec.metric[0]] || spec.metric[0]} +${spec.metric[1]} ${icons[spec.metric[2]]}`);
    if (spec.event) parts.push(`每次${({mine: '建矿', gaia: '盖亚建矿', research: '科研', trading: '升级交易站'})[spec.event[0]]} +${spec.event[1]} ⭐`);
    if (spec.effect) parts.push(esc(spec.effect));
    return parts.join(' · ');
  };
  const optionLabel = o => {
    const a = o.action;
    if (a.type === 'convert') return `${resources(o.cost)} → ${resources(o.gain)}`;
    if (a.type === 'income') return `${esc(o.label)} · ${resources(view.income_pending[a.index]?.gain)}`;
    if (a.type === 'power_action') return esc(mainLabels[a.action] || o.label) + (a.token_index !== undefined ? ` · ${resources(defs().federations[me().federations[a.token_index].token])}` : '');
    if (a.type === 'special') return esc(mainLabels[a.action] || o.label) + (a.track ? ` · ${esc(defs().tracks[a.track])}` : '');
    if (a.type === 'build') return '⛏ 建造矿场' + ({normal: '', booster_range: ' · 推进器航程 +3', booster_terraform: ' · 推进器改造 1', terraform_1: ' · 公共改造 1', terraform_2: ' · 公共改造 2'}[a.source] || '');
    return esc(o.label);
  };
  function optionButton(o, index, full = false) {
    const description = o.action.booster ? specText(defs().boosters[o.action.booster]) : o.action.tile ? specText(defs().techs[o.action.tile] || defs().advanced[o.action.tile]) : '';
    const cost = resources(o.cost);
    return `<button type="button" class="gaia-option${selectedOption === index ? ' selected' : ''}" data-gaia-option="${index}" ${info(o.category)}><strong>${optionLabel(o)}</strong>${cost ? `<small>${cost}</small>` : ''}${(full || description) && description ? `<small>${description}</small>` : ''}</button>`;
  }
  function setExplain(on) {
    explainMode = on;
    panel?.classList.toggle('gaia-explaining', on);
    explainButton?.setAttribute('aria-pressed', String(on));
  }
  function closeModal() {
    modal?.remove(); modal = null;
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  function openModal(title, html) {
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
    openModal('Gaia Project · Help', `
      <p>2–4 人 · 基础版 · 六轮竞争。通过殖民、研究、科技、联邦和每轮目标获得最多 ⭐ VP；并列共同获胜。</p>
      <h3>开局与六轮</h3><p>选种族 → 蛇形放置两座矿场 → 逆序选推进器。异星人额外放第三矿，蜂人最后放一座学院。每轮依次领取收入、完成上轮盖亚计划、轮流行动，直到所有人放弃。轮末全员点击 <b>Next Round</b> 后才继续。</p>
      <h3>每回合一个主行动</h3><p>点击地图上的星球建矿、升级或启动盖亚计划；切换 Research 科研，或使用公共／特殊行动。主行动后仍能转换资源，然后 <b>End Turn</b>。选择后点击 <b>Confirm</b> 执行；点击空白或 Esc 取消。</p>
      <p>矿场：1 ⛏️ + 2 💳，另付改造与航程费用。普通星球按母星轮计算改造步数；每步初始 3 矿石，研究后降至 2／1。每花 1 🟩 QIC，单次航程增加 2。绿星另付 1 QIC；自己改造器处免适居费且自动可达。</p>
      <p>矿场→交易站：2 矿石 + 6 信用点，有对手建筑两格内则只需 3 信用点。交易站→研究所：3 矿石 + 5 信用点；交易站→学院：4 矿石 + 6 信用点；研究所→大学：6 矿石 + 6 信用点。研究所／大学获得一块科技。</p>
      <h3>盖亚与能量</h3><p>超维星必须先派改造器；从能量碗转移 6／4／3 枚到盖亚区，下轮收入之后完成改造。能量归还，改造器保留在星球上，直到建矿才收回。第六轮启动的计划不会完成。</p><p>${explainText.free}</p><p>邻居两格内建造／升级时，可按自己最高建筑力量充能，花费充能数减 1 VP。必须全充或拒绝，仅在能量容量／VP 不足时减量。已经放弃也可接受充能。</p>
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
      const structures = occupants.map(([id, building], i) => `<g transform="translate(${(i - (occupants.length - 1) / 2) * 15},1)"><rect x="-8" y="-10" width="16" height="18" rx="4" fill="${color(id)}" stroke="#07111e" stroke-width="1.5"/><text y="3" class="gaia-structure" fill="#07111e">${esc(defs().buildings[building].icon)}</text><text y="17" class="gaia-seat" fill="${color(id)}">${seat(id)}</text></g>`).join('');
      const federation = Object.keys(hex.federations).map((id, i) => `<circle r="${20 + i}" fill="none" stroke="${color(id)}" stroke-width="1.5" stroke-dasharray="2 2"/>`).join('');
      return `<g class="gaia-hex ${active ? 'available' : ''} ${chosen ? 'selected' : ''}" transform="translate(${x},${y})" role="button" tabindex="0" data-gaia-hex="${hex.id}" aria-label="${esc(hex.id + ' ' + (planet?.name || '太空'))}" ${info('map')}><title>${esc(hex.id + ' · ' + (planet?.name || '太空'))}</title><polygon points="${shape}"/>${planet ? `<circle class="gaia-planet" r="15" fill="${planet.color}"/><ellipse cx="-4" cy="-5" rx="7" ry="4" fill="white" opacity=".17"/>` : '<circle r="1" fill="#59718d"/>'}${structures}${sat}${hex.gaiaformer ? `<text y="5" class="gaia-former" fill="${color(hex.gaiaformer)}">🌱</text>` : ''}${federation}</g>`;
    }).join('');
    const sectors = [...new Set(board.map(h => h.sector))].map(sector => {
      const center = positions.find(p => p.h.id === `${sector}-9`);
      return `<text x="${center.x}" y="${center.y + 4}" class="gaia-sector">${esc(sector.replace('outlined', ''))}</text>`;
    }).join('');
    return `<div class="gaia-map-tools">${button('−', 'zoom-out', 'aria-label="Zoom out"')}${button('Fit', 'fit')}${button('+', 'zoom-in', 'aria-label="Zoom in"')}<span>${federationMode ? '选择建筑与卫星连接格' : '点击星球 · 放大后可拖动'}</span></div><div class="gaia-map-wrap"><svg id="gaiaGalaxy" viewBox="${cx - w / 2} ${cy - h / 2} ${w} ${h}" aria-label="Gaia Project galaxy" role="group">${hexes}${sectors}</svg></div><div class="gaia-legend">${Object.entries(defs().planets).filter(([id]) => id !== 'lost').map(([, p]) => `<span><i style="background:${p.color}"></i>${esc(p.name)}</span>`).join('')}</div>`;
  }
  function renderResearch() {
    const descriptions = {
      terraforming: ['改造步成本 3 矿', '+2 矿；步成本 3', '步成本 2 矿', '步成本 1 矿', '+2 矿', '获得预留联邦'],
      navigation: ['航程 1', '+1 QIC；航程 1', '航程 2', '+1 QIC；航程 2', '航程 3', '航程 4；失落星球'],
      ai: ['—', '+1 QIC', '+1 QIC', '+2 QIC', '+2 QIC', '+4 QIC'],
      gaia: ['不可改造', '1 改造器；6 能量', '+3 能量枚数', '2 改造器；4 能量', '3 改造器；3 能量', '+4 VP + 盖亚星数'],
      economy: ['—', '收入 2💳 1⚡', '收入 2💳 1⛏ 2⚡', '收入 3💳 1⛏ 3⚡', '收入 4💳 2⛏ 4⚡', '立即 6💳 3⛏ 6⚡'],
      science: ['—', '收入 1🧠', '收入 2🧠', '收入 3🧠', '收入 4🧠', '立即 9🧠'],
    };
    return `<div class="gaia-research">${Object.entries(defs().tracks).map(([id, name]) => `<section class="gaia-track"><h3>${esc(name)}</h3>${[5,4,3,2,1,0].map(level => {
      const option = activeOptions().findIndex(o => ['research','choose_track'].includes(o.action.type) && o.action.track === id && me()?.research[id] + 1 === level);
      const markers = view.players.filter(p => p.research[id] === level).map(p => `<b style="background:${color(p.player_id)}" title="${esc(p.name)}">${seat(p.player_id)}</b>`).join('');
      return `<button type="button" class="gaia-level ${level === 5 ? 'gaia-top-level' : ''}" ${option >= 0 ? `data-gaia-option="${option}"` : 'disabled'} ${info('research')}><strong>${level}${level === 5 ? ' ◈' : ''}</strong><span>${descriptions[id][level]}</span><div class="gaia-markers">${markers}</div></button>`;
    }).join('')}</section>`).join('')}</div><p class="gaia-muted">2 → 3：额外充能 3。第 5 级：翻绿色联邦标记，每轨仅一人。</p>`;
  }
  function renderTechnology() {
    return `<h3>基础科技</h3><div class="gaia-tech-grid">${view.tech_market.map((id, i) => {
      const option = activeOptions().findIndex(o => o.action.type === 'choose_tech' && o.action.tile === id);
      return `<button type="button" class="gaia-tech" ${option >= 0 ? `data-gaia-option="${option}"` : 'disabled'} ${info('technology')}><small>${i < 6 ? esc(Object.values(defs().tracks)[i]) : '任意研究'} · ${view.tech_stock[id]} left</small><strong>${esc(defs().techs[id].name)}</strong><span>${specText(defs().techs[id])}</span></button>`;
    }).join('')}</div><h3>高级科技</h3><div class="gaia-tech-grid">${Object.entries(view.advanced_market).map(([track, id]) => `<div class="gaia-tech advanced"><small>${esc(defs().tracks[track])} 4+ · 绿色联邦</small><strong>${id ? esc(defs().advanced[id].name) : 'Taken'}</strong><span>${id ? specText(defs().advanced[id]) : '—'}</span></div>`).join('')}</div><p class="gaia-muted">获取高级科技时，在右侧选择要覆盖的基础科技。</p>`;
  }
  function renderPlayers() {
    return `<div class="gaia-player-grid">${view.players.map(p => `<article class="gaia-player-card" style="--player-color:${color(p.player_id)}"><h3>${seat(p.player_id)} · ${esc(p.name)} ${p.player_id === view.you ? '(You)' : ''} <span>⭐ ${p.vp}</span></h3><p>${p.faction ? esc(defs().factions[p.faction].name) : 'Choosing faction…'}</p><div class="gaia-resources">${resources(p)}</div><p>能量 I ${p.power[0]} · II ${p.power[1]} · III ${p.power[2]} · 盖亚 ${p.gaia_power}${p.brain !== null ? ` · 脑石 ${['I','II','III','Gaia'][p.brain]}` : ''}</p><div class="gaia-badges">${Object.entries(p.counts).map(([k,n]) => `<span>${esc(defs().buildings[k].icon)} ${esc(defs().buildings[k].name)} ${n}</span>`).join('')}</div><details><summary>Income preview</summary>${p.income.map(s => `<p>${esc(s.source)} ${resources(s.gain)}</p>`).join('')}</details><p>推进器：${p.booster ? `${esc(defs().boosters[p.booster].name)} · ${specText(defs().boosters[p.booster])}` : '—'}</p><div class="gaia-owned-tech">${p.techs.map(t => `<span class="${p.covered.includes(t) ? 'covered' : ''}">${esc(defs().techs[t].name)} · ${specText(defs().techs[t])}</span>`).join('')}${p.advanced.map(t => `<span>${esc(defs().advanced[t].name)} · ${specText(defs().advanced[t])}</span>`).join('')}</div><p>联邦：${p.federations.map(f => `${f.green ? '🟢' : '⚪'} ${resources(defs().federations[f.token])}`).join(' / ') || '—'}</p>${p.faction ? `<details><summary>Faction ability</summary><p>${esc(defs().factions[p.faction].ability)}</p><p>学院：${esc(defs().factions[p.faction].institute)}</p></details>` : ''}</article>`).join('')}</div>`;
  }
  function renderResults() {
    if (!view.scores) return '';
    const players = [...view.players].sort((a,b) => b.vp - a.vp);
    return `<div class="gaia-results"><h3>🏆 ${view.winner.map(id => esc(player(id)?.name)).join(' · ')}</h3>${players.map(p => {
      const score = view.scores[p.player_id];
      return `<div class="gaia-result-row"><strong>${esc(p.name)} <b>${score.total} ⭐</b></strong><span>局中 ${score.in_game} · 研究 ${score.research} · 资源 ${score.resources}</span><span>${Object.entries(score.objectives).map(([key,s]) => `${esc(defs().finals[key].name)} ${s.count} → ${s.vp} VP`).join(' / ')}</span></div>`;
    }).join('')}</div>`;
  }
  function renderFederation() {
    const picked = [...federationHexes];
    const selectedStructures = picked.filter(id => view.board[id].buildings[view.you]);
    const satellites = picked.filter(id => !view.board[id].buildings[view.you] && !view.board[id].federations.hasOwnProperty(view.you));
    return `<h3>🛰️ 联邦连接</h3><p class="gaia-muted">${selectedStructures.length} 个建筑 · ${satellites.length} 个卫星。相邻建筑和蜂人已有联邦会自动纳入；提交时检查最少卫星。</p><label class="gaia-field">Token <select id="gaiaFederationToken">${Object.entries(view.federation_supply).filter(([, n]) => n > 0).map(([id,n]) => `<option value="${id}">${Object.entries(defs().federations[id]).map(([k,v]) => `${icons[k]} ${v}`).join(' ')} (${n})</option>`).join('')}</select></label>${renderTokenPayment(satellites.length)}<div class="gaia-confirm-buttons">${button('Form Federation', 'form-federation', !picked.length ? 'disabled' : '', 'federation')}${button('Cancel', 'cancel')}</div>`;
  }
  function renderTokenPayment(required) {
    const p = me();
    if (!p || p.faction === 'ivits') return '';
    let remaining = required;
    const values = p.power.map(n => { const chosen = Math.min(n, remaining); remaining -= chosen; return chosen; });
    const brain = p.brain !== null && p.brain < 3;
    return `<fieldset class="gaia-token-payment"><legend>Power tokens · ${required} required</legend><div>${values.map((n,i) => `<label>${['I','II','III'][i]} <input type="number" min="0" max="${p.power[i]}" value="${n}" data-gaia-payment="${i}" aria-label="Pay tokens from bowl ${i+1}"></label>`).join('')}${brain ? `<label><input type="checkbox" id="gaiaPayBrain" ${remaining ? 'checked' : ''}> Brainstone</label>` : ''}</div></fieldset>`;
  }
  function renderSelection() {
    if (selectedOption === null) return '';
    const o = activeOptions()[selectedOption];
    if (!o) { selectedOption = null; return ''; }
    const tokenCost = o.action.type === 'gaiaform' ? o.cost.tokens : 0;
    return `<div class="gaia-confirm"><small>CONFIRM ACTION</small><h3>${optionLabel(o)}</h3><div class="gaia-resources">${resources(o.cost)}</div>${o.max_count > 1 ? `<label class="gaia-field">Quantity <input id="gaiaActionCount" type="number" min="1" max="${o.max_count}" value="1"></label>` : ''}${tokenCost ? renderTokenPayment(tokenCost) : ''}<div class="gaia-confirm-buttons">${button('Confirm', 'confirm', '', o.category)}${button('Cancel', 'cancel')}</div></div>`;
  }
  function renderControls() {
    const p = me();
    const options = activeOptions();
    const pending = view.pending[0];
    if (!p) return '<h3>Spectating</h3><p class="gaia-muted">观察星图、研究与公开玩家信息。</p>';
    const isActing = view.current_turn === view.you || view.phase === 'round_end';
    let html = renderSelection();
    if (federationMode) return html + renderFederation();
    if (view.phase === 'round_end') {
      html += `<h3>第 ${view.round} 轮结束</h3>${view.players.map(p => `<p>${esc(p.name)} <strong>${view.round_summary[p.player_id]?.delta >= 0 ? '+' : ''}${view.round_summary[p.player_id]?.delta} ⭐</strong> ${view.ready.includes(p.player_id) ? '✓' : ''}</p>`).join('')}<p>${view.ready.length} / ${view.players.length} ready</p>`;
    } else if (view.game_over) {
      return '<h3>Game complete</h3><p>最终分项见星图上方。房主可通过房间 Start Game 开始新局。</p>';
    } else if (!isActing) {
      html += `<h3>Waiting for ${esc(player(view.current_turn)?.name || 'players')}</h3><p class="gaia-muted">${phaseNames[view.phase] || ''}</p>`;
    } else if (pending) {
      html += `<h3>${({leech:'⚡ 邻居充能',tech:'🔬 选择科技',track:'🧠 选择研究',lost:'🌌 放置失落星球'})[pending.kind]}</h3>`;
    } else {
      html += `<h3>${view.main_done && view.phase === 'action' ? '主行动完成' : phaseNames[view.phase]}</h3>`;
    }
    if (selectedHex) {
      const hex = view.board[selectedHex];
      html += `<div class="gaia-planet-info"><strong>${defs().planets[hex.planet]?.emoji || '✨'} ${esc(defs().planets[hex.planet]?.name || '太空')} · ${esc(hex.id)}</strong><p>${Object.entries(hex.buildings).map(([id, kind]) => `${esc(player(id)?.name)} · ${esc(defs().buildings[kind].name)}`).join('<br>') || (hex.gaiaformer ? '🌱 ' + esc(player(hex.gaiaformer)?.name) + ' 的改造器' : '尚未殖民')}</p></div>`;
    }
    const selectedMap = options.map((o,i) => [o,i]).filter(([o]) => o.category === 'map' && o.action.hex === selectedHex);
    html += selectedMap.map(([o,i]) => optionButton(o,i)).join('');
    if (isActing && options.some(o => o.category === 'map') && !selectedHex) html += '<p class="gaia-map-hint">↖ 点击高亮星球，查看建造或升级费用。</p>';
    const categories = ['decision','income','faction','booster','technology','next','research','special','power','free','pass'];
    for (const category of categories) {
      const group = options.map((o,i) => [o,i]).filter(([o]) => o.category === category);
      if (!group.length) continue;
      const items = group.map(([o,i]) => optionButton(o,i)).join('');
      if (['free','pass','power','research'].includes(category)) {
        const titles = {free:'Free Actions', pass:'Pass & choose booster', power:'Power / QIC', research:'Research'};
        html += `<details class="gaia-action-group" ${category === 'free' && view.main_done ? 'open' : ''}><summary>${titles[category]} <span>${group.length}</span></summary><div class="gaia-options">${items}</div></details>`;
      } else html += `<div class="gaia-options ${category === 'faction' ? 'gaia-faction-options' : ''}">${items}</div>`;
    }
    if (view.can_federate) html += button('🛰️ Form Federation', 'federation', 'class="gaia-federation-button"', 'federation');
    if (view.phase === 'faction' && selectedOption !== null) {
      const selected = defs().factions[options[selectedOption]?.action.faction];
      if (selected) html += `<p>${esc(selected.ability)}</p><p>学院：${esc(selected.institute)}</p>`;
    }
    return html;
  }
  function render() {
    if (!view || !panel) return;
    const p = me();
    const acting = view.current_turn === view.you;
    const roundTiles = view.round_tiles.map((id,i) => `<div class="gaia-round-tile ${view.round === i+1 ? 'current' : view.round > i+1 ? 'past' : ''}"><small>ROUND ${i+1}</small><strong>${esc(defs().rounds[id].name)}</strong></div>`).join('');
    const goals = view.final_tiles.map(id => `<span>🏁 ${esc(defs().finals[id].name)}${view.players.length === 2 ? ` · 中立 ${defs().finals[id].neutral}` : ''}</span>`).join('');
    const tabs = [['galaxy','Galaxy'],['research','Research'],['technology','Technology'],['players','Players']];
    const main = activeTab === 'galaxy' ? renderMap() : activeTab === 'research' ? renderResearch() : activeTab === 'technology' ? renderTechnology() : renderPlayers();
    panel.innerHTML = `<div class="gaia-title"><div><small>EXPLORE · RESEARCH · CONNECT</small><h2>盖亚计划 <span>GAIA PROJECT</span></h2></div><div class="gaia-status ${acting ? 'your-turn' : ''}">${view.game_over ? 'Final scores' : acting ? 'Your turn' : 'Waiting'} <span>${esc(phaseNames[view.phase])}</span></div></div><div class="gaia-rounds">${roundTiles}</div><div class="gaia-goals">${goals}</div>${p ? `<div class="gaia-dashboard" ${info('player')}><strong style="color:${color(view.you)}">${p.faction ? esc(defs().factions[p.faction].name) : esc(p.name)}</strong><div class="gaia-resources">${resources({credits:p.credits,ore:p.ore,knowledge:p.knowledge,qic:p.qic,vp:p.vp})}</div><div class="gaia-power-bowls"><span>I <b>${p.power[0]}</b></span><span>II <b>${p.power[1]}</b></span><span>III <b>${p.power[2]}</b></span><span class="gaia-bowl">Gaia <b>${p.gaia_power}</b></span>${p.brain !== null ? `<span>🪨 ${['I','II','III','Gaia'][p.brain]}</span>` : ''}<span>🌱 ${p.gaiaformers}</span></div></div>` : ''}${renderResults()}<div class="gaia-layout"><section class="gaia-workspace"><nav class="gaia-tabs" aria-label="Game boards">${tabs.map(([id,label]) => button(label,'tab',`data-gaia-tab="${id}" class="${activeTab === id ? 'active' : ''}" aria-pressed="${activeTab === id}"`,id === 'galaxy' ? 'map' : id === 'players' ? 'player' : id)).join('')}</nav><div class="gaia-tab-content">${main}</div></section><aside class="gaia-controls" aria-label="Actions">${renderControls()}</aside></div><details class="gaia-log"><summary>Game Log <span>${view.log.length}</span></summary><ol>${[...view.log].reverse().map(entry => `<li><small>R${entry.round} ${esc(player(entry.player_id)?.name || '')}</small> ${esc(entry.message)}</li>`).join('')}</ol></details>`;
    panel.classList.toggle('gaia-explaining', explainMode);
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
  panel?.addEventListener('click', event => {
    if (drag?.moved) return;
    const optionEl = event.target.closest('[data-gaia-option]');
    if (optionEl) {
      selectedOption = Number(optionEl.dataset.gaiaOption); render();
      panel.querySelector('.gaia-confirm')?.scrollIntoView({block:'nearest', behavior:'smooth'});
      return;
    }
    const hexEl = event.target.closest('[data-gaia-hex]');
    if (hexEl) {
      const id = hexEl.dataset.gaiaHex;
      selectedOption = null;
      if (federationMode) { federationHexes.has(id) ? federationHexes.delete(id) : federationHexes.add(id); }
      else selectedHex = selectedHex === id ? null : id;
      render(); return;
    }
    const commandEl = event.target.closest('[data-gaia-command]');
    if (commandEl) {
      const command = commandEl.dataset.gaiaCommand;
      if (command === 'confirm' && selectedOption !== null) {
        const o = activeOptions()[selectedOption];
        if (!o) return;
        const action = {...o.action};
        if (o.max_count > 1) action.count = Number(panel.querySelector('#gaiaActionCount').value);
        if (action.type === 'gaiaform') payment(action);
        dispatch(action);
      } else if (command === 'cancel') cancelSelection();
      else if (command === 'tab') { activeTab = commandEl.dataset.gaiaTab; render(); }
      else if (command === 'federation') { federationMode = true; selectedOption = null; selectedHex = null; activeTab = 'galaxy'; render(); }
      else if (command === 'form-federation') { dispatch(payment({type:'federation', hexes:[...federationHexes], token:panel.querySelector('#gaiaFederationToken').value})); }
      else if (command === 'zoom-in') { mapZoom = Math.min(3, mapZoom + .5); render(); }
      else if (command === 'zoom-out') { mapZoom = Math.max(1, mapZoom - .5); render(); }
      else if (command === 'fit') { mapZoom = 1; mapCenter = null; render(); }
      return;
    }
    if (event.target.closest('input,select,label,summary,details,a')) return;
    if (selectedHex || selectedOption !== null || federationMode) cancelSelection();
  });
  panel?.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-gaia-hex]')) {
      event.preventDefault(); event.target.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    }
  });
  panel?.addEventListener('pointerdown', event => {
    const svg = event.target.closest('#gaiaGalaxy');
    if (!svg || mapZoom <= 1 || explainMode) return;
    const box = svg.viewBox.baseVal;
    drag = {x:event.clientX, y:event.clientY, moved:false, svg, center:[box.x+box.width/2,box.y+box.height/2], scale:box.width/svg.getBoundingClientRect().width};
  });
  panel?.addEventListener('pointermove', event => {
    if (!drag || !event.buttons) return;
    const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
    if (Math.abs(dx)+Math.abs(dy) < 6) return;
    drag.moved = true;
    mapCenter = [drag.center[0]-dx*drag.scale,drag.center[1]-dy*drag.scale];
    const box = drag.svg.viewBox.baseVal;
    drag.svg.setAttribute('viewBox', `${mapCenter[0]-box.width/2} ${mapCenter[1]-box.height/2} ${box.width} ${box.height}`);
  });
  document.addEventListener('pointerup', () => { if (drag?.moved) suppressClickUntil = Date.now()+150; drag = null; });
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
    if (event.key === 'Escape') { closeModal(); setExplain(false); if (view && !panel.classList.contains('hidden')) cancelSelection(); }
    if (event.key === 'Tab' && modal) {
      const focusable=[...modal.querySelectorAll('button,a,summary,input,select')];
      const first=focusable[0], last=focusable[focusable.length-1];
      if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
    }
  });
  help?.addEventListener('click', showHelp);
  explainButton?.addEventListener('click', () => { closeModal(); setExplain(!explainMode); });
  window.showGaiaProjectHeaderActions = show => {
    if (header) header.style.display = show ? 'flex' : 'none';
    if (!show) { setExplain(false); closeModal(); }
  };
  window.clearGaiaProjectState = () => {
    view=null; selectedHex=null; selectedOption=null; viewKey=''; federationMode=false; federationHexes.clear(); activeTab='galaxy'; mapZoom=1; mapCenter=null; setExplain(false); closeModal(); if (panel) panel.innerHTML='';
  };
  window.renderGaiaProjectGameState = data => {
    const next = data.view;
    const key = `${data.room_id}|${data.state_version ?? ''}|${next.round}|${next.phase}|${next.current_turn}|${JSON.stringify(next.pending)}|${next.log.length}|${next.main_done}`;
    if (key !== viewKey) { selectedOption=null; federationMode=false; federationHexes.clear(); }
    if (viewKey && viewKey.split('|')[0] !== String(data.room_id)) { selectedHex=null; activeTab='galaxy'; mapZoom=1; mapCenter=null; }
    viewKey=key; view=next;
    if (currentGameType !== 'gaia_project') { currentGameType='gaia_project'; setGamePanelVisibility('gaia_project'); }
    if (view.phase==='faction' && activeTab==='galaxy') activeTab='players';
    if (view.phase==='placement' && !selectedHex) activeTab='galaxy';
    render();
    if (typeof logGameEvents === 'function') logGameEvents(data);
  };
})();
