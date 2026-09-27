const hanabiFinalRoundToggle = document.getElementById("hanabiFinalRoundToggle");

(() => {
  const colors = ["red", "yellow", "green", "blue", "white"];
  const ranks = [1, 2, 3, 4, 5];
  const copies = { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1 };
  const symbols = { red: "🔴", yellow: "🟡", green: "🟢", blue: "🔵", white: "⚪" };
  const labels = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue", white: "White" };
  const $ = (id) => document.getElementById(`hanabi${id}`);
  const panel = $("Panel");
  const dialog = $("Dialog");
  const tooltip = $("Tooltip");
  let view = null;
  let selectedCard = null;
  let clueType = "color";
  let clueValue = null;
  let explaining = false;
  let pending = false;
  let pendingTimer;
  let tipTimer;
  let tipTarget = null;
  let returnFocus = null;
  let suppressClick = false;
  let suppressTimer;

  const explanations = {
    clues: ["Clues (💡)", "Spend one clue token to tell another player a color or number. Discard a card or successfully play a 5 to recover one, up to eight."],
    fuses: ["Fuses (❤️)", "An incorrect play loses one fuse and discards that card. At zero fuses the game ends. The standard score is then zero; the board score is also shown."],
    deck: ["Deck (🃏)", "After playing or discarding, draw one card if the deck is not empty. If Final Round Countdown is enabled in the lobby, drawing the last card starts the final-turn counter."],
    score: ["Score (⭐)", "Each successfully played card scores one point. Add the heights of all five fireworks for a maximum of 25. Losing all fuses makes the standard score zero."],
    final: ["Final Turns (⏳)", "When the optional Final Round Countdown is enabled, the game ends when this counter reaches zero. With the option off, an empty deck does not start a countdown."],
    play: ["Play (🎆)", "Select one of your cards, then Play. It must be exactly one higher than the current firework of its color, starting at 1. A failed play loses a fuse (❤️); a successful 5 restores one clue (💡). You draw a replacement if any remain. This button is available only on your turn with a card selected."],
    discard: ["Discard (♻️)", "Select one of your cards, then Discard to recover one clue token (💡) and draw a replacement if available. You cannot discard when all eight clues are available, outside your turn, or without selecting a card."],
    target: ["Clue Target", "Choose a teammate to inspect their hand and give a clue. You cannot give clues to yourself. Other Hands shows the remaining players without repeating your own cards."],
    clue: ["Give Clue (💡)", "Choose a teammate, Color or Number, and a value present in their hand. The gold outlines preview every matching card. Give Clue spends one clue token and tells them all matching positions; the other cards rule out that value. You must have a clue token and it must be your turn."],
    players: ["Other Hands", "Open this section to see the other teammates. The chosen clue target is shown next to the clue controls. Their card faces are visible to you, while the small dots and numbers below show what that player knows from clues."],
    discards: ["Discards (♻️)", "Each cell counts discarded cards of that color and number, including failed plays. Each color has three 1s, two each of 2, 3 and 4, and one 5. A red cell means every copy of that card has been discarded."],
    log: ["Game Log (📜)", "Recent actions appear first. Scroll inside this section to read older entries."],
  };
  const helpHTML = `
    <p><strong>Goal · Fireworks (🎆)</strong><br>Work together to build five fireworks from 1 to 5, in order: Red (🔴), Yellow (🟡), Green (🟢), Blue (🔵), and White (⚪). Score (⭐) is their total height, up to 25.</p>
    <p><strong>Your hidden hand</strong><br>You see everyone else's cards, but only received clues on your own. Two or three players start with five cards each; four or five players start with four. Each color has three 1s, two each of 2, 3 and 4, and one 5.</p>
    <p><strong>On your turn, take one action</strong><br>Play (🎆) a card: it must be the next number of its color. An incorrect play discards the card and costs a Fuse (❤️); a successful 5 restores one Clue (💡).<br>Discard (♻️) a card to restore one Clue (💡), unless all eight are already available.<br>Give Clue (💡): spend one token to name a color or number present in a teammate's hand. Every matching card is marked, and every other card rules out that value. Do not reveal extra card information outside these clues.</p>
    <p><strong>Reading cards</strong><br>The large symbol and number show a visible card, or confirmed clues for your own card; ? means unknown. The five small dots follow Red (🔴), Yellow (🟡), Green (🟢), Blue (🔵), White (⚪). Faded hollow dots and crossed-out numbers have been ruled out. Use Explain (🔎) on any card to read its full information. Card positions start at 1.</p>
    <p><strong>Controls</strong><br>Select your card, then Play or Discard. Tap it again, tap empty space, or press Esc to cancel selection. Choose a clue target to see their hand beside the clue controls; gold outlines preview the matching cards. Open Other Hands, Discards (♻️), or Game Log (📜) when needed. Hover over symbols on desktop or tap them on mobile for a tip; mobile tips disappear after three seconds.</p>
    <p><strong>Deck (🃏) and ending</strong><br>Draw one replacement after playing or discarding while cards remain. Completing all five fireworks earns 25 points. Losing all three Fuses (❤️) ends the game with zero standard points; the board score is also displayed. The optional Final Round Countdown is off by default. If enabled in the lobby, drawing the last card starts the Final Turns (⏳) counter; the game ends at zero. With it off, an empty deck does not trigger an automatic ending.</p>
    <p><strong>Help &amp; Explain</strong><br>Explain (🔎) highlights elements with descriptions, including disabled buttons. Choose an element to read about it; game controls do not act while explaining. Esc exits Explain and closes dialogs.</p>`;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function colorName(color) { return color ? `${labels[color]} (${symbols[color]})` : "Unknown color (?)"; }
  function ownPlayer() { return view?.players.find((player) => player.player_id === view.you); }
  function targetPlayer() { return view?.players.find((player) => player.player_id === $("TargetSelect").value); }
  function possibleColors(card) { return card.known_color ? [card.known_color] : colors.filter((color) => !(card.not_colors || []).includes(color)); }
  function possibleRanks(card) { return Number.isInteger(card.known_rank) ? [card.known_rank] : ranks.filter((rank) => !(card.not_ranks || []).includes(rank)); }
  function cardDescription(card, index) {
    const face = card.color ? `${colorName(card.color)} ${card.rank}.` : "Hidden card.";
    return `Card ${index + 1}: ${face} Known: ${colorName(card.known_color)}, number ${card.known_rank ?? "?"}. Possible colors: ${possibleColors(card).map(colorName).join(", ")}. Possible numbers: ${possibleRanks(card).join(", ")}.`;
  }
  function setTip(node, text) {
    node.dataset.hanabiTip = text;
    node.tabIndex = 0;
  }
  function createCard(card, index, own = false) {
    const node = element(own ? "button" : "div", "hanabi-card");
    const color = card.color || card.known_color;
    if (color) node.dataset.color = color;
    const description = cardDescription(card, index);
    node.dataset.hanabiExplain = "card";
    node.dataset.hanabiDescription = description;
    node.dataset.cardIndex = index;
    node.setAttribute("aria-label", description);
    if (own) {
      node.type = "button";
      node.setAttribute("aria-pressed", String(selectedCard === index));
      node.classList.toggle("selected", selectedCard === index);
      node.addEventListener("click", () => {
        selectedCard = selectedCard === index ? null : index;
        updateSelection();
      });
    } else {
      setTip(node, description);
    }
    const face = element("span", "hanabi-card-face");
    face.append(element("span", "", symbols[color] || "?"), element("span", "hanabi-card-rank", card.rank ?? card.known_rank ?? "?"));
    const knowledge = element("span", "hanabi-card-knowledge");
    knowledge.setAttribute("aria-hidden", "true");
    const dots = element("span", "hanabi-possible-colors");
    const numbers = element("span", "hanabi-possible-ranks");
    colors.forEach((candidate) => {
      const dot = element("span", "hanabi-color-dot");
      dot.dataset.color = candidate;
      dot.classList.toggle("hanabi-ruled-out", !possibleColors(card).includes(candidate));
      dots.appendChild(dot);
    });
    ranks.forEach((rank) => {
      const number = element("span", "", rank);
      number.classList.toggle("hanabi-ruled-out", !possibleRanks(card).includes(rank));
      numbers.appendChild(number);
    });
    knowledge.append(dots, numbers);
    node.append(element("span", "hanabi-card-index", `#${index + 1}`), face, knowledge);
    return node;
  }
  function renderHand(container, player, own = false) {
    container.replaceChildren();
    container.style.setProperty("--hanabi-hand-size", Math.max(player?.hand.length || 0, 1));
    if (!player?.hand.length) {
      container.append(element("span", "hanabi-muted", "No cards"));
      return;
    }
    player.hand.forEach((card, index) => container.appendChild(createCard(card, index, own)));
  }
  function updateSelection() {
    const card = ownPlayer()?.hand[selectedCard];
    $("Hand").querySelectorAll(".hanabi-card").forEach((node) => {
      const selected = Number(node.dataset.cardIndex) === selectedCard;
      node.classList.toggle("selected", selected);
      node.setAttribute("aria-pressed", String(selected));
    });
    $("SelectedCard").textContent = card
      ? `Card ${selectedCard + 1} · ${colorName(card.known_color)} · ${card.known_rank ?? "?"}`
      : view?.game_over ? "Game over · Cards revealed" : "Select a card";
    updateActions();
  }
  function updateActions() {
    const legal = pending ? [] : view?.legal_actions || [];
    const selected = selectedCard !== null && !!ownPlayer()?.hand[selectedCard];
    [["PlayBtn", "play", selected], ["DiscardBtn", "discard", selected], ["ClueBtn", "give_clue", !!targetPlayer() && clueValue !== null]].forEach(([id, action, valid]) => {
      const allowed = legal.includes(action) && valid;
      $(id).disabled = !allowed;
      $(id).classList.toggle("action-allowed", allowed);
    });
  }
  function updateCluePreview() {
    const target = targetPlayer();
    let count = 0;
    $("TargetHand").querySelectorAll(".hanabi-card").forEach((node, index) => {
      const match = clueValue !== null && String(target.hand[index][clueType]) === String(clueValue);
      node.classList.toggle("hanabi-clue-match", match);
      if (match) count++;
    });
    $("CluePreview").textContent = count ? `${count} matching ${count === 1 ? "card" : "cards"}` : "No matching cards";
    updateActions();
  }
  function renderClueValues() {
    const target = targetPlayer();
    const available = new Set((target?.hand || []).map((card) => card[clueType]));
    const values = (clueType === "color" ? colors : ranks).filter((value) => available.has(value));
    if (!values.some((value) => String(value) === String(clueValue))) clueValue = values[0] ?? null;
    $("ClueValueGroup").replaceChildren();
    values.forEach((value) => {
      const label = element("label", "hanabi-clue-value");
      const input = element("input");
      input.type = "radio";
      input.name = "hanabiClueValue";
      input.value = value;
      input.checked = String(value) === String(clueValue);
      input.setAttribute("aria-label", clueType === "color" ? colorName(value) : `Number ${value}`);
      label.append(input, element("span", "hanabi-clue-value-symbol", clueType === "color" ? symbols[value] : value));
      if (clueType === "color") {
        label.dataset.color = value;
        label.appendChild(element("span", "", labels[value]));
      }
      $("ClueValueGroup").appendChild(label);
    });
    if (!values.length) $("ClueValueGroup").append(element("span", "hanabi-muted", "No clues available"));
    updateCluePreview();
  }
  function renderPlayers() {
    const target = targetPlayer();
    renderHand($("TargetHand"), target);
    const others = (view?.players || []).filter((player) => player.player_id !== view.you && player.player_id !== target?.player_id);
    $("OtherHands").hidden = !others.length;
    $("OtherCount").textContent = others.length;
    $("Players").replaceChildren();
    others.forEach((player) => {
      const section = element("section", "hanabi-player");
      const heading = element("div", "hanabi-player-heading");
      heading.appendChild(element("strong", "", player.name));
      if (player.is_bot) heading.appendChild(element("span", "", "Bot"));
      if (player.player_id === view.current_turn) heading.appendChild(element("span", "", "Turn"));
      const hand = element("div", "hanabi-hand");
      renderHand(hand, player);
      section.append(heading, hand);
      $("Players").appendChild(section);
    });
    renderClueValues();
  }
  function renderTableau() {
    $("Tableau").replaceChildren();
    colors.forEach((color) => {
      const value = view.tableau[color] || 0;
      const stack = element("div", "hanabi-stack");
      stack.dataset.color = color;
      stack.dataset.hanabiExplain = "stack";
      const description = `${colorName(color)} firework: ${value}/5. ${value < 5 ? `Play a ${value + 1} next.` : "Complete!"}`;
      stack.dataset.hanabiDescription = description;
      setTip(stack, description);
      const name = element("span", "hanabi-stack-color");
      name.append(element("span", "", symbols[color]), element("span", "", labels[color]));
      stack.append(name, element("strong", "", value), element("span", "hanabi-stack-next", value < 5 ? `Next ${value + 1}` : "Done"));
      $("Tableau").appendChild(stack);
    });
  }
  function renderDiscards() {
    const table = element("table", "hanabi-discard-table");
    table.setAttribute("aria-label", "Discarded cards by color and number");
    const header = element("tr");
    ["Color", ...ranks].forEach((value) => {
      const cell = element("th", "", value);
      cell.scope = "col";
      header.appendChild(cell);
    });
    const head = element("thead");
    head.appendChild(header);
    const body = element("tbody");
    let total = 0;
    colors.forEach((color) => {
      const row = element("tr");
      const name = element("th", "", `${symbols[color]} ${labels[color]}`);
      name.scope = "row";
      row.appendChild(name);
      ranks.forEach((rank) => {
        const count = view.discard_stats?.[color]?.[rank] || 0;
        total += count;
        const cell = element("td", count === copies[rank] ? "hanabi-discard-lost" : "", count);
        setTip(cell, `${colorName(color)} ${rank}: ${count} of ${copies[rank]} copies discarded.`);
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    table.append(head, body);
    $("DiscardStats").replaceChildren(table);
    $("DiscardCount").textContent = total;
  }
  function render(data) {
    if (!data?.view) return;
    if (dialog.open && !$("ConfirmActions").hidden) dialog.close();
    hideTip();
    view = data.view;
    pending = false;
    window.clearTimeout(pendingTimer);
    selectedCard = null;
    const current = view.players.find((player) => player.player_id === view.current_turn);
    $("Turn").textContent = view.game_over ? "Game over" : view.current_turn === view.you ? "Your turn" : `Turn: ${current?.name || "–"}`;
    $("Turn").classList.toggle("hanabi-your-turn", !view.game_over && view.current_turn === view.you);
    $("Clues").textContent = `${view.clue_tokens}/${view.max_clue_tokens}`;
    $("Fuses").textContent = `${view.fuse_tokens}/${view.max_fuse_tokens}`;
    $("Deck").textContent = view.deck_count;
    $("Score").textContent = `${view.score_standard ?? view.score}/25`;
    $("FinalTurns").hidden = !Number.isInteger(view.final_rounds_remaining);
    $("FinalTurns").textContent = `⏳ Final turns: ${view.final_rounds_remaining}`;
    $("Result").hidden = !view.game_over;
    const endings = { defeat: "No fuses left", perfect: "Perfect fireworks!", deck_exhausted: "Final turns complete" };
    $("Result").textContent = view.game_over ? `${endings[view.end_reason] || "Game over"} · ${view.score_display}` : "";
    $("OwnSection").hidden = !ownPlayer();
    panel.classList.toggle("hanabi-spectator", !ownPlayer());
    $("HandNote").textContent = view.game_over ? "Revealed" : "Clues only";
    $("HandNote").dataset.hanabiTip = view.game_over ? "All cards are revealed when the game ends." : "Your cards face away from you. Only received clues are shown.";
    renderHand($("Hand"), ownPlayer(), !view.game_over);
    const previousTarget = $("TargetSelect").value;
    const targets = view.players.filter((player) => player.player_id !== view.you);
    $("TargetSelect").replaceChildren();
    targets.forEach((player) => {
      const option = element("option", "", `${player.name}${player.player_id === view.current_turn ? " · Turn" : ""}${player.is_bot ? " · Bot" : ""}`);
      option.value = player.player_id;
      $("TargetSelect").appendChild(option);
    });
    if (targets.some((player) => player.player_id === previousTarget)) $("TargetSelect").value = previousTarget;
    $("TargetSelect").disabled = !targets.length;
    renderPlayers();
    renderTableau();
    renderDiscards();
    $("Log").replaceChildren();
    const entries = [...(view.log || [])].reverse();
    entries.forEach((entry) => $("Log").appendChild(element("div", "hanabi-log-entry", entry)));
    if (!entries.length) $("Log").textContent = "No actions yet";
    updateSelection();
    logGameEvents(data);
  }

  function hideTip() {
    window.clearTimeout(tipTimer);
    tooltip.hidden = true;
    tipTarget?.removeAttribute("aria-describedby");
    tipTarget = null;
  }
  function showTip(target, timed = false) {
    if (!target || explaining || dialog.open) return;
    hideTip();
    tipTarget = target;
    tooltip.textContent = target.dataset.hanabiTip;
    tooltip.hidden = false;
    target.setAttribute("aria-describedby", tooltip.id);
    const rect = target.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    const left = Math.min(Math.max(12, rect.left + (rect.width - bounds.width) / 2), innerWidth - bounds.width - 12);
    const top = rect.bottom + 8 + bounds.height < innerHeight - 12 ? rect.bottom + 8 : Math.max(12, rect.top - bounds.height - 8);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    if (timed) tipTimer = window.setTimeout(hideTip, 3000);
  }
  function setExplain(enabled) {
    explaining = enabled;
    hideTip();
    panel.classList.toggle("hanabi-explaining", enabled);
    $("ExplainBtn").setAttribute("aria-pressed", String(enabled));
  }
  function openDialog(title, body, html = false) {
    hideTip();
    returnFocus = document.activeElement;
    $("DialogTitle").textContent = title;
    if (html) $("DialogBody").innerHTML = body;
    else $("DialogBody").textContent = body;
    $("ConfirmActions").hidden = true;
    if (!dialog.open) dialog.showModal();
    $("DialogClose").focus();
  }
  function explainTarget(target) {
    if (!target) return;
    const info = explanations[target.dataset.hanabiExplain];
    const description = target.dataset.hanabiDescription || info?.[1];
    if (!description) return;
    setExplain(false);
    openDialog(info?.[0] || "Explain", description);
  }
  function submit(action) {
    if (pending || !view?.legal_actions.includes(action.type)) return;
    pending = true;
    selectedCard = null;
    updateSelection();
    sendAction(action);
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => { pending = false; updateActions(); }, 5000);
  }
  function playSelected() {
    if (selectedCard === null || !ownPlayer()?.hand[selectedCard]) return;
    const cardIndex = selectedCard;
    dialog.close();
    submit({ type: "play", card_index: cardIndex });
  }
  $("PlayBtn").addEventListener("click", () => {
    const card = ownPlayer()?.hand[selectedCard];
    if (!card || $("PlayBtn").disabled) return;
    const possible = possibleColors(card).some((color) => possibleRanks(card).includes((view.tableau[color] || 0) + 1));
    if (!possible && possibleColors(card).length && possibleRanks(card).length) {
      openDialog("This play will fail", "The received clues rule out every card that could be played now. Playing this card will cost one fuse (❤️).");
      $("ConfirmActions").hidden = false;
      $("CancelPlay").focus();
    } else playSelected();
  });
  $("DiscardBtn").addEventListener("click", () => {
    if (selectedCard !== null) submit({ type: "discard", card_index: selectedCard });
  });
  $("ClueBtn").addEventListener("click", () => {
    if (!targetPlayer() || clueValue === null) return;
    submit({ type: "give_clue", target_player_id: $("TargetSelect").value, clue_type: clueType, value: clueType === "rank" ? Number(clueValue) : clueValue });
  });
  $("TargetSelect").addEventListener("change", () => { hideTip(); renderPlayers(); });
  $("ClueTypeGroup").addEventListener("change", (event) => {
    clueType = event.target.value;
    clueValue = null;
    renderClueValues();
  });
  $("ClueValueGroup").addEventListener("change", (event) => {
    clueValue = event.target.value;
    updateCluePreview();
  });
  $("HelpBtn").addEventListener("click", () => { setExplain(false); openDialog("Hanabi · Help", helpHTML, true); });
  $("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
  $("DialogClose").addEventListener("click", () => dialog.close());
  $("ConfirmPlay").addEventListener("click", playSelected);
  $("CancelPlay").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (returnFocus?.isConnected && !panel.classList.contains("hidden")) returnFocus.focus({ preventScroll: true }); });
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  function explainExempt(target) {
    return dialog.contains(target) || target.closest("#hanabiHelpBtn, #hanabiExplainBtn");
  }
  document.addEventListener("pointerdown", (event) => {
    if (!explaining || panel.classList.contains("hidden") || explainExempt(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Pointer events and hit testing also reach disabled controls, unlike click.
    const target = document.elementsFromPoint(event.clientX, event.clientY)
      .map((node) => node.closest("#hanabiPanel [data-hanabi-explain]"))
      .find(Boolean);
    if (target) {
      suppressClick = true;
      window.clearTimeout(suppressTimer);
      suppressTimer = window.setTimeout(() => { suppressClick = false; }, 600);
      explainTarget(target);
    }
  }, true);
  document.addEventListener("click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!explaining || panel.classList.contains("hidden") || explainExempt(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    explainTarget(event.target.closest("#hanabiPanel [data-hanabi-explain]"));
  }, true);
  panel.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const target = event.target.closest("[data-hanabi-tip]");
    if (target && !target.contains(event.relatedTarget)) showTip(target);
  });
  panel.addEventListener("pointerout", (event) => {
    const target = event.target.closest("[data-hanabi-tip]");
    if (event.pointerType === "mouse" && target && !target.contains(event.relatedTarget)) hideTip();
  });
  panel.addEventListener("focusin", (event) => {
    if (event.target.matches("[data-hanabi-tip]")) showTip(event.target, true);
  });
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("click", (event) => {
    const target = event.target.closest("[data-hanabi-tip]");
    if (target) showTip(target, true);
    else hideTip();
    if (event.target.closest("button, input, select, label, summary, dialog, [data-hanabi-tip]")) return;
    selectedCard = null;
    updateSelection();
  });
  document.addEventListener("keydown", (event) => {
    if (panel.classList.contains("hidden")) return;
    if (explaining && !explainExempt(event.target) && [" ", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === " " || event.key === "Enter") explainTarget(event.target.closest("[data-hanabi-explain]"));
    }
    if (event.key !== "Escape") return;
    hideTip();
    if (dialog.open) return;
    setExplain(false);
    selectedCard = null;
    updateSelection();
  }, true);
  window.addEventListener("scroll", hideTip, true);
  window.addEventListener("resize", hideTip);

  function clearState() {
    view = null;
    selectedCard = null;
    clueType = "color";
    clueValue = null;
    pending = false;
    suppressClick = false;
    window.clearTimeout(pendingTimer);
    window.clearTimeout(suppressTimer);
    setExplain(false);
    if (dialog.open) dialog.close();
    $("Turn").textContent = "Waiting for the game to start";
    $("Turn").classList.remove("hanabi-your-turn");
    ["Clues", "Fuses", "Deck", "Score"].forEach((id) => { $(id).textContent = "–"; });
    ["Tableau", "Hand", "TargetHand", "Players", "TargetSelect", "ClueValueGroup", "DiscardStats", "Log"].forEach((id) => $(id).replaceChildren());
    ["Result", "FinalTurns", "OtherHands"].forEach((id) => { $(id).hidden = true; });
    $("OwnSection").hidden = false;
    panel.classList.remove("hanabi-spectator");
    $("HandNote").textContent = "Clues only";
    $("CluePreview").textContent = "";
    $("DiscardCount").textContent = "0";
    $("ClueTypeGroup").querySelector('input[value="color"]').checked = true;
    panel.querySelectorAll("details").forEach((details) => { details.open = false; });
    $("OtherHands").open = window.matchMedia("(min-width: 1101px)").matches;
    updateSelection();
  }
  window.renderHanabiGameState = render;
  window.clearHanabiState = clearState;
  window.showHanabiHeaderActions = (visible) => {
    $("HeaderActions").hidden = !visible;
    if (!visible) {
      setExplain(false);
      if (dialog.open) dialog.close();
    }
  };
  window.updateHanabiConfigRow = () => {
    const visible = currentGameType === "hanabi" && currentRoomState?.status === "lobby";
    [$("ConfigBox"), $("FinalRoundRow")].forEach((node) => {
      if (!node) return;
      node.classList.toggle("hidden", !visible);
      node.setAttribute("aria-hidden", String(!visible));
    });
  };
  if (typeof socket !== "undefined") socket.on("system:error", () => {
    pending = false;
    window.clearTimeout(pendingTimer);
    updateActions();
  });
  function initialize() {
    clearState();
    updateHanabiConfigRow();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
