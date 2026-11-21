(() => {
  "use strict";
  const panel = document.getElementById("coyotePanel");
  const header = document.getElementById("coyoteHeaderActions");
  const byId = suffix => document.getElementById(`coyote${suffix}`);
  const text = (suffix, value) => { byId(suffix).textContent = value; };
  let view = null;
  let pending = false;
  let pendingTimer = null;
  let signature = null;
  let tipTimer = null;
  let touchStart = null;

  const COYOTE_HELP_CONFIG = {
    gameId: "coyote",
    title: { zh: "郊狼 · Coyote", en: "Coyote" },
    basic: {
      win: { zh: "每轮输家获得一次惩罚，达到上限即淘汰，最后留在场上的玩家获胜。", en: "The loser of each round takes a penalty, reaching the limit eliminates a player, and the last survivor wins." },
      turn: { zh: "轮到你时，报一个更大的数字，或者质疑上一个报价超过所有牌的真实总和。", en: "On your turn, raise the bid or challenge that the previous bid exceeds the true total of all cards." },
      key: { zh: "你能看到所有对手的牌，唯独看不到自己的牌，需要结合牌堆组成、特殊牌和对手报价判断总和。", en: "You can see every opponent's card but not your own, so use the deck composition, special effects and other bids to judge the total." }
    },
    sections: [
      { id: "cards", label: { zh: "牌与信息", en: "Cards & information" }, html: {
        zh: "<p>每位未淘汰玩家获得一张朝外的牌。你只能看到别人的牌，自己的牌始终隐藏。观察者可以看到整张牌桌。</p><p>牌堆共 36 张，每轮重新洗牌。0 到 5 各四张，10 三张，15 两张，20 一张，-5 两张，-10 一张，另有 Max→0、?、×2 各一张。牌堆中未发出的牌不计入总和，问号抽牌除外。</p><p>玩家牌标注已受惩罚次数和上限。You 表示你自己，Bot(🤖)表示电脑玩家，Turn 表示当前行动者，Out 表示已淘汰。</p>",
        en: "<p>Each survivor gets one outward-facing card. You see the others' cards, never your own. Spectators can see the whole table.</p><p>The 36-card deck is reshuffled each round. There are four each of 0 through 5, three 10s, two 15s, one 20, two -5s, one -10, and one each of Max→0, ? and ×2. Undealt cards do not count, except a mystery draw.</p><p>Player cards show penalties taken and their limit. You marks your seat, Bot(🤖) marks a computer player, Turn marks the current player and Out means eliminated.</p>"
      } },
      { id: "specials", label: { zh: "特殊牌", en: "Special cards" }, html: {
        zh: "<p>先把所有数字牌相加，再处理已发出的 Max→0：消去一个最大的正数，没有正数则无效果。</p><p>然后处理问号(?)，从剩余牌堆翻一张牌。数字加入总和，翻到 Max→0 则消去当前最大的正数，翻到 ×2 则留到最后翻倍。已经处理的 Max→0 不会回头消去问号后来抽出的数字。</p><p>最后，每张翻倍牌(×2)把结果乘二。特殊牌与普通牌一样，别人头上的都可见，只有自己头上的未知。</p><p>例如 20、Max→0、5 的总和是 5。若为 10、Max→0、? 且问号抽出 20，先消去 10，再加上 20，最终总和是 20。</p>",
        en: "<p>Add the number cards, then resolve dealt Max→0 cards by removing the largest positive number. Nothing is removed if no positive number remains.</p><p>Next, Mystery(?) draws a card from the remaining deck. Add a number, remove the current largest positive number for a drawn Max→0, or save a drawn ×2 for the final step. An already resolved Max→0 does not remove a later mystery number.</p><p>Finally, each Double(×2) multiplies the result by two. Special cards on opponents are visible just like numbers. Only your own card is unknown.</p><p>For example, 20, Max→0 and 5 total 5. With 10, Max→0 and ?, if Mystery draws 20, first remove 10 and then add 20 for a total of 20.</p>"
      } },
      { id: "showdown", label: { zh: "报价与结算", en: "Bidding & reveal" }, html: {
        zh: "<p>首位玩家必须报正整数。之后的报价必须严格大于上一个报价。用加减按钮或数字框调整，再按 Raise bid 提交。</p><p>Challenge! 会立即揭牌。当真实总和小于报价时，报价者受罚，否则由质疑者受罚。总和等于报价时，报价仍然成立。</p><p>结算区突出你的牌并列出问号抽牌、归零数值和倍数。所有玩家，包括已淘汰玩家，都点击 Next Round 后才会发下一轮牌。电脑玩家自动确认，观察者不需要确认。</p><p>下一轮由输家先行动，若其被淘汰，则由其后第一位存活玩家开始。最后一位存活者是赢家(🏆)。玩家可在结束后用 Play Again 开始新局。</p>",
        en: "<p>The opener must bid a positive integer. Each later bid must be strictly higher. Adjust the stepper or number field and press Raise bid.</p><p>Challenge! reveals the table. If the true total is below the bid, the bidder takes a penalty. Otherwise the challenger takes one, including when total and bid are equal.</p><p>The result highlights your own card and lists mystery draws, removed values and multipliers. Everyone, including eliminated players, must press Next Round before the next deal. Bots confirm automatically and spectators do not confirm.</p><p>The loser opens the next round, or the next survivor in seat order if that loser was eliminated. The final survivor is the winner(🏆). Players can use Play Again after the game ends.</p>"
      } }
    ]
  };
  const COYOTE_EXPLAIN = {
    round: { zh: "当前轮次。每轮质疑后暂停，所有玩家确认后重新洗牌。", en: "The current round. A challenge pauses play until everyone confirms a freshly shuffled deal." },
    phase: { zh: "Bidding 为报价阶段，Reveal 为结算暂停，Finished 为整局结束。", en: "Bidding is live play, Reveal is the review pause, and Finished is game over." },
    players: { zh: "显示存活人数。只能看到其他人的牌，自己的牌在质疑后揭开。惩罚达到上限即淘汰。", en: "Shows survivors. You see opponents' cards but your own is revealed only after a challenge. Reaching the penalty limit eliminates a player." },
    last_bid: { zh: "红色数字是当前报价，下面是报价者。质疑时若真实总和小于报价，报价者受罚，否则质疑者受罚。", en: "The red number is the current bid and the name below is its bidder. A total below the bid penalizes the bidder, otherwise it penalizes the challenger." },
    bid_minus: { zh: "报价减一，最低为当前报价加一，没有报价时最低为一。", en: "Decrease your bid by one, down to the current bid plus one or an opening bid of one." },
    bid_plus: { zh: "报价加一，不会自动提交。", en: "Increase your bid by one without submitting it." },
    bid_input: { zh: "输入正整数，必须严格高于当前报价，点击 Raise bid 才提交。", en: "Enter a positive whole number strictly above the current bid, then press Raise bid to submit." },
    bid: { zh: "提交新的报价并轮到下一位玩家。所有未淘汰玩家的牌都计入总和，包括你自己未知的牌。", en: "Submit your bid and pass the turn. Every survivor's card counts toward the total, including your unknown card." },
    challenge: { zh: "质疑上一个报价。揭牌后总和小于报价则报价者受罚，否则你受罚。等于报价时质疑失败。", en: "Challenge the previous bid. If the revealed total is lower, the bidder takes a penalty. Otherwise you do, including on equality." },
    next_round: { zh: "确认已看过结算。所有玩家确认后才发新牌，不需要再次确认。", en: "Confirm you have reviewed the reveal. A new deal waits for every player. No extra confirmation is needed." },
    reset: { zh: "玩家可在整局结束后，用同一批玩家开始新局。", en: "Players can start a fresh game with the same players after game over." }
  };
  let coyoteHelpWidget = null;
  let coyoteExplainWidget = null;
  function initCoyoteHelpExplain() {
    if (coyoteHelpWidget || typeof window.obgCreateHelp !== "function" || typeof window.obgCreateExplain !== "function") return;
    coyoteHelpWidget = window.obgCreateHelp(COYOTE_HELP_CONFIG);
    coyoteExplainWidget = window.obgCreateExplain({
      gameId: "coyote", attribute: "data-coyote-explain", explanations: COYOTE_EXPLAIN,
      button: byId("ExplainBtn"), root: () => panel,
      bypass: ["#coyoteHelpBtn", "#coyoteExplainBtn"]
    });
  }
  initCoyoteHelpExplain();

  function name(playerId) { return view?.players.find(player => player.player_id === playerId)?.name || playerId || "—"; }
  function minimumBid() { return view?.last_bid == null ? 1 : view.last_bid + 1; }
  function can(kind) { return Boolean(!pending && socket.connected && view?.legal_actions.includes(kind)); }
  function element(tag, className, content) {
    const node = document.createElement(tag);
    node.className = className;
    if (content != null) node.textContent = content;
    return node;
  }
  function tip(node, description, key) {
    node.dataset.coyoteTip = description;
    node.tabIndex = 0;
    if (key) node.dataset.coyoteExplain = key;
    return node;
  }
  function cardDescription(label) {
    if (label === "Max->0") return "Max→0: remove the largest positive number before mystery draws.";
    if (label === "?") return "Mystery (?): draw one more card from the undealt deck during the reveal.";
    if (label === "x2") return "Double (×2): double the final total after all other effects.";
    return `Number ${label}: ${Number(label) < 0 ? "subtracts from" : "adds to"} the table total.`;
  }
  function displayCard(label) { return label === "Max->0" ? "Max→0" : label === "x2" ? "×2" : label; }
  function hideTip() {
    clearTimeout(tipTimer);
    byId("Tooltip").hidePopover?.();
    byId("Tooltip").classList.add("hidden");
  }
  function showTip(target, autoHide = false) {
    if (!target || target.closest("button, input, summary") || coyoteExplainWidget?.isActive() || coyoteHelpWidget?.isOpen()) return;
    hideTip();
    const tooltip = byId("Tooltip");
    tooltip.textContent = target.dataset.coyoteTip;
    tooltip.classList.remove("hidden");
    tooltip.showPopover?.();
    const rect = target.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - bounds.width - 12))}px`;
    tooltip.style.top = `${rect.bottom + bounds.height + 12 < innerHeight ? rect.bottom + 6 : Math.max(12, rect.top - bounds.height - 6)}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function renderControls() {
    byId("BidBtn").disabled = !can("bid") || !Number.isSafeInteger(byId("BidInput").valueAsNumber) || byId("BidInput").valueAsNumber < minimumBid();
    byId("ChallengeBtn").disabled = !can("challenge");
    byId("NextBtn").disabled = !can("next_round");
    byId("BidInput").disabled = !can("bid");
    byId("BidMinusBtn").disabled = !can("bid") || byId("BidInput").valueAsNumber <= minimumBid();
    byId("BidPlusBtn").disabled = !can("bid");
    text("NextBtn", view?.round_ready?.includes(view.you) ? "Ready ✓" : "Next Round");
    const seated = view?.players.some(player => player.player_id === view.you);
    byId("ResetBtn").classList.toggle("hidden", !view?.game_over || !seated);
    const yourTurn = view?.phase === "bidding" && view.current_turn === view.you;
    document.getElementById("roomControlsPanel")?.classList.toggle("coyote-turn", Boolean(yourTurn && socket.connected));
    if (!view) return;
    text("Decision", !socket.connected ? "Disconnected. Use Reconnect to rejoin." : pending ? "Sending your move…"
      : view.phase === "round_end" ? "Review the reveal, then continue together."
      : view.game_over ? "The final cards are revealed."
      : yourTurn ? view.last_bid == null ? "Open with a bid of 1 or more." : `Raise to ${minimumBid()} or challenge the bid.`
      : `Waiting for ${name(view.current_turn)}.`);
  }
  function dispatch(kind) {
    if (!can(kind)) return;
    const action = { type: kind };
    if (kind === "bid") {
      action.bid = byId("BidInput").valueAsNumber;
      if (!Number.isSafeInteger(action.bid) || action.bid < minimumBid()) return;
    }
    pending = true;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; renderControls(); }, 2500);
    renderControls();
    sendAction(action);
  }
  function renderPlayers() {
    byId("Players").replaceChildren();
    const count = view.players.length;
    byId("Players").style.setProperty("--coyote-columns", String(count <= 3 ? count : Math.ceil(count / 2)));
    for (const player of view.players) {
      const own = player.player_id === view.you;
      const card = element("article", `coyote-player${own ? " is-you" : ""}${player.eliminated ? " is-out" : ""}${player.player_id === view.current_turn ? " is-current" : ""}`);
      const playerName = tip(element("div", "coyote-player-name", player.name), player.name);
      const tags = [own ? "You" : "", player.is_bot ? "Bot 🤖" : "", player.eliminated ? "Out" : player.player_id === view.current_turn ? "Turn" : ""].filter(Boolean).join(" · ");
      const playerTag = tip(element("div", "coyote-player-tag", tags || "In play"), player.eliminated ? "Out: this player's card will not count in future rounds." : `${own ? "You cannot see your own card. " : ""}${player.is_bot ? "Bot (🤖): a probability-based computer opponent. " : ""}Turn marks the current player.`);
      const label = player.card_hidden ? "•••" : displayCard(player.card) || "—";
      const face = element("div", `coyote-card-face${player.card_hidden ? " is-hidden" : ""}${["?", "x2", "Max->0"].includes(player.card) ? " is-special" : ""}${Number(player.card) < 0 ? " is-negative" : ""}`, label);
      const description = player.card_hidden ? "Your hidden card: only the other players can see it until a challenge."
        : player.card == null ? "Eliminated players are not dealt a card." : cardDescription(player.card);
      const explainKey = `card_${player.player_id}`;
      COYOTE_EXPLAIN[explainKey] = { zh: description, en: description };
      tip(face, description, explainKey);
      const penalties = tip(element("div", "coyote-penalties"), `Penalties: ${player.penalties} of ${view.config.max_penalties}. Reaching the limit eliminates this player.`);
      penalties.append(element("span", "", "Penalties"), element("strong", "", `${player.penalties} / ${view.config.max_penalties}`));
      card.append(playerName, playerTag, face, penalties);
      byId("Players").append(card);
    }
    coyoteExplainWidget?.refresh();
  }
  function summaryText(summary) {
    let result = `${name(summary.challenger)} challenged ${name(summary.bidder)}. Bid ${summary.bid}, total ${summary.actual_total}. ${name(summary.loser)} takes a penalty.`;
    if (summary.mystery_draws?.length) result += ` Mystery (?) drew ${summary.mystery_draws.map(displayCard).join(", ")}.`;
    if (summary.max_zero_applied?.length) result += ` Max→0 removed ${summary.max_zero_applied.join(", ")}.`;
    if (summary.x2_count) result += ` Final multiplier ×${2 ** summary.x2_count}.`;
    return result;
  }
  function renderResult() {
    const summary = view.last_round_summary;
    const reveal = Boolean(summary && (view.phase === "round_end" || view.game_over));
    panel.classList.toggle("is-revealed", reveal);
    byId("Result").classList.toggle("hidden", !reveal);
    byId("Review").classList.toggle("hidden", view.phase !== "round_end");
    byId("History").classList.toggle("hidden", !summary || reveal);
    if (!summary) return;
    const description = summaryText(summary);
    text("HistoryCaption", `Bid ${summary.bid} · Total ${summary.actual_total}`);
    const ownCard = summary.cards.find(entry => entry.player_id === view.you)?.card;
    text("HistoryBody", `${description}${ownCard != null ? ` Your card was ${displayCard(ownCard)}.` : ""} Cards: ${summary.cards.map(entry => `${name(entry.player_id)} ${displayCard(entry.card)}`).join(" · ")}.`);
    text("ResultTitle", view.game_over ? `🏆 ${name(view.winner)} wins!` : summary.success ? "Challenge succeeds" : "The bid holds");
    text("ResultTotal", `Bid ${summary.bid} / Total ${summary.actual_total}`);
    text("ResultBody", description);
    byId("Result").classList.toggle("is-loss", summary.loser === view.you);
    byId("Revealed").replaceChildren();
    for (const entry of summary.cards) {
      const own = entry.player_id === view.you;
      byId("Revealed").append(tip(element("span", `coyote-reveal-chip${own ? " is-you" : ""}`, `${own ? "You" : name(entry.player_id)}: ${displayCard(entry.card)}`), cardDescription(entry.card)));
    }
    text("Ready", `${view.round_ready?.length || 0} / ${view.players.length} ready`);
  }
  function render(data) {
    if (data?.view?.game_id !== "coyote" || currentGameType !== "coyote") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const next = data.view;
    const nextSignature = JSON.stringify([data.room_id, next.round, next.phase, next.last_bid, next.round_ready, next.you]);
    const resetInput = !view || view.round !== next.round || view.last_bid !== next.last_bid;
    if (signature !== nextSignature) { pending = false; clearTimeout(pendingTimer); hideTip(); }
    signature = nextSignature;
    view = next;
    const minimum = minimumBid();
    byId("BidInput").min = String(minimum);
    if (resetInput) byId("BidInput").value = String(minimum);
    text("Round", `Round ${view.round}`);
    text("Phase", view.game_over ? "Finished" : view.phase === "round_end" ? "Reveal" : "Bidding");
    text("Bid", view.last_bid ?? "—");
    text("Bidder", view.last_bidder ? name(view.last_bidder) : "No bid yet");
    const bidDescription = view.last_bid == null ? "No bid yet. The first player must bid a positive integer." : `Current bid: ${view.last_bid}, by ${name(view.last_bidder)}. A challenge succeeds only if the total is lower.`;
    tip(byId("Bid").parentElement, bidDescription, "last_bid");
    text("Survivors", `${view.players.filter(player => !player.eliminated).length} / ${view.players.length} in play`);
    tip(byId("Survivors"), "Survivors: players below the penalty limit. Only their cards count in a live round.", "players");
    tip(byId("Phase"), view.phase === "round_end" ? "Reveal: all players review the result and confirm Next Round." : "Bidding: raise the bid or challenge when it is your turn.", "phase");
    text("Status", view.game_over ? "Game complete" : view.phase === "round_end" ? "Round complete · cards revealed"
      : view.current_turn === view.you ? "Your turn" : `${name(view.current_turn)}'s turn`);
    renderPlayers(); renderResult(); renderControls();
    logGameEvents(data);
  }
  function clearState() {
    view = null; signature = null; pending = false;
    panel.classList.remove("is-revealed");
    clearTimeout(pendingTimer); hideTip(); coyoteExplainWidget?.exit(); coyoteHelpWidget?.close();
    text("Status", "Waiting for the deal"); text("Round", "Round —"); text("Bid", "—"); text("Bidder", "No bid yet"); text("Phase", ""); text("Survivors", "");
    byId("Players").replaceChildren();
    for (const suffix of ["Result", "Review", "History", "ResetBtn"]) byId(suffix).classList.add("hidden");
    byId("History").open = false;
    renderControls();
  }

  byId("HelpBtn").addEventListener("click", () => { hideTip(); initCoyoteHelpExplain(); coyoteExplainWidget?.exit(); coyoteHelpWidget?.open(); });
  byId("ExplainBtn").addEventListener("click", () => { hideTip(); initCoyoteHelpExplain(); coyoteExplainWidget?.toggle(); });
  for (const [suffix, kind] of [["BidBtn", "bid"], ["ChallengeBtn", "challenge"], ["NextBtn", "next_round"]]) byId(suffix).addEventListener("click", () => dispatch(kind));
  for (const [suffix, delta] of [["BidMinusBtn", -1], ["BidPlusBtn", 1]]) byId(suffix).addEventListener("click", () => {
    if (!can("bid")) return;
    byId("BidInput").value = String(Math.max(minimumBid(), (byId("BidInput").valueAsNumber || minimumBid()) + delta));
    renderControls();
  });
  byId("BidInput").addEventListener("input", renderControls);
  byId("ResetBtn").addEventListener("click", () => { if (view?.game_over) emitRoomStart(); });
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-coyote-tip]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-coyote-tip]")));
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("pointerdown", event => { touchStart = { x: event.clientX, y: event.clientY }; });
  panel.addEventListener("click", event => {
    if (touchStart && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 10) return;
    const target = event.target.closest("[data-coyote-tip]");
    if (target) showTip(target, true); else hideTip();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") hideTip(); }, true);
  document.addEventListener("scroll", hideTip, true);
  window.addEventListener("resize", hideTip);
  window.addEventListener("blur", hideTip);
  window.renderCoyoteGameState = render;
  window.clearCoyoteState = clearState;
  window.showCoyoteHeaderActions = visible => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };
  function sync() {
    initCoyoteHelpExplain();
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); renderControls(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); hideTip(); renderControls(); });
    socket.on("connect", renderControls);
    socket.on("room:state", state => { if (state.game_type !== "coyote" || state.status === "lobby") clearState(); else renderControls(); });
    if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "coyote" && currentRoomState.status === "lobby") clearState();
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "coyote") render(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, { once: true });
  else sync();
})();
