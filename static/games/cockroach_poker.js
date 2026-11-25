(function () {
  "use strict";

  function init() {
    const byId = (suffix) => document.getElementById(`cockroachPoker${suffix}`);
    const panel = byId("Panel");
    if (!panel || panel.dataset.cpReady) return;
    panel.dataset.cpReady = "true";
    let view = null;
    let activeRoom = null;
    let selectedCard = null;
    let selectedClaim = null;
    let selectedTarget = null;
    let inFlight = false;
    let requestTimer = null;
    let tooltipTimer = null;
    let gesture = null;
    let suppressClick = false;
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    const explanations = {
      collection: { zh: "收集区是公开的罚牌，不是手牌。三至六人时，首先收集四张同类动物的人输，其余玩家共同获胜。双人时门槛改为五张。红色表示再收一张该动物就会输。", en: "These face-up cards are penalties, not your hand. With 3–6 players, the first player to collect four of one creature loses and everyone else wins. Two players use five instead. Red means one more of that creature would lose." },
      exchange: { zh: "暗牌和当前声明彼此独立，送牌人可以说真话或撒谎。接牌人可先判断真假，或偷看后转传。正确判断让最后一个送牌人收牌，错误判断让接牌人收牌。", en: "The hidden creature need not match the claim. Judge true or false without looking, or peek and pass. A correct judgment gives the card to the most recent sender. A wrong judgment gives it to the receiver." },
      hand: { zh: "只有你能看见这些手牌。选择一类动物，再声明任意动物并选择收件人。相同动物合并显示，角落的数字是张数。手牌打空不会立即输，只有轮到自己必须发起新一轮却无牌可出才输。", en: "Only you can see this hand. Choose a creature, make any claim and choose a recipient. Matching cards are grouped and the number is their quantity. An empty hand loses only when you must open the next exchange." },
      send: { zh: "将所选手牌面朝下送给选定玩家，并公开你的声明。声明不必与实际动物一致。偷看后必须把同一张牌转传给尚未看过的玩家，不能改为直接判断。", en: "Send the selected card face down with your public claim, which may be true or false. After peeking you must pass the same card to someone who has not seen it. You cannot switch back to judging." },
      final: { zh: "本游戏只有一名输家，其他玩家共同获胜，不按罚牌总数排名。终局显示每人的全部公开动物数量和剩余手牌张数。每位玩家确认后才开放 Play Again。", en: "There is one loser and all other players share the win. Total penalties do not rank players. Results show each public collection and remaining hand size. Everyone must confirm before Play Again becomes available." },
      play_again: { zh: "所有玩家已确认结果。使用相同玩家和经典规则重新发牌，公开罚牌、历史和策略统计会清空。", en: "Everyone has confirmed the results. Deal a fresh classic game with the same players, clearing collections, history and learned statistics." },
      judge: { zh: "真：你认为最后一位送牌人的声明和实际动物一致。假：你认为不一致。判断正确，最后一位送牌人收牌。判断错误，你收牌。不允许先偷看再判断。", en: "True means you believe the latest claim matches the card. False means it does not. Correct: the last sender collects it. Wrong: you collect it. You cannot peek first and then judge." },
      peek: { zh: "私下查看这张牌，然后必须转传。你可以保留声明或改口，但只能送给还没看过这张牌的玩家。最后一位未看牌者不能再转传。", en: "Look privately, then you must pass. Keep or change the claim, but choose someone who has not seen this card. The last unseen player must judge instead." },
      continue: { zh: "保留本次揭牌结果供所有人查看。每位玩家点击 Next Round 后，由收罚牌者发起下一轮。机器人会自动确认，观众不能代替玩家确认。", en: "The reveal stays visible until every player chooses Next Round. The collector opens next. Bots confirm automatically and spectators cannot confirm for players." },
      confirm: { zh: "确认已查看最终结果。所有玩家确认前，游戏留在终局结果页，不开放 Play Again。", en: "Confirm that you have reviewed the final result. Play Again stays unavailable until every player has confirmed." }
    };
    const COCKROACH_HELP = {
      gameId: "cockroach_poker",
      title: { zh: "德国蟑螂", en: "Cockroach Poker" },
      basic: {
        win: { zh: "别成为首先收集四张同类动物，或必须发起新一轮却没有手牌的人，其余人共同获胜。", en: "Avoid being first to collect four of one creature or being unable to open an exchange with a card, and share the win with everyone except the loser." },
        turn: { zh: "送一张暗牌并声明动物，接牌人不看牌判断真假，或偷看后转传给尚未看过的人。", en: "Offer a face-down card and name a creature, then its receiver judges true or false without looking or peeks and passes to someone who has not seen it." },
        key: { zh: "观察公开罚牌和对手的说谎习惯，混合真话、欺骗与转传来保护自己并施压。", en: "Read public collections and your opponents, mixing truth, bluffs and passing to protect yourself and create pressure." }
      },
      sections: [
        { id: "exchange", label: { zh: "暗传与揭牌", en: "The exchange" }, html: {
          zh: "<h3>送牌与声明</h3><p>经典版共六十四张牌，八类动物各八张，洗匀后全部发给三至六名玩家，人数不能整除时手牌数可相差一张。随机选一人先开始。点击自己的动物牌，再选择想宣称的动物和接收玩家，点击送出。声明可以是真话，也可以是谎话。</p><h3>不看牌判断</h3><p>接牌人选择真或假，再公开牌面。判断正确时，最后一个送牌人将该牌正面朝上收入自己的收集区。判断错误时，接牌人收牌。只有最后一位送牌人承担送牌责任，而不是最初出牌的人。</p><h3>偷看后必须转传</h3><p>只要还有其他没看过牌的玩家，你可以先私下偷看，再将同一张牌转传。可以保留声明，也可以改称任何一种动物，但不能再选择判断。不能传回已经看过的人。最后一位没有看过牌的人必须判断真假。</p><h3>揭牌暂停</h3><p>每次揭牌后保留结果，全部玩家点击 Next Round 才继续。收牌人发起下一轮。机器人自动确认，观众没有行动权限。</p>",
          en: "<h3>Offer and claim</h3><p>The classic deck has 64 cards, eight copies of each of eight creatures. Deal all cards to 3–6 players, allowing hands to differ by one. A random player starts. Select a card in your hand, choose any creature claim and a recipient, then send it. You may tell the truth or lie.</p><h3>Judge without looking</h3><p>The receiver chooses true or false, then reveals the card. If correct, the most recent sender collects it face up. If wrong, the receiver collects it. Responsibility belongs to the last sender, not necessarily the original owner.</p><h3>Peek commits you to passing</h3><p>If another unseen player remains, you may privately look and then pass the same card. Keep the old claim or announce any creature. You cannot judge after looking, and cannot send it back to anyone who has seen it. The final unseen player must judge.</p><h3>Pause after every reveal</h3><p>The result stays visible until every player chooses Next Round. The collector opens next. Bots confirm automatically and spectators cannot act.</p>"
        } },
        { id: "creatures", label: { zh: "动物与罚牌", en: "Creatures" }, html: {
          zh: "<p>八类动物是蟑螂(🪳)、蝙蝠(🦇)、苍蝇(🪰)、蟾蜍(🐸)、老鼠(🐀)、蝎子(🦂)、蜘蛛(🕷️)和椿象(🐞)。蟑螂与苍蝇在牌桌使用自绘图形，避免部分系统缺少表情字体。瓢虫图案代表椿象而非额外牌种。</p><p>动物没有特殊能力，也没有大小顺序。公开收集区中的数字是该玩家已经收下的同类罚牌数量。红色警示代表再拿一张就输。手牌中的数字表示你还可以送出的同类牌数。</p>",
          en: "<p>The eight creatures are Cockroach (🪳), Bat (🦇), Fly (🪰), Toad (🐸), Rat (🐀), Scorpion (🦂), Spider (🕷️) and Stink bug (🐞). Cockroach and Fly use original vector drawings on the table for font compatibility. The ladybird pictogram represents the stink bug, not an extra creature.</p><p>Creatures have no powers or ranking. Collection numbers show public penalties of that kind. Red warns that one more would lose. Hand numbers count cards you can still offer.</p>"
        } },
        { id: "end", label: { zh: "双人与终局", en: "Two players & ending" }, html: {
          zh: "<h3>只有一名输家</h3><p>三至六人时，首先收集四张同类动物的人输。另一个输法是必须发起新一轮时手里没有牌。仅仅打出最后一张牌不会立即输。没有集齐八类就输的规则，也不按罚牌总数比较胜负。</p><h3>双人规则</h3><p>洗牌后随机移除十张牌，任何人都不能查看，剩余五十四张平均发出。不能偷看转传，集齐五张同类动物才输。无牌发起新一轮的输法仍然适用。</p><h3>结果确认与策略机器人</h3><p>终局列出每个人的公开罚牌构成和手牌余量。所有人确认后才能 Play Again。本实现是基础经典版，不含皇家版特殊牌。机器人只读取和真人相同的授权视图，结合公开记牌、已揭牌声明的真假频率、对手判断习惯与集齐风险，随机混合说真话和诈唬，无需模型或额外依赖。</p>",
          en: "<h3>Exactly one loser</h3><p>With 3–6 players, collecting four of one creature loses. You also lose if you must open a new exchange but have no card. Playing your last card alone does not lose. Collecting all eight different creatures is not a loss condition, and total penalties do not determine winners.</p><h3>Two-player rules</h3><p>Remove ten random cards unseen before dealing the remaining 54 equally. There is no peek-and-pass option. Collecting five of one kind loses. Being unable to open an exchange still loses.</p><h3>Results and strategic bots</h3><p>The result lists every public collection and remaining hand size. Everyone confirms before Play Again. This is the classic base game, without Royal special cards. Bots use only the same authorized information as a human, combining public card counting, revealed truth frequencies, judgment habits and collection risk with mixed truth and bluffing. No model or extra dependencies are required.</p>"
        } }
      ]
    };
    const help = window.obgCreateHelp(COCKROACH_HELP);
    const explain = window.obgCreateExplain({
      gameId: "cockroach_poker", attribute: "data-cockroach-explain", explanations: explanations,
      button: byId("ExplainBtn"), root: () => panel,
      bypass: ["#cockroachPokerHelpBtn", "#cockroachPokerExplainBtn"]
    });
    const can = (type) => Boolean(view?.legal_actions.includes(type) && !inFlight);
    const creature = (kind) => view.creatures.find((entry) => entry.id === kind);
    const name = (playerId) => view.players.find((player) => player.player_id === playerId)?.name || "Guest";
    const label = (kind) => creature(kind)?.en || kind;
    function icon(kind) {
      if (kind === "cockroach") return '<span class="cp-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 14 12 3m17 11L36 3M15 21 5 16m10 12L3 29m14 6L7 43m26-22 10-5M33 28l12 1M31 35l10 8"/><ellipse cx="24" cy="27" rx="11" ry="15" fill="#ac7847"/><path d="M24 15v26M15 21l9 6 9-6"/><circle cx="21" cy="14" r="1"/><circle cx="27" cy="14" r="1"/></svg></span>';
      if (kind === "fly") return '<span class="cp-icon" aria-hidden="true"><svg viewBox="0 0 48 48" stroke="#314e52" stroke-width="2"><ellipse cx="14" cy="22" rx="9" ry="14" transform="rotate(-30 14 22)" fill="#b7dfe7"/><ellipse cx="34" cy="22" rx="9" ry="14" transform="rotate(30 34 22)" fill="#b7dfe7"/><ellipse cx="24" cy="29" rx="6" ry="12" fill="#58777b"/><circle cx="24" cy="15" r="7" fill="#64878b"/><circle cx="20" cy="14" r="3" fill="#d78c68"/><circle cx="28" cy="14" r="3" fill="#d78c68"/><path d="m18 27-8 6m20-6 8 6m-20 2-6 8m18-8 6 8"/></svg></span>';
      return `<span class="cp-icon" aria-hidden="true">${esc(creature(kind)?.icon)}</span>`;
    }
    function describe(node, key, text, passive = false) {
      explanations[key] = typeof text === "string" ? { zh: text, en: text } : text;
      node.setAttribute("data-cockroach-explain", key);
      if (passive) {
        node.dataset.cpTip = key;
        node.title = explanations[key].en;
        node.tabIndex = 0;
      }
    }
    function hideTooltip() {
      clearTimeout(tooltipTimer);
      byId("Tooltip").classList.add("hidden");
    }
    function showTooltip(node) {
      if (explain.isActive?.()) return;
      const text = explanations[node.dataset.cpTip];
      if (!text) return;
      const tooltip = byId("Tooltip");
      tooltip.textContent = text[window.obgHelpLang() === "en" ? "en" : "zh"];
      tooltip.classList.remove("hidden");
      const rect = node.getBoundingClientRect();
      tooltip.style.left = `${Math.max(10, Math.min(innerWidth - tooltip.offsetWidth - 10, rect.left))}px`;
      tooltip.style.top = `${Math.max(8, Math.min(innerHeight - tooltip.offsetHeight - 10, rect.bottom + 7))}px`;
      clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(hideTooltip, 3000);
    }
    function clearSelection() {
      selectedCard = null;
      selectedClaim = null;
      selectedTarget = null;
    }
    function send(type, fields = {}) {
      if (!can(type)) return;
      inFlight = true;
      hideTooltip();
      socket.emit("game:action", { action: { type, revision: view.revision, ...fields } });
      render();
      clearTimeout(requestTimer);
      requestTimer = setTimeout(() => { inFlight = false; render(); }, 5000);
    }
    function button(text, type, fields = {}) {
      const node = document.createElement("button");
      node.type = "button";
      node.textContent = text;
      node.disabled = !can(type);
      node.setAttribute("data-cockroach-explain", type === "judge" ? "judge" : type);
      node.addEventListener("click", () => send(type, fields));
      return node;
    }
    function renderPlayers() {
      byId("Players").replaceChildren();
      view.players.forEach((player, index) => {
        const node = document.createElement("article");
        const active = view.pending ? view.pending.receiver === player.player_id : view.active_player === player.player_id;
        node.className = `cp-player${active ? " cp-active" : ""}`;
        node.innerHTML = `<div class="cp-player-heading"><span aria-hidden="true">${["◆", "●", "▲", "■", "✦", "⬟"][index]}</span><strong class="cp-player-name" title="${esc(player.name)}">${esc(player.name)}</strong><span class="cp-player-meta">${player.is_you ? "You · " : ""}${player.hand_count} cards${player.ready ? " · ✓" : ""}</span></div><div class="cp-counts"></div>`;
        describe(node.querySelector(".cp-player-name"), `player_${index}`, `${player.name}${player.is_bot ? " · Bot" : ""} · ${player.hand_count} cards in hand.`, true);
        view.creatures.forEach((entry) => {
          const count = player.counts[entry.id];
          const chip = document.createElement("span");
          chip.className = `cp-count${count >= view.loss_limit - 1 ? " cp-danger" : ""}`;
          chip.innerHTML = `${icon(entry.id)}<span>${count}</span>`;
          describe(chip, `collection_${index}_${entry.id}`, {
            zh: `${player.name}：${entry.zh}(${entry.icon}) ${count}/${view.loss_limit}。达到 ${view.loss_limit} 张同类就输。`,
            en: `${player.name}: ${entry.en} (${entry.icon}) ${count}/${view.loss_limit}. Collecting ${view.loss_limit} of one kind loses.`
          }, true);
          node.querySelector(".cp-counts").appendChild(chip);
        });
        byId("Players").appendChild(node);
      });
    }
    function renderHand() {
      const hand = byId("Hand");
      hand.replaceChildren();
      byId("HandCount").textContent = view.players.some((player) => player.is_you) ? `${view.hand_count} cards · private` : "Spectating";
      view.creatures.forEach((entry) => {
        const cards = view.hand.filter((card) => card.kind === entry.id);
        if (!cards.length) return;
        const node = document.createElement("button");
        node.type = "button";
        node.className = "cp-hand-card";
        node.style.setProperty("--cp-color", entry.color);
        node.disabled = !can("offer");
        node.setAttribute("aria-pressed", String(selectedCard === cards[0].id));
        node.setAttribute("aria-label", `${entry.en}, ${cards.length} cards`);
        node.innerHTML = `${icon(entry.id)}<small>${esc(entry.en)}</small><strong>× ${cards.length}</strong>`;
        describe(node, `hand_${entry.id}`, { zh: `实际牌面是${entry.zh}(${entry.icon})，你有 ${cards.length} 张。选择后可以声明任何动物。`, en: `The actual card is ${entry.en} (${entry.icon}). You have ${cards.length}. Select it, then claim any creature.` }, !can("offer"));
        node.addEventListener("click", () => {
          selectedCard = selectedCard === cards[0].id ? null : cards[0].id;
          renderHand();
          renderComposer();
        });
        hand.appendChild(node);
      });
      if (!view.hand.length) hand.textContent = view.players.some((player) => player.is_you) ? "No cards in hand" : "Other players' hands are private.";
    }
    function renderComposer() {
      const visible = can("pass") || (view.phase === "offer" && selectedCard && view.legal_actions.includes("offer"));
      byId("Composer").classList.toggle("hidden", !visible);
      if (!visible) return;
      byId("Claims").replaceChildren();
      view.creatures.forEach((entry) => {
        const node = document.createElement("button");
        node.type = "button";
        node.disabled = inFlight;
        node.innerHTML = `${icon(entry.id)}<span>${esc(entry.en)}</span>`;
        node.setAttribute("aria-pressed", String(selectedClaim === entry.id));
        describe(node, `claim_${entry.id}`, { zh: `声明这是${entry.zh}(${entry.icon})。可以说真话，也可以说谎。`, en: `Claim this is a ${entry.en} (${entry.icon}). This may be true or a bluff.` });
        node.addEventListener("click", () => { selectedClaim = selectedClaim === entry.id ? null : entry.id; renderComposer(); });
        byId("Claims").appendChild(node);
      });
      byId("Targets").replaceChildren();
      view.targets.forEach((target) => {
        const node = document.createElement("button");
        node.type = "button";
        node.disabled = inFlight;
        node.textContent = name(target);
        node.title = name(target);
        node.setAttribute("aria-pressed", String(selectedTarget === target));
        describe(node, `target_${target}`, { zh: `送给 ${name(target)}。这名玩家还没看过这张暗牌。`, en: `Offer to ${name(target)}, who has not seen this card.` });
        node.addEventListener("click", () => { selectedTarget = selectedTarget === target ? null : target; renderComposer(); });
        byId("Targets").appendChild(node);
      });
      byId("SendBtn").textContent = view.phase === "pass" ? "Pass face down" : "Offer face down";
      byId("SendBtn").disabled = inFlight || !selectedClaim || !selectedTarget || (view.phase === "offer" && !selectedCard);
    }
    function renderExchange() {
      const center = byId("Center");
      const decisions = byId("Decisions");
      center.replaceChildren();
      decisions.replaceChildren();
      byId("Trail").textContent = "";
      const reviewing = ["review", "final_review", "game_over"].includes(view.phase);
      const pending = view.pending;
      if (reviewing && view.last_result) {
        const result = view.last_result;
        byId("Message").textContent = `${name(result.receiver)} called ${result.believe ? "true" : "false"} — ${result.correct ? "correct" : "wrong"}. ${name(result.collector)} collects ${label(result.card.kind)}.`;
        center.innerHTML = `<div class="cp-card">${icon(result.card.kind)}<strong>${esc(label(result.card.kind))}</strong><small>Claim: ${esc(label(result.claim))}</small></div>`;
        const actual = creature(result.card.kind);
        describe(center.firstElementChild, "revealed_card", {
          zh: `揭牌为${actual.zh}(${actual.icon})，声明为${creature(result.claim).zh}。${name(result.receiver)} 判断${result.believe ? "真" : "假"}，判断${result.correct ? "正确" : "错误"}，由 ${name(result.collector)} 收下公开罚牌。`,
          en: `Revealed ${actual.en} (${actual.icon}), claimed ${label(result.claim)}. ${name(result.receiver)} called ${result.believe ? "true" : "false"} and was ${result.correct ? "correct" : "wrong"}. ${name(result.collector)} collects this penalty.`
        }, true);
        byId("Trail").textContent = result.trail.map((step) => `${name(step.sender)} → ${name(step.receiver)}: ${label(step.claim)}`).join(" · ");
      } else if (pending) {
        byId("Message").textContent = `${name(pending.sender)} tells ${name(pending.receiver)}: “${label(pending.claim)}.”`;
        center.innerHTML = '<div class="cp-card cp-back" aria-label="Face-down card">?</div>';
        if (pending.card) {
          center.innerHTML += `<div class="cp-secret"><strong>Only you can see</strong><div class="cp-card">${icon(pending.card.kind)}<small>${esc(label(pending.card.kind))}</small></div></div>`;
          const actual = creature(pending.card.kind);
          describe(center.querySelector(".cp-secret .cp-card"), "private_card", {
            zh: `你看过的真实牌面是${actual.zh}(${actual.icon})。其他未看过的人只会收到暗牌。`,
            en: `You know this card is ${actual.en} (${actual.icon}). Players who have not seen it receive only a hidden card.`
          }, true);
        }
        byId("Trail").textContent = pending.trail.map((step) => `${name(step.sender)} → ${name(step.receiver)}: ${label(step.claim)}`).join(" · ");
      } else {
        byId("Message").textContent = `${name(view.active_player)}, choose a suspicious gift.`;
        center.innerHTML = '<div class="cp-card cp-back" aria-label="Choose a card">?</div>';
      }
      if (view.legal_actions.includes("judge")) {
        decisions.append(button("True", "judge", { believe: true }), button("False", "judge", { believe: false }));
        if (view.legal_actions.includes("peek")) decisions.appendChild(button("Peek & pass", "peek"));
      }
      if (view.legal_actions.includes("continue")) decisions.appendChild(button("Next Round", "continue"));
      if (view.legal_actions.includes("confirm")) decisions.appendChild(button("Confirm results", "confirm"));
      if (["review", "final_review"].includes(view.phase)) {
        const progress = document.createElement("span");
        progress.className = "cp-muted";
        progress.textContent = `${view.ready.length} / ${view.players.length} confirmed`;
        decisions.appendChild(progress);
      }
    }
    function renderFinal() {
      const final = byId("Final");
      final.classList.toggle("hidden", !view.loser);
      if (!view.loser) return;
      final.innerHTML = `<h3>${esc(name(view.loser))} loses</h3><p>${view.loss_reason === "same_kind" ? `Collected ${view.loss_limit} of one creature.` : "No card left to open the next exchange."}</p><p>Shared victory: ${view.winners.map((playerId) => esc(name(playerId))).join(", ")}</p>`;
      view.players.forEach((player) => {
        const row = document.createElement("div");
        row.className = "cp-final-row";
        const collection = view.creatures.map((entry) => `${entry.en} ${player.counts[entry.id]}`).join(" · ");
        row.textContent = `${player.name} — ${player.player_id === view.loser ? "Lost" : "Won"} · ${player.hand_count} cards in hand · ${collection}`;
        final.appendChild(row);
      });
      if (view.game_over && view.players.some((player) => player.is_you)) {
        const again = document.createElement("button");
        again.type = "button";
        again.className = "cp-primary";
        again.textContent = "Play Again";
        again.disabled = inFlight;
        again.setAttribute("data-cockroach-explain", "play_again");
        again.addEventListener("click", () => {
          if (inFlight || !view.game_over) return;
          inFlight = true;
          socket.emit("room:start", { config: {} });
          renderFinal();
          clearTimeout(requestTimer);
          requestTimer = setTimeout(() => { inFlight = false; renderFinal(); }, 5000);
        });
        final.appendChild(again);
      }
    }
    function render() {
      if (!view) return;
      panel.classList.toggle("cp-offering", view.phase === "offer");
      byId("Lobby").classList.add("hidden");
      byId("Table").classList.remove("hidden");
      byId("Round").textContent = `Exchange ${view.round}`;
      byId("Limit").textContent = `${view.loss_limit} of a kind loses`;
      describe(byId("Limit"), "collection", explanations.collection, true);
      const actor = view.pending?.receiver || view.active_player;
      byId("Status").textContent = view.game_over ? "Game over · results below" : view.phase === "final_review" ? "Final results · everyone must confirm" : view.phase === "review" ? "Reveal · waiting for everyone" : view.legal_actions.length ? (view.phase === "pass" ? "You looked — now pass it on" : "Your decision") : `Waiting for ${name(actor)}`;
      renderPlayers();
      renderExchange();
      renderHand();
      renderComposer();
      renderFinal();
      byId("Log").replaceChildren();
      view.log.slice().reverse().forEach((result) => {
        const node = document.createElement("li");
        node.textContent = `#${result.round} · ${name(result.sender)} claimed ${label(result.claim)} · ${name(result.receiver)} called ${result.believe ? "true" : "false"} · ${label(result.card.kind)} → ${name(result.collector)}`;
        byId("Log").appendChild(node);
      });
      explain.refresh?.();
    }
    function renderState(data) {
      if (data?.game_type !== "cockroach_poker" || !data.view) return;
      if (typeof currentRoomState !== "undefined" && currentRoomState?.room_id && currentRoomState.room_id !== data.room_id) return;
      const changed = activeRoom !== data.room_id || view?.you !== data.view.you || view?.revision !== data.view.revision;
      activeRoom = data.room_id;
      view = data.view;
      inFlight = false;
      clearTimeout(requestTimer);
      hideTooltip();
      if (changed) clearSelection();
      render();
    }
    function reset() {
      if (view || activeRoom) document.querySelectorAll("dialog.obg-explain-dialog[open]").forEach((dialog) => dialog.close());
      view = null;
      activeRoom = null;
      inFlight = false;
      clearTimeout(requestTimer);
      clearSelection();
      hideTooltip();
      help.close();
      explain.exit();
      byId("Table").classList.add("hidden");
      byId("Lobby").classList.remove("hidden");
      ["Hand", "Players", "Center", "Final", "Log", "Claims", "Targets"].forEach((suffix) => byId(suffix).replaceChildren());
    }
    function syncRoom(room) {
      if (!room || room.game_type !== "cockroach_poker" || room.status === "lobby" || (activeRoom && activeRoom !== room.room_id)) reset();
    }
    byId("HelpBtn").addEventListener("click", () => { explain.exit(); hideTooltip(); help.open(); });
    byId("ExplainBtn").addEventListener("click", () => { hideTooltip(); explain.toggle(); });
    byId("SendBtn").addEventListener("click", () => send(view.phase === "pass" ? "pass" : "offer", {
      ...(view.phase === "offer" ? { card: selectedCard } : {}), target: selectedTarget, claim: selectedClaim
    }));
    panel.addEventListener("pointerdown", (event) => {
      gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, touch: event.pointerType === "touch" };
      suppressClick = false;
    });
    document.addEventListener("pointermove", (event) => {
      if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 9) gesture.moved = true;
    }, true);
    document.addEventListener("pointerup", (event) => {
      if (gesture?.id !== event.pointerId) return;
      suppressClick = gesture.moved;
      if (gesture.touch && !gesture.moved) {
        const node = event.target.closest("[data-cp-tip]");
        if (node && panel.contains(node)) showTooltip(node);
      }
      gesture = null;
    }, true);
    document.addEventListener("pointercancel", () => { suppressClick = Boolean(gesture?.moved); gesture = null; }, true);
    panel.addEventListener("click", (event) => {
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!event.target.closest("button, details, [data-cp-tip]")) {
        clearSelection();
        if (view) { renderHand(); renderComposer(); }
      }
    }, true);
    panel.addEventListener("pointerover", (event) => {
      if (event.pointerType === "touch") return;
      const node = event.target.closest("[data-cp-tip]");
      if (node) showTooltip(node);
    });
    panel.addEventListener("focusin", (event) => {
      const node = event.target.closest("[data-cp-tip]");
      if (node) showTooltip(node);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      hideTooltip();
      clearSelection();
      if (view) { renderHand(); renderComposer(); }
    });
    window.addEventListener("scroll", hideTooltip, true);
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => {
      if (!inFlight) return;
      inFlight = false;
      clearTimeout(requestTimer);
      render();
    });
    window.renderCockroachPokerGameState = renderState;
    window.showCockroachPokerHeaderActions = (show) => {
      byId("HeaderActions").style.display = show ? "flex" : "none";
      if (!show) reset();
    };
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && typeof currentRoomState !== "undefined"
        && lastGameStatePayload?.room_id === currentRoomState?.room_id && currentRoomState?.status !== "lobby") renderState(lastGameStatePayload);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
