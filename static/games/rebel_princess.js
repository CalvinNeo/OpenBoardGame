(() => {
    const panel = document.getElementById("rebelPrincessPanel");
    if (!panel) return;
    const get = (id) => document.getElementById(`rebel${id}`);
    const suits = { queen: ["👑", "Queen"], fairy: ["🪄", "Fairy"], pet: ["🐾", "Pet"], prince: ["🤴", "Prince"] };
    const phases = {
        pass: "Pass cards", reserve_last: "Save your last card", reveal_suit: "Reveal a suit",
        split_hand: "Prepare your second half", gift: "Place a gift", trick_pass: "Pass one card",
        sleeping_beauty_collect: "Sleeping Beauty · Give a card", sleeping_beauty_keep: "Sleeping Beauty · Keep a card",
        trick: "Play a trick", mulan: "Mulan · Exchange", haggle: "Haggle · Exchange",
        pocahontas: "Pocahontas · Choose the next leader", scheherazade_decide: "Scheherazade · Keep or return",
        round_pause: "Round complete", game_over: "Game complete",
    };
    const roundGuides = {
        once_upon_a_time: "Standard rules: follow suit; the highest card of the led suit wins.",
        invitation: "Standard rules: follow suit; the highest card of the led suit wins.",
        masquerade_ball: "Only the opening card is visible to everyone. The other cards are revealed when the trick finishes.",
        royal_decree: "Queen (👑) cards beat other suits. If several Queens are played, the strongest Queen wins.",
        musical_chairs: "After each trick, everyone passes one hand card to the right before play continues.",
        pets_revenge: "Every Pet (🐾) adds 1 proposal (💍). The Frog (🐸 8) adds 6 in total; Princes (🤴) still add 1 each.",
        late_to_the_ball: "After passing, save one hidden card. It returns to your hand for the final trick.",
        poisoned_apple: "Cards played by someone unable to follow suit beat cards that follow suit. Compare their ranks; equal ranks favor the later card.",
        crystal_clear: "After passing, choose a suit. Everyone can see all cards you hold in that suit.",
        upside_down: "Each rank-6 card reverses the rank order for this trick. One 6 makes low cards win; two 6s restore high cards.",
        dancing_queens: "Captured Princes (🤴) pair with Queens (👑): 3 proposals (💍) for matching ranks, 2 for other pairs, 1 per unpaired Prince.",
        prince_always_rings_twice: "Everyone plays twice per trick. Add each player’s ranks in the opening suit; the highest sum wins.",
        wedding_gift: "Before each trick, everyone places a hidden gift (🎁). The winner takes those cards too, including their proposals (💍).",
        after_party: "Save half your hand for later. Play the other half first, then pick up the saved cards.",
        bathroom_break: "Princes (🤴) add 2 proposals (💍), except for players who started this round with the lowest total: their Princes add 1.",
        single_fairy: "Each captured Fairy (🪄) removes 1 proposal (💍) from your round score.",
        blind_mans_bluff: "Save half your hand. After playing the first half, everyone passes the saved half to the right.",
        midnight_makeover: "Fairies (🪄) can follow any suit and compete to win the trick with their printed rank.",
        pass_the_bouquet: "When someone plays a different suit, it becomes the required suit. The strongest card in the final required suit wins.",
        haggle_with_the_hag: "The trick winner may exchange one hand card for a captured card played by someone else.",
        odds_and_evens: "Match the opening card’s odd/even rank if possible. Matching its suit takes priority; enabled cards show your choices.",
    };
    const roundDescription = () => roundGuides[view?.round_card?.id] || view?.round_card?.summary || "No extra rule.";
    let view = null;
    let selected = [];
    let selectedSuit = null;
    let context = "";
    let explaining = false;
    let suppressClickUntil = 0;
    let dialogOrigin = null;
    const hints = window.createRebelHints({ panel, isExplaining: () => explaining, onExplain: showExplanation });

    const text = (id, value) => { get(id).textContent = value; };
    const visible = (id, show) => get(id).classList.toggle("hidden", !show);
    const me = () => (view?.players || []).find(p => p.player_id === view.you);
    const actions = () => new Set(view?.legal_actions || []);
    const name = (id) => (view?.players || []).find(p => p.player_id === id)?.name || "another player";
    const suitName = (suit) => suits[suit] ? `${suits[suit][0]} ${suits[suit][1]}` : "Any suit";
    const cardName = (card) => card ? (card.is_frog ? "🐸 Frog 8" : `${suitName(card.suit)} ${card.rank}`) : "🂠 Hidden card";
    const isFinished = () => view?.game_over || view?.phase === "round_pause";
    function element(tag, className, content) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;
        return node;
    }
    function tip(node, message) {
        node.dataset.rebelTip = message;
        node.setAttribute("aria-label", message);
        return node;
    }
    function explain(node, message) { node.dataset.rebelExplain = message; return node; }
    function badge(content, message) { return tip(element("span", "rebel-badge", content), message); }
    function maxCards() {
        if (view.phase === "pass") return view.pass_required;
        if (view.phase === "split_hand") return Math.floor(view.hand.length / 2);
        return 1;
    }
    function passSlots() {
        return (view.round_card?.pass || []).flatMap(spec => Array.from({ length: spec.count }, () => spec.direction));
    }
    function selectedCards() { return selected.map(id => view.hand.find(c => c.id === id)).filter(Boolean); }
    function powerAvailable() { return actions().has("use_princess"); }
    function handSelectable() {
        const legal = actions();
        return (legal.has("pass_cards") || legal.has("choose_card") || legal.has("play_card")
            || (legal.has("setup_choice") && view.phase !== "reveal_suit")
            || (powerAvailable() && ["mulan", "haggle", "scheherazade_decide"].includes(view.phase)));
    }
    function blockedReason(card) {
        if (!handSelectable()) return isFinished() ? "This round is finished. Review the results." : "Your hand is for reference while you wait. No card selection is needed now.";
        if (view.phase === "mulan") {
            const played = view.current_trick.find(entry => entry.player_id === view.you)?.card;
            if (!played || played.suit !== card.suit || card.is_frog) return `Mulan needs a non-frog card of the same suit as your played card (${cardName(played)}).`;
        }
        if (view.phase === "trick" && !(view.legal_cards || []).some(c => c.id === card.id)) {
            if (!view.current_trick.length && card.suit === "prince" && !view.princes_sneaked_in) return "Princes (🤴) cannot lead yet while you hold other suits. They must first enter play when someone cannot follow suit.";
            return `This card cannot be played now. Follow ${suitName(view.current_required_suit || view.lead_suit)} if possible, including this round’s rule and any active princess restrictions. The enabled cards are your legal choices.`;
        }
        return "";
    }
    function cardPoints(card) {
        const rule = view.round_card?.id;
        if (card.is_frog) return rule === "pets_revenge" ? "+6" : "+5";
        if (card.suit === "prince") return rule === "bathroom_break" ? "+1–2" : rule === "dancing_queens" ? "+1–3" : "+1";
        if (rule === "pets_revenge" && card.suit === "pet") return "+1";
        if (rule === "single_fairy" && card.suit === "fairy") return "−1";
        if (rule === "dancing_queens" && card.suit === "queen") return "pair";
        return "0";
    }
    function cardExplanation(card) {
        const point = cardPoints(card);
        const scoring = point === "pair" ? "Queens pair with captured Princes (🤴) to add proposals this round."
            : `Worth ${point} proposals (💍) to the player who captures it${point.includes("–") ? ", depending on this round’s scoring rule" : ""}.`;
        return `${cardName(card)}. ${card.is_frog ? "The Frog is the rank-8 Pet (🐾). " : ""}${scoring} Rank decides trick strength; it is not the number of penalty points. ${blockedReason(card) || "Select the card, then confirm the action below your hand."}`;
    }
    function refreshSelection() {
        const cards = selectedCards();
        let label = cards.length ? cards.map((card, i) => {
            const direction = view.phase === "pass" ? ` → ${passSlots()[i] || "right"}` : "";
            return `${cardName(card)}${direction}`;
        }).join(" · ") : "Select a card to begin.";
        if (["pass", "split_hand"].includes(view.phase) && handSelectable()) label = `${cards.length}/${maxCards()} selected${cards.length ? ` · ${label}` : ""}`;
        if (view.phase === "reveal_suit") label = selectedSuit ? `Reveal ${suitName(selectedSuit)}` : "Choose a suit above.";
        if (!handSelectable() && !(view.phase === "reveal_suit" && actions().has("setup_choice"))) label = "";
        text("SelectedCards", label);
        visible("Selection", Boolean(label));
        tip(get("SelectionInfo"), "Selection: select a card again to remove it, or tap empty space around your hand to deselect. Viewing an ⓘ explanation keeps your selection. When passing left and right, cards are sent in the order you select them.");
        panel.querySelectorAll(".rebel-card").forEach(button => {
            const chosen = selected.includes(button.dataset.cardId);
            button.classList.toggle("selected", chosen);
            button.setAttribute("aria-pressed", String(chosen));
            button.parentElement.dataset.selected = String(chosen);
            const marker = button.querySelector(".rebel-card-order");
            marker.textContent = chosen ? String(selected.indexOf(button.dataset.cardId) + 1) : "";
        });
        updateActions();
        hints.refresh();
    }
    function toggleCard(id) {
        if (selected.includes(id)) selected = selected.filter(value => value !== id);
        else if (maxCards() === 1) selected = [id];
        else if (selected.length < maxCards()) selected.push(id);
        refreshSelection();
    }
    function renderHand() {
        const hand = get("Hand");
        hand.replaceChildren();
        text("HandCount", `${view.hand.length} cards`);
        tip(get("HandCount"), `Hand: you currently hold ${view.hand.length} cards. Cards set aside for later are not included.`);
        for (const card of view.hand) {
            const wrap = element("div", "rebel-card-wrap");
            wrap.dataset.suit = card.suit;
            const button = element("button", "rebel-card");
            button.type = "button";
            button.dataset.cardId = card.id;
            button.dataset.suit = card.suit;
            button.disabled = Boolean(blockedReason(card));
            button.setAttribute("aria-label", `Select ${cardName(card)}`);
            explain(button, cardExplanation(card));
            button.append(element("span", "rebel-card-order"), element("span", "rebel-card-rank", `${card.is_frog ? "🐸" : suits[card.suit][0]} ${card.rank}`), element("span", "rebel-card-name", card.is_frog ? "Frog" : suits[card.suit][1]));
            button.addEventListener("click", () => toggleCard(card.id));
            const info = tip(element("button", "rebel-card-info", `${cardPoints(card)} 💍 ⓘ`), cardExplanation(card));
            info.type = "button";
            wrap.append(button, info);
            hand.append(wrap);
        }
        if (!view.hand.length) hand.append(element("p", "rebel-empty", view.your_princess ? "No cards left in your hand." : "You are watching this game."));
        let hint = handSelectable() ? "Tap a card, then confirm below. Tap ⓘ to learn about a card." : "Your cards will become selectable when needed.";
        if (view.phase === "trick" && actions().has("play_card")) hint = `${view.legal_cards.length} playable · Dimmed cards cannot be played now. Tap their ⓘ to see why.`;
        if (view.phase === "pass" && handSelectable()) hint = "Select cards in order. Their destinations appear below your hand.";
        if (view.phase === "split_hand" && handSelectable()) hint = "Selected cards are saved for the second half; you play the others first.";
        text("HandHint", hint);
        visible("HandSection", !isFinished());
    }
    function renderChoices() {
        const legal = actions();
        const princess = view.your_princess?.id;
        const suitChoice = (view.phase === "reveal_suit" && legal.has("setup_choice")) || (view.phase === "trick" && princess === "little_mermaid" && powerAvailable());
        visible("SuitField", suitChoice);
        text("SuitLabel", view.phase === "reveal_suit" ? "Choose a suit to reveal" : "Optional ability: force the opening suit");
        get("SuitButtons").replaceChildren();
        if (suitChoice) for (const suit of view.suits || Object.keys(suits)) {
            const button = element("button", selectedSuit === suit ? "selected" : "", suitName(suit));
            button.type = "button";
            button.disabled = view.phase !== "reveal_suit" && suit === "prince" && !view.princes_sneaked_in;
            button.setAttribute("aria-pressed", String(selectedSuit === suit));
            explain(button, `${suitName(suit)}: ${button.disabled ? "The Little Mermaid cannot choose Princes before they enter play." : view.phase === "reveal_suit" ? "Reveal all your cards of this suit to everyone. You may choose a suit you do not hold." : "Force the leader to start with this suit if they hold it. Choosing a suit alone does not use the ability."}`);
            button.addEventListener("click", () => { selectedSuit = selectedSuit === suit ? null : suit; renderChoices(); refreshSelection(); });
            // Suit buttons are actions. A separate info target explains their disabled state.
            const choice = element("div", "rebel-suit-choice");
            const info = tip(element("span", "rebel-info", "ⓘ"), button.dataset.rebelExplain);
            choice.append(button, info);
            get("SuitButtons").append(choice);
        }
        const targetChoice = powerAvailable() && (view.phase === "pocahontas" || (view.phase === "trick" && princess === "scheherazade"));
        visible("TargetField", targetChoice);
        const oldTarget = get("TargetSelect").value;
        get("TargetSelect").replaceChildren(new Option("Choose a player…", ""));
        if (targetChoice) for (const player of view.players) {
            if (player.player_id === view.you || (view.phase === "trick" && !player.hand_count)) continue;
            get("TargetSelect").append(new Option(player.name, player.player_id));
        }
        if ([...get("TargetSelect").options].some(o => o.value === oldTarget)) get("TargetSelect").value = oldTarget;
        explain(get("TargetSelect"), view.phase === "pocahontas" ? "Choose another player to lead the next trick." : "Choose another player with cards. Scheherazade draws one random card; you decide whether to exchange after seeing it.");
        const pool = view.phase === "haggle" ? view.pending_haggle?.trick_cards || [] : view.phase === "sleeping_beauty_keep" ? (view.sleeping_beauty_pool || []).map(item => item.card) : [];
        visible("TrickCardField", powerAvailable() && ["haggle", "sleeping_beauty_keep"].includes(view.phase));
        text("TrickCardLabel", view.phase === "haggle" ? "Take a captured card" : "Choose a card to keep");
        const oldPoolCard = get("TrickCardSelect").value;
        get("TrickCardSelect").replaceChildren(new Option("Choose a card…", ""));
        pool.forEach(card => get("TrickCardSelect").append(new Option(cardName(card), card.id)));
        if (pool.some(card => card.id === oldPoolCard)) get("TrickCardSelect").value = oldPoolCard;
        explain(get("TrickCardSelect"), view.phase === "haggle" ? "Choose a card from the completed trick to take into your hand. Your selected hand card goes into your captured cards." : "Keep one donated card. The remaining cards return randomly to the other players.");
        visible("DrawnCard", Boolean(view.scheherazade_drawn));
        if (view.scheherazade_drawn) {
            text("DrawnCard", `Drawn from ${name(view.scheherazade_drawn.target)}: ${cardName(view.scheherazade_drawn.card)}`);
            tip(get("DrawnCard"), `${cardName(view.scheherazade_drawn.card)}: give one hand card to keep this card, or choose Return Drawn Card to give it back.`);
        }
        const canPlayPower = view.phase === "trick" && legal.has("play_card") && !me()?.princess_used;
        visible("SnowWhiteField", canPlayPower && princess === "snow_white");
        visible("PeaField", canPlayPower && princess === "pea_princess");
        explain(get("SnowWhiteToggle"), "Use Snow White with this play: rank 7 or lower counts as rank 0 for winning the trick, once per round.");
        explain(get("PeaToggle"), "Use the Pea Princess with this play: remaining players must play above 5 if possible, once per round.");
        if (!canPlayPower) { get("SnowWhiteToggle").checked = false; get("PeaToggle").checked = false; }
        explain(get("SnowWhiteField"), get("SnowWhiteToggle").dataset.rebelExplain);
        explain(get("PeaField"), get("PeaToggle").dataset.rebelExplain);
    }
    function renderGuide() {
        const phase = view.phase;
        const legal = actions();
        const mine = legal.has("play_card");
        let title = "Choose your next move";
        let detail = "Follow the instructions below your hand.";
        if (phase === "pass") {
            title = `Choose ${view.pass_required} cards to pass`;
            detail = (view.round_card.pass || []).map(spec => `${spec.count} ${spec.count === 1 ? "card" : "cards"} to your ${spec.direction}`).join(", then ") + ". Select in that order, then confirm. Everyone passes before play begins.";
        } else if (phase === "trick") {
            title = mine ? "Your turn · Play one card" : `${name(view.current_turn)} is playing`;
            const required = view.current_required_suit || view.lead_suit;
            detail = !view.current_trick.length ? "Start the trick by playing a card. Its suit sets what everyone must follow." : `Follow ${suitName(required)} if you can; otherwise choose another suit. Normally the highest card of the led suit takes the trick.`;
            if (powerAvailable() && !mine) detail += " Your princess ability is available now.";
        } else {
            const guide = {
                reserve_last: ["Save one card for the final trick", "Select one card to set aside face down. It returns for the last trick."],
                reveal_suit: ["Choose one suit to reveal", "Everyone will see your cards in that suit for this round. You can choose a suit you do not hold."],
                split_hand: [`Save ${Math.floor(view.hand.length / 2)} cards for later`, view.round_card?.id === "blind_mans_bluff" ? "Play the unselected half first. The selected half will pass right before the second half begins." : "Play the unselected half first, then pick up the selected half."],
                gift: ["Choose one hidden gift", "Place one hand card face down. Whoever wins the next trick also takes all the gifts and their proposals."],
                trick_pass: ["Pass one card to your right", "Select a hand card to pass before the next trick begins."],
                sleeping_beauty_collect: ["Give Sleeping Beauty one card", "Everyone contributes one hand card, including Sleeping Beauty. She keeps one and returns the rest randomly."],
                sleeping_beauty_keep: ["Keep one of the donated cards", "Choose a card below. The other cards return randomly. Random Keep lets the game choose for you."],
                mulan: ["Swap your played card?", "Choose a same-suit, non-frog card from your hand, or skip to keep the card you played."],
                haggle: ["Exchange with the trick you won?", "Select one hand card and one captured card below. Swap them, or skip. This comes from the round rule."],
                pocahontas: ["Choose who leads next", "Choose another player, then confirm. Skip to keep the usual leader."],
                scheherazade_decide: ["Keep the drawn card?", "Select one hand card to give in exchange, or return the drawn card without swapping."],
                round_pause: ["Review the round results", "Proposals are added to the totals below. The next round starts only after every player presses Next Round."],
                game_over: [`${(view.winners || []).map(name).join(" & ")} wins!`, "The lowest proposal total wins. Ties favor the most rounds with zero proposals."],
            };
            [title, detail] = guide[phase] || [title, detail];
        }
        if (!legal.size && !isFinished()) {
            title = me()?.passed ? "Submitted · Waiting for the others" : view.current_turn ? `Waiting for ${name(view.current_turn)}` : "Waiting for the other players";
            detail = me()?.passed ? "Your choice is locked in. Play continues when everyone has submitted." : "Your next step will appear here when it is time to act.";
        }
        if (!me() && !view.game_over) { title = "Watching this game"; detail = "Follow the cards on the table and the players’ scores. Private hands stay hidden."; }
        text("Phase", phases[phase] || "Rebel Princess");
        tip(get("Phase"), `${phases[phase] || "Current phase"}: ${detail}`);
        text("GuideTitle", title);
        text("GuideText", detail);
        get("Guide").classList.toggle("your-turn", legal.size > 0 && !isFinished());
    }
    function renderTable() {
        const table = get("Trick");
        table.replaceChildren();
        for (const entry of view.current_trick || []) {
            const card = element("div", "rebel-trick-card");
            if (entry.card) card.dataset.suit = entry.card.suit;
            card.append(element("span", "", `${entry.name}${entry.player_id === view.you ? " · You" : ""}`), element("strong", "", entry.hidden ? "🂠 Hidden" : cardName(entry.card)));
            if (entry.snow_zero) card.append(element("small", "", "Counts as 0"));
            else if (entry.was_void) card.append(element("small", "", "Could not follow"));
            tip(card, `${entry.name}: ${entry.hidden ? "Hidden card (🂠). This round hides other players’ cards until the trick resolves." : `${cardName(entry.card)}. Rank ${entry.card.rank} determines trick strength; its proposal value is ${cardPoints(entry.card)} (💍).${entry.snow_zero ? " Snow White makes its rank count as 0 for this trick." : ""}${entry.was_void ? " This player could not follow the required suit." : ""}`}`);
            table.append(card);
        }
        if (view.gift_count) table.append(tip(element("div", "rebel-trick-card", `🎁 ${view.gift_count} gifts`), `Gifts (🎁): ${view.gift_count} hidden cards go to the trick winner, including any proposals (💍).`));
        if (!table.children.length) table.append(element("p", "rebel-empty", view.phase === "pass" ? "The table is ready. Pass your cards to begin." : `${name(view.leader)} leads the next trick.`));
        text("Tricks", `${view.tricks_played || 0} tricks played`);
        tip(get("Tricks"), `Tricks: ${view.tricks_played || 0} completed this round. A trick is a set of cards played around the table; its winner captures those cards.`);
        text("RequiredSuit", view.current_required_suit ? `Follow ${suitName(view.current_required_suit)}` : "Lead any allowed suit");
        tip(get("RequiredSuit"), `Required suit: ${suitName(view.current_required_suit)}. Follow it if possible. The led suit is ${suitName(view.lead_suit)}; the round rule may change what wins.`);
        text("PrinceStatus", view.princes_sneaked_in ? "🤴 Princes may lead" : "🤴 Princes not in yet");
        tip(get("PrinceStatus"), `Princes (🤴): ${view.princes_sneaked_in ? "have entered play and may now lead a trick." : "cannot lead while you hold other suits. They enter when played by someone unable to follow suit; an all-Prince hand may also lead them."}`);
        text("TrickHint", "This round: everyone plays twice per trick. Led-suit ranks are added together.");
        visible("TrickHint", view.round_card?.id === "prince_always_rings_twice");
        visible("TableSection", !isFinished() && (view.phase === "trick" || view.current_trick.length > 0 || view.gift_count > 0));
    }
    function renderPrincess() {
        const princess = view.your_princess;
        const used = me()?.princess_used;
        const power = get("Princess");
        power.replaceChildren();
        if (!princess) { power.textContent = "No princess · Spectator"; text("PowerStatus", "Watching"); return; }
        let timing = used ? "Already used this round. It refreshes next round." : "Use once each round.";
        if (!used) {
            const timingById = {
                alice: "Automatic: triggers when you first win a trick without the Frog (🐸 8).",
                snow_white: "On your turn, select a rank 7 or lower card, then check the Snow White option before playing.",
                pea_princess: "During a trick, use the ability separately or with your card. It affects players still to play.",
                mulan: "When a trick is full, you may replace your played card with a same-suit non-frog card.",
                pocahontas: "After winning a trick, you may choose the next leader.",
            };
            timing = timingById[princess.id] || "Use before anyone plays in a trick, even if it is not your turn.";
        }
        const status = used ? "Used" : (powerAvailable() && view.phase !== "haggle") ? "Available now" : princess.id === "alice" ? "Automatic" : "Once per round";
        text("PowerStatus", status);
        tip(get("PowerStatus"), `${princess.name}: ${timing}`);
        power.append(tip(element("strong", "rebel-princess-name", `✨ ${princess.name}`), `${princess.name} (✨): ${princess.summary} Once per round. ${timing}`), element("span", "", princess.summary), element("p", "rebel-power-hint", timing));
    }
    function renderPlayers() {
        get("Players").replaceChildren();
        for (const player of view.players || []) {
            const row = element("div", `rebel-player-row${player.player_id === view.you ? " you" : ""}`);
            const heading = element("div", "rebel-player-main");
            heading.append(element("strong", "", `${player.name}${player.player_id === view.you ? " · You" : ""}`));
            let status = player.player_id === view.current_turn ? "Playing" : "";
            if (player.passed) status = "Submitted";
            if (player.ready_next) status = "Ready";
            if (status) heading.append(badge(status, `${player.name}: ${status === "Ready" ? "has confirmed the next round." : status === "Submitted" ? "has locked in a choice for this phase." : "is choosing the next action."}`));
            const stats = element("div", "rebel-player-stats");
            stats.append(badge(`💍 ${player.score}`, `Total proposals (💍): ${player.score} from completed rounds. Lower is better.`), badge(`🃏 ${player.hand_count}`, `Hand (🃏): ${player.hand_count} cards currently held by ${player.name}.`), badge(`📥 ${player.won_count}`, `Captured cards (📥): ${player.won_count} cards taken this round. This is a card count, not a proposal score.`));
            const identity = tip(element("span", "rebel-player-princess", `${player.princess?.name || "Princess"} · ${player.princess_used ? "used" : "unused"}`), `${player.princess?.name || "Princess"}: ${player.princess?.summary || ""} ${player.princess_used ? "Ability used this round." : "Ability has not been used this round."}`);
            row.append(heading, stats, identity);
            if (player.revealed_cards?.length) row.append(tip(element("div", "rebel-revealed", `Revealed: ${player.revealed_cards.map(cardName).join(" · ")}`), `Revealed ${suitName(player.revealed_suit)} cards are visible to everyone because of this round’s rule.`));
            get("Players").append(row);
        }
    }
    function renderSummary() {
        const summary = view.last_round_summary;
        visible("Summary", Boolean(summary) || isFinished());
        if (!summary) return;
        text("SummaryTitle", view.game_over ? "Final results" : `Round ${view.round} results`);
        const body = get("SummaryBody");
        body.replaceChildren();
        const header = element("div", "rebel-result-row rebel-result-head");
        ["Player", "This round", "Total 💍"].forEach(value => header.append(element("span", "", value)));
        body.append(header);
        for (const player of view.players) {
            const row = element("div", "rebel-result-row");
            row.append(element("strong", "", `${player.name}${view.winners?.includes(player.player_id) ? " · Winner" : ""}`), badge(String(summary.round_scores?.[player.player_id] ?? 0), "Proposals (💍) gained this round, including the round rule."), badge(String(summary.total_scores?.[player.player_id] ?? player.score), "Total proposals (💍) across completed rounds. Lower is better."));
            body.append(row);
        }
        const ready = view.players.filter(player => player.ready_next).length;
        text("ReadyStatus", view.game_over ? "All 5 rounds are complete." : `${ready}/${view.players.length} players ready. Everyone must confirm before the next round.`);
        tip(get("ReadyStatus"), view.game_over ? "Game complete: compare total proposals (💍)." : `Ready: ${ready} of ${view.players.length} players have pressed Next Round. Results stay visible until everyone is ready.`);
        visible("NextRoundBtn", !view.game_over && Boolean(me()));
        get("NextRoundBtn").disabled = !actions().has("next_round_ready");
        text("NextRoundBtn", me()?.ready_next ? "Ready · Waiting" : "Next Round");
        explain(get("NextRoundBtn"), "Confirm that you have finished reading the results. The next round begins only when every player is ready.");
    }
    function updateActions() {
        if (!view) return;
        const legal = actions();
        const phase = view.phase;
        const cards = selectedCards();
        const oneCard = cards.length === 1 && !blockedReason(cards[0]);
        const primaryAvailable = ["pass_cards", "setup_choice", "choose_card", "play_card"].some(a => legal.has(a));
        const ready = phase === "reveal_suit" ? Boolean(selectedSuit) : ["pass", "split_hand"].includes(phase) ? cards.length === maxCards() : oneCard;
        const labels = { pass: `Pass ${view.pass_required} Cards`, reserve_last: "Save for Last Trick", reveal_suit: "Reveal Suit", split_hand: "Save for Second Half", gift: "Place Gift", trick_pass: "Pass Card Right", sleeping_beauty_collect: "Give Card", trick: "Play Card" };
        visible("SubmitBtn", primaryAvailable);
        text("SubmitBtn", labels[phase] || "Confirm");
        get("SubmitBtn").disabled = !primaryAvailable || !ready;
        explain(get("SubmitBtn"), `${labels[phase] || "Confirm"}: ${get("GuideText").textContent} ${!ready ? `First select ${phase === "reveal_suit" ? "a suit" : `${maxCards()} card${maxCards() === 1 ? "" : "s"}`}.` : "Confirm your selection to submit this action."}`);
        const princess = view.your_princess?.id;
        let powerReady = powerAvailable();
        let powerLabel = `Use ${view.your_princess?.name || "Princess"}`;
        if (phase === "trick" && princess === "little_mermaid") powerReady = powerReady && Boolean(selectedSuit) && (selectedSuit !== "prince" || view.princes_sneaked_in);
        if (phase === "pocahontas" || (phase === "trick" && princess === "scheherazade")) powerReady = powerReady && Boolean(get("TargetSelect").value);
        if (["mulan", "haggle", "scheherazade_decide"].includes(phase)) powerReady = powerReady && oneCard;
        if (["haggle", "sleeping_beauty_keep"].includes(phase)) powerReady = powerReady && Boolean(get("TrickCardSelect").value);
        const powerLabels = { mulan: "Replace Played Card", haggle: "Swap Cards", sleeping_beauty_keep: "Keep This Card", scheherazade_decide: "Swap & Keep", pocahontas: "Choose Next Leader" };
        powerLabel = powerLabels[phase] || powerLabel;
        if (phase === "trick" && princess === "scheherazade") powerLabel = "Draw a Random Card";
        visible("PrincessBtn", powerAvailable());
        text("PrincessBtn", powerLabel);
        get("PrincessBtn").disabled = !powerReady;
        explain(get("PrincessBtn"), `${powerLabel}: ${phase === "trick" ? view.your_princess?.summary : get("GuideText").textContent} ${!powerReady ? "Complete the required selections first." : "Confirm to use this effect."}`);
        visible("SkipBtn", legal.has("skip"));
        const skipLabel = phase === "sleeping_beauty_keep" ? "Random Keep" : phase === "scheherazade_decide" ? "Return Drawn Card" : "Skip";
        text("SkipBtn", skipLabel);
        get("SkipBtn").disabled = !legal.has("skip");
        explain(get("SkipBtn"), phase === "sleeping_beauty_keep" ? "Keep a randomly chosen donated card and return the rest randomly." : phase === "scheherazade_decide" ? "Return the drawn card without exchanging. Scheherazade’s ability is still used for this round." : "Continue without using this optional effect.");
        get("SnowWhiteToggle").disabled = !oneCard || cards[0].rank > 7 || me()?.princess_used;
        if (get("SnowWhiteToggle").disabled) get("SnowWhiteToggle").checked = false;
    }
    function send(action) {
        if (!action || !view) return;
        window.sendAction(action);
        selected = [];
        get("SnowWhiteToggle").checked = false;
        get("PeaToggle").checked = false;
        refreshSelection();
    }
    function primaryAction() {
        if (get("SubmitBtn").disabled) return;
        const card = selected[0];
        const byPhase = {
            pass: { type: "pass_cards", card_ids: [...selected] },
            reserve_last: { type: "setup_choice", card_id: card },
            reveal_suit: { type: "setup_choice", suit: selectedSuit },
            split_hand: { type: "setup_choice", card_ids: [...selected] },
            gift: { type: "choose_card", card_id: card }, trick_pass: { type: "choose_card", card_id: card },
            sleeping_beauty_collect: { type: "choose_card", card_id: card },
            trick: { type: "play_card", card_id: card },
        };
        const action = byPhase[view.phase];
        if (view.phase === "trick") {
            if (get("SnowWhiteToggle").checked) action.use_snow_white = true;
            if (get("PeaToggle").checked) action.use_pea_princess = true;
        }
        send(action);
    }
    function princessAction() {
        if (get("PrincessBtn").disabled) return;
        const action = { type: "use_princess" };
        if (view.phase === "trick" && view.your_princess?.id === "little_mermaid") action.suit = selectedSuit;
        if (view.phase === "pocahontas" || (view.phase === "trick" && view.your_princess?.id === "scheherazade")) action.target_player_id = get("TargetSelect").value;
        if (view.phase === "sleeping_beauty_keep") action.keep_card_id = get("TrickCardSelect").value;
        if (view.phase === "mulan") action.card_id = selected[0];
        if (view.phase === "scheherazade_decide") action.give_card_id = selected[0];
        if (view.phase === "haggle") { action.hand_card_id = selected[0]; action.trick_card_id = get("TrickCardSelect").value; }
        send(action);
    }
    function render(data) {
        const next = data.view || data;
        const nextContext = JSON.stringify([next.round, next.phase, next.current_turn, next.tricks_played, next.you, next.current_trick?.map(entry => [entry.player_id, entry.card?.id])]);
        if (nextContext !== context) {
            selected = [];
            selectedSuit = null;
            get("SnowWhiteToggle").checked = false;
            get("PeaToggle").checked = false;
            get("TargetSelect").value = "";
            get("TrickCardSelect").value = "";
            context = nextContext;
        }
        view = next;
        selected = selected.filter(id => view.hand.some(card => card.id === id));
        text("Round", `Round ${view.round} / 5`);
        tip(get("Round"), `Round ${view.round} of 5. Each round has its own rule and resets princess abilities.`);
        text("RoundTitle", view.round_card?.name || "Round rule");
        text("RoundSummary", roundDescription());
        tip(get("RoundTitle"), `Round rule: ${view.round_card?.name}. ${roundDescription()}`);
        text("PrinceValue", `🤴 ${cardPoints({ suit: "prince" })} 💍`);
        tip(get("PrinceValue"), `Prince (🤴): ${cardPoints({ suit: "prince" })} proposals (💍) when captured.${view.round_card?.id === "bathroom_break" ? " Worth 1 for players who had the lowest total at the round start, and 2 for the others." : view.round_card?.id === "dancing_queens" ? " A Prince paired with a Queen is worth 3 when ranks match, or 2 otherwise." : " Try to avoid taking these cards."}`);
        text("FrogValue", `🐸 8 = ${cardPoints({ is_frog: true })} 💍`);
        tip(get("FrogValue"), `Frog (🐸 8): the rank-8 Pet (🐾), worth ${cardPoints({ is_frog: true })} proposals (💍) when captured. Other Pets normally score zero, except in Pets’ Revenge.`);
        renderGuide(); renderTable(); renderChoices(); renderHand(); renderPrincess(); renderPlayers(); renderSummary();
        refreshSelection();
        get("Log").replaceChildren(...(view.log || []).slice(-30).map(line => element("div", "", line)));
    }
    function setExplain(active) {
        explaining = active;
        panel.classList.toggle("rebel-explaining", active);
        document.body.classList.toggle("rebel-explain-mode", active);
        get("ExplainBtn").setAttribute("aria-pressed", String(active));
        visible("ExplainNotice", active);
        hints.hide();
    }
    function openDialog(id) {
        hints.hide();
        setExplain(false);
        dialogOrigin = document.activeElement;
        get(id).showModal();
    }
    function showExplanation(message) {
        text("ExplainContent", message);
        openDialog("ExplainModal");
    }
    function showHelp() {
        const content = get("HelpContent");
        content.innerHTML = `
            <p class="rebel-help-goal"><strong>Win by collecting the fewest proposals (💍) over 5 rounds.</strong></p>
            <h3>1 · Pass, then play</h3><p>At the start of each round, pass the number of cards shown in the prompt. If cards go both left and right, select them in that order. Everyone submits before play starts.</p>
            <h3>2 · Follow the suit</h3><p>A <strong>trick</strong> is a set of cards played around the table. The leader plays first. Match the required suit if you can; otherwise play any legal card. Normally the highest rank in the led suit wins, takes every card in the trick, and leads next.</p>
            <p><strong>Example:</strong> Queen (👑) 3 leads. Queen (👑) 7 beats it. Prince (🤴) 10 does not beat a Queen in a normal Queen-led trick. The winner captures the Prince and gains 1 proposal (💍).</p>
            <h3>3 · Avoid penalty cards</h3><p>Queen (👑), Fairy (🪄) and Pet (🐾) normally score 0. Each Prince (🤴) scores 1. The special Frog (🐸), which is Pet 8, scores 5. These are penalty points; card ranks are separate.</p>
            <p>Princes (🤴) cannot lead while you have other suits until they have entered play. They enter when someone cannot follow suit and plays a Prince. An all-Prince hand may lead Princes.</p>
            <h3>4 · Read the round rule and your princess</h3><p>The rule at the top can change scoring, passing or what wins a trick. Each princess has one ability per round; its timing appears beside your hand. Alice activates automatically. Enabled cards and controls show what you can do now.</p>
            <h3>5 · Review together</h3><p>When the hands are empty, compare proposals from this round and your total. Every player must press <strong>Next Round</strong> to continue. After round 5, the lowest total wins. Ties favor more rounds with zero proposals.</p>
            <h3>Using this screen</h3><p>Select cards, then use the action below your hand to confirm. Tap a selected card again or empty space around your hand to deselect. The separate ⓘ controls explain cards without playing them. Hover or focus badges on desktop; tap them on a touch screen for a 3-second explanation. Use <strong>Explain</strong> to inspect actions, including disabled buttons. Close dialogs with Close or Esc.</p>`;
        if (view) {
            content.append(element("h3", "", "Your current round"), element("p", "", `${view.round_card?.name}: ${roundDescription()}`));
            if (view.your_princess) content.append(element("h3", "", view.your_princess.name), element("p", "", `${view.your_princess.summary} ${get("Princess").querySelector(".rebel-power-hint")?.textContent || ""}`));
        }
        openDialog("HelpModal");
    }
    function closeDialogs() { panel.querySelectorAll("dialog[open]").forEach(dialog => dialog.close()); }
    function clear() {
        view = null; selected = []; selectedSuit = null; context = "";
        setExplain(false); closeDialogs(); hints.hide();
    }
    get("SubmitBtn").addEventListener("click", primaryAction);
    get("PrincessBtn").addEventListener("click", princessAction);
    get("SkipBtn").addEventListener("click", () => { if (actions().has("skip")) send({ type: "skip" }); });
    get("NextRoundBtn").addEventListener("click", () => { if (actions().has("next_round_ready")) send({ type: "next_round_ready" }); });
    get("TargetSelect").addEventListener("change", updateActions);
    get("TrickCardSelect").addEventListener("change", updateActions);
    get("HelpBtn").addEventListener("click", showHelp);
    get("QuickHelpBtn").addEventListener("click", showHelp);
    get("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
    panel.querySelectorAll("[data-rebel-close]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
    panel.querySelectorAll("dialog").forEach(dialog => {
        dialog.addEventListener("click", event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
        dialog.addEventListener("close", () => { if (!panel.closest(".hidden")) dialogOrigin?.focus({ preventScroll: true }); });
    });
    document.addEventListener("pointerdown", event => {
        suppressClickUntil = 0;
        if (!explaining || event.target.closest("[data-rebel-tip]")) return;
        if (event.target.closest("#rebelHelpBtn, #rebelExplainBtn, #rebelQuickHelpBtn, dialog")) return;
        let target = event.target.closest("[data-rebel-explain]");
        if (!target) target = [...panel.querySelectorAll("[data-rebel-explain]")].find(node => {
            const r = node.getBoundingClientRect(); return r.width && r.height && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
        });
        if (target) {
            event.preventDefault(); event.stopImmediatePropagation(); suppressClickUntil = Date.now() + 500;
            showExplanation(target.dataset.rebelExplain);
        } else if (event.target.closest("button, input, select, summary")) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    document.addEventListener("click", event => {
        if (Date.now() < suppressClickUntil) { suppressClickUntil = 0; event.preventDefault(); event.stopImmediatePropagation(); return; }
        if (!explaining || event.target.closest("#rebelHelpBtn, #rebelExplainBtn, #rebelQuickHelpBtn, dialog, [data-rebel-tip]")) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const target = event.target.closest("[data-rebel-explain]");
        if (target) showExplanation(target.dataset.rebelExplain);
    }, true);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") { setExplain(false); hints.hide(); }
        if (!explaining || !["Enter", " ", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        if (event.target.closest("#rebelHelpBtn, #rebelExplainBtn, #rebelQuickHelpBtn, dialog, [data-rebel-tip]")) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const target = event.target.closest("[data-rebel-explain]");
        if (target && ["Enter", " "].includes(event.key)) showExplanation(target.dataset.rebelExplain);
    }, true);
    panel.addEventListener("click", event => {
        if (!view || explaining || event.rebelTipDismissed || event.target.closest("button, input, select, label, summary, dialog, [data-rebel-tip], [data-rebel-explain]")) return;
        if (event.target === get("Hand") || event.target === get("HandSection") || event.target === get("ActionPanel") || event.target === get("Selection") || event.target === panel) { selected = []; refreshSelection(); }
    });
    // Own the lifecycle locally so leaving a room or switching games also closes
    // native dialogs and removes hints, without changing the shared game router.
    const ancestors = [];
    for (let node = panel; node; node = node.parentElement) ancestors.push(node);
    const observer = new MutationObserver(() => { if ((view || explaining || panel.querySelector("dialog[open]")) && panel.closest(".hidden, [hidden], [aria-hidden='true']")) clear(); });
    ancestors.forEach(node => observer.observe(node, { attributes: true, attributeFilter: ["class", "hidden", "aria-hidden"] }));
    window.renderRebelPrincessGameState = render;
    window.clearRebelPrincessState = clear;
})();
