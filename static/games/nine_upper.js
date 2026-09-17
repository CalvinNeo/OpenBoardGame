let currentNineUpperView = null;
let nineUpperSelectedPlayerId = null;
let nineUpperRoundKey = "";
let nineUpperExplainMode = false;

const nineUpperHeaderActions = document.getElementById("nineUpperHeaderActions");
const nineUpperHelpBtn = document.getElementById("nineUpperHelpBtn");
const nineUpperExplainBtn = document.getElementById("nineUpperExplainBtn");
const nineUpperHelpModal = document.getElementById("nineUpperHelpModal");
const nineUpperHelpCloseBtn = document.getElementById("nineUpperHelpCloseBtn");
const nineUpperHelpContent = document.getElementById("nineUpperHelpContent");
const nineUpperExplainModal = document.getElementById("nineUpperExplainModal");
const nineUpperExplainCloseBtn = document.getElementById("nineUpperExplainCloseBtn");
const nineUpperExplainContent = document.getElementById("nineUpperExplainContent");

const nineUpperRound = document.getElementById("nineUpperRound");
const nineUpperTotalRounds = document.getElementById("nineUpperTotalRounds");
const nineUpperPhase = document.getElementById("nineUpperPhase");
const nineUpperThinker = document.getElementById("nineUpperThinker");
const nineUpperStake = document.getElementById("nineUpperStake");
const nineUpperProgress = document.getElementById("nineUpperProgress");
const nineUpperStatus = document.getElementById("nineUpperStatus");
const nineUpperStatusIcon = document.getElementById("nineUpperStatusIcon");
const nineUpperStatusBody = document.getElementById("nineUpperStatusBody");
const nineUpperRoleCard = document.getElementById("nineUpperRoleCard");
const nineUpperRoleIcon = document.getElementById("nineUpperRoleIcon");
const nineUpperRoleName = document.getElementById("nineUpperRoleName");
const nineUpperRoleCopy = document.getElementById("nineUpperRoleCopy");
const nineUpperDifficultyStage = document.getElementById("nineUpperDifficultyStage");
const nineUpperDifficultyButtons = document.getElementById("nineUpperDifficultyButtons");
const nineUpperTermStage = document.getElementById("nineUpperTermStage");
const nineUpperDifficultyPill = document.getElementById("nineUpperDifficultyPill");
const nineUpperCategoryHint = document.getElementById("nineUpperCategoryHint");
const nineUpperTerm = document.getElementById("nineUpperTerm");
const nineUpperPronunciation = document.getElementById("nineUpperPronunciation");
const nineUpperTruthBox = document.getElementById("nineUpperTruthBox");
const nineUpperTruth = document.getElementById("nineUpperTruth");
const nineUpperStatementStage = document.getElementById("nineUpperStatementStage");
const nineUpperStatementCounter = document.getElementById("nineUpperStatementCounter");
const nineUpperStatementPrompt = document.getElementById("nineUpperStatementPrompt");
const nineUpperStatementComposer = document.getElementById("nineUpperStatementComposer");
const nineUpperStatementInput = document.getElementById("nineUpperStatementInput");
const nineUpperCharacterCount = document.getElementById("nineUpperCharacterCount");
const nineUpperSubmitStatementBtn = document.getElementById("nineUpperSubmitStatementBtn");
const nineUpperLockedStatement = document.getElementById("nineUpperLockedStatement");
const nineUpperGuessStage = document.getElementById("nineUpperGuessStage");
const nineUpperStatements = document.getElementById("nineUpperStatements");
const nineUpperSelectedChoice = document.getElementById("nineUpperSelectedChoice");
const nineUpperChooseBtn = document.getElementById("nineUpperChooseBtn");
const nineUpperResultStage = document.getElementById("nineUpperResultStage");
const nineUpperResultBanner = document.getElementById("nineUpperResultBanner");
const nineUpperResultDefinition = document.getElementById("nineUpperResultDefinition");
const nineUpperResultStatements = document.getElementById("nineUpperResultStatements");
const nineUpperNextRoundRow = document.getElementById("nineUpperNextRoundRow");
const nineUpperReadyStatus = document.getElementById("nineUpperReadyStatus");
const nineUpperNextRoundBtn = document.getElementById("nineUpperNextRoundBtn");
const nineUpperGameOverRow = document.getElementById("nineUpperGameOverRow");
const nineUpperWinnerText = document.getElementById("nineUpperWinnerText");
const nineUpperPlayAgainBtn = document.getElementById("nineUpperPlayAgainBtn");
const nineUpperPlayers = document.getElementById("nineUpperPlayers");

const NINE_UPPER_HELP_HTML = [
  "<p><strong>目标：</strong>听完所有说法后找出唯一知道真相的“老实人”，或作为“瞎掰人”让想想选中你。</p>",
  "<h3>每轮流程</h3>",
  "<ol>",
  "<li>本轮的<strong>想想</strong>选择难度：1、2、3 分。难度越高，类别提示越少。</li>",
  "<li>系统展示一个陌生词。唯一的<strong>老实人</strong>还能看到真实释义；其他人都是<strong>瞎掰人</strong>，需要编出可信解释。</li>",
  "<li>除想想外，每人秘密提交一段说法。全部提交后，说法会连同作者一起公开，大家可以自由讨论和追问。</li>",
  "<li>想想选择一名玩家作为老实人，然后公开角色与真实释义。</li>",
  "</ol>",
  "<h3>计分</h3>",
  "<p>想想猜对：想想与老实人各获得该题分值。想想猜错：被选中的瞎掰人独得该题分值。</p>",
  "<p>每位玩家都担任一次想想后结束。总分最高者获胜；并列则共享胜利。</p>",
  "<h3>难度提示</h3>",
  "<p>🟢 1 分会公开正确类别；🟠 2 分给出三个可能类别；🔴 3 分不提供类别。</p>",
].join("");

const NINE_UPPER_BUTTON_EXPLANATIONS = {
  nineUpperDifficulty1Btn: "Choose a 1-point term. Everyone sees its exact category.",
  nineUpperDifficulty2Btn: "Choose a 2-point term. Everyone sees three possible categories.",
  nineUpperDifficulty3Btn: "Choose a 3-point term. No category hint is shown.",
  nineUpperSubmitStatementBtn: "Lock your explanation. It stays hidden until every speaker has submitted.",
  nineUpperChooseBtn: "Confirm the selected speaker as the Truth-teller and reveal the round.",
  nineUpperNextRoundBtn: "Mark yourself ready. The next round starts only after every player confirms.",
  nineUpperPlayAgainBtn: "Reset scores and roles, then begin a fresh game with the same players.",
};

function nineUpperSetVisible(element, visible) {
  if (!element) return;
  element.classList.toggle("hidden", !visible);
  element.setAttribute("aria-hidden", (!visible).toString());
}

function nineUpperSetModalVisible(modal, visible) {
  nineUpperSetVisible(modal, visible);
}

function nineUpperCan(actionType) {
  return !!(
    currentNineUpperView
    && Array.isArray(currentNineUpperView.legal_actions)
    && currentNineUpperView.legal_actions.includes(actionType)
  );
}

function nineUpperPlayer(view, playerId) {
  return (view && Array.isArray(view.players) ? view.players : []).find(
    (player) => player && player.player_id === playerId,
  ) || null;
}

function nineUpperPlayerName(view, playerId) {
  const player = nineUpperPlayer(view, playerId);
  return player ? player.name || player.player_id : playerId || "-";
}

function nineUpperPhaseLabel(phase) {
  const labels = {
    difficulty_selection: "Choose Difficulty",
    statements: "Secret Statements",
    guessing: "Open Discussion",
    round_result: "Round Reveal",
    game_over: "Game Over",
  };
  return labels[phase] || phase || "-";
}

function nineUpperRoleDetails(role) {
  const roles = {
    thinker: {
      icon: "🧐",
      name: "想想 · Thinker",
      copy: "Choose the stakes, question every story, then identify the one Truth-teller.",
    },
    honest: {
      icon: "📜",
      name: "老实人 · Truth-teller",
      copy: "You know the real explanation. Sound credible, but do not make your role too obvious.",
    },
    bluffer: {
      icon: "🎭",
      name: "瞎掰人 · Bluffer",
      copy: "You do not know the answer. Invent a confident explanation and fool the Thinker.",
    },
  };
  return roles[role] || { icon: "🎭", name: "-", copy: "Your role will appear here." };
}

function nineUpperRenderHeader(view) {
  if (nineUpperRound) nineUpperRound.textContent = String(view.round || "-");
  if (nineUpperTotalRounds) nineUpperTotalRounds.textContent = String(view.total_rounds || "-");
  if (nineUpperPhase) nineUpperPhase.textContent = nineUpperPhaseLabel(view.phase);
  if (nineUpperThinker) nineUpperThinker.textContent = nineUpperPlayerName(view, view.thinker_id);
  if (nineUpperStake) {
    nineUpperStake.textContent = view.difficulty
      ? `${view.difficulty_label || "Level"} · ${view.difficulty} pt${view.difficulty === 1 ? "" : "s"}`
      : "Not chosen";
  }
  if (nineUpperProgress) {
    if (view.phase === "statements") {
      nineUpperProgress.textContent = `${view.statement_progress.done}/${view.statement_progress.total} statements`;
    } else if (view.phase === "round_result") {
      nineUpperProgress.textContent = `${view.next_round_progress.done}/${view.next_round_progress.total} ready`;
    } else if (view.phase === "game_over") {
      nineUpperProgress.textContent = `${view.total_rounds} rounds complete`;
    } else if (view.phase === "guessing") {
      nineUpperProgress.textContent = "Stories revealed";
    } else {
      nineUpperProgress.textContent = "Waiting on Thinker";
    }
  }
}

function nineUpperRenderStatus(view) {
  if (!nineUpperStatusBody || !nineUpperStatusIcon || !nineUpperStatus) return;
  nineUpperStatus.classList.remove("waiting", "action", "reveal", "complete");
  let icon = "🎭";
  let copy = "Waiting for game state…";
  if (view.phase === "difficulty_selection") {
    if (nineUpperCan("select_difficulty")) {
      icon = "🎚️";
      copy = "You are the Thinker. Choose this round's difficulty and point value.";
      nineUpperStatus.classList.add("action");
    } else {
      icon = "⏳";
      copy = `${nineUpperPlayerName(view, view.thinker_id)} is choosing the stakes.`;
      nineUpperStatus.classList.add("waiting");
    }
  } else if (view.phase === "statements") {
    if (nineUpperCan("submit_statement")) {
      icon = view.your_role === "honest" ? "📜" : "🎭";
      copy = view.your_role === "honest"
        ? "Explain the real meaning in your own voice, then lock your statement."
        : "Invent a believable meaning, then lock your statement.";
      nineUpperStatus.classList.add("action");
    } else if (view.your_role === "thinker") {
      icon = "🙈";
      copy = "Do not peek at anyone's screen. Wait while the speakers prepare their stories.";
      nineUpperStatus.classList.add("waiting");
    } else {
      icon = "🔒";
      copy = "Your statement is locked. It will appear when every speaker is ready.";
      nineUpperStatus.classList.add("waiting");
    }
  } else if (view.phase === "guessing") {
    if (nineUpperCan("choose_honest")) {
      icon = "🧐";
      copy = "Question the speakers, select the one you trust, then lock your choice.";
      nineUpperStatus.classList.add("action");
    } else {
      icon = "💬";
      copy = "Defend your explanation and answer the Thinker's questions without revealing your role.";
      nineUpperStatus.classList.add("waiting");
    }
  } else if (view.phase === "round_result") {
    const me = nineUpperPlayer(view, view.you);
    if (me && me.next_round_ready) {
      icon = "✅";
      copy = "You are ready. The next round starts after everyone confirms.";
      nineUpperStatus.classList.add("complete");
    } else {
      icon = "💡";
      copy = "Review the truth, roles, and points, then confirm Next Round.";
      nineUpperStatus.classList.add("reveal");
    }
  } else if (view.phase === "game_over") {
    icon = "🏆";
    copy = "The final stories have been exposed. Highest score wins.";
    nineUpperStatus.classList.add("complete");
  }
  nineUpperStatusIcon.textContent = icon;
  nineUpperStatusBody.textContent = copy;
}

function nineUpperRenderRole(view) {
  const details = nineUpperRoleDetails(view.your_role);
  if (nineUpperRoleIcon) nineUpperRoleIcon.textContent = details.icon;
  if (nineUpperRoleName) nineUpperRoleName.textContent = details.name;
  if (nineUpperRoleCopy) nineUpperRoleCopy.textContent = details.copy;
  if (nineUpperRoleCard) {
    nineUpperRoleCard.classList.remove("thinker", "honest", "bluffer");
    if (view.your_role) nineUpperRoleCard.classList.add(view.your_role);
  }
}

function nineUpperRenderDifficulty(view) {
  const visible = view.phase === "difficulty_selection";
  nineUpperSetVisible(nineUpperDifficultyStage, visible);
  if (!visible || !nineUpperDifficultyButtons) return;
  nineUpperDifficultyButtons.innerHTML = "";
  const icons = { 1: "🟢", 2: "🟠", 3: "🔴" };
  const hints = {
    1: "Exact category shown",
    2: "Three possible categories",
    3: "No category hint",
  };
  (view.difficulty_options || []).forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = `nineUpperDifficulty${option.value}Btn`;
    button.className = `nine-upper-difficulty-btn level-${option.value} has-explanation`;
    button.disabled = !nineUpperCan("select_difficulty");
    const title = document.createElement("strong");
    title.textContent = `${icons[option.value] || "🎲"} ${option.label}`;
    const points = document.createElement("span");
    points.textContent = `${option.points} point${option.points === 1 ? "" : "s"}`;
    const hint = document.createElement("small");
    hint.textContent = hints[option.value] || "";
    button.append(title, points, hint);
    button.addEventListener("click", () => {
      if (!nineUpperCan("select_difficulty") || nineUpperExplainMode) return;
      sendAction({ type: "select_difficulty", difficulty: option.value });
    });
    nineUpperDifficultyButtons.appendChild(button);
  });
}

function nineUpperRenderTerm(view) {
  const visible = !!view.term && view.phase !== "difficulty_selection";
  nineUpperSetVisible(nineUpperTermStage, visible);
  if (!visible) return;
  if (nineUpperDifficultyPill) {
    nineUpperDifficultyPill.textContent = `${view.difficulty_label || "Level"} · ${view.difficulty} pt${view.difficulty === 1 ? "" : "s"}`;
  }
  if (nineUpperTerm) nineUpperTerm.textContent = view.term || "-";
  if (nineUpperPronunciation) nineUpperPronunciation.textContent = view.pronunciation || "";
  if (nineUpperCategoryHint) {
    const categories = Array.isArray(view.category_options) ? view.category_options : [];
    if (view.difficulty === 1 && categories.length) {
      nineUpperCategoryHint.textContent = `🗂️ Category · ${categories[0]}`;
    } else if (view.difficulty === 2 && categories.length) {
      nineUpperCategoryHint.textContent = `🗂️ Maybe · ${categories.join(" / ")}`;
    } else {
      nineUpperCategoryHint.textContent = "🕳️ No category hint";
    }
  }
  const showTruth = !!view.your_definition && ["statements", "guessing"].includes(view.phase);
  nineUpperSetVisible(nineUpperTruthBox, showTruth);
  if (nineUpperTruth) nineUpperTruth.textContent = showTruth ? view.your_definition : "-";
}

function nineUpperUpdateCharacterCount() {
  if (!nineUpperCharacterCount || !nineUpperStatementInput) return;
  const length = [...nineUpperStatementInput.value].length;
  nineUpperCharacterCount.textContent = `${length}/280`;
  if (nineUpperSubmitStatementBtn) {
    nineUpperSubmitStatementBtn.disabled = !nineUpperCan("submit_statement") || length === 0 || length > 280;
  }
}

function nineUpperRenderStatementStage(view) {
  const visible = view.phase === "statements";
  nineUpperSetVisible(nineUpperStatementStage, visible);
  if (!visible) return;
  if (nineUpperStatementCounter) {
    nineUpperStatementCounter.textContent = `${view.statement_progress.done}/${view.statement_progress.total} ready`;
  }
  const canSubmit = nineUpperCan("submit_statement");
  const isThinker = view.your_role === "thinker";
  const isLocked = !isThinker && !!view.your_statement;
  nineUpperSetVisible(nineUpperStatementComposer, canSubmit);
  nineUpperSetVisible(nineUpperLockedStatement, isLocked || isThinker);
  if (nineUpperStatementPrompt) {
    nineUpperStatementPrompt.textContent = isThinker
      ? "The speakers are preparing in secret. Their statements will appear together."
      : "Explain the term convincingly without naming or revealing your role.";
  }
  if (nineUpperLockedStatement) {
    if (isThinker) {
      nineUpperLockedStatement.textContent = "🙈 Wait here — no statements are visible until everyone submits.";
    } else if (isLocked) {
      nineUpperLockedStatement.textContent = `🔒 Your statement: ${view.your_statement}`;
    }
  }
  if (nineUpperSubmitStatementBtn) {
    nineUpperSubmitStatementBtn.textContent = canSubmit ? "Lock Statement" : "Statement Locked ✓";
  }
  nineUpperUpdateCharacterCount();
}

function nineUpperCreateStatementCard(view, statement, options) {
  const settings = options || {};
  const card = document.createElement(settings.interactive ? "button" : "div");
  if (settings.interactive) card.type = "button";
  card.className = "nine-upper-statement-card";
  if (settings.selected) card.classList.add("selected");
  if (settings.honest) card.classList.add("honest");
  if (settings.fooled) card.classList.add("fooled");
  if (settings.interactive && settings.disabled) card.disabled = true;

  const heading = document.createElement("div");
  heading.className = "nine-upper-statement-head";
  const name = document.createElement("strong");
  name.textContent = statement.name || nineUpperPlayerName(view, statement.player_id);
  heading.appendChild(name);
  if (settings.badge) {
    const badge = document.createElement("span");
    badge.textContent = settings.badge;
    heading.appendChild(badge);
  }
  const copy = document.createElement("p");
  copy.textContent = statement.text || "-";
  card.append(heading, copy);
  if (settings.footer) {
    const footer = document.createElement("small");
    footer.textContent = settings.footer;
    card.appendChild(footer);
  }
  return card;
}

function nineUpperRenderGuessStage(view) {
  const visible = view.phase === "guessing";
  nineUpperSetVisible(nineUpperGuessStage, visible);
  if (!visible || !nineUpperStatements) return;
  const validIds = new Set((view.statements || []).map((entry) => entry.player_id));
  if (nineUpperSelectedPlayerId && !validIds.has(nineUpperSelectedPlayerId)) {
    nineUpperSelectedPlayerId = null;
  }
  const canChoose = nineUpperCan("choose_honest");
  nineUpperStatements.innerHTML = "";
  (view.statements || []).forEach((statement) => {
    const card = nineUpperCreateStatementCard(view, statement, {
      interactive: true,
      disabled: !canChoose,
      selected: statement.player_id === nineUpperSelectedPlayerId,
      badge: statement.player_id === nineUpperSelectedPlayerId ? "Selected" : "",
    });
    card.classList.add("nine-upper-statement-option");
    card.dataset.playerId = statement.player_id;
    card.addEventListener("click", () => {
      if (!canChoose || nineUpperExplainMode) return;
      nineUpperSelectedPlayerId = statement.player_id;
      nineUpperRenderGuessStage(currentNineUpperView);
      nineUpperUpdateButtons();
    });
    nineUpperStatements.appendChild(card);
  });
  if (nineUpperSelectedChoice) {
    nineUpperSelectedChoice.textContent = nineUpperSelectedPlayerId
      ? `Selected: ${nineUpperPlayerName(view, nineUpperSelectedPlayerId)}`
      : canChoose ? "No player selected" : "Waiting for the Thinker's choice";
  }
}

function nineUpperRenderResult(view) {
  const visible = view.phase === "round_result" || view.phase === "game_over";
  nineUpperSetVisible(nineUpperResultStage, visible);
  if (!visible) return;
  const summary = view.last_round_summary;
  if (!summary) return;
  if (nineUpperResultBanner) {
    nineUpperResultBanner.classList.toggle("correct", !!summary.correct);
    nineUpperResultBanner.classList.toggle("fooled", !summary.correct);
    nineUpperResultBanner.innerHTML = "";
    const icon = document.createElement("span");
    icon.textContent = summary.correct ? "✅" : "🎭";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = summary.correct
      ? `${nineUpperPlayerName(view, summary.thinker_id)} found the Truth-teller!`
      : `${nineUpperPlayerName(view, summary.selected_player_id)} fooled the Thinker!`;
    const detail = document.createElement("span");
    detail.textContent = `“${summary.term}” · ${summary.difficulty} point${summary.difficulty === 1 ? "" : "s"}`;
    copy.append(title, detail);
    nineUpperResultBanner.append(icon, copy);
  }
  if (nineUpperResultDefinition) {
    nineUpperResultDefinition.textContent = summary.definition || "-";
  }
  if (nineUpperResultStatements) {
    nineUpperResultStatements.innerHTML = "";
    (summary.statements || []).forEach((statement) => {
      const isHonest = statement.player_id === summary.honest_id;
      const isSelectedBluffer = !summary.correct && statement.player_id === summary.selected_player_id;
      const points = Number((summary.round_points || {})[statement.player_id] || 0);
      const badges = [];
      badges.push(isHonest ? "📜 Truth-teller" : "🎭 Bluffer");
      if (statement.player_id === summary.selected_player_id) badges.push("Thinker's pick");
      const card = nineUpperCreateStatementCard(view, statement, {
        honest: isHonest,
        fooled: isSelectedBluffer,
        badge: badges.join(" · "),
        footer: points ? `+${points} point${points === 1 ? "" : "s"}` : "No points",
      });
      nineUpperResultStatements.appendChild(card);
    });
  }
  nineUpperSetVisible(nineUpperNextRoundRow, view.phase === "round_result");
  nineUpperSetVisible(nineUpperGameOverRow, view.phase === "game_over");
  if (nineUpperReadyStatus) {
    nineUpperReadyStatus.textContent = `Ready ${view.next_round_progress.done}/${view.next_round_progress.total}`;
  }
  if (nineUpperWinnerText && view.phase === "game_over") {
    const winners = (view.winner_ids || []).map((playerId) => nineUpperPlayerName(view, playerId));
    nineUpperWinnerText.textContent = winners.length > 1
      ? `🏆 Shared winners: ${winners.join(", ")}`
      : `🏆 Winner: ${winners[0] || "-"}`;
  }
}

function nineUpperRenderPlayers(view) {
  if (!nineUpperPlayers) return;
  nineUpperPlayers.innerHTML = "";
  (view.players || []).forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "nine-upper-player-row";
    if (player.player_id === view.you) row.classList.add("self");
    if (player.is_thinker) row.classList.add("thinker");
    if ((view.winner_ids || []).includes(player.player_id)) row.classList.add("winner");

    const rank = document.createElement("span");
    rank.className = "nine-upper-player-rank";
    rank.textContent = String(index + 1);
    const identity = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = player.name || player.player_id || "-";
    const tags = [];
    if (player.player_id === view.you) tags.push("You");
    if (player.is_thinker) tags.push("Thinker");
    if (view.phase === "statements" && !player.is_thinker) {
      tags.push(player.statement_submitted ? "Ready" : "Writing…");
    }
    if (view.phase === "round_result") tags.push(player.next_round_ready ? "Ready" : "Reviewing");
    if (player.is_bot) tags.push("Bot");
    const meta = document.createElement("small");
    meta.textContent = tags.join(" · ") || "Player";
    identity.append(name, meta);
    const score = document.createElement("strong");
    score.className = "nine-upper-player-score";
    score.textContent = `${player.score || 0} pts`;
    row.append(rank, identity, score);
    nineUpperPlayers.appendChild(row);
  });
}

function nineUpperUpdateButtons() {
  if (nineUpperSubmitStatementBtn) {
    const length = nineUpperStatementInput ? [...nineUpperStatementInput.value.trim()].length : 0;
    nineUpperSubmitStatementBtn.disabled = !nineUpperCan("submit_statement") || length === 0 || length > 280;
  }
  if (nineUpperChooseBtn) {
    nineUpperChooseBtn.disabled = !nineUpperCan("choose_honest") || !nineUpperSelectedPlayerId;
    nineUpperChooseBtn.textContent = nineUpperCan("choose_honest") ? "Lock Choice" : "Thinker's Choice";
  }
  if (nineUpperNextRoundBtn) {
    nineUpperNextRoundBtn.disabled = !nineUpperCan("next_round");
    nineUpperNextRoundBtn.textContent = nineUpperCan("next_round") ? "Next Round" : "Ready ✓";
  }
  if (nineUpperPlayAgainBtn) {
    nineUpperPlayAgainBtn.disabled = !nineUpperCan("play_again");
  }
}

function renderNineUpperGameState(data) {
  const view = data && data.view;
  if (!view) return;
  currentNineUpperView = view;
  if (currentGameType !== "nine_upper") {
    currentGameType = "nine_upper";
    setGamePanelVisibility("nine_upper");
  }
  const roundKey = `${view.round || 0}|${view.term || "pending"}`;
  if (roundKey !== nineUpperRoundKey) {
    nineUpperRoundKey = roundKey;
    nineUpperSelectedPlayerId = null;
    if (nineUpperStatementInput) nineUpperStatementInput.value = "";
  }
  nineUpperRenderHeader(view);
  nineUpperRenderStatus(view);
  nineUpperRenderRole(view);
  nineUpperRenderDifficulty(view);
  nineUpperRenderTerm(view);
  nineUpperRenderStatementStage(view);
  nineUpperRenderGuessStage(view);
  nineUpperRenderResult(view);
  nineUpperRenderPlayers(view);
  nineUpperUpdateButtons();
  if (typeof logGameEvents === "function") logGameEvents(data);
}

function clearNineUpperState() {
  currentNineUpperView = null;
  nineUpperSelectedPlayerId = null;
  nineUpperRoundKey = "";
  if (nineUpperRound) nineUpperRound.textContent = "-";
  if (nineUpperTotalRounds) nineUpperTotalRounds.textContent = "-";
  if (nineUpperPhase) nineUpperPhase.textContent = "-";
  if (nineUpperThinker) nineUpperThinker.textContent = "-";
  if (nineUpperStake) nineUpperStake.textContent = "-";
  if (nineUpperProgress) nineUpperProgress.textContent = "-";
  if (nineUpperStatementInput) nineUpperStatementInput.value = "";
  if (nineUpperDifficultyButtons) nineUpperDifficultyButtons.innerHTML = "";
  if (nineUpperStatements) nineUpperStatements.innerHTML = "";
  if (nineUpperResultStatements) nineUpperResultStatements.innerHTML = "";
  if (nineUpperPlayers) nineUpperPlayers.innerHTML = "";
  nineUpperSetVisible(nineUpperDifficultyStage, false);
  nineUpperSetVisible(nineUpperTermStage, false);
  nineUpperSetVisible(nineUpperStatementStage, false);
  nineUpperSetVisible(nineUpperGuessStage, false);
  nineUpperSetVisible(nineUpperResultStage, false);
  nineUpperExitExplainMode();
}

function showNineUpperHeaderActions(show) {
  if (nineUpperHeaderActions) nineUpperHeaderActions.style.display = show ? "flex" : "none";
  if (!show) nineUpperExitExplainMode();
}

function nineUpperShowHelp() {
  if (nineUpperHelpContent) nineUpperHelpContent.innerHTML = NINE_UPPER_HELP_HTML;
  nineUpperSetModalVisible(nineUpperHelpModal, true);
}

function nineUpperShowExplanation(buttonId) {
  const explanation = NINE_UPPER_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !nineUpperExplainContent) return;
  nineUpperExplainContent.innerHTML = "";
  const paragraph = document.createElement("p");
  paragraph.textContent = explanation;
  nineUpperExplainContent.appendChild(paragraph);
  nineUpperSetModalVisible(nineUpperExplainModal, true);
}

function nineUpperEnterExplainMode() {
  nineUpperExplainMode = true;
  document.body.classList.add("nine-upper-explain-mode");
  if (nineUpperExplainBtn) {
    nineUpperExplainBtn.classList.add("active");
    nineUpperExplainBtn.setAttribute("aria-pressed", "true");
  }
}

function nineUpperExitExplainMode() {
  nineUpperExplainMode = false;
  document.body.classList.remove("nine-upper-explain-mode");
  if (nineUpperExplainBtn) {
    nineUpperExplainBtn.classList.remove("active");
    nineUpperExplainBtn.setAttribute("aria-pressed", "false");
  }
}

if (nineUpperHelpBtn) nineUpperHelpBtn.addEventListener("click", nineUpperShowHelp);
if (nineUpperHelpCloseBtn) {
  nineUpperHelpCloseBtn.addEventListener("click", () => nineUpperSetModalVisible(nineUpperHelpModal, false));
}
if (nineUpperExplainBtn) {
  nineUpperExplainBtn.setAttribute("aria-pressed", "false");
  nineUpperExplainBtn.addEventListener("click", () => {
    if (nineUpperExplainMode) nineUpperExitExplainMode();
    else nineUpperEnterExplainMode();
  });
}
if (nineUpperExplainCloseBtn) {
  nineUpperExplainCloseBtn.addEventListener("click", () => nineUpperSetModalVisible(nineUpperExplainModal, false));
}
if (nineUpperStatementInput) {
  nineUpperStatementInput.addEventListener("input", nineUpperUpdateCharacterCount);
}
if (nineUpperSubmitStatementBtn) {
  nineUpperSubmitStatementBtn.addEventListener("click", () => {
    if (!nineUpperCan("submit_statement") || !nineUpperStatementInput) return;
    const statement = nineUpperStatementInput.value.trim();
    if (!statement) return;
    sendAction({ type: "submit_statement", statement });
  });
}
if (nineUpperChooseBtn) {
  nineUpperChooseBtn.addEventListener("click", () => {
    if (!nineUpperCan("choose_honest") || !nineUpperSelectedPlayerId) return;
    sendAction({ type: "choose_honest", player_id: nineUpperSelectedPlayerId });
  });
}
if (nineUpperNextRoundBtn) {
  nineUpperNextRoundBtn.addEventListener("click", () => {
    if (!nineUpperCan("next_round")) return;
    sendAction({ type: "next_round" });
  });
}
if (nineUpperPlayAgainBtn) {
  nineUpperPlayAgainBtn.addEventListener("click", () => {
    if (!nineUpperCan("play_again")) return;
    sendAction({ type: "play_again" });
  });
}

[nineUpperHelpModal, nineUpperExplainModal].forEach((modal) => {
  if (!modal) return;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) nineUpperSetModalVisible(modal, false);
  });
});

document.addEventListener("pointerdown", (event) => {
  if (!nineUpperExplainMode) return;
  const button = event.target.closest("button");
  if (!button || !button.disabled || !(button.id in NINE_UPPER_BUTTON_EXPLANATIONS)) return;
  event.preventDefault();
  event.stopPropagation();
  nineUpperShowExplanation(button.id);
  nineUpperExitExplainMode();
}, true);

document.addEventListener("click", (event) => {
  if (nineUpperExplainMode) {
    const button = event.target.closest("button");
    if (button && ![nineUpperHelpBtn, nineUpperExplainBtn, nineUpperHelpCloseBtn, nineUpperExplainCloseBtn].includes(button)) {
      event.preventDefault();
      event.stopPropagation();
      if (button.id in NINE_UPPER_BUTTON_EXPLANATIONS) {
        nineUpperShowExplanation(button.id);
        nineUpperExitExplainMode();
      }
      return;
    }
  }
  if (
    currentNineUpperView
    && currentNineUpperView.phase === "guessing"
    && nineUpperSelectedPlayerId
    && !event.target.closest(".nine-upper-statement-option")
    && !event.target.closest(".nine-upper-choice-row")
  ) {
    nineUpperSelectedPlayerId = null;
    nineUpperRenderGuessStage(currentNineUpperView);
    nineUpperUpdateButtons();
  }
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (nineUpperExplainMode) {
    nineUpperExitExplainMode();
    return;
  }
  if (nineUpperHelpModal && !nineUpperHelpModal.classList.contains("hidden")) {
    nineUpperSetModalVisible(nineUpperHelpModal, false);
    return;
  }
  if (nineUpperExplainModal && !nineUpperExplainModal.classList.contains("hidden")) {
    nineUpperSetModalVisible(nineUpperExplainModal, false);
    return;
  }
  if (nineUpperSelectedPlayerId && currentNineUpperView && currentNineUpperView.phase === "guessing") {
    nineUpperSelectedPlayerId = null;
    nineUpperRenderGuessStage(currentNineUpperView);
    nineUpperUpdateButtons();
  }
});

