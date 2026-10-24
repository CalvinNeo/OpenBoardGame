let currentDecryptoView = null;

let decryptoWordPacks = [];
let decryptoPackSelections = new Set(["basic"]);
let decryptoPacksLoaded = false;
let decryptoBotStrategies = [];
let decryptoBotStrategiesLoaded = false;
let decryptoBotStrategyId = "native";
let decryptoBotClueDirectness = 0.5;

const decryptoHeaderActions = document.getElementById("decryptoHeaderActions");
const decryptoHelpBtn = document.getElementById("decryptoHelpBtn");
const decryptoExplainBtn = document.getElementById("decryptoExplainBtn");
const decryptoHelpModal = document.getElementById("decryptoHelpModal");
const decryptoHelpModalCloseBtn = document.getElementById("decryptoHelpModalCloseBtn");
const decryptoExplainModal = document.getElementById("decryptoExplainModal");
const decryptoExplainModalCloseBtn = document.getElementById("decryptoExplainModalCloseBtn");
const decryptoHelpContent = document.getElementById("decryptoHelpContent");
const decryptoExplainContent = document.getElementById("decryptoExplainContent");

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
const decryptoNextRoundBtn = document.getElementById("decryptoNextRoundBtn");
const decryptoReviewBtn = document.getElementById("decryptoReviewBtn");
const decryptoReviewCloseBtn = document.getElementById("decryptoReviewCloseBtn");
const decryptoReviewExplainBtn = document.getElementById("decryptoReviewExplainBtn");
const decryptoTooltip = document.getElementById("decryptoTooltip");
const DECRYPTO_PLAYER_COLORS = [
  { name: "Blue", background: "#dbeafe", foreground: "#1e3a8a" },
  { name: "Orange", background: "#ffedd5", foreground: "#7c2d12" },
  { name: "Purple", background: "#ede9fe", foreground: "#4c1d95" },
  { name: "Teal", background: "#ccfbf1", foreground: "#134e4a" },
  { name: "Rose", background: "#ffe4e6", foreground: "#881337" },
  { name: "Yellow", background: "#fef9c3", foreground: "#713f12" },
  { name: "Cyan", background: "#cffafe", foreground: "#164e63" },
  { name: "Pink", background: "#fae8ff", foreground: "#701a75" },
];

const DECRYPTO_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Work with your team to avoid 2 miscommunications and score 2 intercepts before the other team.</p>

  <h3>Setup</h3>
  <ul>
    <li>Players split into White and Black teams.</li>
    <li>Each team gets 4 secret keywords.</li>
    <li>Each player has a fixed seat color. Player badges and clue backgrounds use that color to identify the clue's author, not its keyword number.</li>
    <li>Your four keywords appear in a shared-width strip below the team summaries. On phones, the pencil (✎) beside a player's name identifies the Encryptor.</li>
  </ul>

  <h3>Round Flow</h3>
  <ol>
    <li><strong>Encryption</strong>: the encryptor sees a 3-digit code (numbers 1-4) and writes 3 clues for their team.</li>
    <li><strong>Guessing</strong>: teammates submit a decrypt guess for the code.</li>
    <li><strong>Intercept</strong>: from round 2 onward, the opposing team may guess your code.</li>
    <li><strong>Round results</strong>: a review dialog opens automatically with each team's decrypt and intercept results. Every player chooses Next Round before encryptors rotate. Bots confirm automatically.</li>
  </ol>

  <h3>Scoring</h3>
  <ul>
    <li>If your team decrypt guess is wrong, you gain 1 miscommunication.</li>
    <li>If the other team intercepts your code, they gain 1 intercept.</li>
    <li>Two intercepts wins; two miscommunications loses.</li>
    <li>If both teams reach the limit in the same round, the game is a draw.</li>
    <li>If neither team wins by the final round, the game is a draw.</li>
  </ul>

  <h3>History &amp; Results</h3>
  <ul>
    <li>History groups revealed clues under keyword numbers 1–4. Hover over a colored clue, or tap it on a phone, to see its author and round.</li>
    <li>Intercept choices show a number and a short preview of that number's latest public clues, limited to 10 characters. Opponent keywords stay secret.</li>
    <li>History stays on the game board while writing clues or guessing, including on phones. Long histories scroll inside their own panel.</li>
    <li>Last Round is grouped by the team making the guess: Decrypt targets its own clues; Intercept targets the opposing team's clues.</li>
    <li>Correct order and Submitted order show the same three positions. Only your team's keywords can appear. Opponent keywords are never shown, including in the final review; only their public clues and numbers appear.</li>
    <li>Close or Esc dismisses the review without confirming. Use the right-edge Review tab to reopen Last Round Review. The round stays paused until all players confirm.</li>
    <li>Correct (✓, green) and Wrong (✗, red) mark each submitted position and the overall result. Intercepts (🎯) reach 2 to win; Miscommunications (⚠) reach 2 to lose.</li>
  </ul>
`;

const DECRYPTO_BUTTON_EXPLANATIONS = {
  decryptoSubmitCluesBtn: {
    name: "Submit Clues",
    description: "Send your 3 clues for the current code (encryptor only).",
  },
  decryptoSubmitDecryptBtn: {
    name: "Submit Decrypt",
    description: "Submit your team's guess of the code order (non-encryptor only).",
  },
  decryptoSubmitInterceptBtn: {
    name: "Submit Intercept",
    description: "Guess the opponent's code order from round 2. Each number includes up to 10 characters of recent public history, never a hidden keyword. Use three distinct numbers.",
  },
  decryptoNextRoundBtn: {
    name: "Next Round",
    description: "Confirm that you have reviewed the round results. The next round begins only after every player confirms; bots confirm automatically.",
  },
  decryptoReviewBtn: {
    name: "Last Round Review",
    description: "The right-edge Review tab reopens the latest round's results. Each team's own decrypt and its intercept of the opponent are listed separately. Opponent keywords are never displayed. Closing the dialog does not confirm readiness.",
  },
};

const DECRYPTO_AREA_EXPLANATIONS = {
  teams: {
    name: "Teams & Player Colors",
    description: "Each player keeps a distinct seat color; their clues use the same background. The pencil (✎) identifies the Encryptor on phones. Intercepts (🎯): 2 wins. Miscommunications (⚠): 2 loses. The full-width keyword strip belongs to your team; opponent keywords remain hidden.",
  },
  history: {
    name: "Clue History",
    description: "Each column is a keyword number. Every colored clue was revealed for that number in an earlier completed round. Hover or tap a clue to identify its author and round.",
  },
  decrypt: {
    name: "Decrypt Your Team",
    description: "Match your own encryptor's three clues to your team's keyword numbers, in order. Only a non-encryptor can submit the team's decrypt guess.",
  },
  intercept: {
    name: "Intercept the Opponent",
    description: "Match the opponent's three clues to their keyword numbers. The dropdowns show shortened public history for each number. A correct full sequence earns your team one intercept (🎯).",
  },
  results: {
    name: "Round Results",
    description: "Each team has its own table. Decrypt is that team's guess of its own clues; Intercept is its guess of the opposing team's clues. Compare Correct order with Submitted order position by position: green ✓ matches, red ✗ differs. Hidden keywords are never disclosed; public clues stand in for them.",
  },
};

const decryptoActionButtons = {
  submit_clues: decryptoSubmitCluesBtn,
  submit_decrypt: decryptoSubmitDecryptBtn,
  submit_intercept: decryptoSubmitInterceptBtn,
  next_round: decryptoNextRoundBtn,
};

function getDecryptoPlayerColor(view, authorId) {
  const players = [...(view.players || [])].sort((first, second) => (first.seat ?? 0) - (second.seat ?? 0));
  const index = players.findIndex((player) => player.player_id === authorId);
  return index < 0 ? null : DECRYPTO_PLAYER_COLORS[index % DECRYPTO_PLAYER_COLORS.length];
}

function setDecryptoPlayerColor(element, view, authorId) {
  const color = getDecryptoPlayerColor(view, authorId);
  if (color) {
    element.style.setProperty("--decrypto-player-bg", color.background);
    element.style.setProperty("--decrypto-player-fg", color.foreground);
    element.dataset.decryptoPlayer = authorId;
  }
}

function setDecryptoTip(element, message) {
  element.dataset.decryptoTip = message;
  element.tabIndex = 0;
}

function createDecryptoPlayerBadge(view, player, label = "") {
  const badge = document.createElement("span");
  badge.className = "decrypto-player";
  badge.textContent = player.name || player.player_id;
  if (label) {
    const role = document.createElement("span");
    role.className = "decrypto-player-role";
    role.textContent = ` · ${label}`;
    badge.appendChild(role);
    badge.classList.toggle("decrypto-encryptor", label === "Encryptor");
    badge.setAttribute("aria-label", `${player.name || player.player_id} · ${label}`);
  }
  setDecryptoPlayerColor(badge, view, player.player_id);
  const color = getDecryptoPlayerColor(view, player.player_id);
  setDecryptoTip(badge, `${player.name || player.player_id}${color ? ` · ${color.name}` : ""}${label ? ` · ${label}` : ""}`);
  return badge;
}

function getDecryptoHistoryEntries(team) {
  const mapping = { 1: [], 2: [], 3: [], 4: [] };
  (team?.history || []).forEach((entry) => {
    const players = team.players || [];
    const author = entry.clues_by || entry.encryptor_id || players[(entry.round - 1) % players.length]?.player_id;
    (entry.code || []).forEach((number, index) => {
      const clue = entry.clues?.[index];
      if (mapping[number] && typeof clue === "string" && clue.trim()) {
        mapping[number].push({ clue: clue.trim(), author, round: entry.round });
      }
    });
  });
  Object.keys(mapping).forEach((number) => {
    if (!mapping[number].length) {
      mapping[number] = (team?.history_by_keyword?.[number] || [])
        .filter((clue) => typeof clue === "string" && clue.trim())
        .map((clue) => ({ clue: clue.trim(), author: null, round: null }));
    }
  });
  return mapping;
}

function trimDecryptoPreview(text) {
  const characters = Array.from(text.trim().replace(/\s+/g, " "));
  return characters.length > 10 ? `${characters.slice(0, 9).join("")}…` : characters.join("");
}

function getDecryptoTeamKeywords(view, teamId) {
  return teamId && teamId === view.team_id ? view.teams?.[teamId]?.keywords : null;
}

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
  setDecryptoReviewOpen(false);
  hideDecryptoTooltip();
  decryptoReviewBtn.classList.add("hidden");
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

function updateDecryptoGuessSelectLabels(selects, keywords, history = null) {
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
      if (history) {
        const clues = [...new Set((history[index] || []).map((entry) => entry.clue).reverse())].slice(0, 3);
        const preview = clues.join(" / ");
        option.textContent = preview ? `${index}. ${trimDecryptoPreview(preview)}` : `${index}`;
        option.title = preview ? `${index}. ${preview}` : `${index}. No revealed clues yet`;
      } else if (word) {
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
      const opponent = view.teams[getDecryptoOpponentTeam(teamId)];
      if (view.round > 1 && opponent && !opponent.intercept_submitted) {
        pending.push(`${labelForTeam(teamId)} intercept guess`);
      }
    });
  }
  return pending;
}

function getDecryptoActionLines(view) {
  const actions = Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const lines = [];
  if (actions.includes("next_round")) {
    lines.push("Review the results, then choose Next Round.");
  }
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
      lines.push("Decrypt your team's clues.");
    }
  }
  if (actions.includes("submit_intercept")) {
    const guess = getDecryptoGuessFromSelects(decryptoInterceptSelects);
    if (guess) {
      lines.push("Submit an intercept guess for the opponent.");
    } else {
      lines.push("Intercept the opponent's clues.");
    }
  }
  return lines;
}

function updateDecryptoStatus() {
  if (!decryptoStatus || !decryptoStatusBody) {
    return;
  }
  if (currentGameType !== "decrypto" || !currentDecryptoView) {
    document.body.classList.remove("decrypto-needs-action");
    setDecryptoStatusLines(["-"]);
    decryptoStatus.classList.add("waiting");
    return;
  }
  const view = currentDecryptoView;
  document.body.classList.toggle("decrypto-needs-action", !!view.legal_actions?.length && !view.game_over);
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

  if (view.phase === "round_end" && !view.legal_actions?.includes("next_round")) {
    setDecryptoStatusLines([view.team_id ? "Ready. Waiting for the other players." : "Teams are reviewing the round results."]);
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
    wrapper.className = `decrypto-team${teamId === view.team_id ? " decrypto-own-team" : ""}`;

    const header = document.createElement("div");
    header.className = "decrypto-team-header";
    header.textContent = `${formatDecryptoTeamLabel(teamId)} Team${teamId === view.team_id ? " · You" : ""}`;
    wrapper.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "decrypto-team-meta";
    [["🎯", team.intercepts, "Intercepts: reach 2 to win"], ["⚠", team.miscommunications, "Miscommunications: reach 2 to lose"]].forEach(([symbol, count, tip]) => {
      const token = document.createElement("span");
      token.textContent = `${symbol} ${count}/2`;
      setDecryptoTip(token, tip);
      meta.appendChild(token);
    });
    wrapper.appendChild(meta);

    const playersLine = document.createElement("div");
    playersLine.className = "decrypto-player-list";
    (team.players || []).forEach((player) => {
      playersLine.appendChild(createDecryptoPlayerBadge(view, player, player.player_id === team.encryptor_id ? "Encryptor" : ""));
    });
    wrapper.appendChild(playersLine);

    const opponent = view.teams[getDecryptoOpponentTeam(teamId)];
    const interceptStatus = view.round > 1 ? (opponent?.intercept_submitted ? "done" : "pending") : "round 2+";
    const statusLine = document.createElement("div");
    statusLine.className = "decrypto-team-progress";
    statusLine.textContent = `Clues: ${team.clues_submitted ? "done" : "pending"} · Decrypt: ${
      team.decrypt_submitted ? "done" : "pending"
    } | Intercept: ${interceptStatus}`;
    wrapper.appendChild(statusLine);

    decryptoTeams.appendChild(wrapper);
  });
  const keywords = getDecryptoTeamKeywords(view, view.team_id);
  if (keywords?.length) {
    const keywordRow = document.createElement("div");
    keywordRow.className = "decrypto-keywords";
    keywordRow.setAttribute("role", "group");
    keywordRow.setAttribute("aria-label", `Your ${formatDecryptoTeamLabel(view.team_id)} team keywords`);
    keywords.forEach((word, index) => {
      const item = document.createElement("div");
      item.className = "decrypto-keyword";
      item.textContent = `${index + 1}. ${word}`;
      keywordRow.appendChild(item);
    });
    decryptoTeams.appendChild(keywordRow);
  }
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
    row.className = "decrypto-current-team";
    const label = document.createElement("strong");
    label.textContent = `${formatDecryptoTeamLabel(teamId)}: `;
    row.appendChild(label);

    const clues = team.current_clues;
    if (Array.isArray(clues) && clues.length) {
      clues.forEach((clue, index) => {
        const item = document.createElement("span");
        item.className = "decrypto-history-clue";
        item.textContent = `${index + 1}. ${clue}`;
        setDecryptoPlayerColor(item, view, team.encryptor_id);
        setDecryptoTip(item, `Clue ${index + 1} · ${findPlayerName(view, team.encryptor_id)} · Round ${view.round}`);
        row.appendChild(item);
      });
    } else {
      row.appendChild(document.createTextNode(team.clues_submitted ? "Clues submitted; waiting for both teams." : "Waiting for clues."));
    }
    decryptoCurrentClues.appendChild(row);
  });
}

function renderDecryptoHistory(view) {
  if (!decryptoHistory) {
    return;
  }
  const scrollTop = decryptoHistory.scrollTop;
  decryptoHistory.innerHTML = "";
  ["white", "black"].forEach((teamId) => {
    const team = view.teams ? view.teams[teamId] : null;
    if (!team) {
      return;
    }
    const section = document.createElement("div");
    section.className = "decrypto-history-team";

    const heading = document.createElement("div");
    heading.className = "decrypto-history-heading";
    const header = document.createElement("div");
    header.className = "decrypto-team-header";
    header.textContent = `${formatDecryptoTeamLabel(teamId)} History`;
    heading.appendChild(header);
    const legend = document.createElement("div");
    legend.className = "decrypto-player-list";
    (team.players || []).forEach((player) => legend.appendChild(createDecryptoPlayerBadge(view, player)));
    heading.appendChild(legend);
    section.appendChild(heading);

    const table = document.createElement("table");
    table.className = "decrypto-history-table";
    table.setAttribute("aria-label", `${formatDecryptoTeamLabel(teamId)} clue history by keyword`);
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const keywords = getDecryptoTeamKeywords(view, teamId);
    for (let index = 1; index <= 4; index += 1) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = `${index}`;
      setDecryptoTip(th, `Keyword ${index}${keywords?.[index - 1] ? `: ${keywords[index - 1]}` : " · Hidden"}`);
      headRow.appendChild(th);
    }
    head.appendChild(headRow);
    table.appendChild(head);

    const history = getDecryptoHistoryEntries(team);
    const body = document.createElement("tbody");
    const dataRow = document.createElement("tr");
    for (let index = 1; index <= 4; index += 1) {
      const td = document.createElement("td");
      const items = history[index];
      if (items.length) {
        items.forEach((entry) => {
          const clue = document.createElement("span");
          clue.className = "decrypto-history-clue";
          clue.textContent = entry.clue;
          setDecryptoPlayerColor(clue, view, entry.author);
          setDecryptoTip(clue, `${entry.clue} · ${entry.author ? findPlayerName(view, entry.author) : "Unknown author"}${entry.round ? ` · Round ${entry.round}` : ""}`);
          td.appendChild(clue);
        });
      } else {
        td.textContent = "-";
      }
      dataRow.appendChild(td);
    }
    body.appendChild(dataRow);
    table.appendChild(body);
    section.appendChild(table);
    decryptoHistory.appendChild(section);
  });
  decryptoHistory.scrollTop = scrollTop;
}

function createDecryptoSequence(view, targetId, info, sequence, submitted = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "decrypto-sequence";
  const order = document.createElement("strong");
  order.className = "decrypto-sequence-code";
  order.textContent = Array.isArray(sequence) ? sequence.join(" → ") : "Not submitted";
  wrapper.appendChild(order);
  if (!Array.isArray(sequence)) {
    return wrapper;
  }
  const team = view.teams[targetId];
  const history = getDecryptoHistoryEntries(team);
  sequence.forEach((number, index) => {
    const correct = info.code?.[index] === number;
    const item = document.createElement("div");
    item.className = `decrypto-sequence-item${submitted ? (correct ? " is-correct" : " is-wrong") : ""}`;
    const digit = document.createElement("span");
    digit.className = "decrypto-sequence-digit";
    digit.textContent = `${number}${submitted ? (correct ? " ✓" : " ✗") : ""}`;
    item.appendChild(digit);
    const words = document.createElement("div");
    const keyword = getDecryptoTeamKeywords(view, targetId)?.[number - 1];
    const clueIndex = info.code?.indexOf(number) ?? -1;
    const clue = clueIndex >= 0 ? info.clues?.[clueIndex] : history[number]?.at(-1)?.clue;
    const word = document.createElement("span");
    word.className = "decrypto-sequence-word";
    word.textContent = keyword || (clue ? `Clue: ${clue}` : "No revealed clue");
    words.appendChild(word);
    if (keyword && clue) {
      const hint = document.createElement("span");
      hint.className = "decrypto-sequence-hint";
      hint.textContent = `Clue: ${clue}`;
      words.appendChild(hint);
    }
    item.appendChild(words);
    const outcome = submitted ? (correct ? "Correct" : `Wrong; expected ${info.code?.[index]}`) : "Correct order";
    const description = `Position ${index + 1}: ${number}, ${word.textContent}. ${outcome}.`;
    item.setAttribute("aria-label", description);
    setDecryptoTip(item, description);
    wrapper.appendChild(item);
  });
  return wrapper;
}

function createDecryptoResultGroup(view, summary, actorId, intercept) {
  const targetId = intercept ? getDecryptoOpponentTeam(actorId) : actorId;
  const info = summary.teams[targetId];
  const guess = intercept ? info.intercept_guess : info.decrypt_guess;
  const correct = intercept ? info.intercept_correct : info.decrypt_correct;
  const available = !intercept || summary.round > 1;
  const group = document.createElement("tbody");
  group.dataset.decryptoAction = intercept ? "intercept" : "decrypt";
  group.dataset.decryptoActorTeam = actorId;
  group.dataset.decryptoTargetTeam = targetId;
  const row = document.createElement("tr");
  const description = document.createElement("th");
  description.scope = "row";
  const heading = document.createElement("strong");
  heading.textContent = intercept ? "Intercept" : "Decrypt";
  description.appendChild(heading);
  const target = document.createElement("span");
  target.className = "decrypto-result-target";
  target.textContent = `${formatDecryptoTeamLabel(actorId)} → ${formatDecryptoTeamLabel(targetId)} (${intercept ? "opponent" : "own clues"})`;
  description.appendChild(target);
  const authorId = intercept ? info.intercept_by : info.decrypt_by;
  if (available && authorId) {
    const author = document.createElement("span");
    author.className = "decrypto-result-author";
    author.textContent = findPlayerName(view, authorId);
    description.appendChild(author);
  }
  const result = document.createElement("span");
  result.className = `decrypto-result-badge${available ? (correct ? " is-correct" : " is-wrong") : ""}`;
  result.textContent = available ? (correct ? "✓ Correct" : "✗ Wrong") : "Round 2+";
  setDecryptoTip(result, available ? `${formatDecryptoTeamLabel(actorId)} team's ${intercept ? "intercept" : "decrypt"}: ${correct ? "all three positions match" : "the submitted order does not match"}.` : "Interception is not available in the first round.");
  description.appendChild(result);
  if (available) {
    const score = document.createElement("span");
    score.className = "decrypto-result-score";
    score.textContent = intercept ? (correct ? "+1 intercept" : "No intercept") : (correct ? "No penalty" : "+1 miscommunication");
    description.appendChild(score);
  }
  row.appendChild(description);
  group.appendChild(row);
  if (available) {
    const actualItems = [...createDecryptoSequence(view, targetId, info, info.code).children];
    const guessItems = [...createDecryptoSequence(view, targetId, info, guess, true).children];
    description.rowSpan = actualItems.length;
    actualItems.forEach((actual, index) => {
      const positionRow = index === 0 ? row : document.createElement("tr");
      const actualCell = document.createElement("td");
      const guessCell = document.createElement("td");
      actualCell.appendChild(actual);
      if (guessItems[index]) guessCell.appendChild(guessItems[index]);
      else guessCell.textContent = "—";
      positionRow.append(actualCell, guessCell);
      if (index > 0) group.appendChild(positionRow);
    });
  } else {
    const actualCell = document.createElement("td");
    const guessCell = document.createElement("td");
    actualCell.textContent = "—";
    guessCell.textContent = "—";
    row.append(actualCell, guessCell);
  }
  return group;
}

function renderDecryptoSummary(view) {
  if (!decryptoSummary || !decryptoSummaryBody) {
    return;
  }
  const summary = view.last_round_summary;
  if (!summary || !summary.teams) {
    setDecryptoReviewOpen(false);
    decryptoReviewBtn.classList.add("hidden");
    decryptoSummaryBody.textContent = "-";
    return;
  }
  decryptoReviewBtn.classList.remove("hidden");
  document.getElementById("decryptoSummaryTitle").textContent = `Last Round Review · ${summary.round}`;
  decryptoReviewBtn.textContent = `Review · ${summary.round}`;
  decryptoReviewBtn.setAttribute("aria-label", `Last Round Review · ${summary.round}`);
  const scrollTop = decryptoSummaryBody.scrollTop;
  decryptoSummaryBody.replaceChildren();
  ["white", "black"].forEach((teamId) => {
    if (!summary.teams[teamId]) {
      return;
    }
    const table = document.createElement("table");
    table.className = `decrypto-result-table${teamId === view.team_id ? " decrypto-own-team" : ""}`;
    const caption = document.createElement("caption");
    caption.textContent = `${formatDecryptoTeamLabel(teamId)} Team${teamId === view.team_id ? " · Your team" : ""}`;
    table.appendChild(caption);
    const head = document.createElement("thead");
    const headings = document.createElement("tr");
    ["Guess / Result", "Correct order", "Submitted order"].forEach((text) => {
      const heading = document.createElement("th");
      heading.scope = "col";
      heading.textContent = text;
      headings.appendChild(heading);
    });
    head.appendChild(headings);
    table.appendChild(head);
    table.appendChild(createDecryptoResultGroup(view, summary, teamId, false));
    table.appendChild(createDecryptoResultGroup(view, summary, teamId, true));
    decryptoSummaryBody.appendChild(table);
  });
  decryptoSummaryBody.scrollTop = scrollTop;
  const showNextRound = view.phase === "round_end";
  document.getElementById("decryptoNextRoundArea").classList.toggle("hidden", !showNextRound);
  const ready = new Set(view.next_round_ready || []);
  const waiting = (view.players || []).filter((player) => !ready.has(player.player_id));
  document.getElementById("decryptoReadyStatus").textContent = `${ready.size}/${view.players?.length || 0} ready${waiting.length ? ` · Waiting: ${waiting.map((player) => player.name || player.player_id).join(", ")}` : ""}`;
  decryptoNextRoundBtn.textContent = ready.has(view.you) ? "Ready" : "Next Round";
  decryptoNextRoundBtn.classList.toggle("hidden", !view.team_id);
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
    decryptoPhaseLabel.textContent = { encryption: "Encryption", guessing: "Guessing", round_end: "Round Results", game_over: "Game Over" }[view.phase] || "-";
  }
  if (decryptoRoundLabel) {
    decryptoRoundLabel.textContent = view.round ?? "-";
  }
  if (decryptoMaxRoundsLabel) {
    decryptoMaxRoundsLabel.textContent = view.max_rounds ?? "-";
  }
  if (decryptoWinnerLabel) {
    document.getElementById("decryptoWinnerRow").classList.toggle("hidden", !view.winner);
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
    document.getElementById("decryptoCurrentCodeRow").classList.toggle("hidden", !view.current_code || view.phase !== "encryption");
  }
  const teamKeywords = getDecryptoTeamKeywords(view, view.team_id);
  const opponentId = getDecryptoOpponentTeam(view.team_id);
  const opponent = view.teams?.[opponentId];
  updateDecryptoClueCodeLabels(view.current_code, teamKeywords);
  updateDecryptoGuessClues(view);
  updateDecryptoGuessSelectLabels(decryptoDecryptSelects, teamKeywords);
  updateDecryptoGuessSelectLabels(decryptoInterceptSelects, null, getDecryptoHistoryEntries(opponent));
  updateDecryptoGuessSelectOptions(decryptoDecryptSelects);
  updateDecryptoGuessSelectOptions(decryptoInterceptSelects);

  if (decryptoEncryptionArea) {
    decryptoEncryptionArea.classList.toggle("hidden", view.phase !== "encryption" || !view.is_encryptor);
  }
  if (decryptoGuessArea) {
    decryptoGuessArea.classList.toggle("hidden", view.phase !== "guessing" || !view.team_id);
  }
  document.getElementById("decryptoDecryptArea").classList.toggle("hidden", !!view.is_encryptor);
  document.getElementById("decryptoInterceptArea").classList.toggle("hidden", view.round < 2);
  [decryptoClue1, decryptoClue2, decryptoClue3].forEach((input) => {
    input.disabled = !view.legal_actions?.includes("submit_clues");
  });
  [[decryptoDecryptSelects, "submit_decrypt"], [decryptoInterceptSelects, "submit_intercept"]].forEach(([selects, action]) => {
    const submitted = action === "submit_decrypt" ? view.teams?.[view.team_id]?.decrypt_guess : opponent?.intercept_guess;
    selects.forEach((select, index) => {
      select.disabled = !view.legal_actions?.includes(action);
      if (submitted) select.value = String(submitted[index]);
    });
    updateDecryptoGuessSelectOptions(selects);
  });
  if (previousView?.last_round_summary?.round !== view.last_round_summary?.round) {
    decryptoSummaryBody.scrollTop = 0;
  }

  renderDecryptoTeams(view);
  renderDecryptoCurrentClues(view);
  renderDecryptoHistory(view);
  renderDecryptoSummary(view);
  if (!previousView || previousView.phase !== view.phase || roundChanged || newGameStarted) {
    setDecryptoReviewOpen(view.phase === "round_end" || !!view.game_over);
  }

  logGameEvents(data);
  updateDecryptoActionButtons();
}

decryptoNextRoundBtn?.addEventListener("click", () => {
  if (isDecryptoActionAvailable("next_round")) sendAction({ type: "next_round" });
});

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

let decryptoExplainMode = false;
let decryptoExplainPress = null;
let decryptoSuppressExplainClick = false;
let decryptoTooltipTimer = null;
let decryptoTooltipTarget = null;
let decryptoTipPress = null;
const decryptoModalFocus = new Map();

function setDecryptoModalVisible(modal, visible) {
  if (!modal || modal.classList.contains("hidden") === !visible) return;
  hideDecryptoTooltip();
  if (visible) decryptoModalFocus.set(modal, document.activeElement);
  setModalVisible(modal, visible);
  document.body.classList.toggle("decrypto-dialog-open", [decryptoHelpModal, decryptoExplainModal, decryptoSummary].some((item) => !item.classList.contains("hidden")));
  if (visible) {
    modal.querySelector("button")?.focus({ preventScroll: true });
  } else {
    const previous = decryptoModalFocus.get(modal);
    if (previous?.isConnected && previous.getClientRects().length) previous.focus({ preventScroll: true });
    decryptoModalFocus.delete(modal);
  }
}

function setDecryptoReviewOpen(open) {
  if (open && !currentDecryptoView?.last_round_summary) return;
  if (!open) exitDecryptoExplainMode();
  decryptoReviewBtn.setAttribute("aria-expanded", String(open));
  setDecryptoModalVisible(decryptoSummary, open);
}

function hideDecryptoTooltip() {
  window.clearTimeout(decryptoTooltipTimer);
  decryptoTooltipTarget?.removeAttribute("aria-describedby");
  decryptoTooltipTarget = null;
  decryptoTooltip.classList.add("hidden");
}

function showDecryptoTooltip(target) {
  if (decryptoExplainMode || !target?.dataset.decryptoTip || target.closest("button, select, input, summary, label")) return;
  hideDecryptoTooltip();
  decryptoTooltipTarget = target;
  target.setAttribute("aria-describedby", "decryptoTooltip");
  decryptoTooltip.textContent = target.dataset.decryptoTip;
  decryptoTooltip.classList.remove("hidden");
  const anchor = target.getBoundingClientRect();
  const box = decryptoTooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - box.width - 8, anchor.left + (anchor.width - box.width) / 2));
  const top = anchor.top >= box.height + 12 ? anchor.top - box.height - 6 : anchor.bottom + 6;
  decryptoTooltip.style.left = `${left}px`;
  decryptoTooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - box.height - 8, top))}px`;
  decryptoTooltipTimer = window.setTimeout(hideDecryptoTooltip, 3000);
}

function showDecryptoHeaderActions(show) {
  if (decryptoHeaderActions) {
    decryptoHeaderActions.style.display = show ? "flex" : "none";
  }
  document.body.classList.toggle("decrypto-active", show);
  if (!show) {
    document.body.classList.remove("decrypto-needs-action");
    exitDecryptoExplainMode();
    closeDecryptoHelpModal();
    closeDecryptoExplainModal();
    setDecryptoReviewOpen(false);
    hideDecryptoTooltip();
  }
}

function showDecryptoHelpModal() {
  if (!decryptoHelpModal) {
    return;
  }
  exitDecryptoExplainMode();
  if (decryptoHelpContent) {
    decryptoHelpContent.innerHTML = DECRYPTO_HELP_TEXT;
  }
  setDecryptoModalVisible(decryptoHelpModal, true);
}

function closeDecryptoHelpModal() {
  if (decryptoHelpModal) {
    setDecryptoModalVisible(decryptoHelpModal, false);
  }
}

function updateDecryptoExplainModeClasses(enabled) {
  Object.keys(DECRYPTO_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
  decryptoPanel.querySelectorAll("[data-decrypto-explain]").forEach((element) => element.classList.toggle("has-explanation", enabled));
}

function findDecryptoButtonAtPoint(clientX, clientY) {
  const modal = [decryptoExplainModal, decryptoHelpModal, decryptoSummary].find((item) => !item.classList.contains("hidden"));
  for (const buttonId of Object.keys(DECRYPTO_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn || (modal && !modal.contains(btn))) continue;
    const rect = btn.getBoundingClientRect();
    if (rect.width && rect.height && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleDecryptoExplainMode() {
  hideDecryptoTooltip();
  decryptoExplainMode = !decryptoExplainMode;
  document.body.classList.toggle("decrypto-explain-mode", decryptoExplainMode);
  updateDecryptoExplainModeClasses(decryptoExplainMode);
  if (decryptoExplainBtn) {
    decryptoExplainBtn.classList.toggle("active", decryptoExplainMode);
    decryptoExplainBtn.setAttribute("aria-pressed", String(decryptoExplainMode));
  }
  decryptoReviewExplainBtn.classList.toggle("active", decryptoExplainMode);
  decryptoReviewExplainBtn.setAttribute("aria-pressed", String(decryptoExplainMode));
}

function exitDecryptoExplainMode() {
  if (!decryptoExplainMode) {
    return;
  }
  decryptoExplainMode = false;
  document.body.classList.remove("decrypto-explain-mode");
  updateDecryptoExplainModeClasses(false);
  if (decryptoExplainBtn) {
    decryptoExplainBtn.classList.remove("active");
    decryptoExplainBtn.setAttribute("aria-pressed", "false");
  }
  decryptoReviewExplainBtn.classList.remove("active");
  decryptoReviewExplainBtn.setAttribute("aria-pressed", "false");
}

function showDecryptoButtonExplanation(buttonId) {
  const explanation = DECRYPTO_BUTTON_EXPLANATIONS[buttonId] || DECRYPTO_AREA_EXPLANATIONS[buttonId];
  if (!explanation || !decryptoExplainContent || !decryptoExplainModal) {
    return;
  }
  const note = explanation.note ? `<div class="hint">${explanation.note}</div>` : "";
  decryptoExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${note}
  `;
  setDecryptoModalVisible(decryptoExplainModal, true);
}

function closeDecryptoExplainModal() {
  if (decryptoExplainModal) {
    setDecryptoModalVisible(decryptoExplainModal, false);
  }
}

if (decryptoHelpBtn) {
  decryptoHelpBtn.addEventListener("click", () => {
    showDecryptoHelpModal();
  });
}

if (decryptoHelpModalCloseBtn) {
  decryptoHelpModalCloseBtn.addEventListener("click", closeDecryptoHelpModal);
}

if (decryptoExplainBtn) {
  decryptoExplainBtn.addEventListener("click", () => {
    toggleDecryptoExplainMode();
  });
}

if (decryptoExplainModalCloseBtn) {
  decryptoExplainModalCloseBtn.addEventListener("click", closeDecryptoExplainModal);
}

function isDecryptoExplainExempt(target) {
  return [decryptoHelpBtn, decryptoExplainBtn, decryptoReviewExplainBtn, decryptoHelpModalCloseBtn, decryptoExplainModalCloseBtn, decryptoReviewCloseBtn].includes(target.closest("button"));
}

function getDecryptoExplainKey(event) {
  const buttonId = findDecryptoButtonAtPoint(event.clientX, event.clientY);
  if (buttonId) return buttonId;
  if (event.target.closest("button")) return null;
  return event.target.closest("[data-decrypto-explain]")?.dataset.decryptoExplain || null;
}

document.addEventListener("pointerdown", (event) => {
  decryptoSuppressExplainClick = false;
  decryptoExplainPress = null;
  if (!decryptoExplainMode || isDecryptoExplainExempt(event.target)) return;
  decryptoExplainPress = { key: getDecryptoExplainKey(event), clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId };
  if (event.target.closest("button, input, select, summary, [data-decrypto-explain]")) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

document.addEventListener("pointerup", (event) => {
  const press = decryptoExplainPress;
  decryptoExplainPress = null;
  if (!decryptoExplainMode || !press || press.pointerId !== event.pointerId) return;
  decryptoSuppressExplainClick = true;
  if (!press.key || press.moved || Math.hypot(event.clientX - press.clientX, event.clientY - press.clientY) > 10) return;
  if (getDecryptoExplainKey(event) !== press.key) return;
  event.preventDefault();
  event.stopPropagation();
  showDecryptoButtonExplanation(press.key);
  exitDecryptoExplainMode();
}, true);

document.addEventListener("pointermove", (event) => {
  [decryptoExplainPress, decryptoTipPress].forEach((press) => {
    if (press && Math.hypot(event.clientX - press.clientX, event.clientY - press.clientY) > 10) press.moved = true;
  });
}, true);

document.addEventListener("pointercancel", () => {
  decryptoExplainPress = null;
  decryptoTipPress = null;
}, true);

document.addEventListener("click", (event) => {
  if (decryptoSuppressExplainClick && event.detail !== 0) {
    decryptoSuppressExplainClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (!decryptoExplainMode || isDecryptoExplainExempt(event.target)) return;
  const target = event.target.closest("button, input, select, summary, [data-decrypto-explain]");
  if (!target) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const key = target.matches("button")
    ? (DECRYPTO_BUTTON_EXPLANATIONS[target.id] ? target.id : null)
    : target.closest("[data-decrypto-explain]")?.dataset.decryptoExplain;
  if (key && event.detail === 0) {
    showDecryptoButtonExplanation(key);
    exitDecryptoExplainMode();
  }
}, true);

document.addEventListener("keydown", (event) => {
  if (currentGameType !== "decrypto") return;
  const modal = [decryptoExplainModal, decryptoHelpModal, decryptoSummary].find((item) => !item.classList.contains("hidden"));
  if (event.key === "Escape") {
    exitDecryptoExplainMode();
    hideDecryptoTooltip();
    if (modal === decryptoSummary) setDecryptoReviewOpen(false);
    else if (modal) setDecryptoModalVisible(modal, false);
    if (modal) event.preventDefault();
  } else if (event.key === "Tab" && modal) {
    const elements = [...modal.querySelectorAll("button:not(:disabled), summary, [tabindex='0']")].filter((element) => element.getClientRects().length);
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      event.preventDefault();
      first?.focus();
    }
  }
});

decryptoReviewBtn.addEventListener("click", () => setDecryptoReviewOpen(true));
decryptoReviewCloseBtn.addEventListener("click", () => setDecryptoReviewOpen(false));
decryptoReviewExplainBtn.addEventListener("click", toggleDecryptoExplainMode);
[decryptoHelpModal, decryptoExplainModal, decryptoSummary].forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target !== modal) return;
    if (modal === decryptoSummary) setDecryptoReviewOpen(false);
    else setDecryptoModalVisible(modal, false);
  });
});

decryptoPanel.addEventListener("pointerover", (event) => {
  if (event.pointerType === "touch") return;
  const target = event.target.closest("[data-decrypto-tip]");
  if (target && !target.contains(event.relatedTarget)) showDecryptoTooltip(target);
});
decryptoPanel.addEventListener("pointerout", (event) => {
  if (event.pointerType !== "touch" && event.target.closest("[data-decrypto-tip]") && !event.target.contains(event.relatedTarget)) hideDecryptoTooltip();
});
decryptoPanel.addEventListener("pointerdown", (event) => {
  decryptoTipPress = { clientX: event.clientX, clientY: event.clientY };
});
decryptoPanel.addEventListener("click", (event) => {
  const press = decryptoTipPress;
  decryptoTipPress = null;
  const target = event.target.closest("[data-decrypto-tip]");
  if (target && (event.detail === 0 || (press && !press.moved && Math.hypot(event.clientX - press.clientX, event.clientY - press.clientY) <= 10))) showDecryptoTooltip(target);
  else hideDecryptoTooltip();
});
decryptoPanel.addEventListener("focusin", (event) => {
  if (!decryptoTipPress) showDecryptoTooltip(event.target);
});
decryptoPanel.addEventListener("focusout", hideDecryptoTooltip);
window.addEventListener("scroll", hideDecryptoTooltip, true);
window.addEventListener("resize", () => {
  hideDecryptoTooltip();
});
