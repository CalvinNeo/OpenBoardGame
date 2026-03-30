
const fangNiaoPanel = document.getElementById("fangNiaoPanel");
const carcassonnePanel = document.getElementById("carcassonnePanel");
const azulPanel = document.getElementById("azulPanel");
const goldRushConfigBox = document.getElementById("goldRushConfigBox");
const goldRushModeRow = document.getElementById("goldRushModeRow");
const goldRushModeSelect = document.getElementById("goldRushModeSelect");
const citadelsConfigBox = document.getElementById("citadelsConfigBox");
const citadelsWinningCitySizeSelect = document.getElementById("citadelsWinningCitySizeSelect");
const texasHoldemConfigBox = document.getElementById("texasHoldemConfigBox");
const texasStartingChipsInput = document.getElementById("texasStartingChipsInput");
const texasSmallBlindInput = document.getElementById("texasSmallBlindInput");
const texasBigBlindInput = document.getElementById("texasBigBlindInput");
const mismatchConfigBox = document.getElementById("mismatchConfigBox");
const mismatchSliderCount = document.getElementById("mismatchSliderCount");
const caboPanel = document.getElementById("caboPanel");
const flip7Panel = document.getElementById("flip7Panel");
const yahtzeePanel = document.getElementById("yahtzeePanel");
const istanbulPanel = document.getElementById("istanbulPanel");
const goldRushPanel = document.getElementById("goldRushPanel");
const incanGoldPanel = document.getElementById("incanGoldPanel");
const ageOfWarPanel = document.getElementById("ageOfWarPanel");
const kobayakawaPanel = document.getElementById("kobayakawaPanel");
const scoutPanel = document.getElementById("scoutPanel");
const manilaPanel = document.getElementById("manilaPanel");
const skullPanel = document.getElementById("skullPanel");
const mismatchPanel = document.getElementById("mismatchPanel");
const coyotePanel = document.getElementById("coyotePanel");
const citadelsPanel = document.getElementById("citadelsPanel");
const tagironPanel = document.getElementById("tagironPanel");
const davinciCodePanel = document.getElementById("davinciCodePanel");
const turingMachinePanel = document.getElementById("turingMachinePanel");
const texasHoldemPanel = document.getElementById("texasHoldemPanel");
const halliPanel = document.getElementById("halliPanel");
const drawGuessPanel = document.getElementById("drawGuessPanel");
const gizmosPanelEl = document.getElementById("gizmosPanel");
const wordDecodePanel = document.getElementById("wordDecodePanel");
const cyberPicturesPanel = document.getElementById("cyberPicturesPanel");
const fakeArtistPanel = document.getElementById("fakeArtistPanel");
const thingsInRingsPanel = document.getElementById("thingsInRingsPanel");
const thingsInRingsConfigBox = document.getElementById("thingsInRingsConfigBox");
const thingsInRingsRingCountRow = document.getElementById("thingsInRingsRingCountRow");
const thingsInRingsRingCountSelect = document.getElementById("thingsInRingsRingCountSelect");
const thingsInRingsRingType1Row = document.getElementById("thingsInRingsRingType1Row");
const thingsInRingsRingType1Select = document.getElementById("thingsInRingsRingType1Select");
const thingsInRingsRingType2Row = document.getElementById("thingsInRingsRingType2Row");
const thingsInRingsRingType2Select = document.getElementById("thingsInRingsRingType2Select");
const thingsInRingsRingType3Row = document.getElementById("thingsInRingsRingType3Row");
const thingsInRingsRingType3Select = document.getElementById("thingsInRingsRingType3Select");

const abracaPanel = document.getElementById("abracaPanel");

const blokusPanel = document.getElementById("blokusPanel");
const wanderingTowersPanel = document.getElementById("wanderingTowersPanel");
const skyePanel = document.getElementById("skyePanel");

function setGamePanelVisibility(gameType) {
  const showCabo = gameType === "cabo";
  const showFlip7 = gameType === "flip7";
  const showYahtzee = gameType === "yahtzee";
  const showIstanbul = gameType === "istanbul";
  const showGoldRush = gameType === "gold_rush";
  const showIncanGold = gameType === "incan_gold";
  const showAgeOfWar = gameType === "age_of_war";
  const showWanderingTowers = gameType === "wandering_towers";
  const showKobayakawa = gameType === "kobayakawa";
  const showScout = gameType === "scout";
  const showManila = gameType === "manila";
  const showSkull = gameType === "skull";
  const showCatInBox = gameType === "cat_in_box";
  const showHanabi = gameType === "hanabi";
  const showGang = gameType === "the_gang";
  const showMismatch = gameType === "perfect_mismatch";
  const showCoyote = gameType === "coyote";
  const showCitadels = gameType === "citadels";
  const showTagiron = gameType === "tagiron";
  const showDaVinciCode = gameType === "davinci_code";
  const showTuringMachine = gameType === "turing_machine";
  const showTexasHoldem = gameType === "texas_holdem";
  const showSixNimmt = gameType === "six_nimmt";
  const showHalli = gameType === "halli_galli";
  const showDecrypto = gameType === "decrypto";
  const showWordDecode = gameType === "word_decode";
  const showDrawGuess = gameType === "draw_guess";
  const showGizmos = gameType === "gizmos";
  const showBlitzSketch = gameType === "blitz_sketch";
  const showFakeArtist = gameType === "fake_artist";
  const showThingsInRings = gameType === "things_in_rings";
  const showCyber = gameType === "cyber_pictures";
  const showAidixit = gameType === "aidixit";
  const showImpression = gameType === "impression_flower";
  const showSplendor = gameType === "splendor";
  const showPokemonSplendor = gameType === "splendor_pokemon";
  const showPointSalad = gameType === "point_salad";
  const showForestShuffle = gameType === "forest_shuffle";
  const showAbraca = gameType === "abraca_what";
  const showTrekking = gameType === "trekking_history";
  const showBlokus = gameType === "blokus";
  const showPatchwork = gameType === "patchwork";
  const showSkye = gameType === "isle_of_skye";
  const showProjectL = gameType === "project_l";
  const showCarcassonne = gameType === "carcassonne";
  const showAzul = gameType === "azul";
  const showFangNiao = gameType === "fang_niao";
  caboPanel.classList.toggle("hidden", !showCabo);
  if (flip7Panel) {
    flip7Panel.classList.toggle("hidden", !showFlip7);
  }
  if (yahtzeePanel) {
    yahtzeePanel.classList.toggle("hidden", !showYahtzee);
  }
  if (istanbulPanel) {
    istanbulPanel.classList.toggle("hidden", !showIstanbul);
  }
  if (typeof showIstanbulHeaderActions === "function") {
    showIstanbulHeaderActions(showIstanbul);
  }
  if (goldRushPanel) {
    goldRushPanel.classList.toggle("hidden", !showGoldRush);
  }
  if (typeof showGoldRushHeaderActions === "function") {
    showGoldRushHeaderActions(showGoldRush);
  }
  if (incanGoldPanel) {
    incanGoldPanel.classList.toggle("hidden", !showIncanGold);
  }
  if (ageOfWarPanel) {
    ageOfWarPanel.classList.toggle("hidden", !showAgeOfWar);
  }
  if (typeof showAgeOfWarHeaderActions === "function") {
    showAgeOfWarHeaderActions(showAgeOfWar);
  }
  if (wanderingTowersPanel) {
    wanderingTowersPanel.classList.toggle("hidden", !showWanderingTowers);
  }
  if (typeof showWanderingTowersHeaderActions === "function") {
    showWanderingTowersHeaderActions(showWanderingTowers);
  }
  if (kobayakawaPanel) {
    kobayakawaPanel.classList.toggle("hidden", !showKobayakawa);
  }
  if (scoutPanel) {
    scoutPanel.classList.toggle("hidden", !showScout);
  }
  if (typeof showScoutHeaderActions === "function") {
    showScoutHeaderActions(showScout);
  }
  if (manilaPanel) {
    manilaPanel.classList.toggle("hidden", !showManila);
  }
  if (typeof showManilaHeaderActions === "function") {
    showManilaHeaderActions(showManila);
  }
  skullPanel.classList.toggle("hidden", !showSkull);
  if (catInBoxPanel) {
    catInBoxPanel.classList.toggle("hidden", !showCatInBox);
  }
  if (typeof showCatInBoxHeaderActions === "function") {
    showCatInBoxHeaderActions(showCatInBox);
  }
  if (hanabiPanel) {
    hanabiPanel.classList.toggle("hidden", !showHanabi);
  }
  if (gangPanel) {
    gangPanel.classList.toggle("hidden", !showGang);
  }
  if (typeof showGangHeaderActions === "function") {
    showGangHeaderActions(showGang);
  }
  if (mismatchPanel) {
    mismatchPanel.classList.toggle("hidden", !showMismatch);
  }
  if (coyotePanel) {
    coyotePanel.classList.toggle("hidden", !showCoyote);
  }
  if (citadelsPanel) {
    citadelsPanel.classList.toggle("hidden", !showCitadels);
  }
  if (typeof showCitadelsHeaderActions === "function") {
    showCitadelsHeaderActions(showCitadels);
  }
  if (tagironPanel) {
    tagironPanel.classList.toggle("hidden", !showTagiron);
  }
  if (typeof showTagironHeaderActions === "function") {
    showTagironHeaderActions(showTagiron);
  }
  if (davinciCodePanel) {
    davinciCodePanel.classList.toggle("hidden", !showDaVinciCode);
  }
  if (typeof showDaVinciCodeHeaderActions === "function") {
    showDaVinciCodeHeaderActions(showDaVinciCode);
  }
  if (turingMachinePanel) {
    turingMachinePanel.classList.toggle("hidden", !showTuringMachine);
  }
  if (typeof showTuringMachineHeaderActions === "function") {
    showTuringMachineHeaderActions(showTuringMachine);
  }
  if (texasHoldemPanel) {
    texasHoldemPanel.classList.toggle("hidden", !showTexasHoldem);
  }
  if (sixNimmtPanel) {
    sixNimmtPanel.classList.toggle("hidden", !showSixNimmt);
  }
  if (halliPanel) {
    halliPanel.classList.toggle("hidden", !showHalli);
  }
  if (decryptoPanel) {
    decryptoPanel.classList.toggle("hidden", !showDecrypto);
  }
  if (typeof showDecryptoHeaderActions === "function") {
    showDecryptoHeaderActions(showDecrypto);
  }
  if (typeof showWordDecodeHeaderActions === "function") {
    showWordDecodeHeaderActions(showWordDecode);
  }
  if (typeof showFakeArtistHeaderActions === "function") {
    showFakeArtistHeaderActions(showFakeArtist);
  }
  if (typeof showThingsInRingsHeaderActions === "function") {
    showThingsInRingsHeaderActions(showThingsInRings);
  }
  if (typeof showPokemonSplendorHeaderActions === "function") {
    showPokemonSplendorHeaderActions(showPokemonSplendor);
  }
  if (typeof showGizmosHeaderActions === "function") {
    showGizmosHeaderActions(showGizmos);
  }
  drawGuessPanel.classList.toggle("hidden", !showDrawGuess);
  if (gizmosPanelEl) {
    gizmosPanelEl.classList.toggle("hidden", !showGizmos);
  }
  if (wordDecodePanel) {
    wordDecodePanel.classList.toggle("hidden", !showWordDecode);
  }
  if (blitzSketchPanel) {
    blitzSketchPanel.classList.toggle("hidden", !showBlitzSketch);
  }
  if (fakeArtistPanel) {
    fakeArtistPanel.classList.toggle("hidden", !showFakeArtist);
  }
  if (thingsInRingsPanel) {
    thingsInRingsPanel.classList.toggle("hidden", !showThingsInRings);
  }
  if (cyberPicturesPanel) {
    cyberPicturesPanel.classList.toggle("hidden", !showCyber);
  }
  if (aidixitPanel) {
    aidixitPanel.classList.toggle("hidden", !showAidixit);
  }
  if (impressionFlowerPanel) {
    impressionFlowerPanel.classList.toggle("hidden", !showImpression);
  }
  if (splendorPanel) {
    splendorPanel.classList.toggle("hidden", !showSplendor);
  }
  if (pokemonSplendorPanel) {
    pokemonSplendorPanel.classList.toggle("hidden", !showPokemonSplendor);
  }
  if (pointSaladPanel) {
    pointSaladPanel.classList.toggle("hidden", !showPointSalad);
  }
  if (typeof showPointSaladHeaderActions === "function") {
    showPointSaladHeaderActions(showPointSalad);
  }
  if (forestShufflePanel) {
    forestShufflePanel.classList.toggle("hidden", !showForestShuffle);
  }
  if (typeof showForestShuffleHeaderActions === "function") {
    showForestShuffleHeaderActions(showForestShuffle);
  }
  if (trekkingPanel) {
    trekkingPanel.classList.toggle("hidden", !showTrekking);
  }
  if (typeof showTrekkingHeaderActions === "function") {
    showTrekkingHeaderActions(showTrekking);
  }
  if (abracaPanel) {
    abracaPanel.classList.toggle("hidden", !showAbraca);
  }
  if (typeof showAbracaHeaderActions === "function") {
    showAbracaHeaderActions(showAbraca);
  }
  if (blokusPanel) {
    blokusPanel.classList.toggle("hidden", !showBlokus);
  }
  if (patchworkPanel) {
    patchworkPanel.classList.toggle("hidden", !showPatchwork);
  }
  if (typeof showPatchworkHeaderActions === "function") {
    showPatchworkHeaderActions(showPatchwork);
  }
  if (skyePanel) {
    skyePanel.classList.toggle("hidden", !showSkye);
  }
  if (typeof showSkyeHeaderActions === "function") {
    showSkyeHeaderActions(showSkye);
  }
  if (projectLPanel) {
    projectLPanel.classList.toggle("hidden", !showProjectL);
  }
  if (typeof showProjectLHeaderActions === "function") {
    showProjectLHeaderActions(showProjectL);
  }
  if (carcassonnePanel) {
    carcassonnePanel.classList.toggle("hidden", !showCarcassonne);
  }
  if (typeof showCarcassonneHeaderActions === "function") {
    showCarcassonneHeaderActions(showCarcassonne);
  }
  if (azulPanel) {
    azulPanel.classList.toggle("hidden", !showAzul);
  }
  if (typeof showAzulHeaderActions === "function") {
    showAzulHeaderActions(showAzul);
  }
  if (fangNiaoPanel) {
    fangNiaoPanel.classList.toggle("hidden", !showFangNiao);
  }
  if (typeof showFangNiaoHeaderActions === "function") {
    showFangNiaoHeaderActions(showFangNiao);
  }
  document.body.classList.toggle("trekking-active", showTrekking);
}

function roomHasBots() {
  return (
    currentRoomState &&
    Array.isArray(currentRoomState.players) &&
    currentRoomState.players.some((player) => player && player.is_bot)
  );
}


function updateGoldRushConfigRow() {
  const showRow = currentRoomState && currentGameType === "gold_rush" && currentRoomState.status === "lobby";
  if (goldRushConfigBox) {
    goldRushConfigBox.classList.toggle("hidden", !showRow);
    goldRushConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (goldRushModeRow) {
    goldRushModeRow.classList.toggle("hidden", !showRow);
    goldRushModeRow.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function updateCitadelsConfigRow() {
  const showRow = currentRoomState && currentGameType === "citadels" && currentRoomState.status === "lobby";
  if (citadelsConfigBox) {
    citadelsConfigBox.classList.toggle("hidden", !showRow);
    citadelsConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
}


function updateTexasHoldemConfigRow() {
  const showRow = currentRoomState && currentGameType === "texas_holdem" && currentRoomState.status === "lobby";
  if (texasHoldemConfigBox) {
    texasHoldemConfigBox.classList.toggle("hidden", !showRow);
    texasHoldemConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function updateMismatchConfigRow() {
  const showRow = currentRoomState && currentGameType === "perfect_mismatch" && currentRoomState.status === "lobby";
  if (mismatchConfigBox) {
    mismatchConfigBox.classList.toggle("hidden", !showRow);
    mismatchConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function updateThingsInRingsConfigRow() {
  const showRow = currentRoomState && currentGameType === "things_in_rings" && currentRoomState.status === "lobby";
  if (thingsInRingsConfigBox) {
    thingsInRingsConfigBox.classList.toggle("hidden", !showRow);
    thingsInRingsConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (thingsInRingsRingCountRow) {
    thingsInRingsRingCountRow.classList.toggle("hidden", !showRow);
    thingsInRingsRingCountRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  const rawCount = thingsInRingsRingCountSelect ? Number.parseInt(thingsInRingsRingCountSelect.value, 10) : 2;
  const ringCount = Number.isInteger(rawCount) ? rawCount : 2;
  const rows = [thingsInRingsRingType1Row, thingsInRingsRingType2Row, thingsInRingsRingType3Row];
  rows.forEach((row, index) => {
    if (!row) {
      return;
    }
    const visible = showRow && index < ringCount;
    row.classList.toggle("hidden", !visible);
    row.setAttribute("aria-hidden", (!visible).toString());
  });
}

function logGameEvents(data) {
  if (!data.events || !data.events.length) {
    return;
  }
  data.events.forEach((evt) => {
    if (evt.type === "bot:action" || evt.type === "player:action") {
      const payload = evt.payload || {};
      const isBot = evt.type === "bot:action";
      const label = isBot ? "Bot" : "Player";
      const name = payload.name || label;
      log(`${label} ${name}: ${JSON.stringify(payload.action)}`);
    } else {
      log(`${evt.type}`);
    }
  });
}

function renderGameState(data) {
  const gameType = data.game_type || (currentRoomState && currentRoomState.game_type);
  if (gameType === "cabo") {
    renderCaboGameState(data);
    return;
  }
  if (gameType === "flip7") {
    renderFlip7GameState(data);
    return;
  }
  if (gameType === "yahtzee") {
    renderYahtzeeGameState(data);
    return;
  }
  if (gameType === "istanbul") {
    renderIstanbulGameState(data);
    return;
  }
  if (gameType === "gold_rush") {
    renderGoldRushGameState(data);
    return;
  }
  if (gameType === "incan_gold") {
    renderIncanGoldGameState(data);
    return;
  }
  if (gameType === "age_of_war") {
    renderAgeOfWarGameState(data);
    return;
  }
  if (gameType === "wandering_towers") {
    renderWanderingTowersGameState(data);
    return;
  }
  if (gameType === "kobayakawa") {
    renderKobayakawaGameState(data);
    return;
  }
  if (gameType === "scout") {
    renderScoutGameState(data);
    return;
  }
  if (gameType === "manila") {
    renderManilaGameState(data);
    return;
  }
  if (gameType === "skull") {
    renderSkullGameState(data);
    return;
  }
  if (gameType === "cat_in_box") {
    renderCatInBoxGameState(data);
    return;
  }
  if (gameType === "hanabi") {
    renderHanabiGameState(data);
    return;
  }
  if (gameType === "the_gang") {
    renderGangGameState(data);
    return;
  }
  if (gameType === "perfect_mismatch") {
    renderMismatchGameState(data);
    return;
  }
  if (gameType === "coyote") {
    renderCoyoteGameState(data);
    return;
  }
  if (gameType === "citadels") {
    renderCitadelsGameState(data);
    return;
  }
  if (gameType === "tagiron") {
    renderTagironGameState(data);
    return;
  }
  if (gameType === "davinci_code") {
    renderDaVinciCodeGameState(data);
    return;
  }
  if (gameType === "turing_machine") {
    renderTuringMachineGameState(data);
    return;
  }
  if (gameType === "texas_holdem") {
    renderTexasHoldemGameState(data);
    return;
  }
  if (gameType === "six_nimmt") {
    renderSixNimmtGameState(data);
    return;
  }
  if (gameType === "halli_galli") {
    renderHalliGameState(data);
    return;
  }
  if (gameType === "aidixit") {
    renderAidixitGameState(data);
    return;
  }
  if (gameType === "decrypto") {
    renderDecryptoGameState(data);
    return;
  }
  if (gameType === "word_decode") {
    renderWordDecodeGameState(data);
    return;
  }
  if (gameType === "draw_guess") {
    renderDrawGuessGameState(data);
    return;
  }
  if (gameType === "gizmos") {
    renderGizmosGameState(data);
    return;
  }
  if (gameType === "blitz_sketch") {
    renderBlitzSketchGameState(data);
    return;
  }
  if (gameType === "fake_artist") {
    renderFakeArtistGameState(data);
    return;
  }
  if (gameType === "things_in_rings") {
    renderThingsInRingsGameState(data);
    return;
  }
  if (gameType === "cyber_pictures") {
    renderCyberPicturesGameState(data);
    return;
  }
  if (gameType === "impression_flower") {
    renderImpressionGameState(data);
    return;
  }
  if (gameType === "abraca_what") {
    renderAbracaGameState(data);
    return;
  }
  if (gameType === "forest_shuffle") {
    renderForestShuffleGameState(data);
    return;
  }
  if (gameType === "blokus") {
    renderBlokusGameState(data);
    return;
  }
  if (gameType === "patchwork") {
    renderPatchworkGameState(data);
    return;
  }
  if (gameType === "isle_of_skye") {
    renderSkyeGameState(data);
    return;
  }
  if (gameType === "project_l") {
    renderProjectLGameState(data);
    return;
  }
  if (gameType === "carcassonne") {
    renderCarcassonneGameState(data);
    return;
  }
  if (gameType === "azul") {
    renderAzulGameState(data);
    return;
  }
  if (gameType === "fang_niao") {
    renderFangNiaoGameState(data);
    return;
  }
  if (gameType === "point_salad") {
    renderPointSaladGameState(data);
    return;
  }
  if (gameType === "trekking_history") {
    renderTrekkingGameState(data);
    return;
  }
  if (gameType === "splendor_pokemon") {
    renderPokemonSplendorGameState(data);
    return;
  }
  if (gameType === "splendor") {
    renderSplendorGameState(data);
  }
}
