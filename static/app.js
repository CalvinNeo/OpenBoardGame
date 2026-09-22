
const fangNiaoPanel = document.getElementById("fangNiaoPanel");
const arkNovaPanel = document.getElementById("arkNovaPanel");
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
const hotStreakPanel = document.getElementById("hotStreakPanel");
const yahtzeePanel = document.getElementById("yahtzeePanel");
const acquirePanel = document.getElementById("acquirePanel");
const lostCodePanel = document.getElementById("lostCodePanel");
const criminalDancePanel = document.getElementById("criminalDancePanel");
const istanbulPanel = document.getElementById("istanbulPanel");
const goldRushPanel = document.getElementById("goldRushPanel");
const incanGoldPanel = document.getElementById("incanGoldPanel");
const celestiaPanel = document.getElementById("celestiaPanel");
const ageOfWarPanel = document.getElementById("ageOfWarPanel");
const kobayakawaPanel = document.getElementById("kobayakawaPanel");
const highSocietyPanel = document.getElementById("highSocietyPanel");
const poisonPanel = document.getElementById("poisonPanel");
const bohnanzaDicePanel = document.getElementById("bohnanzaDicePanel");
const emeraldSkullsPanel = document.getElementById("emeraldSkullsPanel");
const wriggleRoulettePanel = document.getElementById("wriggleRoulettePanel");
const catanStarfarersPanel = document.getElementById("catanStarfarersPanel");
const bombBustersPanel = document.getElementById("bombBustersPanel");
const takeTimePanel = document.getElementById("takeTimePanel");
const bombBustersConfigBox = document.getElementById("bombBustersConfigBox");
const bombBustersPresetSelect = document.getElementById("bombBustersPresetSelect");
const felixPanel = document.getElementById("felixPanel");
const tactaPanel = document.getElementById("tactaPanel");
const subtextPanel = document.getElementById("subtextPanel");
const tucanoPanel = document.getElementById("tucanoPanel");
const witchsBrewPanel = document.getElementById("witchsBrewPanel");
const raPanel = document.getElementById("raPanel");
const scoutPanel = document.getElementById("scoutPanel");
const manilaPanel = document.getElementById("manilaPanel");
const skullPanel = document.getElementById("skullPanel");
const rebelPrincessPanel = document.getElementById("rebelPrincessPanel");
const mismatchPanel = document.getElementById("mismatchPanel");
const coyotePanel = document.getElementById("coyotePanel");
const inAGrovePanel = document.getElementById("inAGrovePanel");
const citadelsPanel = document.getElementById("citadelsPanel");
const tagironPanel = document.getElementById("tagironPanel");
const davinciCodePanel = document.getElementById("davinciCodePanel");
const turingMachinePanel = document.getElementById("turingMachinePanel");
const kronologicPanel = document.getElementById("kronologicPanel");
const texasHoldemPanel = document.getElementById("texasHoldemPanel");
const halliPanel = document.getElementById("halliPanel");
const drawGuessPanel = document.getElementById("drawGuessPanel");
const gizmosPanelEl = document.getElementById("gizmosPanel");
const centurySpiceRoadPanel = document.getElementById("centurySpiceRoadPanel");
const wordDecodePanel = document.getElementById("wordDecodePanel");
const wavelengthPanel = document.getElementById("wavelengthPanel");
const dumbQuestionsPanel = document.getElementById("dumbQuestionsPanel");
const nineUpperPanel = document.getElementById("nineUpperPanel");
const cyberPicturesPanel = document.getElementById("cyberPicturesPanel");
const fakeArtistPanel = document.getElementById("fakeArtistPanel");
const thingsInRingsPanel = document.getElementById("thingsInRingsPanel");
const guandanPanel = document.getElementById("guandanPanel");
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
  Object.entries(GAME_ASSETS).forEach(([id, assets]) => {
    const visible = id === gameType && isGameAssetsLoaded(id);
    document.getElementById(assets.panel)?.classList.toggle("hidden", !visible);
    if (assets.header && typeof window[assets.header] === "function") {
      window[assets.header](visible);
    }
  });
  document.body.classList.toggle("trekking-active", gameType === "trekking_history");
  syncGameAssetsStatus(gameType);
  if (typeof syncRoomControlsExplainButton === "function") {
    syncRoomControlsExplainButton();
  }
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

function updateBombBustersConfigRow() {
  const showRow = currentRoomState && currentGameType === "bomb_busters" && currentRoomState.status === "lobby";
  if (bombBustersConfigBox) {
    bombBustersConfigBox.classList.toggle("hidden", !showRow);
    bombBustersConfigBox.setAttribute("aria-hidden", (!showRow).toString());
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
  if (!isGameAssetsLoaded(gameType)) {
    // room:state starts the load and replays the latest game:state once ready.
    return;
  }
  if (gameType === "for_sale") {
    renderForSaleGameState(data);
    return;
  }
  if (gameType === "love_letter") {
    renderLoveLetterGameState(data);
    return;
  }
  if (gameType === "terra_nova") {
    renderTerraNovaGameState(data);
    return;
  }
  if (gameType === "spirit_island") {
    renderSpiritIslandGameState(data);
    return;
  }
  if (gameType === "castles_of_burgundy") {
    renderBurgundyGameState(data);
    return;
  }
  if (gameType === "gaia_project") {
    renderGaiaProjectGameState(data);
    return;
  }
  if (gameType === "ark_nova") {
    renderArkNovaGameState(data);
    return;
  }
  if (gameType === "cabo") {
    renderCaboGameState(data);
    return;
  }
  if (gameType === "guandan") {
    renderGuandanGameState(data);
    return;
  }
  if (gameType === "flip7") {
    renderFlip7GameState(data);
    return;
  }
  if (gameType === "hot_streak") {
    renderHotStreakGameState(data);
    return;
  }
  if (gameType === "yahtzee") {
    renderYahtzeeGameState(data);
    return;
  }
  if (gameType === "acquire") {
    renderAcquireGameState(data);
    return;
  }
  if (gameType === "lost_code") {
    renderLostCodeGameState(data);
    return;
  }
  if (gameType === "criminal_dance") {
    renderCriminalDanceGameState(data);
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
  if (gameType === "celestia") {
    renderCelestiaGameState(data);
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
  if (gameType === "high_society") {
    renderHighSocietyGameState(data);
    return;
  }
  if (gameType === "poison") {
    renderPoisonGameState(data);
    return;
  }
  if (gameType === "bohnanza_dice") {
    renderBohnanzaDiceGameState(data);
    return;
  }
  if (gameType === "emerald_skulls") {
    renderEmeraldSkullsGameState(data);
    return;
  }
  if (gameType === "wriggle_roulette") {
    renderWriggleRouletteGameState(data);
    return;
  }
  if (gameType === "catan_starfarers") {
    renderCatanStarfarersGameState(data);
    return;
  }
  if (gameType === "bomb_busters") {
    renderBombBustersGameState(data);
    return;
  }
  if (gameType === "take_time") {
    renderTakeTimeGameState(data);
    return;
  }
  if (gameType === "eternal_decks") {
    renderEternalDecksGameState(data);
    return;
  }
  if (gameType === "ponzi_scheme") {
    renderPonziSchemeGameState(data);
    return;
  }
  if (gameType === "red_doors") {
    renderRedDoorsGameState(data);
    return;
  }
  if (gameType === "cryptid") {
    renderCryptidGameState(data);
    return;
  }
  if (gameType === "boomerang_australia") {
    renderBoomerangAustraliaGameState(data);
    return;
  }
  if (gameType === "felix") {
    renderFelixGameState(data);
    return;
  }
  if (gameType === "tacta") {
    renderTactaGameState(data);
    return;
  }
  if (gameType === "subtext") {
    renderSubtextGameState(data);
    return;
  }
  if (gameType === "tucano") {
    renderTucanoGameState(data);
    return;
  }
  if (gameType === "witchs_brew") {
    renderWitchsBrewGameState(data);
    return;
  }
  if (gameType === "century_spice_road") {
    renderCenturyGameState(data);
    return;
  }
  if (gameType === "ra") {
    renderRaGameState(data);
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
  if (gameType === "rebel_princess") {
    renderRebelPrincessGameState(data);
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
  if (gameType === "in_a_grove") {
    renderInAGroveGameState(data);
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
  if (gameType === "kronologic") {
    renderKronologicGameState(data);
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
  if (gameType === "wavelength") {
    renderWavelengthGameState(data);
    return;
  }
  if (gameType === "dumb_questions") {
    renderDumbQuestionsGameState(data);
    return;
  }
  if (gameType === "nine_upper") {
    renderNineUpperGameState(data);
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
