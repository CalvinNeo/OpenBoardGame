(() => {
  "use strict";

  let bohnanzaDiceView = null;
  let bohnanzaDiceSelectedIds = new Set();
  let bohnanzaDicePending = false;
  let bohnanzaDicePendingTimer = null;
  let bohnanzaDiceExplainMode = false;
  let bohnanzaDiceLastAnnounced = 0;
  let bohnanzaDiceTooltipTimer = null;
  let bohnanzaDiceTooltipTarget = null;
  let bohnanzaDiceExplainPress = null;
  let bohnanzaDiceSuppressExplainClick = false;
  let bohnanzaDiceHelpLanguage = "zh";
  let bohnanzaDiceHelpSection = "basics";
  const bohnanzaDiceModalTriggers = new WeakMap();
  const bohnanzaDiceExpandedCoverIds = new Set();

  const bohnanzaDicePanel = document.getElementById("bohnanzaDicePanel");
  const bohnanzaDiceHeaderActions = document.getElementById("bohnanzaDiceHeaderActions");
  const bohnanzaDiceHelpBtn = document.getElementById("bohnanzaDiceHelpBtn");
  const bohnanzaDiceExplainBtn = document.getElementById("bohnanzaDiceExplainBtn");
  const bohnanzaDiceHelpModal = document.getElementById("bohnanzaDiceHelpModal");
  const bohnanzaDiceExplainModal = document.getElementById("bohnanzaDiceExplainModal");
  const bohnanzaDiceHelpCloseBtn = document.getElementById("bohnanzaDiceHelpCloseBtn");
  const bohnanzaDiceExplainCloseBtn = document.getElementById("bohnanzaDiceExplainCloseBtn");
  const bohnanzaDiceHelpContent = document.getElementById("bohnanzaDiceHelpContent");
  const bohnanzaDiceExplainContent = document.getElementById("bohnanzaDiceExplainContent");
  const bohnanzaDiceTurnLabel = document.getElementById("bohnanzaDiceTurnLabel");
  const bohnanzaDicePhaseLabel = document.getElementById("bohnanzaDicePhaseLabel");
  const bohnanzaDiceDeckLabel = document.getElementById("bohnanzaDiceDeckLabel");
  const bohnanzaDiceStatus = document.getElementById("bohnanzaDiceStatus");
  const bohnanzaDiceRollHeading = document.getElementById("bohnanzaDiceRollHeading");
  const bohnanzaDiceRepeatBadge = document.getElementById("bohnanzaDiceRepeatBadge");
  const bohnanzaDiceCurrentDice = document.getElementById("bohnanzaDiceCurrentDice");
  const bohnanzaDiceFieldDice = document.getElementById("bohnanzaDiceFieldDice");
  const bohnanzaDiceFieldCount = document.getElementById("bohnanzaDiceFieldCount");
  const bohnanzaDiceRollBtn = document.getElementById("bohnanzaDiceRollBtn");
  const bohnanzaDiceSaveBtn = document.getElementById("bohnanzaDiceSaveBtn");
  const bohnanzaDiceRepeatBtn = document.getElementById("bohnanzaDiceRepeatBtn");
  const bohnanzaDiceHarvestDock = document.getElementById("bohnanzaDiceHarvestDock");
  const bohnanzaDiceHarvestPrompt = document.getElementById("bohnanzaDiceHarvestPrompt");
  const bohnanzaDiceHarvestBtn = document.getElementById("bohnanzaDiceHarvestBtn");
  const bohnanzaDiceKeepBtn = document.getElementById("bohnanzaDiceKeepBtn");
  const bohnanzaDicePlayers = document.getElementById("bohnanzaDicePlayers");
  const bohnanzaDiceFinal = document.getElementById("bohnanzaDiceFinal");
  const bohnanzaDiceFinalTitle = document.getElementById("bohnanzaDiceFinalTitle");
  const bohnanzaDiceFinalDetail = document.getElementById("bohnanzaDiceFinalDetail");
  const bohnanzaDiceReadyList = document.getElementById("bohnanzaDiceReadyList");
  const bohnanzaDicePlayAgainBtn = document.getElementById("bohnanzaDicePlayAgainBtn");
  const bohnanzaDiceActivity = document.getElementById("bohnanzaDiceActivity");
  const bohnanzaDiceLiveRegion = document.getElementById("bohnanzaDiceLiveRegion");
  const bohnanzaDiceTooltip = document.getElementById("bohnanzaDiceTooltip");
  const bohnanzaDiceHelpLanguages = document.getElementById("bohnanzaDiceHelpLanguages");
  const bohnanzaDiceHelpTabs = document.getElementById("bohnanzaDiceHelpTabs");

  const BOHNANZA_DICE_BEANS = {
    garden: { emoji: "🌱", short: "GA", label: "Garden Bean", dieTemplate: "dark" },
    red: { emoji: "🔥", short: "RE", label: "Red Bean", dieTemplate: "light" },
    soy: { emoji: "🫘", short: "SO", label: "Soy Bean", dieTemplate: "dark" },
    green: { emoji: "🥬", short: "GR", label: "Green Bean", dieTemplate: "light" },
    stink: { emoji: "💨", short: "ST", label: "Stink Bean", dieTemplate: "both" },
    blue: { emoji: "💧", short: "BL", label: "Blue Bean", dieTemplate: "both" },
  };

  const BOHNANZA_DICE_TURN_FLOW_VERSION = 2;

  const BOHNANZA_DICE_PHASES = {
    await_roll: "Awaiting roll",
    after_roll: "Choose dice",
    harvest_decision: "Harvest decision",
    turn_end_harvest: "Turn-end harvest",
    final_harvest: "Final harvest",
    game_over: "Game over",
  };

  const BOHNANZA_DICE_EXPLANATIONS = {
    dice: {
      title: "Current Roll",
      body: "Only these freshly rolled dice help non-active players. If it is your turn, select one or more to lock into the bean field.",
    },
    field: {
      title: "Bean Field",
      body: "Saved dice cannot be taken back or rerolled. When all five are here, the active player checks their current harvest card once.",
    },
    roll: {
      title: "Roll Dice",
      body: "Roll every die currently in the cup. Start with all five; after saving dice, press Roll again yourself for the remaining dice.",
    },
    save: {
      title: "Save Selected",
      body: "Lock every selected die into the field. This never rolls for you: if dice remain in the cup, press Roll when you are ready. You must select at least one.",
    },
    repeat: {
      title: "Reroll Fresh Dice",
      body: "Once per turn, reroll all dice in the Current Roll together. You cannot keep part of that fresh result. Bean Field dice stay unchanged, and the other players check the new result again.",
    },
    harvest: {
      title: "Harvest",
      body: "Cash in 3, 4, or 5 completed orders for 1, 2, or 3 coins. Your cover card becomes the new current card and a new cover is drawn.",
    },
    keep: {
      title: "Keep Growing",
      body: "Skip harvesting at this checkpoint and keep your progress. This never rolls dice; play resumes exactly where the harvest decision paused. During the final harvest this instead finishes your game without collecting these orders.",
    },
    card: {
      title: "Harvest Card",
      body: "Start with Order 1 at the bottom and work upward without skipping. A count such as 2× needs two separate dice. + joins requirements that must all match, / allows one listed bean per die, and OR separates complete alternative branches. The same roll may then be reused to check the next order.",
    },
    order: {
      title: "Order Row",
      body: "This row is one order. Complete orders from 1 upward. Counts use separate dice, + means all requirements must match, / allows one listed bean per die, and OR separates complete alternative branches.",
    },
    score: {
      title: "Bean Coins",
      body: "Each face-down harvest card is worth 1 coin. A gold 5 marker replaces five coin cards when the draw deck needs them back.",
    },
    activity: {
      title: "Harvest Log",
      body: "The server records rolls, progress, harvests, card recycling, and turn changes here. The log remains visible after the game ends.",
    },
    again: {
      title: "Play Again",
      body: "Confirm a fresh game with the same seats. Every human must confirm; bots are ready automatically.",
    },
  };

  const BOHNANZA_DICE_HELP_SECTIONS = [
    {
      id: "basics", label: "Basics",
      zh: "<h3>快速上手</h3><p><strong>如何获胜：</strong>完成订单并收获豆币，终局时豆币最多者获胜。</p><p><strong>每回合：</strong>掷出未留下的骰子，每次至少留一颗，直到五颗都进入豆田后检查自己的订单。</p><p><strong>游戏重点：</strong>你掷骰时其他人也能用本次新骰推进订单，因此要权衡继续积累与及时收获。</p><p>本作采用 2022 年修订版规则，支持 2–5 人，每张卡五条订单，任意玩家收获后达到 10 豆币便触发终局。开局随机先手，每人有一张当前卡和一张公开的预备卡。</p>",
      en: "<h3>Quick start</h3><p><strong>How you win:</strong> Complete orders and harvest bean coins to finish with the highest score.</p><p><strong>Your turn:</strong> Roll unsaved dice and save at least one each time until all five enter the field, then check your orders.</p><p><strong>The key:</strong> Other players use your fresh rolls too, so balance growing your card against harvesting now.</p><p>This is the 2022 revised edition for 2–5 players, with five orders per card and a final phase triggered by harvesting to 10 coins. The first player is random, and each player starts with a current card and a public cover card.</p>",
    },
    {
      id: "orders", label: "Orders",
      zh: "<h3>读懂条件</h3><p>从底部 #1 向上依次完成，不能跳过。<strong>2×</strong> 代表需要两颗独立骰子，<strong>+</strong> 两边的条件必须全部满足。只有完全相同的骰位会合并计数。</p><p>虚线骰位中的 <strong>/</strong> 表示每颗骰子任选列出的一个豆种，例如 2× 蓝豆/臭豆 可以用两颗蓝豆、两颗臭豆或各一颗。<strong>OR</strong> 换行分隔完整方案，只需满足其中一个方案。任意豆种(🌈 ANY)可由任何一颗骰子满足。</p><p>同一订单不能重复使用一颗骰子，但同一组结果可以继续完成后续订单。DONE 是已完成，NEXT 是下一条，LATER 是尚未解锁，PRE 是预览。绿色行表示已完成，金色行表示下一条，行末的五骰概率(🎲5)不是奖励或分数。</p><p>桌面悬停、键盘聚焦或手机轻点订单可查看完整条件，手机提示三秒后消失。Explain 后点选订单可查看该行的规则、状态与概率。</p>",
      en: "<h3>Reading conditions</h3><p>Work upward from #1 at the bottom without skipping. <strong>2×</strong> requires two separate dice, and requirements joined by <strong>+</strong> must all match. Only identical die slots are combined into counts.</p><p>A dashed slot with <strong>/</strong> allows one listed bean per die. For example, 2× Blue/Stink accepts two Blue, two Stink, or one of each. <strong>OR</strong> starts another complete branch on a new line, and either whole branch works. Any Bean (🌈 ANY) accepts any one die.</p><p>A die cannot fill two slots in the same order, but the result can be reused for later orders. DONE means complete, NEXT is the next order, LATER is locked, and PRE is a preview. Green rows are complete and the gold row is next. The fresh five-die chance (🎲5) is not a reward or score.</p><p>Hover, focus, or tap an order for its full requirements. Touch tips disappear after three seconds. Explain followed by an order shows its requirements, status, and probability.</p>",
    },
    {
      id: "dice", label: "Dice & Turn",
      zh: "<h3>骰子与回合</h3><p>两颗深骰的骰面是蓝豆(💧 BL)、花园豆(🌱 GA)、臭豆(💨 ST)两面、大豆(🫘 SO)两面。三颗浅骰的骰面是臭豆(💨 ST)、红豆(🔥 RE)、蓝豆(💧 BL)两面、绿豆(🥬 GR)两面。花园豆和绿豆是不同豆种。</p><p>订单中深底豆种只在深骰出现，浅底豆种只在浅骰出现，深浅对半底色表示两类骰子都可能出现。图标和字母缩写帮助在灰度下辨认。</p><p>其他玩家的 ROLL 卡只检查本次新掷出的骰子，已留下的豆田骰不能帮他们完成订单。掷骰者的 FIELD×5 卡只在五颗骰子全部留下后检查。PRE 卡在收获后成为当前卡之前不会推进。</p><p>每回合可用一次 Reroll 整批重掷本次新骰，不能只重掷其中一部分，豆田骰不受影响。Save 只留骰，不会自动掷骰。点空白处或按 Esc 取消选骰，不能提前结束回合。</p>",
      en: "<h3>Dice and turns</h3><p>The two dark dice have Blue Bean (💧 BL), Garden Bean (🌱 GA), two Stink Bean (💨 ST), and two Soy Bean (🫘 SO) faces. The three light dice have Stink Bean (💨 ST), Red Bean (🔥 RE), two Blue Bean (💧 BL), and two Green Bean (🥬 GR) faces. Garden and Green are different beans.</p><p>Dark-backed beans occur only on dark dice, light-backed beans only on light dice, and split-backed beans on either type. Icons and letter keys remain identifiable without colour.</p><p>Other players check their ROLL cards using only the fresh roll, never saved field dice. The roller checks their FIELD×5 card only after all five dice are saved. PRE cards cannot advance until a harvest makes them current.</p><p>Once per turn, Reroll repeats all fresh dice together without changing field dice. Save only locks dice and never rolls automatically. Click blank space or press Esc to deselect. You cannot end a turn early.</p>",
    },
    {
      id: "harvest", label: "Harvest",
      zh: "<h3>收获与终局</h3><p>完成 3/4/5 条订单时可收获 1/2/3 豆币。当前卡成为第一枚豆币(🪙)，额外豆币从牌堆获得，预备卡变为当前卡并补抽新的预备卡，规则允许时立即继续检查当前骰子。</p><p>多人可以收获时按座位顺序逐一决定，轮到本人才能操作。Keep Growing 保留进度，只跳过当前检查点，不触发掷骰。若没有剩余牌可抽，服务器会将符合条件玩家的五张单豆币卡换为一个五豆币标记(🟡 5)，洗回卡牌且不改变分数。</p><p>任意玩家收获至 10 豆币后，本次新骰并入豆田，主动玩家完成最终五骰检查，然后符合条件的玩家依次进行最后收获。豆币最多者获胜，同分并列。Play Again 需要所有真人同意，机器人自动准备。</p>",
      en: "<h3>Harvesting and the end</h3><p>At 3/4/5 completed orders, harvest 1/2/3 bean coins. The current card becomes the first bean coin (🪙) and extra coins come from the deck. The cover becomes current, a new cover is drawn, and the current dice are checked again when permitted.</p><p>Harvest choices pause the dice flow and resolve in seat order. Only the first queued player can act. Keep Growing retains progress and skips only this checkpoint without rolling. If the deck runs short, five eligible single-coin cards are exchanged for one five-coin marker (🟡 5) and shuffled back without changing the score.</p><p>After any harvest reaches 10 coins, fresh dice enter the field and the roller receives their final five-die check. Eligible players then receive a final harvest choice. The highest score wins, with shared wins for ties. Play Again needs every human to agree, while bots are ready automatically.</p>",
    },
    {
      id: "digital", label: "Digital Notes",
      zh: "<h3>数字版说明</h3><p>本作使用固定的 original-compatible-v1 自制兼容牌组，共 55 张卡，不复制商业牌面。概率按五颗骰子的全部 7,776 种等可能骰面索引结果精确计算，只代表该条订单独立匹配首掷的机会，不代表整张卡的完成概率。</p><p>只有牌堆顺序和未来骰子结果隐藏，所有玩家的两张收获卡、进度与豆币都公开。新状态会保留预备卡展开状态，失效的选骰自动清除。Esc 先关闭当前弹窗，再退出 Explain，最后取消选骰。</p>",
      en: "<h3>Digital notes</h3><p>This game uses the fixed original-compatible-v1 catalog of 55 original compatible cards, not commercial card faces. Probabilities count all 7,776 equally likely face-index results for the five dice and describe one order in isolation, not the chance of finishing a whole card.</p><p>Only deck order and future dice results are hidden. Both cards, progress, and scores are public. Updates preserve expanded covers and remove stale die selections. Esc closes the current dialog first, then exits Explain, then clears selection.</p>",
    },
  ];

  function bohnanzaDiceRenderHelp() {
    if (!bohnanzaDiceHelpContent || !bohnanzaDiceHelpTabs) return;
    bohnanzaDiceHelpTabs.innerHTML = "";
    BOHNANZA_DICE_HELP_SECTIONS.forEach((section) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.bohnanzaDiceHelpSection = section.id;
      button.textContent = section.label;
      button.setAttribute("aria-pressed", String(section.id === bohnanzaDiceHelpSection));
      bohnanzaDiceHelpTabs.appendChild(button);
    });
    const section = BOHNANZA_DICE_HELP_SECTIONS.find((entry) => entry.id === bohnanzaDiceHelpSection);
    bohnanzaDiceHelpContent.innerHTML = `<div class="bohnanza-dice-rules" lang="${bohnanzaDiceHelpLanguage === "zh" ? "zh-CN" : "en"}">${section[bohnanzaDiceHelpLanguage]}</div>`;
    bohnanzaDiceHelpContent.scrollTop = 0;
    bohnanzaDiceHelpLanguages.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.bohnanzaDiceHelpLanguage === bohnanzaDiceHelpLanguage));
    });
  }

  function bohnanzaDiceSetModal(modal, visible, returnFocus) {
    if (!modal) return;
    const wasVisible = !modal.classList.contains("hidden");
    bohnanzaDiceHideTooltip();
    if (visible) bohnanzaDiceModalTriggers.set(modal, document.activeElement);
    modal.classList.toggle("hidden", !visible);
    modal.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) {
      const focusable = modal.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (focusable) window.setTimeout(() => focusable.focus(), 0);
    } else if (wasVisible) {
      const trigger = returnFocus || bohnanzaDiceModalTriggers.get(modal);
      if (trigger && trigger.isConnected) trigger.focus();
    }
  }

  function bohnanzaDicePlayer(view, playerId) {
    return (view.players || []).find((player) => player.player_id === playerId) || null;
  }

  function bohnanzaDicePlayerName(view, playerId) {
    const player = bohnanzaDicePlayer(view, playerId);
    return (player && (player.name || player.player_id)) || playerId || "-";
  }

  function bohnanzaDiceHasAction(actionType) {
    const needsCurrentTurnFlow = ["roll", "save_dice", "repeat_roll", "harvest", "keep_growing"].includes(actionType);
    return Boolean(
      bohnanzaDiceView &&
        (!needsCurrentTurnFlow || Number(bohnanzaDiceView.turn_flow_version || 0) >= BOHNANZA_DICE_TURN_FLOW_VERSION) &&
        Array.isArray(bohnanzaDiceView.legal_actions) &&
        bohnanzaDiceView.legal_actions.includes(actionType)
    );
  }

  function bohnanzaDiceHasCurrentTurnFlow(view = bohnanzaDiceView) {
    return Boolean(view && Number(view.turn_flow_version || 0) >= BOHNANZA_DICE_TURN_FLOW_VERSION);
  }

  function bohnanzaDiceDispatch(action) {
    if (bohnanzaDicePending || typeof sendAction !== "function") return;
    bohnanzaDicePending = true;
    if (bohnanzaDicePendingTimer) window.clearTimeout(bohnanzaDicePendingTimer);
    bohnanzaDicePendingTimer = window.setTimeout(() => {
      bohnanzaDicePending = false;
      bohnanzaDicePendingTimer = null;
      if (bohnanzaDiceView) bohnanzaDiceRenderInteractive(bohnanzaDiceView);
    }, 1800);
    sendAction(action);
    if (bohnanzaDiceView) bohnanzaDiceRenderInteractive(bohnanzaDiceView);
  }

  function bohnanzaDiceBeanToken(beanId, compact = false, showDieTemplate = false) {
    const meta = BOHNANZA_DICE_BEANS[beanId] || { emoji: "?", short: "?", label: beanId || "Unknown bean" };
    const token = document.createElement("span");
    token.className = `bohnanza-dice-bean bean-${beanId}${compact ? " is-compact" : ""}`;
    if (showDieTemplate && meta.dieTemplate) token.classList.add(`is-die-${meta.dieTemplate}`);
    const dieLabel = meta.dieTemplate === "dark" ? "dark dice only" : meta.dieTemplate === "light" ? "light dice only" : "dark or light dice";
    token.title = showDieTemplate ? `${meta.label} · ${dieLabel}` : meta.label;
    token.setAttribute("aria-label", showDieTemplate ? `${meta.label}, ${dieLabel}` : meta.label);

    const emoji = document.createElement("span");
    emoji.className = "bohnanza-dice-bean-emoji";
    emoji.textContent = meta.emoji;
    emoji.setAttribute("aria-hidden", "true");
    const key = document.createElement("span");
    key.className = "bohnanza-dice-bean-key";
    key.textContent = meta.short;
    token.append(emoji, key);
    return token;
  }

  function bohnanzaDiceSlotText(slot) {
    const allowed = Array.isArray(slot && slot.allowed) ? slot.allowed : [];
    const labels = allowed.map((beanId) => (BOHNANZA_DICE_BEANS[beanId] || {}).label || beanId);
    if (allowed.length === Object.keys(BOHNANZA_DICE_BEANS).length) return "one die showing any bean";
    if (labels.length === 1) return `one ${labels[0]} die`;
    if (!labels.length) return "one matching die";
    return `one die showing one of ${labels.join(", ")}`;
  }

  function bohnanzaDiceOrderText(order) {
    return (order.alternatives || [])
      .map((alternative) => (alternative.slots || []).map(bohnanzaDiceSlotText).join(" plus "))
      .join(" OR ");
  }

  function bohnanzaDiceOrderShortText(order) {
    return (order.alternatives || [])
      .map((alternative) =>
        (alternative.slots || [])
          .map((slot) => {
            const allowed = Array.isArray(slot && slot.allowed) ? slot.allowed : [];
            const labels = allowed.map((beanId) => (BOHNANZA_DICE_BEANS[beanId] || {}).label || beanId);
            if (allowed.length === Object.keys(BOHNANZA_DICE_BEANS).length) return "Any Bean";
            if (labels.length === 1) return labels[0];
            return `(${labels.join(" / ")})`;
          })
          .join(" + ")
      )
      .join(" OR ");
  }

  function bohnanzaDiceOrderDieText(order) {
    const beanIds = [];
    (order.alternatives || []).forEach((alternative) => {
      (alternative.slots || []).forEach((slot) => {
        (slot.allowed || []).forEach((beanId) => {
          if (!beanIds.includes(beanId) && BOHNANZA_DICE_BEANS[beanId]) beanIds.push(beanId);
        });
      });
    });
    return beanIds
      .map((beanId) => {
        const meta = BOHNANZA_DICE_BEANS[beanId];
        const dieKey = meta.dieTemplate === "dark" ? "D" : meta.dieTemplate === "light" ? "L" : "D/L";
        return `${meta.short} ${dieKey}`;
      })
      .join(" · ");
  }

  function bohnanzaDiceOrderVisual(order) {
    const visual = document.createElement("div");
    visual.className = "bohnanza-dice-order-visual";
    visual.setAttribute("aria-label", `Match ${bohnanzaDiceOrderText(order)}`);
    (order.alternatives || []).forEach((alternative, alternativeIndex) => {
      const group = document.createElement("span");
      group.className = "bohnanza-dice-order-group";
      group.setAttribute("aria-hidden", "true");
      if (order.alternatives.length > 1) {
        group.classList.add("has-alternatives");
        const branch = document.createElement("span");
        branch.className = "bohnanza-dice-order-or";
        branch.textContent = alternativeIndex ? "OR" : "";
        group.appendChild(branch);
      }
      const terms = document.createElement("span");
      terms.className = "bohnanza-dice-order-terms";
      const requirements = new Map();
      (alternative.slots || []).forEach((slot) => {
        const allowed = Array.isArray(slot.allowed) ? slot.allowed : [];
        const key = [...allowed].sort().join("|");
        const requirement = requirements.get(key);
        if (requirement) requirement.count += 1;
        else requirements.set(key, { allowed, count: 1 });
      });
      [...requirements.values()].forEach(({ allowed, count }, requirementIndex) => {
        const term = document.createElement("span");
        term.className = "bohnanza-dice-order-term";
        if (requirementIndex) {
          const plus = document.createElement("span");
          plus.className = "bohnanza-dice-order-plus";
          plus.textContent = "+";
          term.appendChild(plus);
        }
        const slotEl = document.createElement("span");
        slotEl.className = "bohnanza-dice-order-slot";
        slotEl.dataset.count = String(count);
        if (count > 1) {
          const quantity = document.createElement("b");
          quantity.className = "bohnanza-dice-order-quantity";
          quantity.textContent = `${count}×`;
          slotEl.appendChild(quantity);
        }
        if (allowed.length === Object.keys(BOHNANZA_DICE_BEANS).length) {
          slotEl.classList.add("is-any");
          slotEl.append("🌈 ANY");
          term.appendChild(slotEl);
          terms.appendChild(term);
          return;
        }
        if (allowed.length > 1) {
          slotEl.classList.add("has-choice");
        }
        allowed.forEach((beanId, beanIndex) => {
          if (beanIndex) {
            const slash = document.createElement("span");
            slash.className = "bohnanza-dice-slot-or";
            slash.textContent = "/";
            slotEl.appendChild(slash);
          }
          slotEl.appendChild(bohnanzaDiceBeanToken(beanId, true, true));
        });
        term.appendChild(slotEl);
        terms.appendChild(term);
      });
      group.appendChild(terms);
      visual.appendChild(group);
    });
    return visual;
  }

  function bohnanzaDiceOrderState(kind, index, completedCount) {
    if (kind === "cover") {
      return {
        key: "preview",
        label: "PRE",
        detail: "This row belongs to the cover card. It cannot gain progress until this card becomes current after a harvest.",
      };
    }
    if (index < completedCount) {
      return { key: "complete", label: "DONE", detail: "This order is already complete." };
    }
    if (index === completedCount) {
      return { key: "next", label: "NEXT", detail: "This is the next order that can be completed." };
    }
    return {
      key: "locked",
      label: "LATER",
      detail: `Complete Order ${index} and every lower-numbered order before this one can count.`,
    };
  }

  function bohnanzaDiceOrderExplanation(order, index, state) {
    const percent = Number(order.first_roll_percent);
    const hasChoices = (order.alternatives || []).some((alternative) =>
      (alternative.slots || []).some((slot) => Array.isArray(slot.allowed) && slot.allowed.length > 1)
    );
    const hasBranches = (order.alternatives || []).length > 1;
    const symbols = ["A count such as 2× means two separate dice. + means all joined requirements must match using separate dice."];
    if (hasChoices) symbols.push("/ means one listed face.");
    if (hasBranches) symbols.push("OR means either complete group.");
    const chance = Number.isFinite(percent)
      ? `🎲5 ${percent.toFixed(percent < 10 ? 1 : 0)}% is the chance on a fresh five-die roll.`
      : "Fresh-roll chance unavailable.";
    const dieTypes = bohnanzaDiceOrderDieText(order);
    return `${state.detail} Need: ${bohnanzaDiceOrderShortText(order)}. ${dieTypes ? `Dice: ${dieTypes}. ` : ""}${symbols.join(" ")} ${chance} The same result may continue to the next order.`;
  }

  function bohnanzaDiceCard(card, completedCount, kind, checkContext = "preview", coverOwner = null) {
    const article = document.createElement("article");
    article.className = `bohnanza-dice-harvest-card is-${kind}`;
    const isCollapsibleCover = kind === "cover" && coverOwner;
    const coverExpanded = Boolean(isCollapsibleCover && bohnanzaDiceExpandedCoverIds.has(coverOwner.id));
    if (isCollapsibleCover) article.classList.toggle("is-collapsed", !coverExpanded);

    const header = document.createElement("header");
    header.dataset.bohnanzaDiceExplain = "card";
    const contextLabel = checkContext === "roll" ? "ROLL" : checkContext === "field" ? "FIELD×5" : "PRE";
    const contextExplanation = checkContext === "roll"
      ? "This card checks each fresh Current Roll while another player is rolling. Dice already saved in the Bean Field do not count."
      : checkContext === "field"
      ? "This is the roller's card. It checks once, after all five dice are saved in the Bean Field; the intermediate Current Roll does not advance it."
      : "This cover card is a preview. It does not check dice until it becomes the current card.";
    header.dataset.bohnanzaDiceExplainTitle = `${kind === "current" ? "Current" : "Cover"} Card · ${contextLabel}`;
    header.dataset.bohnanzaDiceExplainBody = `${contextExplanation} Dark-backed bean tiles occur only on dark dice, light-backed tiles only on light dice, and split tiles occur on either type.`;
    const label = document.createElement("strong");
    label.textContent = kind === "current" ? "Current card" : "Cover card";
    const headerMeta = document.createElement("span");
    headerMeta.className = "bohnanza-dice-card-meta";
    const context = document.createElement("b");
    context.className = `bohnanza-dice-card-context is-${checkContext}`;
    context.textContent = contextLabel;
    const cardKey = document.createElement("span");
    cardKey.textContent = card && card.id ? `#${String(card.id).slice(-3)}` : "-";
    headerMeta.append(context, cardKey);

    let coverToggle = null;
    let coverToggleHint = null;
    if (isCollapsibleCover) {
      coverToggle = document.createElement("button");
      coverToggle.type = "button";
      coverToggle.className = "bohnanza-dice-cover-toggle";
      coverToggleHint = document.createElement("span");
      coverToggleHint.className = "bohnanza-dice-cover-toggle-hint";
      headerMeta.appendChild(coverToggleHint);
      coverToggle.append(label, headerMeta);
      header.appendChild(coverToggle);
    } else {
      header.append(label, headerMeta);
    }

    const orders = document.createElement("ol");
    orders.className = "bohnanza-dice-orders";
    if (isCollapsibleCover) {
      orders.id = coverOwner.controlId;
      orders.hidden = !coverExpanded;
    }
    const source = card && Array.isArray(card.orders_bottom_to_top) ? card.orders_bottom_to_top : [];
    source
      .map((order, index) => ({ order, index }))
      .reverse()
      .forEach(({ order, index }) => {
        const row = document.createElement("li");
        row.className = "bohnanza-dice-order-row";
        const state = bohnanzaDiceOrderState(kind, index, completedCount);
        row.classList.add(`is-${state.key}`);
        row.dataset.bohnanzaDiceExplain = "order";
        row.dataset.bohnanzaDiceExplainTitle = `Order ${index + 1} · ${state.label}`;
        row.dataset.bohnanzaDiceExplainBody = bohnanzaDiceOrderExplanation(order, index, state);
        row.setAttribute("aria-label", `Order ${index + 1}, ${state.label}. Match ${bohnanzaDiceOrderText(order)}. Dice types: ${bohnanzaDiceOrderDieText(order)}.`);
        row.tabIndex = 0;

        const step = document.createElement("span");
        step.className = "bohnanza-dice-order-step";
        const level = document.createElement("span");
        level.className = "bohnanza-dice-order-level";
        level.textContent = `#${index + 1}`;
        const visual = bohnanzaDiceOrderVisual(order);

        const meta = document.createElement("span");
        meta.className = "bohnanza-dice-order-meta";
        const status = document.createElement("span");
        status.className = `bohnanza-dice-order-status is-${state.key}`;
        status.textContent = state.label;
        const probability = document.createElement("span");
        probability.className = "bohnanza-dice-order-probability";
        const percent = Number(order.first_roll_percent);
        const probabilityValue = document.createElement("strong");
        probabilityValue.textContent = Number.isFinite(percent) ? `${percent.toFixed(percent < 10 ? 1 : 0)}%` : "-";
        const probabilityLabel = document.createElement("span");
        probabilityLabel.textContent = "🎲5";
        probability.title = "Chance a fresh roll of all five dice satisfies this order";
        probability.append(probabilityValue, probabilityLabel);
        step.append(level, status);
        meta.appendChild(probability);
        row.append(step, visual, meta);
        orders.appendChild(row);
      });

    article.append(header, orders);
    if (isCollapsibleCover) {
      const syncCoverVisibility = (expanded) => {
        article.classList.toggle("is-collapsed", !expanded);
        orders.hidden = !expanded;
        coverToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        coverToggle.setAttribute("aria-controls", coverOwner.controlId);
        coverToggle.setAttribute("aria-label", `${expanded ? "Hide" : "Show"} ${coverOwner.name}'s cover card`);
        coverToggleHint.textContent = expanded ? "Hide ▲" : "Show ▼";
        const pair = article.closest(".bohnanza-dice-card-pair");
        if (pair) pair.classList.toggle("is-cover-expanded", expanded);
      };
      syncCoverVisibility(coverExpanded);
      coverToggle.addEventListener("click", () => {
        const expanded = article.classList.contains("is-collapsed");
        if (expanded) bohnanzaDiceExpandedCoverIds.add(coverOwner.id);
        else bohnanzaDiceExpandedCoverIds.delete(coverOwner.id);
        syncCoverVisibility(expanded);
      });
    }
    return article;
  }

  function bohnanzaDiceBadge(text, className = "") {
    const badge = document.createElement("span");
    badge.className = `bohnanza-dice-badge${className ? ` ${className}` : ""}`;
    badge.textContent = text;
    return badge;
  }

  function bohnanzaDiceRenderPlayers(view) {
    if (!bohnanzaDicePlayers) return;
    bohnanzaDicePlayers.innerHTML = "";
    (view.players || []).forEach((player, playerIndex) => {
      const card = document.createElement("article");
      card.className = "bohnanza-dice-player";
      if (player.player_id === view.you) card.classList.add("is-self");
      if (player.player_id === view.active_player_id) card.classList.add("is-active");
      if ((view.harvest_queue || [])[0] === player.player_id) card.classList.add("is-deciding");
      if ((view.winner_ids || []).includes(player.player_id)) card.classList.add("is-winner");

      const heading = document.createElement("div");
      heading.className = "bohnanza-dice-player-heading";
      const identity = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = player.name || player.player_id;
      const badges = document.createElement("span");
      badges.className = "bohnanza-dice-player-badges";
      if (player.player_id === view.you) badges.appendChild(bohnanzaDiceBadge("You"));
      if (player.player_id === view.active_player_id) badges.appendChild(bohnanzaDiceBadge("Roller", "is-active"));
      if (player.is_bot) badges.appendChild(bohnanzaDiceBadge("Bot"));
      if ((view.harvest_queue || [])[0] === player.player_id) badges.appendChild(bohnanzaDiceBadge("Deciding", "is-decision"));
      identity.append(name, badges);

      const score = document.createElement("div");
      score.className = "bohnanza-dice-score";
      score.dataset.bohnanzaDiceExplain = "score";
      const scoreValue = document.createElement("strong");
      scoreValue.textContent = String(Number(player.score || 0));
      const scoreLabel = document.createElement("span");
      scoreLabel.textContent = "coins";
      score.append(scoreValue, scoreLabel);
      heading.append(identity, score);

      const cardPair = document.createElement("div");
      cardPair.className = "bohnanza-dice-card-pair";
      if (bohnanzaDiceExpandedCoverIds.has(player.player_id)) cardPair.classList.add("is-cover-expanded");
      const currentContext = player.player_id === view.active_player_id ? "field" : "roll";
      cardPair.append(
        bohnanzaDiceCard(player.top_card || {}, Number(player.completed_count || 0), "current", currentContext),
        bohnanzaDiceCard(player.cover_card || {}, 0, "cover", "preview", {
          id: player.player_id,
          name: player.name || player.player_id,
          controlId: `bohnanzaDiceCoverOrders${playerIndex}`,
        })
      );

      const footer = document.createElement("div");
      footer.className = "bohnanza-dice-player-footer";
      const progress = document.createElement("span");
      progress.textContent = `${Number(player.completed_count || 0)} / 5 orders`;
      const wallet = document.createElement("span");
      wallet.textContent = `${player.five_coin_marker ? "🟡 5 + " : ""}🂠 ${Number(player.single_coin_count || 0)}`;
      wallet.title = player.five_coin_marker ? "One 5-coin marker plus single coin cards" : "Single coin cards";
      footer.append(progress, wallet);
      card.append(heading, cardPair, footer);
      bohnanzaDicePlayers.appendChild(card);
    });
  }

  function bohnanzaDiceDie(die, selectable) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `bohnanza-dice-die is-${die.template} bean-${die.face}`;
    button.dataset.bohnanzaDiceExplain = "dice";
    const selected = bohnanzaDiceSelectedIds.has(die.id);
    if (selected) button.classList.add("is-selected");
    button.disabled = !selectable || bohnanzaDicePending;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    const meta = BOHNANZA_DICE_BEANS[die.face] || { label: "Unrolled", short: "-" };
    button.setAttribute("aria-label", `${die.template} die ${die.id}, ${meta.label}${selected ? ", selected" : ""}`);
    button.appendChild(bohnanzaDiceBeanToken(die.face));
    const template = document.createElement("span");
    template.className = "bohnanza-dice-die-template";
    template.textContent = die.template === "dark" ? "DARK" : "LIGHT";
    button.appendChild(template);
    button.addEventListener("click", () => {
      if (bohnanzaDiceExplainMode || button.disabled) return;
      if (bohnanzaDiceSelectedIds.has(die.id)) bohnanzaDiceSelectedIds.delete(die.id);
      else bohnanzaDiceSelectedIds.add(die.id);
      if (bohnanzaDiceView) bohnanzaDiceRenderInteractive(bohnanzaDiceView);
    });
    return button;
  }

  function bohnanzaDiceEmptySlot(label) {
    const slot = document.createElement("span");
    slot.className = "bohnanza-dice-empty-slot";
    slot.textContent = "·";
    slot.setAttribute("aria-label", label);
    return slot;
  }

  function bohnanzaDiceMobileLane(dice, current, field, selectable) {
    const lane = document.createElement("div");
    lane.className = "bohnanza-dice-mobile-lane";
    lane.setAttribute("aria-label", field.length
      ? "Turn dice. Locked dice are before the divider; fresh dice are after it."
      : "Turn dice.");

    field.forEach((die) => {
      const locked = bohnanzaDiceDie(die, false);
      locked.classList.add("is-mobile-locked");
      locked.title = "Locked in the Bean Field";
      locked.setAttribute("aria-label", `${locked.getAttribute("aria-label")}, locked in the Bean Field`);
      lane.appendChild(locked);
    });

    const cup = dice.filter((die) => die.zone === "cup");
    if (field.length && (current.length || cup.length)) {
      const divider = document.createElement("span");
      divider.className = "bohnanza-dice-mobile-divider";
      divider.setAttribute("aria-hidden", "true");
      lane.appendChild(divider);
    }

    current.forEach((die) => {
      const fresh = bohnanzaDiceDie(die, selectable);
      fresh.classList.add("is-mobile-fresh");
      lane.appendChild(fresh);
    });
    cup.forEach((die) => {
      const empty = bohnanzaDiceEmptySlot(`${die.template} die ${die.id}, ready in the cup`);
      empty.classList.add("is-mobile-cup");
      lane.appendChild(empty);
    });
    return lane;
  }

  function bohnanzaDiceRenderDice(view) {
    const dice = Array.isArray(view.dice) ? view.dice : [];
    const current = dice.filter((die) => die.zone === "current_roll");
    const field = dice.filter((die) => die.zone === "bean_field");
    const selectable = bohnanzaDiceHasAction("save_dice");
    const legalIds = new Set(view.selectable_die_ids || []);
    bohnanzaDiceSelectedIds.forEach((dieId) => {
      if (!legalIds.has(dieId)) bohnanzaDiceSelectedIds.delete(dieId);
    });

    if (bohnanzaDiceCurrentDice) {
      bohnanzaDiceCurrentDice.innerHTML = "";
      const desktopRoll = document.createElement("div");
      desktopRoll.className = "bohnanza-dice-desktop-roll";
      if (current.length) current.forEach((die) => desktopRoll.appendChild(bohnanzaDiceDie(die, selectable)));
      else {
        const empty = document.createElement("div");
        empty.className = "bohnanza-dice-empty-message";
        const cupCount = dice.filter((die) => die.zone === "cup").length;
        empty.textContent = view.phase === "await_roll"
          ? `${cupCount} ${cupCount === 1 ? "die is" : "dice are"} ready in the cup.`
          : "No fresh dice are waiting.";
        desktopRoll.appendChild(empty);
      }
      bohnanzaDiceCurrentDice.append(desktopRoll, bohnanzaDiceMobileLane(dice, current, field, selectable));
    }

    if (bohnanzaDiceFieldDice) {
      bohnanzaDiceFieldDice.innerHTML = "";
      field.forEach((die) => bohnanzaDiceFieldDice.appendChild(bohnanzaDiceDie(die, false)));
      for (let index = field.length; index < 5; index += 1) {
        bohnanzaDiceFieldDice.appendChild(bohnanzaDiceEmptySlot(`Empty field slot ${index + 1}`));
      }
    }
    if (bohnanzaDiceFieldCount) bohnanzaDiceFieldCount.textContent = `${field.length} / 5`;
  }

  function bohnanzaDiceRenderActions(view) {
    const dice = Array.isArray(view.dice) ? view.dice : [];
    const cupCount = dice.filter((die) => die.zone === "cup").length;
    const currentCount = dice.filter((die) => die.zone === "current_roll").length;
    if (bohnanzaDiceRollBtn) {
      bohnanzaDiceRollBtn.disabled = !bohnanzaDiceHasAction("roll") || bohnanzaDicePending;
      bohnanzaDiceRollBtn.textContent = cupCount
        ? `Roll ${cupCount} ${cupCount === 1 ? "Die" : "Dice"}`
        : "Roll Dice";
    }
    if (bohnanzaDiceSaveBtn) {
      bohnanzaDiceSaveBtn.disabled = !bohnanzaDiceHasAction("save_dice") || !bohnanzaDiceSelectedIds.size || bohnanzaDicePending;
      bohnanzaDiceSaveBtn.textContent = bohnanzaDiceSelectedIds.size && bohnanzaDiceSelectedIds.size === currentCount
        ? "Save & Finish"
        : bohnanzaDiceSelectedIds.size
        ? `Save ${bohnanzaDiceSelectedIds.size} ${bohnanzaDiceSelectedIds.size === 1 ? "Die" : "Dice"}`
        : "Save Selected";
    }
    if (bohnanzaDiceRepeatBtn) {
      bohnanzaDiceRepeatBtn.disabled = !bohnanzaDiceHasAction("repeat_roll") || bohnanzaDicePending;
      bohnanzaDiceRepeatBtn.textContent = currentCount ? `Reroll All ${currentCount}` : "Reroll Fresh Dice";
    }
    if (bohnanzaDiceRepeatBadge) {
      bohnanzaDiceRepeatBadge.textContent = view.repeat_used ? "Reroll used" : "Reroll 1×";
      bohnanzaDiceRepeatBadge.classList.toggle("is-used", Boolean(view.repeat_used));
    }

    const offer = view.harvest_offer;
    if (bohnanzaDiceHarvestDock) bohnanzaDiceHarvestDock.classList.toggle("hidden", !offer);
    if (offer) {
      const name = bohnanzaDicePlayerName(view, offer.player_id);
      const isYou = offer.player_id === view.you;
      const activeName = bohnanzaDicePlayerName(view, view.active_player_id);
      const resumesAnotherTurn = view.decision_origin === "after_roll" && offer.player_id !== view.active_player_id;
      if (bohnanzaDiceHarvestPrompt) {
        const checkKey = view.decision_origin === "after_roll" ? `ROLL · ${activeName}` : view.decision_origin === "turn_end" ? "FIELD×5" : "FINAL";
        const activePlayer = bohnanzaDicePlayer(view, view.active_player_id);
        const resumeText = resumesAnotherTurn ? ` · ${activePlayer && activePlayer.is_bot ? "BOT" : activeName} CONTINUES` : "";
        bohnanzaDiceHarvestPrompt.textContent = `${isYou ? "YOU" : name} · ${offer.completed_count}/5 · ${offer.reward} ${offer.reward === 1 ? "COIN" : "COINS"} · ${checkKey}${resumeText}`;
      }
      if (bohnanzaDiceHarvestBtn) {
        bohnanzaDiceHarvestBtn.textContent = `Harvest ${offer.reward} ${offer.reward === 1 ? "Coin" : "Coins"}`;
        bohnanzaDiceHarvestBtn.disabled = !bohnanzaDiceHasAction("harvest") || bohnanzaDicePending;
      }
      if (bohnanzaDiceKeepBtn) {
        bohnanzaDiceKeepBtn.textContent = offer.final ? "Finish Without Harvesting" : "Keep Growing";
        bohnanzaDiceKeepBtn.disabled = !bohnanzaDiceHasAction("keep_growing") || bohnanzaDicePending;
      }
    }
  }

  function bohnanzaDiceRenderStatus(view) {
    if (!bohnanzaDiceStatus) return;
    const activeName = bohnanzaDicePlayerName(view, view.active_player_id);
    const head = (view.harvest_queue || [])[0];
    if (!view.game_over && !bohnanzaDiceHasCurrentTurnFlow(view)) {
      bohnanzaDiceStatus.textContent = "Server restart required · manual Roll / Save flow is not loaded.";
    } else if (view.game_over) {
      const winners = (view.winner_ids || []).map((id) => bohnanzaDicePlayerName(view, id));
      bohnanzaDiceStatus.textContent = winners.length
        ? `🏆 ${winners.join(" & ")} ${winners.length === 1 ? "wins" : "win"}. Final cards and scores remain on the table.`
        : "Game over. Final cards and scores remain on the table.";
    } else if (head) {
      const name = bohnanzaDicePlayerName(view, head);
      const resumesAnotherTurn = view.decision_origin === "after_roll" && head !== view.active_player_id;
      const context = view.decision_origin === "after_roll" ? `ROLL · ${activeName}` : view.decision_origin === "turn_end" ? "FIELD×5" : "FINAL";
      bohnanzaDiceStatus.textContent = head === view.you
        ? `${view.phase === "final_harvest" ? "Final decision" : "Harvest decision"} · ${context}${resumesAnotherTurn ? ` · ${activeName} continues` : ""}`
        : `Waiting for ${name}'s ${view.phase === "final_harvest" ? "final " : ""}harvest decision${(view.harvest_queue || []).includes(view.you) ? " · your choice is queued" : ""}.`;
    } else if (view.phase === "await_roll") {
      const dice = Array.isArray(view.dice) ? view.dice : [];
      const cupCount = dice.filter((die) => die.zone === "cup").length;
      const fieldCount = dice.filter((die) => die.zone === "bean_field").length;
      bohnanzaDiceStatus.textContent = view.active_player_id === view.you
        ? fieldCount
          ? `Your turn continues — roll the remaining ${cupCount} ${cupCount === 1 ? "die" : "dice"} when you are ready.`
          : "Your turn — roll all five dice."
        : `Waiting for ${activeName} to roll ${fieldCount ? `the remaining ${cupCount}` : "all five"} ${cupCount === 1 ? "die" : "dice"}.`;
    } else if (view.phase === "after_roll") {
      bohnanzaDiceStatus.textContent = view.active_player_id === view.you
        ? "Select at least one fresh die to save. Tap open space to clear your selection."
        : `${activeName} is choosing dice for the bean field.`;
    } else if (view.phase === "final_harvest") {
      bohnanzaDiceStatus.textContent = "The 10-coin threshold was reached. Final harvests are resolving.";
    } else {
      bohnanzaDiceStatus.textContent = "Waiting for the next server decision.";
    }
  }

  function bohnanzaDiceActivityText(view, item) {
    const name = bohnanzaDicePlayerName(view, item.player_id);
    if (item.type === "roll") {
      const faces = (item.dice || []).map((die) => (BOHNANZA_DICE_BEANS[die.face] || {}).short || die.face).join(" · ");
      return `${name} rolled ${faces || `${item.die_count || 0} dice`}.`;
    }
    if (item.type === "orders_advanced") return `${name} completed ${item.gained} order${item.gained === 1 ? "" : "s"} (${item.completed_count}/5).`;
    if (item.type === "dice_saved") return `${name} saved ${(item.die_ids || []).length} dice.`;
    if (item.type === "repeat_roll") return `${name} used the once-per-turn repeat.`;
    if (item.type === "harvest") return `${name} harvested ${item.reward} coin${item.reward === 1 ? "" : "s"} and now has ${item.score}.`;
    if (item.type === "keep_growing") return item.final ? `${name} finished without another harvest.` : `${name} kept growing.`;
    if (item.type === "cards_recycled") return `${name} exchanged five coin cards for a 5-coin marker; those cards returned to the deck.`;
    if (item.type === "final_phase") return `${name} reached ${item.score} coins. Final harvest began.`;
    if (item.type === "turn_started") return `${name}'s turn began.`;
    if (item.type === "game_over") return "Final harvest complete.";
    return item.message || item.type || "Game updated.";
  }

  function bohnanzaDiceRenderActivity(view) {
    if (!bohnanzaDiceActivity) return;
    bohnanzaDiceActivity.innerHTML = "";
    const activity = Array.isArray(view.activity) ? [...view.activity].reverse() : [];
    if (!activity.length) {
      bohnanzaDiceActivity.textContent = "No actions yet.";
      return;
    }
    activity.forEach((item) => {
      const row = document.createElement("div");
      row.className = "bohnanza-dice-activity-row";
      const sequence = document.createElement("span");
      sequence.textContent = `#${item.sequence}`;
      const copy = document.createElement("p");
      copy.textContent = bohnanzaDiceActivityText(view, item);
      row.append(sequence, copy);
      bohnanzaDiceActivity.appendChild(row);
    });

    const latest = activity[0];
    if (bohnanzaDiceLiveRegion && Number(latest.sequence || 0) > bohnanzaDiceLastAnnounced) {
      bohnanzaDiceLastAnnounced = Number(latest.sequence || 0);
      bohnanzaDiceLiveRegion.textContent = bohnanzaDiceActivityText(view, latest);
    }
  }

  function bohnanzaDiceRenderFinal(view) {
    if (!bohnanzaDiceFinal) return;
    bohnanzaDiceFinal.classList.toggle("hidden", !view.game_over);
    if (!view.game_over) return;
    const winners = (view.winner_ids || []).map((id) => bohnanzaDicePlayerName(view, id));
    const winningScores = (view.players || []).filter((player) => (view.winner_ids || []).includes(player.player_id)).map((player) => Number(player.score || 0));
    const score = winningScores.length ? Math.max(...winningScores) : 0;
    if (bohnanzaDiceFinalTitle) {
      bohnanzaDiceFinalTitle.textContent = winners.length
        ? `${winners.join(" & ")} ${winners.length === 1 ? "Wins" : "Win"}`
        : "Game Over";
    }
    if (bohnanzaDiceFinalDetail) {
      bohnanzaDiceFinalDetail.textContent = winners.length
        ? `${score} coins. Tied leaders share the win. Review the final table for as long as you like.`
        : "Review the final table for as long as you like.";
    }
    if (bohnanzaDiceReadyList) {
      bohnanzaDiceReadyList.innerHTML = "";
      (view.players || []).forEach((player) => {
        const ready = (view.rematch_ready || []).includes(player.player_id);
        bohnanzaDiceReadyList.appendChild(bohnanzaDiceBadge(`${ready ? "✓" : "○"} ${player.name || player.player_id}`));
      });
    }
    if (bohnanzaDicePlayAgainBtn) {
      const ready = (view.rematch_ready || []).includes(view.you);
      bohnanzaDicePlayAgainBtn.textContent = ready ? "Rematch Ready ✓" : "Play Again";
      bohnanzaDicePlayAgainBtn.disabled = !bohnanzaDiceHasAction("play_again") || bohnanzaDicePending;
    }
  }

  function bohnanzaDiceSetExplainMode(enabled) {
    bohnanzaDiceHideTooltip();
    bohnanzaDiceExplainPress = null;
    bohnanzaDiceExplainMode = Boolean(enabled);
    document.body.classList.toggle("bohnanza-dice-explain-mode", bohnanzaDiceExplainMode);
    if (bohnanzaDiceExplainBtn) bohnanzaDiceExplainBtn.setAttribute("aria-pressed", bohnanzaDiceExplainMode ? "true" : "false");
    document.querySelectorAll("[data-bohnanza-dice-explain]").forEach((element) => {
      element.classList.toggle("has-explanation", bohnanzaDiceExplainMode);
    });
  }

  function bohnanzaDiceRefreshExplainTargets() {
    if (!bohnanzaDiceExplainMode) return;
    document.querySelectorAll("[data-bohnanza-dice-explain]").forEach((element) => element.classList.add("has-explanation"));
  }

  function bohnanzaDiceShowExplanation(key, target = null) {
    const fallback = BOHNANZA_DICE_EXPLANATIONS[key];
    const customTitle = target && target.dataset ? target.dataset.bohnanzaDiceExplainTitle : "";
    const customBody = target && target.dataset ? target.dataset.bohnanzaDiceExplainBody : "";
    const explanation = {
      title: customTitle || (fallback && fallback.title),
      body: customBody || (fallback && fallback.body),
    };
    if (!explanation.title || !explanation.body || !bohnanzaDiceExplainContent) return;
    bohnanzaDiceExplainContent.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = explanation.title;
    const body = document.createElement("p");
    body.textContent = explanation.body;
    bohnanzaDiceExplainContent.append(title, body);
    bohnanzaDiceSetModal(bohnanzaDiceExplainModal, true);
  }

  function bohnanzaDiceFindDisabledExplainTarget(x, y) {
    const targets = document.querySelectorAll("button[data-bohnanza-dice-explain]:disabled");
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return target;
    }
    return null;
  }

  function bohnanzaDiceRenderInteractive(view) {
    bohnanzaDiceRenderDice(view);
    bohnanzaDiceRenderActions(view);
    bohnanzaDiceRenderStatus(view);
    bohnanzaDiceRenderFinal(view);
    bohnanzaDiceRefreshExplainTargets();
  }

  function bohnanzaDiceRenderGameState(data) {
    const view = data && data.view;
    if (!view) return;
    bohnanzaDiceHideTooltip();
    bohnanzaDiceView = view;
    bohnanzaDicePending = false;
    if (bohnanzaDicePendingTimer) window.clearTimeout(bohnanzaDicePendingTimer);
    bohnanzaDicePendingTimer = null;
    const selectable = new Set(view.selectable_die_ids || []);
    bohnanzaDiceSelectedIds.forEach((dieId) => {
      if (!selectable.has(dieId)) bohnanzaDiceSelectedIds.delete(dieId);
    });

    if (typeof currentGameType !== "undefined" && currentGameType !== "bohnanza_dice") {
      currentGameType = "bohnanza_dice";
      setGamePanelVisibility("bohnanza_dice");
    }
    if (bohnanzaDiceTurnLabel) bohnanzaDiceTurnLabel.textContent = bohnanzaDicePlayerName(view, view.active_player_id);
    if (bohnanzaDiceRollHeading) {
      const activeName = bohnanzaDicePlayerName(view, view.active_player_id);
      bohnanzaDiceRollHeading.textContent = view.active_player_id === view.you ? "Your Current Roll" : `${activeName}'s Current Roll`;
    }
    if (bohnanzaDicePhaseLabel) bohnanzaDicePhaseLabel.textContent = BOHNANZA_DICE_PHASES[view.phase] || view.phase || "-";
    if (bohnanzaDiceDeckLabel) bohnanzaDiceDeckLabel.textContent = String(Number(view.draw_deck_count || 0));
    bohnanzaDiceRenderPlayers(view);
    bohnanzaDiceRenderInteractive(view);
    bohnanzaDiceRenderActivity(view);
  }

  function bohnanzaDiceClearState() {
    bohnanzaDiceHideTooltip();
    bohnanzaDiceView = null;
    bohnanzaDiceSelectedIds.clear();
    bohnanzaDiceExpandedCoverIds.clear();
    bohnanzaDicePending = false;
    bohnanzaDiceLastAnnounced = 0;
    if (bohnanzaDicePendingTimer) window.clearTimeout(bohnanzaDicePendingTimer);
    bohnanzaDicePendingTimer = null;
    bohnanzaDiceSetExplainMode(false);
    bohnanzaDiceSetModal(bohnanzaDiceHelpModal, false);
    bohnanzaDiceSetModal(bohnanzaDiceExplainModal, false);
    [bohnanzaDiceCurrentDice, bohnanzaDiceFieldDice, bohnanzaDicePlayers, bohnanzaDiceReadyList].forEach((element) => {
      if (element) element.innerHTML = "";
    });
    if (bohnanzaDiceStatus) bohnanzaDiceStatus.textContent = "Waiting for game state…";
    if (bohnanzaDiceActivity) bohnanzaDiceActivity.textContent = "No actions yet.";
    if (bohnanzaDiceHarvestDock) bohnanzaDiceHarvestDock.classList.add("hidden");
    if (bohnanzaDiceFinal) bohnanzaDiceFinal.classList.add("hidden");
  }

  function bohnanzaDiceShowHeaderActions(show) {
    if (bohnanzaDiceHeaderActions) bohnanzaDiceHeaderActions.style.display = show ? "flex" : "none";
    if (!show) {
      bohnanzaDiceHideTooltip();
      bohnanzaDiceSelectedIds.clear();
      bohnanzaDiceSetExplainMode(false);
      bohnanzaDiceSetModal(bohnanzaDiceHelpModal, false);
      bohnanzaDiceSetModal(bohnanzaDiceExplainModal, false);
    }
  }

  function bohnanzaDiceHideTooltip() {
    if (bohnanzaDiceTooltipTimer) window.clearTimeout(bohnanzaDiceTooltipTimer);
    bohnanzaDiceTooltipTimer = null;
    if (bohnanzaDiceTooltipTarget) bohnanzaDiceTooltipTarget.removeAttribute("aria-describedby");
    bohnanzaDiceTooltipTarget = null;
    if (bohnanzaDiceTooltip) bohnanzaDiceTooltip.hidden = true;
  }

  function bohnanzaDiceShowTooltip(target, transient = false) {
    if (!bohnanzaDiceTooltip || bohnanzaDiceExplainMode || !target) return;
    bohnanzaDiceHideTooltip();
    bohnanzaDiceTooltip.textContent = target.dataset.bohnanzaDiceExplainBody;
    if (!bohnanzaDiceTooltip.textContent) return;
    bohnanzaDiceTooltipTarget = target;
    target.setAttribute("aria-describedby", "bohnanzaDiceTooltip");
    bohnanzaDiceTooltip.hidden = false;
    const anchor = target.getBoundingClientRect();
    const bounds = bohnanzaDiceTooltip.getBoundingClientRect();
    bohnanzaDiceTooltip.style.left = `${Math.max(10, Math.min(anchor.left, window.innerWidth - bounds.width - 10))}px`;
    bohnanzaDiceTooltip.style.top = `${Math.max(10, Math.min(anchor.bottom + 6, window.innerHeight - bounds.height - 10))}px`;
    if (transient) bohnanzaDiceTooltipTimer = window.setTimeout(bohnanzaDiceHideTooltip, 3000);
  }

  if (bohnanzaDicePlayers) {
    bohnanzaDicePlayers.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse") return;
      const row = event.target.closest(".bohnanza-dice-order-row");
      if (row && !row.contains(event.relatedTarget)) bohnanzaDiceShowTooltip(row);
    });
    bohnanzaDicePlayers.addEventListener("pointerout", (event) => {
      const row = event.target.closest(".bohnanza-dice-order-row");
      if (event.pointerType === "mouse" && row && !row.contains(event.relatedTarget)) bohnanzaDiceHideTooltip();
    });
    bohnanzaDicePlayers.addEventListener("focusin", (event) => {
      bohnanzaDiceShowTooltip(event.target.closest(".bohnanza-dice-order-row"));
    });
    bohnanzaDicePlayers.addEventListener("focusout", bohnanzaDiceHideTooltip);
    bohnanzaDicePlayers.addEventListener("click", (event) => {
      if (!event.target.closest("button")) bohnanzaDiceShowTooltip(event.target.closest(".bohnanza-dice-order-row"), true);
    });
  }
  window.addEventListener("scroll", bohnanzaDiceHideTooltip, true);
  window.addEventListener("resize", bohnanzaDiceHideTooltip);

  bohnanzaDiceRenderHelp();
  if (bohnanzaDiceHelpLanguages) bohnanzaDiceHelpLanguages.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bohnanza-dice-help-language]");
    if (!button) return;
    bohnanzaDiceHelpLanguage = button.dataset.bohnanzaDiceHelpLanguage;
    bohnanzaDiceRenderHelp();
  });
  if (bohnanzaDiceHelpTabs) bohnanzaDiceHelpTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bohnanza-dice-help-section]");
    if (!button) return;
    bohnanzaDiceHelpSection = button.dataset.bohnanzaDiceHelpSection;
    bohnanzaDiceRenderHelp();
    bohnanzaDiceHelpTabs.querySelector(`[data-bohnanza-dice-help-section="${bohnanzaDiceHelpSection}"]`).focus();
  });
  if (bohnanzaDiceRollBtn) bohnanzaDiceRollBtn.addEventListener("click", () => bohnanzaDiceHasAction("roll") && bohnanzaDiceDispatch({ type: "roll" }));
  if (bohnanzaDiceSaveBtn) {
    bohnanzaDiceSaveBtn.addEventListener("click", () => {
      if (!bohnanzaDiceHasAction("save_dice") || !bohnanzaDiceSelectedIds.size) return;
      const dieIds = [...bohnanzaDiceSelectedIds];
      bohnanzaDiceSelectedIds.clear();
      bohnanzaDiceDispatch({ type: "save_dice", die_ids: dieIds });
    });
  }
  if (bohnanzaDiceRepeatBtn) bohnanzaDiceRepeatBtn.addEventListener("click", () => bohnanzaDiceHasAction("repeat_roll") && bohnanzaDiceDispatch({ type: "repeat_roll" }));
  if (bohnanzaDiceHarvestBtn) bohnanzaDiceHarvestBtn.addEventListener("click", () => bohnanzaDiceHasAction("harvest") && bohnanzaDiceDispatch({ type: "harvest" }));
  if (bohnanzaDiceKeepBtn) bohnanzaDiceKeepBtn.addEventListener("click", () => bohnanzaDiceHasAction("keep_growing") && bohnanzaDiceDispatch({ type: "keep_growing" }));
  if (bohnanzaDicePlayAgainBtn) bohnanzaDicePlayAgainBtn.addEventListener("click", () => bohnanzaDiceHasAction("play_again") && bohnanzaDiceDispatch({ type: "play_again" }));
  if (bohnanzaDiceHelpBtn) bohnanzaDiceHelpBtn.addEventListener("click", () => bohnanzaDiceSetModal(bohnanzaDiceHelpModal, true));
  if (bohnanzaDiceExplainBtn) bohnanzaDiceExplainBtn.addEventListener("click", () => bohnanzaDiceSetExplainMode(!bohnanzaDiceExplainMode));
  if (bohnanzaDiceHelpCloseBtn) bohnanzaDiceHelpCloseBtn.addEventListener("click", () => bohnanzaDiceSetModal(bohnanzaDiceHelpModal, false, bohnanzaDiceHelpBtn));
  if (bohnanzaDiceExplainCloseBtn) bohnanzaDiceExplainCloseBtn.addEventListener("click", () => bohnanzaDiceSetModal(bohnanzaDiceExplainModal, false));

  [bohnanzaDiceHelpModal, bohnanzaDiceExplainModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) bohnanzaDiceSetModal(modal, false, modal === bohnanzaDiceHelpModal ? bohnanzaDiceHelpBtn : null);
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      if (bohnanzaDiceSuppressExplainClick) {
        bohnanzaDiceSuppressExplainClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!bohnanzaDiceExplainMode || typeof currentGameType === "undefined" || currentGameType !== "bohnanza_dice") return;
      const button = event.target.closest("button");
      if ([bohnanzaDiceHelpBtn, bohnanzaDiceExplainBtn, bohnanzaDiceHelpCloseBtn, bohnanzaDiceExplainCloseBtn].includes(button) || (button && button.closest("#bohnanzaDiceHelpModal, #bohnanzaDiceExplainModal"))) return;
      const target = event.target.closest("[data-bohnanza-dice-explain]");
      if (!button && (!target || !bohnanzaDicePanel || !bohnanzaDicePanel.contains(target))) return;
      event.preventDefault();
      event.stopPropagation();
      if (target && target.dataset.bohnanzaDiceExplain) {
        bohnanzaDiceShowExplanation(target.dataset.bohnanzaDiceExplain, target);
        bohnanzaDiceSetExplainMode(false);
      }
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!bohnanzaDiceExplainMode || typeof currentGameType === "undefined" || currentGameType !== "bohnanza_dice") return;
      const target = bohnanzaDiceFindDisabledExplainTarget(event.clientX, event.clientY);
      if (!target) return;
      bohnanzaDiceExplainPress = { target, id: event.pointerId, x: event.clientX, y: event.clientY };
      event.stopPropagation();
    },
    true
  );

  document.addEventListener("pointermove", (event) => {
    if (bohnanzaDiceExplainPress && Math.hypot(event.clientX - bohnanzaDiceExplainPress.x, event.clientY - bohnanzaDiceExplainPress.y) > 10) {
      bohnanzaDiceExplainPress = null;
    }
  }, true);
  document.addEventListener("pointercancel", () => { bohnanzaDiceExplainPress = null; }, true);
  document.addEventListener("pointerup", (event) => {
    const press = bohnanzaDiceExplainPress;
    bohnanzaDiceExplainPress = null;
    if (!press || press.id !== event.pointerId || !bohnanzaDiceExplainMode) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) return;
    event.preventDefault();
    event.stopPropagation();
    bohnanzaDiceSuppressExplainClick = true;
    window.setTimeout(() => { bohnanzaDiceSuppressExplainClick = false; }, 0);
    bohnanzaDiceShowExplanation(press.target.dataset.bohnanzaDiceExplain, press.target);
    bohnanzaDiceSetExplainMode(false);
  }, true);

  document.addEventListener("pointerdown", (event) => {
    if (
      bohnanzaDiceExplainMode ||
      !bohnanzaDiceSelectedIds.size ||
      typeof currentGameType === "undefined" ||
      currentGameType !== "bohnanza_dice" ||
      !bohnanzaDicePanel ||
      !bohnanzaDicePanel.contains(event.target)
    ) {
      return;
    }
    if (event.target.closest(".bohnanza-dice-die, .bohnanza-dice-actions")) return;
    bohnanzaDiceSelectedIds.clear();
    if (bohnanzaDiceView) bohnanzaDiceRenderInteractive(bohnanzaDiceView);
  });

  document.addEventListener("keydown", (event) => {
    const modal = [bohnanzaDiceExplainModal, bohnanzaDiceHelpModal].find((element) => element && !element.classList.contains("hidden"));
    if (modal && event.key === "Tab") {
      const controls = [...modal.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((element) => !element.disabled);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key !== "Escape") return;
    bohnanzaDiceHideTooltip();
    if (modal) {
      bohnanzaDiceSetModal(modal, false);
      return;
    }
    if (bohnanzaDiceExplainMode) {
      bohnanzaDiceSetExplainMode(false);
      return;
    }
    if (bohnanzaDiceSelectedIds.size) {
      bohnanzaDiceSelectedIds.clear();
      if (bohnanzaDiceView) bohnanzaDiceRenderInteractive(bohnanzaDiceView);
    }
  });

  window.clearBohnanzaDiceState = bohnanzaDiceClearState;
  window.renderBohnanzaDiceGameState = bohnanzaDiceRenderGameState;
  window.showBohnanzaDiceHeaderActions = bohnanzaDiceShowHeaderActions;
})();
