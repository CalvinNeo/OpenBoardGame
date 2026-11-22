// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const kobayakawaHelpButton = document.getElementById("kobayakawaHelpBtn");
const kobayakawaExplainButton = document.getElementById("kobayakawaExplainBtn");

const KOBAYAKAWA_HELP_CONFIG = {
  gameId: "kobayakawa",
  title: { zh: "小早川 · Kobayakawa", en: "Kobayakawa" },
  basic: {
    win: {
      zh: "默认七轮结束后筹码(🪙)最多者获胜，零筹码玩家淘汰，只剩一人时提前结束。",
      en: "By default, the most tokens(🪙) after seven rounds wins. Zero-token players are eliminated, and one remaining player ends the game early."
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
          + "<p>玩家区中，You 是自己，Bot(🤖)是电脑，Acted(✅)表示已经行动，Turn 是正在行动，Ready 是已确认结算。</p>",
        en: "<p>The deck holds one copy each of 1 through 15. Every round deals one card to each player and sets one more card aside in the middle as the Kobayakawa card(🎴).</p>"
          + "<p>A round has two phases. In the action phase every player takes exactly one action in seat order, and in the betting phase the same order decides Fight or Pass.</p>"
          + "<p>At the table, You marks your seat, Bot(🤖)is a computer player, Acted(✅)means an action is complete, Turn marks the current player, and Ready means the settlement was reviewed.</p>"
      }
    },
    {
      id: "action",
      label: { zh: "行动阶段", en: "The action phase" },
      html: {
        zh: "<p>按下 Draw a card 抽一张牌之后，在两张牌下方选择要保留的牌。</p>"
          + "<p>Keep drawn 留下新抽到的牌，把原来的手牌丢进弃牌堆。Keep hand 保留原来的手牌，把刚抽到的那张丢掉。</p>"
          + "<p>公共牌下方的 Replace 不动你的手牌，改成把场中央的小早川牌换掉，被换掉的旧牌进入弃牌堆。</p>"
          + "<p>Discard Pile 是完全公开的，你可以用它推算哪些数字已经不可能再出现。</p>",
        en: "<p>After pressing Draw a card, choose the card to keep using the buttons below the two cards.</p>"
          + "<p>Keep drawn takes the new card and discards your old hand. Keep hand retains your original card and discards the new one.</p>"
          + "<p>Replace below the public card leaves your hand alone and swaps the Kobayakawa card, sending the old one to the discard pile.</p>"
          + "<p>The Discard Pile is completely public, so you can use it to work out which numbers can no longer appear.</p>"
      }
    },
    {
      id: "betting",
      label: { zh: "Fight 与 Pass", en: "Fight and Pass" },
      html: {
        zh: "<p>普通轮 Fight 支付 1 枚筹码进下注底池。末轮支付 2 枚，只有 1 枚时可押最后 1 枚。</p>"
          + "<p>按下 Pass 不花任何东西，代价是你这一轮完全退出，底池与你无关。</p>"
          + "<p>结算后零筹码玩家淘汰，后续不再发牌或下注，但仍可看结算并点击 Next Round。</p>"
          + "<p>你的决定会在玩家区公开，所以后面行动的人能看见前面所有人的选择。</p>",
        en: "<p>Fight costs one token normally and two in the final round. With only one token left, you may bet that last token in the final round.</p>"
          + "<p>Pressing Pass costs nothing, and the price is that you are out of the round and the pot has nothing to do with you.</p>"
          + "<p>Players with no tokens after settlement are eliminated and skip future deals and bets, but still review results and press Next Round.</p>"
          + "<p>Your decision is public at the table, so everyone acting later sees what the earlier players chose.</p>"
      }
    },
    {
      id: "showdown",
      label: { zh: "争夺与小早川加成", en: "The showdown and the bonus" },
      html: {
        zh: "<p>如果没有任何人 Fight，这一轮的底池原样留到下一轮，谁也拿不到它。</p>"
          + "<p>如果只有一位玩家 Fight，他不必比牌就直接赢走整个底池。</p>"
          + "<p>如果两位以上玩家 Fight 就进入争夺。手牌数字最小的那位玩家获得小早川牌的加成，他的最终点数等于自己的手牌加上小早川牌。</p>"
          + "<p>其他人的最终点数就是自己的手牌。最终点数最高者获胜，同点时从本轮起始玩家顺时针算，先行动者获胜。</p>"
          + "<p>这意味着最小的牌反而可能翻身，而一张中等偏大的牌往往两头不讨好。</p>",
        en: "<p>If nobody fights, the pot simply stays on the table for the next round and no one collects it.</p>"
          + "<p>If exactly one player fights, that player takes the whole pot without any comparison.</p>"
          + "<p>When two or more players fight the showdown begins. The fighter holding the smallest hand card receives the Kobayakawa bonus, making their final score their own card plus the Kobayakawa card.</p>"
          + "<p>Everyone else scores their own hand card. The highest score wins. A tie goes to the player earlier in this round's order, clockwise from the start player.</p>"
          + "<p>That is why the smallest card can suddenly be the strongest one, while a middling large card tends to please nobody.</p>"
      }
    },
    {
      id: "ending",
      label: { zh: "结束与胜负", en: "Ending and winning" },
      html: {
        zh: "<p>赢下底池的玩家拿走全部筹码，并由他在下一轮先行动。全员 Pass 时，下一轮由本轮起始玩家的下家开始。</p>"
          + "<p>牌力加成不是筹码奖励。Strength 的 +3 只表示比牌时加 3 点。默认每人 4 枚，另有 8 枚公共储备。前六轮赢家拿走下注底池，再从储备拿 1 枚。末轮拿剩下 2 枚，所以独赢也能净赚公共奖励。</p>"
          + "<p>每轮结算后会暂停，所有玩家点击 Next Round 后才重新发牌，电脑自动确认，观察者无需确认。</p>"
          + "<p>先发放底池和储备奖励，再淘汰零筹码者。储备用完或只剩一位玩家时结束，同筹码可并列获胜。全员 Pass 不发奖励，不推进轮数，确认后本轮重发。</p>"
          + "<p>兼容旧房间的破产制房规会在有人归零时结束。自定义 N 轮时使用 N+1 枚储备，末轮仍奖励 2 枚。赢家(🏆)标记用于本轮和整局胜者。</p>",
        en: "<p>The winner collects the pot and opens the next round. If everyone passes, the next player clockwise opens instead.</p>"
          + "<p>A strength bonus is not a token reward. Strength +3 only affects card comparison. By default, each player starts with four tokens(🪙), with eight more in a public reserve. Winners collect the bet pot plus one reserve token in the first six rounds, then the last two reserve tokens in the final round. Even an unopposed winner gains a reserve reward.</p>"
          + "<p>Each round pauses for review. All players press Next Round before the next deal. Bots confirm automatically, and spectators do not need to confirm.</p>"
          + "<p>Award the pot and reserve reward before eliminating zero-token players. The game ends when the reserve runs out or only one player remains, with tied token leaders sharing victory. If everyone passes, award nothing and replay the same round after review.</p>"
          + "<p>Legacy bankruptcy rooms end when anyone runs out of tokens. A custom N-round game uses N+1 reserve tokens and still awards two in its final round. Winner(🏆)marks round and game winners.</p>"
      }
    }
  ]
};

const KOBAYAKAWA_EXPLAIN = {
  phase: { zh: "Action 为行动，Betting 为下注，Review 为结算暂停，Finished 为整局结束。", en: "Action adjusts cards, Betting chooses Fight or Pass, Review pauses on settlement, and Finished ends the game." },
  tokens: { zh: "筹码(🪙)用于下注和整局计分，不等于牌力。余额等于期初减下注，加赢得的底池和公共储备奖励。", en: "Tokens(🪙) pay bets and decide the winner, unlike strength. Balance is starting tokens minus your bet plus the pot and reserve reward you collect." },
  reserve: { zh: "公共储备(🪙)独立于下注底池，普通轮赢家额外拿 1 枚，末轮拿剩余 2 枚。", en: "The public reserve(🪙) is separate from bets. The winner gains one extra token normally, or the final two tokens in the last round." },
  next_round: { zh: "确认已看完结算。所有玩家确认后开始下一轮，电脑自动确认，观察者无需确认。", en: "Confirm you have reviewed the settlement. The next deal waits for every player. Bots confirm automatically, and spectators do not confirm." },
  round: { zh: "当前是第几轮。", en: "Which round is being played." },
  turn: { zh: "现在轮到谁行动或者表态。", en: "Whose turn it is to act or to declare." },
  start_player: { zh: "本轮的起始玩家。行动阶段和下注阶段都从他开始。", en: "The player who opens this round. Both the action phase and the betting phase start with them." },
  kobayakawa_card: { zh: "场中央的小早川牌(🎴)。争夺时手牌最小的玩家可以把它的点数加到自己的最终点数上。", en: "The Kobayakawa card(🎴) in the middle. In a showdown the fighter with the smallest hand card adds its value to their final score." },
  pot: { zh: "下注底池只含玩家投入。普通轮每人 1 枚，末轮 2 枚（只剩 1 枚可全押），赢家另拿公共储备奖励。", en: "The bet pot contains player stakes only: one each normally, two in the final round (one-token all-in allowed). The winner also gains a separate reserve reward." },
  deck: { zh: "牌堆里还剩多少张牌。它决定你还能不能抽牌或者更换小早川牌。", en: "How many cards are left in the deck. It decides whether you can still draw or replace the Kobayakawa card." },
  winner: { zh: "整局结束时筹码最多的玩家，同分时会并列显示。", en: "The player holding the most tokens when the game ends, shown together when several players tie." },
  round_notice: { zh: "上一轮的结果，包括底池归属、谁拿到了小早川牌加成，以及每位参战者的手牌与最终点数。", en: "The previous round's result, including who took the pot, who received the Kobayakawa bonus, and the hand card and final score of every fighter." },
  hand: { zh: "你当前的手牌，也就是争夺时使用的数字。除非你主动换牌，它会一直留到本轮结束。", en: "Your current hand card, the number you bring to a showdown. It stays with you for the whole round unless you swap it yourself." },
  drawn: { zh: "你刚刚抽到但还没有决定的牌。你必须选择留下它还是丢掉它，这一轮的行动才算完成。", en: "The card you just drew and have not resolved yet. You must either keep it or discard it before your action counts as finished." },
  draw: { zh: "从牌堆抽一张牌，再用 Keep drawn 保留新牌或 Keep hand 保留原手牌，另一张公开弃掉。", en: "Draw one card, then use Keep drawn for the new card or Keep hand for the original. Discard the other publicly." },
  replace: { zh: "不动自己的手牌，把场中央的小早川牌换成牌堆顶的新牌。这会改变争夺时的加成大小。", en: "Leave your hand alone and swap the Kobayakawa card in the middle for a fresh card off the deck, which changes how big the bonus will be." },
  keep_drawn: { zh: "留下刚抽到的牌作为新手牌，把原来的手牌丢进弃牌堆。", en: "Keep the freshly drawn card as your new hand and throw your old card onto the discard pile." },
  discard_drawn: { zh: "保留原来的手牌，把刚抽到的那张丢进弃牌堆。", en: "Keep your existing hand card and throw the freshly drawn one onto the discard pile." },
  fight: { zh: "普通轮支付 1 枚筹码，末轮支付 2 枚（只剩 1 枚可全押）。赢家拿下注底池和公共奖励。最小手牌获得小早川牌(🎴)牌力加成。", en: "Bet one token normally, or two in the final round (all-in with one is allowed). The winner collects the bet pot plus a reserve reward. The smallest hand gets the Kobayakawa card(🎴) strength bonus." },
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
let kobayakawaPending = false;
let kobayakawaPendingTimer = null;
let kobayakawaTipTimer = null;
let kobayakawaTouchStart = null;

const kobayakawaPanelElement = document.getElementById("kobayakawaPanel");
const kobayakawaActionIds = {
  draw_card: "kobayakawaDrawBtn",
  replace_kobayakawa: "kobayakawaReplaceBtn",
  keep_drawn: "kobayakawaKeepDrawnBtn",
  discard_drawn: "kobayakawaDiscardDrawnBtn",
  fight: "kobayakawaFightBtn",
  pass: "kobayakawaPassBtn",
  next_round: "kobayakawaNextBtn",
};

function kobayakawaText(suffix, value) {
  document.getElementById("kobayakawa" + suffix).textContent = value;
}

function isKobayakawaActionAvailable(actionType) {
  return currentGameType === "kobayakawa" && socket.connected && !kobayakawaPending &&
    Boolean(currentKobayakawaView?.legal_actions?.includes(actionType));
}

function updateKobayakawaActionButtons() {
  Object.entries(kobayakawaActionIds).forEach(([action, id]) => {
    const button = document.getElementById(id);
    const allowed = isKobayakawaActionAvailable(action);
    button.disabled = !allowed;
    button.classList.toggle("action-allowed", allowed);
  });
}

function hideKobayakawaTip() {
  clearTimeout(kobayakawaTipTimer);
  const tooltip = document.getElementById("kobayakawaTooltip");
  tooltip.hidePopover?.();
  tooltip.classList.add("hidden");
}

function showKobayakawaTip(target) {
  if (!target || target.closest("button") || kobayakawaExplainWidget?.isActive?.()) return;
  hideKobayakawaTip();
  const tooltip = document.getElementById("kobayakawaTooltip");
  tooltip.textContent = target.dataset.kobayakawaTip;
  tooltip.classList.remove("hidden");
  tooltip.showPopover?.();
  const rect = target.getBoundingClientRect();
  const bounds = tooltip.getBoundingClientRect();
  tooltip.style.left = Math.max(12, Math.min(rect.left, innerWidth - bounds.width - 12)) + "px";
  tooltip.style.top = (rect.bottom + bounds.height + 12 < innerHeight ? rect.bottom + 6 :
    Math.max(12, rect.top - bounds.height - 6)) + "px";
  kobayakawaTipTimer = setTimeout(hideKobayakawaTip, 3000);
}

function clearKobayakawaState() {
  currentKobayakawaView = null;
  document.querySelector(".game-panel")?.classList.remove("kobayakawa-reviewing", "kobayakawa-your-turn");
  kobayakawaPending = false;
  clearTimeout(kobayakawaPendingTimer);
  hideKobayakawaTip();
  kobayakawaText("Status", "Waiting for the deal");
  kobayakawaText("Decision", "Waiting to start");
  ["Phase", "Round", "StartPlayer", "Card", "Pot", "Reserve", "Reward", "Deck", "Hand", "Drawn"].forEach(suffix => kobayakawaText(suffix, "—"));
  ["RoundNotice", "Review", "DrawnSlot", "Betting"].forEach(suffix => document.getElementById("kobayakawa" + suffix).classList.add("hidden"));
  document.getElementById("kobayakawaDiscardDrawnBtn").classList.add("hidden");
  document.getElementById("kobayakawaDrawBtn").classList.remove("hidden");
  document.getElementById("kobayakawaReplaceBtn").classList.remove("hidden");
  kobayakawaPanelElement.querySelector(".kobayakawa-hand-area").classList.remove("kobayakawa-choosing");
  kobayakawaText("DiscardCount", "0 cards");
  document.getElementById("kobayakawaPlayers").replaceChildren();
  document.getElementById("kobayakawaDiscard").replaceChildren();
  updateKobayakawaActionButtons();
}

function formatKobayakawaWinner(view, winner) {
  return (Array.isArray(winner) ? winner : winner ? [winner] : [])
    .map(playerId => findPlayerName(view, playerId)).join(", ") || "—";
}

function renderKobayakawaRoundNotice(view) {
  const summary = view.last_round_summary;
  const visible = Boolean(summary?.result) && (view.phase === "round_end" || view.game_over);
  document.getElementById("kobayakawaRoundNotice").classList.toggle("hidden", !visible);
  if (!visible) return;
  kobayakawaText("RoundNoticeTitle", view.game_over ? "Game over · " + formatKobayakawaWinner(view, view.winner) : "Round settled");
  kobayakawaText("ResultRound", "Round " + summary.round);
  kobayakawaText("RoundNoticeBody", summary.result === "all_pass" ?
    "Everyone passed. No reserve reward · replay this round. Bet pot: 🪙 " + summary.pot :
    formatKobayakawaWinner(view, summary.winner) + (summary.result === "solo" ? " wins unopposed" : " wins the showdown") +
    " · Bet pot 🪙 " + summary.pot + " + reserve reward 🪙 " + (summary.reserve_reward ?? 0) + ".");
  const list = document.getElementById("kobayakawaRoundNoticeList");
  list.replaceChildren();
  const settlements = summary.tokens || [];
  (view.players || []).forEach(player => {
    const fighter = (summary.fighters || []).find(entry => entry.player_id === player.player_id);
    const balance = settlements.find(entry => entry.player_id === player.player_id);
    const row = document.createElement("div");
    row.className = "kobayakawa-summary-item";
    row.classList.toggle("winner", player.player_id === summary.winner);
    row.classList.toggle("self", player.player_id === view.you);
    const name = document.createElement("strong");
    name.textContent = (player.player_id === summary.winner ? "🏆 " : "") + (player.name || player.player_id) + (player.player_id === view.you ? " · You" : "");
    const strength = document.createElement("span");
    strength.textContent = fighter ? "Strength: " + fighter.hand + (fighter.got_bonus ? " + " + summary.kobayakawa + " bonus" : "") + " = " + fighter.final_score :
      player.player_id === summary.winner ? "Unopposed · hand hidden" : summary.result === "all_pass" ? "Passed · hand hidden" : "Did not fight · hand hidden";
    const tokens = document.createElement("span");
    tokens.className = "kobayakawa-token-change";
    if (balance) {
      const delta = balance.after - balance.before;
      tokens.textContent = "🪙 Tokens: " + balance.before + " − " + balance.paid + " bet + " + balance.received + " pot + " + (balance.reward ?? 0) + " reward = " + balance.after +
        " (net " + (delta > 0 ? "+" : "") + delta + ")";
    } else {
      tokens.textContent = "🪙 Tokens now: " + player.tokens + " · earlier balance unavailable";
    }
    row.append(name, strength, tokens);
    list.appendChild(row);
  });
  const reviewing = view.phase === "round_end";
  document.getElementById("kobayakawaReview").classList.toggle("hidden", !reviewing);
  const ready = view.round_ready || [];
  const waiting = (view.players || []).filter(player => !ready.includes(player.player_id));
  kobayakawaText("Ready", ready.length + "/" + view.players.length + " ready" + (waiting.length ? " · Waiting: " + waiting.map(player => player.name || player.player_id).join(", ") : ""));
  kobayakawaText("NextBtn", ready.includes(view.you) ? "Ready · waiting" : "Next Round");
}

function renderKobayakawaDiscard(view) {
  const container = document.getElementById("kobayakawaDiscard");
  container.replaceChildren();
  const discard = view.discard_pile || [];
  kobayakawaText("DiscardCount", discard.length + " cards");
  if (!discard.length) {
    const empty = document.createElement("span");
    empty.className = "hint";
    empty.textContent = "No discards";
    container.appendChild(empty);
  }
  discard.forEach(value => {
    const card = document.createElement("span");
    card.className = "kobayakawa-card-chip";
    card.textContent = value;
    container.appendChild(card);
  });
}

function renderKobayakawaPlayers(view) {
  const container = document.getElementById("kobayakawaPlayers");
  container.replaceChildren();
  (view.players || []).forEach(player => {
    const card = document.createElement("div");
    card.className = "kobayakawa-player-card";
    card.classList.toggle("self", player.player_id === view.you);
    card.classList.toggle("current", player.player_id === view.current_turn);
    const name = document.createElement("div");
    name.className = "kobayakawa-player-name";
    name.textContent = (player.is_bot ? "🤖 " : "") + (player.name || player.player_id) + (player.player_id === view.you ? " · You" : "");
    const meta = document.createElement("div");
    meta.className = "kobayakawa-player-meta";
    const tokens = document.createElement("span");
    tokens.className = "kobayakawa-player-tokens";
    tokens.textContent = "🪙 " + (player.tokens ?? 0);
    tokens.dataset.kobayakawaExplain = "tokens";
    tokens.dataset.kobayakawaTip = "Token balance, not strength. Fight costs 1 normally, or 2 in the final round (1-token all-in allowed). Winners also gain a reserve reward.";
    const status = document.createElement("span");
    status.textContent = view.phase === "round_end" ? ((view.round_ready || []).includes(player.player_id) ? "Ready" : "Reviewing") :
      view.game_over ? ((view.winner || []).includes(player.player_id) ? "🏆 Winner" : "Finished") :
      player.eliminated ? "Out" : player.player_id === view.current_turn ? "Turn" : view.phase === "betting" ? (player.bet_choice === "fight" ? "Fight · −" + (player.bet_amount ?? 1) : player.bet_choice === "pass" ? "Passed" : "Deciding") :
      player.action_done ? "✅ Acted" : "Waiting";
    status.dataset.kobayakawaTip = "Turn: acting now. Acted: finished the action. Fight: bet paid. Out: eliminated. Ready: reviewed the result.";
    meta.append(tokens, status);
    card.append(name, meta);
    container.appendChild(card);
  });
  kobayakawaExplainWidget?.refresh();
}

function renderKobayakawaGameState(data) {
  hideKobayakawaTip();
  const view = data.view;
  currentKobayakawaView = view;
  kobayakawaPending = false;
  clearTimeout(kobayakawaPendingTimer);
  if (currentGameType !== "kobayakawa") {
    currentGameType = "kobayakawa";
    setGamePanelVisibility("kobayakawa");
  }
  const names = { action: "Action", betting: "Betting", round_end: "Review", game_over: "Finished" };
  const acting = findPlayerName(view, view.current_turn) || "Another player";
  const ownTurn = view.current_turn === view.you;
  const spectator = !view.players.some(player => player.player_id === view.you);
  const choosing = view.your_drawn != null;
  document.querySelector(".game-panel")?.classList.toggle("kobayakawa-your-turn", ownTurn && !view.game_over);
  KOBAYAKAWA_EXPLAIN.kobayakawa_card = {
    zh: "公共小早川牌(🎴)为 " + view.kobayakawa + "。它只给参战者中手牌最小的人增加牌力，不增加筹码。",
    en: "The public Kobayakawa card(🎴) is " + view.kobayakawa + ". The fighter with the smallest hand adds this to strength, not tokens."
  };
  KOBAYAKAWA_EXPLAIN.hand = {
    zh: "你的私有手牌为 " + (view.your_hand ?? "隐藏") + "。比牌时，若它是参战者中最小的手牌，再加公共牌 " + view.kobayakawa + " 点牌力。",
    en: "Your private hand is " + (view.your_hand ?? "hidden") + ". If it is the smallest fighting hand, add the public card's " + view.kobayakawa + " strength."
  };
  KOBAYAKAWA_EXPLAIN.drawn = {
    zh: "新抽的牌为 " + (view.your_drawn ?? "无") + "。Keep drawn 保留此牌，Keep hand 保留原手牌 " + (view.your_hand ?? "隐藏") + "，另一张公开弃掉。",
    en: "Newly drawn card: " + (view.your_drawn ?? "none") + ". Keep drawn retains it. Keep hand retains your original " + (view.your_hand ?? "hidden") + ". Discard the other card publicly."
  };
  kobayakawaText("Status", view.game_over ? "🏆 " + formatKobayakawaWinner(view, view.winner) : view.phase === "round_end" ? "Round complete · review the result" : ownTurn ? "Your turn" : acting + "'s turn");
  kobayakawaText("Phase", names[view.phase] || view.phase || "—");
  kobayakawaText("Round", view.round ?? "—");
  kobayakawaText("StartPlayer", findPlayerName(view, view.start_player) || "—");
  kobayakawaText("Card", view.kobayakawa ?? "—");
  kobayakawaText("Pot", view.pot ?? 0);
  kobayakawaText("Reserve", view.reserve ?? "—");
  kobayakawaText("Reward", "Winner +" + (view.round_reward ?? 0));
  kobayakawaText("FightBtn", "Fight · 🪙 −" + (view.fight_cost ?? 1));
  if (view.final_round && !view.game_over) kobayakawaText("Phase", "Final · " + (names[view.phase] || view.phase));
  kobayakawaText("Deck", view.deck_count ?? "—");
  kobayakawaText("Hand", view.your_hand ?? "?");
  kobayakawaText("Drawn", view.your_drawn ?? "—");
  kobayakawaText("Private", spectator ? "Spectating" : "Private");
  kobayakawaText("Decision", spectator ? "Spectating · hands stay private" : view.game_over ? "Final token balances below" :
    view.phase === "round_end" ? "Review your tokens, then continue" : !ownTurn ? "Waiting for " + acting :
    choosing ? "Choose the card to keep" : view.phase === "betting" ? "Fight for the pot or pass" : "Draw a card or replace the center");
  document.getElementById("kobayakawaDrawnSlot").classList.toggle("hidden", !choosing);
  document.getElementById("kobayakawaDiscardDrawnBtn").classList.toggle("hidden", !choosing);
  document.getElementById("kobayakawaDrawBtn").classList.toggle("hidden", choosing || view.phase !== "action");
  document.getElementById("kobayakawaReplaceBtn").classList.toggle("hidden", view.phase !== "action");
  document.getElementById("kobayakawaBetting").classList.toggle("hidden", view.phase !== "betting");
  kobayakawaPanelElement.querySelector(".kobayakawa-hand-area").classList.toggle("kobayakawa-choosing", choosing);
  document.querySelector(".game-panel")?.classList.toggle("kobayakawa-reviewing", view.phase === "round_end" || view.game_over);
  renderKobayakawaRoundNotice(view);
  renderKobayakawaDiscard(view);
  renderKobayakawaPlayers(view);
  logGameEvents(data);
  updateKobayakawaActionButtons();
}

Object.entries(kobayakawaActionIds).forEach(([action, id]) => {
  document.getElementById(id).addEventListener("click", () => {
    if (!isKobayakawaActionAvailable(action) || !socket.connected) return;
    const payload = { type: action };
    if (action === "next_round") {
      payload.round = currentKobayakawaView.round;
      payload.review_id = currentKobayakawaView.review_id ?? 0;
    }
    kobayakawaPending = true;
    updateKobayakawaActionButtons();
    sendAction(payload);
    clearTimeout(kobayakawaPendingTimer);
    kobayakawaPendingTimer = setTimeout(() => { kobayakawaPending = false; updateKobayakawaActionButtons(); }, 5000);
  });
});

function showKobayakawaHeaderActions(visible) {
  document.getElementById("kobayakawaHeaderActions").style.display = visible ? "flex" : "none";
  if (!visible) {
    document.querySelector(".game-panel")?.classList.remove("kobayakawa-reviewing");
    document.querySelector(".game-panel")?.classList.remove("kobayakawa-your-turn");
    kobayakawaExplainWidget?.exit();
    clearKobayakawaState();
  }
}

kobayakawaPanelElement.addEventListener("pointerover", event => {
  if (event.pointerType === "mouse") showKobayakawaTip(event.target.closest("[data-kobayakawa-tip]"));
});
kobayakawaPanelElement.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideKobayakawaTip(); });
kobayakawaPanelElement.addEventListener("pointerdown", event => { kobayakawaTouchStart = { x: event.clientX, y: event.clientY }; });
kobayakawaPanelElement.addEventListener("pointerup", event => {
  if (event.pointerType === "mouse" || !kobayakawaTouchStart ||
      Math.hypot(event.clientX - kobayakawaTouchStart.x, event.clientY - kobayakawaTouchStart.y) > 8) return;
  showKobayakawaTip(event.target.closest("[data-kobayakawa-tip]"));
});
kobayakawaPanelElement.addEventListener("pointercancel", () => { kobayakawaTouchStart = null; });
kobayakawaPanelElement.addEventListener("focusin", event => showKobayakawaTip(event.target.closest("[data-kobayakawa-tip]")));
kobayakawaPanelElement.addEventListener("focusout", hideKobayakawaTip);
document.addEventListener("scroll", hideKobayakawaTip, true);
window.addEventListener("resize", hideKobayakawaTip);
document.addEventListener("keydown", event => { if (event.key === "Escape") hideKobayakawaTip(); });

function syncKobayakawaState() {
  socket.on("system:error", () => { kobayakawaPending = false; clearTimeout(kobayakawaPendingTimer); updateKobayakawaActionButtons(); });
  socket.on("disconnect", () => { kobayakawaPending = false; hideKobayakawaTip(); updateKobayakawaActionButtons(); });
  socket.on("connect", updateKobayakawaActionButtons);
  socket.on("room:state", state => {
    if (state.game_type !== "kobayakawa" || state.status === "lobby") clearKobayakawaState();
  });
  if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "kobayakawa" && currentRoomState.status === "lobby") clearKobayakawaState();
  if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "kobayakawa") renderKobayakawaGameState(lastGameStatePayload);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", syncKobayakawaState, { once: true });
else syncKobayakawaState();
