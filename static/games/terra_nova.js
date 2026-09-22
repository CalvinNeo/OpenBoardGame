(() => {
  "use strict";

  const TERRAIN = {
    lake: { label: "湖泊", emoji: "💧", color: "#89b7c9" },
    forest: { label: "森林", emoji: "🌲", color: "#91af7b" },
    wasteland: { label: "荒地", emoji: "🌋", color: "#c88876" },
    desert: { label: "沙漠", emoji: "☀️", color: "#dccc85" },
    swamp: { label: "沼泽", emoji: "🌑", color: "#9c9ba1" },
    river: { label: "河流", emoji: "〰", color: "#c1e1df" },
  };
  const FACTION_ICONS = {
    water_sprites: "💧", sea_dogs: "🦦", golems: "🗿", fire_sprites: "🔥",
    leprechauns: "🍀", inventors: "⚙️", fairies: "🧚", druids: "🌿",
    sun_worshippers: "☀️", sand_cats: "🐈",
    djinn: "💧", merfolk: "🦦", ifrits: "🔥", goblins: "🍀", felines: "🐈",
  };
  const BUILDINGS = {
    house: { label: "房屋", emoji: "🏠", power: 1 },
    trading_post: { label: "贸易站", emoji: "🏪", power: 2 },
    palace_left: { label: "左宫殿", emoji: "🏰", power: 3 },
    palace_right: { label: "右宫殿", emoji: "🏰", power: 3 },
  };
  const PHASES = {
    choose_faction: "选择种族", setup_house: "建立家园", choose_bonus: "选择奖励片",
    action: "行动阶段", post_action: "行动结算", terraform: "地形改造", town_choice: "建立城镇", palace_choice: "宫殿能力",
    round_end: "本轮回顾", game_over: "终局结算",
  };
  const ACTION_META = {
    choose_faction: ["🌿", "种族"], setup_house: ["🏠", "初始房屋"],
    build: ["🏠", "建造"], build_house: ["🏠", "建造"], terraform: ["⛏️", "改造"],
    transform: ["⛏️", "改造"], transform_build: ["⛏️", "改造并建造"],
    upgrade: ["🏰", "升级"], upgrade_building: ["🏰", "升级"],
    shipping: ["⛵", "航运"], advance_shipping: ["⛵", "航运"], upgrade_sailing: ["⛵", "航运"],
    bridge: ["🌉", "桥梁"], build_bridge: ["🌉", "桥梁"],
    power_action: ["🟣", "魔力行动"], convert_power: ["💰", "魔力换金"],
    burn_power: ["🟣", "转化魔力"], faction_action: ["✨", "种族能力"],
    bonus_action: ["🎁", "奖励行动"], choose_bonus: ["🎁", "奖励片"],
    build_transform: ["⛏️", "改造 / 建造"], terraform_target: ["⛏️", "使用铲子"],
    terraform_build: ["🏠", "在已改造地格建屋"],
    start_terraform: ["⛏️", "铲子行动"], finish_terraform: ["✓", "完成改造"],
    advance_sailing: ["⛵", "提升航运"], power_coins: ["💰", "魔力換金"],
    exchange_power: ["🟣", "兑换金币"], druid_exchange: ["🌿", "魔力换分"],
    found_water_town: ["🏘️", "水上城镇"], skip_palace: ["→", "跳过能力"], end_turn: ["✓", "End Turn"],
    choose_town: ["🏘️", "城镇奖励"], town_choice: ["🏘️", "城镇奖励"],
    pass: ["🍂", "退出本轮"], next_round: ["→", "Next Round"],
  };
  const EXPLANATIONS = {
    map: ["大地地图", "在可达地形上改造(⛏️)、建造房屋(🏠)，或选择已有建筑升级。发光轮廓表示当前有合法行动。淡虚线是预设桥位；选择桥梁(🌉)行动后，可建桥位会高亮，选择卡片后显示两端坐标。直接相邻与桥梁连接可用于城镇；航运(⛵)使你跨越河流扩张。地图区域支持拖动、双指缩放和 + / −；Reset 恢复完整地图。"],
    rounds: ["五轮计分", "游戏共有五轮；每轮计分片指定某种行动及其奖励分数(⭐)。只有在对应轮完成该行动才获得此奖励。五轮计分片始终公开，便于规划。"],
    players: ["玩家资源与建筑", "金币(💰)支付建造等费用。魔力(🟣)在 I、II、III 三碗之间循环；III 碗中的魔力可以支付。航运(⛵)表示可跨越的河流距离。房屋(🏠)、贸易站(🏪)、左/右宫殿(🏰)显示在地图上的数量。分数(⭐)为当前已获得分数。"],
    actions: ["当前行动", "轮到你时执行一次主要行动，然后轮到下一位尚未退出的玩家。先选地图格或行动类别，再选一张行动卡并 Confirm；Cancel、Esc 或点击空白可取消。金币、目标、建筑供应、每轮次数和特殊条件决定哪些选项可用。"],
    power: ["魔力(🟣)", "获得魔力时先将 I 碗中的魔力移至 II；I 碗清空后才从 II 移至 III。支付魔力时将 III 碗的魔力返回 I。相邻玩家建造或升级时，你的每座相邻建筑提供 1 点魔力，与建筑力量无关。III 碗魔力可按 1:1 兑换金币(💰)，不占主要行动。"],
    faction: ["种族与宫殿", "十个种族分属五种原生地形；每种颜色只能由一位玩家使用。初始能力始终生效，左宫殿(🏰)和右宫殿(🏰)建成后激活对应能力。建筑的收入来自你已建出的建筑；升级会把旧建筑回收到供应。"],
    bonus: ["奖励片(🎁)", "每位玩家持有一片奖励片，可能提供收入、特殊行动、航运(⛵)或退出计分。退出本轮时领取尚可用的新奖励片并归还旧片；第五轮也会换片并领取积累的金币。未被选择的奖励片积累金币(💰)。"],
    town: ["城镇(🏘️)", "由直接相邻或桥梁(🌉)相连的建筑群达到城镇要求时立即建立城镇，并选择一片自己尚未使用的城镇奖励。通常至少四座建筑、总力量至少七；种族能力可能改变要求。房屋(🏠)力量1、贸易站(🏪)力量2、宫殿(🏰)力量3。已属于城镇的建筑不能重复创镇。"],
    review: ["轮末回顾", "所有玩家退出后暂停，保留版图、资源、计分和日志。每位玩家分别点击 Next Round，所有人确认后才继续。第五轮也须全员确认，然后进行终局计分。"],
    log: ["Game Log", "显示最近发生的公开游戏事件。最新记录在上方；较长的记录会在此区域内滚动。"],
    final: ["终局计分", "最终分数(⭐)由已获分数、金币(💰)折分及最大连通区域排名奖励构成。航运(⛵)可连接跨河建筑用于最终区域；城镇的直接邻接条件不同。并列排名共享对应名次分数，向下取整。最高总分的玩家获胜，最高分并列则共同获胜。"],
  };

  let view = null;
  let active = false;
  let selectedCell = null;
  let selectedCategory = null;
  let selectedSource = null;
  let stagedAction = null;
  let pending = false;
  let pendingTimer = null;
  let explainMode = false;
  let suppressClickUntil = 0;
  let mapTransform = { x: 0, y: 0, scale: 1 };
  let mapWidth = 820;
  let mapHeight = 520;
  let mapInitialized = false;
  let modal = null;
  let modalReturnFocus = null;
  let tooltip = null;
  let tooltipTimer = null;
  let pointerState = new Map();
  let gestureStart = null;
  let gestureMoved = false;
  let gestureCell = null;
  let boardSignature = "";
  let previousPhase = "";

  const panel = document.getElementById("terraNovaPanel");
  const header = document.getElementById("terraNovaHeaderActions");
  const helpBtn = document.getElementById("terraNovaHelpBtn");
  const explainBtn = document.getElementById("terraNovaExplainBtn");
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const svgEl = (tag, attrs = {}) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };
  const byId = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const list = (value) => Array.isArray(value) ? value : Object.values(value || {});
  const directory = (key) => (view && view[key]) || {};
  const getDef = (key, id) => {
    if (id && typeof id === "object") return id;
    const defs = directory(key);
    return Array.isArray(defs) ? defs.find((item) => item.id === id) || {} : defs[id] || {};
  };
  const nameOf = (item, fallback = "") => item.name_zh || item.label || item.name || item.title || fallback;
  const players = () => Object.entries((view && view.players) || {}).map(([id, item]) => ({ id, ...item }));
  const player = (id) => players().find((item) => item.id === id || item.player_id === id) || {};
  const myId = () => view && (view.you || view.player_id || view.viewer_id);
  const playerName = (id) => player(id).name || id || "—";
  const options = () => (view && view.action_options) || [];
  const factionDef = (faction) => getDef("factions", faction);
  const factionTerrain = (faction) => {
    const def = factionDef(faction);
    return def.terrain || def.home_terrain || def.home || "forest";
  };
  const factionColor = (faction) => (TERRAIN[factionTerrain(faction)] || TERRAIN.forest).color;
  const cellIds = (option) => {
    const action = option.action || {};
    return [...new Set([...(option.cell_ids || []), option.cell_id, action.cell_id, action.from_cell, action.to_cell, ...(action.cell_ids || [])].filter((id) => id !== undefined && id !== null).map(String))];
  };
  const bridgeSitesForCell = (id) => list(view && view.bridge_sites).filter((site) => (site.cell_ids || []).map(String).includes(String(id)));
  const actionType = (option) => (option.action || {}).type || option.type || "action";
  const actionMeta = (option) => ACTION_META[actionType(option)] || ["✦", option.category || "行动"];
  const localize = (text) => String(text || "")
    .replace(/Start house/g, "初始房屋").replace(/Build house/g, "建造房屋")
    .replace(/Transform terrain/g, "改造地形").replace(/Trading post/g, "贸易站")
    .replace(/Free trading post/g, "免费贸易站").replace(/palace left/g, "左宫殿").replace(/palace right/g, "右宫殿")
    .replace(/Advance sailing/g, "提升航运").replace(/Gain 7 coins/g, "获得 7 金币")
    .replace(/One free spade/g, "免费一铲").replace(/Two free spades/g, "免费两铲")
    .replace(/Bonus tile: one free spade/g, "奖励片：免费一铲").replace(/Fairy spade/g, "仙灵铲子")
    .replace(/Found river town/g, "建立水上城镇").replace(/Skip free house/g, "跳过免费房屋")
    .replace(/Finish terraforming/g, "完成地形改造").replace(/Bridge/g, "桥梁").replace(/^Pass · /, "退出 · ")
    .replace(/Gain (\d+) passing points and take this tile for the next round\./, "获得 $1 退出分，并领取此奖励片及积累金币。")
    .replace(/(\d+) spade\(s\); (lake|forest|wasteland|desert|swamp)\./, (_, amount, terrain) => `需要 ${amount} 铲子(⛏️)，改造为${TERRAIN[terrain].label}(${TERRAIN[terrain].emoji})。`);
  const optionLabel = (option) => localize(option.label || actionMeta(option)[1]);
  const actionKey = (option) => JSON.stringify(option.action || option);
  const explanation = (node, key, body) => {
    node.dataset.tnExplain = key;
    if (body) node.dataset.tnExplanation = body;
    return node;
  };
  const tip = (node, text) => {
    node.dataset.tnTip = text;
    node.setAttribute("tabindex", "0");
    return node;
  };
  const button = (label, handler, className = "", explainKey = "actions", body = "") => {
    const node = explanation(el("button", className, label), explainKey, body);
    node.type = "button";
    if (handler) node.addEventListener("click", handler);
    return node;
  };

  function mount() {
    if (!panel || mapInitialized) return;
    panel.innerHTML = `
      <div class="tn-topbar">
        <div class="tn-brand"><div class="tn-brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 3 35 12v17L20 38 5 29V12Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m9 26 8-13 7 9 4-5 5 10H9Z" fill="currentColor"/><circle cx="28" cy="11" r="3" fill="currentColor"/></svg></div><div><div class="tn-kicker">A new land awaits</div><h2>Terra Nova</h2></div></div>
        <div class="tn-status" id="terraNovaStatus" aria-live="polite"></div>
      </div>
      <div class="tn-rounds" id="terraNovaRounds" data-tn-explain="rounds"></div>
      <div class="tn-players" id="terraNovaPlayers" data-tn-explain="players"></div>
      <div id="terraNovaReview"></div>
      <div class="tn-main">
        <section class="tn-board-panel">
          <div class="tn-section-top"><div><div class="tn-kicker">The shared world</div><h3>神秘小地</h3></div><div class="tn-map-controls"><button type="button" id="terraNovaZoomOut" aria-label="Zoom out" data-tn-explain="map">−</button><button type="button" id="terraNovaZoomIn" aria-label="Zoom in" data-tn-explain="map">+</button><button type="button" id="terraNovaResetMap" data-tn-explain="map">Reset</button></div></div>
          <div class="tn-map-viewport" id="terraNovaMapViewport"><svg id="terraNovaMap" class="tn-map-svg" role="group" aria-label="神秘小地六角地图"></svg></div>
          <div class="tn-map-caption"><span>Drag to pan · Pinch to zoom</span><span id="terraNovaMapHint"></span></div>
          <div class="tn-legend" id="terraNovaLegend"></div>
          <div class="tn-shared-actions" id="terraNovaSharedActions"></div>
        </section>
        <aside class="tn-sidebar"><section class="tn-actions-panel" id="terraNovaActionsPanel" data-tn-explain="actions"><div class="tn-actions-head"><h3 id="terraNovaActionTitle">行动</h3><span class="tn-action-count" id="terraNovaActionCount"></span></div><p class="tn-action-hint" id="terraNovaActionHint"></p><div id="terraNovaCellDetail"></div><div id="terraNovaCategories" class="tn-action-categories"></div><div id="terraNovaConfirmation"></div><div id="terraNovaActions" class="tn-action-grid"></div></section><section class="tn-detail-panel" id="terraNovaFaction" data-tn-explain="faction"></section></aside>
      </div>
      <section class="tn-log-panel"><div class="tn-section-top"><h3 data-tn-explain="log">Game Log</h3><span class="tn-kicker">Latest first</span></div><div class="tn-log" id="terraNovaLog"></div></section>
      <div class="tn-sr-only" id="terraNovaLive" aria-live="polite"></div>`;
    byId("terraNovaZoomOut").addEventListener("click", () => zoomMap(mapTransform.scale / 1.3));
    byId("terraNovaZoomIn").addEventListener("click", () => zoomMap(mapTransform.scale * 1.3));
    byId("terraNovaResetMap").addEventListener("click", () => { mapTransform = { x: 0, y: 0, scale: 1 }; updateMapTransform(); });
    const legend = byId("terraNovaLegend");
    Object.entries(TERRAIN).forEach(([id, terrain]) => {
      const item = tip(el("span", "tn-legend-item"), `${terrain.label}(${terrain.emoji})${id === "river" ? "：河流不能建造；航运可跨越。" : "：可改造成你的原生地形后建造。"}`);
      const swatch = el("span", "tn-swatch");
      swatch.style.setProperty("--tn-terrain-color", terrain.color);
      item.append(swatch, el("span", "", `${terrain.emoji} ${terrain.label}`));
      legend.append(item);
    });
    const bridges = tip(el("span", "tn-legend-item"), "桥梁(🌉)：淡虚线显示全部预设桥位；选择地格可查看它连接的另一岸。只有这些位置可以建桥。");
    bridges.append(el("span", "tn-bridge-legend", "⋯"), el("span", "", "桥位"));
    legend.append(bridges);
    installMapGestures();
    panel.addEventListener("click", (event) => {
      if (event.target.closest("button, [data-tn-cell], [data-tn-tip]")) return;
      clearSelection();
    });
    mapInitialized = true;
  }

  function send(option) {
    if (pending || !option) return;
    const current = options().find((item) => actionKey(item) === actionKey(option));
    if (!current) { clearSelection(); return; }
    pending = true;
    stagedAction = null; selectedCell = null; selectedCategory = null; selectedSource = null;
    hideTooltip();
    renderMap(); renderActions();
    if (typeof sendAction === "function") sendAction(current.action);
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => { pending = false; renderActions(); }, 4000);
  }

  function renderStatus() {
    const target = byId("terraNovaStatus");
    target.replaceChildren();
    target.append(el("span", "tn-badge", `第 ${view.round || 1} / 5 轮`));
    target.append(el("span", "tn-badge", PHASES[view.phase] || "行动中"));
    if (view.current_turn && !["round_end", "game_over"].includes(view.phase)) {
      target.append(el("span", `tn-badge${view.current_turn === myId() ? " tn-turn" : ""}`, view.current_turn === myId() ? "Your turn" : `${playerName(view.current_turn)} 的回合`));
    }
  }

  function scoringTiles() {
    const source = view.round_scoring || view.scoring_tiles || view.round_tile_order || view.rounds || [];
    if (Array.isArray(source)) return source;
    return Object.values(source);
  }

  function renderRounds() {
    const target = byId("terraNovaRounds");
    target.replaceChildren();
    const rounds = scoringTiles();
    for (let index = 0; index < 5; index += 1) {
      const id = rounds[index];
      const def = getDef("round_tiles", id);
      const current = index + 1 === Number(view.round || 1);
      const item = explanation(el("div", `tn-round${current ? " tn-current" : ""}${index + 1 < view.round ? " tn-complete" : ""}`), "rounds", def.description || def.text || "");
      item.append(el("div", "tn-round-number", `ROUND ${index + 1}`));
      item.append(el("div", "tn-round-label", nameOf(def, "计分片")));
      if (def.points || def.vp || def.score) item.append(el("div", "tn-round-points", `⭐ ${def.points || def.vp || def.score} / 次`));
      else if (def.description || def.text) item.append(el("div", "tn-round-points", def.description || def.text));
      tip(item, `${nameOf(def, `第${index + 1}轮`)}：${def.description || def.text || "本轮完成对应行动时获得奖励分数(⭐)。"}`);
      target.append(item);
    }
  }

  function resource(emoji, value, text) {
    return tip(el("span", "tn-resource", `${emoji} ${value ?? 0}`), text);
  }

  function renderPlayers() {
    const target = byId("terraNovaPlayers");
    target.replaceChildren();
    const order = view.turn_order || view.player_order || players().map((item) => item.id);
    order.forEach((id) => {
      const item = player(id);
      if (!item.id) return;
      const faction = factionDef(item.faction);
      const card = el("article", `tn-player${id === myId() ? " tn-is-you" : ""}${id === view.current_turn && !item.passed ? " tn-is-active" : ""}`);
      card.style.setProperty("--tn-player-color", item.faction ? factionColor(item.faction) : "#b3bba6");
      const top = el("div", "tn-player-head");
      top.append(el("div", "tn-player-name", `${item.name || id}${id === myId() ? " · You" : ""}`), tip(el("span", "tn-player-score", `⭐ ${item.score ?? 0}`), "分数(⭐)：当前已获得的分数，终局另加资源和区域得分。"));
      card.append(top, tip(el("div", "tn-player-faction", `${FACTION_ICONS[item.faction] || "🌱"} ${nameOf(faction, item.faction ? "种族" : "尚未选择")}${item.passed ? " · 已退出" : ""}`), item.faction ? `${nameOf(faction)}：${faction.ability || "在原生地形建造。"}` : "选择种族后，原生地形和独特能力会显示在这里。"));
      const resources = el("div", "tn-resource-line");
      resources.append(resource("💰", item.coins, "金币(💰)：支付改造、建造、升级、航运及桥梁费用。"), resource("⛵", item.sailing ?? item.shipping, "航运(⛵)：可连续跨越的河流格数。"));
      const power = Array.isArray(item.power) ? { I: item.power[0], II: item.power[1], III: item.power[2] } : item.power || {};
      const bowls = explanation(tip(el("span", "tn-power"), `魔力(🟣)：I 碗 ${power.I || 0}、II 碗 ${power.II || 0}、III 碗 ${power.III || 0}；III 碗可支付。`), "power");
      bowls.append(el("span", "", "🟣"));
      ["I", "II", "III"].forEach((key) => bowls.append(el("span", "tn-bowl", power[key] || 0)));
      resources.append(bowls);
      card.append(resources);
      const buildings = el("div", "tn-player-buildings");
      Object.entries(BUILDINGS).forEach(([kind, def]) => {
        const count = item.buildings && item.buildings[kind] !== undefined ? item.buildings[kind] : (view.board || []).filter((cell) => cell.owner === id && cell.building === kind).length;
        buildings.append(resource(def.emoji, count, `${def.label}(${def.emoji})：${count} 座；每座建筑力量 ${def.power}。${kind.includes("palace") ? "建成后激活对应种族能力。" : ""}`));
      });
      card.append(buildings);
      target.append(card);
    });
  }

  function cellCenter(cell) {
    const radius = 24;
    return { x: 29 + Number(cell.col) * Math.sqrt(3) * radius + (Number(cell.row) % 2) * Math.sqrt(3) * radius / 2, y: 29 + Number(cell.row) * radius * 1.5 };
  }

  function bridgeGeometry(centers, ends) {
    const a = centers[String(ends[0])]; const b = centers[String(ends[1])];
    if (!a || !b) return null;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (!distance) return null;
    const inset = Math.min(17, distance / 3);
    return { x1: a.x + (b.x - a.x) * inset / distance, y1: a.y + (b.y - a.y) * inset / distance, x2: b.x - (b.x - a.x) * inset / distance, y2: b.y - (b.y - a.y) * inset / distance };
  }

  function renderMap() {
    const svg = byId("terraNovaMap");
    if (!svg) return;
    svg.replaceChildren();
    const board = view.board || [];
    const centers = Object.fromEntries(board.map((cell) => [String(cell.id), cellCenter(cell)]));
    mapWidth = Math.max(350, ...Object.values(centers).map((point) => point.x + 29));
    mapHeight = Math.max(230, ...Object.values(centers).map((point) => point.y + 29));
    svg.setAttribute("viewBox", `0 0 ${mapWidth} ${mapHeight}`);
    const group = svgEl("g", { id: "terraNovaMapLayer" });
    svg.append(group);
    const legal = new Set(options().filter((option) => (!selectedCategory || actionType(option) === selectedCategory) && (!selectedSource || (option.action || {}).source === selectedSource)).flatMap(cellIds));
    const previewCells = new Set(stagedAction ? cellIds(stagedAction) : []);
    const bridgeOptions = options().filter((option) => actionType(option) === "build_bridge" && (!selectedSource || (option.action || {}).source === selectedSource));
    const bridgeMode = selectedCategory === "build_bridge" || (stagedAction && actionType(stagedAction) === "build_bridge");
    const legalBridges = new Set(bridgeOptions.map((option) => (option.action || {}).bridge_id));
    const selectedBridge = stagedAction && actionType(stagedAction) === "build_bridge" ? stagedAction.action.bridge_id : null;
    board.forEach((cell) => {
      const point = centers[String(cell.id)];
      const terrain = TERRAIN[cell.terrain] || TERRAIN.forest;
      const definition = BUILDINGS[cell.building];
      const connections = bridgeSitesForCell(cell.id).flatMap((site) => site.cell_ids.filter((id) => String(id) !== String(cell.id)));
      const cellLabel = `${cell.id} · ${terrain.label}(${terrain.emoji})${cell.owner ? ` · ${playerName(cell.owner)}的${definition ? `${definition.label}(${definition.emoji})` : "建筑"}` : ""}${cell.town_id ? " · 已属城镇(🏘️)" : ""}${connections.length ? ` · 预设桥位(🌉)可连 ${connections.join("、")}` : ""}`;
      const node = svgEl("g", { class: `tn-cell${legal.has(String(cell.id)) ? " tn-legal" : ""}${selectedCell === String(cell.id) ? " tn-selected" : ""}${previewCells.has(String(cell.id)) ? " tn-preview" : ""}`, "data-tn-cell": cell.id, "data-cell-id": cell.id, "data-tn-explain": "map", "data-tn-explanation": cellLabel, role: "button", tabindex: "0", "aria-label": cellLabel, "aria-pressed": selectedCell === String(cell.id) ? "true" : "false" });
      const points = Array.from({ length: 6 }, (_, i) => { const angle = (60 * i - 30) * Math.PI / 180; return `${point.x + 23.2 * Math.cos(angle)},${point.y + 23.2 * Math.sin(angle)}`; }).join(" ");
      node.append(svgEl("polygon", { points, class: "tn-hex", fill: terrain.color }));
      const title = svgEl("title"); title.textContent = cellLabel; node.append(title);
      if (cell.owner) {
        node.append(svgEl("circle", { cx: point.x, cy: point.y - 1, r: 15, fill: factionColor(player(cell.owner).faction), class: "tn-owner-mark" }));
      }
      const glyph = svgEl("text", { x: point.x, y: point.y + (cell.owner ? 5 : 3), "text-anchor": "middle", class: cell.owner ? "tn-building-glyph" : "tn-terrain-glyph" });
      glyph.textContent = definition ? definition.emoji : terrain.emoji;
      node.append(glyph);
      const coord = svgEl("text", { x: point.x, y: point.y + 17, "text-anchor": "middle", class: "tn-cell-id" }); coord.textContent = cell.id; node.append(coord);
      if (cell.town_id) {
        node.append(svgEl("circle", { cx: point.x + 14, cy: point.y - 12, r: 6, fill: "#4d653c" }));
        const marker = svgEl("text", { x: point.x + 14, y: point.y - 9, "text-anchor": "middle", class: "tn-town-mark" }); marker.textContent = "✓"; node.append(marker);
      }
      node.addEventListener("click", (event) => {
        if (Date.now() < suppressClickUntil || explainMode) return;
        event.stopPropagation();
        selectedCell = selectedCell === String(cell.id) ? null : String(cell.id);
        stagedAction = null;
        renderMap(); renderActions();
      });
      node.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (explainMode) { openExplanation(node); return; }
        selectedCell = String(cell.id); stagedAction = null; renderMap(); renderActions();
        byId("terraNovaActionTitle").scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      group.append(node);
    });
    const builtIds = new Set((view.bridges || []).map((bridge) => bridge.id));
    list(view.bridge_sites).forEach((site) => {
      if (builtIds.has(site.id)) return;
      const points = bridgeGeometry(centers, site.cell_ids || []);
      if (!points) return;
      const selected = site.id === selectedBridge;
      const relevant = bridgeMode && legalBridges.has(site.id);
      const line = svgEl("g", { class: `tn-bridge-site${relevant ? " tn-available" : ""}${selected ? " tn-bridge-selected" : ""}`, "data-bridge-site": site.id, "pointer-events": "none" });
      line.append(svgEl("line", { ...points, class: "tn-bridge-site-line" }));
      [[points.x1, points.y1], [points.x2, points.y2]].forEach(([x, y]) => line.append(svgEl("circle", { cx: x, cy: y, r: selected ? 3.2 : 2, class: "tn-bridge-endpoint" })));
      if (selected) {
        const x = (points.x1 + points.x2) / 2; const y = (points.y1 + points.y2) / 2;
        const label = svgEl("text", { x, y: y - 6, "text-anchor": "middle", class: "tn-bridge-coordinates" });
        label.textContent = site.cell_ids.join(" ↔ ");
        line.append(label);
      }
      group.append(line);
    });
    (view.bridges || []).forEach((bridge) => {
      const ends = Array.isArray(bridge) ? bridge : bridge.cells || bridge.cell_ids || [bridge.from || bridge.a, bridge.to || bridge.b];
      const linePoints = bridgeGeometry(centers, ends);
      if (!linePoints) return;
      const line = svgEl("g", { "pointer-events": "none" });
      line.append(svgEl("line", { ...linePoints, class: "tn-bridge" }), svgEl("line", { ...linePoints, class: "tn-bridge-highlight" }));
      group.append(line);
    });
    byId("terraNovaMapHint").textContent = selectedBridge ? `🌉 ${cellIds(stagedAction).join(" ↔ ")}` : bridgeMode ? `${legalBridges.size} 处可建桥位` : selectedCell ? `已选择 ${selectedCell}` : legal.size ? `${legal.size} 个可选地格` : "五种地形 · 一个新世界";
    updateMapTransform();
  }

  function updateMapTransform() {
    mapTransform.x = Math.max(-mapWidth * mapTransform.scale + mapWidth * .22, Math.min(mapWidth * .78, mapTransform.x));
    mapTransform.y = Math.max(-mapHeight * mapTransform.scale + mapHeight * .22, Math.min(mapHeight * .78, mapTransform.y));
    const group = byId("terraNovaMapLayer");
    if (group) group.setAttribute("transform", `translate(${mapTransform.x} ${mapTransform.y}) scale(${mapTransform.scale})`);
    const out = byId("terraNovaZoomOut"); const into = byId("terraNovaZoomIn");
    if (out) out.disabled = mapTransform.scale <= 1;
    if (into) into.disabled = mapTransform.scale >= 3.5;
  }

  function zoomMap(scale, center = { x: mapWidth / 2, y: mapHeight / 2 }) {
    const next = Math.max(1, Math.min(3.5, scale));
    const ratio = next / mapTransform.scale;
    mapTransform.x = center.x - (center.x - mapTransform.x) * ratio;
    mapTransform.y = center.y - (center.y - mapTransform.y) * ratio;
    mapTransform.scale = next;
    if (next === 1) { mapTransform.x = 0; mapTransform.y = 0; }
    updateMapTransform();
  }

  function mapPoint(clientX, clientY) {
    const svg = byId("terraNovaMap");
    const matrix = svg && svg.getScreenCTM();
    if (!matrix) return { x: clientX, y: clientY };
    const point = svg.createSVGPoint(); point.x = clientX; point.y = clientY;
    return point.matrixTransform(matrix.inverse());
  }

  function startGesture() {
    const pointers = [...pointerState.values()];
    const a = pointers[0]; const b = pointers[1];
    if (!a) { gestureStart = null; return; }
    const center = b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
    gestureStart = { center, distance: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0, transform: { ...mapTransform } };
  }

  function installMapGestures() {
    const viewport = byId("terraNovaMapViewport");
    viewport.addEventListener("pointerdown", (event) => {
      if (explainMode || (event.pointerType === "mouse" && event.button !== 0)) return;
      if (!pointerState.size) {
        gestureMoved = false;
        const cell = event.target.closest("[data-tn-cell]");
        gestureCell = cell ? cell.dataset.tnCell : null;
      } else { gestureMoved = true; gestureCell = null; }
      pointerState.set(event.pointerId, mapPoint(event.clientX, event.clientY));
      viewport.setPointerCapture(event.pointerId);
      startGesture();
      hideTooltip();
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!pointerState.has(event.pointerId) || !gestureStart) return;
      pointerState.set(event.pointerId, mapPoint(event.clientX, event.clientY));
      const pointers = [...pointerState.values()];
      const a = pointers[0]; const b = pointers[1];
      const center = b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
      const dx = center.x - gestureStart.center.x; const dy = center.y - gestureStart.center.y;
      if (!gestureMoved && !b && Math.hypot(dx, dy) < 5) return;
      gestureMoved = true;
      viewport.classList.add("tn-dragging");
      const ratio = b && gestureStart.distance > 0 ? Math.hypot(a.x - b.x, a.y - b.y) / gestureStart.distance : 1;
      const nextScale = Math.max(1, Math.min(3.5, gestureStart.transform.scale * ratio));
      const actualRatio = nextScale / gestureStart.transform.scale;
      mapTransform = { scale: nextScale, x: center.x - (gestureStart.center.x - gestureStart.transform.x) * actualRatio, y: center.y - (gestureStart.center.y - gestureStart.transform.y) * actualRatio };
      updateMapTransform();
      event.preventDefault();
    });
    const end = (event) => {
      if (!pointerState.has(event.pointerId)) return;
      pointerState.delete(event.pointerId);
      if (gestureMoved) suppressClickUntil = Date.now() + 450;
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      if (!pointerState.size) {
        viewport.classList.remove("tn-dragging"); gestureStart = null;
        if (!gestureMoved && event.type === "pointerup") {
          suppressClickUntil = Date.now() + 450;
          selectedCell = selectedCell === gestureCell ? null : gestureCell;
          stagedAction = null;
          if (!gestureCell) selectedCategory = selectedSource = null;
          renderMap(); renderActions();
        }
        gestureCell = null;
      }
      else startGesture();
    };
    viewport.addEventListener("pointerup", end);
    viewport.addEventListener("pointercancel", end);
    viewport.addEventListener("lostpointercapture", end);
    viewport.addEventListener("wheel", (event) => {
      if (explainMode) return;
      event.preventDefault();
      zoomMap(mapTransform.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), mapPoint(event.clientX, event.clientY));
    }, { passive: false });
  }

  function optionDefinition(option) {
    const action = option.action || {};
    const type = actionType(option);
    if (type.includes("faction") && type.includes("choose")) return { def: factionDef(action.faction || action.faction_id), kind: "faction", id: action.faction || action.faction_id };
    if (type.includes("town")) return { def: getDef("town_tiles", action.tile_id || action.town_tile || action.town_id || action.tile), kind: "town" };
    if (type.includes("bonus") || type === "pass") return { def: getDef("bonus_tiles", action.bonus_tile || action.bonus_id || action.tile_id || action.bonus || action.tile), kind: "bonus" };
    return { def: {}, kind: "action" };
  }

  function descriptionOf(option) {
    const { def, kind } = optionDefinition(option);
    const detail = kind === "bonus" ? bonusDescription(def) : kind === "town" ? townDescription(def) : def.description || def.text || def.ability || "";
    const source = sourceDescription(option);
    return localize([...new Set([source, option.description, detail].filter(Boolean))].join(" "));
  }

  function sourceDescription(option) {
    const action = option.action || {};
    const source = action.source;
    if (!source) return "";
    if (source === "paid") return action.type === "build_bridge" ? "普通建桥：支付 10 金币(💰)，使用一座桥梁(🌉)供应。" : "普通行动：支付卡面标注的金币(💰)。";
    const power = getDef("power_actions", source);
    if (power.name) {
      const cost = Number(power.power || 0) - (player(myId()).faction === "ifrits" ? 1 : 0);
      return ["terraform_target", "terraform_build"].includes(action.type) ? `来自公共魔力行动；魔力(🟣)已支付，本次余 ${view.pending ? view.pending.remaining : 0} 铲(⛏️)。` : `公共魔力行动：支付 ${cost} 魔力(🟣)，本轮该格限用一次。`;
    }
    return {
      bonus_spade: "奖励片(🎁)：每轮一次免费一铲(⛏️)，建房屋(🏠)仍支付金币(💰)。",
      fairy_spade: ["terraform_target", "terraform_build"].includes(action.type) ? "仙灵左宫殿(🏰)：魔力(🟣)已支付，使用本次免费铲(⛏️)。" : "仙灵左宫殿(🏰)：支付 2 魔力(🟣)，每轮一次免费一铲(⛏️)。",
      djinn_house: "水精灵左宫殿(🏰)：每轮一次免费建房屋(🏠)，无需可达。",
      ifrit_house: "火精灵左宫殿(🏰)：立即免费改造边缘地格并建房屋(🏠)，不计铲子(⛏️)。",
      inventor_post: "发明家左宫殿(🏰)：支付 6 魔力(🟣)，免费改造并建贸易站(🏪)，不计铲子(⛏️)。",
      desert_transform: "拜日族左宫殿(🏰)：每轮一次免费改造，不计铲子(⛏️)；建房屋(🏠)仍付 4 金币(💰)。",
      merfolk_upgrade: "海獭右宫殿(🏰)：每轮一次免费升级为贸易站(🏪)。",
    }[source] || "";
  }

  function bonusDescription(def) {
    if (def.description || def.text) return def.description || def.text;
    const parts = [];
    if (def.income) parts.push(`收入：金币(💰) ${def.income.coins || 0} · 魔力(🟣) ${def.income.power || 0}`);
    if (def.special === "spade") parts.push("每轮一次免费一铲(⛏️)，建屋仍付费");
    if (def.sailing_bonus) parts.push(`航运范围(⛵) +${def.sailing_bonus}，不提升轨道等级，不计入终局连通区域`);
    const events = { palace: "每座宫殿(🏰)", trading_post: "每座贸易站(🏪)", house: "每座房屋(🏠)", sailing: "每级航运(⛵)" };
    if (def.pass_event) parts.push(`退出时${events[def.pass_event] || def.pass_event}得 ${def.pass_points} 分(⭐)`);
    return parts.join("；");
  }

  function townDescription(def) {
    if (def.description || def.text) return def.description || def.text;
    const parts = [];
    if (def.score !== undefined) parts.push(`分数(⭐) ${def.score}`);
    if (def.coins) parts.push(`金币(💰) ${def.coins}`);
    if (def.power) parts.push(`魔力(🟣) ${def.power}`);
    if (def.sailing) parts.push(`航运(⛵)提升 ${def.sailing} 级并得轨道分`);
    return parts.join(" · ");
  }

  function showConfirm(option) {
    stagedAction = option;
    renderMap(); renderActions();
    const target = byId("terraNovaConfirmation");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderOption(option, disabled = false) {
    const data = optionDefinition(option);
    const meta = actionMeta(option);
    const selected = stagedAction && actionKey(stagedAction) === actionKey(option);
    const card = button("", () => showConfirm(option), `tn-option${selected ? " tn-chosen" : ""}${data.kind === "faction" ? " tn-faction-option" : ""}`, data.kind === "action" ? "actions" : data.kind, `${optionLabel(option)}${descriptionOf(option) ? `：${descriptionOf(option)}` : ""}`);
    card.dataset.tnAction = "option";
    card.dataset.optionIndex = String(options().findIndex((item) => actionKey(item) === actionKey(option)));
    card.dataset.actionType = actionType(option);
    if (data.kind === "faction") card.style.setProperty("--tn-faction-color", factionColor(data.id));
    if (["faction", "town", "bonus"].includes(data.kind)) card.append(el("span", "tn-option-emoji", data.kind === "faction" ? FACTION_ICONS[data.id] || "🌿" : data.kind === "town" ? "🏘️" : "🎁"));
    card.append(el("span", "tn-option-title", `${data.kind === "action" ? `${meta[0]} ` : ""}${optionLabel(option)}`));
    const description = descriptionOf(option);
    if (description) card.append(el("span", "tn-option-detail", description));
    else if (cellIds(option).length) card.append(el("span", "tn-option-detail", cellIds(option).join(" ↔ ")));
    if (data.kind === "faction") {
      const terrain = TERRAIN[factionTerrain(data.id)] || TERRAIN.forest;
      const used = players().some((item) => item.faction && factionTerrain(item.faction) === factionTerrain(data.id));
      card.append(el("span", "tn-option-detail", `${terrain.emoji} ${terrain.label} · ${disabled ? used ? "该颜色已使用" : "等待当前玩家" : "原生地形"}`));
    }
    card.disabled = pending || disabled;
    return card;
  }

  function renderActions() {
    if (!view || !mapInitialized) return;
    const title = byId("terraNovaActionTitle");
    const hint = byId("terraNovaActionHint");
    const target = byId("terraNovaActions");
    const categories = byId("terraNovaCategories");
    const confirm = byId("terraNovaConfirmation");
    const cellDetail = byId("terraNovaCellDetail");
    target.replaceChildren(); categories.replaceChildren(); confirm.replaceChildren(); cellDetail.replaceChildren();
    const choices = options();
    const phase = view.phase;
    title.textContent = PHASES[phase] || "当前行动";
    byId("terraNovaActionCount").textContent = pending ? "Sending…" : "";
    hint.textContent = choices.length ? (phase === "choose_faction" ? "选择你的民族，开拓独特的文明。" : phase === "setup_house" ? "在发光的原生地形上选择初始房屋位置。" : phase === "post_action" ? "可继续兑换魔力，再点击 End Turn。" : phase === "terraform" ? "选择改造目标，完成当前铲子行动。" : phase === "town_choice" ? "城镇已成立，选择一片奖励。" : phase === "choose_bonus" ? "选择本轮为你提供支持的奖励片。" : phase === "round_end" ? "可先兑换魔力；查看局面后点击 Next Round。" : "点击地格或选择行动。") : (phase === "game_over" ? "五轮旅程已结束。" : phase === "round_end" ? "已确认，等待其他玩家。" : `等待 ${playerName(view.current_turn)}。`);
    if (view.pending_choice && view.pending_choice.description) hint.textContent = view.pending_choice.description;
    if (phase === "terraform" && view.pending && view.pending.remaining === 0) hint.textContent = choices.some((option) => actionType(option) === "terraform_build") ? "铲子已用完；可在已改造地格建一屋，或选择完成改造。" : "铲子已用完，选择完成改造继续。";
    if (selectedCategory === "build_bridge") hint.textContent = "选择桥的一端，再确认两端坐标和费用。";
    if (selectedCell) {
      const cell = (view.board || []).find((item) => String(item.id) === selectedCell);
      if (cell) {
        const terrain = TERRAIN[cell.terrain] || TERRAIN.forest;
        const row = el("div", "tn-cell-detail");
        row.append(el("strong", "", `${cell.id} · ${terrain.emoji} ${terrain.label}`));
        if (cell.owner) row.append(el("small", "", `${playerName(cell.owner)} · ${(BUILDINGS[cell.building] || {}).label || "建筑"}`));
        const connections = bridgeSitesForCell(cell.id).flatMap((site) => site.cell_ids.filter((id) => String(id) !== selectedCell));
        if (connections.length) row.append(tip(el("small", "tn-cell-bridges", `🌉 桥位可连 ${connections.join(" / ")}`), "桥梁(🌉)只能修建在预设桥位；至少一端有自己的建筑且有足够资源时才会出现建桥选项。"));
        cellDetail.append(row);
      }
    }
    const spatial = choices.filter((option) => cellIds(option).length);
    const types = [...new Set(spatial.map(actionType))];
    types.forEach((type) => {
      const representative = spatial.find((option) => actionType(option) === type);
      const meta = actionMeta(representative);
      const control = button(`${meta[0]} ${meta[1]}`, () => { selectedCategory = selectedCategory === type ? null : type; selectedSource = null; selectedCell = null; stagedAction = null; renderMap(); renderActions(); }, `tn-category${selectedCategory === type ? " tn-chosen" : ""}`, "actions", `选择${meta[1]}后，地图显示可以执行该行动的地格。`);
      categories.append(control);
    });
    if (stagedAction && choices.some((option) => actionKey(option) === actionKey(stagedAction))) {
      const card = el("div", "tn-confirm");
      card.append(el("div", "tn-confirm-title", optionLabel(stagedAction)));
      if (descriptionOf(stagedAction)) card.append(el("div", "tn-confirm-detail", descriptionOf(stagedAction)));
      const controls = el("div", "tn-confirm-actions");
      const yes = button("Confirm", () => send(stagedAction), "tn-primary", "actions", "确认执行所选行动。金币、魔力和目标将再次检查。" );
      yes.dataset.tnAction = "confirm";
      yes.disabled = pending;
      controls.append(yes, button("Cancel", () => { stagedAction = null; renderMap(); renderActions(); }, "", "actions", "取消当前待确认的行动。"));
      card.append(controls); confirm.append(card);
    }
    let shown = choices.filter((option) => {
      const ids = cellIds(option);
      if (!ids.length) return !selectedCell && !selectedCategory && !selectedSource;
      if (selectedCategory && actionType(option) !== selectedCategory) return false;
      if (selectedSource && (option.action || {}).source !== selectedSource) return false;
      return selectedCell ? ids.includes(selectedCell) : false;
    });
    if (phase === "round_end") shown = shown.filter((option) => actionType(option) !== "next_round");
    target.classList.toggle("tn-one-column", shown.length > 0 && shown.every((option) => cellIds(option).length));
    shown.forEach((option) => target.append(renderOption(option)));
    if (phase === "choose_faction") {
      const offered = new Set(choices.map((option) => (option.action || {}).faction || (option.action || {}).faction_id));
      Object.entries(directory("factions")).forEach(([id, def]) => {
        if (offered.has(id)) return;
        target.append(renderOption({ label: nameOf(def, id), description: def.description || "", action: { type: "choose_faction", faction: id } }, true));
      });
    }
    if (!shown.length && phase !== "choose_faction") {
      const message = selectedCell ? "此地格当前没有可执行行动。" : spatial.length ? "✦ 点击地图中发光的地格" : phase === "game_over" ? "🏆 查看上方最终计分" : phase === "round_end" ? "所有玩家确认后继续" : "🌿 等待下一步";
      target.append(el("div", "tn-empty", message));
    }
    byId("terraNovaLive").textContent = `${title.textContent}。${hint.textContent}`;
  }

  function factionAbility(def, key) {
    const ability = def[key];
    if (typeof ability === "string") return ability;
    if (ability && typeof ability === "object") return ability.description || ability.text || ability.name || "";
    return "";
  }

  function renderFaction() {
    const target = byId("terraNovaFaction");
    target.replaceChildren();
    const me = player(myId());
    const item = me.faction ? me : player(view.current_turn);
    if (!item.faction) {
      target.append(el("div", "tn-detail-title", "🌱 五种地形，十个民族"), el("div", "tn-ability", "相同颜色的两个种族不能同时登场。"));
      return;
    }
    const def = factionDef(item.faction);
    target.append(tip(el("div", "tn-detail-title", `${FACTION_ICONS[item.faction] || "🌿"} ${nameOf(def, item.faction)}`), `${nameOf(def, item.faction)}：原生地形是${(TERRAIN[factionTerrain(item.faction)] || TERRAIN.forest).label}。`));
    const base = factionAbility(def, "ability") || factionAbility(def, "base_ability") || def.description || def.base || "";
    if (base) target.append(el("div", "tn-ability", base));
    [["palace_left", "左宫殿"], ["palace_right", "右宫殿"]].forEach(([key, name]) => {
      const text = factionAbility(def, key) || factionAbility(def, `${key}_ability`) || factionAbility(def, key === "palace_left" ? "left_ability" : "right_ability") || factionAbility(def, key === "palace_left" ? "left_palace" : "right_palace");
      if (!text) return;
      const built = item.buildings && item.buildings[key] > 0;
      const row = el("div", `tn-ability${built ? "" : " tn-locked"}`);
      row.append(el("strong", "", `🏰 ${name}${built ? " ✓" : ""} · `), document.createTextNode(text));
      target.append(row);
    });
    const bonus = getDef("bonus_tiles", item.bonus_tile);
    if (item.bonus_tile) target.append(explanation(el("div", "tn-bonus-line", `🎁 ${nameOf(bonus, item.bonus_tile)} · ${bonusDescription(bonus)}`), "bonus"));
    if (item.income && Object.keys(item.income).length) {
      const income = item.income;
      target.append(tip(el("div", "tn-bonus-line", `收入 · 💰 ${income.coins || 0} · 🟣 ${income.power || 0}`), "收入：下一轮开始时，由当前建筑、种族和奖励片提供的金币(💰)与魔力(🟣)。"));
    }
  }

  function renderSharedActions() {
    const target = byId("terraNovaSharedActions");
    target.replaceChildren();
    Object.entries(directory("power_actions")).forEach(([source, def]) => {
      const offered = options().filter((option) => (option.action || {}).source === source);
      const used = (view.power_used || []).includes(source);
      const name = localize(def.name || source);
      const cost = Number(def.power || 0) - (player(myId()).faction === "ifrits" ? 1 : 0);
      const control = button("", () => {
        if (cellIds(offered[0]).length) {
          selectedSource = source; selectedCategory = actionType(offered[0]);
          selectedCell = null; stagedAction = null; renderMap(); renderActions();
        } else showConfirm(offered[0]);
      }, `tn-shared-action${used ? " tn-used" : ""}`, "power", `${name}：支付 ${cost} 魔力(🟣)。${used ? "本轮已被使用，下一轮恢复。" : "每轮限一位玩家使用一次。"}`);
      control.append(el("span", "", name), el("strong", "", used ? "Used ✓" : `🟣 ${cost}`));
      control.disabled = pending || !offered.length;
      control.dataset.tnPowerSource = source;
      target.append(control);
    });
  }

  function renderReview() {
    const target = byId("terraNovaReview");
    target.replaceChildren();
    if (!["round_end", "game_over"].includes(view.phase)) return;
    const card = explanation(el("section", "tn-review"), view.phase === "game_over" ? "final" : "review");
    target.append(card);
    if (view.phase === "game_over") {
      const winners = view.winners || view.winner_ids || (Array.isArray(view.winner) ? view.winner : view.winner ? [view.winner] : []);
      card.append(el("div", "tn-review-title", `🏆 ${winners.length ? winners.map(playerName).join("、") : "游戏结束"}${winners.length ? " 获胜" : ""}`));
      const table = el("table", "tn-final-table");
      table.innerHTML = "<thead><tr><th>玩家</th><th>过程分</th><th>💰</th><th>区域</th><th>⭐ 总分</th></tr></thead>";
      tip(table.querySelectorAll("th")[2], "资源分：III 碗魔力(🟣)按 1:1 换金币(💰)，每 3 金币获得 1 分(⭐)。");
      tip(table.querySelectorAll("th")[4], "总分(⭐)：过程分、资源分和最大连通区域分的总和。");
      const body = el("tbody");
      const breakdown = view.final_scoring || view.final_scores || view.final_summary || {};
      players().sort((a, b) => (b.score || 0) - (a.score || 0)).forEach((item) => {
        const score = Array.isArray(breakdown) ? breakdown.find((entry) => entry.player_id === item.id || entry.id === item.id) || {} : breakdown[item.id] || {};
        const row = el("tr", winners.includes(item.id) ? "tn-winner" : "");
        [item.name || item.id, score.in_game ?? score.base_score ?? score.before ?? score.game_score ?? "—", score.resources ?? score.coin_points ?? score.resource_points ?? "—", score.area_points ?? score.network_points ?? score.area ?? "—", score.total ?? score.score ?? item.score ?? 0].forEach((value) => row.append(el("td", "", value)));
        body.append(row);
      });
      table.append(body); card.append(table);
      return;
    }
    card.append(el("div", "tn-review-title", `🍂 第 ${view.round} 轮结束`));
    const content = el("div", "tn-review-content");
    const summary = view.round_summary || {};
    players().forEach((item) => {
      const detail = Array.isArray(summary) ? summary.find((entry) => entry.player_id === item.id || entry.id === item.id) || {} : summary[item.id] || {};
      const box = el("div", "tn-review-player");
      box.append(el("strong", "", item.name || item.id), tip(el("div", "", `⭐ ${item.score} · 💰 ${item.coins}`), `分数(⭐) ${item.score}，金币(💰) ${item.coins}。`));
      if (detail.round_points !== undefined || detail.points !== undefined || detail.score_gain !== undefined) box.append(el("div", "", `本轮 +${detail.round_points ?? detail.points ?? detail.score_gain} 分`));
      content.append(box);
    });
    card.append(content);
    const ready = view.next_ready || [];
    const bottom = el("div", "tn-review-ready");
    bottom.append(el("span", "", `${ready.length} / ${players().length} ready${ready.length ? ` · ${ready.map(playerName).join("、")}` : ""}`));
    const next = options().find((option) => actionType(option).includes("next") || actionType(option).includes("continue") || actionType(option).includes("ready"));
    const control = button(ready.includes(myId()) ? "Ready ✓" : "Next Round", () => send(next), "tn-primary", "review");
    control.dataset.tnAction = "next_round";
    control.disabled = pending || !next;
    bottom.append(control); card.append(bottom);
  }

  function renderLog() {
    const target = byId("terraNovaLog");
    target.replaceChildren();
    const entries = list(view.log || view.logs || view.activity || []).slice(-60).reverse();
    if (!entries.length) target.append(el("div", "tn-log-entry", "新世界等待开拓。"));
    entries.forEach((entry) => target.append(el("div", "tn-log-entry", typeof entry === "string" ? entry : entry.message || entry.text || entry.label || "游戏状态已更新")));
  }

  function clearSelection() {
    if (!selectedCell && !selectedCategory && !selectedSource && !stagedAction) return;
    selectedCell = null; selectedCategory = null; selectedSource = null; stagedAction = null;
    if (view) { renderMap(); renderActions(); }
  }

  function incomeTrackHTML(kind, title, coins, power, slots) {
    const cells = (values) => Array.from({ length: slots }, (_, index) => `<td>${escape(values[index] ?? 0)}</td>`).join("");
    return `<table class="tn-income-table" data-tn-income="${escape(kind)}"><caption>${escape(title)}</caption><thead><tr><th>槽位</th>${Array.from({ length: slots }, (_, index) => `<th>${index + 1}</th>`).join("")}</tr></thead><tbody><tr data-resource="coins"><th>金币(💰)</th>${cells(coins)}</tr><tr data-resource="power"><th>魔力(🟣)</th>${cells(power)}</tr></tbody></table>`;
  }

  function factionHelpHTML(id, def) {
    const house = incomeTrackHTML("house", "房屋(🏠)收入 · 第 1–8 槽", def.house_income || [], def.house_power_income || [], 8);
    const trade = def.trading_post_income || [];
    const trading = incomeTrackHTML("trading_post", "贸易站(🏪)收入 · 第 1–4 槽", trade.map((entry) => entry.coins || 0), trade.map((entry) => entry.power || 0), 4);
    const leftIncome = def.palace_left_income || {};
    return `<div class="tn-help-card" data-tn-help-faction="${escape(id)}"><strong>${escape(FACTION_ICONS[id] || "🌿")} ${escape(nameOf(def, id))} · ${escape((TERRAIN[factionTerrain(id)] || TERRAIN.forest).label)}</strong><p>${escape(factionAbility(def, "ability") || factionAbility(def, "base_ability") || def.description || "")}</p><p>左宫殿(🏰)：${escape(factionAbility(def, "left_ability") || factionAbility(def, "palace_left") || factionAbility(def, "palace_left_ability") || factionAbility(def, "left_palace") || "参见种族面板")}</p><p>右宫殿(🏰)：${escape(factionAbility(def, "right_ability") || factionAbility(def, "palace_right") || factionAbility(def, "palace_right_ability") || factionAbility(def, "right_palace") || "参见种族面板")}</p><p>初始金币(💰) ${escape(def.starting_coins ?? 0)} · 初始房屋(🏠) ${escape(def.starting_houses ?? 0)}。</p><p>固定收入：金币(💰) ${escape(def.income_coins ?? 0)} / 魔力(🟣) ${escape(def.income_power ?? 0)}。左宫殿收入：金币(💰) ${escape(leftIncome.coins ?? 0)} / 魔力(🟣) ${escape(leftIncome.power ?? 0)}。</p>${house}${trading}</div>`;
  }

  function helpHTML() {
    const factionCards = Object.entries(directory("factions")).map(([id, def]) => factionHelpHTML(id, def)).join("");
    const bonusCards = Object.entries(directory("bonus_tiles")).map(([id, def]) => `<div class="tn-help-card"><strong>🎁 ${escape(nameOf(def, id))}</strong>${escape(bonusDescription(def))}</div>`).join("");
    const townCards = Object.entries(directory("town_tiles")).map(([id, def]) => `<div class="tn-help-card"><strong>🏘️ ${escape(nameOf(def, id))}</strong>${escape(townDescription(def))}</div>`).join("");
    const sailingRewards = list(directory("sailing_points")).slice(1).map((points, index) => `${index + 1} 级得 ${points} 分`).join("，");
    return `<h4>开拓自己的神秘小地</h4><p>2–4 位玩家扮演不同种族，在五轮中改造地形、发展建筑、创立城镇，争取最多分数(⭐)。地图、资源、种族能力与五轮计分片公开可见。</p>
      <h4>标记速查</h4><p>金币(💰)、魔力(🟣)、分数(⭐)、航运(⛵)、铲子(⛏️)、桥梁(🌉)、房屋(🏠)、贸易站(🏪)、左/右宫殿(🏰)、城镇(🏘️)和奖励片(🎁)。魔力的三碗按 I → II → III 排列，只有 III 碗中的魔力可以支付。地图的淡虚线是可供规划的预设桥位，实线表示已建桥梁。</p>
      <h4>准备与五轮流程</h4><ol><li>依次选择种族；同种颜色只能选一个种族。按提示顺序在原生地形放置初始房屋(🏠)，再逆序选择奖励片(🎁)。</li><li>每轮先获得建筑、奖励片及种族提供的金币(💰)与魔力(🟣)收入。</li><li>从起始玩家开始，尚未退出的玩家依次执行一次主要行动；行动次数不限，直到所有人退出。主要行动后可继续兑换魔力，再点击 End Turn。</li><li>退出时结算奖励片和种族的退出分数，并选择可用的新奖励片。第一个退出的人下轮先手；第五轮仍换片并领取片上累积金币。</li><li>本轮结束后保留局面，可先完成额外兑换；所有玩家点击 Next Round 后进入下一轮，第五轮确认后终局计分。</li></ol>
      <h4>地形与可达性</h4><p>地形环依次为湖泊(💧) → 森林(🌲) → 荒地(🌋) → 沙漠(☀️) → 沼泽(🌑) → 湖泊(💧)；河流(〰)不能建造。每个种族只在自己的原生地形建造。沿地形环的较短方向改造，通常需要 0、1 或 2 铲子(⛏️)，每铲支付 6 金币(💰)。一次改造行动可以同时建一座房屋(🏠)。免费一铲行动可按每铲 6 金币补足差额；免费两铲行动不得补钱购买更多铲子。两铲可分配给多个合法地格，但其中最多建一座房屋；所有目标都必须在本次行动开始时已经可达，不能用本次新建的房屋延伸范围。可以先改造两格，再选择其中一格付 4 金币建屋，或直接完成改造。</p><p>地块必须与你的建筑直接相邻、通过桥梁(🌉)连接，或通过航运(⛵)可达。航运等级决定可跨越的连续河流格数。邻居优惠、邻接魔力和城镇使用直接相邻／桥梁连接；最终连通区域还可以利用永久航运等级，远航奖励片的临时 +1 范围不计入终局。</p>
      <h4>主要行动与建筑</h4><p>选择改造/建造、升级、提升航运(⛵)、造桥(🌉)、公共魔力行动(🟣)、种族/奖励片的特殊行动，或退出。界面显示完整合法选择及费用，选中后 Confirm 执行。</p><table class="tn-help-table"><thead><tr><th>建筑</th><th>基础金币费用(💰)</th><th>力量</th></tr></thead><tbody><tr><td>房屋(🏠)</td><td>4；另外支付地形改造费</td><td>1</td></tr><tr><td>贸易站(🏪)</td><td>房屋升级：邻接对手 7，否则 10</td><td>2</td></tr><tr><td>宫殿(🏰)</td><td>贸易站升级：14</td><td>3</td></tr></tbody></table><p>提升一级航运(⛵)花费 8 金币并获得轨道分数(⭐)：${escape(sailingRewards)}；造桥(🌉)花费 10 金币，必须选地图预设的桥位且至少一端有自己的建筑。每人有 8 座房屋、4 座贸易站、左右宫殿各 1 座和 3 座桥。种族能力可能改变费用。旧建筑升级后回到供应，新建筑从供应取出。收入依据当前已建出的建筑计算，升级后相应收入也会改变。</p>
      <h4>建筑收入</h4><p>每个种族的房屋、贸易站及左宫殿收入可能不同，下方种族卡分别列出完整金币(💰)与魔力(🟣)收入轨。已建 N 座房屋时累加其房屋轨第 1–N 槽，贸易站同理；再加种族固定收入、已建左宫殿收入和当前奖励片收入。升级后旧建筑回到供应，对应已揭开的收入槽会重新被盖住。右宫殿提供能力，不提供常规收入。</p>
      <h4>魔力(🟣)与金币(💰)</h4><p>魔力分 I、II、III 三碗。获得魔力时先将 I 碗移到 II，I 碗清空后才从 II 移到 III；每移动一枚消耗一点获得的魔力。支付时将 III 碗的魔力返回 I。没有可移动的魔力时，多余获得值丢弃。相邻玩家建造或升级时，你的每座相邻建筑获得 1 点魔力，与建筑力量无关，无需支付分数。III 碗魔力可按 1:1 兑换金币，兑换不占主要行动；可在主要行动前、结算后和轮末确认前兑换。</p><p>公共魔力行动：3 或 4 魔力建桥(🌉)；4 魔力提升航运(⛵)；4 魔力获得 7 金币(💰)；4 魔力获得一铲(⛏️)；6 魔力获得两铲(⛏️)。每个格每轮只能由一位玩家使用一次，个人特殊行动的每轮次数单独记录，下一轮恢复。</p>
      <h4>城镇(🏘️)</h4><p>直接相邻或桥梁相连的建筑群，通常至少四座建筑、总力量至少七即可建立城镇；部分种族可以改变要求。满足条件立即选择一片自己尚未使用的城镇奖励。既有城镇中的建筑不能重复用于成立另一个城镇。城镇奖励可能提供分数(⭐)、金币(💰)、魔力(🟣)或航运(⛵)。</p>
      <h4>奖励片(🎁)与计分</h4><p>奖励片提供收入、特殊行动、航运或退出计分，具体效果见下方。本轮完成计分片指定的行动时立即获得对应奖励；退出奖励则在你退出时计算。没人领取的奖励片会累积金币，下次领取者一并获得。</p>
      <h4>终局</h4><p>五轮结束后，III 碗剩余魔力每枚换 1 金币(💰)，每 3 金币换 1 分(⭐)，不足 3 枚的余数不计分。按每位玩家最大连通区域的建筑数排名，第 1–4 名依次得 12、8、4、0 分。排名并列时平分覆盖名次的奖励，向下取整。最终界面列出过程分、资源分、区域分和总分。最高总分获胜，并列最高分共同获胜。</p>
      ${factionCards ? `<h4>十个种族及宫殿能力</h4><div class="tn-help-grid">${factionCards}</div>` : ""}
      ${bonusCards ? `<h4>奖励片完整效果</h4><div class="tn-help-grid">${bonusCards}</div>` : ""}
      ${townCards ? `<h4>城镇奖励</h4><div class="tn-help-grid">${townCards}</div>` : ""}
      <h4>版本与界面操作</h4><p>本局使用基础版主地图与十个种族；未包含背面双人地图、变体或扩展。地图支持拖动、双指缩放和 + / −；Reset 恢复全图。点击地图格或卡片后 Confirm 执行，Cancel、Esc 或点击空白取消选择。Explain 模式中点击虚线标记区域查看说明，原操作会被屏蔽；禁用按钮也能解释。图标可悬停或点击查看短提示，手机提示三秒后消失。Help、Explain 对话框支持 Close、Esc 或点击遮罩关闭。</p>`;
  }

  function ensureModal() {
    if (modal) return;
    modal = el("div", "tn-modal");
    modal.id = "terraNovaModal";
    modal.hidden = true;
    modal.innerHTML = '<div class="tn-modal-card" role="dialog" aria-modal="true" aria-labelledby="terraNovaModalTitle"><div class="tn-modal-head"><h3 id="terraNovaModalTitle"></h3><button type="button" data-tn-ui="close">Close</button></div><div class="tn-modal-body" id="terraNovaModalBody"></div></div>';
    modal.querySelector("button").addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    document.body.append(modal);
  }

  function openModal(title, content, html = false) {
    ensureModal(); hideTooltip();
    modalReturnFocus = document.activeElement;
    byId("terraNovaModalTitle").textContent = title;
    const body = byId("terraNovaModalBody");
    if (html) body.innerHTML = content;
    else { body.replaceChildren(el("p", "", content)); }
    body.scrollTop = 0;
    modal.hidden = false;
    modal.querySelector("button").focus();
  }

  function closeModal() {
    if (modal) modal.hidden = true;
    if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus({ preventScroll: true });
    modalReturnFocus = null;
  }

  function setExplainMode(enabled) {
    explainMode = enabled;
    if (panel) panel.classList.toggle("tn-explain-mode", enabled);
    if (explainBtn) { explainBtn.classList.toggle("active", enabled); explainBtn.setAttribute("aria-pressed", enabled ? "true" : "false"); }
    if (enabled) { hideTooltip(); clearSelection(); }
  }

  function openExplanation(node) {
    const pair = EXPLANATIONS[node.dataset.tnExplain] || EXPLANATIONS.actions;
    const content = node.dataset.tnExplanation;
    setExplainMode(false);
    openModal(pair[0], content ? `${content}\n\n${pair[1]}` : pair[1]);
  }

  function hideTooltip() {
    window.clearTimeout(tooltipTimer);
    if (tooltip) tooltip.hidden = true;
  }

  function showTooltip(node) {
    if (explainMode || !node.dataset.tnTip) return;
    if (!tooltip) { tooltip = el("div", "tn-tooltip"); tooltip.setAttribute("role", "tooltip"); document.body.append(tooltip); }
    tooltip.textContent = node.dataset.tnTip;
    tooltip.hidden = false;
    const rect = node.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const left = Math.max(10, Math.min(window.innerWidth - tipRect.width - 10, rect.left + rect.width / 2 - tipRect.width / 2));
    const top = rect.top > tipRect.height + 16 ? rect.top - tipRect.height - 8 : Math.min(window.innerHeight - tipRect.height - 10, rect.bottom + 8);
    tooltip.style.left = `${left}px`; tooltip.style.top = `${Math.max(10, top)}px`;
    window.clearTimeout(tooltipTimer);
    tooltipTimer = window.setTimeout(hideTooltip, 3000);
  }

  function render(payload) {
    const incoming = payload && payload.view ? payload.view : payload;
    if (!incoming || (incoming.game_id && incoming.game_id !== "terra_nova")) return;
    view = incoming; active = true; pending = false;
    window.clearTimeout(pendingTimer);
    mount();
    if (!panel) return;
    const signature = (view.board || []).map((cell) => cell.id).join("|");
    if (signature !== boardSignature) { mapTransform = { x: 0, y: 0, scale: 1 }; boardSignature = signature; }
    if (`${view.phase}:${view.current_turn}:${view.round}` !== previousPhase) { selectedCell = null; selectedCategory = null; selectedSource = null; stagedAction = null; }
    previousPhase = `${view.phase}:${view.current_turn}:${view.round}`;
    if (stagedAction && !options().some((option) => actionKey(option) === actionKey(stagedAction))) stagedAction = null;
    panel.classList.toggle("tn-choice-phase", ["choose_faction", "choose_bonus", "town_choice"].includes(view.phase));
    renderStatus(); renderRounds(); renderPlayers(); renderMap(); renderActions(); renderFaction(); renderSharedActions(); renderReview(); renderLog();
  }

  function showHeaderActions(visible) {
    active = visible;
    if (header) { header.style.display = visible ? "flex" : "none"; header.classList.toggle("hidden", !visible); }
    if (!visible) { setExplainMode(false); closeModal(); hideTooltip(); clearSelection(); }
  }

  function clear() {
    view = null; pending = false; selectedCell = null; selectedCategory = null; selectedSource = null; stagedAction = null;
    pointerState.clear(); gestureStart = null; boardSignature = ""; previousPhase = "";
    mapTransform = { x: 0, y: 0, scale: 1 };
    window.clearTimeout(pendingTimer); setExplainMode(false); closeModal(); hideTooltip();
    if (panel && mapInitialized) ["terraNovaPlayers", "terraNovaActions", "terraNovaMap", "terraNovaReview", "terraNovaLog"].forEach((id) => { const node = byId(id); if (node) node.replaceChildren(); });
  }

  if (helpBtn) helpBtn.addEventListener("click", () => { setExplainMode(false); openModal("Help · 神秘小地", helpHTML(), true); });
  if (explainBtn) explainBtn.addEventListener("click", () => setExplainMode(!explainMode));

  document.addEventListener("pointerdown", (event) => {
    if (!active || !explainMode || !panel || !panel.contains(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    let node = event.target.closest("[data-tn-explain]");
    // Browser hit testing respects clipped scroll containers and disabled buttons.
    const visibleHit = document.elementFromPoint(event.clientX, event.clientY);
    const hit = visibleHit && visibleHit.closest("button[data-tn-explain]");
    if (hit && panel.contains(hit)) node = hit;
    suppressClickUntil = Date.now() + 600;
    if (node) openExplanation(node);
  }, true);

  document.addEventListener("click", (event) => {
    if (!active || !panel || !panel.contains(event.target)) return;
    if ((Date.now() < suppressClickUntil && (event.target.closest("#terraNovaMapViewport") || (modal && !modal.hidden))) || explainMode) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (explainMode) { const node = event.target.closest("[data-tn-explain]"); if (node) openExplanation(node); }
      return;
    }
    const node = event.target.closest("[data-tn-tip]");
    if (node && !node.closest("button")) { event.stopPropagation(); showTooltip(node); }
  }, true);

  document.addEventListener("pointerover", (event) => {
    if (!active || event.pointerType === "touch" || !panel || !panel.contains(event.target)) return;
    const node = event.target.closest("[data-tn-tip]");
    if (node && !node.contains(event.relatedTarget)) showTooltip(node);
  });
  document.addEventListener("pointerout", (event) => {
    if (!panel || !panel.contains(event.target)) return;
    const node = event.target.closest("[data-tn-tip]");
    if (node && !node.contains(event.relatedTarget)) hideTooltip();
  });
  document.addEventListener("focusin", (event) => {
    if (!active || !panel || !panel.contains(event.target)) return;
    const node = event.target.closest("[data-tn-tip]"); if (node) showTooltip(node);
  });
  document.addEventListener("keydown", (event) => {
    if (!active) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (modal && !modal.hidden) closeModal();
      else if (explainMode) setExplainMode(false);
      else clearSelection();
      hideTooltip();
    }
    if (event.key === "Tab" && modal && !modal.hidden) {
      const focusables = [...modal.querySelectorAll("button, a[href], input, [tabindex='0']")];
      const first = focusables[0]; const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  window.renderTerraNovaGameState = render;
  window.showTerraNovaHeaderActions = showHeaderActions;
  window.clearTerraNovaState = clear;
})();
