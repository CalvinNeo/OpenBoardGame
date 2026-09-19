let currentInAGroveView = null;
let inAGroveExplainMode = false;
let inAGroveSelectedPeekIndexes = [];
let inAGroveSelectedTargetIndex = null;
let inAGroveModalReturnFocus = null;
let inAGroveConfigRoomId = null;

const inAGroveUI = Object.fromEntries([
    "Panel", "HeaderActions", "HelpBtn", "ExplainBtn", "HelpModal", "HelpModalCloseBtn",
    "ExplainModal", "ExplainModalCloseBtn", "HelpContent", "ExplainContent", "Phase",
    "Round", "Turn", "Status", "FirstPlayer", "Blocked", "Winner", "WinnerBanner",
    "YourTiles", "PublicAlibi", "PublicAlibiCard", "Victim", "Suspects", "Players",
    "RoundSummary", "RoundSummaryBody", "SummaryTitle", "PeekBtn", "BetBtn", "NextRoundBtn", "PlayAgainBtn", "ActionHint",
    "SelectionCount", "ExplainNotice", "ConfigBox", "InspectionModeSelect", "InspectionModeHint", "InspectionRule",
].map((name) => [name, document.getElementById("inAGrove" + name)]));

const IN_A_GROVE_HELP_HTML = [
    "<h3>🎯 The aim</h3><p>Finish with the fewest penalty chips. Each detective starts with 7 accusation chips.</p>",
    "<h3>🪪 Follow the evidence</h3><p>At 3–5 players, see your own tile and the tile passed from your right (<strong>From right</strong>). With 2 players, see only your own tile and one public alibi; do not exchange tiles. These alibis stay visible in both inspection modes. The victim stays hidden.</p><p>Use numbers 2–8, plus one X at 4 players or two X tiles at 5 players.</p>",
    "<h3>🔎 Investigate, then accuse</h3><ul>",
    "<li>With <strong>Inspect 1 of 2</strong> (the default room variant), every detective inspects one suspect: the first chooses one of all three; later detectives choose one of the two unblocked suspects. Confirm with <strong>Inspect 1 (🔎)</strong>.</li>",
    "<li>With <strong>Inspect both</strong>, the first detective selects two of the three suspects; later detectives inspect both unblocked suspects. Confirm with <strong>Inspect 2 (🔎)</strong>.</li>",
    "<li>Later detectives cannot inspect the previous detective's accusation.</li>",
    "<li>After confirming an inspection, you must accuse. You cannot inspect another card this turn.</li>",
    "<li><strong>First skipped (👁)</strong> marks the suspects the first detective did not inspect. These markers stay there; they do not block later detectives. Tiles are never swapped in the revised edition.</li>",
    "<li>Select any suspect and confirm your accusation. You can accuse the blocked suspect, a hidden suspect, or one with chips already on it.</li>",
    "<li>Each detective places one chip. New chips go on top. Click a selected card again, click empty space, or press Esc to cancel a selection.</li></ul>",
    "<h3>⚖️ Find the murderer</h3><p>The highest number is guilty, unless a <strong>5</strong> is among the suspects: then the lowest number is guilty. <strong>X is always innocent.</strong></p>",
    "<h3>🪙 Settle the case</h3><ul>",
    "<li>Chips on the murderer leave the game.</li>",
    "<li>The top chip's owner takes the entire stack on an innocent suspect as penalties.</li>",
    "<li>Among everyone except the previous first detective, the player with the most total penalties starts next. Ties go clockwise. At 2 players, alternate who starts.</li>",
    "<li>The game ends at 5 penalties or when accusation chips run out (at most 7 rounds).</li></ul>",
    "<p>Tied penalties? Fewer penalty chips of your own color ranks higher. If still tied, clockwise order after the final first detective decides.</p>",
    "<h3>✓ Review together</h3><p>The revealed scene stays on screen until everyone chooses <strong>Next Round</strong>. Bots confirm automatically. The final result also waits for everyone.</p>",
].join("");

const IN_A_GROVE_BUTTON_EXPLANATIONS = {
    PeekBtn: {
        name: "Inspect suspects",
        description: "Select the required number of suspects, then confirm to see their identities privately.",
        note: "A blocked suspect cannot be inspected. Choosing cards alone does not submit a move.",
    },
    BetBtn: {
        name: "Accuse a suspect",
        description: "Place one of your chips on the selected suspect, on top of any existing chips.",
        note: "You may accuse any suspect, even the blocked one. If they are innocent, the top chip's owner takes the entire stack as penalties.",
    },
    NextRoundBtn: {
        name: "Next Round",
        description: "Confirm that you have finished reviewing this round.",
        note: "Everyone must confirm before the next deal or final ranking. A disabled button means your confirmation is already recorded.",
    },
    PlayAgainBtn: {
        name: "Start a new game",
        description: "Start a fresh In a Grove game with these players.",
    },
};

function inAGroveElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function inAGroveHasLegalAction(type) {
    return !!currentInAGroveView && (currentInAGroveView.legal_actions || []).includes(type);
}

function getInAGroveConfig() {
    return { inspection_mode: inAGroveUI.InspectionModeSelect.value === "both" ? "both" : "choose_one" };
}

function updateInAGroveConfigHint() {
    inAGroveUI.InspectionModeHint.textContent = getInAGroveConfig().inspection_mode === "choose_one"
        ? "First detective: choose 1 of 3. Later detectives: choose 1 of the 2 unblocked suspects."
        : "First detective: inspect 2 of 3. Later detectives: inspect both unblocked suspects.";
}

function updateInAGroveConfigRow() {
    const visible = !!currentRoomState && currentGameType === "in_a_grove";
    inAGroveUI.ConfigBox.classList.toggle("hidden", !visible);
    inAGroveUI.ConfigBox.setAttribute("aria-hidden", String(!visible));
    if (!visible) {
        inAGroveConfigRoomId = null;
        inAGroveUI.InspectionModeSelect.value = "choose_one";
        return;
    }
    if (inAGroveConfigRoomId !== currentRoomState.room_id) {
        inAGroveConfigRoomId = currentRoomState.room_id;
        inAGroveUI.InspectionModeSelect.value = currentRoomState.game_config?.inspection_mode === "both" ? "both" : "choose_one";
    }
    inAGroveUI.InspectionModeSelect.disabled = !["lobby", "game_over"].includes(currentRoomState.status);
    updateInAGroveConfigHint();
}

function inAGrovePeekCount() {
    return currentInAGroveView?.peek_count === 1 ? 1 : 2;
}

function inAGroveIsRevealed(view) {
    return view.phase === "round_end" || view.game_over;
}

function inAGrovePlayerName(view, id) {
    return (view.players || []).find((player) => player.player_id === id)?.name || id || "—";
}

function inAGrovePlayerColor(id) {
    const index = (currentInAGroveView?.players || []).findIndex((player) => player.player_id === id);
    return ["#ad573e", "#38827e", "#987127", "#6d65a4", "#457ca2"][index] || "#64748b";
}

function clearInAGroveSelection() {
    inAGroveSelectedPeekIndexes = [];
    inAGroveSelectedTargetIndex = null;
}

function showInAGroveHeaderActions(show) {
    if (inAGroveUI.HeaderActions) inAGroveUI.HeaderActions.style.display = show ? "flex" : "none";
    if (!show) {
        exitInAGroveExplainMode();
        [inAGroveUI.HelpModal, inAGroveUI.ExplainModal].forEach((modal) => setModalVisible(modal, false));
    }
}

function clearInAGroveState() {
    currentInAGroveView = null;
    clearInAGroveSelection();
    exitInAGroveExplainMode();
    ["Phase", "Round", "Turn", "FirstPlayer", "Blocked", "Winner"].forEach((key) => {
        inAGroveUI[key].textContent = "—";
    });
    ["YourTiles", "Suspects", "Players", "RoundSummaryBody"].forEach((key) => inAGroveUI[key].replaceChildren());
    inAGroveUI.RoundSummary.classList.add("hidden");
    inAGroveUI.WinnerBanner.classList.add("hidden");
    inAGroveUI.PublicAlibiCard.classList.add("hidden");
    inAGroveUI.Status.classList.remove("is-your-turn");
    inAGroveUI.Victim.textContent = "Hidden";
    inAGroveUI.InspectionRule.textContent = "";
    updateInAGroveActionButtons();
}

function renderInAGroveEvidence(view) {
    inAGroveUI.YourTiles.replaceChildren();
    (view.your_tiles || []).forEach((entry) => {
        const alibi = inAGroveElement("div", "in-a-grove-alibi");
        alibi.append(
            inAGroveElement("span", "", entry.source === "your tile" ? "Your tile" : "From right"),
            inAGroveElement("strong", "", entry.label),
        );
        inAGroveUI.YourTiles.append(alibi);
    });
    inAGroveUI.PublicAlibiCard.classList.toggle("hidden", !view.public_alibi);
    inAGroveUI.PublicAlibi.textContent = view.public_alibi || "—";
    inAGroveUI.Victim.textContent = "Hidden";
}

function buildInAGroveStack(stack) {
    const wrap = inAGroveElement("div", "in-a-grove-stack");
    if (!stack?.length) {
        wrap.append(inAGroveElement("span", "in-a-grove-chip empty", "No chips"));
        return wrap;
    }
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Accusation chips, newest first");
    if (stack.length > 3) wrap.tabIndex = 0;
    [...stack].reverse().forEach((id, index) => {
        const chip = inAGroveElement("div", "in-a-grove-chip" + (index === 0 ? " top" : ""));
        chip.style.setProperty("--chip-color", inAGrovePlayerColor(id));
        chip.title = inAGrovePlayerName(currentInAGroveView, id) + (index === 0 ? " · Top chip" : "");
        chip.append(
            inAGroveElement("span", "in-a-grove-chip-dot"),
            inAGroveElement("span", "in-a-grove-chip-name", inAGrovePlayerName(currentInAGroveView, id)),
        );
        if (index === 0) chip.append(inAGroveElement("small", "", "TOP"));
        wrap.append(chip);
    });
    return wrap;
}

function inAGroveCanSelectSuspect(suspect) {
    if (inAGroveHasLegalAction("peek_suspects")) return !suspect.blocked;
    return inAGroveHasLegalAction("place_bet");
}

function renderInAGroveSuspects(view) {
    const focusedId = inAGroveUI.Suspects.contains(document.activeElement) ? document.activeElement.id : null;
    inAGroveUI.Suspects.replaceChildren();
    (view.suspects || []).forEach((suspect) => {
        const column = inAGroveElement("div", "in-a-grove-suspect-column");
        const card = inAGroveElement("button", "in-a-grove-suspect");
        const revealed = inAGroveIsRevealed(view);
        const result = revealed ? view.last_round_summary?.suspects?.find((entry) => entry.index === suspect.index) : null;
        const selected = inAGroveSelectedPeekIndexes.includes(suspect.index) || inAGroveSelectedTargetIndex === suspect.index;
        const canSelect = inAGroveCanSelectSuspect(suspect);
        card.type = "button";
        card.id = "inAGroveSuspect" + suspect.index;
        card.dataset.inAGroveExplain = "suspect";
        card.dataset.index = String(suspect.index);
        card.disabled = !canSelect;
        card.setAttribute("aria-pressed", String(selected));
        card.classList.toggle("selected", selected);
        card.classList.toggle("blocked", !!suspect.blocked && !revealed);
        card.classList.toggle("interactive", canSelect);
        card.classList.toggle("is-murderer", !!result?.is_murderer);

        const label = inAGroveElement("span", "in-a-grove-suspect-label");
        label.append(
            inAGroveElement("span", "", "Suspect " + (suspect.index + 1)),
            inAGroveElement("span", "in-a-grove-selection-mark", selected ? "✓" : "·"),
        );
        const face = inAGroveElement("span", "in-a-grove-suspect-face", suspect.label || "?");
        face.classList.toggle("is-hidden", !suspect.label);
        const caption = inAGroveElement("span", "in-a-grove-face-caption",
            revealed ? "Revealed" : suspect.label ? "Only you can see" : "Identity hidden");
        let status = "Await your turn";
        if (revealed) status = result?.is_murderer ? "🔴 Murderer" : "🟢 Innocent";
        else if (view.phase === "peek") status = suspect.blocked ? "🚫 No peeking" : "🔎 Can inspect";
        else if (view.phase === "bet") status = "🎯 Can accuse";
        const unseen = inAGroveElement("span", "in-a-grove-unseen", suspect.unseen ? "👁 First skipped" : "");
        if (!revealed && view.current_turn !== view.you && !suspect.blocked) status = "Await your turn";
        card.append(label, face, caption, unseen, inAGroveElement("span", "in-a-grove-suspect-status", status));
        card.setAttribute("aria-label", "Suspect " + (suspect.index + 1) + ", " +
            (suspect.label ? "value " + suspect.label : "hidden") + ", " + status +
            (suspect.unseen ? ", not inspected by the first detective" : "") + (selected ? ", selected" : ""));
        card.addEventListener("click", () => {
            if (inAGroveExplainMode || !inAGroveCanSelectSuspect(suspect)) return;
            if (inAGroveHasLegalAction("peek_suspects")) {
                if (inAGroveSelectedPeekIndexes.includes(suspect.index)) {
                    inAGroveSelectedPeekIndexes = inAGroveSelectedPeekIndexes.filter((index) => index !== suspect.index);
                } else {
                    if (inAGroveSelectedPeekIndexes.length === inAGrovePeekCount()) inAGroveSelectedPeekIndexes.shift();
                    inAGroveSelectedPeekIndexes.push(suspect.index);
                }
            } else {
                inAGroveSelectedTargetIndex = inAGroveSelectedTargetIndex === suspect.index ? null : suspect.index;
            }
            renderInAGroveSuspects(currentInAGroveView);
            updateInAGroveActionButtons();
        });
        column.append(card, buildInAGroveStack(suspect.stack));
        inAGroveUI.Suspects.append(column);
    });
    updateInAGroveExplainClasses();
    if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
}

function renderInAGrovePlayers(view) {
    inAGroveUI.Players.replaceChildren();
    (view.players || []).forEach((player) => {
        const card = inAGroveElement("div", "in-a-grove-player-card");
        card.classList.toggle("current", player.player_id === view.current_turn);
        card.style.setProperty("--chip-color", inAGrovePlayerColor(player.player_id));
        const name = inAGroveElement("strong", "", player.name);
        name.title = player.name;
        const heading = inAGroveElement("div", "in-a-grove-player-heading");
        heading.append(inAGroveElement("span", "in-a-grove-player-dot"), name);
        if (player.player_id === view.you) heading.append(inAGroveElement("span", "in-a-grove-player-tag", "You"));
        if (player.player_id === view.current_turn) heading.append(inAGroveElement("span", "in-a-grove-player-tag", "← Turn"));
        const stats = inAGroveElement("div", "in-a-grove-player-stats");
        const chips = inAGroveElement("span", player.hand_count <= 1 ? "is-danger" : "", "🎯 " + player.hand_count + " left");
        const penalties = inAGroveElement("span", player.penalty_count >= 4 ? "is-danger" : "", "⚠️ " + player.penalty_count + "/5");
        penalties.setAttribute("aria-label", player.penalty_count + " penalties, game ends at 5");
        penalties.title = (player.own_penalty_count || 0) + " in this detective's own color (tiebreaker)";
        stats.append(chips, penalties);
        card.append(heading, stats);
        if (view.phase === "round_end") {
            card.append(inAGroveElement("div", "in-a-grove-player-ready", player.round_ready ? "✓ Ready" : "◷ Reviewing"));
        }
        inAGroveUI.Players.append(card);
    });
}

function renderInAGroveSummary(view, previousView) {
    const summary = view.last_round_summary;
    inAGroveUI.RoundSummary.classList.toggle("hidden", !summary);
    if (!summary) return;
    const revealed = inAGroveIsRevealed(view);
    if (view.phase !== previousView?.phase || summary.round !== previousView?.last_round_summary?.round) {
        inAGroveUI.RoundSummary.open = revealed;
    }
    inAGroveUI.SummaryTitle.textContent = "📋 Round " + summary.round + (revealed ? " · Case closed" : " · Previous results");
    inAGroveUI.RoundSummaryBody.replaceChildren();
    const hasFive = summary.suspects.some((entry) => entry.label === "5");
    inAGroveUI.RoundSummaryBody.append(inAGroveElement("strong", "in-a-grove-verdict",
        "Suspect " + (summary.murderer_index + 1) + " (" + summary.murderer_label + ") is guilty. " +
        (hasFive ? "A 5 is present, so the lowest number is guilty." : "No 5: the highest number is guilty.")));
    (summary.suspects || []).forEach((entry) => {
        let text = "Suspect " + (entry.index + 1) + " · ";
        if (entry.is_murderer) text += entry.stack.length + " chip(s) removed from the game.";
        else if (entry.penalty_receiver) {
            text += inAGrovePlayerName(view, entry.penalty_receiver) + " takes " + entry.penalty_count + " penalty chip(s).";
        } else text += "Innocent · no chips.";
        inAGroveUI.RoundSummaryBody.append(inAGroveElement("div", "in-a-grove-result-row", text));
    });
    if (view.game_over && view.final_ranking?.length) {
        const ranking = inAGroveElement("ol", "in-a-grove-ranking");
        view.final_ranking.forEach((entry) => ranking.append(inAGroveElement("li", "",
            inAGrovePlayerName(view, entry.player_id) + " · " + entry.penalty_count + " penalties (" +
            (entry.own_penalty_count || 0) + " own color)")));
        inAGroveUI.RoundSummaryBody.append(ranking);
    }
}

function updateInAGroveActionButtons() {
    const view = currentInAGroveView;
    const phase = view?.phase;
    const target = inAGroveSelectedTargetIndex;
    const selected = Number.isInteger(target);
    const peekCount = inAGrovePeekCount();
    const states = [
        ["PeekBtn", phase === "peek", inAGroveHasLegalAction("peek_suspects") && inAGroveSelectedPeekIndexes.length === peekCount],
        ["BetBtn", phase === "bet", inAGroveHasLegalAction("place_bet") && selected],
        ["NextRoundBtn", phase === "round_end", inAGroveHasLegalAction("next_round")],
        ["PlayAgainBtn", !!view?.game_over, !!view?.game_over],
    ];
    states.forEach(([key, visible, enabled]) => {
        inAGroveUI[key].classList.toggle("hidden", !visible);
        inAGroveUI[key].disabled = !enabled;
    });
    inAGroveUI.PeekBtn.textContent = "🔎 Inspect " + peekCount;
    inAGroveUI.BetBtn.textContent = selected ? "🎯 Accuse suspect " + (target + 1) : "🎯 Accuse suspect";
    const ready = (view?.players || []).filter((player) => player.round_ready).length;
    const youReady = view?.players?.find((player) => player.player_id === view.you)?.round_ready;
    inAGroveUI.NextRoundBtn.textContent = youReady ? "✓ Ready · Waiting" : "Next Round →";

    let hint = "Waiting for the next move.";
    let count = "3 suspects · 1 murderer";
    if (view?.game_over) {
        hint = "The final ranking is below. Fewest penalties wins.";
        count = "Case closed";
    } else if (phase === "round_end") {
        hint = ready + "/" + view.players.length + " ready. Review the revealed scene, then choose Next Round.";
        count = "All suspects revealed";
    } else if (view && view.current_turn !== view.you) {
        hint = inAGrovePlayerName(view, view.current_turn) + " is investigating. Your alibis stay private.";
    } else if (phase === "peek") {
        if (inAGroveSelectedPeekIndexes.length === peekCount) {
            hint = peekCount === 1 ? "One suspect selected. Confirm to inspect only this card."
                : "Two suspects selected. Confirm to inspect them privately.";
        } else if (peekCount === 1) {
            hint = Number.isInteger(view.blocked_suspect_index) ? "Choose 1 of the 2 unblocked suspects to inspect."
                : "First detective: choose 1 of the 3 suspects to inspect.";
        } else {
            hint = Number.isInteger(view.blocked_suspect_index) ? "Select both unblocked suspects to inspect."
                : "First detective: select 2 of the 3 suspects to inspect.";
        }
        count = inAGroveSelectedPeekIndexes.length + "/" + peekCount + " selected";
    } else if (phase === "bet") {
        hint = selected ? "Confirm your accusation on suspect " + (target + 1) + ". Click away to cancel."
            : "Select any suspect, then confirm your accusation. The top chip takes the risk.";
        count = selected ? "Suspect " + (target + 1) + " selected" : "Choose 1 to accuse";
    }
    inAGroveUI.ActionHint.textContent = hint;
    inAGroveUI.SelectionCount.textContent = count;
    updateInAGroveExplainClasses();
}

function renderInAGroveGameState(data) {
    const view = data.view;
    const previousView = currentInAGroveView;
    if (!previousView || ["you", "round", "phase", "current_turn", "peek_count"].some((key) => view[key] !== previousView[key])) {
        clearInAGroveSelection();
    }
    currentInAGroveView = view;
    const inspectionMode = view.config?.inspection_mode || "both";
    inAGroveUI.InspectionModeSelect.value = inspectionMode;
    updateInAGroveConfigHint();
    inAGroveUI.InspectionRule.textContent = inspectionMode === "choose_one"
        ? "Inspect 1 · First: 1 of 3 · Later: 1 of 2"
        : "Inspect 2 · First: 2 of 3 · Later: both";
    if (currentGameType !== "in_a_grove") {
        currentGameType = "in_a_grove";
        setGamePanelVisibility("in_a_grove");
    }
    const phases = { peek: "🔎 Inspect", bet: "🎯 Accuse", round_end: "✓ Reveal", game_over: "🏆 Finished" };
    inAGroveUI.Phase.textContent = phases[view.phase] || "Waiting";
    inAGroveUI.Round.textContent = view.round ?? "—";
    inAGroveUI.Turn.textContent = view.game_over ? "The investigation is complete."
        : view.phase === "round_end" ? "The truth is out. Review together."
        : view.current_turn === view.you ? "Your turn to investigate"
        : inAGrovePlayerName(view, view.current_turn) + "'s turn";
    inAGroveUI.Status.classList.toggle("is-your-turn", view.current_turn === view.you);
    inAGroveUI.FirstPlayer.textContent = inAGrovePlayerName(view, view.first_player);
    inAGroveUI.FirstPlayer.title = inAGroveUI.FirstPlayer.textContent;
    inAGroveUI.Blocked.textContent = Number.isInteger(view.blocked_suspect_index) && !inAGroveIsRevealed(view)
        ? "Suspect " + (view.blocked_suspect_index + 1) : "None";
    inAGroveUI.WinnerBanner.classList.toggle("hidden", !view.winner_ids?.length);
    inAGroveUI.Winner.textContent = (view.winner_ids || []).map((id) => inAGrovePlayerName(view, id)).join(" & ") + " wins!";
    inAGroveUI.Winner.title = inAGroveUI.Winner.textContent;
    renderInAGroveEvidence(view);
    renderInAGroveSuspects(view);
    renderInAGrovePlayers(view);
    renderInAGroveSummary(view, previousView);
    updateInAGroveActionButtons();
    logGameEvents(data);
}

function updateInAGroveExplainClasses() {
    inAGroveUI.Panel.querySelectorAll("button[data-in-a-grove-explain]").forEach((button) => {
        button.classList.toggle("has-explanation", inAGroveExplainMode);
    });
}

function exitInAGroveExplainMode() {
    inAGroveExplainMode = false;
    document.body.classList.remove("in-a-grove-explain-mode");
    inAGroveUI.ExplainBtn.classList.remove("active");
    inAGroveUI.ExplainBtn.setAttribute("aria-pressed", "false");
    inAGroveUI.ExplainNotice.classList.add("hidden");
    updateInAGroveExplainClasses();
}

function toggleInAGroveExplainMode() {
    if (inAGroveExplainMode) {
        exitInAGroveExplainMode();
        return;
    }
    inAGroveExplainMode = true;
    document.body.classList.add("in-a-grove-explain-mode");
    inAGroveUI.ExplainBtn.classList.add("active");
    inAGroveUI.ExplainBtn.setAttribute("aria-pressed", "true");
    inAGroveUI.ExplainNotice.classList.remove("hidden");
    updateInAGroveExplainClasses();
}

function showInAGroveModal(key) {
    inAGroveModalReturnFocus = document.activeElement;
    setModalVisible(inAGroveUI[key + "Modal"], true);
    inAGroveUI[key + "ModalCloseBtn"].focus();
}

function closeInAGroveModal(key) {
    setModalVisible(inAGroveUI[key + "Modal"], false);
    if (inAGroveModalReturnFocus?.isConnected && !inAGroveModalReturnFocus.disabled) {
        inAGroveModalReturnFocus.focus({ preventScroll: true });
    }
    inAGroveModalReturnFocus = null;
}

function showInAGroveExplanation(button) {
    let info = IN_A_GROVE_BUTTON_EXPLANATIONS[button.dataset.inAGroveExplain];
    if (button === inAGroveUI.PeekBtn) {
        info = {
            ...info,
            name: "Inspect " + inAGrovePeekCount() + " (🔎)",
            description: inAGrovePeekCount() === 1
                ? (Number.isInteger(currentInAGroveView?.blocked_suspect_index)
                    ? "Choose one of the two unblocked suspects. " : "Choose one of the three suspects. ") +
                    "Confirm to see only that identity, then proceed to your accusation. You cannot inspect again this turn."
                : "Select two unblocked suspects, then confirm to see both identities privately.",
        };
    }
    if (button.dataset.inAGroveExplain === "suspect") {
        const index = Number(button.dataset.index);
        const suspect = currentInAGroveView?.suspects?.find((entry) => entry.index === index);
        info = {
            name: "Suspect " + (index + 1),
            description: "Select " + inAGrovePeekCount() + " unblocked card(s) to inspect, or any one card to accuse. Confirm with the action below the scene.",
            note: suspect?.blocked
                ? "The previous detective accused this suspect, so you cannot inspect them this turn. You may still accuse them. The top chip's owner takes the whole stack if they are innocent."
                : "Only inspected identities are visible to you before the reveal. First skipped (👁) marks cards the first detective did not see; it does not forbid inspecting those cards later. The top chip is the newest accusation.",
        };
    }
    if (!info) return;
    inAGroveUI.ExplainContent.replaceChildren(
        inAGroveElement("h3", "", info.name),
        inAGroveElement("p", "", info.description),
    );
    if (info.note) inAGroveUI.ExplainContent.append(inAGroveElement("p", "", info.note));
    exitInAGroveExplainMode();
    showInAGroveModal("Explain");
}

Object.keys(IN_A_GROVE_BUTTON_EXPLANATIONS).forEach((key) => {
    inAGroveUI[key].dataset.inAGroveExplain = key;
});

inAGroveUI.PeekBtn.addEventListener("click", () => {
    if (!inAGroveHasLegalAction("peek_suspects") || inAGroveSelectedPeekIndexes.length !== inAGrovePeekCount()) return;
    sendAction({ type: "peek_suspects", suspect_indexes: [...inAGroveSelectedPeekIndexes] });
});
inAGroveUI.BetBtn.addEventListener("click", () => {
    if (!inAGroveHasLegalAction("place_bet") || !Number.isInteger(inAGroveSelectedTargetIndex)) return;
    sendAction({ type: "place_bet", suspect_index: inAGroveSelectedTargetIndex });
});
inAGroveUI.NextRoundBtn.addEventListener("click", () => {
    if (inAGroveHasLegalAction("next_round")) sendAction({ type: "next_round" });
});
inAGroveUI.PlayAgainBtn.addEventListener("click", () => {
    if (currentInAGroveView?.game_over) emitRoomStart();
});
inAGroveUI.HelpBtn.addEventListener("click", () => {
    exitInAGroveExplainMode();
    inAGroveUI.HelpContent.innerHTML = IN_A_GROVE_HELP_HTML;
    const mode = currentInAGroveView?.config?.inspection_mode || getInAGroveConfig().inspection_mode;
    inAGroveUI.HelpContent.prepend(inAGroveElement("p", "", "Current room: " +
        (mode === "choose_one" ? "Inspect 1 of 2 — every detective inspects one card." : "Inspect both — every detective inspects two cards.")));
    showInAGroveModal("Help");
});
inAGroveUI.InspectionModeSelect.addEventListener("change", updateInAGroveConfigHint);
inAGroveUI.ExplainBtn.addEventListener("click", toggleInAGroveExplainMode);

["Help", "Explain"].forEach((key) => {
    inAGroveUI[key + "ModalCloseBtn"].addEventListener("click", () => closeInAGroveModal(key));
    inAGroveUI[key + "Modal"].addEventListener("click", (event) => {
        if (event.target === inAGroveUI[key + "Modal"]) closeInAGroveModal(key);
    });
});

inAGroveUI.Panel.addEventListener("click", (event) => {
    if (inAGroveExplainMode || event.target.closest("button, a, input, select, textarea, summary, .in-a-grove-stack")) return;
    if (!inAGroveSelectedPeekIndexes.length && inAGroveSelectedTargetIndex === null) return;
    clearInAGroveSelection();
    if (currentInAGroveView) renderInAGroveSuspects(currentInAGroveView);
    updateInAGroveActionButtons();
});

document.addEventListener("click", (event) => {
    if (!inAGroveExplainMode || currentGameType !== "in_a_grove") return;
    const button = event.target.closest("button");
    if (!button || [inAGroveUI.HelpBtn, inAGroveUI.ExplainBtn, inAGroveUI.HelpModalCloseBtn, inAGroveUI.ExplainModalCloseBtn].includes(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.dataset.inAGroveExplain) showInAGroveExplanation(button);
}, true);

// Disabled buttons do not dispatch click events, so handle their pointer press.
document.addEventListener("pointerdown", (event) => {
    if (!inAGroveExplainMode || currentGameType !== "in_a_grove" || event.target.closest(".modal")) return;
    const button = [...inAGroveUI.Panel.querySelectorAll("button:disabled[data-in-a-grove-explain]")].find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width && rect.height && event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showInAGroveExplanation(button);
}, true);

document.addEventListener("keydown", (event) => {
    if (currentGameType !== "in_a_grove") return;
    const modal = ["Help", "Explain"].find((key) => !inAGroveUI[key + "Modal"].classList.contains("hidden"));
    if (modal && event.key === "Tab") {
        event.preventDefault();
        inAGroveUI[modal + "ModalCloseBtn"].focus();
    }
    if (event.key !== "Escape") return;
    if (modal) closeInAGroveModal(modal);
    else if (inAGroveExplainMode) exitInAGroveExplainMode();
    else {
        clearInAGroveSelection();
        if (currentInAGroveView) renderInAGroveSuspects(currentInAGroveView);
        updateInAGroveActionButtons();
    }
});

window.renderInAGroveGameState = renderInAGroveGameState;
window.showInAGroveHeaderActions = showInAGroveHeaderActions;
window.clearInAGroveState = clearInAGroveState;
