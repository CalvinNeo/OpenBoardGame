(() => {
  const root = document.getElementById("felixPanel");
  const byId = (suffix) => document.getElementById(`felix${suffix}`);
  const text = (suffix, value) => { byId(suffix).textContent = value; };
  const hide = (suffix, value) => byId(suffix).classList.toggle("hidden", value);
  const colors = { red: "#c76755", blue: "#5785b2", green: "#5d9165", purple: "#9571ad", orange: "#c39244" };
  let view = null;
  let selectedCardId = null;
  let explaining = false;
  let pending = false;
  let pendingTimer = null;
  let tooltipTimer = null;
  let gesture = null;
  let suppressClickUntil = 0;
  let activeRoomId = null;
  let selectedRoom = false;
  let handSignature = null;

  const active = () => currentGameType === "felix" && !root.classList.contains("hidden");
  const connected = () => typeof socket === "undefined" || socket.connected;
  const self = () => view?.players?.find((player) => player.player_id === view.you);
  const can = (action) => active() && connected() && !pending && !!view?.legal_actions?.includes(action);
  const playerName = (playerId) => view?.players?.find((player) => player.player_id === playerId)?.name || playerId || "—";
  const signed = (value) => `${value > 0 ? "+" : ""}${value}`;
  const emoji = (card) => ({ cat: card?.value < 0 ? "😾" : "🐱", rabbit: "🐰", big_dog: "🐕", small_dog: "🐶" }[card?.kind] || "🎒");
  const animalName = (card) => ({ cat: "Cat", rabbit: "Rabbit", big_dog: "Big dog", small_dog: "Small dog" }[card?.kind] || "Hidden");
  const cardLabel = (card) => `${emoji(card)} ${animalName(card)}${card?.value != null ? ` ${signed(card.value)}` : ""}`;
  const nextReward = () => [...(view?.mouse_cards || [])].sort((first, second) => first.value - second.value).find((card) => card.mice > 0);
  const explanations = {
    BidBtn: "Bid with Mice (🐭). Your total must exceed the high bid without exceeding your balance. Only the winner pays, after the auction ends.",
    PassBtn: "Pass leaves the auction without paying a bid. Take the lowest non-empty mouse reward (🐭), then reveal the next animal. In the last-chance offer, Pass discards the sack and skips the next refill.",
    BuyOneBtn: "Buy the fully revealed Sack (🎒) for 1 mouse (🐭). Dog effects still apply. This offer appears only when nobody has bid and you are the last player remaining.",
    NextBtn: "Confirm you have reviewed the result. The next round begins only after every player chooses Next Round. There is no second confirmation.",
    PlayBtn: "Commit this animal face down to the Sack (🎒). This cannot be undone. The next player then chooses a card.",
    CancelBtn: "Return to your hand without playing a card. Clicking unused space or pressing Esc also cancels the selection.",
    BidDownBtn: "Decrease your bid by one mouse (🐭), never below the current high bid plus one.",
    BidUpBtn: "Increase your bid by one mouse (🐭), never above your own balance.",
    BidInput: "Enter a whole number of mice (🐭), from the current high bid plus one up to your balance. Editing the number does not submit a bid.",
  };
  const help = `
    <h3>🐱 Nine rounds of bluffing</h3>
    <p>Each player starts with 15 Mice (🐭) and nine animal cards after one of their ten cards is secretly removed. In turn, everyone places one animal face down into the Sack (🎒). The opener’s card is revealed before bidding. With three players, an extra Dummy card is placed first and revealed instead.</p>
    <h3>Choose, then confirm</h3>
    <p>Tap a card, then Play card on the hand overlay. Cancel, Esc or unused space returns to your hand without playing. Face-down animals stay secret until revealed. Other players’ money and everyone’s won collections remain hidden until the game ends.</p>
    <h3>🐭 Raise or leave</h3>
    <p>Bid a whole number higher than the current high bid, up to your balance. Bids are not charged immediately: only the last remaining player pays their winning bid. Pass costs nothing, takes the lowest non-empty mouse reward and reveals the next hidden animal. The reward above a slot is the number of mice currently available, not its refill value.</p>
    <p>If everyone passes without bidding, the last player sees all animals and may Buy for 1 🐭 or Pass. Passing discards the sack, keeps the same opener and skips the refill. After a sale, the winner opens the next round and rewards refill from the Bank (🐭). If the bank cannot refill all rewards, all become zero.</p>
    <h3>Meet the animals</h3>
    <p>Good Cat (🐱): +3, +5, +8, +11 or +15 points. Bad Cat (😾): −5 or −8 points. Rabbit (🐰): zero points.</p>
    <p>One Big dog (🐕) removes the highest positive cat; if there are no positive cats, it removes the most negative cat. One Small dog (🐶) removes the most negative cat; without negative cats, it removes the lowest positive cat. The dog also leaves. Two or more dogs remove only the dogs, leaving all cats. A dog with no cats just leaves by itself.</p>
    <h3>Review &amp; score</h3>
    <p>All animals reveal at settlement. Kept cards go to the winner; Removed cards leave play. Every player chooses Next Round before play continues. After round 9, add your cat points and remaining mice. Highest total wins; ties use higher cat points, then share the win.</p>
    <h3>Reading the table</h3>
    <p>Cards is your remaining hand size; Won is your face-down collection size; Bid (🐭) is public. A lock (🔒) hides another player’s money. Turn, Placed, Leading, Passed and Ready describe each player’s state. Hover or tap non-interactive symbols for a brief tip. Explain inspects cards and controls, even disabled controls, without taking an action. Esc closes a dialog or exits Explain.</p>`;

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function tip(node, content) {
    node.dataset.felixTip = content;
    node.tabIndex = 0;
    return node;
  }

  function cardDescription(card) {
    if (!card) return "Hidden animal (🎒): its identity stays secret until it is revealed.";
    if (card.kind === "cat") return `${cardLabel(card)}: ${signed(card.value)} points if it remains in the winning sack after dog effects.`;
    if (card.kind === "rabbit") return "Rabbit (🐰): zero points. Dogs do not chase rabbits.";
    if (card.kind === "big_dog") return "Big dog (🐕): alone, removes the highest positive cat, or the most negative cat if none are positive. The dog leaves too. Two or more dogs remove only the dogs.";
    return "Small dog (🐶): alone, removes the most negative cat, or the lowest positive cat if none are negative. The dog leaves too. Two or more dogs remove only the dogs.";
  }

  function animalCard(card, interactive = false, waiting = false) {
    const node = element(interactive ? "button" : "div", "felix-card");
    if (interactive) {
      node.type = "button";
      node.dataset.cardId = card.id;
      node.dataset.felixExplain = `${cardDescription(card)} Select it, then confirm Play card to put it in the sack.`;
      node.setAttribute("aria-label", cardLabel(card));
    } else {
      tip(node, waiting ? "Empty slot: this player has not placed an animal yet." : cardDescription(card));
    }
    node.classList.add(card ? `kind-${card.kind}` : waiting ? "waiting" : "face-down");
    node.classList.toggle("negative", card?.kind === "cat" && card.value < 0);
    node.append(
      element("span", "felix-card-value", card?.value != null ? signed(card.value) : ""),
      element("span", "felix-card-emoji", waiting ? "·" : emoji(card)),
      element("span", "felix-card-label", waiting ? "Waiting" : animalName(card))
    );
    return node;
  }

  function renderTable() {
    const container = byId("TableSlots");
    container.replaceChildren();
    const players = view?.players || [];
    const startIndex = Math.max(0, players.findIndex((player) => player.player_id === view?.start_player));
    const order = [...players.slice(startIndex), ...players.slice(0, startIndex)];
    const owners = players.length === 3 ? [null, ...order] : order;
    const slots = view?.table_slots || [];
    const count = Math.max(owners.length, slots.length);
    container.style.setProperty("--felix-slots", String(count || 4));
    text("Revealed", `${slots.filter((slot) => slot.face_up).length}/${count} revealed`);
    const reward = nextReward();
    for (let index = 0; index < count; index += 1) {
      const slot = slots[index];
      const wrapper = element("div", "felix-slot");
      if (slot?.resolution) wrapper.classList.add(`resolution-${slot.resolution}`);
      const mouseCard = view.mouse_cards[index - 1];
      const position = tip(element("div", "felix-slot-position", index === 0 ? "🎒" : mouseCard ? `🐭 ${mouseCard.mice}` : "Last"),
        index === 0 ? "Sack (🎒): this animal reveals first when the auction starts." : mouseCard
          ? `Mouse reward (🐭): ${mouseCard.mice} currently available; refill value ${mouseCard.value}. Pass takes the lowest non-empty reward.`
          : "The extra animal slot in a three-player game has no mouse reward above it.");
      position.classList.toggle("next-reward", !!mouseCard && mouseCard === reward);
      position.classList.toggle("empty-reward", !!mouseCard && !mouseCard.mice);
      const ownerId = slot ? slot.player_id : owners[index]?.player_id;
      const dummy = slot ? slot.source === "dummy" : players.length === 3 && index === 0;
      const ownerName = dummy ? "Dummy" : playerName(ownerId);
      const owner = tip(element("div", "felix-slot-owner", !dummy && ownerId === view.you ? "You" : ownerName), dummy ? "Dummy: one extra random animal per round in a three-player game." : ownerName);
      const status = slot?.resolution === "awarded" ? "Kept" : slot?.resolution === "removed" ? "Removed" : slot?.face_up ? "Revealed" : slot ? "Hidden" : "To place";
      wrapper.append(position, owner, animalCard(slot?.face_up ? slot.card : null, false, !slot), element("div", "felix-slot-status", status));
      container.appendChild(wrapper);
    }
    text("Start", playerName(view?.start_player));
    tip(byId("Start"), `Opener: ${playerName(view?.start_player)}. The winner of a sold sack opens the next round.`);
    text("Bank", view?.bank_mice ?? "—");
    text("Bid", `${view?.current_bid || 0} 🐭`);
    text("Bidder", view?.current_bidder ? playerName(view.current_bidder) : "No bids yet");
  }
  function renderHand() {
    const hand = view?.your_hand || [];
    const signature = JSON.stringify(hand);
    const hidden = !!view && (!self() || (view.game_over && !hand.length));
    hide("HandSection", hidden);
    root.querySelector(".felix-play-area").classList.toggle("no-hand", hidden);
    text("HandCount", `${hand.length} ${hand.length === 1 ? "card" : "cards"}`);
    if (signature === handSignature) return;
    handSignature = signature;
    const container = byId("Hand");
    container.replaceChildren();
    if (!hand.length) {
      container.appendChild(element("div", "felix-hand-empty", view ? "No cards left." : "Your cards appear when the game starts."));
      return;
    }
    hand.forEach((card) => container.appendChild(animalCard(card, true)));
  }

  function playerBadge(player) {
    if (view.game_over) return view.winner?.includes(player.player_id) ? "Winner" : "Finished";
    if (view.phase === "round_summary") return view.next_ready?.includes(player.player_id) ? "Ready" : "Reviewing";
    if (player.player_id === view.current_turn) return "Turn";
    if (player.passed) return "Passed";
    if (view.phase === "choose_card") return view.table_slots?.some((slot) => slot.player_id === player.player_id) ? "Placed" : "Waiting";
    return player.player_id === view.current_bidder ? "Leading" : "In auction";
  }

  function renderPlayers() {
    const container = byId("Players");
    const openCollections = new Set(Array.from(container.querySelectorAll("details[open]"), (node) => node.dataset.playerId));
    container.replaceChildren();
    text("PlayerCount", `${view?.players?.length || 0} at the table`);
    (view?.players || []).forEach((player) => {
      const card = element("div", "felix-player");
      card.classList.toggle("self", player.player_id === view.you);
      card.classList.toggle("current", player.player_id === view.current_turn);
      card.classList.toggle("passed", player.passed);
      card.style.setProperty("--felix-player-color", colors[player.color] || "#a4b8a6");
      const heading = element("div", "felix-player-heading");
      const name = playerName(player.player_id);
      heading.append(
        tip(element("strong", "felix-player-name", `${name}${player.player_id === view.you ? " · You" : ""}`), name),
        element("span", "felix-player-badge", playerBadge(player))
      );
      const meta = element("div", "felix-player-meta");
      meta.append(
        tip(element("span", "", player.mice_hidden ? "🐭 🔒" : `🐭 ${player.mice ?? 0}`), player.mice_hidden ? "Mice (🐭): this player’s balance is secret until the game ends." : `Mice (🐭): ${player.mice ?? 0} remaining. Each is worth one point at the end.`),
        tip(element("span", "", `Cards ${player.hand_count ?? 0}`), "Animal cards remaining in this player’s hand."),
        tip(element("span", "", `Won ${player.won_count ?? 0}`), "Won animals are kept face down. Only their count is public until the final scoring.")
      );
      if (player.round_bid) meta.appendChild(tip(element("span", "", `Bid ${player.round_bid} 🐭`), "This player’s latest public bid. It is charged only if they win the sack."));
      card.append(heading, meta);
      if (view.game_over && player.won_cards?.length) {
        const details = element("details", "felix-collection");
        details.dataset.playerId = player.player_id;
        details.open = openCollections.has(player.player_id);
        details.appendChild(element("summary", "", `View ${player.won_cards.length} won cards`));
        const collection = element("div", "felix-won-row");
        player.won_cards.forEach((animal) => collection.appendChild(animalCard(animal)));
        details.appendChild(collection);
        card.appendChild(details);
      }
      container.appendChild(card);
    });
  }

  function renderNotice() {
    const summary = view?.last_round_summary;
    const reviewing = view?.phase === "round_summary";
    const over = !!view?.game_over;
    hide("Notice", !reviewing && !over);
    hide("NextBtn", !reviewing || !self());
    byId("Notice").classList.toggle("self", !!self() && (over ? view.winner?.includes(view.you) : summary?.winner === view.you));
    const body = byId("NoticeBody");
    const ready = byId("Ready");
    const results = byId("FinalResults");
    body.replaceChildren();
    ready.replaceChildren();
    results.replaceChildren();
    if (!reviewing && !over) return;
    text("NoticeTitle", over ? "Final scores" : `Round ${view.round} settled`);
    if (over) {
      const winners = (view.winner || []).map(playerName).join(", ");
      body.appendChild(element("strong", "", winners ? `Winner: ${winners}` : "Game finished"));
      [...view.players].sort((first, second) => second.final_score - first.final_score || second.final_cat_score - first.final_cat_score).forEach((player) => {
        const row = element("div", "felix-result-row");
        row.classList.toggle("self", player.player_id === view.you);
        row.append(
          element("span", "", `${playerName(player.player_id)}${player.player_id === view.you ? " · You" : ""}`),
          element("strong", "", `${player.final_score ?? 0} pts`),
          element("small", "", `Cats ${signed(player.final_cat_score ?? 0)} + Mice 🐭 ${player.mice ?? 0}`)
        );
        results.appendChild(row);
      });
    }
    if (summary?.result === "won") {
      const score = (summary.won_cards || []).reduce((total, card) => total + (card.kind === "cat" ? card.value : 0), 0);
      body.appendChild(element("div", "", `${summary.winner === view.you ? "You" : playerName(summary.winner)} paid ${summary.paid} 🐭 · cats ${signed(score)} pts`));
      const removed = (summary.removed_cards || []).map(cardLabel).join(", ");
      if (removed) body.appendChild(element("div", "", `Removed: ${removed}`));
    } else if (summary?.result === "no_sale") {
      body.appendChild(element("div", "", "No sale. All animals are discarded; rewards will not refill."));
    }
    if (reviewing) {
      const confirmed = view.next_ready || [];
      ready.appendChild(element("span", "", `${confirmed.length}/${view.players.length} ready`));
      view.players.forEach((player) => {
        const isReady = confirmed.includes(player.player_id);
        const chip = element("span", "felix-ready-chip", `${player.player_id === view.you ? "You" : playerName(player.player_id)} · ${isReady ? "Ready" : "Reviewing"}`);
        chip.classList.toggle("ready", isReady);
        chip.classList.toggle("self", player.player_id === view.you);
        ready.appendChild(chip);
      });
    }
  }

  function actionHint() {
    if (!view) return "Ready up in Room Controls to start.";
    if (!connected()) return "Disconnected. Reconnect to continue.";
    if (pending) return "Sending your action…";
    if (view.game_over) return "Final scores are in. Open a player’s collection to review their cards.";
    if (!self()) return view.current_turn ? `Spectating · ${playerName(view.current_turn)} is playing.` : "Spectating · players are reviewing the result.";
    if (view.phase === "round_summary") return can("next_round") ? "Review the animals, then choose Next Round." : "You are ready. Waiting for everyone to review.";
    if (can("choose_card")) return selectedCardId ? "Confirm this animal, or cancel to choose another." : "Your turn · choose an animal for the sack.";
    if (view.phase === "choose_card") return `${playerName(view.current_turn)} is choosing an animal.`;
    if (can("buy_for_one")) return "Your choice · buy the revealed sack for 1 🐭 or pass.";
    if (can("pass")) return can("bid") ? "Your turn · raise the bid or take the pass reward." : view.phase === "last_chance" ? "No mice to buy the sack. Pass to finish the round." : "Not enough mice to raise. Pass to take the reward.";
    if (self().passed) return `You passed. ${playerName(view.current_turn)} is deciding.`;
    return `${playerName(view.current_turn)} is deciding.`;
  }

  function updateControls() {
    const auction = view?.phase === "auction";
    const lastChance = view?.phase === "last_chance";
    const minimum = Number(view?.current_bid || 0) + 1;
    const maximum = Number(self()?.mice || 0);
    const input = byId("BidInput");
    const amount = Number(input.value);
    const valid = input.value !== "" && Number.isInteger(amount) && amount >= minimum && amount <= maximum;
    input.min = String(minimum);
    input.max = String(maximum);
    input.disabled = !can("bid");
    input.setAttribute("aria-invalid", String(can("bid") && !valid));
    hide("Auction", !auction && !lastChance);
    hide("BidEntry", !auction);
    hide("BidBtn", !auction);
    hide("BuyOneBtn", !lastChance);
    byId("BidBtn").disabled = !can("bid") || !valid;
    byId("BidDownBtn").disabled = !can("bid") || (valid && amount <= minimum);
    byId("BidUpBtn").disabled = !can("bid") || (valid && amount >= maximum);
    byId("PassBtn").disabled = !can("pass");
    byId("BuyOneBtn").disabled = !can("buy_for_one");
    byId("NextBtn").disabled = !can("next_round");
    text("BidBtn", valid ? `Bid ${amount} 🐭` : "Bid");
    text("PassBtn", lastChance ? "Pass" : `Pass · +${nextReward()?.mice || 0} 🐭`);
    text("NextBtn", view?.next_ready?.includes(view.you) ? "Ready ✓" : "Next Round");
    text("BidHint", !self() ? "Spectating" : maximum < minimum ? `Need ${minimum} 🐭 to raise · you have ${maximum}` : can("bid") && !valid ? `Enter a whole number from ${minimum} to ${maximum}.` : `Min ${minimum} · your balance ${maximum} 🐭`);
    byId("BidHint").classList.toggle("invalid", can("bid") && !valid);
    const selected = view?.your_hand?.find((card) => card.id === selectedCardId);
    hide("Selection", !selected);
    root.querySelector(".felix-hand-stage").classList.toggle("has-selection", !!selected);
    byId("Hand").inert = !!selected;
    byId("PlayBtn").disabled = !can("choose_card") || !selected;
    byId("CancelBtn").disabled = pending;
    if (selected) text("SelectedLabel", cardLabel(selected));
    byId("Hand").querySelectorAll("button").forEach((button) => {
      const isSelected = button.dataset.cardId === selectedCardId;
      button.disabled = !can("choose_card");
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });
    text("HandHint", can("choose_card") ? "Choose a card, then confirm it here." : view?.phase === "choose_card" ? "Waiting for your turn to place an animal." : view?.game_over ? "All nine rounds are complete." : "Your remaining animals for future rounds.");
    text("ActionHint", actionHint());
    const needsAction = active() && connected() && !pending && !!view?.legal_actions?.length;
    byId("ActionHint").classList.toggle("your-turn", needsAction);
    document.body.classList.toggle("felix-needs-action", needsAction);
    root.querySelectorAll("[data-felix-explain], [data-felix-tip]").forEach((node) => node.classList.toggle("has-explanation", explaining));
  }

  function render() {
    text("Round", view ? `${view.round}/9` : "—");
    text("Phase", ({ choose_card: "Place animals", auction: "Auction", last_chance: "Last chance", round_summary: "Review", game_over: "Game over" })[view?.phase] || "Waiting to start");
    text("Balance", self() ? `🐭 ${self().mice}` : view ? "Spectating" : "🐭 —");
    renderTable();
    renderHand();
    renderPlayers();
    renderNotice();
    updateControls();
  }
  function clearSelection(restoreFocus = false) {
    if (pending) return;
    const selected = Array.from(byId("Hand").querySelectorAll("button")).find((button) => button.dataset.cardId === selectedCardId);
    selectedCardId = null;
    updateControls();
    if (restoreFocus && selected && !selected.disabled) selected.focus({ preventScroll: true });
  }

  function submit(action) {
    if (!can(action.type) || explaining) return;
    if (action.type === "bid" && byId("BidBtn").disabled) return;
    if (action.type === "choose_card" && !view.your_hand.some((card) => card.id === action.card_id)) return;
    pending = true;
    hideTip();
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(releasePending, 6000);
    updateControls();
    sendAction(action);
  }

  function releasePending() {
    pending = false;
    clearTimeout(pendingTimer);
    updateControls();
  }

  function hideTip() {
    clearTimeout(tooltipTimer);
    const tooltip = byId("Tooltip");
    if (tooltip.matches(":popover-open")) tooltip.hidePopover();
    tooltip.classList.add("hidden");
  }

  function showTip(target) {
    if (!target || explaining || !active() || target.closest("button, input, summary") || byId("HelpModal").open || byId("ExplainModal").open) return;
    hideTip();
    const tooltip = byId("Tooltip");
    tooltip.textContent = target.dataset.felixTip;
    tooltip.classList.remove("hidden");
    tooltip.showPopover?.();
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

  function openModal(suffix) {
    hideTip();
    const modal = byId(suffix);
    if (!modal.open) modal.showModal();
    modal.querySelector("button").focus({ preventScroll: true });
  }

  function showExplanation(target) {
    if (!target || !root.contains(target)) return;
    const description = target.dataset.felixExplain || target.dataset.felixTip;
    if (!description) return;
    text("ExplainContent", description);
    setExplain(false);
    openModal("ExplainModal");
  }

  function explanationAt(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY)?.closest("[data-felix-explain], [data-felix-tip]");
    return target && root.contains(target) ? target : null;
  }

  function reset() {
    view = null;
    selectedCardId = null;
    pending = false;
    gesture = null;
    handSignature = null;
    clearTimeout(pendingTimer);
    setExplain(false);
    byId("HelpModal").close();
    byId("ExplainModal").close();
    byId("BidInput").value = "";
    render();
  }

  window.renderFelixGameState = (data) => {
    if (!data?.view || currentGameType !== "felix") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const incoming = data.view;
    const changedTurn = !view || view.round !== incoming.round || view.phase !== incoming.phase || view.current_turn !== incoming.current_turn || view.you !== incoming.you;
    const changedBid = view?.current_bid !== incoming.current_bid;
    if (changedTurn) selectedCardId = null;
    view = incoming;
    pending = false;
    clearTimeout(pendingTimer);
    if (!view.your_hand?.some((card) => card.id === selectedCardId)) selectedCardId = null;
    if (changedTurn || changedBid) byId("BidInput").value = String(Number(view.current_bid || 0) + 1);
    hideTip();
    render();
    logGameEvents(data);
  };

  window.showFelixHeaderActions = (show) => {
    byId("HeaderActions").style.display = show ? "flex" : "none";
    if (!show) reset();
    else updateControls();
  };

  Object.entries(explanations).forEach(([suffix, content]) => { byId(suffix).dataset.felixExplain = content; });
  byId("HelpContent").innerHTML = help;
  byId("Hand").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-card-id]");
    if (!button || explaining || !can("choose_card")) return;
    selectedCardId = button.dataset.cardId;
    hideTip();
    updateControls();
    byId("PlayBtn").focus({ preventScroll: true });
  });
  byId("PlayBtn").addEventListener("click", () => submit({ type: "choose_card", card_id: selectedCardId }));
  byId("CancelBtn").addEventListener("click", () => clearSelection(true));
  byId("BidInput").addEventListener("input", updateControls);
  byId("BidBtn").addEventListener("click", () => submit({ type: "bid", amount: Number(byId("BidInput").value) }));
  byId("PassBtn").addEventListener("click", () => submit({ type: "pass" }));
  byId("BuyOneBtn").addEventListener("click", () => submit({ type: "buy_for_one" }));
  byId("NextBtn").addEventListener("click", () => submit({ type: "next_round" }));
  [["BidDownBtn", -1], ["BidUpBtn", 1]].forEach(([suffix, delta]) => {
    byId(suffix).addEventListener("click", () => {
      if (!can("bid") || explaining) return;
      const minimum = Number(view.current_bid) + 1;
      const amount = Number(byId("BidInput").value);
      byId("BidInput").value = String(Math.max(minimum, Math.min(Number(self().mice), (Number.isInteger(amount) ? amount : minimum) + delta)));
      updateControls();
    });
  });
  byId("HelpBtn").addEventListener("click", () => { setExplain(false); openModal("HelpModal"); });
  byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
  ["Help", "Explain"].forEach((kind) => {
    const modal = byId(`${kind}Modal`);
    byId(`${kind}CloseBtn`).addEventListener("click", () => modal.close());
    modal.addEventListener("click", (event) => {
      const bounds = modal.getBoundingClientRect();
      if (event.target === modal && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) modal.close();
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!active()) return;
    suppressClickUntil = 0;
    gesture = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, down: true, target: explanationAt(event.clientX, event.clientY) };
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
    const target = explanationAt(event.clientX, event.clientY);
    if (explaining && target && target === gesture.target) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = Date.now() + 500;
      showExplanation(target);
    }
  }, true);
  document.addEventListener("click", (event) => {
    if (!active()) return;
    if (Date.now() < suppressClickUntil && root.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!explaining || event.target.closest("#felixHelpBtn, #felixExplainBtn, #felixHelpModal, #felixExplainModal")) return;
    if (event.target.closest("button, input, select, summary, a, [data-felix-tip]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showExplanation(event.target.closest("[data-felix-explain], [data-felix-tip]"));
    }
  }, true);
  root.addEventListener("click", (event) => {
    if (explaining) return;
    const target = event.target.closest("[data-felix-tip]");
    if (target) showTip(target);
    else if (!event.target.closest("button, input, summary, a")) clearSelection();
  });
  root.addEventListener("pointerover", (event) => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-felix-tip]")); });
  root.addEventListener("pointerout", (event) => { if (event.pointerType === "mouse") hideTip(); });
  root.addEventListener("focusin", (event) => showTip(event.target.closest("[data-felix-tip]")));
  root.addEventListener("focusout", hideTip);
  document.addEventListener("scroll", () => { if (gesture?.down) gesture.moved = true; hideTip(); }, { capture: true, passive: true });
  window.addEventListener("resize", hideTip);
  document.addEventListener("keydown", (event) => {
    if (!active()) return;
    if (event.key === "Escape") {
      setExplain(false);
      byId("HelpModal").close();
      byId("ExplainModal").close();
      clearSelection(true);
    } else if (explaining && root.contains(event.target) && event.key !== "Tab") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (["Enter", " "].includes(event.key)) showExplanation(event.target.closest("[data-felix-explain], [data-felix-tip]"));
    }
  }, true);

  function syncRoom(state) {
    const changedRoom = activeRoomId !== state?.room_id;
    activeRoomId = state?.room_id || null;
    const wasSelected = selectedRoom;
    selectedRoom = state?.game_type === "felix";
    if (selectedRoom ? changedRoom || state?.status === "lobby" : wasSelected) reset();
  }

  function initialize() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", releasePending);
    socket.on("disconnect", () => { hideTip(); releasePending(); });
    socket.on("connect", updateControls);
    syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "felix") window.renderFelixGameState(lastGameStatePayload);
  }
  render();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
