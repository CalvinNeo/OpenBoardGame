// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const kobayakawaHelpButton = document.getElementById("kobayakawaHelpBtn");
const kobayakawaExplainButton = document.getElementById("kobayakawaExplainBtn");

const KOBAYAKAWA_HELP_CONFIG = {
  gameId: "kobayakawa",
  title: { zh: "小早川 · Kobayakawa", en: "Kobayakawa" },
  basic: {
    win: {
      zh: "整局在有玩家筹码(tokens)耗尽时立刻结束，最后手里筹码最多的那位玩家获胜。",
      en: "The game ends the moment any player runs out of tokens, and whoever holds the most tokens at that point wins."
    },
    turn: {
      zh: "每轮先轮流做一次行动，可以抽牌来调整自己的手牌，也可以换掉场中央的小早川牌，之后所有人再轮流决定要不要 Fight。",
      en: "Each round starts with one action per player, either drawing to adjust your hand or replacing the Kobayakawa card in the middle, and then everyone decides in turn whether to Fight."
    },
    key: {
      zh: "Fight 之后比的是手牌加上小早川牌加成之后的最终点数，而加成只发给手牌最小的人，所以拿到小牌并不等于赢。",
      en: "A fight is decided on your hand value plus the Kobayakawa bonus, and that bonus only goes to the player holding the smallest card, so a small card is not the same thing as a win."
    }
  },
  sections: [
    {
      id: "flow",
      label: { zh: "一轮的流程", en: "Anatomy of a round" },
      html: {
        zh: "<p>牌堆是 1 到 15 各一张。每轮开始时每位玩家拿到一张手牌，另外抽出一张放在场中央当作小早川牌(🎴)。</p>"
          + "<p>一轮分成两个阶段。行动阶段里每位玩家按座位顺序各做一次行动，下注阶段里同样按顺序决定 Fight 还是 Pass。</p>"
          + "<p>Players 面板里的 acted(✅) 表示这位玩家在行动阶段已经行动完毕。</p>",
        en: "<p>The deck holds one copy each of 1 through 15. Every round deals one card to each player and sets one more card aside in the middle as the Kobayakawa card(🎴).</p>"
          + "<p>A round has two phases. In the action phase every player takes exactly one action in seat order, and in the betting phase the same order decides Fight or Pass.</p>"
          + "<p>The acted(✅) mark in the Players panel shows that this player has already finished their action.</p>"
      }
    },
    {
      id: "action",
      label: { zh: "行动阶段", en: "The action phase" },
      html: {
        zh: "<p>按下 Draw 抽一张牌之后，你必须马上在 Keep Drawn 和 Discard Drawn 之间做出选择。</p>"
          + "<p>Keep Drawn 留下新抽到的牌，把原来的手牌丢进弃牌堆。Discard Drawn 保留原来的手牌，把刚抽到的那张丢掉。</p>"
          + "<p>Replace Kobayakawa 不动你的手牌，改成把场中央的小早川牌换掉，被换掉的旧牌进入弃牌堆。</p>"
          + "<p>Discard Pile 是完全公开的，你可以用它推算哪些数字已经不可能再出现。</p>",
        en: "<p>After pressing Draw you must immediately choose between Keep Drawn and Discard Drawn.</p>"
          + "<p>Keep Drawn takes the new card and throws your old hand card onto the discard pile. Discard Drawn keeps your old hand card and throws the freshly drawn one away.</p>"
          + "<p>Replace Kobayakawa leaves your hand alone and instead swaps the Kobayakawa card in the middle, sending the old one to the discard pile.</p>"
          + "<p>The Discard Pile is completely public, so you can use it to work out which numbers can no longer appear.</p>"
      }
    },
    {
      id: "betting",
      label: { zh: "Fight 与 Pass", en: "Fight and Pass" },
      html: {
        zh: "<p>按下 Fight 要先付出一个筹码放进底池(Pot)，然后你就有资格参加本轮的争夺。</p>"
          + "<p>按下 Pass 不花任何东西，代价是你这一轮完全退出，底池与你无关。</p>"
          + "<p>只有还剩筹码的玩家才能 Fight，筹码已经归零的玩家只能 Pass。</p>"
          + "<p>你的决定会在 Players 面板的 bet 一栏公开，所以后面行动的人能看见前面所有人的选择。</p>",
        en: "<p>Pressing Fight costs you one token, which goes straight into the pot, and it buys you a seat in this round's showdown.</p>"
          + "<p>Pressing Pass costs nothing, and the price is that you are out of the round and the pot has nothing to do with you.</p>"
          + "<p>Only a player who still holds tokens may Fight, and a player with no tokens left can only Pass.</p>"
          + "<p>Your decision is public in the bet column of the Players panel, so everyone acting later sees what the earlier players chose.</p>"
      }
    },
    {
      id: "showdown",
      label: { zh: "争夺与小早川加成", en: "The showdown and the bonus" },
      html: {
        zh: "<p>如果没有任何人 Fight，这一轮的底池原样留到下一轮，谁也拿不到它。</p>"
          + "<p>如果只有一位玩家 Fight，他不必比牌就直接赢走整个底池。</p>"
          + "<p>如果两位以上玩家 Fight 就进入争夺。手牌数字最小的那位玩家获得小早川牌的加成，他的最终点数等于自己的手牌加上小早川牌。</p>"
          + "<p>其他人的最终点数就是自己的手牌。最终点数最高的玩家赢下底池，点数打平时手牌数字更大的那位获胜。</p>"
          + "<p>这意味着最小的牌反而可能翻身，而一张中等偏大的牌往往两头不讨好。</p>",
        en: "<p>If nobody fights, the pot simply stays on the table for the next round and no one collects it.</p>"
          + "<p>If exactly one player fights, that player takes the whole pot without any comparison.</p>"
          + "<p>When two or more players fight the showdown begins. The fighter holding the smallest hand card receives the Kobayakawa bonus, making their final score their own card plus the Kobayakawa card.</p>"
          + "<p>Everyone else scores just their own hand card. The highest final score takes the pot, and a tie is broken in favour of the larger hand card.</p>"
          + "<p>That is why the smallest card can suddenly be the strongest one, while a middling large card tends to please nobody.</p>"
      }
    },
    {
      id: "ending",
      label: { zh: "结束与胜负", en: "Ending and winning" },
      html: {
        zh: "<p>赢下底池的玩家拿走全部筹码，并由他在下一轮先行动。没有发生争夺时，下一轮由本轮起始玩家的下家开始。</p>"
          + "<p>默认的结束条件是任何一位玩家筹码归零，此时立刻结算，筹码最多的玩家获胜，同分时可以并列。</p>"
          + "<p>另一种房间设置是打满固定轮数之后结束，胜负同样按筹码多少决定。</p>",
        en: "<p>The winner of the pot collects every token in it and opens the next round. When no showdown happened, the next round starts with the player after this round's start player.</p>"
          + "<p>The default ending condition is any player hitting zero tokens, which settles the game at once and hands the win to the player with the most tokens, with ties sharing the victory.</p>"
          + "<p>An alternative room setting ends the game after a fixed number of rounds, and the winner is decided by token count just the same.</p>"
      }
    }
  ]
};

const KOBAYAKAWA_EXPLAIN = {
  phase: { zh: "当前阶段。action 是行动阶段，betting 是决定 Fight 还是 Pass 的下注阶段，game_over 表示整局结束。", en: "Current phase: action is when you adjust your hand, betting is when you choose Fight or Pass, and game_over means the game has ended." },
  round: { zh: "当前是第几轮。", en: "Which round is being played." },
  turn: { zh: "现在轮到谁行动或者表态。", en: "Whose turn it is to act or to declare." },
  start_player: { zh: "本轮的起始玩家。行动阶段和下注阶段都从他开始。", en: "The player who opens this round. Both the action phase and the betting phase start with them." },
  kobayakawa_card: { zh: "场中央的小早川牌(🎴)。争夺时手牌最小的玩家可以把它的点数加到自己的最终点数上。", en: "The Kobayakawa card(🎴) in the middle. In a showdown the fighter with the smallest hand card adds its value to their final score." },
  pot: { zh: "当前底池里的筹码数量。每位 Fight 的玩家都往里放一个，赢的人一次拿走全部。", en: "How many tokens sit in the pot right now. Every fighter adds one, and the winner takes all of them at once." },
  deck: { zh: "牌堆里还剩多少张牌。它决定你还能不能抽牌或者更换小早川牌。", en: "How many cards are left in the deck. It decides whether you can still draw or replace the Kobayakawa card." },
  winner: { zh: "整局结束时筹码最多的玩家，同分时会并列显示。", en: "The player holding the most tokens when the game ends, shown together when several players tie." },
  round_notice: { zh: "上一轮的结果，包括底池归属、谁拿到了小早川牌加成，以及每位参战者的手牌与最终点数。", en: "The previous round's result, including who took the pot, who received the Kobayakawa bonus, and the hand card and final score of every fighter." },
  hand: { zh: "你当前的手牌，也就是争夺时使用的数字。除非你主动换牌，它会一直留到本轮结束。", en: "Your current hand card, the number you bring to a showdown. It stays with you for the whole round unless you swap it yourself." },
  drawn: { zh: "你刚刚抽到但还没有决定的牌。你必须选择留下它还是丢掉它，这一轮的行动才算完成。", en: "The card you just drew and have not resolved yet. You must either keep it or discard it before your action counts as finished." },
  draw: { zh: "从牌堆抽一张牌，抽完之后必须马上选择 Keep Drawn 或者 Discard Drawn。", en: "Draw one card from the deck, after which you must immediately choose Keep Drawn or Discard Drawn." },
  replace: { zh: "不动自己的手牌，把场中央的小早川牌换成牌堆顶的新牌。这会改变争夺时的加成大小。", en: "Leave your hand alone and swap the Kobayakawa card in the middle for a fresh card off the deck, which changes how big the bonus will be." },
  keep_drawn: { zh: "留下刚抽到的牌作为新手牌，把原来的手牌丢进弃牌堆。", en: "Keep the freshly drawn card as your new hand and throw your old card onto the discard pile." },
  discard_drawn: { zh: "保留原来的手牌，把刚抽到的那张丢进弃牌堆。", en: "Keep your existing hand card and throw the freshly drawn one onto the discard pile." },
  fight: { zh: "支付一个筹码进入本轮争夺。手牌最小的玩家会获得小早川牌(🎴)加成，最终点数最高的人赢走底池。", en: "Pay one token to enter this round's showdown. The smallest hand card gets the Kobayakawa card(🎴) bonus, and the highest final score takes the pot." },
  pass: { zh: "不花筹码，直接退出本轮争夺。底池会与你无关地留给别人。", en: "Spend nothing and drop out of this round's showdown, leaving the pot to the others." },
  discard: { zh: "公开的弃牌堆。这里的每一张牌都不会再出现，是你推算别人手牌的关键信息。", en: "The public discard pile. None of these cards can come back, which makes it the key information for working out what other players hold." },
  players: { zh: "所有玩家的筹码数量和当前状态。acted(✅) 表示行动阶段已完成，bet 一栏显示他选了 Fight 还是 Pass。", en: "Every player's token count and current state. The acted(✅) mark means the action phase is done for them, and the bet column shows whether they chose Fight or Pass." }
};

let kobayakawaHelpWidget = null;
let kobayakawaExplainWidget = null;

function initKobayakawaHelpExplain() {
  if (kobayakawaHelpWidget || typeof window.obgCreateHelp !== "function") return;
  kobayakawaHelpWidget = window.obgCreateHelp(KOBAYAKAWA_HELP_CONFIG);
  kobayakawaExplainWidget = window.obgCreateExplain({
    gameId: "kobayakawa",
    attribute: "data-kobayakawa-explain",
    explanations: KOBAYAKAWA_EXPLAIN,
    button: kobayakawaExplainButton,
    root: () => document.getElementById("kobayakawaPanel"),
    bypass: ["#kobayakawaHelpBtn", "#kobayakawaExplainBtn"]
  });
  kobayakawaHelpButton?.addEventListener("click", () => {
    kobayakawaExplainWidget?.exit();
    kobayakawaHelpWidget.open();
  });
  kobayakawaExplainButton?.addEventListener("click", () => kobayakawaExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initKobayakawaHelpExplain);
} else {
  initKobayakawaHelpExplain();
}

let currentKobayakawaView = null;

const kobayakawaPhaseLabel = document.getElementById("kobayakawaPhase");
const kobayakawaRoundLabel = document.getElementById("kobayakawaRound");
const kobayakawaTurnLabel = document.getElementById("kobayakawaTurn");
const kobayakawaStartLabel = document.getElementById("kobayakawaStartPlayer");
const kobayakawaCardLabel = document.getElementById("kobayakawaCard");
const kobayakawaPotLabel = document.getElementById("kobayakawaPot");
const kobayakawaDeckLabel = document.getElementById("kobayakawaDeck");
const kobayakawaWinnerLabel = document.getElementById("kobayakawaWinner");
const kobayakawaRoundNotice = document.getElementById("kobayakawaRoundNotice");
const kobayakawaRoundNoticeTitle = document.getElementById("kobayakawaRoundNoticeTitle");
const kobayakawaRoundNoticeBody = document.getElementById("kobayakawaRoundNoticeBody");
const kobayakawaRoundNoticeList = document.getElementById("kobayakawaRoundNoticeList");
const kobayakawaHandLabel = document.getElementById("kobayakawaHand");
const kobayakawaDrawnLabel = document.getElementById("kobayakawaDrawn");
const kobayakawaDrawBtn = document.getElementById("kobayakawaDrawBtn");
const kobayakawaReplaceBtn = document.getElementById("kobayakawaReplaceBtn");
const kobayakawaKeepDrawnBtn = document.getElementById("kobayakawaKeepDrawnBtn");
const kobayakawaDiscardDrawnBtn = document.getElementById("kobayakawaDiscardDrawnBtn");
const kobayakawaFightBtn = document.getElementById("kobayakawaFightBtn");
const kobayakawaPassBtn = document.getElementById("kobayakawaPassBtn");
const kobayakawaDiscard = document.getElementById("kobayakawaDiscard");
const kobayakawaPlayers = document.getElementById("kobayakawaPlayers");

const kobayakawaActionButtons = {
  draw_card: kobayakawaDrawBtn,
  replace_kobayakawa: kobayakawaReplaceBtn,
  keep_drawn: kobayakawaKeepDrawnBtn,
  discard_drawn: kobayakawaDiscardDrawnBtn,
  fight: kobayakawaFightBtn,
  pass: kobayakawaPassBtn,
};

function isKobayakawaActionAvailable(actionType) {
  if (!currentKobayakawaView || !Array.isArray(currentKobayakawaView.legal_actions)) {
    return false;
  }
  return currentKobayakawaView.legal_actions.includes(actionType);
}

function updateKobayakawaActionButtons() {
  if (currentGameType !== "kobayakawa") {
    Object.values(kobayakawaActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(kobayakawaActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isKobayakawaActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function clearKobayakawaState() {
  currentKobayakawaView = null;
  if (kobayakawaPhaseLabel) {
    kobayakawaPhaseLabel.textContent = "-";
  }
  if (kobayakawaRoundLabel) {
    kobayakawaRoundLabel.textContent = "-";
  }
  if (kobayakawaTurnLabel) {
    kobayakawaTurnLabel.textContent = "-";
  }
  if (kobayakawaStartLabel) {
    kobayakawaStartLabel.textContent = "-";
  }
  if (kobayakawaCardLabel) {
    kobayakawaCardLabel.textContent = "-";
  }
  if (kobayakawaPotLabel) {
    kobayakawaPotLabel.textContent = "-";
  }
  if (kobayakawaDeckLabel) {
    kobayakawaDeckLabel.textContent = "-";
  }
  if (kobayakawaWinnerLabel) {
    kobayakawaWinnerLabel.textContent = "-";
  }
  if (kobayakawaHandLabel) {
    kobayakawaHandLabel.textContent = "-";
  }
  if (kobayakawaDrawnLabel) {
    kobayakawaDrawnLabel.textContent = "-";
  }
  if (kobayakawaRoundNotice) {
    kobayakawaRoundNotice.classList.add("hidden");
    kobayakawaRoundNotice.setAttribute("aria-hidden", "true");
  }
  if (kobayakawaRoundNoticeTitle) {
    kobayakawaRoundNoticeTitle.textContent = "Last Round";
  }
  if (kobayakawaRoundNoticeBody) {
    kobayakawaRoundNoticeBody.textContent = "-";
  }
  if (kobayakawaRoundNoticeList) {
    kobayakawaRoundNoticeList.innerHTML = "";
  }
  if (kobayakawaDiscard) {
    kobayakawaDiscard.innerHTML = "";
  }
  if (kobayakawaPlayers) {
    kobayakawaPlayers.innerHTML = "";
  }
  updateKobayakawaActionButtons();
}

function formatKobayakawaWinner(view, winner) {
  if (!winner) {
    return "-";
  }
  if (Array.isArray(winner)) {
    if (!winner.length) {
      return "-";
    }
    return winner.map((pid) => findPlayerName(view, pid)).join(", ");
  }
  return findPlayerName(view, winner) || winner;
}

function renderKobayakawaRoundNotice(view) {
  if (!kobayakawaRoundNotice || !kobayakawaRoundNoticeBody || !kobayakawaRoundNoticeTitle) {
    return;
  }
  const summary = view && view.last_round_summary ? view.last_round_summary : null;
  if (!summary || !summary.result) {
    kobayakawaRoundNotice.classList.add("hidden");
    kobayakawaRoundNotice.setAttribute("aria-hidden", "true");
    if (kobayakawaRoundNoticeList) {
      kobayakawaRoundNoticeList.innerHTML = "";
    }
    return;
  }
  kobayakawaRoundNotice.classList.remove("hidden");
  kobayakawaRoundNotice.setAttribute("aria-hidden", "false");
  kobayakawaRoundNoticeTitle.textContent = view.game_over ? "Game Over" : "Last Round";
  const potValue = summary.pot ?? 0;
  let body = "";
  if (summary.result === "all_pass") {
    body = `All players passed · Pot carries ${potValue}`;
  } else if (summary.result === "solo") {
    const winnerName = summary.winner ? findPlayerName(view, summary.winner) : "-";
    body = `Solo win: ${winnerName} · Pot ${potValue}`;
  } else if (summary.result === "showdown") {
    const winnerName = summary.winner ? findPlayerName(view, summary.winner) : "-";
    const bonusName = summary.bonus_holder ? findPlayerName(view, summary.bonus_holder) : "-";
    const bonusValue = summary.kobayakawa ?? "-";
    body = `Winner: ${winnerName} · Bonus: ${bonusName} +${bonusValue} · Pot ${potValue}`;
  } else {
    body = summary.result;
  }
  kobayakawaRoundNoticeBody.textContent = body;
  if (kobayakawaRoundNoticeList) {
    kobayakawaRoundNoticeList.innerHTML = "";
    if (summary.result === "showdown" && Array.isArray(summary.fighters)) {
      summary.fighters.forEach((fighter) => {
        const line = document.createElement("div");
        line.className = "kobayakawa-summary-item";
        if (fighter.player_id === summary.winner) {
          line.classList.add("winner");
        }
        const name = findPlayerName(view, fighter.player_id);
        const hand = fighter.hand ?? "-";
        const finalScore = fighter.final_score ?? "-";
        const bonusTag =
          fighter.got_bonus && summary.kobayakawa !== undefined ? ` +${summary.kobayakawa}` : "";
        line.textContent = `${name}: ${hand}${bonusTag} = ${finalScore}`;
        kobayakawaRoundNoticeList.appendChild(line);
      });
    }
  }
}

function renderKobayakawaDiscard(view) {
  if (!kobayakawaDiscard) {
    return;
  }
  kobayakawaDiscard.innerHTML = "";
  const discard = Array.isArray(view.discard_pile) ? view.discard_pile : [];
  if (!discard.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No cards yet.";
    kobayakawaDiscard.appendChild(empty);
    return;
  }
  discard.forEach((card) => {
    const chip = document.createElement("div");
    chip.className = "kobayakawa-card-chip";
    chip.textContent = String(card);
    kobayakawaDiscard.appendChild(chip);
  });
}

function renderKobayakawaPlayers(view) {
  if (!kobayakawaPlayers) {
    return;
  }
  kobayakawaPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card kobayakawa-player-card";
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id || "-";
    const meta = document.createElement("div");
    meta.className = "kobayakawa-player-meta";
    const tokens = document.createElement("div");
    tokens.textContent = `tokens ${player.tokens ?? 0}`;
    const acted = document.createElement("div");
    acted.textContent = `acted ${player.action_done ? "✅" : "-"}`;
    const bet = document.createElement("div");
    bet.textContent = `bet ${player.bet_choice || "-"}`;
    meta.append(tokens);
    if (view.phase === "action") {
      meta.append(acted);
    } else if (view.phase === "betting") {
      meta.append(bet);
    }
    card.append(name, meta);
    kobayakawaPlayers.appendChild(card);
  });
}

function renderKobayakawaGameState(data) {
  const view = data.view;
  currentKobayakawaView = view;
  if (currentGameType !== "kobayakawa") {
    currentGameType = "kobayakawa";
    setGamePanelVisibility("kobayakawa");
  }

  if (kobayakawaPhaseLabel) {
    kobayakawaPhaseLabel.textContent = view.phase || "-";
  }
  if (kobayakawaRoundLabel) {
    kobayakawaRoundLabel.textContent = view.round ?? "-";
  }
  if (kobayakawaTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    kobayakawaTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (kobayakawaStartLabel) {
    const starter = view.players.find((p) => p.player_id === view.start_player);
    kobayakawaStartLabel.textContent = starter ? starter.name : view.start_player || "-";
  }
  if (kobayakawaCardLabel) {
    kobayakawaCardLabel.textContent = view.kobayakawa ?? "-";
  }
  if (kobayakawaPotLabel) {
    kobayakawaPotLabel.textContent = view.pot ?? 0;
  }
  if (kobayakawaDeckLabel) {
    kobayakawaDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (kobayakawaWinnerLabel) {
    kobayakawaWinnerLabel.textContent = formatKobayakawaWinner(view, view.winner);
  }
  if (kobayakawaHandLabel) {
    kobayakawaHandLabel.textContent = view.your_hand ?? "-";
  }
  if (kobayakawaDrawnLabel) {
    kobayakawaDrawnLabel.textContent = view.your_drawn ?? "-";
  }

  renderKobayakawaRoundNotice(view);
  renderKobayakawaDiscard(view);
  renderKobayakawaPlayers(view);
  logGameEvents(data);
  updateKobayakawaActionButtons();
}

if (kobayakawaDrawBtn) {
  kobayakawaDrawBtn.addEventListener("click", () => {
    sendAction({ type: "draw_card" });
  });
}

if (kobayakawaReplaceBtn) {
  kobayakawaReplaceBtn.addEventListener("click", () => {
    sendAction({ type: "replace_kobayakawa" });
  });
}

if (kobayakawaKeepDrawnBtn) {
  kobayakawaKeepDrawnBtn.addEventListener("click", () => {
    sendAction({ type: "keep_drawn" });
  });
}

if (kobayakawaDiscardDrawnBtn) {
  kobayakawaDiscardDrawnBtn.addEventListener("click", () => {
    sendAction({ type: "discard_drawn" });
  });
}

if (kobayakawaFightBtn) {
  kobayakawaFightBtn.addEventListener("click", () => {
    sendAction({ type: "fight" });
  });
}

if (kobayakawaPassBtn) {
  kobayakawaPassBtn.addEventListener("click", () => {
    sendAction({ type: "pass" });
  });
}
