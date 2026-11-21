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
        zh: "<p>Second Chance(🛡) 让你把它交给任意一位还在场并且手上没有这张牌的玩家，你也可以留给自己。之后这个人第一次爆掉时会被救回来，这张牌随即消失。</p>"
          + "<p>Freeze(❄) 让你指定任意一位还在场上的玩家，他立刻结算当前分数并退出本轮，既可能是救命也可能是截断。</p>"
          + "<p>Flip Three(↻) 只能由抽到它的人自己承受，他要连续翻三张牌，中途爆掉或者集齐七张就提前停止。</p>"
          + "<p>Second Chance 或 Freeze 等待结算时，顶部会提示抽到它的玩家，在目标玩家的牌区点击对应按钮即可使用。</p>",
        en: "<p>Second Chance(🛡) lets you hand it to any player still in the round who does not already hold one, yourself included. The next time that player would bust they are saved instead, and the card is used up.</p>"
          + "<p>Freeze(❄) lets you pick any player still in the round, who immediately banks their current score and leaves the round, which can rescue them or cut them short.</p>"
          + "<p>Flip Three(↻) always lands on the player who drew it, who has to flip three cards in a row and stops early on a bust or on collecting seven numbers.</p>"
          + "<p>When Second Chance or Freeze needs a target, the status line names the player choosing. That player clicks the action button in the target player's tableau.</p>"
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
          + "<p>只要还没有人达到 Target Score，所有玩家点击 Next Round 确认结果后才会开始新的一轮，机器人会自动确认。</p>"
          + "<p>一旦有人达到或者超过 Target Score，整局结束，总分最高的玩家获胜。</p>",
        en: "<p>After each round the Last Round panel lists every card each player flipped and the score they took from it.</p>"
          + "<p>As long as nobody has reached the Target Score, everyone must click Next Round to acknowledge the results before a fresh round starts. Bots acknowledge automatically.</p>"
          + "<p>The moment somebody reaches or passes the Target Score the game ends and the highest total score wins.</p>"
      }
    }
  ]
};

const FLIP7_EXPLAIN = {
  next_round: { zh: "确认本轮结果。全员确认后才会开始下一轮，机器人会自动确认。", en: "Acknowledge this round's results. The next round starts only after everyone is ready. Bots acknowledge automatically." },
  card: { zh: "数字牌累加分数，重复数字会爆牌。分数牌增加分数，功能牌改变抽牌或停手机会。点击或悬停具体卡牌可查看其效果。", en: "Number cards add points but duplicates bust you. Modifiers increase your score and action cards change your options. Hover or tap a card outside Explain mode for its exact effect." },
  target: { zh: "将当前功能牌交给此玩家。Second Chance 防止一次爆牌，Freeze 立即替目标保分并结束其本轮。", en: "Give the pending action to this player. Second Chance prevents one bust. Freeze banks the target's points immediately and ends their round." },
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
  players: { zh: "显示每人的累计总分、可保的本轮分数和不同数字张数。Busted 表示本轮爆牌得 0 分。Second Chance(🛡) 表示仍有一次保护。待结算的功能牌通过目标牌区中的按钮使用。", en: "Shows each player's total, bankable round points and distinct number count. Busted means zero for this round. Second Chance(🛡) protects against one duplicate. Use a pending action through the button in the target player's tableau." },
  last_round: { zh: "上一轮的结果，按玩家列出本轮翻到的每一张牌和最终拿到的分数。", en: "The previous round's result, listing every card each player flipped and the score they ended up with." }
};

let flip7HelpWidget = null;
let flip7ExplainWidget = null;
let currentFlip7View = null;
let flip7ResultRound = null;
let flip7TooltipTimer = null;
let flip7TouchStart = null;

const flip7Players = document.getElementById("flip7Players");
const flip7LastRound = document.getElementById("flip7LastRound");
const flip7Results = document.getElementById("flip7Results");
const flip7FlipBtn = document.getElementById("flip7FlipBtn");
const flip7StayBtn = document.getElementById("flip7StayBtn");
const flip7NextRoundBtn = document.getElementById("flip7NextRoundBtn");
const flip7ActionButtons = { flip: flip7FlipBtn, stay: flip7StayBtn, next_round: flip7NextRoundBtn };

function showFlip7HeaderActions(show) {
  const header = document.getElementById("flip7HeaderActions");
  if (header) header.style.display = show ? "flex" : "none";
  if (!show) {
    flip7ExplainWidget?.exit();
    flip7HelpWidget?.close();
    hideFlip7Tooltip();
  }
}

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
    hideFlip7Tooltip();
    flip7ExplainWidget?.exit();
    flip7HelpWidget.open();
  });
  flip7ExplainButton?.addEventListener("click", () => {
    hideFlip7Tooltip();
    flip7ExplainWidget?.toggle();
  });
}

function flip7Element(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function flip7PlayerName(view, playerId) {
  return view.players.find((player) => player.player_id === playerId)?.name || playerId || "—";
}

function flip7CardDescription(card) {
  if (card.type === "number") return "Number " + card.value + ": adds " + card.value + " points. A duplicate busts you unless protected by Second Chance.";
  if (card.multiplier === 2) return "×2: doubles number-card points, not bonus points or the Flip 7 bonus.";
  if (card.type === "modifier") return "+" + card.points + ": adds bonus points after multipliers.";
  if (card.action === "second_chance") return "Second Chance (🛡): prevents one bust, then is discarded with the duplicate card.";
  if (card.action === "freeze") return "Freeze (❄): banks the chosen active player's points and ends their round.";
  if (card.action === "flip_three") return "Flip Three (↻): the player who draws it must flip three more cards. A bust or Flip 7 stops the draw.";
  return card.label || "Card";
}

function flip7Card(card) {
  const element = flip7Element("div", "flip7-card");
  element.dataset.kind = card.type || "number";
  element.dataset.flip7Tip = flip7CardDescription(card);
  const explainKey = card.action || (card.type === "number" ? "number_" + card.value : card.multiplier === 2 ? "multiplier" : "modifier_" + card.points);
  const descriptions = {
    second_chance: "Second Chance(🛡) 防止一次因重复数字导致的爆牌，然后与重复数字牌一起弃掉。",
    freeze: "Freeze(❄) 令选中的活跃玩家立即保分并结束本轮。",
    flip_three: "Flip Three(↻) 令抽到它的人连抽三张，爆牌或达成 Flip 7 时提前停止。",
    multiplier: "×2 只将数字牌之和翻倍，不翻倍分数修正牌和 Flip 7 奖励。"
  };
  FLIP7_EXPLAIN[explainKey] = {
    en: element.dataset.flip7Tip,
    zh: descriptions[explainKey] || (card.type === "number" ? "数字 " + card.value + " 贡献 " + card.value + " 分并计入七种不同数字。同值数字再次出现会爆牌，除非有 Second Chance 保护。" : "+" + card.points + " 在数字倍数结算后增加本轮分数，不会导致爆牌。")
  };
  element.dataset.flip7Explain = explainKey;
  element.setAttribute("aria-label", element.dataset.flip7Tip);
  element.setAttribute("tabindex", "0");
  const symbols = { second_chance: "🛡", freeze: "❄", flip_three: "↻" };
  const labels = { second_chance: "Second chance", freeze: "Freeze", flip_three: "Flip three" };
  element.appendChild(flip7Element("span", "", symbols[card.action] || card.label || String(card.value ?? "?")));
  if (card.type === "action") element.appendChild(flip7Element("small", "", labels[card.action] || "Action"));
  element.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") showFlip7Tooltip(element);
  });
  element.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") hideFlip7Tooltip();
  });
  element.addEventListener("focus", () => showFlip7Tooltip(element));
  element.addEventListener("blur", hideFlip7Tooltip);
  return element;
}

function showFlip7Tooltip(element) {
  if (flip7ExplainWidget?.isActive()) return;
  const tooltip = document.getElementById("flip7Tooltip");
  if (!tooltip) return;
  clearTimeout(flip7TooltipTimer);
  tooltip.textContent = element.dataset.flip7Tip;
  tooltip.classList.remove("hidden");
  const box = element.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  tooltip.style.left = Math.max(12, Math.min(box.left, window.innerWidth - tip.width - 12)) + "px";
  tooltip.style.top = Math.max(8, box.top - tip.height - 8) + "px";
  flip7TooltipTimer = setTimeout(hideFlip7Tooltip, 3000);
}

function hideFlip7Tooltip() {
  clearTimeout(flip7TooltipTimer);
  document.getElementById("flip7Tooltip")?.classList.add("hidden");
}

function renderFlip7Players(view) {
  document.getElementById("flip7PlayerActionStash")?.append(flip7FlipBtn, flip7StayBtn);
  flip7Players.replaceChildren();
  const pending = view.pending_action;
  const targets = new Set(pending?.eligible_targets || []);
  const ordered = [...view.players].sort((first, second) => Number(second.player_id === view.you) - Number(first.player_id === view.you));
  ordered.forEach((player) => {
    const self = player.player_id === view.you;
    const card = flip7Element("section", "flip7-player");
    card.classList.toggle("self", self);
    card.classList.toggle("current", view.phase === "playing" && player.player_id === view.current_turn);
    const header = flip7Element("div", "flip7-player-head");
    header.appendChild(flip7Element("div", "flip7-player-name", (player.name || player.player_id) + (self ? " · You" : "") + (player.is_bot ? " · Bot" : "")));
    const total = flip7Element("div", "flip7-total", String(player.score ?? 0));
    total.appendChild(flip7Element("small", "", " pts"));
    header.appendChild(total);
    card.appendChild(header);
    const meta = flip7Element("div", "flip7-player-meta");
    const busted = player.busted;
    const status = player.flip7 ? "Flip 7 · +15" : busted ? "Busted · +0" : player.status === "active" ? "In play" : "Banked · +" + (player.round_score ?? 0);
    meta.appendChild(flip7Element("span", busted ? "flip7-busted" : "", status));
    meta.appendChild(flip7Element("span", "", player.numbers_count + "/7 numbers · " + (player.round_score ?? player.potential_score ?? 0) + " round pts"));
    card.appendChild(meta);
    const hand = flip7Element("div", "flip7-hand");
    hand.setAttribute("data-flip7-explain", "card");
    player.tableau.forEach((entry) => hand.appendChild(flip7Card(entry)));
    if (!player.tableau.length) hand.appendChild(flip7Element("span", "hint", view.phase === "round_end" || view.game_over ? "See round results below." : "No cards"));
    card.appendChild(hand);
    if (self) {
      const actions = flip7Element("div", "flip7-player-actions");
      actions.append(flip7FlipBtn, flip7StayBtn);
      card.appendChild(actions);
    }
    if (pending?.actor_id === view.you && targets.has(player.player_id)) {
      card.classList.add("flip7-target-eligible");
      const target = flip7Element("button", "flip7-target-button", pending.label + " → " + (self ? "You" : player.name || player.player_id));
      target.type = "button";
      target.dataset.flip7Explain = "target";
      target.addEventListener("click", () => sendAction({ type: "choose_target", target_player_id: player.player_id }));
      card.appendChild(target);
    }
    flip7Players.appendChild(card);
  });
}

function renderFlip7LastRound(view) {
  const summary = view.last_round_summary;
  flip7LastRound.replaceChildren();
  document.getElementById("flip7ResultCaption").textContent = summary ? "· Round " + summary.round : "";
  if (!summary) {
    flip7LastRound.appendChild(flip7Element("p", "hint", "No previous round yet."));
    return;
  }
  if (summary.round !== flip7ResultRound) {
    flip7ResultRound = summary.round;
    flip7Results.open = view.phase === "round_end" || view.game_over;
  }
  view.players.forEach((player) => {
    const points = summary.round_scores?.[player.player_id] ?? 0;
    const row = flip7Element("div", "flip7-result" + (player.player_id === view.you ? " self" : ""));
    const header = flip7Element("div", "flip7-player-head");
    header.appendChild(flip7Element("span", "flip7-player-name", player.name || player.player_id));
    header.appendChild(flip7Element("strong", "", "+" + points + " · " + (summary.total_scores?.[player.player_id] ?? player.score) + " total"));
    row.appendChild(header);
    const hand = flip7Element("div", "flip7-hand");
    const flips = summary.flips?.[player.player_id] || [];
    flips.forEach((entry) => hand.appendChild(flip7Card(typeof entry === "string" ? { label: entry } : entry)));
    row.appendChild(hand);
    const result = summary.flip7_winner === player.player_id ? "Flip 7 · +15 bonus" : summary.breakdowns?.[player.player_id]?.busted ? "Busted" : "Banked";
    row.appendChild(flip7Element("small", "", result));
    flip7LastRound.appendChild(row);
  });
}

function isFlip7ActionAvailable(actionType) {
  return currentGameType === "flip7" && !!currentFlip7View?.legal_actions?.includes(actionType);
}

function updateFlip7ActionButtons() {
  Object.entries(flip7ActionButtons).forEach(([actionType, button]) => {
    if (!button) return;
    button.disabled = !isFlip7ActionAvailable(actionType);
    button.classList.toggle("action-allowed", !button.disabled);
  });
}

function clearFlip7State() {
  currentFlip7View = null;
  flip7ResultRound = null;
  hideFlip7Tooltip();
  document.getElementById("flip7PlayerActionStash")?.append(flip7FlipBtn, flip7StayBtn);
  flip7Players.replaceChildren();
  flip7Players.classList.remove("hidden");
  flip7LastRound.replaceChildren();
  flip7Results.open = false;
  document.getElementById("flip7ResultCaption").textContent = "";
  document.getElementById("flip7Status").textContent = "Waiting for the game to start.";
  document.getElementById("flip7RoundContinue").classList.add("hidden");
  ["flip7Round", "flip7Deck", "flip7Discard", "flip7TargetScore"].forEach((id) => { document.getElementById(id).textContent = "—"; });
  updateFlip7ActionButtons();
}

function renderFlip7GameState(data) {
  const view = data.view;
  if (view.phase !== currentFlip7View?.phase && (view.phase === "round_end" || view.game_over)) {
    flip7ResultRound = null;
  }
  currentFlip7View = view;
  if (currentGameType !== "flip7") currentGameType = "flip7";
  setGamePanelVisibility("flip7");
  hideFlip7Tooltip();
  document.getElementById("flip7Round").textContent = view.round;
  document.getElementById("flip7Deck").textContent = view.deck_count;
  document.getElementById("flip7Discard").textContent = view.discard_count;
  document.getElementById("flip7TargetScore").textContent = view.config?.target_score ?? 200;
  let status;
  if (view.game_over) {
    status = "Winner: " + (view.winner || []).map((playerId) => flip7PlayerName(view, playerId)).join(", ");
  } else if (view.phase === "round_end") {
    status = "Round complete · review the results, then continue.";
  } else if (view.pending_action) {
    const pending = view.pending_action;
    status = pending.actor_id === view.you ? "Choose a player for " + pending.label + "." : flip7PlayerName(view, pending.actor_id) + " is choosing a target for " + pending.label + ".";
  } else {
    status = view.you === view.current_turn ? "Your turn · flip again or bank your points." : flip7PlayerName(view, view.current_turn) + " is playing.";
  }
  document.getElementById("flip7Status").textContent = status;
  renderFlip7Players(view);
  renderFlip7LastRound(view);
  const paused = view.phase === "round_end";
  flip7Players.classList.toggle("hidden", paused || view.game_over);
  document.getElementById("flip7RoundContinue").classList.toggle("hidden", !paused);
  document.getElementById("flip7ReadyCount").textContent = (view.round_ready || []).length + "/" + view.players.length + " ready";
  flip7NextRoundBtn.textContent = (view.round_ready || []).includes(view.you) ? "Waiting for others…" : "Next Round";
  flip7StayBtn.textContent = "Stay · bank " + (view.players.find((player) => player.player_id === view.you)?.potential_score ?? 0);
  logGameEvents(data);
  updateFlip7ActionButtons();
}

Object.entries(flip7ActionButtons).forEach(([actionType, button]) => {
  button?.addEventListener("click", () => {
    if (isFlip7ActionAvailable(actionType)) sendAction({ type: actionType });
  });
});

const flip7PanelElement = document.getElementById("flip7Panel");
flip7PanelElement?.addEventListener("pointerdown", (event) => {
  flip7TouchStart = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
});
flip7PanelElement?.addEventListener("pointermove", (event) => {
  if (flip7TouchStart && Math.hypot(event.clientX - flip7TouchStart.x, event.clientY - flip7TouchStart.y) > 10) flip7TouchStart = null;
});
flip7PanelElement?.addEventListener("pointerup", (event) => {
  const start = flip7TouchStart;
  flip7TouchStart = null;
  if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
  const card = event.target.closest("[data-flip7-tip]");
  if (card) showFlip7Tooltip(card);
});
flip7PanelElement?.addEventListener("pointercancel", () => { flip7TouchStart = null; });
window.addEventListener("scroll", hideFlip7Tooltip, true);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") hideFlip7Tooltip(); });

function initFlip7Interface() {
  initFlip7HelpExplain();
  if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "flip7") {
    showFlip7HeaderActions(true);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "flip7") renderFlip7GameState(lastGameStatePayload);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initFlip7Interface);
else initFlip7Interface();
