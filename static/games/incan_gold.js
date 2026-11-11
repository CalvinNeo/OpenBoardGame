let currentIncanGoldView = null;
let incanGoldTooltipTimer = null;

const INCAN_GOLD_HAZARD_ICONS = {
  snake: "🐍",
  spider: "🕷️",
  fire: "🔥",
  rockfall: "🪨",
  mummy: "🧟",
};

const incanGoldPhaseLabel = document.getElementById("incanGoldPhase");
const incanGoldRoundLabel = document.getElementById("incanGoldRound");
const incanGoldMaxRoundsLabel = document.getElementById("incanGoldMaxRounds");
const incanGoldDeckLabel = document.getElementById("incanGoldDeck");
const incanGoldInCaveLabel = document.getElementById("incanGoldInCave");
const incanGoldDecidedLabel = document.getElementById("incanGoldDecided");
const incanGoldWinnerLabel = document.getElementById("incanGoldWinner");
const incanGoldRoundNotice = document.getElementById("incanGoldRoundNotice");
const incanGoldRoundNoticeTitle = document.getElementById("incanGoldRoundNoticeTitle");
const incanGoldRoundNoticeBody = document.getElementById("incanGoldRoundNoticeBody");
const incanGoldPath = document.getElementById("incanGoldPath");
const incanGoldPlayers = document.getElementById("incanGoldPlayers");
const incanGoldRemovedHazards = document.getElementById("incanGoldRemovedHazards");
const incanGoldContinueBtn = document.getElementById("incanGoldContinueBtn");
const incanGoldLeaveBtn = document.getElementById("incanGoldLeaveBtn");
const incanGoldNextRoundBtn = document.getElementById("incanGoldNextRoundBtn");
const incanGoldPlayAgainBtn = document.getElementById("incanGoldPlayAgainBtn");
const incanGoldGamePanel = document.getElementById("incanGoldPanel");
const incanGoldStatus = document.getElementById("incanGoldStatus");
const incanGoldHelpBtn = document.getElementById("incanGoldHelpBtn");
const incanGoldExplainBtn = document.getElementById("incanGoldExplainBtn");
const incanGoldScoreboard = document.getElementById("incanGoldScoreboard");
const incanGoldScoreboardRows = document.getElementById("incanGoldScoreboardRows");
const incanGoldScoreboardNote = document.getElementById("incanGoldScoreboardNote");
const incanGoldScoreboardCloseBtn = document.getElementById("incanGoldScoreboardClose");
let incanGoldScoreboardDismissed = false;
const incanGoldTooltip = document.createElement("div");
incanGoldTooltip.className = "incan-gold-tooltip";
incanGoldTooltip.id = "incanGoldTooltip";
incanGoldTooltip.setAttribute("role", "tooltip");
incanGoldTooltip.hidden = true;
document.body.appendChild(incanGoldTooltip);

const INCAN_GOLD_HELP_CONFIG = {
  gameId: "incan_gold",
  title: { zh: "印加黄金 · Incan Gold", en: "Incan Gold" },
  basic: {
    win: {
      zh: "五次探险结束后，存进营地的宝石(💎) 加上手里神器(🏺) 的分数最高的人获胜，神器(🏺) 数量更多的人打破平局。",
      en: "After five expeditions the player with the most banked gems (💎) plus artifact (🏺) points wins, and holding more artifacts (🏺) breaks a tie."
    },
    turn: {
      zh: "每翻开一张新牌之后，你要在 Continue 和 Leave 之间悄悄选一个，等所有还在洞里的探险者都决定完才一起揭晓。",
      en: "After each newly revealed card you secretly choose Continue or Leave, and every choice is revealed together once all explorers still in the cave have decided."
    },
    key: {
      zh: "在洞里待得越久分到的宝石(💎) 越多，但只要同一种危险出现第二次，你手上还没存起来的宝石(💎) 就会全部归零。",
      en: "The longer you stay in the cave the more gems (💎) you collect, but the second copy of the same hazard wipes out every gem (💎) you have not banked yet."
    }
  },
  sections: [
    {
      id: "expedition",
      label: { zh: "探险流程", en: "How an expedition runs" },
      html: {
        zh: "<p>每一轮探险都会重新洗好牌堆：15 张宝石(💎) 牌、每种危险各 3 张，再加上本轮唯一的一张神器(🏺) 牌。</p>"
          + "<p>翻开一张牌之后，还在洞里的每个人都要在 Continue 和 Leave 之间选一个，谁都看不到别人的选择。</p>"
          + "<p>所有人决定完毕后一起结算：选择离开的人当场回营，其余的人继续面对下一张牌。</p>",
        en: "<p>Every expedition reshuffles its deck: 15 treasure (💎) cards, 3 copies of each hazard, and the single artifact (🏺) card for that round.</p>"
          + "<p>After a card is revealed, everyone still in the cave picks Continue or Leave, and nobody can see anybody else's choice.</p>"
          + "<p>Once everybody has decided, the choices resolve together: the explorers who left return to camp and the rest face the next card.</p>"
      }
    },
    {
      id: "treasure",
      label: { zh: "宝石与神器", en: "Treasure and artifacts" },
      html: {
        zh: "<p>翻出宝石(💎) 时，它的数值会当场平分给还在洞里的探险者，除不尽的余数留在这张牌上，等着之后回营的人来分。</p>"
          + "<p>回营时，每张宝石(💎) 牌上剩下的余数会被单独拿出来平分给这批回营的人，人数多到分不动时余数就继续留着。</p>"
          + "<p>神器(🏺) 牌不会当场结算。如果你独自回营，路径上所有神器(🏺) 都归你，如果同时有多人回营，这些神器(🏺) 全部作废。</p>"
          + "<p>神器(🏺) 的分数按轮次递增：第 1 到第 3 轮各值 5 分，第 4 和第 5 轮各值 10 分。</p>",
        en: "<p>When treasure (💎) is revealed its value is split at once among the explorers still in the cave, and the remainder stays on that card for later returners to divide.</p>"
          + "<p>On the way out, the remainder of each treasure (💎) card is divided separately among that group of returners. If there are too many of them to share it, the remainder simply stays on the card.</p>"
          + "<p>Artifacts (🏺) are never settled on the spot. If you leave alone you take every artifact (🏺) on the path, and if several explorers leave together those artifacts (🏺) are discarded.</p>"
          + "<p>Artifacts (🏺) grow in value with the round: 5 points each in rounds 1 to 3, and 10 points each in rounds 4 and 5.</p>"
      }
    },
    {
      id: "hazards",
      label: { zh: "五种危险", en: "The five hazards" },
      html: {
        zh: "<p>危险一共有五种：蛇(🐍)、蜘蛛(🕷️)、火焰(🔥)、落石(🪨) 和木乃伊(🧟)，每种各有 3 张。</p>"
          + "<p>本次探险里第一次出现某种危险只是警告，第二次出现同一种危险就会让探险立刻崩盘。</p>"
          + "<p>崩盘时，还在洞里的人手上所有宝石(💎) 全部清零，只有已经存进营地的宝石(💎) 和神器(🏺) 是安全的。</p>"
          + "<p>崩盘还会永久移除一张这种危险牌，所以后面的探险会稍微安全一点，但这种危险也从此更容易再次引爆。</p>",
        en: "<p>There are five hazards: Snake (🐍), Spider (🕷️), Fire (🔥), Rockfall (🪨) and Mummy (🧟), with 3 copies of each.</p>"
          + "<p>The first copy of a hazard in an expedition is only a warning. A second copy of the same hazard busts the expedition at once.</p>"
          + "<p>When it busts, every explorer still in the cave loses all the gems (💎) in hand. Only gems (💎) already banked in camp and your artifacts (🏺) stay safe.</p>"
          + "<p>A bust also removes one card of that hazard from the deck forever, so later expeditions are a little safer even though the same hazard is now quicker to blow up again.</p>"
      }
    },
    {
      id: "scoring",
      label: { zh: "计分与胜负", en: "Scoring" },
      html: {
        zh: "<p>只有回到营地时，手上的宝石(💎) 才会被存起来，变成谁也拿不走的安全分。</p>"
          + "<p>总分等于存好的宝石(💎) 加上神器(🏺) 的分数。五轮全部结束后总分最高的人获胜。</p>"
          + "<p>如果总分打平，神器(🏺) 数量更多的人胜出，再平就并列获胜。</p>",
        en: "<p>Gems (💎) only become safe the moment you return to camp and bank them, and nobody can take that score away from you.</p>"
          + "<p>Your total score is your banked gems (💎) plus your artifact (🏺) points, and the highest total after all five rounds wins.</p>"
          + "<p>If totals tie, the player holding more artifacts (🏺) wins, and a remaining tie is shared.</p>"
      }
    },
    {
      id: "rounds",
      label: { zh: "轮次与结束", en: "Rounds and endings" },
      html: {
        zh: "<p>所有人都回营，或者牌堆被抽空时，本次探险都会安全结束，洞里的人也能把宝石(💎) 全部存起来。</p>"
          + "<p>结算后先看清结果再按 Next Round，必须所有玩家都确认，下一次探险才会开始。</p>"
          + "<p>打完第五轮后游戏结束，Play Again 会用同一批玩家重开一局，分数、神器(🏺) 和被移除的危险都会重置。</p>",
        en: "<p>An expedition ends safely when everybody has returned to camp or when the deck runs out, and the explorers still inside bank every gem (💎) they hold.</p>"
          + "<p>Read the result and then press Next Round. Every player has to confirm before the next expedition begins.</p>"
          + "<p>The game finishes after the fifth round, and Play Again starts a fresh game with the same players where scores, artifacts (🏺) and removed hazards all reset.</p>"
      }
    }
  ]
};

const INCAN_GOLD_EXPLAIN = {
  round: { zh: "当前是第几次探险，一共五次。", en: "Which expedition is being played. There are five in total." },
  phase: { zh: "当前阶段。Exploring 是还在洞里做选择，Round review 是本次探险结束后的回顾，Final scores 是五轮全部打完。", en: "The current phase. Exploring means choices are still open, Round review follows the end of an expedition, and Final scores appears once all five rounds are done." },
  deck: { zh: "本次探险的牌堆里还剩多少张牌。牌堆抽空时所有探险者都能安全回营。", en: "How many cards are left in this expedition's draw pile. When the pile runs out every explorer returns safely." },
  exploring: { zh: "还在洞里、仍然承担风险的人数。", en: "How many explorers are still in the cave and still at risk." },
  decided: { zh: "已经锁定选择的探险者人数。只有所有还在洞里的人都决定完，这一轮才会结算并翻开下一张牌。", en: "How many explorers have locked a choice. The round only resolves and reveals the next card once everyone still in the cave has decided." },
  risk: { zh: "下一张牌引爆危险的概率。它根据已经翻开的牌和被永久移除的危险推算，牌堆越薄越危险。", en: "The chance that the next card busts the expedition. It is derived from the revealed cards and the permanently removed hazards, so a thinner deck is more dangerous." },
  personal: { zh: "你的家当。Banked 是已经存进营地的宝石(💎)，At risk 是还在手上、随时可能清零的宝石(💎)，Artifacts 是神器(🏺) 带来的分数。", en: "Your own holdings. Banked gems (💎) are already safe in camp, gems At risk can still be wiped out, and Artifacts (🏺) are the points you have collected." },
  status: { zh: "当前局面的一句话说明，告诉你该做什么，或者正在等谁。", en: "A one line summary of the situation, telling you what to do or whom you are waiting for." },
  round_notice: { zh: "本次探险的结束原因，可能是危险爆发、所有人回营或者牌堆抽空。", en: "Why this expedition ended, which is either a triggered hazard, everybody returning to camp, or an empty deck." },
  loot: { zh: "如果现在回营还能分到的东西：路径上没分完的宝石(💎) 余数，以及只有独自回营才能拿走的神器(🏺)。", en: "What you could still collect by leaving now: the gem (💎) remainders left on the path and the artifacts (🏺) that only a lone returner may claim." },
  path: { zh: "本次探险已经翻开的牌。宝石(💎) 会当场平分给洞里的人，余数留在牌上，神器(🏺) 要等到有人回营才结算。", en: "The cards revealed so far in this expedition. Treasure (💎) is split at once among the explorers in the cave with the remainder staying on the card, while artifacts (🏺) only settle when somebody leaves." },
  players: { zh: "所有探险者的状态，包括存好的宝石(💎)、手上的宝石(💎)、神器(🏺) 数量和总分。", en: "Every explorer with their banked gems (💎), gems in hand, artifact (🏺) count and total score." },
  hazards: { zh: "被永久移除的危险牌。每种危险初始各有 3 张，每爆发一次就永久移除 1 张。", en: "The permanently removed hazard cards. Each hazard starts with 3 copies and every bust removes 1 of them forever." },
  scoreboard: { zh: "五次探险全部结束后弹出的最终得分板。名次先比总分，总分相同再比神器(🏺) 数量，仍然相同就并列。每行列出存进营地的宝石(💎)、神器(🏺) 的数量与分数，以及两者相加的总分。", en: "The final scoreboard that pops up once all five expeditions are over. Ranking compares the total score first, then the artifact (🏺) count, and a remaining tie is shared. Each row lists banked gems (💎), the artifact (🏺) count with its points, and the total of the two." },
  continue: { zh: "继续深入。你会和还在洞里的人平分下一张宝石(💎)，但同一种危险出现第二次时，手上的宝石(💎) 会全部清零，存好的和神器(🏺) 不受影响。", en: "Keep exploring. You share the next treasure (💎) with the explorers still in the cave, and if a second matching hazard appears you lose every gem (💎) in hand while your banked gems and artifacts (🏺) stay safe." },
  leave: { zh: "回营并把宝石(💎) 存起来。一起回营的人会逐张平分每张宝石(💎) 牌上剩下的余数。如果你独自回营，还能拿走路径上所有神器(🏺)，多个人一起走则神器(🏺) 全部作废。", en: "Return to camp and bank your gems (💎). The returning explorers divide the remainder on each treasure card separately, and if you leave alone you also collect every artifact (🏺) on the path while several returners discard them." },
  next: { zh: "确认你已经看完本次探险的结果。所有玩家都确认后下一次探险才开始，你的确认不会跳过别人的回顾。", en: "Confirm that you have reviewed the expedition. The next one begins only after every player confirms, and your own confirmation never skips anyone else's review." },
  again: { zh: "用同一批玩家重开一局全新的五次探险，分数、神器(🏺) 和被移除的危险都会重置。", en: "Start a fresh five-round game with the same players. Scores, artifacts (🏺) and removed hazards all reset." }
};

let incanGoldHelpWidget = null;
let incanGoldExplainWidget = null;

function initIncanGoldHelpExplain() {
  if (incanGoldHelpWidget || typeof window.obgCreateHelp !== "function") return;
  incanGoldHelpWidget = window.obgCreateHelp(INCAN_GOLD_HELP_CONFIG);
  incanGoldExplainWidget = window.obgCreateExplain({
    gameId: "incan_gold",
    attribute: "data-incan-explain",
    explanations: INCAN_GOLD_EXPLAIN,
    button: incanGoldExplainBtn,
    root: () => incanGoldGamePanel,
    bypass: ["#incanGoldHelpBtn", "#incanGoldExplainBtn", "#incanGoldScoreboardClose"]
  });
  incanGoldHelpBtn?.addEventListener("click", () => {
    incanGoldExplainWidget?.exit();
    incanGoldHelpWidget.open();
  });
  incanGoldExplainBtn?.addEventListener("click", () => incanGoldExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initIncanGoldHelpExplain);
} else {
  initIncanGoldHelpExplain();
}

function formatIncanGoldHazard(hazard) {
  if (!hazard) {
    return "Unknown";
  }
  const emoji = INCAN_GOLD_HAZARD_ICONS[hazard] || "⚠️";
  const label = hazard.replace(/_/g, " ");
  return `${emoji} ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function renderIncanGoldPath(view) {
  if (!incanGoldPath) {
    return;
  }
  incanGoldPath.innerHTML = "";
  if (!view || !Array.isArray(view.path) || !view.path.length) {
    const empty = document.createElement("div");
    empty.className = "incan-gold-empty";
    empty.textContent = "No cards yet";
    incanGoldPath.appendChild(empty);
    return;
  }
  view.path.forEach((card) => {
    const wrapper = document.createElement("div");
    wrapper.className = `incan-gold-card ${card.type || ""}`;

    const title = document.createElement("div");
    title.className = "incan-gold-card-title";
    if (card.type === "treasure") {
      title.textContent = `💎 Treasure ${card.value ?? 0}`;
    } else if (card.type === "hazard") {
      title.textContent = formatIncanGoldHazard(card.hazard);
    } else if (card.type === "artifact") {
      title.textContent = `🏺 Artifact ${card.value ?? 0}`;
    } else {
      title.textContent = "Unknown";
    }
    wrapper.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "incan-gold-card-meta";
    if (card.type === "treasure") {
      meta.textContent = `Remainder: ${card.remainder ?? 0}`;
    } else if (card.type === "hazard") {
      meta.textContent = card.triggered ? "Triggered" : "Warning";
    } else if (card.type === "artifact") {
      meta.textContent = "Solo leaver only";
    }
    wrapper.appendChild(meta);
    wrapper.dataset.incanTip = card.type === "treasure"
      ? `Treasure (💎): ${card.value} gems. ${card.remainder || 0} remain on this card for returning explorers to divide.`
      : card.type === "artifact"
        ? `Artifact (🏺): ${card.value} points for a lone returner; discarded if multiple explorers return together.`
        : `${formatIncanGoldHazard(card.hazard)}: ${card.triggered ? "Repeated hazard! Explorers lost their hand." : "A second matching hazard ends the expedition."}`;

    incanGoldPath.appendChild(wrapper);
  });
}

function renderIncanGoldPlayers(view) {
  if (!incanGoldPlayers) {
    return;
  }
  incanGoldPlayers.innerHTML = "";
  if (!view || !Array.isArray(view.players)) {
    return;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "incan-gold-player";
    card.classList.toggle("is-you", player.player_id === view.you);

    const name = document.createElement("div");
    name.className = "incan-gold-player-name";
    name.textContent = `${player.name || player.player_id}${player.player_id === view.you ? " · You" : ""}${player.is_bot ? " · AI" : ""}`;
    card.appendChild(name);

    const line1 = document.createElement("div");
    line1.className = "incan-gold-player-line incan-gold-player-stats";
    [`Banked ${player.banked_gems ?? 0}`, `Hand ${player.hand_gems ?? 0}`].forEach((text) => {
      const stat = document.createElement("span");
      stat.textContent = text;
      line1.appendChild(stat);
    });
    card.appendChild(line1);

    const line2 = document.createElement("div");
    line2.className = "incan-gold-player-line incan-gold-player-stats";
    [`🏺 ${player.artifact_count ?? 0} (+${player.artifact_points ?? 0})`, `Total ${player.total_score ?? 0}`].forEach((text) => {
      const stat = document.createElement("span");
      stat.textContent = text;
      line2.appendChild(stat);
    });
    card.appendChild(line2);

    const line3 = document.createElement("div");
    line3.className = "incan-gold-player-line";
    const lastChoice = (view.last_decisions || {})[player.player_id];
    line3.textContent = view.phase === "round_end"
      ? ((view.next_round_ready || []).includes(player.player_id) ? "✓ Ready" : "Reviewing round")
      : view.game_over ? "Finished"
        : player.status !== "in_cave" ? "⛺ In camp"
          : player.decided ? "✓ Locked" : "Choosing";
    if (lastChoice) line3.textContent += ` · ${lastChoice === "leave" ? "Left" : "Continued"}`;
    card.dataset.incanTip = `${player.name || player.player_id}: ${player.banked_gems || 0} banked gems (💎), ${player.hand_gems || 0} gems at risk, ${player.artifact_count || 0} artifacts (🏺) worth ${player.artifact_points || 0} points. Total safe score: ${player.total_score || 0}.`;
    card.appendChild(line3);

    incanGoldPlayers.appendChild(card);
  });
}

function renderIncanGoldHazards(view) {
  if (!incanGoldRemovedHazards) {
    return;
  }
  incanGoldRemovedHazards.innerHTML = "";
  const removed = (view && view.removed_hazards) || {};
  const order = ["snake", "spider", "fire", "rockfall", "mummy"];
  order.forEach((hazard) => {
    const chip = document.createElement("div");
    chip.className = "incan-gold-hazard-chip";
    const count = removed[hazard] ?? 0;
    chip.textContent = `${formatIncanGoldHazard(hazard)} × ${count}`;
    chip.dataset.incanTip = `${formatIncanGoldHazard(hazard)}: ${count} permanently removed, ${3 - count} remain in the base deck.`;
    incanGoldRemovedHazards.appendChild(chip);
  });
}

function rankIncanGoldPlayers(view) {
  const players = Array.isArray(view && view.players) ? view.players.slice() : [];
  players.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0)
    || (b.artifact_count ?? 0) - (a.artifact_count ?? 0)
    || (a.seat ?? 0) - (b.seat ?? 0));
  let rank = 0;
  let previousKey = null;
  return players.map((player, index) => {
    const key = `${player.total_score ?? 0}/${player.artifact_count ?? 0}`;
    if (key !== previousKey) {
      rank = index + 1;
      previousKey = key;
    }
    return { player, rank };
  });
}

function renderIncanGoldScoreboard(view) {
  if (!incanGoldScoreboard || !incanGoldScoreboardRows) {
    return;
  }
  if (!view || !view.game_over) {
    incanGoldScoreboardDismissed = false;
    if (incanGoldScoreboard.open) incanGoldScoreboard.close();
    incanGoldScoreboardRows.innerHTML = "";
    if (incanGoldScoreboardNote) incanGoldScoreboardNote.textContent = "";
    return;
  }

  const winners = new Set(Array.isArray(view.winner) ? view.winner : []);
  const ranked = rankIncanGoldPlayers(view);
  incanGoldScoreboardRows.innerHTML = "";
  ranked.forEach(({ player, rank }) => {
    const isWinner = winners.has(player.player_id);
    const row = document.createElement("li");
    row.className = "incan-gold-score-row";
    row.classList.toggle("is-winner", isWinner);
    row.classList.toggle("is-you", player.player_id === view.you);

    const rankEl = document.createElement("span");
    rankEl.className = "incan-gold-score-rank";
    rankEl.textContent = String(rank);
    row.appendChild(rankEl);

    const nameEl = document.createElement("span");
    nameEl.className = "incan-gold-score-name";
    const nameText = document.createElement("span");
    nameText.className = "incan-gold-score-name-text";
    nameText.textContent = `${player.name || player.player_id}${player.player_id === view.you ? " · You" : ""}${player.is_bot ? " · AI" : ""}`;
    nameEl.appendChild(nameText);
    if (isWinner) {
      const badge = document.createElement("span");
      badge.className = "incan-gold-score-badge";
      badge.textContent = "🏆";
      nameEl.appendChild(badge);
    }
    row.appendChild(nameEl);

    const totalEl = document.createElement("span");
    totalEl.className = "incan-gold-score-total";
    totalEl.textContent = String(player.total_score ?? 0);
    row.appendChild(totalEl);

    const detailEl = document.createElement("span");
    detailEl.className = "incan-gold-score-detail";
    detailEl.textContent = `💎 ${player.banked_gems ?? 0} banked · 🏺 ${player.artifact_count ?? 0} (+${player.artifact_points ?? 0})`;
    row.appendChild(detailEl);

    incanGoldScoreboardRows.appendChild(row);
  });

  if (incanGoldScoreboardNote) {
    const names = ranked
      .filter(({ player }) => winners.has(player.player_id))
      .map(({ player }) => player.name || player.player_id);
    incanGoldScoreboardNote.textContent = names.length > 1
      ? `🏆 Shared win: ${names.join(", ")}`
      : names.length === 1 ? `🏆 ${names[0]} wins` : "";
  }

  const panelHidden = incanGoldGamePanel?.classList.contains("hidden");
  if (!incanGoldScoreboardDismissed && !incanGoldScoreboard.open && !panelHidden) {
    incanGoldScoreboard.showModal();
  }
}

function dismissIncanGoldScoreboard() {
  incanGoldScoreboardDismissed = true;
  if (incanGoldScoreboard?.open) {
    incanGoldScoreboard.close();
  }
}

if (incanGoldScoreboardCloseBtn) {
  incanGoldScoreboardCloseBtn.addEventListener("click", dismissIncanGoldScoreboard);
}

if (incanGoldScoreboard) {
  incanGoldScoreboard.addEventListener("click", (event) => {
    if (event.target === incanGoldScoreboard) {
      dismissIncanGoldScoreboard();
    }
  });
  // Esc must dismiss for good, so handle it instead of letting the dialog close itself.
  incanGoldScoreboard.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismissIncanGoldScoreboard();
  });
}

function renderIncanGoldRoundNotice(view) {
  if (!incanGoldRoundNotice || !incanGoldRoundNoticeBody || !incanGoldRoundNoticeTitle) {
    return;
  }
  const roundEnd = view && view.round_end ? view.round_end : {};
  if (!roundEnd || !roundEnd.reason) {
    incanGoldRoundNotice.classList.add("hidden");
    incanGoldRoundNotice.setAttribute("aria-hidden", "true");
    return;
  }
  incanGoldRoundNotice.classList.remove("hidden");
  incanGoldRoundNotice.setAttribute("aria-hidden", "false");
  incanGoldRoundNoticeTitle.textContent = view.game_over ? "Game Over" : "Round End";
  let body = "";
  if (roundEnd.reason === "hazard") {
    body = `💥 Hazard: ${formatIncanGoldHazard(roundEnd.hazard)}`;
  } else if (roundEnd.reason === "all_left") {
    body = "All explorers returned safely.";
  } else if (roundEnd.reason === "deck_empty") {
    body = "Deck empty: explorers returned safely.";
  } else {
    body = roundEnd.reason;
  }
  if (roundEnd.artifacts_removed) {
    body += ` · Artifacts removed: ${roundEnd.artifacts_removed}`;
  }
  incanGoldRoundNoticeBody.textContent = body;
}

function isIncanGoldActionAvailable(actionType) {
  if (!currentIncanGoldView || !Array.isArray(currentIncanGoldView.legal_actions)) {
    return false;
  }
  return currentIncanGoldView.legal_actions.includes(actionType);
}

function updateIncanGoldActionButtons() {
  const active = currentGameType === "incan_gold" && currentIncanGoldView;
  const canDecide = active && isIncanGoldActionAvailable("decide");
  const canNext = active && currentIncanGoldView.phase === "round_end" && isIncanGoldActionAvailable("next_round");
  const canPlayAgain = active && currentIncanGoldView.game_over && isIncanGoldActionAvailable("play_again");
  const states = [
    { el: incanGoldContinueBtn, allowed: canDecide },
    { el: incanGoldLeaveBtn, allowed: canDecide },
    { el: incanGoldNextRoundBtn, allowed: canNext },
    { el: incanGoldPlayAgainBtn, allowed: canPlayAgain },
  ];
  states.forEach(({ el, allowed }) => {
    if (!el) {
      return;
    }
    el.classList.toggle("action-allowed", Boolean(allowed));
    el.classList.toggle("hidden", !allowed);
    el.disabled = !allowed;
  });
}

function clearIncanGoldState() {
  currentIncanGoldView = null;
  incanGoldExplainWidget?.exit();
  hideIncanGoldTooltip();
  incanGoldScoreboardDismissed = false;
  if (incanGoldScoreboard?.open) {
    incanGoldScoreboard.close();
  }
  if (incanGoldScoreboardRows) {
    incanGoldScoreboardRows.innerHTML = "";
  }
  if (incanGoldScoreboardNote) {
    incanGoldScoreboardNote.textContent = "";
  }
  ["incanGoldBanked", "incanGoldHand", "incanGoldArtifacts", "incanGoldLoot"].forEach((id) => {
    document.getElementById(id).textContent = "-";
  });
  document.getElementById("incanGoldRisk").textContent = "Risk -";
  document.getElementById("incanGoldWinnerRow").classList.add("hidden");
  incanGoldStatus.textContent = "Waiting for game state…";
  if (incanGoldPhaseLabel) {
    incanGoldPhaseLabel.textContent = "-";
  }
  if (incanGoldRoundLabel) {
    incanGoldRoundLabel.textContent = "-";
  }
  if (incanGoldMaxRoundsLabel) {
    incanGoldMaxRoundsLabel.textContent = "-";
  }
  if (incanGoldDeckLabel) {
    incanGoldDeckLabel.textContent = "-";
  }
  if (incanGoldInCaveLabel) {
    incanGoldInCaveLabel.textContent = "-";
  }
  if (incanGoldDecidedLabel) {
    incanGoldDecidedLabel.textContent = "-";
  }
  if (incanGoldWinnerLabel) {
    incanGoldWinnerLabel.textContent = "-";
  }
  if (incanGoldRoundNotice) {
    incanGoldRoundNotice.classList.add("hidden");
    incanGoldRoundNotice.setAttribute("aria-hidden", "true");
  }
  if (incanGoldPath) {
    incanGoldPath.innerHTML = "";
  }
  if (incanGoldPlayers) {
    incanGoldPlayers.innerHTML = "";
  }
  if (incanGoldRemovedHazards) {
    incanGoldRemovedHazards.innerHTML = "";
  }
  updateIncanGoldActionButtons();
}

function renderIncanGoldGameState(data) {
  const view = data.view;
  currentIncanGoldView = view;
  if (currentGameType !== "incan_gold") {
    currentGameType = "incan_gold";
    setGamePanelVisibility("incan_gold");
  }

  if (incanGoldPhaseLabel) {
    incanGoldPhaseLabel.textContent = { decision: "Exploring", round_end: "Round review", game_over: "Final scores" }[view.phase] || "Waiting";
  }
  if (incanGoldRoundLabel) {
    incanGoldRoundLabel.textContent = view.round ?? "-";
  }
  if (incanGoldMaxRoundsLabel) {
    incanGoldMaxRoundsLabel.textContent = view.max_rounds ?? "-";
  }
  if (incanGoldDeckLabel) {
    incanGoldDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (incanGoldInCaveLabel) {
    incanGoldInCaveLabel.textContent = view.in_cave_count ?? "-";
  }
  if (incanGoldDecidedLabel) {
    const decided = view.decided_count ?? 0;
    const total = view.in_cave_count ?? "-";
    incanGoldDecidedLabel.textContent = `${decided}/${total}`;
  }
  if (incanGoldWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      incanGoldWinnerLabel.textContent = names.join(", ");
    } else {
      incanGoldWinnerLabel.textContent = "-";
    }
  }

  renderIncanGoldRoundNotice(view);
  renderIncanGoldPath(view);
  renderIncanGoldPlayers(view);
  renderIncanGoldHazards(view);
  renderIncanGoldSummary(view);
  logGameEvents(data);
  updateIncanGoldActionButtons();
  renderIncanGoldScoreboard(view);
}

if (incanGoldContinueBtn) {
  incanGoldContinueBtn.addEventListener("click", () => {
    if (isIncanGoldActionAvailable("decide")) sendAction({ type: "decide", choice: "continue" });
  });
}

if (incanGoldLeaveBtn) {
  incanGoldLeaveBtn.addEventListener("click", () => {
    if (isIncanGoldActionAvailable("decide")) sendAction({ type: "decide", choice: "leave" });
  });
}

if (incanGoldNextRoundBtn) {
  incanGoldNextRoundBtn.addEventListener("click", () => {
    if (isIncanGoldActionAvailable("next_round")) sendAction({ type: "next_round" });
  });
}

if (incanGoldPlayAgainBtn) {
  incanGoldPlayAgainBtn.addEventListener("click", () => {
    if (isIncanGoldActionAvailable("play_again")) sendAction({ type: "play_again" });
  });
}

function renderIncanGoldSummary(view) {
  const player = (view.players || []).find((entry) => entry.player_id === view.you);
  document.getElementById("incanGoldBanked").textContent = player?.banked_gems ?? "-";
  document.getElementById("incanGoldHand").textContent = player?.hand_gems ?? "-";
  document.getElementById("incanGoldArtifacts").textContent = player?.artifact_points ?? "-";
  document.getElementById("incanGoldWinnerRow").classList.toggle("hidden", !view.game_over || !view.winner?.length);
  const danger = Object.entries(view.hazard_counts || {}).reduce((total, [hazard, count]) => {
    return total + (count > 0 ? Math.max(0, 3 - (view.removed_hazards?.[hazard] || 0) - count) : 0);
  }, 0);
  document.getElementById("incanGoldRisk").textContent = view.phase === "decision" && view.deck_count
    ? `Risk ${Math.round(danger / view.deck_count * 100)}%` : "Risk —";
  const remainder = (view.path || []).reduce((total, card) => total + (card.type === "treasure" ? card.remainder || 0 : 0), 0);
  const artifacts = (view.path || []).reduce((total, card) => total + (card.type === "artifact" ? card.value || 0 : 0), 0);
  document.getElementById("incanGoldLoot").textContent = `Left: 💎 ${remainder} · 🏺 ${artifacts}`;
  if (view.game_over) {
    incanGoldStatus.textContent = "All five expeditions complete.";
  } else if (view.phase === "round_end") {
    const ready = view.next_round_ready || [];
    incanGoldStatus.textContent = `${ready.length}/${view.players.length} ready · ${ready.includes(view.you) ? "Waiting for other explorers." : "Review the result, then confirm Next Round."}`;
  } else if (!player) {
    incanGoldStatus.textContent = "Watching the expedition.";
  } else if (player.status !== "in_cave") {
    incanGoldStatus.textContent = "Safe in camp · waiting for the expedition to finish.";
  } else if (view.your_decision) {
    incanGoldStatus.textContent = `${view.your_decision === "leave" ? "Leave" : "Continue"} locked · waiting for other explorers.`;
  } else {
    incanGoldStatus.textContent = "Continue exploring, or return to bank your gems?";
  }
  document.querySelector("#incanGoldPanel .incan-gold-decision-meta").classList.toggle("hidden", view.phase !== "decision");
}

function hideIncanGoldTooltip() {
  window.clearTimeout(incanGoldTooltipTimer);
  incanGoldTooltip.hidden = true;
}

function showIncanGoldTooltip(target) {
  if (!target?.dataset.incanTip || document.body.classList.contains("obg-explaining")) return;
  incanGoldTooltip.textContent = target.dataset.incanTip;
  incanGoldTooltip.hidden = false;
  const bounds = target.getBoundingClientRect();
  const tooltipBounds = incanGoldTooltip.getBoundingClientRect();
  incanGoldTooltip.style.left = `${Math.max(10, Math.min(bounds.left, window.innerWidth - tooltipBounds.width - 10))}px`;
  incanGoldTooltip.style.top = `${Math.max(10, Math.min(bounds.bottom + 6, window.innerHeight - tooltipBounds.height - 10))}px`;
  window.clearTimeout(incanGoldTooltipTimer);
  incanGoldTooltipTimer = window.setTimeout(hideIncanGoldTooltip, 3000);
}

function showIncanGoldHeaderActions(show) {
  document.getElementById("incanGoldHeaderActions").style.display = show ? "flex" : "none";
  if (!show) {
    incanGoldExplainWidget?.exit();
    hideIncanGoldTooltip();
    // Closing here is not a dismissal, so the board reappears if the player returns.
    if (incanGoldScoreboard?.open) {
      incanGoldScoreboard.close();
    }
  }
}

incanGoldGamePanel.addEventListener("pointerover", (event) => {
  if (event.pointerType === "mouse") showIncanGoldTooltip(event.target.closest("[data-incan-tip]"));
});
incanGoldGamePanel.addEventListener("pointerout", hideIncanGoldTooltip);
incanGoldGamePanel.addEventListener("click", (event) => {
  if (!event.target.closest("button, summary")) showIncanGoldTooltip(event.target.closest("[data-incan-tip]"));
});
document.addEventListener("scroll", hideIncanGoldTooltip, true);
document.addEventListener("keydown", (event) => {
  if (currentGameType === "incan_gold" && event.key === "Escape") hideIncanGoldTooltip();
});
