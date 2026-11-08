// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const flip7HelpButton = document.getElementById("flip7HelpBtn");
const flip7ExplainButton = document.getElementById("flip7ExplainBtn");

const FLIP7_HELP_CONFIG = {
  gameId: "flip7",
  title: { zh: "翻七 · Flip 7", en: "Flip 7" },
  basic: {
    win: {
      zh: "把总分累计到 Target Score（默认 200）的玩家结束整局，此时总分最高的那位玩家获胜。",
      en: "The game ends once someone's total reaches the Target Score of 200 by default, and the highest total score at that moment wins."
    },
    turn: {
      zh: "轮到你时按 Flip 翻一张牌，或者按 Stay 收手，把当前牌面结算成本轮分数存进总分并退出这一轮。",
      en: "On your turn you either press Flip to turn over one more card, or press Stay to bank the cards in front of you as your round score and leave the round."
    },
    key: {
      zh: "你要收集尽量多的不同数字牌，可是同一个数字第二次出现就会让你爆掉(busted)，所以每一次 Flip 都是在多拿分和多冒险之间下注。",
      en: "You want as many different number cards as possible, yet a number appearing twice busts you, so every Flip is a bet between scoring more and risking everything."
    }
  },
  sections: [
    {
      id: "cards",
      label: { zh: "牌堆构成", en: "The deck" },
      html: {
        zh: "<p>牌堆里有三种牌：数字牌、行动牌和分数牌。数字牌从 0 到 12，其中 1 到 12 各有和数字相同的张数，所以越大的数字越容易翻到。</p>"
          + "<p>分数牌是 +2、+4、+6、+8、+10 和一张 x2，它们不会让你爆掉，只会让本轮分数变高。</p>"
          + "<p>行动牌有三种，每种三张：Second Chance、Freeze 和 Flip Three。</p>"
          + "<p>每一轮开始时，每位玩家都会自动先翻一张牌，然后才轮到第一个人行动。</p>",
        en: "<p>The deck holds three kinds of cards: number cards, action cards and scoring cards. Number cards run from 0 to 12, and each value from 1 to 12 appears as many times as its own number, so bigger numbers turn up more often.</p>"
          + "<p>The scoring cards are +2, +4, +6, +8, +10 and a single x2. They never bust you and only make the round score bigger.</p>"
          + "<p>There are three kinds of action card with three copies each, namely Second Chance, Freeze and Flip Three.</p>"
          + "<p>At the start of every round each player automatically flips one card before anyone gets to act.</p>"
      }
    },
    {
      id: "turn",
      label: { zh: "Flip 与 Stay", en: "Flipping and staying" },
      html: {
        zh: "<p>按 Flip 翻开的数字牌会加入你的牌面，前提是这个数字你还没有。翻到分数牌就直接加入牌面。</p>"
          + "<p>按 Stay 立刻结算当前牌面，把分数存进总分，并且本轮不能再翻牌，状态会显示成 out。</p>"
          + "<p>翻到一个你已经有的数字就是爆掉(busted)，你的整手牌作废，本轮记 0 分。</p>"
          + "<p>所以牌面越丰富，继续 Flip 的风险就越高。</p>",
        en: "<p>A number card you flip joins your tableau as long as you do not already hold that number, and a scoring card simply joins the tableau as well.</p>"
          + "<p>Stay settles your tableau at once, adds the score to your total and takes you out of the round with the status out.</p>"
          + "<p>Flipping a number you already hold is a bust, which wipes your whole tableau and scores zero for the round.</p>"
          + "<p>The fuller your tableau becomes, the riskier every further Flip is.</p>"
      }
    },
    {
      id: "actions",
      label: { zh: "三种行动牌", en: "The three action cards" },
      html: {
        zh: "<p>Second Chance 让你把它交给任意一位还在场并且手上没有这张牌的玩家，你也可以留给自己。之后这个人第一次爆掉时会被救回来，这张牌随即消失。</p>"
          + "<p>Freeze 让你指定任意一位还在场上的玩家，他立刻结算当前分数并退出本轮，既可能是救命也可能是截断。</p>"
          + "<p>Flip Three 只能由抽到它的人自己承受，他要连续翻三张牌，中途爆掉或者集齐七张就提前停止。</p>"
          + "<p>抽到行动牌时游戏会暂停，Pending Action 一栏显示这张牌和抽到它的人，由他点选目标玩家。</p>",
        en: "<p>Second Chance lets you hand it to any player still in the round who does not already hold one, yourself included. The next time that player would bust they are saved instead, and the card is used up.</p>"
          + "<p>Freeze lets you pick any player still in the round, who immediately banks their current score and leaves the round, which can rescue them or cut them short.</p>"
          + "<p>Flip Three always lands on the player who drew it, who has to flip three cards in a row and stops early on a bust or on collecting seven numbers.</p>"
          + "<p>Drawing an action card pauses the game, the Pending Action field names the card and the player who drew it, and that player clicks a target to resolve it.</p>"
      }
    },
    {
      id: "scoring",
      label: { zh: "计分与 flip7flash", en: "Scoring and flip7flash" },
      html: {
        zh: "<p>本轮分数等于所有数字牌之和乘以 x2 的倍数，再加上分数牌的点数。</p>"
          + "<p>集齐七张不同数字牌就会触发 flip7flash(🃏)，本轮立刻结束并且你额外获得 15 分奖励。</p>"
          + "<p>爆掉的玩家本轮记 0 分，之前翻到的牌全部作废。</p>"
          + "<p>当所有人都退出本轮，或者有人触发 flip7flash(🃏) 时，这一轮就结束。</p>",
        en: "<p>Your round score is the sum of your number cards multiplied by x2 for each copy you hold, plus the points on your scoring cards.</p>"
          + "<p>Collecting seven different number cards triggers flip7flash(🃏), which ends the round at once and earns you a 15 point bonus.</p>"
          + "<p>A busted player scores zero for the round and loses every card flipped so far.</p>"
          + "<p>The round ends when everyone has left it, or the moment somebody triggers flip7flash(🃏).</p>"
      }
    },
    {
      id: "ending",
      label: { zh: "回合与整局结束", en: "Rounds and the endgame" },
      html: {
        zh: "<p>每轮结束后 Last Round 会列出每个人本轮翻到的所有牌和拿到的分数。</p>"
          + "<p>只要还没有人达到 Target Score，就会自动开始新的一轮，所有人重新回到场上。</p>"
          + "<p>一旦有人达到或者超过 Target Score，整局结束，总分最高的玩家获胜。</p>",
        en: "<p>After each round the Last Round panel lists every card each player flipped and the score they took from it.</p>"
          + "<p>As long as nobody has reached the Target Score a fresh round starts automatically with everyone back in play.</p>"
          + "<p>The moment somebody reaches or passes the Target Score the game ends and the highest total score wins.</p>"
      }
    }
  ]
};

const FLIP7_EXPLAIN = {
  phase: { zh: "当前阶段。playing 是正常翻牌，action_target 是等待某位玩家为行动牌选择目标，round_end 是等待下一轮，game_over 表示整局结束。", en: "Current phase: playing is normal flipping, action_target waits for a player to pick a target for an action card, round_end waits for the next round, and game_over means the game has ended." },
  round: { zh: "当前是第几轮。每一轮都会重新发牌并清空所有人的牌面。", en: "Which round is being played. Every round deals fresh cards and clears every tableau." },
  turn: { zh: "现在轮到谁 Flip 或者 Stay。", en: "Whose turn it is to Flip or to Stay." },
  deck: { zh: "牌堆里还剩多少张牌。用完之后会把弃牌堆洗回去。", en: "How many cards are left in the deck. Once it runs out the discard pile is shuffled back in." },
  discard: { zh: "弃牌堆里的牌数。它决定牌堆还能洗回多少张，也让你大致判断剩下的数字分布。", en: "How many cards sit in the discard pile. It tells you how much can be shuffled back into the deck and roughly which numbers are left." },
  target_score: { zh: "整局的目标总分，默认是 200。有人达到它时游戏立刻结束。", en: "The total score the game is played to, 200 by default. The game ends as soon as somebody reaches it." },
  pending: { zh: "当前挂起的行动牌和抽到它的玩家。需要由他在下方的玩家列表里点选目标才能继续。", en: "The action card currently waiting and the player who drew it. That player has to click a target in the player list below before play continues." },
  flip7_winner: { zh: "本轮触发 flip7flash(🃏) 的玩家。他集齐了七张不同数字牌，本轮立刻结束并额外获得 15 分。", en: "The player who triggered flip7flash(🃏) this round by collecting seven different number cards, which ends the round at once and adds a 15 point bonus." },
  flip: { zh: "翻一张牌。翻到新的数字牌会扩大你的牌面，翻到重复数字则会爆掉(busted)。", en: "Flip one card. A new number card grows your tableau, while a number you already hold busts you." },
  stay: { zh: "收手，把当前牌面结算成本轮分数存进总分，然后退出本轮。", en: "Stay, which banks your current tableau as the round score and takes you out of the round." },
  players: { zh: "所有玩家的牌面和状态。score 是累计总分，numbers 是你手上不同数字牌的张数，busted 表示本轮爆掉记 0 分，second chance 表示你还留着一张保险牌。有行动牌挂起时，点击带高亮的玩家卡片就是把它选为目标。", en: "Every player's tableau and state. The score badge is the running total, numbers counts your distinct number cards, busted means a bust worth zero this round, and second chance means you still hold a safety card. While an action card is pending, clicking a highlighted player card chooses them as its target." },
  last_round: { zh: "上一轮的结果，按玩家列出本轮翻到的每一张牌和最终拿到的分数。", en: "The previous round's result, listing every card each player flipped and the score they ended up with." }
};

let flip7HelpWidget = null;
let flip7ExplainWidget = null;

function initFlip7HelpExplain() {
  if (flip7HelpWidget || typeof window.obgCreateHelp !== "function") return;
  flip7HelpWidget = window.obgCreateHelp(FLIP7_HELP_CONFIG);
  flip7ExplainWidget = window.obgCreateExplain({
    gameId: "flip7",
    attribute: "data-flip7-explain",
    explanations: FLIP7_EXPLAIN,
    button: flip7ExplainButton,
    root: () => document.getElementById("flip7Panel"),
    bypass: ["#flip7HelpBtn", "#flip7ExplainBtn"]
  });
  flip7HelpButton?.addEventListener("click", () => {
    flip7ExplainWidget?.exit();
    flip7HelpWidget.open();
  });
  flip7ExplainButton?.addEventListener("click", () => flip7ExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFlip7HelpExplain);
} else {
  initFlip7HelpExplain();
}

const flip7PhaseLabel = document.getElementById("flip7Phase");
const flip7RoundLabel = document.getElementById("flip7Round");
const flip7TurnLabel = document.getElementById("flip7Turn");
const flip7DeckLabel = document.getElementById("flip7Deck");
const flip7DiscardLabel = document.getElementById("flip7Discard");
const flip7TargetScoreLabel = document.getElementById("flip7TargetScore");
const flip7PendingLabel = document.getElementById("flip7Pending");
const flip7FlipWinnerLabel = document.getElementById("flip7FlipWinner");
const flip7Tableau = document.getElementById("flip7Tableau");
const flip7TargetSelection = document.getElementById("flip7TargetSelection");
const flip7ClearTargetBtn = document.getElementById("flip7ClearTarget");
const flip7Targets = document.getElementById("flip7Targets");
const flip7LastRound = document.getElementById("flip7LastRound");
const flip7Players = document.getElementById("flip7Players");
const flip7FlipBtn = document.getElementById("flip7FlipBtn");
const flip7StayBtn = document.getElementById("flip7StayBtn");

const flip7ActionButtons = {
  flip: flip7FlipBtn,
  stay: flip7StayBtn,
};

let currentFlip7View = null;
let flip7SelectedTarget = null;

function clearFlip7TargetSelection() {
  flip7SelectedTarget = null;
  if (currentFlip7View) {
    updateFlip7TargetSelection(currentFlip7View);
    renderFlip7Players(currentFlip7View);
  } else {
    updateFlip7TargetSelection(null);
  }
  updateFlip7ActionButtons();
}

function updateFlip7TargetSelection(view) {
  if (!flip7TargetSelection) {
    return;
  }
  if (!flip7SelectedTarget || !view) {
    flip7TargetSelection.textContent = "-";
    return;
  }
  const target = view.players.find((p) => p.player_id === flip7SelectedTarget);
  flip7TargetSelection.textContent = target ? target.name : "-";
}

function renderFlip7Tableau(view) {
  if (!flip7Tableau) {
    return;
  }
  flip7Tableau.innerHTML = "";
  const you = view.players.find((p) => p.player_id === view.you);
  if (!you || !Array.isArray(you.tableau) || !you.tableau.length) {
    flip7Tableau.textContent = "-";
    return;
  }
  you.tableau.forEach((card) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.textContent = card.label || "?";
    flip7Tableau.appendChild(slot);
  });
}

function renderFlip7Players(view) {
  if (!flip7Players) {
    return;
  }
  flip7Players.innerHTML = "";
  const pending = view.pending_action;
  const eligible = new Set((pending && pending.eligible_targets) || []);
  const isPendingActor = pending && view.you && pending.actor_id === view.you;
  if (flip7SelectedTarget && !eligible.has(flip7SelectedTarget)) {
    flip7SelectedTarget = null;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    const isEligible = eligible.has(player.player_id);
    if (pending && isEligible) {
      card.classList.add("flip7-target-eligible");
    }
    if (pending && isEligible && isPendingActor) {
      card.classList.add("flip7-target-selectable");
      card.addEventListener("click", () => {
        flip7SelectedTarget = player.player_id;
        updateFlip7TargetSelection(view);
        updateFlip7ActionButtons();
        renderFlip7Players(view);
        sendAction({ type: "choose_target", target_player_id: player.player_id });
      });
    }
    if (flip7SelectedTarget === player.player_id) {
      card.classList.add("flip7-target-selected");
    }
    if (player.status !== "active") {
      card.classList.add("disabled");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${player.score ?? 0}`;
    badges.appendChild(score);
    const status = document.createElement("span");
    status.className = "badge";
    const isBusted = player.status === "out" && player.round_score === 0;
    const displayStatus =
      isBusted ? "busted" : (player.status === "out" ? "out" : (player.status || "-"));
    status.textContent = displayStatus;
    if (isBusted) {
      status.classList.add("danger");
    }
    badges.appendChild(status);
    if (player.round_score !== null && player.round_score !== undefined) {
      const roundScore = document.createElement("span");
      roundScore.className = "badge";
      roundScore.textContent = `round ${player.round_score}`;
      badges.appendChild(roundScore);
    }
    if (player.flip7) {
      const flip7 = document.createElement("span");
      flip7.className = "badge highlight";
      flip7.textContent = "flip7flash";
      badges.appendChild(flip7);
    }
    if (player.has_second_chance) {
      const chance = document.createElement("span");
      chance.className = "badge";
      chance.textContent = "second chance";
      badges.appendChild(chance);
    }
    if (player.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    header.appendChild(badges);

    const tableauRow = document.createElement("div");
    tableauRow.className = "player-hand";
    if (Array.isArray(player.tableau) && player.tableau.length) {
      player.tableau.forEach((cardData) => {
        const slot = document.createElement("div");
        slot.className = "player-slot";
        slot.textContent = cardData.label || "?";
        tableauRow.appendChild(slot);
      });
    } else {
      const slot = document.createElement("div");
      slot.className = "player-slot empty";
      slot.textContent = "-";
      tableauRow.appendChild(slot);
    }

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `numbers ${player.numbers_count ?? 0}`;

    card.appendChild(header);
    card.appendChild(tableauRow);
    card.appendChild(meta);
    if (player.player_id === view.you) {
      const actionsRow = document.createElement("div");
      actionsRow.className = "flip7-player-actions row actions";
      if (flip7FlipBtn) {
        actionsRow.appendChild(flip7FlipBtn);
      }
      if (flip7StayBtn) {
        actionsRow.appendChild(flip7StayBtn);
      }
      if (actionsRow.children.length) {
        card.appendChild(actionsRow);
      }
    }
    flip7Players.appendChild(card);
  });
}

function renderFlip7LastRound(view) {
  if (!flip7LastRound) {
    return;
  }
  flip7LastRound.innerHTML = "";
  const summary = view.last_round_summary;
  if (!summary) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No previous round yet.";
    flip7LastRound.appendChild(empty);
    return;
  }

  const meta = document.createElement("div");
  meta.className = "hint";
  const roundText = Number.isInteger(summary.round) ? `Round ${summary.round}` : "Last round";
  const reasonText = summary.reason ? ` (${summary.reason})` : "";
  meta.textContent = `${roundText}${reasonText}`;
  flip7LastRound.appendChild(meta);

  const flipsByPlayer = summary.flips || {};
  const statusByPlayer = summary.status || {};
  const roundScoresByPlayer = summary.round_scores || {};
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const status = statusByPlayer[player.player_id] || "-";
    const roundScore = roundScoresByPlayer[player.player_id];
    const isBusted = status === "out" && roundScore === 0;
    const displayStatus = isBusted ? "busted" : status;
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = displayStatus;
    if (isBusted) {
      statusBadge.classList.add("danger");
    }
    badges.appendChild(statusBadge);
    if (summary.flip7_winner === player.player_id) {
      const flip7 = document.createElement("span");
      flip7.className = "badge highlight";
      flip7.textContent = "flip7flash";
      badges.appendChild(flip7);
    }
    header.appendChild(badges);
    card.appendChild(header);

    const flipsRow = document.createElement("div");
    flipsRow.className = "player-hand";
    const flips = Array.isArray(flipsByPlayer[player.player_id])
      ? flipsByPlayer[player.player_id]
      : [];
    if (flips.length) {
      flips.forEach((flip) => {
        const slot = document.createElement("div");
        slot.className = "player-slot";
        const label = typeof flip === "string" ? flip : flip.label;
        slot.textContent = label || "?";
        flipsRow.appendChild(slot);
      });
    } else {
      const slot = document.createElement("div");
      slot.className = "player-slot empty";
      slot.textContent = "-";
      flipsRow.appendChild(slot);
    }

    card.appendChild(flipsRow);
    flip7LastRound.appendChild(card);
  });
}

function isFlip7ActionAvailable(actionType) {
  if (!currentFlip7View || !Array.isArray(currentFlip7View.legal_actions)) {
    return false;
  }
  if (!currentFlip7View.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "choose_target") {
    return !!flip7SelectedTarget;
  }
  return true;
}

function updateFlip7ActionButtons() {
  if (currentGameType !== "flip7") {
    Object.values(flip7ActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(flip7ActionButtons).forEach(([actionType, button]) => {
    const allowed = isFlip7ActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function clearFlip7State() {
  currentFlip7View = null;
  flip7SelectedTarget = null;
  if (flip7PhaseLabel) {
    flip7PhaseLabel.textContent = "-";
  }
  if (flip7RoundLabel) {
    flip7RoundLabel.textContent = "-";
  }
  if (flip7TurnLabel) {
    flip7TurnLabel.textContent = "-";
  }
  if (flip7DeckLabel) {
    flip7DeckLabel.textContent = "-";
  }
  if (flip7DiscardLabel) {
    flip7DiscardLabel.textContent = "-";
  }
  if (flip7TargetScoreLabel) {
    flip7TargetScoreLabel.textContent = "-";
  }
  if (flip7PendingLabel) {
    flip7PendingLabel.textContent = "-";
  }
  if (flip7FlipWinnerLabel) {
    flip7FlipWinnerLabel.textContent = "-";
  }
  if (flip7Tableau) {
    flip7Tableau.innerHTML = "";
  }
  if (flip7TargetSelection) {
    flip7TargetSelection.textContent = "-";
  }
  if (flip7Targets) {
    flip7Targets.innerHTML = "";
  }
  if (flip7LastRound) {
    flip7LastRound.innerHTML = "";
  }
  if (flip7Players) {
    flip7Players.innerHTML = "";
  }
  updateFlip7ActionButtons();
}

function renderFlip7GameState(data) {
  const view = data.view;
  currentFlip7View = view;
  if (currentGameType !== "flip7") {
    currentGameType = "flip7";
    setGamePanelVisibility("flip7");
  }
  if (flip7PhaseLabel) {
    flip7PhaseLabel.textContent = view.phase || "-";
  }
  if (flip7RoundLabel) {
    flip7RoundLabel.textContent = view.round ?? "-";
  }
  if (flip7TurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    flip7TurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (flip7DeckLabel) {
    flip7DeckLabel.textContent = view.deck_count ?? "-";
  }
  if (flip7DiscardLabel) {
    flip7DiscardLabel.textContent = view.discard_count ?? "-";
  }
  if (flip7TargetScoreLabel) {
    flip7TargetScoreLabel.textContent = view.config ? view.config.target_score ?? "-" : "-";
  }
  if (flip7FlipWinnerLabel) {
    flip7FlipWinnerLabel.textContent = view.flip7_winner
      ? findPlayerName(view, view.flip7_winner)
      : "-";
  }
  if (flip7PendingLabel) {
    if (view.pending_action) {
      const actorName = view.pending_action.actor_id
        ? findPlayerName(view, view.pending_action.actor_id)
        : "-";
      flip7PendingLabel.textContent = `${view.pending_action.label} (${actorName})`;
    } else {
      flip7PendingLabel.textContent = "-";
    }
  }

  renderFlip7Tableau(view);
  updateFlip7TargetSelection(view);
  renderFlip7LastRound(view);
  renderFlip7Players(view);
  logGameEvents(data);
  updateFlip7ActionButtons();
}

if (flip7ClearTargetBtn) {
  flip7ClearTargetBtn.addEventListener("click", () => {
    clearFlip7TargetSelection();
  });
}

if (flip7FlipBtn) {
  flip7FlipBtn.addEventListener("click", () => {
    sendAction({ type: "flip" });
  });
}

if (flip7StayBtn) {
  flip7StayBtn.addEventListener("click", () => {
    sendAction({ type: "stay" });
  });
}
