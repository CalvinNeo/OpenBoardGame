let currentCitadelsView = null;
let citadelsRedrawSelection = new Set();
let citadelsConfirmElement = null;
let citadelsTooltipTimer = null;

const citadelsPanelEl = document.getElementById("citadelsPanel");
const citadelsHeaderActions = document.getElementById("citadelsHeaderActions");
const citadelsPhaseLabel = document.getElementById("citadelsPhase");
const citadelsRoundLabel = document.getElementById("citadelsRound");
const citadelsModeLabel = document.getElementById("citadelsMode");
const citadelsCrownHolderLabel = document.getElementById("citadelsCrownHolder");
const citadelsCurrentPlayerLabel = document.getElementById("citadelsCurrentPlayer");
const citadelsCurrentRoleLabel = document.getElementById("citadelsCurrentRole");
const citadelsWinningCitySizeLabel = document.getElementById("citadelsWinningCitySize");
const citadelsBannerBody = document.getElementById("citadelsBannerBody");
const citadelsYourRoles = document.getElementById("citadelsYourRoles");
const citadelsActions = document.getElementById("citadelsActions");
const citadelsHand = document.getElementById("citadelsHand");
const citadelsPlayers = document.getElementById("citadelsPlayers");
const citadelsLog = document.getElementById("citadelsLog");
const citadelsRoundSummary = document.getElementById("citadelsRoundSummary");
const citadelsSummaryTitle = document.getElementById("citadelsSummaryTitle");
const citadelsSummarySubtitle = document.getElementById("citadelsSummarySubtitle");
const citadelsSummaryStatus = document.getElementById("citadelsSummaryStatus");
const citadelsSummaryHighlights = document.getElementById("citadelsSummaryHighlights");
const citadelsSummaryPlayers = document.getElementById("citadelsSummaryPlayers");
const citadelsSummaryReadyList = document.getElementById("citadelsSummaryReadyList");
const citadelsNextRoundBtn = document.getElementById("citadelsNextRoundBtn");
const citadelsHelpBtn = document.getElementById("citadelsHelpBtn");
const citadelsExplainBtn = document.getElementById("citadelsExplainBtn");
const citadelsRoleTrack = document.getElementById("citadelsRoleTrack");
const citadelsBuildProgress = document.getElementById("citadelsBuildProgress");
const citadelsTooltip = document.getElementById("citadelsTooltip");
document.querySelector(".game-panel > .panel-header")?.appendChild(citadelsHeaderActions);

const CITADELS_ROLE_DETAILS = {
  1: "Assassin (💀): choose a later role to skip its turn. Its owner stays hidden until the recap.",
  2: "Thief (🔑): name a role from rank 3 onward, except the assassinated role. Steal its owner's gold when that role is revealed.",
  3: "Magician (🎩): swap your entire hand with another player, or return selected cards to the deck bottom and draw replacements.",
  4: "King (👑): collect gold for yellow districts and take the crown for next round's first draft, even if assassinated.",
  5: "Bishop (⛪): collect gold for blue districts. Your city is protected from Warlord unless Bishop is assassinated.",
  6: "Merchant (💰): automatically gain 1 extra gold after income and collect tax for green districts.",
  7: "Architect (🏠): automatically draw 2 extra cards after income and build up to 3 districts this turn.",
  8: "Warlord (⚔): collect tax for red districts and optionally destroy one district for its cost minus 1. Completed cities and the Bishop are protected.",
  9: "Queen (👸): in 5–6 player games, gain 3 gold when seated next to this round's King. A killed King delays this bonus until the recap.",
};
const CITADELS_HELP_CONFIG = {
  gameId: "citadels",
  title: { zh: "富饶之城 · Citadels", en: "Citadels" },
  basic: {
    win: { zh: "终局时建筑费用、特殊加分、全色奖励与完工奖励的总分最高者获胜，而不是最先建完的人直接获胜。", en: "Win with the highest total of district costs, special points, color bonuses and completion bonuses, not simply by finishing first." },
    turn: { zh: "每轮秘密选角色，按顺位行动，先拿金币(💰)或抽建筑牌(🃏)，再使用技能、收税和建造。", en: "Secretly draft roles each round, act in rank order, take Gold (💰) or District cards (🃏), then use powers, tax and build." },
    key: { zh: "围绕自己的建筑颜色和资金选角，平衡得分、连建速度与对手的完工时机。", en: "Draft around your district colors and budget, balancing points, building tempo and rivals' completion timing." },
  },
  sections: [
    { id: "flow", label: { zh: "流程与操作", en: "Flow & controls" }, html: {
      zh: "<p>皇冠(👑)持有者先选角。2–3 人每人拿两个角色，4–6 人每人拿一个。上方顺位条显示明置移出、已公开及当前角色，不泄露暗置身份。</p><p>收入必须二选一：拿 2 金币(💰)，或抽 2 张建筑牌(🃏)留 1 张，另一张放牌堆底。之后可自由安排收税、技能与建造，通常最多建 1 座，同名建筑不能重复。</p><p>建造、选角、保留牌和摧毁在目标旁确认。魔术师在手牌上选中待换牌，再点 Redraw Selected。点空白处或按 Esc 取消确认，滚动不会选牌。轮末所有人点击 Next Round 后才继续。</p>",
      en: "<p>The Crown (👑) holder drafts first. Each player takes two roles with 2–3 players, or one with 4–6. The rank track shows face-up removals, revealed roles and the current role without exposing hidden owners.</p><p>Choose mandatory income: take 2 Gold (💰), or draw 2 District cards (🃏), keep 1 and return the other to the deck bottom. Then tax, use powers and build in any legal order. Normally build once and never duplicate a district name.</p><p>Confirm drafting, keeping, building and destruction beside their targets. Magician selects cards in the hand before Redraw Selected. Click blank space or press Escape to dismiss a confirmation, and scrolling never selects cards. Everyone must press Next Round at the recap.</p>",
    } },
    { id: "roles", label: { zh: "角色技能", en: "Role powers" }, html: {
      zh: "<p>刺客(💀)让指定后续角色跳过回合。盗贼(🔑)在目标角色亮出时偷走其全部金币，不能选刺客、盗贼或被刺杀角色。魔术师(🎩)交换全部手牌或重抽任意数量的手牌。</p><p>国王(👑)、主教(⛪)、商人(💰)、军阀(⚔)分别按黄色、蓝色、绿色、红色建筑收税，每回合一次。先建同色建筑再收税可以多拿钱。国王拿皇冠，主教保护城市，商人收入后自动多拿 1 金币。</p><p>建筑师(🏠)收入后自动抽 2 张牌，最多建 3 座。军阀(⚔)可付建筑费用减 1 的金币摧毁一座，但不能摧毁完工城市、受主教保护的城市或城塞。皇后(👸)只在 5–6 人出现，与本轮国王相邻可拿 3 金币，国王被刺杀则轮末补发。</p>",
      en: "<p>Assassin (💀) skips a named later role. Thief (🔑) steals all gold when the named role appears, excluding Assassin, Thief and the killed role. Magician (🎩) swaps whole hands or redraws any number of selected cards.</p><p>King (👑), Bishop (⛪), Merchant (💰) and Warlord (⚔) tax yellow, blue, green and red districts once per turn. Building a matching district before taxing earns an extra gold. King takes the crown, Bishop protects the city, and Merchant gains 1 automatic gold after income.</p><p>Architect (🏠) draws 2 automatic cards after income and may build 3 times. Warlord (⚔) can destroy one district for its cost minus 1, but not completed cities, Bishop-protected cities or the Keep. Queen (👸) appears with 5–6 players and gains 3 gold next to this round's King, deferred to recap if King was killed.</p>",
    } },
    { id: "score", label: { zh: "计分与紫卡", en: "Scoring & districts" }, html: {
      zh: "<p>有人达到设定的 7 或 8 座建筑后，本轮仍完整进行。建筑费用计分，集齐五色加 3 分，首位完工加 4 分，其他完工者加 2 分。同分先比建筑费用总和，再比本轮已公开的最高角色顺位。</p><p>黄色、蓝色、绿色、红色、紫色圆点代表建筑类别。大学与龙门客栈额外加 2 分，学堂可补足一种颜色，城塞不能被军阀摧毁。其他紫卡目前只按费用计分，不执行尚未实现的实体牌能力，卡牌说明以本项目实现为准。</p><p>城市信息中的金币(💰)、手牌(🃏)与建筑(🏠)都是公开数量。回合复盘中，刺杀(💀)、盗窃(🔑)、技能(✨)、奖励(🎁)、受袭(💥)、完工(🏁)、胜者(🏆)与完成行动(✓)对应行动结果，未使用角色(🎭)会一并公开。</p>",
      en: "<p>When a city reaches the configured 7 or 8 districts, finish the entire round. Score district costs, +3 for all five colors, +4 for first completion and +2 for other completed cities. Break ties by district cost total, then this round's highest revealed role rank.</p><p>Yellow, blue, green, red and purple dots identify district categories. University and Dragon Gate Inn add 2 points, School of Magic supplies a missing color, and Keep cannot be destroyed. Other purple districts currently score their cost only and do not activate unimplemented tabletop powers.</p><p>Player Gold (💰), Hand (🃏) and City (🏠) counts are public. Recaps identify Assassination (💀), Theft (🔑), Power (✨), Bonus (🎁), Attack (💥), Completion (🏁), Winner (🏆) and Finished action (✓), and reveal Unused roles (🎭).</p>",
    } },
  ],
};
const CITADELS_EXPLANATIONS = {
  status: "Public phase, round, role mode and crown holder. Hidden roles remain private until revealed.",
  nextRound: "Confirm that you have reviewed this round. The next draft starts only when every player is ready.",
};
const citadelsHelpWidget = typeof window.obgCreateHelp === "function" ? window.obgCreateHelp(CITADELS_HELP_CONFIG) : null;
const citadelsExplainWidget = typeof window.obgCreateExplain === "function" ? window.obgCreateExplain({
  gameId: "citadels",
  attribute: "data-citadels-explain",
  explanations: CITADELS_EXPLANATIONS,
  button: citadelsExplainBtn,
  root: () => citadelsPanelEl,
  bypass: ["#citadelsHelpBtn", "#citadelsExplainBtn"],
}) : null;

function citadelsDescribe(node, key, text, tip = false) {
  CITADELS_EXPLANATIONS[key] = text;
  node.dataset.citadelsExplain = key;
  if (tip) {
    node.dataset.citadelsTip = text;
    node.tabIndex = 0;
  }
  return node;
}

function citadelsBuildColorDot(color) {
  const dot = document.createElement("span");
  const safeColor = ["yellow", "blue", "green", "red", "purple"].includes(color) ? color : "unknown";
  dot.className = `citadels-color-dot citadels-color-dot-${safeColor}`;
  dot.setAttribute("aria-label", `${safeColor} district`);
  dot.title = `${safeColor} district`;
  return dot;
}

function citadelsRoleLabel(role) {
  if (!role) return "-";
  return `${role.rank}. ${role.name_cn}`;
}

function citadelsStepLabel(step) {
  if (step === "choose_income") return "Choose income";
  if (step === "choose_draw") return "Keep 1 card";
  if (step === "main") return "Main actions";
  return step || "-";
}

function citadelsPhaseText(phase) {
  if (phase === "draft") return "Draft";
  if (phase === "turn") return "Role Turns";
  if (phase === "round_end") return "Round Recap";
  if (phase === "game_over") return "Game Over";
  return phase || "-";
}

function citadelsRoleEmoji(rank) {
  const icons = {
    1: "💀",
    2: "🔑",
    3: "🎩",
    4: "👑",
    5: "⛪",
    6: "💰",
    7: "🏠",
    8: "⚔",
    9: "👸",
  };
  return icons[Number(rank)] || "🎭";
}

function citadelsActionEmoji(actionType) {
  const icons = {
    income: "💰",
    draw: "🃏",
    tax: "💰",
    build: "🏠",
    ability: "✨",
    bonus: "🎁",
    crown: "👑",
    targeted: "💥",
    end_turn: "✓",
  };
  return icons[actionType] || "•";
}

function citadelsAppendEmphasizedText(container, value, emphasizedValues) {
  const text = String(value || "Action completed.");
  const terms = [...new Set((emphasizedValues || []).filter((entry) => typeof entry === "string" && entry))];
  if (!terms.length) {
    container.textContent = text;
    return;
  }

  let cursor = 0;
  while (cursor < text.length) {
    let nextMatch = null;
    terms.forEach((term) => {
      const index = text.indexOf(term, cursor);
      if (index < 0) return;
      if (!nextMatch || index < nextMatch.index || (index === nextMatch.index && term.length > nextMatch.term.length)) {
        nextMatch = { index, term };
      }
    });
    if (!nextMatch) {
      container.appendChild(document.createTextNode(text.slice(cursor)));
      break;
    }
    if (nextMatch.index > cursor) {
      container.appendChild(document.createTextNode(text.slice(cursor, nextMatch.index)));
    }
    const strong = document.createElement("strong");
    strong.textContent = nextMatch.term;
    container.appendChild(strong);
    cursor = nextMatch.index + nextMatch.term.length;
  }
}

function citadelsFindSummaryRole(summary, rank) {
  const wantedRank = Number(rank);
  for (const player of summary?.players || []) {
    const role = (player.roles || []).find((entry) => Number(entry.rank) === wantedRank);
    if (role) return role;
  }
  return (summary?.unassigned_roles || []).find((entry) => Number(entry.rank) === wantedRank) || null;
}

function citadelsSummaryRoleLabel(summary, rank) {
  const role = citadelsFindSummaryRole(summary, rank);
  return role ? `${citadelsRoleEmoji(role.rank)} ${role.rank}. ${role.name_cn}` : "-";
}

function getCitadelsSelfPlayer(view) {
  if (!view || !Array.isArray(view.players)) {
    return null;
  }
  return view.players.find((player) => player.player_id === view.you) || null;
}

function canCitadelsBuildCard(view, card) {
  const selfPlayer = getCitadelsSelfPlayer(view);
  if (!selfPlayer || !card) {
    return false;
  }
  if (selfPlayer.gold < card.cost) {
    return false;
  }
  return !selfPlayer.city.some((district) => district.name_cn === card.name_cn);
}

function pruneCitadelsRedrawSelection(view) {
  const handIds = new Set((view?.your_hand || []).map((card) => card.id));
  citadelsRedrawSelection.forEach((cardId) => {
    if (!handIds.has(cardId)) {
      citadelsRedrawSelection.delete(cardId);
    }
  });
}

function clearCitadelsState() {
  currentCitadelsView = null;
  citadelsRedrawSelection.clear();
  if (citadelsPhaseLabel) citadelsPhaseLabel.textContent = "-";
  if (citadelsRoundLabel) citadelsRoundLabel.textContent = "-";
  if (citadelsModeLabel) citadelsModeLabel.textContent = "-";
  if (citadelsCrownHolderLabel) citadelsCrownHolderLabel.textContent = "-";
  if (citadelsCurrentPlayerLabel) citadelsCurrentPlayerLabel.textContent = "-";
  if (citadelsCurrentRoleLabel) citadelsCurrentRoleLabel.textContent = "-";
  if (citadelsWinningCitySizeLabel) citadelsWinningCitySizeLabel.textContent = "-";
  if (citadelsBannerBody) citadelsBannerBody.textContent = "-";
  if (citadelsYourRoles) citadelsYourRoles.innerHTML = "";
  if (citadelsActions) citadelsActions.innerHTML = "";
  if (citadelsHand) citadelsHand.innerHTML = "";
  if (citadelsPlayers) citadelsPlayers.innerHTML = "";
  if (citadelsLog) citadelsLog.innerHTML = "";
  if (citadelsRoleTrack) citadelsRoleTrack.replaceChildren();
  if (citadelsBuildProgress) citadelsBuildProgress.textContent = "";
  citadelsCancelConfirmation();
  if (citadelsRoundSummary) {
    citadelsRoundSummary.classList.add("hidden");
    citadelsRoundSummary.setAttribute("aria-hidden", "true");
  }
  if (citadelsSummaryHighlights) citadelsSummaryHighlights.innerHTML = "";
  if (citadelsSummaryPlayers) citadelsSummaryPlayers.innerHTML = "";
  if (citadelsSummaryReadyList) citadelsSummaryReadyList.innerHTML = "";
  closeCitadelsHelpModal();
  closeCitadelsExplainModal();
}

function showCitadelsHeaderActions(show) {
  if (citadelsHeaderActions) {
    citadelsHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    closeCitadelsHelpModal();
    closeCitadelsExplainModal();
  }
}

function showCitadelsHelpModal() {
  citadelsExplainWidget?.exit();
  citadelsHelpWidget?.open();
}

function closeCitadelsHelpModal() {
  citadelsHelpWidget?.close();
}

function showCitadelsExplainModal() {
  citadelsCancelConfirmation();
  citadelsHideTooltip();
  citadelsExplainWidget?.toggle();
}

function closeCitadelsExplainModal() {
  citadelsExplainWidget?.exit();
  citadelsHideTooltip();
}

function createCitadelsButton(label, onClick, extraClass = "", explanation = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (extraClass) {
    button.className = extraClass;
  }
  button.addEventListener("click", onClick);
  const descriptions = {
    "Take 2 Gold": "Take 2 gold as mandatory income, then apply automatic role bonuses.",
    "Draw 2 Keep 1": "Draw two district cards and keep one. Return the other to the deck bottom.",
    "Collect Tax": "Collect 1 gold per district matching your role color, once this turn. Building a matching district first increases this income.",
    "End Turn": "Finish this role's turn. Unused building opportunities and powers are forfeited.",
    "Cancel": "Dismiss this confirmation without taking an action.",
  };
  const description = explanation || descriptions[label] || `Confirm ${label}.`;
  citadelsDescribe(button, `button-${description}`, description);
  return button;
}

function citadelsCancelConfirmation() {
  citadelsConfirmElement?.remove();
  citadelsConfirmElement = null;
}

function citadelsConfirmAction(button, label, action) {
  citadelsCancelConfirmation();
  const host = button.closest(".citadels-city-card") ? button.closest(".citadels-player-card") :
    button.closest(".citadels-card, .citadels-player-card, .citadels-action-section");
  if (!host) return;
  const confirmation = document.createElement("div");
  confirmation.className = "citadels-confirmation";
  const prompt = document.createElement("strong");
  prompt.textContent = label;
  const controls = document.createElement("div");
  controls.className = "citadels-button-wrap";
  controls.append(
    createCitadelsButton("Confirm", () => { citadelsCancelConfirmation(); sendAction(action); }, "", label),
    createCitadelsButton("Cancel", citadelsCancelConfirmation),
  );
  confirmation.append(prompt, controls);
  host.appendChild(confirmation);
  citadelsConfirmElement = confirmation;
}

function citadelsSelectionButton(label, action, explanation) {
  const button = createCitadelsButton(label, () => citadelsConfirmAction(button, label, action), "", explanation);
  return button;
}

function renderCitadelsRoleTrack(view) {
  if (!citadelsRoleTrack) return;
  citadelsRoleTrack.replaceChildren();
  const removed = new Set((view.draft_face_up_removed || []).map((role) => Number(role.rank)));
  const revealed = new Map((view.players || []).flatMap((player) =>
    (player.revealed_roles || []).map((role) => [Number(role.rank), player.name])));
  for (let rank = 1; rank <= (view.max_rank || 8); rank += 1) {
    const role = document.createElement("div");
    role.className = "citadels-track-role";
    role.classList.toggle("current", view.phase === "turn" && view.current_turn_role?.rank === rank);
    role.classList.toggle("removed", removed.has(rank));
    role.classList.toggle("revealed", revealed.has(rank));
    const icon = document.createElement("span");
    icon.textContent = `${rank} ${citadelsRoleEmoji(rank)}`;
    const name = document.createElement("small");
    name.textContent = removed.has(rank) ? "Out" : revealed.get(rank) || "Hidden";
    role.append(icon, name);
    citadelsDescribe(role, `role-${rank}`, CITADELS_ROLE_DETAILS[rank], true);
    citadelsRoleTrack.appendChild(role);
  }
}

function renderCitadelsBanner(view) {
  if (!citadelsBannerBody) return;
  if (!view) {
    citadelsBannerBody.textContent = "-";
    return;
  }
  if (view.game_over) {
    const winners = (view.winner_ids || []).map((playerId) => findPlayerName(view, playerId)).join(", ");
    citadelsBannerBody.textContent = winners ? `Game over. Winner: ${winners}` : "Game over.";
    return;
  }
  if (view.phase === "draft") {
    const name = view.current_drafter ? findPlayerName(view, view.current_drafter) : "-";
    citadelsBannerBody.textContent = `Draft phase. ${name} is choosing a role.`;
    return;
  }
  if (view.phase === "round_end") {
    const progress = view.next_round_progress || {};
    citadelsBannerBody.textContent = `Round ${view.round} complete. Review every role and action below · ${progress.done || 0}/${progress.total || 0} ready.`;
    return;
  }
  const role = view.current_turn_role;
  const currentPlayer = view.current_turn_player ? findPlayerName(view, view.current_turn_player) : "-";
  if (role) {
    citadelsBannerBody.textContent = `${currentPlayer} is playing ${citadelsRoleLabel(role)} · ${citadelsStepLabel(role.step)}.`;
    return;
  }
  citadelsBannerBody.textContent = "Waiting for the next role.";
}

function citadelsCreateSummaryHighlight(icon, label, value, wide = false) {
  const item = document.createElement("div");
  item.className = "citadels-summary-highlight";
  if (wide) item.classList.add("wide");
  const iconNode = document.createElement("span");
  iconNode.className = "citadels-summary-highlight-icon";
  iconNode.textContent = icon;
  const copy = document.createElement("div");
  const labelNode = document.createElement("div");
  labelNode.className = "citadels-summary-highlight-label";
  labelNode.textContent = label;
  const valueNode = document.createElement("div");
  valueNode.className = "citadels-summary-highlight-value";
  valueNode.textContent = value;
  copy.append(labelNode, valueNode);
  item.append(iconNode, copy);
  return item;
}

function citadelsBuildSummaryRoleBadge(role) {
  const badge = document.createElement("span");
  badge.className = "citadels-summary-role";
  if (role.assassinated) badge.classList.add("assassinated");
  else if (role.acted) badge.classList.add("acted");
  else badge.classList.add("skipped");
  if (role.robbed) badge.classList.add("robbed");

  let status = role.assassinated ? "assassinated" : role.acted ? "acted" : "did not act";
  if (role.robbed) status += " · robbed";
  badge.textContent = `${citadelsRoleEmoji(role.rank)} ${role.rank}. ${role.name_cn} · ${status}`;
  badge.title = role.name_en || role.name_cn || "Role";
  return badge;
}

function citadelsBuildSummaryPlayer(view, summary, player, readyPlayers) {
  const card = document.createElement("article");
  card.className = "citadels-summary-player";
  if (player.player_id === view.you) card.classList.add("self");
  if ((summary.winner_ids || view.winner_ids || []).includes(player.player_id)) card.classList.add("winner");

  const header = document.createElement("div");
  header.className = "citadels-summary-player-header";
  const identity = document.createElement("div");
  identity.className = "citadels-summary-player-name";
  identity.textContent = player.name || findPlayerName(view, player.player_id);
  if (player.is_bot) {
    const bot = document.createElement("span");
    bot.className = "citadels-summary-bot";
    bot.textContent = "BOT";
    identity.appendChild(bot);
  }
  header.appendChild(identity);
  if (view.phase === "round_end") {
    const readiness = document.createElement("span");
    readiness.className = "citadels-summary-player-ready";
    const isReady = readyPlayers.has(player.player_id);
    readiness.classList.toggle("ready", isReady);
    readiness.textContent = isReady ? "✅ Ready" : "⏳ Reviewing";
    header.appendChild(readiness);
  }

  const roles = document.createElement("div");
  roles.className = "citadels-summary-role-list";
  (player.roles || []).forEach((role) => roles.appendChild(citadelsBuildSummaryRoleBadge(role)));
  if (!roles.children.length) {
    const emptyRole = document.createElement("span");
    emptyRole.className = "citadels-summary-role skipped";
    emptyRole.textContent = "No assigned role";
    roles.appendChild(emptyRole);
  }

  const stats = document.createElement("div");
  stats.className = "citadels-summary-player-stats";
  [
    `💰 ${player.gold}`,
    `🏠 ${player.city_count} districts`,
    `⭐ ${player.city_value} city value`,
    `🃏 ${player.hand_count} cards`,
  ].forEach((value) => {
    const stat = document.createElement("span");
    stat.textContent = value;
    stats.appendChild(stat);
  });

  const scores = summary.scores || view.scores || {};
  const score = scores[player.player_id];
  if (score) {
    const totalScore = document.createElement("div");
    totalScore.className = "citadels-summary-score";
    totalScore.textContent = `🏆 ${score.total_score} points`;
    totalScore.title = `Districts ${score.base_score} + colors ${score.full_color_bonus} + completion ${score.completion_bonus} + special ${score.district_bonus}`;
    stats.appendChild(totalScore);
  }

  const actionHeading = document.createElement("div");
  actionHeading.className = "citadels-summary-action-heading";
  actionHeading.textContent = "What they did";
  const actions = document.createElement("div");
  actions.className = "citadels-summary-actions";
  const playerActions = Array.isArray(player.actions) ? player.actions : [];
  if (!playerActions.length) {
    const empty = document.createElement("div");
    empty.className = "citadels-summary-action empty";
    empty.textContent = "No completed public actions.";
    actions.appendChild(empty);
  } else {
    playerActions.forEach((action) => {
      const row = document.createElement("div");
      row.className = "citadels-summary-action";
      const icon = document.createElement("span");
      icon.className = "citadels-summary-action-icon";
      icon.textContent = citadelsActionEmoji(action.type);
      const text = document.createElement("span");
      citadelsAppendEmphasizedText(text, action.text, action.emphasis);
      row.append(icon, text);
      actions.appendChild(row);
    });
  }

  card.append(header, roles, stats, actionHeading, actions);
  return card;
}

function renderCitadelsRoundSummary(view) {
  if (!citadelsRoundSummary) return;
  const summary = view?.last_round_summary;
  const show = Boolean(summary) && (view.phase === "round_end" || view.game_over);
  citadelsRoundSummary.classList.toggle("hidden", !show);
  citadelsRoundSummary.setAttribute("aria-hidden", String(!show));
  if (!show) return;

  const isFinal = Boolean(view.game_over || summary.is_final_round);
  const readyPlayers = new Set(view.next_round_ready_player_ids || []);
  const progress = view.next_round_progress || { done: readyPlayers.size, total: (view.players || []).length };
  const canContinue = (view.legal_actions || []).includes("next_round");
  const alreadyReady = readyPlayers.has(view.you);
  if (citadelsSummaryTitle) {
    citadelsSummaryTitle.textContent = isFinal ? `Final Round · ${summary.round}` : `Round ${summary.round} Complete`;
  }
  if (citadelsSummarySubtitle) {
    citadelsSummarySubtitle.textContent = isFinal
      ? "Every identity is revealed. The final scoring breakdown is included below."
      : "Every identity is revealed. The next draft starts after everyone confirms.";
  }
  if (citadelsSummaryStatus) {
    citadelsSummaryStatus.textContent = isFinal ? "Final Scores" : `${progress.done || 0}/${progress.total || 0} Ready`;
    citadelsSummaryStatus.classList.toggle("final", isFinal);
  }
  if (citadelsSummaryHighlights) {
    citadelsSummaryHighlights.innerHTML = "";
    if (summary.killed_rank) {
      citadelsSummaryHighlights.appendChild(
        citadelsCreateSummaryHighlight("💀", "Assassinated", citadelsSummaryRoleLabel(summary, summary.killed_rank)),
      );
    }
    if (summary.robbed_rank) {
      citadelsSummaryHighlights.appendChild(
        citadelsCreateSummaryHighlight("🔑", "Theft Target", citadelsSummaryRoleLabel(summary, summary.robbed_rank)),
      );
    }
    if (summary.crown_holder) {
      citadelsSummaryHighlights.appendChild(
        citadelsCreateSummaryHighlight("👑", "Next Crown", findPlayerName(view, summary.crown_holder)),
      );
    }
    if (summary.first_completed_city_player_id) {
      citadelsSummaryHighlights.appendChild(
        citadelsCreateSummaryHighlight("🏁", "First Complete City", findPlayerName(view, summary.first_completed_city_player_id)),
      );
    }
    const unassigned = (summary.unassigned_roles || []).map(
      (role) => `${citadelsRoleEmoji(role.rank)} ${role.rank}. ${role.name_cn}`,
    );
    if (unassigned.length) {
      citadelsSummaryHighlights.appendChild(
        citadelsCreateSummaryHighlight("🎭", "Not In Play", unassigned.join(" · "), true),
      );
    }
  }

  if (citadelsSummaryPlayers) {
    citadelsSummaryPlayers.innerHTML = "";
    (summary.players || []).forEach((player) => {
      citadelsSummaryPlayers.appendChild(citadelsBuildSummaryPlayer(view, summary, player, readyPlayers));
    });
  }

  if (citadelsSummaryReadyList) {
    citadelsSummaryReadyList.innerHTML = "";
    if (isFinal) {
      const winnerNames = (summary.winner_ids || view.winner_ids || [])
        .map((playerId) => findPlayerName(view, playerId))
        .join(", ");
      citadelsSummaryReadyList.textContent = winnerNames ? `🏆 Winner: ${winnerNames}` : "Final scoring complete.";
    } else {
      (view.players || []).forEach((player) => {
        const item = document.createElement("span");
        const isReady = readyPlayers.has(player.player_id);
        item.className = `citadels-summary-ready-chip${isReady ? " ready" : ""}`;
        item.textContent = `${isReady ? "✅" : "⏳"} ${player.name}`;
        citadelsSummaryReadyList.appendChild(item);
      });
    }
  }

  if (citadelsNextRoundBtn) {
    citadelsNextRoundBtn.classList.toggle("hidden", isFinal);
    citadelsNextRoundBtn.disabled = !canContinue;
    citadelsNextRoundBtn.textContent = canContinue ? "Next Round" : alreadyReady ? "Ready ✓" : "Waiting for Players…";
  }
}

function renderCitadelsYourRoles(view) {
  if (!citadelsYourRoles) return;
  citadelsYourRoles.innerHTML = "";
  const roles = Array.isArray(view.your_roles) ? view.your_roles : [];
  if (!roles.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No roles yet.";
    citadelsYourRoles.appendChild(empty);
    return;
  }
  roles.forEach((role) => {
    const pill = document.createElement("div");
    pill.className = "citadels-role-pill";
    if (role.revealed) {
      pill.classList.add("revealed");
    }
    pill.textContent = `${citadelsRoleEmoji(role.rank)} ${role.rank}. ${role.name_cn}${role.revealed ? " · revealed" : " · hidden"}`;
    citadelsDescribe(pill, `role-${role.rank}`, CITADELS_ROLE_DETAILS[role.rank], true);
    citadelsYourRoles.appendChild(pill);
  });
}

function renderCitadelsActionSection(title, builder) {
  const section = document.createElement("div");
  section.className = "citadels-action-section";
  const heading = document.createElement("div");
  heading.className = "citadels-action-title";
  heading.textContent = title;
  section.appendChild(heading);
  builder(section);
  return section;
}

function renderCitadelsActions(view) {
  if (!citadelsActions) return;
  citadelsActions.innerHTML = "";
  if (!view) return;
  const legal = new Set(view.legal_actions || []);
  const options = view.action_options || {};

  if (legal.has("draft_character")) {
    citadelsActions.appendChild(
      renderCitadelsActionSection("Draft", (section) => {
        const wrap = document.createElement("div");
        wrap.className = "citadels-button-wrap";
        (options.draft_roles || []).forEach((role) => {
          wrap.appendChild(
            citadelsSelectionButton(`${citadelsRoleEmoji(role.rank)} ${role.rank}. ${role.name_cn}`,
              { type: "draft_character", rank: role.rank }, CITADELS_ROLE_DETAILS[role.rank]),
          );
        });
        section.appendChild(wrap);
      }),
    );
  }

  if (legal.has("choose_income")) {
    citadelsActions.appendChild(
      renderCitadelsActionSection("Income", (section) => {
        const wrap = document.createElement("div");
        wrap.className = "citadels-button-wrap";
        wrap.appendChild(createCitadelsButton("Take 2 Gold", () => sendAction({ type: "choose_income", choice: "gold" })));
        wrap.appendChild(
          createCitadelsButton("Draw 2 Keep 1", () => sendAction({ type: "choose_income", choice: "cards" })),
        );
        section.appendChild(wrap);
      }),
    );
  }

  if (legal.has("choose_draw") && view.current_turn_role && Array.isArray(view.current_turn_role.draw_offer)) {
    citadelsActions.appendChild(
      renderCitadelsActionSection("Keep 1 Card", (section) => {
        const grid = document.createElement("div");
        grid.className = "citadels-card-grid";
        view.current_turn_role.draw_offer.forEach((card) => {
          const cardNode = buildCitadelsDistrictCard(card);
          const keepButton = citadelsSelectionButton("Keep This", { type: "choose_draw", card_id: card.id },
            `Keep ${card.name_cn} (${card.name_en}), costing ${card.cost} gold. ${card.text || "Scores its printed cost."}`);
          keepButton.classList.add("citadels-inline-button");
          cardNode.appendChild(keepButton);
          grid.appendChild(cardNode);
        });
        section.appendChild(grid);
      }),
    );
  }

  const hasMainActions =
    legal.has("collect_tax") ||
    legal.has("end_turn") ||
    legal.has("use_assassin") ||
    legal.has("use_thief") ||
    legal.has("magician_swap") ||
    legal.has("magician_redraw") ||
    legal.has("destroy_district");

  if (hasMainActions) {
    citadelsActions.appendChild(
      renderCitadelsActionSection("This Turn", (section) => {
        const wrap = document.createElement("div");
        wrap.className = "citadels-button-wrap";
        if (legal.has("collect_tax")) {
          wrap.appendChild(createCitadelsButton("Collect Tax", () => sendAction({ type: "collect_tax" })));
        }
        if (legal.has("magician_redraw")) {
          const redrawCount = citadelsRedrawSelection.size;
          const redrawBtn = createCitadelsButton(`Redraw Selected${redrawCount ? ` (${redrawCount})` : ""}`, () => {
            if (!citadelsRedrawSelection.size) return;
            sendAction({ type: "magician_redraw", card_ids: Array.from(citadelsRedrawSelection) });
          }, "", `Return ${redrawCount} selected cards to the deck bottom and draw that many replacements. This uses Magician's power.`);
          redrawBtn.disabled = redrawCount === 0;
          wrap.appendChild(redrawBtn);
        }
        if (legal.has("end_turn")) {
          wrap.appendChild(createCitadelsButton("End Turn", () => sendAction({ type: "end_turn" })));
        }
        section.appendChild(wrap);
      }),
    );
  }

  if (legal.has("use_assassin")) {
    citadelsActions.appendChild(
      renderCitadelsActionSection("Assassin Targets", (section) => {
        const wrap = document.createElement("div");
        wrap.className = "citadels-button-wrap";
        (options.assassin_targets || []).forEach((role) => {
          wrap.appendChild(
            citadelsSelectionButton(`${citadelsRoleEmoji(role.rank)} ${role.rank}. ${role.name_cn}`,
              { type: "use_assassin", target_rank: role.rank }, `Skip this role's turn. ${CITADELS_ROLE_DETAILS[role.rank]}`),
          );
        });
        section.appendChild(wrap);
      }),
    );
  }

  if (legal.has("use_thief")) {
    citadelsActions.appendChild(
      renderCitadelsActionSection("Thief Targets", (section) => {
        const wrap = document.createElement("div");
        wrap.className = "citadels-button-wrap";
        (options.thief_targets || []).forEach((role) => {
          wrap.appendChild(
            citadelsSelectionButton(`${citadelsRoleEmoji(role.rank)} ${role.rank}. ${role.name_cn}`,
              { type: "use_thief", target_rank: role.rank }, `Steal this role owner's gold when revealed. ${CITADELS_ROLE_DETAILS[role.rank]}`),
          );
        });
        section.appendChild(wrap);
      }),
    );
  }

  citadelsActions.classList.toggle("hidden", !citadelsActions.children.length);
}

function buildCitadelsDistrictCard(card, compact = false) {
  const node = document.createElement("div");
  node.className = `citadels-card citadels-color-${card.color}`;
  if (compact) {
    node.classList.add("citadels-city-card");
    node.title = [card.name_en, card.text].filter(Boolean).join(" · ");
  }
  const title = document.createElement("div");
  title.className = "citadels-card-title";
  const name = document.createElement("span");
  name.className = "citadels-card-name";
  name.textContent = card.name_cn;
  title.append(citadelsBuildColorDot(card.color), name);
  const cost = document.createElement("div");
  cost.className = "citadels-card-meta";
  cost.textContent = compact ? `💰 ${card.cost}` : `💰 ${card.cost} · ${card.name_en}`;
  node.append(title, cost);
  citadelsDescribe(node, `district-${card.id}`, `${card.name_cn} (${card.name_en}). ${card.color} district. Cost: ${card.cost} gold. ${card.text || "Scores its printed cost."}`, true);
  if (card.text && !compact) {
    const text = document.createElement("div");
    text.className = "citadels-card-text";
    text.textContent = card.text;
    node.appendChild(text);
  }
  return node;
}

function renderCitadelsHand(view) {
  if (!citadelsHand) return;
  const scrollTop = citadelsHand.scrollTop;
  const focusedCard = document.activeElement?.closest("[data-citadels-card-id]")?.dataset.citadelsCardId;
  citadelsHand.innerHTML = "";
  pruneCitadelsRedrawSelection(view);
  const legal = new Set(view.legal_actions || []);
  (view.your_hand || []).forEach((card) => {
    const node = buildCitadelsDistrictCard(card);
    node.dataset.citadelsCardId = card.id;
    const actionRow = document.createElement("div");
    actionRow.className = "citadels-card-actions";
    if (legal.has("build")) {
      const selfPlayer = getCitadelsSelfPlayer(view);
      const duplicate = selfPlayer?.city.some((district) => district.name_cn === card.name_cn);
      const reason = duplicate ? "Already built: duplicate district names are not allowed." :
        selfPlayer?.gold < card.cost ? `Need ${card.cost - selfPlayer.gold} more gold.` : `Pay ${card.cost} gold to build ${card.name_cn}.`;
      const buildBtn = citadelsSelectionButton("Build", { type: "build", card_id: card.id }, reason);
      buildBtn.disabled = !canCitadelsBuildCard(view, card);
      actionRow.appendChild(buildBtn);
    }
    if (legal.has("magician_redraw")) {
      const redrawBtn = createCitadelsButton(
        citadelsRedrawSelection.has(card.id) ? "Selected" : "Select for Redraw",
        () => {
          if (citadelsRedrawSelection.has(card.id)) {
            citadelsRedrawSelection.delete(card.id);
          } else {
            citadelsRedrawSelection.add(card.id);
          }
          citadelsCancelConfirmation();
          renderCitadelsHand(currentCitadelsView);
          renderCitadelsActions(currentCitadelsView);
        },
        "", `Select ${card.name_cn} for Magician's redraw. It costs ${card.cost} gold to build. ${card.text || "Scores its printed cost."}`,
      );
      redrawBtn.classList.toggle("active", citadelsRedrawSelection.has(card.id));
      actionRow.appendChild(redrawBtn);
    }
    if (actionRow.children.length) {
      node.appendChild(actionRow);
    }
    citadelsHand.appendChild(node);
  });
  if (!citadelsHand.children.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "Your hand is empty.";
    citadelsHand.appendChild(empty);
  }
  citadelsHand.scrollTop = scrollTop;
  if (focusedCard) {
    [...citadelsHand.querySelectorAll("[data-citadels-card-id]")]
      .find((node) => node.dataset.citadelsCardId === focusedCard)?.querySelector("button.active")?.focus({ preventScroll: true });
  }
}

function renderCitadelsPlayers(view) {
  if (!citadelsPlayers) return;
  citadelsPlayers.innerHTML = "";
  const legal = new Set(view.legal_actions || []);
  const destroyTargets = new Map();
  (view.action_options?.destroy_targets || []).forEach((target) => {
    destroyTargets.set(`${target.player_id}:${target.district_id}`, target);
  });
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card citadels-player-card";
    if (player.player_id === view.current_turn_player) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }

    const header = document.createElement("div");
    header.className = "citadels-player-header";
    const identity = document.createElement("span");
    identity.className = "citadels-player-name";
    const crown = player.has_crown ? " 👑" : "";
    identity.textContent = `${player.name}${crown}`;

    const meta = document.createElement("div");
    meta.className = "citadels-player-meta";
    meta.textContent = `💰 ${player.gold} · 🃏 ${player.hand_count} · 🏠 ${player.city_count}/${view.winning_city_size}`;
    citadelsDescribe(meta, `player-${player.player_id}`, `Gold: ${player.gold}. Hand: ${player.hand_count} hidden cards. City: ${player.city_count} of ${view.winning_city_size} districts. ${player.has_crown ? "Crown: drafts first next round." : ""}`, true);
    if (view.game_over && Number.isFinite(player.score)) {
      meta.textContent += ` · score ${player.score}`;
    }

    const roles = document.createElement("div");
    roles.className = "citadels-player-roles";
    const revealed = (player.revealed_roles || []).map(citadelsRoleLabel).join(", ");
    if (player.player_id === view.you && Array.isArray(player.your_hidden_roles) && player.your_hidden_roles.length) {
      roles.textContent = `Roles: ${player.your_hidden_roles.map(citadelsRoleLabel).join(", ")}`;
    } else if (revealed || player.hidden_role_count) {
      const hiddenText = player.hidden_role_count ? ` + ${player.hidden_role_count} hidden` : "";
      roles.textContent = `Roles: ${revealed || "-"}${hiddenText}`;
    } else {
      roles.textContent = "Roles: -";
    }

    header.append(identity, roles);
    card.append(header, meta);

    if (legal.has("magician_swap") && player.player_id !== view.you) {
      const swapRow = document.createElement("div");
      swapRow.className = "citadels-inline-actions";
      swapRow.appendChild(
        citadelsSelectionButton("Swap Hand", { type: "magician_swap", target_player_id: player.player_id },
          `Exchange your entire hand with ${player.name}'s ${player.hand_count} hidden cards.`),
      );
      card.appendChild(swapRow);
    }

    const city = document.createElement("div");
    city.className = "citadels-city-grid";
    (player.city || []).forEach((district) => {
      const districtNode = buildCitadelsDistrictCard(district, true);
      const destroyTarget = destroyTargets.get(`${player.player_id}:${district.id}`);
      if (legal.has("destroy_district") && destroyTarget) {
        const actionRow = document.createElement("div");
        actionRow.className = "citadels-card-actions";
        actionRow.appendChild(
          citadelsSelectionButton(`Destroy · 💰 ${destroyTarget.destroy_cost}`, {
              type: "destroy_district",
              target_player_id: player.player_id,
              district_id: district.id,
            }, `Pay ${destroyTarget.destroy_cost} gold to destroy ${player.name}'s ${district.name_cn}. ${district.text || "Scores its printed cost."}`),
        );
        districtNode.appendChild(actionRow);
      }
      city.appendChild(districtNode);
    });
    if (!city.children.length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No districts built.";
      city.appendChild(empty);
    }
    card.appendChild(city);
    citadelsPlayers.appendChild(card);
  });
}

function renderCitadelsLog(view) {
  if (!citadelsLog) return;
  citadelsLog.innerHTML = "";
  const logEntries = Array.isArray(view.recent_log) ? view.recent_log : [];
  if (!logEntries.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No public log yet.";
    citadelsLog.appendChild(empty);
    return;
  }
  logEntries
    .slice()
    .reverse()
    .forEach((entry) => {
      const row = document.createElement("div");
      row.className = "citadels-log-entry";
      row.textContent = entry;
      citadelsLog.appendChild(row);
    });
}

function renderCitadelsGameState(data) {
  if (!data || data.game_type !== "citadels") return;
  const view = data.view || {};
  citadelsCancelConfirmation();
  citadelsHideTooltip();
  currentCitadelsView = view;
  pruneCitadelsRedrawSelection(view);
  if (currentGameType !== "citadels") {
    currentGameType = "citadels";
    setGamePanelVisibility("citadels");
  }

  if (citadelsPhaseLabel) citadelsPhaseLabel.textContent = citadelsPhaseText(view.phase);
  if (citadelsRoundLabel) citadelsRoundLabel.textContent = view.round ?? "-";
  if (citadelsModeLabel) citadelsModeLabel.textContent = view.character_mode === "queen9" ? "8+Queen" : "Classic 8";
  if (citadelsCrownHolderLabel) citadelsCrownHolderLabel.textContent = view.crown_holder_name || "-";
  if (citadelsCurrentPlayerLabel) {
    const currentPlayerId = view.phase === "draft" ? view.current_drafter : view.current_turn_player;
    citadelsCurrentPlayerLabel.textContent = currentPlayerId ? findPlayerName(view, currentPlayerId) : "-";
  }
  if (citadelsCurrentRoleLabel) {
    citadelsCurrentRoleLabel.textContent = view.current_turn_role ? citadelsRoleLabel(view.current_turn_role) : "-";
  }
  if (citadelsWinningCitySizeLabel) {
    citadelsWinningCitySizeLabel.textContent = view.winning_city_size ?? "-";
  }

  if (citadelsBuildProgress) {
    const role = view.current_turn_role;
    citadelsBuildProgress.textContent = view.current_turn_player === view.you && role ?
      `Builds ${role.builds_used}/${role.build_limit}` : `${view.your_hand?.length || 0} cards`;
  }
  renderCitadelsRoleTrack(view);
  renderCitadelsBanner(view);
  renderCitadelsRoundSummary(view);
  renderCitadelsYourRoles(view);
  renderCitadelsActions(view);
  renderCitadelsHand(view);
  renderCitadelsPlayers(view);
  renderCitadelsLog(view);
  citadelsExplainWidget?.refresh();
}

if (citadelsHelpBtn) {
  citadelsHelpBtn.addEventListener("click", showCitadelsHelpModal);
}

if (citadelsExplainBtn) {
  citadelsExplainBtn.addEventListener("click", showCitadelsExplainModal);
}

function citadelsSubmitNextRound() {
  if (!currentCitadelsView || !(currentCitadelsView.legal_actions || []).includes("next_round")) return;
  sendAction({ type: "next_round" });
}

citadelsNextRoundBtn?.addEventListener("click", citadelsSubmitNextRound);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  citadelsCancelConfirmation();
  citadelsHideTooltip();
});

function citadelsHideTooltip() {
  clearTimeout(citadelsTooltipTimer);
  citadelsTooltip?.classList.add("hidden");
}

function citadelsShowTooltip(target) {
  if (!citadelsTooltip || citadelsExplainWidget?.isActive() || target.closest("button, summary")) return;
  citadelsHideTooltip();
  citadelsTooltip.textContent = target.dataset.citadelsTip;
  citadelsTooltip.classList.remove("hidden");
  const anchor = target.getBoundingClientRect();
  const box = citadelsTooltip.getBoundingClientRect();
  citadelsTooltip.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth - box.width - 8))}px`;
  citadelsTooltip.style.top = `${anchor.bottom + box.height + 8 < innerHeight ? anchor.bottom + 5 : Math.max(8, anchor.top - box.height - 5)}px`;
  citadelsTooltipTimer = setTimeout(citadelsHideTooltip, 3000);
}

citadelsPanelEl?.addEventListener("pointerover", (event) => {
  const target = event.target.closest("[data-citadels-tip]");
  if (target && event.pointerType === "mouse" && !event.target.closest("button")) citadelsShowTooltip(target);
});
citadelsPanelEl?.addEventListener("pointerout", citadelsHideTooltip);
citadelsPanelEl?.addEventListener("focusin", (event) => {
  if (event.target.matches("[data-citadels-tip]")) citadelsShowTooltip(event.target);
});
citadelsPanelEl?.addEventListener("focusout", citadelsHideTooltip);
let citadelsGesture = null;
let citadelsSuppressClickUntil = 0;
citadelsPanelEl?.addEventListener("pointerdown", (event) => {
  citadelsSuppressClickUntil = 0;
  citadelsGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
}, true);
window.addEventListener("pointermove", (event) => {
  if (citadelsGesture?.id === event.pointerId
      && Math.hypot(event.clientX - citadelsGesture.x, event.clientY - citadelsGesture.y) > 10) {
    citadelsGesture.moved = true;
  }
}, true);
window.addEventListener("pointerup", (event) => {
  if (citadelsGesture?.id !== event.pointerId) return;
  if (citadelsGesture.moved) citadelsSuppressClickUntil = Date.now() + 500;
  citadelsGesture = null;
}, true);
window.addEventListener("pointercancel", () => {
  if (citadelsGesture) citadelsSuppressClickUntil = Date.now() + 500;
  citadelsGesture = null;
}, true);
citadelsPanelEl?.addEventListener("click", (event) => {
  if (Date.now() >= citadelsSuppressClickUntil) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
citadelsPanelEl?.addEventListener("click", (event) => {
  if (event.target.closest("button")) { citadelsHideTooltip(); return; }
  const target = event.target.closest("[data-citadels-tip]");
  if (target) citadelsShowTooltip(target);
  if (!event.target.closest(".citadels-confirmation")) citadelsCancelConfirmation();
  if (citadelsRedrawSelection.size && !event.target.closest(".citadels-card, .citadels-action-section, .citadels-player-card")) {
    citadelsRedrawSelection.clear();
    renderCitadelsHand(currentCitadelsView);
    renderCitadelsActions(currentCitadelsView);
  }
});
window.addEventListener("scroll", citadelsHideTooltip, true);
window.addEventListener("resize", citadelsHideTooltip);

if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "citadels"
    && typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "citadels"
    && lastGameStatePayload.room_id === currentRoomState.room_id) renderCitadelsGameState(lastGameStatePayload);

window.renderCitadelsGameState = renderCitadelsGameState;
window.clearCitadelsState = clearCitadelsState;
window.showCitadelsHeaderActions = showCitadelsHeaderActions;
