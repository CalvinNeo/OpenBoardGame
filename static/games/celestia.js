(() => {
    "use strict";

    const byId = suffix => document.getElementById(`celestia${suffix}`);
    const panel = byId("Panel");
    let view = null;
    let selectedCardId = null;
    let selectedTarget = null;
    let selectedDice = [];
    let explaining = false;
    let suppressClickUntil = 0;
    let tooltipTimer = null;
    let modalReturnFocus = null;
    let selectionContext = null;

    const hazards = {
        cloud: ["☁️", "Cloud", "compass"],
        lightning: ["⚡", "Lightning", "lightning_rod"],
        bird: ["🐦", "Bird", "foghorn"],
        pirate: ["🏴‍☠️", "Pirate", "cannon"],
        blank: ["⬜", "Blank", null],
    };
    const cards = {
        compass: ["🧭", "Compass", "Covers Cloud (☁️)", "Equipment: covers one Cloud (☁️) die."],
        lightning_rod: ["⚡", "Lightning Arrester", "Covers Lightning (⚡)", "Equipment: covers one Lightning (⚡) die."],
        foghorn: ["📯", "Foghorn", "Covers Bird (🐦)", "Equipment: covers one Bird (🐦) die."],
        cannon: ["💣", "Cannon", "Covers Pirate (🏴‍☠️)", "Equipment: covers one Pirate (🏴‍☠️) die."],
        turbo: ["🛠️", "Turbo", "Covers any hazard", "Covers one hazard of any type when matching equipment is missing. You may save it and let the airship crash instead."],
        alternative_route: ["🗺️", "Alternative Route", "Reroll chosen dice", "During the reroll window, the captain selects one or more dice and plays this card to reroll them."],
        wind_gust: ["🌪️", "Wind Gust", "Reroll blank dice", "During the reroll window, any player aboard may play this to reroll every Blank (⬜) die."],
        ejection: ["🪂", "Ejection", "Send a passenger ashore", "During the ejection window, choose a passenger aboard, including yourself, but never the captain. They leave and collect current-city treasure (💎)."],
        jetpack: ["🎒", "Jetpack", "Collect treasure after a crash", "After a crash, spend this card to collect treasure (💎) from the current city, or skip to save it."],
    };
    const phaseLabels = {
        roll: "Takeoff", reroll_window: "Reroll window", passenger_choice: "Passenger decision",
        ejection_window: "Ejection window", captain_action: "Captain's turn", jetpack_window: "Airship crashed",
        journey_end: "Journey complete", game_over: "Game over",
    };
    const explanations = {
        RollBtn: ["Roll dice (🎲)", "The captain rolls the required dice for the next city to reveal its hazards."],
        StayBtn: ["Stay aboard", "Continue toward the next city. You receive no treasure if the airship crashes unless you use a Jetpack (🎒)."],
        LeaveBtn: ["Take treasure (💎)", "Leave the airship and collect treasure from the current city. If you are the only player aboard, this ends the journey safely."],
        PassSpecialBtn: ["Continue", "Pass this power-card window. The game continues once all eligible players pass; playing a power card resets those passes."],
        ResolveCardsBtn: ["Use equipment", "Automatically spend matching equipment for each hazard, then Turbo (🛠️) for any missing matches. No hand-card selection is needed."],
        ResolveTelescopeBtn: ["Magic Spyglass (🔭)", "Spend a Magic Spyglass treasure to resolve all hazards. This is only available when matching equipment alone cannot cover the dice; it can save your Turbo (🛠️)."],
        CrashBtn: ["Airship crashes", "Declare a crash when matching equipment alone is insufficient. You may save Turbo (🛠️) or Magic Spyglass (🔭). Players still aboard only receive treasure if they use Jetpack (🎒)."],
        JetpackUseBtn: ["Use Jetpack (🎒)", "Spend one Jetpack after the crash and collect treasure (💎) from the current city."],
        JetpackSkipBtn: ["Skip Jetpack (🎒)", "Save your Jetpack. You collect no treasure from this crash."],
        PlayPowerBtn: ["Play power card", "Play the selected card. Alternative Route (🗺️) requires selected dice; Ejection (🪂) requires a passenger aboard."],
        NextJourneyBtn: ["Next journey", "Confirm that you have reviewed the summary. The next journey begins only after every player is ready."],
        PlayAgainBtn: ["Play again", "Start a new game after the final result."],
    };
    const help = `
        <h3>Collect treasures above the clouds</h3>
        <p>Travel through nine cities and collect Treasures (💎). At the end of a journey, reaching the target score ends the game. The highest score wins; ties favor the player with fewer treasure cards.</p>
        <h3>A flight, step by step</h3>
        <ol><li>The Captain (🧭) rolls Dice (🎲) for the next city. A Blank (⬜) creates no hazard.</li>
        <li>Players may use Alternative Route (🗺️) or Wind Gust (🌪️), then passengers decide in order: stay aboard or take current-city treasure (💎).</li>
        <li>Players may use Ejection (🪂). The captain then resolves hazards with equipment, Turbo (🛠️), or Magic Spyglass (🔭).</li>
        <li>A successful flight reaches the next city and passes the captain's role to the next player aboard. A crash ends the journey; Jetpack (🎒) users can still take treasure.</li></ol>
        <h3>Equipment and hazards</h3>
        <p>Compass (🧭) covers Cloud (☁️); Lightning Arrester (⚡) covers Lightning (⚡); Foghorn (📯) covers Bird (🐦); Cannon (💣) covers Pirate (🏴‍☠️). Each card covers one matching die.</p>
        <p>Use equipment automatically spends matching cards, then Turbo (🛠️) for missing matches. If matching equipment alone is insufficient, you may instead spend a Magic Spyglass (🔭), or let the airship crash to save special cards.</p>
        <h3>Power cards</h3>
        <p>Alternative Route (🗺️): the captain selects dice to reroll. Wind Gust (🌪️): reroll all Blank (⬜) dice. Ejection (🪂): select a passenger aboard, including yourself but never the captain, to send ashore with treasure. Jetpack (🎒): collect treasure after a crash.</p>
        <h3>Journeys and controls</h3>
        <p>The last player aboard can take treasure instead of rolling. Reaching City 9 awards treasure to everyone still aboard. Review the journey summary and select Next journey; everyone must be ready before the game continues.</p>
        <p>Identical hand cards share one tile with a quantity. Only playable power cards can be selected. Select a card, choose any required dice or passenger, then confirm below your hand. Click the card again, click empty space, or press Esc to cancel the selection.</p>
        <p>Hover over information for a short tooltip; on a phone, tap it for a three-second tooltip. Select Explain and then an item or button for more detail, including disabled buttons. Esc exits Explain or closes a dialog.</p>`;

    function text(suffix, value) {
        byId(suffix).textContent = value;
    }
    function element(tag, className, value) {
        const node = document.createElement(tag);
        node.className = className;
        if (value != null) node.textContent = value;
        return node;
    }
    function name(id) {
        return view?.players?.find(player => player.player_id === id)?.name || id || "—";
    }
    function has(action) {
        if (!view?.legal_actions?.includes(action)) return false;
        // The public action list can still include special actions after passing.
        return !(["play_power", "pass_special"].includes(action) && view.special_passes?.includes(view.you));
    }
    function selectedCard() {
        return view?.your_hand?.find(card => card.id === selectedCardId);
    }
    function powerPlayable(card) {
        if (!card || !has("play_power")) return false;
        if (view.phase === "reroll_window") {
            return (card.kind === "alternative_route" && view.you === view.captain)
                || (card.kind === "wind_gust" && view.dice_results?.includes("blank"));
        }
        return view.phase === "ejection_window" && card.kind === "ejection"
            && view.players.some(player => player.on_ship && player.player_id !== view.captain);
    }
    function targetable(player) {
        return selectedCard()?.kind === "ejection" && powerPlayable(selectedCard())
            && player.on_ship && player.player_id !== view.captain;
    }
    function powerReady() {
        const card = selectedCard();
        if (!powerPlayable(card)) return false;
        if (card.kind === "alternative_route") return selectedDice.length > 0;
        if (card.kind === "ejection") return view.players.some(player => player.player_id === selectedTarget && targetable(player));
        return true;
    }
    function resolution() {
        const counts = {};
        for (const card of view?.your_hand || []) counts[card.kind] = (counts[card.kind] || 0) + 1;
        let missing = 0;
        for (const [hazard, info] of Object.entries(hazards)) {
            if (info[2]) missing += Math.max(0, (view?.hazard_counts?.[hazard] || 0) - (counts[info[2]] || 0));
        }
        return {
            cards: has("captain_resolve") && missing <= (counts.turbo || 0),
            spyglass: has("captain_resolve") && missing > 0 && view.your_treasures?.some(card => card.kind === "telescope"),
        };
    }
    function describe(node, title, description, tooltip = description) {
        node.dataset.celestiaExplainTitle = title;
        node.dataset.celestiaExplainText = description;
        if (tooltip) node.dataset.celestiaTooltip = tooltip;
        if (node.tagName !== "BUTTON") node.tabIndex = 0;
        node.classList.toggle("has-explanation", explaining);
        return node;
    }
    function renderRoute() {
        const route = byId("Route");
        route.replaceChildren();
        for (let city = 1; city <= 9; city += 1) {
            const current = city === view.current_city;
            const next = city === view.next_city;
            const dice = city <= 4 ? 2 : city <= 7 ? 3 : 4;
            const count = view.treasure_counts?.[String(city)] ?? "—";
            const tile = element("div", `celestia-city${current ? " current" : next ? " next" : ""}`);
            if (current) tile.setAttribute("aria-current", "step");
            tile.append(element("span", "celestia-city-name", String(city)));
            tile.append(element("span", "celestia-city-meta", current ? "Aboard" : next ? "Next" : `${dice}🎲`));
            describe(tile, `City ${city}`, `${current ? "The airship is here. " : next ? "Your next destination. " : ""}${count} treasure cards (💎) remain. ${dice} dice (🎲) are rolled when approaching this city.`);
            route.append(tile);
        }
    }
    function renderDice() {
        const container = byId("Dice");
        container.replaceChildren();
        const canSelect = selectedCard()?.kind === "alternative_route" && powerPlayable(selectedCard());
        if (!view.dice_results?.length) {
            container.append(element("div", "celestia-empty", `${view.required_dice || 2} dice ready for takeoff`));
            return;
        }
        view.dice_results.forEach((face, index) => {
            const [icon, label, equipment] = hazards[face] || ["?", face, null];
            const die = element(canSelect ? "button" : "div", `celestia-die${selectedDice.includes(index) ? " selected" : ""}`);
            die.dataset.celestiaDie = String(index);
            die.append(element("span", "celestia-die-icon", icon), element("span", "celestia-die-name", label));
            describe(die, `${label} (${icon})`, equipment
                ? `Cover this hazard with ${cards[equipment][1]} (${cards[equipment][0]}) or Turbo (🛠️).`
                : "Blank (⬜) dice create no hazard and require no equipment.");
            if (canSelect) {
                die.type = "button";
                die.setAttribute("aria-label", `${label} die ${index + 1}: select to reroll`);
                die.setAttribute("aria-pressed", String(selectedDice.includes(index)));
                die.addEventListener("click", () => {
                    selectedDice = selectedDice.includes(index) ? selectedDice.filter(value => value !== index) : [...selectedDice, index];
                    // Keep the same nodes and focus while selecting multiple dice.
                    container.querySelectorAll("[data-celestia-die]").forEach(node => {
                        const selected = selectedDice.includes(Number(node.dataset.celestiaDie));
                        node.classList.toggle("selected", selected);
                        node.setAttribute("aria-pressed", String(selected));
                    });
                    renderSelection();
                });
            }
            container.append(die);
        });
    }
    function renderHand() {
        const container = byId("Hand");
        container.replaceChildren();
        const hand = view.your_hand || [];
        text("HandCount", `${hand.length} cards`);
        const groups = new Map();
        for (const card of hand) {
            if (!groups.has(card.kind)) groups.set(card.kind, []);
            groups.get(card.kind).push(card);
        }
        if (!hand.length) container.append(element("div", "celestia-empty", "No cards in hand"));
        for (const kind of Object.keys(cards)) {
            const group = groups.get(kind);
            if (!group) continue;
            const card = group.find(item => item.id === selectedCardId) || group[0];
            const [icon, title, caption, explanation] = cards[kind];
            const playable = powerPlayable(card);
            const node = element(playable ? "button" : "div", `celestia-card ${card.category || kind}${playable ? " playable" : ""}${card.id === selectedCardId ? " selected" : ""}`);
            node.dataset.celestiaKind = kind;
            node.append(element("span", "celestia-card-icon", icon), element("span", "celestia-card-count", `×${group.length}`),
                element("span", "celestia-card-title", title), element("span", "celestia-card-meta", caption));
            describe(node, `${title} (${icon})`, explanation, `${title} (${icon}) · ${group.length} in hand. ${explanation}`);
            if (playable) {
                node.type = "button";
                node.setAttribute("aria-pressed", String(card.id === selectedCardId));
                node.addEventListener("click", () => {
                    selectedCardId = selectedCardId === card.id ? null : card.id;
                    selectedDice = [];
                    selectedTarget = null;
                    hideTooltip();
                    renderHand();
                    renderDice();
                    renderPlayers();
                    renderSelection();
                    byId("Hand").querySelector(`[data-celestia-kind="${kind}"]`)?.focus({preventScroll: true});
                });
            }
            container.append(node);
        }
    }
    function renderTreasures() {
        const container = byId("Treasures");
        container.replaceChildren();
        const treasures = view.your_treasures || [];
        const spyglasses = treasures.filter(card => card.kind === "telescope").length;
        text("TreasureCount", `${treasures.length}${spyglasses ? ` · 🔭 ${spyglasses}` : ""}`);
        if (!treasures.length) container.append(element("div", "celestia-empty", "No treasures collected yet"));
        for (const card of treasures) {
            const spyglass = card.kind === "telescope";
            const title = spyglass ? "Magic Spyglass (🔭)" : `Treasure (💎) · ${card.points || 0} points`;
            const node = element("div", "celestia-card treasure");
            node.append(element("span", "celestia-card-title", card.label || title), element("span", "celestia-card-meta", `City ${card.city ?? "—"}`));
            describe(node, title, spyglass ? explanations.ResolveTelescopeBtn[1] : `Worth ${card.points || 0} points. Collected at City ${card.city ?? "—"}.`);
            container.append(node);
        }
    }
    function renderPlayers() {
        const container = byId("Players");
        container.replaceChildren();
        for (const player of view.players || []) {
            const isYou = player.player_id === view.you;
            const active = view.phase === "passenger_choice" ? player.player_id === view.pending_passenger
                : ["roll", "captain_action"].includes(view.phase) && player.player_id === view.captain;
            const canTarget = targetable(player);
            const node = element(canTarget ? "button" : "div", `celestia-player${isYou ? " is-you" : ""}${active ? " is-active" : ""}${canTarget ? " playable" : ""}${player.player_id === selectedTarget ? " selected" : ""}`);
            node.dataset.celestiaPlayer = player.player_id;
            node.append(element("div", "celestia-player-name", `${player.name || player.player_id}${isYou ? " · You" : ""}`));
            const tags = [player.player_id === view.captain ? "Captain 🧭" : "Passenger", player.on_ship ? "Aboard" : "Ashore"];
            if (view.phase === "journey_end" && view.next_ready?.includes(player.player_id)) tags.push("Ready ✓");
            else if (view.special_phase && view.special_passes?.includes(player.player_id)) tags.push("Passed ✓");
            else if (active) tags.push("Deciding…");
            node.append(element("div", "celestia-player-status", tags.join(" · ")));
            const score = player.score_hidden ? "🔒" : player.score ?? 0;
            node.append(element("div", "celestia-player-meta", `🃏 ${player.hand_count ?? 0} · 💎 ${player.treasure_count ?? 0} · Score ${score}`));
            describe(node, player.name || player.player_id, `${tags.join(". ")}. Hand (🃏): ${player.hand_count ?? 0} cards. Treasures (💎): ${player.treasure_count ?? 0}. ${player.score_hidden ? "Their score is hidden (🔒) until game end." : `Score: ${score}.`}`);
            if (canTarget) {
                node.type = "button";
                node.setAttribute("aria-pressed", String(player.player_id === selectedTarget));
                node.addEventListener("click", () => {
                    selectedTarget = selectedTarget === player.player_id ? null : player.player_id;
                    container.querySelectorAll("button[data-celestia-player]").forEach(target => {
                        const selected = target.dataset.celestiaPlayer === selectedTarget;
                        target.classList.toggle("selected", selected);
                        target.setAttribute("aria-pressed", String(selected));
                    });
                    renderSelection();
                });
            }
            container.append(node);
        }
    }
    function renderSummary() {
        const summary = view.journey_summary;
        const visible = ["journey_end", "game_over"].includes(view.phase);
        byId("Summary").classList.toggle("hidden", !visible);
        byId("Summary").setAttribute("aria-hidden", String(!visible));
        byId("ReadyStatus").classList.toggle("hidden", view.phase !== "journey_end");
        byId("WinnerStatus").classList.toggle("hidden", !view.winner?.length);
        text("ReadyCount", `${view.next_ready?.length || 0}/${view.players?.length || 0}`);
        text("Winner", view.winner?.map(name).join(", ") || "—");
        if (!visible) return;
        const reasons = {crash: "Airship crashed", finish: "Reached the final city", solo_leave: "Last traveler landed safely", all_left: "All travelers landed"};
        text("SummaryBody", `${reasons[summary?.reason] || "Journey ended"} at City ${summary?.city ?? view.current_city}. Your score: ${view.your_score ?? 0} 💎.`);
        const rewards = byId("SummaryRewards");
        rewards.replaceChildren();
        for (const reward of summary?.rewards || []) {
            const own = reward.player_id === view.you;
            const item = element("div", `celestia-reward${own ? " is-you" : ""}`, `${own ? "You" : name(reward.player_id)} · ${reward.treasure?.label || "No treasure"}`);
            rewards.append(item);
        }
        if (!rewards.childElementCount) rewards.append(element("div", "celestia-empty", "No additional treasure awarded."));
    }
    function renderSelection() {
        const card = selectedCard();
        const visible = powerPlayable(card);
        byId("PowerPrompt").classList.toggle("hidden", !visible);
        byId("PlayPowerBtn").classList.toggle("hidden", !visible);
        byId("PlayPowerBtn").disabled = !powerReady();
        if (!visible) return;
        const title = cards[card.kind][1];
        let caption = `${title} selected`;
        if (card.kind === "alternative_route") caption = selectedDice.length ? `${selectedDice.length} dice selected for reroll` : "Choose dice above to reroll";
        if (card.kind === "ejection") caption = selectedTarget ? `Eject ${name(selectedTarget)}` : "Choose a passenger in Crew";
        text("Selection", caption);
        text("PlayPowerBtn", card.kind === "alternative_route" ? `Reroll${selectedDice.length ? ` ${selectedDice.length} dice` : " dice"}`
            : card.kind === "ejection" ? "Eject passenger" : "Play Wind Gust");
    }
    function renderActions() {
        const resolved = resolution();
        const states = {
            RollBtn: has("roll_dice"), StayBtn: has("passenger_choice"), LeaveBtn: has("passenger_choice") || has("solo_leave"),
            PassSpecialBtn: has("pass_special"), ResolveCardsBtn: resolved.cards, ResolveTelescopeBtn: resolved.spyglass,
            CrashBtn: has("captain_fail"), JetpackUseBtn: has("jetpack_decision"), JetpackSkipBtn: has("jetpack_decision"),
            NextJourneyBtn: has("next_journey"), PlayAgainBtn: has("play_again"),
        };
        for (const [id, visible] of Object.entries(states)) {
            const button = byId(id);
            button.classList.toggle("hidden", !visible);
            button.disabled = !visible;
        }
        byId("Actions").classList.toggle("hidden", !Object.values(states).some(Boolean));
        const yourTurn = Object.values(states).some(Boolean) || has("play_power");
        byId("Status").classList.toggle("is-your-turn", yourTurn);
        document.body.classList.toggle("celestia-needs-action", yourTurn && currentGameType === "celestia");
        text("ResolveCardsBtn", view?.dice_results?.every(face => face === "blank") ? "Continue flight →" : "Use equipment →");
        text("LeaveBtn", `Take City ${view?.current_city ?? ""} treasure`);
        renderStatus(yourTurn);
        renderSelection();
    }
    function renderStatus(yourTurn) {
        if (!view) return;
        const captain = name(view.captain);
        let title = "Waiting for the crew";
        let hint = "The journey will continue shortly.";
        switch (view.phase) {
            case "roll":
                title = has("roll_dice") ? "You are the captain" : `${captain} is preparing to roll`;
                hint = has("solo_leave") ? "Fly on, or land safely with the current city's treasure." : `Next stop: City ${view.next_city ?? "—"} · ${view.required_dice} dice`;
                break;
            case "passenger_choice":
                title = has("passenger_choice") ? "Stay aboard or take treasure?" : `${name(view.pending_passenger)} is deciding`;
                hint = has("passenger_choice") ? `Land at City ${view.current_city}, or risk the flight to City ${view.next_city}.` : `Captain: ${captain} · The hazards are shown below.`;
                break;
            case "reroll_window":
            case "ejection_window":
                title = yourTurn ? "Play a power card or continue" : "Waiting for power-card decisions";
                hint = yourTurn ? "Select a highlighted card in your hand to use it." : view.special_passes?.includes(view.you)
                    ? "You passed. Waiting for the remaining players." : "The crew can play a card before the flight continues.";
                if (view.special_passes?.length) hint += ` ${view.special_passes.length} passed.`;
                break;
            case "captain_action":
                title = yourTurn ? "Guide the airship through" : `${captain} is resolving the hazards`;
                hint = yourTurn ? resolution().cards ? "Matching equipment is used automatically." : resolution().spyglass
                    ? "Your spyglass can save the flight." : "Your cards cannot cover these hazards." : "Watch the dice and the crew's next move.";
                break;
            case "jetpack_window":
                title = has("jetpack_decision") ? "A last chance for treasure" : "Waiting for jetpack decisions";
                hint = has("jetpack_decision") ? `Use a Jetpack (🎒) to take City ${view.current_city} treasure.` : "The airship crashed. Travelers are deciding whether to use their Jetpacks (🎒).";
                break;
            case "journey_end":
                title = has("next_journey") ? "Ready for another journey?" : "You're ready ✓";
                hint = `${view.next_ready?.length || 0}/${view.players?.length || 0} ready · The next journey starts when everyone confirms.`;
                break;
            case "game_over":
                title = `🏆 ${view.winner?.map(name).join(", ") || "Journey complete"}`;
                hint = `Final score: ${view.your_score ?? 0} 💎`;
                break;
        }
        text("StatusTitle", title);
        text("StatusHint", hint);
    }
    function resetSelection() {
        selectedCardId = null;
        selectedDice = [];
        selectedTarget = null;
    }
    function cancelSelection() {
        if (!selectedCardId) return;
        resetSelection();
        renderHand();
        renderDice();
        renderPlayers();
        renderSelection();
    }
    function render(data) {
        const next = data.view || {};
        const context = JSON.stringify([data.room_id, next.journey_no, next.current_city, next.phase, next.captain, next.dice_results]);
        if (context !== selectionContext) resetSelection();
        selectionContext = context;
        view = next;
        if (!powerPlayable(selectedCard())) resetSelection();
        if (!view.players?.some(player => player.player_id === selectedTarget && targetable(player))) selectedTarget = null;
        if (currentGameType !== "celestia") {
            currentGameType = "celestia";
            setGamePanelVisibility("celestia");
        }
        hideTooltip();
        text("Phase", phaseLabels[view.phase] || "Preparing");
        text("Journey", view.journey_no ?? "—");
        text("Captain", name(view.captain));
        text("CurrentCity", view.current_city ?? "—");
        text("NextCity", view.next_city ?? "—");
        text("RequiredDice", view.required_dice ?? "—");
        text("YourScore", `${view.your_score ?? 0} / ${view.config?.target_score ?? 50}`);
        renderSummary();
        renderRoute();
        renderDice();
        renderHand();
        renderTreasures();
        renderPlayers();
        renderActions();
        logGameEvents(data);
    }
    function dispatch(action) {
        if (explaining || !has(action.type)) return;
        hideTooltip();
        sendAction(action);
    }
    const actions = {
        RollBtn: () => ({type: "roll_dice"}),
        StayBtn: () => ({type: "passenger_choice", choice: "stay"}),
        LeaveBtn: () => has("solo_leave") ? {type: "solo_leave"} : {type: "passenger_choice", choice: "leave"},
        PassSpecialBtn: () => ({type: "pass_special"}),
        ResolveCardsBtn: () => resolution().cards && ({type: "captain_resolve", method: "cards"}),
        ResolveTelescopeBtn: () => resolution().spyglass && ({type: "captain_resolve", method: "telescope", treasure_id: view.your_treasures.find(card => card.kind === "telescope").id}),
        CrashBtn: () => ({type: "captain_fail"}),
        JetpackUseBtn: () => ({type: "jetpack_decision", use: true}),
        JetpackSkipBtn: () => ({type: "jetpack_decision", use: false}),
        NextJourneyBtn: () => ({type: "next_journey"}),
        PlayAgainBtn: () => ({type: "play_again"}),
        PlayPowerBtn: () => {
            if (!powerReady()) return null;
            const action = {type: "play_power", card_id: selectedCardId};
            if (selectedCard().kind === "alternative_route") action.dice_indexes = [...selectedDice];
            if (selectedCard().kind === "ejection") action.target_player_id = selectedTarget;
            return action;
        },
    };
    for (const [id, getAction] of Object.entries(actions)) {
        describe(byId(id), ...explanations[id]);
        byId(id).addEventListener("click", () => {
            const action = getAction();
            if (action) dispatch(action);
        });
    }

    function hideTooltip() {
        clearTimeout(tooltipTimer);
        byId("Tooltip").hidden = true;
    }
    function showTooltip(target, temporary = false) {
        if (explaining || !target?.dataset.celestiaTooltip) return;
        hideTooltip();
        const tooltip = byId("Tooltip");
        tooltip.textContent = target.dataset.celestiaTooltip;
        tooltip.hidden = false;
        const rect = target.getBoundingClientRect();
        const box = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - box.width - 8))}px`;
        tooltip.style.top = `${rect.bottom + box.height + 12 < innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - box.height - 6)}px`;
        if (temporary) tooltipTimer = setTimeout(hideTooltip, 3000);
    }
    function setExplain(enabled) {
        explaining = enabled;
        hideTooltip();
        document.body.classList.toggle("celestia-explain-mode", enabled);
        byId("ExplainBtn").classList.toggle("active", enabled);
        byId("ExplainBtn").setAttribute("aria-pressed", String(enabled));
        panel.querySelectorAll("[data-celestia-explain-text]").forEach(node => node.classList.toggle("has-explanation", enabled));
    }
    function openModal(id) {
        hideTooltip();
        modalReturnFocus = document.activeElement;
        setModalVisible(byId(id), true);
        byId(`${id}CloseBtn`).focus();
    }
    function closeModal(id) {
        setModalVisible(byId(id), false);
        if (modalReturnFocus?.isConnected) modalReturnFocus.focus({preventScroll: true});
        modalReturnFocus = null;
    }
    function explain(target) {
        if (!target?.dataset.celestiaExplainText) return;
        byId("ExplainContent").replaceChildren(element("h4", "", target.dataset.celestiaExplainTitle), element("p", "", target.dataset.celestiaExplainText));
        setExplain(false);
        openModal("ExplainModal");
    }
    panel.querySelectorAll("[data-celestia-tooltip]").forEach(node => {
        if (!node.dataset.celestiaExplainText) describe(node, node.textContent.trim().replace(/\s+/g, " "), node.dataset.celestiaTooltip);
    });
    byId("HelpBtn").addEventListener("click", () => {
        setExplain(false);
        byId("HelpContent").innerHTML = help;
        openModal("HelpModal");
    });
    byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
    for (const id of ["HelpModal", "ExplainModal"]) {
        const modal = byId(id);
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", id === "HelpModal" ? "Celestia Help" : "Celestia Explain");
        byId(`${id}CloseBtn`).addEventListener("click", () => closeModal(id));
        modal.addEventListener("click", event => { if (event.target === modal) closeModal(id); });
    }
    // Capture also covers disabled buttons, which do not dispatch normal clicks.
    document.addEventListener("pointerdown", event => {
        if (!explaining || currentGameType !== "celestia") return;
        if (event.target.closest("#celestiaExplainBtn, #celestiaHelpBtn, #celestiaHelpModal, #celestiaExplainModal")) return;
        let target = event.target.closest("[data-celestia-explain-text]");
        if (!target) target = [...panel.querySelectorAll("[data-celestia-explain-text]")].find(node => {
            const rect = node.getBoundingClientRect();
            return rect.width && rect.height && event.clientX >= rect.left && event.clientX <= rect.right
                && event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
        event.preventDefault();
        event.stopPropagation();
        suppressClickUntil = Date.now() + 500;
        explain(target);
    }, true);
    document.addEventListener("click", event => {
        if (currentGameType !== "celestia") return;
        if (Date.now() < suppressClickUntil && !event.target.closest("#celestiaHelpModal, #celestiaExplainModal")) {
            suppressClickUntil = 0;
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (!explaining || event.target.closest("#celestiaExplainBtn, #celestiaHelpBtn, #celestiaHelpModal, #celestiaExplainModal")) return;
        event.preventDefault();
        event.stopPropagation();
        explain(event.target.closest("[data-celestia-explain-text]"));
    }, true);
    panel.addEventListener("click", event => {
        const target = event.target.closest("[data-celestia-tooltip]");
        if (target && !target.matches("button")) showTooltip(target, true);
        else if (!event.target.closest("button, summary, a, input, [data-celestia-explain-text]")) {
            hideTooltip();
            cancelSelection();
        }
    });
    panel.addEventListener("pointerover", event => {
        if (event.pointerType === "mouse") showTooltip(event.target.closest("[data-celestia-tooltip]"));
    });
    panel.addEventListener("pointerout", event => {
        const target = event.target.closest("[data-celestia-tooltip]");
        if (target && !target.contains(event.relatedTarget)) hideTooltip();
    });
    panel.addEventListener("focusin", event => showTooltip(event.target.closest("[data-celestia-tooltip]")));
    panel.addEventListener("focusout", hideTooltip);
    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);
    document.addEventListener("keydown", event => {
        if (currentGameType !== "celestia") return;
        const modalId = ["ExplainModal", "HelpModal"].find(id => !byId(id).classList.contains("hidden"));
        if (event.key === "Escape") {
            if (modalId) closeModal(modalId);
            else if (explaining) setExplain(false);
            else cancelSelection();
            hideTooltip();
        } else if (event.key === "Tab" && modalId) {
            const focusable = [...byId(modalId).querySelectorAll("button, a[href], [tabindex='0']")];
            const first = focusable[0], last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        } else if (["Enter", " "].includes(event.key) && panel.contains(event.target) && !event.target.matches("button, summary")) {
            const target = event.target.closest("[data-celestia-explain-text]");
            if (target) { event.preventDefault(); explaining ? explain(target) : showTooltip(target, true); }
        }
    });

    window.renderCelestiaGameState = render;
    window.showCelestiaHeaderActions = show => {
        byId("HeaderActions").style.display = show ? "flex" : "none";
        if (!show) {
            setExplain(false);
            hideTooltip();
            for (const id of ["HelpModal", "ExplainModal"]) setModalVisible(byId(id), false);
            document.body.classList.remove("celestia-needs-action");
        } else if (view) renderActions();
    };
    window.clearCelestiaState = () => {
        view = null;
        selectionContext = null;
        resetSelection();
        setExplain(false);
        for (const id of ["Route", "Dice", "Hand", "Treasures", "Players", "SummaryRewards"]) byId(id).replaceChildren();
        for (const id of ["Summary", "PowerPrompt"]) byId(id).classList.add("hidden");
        for (const id of Object.keys(actions)) byId(id).classList.add("hidden");
        byId("TreasuresDetails").open = false;
        document.body.classList.remove("celestia-needs-action");
    };
})();
