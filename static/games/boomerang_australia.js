(() => {
    "use strict";

    const panel = document.getElementById("boomerangAustraliaPanel");
    const header = document.getElementById("boomerangAustraliaHeaderActions");
    const helpButton = document.getElementById("boomerangAustraliaHelpBtn");
    const explainButton = document.getElementById("boomerangAustraliaExplainBtn");
    if (!panel || !header || !helpButton || !explainButton) return;

    const collections = {
        leaf: {name: "叶子", icon: "🍃", points: 1},
        flower: {name: "野花", icon: "🌼", points: 2},
        shell: {name: "贝壳", icon: "🐚", points: 3},
        souvenir: {name: "纪念品", icon: "🎁", points: 5},
    };
    const animals = {
        kangaroo: {name: "袋鼠", icon: "🦘", points: 3},
        emu: {name: "鸸鹋", icon: "🐦", points: 4},
        wombat: {name: "袋熊", icon: "🐾", points: 5},
        koala: {name: "考拉", icon: "🐨", points: 7},
        platypus: {name: "鸭嘴兽", icon: "🦆", points: 9},
    };
    const activities = {
        swimming: {name: "游泳", icon: "🏊"},
        bushwalking: {name: "徒步", icon: "🥾"},
        culture: {name: "原住民文化", icon: "🪃"},
        sightseeing: {name: "观光", icon: "📷"},
    };
    const regionColors = {wa: "#a4603e", nt: "#947642", qld: "#b37052", sa: "#ae8546", nsw: "#547e76", vic: "#567796", tas: "#727752"};
    const explanations = {
        card: "景点牌显示地点字母、地区、投掷数字及三类图标。收藏品：叶子(🍃)、野花(🌼)、贝壳(🐚)、纪念品(🎁)；动物：袋鼠(🦘)、鸸鹋(🐦)、袋熊(🐾)、考拉(🐨)、鸭嘴兽(🦆)；活动：游泳(🏊)、徒步(🥾)、原住民文化(🪃)、观光(📷)。先点选，再按 Confirm；第一张是仅自己可见的投掷牌，轮末揭示。",
        confirm: "Confirm 锁定本批次选择。全部玩家提交后才同时揭示和传牌。未选牌、已提交、发送中或等待其他人时无法确认。不能撤回已被服务器接受的选择。",
        activity: "游泳(🏊)、徒步(🥾)、原住民文化(🪃)、观光(📷)：每轮选一种尚未记录的活动。本轮 0／1／2／3／4／5／6 个图标分别得 0／0／2／4／7／10／15 分。每种整局只能记录一次，零分也占用。",
        skip: "Skip 放弃本轮活动计分，保留所有尚未使用的活动供以后选择。其他计分仍照常结算。",
        next: "Next Round 确认已看过本轮结果。每个席位分别确认后才继续；机器人只确认自己，断线真人不会自动跳过。第四轮确认后展示最终排名。",
        region: "景点(📍)整局每个不同地点计 1 分。每地区有四个地点；最早完成的那一轮，所有同时完成该地区的玩家各得 3 分，之后不再颁发。",
        score: "总分(🏆) = 每轮投掷接回(🪃)、收藏品(🎁)、动物(🐾)、活动(📷)，再加不同景点(📍)及地区奖励(🗺️)。同分比较四轮投掷接回总分，仍相同则并列。",
        throw: "投掷与接回(🪃)：本轮第一张 Throw 与最后一张 Catch 的数字之差取绝对值。第一张秘密保留，最后一张由传牌自动收到，七张都参与其他计分。",
        collection: "收藏品：叶子(🍃) 1、野花(🌼) 2、贝壳(🐚) 3、纪念品(🎁) 5。本轮原值总和 1–7 时翻倍；8 以上按原值；没有则为 0 分。",
        animal: "动物每两只同类计一对：袋鼠(🦘) 3、鸸鹋(🐦) 4、袋熊(🐾) 5、考拉(🐨) 7、鸭嘴兽(🦆) 9。落单不计，四只计两对。",
        direction: "每批次所有玩家选一张后把余牌向箭头所示方向传递。默认向左；开启方向变体时，第 2、4 轮向右。两人局方向不影响交换对象。",
        history: "计分纸保留四轮的分项结果。景点一列只计本轮新地点，地区一列只计本轮新奖励，累计总分不会重复加入已访问地点。",
    };
    let view = null, selection = null, activitySelection = null, signature = null;
    let pending = false, pendingAction = null, pendingTimer = null, explaining = false, suppressed = null;
    let lastPointerType = "mouse", tipTimer = null, returnFocus = null, configSignature = null;

    const dialog = document.createElement("dialog");
    dialog.id = "boomerangAustraliaDialog";
    dialog.className = "boomerang-dialog";
    dialog.setAttribute("aria-labelledby", "boomerangAustraliaDialogTitle");
    dialog.innerHTML = '<div class="boomerang-dialog-heading"><h2 id="boomerangAustraliaDialogTitle">Help</h2><button type="button" class="boomerang-dialog-close">Close</button></div><div class="boomerang-dialog-body"></div>';
    document.body.append(dialog);
    const dialogTitle = dialog.querySelector("h2");
    const dialogBody = dialog.querySelector(".boomerang-dialog-body");
    const dialogClose = dialog.querySelector("button");
    const tip = document.createElement("div");
    tip.className = "boomerang-tip";
    tip.hidden = true;
    tip.setAttribute("role", "status");
    document.body.append(tip);

    const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
    const own = () => view?.players.find(player => player.player_id === view.you);
    const legal = action => !pending && !!view?.legal_actions?.includes(action);
    const region = id => view?.regions?.[id] || {name: id || "", name_zh: id || "", cards: []};
    const cardName = card => card.name_zh || card.name || card.id;
    const cardById = id => view?.catalog?.[id];
    const name = id => view?.players.find(player => player.player_id === id)?.name || "—";
    const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const button = (label, action, explanation, disabled = false, className = "") => `<button type="button" class="${className}" data-boomerang-action="${action}" data-boomerang-explain="${explanation}" ${disabled ? "disabled" : ""}>${label}</button>`;
    const info = (text, label = "Info") => `<button type="button" class="boomerang-info" aria-label="${esc(label)}" data-boomerang-tip="${esc(text)}">ⓘ</button>`;
    const badge = (text, explanation, className = "") => `<span class="boomerang-symbol ${className}" tabindex="0" role="button" data-boomerang-tip="${esc(explanation)}" aria-label="${esc(explanation)}">${text}</span>`;

    function hideTip() {
        tip.hidden = true;
        window.clearTimeout(tipTimer);
    }

    function showTip(text, anchor, touch = false) {
        if (!text || explaining) return;
        window.clearTimeout(tipTimer);
        tip.textContent = text;
        tip.hidden = false;
        const rect = anchor.getBoundingClientRect();
        const bounds = tip.getBoundingClientRect();
        const x = touch ? (window.innerWidth - bounds.width) / 2 : rect.left;
        const y = rect.top > bounds.height + 16 ? rect.top - bounds.height - 8 : rect.bottom + 8;
        tip.style.left = `${Math.max(12, Math.min(window.innerWidth - bounds.width - 12, x))}px`;
        tip.style.top = `${Math.max(12, Math.min(window.innerHeight - bounds.height - 12, y))}px`;
        if (touch) tipTimer = window.setTimeout(hideTip, 3000);
    }

    function setExplain(enabled) {
        explaining = enabled;
        panel.classList.toggle("is-explaining", enabled);
        explainButton.setAttribute("aria-pressed", String(enabled));
        hideTip();
    }

    function openDialog(title, html) {
        hideTip();
        returnFocus = document.activeElement;
        dialogTitle.textContent = title;
        dialogBody.innerHTML = html;
        if (!dialog.open) dialog.showModal();
        dialogClose.focus();
    }

    function showHelp() {
        setExplain(false);
        openDialog("Help · 世界巡游（澳洲）", `
            <p>2–4 人，用四轮传牌规划澳洲旅行。收集景点(📍)、收藏品(🎁)、动物(🐾)与活动(📷)，争取最高总分(🏆)。</p>
            <h3>选牌与传牌</h3><ol><li>每轮每人七张，秘密选择第一张 Throw 投掷牌(🪃)。自己始终可见，别人到选牌结束才看到。</li><li>余牌向指定方向传递，每次点选一张并 Confirm。所有人锁定后一起揭示和传牌，未提交的选择只给本人看。</li><li>共六次选牌；最后剩下的一张自动传给下家，成为 Catch 接回牌(🪃)。七张都计分。</li><li>选择一种尚未计分的活动，或 Skip。全员选择后保留本轮计分；每人点击 Next Round 才继续，第四轮确认后展示胜者。</li></ol>
            <h3>计分</h3><ul><li>${explanations.throw}</li><li>${explanations.region}</li><li>${explanations.collection}</li><li>${explanations.animal}</li><li>游泳(🏊)、徒步(🥾)、原住民文化(🪃)、观光(📷)：每轮可选一种未使用的活动；每种整局只用一次，零分也会占用。也可 Skip 保留机会。</li></ul>
            <div class="boomerang-help-table"><div><strong>本轮图标</strong><span>0 / 1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span></div><div><strong>活动分数</strong><span>0</span><span>2</span><span>4</span><span>7</span><span>10</span><span>15</span></div></div>
            <h3>累计旅行与胜负</h3><p>同一个景点只计一次。每个地区四个景点，最早完成的同一轮可有多位玩家各得 3 分；以后完成没有奖励。${explanations.score}</p>
            <h3>发牌与方向变体</h3><p>四人局每轮重洗全部 28 张。二／三人局上轮未发的牌保留在顶部，使用过的牌洗好放在下方，优先发出此前未发的牌。默认全程向左；开启方向变体时，第 2、4 轮向右。两人局方向不改变交换对象。</p>
            <h3>线上操作</h3><p>点选后 Confirm；空白或 Esc 取消尚未提交的选择。已经锁定的选择不可撤回。回顾必须等待所有席位各自确认，机器人仅确认自己，断线玩家不会自动跳过。手牌、未揭示 Throw 和尚未公开的选择只有本人可见。</p>
            <p>桌面悬停或键盘聚焦查看图标说明；手机轻点图标显示三秒提示。Explain 可解释禁用控件，不会执行游戏操作。图标为辅助识别，名称与图标共同说明含义；地区面板是旅行记录，并非可拖拽地图。</p>`);
    }

    function symbolHTML(kind, id) {
        const item = ({collection: collections, animal: animals, activity: activities}[kind] || {})[id];
        if (!item) return "";
        const text = kind === "collection" ? `${item.name}(${item.icon})：收藏原值 ${item.points}。本轮合计 1–7 翻倍，8 以上不翻倍。` : kind === "animal" ? `${item.name}(${item.icon})：每两只 ${item.points} 分，落单不计。` : `${item.name}(${item.icon})：本轮可选一种未使用活动计分，每种整局最多一次。`;
        return badge(`${item.icon}${kind === "activity" ? "" : `<small>${item.points}</small>`}`, text, `is-${kind}`);
    }

    function cardHTML(card, selectable = false, index = null, compact = false) {
        if (!card) return '<div class="boomerang-card is-hidden-card"><span class="boomerang-hidden-icon">🪃</span><strong>Throw</strong><small>Hidden</small></div>';
        const selected = selectable && (selection === card.id || view.pending_card === card.id);
        const cardRegion = region(card.region);
        const label = index === 0 ? "Throw" : index === 6 ? "Catch" : null;
        const accessible = `${card.id} · ${cardName(card)} · ${cardRegion.name_zh} · ${card.number}`;
        return `<article class="boomerang-card ${selected ? "is-selected" : ""} ${selectable ? "is-selectable" : ""} ${compact ? "is-compact" : ""}" style="--boomerang-region:${regionColors[card.region] || "#62857c"}" ${selectable ? `role="button" tabindex="0" data-boomerang-card="${esc(card.id)}" aria-pressed="${selected}" aria-disabled="${!legal("draft_card")}"` : ""} data-boomerang-explain="card" aria-label="${esc(accessible)}">
            <div class="boomerang-card-top"><span class="boomerang-place-code" tabindex="0" role="button" data-boomerang-tip="${esc(`${card.id}：${cardName(card)}${card.name && card.name !== cardName(card) ? ` (${card.name})` : ""}，所属${cardRegion.name_zh}。访问过的景点不再重复计分。`)}">${esc(card.id)}</span>${badge(esc(card.number), explanations.throw, "boomerang-number")}</div>
            <div class="boomerang-card-place"><strong>${esc(cardName(card))}</strong><small lang="en">${esc(card.name || "")}</small></div>
            <div class="boomerang-card-region">${esc(cardRegion.name_zh || cardRegion.name)}</div>
            <div class="boomerang-card-icons">${symbolHTML("collection", card.collection)}${symbolHTML("animal", card.animal)}${symbolHTML("activity", card.activity)}</div>
            ${label ? `<span class="boomerang-card-role">${label === "Throw" ? "🪃" : "↩"} ${label}</span>` : ""}
            ${selected ? '<span class="boomerang-card-selected">✓</span>' : ""}
        </article>`;
    }

    function stepText() {
        if (view.game_over) return "Four rounds complete. Your travel journal is ready.";
        if (view.phase === "round_end") return "Review the scores, then confirm when you are ready.";
        if (pending) return "Sending your choice…";
        if (own()?.submitted) return "Your choice is locked. Waiting for the other players.";
        if (view.phase === "choose_activity") return "Choose one unused activity to score, or skip this round.";
        return view.pick === 1 ? "Choose your secret Throw card." : "Choose one destination from the cards passed to you.";
    }

    function playerHTML(player) {
        const ready = view.next_ready?.includes(player.player_id);
        const status = view.phase === "round_end" ? (ready ? "Ready ✓" : "Reviewing") : view.game_over ? "Final score" : player.submitted ? "Locked ✓" : "Choosing";
        return `<div class="boomerang-player ${player.player_id === view.you ? "is-you" : ""}"><div><strong>${esc(player.name)}</strong><small>${player.player_id === view.you ? "You" : player.is_bot ? "Bot" : "Player"} · ${status}</small></div><span class="boomerang-player-total" data-boomerang-tip="${esc(explanations.score)}" tabindex="0">${number(player.total)}<small>pts</small></span></div>`;
    }

    function actionHTML() {
        const mine = own();
        if (!mine) return '<p class="boomerang-muted">Spectating</p>';
        if (view.phase === "round_end") {
            const waiting = view.players.filter(player => !view.next_ready.includes(player.player_id));
            return `<div class="boomerang-round-actions">${button(view.next_ready.includes(view.you) ? "Ready ✓" : "Next Round", "next", "next", !legal("next_round"), "boomerang-primary")}<span>Waiting: ${esc(waiting.map(player => player.name).join(", ")) || "—"}</span></div>`;
        }
        if (view.game_over) return "";
        if (view.phase === "choose_activity") {
            return `<div class="boomerang-activity-grid">${(view.activity_options || []).map(option => {
                const item = activities[option.id] || {name: option.id, icon: "📷"};
                return `<button type="button" class="boomerang-activity ${activitySelection === option.id || view.pending_activity === option.id ? "is-selected" : ""}" data-boomerang-activity="${esc(option.id)}" data-boomerang-explain="activity" aria-pressed="${activitySelection === option.id}" ${option.used || !legal("choose_activity") ? "disabled" : ""}><strong>${item.icon} ${item.name}</strong><span>${option.used ? "Used" : `${number(option.count)} × → ${number(option.points)} pts`}</span></button>`;
            }).join("")}</div><div class="boomerang-action-row">${button(mine.submitted ? "Locked ✓" : "Confirm", "confirm_activity", "activity", !legal("choose_activity") || !activitySelection, "boomerang-primary")}${button("Skip", "skip", "skip", !legal("choose_activity"))}${info(explanations.activity)}</div>`;
        }
        const chosen = cardById(selection || view.pending_card);
        return `<div class="boomerang-draft-action"><div><small>${mine.submitted ? "Locked choice" : "Selected destination"}</small><strong>${chosen ? `${esc(chosen.id)} · ${esc(cardName(chosen))}` : "Select a card"}</strong></div>${button(mine.submitted ? "Locked ✓" : "Confirm", "confirm", "confirm", !legal("draft_card") || !selection, "boomerang-primary")}${info(explanations.confirm)}</div>`;
    }

    function scoreLine(label, value, explanation) {
        return `<div class="boomerang-score-line"><span tabindex="0" data-boomerang-tip="${esc(explanation)}">${label}</span><strong>${esc(value)}</strong></div>`;
    }

    function previewHTML() {
        const mine = own();
        if (!mine) return "";
        const preview = mine.preview || view.preview;
        const lastScore = mine.scores?.find(score => score.round === view.round);
        const score = lastScore || preview;
        return `<section class="boomerang-box boomerang-score-box"><div class="boomerang-section-title"><h3>${lastScore ? "Round score" : "Score preview"}</h3>${info(explanations.score)}</div>
            ${score ? `${scoreLine("🪃 Throw & Catch", score.throw_catch === null || score.throw_catch === undefined ? "—" : score.throw_catch, explanations.throw)}${scoreLine("🎁 收藏品", number(score.collections), explanations.collection)}${scoreLine("🐾 动物", number(score.animals), explanations.animal)}${scoreLine("📷 活动", lastScore ? number(score.activity_score) : "Choose at round end", explanations.activity)}${scoreLine("📍 新景点", Array.isArray(score.new_sites) ? score.new_sites.length : number(score.new_sites), explanations.region)}${scoreLine("🗺️ 地区奖励", Array.isArray(score.new_regions) ? score.new_regions.length * 3 : number(score.new_regions) * 3, explanations.region)}${lastScore ? `<div class="boomerang-score-total"><span>Round total</span><strong>+${number(score.round_points)}</strong></div>` : '<p class="boomerang-muted">Provisional · all seven cards count.</p>'}` : '<p class="boomerang-muted">Your scoring preview appears after all seven cards are drafted.</p>'}
            <div class="boomerang-used-activities">${Object.entries(activities).map(([id, item]) => `<span class="${Object.prototype.hasOwnProperty.call(mine.activities || {}, id) ? "is-used" : ""}" tabindex="0" data-boomerang-tip="${esc(`${item.name}(${item.icon})：${Object.prototype.hasOwnProperty.call(mine.activities || {}, id) ? `已使用，记录 ${mine.activities[id]} 分。` : "尚未使用，可在以后的轮末选择。"}`)}">${item.icon}<small>${Object.prototype.hasOwnProperty.call(mine.activities || {}, id) ? mine.activities[id] : "—"}</small></span>`).join("")}</div>
        </section>`;
    }

    function regionsHTML() {
        const mine = own();
        if (!mine) return "";
        const visited = new Set(mine.visited || []);
        return `<section class="boomerang-box boomerang-destinations"><div class="boomerang-section-title"><h3>📍 Travel journal</h3><span class="boomerang-counter">${visited.size} / 28</span>${info(explanations.region)}</div><div class="boomerang-region-list">${Object.entries(view.regions || {}).map(([id, data]) => {
            const completed = (mine.region_bonuses || []).includes(id);
            const claimed = view.players.some(player => (player.region_bonuses || []).includes(id));
            const allVisited = data.cards.every(cardId => visited.has(cardId));
            const regionTip = `${data.name_zh}(${data.name})：四个地点；${completed ? "你已获得地区奖励 3 分。" : claimed ? "地区奖励已颁发。" : allVisited ? "已收齐，等待本轮统一结算地区奖励。" : "首次完成的同一轮，所有完成者各得 3 分。"}`;
            return `<div class="boomerang-region" style="--boomerang-region:${regionColors[id] || "#62857c"}"><div class="boomerang-region-heading"><span tabindex="0" data-boomerang-tip="${esc(regionTip)}">${esc(data.name_zh)}${completed ? " · +3 ★" : claimed ? " · Awarded" : ""}</span><small>${data.cards.filter(cardId => visited.has(cardId)).length}/4</small></div><div class="boomerang-stamps">${data.cards.map(cardId => {
                const card = cardById(cardId);
                return `<button type="button" class="boomerang-stamp ${visited.has(cardId) ? "is-visited" : ""}" data-boomerang-tip="${esc(`${cardId} · ${card ? cardName(card) : cardId}：${visited.has(cardId) ? "已访问，整局只计一次 1 分。" : "尚未访问。"}`)}" aria-label="${esc(`${cardId} ${card ? cardName(card) : cardId}`)}"><span>${esc(cardId)}</span>${visited.has(cardId) ? '<small>✓</small>' : ""}</button>`;
            }).join("")}</div></div>`;
        }).join("")}</div></section>`;
    }

    function roundSummaryHTML() {
        if (view.phase !== "round_end" && !view.game_over) return "";
        return `<section class="boomerang-box boomerang-round-review"><div class="boomerang-section-title"><h3>Round ${view.round} · Results</h3>${info(explanations.history)}</div><div class="boomerang-round-results">${(view.round_summary || []).map(score => `<div class="boomerang-round-result"><strong>${esc(name(score.player_id))}</strong><span class="boomerang-result-points">+${number(score.round_points)}</span><p>${scoreSymbols(score)}</p><small>${score.activity ? `${activities[score.activity]?.icon || "📷"} ${activities[score.activity]?.name || score.activity}` : "Activity skipped"}${(score.new_regions || []).length ? ` · ${score.new_regions.map(id => `${region(id).name_zh} +3`).join(", ")}` : ""}</small></div>`).join("")}</div></section>`;
    }

    function scoreSymbols(score) {
        return [["🪃", score.throw_catch, "throw"], ["🎁", score.collections, "collection"], ["🐾", score.animals, "animal"], ["📷", score.activity_score, "activity"], ["📍", (score.new_sites || []).length, "region"], ["🗺️", (score.new_regions || []).length * 3, "region"]].map(([icon, points, key]) => `<span tabindex="0" data-boomerang-tip="${esc(explanations[key])}">${icon} ${number(points)}</span>`).join("");
    }

    function scoreHistory(scores) {
        return `<div class="boomerang-score-history">${scores.map(score => `<div class="boomerang-history-round"><strong>Round ${score.round}<span>+${number(score.round_points)}</span></strong><div>${scoreSymbols(score)}</div></div>`).join("")}</div>`;
    }

    function historyHTML() {
        const mine = own();
        if (view.game_over) {
            const ranked = view.players.slice().sort((left, right) => right.total - left.total || right.scores.reduce((sum, score) => sum + score.throw_catch, 0) - left.scores.reduce((sum, score) => sum + score.throw_catch, 0));
            return `<section class="boomerang-box"><div class="boomerang-section-title"><h3>Final score sheets</h3>${info(explanations.score)}</div><div class="boomerang-final-sheets">${ranked.map(player => `<details class="boomerang-final-sheet" data-boomerang-player="${esc(player.player_id)}" ${player.player_id === view.you ? "open" : ""}><summary><span>${view.winner.includes(player.player_id) ? "🏆 " : ""}${esc(player.name)}</span><strong>${player.total} pts</strong></summary><p class="boomerang-muted" tabindex="0" data-boomerang-tip="${esc(explanations.throw)}">Throw & Catch tiebreak: ${player.scores.reduce((sum, score) => sum + score.throw_catch, 0)}</p>${scoreHistory(player.scores)}</details>`).join("")}</div></section>`;
        }
        if (!mine?.scores?.length) return "";
        return `<details class="boomerang-box boomerang-history"><summary>Score sheet · ${mine.scores.length} / 4 rounds</summary>${scoreHistory(mine.scores)}</details>`;
    }

    function render() {
        if (!view) return;
        const detailsKey = element => `${element.className}:${element.dataset.boomerangPlayer || ""}`;
        const openDetails = new Map([...panel.querySelectorAll("details")].map(element => [detailsKey(element), element.open]));
        const mine = own();
        const hasHand = view.phase === "draft" && view.hand?.length;
        panel.innerHTML = `<div class="boomerang-shell">
            <div class="boomerang-top"><div><div class="boomerang-eyebrow">THE AUSTRALIAN TRAVEL JOURNAL</div><h2>世界巡游<span>澳洲</span></h2><p lang="en">Boomerang: Australia</p></div><div class="boomerang-round-badge"><strong>${view.game_over ? "🏆" : `0${view.round}`}</strong><span>${view.game_over ? "Final results" : "ROUND / 04"}</span></div></div>
            <div class="boomerang-players" style="--boomerang-player-count:${view.players.length}">${view.players.map(playerHTML).join("")}</div>
            ${view.game_over ? `<div class="boomerang-winner"><span>🏆</span><div><small>${view.winner.length > 1 ? "Joint winners" : "Winner"}</small><strong>${esc(view.winner.map(name).join(" · "))}</strong></div></div>` : ""}
            <div class="boomerang-layout"><main class="boomerang-main"><section class="boomerang-box boomerang-play-area"><div class="boomerang-section-title"><h3>${view.phase === "draft" ? "Choose a destination" : view.phase === "choose_activity" ? "Choose an activity" : view.game_over ? "The final journey" : "Round review"}</h3><span class="boomerang-direction" tabindex="0" data-boomerang-tip="${esc(explanations.direction)}">${view.direction === "right" ? "Pass right →" : "← Pass left"}</span></div><p class="boomerang-step" aria-live="polite">${stepText()}</p>
            ${hasHand ? `<div class="boomerang-pick-progress"><span>Pick ${view.pick} / 6</span><div>${Array.from({length: 6}, (_, index) => `<i class="${index < view.pick ? "is-done" : ""}"></i>`).join("")}</div></div><div class="boomerang-hand">${view.hand.map(card => cardHTML(card, true)).join("")}</div>` : ""}
            ${actionHTML()}</section>
            ${roundSummaryHTML()}
            ${mine?.cards?.length ? `<section class="boomerang-box boomerang-my-cards"><div class="boomerang-section-title"><h3>Your journey</h3><span class="boomerang-counter">${mine.cards.length} / 7 cards</span>${info(explanations.throw)}</div><div class="boomerang-tableau">${mine.cards.map((card, index) => cardHTML(card, false, index, true)).join("")}</div></section>` : ""}
            <details class="boomerang-box boomerang-public-cards"><summary>Other journeys · ${Math.max(0, view.players.length - 1)} players</summary><div class="boomerang-opponents">${view.players.filter(player => player.player_id !== view.you).map(player => `<div class="boomerang-opponent"><div class="boomerang-section-title"><strong>${esc(player.name)}</strong><span>${player.cards.length} / 7</span></div><div class="boomerang-tableau">${player.cards.map((card, index) => cardHTML(card, false, index, true)).join("") || '<p class="boomerang-muted">No cards drafted yet.</p>'}</div></div>`).join("")}</div></details>
            ${historyHTML()}
            <details class="boomerang-box boomerang-log"><summary>Public log</summary><ul>${(view.log || []).slice().reverse().map(line => `<li>${esc(line)}</li>`).join("")}</ul></details>
            </main><aside class="boomerang-sidebar">${previewHTML()}${regionsHTML()}</aside></div>
        </div>`;
        panel.querySelectorAll("details").forEach(element => {
            if (openDetails.has(detailsKey(element))) element.open = openDetails.get(detailsKey(element));
        });
        panel.classList.toggle("is-explaining", explaining);
    }

    function submit(action) {
        if (pending || !view?.legal_actions?.includes(action.type)) return;
        pending = true;
        pendingAction = action.type;
        hideTip();
        render();
        window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => { pending = false; pendingAction = null; render(); }, 10000);
        sendAction(action);
    }

    function cancelSelection() {
        if (!selection && !activitySelection) return;
        selection = null;
        activitySelection = null;
        render();
    }

    panel.addEventListener("pointerdown", event => { lastPointerType = event.pointerType || "mouse"; });
    panel.addEventListener("click", event => {
        if (!view || explaining) return;
        const tooltip = event.target.closest("[data-boomerang-tip]");
        if (tooltip) {
            event.preventDefault();
            event.stopPropagation();
            showTip(tooltip.dataset.boomerangTip, tooltip, lastPointerType === "touch");
            return;
        }
        const card = event.target.closest("[data-boomerang-card]");
        if (card) {
            if (legal("draft_card")) { selection = selection === card.dataset.boomerangCard ? null : card.dataset.boomerangCard; hideTip(); render(); }
            return;
        }
        const activity = event.target.closest("[data-boomerang-activity]");
        if (activity) {
            if (legal("choose_activity") && !activity.disabled) { activitySelection = activitySelection === activity.dataset.boomerangActivity ? null : activity.dataset.boomerangActivity; render(); }
            return;
        }
        const control = event.target.closest("[data-boomerang-action]");
        if (control) {
            if (control.disabled) return;
            const action = control.dataset.boomerangAction;
            if (action === "confirm" && selection) submit({type: "draft_card", card_id: selection, round: view.round, pick: view.pick});
            if (action === "confirm_activity" && activitySelection) submit({type: "choose_activity", activity: activitySelection, round: view.round});
            if (action === "skip") submit({type: "choose_activity", activity: null, round: view.round});
            if (action === "next") submit({type: "next_round", round: view.round});
            return;
        }
        if (!event.target.closest("button,input,label,select,summary,.boomerang-card,.boomerang-score-history,.boomerang-region,.boomerang-round-result")) cancelSelection();
    });
    panel.addEventListener("keydown", event => {
        if (!["Enter", " "].includes(event.key)) return;
        const target = event.target.closest("[data-boomerang-tip],[data-boomerang-card]");
        if (target && target.tagName !== "BUTTON") { event.preventDefault(); lastPointerType = "keyboard"; target.click(); }
    });
    panel.addEventListener("pointerover", event => {
        const target = event.target.closest("[data-boomerang-tip]");
        if (target && event.pointerType !== "touch") showTip(target.dataset.boomerangTip, target);
    });
    panel.addEventListener("pointerout", event => {
        if (event.pointerType !== "touch" && event.target.closest("[data-boomerang-tip]")) hideTip();
    });
    panel.addEventListener("focusin", event => {
        const target = event.target.closest("[data-boomerang-tip]");
        if (target && lastPointerType !== "touch") showTip(target.dataset.boomerangTip, target);
    });
    panel.addEventListener("focusout", hideTip);

    function isExplainExempt(target) {
        return [helpButton, explainButton, dialogClose].some(button => button === target || button.contains(target));
    }

    function showExplanation(target) {
        const key = target.dataset.boomerangExplain;
        let text = explanations[key] || explanations.card;
        if (target.disabled || target.getAttribute("aria-disabled") === "true") text += " 当前控件不可操作：可能已提交、已使用、正在等待、发送中，或尚未选择合法目标。";
        setExplain(false);
        openDialog("Explain", `<p>${esc(text)}</p>`);
    }

    document.addEventListener("pointerdown", event => {
        if (!explaining || !view || isExplainExempt(event.target)) return;
        let target = event.target.closest("[data-boomerang-explain]");
        if (!target) target = [...panel.querySelectorAll("[data-boomerang-explain]")].find(element => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressed = {x: event.clientX, y: event.clientY, until: Date.now() + 900};
        if (target) showExplanation(target);
    }, true);
    document.addEventListener("click", event => {
        if (suppressed && Date.now() < suppressed.until && Math.abs(event.clientX - suppressed.x) < 6 && Math.abs(event.clientY - suppressed.y) < 6) {
            event.preventDefault(); event.stopImmediatePropagation(); suppressed = null; return;
        }
        if (!explaining || !view || isExplainExempt(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = event.target.closest("[data-boomerang-explain]");
        if (target) showExplanation(target);
    }, true);
    document.addEventListener("keydown", event => {
        if (!view) return;
        if (event.key === "Escape") {
            hideTip();
            if (explaining) { event.preventDefault(); setExplain(false); }
            else if (!dialog.open) cancelSelection();
        } else if (explaining && ["Enter", " "].includes(event.key) && !isExplainExempt(event.target)) {
            event.preventDefault(); event.stopImmediatePropagation();
            const target = event.target.closest("[data-boomerang-explain]");
            if (target) showExplanation(target);
        }
    }, true);
    helpButton.addEventListener("click", showHelp);
    explainButton.addEventListener("click", () => setExplain(!explaining));
    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => { hideTip(); if (returnFocus?.isConnected) returnFocus.focus(); });
    window.addEventListener("resize", hideTip);
    window.addEventListener("blur", hideTip);
    document.addEventListener("scroll", hideTip, true);

    function clearState() {
        view = null; selection = null; activitySelection = null; signature = null; pending = false; pendingAction = null; suppressed = null;
        window.clearTimeout(pendingTimer);
        setExplain(false); hideTip();
        if (dialog.open) dialog.close();
        panel.innerHTML = "";
    }

    window.renderBoomerangAustraliaGameState = data => {
        const next = data?.view || data;
        if (!next?.players || next.game_id !== "boomerang_australia") return;
        const nextSignature = JSON.stringify([data?.room_id, next.round, next.pick, next.phase]);
        const contextChanged = nextSignature !== signature;
        if (contextChanged) { selection = null; activitySelection = null; hideTip(); }
        const acknowledged = pendingAction === "next_round" ? next.next_ready?.includes(next.you) : next.players.find(player => player.player_id === next.you)?.submitted;
        if (contextChanged || acknowledged || !pending) {
            pending = false;
            pendingAction = null;
            window.clearTimeout(pendingTimer);
        }
        signature = nextSignature;
        view = next;
        if (next.pending_card) selection = next.pending_card;
        if (next.pending_activity) activitySelection = next.pending_activity;
        render();
    };
    window.showBoomerangAustraliaHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) clearState();
    };
    window.clearBoomerangAustraliaState = clearState;
    window.getBoomerangAustraliaConfig = () => ({direction_variant: !!document.getElementById("boomerangAustraliaDirectionVariant")?.checked});
    window.updateBoomerangAustraliaConfigUI = () => {
        const box = document.getElementById("boomerangAustraliaConfigBox");
        if (!box) return;
        const visible = currentGameType === "boomerang_australia" && currentRoomState?.status === "lobby";
        box.classList.toggle("hidden", !visible);
        box.setAttribute("aria-hidden", String(!visible));
    };
    function connectEvents() {
        socket.on("system:error", () => {
            if (pending) { pending = false; pendingAction = null; window.clearTimeout(pendingTimer); render(); }
        });
        const syncRoomConfig = state => {
            if (!state) return;
            const checkbox = document.getElementById("boomerangAustraliaDirectionVariant");
            if (state.game_type !== "boomerang_australia" || !checkbox) return;
            const nextConfigSignature = JSON.stringify([state.room_id, !!state.game_config?.direction_variant]);
            if (configSignature !== nextConfigSignature) checkbox.checked = !!state.game_config?.direction_variant;
            configSignature = nextConfigSignature;
        };
        socket.on("room:state", syncRoomConfig);
        if (typeof currentRoomState !== "undefined") syncRoomConfig(currentRoomState);
    }
    if (document.readyState === "loading" || typeof socket === "undefined") {
        window.addEventListener("DOMContentLoaded", connectEvents, {once: true});
    } else {
        connectEvents();
    }
})();
