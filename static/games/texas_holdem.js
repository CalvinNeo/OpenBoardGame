(() => {
    const $ = (id) => document.getElementById("texas" + id);
    const panel = $("HoldemPanel");
    const dialog = $("Dialog");
    const tooltip = $("Tooltip");
    const suits = { S: ["♠️", "Spades"], H: ["♥️", "Hearts"], D: ["♦️", "Diamonds"], C: ["♣️", "Clubs"] };
    const phases = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River", showdown: "Showdown", hand_end: "Hand complete" };
    const actionIds = { fold: "FoldBtn", check: "CheckBtn", call: "CallBtn", all_in: "AllInBtn", bet: "BetBtn", raise: "RaiseBtn", next_hand: "NextHandBtn", rebuy: "RebuyBtn" };
    let view = null;
    let betContext = "";
    let pending = false;
    let pendingTimer;
    let explaining = false;
    let suppressClick = false;
    let suppressTimer;
    let tipTimer;
    let tipTarget = null;
    let returnFocus = null;

    const explanations = {
        hand: ["Hand", "Each hand deals two private cards to every player with chips. The dealer button (D) advances for the next hand."],
        blinds: ["Blinds · Small Blind (SB) / Big Blind (BB)", "The small and big blinds are forced bets before the deal. With two players the dealer posts the small blind. Blinds count toward each player's bet."],
        streets: ["Hand progress", "Preflop: two private cards. Flop: three shared cards. Turn: a fourth shared card. River: a fifth. Each street has a betting round. Result pauses the table so everyone can review the hand."],
        pot: ["Pot (💰)", "All chips committed in this hand, including the current street. At showdown, each pot goes to the best eligible five-card hand. Equal hands split that pot; all-in players can win only pots they contributed to."],
        community: ["Community cards", "These five shared cards combine with your two hole cards to make your best five-card hand. You may use zero, one, or both hole cards. Empty slots show cards that have not been dealt."],
        hole: ["Your hole cards", "Your two private cards. Other players see card backs (🂠) until showdown. Your own folded cards remain visible to you; other players' folded cards stay hidden."],
        chips: ["Chips (💰)", "Your remaining stack. Chips already committed to the pot are not included here. There is no real money involved."],
        currentBet: ["Table bet", "The highest total bet on the current street. Call matches it; Raise to sets a new total. Street bets reset when the next community cards are dealt."],
        toCall: ["To call (💰)", "The extra chips needed to match the table bet. If you have fewer chips, Call commits only your remaining stack and makes you all-in. Zero means you may check on your turn."],
        fold: ["Fold", "Give up this hand and any chips already committed. You take no further betting actions and cannot win its pots. Available only on your turn."],
        check: ["Check", "Continue without adding chips. Available only on your turn when you owe no chips. This acts immediately."],
        call: ["Call (💰)", "Match the current bet by paying the displayed amount. If your stack is too small, pay only your remaining chips and go all-in."],
        all_in: ["All-in (💰)", "Commit your entire remaining stack immediately. You stay in the hand with no chips left to act. Side pots handle unequal stacks; a short all-in may not reopen raising."],
        bet: ["Bet (💰)", "Open the betting on this street. Choose a total at least as large as the minimum, up to your available stack. The preview shows how many chips this action spends."],
        raise: ["Raise to (💰)", "Set your total bet for this street, including chips already committed. For example, with 10 already posted, Raise to 40 spends 30 more. A full raise must increase the table bet by at least the previous full raise."],
        amount: ["Bet / raise total", "Use the slider, number field, or quick sizes to choose your total for this street. Choosing an amount never submits it. Press Bet or Raise to commit. The preview shows the additional cost and remaining stack."],
        minimum: ["Min", "Choose the smallest legal opening bet or full raise. This only selects an amount."],
        halfPot: ["½ Pot", "With no bet, choose half the pot. Facing a bet, first include the chips needed to call, then raise by half that resulting pot. The total is clamped to the legal minimum and your stack."],
        potBet: ["Pot", "With no bet, choose the pot size. Facing a bet, first include the call, then raise by that resulting pot. The total is clamped to the legal minimum and your stack."],
        maximum: ["Max", "Select the largest total you can afford: your current street bet plus your remaining chips (💰). Press Bet or Raise to submit, or use All-in to commit directly."],
        next_hand: ["Next Hand", "Mark yourself ready after reviewing the result. The next hand starts only after every seated player selects Next Hand, including players sitting out with zero chips. Bots mark themselves ready automatically. At least two players need chips. No extra confirmation is shown."],
        rebuy: ["Rebuy (💰)", "Between hands, a player with no chips can take a fresh stack equal to the configured starting chips. Rebuy does not mark you ready; choose Next Hand when you finish reviewing."],
        dealer: ["Dealer (D)", "The dealer button determines blind positions and action order. It advances to the next player with chips each hand."],
        sb: ["Small Blind (SB)", "This player posted the smaller forced bet before the deal."],
        bb: ["Big Blind (BB)", "This player posted the larger forced bet before the deal."],
        ready: ["Ready (✓)", "This player has chosen Next Hand. The current result remains until everyone is ready."],
    };
    const helpHTML = '<p><strong>Win the pot (💰)</strong><br>Make the best five-card poker hand using any combination of your two hole cards and the five community cards, or be the last player who has not folded.</p>' +
        '<p><strong>The deal and streets</strong><br>Dealer (D) moves each hand. Small Blind (SB) and Big Blind (BB) post forced bets. Preflop betting starts after BB; with two players, the dealer is SB and acts first. Flop reveals three cards, Turn one, and River one. Later streets start with the first eligible player after the dealer.</p>' +
        '<p><strong>Your turn</strong><br>Check when nothing is owed. Call (💰) pays the amount displayed. Fold gives up this hand. Bet opens a street; Raise to sets your total bet for that street, including any chips already posted. All-in (💰) commits your entire remaining stack immediately. Actions are available only when legal.</p>' +
        '<p><strong>Choose a bet</strong><br>Use the number field, slider, Min, ½ Pot, Pot, or Max. Selecting a size does not submit. The preview shows what you add and what remains. Facing a bet, pot presets include the call before calculating the raise. The minimum full raise equals the previous full raise; a short all-in does not necessarily reopen raising.</p>' +
        '<p><strong>Cards and symbols</strong><br>Spades (♠️), Hearts (♥️), Diamonds (♦️), Clubs (♣️). A is Ace, K King, Q Queen, J Jack. Suits have equal strength. Card backs (🂠) conceal opponents’ hole cards. Chips (💰) are your stack; Pot (💰) contains committed chips. Turn marks the acting player; Ready (✓) marks a player who has reviewed the result.</p>' +
        '<p><strong>Hand rankings · strongest first</strong></p><ol><li>Straight Flush — five consecutive cards of one suit; A–K–Q–J–10 is a Royal Flush.</li><li>Four of a Kind</li><li>Full House — three of one rank and two of another.</li><li>Flush — five cards of one suit.</li><li>Straight — five consecutive ranks; A–2–3–4–5 is the lowest.</li><li>Three of a Kind</li><li>Two Pair</li><li>One Pair</li><li>High Card</li></ol>' +
        '<p><strong>Showdown and side pots</strong><br>Compare the best five cards; kickers break ties. Equal hands split each eligible pot. All-in players cannot win chips above their contribution level. Result shows payouts received, net change after contributions, and the evaluated hands. Folded opponents’ cards stay hidden.</p>' +
        '<p><strong>Between hands</strong><br>Review the Hand result (🏆), then select Next Hand. Every seated player must be ready before cards are dealt, including zero-chip players who sit out. Bots ready automatically. A player with zero chips may Rebuy (💰) a starting stack. At least two players need chips to continue.</p>' +
        '<p><strong>Help &amp; Explain</strong><br>Explain (🔎) highlights items you can inspect, including disabled buttons. While explaining, game controls do not act. Choose an item to read its explanation, or press Esc to exit. Esc also closes dialogs. Hover over informational symbols for a tip; on mobile, tap for a tip that disappears after three seconds.</p>';

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function format(value) { return Number(value || 0).toLocaleString("en-US"); }
    function chips(value) { return "💰 " + format(value); }
    function ownPlayer() { return view?.players?.find((player) => player.player_id === view.you); }
    function legal(action) { return !pending && currentGameType === "texas_holdem" && !!view?.legal_actions?.includes(action); }
    function setTip(node, text, title) {
        node.dataset.texasTip = text;
        node.dataset.texasExplain = node.dataset.texasExplain || "detail";
        if (title) node.dataset.texasTitle = title;
        node.tabIndex = 0;
    }
    function cardNode(card, slot) {
        const node = element("div", "texas-card");
        if (!card) {
            node.classList.add("texas-card-empty");
            node.append(element("span", "", slot || "–"));
            setTip(node, (slot || "Card") + " · Not dealt yet.", "Undealt card");
        } else if (card.hidden) {
            node.classList.add("texas-card-back");
            node.append(element("span", "", "🂠"));
            setTip(node, "Card back (🂠) · This card is hidden.", "Hidden card");
        } else {
            const suit = suits[card.suit] || [card.suit_emoji || "", "Card"];
            const rank = { 11: "J", 12: "Q", 13: "K", 14: "A" }[card.rank] || String(card.rank);
            const rankName = { 11: "Jack", 12: "Queen", 13: "King", 14: "Ace" }[card.rank] || rank;
            node.classList.toggle("texas-red", card.suit === "H" || card.suit === "D");
            node.append(element("span", "texas-card-rank", rank), element("span", "texas-card-suit", suit[0]));
            setTip(node, rankName + " of " + suit[1] + " (" + suit[0] + ").", "Playing card");
        }
        node.setAttribute("aria-label", node.dataset.texasTip);
        return node;
    }
    function renderCards(container, cards, community = false) {
        container.replaceChildren();
        const list = cards || [];
        if (community) {
            ["Flop", "Flop", "Flop", "Turn", "River"].forEach((slot, i) => container.append(cardNode(list[i], slot)));
        } else {
            list.forEach((card) => container.append(cardNode(card)));
        }
    }
    function renderPlayers() {
        const container = $("Players");
        const scroll = container.scrollTop;
        container.replaceChildren();
        const players = view?.players || [];
        $("PlayerCount").textContent = players.length + " players";
        players.forEach((player) => {
            const seat = element("article", "texas-player-card");
            seat.dataset.playerId = player.player_id;
            seat.classList.toggle("texas-active", player.player_id === view.current_turn);
            seat.classList.toggle("texas-folded", ["folded", "out"].includes(player.status));
            const name = element("span", "texas-player-name", player.name || player.player_id);
            setTip(name, player.name || player.player_id, "Player");
            const tags = element("div", "texas-player-tags");
            const tag = (text, key, className = "") => {
                const node = element("span", "texas-tag " + className, text);
                if (explanations[key]) node.dataset.texasExplain = key;
                setTip(node, explanations[key]?.[1] || text, explanations[key]?.[0] || "Player status");
                tags.append(node);
            };
            if (player.player_id === view.you) tag("You", "you");
            if (player.is_bot) tag("Bot", "bot");
            if (player.is_dealer) tag("D", "dealer", "texas-dealer");
            if (player.is_sb) tag("SB", "sb");
            if (player.is_bb) tag("BB", "bb");
            if (player.player_id === view.current_turn) tag("Turn", "turn", "texas-tag-active");
            if (player.status === "all_in" && view.phase !== "hand_end") tag("All-in", "all_in", "texas-tag-all-in");
            if (player.status === "folded") tag("Folded", "fold");
            if (player.status === "out") tag("Sitting out", "out");
            if (view.phase === "hand_end" && view.next_hand_ready?.includes(player.player_id)) tag("✓ Ready", "ready", "texas-tag-active");
            const bottom = element("div", "texas-player-bottom");
            const stack = element("div", "texas-player-stack");
            const balance = element("strong", "", chips(player.chips));
            setTip(balance, "Chips (💰) remaining: " + format(player.chips) + ".", "Player stack");
            stack.append(balance, element("small", "", view.phase === "hand_end" ? "Committed " + format(player.total_bet) : "Bet " + format(player.current_bet)));
            const cards = element("div", "texas-cards");
            renderCards(cards, player.hole_cards);
            bottom.append(stack, cards);
            seat.append(name, tags, bottom);
            const payout = view.phase === "hand_end" ? view.last_hand_summary?.payouts?.[player.player_id] : 0;
            if (payout) seat.append(element("div", "texas-player-payout", "Received " + chips(payout)));
            container.append(seat);
        });
        container.scrollTop = scroll;
    }
    function renderSummary() {
        const ended = view?.phase === "hand_end";
        $("Summary").hidden = !ended;
        const summary = view?.last_hand_summary;
        const scroll = $("SummaryList").scrollTop;
        $("SummaryList").replaceChildren();
        if (!ended) return;
        $("SummaryBody").textContent = summary ? (summary.reason === "fold" ? "Won by fold" : "Showdown") + " · " + chips(summary.pot_total) : "Waiting for enough chips";
        (view.players || []).forEach((player) => {
            const payout = summary?.payouts?.[player.player_id] || 0;
            const hand = summary?.hands?.[player.player_id];
            if (!payout && !hand) return;
            const row = element("div", "texas-result-player");
            const heading = element("div", "texas-result-heading");
            heading.append(element("strong", "", player.name || player.player_id), element("span", "", "Received " + chips(payout)));
            const net = payout - (player.total_bet || 0);
            row.append(heading, element("div", "texas-result-detail", (hand?.hand_name || "Last player standing") + " · Net " + (net >= 0 ? "+" : "−") + format(Math.abs(net))));
            if (hand?.cards?.length) {
                const cards = element("div", "texas-cards");
                renderCards(cards, hand.cards);
                row.append(cards);
            }
            $("SummaryList").append(row);
        });
        $("SummaryList").scrollTop = scroll;
        const ready = view.next_hand_ready || [];
        const enough = view.players.filter((player) => player.chips > 0).length >= 2;
        $("ReadyStatus").textContent = enough ? ready.length + " / " + view.players.length + " ready · Waiting for everyone" : "At least two players need chips. Rebuy to continue.";
        $("NextHandBtn").textContent = ready.includes(view.you) ? "✓ Ready" : "Next Hand";
        $("NextHandBtn").hidden = !ownPlayer();
    }
    function betLimits() {
        const info = view?.action_info || {};
        const type = view?.current_bet > 0 ? "raise" : "bet";
        const max = info.max_raise_to || 0;
        return { type, min: Math.min((type === "raise" ? info.min_raise_to : info.min_bet) || 1, max), max };
    }
    function amount() {
        const raw = $("BetInput").value.trim();
        const value = Number(raw);
        return raw && Number.isSafeInteger(value) ? value : null;
    }
    function validAmount() {
        const value = amount();
        const { min, max } = betLimits();
        return value !== null && value > 0 && value >= min && value <= max;
    }
    function presetAmount(preset) {
        const { min, max } = betLimits();
        if (preset === "min") return min;
        if (preset === "max") return max;
        const call = Math.max(0, view?.action_info?.to_call || 0);
        const fraction = preset === "half" ? 0.5 : 1;
        const target = (view?.current_bet || 0) + Math.ceil(((view?.pot_total || 0) + call) * fraction);
        return Math.max(min, Math.min(max, target));
    }
    function updateActions() {
        const own = ownPlayer();
        const ended = view?.phase === "hand_end";
        const limits = betLimits();
        Object.entries(actionIds).forEach(([action, id]) => {
            $(id).disabled = !legal(action) || (["bet", "raise"].includes(action) && !validAmount());
        });
        const owed = view?.action_info?.to_call || 0;
        const call = Math.min(owed, own?.chips || 0);
        $("CheckBtn").hidden = owed > 0;
        $("CallBtn").hidden = owed <= 0;
        $("CallBtn").textContent = "Call " + chips(call) + (own && call === own.chips && call > 0 ? " · All-in" : "");
        $("AllInBtn").textContent = "All-in " + chips(own?.chips);
        $("BettingControls").hidden = ended || (!!view && !own) || ["folded", "all_in", "out"].includes(own?.status);
        $("RebuyRow").hidden = !(ended && own?.chips === 0);
        $("RebuyBtn").textContent = "Rebuy " + chips(view?.config?.starting_chips);
        $("BetLabel").textContent = limits.type === "raise" ? "Raise to" : "Bet";
        $("BetBtn").hidden = limits.type !== "bet";
        $("RaiseBtn").hidden = limits.type !== "raise";
        const canEdit = legal(limits.type);
        $("BetInput").disabled = !canEdit;
        $("BetRange").disabled = !canEdit;
        panel.querySelectorAll("[data-texas-preset]").forEach((button) => {
            button.disabled = !canEdit;
            button.setAttribute("aria-pressed", String(canEdit && amount() === presetAmount(button.dataset.texasPreset)));
        });
        const valid = validAmount();
        $("BetInput").setAttribute("aria-invalid", String(canEdit && !valid));
        $("BetHint").classList.toggle("texas-invalid", canEdit && !valid);
        if (!canEdit) {
            $("BetHint").textContent = pending ? "Sending your action…" : view?.current_turn === view?.you ? "A full raise is unavailable. Choose an available action above." : "Bet controls unlock on your turn.";
        } else if (!valid) {
            $("BetHint").textContent = "Enter a whole number from " + format(limits.min) + " to " + format(limits.max) + ".";
        } else {
            const pay = amount() - (own?.current_bet || 0);
            $("BetHint").textContent = "Adds " + chips(pay) + " · Leaves " + chips((own?.chips || 0) - pay) + (amount() === limits.max ? " · All-in" : "");
        }
    }
    function render(data) {
        if (!data?.view) return;
        view = data.view;
        pending = false;
        window.clearTimeout(pendingTimer);
        $("Feedback").hidden = true;
        if (currentGameType !== "texas_holdem") {
            currentGameType = "texas_holdem";
            setGamePanelVisibility("texas_holdem");
        }
        hideTip();
        const own = ownPlayer();
        const ended = view.phase === "hand_end";
        const turn = view.players.find((player) => player.player_id === view.current_turn);
        $("Hand").textContent = view.hand_number ?? "–";
        $("Blinds").textContent = format(view.config?.small_blind) + " / " + format(view.config?.big_blind);
        $("Pot").textContent = format(ended ? view.last_hand_summary?.pot_total ?? view.pot_total : view.pot_total);
        $("PotCaption").textContent = ended ? "POT AWARDED" : "TOTAL POT";
        $("CurrentBet").textContent = ended ? "–" : chips(view.current_bet);
        $("Phase").textContent = phases[view.phase] || "Waiting to deal";
        $("YourChips").textContent = chips(own?.chips);
        $("ToCall").textContent = own && !ended && own.status === "active" ? chips(Math.min(view.action_info?.to_call || 0, own.chips)) : "–";
        $("OwnSection").hidden = !!view && !own;
        $("YourStatus").textContent = ended ? "After this hand" : own?.status === "folded" ? "Folded" : own?.status === "all_in" ? "All-in" : own?.status === "out" ? "Sitting out" : "Bet " + format(own?.current_bet);
        let message = "Waiting for the next action";
        if (ended) message = own ? "Review the result, then choose Next Hand." : "Spectating · Reviewing the hand";
        else if (!own) message = "Spectating" + (turn ? " · " + turn.name + " to act" : "");
        else if (view.current_turn === view.you) message = "Your turn" + (view.action_info?.to_call ? " · Call " + chips(Math.min(view.action_info.to_call, own.chips)) + " to stay in" : " · You can check");
        else if (own.status === "folded") message = "You folded" + (turn ? " · " + turn.name + " to act" : "");
        else if (own.status === "all_in") message = "You are all-in · Waiting for the remaining players";
        else message = turn ? "Waiting for " + turn.name : message;
        $("Turn").textContent = message;
        $("Turn").classList.toggle("texas-your-turn", !!own && view.current_turn === view.you);
        const street = ["preflop", "flop", "turn", "river", "hand_end"].indexOf(view.phase);
        $("Streets").querySelectorAll("li").forEach((node, index) => {
            node.classList.toggle("texas-street-done", index < street);
            if (index === street) node.setAttribute("aria-current", "step");
            else node.removeAttribute("aria-current");
        });
        renderCards($("CommunityCards"), view.community_cards, true);
        renderCards($("YourHand"), own?.hole_cards);
        renderPlayers();
        renderSummary();
        const limits = betLimits();
        const context = [view.you, view.hand_number, view.phase, view.current_turn, view.current_bet, own?.chips, own?.current_bet, limits.min, limits.max].join("|");
        ["BetInput", "BetRange"].forEach((id) => {
            $(id).min = String(limits.min);
            $(id).max = String(limits.max);
            $(id).step = "1";
        });
        if (context !== betContext) {
            $("BetInput").value = limits.max > 0 ? String(limits.min) : "";
            $("BetRange").value = String(limits.min);
            betContext = context;
        }
        updateActions();
        logGameEvents(data);
    }
    function feedback(message) {
        $("Feedback").textContent = message;
        $("Feedback").hidden = !message;
    }
    function submit(action) {
        if (explaining || !legal(action.type)) return;
        if (["bet", "raise"].includes(action.type) && !validAmount()) return;
        if (typeof ensureRoomConnection === "function" && !ensureRoomConnection()) {
            feedback("Reconnect to the room before acting.");
            return;
        }
        pending = true;
        feedback("Sending your action…");
        updateActions();
        sendAction(action);
        window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => {
            pending = false;
            feedback("No update received. Check the connection before retrying.");
            updateActions();
        }, 8000);
    }
    function hideTip() {
        window.clearTimeout(tipTimer);
        tooltip.hidden = true;
        if (tipTarget) tipTarget.removeAttribute("aria-describedby");
        tipTarget = null;
    }
    function showTip(target, timed = false) {
        if (explaining || dialog.open || !target?.dataset.texasTip) return;
        hideTip();
        tooltip.textContent = target.dataset.texasTip;
        tooltip.hidden = false;
        tipTarget = target;
        target.setAttribute("aria-describedby", "texasTooltip");
        const rect = target.getBoundingClientRect();
        const width = tooltip.offsetWidth;
        const height = tooltip.offsetHeight;
        tooltip.style.left = Math.max(12, Math.min(innerWidth - width - 12, rect.left + rect.width / 2 - width / 2)) + "px";
        tooltip.style.top = Math.max(12, Math.min(innerHeight - height - 12, rect.bottom + height + 20 < innerHeight ? rect.bottom + 8 : rect.top - height - 8)) + "px";
        if (timed) tipTimer = window.setTimeout(hideTip, 3000);
    }
    function setExplain(enabled) {
        explaining = enabled;
        hideTip();
        panel.classList.toggle("texas-explaining", enabled);
        $("ExplainBtn").setAttribute("aria-pressed", String(enabled));
        $("ExplainHint").hidden = !enabled;
    }
    function openDialog(title, content, html = false) {
        hideTip();
        returnFocus = document.activeElement;
        $("DialogTitle").textContent = title;
        if (html) $("DialogBody").innerHTML = content;
        else $("DialogBody").textContent = content;
        if (!dialog.open) dialog.showModal();
        dialog.scrollTop = 0;
        $("DialogClose").focus({ preventScroll: true });
    }
    function explainTarget(target) {
        if (!target) return;
        const description = explanations[target.dataset.texasExplain] || [target.dataset.texasTitle || "Table detail", target.dataset.texasTip];
        if (!description[1]) return;
        setExplain(false);
        openDialog(description[0], description[1]);
    }
    function exempt(target) { return target.closest("#texasHelpBtn, #texasExplainBtn, #texasDialog"); }
    function clearState() {
        view = null;
        betContext = "";
        pending = false;
        suppressClick = false;
        window.clearTimeout(pendingTimer);
        window.clearTimeout(suppressTimer);
        setExplain(false);
        if (dialog.open) dialog.close();
        ["Hand", "Blinds", "CurrentBet", "YourChips", "ToCall"].forEach((id) => { $(id).textContent = "–"; });
        $("Pot").textContent = "0";
        $("PotCaption").textContent = "TOTAL POT";
        $("Phase").textContent = "Waiting to deal";
        $("Turn").textContent = "Waiting for the game to start";
        $("Turn").classList.remove("texas-your-turn");
        $("YourStatus").textContent = "";
        $("BetInput").value = "";
        $("BetRange").value = "1";
        $("OwnSection").hidden = false;
        $("Summary").hidden = true;
        $("SummaryList").replaceChildren();
        $("NextHandBtn").textContent = "Next Hand";
        $("Streets").querySelectorAll("li").forEach((node) => {
            node.removeAttribute("aria-current");
            node.classList.remove("texas-street-done");
        });
        renderCards($("CommunityCards"), [], true);
        renderCards($("YourHand"), []);
        renderPlayers();
        feedback("");
        updateActions();
    }

    Object.entries(actionIds).forEach(([action, id]) => $(id).addEventListener("click", () => {
        submit(["bet", "raise"].includes(action) ? { type: action, amount: amount() } : { type: action });
    }));
    $("BetInput").addEventListener("input", () => {
        if (validAmount()) $("BetRange").value = String(amount());
        updateActions();
    });
    $("BetRange").addEventListener("input", () => {
        $("BetInput").value = $("BetRange").value;
        updateActions();
    });
    panel.querySelectorAll("[data-texas-preset]").forEach((button) => button.addEventListener("click", () => {
        if (!legal(betLimits().type)) return;
        $("BetInput").value = String(presetAmount(button.dataset.texasPreset));
        $("BetRange").value = $("BetInput").value;
        updateActions();
    }));
    $("HelpBtn").addEventListener("click", () => { setExplain(false); openDialog("Texas Hold’em · Help", helpHTML, true); });
    $("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
    $("DialogClose").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
        if (returnFocus?.isConnected && !panel.classList.contains("hidden")) returnFocus.focus({ preventScroll: true });
    });
    dialog.addEventListener("click", (event) => {
        const rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    document.addEventListener("pointerdown", (event) => {
        if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = document.elementsFromPoint(event.clientX, event.clientY)
            .map((node) => node.closest("#texasHoldemPanel [data-texas-explain]")).find(Boolean);
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
        if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        explainTarget(event.target.closest("#texasHoldemPanel [data-texas-explain]"));
    }, true);
    document.addEventListener("keydown", (event) => {
        if (panel.classList.contains("hidden")) return;
        if (event.key === "Escape") {
            setExplain(false);
            return;
        }
        if (!explaining || exempt(event.target)) return;
        if ([" ", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (event.key === " " || event.key === "Enter") explainTarget(event.target.closest("[data-texas-explain]"));
        }
    }, true);
    panel.addEventListener("pointerover", (event) => {
        const target = event.target.closest("[data-texas-tip]");
        if (event.pointerType === "mouse" && target && !target.contains(event.relatedTarget)) showTip(target);
    });
    panel.addEventListener("pointerout", (event) => {
        const target = event.target.closest("[data-texas-tip]");
        if (event.pointerType === "mouse" && target && !target.contains(event.relatedTarget)) hideTip();
    });
    panel.addEventListener("click", (event) => {
        const target = event.target.closest("[data-texas-tip]");
        if (target) showTip(target, true);
        else hideTip();
    });
    panel.addEventListener("focusin", (event) => {
        if (event.target.matches("[data-texas-tip]")) showTip(event.target, true);
    });
    panel.addEventListener("focusout", hideTip);
    window.addEventListener("scroll", hideTip, true);
    window.addEventListener("resize", hideTip);
    window.renderTexasHoldemGameState = render;
    window.clearTexasHoldemState = clearState;
    window.showTexasHoldemHeaderActions = (visible) => {
        $("HeaderActions").hidden = !visible;
        if (!visible) {
            setExplain(false);
            if (dialog.open) dialog.close();
        }
    };
    if (typeof socket !== "undefined") {
        socket.on("system:error", (data) => {
            if (!pending || currentGameType !== "texas_holdem") return;
            pending = false;
            window.clearTimeout(pendingTimer);
            feedback(data?.message || "Action failed. Please try again.");
            updateActions();
        });
        socket.on("room:state", (room) => {
            if (room?.game_type !== "texas_holdem") return;
            if (room.status === "lobby") clearState();
        });
    }
    function initialize() {
        panel.querySelectorAll("[data-texas-explain]").forEach((node) => {
            if (node.matches("button, input") || node.querySelector("button, input")) return;
            const info = explanations[node.dataset.texasExplain];
            if (info) setTip(node, info[0] + " · " + info[1].split(". ")[0] + ".", info[0]);
        });
        clearState();
        if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "texas_holdem") {
            showTexasHoldemHeaderActions(true);
            if (currentRoomState.status !== "lobby" && typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "texas_holdem") render(lastGameStatePayload);
        }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
    else initialize();
})();
