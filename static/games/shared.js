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
  } else if (currentGameType === "citadels") {
    const rawSize = citadelsWinningCitySizeSelect ? Number.parseInt(citadelsWinningCitySizeSelect.value, 10) : NaN;
    const winningCitySize = rawSize === 7 ? 7 : 8;
    payload.config = { winning_city_size: winningCitySize };
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
  } else if (currentGameType === "fake_artist") {
    const rawRounds = fakeArtistRoundsSelect ? Number.parseInt(fakeArtistRoundsSelect.value, 10) : NaN;
    const rounds = Number.isInteger(rawRounds) && rawRounds > 0 ? rawRounds : 2;
    const rawTime = fakeArtistTurnTimeSelect ? Number.parseInt(fakeArtistTurnTimeSelect.value, 10) : NaN;
    const turnTime = Number.isInteger(rawTime) && rawTime > 0 ? rawTime : 8;
    payload.config = { rounds, turn_time_sec: turnTime };
  } else if (currentGameType === "word_decode") {
    const rawLimit = wordDecodeGuessTimeSelect ? Number.parseInt(wordDecodeGuessTimeSelect.value, 10) : NaN;
    let guessTimeLimitSec = 0;
    if (rawLimit === 60 || rawLimit === 120) {
      guessTimeLimitSec = rawLimit;
    }
    payload.config = { guess_time_limit_sec: guessTimeLimitSec };
  } else if (currentGameType === "things_in_rings") {
    const rawCount = thingsInRingsRingCountSelect ? Number.parseInt(thingsInRingsRingCountSelect.value, 10) : NaN;
    const ringCount = Number.isInteger(rawCount) && rawCount >= 1 && rawCount <= 3 ? rawCount : 2;
    const selects = [thingsInRingsRingType1Select, thingsInRingsRingType2Select, thingsInRingsRingType3Select];
    const ringTypes = selects.slice(0, ringCount).map((select, index) => {
      if (!select || !select.value) {
        return index === 0 ? "word" : index === 1 ? "attribute" : "context";
      }
      return select.value;
    });
    if (new Set(ringTypes).size !== ringTypes.length) {
      log("Ring types must be unique");
      return;
    }
    payload.config = { ring_count: ringCount, ring_types: ringTypes };
  } else if (currentGameType === "turing_machine") {
    const mode = turingMachineModeSelect ? turingMachineModeSelect.value || "simple" : "simple";
    const scenarioSource = turingMachineSourceSelect ? turingMachineSourceSelect.value || "preset" : "preset";
    const difficulty = turingMachineDifficultySelect ? turingMachineDifficultySelect.value || "standard" : "standard";
    const presetId = turingMachinePresetSelect ? turingMachinePresetSelect.value || "relay-standard-01" : "relay-standard-01";
    const seed = turingMachineSeedInput ? (turingMachineSeedInput.value || "").trim() : "";
    payload.config = {
      mode,
      scenario_source: scenarioSource,
      difficulty,
      preset_id: presetId,
      seed,
    };
  } else if (currentGameType === "davinci_code") {
    const mode = davinciCodeModeSelect ? davinciCodeModeSelect.value || "standard" : "standard";
    payload.config = { mode };
  } else if (currentGameType === "lost_code") {
    const mode = lostCodeModeSelect ? lostCodeModeSelect.value || "standard" : "standard";
    const deadlyShortcut = lostCodeShortcutToggle ? lostCodeShortcutToggle.checked : false;
    const curseOfTemple = lostCodeCurseToggle ? lostCodeCurseToggle.checked : false;
    payload.config = {
      mode,
      deadly_shortcut: deadlyShortcut,
      curse_of_temple: curseOfTemple,
    };
  } else if (currentGameType === "criminal_dance") {
    payload.config = {
      enable_boy: criminalDanceBoyToggle ? criminalDanceBoyToggle.checked : true,
      enable_chief: criminalDanceChiefToggle ? criminalDanceChiefToggle.checked : false,
      detective_activation_rule: criminalDanceDetectiveRuleSelect ? criminalDanceDetectiveRuleSelect.value || "hand_leq_3" : "hand_leq_3",
      dog_fail_behavior: criminalDanceDogFailSelect ? criminalDanceDogFailSelect.value || "discard" : "discard",
      boy_visibility_mode: criminalDanceBoyVisibilitySelect ? criminalDanceBoyVisibilitySelect.value || "boy_knows_criminal" : "boy_knows_criminal",
      scoring_enabled: criminalDanceScoringToggle ? criminalDanceScoringToggle.checked : true,
    };
  } else if (currentGameType === "guandan") {
    payload.config = typeof getGuandanRoomConfig === "function" ? getGuandanRoomConfig() : {};
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
    if (typeof clearAcquireState === "function") {
      clearAcquireState();
    }
    if (typeof clearLostCodeState === "function") {
      clearLostCodeState();
    }
    if (typeof clearCriminalDanceState === "function") {
      clearCriminalDanceState();
    }
    clearIstanbulState();
    clearSkullState();
    clearCatInBoxState();
    clearGangState();
    clearMismatchState();
    if (typeof clearCitadelsState === "function") {
      clearCitadelsState();
    }
    clearDecryptoState();
    clearWordDecodeState();
    if (typeof clearWavelengthState === "function") {
      clearWavelengthState();
    }
    if (typeof clearTagironState === "function") {
      clearTagironState();
    }
    if (typeof clearDaVinciCodeState === "function") {
      clearDaVinciCodeState();
    }
    if (typeof clearTuringMachineState === "function") {
      clearTuringMachineState();
    }
    clearDrawGuessState();
    clearBlitzSketchState();
    clearFakeArtistState();
    if (typeof clearThingsInRingsState === "function") {
      clearThingsInRingsState();
    }
    clearAidixitState();
    clearImpressionFlowerState();
    if (typeof clearGizmosState === "function") {
      clearGizmosState();
    }
    clearSplendorState();
    clearPokemonSplendorState();
    if (typeof clearForestShuffleState === "function") {
      clearForestShuffleState();
    }
    clearAbracaState();
    clearBlokusState();
    if (typeof clearSkyeState === "function") {
      clearSkyeState();
    }
    clearCarcassonneState();
    clearAzulState();
    clearHalliState();
    clearGoldRushState();
    clearIncanGoldState();
    clearAgeOfWarState();
    clearWanderingTowersState();
    if (typeof clearRaState === "function") {
      clearRaState();
    }
    if (typeof clearTucanoState === "function") {
      clearTucanoState();
    }
    if (typeof clearWitchsBrewState === "function") {
      clearWitchsBrewState();
    }
    if (typeof clearCenturyState === "function") {
      clearCenturyState();
    }
    clearHanabiState();
    clearTexasHoldemState();
    clearSixNimmtState();
    if (typeof clearManilaState === "function") {
      clearManilaState();
    }
  }
  setGamePanelVisibility(currentGameType);
  updateDrawGuessLanguageRow();
  updateCyberPicturesConfigRow();
  updateDecryptoPackRow();
  updateDecryptoBotRow();
  updateAidixitDeckRow();
  updateHalliConfigRow();
  updateGoldRushConfigRow();
  updateCitadelsConfigRow();
  updateHanabiConfigRow();
  updateTexasHoldemConfigRow();
  updateMismatchConfigRow();
  updateGangConfigRow();
  if (typeof updateWordDecodeConfigRow === "function") {
    updateWordDecodeConfigRow();
  }
  updateImpressionConfigRow();
  updateBlitzSketchConfigRow();
  updateFakeArtistConfigRow();
  updateThingsInRingsConfigRow();
  if (typeof updateTuringMachineConfigRow === "function") {
    updateTuringMachineConfigRow();
  }
  if (typeof updateDavinciCodeConfigRow === "function") {
    updateDavinciCodeConfigRow();
  }
  if (typeof updateLostCodeConfigRow === "function") {
    updateLostCodeConfigRow();
  }
  if (typeof updateCriminalDanceConfigRow === "function") {
    updateCriminalDanceConfigRow();
  }
  if (typeof updateGuandanConfigRow === "function") {
    updateGuandanConfigRow();
  }
  updateAutoSaveRow();
  updateReopenButton();
  playersList.innerHTML = "";
  const orderedPlayers = Array.isArray(state.players)
    ? [...state.players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
    : [];
  const startBtn = document.getElementById("startBtn");
  if (startBtn) {
    let startDisabled = true;
    let startTitle = "";
    if (state.status === "lobby") {
      const gameMeta = Array.isArray(cachedGameList)
        ? cachedGameList.find((entry) => entry && entry.game_id === state.game_type)
        : null;
      const minPlayers = gameMeta && Number.isFinite(gameMeta.min_players) ? gameMeta.min_players : 1;
      const enoughPlayers = orderedPlayers.length >= minPlayers;
      const allReady = orderedPlayers.every((player) => player.is_bot || player.ready);
      startDisabled = !(enoughPlayers && allReady);
      if (!enoughPlayers) {
        startTitle = `Need at least ${minPlayers} players`;
      } else if (!allReady) {
        startTitle = "All players must be ready";
      }
    } else {
      startTitle = "Game already started";
    }
    startBtn.disabled = startDisabled;
    startBtn.title = startTitle;
  }
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
