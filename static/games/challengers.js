(() => {
  "use strict";
  const panel = document.getElementById("challengersPanel");
  const content = document.getElementById("challengersContent");
  const header = document.getElementById("challengersHeaderActions");
  const helpButton = document.getElementById("challengersHelpBtn");
  const explainButton = document.getElementById("challengersExplainBtn");
  const dialog = document.getElementById("challengersDialog");
  const dialogTitle = document.getElementById("challengersDialogTitle");
  const dialogBody = document.getElementById("challengersDialogBody");
  const dialogClose = document.getElementById("challengersDialogClose");
  const tip = document.getElementById("challengersTip");
  const configBox = document.getElementById("challengersConfigBox");
  let view = null;
  let selected = [];
  let park = null;
  let signature = null;
  let renderedContext = null;
  let roomSignature = null;
  let pending = false;
  let pendingRevision = null;
  let pendingTimer = null;
  let tipTimer = null;
  let explaining = false;
  let suppressed = null;
  let focusBeforeDialog = null;
  let lastPointerType = "mouse";
  const openLogs = new Set();
  const stageLabels = {choose_level: "Choose a level", pick: "Drafting", trim: "Preparing deck", ready: "Ready", match: "In match", finished: "Match finished", spectating: "Watching"};
  const explain = {
    pick: "先选一张候选牌，再点 Pick。新牌立即加入你的牌组。等级 A / B / C 和本轮可选张数在上方显示。",
    redraw: "每轮可重抽一次全部剩余候选。允许先选第一张，再重抽剩余四张；重抽不能更换等级。",
    ready: "选中要永久移除的牌，再点 Ready；不选任何牌即可原样参赛。同名牌共用替补席(🪑)，但牌组不限制六种。双方 Ready 后独立开始对战。",
    level: "A 为初级、B 为中级、C 为高级。每轮允许的等级和选牌张数不同，选择后本轮不能更换。",
    reveal: "Reveal 翻开牌顶一张，先处理能力，再比较战力(⚔️)。攻击可累加多张；达到防守战力就必须立即夺旗(🚩)，此后只有最后一张防守。",
    resolve: "选择卡牌能力的目标，再点 Confirm。顺序选择中的编号表示牌顶到牌底；可选能力可 Skip。看牌信息只有你能看到。",
    next: "本轮场面与奖杯(🏆)结果会保留到每个席位确认 Next Round。房间 AI 自动确认，真人及断线席位必须本人确认。",
    bench: "替补席(🪑)最多六种名称。同名牌叠放一格，即使等级不同。失旗时整叠进入替补席，放不下就输；替补能力逐张叠加。",
    flag: "旗帜(🚩)只由最上方的一张牌持有。压在下面的牌不提供战力或效果；失旗时整叠一起去替补席。",
    score: "粉丝(⭐)包括公开标记与奖杯(🏆)背面的分数。多人局其他人的奖杯分数到第七轮结束才揭晓；届时前二决赛。同分比较奖杯数量，再比较最高轮次。",
    park: "每个公园独立进行一场对战。可以观看其他公园；你的操作区始终对应自己的比赛。",
    deck: "同名卡合并展示数量，但 S 起始版与市场版仍保留各自等级。比赛中牌序保密，只有特定效果能查看。疲劳区(💤)的牌在下轮回到牌组。",
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
  const name = pid => view?.players.find(p => p.player_id === pid)?.name || "—";
  const legal = type => !pending && view?.legal_actions.includes(type);
  const ownMatch = () => view?.matches.find(m => m.seats.includes(view.you));
  const groups = cards => {
    const grouped = new Map();
    cards.forEach(card => {
      if (!grouped.has(card.kind)) grouped.set(card.kind, []);
      grouped.get(card.kind).push(card);
    });
    return [...grouped.values()];
  };
  const cardText = card => `${card.name_zh} · ${card.name} · ${view.set_info[card.set].name} · ${card.level} · 战力(⚔️) ${card.power}。${card.description}`;
  const tipAttrs = (text, key = "") => `tabindex="0" data-ch-tip="${esc(text)}"${key ? ` data-ch-explain="${key}"` : ""}`;
  function button(label, action, key, disabled = false, extra = "") {
    return `<button type="button" data-ch-action="${action}" data-ch-explain="${key}" ${disabled ? "disabled" : ""} ${extra}>${label}</button>`;
  }

  function cardHTML(card, selectable = false) {
    const index = selected.indexOf(card.id);
    const attrs = `class="ch-card${index >= 0 && selectable ? " is-selected" : ""}" style="--set-color:${view.set_info[card.set].color}" data-ch-effect="${esc(card.effect)}" data-ch-explain="card" data-ch-description="${esc(cardText(card))}"`;
    const details = `<span class="ch-card-top"><span class="ch-power">${card.total_power ?? card.power}</span><span class="ch-card-level">${view.set_info[card.set].icon} ${card.level}</span>${selectable ? `<span class="ch-selection-number">${index >= 0 ? index + 1 : ""}</span>` : ""}</span>
      <span class="ch-card-portrait" aria-hidden="true">${card.icon}</span><strong>${esc(card.name_zh)}</strong><small>${esc(card.name)}</small><span class="ch-card-effect">${esc(card.description)}</span>`;
    return selectable ? `<button type="button" ${attrs} data-ch-card="${card.id}" aria-pressed="${index >= 0}" ${pending ? "disabled" : ""}>${details}</button>`
      : `<div ${attrs} ${tipAttrs(cardText(card))}>${details}</div>`;
  }

  function scoreHTML() {
    return `<div class="ch-scoreboard">${view.players.map(p => `<div class="ch-player${p.player_id === view.you ? " is-you" : ""}${view.winner.includes(p.player_id) ? " is-winner" : ""}" data-ch-explain="score">
      <div class="ch-player-name"><strong>${p.robot ? "🤖 " : ""}${esc(p.name)}</strong><small>${p.player_id === view.you ? "YOU" : p.is_bot ? "BOT" : ""}</small></div>
      <div class="ch-player-stats"><span ${tipAttrs(`粉丝(⭐)：${p.total === null ? `公开 ${p.fans}，奖杯分数保密` : `总计 ${p.total}，标记 ${p.fans}`}`, "score")}>⭐ ${p.total === null ? `${p.fans} + ?` : p.total}</span>
      <span ${tipAttrs(`奖杯(🏆)：${p.trophies.length ? p.trophies.map(t => `第 ${t.round} 轮${t.fans === null ? "（分数保密）" : ` · ${t.fans} 粉丝`}`).join("；") : "尚未获胜"}`, "score")}>🏆 ${p.trophies.length}</span>
      <span ${tipAttrs(`牌组(🃏)：${p.deck_count} 张`, "deck")}>🃏 ${p.deck_count}</span></div>
      <span class="ch-player-stage">${view.game_over ? view.winner.includes(p.player_id) ? "Champion" : "Tournament finished" : view.phase === "round_end" ? p.robot || p.ready ? "✓ Ready" : "Reviewing" : stageLabels[p.stage] || p.stage}</span>
    </div>`).join("")}</div>`;
  }

  function deckHTML() {
    const kept = view.deck.filter(c => !selected.includes(c.id) || view.stage !== "trim");
    return `<section class="ch-section"><div class="ch-section-head"><h3>🃏 我的牌组</h3><span class="ch-badge">${view.deck.length} cards</span></div>
      <div class="ch-deck-stats"><span data-ch-kept-kinds ${tipAttrs(explain.bench, "bench")}>🪑 ${groups(kept).length} 种 / 6 格</span><span data-ch-kept-power ${tipAttrs("战力(⚔️)：保留牌组的基础战力总和，不计能力加成；单张持旗时仅使用那张牌的战力。")}>⚔️ ${kept.reduce((n, c) => n + c.power, 0)} 基础战力</span></div>
      <div class="ch-deck-list" data-ch-scroll="deck">${groups(view.deck).sort((a, b) => a[0].set.localeCompare(b[0].set) || b[0].power - a[0].power).map(group => {
        const c = group[0];
        return `<div class="ch-deck-row" style="--set-color:${view.set_info[c.set].color}" ${tipAttrs(`${cardText(c)} · ${group.length} 张`, "deck")}><span>${c.icon}</span><strong>${esc(c.name_zh)}</strong><small>${c.power} × ${group.length}</small></div>`;
      }).join("")}</div><div class="ch-theme-row">${view.sets.map(s => `<span class="ch-theme" ${tipAttrs(`${view.set_info[s].name}(${view.set_info[s].icon})：本局启用的卡牌系列`)}>${view.set_info[s].icon} ${view.set_info[s].name}</span>`).join("")}</div></section>`;
  }

  function choiceHTML() {
    const choice = view.choice;
    const titles = {extra_pick: "移除牌以额外选牌", exhaust: "选择疲劳区目标", recover: "选择回收的牌", order: "选择牌顶顺序", split: "选择保留在牌顶的牌", top: "选择置顶的牌", bottom: "选择放到牌底的牌"};
    const valid = selected.length >= choice.min && selected.length <= choice.max;
    const optional = choice.optional || choice.min === 0;
    return `<section class="ch-section"><div class="ch-section-head"><h3>${choice.source.icon} ${esc(choice.source.name_zh)}</h3><span class="ch-badge">${choice.min === choice.max ? choice.max : `${choice.min}–${choice.max}`} cards</span></div>
      <p class="ch-caption">${titles[choice.kind]}${choice.kind === "order" ? " · 先选的在最上面" : ""}</p>
      <div class="ch-market" data-ch-scroll="${esc(`choice:${choice.source.id}:${choice.kind}:${choice.cards.map(c => c.id).join(",")}`)}">${choice.cards.map(c => cardHTML(c, true)).join("")}</div>
      <div class="ch-actions">${button("Confirm", "resolve", "resolve", !valid || pending, 'class="ch-primary"')}${optional ? button("Skip", "skip", "resolve", pending) : ""}</div></section>`;
  }

  function draftHTML() {
    if (view.choice) return choiceHTML();
    if (view.stage === "choose_level") return `<section class="ch-section"><div class="ch-section-head"><h3>🃏 选择等级</h3><span class="ch-badge">Round ${view.round}</span></div>
      <div class="ch-actions">${Object.entries(view.level_options).map(([level, count]) => button(`${level} · Pick ${count}`, "level", "level", !legal("choose_level"), `class="ch-primary" data-level="${level}"`)).join("")}</div></section>`;
    const trim = view.stage === "trim";
    const cards = trim ? [...view.deck].sort((a, b) => a.set.localeCompare(b.set) || b.power - a.power || a.kind.localeCompare(b.kind)) : view.offer;
    return `<section class="ch-section"><div class="ch-section-head"><h3>${trim ? "✂️ 调整牌组" : "🃏 招募队员"}</h3><span class="ch-badge" ${trim ? "data-ch-trim-count" : ""}>${trim ? `${selected.length} selected to remove` : `${view.level} · Pick ${view.picks_left}`}</span></div>
      <div class="ch-market" data-ch-scroll="${esc(`${view.stage}:${cards.map(c => c.id).join(",")}`)}">${cards.map(c => cardHTML(c, true)).join("")}</div><div class="ch-actions">${trim
        ? button(selected.length ? `Remove ${selected.length} & Ready` : "Ready", "ready", "ready", !legal("ready"), 'class="ch-primary"')
        : button("Pick", "pick", "pick", selected.length !== 1 || !legal("pick"), 'class="ch-primary"') + button(view.redrawn ? "Redraw used" : "Redraw", "redraw", "redraw", !legal("redraw"))}</div>
      ${trim ? `<p class="ch-caption" data-ch-trim-caption>${cards.length === selected.length ? "Empty deck · You will lose this match." : "Select cards to remove, or keep your deck and press Ready."}</p>` : ""}</section>`;
  }

  function benchHTML(lane) {
    const seats = groups(lane.bench);
    return `<div class="ch-bench-heading" ${tipAttrs(explain.bench, "bench")}><span>🪑 替补席</span><span>${seats.length}/6</span></div><div class="ch-bench">${Array.from({length: Math.max(6, seats.length)}, (_, i) => {
      const group = seats[i];
      if (!group) return `<div class="ch-bench-seat" ${tipAttrs(`替补席(🪑)空格 ${i + 1}`, "bench")}>${i + 1}</div>`;
      const card = group[0];
      return `<div class="ch-bench-seat is-occupied" style="--set-color:${view.set_info[card.set].color}" ${tipAttrs(`${cardText(card)} · 共 ${group.length} 张`, "bench")}><span>${card.icon} ×${group.length}</span><strong>${esc(card.name_zh)}</strong></div>`;
    }).join("")}</div>`;
  }

  function arenaHTML() {
    const match = view.matches.find(m => m.id === park) || ownMatch() || view.matches[0];
    if (!match) return "";
    const tabs = view.matches.length > 1 ? `<div class="ch-tabs">${view.matches.map(m => button(`🌳 Park ${m.id + 1}${m.seats.includes(view.you) ? " · You" : ""}${m.status === "done" ? " ✓" : ""}`, "park", "park", false, `data-park="${m.id}" aria-pressed="${m.id === match.id}"`)).join("")}</div>` : "";
    return `<section class="ch-arena">${tabs}<div class="ch-section-head"><h3>🚩 ${view.round === 8 ? "决赛" : `公园 ${match.id + 1}`}</h3><span class="ch-badge">${match.status === "waiting" ? "Preparing" : match.status === "done" ? "Final whistle" : "Live"}</span></div>
      ${match.status === "done" ? `<div class="ch-result"><strong>🏆 ${esc(name(match.winner))}</strong><span>${match.reason === "bench_full" ? "对手替补席已满" : "对手无法继续夺旗"}${match.trophy === null ? "" : ` · ⭐ +${match.trophy}`}</span></div>` : ""}
      <div class="ch-versus">${match.seats.map(pid => {
        const lane = match.lanes[pid];
        if (!lane) return `<div class="ch-lane"><div class="ch-lane-head"><strong>${esc(name(pid))}</strong></div><div class="ch-empty">${stageLabels[view.players.find(p => p.player_id === pid)?.stage] || "Waiting"}</div></div>`;
        const field = lane.field.at(-1);
        const stack = lane.field.slice(0, -1);
        return `<div class="ch-lane${match.holder === pid ? " is-holder" : ""}"><div class="ch-lane-head"><strong>${esc(name(pid))}</strong><span ${tipAttrs(match.holder === pid ? "旗帜(🚩)：当前由最上方一张牌防守" : "战力(⚔️)：本次攻击已翻出的牌合计", "flag")}>${match.holder === pid ? "🚩" : "⚔️"} ${lane.power}</span></div>
          <div class="ch-field">${field ? cardHTML(field) : '<div class="ch-empty">⚔️<br>Waiting for a card</div>'}${stack.length ? `<span class="ch-stack" ${tipAttrs(stack.map(c => `${c.icon} ${c.name_zh}`).join(" · "), "flag")}>🃏 +${stack.length} ${match.holder === pid ? "underneath" : "attacking"}</span>` : ""}</div>
          ${benchHTML(lane)}<div class="ch-lane-footer"><span ${tipAttrs("牌库(🃏)：下一张及牌序保密", "deck")}>🃏 ${lane.draw_count}</span><span ${tipAttrs(`疲劳区(💤)：${lane.exhaust.length ? lane.exhaust.map(c => c.name_zh).join("、") : "暂无卡牌"}。下轮收回。`, "deck")}>💤 ${lane.exhaust.length}</span></div></div>`;
      }).join("")}</div>
      <details class="ch-logs" data-log="${match.id}" ${openLogs.has(String(match.id)) ? "open" : ""}><summary>Match log · ${match.log.length}</summary><div class="ch-log-lines" data-ch-scroll="log:${match.id}">${[...match.log].reverse().map(line => `<div>${esc(line)}</div>`).join("") || "No cards played yet."}</div></details></section>`;
  }

  function controlsHTML() {
    if (view.choice) return choiceHTML();
    let body;
    if (view.game_over) {
      body = `<div class="ch-result"><strong>🏆 ${view.winner.map(pid => esc(name(pid))).join(" · ")}</strong><span>冠军挑战者 · Tournament champion</span></div>`;
    } else if (view.phase === "round_end") {
      body = `<div class="ch-review">${view.matches.map(m => `<div class="ch-review-row">🏆 <strong>${esc(name(m.winner))}</strong><br>${m.trophy === null ? "奖杯分数保密" : `⭐ +${m.trophy}`}</div>`).join("")}</div>
        ${view.finalists.length ? `<p class="ch-caption">🏁 决赛：${view.finalists.map(p => esc(name(p))).join(" · ")}</p>` : ""}
        <div class="ch-actions">${button(view.next_ready.includes(view.you) ? "Waiting for others" : "Next Round", "next", "next", !legal("next_round"), 'class="ch-primary"')}</div>
        <p class="ch-caption">${view.next_ready.length}/${view.players.filter(p => !p.robot).length} ready</p>`;
    } else if (legal("reveal") || pending && pendingRevision !== null && view.legal_actions.includes("reveal")) {
      body = `<div class="ch-status">⚔️ 轮到你进攻</div><div class="ch-actions">${button(pending ? "Revealing…" : "Reveal", "reveal", "reveal", !legal("reveal"), 'class="ch-primary"')}</div>`;
    } else {
      const match = ownMatch();
      const waiting = match?.choosing || match?.turn;
      body = `<div class="ch-status">${view.stage === "spectating" ? "👀 Watching the final" : view.stage === "ready" ? "✓ Ready · Waiting for opponent" : view.stage === "finished" ? "✓ Match finished" : waiting ? `Waiting for ${esc(name(waiting))}` : "Waiting for players"}</div>`;
    }
    return `<section class="ch-section${!view.game_over && view.phase !== "round_end" ? " ch-combat-controls" : ""}"><div class="ch-section-head"><h3>${view.game_over ? "🏁 比赛结果" : view.phase === "round_end" ? "🏆 本轮结算" : "⚔️ 对战"}</h3></div>${body}</section>`;
  }

  function updateSelection() {
    // Keep the existing buttons, focus and scroll containers while choosing cards.
    content.querySelectorAll("[data-ch-card]").forEach(card => {
      const index = selected.indexOf(card.dataset.chCard);
      card.classList.toggle("is-selected", index >= 0);
      card.setAttribute("aria-pressed", String(index >= 0));
      card.querySelector(".ch-selection-number").textContent = index >= 0 ? index + 1 : "";
    });
    const pick = content.querySelector('[data-ch-action="pick"]');
    if (pick) pick.disabled = selected.length !== 1 || !legal("pick");
    const confirm = content.querySelector('[data-ch-action="resolve"]');
    if (confirm && view.choice) confirm.disabled = pending || selected.length < view.choice.min || selected.length > view.choice.max;
    const ready = content.querySelector('[data-ch-action="ready"]');
    if (ready) ready.textContent = selected.length ? `Remove ${selected.length} & Ready` : "Ready";
    const count = content.querySelector("[data-ch-trim-count]");
    if (count) count.textContent = `${selected.length} selected to remove`;
    const caption = content.querySelector("[data-ch-trim-caption]");
    if (caption) caption.textContent = view.deck.length === selected.length ? "Empty deck · You will lose this match." : "Select cards to remove, or keep your deck and press Ready.";
    if (view.stage === "trim") {
      const kept = view.deck.filter(c => !selected.includes(c.id));
      const kinds = content.querySelector("[data-ch-kept-kinds]");
      const power = content.querySelector("[data-ch-kept-power]");
      if (kinds) kinds.textContent = `🪑 ${groups(kept).length} 种 / 6 格`;
      if (power) power.textContent = `⚔️ ${kept.reduce((n, c) => n + c.power, 0)} 基础战力`;
    }
  }

  function render() {
    if (!view) { content.replaceChildren(); return; }
    const context = JSON.stringify([view.you, view.round, view.phase, view.stage, view.choice?.source.id, view.choice?.kind]);
    const keepPosition = context === renderedContext;
    const scrollPositions = new Map([...content.querySelectorAll("[data-ch-scroll]")].map(node => [node.dataset.chScroll, node.scrollTop]));
    const focusedCard = content.contains(document.activeElement) ? document.activeElement.dataset.chCard : null;
    const pagePosition = {left: window.scrollX, top: window.scrollY};
    const drafting = ["choose_level", "pick", "trim"].includes(view.stage) && !view.game_over && view.phase !== "round_end";
    const own = view.players.find(p => p.player_id === view.you);
    const subtitle = view.game_over ? "TOURNAMENT COMPLETE" : view.round === 8 ? "THE GRAND FINAL" : drafting ? "BUILD YOUR TEAM. CAPTURE THE FLAG." : "HOLD THE FLAG. TAKE THE TROPHY.";
    content.innerHTML = `<div class="ch-hero"><div><div class="ch-eyebrow">Challengers! / ${subtitle}</div><h2>冠军挑战者</h2><div class="ch-hero-sub">${view.sets.map(s => `<span ${tipAttrs(`${view.set_info[s].name}(${view.set_info[s].icon})：本局启用的卡牌系列`)}>${view.set_info[s].icon}</span>`).join(" ")} · ${view.players.filter(p => !p.robot).length} players${view.players.some(p => p.robot) ? " + Robot" : ""}</div></div><div class="ch-round"><strong>${view.round === 8 ? "🏆" : String(view.round).padStart(2, "0")}</strong><span>${view.round === 8 ? "FINAL" : "ROUND / 07"}</span></div></div>
      <div class="ch-track">${Array.from({length: 8}, (_, i) => `<span class="${i + 1 === view.round ? "is-current" : i + 1 < view.round ? "is-past" : ""}" ${tipAttrs(i < 7 ? `第 ${i + 1} 轮：${["A×2", "A×2", "A×2 / B×1", "A×2 / B×2", "B×2", "B×2 / C×1", "C×2"][i]}` : "决赛：不抽新牌，可以移除牌")}>${i < 7 ? i + 1 : "🏆"}</span>`).join("")}</div>
      ${scoreHTML()}<div class="ch-layout${drafting ? "" : " ch-match-layout"}">${drafting ? `<div>${draftHTML()}</div>${deckHTML()}` : `<div>${arenaHTML()}</div><div>${controlsHTML()}${own && view.deck.length && view.phase !== "round_end" && !view.game_over ? deckHTML() : ""}</div>`}</div>`;
    panel.classList.toggle("ch-explaining", explaining);
    if (keepPosition) {
      content.querySelectorAll("[data-ch-scroll]").forEach(node => {
        if (scrollPositions.has(node.dataset.chScroll)) node.scrollTop = scrollPositions.get(node.dataset.chScroll);
      });
      if (focusedCard) [...content.querySelectorAll("[data-ch-card]")].find(node => node.dataset.chCard === focusedCard)?.focus({preventScroll: true});
      window.scrollTo({...pagePosition, behavior: "instant"});
    }
    renderedContext = context;
  }

  function submit(action) {
    if (pending || !view) return;
    pending = true;
    pendingRevision = view.revision;
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => { pending = false; pendingRevision = null; render(); }, 8000);
    hideTip();
    sendAction({...action, round: view.round, revision: view.revision});
    render();
  }
  function hideTip() { tip.hidden = true; window.clearTimeout(tipTimer); }
  function showTip(text, target) {
    hideTip();
    tip.textContent = text;
    tip.hidden = false;
    const box = target.getBoundingClientRect();
    const width = tip.getBoundingClientRect().width;
    const height = tip.getBoundingClientRect().height;
    tip.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, box.left))}px`;
    tip.style.top = `${Math.max(12, Math.min(window.innerHeight - height - 12, box.bottom + 7))}px`;
    tipTimer = window.setTimeout(hideTip, 3000);
  }
  function setExplain(enabled) {
    explaining = enabled;
    panel.classList.toggle("ch-explaining", enabled);
    explainButton.setAttribute("aria-pressed", String(enabled));
    hideTip();
  }
  function openDialog(title, body) {
    hideTip();
    focusBeforeDialog = document.activeElement;
    dialogTitle.textContent = title;
    dialogBody.innerHTML = body;
    if (!dialog.open) dialog.showModal();
  }
  function showHelp() {
    setExplain(false);
    const cards = view ? Object.values(view.catalog) : [];
    openDialog("Help · 冠军挑战者", `<p>用不断优化的牌组争夺旗帜(🚩)，通过粉丝(⭐)晋级，成为冠军！支持 1–8 名玩家；Add Bot 添加的是会组牌的 AI，奇数人数另有固定牌组的 Robot(🤖) 补位。</p>
      <h3>🃏 组牌与赛程</h3><p>每人以三张新人、一张天才、一张狗和一张冠军开始。城市必选，其他六个系列选五个。每轮选择等级，查看五张候选，逐张选择。每轮可以 Redraw 一次全部剩余候选，已选第一张后也可以重抽。选完后可移除任意数量牌，再 Ready。不同公园独立进行；配对表轮转，八席前七轮会遇到所有对手，较少席位循环配对。</p>
      <table><tr><th>轮次</th><th>可选等级 / 张数</th></tr>${["A × 2", "A × 2", "A × 2 或 B × 1", "A × 2 或 B × 2", "B × 2", "B × 2 或 C × 1", "C × 2"].map((t, i) => `<tr><td>${i + 1}</td><td>${t}</td></tr>`).join("")}</table>
      <h3>⚔️ 夺旗对战</h3><p>开局洗牌。第一轮随机决定先持旗者，之后由最高轮次奖杯的持有者先持旗，相同则随机。首张牌也执行效果。攻击方 Reveal 逐张翻牌，累计战力(⚔️)一旦达到防守战力立即夺旗。只有最后翻出的牌负责防守，之前的攻击牌压在下面，不再有战力或效果。</p>
      <p>失旗时整叠牌进入六格替补席(🪑)，同名牌叠在同一格，等级 S/A/B/C 不影响同名判定。需要第七格，或者攻击方用尽牌库仍无法夺旗，便输掉比赛。疲劳区(💤)不限卡数，下一轮收回；永久移除的牌不会收回。S 起始牌移出游戏，其他移除牌进入相应等级的弃牌；等级牌堆耗尽时重洗弃牌。</p>
      <h3>✨ 效果时机</h3><p>普通效果翻出时处理；立即获得的战力奖励保留到这张牌失旗。攻击中能力只在本次攻击生效；持旗能力只在最上方牌持旗时生效。替补席能力持续生效，同名多张逐张叠加。失旗效果先于新持旗者的能力。选中时能力只在本轮选中那一次处理。必须执行的选择不能 Skip，可选能力能 Skip；排序编号从牌顶向下排列。</p>
      <h3>🏆 奖杯、粉丝与决赛</h3><p>每个公园每轮胜者获得奖杯(🏆)，其粉丝(⭐)价值逐轮增加。多人局奖杯分数仅本人可见，粉丝标记公开。第七轮结束公开全部分数，前二进入决赛；同分先比奖杯数量，再比最高轮次奖杯。决赛不选新牌，可以删牌，最终胜者成为冠军。其他人可观战。</p>
      <p>单人及双人不进行决赛。轮末领先至少 11 粉丝立即获胜，否则七轮后总分较高者胜出，同分使用上述奖杯规则。每轮结算保留场面，所有席位 Next Round 才继续；真人断线不会被自动跳过。</p>
      <h3>🤖 Robot</h3><p>单人和奇数人数自动加入 Robot，固定牌组不选新牌，赛博格基础战力等于当前轮数。等级 2/3/4 依次替换阿尔法、贝塔、好机器人，等级 5 再将机甲冠军替换成两张升级牌。Solo special challenge 会在单人升级池中加入三种挑战牌。多人补位 Robot 不积累奖杯、不参与决赛，单人 Robot 正常计分并可提前获胜。全息影像加入 Robot 的普通牌会保留到后续轮次，但 Robot 忽略这些牌的全部能力，只使用基础战力、名称与系列。</p>
      <h3>Controls</h3><p>点击卡牌进行选择，再点 Pick / Confirm / Ready。点空白处或按 Esc 取消选择。Explain 后点卡片、区域或按钮查看说明，禁用按钮也可以解释。图标可悬停或点击查看提示，3 秒消失。比赛牌序与对手候选保密。</p>
      ${cards.length ? `<details><summary>Card reference · 卡牌目录</summary><div class="ch-catalog">${cards.map(c => `<article style="--set-color:${view.set_info[c.set].color}"><strong>${c.icon} ${esc(c.name_zh)} · ${c.power || "轮数"} ⚔️</strong><p>${esc(c.name)} · ${view.set_info[c.set].name} · ${c.level}${c.copies ? ` ×${c.copies}` : ""}</p><p>${esc(c.description)}</p></article>`).join("")}</div></details>` : ""}`);
  }

  content.addEventListener("pointerdown", event => { lastPointerType = event.pointerType || "mouse"; });
  content.addEventListener("click", event => {
    if (!view || explaining) return;
    const card = event.target.closest("[data-ch-card]");
    if (card && !card.disabled) {
      const id = card.dataset.chCard;
      if (selected.includes(id)) selected = selected.filter(c => c !== id);
      else {
        const max = view.choice?.max ?? (view.stage === "trim" ? view.deck.length : 1);
        if (max === 1) selected = [id];
        else if (selected.length < max) selected.push(id);
      }
      hideTip(); updateSelection(); return;
    }
    const control = event.target.closest("[data-ch-action]");
    if (control && !control.disabled) {
      const action = control.dataset.chAction;
      if (action === "park") { park = Number(control.dataset.park); render(); return; }
      if (action === "level") submit({type: "choose_level", level: control.dataset.level});
      if (action === "pick" && selected.length === 1) submit({type: "pick", card_id: selected[0]});
      if (action === "redraw") submit({type: "redraw"});
      if (action === "ready") submit({type: "ready", remove_ids: selected});
      if (action === "resolve") submit({type: "resolve", card_ids: selected});
      if (action === "skip") submit({type: "resolve", card_ids: []});
      if (action === "reveal") submit({type: "reveal"});
      if (action === "next") submit({type: "next_round"});
      return;
    }
    const target = event.target.closest("[data-ch-tip]");
    if (target) { showTip(target.dataset.chTip, target); return; }
    if (!event.target.closest("button,input,select,label,summary,details")) { selected = []; hideTip(); updateSelection(); }
  });
  content.addEventListener("toggle", event => {
    const id = event.target.dataset?.log;
    if (id !== undefined) event.target.open ? openLogs.add(id) : openLogs.delete(id);
  }, true);
  content.addEventListener("pointerover", event => {
    const target = event.target.closest("[data-ch-tip]");
    if (target && event.pointerType !== "touch" && !explaining) showTip(target.dataset.chTip, target);
  });
  content.addEventListener("pointerout", event => { if (event.pointerType !== "touch") hideTip(); });
  content.addEventListener("focusin", event => {
    const target = event.target.closest("[data-ch-tip]");
    if (target && lastPointerType !== "touch" && !explaining) showTip(target.dataset.chTip, target);
  });
  content.addEventListener("focusout", hideTip);
  content.addEventListener("keydown", event => {
    if (["Enter", " "].includes(event.key) && event.target.matches("[data-ch-tip]") && event.target.tagName !== "BUTTON") {
      event.preventDefault(); event.target.click();
    }
  });

  const exempt = target => [helpButton, explainButton, dialogClose].some(element => element === target || element.contains(target));
  function showExplanation(target) {
    const text = target.dataset.chDescription || explain[target.dataset.chExplain] || target.dataset.chTip || "查看当前游戏信息。";
    setExplain(false);
    openDialog("Explain", `<p>${esc(text)}</p>${target.disabled ? "<p>This action is not available yet.</p>" : ""}`);
  }
  document.addEventListener("pointerdown", event => {
    if (!explaining || exempt(event.target)) return;
    let target = event.target.closest("[data-ch-explain]");
    if (!target) target = [...content.querySelectorAll("[data-ch-explain]")].find(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    event.preventDefault(); event.stopImmediatePropagation();
    suppressed = {x: event.clientX, y: event.clientY, until: Date.now() + 900};
    if (target) showExplanation(target);
  }, true);
  document.addEventListener("click", event => {
    if (suppressed && Date.now() < suppressed.until && Math.abs(event.clientX - suppressed.x) < 6 && Math.abs(event.clientY - suppressed.y) < 6) {
      event.preventDefault(); event.stopImmediatePropagation(); suppressed = null; return;
    }
    if (!explaining || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const target = event.target.closest("[data-ch-explain]");
    if (target) showExplanation(target);
  }, true);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") {
      hideTip();
      if (explaining) { event.preventDefault(); setExplain(false); }
      else if (!dialog.open && selected.length) { selected = []; updateSelection(); }
    } else if (explaining && ["Enter", " "].includes(event.key) && !exempt(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation();
      const target = event.target.closest("[data-ch-explain]");
      if (target) showExplanation(target);
    }
  }, true);
  helpButton.addEventListener("click", showHelp);
  explainButton.addEventListener("click", () => setExplain(!explaining));
  dialogClose.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus(); });
  window.addEventListener("resize", hideTip);
  window.addEventListener("blur", hideTip);
  document.addEventListener("scroll", hideTip, true);

  function clearState() {
    view = null; selected = []; park = null; signature = null; renderedContext = null; pending = false; pendingRevision = null;
    suppressed = null; openLogs.clear(); window.clearTimeout(pendingTimer);
    setExplain(false); hideTip(); content.replaceChildren();
    if (dialog.open) dialog.close();
  }
  function syncConfig(state) {
    const visible = state?.game_type === "challengers" && state.status === "lobby";
    configBox.classList.toggle("hidden", !visible);
    configBox.setAttribute("aria-hidden", String(!visible));
    if (state?.game_type !== "challengers") return;
    const config = state.game_config || {};
    const next = JSON.stringify([state.room_id, config]);
    if (next !== roomSignature) {
      document.getElementById("challengersExclude").value = config.exclude_set || "random";
      document.getElementById("challengersRobotLevel").value = config.robot_level || 1;
      document.getElementById("challengersSoloSpecial").checked = !!config.solo_special;
      roomSignature = next;
    }
  }
  window.getChallengersConfig = () => ({exclude_set: document.getElementById("challengersExclude").value, robot_level: Number(document.getElementById("challengersRobotLevel").value), solo_special: document.getElementById("challengersSoloSpecial").checked});
  window.renderChallengersGameState = data => {
    const next = data?.view || data;
    if (next?.game_id !== "challengers" || !next.players) return;
    const nextSignature = JSON.stringify([data?.room_id, next.round, next.stage, next.revision, next.choice?.kind]);
    if (signature !== nextSignature) { selected = []; hideTip(); }
    if (pendingRevision !== next.revision || next.game_over) { pending = false; pendingRevision = null; window.clearTimeout(pendingTimer); }
    if (!view || view.round !== next.round) { park = next.matches.find(m => m.seats.includes(next.you))?.id ?? 0; openLogs.clear(); }
    signature = nextSignature; view = next; render();
  };
  window.clearChallengersState = clearState;
  window.showChallengersHeaderActions = visible => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) { clearState(); configBox.classList.add("hidden"); }
    else if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
  };
  function connect() {
    socket.on("room:state", syncConfig);
    socket.on("system:error", () => {
      if (pending) { pending = false; pendingRevision = null; window.clearTimeout(pendingTimer); render(); }
    });
    if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "challengers") window.renderChallengersGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connect, {once: true});
  else connect();
})();
