(() => {
  "use strict";

  let bombBustersView = null;
  let bombBustersStateVersion = null;
  let bombBustersSelectedOwnWireId = null;
  let bombBustersSelectedTargetWireIds = [];
  let bombBustersSelectedSoloWireIds = [];
  let bombBustersActionMode = "duo";
  let bombBustersPendingAction = false;
  let bombBustersPendingTimer = null;
  let bombBustersExplainMode = false;
  let bombBustersPopoverAnchorWireId = null;
  let bombBustersPopoverFrame = null;
  let bombBustersTooltipTimer = null;
  let bombBustersEffectToken = null;
  let bombBustersHelpWidget = null;
  let bombBustersExplainWidget = null;
  let bombBustersHelpMissionId = null;
  let bombBustersHelpPlayerCount = 3;
  let bombBustersHelpBrowseOpen = false;
  let bombBustersHelpRequest = null;
  let bombBustersHelpErrorKey = null;
  const BOMB_BUSTERS_MISSION_HELP_CACHE = new Map();
  const BOMB_BUSTERS_DYNAMIC_EXPLANATIONS = new Set();

  const bombBustersPanelEl = document.getElementById("bombBustersPanel");
  const bombBustersHeaderActionsEl = document.getElementById("bombBustersHeaderActions");
  const bombBustersHelpBtnEl = document.getElementById("bombBustersHelpBtn");
  const bombBustersExplainBtnEl = document.getElementById("bombBustersExplainBtn");
  const bombBustersPresetLabelEl = document.getElementById("bombBustersPresetLabel");
  const bombBustersMissionLabelEl = document.getElementById("bombBustersMissionLabel");
  const bombBustersTurnLabelEl = document.getElementById("bombBustersTurnLabel");
  const bombBustersStatusEl = document.getElementById("bombBustersStatus");
  const bombBustersDetonatorEl = document.getElementById("bombBustersDetonator");
  const bombBustersMarkersEl = document.getElementById("bombBustersMarkers");
  const bombBustersRacksEl = document.getElementById("bombBustersRacks");
  const bombBustersValidationEl = document.getElementById("bombBustersValidation");
  const bombBustersValidationSummaryEl = document.getElementById("bombBustersValidationSummary");
  const bombBustersDetectorStatusEl = document.getElementById("bombBustersDetectorStatus");
  const bombBustersActivityEl = document.getElementById("bombBustersActivity");
  const bombBustersActivityCountEl = document.getElementById("bombBustersActivityCount");
  const bombBustersActionDockEl = document.getElementById("bombBustersActionDock");
  const bombBustersActionModeEl = document.getElementById("bombBustersActionMode");
  const bombBustersActionSummaryEl = document.getElementById("bombBustersActionSummary");
  const bombBustersSoloOptionsEl = document.getElementById("bombBustersSoloOptions");
  const bombBustersShareClueBtnEl = document.getElementById("bombBustersShareClueBtn");
  const bombBustersConfirmDuoBtnEl = document.getElementById("bombBustersConfirmDuoBtn");
  const bombBustersDetectorBtnEl = document.getElementById("bombBustersDetectorBtn");
  const bombBustersConfirmDetectorBtnEl = document.getElementById("bombBustersConfirmDetectorBtn");
  const bombBustersConfirmSoloBtnEl = document.getElementById("bombBustersConfirmSoloBtn");
  const bombBustersResolveBtnEl = document.getElementById("bombBustersResolveBtn");
  const bombBustersSecureRedBtnEl = document.getElementById("bombBustersSecureRedBtn");
  const bombBustersResultEl = document.getElementById("bombBustersResult");
  const bombBustersResultTitleEl = document.getElementById("bombBustersResultTitle");
  const bombBustersResultDetailEl = document.getElementById("bombBustersResultDetail");
  const bombBustersReadyListEl = document.getElementById("bombBustersReadyList");
  const bombBustersContinueBtnEl = document.getElementById("bombBustersContinueBtn");
  const bombBustersLiveRegionEl = document.getElementById("bombBustersLiveRegion");
  const bombBustersWirePopoverEl = document.getElementById("bombBustersWirePopover");
  const bombBustersWirePopoverTextEl = document.getElementById("bombBustersWirePopoverText");
  const bombBustersWirePopoverConfirmBtnEl = document.getElementById("bombBustersWirePopoverConfirmBtn");
  const bombBustersWirePopoverCancelBtnEl = document.getElementById("bombBustersWirePopoverCancelBtn");
  const bombBustersTooltipEl = document.getElementById("bombBustersTooltip");

  const BOMB_BUSTERS_EXPLANATIONS = {
    campaign: {
      zh: "关卡特殊规则优先于普通剪线和装备规则。点选装备后在线架选线并确认。Help 的逐关玩法章节会显示本关差异与例子。",
      en: "Mission-specific rules override normal cutting and equipment. Select equipment to choose its wires on the racks, then confirm. See Missions in Help for this mission's differences and examples.",
    },
    own_wire: {
      zh: "这是自己的可见电线。选择未剪的蓝线(🔵)或黄线(🟡)作为双人剪线的声明。蓝线数字是配对值，黄线和红线的小数只表示排序。红线(🔴)不能作为普通声明。",
      en: "Select an uncut blue (🔵) or yellow (🟡) wire as your Duo Cut declaration. Blue numbers are cut values. Yellow and red decimals are private sorting positions only. Red (🔴) cannot be declared normally.",
    },
    hidden_wire: {
      zh: "这条电线对你隐藏。线架位置和公开信息标记可用于推理。先选择自己的声明线，再选择队友的目标线。反向电线则对主人隐藏、对队友可见。",
      en: "This face is hidden from you. Its rack position and attached Info tokens are public clues. Choose your declaration before a teammate target. Reversed wires instead hide their face from their owner.",
    },
    revealed_wire: {
      zh: "已剪电线(✂️)、安全揭示的红线(🛡️)和失败时的电线(💥)保留原位置并公开正面，帮助保留排序线索。",
      en: "A cut (✂️), safely secured (🛡️), or exploded (💥) wire stays in its original slot with its face visible, preserving the rack's sorting clues.",
    },
    info: {
      zh: "信息标记通常公开蓝线数字或标记黄线，每种有两枚。特殊关卡可能改用奇偶、负面或同值数量线索，应以当前关卡规则为准。",
      en: "An Info token normally gives a blue number or marks yellow. Each label has two tokens. Mission rules may replace these with parity, negative, or multiplicity clues.",
    },
    validation: {
      zh: "同一蓝线数字的四条电线全部剪断后完成验证(✅)。未加入本关的数字显示 N/A，记忆关可能隐藏验证进度。",
      en: "A blue number validates (✅) after all four copies have been cut. Values outside this setup show N/A. Memory missions may hide this tracker.",
    },
    detonator: {
      zh: "普通非红线剪错通常消耗一格容错。引爆器(🧨)耗尽或普通剪线碰到红线就失败，特殊关卡可能改变失败条件。",
      en: "A normal non-red miss spends one mistake. The detonator (🧨) reaching zero or a normal red cut explodes the bomb. Mission rules may change these conditions.",
    },
    share: {
      zh: "开局选择自己的可用电线并公开线索。通常是给蓝线放置数字信息标记，同值标记用完则只宣布一次。特殊关卡以当前规则为准。",
      en: "Share an initial clue on an eligible wire. Normally this attaches a numbered Info token to a blue wire. If both matching tokens are occupied, announce it once instead. Follow mission overrides.",
    },
    duo: {
      zh: "用自己选中的蓝线数字或黄线作为声明，尝试与队友的一条目标线配对。匹配则剪断双方电线，不匹配通常推进引爆器。",
      en: "Use your selected blue number or yellow wire as the declaration and test one teammate wire. A match cuts both. A miss normally advances the detonator.",
    },
    detector: {
      zh: "双重探测器(🔎)通常每关一次，用自己的蓝线声明，同时指定队友同一线架的两条电线。成功或失败都会消耗它，不能声明黄线。",
      en: "The Double Detector (🔎) normally works once per bomb. Declare one of your blue values and test two wires on the same teammate rack. It is spent on success or failure and cannot declare yellow.",
    },
    detector_confirm: {
      zh: "提交蓝线声明以及队友同一线架的两条不同目标线。目标不必相邻。",
      en: "Submit the selected blue declaration and exactly two targets from one teammate rack. The targets do not need to be adjacent.",
    },
    solo: {
      zh: "只有当某个值剩余的全部电线都在自己手里，而且数量恰好为两条或四条时，才能一次单人剪断。三条不合法，可以跨自己的两个线架。",
      en: "Solo Cut every remaining wire of one match held by you, but only when exactly two or four remain. Three matching wires are not legal. The set may span both of your racks.",
    },
    secure: {
      zh: "当自己剩余的未剪电线全部是红线时，可以安全揭示(🛡️)，不使用剪刀也不推进引爆器。部分关卡有特殊处理。",
      en: "When every uncut wire in your hand is red, reveal and secure them (🛡️) without advancing the detonator. Some missions override this action.",
    },
    resolve: {
      zh: "由目标线主人私下选择允许的位置。服务端只公开探测器规则要求的结果，不泄露其他候选线。",
      en: "The target owner privately chooses one of the allowed slots. The server reveals only the result required by the detector rule.",
    },
    continue: {
      zh: "查看最终电线后确认继续。所有真人准备好才进入下一关或重试，机器人自动确认。",
      en: "Confirm after reviewing the final rack layout. The next bomb or retry starts only when every human player is ready. Bots confirm automatically.",
    },
  };

  const BOMB_BUSTERS_HELP_CONFIG = {
    gameId: "bomb_busters",
    title: {zh: "炸弹克星 · Bomb Busters", en: "Bomb Busters"},
    basic: {
      win: {
        zh: "在引爆器耗尽前合作剪完所有蓝线(🔵)与黄线(🟡)，并安全揭示剩余红线(🔴)，全队获胜。",
        en: "Win together by cutting all blue (🔵) and yellow (🟡) wires and safely securing the red wires (🔴) before the detonator explodes."
      },
      turn: {
        zh: "轮到你时，用自己的线值与队友配对剪线，单人剪掉自己持有的某值全部剩余电线，或在只剩红线时安全揭示。",
        en: "On your turn, match one of your wire values with a teammate, Solo Cut every remaining wire of one value in your hand, or secure your wires when only red remain."
      },
      key: {
        zh: "结合线架排序和公开线索推理隐藏值，管理容错与装备，并遵守当前关卡的交流限制。",
        en: "Infer hidden values from sorted racks and public clues, manage mistakes and equipment, and follow the current mission's communication limits."
      }
    },
    sections: [
      {
        id: "wires", label: {zh: "电线与线索", en: "Wires & Clues"},
        html: {
          zh: "<p>蓝线(🔵)为 1 至 12，各有四条。黄线(🟡)剪线时全部视为同值，红线(🔴)被普通剪线碰到会立即爆炸。黄线与红线上的小数只用于排序，不是剪线数字。</p><p>每个线架独立从小到大排列。两人时每人有两个线架，三人时队长(🧭)有两个，其余人一个。自己的两个线架合称一手牌。通常只能看见自己的未剪电线，队友电线显示问号(?)。</p><p>通常从队长开始，每人给自己一条蓝线放一个信息标记。每个数字及黄色标记各有两枚，同值标记用完时只宣布一次线索。剪断后标记归还供应区。特殊关卡可能改用奇偶、负面(≠)或同值数量(×1、×2、×3)线索。</p><p>已剪电线(✂️)与安全揭示的红线(🛡️)保留在原位置并公开正面。同一蓝线数字的四条全部剪断后完成验证(✅)。公开颜色候选标记只表示可能加入的小数位置，不表示所属玩家。</p>",
          en: "<p>Blue wires (🔵) have four copies of each number from 1 to 12. All yellow wires (🟡) match one another. A normal cut hitting red (🔴) explodes immediately. Yellow and red decimals are sorting positions, not cut values.</p><p>Each rack is sorted independently. With two players everyone has two racks. With three players the Captain (🧭) has two and everyone else has one. Both of your racks form one hand. Normally you see your own uncut faces while teammates' faces show a question mark (?).</p><p>Starting with the Captain, everyone normally marks one blue wire with an Info token. Each numbered label and yellow have two tokens. If both are occupied, announce the clue once instead. Cutting returns attached tokens to the supply. Missions may use parity, negative (≠), or multiplicity (×1, ×2, ×3) clues instead.</p><p>Cut wires (✂️) and secured red wires (🛡️) stay in their original slots, faceup. Cutting all four copies of a blue number completes its validation (✅). Public color candidates show possible decimal positions, not wire owners.</p>"
        }
      },
      {
        id: "cuts", label: {zh: "剪线与失败", en: "Cuts & Mistakes"},
        html: {
          zh: "<p><strong>双人剪线：</strong>选择自己一条未剪蓝线或黄线作为声明，再指定队友的一条目标线。匹配则双方各剪一条。不匹配的非红目标通常消耗一格引爆器(🧨)，并给目标放真实信息标记。允许故意猜错，但声明值必须来自自己的电线。</p><p><strong>单人剪线：</strong>只有当该值全部剩余电线都在自己手里，且数量恰好为两条或四条时才能全部剪断。可以跨自己的两个线架，三条不合法。</p><p><strong>安全揭示红线：</strong>当自己全部未剪电线都是红线时，将它们安全揭示(🛡️)，不会推进引爆器。空手玩家跳过，最后一位有线的玩家可以连续行动。</p><p>普通任务的容错格数等于人数。剪到红线或容错耗尽就失败。特殊关卡可以改变行动、线索、容错和胜负条件，应先在逐关玩法章节查看本关说明。</p>",
          en: "<p><strong>Duo Cut:</strong> choose your own uncut blue or yellow declaration, then point to one teammate wire. A match cuts one on each side. A non-red miss normally advances the detonator (🧨) one step and marks the target's true value. Intentional misses are allowed, but your declaration must come from your hand.</p><p><strong>Solo Cut:</strong> cut a value only when all its remaining wires are in your hand and exactly two or four remain. Both of your racks count together. Three matching wires are never a normal Solo Cut.</p><p><strong>Secure red:</strong> when all your uncut wires are red, safely reveal them (🛡️) without advancing the detonator. Empty players are skipped, and the last player with wires may act consecutively.</p><p>The normal mistake limit equals the player count. Hitting red or running out of mistakes fails the mission. Mission rules can override actions, clues, mistakes, and victory conditions, so read this mission's guide in Missions first.</p>"
        }
      },
      {
        id: "equipment", label: {zh: "装备与特殊机制", en: "Equipment"},
        html: {
          zh: "<p>双重探测器(🔎)通常每关使用一次。用自己的蓝线数字指定队友同一线架的两条不同电线，不必相邻。有匹配就成功，多条匹配时由主人私下选一条。没有匹配时通常消耗一格并选择非红目标给线索，全部是红线则爆炸，不能声明黄线。</p><p>共享装备(🧰)通常在剪掉其数字的两条蓝线后解锁，每张用一次。三重探测器覆盖同架三条，超级探测器覆盖同架全部可用电线。雷达(📡)只报告每架有无某数字，不公开数量和位置。</p><p>对讲机交换电线，便利贴增加线索，相等与不等标签标记相邻电线的关系。回溯器恢复一格，电池恢复个人探测器，稳定器保护本回合剪线，X 或 Y 射线允许声明两个持有值，咖啡杯跳过回合并选择下一位。后期装备有各自的解锁条件，可在 Explain 中查看。</p><p>氧气(🫧)、纳诺机器人(🤖)、挑战(🏆)与约束(📋)按本关规则处理。反向电线对主人隐藏、对队友可见，剪线时需要明确声明。点装备后直接在线架选线，再确认，特殊电线能否使用装备以当前关卡为准。</p>",
          en: "<p>The Double Detector (🔎) normally works once per mission. Declare your blue number and test two distinct wires on one teammate rack, adjacent or not. A match succeeds, with the owner privately choosing if several match. A miss normally costs one step and clues one non-red target. All-red targets explode. Yellow declarations are not allowed.</p><p>Shared equipment (🧰) normally unlocks after two blue wires of its number are cut and works once. Triple Detector tests three wires on one rack. Super Detector tests all eligible wires on one rack. Radar (📡) reports presence by rack, without revealing quantity or position.</p><p>Walkie-Talkies exchange wires, Post-It adds a clue, and equality labels describe adjacent wires. Rewinder restores a step, Batteries recharge personal detectors, Stabilizer protects a cut this turn, X or Y Ray declares two held values, and Coffee Mug skips to a chosen player. Late equipment has individual unlock conditions shown in Explain.</p><p>Oxygen (🫧), Nano (🤖), challenges (🏆), and constraints (📋) follow mission-specific rules. Reversed wires hide their face from the owner and require an explicit declaration. Select equipment, choose wires on the racks, then confirm. Special wires may ignore equipment.</p>"
        }
      },
      {
        id: "mission", label: {zh: "逐关玩法", en: "Missions"},
        get html() { return bombBustersMissionHelp(); }
      },
      {
        id: "controls", label: {zh: "操作与结算", en: "Controls & Results"},
        html: {
          zh: "<p>先选自己的声明线，再选队友目标并确认。手机在所选线附近显示确认卡。点空白处、Cancel 或按 Esc 可取消未提交选择。滑动只滚动，不应触发选线。</p><p>悬停非交互图标可看说明，手机点按时显示三秒。Explain 开启后再点电线、装备或按钮可查看含义，不会提交行动，灰色按钮同样可解释，按 Esc 退出。</p><p>只能讨论规则允许的公开信息，不能透露未公开线值或位置，也不要用日志代替记忆。氧气关等特殊任务还会限制说话。</p><p>结算公开全部电线并暂停。所有真人确认后才进入下一关或重试，机器人自动确认。机器人(🤖)只用自己可见信息，是练习级助手。</p>",
          en: "<p>Select your declaration, choose teammate targets, then confirm. Phones show a confirmation card near the selected wire. Click blank space, press Cancel, or hit Esc to drop an unsubmitted selection. Swiping scrolls without selecting wires.</p><p>Hover over non-interactive icons for hints, or tap them on a phone for three seconds. Enable Explain and tap a wire, equipment card, or button to inspect it without acting. Disabled buttons remain explainable. Esc leaves explain mode.</p><p>Discuss only information the rules permit. Do not reveal private wire values or locations, or replace memory with a detailed log. Some missions further restrict speech.</p><p>Results reveal all faces and pause. Every human must confirm before the next mission or retry. Bots (🤖) confirm automatically and use only their own visible information as practice-level teammates.</p>"
        }
      }
    ]
  };

  function bombBustersEscapeHelp(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
  }

  function bombBustersSelectedMissionHelp() {
    const current = bombBustersView?.campaign?.help;
    if (current?.id === bombBustersHelpMissionId && current.player_count === bombBustersHelpPlayerCount) return current;
    return BOMB_BUSTERS_MISSION_HELP_CACHE.get(`${bombBustersHelpMissionId}:${bombBustersHelpPlayerCount}`);
  }

  function bombBustersMissionHelpDetail(language) {
    const escape = bombBustersEscapeHelp;
    const mission = bombBustersView?.campaign;
    const number = bombBustersHelpMissionId;
    if (!number) return language === "zh"
      ? "<h3>原创练习</h3><p>原创练习使用 Room Control 中选择的预设，不是数字战役关卡，也不包含共享装备。Short、Standard 与 High Risk 分别调整线数和危险程度。展开上方逐关查阅可以主动查看第 1 至 66 关的不同玩法。</p>"
      : "<h3>Original Practice</h3><p>Original Practice uses the Room Control preset, not a numbered campaign mission, and has no shared equipment. Short, Standard, and High Risk vary wire count and danger. Expand the browser above to choose the rules for any of Missions 1–66.</p>";
    const detail = bombBustersSelectedMissionHelp();
    const heading = language === "zh" ? `第 ${number} 关` : `Mission ${number}`;
    let html = `<h3>${escape(heading)}${detail ? ` · ${escape(detail.title[language])}` : ""}</h3>`;
    html += `<p class="bomb-busters-help-context">${language === "zh"
      ? (number === mission?.id && bombBustersHelpPlayerCount === bombBustersView?.players?.length ? "当前关卡。未另行说明的部分仍使用基本规则。" : "规则预览，不会切换当前游戏或公开本局隐藏信息。")
      : (number === mission?.id && bombBustersHelpPlayerCount === bombBustersView?.players?.length ? "Current mission. Basic rules still apply unless changed below." : "Rules preview only. This does not change the game or reveal hidden state.")}</p>`;
    if (detail) {
      if (!detail.supported) html += `<p class="bomb-busters-help-warning">${language === "zh"
        ? `本关至少需要 ${detail.min_players} 人，当前 ${detail.player_count} 人配置不可玩。以下预览 ${detail.setup_players} 人准备规则。`
        : `This mission requires at least ${detail.min_players} players and is unavailable for ${detail.player_count}. Showing the ${detail.setup_players}-player setup.`}</p>`;
      html += detail.sections.map((section) => `<section data-bomb-busters-help-part="${escape(section.id)}"><h4>${escape(section.label[language])}</h4><p>${escape(section.text[language])}</p></section>`).join("");
      if (detail.constraints?.length) {
        html += `<details class="bomb-busters-help-constraints"><summary>${language === "zh" ? "约束字母是什么意思？" : "What do the constraint letters mean?"}</summary><ul>${detail.constraints.map((constraint) => `<li><strong>${escape(constraint.id)}</strong> ${escape(constraint.text[language])}</li>`).join("")}</ul></details>`;
      }
      if (detail.challenges?.length) {
        html += `<details class="bomb-busters-help-challenges"><summary>${language === "zh" ? "挑战卡(🏆)条件速查" : "Challenge cards (🏆) reference"}</summary><p>${language === "zh" ? "仅本关公开抽到的卡生效，每张达成后奖励一次。" : "Only the cards drawn publicly for this mission apply, with one reward per completed card."}</p><ol>${detail.challenges.map((challenge) => `<li value="${escape(challenge.id)}">${escape(challenge.text[language])}</li>`).join("")}</ol></details>`;
      }
    } else {
      if (number === mission?.id) html += `<p>${escape(language === "zh" ? mission.rules_zh || mission.rules : mission.rules)}</p>`;
      const key = `${number}:${bombBustersHelpPlayerCount}`;
      html += bombBustersHelpErrorKey === key
        ? `<p role="status">${language === "zh" ? "关卡说明加载失败，请重试。" : "Mission rules could not be loaded. Please retry."}</p><button type="button" data-bomb-busters-help-retry>Retry</button>`
        : `<p role="status">${language === "zh" ? "正在加载本关具体玩法…" : "Loading this mission's detailed rules…"}</p>`;
    }
    html += `<p class="bomb-busters-help-source">${language === "zh"
      ? "关卡说明依据公开参考资料整理，尚未经第二人独立规则复核。本页说明规则差别，不表示全部线上机制均已完成验收。"
      : "Rules are transcribed from public references without an independent second-person audit. This guide does not certify every online mission mechanic."}</p>`;
    if (detail?.audio_companion || number === mission?.id && mission?.audio_companion) html += `<p class="bomb-busters-help-source">${language === "zh"
      ? "音频关(🎧)需要外部官方录音与队长手动应用指令，没有内置商业录音，也不会自动同步播放进度。"
      : "Audio missions (🎧) require the external official recording and manual Captain controls. Commercial audio is not bundled or automatically synchronized."}</p>`;
    return html;
  }

  function bombBustersMissionHelp() {
    const options = Array.from({length: 66}, (_, index) => {
      const number = index + 1;
      return `<option value="${number}"${number === bombBustersHelpMissionId ? " selected" : ""}>${String(number).padStart(2, "0")}</option>`;
    }).join("");
    const players = [2, 3, 4, 5].map((count) => `<option value="${count}"${count === bombBustersHelpPlayerCount ? " selected" : ""}>${count}</option>`).join("");
    return Object.fromEntries(["zh", "en"].map((language) => [language,
      `<details class="bomb-busters-help-browser"${bombBustersHelpBrowseOpen ? " open" : ""}><summary>${language === "zh" ? "逐关查阅（含后续关卡剧透）" : "Browse missions (includes spoilers)"}</summary><p>${language === "zh" ? "默认显示当前关卡。主动选择其他关卡后才加载其玩法，切换人数可查看配线差异。" : "The current mission is shown by default. Other rules load only when selected. Change Players to preview setup differences."}</p><div class="bomb-busters-help-browser-fields"><label>Mission <select data-bomb-busters-help-mission-select>${!bombBustersView?.campaign ? `<option value="practice"${bombBustersHelpMissionId === null ? " selected" : ""}>Original Practice</option>` : ""}${options}</select></label><label>Players <select data-bomb-busters-help-player-select>${players}</select></label><button type="button" data-bomb-busters-help-current>Current</button></div></details><div class="bomb-busters-help-detail" data-bomb-busters-help-mission="${bombBustersHelpMissionId || "practice"}">${bombBustersMissionHelpDetail(language)}</div>`
    ]));
  }

  function bombBustersRefreshMissionHelp() {
    const container = bombBustersHelpWidget?.element()?.querySelector(".bomb-busters-help-detail");
    if (!container) return;
    container.dataset.bombBustersHelpMission = bombBustersHelpMissionId || "practice";
    container.innerHTML = bombBustersMissionHelpDetail(window.obgHelpLang?.() || "zh");
  }

  async function bombBustersLoadMissionHelp() {
    bombBustersHelpRequest?.controller.abort();
    bombBustersHelpRequest = null;
    bombBustersHelpErrorKey = null;
    if (!bombBustersHelpMissionId || bombBustersSelectedMissionHelp()) {
      bombBustersRefreshMissionHelp();
      return;
    }
    const number = bombBustersHelpMissionId;
    const count = bombBustersHelpPlayerCount;
    const key = `${number}:${count}`;
    const request = {key, controller: new AbortController()};
    bombBustersHelpRequest = request;
    bombBustersRefreshMissionHelp();
    try {
      const response = await fetch(`/api/bomb_busters/missions/${number}/help?player_count=${count}`, {signal: request.controller.signal});
      if (!response.ok) throw new Error("Mission Help request failed");
      const detail = await response.json();
      if (detail.id !== number || detail.player_count !== count || !Array.isArray(detail.sections)) throw new Error("Invalid mission Help");
      BOMB_BUSTERS_MISSION_HELP_CACHE.set(key, detail);
    } catch (error) {
      if (bombBustersHelpRequest === request && error.name !== "AbortError") bombBustersHelpErrorKey = key;
    } finally {
      if (bombBustersHelpRequest === request) {
        bombBustersHelpRequest = null;
        bombBustersRefreshMissionHelp();
      }
    }
  }

  function bombBustersResetMissionHelp() {
    bombBustersHelpMissionId = bombBustersView?.campaign?.id || null;
    bombBustersHelpPlayerCount = bombBustersView?.players?.length || 3;
  }

  function bombBustersBindMissionHelp() {
    const dialog = bombBustersHelpWidget.element();
    if (!dialog || dialog.dataset.bombBustersHelpBound) return;
    dialog.dataset.bombBustersHelpBound = "true";
    dialog.addEventListener("change", (event) => {
      if (event.target.matches("[data-bomb-busters-help-mission-select]")) {
        bombBustersHelpMissionId = event.target.value === "practice" ? null : Number(event.target.value);
      } else if (event.target.matches("[data-bomb-busters-help-player-select]")) {
        bombBustersHelpPlayerCount = Number(event.target.value);
      } else return;
      bombBustersLoadMissionHelp();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-bomb-busters-help-current]")) {
        bombBustersResetMissionHelp();
        dialog.querySelector("[data-bomb-busters-help-mission-select]").value = bombBustersHelpMissionId || "practice";
        dialog.querySelector("[data-bomb-busters-help-player-select]").value = bombBustersHelpPlayerCount;
        bombBustersLoadMissionHelp();
      } else if (event.target.closest("[data-bomb-busters-help-retry]")) {
        bombBustersLoadMissionHelp();
      }
    });
    dialog.addEventListener("toggle", (event) => {
      if (event.target.isConnected && event.target.matches(".bomb-busters-help-browser")) bombBustersHelpBrowseOpen = event.target.open;
    }, true);
    dialog.addEventListener("close", () => {
      bombBustersHelpRequest?.controller.abort();
      bombBustersHelpRequest = null;
    });
  }

  function initBombBustersHelpExplain() {
    if (bombBustersHelpWidget || typeof window.obgCreateHelp !== "function" || typeof window.obgCreateExplain !== "function") return;
    bombBustersHelpWidget = window.obgCreateHelp(BOMB_BUSTERS_HELP_CONFIG);
    bombBustersExplainWidget = window.obgCreateExplain({
      gameId: "bomb_busters",
      attribute: "data-bomb-busters-explain",
      explanations: BOMB_BUSTERS_EXPLANATIONS,
      button: bombBustersExplainBtnEl,
      root: () => bombBustersPanelEl,
      bypass: ["#bombBustersHelpBtn", "#bombBustersExplainBtn"],
      onChange: (active) => {
        bombBustersExplainMode = active;
        bombBustersHideTooltip();
      }
    });
    bombBustersHelpBtnEl?.addEventListener("click", () => {
      bombBustersExplainWidget.exit();
      bombBustersHideTooltip();
      bombBustersResetMissionHelp();
      bombBustersHelpBrowseOpen = false;
      bombBustersHelpWidget.open();
      bombBustersBindMissionHelp();
      bombBustersLoadMissionHelp();
    });
    bombBustersExplainBtnEl?.addEventListener("click", () => bombBustersExplainWidget.toggle());
  }

  function bombBustersHideTooltip() {
    if (bombBustersTooltipTimer) window.clearTimeout(bombBustersTooltipTimer);
    bombBustersTooltipTimer = null;
    if (bombBustersTooltipEl) bombBustersTooltipEl.classList.add("hidden");
  }

  function bombBustersShowTooltip(target, timed = false) {
    bombBustersHideTooltip();
    if (!bombBustersTooltipEl || bombBustersExplainMode) return;
    bombBustersTooltipEl.textContent = target.dataset.bombBustersTip;
    bombBustersTooltipEl.classList.remove("hidden");
    const anchor = target.getBoundingClientRect();
    const bounds = bombBustersTooltipEl.getBoundingClientRect();
    const edge = 8;
    const left = Math.max(edge, Math.min(anchor.left, document.documentElement.clientWidth - bounds.width - edge));
    const top = anchor.bottom + bounds.height + edge * 2 <= window.innerHeight
      ? anchor.bottom + edge
      : Math.max(edge, anchor.top - bounds.height - edge);
    bombBustersTooltipEl.style.left = `${left}px`;
    bombBustersTooltipEl.style.top = `${top}px`;
    if (timed) bombBustersTooltipTimer = window.setTimeout(bombBustersHideTooltip, 3000);
  }

  function bombBustersFindPlayer(view, playerId) {
    return (view && view.players || []).find((player) => player.player_id === playerId) || null;
  }

  function bombBustersPlayerName(view, playerId) {
    const player = bombBustersFindPlayer(view, playerId);
    return (player && (player.name || player.player_id)) || playerId || "-";
  }

  function bombBustersHasAction(actionType) {
    return Boolean(
      bombBustersView &&
      Array.isArray(bombBustersView.legal_actions) &&
      bombBustersView.legal_actions.includes(actionType)
    );
  }

  function bombBustersAllWires(view) {
    return (view && view.racks || []).flatMap((rack) => rack.slots || []);
  }

  function bombBustersFindWire(view, wireId) {
    return bombBustersAllWires(view).find((wire) => wire.wire_id === wireId) || null;
  }

  function bombBustersFindRack(view, wireId) {
    return (view && view.racks || []).find((rack) =>
      (rack.slots || []).some((wire) => wire.wire_id === wireId)
    ) || null;
  }

  function bombBustersWireFaceLabel(wire) {
    if (!wire || wire.hidden) return "Hidden wire";
    if (wire.kind === "blue") return `BLUE ${wire.blue_value}`;
    if (wire.kind === "yellow") return `YELLOW ${wire.sort_label}`;
    return `RED ${wire.sort_label}`;
  }

  function bombBustersDeclarationLabel(wire) {
    if (!wire || wire.hidden) return "wire";
    return wire.kind === "blue" ? `🔵 ${wire.blue_value}` : wire.kind === "yellow" ? "🟡" : "🔴";
  }

  function bombBustersRackLabel(rack) {
    return `Rack ${String.fromCharCode(65 + Number(rack && rack.rack_index || 0))}`;
  }

  function bombBustersResetSelection(render = true) {
    bombBustersSelectedOwnWireId = null;
    bombBustersSelectedTargetWireIds = [];
    bombBustersSelectedSoloWireIds = [];
    bombBustersActionMode = "duo";
    bombBustersPopoverAnchorWireId = null;
    if (render && bombBustersView) bombBustersRenderInteractive(bombBustersView);
  }

  function bombBustersUsesWirePopover() {
    return window.matchMedia
      ? window.matchMedia("(max-width: 620px)").matches
      : window.innerWidth <= 620;
  }

  function bombBustersSelectedAction(view) {
    if (!view || bombBustersPendingAction) return null;
    if (
      view.phase === "initial_info" &&
      bombBustersHasAction("place_initial_info") &&
      bombBustersSelectedOwnWireId
    ) {
      return {
        action: {type: "place_initial_info", wire_id: bombBustersSelectedOwnWireId},
        explainKey: "share",
        label: "Share initial clue",
      };
    }
    if (
      view.phase === "awaiting_detector_choice" &&
      bombBustersHasAction("resolve_detector_choice") &&
      bombBustersSelectedTargetWireIds.length === 1
    ) {
      return {
        action: {type: "resolve_detector_choice", wire_id: bombBustersSelectedTargetWireIds[0]},
        explainKey: "resolve",
        label: "Confirm detector choice",
      };
    }
    if (view.phase !== "playing" || view.current_turn !== view.you) return null;
    if (
      bombBustersActionMode === "detector" &&
      bombBustersHasAction("double_detector_cut") &&
      bombBustersSelectedOwnWireId &&
      bombBustersSelectedTargetWireIds.length === 2
    ) {
      return {
        action: {
          type: "double_detector_cut",
          own_wire_id: bombBustersSelectedOwnWireId,
          target_wire_ids: [...bombBustersSelectedTargetWireIds],
        },
        explainKey: "detector_confirm",
        label: "Confirm detector cut",
      };
    }
    if (
      bombBustersActionMode === "solo" &&
      bombBustersHasAction("solo_cut") &&
      [2, 4].includes(bombBustersSelectedSoloWireIds.length)
    ) {
      return {
        action: {type: "solo_cut", wire_ids: [...bombBustersSelectedSoloWireIds]},
        explainKey: "solo",
        label: "Confirm Solo Cut",
      };
    }
    if (
      bombBustersActionMode === "duo" &&
      bombBustersHasAction("dual_cut") &&
      bombBustersSelectedOwnWireId &&
      bombBustersSelectedTargetWireIds.length === 1
    ) {
      return {
        action: {
          type: "dual_cut",
          own_wire_id: bombBustersSelectedOwnWireId,
          target_wire_id: bombBustersSelectedTargetWireIds[0],
        },
        explainKey: "duo",
        label: "Confirm Duo Cut",
      };
    }
    return null;
  }

  function bombBustersHideWirePopover() {
    if (bombBustersPopoverFrame) {
      window.cancelAnimationFrame(bombBustersPopoverFrame);
      bombBustersPopoverFrame = null;
    }
    if (!bombBustersWirePopoverEl) return;
    bombBustersWirePopoverEl.classList.remove("is-open");
    bombBustersWirePopoverEl.setAttribute("aria-hidden", "true");
    bombBustersWirePopoverEl.style.removeProperty("left");
    bombBustersWirePopoverEl.style.removeProperty("top");
    bombBustersWirePopoverEl.style.removeProperty("visibility");
  }

  function bombBustersPositionWirePopover() {
    bombBustersPopoverFrame = null;
    if (
      !bombBustersUsesWirePopover() ||
      !bombBustersWirePopoverEl ||
      !bombBustersWirePopoverEl.classList.contains("is-open") ||
      !bombBustersPopoverAnchorWireId ||
      !bombBustersPanelEl
    ) return;
    const anchor = Array.from(
      bombBustersPanelEl.querySelectorAll(".bomb-busters-wire-button[data-wire-id]")
    ).find((button) => button.dataset.wireId === bombBustersPopoverAnchorWireId);
    if (!anchor) {
      bombBustersHideWirePopover();
      return;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const edge = 8;
    const roomControls = document.getElementById("roomControlsPanel");
    const topInset = document.body.classList.contains("room-controls-docked") && roomControls
      ? Math.max(edge, roomControls.getBoundingClientRect().bottom + edge)
      : edge;
    if (anchorRect.bottom <= topInset || anchorRect.top >= window.innerHeight) {
      bombBustersWirePopoverEl.style.visibility = "hidden";
      return;
    }
    const popoverRect = bombBustersWirePopoverEl.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const gap = 10;
    let placement = "above";
    let top = anchorRect.top - popoverRect.height - gap;
    if (top < topInset) {
      placement = "below";
      top = Math.min(window.innerHeight - popoverRect.height - edge, anchorRect.bottom + gap);
    }
    const idealLeft = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;
    const left = Math.max(edge, Math.min(viewportWidth - popoverRect.width - edge, idealLeft));
    const arrowLeft = Math.max(14, Math.min(popoverRect.width - 14, anchorRect.left + anchorRect.width / 2 - left));
    bombBustersWirePopoverEl.dataset.placement = placement;
    bombBustersWirePopoverEl.style.left = `${Math.round(left)}px`;
    bombBustersWirePopoverEl.style.top = `${Math.max(topInset, Math.round(top))}px`;
    bombBustersWirePopoverEl.style.setProperty("--bomb-busters-popover-arrow-left", `${Math.round(arrowLeft)}px`);
    bombBustersWirePopoverEl.style.visibility = "visible";
  }

  function bombBustersScheduleWirePopoverPosition() {
    if (!bombBustersWirePopoverEl || !bombBustersWirePopoverEl.classList.contains("is-open")) return;
    if (bombBustersPopoverFrame) window.cancelAnimationFrame(bombBustersPopoverFrame);
    bombBustersPopoverFrame = window.requestAnimationFrame(bombBustersPositionWirePopover);
  }

  function bombBustersRenderWirePopover(view) {
    const hasSelection = Boolean(
      bombBustersSelectedOwnWireId ||
      bombBustersSelectedTargetWireIds.length ||
      bombBustersSelectedSoloWireIds.length
    );
    if (
      !bombBustersUsesWirePopover() ||
      !bombBustersWirePopoverEl ||
      !bombBustersPopoverAnchorWireId ||
      !hasSelection ||
      view.phase === "mission_result"
    ) {
      bombBustersHideWirePopover();
      return;
    }
    const selection = bombBustersSelectedAction(view);
    if (bombBustersWirePopoverTextEl) {
      bombBustersWirePopoverTextEl.textContent = bombBustersActionSummaryEl && bombBustersActionSummaryEl.textContent
        ? bombBustersActionSummaryEl.textContent
        : "Complete your wire selection.";
    }
    if (bombBustersWirePopoverConfirmBtnEl) {
      bombBustersWirePopoverConfirmBtnEl.disabled = !selection;
      bombBustersWirePopoverConfirmBtnEl.dataset.bombBustersExplain = selection
        ? selection.explainKey
        : bombBustersActionMode === "detector" ? "detector_confirm" : "duo";
      bombBustersWirePopoverConfirmBtnEl.setAttribute(
        "aria-label",
        selection ? selection.label : "Confirm unavailable until the selection is complete"
      );
    }
    if (bombBustersActionMode === "detector" && !selection) {
      bombBustersHideWirePopover();
      return;
    }
    bombBustersWirePopoverEl.classList.add("is-open");
    bombBustersWirePopoverEl.setAttribute("aria-hidden", "false");
    bombBustersWirePopoverEl.style.visibility = "hidden";
    bombBustersRefreshExplainTargets();
    bombBustersScheduleWirePopoverPosition();
  }

  function bombBustersDispatch(action) {
    if (bombBustersPendingAction || typeof sendAction !== "function") return;
    bombBustersPendingAction = true;
    if (bombBustersPendingTimer) window.clearTimeout(bombBustersPendingTimer);
    bombBustersPendingTimer = window.setTimeout(() => {
      bombBustersPendingAction = false;
      bombBustersPendingTimer = null;
      if (bombBustersView) bombBustersRenderInteractive(bombBustersView);
    }, 1800);
    sendAction(window.bombBustersCampaignUI ? window.bombBustersCampaignUI.decorateAction(action) : action);
    if (bombBustersView) bombBustersRenderInteractive(bombBustersView);
  }

  function bombBustersRefreshExplainTargets() {
    if (!bombBustersPanelEl) return;
    BOMB_BUSTERS_DYNAMIC_EXPLANATIONS.forEach((key) => { delete BOMB_BUSTERS_EXPLANATIONS[key]; });
    BOMB_BUSTERS_DYNAMIC_EXPLANATIONS.clear();
    bombBustersPanelEl.querySelectorAll("[data-bomb-busters-explanation]").forEach((element, index) => {
      const key = `detail_${index}`;
      BOMB_BUSTERS_EXPLANATIONS[key] = element.dataset.bombBustersExplanation;
      BOMB_BUSTERS_DYNAMIC_EXPLANATIONS.add(key);
      element.dataset.bombBustersExplain = key;
    });
    bombBustersExplainWidget?.refresh();
  }

  function bombBustersWireIsSelectable(view, rack, wire) {
    if (view && view.campaign && window.bombBustersCampaignUI && window.bombBustersCampaignUI.hasSelection()) {
      return !bombBustersPendingAction && window.bombBustersCampaignUI.selectable(rack, wire);
    }
    if (!view || !wire || wire.status !== "uncut" || bombBustersPendingAction) return false;
    const isOwn = rack.owner_id === view.you;
    if (view.phase === "initial_info") {
      return isOwn && (view.initial_info_candidate_wire_ids || []).includes(wire.wire_id);
    }
    if (view.phase === "awaiting_detector_choice") {
      return isOwn && (view.pending_choice_wire_ids || []).includes(wire.wire_id);
    }
    if (view.phase !== "playing" || view.current_turn !== view.you) return false;
    if (isOwn) {
      if (view.campaign && wire.reversed && wire.hidden && bombBustersActionMode !== "detector") return true;
      if (view.campaign && wire.kind === "blue" && !view.campaign.allowed_values.includes(wire.blue_value)) return false;
      if (bombBustersActionMode === "detector") return wire.kind === "blue";
      return wire.kind === "blue" || wire.kind === "yellow";
    }
    if (!bombBustersSelectedOwnWireId || bombBustersActionMode === "solo") return false;
    if (bombBustersActionMode === "detector" && bombBustersSelectedTargetWireIds.length) {
      const firstRack = bombBustersFindRack(view, bombBustersSelectedTargetWireIds[0]);
      return Boolean(firstRack && firstRack.rack_id === rack.rack_id);
    }
    return true;
  }

  function bombBustersHandleWireClick(rack, wire) {
    if (!bombBustersView || !bombBustersWireIsSelectable(bombBustersView, rack, wire)) return;
    if (bombBustersView.campaign && window.bombBustersCampaignUI && window.bombBustersCampaignUI.hasSelection()) {
      window.bombBustersCampaignUI.selectWire(rack, wire);
      return;
    }
    const isOwn = rack.owner_id === bombBustersView.you;
    if (bombBustersView.phase === "initial_info") {
      bombBustersSelectedOwnWireId = bombBustersSelectedOwnWireId === wire.wire_id ? null : wire.wire_id;
    } else if (bombBustersView.phase === "awaiting_detector_choice") {
      bombBustersSelectedTargetWireIds = bombBustersSelectedTargetWireIds[0] === wire.wire_id ? [] : [wire.wire_id];
    } else if (isOwn) {
      bombBustersSelectedOwnWireId = bombBustersSelectedOwnWireId === wire.wire_id ? null : wire.wire_id;
      bombBustersSelectedTargetWireIds = [];
      bombBustersSelectedSoloWireIds = [];
      if (bombBustersActionMode === "solo") bombBustersActionMode = "duo";
    } else if (bombBustersActionMode === "detector") {
      const index = bombBustersSelectedTargetWireIds.indexOf(wire.wire_id);
      if (index >= 0) {
        bombBustersSelectedTargetWireIds.splice(index, 1);
      } else if (bombBustersSelectedTargetWireIds.length < 2) {
        bombBustersSelectedTargetWireIds.push(wire.wire_id);
      }
    } else {
      bombBustersSelectedTargetWireIds = bombBustersSelectedTargetWireIds[0] === wire.wire_id ? [] : [wire.wire_id];
    }
    bombBustersPopoverAnchorWireId = bombBustersSelectedTargetWireIds.length
      ? bombBustersSelectedTargetWireIds[bombBustersSelectedTargetWireIds.length - 1]
      : bombBustersSelectedOwnWireId || bombBustersSelectedSoloWireIds[0] || null;
    bombBustersRenderInteractive(bombBustersView);
  }

  function bombBustersMakeWireSlot(view, rack, wire) {
    const slot = document.createElement("div");
    slot.className = "bomb-busters-wire-slot";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bomb-busters-wire-button";
    button.dataset.wireId = wire.wire_id;
    const isOwn = rack.owner_id === view.you;
    const isProcessed = wire.status !== "uncut";
    if (wire.hidden) {
      button.classList.add("is-hidden-wire");
      button.dataset.bombBustersExplain = "hidden_wire";
    } else if (isProcessed) {
      button.classList.add("is-revealed-wire", `is-${wire.kind}`);
      button.dataset.bombBustersExplain = "revealed_wire";
    } else {
      button.classList.add("is-own-wire", `is-${wire.kind}`);
      button.dataset.bombBustersExplain = "own_wire";
    }
    if (wire.status === "cut") button.classList.add("is-cut");
    if (wire.status === "secured") button.classList.add("is-secured");
    if (bombBustersSelectedOwnWireId === wire.wire_id) button.classList.add("is-selected-own");
    if (bombBustersSelectedTargetWireIds.includes(wire.wire_id)) button.classList.add("is-selected-target");
    if (bombBustersSelectedSoloWireIds.includes(wire.wire_id)) button.classList.add("is-selected-solo");
    if (window.bombBustersCampaignUI && window.bombBustersCampaignUI.isSelected(wire.wire_id)) button.classList.add("is-selected-target");
    if (wire.reversed || wire.unsorted) button.classList.add("is-special-wire");

    const slotNumber = document.createElement("span");
    slotNumber.className = "bomb-busters-slot-number";
    slotNumber.textContent = `#${Number(wire.slot_index) + 1}`;
    if (wire.reversed) slotNumber.textContent = `↩ #${Number(wire.slot_index) + 1}`;
    if (wire.unsorted) slotNumber.textContent = `X #${Number(wire.slot_index) + 1}`;
    const icon = document.createElement("span");
    icon.className = "bomb-busters-wire-icon";
    icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("strong");
    label.className = "bomb-busters-wire-label";

    if (wire.hidden) {
      label.textContent = "?";
    } else if (wire.kind === "blue") {
      icon.textContent = wire.status === "cut" ? "✂️" : "";
      label.textContent = wire.blue_value;
    } else if (wire.kind === "yellow") {
      icon.textContent = wire.status === "cut" ? "✂️" : "";
      label.textContent = wire.sort_label;
    } else {
      icon.textContent = wire.status === "secured" ? "🛡️" : wire.status === "cut" ? "💥" : "⚠️";
      label.textContent = wire.sort_label;
    }
    button.append(slotNumber, label);
    if (icon.textContent) button.appendChild(icon);
    button.disabled = !bombBustersWireIsSelectable(view, rack, wire);
    button.setAttribute(
      "aria-label",
      `${bombBustersRackLabel(rack)} slot ${Number(wire.slot_index) + 1}: ${bombBustersWireFaceLabel(wire)}, ${wire.status}${wire.public_info ? `, Info ${wire.public_info}` : ""}`
    );
    button.addEventListener("click", () => bombBustersHandleWireClick(rack, wire));
    slot.appendChild(button);

    if (wire.public_info) {
      const info = document.createElement("span");
      info.className = "bomb-busters-info-token";
      info.dataset.bombBustersExplain = "info";
      info.textContent = `ℹ️ ${wire.public_info === "yellow" ? "🟡" : wire.public_info}`;
      info.setAttribute("aria-hidden", "true");
      button.classList.add("has-info");
      button.appendChild(info);
    }
    return slot;
  }

  function bombBustersRenderRacks(view) {
    if (!bombBustersRacksEl) return;
    bombBustersRacksEl.innerHTML = "";
    const seatedPlayers = view.players || [];
    const ownSeat = Math.max(0, seatedPlayers.findIndex((player) => player.player_id === view.you));
    const players = [...seatedPlayers.slice(ownSeat), ...seatedPlayers.slice(0, ownSeat)];
    players.forEach((player) => {
      const card = document.createElement("article");
      card.className = "bomb-busters-player-card";
      if (player.player_id === view.you) card.classList.add("is-self");
      if (player.player_id === view.current_turn) card.classList.add("is-current");
      if (player.player_id === view.current_responder_id) card.classList.add("is-responder");

      const heading = document.createElement("div");
      heading.className = "bomb-busters-player-heading";
      const name = document.createElement("strong");
      name.textContent = player.name || player.player_id;
      name.dataset.bombBustersTip = name.textContent;
      const badges = document.createElement("div");
      badges.className = "bomb-busters-badges";
      const badgeTexts = [];
      if (player.is_captain) badgeTexts.push(["🧭", "Captain: shares the first clue and takes the first turn."]);
      if (player.player_id === view.you) badgeTexts.push(["You", "Your private wire faces are visible only to you."]);
      if (player.is_bot) badgeTexts.push(["🤖", "Bot player"]);
      if (player.player_id === view.current_turn) badgeTexts.push(["Turn", "This player has the current turn."]);
      badgeTexts.push(player.personal_detector_used
        ? ["🔎✓", "Double Detector: already used for this bomb."]
        : ["🔎", "Double Detector: ready, one use per bomb."]);
      badgeTexts.forEach(([text, description]) => {
        const badge = document.createElement("span");
        badge.textContent = text;
        badge.dataset.bombBustersTip = description;
        badge.setAttribute("aria-label", description);
        badges.appendChild(badge);
      });
      const count = document.createElement("span");
      count.className = "bomb-busters-wire-count";
      count.textContent = `${player.remaining_count} left`;
      count.dataset.bombBustersTip = `${player.remaining_count} uncut wires across this player's racks.`;
      heading.append(name, badges, count);
      card.appendChild(heading);

      (view.racks || []).filter((rack) => rack.owner_id === player.player_id).forEach((rack) => {
        const rackSection = document.createElement("section");
        rackSection.className = "bomb-busters-rack";
        const rackTitle = document.createElement("h4");
        rackTitle.textContent = bombBustersRackLabel(rack);
        const slots = document.createElement("div");
        slots.className = "bomb-busters-rack-slots";
        (rack.slots || []).forEach((wire) => slots.appendChild(bombBustersMakeWireSlot(view, rack, wire)));
        rackSection.append(rackTitle, slots);
        card.appendChild(rackSection);
      });
      bombBustersRacksEl.appendChild(card);
    });
    bombBustersRefreshExplainTargets();
  }

  function bombBustersRenderDetonator(view) {
    if (!bombBustersDetonatorEl) return;
    const detonator = view.detonator || {};
    const limit = Number(detonator.mistake_limit || 0);
    const used = Number(detonator.mistakes_used || 0);
    bombBustersDetonatorEl.innerHTML = "";
    const heading = document.createElement("div");
    heading.className = "bomb-busters-detonator-heading";
    const title = document.createElement("h3");
    title.textContent = "🧨 Detonator";
    const count = document.createElement("strong");
    count.textContent = `${Math.max(0, limit - used)} / ${limit} left`;
    bombBustersDetonatorEl.dataset.bombBustersTip = `Detonator: ${used} of ${limit} mistakes used. A red wire explodes the bomb immediately.`;
    heading.append(title, count);
    const track = document.createElement("div");
    track.className = "bomb-busters-detonator-track";
    track.setAttribute("aria-hidden", "true");
    for (let index = 0; index < limit; index += 1) {
      const segment = document.createElement("span");
      segment.className = index < used ? "is-spent" : "is-safe";
      segment.textContent = index < used ? "⚠️" : "●";
      track.appendChild(segment);
    }
    bombBustersDetonatorEl.append(heading, track);
  }

  function bombBustersRenderMarkers(view) {
    if (!bombBustersMarkersEl) return;
    bombBustersMarkersEl.innerHTML = "";
    const groups = [
      ["yellow", "🟡"],
      ["red", "🔴"],
    ];
    groups.forEach(([kind, emoji]) => {
      const row = document.createElement("div");
      row.className = "bomb-busters-marker-row";
      const label = document.createElement("strong");
      label.textContent = emoji;
      label.setAttribute("aria-label", `${kind} markers`);
      const values = document.createElement("span");
      const markers = view.public_color_markers && view.public_color_markers[kind] || [];
      values.textContent = markers.length ? markers.map((marker) => marker.sort_label).join(" · ") : "None in play";
      row.dataset.bombBustersTip = `${kind === "yellow" ? "Yellow" : "Red"} sorting positions: ${values.textContent}. These do not identify a rack or owner.`;
      row.append(label, values);
      bombBustersMarkersEl.appendChild(row);
    });
  }

  function bombBustersRenderValidation(view) {
    if (!bombBustersValidationEl) return;
    const inPlayValues = Object.values(view.in_play_blue_counts || {}).filter((count) => Number(count) > 0).length;
    const completedValues = Object.values(view.validation_complete || {}).filter(Boolean).length;
    if (bombBustersValidationSummaryEl) bombBustersValidationSummaryEl.textContent = `${completedValues} / ${inPlayValues}`;
    bombBustersValidationEl.innerHTML = "";
    for (let value = 1; value <= 12; value += 1) {
      const key = String(value);
      const inPlay = Number(view.in_play_blue_counts && view.in_play_blue_counts[key] || 0);
      const cut = Number(view.cut_blue_counts && view.cut_blue_counts[key] || 0);
      const complete = Boolean(view.validation_complete && view.validation_complete[key]);
      const cell = document.createElement("span");
      cell.dataset.bombBustersExplain = "validation";
      cell.dataset.bombBustersTip = inPlay
        ? `Blue ${value}: ${cut} of ${inPlay} wires cut.${complete ? " Validated." : " Cut every copy to validate this number."}`
        : `Blue ${value} is not included in this practice setup.`;
      cell.className = "bomb-busters-validation-cell";
      if (!inPlay) cell.classList.add("is-out");
      if (complete) cell.classList.add("is-complete");
      cell.textContent = inPlay ? `${complete ? "✅" : "🔵"} ${value} · ${cut}/${inPlay}` : `${value} · N/A`;
      bombBustersValidationEl.appendChild(cell);
    }
  }

  function bombBustersRenderActivity(view) {
    if (!bombBustersActivityEl) return;
    bombBustersActivityEl.innerHTML = "";
    const activity = view.public_activity || [];
    if (bombBustersActivityCountEl) bombBustersActivityCountEl.textContent = `${activity.length} action${activity.length === 1 ? "" : "s"}`;
    if (!activity.length) {
      bombBustersActivityEl.textContent = "No actions yet.";
      return;
    }
    activity.slice().reverse().forEach((item) => {
      const row = document.createElement("div");
      row.className = "bomb-busters-activity-row";
      row.textContent = item.message || "Team action completed.";
      bombBustersActivityEl.appendChild(row);
    });
  }

  function bombBustersRenderSoloOptions(view) {
    if (!bombBustersSoloOptionsEl) return;
    bombBustersSoloOptionsEl.innerHTML = "";
    if (view.phase !== "playing" || view.current_turn !== view.you) return;
    (view.legal_solo_sets || []).forEach((wireIds) => {
      const first = bombBustersFindWire(view, wireIds[0]);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bomb-busters-solo-option";
      button.dataset.bombBustersExplain = "solo";
      button.textContent = `Solo Cut ${wireIds.length} × ${bombBustersDeclarationLabel(first)}`;
      button.disabled = bombBustersPendingAction;
      if (
        bombBustersSelectedSoloWireIds.length === wireIds.length &&
        wireIds.every((wireId) => bombBustersSelectedSoloWireIds.includes(wireId))
      ) {
        button.classList.add("is-selected");
      }
      button.addEventListener("click", () => {
        bombBustersActionMode = "solo";
        bombBustersSelectedOwnWireId = null;
        bombBustersSelectedTargetWireIds = [];
        bombBustersSelectedSoloWireIds = [...wireIds];
        bombBustersPopoverAnchorWireId = wireIds[0] || null;
        bombBustersRenderInteractive(view);
      });
      bombBustersSoloOptionsEl.appendChild(button);
    });
  }

  function bombBustersSetButtonState(button, visible, enabled) {
    if (!button) return;
    button.classList.toggle("hidden", !visible);
    button.disabled = !enabled || bombBustersPendingAction;
  }

  function bombBustersRenderActions(view) {
    if (!bombBustersActionDockEl || !bombBustersActionSummaryEl) return;
    const phase = view.phase;
    const isTurn = phase === "playing" && view.current_turn === view.you;
    const ownWire = bombBustersFindWire(view, bombBustersSelectedOwnWireId);
    const targetWires = bombBustersSelectedTargetWireIds.map((wireId) => bombBustersFindWire(view, wireId)).filter(Boolean);
    const needsAction = isTurn || (phase === "initial_info" && view.initial_info_player_id === view.you)
      || (phase === "awaiting_detector_choice" && view.current_responder_id === view.you);
    bombBustersActionDockEl.classList.toggle("hidden", !needsAction);

    bombBustersSetButtonState(bombBustersShareClueBtnEl, phase === "initial_info", bombBustersHasAction("place_initial_info") && Boolean(ownWire));
    bombBustersSetButtonState(bombBustersConfirmDuoBtnEl, isTurn && bombBustersActionMode === "duo", bombBustersHasAction("dual_cut") && Boolean(ownWire) && targetWires.length === 1);
    bombBustersSetButtonState(bombBustersDetectorBtnEl, isTurn && bombBustersActionMode !== "solo" && bombBustersHasAction("double_detector_cut"), true);
    bombBustersSetButtonState(bombBustersConfirmDetectorBtnEl, isTurn && bombBustersActionMode === "detector", bombBustersHasAction("double_detector_cut") && Boolean(ownWire) && targetWires.length === 2);
    bombBustersSetButtonState(bombBustersConfirmSoloBtnEl, isTurn && bombBustersActionMode === "solo", bombBustersHasAction("solo_cut") && [2, 4].includes(bombBustersSelectedSoloWireIds.length));
    bombBustersSetButtonState(bombBustersResolveBtnEl, phase === "awaiting_detector_choice", bombBustersHasAction("resolve_detector_choice") && targetWires.length === 1);
    bombBustersSetButtonState(bombBustersSecureRedBtnEl, isTurn && bombBustersHasAction("reveal_red_wires"), true);

    if (phase === "initial_info") {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Initial Info";
      bombBustersActionSummaryEl.textContent = ownWire
        ? `Share ${bombBustersDeclarationLabel(ownWire)} as your initial clue.`
        : view.initial_info_player_id === view.you
          ? "Choose one of your 🔵 wires to share a clue."
          : `Waiting for ${bombBustersPlayerName(view, view.initial_info_player_id)} to choose an initial clue…`;
      return;
    }
    if (phase === "awaiting_detector_choice") {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Detector Response";
      const purpose = view.pending_choice_purpose === "cut" ? "cut" : "receive an Info token";
      bombBustersActionSummaryEl.textContent = view.current_responder_id === view.you
        ? targetWires.length
          ? `Confirm slot #${Number(targetWires[0].slot_index) + 1} to ${purpose}.`
          : `Choose one highlighted wire to ${purpose}.`
        : `Waiting for ${bombBustersPlayerName(view, view.current_responder_id)} to choose a wire…`;
      return;
    }
    if (!isTurn) {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Waiting";
      bombBustersActionSummaryEl.textContent = `Waiting for ${bombBustersPlayerName(view, view.current_turn)} to act…`;
      return;
    }
    if (bombBustersActionMode === "detector") {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Double Detector";
      if (!ownWire) {
        bombBustersActionSummaryEl.textContent = "Choose one of your 🔵 wires as the detector declaration.";
      } else if (targetWires.length < 2) {
        bombBustersActionSummaryEl.textContent = `Declare ${bombBustersDeclarationLabel(ownWire)} · choose ${2 - targetWires.length} more wire${targetWires.length === 1 ? "" : "s"} on one teammate rack.`;
      } else {
        const rack = bombBustersFindRack(view, targetWires[0].wire_id);
        bombBustersActionSummaryEl.textContent = `Test ${bombBustersDeclarationLabel(ownWire)} against ${bombBustersPlayerName(view, rack.owner_id)} · ${bombBustersRackLabel(rack)} · slots ${targetWires.map((wire) => Number(wire.slot_index) + 1).join(" & ")}.`;
      }
    } else if (bombBustersActionMode === "solo") {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Solo Cut";
      const first = bombBustersFindWire(view, bombBustersSelectedSoloWireIds[0]);
      bombBustersActionSummaryEl.textContent = first
        ? `Solo Cut ${bombBustersSelectedSoloWireIds.length} × ${bombBustersDeclarationLabel(first)}.`
        : "Choose an available Solo Cut set.";
    } else {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Duo Cut";
      if (!ownWire) {
        bombBustersActionSummaryEl.textContent = "Choose one of your 🔵 or 🟡 wires.";
      } else if (!targetWires.length) {
        bombBustersActionSummaryEl.textContent = `Declare ${bombBustersDeclarationLabel(ownWire)} · choose one teammate wire.`;
      } else {
        const rack = bombBustersFindRack(view, targetWires[0].wire_id);
        bombBustersActionSummaryEl.textContent = `Cut ${bombBustersDeclarationLabel(ownWire)} with ${bombBustersPlayerName(view, rack.owner_id)} · ${bombBustersRackLabel(rack)} · slot ${Number(targetWires[0].slot_index) + 1}.`;
      }
    }
  }

  function bombBustersRenderResult(view) {
    if (!bombBustersResultEl) return;
    const show = view.phase === "mission_result" && view.last_result;
    bombBustersResultEl.classList.toggle("hidden", !show);
    if (!show) return;
    const result = view.last_result;
    const success = result.result === "success";
    bombBustersResultEl.classList.toggle("is-success", success);
    bombBustersResultEl.classList.toggle("is-failure", !success);
    if (bombBustersResultTitleEl) bombBustersResultTitleEl.textContent = success ? "Mission Defused" : "Bomb Exploded";
    const reasonLabels = {
      all_wires_cleared: "Every wire was processed safely.",
      red_wire: "A 🔴 wire triggered the bomb.",
      detonator: "The detonator ran out of safe steps.",
      priority_deadlock: "A player was left with only priority-blocked values.",
      constraint_deadlock: "The whole team was blocked by constraints.",
      special_cut: "The special identification was incorrect.",
      fatal_mistake: "This mission makes that failed cut fatal.",
      nano: "Nano reached the explosion space.",
      timer: "The mission timer expired.",
      audio_completed: "The official recording's success was confirmed.",
      audio_failed: "The official recording's failure was confirmed.",
    };
    if (bombBustersResultDetailEl) {
      const completed = (result.completed_blue_values || []).length
        ? ` Validated 🔵: ${(result.completed_blue_values || []).join(", ")}.`
        : "";
      bombBustersResultDetailEl.textContent = `${reasonLabels[result.reason] || "Mission complete."} Mistakes used: ${result.mistakes_used}.${completed}`;
    }
    if (bombBustersReadyListEl) {
      bombBustersReadyListEl.innerHTML = "";
      const ready = new Set(view.result_ready_ids || []);
      const summary = document.createElement("strong");
      summary.textContent = `Ready ${ready.size} / ${(view.players || []).length}`;
      bombBustersReadyListEl.appendChild(summary);
      (view.players || []).forEach((player) => {
        const row = document.createElement("span");
        row.textContent = `${player.name || player.player_id}: ${ready.has(player.player_id) ? "Ready ✓" : "Waiting"}`;
        bombBustersReadyListEl.appendChild(row);
      });
    }
    if (bombBustersContinueBtnEl) {
      bombBustersContinueBtnEl.textContent = view.campaign_complete ? "Campaign Complete" : success && view.campaign && view.campaign.id === 66 ? "Finish Campaign" : success ? "Next Bomb" : "Retry Mission";
      bombBustersContinueBtnEl.disabled = !bombBustersHasAction("continue_mission") || bombBustersPendingAction;
    }
  }

  function bombBustersRenderDetectorStatus(view) {
    if (!bombBustersDetectorStatusEl) return;
    const me = bombBustersFindPlayer(view, view.you);
    bombBustersDetectorStatusEl.textContent = me && me.personal_detector_used
      ? "Used for this bomb"
      : "Ready · one use this bomb";
    bombBustersDetectorStatusEl.classList.toggle("is-used", Boolean(me && me.personal_detector_used));
  }

  function bombBustersRenderStatus(view) {
    if (!bombBustersStatusEl) return;
    if (view.phase === "initial_info") {
      bombBustersStatusEl.textContent = view.initial_info_player_id === view.you
        ? "Choose an initial 🔵 clue."
        : `${bombBustersPlayerName(view, view.initial_info_player_id)} is choosing an initial clue…`;
    } else if (view.phase === "awaiting_detector_choice") {
      bombBustersStatusEl.textContent = view.current_responder_id === view.you
        ? "The Double Detector needs your private choice."
        : `Waiting for ${bombBustersPlayerName(view, view.current_responder_id)} to choose a wire…`;
    } else if (view.phase === "mission_result") {
      bombBustersStatusEl.textContent = "Review the final rack layout, then confirm when ready.";
    } else if (view.phase === "mission_setup" || view.phase === "mission_decision") {
      const decision = view.campaign && view.campaign.decision;
      bombBustersStatusEl.textContent = decision && decision.player_id === view.you
        ? "Choose the mission option shown above the racks."
        : `Waiting for ${bombBustersPlayerName(view, decision && decision.player_id)} to resolve the mission choice…`;
    } else {
      bombBustersStatusEl.textContent = view.current_turn === view.you
        ? "Your turn · choose a safe action."
        : `${bombBustersPlayerName(view, view.current_turn)} is deciding…`;
    }
  }

  function bombBustersRenderInteractive(view) {
    bombBustersHideTooltip();
    bombBustersRenderRacks(view);
    bombBustersRenderSoloOptions(view);
    bombBustersRenderActions(view);
    bombBustersRenderResult(view);
    bombBustersRenderWirePopover(view);
    bombBustersRefreshExplainTargets();
  }

  // Wrong cuts are the moment the whole table reacts, so every miss event
  // drives the shared poop splash. The effect labels the culprit itself, which
  // keeps this call identical for every viewer.
  const BOMB_BUSTERS_MISS_EVENTS = new Set([
    "bomb_busters:duo_miss",
    "bomb_busters:detector_miss",
    "bomb_busters:red_wire",
  ]);

  function bombBustersPlayMissEffect(data) {
    if (typeof window.obgPlayPoopSplash !== "function") return;
    const events = data && data.events;
    if (!Array.isArray(events) || !events.length) return;
    // Assets can load after the first state, which replays the same payload.
    const token = `${data.state_version}|${events.length}|${events[0].type}`;
    if (token === bombBustersEffectToken) return;
    bombBustersEffectToken = token;
    events.forEach((event) => {
      if (!BOMB_BUSTERS_MISS_EVENTS.has(event.type)) return;
      const playerId = (event.payload || {}).player_id;
      if (!playerId) return;
      window.obgPlayPoopSplash({
        name: bombBustersPlayerName(bombBustersView, playerId),
        caption: event.type === "bomb_busters:red_wire" ? "💥 Red wire!" : "💥 Wrong wire!",
      });
    });
  }

  function bombBustersAnnounceEvents(events) {
    if (!bombBustersLiveRegionEl || !Array.isArray(events) || !events.length) return;
    const messages = [];
    events.forEach((event) => {
      const payload = event.payload || {};
      if (event.type === "bomb_busters:spoken_info") {
        messages.push(`Spoken clue: ${payload.label === "yellow" ? "YELLOW" : `BLUE ${payload.label}`}. Remember it; no token was available.`);
      } else if (event.type === "bomb_busters:duo_miss" || event.type === "bomb_busters:detector_miss") {
        messages.push("Detonator advanced.");
      } else if (event.type === "bomb_busters:red_wire") {
        messages.push("Red wire. The bomb exploded.");
      } else if (event.type === "bomb_busters:validation_complete") {
        messages.push(`BLUE ${payload.blue_value} validated.`);
      }
    });
    if (messages.length) {
      bombBustersLiveRegionEl.textContent = "";
      window.setTimeout(() => {
        bombBustersLiveRegionEl.textContent = messages.join(" ");
      }, 20);
    }
  }

  function bombBustersRenderGameState(data) {
    const view = data && data.view;
    if (!view) return;
    const nextVersion = data.state_version;
    if (bombBustersStateVersion !== null && nextVersion !== bombBustersStateVersion) {
      bombBustersResetSelection(false);
    }
    bombBustersStateVersion = nextVersion;
    bombBustersPendingAction = false;
    if (bombBustersPendingTimer) window.clearTimeout(bombBustersPendingTimer);
    bombBustersPendingTimer = null;
    bombBustersHideTooltip();
    bombBustersView = view;
    if (typeof currentGameType !== "undefined" && currentGameType !== "bomb_busters") {
      currentGameType = "bomb_busters";
      setGamePanelVisibility("bomb_busters");
    }
    // Start the splash before the DOM work below so the table reacts at once.
    bombBustersPlayMissEffect(data);

    if (bombBustersPresetLabelEl) bombBustersPresetLabelEl.textContent = view.campaign ? "Campaign · 66 Missions" : view.practice && view.practice.name || "Core Practice";
    if (bombBustersMissionLabelEl) {
      const attempt = Number(view.attempt_number || 1);
      bombBustersMissionLabelEl.textContent = `${view.mission_number || 1}${attempt > 1 ? ` · Attempt ${attempt}` : ""}`;
    }
    if (bombBustersTurnLabelEl) {
      if (view.phase === "playing") {
        bombBustersTurnLabelEl.textContent = view.current_turn === view.you ? "Your Turn" : `${bombBustersPlayerName(view, view.current_turn)}'s turn`;
      } else if (view.phase === "initial_info") {
        bombBustersTurnLabelEl.textContent = "Initial clues";
      } else if (view.phase === "awaiting_detector_choice") {
        bombBustersTurnLabelEl.textContent = "Detector response";
      } else {
        bombBustersTurnLabelEl.textContent = "Mission review";
      }
    }
    bombBustersRenderStatus(view);
    bombBustersRenderDetonator(view);
    bombBustersRenderMarkers(view);
    bombBustersRenderValidation(view);
    bombBustersRenderDetectorStatus(view);
    bombBustersRenderActivity(view);
    if (window.bombBustersCampaignUI) {
      window.bombBustersCampaignUI.render(view, bombBustersDispatch, () => bombBustersRenderInteractive(bombBustersView), data.state_version);
    }
    bombBustersRenderInteractive(view);
    bombBustersAnnounceEvents(data.events || []);
  }

  function bombBustersClearState() {
    if (window.bombBustersCampaignUI) window.bombBustersCampaignUI.reset();
    bombBustersView = null;
    bombBustersStateVersion = null;
    bombBustersEffectToken = null;
    bombBustersPendingAction = false;
    if (bombBustersPendingTimer) window.clearTimeout(bombBustersPendingTimer);
    bombBustersPendingTimer = null;
    bombBustersResetSelection(false);
    bombBustersHideWirePopover();
    bombBustersHideTooltip();
    if (bombBustersPanelEl) {
      bombBustersPanelEl.querySelectorAll("details").forEach((details) => {
        details.open = false;
      });
    }
    bombBustersExplainWidget?.exit();
    bombBustersHelpWidget?.close();
    [bombBustersRacksEl, bombBustersValidationEl, bombBustersActivityEl, bombBustersSoloOptionsEl, bombBustersReadyListEl].forEach((element) => {
      if (element) element.innerHTML = "";
    });
    if (bombBustersStatusEl) bombBustersStatusEl.textContent = "Waiting for game state…";
    if (bombBustersResultEl) bombBustersResultEl.classList.add("hidden");
  }

  function bombBustersShowHeaderActions(show) {
    if (bombBustersHeaderActionsEl) bombBustersHeaderActionsEl.style.display = show ? "flex" : "none";
    if (!show) {
      bombBustersResetSelection(false);
      bombBustersHideWirePopover();
      bombBustersExplainWidget?.exit();
      bombBustersHelpWidget?.close();
    }
  }

  if (bombBustersShareClueBtnEl) bombBustersShareClueBtnEl.dataset.bombBustersExplain = "share";
  if (bombBustersConfirmDuoBtnEl) bombBustersConfirmDuoBtnEl.dataset.bombBustersExplain = "duo";
  if (bombBustersDetectorBtnEl) bombBustersDetectorBtnEl.dataset.bombBustersExplain = "detector";
  if (bombBustersConfirmDetectorBtnEl) bombBustersConfirmDetectorBtnEl.dataset.bombBustersExplain = "detector_confirm";
  if (bombBustersConfirmSoloBtnEl) bombBustersConfirmSoloBtnEl.dataset.bombBustersExplain = "solo";
  if (bombBustersResolveBtnEl) bombBustersResolveBtnEl.dataset.bombBustersExplain = "resolve";
  if (bombBustersSecureRedBtnEl) bombBustersSecureRedBtnEl.dataset.bombBustersExplain = "secure";
  if (bombBustersContinueBtnEl) bombBustersContinueBtnEl.dataset.bombBustersExplain = "continue";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBombBustersHelpExplain);
  } else {
    initBombBustersHelpExplain();
  }

  if (bombBustersShareClueBtnEl) {
    bombBustersShareClueBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("place_initial_info") || !bombBustersSelectedOwnWireId) return;
      bombBustersDispatch({type: "place_initial_info", wire_id: bombBustersSelectedOwnWireId});
    });
  }
  if (bombBustersConfirmDuoBtnEl) {
    bombBustersConfirmDuoBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("dual_cut") || !bombBustersSelectedOwnWireId || bombBustersSelectedTargetWireIds.length !== 1) return;
      if (!window.confirm(`${bombBustersActionSummaryEl.textContent} Confirm this cut?`)) return;
      bombBustersDispatch({
        type: "dual_cut",
        own_wire_id: bombBustersSelectedOwnWireId,
        target_wire_id: bombBustersSelectedTargetWireIds[0],
      });
    });
  }
  if (bombBustersDetectorBtnEl) {
    bombBustersDetectorBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("double_detector_cut")) return;
      bombBustersActionMode = bombBustersActionMode === "detector" ? "duo" : "detector";
      bombBustersSelectedOwnWireId = null;
      bombBustersSelectedTargetWireIds = [];
      bombBustersSelectedSoloWireIds = [];
      bombBustersRenderInteractive(bombBustersView);
    });
  }
  if (bombBustersConfirmDetectorBtnEl) {
    bombBustersConfirmDetectorBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("double_detector_cut") || !bombBustersSelectedOwnWireId || bombBustersSelectedTargetWireIds.length !== 2) return;
      if (!window.confirm(`${bombBustersActionSummaryEl.textContent} The detector will be spent. Continue?`)) return;
      bombBustersDispatch({
        type: "double_detector_cut",
        own_wire_id: bombBustersSelectedOwnWireId,
        target_wire_ids: [...bombBustersSelectedTargetWireIds],
      });
    });
  }
  if (bombBustersConfirmSoloBtnEl) {
    bombBustersConfirmSoloBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("solo_cut") || ![2, 4].includes(bombBustersSelectedSoloWireIds.length)) return;
      if (!window.confirm(`${bombBustersActionSummaryEl.textContent} Confirm this cut?`)) return;
      bombBustersDispatch({type: "solo_cut", wire_ids: [...bombBustersSelectedSoloWireIds]});
    });
  }
  if (bombBustersResolveBtnEl) {
    bombBustersResolveBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("resolve_detector_choice") || bombBustersSelectedTargetWireIds.length !== 1) return;
      bombBustersDispatch({type: "resolve_detector_choice", wire_id: bombBustersSelectedTargetWireIds[0]});
    });
  }
  if (bombBustersSecureRedBtnEl) {
    bombBustersSecureRedBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("reveal_red_wires")) return;
      if (!window.confirm("Reveal and safely secure all of your remaining RED wires?")) return;
      bombBustersDispatch({type: "reveal_red_wires"});
    });
  }
  if (bombBustersContinueBtnEl) {
    bombBustersContinueBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("continue_mission")) return;
      bombBustersDispatch({type: "continue_mission"});
    });
  }
  if (bombBustersWirePopoverConfirmBtnEl) {
    bombBustersWirePopoverConfirmBtnEl.addEventListener("click", () => {
      const selection = bombBustersSelectedAction(bombBustersView);
      if (!selection) return;
      bombBustersDispatch(selection.action);
    });
  }
  if (bombBustersWirePopoverCancelBtnEl) {
    bombBustersWirePopoverCancelBtnEl.addEventListener("click", () => bombBustersResetSelection(true));
  }

  window.addEventListener("resize", () => {
    bombBustersHideTooltip();
    if (bombBustersView) bombBustersRenderWirePopover(bombBustersView);
  });
  window.addEventListener("scroll", bombBustersScheduleWirePopoverPosition, {capture: true, passive: true});
  window.addEventListener("scroll", bombBustersHideTooltip, {capture: true, passive: true});

  if (bombBustersPanelEl) {
    bombBustersPanelEl.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse") return;
      const target = event.target.closest("[data-bomb-busters-tip]");
      if (target && !event.target.closest("button, summary")) bombBustersShowTooltip(target);
    });
    bombBustersPanelEl.addEventListener("pointerout", (event) => {
      const target = event.target.closest("[data-bomb-busters-tip]");
      if (target && !target.contains(event.relatedTarget)) bombBustersHideTooltip();
    });
    bombBustersPanelEl.addEventListener("click", (event) => {
      const target = event.target.closest("[data-bomb-busters-tip]");
      if (target && !event.target.closest("button, summary")) bombBustersShowTooltip(target, true);
    });
  }

  document.addEventListener("click", (event) => {
    if (
      bombBustersExplainMode ||
      !bombBustersView ||
      typeof currentGameType === "undefined" ||
      currentGameType !== "bomb_busters" ||
      !bombBustersPanelEl ||
      !bombBustersPanelEl.contains(event.target)
    ) return;
    const hasSelection = bombBustersSelectedOwnWireId || bombBustersSelectedTargetWireIds.length || bombBustersSelectedSoloWireIds.length;
    if (!hasSelection) return;
    if (event.target.closest("button, summary, [data-bomb-busters-tip], .bomb-busters-wire-slot, .bomb-busters-wire-popover")) return;
    bombBustersResetSelection(true);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    bombBustersHideTooltip();
    const hasSelection = bombBustersSelectedOwnWireId || bombBustersSelectedTargetWireIds.length || bombBustersSelectedSoloWireIds.length;
    if (hasSelection) bombBustersResetSelection(true);
  });

  window.clearBombBustersState = bombBustersClearState;
  window.renderBombBustersGameState = bombBustersRenderGameState;
  window.showBombBustersHeaderActions = bombBustersShowHeaderActions;
})();
