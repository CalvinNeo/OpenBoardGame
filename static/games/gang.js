let gangCountdownTimer = null;
let gangServerOffsetMs = 0;
let gangAutoLockSent = false;
let gangSelectedSpyTarget = null;
let gangLastLockAt = null;
let gangLastDeadline = null;

let currentGangView = null;

const gangHeaderActions = document.getElementById("gangHeaderActions");
const gangHelpBtn = document.getElementById("gangHelpBtn");
const gangExplainBtn = document.getElementById("gangExplainBtn");
const gangHelpModal = document.getElementById("gangHelpModal");
const gangHelpModalCloseBtn = document.getElementById("gangHelpModalCloseBtn");
const gangExplainModal = document.getElementById("gangExplainModal");
const gangExplainModalCloseBtn = document.getElementById("gangExplainModalCloseBtn");
const gangHelpContent = document.getElementById("gangHelpContent");
const gangExplainContent = document.getElementById("gangExplainContent");

const gangConfigBox = document.getElementById("gangConfigBox");
const gangModeSelect = document.getElementById("gangModeSelect");
const gangTimeSelect = document.getElementById("gangTimeSelect");
const gangPanel = document.getElementById("theGangPanel");
const gangPhaseLabel = document.getElementById("gangPhase");
const gangLevelLabel = document.getElementById("gangLevel");
const gangLivesLabel = document.getElementById("gangLives");
const gangTokensLabel = document.getElementById("gangTokens");
const gangModeLabel = document.getElementById("gangMode");
const gangMissionLabel = document.getElementById("gangMission");
const gangTimerLabel = document.getElementById("gangTimer");
const gangLockLabel = document.getElementById("gangLockTimer");
const gangCommunity = document.getElementById("gangCommunity");
const gangRanking = document.getElementById("gangRanking");
const gangRevealBtn = document.getElementById("gangRevealBtn");
const gangReadyBtn = document.getElementById("gangReadyBtn");
const gangMulliganBtn = document.getElementById("gangMulliganBtn");
const gangSpyTargetSelect = document.getElementById("gangSpyTargetSelect");
const gangSpyBtn = document.getElementById("gangSpyBtn");
const gangNextRoundBtn = document.getElementById("gangNextRoundBtn");
const gangPlayAgainBtn = document.getElementById("gangPlayAgainBtn");
const gangRoundSummary = document.getElementById("gangRoundSummary");
const gangRoundSummaryTitle = document.getElementById("gangRoundSummaryTitle");
const gangRoundSummaryBody = document.getElementById("gangRoundSummaryBody");
const gangRoundSummaryList = document.getElementById("gangRoundSummaryList");
const gangPlayers = document.getElementById("gangPlayers");

const gangYourHand = document.getElementById("gangYourHand");
const gangHandHint = document.getElementById("gangHandHint");
const gangHandOdds = document.getElementById("gangHandOdds");
const gangTooltip = document.getElementById("gangTooltip");
let gangTooltipTimer = null;
let gangTooltipTarget = null;
let gangModalReturnFocus = null;
let gangSuppressExplainClick = false;

const GANG_HELP_TEXT = `
    <h3>Your shared goal</h3>
    <p>Order the whole crew from <strong>strongest to weakest</strong> poker hand. Work with the public community cards and your own two private hole cards to clear levels together.</p>
    <h3>A round at the table</h3>
    <ol>
        <li><strong>Deal / Preflop:</strong> each player receives two hole cards. Mulligan (↻) spends one shared Token (💰) to redeal <em>everyone's</em> hand.</li>
        <li><strong>Flop → Turn → River:</strong> everyone confirms Reveal to open three, then one, then one community card. After the flop, use the ranking arrows (↑ / ↓) or player dropdowns to arrange the crew. Rank 1 is strongest.</li>
        <li><strong>Ready to lock (✓):</strong> on the river, everyone confirms the final ranking. A short countdown then locks it. Cancel Ready or change the ranking to cancel that countdown; moving any player resets everyone's ready state. An optional round Timer (⏱️) also locks the ranking when time runs out.</li>
        <li><strong>Showdown:</strong> all hands are revealed. Compare the actual order with your prediction. The result stays visible until <em>every player</em> clicks Next Round.</li>
    </ol>
    <h3>Reading the cards</h3>
    <p>Spades (♠️), Hearts (♥️), Diamonds (♦️), Clubs (♣️). A = Ace, K = King, Q = Queen, J = Jack. Hearts and diamonds are red. Face-down cards (◇) stay private unless revealed by Spy (👁️) or showdown. Empty dashed slots are community cards still to come.</p>
    <p>Use the best five cards from your two hole cards and the board. Outside Expert mode, gold outlines mark the cards in your best hand. In Novice mode, estimated win odds also appear beside your hand.</p>
    <h3>Poker hands · strongest first</h3>
    <ol>
        <li><strong>Straight flush:</strong> five consecutive cards of one suit. A–K–Q–J–10 is a royal flush.</li>
        <li><strong>Four of a kind:</strong> four cards of the same rank.</li>
        <li><strong>Full house:</strong> three of a kind plus a pair.</li>
        <li><strong>Flush:</strong> five cards of one suit.</li>
        <li><strong>Straight:</strong> five consecutive ranks. An ace can be high or low.</li>
        <li><strong>Three of a kind</strong>, then <strong>two pair</strong>, then <strong>one pair</strong>, then <strong>high card</strong>.</li>
    </ol>
    <p>Compare ranks and kickers to break ties. Exactly tied hands may appear in either order.</p>
    <h3>Team resources</h3>
    <ul>
        <li><strong>Lives (❤️):</strong> shared by the team. An unsuccessful round costs one life and you retry the level. Clearing each fifth level restores one life, up to the maximum.</li>
        <li><strong>Tokens (💰):</strong> Mulligan (↻) and Spy (👁️) each cost one. Spy publicly reveals one random hole card from the chosen teammate. A perfect clear may earn a token.</li>
        <li><strong>Mission (🎯):</strong> Expert mode adds an extra requirement that must also be met.</li>
    </ul>
    <h3>Modes</h3>
    <p><strong>Novice:</strong> small placement errors are tolerated and estimated win odds are shown. <strong>Normal:</strong> the exact order is required, except for ties. <strong>Expert:</strong> no hand hints, plus missions.</p>
    <h3>Controls</h3>
    <p>Help (?) opens these rules. Explain (magnifier) lets you select a control or area, including a disabled button, to read its description without playing an action. Press Esc to close a dialog or exit Explain. Hover or tap a card or status indicator for a short description.</p>
`;

const GANG_BUTTON_EXPLANATIONS = {
    gangRevealBtn: { name: "Reveal the next cards", description: "Confirm that you are ready to reveal the next community cards: flop (3), turn (1), then river (1). The board advances only when everyone has confirmed." },
    gangReadyBtn: { name: "Ready to lock (✓)", description: "Confirm the team ranking. When everyone is ready, the lock countdown starts. You can cancel your ready state. Moving any player also clears everyone's ready state." },
    gangMulliganBtn: { name: "Mulligan (↻) · 1 Token (💰)", description: "Redeal every player's two hole cards, including yours. Available only before the flop and while the team has a token. This also resets reveal confirmations." },
    gangSpyTargetSelect: { name: "Spy target", description: "Choose a teammate for Spy (👁️). Spy publicly reveals one random hole card from that player's hand." },
    gangSpyBtn: { name: "Spy (👁️) · 1 Token (💰)", description: "Reveal one random hole card from the selected teammate to everyone. Available after the flop while the team has a token." },
    gangRankingSlot: { name: "Team ranking · strongest first", description: "Rank 1 is the strongest predicted poker hand. Use ↑ / ↓ to move a player one place, or choose a player in a dropdown to move them directly to that position. Other players shift to make room. Any move resets all ready confirmations. Ranking opens after the flop." },
    gangNextRoundBtn: { name: "Next Round", description: "Confirm that you have finished reviewing the result. The next round begins only when every player confirms. A failed level is retried." },
    gangPlayAgainBtn: { name: "Play Again", description: "Start a fresh game with the same players after the team runs out of lives." },
    gangProgress: { name: "Level", description: "The team's current level. Success advances the level; failure costs a life and retries it. At showdown this displays the level of the next attempt." },
    gangLivesInfo: { name: "Lives (❤️)", description: "The team shares these lives. An unsuccessful round costs one life. Clearing every fifth level restores one life, up to the maximum." },
    gangTokensInfo: { name: "Tokens (💰)", description: "Shared resources for Mulligan (↻) and Spy (👁️). Each costs one token. A perfect clear may award another token." },
    gangModeInfo: { name: "Game mode", description: "Novice tolerates small ranking errors and shows estimated win odds. Normal requires exact ranking, allowing ties. Expert adds a Mission (🎯) and hides hand hints." },
    gangStagesInfo: { name: "Round progress", description: "Deal two private cards, reveal the Flop (3), Turn (1), and River (1), then lock the ranking for Showdown. The highlighted step is the current stage." },
    gangCommunityInfo: { name: "Community cards", description: "Everyone shares these five cards. Combine them with your two hole cards to make your best five-card poker hand. Dashed slots are unrevealed cards. Gold outlines show cards used in your best hand outside Expert mode." },
    gangHandInfo: { name: "Your hand", description: "Your two hole cards are private until Spy (👁️) reveals a card or the round reaches showdown. Spades (♠️), Hearts (♥️), Diamonds (♦️), Clubs (♣️). Gold outlines mark your best hand outside Expert mode." },
    gangMissionInfo: { name: "Mission (🎯)", description: "In Expert mode, the team must meet this extra requirement as well as ordering the poker hands correctly." },
};

function updateGangConfigRow() {
  const showRow = currentRoomState && currentGameType === "the_gang" && currentRoomState.status === "lobby";
  if (gangConfigBox) {
    gangConfigBox.classList.toggle("hidden", !showRow);
    gangConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function clearGangState() {
    currentGangView = null;
    gangAutoLockSent = false;
    gangSelectedSpyTarget = null;
    gangLastLockAt = null;
    gangLastDeadline = null;
    if (gangCountdownTimer) clearInterval(gangCountdownTimer);
    gangCountdownTimer = null;
    exitGangExplainMode();
    closeGangHelpModal();
    closeGangExplainModal();
    hideGangTooltip();
    [gangCommunity, gangRanking, gangPlayers, gangYourHand, gangSpyTargetSelect, gangRoundSummaryList].forEach((element) => element?.replaceChildren());
    [gangPhaseLabel, gangLevelLabel, gangLivesLabel, gangTokensLabel, gangTimerLabel, gangLockLabel].forEach((element) => {
        if (element) element.textContent = "—";
    });
    gangSetVisible("gangRoundSummary", false);
    gangSetVisible("gangTimers", false);
    updateGangActionButtons();
}

function gangSetVisible(id, visible) {
    document.getElementById(id)?.classList.toggle("hidden", !visible);
}

function gangSetText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

function gangPlayerReady(player, phase) {
    if (["preflop", "flop", "turn"].includes(phase)) return !!player.reveal_ready;
    if (phase === "showdown") return !!player.next_ready;
    return phase === "river" && !!player.ready;
}

function gangPlayerStatus(player, phase) {
    if (phase === "game_over") return "Hand revealed";
    if (phase === "showdown") return player.next_ready ? "✓ Next round ready" : "Reviewing result";
    if (phase === "river") return player.ready ? "✓ Ready to lock" : "Considering";
    return player.reveal_ready ? "✓ Ready to reveal" : "Considering";
}

function gangCardKey(card) {
    return card && !card.hidden ? `${card.rank}-${card.suit}` : "";
}

function gangBestCards(view) {
    if (view.mode === "expert") return new Set();
    const you = (view.players || []).find((player) => player.player_id === view.you);
    return new Set((you?.hand_hint?.best_cards || []).map(gangCardKey));
}

function createGangCardElement(card, placeholder = false) {
    const element = document.createElement("div");
    element.className = "gang-card";
    element.setAttribute("role", "img");
    element.tabIndex = 0;
    if (!card || card.hidden || placeholder) {
        element.classList.add(placeholder ? "is-placeholder" : "is-facedown");
        const back = document.createElement("span");
        back.className = "gang-card-back";
        back.textContent = placeholder ? "·" : "◇";
        back.setAttribute("aria-hidden", "true");
        element.appendChild(back);
        element.dataset.gangTip = placeholder ? "Community card · not revealed yet" : "Face-down card · private until revealed";
    } else {
        const rank = card.rank;
        const label = {14: "A", 13: "K", 12: "Q", 11: "J"}[rank] || String(rank);
        const suit = String(card.suit || "").toUpperCase();
        const symbols = {S: "♠", H: "♥", D: "♦", C: "♣"};
        const names = {S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs"};
        const symbol = symbols[suit] || "?";
        element.classList.toggle("is-red", suit === "H" || suit === "D");
        const corner = document.createElement("span");
        corner.className = "gang-card-corner";
        corner.textContent = label;
        const smallSuit = document.createElement("small");
        smallSuit.textContent = symbol;
        corner.appendChild(smallSuit);
        const center = document.createElement("span");
        center.className = "gang-card-suit";
        center.textContent = symbol;
        element.append(corner, center);
        element.dataset.gangTip = `${{14: "Ace", 13: "King", 12: "Queen", 11: "Jack"}[rank] || rank} of ${names[suit] || suit}`;
        if (card.revealed) element.dataset.gangTip += " · publicly revealed";
    }
    element.setAttribute("aria-label", element.dataset.gangTip);
    return element;
}

function renderGangCommunity(view) {
    if (!gangCommunity) return;
    gangCommunity.replaceChildren();
    const cards = view.community_cards || [];
    const best = gangBestCards(view);
    for (let index = 0; index < 5; index += 1) {
        const card = cards[index];
        const element = createGangCardElement(card, !card);
        element.classList.toggle("highlight", !!card && best.has(gangCardKey(card)));
        gangCommunity.appendChild(element);
    }
    gangSetText("gangCommunityCount", `${cards.length} / 5 revealed`);
    const you = (view.players || []).find((player) => player.player_id === view.you);
    gangYourHand.replaceChildren();
    (you?.hand || []).forEach((card) => {
        const element = createGangCardElement(card);
        element.classList.toggle("highlight", best.has(gangCardKey(card)));
        gangYourHand.appendChild(element);
    });
    gangSetText("gangHandLabel", you ? "YOUR HAND" : "SPECTATING");
    gangHandHint.textContent = !you ? "Follow the crew" : view.mode !== "expert" && you.hand_hint ? you.hand_hint.hand_name : "Private cards";
    const showOdds = view.mode === "novice" && Number.isFinite(you?.hand_odds);
    gangHandOdds.classList.toggle("hidden", !showOdds);
    gangHandOdds.textContent = showOdds ? `Estimated win odds · ${Math.round(you.hand_odds * 100)}%` : "";
    const revealed = you?.hand?.some((card) => card.revealed);
    const showdown = ["showdown", "game_over"].includes(view.phase);
    gangSetText("gangTableNote", showdown ? "Showdown · all hands are now public." : revealed ? "Spy has made a card in your hand public." : you ? "Your hole cards stay private until revealed." : "Players' hole cards stay private until revealed.");
}

function renderGangRanking(view) {
    if (!gangRanking) return;
    // Preserve keyboard focus across server updates after moving a player.
    const focused = gangRanking.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused?.dataset.gangFocus;
    gangRanking.replaceChildren();
    const ranking = view.ranking || [];
    const players = view.players || [];
    const canMove = (view.legal_actions || []).includes("move_rank");
    ranking.forEach((pid, index) => {
        const player = players.find((entry) => entry.player_id === pid);
        if (!player) return;
        const row = document.createElement("div");
        row.className = "gang-slot";
        row.classList.toggle("you", pid === view.you);
        const chip = document.createElement("span");
        chip.className = "gang-rank-chip";
        chip.textContent = index + 1;
        chip.dataset.gangTip = `Rank ${index + 1}${index === 0 ? " · strongest hand" : index === ranking.length - 1 ? " · weakest hand" : ""}`;
        chip.tabIndex = 0;
        const identity = document.createElement("div");
        identity.className = "gang-rank-identity";
        const select = document.createElement("select");
        select.className = "gang-rank-select";
        select.dataset.gangExplain = "gangRankingSlot";
        select.dataset.gangFocus = `select-${pid}`;
        select.setAttribute("aria-label", `Player at rank ${index + 1}`);
        players.forEach((entry) => {
            const option = document.createElement("option");
            option.value = entry.player_id;
            option.textContent = `${entry.name || entry.player_id}${entry.player_id === view.you ? " · You" : ""}`;
            select.appendChild(option);
        });
        select.value = pid;
        select.title = `${player.name || pid}${pid === view.you ? " · You" : ""}`;
        select.disabled = !canMove;
        select.addEventListener("change", () => sendAction({type: "move_rank", player_id: select.value, to_index: index}));
        const status = document.createElement("span");
        status.className = "gang-rank-status";
        status.classList.toggle("is-ready", gangPlayerReady(player, view.phase));
        status.textContent = gangPlayerReady(player, view.phase) ? "✓ Ready" : ["showdown", "game_over"].includes(view.phase) ? "Revealed" : "Considering";
        status.dataset.gangTip = gangPlayerStatus(player, view.phase);
        status.tabIndex = 0;
        const detail = document.createElement("div");
        detail.className = "gang-rank-detail";
        const hand = document.createElement("div");
        hand.className = "gang-rank-hand";
        (player.hand || []).forEach((card) => hand.appendChild(createGangCardElement(card)));
        detail.append(status, hand);
        identity.append(select, detail);
        const moves = document.createElement("div");
        moves.className = "gang-rank-moves";
        [-1, 1].forEach((direction) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "gang-move";
            button.textContent = direction < 0 ? "↑" : "↓";
            button.dataset.gangExplain = "gangRankingSlot";
            button.dataset.gangFocus = `${pid}-${direction}`;
            const title = `Move ${player.name || pid} ${direction < 0 ? "up" : "down"} one rank`;
            button.setAttribute("aria-label", title);
            button.title = title;
            button.disabled = !canMove || index + direction < 0 || index + direction >= ranking.length;
            button.addEventListener("click", () => sendAction({type: "move_rank", player_id: pid, to_index: index + direction}));
            moves.appendChild(button);
        });
        row.append(chip, identity, moves);
        gangRanking.appendChild(row);
    });
    if (focusKey) {
        const target = Array.from(gangRanking.querySelectorAll("[data-gang-focus]")).find((element) => element.dataset.gangFocus === focusKey);
        if (target && !target.disabled) target.focus({preventScroll: true});
    }
    gangSetText("gangRankingHint", view.phase === "preflop" ? "Ranking opens after the flop." : ["showdown", "game_over"].includes(view.phase) ? "Final prediction · compare the result below." : "↑ ↓ to reorder · a move resets everyone's ready state.");
}

function renderGangSpyTargets(view) {
  if (!gangSpyTargetSelect) {
    return;
  }
  const players = Array.isArray(view.players)
    ? view.players.filter((p) => p.player_id !== view.you)
    : [];
  gangSpyTargetSelect.innerHTML = "";
  if (!players.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No targets";
    gangSpyTargetSelect.appendChild(option);
    gangSpyTargetSelect.disabled = true;
    gangSelectedSpyTarget = null;
    return;
  }
  gangSpyTargetSelect.disabled = false;
  players.forEach((player) => {
    const option = document.createElement("option");
    option.value = player.player_id;
    option.textContent = player.name || player.player_id;
    gangSpyTargetSelect.appendChild(option);
  });
  if (gangSelectedSpyTarget && players.some((p) => p.player_id === gangSelectedSpyTarget)) {
    gangSpyTargetSelect.value = gangSelectedSpyTarget;
  } else {
    gangSelectedSpyTarget = players[0].player_id;
    gangSpyTargetSelect.value = gangSelectedSpyTarget;
  }
}

function renderGangPlayers(view) {
    if (!gangPlayers) return;
    gangPlayers.replaceChildren();
    const players = view.players || [];
    gangSetText("gangCrewCount", `${players.length} players · one team`);
    players.forEach((player) => {
        const card = document.createElement("div");
        card.className = "gang-player-card";
        card.classList.toggle("ready", gangPlayerReady(player, view.phase));
        card.classList.toggle("you", player.player_id === view.you);
        const header = document.createElement("div");
        header.className = "gang-player-heading";
        const name = document.createElement("span");
        name.className = "gang-player-name";
        name.textContent = player.name || player.player_id;
        header.appendChild(name);
        if (player.player_id === view.you) {
            const tag = document.createElement("span");
            tag.className = "gang-you-tag";
            tag.textContent = "YOU";
            header.appendChild(tag);
        }
        const status = document.createElement("div");
        status.className = "gang-badge";
        status.textContent = gangPlayerStatus(player, view.phase);
        const hand = document.createElement("div");
        hand.className = "gang-player-hand";
        (player.hand || []).forEach((slot) => hand.appendChild(createGangCardElement(slot)));
        card.append(header, status, hand);
        gangPlayers.appendChild(card);
    });
}

function renderGangSummary(view) {
    const summary = view.round_summary;
    gangRoundSummary.classList.toggle("hidden", !summary);
    gangRoundSummaryList.replaceChildren();
    if (!summary) return;
    gangRoundSummary.classList.toggle("is-failure", !summary.success);
    gangRoundSummaryTitle.textContent = view.game_over ? "Heist over" : summary.success ? "✓ Level cleared" : "One life lost · try again";
    const details = [];
    if (summary.perfect) details.push("Perfect clear");
    if (view.mission) details.push(summary.mission_success ? "🎯 Mission complete" : "🎯 Mission failed");
    details.push(view.game_over ? "The team is out of lives." : "Review together before continuing.");
    gangRoundSummaryBody.textContent = details.join(" · ");
    const orders = [
        ["Actual", (summary.actual_groups || []).map((group) => group.map((pid) => findPlayerName(view, pid)).join(" = ")).join(" → ")],
        ["Predicted", (summary.predicted_order || []).map((pid) => findPlayerName(view, pid)).join(" → ")],
    ];
    orders.forEach(([label, order]) => {
        const line = document.createElement("div");
        line.className = "gang-summary-order";
        const title = document.createElement("strong");
        title.textContent = label;
        const text = document.createElement("span");
        text.textContent = order || "—";
        line.append(title, text);
        gangRoundSummaryList.appendChild(line);
    });
    const hands = document.createElement("div");
    hands.className = "gang-summary-hands";
    (summary.hands || []).forEach((entry) => {
        const line = document.createElement("div");
        line.className = "gang-summary-hand";
        const name = document.createElement("strong");
        name.textContent = findPlayerName(view, entry.player_id);
        const handName = document.createElement("span");
        handName.textContent = entry.hand_name;
        const cards = document.createElement("div");
        cards.className = "gang-player-hand";
        (entry.best_cards || []).forEach((card) => cards.appendChild(createGangCardElement(card)));
        line.append(name, handName, cards);
        hands.appendChild(line);
    });
    gangRoundSummaryList.appendChild(hands);
}

function updateGangTimers(view) {
    if (gangCountdownTimer) clearInterval(gangCountdownTimer);
    gangCountdownTimer = null;
    const isRiver = view?.phase === "river";
    const lockAt = isRiver && Number.isFinite(view.lock_at_ms) ? view.lock_at_ms : null;
    const deadline = isRiver && Number.isFinite(view.river_deadline_ms) ? view.river_deadline_ms : null;
    gangSetVisible("gangTimers", !!(lockAt || deadline));
    gangSetVisible("gangTimerWrap", !!deadline);
    gangSetVisible("gangLockWrap", !!lockAt);
    if (lockAt !== gangLastLockAt || deadline !== gangLastDeadline) gangAutoLockSent = false;
    gangLastLockAt = lockAt;
    gangLastDeadline = deadline;
    if (!lockAt && !deadline) {
        gangAutoLockSent = false;
        return;
    }
    const serverNow = Number.isFinite(view.server_time_ms) ? view.server_time_ms : Date.now();
    gangServerOffsetMs = serverNow - Date.now();
    const isPlayer = (view.players || []).some((player) => player.player_id === view.you);
    const update = () => {
        const now = Date.now() + gangServerOffsetMs;
        const seconds = (end) => Math.max(0, Math.ceil((end - now) / 1000));
        gangLockLabel.textContent = lockAt ? `${seconds(lockAt)}s` : "—";
        gangTimerLabel.textContent = deadline ? `${seconds(deadline)}s` : "—";
        document.getElementById("gangTimerWrap").classList.toggle("is-urgent", !!deadline && seconds(deadline) <= 10);
        if (isPlayer && !gangAutoLockSent && ((lockAt && now >= lockAt) || (deadline && now >= deadline))) {
            gangAutoLockSent = true;
            sendAction({type: "lock_in"});
        }
    };
    update();
    gangCountdownTimer = setInterval(update, 250);
}

function updateGangActionButtons(view) {
    const actions = view?.legal_actions || [];
    const players = view?.players || [];
    const you = players.find((player) => player.player_id === view?.you);
    const phase = view?.phase;
    const revealing = ["preflop", "flop", "turn"].includes(phase);
    const nextStreet = {preflop: "flop", flop: "turn", turn: "river"}[phase];
    const buttons = [
        [gangRevealBtn, "reveal_next", revealing, you?.reveal_ready ? "✓ Waiting for the crew" : `Reveal ${nextStreet || "next"} →`],
        [gangReadyBtn, "toggle_ready", phase === "river", you?.ready ? "✓ Ready · Cancel" : "Ready to lock ✓"],
        [gangNextRoundBtn, "next_round", phase === "showdown" && !view?.game_over, you?.next_ready ? "✓ Waiting for the crew" : "Next Round →"],
        [gangPlayAgainBtn, "play_again", phase === "game_over" || view?.game_over, "Play Again"],
        [gangMulliganBtn, "mulligan", phase === "preflop", "↻ Mulligan · redeal all hands"],
        [gangSpyBtn, "spy", ["flop", "turn", "river"].includes(phase), "👁️ Spy"],
    ];
    buttons.forEach(([button, action, visible, label]) => {
        if (!button) return;
        button.classList.toggle("hidden", !visible);
        button.textContent = label;
        button.disabled = !actions.includes(action);
    });
    if (gangReadyBtn) gangReadyBtn.setAttribute("aria-pressed", String(!!you?.ready));
    gangSetVisible("gangSpyControls", ["flop", "turn", "river"].includes(phase));
    gangSetVisible("gangTools", !!you && ["preflop", "flop", "turn", "river"].includes(phase));
    if (gangSpyTargetSelect) gangSpyTargetSelect.disabled = !actions.includes("spy") || !gangSelectedSpyTarget;
    if (gangSpyBtn) gangSpyBtn.disabled = !actions.includes("spy") || !gangSelectedSpyTarget;
    const readyCount = players.filter((player) => gangPlayerReady(player, phase)).length;
    gangSetText("gangReadyCount", phase === "game_over" ? "" : `${readyCount} / ${players.length} ready`);
    let title = revealing ? `Reveal the ${nextStreet}` : phase === "river" ? "Agree on the order" : phase === "showdown" ? "Review the result" : "Heist complete";
    let hint = revealing ? "Everyone confirms to reveal the next cards." : phase === "river" ? "All ready starts the lock countdown." : phase === "showdown" ? "The next round waits for every player." : "Start a fresh game with your crew.";
    if (you && gangPlayerReady(you, phase)) {
        const waiting = players.length - readyCount;
        hint = waiting ? `Waiting for ${waiting} teammate${waiting === 1 ? "" : "s"} to confirm.` : phase === "river" ? "Everyone is ready. The ranking will lock shortly." : "Everyone is ready.";
    }
    if (!you) { title = "Spectating"; hint = "Follow the crew as they build their ranking."; }
    gangSetText("gangActionTitle", title);
    gangSetText("gangActionHint", hint);
}

function renderGangGameState(data) {
    const view = data.view;
    currentGangView = view;
    if (currentGameType !== "the_gang") {
        currentGameType = "the_gang";
        setGamePanelVisibility("the_gang");
    }
    hideGangTooltip();
    const phaseLabels = {preflop: "Deal · preflop", flop: "The flop", turn: "The turn", river: "The river", showdown: "Showdown", game_over: "Game over"};
    gangPhaseLabel.textContent = phaseLabels[view.phase] || view.phase;
    gangLevelLabel.textContent = view.level ?? "—";
    gangLivesLabel.textContent = `${view.lives ?? "—"} / ${view.max_lives ?? "—"}`;
    gangTokensLabel.textContent = view.tokens ?? "—";
    gangModeLabel.textContent = `${(view.mode || "normal").slice(0, 1).toUpperCase()}${(view.mode || "normal").slice(1)}`;
    gangModeLabel.dataset.gangTip = GANG_BUTTON_EXPLANATIONS.gangModeInfo.description;
    gangMissionLabel.textContent = view.mission ? view.mission.desc || view.mission.id : "";
    gangSetVisible("gangMissionRow", !!view.mission);
    const phases = ["preflop", "flop", "turn", "river", "showdown"];
    const step = phases.indexOf(view.phase === "game_over" ? "showdown" : view.phase);
    document.querySelectorAll("#gangStages li").forEach((element, index) => {
        element.classList.toggle("is-current", index === step);
        element.classList.toggle("is-complete", index < step);
        if (index === step) element.setAttribute("aria-current", "step");
        else element.removeAttribute("aria-current");
    });
    renderGangCommunity(view);
    renderGangRanking(view);
    renderGangSpyTargets(view);
    renderGangPlayers(view);
    renderGangSummary(view);
    updateGangActionButtons(view);
    updateGangTimers(view);
    if (gangExplainMode) updateGangExplainModeClasses(true);
    logGameEvents(data);
}

let gangExplainMode = false;

function showGangHeaderActions(show) {
    if (gangHeaderActions) gangHeaderActions.style.display = show ? "flex" : "none";
    if (!show) {
        exitGangExplainMode();
        closeGangHelpModal();
        closeGangExplainModal();
        hideGangTooltip();
        if (gangCountdownTimer) clearInterval(gangCountdownTimer);
        gangCountdownTimer = null;
    }
}

function showGangModal(modal, closeButton) {
    hideGangTooltip();
    gangModalReturnFocus = document.activeElement;
    setModalVisible(modal, true);
    closeButton?.focus();
}

function closeGangModal(modal) {
    if (!modal || modal.classList.contains("hidden")) return;
    setModalVisible(modal, false);
    if (gangModalReturnFocus?.isConnected && gangModalReturnFocus.getClientRects().length) {
        gangModalReturnFocus.focus({preventScroll: true});
    }
    gangModalReturnFocus = null;
}

function showGangHelpModal() {
    exitGangExplainMode();
    gangHelpContent.innerHTML = GANG_HELP_TEXT;
    showGangModal(gangHelpModal, gangHelpModalCloseBtn);
}

function closeGangHelpModal() {
    closeGangModal(gangHelpModal);
}

function closeGangExplainModal() {
    closeGangModal(gangExplainModal);
}

function updateGangExplainModeClasses(enabled) {
    gangPanel.querySelectorAll("[data-gang-explain]").forEach((element) => element.classList.toggle("has-explanation", enabled));
    gangExplainBtn?.classList.toggle("active", enabled);
    gangExplainBtn?.setAttribute("aria-pressed", String(enabled));
    document.body.classList.toggle("gang-explain-mode", enabled);
    gangSetVisible("gangExplainNotice", enabled);
}

function toggleGangExplainMode() {
    gangExplainMode = !gangExplainMode;
    hideGangTooltip();
    updateGangExplainModeClasses(gangExplainMode);
}

function exitGangExplainMode() {
    gangExplainMode = false;
    updateGangExplainModeClasses(false);
}

function findGangExplanationAtPoint(x, y, target) {
    const closest = target.closest?.("[data-gang-explain]");
    if (closest && gangPanel.contains(closest)) return closest;
    // Coordinate lookup also reaches disabled controls in browsers that retarget events.
    return Array.from(gangPanel.querySelectorAll("[data-gang-explain]")).reverse().find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width && rect.height && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
}

function showGangButtonExplanation(key) {
    const explanation = GANG_BUTTON_EXPLANATIONS[key];
    if (!explanation) return;
    gangExplainContent.replaceChildren();
    const title = document.createElement("h4");
    title.textContent = explanation.name;
    const body = document.createElement("p");
    body.textContent = explanation.description;
    gangExplainContent.append(title, body);
    showGangModal(gangExplainModal, gangExplainModalCloseBtn);
    exitGangExplainMode();
}

function gangExplainExempt(target) {
    const button = target.closest?.("button");
    return [gangExplainBtn, gangHelpBtn, gangHelpModalCloseBtn, gangExplainModalCloseBtn].includes(button);
}

function hideGangTooltip() {
    if (gangTooltipTimer) clearTimeout(gangTooltipTimer);
    gangTooltipTimer = null;
    gangTooltipTarget?.removeAttribute("aria-describedby");
    gangTooltipTarget = null;
    gangTooltip?.classList.add("hidden");
}

function showGangTooltip(target, timed = false) {
    if (!target?.dataset.gangTip || gangExplainMode) return;
    hideGangTooltip();
    gangTooltipTarget = target;
    gangTooltip.textContent = target.dataset.gangTip;
    gangTooltip.classList.remove("hidden");
    target.setAttribute("aria-describedby", "gangTooltip");
    const rect = target.getBoundingClientRect();
    const width = gangTooltip.offsetWidth;
    const height = gangTooltip.offsetHeight;
    gangTooltip.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2))}px`;
    const top = rect.top >= height + 16 ? rect.top - height - 8 : rect.bottom + 8;
    gangTooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, top))}px`;
    if (timed) gangTooltipTimer = setTimeout(hideGangTooltip, 3000);
}

gangHelpBtn?.setAttribute("aria-label", "Help");
gangHelpBtn?.setAttribute("title", "Help · game rules");
gangExplainBtn?.setAttribute("aria-label", "Explain");
gangExplainBtn?.setAttribute("title", "Explain · select a control or area");
gangExplainBtn?.setAttribute("aria-pressed", "false");
gangHelpBtn?.addEventListener("click", showGangHelpModal);
gangHelpModalCloseBtn?.addEventListener("click", closeGangHelpModal);
gangExplainBtn?.addEventListener("click", toggleGangExplainMode);
gangExplainModalCloseBtn?.addEventListener("click", closeGangExplainModal);
[gangHelpModal, gangExplainModal].forEach((modal) => modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeGangModal(modal);
}));

document.addEventListener("pointerdown", (event) => {
    gangSuppressExplainClick = false;
    if (!gangExplainMode || gangExplainExempt(event.target)) return;
    const explanation = findGangExplanationAtPoint(event.clientX, event.clientY, event.target);
    if (explanation || event.target.closest?.("button, select, input, a, summary")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        gangSuppressExplainClick = true;
        if (explanation) showGangButtonExplanation(explanation.dataset.gangExplain);
    }
}, true);

document.addEventListener("click", (event) => {
    // The pointerdown that opened Explain must never also activate a game action.
    if (gangSuppressExplainClick) {
        gangSuppressExplainClick = false;
        if (event.detail > 0) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
    }
    if (!gangExplainMode || gangExplainExempt(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const explanation = event.target.closest?.("[data-gang-explain]");
    if (explanation && gangPanel.contains(explanation)) showGangButtonExplanation(explanation.dataset.gangExplain);
}, true);

document.addEventListener("keydown", (event) => {
    if (currentGameType !== "the_gang") return;
    if (event.key === "Escape") {
        exitGangExplainMode();
        closeGangHelpModal();
        closeGangExplainModal();
        hideGangTooltip();
    }
    const modal = [gangHelpModal, gangExplainModal].find((element) => element && !element.classList.contains("hidden"));
    if (modal && event.key === "Tab") {
        const focusable = Array.from(modal.querySelectorAll("button, [href], select, [tabindex='0']")).filter((element) => !element.disabled && element.getClientRects().length);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (gangExplainMode && ["Enter", " "].includes(event.key) && !gangExplainExempt(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const explanation = event.target.closest?.("[data-gang-explain]");
        if (explanation) showGangButtonExplanation(explanation.dataset.gangExplain);
    }
}, true);

gangPanel?.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const target = event.target.closest("[data-gang-tip]");
    if (target && target !== gangTooltipTarget) showGangTooltip(target);
});
gangPanel?.addEventListener("pointerout", (event) => {
    if (gangTooltipTarget && !gangTooltipTarget.contains(event.relatedTarget)) hideGangTooltip();
});
gangPanel?.addEventListener("focusin", (event) => {
    const target = event.target.closest("[data-gang-tip]");
    if (target) showGangTooltip(target);
});
gangPanel?.addEventListener("focusout", hideGangTooltip);
gangPanel?.addEventListener("click", (event) => {
    const target = event.target.closest("[data-gang-tip]");
    if (target) showGangTooltip(target, true);
    else hideGangTooltip();
});
window.addEventListener("resize", hideGangTooltip);
window.addEventListener("scroll", hideGangTooltip, true);

[
    [gangRevealBtn, "reveal_next"],
    [gangReadyBtn, "toggle_ready"],
    [gangMulliganBtn, "mulligan"],
    [gangNextRoundBtn, "next_round"],
    [gangPlayAgainBtn, "play_again"],
].forEach(([button, type]) => button?.addEventListener("click", () => sendAction({type})));

gangSpyTargetSelect?.addEventListener("change", () => {
    gangSelectedSpyTarget = gangSpyTargetSelect.value || null;
});
gangSpyBtn?.addEventListener("click", () => {
    if (gangSelectedSpyTarget) sendAction({type: "spy", target_player_id: gangSelectedSpyTarget});
});

if (typeof currentRoomState !== "undefined") updateGangConfigRow();
