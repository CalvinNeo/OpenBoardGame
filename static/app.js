const socket = io();

let playerId = null;
let roomId = null;
let currentCaboView = null;
let currentSkullView = null;
let currentMismatchView = null;
let currentCoyoteView = null;
let currentDecryptoView = null;
let currentDrawGuessView = null;
let currentFlip7View = null;
let currentGoldRushView = null;
let currentHalliView = null;
let halliCountdownTimer = null;
let halliCountdownState = {
  flipReadyAtMs: 0,
  ringReadyAtMs: 0,
  ringPending: false,
  turnSwitchAtMs: 0,
  flipWaitMs: 0,
};
let halliServerTimeOffsetMs = 0;
let currentImpressionView = null;
let currentSplendorView = null;
let currentAbracaView = null;
let currentBlokusView = null;
let currentAidixitView = null;
let currentGameType = null;
let abracaLastRoundNotice = null;
let selectedSlots = [];
let currentRoomState = null;
let lastGameStatePayload = null;
let roomControlsGameActive = false;
let roomControlsAutoCollapsed = false;
let selectedTarget = null;
let flip7SelectedTarget = null;
let goldRushSelectedHandIndex = null;
let skullSelectedCardIndex = null;
let skullSelectedCardType = null;
let skullSelectedTarget = null;
let drawGuessLastRound = null;
let drawGuessLastPhase = null;
let drawGuessIsDrawing = false;
let drawGuessHasDrawn = false;
let drawGuessIsErasing = false;
let drawGuessBrushColor = "#000000";
let drawGuessBrushSize = 3;
let impressionConfig = null;
let impressionConfigSignature = null;
let impressionStampHistory = [];
let impressionStampsLeft = 0;
let impressionStampsMax = 0;
let impressionShapeColorMap = {};
let impressionCurrentShape = null;
let impressionCurrentColor = null;
let impressionRotation = 0;
let impressionPressStart = null;
let impressionPreviewPosition = null;
let impressionPreviewStamp = null;
let impressionPreviewRaf = null;
let impressionActiveStampIndex = null;
let impressionDraggingStamp = null;
let impressionMaskTarget = null;
let impressionMaskActive = false;
let impressionMaskState = null;
let impressionMaskDrag = null;
let impressionRotateHold = null;
let impressionSelectedWord = null;
let impressionMatches = {};
let impressionLastRound = null;
let impressionLastPhase = null;
let impressionShapeButtonEls = [];
const IMPRESSION_SELECTION_PADDING = 6;
const IMPRESSION_ROTATE_BUTTON_OFFSET = 8;
const IMPRESSION_ROTATE_STEP_DEG = 5;
const IMPRESSION_ROTATE_HOLD_SPEED = 120;
let splendorSelectedMarket = null;
let splendorSelectedReserved = null;
let splendorSelectedNoble = null;
let splendorTokenSelection = {};
let splendorDiscardSelection = {};
let splendorNobleCatalog = {};
let blokusSelectedPieceId = null;
let blokusSelectedOrigin = null;
let blokusRotation = 0;
let blokusFlip = false;
let blokusDragState = null;
const BLOKUS_DRAG_THRESHOLD = 6;
const BLOKUS_ADJACENT_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const BLOKUS_DIAGONAL_OFFSETS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
let createRoomPending = false;
let pendingReadyAfterJoin = false;
let pendingReadyRoomId = null;
let decryptoWordPacks = [];
let decryptoPackSelections = new Set(["basic"]);
let decryptoPacksLoaded = false;
let decryptoBotStrategies = [];
let decryptoBotStrategiesLoaded = false;
let decryptoBotStrategyId = "native";
let decryptoBotClueDirectness = 0.5;
let currentRoomList = [];
let pendingSeatClaimRoomId = null;
let pendingSeatClaimSourceId = null;
let aidixitDecksLoaded = false;
let aidixitDecks = [];
let aidixitDeckSelections = new Set();
let aidixitSelectedHandCardId = null;
let aidixitSelectedVoteCardId = null;
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
const removeBotBtn = document.getElementById("removeBotBtn");
const logoutBtn = document.getElementById("logoutBtn");
const drawGuessConfigBox = document.getElementById("drawGuessConfigBox");
const drawGuessLanguageRow = document.getElementById("drawGuessLanguageRow");
const drawGuessLanguageSelect = document.getElementById("drawGuessLanguageSelect");
const drawGuessGuessMethodRow = document.getElementById("drawGuessGuessMethodRow");
const drawGuessGuessMethodSelect = document.getElementById("drawGuessGuessMethodSelect");
const drawGuessAnswerLengthOptionRow = document.getElementById("drawGuessAnswerLengthOptionRow");
const drawGuessAnswerLengthToggle = document.getElementById("drawGuessAnswerLengthToggle");
const decryptoConfigBox = document.getElementById("decryptoConfigBox");
const decryptoPackRow = document.getElementById("decryptoPackRow");
const decryptoPackOptions = document.getElementById("decryptoPackOptions");
const decryptoBotRow = document.getElementById("decryptoBotRow");
const decryptoBotSelect = document.getElementById("decryptoBotSelect");
const decryptoBotClueRow = document.getElementById("decryptoBotClueRow");
const decryptoBotClueSelect = document.getElementById("decryptoBotClueSelect");
const aidixitConfigBox = document.getElementById("aidixitConfigBox");
const aidixitDeckRow = document.getElementById("aidixitDeckRow");
const aidixitDeckOptions = document.getElementById("aidixitDeckOptions");
const halliConfigBox = document.getElementById("halliConfigBox");
const halliDeckRow = document.getElementById("halliDeckRow");
const halliDeckSelect = document.getElementById("halliDeckSelect");
const goldRushConfigBox = document.getElementById("goldRushConfigBox");
const goldRushModeRow = document.getElementById("goldRushModeRow");
const goldRushModeSelect = document.getElementById("goldRushModeSelect");
const mismatchConfigBox = document.getElementById("mismatchConfigBox");
const mismatchSliderCount = document.getElementById("mismatchSliderCount");
const autoSaveRow = document.getElementById("autoSaveRow");
const autoSaveToggle = document.getElementById("autoSaveToggle");
const caboPanel = document.getElementById("caboPanel");
const flip7Panel = document.getElementById("flip7Panel");
const goldRushPanel = document.getElementById("goldRushPanel");
const skullPanel = document.getElementById("skullPanel");
const mismatchPanel = document.getElementById("mismatchPanel");
const coyotePanel = document.getElementById("coyotePanel");
const halliPanel = document.getElementById("halliPanel");
const decryptoPanel = document.getElementById("decryptoPanel");
const drawGuessPanel = document.getElementById("drawGuessPanel");
const aidixitPanel = document.getElementById("aidixitPanel");

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

const handSlots = document.getElementById("handSlots");
const selectedSlotsLabel = document.getElementById("selectedSlots");
const targetSelection = document.getElementById("targetSelection");
const targetList = document.getElementById("targetList");
const clearTargetBtn = document.getElementById("clearTarget");
const gamePlayers = document.getElementById("gamePlayers");
const logEl = document.getElementById("log");
const logPanel = document.getElementById("logPanel");
const logCloseBtn = document.getElementById("logCloseBtn");
const skipValidationToggle = document.getElementById("skipValidationToggle");
const copyStateBtn = document.getElementById("copyStateBtn");
const loadModal = document.getElementById("loadModal");
const loadModalCloseBtn = document.getElementById("loadModalCloseBtn");
const loadList = document.getElementById("loadList");
const loadEmpty = document.getElementById("loadEmpty");
const loadAutoSaveToggle = document.getElementById("loadAutoSaveToggle");
const seatClaimModal = document.getElementById("seatClaimModal");
const seatClaimCloseBtn = document.getElementById("seatClaimCloseBtn");
const seatClaimNameHint = document.getElementById("seatClaimNameHint");
const seatClaimRoomLabel = document.getElementById("seatClaimRoomLabel");
const seatClaimList = document.getElementById("seatClaimList");
const seatClaimEmpty = document.getElementById("seatClaimEmpty");
const aidixitZoomModal = document.getElementById("aidixitZoomModal");
const aidixitZoomCloseBtn = document.getElementById("aidixitZoomCloseBtn");
const aidixitZoomImage = document.getElementById("aidixitZoomImage");
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

const drawGuessPhaseLabel = document.getElementById("drawGuessPhase");
const drawGuessRoundLabel = document.getElementById("drawGuessRound");
const drawGuessTotalRoundsLabel = document.getElementById("drawGuessTotalRounds");
const drawGuessSubmittedLabel = document.getElementById("drawGuessSubmitted");
const drawGuessPromptRow = document.getElementById("drawGuessPromptRow");
const drawGuessPromptLabel = document.getElementById("drawGuessPrompt");
const drawGuessDrawArea = document.getElementById("drawGuessDrawArea");
const drawGuessGuessArea = document.getElementById("drawGuessGuessArea");
const drawGuessCanvas = document.getElementById("drawGuessCanvas");
const drawGuessClearBtn = document.getElementById("drawGuessClearBtn");
const drawGuessEraserBtn = document.getElementById("drawGuessEraserBtn");
const drawGuessSubmitDrawBtn = document.getElementById("drawGuessSubmitDrawBtn");
const drawGuessImage = document.getElementById("drawGuessImage");
const drawGuessAnswerLengthHintRow = document.getElementById("drawGuessAnswerLengthHintRow");
const drawGuessAnswerLengthLabel = document.getElementById("drawGuessAnswerLength");
const drawGuessInput = document.getElementById("drawGuessInput");
const drawGuessSubmitGuessBtn = document.getElementById("drawGuessSubmitGuessBtn");
const drawGuessPlayers = document.getElementById("drawGuessPlayers");
const drawGuessReview = document.getElementById("drawGuessReview");
const drawGuessBooks = document.getElementById("drawGuessBooks");
const drawGuessRestartBtn = document.getElementById("drawGuessRestartBtn");
const drawGuessColorPalette = document.getElementById("drawGuessColorPalette");
const drawGuessColorButtons = drawGuessColorPalette
  ? Array.from(drawGuessColorPalette.querySelectorAll("button[data-color]"))
  : [];
const drawGuessBrushSizes = document.getElementById("drawGuessBrushSizes");
const drawGuessBrushButtons = drawGuessBrushSizes
  ? Array.from(drawGuessBrushSizes.querySelectorAll("button[data-size]"))
  : [];
const drawGuessCtx = drawGuessCanvas ? drawGuessCanvas.getContext("2d") : null;

const aidixitPhaseLabel = document.getElementById("aidixitPhase");
const aidixitRoundLabel = document.getElementById("aidixitRound");
const aidixitStorytellerLabel = document.getElementById("aidixitStoryteller");
const aidixitClueLabel = document.getElementById("aidixitClue");
const aidixitTargetScoreLabel = document.getElementById("aidixitTargetScore");
const aidixitDeckCountLabel = document.getElementById("aidixitDeckCount");
const aidixitDiscardCountLabel = document.getElementById("aidixitDiscardCount");
const aidixitSubmittedLabel = document.getElementById("aidixitSubmitted");
const aidixitVotedLabel = document.getElementById("aidixitVoted");
const aidixitWinnerLabel = document.getElementById("aidixitWinner");
const aidixitClueInput = document.getElementById("aidixitClueInput");
const aidixitSubmitStoryBtn = document.getElementById("aidixitSubmitStoryBtn");
const aidixitSubmitCardBtn = document.getElementById("aidixitSubmitCardBtn");
const aidixitSubmitVoteBtn = document.getElementById("aidixitSubmitVoteBtn");
const aidixitHand = document.getElementById("aidixitHand");
const aidixitPool = document.getElementById("aidixitPool");
const aidixitRoundNotice = document.getElementById("aidixitRoundNotice");
const aidixitRoundNoticeBody = document.getElementById("aidixitRoundNoticeBody");
const aidixitRoundNoticeCards = document.getElementById("aidixitRoundNoticeCards");
const aidixitPlayers = document.getElementById("aidixitPlayers");

const impressionFlowerPanel = document.getElementById("impressionFlowerPanel");
const impressionPhaseLabel = document.getElementById("impressionPhase");
const impressionRoundLabel = document.getElementById("impressionRound");
const impressionRoundsPerGuesserLabel = document.getElementById("impressionRoundsPerGuesser");
const impressionGuesserLabel = document.getElementById("impressionGuesser");
const impressionRoleLabel = document.getElementById("impressionRole");
const impressionStampsLeftLabel = document.getElementById("impressionStampsLeft");
const impressionScoreLabel = document.getElementById("impressionScore");
const impressionPromptRow = document.getElementById("impressionPromptRow");
const impressionPromptLabel = document.getElementById("impressionPrompt");
const impressionDrawArea = document.getElementById("impressionDrawArea");
const impressionGuessArea = document.getElementById("impressionGuessArea");
const impressionRoundEnd = document.getElementById("impressionRoundEnd");
const impressionRoundResult = document.getElementById("impressionRoundResult");
const impressionPlayers = document.getElementById("impressionPlayers");
const impressionCanvas = document.getElementById("impressionCanvas");
const impressionCtx = impressionCanvas ? impressionCanvas.getContext("2d") : null;
const impressionShapeButtons = document.getElementById("impressionShapeButtons");
const impressionRotationInput = document.getElementById("impressionRotation");
const impressionRotateControls = document.getElementById("impressionRotateControls");
const impressionRotateLeftBtn = document.getElementById("impressionRotateLeftBtn");
const impressionRotateRightBtn = document.getElementById("impressionRotateRightBtn");
const impressionUndoBtn = document.getElementById("impressionUndoBtn");
const impressionMaskBtn = document.getElementById("impressionMaskBtn");
const impressionMask = document.getElementById("impressionMask");
const impressionMaskControls = document.getElementById("impressionMaskControls");
const impressionMaskRotationInput = document.getElementById("impressionMaskRotation");
const impressionMaskScaleInput = document.getElementById("impressionMaskScale");
const impressionSubmitDrawBtn = document.getElementById("impressionSubmitDrawBtn");
const impressionWordBank = document.getElementById("impressionWordBank");
const impressionDrawings = document.getElementById("impressionDrawings");
const impressionSubmitMatchesBtn = document.getElementById("impressionSubmitMatchesBtn");
const impressionContinueBtn = document.getElementById("impressionContinueBtn");
const impressionEndBtn = document.getElementById("impressionEndBtn");

const splendorPanel = document.getElementById("splendorPanel");
const splendorPhaseLabel = document.getElementById("splendorPhase");
const splendorTurnLabel = document.getElementById("splendorTurn");
const splendorFinalRoundLabel = document.getElementById("splendorFinalRound");
const splendorWinnerLabel = document.getElementById("splendorWinner");
const splendorSupply = document.getElementById("splendorSupply");
const splendorMarketTier1 = document.getElementById("splendorMarketTier1");
const splendorMarketTier2 = document.getElementById("splendorMarketTier2");
const splendorMarketTier3 = document.getElementById("splendorMarketTier3");
const splendorNobles = document.getElementById("splendorNobles");
const splendorSelectedMarketLabel = document.getElementById("splendorSelectedMarket");
const splendorSelectedReservedLabel = document.getElementById("splendorSelectedReserved");
const splendorSelectedNobleLabel = document.getElementById("splendorSelectedNoble");
const splendorClearSelectionBtn = document.getElementById("splendorClearSelection");
const splendorReserveTierSelect = document.getElementById("splendorReserveTier");
const splendorTokenSelectionEl = document.getElementById("splendorTokenSelection");
const splendorDiscardSelectionRow = document.getElementById("splendorDiscardSelectionRow");
const splendorDiscardSelectionEl = document.getElementById("splendorDiscardSelection");
const splendorDiscardHint = document.getElementById("splendorDiscardHint");
const splendorTakeThreeBtn = document.getElementById("splendorTakeThreeBtn");
const splendorTakeTwoBtn = document.getElementById("splendorTakeTwoBtn");
const splendorReserveMarketBtn = document.getElementById("splendorReserveMarketBtn");
const splendorReserveDeckBtn = document.getElementById("splendorReserveDeckBtn");
const splendorBuyMarketBtn = document.getElementById("splendorBuyMarketBtn");
const splendorBuyReservedBtn = document.getElementById("splendorBuyReservedBtn");
const splendorDiscardBtn = document.getElementById("splendorDiscardBtn");
const splendorChooseNobleBtn = document.getElementById("splendorChooseNobleBtn");
const splendorReserved = document.getElementById("splendorReserved");
const splendorPlayers = document.getElementById("splendorPlayers");

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
const blokusStatusLabel = document.getElementById("blokusStatus");
const blokusTurnLabel = document.getElementById("blokusTurn");
const blokusWinnerLabel = document.getElementById("blokusWinner");
const blokusSelectedPieceLabel = document.getElementById("blokusSelectedPiece");
const blokusOriginLabel = document.getElementById("blokusOrigin");
const blokusPlaceBtn = document.getElementById("blokusPlaceBtn");
const blokusGiveUpBtn = document.getElementById("blokusGiveUpBtn");
const blokusBoardControls = document.getElementById("blokusBoardControls");
const blokusRotateLeftBtn = document.getElementById("blokusRotateLeftBtn");
const blokusRotateRightBtn = document.getElementById("blokusRotateRightBtn");
const blokusFlipBtn = document.getElementById("blokusFlipBtn");
const blokusNudgeUpBtn = document.getElementById("blokusNudgeUpBtn");
const blokusNudgeLeftBtn = document.getElementById("blokusNudgeLeftBtn");
const blokusNudgeDownBtn = document.getElementById("blokusNudgeDownBtn");
const blokusNudgeRightBtn = document.getElementById("blokusNudgeRightBtn");
const blokusBoard = document.getElementById("blokusBoard");
const blokusPieces = document.getElementById("blokusPieces");
const blokusPlayers = document.getElementById("blokusPlayers");

const actionButtons = {
  initial_peek: document.getElementById("peekBtn"),
  draw_deck: document.getElementById("drawDeckBtn"),
  draw_discard: document.getElementById("drawDiscardBtn"),
  replace_card: document.getElementById("replaceBtn"),
  discard_drawn: document.getElementById("discardDrawnBtn"),
  attempt_match: document.getElementById("matchBtn"),
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

const decryptoActionButtons = {
  submit_clues: decryptoSubmitCluesBtn,
  submit_decrypt: decryptoSubmitDecryptBtn,
  submit_intercept: decryptoSubmitInterceptBtn,
};

const drawGuessActionButtons = {
  submit_drawing: drawGuessSubmitDrawBtn,
  submit_guess: drawGuessSubmitGuessBtn,
};
const impressionActionButtons = {
  submit_drawing: impressionSubmitDrawBtn,
  submit_matches: impressionSubmitMatchesBtn,
  continue_game: impressionContinueBtn,
  end_game: impressionEndBtn,
};

const splendorActionButtons = {
  take_tokens: splendorTakeThreeBtn,
  take_tokens_same: splendorTakeTwoBtn,
  reserve_market: splendorReserveMarketBtn,
  reserve_deck: splendorReserveDeckBtn,
  buy_market: splendorBuyMarketBtn,
  buy_reserved: splendorBuyReservedBtn,
  discard_tokens: splendorDiscardBtn,
  choose_noble: splendorChooseNobleBtn,
};

const splendorBaseColors = ["white", "blue", "green", "red", "black"];
const splendorColors = [...splendorBaseColors, "gold"];
const splendorColorLabels = {
  white: "W",
  blue: "B",
  green: "G",
  red: "R",
  black: "K",
  gold: "Gold",
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
  const text = JSON.stringify(snapshot, null, 2);
  const ok = await copyTextToClipboard(text);
  if (ok) {
    log("Game state copied to clipboard.");
  } else {
    log("Failed to copy game state.");
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

function openSeatClaimModal(roomId, sourceRoomId) {
  requestSeatClaim(roomId, sourceRoomId, true);
}

function closeSeatClaimModal() {
  clearPendingSeatClaim();
  setModalVisible(seatClaimModal, false);
}

function openAidixitZoom(imageUrl, altText) {
  if (!aidixitZoomModal || !aidixitZoomImage || !imageUrl) {
    return;
  }
  aidixitZoomImage.src = imageUrl;
  aidixitZoomImage.alt = altText || "Card detail";
  setModalVisible(aidixitZoomModal, true);
}

function closeAidixitZoom() {
  if (!aidixitZoomModal || !aidixitZoomImage) {
    return;
  }
  setModalVisible(aidixitZoomModal, false);
  aidixitZoomImage.src = "";
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
  const showGoldRush = gameType === "gold_rush";
  const showSkull = gameType === "skull";
  const showMismatch = gameType === "perfect_mismatch";
  const showCoyote = gameType === "coyote";
  const showHalli = gameType === "halli_galli";
  const showDecrypto = gameType === "decrypto";
  const showDrawGuess = gameType === "draw_guess";
  const showAidixit = gameType === "aidixit";
  const showImpression = gameType === "impression_flower";
  const showSplendor = gameType === "splendor";
  const showAbraca = gameType === "abraca_what";
  const showBlokus = gameType === "blokus";
  caboPanel.classList.toggle("hidden", !showCabo);
  if (flip7Panel) {
    flip7Panel.classList.toggle("hidden", !showFlip7);
  }
  if (goldRushPanel) {
    goldRushPanel.classList.toggle("hidden", !showGoldRush);
  }
  skullPanel.classList.toggle("hidden", !showSkull);
  if (mismatchPanel) {
    mismatchPanel.classList.toggle("hidden", !showMismatch);
  }
  if (coyotePanel) {
    coyotePanel.classList.toggle("hidden", !showCoyote);
  }
  if (halliPanel) {
    halliPanel.classList.toggle("hidden", !showHalli);
  }
  if (decryptoPanel) {
    decryptoPanel.classList.toggle("hidden", !showDecrypto);
  }
  drawGuessPanel.classList.toggle("hidden", !showDrawGuess);
  if (aidixitPanel) {
    aidixitPanel.classList.toggle("hidden", !showAidixit);
  }
  if (impressionFlowerPanel) {
    impressionFlowerPanel.classList.toggle("hidden", !showImpression);
  }
  if (splendorPanel) {
    splendorPanel.classList.toggle("hidden", !showSplendor);
  }
  if (abracaPanel) {
    abracaPanel.classList.toggle("hidden", !showAbraca);
  }
  if (blokusPanel) {
    blokusPanel.classList.toggle("hidden", !showBlokus);
  }
}

function updateDrawGuessLanguageRow() {
  const showRow = currentRoomState && currentGameType === "draw_guess" && currentRoomState.status === "lobby";
  if (drawGuessConfigBox) {
    drawGuessConfigBox.classList.toggle("hidden", !showRow);
    drawGuessConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (drawGuessLanguageRow) {
    drawGuessLanguageRow.classList.toggle("hidden", !showRow);
    drawGuessLanguageRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (drawGuessGuessMethodRow) {
    drawGuessGuessMethodRow.classList.toggle("hidden", !showRow);
    drawGuessGuessMethodRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (drawGuessAnswerLengthOptionRow) {
    drawGuessAnswerLengthOptionRow.classList.toggle("hidden", !showRow);
    drawGuessAnswerLengthOptionRow.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function roomHasBots() {
  return (
    currentRoomState &&
    Array.isArray(currentRoomState.players) &&
    currentRoomState.players.some((player) => player && player.is_bot)
  );
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

function updateAidixitDeckRow() {
  const showRow = currentRoomState && currentGameType === "aidixit" && currentRoomState.status === "lobby";
  if (aidixitConfigBox) {
    aidixitConfigBox.classList.toggle("hidden", !showRow);
    aidixitConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (aidixitDeckRow) {
    aidixitDeckRow.classList.toggle("hidden", !showRow);
    aidixitDeckRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (showRow && !aidixitDecksLoaded) {
    fetchAidixitDecks();
  }
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

function updateMismatchConfigRow() {
  const showRow = currentRoomState && currentGameType === "perfect_mismatch" && currentRoomState.status === "lobby";
  if (mismatchConfigBox) {
    mismatchConfigBox.classList.toggle("hidden", !showRow);
    mismatchConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function updateAutoSaveRow() {
  const showRow =
    currentRoomState && (currentRoomState.status === "lobby" || currentRoomState.status === "game_over");
  if (autoSaveRow) {
    autoSaveRow.classList.toggle("hidden", !showRow);
    autoSaveRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (autoSaveToggle) {
    autoSaveToggle.checked = Boolean(currentRoomState && currentRoomState.auto_save);
    autoSaveToggle.disabled = !showRow;
  }
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

function fetchAidixitDecks() {
  if (!aidixitDeckOptions) {
    return;
  }
  aidixitDeckOptions.textContent = "Loading decks...";
  fetch("/api/aidixit/decks")
    .then((response) => response.json())
    .then((data) => {
      aidixitDecks = Array.isArray(data.decks) ? data.decks : [];
      aidixitDecksLoaded = true;
      renderAidixitDeckOptions();
    })
    .catch(() => {
      aidixitDeckOptions.textContent = "Failed to load decks.";
      aidixitDecksLoaded = false;
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

function renderAidixitDeckOptions() {
  if (!aidixitDeckOptions) {
    return;
  }
  aidixitDeckOptions.innerHTML = "";
  if (!aidixitDecks.length) {
    aidixitDeckOptions.textContent = "No decks available.";
    return;
  }
  const availableDeckIds = new Set();
  aidixitDecks.forEach((deck) => {
    if (deck.id) {
      availableDeckIds.add(deck.id);
    }
  });
  aidixitDeckSelections = new Set(
    Array.from(aidixitDeckSelections).filter((deckId) => availableDeckIds.has(deckId))
  );
  if (aidixitDeckSelections.size === 0) {
    availableDeckIds.forEach((deckId) => {
      aidixitDeckSelections.add(deckId);
    });
  }
  aidixitDecks.forEach((deck) => {
    const deckId = deck.id;
    if (!deckId) {
      return;
    }
    const label = document.createElement("label");
    label.className = "decrypto-pack-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = deckId;
    checkbox.checked = aidixitDeckSelections.has(deckId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        aidixitDeckSelections.add(deckId);
      } else {
        aidixitDeckSelections.delete(deckId);
      }
    });
    const text = document.createElement("span");
    const name = deck.name || deckId;
    const count = Number.isFinite(deck.count) ? ` (${deck.count})` : "";
    text.textContent = `${name}${count}`;
    label.appendChild(checkbox);
    label.appendChild(text);
    aidixitDeckOptions.appendChild(label);
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

function getSelectedAidixitDecks() {
  return Array.from(aidixitDeckSelections);
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
  clearGoldRushState();
  clearSkullState();
  clearMismatchState();
  clearCoyoteState();
  clearHalliState();
  clearDecryptoState();
  clearDrawGuessState();
  clearAidixitState();
  clearImpressionFlowerState();
  clearSplendorState();
  clearAbracaState();
  clearBlokusState();
  setGamePanelVisibility(null);
  updateDrawGuessLanguageRow();
  updateDecryptoPackRow();
  updateDecryptoBotRow();
  updateAidixitDeckRow();
  updateHalliConfigRow();
  updateGoldRushConfigRow();
  updateMismatchConfigRow();
  updateAutoSaveRow();
  if (drawGuessLanguageSelect) {
    drawGuessLanguageSelect.value = "zh";
  }
  if (drawGuessGuessMethodSelect) {
    drawGuessGuessMethodSelect.value = "normal";
  }
  if (drawGuessAnswerLengthToggle) {
    drawGuessAnswerLengthToggle.checked = false;
  }
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
  if (mismatchSliderCount) {
    mismatchSliderCount.value = "3";
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
  selectedSlotsLabel.textContent = "-";
  targetSelection.textContent = "-";
  targetList.innerHTML = "";
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

function clearDrawGuessState() {
  currentDrawGuessView = null;
  drawGuessLastRound = null;
  drawGuessLastPhase = null;
  drawGuessIsDrawing = false;
  drawGuessHasDrawn = false;
  drawGuessBrushColor = "#000000";
  drawGuessBrushSize = 3;
  setDrawGuessTool(false);
  updateDrawGuessColorButtons();
  updateDrawGuessBrushButtons();
  drawGuessPhaseLabel.textContent = "-";
  drawGuessRoundLabel.textContent = "-";
  drawGuessTotalRoundsLabel.textContent = "-";
  drawGuessSubmittedLabel.textContent = "-";
  drawGuessPromptLabel.textContent = "-";
  if (drawGuessAnswerLengthLabel) {
    drawGuessAnswerLengthLabel.textContent = "-";
  }
  if (drawGuessAnswerLengthHintRow) {
    drawGuessAnswerLengthHintRow.classList.add("hidden");
  }
  drawGuessPlayers.innerHTML = "";
  drawGuessBooks.innerHTML = "";
  drawGuessReview.classList.add("hidden");
  drawGuessDrawArea.classList.add("hidden");
  drawGuessGuessArea.classList.add("hidden");
  drawGuessPromptRow.classList.remove("hidden");
  if (drawGuessInput) {
    drawGuessInput.value = "";
  }
  if (drawGuessImage) {
    drawGuessImage.removeAttribute("src");
  }
  clearDrawGuessCanvas();
  updateDrawGuessButtons();
}

function clearAidixitState() {
  currentAidixitView = null;
  aidixitSelectedHandCardId = null;
  aidixitSelectedVoteCardId = null;
  if (aidixitPhaseLabel) {
    aidixitPhaseLabel.textContent = "-";
  }
  if (aidixitRoundLabel) {
    aidixitRoundLabel.textContent = "-";
  }
  if (aidixitStorytellerLabel) {
    aidixitStorytellerLabel.textContent = "-";
  }
  if (aidixitClueLabel) {
    aidixitClueLabel.textContent = "-";
  }
  if (aidixitTargetScoreLabel) {
    aidixitTargetScoreLabel.textContent = "-";
  }
  if (aidixitDeckCountLabel) {
    aidixitDeckCountLabel.textContent = "-";
  }
  if (aidixitDiscardCountLabel) {
    aidixitDiscardCountLabel.textContent = "-";
  }
  if (aidixitSubmittedLabel) {
    aidixitSubmittedLabel.textContent = "-";
  }
  if (aidixitVotedLabel) {
    aidixitVotedLabel.textContent = "-";
  }
  if (aidixitWinnerLabel) {
    aidixitWinnerLabel.textContent = "-";
  }
  if (aidixitClueInput) {
    aidixitClueInput.value = "";
    aidixitClueInput.disabled = true;
  }
  if (aidixitHand) {
    aidixitHand.innerHTML = "";
  }
  if (aidixitPool) {
    aidixitPool.innerHTML = "";
  }
  if (aidixitRoundNotice) {
    aidixitRoundNotice.classList.add("hidden");
  }
  if (aidixitRoundNoticeBody) {
    aidixitRoundNoticeBody.textContent = "-";
  }
  if (aidixitRoundNoticeCards) {
    aidixitRoundNoticeCards.innerHTML = "";
  }
  if (aidixitPlayers) {
    aidixitPlayers.innerHTML = "";
  }
  updateAidixitButtons();
}

function clearImpressionFlowerState() {
  currentImpressionView = null;
  impressionConfig = null;
  impressionConfigSignature = null;
  impressionStampHistory = [];
  impressionStampsLeft = 0;
  impressionStampsMax = 0;
  impressionShapeColorMap = {};
  impressionCurrentShape = null;
  impressionCurrentColor = null;
  impressionRotation = 0;
  impressionPressStart = null;
  impressionActiveStampIndex = null;
  impressionDraggingStamp = null;
  impressionMaskTarget = null;
  impressionMaskActive = false;
  impressionMaskState = null;
  impressionMaskDrag = null;
  impressionSelectedWord = null;
  impressionMatches = {};
  impressionLastRound = null;
  impressionLastPhase = null;
  impressionShapeButtonEls = [];
  if (impressionPhaseLabel) {
    impressionPhaseLabel.textContent = "-";
  }
  if (impressionRoundLabel) {
    impressionRoundLabel.textContent = "-";
  }
  if (impressionRoundsPerGuesserLabel) {
    impressionRoundsPerGuesserLabel.textContent = "-";
  }
  if (impressionGuesserLabel) {
    impressionGuesserLabel.textContent = "-";
  }
  if (impressionRoleLabel) {
    impressionRoleLabel.textContent = "-";
  }
  if (impressionStampsLeftLabel) {
    impressionStampsLeftLabel.textContent = "-";
  }
  if (impressionScoreLabel) {
    impressionScoreLabel.textContent = "-";
  }
  if (impressionPromptLabel) {
    impressionPromptLabel.textContent = "-";
  }
  if (impressionRoundResult) {
    impressionRoundResult.textContent = "-";
  }
  if (impressionPromptRow) {
    impressionPromptRow.classList.add("hidden");
  }
  if (impressionDrawArea) {
    impressionDrawArea.classList.add("hidden");
  }
  if (impressionGuessArea) {
    impressionGuessArea.classList.add("hidden");
  }
  if (impressionRoundEnd) {
    impressionRoundEnd.classList.add("hidden");
  }
  if (impressionWordBank) {
    impressionWordBank.innerHTML = "";
  }
  if (impressionDrawings) {
    impressionDrawings.innerHTML = "";
  }
  if (impressionPlayers) {
    impressionPlayers.innerHTML = "";
  }
  if (impressionMask) {
    impressionMask.classList.add("hidden");
  }
  if (impressionMaskControls) {
    impressionMaskControls.classList.add("hidden");
  }
  stopImpressionRotateHold();
  stopImpressionPreviewLoop();
  clearImpressionCanvas();
  updateImpressionRotateControls();
  updateImpressionButtons();
}

function resetSplendorTokenSelection() {
  splendorTokenSelection = {};
  splendorColors.forEach((color) => {
    splendorTokenSelection[color] = 0;
  });
}

function resetSplendorDiscardSelection() {
  splendorDiscardSelection = {};
  splendorColors.forEach((color) => {
    splendorDiscardSelection[color] = 0;
  });
}

function clearSplendorState() {
  currentSplendorView = null;
  splendorSelectedMarket = null;
  splendorSelectedReserved = null;
  splendorSelectedNoble = null;
  splendorNobleCatalog = {};
  resetSplendorTokenSelection();
  resetSplendorDiscardSelection();
  if (splendorDiscardSelectionRow) {
    splendorDiscardSelectionRow.classList.add("hidden");
  }
  if (splendorDiscardHint) {
    splendorDiscardHint.textContent = "";
    splendorDiscardHint.classList.add("hidden");
  }
  if (splendorPhaseLabel) {
    splendorPhaseLabel.textContent = "-";
  }
  if (splendorTurnLabel) {
    splendorTurnLabel.textContent = "-";
  }
  if (splendorFinalRoundLabel) {
    splendorFinalRoundLabel.textContent = "-";
  }
  if (splendorWinnerLabel) {
    splendorWinnerLabel.textContent = "-";
  }
  if (splendorSupply) {
    splendorSupply.innerHTML = "";
  }
  if (splendorMarketTier1) {
    splendorMarketTier1.innerHTML = "";
  }
  if (splendorMarketTier2) {
    splendorMarketTier2.innerHTML = "";
  }
  if (splendorMarketTier3) {
    splendorMarketTier3.innerHTML = "";
  }
  if (splendorNobles) {
    splendorNobles.innerHTML = "";
  }
  if (splendorReserved) {
    splendorReserved.innerHTML = "";
  }
  if (splendorPlayers) {
    splendorPlayers.innerHTML = "";
  }
  updateSplendorSelectionLabels();
  updateSplendorActionButtons();
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

function clearBlokusState() {
  currentBlokusView = null;
  blokusSelectedPieceId = null;
  blokusSelectedOrigin = null;
  blokusRotation = 0;
  blokusFlip = false;
  blokusDragState = null;
  if (blokusStatusLabel) {
    blokusStatusLabel.textContent = "-";
  }
  if (blokusTurnLabel) {
    blokusTurnLabel.textContent = "-";
  }
  if (blokusWinnerLabel) {
    blokusWinnerLabel.textContent = "-";
  }
  if (blokusSelectedPieceLabel) {
    blokusSelectedPieceLabel.textContent = "-";
  }
  if (blokusOriginLabel) {
    blokusOriginLabel.textContent = "-";
  }
  if (blokusBoardControls) {
    blokusBoardControls.classList.add("hidden");
    blokusBoardControls.style.left = "";
    blokusBoardControls.style.top = "";
  }
  if (blokusBoard) {
    blokusBoard.classList.remove("dragging");
    blokusBoard.innerHTML = "";
  }
  if (blokusPieces) {
    blokusPieces.innerHTML = "";
  }
  if (blokusPlayers) {
    blokusPlayers.innerHTML = "";
  }
  updateBlokusActionButton();
}

function normalizeBlokusCells(cells) {
  if (!cells.length) {
    return [];
  }
  let minX = cells[0][0];
  let minY = cells[0][1];
  cells.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  });
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}

function rotateBlokusCells(cells) {
  return cells.map(([x, y]) => [y, -x]);
}

function flipBlokusCells(cells) {
  return cells.map(([x, y]) => [-x, y]);
}

function transformBlokusCells(cells, rotation, flip) {
  let coords = cells.map(([x, y]) => [x, y]);
  if (flip) {
    coords = flipBlokusCells(coords);
  }
  const turns = Math.floor(((rotation % 360) + 360) / 90) % 4;
  for (let i = 0; i < turns; i += 1) {
    coords = rotateBlokusCells(coords);
  }
  return normalizeBlokusCells(coords);
}

function getBlokusYou(view) {
  if (!view || !Array.isArray(view.players)) {
    return null;
  }
  return view.players.find((player) => player.player_id === view.you) || null;
}

function isBlokusFirstMove(view, you) {
  if (!view || !you) {
    return false;
  }
  const totalPieces = view.piece_defs ? Object.keys(view.piece_defs).length : 0;
  const remaining = Array.isArray(view.remaining_pieces) ? view.remaining_pieces.length : null;
  if (totalPieces && remaining !== null && remaining === totalPieces) {
    return true;
  }
  const color = you.color;
  const board = Array.isArray(view.board) ? view.board : [];
  if (!color || !board.length) {
    return false;
  }
  for (let y = 0; y < board.length; y += 1) {
    const row = board[y];
    if (!Array.isArray(row)) {
      continue;
    }
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === color) {
        return false;
      }
    }
  }
  return true;
}

function getBlokusLegalPlacements(view, pieceId, rotation, flip) {
  if (!view || !pieceId || !view.piece_defs) {
    return [];
  }
  const def = view.piece_defs[pieceId];
  if (!def || !Array.isArray(def.cells) || !def.cells.length) {
    return [];
  }
  const you = getBlokusYou(view);
  if (!you || !you.color || you.passed) {
    return [];
  }
  const coords = transformBlokusCells(def.cells, rotation, flip);
  if (!coords.length) {
    return [];
  }
  const size = view.board_size || 20;
  const board = Array.isArray(view.board) ? view.board : [];
  const width = Math.max(...coords.map(([x]) => x)) + 1;
  const height = Math.max(...coords.map(([, y]) => y)) + 1;
  const maxX = size - width;
  const maxY = size - height;
  if (maxX < 0 || maxY < 0) {
    return [];
  }
  const firstMove = isBlokusFirstMove(view, you);
  const startCorner = Array.isArray(you.start_corner) ? you.start_corner : null;
  const color = you.color;
  const placements = [];

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      let hasDiagonal = false;
      let coversCorner = false;
      let blocked = false;
      for (let i = 0; i < coords.length; i += 1) {
        const [dx, dy] = coords[i];
        const cx = x + dx;
        const cy = y + dy;
        const row = board[cy];
        if (row && row[cx] != null) {
          blocked = true;
          break;
        }
        if (firstMove) {
          if (startCorner && cx === startCorner[0] && cy === startCorner[1]) {
            coversCorner = true;
          }
        } else {
          for (let j = 0; j < BLOKUS_ADJACENT_OFFSETS.length; j += 1) {
            const [ax, ay] = BLOKUS_ADJACENT_OFFSETS[j];
            const nx = cx + ax;
            const ny = cy + ay;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              const adjRow = board[ny];
              if (adjRow && adjRow[nx] === color) {
                blocked = true;
                break;
              }
            }
          }
          if (blocked) {
            break;
          }
          for (let j = 0; j < BLOKUS_DIAGONAL_OFFSETS.length; j += 1) {
            const [dx2, dy2] = BLOKUS_DIAGONAL_OFFSETS[j];
            const nx = cx + dx2;
            const ny = cy + dy2;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              const diagRow = board[ny];
              if (diagRow && diagRow[nx] === color) {
                hasDiagonal = true;
              }
            }
          }
        }
      }
      if (blocked) {
        continue;
      }
      if (firstMove) {
        if (!coversCorner) {
          continue;
        }
      } else if (!hasDiagonal) {
        continue;
      }
      placements.push({ x, y });
    }
  }
  return placements;
}

function getBlokusOrientationVariants(baseRotation, baseFlip) {
  const rotations = [0, 90, 180, 270];
  const flips = [false, true];
  const variants = [];
  const seen = new Set();
  const normalizeRotation = (rotation) => ((rotation % 360) + 360) % 360;
  const addVariant = (rotation, flip) => {
    const key = `${rotation}:${flip}`;
    if (seen.has(key)) {
      return;
    }
    variants.push({ rotation, flip });
    seen.add(key);
  };
  const normalizedBase = normalizeRotation(baseRotation);
  const base = rotations.includes(normalizedBase) ? normalizedBase : 0;
  addVariant(base, !!baseFlip);
  flips.forEach((flip) => {
    rotations.forEach((rotation) => {
      addVariant(rotation, flip);
    });
  });
  return variants;
}

function getNextBlokusAutoPlacement(view) {
  if (!view || !blokusSelectedPieceId) {
    return null;
  }
  const variants = getBlokusOrientationVariants(blokusRotation, blokusFlip);
  const placements = [];
  variants.forEach(({ rotation, flip }) => {
    const options = getBlokusLegalPlacements(view, blokusSelectedPieceId, rotation, flip);
    options.forEach(({ x, y }) => {
      placements.push({ x, y, rotation, flip });
    });
  });
  if (!placements.length) {
    return null;
  }
  if (blokusSelectedOrigin) {
    const currentRotation = ((blokusRotation % 360) + 360) % 360;
    const currentFlip = !!blokusFlip;
    const index = placements.findIndex(
      (placement) => placement.x === blokusSelectedOrigin.x
        && placement.y === blokusSelectedOrigin.y
        && placement.rotation === currentRotation
        && placement.flip === currentFlip,
    );
    if (index >= 0) {
      return placements[(index + 1) % placements.length];
    }
  }
  return placements[0];
}

function getBlokusFallbackOrigin(view, pieceId, rotation, flip) {
  if (!view || !pieceId || !view.piece_defs) {
    return null;
  }
  const def = view.piece_defs[pieceId];
  if (!def || !Array.isArray(def.cells) || !def.cells.length) {
    return null;
  }
  const coords = transformBlokusCells(def.cells, rotation, flip);
  if (!coords.length) {
    return null;
  }
  const size = view.board_size || 20;
  const width = Math.max(...coords.map(([x]) => x)) + 1;
  const height = Math.max(...coords.map(([, y]) => y)) + 1;
  if (size < width || size < height) {
    return null;
  }
  return { x: 0, y: 0 };
}

function getBlokusBoardMetrics() {
  if (!blokusBoard) {
    return { cell: 18, gap: 1, pad: 6 };
  }
  const style = window.getComputedStyle(blokusBoard);
  const readPx = (value, fallback) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const gap = readPx(style.getPropertyValue("--blokus-gap"), 1);
  const pad = readPx(style.getPropertyValue("--blokus-pad"), 6);
  let cell = readPx(style.getPropertyValue("--blokus-cell"), NaN);
  if (!Number.isFinite(cell)) {
    const rect = blokusBoard.getBoundingClientRect();
    if (Number.isFinite(rect.width) && rect.width > 0) {
      cell = (rect.width - (2 * pad) - (19 * gap)) / 20;
    }
  }
  return {
    cell: Number.isFinite(cell) ? cell : 18,
    gap,
    pad,
  };
}

function getBlokusPointerPoint(event) {
  if (!blokusBoard || !event) {
    return null;
  }
  const rect = blokusBoard.getBoundingClientRect();
  const clientX = event.clientX ?? (event.touches && event.touches[0] && event.touches[0].clientX);
  const clientY = event.clientY ?? (event.touches && event.touches[0] && event.touches[0].clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function getBlokusGridPoint(point, metrics) {
  if (!point || !metrics) {
    return null;
  }
  const span = metrics.cell + metrics.gap;
  if (!span) {
    return null;
  }
  return {
    x: (point.x - metrics.pad - metrics.cell / 2) / span,
    y: (point.y - metrics.pad - metrics.cell / 2) / span,
  };
}

function getBlokusSelectedPiecePlacement(view) {
  if (!view || !blokusSelectedPieceId || !view.piece_defs) {
    return null;
  }
  const def = view.piece_defs[blokusSelectedPieceId];
  if (!def || !Array.isArray(def.cells) || !def.cells.length) {
    return null;
  }
  const coords = transformBlokusCells(def.cells, blokusRotation, blokusFlip);
  if (!coords.length) {
    return null;
  }
  let sumX = 0;
  let sumY = 0;
  coords.forEach(([x, y]) => {
    sumX += x;
    sumY += y;
  });
  const maxX = Math.max(...coords.map(([x]) => x));
  const maxY = Math.max(...coords.map(([, y]) => y));
  return {
    width: maxX + 1,
    height: maxY + 1,
    anchorX: sumX / coords.length,
    anchorY: sumY / coords.length,
  };
}

function clampBlokusValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getBlokusOriginFromPoint(point, alignToCenter) {
  if (!currentBlokusView || !point) {
    return null;
  }
  const metrics = getBlokusBoardMetrics();
  const gridPoint = getBlokusGridPoint(point, metrics);
  if (!gridPoint || !Number.isFinite(gridPoint.x) || !Number.isFinite(gridPoint.y)) {
    return null;
  }
  const placement = getBlokusSelectedPiecePlacement(currentBlokusView);
  const anchorX = alignToCenter && placement ? placement.anchorX : 0;
  const anchorY = alignToCenter && placement ? placement.anchorY : 0;
  const rawX = Math.round(gridPoint.x - anchorX);
  const rawY = Math.round(gridPoint.y - anchorY);
  const size = currentBlokusView.board_size || 20;
  const width = placement ? placement.width : 1;
  const height = placement ? placement.height : 1;
  const maxX = Math.max(0, size - width);
  const maxY = Math.max(0, size - height);
  return {
    x: clampBlokusValue(rawX, 0, maxX),
    y: clampBlokusValue(rawY, 0, maxY),
  };
}

function positionBlokusControls(bounds, boardSize) {
  if (!blokusBoardControls || !blokusBoard) {
    return;
  }
  if (!bounds) {
    blokusBoardControls.classList.add("hidden");
    blokusBoardControls.style.left = "";
    blokusBoardControls.style.top = "";
    return;
  }
  const { cell, gap, pad } = getBlokusBoardMetrics();
  const span = cell + gap;
  const pieceLeft = pad + bounds.minX * span;
  const pieceTop = pad + bounds.minY * span;
  const pieceRight = pad + (bounds.maxX + 1) * span - gap;
  const boardWidth = pad * 2 + boardSize * span - gap;
  const boardHeight = pad * 2 + boardSize * span - gap;

  blokusBoardControls.classList.remove("hidden");
  const controlsWidth = blokusBoardControls.offsetWidth || 90;
  const controlsHeight = blokusBoardControls.offsetHeight || 28;

  let left = pieceRight + 6;
  if (left + controlsWidth > boardWidth) {
    left = pieceLeft - controlsWidth - 6;
  }
  if (left < 0) {
    left = 0;
  }

  let top = pieceTop;
  if (top + controlsHeight > boardHeight) {
    top = Math.max(0, boardHeight - controlsHeight);
  }

  blokusBoardControls.style.left = `${left}px`;
  blokusBoardControls.style.top = `${top}px`;
}

function updateBlokusActionButton() {
  const legalActions = currentBlokusView && Array.isArray(currentBlokusView.legal_actions)
    ? currentBlokusView.legal_actions
    : [];
  if (blokusPlaceBtn) {
    const placeAllowed = legalActions.includes("place_piece");
    const placeEnabled = placeAllowed && !!blokusSelectedPieceId && !!blokusSelectedOrigin;
    blokusPlaceBtn.disabled = !placeEnabled;
    blokusPlaceBtn.classList.toggle("action-allowed", placeEnabled);
  }
  if (blokusGiveUpBtn) {
    const giveUpAllowed = legalActions.includes("give_up");
    blokusGiveUpBtn.disabled = !giveUpAllowed;
    blokusGiveUpBtn.classList.toggle("action-allowed", giveUpAllowed);
  }
}

function nudgeBlokusOrigin(dx, dy) {
  if (!currentBlokusView || currentBlokusView.game_over || !blokusSelectedOrigin) {
    return;
  }
  const placement = getBlokusSelectedPiecePlacement(currentBlokusView);
  const size = currentBlokusView.board_size || 20;
  const width = placement ? placement.width : 1;
  const height = placement ? placement.height : 1;
  const maxX = Math.max(0, size - width);
  const maxY = Math.max(0, size - height);
  const nextX = clampBlokusValue(blokusSelectedOrigin.x + dx, 0, maxX);
  const nextY = clampBlokusValue(blokusSelectedOrigin.y + dy, 0, maxY);
  setBlokusOrigin(nextX, nextY);
}

function handleBlokusPointerDown(event) {
  if (!currentBlokusView || currentBlokusView.game_over || !blokusBoard) {
    return;
  }
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  if (event.isPrimary === false) {
    return;
  }
  const point = getBlokusPointerPoint(event);
  if (!point) {
    return;
  }
  const allowDrag = !!(event.target && event.target.classList && event.target.classList.contains("ghost"));
  blokusDragState = {
    pointerId: event.pointerId,
    startX: point.x,
    startY: point.y,
    dragged: false,
    allowDrag,
  };
  if (allowDrag && event.pointerId !== undefined && blokusBoard.setPointerCapture) {
    try {
      blokusBoard.setPointerCapture(event.pointerId);
    } catch (err) {
      // Ignore capture errors for unsupported browsers.
    }
  }
}

function handleBlokusPointerMove(event) {
  if (!blokusDragState || !blokusBoard) {
    return;
  }
  if (event.pointerId !== undefined && blokusDragState.pointerId !== event.pointerId) {
    return;
  }
  if (!blokusDragState.allowDrag) {
    return;
  }
  const point = getBlokusPointerPoint(event);
  if (!point) {
    return;
  }
  const dx = point.x - blokusDragState.startX;
  const dy = point.y - blokusDragState.startY;
  if (!blokusDragState.dragged) {
    if ((dx * dx + dy * dy) < (BLOKUS_DRAG_THRESHOLD * BLOKUS_DRAG_THRESHOLD)) {
      return;
    }
    blokusDragState.dragged = true;
    blokusBoard.classList.add("dragging");
  }
  const origin = getBlokusOriginFromPoint(point, true);
  if (origin) {
    setBlokusOrigin(origin.x, origin.y);
  }
  event.preventDefault();
}

function handleBlokusPointerUp(event) {
  if (!blokusDragState || !blokusBoard) {
    return;
  }
  if (event.pointerId !== undefined && blokusDragState.pointerId !== event.pointerId) {
    return;
  }
  const isCancel = event.type === "pointercancel";
  const point = getBlokusPointerPoint(event);
  const wasDragged = blokusDragState.dragged;
  if (!isCancel && !wasDragged && point) {
    const origin = getBlokusOriginFromPoint(point, false);
    if (origin) {
      setBlokusOrigin(origin.x, origin.y);
    }
  }
  if (blokusDragState.allowDrag && event.pointerId !== undefined && blokusBoard.releasePointerCapture) {
    try {
      blokusBoard.releasePointerCapture(event.pointerId);
    } catch (err) {
      // Ignore capture errors for unsupported browsers.
    }
  }
  blokusDragState = null;
  blokusBoard.classList.remove("dragging");
}

function setBlokusOrigin(x, y, forceUpdate = false) {
  if (!forceUpdate && blokusSelectedOrigin && blokusSelectedOrigin.x === x && blokusSelectedOrigin.y === y) {
    return;
  }
  blokusSelectedOrigin = { x, y };
  if (blokusOriginLabel) {
    blokusOriginLabel.textContent = `${x}, ${y}`;
  }
  updateBlokusActionButton();
  if (currentBlokusView) {
    renderBlokusBoard(currentBlokusView);
  }
}

function renderBlokusPieces(view) {
  if (!blokusPieces) {
    return;
  }
  blokusPieces.innerHTML = "";
  const remaining = Array.isArray(view.remaining_pieces) ? view.remaining_pieces : [];
  let selectionChanged = false;
  if (blokusSelectedPieceId && !remaining.includes(blokusSelectedPieceId)) {
    blokusSelectedPieceId = null;
    selectionChanged = true;
  }
  if (blokusSelectedPieceLabel) {
    blokusSelectedPieceLabel.textContent = blokusSelectedPieceId || "-";
  }
  if (!remaining.length) {
    const empty = document.createElement("div");
    empty.textContent = "No pieces remaining.";
    blokusPieces.appendChild(empty);
    updateBlokusActionButton();
    if (selectionChanged) {
      renderBlokusBoard(view);
    }
    return;
  }
  remaining.forEach((pieceId) => {
    const def = view.piece_defs ? view.piece_defs[pieceId] : null;
    const cells = def && Array.isArray(def.cells) ? def.cells : [];
    const piece = document.createElement("button");
    piece.type = "button";
    piece.className = "blokus-piece";
    if (pieceId === blokusSelectedPieceId) {
      piece.classList.add("selected");
    }
    piece.addEventListener("click", () => {
      const wasSelected = blokusSelectedPieceId === pieceId;
      blokusSelectedPieceId = pieceId;
      if (!wasSelected) {
        blokusSelectedOrigin = null;
      }
      if (blokusSelectedPieceLabel) {
        blokusSelectedPieceLabel.textContent = pieceId;
      }
      const placement = getNextBlokusAutoPlacement(view);
      if (placement) {
        const rotationChanged = blokusRotation !== placement.rotation || blokusFlip !== placement.flip;
        blokusRotation = placement.rotation;
        blokusFlip = placement.flip;
        setBlokusOrigin(placement.x, placement.y, rotationChanged);
      } else {
        const fallback = getBlokusFallbackOrigin(view, pieceId, blokusRotation, blokusFlip);
        if (fallback) {
          setBlokusOrigin(fallback.x, fallback.y);
        }
      }
      renderBlokusPieces(view);
    });

    if (cells.length) {
      const width = Math.max(...cells.map(([x]) => x)) + 1;
      const height = Math.max(...cells.map(([, y]) => y)) + 1;
      const grid = document.createElement("div");
      grid.className = "blokus-piece-grid";
      grid.style.gridTemplateColumns = `repeat(${width}, 10px)`;
      grid.style.gridTemplateRows = `repeat(${height}, 10px)`;
      cells.forEach(([x, y]) => {
        const cell = document.createElement("div");
        cell.className = "blokus-piece-cell";
        cell.style.gridColumn = `${x + 1}`;
        cell.style.gridRow = `${y + 1}`;
        grid.appendChild(cell);
      });
      piece.appendChild(grid);
    }

    const label = document.createElement("div");
    label.className = "blokus-piece-label";
    label.textContent = pieceId;
    piece.appendChild(label);
    blokusPieces.appendChild(piece);
  });
  updateBlokusActionButton();
  if (selectionChanged) {
    renderBlokusBoard(view);
  }
}

function renderBlokusBoard(view) {
  if (!blokusBoard) {
    return;
  }
  const size = view.board_size || 20;
  const board = Array.isArray(view.board) ? view.board : [];
  let ghostCells = null;
  let ghostColor = null;
  let ghostBounds = null;
  const canPlace = Array.isArray(view.legal_actions)
    && view.legal_actions.includes("place_piece");
  if (canPlace && blokusSelectedPieceId && blokusSelectedOrigin && view.piece_defs) {
    const def = view.piece_defs[blokusSelectedPieceId];
    if (def && Array.isArray(def.cells)) {
      const coords = transformBlokusCells(def.cells, blokusRotation, blokusFlip);
      if (coords.length) {
        ghostCells = new Set();
        const maxDx = Math.max(...coords.map(([x]) => x));
        const maxDy = Math.max(...coords.map(([, y]) => y));
        ghostBounds = {
          minX: blokusSelectedOrigin.x,
          minY: blokusSelectedOrigin.y,
          maxX: blokusSelectedOrigin.x + maxDx,
          maxY: blokusSelectedOrigin.y + maxDy,
        };
        coords.forEach(([dx, dy]) => {
          const x = blokusSelectedOrigin.x + dx;
          const y = blokusSelectedOrigin.y + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) {
            ghostCells.add(`${x},${y}`);
          }
        });
        const you = (view.players || []).find((player) => player.player_id === view.you);
        ghostColor = you && you.color ? you.color : null;
      }
    }
  }
  blokusBoard.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (let y = 0; y < size; y += 1) {
    const row = Array.isArray(board[y]) ? board[y] : [];
    for (let x = 0; x < size; x += 1) {
      const cell = document.createElement("div");
      cell.className = "blokus-cell";
      const color = row[x];
      if (color) {
        cell.classList.add(color);
      }
      if (!color && ghostCells && ghostCells.has(`${x},${y}`)) {
        cell.classList.add("ghost");
        if (ghostColor) {
          cell.classList.add(ghostColor);
        }
      }
      if (canPlace && blokusSelectedOrigin && blokusSelectedOrigin.x === x && blokusSelectedOrigin.y === y) {
        cell.classList.add("selected");
      }
      fragment.appendChild(cell);
    }
  }
  blokusBoard.appendChild(fragment);
  positionBlokusControls(ghostBounds, size);
}

function renderBlokusPlayers(view) {
  if (!blokusPlayers) {
    return;
  }
  blokusPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (player.passed) {
      card.classList.add("disabled");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    const colorLabel = player.color ? ` (${player.color})` : "";
    name.textContent = `${player.name || player.player_id}${colorLabel}`;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const pieces = document.createElement("span");
    pieces.className = "badge";
    pieces.textContent = `pieces ${player.remaining_pieces}`;
    badges.appendChild(pieces);
    const cells = document.createElement("span");
    cells.className = "badge";
    cells.textContent = `cells ${player.remaining_cells}`;
    badges.appendChild(cells);
    if (Number.isInteger(player.score)) {
      const score = document.createElement("span");
      score.className = "badge";
      score.textContent = `score ${player.score}`;
      badges.appendChild(score);
    }
    if (player.passed) {
      const passed = document.createElement("span");
      passed.className = "badge";
      passed.textContent = "passed";
      badges.appendChild(passed);
    }
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

    blokusPlayers.appendChild(card);
  });
}

function updateSplendorSelectionLabels() {
  if (splendorSelectedMarketLabel) {
    if (splendorSelectedMarket) {
      splendorSelectedMarketLabel.textContent = `${splendorSelectedMarket.tier}:${splendorSelectedMarket.index + 1}`;
    } else {
      splendorSelectedMarketLabel.textContent = "-";
    }
  }
  if (splendorSelectedReservedLabel) {
    splendorSelectedReservedLabel.textContent = splendorSelectedReserved !== null ? `${splendorSelectedReserved + 1}` : "-";
  }
  if (splendorSelectedNobleLabel) {
    splendorSelectedNobleLabel.textContent = splendorSelectedNoble || "-";
  }
}

function updateSplendorDiscardHint(view) {
  if (!splendorDiscardHint) {
    return;
  }
  const requirement = getSplendorPendingDiscardRequirement(view);
  const excess = requirement ? requirement.excess : 0;
  if (excess > 0) {
    splendorDiscardHint.textContent = `Discard ${excess} token${excess === 1 ? "" : "s"} to stay at 10.`;
    splendorDiscardHint.classList.remove("hidden");
    if (splendorDiscardSelectionRow) {
      splendorDiscardSelectionRow.classList.remove("hidden");
    }
  } else {
    splendorDiscardHint.textContent = "";
    splendorDiscardHint.classList.add("hidden");
    if (splendorDiscardSelectionRow) {
      splendorDiscardSelectionRow.classList.add("hidden");
    }
    resetSplendorDiscardSelection();
    renderSplendorDiscardSelection();
  }
}

function clearSplendorSelection() {
  splendorSelectedMarket = null;
  splendorSelectedReserved = null;
  splendorSelectedNoble = null;
  resetSplendorTokenSelection();
  resetSplendorDiscardSelection();
  updateSplendorSelectionLabels();
  renderSplendorTokenSelection();
  renderSplendorDiscardSelection();
  updateSplendorDiscardHint(currentSplendorView);
  updateSplendorActionButtons();
}

function updateSkullSelectedCard() {
  skullSelectedCardLabel.textContent = skullSelectedCardType || "-";
}

function updateSkullTargetSelection() {
  if (!skullSelectedTarget || !currentSkullView) {
    skullTargetSelection.textContent = "-";
    return;
  }
  const player = currentSkullView.players.find((p) => p.player_id === skullSelectedTarget);
  skullTargetSelection.textContent = player ? player.name : skullSelectedTarget;
}

function clearSkullSelection() {
  skullSelectedCardIndex = null;
  skullSelectedCardType = null;
  skullSelectedTarget = null;
  updateSkullSelectedCard();
  updateSkullTargetSelection();
  updateSkullActionButtons();
  if (currentSkullView) {
    renderSkullHand(currentSkullView);
    renderSkullTargets(currentSkullView);
  }
}

function updateSelectedSlots() {
  selectedSlotsLabel.textContent = selectedSlots.length ? selectedSlots.join(", ") : "-";
}

function updateTargetSelection() {
  if (!selectedTarget || !currentCaboView) {
    targetSelection.textContent = "-";
    return;
  }
  const player = currentCaboView.players.find((p) => p.player_id === selectedTarget.playerId);
  if (!player) {
    targetSelection.textContent = "-";
    return;
  }
  targetSelection.textContent = `${player.name} #${selectedTarget.slot}`;
}

function clearTargetSelection() {
  selectedTarget = null;
  updateTargetSelection();
  updateActionButtons();
  if (currentCaboView) {
    renderTargets(currentCaboView);
  }
}

function clearFlip7TargetSelection() {
  flip7SelectedTarget = null;
  if (currentFlip7View) {
    updateFlip7TargetSelection(currentFlip7View);
    renderFlip7Players(currentFlip7View);
  } else {
    updateFlip7TargetSelection(null);
  }
  updateFlip7ActionButtons();
}

function splendorTokenSelectionTotal() {
  return splendorColors.reduce((sum, color) => sum + (splendorTokenSelection[color] || 0), 0);
}

function splendorDiscardSelectionTotal() {
  return splendorColors.reduce((sum, color) => sum + (splendorDiscardSelection[color] || 0), 0);
}

function splendorTotalTokens(tokens) {
  return splendorColors.reduce((sum, color) => sum + ((tokens && tokens[color]) || 0), 0);
}

function splendorTokenGainForAction(view, actionType) {
  const gain = {};
  splendorColors.forEach((color) => {
    gain[color] = 0;
  });
  if (actionType === "take_tokens") {
    const selected = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 1);
    const hasGold = (splendorTokenSelection.gold || 0) > 0;
    if (selected.length !== 3 || splendorTokenSelectionTotal() !== 3 || hasGold) {
      return null;
    }
    selected.forEach((color) => {
      gain[color] = 1;
    });
    return gain;
  }
  if (actionType === "take_tokens_same") {
    const selected = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 2);
    const hasOther = splendorBaseColors.some((color) => {
      const val = splendorTokenSelection[color] || 0;
      return val !== 0 && val !== 2;
    });
    const hasGold = (splendorTokenSelection.gold || 0) > 0;
    if (selected.length !== 1 || splendorTokenSelectionTotal() !== 2 || hasGold || hasOther) {
      return null;
    }
    gain[selected[0]] = 2;
    return gain;
  }
  if (actionType === "reserve_market" || actionType === "reserve_deck") {
    if (view && view.tokens_supply && view.tokens_supply.gold > 0) {
      gain.gold = 1;
    }
    return gain;
  }
  return null;
}

function splendorDiscardRequirement(view, gain) {
  if (!view || !gain) {
    return null;
  }
  const you = getSplendorYou(view);
  if (!you) {
    return null;
  }
  const currentTotal = splendorTotalTokens(you.tokens);
  const gainTotal = splendorColors.reduce((sum, color) => sum + (gain[color] || 0), 0);
  const excess = currentTotal + gainTotal - 10;
  if (excess <= 0) {
    return { excess: 0, available: null };
  }
  const available = {};
  splendorColors.forEach((color) => {
    available[color] = ((you.tokens && you.tokens[color]) || 0) + (gain[color] || 0);
  });
  return { excess, available };
}

function splendorIsDiscardSelectionValid(requirement) {
  if (!requirement || requirement.excess <= 0) {
    return true;
  }
  if (splendorDiscardSelectionTotal() !== requirement.excess) {
    return false;
  }
  return splendorColors.every(
    (color) => (splendorDiscardSelection[color] || 0) <= ((requirement.available && requirement.available[color]) || 0)
  );
}

function splendorDiscardSelectionPayload(requirement) {
  if (!requirement || requirement.excess <= 0) {
    return null;
  }
  const payload = {};
  splendorColors.forEach((color) => {
    const value = splendorDiscardSelection[color] || 0;
    if (value > 0) {
      payload[color] = value;
    }
  });
  return Object.keys(payload).length ? payload : null;
}

function splendorDiscardPayloadForAction(view, actionType) {
  const gain = splendorTokenGainForAction(view, actionType);
  const requirement = splendorDiscardRequirement(view, gain);
  if (!splendorIsDiscardSelectionValid(requirement)) {
    return null;
  }
  return splendorDiscardSelectionPayload(requirement);
}

function getSplendorPendingDiscardRequirement(view) {
  if (!view) {
    return null;
  }
  if (splendorTokenSelectionTotal() > 0) {
    if (view.legal_actions && view.legal_actions.includes("take_tokens")) {
      const gain = splendorTokenGainForAction(view, "take_tokens");
      if (gain) {
        return splendorDiscardRequirement(view, gain);
      }
    }
    if (view.legal_actions && view.legal_actions.includes("take_tokens_same")) {
      const gain = splendorTokenGainForAction(view, "take_tokens_same");
      if (gain) {
        return splendorDiscardRequirement(view, gain);
      }
    }
  }
  if (splendorSelectedMarket && view.legal_actions && view.legal_actions.includes("reserve_market")) {
    const gain = splendorTokenGainForAction(view, "reserve_market");
    return splendorDiscardRequirement(view, gain);
  }
  return null;
}

function renderSplendorTokenSelection() {
  if (!splendorTokenSelectionEl) {
    return;
  }
  splendorTokenSelectionEl.innerHTML = "";
  splendorColors.forEach((color) => {
    const wrapper = document.createElement("div");
    wrapper.className = `token-picker gem-${color}`;
    wrapper.addEventListener("click", (event) => {
      if (event.shiftKey || event.altKey) {
        adjustSplendorTokenSelection(color, -1);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (event.clientX < midpoint) {
        adjustSplendorTokenSelection(color, -1);
      } else {
        adjustSplendorTokenSelection(color, 1);
      }
    });
    wrapper.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      adjustSplendorTokenSelection(color, -1);
    });
    const label = document.createElement("span");
    label.textContent = splendorColorLabels[color] || color;
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    const count = document.createElement("span");
    count.textContent = String(splendorTokenSelection[color] || 0);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    minus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorTokenSelection(color, -1);
    });
    plus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorTokenSelection(color, 1);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(minus);
    wrapper.appendChild(count);
    wrapper.appendChild(plus);
    splendorTokenSelectionEl.appendChild(wrapper);
  });
}

function renderSplendorDiscardSelection() {
  if (!splendorDiscardSelectionEl) {
    return;
  }
  splendorDiscardSelectionEl.innerHTML = "";
  splendorColors.forEach((color) => {
    const wrapper = document.createElement("div");
    wrapper.className = `token-picker gem-${color}`;
    wrapper.addEventListener("click", (event) => {
      if (event.shiftKey || event.altKey) {
        adjustSplendorDiscardSelection(color, -1);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (event.clientX < midpoint) {
        adjustSplendorDiscardSelection(color, -1);
      } else {
        adjustSplendorDiscardSelection(color, 1);
      }
    });
    wrapper.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      adjustSplendorDiscardSelection(color, -1);
    });
    const label = document.createElement("span");
    label.textContent = splendorColorLabels[color] || color;
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    const count = document.createElement("span");
    count.textContent = String(splendorDiscardSelection[color] || 0);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    minus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorDiscardSelection(color, -1);
    });
    plus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorDiscardSelection(color, 1);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(minus);
    wrapper.appendChild(count);
    wrapper.appendChild(plus);
    splendorDiscardSelectionEl.appendChild(wrapper);
  });
}

function adjustSplendorTokenSelection(color, delta) {
  const current = splendorTokenSelection[color] || 0;
  const next = Math.max(0, Math.min(20, current + delta));
  splendorTokenSelection[color] = next;
  renderSplendorTokenSelection();
  updateSplendorDiscardHint(currentSplendorView);
  updateSplendorActionButtons();
}

function adjustSplendorDiscardSelection(color, delta) {
  const current = splendorDiscardSelection[color] || 0;
  const next = Math.max(0, Math.min(20, current + delta));
  splendorDiscardSelection[color] = next;
  renderSplendorDiscardSelection();
  updateSplendorDiscardHint(currentSplendorView);
  updateSplendorActionButtons();
}

function isActionAvailable(actionType) {
  if (!currentCaboView || !Array.isArray(currentCaboView.legal_actions)) {
    return false;
  }
  if (!currentCaboView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "initial_peek") {
    return selectedSlots.length === 2;
  }
  if (actionType === "draw_discard" || actionType === "replace_card") {
    return selectedSlots.length >= 1;
  }
  if (actionType === "attempt_match") {
    return selectedSlots.length >= 2;
  }
  if (actionType === "use_choice_action") {
    if (!currentCaboView.pending_choice) {
      return false;
    }
    const choiceType = currentCaboView.pending_choice.type;
    if (choiceType === "peek") {
      return selectedSlots.length >= 1;
    }
    if (choiceType === "spy") {
      return !!selectedTarget;
    }
    if (choiceType === "swap") {
      return !!selectedTarget && selectedSlots.length >= 1;
    }
  }
  return true;
}

function updateActionButtons() {
  if (currentGameType !== "cabo") {
    Object.values(actionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(actionButtons).forEach(([actionType, button]) => {
    const allowed = isActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function clearSelection() {
  selectedSlots = [];
  updateSelectedSlots();
  document.querySelectorAll(".slot").forEach((el) => {
    el.classList.remove("selected");
  });
  updateActionButtons();
}

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
  } else if (currentGameType === "perfect_mismatch") {
    const rawCount = mismatchSliderCount ? Number.parseInt(mismatchSliderCount.value, 10) : NaN;
    const sliderCount = Number.isInteger(rawCount) ? rawCount : 3;
    payload.config = { slider_count: sliderCount };
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
    clearSkullState();
    clearMismatchState();
    clearDecryptoState();
    clearDrawGuessState();
    clearAidixitState();
    clearImpressionFlowerState();
    clearSplendorState();
    clearAbracaState();
    clearBlokusState();
    clearHalliState();
    clearGoldRushState();
  }
  setGamePanelVisibility(currentGameType);
  updateDrawGuessLanguageRow();
  updateDecryptoPackRow();
  updateDecryptoBotRow();
  updateAidixitDeckRow();
  updateHalliConfigRow();
  updateGoldRushConfigRow();
  updateMismatchConfigRow();
  updateAutoSaveRow();
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

function renderHand(view) {
  handSlots.innerHTML = "";
  const you = view.players.find((p) => p.player_id === view.you);
  if (!you) {
    handSlots.textContent = "-";
    return;
  }
  you.hand.forEach((slot, idx) => {
    const div = document.createElement("div");
    div.className = "slot";
    if (slot.empty) div.classList.add("empty");
    div.dataset.slot = idx;
    let label = "?";
    if (slot.empty) {
      label = "Empty";
    } else if (slot.known) {
      label = String(slot.value);
    }
    div.textContent = `#${idx} ${label}`;
    if (selectedSlots.includes(idx)) div.classList.add("selected");
    div.addEventListener("click", () => {
      if (selectedSlots.includes(idx)) {
        selectedSlots = selectedSlots.filter((s) => s !== idx);
        div.classList.remove("selected");
      } else {
        selectedSlots.push(idx);
        div.classList.add("selected");
      }
      updateSelectedSlots();
      updateActionButtons();
    });
    handSlots.appendChild(div);
  });
}

function renderGamePlayers(view) {
  gamePlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${p.score}`;
    badges.appendChild(score);
    if (p.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (p.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    if (p.player_id === view.current_turn) {
      const turn = document.createElement("span");
      turn.className = "badge highlight";
      turn.textContent = "turn";
      badges.appendChild(turn);
    }
    header.appendChild(badges);

    const handRow = document.createElement("div");
    handRow.className = "player-hand";
    p.hand.forEach((slot, idx) => {
      const slotEl = document.createElement("div");
      slotEl.className = "player-slot";
      if (slot.empty) {
        slotEl.classList.add("empty");
      }
      const label = slot.empty ? "Empty" : slot.known ? slot.value : "?";
      slotEl.textContent = `#${idx} ${label}`;
      handRow.appendChild(slotEl);
    });

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `cards ${p.hand_count}`;

    card.appendChild(header);
    card.appendChild(handRow);
    card.appendChild(meta);
    gamePlayers.appendChild(card);
  });
}

function renderTargets(view) {
  targetList.innerHTML = "";
  view.players
    .filter((p) => p.player_id !== view.you)
    .forEach((p) => {
      const wrapper = document.createElement("div");
      wrapper.className = "target-player";
      const title = document.createElement("div");
      title.textContent = p.name;
      wrapper.appendChild(title);

      const slotsRow = document.createElement("div");
      slotsRow.className = "target-slots";
      p.hand.forEach((slot, idx) => {
        const slotEl = document.createElement("div");
        slotEl.className = "target-slot";
        const label = slot.empty ? "Empty" : slot.known ? slot.value : "?";
        slotEl.textContent = `#${idx} ${label}`;
        if (
          selectedTarget &&
          selectedTarget.playerId === p.player_id &&
          selectedTarget.slot === idx
        ) {
          slotEl.classList.add("selected");
        }
        slotEl.addEventListener("click", () => {
          if (slot.empty) {
            log("Target slot is empty");
            return;
          }
          selectedTarget = { playerId: p.player_id, slot: idx };
          updateTargetSelection();
          updateActionButtons();
          renderTargets(view);
        });
        slotsRow.appendChild(slotEl);
      });
      wrapper.appendChild(slotsRow);
      targetList.appendChild(wrapper);
    });
  updateTargetSelection();
}

function updateFlip7TargetSelection(view) {
  if (!flip7TargetSelection) {
    return;
  }
  if (!flip7SelectedTarget || !view) {
    flip7TargetSelection.textContent = "-";
    return;
  }
  const target = view.players.find((p) => p.player_id === flip7SelectedTarget);
  flip7TargetSelection.textContent = target ? target.name : "-";
}

function renderFlip7Tableau(view) {
  if (!flip7Tableau) {
    return;
  }
  flip7Tableau.innerHTML = "";
  const you = view.players.find((p) => p.player_id === view.you);
  if (!you || !Array.isArray(you.tableau) || !you.tableau.length) {
    flip7Tableau.textContent = "-";
    return;
  }
  you.tableau.forEach((card) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.textContent = card.label || "?";
    flip7Tableau.appendChild(slot);
  });
}

function renderFlip7Players(view) {
  if (!flip7Players) {
    return;
  }
  flip7Players.innerHTML = "";
  const pending = view.pending_action;
  const eligible = new Set((pending && pending.eligible_targets) || []);
  const isPendingActor = pending && view.you && pending.actor_id === view.you;
  if (flip7SelectedTarget && !eligible.has(flip7SelectedTarget)) {
    flip7SelectedTarget = null;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    const isEligible = eligible.has(player.player_id);
    if (pending && isEligible) {
      card.classList.add("flip7-target-eligible");
    }
    if (pending && isEligible && isPendingActor) {
      card.classList.add("flip7-target-selectable");
      card.addEventListener("click", () => {
        flip7SelectedTarget = player.player_id;
        updateFlip7TargetSelection(view);
        updateFlip7ActionButtons();
        renderFlip7Players(view);
        sendAction({ type: "choose_target", target_player_id: player.player_id });
      });
    }
    if (flip7SelectedTarget === player.player_id) {
      card.classList.add("flip7-target-selected");
    }
    if (player.status !== "active") {
      card.classList.add("disabled");
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
    const status = document.createElement("span");
    status.className = "badge";
    status.textContent = player.status || "-";
    badges.appendChild(status);
    if (player.round_score !== null && player.round_score !== undefined) {
      const roundScore = document.createElement("span");
      roundScore.className = "badge";
      roundScore.textContent = `round ${player.round_score}`;
      badges.appendChild(roundScore);
    }
    if (player.flip7) {
      const flip7 = document.createElement("span");
      flip7.className = "badge highlight";
      flip7.textContent = "flip7";
      badges.appendChild(flip7);
    }
    if (player.has_second_chance) {
      const chance = document.createElement("span");
      chance.className = "badge";
      chance.textContent = "second chance";
      badges.appendChild(chance);
    }
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
    header.appendChild(badges);

    const tableauRow = document.createElement("div");
    tableauRow.className = "player-hand";
    if (Array.isArray(player.tableau) && player.tableau.length) {
      player.tableau.forEach((cardData) => {
        const slot = document.createElement("div");
        slot.className = "player-slot";
        slot.textContent = cardData.label || "?";
        tableauRow.appendChild(slot);
      });
    } else {
      const slot = document.createElement("div");
      slot.className = "player-slot empty";
      slot.textContent = "-";
      tableauRow.appendChild(slot);
    }

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `numbers ${player.numbers_count ?? 0}`;

    card.appendChild(header);
    card.appendChild(tableauRow);
    card.appendChild(meta);
    if (player.player_id === view.you) {
      const actionsRow = document.createElement("div");
      actionsRow.className = "flip7-player-actions row actions";
      if (flip7FlipBtn) {
        actionsRow.appendChild(flip7FlipBtn);
      }
      if (flip7StayBtn) {
        actionsRow.appendChild(flip7StayBtn);
      }
      if (actionsRow.children.length) {
        card.appendChild(actionsRow);
      }
    }
    flip7Players.appendChild(card);
  });
}

function renderFlip7LastRound(view) {
  if (!flip7LastRound) {
    return;
  }
  flip7LastRound.innerHTML = "";
  const summary = view.last_round_summary;
  if (!summary) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No previous round yet.";
    flip7LastRound.appendChild(empty);
    return;
  }

  const meta = document.createElement("div");
  meta.className = "hint";
  const roundText = Number.isInteger(summary.round) ? `Round ${summary.round}` : "Last round";
  const reasonText = summary.reason ? ` (${summary.reason})` : "";
  meta.textContent = `${roundText}${reasonText}`;
  flip7LastRound.appendChild(meta);

  const flipsByPlayer = summary.flips || {};
  const statusByPlayer = summary.status || {};
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const status = statusByPlayer[player.player_id] || "-";
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = status;
    if (status === "busted") {
      statusBadge.classList.add("danger");
    }
    badges.appendChild(statusBadge);
    if (summary.flip7_winner === player.player_id) {
      const flip7 = document.createElement("span");
      flip7.className = "badge highlight";
      flip7.textContent = "flip7";
      badges.appendChild(flip7);
    }
    header.appendChild(badges);
    card.appendChild(header);

    const flipsRow = document.createElement("div");
    flipsRow.className = "player-hand";
    const flips = Array.isArray(flipsByPlayer[player.player_id])
      ? flipsByPlayer[player.player_id]
      : [];
    if (flips.length) {
      flips.forEach((flip) => {
        const slot = document.createElement("div");
        slot.className = "player-slot";
        const label = typeof flip === "string" ? flip : flip.label;
        slot.textContent = label || "?";
        flipsRow.appendChild(slot);
      });
    } else {
      const slot = document.createElement("div");
      slot.className = "player-slot empty";
      slot.textContent = "-";
      flipsRow.appendChild(slot);
    }

    card.appendChild(flipsRow);
    flip7LastRound.appendChild(card);
  });
}

function findPlayerName(view, playerId) {
  const player = view.players.find((p) => p.player_id === playerId);
  return player ? player.name : playerId;
}

function renderSkullHand(view) {
  skullHand.innerHTML = "";
  if (!Array.isArray(view.hand) || !view.hand.length) {
    skullHand.textContent = "-";
    updateSkullSelectedCard();
    return;
  }
  view.hand.forEach((card, idx) => {
    const div = document.createElement("div");
    div.className = "slot";
    div.textContent = card;
    if (idx === skullSelectedCardIndex) {
      div.classList.add("selected");
    }
    div.addEventListener("click", () => {
      skullSelectedCardIndex = idx;
      skullSelectedCardType = card;
      updateSkullSelectedCard();
      updateSkullActionButtons();
      renderSkullHand(view);
    });
    skullHand.appendChild(div);
  });
}

function getSkullRevealTargets(view) {
  if (view.phase !== "reveal" || view.you !== view.bidder) {
    return [];
  }
  const you = view.players.find((p) => p.player_id === view.you);
  if (you && you.pile_count > 0) {
    return [view.you];
  }
  return view.players
    .filter((p) => !p.eliminated && p.pile_count > 0)
    .map((p) => p.player_id);
}

function renderSkullTargets(view) {
  skullTargets.innerHTML = "";
  const allowedTargets = getSkullRevealTargets(view);
  view.players.forEach((p) => {
    if (p.eliminated) {
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "target-player";
    if (allowedTargets.includes(p.player_id)) {
      wrapper.classList.add("selectable");
    } else {
      wrapper.classList.add("disabled");
    }
    if (skullSelectedTarget === p.player_id) {
      wrapper.classList.add("selected");
    }
    wrapper.textContent = `${p.name} (pile ${p.pile_count})`;
    wrapper.addEventListener("click", () => {
      if (!allowedTargets.includes(p.player_id)) {
        return;
      }
      skullSelectedTarget = p.player_id;
      updateSkullTargetSelection();
      updateSkullActionButtons();
      renderSkullTargets(view);
    });
    skullTargets.appendChild(wrapper);
  });
  updateSkullTargetSelection();
}

function renderSkullPlayers(view) {
  skullPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.eliminated) {
      card.classList.add("disabled");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    const meta = document.createElement("div");
    meta.className = "player-meta";
    const status = p.eliminated ? "out" : "in";
    meta.textContent = `hand ${p.hand_count} | pile ${p.pile_count} | wins ${p.rounds_won} | ${status}`;
    card.appendChild(name);
    card.appendChild(meta);
    skullPlayers.appendChild(card);
  });
}

function updateMismatchButtons(view) {
  if (!mismatchRevealBtn || !mismatchNextRoundBtn || !mismatchPlayAgainBtn) {
    return;
  }
  const actions = view && Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const revealAllowed = actions.includes("reveal");
  mismatchRevealBtn.disabled = !revealAllowed;
  mismatchRevealBtn.classList.toggle("action-allowed", revealAllowed);
  const nextAllowed = actions.includes("next_round");
  mismatchNextRoundBtn.disabled = !nextAllowed;
  mismatchNextRoundBtn.classList.toggle("action-allowed", nextAllowed);
  const playAllowed = actions.includes("play_again");
  mismatchPlayAgainBtn.disabled = !playAllowed;
  mismatchPlayAgainBtn.classList.toggle("action-allowed", playAllowed);
}

function renderMismatchWords(view) {
  if (!mismatchWords) {
    return;
  }
  mismatchWords.innerHTML = "";
  const words = Array.isArray(view.words) ? view.words : [];
  const canGuess = Array.isArray(view.legal_actions) && view.legal_actions.includes("submit_guess");
  const yourGuess = view.your_guess;
  words.forEach((word, index) => {
    const card = document.createElement("div");
    card.className = "mismatch-word-card";
    if (yourGuess && yourGuess.choice === index) {
      card.classList.add("guessed");
    }
    if (view.target_index === index) {
      card.classList.add("target");
    }

    const title = document.createElement("div");
    title.className = "mismatch-word-title";
    title.textContent = `${index + 1}. ${word}`;
    card.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "mismatch-word-actions";
    const guessBtn = document.createElement("button");
    guessBtn.type = "button";
    guessBtn.textContent = "Guess";
    guessBtn.disabled = !canGuess || !!yourGuess;
    guessBtn.addEventListener("click", () => {
      sendAction({ type: "submit_guess", choice_index: index });
    });
    actions.appendChild(guessBtn);

    if (yourGuess && yourGuess.choice === index) {
      const locked = document.createElement("span");
      const order = Number.isInteger(yourGuess.order) ? `#${yourGuess.order}` : "#-";
      locked.textContent = `Locked ${order}`;
      actions.appendChild(locked);
    }

    card.appendChild(actions);
    mismatchWords.appendChild(card);
  });
}

function renderMismatchSliders(view) {
  if (!mismatchSliders) {
    return;
  }
  mismatchSliders.innerHTML = "";
  const sliders = Array.isArray(view.sliders) ? view.sliders : [];
  const isLeader = view.leader_id === view.you;
  const canSet = Array.isArray(view.legal_actions) && view.legal_actions.includes("set_slider");
  const activeIndex = Number.isInteger(view.active_slider_index) ? view.active_slider_index : 0;

  sliders.forEach((slider, index) => {
    const row = document.createElement("div");
    row.className = "mismatch-slider-row";

    const left = document.createElement("div");
    left.className = "mismatch-slider-label left";
    left.textContent = slider.left_attr || "-";

    const right = document.createElement("div");
    right.className = "mismatch-slider-label right";
    right.textContent = slider.right_attr || "-";

    const valueLabel = document.createElement("div");
    valueLabel.className = "mismatch-slider-value";
    const value = Number.isInteger(slider.value) ? slider.value : null;
    valueLabel.textContent = value === null ? "?" : String(value);

    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "10";
    input.step = "1";
    input.value = value === null ? "5" : String(value);
    input.className = "mismatch-slider";
    if (value === null) {
      input.classList.add("pending");
    }
    const isActive = isLeader && canSet && index === activeIndex;
    input.disabled = !isActive;

    const setBtn = document.createElement("button");
    setBtn.type = "button";
    setBtn.textContent = "Set";
    setBtn.disabled = !isActive;
    setBtn.addEventListener("click", () => {
      const rawValue = Number.parseInt(input.value, 10);
      const sliderValue = Number.isInteger(rawValue) ? rawValue : 5;
      sendAction({ type: "set_slider", slider_index: index, value: sliderValue });
    });

    row.appendChild(left);
    row.appendChild(input);
    row.appendChild(right);
    row.appendChild(valueLabel);
    row.appendChild(setBtn);
    mismatchSliders.appendChild(row);
  });
}

function renderMismatchPlayers(view) {
  if (!mismatchPlayers) {
    return;
  }
  mismatchPlayers.innerHTML = "";
  view.players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const tags = [];
    if (player.player_id === view.leader_id) {
      tags.push("leader");
    }
    if (player.is_bot) {
      tags.push("bot");
    }
    if (player.guessed) {
      const order = Number.isInteger(player.guess_order) ? `#${player.guess_order}` : "#-";
      tags.push(`guessed ${order}`);
    }
    const suffix = tags.length ? ` (${tags.join(", ")})` : "";
    row.textContent = `${player.name} - ${player.score} pts${suffix}`;
    mismatchPlayers.appendChild(row);
  });
}

function renderMismatchSummary(view) {
  if (!mismatchRoundSummary || !mismatchRoundSummaryBody || !mismatchRoundSummaryGuesses) {
    return;
  }
  const summary = view.last_round_summary;
  if (!summary) {
    mismatchRoundSummary.classList.add("hidden");
    mismatchRoundSummaryBody.textContent = "-";
    mismatchRoundSummaryGuesses.innerHTML = "";
    return;
  }

  const leaderName = findPlayerName(view, summary.leader_id);
  const leaderDelta = summary.leader_delta;
  const deltaLabel = leaderDelta >= 0 ? `+${leaderDelta}` : String(leaderDelta);
  const correctLabel = `${summary.correct_count}/${summary.guess_count}`;
  mismatchRoundSummaryBody.textContent = `${leaderName} target: ${summary.target_word} | correct ${correctLabel} | leader ${deltaLabel}`;

  mismatchRoundSummaryGuesses.innerHTML = "";
  const words = Array.isArray(summary.words) ? summary.words : [];
  const guesses = Array.isArray(summary.guesses) ? summary.guesses : [];
  guesses.forEach((entry) => {
    const line = document.createElement("div");
    const choiceLabel =
      Number.isInteger(entry.choice_index) && words[entry.choice_index]
        ? `${entry.choice_index + 1}. ${words[entry.choice_index]}`
        : "-";
    const orderLabel = Number.isInteger(entry.order) ? `#${entry.order}` : "-";
    const resultLabel = entry.correct ? "correct" : "wrong";
    const pointsLabel = entry.points ? `+${entry.points}` : "0";
    line.textContent = `${entry.name}: ${choiceLabel} (${orderLabel}, ${resultLabel}, ${pointsLabel})`;
    mismatchRoundSummaryGuesses.appendChild(line);
  });

  mismatchRoundSummary.classList.remove("hidden");
}

function formatCoyoteSummary(view) {
  const summary = view.last_round_summary;
  if (!summary) {
    return "-";
  }
  const bidder = findPlayerName(view, summary.bidder);
  const challenger = findPlayerName(view, summary.challenger);
  const loser = findPlayerName(view, summary.loser);
  const result = summary.success ? "challenge success" : "challenge fail";
  let text = `${result}: bid ${summary.bid}, total ${summary.actual_total}, loser ${loser}`;
  if (Array.isArray(summary.mystery_draws)) {
    const draws = summary.mystery_draws.filter((item) => item);
    if (draws.length) {
      text += ` | ? draws ${draws.join(", ")}`;
    }
  }
  if (Array.isArray(summary.max_zero_applied) && summary.max_zero_applied.length) {
    text += ` | max->0 ${summary.max_zero_applied.join(", ")}`;
  }
  if (summary.x2_count) {
    text += ` | x${2 ** summary.x2_count}`;
  }
  text += ` | bidder ${bidder}, challenger ${challenger}`;
  return text;
}

function getCoyoteMinBid(view) {
  if (!view || view.last_bid === null || view.last_bid === undefined) {
    return 1;
  }
  return Number(view.last_bid) + 1;
}

function updateCoyoteBidInput(view, previousView) {
  if (!coyoteBidInput) {
    return;
  }
  const minBid = getCoyoteMinBid(view);
  coyoteBidInput.min = String(minBid);
  const current = Number.parseInt(coyoteBidInput.value, 10);
  const newRound = !previousView || previousView.round !== view.round;
  const shouldUpdate = !Number.isInteger(current) || current < minBid || (newRound && current !== minBid);
  if (shouldUpdate && document.activeElement !== coyoteBidInput) {
    coyoteBidInput.value = minBid;
  }
}

function updateCoyoteBidControls(view) {
  if (!coyoteBidInput || !coyoteBidMinusBtn || !coyoteBidPlusBtn) {
    return;
  }
  const canEdit =
    view &&
    Array.isArray(view.legal_actions) &&
    view.legal_actions.includes("bid") &&
    view.phase !== "game_over";
  coyoteBidInput.disabled = !canEdit;
  coyoteBidMinusBtn.disabled = !canEdit;
  coyoteBidPlusBtn.disabled = !canEdit;
  if (canEdit) {
    const minBid = getCoyoteMinBid(view);
    const current = Number.parseInt(coyoteBidInput.value, 10);
    coyoteBidMinusBtn.disabled = !Number.isInteger(current) || current <= minBid;
  }
}

function adjustCoyoteBid(delta) {
  if (!coyoteBidInput) {
    return;
  }
  const minBid = getCoyoteMinBid(currentCoyoteView);
  let current = Number.parseInt(coyoteBidInput.value, 10);
  if (!Number.isInteger(current)) {
    current = minBid;
  }
  const next = Math.max(minBid, current + delta);
  coyoteBidInput.value = next;
  updateCoyoteActionButtons();
}

function renderCoyoteRoundNotice(view) {
  if (!coyoteRoundNotice || !coyoteRoundNoticeBody) {
    return;
  }
  coyoteRoundNotice.classList.remove("hidden");
  while (coyoteRoundNoticeBody.firstChild) {
    coyoteRoundNoticeBody.removeChild(coyoteRoundNoticeBody.firstChild);
  }
  const summaryText = view.last_round_summary ? formatCoyoteSummary(view) : "No previous round yet.";
  const summaryLine = document.createElement("div");
  summaryLine.textContent = summaryText;
  coyoteRoundNoticeBody.appendChild(summaryLine);

  const yourCard = view.your_card || "-";
  const cardLine = document.createElement("div");
  cardLine.textContent = `Your hidden card: ${yourCard}`;
  coyoteRoundNoticeBody.appendChild(cardLine);
}

function renderCoyotePlayers(view) {
  coyotePlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.eliminated) {
      card.classList.add("disabled");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    const meta = document.createElement("div");
    meta.className = "player-meta";
    let cardLabel = p.card;
    if (!cardLabel && p.card_hidden) {
      cardLabel = "Hidden";
    } else if (!cardLabel) {
      cardLabel = "-";
    }
    const maxPenalties = view.config ? view.config.max_penalties : "-";
    const status = p.eliminated ? "out" : "in";
    meta.textContent = `card ${cardLabel} | penalties ${p.penalties}/${maxPenalties} | ${status}`;
    card.appendChild(name);
    card.appendChild(meta);
    coyotePlayers.appendChild(card);
  });
}

function formatHalliFruit(fruit) {
  if (!fruit) {
    return "?";
  }
  return halliFruitEmoji[fruit] || fruit;
}

function formatHalliFruitList(fruits, totals = null) {
  if (!Array.isArray(fruits) || !fruits.length) {
    return "-";
  }
  return fruits
    .map((fruit) => {
      const emoji = formatHalliFruit(fruit);
      if (totals && Object.prototype.hasOwnProperty.call(totals, fruit)) {
        return `${emoji} ${totals[fruit]}`;
      }
      return emoji;
    })
    .join(", ");
}

function formatHalliCard(card) {
  if (!card) {
    return "-";
  }
  if (Array.isArray(card.fruits) && card.fruits.length) {
    const parts = card.fruits.map((entry) => {
      if (!entry) {
        return "?";
      }
      const emoji = formatHalliFruit(entry.fruit);
      const count = Number.isFinite(entry.count) ? entry.count : null;
      return count !== null ? `${emoji} ${count}` : emoji;
    });
    return parts.join(" + ");
  }
  const emoji = formatHalliFruit(card.fruit);
  const count = Number.isFinite(card.count) ? card.count : null;
  if (count !== null) {
    return `${emoji} ${count}`;
  }
  return emoji;
}

function formatHalliLastAction(view) {
  const last = view ? view.last_action : null;
  if (!last) {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  if (last.type === "flip") {
    const card = last.card;
    const cardLabel = card ? formatHalliCard(card) : "card";
    return `${actor} flipped ${cardLabel}`;
  }
  if (last.type === "ring") {
    if (last.result === "success") {
      const fruits = formatHalliFruitList(last.bell_fruits);
      return `${actor} rang (success: ${fruits}, +${last.collected || 0} cards)`;
    }
    return `${actor} rang (false, penalty ${last.penalty_given || 0})`;
  }
  return "-";
}

function formatHalliLastRingResult(view) {
  const last = view ? view.last_ring_result : null;
  if (!last) {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  const fruits = formatHalliFruitList(last.fruits);
  if (last.result === "success") {
    return `${actor} success: ${fruits}`;
  }
  return `${actor} fail: ${fruits}`;
}

function halliNowMs() {
  return Date.now() + halliServerTimeOffsetMs;
}

function formatCountdownMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "Ready";
  }
  if (ms < 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.ceil(ms / 1000)}s`;
}

function resetHalliCountdownLabels() {
  if (halliFlipCountdownLabel) {
    halliFlipCountdownLabel.textContent = "-";
    halliFlipCountdownLabel.classList.remove("halli-countdown-active");
  }
  if (halliRingCountdownLabel) {
    halliRingCountdownLabel.textContent = "-";
    halliRingCountdownLabel.classList.remove("halli-countdown-active");
  }
}

function startHalliCountdownTimer() {
  if (halliCountdownTimer || (!halliFlipCountdownLabel && !halliRingCountdownLabel)) {
    return;
  }
  halliCountdownTimer = window.setInterval(() => {
    if (currentGameType !== "halli_galli") {
      stopHalliCountdownTimer();
      return;
    }
    updateHalliCountdownLabels();
  }, 200);
}

function stopHalliCountdownTimer() {
  if (!halliCountdownTimer) {
    return;
  }
  window.clearInterval(halliCountdownTimer);
  halliCountdownTimer = null;
}

function updateHalliCountdownState(view) {
  if (!view) {
    halliCountdownState = {
      flipReadyAtMs: 0,
      ringReadyAtMs: 0,
      ringPending: false,
      turnSwitchAtMs: 0,
      flipWaitMs: 0,
    };
    halliServerTimeOffsetMs = 0;
    stopHalliCountdownTimer();
    resetHalliCountdownLabels();
    return;
  }
  const serverNow = Number(view.server_now_ms);
  if (Number.isFinite(serverNow)) {
    halliServerTimeOffsetMs = serverNow - Date.now();
  }
  const flipReadyAtMs = Number(view.flip_ready_at_ms);
  const flipWaitMs = view.config ? Number(view.config.flip_wait_ms) : 0;
  const pending = view.pending_flip;
  const ringReadyAtMs = pending ? Number(pending.reveal_at_ms) : 0;
  const turnSwitchAtMs = Number(view.turn_switch_at_ms);
  halliCountdownState = {
    flipReadyAtMs: Number.isFinite(flipReadyAtMs) ? flipReadyAtMs : 0,
    ringReadyAtMs: Number.isFinite(ringReadyAtMs) ? ringReadyAtMs : 0,
    ringPending: !!pending,
    turnSwitchAtMs: Number.isFinite(turnSwitchAtMs) ? turnSwitchAtMs : 0,
    flipWaitMs: Number.isFinite(flipWaitMs) ? Math.max(flipWaitMs, 0) : 0,
  };
  startHalliCountdownTimer();
  updateHalliCountdownLabels();
}

function updateHalliCountdownLabels() {
  if (!currentHalliView || currentGameType !== "halli_galli") {
    resetHalliCountdownLabels();
    return;
  }
  const now = halliNowMs();
  const flipRemaining =
    halliCountdownState.flipReadyAtMs > 0 ? halliCountdownState.flipReadyAtMs - now : 0;
  const ringRemaining =
    halliCountdownState.ringReadyAtMs > 0 ? halliCountdownState.ringReadyAtMs - now : 0;
  const ringWindowRemaining =
    halliCountdownState.turnSwitchAtMs > 0 ? halliCountdownState.turnSwitchAtMs - now : 0;

  if (halliFlipCountdownLabel) {
    halliFlipCountdownLabel.textContent = "-";
    halliFlipCountdownLabel.classList.remove("halli-countdown-active");
  }

  if (halliRingCountdownLabel) {
    let label = "Ready";
    let active = false;
    if (halliCountdownState.ringPending && ringRemaining > 0) {
      label = formatCountdownMs(ringRemaining);
      active = true;
    }
    halliRingCountdownLabel.textContent = label;
    halliRingCountdownLabel.classList.toggle("halli-countdown-active", active);
  }
  if (halliBellCountdown) {
    const show = !halliCountdownState.ringPending && ringWindowRemaining > 0 && isHalliActionAvailable("ring");
    if (show) {
      halliBellCountdown.textContent = formatCountdownMs(ringWindowRemaining);
      halliBellCountdown.classList.remove("hidden");
    } else {
      halliBellCountdown.textContent = "-";
      halliBellCountdown.classList.add("hidden");
    }
  }
}

function renderHalliPlayers(view) {
  if (!halliPlayers) {
    return;
  }
  halliPlayers.innerHTML = "";
  view.players.forEach((p, index) => {
    const card = document.createElement("div");
    card.className = "player-card halli-player-card";
    card.dataset.playerId = String(p.player_id ?? "");
    const seatIndex = (index % 8) + 1;
    card.classList.add(`halli-seat-${seatIndex}`);
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.eliminated) {
      card.classList.add("disabled");
    }
    if (p.player_id === view.you) {
      const flipAllowed = currentGameType === "halli_galli" && isHalliActionAvailable("flip");
      card.classList.add("halli-self-seat");
      card.classList.toggle("halli-self-actionable", flipAllowed);
      card.classList.toggle("halli-self-disabled", !flipAllowed);
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "Flip");
      card.setAttribute("aria-disabled", (!flipAllowed).toString());
      const triggerFlip = () => {
        if (!flipAllowed) {
          return;
        }
        sendAction({ type: "flip" });
      };
      card.addEventListener("click", triggerFlip);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          triggerFlip();
        }
      });
    }
    const info = document.createElement("div");
    info.className = "halli-player-info";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    info.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges halli-player-badges";
    const handBadge = document.createElement("span");
    handBadge.className = "badge";
    handBadge.textContent = `hand ${p.hand_count}`;
    badges.appendChild(handBadge);
    const pileBadge = document.createElement("span");
    pileBadge.className = "badge";
    pileBadge.textContent = `pile ${p.pile_count}`;
    badges.appendChild(pileBadge);
    if (p.player_id === view.you) {
      const youBadge = document.createElement("span");
      youBadge.className = "badge";
      youBadge.textContent = "you";
      badges.appendChild(youBadge);
    }
    if (p.is_bot) {
      const botBadge = document.createElement("span");
      botBadge.className = "badge";
      botBadge.textContent = "bot";
      badges.appendChild(botBadge);
    }
    if (p.eliminated) {
      const outBadge = document.createElement("span");
      outBadge.className = "badge";
      outBadge.textContent = "out";
      badges.appendChild(outBadge);
    }

    info.appendChild(badges);
    card.appendChild(info);

    const topCard = document.createElement("div");
    topCard.className = "halli-player-topcard";
    topCard.textContent = formatHalliCard(p.top_card);
    card.appendChild(topCard);
    halliPlayers.appendChild(card);
  });
}

function isSkullActionAvailable(actionType) {
  if (!currentSkullView || !Array.isArray(currentSkullView.legal_actions)) {
    return false;
  }
  if (!currentSkullView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "play_card") {
    return !!skullSelectedCardType;
  }
  if (actionType === "start_bid" || actionType === "raise_bid") {
    const bid = Number.parseInt(skullBidInput.value, 10);
    return Number.isInteger(bid) && bid > 0;
  }
  if (actionType === "reveal_card") {
    const allowedTargets = getSkullRevealTargets(currentSkullView);
    return !!skullSelectedTarget && allowedTargets.includes(skullSelectedTarget);
  }
  return true;
}

function updateSkullActionButtons() {
  if (currentGameType !== "skull") {
    Object.values(skullActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(skullActionButtons).forEach(([actionType, button]) => {
    const allowed = isSkullActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function isCoyoteActionAvailable(actionType) {
  if (!currentCoyoteView || !Array.isArray(currentCoyoteView.legal_actions)) {
    return false;
  }
  if (!currentCoyoteView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "bid") {
    const bid = Number.parseInt(coyoteBidInput.value, 10);
    if (!Number.isInteger(bid) || bid < 1) {
      return false;
    }
    const lastBid = currentCoyoteView.last_bid;
    if (lastBid !== null && lastBid !== undefined && bid <= lastBid) {
      return false;
    }
  }
  return true;
}

function updateCoyoteActionButtons() {
  if (currentGameType !== "coyote") {
    Object.values(coyoteActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    updateCoyoteBidControls(null);
    return;
  }
  Object.entries(coyoteActionButtons).forEach(([actionType, button]) => {
    const allowed = isCoyoteActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  updateCoyoteBidControls(currentCoyoteView);
}

function isHalliActionAvailable(actionType) {
  if (!currentHalliView || !Array.isArray(currentHalliView.legal_actions)) {
    return false;
  }
  return currentHalliView.legal_actions.includes(actionType);
}

function updateHalliActionButtons() {
  if (currentGameType !== "halli_galli") {
    Object.values(halliActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    if (halliBellCenter) {
      halliBellCenter.classList.remove("halli-bell-center-actionable");
      halliBellCenter.classList.add("halli-bell-center-disabled");
      halliBellCenter.setAttribute("aria-disabled", "true");
    }
    return;
  }
  Object.entries(halliActionButtons).forEach(([actionType, button]) => {
    const allowed = isHalliActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  if (halliBellCenter) {
    const ringAllowed = isHalliActionAvailable("ring");
    halliBellCenter.classList.toggle("halli-bell-center-actionable", ringAllowed);
    halliBellCenter.classList.toggle("halli-bell-center-disabled", !ringAllowed);
    halliBellCenter.setAttribute("aria-disabled", (!ringAllowed).toString());
  }
}

function isFlip7ActionAvailable(actionType) {
  if (!currentFlip7View || !Array.isArray(currentFlip7View.legal_actions)) {
    return false;
  }
  if (!currentFlip7View.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "choose_target") {
    return !!flip7SelectedTarget;
  }
  return true;
}

function updateFlip7ActionButtons() {
  if (currentGameType !== "flip7") {
    Object.values(flip7ActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(flip7ActionButtons).forEach(([actionType, button]) => {
    const allowed = isFlip7ActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function isGoldRushActionAvailable(actionType) {
  if (!currentGoldRushView || !Array.isArray(currentGoldRushView.legal_actions)) {
    return false;
  }
  if (!currentGoldRushView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "play_card") {
    const hand = getGoldRushHand(currentGoldRushView);
    return (
      Number.isInteger(goldRushSelectedHandIndex) &&
      goldRushSelectedHandIndex >= 0 &&
      goldRushSelectedHandIndex < hand.length
    );
  }
  return true;
}

function updateGoldRushActionButtons() {
  const buttons = [
    { type: "play_card", el: goldRushPlayCardBtn },
    { type: "draw_card", el: goldRushDrawCardBtn },
    { type: "invest", el: goldRushInvestYesBtn },
    { type: "invest", el: goldRushInvestNoBtn },
    { type: "play_again", el: goldRushPlayAgainBtn },
  ];
  if (currentGameType !== "gold_rush") {
    buttons.forEach(({ el }) => {
      if (!el) {
        return;
      }
      el.classList.remove("action-allowed");
      el.disabled = true;
    });
    return;
  }
  buttons.forEach(({ type, el }) => {
    if (!el) {
      return;
    }
    const allowed = isGoldRushActionAvailable(type);
    if (allowed) {
      el.classList.add("action-allowed");
    } else {
      el.classList.remove("action-allowed");
    }
    el.disabled = !allowed;
  });
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

function updateDrawGuessColorButtons() {
  if (!drawGuessColorButtons.length) {
    return;
  }
  drawGuessColorButtons.forEach((button) => {
    const color = button.dataset.color;
    const isActive = color === drawGuessBrushColor;
    button.classList.toggle("color-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function updateDrawGuessBrushButtons() {
  if (!drawGuessBrushButtons.length) {
    return;
  }
  drawGuessBrushButtons.forEach((button) => {
    const size = Number.parseFloat(button.dataset.size);
    const isActive = Number.isFinite(size) && size === drawGuessBrushSize;
    button.classList.toggle("tool-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getDrawGuessLineWidth() {
  const baseSize = Number.isFinite(drawGuessBrushSize) ? drawGuessBrushSize : 3;
  return drawGuessIsErasing ? baseSize * 4 : baseSize;
}

function setDrawGuessBrushSize(size) {
  const nextSize = Number.parseFloat(size);
  if (!Number.isFinite(nextSize) || nextSize <= 0) {
    return;
  }
  drawGuessBrushSize = nextSize;
  if (drawGuessCtx) {
    drawGuessCtx.lineWidth = getDrawGuessLineWidth();
  }
  updateDrawGuessBrushButtons();
}

function setDrawGuessColor(color) {
  if (typeof color !== "string" || !color.trim()) {
    return;
  }
  drawGuessBrushColor = color;
  if (drawGuessIsErasing) {
    setDrawGuessTool(false);
  } else if (drawGuessCtx) {
    drawGuessCtx.strokeStyle = drawGuessBrushColor;
  }
  updateDrawGuessColorButtons();
}

function setDrawGuessTool(isErasing) {
  drawGuessIsErasing = !!isErasing;
  if (drawGuessCtx) {
    drawGuessCtx.globalCompositeOperation = drawGuessIsErasing ? "destination-out" : "source-over";
    drawGuessCtx.strokeStyle = drawGuessIsErasing ? "rgba(0, 0, 0, 1)" : drawGuessBrushColor;
    drawGuessCtx.lineWidth = getDrawGuessLineWidth();
    drawGuessCtx.beginPath();
  }
  if (drawGuessEraserBtn) {
    drawGuessEraserBtn.classList.toggle("tool-active", drawGuessIsErasing);
  }
}

function clearDrawGuessCanvas() {
  if (!drawGuessCtx || !drawGuessCanvas) {
    return;
  }
  const previousComposite = drawGuessCtx.globalCompositeOperation;
  drawGuessCtx.globalCompositeOperation = "source-over";
  drawGuessCtx.fillStyle = "#fff";
  drawGuessCtx.fillRect(0, 0, drawGuessCanvas.width, drawGuessCanvas.height);
  drawGuessCtx.globalCompositeOperation = previousComposite;
  drawGuessCtx.beginPath();
  drawGuessHasDrawn = false;
}

function getDrawGuessPosition(event) {
  const rect = drawGuessCanvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  const scaleX = rect.width ? drawGuessCanvas.width / rect.width : 1;
  const scaleY = rect.height ? drawGuessCanvas.height / rect.height : 1;
  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY,
  };
}

function startDrawGuess(event) {
  if (!drawGuessCtx || !drawGuessCanvas) {
    return;
  }
  event.preventDefault();
  drawGuessIsDrawing = true;
  const pos = getDrawGuessPosition(event);
  drawGuessCtx.beginPath();
  drawGuessCtx.moveTo(pos.x, pos.y);
  drawGuessHasDrawn = true;
}

function moveDrawGuess(event) {
  if (!drawGuessIsDrawing || !drawGuessCtx) {
    return;
  }
  event.preventDefault();
  const pos = getDrawGuessPosition(event);
  drawGuessCtx.lineTo(pos.x, pos.y);
  drawGuessCtx.stroke();
}

function endDrawGuess(event) {
  if (!drawGuessIsDrawing || !drawGuessCtx) {
    return;
  }
  event.preventDefault();
  drawGuessIsDrawing = false;
  drawGuessCtx.beginPath();
}

function setupDrawGuessCanvas() {
  if (!drawGuessCanvas || !drawGuessCtx) {
    return;
  }
  drawGuessCtx.lineCap = "round";
  setDrawGuessTool(false);
  clearDrawGuessCanvas();
  updateDrawGuessColorButtons();
  updateDrawGuessBrushButtons();

  drawGuessCanvas.addEventListener("mousedown", startDrawGuess);
  drawGuessCanvas.addEventListener("mousemove", moveDrawGuess);
  drawGuessCanvas.addEventListener("mouseup", endDrawGuess);
  drawGuessCanvas.addEventListener("mouseleave", endDrawGuess);

  drawGuessCanvas.addEventListener("touchstart", startDrawGuess, { passive: false });
  drawGuessCanvas.addEventListener("touchmove", moveDrawGuess, { passive: false });
  drawGuessCanvas.addEventListener("touchend", endDrawGuess, { passive: false });
  drawGuessCanvas.addEventListener("touchcancel", endDrawGuess, { passive: false });
}

function isDrawGuessActionAvailable(actionType) {
  if (currentGameType !== "draw_guess" || !currentDrawGuessView) {
    return false;
  }
  if (!Array.isArray(currentDrawGuessView.legal_actions)) {
    return false;
  }
  if (!currentDrawGuessView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "submit_guess") {
    return !!drawGuessInput.value.trim();
  }
  return true;
}

function updateDrawGuessButtons() {
  if (currentGameType !== "draw_guess") {
    Object.values(drawGuessActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    drawGuessClearBtn.disabled = true;
    if (drawGuessEraserBtn) {
      drawGuessEraserBtn.disabled = true;
    }
    drawGuessColorButtons.forEach((button) => {
      button.disabled = true;
    });
    drawGuessBrushButtons.forEach((button) => {
      button.disabled = true;
    });
    return;
  }
  Object.entries(drawGuessActionButtons).forEach(([actionType, button]) => {
    const allowed = isDrawGuessActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  const canDraw = isDrawGuessActionAvailable("submit_drawing");
  drawGuessClearBtn.disabled = !canDraw;
  if (drawGuessEraserBtn) {
    drawGuessEraserBtn.disabled = !canDraw;
  }
  drawGuessColorButtons.forEach((button) => {
    button.disabled = !canDraw;
  });
  drawGuessBrushButtons.forEach((button) => {
    button.disabled = !canDraw;
  });
}

function impressionConfigKey(config) {
  if (!config) {
    return "";
  }
  return JSON.stringify(config);
}

function applyImpressionConfig(config) {
  if (!config || !impressionCanvas || !impressionCtx) {
    return;
  }
  const key = impressionConfigKey(config);
  if (key && key === impressionConfigSignature) {
    return;
  }
  impressionConfigSignature = key;
  impressionConfig = config;
  const canvasSize = Number.parseInt(config.canvas_size, 10) || 600;
  impressionCanvas.width = canvasSize;
  impressionCanvas.height = canvasSize;
  impressionRotation = 0;
  if (impressionRotationInput) {
    impressionRotationInput.value = "0";
  }

  const shapes = Array.isArray(config.stamp_shapes) && config.stamp_shapes.length
    ? config.stamp_shapes
    : ["circle", "triangle", "square", "bar"];
  const colors = Array.isArray(config.stamp_colors) && config.stamp_colors.length
    ? config.stamp_colors
    : ["#ef4444", "#22c55e", "#3b82f6", "#eab308"];
  impressionShapeColorMap = {};
  shapes.forEach((shape, index) => {
    impressionShapeColorMap[shape] = colors[index] || colors[0] || "#111827";
  });

  if (impressionShapeButtons) {
    impressionShapeButtons.innerHTML = "";
    impressionShapeButtonEls = [];
    shapes.forEach((shape) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "impression-shape-btn";
      button.dataset.shape = shape;
      const swatch = document.createElement("span");
      swatch.className = "impression-shape-swatch";
      swatch.style.background = impressionShapeColorMap[shape] || "#111827";
      const label = shape === "circle"
        ? "Circle"
        : shape === "square"
          ? "Square"
          : shape === "triangle"
            ? "Triangle"
            : "Bar";
      button.appendChild(swatch);
      button.appendChild(document.createTextNode(label));
      button.addEventListener("click", () => setImpressionShape(shape));
      impressionShapeButtons.appendChild(button);
      impressionShapeButtonEls.push(button);
    });
  }

  if (!impressionCurrentShape || !shapes.includes(impressionCurrentShape)) {
    impressionCurrentShape = shapes[0];
  }
  impressionCurrentColor = impressionShapeColorMap[impressionCurrentShape] || colors[0] || "#111827";

  impressionStampHistory = [];
  impressionStampsLeft = 0;
  impressionStampsMax = 0;
  impressionActiveStampIndex = null;
  impressionMaskTarget = null;
  clearImpressionCanvas();
  renderImpressionCanvas();
  resetImpressionMaskState();
  updateImpressionShapeButtons();
}

function updateImpressionShapeButtons() {
  impressionShapeButtonEls.forEach((button) => {
    const isActive = button.dataset.shape === impressionCurrentShape;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getImpressionActiveStamp() {
  if (impressionActiveStampIndex === null) {
    return null;
  }
  if (impressionActiveStampIndex < 0 || impressionActiveStampIndex >= impressionStampHistory.length) {
    return null;
  }
  return impressionStampHistory[impressionActiveStampIndex] || null;
}

function normalizeImpressionDegrees(value) {
  let normalized = Number.parseFloat(value);
  if (!Number.isFinite(normalized)) {
    normalized = 0;
  }
  normalized %= 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

function setImpressionRotationValue(value, applyToActive) {
  const normalized = normalizeImpressionDegrees(value);
  impressionRotation = normalized;
  if (impressionRotationInput) {
    impressionRotationInput.value = `${Math.round(normalized)}`;
  }
  if (applyToActive) {
    const stamp = getImpressionActiveStamp();
    if (stamp) {
      stamp.rotation = (normalized * Math.PI) / 180;
      renderImpressionCanvas();
    }
  } else if (impressionPressStart !== null && impressionPreviewStamp) {
    renderImpressionCanvas();
  }
}

function setImpressionActiveStampIndex(index) {
  if (index === null || index < 0 || index >= impressionStampHistory.length) {
    impressionActiveStampIndex = null;
    return;
  }
  impressionActiveStampIndex = index;
  const stamp = getImpressionActiveStamp();
  if (stamp) {
    const deg = (stamp.rotation * 180) / Math.PI;
    setImpressionRotationValue(deg, false);
  }
}

function rotateImpressionActiveStamp(deltaDeg) {
  const stamp = getImpressionActiveStamp();
  if (stamp && impressionPressStart === null && !impressionDraggingStamp) {
    const currentDeg = (stamp.rotation * 180) / Math.PI;
    setImpressionRotationValue(currentDeg + deltaDeg, true);
    return;
  }
  setImpressionRotationValue(impressionRotation + deltaDeg, false);
}

function startImpressionRotateHold(direction) {
  if (!direction || !isImpressionActionAvailable("submit_drawing")) {
    return;
  }
  stopImpressionRotateHold();
  const state = {
    direction: direction < 0 ? -1 : 1,
    lastTime: null,
    rafId: null,
  };
  impressionRotateHold = state;
  rotateImpressionActiveStamp(state.direction * IMPRESSION_ROTATE_STEP_DEG);
  const tick = (time) => {
    if (!impressionRotateHold || impressionRotateHold !== state) {
      return;
    }
    if (!isImpressionActionAvailable("submit_drawing")) {
      stopImpressionRotateHold();
      return;
    }
    if (state.lastTime !== null) {
      const deltaSeconds = (time - state.lastTime) / 1000;
      rotateImpressionActiveStamp(deltaSeconds * IMPRESSION_ROTATE_HOLD_SPEED * state.direction);
    }
    state.lastTime = time;
    state.rafId = requestAnimationFrame(tick);
  };
  state.rafId = requestAnimationFrame(tick);
}

function stopImpressionRotateHold() {
  if (!impressionRotateHold) {
    return;
  }
  if (impressionRotateHold.rafId) {
    cancelAnimationFrame(impressionRotateHold.rafId);
  }
  impressionRotateHold = null;
}

function bindImpressionRotateButton(button, direction) {
  if (!button) {
    return;
  }
  const start = (event) => {
    if (event && typeof event.button === "number" && event.button !== 0) {
      return;
    }
    if (event && event.cancelable) {
      event.preventDefault();
    }
    if (event && event.pointerId !== undefined && button.setPointerCapture) {
      button.setPointerCapture(event.pointerId);
    }
    startImpressionRotateHold(direction);
  };
  const stop = () => {
    stopImpressionRotateHold();
  };
  if (window.PointerEvent) {
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("pointerleave", stop);
    button.addEventListener("lostpointercapture", stop);
  } else {
    button.addEventListener("mousedown", start);
    button.addEventListener("mouseup", stop);
    button.addEventListener("mouseleave", stop);
    button.addEventListener("touchstart", start, { passive: false });
    button.addEventListener("touchend", stop);
    button.addEventListener("touchcancel", stop);
  }
  button.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    rotateImpressionActiveStamp((direction < 0 ? -1 : 1) * IMPRESSION_ROTATE_STEP_DEG);
  });
}

function setImpressionShape(shape) {
  if (!shape) {
    return;
  }
  impressionCurrentShape = shape;
  impressionCurrentColor = impressionShapeColorMap[shape] || impressionCurrentColor;
  updateImpressionShapeButtons();
}

function clearImpressionCanvas() {
  if (!impressionCtx || !impressionCanvas) {
    return;
  }
  impressionCtx.save();
  impressionCtx.globalCompositeOperation = "source-over";
  impressionCtx.fillStyle = "#fff";
  impressionCtx.fillRect(0, 0, impressionCanvas.width, impressionCanvas.height);
  impressionCtx.restore();
}

function renderImpressionCanvas() {
  if (!impressionCtx || !impressionCanvas) {
    return;
  }
  clearImpressionCanvas();
  impressionStampHistory.forEach((stamp) => {
    drawImpressionStamp(stamp);
  });
  if (impressionPreviewStamp) {
    drawImpressionStamp(impressionPreviewStamp);
  }
  drawImpressionSelection(getImpressionActiveStamp());
  updateImpressionRotateControls();
}

function drawImpressionStamp(stamp) {
  if (!impressionCtx || !impressionCanvas || !stamp) {
    return;
  }
  impressionCtx.save();
  if (stamp.mask) {
    impressionCtx.beginPath();
    impressionCtx.rect(0, 0, impressionCanvas.width, impressionCanvas.height);
    impressionCtx.save();
    impressionCtx.translate(stamp.x, stamp.y);
    impressionCtx.rotate(stamp.rotation);
    impressionCtx.translate(stamp.mask.offset_x, stamp.mask.offset_y);
    impressionCtx.rotate(stamp.mask.rotation);
    impressionCtx.rect(-stamp.mask.size / 2, -stamp.mask.size / 2, stamp.mask.size, stamp.mask.size);
    impressionCtx.restore();
    impressionCtx.clip("evenodd");
  }
  impressionCtx.translate(stamp.x, stamp.y);
  impressionCtx.rotate(stamp.rotation);
  impressionCtx.globalAlpha = stamp.alpha;
  impressionCtx.fillStyle = stamp.color;
  const size = stamp.size;
  if (stamp.shape === "circle") {
    impressionCtx.beginPath();
    impressionCtx.arc(0, 0, size / 2, 0, Math.PI * 2);
    impressionCtx.fill();
  } else if (stamp.shape === "square") {
    impressionCtx.fillRect(-size / 2, -size / 2, size, size);
  } else if (stamp.shape === "triangle") {
    const height = size * 0.866;
    impressionCtx.beginPath();
    impressionCtx.moveTo(0, -height * 2 / 3);
    impressionCtx.lineTo(-size / 2, height / 3);
    impressionCtx.lineTo(size / 2, height / 3);
    impressionCtx.closePath();
    impressionCtx.fill();
  } else if (stamp.shape === "bar") {
    const barRatio = Number.parseFloat(impressionConfig && impressionConfig.bar_ratio) || 0.25;
    const height = size * barRatio;
    impressionCtx.fillRect(-size / 2, -height / 2, size, height);
  }
  impressionCtx.restore();
}

function drawImpressionSelection(stamp) {
  if (!impressionCtx || !impressionCanvas || !stamp) {
    return;
  }
  if (impressionPressStart !== null) {
    return;
  }
  const size = (stamp.size || 0) + IMPRESSION_SELECTION_PADDING * 2;
  impressionCtx.save();
  impressionCtx.translate(stamp.x, stamp.y);
  impressionCtx.rotate(stamp.rotation);
  impressionCtx.strokeStyle = "rgba(15, 23, 42, 0.6)";
  impressionCtx.lineWidth = 1;
  impressionCtx.setLineDash([4, 4]);
  impressionCtx.strokeRect(-size / 2, -size / 2, size, size);
  impressionCtx.restore();
}

function hideImpressionRotateControls() {
  stopImpressionRotateHold();
  if (!impressionRotateControls) {
    return;
  }
  impressionRotateControls.classList.add("hidden");
  impressionRotateControls.classList.remove("dragging");
}

function updateImpressionRotateControls() {
  if (!impressionRotateControls || !impressionCanvas) {
    return;
  }
  const stamp = getImpressionActiveStamp();
  if (!impressionStampHistory.length) {
    hideImpressionRotateControls();
    return;
  }
  if (!stamp || impressionPressStart !== null) {
    hideImpressionRotateControls();
    return;
  }
  if (!isImpressionActionAvailable("submit_drawing")) {
    hideImpressionRotateControls();
    return;
  }
  const rect = impressionCanvas.getBoundingClientRect();
  const scaleX = rect.width ? rect.width / impressionCanvas.width : 1;
  const scaleY = rect.height ? rect.height / impressionCanvas.height : 1;
  const half = (stamp.size || 0) / 2 + IMPRESSION_SELECTION_PADDING;
  impressionRotateControls.classList.remove("hidden");
  impressionRotateControls.classList.toggle("dragging", !!impressionDraggingStamp);
  const controlsWidth = impressionRotateControls.offsetWidth;
  const controlsHeight = impressionRotateControls.offsetHeight;
  const centerX = stamp.x * scaleX;
  const aboveY = (stamp.y - half) * scaleY - IMPRESSION_ROTATE_BUTTON_OFFSET - controlsHeight;
  const belowY = (stamp.y + half) * scaleY + IMPRESSION_ROTATE_BUTTON_OFFSET;
  let top = aboveY < 0 ? belowY : aboveY;
  if (top + controlsHeight > rect.height) {
    top = Math.max(0, rect.height - controlsHeight);
  }
  let left = centerX - controlsWidth / 2;
  left = Math.max(0, Math.min(left, rect.width - controlsWidth));
  top = Math.max(0, Math.min(top, rect.height - controlsHeight));
  impressionRotateControls.style.left = `${left}px`;
  impressionRotateControls.style.top = `${top}px`;
}

function impressionAlphaForDuration(durationMs) {
  const clamped = Math.min(Math.max(durationMs, 0), 500);
  return 0.2 + (clamped / 500) * 0.8;
}

function getImpressionPosition(event) {
  if (!impressionCanvas) {
    return null;
  }
  const rect = impressionCanvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  const scaleX = rect.width ? impressionCanvas.width / rect.width : 1;
  const scaleY = rect.height ? impressionCanvas.height / rect.height : 1;
  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY,
  };
}

function buildImpressionMask(position, stampRotation) {
  if (!position || !impressionMaskState || !impressionConfig) {
    return null;
  }
  const maskSize = (Number.parseInt(impressionConfig.mask_size, 10) || 180) * impressionMaskState.scale;
  const maskRotation = (Math.PI / 180) * impressionMaskState.rotation;
  const dx = impressionMaskState.x - position.x;
  const dy = impressionMaskState.y - position.y;
  const cos = Math.cos(-stampRotation);
  const sin = Math.sin(-stampRotation);
  return {
    offset_x: dx * cos - dy * sin,
    offset_y: dx * sin + dy * cos,
    size: maskSize,
    rotation: maskRotation - stampRotation,
  };
}

function buildImpressionStamp(position, alpha, useMask) {
  if (!position || !impressionConfig || !impressionCurrentShape) {
    return null;
  }
  const color = impressionShapeColorMap[impressionCurrentShape] || impressionCurrentColor;
  if (!color) {
    return null;
  }
  const size = Number.parseInt(impressionConfig && impressionConfig.stamp_size, 10) || 64;
  const rotation = (Math.PI / 180) * (Number.parseFloat(impressionRotation) || 0);
  const shouldMask = useMask === undefined ? impressionMaskActive : useMask;
  let mask = null;
  if (shouldMask) {
    mask = buildImpressionMask(position, rotation);
  }
  return {
    shape: impressionCurrentShape,
    color,
    alpha,
    x: position.x,
    y: position.y,
    size,
    rotation,
    mask,
  };
}

function isImpressionPointOnStamp(position, stamp) {
  if (!position || !stamp) {
    return false;
  }
  const half = (stamp.size || 0) / 2;
  const dx = position.x - stamp.x;
  const dy = position.y - stamp.y;
  return Math.abs(dx) <= half && Math.abs(dy) <= half;
}

function findImpressionStampIndex(position) {
  if (!position) {
    return null;
  }
  const lastIndex = impressionStampHistory.length - 1;
  if (lastIndex < 0) {
    return null;
  }
  if (isImpressionPointOnStamp(position, impressionStampHistory[lastIndex])) {
    return lastIndex;
  }
  return null;
}

function startImpressionDrag(event) {
  if (!impressionCanvas || !impressionCtx) {
    return false;
  }
  if (impressionPressStart !== null) {
    return false;
  }
  const position = getImpressionPosition(event);
  if (!position) {
    return false;
  }
  const stampIndex = findImpressionStampIndex(position);
  if (stampIndex === null) {
    return false;
  }
  const stamp = impressionStampHistory[stampIndex];
  if (!stamp) {
    return false;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  stopImpressionPreviewLoop();
  setImpressionActiveStampIndex(stampIndex);
  impressionDraggingStamp = {
    index: stampIndex,
    offsetX: position.x - stamp.x,
    offsetY: position.y - stamp.y,
  };
  renderImpressionCanvas();
  return true;
}

function updateImpressionDrag(event) {
  if (!impressionDraggingStamp || !impressionCanvas) {
    return;
  }
  const stamp = impressionStampHistory[impressionDraggingStamp.index];
  if (!stamp) {
    return;
  }
  const position = getImpressionPosition(event);
  if (!position) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  const half = (stamp.size || 0) / 2;
  const nextX = position.x - impressionDraggingStamp.offsetX;
  const nextY = position.y - impressionDraggingStamp.offsetY;
  stamp.x = Math.max(half, Math.min(impressionCanvas.width - half, nextX));
  stamp.y = Math.max(half, Math.min(impressionCanvas.height - half, nextY));
  renderImpressionCanvas();
}

function endImpressionDrag() {
  impressionDraggingStamp = null;
  renderImpressionCanvas();
}

function startImpressionPreviewLoop() {
  if (impressionPreviewRaf) {
    return;
  }
  const tick = () => {
    if (impressionPressStart === null || !impressionPreviewPosition) {
      impressionPreviewRaf = null;
      return;
    }
    const alpha = impressionAlphaForDuration(Date.now() - impressionPressStart);
    impressionPreviewStamp = buildImpressionStamp(
      impressionPreviewPosition,
      alpha,
      impressionMaskActive && impressionMaskTarget !== "active"
    );
    renderImpressionCanvas();
    impressionPreviewRaf = requestAnimationFrame(tick);
  };
  impressionPreviewRaf = requestAnimationFrame(tick);
}

function stopImpressionPreviewLoop() {
  if (impressionPreviewRaf) {
    cancelAnimationFrame(impressionPreviewRaf);
    impressionPreviewRaf = null;
  }
  impressionPreviewStamp = null;
  impressionPreviewPosition = null;
}

function startImpressionPress(event) {
  if (!impressionCanvas || !impressionCtx) {
    return;
  }
  if (!isImpressionActionAvailable("submit_drawing")) {
    return;
  }
  if (impressionStampsLeft <= 0) {
    return;
  }
  if (impressionMaskActive && impressionMaskTarget === "active") {
    impressionMaskTarget = "next";
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  const position = getImpressionPosition(event);
  if (!position) {
    return;
  }
  impressionPressStart = Date.now();
  impressionPreviewPosition = position;
  const preview = buildImpressionStamp(
    position,
    impressionAlphaForDuration(0),
    impressionMaskActive && impressionMaskTarget !== "active"
  );
  if (!preview) {
    impressionPressStart = null;
    impressionPreviewPosition = null;
    return;
  }
  impressionPreviewStamp = preview;
  renderImpressionCanvas();
  startImpressionPreviewLoop();
}

function updateImpressionPreviewPosition(event) {
  if (impressionPressStart === null) {
    return;
  }
  const position = getImpressionPosition(event);
  if (!position) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  impressionPreviewPosition = position;
  if (!impressionPreviewRaf) {
    startImpressionPreviewLoop();
  }
}

function handleImpressionPointerDown(event) {
  if (startImpressionDrag(event)) {
    return;
  }
  startImpressionPress(event);
}

function handleImpressionPointerMove(event) {
  if (impressionDraggingStamp) {
    updateImpressionDrag(event);
    return;
  }
  updateImpressionPreviewPosition(event);
}

function handleImpressionPointerUp(event) {
  if (impressionDraggingStamp) {
    if (event.cancelable) {
      event.preventDefault();
    }
    endImpressionDrag();
    return;
  }
  endImpressionPress(event);
}

function handleImpressionPointerCancel(event) {
  if (impressionDraggingStamp) {
    endImpressionDrag();
    return;
  }
  cancelImpressionPress(event);
}

function endImpressionPress(event) {
  if (!impressionCanvas || !impressionCtx) {
    return;
  }
  if (impressionPressStart === null) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  if (impressionStampsLeft <= 0) {
    impressionPressStart = null;
    return;
  }
  if (!impressionCurrentShape || !impressionConfig) {
    impressionPressStart = null;
    return;
  }
  const position = impressionPreviewPosition || getImpressionPosition(event);
  if (!position) {
    impressionPressStart = null;
    return;
  }
  const duration = Date.now() - impressionPressStart;
  const alpha = impressionAlphaForDuration(duration);
  const stamp = buildImpressionStamp(position, alpha, impressionMaskActive && impressionMaskTarget !== "active");
  if (!stamp) {
    impressionPressStart = null;
    stopImpressionPreviewLoop();
    renderImpressionCanvas();
    return;
  }
  stamp.mask_used = !!stamp.mask;
  impressionStampHistory.push(stamp);
  setImpressionActiveStampIndex(impressionStampHistory.length - 1);
  impressionStampsLeft = Math.max(0, impressionStampsLeft - 1);
  if (impressionStampsLeftLabel) {
    impressionStampsLeftLabel.textContent = `${impressionStampsLeft}`;
  }
  stopImpressionPreviewLoop();
  impressionPressStart = null;
  renderImpressionCanvas();
  if (impressionMaskActive) {
    setImpressionMaskActive(false);
    impressionMaskTarget = null;
  }
  updateImpressionButtons();
}

function cancelImpressionPress(event) {
  if (event && event.cancelable) {
    event.preventDefault();
  }
  impressionPressStart = null;
  stopImpressionPreviewLoop();
  renderImpressionCanvas();
}

function resetImpressionMaskState() {
  if (!impressionCanvas) {
    return;
  }
  impressionMaskState = {
    x: impressionCanvas.width / 2,
    y: impressionCanvas.height / 2,
    rotation: 0,
    scale: 1,
  };
  if (impressionMaskRotationInput) {
    impressionMaskRotationInput.value = "0";
  }
  if (impressionMaskScaleInput) {
    impressionMaskScaleInput.value = "1";
  }
  updateImpressionMaskElement();
}

function updateImpressionMaskElement() {
  if (!impressionMask || !impressionCanvas || !impressionMaskState || !impressionConfig) {
    return;
  }
  const rect = impressionCanvas.getBoundingClientRect();
  const scaleX = rect.width ? rect.width / impressionCanvas.width : 1;
  const scaleY = rect.height ? rect.height / impressionCanvas.height : 1;
  const baseSize = Number.parseInt(impressionConfig.mask_size, 10) || 180;
  const size = baseSize * impressionMaskState.scale;
  impressionMask.style.width = `${size * scaleX}px`;
  impressionMask.style.height = `${size * scaleY}px`;
  impressionMask.style.left = `${impressionMaskState.x * scaleX}px`;
  impressionMask.style.top = `${impressionMaskState.y * scaleY}px`;
  impressionMask.style.transform = `translate(-50%, -50%) rotate(${impressionMaskState.rotation}deg)`;
}

function applyImpressionMaskToActiveStamp() {
  const stamp = getImpressionActiveStamp();
  if (!stamp || stamp.mask_used) {
    return;
  }
  const mask = buildImpressionMask({ x: stamp.x, y: stamp.y }, stamp.rotation || 0);
  if (!mask) {
    return;
  }
  stamp.mask = mask;
  stamp.mask_used = true;
  renderImpressionCanvas();
}

function setImpressionMaskActive(active) {
  impressionMaskActive = active;
  if (impressionMask) {
    impressionMask.classList.toggle("hidden", !active);
  }
  if (impressionMaskControls) {
    impressionMaskControls.classList.toggle("hidden", !active);
  }
  if (impressionMaskBtn) {
    impressionMaskBtn.classList.toggle("tool-active", active);
  }
  if (active && !impressionMaskState) {
    resetImpressionMaskState();
  }
  updateImpressionMaskElement();
}

function startImpressionMaskDrag(event) {
  if (!impressionMaskActive || !impressionMaskState || !impressionCanvas) {
    return;
  }
  event.preventDefault();
  const point = event.touches ? event.touches[0] : event;
  const rect = impressionCanvas.getBoundingClientRect();
  impressionMaskDrag = {
    startX: point.clientX,
    startY: point.clientY,
    originX: impressionMaskState.x,
    originY: impressionMaskState.y,
    rect,
  };
  document.addEventListener("mousemove", onImpressionMaskDrag);
  document.addEventListener("mouseup", endImpressionMaskDrag);
  document.addEventListener("touchmove", onImpressionMaskDrag, { passive: false });
  document.addEventListener("touchend", endImpressionMaskDrag, { passive: false });
}

function onImpressionMaskDrag(event) {
  if (!impressionMaskDrag || !impressionCanvas || !impressionMaskState) {
    return;
  }
  event.preventDefault();
  const point = event.touches ? event.touches[0] : event;
  const scaleX = impressionMaskDrag.rect.width ? impressionCanvas.width / impressionMaskDrag.rect.width : 1;
  const scaleY = impressionMaskDrag.rect.height ? impressionCanvas.height / impressionMaskDrag.rect.height : 1;
  const dx = (point.clientX - impressionMaskDrag.startX) * scaleX;
  const dy = (point.clientY - impressionMaskDrag.startY) * scaleY;
  impressionMaskState.x = Math.max(0, Math.min(impressionCanvas.width, impressionMaskDrag.originX + dx));
  impressionMaskState.y = Math.max(0, Math.min(impressionCanvas.height, impressionMaskDrag.originY + dy));
  updateImpressionMaskElement();
}

function endImpressionMaskDrag() {
  impressionMaskDrag = null;
  document.removeEventListener("mousemove", onImpressionMaskDrag);
  document.removeEventListener("mouseup", endImpressionMaskDrag);
  document.removeEventListener("touchmove", onImpressionMaskDrag);
  document.removeEventListener("touchend", endImpressionMaskDrag);
}

function impressionMatchesComplete(view) {
  const drawings = Array.isArray(view && view.drawings) ? view.drawings : [];
  if (!drawings.length) {
    return false;
  }
  return drawings.every((drawing) => impressionMatches[drawing.drawing_id]);
}

function isImpressionActionAvailable(actionType) {
  if (currentGameType !== "impression_flower" || !currentImpressionView) {
    return false;
  }
  if (!Array.isArray(currentImpressionView.legal_actions)) {
    return false;
  }
  if (!currentImpressionView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "submit_matches") {
    return impressionMatchesComplete(currentImpressionView);
  }
  return true;
}

function updateImpressionButtons() {
  if (currentGameType !== "impression_flower") {
    stopImpressionRotateHold();
    Object.values(impressionActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    impressionShapeButtonEls.forEach((button) => {
      button.disabled = true;
    });
    if (impressionUndoBtn) {
      impressionUndoBtn.disabled = true;
    }
    if (impressionMaskBtn) {
      impressionMaskBtn.disabled = true;
    }
    if (impressionRotationInput) {
      impressionRotationInput.disabled = true;
    }
    if (impressionRotateLeftBtn) {
      impressionRotateLeftBtn.disabled = true;
    }
    if (impressionRotateRightBtn) {
      impressionRotateRightBtn.disabled = true;
    }
    return;
  }
  Object.entries(impressionActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isImpressionActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  const canDraw = isImpressionActionAvailable("submit_drawing");
  if (!canDraw) {
    stopImpressionRotateHold();
  }
  impressionShapeButtonEls.forEach((button) => {
    button.disabled = !canDraw;
  });
  if (impressionUndoBtn) {
    impressionUndoBtn.disabled = !canDraw || impressionStampHistory.length === 0;
  }
  if (impressionMaskBtn) {
    impressionMaskBtn.disabled = !canDraw;
  }
  if (impressionRotationInput) {
    impressionRotationInput.disabled = !canDraw;
  }
  if (impressionRotateLeftBtn) {
    impressionRotateLeftBtn.disabled = !canDraw;
  }
  if (impressionRotateRightBtn) {
    impressionRotateRightBtn.disabled = !canDraw;
  }
}

function assignImpressionWordToDrawing(view, drawingId, word) {
  if (!word || drawingId === undefined || drawingId === null) {
    return;
  }
  Object.keys(impressionMatches).forEach((key) => {
    if (impressionMatches[key] === word) {
      delete impressionMatches[key];
    }
  });
  impressionMatches[drawingId] = word;
  impressionSelectedWord = null;
  renderImpressionWordBank(view);
  renderImpressionDrawings(view);
  updateImpressionButtons();
}

function renderImpressionWordBank(view) {
  if (!impressionWordBank) {
    return;
  }
  impressionWordBank.innerHTML = "";
  const words = Array.isArray(view.word_bank) ? view.word_bank : [];
  if (!words.length) {
    impressionSelectedWord = null;
    impressionWordBank.textContent = "Waiting for guesser...";
    return;
  }
  const assignedWords = new Set(Object.values(impressionMatches));
  if (impressionSelectedWord && assignedWords.has(impressionSelectedWord)) {
    impressionSelectedWord = null;
  }
  words.forEach((word) => {
    const chip = document.createElement("div");
    chip.className = "impression-word";
    chip.textContent = word;
    const isAssigned = assignedWords.has(word);
    if (isAssigned) {
      chip.classList.add("assigned");
      chip.draggable = false;
    } else {
      chip.draggable = true;
      chip.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", word);
        event.dataTransfer.effectAllowed = "move";
      });
      chip.addEventListener("click", () => {
        impressionSelectedWord = impressionSelectedWord === word ? null : word;
        renderImpressionWordBank(view);
        renderImpressionDrawings(view);
      });
    }
    if (impressionSelectedWord === word) {
      chip.classList.add("selected");
    }
    impressionWordBank.appendChild(chip);
  });
}

function renderImpressionDrawings(view) {
  if (!impressionDrawings) {
    return;
  }
  impressionDrawings.innerHTML = "";
  const drawings = Array.isArray(view.drawings) ? view.drawings : [];
  if (!drawings.length) {
    impressionDrawings.textContent = "Waiting for guesser...";
    return;
  }
  drawings.forEach((drawing) => {
    const card = document.createElement("div");
    card.className = "impression-drawing";
    const author = document.createElement("div");
    author.textContent = drawing.author_name ? `By ${drawing.author_name}` : "By ?";
    const image = document.createElement("img");
    image.src = drawing.image_data;
    image.alt = "drawing";
    const dropzone = document.createElement("div");
    dropzone.className = "impression-dropzone";
    const assignedWord = impressionMatches[drawing.drawing_id];
    if (assignedWord) {
      const assigned = document.createElement("span");
      assigned.className = "impression-assigned-word";
      assigned.textContent = assignedWord;
      assigned.title = "Click to clear";
      assigned.addEventListener("click", () => {
        delete impressionMatches[drawing.drawing_id];
        renderImpressionWordBank(view);
        renderImpressionDrawings(view);
        updateImpressionButtons();
      });
      dropzone.innerHTML = "";
      dropzone.appendChild(assigned);
    } else {
      dropzone.textContent = "Drop word here";
      dropzone.addEventListener("click", () => {
        if (!impressionSelectedWord) {
          return;
        }
        assignImpressionWordToDrawing(view, drawing.drawing_id, impressionSelectedWord);
      });
    }
    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("active");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("active");
    });
    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("active");
      const word = event.dataTransfer.getData("text/plain");
      if (!word) {
        return;
      }
      assignImpressionWordToDrawing(view, drawing.drawing_id, word);
    });
    card.appendChild(author);
    card.appendChild(image);
    card.appendChild(dropzone);
    impressionDrawings.appendChild(card);
  });
}

function renderImpressionPlayers(view) {
  if (!impressionPlayers) {
    return;
  }
  impressionPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    const line = document.createElement("div");
    const tags = [];
    if (player.is_guesser) tags.push("guesser");
    if (player.submitted) tags.push("submitted");
    if (player.player_id === view.you) tags.push("you");
    const score = player.score ?? 0;
    line.textContent = `${(player.seat ?? 0) + 1}. ${player.name} (${tags.join(", ") || "player"}) - ${score}`;
    impressionPlayers.appendChild(line);
  });
}

function renderImpressionRoundResult(view) {
  if (!impressionRoundResult) {
    return;
  }
  const result = view.last_result;
  if (!result) {
    impressionRoundResult.textContent = "-";
    return;
  }
  const total = result.matches ? Object.keys(result.matches).length : 0;
  const correct = Array.isArray(result.correct) ? result.correct.length : 0;
  const scoreParts = [];
  const players = Array.isArray(view.players) ? view.players : [];
  if (result.scores_delta) {
    Object.entries(result.scores_delta).forEach(([pid, delta]) => {
      const player = players.find((p) => p.player_id === pid);
      scoreParts.push(`${player ? player.name : pid} +${delta}`);
    });
  }
  const scoresText = scoreParts.length ? ` | ${scoreParts.join(", ")}` : "";
  impressionRoundResult.textContent = `Matched ${correct}/${total}${scoresText}`;
}

function setupImpressionCanvas() {
  if (!impressionCanvas || !impressionCtx) {
    return;
  }
  impressionCanvas.addEventListener("mousedown", handleImpressionPointerDown);
  impressionCanvas.addEventListener("mousemove", handleImpressionPointerMove);
  impressionCanvas.addEventListener("mouseup", handleImpressionPointerUp);
  impressionCanvas.addEventListener("mouseleave", handleImpressionPointerCancel);
  impressionCanvas.addEventListener("touchstart", handleImpressionPointerDown, { passive: false });
  impressionCanvas.addEventListener("touchmove", handleImpressionPointerMove, { passive: false });
  impressionCanvas.addEventListener("touchend", handleImpressionPointerUp, { passive: false });
  impressionCanvas.addEventListener("touchcancel", handleImpressionPointerCancel, { passive: false });
  if (impressionMask) {
    impressionMask.addEventListener("mousedown", startImpressionMaskDrag);
    impressionMask.addEventListener("touchstart", startImpressionMaskDrag, { passive: false });
  }
  window.addEventListener("resize", () => {
    updateImpressionMaskElement();
    updateImpressionRotateControls();
  });
}

function getSplendorPlayer(view, pid) {
  if (!view || !Array.isArray(view.players)) {
    return null;
  }
  return view.players.find((p) => p.player_id === pid) || null;
}

function getSplendorYou(view) {
  return getSplendorPlayer(view, view && view.you);
}

function splendorRequiredCost(card, bonuses) {
  const required = {};
  splendorBaseColors.forEach((color) => {
    const base = (card.cost && card.cost[color]) || 0;
    const discount = (bonuses && bonuses[color]) || 0;
    required[color] = Math.max(0, base - discount);
  });
  return required;
}

function splendorCanAfford(card, player) {
  if (!card || !player) {
    return false;
  }
  const required = splendorRequiredCost(card, player.bonuses || {});
  const total = splendorBaseColors.reduce((sum, color) => sum + required[color], 0);
  const colored = splendorBaseColors.reduce((sum, color) => {
    const available = (player.tokens && player.tokens[color]) || 0;
    return sum + Math.min(required[color], available);
  }, 0);
  const gold = (player.tokens && player.tokens.gold) || 0;
  return gold >= total - colored;
}

function splendorAutoPayment(card, player) {
  if (!card || !player) {
    return null;
  }
  const required = splendorRequiredCost(card, player.bonuses || {});
  const payment = {};
  let paid = 0;
  splendorBaseColors.forEach((color) => {
    const available = (player.tokens && player.tokens[color]) || 0;
    const pay = Math.min(required[color], available);
    payment[color] = pay;
    paid += pay;
  });
  const total = splendorBaseColors.reduce((sum, color) => sum + required[color], 0);
  const remaining = total - paid;
  const gold = (player.tokens && player.tokens.gold) || 0;
  if (remaining > gold) {
    return null;
  }
  payment.gold = remaining;
  return payment;
}

function getSelectedMarketCard(view) {
  if (!view || !splendorSelectedMarket) {
    return null;
  }
  const tier = splendorSelectedMarket.tier;
  const index = splendorSelectedMarket.index;
  const cards = view.market && view.market[tier];
  if (!Array.isArray(cards) || index < 0 || index >= cards.length) {
    return null;
  }
  return cards[index];
}

function getSelectedReservedCard(view) {
  if (!view || splendorSelectedReserved === null) {
    return null;
  }
  const cards = view.your_reserved || [];
  if (splendorSelectedReserved < 0 || splendorSelectedReserved >= cards.length) {
    return null;
  }
  return cards[splendorSelectedReserved];
}

function isSplendorActionAvailable(actionType) {
  if (!currentSplendorView || !Array.isArray(currentSplendorView.legal_actions)) {
    return false;
  }
  if (!currentSplendorView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "take_tokens") {
    const gain = splendorTokenGainForAction(currentSplendorView, "take_tokens");
    if (!gain) {
      return false;
    }
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "take_tokens_same") {
    const gain = splendorTokenGainForAction(currentSplendorView, "take_tokens_same");
    if (!gain) {
      return false;
    }
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "reserve_market" || actionType === "buy_market") {
    if (!splendorSelectedMarket) {
      return false;
    }
    if (actionType === "buy_market") {
      const card = getSelectedMarketCard(currentSplendorView);
      return !!(card && card.affordable);
    }
    const gain = splendorTokenGainForAction(currentSplendorView, "reserve_market");
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "reserve_deck") {
    const gain = splendorTokenGainForAction(currentSplendorView, "reserve_deck");
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "buy_reserved") {
    const card = getSelectedReservedCard(currentSplendorView);
    return !!(card && card.affordable);
  }
  if (actionType === "discard_tokens") {
    if (!currentSplendorView) {
      return false;
    }
    const you = getSplendorYou(currentSplendorView);
    if (!you) {
      return false;
    }
    return (
      splendorTokenSelectionTotal() > 0 &&
      splendorColors.every((color) => (splendorTokenSelection[color] || 0) <= ((you.tokens && you.tokens[color]) || 0))
    );
  }
  if (actionType === "choose_noble") {
    return !!splendorSelectedNoble;
  }
  return true;
}

function updateSplendorActionButtons() {
  if (currentGameType !== "splendor") {
    Object.values(splendorActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(splendorActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isSplendorActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function renderDrawGuessPlayers(view) {
  drawGuessPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const line = document.createElement("div");
    const tags = [];
    if (p.player_id === view.you) {
      tags.push("you");
    }
    if (p.submitted) {
      tags.push("submitted");
    }
    if (p.is_bot) {
      tags.push("bot");
    }
    line.textContent = `${p.seat + 1}. ${p.name} (${tags.join(", ") || "waiting"})`;
    drawGuessPlayers.appendChild(line);
  });
}

function renderDrawGuessReview(view) {
  if (!view.review || !view.review.books) {
    drawGuessReview.classList.add("hidden");
    return;
  }
  drawGuessReview.classList.remove("hidden");
  drawGuessBooks.innerHTML = "";
  view.review.books.forEach((book) => {
    const wrapper = document.createElement("div");
    wrapper.className = "review-book";
    if (book.final_match) {
      wrapper.classList.add("match");
    }
    const title = document.createElement("div");
    title.textContent = `${book.owner_name || book.owner_id}`;
    const promptLine = document.createElement("div");
    promptLine.textContent = `Prompt: ${book.prompt || "-"}`;
    const finalLine = document.createElement("div");
    finalLine.textContent = `Final guess: ${book.final_guess || "-"}`;
    wrapper.appendChild(title);
    wrapper.appendChild(promptLine);
    wrapper.appendChild(finalLine);

    book.entries.forEach((entry) => {
      const entryEl = document.createElement("div");
      entryEl.className = "review-entry";
      const label = document.createElement("div");
      const authorName = entry.author_name || entry.author_id || "unknown";
      label.textContent = `Round ${entry.round} ${entry.type} by ${authorName}`;
      entryEl.appendChild(label);
      if (entry.type === "drawing") {
        const img = document.createElement("img");
        img.src = entry.image_data || "";
        img.alt = "drawing";
        entryEl.appendChild(img);
      } else {
        const text = document.createElement("div");
        text.textContent = entry.text || "-";
        entryEl.appendChild(text);
      }
      wrapper.appendChild(entryEl);
    });

    drawGuessBooks.appendChild(wrapper);
  });
}

function aidixitCardUrl(cardId) {
  if (!cardId) {
    return "";
  }
  const idx = cardId.indexOf("/");
  if (idx <= 0) {
    return "";
  }
  const deck = cardId.slice(0, idx);
  const file = cardId.slice(idx + 1);
  if (!deck || !file) {
    return "";
  }
  return `/api/aidixit/card?deck=${encodeURIComponent(deck)}&file=${encodeURIComponent(file)}`;
}

function createAidixitCardElement(card, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "aidixit-card";
  if (options.selected) {
    wrapper.classList.add("selected");
  }
  if (options.disabled) {
    wrapper.classList.add("disabled");
  }
  if (options.story) {
    wrapper.classList.add("story");
  }
  const img = document.createElement("img");
  const cardId = card.card_id || "";
  img.src = card.image_url || aidixitCardUrl(cardId);
  img.alt = cardId || "card";
  wrapper.appendChild(img);
  if (options.zoomable) {
    const zoomBtn = document.createElement("button");
    zoomBtn.type = "button";
    zoomBtn.className = "aidixit-zoom-btn";
    zoomBtn.setAttribute("aria-label", "Zoom card");
    zoomBtn.title = "Zoom";
    zoomBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAidixitZoom(img.src, img.alt);
    });
    wrapper.appendChild(zoomBtn);
  }
  if (options.count !== undefined) {
    const badge = document.createElement("div");
    badge.className = "aidixit-card-count";
    badge.textContent = String(options.count);
    wrapper.appendChild(badge);
  }
  if (options.story) {
    const label = document.createElement("div");
    label.className = "aidixit-card-story";
    label.textContent = "Story";
    wrapper.appendChild(label);
  }
  return wrapper;
}

function renderAidixitHand(view) {
  if (!aidixitHand) {
    return;
  }
  aidixitHand.innerHTML = "";
  if (!Array.isArray(view.hand) || !view.hand.length) {
    aidixitHand.textContent = "-";
    return;
  }
  const isStoryteller = view.storyteller_id === view.you;
  const canSelect = (view.phase === "story" && isStoryteller) || (view.phase === "submit" && !isStoryteller);
  const locked = view.game_over || !canSelect || view.submitted;
  view.hand.forEach((card) => {
    const selected = aidixitSelectedHandCardId === card.card_id;
    const cardEl = createAidixitCardElement(card, { selected, disabled: locked, zoomable: true });
    if (!locked) {
      cardEl.addEventListener("click", () => {
        aidixitSelectedHandCardId = card.card_id;
        updateAidixitButtons();
        renderAidixitHand(view);
      });
    }
    aidixitHand.appendChild(cardEl);
  });
}

function renderAidixitPool(view) {
  if (!aidixitPool) {
    return;
  }
  aidixitPool.innerHTML = "";
  if (view.phase !== "vote") {
    aidixitPool.textContent = "-";
    return;
  }
  const isStoryteller = view.storyteller_id === view.you;
  const selectedVoteId = view.voted ? view.vote_card_id : aidixitSelectedVoteCardId;
  const disableAll = view.game_over || view.voted || isStoryteller;
  const poolCards = Array.isArray(view.pool_cards) ? view.pool_cards : [];
  if (!poolCards.length) {
    aidixitPool.textContent = "-";
    return;
  }
  poolCards.forEach((card) => {
    const isOwn = view.your_submission === card.card_id;
    const selected = selectedVoteId === card.card_id;
    const cardEl = createAidixitCardElement(card, {
      selected,
      disabled: disableAll || isOwn,
      zoomable: true,
    });
    if (!disableAll && !isOwn) {
      cardEl.addEventListener("click", () => {
        aidixitSelectedVoteCardId = card.card_id;
        updateAidixitButtons();
        renderAidixitPool(view);
      });
    }
    aidixitPool.appendChild(cardEl);
  });
}

function renderAidixitPlayers(view) {
  if (!aidixitPlayers) {
    return;
  }
  aidixitPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.storyteller_id) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const nameRow = document.createElement("div");
    nameRow.className = "player-name";
    const colorDot = document.createElement("span");
    colorDot.className = "aidixit-color-dot";
    colorDot.style.backgroundColor = p.color || "#9ca3af";
    nameRow.appendChild(colorDot);
    const nameText = document.createElement("span");
    nameText.textContent = p.name;
    nameRow.appendChild(nameText);
    header.appendChild(nameRow);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${p.score}`;
    badges.appendChild(score);
    if (p.player_id === view.storyteller_id) {
      const storyteller = document.createElement("span");
      storyteller.className = "badge highlight";
      storyteller.textContent = "storyteller";
      badges.appendChild(storyteller);
    }
    if (p.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (p.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    header.appendChild(badges);

    card.appendChild(header);
    aidixitPlayers.appendChild(card);
  });
}

function renderAidixitRoundNotice(view) {
  if (!aidixitRoundNotice || !aidixitRoundNoticeBody) {
    return;
  }
  const result = view.last_result;
  if (!result) {
    aidixitRoundNotice.classList.add("hidden");
    if (aidixitRoundNoticeCards) {
      aidixitRoundNoticeCards.innerHTML = "";
    }
    return;
  }
  aidixitRoundNotice.classList.remove("hidden");
  const caseMap = {
    all: "All guessed (too obvious)",
    none: "None guessed (too obscure)",
    partial: "Some guessed",
  };
  const label = caseMap[result.case] || result.case || "Round";
  const correctNames = Array.isArray(result.correct_voters) && result.correct_voters.length
    ? result.correct_voters.map((pid) => findPlayerName(view, pid)).join(", ")
    : "none";
  const scoreEntries = result.scores_delta || {};
  const scoreSummary = Object.keys(scoreEntries)
    .map((pid) => {
      const delta = scoreEntries[pid];
      const sign = delta >= 0 ? "+" : "";
      return `${findPlayerName(view, pid)} ${sign}${delta}`;
    })
    .join(", ");
  const clue = result.clue || view.clue || "-";
  const storytellerName = result.storyteller_id ? findPlayerName(view, result.storyteller_id) : "-";
  aidixitRoundNoticeBody.textContent =
    `Storyteller: ${storytellerName} · Clue: ${clue} · ${label} · Correct: ${correctNames}` +
    (scoreSummary ? ` · Scores: ${scoreSummary}` : "");

  if (aidixitRoundNoticeCards) {
    aidixitRoundNoticeCards.innerHTML = "";
    const voteCounts = result.vote_counts || {};
    const votesByCard = result.votes_by_card || {};
    let cardIds = Array.isArray(result.pool_cards) ? result.pool_cards : [];
    if (!cardIds.length) {
      cardIds = Object.keys(voteCounts);
    }
    if (result.story_card && !cardIds.includes(result.story_card)) {
      cardIds = [...cardIds, result.story_card];
    }
    cardIds.forEach((cardId) => {
      const count = voteCounts[cardId];
      const card = { card_id: cardId, image_url: aidixitCardUrl(cardId) };
      const cardEl = createAidixitCardElement(card, {
        count: typeof count === "number" ? count : undefined,
        story: cardId === result.story_card,
        disabled: true,
        zoomable: true,
      });
      const votes = (votesByCard && votesByCard[cardId]) || [];
      if (votes.length) {
        const voteRow = document.createElement("div");
        voteRow.className = "aidixit-votes";
        votes.forEach((vote) => {
          const dot = document.createElement("span");
          dot.className = "aidixit-vote-dot";
          if (vote.color) {
            dot.style.backgroundColor = vote.color;
          }
          if (vote.name) {
            dot.title = vote.name;
          }
          voteRow.appendChild(dot);
        });
        cardEl.appendChild(voteRow);
      }
      aidixitRoundNoticeCards.appendChild(cardEl);
    });
  }
}

function updateAidixitButtons() {
  if (!aidixitSubmitStoryBtn || !aidixitSubmitCardBtn || !aidixitSubmitVoteBtn) {
    return;
  }
  const view = currentAidixitView;
  if (!view || currentGameType !== "aidixit") {
    aidixitSubmitStoryBtn.disabled = true;
    aidixitSubmitCardBtn.disabled = true;
    aidixitSubmitVoteBtn.disabled = true;
    return;
  }
  const isStoryteller = view.storyteller_id === view.you;
  const clueReady = aidixitClueInput && aidixitClueInput.value.trim().length > 0;
  const canStory =
    !view.game_over &&
    view.phase === "story" &&
    isStoryteller &&
    !!aidixitSelectedHandCardId &&
    clueReady;
  const canSubmit =
    !view.game_over &&
    view.phase === "submit" &&
    !isStoryteller &&
    !view.submitted &&
    !!aidixitSelectedHandCardId;
  const canVote =
    !view.game_over &&
    view.phase === "vote" &&
    !isStoryteller &&
    !view.voted &&
    !!aidixitSelectedVoteCardId &&
    aidixitSelectedVoteCardId !== view.your_submission;
  aidixitSubmitStoryBtn.disabled = !canStory;
  aidixitSubmitCardBtn.disabled = !canSubmit;
  aidixitSubmitVoteBtn.disabled = !canVote;
}

function formatSplendorCost(cost) {
  if (!cost) {
    return [];
  }
  return splendorBaseColors
    .filter((color) => cost[color])
    .map((color) => ({
      color,
      count: cost[color],
    }));
}

function createSplendorCard(card, selected, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "splendor-card";
  if (options.compact) {
    wrapper.classList.add("compact");
  }
  if (selected) {
    wrapper.classList.add("selected");
  }
  if (card.affordable) {
    wrapper.classList.add("affordable");
  }
  const title = document.createElement("div");
  title.className = "card-title";
  const bonusLabel = splendorColorLabels[card.bonus] || card.bonus;
  title.textContent = `${card.id} (${card.points})`;
  wrapper.appendChild(title);

  const bonus = document.createElement("div");
  bonus.className = `cost-chip gem-${card.bonus}`;
  bonus.textContent = `Bonus ${bonusLabel}`;
  wrapper.appendChild(bonus);

  const costRow = document.createElement("div");
  costRow.className = "card-cost";
  formatSplendorCost(card.cost).forEach((entry) => {
    const chip = document.createElement("div");
    chip.className = `cost-chip gem-${entry.color}`;
    chip.textContent = `${splendorColorLabels[entry.color] || entry.color}${entry.count}`;
    costRow.appendChild(chip);
  });
  if (!costRow.childNodes.length) {
    const chip = document.createElement("div");
    chip.className = "cost-chip";
    chip.textContent = "-";
    costRow.appendChild(chip);
  }
  wrapper.appendChild(costRow);
  return wrapper;
}

function createSplendorNobleCard(noble, selected, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "splendor-card";
  if (options.compact) {
    wrapper.classList.add("compact");
  }
  if (selected) {
    wrapper.classList.add("selected");
  }
  if (noble.eligible) {
    wrapper.classList.add("affordable");
  }
  const title = document.createElement("div");
  title.className = "card-title";
  const hasPoints = typeof noble.points === "number";
  title.textContent = hasPoints ? `${noble.id} (${noble.points})` : `${noble.id}`;
  wrapper.appendChild(title);

  const costRow = document.createElement("div");
  costRow.className = "card-cost";
  formatSplendorCost(noble.requirement).forEach((entry) => {
    const chip = document.createElement("div");
    chip.className = `cost-chip gem-${entry.color}`;
    chip.textContent = `${splendorColorLabels[entry.color] || entry.color}${entry.count}`;
    costRow.appendChild(chip);
  });
  if (!costRow.childNodes.length) {
    const chip = document.createElement("div");
    chip.className = "cost-chip";
    chip.textContent = "-";
    costRow.appendChild(chip);
  }
  wrapper.appendChild(costRow);
  return wrapper;
}

function renderSplendorSupply(view) {
  if (!splendorSupply) {
    return;
  }
  splendorSupply.innerHTML = "";
  splendorColors.forEach((color) => {
    const token = document.createElement("div");
    token.className = `splendor-token gem-${color}`;
    const count = view.tokens_supply ? view.tokens_supply[color] : 0;
    token.textContent = `${splendorColorLabels[color] || color}: ${count}`;
    splendorSupply.appendChild(token);
  });
}

function renderSplendorMarket(view) {
  const tiers = {
    tier3: splendorMarketTier3,
    tier2: splendorMarketTier2,
    tier1: splendorMarketTier1,
  };
  Object.entries(tiers).forEach(([tier, container]) => {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    const cards = (view.market && view.market[tier]) || [];
    cards.forEach((card, index) => {
      const selected = splendorSelectedMarket && splendorSelectedMarket.tier === tier && splendorSelectedMarket.index === index;
      const cardEl = createSplendorCard(card, selected);
      cardEl.addEventListener("click", () => {
        splendorSelectedMarket = { tier, index };
        splendorSelectedReserved = null;
        updateSplendorSelectionLabels();
        renderSplendorMarket(view);
        renderSplendorReserved(view);
        renderSplendorDiscardSelection();
        updateSplendorDiscardHint(view);
        updateSplendorActionButtons();
      });
      container.appendChild(cardEl);
    });
    if (!cards.length) {
      const empty = document.createElement("div");
      empty.className = "splendor-card";
      empty.textContent = "-";
      container.appendChild(empty);
    }
  });
}

function renderSplendorNobles(view) {
  if (!splendorNobles) {
    return;
  }
  splendorNobles.innerHTML = "";
  const nobles = view.nobles || [];
  nobles.forEach((noble) => {
    if (noble && noble.id) {
      splendorNobleCatalog[noble.id] = noble;
    }
    const selected = splendorSelectedNoble === noble.id;
    const nobleEl = createSplendorNobleCard(noble, selected);
    nobleEl.addEventListener("click", () => {
      splendorSelectedNoble = noble.id;
      updateSplendorSelectionLabels();
      renderSplendorNobles(view);
      updateSplendorActionButtons();
    });
    splendorNobles.appendChild(nobleEl);
  });
  if (!nobles.length) {
    const empty = document.createElement("div");
    empty.className = "splendor-card";
    empty.textContent = "-";
    splendorNobles.appendChild(empty);
  }
}

function renderSplendorReserved(view) {
  if (!splendorReserved) {
    return;
  }
  splendorReserved.innerHTML = "";
  const cards = view.your_reserved || [];
  cards.forEach((card, index) => {
    const selected = splendorSelectedReserved === index;
    const cardEl = createSplendorCard(card, selected);
    cardEl.addEventListener("click", () => {
      splendorSelectedReserved = index;
      splendorSelectedMarket = null;
      updateSplendorSelectionLabels();
      renderSplendorMarket(view);
      renderSplendorReserved(view);
      renderSplendorDiscardSelection();
      updateSplendorDiscardHint(view);
      updateSplendorActionButtons();
    });
    splendorReserved.appendChild(cardEl);
  });
  if (!cards.length) {
    const empty = document.createElement("div");
    empty.className = "splendor-card";
    empty.textContent = "-";
    splendorReserved.appendChild(empty);
  }
}

function renderSplendorPlayers(view) {
  if (!splendorPlayers) {
    return;
  }
  splendorPlayers.innerHTML = "";
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
    const youTag = player.player_id === view.you ? " (you)" : "";
    name.textContent = `${player.name || player.player_id}${youTag}`;
    const score = document.createElement("div");
    score.className = "badge";
    score.textContent = `Score ${player.score}`;
    header.appendChild(name);
    header.appendChild(score);
    card.appendChild(header);

    const bonuses = splendorBaseColors
      .map((color) => `${splendorColorLabels[color] || color}${(player.bonuses && player.bonuses[color]) || 0}`)
      .join(" ");
    const playerNobles = Array.isArray(player.nobles) ? player.nobles : [];
    const noblesCount = playerNobles.length;

    const meta = document.createElement("div");
    meta.className = "player-meta";
    const tokensLine = document.createElement("div");
    tokensLine.className = "splendor-token-row";
    splendorColors.forEach((color) => {
      const token = document.createElement("div");
      token.className = `splendor-token gem-${color}`;
      const count = (player.tokens && player.tokens[color]) || 0;
      token.textContent = `${splendorColorLabels[color] || color}${count}`;
      tokensLine.appendChild(token);
    });
    const bonusesLine = document.createElement("div");
    bonusesLine.textContent = `Bonuses: ${bonuses}`;
    const purchasedCards = Array.isArray(player.purchased) ? player.purchased : [];
    const purchasedCount = typeof player.purchased_count === "number" ? player.purchased_count : purchasedCards.length;
    const countsLine = document.createElement("div");
    countsLine.textContent = `Reserved: ${player.reserved_count} | Purchased: ${purchasedCount} | Nobles: ${noblesCount}`;
    meta.appendChild(tokensLine);
    meta.appendChild(bonusesLine);
    meta.appendChild(countsLine);
    card.appendChild(meta);

    const purchasedSection = document.createElement("div");
    purchasedSection.className = "splendor-player-purchased";
    const purchasedTitle = document.createElement("div");
    purchasedTitle.className = "splendor-player-purchased-title";
    purchasedTitle.textContent = "Purchased Cards";
    purchasedSection.appendChild(purchasedTitle);
    const purchasedList = document.createElement("div");
    purchasedList.className = "splendor-cards splendor-player-purchased-list";
    if (purchasedCards.length) {
      purchasedCards.forEach((cardData) => {
        const cardEl = createSplendorCard(cardData, false, { compact: true });
        purchasedList.appendChild(cardEl);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "splendor-player-empty";
      empty.textContent = "-";
      purchasedList.appendChild(empty);
    }
    purchasedSection.appendChild(purchasedList);
    card.appendChild(purchasedSection);

    const noblesSection = document.createElement("div");
    noblesSection.className = "splendor-player-purchased";
    const noblesTitle = document.createElement("div");
    noblesTitle.className = "splendor-player-purchased-title";
    noblesTitle.textContent = "Nobles";
    noblesSection.appendChild(noblesTitle);
    const noblesList = document.createElement("div");
    noblesList.className = "splendor-cards splendor-player-purchased-list";
    if (playerNobles.length) {
      playerNobles.forEach((nobleId) => {
        const nobleData = splendorNobleCatalog[nobleId] || { id: nobleId };
        const nobleEl = createSplendorNobleCard(nobleData, false, { compact: true });
        noblesList.appendChild(nobleEl);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "splendor-player-empty";
      empty.textContent = "-";
      noblesList.appendChild(empty);
    }
    noblesSection.appendChild(noblesList);
    card.appendChild(noblesSection);
    splendorPlayers.appendChild(card);
  });
}

function renderSplendorGameState(data) {
  const view = data.view;
  currentSplendorView = view;
  if (currentGameType !== "splendor") {
    currentGameType = "splendor";
    setGamePanelVisibility("splendor");
  }

  if (splendorSelectedMarket && !getSelectedMarketCard(view)) {
    splendorSelectedMarket = null;
  }
  if (splendorSelectedReserved !== null && !getSelectedReservedCard(view)) {
    splendorSelectedReserved = null;
  }
  if (splendorSelectedNoble && !(view.nobles || []).some((noble) => noble.id === splendorSelectedNoble)) {
    splendorSelectedNoble = null;
  }

  if (splendorPhaseLabel) {
    splendorPhaseLabel.textContent = view.phase || "-";
  }
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  if (splendorTurnLabel) {
    splendorTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (splendorFinalRoundLabel) {
    if (view.final_round && view.final_round.active) {
      const triggerName = view.final_round.triggered_by ? findPlayerName(view, view.final_round.triggered_by) : "-";
      splendorFinalRoundLabel.textContent = `Yes (${triggerName})`;
    } else {
      splendorFinalRoundLabel.textContent = "No";
    }
  }
  if (splendorWinnerLabel) {
    if (view.winner && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      splendorWinnerLabel.textContent = names.join(", ");
    } else {
      splendorWinnerLabel.textContent = "-";
    }
  }

  updateSplendorSelectionLabels();
  renderSplendorSupply(view);
  renderSplendorMarket(view);
  renderSplendorNobles(view);
  renderSplendorReserved(view);
  renderSplendorPlayers(view);
  renderSplendorTokenSelection();
  renderSplendorDiscardSelection();
  updateSplendorDiscardHint(view);

  logGameEvents(data);
  updateSplendorActionButtons();
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

function renderBlokusGameState(data) {
  const view = data.view;
  currentBlokusView = view;
  if (currentGameType !== "blokus") {
    currentGameType = "blokus";
    setGamePanelVisibility("blokus");
  }
  if (blokusStatusLabel) {
    blokusStatusLabel.textContent = view.game_over ? "game over" : "in progress";
  }
  if (blokusTurnLabel) {
    const currentPlayer = (view.players || []).find((p) => p.player_id === view.current_turn);
    blokusTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (blokusWinnerLabel) {
    if (view.winner && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      blokusWinnerLabel.textContent = names.join(", ");
    } else {
      blokusWinnerLabel.textContent = "-";
    }
  }
  if (!blokusSelectedOrigin && blokusOriginLabel) {
    blokusOriginLabel.textContent = "-";
  }

  renderBlokusBoard(view);
  renderBlokusPieces(view);
  renderBlokusPlayers(view);
  logGameEvents(data);
  updateBlokusActionButton();
}

function renderCaboGameState(data) {
  const view = data.view;
  currentCaboView = view;
  if (currentGameType !== "cabo") {
    currentGameType = "cabo";
    setGamePanelVisibility("cabo");
  }
  if (
    selectedTarget &&
    !view.players.find((p) => p.player_id === selectedTarget.playerId)
  ) {
    selectedTarget = null;
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
  renderTargets(view);

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

function getGoldRushHand(view) {
  if (!view || !Array.isArray(view.players)) {
    return [];
  }
  const you = view.players.find((player) => player.player_id === view.you);
  return you && Array.isArray(you.hand) ? you.hand : [];
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
    button.addEventListener("click", () => {
      goldRushSelectedHandIndex = index;
      renderGoldRushHand(view, mineNames);
      updateGoldRushSelectionLabel(view, mineNames);
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

function renderAidixitGameState(data) {
  const view = data.view;
  currentAidixitView = view;
  if (currentGameType !== "aidixit") {
    currentGameType = "aidixit";
    setGamePanelVisibility("aidixit");
  }
  if (
    aidixitSelectedHandCardId &&
    (!Array.isArray(view.hand) || !view.hand.some((card) => card.card_id === aidixitSelectedHandCardId))
  ) {
    aidixitSelectedHandCardId = null;
  }
  if (
    aidixitSelectedVoteCardId &&
    (!Array.isArray(view.pool_cards) || !view.pool_cards.some((card) => card.card_id === aidixitSelectedVoteCardId))
  ) {
    aidixitSelectedVoteCardId = null;
  }
  if (view.phase !== "vote") {
    aidixitSelectedVoteCardId = null;
  }

  if (aidixitPhaseLabel) {
    aidixitPhaseLabel.textContent = view.phase || "-";
  }
  if (aidixitRoundLabel) {
    aidixitRoundLabel.textContent = view.round ?? "-";
  }
  if (aidixitStorytellerLabel) {
    aidixitStorytellerLabel.textContent = view.storyteller_id
      ? findPlayerName(view, view.storyteller_id)
      : "-";
  }
  if (aidixitClueLabel) {
    aidixitClueLabel.textContent = view.clue || "-";
  }
  if (aidixitTargetScoreLabel) {
    aidixitTargetScoreLabel.textContent = view.target_score ?? "-";
  }
  if (aidixitDeckCountLabel) {
    aidixitDeckCountLabel.textContent = view.deck_count ?? "-";
  }
  if (aidixitDiscardCountLabel) {
    aidixitDiscardCountLabel.textContent = view.discard_count ?? "-";
  }
  if (aidixitSubmittedLabel) {
    aidixitSubmittedLabel.textContent = view.submitted ? "yes" : "no";
  }
  if (aidixitVotedLabel) {
    aidixitVotedLabel.textContent = view.voted ? "yes" : "no";
  }
  if (aidixitWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      aidixitWinnerLabel.textContent = names.join(", ");
    } else {
      aidixitWinnerLabel.textContent = "-";
    }
  }

  const isStoryteller = view.storyteller_id === view.you;
  if (aidixitClueInput) {
    const canEdit = !view.game_over && view.phase === "story" && isStoryteller;
    aidixitClueInput.disabled = !canEdit;
    if (!canEdit) {
      aidixitClueInput.value = "";
    }
  }

  renderAidixitHand(view);
  renderAidixitPool(view);
  renderAidixitPlayers(view);
  renderAidixitRoundNotice(view);
  logGameEvents(data);
  updateAidixitButtons();
}

function renderDrawGuessGameState(data) {
  const view = data.view;
  currentDrawGuessView = view;
  if (currentGameType !== "draw_guess") {
    currentGameType = "draw_guess";
    setGamePanelVisibility("draw_guess");
  }

  drawGuessPhaseLabel.textContent = view.phase || "-";
  drawGuessRoundLabel.textContent = view.round ?? "-";
  drawGuessTotalRoundsLabel.textContent = view.total_rounds ?? "-";
  drawGuessSubmittedLabel.textContent = view.submitted ? "yes" : "no";

  renderDrawGuessPlayers(view);
  logGameEvents(data);

  if (view.phase === "draw") {
    drawGuessPromptRow.classList.remove("hidden");
    drawGuessPromptLabel.textContent = view.current_prompt || "-";
    drawGuessDrawArea.classList.remove("hidden");
    drawGuessGuessArea.classList.add("hidden");
    drawGuessReview.classList.add("hidden");
    if (drawGuessAnswerLengthHintRow) {
      drawGuessAnswerLengthHintRow.classList.add("hidden");
    }
    drawGuessInput.disabled = true;
    if (drawGuessLastRound !== view.round) {
      clearDrawGuessCanvas();
      setDrawGuessTool(false);
    }
    drawGuessCanvas.style.pointerEvents = view.submitted ? "none" : "auto";
  } else if (view.phase === "guess") {
    drawGuessPromptRow.classList.add("hidden");
    drawGuessDrawArea.classList.add("hidden");
    drawGuessGuessArea.classList.remove("hidden");
    drawGuessReview.classList.add("hidden");
    if (drawGuessLastPhase !== view.phase) {
      drawGuessInput.value = "";
    }
    if (view.current_drawing) {
      drawGuessImage.src = view.current_drawing;
    } else {
      drawGuessImage.removeAttribute("src");
    }
    const hasAnswerLength = Number.isFinite(view.answer_length);
    if (drawGuessAnswerLengthLabel) {
      drawGuessAnswerLengthLabel.textContent = hasAnswerLength ? `${view.answer_length}` : "-";
    }
    if (drawGuessAnswerLengthHintRow) {
      drawGuessAnswerLengthHintRow.classList.toggle("hidden", !hasAnswerLength);
    }
    drawGuessInput.disabled = view.submitted;
    drawGuessCanvas.style.pointerEvents = "none";
  } else if (view.phase === "review") {
    drawGuessPromptRow.classList.add("hidden");
    drawGuessDrawArea.classList.add("hidden");
    drawGuessGuessArea.classList.add("hidden");
    if (drawGuessAnswerLengthHintRow) {
      drawGuessAnswerLengthHintRow.classList.add("hidden");
    }
    drawGuessInput.disabled = true;
    drawGuessCanvas.style.pointerEvents = "none";
    renderDrawGuessReview(view);
  } else {
    drawGuessDrawArea.classList.add("hidden");
    drawGuessGuessArea.classList.add("hidden");
    drawGuessReview.classList.add("hidden");
    if (drawGuessAnswerLengthHintRow) {
      drawGuessAnswerLengthHintRow.classList.add("hidden");
    }
    drawGuessCanvas.style.pointerEvents = "none";
  }

  drawGuessLastRound = view.round;
  drawGuessLastPhase = view.phase;
  updateDrawGuessButtons();
}

function renderImpressionGameState(data) {
  const view = data.view;
  currentImpressionView = view;
  if (currentGameType !== "impression_flower") {
    currentGameType = "impression_flower";
    setGamePanelVisibility("impression_flower");
  }
  hideImpressionRotateControls();

  if (view && view.config) {
    applyImpressionConfig(view.config);
  }

  if (impressionPhaseLabel) {
    impressionPhaseLabel.textContent = view.phase || "-";
  }
  if (impressionRoundLabel) {
    impressionRoundLabel.textContent = view.round ?? "-";
  }
  if (impressionRoundsPerGuesserLabel) {
    impressionRoundsPerGuesserLabel.textContent = view.rounds_per_guesser ?? "-";
  }
  if (impressionGuesserLabel) {
    impressionGuesserLabel.textContent = view.guesser_name || "-";
  }

  const isGuesser = view.guesser_id && view.you === view.guesser_id;
  if (impressionRoleLabel) {
    impressionRoleLabel.textContent = isGuesser ? "Guesser" : "Setter";
  }

  let yourScore = "-";
  if (view.scores && view.you && view.scores[view.you] !== undefined) {
    yourScore = view.scores[view.you];
  } else if (Array.isArray(view.players)) {
    const you = view.players.find((p) => p.player_id === view.you);
    if (you && you.score !== undefined) {
      yourScore = you.score;
    }
  }
  if (impressionScoreLabel) {
    impressionScoreLabel.textContent = yourScore;
  }

  if (impressionPromptRow) {
    impressionPromptRow.classList.toggle("hidden", !view.prompt_word);
  }
  if (impressionPromptLabel) {
    impressionPromptLabel.textContent = view.prompt_word || "-";
  }

  const newRound = impressionLastRound !== view.round;
  const phaseChanged = impressionLastPhase !== view.phase;

  if (view.phase === "draw") {
    if (impressionDrawArea) {
      impressionDrawArea.classList.remove("hidden");
    }
    if (impressionGuessArea) {
      impressionGuessArea.classList.add("hidden");
    }
    if (impressionRoundEnd) {
      impressionRoundEnd.classList.add("hidden");
    }
    if (newRound || impressionLastPhase !== "draw") {
      impressionStampHistory = [];
      impressionStampsMax = Number.parseInt(view.stamps_this_round, 10) || 0;
      impressionStampsLeft = impressionStampsMax;
      clearImpressionCanvas();
      renderImpressionCanvas();
      setImpressionMaskActive(false);
      impressionMaskTarget = null;
      setImpressionActiveStampIndex(null);
    }
    if (impressionStampsLeftLabel) {
      impressionStampsLeftLabel.textContent = isGuesser ? "-" : `${impressionStampsLeft}`;
    }
    if (impressionCanvas) {
      impressionCanvas.style.pointerEvents = isImpressionActionAvailable("submit_drawing") ? "auto" : "none";
    }
  } else if (view.phase === "guess") {
    stopImpressionPreviewLoop();
    if (impressionDrawArea) {
      impressionDrawArea.classList.add("hidden");
    }
    if (impressionGuessArea) {
      impressionGuessArea.classList.remove("hidden");
    }
    if (impressionRoundEnd) {
      impressionRoundEnd.classList.add("hidden");
    }
    if (phaseChanged) {
      impressionMatches = {};
      impressionSelectedWord = null;
    }
    renderImpressionWordBank(view);
    renderImpressionDrawings(view);
    if (impressionStampsLeftLabel) {
      impressionStampsLeftLabel.textContent = "-";
    }
  } else if (view.phase === "round_end") {
    stopImpressionPreviewLoop();
    if (impressionDrawArea) {
      impressionDrawArea.classList.add("hidden");
    }
    if (impressionGuessArea) {
      impressionGuessArea.classList.add("hidden");
    }
    if (impressionRoundEnd) {
      impressionRoundEnd.classList.remove("hidden");
    }
    renderImpressionRoundResult(view);
    if (impressionStampsLeftLabel) {
      impressionStampsLeftLabel.textContent = "-";
    }
  } else if (view.phase === "game_over") {
    stopImpressionPreviewLoop();
    if (impressionDrawArea) {
      impressionDrawArea.classList.add("hidden");
    }
    if (impressionGuessArea) {
      impressionGuessArea.classList.add("hidden");
    }
    if (impressionRoundEnd) {
      impressionRoundEnd.classList.remove("hidden");
    }
    renderImpressionRoundResult(view);
    if (impressionStampsLeftLabel) {
      impressionStampsLeftLabel.textContent = "-";
    }
  } else {
    stopImpressionPreviewLoop();
    if (impressionDrawArea) {
      impressionDrawArea.classList.add("hidden");
    }
    if (impressionGuessArea) {
      impressionGuessArea.classList.add("hidden");
    }
    if (impressionRoundEnd) {
      impressionRoundEnd.classList.add("hidden");
    }
  }

  renderImpressionPlayers(view);
  logGameEvents(data);
  impressionLastRound = view.round;
  impressionLastPhase = view.phase;
  updateImpressionRotateControls();
  updateImpressionButtons();
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
  if (gameType === "gold_rush") {
    renderGoldRushGameState(data);
    return;
  }
  if (gameType === "skull") {
    renderSkullGameState(data);
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

if (seatClaimCloseBtn) {
  seatClaimCloseBtn.addEventListener("click", () => {
    closeSeatClaimModal();
  });
}

if (aidixitZoomCloseBtn) {
  aidixitZoomCloseBtn.addEventListener("click", () => {
    closeAidixitZoom();
  });
}

if (aidixitZoomModal) {
  aidixitZoomModal.addEventListener("click", (event) => {
    if (event.target === aidixitZoomModal) {
      closeAidixitZoom();
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

clearTargetBtn.addEventListener("click", () => {
  clearTargetSelection();
});

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

document.getElementById("drawDiscardBtn").addEventListener("click", () => {
  if (!selectedSlots.length) {
    log("Select a slot to replace from discard");
    return;
  }
  sendAction({ type: "draw_discard", slot: selectedSlots[0] });
  clearSelection();
});

document.getElementById("replaceBtn").addEventListener("click", () => {
  if (!selectedSlots.length) {
    log("Select a slot to replace");
    return;
  }
  sendAction({ type: "replace_card", slot: selectedSlots[0] });
  clearSelection();
});

document.getElementById("discardDrawnBtn").addEventListener("click", () => {
  sendAction({ type: "discard_drawn" });
});

document.getElementById("matchBtn").addEventListener("click", () => {
  if (selectedSlots.length < 2) {
    log("Select 2-4 slots for match");
    return;
  }
  sendAction({ type: "attempt_match", slots: selectedSlots.slice(0, 4) });
  clearSelection();
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

if (goldRushClearSelectionBtn) {
  goldRushClearSelectionBtn.addEventListener("click", () => {
    goldRushSelectedHandIndex = null;
    updateGoldRushSelectionLabel(currentGoldRushView || {});
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

if (aidixitClueInput) {
  aidixitClueInput.addEventListener("input", () => updateAidixitButtons());
}

if (aidixitSubmitStoryBtn) {
  aidixitSubmitStoryBtn.addEventListener("click", () => {
    if (!currentAidixitView) {
      log("Game not ready");
      return;
    }
    const cardId = aidixitSelectedHandCardId;
    if (!cardId) {
      log("Select a card");
      return;
    }
    const clue = aidixitClueInput ? aidixitClueInput.value.trim() : "";
    if (!clue) {
      log("Enter a clue");
      return;
    }
    sendAction({ type: "submit_story", card_id: cardId, clue });
    aidixitSelectedHandCardId = null;
    if (aidixitClueInput) {
      aidixitClueInput.value = "";
    }
    updateAidixitButtons();
  });
}

if (aidixitSubmitCardBtn) {
  aidixitSubmitCardBtn.addEventListener("click", () => {
    if (!currentAidixitView) {
      log("Game not ready");
      return;
    }
    const cardId = aidixitSelectedHandCardId;
    if (!cardId) {
      log("Select a card");
      return;
    }
    sendAction({ type: "submit_card", card_id: cardId });
    aidixitSelectedHandCardId = null;
    updateAidixitButtons();
  });
}

if (aidixitSubmitVoteBtn) {
  aidixitSubmitVoteBtn.addEventListener("click", () => {
    if (!currentAidixitView) {
      log("Game not ready");
      return;
    }
    const cardId = aidixitSelectedVoteCardId;
    if (!cardId) {
      log("Select a card to vote");
      return;
    }
    if (cardId === currentAidixitView.your_submission) {
      log("Cannot vote for your own card");
      return;
    }
    sendAction({ type: "submit_vote", card_id: cardId });
    aidixitSelectedVoteCardId = null;
    updateAidixitButtons();
  });
}

drawGuessClearBtn.addEventListener("click", () => {
  if (!confirm("确定删除吗？")) {
    return;
  }
  clearDrawGuessCanvas();
});

if (drawGuessEraserBtn) {
  drawGuessEraserBtn.addEventListener("click", () => {
    setDrawGuessTool(!drawGuessIsErasing);
  });
}

if (drawGuessColorButtons.length) {
  drawGuessColorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const color = button.dataset.color;
      if (color) {
        setDrawGuessColor(color);
      }
    });
  });
}

if (drawGuessBrushButtons.length) {
  drawGuessBrushButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const size = Number.parseFloat(button.dataset.size);
      if (Number.isFinite(size)) {
        setDrawGuessBrushSize(size);
      }
    });
  });
}

drawGuessSubmitDrawBtn.addEventListener("click", () => {
  if (!drawGuessCanvas) {
    return;
  }
  sendAction({ type: "submit_drawing", image_data: drawGuessCanvas.toDataURL("image/png") });
});

drawGuessSubmitGuessBtn.addEventListener("click", () => {
  const guess = drawGuessInput.value.trim();
  if (!guess) {
    log("Enter a guess");
    return;
  }
  sendAction({ type: "submit_guess", text: guess });
});

drawGuessInput.addEventListener("input", () => {
  updateDrawGuessButtons();
});

if (drawGuessRestartBtn) {
  drawGuessRestartBtn.addEventListener("click", () => {
    emitRoomStart();
  });
}

if (impressionRotationInput) {
  impressionRotationInput.addEventListener("input", () => {
    const value = Number.parseFloat(impressionRotationInput.value);
    const stamp = getImpressionActiveStamp();
    const applyToActive = !!stamp && impressionPressStart === null && !impressionDraggingStamp;
    setImpressionRotationValue(value, applyToActive);
  });
}

bindImpressionRotateButton(impressionRotateLeftBtn, -1);
bindImpressionRotateButton(impressionRotateRightBtn, 1);

if (impressionMaskBtn) {
  impressionMaskBtn.addEventListener("click", () => {
    if (!isImpressionActionAvailable("submit_drawing")) {
      return;
    }
    const activeStamp = getImpressionActiveStamp();
    const canApplyToActive =
      !!activeStamp && !activeStamp.mask_used && impressionPressStart === null && !impressionDraggingStamp;
    if (impressionMaskActive) {
      if (impressionMaskTarget === "active" && canApplyToActive) {
        applyImpressionMaskToActiveStamp();
      }
      setImpressionMaskActive(false);
      impressionMaskTarget = null;
      updateImpressionButtons();
      return;
    }
    if (canApplyToActive) {
      impressionMaskTarget = "active";
    } else {
      impressionMaskTarget = "next";
    }
    setImpressionMaskActive(true);
  });
}

if (impressionMaskRotationInput) {
  impressionMaskRotationInput.addEventListener("input", () => {
    if (!impressionMaskState) {
      return;
    }
    impressionMaskState.rotation = Number.parseFloat(impressionMaskRotationInput.value) || 0;
    updateImpressionMaskElement();
  });
}

if (impressionMaskScaleInput) {
  impressionMaskScaleInput.addEventListener("input", () => {
    if (!impressionMaskState) {
      return;
    }
    const scale = Number.parseFloat(impressionMaskScaleInput.value);
    impressionMaskState.scale = Number.isFinite(scale) ? scale : 1;
    updateImpressionMaskElement();
  });
}

if (impressionUndoBtn) {
  impressionUndoBtn.addEventListener("click", () => {
    if (!impressionStampHistory.length) {
      return;
    }
    impressionStampHistory.pop();
    setImpressionActiveStampIndex(impressionStampHistory.length - 1);
    impressionStampsLeft = Math.min(impressionStampsLeft + 1, impressionStampsMax);
    if (impressionStampsLeftLabel) {
      impressionStampsLeftLabel.textContent = `${impressionStampsLeft}`;
    }
    renderImpressionCanvas();
    updateImpressionButtons();
  });
}

if (impressionSubmitDrawBtn) {
  impressionSubmitDrawBtn.addEventListener("click", () => {
    if (!impressionCanvas) {
      return;
    }
    sendAction({ type: "submit_drawing", image_data: impressionCanvas.toDataURL("image/png") });
  });
}

if (impressionSubmitMatchesBtn) {
  impressionSubmitMatchesBtn.addEventListener("click", () => {
    if (!currentImpressionView) {
      return;
    }
    const drawings = Array.isArray(currentImpressionView.drawings) ? currentImpressionView.drawings : [];
    if (!drawings.length) {
      log("No drawings to match");
      return;
    }
    if (!impressionMatchesComplete(currentImpressionView)) {
      log("Match all drawings before submitting");
      return;
    }
    const matches = drawings.map((drawing) => ({
      drawing_id: drawing.drawing_id,
      word: impressionMatches[drawing.drawing_id],
    }));
    sendAction({ type: "submit_matches", matches });
  });
}

if (impressionContinueBtn) {
  impressionContinueBtn.addEventListener("click", () => {
    sendAction({ type: "continue_game" });
  });
}

if (impressionEndBtn) {
  impressionEndBtn.addEventListener("click", () => {
    sendAction({ type: "end_game" });
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

if (splendorClearSelectionBtn) {
  splendorClearSelectionBtn.addEventListener("click", () => {
    clearSplendorSelection();
  });
}

if (splendorTakeThreeBtn) {
  splendorTakeThreeBtn.addEventListener("click", () => {
    const colors = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 1);
    if (colors.length !== 3 || splendorTokenSelectionTotal() !== 3) {
      log("Select exactly 3 different gem colors");
      return;
    }
    const action = { type: "take_tokens", colors };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "take_tokens");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    resetSplendorTokenSelection();
    resetSplendorDiscardSelection();
    renderSplendorTokenSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorTakeTwoBtn) {
  splendorTakeTwoBtn.addEventListener("click", () => {
    const colors = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 2);
    if (colors.length !== 1 || splendorTokenSelectionTotal() !== 2) {
      log("Select exactly 2 of the same gem color");
      return;
    }
    const action = { type: "take_tokens_same", color: colors[0] };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "take_tokens_same");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    resetSplendorTokenSelection();
    resetSplendorDiscardSelection();
    renderSplendorTokenSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorReserveMarketBtn) {
  splendorReserveMarketBtn.addEventListener("click", () => {
    if (!splendorSelectedMarket) {
      log("Select a market card to reserve");
      return;
    }
    const action = {
      type: "reserve_market",
      tier: splendorSelectedMarket.tier,
      index: splendorSelectedMarket.index,
    };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "reserve_market");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    splendorSelectedMarket = null;
    resetSplendorDiscardSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

if (splendorReserveDeckBtn) {
  splendorReserveDeckBtn.addEventListener("click", () => {
    const tier = splendorReserveTierSelect ? splendorReserveTierSelect.value : "tier1";
    const action = { type: "reserve_deck", tier };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "reserve_deck");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    resetSplendorDiscardSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorBuyMarketBtn) {
  splendorBuyMarketBtn.addEventListener("click", () => {
    const card = getSelectedMarketCard(currentSplendorView);
    if (!splendorSelectedMarket || !card) {
      log("Select a market card to buy");
      return;
    }
    const you = getSplendorYou(currentSplendorView);
    const payment = splendorAutoPayment(card, you);
    if (!payment) {
      log("Not enough tokens to buy this card");
      return;
    }
    sendAction({
      type: "buy_market",
      tier: splendorSelectedMarket.tier,
      index: splendorSelectedMarket.index,
      payment,
    });
    splendorSelectedMarket = null;
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

if (splendorBuyReservedBtn) {
  splendorBuyReservedBtn.addEventListener("click", () => {
    const card = getSelectedReservedCard(currentSplendorView);
    if (splendorSelectedReserved === null || !card) {
      log("Select a reserved card to buy");
      return;
    }
    const you = getSplendorYou(currentSplendorView);
    const payment = splendorAutoPayment(card, you);
    if (!payment) {
      log("Not enough tokens to buy this card");
      return;
    }
    sendAction({
      type: "buy_reserved",
      reserved_index: splendorSelectedReserved,
      payment,
    });
    splendorSelectedReserved = null;
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

if (splendorDiscardBtn) {
  splendorDiscardBtn.addEventListener("click", () => {
    if (splendorTokenSelectionTotal() <= 0) {
      log("Select tokens to discard");
      return;
    }
    sendAction({ type: "discard_tokens", tokens: { ...splendorTokenSelection } });
    resetSplendorTokenSelection();
    resetSplendorDiscardSelection();
    renderSplendorTokenSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorChooseNobleBtn) {
  splendorChooseNobleBtn.addEventListener("click", () => {
    if (!splendorSelectedNoble) {
      log("Select a noble to take");
      return;
    }
    sendAction({ type: "choose_noble", noble_id: splendorSelectedNoble });
    splendorSelectedNoble = null;
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

if (blokusRotateLeftBtn) {
  blokusRotateLeftBtn.addEventListener("click", () => {
    blokusRotation = (blokusRotation + 270) % 360;
    if (currentBlokusView) {
      renderBlokusBoard(currentBlokusView);
    }
    updateBlokusActionButton();
  });
}

if (blokusRotateRightBtn) {
  blokusRotateRightBtn.addEventListener("click", () => {
    blokusRotation = (blokusRotation + 90) % 360;
    if (currentBlokusView) {
      renderBlokusBoard(currentBlokusView);
    }
    updateBlokusActionButton();
  });
}

if (blokusFlipBtn) {
  blokusFlipBtn.addEventListener("click", () => {
    blokusFlip = !blokusFlip;
    if (currentBlokusView) {
      renderBlokusBoard(currentBlokusView);
    }
    updateBlokusActionButton();
  });
}

if (blokusNudgeUpBtn) {
  blokusNudgeUpBtn.addEventListener("click", () => {
    nudgeBlokusOrigin(0, -1);
  });
}

if (blokusNudgeLeftBtn) {
  blokusNudgeLeftBtn.addEventListener("click", () => {
    nudgeBlokusOrigin(-1, 0);
  });
}

if (blokusNudgeDownBtn) {
  blokusNudgeDownBtn.addEventListener("click", () => {
    nudgeBlokusOrigin(0, 1);
  });
}

if (blokusNudgeRightBtn) {
  blokusNudgeRightBtn.addEventListener("click", () => {
    nudgeBlokusOrigin(1, 0);
  });
}

if (blokusBoard) {
  blokusBoard.addEventListener("pointerdown", handleBlokusPointerDown);
  blokusBoard.addEventListener("pointermove", handleBlokusPointerMove);
  blokusBoard.addEventListener("pointerup", handleBlokusPointerUp);
  blokusBoard.addEventListener("pointercancel", handleBlokusPointerUp);
}

document.addEventListener("pointerup", handleBlokusPointerUp);
document.addEventListener("pointercancel", handleBlokusPointerUp);

if (blokusPlaceBtn) {
  blokusPlaceBtn.addEventListener("click", () => {
    if (!currentBlokusView || !Array.isArray(currentBlokusView.legal_actions)) {
      return;
    }
    if (!currentBlokusView.legal_actions.includes("place_piece")) {
      log("Not your turn");
      return;
    }
    if (!blokusSelectedPieceId) {
      log("Select a piece");
      return;
    }
    if (!blokusSelectedOrigin) {
      log("Select an origin cell");
      return;
    }
    sendAction({
      type: "place_piece",
      piece_id: blokusSelectedPieceId,
      rotation: blokusRotation,
      flip: blokusFlip,
      x: blokusSelectedOrigin.x,
      y: blokusSelectedOrigin.y,
    });
    blokusSelectedOrigin = null;
    if (blokusOriginLabel) {
      blokusOriginLabel.textContent = "-";
    }
    if (currentBlokusView) {
      renderBlokusBoard(currentBlokusView);
    }
    updateBlokusActionButton();
  });
}

if (blokusGiveUpBtn) {
  blokusGiveUpBtn.addEventListener("click", () => {
    if (!currentBlokusView || !Array.isArray(currentBlokusView.legal_actions)) {
      return;
    }
    if (!currentBlokusView.legal_actions.includes("give_up")) {
      log("Not your turn");
      return;
    }
    sendAction({ type: "give_up" });
    updateBlokusActionButton();
  });
}

setupDrawGuessCanvas();
setupImpressionCanvas();

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

if (copyStateBtn) {
  copyStateBtn.addEventListener("click", () => {
    copyGameStateSnapshot();
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
