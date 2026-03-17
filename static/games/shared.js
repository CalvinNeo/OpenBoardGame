function shouldSkipValidation() {
  return !!(skipValidationToggle && skipValidationToggle.checked);
}

function attachSkipValidation(payload) {
  if (skipValidationToggle) {
    payload.skip_validation = shouldSkipValidation();
  }
}

function sendAction(action) {
  if (!roomId) {
    log("Not in a room");
    return;
  }
  const payload = { room_id: roomId, action };
  attachSkipValidation(payload);
  recordActionLog(payload);
  socket.emit("game:action", payload);
}

function emitSeatMove(direction) {
  if (!roomId) {
    log("Not in a room");
    return;
  }
  socket.emit("room:move_seat", { room_id: roomId, direction });
}

function emitRoomStart() {
  if (!roomId) {
    log("Not in a room");
    return;
  }
  const payload = { room_id: roomId };
  attachSkipValidation(payload);
  if (currentGameType === "draw_guess") {
    const language = drawGuessLanguageSelect ? drawGuessLanguageSelect.value || "zh" : "zh";
    const guessMethod = drawGuessGuessMethodSelect ? drawGuessGuessMethodSelect.value || "normal" : "normal";
    const showAnswerLength = drawGuessAnswerLengthToggle ? drawGuessAnswerLengthToggle.checked : false;
    payload.config = { language, guess_method: guessMethod, show_answer_length: showAnswerLength };
  } else if (currentGameType === "cyber_pictures") {
    const allowDuplicates = cyberPicturesDuplicateToggle ? cyberPicturesDuplicateToggle.checked : false;
    const disabledTools = Array.from(cyberPicturesDisabledTools);
    if (disabledTools.length >= CYBER_TOOL_KEYS.length) {
      log("Select at least one tool");
      return;
    }
    payload.config = {
      allow_duplicate_targets: allowDuplicates,
      disabled_tools: disabledTools,
    };
  } else if (currentGameType === "aidixit") {
    const decks = getSelectedAidixitDecks();
    if (!decks.length) {
      log("Select at least one deck");
      return;
    }
    payload.config = { selected_decks: decks };
  } else if (currentGameType === "decrypto") {
    const packs = getSelectedDecryptoPacks();
    if (!packs.length) {
      log("Select at least one word pack");
      return;
    }
    const config = { word_packs: packs };
    if (roomHasBots()) {
      const botStrategy = getSelectedDecryptoBotStrategy();
      const botClueDirectness = getSelectedDecryptoBotClueDirectness();
      config.bot_strategy = botStrategy;
      config.bot_clue_directness = botClueDirectness;
    }
    payload.config = config;
  } else if (currentGameType === "halli_galli") {
    const deckMode = halliDeckSelect ? halliDeckSelect.value || "base" : "base";
    payload.config = { deck_mode: deckMode };
  } else if (currentGameType === "gold_rush") {
    const mode = goldRushModeSelect ? goldRushModeSelect.value || "hand" : "hand";
    payload.config = { mode };
  } else if (currentGameType === "hanabi") {
    const finalRoundCountdown = hanabiFinalRoundToggle ? hanabiFinalRoundToggle.checked : false;
    payload.config = { final_round_countdown: finalRoundCountdown };
  } else if (currentGameType === "texas_holdem") {
    const rawStarting = texasStartingChipsInput ? Number.parseInt(texasStartingChipsInput.value, 10) : NaN;
    const rawSmall = texasSmallBlindInput ? Number.parseInt(texasSmallBlindInput.value, 10) : NaN;
    const rawBig = texasBigBlindInput ? Number.parseInt(texasBigBlindInput.value, 10) : NaN;
    const startingChips = Number.isInteger(rawStarting) && rawStarting > 0 ? rawStarting : 1000;
    const smallBlind = Number.isInteger(rawSmall) && rawSmall > 0 ? rawSmall : 5;
    const bigBlind = Number.isInteger(rawBig) && rawBig > 0 ? rawBig : 10;
    if (smallBlind > bigBlind) {
      log("Small blind must be <= big blind");
      return;
    }
    payload.config = { starting_chips: startingChips, small_blind: smallBlind, big_blind: bigBlind };
  } else if (currentGameType === "perfect_mismatch") {
    const rawCount = mismatchSliderCount ? Number.parseInt(mismatchSliderCount.value, 10) : NaN;
    const sliderCount = Number.isInteger(rawCount) ? rawCount : 3;
    payload.config = { slider_count: sliderCount };
  } else if (currentGameType === "the_gang") {
    const mode = gangModeSelect ? gangModeSelect.value || "normal" : "normal";
    const rawLimit = gangTimeSelect ? Number.parseInt(gangTimeSelect.value, 10) : 0;
    const roundTimeLimit = Number.isInteger(rawLimit) ? rawLimit : 0;
    payload.config = { mode, round_time_limit_sec: roundTimeLimit };
  } else if (currentGameType === "impression_flower") {
    const allowReviewVotes = impressionVoteToggle ? impressionVoteToggle.checked : false;
    payload.config = { allow_review_votes: allowReviewVotes };
  } else if (currentGameType === "blitz_sketch") {
    const rawTime = blitzSketchDrawTimeSelect ? Number.parseFloat(blitzSketchDrawTimeSelect.value) : NaN;
    const drawTime = Number.isFinite(rawTime) && rawTime > 0 ? rawTime : 3;
    payload.config = { draw_time_sec: drawTime };
  }
  socket.emit("room:start", payload);
}

function renderRoomState(state) {
  currentRoomState = state;
  createRoomPending = false;
  setCreateGameRowVisible(false);
  roomId = state.room_id;
  clearPendingSeatClaim(state.room_id);
  const previousGame = currentGameType;
  currentGameType = state.game_type || null;
  roomIdLabel.textContent = state.room_id;
  roomStatus.textContent = state.status;
  gameTypeLabel.textContent = state.game_type || "-";
  updateRoomControlsForStatus(state.status);
  if (previousGame !== currentGameType) {
    clearSelection();
    clearTargetSelection();
    clearSkullSelection();
    clearCaboState();
    clearFlip7State();
    clearYahtzeeState();
    clearIstanbulState();
    clearSkullState();
    clearCatInBoxState();
    clearGangState();
    clearMismatchState();
    clearDecryptoState();
    clearWordDecodeState();
    clearDrawGuessState();
    clearBlitzSketchState();
    clearAidixitState();
    clearImpressionFlowerState();
    clearSplendorState();
    clearPokemonSplendorState();
    clearAbracaState();
    clearBlokusState();
    clearCarcassonneState();
    clearAzulState();
    clearHalliState();
    clearGoldRushState();
    clearIncanGoldState();
    clearHanabiState();
    clearTexasHoldemState();
    clearSixNimmtState();
  }
  setGamePanelVisibility(currentGameType);
  updateDrawGuessLanguageRow();
  updateCyberPicturesConfigRow();
  updateDecryptoPackRow();
  updateDecryptoBotRow();
  updateAidixitDeckRow();
  updateHalliConfigRow();
  updateGoldRushConfigRow();
  updateHanabiConfigRow();
  updateTexasHoldemConfigRow();
  updateMismatchConfigRow();
  updateGangConfigRow();
  updateImpressionConfigRow();
  updateBlitzSketchConfigRow();
  updateAutoSaveRow();
  updateReopenButton();
  playersList.innerHTML = "";
  const orderedPlayers = Array.isArray(state.players)
    ? [...state.players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
    : [];
  orderedPlayers.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const line = document.createElement("div");
    const tags = [];
    if (p.is_bot) tags.push("bot");
    if (p.ready) tags.push("ready");
    if (!p.connected) tags.push("offline");
    if (p.player_id === playerId) tags.push("you");
    line.textContent = `${p.seat + 1}. ${p.name} (${tags.join(", ") || "human"})`;
    row.appendChild(line);
    if (state.status === "lobby" && p.player_id === playerId) {
      const controls = document.createElement("div");
      controls.className = "player-controls";
      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.textContent = "^";
      upBtn.title = "Move up";
      upBtn.disabled = idx === 0;
      upBtn.addEventListener("click", () => emitSeatMove("up"));
      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.textContent = "v";
      downBtn.title = "Move down";
      downBtn.disabled = idx === orderedPlayers.length - 1;
      downBtn.addEventListener("click", () => emitSeatMove("down"));
      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      row.appendChild(controls);
    }
    playersList.appendChild(row);
  });

  if (pendingReadyAfterJoin && pendingReadyRoomId === state.room_id) {
    pendingReadyAfterJoin = false;
    pendingReadyRoomId = null;
    if (state.status === "lobby") {
      const me = playerId ? state.players.find((p) => p.player_id === playerId) : null;
      if (!me || !me.ready) {
        socket.emit("room:ready", { room_id: state.room_id, ready: true });
      }
    }
  }
}

function findPlayerName(view, playerId) {
  const player = view.players.find((p) => p.player_id === playerId);
  return player ? player.name : playerId;
}
