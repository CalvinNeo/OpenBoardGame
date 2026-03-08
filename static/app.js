
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
const carcPhaseLabel = document.getElementById("carcPhase");
const carcTurnLabel = document.getElementById("carcTurn");
const carcRemainingLabel = document.getElementById("carcRemaining");
const carcWinnerLabel = document.getElementById("carcWinner");
const carcPendingLabel = document.getElementById("carcPendingLabel");
const carcRotationLabel = document.getElementById("carcRotationLabel");
const carcRotateLeftBtn = document.getElementById("carcRotateLeftBtn");
const carcRotateRightBtn = document.getElementById("carcRotateRightBtn");
const carcSkipMeepleBtn = document.getElementById("carcSkipMeepleBtn");
const carcBoard = document.getElementById("carcBoard");
const carcPendingTile = document.getElementById("carcPendingTile");
const carcMeepleOptions = document.getElementById("carcMeepleOptions");
const carcMeepleHint = document.getElementById("carcMeepleHint");
const carcMeepleSelection = document.getElementById("carcMeepleSelection");
const carcConfirmMeepleBtn = document.getElementById("carcConfirmMeepleBtn");
const carcClearMeepleBtn = document.getElementById("carcClearMeepleBtn");
const carcPlayers = document.getElementById("carcPlayers");
const socket = io();

let playerId = null;
let roomId = null;
let currentCaboView = null;
let currentSkullView = null;
let currentCatInBoxView = null;
let currentMismatchView = null;
let currentCoyoteView = null;
let currentDecryptoView = null;
let currentDrawGuessView = null;
let currentBlitzSketchView = null;
let currentCyberView = null;
let currentFlip7View = null;
let currentYahtzeeView = null;
let currentGoldRushView = null;
let currentIncanGoldView = null;
let currentKobayakawaView = null;
let currentHalliView = null;
let currentHanabiView = null;
let currentGangView = null;
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
let currentImpressionView = null;
let currentSplendorView = null;
let currentPointSaladView = null;
let currentAbracaView = null;
let currentBlokusView = null;
let currentProjectLView = null;
let currentCarcassonneView = null;
let currentFangNiaoView = null;
let currentAidixitView = null;
let currentTrekkingView = null;
let currentGameType = null;
let carcTemplateData = null;
let carcTemplatePromise = null;
let carcTemplateCache = {};
let carcCellMap = new Map();
let carcHoverTiles = new Set();
let carcHoverKey = null;
let carcSelectedTiles = new Set();
let carcSelectedMeeple = null;
let carcSegmentImageCache = new Map();
let carcMeepleOptionSet = new Set();
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
let hanabiSelectedCardIndex = null;
let hanabiSelectedTargetId = null;
let hanabiSelectedClueType = "color";
let hanabiSelectedClueValue = null;
let skullSelectedCardIndex = null;
let skullSelectedCardType = null;
let skullSelectedTarget = null;
let fangNiaoSelectedBird = null;
let fangNiaoSelectedRow = null;
let fangNiaoSelectedSide = null;
let catInBoxSelectedCard = null;
let catInBoxSelectedColor = null;
let drawGuessLastRound = null;
let drawGuessLastPhase = null;
let drawGuessIsDrawing = false;
let drawGuessHasDrawn = false;
let drawGuessIsErasing = false;
let drawGuessBrushColor = "#000000";
let drawGuessBrushSize = 3;
let blitzSketchIsDrawing = false;
let blitzSketchDrawDeadline = null;
let blitzSketchDrawTimer = null;
let blitzSketchCountdownTimer = null;
let blitzSketchActiveDrawIndex = null;
let blitzSketchSubmittedDrawIndex = null;
let blitzSketchRevealTimer = null;
let blitzSketchRevealUntil = null;
let cyberLastRound = null;
let cyberLastPhase = null;
let cyberLastToolIndex = null;
let cyberShoelacePaths = [];
let cyberShoelaceCurrentPath = null;
let cyberShoelaceDrawing = false;
let cyberPixelCells = [];
let cyberPixelSelectedColor = null;
let cyberIconItems = [];
let cyberIconDragging = null;
let cyberIconSelectedId = null;
let cyberLetterItems = [];
let cyberLetterDragging = null;
let cyberLetterSelectedId = null;
let cyberShapeItems = [];
let cyberShapeDragging = null;
let cyberShapeSelectedId = null;
let cyberThrusterPaths = [];
let cyberThrusterCurrentPath = null;
let cyberThrusterActive = false;
let cyberThrusterThrusting = false;
let cyberThrusterAttemptsLeft = 0;
let cyberThrusterFrame = null;
let cyberThrusterLastTs = null;
let cyberThrusterX = 0;
let cyberThrusterY = 0;
let cyberThrusterVelocity = 0;
let cyberThrusterWasOutside = false;
let cyberSynthValues = [];
let cyberSynthBarEls = [];
let cyberSynthSliderEls = [];
let cyberGuessSelections = {};
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
let pointSaladSelectedPile = null;
let pointSaladSelectedMarket = [];
let pointSaladSelectedFlips = new Set();
let blokusSelectedPieceId = null;
let blokusSelectedOrigin = null;
let blokusRotation = 0;
let blokusFlip = false;
let blokusDragState = null;
let projectLSelectedMarket = null;
let projectLSelectedPuzzleIndex = null;
let projectLSelectedPieceId = null;
let projectLSelectedOrigin = null;
let projectLRotation = 0;
let projectLFlip = false;
let projectLMasterQueueItems = [];
let trekkingSelectedSlot = null;
let trekkingLastDay = null;
let trekkingWildModalState = null;
let trekkingCrystalModalState = null;
let carcRotation = 0;
let carcPendingType = null;
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
const HANABI_COLORS = ["red", "yellow", "green", "blue", "white"];
const HANABI_RANKS = [1, 2, 3, 4, 5];
const HANABI_COLOR_LABELS = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  white: "White",
};
const HANABI_COLOR_SHORT = {
  red: "R",
  yellow: "Y",
  green: "G",
  blue: "B",
  white: "W",
};
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
const TREKKING_TOKEN_LABELS = {
  person: "🧑",
  event: "📜",
  innovation: "⚙️",
  progress: "🌱",
  wild: "✨",
  crystal: "💎",
};
const TREKKING_TOKEN_NAMES = {
  person: "Person",
  event: "Event",
  innovation: "Innovation",
  progress: "Progress",
  wild: "Wild",
  crystal: "Crystal",
};
const TREKKING_COLUMN_LABELS = ["Person", "Event", "Innovation", "Progress"];
const TREKKING_SLOT_REWARDS = ["-", "person", "event", "innovation", "progress", "crystal"];
const CYBER_TOOL_KEYS = [
  "shoelaces",
  "pixel_grid",
  "icon_set",
  "aeiou",
  "shape_stacker",
  "thruster",
  "synthesizer",
];
const CYBER_TOOL_LABELS = {
  shoelaces: "Shoelaces",
  pixel_grid: "Pixel Grid",
  icon_set: "Icon Set",
  aeiou: "AEIOU Collage",
  shape_stacker: "Shape Stacker",
  thruster: "Thruster",
  synthesizer: "Synthesizer",
};
const CYBER_COORDS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D1", "D2", "D3", "D4"];
const CYBER_PIXEL_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#000000", "#ffffff", "#8b5e34"];
const CYBER_ICON_SET = ["😀", "😺", "🌳", "🌞", "🏠", "🚗", "✈️", "⭐", "⚽", "🎧", "📚", "🍎", "🧩", "🎈", "🎮", "🎹", "🎲", "🧠", "🧸", "🕯️", "💡", "🔧", "🪜", "🔑", "📷", "🖌️", "📌", "🧭", "🌙", "☁️", "🔥", "💧", "🐶", "🐱", "🐦", "🐟", "🦋", "🐢", "🌻", "🌵", "🍕", "🍞", "🍩", "🍓", "☕", "🫖", "🚀", "🛸"];
const CYBER_CANVAS_SIZE = 360;
const CYBER_TEXT_SIZE = 36;
const CYBER_SHAPE_SPECS = {
  square: { w: 70, h: 70 },
  rectangle: { w: 90, h: 60 },
  triangle: { w: 90, h: 70 },
  circle: { w: 70, h: 70 },
  arch: { w: 90, h: 60 },
  ellipse: { w: 90, h: 60 },
  hexagon: { w: 90, h: 70 },
};
const CYBER_THRUSTER_MAX_ATTEMPTS = 3;
const CYBER_THRUSTER_COLOR = "#111111";
const CYBER_THRUSTER_STROKE = 4;
const CYBER_THRUSTER_CROSS_SEC = 6.5;
const CYBER_THRUSTER_GRAVITY_RATIO = 1.0;
const CYBER_THRUSTER_THRUST_RATIO = 2.0;
const CYBER_THRUSTER_RADIUS = 5;
const CYBER_THRUSTER_TOLERANCE = 20;
const CYBER_SYNTH_BARS = 10;
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
let decryptoWordPacks = [];
let decryptoPackSelections = new Set(["basic"]);
let decryptoPacksLoaded = false;
let decryptoBotStrategies = [];
let decryptoBotStrategiesLoaded = false;
let decryptoBotStrategyId = "native";
let decryptoBotClueDirectness = 0.5;
let cyberPicturesDisabledTools = new Set();
let currentRoomList = [];
let pendingSeatClaimRoomId = null;
let pendingSeatClaimSourceId = null;
let aidixitDecksLoaded = false;
let aidixitDecks = [];
let aidixitDeckSelections = new Set();
let aidixitSelectedHandCardId = null;
let aidixitSelectedVoteCardId = null;
let gangCountdownTimer = null;
let sixNimmtCountdownTimer = null;
let sixNimmtServerOffsetMs = 0;
let sixNimmtLastTimeoutAt = null;
let sixNimmtSummaryAckSent = false;
let gangServerOffsetMs = 0;
let gangAutoLockSent = false;
let gangSelectedSpyTarget = null;
let gangLastLockAt = null;
let gangLastDeadline = null;
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
const drawGuessConfigBox = document.getElementById("drawGuessConfigBox");
const drawGuessLanguageRow = document.getElementById("drawGuessLanguageRow");
const drawGuessLanguageSelect = document.getElementById("drawGuessLanguageSelect");
const drawGuessGuessMethodRow = document.getElementById("drawGuessGuessMethodRow");
const drawGuessGuessMethodSelect = document.getElementById("drawGuessGuessMethodSelect");
const drawGuessAnswerLengthOptionRow = document.getElementById("drawGuessAnswerLengthOptionRow");
const drawGuessAnswerLengthToggle = document.getElementById("drawGuessAnswerLengthToggle");
const cyberPicturesConfigBox = document.getElementById("cyberPicturesConfigBox");
const cyberPicturesDuplicateRow = document.getElementById("cyberPicturesDuplicateRow");
const cyberPicturesDuplicateToggle = document.getElementById("cyberPicturesDuplicateToggle");
const cyberPicturesToolRow = document.getElementById("cyberPicturesToolRow");
const cyberPicturesToolOptions = document.getElementById("cyberPicturesToolOptions");
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
const hanabiConfigBox = document.getElementById("hanabiConfigBox");
const hanabiFinalRoundRow = document.getElementById("hanabiFinalRoundRow");
const hanabiFinalRoundToggle = document.getElementById("hanabiFinalRoundToggle");
const mismatchConfigBox = document.getElementById("mismatchConfigBox");
const mismatchSliderCount = document.getElementById("mismatchSliderCount");
const gangConfigBox = document.getElementById("gangConfigBox");
const gangModeSelect = document.getElementById("gangModeSelect");
const gangTimeSelect = document.getElementById("gangTimeSelect");
const impressionConfigBox = document.getElementById("impressionConfigBox");
const impressionVoteRow = document.getElementById("impressionVoteRow");
const impressionVoteToggle = document.getElementById("impressionVoteToggle");
const blitzSketchConfigBox = document.getElementById("blitzSketchConfigBox");
const blitzSketchDrawTimeRow = document.getElementById("blitzSketchDrawTimeRow");
const blitzSketchDrawTimeSelect = document.getElementById("blitzSketchDrawTimeSelect");
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
const hanabiPanel = document.getElementById("hanabiPanel");
const gangPanel = document.getElementById("theGangPanel");
const mismatchPanel = document.getElementById("mismatchPanel");
const coyotePanel = document.getElementById("coyotePanel");
const sixNimmtPanel = document.getElementById("sixNimmtPanel");
const halliPanel = document.getElementById("halliPanel");
const decryptoPanel = document.getElementById("decryptoPanel");
const drawGuessPanel = document.getElementById("drawGuessPanel");
const blitzSketchPanel = document.getElementById("blitzSketchPanel");
const cyberPicturesPanel = document.getElementById("cyberPicturesPanel");
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

const hanabiTurnLabel = document.getElementById("hanabiTurn");
const hanabiCluesLabel = document.getElementById("hanabiClues");
const hanabiFusesLabel = document.getElementById("hanabiFuses");
const hanabiDeckLabel = document.getElementById("hanabiDeck");
const hanabiScoreLabel = document.getElementById("hanabiScore");
const hanabiFinalTurnsLabel = document.getElementById("hanabiFinalTurns");
const hanabiEndReasonLabel = document.getElementById("hanabiEndReason");
const hanabiTableau = document.getElementById("hanabiTableau");
const hanabiDiscardStats = document.getElementById("hanabiDiscardStats");
const hanabiHand = document.getElementById("hanabiHand");
const hanabiSelectedCardLabel = document.getElementById("hanabiSelectedCard");
const hanabiClearSelectionBtn = document.getElementById("hanabiClearSelection");
const hanabiPlayBtn = document.getElementById("hanabiPlayBtn");
const hanabiDiscardBtn = document.getElementById("hanabiDiscardBtn");
const hanabiTargetSelect = document.getElementById("hanabiTargetSelect");
const hanabiClueTypeSelect = document.getElementById("hanabiClueTypeSelect");
const hanabiClueValueSelect = document.getElementById("hanabiClueValueSelect");
const hanabiClueBtn = document.getElementById("hanabiClueBtn");
const hanabiPlayers = document.getElementById("hanabiPlayers");
const hanabiLog = document.getElementById("hanabiLog");
const gangPhaseLabel = document.getElementById("gangPhase");
const gangLevelLabel = document.getElementById("gangLevel");
const gangLivesLabel = document.getElementById("gangLives");
const gangTokensLabel = document.getElementById("gangTokens");
const gangModeLabel = document.getElementById("gangMode");
const gangMissionLabel = document.getElementById("gangMission");
const gangTimerLabel = document.getElementById("gangTimer");
const gangLockLabel = document.getElementById("gangLockTimer");
const gangCommunity = document.getElementById("gangCommunity");
const gangRanking = document.getElementById("gangRanking");
const gangRevealBtn = document.getElementById("gangRevealBtn");
const gangReadyBtn = document.getElementById("gangReadyBtn");
const gangLockBtn = document.getElementById("gangLockBtn");
const gangMulliganBtn = document.getElementById("gangMulliganBtn");
const gangSpyTargetSelect = document.getElementById("gangSpyTargetSelect");
const gangSpyBtn = document.getElementById("gangSpyBtn");
const gangNextRoundBtn = document.getElementById("gangNextRoundBtn");
const gangPlayAgainBtn = document.getElementById("gangPlayAgainBtn");
const gangRoundSummary = document.getElementById("gangRoundSummary");
const gangRoundSummaryTitle = document.getElementById("gangRoundSummaryTitle");
const gangRoundSummaryBody = document.getElementById("gangRoundSummaryBody");
const gangRoundSummaryList = document.getElementById("gangRoundSummaryList");
const gangPlayers = document.getElementById("gangPlayers");

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
const seatClaimModal = document.getElementById("seatClaimModal");
const seatClaimCloseBtn = document.getElementById("seatClaimCloseBtn");
const seatClaimNameHint = document.getElementById("seatClaimNameHint");
const seatClaimRoomLabel = document.getElementById("seatClaimRoomLabel");
const seatClaimList = document.getElementById("seatClaimList");
const seatClaimEmpty = document.getElementById("seatClaimEmpty");
const aidixitZoomModal = document.getElementById("aidixitZoomModal");
const aidixitZoomCloseBtn = document.getElementById("aidixitZoomCloseBtn");
const aidixitZoomImage = document.getElementById("aidixitZoomImage");
const projectLUpgradeModal = document.getElementById("projectLUpgradeModal");
const projectLUpgradeModalCloseBtn = document.getElementById("projectLUpgradeModalCloseBtn");
const projectLUpgradeFromLabel = document.getElementById("projectLUpgradeFromLabel");
const projectLUpgradeOptions = document.getElementById("projectLUpgradeOptions");
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

const blitzSketchPhaseLabel = document.getElementById("blitzSketchPhase");
const blitzSketchDrawProgressLabel = document.getElementById("blitzSketchDrawProgress");
const blitzSketchGuessProgressLabel = document.getElementById("blitzSketchGuessProgress");
const blitzSketchScoreLabel = document.getElementById("blitzSketchScore");
const blitzSketchPromptLabel = document.getElementById("blitzSketchPrompt");
const blitzSketchTimerLabel = document.getElementById("blitzSketchTimer");
const blitzSketchDrawArea = document.getElementById("blitzSketchDrawArea");
const blitzSketchGuessArea = document.getElementById("blitzSketchGuessArea");
const blitzSketchCanvas = document.getElementById("blitzSketchCanvas");
const blitzSketchImage = document.getElementById("blitzSketchImage");
const blitzSketchInput = document.getElementById("blitzSketchInput");
const blitzSketchSubmitGuessBtn = document.getElementById("blitzSketchSubmitGuessBtn");
const blitzSketchSkipBtn = document.getElementById("blitzSketchSkipBtn");
const blitzSketchFeedback = document.getElementById("blitzSketchFeedback");
const blitzSketchRevealRow = document.getElementById("blitzSketchRevealRow");
const blitzSketchRevealAnswer = document.getElementById("blitzSketchRevealAnswer");
const blitzSketchPlayers = document.getElementById("blitzSketchPlayers");
const blitzSketchReview = document.getElementById("blitzSketchReview");
const blitzSketchReviewGrid = document.getElementById("blitzSketchReviewGrid");
const blitzSketchCtx = blitzSketchCanvas ? blitzSketchCanvas.getContext("2d") : null;

const cyberPhaseLabel = document.getElementById("cyberPhase");
const cyberRoundLabel = document.getElementById("cyberRound");
const cyberTotalRoundsLabel = document.getElementById("cyberTotalRounds");
const cyberToolLabel = document.getElementById("cyberToolLabel");
const cyberTargetLabel = document.getElementById("cyberTargetLabel");
const cyberSubmittedLabel = document.getElementById("cyberSubmitted");
const cyberGuessedLabel = document.getElementById("cyberGuessed");
const cyberMatrixEl = document.getElementById("cyberMatrix");
const cyberCraftArea = document.getElementById("cyberCraftArea");
const cyberGuessArea = document.getElementById("cyberGuessArea");
const cyberScoreArea = document.getElementById("cyberScoreArea");
const cyberToolShoelaces = document.getElementById("cyberToolShoelaces");
const cyberShoelaceCanvas = document.getElementById("cyberShoelaceCanvas");
const cyberShoelaceUndoBtn = document.getElementById("cyberShoelaceUndoBtn");
const cyberShoelaceClearBtn = document.getElementById("cyberShoelaceClearBtn");
const cyberToolPixel = document.getElementById("cyberToolPixel");
const cyberPixelGrid = document.getElementById("cyberPixelGrid");
const cyberPixelPalette = document.getElementById("cyberPixelPalette");
const cyberToolIconSet = document.getElementById("cyberToolIconSet");
const cyberIconPalette = document.getElementById("cyberIconPalette");
const cyberIconCanvas = document.getElementById("cyberIconCanvas");
const cyberIconRemoveBtn = document.getElementById("cyberIconRemoveBtn");
const cyberIconClearBtn = document.getElementById("cyberIconClearBtn");
const cyberToolLetters = document.getElementById("cyberToolLetters");
const cyberLetterPalette = document.getElementById("cyberLetterPalette");
const cyberLetterCanvas = document.getElementById("cyberLetterCanvas");
const cyberLetterRotateBtn = document.getElementById("cyberLetterRotateBtn");
const cyberLetterRotate = document.getElementById("cyberLetterRotate");
const cyberLetterRotateValue = document.getElementById("cyberLetterRotateValue");
const cyberLetterRemoveBtn = document.getElementById("cyberLetterRemoveBtn");
const cyberLetterClearBtn = document.getElementById("cyberLetterClearBtn");
const cyberToolShapes = document.getElementById("cyberToolShapes");
const cyberShapePalette = document.getElementById("cyberShapePalette");
const cyberShapeCanvas = document.getElementById("cyberShapeCanvas");
const cyberShapeRotate = document.getElementById("cyberShapeRotate");
const cyberShapeRotateValue = document.getElementById("cyberShapeRotateValue");
const cyberShapeRemoveBtn = document.getElementById("cyberShapeRemoveBtn");
const cyberShapeClearBtn = document.getElementById("cyberShapeClearBtn");
const cyberToolThruster = document.getElementById("cyberToolThruster");
const cyberThrusterCanvas = document.getElementById("cyberThrusterCanvas");
const cyberThrusterAttempts = document.getElementById("cyberThrusterAttempts");
const cyberThrusterAccel = document.getElementById("cyberThrusterAccel");
const cyberThrusterVelocityLabel = document.getElementById("cyberThrusterVelocityLabel");
const cyberThrusterUndoBtn = document.getElementById("cyberThrusterUndoBtn");
const cyberToolSynth = document.getElementById("cyberToolSynth");
const cyberSynthGrid = document.getElementById("cyberSynthGrid");
const cyberSubmitBtn = document.getElementById("cyberSubmitBtn");
const cyberSubmissionHint = document.getElementById("cyberSubmissionHint");
const cyberWorks = document.getElementById("cyberWorks");
const cyberSubmitGuessBtn = document.getElementById("cyberSubmitGuessBtn");
const cyberRoundScores = document.getElementById("cyberRoundScores");
const cyberReveal = document.getElementById("cyberReveal");
const cyberNextRoundBtn = document.getElementById("cyberNextRoundBtn");
const cyberGameOverNotice = document.getElementById("cyberGameOverNotice");
const cyberPlayers = document.getElementById("cyberPlayers");
const cyberShoelaceCtx = cyberShoelaceCanvas ? cyberShoelaceCanvas.getContext("2d") : null;
const cyberThrusterCtx = cyberThrusterCanvas ? cyberThrusterCanvas.getContext("2d") : null;

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
const impressionReview = document.getElementById("impressionReview");
const impressionReviewList = document.getElementById("impressionReviewList");
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

const trekkingPanel = document.getElementById("trekkingPanel");
const trekkingDayLabel = document.getElementById("trekkingDay");
const trekkingTurnLabel = document.getElementById("trekkingTurn");
const trekkingWinnerLabel = document.getElementById("trekkingWinner");
const trekkingDeckCountLabel = document.getElementById("trekkingDeckCount");
const trekkingDeckTopLabel = document.getElementById("trekkingDeckTop");
const trekkingClock = document.getElementById("trekkingClock");
const trekkingMarket = document.getElementById("trekkingMarket");
const trekkingSelectedCardLabel = document.getElementById("trekkingSelectedCard");
const trekkingSelectedCostLabel = document.getElementById("trekkingSelectedCost");
const trekkingSelectedTokensLabel = document.getElementById("trekkingSelectedTokens");
const trekkingTakeCardWithCrystalBtn = document.getElementById("trekkingTakeCardWithCrystalBtn");
const trekkingTakeAncestorWithCrystalBtn = document.getElementById("trekkingTakeAncestorWithCrystalBtn");
const trekkingWildModal = document.getElementById("trekkingWildModal");
const trekkingWildPrompt = document.getElementById("trekkingWildPrompt");
const trekkingWildModalButtons = document.getElementById("trekkingWildModalButtons");
const trekkingWildCancelBtn = document.getElementById("trekkingWildCancel");
const trekkingCrystalModal = document.getElementById("trekkingCrystalModal");
const trekkingCrystalPrompt = document.getElementById("trekkingCrystalPrompt");
const trekkingCrystalSelect = document.getElementById("trekkingCrystalSelect");
const trekkingCrystalConfirmBtn = document.getElementById("trekkingCrystalConfirm");
const trekkingCrystalCancelBtn = document.getElementById("trekkingCrystalCancel");
const trekkingScoreModal = document.getElementById("trekkingScoreModal");
const trekkingScoreCloseBtn = document.getElementById("trekkingScoreCloseBtn");
const trekkingTakeCardBtn = document.getElementById("trekkingTakeCardBtn");
const trekkingTakeAncestorBtn = document.getElementById("trekkingTakeAncestorBtn");
const trekkingPlayers = document.getElementById("trekkingPlayers");

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
const projectLPanel = document.getElementById("projectLPanel");
const projectLPhaseLabel = document.getElementById("projectLPhase");
const projectLApLabel = document.getElementById("projectLAp");
const projectLTurnLabel = document.getElementById("projectLTurn");
const projectLMasterUsedLabel = document.getElementById("projectLMasterUsed");
const projectLWhiteRemainingLabel = document.getElementById("projectLWhiteRemaining");
const projectLBlackRemainingLabel = document.getElementById("projectLBlackRemaining");
const projectLEndTriggeredLabel = document.getElementById("projectLEndTriggered");
const projectLWinnerLabel = document.getElementById("projectLWinner");
const projectLSelectedMarketLabel = document.getElementById("projectLSelectedMarket");
const projectLSelectedPuzzleLabel = document.getElementById("projectLSelectedPuzzle");
const projectLSelectedPieceLabel = document.getElementById("projectLSelectedPiece");
const projectLSelectedOriginLabel = document.getElementById("projectLSelectedOrigin");
const projectLSelectedRotationLabel = document.getElementById("projectLSelectedRotation");
const projectLSelectedFlipLabel = document.getElementById("projectLSelectedFlip");
const projectLRotateLeftBtn = document.getElementById("projectLRotateLeftBtn");
const projectLRotateRightBtn = document.getElementById("projectLRotateRightBtn");
const projectLFlipBtn = document.getElementById("projectLFlipBtn");
const projectLClearSelectionBtn = document.getElementById("projectLClearSelectionBtn");
const projectLMarketWhite = document.getElementById("projectLMarketWhite");
const projectLMarketBlack = document.getElementById("projectLMarketBlack");
const projectLTakeMarketBtn = document.getElementById("projectLTakeMarketBtn");
const projectLDrawWhiteBtn = document.getElementById("projectLDrawWhiteBtn");
const projectLDrawBlackBtn = document.getElementById("projectLDrawBlackBtn");
const projectLTakeLevel1Btn = document.getElementById("projectLTakeLevel1Btn");
const projectLActivePuzzles = document.getElementById("projectLActivePuzzles");
const projectLCompletedPuzzles = document.getElementById("projectLCompletedPuzzles");
const projectLInventory = document.getElementById("projectLInventory");
const projectLUpgradeFromSelect = document.getElementById("projectLUpgradeFrom");
const projectLUpgradeToSelect = document.getElementById("projectLUpgradeTo");
const projectLUpgradeBtn = document.getElementById("projectLUpgradeBtn");
const projectLPlaceBtn = document.getElementById("projectLPlaceBtn");
const projectLQueueMasterBtn = document.getElementById("projectLQueueMasterBtn");
const projectLClearMasterBtn = document.getElementById("projectLClearMasterBtn");
const projectLUseMasterBtn = document.getElementById("projectLUseMasterBtn");
const projectLMasterQueue = document.getElementById("projectLMasterQueue");
const projectLFinishingPlaceBtn = document.getElementById("projectLFinishingPlaceBtn");
const projectLFinishingDoneBtn = document.getElementById("projectLFinishingDoneBtn");
const projectLPlayers = document.getElementById("projectLPlayers");

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

function closeProjectLUpgradeModal() {
  setModalVisible(projectLUpgradeModal, false);
}

function renderProjectLUpgradeModal(view) {
  if (!projectLUpgradeOptions || !projectLUpgradeFromLabel) {
    return;
  }
  projectLUpgradeOptions.innerHTML = "";
  const fromPiece = getProjectLUpgradeFrom(view);
  if (!fromPiece) {
    projectLUpgradeFromLabel.textContent = "Select a piece from Inventory first.";
    return;
  }
  projectLUpgradeFromLabel.textContent = `From: ${fromPiece}`;
  const pieceDefs = view && view.piece_defs ? view.piece_defs : {};
  const allPieces = Object.keys(pieceDefs).sort((a, b) => {
    const la = pieceDefs[a].level;
    const lb = pieceDefs[b].level;
    if (la !== lb) {
      return la - lb;
    }
    return a.localeCompare(b);
  });
  allPieces.forEach((pieceId) => {
    const pieceDef = pieceDefs[pieceId];
    const canUpgrade = projectLCanUpgrade(pieceDefs, fromPiece, pieceId);
    const option = document.createElement("button");
    option.type = "button";
    option.className = "project-l-upgrade-piece";
    if (!canUpgrade) {
      option.classList.add("disabled");
      option.disabled = true;
    }
    const grid = document.createElement("div");
    grid.className = "project-l-upgrade-piece-grid";
    grid.style.gridTemplateColumns = `repeat(${pieceDef.shape[0].length}, 14px)`;
    grid.style.gridAutoRows = "14px";
    pieceDef.shape.forEach((row) => {
      row.forEach((value) => {
        if (!value) {
          const spacer = document.createElement("div");
          spacer.style.width = "14px";
          spacer.style.height = "14px";
          grid.appendChild(spacer);
          return;
        }
        const cell = document.createElement("div");
        cell.className = "project-l-upgrade-piece-cell";
        if (pieceDef.color) {
          cell.style.background = pieceDef.color;
        }
        grid.appendChild(cell);
      });
    });
    option.appendChild(grid);
    const label = document.createElement("div");
    label.className = "project-l-piece-label";
    label.textContent = pieceId;
    option.appendChild(label);
    if (canUpgrade) {
      option.addEventListener("click", () => {
        sendAction({ type: "upgrade_piece", from_piece_id: fromPiece, to_piece_id: pieceId });
        closeProjectLUpgradeModal();
      });
    }
    projectLUpgradeOptions.appendChild(option);
  });
}

function openProjectLUpgradeModal(view) {
  if (!projectLUpgradeModal || !view) {
    return;
  }
  renderProjectLUpgradeModal(view);
  setModalVisible(projectLUpgradeModal, true);
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
  if (carcassonnePanel) {
    carcassonnePanel.classList.toggle("hidden", !showCarcassonne);
  }
  if (fangNiaoPanel) {
    fangNiaoPanel.classList.toggle("hidden", !showFangNiao);
  }
  document.body.classList.toggle("trekking-active", showTrekking);
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

function updateCyberPicturesConfigRow() {
  const showRow = currentRoomState && currentGameType === "cyber_pictures" && currentRoomState.status === "lobby";
  if (cyberPicturesConfigBox) {
    cyberPicturesConfigBox.classList.toggle("hidden", !showRow);
    cyberPicturesConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (cyberPicturesDuplicateRow) {
    cyberPicturesDuplicateRow.classList.toggle("hidden", !showRow);
    cyberPicturesDuplicateRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (cyberPicturesToolRow) {
    cyberPicturesToolRow.classList.toggle("hidden", !showRow);
    cyberPicturesToolRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (showRow) {
    renderCyberPicturesToolOptions();
  }
}

function renderCyberPicturesToolOptions() {
  if (!cyberPicturesToolOptions) {
    return;
  }
  cyberPicturesToolOptions.innerHTML = "";
  CYBER_TOOL_KEYS.forEach((toolKey) => {
    const label = document.createElement("label");
    label.className = "cyber-tool-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = toolKey;
    checkbox.checked = cyberPicturesDisabledTools.has(toolKey);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        cyberPicturesDisabledTools.add(toolKey);
      } else {
        cyberPicturesDisabledTools.delete(toolKey);
      }
    });
    const text = document.createElement("span");
    text.textContent = CYBER_TOOL_LABELS[toolKey] || toolKey;
    label.appendChild(checkbox);
    label.appendChild(text);
    cyberPicturesToolOptions.appendChild(label);
  });
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

function updateHanabiConfigRow() {
  const showRow = currentRoomState && currentGameType === "hanabi" && currentRoomState.status === "lobby";
  if (hanabiConfigBox) {
    hanabiConfigBox.classList.toggle("hidden", !showRow);
    hanabiConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (hanabiFinalRoundRow) {
    hanabiFinalRoundRow.classList.toggle("hidden", !showRow);
    hanabiFinalRoundRow.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function updateMismatchConfigRow() {
  const showRow = currentRoomState && currentGameType === "perfect_mismatch" && currentRoomState.status === "lobby";
  if (mismatchConfigBox) {
    mismatchConfigBox.classList.toggle("hidden", !showRow);
    mismatchConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function updateGangConfigRow() {
  const showRow = currentRoomState && currentGameType === "the_gang" && currentRoomState.status === "lobby";
  if (gangConfigBox) {
    gangConfigBox.classList.toggle("hidden", !showRow);
    gangConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function updateImpressionConfigRow() {
  const showRow = currentRoomState && currentGameType === "impression_flower" && currentRoomState.status === "lobby";
  if (impressionConfigBox) {
    impressionConfigBox.classList.toggle("hidden", !showRow);
    impressionConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (impressionVoteRow) {
    impressionVoteRow.classList.toggle("hidden", !showRow);
    impressionVoteRow.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function updateBlitzSketchConfigRow() {
  const showRow = currentRoomState && currentGameType === "blitz_sketch" && currentRoomState.status === "lobby";
  if (blitzSketchConfigBox) {
    blitzSketchConfigBox.classList.toggle("hidden", !showRow);
    blitzSketchConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (blitzSketchDrawTimeRow) {
    blitzSketchDrawTimeRow.classList.toggle("hidden", !showRow);
    blitzSketchDrawTimeRow.setAttribute("aria-hidden", (!showRow).toString());
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
  clearYahtzeeState();
  clearGoldRushState();
  clearIncanGoldState();
  clearKobayakawaState();
  clearSkullState();
  clearCatInBoxState();
  clearGangState();
  clearMismatchState();
  clearCoyoteState();
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

function clearHanabiState() {
  currentHanabiView = null;
  hanabiSelectedCardIndex = null;
  hanabiSelectedTargetId = null;
  hanabiSelectedClueType = "color";
  hanabiSelectedClueValue = null;
  if (hanabiTurnLabel) {
    hanabiTurnLabel.textContent = "-";
  }
  if (hanabiCluesLabel) {
    hanabiCluesLabel.textContent = "-";
  }
  if (hanabiFusesLabel) {
    hanabiFusesLabel.textContent = "-";
  }
  if (hanabiDeckLabel) {
    hanabiDeckLabel.textContent = "-";
  }
  if (hanabiScoreLabel) {
    hanabiScoreLabel.textContent = "-";
  }
  if (hanabiFinalTurnsLabel) {
    hanabiFinalTurnsLabel.textContent = "-";
  }
  if (hanabiEndReasonLabel) {
    hanabiEndReasonLabel.textContent = "-";
  }
  if (hanabiTableau) {
    hanabiTableau.innerHTML = "";
  }
  if (hanabiDiscardStats) {
    hanabiDiscardStats.innerHTML = "";
  }
  if (hanabiHand) {
    hanabiHand.innerHTML = "";
  }
  if (hanabiSelectedCardLabel) {
    hanabiSelectedCardLabel.textContent = "-";
  }
  if (hanabiTargetSelect) {
    hanabiTargetSelect.innerHTML = "";
  }
  if (hanabiClueTypeSelect) {
    hanabiClueTypeSelect.value = "color";
  }
  if (hanabiClueValueSelect) {
    hanabiClueValueSelect.innerHTML = "";
  }
  if (hanabiPlayers) {
    hanabiPlayers.innerHTML = "";
  }
  if (hanabiLog) {
    hanabiLog.innerHTML = "";
  }
  updateHanabiActionButtons();
}

function clearGangState() {
  currentGangView = null;
  gangAutoLockSent = false;
  gangSelectedSpyTarget = null;
  gangLastLockAt = null;
  gangLastDeadline = null;
  if (gangCountdownTimer) {
    clearInterval(gangCountdownTimer);
    gangCountdownTimer = null;
  }
  if (gangPhaseLabel) {
    gangPhaseLabel.textContent = "-";
  }
  if (gangLevelLabel) {
    gangLevelLabel.textContent = "-";
  }
  if (gangLivesLabel) {
    gangLivesLabel.textContent = "-";
  }
  if (gangTokensLabel) {
    gangTokensLabel.textContent = "-";
  }
  if (gangModeLabel) {
    gangModeLabel.textContent = "-";
  }
  if (gangMissionLabel) {
    gangMissionLabel.textContent = "-";
  }
  if (gangTimerLabel) {
    gangTimerLabel.textContent = "-";
  }
  if (gangLockLabel) {
    gangLockLabel.textContent = "-";
  }
  if (gangCommunity) {
    gangCommunity.innerHTML = "";
  }
  if (gangRanking) {
    gangRanking.innerHTML = "";
  }
  if (gangPlayers) {
    gangPlayers.innerHTML = "";
  }
  if (gangSpyTargetSelect) {
    gangSpyTargetSelect.innerHTML = "";
  }
  if (gangRoundSummary) {
    gangRoundSummary.classList.add("hidden");
  }
  if (gangRoundSummaryBody) {
    gangRoundSummaryBody.textContent = "-";
  }
  if (gangRoundSummaryList) {
    gangRoundSummaryList.innerHTML = "";
  }
  updateGangActionButtons();
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

function clearBlitzSketchState() {
  currentBlitzSketchView = null;
  blitzSketchIsDrawing = false;
  blitzSketchActiveDrawIndex = null;
  blitzSketchSubmittedDrawIndex = null;
  stopBlitzSketchTimers();
  if (blitzSketchPhaseLabel) {
    blitzSketchPhaseLabel.textContent = "-";
  }
  if (blitzSketchDrawProgressLabel) {
    blitzSketchDrawProgressLabel.textContent = "-";
  }
  if (blitzSketchGuessProgressLabel) {
    blitzSketchGuessProgressLabel.textContent = "-";
  }
  if (blitzSketchScoreLabel) {
    blitzSketchScoreLabel.textContent = "-";
  }
  if (blitzSketchPromptLabel) {
    blitzSketchPromptLabel.textContent = "-";
  }
  if (blitzSketchTimerLabel) {
    blitzSketchTimerLabel.textContent = "-";
  }
  if (blitzSketchFeedback) {
    blitzSketchFeedback.textContent = "";
  }
  if (blitzSketchRevealRow) {
    blitzSketchRevealRow.classList.add("hidden");
  }
  if (blitzSketchRevealAnswer) {
    blitzSketchRevealAnswer.textContent = "-";
  }
  if (blitzSketchPlayers) {
    blitzSketchPlayers.innerHTML = "";
  }
  if (blitzSketchReviewGrid) {
    blitzSketchReviewGrid.innerHTML = "";
  }
  if (blitzSketchReview) {
    blitzSketchReview.classList.add("hidden");
  }
  if (blitzSketchDrawArea) {
    blitzSketchDrawArea.classList.add("hidden");
  }
  if (blitzSketchGuessArea) {
    blitzSketchGuessArea.classList.add("hidden");
  }
  if (blitzSketchInput) {
    blitzSketchInput.value = "";
  }
  if (blitzSketchImage) {
    blitzSketchImage.removeAttribute("src");
  }
  clearBlitzSketchCanvas();
  updateBlitzSketchButtons();
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
  if (impressionReview) {
    impressionReview.classList.add("hidden");
  }
  if (impressionReviewList) {
    impressionReviewList.innerHTML = "";
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

function clearTrekkingSelections() {
  trekkingSelectedSlot = null;
}

function clearTrekkingState() {
  currentTrekkingView = null;
  trekkingLastDay = null;
  clearTrekkingSelections();
  closeTrekkingWildModal();
  closeTrekkingCrystalModal();
  closeTrekkingScoreRules();
  if (trekkingDayLabel) {
    trekkingDayLabel.textContent = "-";
  }
  if (trekkingTurnLabel) {
    trekkingTurnLabel.textContent = "-";
  }
  if (trekkingWinnerLabel) {
    trekkingWinnerLabel.textContent = "-";
  }
  if (trekkingDeckCountLabel) {
    trekkingDeckCountLabel.textContent = "-";
  }
  if (trekkingDeckTopLabel) {
    trekkingDeckTopLabel.textContent = "-";
  }
  if (trekkingSelectedCardLabel) {
    trekkingSelectedCardLabel.textContent = "-";
  }
  if (trekkingSelectedCostLabel) {
    trekkingSelectedCostLabel.textContent = "-";
  }
  if (trekkingSelectedTokensLabel) {
    trekkingSelectedTokensLabel.textContent = "-";
  }
  if (trekkingMarket) {
    trekkingMarket.innerHTML = "";
  }
  if (trekkingClock) {
    trekkingClock.innerHTML = "";
  }
  if (trekkingPlayers) {
    trekkingPlayers.innerHTML = "";
  }
  updateTrekkingActionButtons();
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

function clearProjectLState() {
  currentProjectLView = null;
  projectLSelectedMarket = null;
  projectLSelectedPuzzleIndex = null;
  projectLSelectedPieceId = null;
  projectLSelectedOrigin = null;
  projectLRotation = 0;
  projectLFlip = false;
  projectLMasterQueueItems = [];
  if (projectLPhaseLabel) {
    projectLPhaseLabel.textContent = "-";
  }
  if (projectLApLabel) {
    projectLApLabel.textContent = "-";
  }
  if (projectLTurnLabel) {
    projectLTurnLabel.textContent = "-";
  }
  if (projectLMasterUsedLabel) {
    projectLMasterUsedLabel.textContent = "-";
  }
  if (projectLWhiteRemainingLabel) {
    projectLWhiteRemainingLabel.textContent = "-";
  }
  if (projectLBlackRemainingLabel) {
    projectLBlackRemainingLabel.textContent = "-";
  }
  if (projectLEndTriggeredLabel) {
    projectLEndTriggeredLabel.textContent = "-";
  }
  if (projectLWinnerLabel) {
    projectLWinnerLabel.textContent = "-";
  }
  if (projectLSelectedMarketLabel) {
    projectLSelectedMarketLabel.textContent = "-";
  }
  if (projectLSelectedPuzzleLabel) {
    projectLSelectedPuzzleLabel.textContent = "-";
  }
  if (projectLSelectedPieceLabel) {
    projectLSelectedPieceLabel.textContent = "-";
  }
  if (projectLSelectedOriginLabel) {
    projectLSelectedOriginLabel.textContent = "-";
  }
  if (projectLSelectedRotationLabel) {
    projectLSelectedRotationLabel.textContent = "0";
  }
  if (projectLSelectedFlipLabel) {
    projectLSelectedFlipLabel.textContent = "No";
  }
  if (projectLMarketWhite) {
    projectLMarketWhite.innerHTML = "";
  }
  if (projectLMarketBlack) {
    projectLMarketBlack.innerHTML = "";
  }
  if (projectLActivePuzzles) {
    projectLActivePuzzles.innerHTML = "";
  }
  if (projectLCompletedPuzzles) {
    projectLCompletedPuzzles.innerHTML = "";
  }
  if (projectLInventory) {
    projectLInventory.innerHTML = "";
  }
  if (projectLUpgradeFromSelect) {
    projectLUpgradeFromSelect.innerHTML = "";
  }
  if (projectLUpgradeToSelect) {
    projectLUpgradeToSelect.innerHTML = "";
  }
  if (projectLMasterQueue) {
    projectLMasterQueue.innerHTML = "";
  }
  if (projectLPlayers) {
    projectLPlayers.innerHTML = "";
  }
  updateProjectLActionButtons();
}

function clearCarcassonneState() {
  currentCarcassonneView = null;
  carcRotation = 0;
  carcPendingType = null;
  carcCellMap.clear();
  carcHoverTiles.clear();
  carcHoverKey = null;
  if (carcPhaseLabel) {
    carcPhaseLabel.textContent = "-";
  }
  if (carcTurnLabel) {
    carcTurnLabel.textContent = "-";
  }
  if (carcRemainingLabel) {
    carcRemainingLabel.textContent = "-";
  }
  if (carcWinnerLabel) {
    carcWinnerLabel.textContent = "-";
  }
  if (carcPendingLabel) {
    carcPendingLabel.textContent = "-";
  }
  if (carcRotationLabel) {
    carcRotationLabel.textContent = "0°";
  }
  if (carcBoard) {
    carcBoard.innerHTML = "";
  }
  if (carcPendingTile) {
    carcPendingTile.innerHTML = "";
  }
  if (carcMeepleOptions) {
    carcMeepleOptions.innerHTML = "";
  }
  if (carcMeepleHint) {
    carcMeepleHint.textContent = "-";
  }
  if (carcMeepleSelection) {
    carcMeepleSelection.textContent = "Selected: -";
  }
  if (carcPlayers) {
    carcPlayers.innerHTML = "";
  }
  carcMeepleOptionSet.clear();
  clearCarcassonneSelection();
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
  const players = Array.isArray(view.players) ? view.players : [];
  const youId = view.you;
  let orderedPlayers = players;
  if (youId) {
    const youPlayer = players.find((player) => player.player_id === youId);
    if (youPlayer) {
      orderedPlayers = [youPlayer, ...players.filter((player) => player.player_id !== youId)];
    }
  }

  orderedPlayers.forEach((player) => {
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

function getTrekkingYou(view) {
  if (!view) {
    return null;
  }
  return (view.players || []).find((player) => player.player_id === view.you) || null;
}

function trekkingTokenIcon(token) {
  return TREKKING_TOKEN_LABELS[token] || token;
}

function trekkingTokenName(token) {
  return TREKKING_TOKEN_NAMES[token] || token;
}

function trekkingTokensText(tokens) {
  return (tokens || []).map((token) => trekkingTokenIcon(token)).join(" ");
}

function formatTrekkingYear(year) {
  if (year === null || year === undefined) {
    return "-";
  }
  if (Math.abs(year) > 1000000) {
    return "-";
  }
  if (year < 0) {
    return `${Math.abs(year)} BCE`;
  }
  return `${year} CE`;
}

function trekkingWildNeeded(tokens) {
  return (tokens || []).filter((token) => token === "wild").length;
}

function openTrekkingWildModal(stepIndex, total) {
  if (!trekkingWildModal || !trekkingWildPrompt || !trekkingWildModalButtons) {
    return Promise.resolve(null);
  }
  if (trekkingWildModalState) {
    return Promise.reject(new Error("wild modal already open"));
  }
  trekkingWildModal.classList.remove("hidden");
  const state = {
    stepIndex,
    total,
    resolve: null,
    reject: null,
  };
  const promise = new Promise((resolve, reject) => {
    state.resolve = resolve;
    state.reject = reject;
  });
  trekkingWildModalState = state;
  updateTrekkingWildPrompt();
  return promise;
}

function closeTrekkingWildModal() {
  if (!trekkingWildModal) {
    trekkingWildModalState = null;
    return;
  }
  trekkingWildModal.classList.add("hidden");
  trekkingWildModalState = null;
}

function updateTrekkingWildPrompt() {
  if (!trekkingWildModalState || !trekkingWildPrompt) {
    return;
  }
  const { stepIndex, total } = trekkingWildModalState;
  if (total <= 1) {
    trekkingWildPrompt.textContent = "Select 1 slot";
  } else {
    trekkingWildPrompt.textContent = `Select slot (${stepIndex}/${total})`;
  }
}

async function collectTrekkingWildChoices(total) {
  const choices = [];
  for (let i = 0; i < total; i += 1) {
    const col = await openTrekkingWildModal(i + 1, total);
    if (!Number.isInteger(col)) {
      throw new Error("wild selection canceled");
    }
    choices.push(col);
  }
  return choices;
}

function openTrekkingCrystalModal(options, label) {
  if (!trekkingCrystalModal || !trekkingCrystalSelect || !trekkingCrystalPrompt) {
    return Promise.reject(new Error("crystal modal unavailable"));
  }
  if (trekkingCrystalModalState) {
    return Promise.reject(new Error("crystal modal already open"));
  }
  trekkingCrystalSelect.innerHTML = "";
  options.forEach((value) => {
    const opt = document.createElement("option");
    opt.value = String(value);
    opt.textContent = String(value);
    trekkingCrystalSelect.appendChild(opt);
  });
  trekkingCrystalPrompt.textContent = label || `Choose 1 - ${options[options.length - 1]} crystals`;
  trekkingCrystalModal.classList.remove("hidden");
  const state = { resolve: null, reject: null };
  const promise = new Promise((resolve, reject) => {
    state.resolve = resolve;
    state.reject = reject;
  });
  trekkingCrystalModalState = state;
  return promise;
}

function closeTrekkingCrystalModal() {
  if (trekkingCrystalModal) {
    trekkingCrystalModal.classList.add("hidden");
  }
  trekkingCrystalModalState = null;
}

function openTrekkingScoreRules() {
  if (!trekkingScoreModal) {
    return;
  }
  setModalVisible(trekkingScoreModal, true);
}

function closeTrekkingScoreRules() {
  if (!trekkingScoreModal) {
    return;
  }
  setModalVisible(trekkingScoreModal, false);
}

function trekkingSlotReward(view, index) {
  const rewards = view && Array.isArray(view.slot_rewards) ? view.slot_rewards : TREKKING_SLOT_REWARDS;
  return rewards[index] || null;
}

function trekkingCardMaxSpend(view, card) {
  const you = getTrekkingYou(view);
  const crystals = you ? Number(you.crystals) || 0 : 0;
  if (!card) {
    return 0;
  }
  const cost = Number(card.cost) || 0;
  return Math.max(0, Math.min(crystals, cost - 1));
}

function trekkingAncestorMaxSpend(view) {
  const you = getTrekkingYou(view);
  const crystals = you ? Number(you.crystals) || 0 : 0;
  return Math.max(0, Math.min(crystals, 2));
}

function syncTrekkingSelection(view) {
  if (!view) {
    clearTrekkingSelections();
    return;
  }
  if (trekkingLastDay !== view.day) {
    clearTrekkingSelections();
    trekkingLastDay = view.day;
  }
  if (trekkingSelectedSlot !== null) {
    const card = (view.market || [])[trekkingSelectedSlot];
    if (!card) {
      trekkingSelectedSlot = null;
    }
  }
}

function updateTrekkingSelectionLabels(view) {
  if (!view) {
    return;
  }
  const card = trekkingSelectedSlot !== null ? (view.market || [])[trekkingSelectedSlot] : null;
  if (trekkingSelectedCardLabel) {
    trekkingSelectedCardLabel.textContent = card ? `${card.year_label || card.year} ${card.title}` : "-";
  }
  if (trekkingSelectedCostLabel) {
    trekkingSelectedCostLabel.textContent = card ? `${card.cost}` : "-";
  }
  if (trekkingSelectedTokensLabel) {
    trekkingSelectedTokensLabel.textContent = card ? trekkingTokensText(card.tokens) : "-";
  }
}

function updateTrekkingActionButtons() {
  if (!trekkingTakeCardBtn || !trekkingTakeAncestorBtn) {
    return;
  }
  if (currentGameType !== "trekking_history" || !currentTrekkingView) {
    trekkingTakeCardBtn.disabled = true;
    trekkingTakeAncestorBtn.disabled = true;
    if (trekkingTakeCardWithCrystalBtn) {
      trekkingTakeCardWithCrystalBtn.disabled = true;
    }
    if (trekkingTakeAncestorWithCrystalBtn) {
      trekkingTakeAncestorWithCrystalBtn.disabled = true;
    }
    return;
  }
  const view = currentTrekkingView;
  const legal = view.legal_actions || [];
  const card = trekkingSelectedSlot !== null ? (view.market || [])[trekkingSelectedSlot] : null;
  const cardMaxSpend = trekkingCardMaxSpend(view, card);
  const ancestorMaxSpend = trekkingAncestorMaxSpend(view);

  const canTakeCard = legal.includes("take_card") && !!card;
  const canTakeAncestor = legal.includes("take_ancestor");

  trekkingTakeCardBtn.disabled = !canTakeCard;
  trekkingTakeAncestorBtn.disabled = !canTakeAncestor;

  if (trekkingTakeCardWithCrystalBtn) {
    trekkingTakeCardWithCrystalBtn.disabled = !(legal.includes("take_card") && card && cardMaxSpend >= 1);
  }
  if (trekkingTakeAncestorWithCrystalBtn) {
    trekkingTakeAncestorWithCrystalBtn.disabled = !(legal.includes("take_ancestor") && ancestorMaxSpend >= 1);
  }
}

function renderTrekkingMarket(view) {
  if (!trekkingMarket) {
    return;
  }
  trekkingMarket.innerHTML = "";
  (view.market || []).forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "trekking-card";
    if (trekkingSelectedSlot === index) {
      button.classList.add("selected");
    }
    if (!card) {
      button.classList.add("empty");
      button.disabled = true;
    }

    const year = document.createElement("div");
    year.className = "trekking-card-year";
    year.textContent = card ? (card.year_label || card.year) : "Empty";
    button.appendChild(year);

    const title = document.createElement("div");
    title.className = "trekking-card-title";
    title.textContent = card ? card.title : "-";
    button.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "trekking-card-meta";
    if (card) {
      meta.textContent = `⏳ ${card.cost} | ${trekkingTokensText(card.tokens)}`;
    } else {
      meta.textContent = "-";
    }
    button.appendChild(meta);

    const reward = trekkingSlotReward(view, index);
    const rewardLabel = reward ? trekkingTokenIcon(reward) : "-";
    const slot = document.createElement("div");
    slot.className = "trekking-card-slot";
    slot.textContent = `Slot ${index + 1} Reward: ${rewardLabel}`;
    button.appendChild(slot);

    if (card) {
      button.addEventListener("click", () => {
        trekkingSelectedSlot = index;
        updateTrekkingSelectionLabels(view);
        renderTrekkingMarket(view);
        updateTrekkingActionButtons();
      });
    }
    trekkingMarket.appendChild(button);
  });
}

function renderTrekkingClock(view) {
  if (!trekkingClock) {
    return;
  }
  trekkingClock.innerHTML = "";
  const maxTime = 12;
  const grid = document.createElement("div");
  grid.className = "trekking-clock-grid";

  const buckets = Array.from({ length: maxTime + 1 }, () => []);
  (view.players || []).forEach((player) => {
    const time = Number(player.time) || 0;
    const index = Math.min(Math.max(time, 0), maxTime);
    buckets[index].push(player);
  });

  buckets.forEach((bucket) => {
    bucket.sort((a, b) => {
      const aOrder = Number(a.time_order) || 0;
      const bOrder = Number(b.time_order) || 0;
      if (aOrder !== bOrder) {
        return bOrder - aOrder;
      }
      const aSeat = Number(a.seat) || 0;
      const bSeat = Number(b.seat) || 0;
      if (aSeat !== bSeat) {
        return aSeat - bSeat;
      }
      const aName = a.name || a.player_id || "";
      const bName = b.name || b.player_id || "";
      return String(aName).localeCompare(String(bName));
    });
  });

  for (let i = 0; i <= maxTime; i += 1) {
    const slot = document.createElement("div");
    slot.className = "trekking-clock-slot";
    const label = document.createElement("div");
    label.className = "trekking-clock-slot-label";
    label.textContent = i === maxTime ? "12+" : String(i);
    slot.appendChild(label);
    const cell = document.createElement("div");
    cell.className = "trekking-clock-cell";
    buckets[i].forEach((player) => {
      const name = document.createElement("div");
      name.className = "trekking-clock-name";
      if (player.player_id === view.current_turn) {
        name.classList.add("current");
      }
      if (player.player_id === view.you) {
        name.classList.add("self");
      }
      name.textContent = player.name || player.player_id;
      cell.appendChild(name);
    });
    slot.appendChild(cell);
    grid.appendChild(slot);
  }
  trekkingClock.appendChild(grid);
}

function renderTrekkingPlayers(view) {
  if (!trekkingPlayers) {
    return;
  }
  trekkingPlayers.innerHTML = "";
  const templates = new Map((view.itinerary_templates || []).map((tpl) => [tpl.id, tpl]));
  const dayIndex = Number(view.day) ? Number(view.day) - 1 : 0;
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "trekking-player";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
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
    const time = document.createElement("span");
    time.className = "badge";
    time.textContent = `time ${player.time ?? 0}`;
    badges.appendChild(time);
    const crystals = document.createElement("span");
    crystals.className = "badge";
    crystals.textContent = `💎 ${player.crystals ?? 0}`;
    badges.appendChild(crystals);
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

    const trekInfo = document.createElement("div");
    trekInfo.className = "trekking-player-meta";
    const lengths = player.trek_lengths && player.trek_lengths.length ? player.trek_lengths.join(", ") : "-";
    const lastYear = formatTrekkingYear(player.current_trek_last_year);
    trekInfo.textContent = `Treks: ${lengths} | Last Year: ${lastYear}`;
    card.appendChild(trekInfo);

    const trekScores = document.createElement("div");
    trekScores.className = "trekking-player-meta trekking-player-scores";
    const currentScore = Number.isFinite(player.current_trek_score) ? player.current_trek_score : 0;
    const totalScore = Number.isFinite(player.treks_total_score) ? player.treks_total_score : 0;
    const scoreText = document.createElement("span");
    scoreText.textContent = `Trek Score: ${currentScore} | Treks Total: ${totalScore}`;
    trekScores.appendChild(scoreText);
    const scoreLink = document.createElement("a");
    scoreLink.href = "#";
    scoreLink.className = "trekking-score-link";
    scoreLink.textContent = "得分规则";
    trekScores.appendChild(scoreLink);
    card.appendChild(trekScores);

    const itinerary = (player.itineraries || [])[dayIndex];
    if (itinerary) {
      const template = templates.get(itinerary.template_id);
      const nameRow = document.createElement("div");
      nameRow.className = "trekking-itinerary-name";
      nameRow.textContent = `Itinerary: ${itinerary.template_id || "-"}`;
      card.appendChild(nameRow);
      if (template && Array.isArray(template.grid)) {
        const grid = template.grid;
        const filled = itinerary.filled || [];
        const rowRewards = template.row_rewards || {};
        const rewardClaimed = itinerary.row_rewards_claimed || [];
        const header = document.createElement("div");
        header.className = "trekking-itinerary-header";
        TREKKING_COLUMN_LABELS.forEach((label, colIdx) => {
          const cell = document.createElement("div");
          cell.className = "trekking-itinerary-header-cell";
          cell.dataset.col = `${colIdx}`;
          const icon = document.createElement("div");
          icon.className = "trekking-itinerary-header-icon";
          icon.textContent = trekkingTokenIcon(TREKKING_SLOT_REWARDS[colIdx + 1] || "");
          const text = document.createElement("div");
          text.className = "trekking-itinerary-header-text";
          text.textContent = label;
          cell.appendChild(icon);
          cell.appendChild(text);
          header.appendChild(cell);
        });
        const spacer = document.createElement("div");
        spacer.className = "trekking-itinerary-header-spacer";
        header.appendChild(spacer);
        card.appendChild(header);
        const gridEl = document.createElement("div");
        gridEl.className = "trekking-itinerary-grid";
        for (let row = 0; row < grid.length; row += 1) {
          const rowData = grid[row] || [];
          for (let col = 0; col < rowData.length; col += 1) {
            const cellData = rowData[col];
            const cell = document.createElement("div");
            if (!cellData) {
              cell.className = "trekking-cell none";
            } else {
              cell.className = "trekking-cell";
              cell.dataset.col = `${col}`;
              const isFilled = filled[row] && filled[row][col] === true;
              if (isFilled) {
                cell.classList.add("filled");
              } else if (cellData.type === "swirl") {
                cell.textContent = `+${cellData.value || 0}`;
              } else if (cellData.type === "gem") {
                cell.textContent = "💎";
              }
            }
            gridEl.appendChild(cell);
          }
          const rewardValue = rowRewards[String(row)];
          const rewardCell = document.createElement("div");
          rewardCell.className = "trekking-row-reward";
          if (rewardValue !== undefined) {
            rewardCell.textContent = `+${rewardValue}`;
            if (rewardClaimed[row]) {
              rewardCell.classList.add("claimed");
            }
          } else {
            rewardCell.classList.add("empty");
            rewardCell.textContent = "";
          }
          gridEl.appendChild(rewardCell);
        }
        card.appendChild(gridEl);
      }
    }

    trekkingPlayers.appendChild(card);
  });
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
  if (selectedSlotsLabel) {
    selectedSlotsLabel.textContent = selectedSlots.length ? selectedSlots.join(", ") : "-";
  }
}

function updateTargetSelection() {
  if (!targetSelection) {
    return;
  }
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
    renderGamePlayers(currentCaboView);
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
  if (actionType === "replace_or_match") {
    const canReplace = currentCaboView.legal_actions.includes("replace_card");
    const canMatch = currentCaboView.legal_actions.includes("attempt_match");
    if (selectedSlots.length >= 2) {
      return canMatch;
    }
    return selectedSlots.length >= 1 && canReplace;
  }
  if (!currentCaboView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "initial_peek") {
    return selectedSlots.length === 2;
  }
  if (actionType === "draw_discard") {
    return selectedSlots.length >= 1;
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
    clearSkullState();
    clearCatInBoxState();
    clearGangState();
    clearMismatchState();
    clearDecryptoState();
    clearDrawGuessState();
    clearBlitzSketchState();
    clearAidixitState();
    clearImpressionFlowerState();
    clearSplendorState();
    clearAbracaState();
    clearBlokusState();
    clearCarcassonneState();
    clearHalliState();
    clearGoldRushState();
    clearIncanGoldState();
    clearHanabiState();
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
  const canSelectTarget =
    view.pending_choice &&
    (view.pending_choice.type === "spy" || view.pending_choice.type === "swap");
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
      const isTargetPlayer = p.player_id !== view.you;
      const isSelectableTarget = canSelectTarget && isTargetPlayer && !slot.empty;
      if (slot.empty) {
        slotEl.classList.add("empty");
      }
      const label = slot.empty ? "Empty" : slot.known ? slot.value : "?";
      slotEl.textContent = `#${idx} ${label}`;
      if (
        selectedTarget &&
        selectedTarget.playerId === p.player_id &&
        selectedTarget.slot === idx
      ) {
        slotEl.classList.add("target-selected");
      }
      if (isSelectableTarget) {
        slotEl.classList.add("target-selectable");
        slotEl.addEventListener("click", () => {
          const isSameTarget =
            selectedTarget &&
            selectedTarget.playerId === p.player_id &&
            selectedTarget.slot === idx;
          selectedTarget = isSameTarget ? null : { playerId: p.player_id, slot: idx };
          updateActionButtons();
          renderGamePlayers(view);
        });
      }
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
  if (!targetList) {
    updateTargetSelection();
    return;
  }
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
    const isBusted = player.status === "out" && player.round_score === 0;
    const displayStatus =
      isBusted ? "busted" : (player.status === "out" ? "out" : (player.status || "-"));
    status.textContent = displayStatus;
    if (isBusted) {
      status.classList.add("danger");
    }
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
      flip7.textContent = "flip7flash";
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
  const roundScoresByPlayer = summary.round_scores || {};
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
    const roundScore = roundScoresByPlayer[player.player_id];
    const isBusted = status === "out" && roundScore === 0;
    const displayStatus = isBusted ? "busted" : status;
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = displayStatus;
    if (isBusted) {
      statusBadge.classList.add("danger");
    }
    badges.appendChild(statusBadge);
    if (summary.flip7_winner === player.player_id) {
      const flip7 = document.createElement("span");
      flip7.className = "badge highlight";
      flip7.textContent = "flip7flash";
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

const catInBoxColorEmoji = {
  red: "🟥",
  blue: "🟦",
  yellow: "🟨",
  green: "🟩",
};

function formatCatInBoxColor(color) {
  if (!color) {
    return "-";
  }
  const emoji = catInBoxColorEmoji[color] || "";
  const name = color.charAt(0).toUpperCase() + color.slice(1);
  return emoji ? `${emoji} ${name}` : name;
}

function catInBoxSlotEmpty(view, color, value) {
  if (!view || !Array.isArray(view.colors) || !Array.isArray(view.board)) {
    return false;
  }
  const row = view.colors.indexOf(color);
  if (row < 0 || row >= view.board.length) {
    return false;
  }
  const col = value - 1;
  if (!Array.isArray(view.board[row]) || col < 0 || col >= view.board[row].length) {
    return false;
  }
  return view.board[row][col] === null;
}

function catInBoxIsSelectionLegal(view, value, color) {
  if (!view || !Number.isInteger(value) || !color) {
    return false;
  }
  if (!Array.isArray(view.hand) || !view.hand.includes(value)) {
    return false;
  }
  const yourColors = view.your_colors || {};
  if (yourColors[color] === false) {
    return false;
  }
  return catInBoxSlotEmpty(view, color, value);
}

function updateCatInBoxSelectionLabels() {
  if (catInBoxSelectedCardLabel) {
    catInBoxSelectedCardLabel.textContent = Number.isInteger(catInBoxSelectedCard)
      ? String(catInBoxSelectedCard)
      : "-";
  }
  if (catInBoxSelectedColorLabel) {
    catInBoxSelectedColorLabel.textContent = catInBoxSelectedColor
      ? formatCatInBoxColor(catInBoxSelectedColor)
      : "-";
  }
}

function updateCatInBoxColorButtons(view) {
  if (!catInBoxColorButtons) {
    return;
  }
  const buttons = Array.from(catInBoxColorButtons.querySelectorAll("button[data-color]"));
  buttons.forEach((button) => {
    const color = button.dataset.color;
    let enabled = false;
    if (view && Number.isInteger(catInBoxSelectedCard) && color) {
      enabled = catInBoxIsSelectionLegal(view, catInBoxSelectedCard, color);
    }
    button.disabled = !enabled;
    if (catInBoxSelectedColor === color) {
      button.classList.add("selected");
    } else {
      button.classList.remove("selected");
    }
  });
}

function renderCatInBoxHand(view) {
  if (!catInBoxHand) {
    return;
  }
  catInBoxHand.innerHTML = "";
  if (!Array.isArray(view.hand) || !view.hand.length) {
    catInBoxHand.textContent = "-";
    updateCatInBoxSelectionLabels();
    return;
  }
  view.hand.forEach((value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot";
    btn.textContent = String(value);
    if (catInBoxSelectedCard === value) {
      btn.classList.add("selected");
    }
    btn.addEventListener("click", () => {
      if (catInBoxSelectedCard === value) {
        catInBoxSelectedCard = null;
        catInBoxSelectedColor = null;
      } else {
        catInBoxSelectedCard = value;
        if (catInBoxSelectedColor && !catInBoxIsSelectionLegal(view, value, catInBoxSelectedColor)) {
          catInBoxSelectedColor = null;
        }
      }
      updateCatInBoxSelectionLabels();
      renderCatInBoxBoard(view);
      updateCatInBoxActionButtons();
      renderCatInBoxHand(view);
    });
    catInBoxHand.appendChild(btn);
  });
}

function renderCatInBoxBoard(view) {
  if (!catInBoxBoard) {
    return;
  }
  catInBoxBoard.innerHTML = "";
  const maxNumber = Number.isInteger(view.max_number) ? view.max_number : 0;
  catInBoxBoard.style.setProperty("--cat-box-cols", Math.max(maxNumber, 1));

  const headerSpacer = document.createElement("div");
  headerSpacer.className = "cat-box-header";
  headerSpacer.textContent = "";
  catInBoxBoard.appendChild(headerSpacer);
  for (let value = 1; value <= maxNumber; value += 1) {
    const header = document.createElement("div");
    header.className = "cat-box-header";
    header.textContent = String(value);
    catInBoxBoard.appendChild(header);
  }

  const colors = Array.isArray(view.colors) ? view.colors : [];
  colors.forEach((color, rowIndex) => {
    const label = document.createElement("div");
    label.className = "cat-box-row-label";
    label.textContent = formatCatInBoxColor(color);
    catInBoxBoard.appendChild(label);
    for (let value = 1; value <= maxNumber; value += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cat-box-cell";
      cell.dataset.color = color;
      cell.dataset.value = String(value);
      let occupant = null;
      if (Array.isArray(view.board) && Array.isArray(view.board[rowIndex])) {
        occupant = view.board[rowIndex][value - 1];
      }
      if (occupant) {
        const name = findPlayerName(view, occupant);
        cell.textContent = name ? name.charAt(0).toUpperCase() : "?";
        if (name) {
          cell.title = name;
        }
        cell.classList.add("occupied");
        cell.disabled = true;
      } else {
        cell.textContent = String(value);
      }

      const isLegal =
        Number.isInteger(catInBoxSelectedCard) &&
        catInBoxSelectedCard === value &&
        catInBoxIsSelectionLegal(view, value, color);
      if (isLegal) {
        cell.classList.add("legal");
      } else if (Number.isInteger(catInBoxSelectedCard) && catInBoxSelectedCard === value) {
        cell.classList.add("disabled");
      }
      if (catInBoxSelectedCard === value && catInBoxSelectedColor === color) {
        cell.classList.add("selected");
      }
      if (!cell.disabled) {
        cell.addEventListener("click", () => {
          if (!Number.isInteger(catInBoxSelectedCard)) {
            log("Select a card first.");
            return;
          }
          if (!catInBoxIsSelectionLegal(view, value, color)) {
            log("That slot is not legal.");
            return;
          }
          catInBoxSelectedColor = color;
          updateCatInBoxSelectionLabels();
          updateCatInBoxActionButtons();
          renderCatInBoxBoard(view);
        });
      }
      catInBoxBoard.appendChild(cell);
    }
  });
}

function renderCatInBoxTrick(view) {
  if (!catInBoxTrick) {
    return;
  }
  catInBoxTrick.innerHTML = "";
  const trick = Array.isArray(view.current_trick) ? view.current_trick : [];
  if (!trick.length) {
    catInBoxTrick.textContent = "-";
    return;
  }
  trick.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "cat-box-trick-card";
    const name = entry.name || findPlayerName(view, entry.player_id);
    card.textContent = `${name}: ${formatCatInBoxColor(entry.color)} ${entry.value}`;
    catInBoxTrick.appendChild(card);
  });
}

function renderCatInBoxPlayers(view) {
  if (!catInBoxPlayers) {
    return;
  }
  catInBoxPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.player_id === view.you) {
      card.classList.add("self");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name || p.player_id;
    const meta = document.createElement("div");
    meta.className = "player-meta";
    const bidLabel = Number.isInteger(p.bid) ? p.bid : "-";
    meta.textContent = `bid ${bidLabel} | tricks ${p.tricks_won ?? 0} | score ${p.score ?? 0}`;
    const voids = Array.isArray(p.void_colors) ? p.void_colors : [];
    if (voids.length) {
      const voidLine = document.createElement("div");
      voidLine.className = "player-meta";
      const voidLabels = voids.map((color) => formatCatInBoxColor(color)).join(" ");
      voidLine.textContent = `void ${voidLabels}`;
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(voidLine);
    } else {
      card.appendChild(name);
      card.appendChild(meta);
    }
    catInBoxPlayers.appendChild(card);
  });
}

function renderCatInBoxSummary(view) {
  if (!catInBoxSummary || !catInBoxSummaryBody) {
    return;
  }
  const summary = view.last_round_summary;
  if (!summary) {
    catInBoxSummary.classList.add("hidden");
    catInBoxSummaryBody.textContent = "-";
    return;
  }
  catInBoxSummary.classList.remove("hidden");
  while (catInBoxSummaryBody.firstChild) {
    catInBoxSummaryBody.removeChild(catInBoxSummaryBody.firstChild);
  }
  const roundLine = document.createElement("div");
  const roundLabel = Number.isInteger(summary.round) ? `Round ${summary.round}` : "Round";
  const paradoxName = summary.paradox_player
    ? findPlayerName(view, summary.paradox_player)
    : "none";
  roundLine.textContent = `${roundLabel} | paradox ${paradoxName}`;
  catInBoxSummaryBody.appendChild(roundLine);

  const roundPoints = summary.round_points || {};
  const tricks = summary.tricks || {};
  const bids = summary.bids || {};
  const bonus = summary.bonus || {};
  view.players.forEach((player) => {
    const pid = player.player_id;
    const delta = roundPoints[pid];
    const deltaText =
      typeof delta === "number" && Number.isFinite(delta)
        ? delta >= 0
          ? `+${delta}`
          : String(delta)
        : "-";
    const line = document.createElement("div");
    const label = player.name || player.player_id;
    line.textContent = `${label}: T${tricks[pid] ?? "-"} / B${bids[pid] ?? "-"} / Bonus ${
      bonus[pid] ?? "-"
    } => ${deltaText}`;
    catInBoxSummaryBody.appendChild(line);
  });
}

function createHanabiCardElement(card, options = {}) {
  const cardEl = document.createElement("div");
  cardEl.className = "hanabi-card";
  const displayColor = card.color || card.known_color;
  if (displayColor) {
    cardEl.dataset.color = displayColor;
  }
  if (!card.color) {
    cardEl.classList.add("unknown");
  }
  if (options.selected) {
    cardEl.classList.add("selected");
  }

  const title = document.createElement("div");
  title.className = "hanabi-card-title";
  if (card.color && Number.isInteger(card.rank)) {
    title.textContent = `${formatHanabiColor(card.color)} ${card.rank}`;
  } else {
    title.textContent = "Unknown";
  }
  cardEl.appendChild(title);

  const known = document.createElement("div");
  known.className = "hanabi-card-known";
  const knownColor = card.known_color ? formatHanabiColorShort(card.known_color) : "?";
  const knownRank = Number.isInteger(card.known_rank) ? card.known_rank : "?";
  known.textContent = `Known: ${knownColor} ${knownRank}`;
  cardEl.appendChild(known);

  const notes = document.createElement("div");
  notes.className = "hanabi-card-notes";
  const notColors = Array.isArray(card.not_colors) ? card.not_colors : [];
  const notRanks = Array.isArray(card.not_ranks) ? card.not_ranks : [];
  const notesParts = [];
  if (notColors.length) {
    const colorsLabel = notColors.map((color) => formatHanabiColorShort(color)).join(" ");
    notesParts.push(`Not colors: ${colorsLabel}`);
  }
  if (notRanks.length) {
    notesParts.push(`Not ranks: ${notRanks.join(" ")}`);
  }
  notes.textContent = notesParts.length ? notesParts.join(" | ") : "Not: -";
  cardEl.appendChild(notes);

  return cardEl;
}

function renderHanabiHand(view) {
  if (!hanabiHand) {
    return;
  }
  hanabiHand.innerHTML = "";
  const you = getHanabiYou(view);
  if (!you || !Array.isArray(you.hand)) {
    hanabiHand.textContent = "-";
    return;
  }
  you.hand.forEach((card, idx) => {
    const cardEl = createHanabiCardElement(card, { selected: idx === hanabiSelectedCardIndex });
    cardEl.addEventListener("click", () => {
      if (hanabiSelectedCardIndex === idx) {
        hanabiSelectedCardIndex = null;
      } else {
        hanabiSelectedCardIndex = idx;
      }
      renderHanabiHand(view);
      updateHanabiSelectedCardLabel(view);
      updateHanabiActionButtons();
    });
    hanabiHand.appendChild(cardEl);
  });
}

function renderHanabiPlayers(view) {
  if (!hanabiPlayers) {
    return;
  }
  hanabiPlayers.innerHTML = "";
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
    name.textContent = player.name;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    if (player.player_id === view.you) {
      const youBadge = document.createElement("span");
      youBadge.className = "badge";
      youBadge.textContent = "you";
      badges.appendChild(youBadge);
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
      player.hand.forEach((cardData) => {
        const slot = createHanabiCardElement(cardData);
        handRow.appendChild(slot);
      });
    } else {
      const slot = document.createElement("div");
      slot.className = "player-slot empty";
      slot.textContent = "-";
      handRow.appendChild(slot);
    }
    card.appendChild(handRow);

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `cards ${player.hand_count}`;
    card.appendChild(meta);

    hanabiPlayers.appendChild(card);
  });
}

function renderHanabiTableau(view) {
  if (!hanabiTableau) {
    return;
  }
  hanabiTableau.innerHTML = "";
  HANABI_COLORS.forEach((color) => {
    const stack = document.createElement("div");
    stack.className = "hanabi-stack";
    stack.dataset.color = color;
    const value = view.tableau && Number.isInteger(view.tableau[color]) ? view.tableau[color] : 0;
    stack.textContent = `${formatHanabiColor(color)} ${value}`;
    hanabiTableau.appendChild(stack);
  });
}

function renderHanabiDiscardStats(view) {
  if (!hanabiDiscardStats) {
    return;
  }
  hanabiDiscardStats.innerHTML = "";
  const table = document.createElement("table");
  table.className = "hanabi-discard-table";
  const headRow = document.createElement("tr");
  const headColor = document.createElement("th");
  headColor.textContent = "Color";
  headRow.appendChild(headColor);
  HANABI_RANKS.forEach((rank) => {
    const th = document.createElement("th");
    th.textContent = String(rank);
    headRow.appendChild(th);
  });
  table.appendChild(headRow);
  const stats = view.discard_stats || {};
  HANABI_COLORS.forEach((color) => {
    const row = document.createElement("tr");
    const colorCell = document.createElement("td");
    colorCell.textContent = formatHanabiColor(color);
    row.appendChild(colorCell);
    HANABI_RANKS.forEach((rank) => {
      const cell = document.createElement("td");
      const value = stats[color] && Number.isInteger(stats[color][rank]) ? stats[color][rank] : 0;
      cell.textContent = String(value);
      row.appendChild(cell);
    });
    table.appendChild(row);
  });
  hanabiDiscardStats.appendChild(table);
}

function renderHanabiLog(view) {
  if (!hanabiLog) {
    return;
  }
  hanabiLog.innerHTML = "";
  const entries = Array.isArray(view.log) ? view.log : [];
  if (!entries.length) {
    hanabiLog.textContent = "-";
    return;
  }
  [...entries].reverse().forEach((entry) => {
    const row = document.createElement("div");
    row.className = "hanabi-log-entry";
    row.textContent = entry;
    hanabiLog.appendChild(row);
  });
}

function renderHanabiClueTargets(view) {
  if (!hanabiTargetSelect) {
    return;
  }
  const previous = hanabiTargetSelect.value;
  hanabiTargetSelect.innerHTML = "";
  const targets = Array.isArray(view.players)
    ? view.players.filter((p) => p.player_id !== view.you)
    : [];
  targets.forEach((player) => {
    const option = document.createElement("option");
    option.value = player.player_id;
    option.textContent = player.name;
    hanabiTargetSelect.appendChild(option);
  });
  if (!targets.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No targets";
    hanabiTargetSelect.appendChild(option);
    hanabiTargetSelect.disabled = true;
    hanabiSelectedTargetId = null;
    updateHanabiClueOptions(view);
    return;
  }
  hanabiTargetSelect.disabled = false;
  const targetIds = targets.map((player) => player.player_id);
  hanabiTargetSelect.value = targetIds.includes(previous) ? previous : targets[0].player_id;
  hanabiSelectedTargetId = hanabiTargetSelect.value;
  updateHanabiClueOptions(view);
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

function updateGangActionButtons(view) {
  const actions = view && Array.isArray(view.legal_actions) ? view.legal_actions : [];
  if (gangRevealBtn) {
    const allowed = actions.includes("reveal_next");
    gangRevealBtn.disabled = !allowed;
    gangRevealBtn.classList.toggle("action-allowed", allowed);
  }
  if (gangReadyBtn) {
    const allowed = actions.includes("toggle_ready");
    gangReadyBtn.disabled = !allowed;
    gangReadyBtn.classList.toggle("action-allowed", allowed);
  }
  if (gangLockBtn) {
    const allowed = actions.includes("lock_in");
    gangLockBtn.disabled = !allowed;
    gangLockBtn.classList.toggle("action-allowed", allowed);
  }
  if (gangMulliganBtn) {
    const allowed = actions.includes("mulligan");
    gangMulliganBtn.disabled = !allowed;
    gangMulliganBtn.classList.toggle("action-allowed", allowed);
  }
  if (gangSpyBtn) {
    const allowed = actions.includes("spy");
    gangSpyBtn.disabled = !allowed;
    gangSpyBtn.classList.toggle("action-allowed", allowed);
  }
  if (gangSpyTargetSelect) {
    const allowed = actions.includes("spy");
    gangSpyTargetSelect.disabled = gangSpyTargetSelect.disabled || !allowed;
  }
  if (gangNextRoundBtn) {
    const allowed = actions.includes("next_round");
    gangNextRoundBtn.disabled = !allowed;
    gangNextRoundBtn.classList.toggle("action-allowed", allowed);
  }
  if (gangPlayAgainBtn) {
    const allowed = actions.includes("play_again");
    gangPlayAgainBtn.disabled = !allowed;
    gangPlayAgainBtn.classList.toggle("action-allowed", allowed);
  }
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

const MISMATCH_SLIDER_LEFT_COLOR = [220, 38, 38];
const MISMATCH_SLIDER_RIGHT_COLOR = [37, 99, 235];

function getMismatchSliderColor(ratio) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const r = Math.round(
    MISMATCH_SLIDER_LEFT_COLOR[0] +
      (MISMATCH_SLIDER_RIGHT_COLOR[0] - MISMATCH_SLIDER_LEFT_COLOR[0]) * clamped
  );
  const g = Math.round(
    MISMATCH_SLIDER_LEFT_COLOR[1] +
      (MISMATCH_SLIDER_RIGHT_COLOR[1] - MISMATCH_SLIDER_LEFT_COLOR[1]) * clamped
  );
  const b = Math.round(
    MISMATCH_SLIDER_LEFT_COLOR[2] +
      (MISMATCH_SLIDER_RIGHT_COLOR[2] - MISMATCH_SLIDER_LEFT_COLOR[2]) * clamped
  );
  return `rgb(${r}, ${g}, ${b})`;
}

function updateMismatchSliderColor(input) {
  if (!input) {
    return;
  }
  const rawValue = Number.parseInt(input.value, 10);
  const rawMin = Number.parseInt(input.min, 10);
  const rawMax = Number.parseInt(input.max, 10);
  const minValue = Number.isInteger(rawMin) ? rawMin : 0;
  const maxValue = Number.isInteger(rawMax) ? rawMax : 10;
  const fallback = minValue + (maxValue - minValue) / 2;
  const value = Number.isInteger(rawValue) ? rawValue : fallback;
  const clampedValue = Math.min(Math.max(value, minValue), maxValue);
  const ratio = maxValue > minValue ? (clampedValue - minValue) / (maxValue - minValue) : 0.5;
  input.style.setProperty("--mismatch-slider-color", getMismatchSliderColor(ratio));
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
    updateMismatchSliderColor(input);
    input.addEventListener("input", () => {
      updateMismatchSliderColor(input);
    });

    const setBtn = document.createElement("button");
    setBtn.type = "button";
    setBtn.textContent = "Set";
    setBtn.className = "mismatch-slider-set";
    setBtn.disabled = !isActive;
    setBtn.addEventListener("click", () => {
      const rawValue = Number.parseInt(input.value, 10);
      const sliderValue = Number.isInteger(rawValue) ? rawValue : 5;
      sendAction({ type: "set_slider", slider_index: index, value: sliderValue });
    });

    const sliderLine = document.createElement("div");
    sliderLine.className = "mismatch-slider-line";
    sliderLine.appendChild(input);
    sliderLine.appendChild(valueLabel);

    const labelsLine = document.createElement("div");
    labelsLine.className = "mismatch-slider-labels";
    labelsLine.appendChild(left);
    labelsLine.appendChild(setBtn);
    labelsLine.appendChild(right);

    row.appendChild(sliderLine);
    row.appendChild(labelsLine);
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
  if (!coyotePlayers) {
    return;
  }
  coyotePlayers.innerHTML = "";
  view.players.forEach((p, index) => {
    const card = document.createElement("div");
    card.className = "player-card coyote-player-card";
    const seatIndex = (index % 10) + 1;
    card.classList.add(`coyote-seat-${seatIndex}`);
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
    meta.className = "player-meta coyote-player-meta";
    let cardLabel = p.card;
    if (!cardLabel && p.card_hidden) {
      cardLabel = "Hidden";
    } else if (!cardLabel) {
      cardLabel = "-";
    }
    const maxPenalties = view.config ? view.config.max_penalties : "-";
    const status = p.eliminated ? "out" : "in";
    const cardLine = document.createElement("div");
    cardLine.className = "coyote-player-meta-line";
    cardLine.append("card ");
    const cardValue = document.createElement("span");
    cardValue.textContent = cardLabel;
    if (cardLabel !== "-") {
      cardValue.className = "coyote-card-value";
    }
    cardLine.appendChild(cardValue);

    const penaltiesLine = document.createElement("div");
    penaltiesLine.className = "coyote-player-meta-line";
    penaltiesLine.textContent = `penalties ${p.penalties}/${maxPenalties}`;

    const statusLine = document.createElement("div");
    statusLine.className = "coyote-player-meta-line";
    statusLine.textContent = status;

    meta.append(cardLine, penaltiesLine, statusLine);
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

function updateCatInBoxActionButtons() {
  if (currentGameType !== "cat_in_box") {
    const buttons = [catInBoxDiscardBtn, catInBoxBid1Btn, catInBoxBid2Btn, catInBoxBid3Btn, catInBoxPlayBtn];
    buttons.forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    updateCatInBoxColorButtons(null);
    return;
  }
  const view = currentCatInBoxView;
  const legal = view && Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const canDiscard = legal.includes("discard") && Number.isInteger(catInBoxSelectedCard);
  const canBid = legal.includes("bid");
  const canPlay =
    legal.includes("play_card") &&
    catInBoxIsSelectionLegal(view, catInBoxSelectedCard, catInBoxSelectedColor);

  if (catInBoxDiscardBtn) {
    catInBoxDiscardBtn.disabled = !canDiscard;
    catInBoxDiscardBtn.classList.toggle("action-allowed", canDiscard);
  }
  if (catInBoxBid1Btn) {
    catInBoxBid1Btn.disabled = !canBid;
    catInBoxBid1Btn.classList.toggle("action-allowed", canBid);
  }
  if (catInBoxBid2Btn) {
    catInBoxBid2Btn.disabled = !canBid;
    catInBoxBid2Btn.classList.toggle("action-allowed", canBid);
  }
  if (catInBoxBid3Btn) {
    catInBoxBid3Btn.disabled = !canBid;
    catInBoxBid3Btn.classList.toggle("action-allowed", canBid);
  }
  if (catInBoxPlayBtn) {
    catInBoxPlayBtn.disabled = !canPlay;
    catInBoxPlayBtn.classList.toggle("action-allowed", canPlay);
  }
  updateCatInBoxColorButtons(view);
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

function isYahtzeeActionAvailable(actionType) {
  if (!currentYahtzeeView || !Array.isArray(currentYahtzeeView.legal_actions)) {
    return false;
  }
  return currentYahtzeeView.legal_actions.includes(actionType);
}

function updateYahtzeeActionButtons() {
  if (!yahtzeeRollBtn) {
    return;
  }
  if (currentGameType !== "yahtzee") {
    yahtzeeRollBtn.classList.remove("action-allowed");
    yahtzeeRollBtn.disabled = true;
    return;
  }
  const allowed = isYahtzeeActionAvailable("roll");
  if (allowed) {
    yahtzeeRollBtn.classList.add("action-allowed");
  } else {
    yahtzeeRollBtn.classList.remove("action-allowed");
  }
  yahtzeeRollBtn.disabled = !allowed;
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

function isIncanGoldActionAvailable(actionType) {
  if (!currentIncanGoldView || !Array.isArray(currentIncanGoldView.legal_actions)) {
    return false;
  }
  return currentIncanGoldView.legal_actions.includes(actionType);
}

function updateIncanGoldActionButtons() {
  if (currentGameType !== "incan_gold") {
    Object.values(incanGoldActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  const canDecide = isIncanGoldActionAvailable("decide");
  const canNext = isIncanGoldActionAvailable("next_round");
  const canPlayAgain = isIncanGoldActionAvailable("play_again");
  const states = [
    { el: incanGoldContinueBtn, allowed: canDecide },
    { el: incanGoldLeaveBtn, allowed: canDecide },
    { el: incanGoldNextRoundBtn, allowed: canNext },
    { el: incanGoldPlayAgainBtn, allowed: canPlayAgain },
  ];
  states.forEach(({ el, allowed }) => {
    if (!el) {
      return;
    }
    if (allowed) {
      el.classList.add("action-allowed");
    } else {
      el.classList.remove("action-allowed");
    }
    el.disabled = !allowed;
  });
}

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

function formatHanabiColor(color) {
  return HANABI_COLOR_LABELS[color] || color || "-";
}

function formatHanabiColorShort(color) {
  return HANABI_COLOR_SHORT[color] || (color ? color[0].toUpperCase() : "?");
}

function getHanabiYou(view) {
  if (!view || !Array.isArray(view.players)) {
    return null;
  }
  return view.players.find((p) => p.player_id === view.you) || null;
}

function getHanabiPossibleColors(card) {
  if (!card) {
    return [];
  }
  if (card.known_color) {
    return [card.known_color];
  }
  const notColors = Array.isArray(card.not_colors) ? card.not_colors : [];
  return HANABI_COLORS.filter((color) => !notColors.includes(color));
}

function getHanabiPossibleRanks(card) {
  if (!card) {
    return [];
  }
  if (Number.isInteger(card.known_rank)) {
    return [card.known_rank];
  }
  const notRanks = Array.isArray(card.not_ranks) ? card.not_ranks : [];
  return HANABI_RANKS.filter((rank) => !notRanks.includes(rank));
}

function isHanabiCardDefinitelyUnplayable(view, cardIndex) {
  const you = getHanabiYou(view);
  if (!you || !Array.isArray(you.hand)) {
    return false;
  }
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= you.hand.length) {
    return false;
  }
  const card = you.hand[cardIndex];
  const colors = getHanabiPossibleColors(card);
  const ranks = getHanabiPossibleRanks(card);
  if (!colors.length || !ranks.length) {
    return false;
  }
  for (const color of colors) {
    const current = Number.isInteger(view.tableau?.[color]) ? view.tableau[color] : 0;
    for (const rank of ranks) {
      if (rank === current + 1) {
        return false;
      }
    }
  }
  return true;
}

function updateHanabiSelectedCardLabel(view) {
  if (!hanabiSelectedCardLabel) {
    return;
  }
  const you = getHanabiYou(view);
  if (
    !you ||
    !Number.isInteger(hanabiSelectedCardIndex) ||
    hanabiSelectedCardIndex < 0 ||
    hanabiSelectedCardIndex >= you.hand.length
  ) {
    hanabiSelectedCardLabel.textContent = "-";
    return;
  }
  const card = you.hand[hanabiSelectedCardIndex];
  const knownColor = card.known_color ? formatHanabiColorShort(card.known_color) : "?";
  const knownRank = Number.isInteger(card.known_rank) ? card.known_rank : "?";
  hanabiSelectedCardLabel.textContent = `#${hanabiSelectedCardIndex} Known ${knownColor} ${knownRank}`;
}

function updateHanabiClueOptions(view) {
  if (!hanabiClueTypeSelect || !hanabiClueValueSelect) {
    return;
  }
  if (!view) {
    hanabiClueValueSelect.innerHTML = "";
    return;
  }
  const clueType = hanabiClueTypeSelect.value || "color";
  const targetId = hanabiTargetSelect ? hanabiTargetSelect.value : null;
  const target = view.players.find((p) => p.player_id === targetId);
  const available = new Set();
  if (target && Array.isArray(target.hand)) {
    target.hand.forEach((card) => {
      if (clueType === "color" && card.color) {
        available.add(card.color);
      }
      if (clueType === "rank" && Number.isInteger(card.rank)) {
        available.add(card.rank);
      }
    });
  }
  const sortedValues =
    clueType === "color"
      ? HANABI_COLORS.filter((color) => available.has(color))
      : HANABI_RANKS.filter((rank) => available.has(rank));
  const previousValue = hanabiClueValueSelect.value;
  hanabiClueValueSelect.innerHTML = "";
  sortedValues.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = clueType === "color" ? formatHanabiColor(value) : String(value);
    hanabiClueValueSelect.appendChild(option);
  });
  if (sortedValues.length) {
    const targetValue = sortedValues.some((value) => String(value) === previousValue) ? previousValue : String(sortedValues[0]);
    hanabiClueValueSelect.value = targetValue;
    hanabiClueValueSelect.disabled = false;
    hanabiSelectedClueValue = hanabiClueValueSelect.value;
  } else {
    hanabiClueValueSelect.disabled = true;
    hanabiSelectedClueValue = null;
  }
}

function updateHanabiActionButtons() {
  const buttons = [
    { type: "play", el: hanabiPlayBtn },
    { type: "discard", el: hanabiDiscardBtn },
    { type: "give_clue", el: hanabiClueBtn },
  ];
  if (currentGameType !== "hanabi" || !currentHanabiView) {
    buttons.forEach(({ el }) => {
      if (!el) {
        return;
      }
      el.classList.remove("action-allowed");
      el.disabled = true;
    });
    return;
  }
  const actions = Array.isArray(currentHanabiView.legal_actions) ? currentHanabiView.legal_actions : [];
  const you = getHanabiYou(currentHanabiView);
  const selectedCardValid =
    !!you &&
    Number.isInteger(hanabiSelectedCardIndex) &&
    hanabiSelectedCardIndex >= 0 &&
    hanabiSelectedCardIndex < you.hand.length;
  const clueTarget = hanabiTargetSelect ? hanabiTargetSelect.value : "";
  const clueValue = hanabiClueValueSelect ? hanabiClueValueSelect.value : "";
  const clueTargetValid = !!clueTarget && clueTarget !== currentHanabiView.you;
  const clueValueValid = !!clueValue;
  buttons.forEach(({ type, el }) => {
    if (!el) {
      return;
    }
    let allowed = actions.includes(type);
    if (type === "play" || type === "discard") {
      allowed = allowed && selectedCardValid;
    }
    if (type === "give_clue") {
      allowed = allowed && clueTargetValid && clueValueValid;
    }
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

function stopBlitzSketchDrawTimer() {
  if (blitzSketchDrawTimer) {
    clearTimeout(blitzSketchDrawTimer);
    blitzSketchDrawTimer = null;
  }
}

function stopBlitzSketchCountdown() {
  if (blitzSketchCountdownTimer) {
    clearInterval(blitzSketchCountdownTimer);
    blitzSketchCountdownTimer = null;
  }
  blitzSketchDrawDeadline = null;
}

function stopBlitzSketchDrawTimers() {
  stopBlitzSketchDrawTimer();
  stopBlitzSketchCountdown();
}

function stopBlitzSketchRevealTimer() {
  if (blitzSketchRevealTimer) {
    clearTimeout(blitzSketchRevealTimer);
    blitzSketchRevealTimer = null;
  }
  blitzSketchRevealUntil = null;
}

function stopBlitzSketchTimers() {
  stopBlitzSketchDrawTimers();
  stopBlitzSketchRevealTimer();
}

function clearBlitzSketchCanvas() {
  if (!blitzSketchCtx || !blitzSketchCanvas) {
    return;
  }
  blitzSketchCtx.fillStyle = "#fff";
  blitzSketchCtx.fillRect(0, 0, blitzSketchCanvas.width, blitzSketchCanvas.height);
  blitzSketchCtx.beginPath();
}

function getBlitzSketchPosition(event) {
  const rect = blitzSketchCanvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  const scaleX = rect.width ? blitzSketchCanvas.width / rect.width : 1;
  const scaleY = rect.height ? blitzSketchCanvas.height / rect.height : 1;
  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY,
  };
}

function isBlitzSketchDrawingAllowed() {
  return isBlitzSketchActionAvailable("submit_drawing");
}

function startBlitzSketch(event) {
  if (!blitzSketchCtx || !blitzSketchCanvas || !isBlitzSketchDrawingAllowed()) {
    return;
  }
  event.preventDefault();
  blitzSketchIsDrawing = true;
  const pos = getBlitzSketchPosition(event);
  blitzSketchCtx.beginPath();
  blitzSketchCtx.moveTo(pos.x, pos.y);
}

function moveBlitzSketch(event) {
  if (!blitzSketchIsDrawing || !blitzSketchCtx) {
    return;
  }
  event.preventDefault();
  const pos = getBlitzSketchPosition(event);
  blitzSketchCtx.lineTo(pos.x, pos.y);
  blitzSketchCtx.stroke();
}

function endBlitzSketch(event) {
  if (!blitzSketchIsDrawing || !blitzSketchCtx) {
    return;
  }
  event.preventDefault();
  blitzSketchIsDrawing = false;
  blitzSketchCtx.beginPath();
}

function setupBlitzSketchCanvas() {
  if (!blitzSketchCanvas || !blitzSketchCtx) {
    return;
  }
  blitzSketchCtx.lineCap = "round";
  blitzSketchCtx.lineWidth = 3;
  blitzSketchCtx.strokeStyle = "#000000";
  blitzSketchCtx.globalCompositeOperation = "source-over";
  clearBlitzSketchCanvas();

  blitzSketchCanvas.addEventListener("mousedown", startBlitzSketch);
  blitzSketchCanvas.addEventListener("mousemove", moveBlitzSketch);
  blitzSketchCanvas.addEventListener("mouseup", endBlitzSketch);
  blitzSketchCanvas.addEventListener("mouseleave", endBlitzSketch);

  blitzSketchCanvas.addEventListener("touchstart", startBlitzSketch, { passive: false });
  blitzSketchCanvas.addEventListener("touchmove", moveBlitzSketch, { passive: false });
  blitzSketchCanvas.addEventListener("touchend", endBlitzSketch, { passive: false });
  blitzSketchCanvas.addEventListener("touchcancel", endBlitzSketch, { passive: false });
}

function setBlitzSketchTimer(deadlineMs) {
  if (!blitzSketchTimerLabel) {
    return;
  }
  if (!deadlineMs) {
    blitzSketchTimerLabel.textContent = "-";
    return;
  }
  const remaining = Math.max(0, deadlineMs - Date.now());
  blitzSketchTimerLabel.textContent = `${(remaining / 1000).toFixed(1)}s`;
}

function startBlitzSketchCountdown(deadlineMs) {
  stopBlitzSketchCountdown();
  blitzSketchDrawDeadline = deadlineMs;
  setBlitzSketchTimer(deadlineMs);
  blitzSketchCountdownTimer = setInterval(() => {
    if (!blitzSketchDrawDeadline) {
      stopBlitzSketchCountdown();
      return;
    }
    setBlitzSketchTimer(blitzSketchDrawDeadline);
    if (Date.now() >= blitzSketchDrawDeadline) {
      stopBlitzSketchCountdown();
    }
  }, 100);
}

function scheduleBlitzSketchAutoSubmit(view) {
  if (!view || view.phase !== "draw") {
    stopBlitzSketchDrawTimers();
    return;
  }
  if (!Number.isInteger(view.draw_index) || !Number.isInteger(view.draw_total)) {
    stopBlitzSketchDrawTimers();
    return;
  }
  if (view.draw_index >= view.draw_total) {
    stopBlitzSketchDrawTimers();
    return;
  }
  if (blitzSketchSubmittedDrawIndex === view.draw_index) {
    stopBlitzSketchDrawTimers();
    if (blitzSketchTimerLabel) {
      blitzSketchTimerLabel.textContent = "-";
    }
    return;
  }
  const isNewIndex = blitzSketchActiveDrawIndex !== view.draw_index;
  if (blitzSketchActiveDrawIndex === view.draw_index && blitzSketchDrawTimer) {
    return;
  }
  blitzSketchActiveDrawIndex = view.draw_index;
  if (isNewIndex) {
    clearBlitzSketchCanvas();
  }
  const durationSec = Number.isFinite(view.draw_time_sec) ? view.draw_time_sec : 3;
  const durationMs = Math.max(500, durationSec * 1000);
  const deadline = Date.now() + durationMs;
  startBlitzSketchCountdown(deadline);
  blitzSketchDrawTimer = setTimeout(() => {
    blitzSketchDrawTimer = null;
    if (!blitzSketchCanvas || !isBlitzSketchActionAvailable("submit_drawing")) {
      return;
    }
    blitzSketchSubmittedDrawIndex = view.draw_index;
    sendAction({ type: "submit_drawing", image_data: blitzSketchCanvas.toDataURL("image/png"), index: view.draw_index });
  }, durationMs);
}

function scheduleBlitzSketchReveal(view) {
  stopBlitzSketchRevealTimer();
  if (!view || !view.reveal || !view.reveal.until_ms) {
    return;
  }
  const until = view.reveal.until_ms;
  if (!Number.isFinite(until) || until <= Date.now()) {
    return;
  }
  blitzSketchRevealUntil = until;
  blitzSketchRevealTimer = setTimeout(() => {
    blitzSketchRevealTimer = null;
    blitzSketchRevealUntil = null;
    if (lastGameStatePayload) {
      renderBlitzSketchGameState(lastGameStatePayload);
    }
  }, Math.max(0, until - Date.now()));
}

function isBlitzSketchActionAvailable(actionType) {
  if (currentGameType !== "blitz_sketch" || !currentBlitzSketchView) {
    return false;
  }
  const legal = Array.isArray(currentBlitzSketchView.legal_actions) ? currentBlitzSketchView.legal_actions : [];
  if (!legal.includes(actionType)) {
    const reveal = currentBlitzSketchView.reveal;
    const revealExpired =
      reveal && Number.isFinite(reveal.until_ms) ? reveal.until_ms <= Date.now() : false;
    if (!(revealExpired && (actionType === "submit_guess" || actionType === "skip_guess"))) {
      return false;
    }
  }
  if (actionType === "submit_guess") {
    return !!(blitzSketchInput && blitzSketchInput.value.trim());
  }
  return true;
}

function isBlitzSketchGuessAllowed() {
  if (currentGameType !== "blitz_sketch" || !currentBlitzSketchView) {
    return false;
  }
  if (currentBlitzSketchView.phase !== "guess") {
    return false;
  }
  const legal = Array.isArray(currentBlitzSketchView.legal_actions)
    ? currentBlitzSketchView.legal_actions
    : [];
  if (legal.includes("submit_guess") || legal.includes("skip_guess")) {
    return true;
  }
  const reveal = currentBlitzSketchView.reveal;
  if (reveal && Number.isFinite(reveal.until_ms)) {
    return reveal.until_ms <= Date.now();
  }
  return false;
}

function updateBlitzSketchButtons() {
  if (!blitzSketchSubmitGuessBtn || !blitzSketchSkipBtn) {
    return;
  }
  if (currentGameType !== "blitz_sketch") {
    blitzSketchSubmitGuessBtn.disabled = true;
    blitzSketchSkipBtn.disabled = true;
    return;
  }
  blitzSketchSubmitGuessBtn.disabled = !isBlitzSketchActionAvailable("submit_guess");
  blitzSketchSkipBtn.disabled = !isBlitzSketchActionAvailable("skip_guess");
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
    const media = document.createElement("div");
    media.className = "impression-drawing-media";
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
    media.appendChild(dropzone);
    media.appendChild(image);
    card.appendChild(author);
    card.appendChild(media);
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

function sendImpressionReviewVote(drawingId, vote) {
  if (!drawingId) {
    return;
  }
  sendAction({ type: "review_vote", drawing_id: drawingId, vote });
}

function renderImpressionReview(view) {
  if (!impressionReviewList) {
    return;
  }
  impressionReviewList.innerHTML = "";
  const reviewDrawings = Array.isArray(view.review_drawings) ? view.review_drawings : [];
  if (!reviewDrawings.length) {
    impressionReviewList.textContent = "No review data.";
    return;
  }
  const votesEnabled = !!(view.config && view.config.allow_review_votes);
  reviewDrawings.forEach((drawing) => {
    const card = document.createElement("div");
    card.className = "impression-drawing impression-review-card";
    if (drawing.is_correct === true) {
      card.classList.add("correct");
    } else if (drawing.is_correct === false) {
      card.classList.add("incorrect");
    }

    const author = document.createElement("div");
    author.textContent = drawing.author_name ? `By ${drawing.author_name}` : "By ?";

    const image = document.createElement("img");
    image.src = drawing.image_data;
    image.alt = "drawing";

    const words = document.createElement("div");
    words.className = "impression-review-words";
    const actual = document.createElement("div");
    actual.textContent = `Actual: ${drawing.actual_word ?? "-"}`;
    const guessed = document.createElement("div");
    guessed.textContent = `Guessed: ${drawing.guessed_word ?? "-"}`;
    words.appendChild(actual);
    words.appendChild(guessed);

    card.appendChild(author);
    card.appendChild(image);
    card.appendChild(words);

    if (votesEnabled) {
      const votesRow = document.createElement("div");
      votesRow.className = "impression-review-votes";
      const yourVote = Number(drawing.your_vote) || 0;
      const upCount = Number(drawing.votes_up) || 0;
      const downCount = Number(drawing.votes_down) || 0;
      const total = Number(drawing.vote_total) || 0;

      const canVote =
        view.phase === "round_end" && !view.game_over && drawing.author_id && drawing.author_id !== view.you;

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "impression-review-vote-btn";
      upBtn.textContent = "Up";
      upBtn.disabled = !canVote;
      if (yourVote === 1) {
        upBtn.classList.add("active");
      }
      upBtn.addEventListener("click", () => {
        const nextVote = yourVote === 1 ? 0 : 1;
        sendImpressionReviewVote(drawing.drawing_id, nextVote);
      });

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "impression-review-vote-btn";
      downBtn.textContent = "Down";
      downBtn.disabled = !canVote;
      if (yourVote === -1) {
        downBtn.classList.add("active");
      }
      downBtn.addEventListener("click", () => {
        const nextVote = yourVote === -1 ? 0 : -1;
        sendImpressionReviewVote(drawing.drawing_id, nextVote);
      });

      const counts = document.createElement("span");
      counts.className = "impression-review-vote-count";
      const totalLabel = `${total >= 0 ? "+" : ""}${total}`;
      counts.textContent = `Up ${upCount} / Down ${downCount} (Total ${totalLabel})`;

      votesRow.appendChild(upBtn);
      votesRow.appendChild(downBtn);
      votesRow.appendChild(counts);
      card.appendChild(votesRow);
    }

    impressionReviewList.appendChild(card);
  });
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

function formatBlitzSketchGuess(entry) {
  if (!entry) {
    return "-";
  }
  if (entry.guess_text === null || entry.guess_text === undefined) {
    return "跳过";
  }
  if (typeof entry.guess_text === "string" && entry.guess_text.trim()) {
    return entry.guess_text;
  }
  return "-";
}

function renderBlitzSketchPlayers(view) {
  if (!blitzSketchPlayers) {
    return;
  }
  blitzSketchPlayers.innerHTML = "";
  (view.players || []).forEach((p) => {
    const line = document.createElement("div");
    const tags = [];
    if (p.player_id === view.you) {
      tags.push("you");
    }
    if (p.is_bot) {
      tags.push("bot");
    }
    const drawProgress = `${p.draw_count}/${p.draw_total}`;
    const guessProgress = `${p.guess_count}/${p.guess_total}`;
    line.textContent =
      `${p.seat + 1}. ${p.name || p.player_id} (${tags.join(", ") || "player"})` +
      ` · Draw ${drawProgress} · Guess ${guessProgress} · Score ${p.score}`;
    blitzSketchPlayers.appendChild(line);
  });
}

function renderBlitzSketchReview(view) {
  if (!blitzSketchReview || !blitzSketchReviewGrid) {
    return;
  }
  if (!view.review || !view.review.players) {
    blitzSketchReview.classList.add("hidden");
    blitzSketchReviewGrid.innerHTML = "";
    return;
  }
  blitzSketchReview.classList.remove("hidden");
  blitzSketchReviewGrid.innerHTML = "";
  view.review.players.forEach((player) => {
    const wrapper = document.createElement("div");
    wrapper.className = "blitz-sketch-review-player";
    const title = document.createElement("div");
    const name = player.name || player.player_id || "player";
    title.textContent = `${name} · Score ${player.score ?? 0}`;
    wrapper.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "blitz-sketch-grid";
    (player.drawings || []).forEach((entry) => {
      const cell = document.createElement("div");
      cell.className = "blitz-sketch-cell";
      const img = document.createElement("img");
      img.src = entry.image_data || "";
      img.alt = entry.prompt || "drawing";
      cell.appendChild(img);
      const word = document.createElement("div");
      word.className = "blitz-sketch-meta";
      word.textContent = `词语: ${entry.prompt || "-"}`;
      cell.appendChild(word);
      if (entry.guessed) {
        const guess = document.createElement("div");
        const correct = entry.correct === true;
        guess.className = `blitz-sketch-guess ${correct ? "correct" : "wrong"}`;
        guess.textContent = `猜测: ${formatBlitzSketchGuess(entry)}`;
        cell.appendChild(guess);
      }
      grid.appendChild(cell);
    });
    wrapper.appendChild(grid);
    blitzSketchReviewGrid.appendChild(wrapper);
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

function renderTrekkingGameState(data) {
  const view = data.view;
  currentTrekkingView = view;
  if (currentGameType !== "trekking_history") {
    currentGameType = "trekking_history";
    setGamePanelVisibility("trekking_history");
  }

  syncTrekkingSelection(view);
  updateTrekkingSelectionLabels(view);

  if (trekkingDayLabel) {
    trekkingDayLabel.textContent = view.day || "-";
  }
  const currentPlayer = (view.players || []).find((player) => player.player_id === view.current_turn);
  if (trekkingTurnLabel) {
    trekkingTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (trekkingWinnerLabel) {
    if (view.winner && view.winner.length) {
      trekkingWinnerLabel.textContent = view.winner.map((pid) => findPlayerName(view, pid)).join(", ");
    } else {
      trekkingWinnerLabel.textContent = "-";
    }
  }
  if (trekkingDeckCountLabel) {
    trekkingDeckCountLabel.textContent = `${view.deck_count ?? 0}`;
  }
  if (trekkingDeckTopLabel) {
    if (view.deck_top) {
      trekkingDeckTopLabel.textContent = `${view.deck_top.year_label || view.deck_top.year} ${view.deck_top.title}`;
    } else {
      trekkingDeckTopLabel.textContent = "-";
    }
  }

  renderTrekkingClock(view);
  renderTrekkingMarket(view);
  renderTrekkingPlayers(view);

  logGameEvents(data);
  updateTrekkingActionButtons();
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

function getProjectLYou(view) {
  if (!view) {
    return null;
  }
  return (view.players || []).find((player) => player.player_id === view.you) || null;
}

function projectLRotateMatrix(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) {
    return [];
  }
  const height = matrix.length;
  const width = matrix[0].length;
  const rotated = Array.from({ length: width }, () => Array.from({ length: height }, () => 0));
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      rotated[c][height - 1 - r] = matrix[r][c];
    }
  }
  return rotated;
}

function projectLFlipMatrix(matrix) {
  return matrix.map((row) => row.slice().reverse());
}

function projectLTransformMatrix(matrix, rotation, flip) {
  let transformed = matrix;
  if (flip) {
    transformed = projectLFlipMatrix(transformed);
  }
  const turns = ((rotation % 360) + 360) % 360 / 90;
  for (let i = 0; i < turns; i += 1) {
    transformed = projectLRotateMatrix(transformed);
  }
  return transformed;
}

function projectLMatrixCells(matrix) {
  const cells = [];
  if (!Array.isArray(matrix)) {
    return cells;
  }
  matrix.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value) {
        cells.push([r, c]);
      }
    });
  });
  return cells;
}

function projectLPlacementCells(pieceDef, rotation, flip, row, col) {
  if (!pieceDef || !Array.isArray(pieceDef.shape)) {
    return [];
  }
  const transformed = projectLTransformMatrix(pieceDef.shape, rotation, flip);
  return projectLMatrixCells(transformed).map(([r, c]) => [row + r, col + c]);
}

function projectLOccupiedCells(puzzleState, pieceDefs) {
  const occupied = new Map();
  if (!puzzleState || !Array.isArray(puzzleState.placed)) {
    return occupied;
  }
  puzzleState.placed.forEach((placement) => {
    const def = pieceDefs ? pieceDefs[placement.piece_id] : null;
    if (!def) {
      return;
    }
    const cells = projectLPlacementCells(
      def,
      placement.rotation,
      placement.flip,
      placement.row,
      placement.col,
    );
    cells.forEach(([r, c]) => {
      occupied.set(`${r},${c}`, placement.piece_id);
    });
  });
  return occupied;
}

function projectLValidatePlacement(view, puzzleIndex, pieceId, rotation, flip, row, col) {
  const you = getProjectLYou(view);
  if (!you) {
    return { ok: false, reason: "no player" };
  }
  if (!Number.isInteger(puzzleIndex) || puzzleIndex < 0 || puzzleIndex >= you.active_puzzles.length) {
    return { ok: false, reason: "invalid puzzle" };
  }
  const puzzleState = you.active_puzzles[puzzleIndex];
  const puzzleDef = view.puzzle_defs ? view.puzzle_defs[puzzleState.card_id] : null;
  const pieceDef = view.piece_defs ? view.piece_defs[pieceId] : null;
  if (!puzzleDef || !pieceDef) {
    return { ok: false, reason: "missing data" };
  }
  if (![0, 90, 180, 270].includes(rotation)) {
    return { ok: false, reason: "invalid rotation" };
  }
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return { ok: false, reason: "invalid origin" };
  }
  const transformed = projectLTransformMatrix(pieceDef.shape, rotation, flip);
  const height = transformed.length;
  const width = height ? transformed[0].length : 0;
  if (row < 0 || col < 0 || row + height > puzzleDef.height || col + width > puzzleDef.width) {
    return { ok: false, reason: "out of bounds", cells: projectLMatrixCells(transformed).map(([r, c]) => [row + r, col + c]) };
  }
  const occupied = projectLOccupiedCells(puzzleState, view.piece_defs);
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      if (!transformed[r][c]) {
        continue;
      }
      const gr = row + r;
      const gc = col + c;
      if (!puzzleDef.grid[gr] || puzzleDef.grid[gr][gc] !== 1) {
        return { ok: false, reason: "invalid cell" };
      }
      if (occupied.has(`${gr},${gc}`)) {
        return { ok: false, reason: "occupied" };
      }
    }
  }
  return { ok: true, puzzleState, puzzleDef };
}

function projectLGetSelectedPlacement(view) {
  if (!view || !Number.isInteger(projectLSelectedPuzzleIndex)) {
    return null;
  }
  if (!projectLSelectedPieceId || !projectLSelectedOrigin) {
    return null;
  }
  const you = getProjectLYou(view);
  if (!you || !you.inventory.includes(projectLSelectedPieceId)) {
    return { ok: false, reason: "missing piece" };
  }
  const rotation = ((projectLRotation % 360) + 360) % 360;
  const flip = !!projectLFlip;
  const row = projectLSelectedOrigin.row;
  const col = projectLSelectedOrigin.col;
  const result = projectLValidatePlacement(view, projectLSelectedPuzzleIndex, projectLSelectedPieceId, rotation, flip, row, col);
  return {
    ok: result.ok,
    reason: result.reason,
    puzzle_index: projectLSelectedPuzzleIndex,
    piece_id: projectLSelectedPieceId,
    rotation,
    flip,
    row,
    col,
  };
}

function projectLInventoryCounts(inventory) {
  const counts = {};
  (inventory || []).forEach((pieceId) => {
    counts[pieceId] = (counts[pieceId] || 0) + 1;
  });
  return counts;
}

function projectLCanUpgrade(pieceDefs, fromPiece, toPiece) {
  if (!pieceDefs || !pieceDefs[fromPiece] || !pieceDefs[toPiece]) {
    return false;
  }
  if (fromPiece === toPiece) {
    return false;
  }
  const fromLevel = pieceDefs[fromPiece].level;
  const toLevel = pieceDefs[toPiece].level;
  if (fromLevel === 4) {
    return toLevel === 4;
  }
  if (toLevel === fromLevel + 1) {
    return true;
  }
  if (toLevel === fromLevel && fromLevel >= 3) {
    return true;
  }
  return false;
}

function updateProjectLSelectionLabels(view) {
  const activeView = view || currentProjectLView;
  const you = getProjectLYou(activeView);
  if (projectLSelectedMarketLabel) {
    if (projectLSelectedMarket) {
      let suffix = "";
      if (activeView && activeView.market && activeView.market[projectLSelectedMarket.deck]) {
        const cardId = activeView.market[projectLSelectedMarket.deck][projectLSelectedMarket.index];
        if (cardId) {
          suffix = ` (#${cardId})`;
        }
      }
      projectLSelectedMarketLabel.textContent = `${projectLSelectedMarket.deck} ${projectLSelectedMarket.index + 1}${suffix}`;
    } else {
      projectLSelectedMarketLabel.textContent = "-";
    }
  }
  if (projectLSelectedPuzzleLabel) {
    if (you && Number.isInteger(projectLSelectedPuzzleIndex) && you.active_puzzles[projectLSelectedPuzzleIndex]) {
      const cardId = you.active_puzzles[projectLSelectedPuzzleIndex].card_id;
      projectLSelectedPuzzleLabel.textContent = `#${cardId}`;
    } else {
      projectLSelectedPuzzleLabel.textContent = "-";
    }
  }
  if (projectLSelectedPieceLabel) {
    projectLSelectedPieceLabel.textContent = projectLSelectedPieceId || "-";
  }
  if (projectLSelectedOriginLabel) {
    if (projectLSelectedOrigin) {
      projectLSelectedOriginLabel.textContent = `${projectLSelectedOrigin.row}, ${projectLSelectedOrigin.col}`;
    } else {
      projectLSelectedOriginLabel.textContent = "-";
    }
  }
  if (projectLSelectedRotationLabel) {
    projectLSelectedRotationLabel.textContent = `${((projectLRotation % 360) + 360) % 360}`;
  }
  if (projectLSelectedFlipLabel) {
    projectLSelectedFlipLabel.textContent = projectLFlip ? "Yes" : "No";
  }
}

function syncProjectLSelections(view) {
  if (!view) {
    projectLSelectedMarket = null;
    projectLSelectedPuzzleIndex = null;
    projectLSelectedPieceId = null;
    projectLSelectedOrigin = null;
    projectLMasterQueueItems = [];
    return;
  }
  const you = getProjectLYou(view);
  if (!you) {
    return;
  }
  if (Number.isInteger(projectLSelectedPuzzleIndex)) {
    if (!you.active_puzzles[projectLSelectedPuzzleIndex]) {
      projectLSelectedPuzzleIndex = null;
      projectLSelectedOrigin = null;
    }
  }
  if (projectLSelectedPieceId && !you.inventory.includes(projectLSelectedPieceId)) {
    projectLSelectedPieceId = null;
    projectLSelectedOrigin = null;
  }
  if (projectLSelectedOrigin && Number.isInteger(projectLSelectedPuzzleIndex)) {
    const puzzleState = you.active_puzzles[projectLSelectedPuzzleIndex];
    const puzzleDef = puzzleState && view.puzzle_defs ? view.puzzle_defs[puzzleState.card_id] : null;
    if (
      !puzzleDef
      || projectLSelectedOrigin.row < 0
      || projectLSelectedOrigin.col < 0
      || projectLSelectedOrigin.row >= puzzleDef.height
      || projectLSelectedOrigin.col >= puzzleDef.width
    ) {
      projectLSelectedOrigin = null;
    }
  }
  if (projectLSelectedMarket) {
    const deck = view.market ? view.market[projectLSelectedMarket.deck] : null;
    if (!deck || deck[projectLSelectedMarket.index] == null) {
      projectLSelectedMarket = null;
    }
  }
  projectLMasterQueueItems = projectLMasterQueueItems.filter((placement) => {
    if (!Number.isInteger(placement.puzzle_index)) {
      return false;
    }
    if (!you.active_puzzles[placement.puzzle_index]) {
      return false;
    }
    return you.inventory.includes(placement.piece_id);
  });
}

function getProjectLUpgradeFrom(view) {
  if (projectLUpgradeFromSelect) {
    return projectLUpgradeFromSelect.value || null;
  }
  const you = getProjectLYou(view);
  if (!you) {
    return null;
  }
  if (projectLSelectedPieceId && you.inventory.includes(projectLSelectedPieceId)) {
    return projectLSelectedPieceId;
  }
  return null;
}


function setProjectLSelectedMarket(deck, index) {
  projectLSelectedMarket = { deck, index };
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLMarket(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function setProjectLSelectedPuzzle(index) {
  projectLSelectedPuzzleIndex = index;
  projectLSelectedOrigin = null;
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLActivePuzzles(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function setProjectLSelectedPiece(pieceId) {
  projectLSelectedPieceId = pieceId;
  projectLSelectedOrigin = null;
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLInventory(currentProjectLView);
    renderProjectLActivePuzzles(currentProjectLView);
    updateProjectLUpgradeOptions(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function setProjectLSelectedOrigin(row, col) {
  projectLSelectedOrigin = { row, col };
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLActivePuzzles(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function setProjectLSelectedPuzzleAndOrigin(index, row, col) {
  projectLSelectedPuzzleIndex = index;
  projectLSelectedOrigin = { row, col };
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLActivePuzzles(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function clearProjectLSelection() {
  projectLSelectedMarket = null;
  projectLSelectedPuzzleIndex = null;
  projectLSelectedPieceId = null;
  projectLSelectedOrigin = null;
  projectLRotation = 0;
  projectLFlip = false;
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLMarket(currentProjectLView);
    renderProjectLInventory(currentProjectLView);
    renderProjectLActivePuzzles(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function buildProjectLCard(cardDef) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "project-l-card";
  if (!cardDef) {
    card.classList.add("disabled");
    card.disabled = true;
    card.textContent = "Empty";
    return card;
  }
  const header = document.createElement("div");
  header.className = "project-l-card-header";
  const idLabel = document.createElement("div");
  idLabel.textContent = `#${cardDef.id}`;
  const points = document.createElement("div");
  points.textContent = `${cardDef.points} pts`;
  header.appendChild(idLabel);
  header.appendChild(points);
  card.appendChild(header);

  const reward = document.createElement("div");
  reward.className = "project-l-card-meta";
  reward.textContent = `Reward: ${cardDef.reward_piece_id}`;
  card.appendChild(reward);

  const image = document.createElement("img");
  image.className = "project-l-card-image";
  const cardId = String(cardDef.id).padStart(2, "0");
  image.src = `/static/project_l/project_l_puzzles_svg/card_${cardId}.svg`;
  image.alt = `Puzzle ${cardDef.id}`;
  card.appendChild(image);
  return card;
}

function renderProjectLMarket(view) {
  const renderDeck = (container, deckName) => {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    const cards = (view.market && view.market[deckName]) || [];
    cards.forEach((cardId, index) => {
      const def = view.puzzle_defs ? view.puzzle_defs[cardId] : null;
      const card = buildProjectLCard(def);
      if (projectLSelectedMarket && projectLSelectedMarket.deck === deckName && projectLSelectedMarket.index === index) {
        card.classList.add("selected");
      }
      if (!card.disabled) {
        card.addEventListener("click", () => {
          setProjectLSelectedMarket(deckName, index);
        });
      }
      container.appendChild(card);
    });
    if (!cards.length) {
      const empty = document.createElement("div");
      empty.className = "project-l-card disabled";
      empty.textContent = "Empty";
      container.appendChild(empty);
    }
  };

  renderDeck(projectLMarketWhite, "white");
  renderDeck(projectLMarketBlack, "black");
}

function renderProjectLPuzzleGrid(puzzleDef, puzzleState, puzzleIndex, options) {
  const grid = document.createElement("div");
  grid.className = "project-l-puzzle-grid";
  const cellSize = 20;
  grid.style.setProperty("--project-l-cell", `${cellSize}px`);
  grid.style.width = `${puzzleDef.width * cellSize}px`;
  grid.style.height = `${puzzleDef.height * cellSize}px`;
  const cardId = String(puzzleDef.id).padStart(2, "0");
  const image = document.createElement("img");
  image.className = "project-l-puzzle-image";
  image.src = `/static/project_l/project_l_puzzles_svg/card_${cardId}.svg`;
  image.alt = `Puzzle ${puzzleDef.id}`;
  grid.appendChild(image);

  const overlay = document.createElement("div");
  overlay.className = "project-l-puzzle-overlay";
  grid.appendChild(overlay);

  const occupied = projectLOccupiedCells(puzzleState, currentProjectLView ? currentProjectLView.piece_defs : null);
  const ghostCells = options && options.ghostCells ? options.ghostCells : null;
  const ghostInvalid = options && options.ghostInvalid;

  for (let r = 0; r < puzzleDef.height; r += 1) {
    for (let c = 0; c < puzzleDef.width; c += 1) {
      const cell = document.createElement("div");
      cell.className = "project-l-cell";
      cell.style.setProperty("--row", r);
      cell.style.setProperty("--col", c);
      if (puzzleDef.grid[r][c] === 1) {
        cell.classList.add("slot");
      } else {
        cell.classList.add("off");
      }
      const key = `${r},${c}`;
      if (occupied.has(key)) {
        const pieceId = occupied.get(key);
        const def = currentProjectLView && currentProjectLView.piece_defs
          ? currentProjectLView.piece_defs[pieceId]
          : null;
        if (def && def.color) {
          cell.style.background = def.color;
        } else {
          cell.style.background = "#111827";
        }
      }
      if (ghostCells && ghostCells.has(key)) {
        cell.classList.add("ghost");
        if (ghostInvalid) {
          cell.classList.add("invalid");
        }
      }
      if (puzzleDef.grid[r][c] === 1) {
        cell.addEventListener("click", (event) => {
          event.stopPropagation();
          setProjectLSelectedPuzzleAndOrigin(puzzleIndex, r, c);
        });
      }
      overlay.appendChild(cell);
    }
  }
  return grid;
}

function renderProjectLActivePuzzles(view) {
  if (!projectLActivePuzzles) {
    return;
  }
  const you = getProjectLYou(view);
  projectLActivePuzzles.innerHTML = "";
  if (!you || !Array.isArray(you.active_puzzles) || !you.active_puzzles.length) {
    const empty = document.createElement("div");
    empty.textContent = "No active puzzles.";
    projectLActivePuzzles.appendChild(empty);
    return;
  }
  you.active_puzzles.forEach((puzzleState, index) => {
    const puzzleDef = view.puzzle_defs ? view.puzzle_defs[puzzleState.card_id] : null;
    if (!puzzleDef) {
      return;
    }
    const card = document.createElement("div");
    card.className = "project-l-puzzle-card";
    if (projectLSelectedPuzzleIndex === index) {
      card.classList.add("selected");
    }
    card.addEventListener("click", () => {
      setProjectLSelectedPuzzle(index);
    });

    const header = document.createElement("div");
    header.className = "project-l-card-header";
    header.textContent = `#${puzzleDef.id} - ${puzzleDef.points} pts`;
    card.appendChild(header);

    const reward = document.createElement("div");
    reward.className = "project-l-card-meta";
    reward.textContent = `Reward: ${puzzleDef.reward_piece_id}`;
    card.appendChild(reward);

    let ghostCells = null;
    let ghostInvalid = false;
    if (
      Number.isInteger(projectLSelectedPuzzleIndex)
      && projectLSelectedPuzzleIndex === index
      && projectLSelectedPieceId
      && projectLSelectedOrigin
    ) {
      const pieceDef = view.piece_defs ? view.piece_defs[projectLSelectedPieceId] : null;
      if (pieceDef) {
        const transformed = projectLTransformMatrix(pieceDef.shape, projectLRotation, projectLFlip);
        const cells = projectLMatrixCells(transformed).map(([r, c]) => [
          projectLSelectedOrigin.row + r,
          projectLSelectedOrigin.col + c,
        ]);
        ghostCells = new Set();
        cells.forEach(([r, c]) => {
          if (r >= 0 && c >= 0 && r < puzzleDef.height && c < puzzleDef.width) {
            ghostCells.add(`${r},${c}`);
          }
        });
        const validation = projectLValidatePlacement(
          view,
          projectLSelectedPuzzleIndex,
          projectLSelectedPieceId,
          projectLRotation,
          projectLFlip,
          projectLSelectedOrigin.row,
          projectLSelectedOrigin.col,
        );
        ghostInvalid = !validation.ok;
      }
    }

    const grid = renderProjectLPuzzleGrid(puzzleDef, puzzleState, index, { ghostCells, ghostInvalid });
    card.appendChild(grid);
    projectLActivePuzzles.appendChild(card);
  });
}

function renderProjectLCompleted(view) {
  if (!projectLCompletedPuzzles) {
    return;
  }
  projectLCompletedPuzzles.innerHTML = "";
  const you = getProjectLYou(view);
  const completed = you ? you.completed_puzzles : [];
  if (!completed || !completed.length) {
    projectLCompletedPuzzles.textContent = "-";
    return;
  }
  completed.forEach((cardId) => {
    const chip = document.createElement("div");
    chip.className = "project-l-completed-chip";
    chip.textContent = `#${cardId}`;
    projectLCompletedPuzzles.appendChild(chip);
  });
}

function renderProjectLInventory(view) {
  if (!projectLInventory) {
    return;
  }
  projectLInventory.innerHTML = "";
  const you = getProjectLYou(view);
  if (!you || !Array.isArray(you.inventory) || !you.inventory.length) {
    const empty = document.createElement("div");
    empty.textContent = "No pieces.";
    projectLInventory.appendChild(empty);
    return;
  }
  const counts = projectLInventoryCounts(you.inventory);
  const pieceIds = Object.keys(counts).sort((a, b) => {
    const la = view.piece_defs[a].level;
    const lb = view.piece_defs[b].level;
    if (la !== lb) {
      return la - lb;
    }
    return a.localeCompare(b);
  });
  pieceIds.forEach((pieceId) => {
    const pieceDef = view.piece_defs[pieceId];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-l-piece";
    if (projectLSelectedPieceId === pieceId) {
      button.classList.add("selected");
    }
    button.addEventListener("click", () => {
      setProjectLSelectedPiece(pieceId);
    });

    const grid = document.createElement("div");
    grid.className = "project-l-piece-grid";
    grid.style.gridTemplateColumns = `repeat(${pieceDef.shape[0].length}, 10px)`;
    grid.style.gridAutoRows = "10px";
    pieceDef.shape.forEach((row, r) => {
      row.forEach((value, c) => {
        if (!value) {
          const spacer = document.createElement("div");
          spacer.style.width = "10px";
          spacer.style.height = "10px";
          grid.appendChild(spacer);
          return;
        }
        const cell = document.createElement("div");
        cell.className = "project-l-piece-cell";
        if (pieceDef.color) {
          cell.style.background = pieceDef.color;
        }
        grid.appendChild(cell);
      });
    });
    button.appendChild(grid);

    const label = document.createElement("div");
    label.className = "project-l-piece-label";
    label.textContent = pieceId;
    button.appendChild(label);

    const count = document.createElement("div");
    count.className = "project-l-piece-count";
    count.textContent = `x${counts[pieceId]}`;
    button.appendChild(count);

    projectLInventory.appendChild(button);
  });
}

function renderProjectLMasterQueue(view) {
  if (!projectLMasterQueue) {
    return;
  }
  projectLMasterQueue.innerHTML = "";
  if (!projectLMasterQueueItems.length) {
    projectLMasterQueue.textContent = "-";
    return;
  }
  const you = getProjectLYou(view);
  projectLMasterQueueItems.forEach((placement, index) => {
    const item = document.createElement("div");
    item.className = "project-l-queue-item";
    const label = document.createElement("div");
    let cardLabel = "";
    if (you && you.active_puzzles && you.active_puzzles[placement.puzzle_index]) {
      cardLabel = ` (#${you.active_puzzles[placement.puzzle_index].card_id})`;
    }
    label.textContent = `P${placement.puzzle_index + 1}${cardLabel} ${placement.piece_id} @ ${placement.row},${placement.col} r${placement.rotation} ${placement.flip ? "flip" : ""}`;
    item.appendChild(label);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "project-l-queue-remove";
    remove.textContent = "x";
    remove.addEventListener("click", () => {
      projectLMasterQueueItems.splice(index, 1);
      renderProjectLMasterQueue(view);
      updateProjectLActionButtons();
    });
    item.appendChild(remove);
    projectLMasterQueue.appendChild(item);
  });
}

function renderProjectLPlayers(view) {
  if (!projectLPlayers) {
    return;
  }
  projectLPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
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
    const completed = document.createElement("span");
    completed.className = "badge";
    completed.textContent = `completed ${player.completed_puzzles ? player.completed_puzzles.length : 0}`;
    badges.appendChild(completed);
    const inventory = document.createElement("span");
    inventory.className = "badge";
    inventory.textContent = `pieces ${player.inventory ? player.inventory.length : 0}`;
    badges.appendChild(inventory);
    if (Number.isInteger(player.finishing_placed)) {
      const penalty = document.createElement("span");
      penalty.className = "badge";
      penalty.textContent = `penalty ${player.finishing_placed}`;
      badges.appendChild(penalty);
    }
    if (player.finishing_done) {
      const done = document.createElement("span");
      done.className = "badge";
      done.textContent = "done";
      badges.appendChild(done);
    }
    if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    if (player.player_id === view.you) {
      const youBadge = document.createElement("span");
      youBadge.className = "badge highlight";
      youBadge.textContent = "you";
      badges.appendChild(youBadge);
    }
    header.appendChild(badges);
    card.appendChild(header);
    projectLPlayers.appendChild(card);
  });
}

function isProjectLActionAvailable(actionType) {
  if (!currentProjectLView || !Array.isArray(currentProjectLView.legal_actions)) {
    return false;
  }
  return currentProjectLView.legal_actions.includes(actionType);
}

function updateProjectLActionButtons() {
  const view = currentProjectLView;
  if (!view) {
    return;
  }
  const selection = projectLGetSelectedPlacement(view);
  const canPlace = selection && selection.ok;

  if (projectLTakeLevel1Btn) {
    const allowed = isProjectLActionAvailable("take_level1");
    projectLTakeLevel1Btn.disabled = !allowed;
    projectLTakeLevel1Btn.classList.toggle("action-allowed", allowed);
  }
  if (projectLTakeMarketBtn) {
    const allowed = isProjectLActionAvailable("take_puzzle") && !!projectLSelectedMarket;
    projectLTakeMarketBtn.disabled = !allowed;
    projectLTakeMarketBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLDrawWhiteBtn) {
    const allowed = isProjectLActionAvailable("take_puzzle") && view.white_remaining > 0;
    projectLDrawWhiteBtn.disabled = !allowed;
    projectLDrawWhiteBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLDrawBlackBtn) {
    const allowed = isProjectLActionAvailable("take_puzzle") && view.black_remaining > 0;
    projectLDrawBlackBtn.disabled = !allowed;
    projectLDrawBlackBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLUpgradeBtn) {
    const fromPiece = getProjectLUpgradeFrom(view);
    let allowed = isProjectLActionAvailable("upgrade_piece") && !!fromPiece;
    if (allowed && fromPiece && view && view.piece_defs) {
      allowed = Object.keys(view.piece_defs).some((pieceId) =>
        projectLCanUpgrade(view.piece_defs, fromPiece, pieceId),
      );
    }
    projectLUpgradeBtn.disabled = !allowed;
    projectLUpgradeBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLPlaceBtn) {
    const allowed = isProjectLActionAvailable("place_piece") && canPlace;
    projectLPlaceBtn.disabled = !allowed;
    projectLPlaceBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLQueueMasterBtn) {
    const allowed = isProjectLActionAvailable("master_action") && canPlace;
    projectLQueueMasterBtn.disabled = !allowed;
    projectLQueueMasterBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLClearMasterBtn) {
    const allowed = projectLMasterQueueItems.length > 0;
    projectLClearMasterBtn.disabled = !allowed;
    projectLClearMasterBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLUseMasterBtn) {
    let allowed = isProjectLActionAvailable("master_action") && projectLMasterQueueItems.length > 0;
    if (allowed) {
      const you = getProjectLYou(view);
      const counts = projectLInventoryCounts(you ? you.inventory : []);
      const queueCounts = projectLInventoryCounts(projectLMasterQueueItems.map((entry) => entry.piece_id));
      Object.keys(queueCounts).forEach((pieceId) => {
        if ((counts[pieceId] || 0) < queueCounts[pieceId]) {
          allowed = false;
        }
      });
      projectLMasterQueueItems.forEach((entry) => {
        const validation = projectLValidatePlacement(
          view,
          entry.puzzle_index,
          entry.piece_id,
          entry.rotation,
          entry.flip,
          entry.row,
          entry.col,
        );
        if (!validation.ok) {
          allowed = false;
        }
      });
    }
    projectLUseMasterBtn.disabled = !allowed;
    projectLUseMasterBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLFinishingPlaceBtn) {
    const allowed = isProjectLActionAvailable("finishing_place") && canPlace;
    projectLFinishingPlaceBtn.disabled = !allowed;
    projectLFinishingPlaceBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLFinishingDoneBtn) {
    const allowed = isProjectLActionAvailable("finishing_done");
    projectLFinishingDoneBtn.disabled = !allowed;
    projectLFinishingDoneBtn.classList.toggle("action-allowed", allowed);
  }
}

function renderProjectLGameState(data) {
  const view = data.view;
  currentProjectLView = view;
  if (currentGameType !== "project_l") {
    currentGameType = "project_l";
    setGamePanelVisibility("project_l");
  }
  syncProjectLSelections(view);
  if (projectLUpgradeModal && !projectLUpgradeModal.classList.contains("hidden")) {
    renderProjectLUpgradeModal(view);
  }

  if (projectLPhaseLabel) {
    projectLPhaseLabel.textContent = view.phase || "-";
  }
  if (projectLApLabel) {
    if (view.phase === "main" && Number.isInteger(view.ap_remaining)) {
      projectLApLabel.textContent = view.ap_remaining;
    } else {
      projectLApLabel.textContent = "-";
    }
  }
  if (projectLTurnLabel) {
    const currentPlayer = (view.players || []).find((p) => p.player_id === view.current_turn);
    projectLTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (projectLMasterUsedLabel) {
    projectLMasterUsedLabel.textContent = view.master_used ? "Yes" : "No";
  }
  if (projectLWhiteRemainingLabel) {
    projectLWhiteRemainingLabel.textContent = view.white_remaining ?? "-";
  }
  if (projectLBlackRemainingLabel) {
    projectLBlackRemainingLabel.textContent = view.black_remaining ?? "-";
  }
  if (projectLEndTriggeredLabel) {
    projectLEndTriggeredLabel.textContent = view.end_triggered ? "Yes" : "No";
  }
  if (projectLWinnerLabel) {
    if (view.winner && view.winner.length) {
      projectLWinnerLabel.textContent = view.winner.map((pid) => findPlayerName(view, pid)).join(", ");
    } else {
      projectLWinnerLabel.textContent = "-";
    }
  }

  updateProjectLSelectionLabels(view);
  renderProjectLMarket(view);
  renderProjectLActivePuzzles(view);
  renderProjectLCompleted(view);
  renderProjectLInventory(view);
  renderProjectLMasterQueue(view);
  renderProjectLPlayers(view);
  logGameEvents(data);
  updateProjectLActionButtons();
}

function updateCarcassonneRotationLabel() {
  if (carcRotationLabel) {
    carcRotationLabel.textContent = `${carcRotation}°`;
  }
}

function normalizeCarcassonnePositions(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => {
    if (Array.isArray(item)) {
      return { x: item[0], y: item[1] };
    }
    if (item && typeof item === "object") {
      return { x: item.x, y: item.y };
    }
    return null;
  }).filter(Boolean);
}

const CARC_SIDES = ["N", "E", "S", "W"];
const CARC_OPPOSITE_SIDE = { N: "S", S: "N", E: "W", W: "E" };
const CARC_SLOT_ROTATE_90 = {
  N0: "E0",
  N1: "E1",
  E0: "S1",
  E1: "S0",
  S0: "W0",
  S1: "W1",
  W0: "N1",
  W1: "N0",
};
const CARC_OPPOSITE_SLOT = {
  N0: "S0",
  N1: "S1",
  S0: "N0",
  S1: "N1",
  E0: "W0",
  E1: "W1",
  W0: "E0",
  W1: "E1",
};
const CARC_SIDE_DELTAS = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

function decodeCarcassonneMap(payload) {
  if (!payload || typeof payload !== "string") {
    return null;
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function prepareCarcassonneTemplates(data) {
  if (!data || !data.tiles) {
    return null;
  }
  const tiles = data.tiles;
  Object.keys(tiles).forEach((tileType) => {
    const tile = tiles[tileType];
    tile._roadMap = decodeCarcassonneMap(tile.road_map);
    tile._cityMap = decodeCarcassonneMap(tile.city_map);
    tile._fieldMap = decodeCarcassonneMap(tile.field_map);
    tile._monasteryMap = decodeCarcassonneMap(tile.monastery_map);
    tile._roadSegments = Array.isArray(tile.road_segments) ? tile.road_segments : [];
    tile._citySegments = Array.isArray(tile.city_segments) ? tile.city_segments : [];
    tile._fieldSegments = Array.isArray(tile.field_segments) ? tile.field_segments : [];
  });
  carcTemplateCache = {};
  carcSegmentImageCache = new Map();
  return data;
}

function loadCarcassonneTemplates() {
  if (carcTemplatePromise) {
    return carcTemplatePromise;
  }
  carcTemplatePromise = fetch("/api/carcassonne/templates")
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((data) => {
      carcTemplateData = prepareCarcassonneTemplates(data);
      return carcTemplateData;
    })
    .catch((err) => {
      console.warn("Failed to load Carcassonne templates", err);
      carcTemplateData = null;
      return null;
    });
  return carcTemplatePromise;
}

function rotateCarcassonneSide(side, rotation) {
  const turns = ((rotation % 360) + 360) % 360 / 90;
  const idx = CARC_SIDES.indexOf(side);
  if (idx === -1) {
    return side;
  }
  return CARC_SIDES[(idx + turns) % 4];
}

function rotateCarcassonneSlot(slot, rotation) {
  let result = slot;
  const turns = ((rotation % 360) + 360) % 360 / 90;
  for (let i = 0; i < turns; i += 1) {
    result = CARC_SLOT_ROTATE_90[result] || result;
  }
  return result;
}

function rotateCarcassonnePointToBase(x, y, rotation) {
  let px = x;
  let py = y;
  const turns = ((rotation % 360) + 360) % 360 / 90;
  for (let i = 0; i < turns; i += 1) {
    const nx = py;
    const ny = 1 - px;
    px = nx;
    py = ny;
  }
  return { x: px, y: py };
}

function buildCarcassonneSegmentMask(tileType, rotation, feature, segment) {
  if (!carcTemplateData || !carcTemplateData.tiles) {
    return null;
  }
  const tile = carcTemplateData.tiles[tileType];
  if (!tile) {
    return null;
  }
  let sourceMap = null;
  if (feature === "road") {
    sourceMap = tile._roadMap;
  } else if (feature === "city") {
    sourceMap = tile._cityMap;
  } else if (feature === "field") {
    sourceMap = tile._fieldMap;
  } else if (feature === "monastery") {
    sourceMap = tile._monasteryMap;
    segment = 0;
  }
  if (!sourceMap) {
    return null;
  }
  const size = carcTemplateData.grid_size || 100;
  const mask = new Uint8Array(size * size);
  const turns = ((rotation % 360) + 360) % 360;
  if (turns === 0) {
    for (let idx = 0; idx < sourceMap.length; idx += 1) {
      if (sourceMap[idx] === segment) {
        mask[idx] = 1;
      }
    }
    return mask;
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const base = rotateCarcassonnePointToBase(nx, ny, rotation);
      const bx = Math.max(0, Math.min(size - 1, Math.floor(base.x * size)));
      const by = Math.max(0, Math.min(size - 1, Math.floor(base.y * size)));
      const bidx = by * size + bx;
      if (sourceMap[bidx] === segment) {
        mask[y * size + x] = 1;
      }
    }
  }
  return mask;
}

function getCarcassonneSegmentImage(tileType, rotation, feature, segment) {
  const key = `${tileType}:${rotation}:${feature}:${segment}`;
  if (carcSegmentImageCache.has(key)) {
    return carcSegmentImageCache.get(key);
  }
  const mask = buildCarcassonneSegmentMask(tileType, rotation, feature, segment);
  if (!mask || !carcTemplateData) {
    return null;
  }
  const size = carcTemplateData.grid_size || 100;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.imageSmoothingEnabled = false;
  let fill = "rgba(14, 116, 144, 0.18)";
  let stroke = "rgba(14, 116, 144, 0.9)";
  if (feature === "road") {
    fill = "rgba(217, 119, 6, 0.22)";
    stroke = "rgba(217, 119, 6, 0.95)";
  } else if (feature === "city") {
    fill = "rgba(71, 85, 105, 0.25)";
    stroke = "rgba(71, 85, 105, 0.95)";
  } else if (feature === "field") {
    fill = "rgba(34, 197, 94, 0.2)";
    stroke = "rgba(34, 197, 94, 0.95)";
  }
  ctx.fillStyle = fill;
  for (let y = 0; y < size; y += 1) {
    let rowStart = y * size;
    for (let x = 0; x < size; x += 1) {
      if (mask[rowStart + x]) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.fillStyle = stroke;
  const thickness = 4;
  const radius = Math.floor(thickness / 2);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = y * size + x;
      if (!mask[idx]) {
        continue;
      }
      const north = y === 0 ? 0 : mask[idx - size];
      const south = y === size - 1 ? 0 : mask[idx + size];
      const west = x === 0 ? 0 : mask[idx - 1];
      const east = x === size - 1 ? 0 : mask[idx + 1];
      if (north && south && west && east) {
        continue;
      }
      for (let dy = -radius; dy <= radius; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= size) {
          continue;
        }
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= size) {
            continue;
          }
          ctx.fillRect(nx, ny, 1, 1);
        }
      }
    }
  }
  const url = canvas.toDataURL("image/png");
  carcSegmentImageCache.set(key, url);
  return url;
}

function getCarcassonneTileAt(view, worldX, worldY) {
  if (!view || !Array.isArray(view.board)) {
    return null;
  }
  const origin = view.board_origin || { x: 0, y: 0 };
  const row = view.board[worldY - origin.y];
  if (!row) {
    return null;
  }
  return row[worldX - origin.x] || null;
}

function getCarcassonneRotatedMeta(tileType, rotation) {
  if (!carcTemplateData || !carcTemplateData.tiles) {
    return null;
  }
  const key = `${tileType}:${rotation}`;
  if (carcTemplateCache[key]) {
    return carcTemplateCache[key];
  }
  const tile = carcTemplateData.tiles[tileType];
  if (!tile) {
    return null;
  }
  const roadSegments = tile._roadSegments.map((edges) => edges.map((side) => rotateCarcassonneSide(side, rotation)));
  const citySegments = tile._citySegments.map((edges) => edges.map((side) => rotateCarcassonneSide(side, rotation)));
  const fieldSegments = tile._fieldSegments.map((slots) => slots.map((slot) => rotateCarcassonneSlot(slot, rotation)));
  const edgeToRoad = {};
  roadSegments.forEach((edges, idx) => {
    edges.forEach((side) => {
      edgeToRoad[side] = idx;
    });
  });
  const edgeToCity = {};
  citySegments.forEach((edges, idx) => {
    edges.forEach((side) => {
      edgeToCity[side] = idx;
    });
  });
  const slotToField = {};
  fieldSegments.forEach((slots, idx) => {
    slots.forEach((slot) => {
      slotToField[slot] = idx;
    });
  });
  const meta = {
    roadSegments,
    citySegments,
    fieldSegments,
    edgeToRoad,
    edgeToCity,
    slotToField,
  };
  carcTemplateCache[key] = meta;
  return meta;
}

function getCarcassonneHoverFeature(tileType, rotation, x, y) {
  if (!carcTemplateData || !carcTemplateData.tiles) {
    return null;
  }
  const tile = carcTemplateData.tiles[tileType];
  if (!tile || !tile._roadMap || !tile._cityMap || !tile._fieldMap) {
    return null;
  }
  const base = rotateCarcassonnePointToBase(x, y, rotation);
  const size = carcTemplateData.grid_size || 100;
  const noneValue = carcTemplateData.none_value ?? 255;
  const gx = Math.max(0, Math.min(size - 1, Math.floor(base.x * size)));
  const gy = Math.max(0, Math.min(size - 1, Math.floor(base.y * size)));
  const idx = gy * size + gx;
  const roadSeg = tile._roadMap[idx];
  if (roadSeg !== noneValue) {
    return { feature: "road", segment: roadSeg };
  }
  const citySeg = tile._cityMap[idx];
  if (citySeg !== noneValue) {
    return { feature: "city", segment: citySeg };
  }
  if (tile._monasteryMap) {
    const monSeg = tile._monasteryMap[idx];
    if (monSeg !== noneValue) {
      return { feature: "monastery", segment: null };
    }
  }
  const fieldSeg = tile._fieldMap[idx];
  if (fieldSeg !== noneValue) {
    return { feature: "field", segment: fieldSeg };
  }
  return null;
}

function collectCarcassonneConnectedNodes(view, startX, startY, feature, segment) {
  const nodesByTile = new Map();
  if (feature === "monastery") {
    nodesByTile.set(`${startX},${startY}`, new Set([0]));
    return nodesByTile;
  }
  const visited = new Set();
  const queue = [{ x: startX, y: startY, seg: segment }];
  while (queue.length) {
    const current = queue.pop();
    const nodeKey = `${current.x},${current.y},${current.seg}`;
    if (visited.has(nodeKey)) {
      continue;
    }
    visited.add(nodeKey);
    const tile = getCarcassonneTileAt(view, current.x, current.y);
    if (!tile) {
      continue;
    }
    const tileKey = `${current.x},${current.y}`;
    if (!nodesByTile.has(tileKey)) {
      nodesByTile.set(tileKey, new Set());
    }
    nodesByTile.get(tileKey).add(current.seg);
    const meta = getCarcassonneRotatedMeta(tile.type, tile.rotation || 0);
    if (!meta) {
      continue;
    }
    if (feature === "road") {
      const edges = meta.roadSegments[current.seg] || [];
      edges.forEach((side) => {
        const delta = CARC_SIDE_DELTAS[side];
        if (!delta) {
          return;
        }
        const nx = current.x + delta.x;
        const ny = current.y + delta.y;
        const neighbor = getCarcassonneTileAt(view, nx, ny);
        if (!neighbor) {
          return;
        }
        const neighborMeta = getCarcassonneRotatedMeta(neighbor.type, neighbor.rotation || 0);
        if (!neighborMeta) {
          return;
        }
        const nseg = neighborMeta.edgeToRoad[CARC_OPPOSITE_SIDE[side]];
        if (Number.isInteger(nseg)) {
          queue.push({ x: nx, y: ny, seg: nseg });
        }
      });
    } else if (feature === "city") {
      const edges = meta.citySegments[current.seg] || [];
      edges.forEach((side) => {
        const delta = CARC_SIDE_DELTAS[side];
        if (!delta) {
          return;
        }
        const nx = current.x + delta.x;
        const ny = current.y + delta.y;
        const neighbor = getCarcassonneTileAt(view, nx, ny);
        if (!neighbor) {
          return;
        }
        const neighborMeta = getCarcassonneRotatedMeta(neighbor.type, neighbor.rotation || 0);
        if (!neighborMeta) {
          return;
        }
        const nseg = neighborMeta.edgeToCity[CARC_OPPOSITE_SIDE[side]];
        if (Number.isInteger(nseg)) {
          queue.push({ x: nx, y: ny, seg: nseg });
        }
      });
    } else if (feature === "field") {
      const slots = meta.fieldSegments[current.seg] || [];
      slots.forEach((slot) => {
        const side = slot ? slot[0] : null;
        const delta = side ? CARC_SIDE_DELTAS[side] : null;
        if (!delta) {
          return;
        }
        const nx = current.x + delta.x;
        const ny = current.y + delta.y;
        const neighbor = getCarcassonneTileAt(view, nx, ny);
        if (!neighbor) {
          return;
        }
        const neighborMeta = getCarcassonneRotatedMeta(neighbor.type, neighbor.rotation || 0);
        if (!neighborMeta) {
          return;
        }
        const oppositeSlot = CARC_OPPOSITE_SLOT[slot];
        const nseg = neighborMeta.slotToField[oppositeSlot];
        if (Number.isInteger(nseg)) {
          queue.push({ x: nx, y: ny, seg: nseg });
        }
      });
    }
  }
  return nodesByTile;
}

function clearCarcassonneHighlight(kind) {
  const targetSet = kind === "selected" ? carcSelectedTiles : carcHoverTiles;
  if (!targetSet.size) {
    if (kind === "hover") {
      carcHoverKey = null;
    }
    return;
  }
  targetSet.forEach((key) => {
    const cell = carcCellMap.get(key);
    if (!cell) {
      return;
    }
    cell.classList.remove(kind === "selected" ? "carc-selected" : "carc-hover");
    const selector = kind === "selected" ? ".carc-selected-shape" : ".carc-hover-shape";
    cell.querySelectorAll(selector).forEach((el) => el.remove());
  });
  targetSet.clear();
  if (kind === "hover") {
    carcHoverKey = null;
  }
}

function applyCarcassonneHighlight(feature, nodesByTile, kind) {
  clearCarcassonneHighlight(kind);
  const newSet = new Set();
  nodesByTile.forEach((segments, key) => {
    const cell = carcCellMap.get(key);
    if (!cell) {
      return;
    }
    cell.classList.add(kind === "selected" ? "carc-selected" : "carc-hover");
    const tileType = cell.dataset.tileType;
    const rotation = Number(cell.dataset.rotation || 0);
    segments.forEach((seg) => {
      const image = getCarcassonneSegmentImage(tileType, rotation, feature, seg);
      if (!image) {
        return;
      }
      const overlay = document.createElement("div");
      overlay.className = `carc-highlight-shape ${kind === "selected" ? "carc-selected-shape" : "carc-hover-shape"}`;
      overlay.style.backgroundImage = `url(${image})`;
      cell.appendChild(overlay);
    });
    newSet.add(key);
  });
  if (kind === "selected") {
    carcSelectedTiles = newSet;
  } else {
    carcHoverTiles = newSet;
  }
}

function handleCarcassonneHover(event) {
  if (!currentCarcassonneView || !carcTemplateData) {
    return;
  }
  const cell = event.target.closest(".carc-cell.occupied");
  if (!cell || !carcBoard || !carcBoard.contains(cell)) {
    clearCarcassonneHighlight("hover");
    return;
  }
  const rect = cell.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const localX = (event.clientX - rect.left) / rect.width;
  const localY = (event.clientY - rect.top) / rect.height;
  if (localX < 0 || localX > 1 || localY < 0 || localY > 1) {
    clearCarcassonneHighlight();
    return;
  }
  const tileType = cell.dataset.tileType;
  const rotation = Number(cell.dataset.rotation || 0);
  const worldX = Number(cell.dataset.worldX);
  const worldY = Number(cell.dataset.worldY);
  if (!tileType || !Number.isInteger(worldX) || !Number.isInteger(worldY)) {
    clearCarcassonneHighlight();
    return;
  }
  const featureInfo = getCarcassonneHoverFeature(tileType, rotation, localX, localY);
  if (!featureInfo) {
    clearCarcassonneHighlight("hover");
    return;
  }
  const key = `${worldX},${worldY}:${featureInfo.feature}:${featureInfo.segment}`;
  if (key === carcHoverKey) {
    return;
  }
  const nodes = collectCarcassonneConnectedNodes(
    currentCarcassonneView,
    worldX,
    worldY,
    featureInfo.feature,
    featureInfo.segment,
  );
  applyCarcassonneHighlight(featureInfo.feature, nodes, "hover");
  carcHoverKey = key;
}

function getMeepleOptionKey(feature, segment) {
  return `${feature}:${segment === null || segment === undefined ? "null" : segment}`;
}

function isMeepleOptionAvailable(feature, segment) {
  return carcMeepleOptionSet.has(getMeepleOptionKey(feature, segment));
}

function describeCarcassonneSelection(view, feature, segment) {
  if (feature === "monastery") {
    return "Monastery";
  }
  if (!view || !view.last_placed) {
    return `${feature} ${segment + 1}`;
  }
  const tile = getCarcassonneTileAt(view, view.last_placed.x, view.last_placed.y);
  if (!tile) {
    return `${feature} ${segment + 1}`;
  }
  const meta = getCarcassonneRotatedMeta(tile.type, tile.rotation || 0);
  if (!meta) {
    return `${feature} ${segment + 1}`;
  }
  if (feature === "road") {
    const edges = meta.roadSegments[segment] || [];
    return `Road · ${edges.join("+") || segment + 1}`;
  }
  if (feature === "city") {
    const edges = meta.citySegments[segment] || [];
    return `City · ${edges.join("+") || segment + 1}`;
  }
  if (feature === "field") {
    const slots = meta.fieldSegments[segment] || [];
    return `Field · ${slots.join("+") || segment + 1}`;
  }
  return `${feature} ${segment + 1}`;
}

function updateCarcassonneMeepleSelectionLabel(view) {
  if (!carcMeepleSelection) {
    return;
  }
  if (!carcSelectedMeeple) {
    carcMeepleSelection.textContent = "Selected: -";
    return;
  }
  const label = describeCarcassonneSelection(view, carcSelectedMeeple.feature, carcSelectedMeeple.segment);
  carcMeepleSelection.textContent = `Selected: ${label}`;
}

function clearCarcassonneSelection() {
  carcSelectedMeeple = null;
  clearCarcassonneHighlight("selected");
  if (currentCarcassonneView) {
    updateCarcassonneMeepleSelectionLabel(currentCarcassonneView);
    updateCarcassonneControls(currentCarcassonneView);
  } else if (carcMeepleSelection) {
    carcMeepleSelection.textContent = "Selected: -";
  }
}

function selectCarcassonneMeeple(view, feature, segment, worldX, worldY) {
  if (!view || !view.last_placed) {
    return;
  }
  if (!isMeepleOptionAvailable(feature, segment)) {
    log("That feature is not available for meeple placement.");
    return;
  }
  const nodes = collectCarcassonneConnectedNodes(view, worldX, worldY, feature, segment);
  applyCarcassonneHighlight(feature, nodes, "selected");
  carcSelectedMeeple = { feature, segment, x: worldX, y: worldY };
  updateCarcassonneMeepleSelectionLabel(view);
  updateCarcassonneControls(view);
}

function handleCarcassonneMeepleSelect(event) {
  if (!currentCarcassonneView || !carcTemplateData) {
    return;
  }
  const actions = Array.isArray(currentCarcassonneView.legal_actions)
    ? currentCarcassonneView.legal_actions
    : [];
  if (!actions.includes("place_meeple")) {
    return;
  }
  const last = currentCarcassonneView.last_placed;
  if (!last) {
    return;
  }
  const cell = event.target.closest(".carc-cell.occupied");
  if (!cell || !carcBoard || !carcBoard.contains(cell)) {
    return;
  }
  const worldX = Number(cell.dataset.worldX);
  const worldY = Number(cell.dataset.worldY);
  if (worldX !== last.x || worldY !== last.y) {
    log("Meeple must be placed on the last placed tile.");
    return;
  }
  const rect = cell.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const localX = (event.clientX - rect.left) / rect.width;
  const localY = (event.clientY - rect.top) / rect.height;
  if (localX < 0 || localX > 1 || localY < 0 || localY > 1) {
    return;
  }
  const tileType = cell.dataset.tileType;
  const rotation = Number(cell.dataset.rotation || 0);
  const featureInfo = getCarcassonneHoverFeature(tileType, rotation, localX, localY);
  if (!featureInfo) {
    log("No feature found at that point.");
    return;
  }
  selectCarcassonneMeeple(currentCarcassonneView, featureInfo.feature, featureInfo.segment, worldX, worldY);
}

function getCarcassonneLegalSet(view, rotation) {
  const positions = view && view.legal_positions ? (view.legal_positions[rotation] || view.legal_positions[String(rotation)]) : [];
  const normalized = normalizeCarcassonnePositions(positions);
  const set = new Set();
  normalized.forEach((pos) => {
    if (Number.isInteger(pos.x) && Number.isInteger(pos.y)) {
      set.add(`${pos.x},${pos.y}`);
    }
  });
  return set;
}

function renderCarcassonneBoard(view) {
  if (!carcBoard) {
    return;
  }
  const board = Array.isArray(view.board) ? view.board : [];
  const rows = board.length;
  const cols = rows ? board[0].length : 0;
  carcBoard.style.gridTemplateColumns = cols ? `repeat(${cols}, var(--carc-cell))` : "none";
  if (cols) {
    const maxWidth = Math.max(240, window.innerWidth - 80);
    const gap = 2;
    const pad = 12;
    const span = Math.max(rows, cols);
    const rawSize = Math.floor((maxWidth - (span - 1) * gap - pad) / span);
    const cellSize = Math.max(28, Math.min(64, rawSize));
    carcBoard.style.setProperty("--carc-cell", `${cellSize}px`);
  }
  carcBoard.innerHTML = "";
  carcCellMap.clear();
  carcHoverTiles.clear();
  carcHoverKey = null;
  if (!rows || !cols) {
    return;
  }
  const origin = view.board_origin || { x: 0, y: 0 };
  const actions = Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const canPlace = actions.includes("place_tile") && view.pending_tile;
  const legalSet = canPlace ? getCarcassonneLegalSet(view, carcRotation) : new Set();

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = document.createElement("div");
      cell.className = "carc-cell";
      const worldX = origin.x + x;
      const worldY = origin.y + y;
      const tile = board[y][x];
      if (tile) {
        cell.classList.add("occupied");
        cell.dataset.worldX = worldX;
        cell.dataset.worldY = worldY;
        cell.dataset.tileType = tile.type;
        cell.dataset.rotation = tile.rotation || 0;
        carcCellMap.set(`${worldX},${worldY}`, cell);
        const tileEl = document.createElement("div");
        tileEl.className = "carc-tile";
        tileEl.style.backgroundImage = `url(/static/carcassonne/${tile.type}.svg)`;
        tileEl.style.transform = `rotate(${tile.rotation || 0}deg)`;
        cell.appendChild(tileEl);
        if (tile.meeple) {
          const meeple = document.createElement("div");
          meeple.className = `carc-meeple ${tile.meeple.color || ""}`;
          const label = (tile.meeple.feature || "").slice(0, 1);
          meeple.textContent = label ? label.toUpperCase() : "";
          if (tile.meeple.pos && typeof tile.meeple.pos.x === "number" && typeof tile.meeple.pos.y === "number") {
            meeple.style.left = `${tile.meeple.pos.x * 100}%`;
            meeple.style.top = `${tile.meeple.pos.y * 100}%`;
          }
          cell.appendChild(meeple);
        }
      } else if (legalSet.has(`${worldX},${worldY}`)) {
        cell.classList.add("legal");
        cell.addEventListener("click", () => {
          if (!canPlace) {
            return;
          }
          sendAction({ type: "place_tile", x: worldX, y: worldY, rotation: carcRotation });
        });
      }
      carcBoard.appendChild(cell);
    }
  }
  if (carcSelectedMeeple && carcTemplateData) {
    const last = view.last_placed;
    if (last && carcSelectedMeeple.x === last.x && carcSelectedMeeple.y === last.y) {
      const nodes = collectCarcassonneConnectedNodes(
        view,
        carcSelectedMeeple.x,
        carcSelectedMeeple.y,
        carcSelectedMeeple.feature,
        carcSelectedMeeple.segment,
      );
      applyCarcassonneHighlight(carcSelectedMeeple.feature, nodes, "selected");
    } else {
      clearCarcassonneSelection();
    }
  }
}

function renderCarcassonnePendingTile(view) {
  if (!carcPendingTile) {
    return;
  }
  carcPendingTile.innerHTML = "";
  if (!view.pending_tile) {
    carcPendingTile.textContent = "-";
    return;
  }
  const tile = document.createElement("div");
  tile.className = "carc-tile";
  tile.style.backgroundImage = `url(/static/carcassonne/${view.pending_tile.type}.svg)`;
  tile.style.transform = `rotate(${carcRotation}deg)`;
  carcPendingTile.appendChild(tile);
}

function renderCarcassonneMeepleOptions(view) {
  if (!carcMeepleOptions) {
    return;
  }
  carcMeepleOptions.innerHTML = "";
  const options = Array.isArray(view.meeple_options) ? view.meeple_options : [];
  carcMeepleOptionSet = new Set();
  if (!options.length) {
    carcMeepleOptions.textContent = "-";
    return;
  }
  options.forEach((option) => {
    carcMeepleOptionSet.add(getMeepleOptionKey(option.feature, option.segment));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = option.label || option.feature || "-";
    btn.addEventListener("click", () => {
      const last = view.last_placed;
      if (!last) {
        return;
      }
      selectCarcassonneMeeple(view, option.feature, option.segment ?? null, last.x, last.y);
    });
    carcMeepleOptions.appendChild(btn);
  });
}

function renderCarcassonnePlayers(view) {
  if (!carcPlayers) {
    return;
  }
  carcPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "carc-player-row";
    if (player.player_id === view.you) {
      row.classList.add("player-you");
    }
    const left = document.createElement("div");
    left.className = "carc-player-left";
    const marker = player.player_id === view.current_turn ? "▶ " : "";
    const nameSpan = document.createElement("span");
    nameSpan.className = "carc-player-name";
    if (player.color) {
      nameSpan.classList.add(`carc-color-${player.color}`);
    }
    nameSpan.textContent = `${marker}${player.name || player.player_id}`;
    const metaSpan = document.createElement("span");
    metaSpan.className = "carc-player-meta";
    metaSpan.textContent = ` (${player.color || "-"})`;
    left.appendChild(nameSpan);
    left.appendChild(metaSpan);
    const right = document.createElement("div");
    right.textContent = `${player.score ?? 0} pts · ${player.meeples ?? 0} meeples`;
    row.appendChild(left);
    row.appendChild(right);
    carcPlayers.appendChild(row);
  });
}

function updateCarcassonneControls(view) {
  const actions = Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const canPlace = actions.includes("place_tile");
  const canSkip = actions.includes("skip_meeple");
  const canPlaceMeeple = actions.includes("place_meeple");
  if (carcRotateLeftBtn) {
    carcRotateLeftBtn.disabled = !canPlace;
  }
  if (carcRotateRightBtn) {
    carcRotateRightBtn.disabled = !canPlace;
  }
  if (carcSkipMeepleBtn) {
    carcSkipMeepleBtn.disabled = !canSkip;
  }
  if (carcConfirmMeepleBtn) {
    carcConfirmMeepleBtn.disabled = !canPlaceMeeple || !carcSelectedMeeple;
  }
  if (carcClearMeepleBtn) {
    carcClearMeepleBtn.disabled = !carcSelectedMeeple;
  }
  if (carcMeepleHint) {
    carcMeepleHint.textContent = canPlaceMeeple ? "Click a feature on the last placed tile." : "-";
  }
}

function renderCarcassonneGameState(data) {
  const view = data.view;
  currentCarcassonneView = view;
  loadCarcassonneTemplates();
  const last = view.last_placed;
  if (!last || view.phase !== "place_meeple") {
    clearCarcassonneSelection();
  } else if (carcSelectedMeeple) {
    if (carcSelectedMeeple.x !== last.x || carcSelectedMeeple.y !== last.y) {
      clearCarcassonneSelection();
    }
  }
  if (currentGameType !== "carcassonne") {
    currentGameType = "carcassonne";
    setGamePanelVisibility("carcassonne");
  }
  if (carcPhaseLabel) {
    carcPhaseLabel.textContent = view.phase || "-";
  }
  if (carcTurnLabel) {
    const currentPlayer = (view.players || []).find((p) => p.player_id === view.current_turn);
    carcTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (carcRemainingLabel) {
    carcRemainingLabel.textContent = Number.isInteger(view.remaining_tiles) ? String(view.remaining_tiles) : "-";
  }
  if (carcWinnerLabel) {
    if (view.winner && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      carcWinnerLabel.textContent = names.join(", ");
    } else {
      carcWinnerLabel.textContent = "-";
    }
  }
  const pendingType = view.pending_tile ? view.pending_tile.type : null;
  if (pendingType !== carcPendingType) {
    carcPendingType = pendingType;
    carcRotation = 0;
  }
  if (carcPendingLabel) {
    carcPendingLabel.textContent = pendingType || "-";
  }
  updateCarcassonneRotationLabel();
  renderCarcassonneBoard(view);
  renderCarcassonnePendingTile(view);
  renderCarcassonneMeepleOptions(view);
  updateCarcassonneMeepleSelectionLabel(view);
  renderCarcassonnePlayers(view);
  updateCarcassonneControls(view);
  logGameEvents(data);
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

function renderHanabiGameState(data) {
  const view = data.view;
  currentHanabiView = view;
  if (currentGameType !== "hanabi") {
    currentGameType = "hanabi";
    setGamePanelVisibility("hanabi");
  }

  const you = getHanabiYou(view);
  if (
    !you ||
    !Array.isArray(you.hand) ||
    (Number.isInteger(hanabiSelectedCardIndex) && hanabiSelectedCardIndex >= you.hand.length)
  ) {
    hanabiSelectedCardIndex = null;
  }
  if (hanabiSelectedTargetId && !view.players.find((p) => p.player_id === hanabiSelectedTargetId)) {
    hanabiSelectedTargetId = null;
  }

  if (hanabiTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    hanabiTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (hanabiCluesLabel) {
    hanabiCluesLabel.textContent = `${view.clue_tokens ?? "-"}/${view.max_clue_tokens ?? "-"}`;
  }
  if (hanabiFusesLabel) {
    hanabiFusesLabel.textContent = `${view.fuse_tokens ?? "-"}/${view.max_fuse_tokens ?? "-"}`;
  }
  if (hanabiDeckLabel) {
    hanabiDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (hanabiScoreLabel) {
    hanabiScoreLabel.textContent = view.score_display || "-";
  }
  if (hanabiFinalTurnsLabel) {
    hanabiFinalTurnsLabel.textContent = Number.isInteger(view.final_rounds_remaining) ? view.final_rounds_remaining : "-";
  }
  if (hanabiEndReasonLabel) {
    hanabiEndReasonLabel.textContent = view.end_reason || "-";
  }

  renderHanabiTableau(view);
  renderHanabiDiscardStats(view);
  renderHanabiHand(view);
  renderHanabiPlayers(view);
  renderHanabiClueTargets(view);
  renderHanabiLog(view);
  updateHanabiSelectedCardLabel(view);
  logGameEvents(data);
  updateHanabiActionButtons();
}

function formatGangCard(card) {
  if (!card || card.hidden) {
    return "??";
  }
  const rank = card.rank;
  const rankLabel = rank === 14 ? "A" : rank === 13 ? "K" : rank === 12 ? "Q" : rank === 11 ? "J" : String(rank);
  const suitMap = {
    S: "♠️",
    H: "♥️",
    D: "♦️",
    C: "♣️",
  };
  const rawSuit = typeof card.suit === "string" ? card.suit.trim() : "";
  const suitKey = rawSuit.toUpperCase();
  const suitEmoji = suitMap[suitKey];
  const suitLabel = suitEmoji || (rawSuit && !/^[SHDC]$/i.test(rawSuit) ? rawSuit : "?");
  return `${rankLabel}${suitLabel}`;
}

function createGangCardElement(card) {
  const div = document.createElement("div");
  div.className = "gang-card";
  if (card && card.hidden) {
    div.classList.add("hidden");
  }
  div.textContent = formatGangCard(card);
  return div;
}

function renderGangCommunity(view) {
  if (!gangCommunity) {
    return;
  }
  gangCommunity.innerHTML = "";
  const cards = Array.isArray(view.community_cards) ? view.community_cards : [];
  const youEntry = Array.isArray(view.players) ? view.players.find((p) => p.player_id === view.you) : null;
  const highlight = new Set();
  if (youEntry && youEntry.hand_hint && Array.isArray(youEntry.hand_hint.best_cards)) {
    youEntry.hand_hint.best_cards.forEach((card) => {
      if (card && card.rank && card.suit) {
        highlight.add(`${card.rank}-${card.suit}`);
      }
    });
  }
  if (!cards.length) {
    gangCommunity.textContent = "-";
    return;
  }
  cards.forEach((card) => {
    const cardEl = createGangCardElement(card);
    if (card && highlight.has(`${card.rank}-${card.suit}`)) {
      cardEl.classList.add("highlight");
    }
    gangCommunity.appendChild(cardEl);
  });
}

function renderGangRanking(view) {
  if (!gangRanking) {
    return;
  }
  gangRanking.innerHTML = "";
  const ranking = Array.isArray(view.ranking) ? view.ranking : [];
  const players = Array.isArray(view.players) ? view.players : [];
  const nameMap = new Map(players.map((p) => [p.player_id, p.name || p.player_id]));
  const readyMap = new Map(players.map((p) => [p.player_id, !!p.ready]));
  const canMove = Array.isArray(view.legal_actions) && view.legal_actions.includes("move_rank");

  ranking.forEach((pid, index) => {
    const row = document.createElement("div");
    row.className = "gang-slot";
    const label = document.createElement("div");
    label.className = "gang-slot-label";
    label.textContent = `${index + 1}.`;
    row.appendChild(label);

    const select = document.createElement("select");
    players.forEach((player) => {
      const option = document.createElement("option");
      option.value = player.player_id;
      option.textContent = nameMap.get(player.player_id) || player.player_id;
      select.appendChild(option);
    });
    if (pid) {
      select.value = pid;
    }
    const occupantReady = readyMap.get(pid);
    select.disabled = !canMove || (occupantReady && pid !== view.you);
    select.addEventListener("change", () => {
      sendAction({ type: "move_rank", player_id: select.value, to_index: index });
    });
    row.appendChild(select);

    if (occupantReady) {
      const badge = document.createElement("span");
      badge.className = "gang-badge";
      badge.textContent = "Ready";
      row.appendChild(badge);
    }
    gangRanking.appendChild(row);
  });
}

function renderGangSpyTargets(view) {
  if (!gangSpyTargetSelect) {
    return;
  }
  const players = Array.isArray(view.players)
    ? view.players.filter((p) => p.player_id !== view.you)
    : [];
  gangSpyTargetSelect.innerHTML = "";
  if (!players.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No targets";
    gangSpyTargetSelect.appendChild(option);
    gangSpyTargetSelect.disabled = true;
    gangSelectedSpyTarget = null;
    return;
  }
  gangSpyTargetSelect.disabled = false;
  players.forEach((player) => {
    const option = document.createElement("option");
    option.value = player.player_id;
    option.textContent = player.name || player.player_id;
    gangSpyTargetSelect.appendChild(option);
  });
  if (gangSelectedSpyTarget && players.some((p) => p.player_id === gangSelectedSpyTarget)) {
    gangSpyTargetSelect.value = gangSelectedSpyTarget;
  } else {
    gangSelectedSpyTarget = players[0].player_id;
    gangSpyTargetSelect.value = gangSelectedSpyTarget;
  }
}

function renderGangPlayers(view) {
  if (!gangPlayers) {
    return;
  }
  gangPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  if (!players.length) {
    gangPlayers.textContent = "-";
    return;
  }
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "gang-player-card";
    if (player.ready) {
      card.classList.add("ready");
    }
    if (player.player_id === view.you) {
      card.classList.add("you");
    }

    const header = document.createElement("div");
    header.textContent = player.name || player.player_id;
    card.appendChild(header);

    const status = document.createElement("div");
    status.className = "gang-badge";
    status.textContent = player.ready ? "Ready" : "Not Ready";
    card.appendChild(status);

    const handRow = document.createElement("div");
    handRow.className = "gang-player-hand";
    const handCards = Array.isArray(player.hand) ? player.hand : [];
    handCards.forEach((slot) => {
      handRow.appendChild(createGangCardElement(slot));
    });
    card.appendChild(handRow);

    if (player.hand_hint) {
      const hint = document.createElement("div");
      hint.className = "gang-badge";
      hint.textContent = `Hint: ${player.hand_hint.hand_name}`;
      card.appendChild(hint);
    }
    if (Number.isFinite(player.hand_odds)) {
      const odds = document.createElement("div");
      odds.className = "gang-badge";
      odds.textContent = `Win Odds: ${Math.round(player.hand_odds * 100)}%`;
      card.appendChild(odds);
    }

    gangPlayers.appendChild(card);
  });
}

function renderGangSummary(view) {
  if (!gangRoundSummary || !gangRoundSummaryBody || !gangRoundSummaryList) {
    return;
  }
  const summary = view.round_summary;
  if (!summary) {
    gangRoundSummary.classList.add("hidden");
    gangRoundSummaryBody.textContent = "-";
    gangRoundSummaryList.innerHTML = "";
    return;
  }
  gangRoundSummary.classList.remove("hidden");
  const parts = [];
  parts.push(summary.success ? "Success" : "Failure");
  if (summary.perfect) {
    parts.push("Perfect Clear");
  }
  if (view.mission) {
    parts.push(summary.mission_success ? "Mission OK" : "Mission Failed");
  }
  gangRoundSummaryBody.textContent = parts.join(" | ");
  gangRoundSummaryList.innerHTML = "";

  const actualGroups = Array.isArray(summary.actual_groups) ? summary.actual_groups : [];
  const predicted = Array.isArray(summary.predicted_order) ? summary.predicted_order : [];
  if (actualGroups.length) {
    const actualLine = document.createElement("div");
    actualLine.textContent = `Actual: ${actualGroups
      .map((group) => group.map((pid) => findPlayerName(view, pid)).join(" = "))
      .join(" > ")}`;
    gangRoundSummaryList.appendChild(actualLine);
  }
  if (predicted.length) {
    const predictedLine = document.createElement("div");
    predictedLine.textContent = `Predicted: ${predicted.map((pid) => findPlayerName(view, pid)).join(" > ")}`;
    gangRoundSummaryList.appendChild(predictedLine);
  }

  const hands = Array.isArray(summary.hands) ? summary.hands : [];
  hands.forEach((entry) => {
    const line = document.createElement("div");
    const cards = Array.isArray(entry.best_cards) ? entry.best_cards.map((c) => formatGangCard(c)).join(" ") : "-";
    line.textContent = `${findPlayerName(view, entry.player_id)}: ${entry.hand_name} (${cards})`;
    gangRoundSummaryList.appendChild(line);
  });
}

function updateGangTimers(view) {
  if (gangCountdownTimer) {
    clearInterval(gangCountdownTimer);
    gangCountdownTimer = null;
  }
  if (!gangTimerLabel || !gangLockLabel) {
    return;
  }
  if (!view || view.phase !== "river") {
    gangTimerLabel.textContent = "-";
    gangLockLabel.textContent = "-";
    gangAutoLockSent = false;
    return;
  }

  const lockAt = Number.isFinite(view.lock_at_ms) ? view.lock_at_ms : null;
  const deadline = Number.isFinite(view.river_deadline_ms) ? view.river_deadline_ms : null;
  if (!lockAt && !deadline) {
    gangTimerLabel.textContent = "-";
    gangLockLabel.textContent = "-";
    gangAutoLockSent = false;
    return;
  }
  if (lockAt !== gangLastLockAt || deadline !== gangLastDeadline) {
    gangAutoLockSent = false;
    gangLastLockAt = lockAt;
    gangLastDeadline = deadline;
  }
  const serverNow = Number.isFinite(view.server_time_ms) ? view.server_time_ms : Date.now();
  gangServerOffsetMs = serverNow - Date.now();

  const update = () => {
    const now = Date.now() + gangServerOffsetMs;
    if (lockAt) {
      const remaining = Math.max(0, lockAt - now);
      gangLockLabel.textContent = `${Math.ceil(remaining / 1000)}s`;
    } else {
      gangLockLabel.textContent = "-";
    }
    if (deadline) {
      const remaining = Math.max(0, deadline - now);
      gangTimerLabel.textContent = `${Math.ceil(remaining / 1000)}s`;
    } else {
      gangTimerLabel.textContent = "-";
    }
    if (!gangAutoLockSent) {
      if ((lockAt && now >= lockAt) || (deadline && now >= deadline)) {
        gangAutoLockSent = true;
        sendAction({ type: "lock_in" });
      }
    }
  };
  update();
  gangCountdownTimer = setInterval(update, 250);
}

function renderGangGameState(data) {
  const view = data.view;
  currentGangView = view;
  if (currentGameType !== "the_gang") {
    currentGameType = "the_gang";
    setGamePanelVisibility("the_gang");
  }

  if (gangPhaseLabel) {
    gangPhaseLabel.textContent = view.phase || "-";
  }
  if (gangLevelLabel) {
    gangLevelLabel.textContent = view.level ?? "-";
  }
  if (gangLivesLabel) {
    gangLivesLabel.textContent = `${view.lives ?? "-"} / ${view.max_lives ?? "-"}`;
  }
  if (gangTokensLabel) {
    gangTokensLabel.textContent = view.tokens ?? "-";
  }
  if (gangModeLabel) {
    gangModeLabel.textContent = view.mode || "-";
  }
  if (gangMissionLabel) {
    gangMissionLabel.textContent = view.mission ? view.mission.desc || view.mission.id : "-";
  }

  const youEntry = Array.isArray(view.players) ? view.players.find((p) => p.player_id === view.you) : null;
  if (gangReadyBtn) {
    gangReadyBtn.textContent = youEntry && youEntry.ready ? "Cancel Ready" : "Ready";
  }

  renderGangCommunity(view);
  renderGangRanking(view);
  renderGangSpyTargets(view);
  renderGangPlayers(view);
  renderGangSummary(view);
  updateGangTimers(view);
  logGameEvents(data);
  updateGangActionButtons(view);
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

function renderBlitzSketchGameState(data) {
  const view = data.view;
  const previousView = currentBlitzSketchView;
  currentBlitzSketchView = view;
  if (currentGameType !== "blitz_sketch") {
    currentGameType = "blitz_sketch";
    setGamePanelVisibility("blitz_sketch");
  }

  if (blitzSketchPhaseLabel) {
    blitzSketchPhaseLabel.textContent = view.phase || "-";
  }
  if (blitzSketchDrawProgressLabel) {
    const drawIndex = Number.isInteger(view.draw_index) ? view.draw_index : 0;
    const drawTotal = Number.isInteger(view.draw_total) ? view.draw_total : 0;
    blitzSketchDrawProgressLabel.textContent = `${Math.min(drawIndex, drawTotal)}/${drawTotal || "-"}`;
  }
  if (blitzSketchGuessProgressLabel) {
    const guessIndex = Number.isInteger(view.guess_index) ? view.guess_index : 0;
    const guessTotal = Number.isInteger(view.guess_total) ? view.guess_total : 0;
    blitzSketchGuessProgressLabel.textContent = `${Math.min(guessIndex, guessTotal)}/${guessTotal || "-"}`;
  }
  if (blitzSketchScoreLabel) {
    blitzSketchScoreLabel.textContent = view.score ?? "-";
  }

  renderBlitzSketchPlayers(view);
  logGameEvents(data);

  if (view.phase === "draw") {
    if (!previousView || previousView.draw_index !== view.draw_index) {
      blitzSketchSubmittedDrawIndex = null;
    }
    if (blitzSketchDrawArea) {
      blitzSketchDrawArea.classList.remove("hidden");
    }
    if (blitzSketchGuessArea) {
      blitzSketchGuessArea.classList.add("hidden");
    }
    if (blitzSketchReview) {
      blitzSketchReview.classList.add("hidden");
    }
    if (blitzSketchPromptLabel) {
      blitzSketchPromptLabel.textContent = view.draw_prompt || "-";
    }
    if (blitzSketchFeedback) {
      blitzSketchFeedback.textContent = "";
    }
    if (blitzSketchRevealRow) {
      blitzSketchRevealRow.classList.add("hidden");
    }
    if (blitzSketchInput) {
      blitzSketchInput.value = "";
      blitzSketchInput.disabled = true;
    }
    if (blitzSketchCanvas) {
      blitzSketchCanvas.style.pointerEvents = isBlitzSketchActionAvailable("submit_drawing") ? "auto" : "none";
    }
    scheduleBlitzSketchAutoSubmit(view);
  } else if (view.phase === "guess") {
    if (blitzSketchDrawArea) {
      blitzSketchDrawArea.classList.add("hidden");
    }
    if (blitzSketchGuessArea) {
      blitzSketchGuessArea.classList.remove("hidden");
    }
    if (blitzSketchReview) {
      blitzSketchReview.classList.add("hidden");
    }
    stopBlitzSketchDrawTimers();
    if (blitzSketchTimerLabel) {
      blitzSketchTimerLabel.textContent = "-";
    }
    if (blitzSketchImage) {
      const revealActive =
        view.reveal && Number.isFinite(view.reveal.until_ms) ? view.reveal.until_ms > Date.now() : !!view.reveal;
      const revealImage = revealActive && view.reveal && view.reveal.image_data ? view.reveal.image_data : null;
      if (revealImage) {
        blitzSketchImage.src = revealImage;
      } else if (view.current_image) {
        blitzSketchImage.src = view.current_image;
      } else {
        blitzSketchImage.removeAttribute("src");
      }
    }
    if (!previousView || previousView.guess_index !== view.guess_index) {
      if (blitzSketchInput) {
        blitzSketchInput.value = "";
      }
    }
    if (blitzSketchInput) {
      blitzSketchInput.disabled = !isBlitzSketchGuessAllowed();
    }
    if (blitzSketchFeedback) {
      blitzSketchFeedback.textContent = view.feedback ? view.feedback.message || "" : "";
    }
    if (blitzSketchRevealRow) {
      const revealActive =
        view.reveal && Number.isFinite(view.reveal.until_ms) ? view.reveal.until_ms > Date.now() : !!view.reveal;
      if (revealActive && view.reveal && view.reveal.answer) {
        blitzSketchRevealRow.classList.remove("hidden");
        if (blitzSketchRevealAnswer) {
          blitzSketchRevealAnswer.textContent = view.reveal.answer;
        }
      } else {
        blitzSketchRevealRow.classList.add("hidden");
      }
    }
    scheduleBlitzSketchReveal(view);
  } else if (view.phase === "review") {
    if (blitzSketchDrawArea) {
      blitzSketchDrawArea.classList.add("hidden");
    }
    if (blitzSketchGuessArea) {
      blitzSketchGuessArea.classList.add("hidden");
    }
    if (blitzSketchTimerLabel) {
      blitzSketchTimerLabel.textContent = "-";
    }
    stopBlitzSketchTimers();
    renderBlitzSketchReview(view);
  } else {
    if (blitzSketchDrawArea) {
      blitzSketchDrawArea.classList.add("hidden");
    }
    if (blitzSketchGuessArea) {
      blitzSketchGuessArea.classList.add("hidden");
    }
    if (blitzSketchReview) {
      blitzSketchReview.classList.add("hidden");
    }
    if (blitzSketchTimerLabel) {
      blitzSketchTimerLabel.textContent = "-";
    }
    stopBlitzSketchTimers();
  }

  updateBlitzSketchButtons();
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
    if (impressionReview) {
      impressionReview.classList.add("hidden");
    }
    if (impressionReviewList) {
      impressionReviewList.innerHTML = "";
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
    if (impressionReview) {
      impressionReview.classList.add("hidden");
    }
    if (impressionReviewList) {
      impressionReviewList.innerHTML = "";
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
    if (impressionReview) {
      impressionReview.classList.remove("hidden");
    }
    renderImpressionRoundResult(view);
    renderImpressionReview(view);
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
    if (impressionReview) {
      impressionReview.classList.remove("hidden");
    }
    renderImpressionRoundResult(view);
    renderImpressionReview(view);
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
    if (impressionReview) {
      impressionReview.classList.add("hidden");
    }
    if (impressionReviewList) {
      impressionReviewList.innerHTML = "";
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

if (projectLUpgradeModalCloseBtn) {
  projectLUpgradeModalCloseBtn.addEventListener("click", () => {
    closeProjectLUpgradeModal();
  });
}

if (projectLUpgradeModal) {
  projectLUpgradeModal.addEventListener("click", (event) => {
    if (event.target === projectLUpgradeModal) {
      closeProjectLUpgradeModal();
    }
  });
}

if (trekkingScoreCloseBtn) {
  trekkingScoreCloseBtn.addEventListener("click", () => {
    closeTrekkingScoreRules();
  });
}

if (trekkingScoreModal) {
  trekkingScoreModal.addEventListener("click", (event) => {
    if (event.target === trekkingScoreModal) {
      closeTrekkingScoreRules();
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

if (hanabiClearSelectionBtn) {
  hanabiClearSelectionBtn.addEventListener("click", () => {
    hanabiSelectedCardIndex = null;
    if (currentHanabiView) {
      renderHanabiHand(currentHanabiView);
      updateHanabiSelectedCardLabel(currentHanabiView);
    } else if (hanabiSelectedCardLabel) {
      hanabiSelectedCardLabel.textContent = "-";
    }
    updateHanabiActionButtons();
  });
}

if (hanabiTargetSelect) {
  hanabiTargetSelect.addEventListener("change", () => {
    hanabiSelectedTargetId = hanabiTargetSelect.value || null;
    if (currentHanabiView) {
      updateHanabiClueOptions(currentHanabiView);
    }
    updateHanabiActionButtons();
  });
}

if (hanabiClueTypeSelect) {
  hanabiClueTypeSelect.addEventListener("change", () => {
    hanabiSelectedClueType = hanabiClueTypeSelect.value || "color";
    if (currentHanabiView) {
      updateHanabiClueOptions(currentHanabiView);
    }
    updateHanabiActionButtons();
  });
}

if (hanabiClueValueSelect) {
  hanabiClueValueSelect.addEventListener("change", () => {
    hanabiSelectedClueValue = hanabiClueValueSelect.value || null;
    updateHanabiActionButtons();
  });
}

if (hanabiPlayBtn) {
  hanabiPlayBtn.addEventListener("click", () => {
    if (!currentHanabiView) {
      log("Game not ready");
      return;
    }
    const you = getHanabiYou(currentHanabiView);
    if (
      !you ||
      !Number.isInteger(hanabiSelectedCardIndex) ||
      hanabiSelectedCardIndex < 0 ||
      hanabiSelectedCardIndex >= you.hand.length
    ) {
      log("Select a card to play");
      return;
    }
    if (isHanabiCardDefinitelyUnplayable(currentHanabiView, hanabiSelectedCardIndex)) {
      const proceed = window.confirm("This play is guaranteed to fail based on known info. Play anyway?");
      if (!proceed) {
        return;
      }
    }
    sendAction({ type: "play", card_index: hanabiSelectedCardIndex });
    hanabiSelectedCardIndex = null;
    renderHanabiHand(currentHanabiView);
    updateHanabiSelectedCardLabel(currentHanabiView);
    updateHanabiActionButtons();
  });
}

if (hanabiDiscardBtn) {
  hanabiDiscardBtn.addEventListener("click", () => {
    if (!currentHanabiView) {
      log("Game not ready");
      return;
    }
    const you = getHanabiYou(currentHanabiView);
    if (
      !you ||
      !Number.isInteger(hanabiSelectedCardIndex) ||
      hanabiSelectedCardIndex < 0 ||
      hanabiSelectedCardIndex >= you.hand.length
    ) {
      log("Select a card to discard");
      return;
    }
    sendAction({ type: "discard", card_index: hanabiSelectedCardIndex });
    hanabiSelectedCardIndex = null;
    renderHanabiHand(currentHanabiView);
    updateHanabiSelectedCardLabel(currentHanabiView);
    updateHanabiActionButtons();
  });
}

if (hanabiClueBtn) {
  hanabiClueBtn.addEventListener("click", () => {
    if (!currentHanabiView) {
      log("Game not ready");
      return;
    }
    const targetId = hanabiTargetSelect ? hanabiTargetSelect.value : null;
    const clueType = hanabiClueTypeSelect ? hanabiClueTypeSelect.value || "color" : "color";
    const clueValueRaw = hanabiClueValueSelect ? hanabiClueValueSelect.value : null;
    if (!targetId || !clueValueRaw) {
      log("Select a target and clue value");
      return;
    }
    let value = clueValueRaw;
    if (clueType === "rank") {
      const parsed = Number.parseInt(clueValueRaw, 10);
      if (!Number.isInteger(parsed)) {
        log("Select a clue number");
        return;
      }
      value = parsed;
    }
    sendAction({
      type: "give_clue",
      target_player_id: targetId,
      clue_type: clueType,
      value,
    });
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

if (gangRevealBtn) {
  gangRevealBtn.addEventListener("click", () => {
    sendAction({ type: "reveal_next" });
  });
}

if (gangReadyBtn) {
  gangReadyBtn.addEventListener("click", () => {
    sendAction({ type: "toggle_ready" });
  });
}

if (gangLockBtn) {
  gangLockBtn.addEventListener("click", () => {
    sendAction({ type: "lock_in" });
  });
}

if (gangMulliganBtn) {
  gangMulliganBtn.addEventListener("click", () => {
    sendAction({ type: "mulligan" });
  });
}

if (gangSpyTargetSelect) {
  gangSpyTargetSelect.addEventListener("change", () => {
    gangSelectedSpyTarget = gangSpyTargetSelect.value || null;
  });
}

if (gangSpyBtn) {
  gangSpyBtn.addEventListener("click", () => {
    if (!gangSelectedSpyTarget) {
      log("Select a spy target");
      return;
    }
    sendAction({ type: "spy", target_player_id: gangSelectedSpyTarget });
  });
}

if (gangNextRoundBtn) {
  gangNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (gangPlayAgainBtn) {
  gangPlayAgainBtn.addEventListener("click", () => {
    sendAction({ type: "play_again" });
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

if (blitzSketchSubmitGuessBtn) {
  blitzSketchSubmitGuessBtn.addEventListener("click", () => {
    if (!blitzSketchInput) {
      return;
    }
    const guess = blitzSketchInput.value.trim();
    if (!guess) {
      log("请输入答案");
      return;
    }
    sendAction({ type: "submit_guess", text: guess });
  });
}

if (blitzSketchSkipBtn) {
  blitzSketchSkipBtn.addEventListener("click", () => {
    sendAction({ type: "skip_guess" });
  });
}

if (blitzSketchInput) {
  blitzSketchInput.addEventListener("input", () => {
    updateBlitzSketchButtons();
  });
  blitzSketchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (blitzSketchSubmitGuessBtn && isBlitzSketchActionAvailable("submit_guess")) {
        blitzSketchSubmitGuessBtn.click();
      }
    }
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

if (trekkingPanel) {
  trekkingPanel.addEventListener("click", (event) => {
    if (!currentTrekkingView || currentGameType !== "trekking_history") {
      return;
    }
    if (!trekkingPanel.contains(event.target)) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest(".trekking-card")) {
      return;
    }
    if (target.closest(".trekking-modal")) {
      return;
    }
    const scoreLink = target.closest(".trekking-score-link");
    if (scoreLink) {
      event.preventDefault();
      openTrekkingScoreRules();
      return;
    }
    if (target.closest("button") || target.closest("select") || target.closest("input") || target.closest("label") || target.closest("a")) {
      return;
    }
    clearTrekkingSelections();
    updateTrekkingSelectionLabels(currentTrekkingView);
    renderTrekkingMarket(currentTrekkingView);
    updateTrekkingActionButtons();
  });
}


if (trekkingWildModalButtons) {
  trekkingWildModalButtons.addEventListener("click", (event) => {
    const target = event.target;
    if (!trekkingWildModalState || !target || !target.dataset) {
      return;
    }
    const col = Number(target.dataset.col);
    if (!Number.isInteger(col)) {
      return;
    }
    const resolve = trekkingWildModalState.resolve;
    closeTrekkingWildModal();
    if (resolve) {
      resolve(col);
    }
  });
}

if (trekkingWildCancelBtn) {
  trekkingWildCancelBtn.addEventListener("click", () => {
    if (!trekkingWildModalState) {
      return;
    }
    const reject = trekkingWildModalState.reject;
    closeTrekkingWildModal();
    if (reject) {
      reject(new Error("cancel"));
    }
  });
}

if (trekkingCrystalConfirmBtn) {
  trekkingCrystalConfirmBtn.addEventListener("click", () => {
    if (!trekkingCrystalModalState || !trekkingCrystalSelect) {
      return;
    }
    const value = Number(trekkingCrystalSelect.value);
    const resolve = trekkingCrystalModalState.resolve;
    closeTrekkingCrystalModal();
    if (resolve) {
      resolve(value);
    }
  });
}

if (trekkingCrystalCancelBtn) {
  trekkingCrystalCancelBtn.addEventListener("click", () => {
    if (!trekkingCrystalModalState) {
      return;
    }
    const reject = trekkingCrystalModalState.reject;
    closeTrekkingCrystalModal();
    if (reject) {
      reject(new Error("cancel"));
    }
  });
}

if (trekkingTakeCardBtn) {
  trekkingTakeCardBtn.addEventListener("click", () => {
    if (!currentTrekkingView) {
      return;
    }
    if (trekkingSelectedSlot === null) {
      log("Select a card to take");
      return;
    }
    const card = (currentTrekkingView.market || [])[trekkingSelectedSlot];
    if (!card) {
      log("Selected card is not available");
      return;
    }
    const spend = 0;
    const wildNeeded = trekkingWildNeeded(card.tokens);
    const sendWithChoices = (choices) => {
      const action = {
        type: "take_card",
        slot_index: trekkingSelectedSlot,
        spend_crystals: spend,
        wild_choices: choices,
      };
      sendAction(action);
      clearTrekkingSelections();
      updateTrekkingSelectionLabels(currentTrekkingView);
      updateTrekkingActionButtons();
    };
    if (wildNeeded > 0) {
      collectTrekkingWildChoices(wildNeeded)
        .then((choices) => {
          sendWithChoices(choices);
        })
        .catch(() => {
          updateTrekkingSelectionLabels(currentTrekkingView);
          updateTrekkingActionButtons();
        });
      return;
    }
    sendWithChoices([]);
  });
}

if (trekkingTakeAncestorBtn) {
  trekkingTakeAncestorBtn.addEventListener("click", () => {
    if (!currentTrekkingView) {
      return;
    }
    const spend = 0;
    const sendWithChoices = (choices) => {
      const action = {
        type: "take_ancestor",
        spend_crystals: spend,
        wild_choices: choices,
      };
      sendAction(action);
      clearTrekkingSelections();
      updateTrekkingSelectionLabels(currentTrekkingView);
      updateTrekkingActionButtons();
    };
    collectTrekkingWildChoices(1)
      .then((choices) => {
        sendWithChoices(choices);
      })
      .catch(() => {
        updateTrekkingSelectionLabels(currentTrekkingView);
        updateTrekkingActionButtons();
      });
  });
}

if (trekkingTakeCardWithCrystalBtn) {
  trekkingTakeCardWithCrystalBtn.addEventListener("click", () => {
    if (!currentTrekkingView) {
      return;
    }
    if (trekkingSelectedSlot === null) {
      log("Select a card to take");
      return;
    }
    const card = (currentTrekkingView.market || [])[trekkingSelectedSlot];
    if (!card) {
      log("Selected card is not available");
      return;
    }
    const maxSpend = trekkingCardMaxSpend(currentTrekkingView, card);
    if (maxSpend < 1) {
      log("No crystals can be spent on this card");
      return;
    }
    const options = Array.from({ length: maxSpend }, (_, i) => i + 1);
    openTrekkingCrystalModal(options, `Spend crystals (1 - ${maxSpend})`)
      .then((spend) => {
        const wildNeeded = trekkingWildNeeded(card.tokens);
        const sendWithChoices = (choices) => {
          const action = {
            type: "take_card",
            slot_index: trekkingSelectedSlot,
            spend_crystals: spend,
            wild_choices: choices,
          };
          sendAction(action);
          clearTrekkingSelections();
          updateTrekkingSelectionLabels(currentTrekkingView);
          updateTrekkingActionButtons();
        };
        if (wildNeeded > 0) {
          return collectTrekkingWildChoices(wildNeeded).then(sendWithChoices);
        }
        sendWithChoices([]);
        return null;
      })
      .catch(() => {
        updateTrekkingSelectionLabels(currentTrekkingView);
        updateTrekkingActionButtons();
      });
  });
}

if (trekkingTakeAncestorWithCrystalBtn) {
  trekkingTakeAncestorWithCrystalBtn.addEventListener("click", () => {
    if (!currentTrekkingView) {
      return;
    }
    const maxSpend = trekkingAncestorMaxSpend(currentTrekkingView);
    if (maxSpend < 1) {
      log("No crystals can be spent on ancestor");
      return;
    }
    const options = Array.from({ length: maxSpend }, (_, i) => i + 1);
    openTrekkingCrystalModal(options, `Spend crystals (1 - ${maxSpend})`)
      .then((spend) => {
        const sendWithChoices = (choices) => {
          const action = {
            type: "take_ancestor",
            spend_crystals: spend,
            wild_choices: choices,
          };
          sendAction(action);
          clearTrekkingSelections();
          updateTrekkingSelectionLabels(currentTrekkingView);
          updateTrekkingActionButtons();
        };
        return collectTrekkingWildChoices(1).then(sendWithChoices);
      })
      .catch(() => {
        updateTrekkingSelectionLabels(currentTrekkingView);
        updateTrekkingActionButtons();
      });
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

if (carcRotateLeftBtn) {
  carcRotateLeftBtn.addEventListener("click", () => {
    carcRotation = (carcRotation + 270) % 360;
    updateCarcassonneRotationLabel();
    if (currentCarcassonneView) {
      renderCarcassonneBoard(currentCarcassonneView);
      renderCarcassonnePendingTile(currentCarcassonneView);
    }
  });
}

if (carcRotateRightBtn) {
  carcRotateRightBtn.addEventListener("click", () => {
    carcRotation = (carcRotation + 90) % 360;
    updateCarcassonneRotationLabel();
    if (currentCarcassonneView) {
      renderCarcassonneBoard(currentCarcassonneView);
      renderCarcassonnePendingTile(currentCarcassonneView);
    }
  });
}

if (carcSkipMeepleBtn) {
  carcSkipMeepleBtn.addEventListener("click", () => {
    if (!currentCarcassonneView) {
      return;
    }
    const actions = Array.isArray(currentCarcassonneView.legal_actions)
      ? currentCarcassonneView.legal_actions
      : [];
    if (!actions.includes("skip_meeple")) {
      return;
    }
    clearCarcassonneSelection();
    sendAction({ type: "skip_meeple" });
  });
}

if (carcBoard) {
  carcBoard.addEventListener("mousemove", handleCarcassonneHover);
  carcBoard.addEventListener("mouseleave", () => clearCarcassonneHighlight("hover"));
  carcBoard.addEventListener("click", handleCarcassonneMeepleSelect);
}

if (carcConfirmMeepleBtn) {
  carcConfirmMeepleBtn.addEventListener("click", () => {
    if (!currentCarcassonneView || !carcSelectedMeeple) {
      return;
    }
    const actions = Array.isArray(currentCarcassonneView.legal_actions)
      ? currentCarcassonneView.legal_actions
      : [];
    if (!actions.includes("place_meeple")) {
      return;
    }
    sendAction({
      type: "place_meeple",
      feature: carcSelectedMeeple.feature,
      segment: carcSelectedMeeple.segment ?? null,
    });
    clearCarcassonneSelection();
  });
}

if (carcClearMeepleBtn) {
  carcClearMeepleBtn.addEventListener("click", () => {
    clearCarcassonneSelection();
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

if (projectLRotateLeftBtn) {
  projectLRotateLeftBtn.addEventListener("click", () => {
    projectLRotation = ((projectLRotation - 90) % 360 + 360) % 360;
    updateProjectLSelectionLabels();
    if (currentProjectLView) {
      renderProjectLActivePuzzles(currentProjectLView);
    }
    updateProjectLActionButtons();
  });
}

if (projectLRotateRightBtn) {
  projectLRotateRightBtn.addEventListener("click", () => {
    projectLRotation = (projectLRotation + 90) % 360;
    updateProjectLSelectionLabels();
    if (currentProjectLView) {
      renderProjectLActivePuzzles(currentProjectLView);
    }
    updateProjectLActionButtons();
  });
}

if (projectLFlipBtn) {
  projectLFlipBtn.addEventListener("click", () => {
    projectLFlip = !projectLFlip;
    updateProjectLSelectionLabels();
    if (currentProjectLView) {
      renderProjectLActivePuzzles(currentProjectLView);
    }
    updateProjectLActionButtons();
  });
}

if (projectLClearSelectionBtn) {
  projectLClearSelectionBtn.addEventListener("click", () => {
    clearProjectLSelection();
  });
}

if (projectLTakeMarketBtn) {
  projectLTakeMarketBtn.addEventListener("click", () => {
    if (!currentProjectLView || !projectLSelectedMarket) {
      return;
    }
    if (!isProjectLActionAvailable("take_puzzle")) {
      log("Not your turn");
      return;
    }
    sendAction({
      type: "take_puzzle",
      source: "market",
      deck: projectLSelectedMarket.deck,
      index: projectLSelectedMarket.index,
    });
    projectLSelectedMarket = null;
    updateProjectLSelectionLabels();
    if (currentProjectLView) {
      renderProjectLMarket(currentProjectLView);
    }
    updateProjectLActionButtons();
  });
}

if (projectLDrawWhiteBtn) {
  projectLDrawWhiteBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("take_puzzle")) {
      log("Not your turn");
      return;
    }
    sendAction({ type: "take_puzzle", source: "deck", deck: "white" });
  });
}

if (projectLDrawBlackBtn) {
  projectLDrawBlackBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("take_puzzle")) {
      log("Not your turn");
      return;
    }
    sendAction({ type: "take_puzzle", source: "deck", deck: "black" });
  });
}

if (projectLTakeLevel1Btn) {
  projectLTakeLevel1Btn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("take_level1")) {
      log("Not your turn");
      return;
    }
    sendAction({ type: "take_level1" });
  });
}

if (projectLUpgradeBtn) {
  projectLUpgradeBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("upgrade_piece")) {
      log("Not your turn");
      return;
    }
    const fromPiece = getProjectLUpgradeFrom(currentProjectLView);
    if (!fromPiece) {
      log("Select a piece from Inventory first");
      return;
    }
    openProjectLUpgradeModal(currentProjectLView);
  });
}

if (projectLPlaceBtn) {
  projectLPlaceBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("place_piece")) {
      log("Not your turn");
      return;
    }
    const placement = projectLGetSelectedPlacement(currentProjectLView);
    if (!placement || !placement.ok) {
      log("Select a valid placement");
      return;
    }
    sendAction({
      type: "place_piece",
      puzzle_index: placement.puzzle_index,
      piece_id: placement.piece_id,
      rotation: placement.rotation,
      flip: placement.flip,
      row: placement.row,
      col: placement.col,
    });
    projectLSelectedOrigin = null;
    updateProjectLSelectionLabels();
    if (currentProjectLView) {
      renderProjectLActivePuzzles(currentProjectLView);
    }
    updateProjectLActionButtons();
  });
}

if (projectLQueueMasterBtn) {
  projectLQueueMasterBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("master_action")) {
      log("Not your turn");
      return;
    }
    const placement = projectLGetSelectedPlacement(currentProjectLView);
    if (!placement || !placement.ok) {
      log("Select a valid placement");
      return;
    }
    const payload = {
      puzzle_index: placement.puzzle_index,
      piece_id: placement.piece_id,
      rotation: placement.rotation,
      flip: placement.flip,
      row: placement.row,
      col: placement.col,
    };
    const you = getProjectLYou(currentProjectLView);
    const counts = projectLInventoryCounts(you ? you.inventory : []);
    const queueCounts = projectLInventoryCounts(projectLMasterQueueItems.map((entry) => entry.piece_id));
    const existingIndex = projectLMasterQueueItems.findIndex(
      (entry) => entry.puzzle_index === payload.puzzle_index,
    );
    if (existingIndex >= 0) {
      const existingPiece = projectLMasterQueueItems[existingIndex].piece_id;
      queueCounts[existingPiece] = Math.max(0, (queueCounts[existingPiece] || 0) - 1);
    }
    if (existingIndex < 0 && you && projectLMasterQueueItems.length >= you.active_puzzles.length) {
      log("Master queue already full");
      return;
    }
    if ((queueCounts[payload.piece_id] || 0) >= (counts[payload.piece_id] || 0)) {
      log("Not enough pieces for this queue");
      return;
    }
    if (existingIndex >= 0) {
      projectLMasterQueueItems[existingIndex] = payload;
    } else {
      projectLMasterQueueItems.push(payload);
    }
    renderProjectLMasterQueue(currentProjectLView);
    updateProjectLActionButtons();
  });
}

if (projectLClearMasterBtn) {
  projectLClearMasterBtn.addEventListener("click", () => {
    projectLMasterQueueItems = [];
    renderProjectLMasterQueue(currentProjectLView);
    updateProjectLActionButtons();
  });
}

if (projectLUseMasterBtn) {
  projectLUseMasterBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("master_action")) {
      log("Not your turn");
      return;
    }
    if (!projectLMasterQueueItems.length) {
      log("Queue at least one placement");
      return;
    }
    sendAction({ type: "master_action", placements: projectLMasterQueueItems });
    projectLMasterQueueItems = [];
    renderProjectLMasterQueue(currentProjectLView);
    updateProjectLActionButtons();
  });
}

if (projectLFinishingPlaceBtn) {
  projectLFinishingPlaceBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("finishing_place")) {
      log("Not available");
      return;
    }
    const placement = projectLGetSelectedPlacement(currentProjectLView);
    if (!placement || !placement.ok) {
      log("Select a valid placement");
      return;
    }
    sendAction({
      type: "finishing_place",
      puzzle_index: placement.puzzle_index,
      piece_id: placement.piece_id,
      rotation: placement.rotation,
      flip: placement.flip,
      row: placement.row,
      col: placement.col,
    });
    projectLSelectedOrigin = null;
    updateProjectLSelectionLabels();
    renderProjectLActivePuzzles(currentProjectLView);
    updateProjectLActionButtons();
  });
}

if (projectLFinishingDoneBtn) {
  projectLFinishingDoneBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("finishing_done")) {
      return;
    }
    sendAction({ type: "finishing_done" });
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

setupDrawGuessCanvas();
setupBlitzSketchCanvas();
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

function getCyberCanvasPos(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width ? canvas.width / rect.width : 1;
  const scaleY = rect.height ? canvas.height / rect.height : 1;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function getCyberRelativePos(event, container) {
  const rect = container.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    width: rect.width || CYBER_CANVAS_SIZE,
    height: rect.height || CYBER_CANVAS_SIZE,
  };
}

function getCyberStageSize(container) {
  if (!container) {
    return { width: CYBER_CANVAS_SIZE, height: CYBER_CANVAS_SIZE };
  }
  const rect = container.getBoundingClientRect();
  const width = rect.width && rect.width > 0 ? rect.width : CYBER_CANVAS_SIZE;
  const height = rect.height && rect.height > 0 ? rect.height : CYBER_CANVAS_SIZE;
  return { width, height };
}

function renderCyberShoelaceCanvas() {
  if (!cyberShoelaceCtx || !cyberShoelaceCanvas) {
    return;
  }
  const width = cyberShoelaceCanvas.width;
  const height = cyberShoelaceCanvas.height;
  cyberShoelaceCtx.clearRect(0, 0, width, height);
  cyberShoelaceCtx.fillStyle = "#ffffff";
  cyberShoelaceCtx.fillRect(0, 0, width, height);
  cyberShoelaceCtx.lineCap = "round";
  cyberShoelaceCtx.lineJoin = "round";
  cyberShoelacePaths.forEach((path) => {
    const points = path.points || [];
    if (points.length < 2) {
      return;
    }
    cyberShoelaceCtx.strokeStyle = path.color || "#111111";
    cyberShoelaceCtx.lineWidth = path.width || 4;
    cyberShoelaceCtx.beginPath();
    cyberShoelaceCtx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((pt) => cyberShoelaceCtx.lineTo(pt.x, pt.y));
    cyberShoelaceCtx.stroke();
  });
}

function startCyberShoelaceDraw(event) {
  if (!cyberShoelaceCanvas || !cyberShoelaceCtx) {
    return;
  }
  if (cyberShoelacePaths.length >= 2) {
    return;
  }
  event.preventDefault();
  const pos = getCyberCanvasPos(event, cyberShoelaceCanvas);
  cyberShoelaceCurrentPath = { points: [pos], color: "#111111", width: 4 };
  cyberShoelacePaths.push(cyberShoelaceCurrentPath);
  cyberShoelaceDrawing = true;
  renderCyberShoelaceCanvas();
}

function moveCyberShoelaceDraw(event) {
  if (!cyberShoelaceDrawing || !cyberShoelaceCurrentPath || !cyberShoelaceCanvas) {
    return;
  }
  const pos = getCyberCanvasPos(event, cyberShoelaceCanvas);
  cyberShoelaceCurrentPath.points.push(pos);
  renderCyberShoelaceCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function endCyberShoelaceDraw() {
  cyberShoelaceDrawing = false;
  cyberShoelaceCurrentPath = null;
}

function clearCyberShoelace() {
  cyberShoelacePaths = [];
  cyberShoelaceCurrentPath = null;
  cyberShoelaceDrawing = false;
  renderCyberShoelaceCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function undoCyberShoelace() {
  cyberShoelacePaths = cyberShoelacePaths.slice(0, -1);
  renderCyberShoelaceCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function ensureCyberPixelCells() {
  if (!Array.isArray(cyberPixelCells) || cyberPixelCells.length !== 9) {
    cyberPixelCells = Array(9).fill(null);
  }
  if (!cyberPixelSelectedColor) {
    cyberPixelSelectedColor = CYBER_PIXEL_COLORS[0];
  }
}

function renderCyberPixelPalette() {
  if (!cyberPixelPalette || cyberPixelPalette.childNodes.length) {
    return;
  }
  CYBER_PIXEL_COLORS.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cyber-pixel-color";
    button.style.background = color;
    button.title = color;
    button.addEventListener("click", () => {
      cyberPixelSelectedColor = color;
      updateCyberPixelPaletteHighlight();
    });
    cyberPixelPalette.appendChild(button);
  });
  updateCyberPixelPaletteHighlight();
}

function updateCyberPixelPaletteHighlight() {
  if (!cyberPixelPalette) {
    return;
  }
  const buttons = Array.from(cyberPixelPalette.querySelectorAll(".cyber-pixel-color"));
  buttons.forEach((button) => {
    const active = button.style.background === cyberPixelSelectedColor;
    button.classList.toggle("active", active);
  });
}

function initCyberPixelGrid() {
  if (!cyberPixelGrid || cyberPixelGrid.childNodes.length) {
    return;
  }
  ensureCyberPixelCells();
  for (let idx = 0; idx < 9; idx += 1) {
    const cell = document.createElement("div");
    cell.className = "cyber-pixel-cell";
    cell.dataset.index = `${idx}`;
    cell.addEventListener("click", () => {
      ensureCyberPixelCells();
      cyberPixelCells[idx] = cyberPixelSelectedColor;
      renderCyberPixelGrid();
      updateCyberSubmitButton(currentCyberView);
    });
    cyberPixelGrid.appendChild(cell);
  }
  renderCyberPixelGrid();
}

function renderCyberPixelGrid() {
  if (!cyberPixelGrid) {
    return;
  }
  ensureCyberPixelCells();
  Array.from(cyberPixelGrid.children).forEach((cell, idx) => {
    const color = cyberPixelCells[idx];
    if (color) {
      cell.style.background = color;
      cell.classList.remove("empty");
    } else {
      cell.style.background = "";
      cell.classList.add("empty");
    }
  });
}

function renderCyberIconPalette() {
  if (!cyberIconPalette || cyberIconPalette.childNodes.length) {
    return;
  }
  CYBER_ICON_SET.forEach((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = emoji;
    button.addEventListener("click", () => addCyberIcon(emoji));
    cyberIconPalette.appendChild(button);
  });
}

function addCyberIcon(emoji) {
  if (!cyberIconCanvas) {
    return;
  }
  if (cyberIconItems.length >= 5) {
    return;
  }
  const { width, height } = getCyberStageSize(cyberIconCanvas);
  const offset = (cyberIconItems.length % 3) * 12;
  const id = `icon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  cyberIconItems.push({
    id,
    emoji,
    x: width / 2 + offset,
    y: height / 2 + offset,
    rotation: 0,
  });
  cyberIconSelectedId = id;
  renderCyberIconCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function renderCyberIconCanvas() {
  if (!cyberIconCanvas) {
    return;
  }
  cyberIconCanvas.innerHTML = "";
  cyberIconItems.forEach((item) => {
    const el = document.createElement("div");
    el.className = "cyber-stage-item";
    if (item.id === cyberIconSelectedId) {
      el.classList.add("selected");
    }
    el.textContent = item.emoji;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    el.style.fontSize = "32px";
    el.style.transform = `translate(-50%, -50%) rotate(${item.rotation || 0}deg)`;
    el.dataset.id = item.id;
    el.addEventListener("pointerdown", startCyberIconDrag);
    cyberIconCanvas.appendChild(el);
  });
}

function startCyberIconDrag(event) {
  if (!cyberIconCanvas) {
    return;
  }
  const id = event.currentTarget.dataset.id;
  const item = cyberIconItems.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  event.preventDefault();
  const pos = getCyberRelativePos(event, cyberIconCanvas);
  cyberIconDragging = {
    id,
    offsetX: item.x - pos.x,
    offsetY: item.y - pos.y,
    element: event.currentTarget,
    startX: pos.x,
    startY: pos.y,
    moved: false,
  };
  cyberIconSelectedId = id;
  window.addEventListener("pointermove", onCyberIconDragMove);
  window.addEventListener("pointerup", onCyberIconDragEnd, { once: true });
}

function onCyberIconDragMove(event) {
  if (!cyberIconDragging || !cyberIconCanvas) {
    return;
  }
  const item = cyberIconItems.find((entry) => entry.id === cyberIconDragging.id);
  if (!item) {
    return;
  }
  const pos = getCyberRelativePos(event, cyberIconCanvas);
  const x = clampValue(pos.x + cyberIconDragging.offsetX, 0, pos.width);
  const y = clampValue(pos.y + cyberIconDragging.offsetY, 0, pos.height);
  item.x = x;
  item.y = y;
  if (Math.hypot(pos.x - cyberIconDragging.startX, pos.y - cyberIconDragging.startY) > 4) {
    cyberIconDragging.moved = true;
  }
  if (cyberIconDragging.element) {
    cyberIconDragging.element.style.left = `${x}px`;
    cyberIconDragging.element.style.top = `${y}px`;
  }
}

function onCyberIconDragEnd() {
  window.removeEventListener("pointermove", onCyberIconDragMove);
  const dragState = cyberIconDragging;
  if (dragState && !dragState.moved) {
    const item = cyberIconItems.find((entry) => entry.id === dragState.id);
    if (item) {
      item.rotation = (item.rotation + 90) % 360;
    }
  }
  cyberIconDragging = null;
  renderCyberIconCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function removeCyberIcon() {
  const removed = cyberIconItems[cyberIconItems.length - 1];
  cyberIconItems = cyberIconItems.slice(0, -1);
  if (removed && removed.id === cyberIconSelectedId) {
    cyberIconSelectedId = null;
  }
  renderCyberIconCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function clearCyberIcons() {
  cyberIconItems = [];
  cyberIconSelectedId = null;
  renderCyberIconCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function renderCyberLetterPalette() {
  if (!cyberLetterPalette || cyberLetterPalette.childNodes.length) {
    return;
  }
  ["A", "E", "I", "O", "U"].forEach((char) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = char;
    button.addEventListener("click", () => addCyberLetter(char));
    cyberLetterPalette.appendChild(button);
  });
}

function addCyberLetter(char) {
  if (!cyberLetterCanvas) {
    return;
  }
  if (cyberLetterItems.length >= 10) {
    return;
  }
  const { width, height } = getCyberStageSize(cyberLetterCanvas);
  const offset = (cyberLetterItems.length % 4) * 10;
  const id = `letter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  cyberLetterItems.push({
    id,
    char,
    x: width / 2 + offset,
    y: height / 2 + offset,
    rotation: 0,
  });
  cyberLetterSelectedId = id;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function renderCyberLetterCanvas() {
  if (!cyberLetterCanvas) {
    return;
  }
  cyberLetterCanvas.innerHTML = "";
  cyberLetterItems.forEach((item) => {
    const el = document.createElement("div");
    el.className = "cyber-stage-item";
    if (item.id === cyberLetterSelectedId) {
      el.classList.add("selected");
    }
    el.textContent = item.char;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    el.style.fontSize = "42px";
    el.style.fontWeight = "700";
    el.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg)`;
    el.dataset.id = item.id;
    el.addEventListener("pointerdown", startCyberLetterDrag);
    cyberLetterCanvas.appendChild(el);
  });
}

function updateCyberLetterRotationControl() {
  if (!cyberLetterRotate || !cyberLetterRotateValue) {
    return;
  }
  const item = cyberLetterItems.find((entry) => entry.id === cyberLetterSelectedId);
  const rotation = item ? item.rotation || 0 : 0;
  cyberLetterRotate.value = `${rotation}`;
  cyberLetterRotateValue.textContent = `${rotation}°`;
}

function setCyberLetterRotation(value) {
  const item = cyberLetterItems.find((entry) => entry.id === cyberLetterSelectedId);
  if (!item) {
    return;
  }
  const rotation = Number.isFinite(value) ? value : 0;
  item.rotation = rotation;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function startCyberLetterDrag(event) {
  if (!cyberLetterCanvas) {
    return;
  }
  const id = event.currentTarget.dataset.id;
  const item = cyberLetterItems.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  event.preventDefault();
  const pos = getCyberRelativePos(event, cyberLetterCanvas);
  cyberLetterDragging = {
    id,
    offsetX: item.x - pos.x,
    offsetY: item.y - pos.y,
    element: event.currentTarget,
    startX: pos.x,
    startY: pos.y,
    moved: false,
  };
  cyberLetterSelectedId = id;
  updateCyberLetterRotationControl();
  window.addEventListener("pointermove", onCyberLetterDragMove);
  window.addEventListener("pointerup", onCyberLetterDragEnd, { once: true });
}

function onCyberLetterDragMove(event) {
  if (!cyberLetterDragging || !cyberLetterCanvas) {
    return;
  }
  const item = cyberLetterItems.find((entry) => entry.id === cyberLetterDragging.id);
  if (!item) {
    return;
  }
  const pos = getCyberRelativePos(event, cyberLetterCanvas);
  const x = clampValue(pos.x + cyberLetterDragging.offsetX, 0, pos.width);
  const y = clampValue(pos.y + cyberLetterDragging.offsetY, 0, pos.height);
  item.x = x;
  item.y = y;
  if (Math.hypot(pos.x - cyberLetterDragging.startX, pos.y - cyberLetterDragging.startY) > 4) {
    cyberLetterDragging.moved = true;
  }
  if (cyberLetterDragging.element) {
    cyberLetterDragging.element.style.left = `${x}px`;
    cyberLetterDragging.element.style.top = `${y}px`;
  }
}

function onCyberLetterDragEnd() {
  window.removeEventListener("pointermove", onCyberLetterDragMove);
  const dragState = cyberLetterDragging;
  if (dragState && !dragState.moved) {
    const item = cyberLetterItems.find((entry) => entry.id === dragState.id);
    if (item) {
      item.rotation = (item.rotation + 90) % 360;
    }
  }
  cyberLetterDragging = null;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function rotateSelectedCyberLetter() {
  if (!cyberLetterSelectedId) {
    return;
  }
  const item = cyberLetterItems.find((entry) => entry.id === cyberLetterSelectedId);
  if (!item) {
    return;
  }
  item.rotation = (item.rotation + 90) % 360;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function removeSelectedCyberLetter() {
  if (!cyberLetterSelectedId) {
    return;
  }
  cyberLetterItems = cyberLetterItems.filter((entry) => entry.id !== cyberLetterSelectedId);
  cyberLetterSelectedId = null;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function clearCyberLetters() {
  cyberLetterItems = [];
  cyberLetterSelectedId = null;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function renderCyberShapePalette() {
  if (!cyberShapePalette || cyberShapePalette.childNodes.length) {
    return;
  }
  const shapes = [
    { id: "square", label: "□" },
    { id: "rectangle", label: "▭" },
    { id: "triangle", label: "△" },
    { id: "circle", label: "○" },
    { id: "arch", label: "◠" },
    { id: "ellipse", label: "⬭" },
    { id: "hexagon", label: "⬡" },
  ];
  shapes.forEach((shape) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = shape.label;
    button.addEventListener("click", () => addCyberShape(shape.id));
    cyberShapePalette.appendChild(button);
  });
}

function addCyberShape(shape) {
  if (!cyberShapeCanvas) {
    return;
  }
  if (cyberShapeItems.length >= 12) {
    return;
  }
  const { width, height } = getCyberStageSize(cyberShapeCanvas);
  const offset = (cyberShapeItems.length % 4) * 10;
  const id = `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  cyberShapeItems.push({
    id,
    shape,
    x: width / 2 + offset,
    y: height / 2 + offset,
    rotation: 0,
  });
  cyberShapeSelectedId = id;
  updateCyberShapeRotationControl();
  renderCyberShapeCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function buildCyberShapeSvg(shape, spec) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${spec.w} ${spec.h}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("class", "cyber-shape");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const strokeWidth = 3;
  const stroke = "#111827";
  const applyStroke = (el) => {
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-width", `${strokeWidth}`);
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
  };
  if (shape === "square" || shape === "rectangle") {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", `${strokeWidth / 2}`);
    rect.setAttribute("y", `${strokeWidth / 2}`);
    rect.setAttribute("width", `${spec.w - strokeWidth}`);
    rect.setAttribute("height", `${spec.h - strokeWidth}`);
    applyStroke(rect);
    svg.appendChild(rect);
    return svg;
  }
  if (shape === "circle") {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const radius = Math.min(spec.w, spec.h) / 2 - strokeWidth / 2;
    circle.setAttribute("cx", `${spec.w / 2}`);
    circle.setAttribute("cy", `${spec.h / 2}`);
    circle.setAttribute("r", `${radius}`);
    applyStroke(circle);
    svg.appendChild(circle);
    return svg;
  }
  if (shape === "ellipse") {
    const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    ellipse.setAttribute("cx", `${spec.w / 2}`);
    ellipse.setAttribute("cy", `${spec.h / 2}`);
    ellipse.setAttribute("rx", `${spec.w / 2 - strokeWidth / 2}`);
    ellipse.setAttribute("ry", `${spec.h / 2 - strokeWidth / 2}`);
    applyStroke(ellipse);
    svg.appendChild(ellipse);
    return svg;
  }
  if (shape === "triangle") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const topY = strokeWidth / 2;
    const bottomY = spec.h - strokeWidth / 2;
    const leftX = strokeWidth / 2;
    const rightX = spec.w - strokeWidth / 2;
    path.setAttribute("d", `M ${spec.w / 2} ${topY} L ${rightX} ${bottomY} L ${leftX} ${bottomY} Z`);
    applyStroke(path);
    svg.appendChild(path);
    return svg;
  }
  if (shape === "arch") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const radius = spec.w / 2 - strokeWidth / 2;
    const bottomY = spec.h - strokeWidth / 2;
    let arcY = spec.h - radius - strokeWidth / 2;
    if (arcY < strokeWidth / 2) {
      arcY = strokeWidth / 2;
    }
    const leftX = strokeWidth / 2;
    const rightX = spec.w - strokeWidth / 2;
    path.setAttribute(
      "d",
      `M ${leftX} ${bottomY} L ${leftX} ${arcY} A ${radius} ${radius} 0 0 0 ${rightX} ${arcY} L ${rightX} ${bottomY} Z`
    );
    applyStroke(path);
    svg.appendChild(path);
    return svg;
  }
  if (shape === "hexagon") {
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const w = spec.w - strokeWidth;
    const h = spec.h - strokeWidth;
    const offset = strokeWidth / 2;
    const dx = w * 0.25;
    const points = [
      [offset + dx, offset],
      [offset + w - dx, offset],
      [offset + w, offset + h / 2],
      [offset + w - dx, offset + h],
      [offset + dx, offset + h],
      [offset, offset + h / 2],
    ]
      .map((pair) => pair.join(","))
      .join(" ");
    polygon.setAttribute("points", points);
    applyStroke(polygon);
    svg.appendChild(polygon);
    return svg;
  }
  return svg;
}

function renderCyberShapeCanvas() {
  if (!cyberShapeCanvas) {
    return;
  }
  cyberShapeCanvas.innerHTML = "";
  cyberShapeItems.forEach((item) => {
    const shapeKey = item.shape === "cylinder" ? "ellipse" : item.shape;
    const spec = CYBER_SHAPE_SPECS[shapeKey] || { w: 80, h: 60 };
    const wrapper = document.createElement("div");
    wrapper.className = "cyber-stage-item cyber-shape-item";
    if (item.id === cyberShapeSelectedId) {
      wrapper.classList.add("selected");
    }
    wrapper.style.left = `${item.x}px`;
    wrapper.style.top = `${item.y}px`;
    wrapper.style.width = `${spec.w}px`;
    wrapper.style.height = `${spec.h}px`;
    wrapper.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg)`;
    wrapper.dataset.id = item.id;
    wrapper.addEventListener("pointerdown", startCyberShapeDrag);

    const shapeEl = buildCyberShapeSvg(shapeKey, spec);
    wrapper.appendChild(shapeEl);
    cyberShapeCanvas.appendChild(wrapper);
  });
}

function startCyberShapeDrag(event) {
  if (!cyberShapeCanvas) {
    return;
  }
  const id = event.currentTarget.dataset.id;
  const item = cyberShapeItems.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  event.preventDefault();
  const pos = getCyberRelativePos(event, cyberShapeCanvas);
  cyberShapeDragging = {
    id,
    offsetX: item.x - pos.x,
    offsetY: item.y - pos.y,
    element: event.currentTarget,
  };
  cyberShapeSelectedId = id;
  updateCyberShapeRotationControl();
  window.addEventListener("pointermove", onCyberShapeDragMove);
  window.addEventListener("pointerup", onCyberShapeDragEnd, { once: true });
}

function onCyberShapeDragMove(event) {
  if (!cyberShapeDragging || !cyberShapeCanvas) {
    return;
  }
  const item = cyberShapeItems.find((entry) => entry.id === cyberShapeDragging.id);
  if (!item) {
    return;
  }
  const pos = getCyberRelativePos(event, cyberShapeCanvas);
  const x = clampValue(pos.x + cyberShapeDragging.offsetX, 0, pos.width);
  const y = clampValue(pos.y + cyberShapeDragging.offsetY, 0, pos.height);
  item.x = x;
  item.y = y;
  if (cyberShapeDragging.element) {
    cyberShapeDragging.element.style.left = `${x}px`;
    cyberShapeDragging.element.style.top = `${y}px`;
  }
}

function onCyberShapeDragEnd() {
  window.removeEventListener("pointermove", onCyberShapeDragMove);
  cyberShapeDragging = null;
  renderCyberShapeCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function updateCyberShapeRotationControl() {
  if (!cyberShapeRotate || !cyberShapeRotateValue) {
    return;
  }
  const item = cyberShapeItems.find((entry) => entry.id === cyberShapeSelectedId);
  const rotation = item ? item.rotation : 0;
  cyberShapeRotate.value = `${rotation}`;
  cyberShapeRotateValue.textContent = `${rotation}°`;
}

function setCyberShapeRotation(value) {
  const item = cyberShapeItems.find((entry) => entry.id === cyberShapeSelectedId);
  if (!item) {
    return;
  }
  const rotation = Number.isFinite(value) ? value : 0;
  item.rotation = rotation;
  updateCyberShapeRotationControl();
  renderCyberShapeCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function removeSelectedCyberShape() {
  if (!cyberShapeSelectedId) {
    return;
  }
  cyberShapeItems = cyberShapeItems.filter((entry) => entry.id !== cyberShapeSelectedId);
  cyberShapeSelectedId = null;
  updateCyberShapeRotationControl();
  renderCyberShapeCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function clearCyberShapes() {
  cyberShapeItems = [];
  cyberShapeSelectedId = null;
  updateCyberShapeRotationControl();
  renderCyberShapeCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function drawCyberSmoothPath(ctx, points) {
  if (!points || points.length < 2) {
    return;
  }
  let segment = [];
  const flush = () => {
    if (segment.length < 2) {
      segment = [];
      return;
    }
    ctx.beginPath();
    ctx.moveTo(segment[0].x, segment[0].y);
    for (let i = 1; i < segment.length - 1; i += 1) {
      const midX = (segment[i].x + segment[i + 1].x) / 2;
      const midY = (segment[i].y + segment[i + 1].y) / 2;
      ctx.quadraticCurveTo(segment[i].x, segment[i].y, midX, midY);
    }
    const last = segment[segment.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    segment = [];
  };
  points.forEach((pt) => {
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
      flush();
      return;
    }
    segment.push(pt);
  });
  flush();
}

function getCyberThrusterParams(width, height) {
  const speed = width / CYBER_THRUSTER_CROSS_SEC;
  return {
    speed,
    gravity: height * CYBER_THRUSTER_GRAVITY_RATIO,
    thrust: height * CYBER_THRUSTER_THRUST_RATIO,
    radius: CYBER_THRUSTER_RADIUS,
  };
}

function getCyberThrusterStartPoint(width, height) {
  const params = getCyberThrusterParams(width, height);
  return {
    x: params.radius,
    y: height * 0.5,
  };
}

function getCyberThrusterBounds(width, height) {
  const params = getCyberThrusterParams(width, height);
  const margin = CYBER_THRUSTER_TOLERANCE;
  return {
    inner: {
      left: margin + params.radius,
      right: width - margin - params.radius,
      top: margin + params.radius,
      bottom: height - margin - params.radius,
    },
    outer: {
      left: params.radius,
      right: width - params.radius,
      top: params.radius,
      bottom: height - params.radius,
    },
  };
}

function isCyberThrusterInBounds(bounds, x, y) {
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

function formatSignedMetric(value) {
  const rounded = Math.round(value * 10) / 10;
  const display = Math.abs(rounded) < 0.05 ? 0 : rounded;
  const sign = display >= 0 ? "+" : "";
  return `${sign}${display.toFixed(1)}`;
}

function updateCyberThrusterMetrics(width, height) {
  if (!cyberThrusterAccel && !cyberThrusterVelocityLabel) {
    return;
  }
  let accel = 0;
  let velocity = 0;
  if (cyberThrusterActive && Number.isFinite(width) && Number.isFinite(height)) {
    const params = getCyberThrusterParams(width, height);
    const thrust = cyberThrusterThrusting ? params.thrust : 0;
    accel = thrust - params.gravity;
    velocity = -cyberThrusterVelocity;
  }
  if (cyberThrusterAccel) {
    cyberThrusterAccel.textContent = `Acceleration (up +): ${formatSignedMetric(accel)} px/s^2`;
  }
  if (cyberThrusterVelocityLabel) {
    cyberThrusterVelocityLabel.textContent = `Velocity (up +): ${formatSignedMetric(velocity)} px/s`;
  }
}

function recordCyberThrusterPoint(x, y, bounds) {
  if (!cyberThrusterCurrentPath) {
    return;
  }
  const inInner = isCyberThrusterInBounds(bounds.inner, x, y);
  if (inInner) {
    const points = cyberThrusterCurrentPath.points;
    if (cyberThrusterWasOutside && points.length > 0 && points[points.length - 1] !== null) {
      points.push(null);
    }
    points.push({ x, y });
    cyberThrusterWasOutside = false;
  } else {
    cyberThrusterWasOutside = true;
  }
}

function setCyberThrusterStartPosition() {
  if (!cyberThrusterCanvas) {
    return;
  }
  const width = cyberThrusterCanvas.width;
  const height = cyberThrusterCanvas.height;
  const start = getCyberThrusterStartPoint(width, height);
  cyberThrusterX = start.x;
  cyberThrusterY = start.y;
  cyberThrusterVelocity = 0;
}

function updateCyberThrusterAttempts() {
  if (cyberThrusterAttempts) {
    cyberThrusterAttempts.textContent = `Attempts left: ${cyberThrusterAttemptsLeft}`;
  }
  if (cyberThrusterUndoBtn) {
    cyberThrusterUndoBtn.disabled = cyberThrusterPaths.length === 0;
  }
}

function renderCyberThrusterCanvas() {
  if (!cyberThrusterCanvas || !cyberThrusterCtx) {
    return;
  }
  const width = cyberThrusterCanvas.width;
  const height = cyberThrusterCanvas.height;
  cyberThrusterCtx.clearRect(0, 0, width, height);
  cyberThrusterCtx.fillStyle = "#ffffff";
  cyberThrusterCtx.fillRect(0, 0, width, height);
  cyberThrusterCtx.lineCap = "round";
  cyberThrusterCtx.lineJoin = "round";
  cyberThrusterPaths.forEach((path) => {
    const points = path.points || [];
    if (points.length < 2) {
      return;
    }
    cyberThrusterCtx.strokeStyle = path.color || CYBER_THRUSTER_COLOR;
    cyberThrusterCtx.lineWidth = path.width || CYBER_THRUSTER_STROKE;
    drawCyberSmoothPath(cyberThrusterCtx, points);
  });
  const start = getCyberThrusterStartPoint(width, height);
  const rocketX = cyberThrusterActive ? cyberThrusterX : start.x;
  const rocketY = cyberThrusterActive ? cyberThrusterY : start.y;
  cyberThrusterCtx.fillStyle = "#f97316";
  cyberThrusterCtx.beginPath();
  cyberThrusterCtx.arc(rocketX, rocketY, CYBER_THRUSTER_RADIUS, 0, Math.PI * 2);
  cyberThrusterCtx.fill();
  updateCyberThrusterMetrics(width, height);
}

function startCyberThrusterLaunch() {
  if (!cyberThrusterCanvas || !cyberThrusterCtx) {
    return;
  }
  if (cyberThrusterActive || cyberThrusterAttemptsLeft <= 0) {
    return;
  }
  if (!currentCyberView || currentCyberView.phase !== "crafting") {
    return;
  }
  const toolKey = Number.isFinite(currentCyberView.your_tool)
    ? CYBER_TOOL_KEYS[currentCyberView.your_tool]
    : null;
  if (toolKey !== "thruster") {
    return;
  }
  const width = cyberThrusterCanvas.width;
  const height = cyberThrusterCanvas.height;
  cyberThrusterAttemptsLeft -= 1;
  setCyberThrusterStartPosition();
  cyberThrusterCurrentPath = {
    points: [],
    color: CYBER_THRUSTER_COLOR,
    width: CYBER_THRUSTER_STROKE,
  };
  cyberThrusterPaths.push(cyberThrusterCurrentPath);
  cyberThrusterActive = true;
  cyberThrusterThrusting = false;
  cyberThrusterLastTs = null;
  cyberThrusterWasOutside = false;
  recordCyberThrusterPoint(cyberThrusterX, cyberThrusterY, getCyberThrusterBounds(width, height));
  updateCyberThrusterAttempts();
  renderCyberThrusterCanvas();
  cyberThrusterFrame = window.requestAnimationFrame(stepCyberThruster);
}

function stepCyberThruster(timestamp) {
  if (!cyberThrusterActive || !cyberThrusterCanvas) {
    cyberThrusterFrame = null;
    return;
  }
  const width = cyberThrusterCanvas.width;
  const height = cyberThrusterCanvas.height;
  if (!cyberThrusterLastTs) {
    cyberThrusterLastTs = timestamp;
  }
  const dt = Math.min(0.05, (timestamp - cyberThrusterLastTs) / 1000);
  cyberThrusterLastTs = timestamp;
  const params = getCyberThrusterParams(width, height);
  const thrust = cyberThrusterThrusting ? params.thrust : 0;
  cyberThrusterVelocity += (params.gravity - thrust) * dt;
  cyberThrusterY += cyberThrusterVelocity * dt;
  cyberThrusterX += params.speed * dt;
  const bounds = getCyberThrusterBounds(width, height);
  recordCyberThrusterPoint(cyberThrusterX, cyberThrusterY, bounds);
  renderCyberThrusterCanvas();
  updateCyberSubmitButton(currentCyberView);
  if (!isCyberThrusterInBounds(bounds.outer, cyberThrusterX, cyberThrusterY)) {
    endCyberThrusterRun();
    return;
  }
  cyberThrusterFrame = window.requestAnimationFrame(stepCyberThruster);
}

function endCyberThrusterRun() {
  cyberThrusterActive = false;
  cyberThrusterThrusting = false;
  cyberThrusterCurrentPath = null;
  cyberThrusterLastTs = null;
  cyberThrusterWasOutside = false;
  if (cyberThrusterFrame) {
    window.cancelAnimationFrame(cyberThrusterFrame);
    cyberThrusterFrame = null;
  }
  setCyberThrusterStartPosition();
  updateCyberThrusterAttempts();
  renderCyberThrusterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function undoCyberThrusterRun() {
  if (cyberThrusterPaths.length === 0) {
    return;
  }
  if (cyberThrusterFrame) {
    window.cancelAnimationFrame(cyberThrusterFrame);
  }
  cyberThrusterFrame = null;
  cyberThrusterActive = false;
  cyberThrusterThrusting = false;
  cyberThrusterCurrentPath = null;
  cyberThrusterLastTs = null;
  cyberThrusterWasOutside = false;
  cyberThrusterPaths = cyberThrusterPaths.slice(0, -1);
  cyberThrusterAttemptsLeft = Math.min(CYBER_THRUSTER_MAX_ATTEMPTS, cyberThrusterAttemptsLeft + 1);
  setCyberThrusterStartPosition();
  updateCyberThrusterAttempts();
  renderCyberThrusterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function setCyberThrusterThrusting(active) {
  if (!cyberThrusterActive) {
    return;
  }
  cyberThrusterThrusting = active;
}

function isCyberThrusterToolActive() {
  if (!currentCyberView || currentGameType !== "cyber_pictures") {
    return false;
  }
  if (currentCyberView.phase !== "crafting") {
    return false;
  }
  const toolKey = Number.isFinite(currentCyberView.your_tool)
    ? CYBER_TOOL_KEYS[currentCyberView.your_tool]
    : null;
  return toolKey === "thruster";
}

function onCyberThrusterKeyDown(event) {
  if (event.code !== "Space") {
    return;
  }
  if (isTypingTarget(event.target) || !isCyberThrusterToolActive()) {
    return;
  }
  event.preventDefault();
  if (!cyberThrusterActive) {
    startCyberThrusterLaunch();
  }
  setCyberThrusterThrusting(true);
}

function onCyberThrusterKeyUp(event) {
  if (event.code !== "Space") {
    return;
  }
  if (isTypingTarget(event.target) || !isCyberThrusterToolActive()) {
    return;
  }
  event.preventDefault();
  setCyberThrusterThrusting(false);
}

function resetCyberThrusterState() {
  if (cyberThrusterFrame) {
    window.cancelAnimationFrame(cyberThrusterFrame);
  }
  cyberThrusterFrame = null;
  cyberThrusterActive = false;
  cyberThrusterThrusting = false;
  cyberThrusterCurrentPath = null;
  cyberThrusterPaths = [];
  cyberThrusterAttemptsLeft = CYBER_THRUSTER_MAX_ATTEMPTS;
  cyberThrusterLastTs = null;
  cyberThrusterWasOutside = false;
  setCyberThrusterStartPosition();
  updateCyberThrusterAttempts();
  renderCyberThrusterCanvas();
}

function ensureCyberSynthValues() {
  if (!Array.isArray(cyberSynthValues) || cyberSynthValues.length !== CYBER_SYNTH_BARS) {
    cyberSynthValues = Array(CYBER_SYNTH_BARS).fill(0);
  }
}

function initCyberSynthGrid() {
  if (!cyberSynthGrid || cyberSynthGrid.childNodes.length) {
    return;
  }
  ensureCyberSynthValues();
  cyberSynthBarEls = [];
  cyberSynthSliderEls = [];
  for (let i = 0; i < CYBER_SYNTH_BARS; i += 1) {
    const column = document.createElement("div");
    column.className = "cyber-synth-column";
    const bar = document.createElement("div");
    bar.className = "cyber-synth-bar";
    const fill = document.createElement("div");
    fill.className = "cyber-synth-fill";
    bar.appendChild(fill);
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.value = `${cyberSynthValues[i]}`;
    slider.className = "cyber-synth-slider";
    slider.addEventListener("input", () => {
      cyberSynthValues[i] = Number(slider.value);
      renderCyberSynthGrid();
      updateCyberSubmitButton(currentCyberView);
    });
    column.appendChild(bar);
    column.appendChild(slider);
    cyberSynthGrid.appendChild(column);
    cyberSynthBarEls.push(fill);
    cyberSynthSliderEls.push(slider);
  }
  renderCyberSynthGrid();
}

function renderCyberSynthGrid() {
  if (!cyberSynthGrid) {
    return;
  }
  ensureCyberSynthValues();
  cyberSynthBarEls.forEach((fill, idx) => {
    const value = clampValue(Number(cyberSynthValues[idx] || 0), 0, 100);
    fill.style.height = `${value}%`;
  });
  cyberSynthSliderEls.forEach((slider, idx) => {
    const value = clampValue(Number(cyberSynthValues[idx] || 0), 0, 100);
    slider.value = `${value}`;
  });
}

function resetCyberSynthState() {
  cyberSynthValues = Array(CYBER_SYNTH_BARS).fill(0);
  renderCyberSynthGrid();
}

function drawCyberShape(ctx, shape, x, y, rotation) {
  const shapeKey = shape === "cylinder" ? "ellipse" : shape;
  const spec = CYBER_SHAPE_SPECS[shapeKey] || { w: 80, h: 60 };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((rotation || 0) * Math.PI) / 180);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (shapeKey === "square" || shapeKey === "rectangle") {
    ctx.strokeRect(-spec.w / 2, -spec.h / 2, spec.w, spec.h);
  } else if (shapeKey === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(spec.w, spec.h) / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shapeKey === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(0, 0, spec.w / 2, spec.h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shapeKey === "triangle") {
    ctx.beginPath();
    ctx.moveTo(0, -spec.h / 2);
    ctx.lineTo(spec.w / 2, spec.h / 2);
    ctx.lineTo(-spec.w / 2, spec.h / 2);
    ctx.closePath();
    ctx.stroke();
  } else if (shapeKey === "arch") {
    const radius = spec.w / 2;
    const arcY = -spec.h / 2 + radius;
    ctx.beginPath();
    ctx.moveTo(-spec.w / 2, spec.h / 2);
    ctx.lineTo(-spec.w / 2, arcY);
    ctx.arc(0, arcY, radius, Math.PI, 0, true);
    ctx.lineTo(spec.w / 2, spec.h / 2);
    ctx.closePath();
    ctx.stroke();
  } else if (shapeKey === "hexagon") {
    const dx = spec.w * 0.25;
    ctx.beginPath();
    ctx.moveTo(-spec.w / 2 + dx, -spec.h / 2);
    ctx.lineTo(spec.w / 2 - dx, -spec.h / 2);
    ctx.lineTo(spec.w / 2, 0);
    ctx.lineTo(spec.w / 2 - dx, spec.h / 2);
    ctx.lineTo(-spec.w / 2 + dx, spec.h / 2);
    ctx.lineTo(-spec.w / 2, 0);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function renderCyberSubmission(canvas, submission) {
  if (!canvas || !submission) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sourceW = submission.width || CYBER_CANVAS_SIZE;
  const sourceH = submission.height || CYBER_CANVAS_SIZE;
  const scale = Math.min(canvas.width / sourceW, canvas.height / sourceH);
  const offsetX = (canvas.width - sourceW * scale) / 2;
  const offsetY = (canvas.height - sourceH * scale) / 2;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  const tool = submission.tool;
  if (tool === "shoelaces") {
    const paths = submission.paths || [];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    paths.forEach((path) => {
      const points = path.points || [];
      if (points.length < 2) {
        return;
      }
      ctx.strokeStyle = path.color || "#111111";
      ctx.lineWidth = path.width || 4;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((pt) => ctx.lineTo(pt.x, pt.y));
      ctx.stroke();
    });
  } else if (tool === "thruster") {
    const paths = submission.paths || [];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    paths.forEach((path) => {
      const points = path.points || [];
      if (points.length < 2) {
        return;
      }
      ctx.strokeStyle = path.color || CYBER_THRUSTER_COLOR;
      ctx.lineWidth = path.width || CYBER_THRUSTER_STROKE;
      drawCyberSmoothPath(ctx, points);
    });
  } else if (tool === "pixel_grid") {
    const cells = submission.cells || [];
    const cellW = sourceW / 3;
    const cellH = sourceH / 3;
    for (let idx = 0; idx < 9; idx += 1) {
      const color = cells[idx] || "#ffffff";
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      ctx.fillStyle = color;
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
      ctx.strokeStyle = "#e5e7eb";
      ctx.strokeRect(col * cellW, row * cellH, cellW, cellH);
    }
  } else if (tool === "icon_set") {
    const icons = submission.icons || [];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${CYBER_TEXT_SIZE}px serif`;
    icons.forEach((icon) => {
      if (!icon) {
        return;
      }
      ctx.save();
      ctx.translate(icon.x, icon.y);
      ctx.rotate(((icon.rotation || 0) * Math.PI) / 180);
      ctx.fillText(icon.emoji || "", 0, 0);
      ctx.restore();
    });
  } else if (tool === "aeiou") {
    const letters = submission.letters || [];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${CYBER_TEXT_SIZE}px sans-serif`;
    letters.forEach((letter) => {
      if (!letter) {
        return;
      }
      ctx.save();
      ctx.translate(letter.x, letter.y);
      ctx.rotate(((letter.rotation || 0) * Math.PI) / 180);
      ctx.fillStyle = "#111827";
      ctx.fillText(letter.char || "", 0, 0);
      ctx.restore();
    });
  } else if (tool === "synthesizer") {
    const values = submission.values || [];
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0, 0, sourceW, sourceH);
    const gap = Math.max(2, Math.round(sourceW * 0.01));
    const barW = (sourceW - gap * (CYBER_SYNTH_BARS - 1)) / CYBER_SYNTH_BARS;
    for (let i = 0; i < CYBER_SYNTH_BARS; i += 1) {
      const value = clampValue(Number(values[i] || 0), 0, 100);
      const barH = (sourceH * value) / 100;
      const x = i * (barW + gap);
      const y = sourceH - barH;
      ctx.fillStyle = "#39ff14";
      ctx.fillRect(x, y, barW, barH);
    }
  } else if (tool === "shape_stacker") {
    const shapes = submission.shapes || [];
    shapes.forEach((shape) => {
      if (!shape) {
        return;
      }
      drawCyberShape(ctx, shape.shape, shape.x, shape.y, shape.rotation || 0);
    });
  }
  ctx.restore();
}

function setCyberActiveTool(toolIndex) {
  const toolKey = Number.isFinite(toolIndex) ? CYBER_TOOL_KEYS[toolIndex] : null;
  const toolMap = {
    shoelaces: cyberToolShoelaces,
    pixel_grid: cyberToolPixel,
    icon_set: cyberToolIconSet,
    aeiou: cyberToolLetters,
    shape_stacker: cyberToolShapes,
    thruster: cyberToolThruster,
    synthesizer: cyberToolSynth,
  };
  Object.values(toolMap).forEach((el) => {
    if (el) {
      el.classList.add("hidden");
    }
  });
  if (toolKey && toolMap[toolKey]) {
    toolMap[toolKey].classList.remove("hidden");
  }
  return toolKey;
}

function resetCyberToolState(toolKey) {
  if (toolKey === "shoelaces") {
    cyberShoelacePaths = [];
    cyberShoelaceCurrentPath = null;
    cyberShoelaceDrawing = false;
    renderCyberShoelaceCanvas();
  } else if (toolKey === "pixel_grid") {
    cyberPixelCells = Array(9).fill(null);
    renderCyberPixelGrid();
  } else if (toolKey === "icon_set") {
    cyberIconItems = [];
    cyberIconSelectedId = null;
    renderCyberIconCanvas();
  } else if (toolKey === "aeiou") {
    cyberLetterItems = [];
    cyberLetterSelectedId = null;
    updateCyberLetterRotationControl();
    renderCyberLetterCanvas();
  } else if (toolKey === "shape_stacker") {
    cyberShapeItems = [];
    cyberShapeSelectedId = null;
    updateCyberShapeRotationControl();
    renderCyberShapeCanvas();
  } else if (toolKey === "thruster") {
    resetCyberThrusterState();
  } else if (toolKey === "synthesizer") {
    resetCyberSynthState();
  }
}

function buildCyberSubmission(toolIndex) {
  const toolKey = CYBER_TOOL_KEYS[toolIndex] || "shoelaces";
  if (toolKey === "shoelaces") {
    return {
      tool: toolKey,
      width: cyberShoelaceCanvas ? cyberShoelaceCanvas.width : CYBER_CANVAS_SIZE,
      height: cyberShoelaceCanvas ? cyberShoelaceCanvas.height : CYBER_CANVAS_SIZE,
      paths: cyberShoelacePaths.map((path) => ({
        points: path.points.map((pt) => ({ x: pt.x, y: pt.y })),
        color: path.color,
        width: path.width,
      })),
    };
  }
  if (toolKey === "pixel_grid") {
    ensureCyberPixelCells();
    return {
      tool: toolKey,
      width: CYBER_CANVAS_SIZE,
      height: CYBER_CANVAS_SIZE,
      cells: cyberPixelCells.slice(),
    };
  }
  if (toolKey === "icon_set") {
    const { width, height } = getCyberStageSize(cyberIconCanvas);
    return {
      tool: toolKey,
      width,
      height,
      icons: cyberIconItems.map((item) => ({
        emoji: item.emoji,
        x: item.x,
        y: item.y,
        rotation: item.rotation || 0,
      })),
    };
  }
  if (toolKey === "aeiou") {
    const { width, height } = getCyberStageSize(cyberLetterCanvas);
    return {
      tool: toolKey,
      width,
      height,
      letters: cyberLetterItems.map((item) => ({
        char: item.char,
        x: item.x,
        y: item.y,
        rotation: item.rotation || 0,
      })),
    };
  }
  if (toolKey === "thruster") {
    return {
      tool: toolKey,
      width: cyberThrusterCanvas ? cyberThrusterCanvas.width : CYBER_CANVAS_SIZE,
      height: cyberThrusterCanvas ? cyberThrusterCanvas.height : CYBER_CANVAS_SIZE,
      paths: cyberThrusterPaths.map((path) => ({
        points: (path.points || []).map((pt) =>
          pt && Number.isFinite(pt.x) && Number.isFinite(pt.y) ? { x: pt.x, y: pt.y } : null
        ),
        color: path.color,
        width: path.width,
      })),
    };
  }
  if (toolKey === "synthesizer") {
    ensureCyberSynthValues();
    return {
      tool: toolKey,
      width: CYBER_CANVAS_SIZE,
      height: CYBER_CANVAS_SIZE,
      values: cyberSynthValues.map((value) => Math.round(value)),
    };
  }
  const { width, height } = getCyberStageSize(cyberShapeCanvas);
  return {
    tool: toolKey,
    width,
    height,
    shapes: cyberShapeItems.map((item) => ({
      shape: item.shape,
      x: item.x,
      y: item.y,
      rotation: item.rotation || 0,
    })),
  };
}

function canSubmitCyber(toolKey) {
  if (toolKey === "shoelaces") {
    return cyberShoelacePaths.length > 0;
  }
  if (toolKey === "pixel_grid") {
    ensureCyberPixelCells();
    return cyberPixelCells.every((cell) => Boolean(cell));
  }
  if (toolKey === "icon_set") {
    return cyberIconItems.length >= 2 && cyberIconItems.length <= 5;
  }
  if (toolKey === "aeiou") {
    return cyberLetterItems.length >= 1 && cyberLetterItems.length <= 10;
  }
  if (toolKey === "thruster") {
    return cyberThrusterPaths.some((path) => (path.points || []).length > 1);
  }
  if (toolKey === "synthesizer") {
    ensureCyberSynthValues();
    return cyberSynthValues.length === CYBER_SYNTH_BARS;
  }
  if (toolKey === "shape_stacker") {
    return cyberShapeItems.length >= 1;
  }
  return false;
}

function updateCyberSubmitButton(view) {
  if (!cyberSubmitBtn) {
    return;
  }
  if (!view || view.phase !== "crafting" || !Number.isFinite(view.your_tool)) {
    cyberSubmitBtn.disabled = true;
    return;
  }
  if (view.submitted) {
    cyberSubmitBtn.disabled = true;
    if (cyberSubmissionHint) {
      cyberSubmissionHint.textContent = "Submitted.";
    }
    return;
  }
  const toolKey = CYBER_TOOL_KEYS[view.your_tool];
  const ready = canSubmitCyber(toolKey);
  cyberSubmitBtn.disabled = !ready;
  if (cyberSubmissionHint) {
    cyberSubmissionHint.textContent = ready ? "" : "Complete your tool before submitting.";
  }
}

function renderCyberMatrix(matrix, target) {
  if (!cyberMatrixEl) {
    return;
  }
  cyberMatrixEl.innerHTML = "";
  (matrix || []).forEach((cell) => {
    const wrapper = document.createElement("div");
    wrapper.className = "cyber-cell";
    if (target && cell.id === target) {
      wrapper.classList.add("target");
    }
    const img = document.createElement("img");
    img.src = cell.url;
    img.alt = cell.id || "card";
    const label = document.createElement("div");
    label.className = "cyber-coord";
    label.textContent = cell.id || "-";
    wrapper.appendChild(img);
    wrapper.appendChild(label);
    cyberMatrixEl.appendChild(wrapper);
  });
}

function renderCyberPlayers(view) {
  if (!cyberPlayers) {
    return;
  }
  cyberPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const toolKey = Number.isFinite(player.tool_index) ? CYBER_TOOL_KEYS[player.tool_index] : null;
    const toolLabel = toolKey ? CYBER_TOOL_LABELS[toolKey] : "-";
    row.textContent = `${player.name || "?"} · ${player.score ?? 0} pts · ${toolLabel}`;
    if (player.player_id === view.you) {
      row.classList.add("player-you");
    }
    cyberPlayers.appendChild(row);
  });
}

function renderCyberGuessArea(view) {
  if (!cyberWorks) {
    return;
  }
  if (view && view.your_guesses) {
    cyberGuessSelections = { ...view.your_guesses };
  }
  const works = Array.isArray(view.works) ? view.works : [];
  cyberWorks.innerHTML = "";
  works.forEach((work, index) => {
    const card = document.createElement("div");
    card.className = "cyber-work-card";
    const header = document.createElement("div");
    header.className = "cyber-work-header";
    header.textContent = work.is_self ? "Your Work" : `Work #${index + 1}`;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "cyber-work-body";
    const canvas = document.createElement("canvas");
    canvas.className = "cyber-preview";
    canvas.width = 180;
    canvas.height = 180;
    renderCyberSubmission(canvas, work.submission);
    body.appendChild(canvas);

    if (!work.is_self) {
      const select = document.createElement("select");
      select.className = "cyber-guess-select";
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "-";
      select.appendChild(empty);
      CYBER_COORDS.forEach((coord) => {
        const option = document.createElement("option");
        option.value = coord;
        option.textContent = coord;
        select.appendChild(option);
      });
      if (cyberGuessSelections[work.work_id]) {
        select.value = cyberGuessSelections[work.work_id];
      }
      select.disabled = view.guessed;
      select.addEventListener("change", () => {
        cyberGuessSelections[work.work_id] = select.value;
        updateCyberGuessButton(view);
      });
      body.appendChild(select);
    } else {
      const note = document.createElement("div");
      note.className = "hint";
      note.textContent = "You do not guess your own work.";
      body.appendChild(note);
    }

    card.appendChild(body);
    cyberWorks.appendChild(card);
  });
  updateCyberGuessButton(view);
}

function updateCyberGuessButton(view) {
  if (!cyberSubmitGuessBtn) {
    return;
  }
  if (!view || view.phase !== "guessing") {
    cyberSubmitGuessBtn.disabled = true;
    return;
  }
  if (view.guessed) {
    cyberSubmitGuessBtn.disabled = true;
    return;
  }
  const works = Array.isArray(view.works) ? view.works : [];
  const ready = works.every((work) => {
    if (work.is_self) {
      return true;
    }
    return Boolean(cyberGuessSelections[work.work_id]);
  });
  cyberSubmitGuessBtn.disabled = !ready;
}

function renderCyberScoreArea(view) {
  if (cyberRoundScores) {
    cyberRoundScores.innerHTML = "";
    (view.round_scores || []).forEach((score) => {
      const card = document.createElement("div");
      card.className = "cyber-score-card";
      const name = document.createElement("div");
      name.className = "score-name";
      name.textContent = score.name || "?";
      const detail = document.createElement("div");
      detail.textContent = `Guess +${score.guess_points} · Artist +${score.artist_points} · Total ${score.total_score}`;
      card.appendChild(name);
      card.appendChild(detail);
      cyberRoundScores.appendChild(card);
    });
  }
  if (cyberReveal) {
    cyberReveal.innerHTML = "";
    (view.reveal || []).forEach((entry, idx) => {
      const card = document.createElement("div");
      card.className = "cyber-reveal-card";
      const header = document.createElement("div");
      header.className = "cyber-reveal-header";
      header.textContent = `#${idx + 1} ${entry.owner_name || "?"} · Target ${entry.target || "-"}`;
      card.appendChild(header);
      const canvas = document.createElement("canvas");
      canvas.className = "cyber-preview";
      canvas.width = 180;
      canvas.height = 180;
      renderCyberSubmission(canvas, entry.submission);
      card.appendChild(canvas);
      const guesses = entry.guesses || [];
      guesses.forEach((guess) => {
        const line = document.createElement("div");
        line.className = "cyber-guess-row";
        const name = document.createElement("span");
        name.textContent = guess.name || "?";
        const coord = document.createElement("span");
        coord.textContent = guess.guess || "-";
        coord.className = guess.correct ? "cyber-guess-correct" : "cyber-guess-wrong";
        line.appendChild(name);
        line.appendChild(coord);
        card.appendChild(line);
      });
      cyberReveal.appendChild(card);
    });
  }
}

function clearCyberState() {
  currentCyberView = null;
  cyberLastRound = null;
  cyberLastPhase = null;
  cyberLastToolIndex = null;
  cyberShoelacePaths = [];
  cyberShoelaceCurrentPath = null;
  cyberShoelaceDrawing = false;
  cyberPixelCells = Array(9).fill(null);
  cyberPixelSelectedColor = CYBER_PIXEL_COLORS[0];
  cyberIconItems = [];
  cyberIconDragging = null;
  cyberIconSelectedId = null;
  cyberLetterItems = [];
  cyberLetterDragging = null;
  cyberLetterSelectedId = null;
  cyberShapeItems = [];
  cyberShapeDragging = null;
  cyberShapeSelectedId = null;
  cyberThrusterPaths = [];
  cyberThrusterCurrentPath = null;
  cyberThrusterActive = false;
  cyberThrusterThrusting = false;
  cyberThrusterAttemptsLeft = CYBER_THRUSTER_MAX_ATTEMPTS;
  if (cyberThrusterFrame) {
    window.cancelAnimationFrame(cyberThrusterFrame);
  }
  cyberThrusterFrame = null;
  cyberThrusterLastTs = null;
  cyberThrusterX = 0;
  cyberThrusterY = 0;
  cyberThrusterVelocity = 0;
  cyberThrusterWasOutside = false;
  cyberSynthValues = Array(CYBER_SYNTH_BARS).fill(0);
  cyberGuessSelections = {};
  if (cyberPhaseLabel) cyberPhaseLabel.textContent = "-";
  if (cyberRoundLabel) cyberRoundLabel.textContent = "-";
  if (cyberTotalRoundsLabel) cyberTotalRoundsLabel.textContent = "-";
  if (cyberToolLabel) cyberToolLabel.textContent = "-";
  if (cyberTargetLabel) cyberTargetLabel.textContent = "-";
  if (cyberSubmittedLabel) cyberSubmittedLabel.textContent = "-";
  if (cyberGuessedLabel) cyberGuessedLabel.textContent = "-";
  if (cyberMatrixEl) cyberMatrixEl.innerHTML = "";
  if (cyberWorks) cyberWorks.innerHTML = "";
  if (cyberRoundScores) cyberRoundScores.innerHTML = "";
  if (cyberReveal) cyberReveal.innerHTML = "";
  if (cyberPlayers) cyberPlayers.innerHTML = "";
  if (cyberCraftArea) cyberCraftArea.classList.add("hidden");
  if (cyberGuessArea) cyberGuessArea.classList.add("hidden");
  if (cyberScoreArea) cyberScoreArea.classList.add("hidden");
  if (cyberGameOverNotice) cyberGameOverNotice.classList.add("hidden");
  updateCyberLetterRotationControl();
  updateCyberThrusterAttempts();
  renderCyberShoelaceCanvas();
  renderCyberPixelGrid();
  renderCyberIconCanvas();
  renderCyberLetterCanvas();
  renderCyberShapeCanvas();
  renderCyberThrusterCanvas();
  initCyberSynthGrid();
  renderCyberSynthGrid();
}

function renderCyberPicturesGameState(data) {
  const view = data.view;
  currentCyberView = view;
  if (currentGameType !== "cyber_pictures") {
    currentGameType = "cyber_pictures";
    setGamePanelVisibility("cyber_pictures");
  }
  if (cyberPhaseLabel) {
    cyberPhaseLabel.textContent = view.phase || "-";
  }
  if (cyberRoundLabel) {
    cyberRoundLabel.textContent = view.round ?? "-";
  }
  if (cyberTotalRoundsLabel) {
    cyberTotalRoundsLabel.textContent = view.total_rounds ?? "-";
  }
  const toolKey = Number.isFinite(view.your_tool) ? CYBER_TOOL_KEYS[view.your_tool] : null;
  if (cyberToolLabel) {
    cyberToolLabel.textContent = toolKey ? CYBER_TOOL_LABELS[toolKey] : "-";
  }
  if (cyberTargetLabel) {
    cyberTargetLabel.textContent = view.your_target || "-";
  }
  if (cyberSubmittedLabel) {
    cyberSubmittedLabel.textContent = view.submitted ? "yes" : "no";
  }
  if (cyberGuessedLabel) {
    cyberGuessedLabel.textContent = view.guessed ? "yes" : "no";
  }

  renderCyberMatrix(view.matrix || [], view.your_target);
  renderCyberPlayers(view);

  if (view.phase !== "crafting" && cyberThrusterActive) {
    endCyberThrusterRun();
  }

  if (view.phase === "crafting") {
    if (cyberCraftArea) cyberCraftArea.classList.remove("hidden");
    if (cyberGuessArea) cyberGuessArea.classList.add("hidden");
    if (cyberScoreArea) cyberScoreArea.classList.add("hidden");
    if (cyberGameOverNotice) cyberGameOverNotice.classList.add("hidden");
    const activeTool = setCyberActiveTool(view.your_tool);
    if (cyberLastRound !== view.round || cyberLastToolIndex !== view.your_tool || cyberLastPhase !== view.phase) {
      resetCyberToolState(activeTool);
    }
    updateCyberSubmitButton(view);
  } else if (view.phase === "guessing") {
    if (cyberCraftArea) cyberCraftArea.classList.add("hidden");
    if (cyberGuessArea) cyberGuessArea.classList.remove("hidden");
    if (cyberScoreArea) cyberScoreArea.classList.add("hidden");
    if (cyberGameOverNotice) cyberGameOverNotice.classList.add("hidden");
    if (cyberLastPhase !== view.phase || cyberLastRound !== view.round) {
      cyberGuessSelections = {};
    }
    renderCyberGuessArea(view);
  } else if (view.phase === "scoring" || view.phase === "ended") {
    if (cyberCraftArea) cyberCraftArea.classList.add("hidden");
    if (cyberGuessArea) cyberGuessArea.classList.add("hidden");
    if (cyberScoreArea) cyberScoreArea.classList.remove("hidden");
    if (cyberGameOverNotice) {
      cyberGameOverNotice.classList.toggle("hidden", view.phase !== "ended");
    }
    renderCyberScoreArea(view);
    if (cyberNextRoundBtn) {
      cyberNextRoundBtn.disabled = !view.allow_next_round;
    }
  }

  cyberLastRound = view.round;
  cyberLastPhase = view.phase;
  cyberLastToolIndex = view.your_tool;
}

renderCyberPixelPalette();
renderCyberIconPalette();
renderCyberLetterPalette();
renderCyberShapePalette();
initCyberPixelGrid();
renderCyberIconCanvas();
renderCyberLetterCanvas();
renderCyberShapeCanvas();
renderCyberShoelaceCanvas();
initCyberSynthGrid();
renderCyberSynthGrid();
resetCyberThrusterState();

if (cyberShoelaceCanvas) {
  cyberShoelaceCanvas.addEventListener("pointerdown", startCyberShoelaceDraw);
  cyberShoelaceCanvas.addEventListener("pointermove", moveCyberShoelaceDraw);
  cyberShoelaceCanvas.addEventListener("pointerup", endCyberShoelaceDraw);
  cyberShoelaceCanvas.addEventListener("pointerleave", endCyberShoelaceDraw);
}

if (cyberShoelaceClearBtn) {
  cyberShoelaceClearBtn.addEventListener("click", () => clearCyberShoelace());
}

if (cyberShoelaceUndoBtn) {
  cyberShoelaceUndoBtn.addEventListener("click", () => undoCyberShoelace());
}

if (cyberThrusterCanvas) {
  cyberThrusterCanvas.addEventListener("pointerdown", (event) => {
    if (!isCyberThrusterToolActive()) {
      return;
    }
    event.preventDefault();
    if (!cyberThrusterActive) {
      startCyberThrusterLaunch();
    }
    setCyberThrusterThrusting(true);
  });
  cyberThrusterCanvas.addEventListener("pointerup", () => setCyberThrusterThrusting(false));
  cyberThrusterCanvas.addEventListener("pointerleave", () => setCyberThrusterThrusting(false));
  cyberThrusterCanvas.addEventListener("pointercancel", () => setCyberThrusterThrusting(false));
}

if (cyberThrusterUndoBtn) {
  cyberThrusterUndoBtn.addEventListener("click", () => undoCyberThrusterRun());
}

if (cyberIconRemoveBtn) {
  cyberIconRemoveBtn.addEventListener("click", () => removeCyberIcon());
}

if (cyberIconClearBtn) {
  cyberIconClearBtn.addEventListener("click", () => clearCyberIcons());
}

if (cyberLetterRotateBtn) {
  cyberLetterRotateBtn.addEventListener("click", () => rotateSelectedCyberLetter());
}

if (cyberLetterRotate) {
  cyberLetterRotate.addEventListener("input", (event) => {
    const value = Number.parseInt(event.target.value, 10);
    setCyberLetterRotation(Number.isFinite(value) ? value : 0);
  });
}

if (cyberLetterRemoveBtn) {
  cyberLetterRemoveBtn.addEventListener("click", () => removeSelectedCyberLetter());
}

if (cyberLetterClearBtn) {
  cyberLetterClearBtn.addEventListener("click", () => clearCyberLetters());
}

if (cyberShapeRotate) {
  cyberShapeRotate.addEventListener("input", (event) => {
    const value = Number.parseInt(event.target.value, 10);
    setCyberShapeRotation(Number.isFinite(value) ? value : 0);
  });
}

if (cyberShapeRemoveBtn) {
  cyberShapeRemoveBtn.addEventListener("click", () => removeSelectedCyberShape());
}

if (cyberShapeClearBtn) {
  cyberShapeClearBtn.addEventListener("click", () => clearCyberShapes());
}

window.addEventListener("keydown", onCyberThrusterKeyDown);
window.addEventListener("keyup", onCyberThrusterKeyUp);

if (cyberSubmitBtn) {
  cyberSubmitBtn.addEventListener("click", () => {
    if (!currentCyberView || !Number.isFinite(currentCyberView.your_tool)) {
      return;
    }
    const toolKey = CYBER_TOOL_KEYS[currentCyberView.your_tool];
    if (!canSubmitCyber(toolKey)) {
      return;
    }
    const submission = buildCyberSubmission(currentCyberView.your_tool);
    sendAction({ type: "submit_crafting", submission });
  });
}

if (cyberSubmitGuessBtn) {
  cyberSubmitGuessBtn.addEventListener("click", () => {
    if (!currentCyberView) {
      return;
    }
    const works = Array.isArray(currentCyberView.works) ? currentCyberView.works : [];
    const ready = works.every((work) => work.is_self || Boolean(cyberGuessSelections[work.work_id]));
    if (!ready) {
      return;
    }
    sendAction({ type: "submit_guesses", guesses: cyberGuessSelections });
  });
}

if (cyberNextRoundBtn) {
  cyberNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}
