
const fangNiaoPanel = document.getElementById("fangNiaoPanel");
const fangNiaoPhaseLabel = document.getElementById("fangNiaoPhase");
const fangNiaoTurnLabel = document.getElementById("fangNiaoTurn");
const fangNiaoDeckLabel = document.getElementById("fangNiaoDeck");
const fangNiaoDiscardLabel = document.getElementById("fangNiaoDiscard");
const fangNiaoWinnerLabel = document.getElementById("fangNiaoWinner");
const fangNiaoLastActionLabel = document.getElementById("fangNiaoLastAction");
const fangNiaoRows = document.getElementById("fangNiaoRows");
const fangNiaoHand = document.getElementById("fangNiaoHand");
const fangNiaoSelectedBirdLabel = document.getElementById("fangNiaoSelectedBird");
const fangNiaoSelectedRowLabel = document.getElementById("fangNiaoSelectedRow");
const fangNiaoSelectedSideLabel = document.getElementById("fangNiaoSelectedSide");
const fangNiaoClearSelectionBtn = document.getElementById("fangNiaoClearSelection");
const fangNiaoPlayBtn = document.getElementById("fangNiaoPlayBtn");
const fangNiaoBankBtn = document.getElementById("fangNiaoBankBtn");
const fangNiaoEndBtn = document.getElementById("fangNiaoEndBtn");
const fangNiaoPlayers = document.getElementById("fangNiaoPlayers");
const carcassonnePanel = document.getElementById("carcassonnePanel");
const socket = io();

let playerId = null;
let roomId = null;
let currentCaboView = null;
let currentSkullView = null;
let currentCatInBoxView = null;
let currentMismatchView = null;
let currentCoyoteView = null;
let currentTexasHoldemView = null;
let currentFlip7View = null;
let currentYahtzeeView = null;
let currentGoldRushView = null;
let currentIncanGoldView = null;
let currentKobayakawaView = null;
let currentHalliView = null;
let currentSixNimmtView = null;
let halliCountdownTimer = null;
let halliCountdownState = {
  flipReadyAtMs: 0,
  ringReadyAtMs: 0,
  ringPending: false,
  turnSwitchAtMs: 0,
  flipWaitMs: 0,
};
let halliServerTimeOffsetMs = 0;
let currentPointSaladView = null;
let currentAbracaView = null;
let currentFangNiaoView = null;
let currentGameType = null;
let abracaLastRoundNotice = null;
let selectedSlots = [];
let currentRoomState = null;
let lastGameStatePayload = null;
let actionLog = [];
const ACTION_LOG_MAX = 500;
const ACTION_LOG_TRUNCATE_AT = 500;
let roomControlsGameActive = false;
let roomControlsAutoCollapsed = false;
let selectedTarget = null;
let flip7SelectedTarget = null;
let goldRushSelectedHandIndex = null;
let skullSelectedCardIndex = null;
let skullSelectedCardType = null;
let skullSelectedTarget = null;
let fangNiaoSelectedBird = null;
let fangNiaoSelectedRow = null;
let fangNiaoSelectedSide = null;
let catInBoxSelectedCard = null;
let catInBoxSelectedColor = null;
let pointSaladSelectedPile = null;
let pointSaladSelectedMarket = [];
let pointSaladSelectedFlips = new Set();
const FANG_NIAO_BIRD_META = {
  flamingo: { name: "\u706b\u70c8\u9e1f", emoji: "\ud83e\udda9", color: "#fb7185" },
  owl: { name: "\u732b\u5934\u9e70", emoji: "\ud83e\udd89", color: "#f59e0b" },
  toucan: { name: "\u5927\u5634\u9e1f", emoji: "\ud83e\udd9a", color: "#0ea5e9" },
  duck: { name: "\u9e2d\u5b50", emoji: "\ud83e\udd86", color: "#facc15" },
  pelican: { name: "\u9e48\u9e55", emoji: "\ud83e\udda2", color: "#93c5fd" },
  parrot: { name: "\u9e66\u9e49", emoji: "\ud83e\udd9c", color: "#4ade80" },
  sparrow: { name: "\u9ebb\u96c0", emoji: "\ud83d\udc26", color: "#d1d5db" },
  magpie: { name: "\u559c\u9e4a", emoji: "\ud83e\udeb6", color: "#a3a3a3" },
};
const GOLD_RUSH_COLOR_PALETTE = {
  red: "#d14343",
  brown: "#8b5e34",
  blue: "#2563eb",
  gray: "#6b7280",
  green: "#2f9e44",
  gold: "#d4a017",
};
const GOLD_RUSH_LIGHT_TEXT = "#f9fafb";
const GOLD_RUSH_DARK_TEXT = "#111827";
const INCAN_GOLD_HAZARD_ICONS = {
  snake: "🐍",
  spider: "🕷️",
  fire: "🔥",
  rockfall: "🪨",
  mummy: "🧟",
};
const MEMORIES_SUPPORTED_GAMES = new Set([
  "draw_guess",
  "impression_flower",
  "cyber_pictures",
  "decrypto",
  "blitz_sketch",
  "carcassonne",
]);
let createRoomPending = false;
let pendingReadyAfterJoin = false;
let pendingReadyRoomId = null;
let cachedGameList = null;
let currentRoomList = [];
let pendingSeatClaimRoomId = null;
let pendingSeatClaimSourceId = null;
let sixNimmtCountdownTimer = null;
let sixNimmtServerOffsetMs = 0;
let sixNimmtLastTimeoutAt = null;
let sixNimmtSummaryAckSent = false;
const roomControlsDockQuery = window.matchMedia("(max-width: 900px)");

const nameInput = document.getElementById("nameInput");
const connectionInfo = document.getElementById("connectionInfo");
const roomListEl = document.getElementById("roomList");
const refreshRoomsBtn = document.getElementById("refreshRoomsBtn");
const loadBtn = document.getElementById("loadBtn");
const roomIdLabel = document.getElementById("roomIdLabel");
const roomStatus = document.getElementById("roomStatus");
const gameTypeLabel = document.getElementById("gameTypeLabel");
const playersList = document.getElementById("playersList");
const gameSelect = document.getElementById("gameSelect");
const createBtn = document.getElementById("createBtn");
const createGameRow = document.getElementById("createGameRow");
const leaveBtn = document.getElementById("leaveBtn");
const reopenBtn = document.getElementById("reopenBtn");
const downloadMemoriesBtn = document.getElementById("downloadMemoriesBtn");
const removeBotBtn = document.getElementById("removeBotBtn");
const logoutBtn = document.getElementById("logoutBtn");
const halliConfigBox = document.getElementById("halliConfigBox");
const halliDeckRow = document.getElementById("halliDeckRow");
const halliDeckSelect = document.getElementById("halliDeckSelect");
const goldRushConfigBox = document.getElementById("goldRushConfigBox");
const goldRushModeRow = document.getElementById("goldRushModeRow");
const goldRushModeSelect = document.getElementById("goldRushModeSelect");
const texasHoldemConfigBox = document.getElementById("texasHoldemConfigBox");
const texasStartingChipsInput = document.getElementById("texasStartingChipsInput");
const texasSmallBlindInput = document.getElementById("texasSmallBlindInput");
const texasBigBlindInput = document.getElementById("texasBigBlindInput");
const mismatchConfigBox = document.getElementById("mismatchConfigBox");
const mismatchSliderCount = document.getElementById("mismatchSliderCount");
const autoSaveRow = document.getElementById("autoSaveRow");
const autoSaveToggle = document.getElementById("autoSaveToggle");
const caboPanel = document.getElementById("caboPanel");
const flip7Panel = document.getElementById("flip7Panel");
const yahtzeePanel = document.getElementById("yahtzeePanel");
const goldRushPanel = document.getElementById("goldRushPanel");
const incanGoldPanel = document.getElementById("incanGoldPanel");
const kobayakawaPanel = document.getElementById("kobayakawaPanel");
const skullPanel = document.getElementById("skullPanel");
const catInBoxPanel = document.getElementById("catInBoxPanel");
const mismatchPanel = document.getElementById("mismatchPanel");
const coyotePanel = document.getElementById("coyotePanel");
const texasHoldemPanel = document.getElementById("texasHoldemPanel");
const sixNimmtPanel = document.getElementById("sixNimmtPanel");
const halliPanel = document.getElementById("halliPanel");
const drawGuessPanel = document.getElementById("drawGuessPanel");
const cyberPicturesPanel = document.getElementById("cyberPicturesPanel");

const phaseLabel = document.getElementById("phaseLabel");
const roundLabel = document.getElementById("roundLabel");
const turnLabel = document.getElementById("turnLabel");
const deckCount = document.getElementById("deckCount");
const discardTop = document.getElementById("discardTop");
const lastDrawn = document.getElementById("lastDrawn");
const caboBy = document.getElementById("caboBy");
const caboLeft = document.getElementById("caboLeft");
const pendingChoice = document.getElementById("pendingChoice");

const flip7PhaseLabel = document.getElementById("flip7Phase");
const flip7RoundLabel = document.getElementById("flip7Round");
const flip7TurnLabel = document.getElementById("flip7Turn");
const flip7DeckLabel = document.getElementById("flip7Deck");
const flip7DiscardLabel = document.getElementById("flip7Discard");
const flip7TargetScoreLabel = document.getElementById("flip7TargetScore");
const flip7PendingLabel = document.getElementById("flip7Pending");
const flip7FlipWinnerLabel = document.getElementById("flip7FlipWinner");
const flip7Tableau = document.getElementById("flip7Tableau");
const flip7TargetSelection = document.getElementById("flip7TargetSelection");
const flip7ClearTargetBtn = document.getElementById("flip7ClearTarget");
const flip7Targets = document.getElementById("flip7Targets");
const flip7LastRound = document.getElementById("flip7LastRound");
const flip7Players = document.getElementById("flip7Players");
const flip7FlipBtn = document.getElementById("flip7FlipBtn");
const flip7StayBtn = document.getElementById("flip7StayBtn");

const yahtzeePhaseLabel = document.getElementById("yahtzeePhase");
const yahtzeeRoundLabel = document.getElementById("yahtzeeRound");
const yahtzeeTurnLabel = document.getElementById("yahtzeeTurn");
const yahtzeeRollsLabel = document.getElementById("yahtzeeRolls");
const yahtzeeWinnerLabel = document.getElementById("yahtzeeWinner");
const yahtzeeJokerNotice = document.getElementById("yahtzeeJokerNotice");
const yahtzeeJokerBody = document.getElementById("yahtzeeJokerBody");
const yahtzeeDice = document.getElementById("yahtzeeDice");
const yahtzeeRollBtn = document.getElementById("yahtzeeRollBtn");
const yahtzeeScorecards = document.getElementById("yahtzeeScorecards");

const goldRushPhaseLabel = document.getElementById("goldRushPhase");
const goldRushModeLabel = document.getElementById("goldRushMode");
const goldRushTurnLabel = document.getElementById("goldRushTurn");
const goldRushDeckLabel = document.getElementById("goldRushDeck");
const goldRushWinnerLabel = document.getElementById("goldRushWinner");
const goldRushHand = document.getElementById("goldRushHand");
const goldRushSelectedCardLabel = document.getElementById("goldRushSelectedCard");
const goldRushClearSelectionBtn = document.getElementById("goldRushClearSelection");
const goldRushPlayCardBtn = document.getElementById("goldRushPlayCardBtn");
const goldRushDrawCardBtn = document.getElementById("goldRushDrawCardBtn");
const goldRushInvestYesBtn = document.getElementById("goldRushInvestYesBtn");
const goldRushInvestNoBtn = document.getElementById("goldRushInvestNoBtn");
const goldRushPlayAgainBtn = document.getElementById("goldRushPlayAgainBtn");
const goldRushMines = document.getElementById("goldRushMines");
const goldRushPlayers = document.getElementById("goldRushPlayers");
const goldRushScoreBreakdown = document.getElementById("goldRushScoreBreakdown");

const incanGoldPhaseLabel = document.getElementById("incanGoldPhase");
const incanGoldRoundLabel = document.getElementById("incanGoldRound");
const incanGoldMaxRoundsLabel = document.getElementById("incanGoldMaxRounds");
const incanGoldDeckLabel = document.getElementById("incanGoldDeck");
const incanGoldInCaveLabel = document.getElementById("incanGoldInCave");
const incanGoldDecidedLabel = document.getElementById("incanGoldDecided");
const incanGoldChoiceLabel = document.getElementById("incanGoldChoice");
const incanGoldWinnerLabel = document.getElementById("incanGoldWinner");
const incanGoldRoundNotice = document.getElementById("incanGoldRoundNotice");
const incanGoldRoundNoticeTitle = document.getElementById("incanGoldRoundNoticeTitle");
const incanGoldRoundNoticeBody = document.getElementById("incanGoldRoundNoticeBody");
const incanGoldPath = document.getElementById("incanGoldPath");
const incanGoldPlayers = document.getElementById("incanGoldPlayers");
const incanGoldRemovedHazards = document.getElementById("incanGoldRemovedHazards");
const incanGoldContinueBtn = document.getElementById("incanGoldContinueBtn");
const incanGoldLeaveBtn = document.getElementById("incanGoldLeaveBtn");
const incanGoldNextRoundBtn = document.getElementById("incanGoldNextRoundBtn");
const incanGoldPlayAgainBtn = document.getElementById("incanGoldPlayAgainBtn");

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

const handSlots = document.getElementById("handSlots");
const selectedSlotsLabel = document.getElementById("selectedSlots");
const targetSelection = document.getElementById("targetSelection");
const targetList = document.getElementById("targetList");
const clearTargetBtn = document.getElementById("clearTarget");
const gamePlayers = document.getElementById("gamePlayers");
const logEl = document.getElementById("log");
const logPanel = document.getElementById("logPanel");
const logCloseBtn = document.getElementById("logCloseBtn");
const logOpenBtn = document.getElementById("logOpenBtn");
const skipValidationToggle = document.getElementById("skipValidationToggle");
const copyStateBtn = document.getElementById("copyStateBtn");
const copyActLogBtn = document.getElementById("copyActLogBtn");
const loadModal = document.getElementById("loadModal");
const loadModalCloseBtn = document.getElementById("loadModalCloseBtn");
const loadList = document.getElementById("loadList");
const loadEmpty = document.getElementById("loadEmpty");
const loadAutoSaveToggle = document.getElementById("loadAutoSaveToggle");
const createRoomModal = document.getElementById("createRoomModal");
const createRoomModalCloseBtn = document.getElementById("createRoomModalCloseBtn");
const gameSearchInput = document.getElementById("gameSearchInput");
const playerCountFilter = document.getElementById("playerCountFilter");
const gameListEl = document.getElementById("gameList");
const gameListEmpty = document.getElementById("gameListEmpty");
const seatClaimModal = document.getElementById("seatClaimModal");
const seatClaimCloseBtn = document.getElementById("seatClaimCloseBtn");
const seatClaimNameHint = document.getElementById("seatClaimNameHint");
const seatClaimRoomLabel = document.getElementById("seatClaimRoomLabel");
const seatClaimList = document.getElementById("seatClaimList");
const seatClaimEmpty = document.getElementById("seatClaimEmpty");
const roomControlsPanel = document.getElementById("roomControlsPanel");
const roomControlsToggleBtn = document.getElementById("roomControlsToggleBtn");

const skullPhaseLabel = document.getElementById("skullPhase");
const skullRoundLabel = document.getElementById("skullRound");
const skullTurnLabel = document.getElementById("skullTurn");
const skullBidLabel = document.getElementById("skullBid");
const skullBidderLabel = document.getElementById("skullBidder");
const skullPassedLabel = document.getElementById("skullPassed");
const skullRosesLabel = document.getElementById("skullRoses");
const skullLastRevealLabel = document.getElementById("skullLastReveal");
const skullWinnerLabel = document.getElementById("skullWinner");
const skullHand = document.getElementById("skullHand");
const skullSelectedCardLabel = document.getElementById("skullSelectedCard");
const skullTargetSelection = document.getElementById("skullTargetSelection");
const skullTargets = document.getElementById("skullTargets");
const skullPlayers = document.getElementById("skullPlayers");
const skullBidInput = document.getElementById("skullBidInput");
const skullPlayBtn = document.getElementById("skullPlayBtn");
const skullStartBidBtn = document.getElementById("skullStartBidBtn");
const skullRaiseBidBtn = document.getElementById("skullRaiseBidBtn");
const skullPassBidBtn = document.getElementById("skullPassBidBtn");
const skullRevealBtn = document.getElementById("skullRevealBtn");
const skullClearSelectionBtn = document.getElementById("skullClearSelection");

const catInBoxPhaseLabel = document.getElementById("catInBoxPhase");
const catInBoxRoundLabel = document.getElementById("catInBoxRound");
const catInBoxRoundsTotalLabel = document.getElementById("catInBoxRoundsTotal");
const catInBoxTurnLabel = document.getElementById("catInBoxTurn");
const catInBoxLeadLabel = document.getElementById("catInBoxLead");
const catInBoxTrumpLabel = document.getElementById("catInBoxTrump");
const catInBoxTricksPlayedLabel = document.getElementById("catInBoxTricksPlayed");
const catInBoxParadoxLabel = document.getElementById("catInBoxParadox");
const catInBoxWinnersLabel = document.getElementById("catInBoxWinners");
const catInBoxBoard = document.getElementById("catInBoxBoard");
const catInBoxTrick = document.getElementById("catInBoxTrick");
const catInBoxHand = document.getElementById("catInBoxHand");
const catInBoxSelectedCardLabel = document.getElementById("catInBoxSelectedCard");
const catInBoxSelectedColorLabel = document.getElementById("catInBoxSelectedColor");
const catInBoxClearSelectionBtn = document.getElementById("catInBoxClearSelection");
const catInBoxColorButtons = document.getElementById("catInBoxColorButtons");
const catInBoxDiscardBtn = document.getElementById("catInBoxDiscardBtn");
const catInBoxBid1Btn = document.getElementById("catInBoxBid1Btn");
const catInBoxBid2Btn = document.getElementById("catInBoxBid2Btn");
const catInBoxBid3Btn = document.getElementById("catInBoxBid3Btn");
const catInBoxPlayBtn = document.getElementById("catInBoxPlayBtn");
const catInBoxPlayers = document.getElementById("catInBoxPlayers");
const catInBoxSummary = document.getElementById("catInBoxSummary");
const catInBoxSummaryBody = document.getElementById("catInBoxSummaryBody");

const mismatchPhaseLabel = document.getElementById("mismatchPhase");
const mismatchRoundLabel = document.getElementById("mismatchRound");
const mismatchLeaderLabel = document.getElementById("mismatchLeader");
const mismatchTargetLabel = document.getElementById("mismatchTarget");
const mismatchGuessingLabel = document.getElementById("mismatchGuessing");
const mismatchWinnerLabel = document.getElementById("mismatchWinner");
const mismatchWords = document.getElementById("mismatchWords");
const mismatchYourGuessLabel = document.getElementById("mismatchYourGuess");
const mismatchSliders = document.getElementById("mismatchSliders");
const mismatchRevealBtn = document.getElementById("mismatchRevealBtn");
const mismatchNextRoundBtn = document.getElementById("mismatchNextRoundBtn");
const mismatchPlayAgainBtn = document.getElementById("mismatchPlayAgainBtn");
const mismatchRoundSummary = document.getElementById("mismatchRoundSummary");
const mismatchRoundSummaryBody = document.getElementById("mismatchRoundSummaryBody");
const mismatchRoundSummaryGuesses = document.getElementById("mismatchRoundSummaryGuesses");
const mismatchPlayers = document.getElementById("mismatchPlayers");

const coyotePhaseLabel = document.getElementById("coyotePhase");
const coyoteRoundLabel = document.getElementById("coyoteRound");
const coyoteTurnLabel = document.getElementById("coyoteTurn");
const coyoteBidLabel = document.getElementById("coyoteBid");
const coyoteBidderLabel = document.getElementById("coyoteBidder");
const coyoteWinnerLabel = document.getElementById("coyoteWinner");
const coyoteRoundNotice = document.getElementById("coyoteRoundNotice");
const coyoteRoundNoticeTitle = document.getElementById("coyoteRoundNoticeTitle");
const coyoteRoundNoticeBody = document.getElementById("coyoteRoundNoticeBody");
const coyoteBidInput = document.getElementById("coyoteBidInput");
const coyoteBidMinusBtn = document.getElementById("coyoteBidMinusBtn");
const coyoteBidPlusBtn = document.getElementById("coyoteBidPlusBtn");
const coyoteBidBtn = document.getElementById("coyoteBidBtn");
const coyoteChallengeBtn = document.getElementById("coyoteChallengeBtn");
const coyoteResetBtn = document.getElementById("coyoteResetBtn");
const coyotePlayers = document.getElementById("coyotePlayers");

const texasPhaseLabel = document.getElementById("texasPhase");
const texasHandLabel = document.getElementById("texasHand");
const texasTurnLabel = document.getElementById("texasTurn");
const texasPotLabel = document.getElementById("texasPot");
const texasCurrentBetLabel = document.getElementById("texasCurrentBet");
const texasToCallLabel = document.getElementById("texasToCall");
const texasBlindsLabel = document.getElementById("texasBlinds");
const texasMinBetLabel = document.getElementById("texasMinBet");
const texasMinRaiseToLabel = document.getElementById("texasMinRaiseTo");
const texasMaxRaiseToLabel = document.getElementById("texasMaxRaiseTo");
const texasCommunityCards = document.getElementById("texasCommunityCards");
const texasYourHand = document.getElementById("texasYourHand");
const texasFoldBtn = document.getElementById("texasFoldBtn");
const texasCheckBtn = document.getElementById("texasCheckBtn");
const texasCallBtn = document.getElementById("texasCallBtn");
const texasAllInBtn = document.getElementById("texasAllInBtn");
const texasBetInput = document.getElementById("texasBetInput");
const texasBetBtn = document.getElementById("texasBetBtn");
const texasRaiseBtn = document.getElementById("texasRaiseBtn");
const texasNextHandBtn = document.getElementById("texasNextHandBtn");
const texasRebuyBtn = document.getElementById("texasRebuyBtn");
const texasSummary = document.getElementById("texasSummary");
const texasSummaryBody = document.getElementById("texasSummaryBody");
const texasSummaryList = document.getElementById("texasSummaryList");
const texasPlayers = document.getElementById("texasPlayers");

const sixNimmtPhaseLabel = document.getElementById("sixNimmtPhase");
const sixNimmtRoundLabel = document.getElementById("sixNimmtRound");
const sixNimmtTurnLabel = document.getElementById("sixNimmtTurn");
const sixNimmtTimerLabel = document.getElementById("sixNimmtTimer");
const sixNimmtWaitingLabel = document.getElementById("sixNimmtWaiting");
const sixNimmtSelectedLabel = document.getElementById("sixNimmtSelected");
const sixNimmtWinnersLabel = document.getElementById("sixNimmtWinners");
const sixNimmtNotice = document.getElementById("sixNimmtNotice");
const sixNimmtNoticeBody = document.getElementById("sixNimmtNoticeBody");
const sixNimmtReveal = document.getElementById("sixNimmtReveal");
const sixNimmtRows = document.getElementById("sixNimmtRows");
const sixNimmtHand = document.getElementById("sixNimmtHand");
const sixNimmtPlayers = document.getElementById("sixNimmtPlayers");
const sixNimmtSummaryModal = document.getElementById("sixNimmtSummaryModal");
const sixNimmtSummaryStatus = document.getElementById("sixNimmtSummaryStatus");
const sixNimmtSummaryMeta = document.getElementById("sixNimmtSummaryMeta");
const sixNimmtSummaryList = document.getElementById("sixNimmtSummaryList");
const sixNimmtSummaryCloseBtn = document.getElementById("sixNimmtSummaryCloseBtn");

const halliTurnLabel = document.getElementById("halliTurn");
const halliBellLabel = document.getElementById("halliBell");
const halliWinnerLabel = document.getElementById("halliWinner");
const halliFlipCountdownLabel = document.getElementById("halliFlipCountdown");
const halliRingCountdownLabel = document.getElementById("halliRingCountdown");
const halliLastActionLabel = document.getElementById("halliLastAction");
const halliLastRingLabel = document.getElementById("halliLastRing");
const halliFlipBtn = document.getElementById("halliFlipBtn");
const halliRingBtn = document.getElementById("halliRingBtn");
const halliPlayers = document.getElementById("halliPlayers");
const halliBellCenter = document.getElementById("halliBellCenter");
const halliBellCountdown = document.getElementById("halliBellCountdown");
const halliFruitEmoji = {
  banana: "🍌",
  strawberry: "🍓",
  cherry: "🍒",
  lemon: "🍋",
};


const pointSaladPanel = document.getElementById("pointSaladPanel");
const pointSaladTurnLabel = document.getElementById("pointSaladTurn");
const pointSaladWinnerLabel = document.getElementById("pointSaladWinner");
const pointSaladPiles = document.getElementById("pointSaladPiles");
const pointSaladMarket = document.getElementById("pointSaladMarket");
const pointSaladSelectedPileLabel = document.getElementById("pointSaladSelectedPile");
const pointSaladSelectedVeggiesLabel = document.getElementById("pointSaladSelectedVeggies");
const pointSaladSelectedFlipsLabel = document.getElementById("pointSaladSelectedFlips");
const pointSaladClearSelectionBtn = document.getElementById("pointSaladClearSelectionBtn");
const pointSaladClearFlipsBtn = document.getElementById("pointSaladClearFlipsBtn");
const pointSaladTakePointBtn = document.getElementById("pointSaladTakePointBtn");
const pointSaladTakeVeggiesBtn = document.getElementById("pointSaladTakeVeggiesBtn");
const pointSaladPlayers = document.getElementById("pointSaladPlayers");


const abracaPanel = document.getElementById("abracaPanel");
const abracaPhaseLabel = document.getElementById("abracaPhase");
const abracaRoundLabel = document.getElementById("abracaRound");
const abracaTurnLabel = document.getElementById("abracaTurn");
const abracaDeckLabel = document.getElementById("abracaDeck");
const abracaSecretPoolLabel = document.getElementById("abracaSecretPool");
const abracaDiscardLabel = document.getElementById("abracaDiscard");
const abracaChainMinLabel = document.getElementById("abracaChainMin");
const abracaLastActionLabel = document.getElementById("abracaLastAction");
const abracaRoundResultLabel = document.getElementById("abracaRoundResult");
const abracaRoundNotice = document.getElementById("abracaRoundNotice");
const abracaRoundNoticeTitle = document.getElementById("abracaRoundNoticeTitle");
const abracaRoundNoticeBody = document.getElementById("abracaRoundNoticeBody");
const abracaSpells = document.getElementById("abracaSpells");
const abracaPlayers = document.getElementById("abracaPlayers");
const abracaRollBtn = document.getElementById("abracaRollBtn");
const abracaSecretBtn = document.getElementById("abracaSecretBtn");
const abracaEndTurnBtn = document.getElementById("abracaEndTurnBtn");
const abracaNextRoundBtn = document.getElementById("abracaNextRoundBtn");
const abracaNewGameRow = document.getElementById("abracaNewGameRow");
const abracaNewGameBtn = document.getElementById("abracaNewGameBtn");
const abracaSpellButtonsContainer = document.getElementById("abracaSpellButtons");
const abracaSpellButtons = abracaSpellButtonsContainer
  ? Array.from(abracaSpellButtonsContainer.querySelectorAll("button[data-spell]"))
  : [];

const blokusPanel = document.getElementById("blokusPanel");

const actionButtons = {
  initial_peek: document.getElementById("peekBtn"),
  draw_deck: document.getElementById("drawDeckBtn"),
  draw_discard: discardTop,
  replace_or_match: document.getElementById("replaceBtn"),
  discard_drawn: document.getElementById("discardDrawnBtn"),
  call_cabo: document.getElementById("callCaboBtn"),
  use_choice_action: document.getElementById("choiceBtn"),
  next_round: document.getElementById("nextRoundBtn"),
};

const skullActionButtons = {
  play_card: skullPlayBtn,
  start_bid: skullStartBidBtn,
  raise_bid: skullRaiseBidBtn,
  pass_bid: skullPassBidBtn,
  reveal_card: skullRevealBtn,
};

const coyoteActionButtons = {
  bid: coyoteBidBtn,
  challenge: coyoteChallengeBtn,
};

const halliActionButtons = {
  flip: halliFlipBtn,
  ring: halliRingBtn,
};

const flip7ActionButtons = {
  flip: flip7FlipBtn,
  stay: flip7StayBtn,
};

const incanGoldActionButtons = {
  decide_continue: incanGoldContinueBtn,
  decide_leave: incanGoldLeaveBtn,
  next_round: incanGoldNextRoundBtn,
  play_again: incanGoldPlayAgainBtn,
};

const kobayakawaActionButtons = {
  draw_card: kobayakawaDrawBtn,
  replace_kobayakawa: kobayakawaReplaceBtn,
  keep_drawn: kobayakawaKeepDrawnBtn,
  discard_drawn: kobayakawaDiscardDrawnBtn,
  fight: kobayakawaFightBtn,
  pass: kobayakawaPassBtn,
};

const abracaSpellData = [
  {
    id: 0,
    number: 1,
    name: "Ancient Dragon",
    short: "Dragon",
    desc: "Roll 1-3. Others lose that many HP. Miscast: you lose that many HP.",
    total: 1,
  },
  {
    id: 1,
    number: 2,
    name: "Dark Ghost",
    short: "Ghost",
    desc: "Others -1 HP. You +1 HP (max 6).",
    total: 2,
  },
  {
    id: 2,
    number: 3,
    name: "Sweet Dreams",
    short: "Dream",
    desc: "Roll 1-3. You heal that many HP (max 6).",
    total: 3,
  },
  {
    id: 3,
    number: 4,
    name: "Owl",
    short: "Owl",
    desc: "Draw a secret card. Survive to score +1 per secret.",
    total: 4,
  },
  {
    id: 4,
    number: 5,
    name: "Lightning Storm",
    short: "Lightning",
    desc: "Left and right neighbors -1 HP (2 players: opponent -1 HP).",
    total: 5,
  },
  { id: 5, number: 6, name: "Blizzard", short: "Blizzard", desc: "Left neighbor -1 HP.", total: 6 },
  { id: 6, number: 7, name: "Fireball", short: "Fireball", desc: "Right neighbor -1 HP.", total: 7 },
  { id: 7, number: 8, name: "Magic Potion", short: "Potion", desc: "You +1 HP (max 6).", total: 8 },
];

const ROOM_AUTH_KEY = "openboardgame:room_auth";
const NAME_STORAGE_KEY = "openboardgame:name";

function loadStoredName() {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveStoredName(name) {
  const nextName = typeof name === "string" ? name.trim() : "";
  if (!nextName) {
    clearStoredName();
    return;
  }
  localStorage.setItem(NAME_STORAGE_KEY, nextName);
}

function clearStoredName() {
  localStorage.removeItem(NAME_STORAGE_KEY);
}

function hydrateNameInput() {
  if (!nameInput) {
    return;
  }
  const storedName = loadStoredName();
  if (storedName && !nameInput.value.trim()) {
    nameInput.value = storedName;
  }
}

function loadRoomAuthMap() {
  try {
    const raw = localStorage.getItem(ROOM_AUTH_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveRoomAuthMap(map) {
  localStorage.setItem(ROOM_AUTH_KEY, JSON.stringify(map));
}

function setRoomAuth(roomId, auth) {
  if (!roomId || !auth) {
    return;
  }
  const map = loadRoomAuthMap();
  map[roomId] = auth;
  saveRoomAuthMap(map);
  if (auth.name) {
    saveStoredName(auth.name);
  }
}

function getRoomAuth(roomId) {
  const map = loadRoomAuthMap();
  return map[roomId] || null;
}

function clearRoomAuth(roomId) {
  const map = loadRoomAuthMap();
  if (map[roomId]) {
    delete map[roomId];
    saveRoomAuthMap(map);
  }
}

function clearAllRoomAuth() {
  localStorage.removeItem(ROOM_AUTH_KEY);
}

function log(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = message;
  logEl.prepend(entry);
}

function shouldRedactResource(value) {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  const lowered = trimmed.slice(0, 64).toLowerCase();
  if (lowered.startsWith("data:image/")) {
    return true;
  }
  if (lowered.startsWith("data:") && lowered.includes(";base64,")) {
    return true;
  }
  return false;
}

function redactResources(value) {
  const seen = new WeakMap();
  let picIndex = 0;

  function walk(node) {
    if (typeof node === "string") {
      if (shouldRedactResource(node)) {
        const placeholder = `<pic_${picIndex}>`;
        picIndex += 1;
        return placeholder;
      }
      return node;
    }
    if (!node || typeof node !== "object") {
      return node;
    }
    if (seen.has(node)) {
      return seen.get(node);
    }
    if (Array.isArray(node)) {
      const arr = [];
      seen.set(node, arr);
      node.forEach((item, index) => {
        arr[index] = walk(item);
      });
      return arr;
    }
    const obj = {};
    seen.set(node, obj);
    Object.entries(node).forEach(([key, val]) => {
      obj[key] = walk(val);
    });
    return obj;
  }

  return walk(value);
}

function buildGameStateSnapshot() {
  const meta = {
    generated_at: new Date().toISOString(),
    room_id:
      roomId ||
      (currentRoomState && currentRoomState.room_id) ||
      (lastGameStatePayload && lastGameStatePayload.room_id) ||
      null,
    player_id: playerId || null,
    game_type:
      currentGameType ||
      (currentRoomState && currentRoomState.game_type) ||
      (lastGameStatePayload && lastGameStatePayload.game_type) ||
      null,
    room_status:
      (currentRoomState && currentRoomState.status) ||
      (lastGameStatePayload && lastGameStatePayload.room_status) ||
      null,
    state_version: lastGameStatePayload ? lastGameStatePayload.state_version : null,
    skip_validation: shouldSkipValidation(),
  };

  const snapshot = {
    meta,
    room_state: currentRoomState,
    game_state: lastGameStatePayload,
  };

  return redactResources(snapshot);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fall back to execCommand below.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  let success = false;
  try {
    success = document.execCommand("copy");
  } catch (error) {
    success = false;
  }
  document.body.removeChild(textarea);
  return success;
}

async function copyGameStateSnapshot() {
  if (!currentRoomState && !lastGameStatePayload) {
    log("No game state available to copy.");
    return;
  }
  const snapshot = buildGameStateSnapshot();
  const text = JSON.stringify(snapshot);
  const ok = await copyTextToClipboard(text);
  if (ok) {
    log("Game state copied to clipboard.");
  } else {
    log("Failed to copy game state.");
  }
}

function sanitizeActionLogValue(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    if (value.length > ACTION_LOG_TRUNCATE_AT) {
      return `${value.slice(0, ACTION_LOG_TRUNCATE_AT)}...(truncated ${value.length} chars)`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeActionLogValue(entry));
  }
  if (typeof value === "object") {
    const sanitized = {};
    Object.keys(value).forEach((key) => {
      sanitized[key] = sanitizeActionLogValue(value[key]);
    });
    return sanitized;
  }
  return value;
}

function recordActionLog(payload) {
  const timestamp = new Date().toISOString();
  const logPayload = {
    timestamp,
    room_id: payload ? payload.room_id : roomId,
    player_id: playerId || null,
    game_type: currentGameType || null,
    skip_validation: payload ? payload.skip_validation === true : shouldSkipValidation(),
    action: payload ? payload.action : null,
  };
  const sanitizedPayload = sanitizeActionLogValue(logPayload);
  const line = JSON.stringify(sanitizedPayload);
  actionLog.push(line);
  if (actionLog.length > ACTION_LOG_MAX) {
    actionLog.splice(0, actionLog.length - ACTION_LOG_MAX);
  }
}

async function copyActionLogSnapshot() {
  if (!actionLog.length) {
    log("No action log entries to copy.");
    return;
  }
  const text = actionLog.join("\n");
  const ok = await copyTextToClipboard(text);
  if (ok) {
    log(`Action log copied to clipboard (${actionLog.length} entries).`);
  } else {
    log("Failed to copy action log.");
  }
}

function describeBlockingPlayers(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return "";
  }
  return players
    .map((player) => {
      if (typeof player === "string") {
        const trimmed = player.trim();
        return trimmed || "?";
      }
      if (!player || typeof player !== "object") {
        return "?";
      }
      const name = player.name ? String(player.name).trim() : "?";
      if (player.connected === false) {
        return `${name} (offline)`;
      }
      return name;
    })
    .filter(Boolean)
    .join(", ");
}

function findRoomListItem(roomId) {
  if (!roomListEl || !roomId) {
    return null;
  }
  return roomListEl.querySelector(`.room-item[data-room-id="${roomId}"]`);
}

function showRoomListBubble(wrapper, message) {
  if (!wrapper || !message) {
    return;
  }
  const existing = wrapper.querySelector(".room-bubble");
  if (existing) {
    existing.remove();
  }
  const bubble = document.createElement("div");
  bubble.className = "room-bubble";
  bubble.textContent = message;
  wrapper.appendChild(bubble);
  requestAnimationFrame(() => {
    bubble.classList.add("show");
  });
  window.setTimeout(() => {
    bubble.classList.remove("show");
    window.setTimeout(() => {
      bubble.remove();
    }, 200);
  }, 2200);
}

function toggleAbracaSpellBubble(anchor, message) {
  if (!anchor || !message) {
    return;
  }
  const existing = anchor.querySelector(".abraca-spell-bubble");
  if (existing) {
    existing.remove();
    return;
  }
  const table = anchor.closest(".abraca-spell-table");
  if (table) {
    table.querySelectorAll(".abraca-spell-bubble").forEach((bubble) => bubble.remove());
  }
  const bubble = document.createElement("div");
  bubble.className = "abraca-spell-bubble";
  bubble.textContent = message;
  bubble.addEventListener("click", (event) => {
    event.stopPropagation();
    bubble.remove();
  });
  anchor.appendChild(bubble);
  requestAnimationFrame(() => {
    bubble.classList.add("show");
  });
}

function setModalVisible(modalEl, visible) {
  if (!modalEl) {
    return;
  }
  modalEl.classList.toggle("hidden", !visible);
  modalEl.setAttribute("aria-hidden", (!visible).toString());
}

function markPendingSeatClaim(roomId, sourceRoomId) {
  pendingSeatClaimRoomId = roomId || null;
  pendingSeatClaimSourceId = sourceRoomId || null;
}

function clearPendingSeatClaim(roomId) {
  if (!pendingSeatClaimRoomId) {
    return;
  }
  if (roomId && pendingSeatClaimRoomId !== roomId) {
    return;
  }
  pendingSeatClaimRoomId = null;
  pendingSeatClaimSourceId = null;
}

function requestSeatClaim(roomId, sourceRoomId, openImmediately = true) {
  if (!roomId) {
    return;
  }
  markPendingSeatClaim(roomId, sourceRoomId);
  if (openImmediately) {
    if (seatClaimNameHint) {
      const name = getPlayerName();
      seatClaimNameHint.textContent = name ? `Using name: ${name}` : "Set your name to claim a seat.";
    }
    if (seatClaimRoomLabel) {
      const sourceLabel = sourceRoomId ? `Loaded from ${sourceRoomId}` : "Loaded room";
      seatClaimRoomLabel.textContent = `Room ${roomId} · ${sourceLabel}`;
    }
    if (seatClaimList) {
      seatClaimList.innerHTML = "";
    }
    if (seatClaimEmpty) {
      seatClaimEmpty.textContent = "Loading seats...";
      seatClaimEmpty.classList.remove("hidden");
    }
    setModalVisible(seatClaimModal, true);
  }
  socket.emit("room:seat_list", { room_id: roomId });
}

function openLoadModal() {
  setModalVisible(loadModal, true);
}

function closeLoadModal() {
  setModalVisible(loadModal, false);
}

async function fetchGameList() {
  if (cachedGameList) {
    return cachedGameList;
  }
  try {
    const res = await fetch("/api/games");
    cachedGameList = await res.json();
    return cachedGameList;
  } catch (err) {
    console.error("Failed to fetch game list", err);
    return [];
  }
}

function filterGames(games, searchText, playerCount) {
  return games.filter((g) => {
    const matchesSearch =
      !searchText ||
      g.name.toLowerCase().includes(searchText.toLowerCase()) ||
      g.game_id.toLowerCase().includes(searchText.toLowerCase());
    const matchesPlayers =
      !playerCount || (g.min_players <= playerCount && playerCount <= g.max_players);
    return matchesSearch && matchesPlayers;
  });
}

function renderGameList(games) {
  if (!gameListEl || !gameListEmpty) {
    return;
  }
  gameListEl.innerHTML = "";
  if (!games || !games.length) {
    gameListEmpty.classList.remove("hidden");
    return;
  }
  gameListEmpty.classList.add("hidden");
  games.forEach((g) => {
    const item = document.createElement("div");
    item.className = "game-item";
    item.dataset.gameId = g.game_id;
    const nameEl = document.createElement("span");
    nameEl.className = "game-item-name";
    nameEl.textContent = g.name;
    const playersEl = document.createElement("span");
    playersEl.className = "game-item-players";
    playersEl.textContent =
      g.min_players === g.max_players
        ? `${g.min_players} players`
        : `${g.min_players}-${g.max_players} players`;
    item.appendChild(nameEl);
    item.appendChild(playersEl);
    item.addEventListener("click", () => {
      selectGameFromModal(g.game_id);
    });
    gameListEl.appendChild(item);
  });
}

function selectGameFromModal(gameId) {
  const name = getPlayerName();
  if (!name) {
    log("Name required");
    closeCreateRoomModal();
    if (nameInput) {
      nameInput.focus();
    }
    return;
  }
  closeCreateRoomModal();
  socket.emit("room:create", { name, game_type: gameId });
}

async function applyGameFilters() {
  const games = await fetchGameList();
  const searchText = gameSearchInput ? gameSearchInput.value.trim() : "";
  const playerCount = playerCountFilter ? parseInt(playerCountFilter.value, 10) || 0 : 0;
  const filtered = filterGames(games, searchText, playerCount);
  renderGameList(filtered);
}

async function openCreateRoomModal() {
  if (!createRoomModal) {
    return;
  }
  if (gameSearchInput) {
    gameSearchInput.value = "";
  }
  if (playerCountFilter) {
    playerCountFilter.value = "";
  }
  setModalVisible(createRoomModal, true);
  await applyGameFilters();
}

function closeCreateRoomModal() {
  createRoomPending = false;
  setModalVisible(createRoomModal, false);
}

function openSeatClaimModal(roomId, sourceRoomId) {
  requestSeatClaim(roomId, sourceRoomId, true);
}

function closeSeatClaimModal() {
  clearPendingSeatClaim();
  setModalVisible(seatClaimModal, false);
}

function downloadSaveFile(sourceRoomId) {
  if (!sourceRoomId) {
    log("Missing source room id");
    return;
  }
  const url = `/api/room/save?source_room_id=${encodeURIComponent(sourceRoomId)}`;
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function parseDownloadFilename(headerValue) {
  if (!headerValue) {
    return null;
  }
  const utf8Match = headerValue.match(/filename\\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]).replace(/^\"|\"$/g, "");
    } catch {
      return utf8Match[1].replace(/^\"|\"$/g, "");
    }
  }
  const match = headerValue.match(/filename=([^;]+)/i);
  if (!match) {
    return null;
  }
  return match[1].trim().replace(/^\"|\"$/g, "");
}

async function downloadMemoriesFile(activeRoomId) {
  if (!activeRoomId) {
    log("Not in a room");
    return;
  }
  if (!currentGameType || !MEMORIES_SUPPORTED_GAMES.has(currentGameType)) {
    log("not supported");
    return;
  }
  const url = `/api/room/memories?room_id=${encodeURIComponent(activeRoomId)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      let message = "Download failed.";
      try {
        const data = await response.json();
        message = data.detail || data.message || message;
      } catch {
        try {
          const text = await response.text();
          if (text) message = text;
        } catch {}
      }
      log(message);
      return;
    }
    const blob = await response.blob();
    const filename =
      parseDownloadFilename(response.headers.get("Content-Disposition")) || "memories.html";
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    log("Download failed.");
  }
}

function renderLoadList(saves) {
  if (!loadList || !loadEmpty) {
    return;
  }
  loadList.innerHTML = "";
  if (!Array.isArray(saves) || saves.length === 0) {
    loadEmpty.textContent = "No saves found.";
    loadEmpty.classList.remove("hidden");
    return;
  }
  loadEmpty.classList.add("hidden");
  const ordered = [...saves].sort((a, b) => {
    const aTime = Number(a.saved_at) || 0;
    const bTime = Number(b.saved_at) || 0;
    return bTime - aTime;
  });
  ordered.forEach((save) => {
    const wrapper = document.createElement("div");
    wrapper.className = "load-item";

    const header = document.createElement("div");
    header.className = "load-item-header";
    const title = document.createElement("div");
    title.textContent = save.source_room_id || "-";
    const game = document.createElement("div");
    game.textContent = save.game_type || "-";
    header.appendChild(title);
    header.appendChild(game);

    const meta = document.createElement("div");
    meta.className = "load-item-meta";
    const savedAt = Number(save.saved_at);
    const timeValue = Number.isFinite(savedAt) ? new Date(savedAt * 1000).toLocaleString() : "-";
    const versionValue = Number(save.state_version);
    const version = Number.isFinite(versionValue) ? `v${versionValue}` : "v-";
    meta.textContent = `${timeValue} · ${version}`;

    const players = document.createElement("div");
    players.className = "load-item-meta";
    const names = (save.players || [])
      .map((player) => {
        if (!player) {
          return "?";
        }
        const name = player.name || "?";
        return player.is_bot ? `${name} (bot)` : name;
      })
      .join(", ");
    players.textContent = names ? `Players: ${names}` : "Players: -";

    const actions = document.createElement("div");
    actions.className = "load-item-actions";
    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.textContent = "Load";
    loadButton.addEventListener("click", () => {
      if (!save.source_room_id) {
        log("Missing source room id");
        return;
      }
      const autoSave = loadAutoSaveToggle ? loadAutoSaveToggle.checked : false;
      socket.emit("room:load", { source_room_id: save.source_room_id, auto_save: autoSave });
    });
    actions.appendChild(loadButton);
    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.textContent = "Download";
    downloadButton.addEventListener("click", () => {
      downloadSaveFile(save.source_room_id);
    });
    actions.appendChild(downloadButton);

    wrapper.appendChild(header);
    wrapper.appendChild(meta);
    wrapper.appendChild(players);
    wrapper.appendChild(actions);
    loadList.appendChild(wrapper);
  });
}

function renderSeatList(payload) {
  if (!seatClaimList || !seatClaimEmpty) {
    return;
  }
  seatClaimList.innerHTML = "";
  const seats = Array.isArray(payload.seats) ? payload.seats : [];
  const ordered = [...seats].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
  let available = 0;
  ordered.forEach((seat) => {
    const wrapper = document.createElement("div");
    wrapper.className = "seat-item";

    const row = document.createElement("div");
    row.className = "seat-item-row";
    const label = document.createElement("div");
    const seatNumber = Number.isFinite(seat.seat) ? seat.seat + 1 : "-";
    const name = seat.name || "?";
    label.textContent = `${seatNumber}. ${name}`;
    const meta = document.createElement("div");
    meta.className = "seat-item-meta";
    const tags = [];
    const claimed = Boolean(seat.seat_claimed) || seat.connected;
    if (seat.is_bot) tags.push("bot");
    if (!seat.is_bot && claimed) tags.push("claimed");
    meta.textContent = tags.join(" · ") || "available";
    row.appendChild(label);
    row.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "seat-item-actions";
    const claimButton = document.createElement("button");
    claimButton.type = "button";
    claimButton.textContent = "Claim";
    const disabled = seat.is_bot || claimed;
    if (!disabled) {
      available += 1;
    }
    claimButton.disabled = disabled;
    claimButton.addEventListener("click", () => {
      const name = getPlayerName();
      if (!name) {
        log("Name required");
        if (nameInput) {
          nameInput.focus();
        }
        return;
      }
      socket.emit("room:claim_seat", { room_id: payload.room_id, seat: seat.seat, name });
    });
    actions.appendChild(claimButton);

    wrapper.appendChild(row);
    wrapper.appendChild(actions);
    seatClaimList.appendChild(wrapper);
  });
  if (available === 0) {
    seatClaimEmpty.textContent = "No seats available.";
    seatClaimEmpty.classList.remove("hidden");
  } else {
    seatClaimEmpty.classList.add("hidden");
  }
}

function performLogout() {
  if (roomId) {
    socket.emit("room:leave", { room_id: roomId });
  }
  closeLoadModal();
  closeSeatClaimModal();
  clearAllRoomAuth();
  clearStoredName();
  playerId = null;
  resetRoomState();
  if (nameInput) {
    nameInput.value = "";
  }
  setConnectionInfo("logged out");
  requestRoomList();
  log("Logged out");
}

function isTypingTarget(target) {
  if (!target) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function setLogPanelVisible(visible) {
  if (!logPanel) {
    return;
  }
  logPanel.classList.toggle("hidden", !visible);
  logPanel.setAttribute("aria-hidden", (!visible).toString());
  document.body.classList.toggle("log-open", visible);
}

function toggleLogPanel() {
  if (!logPanel) {
    return;
  }
  setLogPanelVisible(logPanel.classList.contains("hidden"));
}

function setConnectionInfo(message) {
  connectionInfo.textContent = message;
}

function getPlayerName() {
  return (nameInput ? nameInput.value : "").trim();
}

function setCreateGameRowVisible(visible) {
  if (!createGameRow) {
    return;
  }
  createGameRow.classList.toggle("hidden", !visible);
  createGameRow.setAttribute("aria-hidden", (!visible).toString());
}

function showCreateGamePicker() {
  if (!gameSelect || !createGameRow) {
    return;
  }
  setCreateGameRowVisible(true);
  gameSelect.value = "";
  requestAnimationFrame(() => {
    if (typeof gameSelect.showPicker === "function") {
      gameSelect.showPicker();
    } else {
      gameSelect.focus();
    }
  });
}

function setGamePanelVisibility(gameType) {
  const showCabo = gameType === "cabo";
  const showFlip7 = gameType === "flip7";
  const showYahtzee = gameType === "yahtzee";
  const showGoldRush = gameType === "gold_rush";
  const showIncanGold = gameType === "incan_gold";
  const showKobayakawa = gameType === "kobayakawa";
  const showSkull = gameType === "skull";
  const showCatInBox = gameType === "cat_in_box";
  const showHanabi = gameType === "hanabi";
  const showGang = gameType === "the_gang";
  const showMismatch = gameType === "perfect_mismatch";
  const showCoyote = gameType === "coyote";
  const showTexasHoldem = gameType === "texas_holdem";
  const showSixNimmt = gameType === "six_nimmt";
  const showHalli = gameType === "halli_galli";
  const showDecrypto = gameType === "decrypto";
  const showDrawGuess = gameType === "draw_guess";
  const showBlitzSketch = gameType === "blitz_sketch";
  const showCyber = gameType === "cyber_pictures";
  const showAidixit = gameType === "aidixit";
  const showImpression = gameType === "impression_flower";
  const showSplendor = gameType === "splendor";
  const showPointSalad = gameType === "point_salad";
  const showAbraca = gameType === "abraca_what";
  const showTrekking = gameType === "trekking_history";
  const showBlokus = gameType === "blokus";
  const showProjectL = gameType === "project_l";
  const showCarcassonne = gameType === "carcassonne";
  const showFangNiao = gameType === "fang_niao";
  caboPanel.classList.toggle("hidden", !showCabo);
  if (flip7Panel) {
    flip7Panel.classList.toggle("hidden", !showFlip7);
  }
  if (yahtzeePanel) {
    yahtzeePanel.classList.toggle("hidden", !showYahtzee);
  }
  if (goldRushPanel) {
    goldRushPanel.classList.toggle("hidden", !showGoldRush);
  }
  if (incanGoldPanel) {
    incanGoldPanel.classList.toggle("hidden", !showIncanGold);
  }
  if (kobayakawaPanel) {
    kobayakawaPanel.classList.toggle("hidden", !showKobayakawa);
  }
  skullPanel.classList.toggle("hidden", !showSkull);
  if (catInBoxPanel) {
    catInBoxPanel.classList.toggle("hidden", !showCatInBox);
  }
  if (hanabiPanel) {
    hanabiPanel.classList.toggle("hidden", !showHanabi);
  }
  if (gangPanel) {
    gangPanel.classList.toggle("hidden", !showGang);
  }
  if (mismatchPanel) {
    mismatchPanel.classList.toggle("hidden", !showMismatch);
  }
  if (coyotePanel) {
    coyotePanel.classList.toggle("hidden", !showCoyote);
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
  drawGuessPanel.classList.toggle("hidden", !showDrawGuess);
  if (blitzSketchPanel) {
    blitzSketchPanel.classList.toggle("hidden", !showBlitzSketch);
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
  if (pointSaladPanel) {
    pointSaladPanel.classList.toggle("hidden", !showPointSalad);
  }
  if (trekkingPanel) {
    trekkingPanel.classList.toggle("hidden", !showTrekking);
  }
  if (abracaPanel) {
    abracaPanel.classList.toggle("hidden", !showAbraca);
  }
  if (blokusPanel) {
    blokusPanel.classList.toggle("hidden", !showBlokus);
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
  if (fangNiaoPanel) {
    fangNiaoPanel.classList.toggle("hidden", !showFangNiao);
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


function updateHalliConfigRow() {
  const showRow = currentRoomState && currentGameType === "halli_galli" && currentRoomState.status === "lobby";
  if (halliConfigBox) {
    halliConfigBox.classList.toggle("hidden", !showRow);
    halliConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (halliDeckRow) {
    halliDeckRow.classList.toggle("hidden", !showRow);
    halliDeckRow.setAttribute("aria-hidden", (!showRow).toString());
  }
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


function updateAutoSaveRow() {
  const showRow =
    currentRoomState &&
    (currentRoomState.status === "lobby" ||
      currentRoomState.status === "in_game" ||
      currentRoomState.status === "game_over");
  if (autoSaveRow) {
    autoSaveRow.classList.toggle("hidden", !showRow);
    autoSaveRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (autoSaveToggle) {
    const autoSaveEnabled = Boolean(currentRoomState && currentRoomState.auto_save);
    autoSaveToggle.checked = autoSaveEnabled;
    autoSaveToggle.disabled = !showRow || autoSaveEnabled;
  }
}

function updateReopenButton() {
  if (!reopenBtn) {
    return;
  }
  const showButton =
    currentRoomState && (currentRoomState.status === "in_game" || currentRoomState.status === "game_over");
  reopenBtn.classList.toggle("hidden", !showButton);
  reopenBtn.setAttribute("aria-hidden", (!showButton).toString());
  reopenBtn.disabled = !showButton;
}

function updateRoomControlsDock() {
  if (!roomControlsPanel) {
    return;
  }
  const shouldDock =
    roomControlsDockQuery.matches &&
    roomControlsPanel.classList.contains("compact") &&
    roomControlsPanel.classList.contains("collapsed");
  document.body.classList.toggle("room-controls-docked", shouldDock);
  if (shouldDock) {
    const height = roomControlsPanel.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--room-controls-bar-height", `${height}px`);
  } else {
    document.documentElement.style.removeProperty("--room-controls-bar-height");
  }
}

function setRoomControlsCollapsed(collapsed, { auto = false } = {}) {
  if (!roomControlsPanel) {
    return;
  }
  roomControlsPanel.classList.toggle("collapsed", collapsed);
  if (roomControlsToggleBtn) {
    roomControlsToggleBtn.textContent = collapsed ? "Show" : "Hide";
    roomControlsToggleBtn.setAttribute("aria-expanded", (!collapsed).toString());
  }
  if (auto) {
    roomControlsAutoCollapsed = collapsed;
  }
  updateRoomControlsDock();
}

function updateRoomControlsForStatus(status) {
  if (!roomControlsPanel) {
    return;
  }
  const isInGame = status === "in_game";
  roomControlsPanel.classList.toggle("compact", isInGame);
  if (isInGame && roomControlsDockQuery.matches && !roomControlsGameActive) {
    const wasCollapsed = roomControlsPanel.classList.contains("collapsed");
    if (!wasCollapsed) {
      setRoomControlsCollapsed(true, { auto: true });
    }
  }
  if (!isInGame && roomControlsGameActive) {
    if (roomControlsAutoCollapsed) {
      setRoomControlsCollapsed(false, { auto: true });
    }
    roomControlsAutoCollapsed = false;
  }
  roomControlsGameActive = isInGame;
  updateRoomControlsDock();
}


function requestRoomList() {
  socket.emit("room:list", {});
}

function requestLoadList() {
  if (loadList) {
    loadList.innerHTML = "";
  }
  if (loadEmpty) {
    loadEmpty.textContent = "Loading saves...";
    loadEmpty.classList.remove("hidden");
  }
  if (loadAutoSaveToggle) {
    loadAutoSaveToggle.checked = false;
  }
  openLoadModal();
  socket.emit("room:load_list", {});
}

function getRoomSummary(roomId) {
  if (!roomId || !Array.isArray(currentRoomList)) {
    return null;
  }
  return currentRoomList.find((room) => room.room_id === roomId) || null;
}

function attemptJoinRoom(rid, options = {}) {
  const name = getPlayerName();
  if (!name || !rid) {
    log("Name and room ID required");
    return;
  }
  const summary = getRoomSummary(rid);
  const sourceRoomId =
    summary && typeof summary.source_room_id === "string" ? summary.source_room_id.trim() : "";
  if (summary && sourceRoomId) {
    requestSeatClaim(summary.room_id, sourceRoomId, true);
    return;
  }
  if (options.readyAfterJoin) {
    pendingReadyAfterJoin = true;
    pendingReadyRoomId = rid;
  } else {
    pendingReadyAfterJoin = false;
    pendingReadyRoomId = null;
  }
  markPendingSeatClaim(rid, null);
  socket.emit("room:join", { name, room_id: rid });
}

function attemptReconnect(rid, auth) {
  if (!rid || !auth) {
    log("Reconnect info missing");
    return;
  }
  socket.emit("room:reconnect", {
    room_id: rid,
    player_id: auth.player_id,
    reconnect_token: auth.reconnect_token,
  });
}

function startCreateRoomFlow() {
  const name = getPlayerName();
  if (!name) {
    log("Name required");
    if (nameInput) {
      nameInput.focus();
    }
    return;
  }
  if (createRoomModal) {
    createRoomPending = true;
    openCreateRoomModal();
    return;
  }
  if (!gameSelect || !createGameRow) {
    socket.emit("room:create", { name, game_type: "cabo" });
    return;
  }
  createRoomPending = true;
  showCreateGamePicker();
}

function renderRoomList(rooms) {
  if (!roomListEl) {
    return;
  }
  currentRoomList = Array.isArray(rooms) ? rooms : [];
  roomListEl.innerHTML = "";
  if (!rooms || !rooms.length) {
    roomListEl.textContent = "No rooms";
    return;
  }
  rooms.forEach((room) => {
    const wrapper = document.createElement("div");
    wrapper.className = "room-item";
    wrapper.dataset.roomId = room.room_id || "";

    const header = document.createElement("div");
    header.className = "room-item-header";
    const title = document.createElement("div");
    title.textContent = room.room_id || "-";
    const status = document.createElement("div");
    status.className = "room-pill";
    status.textContent = room.status || "-";
    header.appendChild(title);
    header.appendChild(status);

    const meta = document.createElement("div");
    meta.className = "room-item-meta";
    const maxPlayers = Number.isFinite(room.max_players) ? room.max_players : null;
    const count = `${room.player_count || 0}/${maxPlayers !== null ? maxPlayers : "-"}`;
    meta.textContent = `${room.game_type || "-"} · ${count}`;

    const players = document.createElement("div");
    players.className = "room-item-players";
    (room.players || []).forEach((player) => {
      const pill = document.createElement("span");
      pill.className = "room-pill";
      if (!player.connected) {
        pill.classList.add("offline");
      }
      const suffix = player.is_bot ? " (bot)" : "";
      pill.textContent = `${player.name || "?"}${suffix}`;
      players.appendChild(pill);
    });

    const actions = document.createElement("div");
    actions.className = "room-item-actions";
    const joinActions = document.createElement("div");
    joinActions.className = "room-item-join-actions";
    const auth = getRoomAuth(room.room_id);
    const isLoaded = Boolean(room.source_room_id);
    const canReconnect = auth && auth.player_id && auth.reconnect_token;
    const claimableSeats = (room.players || []).filter(
      (player) => !player.is_bot && !(player.seat_claimed || player.connected),
    );
    const joinDisabled = isLoaded
      ? claimableSeats.length === 0
      : room.status !== "lobby" || (maxPlayers !== null && (room.player_count || 0) >= maxPlayers);
    const joinBtn = document.createElement("button");
    joinBtn.type = "button";
    joinBtn.textContent = isLoaded ? "Claim Seat" : "Join";
    joinBtn.disabled = joinDisabled;
    joinBtn.addEventListener("click", () => {
      if (isLoaded) {
        requestSeatClaim(room.room_id, room.source_room_id, true);
      } else {
        attemptJoinRoom(room.room_id);
      }
    });
    joinActions.appendChild(joinBtn);

    if (!isLoaded) {
      const joinReadyBtn = document.createElement("button");
      joinReadyBtn.type = "button";
      joinReadyBtn.textContent = "Join Ready";
      joinReadyBtn.disabled = joinDisabled;
      joinReadyBtn.addEventListener("click", () => {
        attemptJoinRoom(room.room_id, { readyAfterJoin: true });
      });
      joinActions.appendChild(joinReadyBtn);
    }

    if (canReconnect) {
      const reconnectBtn = document.createElement("button");
      reconnectBtn.type = "button";
      reconnectBtn.textContent = "Reconnect";
      reconnectBtn.addEventListener("click", () => {
        attemptReconnect(room.room_id, auth);
      });
      joinActions.appendChild(reconnectBtn);
    }

    actions.appendChild(joinActions);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "room-delete-btn";
    deleteBtn.innerHTML = "&#128465;";
    deleteBtn.setAttribute("aria-label", "Delete room");
    deleteBtn.title = "Delete room";
    deleteBtn.addEventListener("click", () => {
      if (!room.room_id) {
        return;
      }
      const blockingPlayers = (room.players || []).filter((player) => !player.is_bot && player.connected);
      if (blockingPlayers.length) {
        const names = describeBlockingPlayers(blockingPlayers);
        const message = names ? `Still in room: ${names}` : "Room has human players";
        showRoomListBubble(wrapper, message);
        return;
      }
      socket.emit("room:delete", { room_id: room.room_id });
    });
    actions.appendChild(deleteBtn);

    wrapper.appendChild(header);
    wrapper.appendChild(meta);
    if (isLoaded) {
      const source = document.createElement("div");
      source.className = "room-item-meta";
      source.textContent = `Loaded from ${room.source_room_id}`;
      wrapper.appendChild(source);
    }
    if (players.childNodes.length) {
      wrapper.appendChild(players);
    }
    wrapper.appendChild(actions);
    roomListEl.appendChild(wrapper);
  });
}

function resetRoomState() {
  roomId = null;
  currentRoomState = null;
  currentGameType = null;
  lastGameStatePayload = null;
  roomIdLabel.textContent = "-";
  roomStatus.textContent = "-";
  gameTypeLabel.textContent = "-";
  playersList.innerHTML = "";
  clearCaboState();
  clearFlip7State();
  clearYahtzeeState();
  clearGoldRushState();
  clearIncanGoldState();
  clearKobayakawaState();
  clearSkullState();
  clearCatInBoxState();
  clearGangState();
  clearMismatchState();
  clearCoyoteState();
  clearTexasHoldemState();
  clearSixNimmtState();
  clearHalliState();
  clearDecryptoState();
  clearDrawGuessState();
  clearBlitzSketchState();
  clearCyberState();
  clearAidixitState();
  clearImpressionFlowerState();
  clearSplendorState();
  clearPointSaladState();
  clearTrekkingState();
  clearAbracaState();
  clearBlokusState();
  clearProjectLState();
  clearCarcassonneState();
  clearFangNiaoState();
  setGamePanelVisibility(null);
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
  if (drawGuessLanguageSelect) {
    drawGuessLanguageSelect.value = "zh";
  }
  if (drawGuessGuessMethodSelect) {
    drawGuessGuessMethodSelect.value = "normal";
  }
  if (blitzSketchDrawTimeSelect) {
    blitzSketchDrawTimeSelect.value = "3";
  }
  if (drawGuessAnswerLengthToggle) {
    drawGuessAnswerLengthToggle.checked = false;
  }
  if (cyberPicturesDuplicateToggle) {
    cyberPicturesDuplicateToggle.checked = false;
  }
  cyberPicturesDisabledTools = new Set();
  if (decryptoBotSelect) {
    decryptoBotSelect.value = "native";
  }
  decryptoBotStrategyId = "native";
  if (decryptoBotClueSelect) {
    decryptoBotClueSelect.value = "0.5";
  }
  decryptoBotClueDirectness = 0.5;
  if (halliDeckSelect) {
    halliDeckSelect.value = "base";
  }
  if (goldRushModeSelect) {
    goldRushModeSelect.value = "hand";
  }
  if (hanabiFinalRoundToggle) {
    hanabiFinalRoundToggle.checked = false;
  }
  if (mismatchSliderCount) {
    mismatchSliderCount.value = "3";
  }
  if (gangModeSelect) {
    gangModeSelect.value = "normal";
  }
  if (gangTimeSelect) {
    gangTimeSelect.value = "0";
  }
  if (impressionVoteToggle) {
    impressionVoteToggle.checked = false;
  }
  createRoomPending = false;
  setCreateGameRowVisible(false);
  updateRoomControlsForStatus(null);
}

function clearCaboState() {
  currentCaboView = null;
  selectedSlots = [];
  selectedTarget = null;
  phaseLabel.textContent = "-";
  roundLabel.textContent = "-";
  turnLabel.textContent = "-";
  deckCount.textContent = "-";
  discardTop.textContent = "-";
  lastDrawn.textContent = "-";
  caboBy.textContent = "-";
  caboLeft.textContent = "-";
  pendingChoice.textContent = "-";
  handSlots.innerHTML = "";
  if (selectedSlotsLabel) {
    selectedSlotsLabel.textContent = "-";
  }
  if (targetSelection) {
    targetSelection.textContent = "-";
  }
  if (targetList) {
    targetList.innerHTML = "";
  }
  gamePlayers.innerHTML = "";
  updateActionButtons();
}

function clearFlip7State() {
  currentFlip7View = null;
  flip7SelectedTarget = null;
  if (flip7PhaseLabel) {
    flip7PhaseLabel.textContent = "-";
  }
  if (flip7RoundLabel) {
    flip7RoundLabel.textContent = "-";
  }
  if (flip7TurnLabel) {
    flip7TurnLabel.textContent = "-";
  }
  if (flip7DeckLabel) {
    flip7DeckLabel.textContent = "-";
  }
  if (flip7DiscardLabel) {
    flip7DiscardLabel.textContent = "-";
  }
  if (flip7TargetScoreLabel) {
    flip7TargetScoreLabel.textContent = "-";
  }
  if (flip7PendingLabel) {
    flip7PendingLabel.textContent = "-";
  }
  if (flip7FlipWinnerLabel) {
    flip7FlipWinnerLabel.textContent = "-";
  }
  if (flip7Tableau) {
    flip7Tableau.innerHTML = "";
  }
  if (flip7TargetSelection) {
    flip7TargetSelection.textContent = "-";
  }
  if (flip7Targets) {
    flip7Targets.innerHTML = "";
  }
  if (flip7LastRound) {
    flip7LastRound.innerHTML = "";
  }
  if (flip7Players) {
    flip7Players.innerHTML = "";
  }
  updateFlip7ActionButtons();
}

function clearYahtzeeState() {
  currentYahtzeeView = null;
  if (yahtzeePhaseLabel) {
    yahtzeePhaseLabel.textContent = "-";
  }
  if (yahtzeeRoundLabel) {
    yahtzeeRoundLabel.textContent = "-";
  }
  if (yahtzeeTurnLabel) {
    yahtzeeTurnLabel.textContent = "-";
  }
  if (yahtzeeRollsLabel) {
    yahtzeeRollsLabel.textContent = "-";
  }
  if (yahtzeeWinnerLabel) {
    yahtzeeWinnerLabel.textContent = "-";
  }
  if (yahtzeeDice) {
    yahtzeeDice.innerHTML = "";
  }
  if (yahtzeeScorecards) {
    yahtzeeScorecards.innerHTML = "";
  }
  if (yahtzeeJokerBody) {
    yahtzeeJokerBody.textContent = "-";
  }
  if (yahtzeeJokerNotice) {
    yahtzeeJokerNotice.classList.add("hidden");
  }
  updateYahtzeeActionButtons();
}

function clearGoldRushState() {
  currentGoldRushView = null;
  goldRushSelectedHandIndex = null;
  if (goldRushPhaseLabel) {
    goldRushPhaseLabel.textContent = "-";
  }
  if (goldRushModeLabel) {
    goldRushModeLabel.textContent = "-";
  }
  if (goldRushTurnLabel) {
    goldRushTurnLabel.textContent = "-";
  }
  if (goldRushDeckLabel) {
    goldRushDeckLabel.textContent = "-";
  }
  if (goldRushWinnerLabel) {
    goldRushWinnerLabel.textContent = "-";
  }
  if (goldRushHand) {
    goldRushHand.innerHTML = "";
  }
  if (goldRushSelectedCardLabel) {
    goldRushSelectedCardLabel.textContent = "-";
  }
  if (goldRushMines) {
    goldRushMines.innerHTML = "";
  }
  if (goldRushPlayers) {
    goldRushPlayers.innerHTML = "";
  }
  if (goldRushScoreBreakdown) {
    goldRushScoreBreakdown.innerHTML = "";
  }
  updateGoldRushActionButtons();
}

function clearIncanGoldState() {
  currentIncanGoldView = null;
  if (incanGoldPhaseLabel) {
    incanGoldPhaseLabel.textContent = "-";
  }
  if (incanGoldRoundLabel) {
    incanGoldRoundLabel.textContent = "-";
  }
  if (incanGoldMaxRoundsLabel) {
    incanGoldMaxRoundsLabel.textContent = "-";
  }
  if (incanGoldDeckLabel) {
    incanGoldDeckLabel.textContent = "-";
  }
  if (incanGoldInCaveLabel) {
    incanGoldInCaveLabel.textContent = "-";
  }
  if (incanGoldDecidedLabel) {
    incanGoldDecidedLabel.textContent = "-";
  }
  if (incanGoldChoiceLabel) {
    incanGoldChoiceLabel.textContent = "-";
  }
  if (incanGoldWinnerLabel) {
    incanGoldWinnerLabel.textContent = "-";
  }
  if (incanGoldRoundNotice) {
    incanGoldRoundNotice.classList.add("hidden");
    incanGoldRoundNotice.setAttribute("aria-hidden", "true");
  }
  if (incanGoldPath) {
    incanGoldPath.innerHTML = "";
  }
  if (incanGoldPlayers) {
    incanGoldPlayers.innerHTML = "";
  }
  if (incanGoldRemovedHazards) {
    incanGoldRemovedHazards.innerHTML = "";
  }
  updateIncanGoldActionButtons();
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


function clearSkullState() {
  currentSkullView = null;
  skullSelectedCardIndex = null;
  skullSelectedCardType = null;
  skullSelectedTarget = null;
  skullPhaseLabel.textContent = "-";
  skullRoundLabel.textContent = "-";
  skullTurnLabel.textContent = "-";
  skullBidLabel.textContent = "-";
  skullBidderLabel.textContent = "-";
  skullPassedLabel.textContent = "-";
  skullRosesLabel.textContent = "-";
  skullLastRevealLabel.textContent = "-";
  skullWinnerLabel.textContent = "-";
  skullHand.innerHTML = "";
  skullSelectedCardLabel.textContent = "-";
  skullTargetSelection.textContent = "-";
  skullTargets.innerHTML = "";
  skullPlayers.innerHTML = "";
  updateSkullActionButtons();
}

function clearCatInBoxState() {
  currentCatInBoxView = null;
  catInBoxSelectedCard = null;
  catInBoxSelectedColor = null;
  if (catInBoxPhaseLabel) {
    catInBoxPhaseLabel.textContent = "-";
  }
  if (catInBoxRoundLabel) {
    catInBoxRoundLabel.textContent = "-";
  }
  if (catInBoxRoundsTotalLabel) {
    catInBoxRoundsTotalLabel.textContent = "-";
  }
  if (catInBoxTurnLabel) {
    catInBoxTurnLabel.textContent = "-";
  }
  if (catInBoxLeadLabel) {
    catInBoxLeadLabel.textContent = "-";
  }
  if (catInBoxTrumpLabel) {
    catInBoxTrumpLabel.textContent = "-";
  }
  if (catInBoxTricksPlayedLabel) {
    catInBoxTricksPlayedLabel.textContent = "-";
  }
  if (catInBoxParadoxLabel) {
    catInBoxParadoxLabel.textContent = "-";
  }
  if (catInBoxWinnersLabel) {
    catInBoxWinnersLabel.textContent = "-";
  }
  if (catInBoxBoard) {
    catInBoxBoard.innerHTML = "";
  }
  if (catInBoxTrick) {
    catInBoxTrick.innerHTML = "";
  }
  if (catInBoxHand) {
    catInBoxHand.innerHTML = "";
  }
  if (catInBoxSelectedCardLabel) {
    catInBoxSelectedCardLabel.textContent = "-";
  }
  if (catInBoxSelectedColorLabel) {
    catInBoxSelectedColorLabel.textContent = "-";
  }
  if (catInBoxPlayers) {
    catInBoxPlayers.innerHTML = "";
  }
  if (catInBoxSummary) {
    catInBoxSummary.classList.add("hidden");
  }
  if (catInBoxSummaryBody) {
    catInBoxSummaryBody.textContent = "-";
  }
  updateCatInBoxActionButtons();
}

function clearMismatchState() {
  currentMismatchView = null;
  if (mismatchPhaseLabel) {
    mismatchPhaseLabel.textContent = "-";
  }
  if (mismatchRoundLabel) {
    mismatchRoundLabel.textContent = "-";
  }
  if (mismatchLeaderLabel) {
    mismatchLeaderLabel.textContent = "-";
  }
  if (mismatchTargetLabel) {
    mismatchTargetLabel.textContent = "-";
  }
  if (mismatchGuessingLabel) {
    mismatchGuessingLabel.textContent = "-";
  }
  if (mismatchWinnerLabel) {
    mismatchWinnerLabel.textContent = "-";
  }
  if (mismatchYourGuessLabel) {
    mismatchYourGuessLabel.textContent = "-";
  }
  if (mismatchWords) {
    mismatchWords.innerHTML = "";
  }
  if (mismatchSliders) {
    mismatchSliders.innerHTML = "";
  }
  if (mismatchPlayers) {
    mismatchPlayers.innerHTML = "";
  }
  if (mismatchRoundSummary) {
    mismatchRoundSummary.classList.add("hidden");
  }
  if (mismatchRoundSummaryBody) {
    mismatchRoundSummaryBody.textContent = "-";
  }
  if (mismatchRoundSummaryGuesses) {
    mismatchRoundSummaryGuesses.innerHTML = "";
  }
  if (mismatchRevealBtn) {
    mismatchRevealBtn.disabled = true;
    mismatchRevealBtn.classList.remove("action-allowed");
  }
  if (mismatchNextRoundBtn) {
    mismatchNextRoundBtn.disabled = true;
    mismatchNextRoundBtn.classList.remove("action-allowed");
  }
  if (mismatchPlayAgainBtn) {
    mismatchPlayAgainBtn.disabled = true;
    mismatchPlayAgainBtn.classList.remove("action-allowed");
  }
}

function clearCoyoteState() {
  currentCoyoteView = null;
  coyotePhaseLabel.textContent = "-";
  coyoteRoundLabel.textContent = "-";
  coyoteTurnLabel.textContent = "-";
  coyoteBidLabel.textContent = "-";
  coyoteBidderLabel.textContent = "-";
  coyoteWinnerLabel.textContent = "-";
  if (coyoteRoundNotice) {
    coyoteRoundNotice.classList.add("hidden");
  }
  if (coyoteRoundNoticeBody) {
    coyoteRoundNoticeBody.textContent = "-";
  }
  if (coyoteBidInput) {
    coyoteBidInput.value = "";
  }
  if (coyoteResetBtn) {
    coyoteResetBtn.disabled = true;
  }
  coyotePlayers.innerHTML = "";
  updateCoyoteActionButtons();
}

function clearTexasHoldemState() {
  currentTexasHoldemView = null;
  if (texasPhaseLabel) {
    texasPhaseLabel.textContent = "-";
  }
  if (texasHandLabel) {
    texasHandLabel.textContent = "-";
  }
  if (texasTurnLabel) {
    texasTurnLabel.textContent = "-";
  }
  if (texasPotLabel) {
    texasPotLabel.textContent = "-";
  }
  if (texasCurrentBetLabel) {
    texasCurrentBetLabel.textContent = "-";
  }
  if (texasToCallLabel) {
    texasToCallLabel.textContent = "-";
  }
  if (texasBlindsLabel) {
    texasBlindsLabel.textContent = "-";
  }
  if (texasMinBetLabel) {
    texasMinBetLabel.textContent = "-";
  }
  if (texasMinRaiseToLabel) {
    texasMinRaiseToLabel.textContent = "-";
  }
  if (texasMaxRaiseToLabel) {
    texasMaxRaiseToLabel.textContent = "-";
  }
  if (texasCommunityCards) {
    texasCommunityCards.innerHTML = "";
  }
  if (texasYourHand) {
    texasYourHand.innerHTML = "";
  }
  if (texasPlayers) {
    texasPlayers.innerHTML = "";
  }
  if (texasBetInput) {
    texasBetInput.value = "";
  }
  if (texasCallBtn) {
    texasCallBtn.textContent = "Call";
  }
  if (texasSummary) {
    texasSummary.classList.add("hidden");
    texasSummary.setAttribute("aria-hidden", "true");
  }
  if (texasSummaryBody) {
    texasSummaryBody.textContent = "-";
  }
  if (texasSummaryList) {
    texasSummaryList.innerHTML = "";
  }
  updateTexasHoldemActionButtons();
}

function clearSixNimmtState() {
  currentSixNimmtView = null;
  if (sixNimmtCountdownTimer) {
    clearInterval(sixNimmtCountdownTimer);
    sixNimmtCountdownTimer = null;
  }
  sixNimmtLastTimeoutAt = null;
  sixNimmtServerOffsetMs = 0;
  if (sixNimmtPhaseLabel) {
    sixNimmtPhaseLabel.textContent = "-";
  }
  if (sixNimmtRoundLabel) {
    sixNimmtRoundLabel.textContent = "-";
  }
  if (sixNimmtTurnLabel) {
    sixNimmtTurnLabel.textContent = "-";
  }
  if (sixNimmtTimerLabel) {
    sixNimmtTimerLabel.textContent = "-";
  }
  if (sixNimmtWaitingLabel) {
    sixNimmtWaitingLabel.textContent = "-";
  }
  if (sixNimmtSelectedLabel) {
    sixNimmtSelectedLabel.textContent = "-";
  }
  if (sixNimmtWinnersLabel) {
    sixNimmtWinnersLabel.textContent = "-";
  }
  if (sixNimmtNotice) {
    sixNimmtNotice.classList.add("hidden");
  }
  if (sixNimmtNoticeBody) {
    sixNimmtNoticeBody.textContent = "-";
  }
  if (sixNimmtReveal) {
    sixNimmtReveal.innerHTML = "";
  }
  if (sixNimmtSummaryList) {
    sixNimmtSummaryList.innerHTML = "";
  }
  if (sixNimmtSummaryMeta) {
    sixNimmtSummaryMeta.textContent = "-";
  }
  if (sixNimmtSummaryStatus) {
    sixNimmtSummaryStatus.textContent = "-";
  }
  if (sixNimmtSummaryCloseBtn) {
    sixNimmtSummaryCloseBtn.disabled = false;
    sixNimmtSummaryCloseBtn.textContent = "Continue";
  }
  if (sixNimmtSummaryModal) {
    sixNimmtSummaryModal.classList.add("hidden");
    sixNimmtSummaryModal.setAttribute("aria-hidden", "true");
  }
  sixNimmtSummaryAckSent = false;
  if (sixNimmtRows) {
    sixNimmtRows.innerHTML = "";
  }
  if (sixNimmtHand) {
    sixNimmtHand.innerHTML = "";
  }
  if (sixNimmtPlayers) {
    sixNimmtPlayers.innerHTML = "";
  }
}

function clearHalliState() {
  currentHalliView = null;
  if (halliTurnLabel) {
    halliTurnLabel.textContent = "-";
  }
  if (halliBellLabel) {
    halliBellLabel.textContent = "-";
  }
  if (halliWinnerLabel) {
    halliWinnerLabel.textContent = "-";
  }
  if (halliLastActionLabel) {
    halliLastActionLabel.textContent = "-";
  }
  if (halliLastRingLabel) {
    halliLastRingLabel.textContent = "-";
  }
  if (halliPlayers) {
    halliPlayers.innerHTML = "";
  }
  if (halliBellCenter) {
    halliBellCenter.classList.remove("halli-bell-center-ready", "halli-bell-center-waiting");
    halliBellCenter.classList.remove("halli-bell-center-actionable", "halli-bell-center-disabled");
    halliBellCenter.setAttribute("aria-disabled", "true");
  }
  if (halliBellCountdown) {
    halliBellCountdown.textContent = "-";
    halliBellCountdown.classList.add("hidden");
  }
  updateHalliCountdownState(null);
  updateHalliActionButtons();
}


function clearPointSaladSelections() {
  pointSaladSelectedPile = null;
  pointSaladSelectedMarket = [];
}

function clearPointSaladFlips() {
  pointSaladSelectedFlips = new Set();
}

function clearPointSaladState() {
  currentPointSaladView = null;
  clearPointSaladSelections();
  clearPointSaladFlips();
  if (pointSaladTurnLabel) {
    pointSaladTurnLabel.textContent = "-";
  }
  if (pointSaladWinnerLabel) {
    pointSaladWinnerLabel.textContent = "-";
  }
  if (pointSaladSelectedPileLabel) {
    pointSaladSelectedPileLabel.textContent = "-";
  }
  if (pointSaladSelectedVeggiesLabel) {
    pointSaladSelectedVeggiesLabel.textContent = "-";
  }
  if (pointSaladSelectedFlipsLabel) {
    pointSaladSelectedFlipsLabel.textContent = "-";
  }
  if (pointSaladPiles) {
    pointSaladPiles.innerHTML = "";
  }
  if (pointSaladMarket) {
    pointSaladMarket.innerHTML = "";
  }
  if (pointSaladPlayers) {
    pointSaladPlayers.innerHTML = "";
  }
  updatePointSaladActionButtons();
}

function clearAbracaState() {
  currentAbracaView = null;
  abracaLastRoundNotice = null;
  if (abracaPhaseLabel) {
    abracaPhaseLabel.textContent = "-";
  }
  if (abracaRoundLabel) {
    abracaRoundLabel.textContent = "-";
  }
  if (abracaTurnLabel) {
    abracaTurnLabel.textContent = "-";
  }
  if (abracaDeckLabel) {
    abracaDeckLabel.textContent = "-";
  }
  if (abracaSecretPoolLabel) {
    abracaSecretPoolLabel.textContent = "-";
  }
  if (abracaDiscardLabel) {
    abracaDiscardLabel.textContent = "-";
  }
  if (abracaChainMinLabel) {
    abracaChainMinLabel.textContent = "-";
  }
  if (abracaLastActionLabel) {
    abracaLastActionLabel.textContent = "-";
  }
  if (abracaRoundResultLabel) {
    abracaRoundResultLabel.textContent = "-";
  }
  if (abracaRoundNoticeTitle) {
    abracaRoundNoticeTitle.textContent = "Round Result";
  }
  if (abracaRoundNoticeBody) {
    abracaRoundNoticeBody.textContent = "-";
  }
  if (abracaRoundNotice) {
    abracaRoundNotice.classList.remove("muted");
    abracaRoundNotice.classList.add("hidden");
  }
  if (abracaSpells) {
    abracaSpells.innerHTML = "";
  }
  if (abracaPlayers) {
    abracaPlayers.innerHTML = "";
  }
  if (abracaNewGameRow) {
    abracaNewGameRow.classList.add("hidden");
  }
  updateAbracaActionButtons();
}

function clearFangNiaoState() {
  currentFangNiaoView = null;
  fangNiaoSelectedBird = null;
  fangNiaoSelectedRow = null;
  fangNiaoSelectedSide = null;
  if (fangNiaoPhaseLabel) {
    fangNiaoPhaseLabel.textContent = "-";
  }
  if (fangNiaoTurnLabel) {
    fangNiaoTurnLabel.textContent = "-";
  }
  if (fangNiaoDeckLabel) {
    fangNiaoDeckLabel.textContent = "-";
  }
  if (fangNiaoDiscardLabel) {
    fangNiaoDiscardLabel.textContent = "-";
  }
  if (fangNiaoWinnerLabel) {
    fangNiaoWinnerLabel.textContent = "-";
  }
  if (fangNiaoLastActionLabel) {
    fangNiaoLastActionLabel.textContent = "-";
  }
  if (fangNiaoRows) {
    fangNiaoRows.innerHTML = "";
  }
  if (fangNiaoHand) {
    fangNiaoHand.innerHTML = "";
  }
  if (fangNiaoPlayers) {
    fangNiaoPlayers.innerHTML = "";
  }
  updateFangNiaoSelectionLabels();
  updateFangNiaoActionButtons();
}

function pointSaladPileLabel(index) {
  if (!Number.isInteger(index)) {
    return "-";
  }
  return String.fromCharCode(65 + index);
}

function pointSaladPlayerName(view, playerId) {
  const player = (view.players || []).find((entry) => entry.player_id === playerId);
  return player ? player.name || player.player_id : playerId || "-";
}

function syncPointSaladSelections(view) {
  if (!view) {
    clearPointSaladSelections();
    clearPointSaladFlips();
    return;
  }
  if (pointSaladSelectedPile !== null) {
    const pile = (view.piles || [])[pointSaladSelectedPile];
    if (!pile || !pile.top) {
      pointSaladSelectedPile = null;
    }
  }
  const market = view.market || [];
  pointSaladSelectedMarket = pointSaladSelectedMarket.filter((pos) => market[pos]);

  const you = (view.players || []).find((player) => player.player_id === view.you);
  const available = new Set((you && you.point_cards ? you.point_cards : []).map((card) => card.id));
  pointSaladSelectedFlips = new Set(
    Array.from(pointSaladSelectedFlips).filter((cardId) => available.has(cardId))
  );
}

function updatePointSaladSelectionLabels() {
  if (pointSaladSelectedPileLabel) {
    pointSaladSelectedPileLabel.textContent =
      pointSaladSelectedPile === null ? "-" : pointSaladPileLabel(pointSaladSelectedPile);
  }
  if (pointSaladSelectedVeggiesLabel) {
    if (!currentPointSaladView || pointSaladSelectedMarket.length === 0) {
      pointSaladSelectedVeggiesLabel.textContent = "-";
    } else {
      const labels = pointSaladSelectedMarket.map((pos) => {
        const card = currentPointSaladView.market[pos];
        const veg = card ? card.veggie : "empty";
        return `${veg} (${pos + 1})`;
      });
      pointSaladSelectedVeggiesLabel.textContent = labels.join(", ");
    }
  }
  if (pointSaladSelectedFlipsLabel) {
    if (!currentPointSaladView || pointSaladSelectedFlips.size === 0) {
      pointSaladSelectedFlipsLabel.textContent = "-";
    } else {
      const you = (currentPointSaladView.players || []).find(
        (player) => player.player_id === currentPointSaladView.you
      );
      const lookup = new Map(
        (you && you.point_cards ? you.point_cards : []).map((card) => [card.id, card.label || `#${card.id}`])
      );
      const labels = Array.from(pointSaladSelectedFlips).map((cardId) => lookup.get(cardId) || `#${cardId}`);
      pointSaladSelectedFlipsLabel.textContent = labels.join(", ");
    }
  }
}

function updatePointSaladActionButtons() {
  if (!pointSaladTakePointBtn || !pointSaladTakeVeggiesBtn) {
    return;
  }
  if (currentGameType !== "point_salad" || !currentPointSaladView) {
    pointSaladTakePointBtn.disabled = true;
    pointSaladTakeVeggiesBtn.disabled = true;
    return;
  }
  const legal = currentPointSaladView.legal_actions || [];
  const piles = currentPointSaladView.piles || [];
  const canTakePoint =
    legal.includes("take_point") &&
    pointSaladSelectedPile !== null &&
    piles[pointSaladSelectedPile] &&
    piles[pointSaladSelectedPile].top;
  pointSaladTakePointBtn.disabled = !canTakePoint;

  const market = currentPointSaladView.market || [];
  const availableCount = market.filter((card) => card).length;
  const required = availableCount === 1 ? 1 : 2;
  const validSelection =
    pointSaladSelectedMarket.length === required &&
    pointSaladSelectedMarket.every((pos) => market[pos]);
  const canTakeVeggies = legal.includes("take_veggies") && validSelection;
  pointSaladTakeVeggiesBtn.disabled = !canTakeVeggies;
}

function renderPointSaladPiles(view) {
  if (!pointSaladPiles) {
    return;
  }
  pointSaladPiles.innerHTML = "";
  (view.piles || []).forEach((pile, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "point-salad-card";
    if (pointSaladSelectedPile === index) {
      button.classList.add("selected");
    }
    if (!pile || !pile.top) {
      button.classList.add("disabled");
      button.disabled = true;
    }
    const title = document.createElement("div");
    title.className = "point-salad-card-title";
    title.textContent = `Pile ${pointSaladPileLabel(index)}`;
    const label = document.createElement("div");
    label.className = "point-salad-card-meta";
    label.textContent = pile && pile.top ? pile.top.label : "Empty";
    const count = document.createElement("div");
    count.className = "point-salad-card-meta";
    count.textContent = `Count: ${pile ? pile.count : 0}`;
    button.appendChild(title);
    button.appendChild(label);
    button.appendChild(count);
    if (pile && pile.top) {
      button.addEventListener("click", () => {
        pointSaladSelectedPile = index;
        updatePointSaladSelectionLabels();
        renderPointSaladPiles(view);
        updatePointSaladActionButtons();
      });
    }
    pointSaladPiles.appendChild(button);
  });
}

function renderPointSaladMarket(view) {
  if (!pointSaladMarket) {
    return;
  }
  pointSaladMarket.innerHTML = "";
  (view.market || []).forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "point-salad-card";
    if (!card) {
      button.classList.add("disabled");
      button.disabled = true;
    }
    if (pointSaladSelectedMarket.includes(index)) {
      button.classList.add("selected");
    }
    const title = document.createElement("div");
    title.className = "point-salad-card-title";
    title.textContent = card ? card.veggie : "Empty";
    const meta = document.createElement("div");
    meta.className = "point-salad-card-meta";
    meta.textContent = `Slot ${index + 1}`;
    button.appendChild(title);
    button.appendChild(meta);
    if (card) {
      button.addEventListener("click", () => {
        const existing = pointSaladSelectedMarket.indexOf(index);
        if (existing >= 0) {
          pointSaladSelectedMarket.splice(existing, 1);
        } else if (pointSaladSelectedMarket.length < 2) {
          pointSaladSelectedMarket.push(index);
        }
        updatePointSaladSelectionLabels();
        renderPointSaladMarket(view);
        updatePointSaladActionButtons();
      });
    }
    pointSaladMarket.appendChild(button);
  });
}

function renderPointSaladPlayers(view) {
  if (!pointSaladPlayers) {
    return;
  }
  pointSaladPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "point-salad-player";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);
    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${player.score ?? 0}`;
    badges.appendChild(score);
    if (player.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge highlight";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    header.appendChild(badges);
    card.appendChild(header);

    const veggies = document.createElement("div");
    veggies.className = "point-salad-card-meta";
    const veggieLabels = (view.veggies || []).map((veg) => `${veg}:${player.veggies ? player.veggies[veg] || 0 : 0}`);
    veggies.textContent = veggieLabels.join(" | ");
    card.appendChild(veggies);

    const cards = document.createElement("div");
    cards.className = "point-salad-card-list";
    (player.point_cards || []).forEach((pointCard) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "point-salad-card-chip";
      const veggieSuffix = pointCard.veggie ? ` (${pointCard.veggie})` : "";
      chip.textContent = `${pointCard.label || `#${pointCard.id}`}${veggieSuffix}`;
      if (player.player_id === view.you && !view.game_over) {
        if (pointSaladSelectedFlips.has(pointCard.id)) {
          chip.classList.add("selected");
        }
        chip.addEventListener("click", () => {
          if (pointSaladSelectedFlips.has(pointCard.id)) {
            pointSaladSelectedFlips.delete(pointCard.id);
          } else {
            pointSaladSelectedFlips.add(pointCard.id);
          }
          updatePointSaladSelectionLabels();
          renderPointSaladPlayers(view);
          updatePointSaladActionButtons();
        });
      } else {
        chip.classList.add("readonly");
        chip.disabled = true;
      }
      cards.appendChild(chip);
    });
    card.appendChild(cards);
    pointSaladPlayers.appendChild(card);
  });
}

function renderPointSaladGameState(data) {
  const view = data.view;
  currentPointSaladView = view;
  if (currentGameType !== "point_salad") {
    currentGameType = "point_salad";
    setGamePanelVisibility("point_salad");
  }

  syncPointSaladSelections(view);
  if (pointSaladTurnLabel) {
    pointSaladTurnLabel.textContent = pointSaladPlayerName(view, view.current_turn);
  }
  if (pointSaladWinnerLabel) {
    if (view.winner && view.winner.length) {
      pointSaladWinnerLabel.textContent = view.winner.map((pid) => pointSaladPlayerName(view, pid)).join(", ");
    } else {
      pointSaladWinnerLabel.textContent = "-";
    }
  }

  updatePointSaladSelectionLabels();
  renderPointSaladPiles(view);
  renderPointSaladMarket(view);
  renderPointSaladPlayers(view);

  logGameEvents(data);
  updatePointSaladActionButtons();
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

function formatAbracaLastAction(view) {
  const last = view.last_action;
  if (!last || typeof last.spell_type !== "number") {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  const spell = abracaSpellData.find((item) => item.id === last.spell_type);
  const label = spell ? `${spell.number}. ${spell.name}` : `Spell ${last.spell_type + 1}`;
  const result = last.success ? "success" : "fail";
  const dice = Number.isInteger(last.dice) ? ` (dice ${last.dice})` : "";
  return `${actor}: ${label} ${result}${dice}`;
}

function formatAbracaRoundResult(view) {
  const result = view.round_result;
  if (!result) {
    return "-";
  }
  const typeMap = {
    kill: "Kill",
    self_death: "Self Death",
    empty_hand: "Empty Hand",
  };
  const actor = result.actor_id ? findPlayerName(view, result.actor_id) : null;
  let text = typeMap[result.type] || result.type;
  if (actor) {
    text += ` by ${actor}`;
  }
  const addScores = result.add_scores || {};
  const gains = Object.keys(addScores).map((pid) => {
    const gain = addScores[pid];
    return `${findPlayerName(view, pid)} +${gain}`;
  });
  if (gains.length) {
    text += ` | ${gains.join(", ")}`;
  }
  if (Array.isArray(view.winner) && view.winner.length) {
    const winners = view.winner.map((pid) => findPlayerName(view, pid)).join(", ");
    text += ` | Winner: ${winners}`;
  }
  return text;
}

function getAbracaRoundWinners(view, result) {
  const addScores = result && result.add_scores ? result.add_scores : {};
  let maxGain = null;
  const winners = [];
  Object.keys(addScores).forEach((pid) => {
    const gain = Number(addScores[pid]) || 0;
    if (maxGain === null || gain > maxGain) {
      maxGain = gain;
      winners.length = 0;
      winners.push({ pid, gain });
    } else if (gain === maxGain) {
      winners.push({ pid, gain });
    }
  });
  return winners;
}

function formatAbracaRoundNotice(view, result) {
  if (!result) {
    return null;
  }
  const winners = getAbracaRoundWinners(view, result);
  let winnersText = "-";
  if (winners.length) {
    winnersText = winners
      .map((entry) => `${findPlayerName(view, entry.pid)} +${entry.gain}`)
      .join(", ");
  } else if (result.actor_id) {
    winnersText = findPlayerName(view, result.actor_id);
  }
  const label = winners.length === 1 ? "Winner" : "Winners";
  const roundNumber = Number.isInteger(view.round) ? view.round : null;
  const text = roundNumber ? `Round ${roundNumber} ${label}: ${winnersText}` : `${label}: ${winnersText}`;
  return { round: roundNumber, text };
}

function updateAbracaRoundNotice(view) {
  if (!abracaRoundNotice || !abracaRoundNoticeBody) {
    return;
  }
  let notice = null;
  let title = "Round Result";
  let isFresh = false;
  if (view.round_result) {
    notice = formatAbracaRoundNotice(view, view.round_result);
    if (notice) {
      abracaLastRoundNotice = notice;
    }
    if (view.game_over) {
      title = "Game Over";
    } else if (view.phase === "round_end") {
      title = "Round Over";
    }
    isFresh = true;
  } else if (abracaLastRoundNotice) {
    if (Number.isInteger(view.round) && Number.isInteger(abracaLastRoundNotice.round)) {
      if (view.round === abracaLastRoundNotice.round + 1) {
        notice = abracaLastRoundNotice;
        title = "Last Round Result";
      }
    }
  }

  if (notice && notice.text) {
    abracaRoundNoticeBody.textContent = notice.text;
    if (abracaRoundNoticeTitle) {
      abracaRoundNoticeTitle.textContent = title;
    }
    abracaRoundNotice.classList.toggle("muted", !isFresh);
    abracaRoundNotice.classList.remove("hidden");
  } else {
    abracaRoundNotice.classList.add("hidden");
  }
}

function renderAbracaSpells(view) {
  if (!abracaSpells) {
    return;
  }
  abracaSpells.innerHTML = "";
  const discardCounts = Array.isArray(view.discard_counts) ? view.discard_counts : [];
  const table = document.createElement("table");
  table.className = "abraca-spell-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = ["Spell", "Used", "Total"];
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  abracaSpellData.forEach((spell) => {
    const row = document.createElement("tr");
    row.className = "abraca-spell-row";
    row.dataset.spell = String(spell.id);

    const name = document.createElement("td");
    name.className = "abraca-spell-name";
    name.textContent = `${spell.number}. ${spell.name}`;
    name.tabIndex = 0;
    name.setAttribute("role", "button");
    name.setAttribute("aria-label", `${spell.number}. ${spell.name} details`);
    name.addEventListener("click", () => {
      toggleAbracaSpellBubble(name, spell.desc);
    });
    name.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleAbracaSpellBubble(name, spell.desc);
      }
    });

    const used = discardCounts[spell.id] ?? 0;
    const usedCell = document.createElement("td");
    usedCell.className = "abraca-spell-count";
    usedCell.textContent = String(used);

    const totalCell = document.createElement("td");
    totalCell.className = "abraca-spell-total";
    totalCell.textContent = String(spell.total);

    row.appendChild(name);
    row.appendChild(usedCell);
    row.appendChild(totalCell);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  abracaSpells.appendChild(table);
}

function renderAbracaPlayers(view) {
  if (!abracaPlayers) {
    return;
  }
  abracaPlayers.innerHTML = "";
  const buildAbracaCardSlot = (cardInfo, { compact = false } = {}) => {
    const slot = document.createElement("div");
    slot.className = "player-slot abraca-card";
    if (compact) {
      slot.classList.add("abraca-card-compact");
    }
    if (!cardInfo || cardInfo.hidden) {
      slot.classList.add("abraca-card-hidden");
      slot.textContent = "?";
      slot.title = "Hidden card";
      return slot;
    }

    const rawSpell = Number.isInteger(cardInfo.spell)
      ? cardInfo.spell
      : Number.isInteger(cardInfo.number)
      ? cardInfo.number - 1
      : null;
    const spellType = Number.isInteger(rawSpell) ? rawSpell : null;
    if (spellType !== null) {
      slot.dataset.spell = String(spellType);
    }
    const spell = spellType !== null ? abracaSpellData.find((item) => item.id === spellType) : null;
    const number = Number.isInteger(cardInfo.number) ? cardInfo.number : (spellType ?? 0) + 1;
    const shortName = spell ? spell.short || spell.name : cardInfo.name || "Spell";
    const fullName = spell ? spell.name : cardInfo.name || shortName;

    const numberEl = document.createElement("div");
    numberEl.className = "abraca-card-number";
    numberEl.textContent = String(number);
    const nameEl = document.createElement("div");
    nameEl.className = "abraca-card-name";
    nameEl.textContent = shortName;
    slot.appendChild(numberEl);
    slot.appendChild(nameEl);
    slot.title = `${number}. ${fullName}`;
    return slot;
  };
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${player.score}`;
    badges.appendChild(score);
    const hp = document.createElement("span");
    hp.className = "badge";
    hp.textContent = `hp ${player.hp}/6`;
    badges.appendChild(hp);
    const secrets = document.createElement("span");
    secrets.className = "badge";
    secrets.textContent = `secret ${player.secret_count}`;
    badges.appendChild(secrets);
    if (player.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    if (player.player_id === view.current_turn) {
      const turn = document.createElement("span");
      turn.className = "badge highlight";
      turn.textContent = "turn";
      badges.appendChild(turn);
    }
    header.appendChild(badges);
    card.appendChild(header);

    const handRow = document.createElement("div");
    handRow.className = "player-hand";
    if (Array.isArray(player.hand) && player.hand.length) {
      player.hand.forEach((cardInfo) => {
        const slot = buildAbracaCardSlot(cardInfo);
        handRow.appendChild(slot);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "player-slot empty";
      empty.textContent = "-";
      handRow.appendChild(empty);
    }
    card.appendChild(handRow);

    if (player.player_id === view.you && Array.isArray(player.secret_cards) && player.secret_cards.length) {
      const meta = document.createElement("div");
      meta.className = "player-meta abraca-secret-meta";
      const label = document.createElement("div");
      label.className = "abraca-secret-label";
      label.textContent = "Secret cards";
      const list = document.createElement("div");
      list.className = "abraca-secret-list";
      player.secret_cards.forEach((cardInfo) => {
        list.appendChild(buildAbracaCardSlot(cardInfo, { compact: true }));
      });
      meta.appendChild(label);
      meta.appendChild(list);
      card.appendChild(meta);
    }

    abracaPlayers.appendChild(card);
  });
}

function isAbracaActionAvailable(actionType, spellType) {
  if (!currentAbracaView || !Array.isArray(currentAbracaView.legal_actions)) {
    return false;
  }
  if (!currentAbracaView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "cast_spell") {
    if (!Array.isArray(currentAbracaView.allowed_spells)) {
      return false;
    }
    return currentAbracaView.allowed_spells.includes(spellType);
  }
  return true;
}

function updateAbracaActionButtons() {
  if (abracaSpellButtons.length) {
    abracaSpellButtons.forEach((button) => {
      const spellType = Number.parseInt(button.dataset.spell, 10);
      const allowed = isAbracaActionAvailable("cast_spell", spellType);
      button.disabled = !allowed;
      button.classList.toggle("action-allowed", allowed);
    });
  }
  const buttonMap = [
    { type: "roll_dice", el: abracaRollBtn },
    { type: "take_secret", el: abracaSecretBtn },
    { type: "end_turn", el: abracaEndTurnBtn },
    { type: "start_next_round", el: abracaNextRoundBtn },
  ];
  buttonMap.forEach(({ type, el }) => {
    if (!el) {
      return;
    }
    const allowed = isAbracaActionAvailable(type);
    el.disabled = !allowed;
    el.classList.toggle("action-allowed", allowed);
  });
}

function updateAbracaNewGameRow(view) {
  if (!abracaNewGameRow) {
    return;
  }
  abracaNewGameRow.classList.toggle("hidden", !(view && view.game_over));
}

function renderAbracaGameState(data) {
  const view = data.view;
  currentAbracaView = view;
  if (currentGameType !== "abraca_what") {
    currentGameType = "abraca_what";
    setGamePanelVisibility("abraca_what");
  }

  if (abracaPhaseLabel) {
    abracaPhaseLabel.textContent = view.phase || "-";
  }
  if (abracaRoundLabel) {
    abracaRoundLabel.textContent = view.round ?? "-";
  }
  if (abracaTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    abracaTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (abracaDeckLabel) {
    abracaDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (abracaSecretPoolLabel) {
    abracaSecretPoolLabel.textContent = view.secret_pool_count ?? "-";
  }
  if (abracaDiscardLabel) {
    abracaDiscardLabel.textContent = view.discard_total ?? "-";
  }
  if (abracaChainMinLabel) {
    if (Number.isInteger(view.min_spell)) {
      abracaChainMinLabel.textContent = String(view.min_spell + 1);
    } else {
      abracaChainMinLabel.textContent = "-";
    }
  }
  if (abracaLastActionLabel) {
    abracaLastActionLabel.textContent = formatAbracaLastAction(view);
  }
  if (abracaRoundResultLabel) {
    abracaRoundResultLabel.textContent = formatAbracaRoundResult(view);
  }
  updateAbracaRoundNotice(view);
  updateAbracaNewGameRow(view);

  renderAbracaSpells(view);
  renderAbracaPlayers(view);
  logGameEvents(data);
  updateAbracaActionButtons();
}

function getFangNiaoConfig(view) {
  return view && Array.isArray(view.bird_config) ? view.bird_config : [];
}

function getFangNiaoConfigMap(view) {
  const map = {};
  getFangNiaoConfig(view).forEach((item) => {
    if (item && item.id) {
      map[item.id] = item;
    }
  });
  return map;
}

function countFangNiaoCards(hand) {
  const counts = {};
  (hand || []).forEach((card) => {
    counts[card] = (counts[card] || 0) + 1;
  });
  return counts;
}

function formatFangNiaoBirdLabel(view, birdType) {
  const meta = FANG_NIAO_BIRD_META[birdType] || {};
  const configMap = getFangNiaoConfigMap(view);
  const cfg = configMap[birdType] || {};
  const name = meta.name || cfg.name || birdType || "-";
  const emoji = meta.emoji || "🐦";
  return `${emoji} ${name}`;
}

function isFangNiaoBankable(view, birdType) {
  if (!view || !birdType) {
    return false;
  }
  const configMap = getFangNiaoConfigMap(view);
  const cfg = configMap[birdType];
  if (!cfg) {
    return false;
  }
  const counts = countFangNiaoCards(Array.isArray(view.hand) ? view.hand : []);
  const count = counts[birdType] || 0;
  const small = Number(cfg.small);
  if (Number.isFinite(small)) {
    return count >= small;
  }
  return count > 0;
}

function updateFangNiaoSelectionLabels() {
  if (fangNiaoSelectedBirdLabel) {
    if (fangNiaoSelectedBird) {
      fangNiaoSelectedBirdLabel.textContent = formatFangNiaoBirdLabel(currentFangNiaoView, fangNiaoSelectedBird);
    } else {
      fangNiaoSelectedBirdLabel.textContent = "-";
    }
  }
  if (fangNiaoSelectedRowLabel) {
    fangNiaoSelectedRowLabel.textContent =
      Number.isInteger(fangNiaoSelectedRow) ? `Row ${fangNiaoSelectedRow + 1}` : "-";
  }
  if (fangNiaoSelectedSideLabel) {
    if (fangNiaoSelectedSide === "left") {
      fangNiaoSelectedSideLabel.textContent = "Left ⬅️";
    } else if (fangNiaoSelectedSide === "right") {
      fangNiaoSelectedSideLabel.textContent = "Right ➡️";
    } else {
      fangNiaoSelectedSideLabel.textContent = "-";
    }
  }
}

function selectFangNiaoRow(rowIndex, side) {
  fangNiaoSelectedRow = rowIndex;
  fangNiaoSelectedSide = side;
  updateFangNiaoSelectionLabels();
  updateFangNiaoActionButtons();
  if (currentFangNiaoView) {
    renderFangNiaoRows(currentFangNiaoView);
  }
}

function renderFangNiaoRows(view) {
  if (!fangNiaoRows) {
    return;
  }
  fangNiaoRows.innerHTML = "";
  const rows = Array.isArray(view.rows) ? view.rows : [];
  if (!rows.length) {
    fangNiaoRows.textContent = "-";
    return;
  }
  rows.forEach((row, idx) => {
    const isSelectedRow = idx === fangNiaoSelectedRow;
    const hasPreview =
      isSelectedRow && !!fangNiaoSelectedBird && (fangNiaoSelectedSide === "left" || fangNiaoSelectedSide === "right");
    const captureIndices = [];
    if (hasPreview && Array.isArray(row) && row.length) {
      let matchIndex = -1;
      if (fangNiaoSelectedSide === "left") {
        matchIndex = row.findIndex((birdType) => birdType === fangNiaoSelectedBird);
        if (matchIndex > 0) {
          for (let i = 0; i < matchIndex; i += 1) {
            captureIndices.push(i);
          }
        }
      } else if (fangNiaoSelectedSide === "right") {
        for (let i = row.length - 1; i >= 0; i -= 1) {
          if (row[i] === fangNiaoSelectedBird) {
            matchIndex = i;
            break;
          }
        }
        if (matchIndex >= 0 && matchIndex < row.length - 1) {
          for (let i = matchIndex + 1; i < row.length; i += 1) {
            captureIndices.push(i);
          }
        }
      }
    }

    const rowEl = document.createElement("div");
    rowEl.className = "fang-niao-row";
    if (isSelectedRow) {
      rowEl.classList.add("selected");
    }

    const labelEl = document.createElement("div");
    labelEl.className = "fang-niao-row-label";
    labelEl.textContent = `Row ${idx + 1}`;

    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "fang-niao-side-btn";
    leftBtn.textContent = "⬅️";
    if (idx === fangNiaoSelectedRow && fangNiaoSelectedSide === "left") {
      leftBtn.classList.add("selected");
    }
    leftBtn.addEventListener("click", () => selectFangNiaoRow(idx, "left"));

    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "fang-niao-side-btn";
    rightBtn.textContent = "➡️";
    if (idx === fangNiaoSelectedRow && fangNiaoSelectedSide === "right") {
      rightBtn.classList.add("selected");
    }
    rightBtn.addEventListener("click", () => selectFangNiaoRow(idx, "right"));

    const cardsEl = document.createElement("div");
    cardsEl.className = "fang-niao-row-cards";
    if (!Array.isArray(row) || !row.length) {
      const empty = document.createElement("span");
      empty.className = "fang-niao-card";
      empty.textContent = "-";
      cardsEl.appendChild(empty);
    } else {
      row.forEach((birdType, cardIndex) => {
        const meta = FANG_NIAO_BIRD_META[birdType] || {};
        const name = meta.name || birdType;
        const emoji = meta.emoji || "🐦";
        const chip = document.createElement("span");
        chip.className = "fang-niao-card";
        chip.textContent = `${emoji} ${name}`;
        chip.title = name;
        if (cardIndex === 0 || cardIndex === row.length - 1) {
          chip.classList.add("fang-niao-card-end");
        }
        if (hasPreview && captureIndices.includes(cardIndex)) {
          chip.classList.add("fang-niao-card-capture");
        }
        if (meta.color) {
          chip.style.backgroundColor = meta.color;
        }
        cardsEl.appendChild(chip);
      });
    }

    if (hasPreview) {
      const previewTag = document.createElement("span");
      previewTag.className = "fang-niao-capture-preview";
      if (captureIndices.length) {
        previewTag.classList.add("ok");
        previewTag.textContent = `可吃 ${captureIndices.length} 张`;
      } else {
        previewTag.classList.add("none");
        previewTag.textContent = "无可吃";
      }
      cardsEl.appendChild(previewTag);
    }

    rowEl.appendChild(labelEl);
    rowEl.appendChild(leftBtn);
    rowEl.appendChild(cardsEl);
    rowEl.appendChild(rightBtn);
    fangNiaoRows.appendChild(rowEl);
  });
}

function renderFangNiaoHand(view) {
  if (!fangNiaoHand) {
    return;
  }
  fangNiaoHand.innerHTML = "";
  const hand = Array.isArray(view.hand) ? view.hand : [];
  if (!hand.length) {
    fangNiaoHand.textContent = "-";
    return;
  }
  const counts = countFangNiaoCards(hand);
  const configList = getFangNiaoConfig(view);
  const configMap = getFangNiaoConfigMap(view);
  const order = configList.length ? configList.map((cfg) => cfg.id) : Object.keys(counts);
  order.forEach((birdType) => {
    const count = counts[birdType] || 0;
    if (!count) {
      return;
    }
    const meta = FANG_NIAO_BIRD_META[birdType] || {};
    const cfg = configMap[birdType] || {};
    const labelName = meta.name || cfg.name || birdType;
    const labelEmoji = meta.emoji || "🐦";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fang-niao-hand-btn";
    if (birdType === fangNiaoSelectedBird) {
      btn.classList.add("selected");
    }
    const small = Number(cfg.small);
    if (Number.isFinite(small) && count >= small) {
      btn.classList.add("bankable");
    }
    const titleSpan = document.createElement("span");
    titleSpan.className = "fang-niao-hand-title";
    titleSpan.textContent = `${labelEmoji} ${labelName} ×${count}`;
    btn.appendChild(titleSpan);
    const big = Number(cfg.big);
    if (Number.isFinite(small)) {
      const thresholdSpan = document.createElement("span");
      thresholdSpan.className = "fang-niao-hand-threshold";
      thresholdSpan.textContent = `小${cfg.small} / 大${Number.isFinite(big) ? cfg.big : "-"}`;
      btn.appendChild(thresholdSpan);
    }
    btn.title = Number.isFinite(small) ? `S${cfg.small} / B${cfg.big || "-"}` : "";
    if (meta.color) {
      btn.style.borderColor = meta.color;
    }
    btn.addEventListener("click", () => {
      fangNiaoSelectedBird = birdType;
      updateFangNiaoSelectionLabels();
      updateFangNiaoActionButtons();
      renderFangNiaoRows(view);
      renderFangNiaoHand(view);
    });
    fangNiaoHand.appendChild(btn);
  });
}

function renderFangNiaoPlayers(view) {
  if (!fangNiaoPlayers) {
    return;
  }
  fangNiaoPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  const configList = getFangNiaoConfig(view);
  const order = configList.length ? configList.map((cfg) => cfg.id) : [];
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "fang-niao-player";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    const header = document.createElement("div");
    header.className = "fang-niao-player-header";
    const handCount = Number.isInteger(player.hand_count) ? player.hand_count : (player.hand_count ?? "-");
    header.textContent = `${player.name || player.player_id} · Hand ${handCount}`;
    card.appendChild(header);

    const collection = document.createElement("div");
    collection.className = "fang-niao-collection";
    const entries = player.collection || {};
    let hasChip = false;
    const birdOrder = order.length ? order : Object.keys(entries);
    birdOrder.forEach((birdType) => {
      const count = entries[birdType];
      if (!count) {
        return;
      }
      hasChip = true;
      const meta = FANG_NIAO_BIRD_META[birdType] || {};
      const chip = document.createElement("div");
      chip.className = "fang-niao-collection-chip";
      chip.textContent = `${meta.emoji || "🐦"} ${meta.name || birdType} ×${count}`;
      if (meta.color) {
        chip.style.backgroundColor = meta.color;
      }
      collection.appendChild(chip);
    });
    if (!hasChip) {
      collection.textContent = "-";
    }
    card.appendChild(collection);
    fangNiaoPlayers.appendChild(card);
  });
}

function formatFangNiaoLastAction(view) {
  const last = view.last_action;
  if (!last || !last.type) {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  if (last.type === "play") {
    const bird = formatFangNiaoBirdLabel(view, last.bird_type);
    const rowLabel = Number.isInteger(last.row_index) ? `Row ${last.row_index + 1}` : "Row ?";
    const sideLabel = last.side === "left" ? "Left ⬅️" : last.side === "right" ? "Right ➡️" : "-";
    const captured = Number.isInteger(last.captured) ? `, captured ${last.captured}` : "";
    const drew = Number.isInteger(last.drew) && last.drew > 0 ? `, drew ${last.drew}` : "";
    return `${actor}: ${bird} → ${rowLabel} ${sideLabel}${captured}${drew}`;
  }
  if (last.type === "bank") {
    const bird = formatFangNiaoBirdLabel(view, last.bird_type);
    const kept = Number.isInteger(last.kept) ? last.kept : "-";
    const discarded = Number.isInteger(last.discarded) ? last.discarded : "-";
    return `${actor}: bank ${bird} (keep ${kept}, discard ${discarded})`;
  }
  if (last.type === "end") {
    return last.reset ? `${actor}: end turn (reset)` : `${actor}: end turn`;
  }
  return `${actor}: ${last.type}`;
}

function updateFangNiaoActionButtons() {
  if (!fangNiaoPlayBtn && !fangNiaoBankBtn && !fangNiaoEndBtn) {
    return;
  }
  const view = currentFangNiaoView;
  const legal = view && Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const canPlay =
    legal.includes("play_birds") &&
    fangNiaoSelectedBird &&
    Number.isInteger(fangNiaoSelectedRow) &&
    !!fangNiaoSelectedSide;
  const canBank =
    legal.includes("bank_birds") &&
    fangNiaoSelectedBird &&
    isFangNiaoBankable(view, fangNiaoSelectedBird);
  const canEnd = legal.includes("end_turn");

  if (fangNiaoPlayBtn) {
    fangNiaoPlayBtn.disabled = !canPlay;
  }
  if (fangNiaoBankBtn) {
    fangNiaoBankBtn.disabled = !canBank;
  }
  if (fangNiaoEndBtn) {
    fangNiaoEndBtn.disabled = !canEnd;
  }
}

function renderFangNiaoGameState(data) {
  const view = data.view;
  currentFangNiaoView = view;
  if (currentGameType !== "fang_niao") {
    currentGameType = "fang_niao";
    setGamePanelVisibility("fang_niao");
  }

  if (fangNiaoSelectedBird && (!Array.isArray(view.hand) || !view.hand.includes(fangNiaoSelectedBird))) {
    fangNiaoSelectedBird = null;
  }
  if (Number.isInteger(fangNiaoSelectedRow)) {
    if (!Array.isArray(view.rows) || fangNiaoSelectedRow >= view.rows.length) {
      fangNiaoSelectedRow = null;
      fangNiaoSelectedSide = null;
    }
  }
  if (!Number.isInteger(fangNiaoSelectedRow)) {
    fangNiaoSelectedSide = null;
  }

  if (fangNiaoPhaseLabel) {
    fangNiaoPhaseLabel.textContent = view.phase || "-";
  }
  if (fangNiaoTurnLabel) {
    const currentPlayer = (view.players || []).find((p) => p.player_id === view.current_turn);
    fangNiaoTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (fangNiaoDeckLabel) {
    fangNiaoDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (fangNiaoDiscardLabel) {
    fangNiaoDiscardLabel.textContent = view.discard_count ?? "-";
  }
  if (fangNiaoWinnerLabel) {
    fangNiaoWinnerLabel.textContent = view.winner ? findPlayerName(view, view.winner) : "-";
  }
  if (fangNiaoLastActionLabel) {
    fangNiaoLastActionLabel.textContent = formatFangNiaoLastAction(view);
  }

  renderFangNiaoRows(view);
  renderFangNiaoHand(view);
  renderFangNiaoPlayers(view);
  updateFangNiaoSelectionLabels();
  updateFangNiaoActionButtons();
  logGameEvents(data);
}

function renderCaboGameState(data) {
  const view = data.view;
  currentCaboView = view;
  if (currentGameType !== "cabo") {
    currentGameType = "cabo";
    setGamePanelVisibility("cabo");
  }
  const needsTarget =
    view.pending_choice &&
    (view.pending_choice.type === "spy" || view.pending_choice.type === "swap");
  if (!needsTarget) {
    selectedTarget = null;
  } else if (selectedTarget) {
    const targetPlayer = view.players.find((p) => p.player_id === selectedTarget.playerId);
    const targetSlot =
      targetPlayer && Array.isArray(targetPlayer.hand)
        ? targetPlayer.hand[selectedTarget.slot]
        : null;
    if (!targetPlayer || !targetSlot || targetSlot.empty) {
      selectedTarget = null;
    }
  }

  phaseLabel.textContent = view.phase;
  roundLabel.textContent = view.round;
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  turnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn;
  deckCount.textContent = view.deck_count;
  discardTop.textContent = view.discard_top === null ? "-" : view.discard_top;
  if (view.last_drawn === null || view.last_drawn === undefined) {
    lastDrawn.textContent = "-";
  } else {
    const choiceMap = {
      7: "peek",
      8: "peek",
      9: "spy",
      10: "spy",
      11: "swap",
      12: "swap",
    };
    const choice = choiceMap[view.last_drawn];
    lastDrawn.textContent = choice ? `${view.last_drawn} (${choice})` : String(view.last_drawn);
  }
  const caboCaller = view.players.find((p) => p.player_id === view.cabo_called_by);
  caboBy.textContent = caboCaller ? caboCaller.name : view.cabo_called_by || "-";
  caboLeft.textContent = view.cabo_turns_left || "-";
  pendingChoice.textContent = view.pending_choice ? view.pending_choice.type : "-";

  renderHand(view);
  renderGamePlayers(view);

  logGameEvents(data);

  if (view.last_round_summary) {
    const summary = view.last_round_summary;
    log(`Round summary: scores ${JSON.stringify(summary.round_scores)}`);
  }

  updateActionButtons();
}

function renderFlip7GameState(data) {
  const view = data.view;
  currentFlip7View = view;
  if (currentGameType !== "flip7") {
    currentGameType = "flip7";
    setGamePanelVisibility("flip7");
  }

  if (flip7PhaseLabel) {
    flip7PhaseLabel.textContent = view.phase || "-";
  }
  if (flip7RoundLabel) {
    flip7RoundLabel.textContent = view.round ?? "-";
  }
  if (flip7TurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    flip7TurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (flip7DeckLabel) {
    flip7DeckLabel.textContent = view.deck_count ?? "-";
  }
  if (flip7DiscardLabel) {
    flip7DiscardLabel.textContent = view.discard_count ?? "-";
  }
  if (flip7TargetScoreLabel) {
    flip7TargetScoreLabel.textContent = view.config ? view.config.target_score ?? "-" : "-";
  }
  if (flip7FlipWinnerLabel) {
    flip7FlipWinnerLabel.textContent = view.flip7_winner
      ? findPlayerName(view, view.flip7_winner)
      : "-";
  }
  if (flip7PendingLabel) {
    if (view.pending_action) {
      const actorName = view.pending_action.actor_id
        ? findPlayerName(view, view.pending_action.actor_id)
        : "-";
      flip7PendingLabel.textContent = `${view.pending_action.label} (${actorName})`;
    } else {
      flip7PendingLabel.textContent = "-";
    }
  }

  renderFlip7LastRound(view);
  renderFlip7Players(view);
  logGameEvents(data);
  updateFlip7ActionButtons();
}

function formatYahtzeeCategoryLabel(view, category) {
  if (view && view.category_labels && view.category_labels[category]) {
    return view.category_labels[category];
  }
  return category || "-";
}

function renderYahtzeeDice(view) {
  if (!yahtzeeDice) {
    return;
  }
  yahtzeeDice.innerHTML = "";
  const dice = Array.isArray(view.dice) ? view.dice : [];
  const locked = Array.isArray(view.locked) ? view.locked : [];
  const canToggle = isYahtzeeActionAvailable("toggle_lock");
  for (let idx = 0; idx < 5; idx += 1) {
    const value = Number.isInteger(dice[idx]) ? dice[idx] : 0;
    const die = document.createElement("button");
    die.type = "button";
    die.className = "yahtzee-die";
    if (locked[idx]) {
      die.classList.add("locked");
    }
    const valueEl = document.createElement("span");
    valueEl.className = "yahtzee-die-value";
    valueEl.textContent = value > 0 ? String(value) : "-";
    const lockEl = document.createElement("span");
    lockEl.className = "yahtzee-die-lock";
    lockEl.textContent = "LOCKED";
    die.appendChild(valueEl);
    die.appendChild(lockEl);
    const dieIndex = idx + 1;
    if (locked[idx]) {
      die.setAttribute("aria-pressed", "true");
      die.setAttribute("aria-label", `Die ${dieIndex} locked; will not roll.`);
      die.title = "Locked: will not roll.";
    } else {
      die.setAttribute("aria-pressed", "false");
      die.setAttribute("aria-label", `Die ${dieIndex} unlocked; click to lock.`);
      die.title = "Click to lock (will not roll).";
    }
    if (!canToggle) {
      die.classList.add("disabled");
      die.disabled = true;
    } else {
      die.addEventListener("click", () => {
        sendAction({ type: "toggle_lock", index: idx });
      });
    }
    yahtzeeDice.appendChild(die);
  }
}

function renderYahtzeeScorecards(view) {
  if (!yahtzeeScorecards) {
    return;
  }
  yahtzeeScorecards.innerHTML = "";
  const categories = Array.isArray(view.category_order) ? view.category_order : [];
  const possibleScores = view.possible_scores || {};
  const allowed = new Set(view.allowed_categories || []);
  const canScore = isYahtzeeActionAvailable("score");
  const isViewerTurn = view.you && view.you === view.current_player;

  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "yahtzee-scorecard player-card";
    if (player.player_id === view.current_player) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }

    const header = document.createElement("div");
    header.className = "yahtzee-scorecard-header";
    const nameEl = document.createElement("div");
    const nameLabel = player.name || player.player_id || "-";
    nameEl.textContent = player.player_id === view.you ? `${nameLabel} (You)` : nameLabel;
    const totalEl = document.createElement("div");
    const totalValue = Number.isInteger(player.total) ? player.total : 0;
    const upperTotal = Number.isInteger(player.upper_total) ? player.upper_total : 0;
    const lowerTotal = Number.isInteger(player.lower_total) ? player.lower_total : 0;
    const upperBonus = Number.isInteger(player.upper_bonus) ? player.upper_bonus : 0;
    const yahtzeeBonus = Number.isInteger(player.yahtzee_bonus) ? player.yahtzee_bonus : 0;
    totalEl.textContent = `Total: ${totalValue}`;
    const note = document.createElement("span");
    note.className = "yahtzee-score-note";
    note.textContent = `U ${upperTotal} + B ${upperBonus} + L ${lowerTotal} + Y ${yahtzeeBonus}`;
    totalEl.appendChild(note);
    header.appendChild(nameEl);
    header.appendChild(totalEl);
    card.appendChild(header);

    const rows = document.createElement("div");
    rows.className = "yahtzee-score-rows";
    categories.forEach((category, idx) => {
      const row = document.createElement("div");
      row.className = "yahtzee-score-row";
      if (idx < 6) {
        row.classList.add("upper");
      } else {
        row.classList.add("lower");
      }
      const label = document.createElement("div");
      label.textContent = formatYahtzeeCategoryLabel(view, category);
      const valueEl = document.createElement("div");
      valueEl.className = "yahtzee-score-value";

      const scoreSheet = player.score_sheet || {};
      const actual = scoreSheet[category];
      if (actual !== null && actual !== undefined) {
        row.classList.add("filled");
        valueEl.textContent = String(actual);
      } else {
        const isActivePlayer = player.player_id === view.current_player;
        const possible = isActivePlayer && allowed.has(category) ? possibleScores[category] : null;
        if (possible !== null && possible !== undefined) {
          valueEl.textContent = String(possible);
        } else {
          valueEl.textContent = "-";
        }
        const canSelect = isActivePlayer && isViewerTurn && canScore && allowed.has(category);
        if (canSelect) {
          row.classList.add("possible");
          row.addEventListener("click", () => {
            sendAction({ type: "score", category });
          });
        }
      }

      row.appendChild(label);
      row.appendChild(valueEl);
      rows.appendChild(row);
    });

    card.appendChild(rows);
    yahtzeeScorecards.appendChild(card);
  });
}

function renderYahtzeeGameState(data) {
  const view = data.view;
  currentYahtzeeView = view;
  if (currentGameType !== "yahtzee") {
    currentGameType = "yahtzee";
    setGamePanelVisibility("yahtzee");
  }
  if (yahtzeePhaseLabel) {
    yahtzeePhaseLabel.textContent = view.phase || "-";
  }
  if (yahtzeeRoundLabel) {
    yahtzeeRoundLabel.textContent = view.current_round ?? "-";
  }
  if (yahtzeeTurnLabel) {
    yahtzeeTurnLabel.textContent = view.current_player
      ? findPlayerName(view, view.current_player)
      : "-";
  }
  if (yahtzeeRollsLabel) {
    const rolls = Number.isInteger(view.roll_count) ? view.roll_count : 0;
    yahtzeeRollsLabel.textContent = `${rolls}/3`;
  }
  if (yahtzeeWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      yahtzeeWinnerLabel.textContent = view.winner.map((pid) => findPlayerName(view, pid)).join(", ");
    } else {
      yahtzeeWinnerLabel.textContent = "-";
    }
  }

  if (yahtzeeJokerNotice && yahtzeeJokerBody) {
    let jokerMessage = null;
    if (view.joker && view.current_player) {
      const mode = view.joker.mode;
      if (mode === "forced_upper") {
        const label = formatYahtzeeCategoryLabel(view, view.joker.forced_category);
        jokerMessage = `Must score ${label}.`;
      } else if (mode === "lower_choice") {
        jokerMessage = "Joker active: choose any lower category.";
      } else if (mode === "forced_zero") {
        jokerMessage = "Joker active: lower filled, must take 0 in upper.";
      }
    }
    if (jokerMessage) {
      yahtzeeJokerBody.textContent = jokerMessage;
      yahtzeeJokerNotice.classList.remove("hidden");
    } else {
      yahtzeeJokerBody.textContent = "-";
      yahtzeeJokerNotice.classList.add("hidden");
    }
  }

  renderYahtzeeDice(view);
  renderYahtzeeScorecards(view);
  logGameEvents(data);
  updateYahtzeeActionButtons();
}

function getGoldRushHand(view) {
  if (!view || !Array.isArray(view.players)) {
    return [];
  }
  const you = view.players.find((player) => player.player_id === view.you);
  return you && Array.isArray(you.hand) ? you.hand : [];
}

function resolveGoldRushColor(color) {
  if (!color) {
    return null;
  }
  const key = String(color).trim().toLowerCase();
  return GOLD_RUSH_COLOR_PALETTE[key] || color;
}

function parseGoldRushHexColor(color) {
  if (typeof color !== "string") {
    return null;
  }
  let hex = color.trim();
  if (!hex.startsWith("#")) {
    return null;
  }
  hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }
  if (hex.length !== 6) {
    return null;
  }
  const value = Number.parseInt(hex, 16);
  if (Number.isNaN(value)) {
    return null;
  }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function goldRushIsDarkColor(color) {
  const rgb = parseGoldRushHexColor(color);
  if (!rgb) {
    return false;
  }
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance < 140;
}

function goldRushSoftColor(color) {
  const rgb = parseGoldRushHexColor(color);
  if (!rgb) {
    return null;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`;
}

function applyGoldRushColorStyles(element, color) {
  if (!element) {
    return;
  }
  const resolved = resolveGoldRushColor(color);
  if (!resolved) {
    element.style.removeProperty("--gold-rush-color");
    element.style.removeProperty("--gold-rush-color-contrast");
    element.style.removeProperty("--gold-rush-color-soft");
    return;
  }
  element.style.setProperty("--gold-rush-color", resolved);
  const contrast = goldRushIsDarkColor(resolved) ? GOLD_RUSH_LIGHT_TEXT : GOLD_RUSH_DARK_TEXT;
  element.style.setProperty("--gold-rush-color-contrast", contrast);
  const soft = goldRushSoftColor(resolved);
  if (soft) {
    element.style.setProperty("--gold-rush-color-soft", soft);
  } else {
    element.style.removeProperty("--gold-rush-color-soft");
  }
}

function getGoldRushMineColors(view) {
  const colors = {};
  if (!view || !Array.isArray(view.mines)) {
    return colors;
  }
  view.mines.forEach((mine) => {
    const resolved = resolveGoldRushColor(mine.color);
    if (resolved) {
      colors[mine.id] = resolved;
    }
  });
  return colors;
}

function getGoldRushSelectedMineId(view) {
  const hand = getGoldRushHand(view);
  if (Number.isInteger(goldRushSelectedHandIndex)) {
    const selected = hand[goldRushSelectedHandIndex];
    if (selected && selected.type === "miner" && Number.isInteger(selected.mine_id)) {
      return selected.mine_id;
    }
  }
  const pending = view && view.pending_card;
  if (pending && pending.type === "miner" && Number.isInteger(pending.mine_id)) {
    return pending.mine_id;
  }
  return null;
}

function getGoldRushCardColor(card, mineColors) {
  if (!card) {
    return null;
  }
  if (card.type === "miner" && Number.isInteger(card.mine_id)) {
    return mineColors[card.mine_id] || null;
  }
  if (card.type === "gold") {
    return GOLD_RUSH_COLOR_PALETTE.gold;
  }
  return null;
}

function goldRushCardLabel(card, mineNames) {
  if (!card) {
    return "-";
  }
  if (card.type === "gold") {
    return `$${card.value ?? 0}`;
  }
  if (card.type === "miner") {
    const mineName = mineNames && Number.isInteger(card.mine_id) ? mineNames[card.mine_id] : null;
    return mineName ? `${mineName} Miner` : `Miner ${card.mine_id ?? "-"}`;
  }
  return "Unknown";
}

function goldRushMineHighlight(view, mine) {
  if (!view || view.phase !== "awaiting_gold_placement") {
    return null;
  }
  if (view.current_turn !== view.you) {
    return null;
  }
  if (mine.gold_count >= (view.max_gold_cards ?? 6)) {
    return null;
  }
  const tokens = mine.tokens_by_player || {};
  const entries = Object.entries(tokens).map(([pid, count]) => [pid, Number(count) || 0]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) {
    return { className: "gold-rush-highlight-neutral", icon: "-" };
  }
  const maxTokens = Math.max(...entries.map(([, count]) => count));
  const leaders = entries.filter(([, count]) => count === maxTokens && count > 0).map(([pid]) => pid);
  if (leaders.length > 1) {
    return { className: "gold-rush-highlight-contested", icon: "=" };
  }
  if (leaders[0] === view.you) {
    return { className: "gold-rush-highlight-safe", icon: "OK" };
  }
  return { className: "gold-rush-highlight-danger", icon: "X" };
}

function renderGoldRushHand(view, mineNames) {
  if (!goldRushHand) {
    return;
  }
  goldRushHand.innerHTML = "";
  const hand = getGoldRushHand(view);
  const mineColors = getGoldRushMineColors(view);
  if (!hand.length) {
    const empty = document.createElement("div");
    empty.className = "gold-rush-empty";
    empty.textContent = view.mode === "classic" ? "Classic mode (no hand)" : "No cards";
    goldRushHand.appendChild(empty);
    return;
  }
  hand.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gold-rush-card";
    if (index === goldRushSelectedHandIndex) {
      button.classList.add("selected");
    }
    button.textContent = goldRushCardLabel(card, mineNames);
    applyGoldRushColorStyles(button, getGoldRushCardColor(card, mineColors));
    button.addEventListener("click", () => {
      goldRushSelectedHandIndex = index;
      renderGoldRushHand(view, mineNames);
      updateGoldRushSelectionLabel(view, mineNames);
      renderGoldRushMines(view);
      updateGoldRushActionButtons();
    });
    goldRushHand.appendChild(button);
  });
}

function updateGoldRushSelectionLabel(view, mineNames) {
  if (!goldRushSelectedCardLabel) {
    return;
  }
  let resolvedMineNames = mineNames;
  if (!resolvedMineNames && view && Array.isArray(view.mines)) {
    resolvedMineNames = {};
    view.mines.forEach((mine) => {
      resolvedMineNames[mine.id] = mine.name;
    });
  }
  const hand = getGoldRushHand(view);
  if (
    !Number.isInteger(goldRushSelectedHandIndex) ||
    goldRushSelectedHandIndex < 0 ||
    goldRushSelectedHandIndex >= hand.length
  ) {
    goldRushSelectedHandIndex = null;
    goldRushSelectedCardLabel.textContent = "-";
    return;
  }
  goldRushSelectedCardLabel.textContent = goldRushCardLabel(hand[goldRushSelectedHandIndex], resolvedMineNames);
}

function renderGoldRushMines(view) {
  if (!goldRushMines) {
    return;
  }
  goldRushMines.innerHTML = "";
  if (!view || !Array.isArray(view.mines)) {
    return;
  }
  const players = Array.isArray(view.players) ? view.players : [];
  const mineNames = {};
  const selectedMineId = getGoldRushSelectedMineId(view);
  view.mines.forEach((mine) => {
    mineNames[mine.id] = mine.name;
  });
  view.mines.forEach((mine) => {
    const canPlace =
      view.legal_actions &&
      view.legal_actions.includes("place_gold") &&
      view.current_turn === view.you &&
      mine.gold_count < (view.max_gold_cards ?? 6);
    const wrapper = document.createElement("button");
    wrapper.type = "button";
    wrapper.className = "gold-rush-mine";
    wrapper.disabled = !canPlace;
    applyGoldRushColorStyles(wrapper, mine.color);
    if (Number.isInteger(selectedMineId) && mine.id === selectedMineId) {
      wrapper.classList.add("selected");
    }

    const highlight = goldRushMineHighlight(view, mine);
    if (highlight) {
      wrapper.classList.add(highlight.className);
      const icon = document.createElement("div");
      icon.className = "gold-rush-highlight-icon";
      icon.textContent = highlight.icon;
      wrapper.appendChild(icon);
    }

    const title = document.createElement("div");
    title.className = "gold-rush-mine-title";
    title.textContent = mine.name || `Mine ${mine.id}`;
    wrapper.appendChild(title);

    const miners = document.createElement("div");
    miners.className = "gold-rush-mine-row";
    miners.textContent = `Miners: ${mine.miners_count ?? 0}`;
    wrapper.appendChild(miners);

    const gold = document.createElement("div");
    gold.className = "gold-rush-mine-row";
    const maxGold = view.max_gold_cards ?? 6;
    gold.textContent = `Gold: ${mine.gold_count ?? 0}/${maxGold} (Total ${mine.gold_total ?? 0})`;
    wrapper.appendChild(gold);

    const tokensRow = document.createElement("div");
    tokensRow.className = "gold-rush-mine-row";
    const tokens = mine.tokens_by_player || {};
    const tokenEntries = players
      .map((player) => {
        const count = tokens[player.player_id] || 0;
        if (!count) {
          return null;
        }
        return `${player.name || player.player_id}: ${count}`;
      })
      .filter(Boolean);
    tokensRow.textContent = tokenEntries.length ? `Tokens: ${tokenEntries.join(", ")}` : "Tokens: -";
    wrapper.appendChild(tokensRow);

    if (canPlace) {
      wrapper.classList.add("action-allowed");
      wrapper.addEventListener("click", () => {
        sendAction({ type: "place_gold", mine_id: mine.id });
      });
    }

    goldRushMines.appendChild(wrapper);
  });
}

function renderGoldRushPlayers(view) {
  if (!goldRushPlayers) {
    return;
  }
  goldRushPlayers.innerHTML = "";
  if (!view || !Array.isArray(view.players)) {
    return;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "gold-rush-player-card";
    const name = document.createElement("div");
    name.className = "gold-rush-player-name";
    name.textContent = player.name || player.player_id;
    card.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "gold-rush-player-meta";
    const tags = [
      `score ${player.score ?? 0}`,
      `tokens ${player.tokens_available ?? 0}`,
      `hand ${player.hand_count ?? 0}`,
    ];
    if (player.player_id === view.current_turn) {
      tags.push("turn");
    }
    if (player.player_id === view.you) {
      tags.push("you");
    }
    if (player.is_bot) {
      tags.push("bot");
    }
    meta.textContent = tags.join(" · ");
    card.appendChild(meta);
    goldRushPlayers.appendChild(card);
  });
}

function renderGoldRushScoreBreakdown(view) {
  if (!goldRushScoreBreakdown) {
    return;
  }
  goldRushScoreBreakdown.innerHTML = "";
  if (!view || !view.game_over || !Array.isArray(view.score_breakdown)) {
    goldRushScoreBreakdown.textContent = "-";
    return;
  }
  const players = Array.isArray(view.players) ? view.players : [];
  view.score_breakdown.forEach((entry) => {
    const line = document.createElement("div");
    line.className = "gold-rush-score-line";
    const gains = entry.gains_by_player || {};
    const gainsText = players
      .map((player) => `${player.name || player.player_id}: ${gains[player.player_id] || 0}`)
      .join(", ");
    line.textContent = `${entry.mine_name || `Mine ${entry.mine_id}`}: pot ${entry.total_gold ?? 0}, tokens ${
      entry.total_tokens ?? 0
    }, share ${entry.share ?? 0}, remainder ${entry.remainder ?? 0}, gains ${gainsText}`;
    goldRushScoreBreakdown.appendChild(line);
  });
}

function renderGoldRushGameState(data) {
  const view = data.view;
  currentGoldRushView = view;
  if (currentGameType !== "gold_rush") {
    currentGameType = "gold_rush";
    setGamePanelVisibility("gold_rush");
  }

  if (goldRushPhaseLabel) {
    goldRushPhaseLabel.textContent = view.phase || "-";
  }
  if (goldRushModeLabel) {
    goldRushModeLabel.textContent = view.mode || "-";
  }
  if (goldRushTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    goldRushTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (goldRushDeckLabel) {
    goldRushDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (goldRushWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      goldRushWinnerLabel.textContent = names.join(", ");
    } else {
      goldRushWinnerLabel.textContent = "-";
    }
  }

  const mineNames = {};
  if (Array.isArray(view.mines)) {
    view.mines.forEach((mine) => {
      mineNames[mine.id] = mine.name;
    });
  }

  const hand = getGoldRushHand(view);
  if (goldRushSelectedHandIndex !== null && goldRushSelectedHandIndex >= hand.length) {
    goldRushSelectedHandIndex = null;
  }

  renderGoldRushHand(view, mineNames);
  updateGoldRushSelectionLabel(view, mineNames);
  renderGoldRushMines(view);
  renderGoldRushPlayers(view);
  renderGoldRushScoreBreakdown(view);
  logGameEvents(data);
  updateGoldRushActionButtons();
}

function formatIncanGoldHazard(hazard) {
  if (!hazard) {
    return "Unknown";
  }
  const emoji = INCAN_GOLD_HAZARD_ICONS[hazard] || "⚠️";
  const label = hazard.replace(/_/g, " ");
  return `${emoji} ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function renderIncanGoldPath(view) {
  if (!incanGoldPath) {
    return;
  }
  incanGoldPath.innerHTML = "";
  if (!view || !Array.isArray(view.path) || !view.path.length) {
    const empty = document.createElement("div");
    empty.className = "gold-rush-empty";
    empty.textContent = "No cards yet";
    incanGoldPath.appendChild(empty);
    return;
  }
  view.path.forEach((card) => {
    const wrapper = document.createElement("div");
    wrapper.className = `incan-gold-card ${card.type || ""}`;

    const title = document.createElement("div");
    title.className = "incan-gold-card-title";
    if (card.type === "treasure") {
      title.textContent = `💎 Treasure ${card.value ?? 0}`;
    } else if (card.type === "hazard") {
      title.textContent = formatIncanGoldHazard(card.hazard);
    } else if (card.type === "artifact") {
      title.textContent = `🏺 Artifact ${card.value ?? 0}`;
    } else {
      title.textContent = "Unknown";
    }
    wrapper.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "incan-gold-card-meta";
    if (card.type === "treasure") {
      meta.textContent = `Remainder: ${card.remainder ?? 0}`;
    } else if (card.type === "hazard") {
      meta.textContent = card.triggered ? "Triggered" : "Warning";
    } else if (card.type === "artifact") {
      meta.textContent = "Solo leaver only";
    }
    wrapper.appendChild(meta);

    incanGoldPath.appendChild(wrapper);
  });
}

function renderIncanGoldPlayers(view) {
  if (!incanGoldPlayers) {
    return;
  }
  incanGoldPlayers.innerHTML = "";
  if (!view || !Array.isArray(view.players)) {
    return;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "incan-gold-player";

    const name = document.createElement("div");
    name.className = "incan-gold-player-name";
    const tags = [];
    if (player.player_id === view.you) {
      tags.push("you");
    }
    if (player.is_bot) {
      tags.push("bot");
    }
    if (player.status === "in_cave") {
      tags.push("in cave");
    } else {
      tags.push("in camp");
    }
    name.textContent = `${player.name || player.player_id} (${tags.join(", ")})`;
    card.appendChild(name);

    const line1 = document.createElement("div");
    line1.className = "incan-gold-player-line";
    line1.textContent = `Banked 💎 ${player.banked_gems ?? 0} · Hand 💎 ${player.hand_gems ?? 0}`;
    card.appendChild(line1);

    const line2 = document.createElement("div");
    line2.className = "incan-gold-player-line";
    line2.textContent = `Artifacts 🏺 ${player.artifact_count ?? 0} (+${player.artifact_points ?? 0}) · Total ${
      player.total_score ?? 0
    }`;
    card.appendChild(line2);

    const line3 = document.createElement("div");
    line3.className = "incan-gold-player-line";
    line3.textContent = `Decided: ${player.decided ? "yes" : "no"}`;
    card.appendChild(line3);

    incanGoldPlayers.appendChild(card);
  });
}

function renderIncanGoldHazards(view) {
  if (!incanGoldRemovedHazards) {
    return;
  }
  incanGoldRemovedHazards.innerHTML = "";
  const removed = (view && view.removed_hazards) || {};
  const order = ["snake", "spider", "fire", "rockfall", "mummy"];
  order.forEach((hazard) => {
    const chip = document.createElement("div");
    chip.className = "incan-gold-hazard-chip";
    const count = removed[hazard] ?? 0;
    chip.textContent = `${formatIncanGoldHazard(hazard)} × ${count}`;
    incanGoldRemovedHazards.appendChild(chip);
  });
}

function renderIncanGoldRoundNotice(view) {
  if (!incanGoldRoundNotice || !incanGoldRoundNoticeBody || !incanGoldRoundNoticeTitle) {
    return;
  }
  const roundEnd = view && view.round_end ? view.round_end : {};
  if (!roundEnd || !roundEnd.reason) {
    incanGoldRoundNotice.classList.add("hidden");
    incanGoldRoundNotice.setAttribute("aria-hidden", "true");
    return;
  }
  incanGoldRoundNotice.classList.remove("hidden");
  incanGoldRoundNotice.setAttribute("aria-hidden", "false");
  incanGoldRoundNoticeTitle.textContent = view.game_over ? "Game Over" : "Round End";
  let body = "";
  if (roundEnd.reason === "hazard") {
    body = `💥 Hazard: ${formatIncanGoldHazard(roundEnd.hazard)}`;
  } else if (roundEnd.reason === "all_left") {
    body = "All explorers returned safely.";
  } else if (roundEnd.reason === "deck_empty") {
    body = "Deck empty: explorers returned safely.";
  } else {
    body = roundEnd.reason;
  }
  if (roundEnd.artifacts_removed) {
    body += ` · Artifacts removed: ${roundEnd.artifacts_removed}`;
  }
  incanGoldRoundNoticeBody.textContent = body;
}

function renderIncanGoldGameState(data) {
  const view = data.view;
  currentIncanGoldView = view;
  if (currentGameType !== "incan_gold") {
    currentGameType = "incan_gold";
    setGamePanelVisibility("incan_gold");
  }

  if (incanGoldPhaseLabel) {
    incanGoldPhaseLabel.textContent = view.phase || "-";
  }
  if (incanGoldRoundLabel) {
    incanGoldRoundLabel.textContent = view.round ?? "-";
  }
  if (incanGoldMaxRoundsLabel) {
    incanGoldMaxRoundsLabel.textContent = view.max_rounds ?? "-";
  }
  if (incanGoldDeckLabel) {
    incanGoldDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (incanGoldInCaveLabel) {
    incanGoldInCaveLabel.textContent = view.in_cave_count ?? "-";
  }
  if (incanGoldDecidedLabel) {
    const decided = view.decided_count ?? 0;
    const total = view.in_cave_count ?? "-";
    incanGoldDecidedLabel.textContent = `${decided}/${total}`;
  }
  if (incanGoldChoiceLabel) {
    if (view.your_decision === "continue") {
      incanGoldChoiceLabel.textContent = "Continue";
    } else if (view.your_decision === "leave") {
      incanGoldChoiceLabel.textContent = "Leave";
    } else {
      incanGoldChoiceLabel.textContent = "-";
    }
  }
  if (incanGoldWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      incanGoldWinnerLabel.textContent = names.join(", ");
    } else {
      incanGoldWinnerLabel.textContent = "-";
    }
  }

  renderIncanGoldRoundNotice(view);
  renderIncanGoldPath(view);
  renderIncanGoldPlayers(view);
  renderIncanGoldHazards(view);
  logGameEvents(data);
  updateIncanGoldActionButtons();
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

function renderSkullGameState(data) {
  const view = data.view;
  currentSkullView = view;
  if (currentGameType !== "skull") {
    currentGameType = "skull";
    setGamePanelVisibility("skull");
  }
  if (skullSelectedTarget && !view.players.find((p) => p.player_id === skullSelectedTarget)) {
    skullSelectedTarget = null;
  }
  if (skullSelectedCardIndex !== null && (!view.hand || skullSelectedCardIndex >= view.hand.length)) {
    skullSelectedCardIndex = null;
    skullSelectedCardType = null;
  }

  skullPhaseLabel.textContent = view.phase;
  skullRoundLabel.textContent = view.round;
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  skullTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  skullBidLabel.textContent = view.current_bid ?? "-";
  skullBidderLabel.textContent = view.bidder ? findPlayerName(view, view.bidder) : "-";
  if (Array.isArray(view.passed) && view.passed.length) {
    skullPassedLabel.textContent = view.passed.map((pid) => findPlayerName(view, pid)).join(", ");
  } else {
    skullPassedLabel.textContent = "-";
  }
  skullRosesLabel.textContent = view.roses_revealed ?? "-";
  if (view.last_reveal) {
    skullLastRevealLabel.textContent = `${findPlayerName(view, view.last_reveal.player_id)} -> ${view.last_reveal.card}`;
  } else {
    skullLastRevealLabel.textContent = "-";
  }
  skullWinnerLabel.textContent = view.winner ? findPlayerName(view, view.winner) : "-";

  renderSkullHand(view);
  renderSkullTargets(view);
  renderSkullPlayers(view);

  logGameEvents(data);

  if (view.last_round_summary) {
    const summary = view.last_round_summary;
    if (summary.result === "success") {
      log(`Round success: bidder ${findPlayerName(view, summary.bidder)} bid ${summary.bid}`);
    } else {
      log(`Round fail: bidder ${findPlayerName(view, summary.bidder)} hit ${findPlayerName(view, summary.skull_owner)}`);
    }
  }

  updateSkullSelectedCard();
  updateSkullTargetSelection();
  updateSkullActionButtons();
}

function renderCatInBoxGameState(data) {
  const view = data.view;
  currentCatInBoxView = view;
  if (currentGameType !== "cat_in_box") {
    currentGameType = "cat_in_box";
    setGamePanelVisibility("cat_in_box");
  }

  if (
    Number.isInteger(catInBoxSelectedCard) &&
    (!Array.isArray(view.hand) || !view.hand.includes(catInBoxSelectedCard))
  ) {
    catInBoxSelectedCard = null;
    catInBoxSelectedColor = null;
  }
  if (catInBoxSelectedColor && !catInBoxIsSelectionLegal(view, catInBoxSelectedCard, catInBoxSelectedColor)) {
    catInBoxSelectedColor = null;
  }

  if (catInBoxPhaseLabel) {
    catInBoxPhaseLabel.textContent = view.phase || "-";
  }
  if (catInBoxRoundLabel) {
    catInBoxRoundLabel.textContent = Number.isInteger(view.round) ? String(view.round) : "-";
  }
  if (catInBoxRoundsTotalLabel) {
    catInBoxRoundsTotalLabel.textContent = Number.isInteger(view.rounds_total) ? String(view.rounds_total) : "-";
  }
  if (catInBoxTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    catInBoxTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (catInBoxLeadLabel) {
    catInBoxLeadLabel.textContent = formatCatInBoxColor(view.lead_color);
  }
  if (catInBoxTrumpLabel) {
    catInBoxTrumpLabel.textContent = formatCatInBoxColor(view.trump_color);
  }
  if (catInBoxTricksPlayedLabel) {
    catInBoxTricksPlayedLabel.textContent =
      view.tricks_played !== null && view.tricks_played !== undefined ? String(view.tricks_played) : "-";
  }
  if (catInBoxParadoxLabel) {
    const paradoxPlayer = view.last_round_summary ? view.last_round_summary.paradox_player : null;
    catInBoxParadoxLabel.textContent = paradoxPlayer ? findPlayerName(view, paradoxPlayer) : "-";
  }
  if (catInBoxWinnersLabel) {
    if (view.game_over && Array.isArray(view.winners) && view.winners.length) {
      const names = view.winners.map((pid) => findPlayerName(view, pid));
      catInBoxWinnersLabel.textContent = names.join(", ");
    } else {
      catInBoxWinnersLabel.textContent = "-";
    }
  }

  updateCatInBoxSelectionLabels();
  renderCatInBoxBoard(view);
  renderCatInBoxTrick(view);
  renderCatInBoxHand(view);
  renderCatInBoxPlayers(view);
  renderCatInBoxSummary(view);
  updateCatInBoxActionButtons();
  logGameEvents(data);
}

function renderMismatchGameState(data) {
  const view = data.view;
  currentMismatchView = view;
  if (currentGameType !== "perfect_mismatch") {
    currentGameType = "perfect_mismatch";
    setGamePanelVisibility("perfect_mismatch");
  }

  if (mismatchPhaseLabel) {
    mismatchPhaseLabel.textContent = view.phase || "-";
  }
  if (mismatchRoundLabel) {
    mismatchRoundLabel.textContent = view.round ?? "-";
  }
  if (mismatchLeaderLabel) {
    mismatchLeaderLabel.textContent = view.leader_id ? findPlayerName(view, view.leader_id) : "-";
  }
  if (mismatchGuessingLabel) {
    mismatchGuessingLabel.textContent = view.phase === "guessing" ? "open" : "closed";
  }
  if (mismatchWinnerLabel) {
    if (view.game_over && Array.isArray(view.winner) && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      mismatchWinnerLabel.textContent = names.join(", ");
    } else {
      mismatchWinnerLabel.textContent = "-";
    }
  }
  if (mismatchTargetLabel) {
    if (Number.isInteger(view.target_index) && Array.isArray(view.words) && view.words[view.target_index]) {
      mismatchTargetLabel.textContent = `${view.target_index + 1}. ${view.words[view.target_index]}`;
    } else {
      mismatchTargetLabel.textContent = "-";
    }
  }
  if (mismatchYourGuessLabel) {
    if (view.your_guess && Number.isInteger(view.your_guess.choice)) {
      const order = Number.isInteger(view.your_guess.order) ? `#${view.your_guess.order}` : "#-";
      mismatchYourGuessLabel.textContent = `${view.your_guess.choice + 1}. ${order}`;
    } else {
      mismatchYourGuessLabel.textContent = "-";
    }
  }

  renderMismatchWords(view);
  renderMismatchSliders(view);
  renderMismatchPlayers(view);
  renderMismatchSummary(view);
  updateMismatchButtons(view);
  logGameEvents(data);
}

function renderCoyoteGameState(data) {
  const view = data.view;
  const previousView = currentCoyoteView;
  currentCoyoteView = view;
  if (currentGameType !== "coyote") {
    currentGameType = "coyote";
    setGamePanelVisibility("coyote");
  }

  coyotePhaseLabel.textContent = view.phase || "-";
  coyoteRoundLabel.textContent = view.round ?? "-";
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  coyoteTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  coyoteBidLabel.textContent = view.last_bid ?? "-";
  coyoteBidderLabel.textContent = view.last_bidder ? findPlayerName(view, view.last_bidder) : "-";
  coyoteWinnerLabel.textContent = view.winner ? findPlayerName(view, view.winner) : "-";

  if (coyoteRoundNoticeTitle) {
    coyoteRoundNoticeTitle.textContent = "Last Round";
  }
  renderCoyoteRoundNotice(view);
  updateCoyoteBidInput(view, previousView);
  updateCoyoteBidControls(view);

  renderCoyotePlayers(view);
  logGameEvents(data);
  updateCoyoteActionButtons();
  if (coyoteResetBtn) {
    coyoteResetBtn.disabled = !(view && view.game_over);
  }
}

function renderTexasCards(container, cards) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  if (!Array.isArray(cards) || !cards.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "-";
    container.appendChild(empty);
    return;
  }
  cards.forEach((card) => {
    const el = document.createElement("div");
    el.className = "texas-card";
    if (card && card.hidden) {
      el.classList.add("hidden");
    } else if (card && card.color) {
      el.classList.add(card.color);
    }
    el.textContent = card && card.label ? card.label : "-";
    container.appendChild(el);
  });
}

function renderTexasPlayers(view) {
  if (!texasPlayers) {
    return;
  }
  texasPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  if (!players.length) {
    texasPlayers.textContent = "-";
    return;
  }
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "texas-player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("active");
    }

    const header = document.createElement("div");
    header.className = "texas-player-header";
    const name = document.createElement("div");
    name.className = "texas-player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);

    const tags = document.createElement("div");
    tags.className = "texas-player-tags";
    const addTag = (label, className) => {
      const tag = document.createElement("span");
      tag.className = `texas-tag ${className || ""}`.trim();
      tag.textContent = label;
      tags.appendChild(tag);
    };
    if (player.is_dealer) {
      addTag("D", "role");
    }
    if (player.is_sb) {
      addTag("SB", "role");
    }
    if (player.is_bb) {
      addTag("BB", "role");
    }
    if (player.player_id === view.you) {
      addTag("You", "role");
    }
    if (player.status === "all_in") {
      addTag("All-in", "all-in");
    }
    if (player.status === "folded") {
      addTag("Folded", "folded");
    }
    if (player.status === "out") {
      addTag("Out", "folded");
    }
    header.appendChild(tags);
    card.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "texas-player-meta";
    const chipsLine = document.createElement("div");
    chipsLine.textContent = `Chips: ${player.chips ?? 0}`;
    const betLine = document.createElement("div");
    betLine.textContent = `Bet: ${player.current_bet ?? 0}`;
    meta.appendChild(chipsLine);
    meta.appendChild(betLine);
    card.appendChild(meta);

    const holeRow = document.createElement("div");
    holeRow.className = "texas-cards";
    renderTexasCards(holeRow, player.hole_cards);
    card.appendChild(holeRow);

    texasPlayers.appendChild(card);
  });
}

function renderTexasSummary(view) {
  if (!texasSummary || !texasSummaryBody || !texasSummaryList) {
    return;
  }
  const summary = view.last_hand_summary;
  if (!summary) {
    texasSummary.classList.add("hidden");
    texasSummary.setAttribute("aria-hidden", "true");
    texasSummaryBody.textContent = "-";
    texasSummaryList.innerHTML = "";
    return;
  }
  texasSummary.classList.remove("hidden");
  texasSummary.setAttribute("aria-hidden", "false");
  const potTotal = Number.isInteger(summary.pot_total) ? summary.pot_total : 0;
  const reason = summary.reason === "fold" ? "Won by fold" : "Showdown";
  texasSummaryBody.textContent = `${reason} · Pot ${potTotal}`;
  texasSummaryList.innerHTML = "";

  const payouts = summary.payouts || {};
  const hands = summary.hands || {};
  const payoutPlayers = Array.isArray(view.players) ? view.players.filter((p) => (payouts[p.player_id] || 0) > 0) : [];
  if (!payoutPlayers.length) {
    const line = document.createElement("div");
    line.textContent = "No winners recorded.";
    texasSummaryList.appendChild(line);
    return;
  }
  payoutPlayers.forEach((player) => {
    const line = document.createElement("div");
    const pid = player.player_id;
    const payout = Number.isInteger(payouts[pid]) ? payouts[pid] : 0;
    const handName = hands[pid] && hands[pid].hand_name ? hands[pid].hand_name : "";
    const name = player.name || pid;
    line.textContent = `${name}: +${payout}${handName ? ` · ${handName}` : ""}`;
    texasSummaryList.appendChild(line);
  });
}

function renderTexasHoldemGameState(data) {
  const view = data.view;
  currentTexasHoldemView = view;
  if (currentGameType !== "texas_holdem") {
    currentGameType = "texas_holdem";
    setGamePanelVisibility("texas_holdem");
  }

  if (texasPhaseLabel) {
    texasPhaseLabel.textContent = view.phase || "-";
  }
  if (texasHandLabel) {
    texasHandLabel.textContent = view.hand_number ?? "-";
  }
  if (texasTurnLabel) {
    const currentPlayer = Array.isArray(view.players)
      ? view.players.find((p) => p.player_id === view.current_turn)
      : null;
    texasTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (texasPotLabel) {
    texasPotLabel.textContent = Number.isInteger(view.pot_total) ? view.pot_total : "-";
  }
  if (texasCurrentBetLabel) {
    texasCurrentBetLabel.textContent = Number.isInteger(view.current_bet) ? view.current_bet : "-";
  }
  if (texasToCallLabel) {
    const toCall = view.action_info ? view.action_info.to_call : null;
    texasToCallLabel.textContent = Number.isInteger(toCall) ? toCall : "-";
  }
  if (texasBlindsLabel && view.config) {
    const sb = view.config.small_blind ?? "-";
    const bb = view.config.big_blind ?? "-";
    texasBlindsLabel.textContent = `SB ${sb} / BB ${bb}`;
  }
  if (texasMinBetLabel) {
    const minBet = view.action_info ? view.action_info.min_bet : null;
    texasMinBetLabel.textContent = Number.isInteger(minBet) ? minBet : "-";
  }
  if (texasMinRaiseToLabel) {
    const minRaiseTo = view.action_info ? view.action_info.min_raise_to : null;
    texasMinRaiseToLabel.textContent = Number.isInteger(minRaiseTo) ? minRaiseTo : "-";
  }
  if (texasMaxRaiseToLabel) {
    const maxRaiseTo = view.action_info ? view.action_info.max_raise_to : null;
    texasMaxRaiseToLabel.textContent = Number.isInteger(maxRaiseTo) ? maxRaiseTo : "-";
  }

  renderTexasCards(texasCommunityCards, view.community_cards);
  const youEntry = Array.isArray(view.players) ? view.players.find((p) => p.player_id === view.you) : null;
  renderTexasCards(texasYourHand, youEntry ? youEntry.hole_cards : []);
  renderTexasPlayers(view);
  renderTexasSummary(view);

  if (texasBetInput && view.action_info) {
    const minAmount = Number.isInteger(view.action_info.min_raise_to)
      ? view.action_info.min_raise_to
      : Number.isInteger(view.action_info.min_bet)
        ? view.action_info.min_bet
        : 1;
    const maxAmount = Number.isInteger(view.action_info.max_raise_to) ? view.action_info.max_raise_to : null;
    texasBetInput.min = String(minAmount);
    texasBetInput.placeholder = `Min ${minAmount}`;
    if (maxAmount !== null) {
      texasBetInput.max = String(maxAmount);
    } else {
      texasBetInput.removeAttribute("max");
    }
  }

  logGameEvents(data);
  updateTexasHoldemActionButtons();
}

function formatSixNimmtBulls(count) {
  const value = Number.isInteger(count) ? count : 0;
  if (value <= 0) {
    return "-";
  }
  return "🐮".repeat(value);
}

function formatSixNimmtCardText(card) {
  if (!card || typeof card.value !== "number") {
    return "-";
  }
  return `${card.value} ${formatSixNimmtBulls(card.bulls)}`;
}

function buildSixNimmtCard(card, { asButton = false, selected = false } = {}) {
  const el = document.createElement(asButton ? "button" : "div");
  if (asButton) {
    el.type = "button";
  }
  el.className = "six-nimmt-card";
  if (selected) {
    el.classList.add("selected");
  }
  if (card && Number.isInteger(card.bulls)) {
    el.dataset.bulls = String(card.bulls);
  }
  const valueEl = document.createElement("div");
  valueEl.className = "six-nimmt-card-value";
  valueEl.textContent = card && typeof card.value === "number" ? String(card.value) : "-";
  const bullsEl = document.createElement("div");
  bullsEl.className = "six-nimmt-card-bulls";
  if (card && Number.isInteger(card.bulls)) {
    const count = card.bulls;
    if (count === 7) {
      const topLine = document.createElement("div");
      topLine.className = "six-nimmt-card-bulls-line";
      topLine.textContent = "🐮".repeat(4);
      const bottomLine = document.createElement("div");
      bottomLine.className = "six-nimmt-card-bulls-line";
      bottomLine.textContent = "🐮".repeat(3);
      bullsEl.append(topLine, bottomLine);
    } else if (count === 6) {
      const topLine = document.createElement("div");
      topLine.className = "six-nimmt-card-bulls-line";
      topLine.textContent = "🐮".repeat(3);
      const bottomLine = document.createElement("div");
      bottomLine.className = "six-nimmt-card-bulls-line";
      bottomLine.textContent = "🐮".repeat(3);
      bullsEl.append(topLine, bottomLine);
    } else if (count === 5) {
      const topLine = document.createElement("div");
      topLine.className = "six-nimmt-card-bulls-line";
      topLine.textContent = "🐮".repeat(3);
      const bottomLine = document.createElement("div");
      bottomLine.className = "six-nimmt-card-bulls-line";
      bottomLine.textContent = "🐮".repeat(2);
      bullsEl.append(topLine, bottomLine);
    } else if (count > 5) {
      const firstLine = document.createElement("div");
      firstLine.className = "six-nimmt-card-bulls-line";
      firstLine.textContent = "🐮".repeat(5);
      const secondLine = document.createElement("div");
      secondLine.className = "six-nimmt-card-bulls-line";
      secondLine.textContent = "🐮".repeat(count - 5);
      bullsEl.append(firstLine, secondLine);
    } else {
      const line = document.createElement("div");
      line.className = "six-nimmt-card-bulls-line";
      line.textContent = "🐮".repeat(count);
      bullsEl.appendChild(line);
    }
  } else {
    bullsEl.textContent = "-";
  }
  el.appendChild(valueEl);
  el.appendChild(bullsEl);
  return el;
}

function renderSixNimmtReveal(view) {
  if (!sixNimmtReveal) {
    return;
  }
  sixNimmtReveal.innerHTML = "";
  const reveal = Array.isArray(view.reveal_order) ? view.reveal_order : [];
  if (!reveal.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No reveal yet.";
    sixNimmtReveal.appendChild(empty);
    return;
  }
  reveal.forEach((entry) => {
    const line = document.createElement("div");
    const name = entry && entry.name ? entry.name : findPlayerName(view, entry.player_id);
    line.textContent = `${name || "-"}: ${formatSixNimmtCardText(entry.card)}`;
    sixNimmtReveal.appendChild(line);
  });
}

function updateSixNimmtSummaryModal(view) {
  if (!sixNimmtSummaryModal || !sixNimmtSummaryList) {
    return;
  }
  const show = !!view && view.phase === "turn_summary";
  sixNimmtSummaryModal.classList.toggle("hidden", !show);
  sixNimmtSummaryModal.setAttribute("aria-hidden", (!show).toString());
  if (!show) {
    sixNimmtSummaryList.innerHTML = "";
    if (sixNimmtSummaryMeta) {
      sixNimmtSummaryMeta.textContent = "-";
    }
    if (sixNimmtSummaryStatus) {
      sixNimmtSummaryStatus.textContent = "-";
    }
    if (sixNimmtSummaryCloseBtn) {
      sixNimmtSummaryCloseBtn.disabled = false;
      sixNimmtSummaryCloseBtn.textContent = "Continue";
    }
    sixNimmtSummaryAckSent = false;
    return;
  }

  const summary = view.last_turn_summary;
  const placements = summary && Array.isArray(summary.placements) ? summary.placements : [];
  sixNimmtSummaryList.innerHTML = "";
  if (!placements.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No summary available.";
    sixNimmtSummaryList.appendChild(empty);
  } else {
    placements.forEach((entry) => {
      const line = document.createElement("div");
      line.className = "six-nimmt-summary-item";
      const header = document.createElement("div");
      header.className = "six-nimmt-summary-header";
      const name = entry && entry.name ? entry.name : findPlayerName(view, entry.player_id);
      const rowLabel = Number.isInteger(entry.row_index) ? `Row ${entry.row_index + 1}` : "Row -";
      header.textContent = `${name || "-"}: ${formatSixNimmtCardText(entry.card)} -> ${rowLabel}`;
      line.appendChild(header);

      if (entry && entry.took_row) {
        const take = document.createElement("div");
        take.className = "six-nimmt-summary-take";
        const takenCards = Array.isArray(entry.taken_cards) ? entry.taken_cards : [];
        const takenText = takenCards.length
          ? takenCards.map((card) => formatSixNimmtCardText(card)).join("、")
          : "-";
        const penalty = Number.isInteger(entry.penalty) ? entry.penalty : 0;
        take.textContent = `吃牌: ${takenText} (罚分 ${penalty})`;
        line.appendChild(take);
      }
      sixNimmtSummaryList.appendChild(line);
    });
  }

  if (sixNimmtSummaryMeta) {
    const roundText = summary && Number.isInteger(summary.round) ? `Round ${summary.round}` : "Round -";
    const turnText = summary && Number.isInteger(summary.turn) ? `Turn ${summary.turn}` : "Turn -";
    sixNimmtSummaryMeta.textContent = `${roundText} · ${turnText}`;
  }

  const acked = Array.isArray(view.summary_ack) ? view.summary_ack : [];
  const players = Array.isArray(view.players) ? view.players : [];
  const waitingPlayers = players.filter((player) => !acked.includes(player.player_id));
  if (sixNimmtSummaryStatus) {
    if (!players.length) {
      sixNimmtSummaryStatus.textContent = "-";
    } else if (!waitingPlayers.length) {
      sixNimmtSummaryStatus.textContent = "All players ready.";
    } else if (waitingPlayers.length <= 3) {
      const names = waitingPlayers.map((player) =>
        player.player_id === view.you ? "You" : player.name || "-"
      );
      sixNimmtSummaryStatus.textContent = `Waiting: ${names.join(", ")}`;
    } else {
      sixNimmtSummaryStatus.textContent = `Waiting: ${waitingPlayers.length} players`;
    }
  }

  const youAcked = view.you && acked.includes(view.you);
  sixNimmtSummaryAckSent = !!youAcked;
  if (sixNimmtSummaryCloseBtn) {
    sixNimmtSummaryCloseBtn.disabled = !!youAcked;
    sixNimmtSummaryCloseBtn.textContent = youAcked ? "Waiting..." : "Continue";
  }
}

function renderSixNimmtRows(view) {
  if (!sixNimmtRows) {
    return;
  }
  sixNimmtRows.innerHTML = "";
  const rows = Array.isArray(view.rows) ? view.rows : [];
  const canChooseRow =
    Array.isArray(view.legal_actions) && view.legal_actions.includes("choose_row") && view.waiting_for;
  rows.forEach((row, index) => {
    const rowEl = document.createElement("div");
    rowEl.className = "six-nimmt-row";
    if (canChooseRow) {
      rowEl.classList.add("selectable");
      rowEl.setAttribute("role", "button");
      rowEl.setAttribute("tabindex", "0");
    }
    const header = document.createElement("div");
    header.className = "six-nimmt-row-header";
    const title = document.createElement("div");
    title.textContent = `Row ${index + 1}`;
    const total = document.createElement("div");
    total.className = "six-nimmt-row-total";
    total.textContent = `Total: ${Number.isInteger(row.bulls_total) ? row.bulls_total : "-"}`;
    header.appendChild(title);
    header.appendChild(total);
    const cards = document.createElement("div");
    cards.className = "six-nimmt-row-cards";
    const rowCards = Array.isArray(row.cards) ? row.cards : [];
    rowCards.forEach((card) => {
      const cardEl = buildSixNimmtCard(card);
      cards.appendChild(cardEl);
    });
    const slotsLeft = Math.max(0, 5 - rowCards.length);
    for (let i = 0; i < slotsLeft; i += 1) {
      const slot = document.createElement("div");
      slot.className = "six-nimmt-card six-nimmt-card-slot";
      slot.setAttribute("aria-hidden", "true");
      cards.appendChild(slot);
    }
    const limit = document.createElement("div");
    limit.className = "six-nimmt-card six-nimmt-card-danger";
    limit.textContent = "6!";
    limit.setAttribute("aria-hidden", "true");
    cards.appendChild(limit);
    rowEl.appendChild(header);
    rowEl.appendChild(cards);
    if (canChooseRow) {
      rowEl.addEventListener("click", () => {
        sendAction({ type: "choose_row", row_index: index });
      });
      rowEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          sendAction({ type: "choose_row", row_index: index });
        }
      });
    }
    sixNimmtRows.appendChild(rowEl);
  });
}

function renderSixNimmtHand(view) {
  if (!sixNimmtHand) {
    return;
  }
  sixNimmtHand.innerHTML = "";
  const hand = Array.isArray(view.hand) ? view.hand : [];
  const canSelect = Array.isArray(view.legal_actions) && view.legal_actions.includes("select_card");
  if (!hand.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No cards.";
    sixNimmtHand.appendChild(empty);
    return;
  }
  hand.forEach((card) => {
    const cardEl = buildSixNimmtCard(card, { asButton: canSelect });
    if (canSelect) {
      cardEl.addEventListener("click", () => {
        sendAction({ type: "select_card", value: card.value });
      });
    } else if (cardEl instanceof HTMLButtonElement) {
      cardEl.disabled = true;
    }
    sixNimmtHand.appendChild(cardEl);
  });
}

function renderSixNimmtPlayers(view) {
  if (!sixNimmtPlayers) {
    return;
  }
  sixNimmtPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card six-nimmt-player-card";
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (view.waiting_for && player.player_id === view.waiting_for.player_id) {
      card.classList.add("current");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || "-";
    const meta = document.createElement("div");
    meta.className = "six-nimmt-player-meta";
    const score = document.createElement("div");
    score.textContent = `score ${player.score ?? 0}`;
    const handCount = document.createElement("div");
    handCount.textContent = `hand ${player.hand_count ?? 0}`;
    const selected = document.createElement("div");
    selected.textContent = player.selected ? "selected ✅" : "selected -";
    meta.append(score, handCount, selected);
    if (player.took_last_row) {
      const tookRow = document.createElement("div");
      tookRow.className = "badge danger six-nimmt-took-row";
      tookRow.textContent = "上一轮吃牌";
      meta.appendChild(tookRow);
      const takenCards = Array.isArray(player.took_last_row_cards) ? player.took_last_row_cards : [];
      if (takenCards.length > 0) {
        const takenText = takenCards.map((card) => formatSixNimmtCardText(card)).join("、");
        const tookRowCards = document.createElement("div");
        tookRowCards.className = "six-nimmt-took-row-cards";
        tookRowCards.textContent = `吃牌: ${takenText}`;
        meta.appendChild(tookRowCards);
      }
    }
    card.append(name, meta);
    sixNimmtPlayers.appendChild(card);
  });
}

function updateSixNimmtTimer(view) {
  if (sixNimmtCountdownTimer) {
    clearInterval(sixNimmtCountdownTimer);
    sixNimmtCountdownTimer = null;
  }
  if (!sixNimmtTimerLabel) {
    return;
  }
  const pending = view ? view.pending_timeout : null;
  const atMs = pending && Number.isFinite(pending.at_ms) ? pending.at_ms : null;
  if (!atMs) {
    sixNimmtTimerLabel.textContent = "-";
    sixNimmtLastTimeoutAt = null;
    return;
  }
  if (sixNimmtLastTimeoutAt !== atMs) {
    sixNimmtLastTimeoutAt = atMs;
  }
  const serverNow = Number.isFinite(view.server_time_ms) ? view.server_time_ms : Date.now();
  sixNimmtServerOffsetMs = serverNow - Date.now();
  const update = () => {
    const now = Date.now() + sixNimmtServerOffsetMs;
    const remaining = Math.max(0, atMs - now);
    sixNimmtTimerLabel.textContent = `${Math.ceil(remaining / 1000)}s`;
  };
  update();
  sixNimmtCountdownTimer = setInterval(update, 250);
}

function renderSixNimmtNotice(view) {
  if (!sixNimmtNotice || !sixNimmtNoticeBody) {
    return;
  }
  sixNimmtNotice.classList.add("hidden");
  sixNimmtNoticeBody.textContent = "-";
  if (!view || view.game_over) {
    return;
  }
  if (Array.isArray(view.legal_actions) && view.legal_actions.includes("choose_row")) {
    sixNimmtNotice.classList.remove("hidden");
    sixNimmtNoticeBody.textContent = "Choose a row to take.";
    return;
  }
  if (Array.isArray(view.legal_actions) && view.legal_actions.includes("select_card")) {
    sixNimmtNotice.classList.remove("hidden");
    sixNimmtNoticeBody.textContent = "Select one card to play.";
  }
}

function renderSixNimmtGameState(data) {
  const view = data.view;
  currentSixNimmtView = view;
  if (currentGameType !== "six_nimmt") {
    currentGameType = "six_nimmt";
    setGamePanelVisibility("six_nimmt");
  }

  if (sixNimmtPhaseLabel) {
    sixNimmtPhaseLabel.textContent = view.phase || "-";
  }
  if (sixNimmtRoundLabel) {
    sixNimmtRoundLabel.textContent = view.round ?? "-";
  }
  if (sixNimmtTurnLabel) {
    sixNimmtTurnLabel.textContent = view.turn ?? "-";
  }
  if (sixNimmtSelectedLabel) {
    sixNimmtSelectedLabel.textContent = view.selected_card ? formatSixNimmtCardText(view.selected_card) : "-";
  }
  if (sixNimmtWinnersLabel) {
    if (view.game_over && Array.isArray(view.winner_names) && view.winner_names.length) {
      sixNimmtWinnersLabel.textContent = view.winner_names.filter(Boolean).join(", ");
    } else {
      sixNimmtWinnersLabel.textContent = "-";
    }
  }

  const waiting = view.waiting_for;
  if (sixNimmtWaitingLabel) {
    if (view.phase === "row_choice" && waiting) {
      const waitingName = waiting.player_id === view.you ? "You" : waiting.name || "-";
      sixNimmtWaitingLabel.textContent = `${waitingName} choosing row`;
    } else if (view.phase === "placement") {
      sixNimmtWaitingLabel.textContent = "Resolving";
    } else if (view.phase === "selection") {
      sixNimmtWaitingLabel.textContent = "Selecting";
    } else if (view.phase === "game_over") {
      sixNimmtWaitingLabel.textContent = "-";
    } else {
      sixNimmtWaitingLabel.textContent = "-";
    }
  }

  renderSixNimmtNotice(view);
  renderSixNimmtReveal(view);
  updateSixNimmtSummaryModal(view);
  renderSixNimmtRows(view);
  renderSixNimmtHand(view);
  renderSixNimmtPlayers(view);
  updateSixNimmtTimer(view);
  logGameEvents(data);
}

function renderHalliGameState(data) {
  const view = data.view;
  currentHalliView = view;
  if (currentGameType !== "halli_galli") {
    currentGameType = "halli_galli";
    setGamePanelVisibility("halli_galli");
  }
  if (halliTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    halliTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (halliBellLabel) {
    const waiting = !!view.pending_flip;
    if (waiting) {
      halliBellLabel.textContent = "Wait";
    } else if (view.bell_ready) {
      const fruits = formatHalliFruitList(view.bell_fruits);
      halliBellLabel.textContent = fruits === "-" ? "Yes" : `Yes (${fruits})`;
    } else {
      halliBellLabel.textContent = "No";
    }
    halliBellLabel.classList.toggle("halli-bell-ready", !waiting && !!view.bell_ready);
  }
  if (halliBellCenter) {
    const waiting = !!view.pending_flip;
    halliBellCenter.classList.toggle("halli-bell-center-ready", !waiting && !!view.bell_ready);
    halliBellCenter.classList.toggle("halli-bell-center-waiting", waiting);
  }
  if (halliWinnerLabel) {
    halliWinnerLabel.textContent = view.winner ? findPlayerName(view, view.winner) : "-";
  }
  if (halliLastActionLabel) {
    halliLastActionLabel.textContent = formatHalliLastAction(view);
  }
  if (halliLastRingLabel) {
    halliLastRingLabel.textContent = formatHalliLastRingResult(view);
  }
  updateHalliCountdownState(view);

  renderHalliPlayers(view);
  logGameEvents(data);
  updateHalliActionButtons();
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
  if (gameType === "gold_rush") {
    renderGoldRushGameState(data);
    return;
  }
  if (gameType === "incan_gold") {
    renderIncanGoldGameState(data);
    return;
  }
  if (gameType === "kobayakawa") {
    renderKobayakawaGameState(data);
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
  if (gameType === "draw_guess") {
    renderDrawGuessGameState(data);
    return;
  }
  if (gameType === "blitz_sketch") {
    renderBlitzSketchGameState(data);
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
  if (gameType === "blokus") {
    renderBlokusGameState(data);
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
  if (gameType === "splendor") {
    renderSplendorGameState(data);
  }
}

socket.on("connect", () => {
  requestRoomList();
});

socket.on("system:info", (data) => {
  if (data.player_id) {
    playerId = data.player_id;
  }
  if (data.reconnect_token && data.room_id && data.player_id) {
    const nameValue = data.name || (nameInput ? nameInput.value.trim() : "");
    setRoomAuth(data.room_id, {
      player_id: data.player_id,
      reconnect_token: data.reconnect_token,
      name: nameValue,
    });
  }
  if (data.message) {
    setConnectionInfo(data.message);
    log(data.message);
  }
});

socket.on("system:error", (data) => {
  log(`Error: ${data.message}`);
});

socket.on("room:state", (state) => {
  renderRoomState(state);
});

socket.on("room:list", (data) => {
  renderRoomList((data || {}).rooms || []);
});

socket.on("room:list_update", (data) => {
  renderRoomList((data || {}).rooms || []);
});

socket.on("room:load_list", (data) => {
  renderLoadList((data || {}).saves || []);
  openLoadModal();
});

socket.on("room:load_result", (data) => {
  if (!data || !data.ok) {
    const message = data && data.message ? String(data.message) : "Load failed";
    log(message);
    return;
  }
  closeLoadModal();
  log(`Loaded save into room: ${data.room_id}`);
});

socket.on("room:seat_list", (data) => {
  if (!data || !data.room_id) {
    return;
  }
  if (pendingSeatClaimRoomId && pendingSeatClaimRoomId !== data.room_id) {
    return;
  }
  if (!pendingSeatClaimRoomId) {
    return;
  }
  pendingSeatClaimRoomId = data.room_id;
  pendingSeatClaimSourceId = data.source_room_id || null;
  if (seatClaimNameHint) {
    const name = getPlayerName();
    seatClaimNameHint.textContent = name ? `Using name: ${name}` : "Set your name to claim a seat.";
  }
  if (seatClaimRoomLabel) {
    const sourceLabel = data.source_room_id ? `Loaded from ${data.source_room_id}` : "Loaded room";
    seatClaimRoomLabel.textContent = `Room ${data.room_id} · ${sourceLabel}`;
  }
  setModalVisible(seatClaimModal, true);
  renderSeatList(data);
});

socket.on("room:claim_result", (data) => {
  if (!data || !data.ok) {
    const message = data && data.message ? String(data.message) : "Seat claim failed";
    log(message);
    return;
  }
  if (data.player_id) {
    playerId = data.player_id;
  }
  closeSeatClaimModal();
});

socket.on("room:delete_result", (data) => {
  if (!data || data.ok) {
    return;
  }
  const messageFromServer = data.message ? String(data.message).trim() : "";
  const blocking = describeBlockingPlayers(data.blocking_players || []);
  const message = blocking
    ? `Still in room: ${blocking}`
    : messageFromServer || "Room could not be deleted";
  const wrapper = findRoomListItem(data.room_id);
  if (wrapper) {
    showRoomListBubble(wrapper, message);
  } else if (message) {
    log(message);
  }
});

socket.on("game:state", (data) => {
  lastGameStatePayload = data;
  renderGameState(data);
});

// UI actions

hydrateNameInput();
if (nameInput) {
  nameInput.addEventListener("input", () => {
    saveStoredName(nameInput.value);
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    performLogout();
  });
}

if (createBtn) {
  createBtn.addEventListener("click", () => {
    startCreateRoomFlow();
  });
}

if (gameSelect) {
  gameSelect.addEventListener("change", () => {
    if (!createRoomPending) {
      return;
    }
    const gameType = gameSelect.value;
    if (!gameType) {
      return;
    }
    const name = getPlayerName();
    if (!name) {
      log("Name required");
      createRoomPending = false;
      setCreateGameRowVisible(false);
      return;
    }
    createRoomPending = false;
    setCreateGameRowVisible(false);
    socket.emit("room:create", { name, game_type: gameType });
  });
}

document.getElementById("joinBtn").addEventListener("click", () => {
  const rid = document.getElementById("roomIdInput").value.trim();
  attemptJoinRoom(rid);
});

if (refreshRoomsBtn) {
  refreshRoomsBtn.addEventListener("click", () => {
    requestRoomList();
  });
}

if (loadBtn) {
  loadBtn.addEventListener("click", () => {
    requestLoadList();
  });
}

if (loadModalCloseBtn) {
  loadModalCloseBtn.addEventListener("click", () => {
    closeLoadModal();
  });
}

if (createRoomModalCloseBtn) {
  createRoomModalCloseBtn.addEventListener("click", () => {
    closeCreateRoomModal();
  });
}

if (gameSearchInput) {
  gameSearchInput.addEventListener("input", () => {
    applyGameFilters();
  });
}

if (playerCountFilter) {
  playerCountFilter.addEventListener("change", () => {
    applyGameFilters();
  });
}

if (seatClaimCloseBtn) {
  seatClaimCloseBtn.addEventListener("click", () => {
    closeSeatClaimModal();
  });
}

if (createRoomModal) {
  createRoomModal.addEventListener("click", (event) => {
    if (event.target === createRoomModal) {
      closeCreateRoomModal();
    }
  });
}

if (sixNimmtSummaryModal) {
  sixNimmtSummaryModal.addEventListener("click", (event) => {
    if (event.target !== sixNimmtSummaryModal) {
      return;
    }
    if (!currentSixNimmtView || currentSixNimmtView.phase !== "turn_summary") {
      return;
    }
    const actions = Array.isArray(currentSixNimmtView.legal_actions) ? currentSixNimmtView.legal_actions : [];
    if (!actions.includes("ack_turn_summary")) {
      return;
    }
    if (sixNimmtSummaryAckSent) {
      return;
    }
    sendAction({ type: "ack_turn_summary" });
    sixNimmtSummaryAckSent = true;
    if (sixNimmtSummaryCloseBtn) {
      sixNimmtSummaryCloseBtn.disabled = true;
      sixNimmtSummaryCloseBtn.textContent = "Waiting...";
    }
    if (sixNimmtSummaryStatus) {
      sixNimmtSummaryStatus.textContent = "Waiting for others...";
    }
  });
}

if (sixNimmtSummaryCloseBtn) {
  sixNimmtSummaryCloseBtn.addEventListener("click", () => {
    if (!currentSixNimmtView || currentSixNimmtView.phase !== "turn_summary") {
      return;
    }
    const actions = Array.isArray(currentSixNimmtView.legal_actions) ? currentSixNimmtView.legal_actions : [];
    if (!actions.includes("ack_turn_summary")) {
      return;
    }
    if (sixNimmtSummaryAckSent) {
      return;
    }
    sendAction({ type: "ack_turn_summary" });
    sixNimmtSummaryAckSent = true;
    sixNimmtSummaryCloseBtn.disabled = true;
    sixNimmtSummaryCloseBtn.textContent = "Waiting...";
    if (sixNimmtSummaryStatus) {
      sixNimmtSummaryStatus.textContent = "Waiting for others...";
    }
  });
}

document.getElementById("readyBtn").addEventListener("click", () => {
  let nextReady = true;
  if (currentRoomState && playerId) {
    const me = currentRoomState.players.find((p) => p.player_id === playerId);
    if (me) {
      nextReady = !me.ready;
    }
  }
  socket.emit("room:ready", { room_id: roomId, ready: nextReady });
});

document.getElementById("startBtn").addEventListener("click", () => {
  emitRoomStart();
});

if (reopenBtn) {
  reopenBtn.addEventListener("click", () => {
    if (!roomId || !currentRoomState) {
      log("Not in a room");
      return;
    }
    if (currentRoomState.status !== "game_over") {
      const proceed = window.confirm("Reopen will lose all progress, continue?");
      if (!proceed) {
        return;
      }
    }
    socket.emit("room:reopen", { room_id: roomId });
  });
}

if (downloadMemoriesBtn) {
  downloadMemoriesBtn.addEventListener("click", () => {
    const activeRoomId = roomId || (currentRoomState && currentRoomState.room_id);
    downloadMemoriesFile(activeRoomId);
  });
}

document.getElementById("addBotBtn").addEventListener("click", () => {
  socket.emit("room:add_bot", { room_id: roomId });
});

if (autoSaveToggle) {
  autoSaveToggle.addEventListener("change", () => {
    if (!roomId) {
      log("Not in a room");
      autoSaveToggle.checked = false;
      return;
    }
    socket.emit("room:auto_save", { room_id: roomId, auto_save: autoSaveToggle.checked });
  });
}

if (removeBotBtn) {
  removeBotBtn.addEventListener("click", () => {
    if (!roomId) {
      log("Not in a room");
      return;
    }
    socket.emit("room:remove_bot", { room_id: roomId });
  });
}

if (leaveBtn) {
  leaveBtn.addEventListener("click", () => {
    if (!roomId) {
      log("Not in a room");
      return;
    }
    socket.emit("room:leave", { room_id: roomId });
    resetRoomState();
    closeSeatClaimModal();
    log("Left room");
  });
}

document.getElementById("clearSelection").addEventListener("click", () => {
  clearSelection();
});

if (clearTargetBtn) {
  clearTargetBtn.addEventListener("click", () => {
    clearTargetSelection();
  });
}

if (flip7ClearTargetBtn) {
  flip7ClearTargetBtn.addEventListener("click", () => {
    clearFlip7TargetSelection();
  });
}

skullClearSelectionBtn.addEventListener("click", () => {
  clearSkullSelection();
});

skullBidInput.addEventListener("input", () => {
  updateSkullActionButtons();
});

coyoteBidInput.addEventListener("input", () => {
  updateCoyoteActionButtons();
});

if (coyoteBidMinusBtn) {
  coyoteBidMinusBtn.addEventListener("click", () => {
    adjustCoyoteBid(-1);
  });
}

if (coyoteBidPlusBtn) {
  coyoteBidPlusBtn.addEventListener("click", () => {
    adjustCoyoteBid(1);
  });
}

if (texasBetInput) {
  texasBetInput.addEventListener("input", () => {
    updateTexasHoldemActionButtons();
  });
}

if (texasFoldBtn) {
  texasFoldBtn.addEventListener("click", () => {
    sendAction({ type: "fold" });
  });
}

if (texasCheckBtn) {
  texasCheckBtn.addEventListener("click", () => {
    sendAction({ type: "check" });
  });
}

if (texasCallBtn) {
  texasCallBtn.addEventListener("click", () => {
    sendAction({ type: "call" });
  });
}

if (texasAllInBtn) {
  texasAllInBtn.addEventListener("click", () => {
    sendAction({ type: "all_in" });
  });
}

if (texasBetBtn) {
  texasBetBtn.addEventListener("click", () => {
    const amount = getTexasBetAmount();
    if (!amount) {
      log("Enter a bet amount");
      return;
    }
    sendAction({ type: "bet", amount });
  });
}

if (texasRaiseBtn) {
  texasRaiseBtn.addEventListener("click", () => {
    const amount = getTexasBetAmount();
    if (!amount) {
      log("Enter a raise amount");
      return;
    }
    sendAction({ type: "raise", amount });
  });
}

if (texasNextHandBtn) {
  texasNextHandBtn.addEventListener("click", () => {
    sendAction({ type: "next_hand" });
  });
}

if (texasRebuyBtn) {
  texasRebuyBtn.addEventListener("click", () => {
    sendAction({ type: "rebuy" });
  });
}

document.getElementById("peekBtn").addEventListener("click", () => {
  if (selectedSlots.length !== 2) {
    log("Select two slots for initial peek");
    return;
  }
  sendAction({ type: "initial_peek", slots: selectedSlots.slice(0, 2) });
  clearSelection();
});

document.getElementById("drawDeckBtn").addEventListener("click", () => {
  sendAction({ type: "draw_deck" });
});

if (discardTop) {
  discardTop.addEventListener("click", () => {
    if (!selectedSlots.length) {
      log("Select a slot to replace from discard");
      return;
    }
    sendAction({ type: "draw_discard", slot: selectedSlots[0] });
    clearSelection();
  });
}

document.getElementById("replaceBtn").addEventListener("click", () => {
  if (!selectedSlots.length) {
    log("Select 1 slot to replace or 2-4 slots to match");
    return;
  }
  if (selectedSlots.length >= 2) {
    sendAction({ type: "attempt_match", slots: selectedSlots.slice(0, 4) });
  } else {
    sendAction({ type: "replace_card", slot: selectedSlots[0] });
  }
  clearSelection();
});

document.getElementById("discardDrawnBtn").addEventListener("click", () => {
  sendAction({ type: "discard_drawn" });
});

document.getElementById("callCaboBtn").addEventListener("click", () => {
  sendAction({ type: "call_cabo" });
});

document.getElementById("nextRoundBtn").addEventListener("click", () => {
  sendAction({ type: "next_round" });
});

document.getElementById("choiceBtn").addEventListener("click", () => {
  if (!currentCaboView || !currentCaboView.pending_choice) {
    log("No pending choice");
    return;
  }
  const choiceType = currentCaboView.pending_choice.type;
  if (choiceType === "peek") {
    if (!selectedSlots.length) {
      log("Select one of your slots to peek");
      return;
    }
    const slot = selectedSlots[0];
    sendAction({
      type: "use_choice_action",
      choice_type: "peek",
      target: { slot },
    });
  } else if (choiceType === "spy") {
    if (!selectedTarget) {
      log("Select a target slot to spy");
      return;
    }
    sendAction({
      type: "use_choice_action",
      choice_type: "spy",
      target: { player_id: selectedTarget.playerId, slot: selectedTarget.slot },
    });
  } else if (choiceType === "swap") {
    if (!selectedTarget || !selectedSlots.length) {
      log("Select one of your slots and a target slot to swap");
      return;
    }
    const self = selectedSlots[0];
    sendAction({
      type: "use_choice_action",
      choice_type: "swap",
      target: {
        player_id: selectedTarget.playerId,
        slot: selectedTarget.slot,
        self_slot: self,
      },
    });
  }
  clearSelection();
  clearTargetSelection();
});

if (flip7FlipBtn) {
  flip7FlipBtn.addEventListener("click", () => {
    sendAction({ type: "flip" });
  });
}

if (flip7StayBtn) {
  flip7StayBtn.addEventListener("click", () => {
    sendAction({ type: "stay" });
  });
}

if (yahtzeeRollBtn) {
  yahtzeeRollBtn.addEventListener("click", () => {
    sendAction({ type: "roll" });
  });
}

if (goldRushClearSelectionBtn) {
  goldRushClearSelectionBtn.addEventListener("click", () => {
    goldRushSelectedHandIndex = null;
    updateGoldRushSelectionLabel(currentGoldRushView || {});
    renderGoldRushMines(currentGoldRushView || {});
    updateGoldRushActionButtons();
  });
}

if (goldRushPlayCardBtn) {
  goldRushPlayCardBtn.addEventListener("click", () => {
    const hand = getGoldRushHand(currentGoldRushView);
    if (!Number.isInteger(goldRushSelectedHandIndex) || goldRushSelectedHandIndex < 0 || goldRushSelectedHandIndex >= hand.length) {
      log("Select a card to play");
      return;
    }
    sendAction({ type: "play_card", hand_index: goldRushSelectedHandIndex });
    goldRushSelectedHandIndex = null;
    updateGoldRushSelectionLabel(currentGoldRushView || {});
    renderGoldRushMines(currentGoldRushView || {});
    updateGoldRushActionButtons();
  });
}

if (goldRushDrawCardBtn) {
  goldRushDrawCardBtn.addEventListener("click", () => {
    sendAction({ type: "draw_card" });
  });
}

if (goldRushInvestYesBtn) {
  goldRushInvestYesBtn.addEventListener("click", () => {
    sendAction({ type: "invest", invest: true });
  });
}

if (goldRushInvestNoBtn) {
  goldRushInvestNoBtn.addEventListener("click", () => {
    sendAction({ type: "invest", invest: false });
  });
}

if (goldRushPlayAgainBtn) {
  goldRushPlayAgainBtn.addEventListener("click", () => {
    sendAction({ type: "play_again" });
  });
}

if (incanGoldContinueBtn) {
  incanGoldContinueBtn.addEventListener("click", () => {
    sendAction({ type: "decide", choice: "continue" });
  });
}

if (incanGoldLeaveBtn) {
  incanGoldLeaveBtn.addEventListener("click", () => {
    sendAction({ type: "decide", choice: "leave" });
  });
}

if (incanGoldNextRoundBtn) {
  incanGoldNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (incanGoldPlayAgainBtn) {
  incanGoldPlayAgainBtn.addEventListener("click", () => {
    sendAction({ type: "play_again" });
  });
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

skullPlayBtn.addEventListener("click", () => {
  if (!skullSelectedCardType) {
    log("Select a card to play");
    return;
  }
  sendAction({ type: "play_card", card_type: skullSelectedCardType });
  clearSkullSelection();
});

skullStartBidBtn.addEventListener("click", () => {
  const bid = Number.parseInt(skullBidInput.value, 10);
  if (!Number.isInteger(bid)) {
    log("Enter a bid number");
    return;
  }
  sendAction({ type: "start_bid", bid });
});

skullRaiseBidBtn.addEventListener("click", () => {
  const bid = Number.parseInt(skullBidInput.value, 10);
  if (!Number.isInteger(bid)) {
    log("Enter a bid number");
    return;
  }
  sendAction({ type: "raise_bid", bid });
});

skullPassBidBtn.addEventListener("click", () => {
  sendAction({ type: "pass_bid" });
});

skullRevealBtn.addEventListener("click", () => {
  if (!skullSelectedTarget) {
    log("Select a reveal target");
    return;
  }
  sendAction({ type: "reveal_card", target_player_id: skullSelectedTarget });
  skullSelectedTarget = null;
  updateSkullTargetSelection();
  updateSkullActionButtons();
});

if (catInBoxClearSelectionBtn) {
  catInBoxClearSelectionBtn.addEventListener("click", () => {
    catInBoxSelectedCard = null;
    catInBoxSelectedColor = null;
    updateCatInBoxSelectionLabels();
    if (currentCatInBoxView) {
      renderCatInBoxBoard(currentCatInBoxView);
      renderCatInBoxHand(currentCatInBoxView);
    }
    updateCatInBoxActionButtons();
  });
}

if (catInBoxColorButtons) {
  catInBoxColorButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-color]");
    if (!button || button.disabled) {
      return;
    }
    catInBoxSelectedColor = button.dataset.color || null;
    updateCatInBoxSelectionLabels();
    if (currentCatInBoxView) {
      renderCatInBoxBoard(currentCatInBoxView);
    }
    updateCatInBoxActionButtons();
  });
}

if (catInBoxDiscardBtn) {
  catInBoxDiscardBtn.addEventListener("click", () => {
    if (!currentCatInBoxView) {
      log("Game not ready");
      return;
    }
    if (!Number.isInteger(catInBoxSelectedCard)) {
      log("Select a card to discard");
      return;
    }
    sendAction({ type: "discard", card_value: catInBoxSelectedCard });
    catInBoxSelectedCard = null;
    catInBoxSelectedColor = null;
    updateCatInBoxSelectionLabels();
    if (currentCatInBoxView) {
      renderCatInBoxBoard(currentCatInBoxView);
      renderCatInBoxHand(currentCatInBoxView);
    }
    updateCatInBoxActionButtons();
  });
}

if (catInBoxBid1Btn) {
  catInBoxBid1Btn.addEventListener("click", () => {
    sendAction({ type: "bid", bid: 1 });
  });
}

if (catInBoxBid2Btn) {
  catInBoxBid2Btn.addEventListener("click", () => {
    sendAction({ type: "bid", bid: 2 });
  });
}

if (catInBoxBid3Btn) {
  catInBoxBid3Btn.addEventListener("click", () => {
    sendAction({ type: "bid", bid: 3 });
  });
}

if (catInBoxPlayBtn) {
  catInBoxPlayBtn.addEventListener("click", () => {
    if (!currentCatInBoxView) {
      log("Game not ready");
      return;
    }
    if (!catInBoxIsSelectionLegal(currentCatInBoxView, catInBoxSelectedCard, catInBoxSelectedColor)) {
      log("Select a legal card and color");
      return;
    }
    const lead = currentCatInBoxView.lead_color;
    const yourColors = currentCatInBoxView.your_colors || {};
    if (lead && catInBoxSelectedColor !== lead && yourColors[lead] !== false) {
      const proceed = window.confirm(
        `Declare void on ${formatCatInBoxColor(lead)} by playing ${formatCatInBoxColor(
          catInBoxSelectedColor
        )}?`
      );
      if (!proceed) {
        return;
      }
    }
    sendAction({ type: "play_card", card_value: catInBoxSelectedCard, color: catInBoxSelectedColor });
    catInBoxSelectedCard = null;
    catInBoxSelectedColor = null;
    updateCatInBoxSelectionLabels();
    if (currentCatInBoxView) {
      renderCatInBoxBoard(currentCatInBoxView);
      renderCatInBoxHand(currentCatInBoxView);
    }
    updateCatInBoxActionButtons();
  });
}

if (mismatchRevealBtn) {
  mismatchRevealBtn.addEventListener("click", () => {
    sendAction({ type: "reveal" });
  });
}

if (mismatchNextRoundBtn) {
  mismatchNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (mismatchPlayAgainBtn) {
  mismatchPlayAgainBtn.addEventListener("click", () => {
    sendAction({ type: "play_again" });
  });
}

coyoteBidBtn.addEventListener("click", () => {
  const bid = Number.parseInt(coyoteBidInput.value, 10);
  if (!Number.isInteger(bid)) {
    log("Enter a bid number");
    return;
  }
  sendAction({ type: "bid", bid });
});

coyoteChallengeBtn.addEventListener("click", () => {
  sendAction({ type: "challenge" });
});

if (coyoteResetBtn) {
  coyoteResetBtn.addEventListener("click", () => {
    emitRoomStart();
  });
}

if (halliFlipBtn) {
  halliFlipBtn.addEventListener("click", () => {
    sendAction({ type: "flip" });
  });
}

if (halliRingBtn) {
  halliRingBtn.addEventListener("click", () => {
    sendAction({ type: "ring" });
  });
}

if (halliBellCenter) {
  const ringBell = () => {
    if (currentGameType !== "halli_galli") {
      return;
    }
    if (!isHalliActionAvailable("ring")) {
      return;
    }
    sendAction({ type: "ring" });
  };
  halliBellCenter.addEventListener("click", ringBell);
  halliBellCenter.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      ringBell();
    }
  });
}

if (abracaSpellButtons.length) {
  abracaSpellButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const spellType = Number.parseInt(button.dataset.spell, 10);
      if (!Number.isInteger(spellType)) {
        return;
      }
      sendAction({ type: "cast_spell", spell_type: spellType });
    });
  });
}

if (abracaRollBtn) {
  abracaRollBtn.addEventListener("click", () => {
    sendAction({ type: "roll_dice" });
  });
}

if (abracaSecretBtn) {
  abracaSecretBtn.addEventListener("click", () => {
    sendAction({ type: "take_secret" });
  });
}

if (abracaEndTurnBtn) {
  abracaEndTurnBtn.addEventListener("click", () => {
    sendAction({ type: "end_turn" });
  });
}

if (abracaNextRoundBtn) {
  abracaNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "start_next_round" });
  });
}

if (abracaNewGameBtn) {
  abracaNewGameBtn.addEventListener("click", () => {
    emitRoomStart();
  });
}

if (pointSaladClearSelectionBtn) {
  pointSaladClearSelectionBtn.addEventListener("click", () => {
    clearPointSaladSelections();
    updatePointSaladSelectionLabels();
    if (currentPointSaladView) {
      renderPointSaladPiles(currentPointSaladView);
      renderPointSaladMarket(currentPointSaladView);
    }
    updatePointSaladActionButtons();
  });
}

if (pointSaladClearFlipsBtn) {
  pointSaladClearFlipsBtn.addEventListener("click", () => {
    clearPointSaladFlips();
    updatePointSaladSelectionLabels();
    if (currentPointSaladView) {
      renderPointSaladPlayers(currentPointSaladView);
    }
    updatePointSaladActionButtons();
  });
}

if (pointSaladTakePointBtn) {
  pointSaladTakePointBtn.addEventListener("click", () => {
    if (pointSaladSelectedPile === null) {
      log("Select a pile to take");
      return;
    }
    const action = { type: "take_point", pile_index: pointSaladSelectedPile };
    if (pointSaladSelectedFlips.size) {
      action.flip_ids = Array.from(pointSaladSelectedFlips);
    }
    sendAction(action);
    clearPointSaladSelections();
    clearPointSaladFlips();
    updatePointSaladSelectionLabels();
    updatePointSaladActionButtons();
  });
}

if (pointSaladTakeVeggiesBtn) {
  pointSaladTakeVeggiesBtn.addEventListener("click", () => {
    if (!pointSaladSelectedMarket.length) {
      log("Select veggies to take");
      return;
    }
    const action = { type: "take_veggies", positions: [...pointSaladSelectedMarket] };
    if (pointSaladSelectedFlips.size) {
      action.flip_ids = Array.from(pointSaladSelectedFlips);
    }
    sendAction(action);
    clearPointSaladSelections();
    clearPointSaladFlips();
    updatePointSaladSelectionLabels();
    updatePointSaladActionButtons();
  });
}

if (fangNiaoClearSelectionBtn) {
  fangNiaoClearSelectionBtn.addEventListener("click", () => {
    fangNiaoSelectedBird = null;
    fangNiaoSelectedRow = null;
    fangNiaoSelectedSide = null;
    updateFangNiaoSelectionLabels();
    updateFangNiaoActionButtons();
    if (currentFangNiaoView) {
      renderFangNiaoRows(currentFangNiaoView);
      renderFangNiaoHand(currentFangNiaoView);
    }
  });
}

if (fangNiaoPlayBtn) {
  fangNiaoPlayBtn.addEventListener("click", () => {
    if (!currentFangNiaoView || !Array.isArray(currentFangNiaoView.legal_actions)) {
      return;
    }
    if (!currentFangNiaoView.legal_actions.includes("play_birds")) {
      log("Not your turn");
      return;
    }
    if (!fangNiaoSelectedBird) {
      log("Select a bird");
      return;
    }
    if (!Number.isInteger(fangNiaoSelectedRow)) {
      log("Select a row");
      return;
    }
    if (!fangNiaoSelectedSide) {
      log("Select a side");
      return;
    }
    sendAction({
      type: "play_birds",
      bird_type: fangNiaoSelectedBird,
      row_index: fangNiaoSelectedRow,
      side: fangNiaoSelectedSide,
    });
  });
}

if (fangNiaoBankBtn) {
  fangNiaoBankBtn.addEventListener("click", () => {
    if (!currentFangNiaoView || !Array.isArray(currentFangNiaoView.legal_actions)) {
      return;
    }
    if (!currentFangNiaoView.legal_actions.includes("bank_birds")) {
      log("Not your turn");
      return;
    }
    if (!fangNiaoSelectedBird) {
      log("Select a bird");
      return;
    }
    if (!isFangNiaoBankable(currentFangNiaoView, fangNiaoSelectedBird)) {
      log("Not enough birds to bank");
      return;
    }
    sendAction({ type: "bank_birds", bird_type: fangNiaoSelectedBird });
  });
}

if (fangNiaoEndBtn) {
  fangNiaoEndBtn.addEventListener("click", () => {
    if (!currentFangNiaoView || !Array.isArray(currentFangNiaoView.legal_actions)) {
      return;
    }
    if (!currentFangNiaoView.legal_actions.includes("end_turn")) {
      log("Not your turn");
      return;
    }
    sendAction({ type: "end_turn" });
  });
}


document.querySelectorAll(".collapse-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const panel = btn.closest(".panel");
    if (!panel) {
      return;
    }
    const collapsed = panel.classList.toggle("collapsed");
    btn.textContent = collapsed ? "Show" : "Hide";
    btn.setAttribute("aria-expanded", (!collapsed).toString());
    if (panel.id === "roomControlsPanel") {
      roomControlsAutoCollapsed = false;
      updateRoomControlsDock();
    }
  });
});

window.addEventListener("resize", () => {
  updateRoomControlsDock();
});

if (logCloseBtn) {
  logCloseBtn.addEventListener("click", () => {
    setLogPanelVisible(false);
  });
}

if (logOpenBtn) {
  logOpenBtn.addEventListener("click", () => {
    setLogPanelVisible(true);
  });
}

if (copyStateBtn) {
  copyStateBtn.addEventListener("click", () => {
    copyGameStateSnapshot();
  });
}

if (copyActLogBtn) {
  copyActLogBtn.addEventListener("click", () => {
    copyActionLogSnapshot();
  });
}

document.addEventListener("keydown", (event) => {
  if (!logPanel) {
    return;
  }
  if (event.key === "Escape") {
    if (!logPanel.classList.contains("hidden")) {
      event.preventDefault();
      setLogPanelVisible(false);
    }
    return;
  }
  if (event.key.toLowerCase() !== "l") {
    return;
  }
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  if (event.repeat || isTypingTarget(event.target)) {
    return;
  }
  toggleLogPanel();
});

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
