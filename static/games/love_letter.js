(() => {
    "use strict";

    const panel = document.getElementById("loveLetterPanel");
    const header = document.getElementById("loveLetterHeaderActions");
    const helpButton = document.getElementById("loveLetterHelpBtn");
    const explainButton = document.getElementById("loveLetterExplainBtn");
    const cards = {
        1: ["卫兵", "Guard", "💂", 5, "猜中即淘汰", "选择另一名未受保护的玩家，猜测其手牌为 2–8，猜中则淘汰。不能猜卫兵(💂)。"],
        2: ["牧师", "Priest", "🔍", 2, "秘密查看手牌", "秘密查看另一名未受保护玩家的手牌。结果只会出现在你的私有情报里。"],
        3: ["男爵", "Baron", "⚔️", 2, "比牌，较小者出局", "与另一名未受保护玩家秘密比较剩余手牌。点数较小者淘汰，相等无人淘汰；仅双方可见比较的牌。"],
        4: ["侍女", "Handmaid", "🛡️", 2, "保护至下次回合", "直到你的下次回合开始，其他玩家不能用角色效果指定你。保护不会阻止轮末比较。"],
        5: ["王子", "Prince", "🤴", 2, "弃牌并重新抽牌", "指定任一可选玩家，包括自己，弃掉手牌再摸一张。弃公主(👸)立即淘汰且不摸牌。牌库空时摸暗置备用牌；其他人都受保护时必须选自己。"],
        6: ["国王", "King", "👑", 1, "交换双方手牌", "与另一名未受保护玩家交换剩余手牌。交换内容不公开。"],
        7: ["伯爵夫人", "Countess", "🌹", 1, "与王室同持必出", "同时持有王子(🤴)或国王(👑)时必须打出伯爵夫人(🌹)。也可主动打出，不会公开你是否被迫。"],
        8: ["公主", "Princess", "👸", 1, "弃掉即出局", "主动打出或被迫弃掉公主(👸)都会立刻淘汰。保留她到轮末可用最高点数 8 比较。"],
    };
    const explanations = {
        deck: "牌库(🂠)中的牌在每回合开始自动摸一张。最后一张摸走后，仍须完成本回合的角色效果，再进行轮末比较。",
        reserve: "备用牌(✉️)：每轮暗置一张，任何人都不知道。仅在王子(🤴)要求摸牌而牌库已空时使用。",
        tokens: "好感(❤️)：每轮胜者加一。2／3／4 人局分别需要 7／5／4 个；达到目标赢得整局。",
        discarded: "弃牌按从左到右的顺序公开。轮末手牌相同时比较这些弃牌的点数总和。被淘汰时弃掉的牌不发动效果。",
        player: "玩家席位显示好感(❤️)、保护(🛡️)、淘汰(💔)和已打出的牌。回合中其他人的手牌保持隐藏。",
        target: "选择本张牌的目标。受侍女(🛡️)保护或已经淘汰的玩家不可被其他人指定；仅王子(🤴)可以指定自己。",
        guess: "卫兵(💂)只能猜 2–8。猜测以角色为单位，与对方剩余手牌相同才会淘汰对方。",
        play: "Play Card 提交所选手牌及必要的目标／猜测。选项完整后才可提交；回合外、发送中或伯爵夫人(🌹)限制下的牌不可打出。",
        next: "Next Round 表示你已看过结果。所有席位（包括本轮已淘汰的人）分别确认后才开始；机器人只确认自己，断线真人仍须回来确认。",
        notes: "私有情报(🔒)只有你能看见。牌被查看、比较或交换时记录；目标再行动或换牌后标为历史观察，不代表现在的手牌。",
        reference: "角色参考显示点数与全副 16 张牌中的张数（×）。颜色和 Emoji 帮助区分角色；详细效果可通过 Explain 点选查看。",
        removed: "双人局每轮额外明置三张牌，不进入本轮牌库。它们独立于暗置备用牌(✉️)，也不属于任何玩家的弃牌。",
        result: "只剩一名玩家时直接获胜；牌库耗尽则比较存活者手牌，点数相同再比较弃牌总和，仍相同则共享本轮胜利，各获好感(❤️)。",
        log: "公开记录仅记出牌、目标、猜测和公开结果，不包含秘密看到的手牌。可在此区域滚动查看。",
    };
    let view = null, selected = null, target = null, guess = null, signature = null;
    let pending = false, pendingTimer = null, explaining = false, tipTimer = null;
    let suppressUntil = 0, returnFocus = null;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
    const name = id => view?.players.find(player => player.player_id === id)?.name || "—";
    const label = rank => `${cards[rank][2]} ${cards[rank][0]} ${rank}`;
    const explanation = key => key?.startsWith("card-") ? `${label(key.slice(5))}：${cards[key.slice(5)][5]}` : explanations[key];
    const info = (text, detail, key = "") => `<span tabindex="0" data-ll-tip="${esc(detail)}" ${key ? `data-ll-explain="${key}"` : ""}>${text}</span>`;
    const chip = rank => info(esc(label(rank)), cards[rank][5], `card-${rank}`);
    const allowed = type => !pending && view?.legal_actions.includes(type);

    const dialog = document.createElement("dialog");
    dialog.className = "ll-dialog";
    dialog.id = "loveLetterDialog";
    dialog.setAttribute("aria-labelledby", "loveLetterDialogTitle");
    dialog.innerHTML = '<div class="ll-dialog-heading"><h2 id="loveLetterDialogTitle">Help</h2><button type="button">Close</button></div><div class="ll-dialog-body"></div>';
    document.body.append(dialog);
    const dialogClose = dialog.querySelector("button");
    const tip = document.createElement("div");
    tip.className = "ll-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.append(tip);

    function hideTip() {
        tip.hidden = true;
        clearTimeout(tipTimer);
    }

    function showTip(anchor, temporary = false) {
        if (explaining || !anchor?.dataset.llTip) return;
        hideTip();
        tip.textContent = anchor.dataset.llTip;
        tip.hidden = false;
        const box = anchor.getBoundingClientRect(), size = tip.getBoundingClientRect();
        tip.style.left = `${Math.max(8, Math.min(box.left, innerWidth - size.width - 8))}px`;
        tip.style.top = `${Math.max(8, Math.min(box.top - size.height - 8 > 8 ? box.top - size.height - 8 : box.bottom + 8, innerHeight - size.height - 8))}px`;
        if (temporary) tipTimer = setTimeout(hideTip, 3000);
    }

    function setExplain(enabled) {
        explaining = enabled;
        panel.classList.toggle("ll-explaining", enabled);
        explainButton.setAttribute("aria-pressed", String(enabled));
        hideTip();
    }

    function openDialog(title, html) {
        hideTip();
        returnFocus = document.activeElement;
        dialog.querySelector("h2").textContent = title;
        dialog.querySelector(".ll-dialog-body").innerHTML = html;
        if (!dialog.open) dialog.showModal();
        dialogClose.focus();
    }

    function help() {
        setExplain(false);
        openDialog("Help · 情书", `
            <p>经典 16 张、2–4 人版本。让你的情书(💌)在轮末由地位最高的人保管，或成为唯一未淘汰的玩家。</p>
            <h3>每轮准备与回合</h3><p>洗牌后暗置一张备用牌(✉️)；双人局额外明置三张。每人一张手牌，轮到你时自动摸一张，从两张中打出一张并完整执行效果。弃牌始终公开且保留顺序。首轮随机先手，以后由上轮胜者先手；并列胜者中随机选择。</p>
            <div class="ll-help-cards">${Object.entries(cards).map(([rank, card]) => `<div><strong>${esc(label(rank))} · ${card[1]} ×${card[3]}</strong><p>${card[5]}</p></div>`).join("")}</div>
            <h3>目标与淘汰</h3><p>已淘汰的玩家不再行动，也不能被选为目标。卫兵(💂)、牧师(🔍)、男爵(⚔️)、国王(👑)没有可选目标时空放。王子(🤴)仍须选择自己。淘汰时剩余手牌公开弃掉且不发动效果。</p>
            <h3>轮末与胜利</h3><p>${explanations.result} 轮末会公开存活者手牌，保留结算供所有人查看。${explanations.tokens} 多人同时达到目标则共同获胜。</p>
            <h3>线上操作</h3><p>点选手牌，选择目标，卫兵(💂)还需要选择猜测，最后点击 Play Card。空白处或 Esc 取消未提交的选择；已提交的行动不能撤回。${explanations.next}</p>
            <h3>私有情报与图标</h3><p>${explanations.notes} ${explanations.deck} 保护(🛡️)持续到本人下次回合开始，淘汰(💔)持续到本轮结束，胜者用奖杯(🏆)标记。非操作图标支持鼠标悬停或触屏点击提示，触屏提示三秒后消失。</p>`);
    }

    function resetSelection() {
        selected = null;
        target = null;
        guess = null;
    }

    function renderPlayers() {
        return view.players.map(player => {
            const own = player.player_id === view.you;
            const active = player.player_id === view.current_turn;
            const revealed = player.revealed_hand.map(chip).join("");
            const status = !player.alive ? info("💔 Out", player.eliminated_by, "player")
                : player.protected ? info("🛡️ Protected", cards[4][5], "card-4")
                : info(`${player.hand_count} 🂠`, "当前持有的手牌数量；其他人的手牌保密。", "player");
            return `<article class="ll-player ${active ? "is-current" : ""} ${!player.alive ? "is-out" : ""}" data-ll-explain="player">
                <div class="ll-player-heading"><strong>${esc(player.name)}${own ? ' <small>You</small>' : ""}</strong>${info(`❤️ ${player.tokens}`, explanations.tokens, "tokens")}</div>
                <div class="ll-player-status">${status}${active ? '<b>Playing</b>' : ""}${view.next_ready.includes(player.player_id) ? '<b>Ready</b>' : ""}</div>
                ${revealed ? `<div class="ll-revealed">${revealed}</div>` : ""}
                <div class="ll-discards" data-ll-explain="discarded">${player.discards.length ? player.discards.map(chip).join("") : '<small>No discards</small>'}</div>
            </article>`;
        }).join("");
    }

    function renderHand() {
        if (!view.your_hand.length) return '<p class="ll-muted">本轮已淘汰，下一轮重新加入。</p>';
        return `<div class="ll-hand">${view.your_hand.map((rank, index) => {
            const card = cards[rank], enabled = allowed("play_card") && view.playable_cards.includes(rank);
            return `<button type="button" class="ll-card ll-rank-${rank} ${selected === rank ? "is-selected" : ""}" data-ll-card="${rank}" data-ll-explain="card-${rank}" aria-pressed="${selected === rank}" ${!enabled ? "disabled" : ""}>
                <span class="ll-card-top"><b>${rank}</b><small>${index === 1 ? "Drawn" : "Held"} · ×${card[3]}</small></span>
                <span class="ll-card-icon" aria-hidden="true">${card[2]}</span><strong>${card[0]}</strong><span class="ll-card-en">${card[1]}</span><span class="ll-card-caption">${card[4]}</span>
            </button>`;
        }).join("")}</div>`;
    }

    function renderChoice() {
        if (!allowed("play_card") && !pending) return "";
        const targets = view.targets[String(selected)] || [];
        const needsGuess = selected === 1 && targets.length > 0;
        const ready = selected !== null && (!targets.length || targets.includes(target)) && (!needsGuess || guess !== null);
        let html = '<div class="ll-choice">';
        if (selected !== null && targets.length) {
            html += `<div class="ll-option-label">Target</div><div class="ll-targets">${view.players.map(player => `<button type="button" data-ll-target="${esc(player.player_id)}" data-ll-explain="target" aria-pressed="${target === player.player_id}" ${!targets.includes(player.player_id) || pending ? "disabled" : ""}>${esc(player.name)}${player.player_id === view.you ? " · You" : ""}${player.protected ? " 🛡️" : !player.alive ? " 💔" : ""}</button>`).join("")}</div>`;
        } else if ([1, 2, 3, 6].includes(selected)) {
            html += '<p class="ll-muted">其他玩家均受保护，本张牌将空放。</p>';
        }
        if (needsGuess) html += `<div class="ll-option-label">Guess</div><div class="ll-guesses">${Object.keys(cards).slice(1).map(rank => `<button type="button" data-ll-guess="${rank}" data-ll-explain="card-${rank}" aria-pressed="${guess === Number(rank)}" ${pending ? "disabled" : ""}>${esc(label(rank))}</button>`).join("")}</div>`;
        html += `<div class="ll-confirm"><span>${selected ? esc(label(selected)) : "选择一张手牌"}</span><button type="button" class="ll-primary" data-ll-action="play" data-ll-explain="play" ${!ready || pending ? "disabled" : ""}>${pending ? "Sending…" : "Play Card"}</button></div></div>`;
        return html;
    }

    function renderResult() {
        const summary = view.round_summary;
        if (!summary) return "";
        const reasons = {last_survivor: "唯一存活者", highest_card: "手牌点数最高", discard_total: "手牌同分，以弃牌总和胜出", shared_win: "手牌与弃牌总和均相同，共享胜利"};
        return `<section class="ll-result" data-ll-explain="result"><div class="ll-section-title"><h3>${view.game_over ? "Game Over" : "Round Review"}</h3>${info("🏆", "本轮或整局的胜者。", "result")}</div>
            <strong>${esc((view.game_over ? view.winner : summary.winners).map(name).join(" / "))}</strong><p>${reasons[summary.reason]} · ${info("❤️ +1", explanations.tokens, "tokens")}</p>
            <div class="ll-result-rows">${summary.players.map(player => `<div><span>${esc(name(player.player_id))}</span><span>${player.alive ? player.hand.map(chip).join(" ") : info("💔 Out", "本轮已淘汰，不参与轮末比较。", "player")}</span><span>弃牌 ${player.discard_total}</span><b>${info(`❤️ ${player.tokens}`, explanations.tokens, "tokens")}</b></div>`).join("")}</div>
            ${!view.game_over ? `<div class="ll-confirm"><span>Ready ${view.next_ready.length} / ${view.players.length}</span><button type="button" class="ll-primary" data-ll-action="next" data-ll-explain="next" ${!allowed("next_round") ? "disabled" : ""}>${view.next_ready.includes(view.you) ? "Waiting…" : "Next Round"}</button></div>` : ""}</section>`;
    }

    function render() {
        if (!view) return;
        const oldScroll = panel.querySelector(".ll-log")?.scrollTop || 0;
        const own = view.players.find(player => player.player_id === view.you);
        const notes = view.private_notes.slice().reverse();
        let status = view.game_over ? "对局结束" : view.phase === "round_end" ? "查看结果，确认后继续"
            : view.current_turn === view.you ? "轮到你了 · 选择一张手牌打出" : `等待 ${name(view.current_turn)} 出牌`;
        if (view.playable_cards.length === 1 && view.playable_cards[0] === 7) status = "必须打出伯爵夫人 🌹";
        panel.innerHTML = `<div class="ll-surface">
            <div class="ll-banner"><div><span class="ll-eyebrow">THE ROYAL COURT · CLASSIC 16</span><h2>${info("💌", "情书：让你的信件送达公主。", "result")} 情书 <small>Love Letter</small></h2></div><div class="ll-round">Round <b>${view.round}</b></div></div>
            <div class="ll-stats">${info(`🂠 ${view.deck_count} Deck`, explanations.deck, "deck")}${info(`✉️ ${view.reserve_count} Reserve`, explanations.reserve, "reserve")}${info(`❤️ ${view.token_goal} to win`, explanations.tokens, "tokens")}</div>
            <div class="ll-status" role="status" aria-live="polite">${status.includes("伯爵夫人") ? info(esc(status), cards[7][5], "card-7") : esc(status)}</div>
            <div class="ll-layout"><main class="ll-main"><div class="ll-players">${renderPlayers()}</div>${renderResult()}
                ${view.phase === "play" ? `<section class="ll-box"><div class="ll-section-title"><h3>Your Letter</h3><span>${own?.alive ? "Private hand" : "Out this round"}</span></div>${renderHand()}${renderChoice()}</section>` : ""}
                ${notes.length ? `<section class="ll-box ll-notes" data-ll-explain="notes"><h3>${info("🔒", explanations.notes, "notes")} Private Intel</h3><div class="ll-notes-list">${notes.map(note => `<div><span>${esc(name(note.target))} · ${chip(note.card)}</span><small>Turn ${note.turn} · ${note.current ? "未发生换牌行动" : "历史观察，可能已换牌"}</small></div>`).join("")}</div></section>` : ""}
            </main><aside class="ll-sidebar"><section class="ll-box"><div class="ll-section-title"><h3>Court Reference</h3>${info("16 cards", explanations.reference, "reference")}</div><div class="ll-reference">${Object.entries(cards).map(([rank, card]) => `<div class="ll-reference-row ll-rank-${rank}" tabindex="0" data-ll-explain="card-${rank}" data-ll-tip="${esc(card[5])}"><b>${rank}</b><span>${card[2]} ${card[0]}</span><small>×${card[3]}</small></div>`).join("")}</div>
                ${view.removed.length ? `<div class="ll-removed" data-ll-explain="removed"><small>Set Aside · Face Up</small><div class="ll-discards">${view.removed.map(chip).join("")}</div></div>` : ""}</section>
                <section class="ll-box" data-ll-explain="log"><h3>Round Log</h3><div class="ll-log">${view.log.slice().reverse().map(entry => `<p><small>R${entry.round} · T${entry.turn}</small>${esc(entry.text)}</p>`).join("")}</div></section>
            </aside></div></div>`;
        panel.querySelector(".ll-log").scrollTop = oldScroll;
    }

    function submit(action) {
        if (pending) return;
        pending = true;
        hideTip();
        render();
        sendAction(action);
        pendingTimer = setTimeout(() => { pending = false; render(); }, 5000);
    }

    panel.addEventListener("click", event => {
        if (explaining || !view) return;
        const button = event.target.closest("button");
        if (button && !button.disabled) {
            if (button.dataset.llCard && allowed("play_card")) {
                const rank = Number(button.dataset.llCard);
                if (selected === rank) resetSelection();
                else { selected = rank; target = null; guess = null; }
                const targets = view.targets[String(selected)] || [];
                if (targets.length === 1) target = targets[0];
                render();
            } else if (button.dataset.llTarget) { target = button.dataset.llTarget; render(); }
            else if (button.dataset.llGuess) { guess = Number(button.dataset.llGuess); render(); }
            else if (button.dataset.llAction === "next" && allowed("next_round")) submit({type: "next_round", round: view.round});
            else if (button.dataset.llAction === "play" && allowed("play_card") && selected !== null) {
                const action = {type: "play_card", round: view.round, turn: view.turn, card: selected};
                if (target) action.target = target;
                if (selected === 1 && target) action.guess = guess;
                submit(action);
            }
            return;
        }
        const anchor = event.target.closest("[data-ll-tip]");
        if (anchor) showTip(anchor, true);
        else if (!button && selected !== null && !pending) { resetSelection(); render(); }
    });

    function explainAt(event) {
        let element = event.target.closest("[data-ll-explain]");
        if (!element && event.type === "pointerdown") {
            element = [...panel.querySelectorAll("button:disabled[data-ll-explain]")].find(button => {
                const rect = button.getBoundingClientRect();
                return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
            });
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (element) {
            const text = explanation(element.dataset.llExplain);
            setExplain(false);
            if (event.type === "pointerdown") suppressUntil = performance.now() + 700;
            openDialog("Explain", `<p>${esc(text)}</p>`);
        }
    }

    document.addEventListener("pointerdown", event => {
        if (!explaining || event.target.closest("#loveLetterHelpBtn, #loveLetterExplainBtn, .ll-dialog")) return;
        explainAt(event);
    }, true);
    document.addEventListener("click", event => {
        if (performance.now() < suppressUntil) {
            suppressUntil = 0;
            event.preventDefault(); event.stopImmediatePropagation();
            return;
        }
        if (!explaining || event.target.closest("#loveLetterHelpBtn, #loveLetterExplainBtn, .ll-dialog")) return;
        explainAt(event);
    }, true);
    panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-ll-tip]")); });
    panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
    panel.addEventListener("focusin", event => showTip(event.target.closest("[data-ll-tip]")));
    panel.addEventListener("focusout", hideTip);
    panel.addEventListener("keydown", event => {
        if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-ll-tip]")) {
            event.preventDefault();
            if (explaining) explainAt(event);
            else showTip(event.target, true);
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        setExplain(false); hideTip();
        if (!dialog.open && selected !== null && !pending) { resetSelection(); render(); }
    });
    helpButton.addEventListener("click", help);
    explainButton.addEventListener("click", () => setExplain(!explaining));
    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });
    window.addEventListener("resize", hideTip);
    window.addEventListener("blur", hideTip);
    document.addEventListener("scroll", hideTip, true);

    window.renderLoveLetterGameState = data => {
        const next = data.view;
        if (!next || next.game_id !== "love_letter") return;
        const nextSignature = JSON.stringify([data.room_id, next.you, next.round, next.turn, next.phase]);
        if (signature !== nextSignature) { resetSelection(); hideTip(); }
        signature = nextSignature;
        view = next;
        pending = false;
        clearTimeout(pendingTimer);
        render();
    };
    window.showLoveLetterHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) {
            view = null; signature = null; pending = false;
            resetSelection(); setExplain(false); hideTip();
            clearTimeout(pendingTimer);
            if (dialog.open) dialog.close();
            panel.innerHTML = "";
        }
    };
    function connectEvents() {
        socket.on("system:error", () => { if (pending) { pending = false; clearTimeout(pendingTimer); render(); } });
    }
    if (document.readyState === "loading" || typeof socket === "undefined") {
        window.addEventListener("DOMContentLoaded", connectEvents, {once: true});
    } else {
        connectEvents();
    }
})();
