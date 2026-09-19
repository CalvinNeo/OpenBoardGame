(() => {
  "use strict";

  const panel = document.getElementById("takeTimePanel");
  const header = document.getElementById("takeTimeHeaderActions");
  const help = document.getElementById("takeTimeHelpBtn");
  const explainButton = document.getElementById("takeTimeExplainBtn");
  const dialog = document.getElementById("takeTimeDialog");
  const dialogTitle = document.getElementById("takeTimeDialogTitle");
  const dialogBody = document.getElementById("takeTimeDialogBody");
  const dialogClose = document.getElementById("takeTimeDialogClose");
  const configBox = document.getElementById("takeTimeConfigBox");
  let view = null;
  let version = null;
  let selectedCard = null;
  let selectedSegment = null;
  let explaining = false;
  let pending = false;
  let pendingTimer = null;
  let suppressClick = false;
  let suppressTimer = null;
  let returnFocus = null;
  let planOpen = false;
  let logOpen = false;

  const explanations = {
    card: ["Your cards", "☀️ 太阳牌和 🌙 月亮牌各有 1–12。点击选择一张自己的牌，再选择时段。暗置后仍可查看自己的牌；🔒 表示只有你知道这个数字。"],
    sector: ["Clock segment", "从指针开始顺时针比较六个时段。每段至少一张，总和可以相等。颜色、数量、目标等条件在揭牌时判定；现在点选只代表放置位置，不会替你判断隐藏牌是否符合条件。"],
    ready: ["Ready", "先和队友商量目标。Ready 会让你看见自己的手牌并停止讨论，不能撤销；全员准备后才允许出牌。第一个人 Ready 后公共目标锁定。"],
    down: ["Place face down", "将选中的手牌暗置到选中的时段，立即结束你的回合。队友能看到牌背颜色、是谁出的和出牌顺序，不能看到数值。已放的牌不能移动。"],
    up: ["Place face up", "花一个全队共享的明牌额度，将选中的牌公开放置。基础额度等于人数，重试最多获得额外 3 次。静夜练习禁止明牌，即使有奖励也不例外。"],
    plan: ["Shared target", "讨论时用 + / − 约定各段的大致目标。目标只是给全队的参考，不是新的胜利条件。首位玩家 Ready 后不可再改。自由指针关卡的目标按起点顺序显示。"],
    hand: ["Clock hand", "普通钟盘从时段 1 开始。自由指针练习可在看牌前选择起点；结算会尝试所有起点，保留原位置或找到可通过的位置。这里只改变比较的起点，不旋转牌或规则。"],
    next: ["Next Round", "确认你已经看完揭牌结果。所有玩家都确认后，才执行显示的重试、下一关、跳过或结束。机器人只确认自己；有人掉线时会继续等待。"],
    choice: ["Continue choice", "重试保留失败奖励；跳过将本关记入遗憾封套并重置奖励，主路线结束后会重新挑战。修改继续方式会清空已有确认，确保大家看过同一个决定。"],
    reserve: ["Two-player reserve", "两人局各有两张未查看的备用牌。双方各出完两张（全队第 4 张落下）后，同时把各自备用牌加入手牌。此前连本人也不能看到数值。"],
  };

  const helpHTML = `
    <p><strong>🤝 合作目标</strong>：共同把 12 张牌放到六个时段。太阳 ☀️ 和月亮 🌙 各有 1–12，每次从 24 张中随机发 12 张。牌背颜色公开。</p>
    <p><strong>💬 讨论</strong>：先看钟盘条件、约定策略。可以用公共目标作参考；目标不参与胜负。点击 Ready 才看自己的牌，此后保持静默。所有人准备后，任何一人都可以先出第一张，之后按座位顺序轮流。</p>
    <p><strong>🃏 放置</strong>：点击一张手牌与一个时段，再选择 Place face down 或 Place face up。每回合必须放一张，已放牌不能挪动。🔒 数字仅你可见，👁 数字所有人可见。全队通常共享与人数相同的明牌额度。</p>
    <p><strong>✉️ 两人局</strong>：每人先拿 4 张，另有 2 张不看的备用牌。双方各放两张后，同时拿起备用牌。三人各 4 张，四人各 3 张。</p>
    <p><strong>🕰️ 揭牌</strong>：每个时段至少一张。从指针起顺时针，六段总和应非递减（允许相等），每段通常最多 24。还要满足钟盘上的数量、颜色和目标条件。结算前不会替你预检隐藏数字。</p>
    <p><strong>🌅 官方入门</strong>：Chapter 1 · Clock 1。第一时段恰好一张太阳牌，最后时段恰好三张牌；这一关总和没有 24 的上限。</p>
    <p><strong>🧩 练习</strong>：其余 11 个钟盘是本项目的原创练习配置，并非官方 2–40 关。包含区间、最近目标（允许并列）、禁明牌、指定首尾落点、先出最高／最低牌、极值、自由指针和双牌差值。当前钟盘会直接显示条件。</p>
    <p><strong>🧭 自由指针／差值</strong>：可以在看牌前选起点；结算也会尝试六个起点。差值关每段必须两张，按较大数减较小数比较先后，其他条件依旧看牌面总和。</p>
    <p><strong>🔁 失败与遗憾</strong>：每次失败让下次重试多一次明牌，最多 +3。禁明牌关仍不能明牌。成功或跳过清空奖励。跳过的关卡会在主路线之后重访。</p>
    <p><strong>⏸ 回顾</strong>：揭牌后暂停，所有玩家点击 Next Round 才继续。修改继续方式会清空确认。End Journey 可以结束本次路线，结果会标明还有多少关未完成。</p>
    <p><a href="https://www.libellud.com/en/resources/take-time/" target="_blank" rel="noopener noreferrer">Official rules & resources</a></p>`;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
  }

  function button(text, action, explanation, disabled = false, extra = "") {
    return `<button type="button" data-tt-action="${action}" data-tt-explain="${explanation}" ${disabled ? "disabled" : ""} ${extra}>${text}</button>`;
  }

  function available(action) {
    return !pending && Boolean(view?.legal_actions.includes(action));
  }

  function playerName(id) {
    return view?.players.find(player => player.player_id === id)?.name || "Player";
  }

  function cardHTML(card, small = false) {
    const face = card.value == null ? "?" : card.value;
    const icon = card.color === "solar" ? "☀️" : "🌙";
    const marker = card.owner ? (card.face_up || view.result ? "👁" : card.value != null ? "🔒" : "") : "";
    const content = `<span>${icon}</span><strong>${face}</strong>${marker ? `<small>${marker}</small>` : ""}`;
    if (small) {
      const label = `${icon} ${face}${card.owner ? ` · ${playerName(card.owner)} · #${card.order}` : ""}${marker === "🔒" ? " · Only you can see this number" : ""}`;
      return `<span class="take-time-mini ${card.color}" title="${esc(label)}" aria-label="${esc(label)}">${content}</span>`;
    }
    const disabled = !available("place") || !view.legal_card_ids.includes(card.id);
    return button(content, "card", "card", disabled,
      `class="take-time-card ${card.color} ${selectedCard === card.id ? "selected" : ""}" data-card="${esc(card.id)}" aria-pressed="${selectedCard === card.id}" aria-label="${esc(`${icon} ${face}`)}"`);
  }

  function boardHTML() {
    const start = view.result?.hand_segment ?? view.hand_segment;
    const sectors = view.board.map((cards, index) => {
      const result = view.result?.segments[index];
      const order = (index - start + 6) % 6 + 1;
      const labels = view.clock.segments[index].labels;
      const selected = selectedSegment === index;
      const disabled = !available("place") || !view.legal_segments.includes(index);
      const total = result ? `<strong class="take-time-total">${view.clock.metric === "difference" ? `Δ ${result.value} · Σ ${result.sum}` : `Σ ${result.sum}`} ${result.passed ? "✓" : "✕"}</strong>`
        : `<span class="take-time-count">${cards.length} ${cards.length === 1 ? "card" : "cards"}</span>`;
      const checks = result ? `<span class="take-time-checks">${result.checks.map(check => `<span class="${check.passed ? "pass" : "fail"}">${check.passed ? "✓" : "✕"} ${esc(check.label)}</span>`).join("")}</span>` : "";
      return `<button type="button" class="take-time-sector take-time-sector-${index} ${selected ? "selected" : ""} ${result ? result.passed ? "passed" : "failed" : ""}"
        data-tt-action="sector" data-segment="${index}" data-tt-explain="sector" ${disabled ? "disabled" : ""} aria-pressed="${selected}" aria-label="Segment ${index + 1}, ${cards.length} cards">
        <span class="take-time-sector-heading"><strong>${index === start ? "🧭" : ""} ${index + 1}</strong><small>${order === 1 ? "START" : `↻ ${order}`}</small></span>
        <span class="take-time-sector-rules">${labels.length ? labels.map(label => `<span>${esc(label)}</span>`).join("") : "至少一张"}</span>
        <span class="take-time-pile">${cards.map(card => cardHTML(card, true)).join("") || '<span class="take-time-empty">＋</span>'}</span>
        ${total}${checks}
      </button>`;
    }).join("");
    return `<div class="take-time-clock" aria-label="Six clock segments, clockwise from the hand">${sectors}
      <div class="take-time-clock-center"><div class="take-time-dial" aria-hidden="true"><span>🕰️</span></div><strong>${view.clock.metric === "difference" ? "DIFFERENCES" : "TAKE TIME"}</strong>
      <span>${view.placed_count} / 12 cards</span><small>↻ ${view.clock.metric === "difference" ? "差值" : "总和"}递增 · 可相等</small>
      <small>${view.clock.cap === null ? "∞ 无总和上限" : `每段总和 ≤ ${view.clock.cap}`}</small></div></div>`;
  }

  function playersHTML() {
    return view.players.map(player => {
      const own = player.player_id === view.you;
      const status = view.phase === "discussion" ? player.ready ? "🤫 Ready" : "💬 Planning"
        : view.result ? player.next_ready ? "✓ Ready" : "Reviewing"
        : player.player_id === view.current_turn ? "▶ Playing" : `${player.hand.length} in hand`;
      return `<div class="take-time-player ${player.player_id === view.current_turn ? "active" : ""}">
        <div><strong>${esc(player.name)}${own ? " · You" : ""}${player.is_bot ? " 🤖" : ""}</strong><small>${status}</small></div>
        <span class="take-time-backs" aria-label="Visible card backs">${player.hand.map(card => card.color === "solar" ? "☀️" : "🌙").join(" ")}${player.reserve.length ? ` · ✉️ ${player.reserve.length}` : ""}</span></div>`;
    }).join("");
  }

  function planHTML() {
    const locked = !available("set_plan");
    return `<details class="take-time-details" data-detail="plan" ${planOpen ? "open" : ""}><summary>🎯 Shared plan ${locked ? "· Locked" : "· Optional"}</summary>
      <p>先讨论，再看牌。目标仅供参考，不参与胜负。</p><div class="take-time-plan-grid">${view.targets.map((target, index) => {
        const segment = (index + view.hand_segment) % 6;
        return `<div class="take-time-plan-cell"><span>Segment ${segment + 1}</span><div>${button("−", "plan", "plan", locked || target <= 0, `data-index="${index}" data-delta="-1" aria-label="Lower target ${segment + 1}"`)}<strong>${target}</strong>${button("+", "plan", "plan", locked || target >= 36, `data-index="${index}" data-delta="1" aria-label="Raise target ${segment + 1}"`)}</div></div>`;
      }).join("")}</div>${view.clock.movable_hand ? `<div class="take-time-hand-picker"><span>Clock hand</span>${[0, 1, 2, 3, 4, 5].map(index => button(String(index + 1), "hand", "hand", !available("set_hand"), `data-segment="${index}" aria-pressed="${view.hand_segment === index}"`)).join("")}</div>` : ""}</details>`;
  }

  function actionHTML() {
    const own = view.players.find(player => player.player_id === view.you);
    if (!own) return '<p class="take-time-notice">Spectating · Private card values are hidden.</p>';
    if (view.result) {
      const choices = {retry: "🔁 Retry", advance: "→ Next Clock", skip: "✉️ Skip to Regrets", finish: "End Journey"};
      if (view.game_over) {
        return `<div class="take-time-result-title">${view.journey_complete ? "🏆 Journey complete" : "Journey ended"}</div><p>${view.completed.length} / ${view.itinerary.length} clocks passed${view.journey_complete ? "." : ` · ${view.itinerary.length - view.completed.length} unfinished.`}</p>`;
      }
      const waiting = view.players.filter(player => !player.next_ready).map(player => player.name).join(", ");
      return `<div class="take-time-result-title">${view.result.success ? "✅ Test passed" : "🔎 Try again"}</div>
        <p>${view.result.success ? "已满足本关所有条件。" : `查看钟盘上的红色条件。重试奖励 +${view.bonus}${view.clock.no_face_up ? "；本关仍禁止明牌" : " 次明牌"}。`}</p>
        ${view.result.hand_segment !== view.result.planned_hand ? `<p>🧭 结算起点调整为时段 ${view.result.hand_segment + 1}。</p>` : ""}
        <div class="take-time-choice-row">${view.next_choices.map(choice => button(choices[choice], "choice", "choice", !available("choose_next"), `data-choice="${choice}" aria-pressed="${view.next_choice === choice}"`)).join("")}</div>
        <p class="take-time-next-summary">Continue: <strong>${choices[view.next_choice]}</strong></p>
        ${button(`Next Round · ${view.next_ready.length}/${view.players.length}`, "next", "next", !available("next_round"), 'class="take-time-primary take-time-next"')}
        <p class="take-time-waiting">${own.next_ready ? "Your confirmation is saved. " : "Review the revealed cards before continuing. "}${waiting ? `Waiting: ${esc(waiting)}` : ""}</p>`;
    }
    const reserve = own.reserve.length ? `<div class="take-time-reserve" data-tt-explain="reserve"><span>✉️ Reserve · ${own.reserve.length}</span>${own.reserve.map(card => cardHTML(card, true)).join("")}</div>` : "";
    if (view.phase === "discussion") {
      return `<h3>Your hand</h3><p>${own.ready ? "🤫 Keep silent. Waiting for everyone to look." : "💬 Discuss together before looking."}</p>
        <div class="take-time-hand">${own.hand.map(card => cardHTML(card)).join("")}</div>${reserve}
        ${button(own.ready ? "Ready · Waiting" : "Ready · Look at cards", "ready", "ready", !available("ready"), 'class="take-time-primary take-time-next"')}`;
    }
    const selected = own.hand.find(card => card.id === selectedCard);
    const canPlace = available("place") && selected && selectedSegment !== null;
    const quota = view.face_up_limit - view.face_up_used;
    const description = selected ? `${selected.color === "solar" ? "☀️" : "🌙"} ${selected.value}${selectedSegment !== null ? ` → Segment ${selectedSegment + 1}` : " · Choose a segment"}`
      : selectedSegment !== null ? `Segment ${selectedSegment + 1} · Choose a card` : "Choose a card, then a segment";
    return `<h3>Your hand</h3><div class="take-time-hand">${own.hand.map(card => cardHTML(card)).join("")}</div>${reserve}
      <p class="take-time-selection" aria-live="polite">${description}</p><div class="take-time-place-actions">
      ${button("🔒 Place face down", "down", "down", !canPlace, 'class="take-time-primary"')}
      ${button(`👁 Place face up · ${quota}`, "up", "up", !canPlace || quota <= 0)}</div>
      <p class="take-time-hint">${available("place") ? "点击空白或按 Esc 取消选择。" : "等待轮到你出牌。"} ${pending ? "Sending…" : ""}</p>`;
  }

  function render() {
    if (!view || !panel) return;
    const own = view.players.some(player => player.player_id === view.you);
    let status;
    if (view.game_over) status = "Journey ended";
    else if (view.result) status = "⏸ Review the revealed clock";
    else if (view.phase === "discussion") status = "💬 Discuss before looking";
    else if (!view.current_turn) status = "🤫 Anyone may play first";
    else status = view.current_turn === view.you ? "▶ Your turn · Keep silent" : `🤫 ${playerName(view.current_turn)}'s turn`;
    const rules = [];
    if (view.clock.no_face_up) rules.push("🙈 禁止明牌");
    if (view.clock.play_order !== "any") rules.push(view.clock.play_order === "highest" ? "⬆️ 每次出手中最大牌" : "⬇️ 每次出手中最小牌");
    if (view.clock.movable_hand) rules.push("🧭 自由指针");
    if (view.clock.metric === "difference") rules.push("每段两张 · 按差值排序");
    const origin = view.clock.source === "official_1_1" ? "Official · Chapter 1 / Clock 1" : "Original practice";
    panel.innerHTML = `<div class="take-time-shell"><div class="take-time-title-row"><div><span class="take-time-eyebrow">A MOMENT, TOGETHER</span><h2>${esc(view.clock.name)}</h2><span class="take-time-origin">${origin}</span></div><div class="take-time-progress"><strong>${view.completed.length}<small> / ${view.itinerary.length}</small></strong><span>clocks passed</span></div></div>
      <div class="take-time-status"><strong role="status">${esc(status)}</strong><span>Attempt ${view.attempt} · 👁 ${view.face_up_used}/${view.face_up_limit}</span></div>
      ${rules.length ? `<div class="take-time-clock-rules">${rules.map(rule => `<span>${rule}</span>`).join("")}</div>` : ""}
      <div class="take-time-layout"><section class="take-time-board-area">${boardHTML()}<div class="take-time-legend"><span>☀️ Solar</span><span>🌙 Lunar</span><span>🔒 Only you</span><span>👁 Public</span></div></section>
      <aside class="take-time-sidebar"><section class="take-time-action-box">${actionHTML()}</section><div class="take-time-players">${playersHTML()}</div>${planHTML()}</aside></div>
      <div class="take-time-footer"><span>✉️ Regrets · ${view.regrets.length}</span><span>${own ? "🤝 Win or learn together" : "Spectator"}</span></div>
      <details class="take-time-details" data-detail="log" ${logOpen ? "open" : ""}><summary>Activity</summary><ol class="take-time-log">${view.log.slice().reverse().map(line => `<li>${esc(line)}</li>`).join("")}</ol></details>
      <p class="take-time-scope">Includes 1 verified introductory clock + 11 original practice clocks.</p></div>`;
    panel.classList.toggle("take-time-explaining", explaining);
    panel.querySelectorAll("details").forEach(details => details.addEventListener("toggle", () => {
      if (details.dataset.detail === "plan") planOpen = details.open;
      else logOpen = details.open;
    }));
  }

  function clearSelection() {
    if (selectedCard === null && selectedSegment === null) return;
    selectedCard = null;
    selectedSegment = null;
    render();
  }

  function setExplain(enabled) {
    explaining = enabled;
    panel.classList.toggle("take-time-explaining", enabled);
    explainButton.setAttribute("aria-pressed", String(enabled));
  }

  function openDialog(title, content, html = false) {
    returnFocus = document.activeElement;
    dialogTitle.textContent = title;
    if (html) dialogBody.innerHTML = content;
    else dialogBody.textContent = content;
    if (!dialog.open) dialog.showModal();
    dialogClose.focus();
  }

  function explainTarget(target) {
    const entry = explanations[target?.dataset.ttExplain];
    if (!entry) return;
    setExplain(false);
    openDialog(entry[0], entry[1]);
  }

  function submit(action) {
    if (pending || !view || typeof sendAction !== "function") return;
    pending = true;
    selectedCard = null;
    selectedSegment = null;
    render();
    sendAction(action);
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => { pending = false; render(); }, 6000);
  }

  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-tt-action]");
    if (!target || target.disabled || explaining) return;
    const kind = target.dataset.ttAction;
    if (kind === "card") {
      selectedCard = selectedCard === target.dataset.card ? null : target.dataset.card;
      render();
    } else if (kind === "sector") {
      const segment = Number(target.dataset.segment);
      selectedSegment = selectedSegment === segment ? null : segment;
      render();
    } else if (kind === "ready") submit({type: "ready"});
    else if (kind === "next") submit({type: "next_round"});
    else if (kind === "choice") submit({type: "choose_next", choice: target.dataset.choice});
    else if (kind === "plan") {
      const index = Number(target.dataset.index);
      submit({type: "set_plan", segment: index, target: view.targets[index] + Number(target.dataset.delta)});
    } else if (kind === "hand") submit({type: "set_hand", segment: Number(target.dataset.segment)});
    else if ((kind === "down" || kind === "up") && selectedCard && selectedSegment !== null) {
      submit({type: "place", card_id: selectedCard, segment: selectedSegment, face_up: kind === "up"});
    }
  });

  help.addEventListener("click", () => { setExplain(false); openDialog("Take Time · Help", helpHTML, true); });
  explainButton.addEventListener("click", () => setExplain(!explaining));
  dialogClose.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });

  // Coordinate hit-testing is necessary because disabled controls do not emit click.
  document.addEventListener("pointerdown", event => {
    if (!explaining || panel.classList.contains("hidden")) return;
    if (header.contains(event.target) || dialog.contains(event.target)) return;
    const target = Array.from(panel.querySelectorAll("[data-tt-explain]")).find(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target) {
      suppressClick = true;
      window.clearTimeout(suppressTimer);
      suppressTimer = window.setTimeout(() => { suppressClick = false; }, 600);
      explainTarget(target);
    }
  }, true);

  document.addEventListener("click", event => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!explaining) return;
    if (header.contains(event.target) || dialog.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (panel.contains(event.target)) explainTarget(event.target.closest("[data-tt-explain]"));
  }, true);

  document.addEventListener("pointerdown", event => {
    if (explaining || !view || !panel.contains(event.target)) return;
    if (event.target.closest("button, input, select, summary, a, .take-time-hand-picker")) return;
    clearSelection();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || panel.classList.contains("hidden")) return;
    setExplain(false);
    clearSelection();
  });

  function clearState() {
    view = null;
    version = null;
    selectedCard = null;
    selectedSegment = null;
    pending = false;
    planOpen = false;
    logOpen = false;
    window.clearTimeout(pendingTimer);
    window.clearTimeout(suppressTimer);
    suppressClick = false;
    setExplain(false);
    if (dialog.open) dialog.close();
    panel.innerHTML = "";
  }

  window.renderTakeTimeGameState = data => {
    if (!data?.view) return;
    const nextVersion = `${data.room_id}:${data.state_version}`;
    if (version !== nextVersion) { selectedCard = null; selectedSegment = null; }
    version = nextVersion;
    view = data.view;
    pending = false;
    window.clearTimeout(pendingTimer);
    render();
  };
  window.showTakeTimeHeaderActions = visible => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };
  window.clearTakeTimeState = clearState;
  window.getTakeTimeConfig = () => ({start_clock: document.getElementById("takeTimeStartClock").value});
  window.updateTakeTimeConfigRow = () => {
    const visible = currentGameType === "take_time" && currentRoomState?.status === "lobby";
    configBox.classList.toggle("hidden", !visible);
    configBox.setAttribute("aria-hidden", String(!visible));
  };
  if (typeof socket !== "undefined") socket.on("error", () => {
    if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); }
  });
})();
