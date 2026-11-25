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
        culture: {name: "原住民文化", icon: "🎨"},
        sightseeing: {name: "观光", icon: "📷"},
    };
    const regionColors = {wa: "#a4603e", nt: "#947642", qld: "#b37052", sa: "#ae8546", nsw: "#547e76", vic: "#567796", tas: "#727752"};
    const explanations = {
        card: "景点牌上方是地点字母与投掷数字(🪃)，下方依次是绿色收藏品、金色动物、蓝色活动。原住民文化(🎨)是活动，和投掷接回(🪃)独立计分。点选后在牌上 Confirm，Cancel、空白或 Esc 可取消。第一张是仅自己可见的投掷牌，轮末揭示。",
        confirm: "Confirm 锁定本批次选择。全部玩家提交后才同时揭示和传牌。未选牌、已提交、发送中或等待其他人时无法确认。不能撤回已被服务器接受的选择。",
        cancel: "Cancel 仅取消本地尚未提交的卡牌或活动选择，不发送游戏动作。点击周围空白或按 Esc 也可取消。",
        activity: "游泳(🏊)、徒步(🥾)、原住民文化(🎨)、观光(📷)：每轮选一种尚未记录的活动。本轮 0／1／2／3／4／5／6 个图标分别得 0／0／2／4／7／10／15 分。每种整局只能记录一次，零分也占用。文化活动(🎨)不是投掷接回(🪃)。",
        skip: "Skip 放弃本轮活动计分，保留所有尚未使用的活动供以后选择。其他计分仍照常结算。",
        next: "Next Round 确认已看过本轮结果。每个席位分别确认后才继续。机器人只确认自己，断线真人不会自动跳过。第四轮确认后展示最终排名。",
        region: "景点(📍)整局每个不同地点计 1 分。每地区有四个地点。最早完成的那一轮，所有同时完成该地区的玩家各得 3 分，之后不再颁发。",
        score: "总分(🏆) = 每轮投掷接回(🪃)、收藏品(🎁)、动物(🐾)、活动(📷)，再加不同景点(📍)及地区奖励(🗺️)。同分比较四轮投掷接回总分，仍相同则并列。",
        throw: "投掷与接回(🪃)：本轮第一张 Throw 与最后一张 Catch 的数字之差取绝对值。第一张秘密保留，最后一张由传牌自动收到，七张都参与其他计分。",
        collection: "收藏品：叶子(🍃) 1、野花(🌼) 2、贝壳(🐚) 3、纪念品(🎁) 5。本轮原值总和 1–7 时翻倍，8 以上按原值，没有则为 0 分。",
        animal: "动物每两只同类计一对：袋鼠(🦘) 3、鸸鹋(🐦) 4、袋熊(🐾) 5、考拉(🐨) 7、鸭嘴兽(🦆) 9。落单不计，四只计两对。",
        direction: "每批次所有玩家选一张后把余牌向箭头所示方向传递。默认向左，开启方向变体时第 2、4 轮向右。两人局方向不影响交换对象。",
        history: "计分纸保留四轮的分项结果。景点一列只计本轮新地点，地区一列只计本轮新奖励，累计总分不会重复加入已访问地点。",
        visited: "✓ 表示这个地点你以前已经访问过：图标仍照常计分，但景点(📍)的 1 分不会重复获得。",
        progress: "n/4 表示你在这个地区已经访问过的地点数。收满四个时，最早完成的同一轮所有完成者各得 3 分地区奖励(🗺️)。",
        round: "一局共四轮。Round n/4 显示当前是第几轮。终局(🏆)表示四轮已结束，正在展示最终结果。",
    };
    let view = null, selection = null, activitySelection = null, signature = null;
    let pending = false, pendingAction = null, pendingTimer = null, explaining = false, suppressed = null;
    let lastPointerType = "mouse", tipTimer = null, returnFocus = null, configSignature = null;
    let helpLanguage = "zh", helpSection = "basics", pointerGesture = null;

    const dialog = document.getElementById("boomerangAustraliaDialog");
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
    const visitedSet = () => new Set(own()?.visited || []);
    const button = (label, action, explanation, disabled = false, className = "") => `<button type="button" class="${className}" data-boomerang-action="${action}" data-boomerang-explain="${explanation}" ${disabled ? "disabled" : ""}>${label}</button>`;
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

    const helpContent = {
        zh: {
            basics: ["快速上手", `<p><strong>如何获胜：</strong>2–4 人进行四轮旅行，总分(🏆)最高者获胜。</p><p><strong>每次做什么：</strong>从手牌选一张并 Confirm，余牌传给下家，轮末选择一种未用过的活动或 Skip。</p><p><strong>选择重点：</strong>兼顾新景点(📍)、地区奖励(🗺️)、收藏品(🎁)、动物(🐾)和活动(📷)，同时让投掷接回(🪃)数字差尽量大。</p><h3>两个不同的符号</h3><p>投掷接回(🪃)比较本轮第一张 Throw 和最后一张 Catch 的数字。原住民文化(🎨)属于蓝色活动，按本轮文化图标数量计分，和投掷数字没有关系。</p><h3>一轮的流程</h3><ol><li>每人七张牌。第一次选择的 Throw 投掷牌(🪃)秘密保留，直到轮末才公开。</li><li>每次选择后余牌按箭头传递。所有人锁定后同时揭示，自己始终能看自己的牌。</li><li>共选六次，最后一张自动传来，成为 Catch 接回牌(↩)。七张都参与其他计分。</li><li>选择活动或 Skip 后结算。所有人分别点击 Next Round 才继续，第四轮确认后展示终局。</li></ol>`],
            scoring: ["计分与图标", `<h3>投掷、景点与地区</h3><p>${explanations.throw}</p><p>${explanations.region}</p><p>${explanations.visited} ${explanations.progress}</p><h3>收藏品与动物</h3><p>${explanations.collection}</p><p>${explanations.animal}</p><h3>活动</h3><p>${explanations.activity} Skip 可以保留所有未用活动。</p><p>图标数 0／1／2／3／4／5／6 对应 0／0／2／4／7／10／15 分。</p><h3>胜负</h3><p>${explanations.score}</p>`],
            details: ["操作与变体", `<h3>线上操作</h3><p>点选卡牌后在手牌内 Confirm。Cancel、周围空白或 Esc 取消本地选择，服务器已接受的选择不可撤回。活动同样先选再 Confirm。Next Round 不需要额外确认。</p><p>桌面悬停或聚焦图标查看说明，手机轻点后显示三秒提示，连续点击以最新提示为准。滚动不会选牌。Explain 可查看具体卡牌及禁用控件，不会提交动作，Esc 可退出。Help 和 Explain 对话框支持 Esc 关闭。</p><h3>发牌与方向</h3><p>四人局每轮重洗 28 张牌。二／三人局优先发上轮未发出的牌，使用过的牌洗好放在其后。默认向左，方向变体在第 2、4 轮向右。两人局交换对象不变。</p><h3>公开信息与回顾</h3><p>只有本人能看自己的手牌、秘密 Throw 和未公开选择。轮末暂停等待每个席位确认，机器人只确认自己，断线真人不会自动跳过。终局展示每位玩家的四轮分项计分纸。旅行记录不是可拖拽地图。</p>`],
        },
        en: {
            basics: ["Quick start", `<p><strong>Win:</strong> Score the most points(🏆) over four rounds with 2–4 players.</p><p><strong>Your turn:</strong> Select one card and Confirm, pass the rest, then choose an unused activity or Skip at round end.</p><p><strong>Focus:</strong> Balance new sites(📍), regions(🗺️), collections(🎁), animal pairs(🐾) and activities(📷), while aiming for a large Throw & Catch(🪃) number difference.</p><h3>Two distinct symbols</h3><p>Throw & Catch(🪃) uses the numbers on your first and last cards. Aboriginal culture(🎨) is a blue activity scored by counting its symbols, independently of those numbers.</p><h3>A round</h3><ol><li>Start with seven cards. Your first pick is a secret Throw(🪃), revealed at round end.</li><li>Choose one card at a time and pass the rest in the indicated direction. Cards reveal together after everyone locks in.</li><li>After six picks, the final card arrives automatically as your Catch(↩). All seven cards count for other scoring.</li><li>Choose an activity or Skip. Review the results and click Next Round. Every seat must confirm before play continues. The fourth review leads to final results.</li></ol>`],
            scoring: ["Scoring & icons", `<h3>Throw, sites and regions</h3><p>Throw & Catch(🪃) scores the absolute difference between your first and last card numbers. Each unique site(📍) scores 1 point once per game. A region(🗺️) has four sites. All players first completing it in the same round gain 3 points each, with no later awards. Visited(✓) marks an already scored site. Region progress(n/4) counts your visited sites.</p><h3>Collections</h3><p>Leaves(🍃) are worth 1, wildflowers(🌼) 2, shells(🐚) 3 and souvenirs(🎁) 5. Add their values this round. Totals of 1–7 double, totals of 8 or more do not, and no symbols score 0.</p><h3>Animals</h3><p>Each pair scores: kangaroos(🦘) 3, emus(🐦) 4, wombats(🐾) 5, koalas(🐨) 7 and platypuses(🦆) 9. Singles score nothing and four matching animals count as two pairs.</p><h3>Activities</h3><p>Swimming(🏊), bushwalking(🥾), Aboriginal culture(🎨) and sightseeing(📷) each score at most once per game, even if recorded for zero. Choose one unused activity this round or Skip to save it. Counts of 0 / 1 / 2 / 3 / 4 / 5 / 6 score 0 / 0 / 2 / 4 / 7 / 10 / 15 points.</p><h3>Winning</h3><p>Add all round scores and one-time site and region points. Ties use total Throw & Catch(🪃) points across all four rounds, then share the win.</p>`],
            details: ["Controls & variants", `<h3>Controls</h3><p>Select a card, then Confirm in the hand area. Cancel, empty space or Esc clears an unsubmitted selection. Accepted choices cannot be undone. Select an activity before Confirm. Next Round needs no second confirmation.</p><p>Hover or focus symbols for a short tip. On touchscreens, tap for a three-second tip and tap another symbol to replace it. Scrolling does not select a card. Explain describes the actual card or disabled control without acting. Esc exits Explain and closes dialogs.</p><h3>Dealing and direction</h3><p>With four players, shuffle all 28 cards each round. With two or three, deal previously undealt cards first, followed by shuffled used cards. Pass left normally. The direction variant passes right in rounds 2 and 4. Two players always exchange with each other.</p><h3>Privacy and reviews</h3><p>Only you can see your hand, secret Throw and unrevealed choice. Every seat confirms the round review individually. Bots only confirm themselves and disconnected humans are not skipped. Final score sheets show every player's four-round breakdown. The journal is not a draggable map.</p>`],
        },
    };

    function renderHelp() {
        const sections = helpContent[helpLanguage];
        dialogBody.innerHTML = `<div class="boomerang-help-languages" role="group" aria-label="Language">${[["zh", "中文"], ["en", "English"]].map(([language, label]) => `<button type="button" data-boomerang-language="${language}" aria-pressed="${language === helpLanguage}">${label}</button>`).join("")}</div><div class="boomerang-help-tabs" role="group" aria-label="Help sections">${Object.entries(sections).map(([key, [label]]) => `<button type="button" data-boomerang-section="${key}" aria-pressed="${key === helpSection}">${label}</button>`).join("")}</div><section class="boomerang-help-content" lang="${helpLanguage === "zh" ? "zh-CN" : "en"}">${sections[helpSection][1]}</section>`;
    }

    function showHelp() {
        setExplain(false);
        helpSection = "basics";
        openDialog("Help · 世界巡游（澳洲）", "");
        renderHelp();
    }

    function symbolHTML(kind, id) {
        const item = ({collection: collections, animal: animals, activity: activities}[kind] || {})[id];
        if (!item) return "";
        const text = kind === "collection" ? `${item.name}(${item.icon})：收藏原值 ${item.points}。本轮合计 1–7 翻倍，8 以上不翻倍。` : kind === "animal" ? `${item.name}(${item.icon})：每两只 ${item.points} 分，落单不计。` : `${item.name}(${item.icon})：本轮可选一种未使用活动计分，每种整局最多一次。`;
        return badge(`${item.icon}${kind === "activity" ? "" : `<small>${item.points}</small>`}`, text, `is-${kind}`);
    }

    function cardHTML(card, selectable = false, index = null, compact = false) {
        if (!card) return `<div class="boomerang-card is-hidden-card" data-boomerang-explain="card" tabindex="0" data-boomerang-tip="${esc(`秘密 Throw(🪃)：轮末才公开，不能查看其他玩家的牌面。${explanations.throw}`)}"><span class="boomerang-hidden-icon">🪃</span><strong>Throw</strong><small>Hidden</small></div>`;
        const selected = selectable && (selection === card.id || view.pending_card === card.id);
        const cardRegion = region(card.region);
        const label = index === 0 ? "Throw" : index === 6 ? "Catch" : null;
        const regionCards = cardRegion.cards || [];
        const visited = visitedSet();
        const alreadyVisited = selectable && visited.has(card.id);
        const collected = regionCards.filter(cardId => visited.has(cardId)).length;
        const awarded = view.players.some(player => (player.region_bonuses || []).includes(card.region));
        const accessible = `${card.id} · ${cardName(card)} · ${cardRegion.name_zh} · 投掷 ${card.number} · ${collections[card.collection]?.name || "无收藏品"} · ${animals[card.animal]?.name || "无动物"} · ${activities[card.activity]?.name || "无活动"}`;
        const regionTip = `${cardRegion.name_zh}(${cardRegion.name})：${collected}/${regionCards.length || 4} 已访问。${awarded ? "地区奖励已颁发。" : "首次收齐的同一轮，所有完成者各得 3 分。"}`;
        return `<article class="boomerang-card ${selected ? "is-selected" : ""} ${selectable ? "is-selectable" : ""} ${compact ? "is-compact" : ""} ${alreadyVisited ? "is-visited" : ""}" style="--boomerang-region:${regionColors[card.region] || "#62857c"}" data-boomerang-card-id="${esc(card.id)}" ${selectable ? `role="button" tabindex="0" data-boomerang-card="${esc(card.id)}" aria-pressed="${selected}" aria-disabled="${!legal("draft_card")}"` : ""} data-boomerang-explain="card" aria-label="${esc(accessible)}">
            <div class="boomerang-card-top"><span class="boomerang-place-code" tabindex="0" role="button" data-boomerang-tip="${esc(`${card.id}：${cardName(card)}${card.name && card.name !== cardName(card) ? ` (${card.name})` : ""}，所属${cardRegion.name_zh}。${alreadyVisited ? "你已访问过这个地点，景点分不再重复。" : "访问过的景点不再重复计分。"}`)}">${esc(card.id)}</span>${badge(`<span class="boomerang-number-icon" aria-hidden="true">🪃</span>${esc(card.number)}`, explanations.throw, "boomerang-number")}</div>
            <div class="boomerang-card-place"><strong>${esc(cardName(card))}</strong><small lang="en">${esc(card.name || "")}</small></div>
            <div class="boomerang-card-region"><span class="boomerang-region-name">${esc(cardRegion.name_zh || cardRegion.name)}</span>${selectable && collected ? `<span class="boomerang-region-progress ${awarded ? "is-awarded" : ""}" tabindex="0" role="button" data-boomerang-tip="${esc(regionTip)}">${collected}/${regionCards.length || 4}</span>` : ""}${alreadyVisited ? `<span class="boomerang-visited-flag" tabindex="0" role="button" data-boomerang-tip="${esc(explanations.visited)}">✓</span>` : ""}</div>
            <div class="boomerang-card-icons">${symbolHTML("collection", card.collection)}${symbolHTML("animal", card.animal)}${symbolHTML("activity", card.activity)}</div>
            ${label ? `<span class="boomerang-card-role" tabindex="0" data-boomerang-tip="${esc(explanations.throw)}">${label === "Throw" ? "🪃" : "↩"} ${label}</span>` : ""}
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

    function statusHTML() {
        const title = view.game_over ? "Final results" : view.phase === "round_end" ? "Round review" : view.phase === "choose_activity" ? "Choose an activity" : view.pick === 1 ? "Choose your Throw card" : "Choose a destination";
        return `<div class="boomerang-status">
            <span class="boomerang-round-chip" tabindex="0" role="button" data-boomerang-tip="${esc(explanations.round)}">${view.game_over ? "🏆 Final" : `Round ${view.round}/4`}</span>
            <strong class="boomerang-phase-title">${title}</strong>
            ${view.game_over ? "" : `<span class="boomerang-direction" tabindex="0" role="button" data-boomerang-tip="${esc(explanations.direction)}">${view.direction === "right" ? "Pass right →" : "← Pass left"}</span>`}
            ${view.phase === "draft" && !view.game_over ? `<div class="boomerang-pick-progress"><span>Pick ${view.pick}/6</span><div>${Array.from({length: 6}, (_, index) => `<i class="${index < view.pick ? "is-done" : ""}"></i>`).join("")}</div></div>` : ""}
        </div>`;
    }

    function playerHTML(player) {
        const ready = view.next_ready?.includes(player.player_id);
        const status = view.phase === "round_end" ? (ready ? "Ready ✓" : "Reviewing") : view.game_over ? "Final score" : player.submitted ? "Locked ✓" : "Choosing";
        const marker = ["◆", "●", "▲", "■"][view.players.indexOf(player)];
        return `<div class="boomerang-player ${player.player_id === view.you ? "is-you" : ""}"><div><strong><span class="boomerang-player-marker" aria-hidden="true">${marker}</span> ${esc(player.name)}</strong><small>${player.player_id === view.you ? "You" : player.is_bot ? "Bot" : "Player"} · ${status}</small></div><span class="boomerang-player-total" data-boomerang-tip="${esc(explanations.score)}" tabindex="0">${number(player.total)}<small>pts</small></span></div>`;
    }

    function scoreSymbols(score) {
        return [["🪃", score.throw_catch, "throw"], ["🎁", score.collections, "collection"], ["🐾", score.animals, "animal"], ["📷", score.activity_score, "activity"], ["📍", (score.new_sites || []).length, "region"], ["🗺️", (score.new_regions || []).length * 3, "region"]].map(([icon, points, key]) => `<span tabindex="0" data-boomerang-tip="${esc(explanations[key])}">${icon} ${number(points)}</span>`).join("");
    }

    function previewStripHTML() {
        const preview = own()?.preview;
        if (!preview) return "";
        const parts = [["🪃", preview.throw_catch, "throw"], ["🎁", preview.collections, "collection"], ["🐾", preview.animals, "animal"], ["📍", (preview.new_sites || []).length, "region"], ["🗺️", (preview.new_regions || []).length * 3, "region"]];
        return `<div class="boomerang-preview-strip" data-boomerang-explain="score"><small>Round so far</small><div>${parts.map(([icon, points, key]) => `<span tabindex="0" data-boomerang-tip="${esc(explanations[key])}">${icon} ${points == null ? "—" : number(points)}</span>`).join("")}</div></div>`;
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
            return `${previewStripHTML()}<div class="boomerang-activity-grid">${(view.activity_options || []).map(option => {
                const item = activities[option.id] || {name: option.id, icon: "📷"};
                const selected = activitySelection === option.id || view.pending_activity === option.id;
                return `<div class="boomerang-activity-choice"><button type="button" class="boomerang-activity ${selected ? "is-selected" : ""}" data-boomerang-activity="${esc(option.id)}" data-boomerang-explain="activity" aria-pressed="${selected}" ${option.used || !legal("choose_activity") ? "disabled" : ""}><strong>${item.icon} ${item.name}</strong><span>${option.used ? "Used" : `${number(option.count)} × → ${number(option.points)} pts`}</span></button>${selected && !mine.submitted ? `<div class="boomerang-activity-confirm">${button("Confirm", "confirm_activity", "activity", !legal("choose_activity"), "boomerang-primary")}${button("Cancel", "cancel", "cancel")}</div>` : ""}</div>`;
            }).join("")}</div><div class="boomerang-action-row">${button("Skip", "skip", "skip", !legal("choose_activity"))}</div>`;
        }
        return "";
    }

    function handHTML() {
        const chosen = cardById(selection);
        return `<div class="boomerang-hand-area"><div class="boomerang-hand">${view.hand.map(card => cardHTML(card, true)).join("")}</div>${chosen && legal("draft_card") ? `<div class="boomerang-hand-confirm"><div class="boomerang-confirm-choice"><small>Selected destination</small><strong>${esc(chosen.id)} · ${esc(cardName(chosen))}</strong><span>🪃 ${number(chosen.number)} · ${esc(region(chosen.region).name_zh)}</span><div>${symbolHTML("collection", chosen.collection)}${symbolHTML("animal", chosen.animal)}${symbolHTML("activity", chosen.activity)}</div><div class="boomerang-confirm-buttons">${button("Confirm", "confirm", "confirm", false, "boomerang-primary")}${button("Cancel", "cancel", "cancel")}</div></div></div>` : ""}</div>`;
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
        return `<section class="boomerang-box boomerang-score-box" data-boomerang-explain="score"><div class="boomerang-section-title"><h3>${lastScore ? "Round score" : "Score preview"}</h3></div>
            ${score ? `${scoreLine("🪃 Throw & Catch", score.throw_catch === null || score.throw_catch === undefined ? "—" : score.throw_catch, explanations.throw)}${scoreLine("🎁 收藏品", number(score.collections), explanations.collection)}${scoreLine("🐾 动物", number(score.animals), explanations.animal)}${scoreLine("📷 活动", lastScore ? number(score.activity_score) : "Choose at round end", explanations.activity)}${scoreLine("📍 新景点", Array.isArray(score.new_sites) ? score.new_sites.length : number(score.new_sites), explanations.region)}${scoreLine("🗺️ 地区奖励", Array.isArray(score.new_regions) ? score.new_regions.length * 3 : number(score.new_regions) * 3, explanations.region)}${lastScore ? `<div class="boomerang-score-total"><span>Round total</span><strong>+${number(score.round_points)}</strong></div>` : '<p class="boomerang-muted">Provisional · all seven cards count.</p>'}` : '<p class="boomerang-muted">Your scoring preview appears after all seven cards are drafted.</p>'}
            <div class="boomerang-used-activities">${Object.entries(activities).map(([id, item]) => `<span class="${Object.prototype.hasOwnProperty.call(mine.activities || {}, id) ? "is-used" : ""}" tabindex="0" data-boomerang-tip="${esc(`${item.name}(${item.icon})：${Object.prototype.hasOwnProperty.call(mine.activities || {}, id) ? `已使用，记录 ${mine.activities[id]} 分。` : "尚未使用，可在以后的轮末选择。"}`)}">${item.icon}<small>${Object.prototype.hasOwnProperty.call(mine.activities || {}, id) ? mine.activities[id] : "—"}</small></span>`).join("")}</div>
        </section>`;
    }

    function regionsHTML() {
        const mine = own();
        if (!mine) return "";
        const visited = visitedSet();
        return `<section class="boomerang-box boomerang-destinations" data-boomerang-explain="region"><div class="boomerang-section-title"><h3>📍 Travel journal</h3><span class="boomerang-counter">${visited.size} / 28</span></div><div class="boomerang-region-list">${Object.entries(view.regions || {}).map(([id, data]) => {
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
        return `<section class="boomerang-box boomerang-round-review" data-boomerang-explain="history"><div class="boomerang-section-title"><h3>Round ${view.round} · Results</h3></div><div class="boomerang-round-results">${(view.round_summary || []).map(score => `<div class="boomerang-round-result ${score.player_id === view.you ? "is-you" : ""}"><strong>${esc(name(score.player_id))}${score.player_id === view.you ? "<em>You</em>" : ""}</strong><span class="boomerang-result-points">+${number(score.round_points)}</span><p>${scoreSymbols(score)}</p><small>${score.activity ? `${activities[score.activity]?.icon || "📷"} ${activities[score.activity]?.name || score.activity}` : "Activity skipped"}${(score.new_regions || []).length ? ` · ${score.new_regions.map(id => `${region(id).name_zh} +3`).join(", ")}` : ""}</small></div>`).join("")}</div></section>`;
    }

    function scoreHistory(scores) {
        return `<div class="boomerang-score-history">${scores.map(score => `<div class="boomerang-history-round"><strong>Round ${score.round}<span>+${number(score.round_points)}</span></strong><div>${scoreSymbols(score)}</div></div>`).join("")}</div>`;
    }

    function historyHTML() {
        const mine = own();
        if (view.game_over) {
            const ranked = view.players.slice().sort((left, right) => right.total - left.total || right.scores.reduce((sum, score) => sum + score.throw_catch, 0) - left.scores.reduce((sum, score) => sum + score.throw_catch, 0));
            return `<section class="boomerang-box" data-boomerang-explain="score"><div class="boomerang-section-title"><h3>Final score sheets</h3></div><div class="boomerang-final-sheets">${ranked.map(player => `<details class="boomerang-final-sheet" data-boomerang-player="${esc(player.player_id)}" ${player.player_id === view.you ? "open" : ""}><summary><span>${view.winner.includes(player.player_id) ? "🏆 " : ""}${esc(player.name)}${player.player_id === view.you ? " (You)" : ""}</span><strong>${player.total} pts</strong></summary><p class="boomerang-muted" tabindex="0" data-boomerang-tip="${esc(explanations.throw)}">Throw & Catch tiebreak: ${player.scores.reduce((sum, score) => sum + score.throw_catch, 0)}</p>${scoreHistory(player.scores)}</details>`).join("")}</div></section>`;
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
            ${statusHTML()}
            <div class="boomerang-players" style="--boomerang-player-count:${view.players.length}">${view.players.map(playerHTML).join("")}</div>
            ${view.game_over ? `<div class="boomerang-winner"><span>🏆</span><div><small>${view.winner.length > 1 ? "Joint winners" : "Winner"}</small><strong>${esc(view.winner.map(name).join(" · "))}</strong></div></div>` : ""}
            <div class="boomerang-layout"><main class="boomerang-main"><section class="boomerang-play-area"><p class="boomerang-step" aria-live="polite">${stepText()}</p>
            ${hasHand ? handHTML() : ""}
            ${actionHTML()}</section>
            ${roundSummaryHTML()}
            ${mine?.cards?.length ? `<section class="boomerang-box boomerang-my-cards"><div class="boomerang-section-title"><h3>Your journey</h3><span class="boomerang-counter">${mine.cards.length} / 7 cards</span></div><div class="boomerang-tableau">${mine.cards.map((card, index) => cardHTML(card, false, index, true)).join("")}</div></section>` : ""}
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
        const cardId = selection;
        const activityId = activitySelection;
        selection = null;
        activitySelection = null;
        hideTip();
        render();
        const target = cardId ? `[data-boomerang-card="${cardId}"]` : `[data-boomerang-activity="${activityId}"]`;
        panel.querySelector(target)?.focus({preventScroll: true});
    }

    panel.addEventListener("pointerdown", event => {
        lastPointerType = event.pointerType || "mouse";
        pointerGesture = {id: event.pointerId, x: event.clientX, y: event.clientY, moved: false};
    });
    document.addEventListener("pointermove", event => {
        if (pointerGesture?.id === event.pointerId && Math.hypot(event.clientX - pointerGesture.x, event.clientY - pointerGesture.y) > 10) pointerGesture.moved = true;
    }, {passive: true});
    document.addEventListener("pointercancel", () => { if (pointerGesture) pointerGesture.moved = true; }, {passive: true});
    panel.addEventListener("click", event => {
        if (!view || explaining) return;
        if (event.detail !== 0 && pointerGesture?.moved) { pointerGesture = null; return; }
        pointerGesture = null;
        const control = event.target.closest("[data-boomerang-action]");
        if (control) {
            if (control.disabled) return;
            const action = control.dataset.boomerangAction;
            if (action === "confirm" && selection) submit({type: "draft_card", card_id: selection, round: view.round, pick: view.pick});
            if (action === "confirm_activity" && activitySelection) submit({type: "choose_activity", activity: activitySelection, round: view.round});
            if (action === "skip") submit({type: "choose_activity", activity: null, round: view.round});
            if (action === "next") submit({type: "next_round", round: view.round});
            if (action === "cancel") cancelSelection();
            return;
        }
        const tooltip = event.target.closest("[data-boomerang-tip]");
        if (tooltip) {
            event.preventDefault();
            event.stopPropagation();
            showTip(tooltip.dataset.boomerangTip, tooltip, lastPointerType === "touch");
            return;
        }
        const card = event.target.closest("[data-boomerang-card]");
        if (card) {
            if (legal("draft_card")) {
                selection = selection === card.dataset.boomerangCard ? null : card.dataset.boomerangCard;
                hideTip();
                render();
                if (selection) panel.querySelector('[data-boomerang-action="confirm"]')?.focus({preventScroll: true});
            }
            return;
        }
        const activity = event.target.closest("[data-boomerang-activity]");
        if (activity) {
            if (legal("choose_activity") && !activity.disabled) { activitySelection = activitySelection === activity.dataset.boomerangActivity ? null : activity.dataset.boomerangActivity; render(); }
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
        return dialog.contains(target) || [helpButton, explainButton].some(button => button === target || button.contains(target));
    }

    function showExplanation(target) {
        const key = target.dataset.boomerangExplain;
        let text = explanations[key] || explanations.card;
        if (key === "card") {
            const card = cardById(target.dataset.boomerangCardId);
            if (card) {
                const collection = collections[card.collection];
                const animal = animals[card.animal];
                const activity = activities[card.activity];
                text = `${card.id} · ${cardName(card)}，${region(card.region).name_zh}。投掷数字(🪃) ${card.number}。${collection ? `${collection.name}(${collection.icon}) 原值 ${collection.points}。` : "没有收藏品。"}${animal ? `${animal.name}(${animal.icon}) 每对 ${animal.points} 分。` : "没有动物。"}${activity ? `${activity.name}(${activity.icon}) 是本轮一个活动图标。` : "没有活动。"} ${text}`;
            } else text = `这是尚未公开的秘密 Throw(🪃)，轮末才揭示，不能查看他人的牌面。${explanations.throw}`;
        }
        if (key === "activity" && target.dataset.boomerangActivity) {
            const option = view.activity_options?.find(item => item.id === target.dataset.boomerangActivity);
            const item = activities[target.dataset.boomerangActivity];
            if (option && item) text = `${item.name}(${item.icon})：本轮 ${option.count} 个，${option.points} 分。${option.used ? "整局机会已经使用，不能再选。" : "本轮可选，记录后整局不能再次使用。"} ${text}`;
        }
        if (target.disabled || target.getAttribute("aria-disabled") === "true") text += " 当前控件不可操作：可能已提交、已使用、正在等待、发送中，或尚未选择合法目标。";
        setExplain(false);
        openDialog("Explain", `<p>${esc(text)}</p>`);
    }

    document.addEventListener("pointerdown", event => {
        if (!explaining || !view || isExplainExempt(event.target)) return;
        let target = event.target.closest("[data-boomerang-explain]");
        if (!target) target = [...panel.querySelectorAll("button:disabled[data-boomerang-explain]"), ...panel.querySelectorAll("[data-boomerang-explain]")].find(element => {
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
    dialogBody.addEventListener("click", event => {
        const language = event.target.closest("[data-boomerang-language]");
        const section = event.target.closest("[data-boomerang-section]");
        if (!language && !section) return;
        if (language) helpLanguage = language.dataset.boomerangLanguage;
        if (section) helpSection = section.dataset.boomerangSection;
        const selector = language ? `[data-boomerang-language="${helpLanguage}"]` : `[data-boomerang-section="${helpSection}"]`;
        renderHelp();
        dialogBody.querySelector(selector)?.focus({preventScroll: true});
    });
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
