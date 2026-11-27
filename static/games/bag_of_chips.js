(function () {
  "use strict";
  const GAME_ID = "bag_of_chips";
  const symbols = { yellow: "🟡", orange: "🟠", red: "🔴", green: "🟢", purple: "🟣" };
  const names = { yellow: "Original", orange: "Cheese", red: "Barbecue", green: "Onion", purple: "Vinegar" };
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const colorName = (color) => `${names[color]} (${symbols[color]})`;
  const HELP = {
    gameId: GAME_ID,
    title: { zh: "来包洋芋片", en: "Bag of Chips" },
    basic: {
      win: { zh: "完成目标牌来争夺奖励(🏅)，率先达到 4 枚时比较奖励总数，最多者获胜，双人局改为 3 枚。", en: "Complete objectives to earn rewards (🏅). Reaching four triggers the final ranking by rewards, with a target of three in a two-player game." },
      turn: { zh: "每轮拿 6 张目标牌，在揭出 5 片、4 片薯片后分别弃 2 张、1 张，再揭 3 片后将剩余牌分成两张加分和一张扣分。", en: "Start with six objectives. After five chips discard two cards, after four more discard one, and after three more assign two positive cards and one negative card." },
      key: { zh: "所有人共用桌上的薯片，用已经出现的颜色和袋中剩余数量判断目标，在最后两片揭晓前留下最有利的组合。", en: "Everyone uses the same chips. Read the colors already drawn and their remaining supply to keep the best combination before the final two chips appear." }
    },
    sections: [
      { id: "flow", label: { zh: "一轮流程", en: "Round flow" }, html: {
        zh: "<p>采用 2021 原版的 36 张目标牌。每轮重新洗牌并将 25 片薯片放回袋中。原味(🟡)7 片、起司(🟠)6 片、烧烤(🔴)5 片、洋葱(🟢)4 片、醋味(🟣)3 片。</p><p>先揭 5 片并秘密弃两张目标，再揭 4 片并秘密弃一张。再揭 3 片后，每个人选择一张扣分牌，其余两张自动成为加分牌。所有人提交后同时公开分配并揭出第 13 片。全员点击 Reveal last chip 后揭第 14 片并结算，只有第 14 片算最后一片。</p><p>每人可以在确认前取消选择，确认后不能更改。其他人看不到你的手牌、弃牌或尚未公开的加扣分分配。每轮结果须全员点击 Next Round 才继续，最终结果也须全员确认后才可 Play Again。</p>",
        en: "<p>This implementation uses the 36 objectives from the original 2021 edition. Each round reshuffle all cards and return all 25 chips: Original (🟡) ×7, Cheese (🟠) ×6, Barbecue (🔴) ×5, Onion (🟢) ×4, Vinegar (🟣) ×3.</p><p>Reveal five chips and secretly discard two objectives. Reveal four more and discard one. Reveal three more and choose one negative objective, leaving two positive objectives. Reveal all assignments together and draw chip 13. After everyone clicks Reveal last chip, reveal chip 14 and score. Only chip 14 is the last chip.</p><p>You can cancel a selection before confirming. Submitted decisions are final and stay private until assignments are revealed. Every player must click Next Round after settlement. Everyone must confirm the final breakdown before Play Again becomes available.</p>"
      } },
      { id: "cards", label: { zh: "目标牌", en: "Objectives" }, html: {
        zh: "<p>每种至少：五种颜色都达到指定数量。指定至少：所有列出的颜色均达到数量。颜色相等：两种颜色数量相同，零比零也算。最后一片：第 14 片是指定颜色。没有颜色：14 片中没有该色。每片计分：指定颜色每片获得牌面分数。颜色更多：左边颜色严格多于右边。</p><p>所有目标只看本轮桌上最终 14 片，不看个人持有或薯片出现的区域。未达成的目标为零分，包括扣分牌。每片计分牌先乘颜色总数，再按加扣分方向结算。牌面展示的是条件和分值，不是自动保证获得的分数。</p>",
        en: "<p>Each color: all five colors meet the minimum. At least: every listed color meets its minimum. Equal: both colors have equal counts, including zero against zero. Last chip: chip 14 has the named color. None: that color is absent from the 14 chips. Per chip: multiply the printed value by that color’s count. More than: the left color strictly outnumbers the right.</p><p>All objectives use the final shared set of 14 chips, not personal chips or individual draw groups. An unmet objective is worth zero, even on the negative side. Per-chip values are multiplied before applying their sign. A card’s printed points are conditional, not guaranteed.</p>"
      } },
      { id: "scoring", label: { zh: "得分与特殊牌", en: "Scoring & special" }, html: {
        zh: "<p>两张加分牌的分数减去一张扣分牌的分数就是本轮得分，可以是负数。三至六人局，第一名获 2 枚奖励(🏅)，第二名获 1 枚。并列第一各获 2 枚且无人获得第二名奖励，并列第二各获 1 枚。双人局只有第一名获 1 枚，并列时两人各得 1 枚。</p><p>特殊牌要求醋味(🟣)比原味(🟡)多。放在加分侧且达成会立刻赢得整局，放在扣分侧且达成则输掉本轮，不能获得奖励。没有达成就没有效果。</p><p>三至六人局达到 4 枚、双人局达到 3 枚后，奖励最多者赢。奖励相同则比较刚结束一轮的分数，如果仍然相同就再玩一轮。每位玩家的三张牌、是否达成、加扣分及奖励变化都在结算中公开。</p>",
        en: "<p>Your round score is the two positive objectives minus the negative objective and may be below zero. With three to six players, first place gets two rewards (🏅) and second gets one. Tied first places each get two with no second-place reward. Tied second places each get one. With two players, only first place gets one reward, and a tie gives one to each.</p><p>The special objective requires more Vinegar (🟣) than Original (🟡). Completing it on the positive side immediately wins the game. Completing it on the negative side loses the round and makes you ineligible for rewards. If unmet, it has no effect.</p><p>At four rewards, or three with two players, most rewards wins. Break a reward tie using the last round’s score. If still tied, play another round. Settlement reveals all three objectives, their success, signed points, and reward changes for every player.</p>"
      } }
    ]
  };

  function cardText(card) {
    const colors = card.colors || [];
    const points = card.special ? "WIN / LOSE" : `${card.points} pts`;
    if (card.kind === "each") return { formula: `5 colors × ${card.amount}+`, text: `At least ${card.amount} of every color`, detail: `At least ${card.amount} chips of each of the five colors. ${points} if met.` };
    if (card.kind === "minimum") return { formula: Object.entries(card.needs).map(([color, amount]) => `${symbols[color]}≥${amount}`).join(" "), text: "Meet every listed minimum", detail: `${Object.entries(card.needs).map(([color, amount]) => `${colorName(color)} at least ${amount}`).join(" and ")}. ${points} if met.` };
    if (card.kind === "equal") return { formula: `${symbols[colors[0]]} = ${symbols[colors[1]]}`, text: "Exactly the same count", detail: `${colorName(colors[0])} and ${colorName(colors[1])} have equal counts, including zero against zero. ${points} if met.` };
    if (card.kind === "last") return { formula: `LAST ${symbols[colors[0]]}`, text: "The 14th chip is this color", detail: `Only the 14th and final chip must be ${colorName(colors[0])}. ${points} if met.` };
    if (card.kind === "absent") return { formula: `${symbols[colors[0]]} = 0`, text: "None of this color", detail: `No ${colorName(colors[0])} chips among the final fourteen. ${points} if met.` };
    if (card.kind === "per") return { formula: `${symbols[colors[0]]} × ${card.points}`, text: `${card.points} points per chip`, detail: `Score ${card.points} points for each ${colorName(colors[0])} chip among the final fourteen.` };
    return { formula: `${symbols[colors[0]]} > ${symbols[colors[1]]}`, text: card.special ? "Special · win game / lose round" : "Left color strictly outnumbers right", detail: `${colorName(colors[0])} must strictly outnumber ${colorName(colors[1])}. ${card.special ? "On the positive side this instantly wins the game. On the negative side this loses the round, so you cannot earn rewards." : `${points} if met.`}` };
  }

  function init() {
    if (typeof window.obgCreateHelp !== "function" || typeof window.obgCreateExplain !== "function") return;
    const byId = (suffix) => document.getElementById(`bagOfChips${suffix}`);
    const panel = byId("Panel");
    let view = null;
    let selected = [];
    let inFlight = false;
    let requestTimer = null;
    let activeRoom = null;
    let signature = "";
    let tooltipTimer = null;
    let press = null;
    let suppressClick = false;
    const explanations = {
      rewards: "Rewards (🏅) determine the winner. First/second receive 2/1, with no second reward when first is tied. With two players only first gets 1. The target is 4 rewards, or 3 with two players. Reward ties use the final round score, and a remaining tie adds a round.",
      bag: "All players use the same 25-chip bag: Original (🟡) ×7, Cheese (🟠) ×6, Barbecue (🔴) ×5, Onion (🟢) ×4, Vinegar (🟣) ×3. Exactly fourteen chips are drawn each round. Unseen chips remain private.",
      commit: "Submit your selected cards privately. In phases 1 and 2 discard exactly two and one objectives respectively. In phase 3 choose one negative objective, leaving two positive objectives. A confirmed decision cannot be changed.",
      results: "Each line reveals a player's two positive objectives and one negative objective. Unmet cards score zero. A met special negative loses the round. All players must review before continuing. The final review must be confirmed before Play Again.",
      reveal: "The thirteenth chip has appeared and assignments are public. After all players acknowledge, reveal chip fourteen, which alone determines Last chip objectives.",
      next: "Acknowledge the current score breakdown. The next round starts only after every player confirms. No additional confirmation dialog is needed.",
      end: "Confirm the final itemized results. Play Again is available only when everyone has confirmed.",
      again: "Start a fresh game with the same players after every player has confirmed the final scores."
    };
    const help = window.obgCreateHelp(HELP);
    const explain = window.obgCreateExplain({ gameId: GAME_ID, attribute: "data-boc-explain", explanations: explanations,
      root: () => panel, button: byId("ExplainBtn"), bypass: ["#bagOfChipsHelpBtn", "#bagOfChipsExplainBtn"] });
    const can = (action) => !inFlight && view?.legal_actions?.includes(action);
    const me = () => view?.players.find((player) => player.player_id === view.you);

    function hideTooltip() {
      clearTimeout(tooltipTimer);
      byId("Tooltip").classList.add("hidden");
    }

    function showTooltip(node) {
      const tooltip = byId("Tooltip");
      hideTooltip();
      tooltip.textContent = node.dataset.bocTip;
      tooltip.style.left = "12px";
      tooltip.style.top = "12px";
      tooltip.classList.remove("hidden");
      const rect = node.getBoundingClientRect();
      const box = tooltip.getBoundingClientRect();
      tooltip.style.left = `${Math.max(12, Math.min(innerWidth - box.width - 12, rect.left))}px`;
      tooltip.style.top = `${Math.max(12, Math.min(innerHeight - box.height - 12, rect.bottom + 7))}px`;
      tooltipTimer = setTimeout(hideTooltip, 3000);
    }

    function send(type, cards) {
      if (!can(type)) return;
      const action = { type, round: view.round, step: view.step };
      if (cards) action.cards = cards;
      inFlight = true;
      renderSelection();
      socket.emit("game:action", { action });
      clearTimeout(requestTimer);
      requestTimer = setTimeout(() => { inFlight = false; renderSelection(); }, 8000);
    }

    function renderSelection() {
      const choosing = can(view?.stage);
      panel.querySelectorAll("[data-boc-card]").forEach((node) => {
        const chosen = selected.includes(Number(node.dataset.bocCard));
        node.classList.toggle("is-selected", chosen);
        node.setAttribute("aria-pressed", String(chosen));
        node.disabled = !choosing;
      });
      byId("Confirm").classList.toggle("hidden", !selected.length);
      const required = view?.stage === "discard" && view.phase === 1 ? 2 : 1;
      byId("Selection").textContent = view?.stage === "place" ? "Selected card: − negative. Other two: + positive." : `${selected.length} / ${required} to discard`;
      byId("CommitBtn").disabled = !choosing || selected.length !== required;
      byId("CommitBtn").textContent = inFlight ? "Sending…" : view?.stage === "place" ? "Lock in − / +" : `Discard ${required}`;
      byId("CancelBtn").disabled = inFlight;
      explain.refresh();
    }

    function cardHTML(card, player) {
      const content = cardText(card);
      const role = player.negative?.id === card.id ? "− NEGATIVE" : player.positive.some((entry) => entry.id === card.id) ? "+ POSITIVE" : "";
      explanations[`card${card.id}`] = `${content.detail} All conditions use the final shared fourteen chips. ${role ? `This card is assigned ${role}.` : "Select this objective, then confirm nearby to discard it or assign it to the negative side."}`;
      return `<button type="button" class="boc-card" data-boc-card="${card.id}" data-boc-explain="card${card.id}" aria-pressed="false"><span class="boc-card-top"><span>OBJECTIVE ${String(card.id).padStart(2, "0")}</span><strong class="boc-points">${card.special ? "★" : card.points}</strong></span><span class="boc-condition">${escape(content.formula)}</span><span class="boc-card-bottom">${escape(content.text)}</span>${role ? `<span class="boc-card-role ${role.startsWith("+") ? "is-positive" : ""}">${role}</span>` : ""}</button>`;
    }

    function render() {
      if (!view) return;
      byId("Lobby").classList.add("hidden");
      byId("Table").classList.remove("hidden");
      byId("Round").textContent = `ROUND ${view.round} · ${view.stage === "discard" || view.stage === "place" ? `DRAW ${view.phase} / 4` : "FINAL DRAW"}`;
      byId("Target").textContent = `🏅 First to ${view.target}`;
      byId("Target").dataset.bocTip = `Rewards (🏅): reach ${view.target} to trigger the final ranking. Most rewards wins, then last round score breaks ties.`;
      byId("Bag").textContent = `${view.bag_count} left in bag`;
      byId("Bag").dataset.bocTip = explanations.bag;
      const slices = [view.drawn.slice(0, 5), view.drawn.slice(5, 9), view.drawn.slice(9, 12), view.drawn.slice(12)];
      byId("Draws").innerHTML = slices.map((chips, index) => {
        const label = ["01 · FIVE", "02 · FOUR", "03 · THREE", "04 · TWO"][index];
        const expected = [5, 4, 3, 2][index];
        const chipsHTML = chips.map((color, chipIndex) => `<span class="boc-chip boc-${color}${index === 3 && chipIndex === 1 ? " is-last" : ""}" data-boc-tip="${escape(`${colorName(color)}${index === 3 && chipIndex === 1 ? " · Last chip" : ""}`)}" tabindex="0" aria-label="${escape(colorName(color))}"></span>`).join("");
        return `<div class="boc-draw-group ${index + 1 === view.phase ? "is-current" : ""}"><span class="boc-draw-label">${label}</span><div class="boc-draw-chips">${chipsHTML}${Array.from({ length: expected - chips.length }, () => '<span class="boc-chip boc-unknown" aria-label="Not yet drawn">?</span>').join("")}</div></div>`;
      }).join("");
      const counts = Object.fromEntries(Object.keys(symbols).map((color) => [color, view.drawn.filter((chip) => chip === color).length]));
      byId("Counts").innerHTML = view.colors.map((color) => `<div class="boc-count" data-boc-tip="${escape(`${colorName(color.id)}: ${counts[color.id]} revealed, ${color.count - counts[color.id]} still in the bag.`)}" tabindex="0">${color.icon} <strong>${counts[color.id]}</strong><small>${color.name} · / ${color.count}</small></div>`).join("");
      byId("Reveal").innerHTML = view.stage === "reveal" ? `<span>13 revealed. One last crunch.</span><button type="button" data-boc-do="reveal_last" data-boc-explain="reveal" ${can("reveal_last") ? "" : "disabled"}>${me()?.ready ? "Waiting for table…" : "Reveal last chip"}</button>` : "";
      const player = me();
      const showHand = player && ["discard", "place", "reveal"].includes(view.stage);
      byId("HandSection").classList.toggle("hidden", !showHand);
      byId("Hand").innerHTML = showHand ? player.hand.map((card) => cardHTML(card, player)).join("") : "";
      byId("Task").textContent = player?.submitted ? "Locked in · waiting for the table" : view.stage === "place" ? "Choose 1 negative · keep 2 positive" : view.stage === "reveal" ? "Your assignments are revealed" : `Discard ${view.phase === 1 ? 2 : 1}`;
      byId("Players").innerHTML = view.players.map((entry, index) => {
        const marker = ["◆", "●", "▲", "■", "✦", "⬟"][index];
        const status = ["discard", "place"].includes(view.stage) ? entry.submitted ? "✓ Locked in" : "Choosing…" : entry.ready ? "✓ Reviewed" : view.stage === "game_over" ? "Finished" : "Reviewing…";
        const bets = entry.negative && !["discard", "place"].includes(view.stage) ? `<div class="boc-public-bets" data-boc-tip="${escape(`Negative: ${cardText(entry.negative).detail} Positive: ${entry.positive.map((card) => cardText(card).detail).join(" ")}`)}" tabindex="0">− ${escape(cardText(entry.negative).formula)}<br>+ ${entry.positive.map((card) => escape(cardText(card).formula)).join(" · ")}</div>` : "";
        return `<div class="boc-player ${entry.player_id === view.you ? "is-you" : ""}"><span class="boc-name">${marker} ${escape(entry.name)}${entry.player_id === view.you ? " · You" : ""}</span><small>${status}</small><div class="boc-player-score" data-boc-explain="rewards" data-boc-tip="${escape(`${entry.name}: ${entry.rewards} rewards (🏅). ${entry.hand_count} objectives held, ${entry.discard_count} discarded.`)}" tabindex="0">🏅 ${entry.rewards} / ${view.target}</div>${bets}</div>`;
      }).join("");
      const waiting = view.players.filter((entry) => ["discard", "place"].includes(view.stage) ? !entry.submitted : !entry.ready);
      byId("Waiting").textContent = view.stage === "game_over" ? "Game complete" : `${waiting.length} ${["discard", "place"].includes(view.stage) ? "choosing" : "to review"}`;
      renderResults();
      const journalOpen = panel.querySelector(".boc-journal").open;
      byId("History").innerHTML = view.history.length ? view.history.map((round) => `<p><strong>Round ${round.round}</strong> · ${round.rows.map((row) => `${escape(row.name)}: ${row.lost ? "lost" : row.score} (+${row.awarded} 🏅)`).join(" · ")}</p>`).join("") : "<p>No completed rounds yet.</p>";
      panel.querySelector(".boc-journal").open = journalOpen;
      renderSelection();
    }

    function renderResults() {
      const results = byId("Results");
      results.classList.toggle("hidden", !view.summary);
      if (!view.summary) { results.innerHTML = ""; return; }
      view.summary.rows.forEach((row) => row.cards.forEach((item) => {
        explanations[`result${item.card.id}`] = `${row.name}. ${cardText(item.card).detail} ${item.negative ? "Negative objective." : "Positive objective."} ${item.skipped ? "Not scored because the special negative objective lost this round." : item.success ? item.card.special ? item.negative ? "Completed: loses the round." : "Completed: wins the game." : `Completed: ${item.points} points.` : "Not completed: zero points."}`;
      }));
      const winners = view.players.filter((player) => view.winners.includes(player.player_id)).map((player) => player.name).join(", ");
      const rows = view.summary.rows.map((row) => `<div class="boc-result-row ${row.player_id === view.you ? "is-you" : ""}"><div class="boc-result-heading"><strong>${escape(row.name)}${row.player_id === view.you ? " · You" : ""}</strong><span data-boc-tip="${escape(`${row.awarded} rewards (🏅) earned this round. Total: ${row.rewards}.`)}" tabindex="0">${row.lost ? "Lost round" : `${row.score} pts`} · +${row.awarded} 🏅</span></div><div class="boc-result-cards">${row.cards.map((item) => `<div class="boc-result-card ${item.success && !item.skipped ? "" : "is-miss"}" data-boc-explain="result${item.card.id}" data-boc-tip="${escape(explanations[`result${item.card.id}`])}" tabindex="0"><span>${item.negative ? "−" : "+"} ${escape(cardText(item.card).formula)} · ${escape(cardText(item.card).text)}</span><strong>${item.skipped ? "0 · skipped" : item.success ? item.card.special ? item.negative ? "LOSE" : "WIN" : `${item.points > 0 ? "+" : ""}${item.points}` : "0 · unmet"}</strong></div>`).join("")}</div></div>`).join("");
      const action = view.stage === "round_over" ? "next_round" : view.stage === "final_review" ? "confirm_end" : "play_again";
      const key = action === "next_round" ? "next" : action === "confirm_end" ? "end" : "again";
      const label = action === "next_round" ? "Next Round" : action === "confirm_end" ? "Confirm final scores" : "Play Again";
      results.innerHTML = `<h3>${winners ? `${escape(winners)} wins${view.summary.instant ? " · special objective!" : "!"}` : `Round ${view.round} · the crunch count`}</h3><p>${winners ? "Final scores · review every objective below." : "Two positives − one negative = your round score."}</p>${rows}<button type="button" data-boc-do="${action}" data-boc-explain="${key}" ${can(action) ? "" : "disabled"}>${me()?.ready && action !== "play_again" ? "Waiting for table…" : label}</button>`;
    }

    function renderState(data) {
      if (data?.game_type !== GAME_ID || !data.view) return;
      if (typeof currentRoomState !== "undefined" && currentRoomState?.room_id && data.room_id !== currentRoomState.room_id) return;
      const nextSignature = JSON.stringify([data.room_id, data.view.round, data.view.step, data.view.you]);
      if (signature !== nextSignature || data.view.players.find((player) => player.player_id === data.view.you)?.submitted) selected = [];
      signature = nextSignature;
      activeRoom = data.room_id;
      view = data.view;
      inFlight = false;
      clearTimeout(requestTimer);
      hideTooltip();
      render();
    }

    function syncRoom(room) {
      if (room?.game_type !== GAME_ID || room.status === "lobby" || activeRoom !== room.room_id) {
        view = null;
        selected = [];
        signature = "";
        inFlight = false;
        clearTimeout(requestTimer);
        hideTooltip();
        explain.exit();
        help.close();
        byId("Lobby").classList.remove("hidden");
        byId("Table").classList.add("hidden");
      }
      activeRoom = room?.game_type === GAME_ID ? room.room_id : null;
    }

    panel.addEventListener("pointerdown", (event) => { press = { x: event.clientX, y: event.clientY }; suppressClick = false; });
    panel.addEventListener("pointermove", (event) => { if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) suppressClick = true; });
    panel.addEventListener("pointercancel", () => { suppressClick = true; press = null; });
    panel.addEventListener("click", (event) => {
      if (suppressClick) { suppressClick = false; return; }
      if (event.target.closest("#bagOfChipsCommitBtn")) { send(view.stage, selected.slice()); return; }
      if (event.target.closest("#bagOfChipsCancelBtn")) { selected = []; renderSelection(); return; }
      const action = event.target.closest("[data-boc-do]");
      if (action) { send(action.dataset.bocDo); return; }
      const card = event.target.closest("[data-boc-card]");
      if (card) {
        if (!can(view.stage)) return;
        const cardId = Number(card.dataset.bocCard);
        if (selected.includes(cardId)) selected = selected.filter((entry) => entry !== cardId);
        else if (view.stage === "place" || view.phase === 2) selected = [cardId];
        else if (selected.length < 2) selected.push(cardId);
        renderSelection();
        return;
      }
      const tip = event.target.closest("[data-boc-tip]");
      if (tip && !tip.closest("button")) { showTooltip(tip); return; }
      if (!event.target.closest("button, summary, details, .boc-confirm")) { selected = []; renderSelection(); }
    });
    panel.addEventListener("pointerover", (event) => {
      const node = event.target.closest("[data-boc-tip]");
      if (event.pointerType === "mouse" && node && !node.closest("button")) showTooltip(node);
    });
    panel.addEventListener("pointerout", (event) => { if (event.target.closest("[data-boc-tip]")) hideTooltip(); });
    panel.addEventListener("focusin", (event) => { if (event.target.matches("[data-boc-tip]")) showTooltip(event.target); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") { selected = []; hideTooltip(); renderSelection(); } });
    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);
    byId("HelpBtn").addEventListener("click", () => help.open());
    byId("ExplainBtn").addEventListener("click", () => explain.toggle());
    window.showBagOfChipsHeaderActions = (visible) => {
      byId("HeaderActions").style.display = visible ? "flex" : "none";
      if (!visible) { explain.exit(); help.close(); hideTooltip(); }
    };
    window.renderBagOfChipsGameState = renderState;
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { if (inFlight) { clearTimeout(requestTimer); inFlight = false; render(); } });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && typeof currentRoomState !== "undefined"
        && lastGameStatePayload?.room_id === currentRoomState?.room_id && currentRoomState?.status !== "lobby") renderState(lastGameStatePayload);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
