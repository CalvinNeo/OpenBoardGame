(() => {
  "use strict";
  const panel = document.getElementById("burgundyPanel");
  if (!panel) return;
  const content = document.getElementById("burgundyContent");
  const phaseLabel = document.getElementById("burgundyPhase");
  const helpButton = document.getElementById("burgundyHelpBtn");
  const explainButton = document.getElementById("burgundyExplainBtn");
  const tooltip = document.getElementById("burgundyTooltip");
  const dice = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const colours = ["🟫", "🟥", "🟧", "🟩", "🟦", "🟪"];
  const kinds = {castle: ["🏰", "Castle"], ship: ["⛵", "Ship"], mine: ["⛏️", "Mine"],
    knowledge: ["📜", "Knowledge"], building: ["🏘️", "City"], animal: ["🐑", "Pasture"]};
  const effects = {castle: "🏰 Choose a bonus action on the estate, at a depot or with your goods.",
    city_hall: "🏛️ Place a stored tile without using a die.", warehouse: "🏚️ Choose goods to sell without using a die.",
    workshop: "🪚 Take a building from any numbered depot.", church: "⛪ Take a castle, mine or knowledge tile.",
    market: "🏪 Take a ship or animal tile.", ship: "⛵ Choose a depot, then collect its goods."};
  const knowledgeZh = ["相同建筑可以放在同一座城市中。", "每座矿山在阶段末额外生产一名工人。", "每次出售货物获得两枚银币而非一枚。",
    "每次出售货物额外获得一名工人。", "船只可以从两个相邻货站取货，1 号与 6 号相邻。", "每回合一次的购买可从任意货站拿板块，仍花两枚银币。",
    "动物计分时，每个参与计分的动物板块额外得一分，包括再次计分的板块。", "每名工人可调整最多两点骰值而非一点。", "放置建筑可免费调整最多一点骰值。",
    "放置船只或动物可免费调整最多一点骰值。", "放置城堡、矿山或知识可免费调整最多一点骰值。", "从编号货站拿板块可免费调整最多一点骰值。",
    "取得工人行动额外获得一枚银币，旅馆效果不适用。", "取得工人行动获得四名工人而非两名。", "终局时，每种售出过的货物得三分。",
    "终局时，领地中每座仓库得四分。", "终局时，领地中每座瞭望塔得四分。", "终局时，领地中每座木工坊得四分。", "终局时，领地中每座教堂得四分。",
    "终局时，领地中每座市场得四分。", "终局时，领地中每座旅馆得四分。", "终局时，领地中每座银行得四分。", "终局时，领地中每座市政厅得四分。",
    "终局时，领地中每种动物得四分。", "终局时，每件已售货物得一分。", "终局时，每块颜色奖励板块得两分。"];
  const helpConfig = {
    gameId: "castles_of_burgundy",
    title: {zh: "勃艮第城堡", en: "The Castles of Burgundy"},
    basic: {
      win: {zh: "五个阶段结束后，建设领地、出售货物和知识奖励获得的分数(⭐)最高者获胜。", en: "Win by having the most victory points (⭐) after five phases through estate building, goods sales and knowledge bonuses."},
      turn: {zh: "每回合用两颗骰子(🎲)拿板块、放板块、卖货或取工人，并可额外花两枚银币(🪙)购买一次板块。", en: "Use two dice (🎲) to take or place tiles, sell goods or gain workers, and optionally buy one tile for two silverlings (🪙)."},
      key: {zh: "尽早完成同色区域赚取阶段奖励，用工人(👷)调整骰值并利用板块效果形成连锁。", en: "Complete colour regions early for phase bonuses, adjust dice with workers (👷), and chain tile effects."}
    },
    sections: [
      {id: "controls", label: {zh: "行动与操作", en: "Turns & controls"}, html: {
        zh: `<p>先选一颗未使用的骰子(🎲)，再直接点击货站板块、仓储板块或自己的货物。选择仓储板块后点击高亮的领地格。确认区就在所选目标旁，列出所需工人(👷)与银币(🪙)，点击 Confirm 才提交。点击空白或按 Esc 取消未提交的选择。</p><p>货站与领地格需要匹配骰点。每名工人调整一点，1 与 6 相邻，系统按最小费用计算。取得工人行动消耗所选骰子并获得两名工人。仓储有三格，满时必须明确选一块旧板块丢弃。出售一种货物(🟫🟥🟧🟩🟦🟪)的全部货物，获得一枚银币，每件得玩家人数那么多的分数(⭐)。</p><p>黑市购买每回合一次，不使用骰子，花两枚银币。知识 6 允许购买编号货站板块，先打开货站内的 Buy 开关。两颗骰子用完仍可购买，再点 End Turn。即时奖励必须先处理，可跳过的建筑奖励会显示 Skip Bonus。每轮结束暂停，所有玩家点 Next Round 才继续。</p><p>手机通过 Estate / Depots 切换。领地自动适配可用宽度，始终完整显示。可直接在领地上滑动页面，不会误选格子。</p>`,
        en: `<p>Select an unused die (🎲), then click a depot tile, a stored tile or your own goods. After choosing a stored tile, click a highlighted estate hex. The confirmation beside your target shows the worker (👷) and silverling (🪙) cost. Only Confirm submits it. Click blank space or press Esc to cancel an unsubmitted choice.</p><p>Match the die to a depot or estate hex. Each worker adjusts it by one step, with 1 adjacent to 6, and the server calculates the minimum cost. Gain Workers spends the selected die for two workers. Storage holds three tiles, so choose an old tile to discard when full. Sell every goods tile of one type (🟫🟥🟧🟩🟦🟪) for one silverling and points (⭐) per tile equal to the player count.</p><p>Buy once per turn for two silverlings without a die. Knowledge 6 also permits numbered depots using their Buy toggle. You may buy after using both dice, before End Turn. Resolve immediate bonuses first, or use Skip Bonus when offered. Every round pauses until all players select Next Round.</p><p>On phones, switch Estate / Depots. The complete estate automatically fits the available width. Swipe over the estate to scroll the page without selecting a hex.</p>`}},
      {id: "tiles", label: {zh: "板块效果", en: "Tile effects"}, html: {
        zh: `<p>板块必须放在同色空格并邻接已建板块。同一城市(🏘️)不能有重复建筑，知识 1 例外。城堡(🏰)提供一个任意骰值的额外行动。船只(⛵)推进下轮顺序并从一个货站取货，同位置后来者优先。货物最多存三种，同种数量不限。矿山(⛏️)在每个阶段末生产一枚银币(🪙)。知识(📜)提供永久能力或终局奖励。</p><p>牧场(🐑)放置动物时，计入本板块及同一牧场已有同类动物，牛(🐄)、羊(🐑)、猪(🐖)、鸡(🐔)分开计算。</p><p>仓库(🏚️)免费卖一种货物，木工坊(🪚)免费拿建筑，教堂(⛪)免费拿城堡、矿山或知识，市场(🏪)免费拿船只或动物，市政厅(🏛️)免费放仓储板块。旅馆(🏡)给四名工人(👷)，银行(🏦)给两枚银币(🪙)，瞭望塔(🗼)给四分(⭐)。免费拿取只限编号货站。连锁效果逐步处理。</p>`,
        en: `<p>Place on a matching empty hex adjacent to your built estate. A city (🏘️) cannot repeat a building unless you have knowledge 1. A castle (🏰) grants an extra action with any die value. A ship (⛵) advances next round's order and collects goods from a depot, with later arrivals taking priority on tied positions. Store up to three goods types, with unlimited tiles of each. A mine (⛏️) produces one silverling (🪙) at every phase end. Knowledge (📜) grants a permanent ability or end-game bonus.</p><p>A pasture (🐑) scores the new tile plus matching animals already in that pasture. Cows (🐄), sheep (🐑), pigs (🐖) and chickens (🐔) score separately.</p><p>A warehouse (🏚️) sells one goods type, a workshop (🪚) takes a building, a church (⛪) takes a castle, mine or knowledge tile, a market (🏪) takes a ship or animal, and a city hall (🏛️) places a stored tile, all without a die. A boarding house (🏡) grants four workers (👷), a bank (🏦) grants two silverlings (🪙), and a watchtower (🗼) grants four points (⭐). Free tile-taking uses numbered depots only. Resolve chained effects one step at a time.</p>`}},
      {id: "scoring", label: {zh: "计分与图标", en: "Scoring & icons"}, html: {
        zh: `<p>完整区域按 1–8 格得 1、3、6、10、15、21、28、36 分，另加阶段 A–E 的 10、8、6、4、2 分。每色首位完成全部格子的玩家得人数加三分，第二位得人数分。</p><p>终局每件未售货物与每枚银币(🪙)各一分，每两工人(👷)一分，再加知识(📜)奖励。仓储板块不计分。同分时空格更多者胜，再同分则最终顺序更靠后者胜。</p><p>分数(⭐)表示胜利点，奖杯(🏆)表示胜者，机器人(🤖)表示自动玩家。公共白骰(🎲)只决定新货物进入哪个货站。货物颜色(🟫🟥🟧🟩🟦🟪)分别代表 1–6，界面同时显示数字。颜色奖励旁数字表示已领取人数，Next goods 是本阶段余下的公开货物。</p><p>本实现为 2011 基础版，2–4 人，标准 1 号领地，无扩展与单人模式。<a href="https://cdn.1j1ju.com/medias/04/f5/f9-the-castles-of-burgundy-rulebook.pdf" target="_blank" rel="noopener noreferrer">原版规则</a>与<a href="https://www.yucata.de/en/Rules/CastlesOfBurgundy" target="_blank" rel="noopener noreferrer">平局勘误</a>。</p>`,
        en: `<p>Completed regions of 1–8 hexes score 1, 3, 6, 10, 15, 21, 28 or 36 points, plus 10, 8, 6, 4 or 2 points in phases A–E. The first player to complete an entire colour scores the player count plus three, and the second scores the player count.</p><p>At game end, each unsold goods tile and silverling (🪙) scores one point, every two workers (👷) score one, and knowledge (📜) adds its bonuses. Stored tiles score nothing. Ties favour more empty estate hexes, then the player later in the final turn order.</p><p>Points (⭐) are victory points, a trophy (🏆) marks the winner, and a robot (🤖) marks a bot. The white die (🎲) only routes arriving goods. Goods colours (🟫🟥🟧🟩🟦🟪) represent types 1–6 and always include numbers. Colour bonus counters show claims already taken. Next goods lists the remaining public goods for this phase.</p><p>This is the 2011 base game for 2–4 players on estate 1, without expansions or solo mode. See the <a href="https://cdn.1j1ju.com/medias/04/f5/f9-the-castles-of-burgundy-rulebook.pdf" target="_blank" rel="noopener noreferrer">original rules</a> and <a href="https://www.yucata.de/en/Rules/CastlesOfBurgundy" target="_blank" rel="noopener noreferrer">tie-break correction</a>.</p>`}},
      {id: "knowledge", label: {zh: "知识 1–26", en: "Knowledge 1–26"}, html: {zh: "", en: ""}}
    ]
  };
  const explanations = {
    phase: "Five phases A–E, each with five rounds. Completing a region earlier earns a larger phase bonus.",
    estate: "Estate 1: match the tile colour and hex number, adjacent to a built tile. The complete estate automatically fits the available width."
  };
  let view = null;
  let ui = {};
  let explanationIndex = 0;
  let tooltipTimer = null;
  let gesture = null;
  let suppressClickUntil = 0;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
  const attr = (key, value) => ` data-${key}="${esc(value)}"`;
  const player = id => view?.players.find(entry => entry.player_id === id);
  const self = () => player(view?.you);
  const name = id => player(id)?.name || "Spectator";
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const active = () => view?.current_turn === view?.you && !!self() && view.phase !== "round_end" && !view.game_over;
  const help = window.obgCreateHelp(helpConfig);
  const explain = window.obgCreateExplain({
    gameId: "castles_of_burgundy", attribute: "data-burgundy-explain", explanations: explanations,
    root: () => panel, button: explainButton,
    bypass: ["#burgundyHelpBtn", "#burgundyExplainBtn", ".obg-help-dialog"]
  });
  function tip(label, description, className = "") {
    return `<span class="${className}" data-burgundy-tip="${esc(description)}" tabindex="0">${label}</span>`;
  }
  function button(label, command, description, className = "", disabled = false, attributes = "") {
    const key = `control-${++explanationIndex}`;
    explanations[key] = description;
    const pressed = ["die", "player", "tab", "buy-mode", "ship-good", "ship-depot"].includes(command)
      ? ` aria-pressed="${className.includes("is-selected")}"` : "";
    return `<button type="button" data-burgundy="${command}" data-focus-key="${esc(command + attributes)}" data-burgundy-explain="${key}" class="${className}"${disabled ? ` disabled data-burgundy-tip="${esc(description)}"` : ""}${pressed}${attributes}>${label}</button>`;
  }
  function resetSelection() {
    Object.assign(ui, {tile: null, cell: null, goods: null, depot: null, discard: null, shipDepots: [], shipGoods: []});
    hideTip();
  }
  function options(type) {
    return (view?.options || []).filter(option => option.action.type === type &&
      (!Object.hasOwn(option.action, "die") || option.action.die === ui.die));
  }
  function selectionOptions() {
    if (view.pending?.kind === "ship") return options("ship_goods").filter(option => same(option.action.depots, ui.shipDepots) && same(option.action.goods, ui.shipGoods));
    return options(ui.mode).filter(({action}) =>
      (ui.mode === "sell" ? action.goods === ui.goods : action.tile === ui.tile) &&
      (ui.mode !== "place" || action.cell === ui.cell) &&
      (!Object.hasOwn(action, "discard") || action.discard === ui.discard));
  }
  function findTile(id) {
    return [...view.depots.flatMap(depot => depot.tiles), ...view.players.flatMap(entry => entry.storage)].find(tile => tile.id === id);
  }
  function tileMarkup(tile) {
    return `<span class="burgundy-tile-icon" aria-hidden="true">${esc(tile.emoji)}</span><span class="burgundy-tile-name">${esc(tile.name)}</span>`;
  }
  function goodsMarkup(goods) {
    return goods.map((count, index) => count ? tip(`${colours[index]} ${index + 1}<strong>×${count}</strong>`, `Goods type ${index + 1}: ${count} tiles.`, "burgundy-good") : "").join("") || '<span class="burgundy-muted">No goods</span>';
  }
  function renderPlayers() {
    return `<div class="burgundy-players">${view.turn_order.map(id => {
      const entry = player(id);
      return button(`<span class="burgundy-player-name">${entry.is_bot ? "🤖 " : ""}${esc(entry.name)}${id === view.you ? " · You" : ""}</span><strong>⭐ ${entry.score}</strong><small>🪙 ${entry.silver} · 👷 ${entry.workers} · ⛵ ${entry.ships}</small>`,
        "player", `${entry.name}: ${entry.score} points, ${entry.silver} silverlings, ${entry.workers} workers, ${entry.ships} ships. Inspect this estate.`,
        `burgundy-player ${id === view.current_turn ? "is-turn" : ""} ${id === ui.viewed ? "is-selected" : ""}`, false, attr("player", id));
    }).join("")}</div>`;
  }
  function renderConfirmation() {
    const selected = selectionOptions()[0];
    const tile = findTile(ui.tile);
    let text = tile ? `${tile.emoji} ${tile.name}` : "";
    if (ui.mode === "place" && tile && ui.cell === null) return `<p class="burgundy-selection-hint" role="status">${esc(text)} · choose a highlighted hex</p>`;
    if (ui.mode === "sell") text = `${colours[ui.goods - 1]} Sell all type ${ui.goods} goods`;
    if (view.pending?.kind === "ship") text = `⛵ Collect from depot ${ui.shipDepots.join(" + ")}`;
    if (selected) text += selected.action.type === "buy" ? " · 2 🪙" : ` · ${selected.workers || 0} 👷`;
    if (selected?.action.type === "place") text += ` · hex ${selected.action.cell + 1}`;
    const replacement = ["take", "buy"].includes(ui.mode) && tile && self()?.storage.length === 3
      ? `<div class="burgundy-replacement"><span>Storage full · replace one tile:</span><div class="burgundy-inline">${self().storage.map(stored => button(`${stored.emoji} ${esc(stored.name)}`, "discard", `Discard ${stored.name} to make room. This cannot be undone.`, ui.discard === stored.id ? "is-selected" : "", false, attr("tile", stored.id))).join("")}</div></div>` : "";
    return `<div class="burgundy-confirm" role="region" aria-label="Confirm selection"><p role="status">${esc(text)}</p>${tile ? `<small>${esc(tile.description)}</small>` : ""}${replacement}<div class="burgundy-inline">${button("Confirm", "confirm", "Submit this selection and pay the displayed cost.", "burgundy-primary", !selected)}${button("Cancel", "cancel", "Cancel this unsubmitted selection.")}</div></div>`;
  }
  function renderEstate() {
    const owner = player(ui.viewed) || self() || view.players[0];
    const ownEstate = owner.player_id === view.you;
    const available = ownEstate ? options("place").filter(option => option.action.tile === ui.tile) : [];
    const cells = owner.estate.map(cell => {
      const legal = available.some(option => option.action.cell === cell.id);
      const description = `Hex ${cell.id + 1} · ${kinds[cell.kind].join(" ")} · die ${cell.number}. ${cell.tile ? `${cell.tile.name}: ${cell.tile.description}` : "Place a matching tile adjacent to your built estate."}`;
      const label = cell.tile ? `<span>${esc(cell.tile.emoji)}</span><small>${cell.tile.kind === "animal" ? "×" + cell.tile.count : cell.tile.kind === "knowledge" ? "#" + cell.tile.number : "✓"}</small>` : `<span class="burgundy-hex-number">${dice[cell.number - 1]}</span>`;
      return `<div class="burgundy-hex-slot" style="left:${50 + (cell.q + cell.r / 2) * 13.75}%;top:${50 + cell.r * 12.5}%"${!legal ? ` data-burgundy-tip="${esc(description)}"` : ""}>${button(label, "cell", description,
        `burgundy-hex burgundy-${cell.kind} ${cell.tile ? "is-built" : ""} ${legal ? "is-legal" : ""} ${ui.cell === cell.id ? "is-selected" : ""}`, !legal, `${attr("cell", cell.id)} aria-label="${esc(description)}"`)}</div>`;
    }).join("");
    return `<section class="burgundy-estate-section"><div class="burgundy-section-heading"><h3>🏰 ${esc(owner.name)}’s estate</h3>${tip(`${owner.estate.filter(cell => cell.tile).length} / 37`, "Built hexes out of the 37 spaces on estate 1.")}</div>
      <div class="burgundy-map" data-burgundy-explain="estate" aria-label="Complete estate map"><div class="burgundy-estate">${cells}</div></div>
      ${active() && ownEstate && ui.mode === "place" && ui.tile ? renderConfirmation() : ""}
      <div class="burgundy-legend">${Object.values(kinds).map(([icon, label]) => tip(`${icon} ${label}`, `${label} (${icon}): place tiles of this kind on matching estate hexes.`)).join("")}</div>
      <div class="burgundy-supplies"><section><div class="burgundy-section-heading"><h3>Storage</h3><small>${owner.storage.length} / 3</small></div><div class="burgundy-storage">${[0, 1, 2].map(index => {
        const tile = owner.storage[index];
        if (!tile) return '<div class="burgundy-empty-slot">Empty</div>';
        return button(tileMarkup(tile), "storage", `${tile.name} (${tile.emoji}): ${tile.description} Select to place on your estate.`, `burgundy-tile burgundy-${tile.kind} ${ui.tile === tile.id ? "is-selected" : ""}`, !ownEstate || !options("place").some(option => option.action.tile === tile.id), attr("tile", tile.id));
      }).join("")}</div></section><section><div class="burgundy-section-heading"><h3>Goods</h3>${tip("3 types max", "Store up to three different goods types. Each type can hold any number of tiles.")}</div><div class="burgundy-goods">${ownEstate && active() ? owner.goods.map((count, index) => count ? button(`${colours[index]} ${index + 1} <b>×${count}</b>`, "sell", `Sell all ${count} type ${index + 1} goods. Normally gain 1 silverling and ${view.players.length * count} points. Knowledge may add bonuses.`, ui.mode === "sell" && ui.goods === index + 1 ? "is-selected" : "", !options("sell").some(option => option.action.goods === index + 1), attr("goods", index + 1)) : "").join("") || '<span class="burgundy-muted">No goods</span>' : goodsMarkup(owner.goods)}</div>${active() && ownEstate && ui.mode === "sell" && ui.goods ? renderConfirmation() : ""}</section></div>
      <details class="burgundy-details" data-detail="knowledge"><summary>📜 Knowledge (${owner.knowledge.length}) & progress</summary>${owner.knowledge.map(number => `<p><b>#${number}</b> ${esc(view.knowledge[number])}</p>`).join("") || '<p>No knowledge tiles yet.</p>'}<p>Sold: ${goodsMarkup(owner.sold)}</p><p>Colour bonuses: ${owner.bonus_tiles.map(bonus => `${kinds[bonus.kind][0]} +${bonus.points}`).join(" · ") || "None"}</p><p>Next order: ${view.next_order.map(id => esc(name(id))).join(" → ")}</p></details></section>`;
  }
  function renderShipGoods() {
    const available = [...new Set(ui.shipDepots.flatMap(id => view.depots[id].goods))].sort();
    return `<div class="burgundy-ship-choice"><p class="burgundy-hint">${self().knowledge.includes(5) ? "Choose one depot or two adjacent depots." : "Choose one depot."} Select goods to keep:</p><div class="burgundy-inline">${available.map(number => button(`${colours[number - 1]} ${number}`, "ship-good", `Collect every type ${number} goods tile from the selected depots. Keep at most three goods types.`, ui.shipGoods.includes(number) ? "is-selected" : "", false, attr("goods", number))).join("") || '<span class="burgundy-muted">No goods in this depot</span>'}</div>${renderConfirmation()}</div>`;
  }
  function renderDepots() {
    const ship = view.pending?.kind === "ship" && active();
    return `<section class="burgundy-market-section"><div class="burgundy-section-heading"><h3>Trading depots</h3>${tip(`White die ${dice[view.white_die - 1]}`, `The white die sends this round's arriving goods to depot ${view.white_die}. It is not an action die.`)}${self()?.knowledge.includes(6) && active() && !view.pending ? button("Buy · 2 🪙", "buy-mode", "Knowledge 6: toggle buying from numbered depots instead of using a die to take a tile.", ui.buyMode ? "is-selected" : "", !options("buy").length) : ""}</div>
      <div class="burgundy-depots">${[...view.depots.slice(1), view.depots[0]].map(depot => {
        const header = depot.id ? `${dice[depot.id - 1]} Depot ${depot.id}` : "🪙 Black depot · 2 🪙";
        const selected = ui.depot === depot.id && ui.tile && ["take", "buy"].includes(ui.mode);
        return `<section class="burgundy-depot ${depot.id === 0 ? "burgundy-black-depot" : ""} ${ui.shipDepots.includes(depot.id) ? "is-selected" : ""}"><div class="burgundy-depot-heading">${ship && depot.id ? button(header, "ship-depot", "Choose this depot's goods. Knowledge 5 permits two adjacent depots, including 1 and 6.", ui.shipDepots.includes(depot.id) ? "is-selected" : "", false, attr("depot", depot.id)) : `<h4>${header}</h4>`}</div>
        <div class="burgundy-depot-tiles">${depot.tiles.map(tile => {
          const type = depot.id === 0 || ui.buyMode ? "buy" : "take";
          const legal = !ship && options(type).some(option => option.action.tile === tile.id);
          return button(tileMarkup(tile), "tile", `${tile.name} (${tile.emoji}): ${tile.description} ${type === "buy" ? "Buy once per turn for 2 silverlings." : `Take using a die matching depot ${depot.id}, adjusted with workers if needed.`}`, `burgundy-tile burgundy-${tile.kind} ${ui.tile === tile.id ? "is-selected" : ""}`, !legal, `${attr("tile", tile.id)}${attr("depot", depot.id)}${attr("mode", type)}`);
        }).join("") || '<span class="burgundy-muted">Empty</span>'}</div>${selected ? renderConfirmation() : ""}${depot.id ? `<div class="burgundy-depot-goods">${depot.goods.map(number => tip(`${colours[number - 1]}<b>${number}</b>`, `Goods type ${number}. Collect using a ship.`, "burgundy-good")).join("") || '<small>No goods</small>'}</div>` : ""}${ship && ui.shipDepots.at(-1) === depot.id ? renderShipGoods() : ""}</section>`;
      }).join("")}</div></section>`;
  }
  function renderTurn() {
    const owner = self();
    if (!active()) return `<div class="burgundy-turn-bar"><strong>${view.game_over ? "🏆 Game complete" : view.phase === "round_end" ? "Round complete · review below" : `${owner ? "Waiting for" : "Spectating"} ${esc(name(view.current_turn))}`}</strong>${!view.game_over && view.phase !== "round_end" ? `<span class="burgundy-other-dice">${player(view.current_turn)?.dice.map((number, index) => tip(dice[number - 1], `Action die ${index + 1}: ${number}${player(view.current_turn).used[index] ? ", already used" : ", available"}.`, player(view.current_turn).used[index] ? "is-used" : "")).join(" ") || ""}</span>` : ""}</div>`;
    return `<div class="burgundy-turn-bar"><div class="burgundy-dice"><strong>Your turn</strong>${owner.dice.map((number, index) => button(dice[number - 1], "die", `Die ${index + 1}: ${number}. Workers adjust its value, with 1 adjacent to 6.`, `${ui.die === index ? "is-selected" : ""} ${owner.used[index] ? "is-used" : ""}`, owner.used[index] || !!view.pending, `${attr("die", index)} aria-label="Die ${index + 1}: ${number}"`)).join("")}</div><div class="burgundy-inline burgundy-turn-buttons">${button(`+${owner.knowledge.includes(14) ? 4 : 2} 👷`, "workers", "Workers (👷): spend the selected die to gain 2 workers, or 4 with knowledge 14. Knowledge 13 adds a silverling.", "", !options("workers").length)}${options("skip_bonus").length ? button("Skip Bonus", "skip", "Decline this optional building effect and resume your turn.") : ""}${button("End Turn", "end", "Finish after using both dice and resolving bonuses. You can buy a tile before ending.", "", !options("end_turn").length)}</div></div>${view.pending ? `<p class="burgundy-bonus" role="status">${esc(effects[view.pending.kind])}</p>` : ""}`;
  }
  function renderReview() {
    if (view.game_over) return `<section class="burgundy-review-section"><h3>🏆 ${view.winner.map(id => esc(name(id))).join(", ")}</h3>${Object.entries(view.final_scores).map(([id, score]) => `<div class="burgundy-final"><strong>${esc(name(id))} · ⭐ ${score.total}</strong><p>Play ${score.during_game} · Goods ${score.goods} · 🪙 ${score.silver} · 👷 ${score.workers} · 📜 ${score.knowledge}</p>${Object.keys(score.knowledge_details).length ? `<small>${Object.entries(score.knowledge_details).map(([number, points]) => `#${number}: ${points}`).join(" · ")}</small>` : ""}</div>`).join("")}</section>`;
    if (view.phase !== "round_end") return "";
    return `<section class="burgundy-review-section"><div class="burgundy-section-heading"><h3>Round complete</h3><span>${view.ready.length} / ${view.players.length} ready</span></div>${view.players.map(owner => `<div class="burgundy-review ${owner.player_id === view.you ? "is-you" : ""}"><span>${esc(owner.name)}${owner.player_id === view.you ? " · You" : ""} ${view.ready.includes(owner.player_id) ? "✓" : ""}</span><b>⭐ +${view.review.delta[owner.player_id].score}</b>${view.review.income[owner.player_id] ? `<small>Income: 🪙 +${view.review.income[owner.player_id].silver} · 👷 +${view.review.income[owner.player_id].workers}</small>` : ""}</div>`).join("")}${button("Next Round", "next", "Continue only after every player has reviewed this round and confirmed readiness.", "burgundy-primary", !options("next_round").length)}</section>`;
  }
  function render() {
    if (!view) return;
    const focused = document.activeElement?.dataset.focusKey;
    const opened = [...content.querySelectorAll("details[open]")].map(details => details.dataset.detail);
    const logScroll = content.querySelector(".burgundy-log")?.scrollTop || 0;
    Object.keys(explanations).filter(key => key.startsWith("control-")).forEach(key => delete explanations[key]);
    explanationIndex = 0;
    phaseLabel.innerHTML = `<strong>Phase ${"ABCDE"[view.stage - 1]} <span>· Round ${view.round} / 5</span></strong>${tip(`Region bonus +${12 - view.stage * 2} ⭐`, "Extra points for completing a region in this phase, in addition to its size bonus.")}`;
    content.innerHTML = `${renderPlayers()}${renderTurn()}<nav class="burgundy-mobile-tabs" aria-label="Game panels">${button("🏰 Estate", "tab", "Show the selected estate, storage and goods.", ui.tab !== "depots" ? "is-selected" : "", false, attr("tab", "estate"))}${button("⛵ Depots", "tab", "Show shared tile and goods depots.", ui.tab === "depots" ? "is-selected" : "", false, attr("tab", "depots"))}</nav>${renderReview()}<div class="burgundy-layout">${renderEstate()}${renderDepots()}</div><footer class="burgundy-footer"><div class="burgundy-bonuses">${Object.entries(view.bonuses).map(([kind, ids]) => tip(`${kinds[kind][0]} ${ids.length}/2`, `${kinds[kind][1]} colour bonus: ${ids.length} of two claims taken.`)).join("")}${tip(`Next goods: ${view.round_goods.map(number => `${colours[number - 1]}${number}`).join(" ") || "Phase end"}`, "Remaining public goods arriving in this phase.", "burgundy-next-goods")}</div><details class="burgundy-details" data-detail="log"><summary>Log · recent actions</summary><div class="burgundy-log">${view.log.slice().reverse().map(text => `<p>${esc(text)}</p>`).join("")}</div></details></footer>`;
    panel.dataset.mobileTab = ui.tab || "estate";
    opened.forEach(key => content.querySelector(`details[data-detail="${key}"]`)?.setAttribute("open", ""));
    const log = content.querySelector(".burgundy-log");
    if (log) log.scrollTop = logScroll;
    if (focused) [...content.querySelectorAll("[data-focus-key]")].find(element => element.dataset.focusKey === focused)?.focus({preventScroll: true});
    explain.refresh();
  }
  function submit(option) {
    if (!option) return;
    sendAction(option.action);
    resetSelection();
  }
  helpButton.addEventListener("click", () => {
    explain.exit(); hideTip();
    helpConfig.sections.find(section => section.id === "knowledge").html = {
      zh: knowledgeZh.map((text, index) => `<p><b>知识 ${index + 1} (📜)</b> ${text}</p>`).join(""),
      en: Object.entries(view?.knowledge || {}).sort((left, right) => Number(left[0]) - Number(right[0])).map(([number, text]) => `<p><b>Knowledge ${number} (📜)</b> ${esc(text)}</p>`).join("")
    };
    help.open();
  });
  explainButton.addEventListener("click", () => { hideTip(); explain.toggle(); });
  panel.addEventListener("click", event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); return; }
    const target = event.target.closest("button[data-burgundy]");
    if (!target) {
      if (!event.target.closest("button, summary, details, [data-burgundy-tip]")) { resetSelection(); render(); }
      return;
    }
    if (target.disabled) return;
    const command = target.dataset.burgundy;
    if (command === "player") { resetSelection(); ui.viewed = target.dataset.player; ui.tab = "estate"; }
    else if (command === "tab") ui.tab = target.dataset.tab;
    else if (command === "die") { resetSelection(); ui.die = Number(target.dataset.die); }
    else if (command === "buy-mode") { resetSelection(); ui.buyMode = !ui.buyMode; }
    else if (command === "tile") { resetSelection(); Object.assign(ui, {tile: target.dataset.tile, depot: Number(target.dataset.depot), mode: target.dataset.mode}); }
    else if (command === "storage") { resetSelection(); Object.assign(ui, {tile: target.dataset.tile, mode: "place", viewed: view.you}); }
    else if (command === "cell") ui.cell = Number(target.dataset.cell);
    else if (command === "discard") ui.discard = target.dataset.tile;
    else if (command === "sell") { resetSelection(); ui.mode = "sell"; ui.goods = Number(target.dataset.goods); }
    else if (command === "cancel") resetSelection();
    else if (command === "ship-depot") {
      const depot = Number(target.dataset.depot);
      if (ui.shipDepots.includes(depot)) ui.shipDepots = ui.shipDepots.filter(id => id !== depot);
      else if (self().knowledge.includes(5) && ui.shipDepots.length === 1 && [1, 5].includes(Math.abs(depot - ui.shipDepots[0]))) ui.shipDepots.push(depot);
      else ui.shipDepots = [depot];
      ui.shipDepots.sort((left, right) => left - right);
      const possible = options("ship_goods").filter(option => same(option.action.depots, ui.shipDepots));
      ui.shipGoods = possible.length === 1 ? possible[0].action.goods.slice() : [...new Set(ui.shipDepots.flatMap(id => view.depots[id].goods))].filter(number => self().goods[number - 1]).sort();
    } else if (command === "ship-good") {
      const number = Number(target.dataset.goods);
      if (!self().goods[number - 1]) ui.shipGoods = ui.shipGoods.includes(number) ? ui.shipGoods.filter(good => good !== number) : [...ui.shipGoods, number].sort();
    } else if (command === "confirm") { submit(selectionOptions()[0]); return; }
    else if (["workers", "end", "skip", "next"].includes(command)) { submit(options({workers: "workers", end: "end_turn", skip: "skip_bonus", next: "next_round"}[command])[0]); return; }
    hideTip(); render();
  });
  function hideTip() { clearTimeout(tooltipTimer); tooltip.hidden = true; }
  function showTip(target) {
    if (explain.isActive() || !target || target.closest("button:not(:disabled)")) return;
    clearTimeout(tooltipTimer);
    tooltip.textContent = target.dataset.burgundyTip;
    tooltip.hidden = false;
    const bounds = target.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(innerWidth - box.width - 8, bounds.left + bounds.width / 2 - box.width / 2))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(innerHeight - box.height - 8, bounds.bottom + 8))}px`;
    tooltipTimer = setTimeout(hideTip, 3000);
  }
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-burgundy-tip]")); });
  panel.addEventListener("pointerout", hideTip);
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-burgundy-tip]")));
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || explain.isActive()) return;
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, tip: event.target.closest("[data-burgundy-tip]")};
  });
  document.addEventListener("pointermove", event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 9) { gesture.moved = true; hideTip(); }
  });
  function endGesture(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const previous = gesture;
    gesture = null;
    if (previous.moved || event.type !== "pointerup") { suppressClickUntil = performance.now() + 400; return; }
    if (event.pointerType !== "mouse") showTip(previous.tip);
  }
  document.addEventListener("pointerup", endGesture);
  document.addEventListener("pointercancel", endGesture);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { hideTip(); if (!document.querySelector("dialog[open]")) { explain.exit(); resetSelection(); render(); } }
  });
  window.addEventListener("resize", hideTip);
  window.renderBurgundyGameState = payload => {
    const oldStored = self()?.storage.length || 0;
    view = payload.view || payload.state || payload;
    resetSelection();
    const owner = self();
    ui.die = owner ? owner.used.findIndex(used => !used) : null;
    if (!player(ui.viewed)) ui.viewed = view.you || view.players[0].player_id;
    ui.mode = "take";
    ui.buyMode = false;
    if (owner && owner.storage.length > oldStored) { ui.tab = "estate"; ui.viewed = view.you; }
    if (view.pending && active()) {
      ui.tab = ["ship", "workshop", "church", "market"].includes(view.pending.kind) ? "depots" : "estate";
      ui.viewed = view.you;
    }
    render();
  };
  window.showBurgundyHeaderActions = visible => {
    document.getElementById("burgundyHeaderActions").style.display = visible ? "flex" : "none";
    if (!visible) { explain.exit(); help.close(); hideTip(); }
  };
  window.clearBurgundyState = () => { view = null; ui = {}; explain.exit(); help.close(); hideTip(); content.replaceChildren(); phaseLabel.replaceChildren(); };
  if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "castles_of_burgundy" && typeof lastGameStatePayload !== "undefined" && lastGameStatePayload) window.renderBurgundyGameState(lastGameStatePayload);
})();
