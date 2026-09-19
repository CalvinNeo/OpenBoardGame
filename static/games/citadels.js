let currentCitadelsView = null;
let citadelsRedrawSelection = new Set();

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
const citadelsSummaryPassBtn = document.getElementById("citadelsSummaryPassBtn");
const citadelsNextRoundBtn = document.getElementById("citadelsNextRoundBtn");
const citadelsHelpBtn = document.getElementById("citadelsHelpBtn");
const citadelsExplainBtn = document.getElementById("citadelsExplainBtn");
const citadelsHelpModal = document.getElementById("citadelsHelpModal");
const citadelsHelpModalCloseBtn = document.getElementById("citadelsHelpModalCloseBtn");
const citadelsExplainModal = document.getElementById("citadelsExplainModal");
const citadelsExplainModalCloseBtn = document.getElementById("citadelsExplainModalCloseBtn");
const citadelsHelpContent = document.getElementById("citadelsHelpContent");
const citadelsExplainContent = document.getElementById("citadelsExplainContent");

const CITADELS_HELP_TEXT = `
  <div class="citadels-help-block">
    <p><strong>Goal</strong>: build a city worth the most points. The game ends after the round in which someone reaches the winning city size.</p>
    <p><strong>Flow</strong>: draft a role, reveal roles in rank order, choose income, then use role powers, collect tax, and build.</p>
    <p><strong>Player Counts</strong>: 2-4 players use 8 roles. 5-6 players use 9 roles and include <strong>皇后</strong>.</p>
    <p><strong>Current Implementation</strong>: the core roles, scoring, queen timing, short-game configuration, and text-only district deck are implemented. Most purple districts are plain text cards; only a few simple bonuses such as <strong>大学</strong>, <strong>龙门客栈</strong>, <strong>学堂</strong>, and <strong>城塞</strong> have engine effects.</p>
  </div>
`;

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
  if (!citadelsHelpModal) return;
  if (citadelsHelpContent) {
    citadelsHelpContent.innerHTML = CITADELS_HELP_TEXT;
  }
  setModalVisible(citadelsHelpModal, true);
}

function closeCitadelsHelpModal() {
  if (citadelsHelpModal) {
    setModalVisible(citadelsHelpModal, false);
  }
}

function buildCitadelsExplainHtml(view) {
  const lines = [
    ["Take 2 Gold", "Gain 💰 2 and move directly to the main action window."],
    ["Draw 2 Keep 1", "Draw 2 district cards, keep 1, and put the other on the bottom of the deck."],
    ["Collect Tax", "Take gold for districts that match your role color. Each role can tax only once per turn."],
    ["Build", "Pay the card cost and move that district into your city. Architect can build up to 3."],
    ["Swap Hand", "Magician swaps the entire hand with another player."],
    ["Redraw Selected", "Magician returns the selected hand cards to the bottom of the deck and draws the same number."],
    ["Destroy", "Warlord pays cost - 1 to destroy a legal district."],
    ["End Turn", "Finish the current role and move to the next rank."],
  ];
  const activeRole = view?.current_turn_role ? citadelsRoleLabel(view.current_turn_role) : "-";
  return `
    <div class="citadels-help-block">
      <p><strong>Current Role</strong>: ${activeRole}</p>
      <div class="citadels-explain-list">
        ${lines
          .map(
            ([title, description]) => `
              <div class="citadels-explain-item">
                <div class="citadels-explain-title">${title}</div>
                <div class="citadels-explain-body">${description}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function showCitadelsExplainModal() {
  if (!citadelsExplainModal || !citadelsExplainContent) return;
  citadelsExplainContent.innerHTML = buildCitadelsExplainHtml(currentCitadelsView);
  setModalVisible(citadelsExplainModal, true);
}

function closeCitadelsExplainModal() {
  if (citadelsExplainModal) {
    setModalVisible(citadelsExplainModal, false);
  }
}

function createCitadelsButton(label, onClick, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (extraClass) {
    button.className = extraClass;
  }
  button.addEventListener("click", onClick);
  return button;
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
  if (citadelsSummaryPassBtn) {
    citadelsSummaryPassBtn.classList.toggle("hidden", isFinal);
    citadelsSummaryPassBtn.disabled = !canContinue;
    citadelsSummaryPassBtn.textContent = canContinue ? "Pass" : alreadyReady ? "Passed ✓" : "Waiting…";
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
    pill.textContent = `${role.rank}. ${role.name_cn}${role.revealed ? " · revealed" : " · hidden"}`;
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
            createCitadelsButton(`${role.rank}. ${role.name_cn}`, () => {
              sendAction({ type: "draft_character", rank: role.rank });
            }),
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
          const keepButton = createCitadelsButton("Keep This", () => sendAction({ type: "choose_draw", card_id: card.id }));
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
      renderCitadelsActionSection("Main Actions", (section) => {
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
          });
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
            createCitadelsButton(`${role.rank}. ${role.name_cn}`, () => {
              sendAction({ type: "use_assassin", target_rank: role.rank });
            }),
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
            createCitadelsButton(`${role.rank}. ${role.name_cn}`, () => {
              sendAction({ type: "use_thief", target_rank: role.rank });
            }),
          );
        });
        section.appendChild(wrap);
      }),
    );
  }

  if (legal.has("magician_swap")) {
    citadelsActions.appendChild(
      renderCitadelsActionSection("Magician Swap", (section) => {
        const wrap = document.createElement("div");
        wrap.className = "citadels-button-wrap";
        (options.magician_swap_targets || []).forEach((player) => {
          wrap.appendChild(
            createCitadelsButton(`Swap with ${player.name}`, () => {
              sendAction({ type: "magician_swap", target_player_id: player.player_id });
            }),
          );
        });
        section.appendChild(wrap);
      }),
    );
  }

  if (!citadelsActions.children.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No direct action available right now.";
    citadelsActions.appendChild(empty);
  }
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
  citadelsHand.innerHTML = "";
  pruneCitadelsRedrawSelection(view);
  const legal = new Set(view.legal_actions || []);
  (view.your_hand || []).forEach((card) => {
    const node = buildCitadelsDistrictCard(card);
    const actionRow = document.createElement("div");
    actionRow.className = "citadels-card-actions";
    if (legal.has("build")) {
      const buildBtn = createCitadelsButton("Build", () => {
        sendAction({ type: "build", card_id: card.id });
      });
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
          renderCitadelsHand(currentCitadelsView);
          renderCitadelsActions(currentCitadelsView);
        },
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
    meta.textContent = `💰 ${player.gold} · hand ${player.hand_count} · city ${player.city_count}`;
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
        createCitadelsButton(`Swap Hand`, () => {
          sendAction({ type: "magician_swap", target_player_id: player.player_id });
        }),
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
          createCitadelsButton(`Destroy (${destroyTarget.destroy_cost})`, () => {
            sendAction({
              type: "destroy_district",
              target_player_id: player.player_id,
              district_id: district.id,
            });
          }),
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

  renderCitadelsBanner(view);
  renderCitadelsRoundSummary(view);
  renderCitadelsYourRoles(view);
  renderCitadelsActions(view);
  renderCitadelsHand(view);
  renderCitadelsPlayers(view);
  renderCitadelsLog(view);
}

if (citadelsHelpBtn) {
  citadelsHelpBtn.addEventListener("click", showCitadelsHelpModal);
}

if (citadelsExplainBtn) {
  citadelsExplainBtn.addEventListener("click", showCitadelsExplainModal);
}

if (citadelsHelpModalCloseBtn) {
  citadelsHelpModalCloseBtn.addEventListener("click", closeCitadelsHelpModal);
}

if (citadelsExplainModalCloseBtn) {
  citadelsExplainModalCloseBtn.addEventListener("click", closeCitadelsExplainModal);
}

function citadelsSubmitNextRound() {
  if (!currentCitadelsView || !(currentCitadelsView.legal_actions || []).includes("next_round")) return;
  sendAction({ type: "next_round" });
}

[citadelsSummaryPassBtn, citadelsNextRoundBtn].forEach((button) => {
  if (button) button.addEventListener("click", citadelsSubmitNextRound);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (citadelsHelpModal && !citadelsHelpModal.classList.contains("hidden")) {
    closeCitadelsHelpModal();
  }
  if (citadelsExplainModal && !citadelsExplainModal.classList.contains("hidden")) {
    closeCitadelsExplainModal();
  }
});

window.renderCitadelsGameState = renderCitadelsGameState;
window.clearCitadelsState = clearCitadelsState;
window.showCitadelsHeaderActions = showCitadelsHeaderActions;
