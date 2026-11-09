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
    let suppressClick = false;
    let tooltipAnchor = null;
    let tooltipTimer = null;
    let dialogOrigin = null;
    let notesContext = "";
    let readNoteCount = 0;
    let touchStart = null;
    let touchMoved = false;
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
        el.dataset.criminalDanceExplain = key;
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
            dog: `Choose another player with cards and reveal a random hand card. Revealing Criminal (🕵️) wins immediately, even with Alibi (🧾). On a miss, ${settings().dog_fail_behavior === "give_to_target" ? "Dog (🐶) goes into the target's hand" : "Dog (🐶) stays discarded"}. If everyone else has no cards, discard it with no effect.`,
            accomplice: "Playing Accomplice (😈) joins the criminal team for the rest of this round. You win with Criminal (🕵️) if they escape, even if your hand changes.",
            witness: "Choose another player with cards. Only you see their current hand in Private Notes (🔒). Cards can move afterward, so this information may become outdated. If everyone else has no cards, discard it with no effect.",
            info_control: "After playing Info Control (↩️), each player with cards passes a randomly chosen card to the next seat on the left, simultaneously.",
            rumor: "After playing Rumor (🗣️), everyone draws a random card from the next seat on their right if that player has cards.",
            trade: "Choose another player with cards, then choose one of your remaining cards to exchange for a random card from their hand. If Trade (🤝) is your last card or everyone else has no cards, it has no exchange effect.",
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
    function hasNoCardTarget(card) {
        return card && ["dog", "witness", "trade"].includes(card.type)
            && !(view?.players || []).some(player => !player.you && player.hand_count > 0);
    }
    function blockedReason(card) {
        if (view?.game_over) return "Round complete. Review the result before continuing.";
        if (!legal("play_card")) return "Wait for your turn.";
        if (hand().some(c => c.type === "first_finder") && !(view.played || []).some(p => p.player_id === view.you) && card.type !== "first_finder") {
            return "Play First Finder (🥇) first.";
        }
        if (card.type === "criminal" && hand().length !== 1) return "Criminal (🕵️) must be your last card.";
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
            const title = node("div", "criminal-dance-player-name");
            title.append(tip(node("span", "criminal-dance-player-name-text", p.name), p.name));
            if (p.you) title.append(node("span", "criminal-dance-badge", "You"));
            const meta = node("div", "criminal-dance-player-meta");
            meta.append(badge(`🃏 ${p.hand_count}`, `Hand (🃏): ${p.hand_count} cards remaining.`));
            if (view.config?.scoring_enabled !== false) meta.append(badge(`⭐ ${p.score}`, `Score (⭐): ${p.score} total points.`));
            if (current) meta.append(badge("▶", "Current turn (▶): this player acts next."));
            if (p.is_accomplice) meta.append(badge("😈", "Accomplice (😈): this player joined the criminal team."));
            if (view.game_over && p.round_ready) meta.append(badge("✓", "Ready (✓): confirmed to continue."));
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
            const btn = explain(node("button", "criminal-dance-card"), `card_${card.type}`);
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
        get("ResultControls").replaceChildren();
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
            get("ResultControls").append(row);
            return;
        }
        if (!legal("play_card")) return;
        const card = hand().find(c => c.id === selectedId);
        controls.append(node("div", "criminal-dance-action-title", card ? cardLabel(card.type) : "Select a card to play"));
        const needsTarget = card && ["detective", "dog", "witness", "trade", "chief"].includes(card.type) && !hasNoCardTarget(card);
        const fields = node("div", "criminal-dance-action-fields");
        if (needsTarget) {
            const eligible = targets(card);
            if (!eligible.some(p => p.player_id === targetId)) targetId = eligible[0]?.player_id || "";
            fields.append(field("Target", "criminalDanceTarget", eligible.map(p => [p.player_id, p.name]), targetId, "pick_target", value => { targetId = value; }));
        }
        if (card?.type === "trade" && hand().length > 1 && needsTarget) {
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
            if (card.type === "trade" && tradeId && needsTarget) action.your_card_id = tradeId;
            sendAction(action);
        });
        row.append(btn);
        if (card?.type === "detective" && !detectiveActive()) row.append(node("span", "hint", "Accusation inactive this turn."));
        if (hasNoCardTarget(card)) row.append(node("span", "hint", "No other player has cards. No effect."));
        else if (card?.type === "trade" && hand().length === 1) row.append(node("span", "hint", "Last card: no exchange."));
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
            const row = explain(node("div", "criminal-dance-public"), `card_${entry.card.type}`);
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
        if (get("PrivateDetails").open) readNoteCount = notes.length;
        const unread = Math.max(0, notes.length - readNoteCount);
        text("PrivateNew", unread ? `${unread} new` : "");
        visible("PrivateNew", unread > 0);
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
        if (criminalDanceExplainWidget?.isActive() || criminalDanceHelpWidget?.isOpen() || !anchor?.dataset.criminalDanceTip) return;
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
        if (key.startsWith("card_")) {
            const type = key.slice(5);
            const card = hand().find(c => c.id === selectedId && c.type === type) || hand().find(c => c.type === type);
            return [cardLabel(type), `${cardInfo(type)}${card && blockedReason(card) ? ` Currently unavailable: ${blockedReason(card)}` : ""}`];
        }
        const map = {
            status: ["Round & turn", "Round identifies the current deal. Current Turn (▶) shows who plays next; empty hands are skipped."],
            players: ["Players (👥)", "Hand (🃏) counts are public; card identities stay private. Score (⭐) is the running total. Accomplice (😈) marks a player on the criminal team. Ready (✓) means they have confirmed the next deal."],
            hand: ["Your Hand (🃏)", "Select a card, choose a target if needed, then press Play Card. Click the selected card or a blank area to cancel. Unavailable cards explain why they cannot be played."],
            played: ["Played Cards (🗂️)", "Expand this section to review public cards and their outcomes, newest first. Scroll inside the list for earlier turns; use Explain on a card to read its effect."],
            private: ["Private Notes (🔒)", "Expand this section to see your private clues. The new badge marks unread clues, including Boy (🧒) information and hands seen by Witness (👀). They describe what was known then; cards may have moved since."],
            results: ["Results (🏆)", "The completed result remains visible until every human player confirms. Bots are ready automatically. Scores (⭐) carry into the next round and reset for a new match."],
            play_card: ["Play Card", "Play the selected card and resolve its effect. Choose any required target and exchange card first. This button is unavailable until a playable card is selected."],
            pick_target: ["Target", "Choose another player. Dog (🐶), Witness (👀), and an active Trade (🤝) need a player with cards. Only eligible targets appear. If everyone else has no cards, these cards are discarded with no effect."],
            trade_card: ["Give", "Choose which remaining card to give with Trade (🤝). You receive a random card from the target's hand."],
            play_again: [view?.match_over ? "New Match" : "Next Round", `Confirm that you have reviewed the result. The next deal waits for every human player; bots confirm automatically. ${view?.match_over ? "Starting a new match resets scores." : "Starting the next round keeps scores."}`],
        };
        return map[key] || null;
    }
    const CRIMINAL_DANCE_EXPLAIN = {
        status: { zh: "轮次与回合：Round 标示当前这一副牌，Current Turn (▶) 显示下一个出牌的人，手牌已空的玩家会被跳过。", en: "Round identifies the current deal. Current Turn (▶) shows who plays next, and empty hands are skipped." },
        players: { zh: "玩家(👥)：手牌(🃏)张数公开但牌面保密。Score (⭐) 是累计分。Accomplice (😈) 标记犯罪阵营的玩家，Ready (✓) 表示已确认下一副牌。", en: "Hand (🃏) counts are public while card identities stay private. Score (⭐) is the running total. Accomplice (😈) marks a player on the criminal team, and Ready (✓) means they have confirmed the next deal." },
        hand: { zh: "你的手牌(🃏)：选一张牌，需要时选目标，再按 Play Card。再次点击已选中的牌或点空白处可以取消。不可用的牌会说明为什么打不出。", en: "Select a card, choose a target if needed, then press Play Card. Click the selected card or a blank area to cancel, and unavailable cards explain why they cannot be played." },
        played: { zh: "已打出的牌(🗂️)：展开这一区可以按时间倒序复盘公开的牌和结果。在列表内滚动可以看更早的回合，用 Explain 点某张牌可以读它的效果。", en: "Expand this section to review public cards and their outcomes, newest first. Scroll inside the list for earlier turns, and use Explain on a card to read its effect." },
        private: { zh: "私有笔记(🔒)：展开这一区可以看你的私有线索。new 标记未读线索，包括 Boy (🧒) 的信息和 Witness (👀) 看到的手牌。它们描述的是当时的情况，牌之后可能已经换过。", en: "Expand this section to see your private clues. The new badge marks unread clues, including Boy (🧒) information and hands seen by Witness (👀). They describe what was known then and cards may have moved since." },
        results: { zh: "结果(🏆)：已完成的结果会一直显示到所有真人玩家确认。机器人自动准备。分数(⭐)带入下一轮，新的一局则重置。", en: "The completed result remains visible until every human player confirms. Bots are ready automatically. Scores (⭐) carry into the next round and reset for a new match." },
        play_card: { zh: "Play Card：打出选中的牌并结算效果。请先选好必需的目标和交换牌。在选中一张可打出的牌之前，这个按钮不可用。", en: "Play the selected card and resolve its effect. Choose any required target and exchange card first. This button is unavailable until a playable card is selected." },
        pick_target: { zh: "目标：选择另一位玩家。Dog (🐶)、Witness (👀) 和生效中的 Trade (🤝) 需要选一位有手牌的玩家，只有合法目标会出现。如果其他人都没有手牌，这些牌会被弃掉且无效果。", en: "Choose another player. Dog (🐶), Witness (👀) and an active Trade (🤝) need a player with cards, and only eligible targets appear. If everyone else has no cards, these cards are discarded with no effect." },
        trade_card: { zh: "Give：选择用 Trade (🤝) 交换时给出剩下的哪张牌。你会从目标手牌中随机获得一张。", en: "Choose which remaining card to give with Trade (🤝). You receive a random card from the target's hand." },
        play_again: { zh: "确认你已复盘结果。下一副牌要等所有真人玩家确认，机器人会自动确认。开新一局会重置分数，进入下一轮则保留分数。", en: "Confirm that you have reviewed the result. The next deal waits for every human player and bots confirm automatically. Starting a new match resets scores while starting the next round keeps them." },
        card_first_finder: { zh: "First Finder (🥇)：持有者先手。如果你手里有 First Finder (🥇) 且本轮还没出过牌，必须先打它。", en: "The holder takes the opening turn. If you hold First Finder (🥇) and have not played this round, you must play it first." },
        card_criminal: { zh: "Criminal (🕵️)：谁持有 Criminal (🕵️) 谁就是当前罪犯。只有把它作为最后一张手牌打出才能逃脱，并与所有打过 Accomplice (😈) 的人一起获胜。", en: "Whoever holds Criminal (🕵️) is the current criminal. Play it only as your last hand card to escape and win with everyone who has played Accomplice (😈)." },
        card_detective: { zh: "Detective (🔍)：选择另一位玩家指控。抓到 Criminal (🕵️) 即赢得本轮，除非对方持有 Alibi (🧾) 会自动挡下。未激活的 Detective (🔍) 仍可打出，但没有指控效果。", en: "Choose another player to accuse. Catching Criminal (🕵️) wins the round unless they hold Alibi (🧾), which blocks automatically. An inactive Detective (🔍) can still be played with no accusation effect." },
        card_alibi: { zh: "Alibi (🧾)：持有时自动挡下 Detective (🔍)。打出它就会失去这层保护。它不能抵挡 Dog (🐶)。", en: "While held, Alibi (🧾) automatically blocks Detective (🔍). Playing it discards that protection, and it does not protect against Dog (🐶)." },
        card_dog: { zh: "Dog (🐶)：选择另一位有手牌的玩家并随机翻一张。翻到 Criminal (🕵️) 立即获胜，即使对方有 Alibi (🧾)。没翻到时按房间设置处理。如果其他人都没有手牌，则弃掉且无效果。", en: "Choose another player with cards and reveal a random hand card. Revealing Criminal (🕵️) wins immediately, even with Alibi (🧾). On a miss the room setting decides what happens to the Dog (🐶). If everyone else has no cards, discard it with no effect." },
        card_accomplice: { zh: "Accomplice (😈)：打出后你在本轮加入犯罪阵营。如果 Criminal (🕵️) 逃脱你就一起获胜，即使你的手牌之后发生变化。", en: "Playing Accomplice (😈) joins the criminal team for the rest of this round. You win with Criminal (🕵️) if they escape, even if your hand changes." },
        card_witness: { zh: "Witness (👀)：选择另一位有手牌的玩家。只有你能在私有笔记(🔒)里看到对方当前手牌。牌之后可能换动，所以这个信息可能过时。如果其他人都没有手牌，则弃掉且无效果。", en: "Choose another player with cards. Only you see their current hand in Private Notes (🔒). Cards can move afterward so this information may become outdated, and if everyone else has no cards it is discarded with no effect." },
        card_info_control: { zh: "Info Control (↩️)：打出后，每位有手牌的玩家同时把一张随机牌传给左手边的下一位。", en: "After playing Info Control (↩️), each player with cards passes a randomly chosen card to the next seat on the left, simultaneously." },
        card_rumor: { zh: "Rumor (🗣️)：打出后，每个人都从右手边下一位玩家手里随机抽一张，前提是对方有手牌。", en: "After playing Rumor (🗣️), everyone draws a random card from the next seat on their right if that player has cards." },
        card_trade: { zh: "Trade (🤝)：选择另一位有手牌的玩家，再选自己剩下的一张牌换取对方手中一张随机牌。如果 Trade (🤝) 是你的最后一张牌，或其他人都没有手牌，则没有交换效果。", en: "Choose another player with cards, then choose one of your remaining cards to exchange for a random card from their hand. If Trade (🤝) is your last card or everyone else has no cards, it has no exchange effect." },
        card_boy: { zh: "Boy (🧒)：每轮开始时，Boy (🧒) 私下得知谁持有 Criminal (🕵️)。是否同时告知罪犯则取决于房间设置。打出这张牌没有额外效果。", en: "At the start of the round, Boy (🧒) privately learns who holds Criminal (🕵️), and whether the criminal is also told depends on the room setting. Playing the card has no further effect." },
        card_civilian: { zh: "Civilian (🙂)：没有任何效果，打出它只是为了减少手牌。", en: "Civilian (🙂) has no effect. Play it to reduce your hand." },
        card_chief: { zh: "Chief (👮)：选择另一位玩家用 Chief (👮) 标记。当没有任何合法行动时，服务器检查被标记者是否持有 Criminal (🕵️)，若是则判定抓捕获胜。", en: "Choose another player to mark with Chief (👮). When no legal turns remain, the server checks whether the marked player holds Criminal (🕵️) and awards a catch win if they do." },
        dialog_close: { zh: "关闭当前对话框并回到牌桌。", en: "Close the current dialog and return to the table." }
    };

    const CD_HELP_CONFIG = {
        gameId: "criminal_dance",
        title: { zh: "犯罪之舞 · Criminal Dance", en: "Criminal Dance" },
        basic: {
            win: {
                zh: "用 Detective (🔍) 或 Dog (🐶) 抓到 Criminal (🕵️)，或者把 Criminal (🕵️) 作为最后一张牌打出逃脱。任何打过 Accomplice (😈) 的人都会随逃脱一起获胜。",
                en: "Catch Criminal (🕵️) with Detective (🔍) or Dog (🐶), or escape by playing Criminal (🕵️) as your last card. Anyone who has played Accomplice (😈) wins with an escape."
            },
            turn: {
                zh: "每人开局四张牌，First Finder (🥇) 先手。轮到你时打出一张牌，手牌已空的玩家会被跳过。牌在玩家之间流动时，罪犯身份也跟着流动。",
                en: "Each player starts with 4 cards and First Finder (🥇) opens the round. Play one card on your turn, players with empty hands are skipped, and cards moving between players also move the criminal identity."
            },
            key: {
                zh: "你永远不知道 Criminal (🕵️) 在谁手里，只能靠别人打出的牌和私有笔记推断，所以真正的技巧是控制信息而不是追求某一张牌。",
                en: "You never know who holds Criminal (🕵️) and can only deduce it from what others play and from your private notes, so the real skill is controlling information rather than chasing one particular card."
            }
        },
        sections: [
            {
                id: "goal",
                label: { zh: "目标", en: "Goal" },
                html: {
                    zh: "<p>用 Detective (🔍) 或 Dog (🐶) 抓到 Criminal (🕵️)，或者把 Criminal (🕵️) 作为最后一张牌打出逃脱。任何打过 Accomplice (😈) 的人都会随逃脱一起获胜。</p>",
                    en: "<p>Catch Criminal (🕵️) with Detective (🔍) or Dog (🐶), or escape by playing Criminal (🕵️) as your last card. Anyone who has played Accomplice (😈) wins with an escape.</p>"
                }
            },
            {
                id: "turn",
                label: { zh: "你的回合", en: "Your turn" },
                html: {
                    zh: "<p>每人开局四张牌，First Finder (🥇) 先手。轮到你时打出一张牌，手牌已空的玩家会被跳过。牌在玩家之间流动时，罪犯身份也跟着流动。</p>",
                    en: "<p>Each player starts with 4 cards and First Finder (🥇) opens the round. Play one card on your turn, players with empty hands are skipped, and cards moving between players also move the criminal identity.</p>"
                }
            },
            {
                id: "controls",
                label: { zh: "操作", en: "Controls" },
                html: {
                    zh: "<p>选一张手牌，按提示选目标或交换牌，再按 Play Card。再次点击该牌或点空白处可以取消。Explain 可以查看任何高亮元素而不触发动作，按 Esc 退出。状态类符号可悬停或轻点查看提示，轻点提示 3 秒后消失。</p>",
                    en: "<p>Select a hand card, choose a target or exchange card when prompted, then press Play Card. Click the card again or a blank area to cancel. Explain lets you inspect any highlighted item without taking an action, and Esc leaves it. Hover over status symbols or tap them for a 3-second hint.</p>"
                }
            },
            {
                id: "records",
                label: { zh: "记录", en: "Records" },
                html: {
                    zh: "<p>展开 Played Cards (🗂️) 或 Private Notes (🔒) 可以在不清除已选手牌的情况下复盘信息。在列表内滚动可以看更早的条目，Private Notes (🔒) 上的 new 标记表示有未读线索。</p>",
                    en: "<p>Expand Played Cards (🗂️) or Private Notes (🔒) to review information without clearing your selected card. Scroll inside a list for earlier entries, and the new badge on Private Notes (🔒) marks unread clues.</p>"
                }
            },
            {
                id: "settings",
                label: { zh: "当前设置", en: "Current settings" },
                html: { zh: "<p>开始游戏后在此显示本房间的设置。</p>", en: "<p>The room settings appear here once the game starts.</p>" }
            },
            {
                id: "scoring",
                label: { zh: "计分与下一副", en: "Scoring and next deal" },
                html: { zh: "<p>开始游戏后在此显示计分规则。</p>", en: "<p>The scoring rules appear here once the game starts.</p>" }
            },
            {
                id: "symbols",
                label: { zh: "符号与信息", en: "Symbols and information" },
                html: {
                    zh: "<p>Players (👥)、Hand (🃏) 张数和 Played Cards (🗂️) 是公开的。Private Notes (🔒) 只属于你。Current Turn (▶) 标记当前行动者，Ready (✓) 记录谁已确认下一副牌。颜色用于区分卡牌角色，每张牌也都有名字和符号。</p>",
                    en: "<p>Players (👥), Hand (🃏) counts and Played Cards (🗂️) are public. Private Notes (🔒) belong only to you. Current Turn (▶) marks the active player and Ready (✓) tracks who has confirmed the next deal. Colours group card roles, and every card also has a name and symbol.</p>"
                }
            },
            {
                id: "cards",
                label: { zh: "卡牌一览", en: "Card reference" },
                html: { zh: "<p>开始游戏后在此显示全部卡牌说明。</p>", en: "<p>The full card reference appears here once the game starts.</p>" }
            }
        ]
    };

    function refreshCriminalDanceHelp() {
        const set = (id, zh, en) => {
            const section = CD_HELP_CONFIG.sections.find(item => item.id === id);
            if (section) { section.html.zh = zh; section.html.en = en; }
        };
        set("settings",
            `<p>${detectiveRule()} Dog (🐶) 未命中时：${settings().dog_fail_behavior === "give_to_target" ? "交给目标" : "弃掉"}。Boy (🧒)：${settings().enable_boy === false ? "关闭" : "开启"}。Chief (👮)：${settings().enable_chief ? "开启" : "关闭"}。</p>`,
            `<p>${detectiveRule()} Dog (🐶) on a miss: ${settings().dog_fail_behavior === "give_to_target" ? "give to target" : "discard"}. Boy (🧒): ${settings().enable_boy === false ? "off" : "on"}. Chief (👮): ${settings().enable_chief ? "on" : "off"}.</p>`);
        const scoring = settings().scoring_enabled !== false;
        const count = view?.players?.length || 3;
        const target = settings().target_score_by_player_count?.[count] || ({3: 5, 4: 5, 5: 7, 6: 10, 7: 10, 8: 10})[count];
        set("scoring", scoring
            ? `<p>Score (⭐)：Detective (🔍) 抓捕成功时，抓捕者得 2 分，罪犯得 0 分，其余每人 1 分。Dog (🐶) 或 Chief (👮) 抓捕则抓捕者得 3 分。逃脱时犯罪阵营每人得 2 分，其他人 0 分。本局在有人达到 ${target} 分时结束。复盘 Results (🏆) 后所有人按 Next Round，整局结束后用 New Match。机器人自动准备。</p>`
            : "<p>计分已关闭：每一轮就是完整一局。复盘 Results (🏆) 后所有人按 New Match。机器人自动准备。</p>",
            scoring
            ? `<p>Score (⭐): a Detective (🔍) catch awards 2 to the catcher, 0 to the criminal and 1 to each other player. Dog (🐶) or Chief (👮) awards 3 to the catcher instead. An escape awards 2 to each criminal-team winner and 0 to others. This match ends when someone reaches ${target} points. Review Results (🏆), then everyone presses Next Round, and use New Match after the match ends. Bots are ready automatically.</p>`
            : "<p>Scoring is off: each round is a complete match. Review Results (🏆), then everyone presses New Match. Bots are ready automatically.</p>");
        const list = Object.keys(cards).map(type => `<p><strong>${cardLabel(type)}</strong>：${cardInfo(type)}</p>`).join("");
        set("cards", list || CD_HELP_CONFIG.sections.find(i => i.id === "cards").html.zh, list || CD_HELP_CONFIG.sections.find(i => i.id === "cards").html.en);
    }

    let criminalDanceHelpWidget = null;
    let criminalDanceExplainWidget = null;

    function initCriminalDanceHelpExplain() {
        if (criminalDanceHelpWidget || typeof window.obgCreateHelp !== "function") return;
        criminalDanceHelpWidget = window.obgCreateHelp(CD_HELP_CONFIG);
        criminalDanceExplainWidget = window.obgCreateExplain({
            gameId: "criminal_dance",
            attribute: "data-criminal-dance-explain",
            explanations: CRIMINAL_DANCE_EXPLAIN,
            button: get("ExplainBtn"),
            root: () => panel,
            bypass: ["#criminalDanceHelpBtn", "#criminalDanceExplainBtn", "#criminalDanceExplainModalCloseBtn"]
        });
        get("HelpBtn")?.addEventListener("click", () => {
            criminalDanceExplainWidget?.exit();
            refreshCriminalDanceHelp();
            criminalDanceHelpWidget.open();
        });
        get("ExplainBtn")?.addEventListener("click", () => criminalDanceExplainWidget?.toggle());
    }
    function active() { return typeof currentGameType !== "undefined" && currentGameType === "criminal_dance"; }
    function stop(event) { event.preventDefault(); event.stopImmediatePropagation(); }
    document.addEventListener("pointerdown", event => {
        if (!active()) return;
        suppressClick = false;
        touchMoved = false;
        touchStart = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : null;
    }, true);
    document.addEventListener("pointermove", event => {
        if (touchStart && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 10) touchMoved = true;
    }, true);
    document.addEventListener("pointercancel", () => {
        if (touchStart) touchMoved = true;
        touchStart = null;
    }, true);
    document.addEventListener("pointerup", event => {
        if (!active() || !touchStart) return;
        touchStart = null;
    }, true);
    document.addEventListener("click", event => {
        if (!active()) return;
        if (touchMoved && event.detail !== 0) { touchMoved = false; stop(event); return; }
        if (suppressClick) { suppressClick = false; stop(event); return; }
        if (!panel.contains(event.target)) return;
        const anchor = event.target.closest("[data-criminal-dance-tip]");
        if (anchor && !anchor.matches("button:not([aria-disabled='true'])")) showTip(anchor);
        if (selectedId && !event.target.closest("button, select, input, label, summary, [data-criminal-dance-tip], .criminal-dance-public, .criminal-dance-private")) {
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
            criminalDanceExplainWidget?.exit();
            if (modal) closeDialog(modal);
            else if (selectedId) { resetSelection(); renderHand(); renderControls(); }
        } else if (modal && event.key === "Tab") {
            const items = [...modal.querySelectorAll("button, a[href], input, select, [tabindex='0']")].filter(el => !el.disabled);
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        }
    }, true);
    function clear() {
        criminalDanceExplainWidget?.exit();
        suppressClick = false;
        resetSelection();
        selectionContext = "";
        notesContext = "";
        readNoteCount = 0;
        touchStart = null;
        touchMoved = false;
        view = null;
        for (const id of ["Players", "Hand", "Controls", "ResultControls", "Played", "Private"]) get(id).replaceChildren();
        for (const id of ["PlayedDetails", "PrivateDetails"]) get(id).open = false;
        visible("PrivateNew", false);
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
            criminalDanceExplainWidget?.exit();
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
        const newDeal = view?.game_over && !next.game_over;
        view = next;
        const nextNotesContext = JSON.stringify([data.room_id, next.round_number, next.you]);
        if (nextNotesContext !== notesContext || newDeal) readNoteCount = 0;
        notesContext = nextNotesContext;
        if (!hand().some(c => c.id === selectedId && !blockedReason(c))) resetSelection();
        text("Round", String(view.round_number || "—"));
        text("Turn", view.game_over ? "Complete" : view.current_player_name || "—");
        tip(get("Turn"), view.game_over ? "Round complete." : `Current turn (▶): ${view.current_player_name || "—"}.`);
        text("Status", view.game_over ? (view.match_over ? "Match complete" : "Round complete") : legal("play_card") ? "Your turn" : "In progress");
        text("Summary", view.game_over ? "Review the result and confirm when ready." : legal("play_card") ? "Choose your next move." : `Waiting for ${name(view.current_player_id)}…`);
        renderPlayers(); renderHand(); renderControls(); renderPlayed(); renderPrivate(); renderResults();
        if (typeof logGameEvents === "function") logGameEvents(data);
    }
    function init() {
        get("ExplainBtn")?.setAttribute("aria-pressed", "false");
        get("PrivateDetails").addEventListener("toggle", () => {
            if (get("PrivateDetails").open) {
                readNoteCount = me()?.private_log?.length || 0;
                visible("PrivateNew", false);
            }
        });
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
    initCriminalDanceHelpExplain();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
