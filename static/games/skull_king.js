(() => {
    "use strict";
    const byId = suffix => document.getElementById(`skullKing${suffix}`);
    const panel = byId("Panel"), header = byId("HeaderActions"), configBox = byId("ConfigBox");
    const dialog = byId("Dialog"), tooltip = byId("Tooltip");
    const suits = {
        green: ["🦜", "鹦鹉", "Parrot"], yellow: ["💰", "宝箱", "Treasure"],
        purple: ["🗺️", "地图", "Map"], black: ["🏴‍☠️", "海盗旗", "Trump"],
    };
    const specials = {
        escape: ["🏳️", "逃跑", "Escape"], pirate: ["⚔️", "海盗", "Pirate"],
        mermaid: ["🧜", "美人鱼", "Mermaid"], tigress: ["🐯", "虎女", "Tigress"],
        skull_king: ["💀", "骷髅王", "Skull King"],
    };
    let view = null, selectedCard = null, selectedBid = null, pending = false, explaining = false;
    let pendingTimer = null, tipTimer = null, suppressClick = false, suppressTimer = null;
    let focusBeforeDialog = null, configSignature = null, renderSignature = null;
    const explanations = {
        round: ["Round · 轮", "每轮重新洗全部 70 张牌。Standard 共 10 轮，每轮发 1–10 张；8 人局第 9、10 轮仍各发 8 张。Quick 为 5 轮，每轮 5 张。每轮首家按座位轮转。"],
        trick: ["Trick · 墩", "每位玩家依次出一张牌组成一墩，最强牌的玩家赢得这墩并领下一墩。每墩结算后所有人点击 Next Trick 才继续。每轮最后一墩后直接查看本轮计分。"],
        lead: ["Lead · 首引花色", "数字牌必须跟首引花色；没有该色才能出其他数字牌。特殊牌随时可出。逃跑（🏳️）或逃跑模式虎女（🐯）首引，定色权顺延；角色牌首引则这一墩不限制花色。中途出现角色牌不会取消已确立的跟色要求。"],
        bid: ["Bid（🎯）· 秘密叫墩", "选择预计本轮赢得的墩数，点击 Confirm Bid 锁定。所有人锁定后同时公开；锁定后不能改。🔒 表示已提交但尚未公开，… 表示尚未提交。叫墩总和不要求等于本轮墩数。"],
        target: ["Target（🎯）· 叫墩目标", "Won / Bid 是已赢墩数与叫墩目标。尽量恰好完成，超过或不足都算失败。玩家的牌数（🂠）是剩余手牌数。"],
        score: ["Score（🏆）· 总分", "总分只包含已结算轮次。正叫且准确：每叫一墩得 20 分；不准：每差一墩扣 10 分。叫 0：成功得本轮实际发牌数 × 10 分，失败扣同样分数。最后累计分最高者获胜，并列共同获胜。"],
        bonus: ["Bonus（✨）· 待兑现奖励", "普通花色 14 每张 +10，黑海盗旗（🏴‍☠️）14 为 +20。海盗（⚔️）吃美人鱼（🧜）每张 +20；骷髅王（💀）吃海盗每张 +30，包含海盗模式虎女（🐯）；美人鱼吃骷髅王 +40。只奖励实际赢家，且本轮叫墩准确时才兑现。"],
        play: ["Play Card · 出牌", "选择手牌，再确认出牌。灰色牌当前不能出，通常因为未轮到你或必须跟首引花色。点击空白或按 Esc 可取消选牌。特殊牌可以随时打出。"],
        cancel: ["Cancel · 取消选择", "取消当前选牌。也可点击周围空白或按 Esc，不会消耗卡牌。"],
        tigress: ["Tigress（🐯）· 虎女", "出牌时选择 Pirate（⚔️，海盗）或 Escape（🏳️，逃跑）；随后在本墩中具有该牌的全部特性。被骷髅王（💀）吃掉的海盗模式虎女贡献 30 奖励分，逃跑模式不贡献。"],
        next: ["Next Trick / Next Round", "确认已看完本墩或本轮结果。所有玩家都确认后继续，不会再次询问确认。房间机器人只自动确认自己，断线真人仍需重连后确认。灰胡子（👻）不需要确认。"],
        ghost: ["Graybeard（👻）· 灰胡子", "双人模式的幽灵第三手：自动翻暗牌顶牌，无需跟色；虎女（🐯）固定当逃跑（🏳️）。真人领墩时他第二个出；他赢墩时下墩先出，其余按上一墩顺序轮转。不叫墩、不计总分。"],
        green: ["Parrot（🦜）· 绿鹦鹉", "绿色数字花色，1–14。同花色数字大者胜；未跟首引花色的非王牌不能赢。14 被赢家收走时提供 10 待兑现奖励分。"],
        yellow: ["Treasure（💰）· 黄宝箱", "黄色数字花色，1–14。它是花色，不是货币。同花色数字大者胜；14 提供 10 待兑现奖励分。"],
        purple: ["Map（🗺️）· 紫地图", "紫色数字花色，1–14。同花色数字大者胜；未跟首引花色的非王牌不能赢。14 提供 10 待兑现奖励分。"],
        black: ["Trump（🏴‍☠️）· 黑海盗旗", "黑色是数字王牌花色，任意黑牌胜过普通数字花色；黑牌之间比较数字。仍需遵守跟色：手中有首引花色时不能改出黑牌。黑 14 提供 20 待兑现奖励分。"],
        escape: ["Escape（🏳️）· 逃跑", "可以随时出，通常输给所有其他牌。若所有人都出逃跑（含逃跑模式虎女），第一张逃跑赢墩。逃跑首引时由后续首张非逃跑牌确定跟色要求。"],
        pirate: ["Pirate（⚔️）· 海盗", "胜过数字牌与美人鱼（🧜），输给骷髅王（💀）。多张海盗时先出者胜。海盗赢墩且收走美人鱼，每张有 20 待兑现奖励分。"],
        mermaid: ["Mermaid（🧜）· 美人鱼", "胜所有数字牌，通常输给海盗（⚔️）。只要同墩出现骷髅王（💀），美人鱼就赢，即使还有海盗；多张美人鱼时先出者胜。吃骷髅王有 40 待兑现奖励分。"],
        skull_king: ["Skull King（💀）· 骷髅王", "胜过所有数字牌与海盗（⚔️），但同墩有美人鱼（🧜）时美人鱼获胜。骷髅王实际赢墩时，每吃一张海盗（包含海盗模式虎女）有 30 待兑现奖励分。"],
    };
    const help = `
        <h3>目标：准确叫墩</h3><p>2–8 人。每轮看自己的手牌，秘密预测能赢几墩；所有人 Confirm Bid 后同时公开。最后 Score（🏆，累计分）最高者获胜，并列共同获胜。</p>
        <h3>牌组与轮次</h3><p>70 张基础牌：绿鹦鹉 Parrot（🦜）、黄宝箱 Treasure（💰）、紫地图 Map（🗺️）与黑海盗旗 Trump（🏴‍☠️）各 1–14；逃跑 Escape（🏳️）5 张、海盗 Pirate（⚔️）5 张、美人鱼 Mermaid（🧜）2 张、虎女 Tigress（🐯）1 张、骷髅王 Skull King（💀）1 张。</p><p>Standard 共 10 轮，逐轮发 1–10 张；8 人局第 9、10 轮仍各发 8 张。Quick 是官方短局变体：5 轮，每轮 5 张。每轮重洗全部牌，未发的牌保持隐藏。第一轮随机首家，之后按座位轮转。</p>
        <h3>叫墩与出牌</h3><p>Bid（🎯，叫墩）从 0 到本轮发牌数，锁定后不能改。🔒 表示已锁定但未公开，… 表示未提交。Trick（墩）是每人各出一张牌，最强牌收走本墩，赢家领下一墩；玩家处的 Won / Bid 是已赢墩数 / 目标，🂠 是剩余手牌。</p><p>Lead（首引花色）：数字牌必须跟色；没有该色可出其他数字牌。<strong>特殊牌随时可出</strong>。黑海盗旗（🏴‍☠️）胜普通花色，同色数字大者胜；未跟首引花色的普通数字牌不能赢。逃跑首引将定色权顺延；角色牌首引则该墩不限制花色。角色牌在中途出现不会解除已建立的跟色要求。</p>
        <h3>特殊牌</h3><ul><li>逃跑（🏳️）：通常最弱；全员逃跑时先出者赢。</li><li>海盗（⚔️）：胜数字牌和美人鱼，输骷髅王。</li><li>骷髅王（💀）：胜数字牌和海盗，输美人鱼。</li><li>美人鱼（🧜）：胜数字牌，通常输海盗；同墩有骷髅王则美人鱼赢，即便还有海盗。相同角色均先出者胜。</li><li>虎女（🐯）：出牌时明确选海盗（⚔️）或逃跑（🏳️），本墩按所选身份处理。</li></ul>
        <h3>经典计分</h3><p>正叫且准确：每墩 20 分；不准：每差一墩扣 10 分。叫 0 成功：本轮实际发牌数 × 10 分；失败：扣同样分数。</p><p class="skull-king-rule-example">叫 3 赢 3 → +60；叫 2 赢 4 → −20。<br>发 8 张时叫 0：没赢墩 +80；赢了任何墩 −80。</p><p>Bonus（✨，奖励）只有叫墩准确才兑现。收走普通花色 14 每张 +10、黑 14 为 +20；海盗吃美人鱼每张 +20，骷髅王吃海盗每张 +30（含海盗模式虎女），美人鱼吃骷髅王 +40。只算实际赢家的捕获奖励，数字 14 的奖励可累加。界面区分 Base（叫墩分）、Bonus（兑现奖励）与 Total（累计分）。</p>
        <h3>2 人：灰胡子 Graybeard（👻）</h3><p>额外发一手暗牌给灰胡子。他自动翻顶牌、无需跟色，虎女固定逃跑。他不叫墩、不计总分。真人领墩时灰胡子第二个出；灰胡子获胜时下墩先出，其他两人按上一墩顺序轮转。每轮第一墩在真人之间交替领牌。灰胡子是规则中的幽灵席位，和房间练习机器人不同。</p>
        <h3>线上操作</h3><p>点选手牌再 Play Card，虎女点对应身份；点击空白或 Esc 取消选择。每墩结束后保留桌面，全员 Next Trick 才继续；最后一墩直接展示轮末计分，全员 Next Round 才发下一轮。断线真人不自动确认。游戏结束保留结果。</p><p>Explain 后点任意有虚线的目标查看说明，灰色按钮也支持。Esc 退出解释或关闭弹窗。静态图标、指标可悬停或聚焦查看，手机点按显示 3 秒提示。机器人依据可见信息估算叫墩和选牌，不读取对手手牌。</p>
        <h3>版本范围</h3><p>实现基础 70 张牌与经典计分，不含海怪、白鲸、战利品、海盗个人技能与 Rascal 计分。卡面使用原创 CSS、文字与 Emoji。</p><p><a href="https://www.grandpabecksgames.com/pages/skull-king" target="_blank" rel="noopener noreferrer">Official rules & FAQ · Grandpa Beck’s Games</a></p>`;

    function text(suffix, value) { byId(suffix).textContent = value; }
    function el(tag, className, value) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (value != null) node.textContent = value;
        return node;
    }
    function tip(node, key, custom) {
        node.dataset.skExplain = key; node.dataset.skTip = custom || explanations[key][1]; node.tabIndex = 0;
        return node;
    }
    function playerLabel(tag, className, pid) {
        const node = el(tag, className, name(pid));
        node.dataset.skTip = name(pid); node.tabIndex = 0;
        return node;
    }
    function name(pid) { return view?.ghost?.player_id === pid ? "Graybeard 👻" : view?.players.find(p => p.player_id === pid)?.name || pid || "—"; }
    function own() { return view?.players.find(p => p.player_id === view.you); }
    function can(kind) { return !!(!pending && socket.connected && view?.legal_actions.includes(kind)); }
    function cardInfo(card) { return card.kind === "number" ? suits[card.suit] : specials[card.kind]; }
    function cardLabel(card, mode) {
        const info = cardInfo(card);
        return `${info[0]} ${info[1]}${card.rank ? ` ${card.rank}` : ""}${mode ? ` · ${specials[mode][1]}` : ""}`;
    }
    function cardNode(card, interactive = false, mode = null) {
        const key = card.suit || card.kind, info = cardInfo(card);
        const node = el(interactive ? "button" : "div", `skull-king-card sk-${key}`);
        node.dataset.skExplain = key;
        if (interactive) {
            node.type = "button"; node.dataset.cardId = card.id;
            node.setAttribute("aria-label", cardLabel(card));
            node.setAttribute("aria-pressed", String(selectedCard === card.id));
            node.disabled = !can("play") || !view.legal_card_ids.includes(card.id);
            node.classList.toggle("is-selected", selectedCard === card.id);
            node.classList.toggle("is-illegal", view.phase === "playing" && view.current_turn === view.you && !view.legal_card_ids.includes(card.id));
            node.dataset.skTip = `${cardLabel(card)}：${explanations[key][1]}`;
        } else tip(node, key, `${cardLabel(card, mode)}：${explanations[key][1]}`);
        const top = el("span", "skull-king-card-top");
        top.append(el("span", "", card.rank || info[0]), el("span", "", card.rank === 14 ? "✨" : ""));
        node.append(top, el("span", "skull-king-card-icon", info[0]),
            el("strong", "skull-king-card-value", card.rank || ""), el("span", "skull-king-card-label", mode ? specials[mode][1] : info[1]));
        return node;
    }
    function renderPlayers() {
        const container = byId("Players"); container.replaceChildren();
        const rows = [...view.players, ...(view.ghost ? [{...view.ghost, ghost: true}] : [])];
        rows.forEach(player => {
            const node = el("article", "skull-king-player");
            node.classList.toggle("is-current", player.player_id === view.current_turn);
            node.classList.toggle("is-winner", view.winner_ids.includes(player.player_id));
            const heading = el("div", "skull-king-player-heading");
            heading.append(playerLabel("strong", "", player.player_id));
            const labels = [];
            if (player.player_id === view.you) labels.push("You");
            if (player.is_bot) labels.push("Bot");
            if (view.ready.includes(player.player_id)) labels.push("Ready ✓");
            if (view.winner_ids.includes(player.player_id)) labels.push("Winner");
            heading.append(el("small", "", labels.join(" · ")));
            const stats = el("div", "skull-king-player-stats");
            if (player.ghost) stats.append(tip(el("span", "", `${player.won} won`), "ghost"));
            else {
                const bid = player.bid ?? (player.bid_locked ? "🔒" : "…");
                stats.append(tip(el("span", "", `🎯 ${player.won} / ${bid}`), "target", `Won / Bid（🎯）：已赢 ${player.won} 墩，叫墩 ${bid}。`));
                stats.append(tip(el("span", "", `🏆 ${player.total_score}`), "score"));
                const bonus = view.round_summary?.players.find(p => p.player_id === player.player_id)?.bonus ?? player.bonus;
                if (bonus) stats.append(tip(el("span", "", `✨ +${bonus}`), "bonus"));
            }
            stats.append(tip(el("span", "", `🂠 ${player.hand_count}`), player.ghost ? "ghost" : "target", `Hand（🂠）：剩余 ${player.hand_count} 张暗牌。`));
            node.append(heading, stats); container.append(node);
        });
    }
    function renderTrick() {
        const container = byId("TrickCards"); container.replaceChildren();
        const order = view.trick_order.length ? view.trick_order : [...view.players.map(p => p.player_id), ...(view.ghost ? [view.ghost.player_id] : [])];
        container.style.setProperty("--sk-mobile-seats", Math.min(order.length, 4));
        order.forEach(pid => {
            const slot = el("div", "skull-king-trick-slot");
            slot.classList.toggle("is-winner", view.trick_result?.winner_id === pid);
            const play = view.trick.find(p => p.player_id === pid);
            if (play) slot.append(cardNode(play.card, false, play.mode));
            else {
                const back = el("div", "skull-king-card sk-back");
                back.append(el("span", "skull-king-card-icon", "⚓"), el("span", "skull-king-card-label", view.phase === "bidding" ? "Bid first" : pid === view.current_turn ? "Playing…" : "Waiting"));
                slot.append(tip(back, "trick"));
            }
            slot.append(playerLabel("span", "skull-king-trick-name", pid)); container.append(slot);
        });
        byId("TrickResult").classList.toggle("hidden", !view.trick_result);
        if (view.trick_result) {
            const result = view.trick_result;
            const scored = view.round_summary?.players.find(p => p.player_id === result.winner_id);
            const bonusState = scored ? (scored.exact ? "earned" : "lost") : "pending";
            const bonus = result.bonus && result.winner_id !== view.ghost?.player_id ? ` · ✨ ${result.bonus} ${bonusState}` : "";
            text("TrickResult", `${name(result.winner_id)} wins the trick${bonus}`);
            tip(byId("TrickResult"), "bonus");
        }
    }
    function renderBids() {
        const bidding = view.phase === "bidding";
        byId("BidBox").classList.toggle("hidden", !bidding);
        const container = byId("Bids"); container.replaceChildren();
        if (!bidding) return;
        const me = own();
        text("BidProgress", `${view.players.filter(p => p.bid_locked).length} / ${view.players.length} locked`);
        if (me?.bid != null) selectedBid = me.bid;
        for (let bid = 0; bid <= view.cards_dealt; bid++) {
            const button = el("button", "", bid); button.type = "button"; button.dataset.bid = bid;
            button.dataset.skExplain = "bid"; button.setAttribute("aria-label", `Bid ${bid}`);
            button.setAttribute("aria-pressed", String(selectedBid === bid)); button.disabled = !can("bid");
            container.append(button);
        }
        byId("ConfirmBid").disabled = !can("bid") || selectedBid == null;
        text("ConfirmBid", me?.bid_locked ? "Locked ✓" : "Confirm Bid");
        text("BidHint", !me ? "Waiting for the crew to bid." : me.bid_locked ? `Your bid: ${me.bid}. Waiting for the crew.` : "Choose how many tricks you will win.");
    }
    function renderHand() {
        const container = byId("Hand"); container.replaceChildren();
        view.hand.forEach(card => container.append(cardNode(card, true)));
        text("HandTitle", own() ? "Your hand" : "Spectating");
        const me = own();
        text("Target", me ? `🎯 ${me.won} / ${me.bid ?? "—"}` : "🎯 —");
        text("HandHint", !me ? "Hands stay private." : view.phase === "bidding" ? `${view.hand.length} cards · Study your hand, then bid.` :
            can("play") ? "Select a card, then confirm." : view.phase === "playing" ? `Waiting for ${name(view.current_turn)}.` : "Review the result before continuing.");
        renderSelection();
    }
    function renderSelection() {
        const card = view?.hand.find(c => c.id === selectedCard);
        byId("Selection").classList.toggle("hidden", !card);
        if (!card) return;
        text("SelectedLabel", cardLabel(card));
        const tigress = card.kind === "tigress";
        byId("Play").classList.toggle("hidden", tigress);
        byId("Pirate").classList.toggle("hidden", !tigress); byId("Escape").classList.toggle("hidden", !tigress);
        ["Play", "Pirate", "Escape"].forEach(s => { byId(s).disabled = !can("play"); });
    }
    function renderScores() {
        byId("RoundSummary").classList.toggle("hidden", !view.round_summary);
        const container = byId("ScoreRows"); container.replaceChildren();
        if (!view.round_summary) return;
        text("SummaryTitle", `Round ${view.round_number} · Scores`);
        view.round_summary.players.forEach(row => {
            const node = el("div", `skull-king-score-row ${row.exact ? "is-exact" : "is-miss"}`);
            node.append(el("strong", "", name(row.player_id)),
                tip(el("span", "", `🎯 ${row.won} / ${row.bid} · ${row.exact ? "Exact" : "Missed"}`), "target"),
                tip(el("span", "", `Base ${row.base} + Bonus ${row.bonus} = ${row.round_score}`), "score"),
                tip(el("span", "", `🏆 Total ${row.total_score}${row.bonus_available && !row.exact ? ` · ${row.bonus_available} bonus lost` : ""}`), "bonus"));
            container.append(node);
        });
    }
    function renderHistory() {
        const history = byId("History"), scroll = history.scrollTop;
        history.replaceChildren();
        [...view.trick_history].reverse().forEach(trick => {
            const node = el("li", "", `Trick ${trick.trick_number}: ${name(trick.winner_id)} won. `);
            node.append(el("span", "", trick.cards.map(p => `${name(p.player_id)}: ${cardLabel(p.card, p.mode)}`).join(" · ")));
            history.append(node);
        });
        if (!view.trick_history.length) history.append(el("li", "", "No completed tricks yet."));
        history.scrollTop = scroll;
        const scores = byId("ScoreHistory"), scoreScroll = scores.scrollTop; scores.replaceChildren();
        view.score_history.forEach(round => {
            const row = el("div", ""); row.append(el("strong", "", `Round ${round.round_number} · ${round.cards_dealt} cards`));
            round.players.forEach(p => row.append(el("div", "", `${name(p.player_id)}: ${p.round_score > 0 ? "+" : ""}${p.round_score} → ${p.total_score}`)));
            scores.append(row);
        });
        if (!view.score_history.length) scores.append(el("div", "", "No scored rounds yet."));
        scores.scrollTop = scoreScroll;
    }
    function render() {
        if (!view) return;
        text("Round", `Round ${view.round_number} / ${view.total_rounds}`);
        text("Trick", `Trick ${view.trick_number} / ${view.cards_dealt}`);
        text("Lead", view.led_suit ? `Lead ${suits[view.led_suit][0]} ${suits[view.led_suit][1]}` : "Lead · Open");
        let status = "Lock in your bid";
        if (view.phase === "playing") status = view.current_turn === view.you ? "Your turn · Choose a card" : `${name(view.current_turn)} is playing`;
        if (view.phase === "trick_review") status = "Trick complete · Review the table";
        if (view.phase === "round_review") status = "Round complete · Scores are in";
        if (view.game_over) status = `Winner${view.winner_ids.length > 1 ? "s" : ""}: ${view.winner_ids.map(name).join(" · ")}`;
        if (!socket.connected) status = "Disconnected · Reconnecting…";
        text("Status", status);
        const review = ["trick_review", "round_review", "game_over"].includes(view.phase);
        byId("Review").classList.toggle("hidden", !review);
        text("ReviewTitle", view.game_over ? "Voyage complete" : view.phase === "trick_review" ? "Trick complete" : "Round complete");
        text("Ready", view.game_over ? "Final scores are below." : `${view.ready.length} / ${view.players.length} ready`);
        byId("Next").classList.toggle("hidden", view.game_over);
        text("Next", view.ready.includes(view.you) ? "Ready ✓" : view.phase === "trick_review" ? "Next Trick" : "Next Round");
        byId("Next").disabled = !can(view.phase === "trick_review" ? "next_trick" : "next_round");
        renderPlayers(); renderTrick(); renderBids(); renderHand(); renderScores(); renderHistory();
    }
    function dispatch(kind, fields = {}) {
        if (explaining || !can(kind)) return;
        pending = true; clearTimeout(pendingTimer);
        const context = Object.fromEntries(["game_token", "round_number", "trick_number"].map(key => [key, view[key]]));
        pendingTimer = setTimeout(() => { pending = false; render(); }, 3000);
        render(); sendAction({type: kind, ...context, ...fields});
    }
    function deselect() {
        selectedCard = null;
        panel.querySelectorAll("[data-card-id]").forEach(node => { node.classList.remove("is-selected"); node.setAttribute("aria-pressed", "false"); });
        renderSelection();
    }
    byId("Bids").addEventListener("click", event => {
        const button = event.target.closest("[data-bid]");
        if (!button || !can("bid")) return;
        selectedBid = Number(button.dataset.bid); renderBids();
    });
    byId("ConfirmBid").addEventListener("click", () => { if (selectedBid != null) dispatch("bid", {bid: selectedBid}); });
    byId("Hand").addEventListener("click", event => {
        const button = event.target.closest("[data-card-id]");
        if (!button || !can("play") || !view.legal_card_ids.includes(button.dataset.cardId)) return;
        selectedCard = selectedCard === button.dataset.cardId ? null : button.dataset.cardId;
        renderHand();
    });
    function play(mode) { if (selectedCard) dispatch("play", {card_id: selectedCard, ...(mode ? {mode} : {})}); }
    byId("Play").addEventListener("click", () => play());
    byId("Pirate").addEventListener("click", () => play("pirate"));
    byId("Escape").addEventListener("click", () => play("escape"));
    byId("Cancel").addEventListener("click", deselect);
    byId("Next").addEventListener("click", () => dispatch(view?.phase === "trick_review" ? "next_trick" : "next_round"));

    function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
    function showTip(target, autoHide = false) {
        if (!target || explaining || dialog.open) return;
        clearTimeout(tipTimer); tooltip.textContent = target.dataset.skTip; tooltip.classList.remove("hidden");
        const rect = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
        tooltip.style.top = `${rect.bottom + box.height + 18 < innerHeight ? rect.bottom + 7 : Math.max(12, rect.top - box.height - 7)}px`;
        if (autoHide) tipTimer = setTimeout(hideTip, 3000);
    }
    function setExplain(value) {
        explaining = value; panel.classList.toggle("skull-king-explaining", value);
        byId("ExplainBtn").setAttribute("aria-pressed", String(value)); hideTip();
    }
    function showDialog(title, body, html = false) {
        hideTip(); focusBeforeDialog = document.activeElement; text("DialogTitle", title);
        if (html) byId("DialogBody").innerHTML = body;
        else byId("DialogBody").replaceChildren(el("p", "", body));
        if (!dialog.open) dialog.showModal(); byId("DialogClose").focus();
    }
    function explain(target) {
        const entry = explanations[target?.dataset.skExplain];
        if (!entry) return;
        setExplain(false); showDialog(entry[0], entry[1]);
    }
    byId("HelpBtn").addEventListener("click", () => { setExplain(false); showDialog("Skull King · 骷髅王", help, true); });
    byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
    byId("DialogClose").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus(); });
    dialog.addEventListener("click", event => {
        const rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    const exempt = target => target.closest("#skullKingHelpBtn, #skullKingExplainBtn, #skullKingDialog");
    document.addEventListener("pointerdown", event => {
        suppressClick = false;
        if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const direct = event.target.closest("[data-sk-explain]");
        const target = direct || [...panel.querySelectorAll("[data-sk-explain]")].find(node => {
            const r = node.getBoundingClientRect();
            return r.width && r.height && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
        });
        suppressClick = true; clearTimeout(suppressTimer);
        suppressTimer = setTimeout(() => { suppressClick = false; }, 750);
        explain(target);
    }, true);
    document.addEventListener("click", event => {
        if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
        if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
        event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-sk-explain]"));
    }, true);
    document.addEventListener("keydown", event => {
        if (panel.classList.contains("hidden")) return;
        if (event.key === "Escape") { setExplain(false); hideTip(); deselect(); }
        if (!explaining || exempt(event.target) || !["Enter", " "].includes(event.key)) return;
        event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-sk-explain]"));
    }, true);
    document.addEventListener("click", event => {
        if (!panel.classList.contains("hidden") && !dialog.open && !event.target.closest("button, input, select, dialog, summary, a")) deselect();
    });
    panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-sk-tip]")); });
    panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
    panel.addEventListener("focusin", event => showTip(event.target.closest("[data-sk-tip]")));
    panel.addEventListener("focusout", hideTip);
    panel.addEventListener("pointerdown", event => {
        const target = event.target.closest("button:disabled[data-sk-tip]");
        if (target && event.pointerType !== "mouse") showTip(target, true);
    });
    panel.addEventListener("click", event => {
        const target = event.target.closest("[data-sk-tip]");
        if (target) showTip(target, true); else hideTip();
    });
    document.addEventListener("scroll", hideTip, true); window.addEventListener("resize", hideTip); window.addEventListener("blur", hideTip);

    function clearState() {
        view = null; selectedCard = null; selectedBid = null; pending = false; renderSignature = null;
        suppressClick = false; clearTimeout(pendingTimer); clearTimeout(suppressTimer);
        setExplain(false); hideTip(); if (dialog.open) dialog.close();
        ["Hand", "Players", "TrickCards", "Bids", "ScoreRows", "History", "ScoreHistory"].forEach(s => byId(s).replaceChildren());
        ["BidBox", "Review", "RoundSummary", "TrickResult", "Selection"].forEach(s => byId(s).classList.add("hidden"));
        ["ConfirmBid", "Next", "Play", "Pirate", "Escape"].forEach(s => { byId(s).disabled = true; });
        text("Status", "Waiting to start"); text("Round", "Round —"); text("Trick", "Trick —");
        text("Lead", "Lead —"); text("Target", "🎯 —"); text("HandHint", "Your cards will appear here.");
    }
    function syncConfig(state) {
        const visible = state?.game_type === "skull_king" && state.status === "lobby";
        configBox.classList.toggle("hidden", !visible); configBox.setAttribute("aria-hidden", String(!visible));
        if (state?.game_type !== "skull_king") return;
        const signature = JSON.stringify([state.room_id, state.game_config]);
        if (signature !== configSignature) { byId("Schedule").value = state.game_config?.schedule || "standard"; configSignature = signature; }
        if (visible && view) clearState();
    }
    window.getSkullKingConfig = () => view && currentRoomState?.status !== "lobby" ? {...view.config} : {schedule: byId("Schedule").value};
    window.renderSkullKingGameState = data => {
        if (data?.view?.game_id !== "skull_king" || currentGameType !== "skull_king") return;
        if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
        const incoming = data.view;
        const signature = JSON.stringify([data.room_id, incoming.game_token, incoming.revision, incoming.you]);
        if (signature === renderSignature) return;
        if (!view || view.game_token !== incoming.game_token || view.round_number !== incoming.round_number) selectedBid = null;
        if (!view || view.game_token !== incoming.game_token || view.trick_number !== incoming.trick_number || view.round_number !== incoming.round_number || !incoming.legal_card_ids.includes(selectedCard)) selectedCard = null;
        pending = false; clearTimeout(pendingTimer); hideTip(); renderSignature = signature; view = incoming; render();
    };
    window.clearSkullKingState = clearState;
    window.showSkullKingHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) { clearState(); configBox.classList.add("hidden"); configBox.setAttribute("aria-hidden", "true"); }
        else if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
    };
    function sync() {
        socket.on("room:state", syncConfig);
        socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); render(); });
        socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); hideTip(); render(); });
        socket.on("connect", render);
        if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
        if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "skull_king") window.renderSkullKingGameState(lastGameStatePayload);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
    else sync();
})();
