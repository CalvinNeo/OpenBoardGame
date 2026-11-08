(() => {
  "use strict";
  const panel = document.getElementById("noThanksPanel");
  const header = document.getElementById("noThanksHeaderActions");
  const dialog = document.getElementById("noThanksDialog");
  const tooltip = document.getElementById("noThanksTooltip");
  const configBox = document.getElementById("noThanksConfigBox");
  const byId = suffix => document.getElementById(`noThanks${suffix}`);
  let view = null;
  let pending = false;
  let pendingTimer = null;
  let suppressTimer = null;
  let tipTimer = null;
  let focusBeforeDialog = null;
  let configSignature = null;
  let renderSignature = null;

  const NO_THANKS_EXPLAIN = {
    pass: {
      zh: "No Thanks! · 拒收：支付 1 枚筹码(🔴)到当前牌上，轮到下一位玩家。没有筹码时不能拒收。",
      en: "No Thanks!: pay 1 chip (🔴) onto the current card and pass the turn to the next player. You cannot refuse when you have no chips left."
    },
    take: {
      zh: "Take Card · 拿牌：拿走数字牌(🃏)以及牌上的全部筹码(🔴)。系统翻出下一张牌，仍由你继续行动。连续数字只计最小值，筹码每枚抵 1 分。",
      en: "Take Card: take the number card (🃏) together with every chip (🔴) on it. The next card is turned over and you still act. Consecutive numbers score only their lowest value, and each chip cancels 1 point."
    },
    round: {
      zh: "Round · 局数：显示本局编号和总局数。每局重新洗牌并重置筹码，多局时把每局净分(＝)累计为总分，最低总分获胜。",
      en: "Round: shows the current round number and the total. Each round reshuffles and resets the chips, and in a multi round game the net scores (＝) add up to a total where the lowest wins."
    },
    deck: {
      zh: "Deck(🂠) · 剩余牌堆：显示尚未翻开的牌数，不包括桌面当前牌或玩家已收集的牌。数字牌为 3 到 35 共 33 张，每局随机暗移除 9 张，其余 24 张参与本局。最后一张牌被拿走后结算。",
      en: "Deck (🂠): how many cards are still face down, not counting the card on the table or the ones players collected. The deck runs from 3 to 35 for 33 cards, 9 are secretly removed each round, and the remaining 24 are in play. The round ends when the last card is taken."
    },
    card: {
      zh: "Card(🃏) · 当前牌：一张数字牌的数字就是罚分。牌组为 3 到 35，每局暗移除 9 张，所有人都不知道被移除了哪些数字，所以不要假定缺少的连接牌一定会出现。",
      en: "Card (🃏): the number on the card is the penalty itself. The deck runs from 3 to 35 with 9 secretly removed each round, and nobody knows which ones, so never assume a missing connecting card will show up."
    },
    pot: {
      zh: "Pot(🔴) · 牌上筹码：每次有人拒收，牌上就增加 1 枚筹码(🔴)。拿牌者同时收走全部筹码，可用来继续拒收，或留到结算抵扣分数。",
      en: "Pot (🔴): every refusal adds 1 chip (🔴) to the card. Whoever takes the card collects all of them, and they can be spent on later refusals or kept to cancel points at scoring."
    },
    chips: {
      zh: "Chips(🔴) · 你的筹码：拒收消耗 1 枚，拿牌补充牌上的全部筹码。3 到 5 人开局各 11 枚，6 人各 9 枚，7 人各 7 枚。每枚剩余筹码抵 1 分，结算前只显示你自己的数量，其他人的数量显示为锁(🔒)。",
      en: "Chips (🔴): refusing costs 1 chip and taking a card grants every chip on it. You start with 11 chips in a 3 to 5 player game, 9 with 6 players and 7 with 7 players. Each chip left cancels 1 point, only your own count is visible before scoring, and other players show a lock (🔒)."
    },
    cards: {
      zh: "Cards(🃏) · 牌面分：所有连续数字段(🔗)的最小数字之和，不是持有的牌张数。例如 13、14、15 只计 13 分，另有 17 时共计 30 分。这里还未减去筹码(🔴)。",
      en: "Cards (🃏): the sum of the lowest number in every run (🔗) of consecutive cards, not the number of cards you hold. Holding 13, 14 and 15 scores only 13, and adding a separate 17 makes 30. Chips (🔴) are not subtracted yet."
    },
    runs: {
      zh: "Runs(🔗) · 连续数字：每一组连续数字只计算最小值。深色牌是计分的段首，浅色牌不额外计分。比如 13、14、15 只计 13，再有 17 时共计 30，补上 16 后合并为一段只计 13。",
      en: "Runs (🔗): each group of consecutive numbers scores only its lowest card. The dark card is the scoring head of the run and the lighter ones add nothing. So 13, 14 and 15 score 13, a separate 17 makes 30, and adding 16 merges them into one run worth 13."
    },
    score: {
      zh: "Net(＝) · 本局净分：牌面分(🃏)减去剩余筹码(🔴)。分数越低越好，也可以是负数。多局时将每局净分相加，最低总分获胜，并列时共同获胜。",
      en: "Net (＝): your card points (🃏) minus your remaining chips (🔴). Lower is better and the result may be negative. In a multi round game the net scores add up, the lowest total wins, and a tie is a shared win."
    },
    total: {
      zh: "Total · 累计总分：已经结算的各局净分(＝)之和，不包括正在进行的这一局。最后一局结束后总分最低者获胜，并列时共同获胜。",
      en: "Total: the sum of the net scores (＝) from the rounds already settled, not counting the round in progress. After the last round the lowest total wins and a tie is a shared win."
    },
    winner: {
      zh: "Winner(🏆) · 获胜者：所有局结束后累计总分最低的玩家。分数越低越好，并列最低的玩家共同获胜。",
      en: "Winner (🏆): the player with the lowest total once every round is over. Lower is better, and players tied at the lowest share the win."
    },
    delta: {
      zh: "Take change(Δ) · 拿牌净分变化：拿牌之后的本局净分减去拿牌之前的本局净分，已经计算连续段合并和收到的筹码。例如 −12 表示罚分会减少 12，+6 表示会增加 6。这不是对未来牌的预测。",
      en: "Take change (Δ): your net score after taking the card minus your net score before it, already accounting for merged runs and collected chips. A value of −12 means the penalty drops by 12 and +6 means it grows by 6. It is not a prediction about future cards."
    },
    next: {
      zh: "Next Round：确认已看完本局计分。所有玩家都确认后才重新发牌，AI 会自动确认，断线的真人仍需重连后确认。",
      en: "Next Round: confirm that you have read the round scores. The next deal starts only once every player confirms, AI players confirm on their own, and a disconnected human must reconnect and confirm."
    },
    dialog_close: {
      zh: "关闭当前对话框并回到牌桌。",
      en: "Close the current dialog and return to the table."
    }
  };

  const NO_THANKS_HELP_CONFIG = {
    gameId: "no_thanks",
    title: { zh: "不了不了 · No Thanks!", en: "No Thanks!" },
    basic: {
      win: {
        zh: "分数越低越好。牌面分(🃏)带来罚分，筹码(🔴)每枚抵 1 分，单局结束时最低分获胜，多局时累计总分最低者获胜。",
        en: "Lower is better. Cards (🃏) are penalties and each chip (🔴) cancels 1 point, so the lowest score wins a single round and the lowest total wins a multi round game."
      },
      turn: {
        zh: "轮到你时二选一：支付 1 枚筹码(🔴)拒收这张牌并轮到下一位，或者拿走当前牌(🃏)连同牌上全部筹码，然后翻下一张牌并由你继续行动。",
        en: "On your turn you either pay 1 chip (🔴) to refuse the card and pass the turn on, or take the current card (🃏) with every chip on it, turn over the next card and keep acting."
      },
      key: {
        zh: "每局有 9 张牌被暗移除，所以你要判断的是拿牌的净分变化(Δ)与拒收成本之间的取舍，而不是指望某张连接牌一定会出现。",
        en: "Nine cards are secretly removed every round, so the real decision is weighing the net change (Δ) of taking a card against the cost of refusing, rather than hoping a particular connecting card shows up."
      }
    },
    sections: [
      {
        id: "goal",
        label: { zh: "目标", en: "Goal" },
        html: {
          zh: "<p>3 到 7 人。牌面分(🃏)带来罚分，筹码(🔴)每枚抵 1 分，分数越低越好。单局结束时最低分获胜，选择多局时累计计分，并列最低的玩家共同成为获胜者(🏆)。</p>",
          en: "<p>For 3 to 7 players. Cards (🃏) are penalties and each chip (🔴) cancels 1 point, so lower is better. The lowest score wins a single round, and in a multi round game the scores accumulate so the players tied at the lowest share the win (🏆).</p>"
        }
      },
      {
        id: "setup",
        label: { zh: "准备", en: "Setup" },
        html: {
          zh: "<p>数字牌为 3 到 35 共 33 张，随机暗移除 9 张，其余 24 张组成牌堆(🂠)。先翻 1 张，牌堆旁的数字不包括这张当前牌。</p><p>3 到 5 人各拿 11 枚筹码(🔴)，6 人各拿 9 枚，7 人各拿 7 枚。筹码数量对其他人隐藏(🔒)，结算时公开。</p>",
          en: "<p>The deck runs from 3 to 35 for 33 cards. Nine are secretly removed and the remaining 24 form the deck (🂠). One card is turned over first, and the number beside the deck does not include that current card.</p><p>You start with 11 chips (🔴) in a 3 to 5 player game, 9 with 6 players and 7 with 7 players. Chip counts are hidden from each other (🔒) until scoring.</p>"
        }
      },
      {
        id: "turn",
        label: { zh: "拒收或拿牌", en: "Refuse or take" },
        html: {
          zh: "<p><strong>No Thanks!</strong> 支付 1 枚筹码(🔴)到牌上并轮到下一位，没有筹码时不能拒收。</p><p><strong>Take Card</strong> 拿走当前牌(🃏)及牌上的全部筹码(🔴)，然后翻下一张牌，仍由你行动。你可以连续拿牌，直到选择拒收。</p><p>牌上筹码(🔴)是当前累积的数量，拿牌时全部归你。</p>",
          en: "<p><strong>No Thanks!</strong> pays 1 chip (🔴) onto the card and passes the turn on, and you cannot refuse with no chips left.</p><p><strong>Take Card</strong> takes the current card (🃏) and every chip (🔴) on it, turns over the next card, and you still act. You may keep taking cards until you choose to refuse.</p><p>The pot (🔴) is what has piled up on the card so far and all of it goes to whoever takes it.</p>"
        }
      },
      {
        id: "runs",
        label: { zh: "连号只算段首", en: "Runs count once" },
        html: {
          zh: "<p>把公开的牌按连续数字分组(🔗)，每段只计算最小数字，深色段首计分而浅色牌不额外计分。牌面分(🃏)是这些段首之和，净分(＝)是牌面分减去剩余筹码(🔴)。</p><p class='no-thanks-rule-example'>🃏 8 ｜ 13·14·15 ｜ 17 → 8 + 13 + 17 = 38<br>再拿 16 → 8 ｜ 13·14·15·16·17 → 8 + 13 = 21<br>还剩 6 枚 🔴 → 净分(＝) 21 − 6 = 15</p><p><strong>拿牌净分变化(Δ)</strong>显示现在拿牌会怎样改变净分，已经包含收回筹码的影响。绿色负数表示减分，旁边的净分预览显示拿牌后的结果。因为有 9 张牌不会出现，等一张连接牌可能落空。</p>",
          en: "<p>Group your face up cards into runs (🔗) of consecutive numbers and count only the lowest card of each run, where the dark head scores and the lighter cards add nothing. Card points (🃏) are the sum of those heads and net (＝) is card points minus your remaining chips (🔴).</p><p class='no-thanks-rule-example'>🃏 8 ｜ 13·14·15 ｜ 17 → 8 + 13 + 17 = 38<br>Adding 16 → 8 ｜ 13·14·15·16·17 → 8 + 13 = 21<br>With 6 chips (🔴) left → net (＝) 21 − 6 = 15</p><p><strong>Take change (Δ)</strong> shows how taking the card would move your net score right now, already including the chips you collect. A green negative number means you gain, and the net preview beside it shows the result after taking. Since nine cards never appear, waiting for a connecting card can easily fail.</p>"
        }
      },
      {
        id: "rounds",
        label: { zh: "本局结束与下一局", en: "Round end" },
        html: {
          zh: "<p>24 张牌全部被拿走后结算。局数显示当前是第几局，总分是已结算各局净分(＝)之和。多局时所有人点击 <strong>Next Round</strong> 才继续，AI 自动确认而真人不会被自动确认。每局重新洗牌并重置筹码。最终结算会保留牌面，通过房间控制重新开始。</p>",
          en: "<p>The round is scored once all 24 cards have been taken. Round shows which round you are in and Total is the sum of the net scores (＝) already settled. In a multi round game everyone presses <strong>Next Round</strong> before play continues, where AI confirms on its own and humans are never confirmed for them. Each round reshuffles and resets the chips, and the final scoring keeps the cards on screen until you restart from the room controls.</p>"
        }
      },
      {
        id: "online",
        label: { zh: "线上操作", en: "Online notes" },
        html: {
          zh: "<p>首局随机起始玩家，后续局按座位轮转。AI 只依据可见信息判断连号、筹码和竞争，不读取暗牌或他人的隐藏筹码。轮到你时收起的房间控制会显示红边。</p><p>点击 Explain 再点牌、数值或按钮即可查看解释，灰色按钮也可以解释，滑动只滚动不会打开解释。按 Esc 退出解释或关闭弹窗，电脑悬停可查看提示，手机点击后的提示在 3 秒后消失。</p>",
          en: "<p>The first round starts with a random player and later rounds rotate by seat. The AI only reads visible information about runs, chips and competition, and never peeks at the removed cards or another player's hidden chips. The collapsed room controls show a red edge on your turn.</p><p>Press Explain and then tap a card, a number or a button to read its rule, greyed out buttons can be explained too, and swiping only scrolls without opening an explanation. Esc leaves Explain or closes a dialog, hovering shows a tip on desktop, and a tip from a tap on a phone disappears after 3 seconds.</p>"
        }
      }
    ]
  };

  let noThanksHelpWidget = null;
  let noThanksExplainWidget = null;

  function initNoThanksHelpExplain() {
    if (noThanksHelpWidget || typeof window.obgCreateHelp !== "function") return;
    noThanksHelpWidget = window.obgCreateHelp(NO_THANKS_HELP_CONFIG);
    noThanksExplainWidget = window.obgCreateExplain({
      gameId: "no_thanks",
      attribute: "data-no-thanks-explain",
      explanations: NO_THANKS_EXPLAIN,
      button: byId("ExplainBtn"),
      root: () => panel,
      bypass: ["#noThanksHelpBtn", "#noThanksExplainBtn", "#noThanksDialogClose"]
    });
    byId("HelpBtn")?.addEventListener("click", () => {
      noThanksExplainWidget?.exit();
      noThanksHelpWidget.open();
    });
    byId("ExplainBtn")?.addEventListener("click", () => noThanksExplainWidget?.toggle());
  }

  function text(suffix, value) { byId(suffix).textContent = value; }
  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }
  function tip(node, message, key) {
    node.dataset.noThanksTip = message;
    node.tabIndex = 0;
    if (key) node.dataset.noThanksExplain = key;
    return node;
  }
  function playerName(id) { return view?.players.find(player => player.player_id === id)?.name || id || "—"; }
  function can(kind) { return !pending && view?.legal_actions.includes(kind) && socket.connected; }
  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function showTip(target, autoHide = false) {
    if (!target || noThanksExplainWidget?.isActive() || noThanksHelpWidget?.isOpen() || dialog.open) return;
    clearTimeout(tipTimer);
    tooltip.textContent = target.dataset.noThanksTip;
    tooltip.classList.remove("hidden");
    const rect = target.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    const left = Math.max(12, Math.min(rect.left, innerWidth - box.width - 12));
    const top = rect.bottom + box.height + 18 < innerHeight ? rect.bottom + 7 : Math.max(12, rect.top - box.height - 7);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function dispatch(kind) {
    if (!can(kind)) return;
    pending = true;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; renderActions(); }, 2500);
    renderActions();
    sendAction({type: kind});
  }
  function renderActions() {
    byId("Pass").disabled = !can("pass");
    byId("Take").disabled = !can("take");
    byId("Next").disabled = !can("next_round");
    text("Next", view?.next_round_ready.includes(view.you) ? "Ready ✓" : "Next Round");
    const yourTurn = view?.phase === "playing" && view.current_turn === view.you;
    document.getElementById("roomControlsPanel")?.classList.toggle("no-thanks-turn", Boolean(yourTurn && socket.connected));
    if (!view) return;
    const own = view.players.find(player => player.player_id === view.you);
    text("PassLabel", own?.chips === 0 ? "No chips left" : "Pay 1 🔴");
    if (view.phase !== "playing") return;
    const latest = view.history[view.history.length - 1];
    const lastMove = latest ? latest.type === "pass"
      ? `${playerName(latest.player_id)} passed ${latest.card} · ${latest.pot} 🔴 on the card.`
      : `${playerName(latest.player_id)} took ${latest.card} + ${latest.pot} 🔴.` : "";
    text("Decision", !socket.connected ? "Connection lost. Use Reconnect to rejoin."
      : pending ? "Sending your move…"
      : yourTurn ? own?.chips === 0 ? "No chips left. Take this card." : "Pay a chip or collect the offer."
      : lastMove || (own ? "Waiting for the next move." : "Watching this table."));
  }
  function renderRuns(container, player) {
    const previousScroll = container.scrollTop;
    container.replaceChildren();
    if (!player?.runs.length) container.append(element("span", "no-thanks-empty", "No cards yet"));
    for (const run of player?.runs || []) {
      const group = tip(element("div", "no-thanks-run"), `Runs（🔗）：${run.join(" · ")} 共计 ${run[0]} 分。`, "runs");
      run.forEach(value => group.append(element("span", "", value)));
      container.append(group);
    }
    container.scrollTop = previousScroll;
  }
  function renderPlayers() {
    const container = byId("Players");
    container.replaceChildren();
    const playing = view.phase === "playing";
    const players = view.players.filter(player => !playing || player.player_id !== view.you);
    if (!playing) players.sort((first, second) => view.game_over
      ? first.total_score - second.total_score : first.net_score - second.net_score);
    text("PlayersTitle", !playing ? view.game_over ? "Final standings" : "Round scores"
      : `${players.length < view.players.length ? "Other players" : "At the table"} · ${players.length}`);
    for (const player of players) {
      const card = element("article", "no-thanks-player");
      card.dataset.playerId = player.player_id;
      card.classList.toggle("is-current", playing && player.player_id === view.current_turn);
      card.classList.toggle("is-you", player.player_id === view.you);
      card.classList.toggle("is-winner", view.winner_ids.includes(player.player_id));
      const heading = element("div", "no-thanks-player-heading");
      heading.append(element("strong", "", player.name || player.player_id));
      const badges = element("div", "no-thanks-badges");
      if (player.player_id === view.you) badges.append(element("span", "", "You"));
      if (player.is_bot) badges.append(element("span", "", "Bot"));
      if (playing && player.player_id === view.current_turn) badges.append(element("span", "no-thanks-turn-badge", "Turn"));
      if (view.winner_ids.includes(player.player_id)) badges.append(tip(element("span", "", "🏆"), "Winner（🏆）：累计分最低，共同最低者共享胜利。", "winner"));
      heading.append(badges);
      const scores = element("div", "no-thanks-player-scores");
      scores.append(tip(element("span", "", `🃏 ${player.card_points}`), "Cards（🃏）：各连续段最小数字之和。", "cards"));
      scores.append(tip(element("span", "", player.chips == null ? "🔴 🔒" : `🔴 ${player.chips}`), "Chips（🔴）：结算前只有玩家本人可查看；🔒 表示隐藏。", "chips"));
      if (player.net_score != null) scores.append(tip(element("span", "no-thanks-player-net", `Net ${player.net_score}`), "Net（＝）：本局牌面分减去筹码。", "score"));
      if (view.total_rounds > 1) scores.append(tip(element("span", "", `Total ${player.total_score}`), "Total：已结算各局净分之和。", "total"));
      const runs = element("div", "no-thanks-runs");
      renderRuns(runs, player);
      card.append(heading, scores, runs);
      container.append(card);
    }
  }
  function renderHistory() {
    const log = byId("Log");
    const previousScroll = log.scrollTop;
    log.replaceChildren();
    const rows = [...view.history].reverse();
    text("MoveCount", rows.length ? `(${rows.length})` : "");
    if (!rows.length) log.append(element("li", "", "No moves yet."));
    rows.forEach(row => log.append(element("li", "", row.type === "pass"
      ? `${playerName(row.player_id)} passed ${row.card}. Pot: ${row.pot} 🔴.`
      : `${playerName(row.player_id)} took ${row.card} + ${row.pot} 🔴.`)));
    log.scrollTop = previousScroll;
    byId("ScoreHistory").classList.toggle("hidden", !view.score_history.length);
    const scores = byId("ScoreRows");
    const previousScoreScroll = scores.scrollTop;
    scores.replaceChildren();
    view.score_history.forEach(round => {
      const row = element("div", "no-thanks-score-round");
      row.append(element("strong", "", `Round ${round.round_number}`));
      round.players.forEach(player => row.append(element("div", "", `${playerName(player.player_id)}: ${player.card_points} − ${player.chips} 🔴 = ${player.round_score} · Total ${player.total_score}`)));
      scores.append(row);
    });
    scores.scrollTop = previousScoreScroll;
  }
  function render() {
    if (!view) return;
    const own = view.players.find(player => player.player_id === view.you);
    const playing = view.phase === "playing";
    const yourTurn = playing && view.current_turn === view.you;
    panel.classList.toggle("is-your-turn", yourTurn);
    panel.classList.toggle("is-ended", !playing);
    panel.classList.toggle("is-spectator", !own);
    text("Round", `Round ${view.round_number} / ${view.total_rounds}`);
    text("Remaining", `🂠 ${view.deck_count} left`);
    text("CardValue", view.current_card ?? "✓");
    byId("Card").setAttribute("aria-label", playing ? `Card ${view.current_card}` : "All cards collected");
    text("Pot", view.pot);
    text("YourChips", own?.chips ?? "—");
    text("YourCards", own?.card_points ?? "—");
    text("YourNet", own?.net_score ?? "—");
    text("PersonalTitle", own ? "Your position" : "Spectating");
    text("YourCardCount", own ? `· ${own.cards.length}` : "");
    text("YourTotal", `Total ${own?.total_score ?? "—"}`);
    byId("YourTotal").classList.toggle("hidden", !own || view.total_rounds <= 1);
    renderRuns(byId("YourRuns"), own);
    text("TakeLabel", `Collect +${view.pot} 🔴`);
    text("Delta", view.take_delta == null ? "—" : `${view.take_delta > 0 ? "+" : ""}${view.take_delta}`);
    byId("Delta").className = view.take_delta == null ? "" : view.take_delta <= 0 ? "no-thanks-good" : "no-thanks-cost";
    text("Projection", own && view.take_delta != null ? `Net ${own.net_score} → ${own.net_score + view.take_delta}` : "Net —");
    byId("Preview").classList.toggle("hidden", !own || !playing);
    if (view.game_over) {
      text("Status", "Game complete · final scores");
      text("Decision", "All 24 cards collected.");
      text("Result", `🏆 ${view.winner_ids.map(playerName).join(" & ")} ${view.winner_ids.length === 1 ? "wins" : "win"}! Lowest total: ${Math.min(...view.players.map(player => player.total_score))}.`);
    } else if (!playing) {
      text("Status", "Round complete · review the scores");
      text("Decision", "Everyone confirms before the next deal.");
      text("Result", "Card points − chips = round score. Scores are now revealed.");
    } else {
      text("Status", yourTurn ? "Your turn" : `Waiting for ${playerName(view.current_turn)}`);
    }
    byId("Result").classList.toggle("hidden", playing);
    byId("Review").classList.toggle("hidden", view.phase !== "round_summary");
    text("Ready", `${view.next_round_ready.length} / ${view.players.length} ready`);
    renderPlayers(); renderHistory(); renderActions();
  }

  byId("Pass").addEventListener("click", () => dispatch("pass"));
  byId("Take").addEventListener("click", () => dispatch("take"));
  byId("Next").addEventListener("click", () => dispatch("next_round"));
  byId("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus(); });
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-no-thanks-tip]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", event => { showTip(event.target.closest("[data-no-thanks-tip]")); });
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-no-thanks-tip]");
    if (target) showTip(target, true); else hideTip();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.classList.contains("hidden")) { noThanksExplainWidget?.exit(); hideTip(); }
  }, true);
  document.addEventListener("scroll", hideTip, true);
  window.addEventListener("resize", hideTip);
  window.addEventListener("blur", hideTip);

  function clearState() {
    view = null; pending = false; renderSignature = null;
    clearTimeout(pendingTimer); clearTimeout(suppressTimer);
    noThanksExplainWidget?.exit(); hideTip();
    if (dialog.open) dialog.close();
    ["Players", "YourRuns", "Log", "ScoreRows"].forEach(suffix => byId(suffix).replaceChildren());
    ["Result", "Review", "ScoreHistory"].forEach(suffix => byId(suffix).classList.add("hidden"));
    ["YourChips", "YourCards", "YourNet", "Delta", "Round"].forEach(suffix => text(suffix, "—"));
    text("Status", "Waiting to start"); text("CardValue", "?"); text("Pot", "0");
    ["YourCardCount", "YourTotal", "MoveCount"].forEach(suffix => text(suffix, ""));
    text("Remaining", "🂠 — left"); text("Decision", "Waiting for the first deal.");
    text("PersonalTitle", "Your position"); text("PlayersTitle", "At the table");
    text("Projection", "Net —"); text("PassLabel", "Pay 1 🔴"); text("TakeLabel", "Collect the offer");
    byId("Delta").className = "";
    byId("Preview").classList.remove("hidden");
    byId("YourTotal").classList.add("hidden");
    byId("Card").removeAttribute("aria-label");
    byId("MoveHistory").open = false;
    byId("ScoreHistory").open = false;
    panel.classList.remove("is-your-turn", "is-ended", "is-spectator");
    renderActions();
  }
  function syncConfig(state) {
    const visible = state?.game_type === "no_thanks" && state.status === "lobby";
    configBox.classList.toggle("hidden", !visible);
    configBox.setAttribute("aria-hidden", String(!visible));
    if (state?.game_type !== "no_thanks") return;
    const signature = JSON.stringify([state.room_id, state.game_config]);
    if (signature !== configSignature) {
      byId("Rounds").value = String(state.game_config?.rounds || 1);
      configSignature = signature;
    }
    if (visible && view) clearState();
  }
  window.getNoThanksConfig = () => view && currentRoomState?.status !== "lobby" ? {...view.config} : {rounds: Number(byId("Rounds").value)};
  window.renderNoThanksGameState = data => {
    if (data?.view?.game_id !== "no_thanks" || currentGameType !== "no_thanks") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const signature = JSON.stringify([data.room_id, data.view.round_number, data.view.turn_number, data.view.next_round_ready, data.view.you]);
    if (signature !== renderSignature) { pending = false; clearTimeout(pendingTimer); hideTip(); }
    renderSignature = signature;
    view = data.view; render();
  };
  window.clearNoThanksState = clearState;
  window.showNoThanksHeaderActions = visible => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) { clearState(); configBox.classList.add("hidden"); configBox.setAttribute("aria-hidden", "true"); }
    else if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
  };
  function sync() {
    socket.on("room:state", syncConfig);
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); renderActions(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); renderActions(); hideTip(); });
    socket.on("connect", renderActions);
    if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "no_thanks") window.renderNoThanksGameState(lastGameStatePayload);
  }
  initNoThanksHelpExplain();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
