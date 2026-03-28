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

function citadelsColorEmoji(color) {
  if (color === "yellow") return "🟨";
  if (color === "blue") return "🟦";
  if (color === "green") return "🟩";
  if (color === "red") return "🟥";
  if (color === "purple") return "🟪";
  return "⬜";
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
    ["Take 2 Gold", "Gain 🪙 2 and move directly to the main action window."],
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
  const role = view.current_turn_role;
  const currentPlayer = view.current_turn_player ? findPlayerName(view, view.current_turn_player) : "-";
  if (role) {
    citadelsBannerBody.textContent = `${currentPlayer} is playing ${citadelsRoleLabel(role)} · ${citadelsStepLabel(role.step)}.`;
    return;
  }
  citadelsBannerBody.textContent = "Waiting for the next role.";
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

function buildCitadelsDistrictCard(card) {
  const node = document.createElement("div");
  node.className = `citadels-card citadels-color-${card.color}`;
  const title = document.createElement("div");
  title.className = "citadels-card-title";
  title.textContent = `${citadelsColorEmoji(card.color)} ${card.name_cn}`;
  const cost = document.createElement("div");
  cost.className = "citadels-card-meta";
  cost.textContent = `🪙 ${card.cost} · ${card.name_en}`;
  node.append(title, cost);
  if (card.text) {
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
    const crown = player.has_crown ? " 👑" : "";
    header.textContent = `${player.name}${crown}`;

    const meta = document.createElement("div");
    meta.className = "citadels-player-meta";
    meta.textContent = `🪙 ${player.gold} · hand ${player.hand_count} · city ${player.city_count}`;
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

    card.append(header, meta, roles);

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
      const districtNode = buildCitadelsDistrictCard(district);
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

  if (citadelsPhaseLabel) citadelsPhaseLabel.textContent = view.phase || "-";
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
