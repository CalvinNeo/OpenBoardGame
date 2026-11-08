// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const halliHelpButton = document.getElementById("halliHelpBtn");
const halliExplainButton = document.getElementById("halliExplainBtn");

const HALLI_GALLI_HELP_CONFIG = {
  gameId: "halli_galli",
  title: { zh: "德国心脏病 · Halli Galli", en: "Halli Galli" },
  basic: {
    win: {
      zh: "你要把其他玩家的牌一张张赢到自己手上，直到全场只剩你一个人还有牌，你就赢下这一局。",
      en: "You win by taking every other player's cards until you are the only one at the table still holding any."
    },
    turn: {
      zh: "轮到你时翻开自己牌堆最上面的一张牌，把它正面朝上摆到自己面前，然后立刻盯住全场每种水果的总数。",
      en: "On your turn you flip the top card of your own pile face up in front of you, then watch the running total of every fruit on the table."
    },
    key: {
      zh: "只要任意一种水果在场上正好出现五个，你就抢着敲铃铛(🔔)，因为抢得最快的人能把所有人的明牌一次收走。",
      en: "The instant any single fruit appears exactly five times on the table, slam the bell (🔔), because the quickest player sweeps up every face-up card at once."
    }
  },
  sections: [
    {
      id: "cards",
      label: { zh: "水果牌", en: "Fruit cards" },
      html: {
        zh: "<p>牌堆里有四种水果，分别是香蕉(🍌)、草莓(🍓)、樱桃(🍒)和柠檬(🍋)。</p>"
          + "<p>基础牌组里每种水果各有十四张牌，其中五张印着 1、三张印着 2、三张印着 3、两张印着 4，还有一张印着 5。</p>"
          + "<p>开局时整副牌平均发给所有人，多出来的牌会被随机分配，所以每个人的牌堆厚度可能差一张。</p>"
          + "<p>扩展牌组还会加入同时印着两种水果的混合牌，结算时这两种水果要分别计入各自的总数。</p>",
        en: "<p>The deck contains four fruits: banana (🍌), strawberry (🍓), cherry (🍒) and lemon (🍋).</p>"
          + "<p>In the base deck each fruit has fourteen cards, five showing 1, three showing 2, three showing 3, two showing 4 and a single card showing 5.</p>"
          + "<p>The whole deck is dealt out at the start and any leftovers are handed out randomly, so one pile may be a card thicker than another.</p>"
          + "<p>The extended deck also adds mixed cards printed with two fruits, and each of those fruits counts separately towards its own total.</p>"
      }
    },
    {
      id: "flip",
      label: { zh: "翻牌回合", en: "Flipping" },
      html: {
        zh: "<p>轮到你时点自己的座位区就能翻牌，也可以按 Flip 按钮，翻开的是你牌堆最上面的一张牌。</p>"
          + "<p>翻出的牌会先盖着停顿片刻再亮出来，这段延迟保证所有人有同样的反应时间。</p>"
          + "<p>亮牌之后会开放几秒钟的抢铃窗口，窗口结束时才轮到下一位玩家。</p>",
        en: "<p>When it is your turn, click your own seat or press Flip to turn over the top card of your pile.</p>"
          + "<p>The flipped card stays hidden for a short moment before it is revealed, which gives everyone the same amount of reaction time.</p>"
          + "<p>A ringing window of a few seconds opens after the reveal, and the next player only takes over once that window closes.</p>"
      }
    },
    {
      id: "bell",
      label: { zh: "铃铛条件", en: "When to ring" },
      html: {
        zh: "<p>计算时只看每位存活玩家面前最上面的那一张明牌，把这些牌上的水果按种类分别相加。</p>"
          + "<p>只要有任意一种水果的总数正好等于 5，铃铛(🔔)就成立，几种水果同时凑够 5 也一样成立。</p>"
          + "<p>总数超过 5 就不算，所以一次翻牌既可能点亮铃铛，也可能刚好把它推过去。</p>"
          + "<p>你自己面前的牌同样计入，因此你翻出的牌经常是把机会亲手送给别人。</p>",
        en: "<p>Only the top face-up card in front of each surviving player counts, and those cards are added together fruit by fruit.</p>"
          + "<p>The bell (🔔) goes live as soon as any single fruit totals exactly 5, and several fruits reaching 5 at the same moment counts just as well.</p>"
          + "<p>A total above 5 does not count, so one flip can either light the bell up or push it right past the mark.</p>"
          + "<p>The cards in front of you are part of the count too, which means your own flip often hands the chance to somebody else.</p>"
      }
    },
    {
      id: "ring",
      label: { zh: "抢铃结果", en: "Ringing" },
      html: {
        zh: "<p>抢铃成功时，你会把场上所有人的明牌全部收走，塞到自己牌堆的最底下。</p>"
          + "<p>收牌之后只要你手上还有牌，就由你继续翻下一张，节奏会一直跟着刚赢牌的人走。</p>"
          + "<p>抢错铃的惩罚是给每位其他存活玩家各送一张牌，直接从你牌堆顶上抽走，所以乱按会很快把自己掏空。</p>"
          + "<p>抢铃窗口只在翻牌亮出之后的那几秒内开放，窗口一关就只能等下一次翻牌。</p>",
        en: "<p>A successful ring sweeps up every face-up card on the table and slides all of them to the bottom of your own pile.</p>"
          + "<p>After collecting you keep flipping for as long as you still hold cards, so the rhythm of the game stays with whoever just won the pile.</p>"
          + "<p>Ringing at the wrong moment costs you one card for every other surviving player, taken straight off the top of your pile, so careless rings empty you out fast.</p>"
          + "<p>The ringing window is only open for those few seconds after a flip is revealed, and once it closes you have to wait for the next flip.</p>"
      }
    },
    {
      id: "elimination",
      label: { zh: "淘汰与胜利", en: "Elimination" },
      html: {
        zh: "<p>当一位玩家手上和面前的牌都空了，他就被淘汰出局，不再参与翻牌和抢铃。</p>"
          + "<p>场上只剩一位还有牌的玩家时游戏立刻结束，他就是这一局的胜利者。</p>",
        en: "<p>A player with no cards left in hand and none in front of them is eliminated and takes no further part in flipping or ringing.</p>"
          + "<p>The game ends the moment only one player still holds cards, and that player is the winner.</p>"
      }
    }
  ]
};

const HALLI_GALLI_EXPLAIN = {
  turn: { zh: "现在轮到谁翻牌。只有轮到自己时才能翻牌，但抢铃铛(🔔)任何人都可以随时抢。", en: "Whose turn it is to flip. Only the current player may flip, while ringing the bell (🔔) is open to everyone." },
  bell_ready: { zh: "当前是否已经有一种水果正好凑够五个。显示 Yes 时括号里会写出是哪几种水果。", en: "Whether some fruit currently totals exactly five. When it reads Yes, the fruits involved are named in brackets." },
  winner: { zh: "本局的获胜者，也就是最后一位手上还有牌的玩家。", en: "The winner of the game, meaning the last player who still holds cards." },
  flip_countdown: { zh: "距离下一次可以翻牌还有多久。", en: "How long until the next flip is allowed." },
  ring_countdown: { zh: "距离这次翻牌亮出还有多久，亮出之后抢铃窗口才会打开。", en: "How long until the pending flip is revealed, after which the ringing window opens." },
  last_ring: { zh: "最近一次抢铃的结果。success 表示抢对并收走了所有人的明牌，fail 表示抢错并被罚牌。", en: "The result of the most recent ring. Success means the player swept the table, and fail means they rang wrongly and paid the penalty." },
  last_action: { zh: "最近一次发生的动作，可能是某人翻出了一张牌，也可能是某人抢了铃铛(🔔)。", en: "The most recent action, either a player flipping a card or a player ringing the bell (🔔)." },
  flip: { zh: "翻开自己牌堆最上面的一张牌，把它亮在自己面前。也可以直接点击自己的座位区。", en: "Turn over the top card of your own pile and place it face up in front of you. Clicking your own seat does the same thing." },
  ring: { zh: "敲响铃铛(🔔)。必须有一种水果在场上正好凑够五个，抢错就要给每位对手各送一张牌。", en: "Ring the bell (🔔). Some fruit must total exactly five on the table, and a wrong ring costs you one card for every opponent." },
  players: { zh: "所有玩家的座位。每人面前是当前计入总数的那张明牌，hand 是还没翻的牌，pile 是已经翻开的牌。轮到你时点击自己的座位即可翻牌。", en: "Every player's seat. The card in front of each player is the one that counts, hand is the cards still to be flipped and pile is the cards already revealed. Click your own seat to flip on your turn." },
  bell: { zh: "铃铛(🔔)。任何一种水果在场上正好凑够五个时立刻点击它，抢先的人收走所有明牌。", en: "The bell (🔔). Click it the moment any fruit totals exactly five on the table, and the quickest player takes every face-up card." }
};

let halliHelpWidget = null;
let halliExplainWidget = null;

function initHalliGalliHelpExplain() {
  if (halliHelpWidget || typeof window.obgCreateHelp !== "function") return;
  halliHelpWidget = window.obgCreateHelp(HALLI_GALLI_HELP_CONFIG);
  halliExplainWidget = window.obgCreateExplain({
    gameId: "halli_galli",
    attribute: "data-halli-explain",
    explanations: HALLI_GALLI_EXPLAIN,
    button: halliExplainButton,
    root: () => document.getElementById("halliPanel"),
    bypass: ["#halliHelpBtn", "#halliExplainBtn"]
  });
  halliHelpButton?.addEventListener("click", () => {
    halliExplainWidget?.exit();
    halliHelpWidget.open();
  });
  halliExplainButton?.addEventListener("click", () => halliExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHalliGalliHelpExplain);
} else {
  initHalliGalliHelpExplain();
}

const halliConfigBox = document.getElementById("halliConfigBox");
const halliDeckRow = document.getElementById("halliDeckRow");
const halliDeckSelect = document.getElementById("halliDeckSelect");

const halliTurnLabel = document.getElementById("halliTurn");
const halliBellLabel = document.getElementById("halliBell");
const halliWinnerLabel = document.getElementById("halliWinner");
const halliFlipCountdownLabel = document.getElementById("halliFlipCountdown");
const halliRingCountdownLabel = document.getElementById("halliRingCountdown");
const halliLastActionLabel = document.getElementById("halliLastAction");
const halliLastRingLabel = document.getElementById("halliLastRing");
const halliFlipBtn = document.getElementById("halliFlipBtn");
const halliRingBtn = document.getElementById("halliRingBtn");
const halliPlayers = document.getElementById("halliPlayers");
const halliBellCenter = document.getElementById("halliBellCenter");
const halliBellCountdown = document.getElementById("halliBellCountdown");

const halliFruitEmoji = {
  banana: "🍌",
  strawberry: "🍓",
  cherry: "🍒",
  lemon: "🍋",
};

const halliActionButtons = {
  flip: halliFlipBtn,
  ring: halliRingBtn,
};

let currentHalliView = null;
let halliCountdownTimer = null;
let halliCountdownState = {
  flipReadyAtMs: 0,
  ringReadyAtMs: 0,
  ringPending: false,
  turnSwitchAtMs: 0,
  flipWaitMs: 0,
};
let halliServerTimeOffsetMs = 0;

function updateHalliConfigRow() {
  const showRow = currentRoomState && currentGameType === "halli_galli" && currentRoomState.status === "lobby";
  if (halliConfigBox) {
    halliConfigBox.classList.toggle("hidden", !showRow);
    halliConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (halliDeckRow) {
    halliDeckRow.classList.toggle("hidden", !showRow);
    halliDeckRow.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function formatHalliFruit(fruit) {
  if (!fruit) {
    return "?";
  }
  return halliFruitEmoji[fruit] || fruit;
}

function formatHalliFruitList(fruits, totals = null) {
  if (!Array.isArray(fruits) || !fruits.length) {
    return "-";
  }
  return fruits
    .map((fruit) => {
      const emoji = formatHalliFruit(fruit);
      if (totals && Object.prototype.hasOwnProperty.call(totals, fruit)) {
        return `${emoji} ${totals[fruit]}`;
      }
      return emoji;
    })
    .join(", ");
}

function formatHalliCard(card) {
  if (!card) {
    return "-";
  }
  if (Array.isArray(card.fruits) && card.fruits.length) {
    const parts = card.fruits.map((entry) => {
      if (!entry) {
        return "?";
      }
      const emoji = formatHalliFruit(entry.fruit);
      const count = Number.isFinite(entry.count) ? entry.count : null;
      return count !== null ? `${emoji} ${count}` : emoji;
    });
    return parts.join(" + ");
  }
  const emoji = formatHalliFruit(card.fruit);
  const count = Number.isFinite(card.count) ? card.count : null;
  if (count !== null) {
    return `${emoji} ${count}`;
  }
  return emoji;
}

function formatHalliLastAction(view) {
  const last = view ? view.last_action : null;
  if (!last) {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  if (last.type === "flip") {
    const card = last.card;
    const cardLabel = card ? formatHalliCard(card) : "card";
    return `${actor} flipped ${cardLabel}`;
  }
  if (last.type === "ring") {
    if (last.result === "success") {
      const fruits = formatHalliFruitList(last.bell_fruits);
      return `${actor} rang (success: ${fruits}, +${last.collected || 0} cards)`;
    }
    return `${actor} rang (false, penalty ${last.penalty_given || 0})`;
  }
  return "-";
}

function formatHalliLastRingResult(view) {
  const last = view ? view.last_ring_result : null;
  if (!last) {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  const fruits = formatHalliFruitList(last.fruits);
  if (last.result === "success") {
    return `${actor} success: ${fruits}`;
  }
  return `${actor} fail: ${fruits}`;
}

function halliNowMs() {
  return Date.now() + halliServerTimeOffsetMs;
}

function formatCountdownMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "Ready";
  }
  if (ms < 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.ceil(ms / 1000)}s`;
}

function resetHalliCountdownLabels() {
  if (halliFlipCountdownLabel) {
    halliFlipCountdownLabel.textContent = "-";
    halliFlipCountdownLabel.classList.remove("halli-countdown-active");
  }
  if (halliRingCountdownLabel) {
    halliRingCountdownLabel.textContent = "-";
    halliRingCountdownLabel.classList.remove("halli-countdown-active");
  }
}

function startHalliCountdownTimer() {
  if (halliCountdownTimer || (!halliFlipCountdownLabel && !halliRingCountdownLabel)) {
    return;
  }
  halliCountdownTimer = window.setInterval(() => {
    if (currentGameType !== "halli_galli") {
      stopHalliCountdownTimer();
      return;
    }
    updateHalliCountdownLabels();
  }, 200);
}

function stopHalliCountdownTimer() {
  if (!halliCountdownTimer) {
    return;
  }
  window.clearInterval(halliCountdownTimer);
  halliCountdownTimer = null;
}

function updateHalliCountdownState(view) {
  if (!view) {
    halliCountdownState = {
      flipReadyAtMs: 0,
      ringReadyAtMs: 0,
      ringPending: false,
      turnSwitchAtMs: 0,
      flipWaitMs: 0,
    };
    halliServerTimeOffsetMs = 0;
    stopHalliCountdownTimer();
    resetHalliCountdownLabels();
    return;
  }
  const serverNow = Number(view.server_now_ms);
  if (Number.isFinite(serverNow)) {
    halliServerTimeOffsetMs = serverNow - Date.now();
  }
  const flipReadyAtMs = Number(view.flip_ready_at_ms);
  const flipWaitMs = view.config ? Number(view.config.flip_wait_ms) : 0;
  const pending = view.pending_flip;
  const ringReadyAtMs = pending ? Number(pending.reveal_at_ms) : 0;
  const turnSwitchAtMs = Number(view.turn_switch_at_ms);
  halliCountdownState = {
    flipReadyAtMs: Number.isFinite(flipReadyAtMs) ? flipReadyAtMs : 0,
    ringReadyAtMs: Number.isFinite(ringReadyAtMs) ? ringReadyAtMs : 0,
    ringPending: !!pending,
    turnSwitchAtMs: Number.isFinite(turnSwitchAtMs) ? turnSwitchAtMs : 0,
    flipWaitMs: Number.isFinite(flipWaitMs) ? Math.max(flipWaitMs, 0) : 0,
  };
  startHalliCountdownTimer();
  updateHalliCountdownLabels();
}

function updateHalliCountdownLabels() {
  if (!currentHalliView || currentGameType !== "halli_galli") {
    resetHalliCountdownLabels();
    return;
  }
  const now = halliNowMs();
  const flipRemaining =
    halliCountdownState.flipReadyAtMs > 0 ? halliCountdownState.flipReadyAtMs - now : 0;
  const ringRemaining =
    halliCountdownState.ringReadyAtMs > 0 ? halliCountdownState.ringReadyAtMs - now : 0;
  const ringWindowRemaining =
    halliCountdownState.turnSwitchAtMs > 0 ? halliCountdownState.turnSwitchAtMs - now : 0;

  if (halliFlipCountdownLabel) {
    halliFlipCountdownLabel.textContent = "-";
    halliFlipCountdownLabel.classList.remove("halli-countdown-active");
  }

  if (halliRingCountdownLabel) {
    let label = "Ready";
    let active = false;
    if (halliCountdownState.ringPending && ringRemaining > 0) {
      label = formatCountdownMs(ringRemaining);
      active = true;
    }
    halliRingCountdownLabel.textContent = label;
    halliRingCountdownLabel.classList.toggle("halli-countdown-active", active);
  }
  if (halliBellCountdown) {
    const show = !halliCountdownState.ringPending && ringWindowRemaining > 0 && isHalliActionAvailable("ring");
    if (show) {
      halliBellCountdown.textContent = formatCountdownMs(ringWindowRemaining);
      halliBellCountdown.classList.remove("hidden");
    } else {
      halliBellCountdown.textContent = "-";
      halliBellCountdown.classList.add("hidden");
    }
  }
}

function renderHalliPlayers(view) {
  if (!halliPlayers) {
    return;
  }
  halliPlayers.innerHTML = "";
  view.players.forEach((p, index) => {
    const card = document.createElement("div");
    card.className = "player-card halli-player-card";
    card.dataset.playerId = String(p.player_id ?? "");
    const seatIndex = (index % 8) + 1;
    card.classList.add(`halli-seat-${seatIndex}`);
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.eliminated) {
      card.classList.add("disabled");
    }
    if (p.player_id === view.you) {
      const flipAllowed = currentGameType === "halli_galli" && isHalliActionAvailable("flip");
      card.classList.add("halli-self-seat");
      card.classList.toggle("halli-self-actionable", flipAllowed);
      card.classList.toggle("halli-self-disabled", !flipAllowed);
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "Flip");
      card.setAttribute("aria-disabled", (!flipAllowed).toString());
      const triggerFlip = () => {
        if (!flipAllowed) {
          return;
        }
        sendAction({ type: "flip" });
      };
      card.addEventListener("click", triggerFlip);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          triggerFlip();
        }
      });
    }
    const info = document.createElement("div");
    info.className = "halli-player-info";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    info.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges halli-player-badges";
    const handBadge = document.createElement("span");
    handBadge.className = "badge";
    handBadge.textContent = `hand ${p.hand_count}`;
    badges.appendChild(handBadge);
    const pileBadge = document.createElement("span");
    pileBadge.className = "badge";
    pileBadge.textContent = `pile ${p.pile_count}`;
    badges.appendChild(pileBadge);
    if (p.player_id === view.you) {
      const youBadge = document.createElement("span");
      youBadge.className = "badge";
      youBadge.textContent = "you";
      badges.appendChild(youBadge);
    }
    if (p.is_bot) {
      const botBadge = document.createElement("span");
      botBadge.className = "badge";
      botBadge.textContent = "bot";
      badges.appendChild(botBadge);
    }
    if (p.eliminated) {
      const outBadge = document.createElement("span");
      outBadge.className = "badge";
      outBadge.textContent = "out";
      badges.appendChild(outBadge);
    }

    info.appendChild(badges);
    card.appendChild(info);

    const topCard = document.createElement("div");
    topCard.className = "halli-player-topcard";
    topCard.textContent = formatHalliCard(p.top_card);
    card.appendChild(topCard);
    halliPlayers.appendChild(card);
  });
}

function isHalliActionAvailable(actionType) {
  if (!currentHalliView || !Array.isArray(currentHalliView.legal_actions)) {
    return false;
  }
  return currentHalliView.legal_actions.includes(actionType);
}

function updateHalliActionButtons() {
  if (currentGameType !== "halli_galli") {
    Object.values(halliActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    if (halliBellCenter) {
      halliBellCenter.classList.remove("halli-bell-center-actionable");
      halliBellCenter.classList.add("halli-bell-center-disabled");
      halliBellCenter.setAttribute("aria-disabled", "true");
    }
    return;
  }
  Object.entries(halliActionButtons).forEach(([actionType, button]) => {
    const allowed = isHalliActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  if (halliBellCenter) {
    const ringAllowed = isHalliActionAvailable("ring");
    halliBellCenter.classList.toggle("halli-bell-center-actionable", ringAllowed);
    halliBellCenter.classList.toggle("halli-bell-center-disabled", !ringAllowed);
    halliBellCenter.setAttribute("aria-disabled", (!ringAllowed).toString());
  }
}

function clearHalliState() {
  currentHalliView = null;
  if (halliTurnLabel) {
    halliTurnLabel.textContent = "-";
  }
  if (halliBellLabel) {
    halliBellLabel.textContent = "-";
  }
  if (halliWinnerLabel) {
    halliWinnerLabel.textContent = "-";
  }
  if (halliLastActionLabel) {
    halliLastActionLabel.textContent = "-";
  }
  if (halliLastRingLabel) {
    halliLastRingLabel.textContent = "-";
  }
  if (halliPlayers) {
    halliPlayers.innerHTML = "";
  }
  if (halliBellCenter) {
    halliBellCenter.classList.remove("halli-bell-center-ready", "halli-bell-center-waiting");
    halliBellCenter.classList.remove("halli-bell-center-actionable", "halli-bell-center-disabled");
    halliBellCenter.setAttribute("aria-disabled", "true");
  }
  if (halliBellCountdown) {
    halliBellCountdown.textContent = "-";
    halliBellCountdown.classList.add("hidden");
  }
  updateHalliCountdownState(null);
  updateHalliActionButtons();
}

function renderHalliGameState(data) {
  const view = data.view;
  currentHalliView = view;
  if (currentGameType !== "halli_galli") {
    currentGameType = "halli_galli";
    setGamePanelVisibility("halli_galli");
  }
  if (halliTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    halliTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (halliBellLabel) {
    const waiting = !!view.pending_flip;
    if (waiting) {
      halliBellLabel.textContent = "Wait";
    } else if (view.bell_ready) {
      const fruits = formatHalliFruitList(view.bell_fruits);
      halliBellLabel.textContent = fruits === "-" ? "Yes" : `Yes (${fruits})`;
    } else {
      halliBellLabel.textContent = "No";
    }
    halliBellLabel.classList.toggle("halli-bell-ready", !waiting && !!view.bell_ready);
  }
  if (halliBellCenter) {
    const waiting = !!view.pending_flip;
    halliBellCenter.classList.toggle("halli-bell-center-ready", !waiting && !!view.bell_ready);
    halliBellCenter.classList.toggle("halli-bell-center-waiting", waiting);
  }
  if (halliWinnerLabel) {
    halliWinnerLabel.textContent = view.winner ? findPlayerName(view, view.winner) : "-";
  }
  if (halliLastActionLabel) {
    halliLastActionLabel.textContent = formatHalliLastAction(view);
  }
  if (halliLastRingLabel) {
    halliLastRingLabel.textContent = formatHalliLastRingResult(view);
  }
  updateHalliCountdownState(view);

  renderHalliPlayers(view);
  logGameEvents(data);
  updateHalliActionButtons();
}

if (halliFlipBtn) {
  halliFlipBtn.addEventListener("click", () => {
    sendAction({ type: "flip" });
  });
}

if (halliRingBtn) {
  halliRingBtn.addEventListener("click", () => {
    sendAction({ type: "ring" });
  });
}

if (halliBellCenter) {
  const ringBell = () => {
    if (currentGameType !== "halli_galli") {
      return;
    }
    if (!isHalliActionAvailable("ring")) {
      return;
    }
    sendAction({ type: "ring" });
  };
  halliBellCenter.addEventListener("click", ringBell);
  halliBellCenter.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      ringBell();
    }
  });
}
