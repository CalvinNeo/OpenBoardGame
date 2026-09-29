(() => {
    const ui = Object.fromEntries([
        "Panel", "HeaderActions", "HelpBtn", "ExplainBtn", "HelpModal", "HelpModalCloseBtn",
        "ExplainModal", "ExplainModalCloseBtn", "HelpContent", "ExplainContent", "ExplainHint",
        "Status", "Phase", "Turn", "Winner", "Remaining", "Workspace", "Piles", "Market",
        "MarketCount", "Selection", "SelectedFlips", "TakePointBtn", "TakeVeggiesBtn",
        "OwnPanel", "OwnScore", "OwnVeggies", "OwnCardCount", "OwnCards", "FlipHint",
        "Players", "PlayerCount", "Tooltip",
    ].map(name => [name, document.getElementById(`pointSalad${name}`)]));
    const veggies = { Lettuce: "🥬", Pepper: "🫑", Tomato: "🍅", Carrot: "🥕", Onion: "🧅", Cabbage: "🟣" };
    const explanations = new WeakMap();
    let view = null;
    let selectedPile = null;
    let selectedMarket = [];
    const selectedFlips = new Set();
    let explainMode = false;
    let suppressClick = false;
    let tooltipTimer = null;
    let tooltipAnchor = null;
    let modalReturnFocus = null;

    const helpText = `
        <h3>Build the highest-scoring salad</h3>
        <p>Collect veggies and point cards. Each point card scores your entire veggie collection; the same veggie can count for several cards.</p>
        <div class="point-salad-help-veggies">${Object.entries(veggies).map(([name, icon]) => `<span data-point-salad-veggie="${name}">${name} (${icon})</span>`).join("")}</div>
        <p>The purple circle (🟣) represents Cabbage. Points (pts) are your score.</p>
        <h3>On your turn, choose one</h3>
        <ul>
            <li><strong>Take 1 point card</strong> from the top of pile A, B or C. It adds a scoring rule to your salad.</li>
            <li><strong>Take 2 veggies</strong> from any slots in the market. If only one veggie remains, take that one.</li>
        </ul>
        <p>Select cards, then use the matching Take button. Tap a selected card again to deselect it. Click blank space around the cards or press Esc to cancel your selections.</p>
        <h3>Optional flip (↪)</h3>
        <p>On your turn, select any of your scoring cards to flip to their veggie sides. The back is shown on each card. Selected flips are applied together with your next Take action. You lose the scoring rule and gain the shown veggie; this cannot be reversed.</p>
        <h3>Reading point cards</h3>
        <ul>
            <li><strong>Per veggie:</strong> gain or lose the shown points for each matching veggie. A +1 card adds one point per listed veggie.</li>
            <li><strong>Set:</strong> score for each complete set of the shown veggies.</li>
            <li><strong>Variety:</strong> score once if you own at least the required number of different veggie types.</li>
            <li><strong>Even / odd:</strong> score according to the count of the shown veggie. Zero is even.</li>
            <li><strong>Most / fewest:</strong> compare that veggie with every player. Tied players all qualify.</li>
            <li><strong>Groups:</strong> score for each complete group of the required size.</li>
        </ul>
        <h3>Market & game end</h3>
        <p>Each market column refills from the pile above it. If that pile is empty, cards come from the largest remaining pile. When every pile and market slot is empty, the highest score wins; tied players share the win.</p>
        <p>Scores update after each turn. Use Explain (🔎), then select a card, counter or action for more detail. Disabled actions can also be explained. Hover over collection icons, or tap them on a phone, for a brief description.</p>
    `;
    const staticExplanations = {
        piles: { title: "Point cards", text: "Choose the top card of pile A, B or C, then select Take point card. The new card scores your veggie collection. The number on each pile is its remaining card count." },
        market: { title: "Veggie market", text: "Choose any 2 veggies, then select Take veggies. If only one is left, take that one. Each column refills from the pile above it, or the largest remaining pile if that pile is empty." },
        takePoint: { title: "Take point card", text: "Confirm the selected point card. Select a nonempty pile first. This action is available only on your turn. Any selected flips (↪) are applied with this action." },
        takeVeggies: { title: "Take veggies", text: "Confirm your selected veggies. Choose 2, or 1 if it is the last veggie in the market. This action is available only on your turn. Any selected flips (↪) are applied with this action." },
        remaining: { title: "Cards remaining", text: "The total number of cards still in the three piles and the veggie market. When this reaches zero, the game ends and the highest score wins." },
        score: { title: "Points (pts)", text: "The current total from all of this player's scoring cards. Every scoring card uses the same veggie collection. Scores update after each turn; most/fewest cards can change when other players gain veggies." },
    };

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function icon(veggie) { return veggies[veggie] || "🥗"; }
    function veggieName(veggie) { return `${veggie} (${icon(veggie)})`; }
    function playerName(playerId) {
        const player = view?.players.find(entry => entry.player_id === playerId);
        return player?.name || playerId || "Player";
    }
    function canAct(type) { return !!view && !view.game_over && (view.legal_actions || []).includes(type); }
    function requiredVeggies() { return view?.market.filter(Boolean).length === 1 ? 1 : 2; }

    function setTip(node, text) {
        node.dataset.pointSaladTip = text;
        node.tabIndex = 0;
        node.setAttribute("aria-label", text);
    }

    function explainable(node, explanation) {
        node.dataset.pointSaladExplain = "card";
        explanations.set(node, explanation);
    }

    function describeRule(card) {
        const rule = card.rule || {};
        const target = veggieName(rule.target);
        const targets = (rule.targets || []).map(veggieName).join(", ");
        switch (rule.type) {
            case "WEIGHT": return Object.entries(rule.weights || {}).map(([veg, value]) => `${value >= 0 ? "Gain" : "Lose"} ${Math.abs(value)} points for each ${veggieName(veg)}.`).join(" ");
            case "SUM": return `Gain 1 point for each of these veggies: ${targets}.`;
            case "SET": return `Gain ${rule.points} points per complete set containing one of each: ${targets}.`;
            case "VARIETY": return `Gain ${rule.points} points once if you have at least ${rule.min_types} different veggie types; otherwise score 0.`;
            case "PARITY": return `Count your ${target}. ${rule.mode === "EVEN" ? "Even" : "Odd"} counts score ${rule.points} points; ${rule.mode === "EVEN" ? "odd" : "even"} counts score ${rule.fallback}. Zero is even.`;
            case "COMPARE": return `Gain ${rule.points} points if you have the ${rule.mode === "MOST" ? "most" : "fewest"} ${target} among all players; otherwise score 0. Ties qualify.`;
            case "THRESHOLD": return `Gain ${rule.points} points for each complete group of ${rule.count} ${target}. Leftovers score 0.`;
            default: return card.label || "A point card adds a scoring rule to your salad.";
        }
    }

    function ruleDisplay(card) {
        const rule = card.rule || {};
        switch (rule.type) {
            case "WEIGHT": return { name: "Per veggie", terms: Object.entries(rule.weights || {}).map(([veg, value]) => `${value >= 0 ? "+" : "−"}${Math.abs(value)} ${icon(veg)}`), note: "points each" };
            case "SUM": return { name: "Per veggie", terms: (rule.targets || []).map(veg => `+1 ${icon(veg)}`), note: "points each" };
            case "SET": return { name: "Set", terms: (rule.targets || []).map(veg => icon(veg)), note: `${rule.points} pts / set` };
            case "VARIETY": return { name: "Variety", terms: [`${rule.min_types} types`], note: `${rule.points} pts if reached` };
            case "PARITY": return { name: rule.mode === "EVEN" ? "Even" : "Odd", terms: [`${icon(rule.target)} ${rule.points} pts`], note: `${rule.mode === "EVEN" ? "Odd" : "Even"}: ${rule.fallback} pts` };
            case "COMPARE": return { name: rule.mode === "MOST" ? "Most" : "Fewest", terms: [`${icon(rule.target)} ${rule.points} pts`], note: "ties count" };
            case "THRESHOLD": return { name: "Groups", terms: [`${rule.count} × ${icon(rule.target)}`], note: `${rule.points} pts / group` };
            default: return { name: "Point card", terms: [card.label || "—"], note: "" };
        }
    }

    function renderRule(card) {
        const display = ruleDisplay(card);
        const rule = element("span", "point-salad-rule");
        rule.setAttribute("aria-hidden", "true");
        rule.append(element("span", "point-salad-rule-type", display.name));
        const symbols = element("span", "point-salad-rule-symbols");
        display.terms.forEach(term => symbols.append(element("span", "point-salad-rule-term", term)));
        rule.append(symbols, element("span", "point-salad-rule-note", display.note));
        return rule;
    }

    function renderPiles() {
        ui.Piles.replaceChildren();
        (view.piles || []).forEach((pile, index) => {
            const button = element("button", "point-salad-card point-salad-pile");
            button.type = "button";
            button.dataset.pile = index;
            button.disabled = !pile?.top || !canAct("take_point");
            const top = element("span", "point-salad-card-top");
            top.append(element("strong", "", `Pile ${String.fromCharCode(65 + index)}`), element("span", "", `${pile?.count || 0} left`));
            button.append(top);
            if (pile?.top) {
                button.append(renderRule(pile.top), element("span", "point-salad-pick-indicator", "Select"));
                const text = describeRule(pile.top);
                button.setAttribute("aria-label", `Pile ${String.fromCharCode(65 + index)}. ${text} ${pile.count} cards left.`);
                explainable(button, { title: `Pile ${String.fromCharCode(65 + index)} · ${ruleDisplay(pile.top).name}`, text, note: "Select this pile, then Take point card to add this scoring rule to your salad." });
                button.addEventListener("click", () => {
                    if (!canAct("take_point")) return;
                    selectedPile = selectedPile === index ? null : index;
                    selectedMarket = [];
                    updateSelections();
                });
            } else {
                button.classList.add("empty");
                button.append(element("span", "", "Empty pile"));
                explainable(button, { title: "Empty pile", text: "There are no point cards left in this pile. Choose another available pile or take veggies from the market." });
            }
            ui.Piles.append(button);
        });
    }

    function renderMarket() {
        ui.Market.replaceChildren();
        (view.market || []).forEach((card, index) => {
            const button = element("button", "point-salad-card point-salad-veggie-card");
            button.type = "button";
            button.dataset.position = index;
            button.disabled = !card || !canAct("take_veggies");
            const emoji = element("span", "point-salad-veggie-icon", card ? icon(card.veggie) : "·");
            emoji.setAttribute("aria-hidden", "true");
            button.append(emoji, element("span", "point-salad-veggie-name", card?.veggie || "Empty"), element("span", "point-salad-pick-indicator", card ? "Select" : "—"));
            if (card) {
                button.dataset.pointSaladVeggie = card.veggie;
                button.setAttribute("aria-label", `${veggieName(card.veggie)}, market slot ${index + 1}`);
                explainable(button, { title: veggieName(card.veggie), text: "This adds one veggie to your collection. It counts toward every applicable scoring card you own.", note: "Choose 2 veggies from the market, or 1 if it is the last one, then confirm with Take veggies." });
                button.addEventListener("click", () => {
                    if (!canAct("take_veggies")) return;
                    selectedPile = null;
                    if (selectedMarket.includes(index)) selectedMarket = selectedMarket.filter(pos => pos !== index);
                    else selectedMarket = [...selectedMarket, index].slice(-requiredVeggies());
                    updateSelections();
                });
            } else {
                button.classList.add("empty");
                explainable(button, { title: "Empty market slot", text: "This slot has no veggie left to take." });
            }
            ui.Market.append(button);
        });
        ui.MarketCount.textContent = `Take ${requiredVeggies()}`;
    }

    function renderVeggies(container, player) {
        container.replaceChildren();
        (view.veggies || Object.keys(veggies)).forEach(veg => {
            const count = player.veggies?.[veg] || 0;
            const chip = element("div", "point-salad-veggie-count");
            chip.dataset.pointSaladVeggie = veg;
            chip.append(element("span", "", icon(veg)), element("strong", "", count));
            const text = `${veggieName(veg)} · ${count} in ${player.name || "this player"}'s salad.`;
            setTip(chip, text);
            explainable(chip, { title: veggieName(veg), text, note: "These veggies count toward all of this player's applicable scoring cards." });
            container.append(chip);
        });
    }

    function renderOwnedCards(container, player, own) {
        const scroll = container.scrollTop;
        container.replaceChildren();
        if (!player.point_cards?.length) {
            const empty = element("div", "point-salad-empty-state");
            const emoji = element("span", "", "🥗");
            emoji.setAttribute("aria-hidden", "true");
            empty.append(emoji, document.createTextNode("No scoring cards yet"));
            container.append(empty);
        }
        (player.point_cards || []).forEach(card => {
            const node = element(own ? "button" : "div", "point-salad-card point-salad-owned-card");
            const text = describeRule(card);
            node.append(renderRule(card));
            const back = card.veggie ? `Back: ${veggieName(card.veggie)}.` : "";
            const bottom = element("span", "point-salad-card-bottom");
            if (card.veggie) {
                bottom.append(element("span", "", `${icon(card.veggie)} ${card.veggie}`));
            }
            if (own) {
                node.type = "button";
                node.dataset.flipId = card.id;
                node.disabled = !canAct("take_point") && !canAct("take_veggies");
                node.setAttribute("aria-label", `${text} ${back} Select to flip with your next Take action.`);
                bottom.append(element("span", "point-salad-pick-indicator", "↪ Flip"));
                node.addEventListener("click", () => {
                    if (node.disabled) return;
                    if (selectedFlips.has(card.id)) selectedFlips.delete(card.id);
                    else selectedFlips.add(card.id);
                    updateSelections();
                });
            } else {
                node.classList.add("readonly");
                setTip(node, `${text} ${back}`);
            }
            if (bottom.childNodes.length) node.append(bottom);
            explainable(node, { title: `${ruleDisplay(card).name} · Point card`, text, note: own ? `${back} Flip (↪) trades this scoring rule for the shown veggie. Select it, then confirm your Take action. Flips are one-way.` : back });
            container.append(node);
        });
        container.scrollTop = scroll;
    }

    function renderPlayers() {
        const own = view.players.find(player => player.player_id === view.you);
        ui.OwnPanel.classList.toggle("hidden", !own);
        ui.Workspace.classList.toggle("spectating", !own);
        if (own) {
            ui.OwnScore.textContent = `${own.score ?? 0} pts`;
            setTip(ui.OwnScore, `Points (pts): ${own.score ?? 0}. Your current score from all scoring cards.`);
            ui.OwnCardCount.textContent = `· ${own.point_cards.length}`;
            ui.FlipHint.textContent = view.game_over ? "Final collection" : canAct("take_point") || canAct("take_veggies") ? "Select to flip" : "Flip on your turn";
            renderVeggies(ui.OwnVeggies, own);
            renderOwnedCards(ui.OwnCards, own, true);
        }
        const openPlayers = new Set([...ui.Players.querySelectorAll("details[open]")].map(node => node.dataset.playerId));
        const listScrolls = new Map([...ui.Players.querySelectorAll("details")].map(node => [node.dataset.playerId, node.querySelector(".point-salad-card-list").scrollTop]));
        ui.Players.replaceChildren();
        ui.PlayerCount.textContent = `${view.players.length} players`;
        view.players.filter(player => player !== own).forEach(player => {
            const panel = element("article", "point-salad-player");
            panel.classList.toggle("current", !view.game_over && player.player_id === view.current_turn);
            panel.classList.toggle("winner", view.winner?.includes(player.player_id));
            const header = element("div", "point-salad-player-header");
            const info = element("div");
            info.append(element("div", "point-salad-player-name", player.name || player.player_id));
            const badges = element("div", "point-salad-player-badges");
            if (!view.game_over && player.player_id === view.current_turn) badges.append(element("span", "point-salad-player-badge", "Playing"));
            if (player.is_bot) badges.append(element("span", "point-salad-player-badge", "Bot"));
            if (view.winner?.includes(player.player_id)) badges.append(element("span", "point-salad-player-badge", "Winner"));
            info.append(badges);
            const score = element("span", "point-salad-score", `${player.score ?? 0} pts`);
            score.dataset.pointSaladExplain = "score";
            setTip(score, `Points (pts): ${player.score ?? 0}. Current score from this player's scoring cards.`);
            header.append(info, score);
            const collection = element("div", "point-salad-veggie-counts");
            renderVeggies(collection, player);
            const details = element("details");
            details.dataset.playerId = player.player_id;
            details.open = openPlayers.has(player.player_id);
            const summary = element("summary", "", `${player.point_cards.length} scoring cards`);
            explainable(summary, { title: "Scoring cards", text: "Expand this player's collection to inspect their scoring rules. Their veggie backs are hidden until the game ends." });
            const cards = element("div", "point-salad-card-list");
            renderOwnedCards(cards, player, false);
            details.append(summary, cards);
            panel.append(header, collection, details);
            ui.Players.append(panel);
            cards.scrollTop = listScrolls.get(player.player_id) || 0;
        });
    }

    function clearSelections() {
        selectedPile = null;
        selectedMarket = [];
        selectedFlips.clear();
        updateSelections();
    }

    function updateSelections() {
        ui.Piles.querySelectorAll("[data-pile]").forEach(node => {
            const selected = Number(node.dataset.pile) === selectedPile;
            node.classList.toggle("selected", selected);
            node.setAttribute("aria-pressed", String(selected));
            const label = node.querySelector(".point-salad-pick-indicator");
            if (label) label.textContent = selected ? "✓ Selected" : "Select";
        });
        ui.Market.querySelectorAll("[data-position]").forEach(node => {
            const selected = selectedMarket.includes(Number(node.dataset.position));
            node.classList.toggle("selected", selected);
            node.setAttribute("aria-pressed", String(selected));
            node.querySelector(".point-salad-pick-indicator").textContent = selected ? "✓ Selected" : node.classList.contains("empty") ? "—" : "Select";
        });
        ui.OwnCards.querySelectorAll("[data-flip-id]").forEach(node => {
            const selected = selectedFlips.has(Number(node.dataset.flipId));
            node.classList.toggle("selected", selected);
            node.setAttribute("aria-pressed", String(selected));
            node.querySelector(".point-salad-pick-indicator").textContent = selected ? "✓ Will flip" : "↪ Flip";
        });
        const required = requiredVeggies();
        ui.TakePointBtn.disabled = !canAct("take_point") || selectedPile === null;
        ui.TakeVeggiesBtn.disabled = !canAct("take_veggies") || selectedMarket.length !== required;
        ui.TakeVeggiesBtn.textContent = `Take ${required} ${required === 1 ? "veggie" : "veggies"}`;
        if (!view) ui.Selection.textContent = "Waiting for the game to start";
        else if (view.game_over) ui.Selection.textContent = "The salad is complete";
        else if (!canAct("take_point") && !canAct("take_veggies")) ui.Selection.textContent = `Waiting for ${playerName(view.current_turn)}`;
        else if (selectedPile !== null) ui.Selection.textContent = `Pile ${String.fromCharCode(65 + selectedPile)} selected`;
        else if (selectedMarket.length) ui.Selection.textContent = `${selectedMarket.map(pos => icon(view.market[pos].veggie)).join(" + ")} · ${selectedMarket.length} of ${required} selected`;
        else ui.Selection.textContent = `Choose a point card or ${required} ${required === 1 ? "veggie" : "veggies"}`;
        ui.SelectedFlips.classList.toggle("hidden", selectedFlips.size === 0);
        ui.SelectedFlips.textContent = `${selectedFlips.size} ${selectedFlips.size === 1 ? "flip" : "flips"} queued · applies with your pick`;
    }

    function submit(type) {
        if (!canAct(type)) return;
        if (type === "take_point" && selectedPile === null) return;
        if (type === "take_veggies" && selectedMarket.length !== requiredVeggies()) return;
        const action = type === "take_point" ? { type, pile_index: selectedPile } : { type, positions: [...selectedMarket] };
        if (selectedFlips.size) action.flip_ids = [...selectedFlips];
        sendAction(action);
        clearSelections();
    }

    function renderPointSaladGameState(data) {
        if (!data?.view) return;
        const previous = view;
        view = data.view;
        if (currentGameType !== "point_salad") {
            currentGameType = "point_salad";
            setGamePanelVisibility("point_salad");
        }
        hideTooltip();
        if (previous?.current_turn !== view.current_turn || previous?.you !== view.you || view.game_over) clearSelections();
        if (!view.piles[selectedPile]?.top || previous?.piles[selectedPile]?.top?.id !== view.piles[selectedPile]?.top?.id) selectedPile = null;
        selectedMarket = selectedMarket.filter(pos => view.market[pos]?.id === previous?.market[pos]?.id);
        const ownIds = new Set((view.players.find(player => player.player_id === view.you)?.point_cards || []).map(card => card.id));
        selectedFlips.forEach(id => { if (!ownIds.has(id)) selectedFlips.delete(id); });
        const yourTurn = !view.game_over && view.current_turn === view.you;
        ui.Panel.classList.toggle("game-over", !!view.game_over);
        ui.Status.classList.toggle("your-turn", yourTurn);
        ui.Phase.textContent = view.game_over ? "All cards collected" : yourTurn ? "Make your next pick" : "Fresh from the market";
        ui.Turn.textContent = view.game_over ? "Final scores" : yourTurn ? "Your turn" : `${playerName(view.current_turn)}'s turn`;
        const remaining = view.piles.reduce((total, pile) => total + (pile?.count || 0), 0) + view.market.filter(Boolean).length;
        ui.Remaining.textContent = `${remaining} cards left`;
        setTip(ui.Remaining, `${remaining} cards remain across the piles and market.`);
        ui.Winner.classList.toggle("hidden", !view.game_over);
        ui.Winner.textContent = view.game_over ? `🏆 ${view.winner.map(playerName).join(" & ")} ${view.winner.length > 1 ? "win" : "wins"}!` : "";
        renderPiles();
        renderMarket();
        renderPlayers();
        updateSelections();
        updateExplainMode();
        logGameEvents(data);
    }

    function clearPointSaladState() {
        view = null;
        clearSelections();
        exitExplainMode();
        hideTooltip();
        closeModal(ui.HelpModal);
        closeModal(ui.ExplainModal);
        ui.Panel.classList.remove("game-over");
        ui.Status.classList.remove("your-turn");
        ui.Turn.textContent = "Waiting for players";
        ui.Phase.textContent = "Fresh from the market";
        ui.Winner.classList.add("hidden");
        ui.Remaining.textContent = "";
        delete ui.Remaining.dataset.pointSaladTip;
        ui.Remaining.removeAttribute("aria-label");
        ui.PlayerCount.textContent = "";
        ui.OwnScore.textContent = "0 pts";
        delete ui.OwnScore.dataset.pointSaladTip;
        ui.OwnScore.removeAttribute("aria-label");
        ui.OwnCardCount.textContent = "";
        ui.OwnPanel.classList.remove("hidden");
        ui.Workspace.classList.remove("spectating");
        [ui.Piles, ui.Market, ui.OwnCards, ui.OwnVeggies, ui.Players].forEach(node => node.replaceChildren());
    }

    function showTooltip(target) {
        if (explainMode || !target?.dataset.pointSaladTip) return;
        hideTooltip();
        tooltipAnchor = target;
        ui.Tooltip.textContent = target.dataset.pointSaladTip;
        ui.Tooltip.classList.remove("hidden");
        target.setAttribute("aria-describedby", "pointSaladTooltip");
        const rect = target.getBoundingClientRect();
        const tip = ui.Tooltip.getBoundingClientRect();
        const left = Math.max(12, Math.min(innerWidth - tip.width - 12, rect.left + rect.width / 2 - tip.width / 2));
        const top = rect.top >= tip.height + 20 ? rect.top - tip.height - 8 : Math.min(innerHeight - tip.height - 12, rect.bottom + 8);
        ui.Tooltip.style.left = `${left}px`;
        ui.Tooltip.style.top = `${Math.max(12, top)}px`;
        tooltipTimer = setTimeout(hideTooltip, 3000);
    }

    function hideTooltip() {
        clearTimeout(tooltipTimer);
        tooltipAnchor?.removeAttribute("aria-describedby");
        tooltipAnchor = null;
        ui.Tooltip.classList.add("hidden");
    }

    function openModal(modal) {
        hideTooltip();
        exitExplainMode();
        modalReturnFocus = document.activeElement;
        setModalVisible(modal, true);
        modal.querySelector("button").focus({ preventScroll: true });
    }

    function closeModal(modal) {
        if (modal.classList.contains("hidden")) return;
        setModalVisible(modal, false);
        if (modalReturnFocus?.isConnected) modalReturnFocus.focus({ preventScroll: true });
        modalReturnFocus = null;
    }

    function updateExplainMode() {
        document.body.classList.toggle("point-salad-explain-mode", explainMode);
        ui.ExplainBtn.classList.toggle("active", explainMode);
        ui.ExplainBtn.setAttribute("aria-pressed", String(explainMode));
        ui.ExplainHint.classList.toggle("hidden", !explainMode);
        ui.Panel.querySelectorAll("[data-point-salad-explain]").forEach(node => node.classList.toggle("point-salad-has-explanation", explainMode));
    }

    function exitExplainMode() { explainMode = false; updateExplainMode(); }

    function showExplanation(target) {
        const explanation = explanations.get(target) || staticExplanations[target.dataset.pointSaladExplain];
        if (!explanation) return;
        ui.ExplainContent.replaceChildren(element("h4", "", explanation.title), element("p", "", explanation.text));
        if (explanation.note) ui.ExplainContent.append(element("p", "", explanation.note));
        openModal(ui.ExplainModal);
    }

    function showPointSaladHeaderActions(show) {
        ui.HeaderActions.style.display = show ? "flex" : "none";
        if (!show) {
            exitExplainMode();
            hideTooltip();
            closeModal(ui.HelpModal);
            closeModal(ui.ExplainModal);
        }
    }

    ui.HelpBtn.setAttribute("aria-label", "Point Salad help");
    ui.HelpBtn.title = "Help";
    ui.ExplainBtn.setAttribute("aria-label", "Explain a Point Salad item");
    ui.ExplainBtn.title = "Explain";
    ui.ExplainBtn.setAttribute("aria-pressed", "false");
    ui.HelpBtn.addEventListener("click", () => { ui.HelpContent.innerHTML = helpText; openModal(ui.HelpModal); });
    ui.ExplainBtn.addEventListener("click", () => { hideTooltip(); explainMode = !explainMode; updateExplainMode(); });
    ui.TakePointBtn.addEventListener("click", () => submit("take_point"));
    ui.TakeVeggiesBtn.addEventListener("click", () => submit("take_veggies"));
    [ui.HelpModal, ui.ExplainModal].forEach(modal => {
        modal.querySelector("button").addEventListener("click", () => closeModal(modal));
        modal.addEventListener("click", event => { if (event.target === modal) closeModal(modal); });
    });

    ui.Panel.addEventListener("click", event => {
        if (explainMode) return;
        const tip = event.target.closest("[data-point-salad-tip]");
        if (tip) { showTooltip(tip); return; }
        hideTooltip();
        if (!event.target.closest("button, summary")) clearSelections();
    });
    ui.Panel.addEventListener("pointerover", event => {
        if (event.pointerType === "mouse") showTooltip(event.target.closest("[data-point-salad-tip]"));
    });
    ui.Panel.addEventListener("pointerout", event => {
        if (event.pointerType === "mouse" && tooltipAnchor && !tooltipAnchor.contains(event.relatedTarget)) hideTooltip();
    });
    ui.Panel.addEventListener("focusin", event => showTooltip(event.target.closest("[data-point-salad-tip]")));
    ui.Panel.addEventListener("focusout", hideTooltip);
    window.addEventListener("resize", hideTooltip);
    document.addEventListener("scroll", hideTooltip, true);

    function isExplainControl(target) {
        return !!target.closest("#pointSaladHelpBtn, #pointSaladExplainBtn, #pointSaladHelpModal, #pointSaladExplainModal");
    }

    // Pointer capture reaches disabled controls. Suppress the ensuing click even
    // after opening the explanation has exited Explain mode.
    document.addEventListener("pointerdown", event => {
        suppressClick = false;
        if (!explainMode || isExplainControl(event.target)) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-point-salad-explain]");
        if (target && ui.Panel.contains(target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            suppressClick = true;
            showExplanation(target);
        } else if (event.target.closest("button, summary, input, select, a")) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    document.addEventListener("click", event => {
        if (suppressClick) {
            suppressClick = false;
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (!explainMode || isExplainControl(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = event.target.closest("[data-point-salad-explain]");
        if (target && ui.Panel.contains(target)) showExplanation(target);
    }, true);
    document.addEventListener("pointerup", () => {
        if (suppressClick) setTimeout(() => { suppressClick = false; }, 0);
    }, true);
    document.addEventListener("pointercancel", () => { suppressClick = false; }, true);
    document.addEventListener("keydown", event => {
        if (currentGameType !== "point_salad") return;
        suppressClick = false;
        const modal = [ui.HelpModal, ui.ExplainModal].find(node => !node.classList.contains("hidden"));
        if (modal && event.key === "Tab") {
            const first = modal.querySelector("button");
            const last = modal.querySelector(".modal-body");
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
        if (event.key === "Escape") {
            if (modal) closeModal(modal);
            else if (explainMode) exitExplainMode();
            else clearSelections();
            hideTooltip();
            event.preventDefault();
        } else if ((event.key === "Enter" || event.key === " ") && !event.target.closest("button, summary, input, select, textarea")) {
            const target = event.target.closest("[data-point-salad-explain], [data-point-salad-tip]");
            if (target) {
                event.preventDefault();
                if (explainMode) showExplanation(target);
                else showTooltip(target);
            }
        }
    }, true);

    // The asset loader installs the markup first, then replays the latest room
    // and game state through these hooks, including after DOMContentLoaded.
    window.renderPointSaladGameState = renderPointSaladGameState;
    window.clearPointSaladState = clearPointSaladState;
    window.showPointSaladHeaderActions = showPointSaladHeaderActions;
    showPointSaladHeaderActions(currentGameType === "point_salad");
})();
