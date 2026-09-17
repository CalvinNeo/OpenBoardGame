(() => {
  "use strict";

  const KRONOLOGIC_CASES = [
    { id: "sealed-score-01", title: "The Missing Cue", titleZh: "遗失的提示谱", difficulty: 1 },
    { id: "sealed-score-02", title: "The Brass Key", titleZh: "黄铜钥匙", difficulty: 1 },
    { id: "sealed-score-03", title: "Echoes Backstage", titleZh: "后台回声", difficulty: 2 },
    { id: "sealed-score-04", title: "The Silent Mechanism", titleZh: "无声机关", difficulty: 2 },
    { id: "sealed-score-05", title: "The Last Encore", titleZh: "最后的返场", difficulty: 3 },
  ];
  const KRONOLOGIC_MARK_ORDER = ["unknown", "possible", "excluded", "confirmed"];
  const KRONOLOGIC_MARK_SYMBOLS = {
    unknown: "·",
    possible: "○",
    excluded: "✕",
    confirmed: "★",
  };
  const KRONOLOGIC_PHASE_LABELS = {
    investigation: "Investigation",
    clue_review: "Clue Review",
    accusation_collect: "Answer Window",
    accusation_review: "Theory Review",
    case_result: "Case Result",
  };
  const KRONOLOGIC_PHASE_LABELS_ZH = {
    investigation: "调查阶段",
    clue_review: "整理线索",
    accusation_collect: "答题窗口",
    accusation_review: "推理复盘",
    case_result: "案件结果",
  };
  const KRONOLOGIC_MARK_LABELS = {
    en: { unknown: "unknown", possible: "possible", excluded: "excluded", confirmed: "confirmed" },
    zh: { unknown: "未知", possible: "可能", excluded: "排除", confirmed: "确认" },
  };
  const KRONOLOGIC_MAP_POSITIONS = {
    grand_hall: [50, 14],
    archive: [19, 37],
    rehearsal: [81, 37],
    backstage: [50, 58],
    dressing_room: [19, 82],
    orchestra_pit: [81, 82],
  };
  const KRONOLOGIC_EXPLANATIONS = {
    location: {
      title: "Venue Room",
      text: "Choose one room for your question. The connecting lines also show the only legal movement routes between consecutive times.",
    },
    "query-mode": {
      title: "Question Type",
      text: "Time reveals how many people were in the room. Person reveals how many times that person visited the room.",
    },
    selector: {
      title: "Question Selector",
      text: "Pair the selected room with exactly one time or one person. Person + Time cannot be asked directly.",
    },
    ask: {
      title: "Ask",
      text: "Spend your turn to receive one shared count and one private detail. A 0 or 6 gives no extra private detail and grants a bonus turn after review.",
    },
    accusation: {
      title: "Make or Join an Accusation",
      text: "Lock in a person, place, and time. Other active investigators may submit at the same moment or decline. Results stay hidden until everyone responds.",
    },
    "accusation-submit": {
      title: "Submit Theory",
      text: "Your theory is final for this answer window. A correct theory wins; an incorrect theory eliminates you without revealing the solution.",
    },
    "accusation-decline": {
      title: "Decline",
      text: "Keep investigating instead of checking a theory now. The investigator who opened the answer window cannot decline.",
    },
    ready: {
      title: "Ready for Next Turn",
      text: "Confirm only after you have recorded the clue. The game continues when every active human investigator is ready.",
    },
    notebook: {
      title: "Private Notebook",
      text: "Tap a person token to cycle unknown, possible, excluded, and confirmed. These notes are visible only to you and survive reconnection.",
    },
    "count-notes": {
      title: "Count Notes",
      text: "Record room totals for a time or the number of visits by a person. This is private scratch work and never changes the case truth.",
    },
    "clue-history": {
      title: "Clue History",
      text: "Shared counts are visible to everyone. Only your own private concrete person or time appears in the private history.",
    },
    "play-again": {
      title: "Play Again",
      text: "Mark yourself ready for another case. The next case starts after every human player confirms; bots confirm automatically.",
    },
  };
  const KRONOLOGIC_EXPLANATIONS_ZH = {
    location: {
      title: "场所房间",
      text: "为本次询问选择一个房间。连接线也表示人物在相邻时段之间唯一允许经过的路线。",
    },
    "query-mode": {
      title: "询问类型",
      text: "选择时段可得知该房间当时有几人；选择人物可得知该人物一共到访该房间几次。",
    },
    selector: {
      title: "询问条件",
      text: "把所选房间与一个时段或一个人物组合。不能直接询问“人物 + 时段”。",
    },
    ask: {
      title: "询问",
      text: "花费本回合获得一条公开数量线索和一条私密细节。数量为 0 或 6 时没有额外私密信息，整理完线索后可额外行动一次。",
    },
    accusation: {
      title: "发起或加入指认",
      text: "锁定人物、地点和时段。其他仍在场的调查员可以同时提交答案或暂不作答；所有人响应前不会公布结果。",
    },
    "accusation-submit": {
      title: "提交推理",
      text: "本次答题窗口中提交的推理不能修改。答对即获胜；答错会被淘汰，但不会公开正确答案。",
    },
    "accusation-decline": {
      title: "暂不作答",
      text: "暂时不验证推理，继续参与调查。发起答题窗口的调查员不能选择暂不作答。",
    },
    ready: {
      title: "准备下一回合",
      text: "记录好线索后再确认。所有仍在场的真人调查员都准备好后，游戏才会继续。",
    },
    notebook: {
      title: "私密笔记本",
      text: "点击人物标记可循环切换未知、可能、排除和确认。笔记只有你能看到，断线重连后仍会保留。",
    },
    "count-notes": {
      title: "数量笔记",
      text: "记录某时段的房间人数，或某人物到访房间的次数。这些是私密草稿，不会改变案件真相。",
    },
    "clue-history": {
      title: "线索记录",
      text: "公开数量线索对所有人可见；只有你自己获得的具体人物或时段会出现在私密记录中。",
    },
    "play-again": {
      title: "再玩一局",
      text: "确认准备调查下一个案件。所有真人玩家确认后才会开始；机器人会自动确认。",
    },
  };

  const KRONOLOGIC_STATIC_COPY = {
    en: {
      config_title: "Kronologic · Original Case Pack",
      language_label: "Game Language",
      source_label: "Case Source",
      source_random: "Recommended Random",
      source_preset: "Choose Case",
      difficulty_label: "Difficulty",
      difficulty_any: "Any",
      case_label: "Case",
      seed_label: "Seed",
      seed_placeholder: "Leave blank for random",
      config_hint: "Original compatible cases; commercial scenarios are not included.",
      help: "Help",
      explain: "Explain",
      help_title: "Kronologic: Paris 1920 — Game Rules",
      explain_title: "Control Explanation",
      close: "Close",
      person: "Person",
      place: "Place",
      time: "Time",
      decline: "Decline",
      map_title: "Venue Map",
      map_hint: "Move through connected rooms every time.",
      query_title: "Ask a Question",
      query_hint: "Choose a place, then a time or person.",
      query_type_aria: "Question type",
      time_mode: "🕒 Time",
      person_mode: "🎭 Person",
      ask: "Ask",
      accuse: "Make Accusation",
      review_title: "Review Pause",
      review_hint: "Everyone gets time to update their notes.",
      solution_title: "Case Reconstruction",
      latest_title: "Latest Clue",
      players_title: "Investigators",
      notebook_title: "Your Notebook",
      notebook_hint: "Tap a person to cycle · ○ ✕ ★.",
      count_notes_title: "Count Notes",
      room_totals: "Room totals",
      person_visits: "Person visits",
      public_clues_title: "📣 Public Clues",
      private_clues_title: "🔒 My Private Clues",
      public_log_title: "Public Log",
      play_again: "Play Again",
    },
    zh: {
      config_title: "时空神探 · 原创案件包",
      language_label: "游戏语言",
      source_label: "案件来源",
      source_random: "推荐随机",
      source_preset: "选择案件",
      difficulty_label: "难度",
      difficulty_any: "任意",
      case_label: "案件",
      seed_label: "种子",
      seed_placeholder: "留空则随机",
      config_hint: "原创兼容案件；不包含商业版案件。",
      help: "帮助",
      explain: "说明",
      help_title: "时空神探：巴黎 1920 — 游戏规则",
      explain_title: "操作说明",
      close: "关闭",
      person: "人物",
      place: "地点",
      time: "时段",
      decline: "暂不作答",
      map_title: "场所地图",
      map_hint: "每个时段都必须移动到相连的房间。",
      query_title: "提出询问",
      query_hint: "先选地点，再选时段或人物。",
      query_type_aria: "询问类型",
      time_mode: "🕒 时段",
      person_mode: "🎭 人物",
      ask: "询问",
      accuse: "发起指认",
      review_title: "线索整理",
      review_hint: "所有人都有时间更新笔记。",
      solution_title: "案件还原",
      latest_title: "最新线索",
      players_title: "调查员",
      notebook_title: "你的笔记本",
      notebook_hint: "点击人物可循环切换 · ○ ✕ ★。",
      count_notes_title: "数量笔记",
      room_totals: "房间人数",
      person_visits: "人物到访",
      public_clues_title: "📣 公开线索",
      private_clues_title: "🔒 我的私密线索",
      public_log_title: "公开日志",
      play_again: "再玩一局",
    },
  };

  let kronologicView = null;
  let kronologicSelectedLocation = null;
  let kronologicQueryMode = "time";
  let kronologicSelectedSelector = null;
  let kronologicNotebookTime = 1;
  let kronologicCountMode = "time";
  let kronologicCountCharacter = "archivist";
  let kronologicExplainMode = false;
  let kronologicLastFocusedElement = null;
  let kronologicSuppressClickUntil = 0;
  let kronologicSeenAccusationKey = null;

  const kronologicPanel = document.getElementById("kronologicPanel");
  const kronologicConfigBox = document.getElementById("kronologicConfigBox");
  const kronologicLanguageSelect = document.getElementById("kronologicLanguageSelect");
  const kronologicSourceSelect = document.getElementById("kronologicSourceSelect");
  const kronologicDifficultySelect = document.getElementById("kronologicDifficultySelect");
  const kronologicDifficultyRow = document.getElementById("kronologicDifficultyRow");
  const kronologicCaseSelect = document.getElementById("kronologicCaseSelect");
  const kronologicCaseRow = document.getElementById("kronologicCaseRow");
  const kronologicSeedInput = document.getElementById("kronologicSeedInput");
  const kronologicSeedRow = document.getElementById("kronologicSeedRow");

  const kronologicHeaderActions = document.getElementById("kronologicHeaderActions");
  const kronologicHelpBtn = document.getElementById("kronologicHelpBtn");
  const kronologicExplainBtn = document.getElementById("kronologicExplainBtn");
  const kronologicHelpModal = document.getElementById("kronologicHelpModal");
  const kronologicHelpCloseBtn = document.getElementById("kronologicHelpCloseBtn");
  const kronologicHelpContent = document.getElementById("kronologicHelpContent");
  const kronologicExplainModal = document.getElementById("kronologicExplainModal");
  const kronologicExplainCloseBtn = document.getElementById("kronologicExplainCloseBtn");
  const kronologicExplainContent = document.getElementById("kronologicExplainContent");
  const kronologicAccusationModal = document.getElementById("kronologicAccusationModal");
  const kronologicAccusationTitle = document.getElementById("kronologicAccusationTitle");
  const kronologicAccusationCloseBtn = document.getElementById("kronologicAccusationCloseBtn");
  const kronologicAccusationPrompt = document.getElementById("kronologicAccusationPrompt");
  const kronologicAnswerCharacter = document.getElementById("kronologicAnswerCharacter");
  const kronologicAnswerLocation = document.getElementById("kronologicAnswerLocation");
  const kronologicAnswerTime = document.getElementById("kronologicAnswerTime");
  const kronologicAccusationWaiting = document.getElementById("kronologicAccusationWaiting");
  const kronologicAccusationSubmitBtn = document.getElementById("kronologicAccusationSubmitBtn");
  const kronologicAccusationDeclineBtn = document.getElementById("kronologicAccusationDeclineBtn");

  const kronologicContentNotice = document.getElementById("kronologicContentNotice");
  const kronologicCaseTitle = document.getElementById("kronologicCaseTitle");
  const kronologicCaseStory = document.getElementById("kronologicCaseStory");
  const kronologicDifficulty = document.getElementById("kronologicDifficulty");
  const kronologicPhase = document.getElementById("kronologicPhase");
  const kronologicTurn = document.getElementById("kronologicTurn");
  const kronologicStatus = document.getElementById("kronologicStatus");
  const kronologicMap = document.getElementById("kronologicMap");
  const kronologicQueryCard = document.getElementById("kronologicQueryCard");
  const kronologicTimeModeBtn = document.getElementById("kronologicTimeModeBtn");
  const kronologicCharacterModeBtn = document.getElementById("kronologicCharacterModeBtn");
  const kronologicSelector = document.getElementById("kronologicSelector");
  const kronologicQuerySummary = document.getElementById("kronologicQuerySummary");
  const kronologicAskBtn = document.getElementById("kronologicAskBtn");
  const kronologicAccuseBtn = document.getElementById("kronologicAccuseBtn");
  const kronologicReviewCard = document.getElementById("kronologicReviewCard");
  const kronologicReviewMessage = document.getElementById("kronologicReviewMessage");
  const kronologicReviewWaiting = document.getElementById("kronologicReviewWaiting");
  const kronologicReadyBtn = document.getElementById("kronologicReadyBtn");
  const kronologicLatestShared = document.getElementById("kronologicLatestShared");
  const kronologicLatestPrivate = document.getElementById("kronologicLatestPrivate");
  const kronologicPlayers = document.getElementById("kronologicPlayers");
  const kronologicNotebookTimes = document.getElementById("kronologicNotebookTimes");
  const kronologicNotebook = document.getElementById("kronologicNotebook");
  const kronologicCountTimeBtn = document.getElementById("kronologicCountTimeBtn");
  const kronologicCountCharacterBtn = document.getElementById("kronologicCountCharacterBtn");
  const kronologicCountCharacterPicker = document.getElementById("kronologicCountCharacterPicker");
  const kronologicCountGrid = document.getElementById("kronologicCountGrid");
  const kronologicPublicClues = document.getElementById("kronologicPublicClues");
  const kronologicPrivateClues = document.getElementById("kronologicPrivateClues");
  const kronologicLog = document.getElementById("kronologicLog");
  const kronologicSolutionSection = document.getElementById("kronologicSolutionSection");
  const kronologicSoloRating = document.getElementById("kronologicSoloRating");
  const kronologicSolution = document.getElementById("kronologicSolution");
  const kronologicPlayAgainBtn = document.getElementById("kronologicPlayAgainBtn");

  const KRONOLOGIC_HELP_HTML = `
    <h3>Goal</h3>
    <p>Six people move through six connected rooms over six times. Find the only person who met the named case subject alone, then identify the room and time.</p>

    <h3>Public Setup &amp; Movement</h3>
    <ul>
      <li>Everyone knows every person's position at <strong>Time 1</strong>.</li>
      <li>Between consecutive times, every person must move through one connecting passage. Nobody stays in the same room.</li>
      <li>Several people may occupy the same room.</li>
    </ul>

    <h3>Ask a Room + Time</h3>
    <p>Everyone learns how many people were in that room at that time. You privately learn one of those people.</p>

    <h3>Ask a Room + Person</h3>
    <p>Everyone learns how many times that person visited the room. You privately learn one exact visit time. You may not ask Person + Time directly.</p>

    <h3>Shared vs Private</h3>
    <p>📣 Shared counts appear in every player's history. 🔒 The concrete person or time appears only in the asking player's private history. If the shared count is 0 or 6, no private fact can add information, so the same player receives a bonus turn after review.</p>

    <h3>Ready for Next Turn</h3>
    <p>After every question, the game pauses so everyone can update notes. Every active human investigator must click <strong>Ready for Next Turn</strong>; bots confirm automatically.</p>

    <h3>Accusations</h3>
    <ul>
      <li>On your turn, submit a person, place, and time.</li>
      <li>Every other active investigator may join with a secret answer or decline.</li>
      <li>Answers are checked together. All correct answers in that window share the win.</li>
      <li>An incorrect answer eliminates its author without revealing the solution. If everyone is eliminated, the case is lost.</li>
    </ul>

    <h3>Solo Rating</h3>
    <p>In solo play, solve with as few questions as possible. Each case sets Gold, Silver, and Bronze thresholds.</p>

    <h3>Notebook Marks</h3>
    <p>Tap a person in a room to cycle: · unknown, ○ possible, ✕ excluded, ★ confirmed. Count Notes record public totals. All notebook data is private and restored after reconnecting.</p>

    <h3>Digital Notes</h3>
    <ul>
      <li>A repeated question returns the same private detail.</li>
      <li>The server keeps the hidden routes and sends each player a separately redacted view.</li>
      <li>The complete routes appear only after the case ends.</li>
    </ul>

    <h3>Content Notice</h3>
    <p><strong>Original Case Pack · Not the commercial scenarios.</strong> The venue, people, stories, routes, and solutions in this implementation are original compatible content. No commercial cards, map, case text, answers, or artwork are included.</p>
  `;

  const KRONOLOGIC_HELP_HTML_ZH = `
    <h3>目标</h3>
    <p>六名人物会在六个相连房间中经过六个时段。找出唯一与案件指定人物单独会面的人，并确定会面的房间和时段。</p>

    <h3>公开设置与移动</h3>
    <ul>
      <li>所有人都知道每名人物在<strong>时段 1</strong>的位置。</li>
      <li>每名人物在相邻时段之间必须沿一条通道移动，不能留在原房间。</li>
      <li>同一个房间可以容纳多名人物。</li>
    </ul>

    <h3>询问“房间 + 时段”</h3>
    <p>所有人都会得知该时段该房间内的人数；你还会私密得知其中一名人物。</p>

    <h3>询问“房间 + 人物”</h3>
    <p>所有人都会得知该人物到访该房间的次数；你还会私密得知其中一个准确时段。不能直接询问“人物 + 时段”。</p>

    <h3>公开与私密线索</h3>
    <p>📣 公开数量会显示在所有人的记录中。🔒 具体人物或时段只会显示在提问者的私密记录中。若公开数量为 0 或 6，私密信息无法提供额外内容，整理完线索后由同一玩家额外行动一次。</p>

    <h3>准备下一回合</h3>
    <p>每次询问后，游戏会暂停供所有人更新笔记。所有仍在场的真人调查员都点击<strong>准备下一回合</strong>后才会继续；机器人会自动确认。</p>

    <h3>指认</h3>
    <ul>
      <li>在你的回合中提交人物、地点和时段。</li>
      <li>其他仍在场的调查员可以同时秘密提交答案，也可以暂不作答。</li>
      <li>所有答案会同时检查；同一窗口中所有答对者共同获胜。</li>
      <li>答错者会被淘汰，但不会看到正确答案。若所有人都被淘汰，则案件失败。</li>
    </ul>

    <h3>单人评级</h3>
    <p>单人游戏中，请尽量用更少的询问破解案件。每个案件都设有金牌、银牌和铜牌阈值。</p>

    <h3>笔记标记</h3>
    <p>点击房间内的人物可循环切换：· 未知、○ 可能、✕ 排除、★ 确认。数量笔记用于记录公开数量。所有笔记均为私密内容，并会在断线重连后恢复。</p>

    <h3>数字版说明</h3>
    <ul>
      <li>重复同一个询问会得到相同的私密细节。</li>
      <li>服务器保存隐藏路线，并为每名玩家分别发送经过遮蔽的视图。</li>
      <li>只有案件结束后才会显示完整路线。</li>
    </ul>

    <h3>内容声明</h3>
    <p><strong>原创案件包 · 不含商业版案件。</strong>本实现中的场所、人物、故事、路线和答案均为原创兼容内容，不包含商业版卡牌、地图、案件文字、答案或美术素材。</p>
  `;

  function kronologicLanguage() {
    if (kronologicView && (kronologicView.language === "zh" || kronologicView.language === "en")) {
      return kronologicView.language;
    }
    return kronologicLanguageSelect && kronologicLanguageSelect.value === "en" ? "en" : "zh";
  }

  function kronologicIsChinese() {
    return kronologicLanguage() === "zh";
  }

  function kronologicCopy(key) {
    const language = kronologicLanguage();
    return KRONOLOGIC_STATIC_COPY[language][key] || KRONOLOGIC_STATIC_COPY.en[key] || key;
  }

  function kronologicTimeLabel(time) {
    return kronologicIsChinese() ? `时段 ${time}` : `Time ${time}`;
  }

  function kronologicApplyStaticCopy() {
    document.querySelectorAll("[data-kronologic-copy]").forEach((element) => {
      const key = element.dataset.kronologicCopy;
      if (key) element.textContent = kronologicCopy(key);
    });
    document.querySelectorAll("[data-kronologic-placeholder]").forEach((element) => {
      const key = element.dataset.kronologicPlaceholder;
      if (key) element.setAttribute("placeholder", kronologicCopy(key));
    });
    document.querySelectorAll("[data-kronologic-aria-label]").forEach((element) => {
      const key = element.dataset.kronologicAriaLabel;
      if (key) element.setAttribute("aria-label", kronologicCopy(key));
    });
    if (kronologicCaseSelect) {
      const selectedCase = kronologicCaseSelect.value || KRONOLOGIC_CASES[0].id;
      kronologicCaseSelect.innerHTML = KRONOLOGIC_CASES.map((item) => {
        const title = kronologicIsChinese() ? item.titleZh : item.title;
        return `<option value="${item.id}">${"★".repeat(item.difficulty)} ${kronologicEscape(title)}</option>`;
      }).join("");
      kronologicCaseSelect.value = KRONOLOGIC_CASES.some((item) => item.id === selectedCase)
        ? selectedCase
        : KRONOLOGIC_CASES[0].id;
    }
    if (!kronologicView) {
      if (kronologicContentNotice) kronologicContentNotice.textContent = kronologicIsChinese() ? "原创案件包" : "Original Case Pack";
      if (kronologicCaseTitle) kronologicCaseTitle.textContent = kronologicIsChinese() ? "时空神探" : "Kronologic";
      if (kronologicTurn) kronologicTurn.textContent = kronologicIsChinese() ? "回合 —" : "Turn —";
      if (kronologicStatus) kronologicStatus.textContent = kronologicIsChinese() ? "等待案件数据…" : "Waiting for case data…";
      if (kronologicQuerySummary) kronologicQuerySummary.textContent = kronologicIsChinese()
        ? "请选择一个房间和一个时段。"
        : "Select a room and a time.";
      if (kronologicLatestShared) kronologicLatestShared.textContent = kronologicIsChinese() ? "尚未询问。" : "No question yet.";
      if (kronologicLatestPrivate) {
        kronologicLatestPrivate.textContent = kronologicIsChinese()
          ? "你的私密线索会显示在这里。"
          : "Your private clue will appear here.";
        kronologicLatestPrivate.classList.remove("is-withheld");
      }
    }
  }

  function kronologicEscape(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function kronologicCan(action) {
    return !!(
      kronologicView &&
      Array.isArray(kronologicView.legal_actions) &&
      kronologicView.legal_actions.includes(action)
    );
  }

  function kronologicCharacter(characterId) {
    return (kronologicView && Array.isArray(kronologicView.characters)
      ? kronologicView.characters.find((item) => item.id === characterId)
      : null) || { id: characterId, name: characterId || (kronologicIsChinese() ? "未知" : "Unknown"), emoji: "❔", code: "?" };
  }

  function kronologicLocation(locationId) {
    return (kronologicView && Array.isArray(kronologicView.locations)
      ? kronologicView.locations.find((item) => item.id === locationId)
      : null) || { id: locationId, name: locationId || (kronologicIsChinese() ? "未知" : "Unknown"), emoji: "📍" };
  }

  function kronologicPlayer(playerId) {
    return (kronologicView && Array.isArray(kronologicView.players)
      ? kronologicView.players.find((item) => item.player_id === playerId)
      : null) || { player_id: playerId, name: playerId || (kronologicIsChinese() ? "未知" : "Unknown") };
  }

  function kronologicCharacterLabel(characterId) {
    const item = kronologicCharacter(characterId);
    return `${item.emoji || "❔"} ${item.name || characterId}`;
  }

  function kronologicLocationLabel(locationId) {
    const item = kronologicLocation(locationId);
    return `${item.emoji || "📍"} ${item.name || locationId}`;
  }

  function kronologicOpenModal(modal, preferredFocus) {
    if (!modal) return;
    kronologicLastFocusedElement = document.activeElement;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    const focusTarget = preferredFocus || modal.querySelector("button, select, input, [tabindex]");
    if (focusTarget) window.setTimeout(() => focusTarget.focus(), 0);
  }

  function kronologicCloseModal(modal) {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    const previous = kronologicLastFocusedElement;
    kronologicLastFocusedElement = null;
    if (previous && typeof previous.focus === "function" && document.contains(previous)) {
      window.setTimeout(() => previous.focus(), 0);
    }
  }

  function kronologicIsModalOpen(modal) {
    return !!modal && !modal.classList.contains("hidden");
  }

  function getKronologicRoomConfig() {
    return {
      language: kronologicLanguageSelect && kronologicLanguageSelect.value === "en" ? "en" : "zh",
      case_source: kronologicSourceSelect ? kronologicSourceSelect.value || "random" : "random",
      difficulty: kronologicDifficultySelect ? kronologicDifficultySelect.value || "any" : "any",
      case_id: kronologicCaseSelect ? kronologicCaseSelect.value || KRONOLOGIC_CASES[0].id : KRONOLOGIC_CASES[0].id,
      seed: kronologicSeedInput ? (kronologicSeedInput.value || "").trim() : "",
    };
  }

  function updateKronologicConfigRowsFromSource() {
    const source = kronologicSourceSelect ? kronologicSourceSelect.value || "random" : "random";
    const preset = source === "preset";
    if (kronologicDifficultyRow) {
      kronologicDifficultyRow.classList.toggle("hidden", preset);
      kronologicDifficultyRow.setAttribute("aria-hidden", String(preset));
    }
    if (kronologicCaseRow) {
      kronologicCaseRow.classList.toggle("hidden", !preset);
      kronologicCaseRow.setAttribute("aria-hidden", String(!preset));
    }
    if (kronologicSeedRow) {
      kronologicSeedRow.classList.toggle("hidden", preset);
      kronologicSeedRow.setAttribute("aria-hidden", String(preset));
    }
  }

  function updateKronologicConfigRow() {
    const show = !!(
      typeof currentRoomState !== "undefined" &&
      currentRoomState &&
      currentGameType === "kronologic" &&
      currentRoomState.status === "lobby"
    );
    if (kronologicConfigBox) {
      kronologicConfigBox.classList.toggle("hidden", !show);
      kronologicConfigBox.setAttribute("aria-hidden", String(!show));
    }
    if (show) updateKronologicConfigRowsFromSource();
  }

  function resetKronologicRoomConfig() {
    if (kronologicLanguageSelect) kronologicLanguageSelect.value = "zh";
    if (kronologicSourceSelect) kronologicSourceSelect.value = "random";
    if (kronologicDifficultySelect) kronologicDifficultySelect.value = "any";
    if (kronologicCaseSelect) kronologicCaseSelect.value = KRONOLOGIC_CASES[0].id;
    if (kronologicSeedInput) kronologicSeedInput.value = "";
    kronologicApplyStaticCopy();
    updateKronologicConfigRowsFromSource();
  }

  function clearKronologicSelection() {
    kronologicSelectedLocation = null;
    kronologicSelectedSelector = null;
    kronologicRenderMap();
    kronologicRenderSelector();
    kronologicRenderQuerySummary();
  }

  function clearKronologicState() {
    kronologicView = null;
    kronologicSelectedLocation = null;
    kronologicSelectedSelector = null;
    kronologicNotebookTime = 1;
    kronologicCountMode = "time";
    kronologicCountCharacter = "archivist";
    kronologicSeenAccusationKey = null;
    kronologicExitExplainMode();
    kronologicApplyStaticCopy();
    if (kronologicCaseTitle) kronologicCaseTitle.textContent = kronologicIsChinese() ? "时空神探" : "Kronologic";
    if (kronologicCaseStory) kronologicCaseStory.textContent = "";
    if (kronologicStatus) kronologicStatus.textContent = kronologicIsChinese() ? "等待案件数据…" : "Waiting for case data…";
    if (kronologicMap) kronologicMap.innerHTML = "";
    if (kronologicSelector) kronologicSelector.innerHTML = "";
    if (kronologicNotebook) kronologicNotebook.innerHTML = "";
    if (kronologicPlayers) kronologicPlayers.innerHTML = "";
    if (kronologicPublicClues) kronologicPublicClues.innerHTML = "";
    if (kronologicPrivateClues) kronologicPrivateClues.innerHTML = "";
    if (kronologicLog) kronologicLog.innerHTML = "";
    kronologicCloseModal(kronologicAccusationModal);
  }

  function showKronologicHeaderActions(show) {
    if (!kronologicHeaderActions) return;
    kronologicHeaderActions.style.display = show ? "flex" : "none";
    if (!show) kronologicExitExplainMode();
  }

  function kronologicRenderMap() {
    if (!kronologicMap || !kronologicView) return;
    const lines = (kronologicView.edges || []).map((edge) => {
      const left = KRONOLOGIC_MAP_POSITIONS[edge[0]];
      const right = KRONOLOGIC_MAP_POSITIONS[edge[1]];
      if (!left || !right) return "";
      return `<line x1="${left[0]}" y1="${left[1]}" x2="${right[0]}" y2="${right[1]}" />`;
    }).join("");
    const startByLocation = {};
    Object.entries((kronologicView.case && kronologicView.case.starting_positions) || {}).forEach(([characterId, locationId]) => {
      if (!startByLocation[locationId]) startByLocation[locationId] = [];
      startByLocation[locationId].push(characterId);
    });
    const nodes = (kronologicView.locations || []).map((location) => {
      const position = KRONOLOGIC_MAP_POSITIONS[location.id] || [50, 50];
      const selected = kronologicSelectedLocation === location.id;
      const starters = (startByLocation[location.id] || []).map((characterId) => {
        const character = kronologicCharacter(characterId);
        const title = kronologicIsChinese() ? `${character.name}从这里出发` : `${character.name} starts here`;
        return `<span title="${kronologicEscape(title)}">${kronologicEscape(character.emoji)}<small>${kronologicEscape(character.code)}</small></span>`;
      }).join("");
      return `
        <button
          class="kronologic-map-node${selected ? " is-selected" : ""}"
          type="button"
          style="left:${position[0]}%;top:${position[1]}%"
          data-location-id="${kronologicEscape(location.id)}"
          data-kronologic-explain="location"
          aria-pressed="${selected}"
          aria-label="${kronologicEscape(location.name)}${selected ? (kronologicIsChinese() ? "，已选择" : ", selected") : ""}"
        >
          <span class="kronologic-map-node-name"><span aria-hidden="true">${kronologicEscape(location.emoji)}</span> ${kronologicEscape(location.name)}</span>
          <span class="kronologic-map-starters">${starters || `<small>${kronologicIsChinese() ? "时段 1：无人" : "Time 1: empty"}</small>`}</span>
        </button>
      `;
    }).join("");
    kronologicMap.innerHTML = `
      <svg class="kronologic-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
      ${nodes}
      <div class="kronologic-map-legend">${kronologicIsChinese() ? "每个房间内显示时段 1 的起始人物" : "Time 1 starters shown inside each room"}</div>
    `;
    kronologicRefreshExplainTargets();
  }

  function kronologicRenderSelector() {
    if (!kronologicSelector || !kronologicView) return;
    kronologicTimeModeBtn.classList.toggle("is-active", kronologicQueryMode === "time");
    kronologicCharacterModeBtn.classList.toggle("is-active", kronologicQueryMode === "character");
    kronologicTimeModeBtn.setAttribute("aria-pressed", String(kronologicQueryMode === "time"));
    kronologicCharacterModeBtn.setAttribute("aria-pressed", String(kronologicQueryMode === "character"));
    if (kronologicQueryMode === "time") {
      kronologicSelector.innerHTML = Array.from({ length: 6 }, (_, index) => {
        const time = index + 1;
        const selected = Number(kronologicSelectedSelector) === time;
        return `<button type="button" class="${selected ? "is-selected" : ""}" data-query-selector="${time}" data-kronologic-explain="selector" aria-pressed="${selected}">🕐 ${kronologicTimeLabel(time)}</button>`;
      }).join("");
    } else {
      kronologicSelector.innerHTML = (kronologicView.characters || []).map((character) => {
        const selected = kronologicSelectedSelector === character.id;
        return `<button type="button" class="kronologic-character-pattern pattern-${kronologicEscape(character.pattern)}${selected ? " is-selected" : ""}" data-query-selector="${kronologicEscape(character.id)}" data-kronologic-explain="selector" aria-pressed="${selected}">${kronologicEscape(character.emoji)} ${kronologicEscape(character.name)}</button>`;
      }).join("");
    }
    kronologicRefreshExplainTargets();
  }

  function kronologicRenderQuerySummary() {
    if (!kronologicQuerySummary || !kronologicView) return;
    const locationText = kronologicSelectedLocation
      ? kronologicLocationLabel(kronologicSelectedLocation)
      : kronologicIsChinese() ? "一个房间" : "a room";
    let selectorText = kronologicQueryMode === "time"
      ? (kronologicIsChinese() ? "一个时段" : "a time")
      : (kronologicIsChinese() ? "一个人物" : "a person");
    if (kronologicSelectedSelector != null) {
      selectorText = kronologicQueryMode === "time"
        ? `🕐 ${kronologicTimeLabel(Number(kronologicSelectedSelector))}`
        : kronologicCharacterLabel(kronologicSelectedSelector);
    }
    kronologicQuerySummary.textContent = `${locationText} + ${selectorText}`;
    const ready = !!kronologicSelectedLocation && kronologicSelectedSelector != null;
    kronologicAskBtn.disabled = !(ready && kronologicCan("ask"));

    if (kronologicCan("start_accusation")) {
      kronologicAccuseBtn.textContent = kronologicIsChinese() ? "发起指认" : "Make Accusation";
      kronologicAccuseBtn.disabled = false;
    } else if (kronologicCan("join_accusation") || kronologicCan("decline_accusation")) {
      kronologicAccuseBtn.textContent = kronologicIsChinese() ? "打开答题窗口" : "Open Answer Window";
      kronologicAccuseBtn.disabled = false;
    } else if (kronologicView.phase === "accusation_collect" && kronologicView.your_accusation_response) {
      kronologicAccuseBtn.textContent = kronologicIsChinese() ? "推理已锁定 ✓" : "Theory Locked ✓";
      kronologicAccuseBtn.disabled = false;
    } else {
      kronologicAccuseBtn.textContent = kronologicIsChinese() ? "发起指认" : "Make Accusation";
      kronologicAccuseBtn.disabled = true;
    }
    kronologicRefreshExplainTargets();
  }

  function kronologicPublicClueText(clue) {
    if (!clue) return kronologicIsChinese() ? "尚未询问。" : "No question yet.";
    const location = kronologicLocationLabel(clue.location_id);
    if (clue.query_type === "time") {
      if (kronologicIsChinese()) return `📣 ${kronologicTimeLabel(clue.time)}，${location}内有 ${clue.count} 人。`;
      return `📣 ${clue.count} ${clue.count === 1 ? "person was" : "people were"} in ${location} at 🕐 Time ${clue.time}.`;
    }
    if (kronologicIsChinese()) return `📣 ${kronologicCharacterLabel(clue.character_id)}在${location}出现过 ${clue.count} 次。`;
    return `📣 ${kronologicCharacterLabel(clue.character_id)} visited ${location} ${clue.count} ${clue.count === 1 ? "time" : "times"}.`;
  }

  function kronologicPrivateClueText(clue) {
    if (!clue) return kronologicIsChinese() ? "本次询问没有私密细节。" : "No private detail for this question.";
    if (clue.private_character_id) {
      if (kronologicIsChinese()) return `🔒 ${kronologicCharacterLabel(clue.private_character_id)}是其中一人。`;
      return `🔒 ${kronologicCharacterLabel(clue.private_character_id)} was one of them.`;
    }
    if (Number.isInteger(clue.private_time)) {
      if (kronologicIsChinese()) return `🔒 其中一次到访发生在${kronologicTimeLabel(clue.private_time)}。`;
      return `🔒 One visit happened at 🕐 Time ${clue.private_time}.`;
    }
    return kronologicIsChinese()
      ? "↻ 没有额外私密信息——本次询问会获得额外行动。"
      : "↻ No extra private fact — this question grants a bonus turn.";
  }

  function kronologicRenderLatestClue() {
    if (!kronologicView) return;
    const clues = kronologicView.public_clues || [];
    const latest = clues.length ? clues[clues.length - 1] : null;
    if (!latest) {
      kronologicLatestShared.textContent = kronologicIsChinese() ? "尚未询问。" : "No question yet.";
      kronologicLatestPrivate.textContent = kronologicIsChinese() ? "你的私密线索会显示在这里。" : "Your private clue will appear here.";
      return;
    }
    kronologicLatestShared.textContent = kronologicPublicClueText(latest);
    const privateClue = (kronologicView.your_private_clues || []).find((item) => item.clue_id === latest.clue_id);
    if (privateClue) {
      kronologicLatestPrivate.textContent = kronologicPrivateClueText(privateClue);
      kronologicLatestPrivate.classList.remove("is-withheld");
    } else {
      const asker = kronologicPlayer(latest.asked_by);
      const askerName = asker.name || (kronologicIsChinese() ? "另一名调查员" : "Another investigator");
      kronologicLatestPrivate.textContent = kronologicIsChinese()
        ? `🔒 ${askerName}获得了私密细节。`
        : `🔒 ${askerName} received the private detail.`;
      kronologicLatestPrivate.classList.add("is-withheld");
    }
  }

  function kronologicRenderPlayers() {
    if (!kronologicPlayers || !kronologicView) return;
    const statusLabels = kronologicIsChinese()
      ? { active: "调查中", eliminated: "已淘汰", winner: "获胜" }
      : { active: "active", eliminated: "eliminated", winner: "winner" };
    kronologicPlayers.innerHTML = (kronologicView.players || []).map((player) => {
      const active = player.player_id === kronologicView.active_player_id;
      const you = player.player_id === kronologicView.you;
      const statusIcon = player.status === "winner" ? "🏆" : player.status === "eliminated" ? "🚫" : active ? "🔎" : "📝";
      const readyText = (kronologicView.phase === "clue_review" || kronologicView.phase === "accusation_review")
        ? (player.review_ready
            ? (kronologicIsChinese() ? "已准备 ✓" : "Ready ✓")
            : player.status === "active"
              ? (kronologicIsChinese() ? "整理笔记中…" : "Taking notes…")
              : (kronologicIsChinese() ? "已出局" : "Out"))
        : "";
      const responseText = kronologicView.phase === "accusation_collect" && player.status === "active"
        ? (player.accusation_responded
            ? (kronologicIsChinese() ? "推理已锁定 ✓" : "Theory locked ✓")
            : (kronologicIsChinese() ? "思考中…" : "Deciding…"))
        : "";
      const playerName = player.name || (kronologicIsChinese() ? "玩家" : "Player");
      const youLabel = kronologicIsChinese() ? "你" : "You";
      const botLabel = kronologicIsChinese() ? "机器人" : "Bot";
      const questionText = kronologicIsChinese() ? `${player.question_count} 次询问` : `${player.question_count} questions`;
      return `
        <div class="kronologic-player-card status-${kronologicEscape(player.status)}${active ? " is-active" : ""}${you ? " is-you" : ""}">
          <div><span aria-hidden="true">${statusIcon}</span> <strong>${kronologicEscape(playerName)}</strong>${you ? ` <small>(${youLabel})</small>` : ""}${player.is_bot ? ` <small>${botLabel}</small>` : ""}</div>
          <div class="kronologic-player-meta">${kronologicEscape(statusLabels[player.status] || player.status)} · ${kronologicEscape(questionText)}${readyText ? ` · ${kronologicEscape(readyText)}` : ""}${responseText ? ` · ${kronologicEscape(responseText)}` : ""}</div>
        </div>
      `;
    }).join("");
  }

  function kronologicRenderReview() {
    if (!kronologicReviewCard || !kronologicView) return;
    const reviewing = kronologicView.phase === "clue_review" || kronologicView.phase === "accusation_review";
    kronologicReviewCard.classList.toggle("hidden", !reviewing);
    kronologicReviewCard.setAttribute("aria-hidden", String(!reviewing));
    if (!reviewing) return;

    if (kronologicView.phase === "clue_review") {
      const clues = kronologicView.public_clues || [];
      const latest = clues.length ? clues[clues.length - 1] : null;
      kronologicReviewMessage.textContent = latest && latest.bonus_turn
        ? (kronologicIsChinese()
            ? "↻ 这条线索给所有人相同的信息。全部确认后，提问者继续行动。"
            : "↻ This clue gives the same information to everyone. The asking player keeps the turn after all confirmations.")
        : (kronologicIsChinese()
            ? "确认前请记录公开线索和你获得的私密细节。"
            : "Record the shared clue and any private detail before confirming.");
    } else {
      kronologicReviewMessage.textContent = kronologicIsChinese()
        ? "错误推理的提交者已被淘汰，正确答案仍然保密；幸存者确认后继续调查。"
        : "Incorrect theories were eliminated. The correct solution remains hidden; survivors may continue after confirming.";
    }
    const waiting = (kronologicView.players || []).filter((player) => player.status === "active" && !player.review_ready);
    kronologicReviewWaiting.textContent = waiting.length
      ? `${kronologicIsChinese() ? "等待" : "Waiting for"}: ${waiting.map((player) => player.name).join(", ")}`
      : (kronologicIsChinese() ? "所有人都已准备。" : "Everyone is ready.");
    const alreadyReady = (kronologicView.review_ready || []).includes(kronologicView.you);
    kronologicReadyBtn.textContent = alreadyReady
      ? (kronologicIsChinese() ? "已准备 ✓" : "Ready ✓")
      : (kronologicIsChinese() ? "准备下一回合" : "Ready for Next Turn");
    kronologicReadyBtn.disabled = !kronologicCan("ready_next_turn");
    kronologicRefreshExplainTargets();
  }

  function kronologicRenderNotebookTimes() {
    if (!kronologicNotebookTimes) return;
    kronologicNotebookTimes.innerHTML = Array.from({ length: 6 }, (_, index) => {
      const time = index + 1;
      const selected = time === kronologicNotebookTime;
      return `<button type="button" class="${selected ? "is-selected" : ""}" data-notebook-time="${time}" data-kronologic-explain="notebook" aria-pressed="${selected}">🕐 ${time}</button>`;
    }).join("");
  }

  function kronologicRenderNotebook() {
    if (!kronologicNotebook || !kronologicView) return;
    const marks = (kronologicView.your_notes && kronologicView.your_notes.marks) || {};
    kronologicNotebook.innerHTML = (kronologicView.locations || []).map((location) => {
      const people = (kronologicView.characters || []).map((character) => {
        const key = `${kronologicNotebookTime}|${location.id}|${character.id}`;
        const mark = marks[key] || "unknown";
        const symbol = KRONOLOGIC_MARK_SYMBOLS[mark] || "·";
        return `
          <button
            type="button"
            class="kronologic-note-person mark-${kronologicEscape(mark)} pattern-${kronologicEscape(character.pattern)}"
            data-note-character="${kronologicEscape(character.id)}"
            data-note-location="${kronologicEscape(location.id)}"
            data-note-mark="${kronologicEscape(mark)}"
            data-kronologic-explain="notebook"
            aria-label="${kronologicEscape(kronologicIsChinese()
              ? `${kronologicTimeLabel(kronologicNotebookTime)}，${location.name}内的${character.name}：${KRONOLOGIC_MARK_LABELS.zh[mark] || mark}`
              : `${character.name} in ${location.name} at ${kronologicTimeLabel(kronologicNotebookTime)}: ${KRONOLOGIC_MARK_LABELS.en[mark] || mark}`)}"
            ${kronologicView.can_edit_notes ? "" : "disabled"}
          ><span aria-hidden="true">${kronologicEscape(character.emoji)}</span><small>${kronologicEscape(character.code)}</small><strong>${symbol}</strong></button>
        `;
      }).join("");
      return `
        <div class="kronologic-note-room">
          <div class="kronologic-note-room-title"><span aria-hidden="true">${kronologicEscape(location.emoji)}</span> ${kronologicEscape(location.name)}</div>
          <div class="kronologic-note-people">${people}</div>
        </div>
      `;
    }).join("");
    kronologicRefreshExplainTargets();
  }

  function kronologicCountOptions(value) {
    const selectedValue = value == null ? "" : String(value);
    const options = [`<option value=""${selectedValue === "" ? " selected" : ""}>?</option>`];
    for (let count = 0; count <= 6; count += 1) {
      options.push(`<option value="${count}"${selectedValue === String(count) ? " selected" : ""}>${count}</option>`);
    }
    return options.join("");
  }

  function kronologicRenderCountNotes() {
    if (!kronologicCountGrid || !kronologicView) return;
    kronologicCountTimeBtn.classList.toggle("is-active", kronologicCountMode === "time");
    kronologicCountCharacterBtn.classList.toggle("is-active", kronologicCountMode === "character");
    const showCharacters = kronologicCountMode === "character";
    kronologicCountCharacterPicker.classList.toggle("hidden", !showCharacters);
    kronologicCountCharacterPicker.setAttribute("aria-hidden", String(!showCharacters));
    kronologicCountCharacterPicker.innerHTML = showCharacters
      ? (kronologicView.characters || []).map((character) => {
          const selected = character.id === kronologicCountCharacter;
          return `<button type="button" class="${selected ? "is-selected" : ""}" data-count-character="${kronologicEscape(character.id)}" data-kronologic-explain="count-notes" aria-pressed="${selected}">${kronologicEscape(character.emoji)} ${kronologicEscape(character.code)}</button>`;
        }).join("")
      : "";
    const counts = (kronologicView.your_notes && kronologicView.your_notes.counts) || {};
    kronologicCountGrid.innerHTML = (kronologicView.locations || []).map((location) => {
      const selector = kronologicCountMode === "time" ? kronologicNotebookTime : kronologicCountCharacter;
      const key = `${kronologicCountMode}|${location.id}|${selector}`;
      const label = kronologicCountMode === "time"
        ? (kronologicIsChinese() ? `${kronologicTimeLabel(kronologicNotebookTime)}人数` : `people at Time ${kronologicNotebookTime}`)
        : (kronologicIsChinese()
            ? `${kronologicCharacter(kronologicCountCharacter).name}到访次数`
            : `${kronologicCharacter(kronologicCountCharacter).name} visits`);
      return `
        <label>
          <span>${kronologicEscape(location.emoji)} ${kronologicEscape(location.name)} <small>${kronologicEscape(label)}</small></span>
          <select data-count-location="${kronologicEscape(location.id)}" ${kronologicView.can_edit_notes ? "" : "disabled"}>${kronologicCountOptions(counts[key])}</select>
        </label>
      `;
    }).join("");
    kronologicRefreshExplainTargets();
  }

  function kronologicRenderHistories() {
    if (!kronologicView) return;
    const publicItems = [...(kronologicView.public_clues || [])].reverse();
    kronologicPublicClues.innerHTML = publicItems.length
      ? publicItems.map((clue) => `<div class="kronologic-history-item"><small>${kronologicEscape(kronologicPlayer(clue.asked_by).name)} · ${kronologicIsChinese() ? "回合" : "Turn"} ${clue.turn_number}</small><div>${kronologicEscape(kronologicPublicClueText(clue))}${clue.bonus_turn ? " <strong>↻</strong>" : ""}</div></div>`).join("")
      : `<div class="kronologic-empty">${kronologicIsChinese() ? "暂无公开线索。" : "No shared clues yet."}</div>`;
    const privateItems = [...(kronologicView.your_private_clues || [])].reverse();
    kronologicPrivateClues.innerHTML = privateItems.length
      ? privateItems.map((clue) => `<div class="kronologic-history-item is-private"><small>${kronologicEscape(clue.clue_id)}</small><div>${kronologicEscape(kronologicPrivateClueText(clue))}</div></div>`).join("")
      : `<div class="kronologic-empty">${kronologicIsChinese() ? "暂无私密线索。" : "No private clues yet."}</div>`;
    const logs = [...(kronologicView.public_log || [])].reverse();
    kronologicLog.innerHTML = logs.length
      ? logs.map((entry) => `<div class="kronologic-log-item"><small>#${entry.index}</small> ${kronologicEscape(entry.message)}</div>`).join("")
      : `<div class="kronologic-empty">${kronologicIsChinese() ? "暂无日志。" : "No log entries."}</div>`;
  }

  function kronologicRenderSolution() {
    if (!kronologicSolutionSection || !kronologicView) return;
    const visible = !!kronologicView.solution;
    kronologicSolutionSection.classList.toggle("hidden", !visible);
    kronologicSolutionSection.setAttribute("aria-hidden", String(!visible));
    if (!visible) return;
    const answer = kronologicView.solution.answer;
    const rating = kronologicView.solo_rating;
    const ratingLabels = kronologicIsChinese()
      ? { gold: "金牌", silver: "银牌", bronze: "铜牌" }
      : { gold: "GOLD", silver: "SILVER", bronze: "BRONZE" };
    kronologicSoloRating.textContent = rating
      ? `${rating === "gold" ? "🥇" : rating === "silver" ? "🥈" : "🥉"} ${ratingLabels[rating]}`
      : "";
    const rows = (kronologicView.characters || []).map((character) => {
      const path = kronologicView.solution.paths[character.id] || [];
      return `
        <div class="kronologic-path-row">
          <strong>${kronologicEscape(character.emoji)} ${kronologicEscape(character.name)}</strong>
          <div>${path.map((locationId, index) => `<span><small>${kronologicIsChinese() ? `时${index + 1}` : `T${index + 1}`}</small>${kronologicEscape(kronologicLocation(locationId).emoji)} ${kronologicEscape(kronologicLocation(locationId).name)}</span>`).join("")}</div>
        </div>
      `;
    }).join("");
    kronologicSolution.innerHTML = `
      <div class="kronologic-answer-card">
        <span>${kronologicIsChinese() ? "答案" : "Answer"}</span>
        <strong>${kronologicEscape(kronologicCharacterLabel(answer.character_id))}</strong>
        <strong>${kronologicEscape(kronologicLocationLabel(answer.location_id))}</strong>
        <strong>🕐 ${kronologicTimeLabel(answer.time)}</strong>
      </div>
      <div class="kronologic-paths">${rows}</div>
    `;
    const ready = (kronologicView.rematch_ready || []).includes(kronologicView.you);
    kronologicPlayAgainBtn.textContent = ready
      ? (kronologicIsChinese() ? "已准备下一局 ✓" : "Ready for Rematch ✓")
      : (kronologicIsChinese() ? "再玩一局" : "Play Again");
    kronologicPlayAgainBtn.disabled = !kronologicCan("play_again");
    kronologicRefreshExplainTargets();
  }

  function kronologicRenderStatus() {
    if (!kronologicView) return;
    const active = kronologicPlayer(kronologicView.active_player_id);
    const yourTurn = kronologicView.active_player_id === kronologicView.you;
    let text = "";
    if (kronologicView.phase === "investigation") {
      if (kronologicIsChinese()) {
        text = yourTurn ? "轮到你——提出询问或发起指认。" : `${active.name || "另一名调查员"}正在调查。`;
      } else {
        text = yourTurn ? "Your turn — ask a question or make an accusation." : `${active.name || "Another investigator"} is investigating.`;
      }
    } else if (kronologicView.phase === "clue_review") {
      text = kronologicIsChinese() ? "线索已揭晓——更新笔记后确认准备。" : "Clue revealed — update your notes, then confirm readiness.";
    } else if (kronologicView.phase === "accusation_collect") {
      const waiting = (kronologicView.accusation && kronologicView.accusation.waiting_ids) || [];
      text = waiting.length
        ? (kronologicIsChinese()
            ? `答题窗口已开启——正在等待 ${waiting.map((id) => kronologicPlayer(id).name).join("、")}。`
            : `Answer window open — waiting for ${waiting.map((id) => kronologicPlayer(id).name).join(", ")}.`)
        : (kronologicIsChinese() ? "正在检查已锁定的推理…" : "Checking locked theories…");
    } else if (kronologicView.phase === "accusation_review") {
      text = kronologicIsChinese()
        ? "本轮提交的推理均不正确。幸存者整理笔记后继续。"
        : "No submitted theory was correct. Survivors review before continuing.";
    } else if (kronologicView.phase === "case_result") {
      text = (kronologicView.winner_ids || []).length
        ? (kronologicIsChinese()
            ? `${(kronologicView.winner_ids || []).map((id) => kronologicPlayer(id).name).join("、")}破解了案件。`
            : `Case solved by ${(kronologicView.winner_ids || []).map((id) => kronologicPlayer(id).name).join(", ")}.`)
        : (kronologicIsChinese() ? "案件失败。请在下方查看完整路线。" : "The case was lost. Review the complete routes below.");
    }
    kronologicStatus.textContent = text;
  }

  function kronologicPopulateAnswerControls() {
    if (!kronologicView) return;
    const oldCharacter = kronologicAnswerCharacter.value;
    const oldLocation = kronologicAnswerLocation.value;
    const oldTime = kronologicAnswerTime.value;
    kronologicAnswerCharacter.innerHTML = (kronologicView.characters || [])
      .map((item) => `<option value="${kronologicEscape(item.id)}">${kronologicEscape(item.emoji)} ${kronologicEscape(item.name)}</option>`)
      .join("");
    kronologicAnswerLocation.innerHTML = (kronologicView.locations || [])
      .map((item) => `<option value="${kronologicEscape(item.id)}">${kronologicEscape(item.emoji)} ${kronologicEscape(item.name)}</option>`)
      .join("");
    kronologicAnswerTime.innerHTML = Array.from({ length: 6 }, (_, index) => `<option value="${index + 1}">🕐 ${kronologicTimeLabel(index + 1)}</option>`).join("");
    if ((kronologicView.characters || []).some((item) => item.id === oldCharacter)) kronologicAnswerCharacter.value = oldCharacter;
    if ((kronologicView.locations || []).some((item) => item.id === oldLocation)) kronologicAnswerLocation.value = oldLocation;
    if (/^[1-6]$/.test(oldTime)) kronologicAnswerTime.value = oldTime;
  }

  function kronologicRenderAccusationModal() {
    if (!kronologicView) return;
    kronologicPopulateAnswerControls();
    const canStart = kronologicCan("start_accusation");
    const canJoin = kronologicCan("join_accusation");
    const canDecline = kronologicCan("decline_accusation");
    const locked = !!kronologicView.your_accusation_response;
    if (canStart) {
      kronologicAccusationTitle.textContent = kronologicIsChinese() ? "发起指认" : "Make an Accusation";
      kronologicAccusationPrompt.textContent = kronologicIsChinese()
        ? "提交人物、地点和时段，并为其他调查员打开同时答题窗口。"
        : "Submit your person, place, and time. This opens a simultaneous answer window for everyone else.";
      kronologicAccusationSubmitBtn.textContent = kronologicIsChinese() ? "提交并邀请其他人" : "Submit & Invite Others";
    } else if (canJoin || canDecline) {
      kronologicAccusationTitle.textContent = kronologicIsChinese() ? "加入答题窗口？" : "Join the Answer Window?";
      kronologicAccusationPrompt.textContent = kronologicIsChinese()
        ? "现在秘密提交推理以争取共同获胜；也可以暂不作答，并在本轮无人答对时继续调查。"
        : "Submit a secret theory now to share a possible win, or decline and keep investigating if every submitted theory is wrong.";
      kronologicAccusationSubmitBtn.textContent = kronologicIsChinese() ? "提交答案并加入" : "Join with Answer";
    } else if (locked) {
      kronologicAccusationTitle.textContent = kronologicIsChinese() ? "推理已锁定" : "Theory Locked";
      kronologicAccusationPrompt.textContent = kronologicView.your_accusation_response === "declined"
        ? (kronologicIsChinese() ? "你已选择暂不作答，正在等待其他调查员。" : "You declined this answer window. Waiting for the other investigators.")
        : (kronologicIsChinese() ? "你的推理已锁定。所有答案会在其他调查员响应后一起检查。" : "Your theory is locked. Waiting for the other investigators before any answer is checked.");
    }
    [kronologicAnswerCharacter, kronologicAnswerLocation, kronologicAnswerTime].forEach((control) => {
      control.disabled = !(canStart || canJoin);
    });
    kronologicAccusationSubmitBtn.classList.toggle("hidden", !(canStart || canJoin));
    kronologicAccusationDeclineBtn.classList.toggle("hidden", !canDecline);
    const waiting = (kronologicView.accusation && kronologicView.accusation.waiting_ids) || [];
    kronologicAccusationWaiting.textContent = waiting.length
      ? `${kronologicIsChinese() ? "等待" : "Waiting for"}: ${waiting.map((id) => kronologicPlayer(id).name).join(", ")}`
      : kronologicView.phase === "accusation_collect"
        ? (kronologicIsChinese() ? "所有回应均已锁定。" : "All responses are locked.")
        : "";

    const accusationLogs = (kronologicView.public_log || []).filter((entry) => entry.type === "accusation_started");
    const latestKey = accusationLogs.length ? accusationLogs[accusationLogs.length - 1].index : null;
    if (kronologicView.phase === "accusation_collect" && (canJoin || canDecline) && latestKey !== kronologicSeenAccusationKey) {
      kronologicSeenAccusationKey = latestKey;
      kronologicOpenModal(kronologicAccusationModal, kronologicAnswerCharacter);
    }
    if (kronologicView.phase !== "accusation_collect" && kronologicIsModalOpen(kronologicAccusationModal)) {
      kronologicCloseModal(kronologicAccusationModal);
    }
  }

  function renderKronologicGameState(data) {
    const view = data && data.view ? data.view : null;
    if (!view) {
      clearKronologicState();
      return;
    }
    kronologicView = view;
    kronologicApplyStaticCopy();
    if (!(view.characters || []).some((item) => item.id === kronologicCountCharacter)) {
      kronologicCountCharacter = (view.characters && view.characters[0] && view.characters[0].id) || "archivist";
    }
    kronologicContentNotice.textContent = view.content_notice || (kronologicIsChinese() ? "原创案件包" : "Original Case Pack");
    kronologicCaseTitle.textContent = view.case.title;
    kronologicCaseStory.textContent = view.case.story;
    kronologicDifficulty.textContent = "★".repeat(Number(view.case.difficulty) || 1);
    const phaseLabels = kronologicIsChinese() ? KRONOLOGIC_PHASE_LABELS_ZH : KRONOLOGIC_PHASE_LABELS;
    kronologicPhase.textContent = phaseLabels[view.phase] || view.phase || "—";
    kronologicTurn.textContent = `${kronologicIsChinese() ? "回合" : "Turn"} ${view.turn_number || 1}`;
    kronologicRenderStatus();
    kronologicRenderMap();
    kronologicRenderSelector();
    kronologicRenderQuerySummary();
    kronologicRenderLatestClue();
    kronologicRenderPlayers();
    kronologicRenderReview();
    kronologicRenderNotebookTimes();
    kronologicRenderNotebook();
    kronologicRenderCountNotes();
    kronologicRenderHistories();
    kronologicRenderSolution();
    kronologicRenderAccusationModal();
    kronologicRefreshExplainTargets();
  }

  function kronologicOpenAccusationModal() {
    if (!kronologicView) return;
    kronologicRenderAccusationModal();
    kronologicOpenModal(kronologicAccusationModal, kronologicAnswerCharacter);
  }

  function kronologicSubmitAccusation() {
    if (!kronologicView) return;
    const actionType = kronologicCan("start_accusation")
      ? "start_accusation"
      : kronologicCan("join_accusation")
        ? "join_accusation"
        : null;
    if (!actionType) return;
    sendAction({
      type: actionType,
      character_id: kronologicAnswerCharacter.value,
      location_id: kronologicAnswerLocation.value,
      time: Number.parseInt(kronologicAnswerTime.value, 10),
    });
    kronologicCloseModal(kronologicAccusationModal);
  }

  function kronologicShowHelp() {
    if (kronologicHelpContent) {
      kronologicHelpContent.innerHTML = kronologicIsChinese() ? KRONOLOGIC_HELP_HTML_ZH : KRONOLOGIC_HELP_HTML;
    }
    kronologicOpenModal(kronologicHelpModal, kronologicHelpCloseBtn);
  }

  function kronologicRefreshExplainTargets() {
    const roots = [kronologicPanel, kronologicAccusationModal];
    roots.forEach((root) => {
      if (!root) return;
      root.querySelectorAll("button[data-kronologic-explain]").forEach((button) => {
        const key = button.dataset.kronologicExplain;
        const explanations = kronologicIsChinese() ? KRONOLOGIC_EXPLANATIONS_ZH : KRONOLOGIC_EXPLANATIONS;
        button.classList.toggle("has-explanation", kronologicExplainMode && !!explanations[key]);
      });
    });
  }

  function kronologicEnterExplainMode() {
    kronologicExplainMode = true;
    document.body.classList.add("kronologic-explain-mode");
    if (kronologicExplainBtn) kronologicExplainBtn.setAttribute("aria-pressed", "true");
    kronologicRefreshExplainTargets();
  }

  function kronologicExitExplainMode() {
    kronologicExplainMode = false;
    document.body.classList.remove("kronologic-explain-mode");
    if (kronologicExplainBtn) kronologicExplainBtn.setAttribute("aria-pressed", "false");
    kronologicRefreshExplainTargets();
  }

  function kronologicToggleExplainMode() {
    if (kronologicExplainMode) kronologicExitExplainMode();
    else kronologicEnterExplainMode();
  }

  function kronologicShowExplanation(key) {
    const explanations = kronologicIsChinese() ? KRONOLOGIC_EXPLANATIONS_ZH : KRONOLOGIC_EXPLANATIONS;
    const explanation = explanations[key];
    if (!explanation || !kronologicExplainContent) return;
    kronologicExplainContent.innerHTML = `<h3>${kronologicEscape(explanation.title)}</h3><p>${kronologicEscape(explanation.text)}</p>`;
    kronologicOpenModal(kronologicExplainModal, kronologicExplainCloseBtn);
  }

  function kronologicFindExplainTargetAtPoint(x, y) {
    const roots = [kronologicPanel, kronologicAccusationModal];
    for (const root of roots) {
      if (!root) continue;
      const buttons = Array.from(root.querySelectorAll("button[data-kronologic-explain]"));
      for (const button of buttons) {
        const rect = button.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return button;
        }
      }
    }
    return null;
  }

  if (kronologicSourceSelect) kronologicSourceSelect.addEventListener("change", updateKronologicConfigRowsFromSource);
  if (kronologicLanguageSelect) {
    kronologicLanguageSelect.addEventListener("change", () => {
      kronologicApplyStaticCopy();
      clearKronologicSelection();
    });
  }
  if (kronologicHelpBtn) kronologicHelpBtn.addEventListener("click", kronologicShowHelp);
  if (kronologicExplainBtn) kronologicExplainBtn.addEventListener("click", kronologicToggleExplainMode);
  if (kronologicHelpCloseBtn) kronologicHelpCloseBtn.addEventListener("click", () => kronologicCloseModal(kronologicHelpModal));
  if (kronologicExplainCloseBtn) kronologicExplainCloseBtn.addEventListener("click", () => kronologicCloseModal(kronologicExplainModal));
  if (kronologicAccusationCloseBtn) kronologicAccusationCloseBtn.addEventListener("click", () => kronologicCloseModal(kronologicAccusationModal));
  if (kronologicAccusationSubmitBtn) kronologicAccusationSubmitBtn.addEventListener("click", kronologicSubmitAccusation);
  if (kronologicAccusationDeclineBtn) {
    kronologicAccusationDeclineBtn.addEventListener("click", () => {
      if (!kronologicCan("decline_accusation")) return;
      sendAction({ type: "decline_accusation" });
      kronologicCloseModal(kronologicAccusationModal);
    });
  }

  if (kronologicTimeModeBtn) {
    kronologicTimeModeBtn.addEventListener("click", () => {
      kronologicQueryMode = "time";
      kronologicSelectedSelector = null;
      kronologicRenderSelector();
      kronologicRenderQuerySummary();
    });
  }
  if (kronologicCharacterModeBtn) {
    kronologicCharacterModeBtn.addEventListener("click", () => {
      kronologicQueryMode = "character";
      kronologicSelectedSelector = null;
      kronologicRenderSelector();
      kronologicRenderQuerySummary();
    });
  }
  if (kronologicAskBtn) {
    kronologicAskBtn.addEventListener("click", () => {
      if (!kronologicCan("ask") || !kronologicSelectedLocation || kronologicSelectedSelector == null) return;
      const action = {
        type: "ask",
        query_type: kronologicQueryMode,
        location_id: kronologicSelectedLocation,
      };
      if (kronologicQueryMode === "time") action.time = Number(kronologicSelectedSelector);
      else action.character_id = kronologicSelectedSelector;
      sendAction(action);
      kronologicSelectedLocation = null;
      kronologicSelectedSelector = null;
    });
  }
  if (kronologicAccuseBtn) kronologicAccuseBtn.addEventListener("click", kronologicOpenAccusationModal);
  if (kronologicReadyBtn) {
    kronologicReadyBtn.addEventListener("click", () => {
      if (kronologicCan("ready_next_turn")) sendAction({ type: "ready_next_turn" });
    });
  }
  if (kronologicPlayAgainBtn) {
    kronologicPlayAgainBtn.addEventListener("click", () => {
      if (kronologicCan("play_again")) sendAction({ type: "play_again" });
    });
  }
  if (kronologicCountTimeBtn) {
    kronologicCountTimeBtn.addEventListener("click", () => {
      kronologicCountMode = "time";
      kronologicRenderCountNotes();
    });
  }
  if (kronologicCountCharacterBtn) {
    kronologicCountCharacterBtn.addEventListener("click", () => {
      kronologicCountMode = "character";
      kronologicRenderCountNotes();
    });
  }

  if (kronologicPanel) {
    kronologicPanel.addEventListener("click", (event) => {
      const locationButton = event.target.closest("button[data-location-id]");
      if (locationButton) {
        const locationId = locationButton.dataset.locationId;
        kronologicSelectedLocation = kronologicSelectedLocation === locationId ? null : locationId;
        kronologicRenderMap();
        kronologicRenderQuerySummary();
        return;
      }
      const selectorButton = event.target.closest("button[data-query-selector]");
      if (selectorButton) {
        const raw = selectorButton.dataset.querySelector;
        const selector = kronologicQueryMode === "time" ? Number.parseInt(raw, 10) : raw;
        kronologicSelectedSelector = kronologicSelectedSelector === selector ? null : selector;
        kronologicRenderSelector();
        kronologicRenderQuerySummary();
        return;
      }
      const timeButton = event.target.closest("button[data-notebook-time]");
      if (timeButton) {
        kronologicNotebookTime = Number.parseInt(timeButton.dataset.notebookTime, 10) || 1;
        kronologicRenderNotebookTimes();
        kronologicRenderNotebook();
        kronologicRenderCountNotes();
        return;
      }
      const noteButton = event.target.closest("button[data-note-character][data-note-location]");
      if (noteButton && kronologicView && kronologicView.can_edit_notes) {
        const current = noteButton.dataset.noteMark || "unknown";
        const index = KRONOLOGIC_MARK_ORDER.indexOf(current);
        const next = KRONOLOGIC_MARK_ORDER[(index + 1 + KRONOLOGIC_MARK_ORDER.length) % KRONOLOGIC_MARK_ORDER.length];
        const key = `${kronologicNotebookTime}|${noteButton.dataset.noteLocation}|${noteButton.dataset.noteCharacter}`;
        if (!kronologicView.your_notes) kronologicView.your_notes = { marks: {}, counts: {} };
        if (!kronologicView.your_notes.marks) kronologicView.your_notes.marks = {};
        if (next === "unknown") delete kronologicView.your_notes.marks[key];
        else kronologicView.your_notes.marks[key] = next;
        sendAction({
          type: "set_note_mark",
          time: kronologicNotebookTime,
          location_id: noteButton.dataset.noteLocation,
          character_id: noteButton.dataset.noteCharacter,
          mark: next,
        });
        kronologicRenderNotebook();
        return;
      }
      const countCharacterButton = event.target.closest("button[data-count-character]");
      if (countCharacterButton) {
        kronologicCountCharacter = countCharacterButton.dataset.countCharacter;
        kronologicRenderCountNotes();
        return;
      }
      if (
        event.target === kronologicQueryCard ||
        event.target.classList.contains("kronologic-query-heading") ||
        event.target === kronologicPanel
      ) {
        clearKronologicSelection();
      }
    });

    kronologicPanel.addEventListener("change", (event) => {
      const select = event.target.closest("select[data-count-location]");
      if (!select || !kronologicView || !kronologicView.can_edit_notes) return;
      const rawValue = select.value;
      const action = {
        type: "set_note_count",
        query_type: kronologicCountMode,
        location_id: select.dataset.countLocation,
        count: rawValue === "" ? null : Number.parseInt(rawValue, 10),
      };
      if (kronologicCountMode === "time") action.time = kronologicNotebookTime;
      else action.character_id = kronologicCountCharacter;
      sendAction(action);
    });
  }

  [kronologicHelpModal, kronologicExplainModal, kronologicAccusationModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) kronologicCloseModal(modal);
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!kronologicExplainMode) return;
    const exempt = event.target.closest("#kronologicHelpBtn, #kronologicExplainBtn, #kronologicHelpCloseBtn, #kronologicExplainCloseBtn, #kronologicAccusationCloseBtn");
    if (exempt) return;
    const button = kronologicFindExplainTargetAtPoint(event.clientX, event.clientY);
    if (!button) return;
    const key = button.dataset.kronologicExplain;
    const explanations = kronologicIsChinese() ? KRONOLOGIC_EXPLANATIONS_ZH : KRONOLOGIC_EXPLANATIONS;
    if (!explanations[key]) return;
    event.preventDefault();
    event.stopPropagation();
    kronologicSuppressClickUntil = Date.now() + 500;
    kronologicExitExplainMode();
    kronologicShowExplanation(key);
  }, true);

  document.addEventListener("click", (event) => {
    if (Date.now() < kronologicSuppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!kronologicExplainMode) return;
    const button = event.target.closest("button");
    if (!button) return;
    if (button === kronologicHelpBtn || button === kronologicExplainBtn || button === kronologicHelpCloseBtn || button === kronologicExplainCloseBtn || button === kronologicAccusationCloseBtn) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (kronologicIsModalOpen(kronologicExplainModal)) {
      kronologicCloseModal(kronologicExplainModal);
      return;
    }
    if (kronologicIsModalOpen(kronologicHelpModal)) {
      kronologicCloseModal(kronologicHelpModal);
      return;
    }
    if (kronologicIsModalOpen(kronologicAccusationModal)) {
      kronologicCloseModal(kronologicAccusationModal);
      return;
    }
    if (kronologicExplainMode) {
      kronologicExitExplainMode();
      return;
    }
    if (kronologicPanel && !kronologicPanel.classList.contains("hidden")) clearKronologicSelection();
  });

  resetKronologicRoomConfig();

  window.getKronologicRoomConfig = getKronologicRoomConfig;
  window.updateKronologicConfigRow = updateKronologicConfigRow;
  window.updateKronologicConfigRowsFromSource = updateKronologicConfigRowsFromSource;
  window.resetKronologicRoomConfig = resetKronologicRoomConfig;
  window.clearKronologicState = clearKronologicState;
  window.renderKronologicGameState = renderKronologicGameState;
  window.showKronologicHeaderActions = showKronologicHeaderActions;
})();
