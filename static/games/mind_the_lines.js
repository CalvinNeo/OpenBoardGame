(() => {
    "use strict";

    const byId = id => document.getElementById(`mindTheLines${id}`);
    const panel = byId("Panel"), header = byId("HeaderActions"), game = panel?.querySelector(".mind-game");
    const board = byId("Board"), modal = byId("Modal"), tip = byId("Tip");
    if (!panel || !game || !board || !modal || !tip) return;
    const helpButton = byId("HelpBtn"), explainButton = byId("ExplainBtn");
    const dialogClose = byId("DialogClose"), dialogTitle = byId("DialogTitle"), dialogBody = byId("DialogBody");
    const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
    const explanations = {
        board: "画板(✏️)：只可沿淡色预设短线段描画，不能添加自由笔迹、文字、数字或字母。鼠标拖动或单指滑动会吸附近处的线段。绘画计时结束或 Submit 后画板锁定。",
        pen: "Pen(✏️) 使用固定笔宽描出已有线段。按住并沿线移动可连续描画；轻点也可选中一条线。词语(🔒)只给本人看，不要用聊天或手势泄露线索。",
        eraser: "Eraser 擦除经过的已选线段。只改变你自己的画稿，计时结束或提交之后无法修改。",
        undo: "Undo(↶) 撤销最近一次笔画、擦除、翻面或旋转。撤销记录保存在当前浏览器中；刷新会恢复已保存画稿，但不会恢复撤销记录。",
        flip: "Flip(↔) 换到画板的另一面。两面线稿不同，切换时清除当前笔迹；紧接着用 Undo 可恢复。最终只提交一面。",
        rotate: "Rotate(↻) 将画板和笔迹一起顺时针旋转 90°。四个方向都可使用，服务器保存当前方向。",
        submit: "Submit 锁定当前画稿，之后本轮不能再修改。所有人提前提交会立即进入猜测；计时结束则自动提交最新保存的画稿。",
        ready: "Ready 表示已经读过自己的秘密词语(🔒)。全员准备好才开始计时。2–3 人每人两词，要在同一张画板上画出两词，不能标记哪部分对应哪个词。",
        timer: "时间(⏳)：标准为全员准备后同时描画 2 分钟。3 分钟与 Untimed 为线上练习选项。倒计时按服务器时间校正，结束后自动锁定最后保存的画稿。",
        round: "轮数(✏️)：一局最多四轮。每轮首位玩家顺移，轮末画板传给下一位玩家；新一轮重新抽词。",
        errors: "错误(❌)：每误排一个真正被画出的词，累计一个错误。超过玩家人数立刻失败；完成四轮且错误不超过人数获胜，刚好相等仍可获胜。",
        words: "秘密词语(🔒)：只属于你的绘画任务。4–8 人每人一词，2–3 人每人两词。双词共用一张画板，不可划分标注。",
        player: "玩家进度：Ready 表示已准备，Submitted 表示已锁定画稿，Reviewed 表示已确认轮末结果。每个席位都须自行确认，断线真人不会被自动跳过。",
        gallery: "画廊(✏️) 展示所有人锁定的画稿，点击可放大。猜测时结合画作找出无人画过的干扰词，不能额外交流线索；轮末才公开词语归属。",
        card: "候选词：真实词与等量干扰词混合。轮到你时，点选一个你认为没有被画出的词，再按 Eliminate。取消可按 Cancel、Esc 或点击空白。排除后不立即揭示正误。",
        eliminate: "Eliminate 排除选中的词，不可撤回。按顺序每人排除一词；2–3 人共进行两圈，每人排除两词。所有排除完成后统一揭示并计算错误(❌)。",
        cancel: "Cancel 取消尚未确认的词卡选择。也可以按 Esc 或点击画廊和词卡以外的空白。",
        next: "Next Round 表示已查看本轮结果。所有玩家各自确认后才继续；机器人仅确认自己的席位，断线真人须重连确认。最终结果保持可查看。",
        result: "轮末统一认领所有词语。误排真实词会增加错误(❌)，正确排除干扰词不加错。未被排除的真实词留存，未被排除的干扰词也不另罚。",
    };
    let view = null, context = null, drawingIdentity = null, baseIdentity = null, gallerySignature = null;
    let selected = new Set(), side = 0, rotation = 0, sequence = -1, dirty = false, tool = "pen";
    let history = [], pointerId = null, previousPoint = null, strokeChanged = false, strokeSnapshot = null;
    let saveTimer = null, lastSaveTime = 0, timerId = null, serverOffset = 0;
    let chosenCard = null, pending = null, pendingTimer = null, configSignature = null;
    let explaining = false, suppressClickUntil = 0, pointerType = "mouse", tipTimer = null, returnFocus = null;
    let localClockExpired = false, awaitingResync = false;

    const own = () => view?.players?.find(player => player.player_id === view.you);
    const name = id => view?.players?.find(player => player.player_id === id)?.name || "—";
    const hasAction = action => !!view?.legal_actions?.includes(action);
    const connected = () => typeof socket !== "undefined" && socket.connected && !awaitingResync && (typeof roomSessionReady === "undefined" || roomSessionReady);
    const legal = action => connected() && !pending && hasAction(action);
    const remaining = () => view?.deadline_ms ? Math.max(0, view.deadline_ms - (Date.now() + serverOffset)) : Infinity;
    const canDraw = () => view?.phase === "drawing" && legal("save_drawing") && remaining() > 0 && !own()?.submitted;
    const snapshot = () => ({segments: Array.from(selected), side, rotation});
    const cardMarkup = word => `<strong>${escapeHTML(word.zh)}</strong><small>${escapeHTML(word.en)}</small>`;
    const playerCount = () => view?.players?.length || 0;
    const svgTransform = angle => `rotate(${angle * 90} 500 500)`;
    const stat = (text, explanation, id = "") => `<span ${id ? `id="${id}"` : ""} class="mind-stat" tabindex="0" data-mind-explain="${explanation}" data-mind-tip="${escapeHTML(explanations[explanation])}">${text}</span>`;

    function hideTip() {
        tip.hidden = true;
        window.clearTimeout(tipTimer);
    }

    function showTip(text, anchor, touch = false) {
        if (!text || explaining) return;
        hideTip();
        tip.textContent = text;
        tip.hidden = false;
        const rect = anchor.getBoundingClientRect(), bounds = tip.getBoundingClientRect();
        const left = touch ? (window.innerWidth - bounds.width) / 2 : rect.left;
        const top = rect.top > bounds.height + 12 ? rect.top - bounds.height - 7 : rect.bottom + 7;
        tip.style.left = `${Math.max(12, Math.min(window.innerWidth - bounds.width - 12, left))}px`;
        tip.style.top = `${Math.max(12, Math.min(window.innerHeight - bounds.height - 12, top))}px`;
        if (touch) tipTimer = window.setTimeout(hideTip, 3000);
    }

    function setExplain(enabled) {
        explaining = enabled;
        game.classList.toggle("is-explaining", enabled);
        explainButton?.setAttribute("aria-pressed", String(enabled));
        hideTip();
    }

    function openDialog(title, html) {
        hideTip();
        returnFocus = document.activeElement;
        dialogTitle.textContent = title;
        dialogBody.innerHTML = html;
        if (!modal.open) modal.showModal();
        dialogClose.focus();
    }

    function closeDialog() {
        if (modal.open) modal.close();
    }

    function showHelp() {
        setExplain(false);
        openDialog("Help · 出神入画", `
            <p>2–8 人合作，在杂乱的线条中发现图像。画板(✏️)只能描深已有线段；你们要一起找出无人画过的干扰词。</p>
            <h3>一轮的四个阶段</h3><ol>
            <li><strong>秘密词语(🔒)与 Ready：</strong>4–8 人每人一词，2–3 人每人两词。阅读任务后各自按 Ready；所有人准备好才同时开始。</li>
            <li><strong>描画与时间(⏳)：</strong>标准为 2 分钟。用 Pen(✏️)沿预设短线段描画，禁止文字、字母、数字，以及额外口头或手势暗示。双词画在同一张板上，不标注分区。可选两面中的一面，并以任意四分之一圈方向作画。</li>
            <li><strong>猜测与排除：</strong>公开所有画作，以及真实词和等量干扰词。按顺序每人排除一个认为无人画出的词；2–3 人轮流两圈。不要交流额外线索。自己知道的词也会出现在候选中，谨慎判断。每次排除的正误暂时保密。</li>
            <li><strong>认领与回顾：</strong>所有排除结束后统一揭晓归属，每误排一个真实词计一个错误(❌)。所有人点击 Next Round 才继续；画板顺时针传给下一人，首位玩家顺移。</li></ol>
            <h3>合作胜负</h3><p>一局最多四轮。累计错误(❌)超过玩家人数时立即失败；四轮结束时错误不超过人数即全员获胜，<strong>错误刚好等于人数仍获胜</strong>。未排除的干扰词不另罚。最终结果保留供查看。</p>
            <h3>画笔与保存</h3><p>鼠标按住或单指滑动连续描线；触摸只在画板区域接管拖动。Eraser 擦除线段，Undo(↶)撤销最近一次操作。Flip(↔)换面会清除当前面笔迹，可立即 Undo 恢复；Rotate(↻)连同笔迹旋转 90°。固定笔宽，无自由绘画或填充。</p><p>画稿自动保存，刷新恢复服务器收到的最新画稿，撤销历史不会保留。Submit 锁定画稿；全员提前提交可提前结束，超时自动使用最后保存的画稿。断线不停止绘画计时，轮末确认则必须由本人重连完成。</p>
            <h3>线上配置与原创内容</h3><p>2 minutes 为标准计时。3 minutes 与 Untimed 是线上练习便利选项。Easy／Hard 使用不同难度的原创中英词库；画板由程序生成，未复制商业画板、美术或完整词卡。练习机器人只按自身词语与公开画作行动，能力有限。</p>
            <h3>查看与操作</h3><p>点画作放大；点词卡后选择 Eliminate 或 Cancel。点击空白或按 Esc 取消未确认选择。轮末 Next Round 不再二次确认，每个席位分别确认，机器人只确认自己。旁观者可看公开进度和画廊，无法查看秘密词或未提交画稿。</p><p>Help 显示规则。Explain 之后点选画板、词卡、指标或按钮看解释，包括禁用按钮；此模式不会执行游戏操作，解释后自动退出，也可按 Esc。指标上的图标均配文字：词语(🔒)、时间(⏳)、画板(✏️)、错误(❌)。电脑悬停或键盘聚焦可查看说明；手机点按显示三秒提示。</p>`);
    }

    function lineSVG(lines, active, angle, label) {
        const ink = new Set(active || []);
        return `<svg viewBox="0 0 1000 1000" role="img" aria-label="${escapeHTML(label)}"><g transform="${svgTransform(angle || 0)}">${(lines || []).map((line, index) => `<line x1="${line[0]}" y1="${line[1]}" x2="${line[2]}" y2="${line[3]}" class="mind-base-line${ink.has(index) ? " is-ink" : ""}"/>`).join("")}</g></svg>`;
    }

    function renderBoard() {
        const lines = view?.your_board?.sides?.[side] || [];
        const identity = `${drawingIdentity}:${side}`;
        if (baseIdentity !== identity) {
            board.innerHTML = `<g>${lines.map((line, index) => `<line data-mind-line="${index}" x1="${line[0]}" y1="${line[1]}" x2="${line[2]}" y2="${line[3]}" class="mind-base-line"/>`).join("")}</g>`;
            baseIdentity = identity;
        }
        board.querySelector("g")?.setAttribute("transform", svgTransform(rotation));
        for (const line of board.querySelectorAll("[data-mind-line]")) {
            line.classList.toggle("is-ink", selected.has(Number(line.dataset.mindLine)));
        }
    }

    function setDraftStatus() {
        const status = byId("DraftStatus");
        if (!view?.your_board) status.textContent = "Spectating";
        else if (!connected()) status.textContent = "Reconnecting · Your draft is preserved";
        else if (own()?.submitted) status.textContent = `Locked · ${selected.size} lines`;
        else if (view.phase === "ready") status.textContent = `Side ${side + 1} · Original line board`;
        else if (remaining() <= 0) status.textContent = "Time ended · Waiting for the gallery";
        else if (dirty || (view.your_drawing?.seq ?? -1) < sequence) status.textContent = `Saving… · ${selected.size} lines`;
        else status.textContent = `Saved · ${selected.size} lines`;
    }

    function renderButtons() {
        const drawing = canDraw();
        for (const id of ["Pen", "Eraser", "Flip", "Rotate"]) byId(id).disabled = !drawing;
        byId("Undo").disabled = !drawing || !history.length;
        byId("Pen").setAttribute("aria-pressed", String(tool === "pen"));
        byId("Eraser").setAttribute("aria-pressed", String(tool === "eraser"));
        byId("Submit").disabled = !legal("submit_drawing") || !drawing;
        byId("Submit").textContent = pending?.action === "submit_drawing" ? "Submitting…" : own()?.submitted ? "Submitted" : "Submit";
        byId("Submit").hidden = view?.phase === "ready" || !view?.your_board;
        byId("Ready").hidden = view?.phase !== "ready" || !view?.your_board;
        byId("Ready").disabled = !legal("ready");
        byId("Ready").textContent = own()?.ready ? "Ready ✓" : pending?.action === "ready" ? "Sending…" : "Ready";
        board.classList.toggle("is-locked", !drawing);
        board.classList.toggle("is-erasing", drawing && tool === "eraser");
        const cover = byId("BoardCover");
        cover.hidden = drawing || (view?.phase === "drawing" && own()?.submitted);
        if (!connected()) cover.innerHTML = "<strong>Reconnecting…</strong><span>Your draft is preserved.</span>";
        else if (!view?.your_board) cover.innerHTML = "<strong>✏️</strong><span>The artists are at work.</span>";
        else if (view?.phase === "ready") cover.innerHTML = `<strong>${own()?.ready ? "Ready ✓" : "Find your picture."}</strong><span>${own()?.ready ? "Waiting for all artists" : "Read your words, then press Ready"}</span>`;
        else if (remaining() <= 0) cover.innerHTML = "<strong>Time is up.</strong><span>Your latest saved drawing is locked.</span>";
        setDraftStatus();
    }

    function updateClock() {
        if (!view) return;
        const timer = byId("Clock");
        if (timer) {
            const seconds = Math.ceil(remaining() / 1000);
            const duration = view.config?.draw_seconds ?? 120;
            timer.textContent = duration === 0 ? "⏳ Untimed" : view.phase === "drawing" ? `⏳ ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : `⏳ ${duration / 60} min${duration !== 120 ? " · Practice" : ""}`;
            timer.classList.toggle("is-urgent", view.phase === "drawing" && seconds <= 20);
        }
        if (view.phase !== "drawing") return;
        if (dirty && remaining() > 0 && remaining() < 500) saveDraft(true);
        const expired = remaining() <= 0;
        if (expired !== localClockExpired) {
            localClockExpired = expired;
            if (expired) finishPointer(false);
            renderButtons();
        }
    }

    function playersHTML() {
        return (view?.players || []).map(player => {
            const done = view.phase === "ready" ? player.ready : view.phase === "drawing" ? player.submitted : player.next_round_ready;
            const state = view.phase === "ready" ? (done ? "Ready ✓" : "Reading") : view.phase === "drawing" ? (done ? "Submitted ✓" : "Drawing") : view.phase === "oracle" ? (view.current_turn === player.player_id ? "Your turn" : "Watching") : view.phase === "game_over" ? "Finished" : (done ? "Reviewed ✓" : "Reviewing");
            return `<div class="mind-player${player.player_id === view.you ? " is-you" : ""}" tabindex="0" data-mind-explain="player" data-mind-tip="${escapeHTML(explanations.player)}"><span class="mind-player-name">${escapeHTML(player.name)}${player.player_id === view.you ? " · You" : ""}${player.is_bot ? " · Bot" : ""}</span><span class="mind-player-state${done ? " is-done" : ""}">${state}</span></div>`;
        }).join("");
    }

    function renderGallery() {
        const drawings = view.drawings || [];
        const signature = JSON.stringify([context, drawings]);
        if (signature === gallerySignature) return;
        gallerySignature = signature;
        const gallery = byId("Gallery");
        gallery.classList.toggle("has-many", drawings.length > 4);
        gallery.innerHTML = drawings.map(drawing => `<button type="button" class="mind-gallery-card" data-mind-drawing="${escapeHTML(drawing.player_id)}" data-mind-explain="gallery" aria-label="Enlarge ${escapeHTML(name(drawing.player_id))}'s drawing">${lineSVG(drawing.lines, drawing.segments, drawing.rotation, `${name(drawing.player_id)}'s drawing`)}<span class="mind-gallery-caption"><span class="mind-gallery-name">${escapeHTML(name(drawing.player_id))}${drawing.player_id === view.you ? " · You" : ""}</span>${drawing.words ? `<span class="mind-gallery-words">${drawing.words.map(word => `${escapeHTML(word.zh)} · ${escapeHTML(word.en)}`).join(" / ")}</span>` : ""}</span></button>`).join("");
    }

    function renderCards() {
        const cards = view.cards || [], isResult = ["round_result", "game_over"].includes(view.phase);
        if (chosenCard && (!cards.some(card => card.id === chosenCard && !card.eliminated_by) || !legal("eliminate"))) chosenCard = null;
        byId("CardsHeading").textContent = isResult ? "The reveal" : "The oracle";
        byId("Remaining").textContent = `${cards.filter(card => !card.eliminated_by).length} / ${cards.length} remain`;
        const previousScroll = byId("Cards").scrollTop;
        byId("Cards").innerHTML = cards.map(card => {
            const removed = !!card.eliminated_by, mistake = isResult && removed && !!card.owner_id;
            const correct = isResult && removed && !card.owner_id, chosen = chosenCard === card.id;
            const owner = isResult ? (card.owner_id ? name(card.owner_id) : "Decoy") : "";
            return `<div class="mind-card${removed ? " is-eliminated" : ""}${mistake ? " is-error" : ""}${correct ? " is-safe" : ""}${chosen ? " is-selected" : ""}"><button type="button" class="mind-word-choice" data-mind-card="${escapeHTML(card.id)}" data-mind-explain="${isResult ? "result" : "card"}" aria-pressed="${chosen}" ${removed || !legal("eliminate") || isResult ? "disabled" : ""}>${cardMarkup(card)}</button>${removed || isResult ? `<div class="mind-card-owner">${mistake ? "❌ " : correct ? "✓ " : ""}${escapeHTML(owner)}${removed ? `${owner ? " · " : ""}Eliminated by ${escapeHTML(name(card.eliminated_by))}` : ""}</div>` : ""}${chosen ? `<div class="mind-card-confirm"><button type="button" class="mind-primary" data-mind-action="eliminate" data-mind-explain="eliminate">Eliminate</button><button type="button" data-mind-action="cancel" data-mind-explain="cancel">Cancel</button></div>` : ""}</div>`;
        }).join("");
        byId("Cards").scrollTop = previousScroll;
    }

    function renderReview() {
        const result = ["round_result", "game_over"].includes(view.phase);
        if (!result) { byId("Review").innerHTML = ""; return; }
        const count = view.last_round_summary?.errors ?? 0;
        const final = view.phase === "game_over", won = view.success ?? view.outcome === "win";
        byId("Review").innerHTML = `<strong data-mind-explain="result">${final ? (won ? "✨ You saw the bigger picture." : "A little lost in the lines.") : `Round ${view.round} complete`}</strong><p>${count} error${count === 1 ? "" : "s"} this round · ${view.errors} / ${view.error_limit} total.${final ? (won ? " Your team wins!" : " The error limit was exceeded.") : ""}</p>${final ? "" : `<button id="mindTheLinesNextRound" type="button" class="mind-primary" data-mind-action="next_round" data-mind-explain="next" ${legal("next_round") ? "" : "disabled"}>${own()?.next_round_ready ? "Waiting for everyone…" : "Next Round"}</button><p class="mind-caption">${(view.players || []).filter(player => player.next_round_ready).length} / ${playerCount()} reviewed</p>`}`;
    }

    function render() {
        if (!view) return;
        const editing = ["ready", "drawing"].includes(view.phase);
        byId("EditorLayout").hidden = !editing;
        byId("OracleLayout").hidden = editing;
        byId("ResultPlayers").hidden = editing;
        byId("Stats").innerHTML = stat(`✏️ Round ${view.round} / ${view.total_rounds || 4}`, "round") + stat(`❌ ${view.errors} / ${view.error_limit}`, "errors") + stat("⏳", "timer", "mindTheLinesClock");
        const readyCount = (view.players || []).filter(player => player.ready).length;
        const submittedCount = (view.players || []).filter(player => player.submitted).length;
        const status = view.phase === "ready" ? `Read your secret words · ${readyCount} / ${playerCount()} ready` : view.phase === "drawing" ? `${own()?.submitted ? "Your drawing is locked" : view.you ? "Follow the lines. Find your picture." : "The artists are drawing"} · ${submittedCount} / ${playerCount()} submitted` : view.phase === "oracle" ? `${view.current_turn === view.you ? "Your turn" : `${name(view.current_turn)}'s turn`} · Eliminate a word nobody drew` : view.phase === "game_over" ? (view.success || view.outcome === "win" ? "Team victory · Four rounds completed" : "Game over · The error limit was exceeded") : "The words are revealed · Review the drawings together";
        byId("Status").textContent = status;
        if (editing) {
            const words = view.your_words || [];
            byId("Words").innerHTML = words.length ? `<span class="mind-secret-label" tabindex="0" data-mind-explain="words" data-mind-tip="${escapeHTML(explanations.words)}">🔒 ${words.length === 1 ? "Your word" : "Your words"}</span>${words.map(word => `<span class="mind-word">${cardMarkup(word)}</span>`).join("")}` : '<span class="mind-secret-label">Spectator · Secret words stay private</span>';
            byId("StageTitle").textContent = view.phase === "ready" ? "A little imagination." : own()?.submitted ? "Your picture is in." : "Make the lines speak.";
            byId("StageHint").textContent = view.phase === "ready" ? (view.words_per_player === 2 ? "Two words. One board. Everyone starts together." : "One secret word. Everyone starts together.") : own()?.submitted ? "Wait for the other artists, then find the decoys." : "Trace the pale lines. Your drawing saves as you go.";
            byId("Players").innerHTML = playersHTML();
            renderBoard();
            renderButtons();
        } else {
            renderGallery();
            renderCards();
            renderReview();
            byId("ResultPlayers").innerHTML = playersHTML();
        }
        updateClock();
    }

    function emit(action) {
        if (typeof sendAction === "function") sendAction(action);
    }

    function saveDraft(immediate = false) {
        if (!dirty || !canDraw()) return;
        window.clearTimeout(saveTimer);
        const delay = 350 - (Date.now() - lastSaveTime);
        if (!immediate && delay > 0) {
            saveTimer = window.setTimeout(() => saveDraft(true), delay);
            return;
        }
        dirty = false;
        sequence += 1;
        lastSaveTime = Date.now();
        emit({type: "save_drawing", round_token: view.round_token, ...snapshot(), seq: sequence});
        setDraftStatus();
    }

    function sendGameAction(action) {
        if (!legal(action)) return;
        if (action === "submit_drawing" && !canDraw()) return;
        const payload = {type: action, round_token: view.round_token};
        if (action === "eliminate") {
            if (!chosenCard) return;
            payload.card_id = chosenCard;
            payload.revision = view.revision;
        }
        if (action === "submit_drawing") {
            finishPointer(false);
            window.clearTimeout(saveTimer);
            sequence += 1;
            Object.assign(payload, snapshot(), {seq: sequence});
            dirty = false;
        }
        pending = {action, phase: view.phase, round_token: view.round_token, revision: view.revision};
        window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => { pending = null; render(); }, 8000);
        emit(payload);
        renderButtons();
        if (view.phase === "oracle") renderCards();
        if (view.phase === "round_result") renderReview();
    }

    function changed() {
        dirty = true;
        renderBoard();
        renderButtons();
        saveDraft();
    }

    function runTool(action) {
        if (!canDraw()) return;
        if (action === "pen" || action === "eraser") {
            tool = action;
            renderButtons();
            return;
        }
        finishPointer(true);
        if (action === "undo") {
            const previous = history.pop();
            if (!previous) return;
            selected = new Set(previous.segments);
            side = previous.side;
            rotation = previous.rotation;
        } else {
            history.push(snapshot());
            if (action === "flip") { side = 1 - side; selected = new Set(); }
            if (action === "rotate") rotation = (rotation + 1) % 4;
        }
        changed();
        saveDraft(true);
    }

    function pointFor(event) {
        const rect = board.getBoundingClientRect();
        let x = (event.clientX - rect.left) * 1000 / rect.width - 500;
        let y = (event.clientY - rect.top) * 1000 / rect.height - 500;
        for (let i = 0; i < rotation; i += 1) [x, y] = [y, -x];
        return {x: x + 500, y: y + 500};
    }

    function distanceToLine(point, line) {
        const dx = line[2] - line[0], dy = line[3] - line[1];
        const projection = Math.max(0, Math.min(1, ((point.x - line[0]) * dx + (point.y - line[1]) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(point.x - line[0] - projection * dx, point.y - line[1] - projection * dy);
    }

    function markNearest(point) {
        const lines = view.your_board.sides[side];
        let nearest = -1, distance = 17;
        lines.forEach((line, index) => {
            if (tool === "eraser" && !selected.has(index)) return;
            const nextDistance = distanceToLine(point, line);
            if (nextDistance < distance) { distance = nextDistance; nearest = index; }
        });
        if (nearest < 0 || (tool === "pen" && selected.has(nearest))) return false;
        if (!strokeChanged) { history.push(strokeSnapshot); strokeChanged = true; }
        if (tool === "eraser") selected.delete(nearest);
        else selected.add(nearest);
        return true;
    }

    function drawTo(point) {
        if (!canDraw()) { finishPointer(false); return; }
        const start = previousPoint || point;
        const steps = Math.max(1, Math.ceil(Math.hypot(point.x - start.x, point.y - start.y) / 7));
        let anyChange = false;
        for (let step = 1; step <= steps; step += 1) {
            anyChange = markNearest({x: start.x + (point.x - start.x) * step / steps, y: start.y + (point.y - start.y) * step / steps}) || anyChange;
        }
        previousPoint = point;
        if (anyChange) changed();
    }

    function finishPointer(save = true) {
        if (pointerId !== null && board.hasPointerCapture?.(pointerId)) board.releasePointerCapture(pointerId);
        pointerId = null;
        previousPoint = null;
        strokeChanged = false;
        strokeSnapshot = null;
        if (save) saveDraft(true);
    }

    board.addEventListener("pointerdown", event => {
        if (explaining || event.button !== 0 || !canDraw() || pointerId !== null) return;
        event.preventDefault();
        pointerId = event.pointerId;
        strokeSnapshot = snapshot();
        strokeChanged = false;
        previousPoint = null;
        board.setPointerCapture(pointerId);
        drawTo(pointFor(event));
    });
    board.addEventListener("pointermove", event => {
        if (event.pointerId !== pointerId) return;
        event.preventDefault();
        const samples = event.getCoalescedEvents?.() || [];
        for (const sample of samples.length ? samples : [event]) drawTo(pointFor(sample));
    });
    board.addEventListener("pointerup", event => {
        if (event.pointerId !== pointerId) return;
        event.preventDefault();
        drawTo(pointFor(event));
        finishPointer(true);
    });
    board.addEventListener("pointercancel", event => { if (event.pointerId === pointerId) finishPointer(true); });
    board.addEventListener("lostpointercapture", event => { if (event.pointerId === pointerId) finishPointer(true); });

    panel.addEventListener("click", event => {
        if (explaining) return;
        const action = event.target.closest("[data-mind-action]");
        if (action && !action.disabled) {
            const type = action.dataset.mindAction;
            if (["pen", "eraser", "undo", "flip", "rotate"].includes(type)) runTool(type);
            else if (type === "cancel") { chosenCard = null; renderCards(); }
            else sendGameAction(type);
            return;
        }
        const word = event.target.closest("[data-mind-card]");
        if (word && !word.disabled && legal("eliminate")) {
            chosenCard = chosenCard === word.dataset.mindCard ? null : word.dataset.mindCard;
            renderCards();
            return;
        }
        const drawingElement = event.target.closest("[data-mind-drawing]");
        if (drawingElement) {
            chosenCard = null;
            renderCards();
            const drawing = view.drawings.find(item => item.player_id === drawingElement.dataset.mindDrawing);
            if (drawing) openDialog(`${name(drawing.player_id)} · Gallery`, lineSVG(drawing.lines, drawing.segments, drawing.rotation, `${name(drawing.player_id)}'s enlarged drawing`) + (drawing.words ? `<p>${drawing.words.map(word => `${escapeHTML(word.zh)} · ${escapeHTML(word.en)}`).join(" / ")}</p>` : ""));
            return;
        }
        const badge = event.target.closest("[data-mind-tip]");
        if (badge && pointerType !== "mouse") showTip(badge.dataset.mindTip, badge, true);
        if (chosenCard && !event.target.closest(".mind-card")) { chosenCard = null; renderCards(); }
    });

    function exempt(target) {
        return target === helpButton || target === explainButton || target === dialogClose || modal.contains(target);
    }

    document.addEventListener("pointerdown", event => {
        pointerType = event.pointerType || "mouse";
        if (!explaining) suppressClickUntil = 0;
        if (!explaining || exempt(event.target)) return;
        let target = event.target.closest("[data-mind-explain]");
        if (!target) {
            for (const item of panel.querySelectorAll("[data-mind-explain]")) {
                const rect = item.getBoundingClientRect();
                if (rect.width && rect.height && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) { target = item; break; }
            }
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClickUntil = Date.now() + 650;
        if (target) {
            const text = explanations[target.dataset.mindExplain];
            setExplain(false);
            if (text) openDialog("Explain", `<p>${escapeHTML(text)}</p>`);
        }
    }, true);
    document.addEventListener("click", event => {
        if (exempt(event.target)) return;
        if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
        if (!explaining) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = event.target.closest("[data-mind-explain]");
        if (target && panel.contains(target)) {
            const text = explanations[target.dataset.mindExplain];
            setExplain(false);
            if (text) openDialog("Explain", `<p>${escapeHTML(text)}</p>`);
        }
    }, true);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            suppressClickUntil = 0;
            setExplain(false);
            hideTip();
            if (chosenCard) { chosenCard = null; renderCards(); }
            if (modal.open) closeDialog();
            return;
        }
        if (explaining && !exempt(event.target) && ["Enter", " "].includes(event.key)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const target = event.target.closest("[data-mind-explain]");
            if (target) {
                setExplain(false);
                openDialog("Explain", `<p>${escapeHTML(explanations[target.dataset.mindExplain] || "")}</p>`);
            }
        }
    }, true);
    panel.addEventListener("pointerover", event => {
        if (event.pointerType !== "mouse") return;
        const target = event.target.closest("[data-mind-tip]");
        if (target) showTip(target.dataset.mindTip, target);
    });
    panel.addEventListener("pointerout", event => {
        const target = event.target.closest("[data-mind-tip]");
        if (event.pointerType === "mouse" && target && !target.contains(event.relatedTarget)) hideTip();
    });
    panel.addEventListener("focusin", event => {
        const target = event.target.closest("[data-mind-tip]");
        if (target && pointerType === "mouse") showTip(target.dataset.mindTip, target);
    });
    panel.addEventListener("focusout", hideTip);
    helpButton?.addEventListener("click", showHelp);
    explainButton?.addEventListener("click", () => setExplain(!explaining));
    dialogClose.addEventListener("click", closeDialog);
    modal.addEventListener("click", event => {
        if (event.target !== modal) return;
        const rect = modal.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
    });
    modal.addEventListener("close", () => { if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus(); });
    window.addEventListener("pagehide", () => saveDraft(true));
    window.addEventListener("scroll", hideTip, {passive: true, capture: true});
    window.addEventListener("resize", hideTip);

    function clearState() {
        window.clearTimeout(saveTimer);
        window.clearTimeout(pendingTimer);
        window.clearInterval(timerId);
        timerId = null;
        finishPointer(false);
        view = null;
        context = drawingIdentity = baseIdentity = gallerySignature = null;
        selected = new Set();
        history = [];
        side = rotation = 0;
        sequence = -1;
        dirty = false;
        awaitingResync = false;
        localClockExpired = false;
        suppressClickUntil = 0;
        pending = chosenCard = null;
        setExplain(false);
        closeDialog();
        hideTip();
    }

    window.renderMindTheLinesGameState = data => {
        const next = data?.view || data;
        if (!next?.players || next.game_id !== "mind_the_lines") return;
        if (typeof currentGameType !== "undefined" && currentGameType !== "mind_the_lines") return;
        if (data?.room_id && typeof currentRoomState !== "undefined" && currentRoomState?.room_id !== data.room_id) return;
        const nextContext = JSON.stringify([data?.room_id, next.round_token, next.phase]);
        const newDrawingIdentity = JSON.stringify([data?.room_id, next.round_token, next.your_board?.id]);
        if (nextContext !== context) {
            finishPointer(false);
            chosenCard = null;
            pending = null;
            context = nextContext;
            hideTip();
        }
        if (pending && (pending.round_token !== next.round_token || pending.phase !== next.phase || !next.legal_actions?.includes(pending.action) || pending.action === "eliminate" && pending.revision !== next.revision)) pending = null;
        if (!pending) window.clearTimeout(pendingTimer);
        view = next;
        awaitingResync = false;
        if (Number.isFinite(next.server_now_ms)) serverOffset = next.server_now_ms - Date.now();
        const serverDrawing = next.your_drawing;
        if (newDrawingIdentity !== drawingIdentity) {
            drawingIdentity = newDrawingIdentity;
            selected = new Set(serverDrawing?.segments || []);
            side = serverDrawing?.side || 0;
            rotation = serverDrawing?.rotation || 0;
            sequence = serverDrawing?.seq ?? -1;
            history = [];
            dirty = false;
            window.clearTimeout(saveTimer);
            tool = "pen";
        } else if (serverDrawing && (serverDrawing.seq ?? -1) > sequence && pointerId === null && !dirty) {
            selected = new Set(serverDrawing.segments || []);
            side = serverDrawing.side || 0;
            rotation = serverDrawing.rotation || 0;
            sequence = serverDrawing.seq;
        }
        if (serverDrawing && dirty) sequence = Math.max(sequence, serverDrawing.seq ?? -1);
        render();
        if (dirty && canDraw()) saveDraft();
        if (!timerId) timerId = window.setInterval(updateClock, 200);
        if (typeof logGameEvents === "function") logGameEvents(data);
    };
    window.showMindTheLinesHeaderActions = visible => {
        if (header) header.style.display = visible ? "flex" : "none";
        if (!visible) {
            clearState();
            byId("ConfigBox")?.classList.add("hidden");
        } else window.updateMindTheLinesConfigUI();
    };
    window.clearMindTheLinesState = clearState;
    window.getMindTheLinesConfig = () => ({difficulty: byId("Difficulty")?.value || "easy", draw_seconds: Number(byId("Duration")?.value ?? 120)});
    window.updateMindTheLinesConfigUI = () => {
        const visible = typeof currentGameType !== "undefined" && currentGameType === "mind_the_lines" && typeof currentRoomState !== "undefined" && currentRoomState?.status === "lobby";
        byId("ConfigBox")?.classList.toggle("hidden", !visible);
    };
    function connectEvents() {
        if (typeof socket === "undefined") return;
        socket.on("system:error", () => {
            if (pending) { pending = null; window.clearTimeout(pendingTimer); render(); }
        });
        const syncRoomConfig = state => {
            if (state?.game_type !== "mind_the_lines") {
                byId("ConfigBox")?.classList.add("hidden");
                return;
            }
            const signature = JSON.stringify([state.room_id, state.game_config?.difficulty, state.game_config?.draw_seconds]);
            if (signature !== configSignature) {
                if (byId("Difficulty")) byId("Difficulty").value = state.game_config?.difficulty || "easy";
                if (byId("Duration")) byId("Duration").value = String(state.game_config?.draw_seconds ?? 120);
                configSignature = signature;
            }
            window.updateMindTheLinesConfigUI();
        };
        socket.on("room:state", syncRoomConfig);
        socket.on("disconnect", () => {
            awaitingResync = true;
            if (view?.your_drawing && sequence > (view.your_drawing.seq ?? -1)) dirty = true;
            finishPointer(false);
            window.clearTimeout(saveTimer);
            window.clearTimeout(pendingTimer);
            pending = null;
            hideTip();
            render();
        });
        socket.on("connect", () => {
            if (!view) return;
            awaitingResync = true;
            pending = null;
            render();
        });
        if (typeof currentRoomState !== "undefined") syncRoomConfig(currentRoomState);
        if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "mind_the_lines") window.renderMindTheLinesGameState(lastGameStatePayload);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connectEvents, {once: true});
    else connectEvents();
})();
