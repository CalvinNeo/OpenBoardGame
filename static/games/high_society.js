(() => {
  const root = document.getElementById("highSocietyPanel");
  const byId = (suffix) => document.getElementById(`highSociety${suffix}`);
  const text = (suffix, value) => { byId(suffix).textContent = value; };
  let view = null;
  let selectedMoney = [];
  let selectedLuxury = null;
  let explaining = false;
  let pending = false;
  let pendingTimer = null;
  let tooltipTimer = null;
  let gesture = null;
  let suppressClickUntil = 0;
  let focusBeforeModal = null;
  let roomId = null;
  let selectedRoom = false;

  const money = (value) => `$${Number(value || 0).toLocaleString("en-US")}`;
  const sum = (values) => values.reduce((total, value) => total + Number(value), 0);
  const self = () => view?.players?.find((player) => player.player_id === view.you);
  const active = () => currentGameType === "high_society" && !root.classList.contains("hidden");
  const connected = () => typeof socket === "undefined" || socket.connected;
  const can = (action) => active() && !pending && connected() && !!view?.legal_actions?.includes(action);
  const name = (playerId) => view?.players?.find((player) => player.player_id === playerId)?.name || playerId || "—";
  const cardName = (card) => card?.type === "luxury" ? `Luxury ${card.value}` : card?.type === "prestige" ? "Prestige" : ({ faux_pas: "Faux Pas", passe: "Passé", scandale: "Scandale" }[card?.id] || "—");
  const explanations = {
    BidBtn: "Bid with selected Money (💰). Add these cards to your committed table money; the new total must exceed the high bid. Money already on the table cannot be exchanged or withdrawn while bidding.",
    PassBtn: "In a normal auction, Pass returns your table money and removes you from this auction. In a Disgrace (⚠️) auction, Pass immediately takes the bad card and returns your money; everyone else pays their table money.",
    NextBtn: "Confirm you have reviewed the result. The next auction begins only after every player is ready. No additional confirmation is needed.",
    DiscardBtn: "Permanently discard the selected Luxury (💎) to satisfy Faux Pas (⚠️). Prestige and other Disgrace cards cannot be discarded.",
    CancelBtn: "Cancel this discard selection without changing your collection.",
  };
  const help = `
    <h3>Win with status, not an empty wallet</h3>
    <p>Collect Luxury (💎) and Prestige (👑) while avoiding Disgrace (⚠️). At the end, everyone tied for the least remaining Money (💰) is cast out before scoring.</p>
    <h3>💰 Money &amp; bidding</h3>
    <p>Choose money cards, then Bid. Your new table total must exceed the high bid. Add cards to raise; never exchange cards already committed. There is no change, and spent cards are gone for the game. Click unused space to deselect. Only your own remaining cash is visible during play.</p>
    <h3>💎 Normal auction</h3>
    <p>Raise or Pass. Passing returns your table money and removes you from this auction. The last remaining player gains the card and pays their table money, possibly zero.</p>
    <h3>⚠️ Disgrace auction</h3>
    <p>Bid to avoid the card. The first player to Pass takes it and gets their table money back. Everyone else pays their table money.</p>
    <p><strong>Faux Pas:</strong> discard one Luxury, or lose your next Luxury if you have none. Choose a card and confirm Discard; Cancel changes your selection. <strong>Passé (−5):</strong> subtract five status. <strong>Scandale (÷2):</strong> halve your score.</p>
    <h3>👑 Prestige &amp; ⏳ Timer</h3>
    <p>Each Prestige doubles status. The three Prestige cards and Scandale are timer cards. Revealing the fourth ends the game immediately; that fourth card is not auctioned.</p>
    <h3>Review &amp; scoring</h3>
    <p>Every auction pauses for review. All players choose Next Round before play continues. After casting out the poorest players, add Luxury values, subtract Passé, double for each Prestige, then halve for Scandale. Highest score wins; ties use remaining cash, then highest single Luxury.</p>
    <h3>Reading the table</h3>
    <p>💰 is a public table bid, Cards is the count of unspent money cards in hand, and Status is the collection's current score before the final cash check. Turn, Leading, Passed, Ready and Cast out badges show each player's state. Hover or tap non-interactive symbols for a short tip. Explain lets you inspect controls, including disabled ones, without taking an action. Esc closes a dialog or exits Explain.</p>`;

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function tip(node, content) {
    node.dataset.highSocietyTip = content;
    node.tabIndex = 0;
    return node;
  }

  function cardDescription(card) {
    if (card.type === "luxury") return `Luxury (💎): adds ${card.value} status before modifiers.`;
    if (card.type === "prestige") return "Prestige (👑): doubles your status. Also a Timer (⏳) card.";
    if (card.id === "passe") return "Passé (⚠️): subtract five status before Prestige and Scandale.";
    if (card.id === "scandale") return "Scandale (⚠️): halves your status. Also a Timer (⏳) card.";
    return "Faux Pas (⚠️): discard one Luxury, or lose your next Luxury if you have none.";
  }

  function statusCard(card, interactive = false) {
    const node = element("div", `high-society-card-face type-${card.type}`);
    const icon = card.type === "luxury" ? "💎" : card.type === "prestige" ? "👑" : "⚠️";
    const value = card.type === "luxury" ? `+${card.value}` : card.type === "prestige" ? "×2" : card.id === "passe" ? "−5" : card.id === "scandale" ? "÷2" : "−💎";
    const corner = element("div", "high-society-card-corner");
    corner.append(element("span", "", icon), element("span", "", card.is_end_marker ? "⏳" : ""));
    const detail = card.type === "luxury" ? "Status" : card.type === "prestige" ? "Double status" : card.id === "faux_pas" ? "Discard a Luxury" : card.id === "passe" ? "Lose status" : "Halve status";
    node.append(corner, element("div", "high-society-card-value", value), element("div", "high-society-card-title", cardName(card)), element("div", "high-society-card-detail", detail));
    node.setAttribute("aria-label", `${cardName(card)}. ${cardDescription(card)}`);
    if (!interactive) tip(node, cardDescription(card));
    return node;
  }

  function score(cards) {
    let total = sum(cards.filter((card) => card.type === "luxury").map((card) => card.value));
    if (cards.some((card) => card.id === "passe")) total -= 5;
    total *= 2 ** cards.filter((card) => card.type === "prestige").length;
    if (cards.some((card) => card.id === "scandale")) total /= 2;
    return total;
  }

  function updateControls() {
    const selected = sum(selectedMoney);
    const table = self()?.table_total || 0;
    const total = table + selected;
    const cash = sum(view?.your_hand_money || []);
    const auction = ["normal_auction", "disgrace_auction"].includes(view?.phase);
    const disgrace = view?.phase === "disgrace_auction";
    const validBid = can("bid") && selectedMoney.length > 0 && total > (view?.current_high_bid || 0);
    text("Cash", self() ? money(cash + table) : "Spectating");
    text("SelectedTotal", selected ? `${money(table)} + ${money(selected)} → ${money(total)}` : `On table ${money(table)} · Select money to add`);
    text("Remaining", selected ? `If paid: ${money(cash - selected)} left` : `Beat ${money(view?.current_high_bid || 0)} · No change`);
    text("BidBtn", selected ? `Bid ${money(total)}` : "Bid");
    byId("BidBtn").disabled = !validBid;
    byId("PassBtn").disabled = !can("pass");
    text("PassBtn", disgrace ? "Pass · take card" : "Pass");
    byId("PassBtn").classList.toggle("is-disgrace", disgrace);
    byId("BidControls").classList.toggle("hidden", !auction);
    byId("NextBtn").classList.toggle("hidden", view?.phase !== "round_summary");
    byId("NextBtn").disabled = !can("next_round");
    text("NextBtn", view?.next_ready?.includes(view.you) ? "Ready ✓" : "Next Round");
    byId("DiscardConfirm").classList.toggle("hidden", !selectedLuxury);
    byId("DiscardBtn").disabled = !can("choose_faux_pas_discard") || !selectedLuxury;
    byId("CancelBtn").disabled = pending;
    const luxury = self()?.status_cards?.find((card) => card.id === selectedLuxury);
    text("DiscardBtn", luxury ? `Discard Luxury ${luxury.value}` : "Discard");
    root.querySelectorAll(".high-society-money-card").forEach((button) => {
      const chosen = selectedMoney.includes(Number(button.dataset.value));
      button.classList.toggle("selected", chosen);
      button.setAttribute("aria-pressed", String(chosen));
      button.disabled = !can("bid");
    });
    root.querySelectorAll(".high-society-faux-choice").forEach((button) => {
      button.classList.toggle("selected", button.dataset.cardId === selectedLuxury);
      button.setAttribute("aria-pressed", String(button.dataset.cardId === selectedLuxury));
      button.disabled = !can("choose_faux_pas_discard");
    });
    let hint = "Waiting to start";
    if (view) {
      if (!connected()) hint = "Disconnected · use Reconnect to rejoin.";
      else if (pending) hint = "Sending action…";
      else if (view.game_over) hint = "Final cash revealed · the poorest are cast out.";
      else if (!self()) hint = "Spectating · other players' cash is hidden.";
      else if (view.phase === "round_summary") hint = view.next_ready?.includes(view.you) ? "You are ready · waiting for the others." : "Review the result, then choose Next Round.";
      else if (view.phase === "choose_faux_pas") hint = can("choose_faux_pas_discard") ? "Faux Pas · choose a Luxury, then confirm below." : `${name(view.current_turn)} is choosing a Luxury to discard.`;
      else if (can("bid")) hint = selected ? (validBid ? "Your bid is ready to submit." : `Add more money to beat ${money(view.current_high_bid)}.`) : disgrace ? "Your turn · bid to avoid this card, or Pass to take it." : "Your turn · select money to raise, or Pass.";
      else if (can("pass")) hint = "You cannot outbid · Pass to continue.";
      else if (!view.active_players?.includes(view.you)) hint = "You passed · waiting for the auction to settle.";
      else hint = `${name(view.current_turn)} is deciding…`;
    }
    text("ActionHint", hint);
    const needsAction = active() && connected() && !pending && !!view?.legal_actions?.length;
    byId("ActionHint").classList.toggle("is-active", needsAction);
    document.body.classList.toggle("high-society-needs-action", needsAction);
    root.querySelectorAll("[data-high-society-tip], [data-high-society-explain]").forEach((node) => node.classList.toggle("has-explanation", explaining));
  }

  function renderHand() {
    const hand = byId("Hand");
    hand.replaceChildren();
    (view?.your_hand_money || []).forEach((value) => {
      const button = element("button", "high-society-money-card", money(value));
      button.type = "button";
      button.dataset.value = value;
      button.dataset.highSocietyExplain = `Money (💰) ${money(value)}: select or deselect this card to add it to your bid. Your committed table cards cannot be exchanged.`;
      button.setAttribute("aria-label", `Select ${money(value)} money card`);
      button.addEventListener("click", () => {
        if (!can("bid")) return;
        selectedMoney = selectedMoney.includes(value) ? selectedMoney.filter((chosen) => chosen !== value) : [...selectedMoney, value];
        updateControls();
      });
      hand.append(button);
    });
    if (!hand.children.length) hand.append(element("div", "high-society-empty", view ? "No money cards in hand." : "Your money appears when the game starts."));
  }

  function renderPlayers() {
    byId("Players").replaceChildren();
    (view?.players || []).forEach((player) => {
      const card = element("article", "high-society-player-card");
      card.classList.toggle("self", player.player_id === view.you);
      card.classList.toggle("current", player.player_id === view.current_turn);
      card.classList.toggle("eliminated", !!player.eliminated);
      const heading = element("div", "high-society-player-heading");
      heading.append(element("div", "high-society-player-name", `${name(player.player_id)}${player.player_id === view.you ? " · You" : ""}`));
      const auction = ["normal_auction", "disgrace_auction"].includes(view.phase);
      let badge = player.player_id === view.current_turn ? "Turn" : auction && player.player_id === view.current_high_bidder ? "Leading" : "";
      if (view.phase === "normal_auction" && !view.active_players.includes(player.player_id)) badge = "Passed";
      if (view.phase === "round_summary") badge = view.next_ready.includes(player.player_id) ? "Ready ✓" : "Reviewing";
      if (view.game_over) badge = player.eliminated ? "Cast out" : view.winner.includes(player.player_id) ? "Winner" : "";
      if (badge) heading.append(tip(element("span", "high-society-player-badge", badge), `${name(player.player_id)}: ${badge}.`));
      const meta = element("div", "high-society-player-meta");
      meta.append(tip(element("span", "", `Cards ${player.hand_count}`), "Number of money cards still in hand. Denominations and total cash remain private until game end."));
      meta.append(tip(element("strong", "", `💰 ${money(player.table_total)}`), "Public bid: total money this player has committed to the current auction."));
      meta.append(tip(element("span", "", `Status ${view.game_over ? player.final_status_score : score(player.status_cards || [])}`), "Status after Luxury, Passé, Prestige and Scandale. The lowest remaining cash still eliminates you at game end."));
      const table = element("div", "high-society-table-money");
      (player.table_money || []).forEach((value) => table.append(tip(element("span", "high-society-money-chip", money(value)), "Committed money: cannot be exchanged while raising.")));
      const collection = element("div", "high-society-card-list");
      collection.tabIndex = 0;
      collection.setAttribute("role", "group");
      collection.setAttribute("aria-label", `${name(player.player_id)}: status collection, scroll for more cards`);
      (player.status_cards || []).forEach((status) => collection.append(statusCard(status)));
      if (!collection.children.length) collection.append(element("span", "high-society-empty", "No status cards yet"));
      card.append(heading, meta);
      if (table.children.length) card.append(table);
      if ((player.status_cards || []).length > 6) card.append(tip(element("span", "high-society-player-meta", `Collection · ${player.status_cards.length} cards ↕`), "Scroll within this collection to inspect additional status cards. Tap or hover a card for its effect."));
      card.append(collection);
      if (player.pending_faux_pas) card.append(tip(element("span", "high-society-player-meta", "⚠️ Next Luxury lost"), "Pending Faux Pas: this player's next Luxury will be discarded. Prestige is unaffected."));
      byId("Players").append(card);
    });
  }

  function renderNotice() {
    const reviewing = view?.phase === "round_summary";
    const summary = view?.last_round_summary;
    byId("Notice").classList.toggle("hidden", !reviewing && !view?.game_over);
    byId("Ready").replaceChildren();
    byId("FinalResults").replaceChildren();
    byId("Notice").classList.toggle("is-self", reviewing && (summary?.winner === view.you || summary?.taker === view.you));
    if (!view) return;
    if (view.game_over) {
      text("NoticeTitle", "Final standings");
      const endingCard = view.final_results?.unauctioned_card;
      const result = view.winner?.length ? `Winner: ${view.winner.map(name).join(", ")}.` : "No winner · all players were cast out.";
      text("NoticeBody", result + (endingCard ? ` Fourth timer: ${cardName(endingCard)} · not auctioned.` : ""));
      (view.players || []).forEach((player) => {
        const row = element("div", "high-society-result-row");
        row.classList.toggle("self", player.player_id === view.you);
        row.classList.toggle("eliminated", !!player.eliminated);
        row.append(element("span", "", `${name(player.player_id)}${player.player_id === view.you ? " · You" : ""}${player.eliminated ? " · Cast out" : ""}`), element("span", "", money(player.final_money_total)), element("strong", "", `Status ${player.final_status_score ?? "—"}`));
        byId("FinalResults").append(row);
      });
    } else if (reviewing && summary) {
      text("NoticeTitle", `Round ${view.round} · Auction settled`);
      let result = summary.result === "normal_win" ? `${name(summary.winner)} gained ${cardName(summary.card)} for ${money(summary.paid_total)}.` : `${name(summary.taker)} took ${cardName(summary.card)}; ${money(summary.returned_total)} returned. Others paid ${money(summary.discarded_total)}.`;
      if (summary.discarded_luxury) result += ` ${cardName(summary.discarded_luxury)} was discarded for Faux Pas.`;
      text("NoticeBody", result);
      view.players.forEach((player) => {
        const ready = view.next_ready.includes(player.player_id);
        byId("Ready").append(element("span", ready ? "is-ready" : "", `${ready ? "✓" : "…"} ${name(player.player_id)}${player.player_id === view.you ? " (You)" : ""}`));
      });
    }
  }

  function renderFauxPas() {
    const choosing = view?.phase === "choose_faux_pas" && view?.legal_actions.includes("choose_faux_pas_discard");
    byId("FauxPasBox").classList.toggle("hidden", !choosing);
    byId("FauxPasChoices").replaceChildren();
    if (!choosing) { selectedLuxury = null; return; }
    (self()?.status_cards || []).filter((card) => card.type === "luxury").forEach((card) => {
      const button = element("button", "high-society-faux-choice");
      button.type = "button";
      button.dataset.cardId = card.id;
      button.dataset.highSocietyExplain = `Choose ${cardName(card)} for Faux Pas (⚠️), then confirm Discard. This selection alone does not discard the card.`;
      button.setAttribute("aria-label", `Choose ${cardName(card)} to discard`);
      button.append(statusCard(card, true));
      button.addEventListener("click", () => {
        if (!can("choose_faux_pas_discard")) return;
        selectedLuxury = selectedLuxury === card.id ? null : card.id;
        updateControls();
      });
      byId("FauxPasChoices").append(button);
    });
  }

  function render() {
    const reviewing = view?.phase === "round_summary" || view?.game_over;
    const phases = { normal_auction: "Status auction", disgrace_auction: "Disgrace auction", choose_faux_pas: "Faux Pas", round_summary: "Review", game_over: "Finished" };
    text("Round", view?.round ?? "—");
    text("Phase", phases[view?.phase] || "Waiting to start");
    text("MoneyTitle", view?.phase === "choose_faux_pas" ? "⚠️ Faux Pas" : "💰 Your money");
    byId("Hand").classList.toggle("hidden", view?.phase === "choose_faux_pas");
    text("DeckCount", view?.status_deck_count ?? "—");
    const timer = view?.end_marker_revealed_count || 0;
    text("Timer", timer);
    byId("TimerTrack").classList.toggle("urgent", timer >= 3);
    byId("TimerDots").replaceChildren(...Array.from({ length: 4 }, (_, index) => element("span", index < timer ? "revealed" : "")));
    root.querySelector(".high-society-current").classList.toggle("hidden", !!reviewing);
    root.querySelector(".high-society-table").classList.toggle("is-review", !!reviewing);
    text("AuctionKind", view?.phase === "disgrace_auction" ? "Bid to avoid" : "");
    text("AuctionTitle", view?.phase === "choose_faux_pas" ? "Resolve Faux Pas" : "On the auction block");
    root.querySelector(".high-society-high-bid").classList.toggle("hidden", view?.phase === "choose_faux_pas");
    text("HighBid", money(view?.current_high_bid));
    text("HighBidder", view?.current_high_bidder ? name(view.current_high_bidder) : "No bids yet");
    text("Turn", view?.current_turn === view?.you && view ? "Your turn" : name(view?.current_turn));
    text("Start", name(view?.start_player));
    byId("CurrentCard").replaceChildren(view?.current_status ? statusCard(view.current_status) : element("div", "high-society-empty", "Waiting for the first auction"));
    renderNotice();
    renderHand();
    renderFauxPas();
    renderPlayers();
    updateControls();
  }

  function submit(action) {
    if (!can(action.type) || explaining) return;
    if (action.type === "bid" && byId("BidBtn").disabled) return;
    pending = true;
    hideTip();
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; updateControls(); }, 6000);
    updateControls();
    sendAction(action);
  }

  function hideTip() {
    clearTimeout(tooltipTimer);
    const tooltip = byId("Tooltip");
    if (tooltip.matches(":popover-open")) tooltip.hidePopover();
    tooltip.classList.add("hidden");
  }

  function showTip(target) {
    if (!target || explaining || target.closest("button") || !active()) return;
    hideTip();
    const tooltip = byId("Tooltip");
    tooltip.textContent = target.dataset.highSocietyTip;
    tooltip.classList.remove("hidden");
    if (tooltip.showPopover) tooltip.showPopover();
    const anchor = target.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - bounds.width - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(anchor.top > bounds.height + 18 ? anchor.top - bounds.height - 6 : anchor.bottom + 6, innerHeight - bounds.height - 12))}px`;
    tooltipTimer = setTimeout(hideTip, 3000);
  }

  function setExplain(value) {
    explaining = value;
    hideTip();
    byId("ExplainBtn").setAttribute("aria-pressed", String(value));
    updateControls();
  }

  function closeModal(modal) {
    if (modal.classList.contains("hidden")) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    if (focusBeforeModal?.isConnected && active()) focusBeforeModal.focus({ preventScroll: true });
  }

  function openModal(modal) {
    hideTip();
    focusBeforeModal = document.activeElement;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    modal.querySelector("button").focus({ preventScroll: true });
  }

  function explain(target) {
    const explanation = target?.dataset.highSocietyExplain || target?.dataset.highSocietyTip;
    if (!explanation) return;
    text("ExplainContent", explanation);
    setExplain(false);
    openModal(byId("ExplainModal"));
  }

  function clearSelection() {
    if (pending) return;
    selectedMoney = [];
    selectedLuxury = null;
    updateControls();
  }

  function reset() {
    view = null;
    pending = false;
    selectedMoney = [];
    selectedLuxury = null;
    gesture = null;
    clearTimeout(pendingTimer);
    setExplain(false);
    closeModal(byId("HelpModal"));
    closeModal(byId("ExplainModal"));
    render();
  }

  window.renderHighSocietyGameState = (data) => {
    if (!data?.view || currentGameType !== "high_society") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const incoming = data.view;
    if (!view || view.round !== incoming.round || view.phase !== incoming.phase || view.current_turn !== incoming.current_turn || view.you !== incoming.you) {
      selectedMoney = [];
      selectedLuxury = null;
    }
    view = incoming;
    pending = false;
    clearTimeout(pendingTimer);
    selectedMoney = selectedMoney.filter((value) => view.your_hand_money.includes(value));
    if (!self()?.status_cards.some((card) => card.id === selectedLuxury)) selectedLuxury = null;
    hideTip();
    render();
    logGameEvents(data);
  };

  window.showHighSocietyHeaderActions = (show) => {
    byId("HeaderActions").style.display = show ? "flex" : "none";
    if (!show) reset();
    else updateControls();
  };

  Object.entries(explanations).forEach(([suffix, content]) => { byId(suffix).dataset.highSocietyExplain = content; });
  byId("BidBtn").addEventListener("click", () => submit({ type: "bid", money_values: [...selectedMoney] }));
  byId("PassBtn").addEventListener("click", () => submit({ type: "pass" }));
  byId("NextBtn").addEventListener("click", () => submit({ type: "next_round" }));
  byId("DiscardBtn").addEventListener("click", () => { if (selectedLuxury) submit({ type: "choose_faux_pas_discard", card_id: selectedLuxury }); });
  byId("CancelBtn").addEventListener("click", clearSelection);
  byId("HelpBtn").setAttribute("aria-label", "Help");
  byId("ExplainBtn").setAttribute("aria-label", "Explain");
  byId("HelpBtn").addEventListener("click", () => {
    setExplain(false);
    root.ownerDocument.querySelector(".high-society-help-content").innerHTML = help;
    openModal(byId("HelpModal"));
  });
  byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
  ["Help", "Explain"].forEach((kind) => {
    byId(`${kind}CloseBtn`).addEventListener("click", () => closeModal(byId(`${kind}Modal`)));
    byId(`${kind}Modal`).addEventListener("click", (event) => { if (event.target === byId(`${kind}Modal`)) closeModal(byId(`${kind}Modal`)); });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!active()) return;
    suppressClickUntil = 0;
    gesture = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, down: true, target: event.target.closest("[data-high-society-explain], [data-high-society-tip]") };
    hideTip();
  }, true);
  document.addEventListener("pointermove", (event) => {
    if (gesture?.down && gesture.pointerId === event.pointerId && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 8) gesture.moved = true;
  }, { passive: true });
  document.addEventListener("pointercancel", () => {
    if (gesture) { gesture.moved = true; gesture.down = false; suppressClickUntil = Date.now() + 500; }
  }, { passive: true });
  document.addEventListener("pointerup", (event) => {
    if (!active() || !gesture || gesture.pointerId !== event.pointerId) return;
    gesture.down = false;
    if (gesture.moved) { suppressClickUntil = Date.now() + 500; return; }
    const target = event.target.closest("[data-high-society-explain], [data-high-society-tip]");
    if (explaining && target && target === gesture.target && root.contains(target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = Date.now() + 500;
      explain(target);
    }
  }, true);
  document.addEventListener("click", (event) => {
    if (!active()) return;
    if (Date.now() < suppressClickUntil && root.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!explaining || event.target.closest("#highSocietyHelpBtn, #highSocietyExplainBtn, #highSocietyHelpModal, #highSocietyExplainModal")) return;
    if (event.target.closest("button, summary, a, input, select, [data-high-society-tip]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      explain(event.target.closest("#highSocietyPanel [data-high-society-explain], #highSocietyPanel [data-high-society-tip]"));
    }
  }, true);
  root.addEventListener("click", (event) => {
    if (explaining) return;
    const target = event.target.closest("[data-high-society-tip]");
    if (target) showTip(target);
    else if (!event.target.closest("button, a, input, summary") && !event.target.closest(".high-society-player-card, #highSocietyNotice")) clearSelection();
  });
  root.addEventListener("pointerover", (event) => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-high-society-tip]")); });
  root.addEventListener("pointerout", (event) => { if (event.pointerType === "mouse") hideTip(); });
  root.addEventListener("focusin", (event) => showTip(event.target.closest("[data-high-society-tip]")));
  root.addEventListener("focusout", hideTip);
  document.addEventListener("scroll", () => { if (gesture?.down) gesture.moved = true; hideTip(); }, { capture: true, passive: true });
  window.addEventListener("resize", hideTip);
  document.addEventListener("keydown", (event) => {
    if (!active()) return;
    if (event.key === "Escape") {
      setExplain(false);
      closeModal(byId("HelpModal"));
      closeModal(byId("ExplainModal"));
      clearSelection();
    }
    const modal = [byId("HelpModal"), byId("ExplainModal")].find((node) => !node.classList.contains("hidden"));
    if (event.key === "Tab" && modal) {
      event.preventDefault();
      modal.querySelector("button").focus();
    }
  });

  function syncRoom(state) {
    const changedRoom = roomId !== state?.room_id;
    roomId = state?.room_id || null;
    const wasSelected = selectedRoom;
    selectedRoom = state?.game_type === "high_society";
    if (selectedRoom ? changedRoom || state?.status === "lobby" : wasSelected) reset();
  }

  function initialize() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); updateControls(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); hideTip(); updateControls(); });
    socket.on("connect", updateControls);
    syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "high_society") window.renderHighSocietyGameState(lastGameStatePayload);
  }
  render();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
