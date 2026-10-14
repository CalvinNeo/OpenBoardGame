(() => {
    "use strict";
    const panel = document.getElementById("moshimoYushaPanel");
    const header = document.getElementById("moshimoYushaHeaderActions");
    const dialog = document.getElementById("moshimoYushaDialog");
    const $ = (suffix) => document.getElementById(`my${suffix}`);
    const tooltip = $("Tooltip");
    const colors = {
        1: "#569696",
        2: "#908480",
        3: "#83a375",
        4: "#c89a45",
        5: "#8197bc",
        6: "#b96f71",
        7: "#987dba",
    };
    const chipInfo = {
        gold: ["🪙", "Gold · 金币"],
        attack: ["⚔️", "Attack · 攻击"],
        faith: ["✝️", "Faith · 信仰"],
        score: ["🏆", "Victory points · 胜利点"],
    };
    const rules = {
        1: [
            "若有王族，获得 2 枚攻击（⚔️）。",
            "若有王族，每位勇者获得 1 枚攻击（⚔️）。",
            "无胜利条件；务必在最后一张前使用或传出。",
            "勇者（🗡️）使本回合所有王族（👑）行动无效。",
        ],
        2: [
            "获得 2 枚信仰（✝️）。",
            "每人获得 1 枚攻击（⚔️）。",
            "全场攻击（⚔️）总数 ≥ 总席位数，包含元老院。",
            "",
        ],
        3: [
            "获得 2 枚金币（🪙）。",
            "每人获得 1 枚信仰（✝️）。",
            "金币（🪙）严格多于每一位其他玩家；并列不满足。",
            "",
        ],
        4: [
            "获得 3 枚金币（🪙）。",
            "每人获得 1 枚金币（🪙）。",
            "三类筹码总数严格最多；并列不满足。",
            "",
        ],
        5: [
            "获得 1 枚信仰（✝️）。",
            "每人获得 2 枚信仰（✝️）。",
            "信仰（✝️）严格多于每一位其他玩家；并列不满足。",
            "大司教（⛪）只保护自己，免受本回合王族（👑）的掠夺或清空。",
        ],
        6: [
            "夺走其他未受保护玩家的全部三类筹码。",
            "除王族与大司教外，所有人清空三类筹码。",
            "全场攻击（⚔️）总数为 0。",
            "有勇者（🗡️）时无效；大司教（⛪）保留筹码。胜利点（🏆）不受影响。",
        ],
        7: [
            "所有普通席位同时秘密选一张剩余手牌，传给左邻（跳过元老院）。",
            "每位道化师获得 1 枚金币（🪙）；不传牌。",
            "没有其他角色满足其最后一张胜利条件时，所有道化师获胜。",
            "第四轮也要传牌，所以最终目标可能改变。同号牌可以同时留在手中。",
        ],
    };
    const short = {
        1: ["👤 王族在场 +2 ⚔️", "👥 王族在场 +1 ⚔️", "无最终目标"],
        2: ["👤 +2 ✝️", "👥 +1 ⚔️", "全场 ⚔️ ≥ 席位数"],
        3: ["👤 +2 🪙", "👥 +1 ✝️", "🪙 独自最多"],
        4: ["👤 +3 🪙", "👥 +1 🪙", "筹码总数独自最多"],
        5: ["👤 +1 ✝️", "👥 +2 ✝️", "✝️ 独自最多"],
        6: ["👤 掠夺筹码", "👥 清空非王族筹码", "全场没有 ⚔️"],
        7: ["👤 向左传一张牌", "👥 +1 🪙", "其他角色均未获胜"],
    };
    const roleNames = [
        null,
        ["🗡️", "异世界勇者"],
        ["⛓️", "哀怜的奴隶"],
        ["🏡", "和平的市民"],
        ["💰", "强欲的商人"],
        ["⛪", "温厚的大司教"],
        ["👑", "傲慢的王族"],
        ["🎭", "愉快的道化师"],
    ];
    let view = null,
        selected = [],
        handSignature = "",
        windowKey = "",
        pending = false;
    let busyTimer,
        tipTimer,
        suppressTimer,
        explaining = false,
        suppressClick = false,
        returnFocus;
    const node = (tag, cls, value) => {
        const el = document.createElement(tag);
        if (cls) el.className = cls;
        if (value != null) el.textContent = value;
        return el;
    };
    const text = (suffix, value) => {
        $(suffix).textContent = value;
    };
    const card = (id) =>
        view?.cards.find((c) => c.id === id) || {
            id,
            emoji: roleNames[id]?.[0],
            name_zh: roleNames[id]?.[1],
        };
    const name = (id) => view?.players.find((p) => p.player_id === id)?.name || "—";
    const active = () => currentGameType === "moshimo_yusha" && !panel.classList.contains("hidden");
    const can = (kind) =>
        Boolean(!pending && socket.connected && view?.legal_actions.includes(kind));
    const tip = (el, message, explain) => {
        el.dataset.myTip = message;
        el.tabIndex = 0;
        if (explain) el.dataset.myExplain = explain;
        return el;
    };
    function hideTip() {
        clearTimeout(tipTimer);
        tooltip.classList.add("hidden");
    }
    function showTip(target, autoHide = false) {
        if (!target?.dataset.myTip || explaining || dialog.open) return;
        clearTimeout(tipTimer);
        tooltip.textContent = target.dataset.myTip;
        tooltip.classList.remove("hidden");
        const r = target.getBoundingClientRect(),
            b = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(12, Math.min(r.left, innerWidth - b.width - 12))}px`;
        tooltip.style.top = `${Math.max(12, Math.min(r.bottom + 7, innerHeight - b.height - 12))}px`;
        if (autoHide) tipTimer = setTimeout(hideTip, 3000);
    }
    function setExplain(value) {
        explaining = value;
        document.body.classList.toggle("my-explaining", value);
        document
            .getElementById("moshimoYushaExplainBtn")
            .setAttribute("aria-pressed", String(value));
        hideTip();
    }
    function openDialog(title, children) {
        returnFocus = document.activeElement;
        text("DialogTitle", title);
        $("DialogBody").replaceChildren(...children);
        hideTip();
        if (!dialog.open) dialog.showModal();
        $("DialogClose").focus();
    }
    function ruleElements(id) {
        const c = card(id),
            r = rules[id];
        return [
            node("h3", "", `${id} · ${c?.emoji || ""} ${c?.name_zh || ""}`),
            node("p", "", `👤 单独：${r[0]}`),
            node("p", "", `👥 多人：${r[1]}`),
            node("p", "", `最后一张：${r[2]}`),
            ...(r[3] ? [node("p", "", r[3])] : []),
        ];
    }
    function help() {
        setExplain(false);
        const contents = [
            node("h3", "", "七张牌，四次出牌，一个最终目标"),
            node(
                "p",
                "",
                "每人拿相同的七种角色，秘密弃两张。全部提交后匿名公开弃牌并暂停。每轮各选一张，所有人提交后同时揭示，按 1–7 顺序结算。只有一人打出某号牌使用单独效果（👤）；两人或更多使用多人效果（👥）。",
            ),
            node("h3", "", "三类筹码与勝利点"),
            node(
                "p",
                "",
                "金币 Gold（🪙）、攻击 Attack（⚔️）、信仰 Faith（✝️）全部公开。胜利点 Victory points（🏆）单独累计，王族不会夺取或清空它。角色旁的数字是行动顺序。手牌（🂠）与已提交的选择（🔒）在揭示前保密。",
            ),
            node("h3", "", "留下最后一张"),
            node(
                "p",
                "",
                "四轮出牌后先看第四轮回顾，全员点击 Next Round 再揭示最后一张。按所有席位（包含元老院）的筹码判断各人的目标，最后一张不执行出牌效果。唯一满足者得 2 胜利点，多人满足各得 1 点，无人满足不得分。有人达到 2 点，累计最高者共同获胜；否则确认计分回顾后开始下一局，清空三类筹码，胜利点保留。",
            ),
            node("h3", "", "低人数与机器人"),
            node(
                "p",
                "",
                "支持 1–7 个房间席位。不足 3 席时，线上自动补充元老院 Senate（🏛️）至 3 席：单人加两席，双人加一席。元老院随机弃牌和依序翻牌，参与筹码及胜负计算，但跳过传牌且自动确认。房间 Bot 是完整玩家，参与传牌。",
            ),
            node("h3", "", "回顾与操作"),
            node(
                "p",
                "",
                "每次公开弃牌、结算出牌、揭示最终目标后暂停。真人须全部点击 Next Round；离线玩家重连后继续，不替真人自动确认。点击手牌选中，再 Confirm 提交；弃牌需选两张。点击空白或按 Esc 取消选择；Explain 可查看任何角色、数值或灰色按钮。静态图标悬停显示提示，手机点击显示 3 秒提示。",
            ),
        ];
        for (let i = 1; i <= 7; i++) {
            const group = node("section", "my-rule-card");
            group.append(...ruleElements(i));
            contents.push(group);
        }
        const source = node(
            "p",
            "",
            "基础七角色版 · 不含替换扩展。素材为 Emoji 与原创 CSS。规则参考：",
        );
        const link = node("a", "", "发行方介绍");
        link.href = "https://gamemarket.jp/game/179383";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        source.append(link);
        contents.push(source);
        openDialog("Help · 如果勇者在的话就好了", contents);
    }
    function explain(target) {
        const key = target?.dataset.myExplain;
        if (!key) return;
        setExplain(false);
        if (key.startsWith("card:")) {
            openDialog("Explain · Role card", ruleElements(Number(key.split(":")[1])));
            return;
        }
        const messages = {
            confirm:
                "Confirm：提交当前选牌。准备阶段选两张；出牌与传牌阶段选一张。提交后锁定并等待其他人，不提前揭示。",
            next: "Next Round：确认已看完当前结果。所有房间席位确认后继续；机器人与元老院只替自己确认。无需再次确认。",
            discard:
                "Public cards（🂠 / 🃏）：每格显示该角色的初始匿名弃牌数 / 已出牌数。初始弃牌不会关联到玩家。",
            gold: "Gold · 金币（🪙）：市民比较金币数量，商人将其计入三类筹码总数。",
            attack: "Attack · 攻击（⚔️）：奴隶要求全场总数不少于总席位数；王族要求全场总数为 0。",
            faith: "Faith · 信仰（✝️）：大司教比较信仰数量，商人将其计入三类筹码总数。",
            score: "Victory points · 胜利点（🏆）：独自满足最终目标得 2 分，多人满足各得 1 分。有人达到 2 分时，累计最高者获胜。",
            player: "玩家公开显示三类筹码、胜利点（🏆）、剩余手牌数（🂠）与提交进度（🔒）。Senate（🏛️）不参加传牌，其余所有席位都参加。",
        };
        openDialog("Explain", [node("p", "", messages[key] || target.dataset.myTip || "")]);
    }
    function chipsRow(chips, score) {
        const row = node("div", "my-resources");
        for (const kind of ["gold", "attack", "faith", ...(score == null ? [] : ["score"])]) {
            const [emoji, label] = chipInfo[kind];
            row.append(
                tip(
                    node(
                        "span",
                        `my-resource my-${kind}`,
                        `${emoji} ${kind === "score" ? score : chips[kind]}`,
                    ),
                    `${label}（${emoji}）`,
                    kind,
                ),
            );
        }
        return row;
    }
    function renderHand() {
        const signature = JSON.stringify([view.my_hand.map((c) => c.id), view.phase]);
        if (signature !== handSignature) {
            const choosing = ["setup_discard", "playing", "pass_cards"].includes(view.phase);
            $("HandDetails").open = choosing;
            $("HandSummary").classList.toggle("hidden", choosing);
            text("HandSummary", `Remaining hand · private (${view.my_hand.length})`);
            const scroll = $("Hand").scrollTop;
            $("Hand").replaceChildren();
            view.my_hand.forEach((c, i) => {
                const b = node("button", "my-card");
                b.type = "button";
                b.dataset.myCard = String(i);
                b.dataset.myExplain = `card:${c.id}`;
                b.style.setProperty("--my-card-color", colors[c.id]);
                const top = node("div", "my-card-top");
                top.append(node("span", "", `NO. ${c.id}`), node("span", "my-check", ""));
                b.append(
                    top,
                    node("span", "my-card-emoji", c.emoji),
                    node("strong", "", c.name_zh),
                    node("small", "", short[c.id][0]),
                    node("small", "", short[c.id][1]),
                    node("small", "", `最后：${short[c.id][2]}`),
                );
                b.setAttribute("aria-label", `${c.id} ${c.name_zh}`);
                $("Hand").append(b);
            });
            if (!view.my_hand.length)
                $("Hand").append(node("p", "my-caption", "Watching this table."));
            $("Hand").scrollTop = scroll;
            handSignature = signature;
        }
        updateSelection();
    }
    function updateSelection() {
        const kind = view?.legal_actions[0];
        const choosing = ["discard", "play", "pass_card"].includes(kind);
        $("Hand")
            .querySelectorAll("[data-my-card]")
            .forEach((b) => {
                const yes = selected.includes(Number(b.dataset.myCard));
                b.classList.toggle("is-selected", yes);
                b.setAttribute("aria-pressed", String(yes));
                b.querySelector(".my-check").textContent = yes ? "✓" : "";
                b.disabled = !choosing || !can(kind);
            });
        $("Confirm").classList.toggle(
            "hidden",
            !["setup_discard", "playing", "pass_cards"].includes(view?.phase),
        );
        $("Confirm").disabled =
            !choosing || !can(kind) || selected.length !== (kind === "discard" ? 2 : 1);
        text(
            "Confirm",
            pending
                ? "Submitting…"
                : kind === "discard"
                  ? "Confirm discard"
                  : kind === "pass_card"
                    ? "Pass card"
                    : "Confirm play",
        );
        $("Next").classList.toggle(
            "hidden",
            !["setup_review", "round_review", "match_review"].includes(view?.phase),
        );
        $("Next").disabled = !can("next_round");
        text("Next", view?.next_round_ready.includes(view.you) ? "Ready ✓" : "Next Round");
        text(
            "Selected",
            selected.length
                ? selected
                      .map((i) => view.my_hand[i]?.name_zh)
                      .filter(Boolean)
                      .join(" · ")
                : view?.my_submission != null
                  ? "Selection locked 🔒"
                  : "",
        );
        document.body.classList.toggle(
            "my-needs-action",
            Boolean(active() && view?.legal_actions.length && socket.connected),
        );
    }
    function renderPlayers() {
        const container = $("Players"),
            scroll = container.scrollTop;
        container.replaceChildren();
        view.players.forEach((p) => {
            const el = node("article", `my-player ${p.player_id === view.you ? "my-self" : ""}`);
            const heading = node("div", "my-player-heading");
            heading.append(
                node("strong", "", `${p.name}${p.player_id === view.you ? " · You" : ""}`),
            );
            const review = ["setup_review", "round_review", "match_review"].includes(view.phase);
            const status = p.is_senate ? "🏛️ Senate" : p.is_bot ? "Bot" : "";
            heading.append(
                tip(
                    node(
                        "small",
                        "",
                        `${status} ${review ? (view.next_round_ready.includes(p.player_id) || p.is_senate ? "✓ Ready" : "Reviewing") : p.submitted ? "🔒 Submitted" : ""}`,
                    ),
                    "🏛️ Senate 为元老院；🔒 Submitted 表示已提交隐藏选择。",
                    "player",
                ),
            );
            el.append(
                heading,
                chipsRow(p.chips, p.score),
                tip(
                    node("span", "my-card-count", `🂠 ${p.card_count} cards`),
                    "手牌（🂠）：未打出的角色牌数量。",
                    "player",
                ),
            );
            container.append(el);
        });
        container.scrollTop = scroll;
    }
    function renderReview() {
        const record = view.last_resolution;
        $("Review").classList.toggle("hidden", !record || Boolean(view.last_match_summary));
        $("ReviewRows").replaceChildren();
        $("Effects").replaceChildren();
        if (record) {
            text("ReviewTitle", `Round ${record.round} · revealed`);
            text("ReviewStatus", view.phase === "pass_cards" ? "Exchange in progress" : "Resolved");
            record.cards.forEach((r) => {
                const c = card(r.card_id),
                    el = node(
                        "article",
                        `my-review-row ${r.player_id === view.you ? "my-self" : ""}`,
                    ),
                    head = node("div", "my-row-head");
                const count = record.cards.filter((x) => x.card_id === r.card_id).length;
                head.append(
                    node(
                        "strong",
                        "",
                        `${name(r.player_id)}${r.player_id === view.you ? " · You" : ""}`,
                    ),
                    tip(
                        node("span", "", `${c.id} ${c.emoji} ${c.name_zh}`),
                        `${c.name_zh} · ${count > 1 ? "多人效果 👥" : "单独效果 👤"}`,
                        `card:${c.id}`,
                    ),
                );
                el.append(head);
                const after = record.after[r.player_id];
                if (after) {
                    const changes = Object.keys(chipInfo)
                        .filter((k) => k !== "score")
                        .map((k) => {
                            const delta = after[k] - record.before[r.player_id][k];
                            return `${chipInfo[k][0]} ${record.before[r.player_id][k]} → ${after[k]} (${delta > 0 ? "+" : ""}${delta})`;
                        });
                    el.append(node("p", "", changes.join(" · ")));
                }
                $("ReviewRows").append(el);
            });
            record.effects.forEach((e) =>
                $("Effects").append(
                    node("li", e.affected?.includes(view.you) ? "my-own-effect" : "", e.text),
                ),
            );
        }
        const summary = view.last_match_summary;
        $("Final").classList.toggle("hidden", !summary);
        $("FinalRows").replaceChildren();
        if (summary) {
            text(
                "FinalTitle",
                view.game_over
                    ? `🏆 ${view.winner_ids.map(name).join(" & ")}`
                    : `Match ${summary.match} · final objectives`,
            );
            view.players.forEach((p) => {
                const c = summary.final_cards[p.player_id];
                if (!c) return;
                const won = summary.winners.includes(p.player_id);
                const el = node(
                    "article",
                    `my-review-row ${p.player_id === view.you ? "my-self" : ""}`,
                );
                el.append(
                    tip(
                        node(
                            "strong",
                            "",
                            `${p.name}${p.player_id === view.you ? " · You" : ""} · ${c.emoji} ${c.name_zh}`,
                        ),
                        `${c.name_zh}（${c.emoji}）：${rules[c.id][2]}`,
                        `card:${c.id}`,
                    ),
                    node(
                        "p",
                        "",
                        `${won ? `✓ +${summary.victory_points_gained} 🏆` : "— Goal not met"} · Total ${summary.scores[p.player_id]} 🏆`,
                    ),
                    node("p", "", rules[c.id][2]),
                );
                $("FinalRows").append(el);
            });
        }
    }
    function renderPool() {
        $("Discard").replaceChildren();
        view.cards.forEach((c) => {
            const d = view.discarded.filter((x) => x.id === c.id).length,
                p = view.played.filter((x) => x.card_id === c.id).length;
            const el = tip(
                node("div", "my-pool", `${c.id} ${c.emoji}`),
                `${c.name_zh}：初始匿名弃牌 ${d} 张（🂠），已出牌 ${p} 张（🃏）。`,
                `card:${c.id}`,
            );
            el.append(node("small", "", `${d} / ${p}`));
            $("Discard").append(el);
        });
    }
    function render() {
        if (!view) return;
        const phase = view.phase,
            legal = view.legal_actions[0];
        text(
            "Round",
            `Match ${view.match_number} · ${view.play_round ? `Round ${view.play_round} / 4` : "Preparation"}`,
        );
        const labels = {
            setup_discard: "Choose two cards to discard",
            setup_review: "Anonymous discards revealed",
            playing: "Choose one card to play",
            pass_cards: "Pass one card to your left",
            round_review: "Round complete · review the table",
            match_review: "Final objectives revealed",
            game_over: "Game complete",
        };
        text("Status", socket.connected ? labels[phase] : "Disconnected · reconnecting…");
        text(
            "HandTitle",
            phase === "setup_discard"
                ? "Your seven roles"
                : phase === "pass_cards"
                  ? "Choose a card to pass"
                  : "Your hand · private",
        );
        const review = ["setup_review", "round_review", "match_review"].includes(phase);
        const done = review
            ? view.next_round_ready.length
            : view.submitted.filter((pid) => view.turn_order.includes(pid)).length;
        text(
            "Progress",
            phase === "game_over"
                ? "Final card"
                : `${done} / ${view.turn_order.length} ${review ? "ready" : "submitted"}`,
        );
        const instruction =
            phase === "game_over"
                ? "Final results are kept here. Use Reopen in Room Controls to play again."
                : review
                  ? phase === "round_review" && view.play_round === 4
                      ? "Review this round. Next Round reveals the final objectives."
                      : "Everyone confirms before the next step."
                  : !legal
                    ? "Your selection is locked. Waiting for the other players…"
                    : phase === "setup_discard"
                      ? "Select two cards; the remaining five form your hand."
                      : phase === "pass_cards"
                        ? `Choose one card for ${name(view.turn_order[(view.turn_order.indexOf(view.you) + 1) % view.turn_order.length])}.`
                        : "Select a role. Your last card becomes your final objective.";
        text(
            "Instruction",
            view.turn_order.includes(view.you)
                ? instruction
                : "Spectating · private cards are hidden.",
        );
        text("TableCount", `${view.players.length} seats`);
        renderHand();
        renderPlayers();
        renderReview();
        renderPool();
        $("Exchange").classList.toggle("hidden", !view.my_exchange);
        if (view.my_exchange) {
            const e = view.my_exchange;
            text(
                "Exchange",
                `🔒 Sent ${card(e.sent).emoji} ${card(e.sent).name_zh} → ${name(e.to)} · Received ${card(e.received).emoji} ${card(e.received).name_zh} ← ${name(e.from)}`,
            );
        }
        const scroll = $("Log").scrollTop;
        $("Log").replaceChildren(...[...view.history].reverse().map((t) => node("li", "", t)));
        $("Log").scrollTop = scroll;
    }
    function submit(kind) {
        if (!can(kind)) return;
        let fields = {};
        const ids = selected.map((i) => view.my_hand[i]?.id);
        if (kind === "discard") {
            if (ids.length !== 2) return;
            fields = { card_ids: ids };
        }
        if (kind === "play" || kind === "pass_card") {
            if (ids.length !== 1) return;
            fields = { card_id: ids[0] };
        }
        pending = true;
        updateSelection();
        clearTimeout(busyTimer);
        busyTimer = setTimeout(() => {
            pending = false;
            updateSelection();
        }, 5000);
        sendAction({
            type: kind,
            ...fields,
            game_instance_id: view.game_instance_id,
            window_id: view.window_id,
        });
    }
    $("Hand").addEventListener("click", (event) => {
        const b = event.target.closest("[data-my-card]");
        if (!b || b.disabled || explaining) return;
        const i = Number(b.dataset.myCard),
            max = view.legal_actions[0] === "discard" ? 2 : 1;
        if (selected.includes(i)) selected = selected.filter((x) => x !== i);
        else if (max === 1) selected = [i];
        else if (selected.length < max) selected.push(i);
        updateSelection();
    });
    $("Confirm").addEventListener("click", () => submit(view?.legal_actions[0]));
    $("Next").addEventListener("click", () => submit("next_round"));
    document.getElementById("moshimoYushaHelpBtn").addEventListener("click", help);
    document
        .getElementById("moshimoYushaExplainBtn")
        .addEventListener("click", () => setExplain(!explaining));
    $("DialogClose").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
        if (returnFocus?.isConnected) returnFocus.focus();
    });
    dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
        )
            dialog.close();
    });
    const exempt = (target) =>
        target.closest?.("#moshimoYushaHelpBtn,#moshimoYushaExplainBtn,#moshimoYushaDialog");
    function explainTarget(event) {
        return (
            event.target.closest?.("[data-my-explain]") ||
            [...panel.querySelectorAll("[data-my-explain]")].find((el) => {
                const r = el.getBoundingClientRect();
                return (
                    r.width &&
                    r.height &&
                    event.clientX >= r.left &&
                    event.clientX <= r.right &&
                    event.clientY >= r.top &&
                    event.clientY <= r.bottom
                );
            })
        );
    }
    document.addEventListener(
        "pointerdown",
        (event) => {
            suppressClick = false;
            if (!active() || !explaining || exempt(event.target)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            suppressClick = true;
            clearTimeout(suppressTimer);
            suppressTimer = setTimeout(() => {
                suppressClick = false;
            }, 750);
            explain(explainTarget(event));
        },
        true,
    );
    document.addEventListener(
        "click",
        (event) => {
            if (!active()) return;
            if (suppressClick) {
                suppressClick = false;
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (!explaining || exempt(event.target)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            explain(explainTarget(event));
        },
        true,
    );
    panel.addEventListener("click", (event) => {
        const t = event.target.closest("[data-my-tip]");
        if (t) showTip(t, true);
        else hideTip();
        if (!event.target.closest("button,[data-my-tip],a,input,summary") && selected.length) {
            selected = [];
            updateSelection();
        }
    });
    panel.addEventListener("pointerover", (event) => {
        if (event.pointerType === "mouse") showTip(event.target.closest("[data-my-tip]"));
    });
    panel.addEventListener("pointerout", (event) => {
        if (event.pointerType === "mouse") hideTip();
    });
    panel.addEventListener("focusin", (event) => showTip(event.target.closest("[data-my-tip]")));
    panel.addEventListener("focusout", hideTip);
    document.addEventListener(
        "keydown",
        (event) => {
            if (!active()) return;
            if (event.key === "Escape") {
                setExplain(false);
                hideTip();
                selected = [];
                updateSelection();
                if (dialog.open) dialog.close();
            } else if (explaining && ["Enter", " "].includes(event.key) && !exempt(event.target)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                explain(event.target.closest("[data-my-explain]"));
            }
        },
        true,
    );
    document.addEventListener("scroll", hideTip, true);
    window.addEventListener("resize", hideTip);
    window.addEventListener("blur", hideTip);
    function clear() {
        view = null;
        pending = false;
        selected = [];
        windowKey = "";
        handSignature = "";
        clearTimeout(busyTimer);
        clearTimeout(suppressTimer);
        suppressClick = false;
        setExplain(false);
        hideTip();
        document.body.classList.remove("my-needs-action");
        if (dialog.open) dialog.close();
        ["Hand", "Players", "ReviewRows", "FinalRows", "Discard", "Log"].forEach((s) =>
            $(s).replaceChildren(),
        );
        ["Review", "Final", "Exchange"].forEach((s) => $(s).classList.add("hidden"));
        text("Status", "Waiting to start");
        text("Round", "");
        text("HandTitle", "Your hand");
        text("Progress", "");
        text("TableCount", "");
        text("Instruction", "Waiting to start");
        $("HandDetails").open = true;
        $("HandSummary").classList.add("hidden");
        updateSelection();
    }
    window.renderMoshimoYushaGameState = (data) => {
        if (
            data?.view?.game_id !== "moshimo_yusha" ||
            currentGameType !== "moshimo_yusha" ||
            (data.room_id && data.room_id !== currentRoomState?.room_id)
        )
            return;
        const key = `${data.room_id}:${data.view.game_instance_id}:${data.view.window_id}:${data.view.you}`;
        if (key !== windowKey) {
            selected = [];
            pending = false;
            clearTimeout(busyTimer);
            setExplain(false);
            hideTip();
        } else if (
            data.view.my_submission != null ||
            data.view.next_round_ready.includes(data.view.you)
        ) {
            selected = [];
            pending = false;
            clearTimeout(busyTimer);
        }
        windowKey = key;
        view = data.view;
        render();
    };
    window.showMoshimoYushaHeaderActions = (visible) => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) clear();
        else updateSelection();
    };
    function syncRoom(state) {
        if (state?.game_type !== "moshimo_yusha" || state.status === "lobby") clear();
    }
    function sync() {
        socket.on("room:state", syncRoom);
        socket.on("system:error", () => {
            pending = false;
            clearTimeout(busyTimer);
            if (view) updateSelection();
        });
        socket.on("disconnect", () => {
            pending = false;
            if (view) render();
        });
        socket.on("connect", () => {
            if (view) render();
        });
        if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
        if (
            typeof lastGameStatePayload !== "undefined" &&
            lastGameStatePayload?.game_type === "moshimo_yusha"
        )
            window.renderMoshimoYushaGameState(lastGameStatePayload);
    }
    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", sync, { once: true });
    else sync();
})();
