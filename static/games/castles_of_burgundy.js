(() => {
  "use strict";
  const panel = document.getElementById("burgundyPanel");
  if (!panel) return;
  const dice = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const colours = ["🟫", "🟥", "🟧", "🟩", "🟦", "🟪"];
  const kinds = {castle: ["🏰", "Castle"], ship: ["⛵", "Ship"], mine: ["⛏️", "Mine"],
    knowledge: ["📜", "Knowledge"], building: ["🏘️", "City"], animal: ["🐑", "Pasture"]};
  const effects = {castle: "🏰 额外执行一个任意点数的行动。", city_hall: "🏛️ 免费放置仓库内的一块板块。",
    warehouse: "🏚️ 免费出售一种货物。", workshop: "🪚 从任意编号货站拿一个建筑。",
    church: "⛪ 从编号货站拿城堡、矿山或知识。", market: "🏪 从编号货站拿船只或动物。",
    ship: "⛵ 选择取货的货站；至多储存三种货物。"};
  let view = null;
  let ui = {};
  let explain = false;
  let suppressClickUntil = 0;
  let returnFocus = null;
  const dialog = document.createElement("dialog");
  dialog.className = "burgundy-dialog";
  dialog.setAttribute("aria-labelledby", "burgundyDialogTitle");
  document.body.appendChild(dialog);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const player = id => view.players.find(p => p.player_id === id);
  const name = id => player(id)?.name || "Spectator";
  const self = () => player(view.you);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const attr = (key, value) => ` data-${key}="${esc(value)}"`;
  function button(label, cmd, description, extra = "", disabled = false, attrs = "") {
    if (["mode", "die", "player", "tab", "ship-good", "ship-depot", "explain"].includes(cmd)) {
      attrs += ` aria-pressed="${extra.includes("is-selected")}"`;
    }
    return `<button type="button" data-burgundy="${cmd}" class="${extra}" data-explain="${esc(description)}" ${disabled ? "disabled" : ""}${attrs}>${label}</button>`;
  }
  function resetSelection() {
    ui.tile = null; ui.cell = null; ui.goods = null; ui.depot = null; ui.discard = null;
    ui.shipDepots = []; ui.shipGoods = [];
  }
  function tileMarkup(tile) {
    return `<span class="burgundy-tile-icon" aria-hidden="true">${tile.emoji}</span><span class="burgundy-tile-name">${esc(tile.name)}</span>`;
  }
  function goodsMarkup(goods) {
    return goods.map((n, i) => n ? `<span class="burgundy-good">${colours[i]} ${i + 1}<strong>×${n}</strong></span>` : "").join("") || '<span class="burgundy-muted">No goods</span>';
  }
  function options(type) {
    return view.options.filter(o => o.action.type === type && (!Object.hasOwn(o.action, "die") || o.action.die === ui.die));
  }
  function selectionOptions() {
    if (view.pending?.kind === "ship") {
      return options("ship_goods").filter(o => same(o.action.depots, ui.shipDepots) && same(o.action.goods, ui.shipGoods));
    }
    return options(ui.mode).filter(({action: a}) =>
      (ui.mode === "sell" ? a.goods === ui.goods : a.tile === ui.tile)
      && (ui.mode !== "place" || a.cell === ui.cell)
      && (!Object.hasOwn(a, "discard") || a.discard === ui.discard));
  }
  function findTile(id) {
    return [...view.depots.flatMap(d => d.tiles), ...view.players.flatMap(p => p.storage)].find(t => t.id === id);
  }
  function openDialog(title, html) {
    returnFocus = panel.querySelector(`[data-burgundy="${title === "Explain" ? "explain" : "help"}"]`) || document.activeElement;
    dialog.innerHTML = `<header><h2 id="burgundyDialogTitle">${esc(title)}</h2><button type="button" data-burgundy-close>Close</button></header><div class="burgundy-dialog-body">${html}</div>`;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector("[data-burgundy-close]").focus();
  }
  function closeDialog() { dialog.close(); returnFocus?.focus(); }
  function help() {
    openDialog("Help · 勃艮第城堡", `<p>2011 基础版 · 2–4 人 · 标准 1 号领地。共五个阶段 A–E，每阶段五轮，每轮每人连续使用两颗骰子。</p>
      <h3>🎲 How to play</h3><ol><li>选择一颗未使用的骰子，再选行动和目标。系统按最短路径计算工人费用，1 与 6 相邻，每一步花 1 👷。</li>
      <li><b>Take</b>：按骰点从货站拿一块板块，放入三格仓库；仓库满时必须选一块旧板块丢弃。</li>
      <li><b>Place</b>：点仓库板块，再点同色、点数相符、邻接已建板块的空格。知识与工人可以调整点数。</li>
      <li><b>Sell</b>：出售骰点对应种类的全部货物，获得 1 🪙，每件获得玩家人数那么多的 ⭐。</li>
      <li><b>Workers</b>：任意骰点获得 2 👷。<b>Buy</b>：每回合额外花 2 🪙 买一块黑市板块，无需骰子。</li>
      <li>奖励步骤即时处理。两颗骰子用完后，可继续购买，再点 <b>End Turn</b>。每轮全员点 <b>Next Round</b> 才继续。</li></ol>
      <h3>🏰 Tile effects</h3><p>城堡提供一个任意点数的额外行动；船只取一个货站的货物，并推进下轮顺序，同格后来者优先。货物最多三种，同种无限叠放。矿山每阶段末各产 1 🪙。</p>
      <p>动物按同一牧场的同类动物总数计分。同一城市不能重复建筑（知识 1 例外）。仓库售货、木工坊拿建筑、教堂拿城堡／矿山／知识、市场拿船／动物；旅馆给 4 👷、银行给 2 🪙、瞭望塔给 4 ⭐、市政厅免费放一个仓库板块。</p>
      <h3>⭐ Scoring</h3><p>每个完整区域得 1 / 3 / 6 / 10 / 15 / 21 / 28 / 36 分（1–8 格），另加本阶段 10 / 8 / 6 / 4 / 2 分。每色第一个完成全部格子的玩家得人数 + 3 分，第二位得人数分。</p>
      <p>终局每件未售货物、每枚银币各得 1 分，每两工人得 1 分，再加知识分。仓库中的板块不计分。同分时空格更多者获胜，仍相同则最终顺序更靠后者获胜（英文初版勘误）。</p>
      <h3>📜 Knowledge 1–26</h3><div class="burgundy-knowledge-list">${Object.entries(view.knowledge).sort((a,b) => Number(a[0])-Number(b[0])).map(([n, t]) => `<p><b>${n}.</b> ${esc(t)}</p>`).join("")}</div>
      <p class="burgundy-muted">本实现采用原版知识 6、15、24：买板块只支付银币；已售货物种类每种 3 分；动物种类每种 4 分。不含扩展和其他领地。</p>
      <p><a href="https://cdn.1j1ju.com/medias/04/f5/f9-the-castles-of-burgundy-rulebook.pdf" target="_blank" rel="noopener noreferrer">Original rules</a> · <a href="https://www.yucata.de/en/Rules/CastlesOfBurgundy" target="_blank" rel="noopener noreferrer">Tie-break correction</a></p>`);
  }
  function renderPlayers() {
    return `<div class="burgundy-players">${view.turn_order.map((id, i) => {
      const p = player(id);
      return button(`<span class="burgundy-player-name">${p.is_bot ? "🤖 " : ""}${esc(p.name)}${id === view.you ? " · You" : ""}</span><strong>⭐ ${p.score}</strong><small>🪙 ${p.silver} · 👷 ${p.workers} · ⛵ ${p.ships}</small>`,
        "player", "Inspect this player's estate, storage, goods and knowledge.", `burgundy-player ${id === view.current_turn ? "is-turn" : ""} ${id === ui.viewed ? "is-selected" : ""}`, false, attr("player", id));
    }).join("")}</div>`;
  }
  function renderEstate() {
    const p = player(ui.viewed) || self() || view.players[0];
    const available = options("place").filter(o => o.action.tile === ui.tile && p.player_id === view.you);
    const cells = p.estate.map(c => {
      const legal = available.some(o => o.action.cell === c.id);
      const title = `Hex ${c.id + 1} · ${kinds[c.kind][1]} · die ${c.number}. ${c.tile ? c.tile.description : "Place a matching tile adjacent to your existing estate."}`;
      const label = c.tile ? `<span>${c.tile.emoji}</span><small>${c.tile.kind === "animal" ? "×" + c.tile.count : c.tile.kind === "knowledge" ? "#" + c.tile.number : "✓"}</small>`
        : `<span class="burgundy-hex-number">${dice[c.number - 1]}</span>`;
      const x = 50 + (c.q + c.r / 2) * 13.75;
      const y = 50 + c.r * 12.5;
      return `<div class="burgundy-hex-slot" style="left:${x}%;top:${y}%">${button(label, "cell", title,
        `burgundy-hex burgundy-${c.kind} ${c.tile ? "is-built" : ""} ${legal ? "is-legal" : ""} ${ui.cell === c.id ? "is-selected" : ""}`,
        !legal, `${attr("cell", c.id)} aria-label="${esc(title)}" title="${esc(title)}"`)}</div>`;
    }).join("");
    return `<section class="burgundy-card burgundy-estate-card"><div class="burgundy-section-heading"><h3>🏰 ${esc(p.name)}’s estate</h3><span>${p.estate.filter(c => c.tile).length} / 37</span></div>
      <div class="burgundy-estate" aria-label="Standard estate number 1">${cells}</div>
      <div class="burgundy-legend">${Object.values(kinds).map(([e,n]) => `<span>${e} ${n}</span>`).join("")}</div>
      <div class="burgundy-section-heading"><h3>Storage</h3><small>${p.storage.length} / 3</small></div>
      <div class="burgundy-storage">${[0,1,2].map(i => {
        const t = p.storage[i];
        if (!t) return '<div class="burgundy-empty-slot">Empty</div>';
        const available = options("place").some(o => o.action.tile === t.id);
        return button(tileMarkup(t), "storage", t.description, `burgundy-tile burgundy-${t.kind} ${ui.tile === t.id ? "is-selected" : ""}`, !available || p.player_id !== view.you, attr("tile", t.id));
      }).join("")}</div>
      <div class="burgundy-goods">${goodsMarkup(p.goods)}</div>
      <details class="burgundy-details"><summary>📜 Knowledge (${p.knowledge.length}) & progress</summary>
      ${p.knowledge.map(n => `<p><b>#${n}</b> ${esc(view.knowledge[n])}</p>`).join("") || '<p>No knowledge tiles yet.</p>'}
      <p>Sold: ${goodsMarkup(p.sold)}</p><p>Colour bonuses: ${p.bonus_tiles.map(b => `${kinds[b.kind][0]} +${b.points}`).join(" · ") || "None"}</p>
      <p>Next order: ${view.next_order.map(id => esc(name(id))).join(" → ")}</p></details></section>`;
  }
  function renderConfirmation() {
    const selected = selectionOptions()[0];
    const tile = findTile(ui.tile);
    const isShip = view.pending?.kind === "ship";
    let text = isShip ? "Choose a depot to collect its goods." : tile ? `${tile.emoji} ${tile.name}` : "Select a die, an action and a target.";
    if (ui.mode === "sell" && ui.goods) text = `${colours[ui.goods - 1]} Sell all type ${ui.goods} goods`;
    if (ui.mode === "place" && tile && ui.cell === null) text += " · choose a highlighted hex";
    const needDiscard = ["take", "buy"].includes(ui.mode) && tile && self()?.storage.length === 3;
    const replacement = needDiscard ? `<p class="burgundy-hint">Storage full · choose a tile to discard:</p><div class="burgundy-inline">${self().storage.map(t => button(`${t.emoji} ${esc(t.name)}`, "discard", "Discard this stored tile to make room for the new tile. This cannot be undone.", ui.discard === t.id ? "is-selected" : "", false, attr("tile", t.id))).join("")}</div>` : "";
    if (selected) {
      const a = selected.action;
      const target = a.type === "place" ? self().estate[a.cell].number : a.type === "take" ? a.depot : a.type === "sell" ? a.goods : null;
      text += a.type === "buy" ? " · 2 🪙" : ` · ${selected.workers} 👷${target ? ` · target ${dice[target - 1]}` : ""}`;
      if (a.type === "ship_goods") text = `Collect from depot ${a.depots.join(" + ")} · ${a.goods.map(n => colours[n-1] + " " + n).join(", ") || "No compatible goods"}`;
      if (a.type === "place") text += ` · hex ${a.cell + 1}`;
    }
    return `<div class="burgundy-confirm"><p>${esc(text)}</p>${tile ? `<small>${esc(tile.description)}</small>` : ""}${replacement}
      ${button("Confirm", "confirm", "Submit the selected action and pay the displayed cost.", "burgundy-primary", !selected)}</div>`;
  }
  function renderActions() {
    const p = self();
    if (view.game_over) {
      return `<section class="burgundy-card burgundy-action-card"><h3>🏆 ${view.winner.map(id => esc(name(id))).join(", ")}</h3><p>Game complete · final scoring</p>
        ${Object.entries(view.final_scores).map(([pid, s]) => `<div class="burgundy-final"><strong>${esc(name(pid))} · ⭐ ${s.total}</strong><p>Play ${s.during_game} · Goods ${s.goods} · 🪙 ${s.silver} · 👷 ${s.workers} · 📜 ${s.knowledge}</p>${Object.keys(s.knowledge_details).length ? `<small>${Object.entries(s.knowledge_details).map(([n,v]) => `#${n}: ${v}`).join(" · ")}</small>` : ""}</div>`).join("")}</section>`;
    }
    if (view.phase === "round_end") {
      return `<section class="burgundy-card burgundy-action-card"><h3>Round complete</h3><p>${view.ready.length} / ${view.players.length} ready</p>
        ${view.players.map(p => `<div class="burgundy-review"><span>${esc(p.name)} ${view.ready.includes(p.player_id) ? "✓" : ""}</span><b>⭐ +${view.review.delta[p.player_id].score}</b>${view.review.income[p.player_id] ? `<small>Income: 🪙 +${view.review.income[p.player_id].silver} · 👷 +${view.review.income[p.player_id].workers}</small>` : ""}</div>`).join("")}
        ${button("Next Round", "next", "Confirm you have reviewed this round. Play resumes only after every player is ready.", "burgundy-primary", !options("next_round").length)}</section>`;
    }
    if (!p || view.current_turn !== view.you) {
      return `<section class="burgundy-card burgundy-action-card"><h3>${p ? "Waiting for" : "Spectating"} ${esc(name(view.current_turn))}</h3><p>You can inspect every estate while the current player acts.</p>
      <div class="burgundy-all-dice">${view.players.map(p => `<div><span>${esc(p.name)}</span><b>${p.dice.map((n,i) => `<span class="${p.used[i] ? "is-used" : ""}">${dice[n-1]}</span>`).join(" ")}</b></div>`).join("")}</div></section>`;
    }
    const modes = [["take", "Take"], ["place", "Place"], ["sell", "Sell"], ["buy", "Buy · 2 🪙"]];
    const descriptions = {take: "Take a tile from a depot matching your die, using workers if needed.", place: "Place a stored tile on a matching, adjacent estate hex.", sell: "Sell all goods of one type: 1 silverling per sale, 2–4 VP per goods tile.", buy: "Once per turn, spend 2 silverlings to buy from the black depot. Knowledge 6 also permits numbered depots."};
    let controls = `<div class="burgundy-dice">${p.dice.map((n,i) => button(dice[n-1], "die", `Die ${i+1}: value ${n}. Workers adjust the result; 1 and 6 are adjacent.`, `${ui.die === i ? "is-selected" : ""} ${p.used[i] ? "is-used" : ""}`, p.used[i] || !!view.pending, attr("die", i))).join("")}<span>🪙 ${p.silver} · 👷 ${p.workers}</span></div>`;
    if (view.pending) controls += `<div class="burgundy-bonus">${esc(effects[view.pending.kind])}</div>`;
    if (view.pending?.kind === "ship") {
      const available = [...new Set(ui.shipDepots.flatMap(d => view.depots[d].goods))].sort();
      controls += `<p class="burgundy-hint">Choose ${p.knowledge.includes(5) ? "one depot or two adjacent depots" : "one depot"} below, then select goods if needed.</p><div class="burgundy-inline">${available.map(n => button(`${colours[n-1]} ${n}`, "ship-good", "Take all goods of this type from the selected depots. Your goods storage may contain at most three types.", ui.shipGoods.includes(n) ? "is-selected" : "", false, attr("goods", n))).join("")}</div>`;
    } else {
      controls += `<div class="burgundy-modes">${modes.map(([mode, label]) => button(label, "mode", descriptions[mode], ui.mode === mode ? "is-selected" : "", !options(mode).length, attr("mode",mode))).join("")}</div>`;
      if (ui.mode === "sell") controls += `<div class="burgundy-inline">${p.goods.map((n,i) => n ? button(`${colours[i]} ${i+1} ×${n}`, "sell", descriptions.sell, ui.goods === i+1 ? "is-selected" : "", !options("sell").some(o => o.action.goods === i+1), attr("goods",i+1)) : "").join("")}</div>`;
    }
    controls += renderConfirmation();
    const worker = options("workers")[0];
    controls += `<div class="burgundy-inline burgundy-turn-buttons">${button(`Workers · +${p.knowledge.includes(14) ? 4 : 2} 👷`, "workers", "Spend the selected die to gain workers. Knowledge 13 adds 1 silverling; knowledge 14 gives 4 workers.", "", !worker)}
      ${options("skip_bonus").length ? button("Skip Bonus", "skip", "Decline this optional building effect and resume your turn.") : ""}
      ${button("End Turn", "end", "Finish your turn after using both dice and resolving bonuses. You may buy a tile before ending.", "", !options("end_turn").length)}</div>`;
    return `<section class="burgundy-card burgundy-action-card"><div class="burgundy-section-heading"><h3>Your turn</h3><small>${p.used.filter(Boolean).length} / 2 dice used</small></div>${controls}</section>`;
  }
  function renderDepots() {
    const buying = ui.mode === "buy";
    const ship = view.pending?.kind === "ship" && view.you === view.current_turn;
    return `<section class="burgundy-card burgundy-market-card"><div class="burgundy-section-heading"><h3>Trading depots</h3><span>White die ${dice[view.white_die-1]}</span></div>
      <div class="burgundy-depots">${[...view.depots.slice(1), view.depots[0]].map(d => {
        const header = d.id ? `${dice[d.id-1]} Depot ${d.id}` : "🪙 Black depot";
        return `<div class="burgundy-depot ${d.id === 0 ? "burgundy-black-depot" : ""} ${ui.shipDepots.includes(d.id) ? "is-selected" : ""}"><div class="burgundy-depot-heading">${ship && d.id ? button(header, "ship-depot", "Choose this depot's goods. Knowledge 5 permits two adjacent depots.", "", false, attr("depot",d.id)) : `<h4>${header}</h4>`}</div>
        <div class="burgundy-depot-tiles">${d.tiles.map(t => {
          const type = d.id === 0 || buying ? "buy" : "take";
          const legal = !ship && options(type).some(o => o.action.tile === t.id);
          return button(tileMarkup(t), "tile", t.description, `burgundy-tile burgundy-${t.kind} ${ui.tile === t.id ? "is-selected" : ""}`, !legal,
            `${attr("tile", t.id)}${attr("depot", d.id)}${attr("mode",type)} title="${esc(t.description)}"`);
        }).join("") || '<span class="burgundy-muted">Empty</span>'}</div>${d.id ? `<div class="burgundy-depot-goods">${d.goods.map(g => `<span title="Goods ${g}">${colours[g-1]}<b>${g}</b></span>`).join("") || '<small>No goods</small>'}</div>` : ""}</div>`;
      }).join("")}</div></section>`;
  }
  function render() {
    if (!view) return;
    const focused = document.activeElement?.getAttribute("data-burgundy");
    panel.innerHTML = `<header class="burgundy-header"><div><span class="burgundy-eyebrow">THE LOIRE VALLEY · 15TH CENTURY</span><h2>勃艮第城堡</h2><p>The Castles of Burgundy</p></div><div class="burgundy-header-right"><div class="burgundy-inline">${button("Help", "help", "Read the game rules.")}${button(explain ? "Explain · On" : "Explain", "explain", "Inspect controls without triggering an action.", explain ? "is-selected" : "")}</div><strong>Phase ${"ABCDE"[view.stage-1]} · Round ${view.round} / 5</strong><small>Region bonus +${12 - view.stage * 2} ⭐</small></div></header>
      ${renderPlayers()}<nav class="burgundy-mobile-tabs" aria-label="Game panels">${button("🏰 Estate", "tab", "Show the selected player's estate and storage.", ui.tab !== "depots" ? "is-selected" : "", false, attr("tab", "estate"))}${button("⛵ Depots", "tab", "Show the common tile market and goods depots.", ui.tab === "depots" ? "is-selected" : "", false, attr("tab", "depots"))}</nav>
      <div class="burgundy-layout">${renderEstate()}<div class="burgundy-right">${renderActions()}${renderDepots()}</div></div>
      <div class="burgundy-footer"><div class="burgundy-bonuses">${Object.entries(view.bonuses).map(([k,ids]) => `<span>${kinds[k][0]} ${ids.length}/2</span>`).join("")}<small>Next goods: ${view.round_goods.map(n => `${colours[n-1]}${n}`).join(" ") || "Phase end"}</small></div>
      <details class="burgundy-details"><summary>Log · recent actions</summary><div class="burgundy-log">${view.log.slice().reverse().map(t => `<p>${esc(t)}</p>`).join("")}</div></details></div>`;
    panel.classList.toggle("burgundy-explaining", explain);
    panel.dataset.mobileTab = ui.tab || "estate";
    if (focused === "explain") panel.querySelector('[data-burgundy="explain"]')?.focus();
  }
  function submit(option) {
    if (!option) return;
    sendAction(option.action);
    resetSelection();
  }
  panel.addEventListener("click", event => {
    const b = event.target.closest("button[data-burgundy]");
    if (!b) {
      if (!event.target.closest("summary, details, label, input, a")) { resetSelection(); render(); }
      return;
    }
    const command = b.dataset.burgundy;
    if (command === "help") { explain = false; render(); help(); return; }
    if (command === "explain") { explain = !explain; render(); return; }
    if (command === "player") { ui.viewed = b.dataset.player; ui.tab = "estate"; }
    else if (command === "tab") ui.tab = b.dataset.tab;
    else if (command === "die") { resetSelection(); ui.die = Number(b.dataset.die); }
    else if (command === "mode") { resetSelection(); ui.mode = b.dataset.mode; ui.tab = ["take", "buy"].includes(ui.mode) ? "depots" : "estate"; }
    else if (command === "tile") { resetSelection(); ui.tile = b.dataset.tile; ui.depot = Number(b.dataset.depot); ui.mode = b.dataset.mode; }
    else if (command === "storage") { resetSelection(); ui.tile = b.dataset.tile; ui.mode = "place"; ui.viewed = view.you; }
    else if (command === "cell") ui.cell = Number(b.dataset.cell);
    else if (command === "discard") ui.discard = b.dataset.tile;
    else if (command === "sell") ui.goods = Number(b.dataset.goods);
    else if (command === "ship-depot") {
      const d = Number(b.dataset.depot);
      if (ui.shipDepots.includes(d)) ui.shipDepots = ui.shipDepots.filter(n => n !== d);
      else if (self().knowledge.includes(5) && ui.shipDepots.length === 1 && [1,5].includes(Math.abs(d-ui.shipDepots[0]))) ui.shipDepots.push(d);
      else ui.shipDepots = [d];
      ui.shipDepots.sort((a,b) => a-b);
      const possible = options("ship_goods").filter(o => same(o.action.depots, ui.shipDepots));
      ui.shipGoods = possible.length === 1 ? possible[0].action.goods.slice() : [...new Set(ui.shipDepots.flatMap(d => view.depots[d].goods))].filter(n => self().goods[n-1]).sort();
    } else if (command === "ship-good") {
      const n = Number(b.dataset.goods);
      if (!self().goods[n-1]) {
        ui.shipGoods = ui.shipGoods.includes(n) ? ui.shipGoods.filter(g => g !== n) : [...ui.shipGoods, n].sort();
      }
    } else if (command === "confirm") { submit(selectionOptions()[0]); return; }
    else if (["workers", "end", "skip", "next"].includes(command)) {
      submit(options({workers: "workers", end: "end_turn", skip: "skip_bonus", next: "next_round"}[command])[0]); return;
    }
    render();
  });
  dialog.addEventListener("click", e => {
    if (e.target.closest("[data-burgundy-close]")) closeDialog();
    else if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
    }
  });
  dialog.addEventListener("cancel", e => { e.preventDefault(); closeDialog(); });
  document.addEventListener("keydown", e => {
    if (panel.classList.contains("hidden")) return;
    if (e.key === "Escape" && !dialog.open) { explain = false; resetSelection(); render(); }
  });
  document.addEventListener("pointerdown", e => {
    if (!explain || panel.classList.contains("hidden") || dialog.open) return;
    const target = [...panel.querySelectorAll("button[data-explain]")].find(b => {
      if (["help", "explain"].includes(b.dataset.burgundy)) return false;
      const r = b.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });
    if (!target) return;
    e.preventDefault(); e.stopImmediatePropagation();
    suppressClickUntil = performance.now() + 450;
    const text = target.dataset.explain;
    explain = false; render();
    openDialog("Explain", `<p>${esc(text)}</p>`);
  }, true);
  document.addEventListener("click", e => {
    if (panel.classList.contains("hidden") || e.target.closest("dialog, [data-burgundy='help'], [data-burgundy='explain']")) return;
    if (performance.now() < suppressClickUntil) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (!explain) return;
    const b = e.target.closest("button");
    if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (b.dataset.explain) { explain = false; render(); openDialog("Explain", `<p>${esc(b.dataset.explain)}</p>`); }
  }, true);
  window.renderBurgundyGameState = payload => {
    const oldStored = view ? self()?.storage.length : 0;
    view = payload.view || payload.state || payload;
    resetSelection();
    const p = self();
    ui.die = p ? p.used.findIndex(used => !used) : null;
    if (!player(ui.viewed)) ui.viewed = view.you || view.players[0].player_id;
    ui.mode = view.pending ? ({city_hall:"place",warehouse:"sell"}[view.pending.kind] || "take") : "take";
    if (p && p.storage.length > oldStored) ui.tab = "estate";
    if (view.pending && view.current_turn === view.you) {
      ui.tab = ["ship", "workshop", "church", "market"].includes(view.pending.kind) ? "depots" : "estate";
    }
    render();
  };
  window.showBurgundyHeaderActions = visible => {
    if (!visible) { explain = false; if (dialog.open) dialog.close(); }
  };
  window.clearBurgundyState = () => { view = null; ui = {}; explain = false; panel.replaceChildren(); if (dialog.open) dialog.close(); };
})();
