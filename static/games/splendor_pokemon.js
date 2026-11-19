const pokemonSplendorPanel = document.getElementById("pokemonSplendorPanel");
const pokemonSplendorHeaderActions = document.getElementById("pokemonSplendorHeaderActions");
const pokemonSplendorHelpBtn = document.getElementById("pokemonSplendorHelpBtn");
const pokemonSplendorExplainBtn = document.getElementById("pokemonSplendorExplainBtn");
const pokemonSplendorTokenModal = document.getElementById("pokemonSplendorTokenModal");
const pokemonSplendorTooltip = document.getElementById("pokemonSplendorTooltip");
const pokemonSplendorBaseColors = ["red", "blue", "yellow", "green", "pink"];
const pokemonSplendorColors = [...pokemonSplendorBaseColors, "purple"];
const pokemonSplendorColorLabels = { red: "Red", blue: "Blue", yellow: "Yellow", green: "Green", pink: "Pink", purple: "Master" };
const pokemonSplendorColorSymbols = { red: "🔥", blue: "💧", yellow: "⚡", green: "🌿", pink: "🌸", purple: "✦" };
const pokemonSplendorTierLabels = { lv1: "LV1", lv2: "LV2", lv3: "LV3", rare: "Rare", legendary: "Legendary" };
const pokemonSplendorMarketIds = {
  legendary: "pokemonSplendorMarketLegendary", rare: "pokemonSplendorMarketRare",
  lv3: "pokemonSplendorMarketLv3", lv2: "pokemonSplendorMarketLv2", lv1: "pokemonSplendorMarketLv1",
};
const pokemonSplendorExplanations = {
  take: {
    zh: "拿取代币。选择三种不同颜色各一枚，或者在供应区某色至少有四枚时拿同色两枚。只剩一两种颜色时拿每种一枚，大师代币(✦)不能这样拿取。",
    en: "Take one token of each of three different colors, or two of one color if at least four remain before taking them. Take every available color if fewer than three remain. Master tokens (✦) cannot be taken this way.",
  },
  deck: {
    zh: "选择 LV1、LV2 或 LV3 牌堆盲约一张，最多持有三张预约牌。若供应区还有大师代币(✦)，同时拿一枚，其他玩家看不到盲约的牌。",
    en: "Reserve a hidden card from an LV1, LV2 or LV3 deck. You may hold up to three reserved cards and gain one Master token (✦) if available. Other players cannot see a blind reservation.",
  },
  skip: {
    zh: "跳过这次可选进化(↗)，然后检查十枚代币上限并结束回合，不需要再次确认。",
    en: "Skip this optional evolution (↗), then check the ten-token limit and finish your turn. No extra confirmation is needed.",
  },
  discard: {
    zh: "选择归还超出十枚上限的代币。对话框中会显示每种代币的可用数量，归还数量正确后才能确认，也可以 Dock 后查看牌市。",
    en: "Return enough tokens to reach the ten-token limit. The dialog shows how many of each token are available and only enables confirmation for the exact excess. Dock it to inspect the market.",
  },
  cancel: { zh: "取消当前卡牌选择，不执行行动。也可以点击牌外空白或按 Escape。", en: "Cancel this card selection without taking an action. You can also click blank space or press Escape." },
};

let currentPokemonSplendorView = null;
let pokemonSplendorSelectedMarket = null;
let pokemonSplendorSelectedReserved = null;
let pokemonSplendorSelectedBase = null;
let pokemonSplendorTokenSelection = {};
let pokemonSplendorDiscardSelection = {};
let pokemonSplendorPendingAction = null;
let pokemonSplendorReserveMenu = null;
let pokemonSplendorMarketTier = "lv1";
let pokemonSplendorTooltipTimer = null;
let pokemonSplendorGesture = null;
let pokemonSplendorSuppressClick = false;
const pokemonSplendorOpenCollections = new Set();

function pokemonSplendorElement(suffix) {
  return document.getElementById(`pokemonSplendor${suffix}`);
}

function pokemonSplendorCardDisplayName(card, bilingual = false) {
  if (!card) return "—";
  const english = card.name_en || card.name || card.id || "Pokemon";
  return bilingual && card.name && card.name !== english ? `${card.name} (${english})` : card.name || english;
}

function pokemonSplendorTotalTokens(tokens) {
  return pokemonSplendorColors.reduce((total, color) => total + ((tokens || {})[color] || 0), 0);
}

function findPokemonSplendorPlayer(view, playerId) {
  return (view?.players || []).find(player => player.player_id === playerId);
}

function createPokemonSplendorIcon(symbol, className) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", className);
  icon.setAttribute("viewBox", symbol.startsWith("token-") ? "0 0 32 32" : "0 0 80 72");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const reference = document.createElementNS("http://www.w3.org/2000/svg", "use");
  reference.setAttribute("href", `/static/assets/splendor_pokemon/companions.svg?v=1#${symbol}`);
  icon.appendChild(reference);
  return icon;
}

function createPokemonSplendorColorDot(color) {
  return createPokemonSplendorIcon(`token-${pokemonSplendorColors.includes(color) ? color : "purple"}`, "pokemon-color-dot");
}

function setPokemonSplendorHint(element, text) {
  element.dataset.pokemonTooltip = text;
  element.setAttribute("aria-label", text);
}

function appendPokemonSplendorColorValue(container, color, value) {
  container.appendChild(createPokemonSplendorColorDot(color));
  const count = document.createElement("span");
  count.textContent = String(value);
  container.appendChild(count);
  setPokemonSplendorHint(container, `${pokemonSplendorColorLabels[color]} (${pokemonSplendorColorSymbols[color]}): ${value}`);
}

function pokemonSplendorResourceText(resources) {
  const values = pokemonSplendorColors.filter(color => (resources || {})[color] > 0)
    .map(color => `${pokemonSplendorColorLabels[color]} (${pokemonSplendorColorSymbols[color]}) ×${resources[color]}`);
  return values.join(", ") || "0";
}

function pokemonSplendorDescribeCard(card) {
  const name = pokemonSplendorCardDisplayName(card, true);
  const bonus = card.bonus ? `${pokemonSplendorColorLabels[card.bonus]} (${pokemonSplendorColorSymbols[card.bonus]})` : "—";
  const targets = card.evolution?.targets || [];
  const targetNames = targets.map((target, index) => {
    const chinese = card.evolution.targets_zh?.[index];
    return chinese ? `${chinese} (${target})` : target;
  }).join(" / ");
  return {
    zh: `${name}，${pokemonSplendorTierLabels[card.tier] || card.tier}。分数(★)：${card.points || 0}。永久奖励(∞)：${bonus} ×1。捕捉费用：${pokemonSplendorResourceText(card.cost)}，已有永久奖励抵扣同色费用，大师代币可以补足普通颜色。${targets.length ? `进化(↗)：${targetNames}，需要永久奖励 ${pokemonSplendorResourceText(card.evolution.requirements)}，代币不能代替。` : "没有后续进化。"}图中的元素伙伴是原创装饰，并非该宝可梦的官方形象。`,
    en: `${name}, ${pokemonSplendorTierLabels[card.tier] || card.tier}. Points (★): ${card.points || 0}. Permanent bonus (∞): ${bonus} ×1. Catch cost: ${pokemonSplendorResourceText(card.cost)}. Your bonuses reduce matching costs and Master tokens cover regular-color shortfalls.${targets.length ? ` Evolution (↗): ${targetNames}, requiring permanent bonuses ${pokemonSplendorResourceText(card.evolution.requirements)}. Tokens cannot meet these requirements.` : " No further evolution."} The elemental companion is original decorative artwork, not an official portrait of this species.`,
  };
}

function pokemonSplendorLegendHtml(language) {
  const symbols = pokemonSplendorColors.map(color => `<span class="pokemon-help-symbol"><svg class="pokemon-color-dot" viewBox="0 0 32 32" aria-hidden="true"><use href="/static/assets/splendor_pokemon/companions.svg?v=1#token-${color}"></use></svg> ${pokemonSplendorColorLabels[color]} (${pokemonSplendorColorSymbols[color]})</span>`).join(" · ");
  return language === "zh"
    ? `<p>${symbols}</p><p>六边形图标是本项目绘制的代币标记。供应数字后面的斜线表示你持有的代币数量，永久奖励(∞)后的数字是你的同色费用减免。</p><p>分数(★)在卡牌左侧，永久奖励(∞)在右侧，捕捉费用在底部，进化条件(↗)位于中间。可捕捉标记(✓)表示代币与永久奖励足够，仍需轮到自己才能执行。</p><p>关都先手标记(◆)位于玩家姓名旁，进化数量(↗)用于同分比较。卡牌上的六种元素伙伴是按奖励颜色搭配的原创装饰，不对应具体宝可梦形象，不改变卡牌规则。</p>`
    : `<p>${symbols}</p><p>The hexagonal token emblems are drawn for this project. A slash after the supply count shows your held tokens. The permanent bonus (∞) count is your matching catch discount.</p><p>Points (★) sit on the left, permanent bonuses (∞) on the right, catch costs along the bottom and evolution requirements (↗) in the middle. A catchable mark (✓) means your tokens and bonuses cover the cost, but you must still wait for your turn.</p><p>The Kanto first-player marker (◆) appears beside a player name. Evolution count (↗) breaks score ties. The six elemental companions are original decorations chosen by bonus color, not portraits of particular Pokemon, and never change a card's rules.</p>`;
}

const pokemonSplendorHelpConfig = {
  gameId: "splendor_pokemon",
  title: { zh: "璀璨宝石：宝可梦", en: "Splendor: Pokemon" },
  basic: {
    win: { zh: "有人达到十八分后完成当前轮，分数(★)最高者获胜，同分时进化(↗)次数更多者获胜。", en: "After someone reaches eighteen points, finish the current round and the highest score (★) wins, with more evolutions (↗) breaking ties." },
    turn: { zh: "每回合先拿代币、预约或捕捉一张卡，然后可进化一次，最后把持有代币控制在十枚以内。", en: "Each turn take tokens, reserve or catch one card, then optionally evolve once and finish with at most ten tokens." },
    key: { zh: "利用永久奖励(∞)降低捕捉费用，并为免费进化(↗)保留场上可用的基础形态和目标形态。", en: "Build permanent bonuses (∞) to lower catch costs and keep a base and available target ready for a free evolution (↗)." },
  },
  sections: [
    {
      id: "actions", label: { zh: "回合行动", en: "Actions" }, html: {
        zh: "<p>点击供应区或 Take Tokens 选择代币。拿三种不同普通颜色各一枚，或者在某色原有至少四枚时拿同色两枚。如果只剩一两种普通颜色，必须各拿一枚。</p><p>点选牌市卡牌后，在卡牌原处确认捕捉或预约。捕捉费用减去自己的同色永久奖励(∞)，不足的普通颜色可以用大师代币(✦)支付，而牌上明确要求的大师代币仍须照付。</p><p>最多预约三张 LV1、LV2 或 LV3 卡，可选择公开牌或 Reserve Deck 盲约，稀有和传说不能预约。供应还有大师代币(✦)时预约会拿一枚。公开牌被拿走后立即补牌。</p><p>选择不会执行行动，点击空白、Cancel 或按 Escape 可取消。需要归还多余代币时，在同一个可 Dock 的窗口选择并确认，不必来回翻页。</p>",
        en: "<p>Click the supply or Take Tokens to choose tokens. Take one of each of three different regular colors, or two of one color if at least four were present. If only one or two regular colors remain, take one of each.</p><p>Select a market card and confirm Catch or Reserve directly on that card. Permanent bonuses (∞) reduce matching catch costs. Master tokens (✦) cover regular-color shortfalls, but any explicitly required Master tokens must still be paid.</p><p>Hold up to three reserved LV1, LV2 or LV3 cards, chosen face up or hidden through Reserve Deck. Rare and Legendary cards cannot be reserved. A reservation also grants a Master token (✦) if available. Removed market cards refill immediately.</p><p>Selecting never executes an action. Click blank space, Cancel or press Escape to cancel. If you must return excess tokens, choose and confirm them in the same dockable dialog without scrolling back and forth.</p>",
      },
    },
    {
      id: "evolution", label: { zh: "进化", en: "Evolution" }, html: {
        zh: "<p>主动作后最多免费进化(↗)一次。基础形态必须在自己的已捕捉区，匹配目标必须在牌市或自己的预约区，永久奖励(∞)必须满足基础卡的进化要求。代币不计入要求，基础卡自身的奖励在进化前计入。</p><p>点选高亮基础卡与目标卡，在目标卡原处确认。若仅有一个匹配基础，会自动配对。基础卡移入已进化区，失去原有分数与奖励，再获得目标卡的分数与奖励。可以直接 Skip Evolution。</p>",
        en: "<p>After the main action, evolve (↗) at most once for free. You must have the captured base, its matching target must be in the market or your reservations, and your permanent bonuses (∞) must meet the base's requirements. Tokens do not count. The base's own bonus counts before it evolves.</p><p>Select a highlighted base and target, then confirm on the target card. A single matching base is paired automatically. The base moves to the evolved pile and loses its points and bonus, while you gain the target's points and bonus. You may instead choose Skip Evolution.</p>",
      },
    },
    { id: "symbols", label: { zh: "图标", en: "Symbols" }, html: { zh: pokemonSplendorLegendHtml("zh"), en: pokemonSplendorLegendHtml("en") } },
    {
      id: "ending", label: { zh: "上限与胜负", en: "Limit & Scoring" }, html: {
        zh: "<p>每回合结束最多持有十枚代币，含大师代币(✦)。拿取或预约会超限时，必须同时选出要归还的数量，也可以归还刚拿到的代币。</p><p>任意玩家达到十八分(★)后触发最终轮，直到先手右侧的玩家完成回合，确保所有人回合数相同。分数最高者获胜，同分时成功进化(↗)次数更多者获胜，仍相同则共享胜利。</p>",
        en: "<p>Finish every turn with at most ten tokens, including Master tokens (✦). If taking tokens or reserving would exceed the limit, select the exact excess to return as part of that action. You may return newly gained tokens.</p><p>Reaching eighteen points (★) triggers the final round. Continue until the player immediately before the first player has acted, so everyone receives the same number of turns. Highest score wins, then more successful evolutions (↗), with any remaining tie shared.</p>",
      },
    },
  ],
};

const pokemonSplendorHelp = typeof obgCreateHelp === "function" ? obgCreateHelp(pokemonSplendorHelpConfig) : null;
const pokemonSplendorExplain = typeof obgCreateExplain === "function" ? obgCreateExplain({
  gameId: "splendor_pokemon",
  attribute: "data-pokemon-splendor-explain",
  explanations: pokemonSplendorExplanations,
  button: pokemonSplendorExplainBtn,
  bypass: ["#pokemonSplendorHelpBtn", "#pokemonSplendorExplainBtn", ".obg-help-dialog", "#pokemonSplendorTokenModal .pokemon-dialog-controls"],
  onChange: active => {
    pokemonSplendorExplainBtn?.classList.toggle("active", active);
    hidePokemonSplendorTooltip();
    if (active) {
      closePokemonSplendorTokenModal();
      closePokemonSplendorReserveMenu();
    } else {
      queueMicrotask(() => {
        if (typeof currentGameType === "undefined" || currentGameType !== "splendor_pokemon") return;
        const dialog = document.querySelector(".obg-explain-dialog[open]");
        if (dialog) {
          dialog.querySelector(".obg-help-title").textContent = "Explanation";
          dialog.querySelector(".obg-help-close").textContent = "Close";
        }
      });
    }
  },
}) : null;

function showPokemonSplendorHelpModal() {
  pokemonSplendorExplain?.exit();
  hidePokemonSplendorTooltip();
  pokemonSplendorHelp?.open();
  const close = pokemonSplendorHelp?.element()?.querySelector(".obg-help-close");
  if (close) close.textContent = "Close";
  const dialog = pokemonSplendorHelp?.element();
  if (dialog && !dialog.dataset.pokemonChromeReady) {
    dialog.dataset.pokemonChromeReady = "true";
    dialog.addEventListener("click", () => {
      dialog.querySelector(".obg-help-close").textContent = "Close";
    });
  }
}

function showPokemonSplendorHeaderActions(show) {
  if (pokemonSplendorHeaderActions) pokemonSplendorHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    pokemonSplendorHelp?.close();
    pokemonSplendorExplain?.exit();
    closePokemonSplendorTokenModal();
    closePokemonSplendorReserveMenu();
    hidePokemonSplendorTooltip();
  }
}

function clearPokemonSplendorState() {
  currentPokemonSplendorView = null;
  pokemonSplendorSelectedMarket = null;
  pokemonSplendorSelectedReserved = null;
  pokemonSplendorSelectedBase = null;
  pokemonSplendorOpenCollections.clear();
  pokemonSplendorMarketTier = "lv1";
  closePokemonSplendorTokenModal();
  closePokemonSplendorReserveMenu();
  hidePokemonSplendorTooltip();
  pokemonSplendorExplain?.exit();
  pokemonSplendorHelp?.close();
  ["Supply", ...Object.values(pokemonSplendorMarketIds).map(id => id.replace("pokemonSplendor", "")), "Reserved", "Captured", "Players"].forEach(suffix => {
    const container = pokemonSplendorElement(suffix);
    if (container) container.replaceChildren();
  });
  const prompt = pokemonSplendorElement("Prompt");
  if (prompt) prompt.textContent = "Waiting for the game state.";
  const captured = pokemonSplendorElement("CapturedSection");
  if (captured) captured.open = false;
}

function getPokemonSplendorSelectedMarketCard(view) {
  return pokemonSplendorSelectedMarket ? view?.market?.[pokemonSplendorSelectedMarket.tier]?.[pokemonSplendorSelectedMarket.index] : null;
}

function getPokemonSplendorSelectedReservedCard(view) {
  return pokemonSplendorSelectedReserved === null ? null : view?.your_reserved?.[pokemonSplendorSelectedReserved];
}

function findPokemonSplendorCapturedById(view, cardId) {
  return (findPokemonSplendorPlayer(view, view?.you)?.captured || []).find(card => card.id === cardId);
}

function pokemonSplendorEvolutionOptionsForTarget(view, cardId) {
  return (view.evolution_options || []).filter(option => option.target_id === cardId);
}

function findPokemonSplendorEvolutionOption(view) {
  const target = getPokemonSplendorSelectedMarketCard(view) || getPokemonSplendorSelectedReservedCard(view);
  return (view?.evolution_options || []).find(option => option.base_id === pokemonSplendorSelectedBase && option.target_id === target?.id);
}

function pokemonSplendorIsYourTurn(view = currentPokemonSplendorView) {
  return Boolean(view && !view.game_over && view.current_turn === view.you);
}

function clearPokemonSplendorSelection() {
  pokemonSplendorSelectedMarket = null;
  pokemonSplendorSelectedReserved = null;
  pokemonSplendorSelectedBase = null;
  closePokemonSplendorReserveMenu();
  if (currentPokemonSplendorView) refreshPokemonSplendorSelectionUI(currentPokemonSplendorView);
}

function createPokemonSplendorCostRow(cost) {
  const row = document.createElement("div");
  row.className = "card-cost";
  pokemonSplendorColors.filter(color => cost?.[color] > 0).forEach(color => {
    const chip = document.createElement("span");
    chip.className = "cost-chip";
    appendPokemonSplendorColorValue(chip, color, cost[color]);
    setPokemonSplendorHint(chip, `Catch cost: ${pokemonSplendorColorLabels[color]} (${pokemonSplendorColorSymbols[color]}) ×${cost[color]}`);
    row.appendChild(chip);
  });
  if (!row.childElementCount) row.append("0");
  return row;
}

function createPokemonSplendorCard(card, selected, options = {}) {
  const wrapper = document.createElement("article");
  wrapper.className = "splendor-card pokemon-card";
  if (!card) {
    wrapper.classList.add("pokemon-card-empty");
    wrapper.textContent = options.emptyLabel || "No cards";
    return wrapper;
  }
  wrapper.classList.add(`pokemon-card-tier-${card.tier}`);
  wrapper.classList.toggle("selected", selected);
  wrapper.classList.toggle("affordable", Boolean(card.affordable));
  wrapper.setAttribute("aria-label", pokemonSplendorCardDisplayName(card, true));
  const description = pokemonSplendorDescribeCard(card);
  const key = `card:${card.id}`;
  pokemonSplendorExplanations[key] = description;
  wrapper.setAttribute("data-pokemon-splendor-explain", key);
  setPokemonSplendorHint(wrapper, description.en);

  const heading = document.createElement("div");
  heading.className = "pokemon-card-heading";
  const artworkColor = card.tier === "legendary" ? "purple" : card.bonus || "green";
  heading.appendChild(createPokemonSplendorIcon(`companion-${artworkColor}`, "pokemon-companion"));
  const title = document.createElement("div");
  title.className = "card-title";
  const primary = document.createElement("strong");
  primary.textContent = pokemonSplendorCardDisplayName(card);
  title.appendChild(primary);
  if (card.name_en && card.name_en !== primary.textContent) {
    const secondary = document.createElement("span");
    secondary.textContent = card.name_en;
    title.appendChild(secondary);
  }
  heading.appendChild(title);
  wrapper.appendChild(heading);

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const points = document.createElement("span");
  points.className = "pokemon-card-points";
  points.textContent = `★ ${card.points || 0}`;
  setPokemonSplendorHint(points, `Victory points (★): ${card.points || 0}`);
  meta.appendChild(points);
  if (card.affordable) {
    const ready = document.createElement("span");
    ready.className = "pokemon-card-affordable-label";
    ready.textContent = "✓";
    setPokemonSplendorHint(ready, "Catchable (✓): your permanent bonuses and tokens cover this card's cost.");
    meta.appendChild(ready);
  }
  if (card.bonus) {
    const bonus = document.createElement("span");
    bonus.className = "pokemon-card-bonus";
    bonus.append("∞ ", createPokemonSplendorColorDot(card.bonus));
    setPokemonSplendorHint(bonus, `Permanent bonus (∞): one ${pokemonSplendorColorLabels[card.bonus]} (${pokemonSplendorColorSymbols[card.bonus]}) discount.`);
    meta.appendChild(bonus);
  }
  wrapper.appendChild(meta);

  if (card.evolution?.targets?.length) {
    const evolution = document.createElement("div");
    evolution.className = "pokemon-card-evo";
    evolution.append("↗");
    const targets = document.createElement("span");
    targets.className = "pokemon-card-evo-targets";
    targets.textContent = card.evolution.targets.map((target, index) => card.evolution.targets_zh?.[index] || target).join(" / ");
    evolution.appendChild(targets);
    const requirements = document.createElement("div");
    requirements.className = "pokemon-card-requirements";
    Object.entries(card.evolution.requirements || {}).filter(([, count]) => count > 0).forEach(([color, count]) => {
      const chip = document.createElement("span");
      chip.className = "pokemon-requirement-chip";
      appendPokemonSplendorColorValue(chip, color, count);
      requirements.appendChild(chip);
    });
    if (requirements.childElementCount) evolution.appendChild(requirements);
    setPokemonSplendorHint(evolution, `Evolution (↗): ${card.evolution.targets.join(" / ")}. Required permanent bonuses: ${pokemonSplendorResourceText(card.evolution.requirements)}. Tokens do not count.`);
    wrapper.appendChild(evolution);
  }
  wrapper.appendChild(createPokemonSplendorCostRow(card.cost));
  if (options.interactive) {
    wrapper.dataset.interactive = "true";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "pokemon-card-select-trigger";
    trigger.setAttribute("aria-label", `Select ${pokemonSplendorCardDisplayName(card, true)}`);
    trigger.setAttribute("aria-pressed", String(selected));
    trigger.setAttribute("aria-expanded", String(selected));
    trigger.addEventListener("click", options.onSelect);
    wrapper.appendChild(trigger);
  } else {
    wrapper.tabIndex = 0;
  }
  return wrapper;
}

function addPokemonSplendorCardActionLayer(cardEl, card, actions) {
  const layer = document.createElement("div");
  layer.className = "pokemon-card-action-layer";
  layer.setAttribute("role", "group");
  layer.setAttribute("aria-label", `${pokemonSplendorCardDisplayName(card)} actions`);
  const prompt = document.createElement("strong");
  prompt.className = "pokemon-card-action-prompt";
  prompt.textContent = pokemonSplendorCardDisplayName(card);
  layer.appendChild(prompt);
  const row = document.createElement("div");
  row.className = "pokemon-card-action-row";
  actions.forEach(action => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pokemon-card-action${action.primary ? " primary" : ""}`;
    button.textContent = action.label;
    button.disabled = !action.enabled;
    const key = `action:${action.type}:${card.id}`;
    pokemonSplendorExplanations[key] = {
      zh: `${action.label}：${pokemonSplendorDescribeCard(card).zh}${action.enabled ? "点击后执行这项行动。" : "当前不能执行，请检查自己的资源、预约上限或进化条件。"}`,
      en: `${action.label}: ${pokemonSplendorDescribeCard(card).en}${action.enabled ? " Confirm this action." : " Unavailable now. Check your resources, reservation limit or evolution requirements."}`,
    };
    button.setAttribute("data-pokemon-splendor-explain", key);
    button.addEventListener("click", event => {
      event.stopPropagation();
      if (!button.disabled) submitPokemonSplendorAction(action.payload);
    });
    row.appendChild(button);
  });
  layer.appendChild(row);
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "pokemon-card-action-close-hint";
  cancel.textContent = "Cancel";
  cancel.setAttribute("data-pokemon-splendor-explain", "cancel");
  cancel.addEventListener("click", event => {
    event.stopPropagation();
    clearPokemonSplendorSelection();
  });
  layer.appendChild(cancel);
  cardEl.appendChild(layer);
}

function renderPokemonSplendorCardList(container, cards, source, tier) {
  const view = currentPokemonSplendorView;
  const scroll = { top: container.scrollTop, left: container.scrollLeft };
  container.replaceChildren();
  const legal = view.legal_actions || [];
  const evolutionMode = pokemonSplendorIsYourTurn(view) && view.phase === "evolution";
  const turnMode = pokemonSplendorIsYourTurn(view) && view.phase === "turn";
  cards.forEach((card, index) => {
    const evolutionOptions = source === "captured" ? (view.evolution_options || []).filter(option => option.base_id === card.id)
      : pokemonSplendorEvolutionOptionsForTarget(view, card.id);
    if (evolutionMode && pokemonSplendorMarketTier === "evolution" && source !== "reserved" && !evolutionOptions.length) return;
    const selected = source === "market" ? pokemonSplendorSelectedMarket?.tier === tier && pokemonSplendorSelectedMarket.index === index
      : source === "reserved" ? pokemonSplendorSelectedReserved === index : pokemonSplendorSelectedBase === card.id;
    const interactive = source === "captured" ? evolutionMode && evolutionOptions.length > 0
      : turnMode || evolutionMode && evolutionOptions.length > 0;
    const wrapper = createPokemonSplendorCard(card, selected, {
      interactive,
      onSelect: () => {
        if (source === "captured") {
          pokemonSplendorSelectedBase = selected ? null : card.id;
          if (!findPokemonSplendorEvolutionOption(view)) {
            pokemonSplendorSelectedMarket = null;
            pokemonSplendorSelectedReserved = null;
          }
        } else {
          pokemonSplendorSelectedMarket = source === "market" && !selected ? { tier, index, cardId: card.id } : null;
          pokemonSplendorSelectedReserved = source === "reserved" && !selected ? index : null;
          if (evolutionMode && !selected && !evolutionOptions.some(option => option.base_id === pokemonSplendorSelectedBase)) {
            pokemonSplendorSelectedBase = evolutionOptions.length === 1 ? evolutionOptions[0].base_id : null;
          }
        }
        refreshPokemonSplendorSelectionUI(view);
        const action = pokemonSplendorPanel.querySelector(".pokemon-card-action:not(:disabled), .pokemon-card.selected .pokemon-card-select-trigger");
        action?.focus({ preventScroll: true });
      },
    });
    wrapper.classList.add(`pokemon-${source}-card`);
    if (evolutionMode) {
      wrapper.classList.toggle("pokemon-card-unavailable", !evolutionOptions.length);
      if (evolutionOptions.length) {
        wrapper.classList.add(source === "captured" ? "pokemon-evolution-base-option" : "pokemon-evolution-target-option");
        const badge = document.createElement("span");
        badge.className = "pokemon-card-evolution-label";
        badge.textContent = source === "captured" ? "↗ Ready" : "↗ Target";
        wrapper.querySelector(".card-meta").appendChild(badge);
      }
    }
    if (selected && source !== "captured") {
      const actions = [];
      if (turnMode) {
        const type = source === "market" ? "buy_market" : "buy_reserved";
        actions.push({ label: "Catch", type, primary: true, enabled: legal.includes(type) && Boolean(card.affordable),
          payload: source === "market" ? { type, tier, index } : { type, reserved_index: index } });
        if (source === "market" && ["lv1", "lv2", "lv3"].includes(tier)) {
          actions.push({ label: "Reserve", type: "reserve_market", enabled: legal.includes("reserve_market"), payload: { type: "reserve_market", tier, index } });
        }
      } else if (evolutionMode) {
        const option = findPokemonSplendorEvolutionOption(view);
        actions.push({ label: "Evolve", type: "evolve", primary: true, enabled: legal.includes("evolve") && Boolean(option),
          payload: option ? { type: "evolve", base_id: option.base_id, target_id: option.target_id } : null });
      }
      if (actions.length) addPokemonSplendorCardActionLayer(wrapper, card, actions);
    }
    container.appendChild(wrapper);
  });
  if (!container.childElementCount) {
    const emptyLabel = source === "reserved" ? "No reservations" : source === "captured" ? "No captures yet" : cards.length ? "No evolution targets" : "Deck exhausted";
    container.appendChild(createPokemonSplendorCard(null, false, { emptyLabel }));
  }
  container.scrollTop = scroll.top;
  container.scrollLeft = scroll.left;
}

function renderPokemonSplendorSupply(view) {
  const supply = pokemonSplendorElement("Supply");
  supply.replaceChildren();
  const player = findPokemonSplendorPlayer(view, view.you);
  const canTake = pokemonSplendorIsYourTurn(view) && (view.legal_actions || []).some(action => ["take_tokens", "take_tokens_same"].includes(action));
  pokemonSplendorColors.forEach(color => {
    const interactive = color !== "purple" && canTake && view.tokens_supply?.[color] > 0;
    const token = document.createElement(interactive ? "button" : "div");
    if (interactive) token.type = "button";
    token.className = "pokemon-supply-token";
    token.appendChild(createPokemonSplendorColorDot(color));
    const count = document.createElement("strong");
    count.textContent = view.tokens_supply?.[color] || 0;
    const held = document.createElement("small");
    held.textContent = `/ ${player?.tokens?.[color] || 0}${color !== "purple" && player ? ` · ∞${player.bonuses?.[color] || 0}` : ""}`;
    token.append(count, held);
    const hint = `${pokemonSplendorColorLabels[color]} (${pokemonSplendorColorSymbols[color]}): ${count.textContent} in supply / ${player?.tokens?.[color] || 0} held.${color === "purple" ? " Master tokens are wild and gained through reservations." : ` Permanent bonus (∞): ${player?.bonuses?.[color] || 0}.${interactive ? " Click to choose tokens." : ""}`}`;
    setPokemonSplendorHint(token, hint);
    const key = `supply:${color}`;
    pokemonSplendorExplanations[key] = { zh: `${hint} ${pokemonSplendorExplanations.take.zh}`, en: `${hint} ${pokemonSplendorExplanations.take.en}` };
    token.setAttribute("data-pokemon-splendor-explain", key);
    if (interactive) token.addEventListener("click", () => openPokemonSplendorTokenModal(color));
    supply.appendChild(token);
  });
}

function updatePokemonSplendorTierFilter() {
  const view = currentPokemonSplendorView;
  const ready = pokemonSplendorIsYourTurn(view) && view.phase === "evolution";
  pokemonSplendorPanel.dataset.pokemonEvolutionFilter = String(ready);
  pokemonSplendorElement("EvolutionFilter").classList.toggle("hidden", !ready);
  pokemonSplendorPanel.querySelectorAll("[data-pokemon-tier-group]").forEach(group => {
    const tier = group.dataset.pokemonTierGroup;
    const matchesEvolution = (view?.evolution_options || []).some(option => option.source === "market" && (tier === "special" ? ["rare", "legendary"].includes(option.tier) : tier === option.tier));
    group.dataset.pokemonFiltered = String(pokemonSplendorMarketTier === "evolution" ? !matchesEvolution : pokemonSplendorMarketTier !== "all" && tier !== pokemonSplendorMarketTier);
  });
  pokemonSplendorPanel.querySelectorAll("[data-pokemon-tier]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.pokemonTier === pokemonSplendorMarketTier));
  });
}

function refreshPokemonSplendorSelectionUI(view) {
  Object.entries(pokemonSplendorMarketIds).forEach(([tier, id]) => renderPokemonSplendorCardList(document.getElementById(id), view.market?.[tier] || [], "market", tier));
  renderPokemonSplendorCardList(pokemonSplendorElement("Reserved"), view.your_reserved || [], "reserved");
  const captured = findPokemonSplendorPlayer(view, view.you)?.captured || [];
  renderPokemonSplendorCardList(pokemonSplendorElement("Captured"), captured, "captured");
  pokemonSplendorElement("ReservedCount").textContent = `${view.your_reserved?.length || 0} / 3`;
  pokemonSplendorElement("CapturedCount").textContent = String(captured.length);
  pokemonSplendorElement("CapturedSection").classList.toggle("hidden", !findPokemonSplendorPlayer(view, view.you));
  updatePokemonSplendorTierFilter();
  updatePokemonSplendorPrompt(view);
  pokemonSplendorExplain?.refresh();
}

function renderPokemonSplendorPlayers(view) {
  const container = pokemonSplendorElement("Players");
  container.querySelectorAll("details[data-pokemon-player]").forEach(details => {
    if (details.open) pokemonSplendorOpenCollections.add(details.dataset.pokemonPlayer);
    else pokemonSplendorOpenCollections.delete(details.dataset.pokemonPlayer);
  });
  const scrollPositions = new Map([...container.querySelectorAll(".pokemon-player-collection")].map(collection => [collection.dataset.player, collection.scrollTop]));
  container.replaceChildren();
  const players = [...(view.players || [])];
  const ownIndex = players.findIndex(player => player.player_id === view.you);
  if (ownIndex > 0) players.push(...players.splice(0, ownIndex));
  players.forEach(player => {
    const wrapper = document.createElement("section");
    wrapper.className = "pokemon-player";
    wrapper.classList.toggle("current", player.player_id === view.current_turn);
    const header = document.createElement("div");
    header.className = "pokemon-player-header";
    const name = document.createElement("span");
    name.className = "pokemon-player-name";
    name.textContent = `${player.name || player.player_id}${player.player_id === view.you ? " (you)" : ""}`;
    setPokemonSplendorHint(name, `${player.name || player.player_id}${player.player_id === view.current_turn ? " · Current turn" : ""}`);
    header.appendChild(name);
    if (player.player_id === view.starting_player) {
      const first = document.createElement("span");
      first.className = "pokemon-first-player-badge";
      first.textContent = "◆";
      setPokemonSplendorHint(first, "Kanto first-player marker (◆): the final round ends just before this player's next turn.");
      header.appendChild(first);
    }
    const score = document.createElement("span");
    score.className = "pokemon-player-score";
    score.textContent = `★ ${player.score || 0}`;
    setPokemonSplendorHint(score, `Victory points (★): ${player.score || 0}`);
    header.appendChild(score);
    wrapper.appendChild(header);
    [["Tokens", pokemonSplendorColors, player.tokens], ["Bonuses ∞", pokemonSplendorBaseColors, player.bonuses]].forEach(([label, colors, resources]) => {
      const row = document.createElement("div");
      row.className = "pokemon-player-resources";
      const caption = document.createElement("span");
      caption.className = "pokemon-player-resource-label";
      caption.textContent = label;
      row.appendChild(caption);
      colors.forEach(color => {
        const count = document.createElement("span");
        appendPokemonSplendorColorValue(count, color, resources?.[color] || 0);
        setPokemonSplendorHint(count, `${label}: ${pokemonSplendorColorLabels[color]} (${pokemonSplendorColorSymbols[color]}) ×${resources?.[color] || 0}`);
        row.appendChild(count);
      });
      wrapper.appendChild(row);
    });
    const counts = document.createElement("div");
    counts.className = "pokemon-player-counts";
    counts.textContent = `${player.reserved_count || 0} reserved · ${player.captured_count || 0} captured · ${player.evolved_count || 0} ↗`;
    setPokemonSplendorHint(counts, `Reserved: ${player.reserved_count || 0}. Captured: ${player.captured_count || 0}. Successful evolutions (↗): ${player.evolved_count || 0}. More evolutions break score ties.`);
    wrapper.appendChild(counts);
    let capturedCollection = null;
    if (player.player_id !== view.you && player.captured?.length) {
      const details = document.createElement("details");
      details.dataset.pokemonPlayer = player.player_id;
      details.open = pokemonSplendorOpenCollections.has(player.player_id);
      const summary = document.createElement("summary");
      summary.textContent = `View ${player.captured.length} captures`;
      const collection = document.createElement("div");
      collection.className = "pokemon-player-collection";
      collection.dataset.player = player.player_id;
      player.captured.forEach(card => collection.appendChild(createPokemonSplendorCard(card, false)));
      details.append(summary, collection);
      details.addEventListener("toggle", () => {
        if (!details.isConnected) return;
        if (details.open) pokemonSplendorOpenCollections.add(player.player_id);
        else pokemonSplendorOpenCollections.delete(player.player_id);
      });
      wrapper.appendChild(details);
      capturedCollection = collection;
    }
    container.appendChild(wrapper);
    if (capturedCollection) capturedCollection.scrollTop = scrollPositions.get(player.player_id) || 0;
  });
}

function pokemonSplendorTokenGainForAction(view, action) {
  const gain = {};
  if (action.type === "take_tokens") action.colors.forEach(color => { gain[color] = 1; });
  if (action.type === "take_tokens_same") gain[action.color] = 2;
  if (["reserve_market", "reserve_deck"].includes(action.type) && view.tokens_supply?.purple > 0) gain.purple = 1;
  return gain;
}

function getPokemonSplendorPendingDiscardRequirement(view = currentPokemonSplendorView) {
  const player = findPokemonSplendorPlayer(view, view?.you);
  let action = pokemonSplendorPendingAction;
  if (!action) action = pokemonSplendorSelectedTokenAction();
  const gain = view && action ? pokemonSplendorTokenGainForAction(view, action) : {};
  const available = {};
  pokemonSplendorColors.forEach(color => { available[color] = (player?.tokens?.[color] || 0) + (gain[color] || 0); });
  return { gain, available, excess: Math.max(0, pokemonSplendorTotalTokens(available) - 10) };
}

function pokemonSplendorSelectedTokenAction() {
  const view = currentPokemonSplendorView;
  if (!view) return null;
  const picked = pokemonSplendorBaseColors.filter(color => pokemonSplendorTokenSelection[color] > 0);
  if (picked.length === 1 && pokemonSplendorTokenSelection[picked[0]] === 2 && view.tokens_supply?.[picked[0]] >= 4) {
    return { type: "take_tokens_same", color: picked[0] };
  }
  const available = pokemonSplendorBaseColors.filter(color => view.tokens_supply?.[color] > 0);
  if (picked.length > 0 && picked.length === Math.min(3, available.length) && picked.every(color => pokemonSplendorTokenSelection[color] === 1)) {
    return { type: "take_tokens", colors: picked };
  }
  return null;
}

function pokemonSplendorCanAddToken(color) {
  const view = currentPokemonSplendorView;
  const total = pokemonSplendorTotalTokens(pokemonSplendorTokenSelection);
  const current = pokemonSplendorTokenSelection[color] || 0;
  if (!view || !pokemonSplendorBaseColors.includes(color) || total >= 3 || current >= 2 || current >= (view.tokens_supply?.[color] || 0)) return false;
  if (pokemonSplendorBaseColors.some(other => pokemonSplendorTokenSelection[other] === 2)) return false;
  if (current === 1 && ((view.tokens_supply?.[color] || 0) < 4 || total !== 1)) return false;
  return true;
}

function pokemonSplendorDiscardSelectionIsValid(requirement) {
  return pokemonSplendorTotalTokens(pokemonSplendorDiscardSelection) === requirement.excess &&
    pokemonSplendorColors.every(color => (pokemonSplendorDiscardSelection[color] || 0) <= requirement.available[color]);
}

function renderPokemonSplendorDiscardSelection(requirement) {
  const container = pokemonSplendorElement("DiscardSelectionModal");
  container.replaceChildren();
  pokemonSplendorColors.forEach(color => {
    const wrapper = document.createElement("div");
    wrapper.className = "token-picker";
    wrapper.setAttribute("aria-label", `Return ${pokemonSplendorColorLabels[color]} tokens`);
    const label = document.createElement("span");
    label.className = "pokemon-discard-label";
    label.appendChild(createPokemonSplendorColorDot(color));
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `Return one fewer ${pokemonSplendorColorLabels[color]} token`);
    const selected = pokemonSplendorDiscardSelection[color] || 0;
    minus.disabled = selected === 0;
    const count = document.createElement("span");
    count.className = "pokemon-discard-count";
    count.textContent = `${selected}/${requirement.available[color]}`;
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `Return one more ${pokemonSplendorColorLabels[color]} token`);
    plus.disabled = selected >= requirement.available[color] || pokemonSplendorTotalTokens(pokemonSplendorDiscardSelection) >= requirement.excess;
    [[minus, -1], [plus, 1]].forEach(([button, delta]) => button.addEventListener("click", () => {
      pokemonSplendorDiscardSelection[color] = Math.max(0, selected + delta);
      renderPokemonSplendorTokenModal();
    }));
    wrapper.append(label, minus, count, plus);
    container.appendChild(wrapper);
  });
}

function renderPokemonSplendorTokenModal() {
  if (!pokemonSplendorTokenModal) return;
  const pending = Boolean(pokemonSplendorPendingAction);
  pokemonSplendorElement("TokenTitle").textContent = pending ? "Return Tokens" : "Take Tokens";
  pokemonSplendorElement("TokenChoices").classList.toggle("hidden", pending);
  const pool = pokemonSplendorElement("TokenPool");
  const picked = pokemonSplendorElement("TokenPicked");
  const scrollTop = pokemonSplendorTokenModal.querySelector(".modal-content").scrollTop;
  pool.replaceChildren();
  picked.replaceChildren();
  pokemonSplendorBaseColors.forEach(color => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pokemon-token-btn";
    appendPokemonSplendorColorValue(button, color, Math.max(0, (currentPokemonSplendorView?.tokens_supply?.[color] || 0) - (pokemonSplendorTokenSelection[color] || 0)));
    button.setAttribute("aria-label", `Add ${pokemonSplendorColorLabels[color]} token`);
    button.disabled = !pokemonSplendorCanAddToken(color);
    button.addEventListener("click", () => {
      if (!pokemonSplendorCanAddToken(color)) return;
      pokemonSplendorTokenSelection[color] = (pokemonSplendorTokenSelection[color] || 0) + 1;
      pokemonSplendorDiscardSelection = {};
      renderPokemonSplendorTokenModal();
    });
    pool.appendChild(button);
    for (let tokenIndex = 0; tokenIndex < (pokemonSplendorTokenSelection[color] || 0); tokenIndex += 1) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "pokemon-token-chip";
      chip.append(createPokemonSplendorColorDot(color), "−");
      chip.setAttribute("aria-label", `Remove ${pokemonSplendorColorLabels[color]} token`);
      chip.addEventListener("click", () => {
        pokemonSplendorTokenSelection[color] -= 1;
        pokemonSplendorDiscardSelection = {};
        renderPokemonSplendorTokenModal();
      });
      picked.appendChild(chip);
    }
  });
  if (!picked.childElementCount) {
    const empty = document.createElement("span");
    empty.className = "pokemon-token-empty";
    empty.textContent = "None";
    picked.appendChild(empty);
  }
  const action = pokemonSplendorSelectedTokenAction();
  const requirement = getPokemonSplendorPendingDiscardRequirement();
  const valid = pokemonSplendorDiscardSelectionIsValid(requirement);
  const hint = pokemonSplendorElement("TokenHint");
  hint.textContent = pending ? "Choose the excess tokens to return, then confirm your action." : action
    ? "Ready. Confirm your choice, or tap a picked token to remove it."
    : "Pick three different colors, or pick the same color twice.";
  hint.dataset.state = action || pending ? "ready" : "picking";
  pokemonSplendorElement("DiscardSelectionModalRow").classList.toggle("hidden", requirement.excess === 0);
  pokemonSplendorElement("DiscardHintModal").classList.toggle("hidden", requirement.excess === 0);
  pokemonSplendorElement("DiscardHintModal").textContent = `Return ${requirement.excess} to stay at 10 · ${pokemonSplendorTotalTokens(pokemonSplendorDiscardSelection)}/${requirement.excess} selected`;
  renderPokemonSplendorDiscardSelection(requirement);
  [["ConfirmThreeBtn", "take_tokens"], ["ConfirmTwoBtn", "take_tokens_same"]].forEach(([suffix, type]) => {
    const button = pokemonSplendorElement(suffix);
    button.classList.toggle("hidden", pending);
    button.disabled = !action || action.type !== type || !valid || !(currentPokemonSplendorView?.legal_actions || []).includes(type);
  });
  const confirm = pokemonSplendorElement("PendingConfirmBtn");
  confirm.classList.toggle("hidden", !pending);
  confirm.disabled = !valid;
  confirm.textContent = pokemonSplendorPendingAction?.type === "discard_tokens" ? "Return Tokens" : "Confirm Reservation";
  pokemonSplendorTokenModal.querySelector(".modal-content").scrollTop = scrollTop;
}

function openPokemonSplendorTokenModal(color, pendingAction = null) {
  if (!pokemonSplendorIsYourTurn()) return;
  closePokemonSplendorReserveMenu();
  pokemonSplendorPendingAction = pendingAction;
  pokemonSplendorTokenSelection = {};
  pokemonSplendorDiscardSelection = {};
  if (color && pokemonSplendorCanAddToken(color)) pokemonSplendorTokenSelection[color] = 1;
  renderPokemonSplendorTokenModal();
  pokemonSplendorTokenModal.classList.remove("pokemon-dialog-docked");
  pokemonSplendorElement("TokenDockBtn").textContent = "Dock";
  pokemonSplendorElement("TokenDockBtn").setAttribute("aria-pressed", "false");
  setModalVisible(pokemonSplendorTokenModal, true);
  pokemonSplendorTokenModal.querySelector(".pokemon-token-btn:not(:disabled), #pokemonSplendorTokenModalCloseBtn")?.focus({ preventScroll: true });
}

function closePokemonSplendorTokenModal() {
  if (pokemonSplendorTokenModal) {
    setModalVisible(pokemonSplendorTokenModal, false);
    pokemonSplendorTokenModal.classList.remove("pokemon-dialog-docked");
    pokemonSplendorTokenModal.setAttribute("aria-modal", "true");
  }
  pokemonSplendorPendingAction = null;
  pokemonSplendorTokenSelection = {};
  pokemonSplendorDiscardSelection = {};
}

function submitPokemonSplendorAction(action) {
  const view = currentPokemonSplendorView;
  if (!action || !pokemonSplendorIsYourTurn(view) || !(view.legal_actions || []).includes(action.type)) return;
  const player = findPokemonSplendorPlayer(view, view.you);
  const gain = pokemonSplendorTokenGainForAction(view, action);
  const excess = Math.max(0, pokemonSplendorTotalTokens(player?.tokens) + pokemonSplendorTotalTokens(gain) - 10);
  const hasReturns = action.discard || action.tokens;
  const checksLimit = ["take_tokens", "take_tokens_same", "reserve_market", "reserve_deck", "discard_tokens"].includes(action.type);
  if (checksLimit && excess > 0 && !hasReturns) {
    openPokemonSplendorTokenModal(null, action);
    return;
  }
  sendAction(action);
  closePokemonSplendorTokenModal();
  clearPokemonSplendorSelection();
}

function confirmPokemonSplendorTokenAction() {
  const action = pokemonSplendorPendingAction || pokemonSplendorSelectedTokenAction();
  const requirement = getPokemonSplendorPendingDiscardRequirement();
  if (!action || !pokemonSplendorDiscardSelectionIsValid(requirement)) return;
  const payload = { ...action };
  if (requirement.excess > 0) {
    const tokens = Object.fromEntries(Object.entries(pokemonSplendorDiscardSelection).filter(([, count]) => count > 0));
    if (payload.type === "discard_tokens") payload.tokens = tokens;
    else payload.discard = tokens;
  }
  submitPokemonSplendorAction(payload);
}

function showPokemonSplendorReserveMenu(anchor) {
  if (!pokemonSplendorReserveMenu) {
    pokemonSplendorReserveMenu = document.createElement("div");
    pokemonSplendorReserveMenu.className = "pokemon-reserve-menu hidden";
    pokemonSplendorReserveMenu.setAttribute("role", "group");
    pokemonSplendorReserveMenu.setAttribute("aria-label", "Reserve from deck");
    const title = document.createElement("div");
    title.className = "pokemon-reserve-title";
    title.textContent = "Choose a deck";
    pokemonSplendorReserveMenu.appendChild(title);
    ["lv1", "lv2", "lv3"].forEach(tier => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pokemon-reserve-option";
      button.textContent = pokemonSplendorTierLabels[tier];
      button.setAttribute("data-pokemon-splendor-explain", "deck");
      button.addEventListener("click", () => submitPokemonSplendorAction({ type: "reserve_deck", tier }));
      pokemonSplendorReserveMenu.appendChild(button);
    });
    document.body.appendChild(pokemonSplendorReserveMenu);
  }
  pokemonSplendorReserveMenu.classList.remove("hidden");
  pokemonSplendorReserveMenu.style.position = "fixed";
  const rect = anchor.getBoundingClientRect();
  const menu = pokemonSplendorReserveMenu.getBoundingClientRect();
  pokemonSplendorReserveMenu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - menu.width - 8))}px`;
  pokemonSplendorReserveMenu.style.top = `${Math.max(8, Math.min(rect.bottom + 4, innerHeight - menu.height - 8))}px`;
  pokemonSplendorReserveMenu.querySelector("button")?.focus({ preventScroll: true });
}

function closePokemonSplendorReserveMenu() {
  pokemonSplendorReserveMenu?.classList.add("hidden");
}

function updatePokemonSplendorPrompt(view) {
  const prompt = pokemonSplendorElement("Prompt");
  let text = "Choose tokens or a card.";
  let tone = "action";
  if (view.game_over) {
    text = "Game over. Review the final scores.";
    tone = "done";
  } else if (!pokemonSplendorIsYourTurn(view)) {
    text = `Waiting for ${findPokemonSplendorPlayer(view, view.current_turn)?.name || "the current player"}.`;
    tone = "waiting";
  } else if (view.phase === "evolution") {
    const option = findPokemonSplendorEvolutionOption(view);
    text = option ? "Evolution ready. Confirm on the target card." : "Choose a highlighted base and target, or skip evolution.";
  } else if (view.phase === "discard_tokens") {
    text = `Return ${getPokemonSplendorPendingDiscardRequirement(view).excess} excess tokens.`;
    tone = "warning";
  } else if (getPokemonSplendorSelectedMarketCard(view) || getPokemonSplendorSelectedReservedCard(view)) {
    text = "Confirm on the card, or tap blank space to cancel.";
  }
  prompt.textContent = text;
  prompt.dataset.tone = tone;
}

function renderPokemonSplendorGameState(data) {
  if (currentGameType !== "splendor_pokemon") return;
  if (!data.view) {
    clearPokemonSplendorState();
    return;
  }
  const view = data.view;
  const changedTurn = currentPokemonSplendorView?.current_turn !== view.current_turn || currentPokemonSplendorView?.phase !== view.phase;
  currentPokemonSplendorView = view;
  if (changedTurn) {
    pokemonSplendorSelectedMarket = null;
    pokemonSplendorSelectedReserved = null;
    pokemonSplendorSelectedBase = null;
    closePokemonSplendorTokenModal();
    closePokemonSplendorReserveMenu();
    if (pokemonSplendorMarketTier === "evolution") pokemonSplendorMarketTier = "lv1";
    if (pokemonSplendorIsYourTurn(view) && view.phase === "evolution") {
      pokemonSplendorMarketTier = "evolution";
      pokemonSplendorElement("CapturedSection").open = true;
    }
  }
  if (!pokemonSplendorIsYourTurn(view)) closePokemonSplendorTokenModal();
  if (pokemonSplendorSelectedMarket && getPokemonSplendorSelectedMarketCard(view)?.id !== pokemonSplendorSelectedMarket.cardId) pokemonSplendorSelectedMarket = null;
  if (!getPokemonSplendorSelectedReservedCard(view)) pokemonSplendorSelectedReserved = null;
  if (!findPokemonSplendorCapturedById(view, pokemonSplendorSelectedBase)) pokemonSplendorSelectedBase = null;
  const turnPlayer = findPokemonSplendorPlayer(view, view.current_turn);
  pokemonSplendorElement("Turn").textContent = turnPlayer?.name || "—";
  pokemonSplendorElement("Phase").textContent = view.game_over ? "Game over" : ({ turn: "Main action", evolution: "Evolution", discard_tokens: "Return tokens" }[view.phase] || view.phase);
  pokemonSplendorElement("FinalRound").classList.toggle("hidden", !view.final_round?.active || view.game_over);
  const winner = pokemonSplendorElement("Winner");
  winner.classList.toggle("hidden", !view.game_over);
  winner.textContent = view.game_over ? `Winner: ${(view.winner || []).map(playerId => findPokemonSplendorPlayer(view, playerId)?.name || playerId).join(", ")}` : "";
  const legal = view.legal_actions || [];
  pokemonSplendorElement("TakeTokensBtn").disabled = !pokemonSplendorIsYourTurn(view) || !legal.some(action => ["take_tokens", "take_tokens_same"].includes(action));
  pokemonSplendorElement("ReserveDeckBtn").disabled = !pokemonSplendorIsYourTurn(view) || !legal.includes("reserve_deck");
  pokemonSplendorElement("SkipEvolveBtn").classList.toggle("hidden", !pokemonSplendorIsYourTurn(view) || !legal.includes("skip_evolution"));
  pokemonSplendorElement("DiscardBtn").classList.toggle("hidden", !pokemonSplendorIsYourTurn(view) || !legal.includes("discard_tokens"));
  renderPokemonSplendorSupply(view);
  refreshPokemonSplendorSelectionUI(view);
  renderPokemonSplendorPlayers(view);
  if (!pokemonSplendorTokenModal.classList.contains("hidden")) renderPokemonSplendorTokenModal();
}

function hidePokemonSplendorTooltip() {
  clearTimeout(pokemonSplendorTooltipTimer);
  pokemonSplendorTooltip?.classList.add("hidden");
}

function showPokemonSplendorTooltip(element, temporary = false) {
  if (!pokemonSplendorTooltip || !element?.dataset.pokemonTooltip || pokemonSplendorExplain?.isActive()) return;
  hidePokemonSplendorTooltip();
  pokemonSplendorTooltip.textContent = element.dataset.pokemonTooltip;
  pokemonSplendorTooltip.classList.remove("hidden");
  const anchor = element.getBoundingClientRect();
  const box = pokemonSplendorTooltip.getBoundingClientRect();
  pokemonSplendorTooltip.style.left = `${Math.max(10, Math.min(anchor.left, innerWidth - box.width - 10))}px`;
  pokemonSplendorTooltip.style.top = `${Math.max(8, anchor.top > box.height + 12 ? anchor.top - box.height - 6 : Math.min(anchor.bottom + 6, innerHeight - box.height - 8))}px`;
  if (temporary) pokemonSplendorTooltipTimer = setTimeout(hidePokemonSplendorTooltip, 3000);
}

pokemonSplendorHelpBtn?.addEventListener("click", showPokemonSplendorHelpModal);
pokemonSplendorExplainBtn?.addEventListener("click", () => pokemonSplendorExplain?.toggle());
pokemonSplendorElement("TakeTokensBtn")?.addEventListener("click", () => openPokemonSplendorTokenModal());
pokemonSplendorElement("ReserveDeckBtn")?.addEventListener("click", event => {
  if (pokemonSplendorReserveMenu && !pokemonSplendorReserveMenu.classList.contains("hidden")) closePokemonSplendorReserveMenu();
  else showPokemonSplendorReserveMenu(event.currentTarget);
});
pokemonSplendorElement("SkipEvolveBtn")?.addEventListener("click", () => submitPokemonSplendorAction({ type: "skip_evolution" }));
pokemonSplendorElement("DiscardBtn")?.addEventListener("click", () => openPokemonSplendorTokenModal(null, { type: "discard_tokens" }));
pokemonSplendorElement("TokenModalCloseBtn")?.addEventListener("click", closePokemonSplendorTokenModal);
["ConfirmThreeBtn", "ConfirmTwoBtn", "PendingConfirmBtn"].forEach(suffix => pokemonSplendorElement(suffix)?.addEventListener("click", confirmPokemonSplendorTokenAction));
pokemonSplendorElement("TokenDockBtn")?.addEventListener("click", event => {
  const docked = pokemonSplendorTokenModal.classList.toggle("pokemon-dialog-docked");
  event.currentTarget.textContent = docked ? "Expand" : "Dock";
  event.currentTarget.setAttribute("aria-pressed", String(docked));
  pokemonSplendorTokenModal.setAttribute("aria-modal", String(!docked));
});
pokemonSplendorTokenModal?.addEventListener("click", event => {
  if (event.target === pokemonSplendorTokenModal) closePokemonSplendorTokenModal();
});
pokemonSplendorPanel?.addEventListener("click", event => {
  const filter = event.target.closest("[data-pokemon-tier]");
  if (filter) {
    pokemonSplendorMarketTier = filter.dataset.pokemonTier;
    pokemonSplendorSelectedMarket = null;
    if (currentPokemonSplendorView) refreshPokemonSplendorSelectionUI(currentPokemonSplendorView);
    return;
  }
  if (event.target.closest("button, summary, .pokemon-card, [data-pokemon-tooltip]")) return;
  if (pokemonSplendorTokenModal.classList.contains("hidden")) clearPokemonSplendorSelection();
});

document.addEventListener("pointerdown", event => {
  pokemonSplendorSuppressClick = false;
  if (currentGameType !== "splendor_pokemon") return;
  if (!event.target.closest(".pokemon-reserve-menu, #pokemonSplendorReserveDeckBtn")) closePokemonSplendorReserveMenu();
  if (!event.target.closest("#pokemonSplendorPanel, #pokemonSplendorTokenModal")) return;
  pokemonSplendorGesture = { pointerId: event.pointerId, left: event.clientX, top: event.clientY, moved: false };
}, true);
document.addEventListener("pointermove", event => {
  if (pokemonSplendorGesture?.pointerId === event.pointerId && Math.hypot(event.clientX - pokemonSplendorGesture.left, event.clientY - pokemonSplendorGesture.top) > 10) {
    pokemonSplendorGesture.moved = true;
    hidePokemonSplendorTooltip();
  }
}, true);
document.addEventListener("pointerup", event => {
  if (pokemonSplendorGesture?.pointerId !== event.pointerId) return;
  pokemonSplendorSuppressClick = pokemonSplendorGesture.moved;
  pokemonSplendorGesture = null;
}, true);
document.addEventListener("pointercancel", () => {
  if (pokemonSplendorGesture) pokemonSplendorSuppressClick = true;
  pokemonSplendorGesture = null;
}, true);
document.addEventListener("click", event => {
  if (currentGameType !== "splendor_pokemon") return;
  if (pokemonSplendorSuppressClick) {
    event.preventDefault();
    event.stopImmediatePropagation();
    pokemonSplendorSuppressClick = false;
    return;
  }
  const hint = event.target.closest("[data-pokemon-tooltip]");
  if (event.target.closest("button, summary")) hidePokemonSplendorTooltip();
  const touchTap = event.pointerType === "touch" || event.sourceCapabilities?.firesTouchEvents || matchMedia("(pointer: coarse)").matches;
  if (hint && !event.target.closest("button, summary") && !hint.querySelector(".pokemon-card-select-trigger") && touchTap) {
    showPokemonSplendorTooltip(hint, true);
  }
}, true);
document.addEventListener("pointerover", event => {
  if (currentGameType === "splendor_pokemon" && event.pointerType === "mouse") {
    const hint = event.target.closest("[data-pokemon-tooltip]");
    if (hint) showPokemonSplendorTooltip(hint);
  }
});
document.addEventListener("pointerout", event => {
  if (event.pointerType !== "mouse") return;
  const hint = event.target.closest("[data-pokemon-tooltip]");
  if (hint && !hint.contains(event.relatedTarget)) hidePokemonSplendorTooltip();
});
document.addEventListener("focusin", event => {
  if (currentGameType === "splendor_pokemon" && !event.target.closest("button, summary")) showPokemonSplendorTooltip(event.target.closest("[data-pokemon-tooltip]"));
});
document.addEventListener("focusout", hidePokemonSplendorTooltip);
document.addEventListener("scroll", hidePokemonSplendorTooltip, true);
window.addEventListener("resize", () => {
  hidePokemonSplendorTooltip();
  closePokemonSplendorReserveMenu();
});
document.addEventListener("keydown", event => {
  if (currentGameType !== "splendor_pokemon" || event.key !== "Escape") return;
  hidePokemonSplendorTooltip();
  if (!pokemonSplendorTokenModal.classList.contains("hidden")) closePokemonSplendorTokenModal();
  else if (pokemonSplendorReserveMenu && !pokemonSplendorReserveMenu.classList.contains("hidden")) closePokemonSplendorReserveMenu();
  else clearPokemonSplendorSelection();
});
document.addEventListener("obg:help-lang", () => {
  const close = pokemonSplendorHelp?.element()?.querySelector(".obg-help-close");
  if (close) close.textContent = "Close";
});

function initializePokemonSplendor() {
  showPokemonSplendorHeaderActions(typeof currentGameType !== "undefined" && currentGameType === "splendor_pokemon");
  if (typeof currentRoomState !== "undefined" && currentRoomState && typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "splendor_pokemon") {
    renderPokemonSplendorGameState(lastGameStatePayload);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializePokemonSplendor);
else initializePokemonSplendor();
