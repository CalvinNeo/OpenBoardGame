(() => {
  "use strict";
  const panel = document.getElementById("eternalDecksPanel");
  const header = document.getElementById("eternalDecksHeaderActions");
  const helpButton = document.getElementById("eternalDecksHelpBtn");
  const explainButton = document.getElementById("eternalDecksExplainBtn");
  const dialog = document.getElementById("eternalDecksDialog");
  const dialogTitle = document.getElementById("eternalDecksDialogTitle");
  const dialogBody = document.getElementById("eternalDecksDialogBody");
  const dialogClose = document.getElementById("eternalDecksDialogClose");
  const icons = {red: "🔴", blue: "🔵", green: "🟢", yellow: "🟡", purple: "🟣"};
  let view = null;
  let signature = null;
  let selectedCards = [];
  let selectedRow = null;
  let selectedTarget = null;
  let selectedRecipe = null;
  let selectedOption = null;
  let selectedDisc = null;
  let orientation = "normal";
  let mode = "play";
  let pending = false;
  let pendingTimer = null;
  let explaining = false;
  let suppressClick = false;
  let suppressTimer = null;
  let tipTimer = null;
  let returnFocus = null;
  const openDetails = new Set();

  const explain = {
    card: "点选自己的手牌。普通牌的数字和颜色不能告诉队友；Rare 和能力牌可以讨论。宝石模式可选多张。点击空白或按 Esc 取消。",
    field: "三行从左向右填牌。相邻不同色、不同数；山地递增，洞穴递减。Rare 本次落位跳过限制，之后是通配牌；女巫诅咒仍能禁止 Rare。",
    eternal: "沉睡角色的牌组构成公开，但顺序隐藏。复苏时获得八张牌到个人牌库底，并立刻激活诅咒；献宝石解除。点击可查看角色及测试牌表。",
    jewel: "先选一个尚未使用的配方，再点选手牌和未获宝石的复苏者。消耗牌进入河流；双色牌可选任一色，Rare 可替代。能力牌只能用于任意两张／三张。",
    river: "任何手牌均可进入生命之河。达到五张便全部弃掉，只领取一次奖励。前三份为 Rare，之后 Game Over；美杜莎能把 Rare 放回奖励顶。",
    give: "消耗一颗共享心，将一张手牌暗中交给队友。接收者可以超过三张；只有你在回合末补牌。",
    ability: "选择手中的能力牌，再点 Use Ability，选择目标并确认。具体效果会显示在行动区域。",
    confirm: "只会提交服务器验证过的行动。先完成选牌、目标及必要选项。按钮不可用时检查轮次、诅咒、场地条件、剩余资源与宝石配方。",
    disc: "每人两个交流圆片。点圆片，再点任意场地／河流格；可放在已有牌的格子。Return 收回。不消耗回合，也不保证能合法出牌。",
    next: "每一整圈及重要结算后暂停，所有席位分别确认才继续；掉线玩家也需回来确认。已清空的场地和河流仍在 Review 中保留。",
    ready: "先商量起始玩家和路线。改变起始玩家会清空确认；所有人 Ready 后开始。",
    rotate: "双色牌的左右色分别约束左、右邻牌。翻转只改变方向，不改变数字；提交后方向固定。",
    discussion: "幽灵暂时公开全员手牌，可以自由讨论。所有人确认 End Discussion 后，手牌恢复私密，继续游戏。",
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const own = () => view?.players.find(player => player.player_id === view.you);
  const name = pid => view.players.find(player => player.player_id === pid)?.name || "—";
  const available = type => !pending && view?.legal_actions.includes(type);
  const button = (label, action, key, disabled = false, attrs = "") => `<button type="button" data-ed-action="${action}" data-ed-explain="${key}" ${disabled ? "disabled" : ""} ${attrs}>${label}</button>`;
  const sameIds = (a, b) => a.length === b.length && a.every(id => b.includes(id));
  const selectedCard = () => own()?.hand.find(card => card.id === selectedCards[0]);

  function cardLabel(card) {
    if (card.kind === "rare" || card.as_rare) return "🌈 Rare";
    if (card.kind === "ability") return `${view.eternals[card.source].icon} ${view.eternals[card.source].name}`;
    const colors = card.colors.slice();
    if (card.orientation === "rotated") colors.reverse();
    return `${colors.map(color => icons[color]).join(" / ")} ${card.number}`;
  }

  function cardHTML(card, hand = false) {
    const rare = card.kind === "rare" || card.as_rare;
    const ability = card.kind === "ability" && !rare;
    const colors = card.colors.slice();
    if (card.orientation === "rotated" || (hand && selectedCards.includes(card.id) && orientation === "rotated")) colors.reverse();
    const colorClass = rare ? "rare" : ability ? "ability" : colors.join("-");
    const symbol = rare ? "✦" : ability ? view.eternals[card.source].icon : card.number;
    const footer = rare ? "RARE" : ability ? view.eternals[card.source].name : colors.map(color => icons[color]).join(" ");
    const content = `<span class="eternal-decks-card-value">${symbol}</span><span class="eternal-decks-card-color">${footer}</span>`;
    const attrs = `class="eternal-decks-card eternal-decks-${colorClass}${selectedCards.includes(card.id) && hand ? " is-selected" : ""}" title="${esc(cardLabel(card))}" data-ed-tip="${esc(cardLabel(card))}" aria-label="${esc(cardLabel(card))}"`;
    return hand ? `<button type="button" ${attrs} data-ed-action="card" data-ed-explain="card" data-card="${card.id}" aria-pressed="${selectedCards.includes(card.id)}">${content}</button>` : `<span ${attrs}>${content}</span>`;
  }

  function discsAt(position) {
    return view.players.flatMap(player => player.discs.map((disc, index) => {
      const label = `${player.name} · Communication disc ${index + 1}`;
      return disc.position === position ? `<span title="${esc(label)}" data-ed-tip="${esc(label)}" tabindex="0" aria-label="${esc(label)}">${icons[player.color]}</span>` : "";
    })).join("");
  }

  function fieldHTML(row, index) {
    const field = view.fields[row.field];
    const capacity = 7 - row.sleeping.length;
    const card = selectedCard();
    const check = view.field_checks.find(item => item.row === index && item.card_id === card?.id && item.orientation === orientation);
    const reason = check?.reason || field.rule;
    const cells = Array.from({length: 7}, (_, slot) => {
      const sleeping = row.sleeping[slot - capacity];
      const sleeperLabel = sleeping ? `${sleeping} · ${view.eternals[sleeping].name} is sleeping here.` : "";
      const content = row.cards[slot] ? cardHTML(row.cards[slot]) : sleeping ? `<span class="eternal-decks-sleeper" title="${esc(sleeperLabel)}" data-ed-tip="${esc(sleeperLabel)}">💤<small>${sleeping}</small></span>` : `<span class="eternal-decks-empty">${slot + 1}</span>`;
      const next = slot === row.cards.length && slot < capacity && !row.closed;
      return button(`${content}<span class="eternal-decks-disc-markers">${discsAt(index * 7 + slot)}</span>`, "slot", "field", false,
        `class="eternal-decks-slot ${next ? "is-next" : ""}" data-row="${index}" data-position="${index * 7 + slot}" data-ed-description="${esc(reason)}" aria-label="Row ${index + 1}, slot ${slot + 1}"`);
    }).join("");
    return `<section class="eternal-decks-field ${selectedRow === index ? "is-selected" : ""} ${row.closed ? "is-closed" : ""}">
      <div class="eternal-decks-field-heading"><div class="eternal-decks-field-name"><h3>${field.icon} ${field.name}</h3><button type="button" class="eternal-decks-info" title="${esc(field.rule)}" data-ed-tip="${esc(field.rule)}" aria-label="Explain ${esc(field.name)}">ⓘ</button></div><span>${row.closed ? "✓ Closed" : `Lap ${row.lap}/4 · ${row.cards.length}/${capacity}`}</span></div>
      <div class="eternal-decks-seven">${cells}</div><div class="eternal-decks-field-footer"><span class="eternal-decks-field-rule">${esc(field.rule)}</span><span>${["⛺", "❤️", "⭐"][index]} Lap 4</span></div>
      <div class="eternal-decks-sleeping">${row.sleeping.map(eid => button(`${view.eternals[eid].icon} ${view.eternals[eid].name}`, "eternal", "eternal", false, `data-eternal="${eid}"`)).join("")}</div></section>`;
  }

  function riverHTML() {
    return `<section class="eternal-decks-river"><div class="eternal-decks-field-heading"><h3>🌊 生命之河</h3><span class="${view.river_reward_count ? "" : "eternal-decks-danger"}">Next: ${view.river_reward_count ? `🌈 Rare · ${view.river_reward_count} left` : "⚠ Game Over"}</span></div>
      <div class="eternal-decks-five">${Array.from({length: 5}, (_, i) => button(`${view.river[i] ? cardHTML(view.river[i]) : `<span class="eternal-decks-empty">${i + 1}</span>`}<span class="eternal-decks-disc-markers">${discsAt(21 + i)}</span>`, "river-slot", "river", false, `class="eternal-decks-slot" data-position="${21 + i}" aria-label="River slot ${i + 1}"`)).join("")}</div></section>`;
  }

  function revivalHTML() {
    return `<section class="eternal-decks-revival"><div class="eternal-decks-field-heading"><h3>✧ 复苏区</h3><span>${view.revived.length}/9</span></div>
      ${view.revived.length ? `<div class="eternal-decks-eternals">${view.revived.map((item, i) => {
        const eternal = view.eternals[item.id];
        return button(`<span>${i + 1} · ${eternal.icon} ${eternal.name} ${item.jewel ? "💎" : ""}</span><small>${item.jewel ? "诅咒已解除" : eternal.curse}</small>`, "revived", "eternal", false, `class="${item.jewel ? "is-blessed" : "is-cursed"} ${selectedTarget === item.id ? "is-selected" : ""}" data-eternal="${item.id}"`);
      }).join("")}</div>` : '<p class="eternal-decks-muted">填满任一场地，唤醒第一位永恒族。</p>'}</section>`;
  }

  function candidate() {
    if (!view || pending) return null;
    if (mode === "ability") return view.moves[selectedOption] || null;
    return view.moves.find(move => {
      if (mode === "jewel") return move.type === "generate" && move.recipe === selectedRecipe && move.target === selectedTarget && sameIds(move.card_ids, selectedCards);
      if (mode === "give") return move.type === "give" && move.card_id === selectedCards[0] && move.target === selectedTarget;
      if (mode === "river") return move.type === "river" && move.card_id === selectedCards[0];
      return move.type === "place" && move.card_id === selectedCards[0] && move.row === selectedRow && move.orientation === orientation;
    });
  }

  function abilityLabel(move) {
    const opt = move.options;
    if (opt.recipe) return `💎 ${view.recipes[opt.recipe].name} → ${view.eternals[opt.target].name}`;
    if (opt.row !== undefined) return `Row ${opt.row + 1} · Slot ${opt.slot + 1} · ${cardLabel(view.rows[opt.row].cards[opt.slot])}`;
    if (opt.card_ids) return opt.card_ids.length ? opt.card_ids.map(id => cardLabel(view.river.find(card => card.id === id))).join(" + ") : "Take no cards";
    if (opt.card_id) return `Recycle ${cardLabel(view.discard.find(card => card.id === opt.card_id))}`;
    return "Activate";
  }

  function reviewHTML() {
    return `<section class="eternal-decks-review"><h3>${view.result ? (view.result.success ? "🏆 Together, victorious" : "🌙 Journey ended") : "⏸ Review together"}</h3>
      ${view.result ? `<p>${esc(view.result.reason)}</p>` : ""}
      ${view.review_notes.map(note => `<p>${esc(note)}</p>`).join("")}
      ${view.review_cards.map(pile => `<div><span>${esc(pile.label)}</span><div class="eternal-decks-mini-hand">${pile.cards.map(card => cardHTML(card)).join("")}</div></div>`).join("")}
      ${view.game_over ? "" : `${button(`Next Round · ${view.next_ready.length}/${view.players.length}`, "next", "next", !available("next_round"), 'class="eternal-decks-primary"')}<p class="eternal-decks-muted">Waiting: ${view.players.filter(player => !view.next_ready.includes(player.player_id)).map(player => esc(player.name)).join(", ") || "—"}</p>`}</section>`;
  }

  function actionHTML() {
    const player = own();
    if (!player) return '<h3>Spectator</h3><p>Hidden hands stay private.</p>';
    let controls = "";
    if (view.phase === "setup") {
      controls = `<h3>Choose the first explorer</h3><div class="eternal-decks-choice-grid">${view.players.map(item => button(`${icons[item.color]} ${esc(item.name)}`, "start", "ready", !available("choose_start"), `data-player="${item.player_id}" aria-pressed="${view.start_player === item.player_id}"`)).join("")}</div>${button(`Ready · ${view.ready.length}/${view.players.length}`, "ready", "ready", !available("ready"), 'class="eternal-decks-primary"')}`;
    } else if (view.phase === "revival") {
      controls = `<h3>✨ 选择复苏者</h3><p>牌库加入你的牌库底；诅咒立即生效。</p><div class="eternal-decks-choice-grid">${view.rows[view.pending_row].sleeping.map(eid => button(`${view.eternals[eid].icon} ${view.eternals[eid].name}<small>${view.eternals[eid].curse}</small>`, "revive", "eternal", !available("revive"), `data-eternal="${eid}"`)).join("")}</div>`;
    } else if (view.phase === "camp_choice") {
      controls = `<h3>⛺ 营地奖励</h3><p>把另一条未关闭的场地改成营地。</p>${view.rows.map((row, index) => index && !row.closed ? button(`Row ${index + 1}`, "camp", "field", !available("camp"), `data-row="${index}"`) : "").join("")}`;
    } else if (view.phase === "discussion") {
      controls = `<h3>👻 公开讨论</h3><p>全员手牌暂时公开。所有人确认后恢复私密。</p>${button(`End Discussion · ${view.discussion_ready.length}/${view.players.length}`, "discussion", "discussion", !available("end_discussion"), 'class="eternal-decks-primary"')}`;
    } else if (view.phase === "playing") {
      const card = selectedCard();
      const canAct = view.current_turn === view.you;
      controls = `<div class="eternal-decks-action-tabs">${[["play", "Field", "field"], ["river", "River", "river"], ["give", "Give ❤️", "give"], ["ability", "Ability ✦", "ability"]].map(([id, label, key]) => button(label, "mode", key, !canAct || pending, `data-mode="${id}" aria-pressed="${mode === id}"`)).join("")}</div>`;
      if (mode === "give") controls += `<p>Choose a teammate</p><div class="eternal-decks-choice-grid">${view.players.filter(item => item.player_id !== view.you).map(item => button(`${icons[item.color]} ${esc(item.name)}`, "target", "give", !view.hearts, `data-target="${item.player_id}" aria-pressed="${selectedTarget === item.player_id}"`)).join("")}</div>`;
      else if (mode === "jewel") controls += `<p>💎 ${esc(view.recipes[selectedRecipe].name)} · ${selectedCards.length}/${view.recipes[selectedRecipe].count} selected</p><p class="eternal-decks-muted">点选手牌，再点复苏区中尚无宝石的角色。</p>`;
      else if (mode === "ability") {
        controls += card?.kind === "ability" ? `<p>${esc(view.eternals[card.source].effect)}</p><div class="eternal-decks-ability-options">${view.moves.map((move, i) => move.type === "ability" && move.card_id === card.id ? button(esc(abilityLabel(move)), "option", "ability", false, `data-option="${i}" aria-pressed="${selectedOption === i}"`) : "").join("")}</div>` : '<p class="eternal-decks-muted">Select an ability card.</p>';
      } else if (mode === "play") {
        if (card?.colors.length === 2) controls += button(`↔ ${orientation === "normal" ? "Normal" : "Rotated"}`, "rotate", "rotate");
        const check = view.field_checks.find(item => item.card_id === card?.id && item.row === selectedRow && item.orientation === orientation);
        controls += `<p class="eternal-decks-selection" aria-live="polite">${check ? esc(check.reason) : "Select a card, then a field."}</p>`;
      } else controls += '<p class="eternal-decks-muted">Select one card for the river.</p>';
      const chosen = candidate();
      controls += button(pending ? "Sending…" : "Confirm", "confirm", "confirm", !chosen, `class="eternal-decks-primary" data-ed-description="${esc(chosen ? explain.confirm : !canAct ? "等待轮到你行动。" : mode === "play" ? (view.field_checks.find(item => item.card_id === card?.id && item.row === selectedRow && item.orientation === orientation)?.reason || explain.confirm) : mode === "give" && !view.hearts ? "共享心已用完，不能给牌。" : explain.confirm)}"`);
    }
    return `<h3>Your hand <span class="eternal-decks-muted">${player.hand_count} cards · ${player.deck_count} in deck</span></h3><div class="eternal-decks-hand">${player.hand.map(card => cardHTML(card, true)).join("") || '<span class="eternal-decks-muted">No cards</span>'}</div>${controls}`;
  }

  function playersHTML() {
    return view.players.map(player => `<div class="eternal-decks-player ${view.current_turn === player.player_id ? "is-current" : ""}"><div><strong>${icons[player.color]} ${esc(player.name)}${player.player_id === view.you ? " · You" : ""}</strong><span>${player.hand_count} cards · ${player.deck_count} in deck</span></div>${view.hands_revealed && player.player_id !== view.you ? `<div class="eternal-decks-mini-hand">${player.hand.map(card => cardHTML(card)).join("")}</div>` : ""}</div>`).join("");
  }

  function render() {
    if (!view) return;
    const player = own();
    const compact = window.matchMedia("(max-width: 760px)").matches;
    const jewelsOpen = !compact || mode === "jewel" || openDetails.has("jewels");
    const communicationOpen = !compact || selectedDisc !== null || openDetails.has("communication");
    const status = view.game_over ? (view.result.success ? "The stars are yours" : "The journey rests") : view.phase === "setup" ? "Prepare together" : view.phase === "round_end" ? "Review · Waiting for everyone" : view.phase === "discussion" ? "Ghost · Open discussion" : `${view.current_turn === view.you ? "Your turn" : name(view.current_turn) + "’s turn"}`;
    panel.innerHTML = `<div class="eternal-decks-shell"><div class="eternal-decks-title"><div><span class="eternal-decks-eyebrow">THE ETERNAL WORLD</span><h2>永恒牌 <small>Eternal Decks</small></h2><span class="eternal-decks-subtitle">Stage A · First Encounter · Beginner</span></div><div class="eternal-decks-counters"><strong title="Team stars: ${view.stars.length} of 4" data-ed-tip="Collect any four stars to win together." tabindex="0">⭐ ${view.stars.length}<small>/4</small></strong><span title="Shared hearts: ${view.hearts} of 3" data-ed-tip="Shared hearts pay for giving a hidden card to a teammate." tabindex="0">❤️ ${view.hearts}/3</span></div></div>
      <div class="eternal-decks-status"><strong role="status">${esc(status)}</strong><span>Turn ${view.turn_count + 1}</span></div>
      <p class="eternal-decks-notice" title="Prototype card list for 2 or 4 seats; not a complete retail reproduction." data-ed-tip="Prototype card list for 2 or 4 seats; not a complete retail reproduction." tabindex="0">Stage A · Beginner · Prototype</p>
      <div class="eternal-decks-layout"><div class="eternal-decks-table">${view.rows.map(fieldHTML).join("")}${riverHTML()}${revivalHTML()}</div>
      <aside class="eternal-decks-sidebar"><section class="eternal-decks-action-box">${actionHTML()}</section>
      ${view.phase === "round_end" || view.game_over ? reviewHTML() : ""}
      <details class="eternal-decks-jewel-box" data-ed-detail="jewels" ${jewelsOpen ? "open" : ""}><summary><strong>💎 宝石配方</strong><span>${Object.values(view.jewels).filter(Boolean).length}/8</span></summary><div class="eternal-decks-jewels">${Object.entries(view.recipes).map(([id, recipe]) => button(`${view.jewels[id] ? "💎" : "✓"} ${recipe.name}`, "recipe", "jewel", !view.jewels[id] || !available("generate"), `data-recipe="${id}" aria-pressed="${selectedRecipe === id}"`)).join("")}</div></details>
      ${player ? `<details class="eternal-decks-communication" data-ed-detail="communication" ${communicationOpen ? "open" : ""}><summary><strong>🔴 Communication discs</strong><span>${player.discs.filter(disc => disc.position >= 0).length}/2 placed</span></summary><div class="eternal-decks-disc-controls">${player.discs.map((disc, i) => button(`${icons[player.color]} ${i + 1}`, "disc", "disc", !available("move_disc"), `data-disc="${i}" aria-pressed="${selectedDisc === i}"`)).join("")}${button("Return", "return-disc", "disc", selectedDisc === null || !available("move_disc"))}</div><p>${selectedDisc === null ? "Choose a disc, then a board space." : "Choose any field or river space."}</p></details>` : ""}</aside></div>
      <div class="eternal-decks-player-list">${playersHTML()}</div>
      <div class="eternal-decks-table-talk" aria-label="Table-talk reminders"><button type="button" class="eternal-decks-rule-chip" title="Do not reveal the number, color, dual-color information, or missing cards from an ordinary hand." data-ed-tip="Do not reveal the number, color, dual-color information, or missing cards from an ordinary hand.">🤫 Hand privacy</button><button type="button" class="eternal-decks-rule-chip" title="Rare cards, ability cards, and all public board information may be discussed." data-ed-tip="Rare cards, ability cards, and all public board information may be discussed.">🌈 Public talk OK</button></div>
      <div class="eternal-decks-details-grid"><details data-ed-detail="stars" ${openDetails.has("stars") ? "open" : ""}><summary>⭐ Star objectives · ${view.stars.length}/4</summary><ul>${Object.entries(view.star_goals).map(([id, goal]) => `<li>${view.stars.includes(id) ? "✅" : "☆"} ${esc(goal)}</li>`).join("")}</ul><p>A 系能力牌：${view.stage_card_count}/3</p></details>
      <details data-ed-detail="discard" ${openDetails.has("discard") ? "open" : ""}><summary>Discard · ${view.discard_count}${view.strict_discard ? " · Hidden" : ""}</summary><div class="eternal-decks-discard">${view.discard.map(card => cardHTML(card)).join("")}</div></details>
      <details data-ed-detail="log" ${openDetails.has("log") ? "open" : ""}><summary>Activity</summary><ol class="eternal-decks-log">${view.log.slice().reverse().map(item => `<li>${esc(item)}</li>`).join("")}</ol></details></div><div class="eternal-decks-toast" role="status" aria-live="polite"></div></div>`;
    panel.classList.toggle("eternal-decks-explaining", explaining);
    panel.querySelectorAll("details").forEach(element => element.addEventListener("toggle", () => element.open ? openDetails.add(element.dataset.edDetail) : openDetails.delete(element.dataset.edDetail)));
  }

  function resetSelection() {
    selectedCards = []; selectedRow = null; selectedTarget = null; selectedRecipe = null;
    selectedOption = null; selectedDisc = null; orientation = "normal"; mode = "play";
  }
  function setExplain(value) {
    explaining = value;
    panel.classList.toggle("eternal-decks-explaining", value);
    explainButton.setAttribute("aria-pressed", String(value));
  }
  function openDialog(title, body, html = false) {
    returnFocus = document.activeElement;
    dialogTitle.textContent = title;
    if (html) dialogBody.innerHTML = body; else dialogBody.textContent = body;
    if (!dialog.open) dialog.showModal();
    dialogClose.focus();
  }
  function showEternal(id) {
    const eternal = view.eternals[id];
    openDialog(`${eternal.icon} ${eternal.name} · ${id}`, `<p><strong>诅咒：</strong>${esc(eternal.curse)}</p><p><strong>能力：</strong>${esc(eternal.effect)}</p><p>Prototype card data · Public composition, shuffled order hidden.</p><div class="eternal-decks-mini-hand">${eternal.deck.map(card => cardHTML(card)).join("")}</div>`, true);
  }
  function submit(action) {
    if (!action || pending) return;
    pending = true;
    resetSelection();
    render();
    sendAction(action);
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => { pending = false; render(); }, 5000);
  }
  function moveDisc(position) {
    const index = selectedDisc;
    submit({type: "move_disc", disc: index, position, seq: own().discs[index].seq + 1});
  }

  function showTip(text) {
    const toast = panel.querySelector(".eternal-decks-toast");
    if (!toast || !text) return;
    window.clearTimeout(tipTimer);
    toast.textContent = text;
    toast.classList.add("is-visible");
    tipTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3000);
  }

  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-ed-action]");
    if (!target || target.disabled || explaining || !view) return;
    const data = target.dataset;
    switch (data.edAction) {
      case "card":
        if (mode === "jewel") selectedCards = selectedCards.includes(data.card) ? selectedCards.filter(id => id !== data.card) : [...selectedCards, data.card];
        else selectedCards = selectedCards[0] === data.card ? [] : [data.card];
        selectedOption = null; orientation = "normal";
        break;
      case "slot":
        if (selectedDisc !== null) { moveDisc(Number(data.position)); return; }
        selectedRow = Number(data.row); mode = "play"; selectedCards = selectedCards.slice(0, 1);
        break;
      case "river-slot":
        if (selectedDisc !== null) { moveDisc(Number(data.position)); return; }
        mode = "river"; selectedCards = selectedCards.slice(0, 1);
        break;
      case "mode": mode = data.mode; selectedCards = selectedCards.slice(0, 1); selectedTarget = null; selectedOption = null; break;
      case "rotate": orientation = orientation === "normal" ? "rotated" : "normal"; break;
      case "recipe": mode = "jewel"; selectedRecipe = data.recipe; selectedCards = []; selectedTarget = null; break;
      case "target": selectedTarget = data.target; break;
      case "revived":
        if (mode === "jewel" && !view.revived.find(item => item.id === data.eternal).jewel) selectedTarget = data.eternal;
        else { showEternal(data.eternal); return; }
        break;
      case "eternal": showEternal(data.eternal); return;
      case "option": selectedOption = Number(data.option); break;
      case "confirm": submit(candidate()); return;
      case "start": submit({type: "choose_start", player_id: data.player}); return;
      case "ready": submit({type: "ready"}); return;
      case "next": submit({type: "next_round"}); return;
      case "revive": submit({type: "revive", eternal_id: data.eternal}); return;
      case "camp": submit({type: "camp", row: Number(data.row)}); return;
      case "discussion": submit({type: "end_discussion"}); return;
      case "disc": selectedDisc = selectedDisc === Number(data.disc) ? null : Number(data.disc); break;
      case "return-disc": moveDisc(-1); return;
    }
    render();
  });

  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-ed-tip]");
    if (!target || !window.matchMedia("(max-width: 760px), (hover: none), (pointer: coarse)").matches) return;
    showTip(target.dataset.edTip);
  });

  helpButton.addEventListener("click", () => {
    setExplain(false);
    const fields = view ? Object.values(view.fields).map(field => `<li>${field.icon} ${field.name}：${field.rule}</li>`).join("") : "";
    openDialog("Eternal Decks · Help", `
      <p><strong>Stage A · Beginner · Prototype card data</strong>：本实现开放 2 或 4 个席位，可加机器人。永恒族八张牌采用明确标注的测试组合，非正式完整牌表；未开放其他关卡、三人专用配方或单人故事模式。</p>
      <p><strong>🤝 目标</strong>：取得任意四颗星共同获胜。当前玩家没有任何主行动，或取得河流 Game Over 时全队失败；同一回合同时胜负时胜利优先。</p>
      <p><strong>🃏 开局与回合</strong>：每人本色 1–5，洗牌抽三张；两人局各在牌库底加入两张随机副色牌。全员 Ready 后由选定玩家开始轮流行动。回合末从自己的牌库补到三张；超额不弃，空库不重洗。</p>
      <p><strong>三种主行动</strong>：① 出一张牌到场地／河流，或使用能力；② 用手牌生成一颗宝石；③ 消耗一心暗中给队友一张牌。只有行动者在回合末补牌。</p><ul>${fields}</ul>
      <p><strong>🌈 Rare 与双色</strong>：Rare 当下忽略场地和相邻限制，但女巫能禁止 Rare；之后是可变通配。山地 9、洞穴 1 后仍可接 Rare。双色牌选好方向后，左右半色分别比较两侧；落下后不能旋转。</p>
      <p><strong>✨ 复苏</strong>：各行前三圈分别填四、五、六张，选择复苏本行一位永恒族，八张牌加入自己的牌库底，行中牌弃掉。诅咒立即对全队生效；献宝石后解除。点角色可查能力、诅咒及公开牌组构成。</p>
      <p><strong>第四圈</strong>：填满七张后关闭。上行将另一行改成营地；中行恢复全部三颗心；下行得星。关闭行不能再放牌。</p>
      <p><strong>💎 宝石</strong>：每个配方仅能用一次，必须献给尚无宝石的复苏者。先点配方，再点选手牌与目标，Confirm。消耗牌进入河流。Rare 可替任意颜色／数字，双色可选其中一色；能力牌只适用任意两张／三张。女巫免费生成非 1/5/9 的宝石。</p>
      <p><strong>🌊 河流</strong>：达到五张或更多时全部清空，只取一次奖励。前三次通常拿 Rare，下一次 Game Over；美杜莎可以补充奖励。生成 1/5/9 会同时得星，第四星优先于 Game Over。</p>
      <p><strong>⭐ 六条路线</strong>：第 1–3 位全部获宝石；第 4–6 位全部获宝石；复苏九位；1/5/9 配方；下行第四圈；使用三张 A 系能力牌。每项只计一次。</p>
      <p><strong>能力</strong>：幽灵公开手牌直到全员 End Discussion；骷髅回一心；女巫免费宝石；美杜莎回收弃牌 Rare；牛头人与场地牌交换、留作 Rare；海怪取回河流最多两张。能力没有有效目标时可空用。</p>
      <p><strong>🤫 交流</strong>：不能透露普通数字牌的数字、颜色、缺少什么或持有双色；可讨论 Rare、能力和公开局面。两个圆片免费移动：点圆片再点格子，Return 收回。圆片只表达意图。</p>
      <p><strong>⏸ 回顾</strong>：每整圈以及复苏、河流奖励、星星、第四圈奖励后，所有人 Next Round 才继续。掉线不会自动确认。空白和 Esc 取消选牌；Explain 可解释灰色按钮，期间不会执行游戏动作。</p>
      <p><a href="https://boardgamegeek.com/filepage/289015/eternaldecks-english-rulebooks" target="_blank" rel="noopener noreferrer">Author’s rulebooks</a> · 规则整理基于第四版，牌表仍待核实。</p>`, true);
  });
  explainButton.addEventListener("click", () => setExplain(!explaining));
  dialogClose.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  function explainTarget(target) {
    if (!target) return;
    const text = target.dataset.edDescription || explain[target.dataset.edExplain];
    if (text) { setExplain(false); openDialog("Explain", text); }
  }
  document.addEventListener("pointerdown", event => {
    if (!explaining || panel.classList.contains("hidden") || header.contains(event.target) || dialog.contains(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const target = Array.from(panel.querySelectorAll("[data-ed-explain]")).find(element => {
      const r = element.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    });
    if (target) {
      suppressClick = true;
      window.clearTimeout(suppressTimer);
      suppressTimer = window.setTimeout(() => { suppressClick = false; }, 600);
      explainTarget(target);
    }
  }, true);
  document.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!explaining || header.contains(event.target) || dialog.contains(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (panel.contains(event.target)) explainTarget(event.target.closest("[data-ed-explain]"));
  }, true);
  document.addEventListener("pointerdown", event => {
    if (!view || explaining || !panel.contains(event.target) || event.target.closest("button, input, select, summary, a, dialog, [data-ed-tip]")) return;
    resetSelection(); render();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || panel.classList.contains("hidden")) return;
    setExplain(false); resetSelection(); render();
  });

  function clearState() {
    view = null; signature = null; pending = false;
    resetSelection(); setExplain(false); openDetails.clear();
    window.clearTimeout(pendingTimer); window.clearTimeout(suppressTimer); window.clearTimeout(tipTimer); suppressClick = false;
    if (dialog.open) dialog.close();
    panel.innerHTML = "";
  }
  window.renderEternalDecksGameState = data => {
    if (!data?.view) return;
    const next = data.view;
    const nextSignature = JSON.stringify([data.room_id, next.phase, next.current_turn, next.turn_count, next.players.map(player => player.hand.map(card => card.id))]);
    if (signature !== nextSignature) resetSelection();
    signature = nextSignature; view = next; pending = false;
    window.clearTimeout(pendingTimer); render();
  };
  window.showEternalDecksHeaderActions = visible => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };
  window.clearEternalDecksState = clearState;
  window.getEternalDecksConfig = () => ({strict_discard: document.getElementById("eternalDecksStrictDiscard").checked});
  window.updateEternalDecksConfigRow = () => {
    const visible = currentGameType === "eternal_decks" && currentRoomState?.status === "lobby";
    const box = document.getElementById("eternalDecksConfigBox");
    box.classList.toggle("hidden", !visible); box.setAttribute("aria-hidden", String(!visible));
  };
  if (typeof socket !== "undefined") socket.on("system:error", () => { if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); } });
})();
