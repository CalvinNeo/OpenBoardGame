const criminalDanceConfigBox = document.getElementById("criminalDanceConfigBox");
const criminalDanceDetectiveRuleSelect = document.getElementById("criminalDanceDetectiveRuleSelect");
const criminalDanceDogFailSelect = document.getElementById("criminalDanceDogFailSelect");
const criminalDanceBoyToggle = document.getElementById("criminalDanceBoyToggle");
const criminalDanceChiefToggle = document.getElementById("criminalDanceChiefToggle");
const criminalDanceScoringToggle = document.getElementById("criminalDanceScoringToggle");
const criminalDanceBoyVisibilitySelect = document.getElementById("criminalDanceBoyVisibilitySelect");

(() => {
    const get = (id) => document.getElementById(`criminalDance${id}`);
    const panel = get("Panel");
    if (!panel) return;
    const cards = {
        first_finder: ["🥇", "First Finder", "Opening", "amber"],
        criminal: ["🕵️", "Criminal", "Escape", "red"],
        detective: ["🔍", "Detective", "Accuse", "blue"],
        alibi: ["🧾", "Alibi", "Protection", "green"],
        dog: ["🐶", "Dog", "Reveal", "amber"],
        accomplice: ["😈", "Accomplice", "Team", "violet"],
        witness: ["👀", "Witness", "Investigate", "blue"],
        info_control: ["↩️", "Info Control", "Pass left", "violet"],
        rumor: ["🗣️", "Rumor", "Draw right", "violet"],
        trade: ["🤝", "Trade", "Exchange", "green"],
        boy: ["🧒", "Boy", "Secret", "amber"],
        civilian: ["🙂", "Civilian", "No effect", "slate"],
        chief: ["👮", "Chief", "Mark", "blue"],
    };
    let view = null;
    let selectedId = null;
    let targetId = "";
    let tradeId = "";
    let selectionContext = "";
    let explaining = false;
    let suppressClick = false;
    let tooltipAnchor = null;
    let tooltipTimer = null;
    let dialogOrigin = null;
    const name = (id) => view?.players?.find(p => p.player_id === id)?.name || "Player";
    const me = () => view?.players?.find(p => p.you);
    const hand = () => me()?.hand || [];
    const legal = (action) => (view?.legal_actions || []).includes(action);
    const cardLabel = (type) => cards[type] ? `${cards[type][1]} (${cards[type][0]})` : "Unknown card";
    const text = (id, value) => { if (get(id)) get(id).textContent = value; };
    const visible = (id, show) => get(id)?.classList.toggle("hidden", !show);
    function node(tag, className, value) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (value !== undefined) el.textContent = value;
        return el;
    }
    function explain(el, key) {
        el.dataset.criminalDanceExplainKey = key;
        el.classList.toggle("has-explanation", explaining);
        return el;
    }
    function tip(el, message) {
        el.dataset.criminalDanceTip = message;
        el.setAttribute("aria-label", message);
        if (!el.matches("button, input, select")) el.tabIndex = 0;
        return el;
    }
    function badge(value, message) {
        return tip(node("span", "criminal-dance-badge", value), message);
    }
    function settings() {
        if (view) return view.config || {};
        const saved = typeof currentRoomState !== "undefined" ? currentRoomState?.game_config || {} : {};
        return {
            ...saved,
            detective_activation_rule: criminalDanceDetectiveRuleSelect?.value || saved.detective_activation_rule,
            dog_fail_behavior: criminalDanceDogFailSelect?.value || saved.dog_fail_behavior,
            boy_visibility_mode: criminalDanceBoyVisibilitySelect?.value || saved.boy_visibility_mode,
            enable_boy: criminalDanceBoyToggle?.checked ?? saved.enable_boy,
            enable_chief: criminalDanceChiefToggle?.checked ?? saved.enable_chief,
            scoring_enabled: criminalDanceScoringToggle?.checked ?? saved.scoring_enabled,
        };
    }
    function detectiveActive() {
        const rule = settings().detective_activation_rule || "hand_leq_3";
        return rule === "always" || (rule === "round_ge_2" ? view.round_number >= 2 : hand().length <= 3);
    }
    function detectiveRule() {
        const rule = settings().detective_activation_rule || "hand_leq_3";
        return rule === "always" ? "Accusations are always active." : rule === "round_ge_2"
            ? "Accusations become active from round 2 onward."
            : "Accusations are active only with 3 or fewer cards in your hand before playing Detective (🔍).";
    }
    function cardInfo(type) {
        const info = {
            first_finder: "The holder takes the opening turn. If you hold First Finder (🥇) and have not played this round, you must play it first.",
            criminal: "Whoever holds Criminal (🕵️) is the current criminal. Play it only as your last hand card to escape and win with everyone who has played Accomplice (😈).",
            detective: `Choose another player to accuse. Catching Criminal (🕵️) wins the round unless they hold Alibi (🧾), which blocks automatically. ${detectiveRule()} An inactive Detective (🔍) can still be played, with no accusation effect.`,
            alibi: "While held, Alibi (🧾) automatically blocks Detective (🔍). Playing it discards that protection. It does not protect against Dog (🐶).",
            dog: `Choose another player with cards and reveal a random hand card. Revealing Criminal (🕵️) wins immediately, even with Alibi (🧾). On a miss, ${settings().dog_fail_behavior === "give_to_target" ? "Dog (🐶) goes into the target's hand" : "Dog (🐶) stays discarded"}.`,
            accomplice: "Playing Accomplice (😈) joins the criminal team for the rest of this round. You win with Criminal (🕵️) if they escape, even if your hand changes.",
            witness: "Choose another player with cards. Only you see their current hand in Private Notes (🔒). Cards can move afterward, so this information may become outdated.",
            info_control: "After playing Info Control (↩️), each player with cards passes a randomly chosen card to the next seat on the left, simultaneously.",
            rumor: "After playing Rumor (🗣️), everyone draws a random card from the next seat on their right if that player has cards.",
            trade: "Choose another player with cards, then choose one of your remaining cards to exchange for a random card from their hand. If Trade (🤝) is your last card, it has no exchange effect.",
            boy: `At the start of the round, Boy (🧒) privately learns who holds Criminal (🕵️). ${settings().boy_visibility_mode === "mutual" ? "The criminal is also told that Boy (🧒) knows their identity." : "Only Boy (🧒) receives this information."} Playing the card has no further effect.`,
            civilian: "Civilian (🙂) has no effect. Play it to reduce your hand.",
            chief: "Choose another player to mark with Chief (👮). When no legal turns remain, the server checks whether the marked player holds Criminal (🕵️) and awards a catch win if they do.",
        };
        return info[type] || "No further effect.";
    }
    function targets(card) {
        const requireCards = card && (["dog", "witness"].includes(card.type) || (card.type === "trade" && hand().length > 1));
        return (view?.players || []).filter(p => !p.you && (!requireCards || p.hand_count > 0));
    }
    function blockedReason(card) {
        if (view?.game_over) return "Round complete. Review the result before continuing.";
        if (!legal("play_card")) return "Wait for your turn.";
        if (hand().some(c => c.type === "first_finder") && !(view.played || []).some(p => p.player_id === view.you) && card.type !== "first_finder") {
            return "Play First Finder (🥇) first.";
        }
        if (card.type === "criminal" && hand().length !== 1) return "Criminal (🕵️) must be your last card.";
        if (["dog", "witness", "trade"].includes(card.type) && !targets(card).length) return "No eligible player has cards.";
        return "";
    }
    function resetSelection() {
        selectedId = null;
        targetId = "";
        tradeId = "";
    }
    function renderPlayers() {
        const list = get("Players");
        list.replaceChildren();
        for (const p of view?.players || []) {
            const row = node("div", "criminal-dance-player");
            const current = !view.game_over && p.player_id === view.current_player_id;
            row.classList.toggle("is-current", current);
            row.classList.toggle("is-you", p.you);
            row.classList.toggle("is-winner", (view.winner_ids || []).includes(p.player_id));
            const title = node("div", "criminal-dance-player-name", p.name);
            if (p.you) title.append(node("span", "criminal-dance-badge", "You"));
            const meta = node("div", "criminal-dance-player-meta");
            meta.append(badge(`🃏 ${p.hand_count}`, `Hand (🃏): ${p.hand_count} cards remaining.`));
            if (view.config?.scoring_enabled !== false) meta.append(badge(`⭐ ${p.score}`, `Score (⭐): ${p.score} total points.`));
            if (current) meta.append(badge("▶ Turn", "Current turn (▶): this player acts next."));
            if (p.is_accomplice) meta.append(badge("😈", "Accomplice (😈): this player joined the criminal team."));
            if (view.game_over && p.round_ready) meta.append(badge("✓ Ready", "Ready (✓): confirmed to continue."));
            row.append(title, meta);
            list.append(row);
        }
    }
    function renderHand() {
        const list = get("Hand");
        const focusId = list.contains(document.activeElement) ? document.activeElement.dataset.cardId : null;
        list.replaceChildren();
        text("HandCount", `${hand().length} cards`);
        if (!hand().length) list.append(node("p", "hint", me() ? "No cards remaining." : "You are spectating."));
        for (const card of hand()) {
            const [icon, title, tag, tone] = cards[card.type] || ["🃏", "Unknown card", "Card", "slate"];
            const reason = blockedReason(card);
            const btn = explain(node("button", "criminal-dance-card"), `card:${card.type}`);
            btn.type = "button";
            btn.dataset.cardId = card.id;
            btn.dataset.tone = tone;
            btn.classList.toggle("selected", card.id === selectedId);
            // aria-disabled keeps unavailable cards focusable for Help and touch hints.
            btn.setAttribute("aria-disabled", String(Boolean(reason)));
            btn.setAttribute("aria-pressed", String(card.id === selectedId));
            btn.setAttribute("aria-label", `${cardLabel(card.type)}. ${reason || "Select to play."}`);
            if (reason) btn.dataset.criminalDanceTip = reason;
            btn.append(node("span", "criminal-dance-card-icon", icon), node("span", "criminal-dance-card-name", title), node("span", "criminal-dance-card-tag", tag));
            const status = card.id === selectedId ? "✓ Selected" : reason ? (view.game_over ? "Round over" : !legal("play_card") ? "Waiting" : card.type === "criminal" ? "Last card only" : reason.includes("First Finder") ? "First Finder first" : "No target") : "Tap to select";
            btn.append(node("span", "criminal-dance-card-state", status));
            btn.addEventListener("click", () => {
                if (reason) { showTip(btn); return; }
                const next = selectedId === card.id ? null : card.id;
                resetSelection();
                selectedId = next;
                renderHand();
                renderControls();
            });
            list.append(btn);
        }
        if (focusId) [...list.children].find(el => el.dataset.cardId === focusId)?.focus({ preventScroll: true });
    }
    function field(title, id, choices, value, key, onChange) {
        const label = node("label", "criminal-dance-field", title);
        label.htmlFor = id;
        const select = explain(node("select"), key);
        select.id = id;
        for (const [value, title] of choices) {
            const option = node("option", "", title);
            option.value = value;
            select.append(option);
        }
        select.value = value;
        select.addEventListener("change", () => onChange(select.value));
        label.append(select);
        return label;
    }
    function renderControls() {
        const controls = get("Controls");
        controls.replaceChildren();
        if (!view) return;
        if (view.game_over) {
            const row = node("div", "criminal-dance-action-row");
            if (me()) {
                const btn = explain(node("button", "criminal-dance-primary", me().round_ready ? "✓ Ready" : view.match_over ? "New Match" : "Next Round"), "play_again");
                btn.type = "button";
                btn.disabled = !legal("play_again");
                btn.addEventListener("click", () => sendAction({ type: "play_again" }));
                row.append(btn);
            }
            row.append(node("span", "hint", me() ? "Continue when everyone is ready." : "Waiting for the players."));
            controls.append(row);
            return;
        }
        if (!legal("play_card")) {
            controls.append(node("div", "hint", me() ? `Waiting for ${name(view.current_player_id)}…` : "Spectating this round."));
            return;
        }
        const card = hand().find(c => c.id === selectedId);
        controls.append(node("div", "criminal-dance-action-title", card ? cardLabel(card.type) : "Select a card to play"));
        const needsTarget = card && ["detective", "dog", "witness", "trade", "chief"].includes(card.type);
        const fields = node("div", "criminal-dance-action-fields");
        if (needsTarget) {
            const eligible = targets(card);
            if (!eligible.some(p => p.player_id === targetId)) targetId = eligible[0]?.player_id || "";
            fields.append(field("Target", "criminalDanceTarget", eligible.map(p => [p.player_id, p.name]), targetId, "pick_target", value => { targetId = value; }));
        }
        if (card?.type === "trade" && hand().length > 1) {
            const extra = hand().filter(c => c.id !== card.id);
            if (!extra.some(c => c.id === tradeId)) tradeId = extra[0]?.id || "";
            fields.append(field("Give", "criminalDanceTradeCard", extra.map(c => [c.id, cardLabel(c.type)]), tradeId, "trade_card", value => { tradeId = value; }));
        }
        if (fields.children.length) controls.append(fields);
        const row = node("div", "criminal-dance-action-row");
        const btn = explain(node("button", "criminal-dance-primary", "Play Card"), "play_card");
        btn.type = "button";
        btn.disabled = !card || Boolean(blockedReason(card)) || (needsTarget && !targetId);
        btn.addEventListener("click", () => {
            if (!card || blockedReason(card)) return;
            const action = { type: "play_card", card_id: card.id };
            if (needsTarget) action.target_player_id = targetId;
            if (card.type === "trade" && tradeId) action.your_card_id = tradeId;
            sendAction(action);
        });
        row.append(btn);
        if (card?.type === "detective" && !detectiveActive()) row.append(node("span", "hint", "Accusation inactive this turn."));
        if (card?.type === "trade" && hand().length === 1) row.append(node("span", "hint", "Last card: no exchange."));
        controls.append(row);
    }
    function renderPlayed() {
        const list = get("Played");
        const scroll = list.scrollTop;
        list.replaceChildren();
        const entries = view?.played || [];
        text("PlayedCount", String(entries.length));
        if (!entries.length) list.append(node("p", "hint", "No cards played yet."));
        for (const entry of [...entries].reverse()) {
            const row = explain(node("div", "criminal-dance-public"), `card:${entry.card.type}`);
            tip(row, `${cardLabel(entry.card.type)}: ${cardInfo(entry.card.type).split(". ")[0]}.`);
            row.append(node("div", "criminal-dance-entry-heading", `${name(entry.player_id)} · ${cardLabel(entry.card.type)}`));
            if (entry.result) row.append(node("div", "criminal-dance-entry-result", entry.result));
            list.append(row);
        }
        list.scrollTop = scroll;
    }
    function formatNote(note) {
        // Translate only the server's card list, keeping player names untouched.
        return note.replace(/\['([a-z_]+)'(?:, '[a-z_]+')*\]/g, list => list.replace(/'([a-z_]+)'/g, (_, type) => cardLabel(type)).slice(1, -1));
    }
    function renderPrivate() {
        const list = get("Private");
        const scroll = list.scrollTop;
        list.replaceChildren();
        const notes = me()?.private_log || [];
        text("PrivateCount", String(notes.length));
        if (!notes.length) list.append(node("p", "hint", me() ? "No private clues yet." : "Private clues are visible only to their owner."));
        for (const message of [...notes].reverse()) list.append(node("div", "criminal-dance-private", formatNote(message)));
        list.scrollTop = scroll;
    }
    function renderResults() {
        visible("Results", view?.game_over);
        if (!view?.game_over) return;
        const winners = (view.winner_ids || []).map(name).join(", ");
        text("ResultSummary", `${view.match_over ? "Match complete" : "Round complete"}${winners ? ` · 🏆 ${winners}` : ""}. ${view.last_summary || ""}`);
        const waiting = (view.round_waiting_player_ids || []).map(name);
        const ready = (view.round_ready_player_ids || []).length;
        text("Ready", `${ready}/${view.players.length} ready${waiting.length ? ` · Waiting for ${waiting.join(", ")}` : ""}`);
    }
    function hideTip() {
        window.clearTimeout(tooltipTimer);
        visible("Tooltip", false);
        tooltipAnchor?.removeAttribute("aria-describedby");
        tooltipAnchor = null;
    }
    function showTip(anchor, autoHide = true) {
        if (explaining || !anchor?.dataset.criminalDanceTip) return;
        hideTip();
        const tooltip = get("Tooltip");
        tooltipAnchor = anchor;
        tooltip.textContent = anchor.dataset.criminalDanceTip;
        anchor.setAttribute("aria-describedby", tooltip.id);
        visible("Tooltip", true);
        const box = anchor.getBoundingClientRect();
        const width = tooltip.offsetWidth;
        const height = tooltip.offsetHeight;
        tooltip.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - width - 8))}px`;
        const top = box.bottom + 8 + height <= window.innerHeight ? box.bottom + 8 : box.top - height - 8;
        tooltip.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
        if (autoHide) tooltipTimer = window.setTimeout(hideTip, 3000);
    }
    function setExplain(enabled) {
        explaining = enabled;
        document.body.classList.toggle("criminal-dance-explain-mode", enabled);
        get("ExplainBtn")?.classList.toggle("active", enabled);
        get("ExplainBtn")?.setAttribute("aria-pressed", String(enabled));
        document.querySelectorAll("[data-criminal-dance-explain-key]").forEach(el => el.classList.toggle("has-explanation", enabled));
        hideTip();
    }
    function closeDialog(modal, restoreFocus = true) {
        if (modal.classList.contains("hidden")) return;
        setModalVisible(modal, false);
        if (restoreFocus && dialogOrigin?.isConnected) dialogOrigin.focus({ preventScroll: true });
    }
    function openDialog(modal) {
        hideTip();
        dialogOrigin = document.activeElement;
        for (const id of ["HelpModal", "ExplainModal"]) closeDialog(get(id), false);
        setModalVisible(modal, true);
        modal.querySelector("button")?.focus({ preventScroll: true });
    }
    function explanation(key) {
        if (key.startsWith("card:")) {
            const type = key.slice(5);
            const card = hand().find(c => c.id === selectedId && c.type === type) || hand().find(c => c.type === type);
            return [cardLabel(type), `${cardInfo(type)}${card && blockedReason(card) ? ` Currently unavailable: ${blockedReason(card)}` : ""}`];
        }
        const map = {
            status: ["Round & turn", "Round identifies the current deal. Current Turn (▶) shows who plays next; empty hands are skipped."],
            players: ["Players (👥)", "Hand (🃏) counts are public; card identities stay private. Score (⭐) is the running total. Accomplice (😈) marks a player on the criminal team. Ready (✓) means they have confirmed the next deal."],
            hand: ["Your Hand (🃏)", "Select a card, choose a target if needed, then press Play Card. Click the selected card or a blank area to cancel. Unavailable cards explain why they cannot be played."],
            played: ["Played Cards (🗂️)", "Public cards and their outcomes, newest first. Scroll to review earlier turns; use Explain on a card to read its effect."],
            private: ["Private Notes (🔒)", "Only you can see these clues, including Boy (🧒) information and hands seen by Witness (👀). They describe what was known then; cards may have moved since."],
            results: ["Results (🏆)", "The completed result remains visible until every human player confirms. Bots are ready automatically. Scores (⭐) carry into the next round and reset for a new match."],
            play_card: ["Play Card", "Play the selected card and resolve its effect. Choose any required target and exchange card first. This button is unavailable until a playable card is selected."],
            pick_target: ["Target", "Choose another player. Dog (🐶), Witness (👀), and an active Trade (🤝) need a player with cards. Only eligible targets appear."],
            trade_card: ["Give", "Choose which remaining card to give with Trade (🤝). You receive a random card from the target's hand."],
            play_again: [view?.match_over ? "New Match" : "Next Round", `Confirm that you have reviewed the result. The next deal waits for every human player; bots confirm automatically. ${view?.match_over ? "Starting a new match resets scores." : "Starting the next round keeps scores."}`],
        };
        return map[key] || null;
    }
    function showExplanation(el) {
        const item = explanation(el.dataset.criminalDanceExplainKey);
        if (!item) return;
        get("ExplainContent").replaceChildren(node("h3", "", item[0]), node("p", "", item[1]));
        setExplain(false);
        openDialog(get("ExplainModal"));
    }
    function openHelp() {
        setExplain(false);
        const content = get("HelpContent");
        content.replaceChildren();
        const section = (title, description) => content.append(node("h3", "", title), node("p", "", description));
        section("Goal", "Catch Criminal (🕵️) with Detective (🔍) or Dog (🐶), or escape by playing Criminal (🕵️) as your last card. Anyone who has played Accomplice (😈) wins with an escape.");
        section("Your turn", "Each player starts with 4 cards. First Finder (🥇) opens the round. Play one card on your turn; players with empty hands are skipped. Cards moving between players also move the criminal identity.");
        section("Controls", "Select a hand card, choose a target or exchange card when prompted, then press Play Card. Click the card again or a blank area to cancel. Explain lets you inspect any highlighted item without taking an action; press Esc to leave it. Hover over status symbols or tap them for a 3-second hint.");
        section("Current settings", `${detectiveRule()} Dog (🐶) on a miss: ${settings().dog_fail_behavior === "give_to_target" ? "give to target" : "discard"}. Boy (🧒): ${settings().enable_boy === false ? "off" : "on"}. Chief (👮): ${settings().enable_chief ? "on" : "off"}.`);
        const scoring = settings().scoring_enabled !== false;
        const count = view?.players?.length || 3;
        const target = settings().target_score_by_player_count?.[count] || ({3: 5, 4: 5, 5: 7, 6: 10, 7: 10, 8: 10})[count];
        section("Scoring & next deal", scoring
            ? `Score (⭐): a Detective (🔍) catch awards 2 to the catcher, 0 to the criminal, and 1 to each other player. Dog (🐶) or Chief (👮) awards 3 to the catcher instead. An escape awards 2 to each criminal-team winner and 0 to others. This match ends when someone reaches ${target} points. Review Results (🏆), then everyone presses Next Round; use New Match after the match ends. Bots are ready automatically.`
            : "Scoring is off: each round is a complete match. Review Results (🏆), then everyone presses New Match. Bots are ready automatically.");
        section("Symbols & information", "Players (👥), Hand (🃏) counts and Played Cards (🗂️) are public. Private Notes (🔒) belong only to you. Current Turn (▶) marks the active player. Ready (✓) tracks who has confirmed the next deal. Colors group card roles; every card also has a name and symbol.");
        content.append(node("h3", "", "Card reference"));
        for (const type of Object.keys(cards)) section(cardLabel(type), cardInfo(type));
        openDialog(get("HelpModal"));
    }
    function active() { return typeof currentGameType !== "undefined" && currentGameType === "criminal_dance"; }
    function exempt(target) {
        return Boolean(target.closest("#criminalDanceHelpBtn, #criminalDanceExplainBtn, #criminalDanceHelpModal, #criminalDanceExplainModal"));
    }
    function explainAt(event) {
        const control = event.target.closest("button, input, select, a, label");
        if (control) return control.dataset.criminalDanceExplainKey ? control : null;
        const disabled = [...panel.querySelectorAll("button:disabled[data-criminal-dance-explain-key]")].find(el => {
            const r = el.getBoundingClientRect();
            return r.width && r.height && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
        });
        if (disabled) return disabled;
        const direct = event.target.closest("[data-criminal-dance-explain-key]");
        if (direct) return direct;
        // Native disabled buttons may retarget pointer events to their parent.
        return [...document.querySelectorAll("[data-criminal-dance-explain-key]")].reverse().find(el => {
            const r = el.getBoundingClientRect();
            return r.width && r.height && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
        });
    }
    function stop(event) { event.preventDefault(); event.stopImmediatePropagation(); }
    document.addEventListener("pointerdown", event => {
        if (!active()) return;
        suppressClick = false;
        if (!explaining || exempt(event.target)) return;
        stop(event);
        const el = explainAt(event);
        if (el) { suppressClick = true; showExplanation(el); }
    }, true);
    document.addEventListener("click", event => {
        if (!active()) return;
        if (suppressClick) { suppressClick = false; stop(event); return; }
        if (explaining && !exempt(event.target)) {
            stop(event);
            const el = explainAt(event);
            if (el) showExplanation(el);
            return;
        }
        if (!panel.contains(event.target)) return;
        const anchor = event.target.closest("[data-criminal-dance-tip]");
        if (anchor && !anchor.matches("button:not([aria-disabled='true'])")) showTip(anchor);
        if (selectedId && !event.target.closest("button, select, input, label, [data-criminal-dance-tip], .criminal-dance-public, .criminal-dance-private")) {
            resetSelection(); renderHand(); renderControls();
        }
    }, true);
    panel.addEventListener("pointerover", event => {
        if (event.pointerType === "touch") return;
        const el = event.target.closest("[data-criminal-dance-tip]");
        if (el && el !== tooltipAnchor) showTip(el, false);
    });
    panel.addEventListener("pointerout", event => {
        if (tooltipAnchor && !tooltipAnchor.contains(event.relatedTarget)) hideTip();
    });
    panel.addEventListener("focusin", event => showTip(event.target.closest("[data-criminal-dance-tip]")));
    panel.addEventListener("focusout", hideTip);
    document.addEventListener("scroll", hideTip, true);
    window.addEventListener("resize", hideTip);
    document.addEventListener("keydown", event => {
        if (!active()) return;
        const modal = [get("HelpModal"), get("ExplainModal")].find(el => !el.classList.contains("hidden"));
        if (event.key === "Escape") {
            suppressClick = false;
            setExplain(false);
            if (modal) closeDialog(modal);
            else if (selectedId) { resetSelection(); renderHand(); renderControls(); }
        } else if (modal && event.key === "Tab") {
            const items = [...modal.querySelectorAll("button, a[href], input, select, [tabindex='0']")].filter(el => !el.disabled);
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        } else if (explaining && !exempt(event.target) && ["Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            stop(event);
            if (["Enter", " "].includes(event.key)) {
                const el = explainAt(event);
                if (el) showExplanation(el);
            }
        }
    }, true);
    function clear() {
        setExplain(false);
        suppressClick = false;
        resetSelection();
        selectionContext = "";
        view = null;
        for (const id of ["Players", "Hand", "Controls", "Played", "Private"]) get(id).replaceChildren();
        for (const id of ["Round", "Turn", "Summary", "HandCount", "PlayedCount", "PrivateCount", "Ready"]) text(id, "—");
        text("Status", "Lobby");
        visible("Results", false);
        closeDialog(get("HelpModal"), false);
        closeDialog(get("ExplainModal"), false);
    }
    function updateConfig() {
        const show = active() && typeof currentRoomState !== "undefined" && currentRoomState?.status === "lobby";
        criminalDanceConfigBox?.classList.toggle("hidden", !show);
        criminalDanceConfigBox?.setAttribute("aria-hidden", String(!show));
    }
    function renderRoom() {
        if (typeof currentRoomState !== "undefined" && currentRoomState?.status === "lobby" && view) clear();
        updateConfig();
        if (!view) { text("Status", "Lobby"); text("Summary", "Ready up to start the game."); }
    }
    function showHeader(show) {
        if (get("HeaderActions")) get("HeaderActions").style.display = show ? "flex" : "none";
        if (!show) {
            setExplain(false);
            closeDialog(get("HelpModal"), false);
            closeDialog(get("ExplainModal"), false);
        }
    }
    function render(data) {
        if (!data?.view) { clear(); return; }
        const next = data.view;
        const context = JSON.stringify([data.room_id, next.round_number, next.current_player_id, next.game_over, next.players?.find(p => p.you)?.hand, next.played?.length]);
        if (context !== selectionContext) { resetSelection(); hideTip(); }
        selectionContext = context;
        view = next;
        if (!hand().some(c => c.id === selectedId && !blockedReason(c))) resetSelection();
        text("Round", String(view.round_number || "—"));
        text("Turn", view.game_over ? "Complete" : view.current_player_name || "—");
        text("Status", view.game_over ? (view.match_over ? "Match complete" : "Round complete") : legal("play_card") ? "Your turn" : "In progress");
        text("Summary", view.game_over ? "Review the result and confirm when ready." : legal("play_card") ? "Choose your next move." : `Waiting for ${name(view.current_player_id)}…`);
        renderPlayers(); renderHand(); renderControls(); renderPlayed(); renderPrivate(); renderResults();
        if (typeof logGameEvents === "function") logGameEvents(data);
    }
    function init() {
        get("HelpBtn")?.addEventListener("click", openHelp);
        get("ExplainBtn")?.addEventListener("click", () => setExplain(!explaining));
        get("ExplainBtn")?.setAttribute("aria-pressed", "false");
        for (const prefix of ["Help", "Explain"]) {
            const modal = get(`${prefix}Modal`);
            get(`${prefix}ModalCloseBtn`)?.addEventListener("click", () => closeDialog(modal));
            modal?.addEventListener("click", event => { if (event.target === modal) closeDialog(modal); });
        }
        document.querySelectorAll("[data-criminal-dance-tip]").forEach(el => tip(el, el.dataset.criminalDanceTip));
        updateConfig();
        showHeader(active());
        if (active()) {
            renderRoom();
            if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "criminal_dance"
                && (typeof currentRoomState === "undefined" || !currentRoomState?.room_id || lastGameStatePayload.room_id === currentRoomState.room_id)) render({ ...lastGameStatePayload, events: [] });
        }
    }
    window.clearCriminalDanceState = clear;
    window.renderCriminalDanceGameState = render;
    window.updateCriminalDanceConfigRow = updateConfig;
    window.showCriminalDanceHeaderActions = showHeader;
    window.renderCriminalDanceRoomState = renderRoom;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
