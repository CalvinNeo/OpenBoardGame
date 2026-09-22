(() => {
    "use strict";
    const panel = document.getElementById("redDoorsPanel");
    const header = document.getElementById("redDoorsHeaderActions");
    const help = document.getElementById("redDoorsHelpBtn");
    const explain = document.getElementById("redDoorsExplainBtn");
    const dialog = document.getElementById("redDoorsDialog");
    const dialogTitle = document.getElementById("redDoorsDialogTitle");
    const dialogBody = document.getElementById("redDoorsDialogBody");
    const close = document.getElementById("redDoorsDialogClose");
    const tip = document.createElement("div");
    tip.id = "redDoorsImmediateTip";
    tip.className = "rd-immediate-tip";
    tip.hidden = true;
    document.body.appendChild(tip);
    const descriptions = {
        door: "暗门（🚪）：点选后，在门牌上的确认区点击 Confirm。开门只让你本人看牌；之后必须处理牌面。明置牌不可作为普通开门目标。灰色表示当前无法选择。",
        confirm: "Confirm：提交当前选择。选门只是本地选择，确认后才会私下看牌；点击空白或按 Esc 可取消尚未提交的选择。",
        cancel: "Cancel：取消尚未提交的选择，不开门、不消耗回合。也可点击周围空白或按 Esc。已提交的开门不能撤销。",
        return: "暗置放回：把此牌放回原位置，公开日志只记录你声称是空房（🚪）。普通玩家须有牌面许可；已成为杀人鬼（🗝️）可以隐藏普通开门的效果。",
        use: "执行牌面：钥匙（🔑／🗝️）暗置持有，道具（🦺／🔫）公开持有，其余按牌面处理。首次取得杀人鬼钥匙必须成为杀人鬼，不能先取得身份再撤销拿牌。",
        escape: "尝试逃脱（🚪✨）：全桌必须持有三把钥匙。公开后，三把银钥匙（🔑）使所有普通人获胜；混入杀人鬼钥匙（🗝️）则所有杀人鬼获胜。两种结局都包括已死亡的同阵营玩家。",
        target: "选择目标：看破违和感（👁️）选择别人的暗钥匙；子弹房间（🔸）选择存活玩家；不起眼的线索（🔎）选择另一扇暗门，查看不触发效果。确认前可以改选或按 Esc 取消。",
        private: "Private（🔒）：这里的信息只有你本人看到。线索（🔎）只查看牌面，不取得钥匙、不触发陷阱，也不改变身份。读完后 Continue。",
        review: "Continue：公开效果结算后暂停。每个房间席位都须确认，包括已死亡玩家；机器人只确认自己，断线真人不会被跳过。",
        next: "Next Round：本局结果一直保留，直到所有玩家各自确认下一步。Play again 开新局，Finish 结束整场。改变下一步选项会清空已有确认。",
        mode: "Play again / Finish：选择全桌确认后的下一步，改变选项会清空已确认名单。任何玩家都可提议，只有全员确认后才执行。",
        role: "身份（🗝️／🧑）：取得杀人鬼钥匙后成为杀人鬼，失去钥匙或死亡都不解除身份。自己的身份保密；通过看破（👁️）暴露后公开。多名杀人鬼独存时相互竞争，不能直接共享独存胜利。",
        memory: "私人记忆（🔒）：仅显示你实际看过的牌。重洗场地（🌀）后全部失效，门号重新分配；明置牌也会重新暗置。",
        inventory: "持有物：钥匙（🔑／🗝️）默认暗置，他人只能看见数量。手枪（🔫）和防弹背心（🦺）公开。陷阱、瓦斯或命中效果使持有物回场时，不会解除杀人鬼身份。",
    };
    const phases = {choose_door: "选择一扇门", resolve_door: "私下看牌", choose_target: "选择目标", private_result: "私密线索", resolving: "正在处理门牌", public_review: "公开结算", round_end: "本局结局", game_over: "Game over"};
    const endings = {silver_escape: "三把银钥匙 · 逃脱成功", tainted_escape: "杀人鬼的钥匙 · 逃脱失败", sole_killer: "杀人鬼独自生还", all_dead: "无人生还"};
    let view = null, signature = null, selection = null, pending = false, pendingTimer = null;
    let explaining = false, suppressedPointer = null, returnFocus = null, tipAnchor = null, tipTimer = null, tipHideTimer = null, touchStart = null, inputKind = "mouse", historyOpen = false;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const own = () => view?.players.find(p => p.player_id === view.you);
    const name = pid => view?.players.find(p => p.player_id === pid)?.name || "—";
    const allowed = action => !pending && view?.legal_actions.includes(action);
    const label = kind => kind ? `${view.card_defs[kind].icon} ${view.card_defs[kind].name}` : "🔒 暗钥匙";
    const cardTip = kind => kind ? `${label(kind)}：${view.card_defs[kind].text}` : descriptions.door;
    const btn = (text, action, explanation, disabled = false, extra = "") => `<button type="button" data-rd-action="${action}" data-rd-explain="${explanation}" ${disabled ? "disabled" : ""} ${extra}>${text}</button>`;
    const badge = (text, message) => `<button type="button" class="rd-tip-label" data-rd-tip="${esc(message)}" data-rd-explain="tip">${esc(text)}</button>`;

    function candidate() {
        if (!selection || pending) return null;
        if (allowed("open_door") && view.doors.some(d => d.door_id === selection && !d.faceup)) return {type: "open_door", door_id: selection, board_epoch: view.board_epoch, turn_id: view.turn_id};
        if (allowed("choose_target") && view.private.targets.some(t => t.target_id === selection)) return {type: "choose_target", target_id: selection, effect_id: view.private.effect_id};
        return null;
    }

    function boardHTML() {
        const selectingDoor = view.phase === "choose_door" && view.current_turn === view.you || view.phase === "choose_target" && view.private?.kind === "clue";
        const selectedDoor = selectingDoor ? view.doors.find(door => door.door_id === selection) : null;
        const confirmation = (door, className) => `<div class="rd-confirm-overlay ${className}" role="group" aria-label="Confirm door ${door.slot}"><strong>Door ${String(door.slot).padStart(2, "0")}</strong><div class="rd-actions">${btn(pending ? "Sending…" : "Confirm", "confirm", "confirm", !candidate(), 'class="rd-primary"')}${btn("Cancel", "cancel", "cancel", pending)}</div></div>`;
        return `<section class="rd-box rd-maze"><div class="rd-section-head"><h3>迷宫 · ${view.doors.length} doors</h3><small>Layout ${view.board_epoch}</small></div><div class="rd-board-wrapper"><div class="rd-board">${view.doors.map(door => {
            const kind = door.kind || door.known_kind;
            const target = allowed("choose_target") && view.private.kind === "clue" && view.private.targets.some(t => t.target_id === door.door_id);
            const selectable = (allowed("open_door") && !door.faceup) || target;
            const message = `${door.kind ? "公开门牌" : door.known_kind ? "私人记忆（🔒）" : "暗门（🚪）"} · 门 ${door.slot}。${cardTip(kind)}`;
            return `<div class="rd-door-cell">${btn(`<span class="rd-door-top"><span class="rd-door-no">${String(door.slot).padStart(2, "0")}</span>${!door.kind && door.known_kind ? '<span class="rd-door-mark" aria-label="Private memory">🔒</span>' : ""}</span><span class="rd-door-icon">${kind ? view.card_defs[kind].icon : "🚪"}</span>`, "select", target ? "target" : "door", !selectable,
                `class="rd-door ${selection === door.door_id ? "is-selected" : ""} ${door.kind ? "is-public" : ""}" data-target="${esc(door.door_id)}" data-rd-description="${esc(message)}" aria-label="Door ${door.slot}${kind ? ` · ${esc(label(kind))}` : ""}" aria-pressed="${selection === door.door_id}"`)}${selectedDoor === door ? confirmation(door, "rd-door-confirm") : ""}</div>`;
        }).join("")}</div>${selectedDoor ? confirmation(selectedDoor, "rd-board-confirm") : ""}</div><p class="rd-hint">${view.private?.kind === "clue" && view.phase === "choose_target" ? "🔎 点选另一扇暗门，在门牌上确认查看。" : view.current_turn === view.you && view.phase === "choose_door" ? "点选暗门，再原位 Confirm。" : "暗牌可开门 · 🔒 为私人记忆"}</p></section>`;
    }

    function actionHTML() {
        if (view.phase === "choose_door") return "";
        let content = "";
        const privateCard = view.private;
        if (privateCard && view.phase === "resolve_door") {
            content = `<div class="rd-private-label">🔒 Private · Only you can see this</div><div class="rd-card-face"><span>${view.card_defs[privateCard.kind].icon}</span><h4>${esc(view.card_defs[privateCard.kind].name)}</h4></div><p class="rd-card-text">${esc(view.card_defs[privateCard.kind].text)}</p>
                ${own().role === "killer" && privateCard.choices.includes("return") ? '<p class="rd-hint">🗝️ 你可以声称是空房，将门牌暗置放回。</p>' : ""}
                <div class="rd-actions">${privateCard.choices.map(choice => btn(choice === "return" ? "Return face down" : choice === "escape" ? "Try escape" : ["silver_key", "killer_key", "vest", "gun"].includes(privateCard.kind) ? "Take card" : "Reveal & resolve", `resolve-${choice}`, choice, pending, choice !== "return" ? 'class="rd-primary"' : "")).join("")}</div>`;
        } else if (privateCard && view.phase === "choose_target") {
            content = `<p class="rd-card-text">${label(privateCard.kind)} · ${privateCard.kind === "clue" ? "点选另一扇暗门。" : privateCard.kind === "ammo" ? "选择射击目标。" : "选择其他玩家的一张暗钥匙。"}</p>
                ${privateCard.kind === "clue" ? "" : `<div class="rd-actions">${privateCard.targets.map(t => btn(esc(t.label), "select", "target", pending, `data-target="${esc(t.target_id)}" class="${selection === t.target_id ? "is-selected" : ""}" aria-pressed="${selection === t.target_id}"`)).join("")}</div>`}
                ${privateCard.kind !== "clue" ? `<div class="rd-actions">${btn(pending ? "Sending…" : "Confirm", "confirm", "confirm", !candidate(), 'class="rd-primary"')}</div>` : ""}`;
        } else if (privateCard && view.phase === "private_result") {
            const result = privateCard.result;
            content = `<div class="rd-private-label">🔒 Private · 门 ${result.slot}</div><div class="rd-card-face"><span>${view.card_defs[result.kind].icon}</span><h4>${esc(view.card_defs[result.kind].name)}</h4></div><p class="rd-card-text">${esc(view.card_defs[result.kind].text)}</p><p class="rd-hint">🔎 本次只查看，不触发效果；门牌仍在原位置。</p><div class="rd-actions">${btn("Continue", "private", "private", pending, 'class="rd-primary"')}</div>`;
        } else if (["public_review", "round_end", "game_over"].includes(view.phase)) {
            content = `<p class="rd-card-text">${view.phase === "game_over" ? "本场已结束，可在房间重新开始。" : view.ready.includes(view.you) ? "✓ 已确认。等待其他玩家。" : "请回顾上方结果，然后确认继续。"}</p>`;
        } else {
            content = `<div class="rd-wait"><span>${own()?.alive === false ? "☠️ 你已死亡，仍需参与结算确认。" : "Waiting for"}</span><b>${esc(name(view.current_turn))}</b><span>${view.public_effect ? label(view.public_effect) : "正在私下处理门牌。"}</span></div>`;
        }
        return `<section class="rd-box rd-action-box ${privateCard ? "rd-private" : ""}"><div class="rd-section-head"><h3>${view.current_turn === view.you ? "Your turn" : "Action"}</h3><small>${phases[view.phase]}</small></div>${content}</section>`;
    }

    function reviewHTML() {
        if (!["public_review", "round_end", "game_over"].includes(view.phase)) return "";
        const final = view.phase !== "public_review";
        const ready = view.ready.includes(view.you);
        return `<section class="rd-box rd-review"><div class="rd-section-head"><h3>${final ? "🏁 " + endings[view.ending_reason] : "⏸ 公开结算"}</h3><small>${view.phase === "game_over" ? "Game over" : `${view.ready.length} / ${view.players.length} ready`}</small></div>
            ${final ? `<p class="rd-winners">${view.winner.length ? `🏆 ${view.winner.map(pid => esc(name(pid))).join(" · ")}` : "No winner"}</p>` : ""}
            <ul class="rd-log">${view.review_notes.map(note => `<li>${esc(note)}</li>`).join("")}</ul>
            ${!view.game_over ? `${final ? `<div class="rd-actions">${["again", "finish"].map(mode => btn(mode === "again" ? "Play again" : "Finish", `mode-${mode}`, "mode", pending, `class="${view.next_mode === mode ? "is-selected" : ""}" aria-pressed="${view.next_mode === mode}"`)).join("")}</div>` : ""}
            <div class="rd-actions">${btn(ready ? "✓ Ready" : final ? (view.next_mode === "again" ? "Next Round" : "Confirm finish") : "Continue", final ? "next" : "review", final ? "next" : "review", pending || ready, 'class="rd-primary"')}</div>
            <div class="rd-ready">${view.players.map(p => `<span class="${view.ready.includes(p.player_id) ? "is-ready" : ""}">${view.ready.includes(p.player_id) ? "✓" : "○"} ${esc(p.name)}</span>`).join("")}</div>` : ""}</section>`;
    }

    function playersHTML() {
        return `<section class="rd-players" aria-label="Players">${view.players.map(p => `<article class="rd-player ${view.current_turn === p.player_id ? "is-active" : ""} ${p.alive ? "" : "is-dead"}">
            <div class="rd-player-head"><h4>${esc(p.name)} ${p.player_id === view.you ? "<small>You</small>" : ""}</h4></div>
            <div class="rd-player-badges">${badge(p.alive ? "🧑 Alive" : "☠️ Dead", p.alive ? "存活玩家按座位依次开门。" : "死亡者跳过行动，但保留原身份与自己的合法观察；仍须确认公开结算与 Next Round。")}
            ${p.role ? badge(`${p.role === "killer" ? "🗝️ 杀人鬼" : "🧑 普通人"}${p.player_id === view.you && !view.ending_reason && !p.exposed ? " · Private" : ""}`, descriptions.role) : badge("🎭 身份未知", descriptions.role)}</div>
            <div class="rd-inventory">${p.inventory.map(c => badge(label(c.kind) + (c.faceup ? " · Public" : ""), c.kind ? cardTip(c.kind) + (c.faceup ? " 已公开。" : " 暗置持有，仅你本人可见。") : "暗钥匙（🔒）：可能是银钥匙（🔑），也可能是杀人鬼钥匙（🗝️）。")).join("") || '<span class="rd-hint">No items</span>'}</div></article>`).join("")}</section>`;
    }

    function render() {
        if (!view) return;
        hideTip();
        panel.innerHTML = `<div class="red-doors-shell ${explaining ? "rd-explaining" : ""}"><div class="rd-masthead"><div><p class="rd-eyebrow">RED DOORS · THE MURDERER'S KEY</p><h2>红色的门和杀人鬼的钥匙</h2><p class="rd-subtitle">Base rules · 16 cards · 4–6 players</p></div><div class="rd-round"><span>ROUND</span><b>${view.round}</b></div></div>
            <div class="rd-status" role="status"><span><strong>${phases[view.phase]}</strong> · ${esc(name(view.current_turn))}</span>${badge(`🔑 ${view.held_key_count} / 3 · 已持有钥匙`, "银钥匙（🔑）与杀人鬼钥匙（🗝️）在公开前统一计数。全桌持有三把即可尝试出口（🚪✨）；第四把出现会匿名回收全部钥匙并重洗场地。")}</div>
            ${reviewHTML()}<div class="rd-layout">${boardHTML()}<aside class="rd-side">${actionHTML()}<section class="rd-box"><div class="rd-section-head"><h3 data-rd-explain="memory">🔒 Private memory</h3></div><p class="rd-card-text">${view.doors.filter(d => d.known_kind && !d.kind).length} 扇门留在你的记忆中</p><p class="rd-hint">带 🔒 的门牌信息仅你可见。迷宫重排后清空。</p>
            ${Object.keys(view.removed).length ? `<div class="rd-inventory">${Object.entries(view.removed).map(([kind, count]) => badge(`${label(kind)} ×${count}`, `${label(kind)}：已移出本局。`)).join("")}</div>` : ""}</section>
            <section class="rd-box rd-history"><details ${historyOpen ? "open" : ""}><summary>Activity · ${view.log.length}</summary><ol class="rd-log">${view.log.slice().reverse().map(line => `<li>${esc(line)}</li>`).join("")}</ol></details></section></aside></div>${playersHTML()}<p class="rd-footer">门牌会记得你，直到下一次洗牌。 · Help contains rules & card reference.</p></div>`;
    }

    function submit(action) {
        if (!action || !allowed(action.type)) return;
        pending = true;
        render();
        sendAction(action);
        window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => { pending = false; render(); }, 6000);
    }

    function hideTip() {
        window.clearTimeout(tipTimer); window.clearTimeout(tipHideTimer);
        if (tipAnchor) tipAnchor.removeAttribute("aria-describedby");
        tipAnchor = null; tip.hidden = true;
    }

    function showTip(target, touch = false) {
        hideTip();
        tipAnchor = target;
        target.setAttribute("aria-describedby", tip.id);
        tip.textContent = target.dataset.rdTip;
        tip.classList.toggle("is-touch", touch);
        tip.setAttribute("role", touch ? "status" : "tooltip");
        tip.hidden = false;
        const anchor = target.getBoundingClientRect(), rect = tip.getBoundingClientRect();
        const width = window.visualViewport?.width || innerWidth, height = window.visualViewport?.height || innerHeight;
        const x = touch ? (width - rect.width) / 2 : Math.max(12, Math.min(width - rect.width - 12, anchor.left));
        const y = touch ? (anchor.top > height / 2 ? 12 : height - rect.height - 12) : anchor.top > rect.height + 14 ? anchor.top - rect.height - 8 : anchor.bottom + 8;
        tip.style.left = `${x + (window.visualViewport?.offsetLeft || 0)}px`;
        tip.style.top = `${Math.max(12, Math.min(height - rect.height - 12, y)) + (window.visualViewport?.offsetTop || 0)}px`;
        if (touch) tipTimer = window.setTimeout(hideTip, 3000);
    }

    function setExplain(enabled) {
        explaining = enabled; hideTip();
        explain.setAttribute("aria-pressed", String(enabled));
        panel.querySelector(".red-doors-shell")?.classList.toggle("rd-explaining", enabled);
    }

    function openDialog(title, content, html = false) {
        hideTip(); returnFocus = document.activeElement;
        dialogTitle.textContent = title;
        if (html) dialogBody.innerHTML = content; else dialogBody.textContent = content;
        if (!dialog.open) dialog.showModal();
    }

    panel.addEventListener("click", event => {
        const control = event.target.closest("[data-rd-action]");
        if (!control || control.disabled || pending) return;
        const action = control.dataset.rdAction;
        if (action === "select") {
            const target = control.dataset.target;
            selection = selection === target ? null : target;
            render();
            [...panel.querySelectorAll('[data-rd-action="confirm"]')].find(el => el.getClientRects().length)?.focus({preventScroll: true});
            return;
        }
        if (action === "cancel") {
            const previous = selection;
            selection = null; render();
            [...panel.querySelectorAll('[data-rd-action="select"]')].find(el => el.dataset.target === previous)?.focus({preventScroll: true});
            return;
        }
        if (action === "confirm") { submit(candidate()); return; }
        if (action.startsWith("resolve-")) submit({type: "resolve_door", choice: action.slice(8), effect_id: view.private.effect_id});
        if (action === "private") submit({type: "ack_private", effect_id: view.private.effect_id});
        if (action === "review" || action === "next") submit({type: action === "review" ? "ack_review" : "next_round", review_id: view.review_id});
        if (action.startsWith("mode-")) submit({type: "set_next_mode", mode: action.slice(5), review_id: view.review_id});
    });
    panel.addEventListener("toggle", event => { if (event.target.closest(".rd-history")) historyOpen = event.target.open; }, true);
    panel.addEventListener("pointerdown", event => {
        if (!explaining && !pending && selection && !event.target.closest("button, summary, a, dialog")) {
            if (event.target.closest(".rd-confirm-overlay")) {
                suppressedPointer = {x: event.clientX, y: event.clientY, time: Date.now()};
                event.preventDefault(); event.stopPropagation();
            }
            selection = null; render();
        }
    });
    help.addEventListener("click", () => {
        if (!view) return;
        setExplain(false);
        openDialog("Red Doors · Help", `<p><b>基础版 · 4–6 人 · 16 张牌</b>。所有人从普通人开始，无持有物；线上由首席先开门，之后按座位行动，跳过死亡者。本次只开放基础牌，尚未包含 2–3 人 NPC 与进阶 40 级。</p>
            <p><b>① 开门（🚪）</b>：点选场上一张暗牌，在门牌上的确认区点击 Confirm；牌面只给本人看。按牌面取得、公开、选择目标或暗置放回。已公开留场的牌不能普通开门；暗置放回的牌可以重访。口头讨论与欺骗允许，系统不会核实“空房”的声称。</p>
            <p><b>② 身份（🗝️）</b>：首次取得杀人鬼钥匙必须拿取并成为杀人鬼。之后开门可以不执行效果而声称是空房。失去钥匙或死亡都保留身份；钥匙回场后可能产生第二个杀人鬼。线索偷看钥匙不会改变身份。</p>
            <p><b>③ 四把钥匙（🌀）</b>：全桌拿到第四把钥匙时，匿名回收所有钥匙，移除杀人鬼钥匙，把银钥匙放回场地一起重洗。不会透露原持有人；所有已存在的杀人鬼身份保留。</p>
            <p><b>④ 胜负（🏁）</b>：三把银钥匙从出口逃脱，所有普通人获胜；出口混入杀人鬼钥匙，所有杀人鬼获胜。这两种结局包含死亡的同阵营玩家。只有一个杀人鬼存活时，他单独获胜；多个杀人鬼存活时继续竞争。只剩普通人一人仍须寻找出口；全员死亡无人获胜。</p>
            <p><b>⑤ 线上回顾（⏸）</b>：陷阱、瓦斯、射击、看破与第四把钥匙处理后暂停，全员 Continue。本局终局停留在结果，所有席位（包括死亡者）分别 Next Round 后才重开。可选择 Finish 并全员确认结束；切换选项会清空确认。断线真人不会自动确认。</p>
            <p><b>牌表</b>：名称、图标和数量如下。牌面说明适用于普通玩家；杀人鬼普通开门可以选择暗置忽略。</p><ul>${Object.entries(view.card_defs).map(([kind, spec]) => `<li><b>${label(kind)} ×${spec.count}</b>：${esc(spec.text)}</li>`).join("")}</ul>
            <p><b>Controls</b>：点选门牌后，原位显示 Confirm / Cancel；手机门牌空间不足时，确认区覆盖迷宫区域并显示所选门号。Confirm 才提交开门；Cancel、空白或 Esc 取消未提交的选择。Help 关闭不撤销已开的门。要了解门牌或操作，先点 Explain 再点对应位置；Explain 拦截操作，灰色按钮也可解释，解释一次后退出。没有游戏操作的身份／道具徽标可悬停、聚焦查看；手机轻点显示三秒，连续轻点更新计时，滚动不触发提示。</p>
            <p><a href="https://www.yellowsubmarine.co.jp/hobbybase/game/reddoor/card.htm" target="_blank" rel="noopener noreferrer">Publisher rules</a> · <a href="https://humaoz.wixsite.com/ozplanning/q-a-akaitobira" target="_blank" rel="noopener noreferrer">Designer FAQ</a></p>`, true);
    });
    explain.addEventListener("click", () => setExplain(!explaining));
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });
    dialog.addEventListener("click", event => {
        const r = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
    });
    function explainTarget(target) {
        const message = target?.dataset.rdTip || target?.dataset.rdDescription || descriptions[target?.dataset.rdExplain];
        if (message) { setExplain(false); openDialog("Explain", message); }
    }
    document.addEventListener("pointerdown", event => {
        if (!explaining || panel.classList.contains("hidden") || header.contains(event.target) || dialog.contains(event.target)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const target = [...panel.querySelectorAll("[data-rd-explain]")].reverse().find(el => {
            const r = el.getBoundingClientRect();
            return r.width && r.height && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
        });
        if (target) { suppressedPointer = {x: event.clientX, y: event.clientY, time: Date.now()}; explainTarget(target); }
    }, true);
    document.addEventListener("click", event => {
        if (suppressedPointer) {
            const point = suppressedPointer; suppressedPointer = null;
            if (Date.now() - point.time < 700 && Math.abs(event.clientX - point.x) < 6 && Math.abs(event.clientY - point.y) < 6) { event.preventDefault(); event.stopImmediatePropagation(); return; }
        }
        if (!explaining || header.contains(event.target) || dialog.contains(event.target)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (panel.contains(event.target)) explainTarget(event.target.closest("[data-rd-explain]"));
    }, true);
    document.addEventListener("keydown", event => {
        if (panel.classList.contains("hidden")) return;
        if (event.key === "Tab") inputKind = "keyboard";
        if (event.key === "Escape" && !tip.hidden) { hideTip(); event.preventDefault(); return; }
        if (dialog.open) return;
        if (event.key === "Escape") { setExplain(false); selection = null; render(); }
    });
    document.addEventListener("pointerover", event => {
        if (event.pointerType === "touch" || event.pointerType === "pen" || explaining) return;
        if (tip.contains(event.target) || tipAnchor?.contains(event.target)) window.clearTimeout(tipHideTimer);
        const target = event.target.closest("#redDoorsPanel [data-rd-tip]");
        if (target && target !== tipAnchor) { inputKind = "mouse"; showTip(target); }
    });
    document.addEventListener("pointerout", event => {
        if (inputKind === "touch" || !tipAnchor) return;
        if ((tipAnchor.contains(event.target) || tip.contains(event.target)) && !tipAnchor.contains(event.relatedTarget) && !tip.contains(event.relatedTarget)) tipHideTimer = window.setTimeout(hideTip, 150);
    });
    document.addEventListener("focusin", event => {
        const target = event.target.closest("#redDoorsPanel [data-rd-tip]");
        if (target && inputKind !== "touch" && !explaining) showTip(target);
    });
    document.addEventListener("focusout", event => { if (inputKind !== "touch" && tipAnchor?.contains(event.target)) hideTip(); });
    document.addEventListener("pointerdown", event => {
        if (explaining || panel.classList.contains("hidden")) return;
        const target = event.target.closest("#redDoorsPanel [data-rd-tip]");
        inputKind = ["touch", "pen"].includes(event.pointerType) ? "touch" : "mouse";
        if (target && inputKind === "touch") touchStart = {id: event.pointerId, target, x: event.clientX, y: event.clientY, time: Date.now(), moved: false};
        else if (!target && !tip.contains(event.target)) hideTip();
    }, true);
    document.addEventListener("pointermove", event => {
        if (touchStart?.id === event.pointerId && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 10) { touchStart.moved = true; hideTip(); }
    }, true);
    document.addEventListener("pointerup", event => {
        if (!touchStart || touchStart.id !== event.pointerId) return;
        const start = touchStart; touchStart = null;
        if (!start.moved && Date.now() - start.time < 700 && start.target.isConnected && !explaining) { event.preventDefault(); event.stopImmediatePropagation(); showTip(start.target, true); }
    }, true);
    document.addEventListener("pointercancel", () => { touchStart = null; }, true);
    document.addEventListener("click", event => {
        const target = event.target.closest("#redDoorsPanel [data-rd-tip]");
        if (!target || explaining) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (inputKind !== "touch") showTip(target);
    }, true);
    window.addEventListener("resize", hideTip);
    document.addEventListener("scroll", () => { if (inputKind !== "touch") hideTip(); }, true);

    function clearState() {
        hideTip(); setExplain(false); window.clearTimeout(pendingTimer);
        view = null; signature = null; selection = null; pending = false; historyOpen = false; touchStart = null; suppressedPointer = null;
        if (dialog.open) dialog.close();
        panel.innerHTML = "";
    }
    window.renderRedDoorsGameState = data => {
        if (!data?.view) return;
        const next = data.view;
        const key = JSON.stringify([data.room_id, next.round, next.phase, next.turn_id, next.board_epoch, next.review_id]);
        if (signature !== key) selection = null;
        signature = key; view = next; pending = false; window.clearTimeout(pendingTimer); render();
    };
    window.showRedDoorsHeaderActions = visible => { header.style.display = visible ? "flex" : "none"; if (!visible) clearState(); };
    window.clearRedDoorsState = clearState;
    window.addEventListener("DOMContentLoaded", () => {
        socket.on("system:error", () => { if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); } });
    });
})();
