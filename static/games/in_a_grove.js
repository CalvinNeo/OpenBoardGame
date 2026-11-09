let currentInAGroveView = null;
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


const IN_A_GROVE_EXPLAIN = {
    peek: {
        zh: "查验嫌疑人：选中规定数量的嫌疑人后确认，私下看到他们的身份。被封锁的嫌疑人不能查验，只选牌并不会提交行动。本回合确认查验后必须指认，不能再查验其他牌。",
        en: "Inspect suspects: select the required number of suspects, then confirm to see their identities privately. A blocked suspect cannot be inspected, and choosing cards alone does not submit a move. After confirming an inspection you must accuse and cannot inspect another card this turn."
    },
    bet: {
        zh: "指认嫌疑人：把自己的一枚筹码放到选中的嫌疑人身上，压在已有筹码之上。任何嫌疑人都可以指认，包括被封锁的那位。若对方无罪，最上层筹码的持有者要拿走整叠作为罚分。",
        en: "Accuse a suspect: place one of your chips on the selected suspect, on top of any existing chips. You may accuse any suspect, even the blocked one. If they are innocent, the top chip's owner takes the entire stack as penalties."
    },
    next_round: {
        zh: "Next Round：确认你已看完本轮。所有人确认后才进入下一副牌或最终排名，按钮变灰表示你的确认已被记录。",
        en: "Next Round: confirm that you have finished reviewing this round. Everyone must confirm before the next deal or final ranking, and a disabled button means your confirmation is already recorded."
    },
    play_again: {
        zh: "开始新的一局：用当前这些玩家重新开一局密林之谜。",
        en: "Start a new game: start a fresh In a Grove game with these players."
    },
    suspect: {
        zh: "嫌疑人：选中规定数量的未被封锁的牌来查验，或者选中任意一张牌来指认，然后用场景下方的按钮确认。只有查验过的身份会在揭晓前对你可见。首个跳过(👁)标记第一位侦探没有看过的牌，它并不禁止查验。",
        en: "Suspect: select the required number of unblocked cards to inspect, or any one card to accuse, then confirm with the action below the scene. Only inspected identities are visible to you before the reveal, and First skipped (👁) marks cards the first detective did not see without forbidding inspection."
    },
    dialog_close: {
        zh: "关闭当前对话框并回到现场。",
        en: "Close the current dialog and return to the scene."
    }
};

const IN_A_GROVE_EXPLAIN_KEYS = { PeekBtn: "peek", BetBtn: "bet", NextRoundBtn: "next_round", PlayAgainBtn: "play_again" };

const IN_A_GROVE_HELP_CONFIG = {
    gameId: "in_a_grove",
    title: { zh: "密林之谜 · In a Grove", en: "In a Grove" },
    basic: {
        win: {
            zh: "结束时罚分筹码最少者获胜。每位侦探开局有 7 枚指认筹码。",
            en: "Finish with the fewest penalty chips. Each detective starts with 7 accusation chips."
        },
        turn: {
            zh: "轮到你时先按规定数量查验嫌疑人，私下看到身份后必须指认一位，把一枚筹码压到他的牌上。",
            en: "On your turn you first inspect the required number of suspects, and once you have privately seen their identities you must accuse one of them by stacking one of your chips on their card."
        },
        key: {
            zh: "凶手是数字最大的那位，但只要嫌疑人里有 5，凶手就变成数字最小的那位，而 X 永远无罪——所以真正的判断在于你看到的那几张牌能不能排除 5。",
            en: "The murderer is the highest number, unless a 5 is among the suspects, in which case the lowest number is guilty, and X is always innocent, so the real judgement is whether the cards you saw rule out a 5."
        }
    },
    sections: [
        {
            id: "aim",
            label: { zh: "目标", en: "The aim" },
            html: {
                zh: "<p>结束时罚分筹码最少者获胜。每位侦探开局有 7 枚指认筹码。</p>",
                en: "<p>Finish with the fewest penalty chips. Each detective starts with 7 accusation chips.</p>"
            }
        },
        {
            id: "evidence",
            label: { zh: "跟随证据", en: "Follow the evidence" },
            html: {
                zh: "<p>3 到 5 人时，你能看到自己的牌和右手边传来的那张牌（<strong>From right</strong>）。2 人时只看到自己的牌和一张公开的不在场证明，不交换牌。这些不在场证明在两种查验模式下都保持可见。受害者始终隐藏。</p><p>使用数字 2 到 8，4 人时另有一张 X，5 人时另有两张 X。</p>",
                en: "<p>At 3 to 5 players you see your own tile and the tile passed from your right (<strong>From right</strong>). With 2 players you see only your own tile and one public alibi, and tiles are not exchanged. These alibis stay visible in both inspection modes, and the victim stays hidden.</p><p>Use numbers 2 to 8, plus one X at 4 players or two X tiles at 5 players.</p>"
            }
        },
        {
            id: "investigate",
            label: { zh: "查验与指认", en: "Investigate and accuse" },
            html: {
                zh: "<ul><li><strong>查验 1 of 2</strong>（房间默认变体）下每位侦探查验一位嫌疑人：第一位从全部三位中选一位，后面的侦探从两位未被封锁的嫌疑人中选一位，用 <strong>Inspect 1 (🔎)</strong> 确认。</li><li><strong>Inspect both</strong> 下第一位侦探从三位中选两位，后面的侦探查验两位未被封锁的嫌疑人，用 <strong>Inspect 2 (🔎)</strong> 确认。</li><li>后面的侦探不能查验上一位侦探指认过的对象。</li><li>确认查验后必须指认，本回合不能再查验其他牌。</li><li><strong>首个跳过(👁)</strong>标记第一位侦探没有查验的嫌疑人。这些标记会一直留着，但不会封锁后面的侦探。修订版中牌不会被交换。</li><li>选中任意嫌疑人并确认指认，你可以指认被封锁的、隐藏的或已经有筹码的嫌疑人。</li><li>每位侦探放一枚筹码，新筹码压在最上层。再次点击已选中的牌、点击空白处或按 Esc 可以取消选择。</li></ul>",
                en: "<ul><li>With <strong>Inspect 1 of 2</strong> (the default room variant), every detective inspects one suspect: the first chooses one of all three and later detectives choose one of the two unblocked suspects. Confirm with <strong>Inspect 1 (🔎)</strong>.</li><li>With <strong>Inspect both</strong>, the first detective selects two of the three suspects and later detectives inspect both unblocked suspects. Confirm with <strong>Inspect 2 (🔎)</strong>.</li><li>Later detectives cannot inspect the previous detective's accusation.</li><li>After confirming an inspection you must accuse, and you cannot inspect another card this turn.</li><li><strong>First skipped (👁)</strong> marks the suspects the first detective did not inspect. These markers stay there and do not block later detectives, and tiles are never swapped in the revised edition.</li><li>Select any suspect and confirm your accusation. You can accuse the blocked suspect, a hidden suspect, or one with chips already on it.</li><li>Each detective places one chip and new chips go on top. Click a selected card again, click empty space, or press Esc to cancel a selection.</li></ul>"
            }
        },
        {
            id: "murderer",
            label: { zh: "找出凶手", en: "Find the murderer" },
            html: {
                zh: "<p>数字最大的那位有罪，除非嫌疑人中出现 <strong>5</strong>，此时数字最小的那位有罪。<strong>X 永远无罪。</strong></p>",
                en: "<p>The highest number is guilty, unless a <strong>5</strong> is among the suspects, in which case the lowest number is guilty. <strong>X is always innocent.</strong></p>"
            }
        },
        {
            id: "settle",
            label: { zh: "结算案件", en: "Settle the case" },
            html: {
                zh: "<ul><li>压在凶手身上的筹码离开游戏。</li><li>无罪嫌疑人身上最上层筹码的持有者，要拿走整叠作为罚分。</li><li>除上一轮首位侦探之外，罚分总数最多的玩家下轮先手，平手按顺时针决定。2 人局轮流先手。</li><li>有人达到 5 点罚分，或指认筹码用尽时游戏结束（最多 7 轮）。</li></ul><p>罚分相同怎么办？自己颜色的罚分筹码较少者排名更高，仍然相同则由最终首位侦探之后的顺时针顺序决定。</p>",
                en: "<ul><li>Chips on the murderer leave the game.</li><li>The top chip's owner takes the entire stack on an innocent suspect as penalties.</li><li>Among everyone except the previous first detective, the player with the most total penalties starts next, and ties go clockwise. At 2 players you alternate who starts.</li><li>The game ends at 5 penalties or when accusation chips run out, after at most 7 rounds.</li></ul><p>Tied penalties? Fewer penalty chips of your own colour ranks higher, and if still tied the clockwise order after the final first detective decides.</p>"
            }
        },
        {
            id: "review",
            label: { zh: "一起回顾", en: "Review together" },
            html: {
                zh: "<p>揭晓后的现场会一直显示，直到所有人都选择 <strong>Next Round</strong>。机器人自动确认，最终结果同样等待所有人确认。</p>",
                en: "<p>The revealed scene stays on screen until everyone chooses <strong>Next Round</strong>. Bots confirm automatically, and the final result also waits for everyone.</p>"
            }
        }
    ]
};

let inAGroveHelpWidget = null;
let inAGroveExplainWidget = null;

function initInAGroveHelpExplain() {
    if (inAGroveHelpWidget || typeof window.obgCreateHelp !== "function") return;
    inAGroveHelpWidget = window.obgCreateHelp(IN_A_GROVE_HELP_CONFIG);
    inAGroveExplainWidget = window.obgCreateExplain({
        gameId: "in_a_grove",
        attribute: "data-in-a-grove-explain",
        explanations: IN_A_GROVE_EXPLAIN,
        button: inAGroveUI.ExplainBtn,
        root: () => inAGroveUI.Panel,
        bypass: ["#inAGroveHelpBtn", "#inAGroveExplainBtn", "#inAGroveHelpModalCloseBtn", "#inAGroveExplainModalCloseBtn"]
    });
    inAGroveUI.HelpBtn?.addEventListener("click", () => {
        inAGroveExplainWidget?.exit();
        inAGroveHelpWidget.open();
    });
    inAGroveUI.ExplainBtn?.addEventListener("click", () => inAGroveExplainWidget?.toggle());
}


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

function buildInAGrovePeekers(view, suspect) {
    const peekedBy = Array.isArray(suspect.peeked_by) ? suspect.peeked_by : [];
    if (!peekedBy.length) return null;
    const names = peekedBy.map((id) => inAGrovePlayerName(view, id));
    const wrap = inAGroveElement("span", "in-a-grove-peekers");
    wrap.title = "Seen this round by " + names.join(", ");
    wrap.setAttribute("aria-label", "Seen this round by " + names.join(", "));
    names.forEach((name, index) => {
        const badge = inAGroveElement("span", "in-a-grove-peeker", name);
        badge.title = name;
        badge.style.setProperty("--peeker-color", inAGrovePlayerColor(peekedBy[index]));
        wrap.append(badge);
    });
    return wrap;
}

function clearInAGroveSelection() {
    inAGroveSelectedPeekIndexes = [];
    inAGroveSelectedTargetIndex = null;
}

function showInAGroveHeaderActions(show) {
    if (inAGroveUI.HeaderActions) inAGroveUI.HeaderActions.style.display = show ? "flex" : "none";
    if (!show) {
        inAGroveExplainWidget?.exit();
        [inAGroveUI.HelpModal, inAGroveUI.ExplainModal].forEach((modal) => setModalVisible(modal, false));
    }
}

function clearInAGroveState() {
    currentInAGroveView = null;
    clearInAGroveSelection();
    inAGroveExplainWidget?.exit();
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
        const face = inAGroveElement("span", "in-a-grove-suspect-face");
        face.classList.toggle("is-hidden", !suspect.label);
        face.append(inAGroveElement("span", "in-a-grove-suspect-value", suspect.label || "?"));
        const caption = inAGroveElement("span", "in-a-grove-face-caption",
            revealed ? "Revealed" : suspect.label ? "Only you can see" : "Identity hidden");
        let status = "Await your turn";
        if (revealed) status = result?.is_murderer ? "🔴 Murderer" : "🟢 Innocent";
        else if (view.phase === "peek") status = suspect.blocked ? "🚫 No peeking" : "🔎 Can inspect";
        else if (view.phase === "bet") status = "🎯 Can accuse";
        const unseen = inAGroveElement("span", "in-a-grove-unseen", suspect.unseen ? "👁 First skipped" : "");
        if (!revealed && view.current_turn !== view.you && !suspect.blocked) status = "Await your turn";
        const peekers = buildInAGrovePeekers(view, suspect);
        if (peekers) face.prepend(peekers);
        card.append(label, face, caption, unseen, inAGroveElement("span", "in-a-grove-suspect-status", status));
        const peekedByNames = (suspect.peeked_by || []).map((id) => inAGrovePlayerName(view, id));
        card.setAttribute("aria-label", "Suspect " + (suspect.index + 1) + ", " +
            (suspect.label ? "value " + suspect.label : "hidden") + ", " + status +
            (suspect.unseen ? ", not inspected by the first detective" : "") +
            (peekedByNames.length ? ", seen this round by " + peekedByNames.join(", ") : "") +
            (selected ? ", selected" : ""));
        card.addEventListener("click", () => {
            if (inAGroveExplainWidget?.isActive() || !inAGroveCanSelectSuspect(suspect)) return;
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


function closeInAGroveModal(key) {
    setModalVisible(inAGroveUI[key + "Modal"], false);
    if (inAGroveModalReturnFocus?.isConnected && !inAGroveModalReturnFocus.disabled) {
        inAGroveModalReturnFocus.focus({ preventScroll: true });
    }
    inAGroveModalReturnFocus = null;
}


Object.entries(IN_A_GROVE_EXPLAIN_KEYS).forEach(([id, key]) => {
    inAGroveUI[id].dataset.inAGroveExplain = key;
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
inAGroveUI.InspectionModeSelect.addEventListener("change", updateInAGroveConfigHint);

["Help", "Explain"].forEach((key) => {
    inAGroveUI[key + "ModalCloseBtn"].addEventListener("click", () => closeInAGroveModal(key));
    inAGroveUI[key + "Modal"].addEventListener("click", (event) => {
        if (event.target === inAGroveUI[key + "Modal"]) closeInAGroveModal(key);
    });
});

inAGroveUI.Panel.addEventListener("click", (event) => {
    if (inAGroveExplainWidget?.isActive() || event.target.closest("button, a, input, select, textarea, summary, .in-a-grove-stack")) return;
    if (!inAGroveSelectedPeekIndexes.length && inAGroveSelectedTargetIndex === null) return;
    clearInAGroveSelection();
    if (currentInAGroveView) renderInAGroveSuspects(currentInAGroveView);
    updateInAGroveActionButtons();
});


document.addEventListener("keydown", (event) => {
    if (currentGameType !== "in_a_grove") return;
    const modal = ["Help", "Explain"].find((key) => !inAGroveUI[key + "Modal"].classList.contains("hidden"));
    if (modal && event.key === "Tab") {
        event.preventDefault();
        inAGroveUI[modal + "ModalCloseBtn"].focus();
    }
    if (event.key !== "Escape") return;
    if (modal) closeInAGroveModal(modal);
    else if (inAGroveExplainWidget?.isActive()) inAGroveExplainWidget.exit();
    else {
        clearInAGroveSelection();
        if (currentInAGroveView) renderInAGroveSuspects(currentInAGroveView);
        updateInAGroveActionButtons();
    }
});

window.renderInAGroveGameState = renderInAGroveGameState;
window.showInAGroveHeaderActions = showInAGroveHeaderActions;
window.clearInAGroveState = clearInAGroveState;

initInAGroveHelpExplain();
