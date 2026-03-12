let currentDecryptoView = null;

let decryptoWordPacks = [];
let decryptoPackSelections = new Set(["basic"]);
let decryptoPacksLoaded = false;
let decryptoBotStrategies = [];
let decryptoBotStrategiesLoaded = false;
let decryptoBotStrategyId = "native";
let decryptoBotClueDirectness = 0.5;

const decryptoConfigBox = document.getElementById("decryptoConfigBox");
const decryptoPackRow = document.getElementById("decryptoPackRow");
const decryptoPackOptions = document.getElementById("decryptoPackOptions");
const decryptoBotRow = document.getElementById("decryptoBotRow");
const decryptoBotSelect = document.getElementById("decryptoBotSelect");
const decryptoBotClueRow = document.getElementById("decryptoBotClueRow");
const decryptoBotClueSelect = document.getElementById("decryptoBotClueSelect");

const decryptoPanel = document.getElementById("decryptoPanel");

const decryptoPhaseLabel = document.getElementById("decryptoPhase");
const decryptoRoundLabel = document.getElementById("decryptoRound");
const decryptoMaxRoundsLabel = document.getElementById("decryptoMaxRounds");
const decryptoWinnerLabel = document.getElementById("decryptoWinner");
const decryptoYourTeamLabel = document.getElementById("decryptoYourTeam");
const decryptoYourRoleLabel = document.getElementById("decryptoYourRole");
const decryptoCurrentCodeLabel = document.getElementById("decryptoCurrentCode");
const decryptoStatus = document.getElementById("decryptoStatus");
const decryptoStatusBody = document.getElementById("decryptoStatusBody");
const decryptoTeams = document.getElementById("decryptoTeams");
const decryptoCurrentClues = document.getElementById("decryptoCurrentClues");
const decryptoHistory = document.getElementById("decryptoHistory");
const decryptoSummary = document.getElementById("decryptoSummary");
const decryptoSummaryBody = document.getElementById("decryptoSummaryBody");
const decryptoEncryptionArea = document.getElementById("decryptoEncryptionArea");
const decryptoGuessArea = document.getElementById("decryptoGuessArea");
const decryptoClue1 = document.getElementById("decryptoClue1");
const decryptoClue2 = document.getElementById("decryptoClue2");
const decryptoClue3 = document.getElementById("decryptoClue3");
const decryptoClueDigitLabels = [
  document.getElementById("decryptoClueDigit1"),
  document.getElementById("decryptoClueDigit2"),
  document.getElementById("decryptoClueDigit3"),
];
const decryptoClueWordLabels = [
  document.getElementById("decryptoClueWord1"),
  document.getElementById("decryptoClueWord2"),
  document.getElementById("decryptoClueWord3"),
];
const decryptoClueMissingRow = document.getElementById("decryptoClueMissingRow");
const decryptoClueMissingWord = document.getElementById("decryptoClueMissingWord");
const decryptoSubmitCluesBtn = document.getElementById("decryptoSubmitCluesBtn");
const decryptoDecryptSelects = [
  document.getElementById("decryptoDecryptSelect1"),
  document.getElementById("decryptoDecryptSelect2"),
  document.getElementById("decryptoDecryptSelect3"),
];
const decryptoDecryptClueLabels = [
  document.getElementById("decryptoDecryptClueLabel1"),
  document.getElementById("decryptoDecryptClueLabel2"),
  document.getElementById("decryptoDecryptClueLabel3"),
];
const decryptoSubmitDecryptBtn = document.getElementById("decryptoSubmitDecryptBtn");
const decryptoInterceptSelects = [
  document.getElementById("decryptoInterceptSelect1"),
  document.getElementById("decryptoInterceptSelect2"),
  document.getElementById("decryptoInterceptSelect3"),
];
const decryptoInterceptClueLabels = [
  document.getElementById("decryptoInterceptClueLabel1"),
  document.getElementById("decryptoInterceptClueLabel2"),
  document.getElementById("decryptoInterceptClueLabel3"),
];
const decryptoSubmitInterceptBtn = document.getElementById("decryptoSubmitInterceptBtn");

const decryptoActionButtons = {
  submit_clues: decryptoSubmitCluesBtn,
  submit_decrypt: decryptoSubmitDecryptBtn,
  submit_intercept: decryptoSubmitInterceptBtn,
};

function updateDecryptoPackRow() {
  const showRow = currentRoomState && currentGameType === "decrypto" && currentRoomState.status === "lobby";
  if (decryptoConfigBox) {
    decryptoConfigBox.classList.toggle("hidden", !showRow);
    decryptoConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (decryptoPackRow) {
    decryptoPackRow.classList.toggle("hidden", !showRow);
    decryptoPackRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (showRow && !decryptoPacksLoaded) {
    fetchDecryptoPacks();
  }
}

function updateDecryptoBotRow() {
  const showRow =
    currentRoomState && currentGameType === "decrypto" && currentRoomState.status === "lobby" && roomHasBots();
  if (decryptoBotRow) {
    decryptoBotRow.classList.toggle("hidden", !showRow);
    decryptoBotRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (decryptoBotClueRow) {
    decryptoBotClueRow.classList.toggle("hidden", !showRow);
    decryptoBotClueRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (showRow && !decryptoBotStrategiesLoaded) {
    fetchDecryptoBotStrategies();
  }
}

function fetchDecryptoPacks() {
  if (!decryptoPackOptions) {
    return;
  }
  decryptoPackOptions.textContent = "Loading word packs...";
  fetch("/api/decrypto/word_packs")
    .then((response) => response.json())
    .then((data) => {
      decryptoWordPacks = Array.isArray(data.packs) ? data.packs : [];
      decryptoPacksLoaded = true;
      renderDecryptoPackOptions();
    })
    .catch(() => {
      decryptoPackOptions.textContent = "Failed to load word packs.";
      decryptoPacksLoaded = false;
    });
}

function fetchDecryptoBotStrategies() {
  if (!decryptoBotSelect) {
    return;
  }
  decryptoBotSelect.innerHTML = "";
  const option = document.createElement("option");
  option.value = "native";
  option.textContent = "native";
  decryptoBotSelect.appendChild(option);
  decryptoBotSelect.disabled = true;
  fetch("/api/decrypto/bot_strategies")
    .then((response) => response.json())
    .then((data) => {
      decryptoBotStrategies = Array.isArray(data.strategies) ? data.strategies : [];
      decryptoBotStrategiesLoaded = true;
      renderDecryptoBotStrategies();
    })
    .catch(() => {
      decryptoBotStrategiesLoaded = false;
      decryptoBotSelect.disabled = false;
    });
}

function renderDecryptoPackOptions() {
  if (!decryptoPackOptions) {
    return;
  }
  decryptoPackOptions.innerHTML = "";
  if (!decryptoWordPacks.length) {
    decryptoPackOptions.textContent = "No word packs available.";
    return;
  }
  const availablePackIds = new Set();
  decryptoWordPacks.forEach((pack) => {
    if (pack.pack_id) {
      availablePackIds.add(pack.pack_id);
    }
  });
  decryptoPackSelections = new Set(
    Array.from(decryptoPackSelections).filter((packId) => availablePackIds.has(packId))
  );
  if (decryptoPackSelections.size === 0) {
    availablePackIds.forEach((packId) => {
      decryptoPackSelections.add(packId);
    });
  }
  decryptoWordPacks.forEach((pack) => {
    const packId = pack.pack_id;
    if (!packId) {
      return;
    }
    const label = document.createElement("label");
    label.className = "decrypto-pack-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = packId;
    checkbox.checked = decryptoPackSelections.has(packId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        decryptoPackSelections.add(packId);
      } else {
        decryptoPackSelections.delete(packId);
      }
    });
    const text = document.createElement("span");
    const name = pack.pack_name || packId;
    const language = pack.language ? ` · ${pack.language}` : "";
    const count = Number.isFinite(pack.total_count) ? ` (${pack.total_count})` : "";
    text.textContent = `${name}${language}${count}`;
    label.appendChild(checkbox);
    label.appendChild(text);
  decryptoPackOptions.appendChild(label);
  });
}

function renderDecryptoBotStrategies() {
  if (!decryptoBotSelect) {
    return;
  }
  decryptoBotSelect.innerHTML = "";
  if (!decryptoBotStrategies.length) {
    const fallback = document.createElement("option");
    fallback.value = "native";
    fallback.textContent = "native";
    decryptoBotSelect.appendChild(fallback);
    decryptoBotSelect.value = "native";
    decryptoBotStrategyId = "native";
    decryptoBotSelect.disabled = false;
    return;
  }
  const availableIds = new Set();
  decryptoBotStrategies.forEach((strategy) => {
    if (strategy.strategy_id) {
      availableIds.add(strategy.strategy_id);
    }
  });
  if (!availableIds.has(decryptoBotStrategyId)) {
    decryptoBotStrategyId = availableIds.has("native")
      ? "native"
      : Array.from(availableIds)[0] || "native";
  }
  decryptoBotStrategies.forEach((strategy) => {
    const strategyId = strategy.strategy_id;
    if (!strategyId) {
      return;
    }
    const option = document.createElement("option");
    option.value = strategyId;
    option.textContent = strategy.label || strategyId;
    if (strategy.description) {
      option.title = strategy.description;
    }
    decryptoBotSelect.appendChild(option);
  });
  decryptoBotSelect.value = decryptoBotStrategyId;
  decryptoBotSelect.disabled = false;
}

function getSelectedDecryptoPacks() {
  return Array.from(decryptoPackSelections);
}

function getSelectedDecryptoBotStrategy() {
  if (decryptoBotSelect && decryptoBotSelect.value) {
    decryptoBotStrategyId = decryptoBotSelect.value;
  }
  return decryptoBotStrategyId || "native";
}

function getSelectedDecryptoBotClueDirectness() {
  if (decryptoBotClueSelect && decryptoBotClueSelect.value) {
    const parsed = Number.parseFloat(decryptoBotClueSelect.value);
    if (Number.isFinite(parsed)) {
      decryptoBotClueDirectness = parsed;
    }
  }
  if (!Number.isFinite(decryptoBotClueDirectness)) {
    decryptoBotClueDirectness = 0.5;
  }
  return decryptoBotClueDirectness;
}

function resetDecryptoInputs() {
  if (decryptoClue1) {
    decryptoClue1.value = "";
  }
  if (decryptoClue2) {
    decryptoClue2.value = "";
  }
  if (decryptoClue3) {
    decryptoClue3.value = "";
  }
  decryptoDecryptSelects.forEach((select) => {
    if (select) {
      select.value = "";
    }
  });
  decryptoInterceptSelects.forEach((select) => {
    if (select) {
      select.value = "";
    }
  });
  updateDecryptoGuessSelectLabels(decryptoDecryptSelects, null);
  updateDecryptoGuessSelectLabels(decryptoInterceptSelects, null);
  updateDecryptoGuessSelectOptions(decryptoDecryptSelects);
  updateDecryptoGuessSelectOptions(decryptoInterceptSelects);
  updateDecryptoGuessClueLabels(decryptoDecryptClueLabels, null);
  updateDecryptoGuessClueLabels(decryptoInterceptClueLabels, null);
}

function clearDecryptoState() {
  currentDecryptoView = null;
  if (decryptoPhaseLabel) {
    decryptoPhaseLabel.textContent = "-";
  }
  if (decryptoRoundLabel) {
    decryptoRoundLabel.textContent = "-";
  }
  if (decryptoMaxRoundsLabel) {
    decryptoMaxRoundsLabel.textContent = "-";
  }
  if (decryptoWinnerLabel) {
    decryptoWinnerLabel.textContent = "-";
  }
  if (decryptoYourTeamLabel) {
    decryptoYourTeamLabel.textContent = "-";
  }
  if (decryptoYourRoleLabel) {
    decryptoYourRoleLabel.textContent = "-";
  }
  if (decryptoCurrentCodeLabel) {
    decryptoCurrentCodeLabel.textContent = "-";
  }
  updateDecryptoClueCodeLabels(null, null);
  if (decryptoTeams) {
    decryptoTeams.innerHTML = "";
  }
  if (decryptoCurrentClues) {
    decryptoCurrentClues.innerHTML = "";
  }
  if (decryptoHistory) {
    decryptoHistory.innerHTML = "";
  }
  if (decryptoSummary) {
    decryptoSummary.classList.add("hidden");
  }
  if (decryptoSummaryBody) {
    decryptoSummaryBody.textContent = "-";
  }
  resetDecryptoInputs();
  updateDecryptoActionButtons();
}

function formatDecryptoTeamLabel(teamId) {
  if (teamId === "white") {
    return "White";
  }
  if (teamId === "black") {
    return "Black";
  }
  return teamId || "-";
}

function formatDecryptoCode(code) {
  if (!Array.isArray(code) || code.length !== 3) {
    return "-";
  }
  return code.join(".");
}

function formatDecryptoCodeWithKeywords(code, keywords) {
  if (!Array.isArray(code) || code.length !== 3) {
    return formatDecryptoCode(code);
  }
  if (!Array.isArray(keywords) || keywords.length < 4) {
    return formatDecryptoCode(code);
  }
  const words = code.map((index) => {
    const word = keywords[index - 1];
    if (typeof word !== "string") {
      return null;
    }
    const cleaned = word.trim();
    return cleaned ? cleaned : null;
  });
  if (words.some((word) => !word)) {
    return formatDecryptoCode(code);
  }
  return words.join(" / ");
}

function parseDecryptoCodeInput(value) {
  if (!value) {
    return null;
  }
  const digits = value.match(/[1-4]/g);
  if (!digits || digits.length !== 3) {
    return null;
  }
  const code = digits.map((digit) => Number.parseInt(digit, 10));
  if (new Set(code).size !== 3) {
    return null;
  }
  return code;
}

function getDecryptoGuessFromSelects(selects) {
  if (!Array.isArray(selects) || selects.length !== 3) {
    return null;
  }
  const values = selects.map((select) => (select ? select.value : ""));
  if (values.some((value) => !value)) {
    return null;
  }
  return parseDecryptoCodeInput(values.join("."));
}

function updateDecryptoGuessSelectLabels(selects, keywords) {
  if (!Array.isArray(selects) || selects.length !== 3) {
    return;
  }
  const hasKeywords = Array.isArray(keywords) && keywords.length >= 4;
  selects.forEach((select) => {
    if (!select) {
      return;
    }
    Array.from(select.options).forEach((option) => {
      if (!option.value) {
        option.textContent = "-";
        option.title = "";
        return;
      }
      const index = Number.parseInt(option.value, 10);
      if (!Number.isInteger(index) || index < 1 || index > 4) {
        option.textContent = option.value;
        option.title = "";
        return;
      }
      const word =
        hasKeywords && typeof keywords[index - 1] === "string" ? keywords[index - 1].trim() : "";
      if (word) {
        option.textContent = `${index}. ${word}`;
        option.title = word;
      } else {
        option.textContent = option.value;
        option.title = "";
      }
    });
  });
}

function updateDecryptoGuessSelectOptions(selects) {
  if (!Array.isArray(selects) || selects.length !== 3) {
    return;
  }
  const selected = new Set(
    selects.map((select) => (select ? select.value : "")).filter((value) => value)
  );
  selects.forEach((select) => {
    if (!select) {
      return;
    }
    const currentValue = select.value;
    Array.from(select.options).forEach((option) => {
      if (!option.value) {
        option.disabled = false;
        return;
      }
      option.disabled = option.value !== currentValue && selected.has(option.value);
    });
  });
}

function updateDecryptoGuessClueLabels(labels, clues) {
  if (!Array.isArray(labels) || labels.length !== 3) {
    return;
  }
  labels.forEach((label, index) => {
    if (!label) {
      return;
    }
    const clue = Array.isArray(clues) ? clues[index] : null;
    const clueText = typeof clue === "string" && clue.trim() ? clue.trim() : "-";
    label.textContent = `Clue ${index + 1}: ${clueText}`;
  });
}

function updateDecryptoClueCodeLabels(code, keywords) {
  const values = Array.isArray(code) && code.length === 3 ? code : [];
  if (Array.isArray(decryptoClueDigitLabels) && decryptoClueDigitLabels.length === 3) {
    decryptoClueDigitLabels.forEach((label, index) => {
      if (!label) {
        return;
      }
      const value = values[index];
      label.textContent = Number.isInteger(value) ? value.toString() : "-";
    });
  }
  const hasKeywords = Array.isArray(keywords) && keywords.length >= 4;
  if (Array.isArray(decryptoClueWordLabels) && decryptoClueWordLabels.length === 3) {
    decryptoClueWordLabels.forEach((label, index) => {
      if (!label) {
        return;
      }
      const value = values[index];
      const hasCode = Number.isInteger(value);
      const keyword =
        hasCode && hasKeywords ? keywords[value - 1] : null;
      const keywordText = typeof keyword === "string" && keyword.trim() ? keyword.trim() : "";
      if (hasCode) {
        label.textContent = keywordText || "-";
        label.classList.toggle("hidden", false);
      } else {
        label.textContent = "-";
        label.classList.toggle("hidden", true);
      }
    });
  }

  if (decryptoClueMissingRow && decryptoClueMissingWord) {
    let missingKeyword = null;
    if (values.length === 3 && hasKeywords) {
      const validValues = values.filter(
        (value) => Number.isInteger(value) && value >= 1 && value <= 4,
      );
      const used = new Set(validValues);
      if (validValues.length === 3 && used.size === 3) {
        const missingIndex = [1, 2, 3, 4].find((value) => !used.has(value));
        if (missingIndex) {
          const candidate = keywords[missingIndex - 1];
          if (typeof candidate === "string" && candidate.trim()) {
            missingKeyword = candidate.trim();
          }
        }
      }
    }
    if (missingKeyword) {
      decryptoClueMissingWord.textContent = missingKeyword;
      decryptoClueMissingRow.classList.remove("hidden");
    } else {
      decryptoClueMissingWord.textContent = "-";
      decryptoClueMissingRow.classList.add("hidden");
    }
  }
}

function getDecryptoOpponentTeam(teamId) {
  if (teamId === "white") {
    return "black";
  }
  if (teamId === "black") {
    return "white";
  }
  return null;
}

function updateDecryptoGuessClues(view) {
  if (!view || !view.teams) {
    updateDecryptoGuessClueLabels(decryptoDecryptClueLabels, null);
    updateDecryptoGuessClueLabels(decryptoInterceptClueLabels, null);
    return;
  }
  const teamId = view.team_id;
  const teamClues =
    teamId && view.teams[teamId] ? view.teams[teamId].current_clues : null;
  const opponentId = getDecryptoOpponentTeam(teamId);
  const opponentClues =
    opponentId && view.teams[opponentId] ? view.teams[opponentId].current_clues : null;
  updateDecryptoGuessClueLabels(decryptoDecryptClueLabels, teamClues);
  updateDecryptoGuessClueLabels(decryptoInterceptClueLabels, opponentClues);
}

function setDecryptoStatusLines(lines) {
  if (!decryptoStatusBody) {
    return;
  }
  decryptoStatusBody.innerHTML = "";
  if (!Array.isArray(lines) || !lines.length) {
    decryptoStatusBody.textContent = "-";
    return;
  }
  lines.forEach((line) => {
    const row = document.createElement("div");
    row.className = "decrypto-status-line";
    row.textContent = line;
    decryptoStatusBody.appendChild(row);
  });
}

function getDecryptoPendingEvents(view) {
  const pending = [];
  if (!view || !view.teams) {
    return pending;
  }
  const viewerTeam = view.team_id;
  const labelForTeam = (teamId) => {
    if (viewerTeam && teamId === viewerTeam) {
      return "your team";
    }
    if (viewerTeam && teamId !== viewerTeam) {
      return "opponent team";
    }
    return `${formatDecryptoTeamLabel(teamId)} team`;
  };
  if (view.phase === "encryption") {
    ["white", "black"].forEach((teamId) => {
      const team = view.teams[teamId];
      if (team && !team.clues_submitted) {
        pending.push(`${labelForTeam(teamId)} clues`);
      }
    });
  } else if (view.phase === "guessing") {
    ["white", "black"].forEach((teamId) => {
      const team = view.teams[teamId];
      if (!team) {
        return;
      }
      if (!team.decrypt_submitted) {
        pending.push(`${labelForTeam(teamId)} decrypt guess`);
      }
      if (view.round > 1 && !team.intercept_submitted) {
        pending.push(`${labelForTeam(teamId)} intercept guess`);
      }
    });
  }
  return pending;
}

function getDecryptoActionLines(view) {
  const actions = Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const lines = [];
  if (actions.includes("submit_clues")) {
    const clues = [decryptoClue1, decryptoClue2, decryptoClue3]
      .map((input) => (input ? input.value.trim() : ""))
      .filter((text) => text);
    const teamKeywords =
      view.team_id && view.teams && view.teams[view.team_id]
        ? view.teams[view.team_id].keywords
        : null;
    const codeText = view.current_code
      ? formatDecryptoCodeWithKeywords(view.current_code, teamKeywords)
      : "-";
    if (clues.length === 3) {
      lines.push(`Submit your clues for code ${codeText}.`);
    } else {
      lines.push(`Enter 3 clues for code ${codeText}, then submit.`);
    }
  }
  if (actions.includes("submit_decrypt")) {
    const guess = getDecryptoGuessFromSelects(decryptoDecryptSelects);
    if (guess) {
      lines.push("Submit your team's decrypt guess.");
    } else {
      lines.push("Select three numbers for your team's clues.");
    }
  }
  if (actions.includes("submit_intercept")) {
    const guess = getDecryptoGuessFromSelects(decryptoInterceptSelects);
    if (guess) {
      lines.push("Submit an intercept guess for the opponent.");
    } else {
      lines.push("Select three numbers for the opponent's clues.");
    }
  }
  return lines;
}

function updateDecryptoStatus() {
  if (!decryptoStatus || !decryptoStatusBody) {
    return;
  }
  if (currentGameType !== "decrypto" || !currentDecryptoView) {
    setDecryptoStatusLines(["-"]);
    decryptoStatus.classList.add("waiting");
    return;
  }
  const view = currentDecryptoView;
  if (view.game_over || view.phase === "game_over") {
    const winnerLabel =
      view.winner === "draw"
        ? "Draw"
        : view.winner
          ? formatDecryptoTeamLabel(view.winner)
          : "Unknown";
    setDecryptoStatusLines([
      `Game over. Winner: ${winnerLabel}.`,
      "Waiting for the host to start a new game.",
    ]);
    decryptoStatus.classList.add("waiting");
    return;
  }

  const actionLines = getDecryptoActionLines(view);
  if (actionLines.length) {
    setDecryptoStatusLines(actionLines);
    decryptoStatus.classList.remove("waiting");
    return;
  }

  const pending = getDecryptoPendingEvents(view);
  if (pending.length) {
    setDecryptoStatusLines([`Waiting for: ${pending.join(", ")}.`]);
  } else {
    setDecryptoStatusLines(["Waiting for next phase."]);
  }
  decryptoStatus.classList.add("waiting");
}

function isDecryptoActionAvailable(actionType) {
  if (!currentDecryptoView || !Array.isArray(currentDecryptoView.legal_actions)) {
    return false;
  }
  if (!currentDecryptoView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "submit_clues") {
    const clues = [decryptoClue1, decryptoClue2, decryptoClue3]
      .map((input) => (input ? input.value.trim() : ""))
      .filter((text) => text);
    return clues.length === 3;
  }
  if (actionType === "submit_decrypt") {
    return !!getDecryptoGuessFromSelects(decryptoDecryptSelects);
  }
  if (actionType === "submit_intercept") {
    return !!getDecryptoGuessFromSelects(decryptoInterceptSelects);
  }
  return true;
}

function updateDecryptoActionButtons() {
  if (currentGameType !== "decrypto") {
    Object.values(decryptoActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    updateDecryptoStatus();
    return;
  }
  Object.entries(decryptoActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isDecryptoActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  updateDecryptoStatus();
}

function renderDecryptoTeams(view) {
  if (!decryptoTeams) {
    return;
  }
  decryptoTeams.innerHTML = "";
  ["white", "black"].forEach((teamId) => {
    const team = view.teams ? view.teams[teamId] : null;
    if (!team) {
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "decrypto-team";

    const header = document.createElement("div");
    header.className = "decrypto-team-header";
    header.textContent = `${formatDecryptoTeamLabel(teamId)} Team`;
    wrapper.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "decrypto-team-meta";
    meta.textContent = `Intercepts ${team.intercepts} | Miscommunications ${team.miscommunications}`;
    wrapper.appendChild(meta);

    const encryptorName = team.encryptor_id ? findPlayerName(view, team.encryptor_id) : "-";
    const encryptorLine = document.createElement("div");
    encryptorLine.textContent = `Encryptor: ${encryptorName}`;
    wrapper.appendChild(encryptorLine);

    const playerNames = (team.players || []).map((p) => p.name || p.player_id).join(", ");
    const playersLine = document.createElement("div");
    playersLine.textContent = `Players: ${playerNames || "-"}`;
    wrapper.appendChild(playersLine);

    const interceptStatus = view.round > 1 ? (team.intercept_submitted ? "submitted" : "pending") : "n/a";
    const statusLine = document.createElement("div");
    statusLine.textContent = `Clues: ${team.clues_submitted ? "submitted" : "pending"} | Decrypt: ${
      team.decrypt_submitted ? "submitted" : "pending"
    } | Intercept: ${interceptStatus}`;
    wrapper.appendChild(statusLine);

    const keywordsLabel = document.createElement("div");
    keywordsLabel.textContent = "Keywords:";
    wrapper.appendChild(keywordsLabel);

    if (team.keywords && team.keywords.length) {
      const keywordRow = document.createElement("div");
      keywordRow.className = "decrypto-keywords";
      team.keywords.forEach((word, idx) => {
        const item = document.createElement("div");
        item.className = "decrypto-keyword";
        item.textContent = `${idx + 1}. ${word}`;
        keywordRow.appendChild(item);
      });
      wrapper.appendChild(keywordRow);
    } else {
      const hidden = document.createElement("div");
      hidden.textContent = "Hidden";
      wrapper.appendChild(hidden);
    }

    decryptoTeams.appendChild(wrapper);
  });
}

function renderDecryptoCurrentClues(view) {
  if (!decryptoCurrentClues) {
    return;
  }
  decryptoCurrentClues.innerHTML = "";
  ["white", "black"].forEach((teamId) => {
    const team = view.teams ? view.teams[teamId] : null;
    if (!team) {
      return;
    }
    const row = document.createElement("div");
    const label = document.createElement("strong");
    label.textContent = `${formatDecryptoTeamLabel(teamId)}: `;
    row.appendChild(label);

    const clues = team.current_clues;
    const clueText = Array.isArray(clues) && clues.length ? clues.join(" | ") : "-";
    const textNode = document.createElement("span");
    textNode.textContent = clueText;
    row.appendChild(textNode);
    decryptoCurrentClues.appendChild(row);
  });
}

function renderDecryptoHistory(view) {
  if (!decryptoHistory) {
    return;
  }
  decryptoHistory.innerHTML = "";
  ["white", "black"].forEach((teamId) => {
    const team = view.teams ? view.teams[teamId] : null;
    if (!team) {
      return;
    }
    const section = document.createElement("div");
    section.className = "decrypto-team";

    const header = document.createElement("div");
    header.className = "decrypto-team-header";
    header.textContent = `${formatDecryptoTeamLabel(teamId)} History`;
    section.appendChild(header);

    const table = document.createElement("table");
    table.className = "decrypto-history-table";
    const headRow = document.createElement("tr");
    for (let idx = 1; idx <= 4; idx += 1) {
      const th = document.createElement("th");
      th.textContent = `Keyword ${idx}`;
      headRow.appendChild(th);
    }
    table.appendChild(headRow);

    const dataRow = document.createElement("tr");
    for (let idx = 1; idx <= 4; idx += 1) {
      const td = document.createElement("td");
      const items = team.history_by_keyword ? team.history_by_keyword[String(idx)] : null;
      if (Array.isArray(items) && items.length) {
        td.textContent = items.join(", ");
      } else {
        td.textContent = "-";
      }
      dataRow.appendChild(td);
    }
    table.appendChild(dataRow);
    section.appendChild(table);
    decryptoHistory.appendChild(section);
  });
}

function renderDecryptoSummary(view) {
  if (!decryptoSummary || !decryptoSummaryBody) {
    return;
  }
  const summary = view.last_round_summary;
  if (!summary || !summary.teams) {
    decryptoSummary.classList.add("hidden");
    decryptoSummaryBody.textContent = "-";
    return;
  }
  decryptoSummary.classList.remove("hidden");
  while (decryptoSummaryBody.firstChild) {
    decryptoSummaryBody.removeChild(decryptoSummaryBody.firstChild);
  }
  ["white", "black"].forEach((teamId) => {
    const info = summary.teams[teamId];
    if (!info) {
      return;
    }
    const line = document.createElement("div");
    const decryptGuess = formatDecryptoCode(info.decrypt_guess);
    const decryptResult = info.decrypt_correct ? "correct" : "wrong";
    let interceptPart = "-";
    if (summary.round > 1) {
      const interceptGuess = formatDecryptoCode(info.intercept_guess);
      const interceptResult = info.intercept_correct ? "correct" : "wrong";
      interceptPart = `${interceptGuess} (${interceptResult})`;
    }
    const codeText = formatDecryptoCode(info.code);
    const clues = Array.isArray(info.clues) && info.clues.length ? info.clues.join(" | ") : "-";
    line.textContent = `${formatDecryptoTeamLabel(teamId)} code ${codeText} | clues ${clues} | decrypt ${decryptGuess} (${decryptResult}) | intercept ${interceptPart}`;
    decryptoSummaryBody.appendChild(line);
  });
}

function renderDecryptoGameState(data) {
  const view = data.view;
  const previousView = currentDecryptoView;
  const previousGameOver = previousView
    ? previousView.game_over || previousView.phase === "game_over"
    : false;
  currentDecryptoView = view;
  const roundChanged = previousView && previousView.round !== view.round;
  const newGameStarted = previousView && previousGameOver && !view.game_over && view.phase !== "game_over";
  if (roundChanged || newGameStarted) {
    resetDecryptoInputs();
  }
  if (currentGameType !== "decrypto") {
    currentGameType = "decrypto";
    setGamePanelVisibility("decrypto");
  }

  if (decryptoPhaseLabel) {
    decryptoPhaseLabel.textContent = view.phase || "-";
  }
  if (decryptoRoundLabel) {
    decryptoRoundLabel.textContent = view.round ?? "-";
  }
  if (decryptoMaxRoundsLabel) {
    decryptoMaxRoundsLabel.textContent = view.max_rounds ?? "-";
  }
  if (decryptoWinnerLabel) {
    if (view.winner === "draw") {
      decryptoWinnerLabel.textContent = "Draw";
    } else if (view.winner) {
      decryptoWinnerLabel.textContent = formatDecryptoTeamLabel(view.winner);
    } else {
      decryptoWinnerLabel.textContent = "-";
    }
  }
  if (decryptoYourTeamLabel) {
    decryptoYourTeamLabel.textContent = view.team_id ? formatDecryptoTeamLabel(view.team_id) : "-";
  }
  if (decryptoYourRoleLabel) {
    if (!view.team_id) {
      decryptoYourRoleLabel.textContent = "-";
    } else {
      decryptoYourRoleLabel.textContent = view.is_encryptor ? "Encryptor" : "Teammate";
    }
  }
  if (decryptoCurrentCodeLabel) {
    decryptoCurrentCodeLabel.textContent = view.current_code ? formatDecryptoCode(view.current_code) : "-";
  }
  const teamKeywords =
    view.team_id && view.teams && view.teams[view.team_id]
      ? view.teams[view.team_id].keywords
      : null;
  const opponentId = getDecryptoOpponentTeam(view.team_id);
  const opponentKeywords =
    opponentId && view.teams && view.teams[opponentId]
      ? view.teams[opponentId].keywords
      : null;
  updateDecryptoClueCodeLabels(view.current_code, teamKeywords);
  updateDecryptoGuessClues(view);
  updateDecryptoGuessSelectLabels(decryptoDecryptSelects, teamKeywords);
  updateDecryptoGuessSelectLabels(decryptoInterceptSelects, opponentKeywords);
  updateDecryptoGuessSelectOptions(decryptoDecryptSelects);
  updateDecryptoGuessSelectOptions(decryptoInterceptSelects);

  if (decryptoEncryptionArea) {
    decryptoEncryptionArea.classList.toggle("hidden", view.phase !== "encryption");
  }
  if (decryptoGuessArea) {
    decryptoGuessArea.classList.toggle("hidden", view.phase !== "guessing");
  }

  renderDecryptoTeams(view);
  renderDecryptoCurrentClues(view);
  renderDecryptoHistory(view);
  renderDecryptoSummary(view);

  logGameEvents(data);
  updateDecryptoActionButtons();
}

if (decryptoSubmitCluesBtn) {
  decryptoSubmitCluesBtn.addEventListener("click", () => {
    const clues = [decryptoClue1, decryptoClue2, decryptoClue3].map((input) =>
      input ? input.value.trim() : ""
    );
    if (clues.some((clue) => !clue)) {
      log("Enter three clues");
      return;
    }
    sendAction({ type: "submit_clues", clues });
  });
}

if (decryptoSubmitDecryptBtn) {
  decryptoSubmitDecryptBtn.addEventListener("click", () => {
    const code = getDecryptoGuessFromSelects(decryptoDecryptSelects);
    if (!code) {
      log("Select three distinct numbers for the decrypt guess");
      return;
    }
    sendAction({ type: "submit_decrypt", guess: code });
  });
}

if (decryptoSubmitInterceptBtn) {
  decryptoSubmitInterceptBtn.addEventListener("click", () => {
    const code = getDecryptoGuessFromSelects(decryptoInterceptSelects);
    if (!code) {
      log("Select three distinct numbers for the intercept guess");
      return;
    }
    sendAction({ type: "submit_intercept", guess: code });
  });
}

if (decryptoClue1) {
  decryptoClue1.addEventListener("input", () => updateDecryptoActionButtons());
}
if (decryptoClue2) {
  decryptoClue2.addEventListener("input", () => updateDecryptoActionButtons());
}
if (decryptoClue3) {
  decryptoClue3.addEventListener("input", () => updateDecryptoActionButtons());
}
decryptoDecryptSelects.forEach((select) => {
  if (!select) {
    return;
  }
  select.addEventListener("change", () => {
    updateDecryptoGuessSelectOptions(decryptoDecryptSelects);
    updateDecryptoActionButtons();
  });
});
decryptoInterceptSelects.forEach((select) => {
  if (!select) {
    return;
  }
  select.addEventListener("change", () => {
    updateDecryptoGuessSelectOptions(decryptoInterceptSelects);
    updateDecryptoActionButtons();
  });
});
if (decryptoBotSelect) {
  decryptoBotSelect.addEventListener("change", () => {
    decryptoBotStrategyId = decryptoBotSelect.value || "native";
  });
}
if (decryptoBotClueSelect) {
  decryptoBotClueSelect.addEventListener("change", () => {
    const parsed = Number.parseFloat(decryptoBotClueSelect.value);
    decryptoBotClueDirectness = Number.isFinite(parsed) ? parsed : 0.5;
  });
}
