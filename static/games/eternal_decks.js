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
  const colorNames = {red: "红色", blue: "蓝色", green: "绿色", yellow: "黄色", purple: "紫色"};
  let view = null;
  let signature = null;
  let selectedCards = [];
  let selectedRow = null;
  let selectedTarget = null;
  let selectedRecipe = null;
  let selectedOption = null;
  let selectedPosition = null;
  let orientation = "normal";
  let mode = "browse";
  let drawerOpen = false;
  let pending = false;
  let pendingTimer = null;
  let explaining = false;
  let suppressClick = false;
  let suppressTimer = null;
  let tipTimer = null;
  let returnFocus = null;
  const openDetails = new Set();
  const dockObserver = new ResizeObserver(entries => {
    if (!entries[0].target.isConnected) return;
    panel.style.setProperty("--ed-dock-height", `${Math.ceil(entries[0].target.getBoundingClientRect().height) + 16}px`);
    window.requestAnimationFrame(keepSpaceVisible);
  });

  const explain = {
    card: "底部 🃏 入口可展开或收起手牌。先点场地／河流的下一个空格，再选牌并确认；也可点宝石配方或 Give ❤️。普通牌的数字和颜色不能告诉队友。点击空白或按 Esc 取消。",
    field: "点格子可选出牌或放 Communication discs（交流圆片）。牌从左向右放入下一个空格：相邻不同色、不同数；山地递增，洞穴递减。Rare 本次落位跳过限制，女巫诅咒仍能禁止 Rare。",
    eternal: "沉睡角色的牌组构成公开，但顺序隐藏。复苏时获得八张牌到个人牌库底，并立刻激活诅咒；献宝石解除。点击可查看角色及测试牌表。",
    jewel: "点 💎 宝石打开配方，再在抽屉中选择手牌和未获宝石的复苏者。消耗牌进入河流；双色牌可选任一色，Rare 可替代。能力牌只能用于任意两张／三张。",
    river: "任何手牌均可进入生命之河。达到五张便全部弃掉，只领取一次奖励。前三份为 Rare，之后 Game Over；美杜莎能把 Rare 放回奖励顶。",
    give: "消耗一颗共享心，将一张手牌暗中交给队友。接收者可以超过三张；只有你在回合末补牌。",
    ability: "选择手中的能力牌，再点 Use Ability，选择目标并确认。具体效果会显示在行动区域。",
    confirm: "只会提交服务器验证过的行动。先完成选牌、目标及必要选项。按钮不可用时检查轮次、诅咒、场地条件、剩余资源与宝石配方。",
    disc: "每人两个 Communication discs（交流圆片）。点任意场地／河流格，选 Discs，再选要放的圆片；已有牌的格子也能放。Return 收回。不消耗回合，也不保证能合法出牌。",
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

  function cardDescription(card) {
    if (card.kind === "rare" || card.as_rare) return "🌈 Rare（稀有牌）：放入场地时忽略数字、颜色和升降序限制；女巫诅咒仍可禁止它。生成宝石时可替代任意数字或颜色。";
    if (card.kind === "ability") {
      const eternal = view.eternals[card.source];
      const effect = card.ability === "reveal" ? "暂时公开全员手牌，所有人确认 End Discussion 后恢复隐藏。" : eternal.effect;
      return `${eternal.icon} ${eternal.name} · 能力牌：${effect}`;
    }
    const colors = card.colors.slice();
    if (card.orientation === "rotated") colors.reverse();
    if (colors.length === 2) return `${colors.map(color => `${icons[color]} ${colorNames[color]}`).join(" / ")} · 数字 ${card.number}（双色牌）。左右半色分别约束相邻牌；出牌前可翻转，生成宝石时可任选其中一色。`;
    return `${icons[colors[0]]} ${colorNames[colors[0]]} · 数字 ${card.number}（普通牌）。用于场地排列或宝石配方；相邻牌须不同色、不同数，并遵守场地与诅咒限制。`;
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
    const blocked = hand && mode === "play" && !view.field_checks.some(check => check.card_id === card.id && check.row === selectedRow && check.legal);
    const attrs = `class="eternal-decks-card eternal-decks-${colorClass}${selectedCards.includes(card.id) && hand ? " is-selected" : ""}${blocked ? " is-unavailable" : ""}" aria-label="${esc(cardLabel(card))}${blocked ? " · Cannot play here" : ""}"`;
    return hand ? `<button type="button" ${attrs} data-ed-action="card" data-ed-explain="card" data-card="${card.id}" aria-pressed="${selectedCards.includes(card.id)}">${content}</button>` : `<span ${attrs} tabindex="0" data-ed-tip="${esc(cardDescription(card))}">${content}</span>`;
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
        `class="eternal-decks-slot ${next ? "is-next" : ""} ${selectedPosition === index * 7 + slot ? "is-selected" : ""}" data-row="${index}" data-position="${index * 7 + slot}" data-ed-description="${esc(explain.field + " " + reason)}" aria-label="Row ${index + 1}, slot ${slot + 1}${next ? ", next space" : ""}"`);
    }).join("");
    return `<section class="eternal-decks-field ${selectedRow === index ? "is-selected" : ""} ${row.closed ? "is-closed" : ""}">
      <div class="eternal-decks-field-heading"><h3 data-ed-tip="${esc(field.rule)}" tabindex="0">${field.icon} ${field.name}</h3><span>${row.closed ? "✓ Closed" : `Lap ${row.lap}/4 · ${row.cards.length}/${capacity}`}</span></div>
      <div class="eternal-decks-seven">${cells}</div><p class="eternal-decks-field-rule">${esc(field.rule)}</p>
      <div class="eternal-decks-field-footer"><div class="eternal-decks-sleeping">${row.sleeping.map(eid => button(`${view.eternals[eid].icon} ${view.eternals[eid].name}`, "eternal", "eternal", false, `data-eternal="${eid}"`)).join("")}</div><span data-ed-tip="${["⛺ 营地：第四圈完成后，把另一条未关闭的场地改成营地。", "❤️ 心：第四圈完成后，恢复全部三颗共享心。", "⭐ 星星：第四圈完成后，获得一颗星。"][index]}" tabindex="0">${["⛺", "❤️", "⭐"][index]} Lap 4</span></div></section>`;
  }

  function riverHTML() {
    return `<section class="eternal-decks-river"><div class="eternal-decks-field-heading"><h3>🌊 生命之河</h3><span class="${view.river_reward_count ? "" : "eternal-decks-danger"}">Next: ${view.river_reward_count ? `🌈 Rare · ${view.river_reward_count} left` : "⚠ Game Over"}</span></div>
      <div class="eternal-decks-five">${Array.from({length: 5}, (_, i) => button(`${view.river[i] ? cardHTML(view.river[i]) : `<span class="eternal-decks-empty">${i + 1}</span>`}<span class="eternal-decks-disc-markers">${discsAt(21 + i)}</span>`, "river-slot", "river", false, `class="eternal-decks-slot ${i === view.river.length ? "is-next" : ""} ${selectedPosition === 21 + i ? "is-selected" : ""}" data-position="${21 + i}" aria-label="River slot ${i + 1}"`)).join("")}</div></section>`;
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
    if (mode === "ability") {
      const move = view.moves[selectedOption];
      return move?.type === "ability" && move.card_id === selectedCards[0] ? move : null;
    }
    return view.moves.find(move => {
      if (mode === "jewel") return move.type === "generate" && move.recipe === selectedRecipe && move.target === selectedTarget && sameIds(move.card_ids, selectedCards);
      if (mode === "give") return move.type === "give" && move.card_id === selectedCards[0] && move.target === selectedTarget;
      if (mode === "river") return canPlayAtPosition() && move.type === "river" && move.card_id === selectedCards[0];
      return mode === "play" && canPlayAtPosition() && move.type === "place" && move.card_id === selectedCards[0] && move.row === selectedRow && move.orientation === orientation;
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

  function phaseHTML() {
    const player = own();
    if (!player) return '<section class="eternal-decks-action-box"><h3>Spectator</h3><p>Hidden hands stay private.</p></section>';
    let controls = "";
    if (view.phase === "setup") {
      controls = `<h3>Choose the first explorer</h3><div class="eternal-decks-choice-grid">${view.players.map(item => button(`${icons[item.color]} ${esc(item.name)}`, "start", "ready", !available("choose_start"), `data-player="${item.player_id}" aria-pressed="${view.start_player === item.player_id}"`)).join("")}</div>${button(`Ready · ${view.ready.length}/${view.players.length}`, "ready", "ready", !available("ready"), 'class="eternal-decks-primary"')}`;
    } else if (view.phase === "revival") {
      controls = `<h3>✨ 选择复苏者</h3><p>牌库加入你的牌库底；诅咒立即生效。</p><div class="eternal-decks-choice-grid">${view.rows[view.pending_row].sleeping.map(eid => button(`${view.eternals[eid].icon} ${view.eternals[eid].name}<small>${view.eternals[eid].curse}</small>`, "revive", "eternal", !available("revive"), `data-eternal="${eid}"`)).join("")}</div>`;
    } else if (view.phase === "camp_choice") {
      controls = `<h3>⛺ 营地奖励</h3><p>把另一条未关闭的场地改成营地。</p>${view.rows.map((row, index) => index && !row.closed ? button(`Row ${index + 1}`, "camp", "field", !available("camp"), `data-row="${index}"`) : "").join("")}`;
    } else if (view.phase === "discussion") {
      controls = `<h3>👻 公开讨论</h3><p>全员手牌暂时公开。所有人确认后恢复私密。</p>${button(`End Discussion · ${view.discussion_ready.length}/${view.players.length}`, "discussion", "discussion", !available("end_discussion"), 'class="eternal-decks-primary"')}`;
    }
    return controls ? `<section class="eternal-decks-action-box">${controls}</section>` : "";
  }

  function positionLabel(position) {
    if (position < 0) return "Not placed";
    if (position >= 21) return `🌊 生命之河 · Slot ${position - 20}`;
    const field = view.fields[view.rows[Math.floor(position / 7)].field];
    return `${field.icon} ${field.name} · Row ${Math.floor(position / 7) + 1} · Slot ${position % 7 + 1}`;
  }

  function canPlayAtPosition() {
    if (selectedPosition === null) return false;
    if (selectedPosition >= 21) return selectedPosition - 21 === view.river.length && available("river");
    const row = view.rows[Math.floor(selectedPosition / 7)];
    return !row.closed && selectedPosition % 7 === row.cards.length && row.cards.length < 7 - row.sleeping.length && available("place");
  }

  function recipesHTML() {
    return `<div class="eternal-decks-jewels">${Object.entries(view.recipes).map(([id, recipe]) => button(`${view.jewels[id] ? "💎" : "✓"} ${recipe.name}`, "recipe", "jewel", !view.jewels[id] || !available("generate"), `data-recipe="${id}"`)).join("")}</div>`;
  }

  function drawerBodyHTML() {
    const player = own();
    const card = selectedCard();
    if (mode === "recipes") return `${recipesHTML()}${!view.revived.some(item => !item.jewel) ? '<p class="eternal-decks-selection">先复苏一位永恒族，再为其生成宝石。</p>' : ""}`;
    let controls = "";
    if (selectedPosition !== null) {
      const playMode = selectedPosition >= 21 ? "river" : "play";
      controls += `<div class="eternal-decks-action-tabs">${button("🃏 Play card", "mode", playMode === "river" ? "river" : "field", !canPlayAtPosition(), `data-mode="${playMode}" aria-pressed="${mode === playMode}"`)}${button(`${icons[player.color]} Discs`, "mode", "disc", !available("move_disc"), `data-mode="disc" aria-pressed="${mode === "disc"}"`)}</div>`;
    }
    if (mode === "disc") {
      return `${controls}<p class="eternal-decks-muted">Communication discs · No turn cost</p><div class="eternal-decks-disc-list">${player.discs.map((disc, index) => `<div class="eternal-decks-disc-choice"><span><strong>${icons[player.color]} ${index + 1}</strong><small>${esc(positionLabel(disc.position))}</small></span><div>${button(disc.position === selectedPosition ? "✓ Here" : "Place here", "disc", "disc", !available("move_disc") || disc.position === selectedPosition, `data-disc="${index}"`)}${button("Return", "return-disc", "disc", !available("move_disc") || disc.position < 0, `data-disc="${index}"`)}</div></div>`).join("")}</div>`;
    }
    if (mode === "jewel") controls += `<div class="eternal-decks-drawer-subheading"><span>${esc(view.recipes[selectedRecipe].name)} · ${selectedCards.length}/${view.recipes[selectedRecipe].count}</span>${button("Change recipe", "jewels", "jewel")}</div>`;
    controls += `<div class="eternal-decks-hand">${player.hand.map(item => cardHTML(item, true)).join("") || '<span class="eternal-decks-muted">No cards</span>'}</div>`;
    if (mode === "browse") {
      controls += '<p class="eternal-decks-selection">Tap a field or river space to play.</p>';
      if (card?.kind === "ability" && !card.as_rare) controls += `<p class="eternal-decks-selection">${esc(cardDescription(card))}</p>${button("Use Ability ✦", "mode", "ability", !available("ability"), 'data-mode="ability" class="eternal-decks-primary"')}`;
      return controls;
    }
    let hint = "Select a card.";
    if (mode === "give") {
      controls += `<div class="eternal-decks-choice-grid">${view.players.filter(item => item.player_id !== view.you).map(item => button(`${icons[item.color]} ${esc(item.name)}`, "target", "give", !available("give"), `data-target="${item.player_id}" aria-pressed="${selectedTarget === item.player_id}"`)).join("")}</div>`;
      hint = "Choose a card and a teammate · Costs 1 ❤️";
    } else if (mode === "jewel") {
      controls += `<div class="eternal-decks-choice-grid">${view.revived.filter(item => !item.jewel).map(item => button(`${view.eternals[item.id].icon} ${view.eternals[item.id].name}`, "target", "jewel", false, `data-target="${item.id}" aria-pressed="${selectedTarget === item.id}"`)).join("")}</div>`;
      hint = "Choose cards and an Eternal to receive 💎.";
    } else if (mode === "ability") {
      controls += card?.kind === "ability" ? `<div class="eternal-decks-ability-options">${view.moves.map((move, index) => move.type === "ability" && move.card_id === card.id ? button(esc(abilityLabel(move)), "option", "ability", false, `data-option="${index}" aria-pressed="${selectedOption === index}"`) : "").join("")}</div>` : "";
      hint = card?.kind === "ability" ? cardDescription(card) : "Select an ability card.";
    } else if (mode === "play") {
      const check = view.field_checks.find(item => item.card_id === card?.id && item.row === selectedRow && item.orientation === orientation);
      hint = check?.reason || "Choose a card for this space.";
      if (card?.colors.length === 2) controls += button(`↔ ${orientation === "normal" ? "Normal" : "Rotated"}`, "rotate", "rotate");
    } else if (mode === "river") {
      hint = view.river.length === 4 && !view.river_reward_count ? "⚠ 这张牌将填满河流，领取 Game Over。" : "Choose a card for the river.";
    }
    const chosen = candidate();
    const labels = {play: "Play card", river: "Place in river", give: "Give ❤️", jewel: "Generate 💎", ability: "Use Ability ✦"};
    return `${controls}<p class="eternal-decks-selection" aria-live="polite">${esc(hint)}</p>${button(pending ? "Sending…" : labels[mode], "confirm", "confirm", !chosen, `class="eternal-decks-primary" data-ed-description="${esc(chosen ? explain.confirm : hint)}"`)}`;
  }

  function drawerHTML() {
    const player = own();
    if (!player) return "";
    const title = selectedPosition !== null ? positionLabel(selectedPosition) : {recipes: "💎 宝石配方", jewel: "💎 生成宝石", give: "Give ❤️", ability: "Ability ✦"}[mode] || `🃏 ${player.hand_count} cards`;
    return `<section class="eternal-decks-dock ${drawerOpen ? "is-open" : ""}" aria-label="Cards and actions">
      ${button(`<span class="eternal-decks-dock-grip" aria-hidden="true"></span><span class="eternal-decks-dock-label"><strong id="eternalDecksDrawerTitle">${esc(drawerOpen ? title : `🃏 ${player.hand_count} cards`)}</strong><span>${drawerOpen ? `${player.hand_count} cards · ` : ""}${player.deck_count} in deck</span></span><span class="eternal-decks-dock-toggle-label">${drawerOpen ? "Close ↓" : "Open ↑"}</span>`, "drawer", "card", false, `class="eternal-decks-dock-toggle" aria-expanded="${drawerOpen}" aria-controls="eternalDecksDrawerBody"`)}
      <div id="eternalDecksDrawerBody" class="eternal-decks-drawer-body" role="region" aria-labelledby="eternalDecksDrawerTitle" ${drawerOpen ? "" : "hidden"}>${drawerOpen ? drawerBodyHTML() : ""}</div>
    </section>`;
  }

  function playersHTML() {
    return view.players.map(player => `<div class="eternal-decks-player ${view.current_turn === player.player_id ? "is-current" : ""}"><div><strong>${icons[player.color]} ${esc(player.name)}${player.player_id === view.you ? " · You" : ""}</strong><span>${player.hand_count} cards · ${player.deck_count} in deck</span></div>${view.hands_revealed && player.player_id !== view.you ? `<div class="eternal-decks-mini-hand">${player.hand.map(card => cardHTML(card)).join("")}</div>` : ""}</div>`).join("");
  }

  function render() {
    if (!view) return;
    const player = own();
    const focused = panel.contains(document.activeElement) ? document.activeElement.dataset : null;
    const focusInDock = Boolean(document.activeElement.closest(".eternal-decks-dock"));
    const drawerScroll = panel.querySelector(".eternal-decks-drawer-body")?.scrollTop || 0;
    dockObserver.disconnect();
    const status = view.game_over ? (view.result.success ? "The stars are yours" : "The journey rests") : view.phase === "setup" ? "Prepare together" : view.phase === "round_end" ? "Review · Waiting for everyone" : view.phase === "discussion" ? "Ghost · Open discussion" : `${view.current_turn === view.you ? "Your turn" : name(view.current_turn) + "’s turn"}`;
    panel.innerHTML = `<div class="eternal-decks-shell"><div class="eternal-decks-title"><div><span class="eternal-decks-eyebrow">THE ETERNAL WORLD</span><h2>永恒牌 <small>Eternal Decks</small></h2><span class="eternal-decks-subtitle">Stage A · First Encounter · Beginner</span></div><div class="eternal-decks-counters"><strong title="Team stars: ${view.stars.length} of 4" data-ed-tip="Collect any four stars to win together." tabindex="0">⭐ ${view.stars.length}<small>/4</small></strong><span title="Shared hearts: ${view.hearts} of 3" data-ed-tip="Shared hearts pay for giving a hidden card to a teammate." tabindex="0">❤️ ${view.hearts}/3</span></div></div>
      <div class="eternal-decks-status"><strong role="status">${esc(status)}</strong><span>Turn ${view.turn_count + 1}</span></div>
      <p class="eternal-decks-notice" title="Prototype card list for 2 or 4 seats; not a complete retail reproduction." data-ed-tip="Prototype card list for 2 or 4 seats; not a complete retail reproduction." tabindex="0">Stage A · Beginner · Prototype</p>
      <div class="eternal-decks-layout"><div class="eternal-decks-table">${view.rows.map(fieldHTML).join("")}${riverHTML()}</div>
      <aside class="eternal-decks-sidebar">${phaseHTML()}
      ${view.phase === "round_end" || view.game_over ? reviewHTML() : ""}
      ${player ? `<div class="eternal-decks-resources">${button(`<span>💎 宝石</span><small>${Object.values(view.jewels).filter(Boolean).length}/8</small>`, "jewels", "jewel", false, `aria-expanded="${drawerOpen && ["recipes", "jewel"].includes(mode)}" aria-controls="eternalDecksDrawerBody"`)}${button(`<span>Give ❤️</span><small>${view.hearts}/3</small>`, "give", "give", !available("give"), `aria-expanded="${drawerOpen && mode === "give"}" aria-controls="eternalDecksDrawerBody"`)}</div>` : ""}
      ${revivalHTML()}</aside></div>
      <div class="eternal-decks-player-list">${playersHTML()}</div>
      <div class="eternal-decks-table-talk" aria-label="Table-talk reminders"><button type="button" class="eternal-decks-rule-chip" title="Do not reveal the number, color, dual-color information, or missing cards from an ordinary hand." data-ed-tip="Do not reveal the number, color, dual-color information, or missing cards from an ordinary hand.">🤫 Hand privacy</button><button type="button" class="eternal-decks-rule-chip" title="Rare cards, ability cards, and all public board information may be discussed." data-ed-tip="Rare cards, ability cards, and all public board information may be discussed.">🌈 Public talk OK</button></div>
      <div class="eternal-decks-details-grid"><details data-ed-detail="stars" ${openDetails.has("stars") ? "open" : ""}><summary>⭐ Star objectives · ${view.stars.length}/4</summary><ul>${Object.entries(view.star_goals).map(([id, goal]) => `<li>${view.stars.includes(id) ? "✅" : "☆"} ${esc(goal)}</li>`).join("")}</ul><p>A 系能力牌：${view.stage_card_count}/3</p></details>
      <details data-ed-detail="discard" ${openDetails.has("discard") ? "open" : ""}><summary>Discard · ${view.discard_count}${view.strict_discard ? " · Hidden" : ""}</summary><div class="eternal-decks-discard">${view.discard.map(card => cardHTML(card)).join("")}</div></details>
      <details data-ed-detail="log" ${openDetails.has("log") ? "open" : ""}><summary>Activity</summary><ol class="eternal-decks-log">${view.log.slice().reverse().map(item => `<li>${esc(item)}</li>`).join("")}</ol></details></div>${drawerHTML()}<div class="eternal-decks-toast" role="status" aria-live="polite"></div></div>`;
    panel.classList.toggle("eternal-decks-explaining", explaining);
    panel.classList.toggle("eternal-decks-has-dock", Boolean(player));
    panel.querySelectorAll("details").forEach(element => element.addEventListener("toggle", () => element.open ? openDetails.add(element.dataset.edDetail) : openDetails.delete(element.dataset.edDetail)));
    const dock = panel.querySelector(".eternal-decks-dock");
    if (dock) dockObserver.observe(dock);
    if (drawerOpen) panel.querySelector(".eternal-decks-drawer-body").scrollTop = drawerScroll;
    if (focused?.edAction) {
      const keys = ["edAction", "card", "position", "mode", "target", "recipe", "option", "disc", "player", "eternal", "row"];
      const replacement = Array.from(panel.querySelectorAll("[data-ed-action]")).find(element => keys.every(key => element.dataset[key] === focused[key]));
      (replacement || (focusInDock ? panel.querySelector(".eternal-decks-dock-toggle") : null))?.focus({preventScroll: true});
    }
  }

  function resetSelection() {
    selectedCards = []; selectedRow = null; selectedTarget = null; selectedRecipe = null;
    selectedOption = null; selectedPosition = null; orientation = "normal"; mode = "browse"; drawerOpen = false;
  }
  function setExplain(value) {
    explaining = value;
    panel.classList.toggle("eternal-decks-explaining", value);
    explainButton.setAttribute("aria-pressed", String(value));
  }
  function openDialog(title, body, html = false) {
    hideTip();
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
  function moveDisc(index, position) {
    if (!available("move_disc") || !own()?.discs[index] || position === null) return;
    submit({type: "move_disc", disc: index, position, seq: own().discs[index].seq + 1});
  }

  function hideTip() {
    window.clearTimeout(tipTimer);
    [panel, dialog].forEach(root => root.querySelector(".eternal-decks-toast")?.classList.remove("is-visible"));
  }

  function showTip(text, anchor, autoHide = true) {
    const root = dialog.open && dialog.contains(anchor) ? dialog : panel;
    const toast = root.querySelector(".eternal-decks-toast");
    if (!toast || !text) return;
    hideTip();
    toast.textContent = text;
    if (anchor?.isConnected) {
      const rect = anchor.getBoundingClientRect();
      const tip = toast.getBoundingClientRect();
      const center = Math.max(tip.width / 2 + 12, Math.min(window.innerWidth - tip.width / 2 - 12, rect.left + rect.width / 2));
      const top = rect.bottom + tip.height + 12 < window.innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - tip.height - 8);
      toast.style.left = `${center}px`;
      toast.style.top = `${top}px`;
      toast.style.bottom = "auto";
    }
    toast.classList.add("is-visible");
    if (autoHide) tipTimer = window.setTimeout(hideTip, 3000);
  }

  function openSpace(position) {
    if (!own()) return;
    resetSelection();
    selectedPosition = position;
    selectedRow = position < 21 ? Math.floor(position / 7) : null;
    mode = canPlayAtPosition() ? (position >= 21 ? "river" : "play") : "disc";
    drawerOpen = true;
    render();
    panel.querySelector(".eternal-decks-dock-toggle")?.focus({preventScroll: true});
  }

  function keepSpaceVisible() {
    if (!drawerOpen || selectedPosition === null || dialog.open) return;
    const space = panel.querySelector(`[data-position="${selectedPosition}"]`);
    const dock = panel.querySelector(".eternal-decks-dock");
    if (!space || !dock) return;
    const rect = space.getBoundingClientRect();
    const dockTop = dock.getBoundingClientRect().top;
    if (rect.bottom > dockTop - 16) window.scrollBy({top: rect.bottom - dockTop + 24, behavior: "smooth"});
  }

  function selectOnlyAbilityOption() {
    const options = view.moves.map((move, index) => ({move, index})).filter(item => item.move.type === "ability" && item.move.card_id === selectedCards[0]);
    selectedOption = options.length === 1 ? options[0].index : null;
  }

  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-ed-action]");
    if (!target || target.disabled || explaining || !view) return;
    const data = target.dataset;
    switch (data.edAction) {
      case "card":
        if (mode === "jewel") {
          if (selectedCards.includes(data.card)) selectedCards = selectedCards.filter(id => id !== data.card);
          else if (selectedCards.length < view.recipes[selectedRecipe].count) selectedCards.push(data.card);
        }
        else selectedCards = selectedCards[0] === data.card ? [] : [data.card];
        selectedOption = null; orientation = "normal";
        if (mode === "ability") selectOnlyAbilityOption();
        if (mode === "play") orientation = view.field_checks.find(check => check.card_id === selectedCards[0] && check.row === selectedRow && check.legal)?.orientation || "normal";
        break;
      case "slot":
      case "river-slot":
        openSpace(Number(data.position)); return;
      case "drawer":
        if (drawerOpen) resetSelection();
        else drawerOpen = true;
        break;
      case "mode":
        mode = data.mode; selectedCards = selectedCards.slice(0, 1); selectedTarget = null; selectedOption = null;
        if (mode === "ability") selectOnlyAbilityOption();
        break;
      case "rotate": orientation = orientation === "normal" ? "rotated" : "normal"; break;
      case "jewels": resetSelection(); mode = "recipes"; drawerOpen = true; break;
      case "give":
        resetSelection(); mode = "give"; drawerOpen = true;
        if (view.players.length === 2) selectedTarget = view.players.find(player => player.player_id !== view.you).player_id;
        break;
      case "recipe": {
        mode = "jewel"; selectedRecipe = data.recipe; selectedCards = [];
        const targets = view.revived.filter(item => !item.jewel);
        selectedTarget = targets.length === 1 ? targets[0].id : null;
        break;
      }
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
      case "disc": moveDisc(Number(data.disc), selectedPosition); return;
      case "return-disc": moveDisc(Number(data.disc), -1); return;
    }
    render();
  });

  [panel, dialog].forEach(root => {
    root.addEventListener("click", event => {
      const target = event.target.closest("[data-ed-tip]");
      if (!target || target.closest("[data-ed-action]") || explaining) return;
      showTip(target.dataset.edTip, target);
    });
    root.addEventListener("pointerover", event => {
      const target = event.target.closest("[data-ed-tip]");
      if (!target || target.contains(event.relatedTarget) || explaining || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      showTip(target.dataset.edTip, target, false);
    });
    root.addEventListener("pointerout", event => {
      const target = event.target.closest("[data-ed-tip]");
      if (target && !target.contains(event.relatedTarget) && event.pointerType !== "touch") hideTip();
    });
    root.addEventListener("focusin", event => {
      if (event.target.matches("[data-ed-tip]")) showTip(event.target.dataset.edTip, event.target);
    });
    root.addEventListener("focusout", event => {
      if (event.target.matches("[data-ed-tip]")) hideTip();
    });
  });

  helpButton.addEventListener("click", () => {
    setExplain(false);
    const fields = view ? Object.values(view.fields).map(field => `<li>${field.icon} ${field.name}：${field.rule}</li>`).join("") : "";
    openDialog("Eternal Decks · Help", `
      <p><strong>Stage A · Beginner · Prototype card data</strong>：本实现开放 2 或 4 个席位，可加机器人。永恒族八张牌采用明确标注的测试组合，非正式完整牌表；未开放其他关卡、三人专用配方或单人故事模式。</p>
      <p><strong>🤝 目标</strong>：取得任意四颗星共同获胜。当前玩家没有任何主行动，或取得河流 Game Over 时全队失败；同一回合同时胜负时胜利优先。</p>
      <p><strong>🃏 开局与回合</strong>：每人本色 1–5，洗牌抽三张；两人局各在牌库底加入两张随机副色牌。全员 Ready 后由选定玩家开始轮流行动。回合末从自己的牌库补到三张；超额不弃，空库不重洗。</p>
      <p><strong>三种主行动</strong>：① 出一张牌到场地／河流，或使用能力；② 用手牌生成一颗宝石；③ 消耗一心暗中给队友一张牌。只有行动者在回合末补牌。</p><ul>${fields}</ul>
      <p><strong>操作</strong>：底部 🃏 入口展开／收起手牌。先点场地或河流的下一个空格，在抽屉中选牌并确认；双色牌可翻转。💎 宝石与 Give ❤️ 入口相邻，选牌和目标都在抽屉内完成。使用能力时，展开手牌、点能力牌，再点 Use Ability ✦。</p>
      <p><strong>🌈 Rare 与双色</strong>：Rare 当下忽略场地和相邻限制，但女巫能禁止 Rare；之后是可变通配。山地 9、洞穴 1 后仍可接 Rare。双色牌选好方向后，左右半色分别比较两侧；落下后不能旋转。</p>
      <p><strong>✨ 复苏</strong>：各行前三圈分别填四、五、六张，选择复苏本行一位永恒族，八张牌加入自己的牌库底，行中牌弃掉。诅咒立即对全队生效；献宝石后解除。点角色可查能力、诅咒及公开牌组构成。</p>
      <p><strong>第四圈</strong>：填满七张后关闭。上行将另一行改成营地；中行恢复全部三颗心；下行得星。关闭行不能再放牌。</p>
      <p><strong>💎 宝石</strong>：每个配方仅能用一次，必须献给尚无宝石的复苏者。先点配方，再点选手牌与目标，Generate 💎。消耗牌进入河流。Rare 可替任意颜色／数字，双色可选其中一色；能力牌只适用任意两张／三张。女巫免费生成非 1/5/9 的宝石。</p>
      <p><strong>🌊 河流</strong>：达到五张或更多时全部清空，只取一次奖励。前三次通常拿 Rare，下一次 Game Over；美杜莎可以补充奖励。生成 1/5/9 会同时得星，第四星优先于 Game Over。</p>
      <p><strong>⭐ 六条路线</strong>：第 1–3 位全部获宝石；第 4–6 位全部获宝石；复苏九位；1/5/9 配方；下行第四圈；使用三张 A 系能力牌。每项只计一次。</p>
      <p><strong>能力</strong>：幽灵公开手牌直到全员 End Discussion；骷髅回一心；女巫免费宝石；美杜莎回收弃牌 Rare；牛头人与场地牌交换、留作 Rare；海怪取回河流最多两张。能力没有有效目标时可空用。</p>
      <p><strong>🤫 交流</strong>：不能透露普通数字牌的数字、颜色、缺少什么或持有双色；可讨论 Rare、能力和公开局面。Communication discs（交流圆片）可免费移动：点格子、选 Discs，再点圆片的 Place here；Return 收回。圆片只表达意图。</p>
      <p><strong>牌面说明</strong>：点永恒族可查看公开牌组。电脑悬停牌面、手机点击牌面可查看数字、颜色、Rare 或能力说明；手机提示 3 秒后消失，连续点选会更新内容。</p>
      <p><strong>⏸ 回顾</strong>：每整圈以及复苏、河流奖励、星星、第四圈奖励后，所有人 Next Round 才继续。掉线不会自动确认。空白和 Esc 取消选牌；Explain 可解释灰色按钮，期间不会执行游戏动作。</p>
      <p><a href="https://boardgamegeek.com/filepage/289015/eternaldecks-english-rulebooks" target="_blank" rel="noopener noreferrer">Author’s rulebooks</a> · 规则整理基于第四版，牌表仍待核实。</p>`, true);
  });
  explainButton.addEventListener("click", () => setExplain(!explaining));
  dialogClose.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { hideTip(); if (returnFocus?.isConnected) returnFocus.focus(); });
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
    hideTip();
    if (dialog.open) return;
    setExplain(false); resetSelection(); render();
  });

  function clearState() {
    view = null; signature = null; pending = false;
    resetSelection(); setExplain(false); openDetails.clear();
    dockObserver.disconnect(); hideTip();
    panel.classList.remove("eternal-decks-has-dock");
    panel.style.removeProperty("--ed-dock-height");
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
