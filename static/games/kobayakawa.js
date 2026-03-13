let currentKobayakawaView = null;

const kobayakawaPhaseLabel = document.getElementById("kobayakawaPhase");
const kobayakawaRoundLabel = document.getElementById("kobayakawaRound");
const kobayakawaTurnLabel = document.getElementById("kobayakawaTurn");
const kobayakawaStartLabel = document.getElementById("kobayakawaStartPlayer");
const kobayakawaCardLabel = document.getElementById("kobayakawaCard");
const kobayakawaPotLabel = document.getElementById("kobayakawaPot");
const kobayakawaDeckLabel = document.getElementById("kobayakawaDeck");
const kobayakawaWinnerLabel = document.getElementById("kobayakawaWinner");
const kobayakawaRoundNotice = document.getElementById("kobayakawaRoundNotice");
const kobayakawaRoundNoticeTitle = document.getElementById("kobayakawaRoundNoticeTitle");
const kobayakawaRoundNoticeBody = document.getElementById("kobayakawaRoundNoticeBody");
const kobayakawaRoundNoticeList = document.getElementById("kobayakawaRoundNoticeList");
const kobayakawaHandLabel = document.getElementById("kobayakawaHand");
const kobayakawaDrawnLabel = document.getElementById("kobayakawaDrawn");
const kobayakawaDrawBtn = document.getElementById("kobayakawaDrawBtn");
const kobayakawaReplaceBtn = document.getElementById("kobayakawaReplaceBtn");
const kobayakawaKeepDrawnBtn = document.getElementById("kobayakawaKeepDrawnBtn");
const kobayakawaDiscardDrawnBtn = document.getElementById("kobayakawaDiscardDrawnBtn");
const kobayakawaFightBtn = document.getElementById("kobayakawaFightBtn");
const kobayakawaPassBtn = document.getElementById("kobayakawaPassBtn");
const kobayakawaDiscard = document.getElementById("kobayakawaDiscard");
const kobayakawaPlayers = document.getElementById("kobayakawaPlayers");

const kobayakawaActionButtons = {
  draw_card: kobayakawaDrawBtn,
  replace_kobayakawa: kobayakawaReplaceBtn,
  keep_drawn: kobayakawaKeepDrawnBtn,
  discard_drawn: kobayakawaDiscardDrawnBtn,
  fight: kobayakawaFightBtn,
  pass: kobayakawaPassBtn,
};

function isKobayakawaActionAvailable(actionType) {
  if (!currentKobayakawaView || !Array.isArray(currentKobayakawaView.legal_actions)) {
    return false;
  }
  return currentKobayakawaView.legal_actions.includes(actionType);
}

function updateKobayakawaActionButtons() {
  if (currentGameType !== "kobayakawa") {
    Object.values(kobayakawaActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(kobayakawaActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isKobayakawaActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function clearKobayakawaState() {
  currentKobayakawaView = null;
  if (kobayakawaPhaseLabel) {
    kobayakawaPhaseLabel.textContent = "-";
  }
  if (kobayakawaRoundLabel) {
    kobayakawaRoundLabel.textContent = "-";
  }
  if (kobayakawaTurnLabel) {
    kobayakawaTurnLabel.textContent = "-";
  }
  if (kobayakawaStartLabel) {
    kobayakawaStartLabel.textContent = "-";
  }
  if (kobayakawaCardLabel) {
    kobayakawaCardLabel.textContent = "-";
  }
  if (kobayakawaPotLabel) {
    kobayakawaPotLabel.textContent = "-";
  }
  if (kobayakawaDeckLabel) {
    kobayakawaDeckLabel.textContent = "-";
  }
  if (kobayakawaWinnerLabel) {
    kobayakawaWinnerLabel.textContent = "-";
  }
  if (kobayakawaHandLabel) {
    kobayakawaHandLabel.textContent = "-";
  }
  if (kobayakawaDrawnLabel) {
    kobayakawaDrawnLabel.textContent = "-";
  }
  if (kobayakawaRoundNotice) {
    kobayakawaRoundNotice.classList.add("hidden");
    kobayakawaRoundNotice.setAttribute("aria-hidden", "true");
  }
  if (kobayakawaRoundNoticeTitle) {
    kobayakawaRoundNoticeTitle.textContent = "Last Round";
  }
  if (kobayakawaRoundNoticeBody) {
    kobayakawaRoundNoticeBody.textContent = "-";
  }
  if (kobayakawaRoundNoticeList) {
    kobayakawaRoundNoticeList.innerHTML = "";
  }
  if (kobayakawaDiscard) {
    kobayakawaDiscard.innerHTML = "";
  }
  if (kobayakawaPlayers) {
    kobayakawaPlayers.innerHTML = "";
  }
  updateKobayakawaActionButtons();
}

function formatKobayakawaWinner(view, winner) {
  if (!winner) {
    return "-";
  }
  if (Array.isArray(winner)) {
    if (!winner.length) {
      return "-";
    }
    return winner.map((pid) => findPlayerName(view, pid)).join(", ");
  }
  return findPlayerName(view, winner) || winner;
}

function renderKobayakawaRoundNotice(view) {
  if (!kobayakawaRoundNotice || !kobayakawaRoundNoticeBody || !kobayakawaRoundNoticeTitle) {
    return;
  }
  const summary = view && view.last_round_summary ? view.last_round_summary : null;
  if (!summary || !summary.result) {
    kobayakawaRoundNotice.classList.add("hidden");
    kobayakawaRoundNotice.setAttribute("aria-hidden", "true");
    if (kobayakawaRoundNoticeList) {
      kobayakawaRoundNoticeList.innerHTML = "";
    }
    return;
  }
  kobayakawaRoundNotice.classList.remove("hidden");
  kobayakawaRoundNotice.setAttribute("aria-hidden", "false");
  kobayakawaRoundNoticeTitle.textContent = view.game_over ? "Game Over" : "Last Round";
  const potValue = summary.pot ?? 0;
  let body = "";
  if (summary.result === "all_pass") {
    body = `All players passed · Pot carries ${potValue}`;
  } else if (summary.result === "solo") {
    const winnerName = summary.winner ? findPlayerName(view, summary.winner) : "-";
    body = `Solo win: ${winnerName} · Pot ${potValue}`;
  } else if (summary.result === "showdown") {
    const winnerName = summary.winner ? findPlayerName(view, summary.winner) : "-";
    const bonusName = summary.bonus_holder ? findPlayerName(view, summary.bonus_holder) : "-";
    const bonusValue = summary.kobayakawa ?? "-";
    body = `Winner: ${winnerName} · Bonus: ${bonusName} +${bonusValue} · Pot ${potValue}`;
  } else {
    body = summary.result;
  }
  kobayakawaRoundNoticeBody.textContent = body;
  if (kobayakawaRoundNoticeList) {
    kobayakawaRoundNoticeList.innerHTML = "";
    if (summary.result === "showdown" && Array.isArray(summary.fighters)) {
      summary.fighters.forEach((fighter) => {
        const line = document.createElement("div");
        line.className = "kobayakawa-summary-item";
        if (fighter.player_id === summary.winner) {
          line.classList.add("winner");
        }
        const name = findPlayerName(view, fighter.player_id);
        const hand = fighter.hand ?? "-";
        const finalScore = fighter.final_score ?? "-";
        const bonusTag =
          fighter.got_bonus && summary.kobayakawa !== undefined ? ` +${summary.kobayakawa}` : "";
        line.textContent = `${name}: ${hand}${bonusTag} = ${finalScore}`;
        kobayakawaRoundNoticeList.appendChild(line);
      });
    }
  }
}

function renderKobayakawaDiscard(view) {
  if (!kobayakawaDiscard) {
    return;
  }
  kobayakawaDiscard.innerHTML = "";
  const discard = Array.isArray(view.discard_pile) ? view.discard_pile : [];
  if (!discard.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No cards yet.";
    kobayakawaDiscard.appendChild(empty);
    return;
  }
  discard.forEach((card) => {
    const chip = document.createElement("div");
    chip.className = "kobayakawa-card-chip";
    chip.textContent = String(card);
    kobayakawaDiscard.appendChild(chip);
  });
}

function renderKobayakawaPlayers(view) {
  if (!kobayakawaPlayers) {
    return;
  }
  kobayakawaPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card kobayakawa-player-card";
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id || "-";
    const meta = document.createElement("div");
    meta.className = "kobayakawa-player-meta";
    const tokens = document.createElement("div");
    tokens.textContent = `tokens ${player.tokens ?? 0}`;
    const acted = document.createElement("div");
    acted.textContent = `acted ${player.action_done ? "✅" : "-"}`;
    const bet = document.createElement("div");
    bet.textContent = `bet ${player.bet_choice || "-"}`;
    meta.append(tokens);
    if (view.phase === "action") {
      meta.append(acted);
    } else if (view.phase === "betting") {
      meta.append(bet);
    }
    card.append(name, meta);
    kobayakawaPlayers.appendChild(card);
  });
}

function renderKobayakawaGameState(data) {
  const view = data.view;
  currentKobayakawaView = view;
  if (currentGameType !== "kobayakawa") {
    currentGameType = "kobayakawa";
    setGamePanelVisibility("kobayakawa");
  }

  if (kobayakawaPhaseLabel) {
    kobayakawaPhaseLabel.textContent = view.phase || "-";
  }
  if (kobayakawaRoundLabel) {
    kobayakawaRoundLabel.textContent = view.round ?? "-";
  }
  if (kobayakawaTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    kobayakawaTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (kobayakawaStartLabel) {
    const starter = view.players.find((p) => p.player_id === view.start_player);
    kobayakawaStartLabel.textContent = starter ? starter.name : view.start_player || "-";
  }
  if (kobayakawaCardLabel) {
    kobayakawaCardLabel.textContent = view.kobayakawa ?? "-";
  }
  if (kobayakawaPotLabel) {
    kobayakawaPotLabel.textContent = view.pot ?? 0;
  }
  if (kobayakawaDeckLabel) {
    kobayakawaDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (kobayakawaWinnerLabel) {
    kobayakawaWinnerLabel.textContent = formatKobayakawaWinner(view, view.winner);
  }
  if (kobayakawaHandLabel) {
    kobayakawaHandLabel.textContent = view.your_hand ?? "-";
  }
  if (kobayakawaDrawnLabel) {
    kobayakawaDrawnLabel.textContent = view.your_drawn ?? "-";
  }

  renderKobayakawaRoundNotice(view);
  renderKobayakawaDiscard(view);
  renderKobayakawaPlayers(view);
  logGameEvents(data);
  updateKobayakawaActionButtons();
}

if (kobayakawaDrawBtn) {
  kobayakawaDrawBtn.addEventListener("click", () => {
    sendAction({ type: "draw_card" });
  });
}

if (kobayakawaReplaceBtn) {
  kobayakawaReplaceBtn.addEventListener("click", () => {
    sendAction({ type: "replace_kobayakawa" });
  });
}

if (kobayakawaKeepDrawnBtn) {
  kobayakawaKeepDrawnBtn.addEventListener("click", () => {
    sendAction({ type: "keep_drawn" });
  });
}

if (kobayakawaDiscardDrawnBtn) {
  kobayakawaDiscardDrawnBtn.addEventListener("click", () => {
    sendAction({ type: "discard_drawn" });
  });
}

if (kobayakawaFightBtn) {
  kobayakawaFightBtn.addEventListener("click", () => {
    sendAction({ type: "fight" });
  });
}

if (kobayakawaPassBtn) {
  kobayakawaPassBtn.addEventListener("click", () => {
    sendAction({ type: "pass" });
  });
}
