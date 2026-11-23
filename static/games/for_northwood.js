(function () {
  "use strict";

  function init() {
    const GAME_ID = "for_northwood";
    const ATTRIBUTE = "data-for-northwood-explain";
    const byId = (suffix) => document.getElementById(`forNorthwood${suffix}`);
    const panel = byId("Panel");
    if (!panel || panel.dataset.northwoodReady) return;
    panel.dataset.northwoodReady = "true";
    let view = null;
    let activeRoom = null;
    let selectedCards = [];
    let selectedFief = null;
    let selectedAlly = null;
    let selectedSuit = null;
    let inFlight = false;
    let requestTimer = null;
    let tooltipTimer = null;
    let gesture = null;
    let suppressClick = false;

    const explanations = {
      settings: {
        zh: "教学配置固定使用四位侍从，领主是随机排列的四位王后和四位国王。标准配置从每种花色随机选一位盟友和两位领主，包含全部二十四种角色。胜利目标默认为二十星中的十六星。",
        en: "Introductory setup gives you the four Jacks and shuffles the four Queens and Kings among the fiefs. Standard setup chooses one ally and two rulers of each suit from all 24 characters. The default win target is 16 of 20 stars."
      },
      visits: {
        zh: "共进行八次出访。每次先将三十二张对话牌洗匀，再抽八张手牌，之后才选择一个未访问领地。每个领地最终只结算一次。",
        en: "Make eight visits. Shuffle all 32 dialogue cards and draw eight before choosing an unvisited fief. Each fief is settled exactly once."
      },
      stars: {
        zh: "星星(⭐)是整局分数。仅当一次出访结束时得分堆张数恰好等于领地目标，才获得该领地全部星星。借用过领主也不会丢失已得星星。",
        en: "Stars (⭐) are your game score. Earn a fief's stars only when your score pile exactly matches its target at the end of the visit. Borrowing its ruler never removes earned stars."
      },
      fiefs: {
        zh: "八个领地从左到右需要零到七墩，分别价值四、三、二、一、一、二、三、四星。绿色代表友好，灰色代表失败，深绿边框代表当前出访。访问之前可以查看手牌。",
        en: "The eight fiefs require zero through seven tricks and award 4, 3, 2, 1, 1, 2, 3, 4 stars. Green means friendly, grey means lost and the dark green border marks the current visit. Inspect your hand before choosing."
      },
      trump: {
        zh: "当前领主的花色就是王牌。四种花色为利爪(🐾)、繁花(🌸)、慧眼(👁)和枝叶(🍃)。更换领主或移动出访可能立即改变王牌花色。",
        en: "The current ruler's suit is trump. The suits are Claws (🐾), Flowers (🌸), Eyes (👁) and Leaves (🍃). Swapping rulers or moving the visit may immediately change trump."
      },
      dialogue: {
        zh: "每一墩始终由领主先出牌。翻开陈述后必须跟随花色，有同花色就不能打其他花色。同花色点数更大，或无法跟随时用王牌压过非王牌，才能赢墩。",
        en: "The ruler always leads. You must follow the statement's suit if possible. Win with a higher card of the same suit, or with a trump against a non-trump statement when you cannot follow suit."
      },
      deck: {
        zh: "牌库(🌲)顶牌是下一张领主陈述。每墩翻牌前可使用至多一位未耗竭盟友，然后点击此处翻牌。牌库不会循环，能力与当前回应完整结算后，若牌库或手牌为空，此次出访结束。",
        en: "The deck (🌲) top is the next ruler statement. Before revealing, you may use at most one ready ally. The deck is never recycled. Once an ability or response is fully resolved, an empty deck or hand ends the visit."
      },
      discard: {
        zh: "弃牌堆(🍂)包含所有领主陈述和输掉的回应牌。点击可从顶到底查看，但不能改变顺序。部分能力会取用顶牌，因此多张弃牌必须按希望的顺序选择。",
        en: "The discard pile (🍂) holds every ruler statement and every losing response. Open it to inspect cards top first, without rearranging. Some abilities use its top card, so select multiple discards in the order you want to place them."
      },
      score: {
        zh: "得分堆(🏆)的张数就是此次出访的墩数。赢墩只放入你打出的回应牌，领主陈述仍在弃牌堆。能力可以增减得分堆，因此当前墩数不一定等于实际赢过的对话数。",
        en: "Your score is the number of cards in the score pile (🏆). A won trick puts only your response here, not the statement. Abilities can add or remove cards, so score may differ from the number of dialogues actually won."
      },
      allies: {
        zh: "每次出访可使用四位盟友，每位每次出访限用一次，每墩翻牌前至多使用一个能力。耗竭盟友在下一次出访恢复。友好领主可在出访前临时替换盟友，但每位领主整局只能借用一次。",
        en: "You have four allies per visit. Each may act once per visit, with at most one ability before each statement. Permanent allies refresh next visit. Before starting, a friendly ruler may replace an ally, but each ruler may be borrowed only once per game."
      },
      hand: {
        zh: "每次出访最初有八张手牌。点击一张可用回应牌后，在手牌区原地确认。能力要求多张牌时，点击顺序就是放入牌堆的顺序，最后选择的牌在最上方。点击空白处取消选择。",
        en: "Start each visit with eight cards. Select a legal response and confirm in the hand area. For multi-card abilities, selection order is pile order, with the last selected card on top. Tap blank space to cancel selection."
      },
      known: {
        zh: "这是能力揭示的牌库信息，按下一张陈述优先的顺序展示。正常抽牌会推进这条记录，洗牌会清除记录。未知牌不会泄露。",
        en: "These are deck cards revealed by abilities, next statement first. Drawing advances this memory and shuffling clears it. Unknown cards are never exposed."
      },
      advance: {
        zh: "结算后暂停保留当前结果。Next Dialogue 进入下一墩，Next Round 洗牌开始下一次出访。这些按钮直接继续，不会再次要求确认。",
        en: "Results remain visible until you continue. Next Dialogue starts another trick and Next Round shuffles for the next visit. These buttons advance directly without another confirmation."
      },
      confirm: {
        zh: "按当前选择执行显示的操作。选择多张牌时，最后选择的牌将位于牌堆最上方。Cancel 或点击空白处可以取消尚未执行的选择。",
        en: "Perform the displayed action with your current selection. When moving several cards, the last selected card becomes the pile top. Cancel or tap blank space to abandon an unconfirmed selection."
      }
    };

    const NORTHWOOD_HELP = {
      gameId: GAME_ID,
      title: { zh: "为了北境森林 · For Northwood!", en: "For Northwood!" },
      basic: {
        win: { zh: "让领地的最终墩数恰好等于目标，收集星星(⭐)，八次出访后达到设定星数即获胜。", en: "Match each fief's exact target to earn stars (⭐), and reach the chosen star goal after eight visits to win." },
        turn: { zh: "每墩翻牌前可用一位盟友能力，然后翻开领主陈述并打出一张必须跟随花色的回应牌。", en: "Before each trick you may use one ally, then reveal the ruler's statement and respond with one card, following suit if able." },
        key: { zh: "先看八张手牌再选目标，把握输赢而非一味赢墩，并用盟友改变手牌数量和得分。", en: "Choose a target after seeing your eight cards, manage losses as carefully as wins, and use allies to adjust hand size and score." }
      },
      sections: [
        {
          id: "visits", label: { zh: "出访与吃墩", en: "Visits & tricks" },
          html: {
            zh: "<h3>八个领地</h3><p>三十二张对话牌由利爪(🐾)、繁花(🌸)、慧眼(👁)和枝叶(🍃)四种花色组成，每种点数一到八。每次出访重新洗匀全部牌，先发八张，再选择尚未访问的领地。领地目标从零到七，对应四、三、二、一、一、二、三、四颗星星(⭐)。</p><h3>对话</h3><p>领主的花色是此次王牌。领主始终从牌库(🌲)翻开陈述，你有同花色就必须跟随。同花色中大点数胜出，无法跟随时可以打任意牌，只有王牌能压过不同花色的陈述。胜出时仅将自己的回应牌放入得分堆(🏆)，否则回应牌进入弃牌堆(🍂)。陈述牌始终进入弃牌堆。</p><h3>完整结算与暂停</h3><p>能力或回应完整执行后，若手牌或牌库为空，此次出访立即结算，不再提供额外使用盟友的机会。得分堆张数必须恰好等于领地目标，多一张或少一张都失败。每墩后保留结果，点击 Next Dialogue 继续。出访结束后点击 Next Round 才重新洗牌。最后一次出访也先展示结算，再确认整局结果。</p>" ,
            en: "<h3>Eight fiefs</h3><p>The 32 dialogue cards have four suits, Claws (🐾), Flowers (🌸), Eyes (👁) and Leaves (🍃), each numbered one through eight. Shuffle all cards for every visit, deal eight, then choose an unvisited fief. Targets zero through seven award 4, 3, 2, 1, 1, 2, 3, 4 stars (⭐).</p><h3>Dialogue</h3><p>The ruler's suit is trump. The ruler always reveals the deck's (🌲) top card as its statement. Follow suit whenever possible. A higher card of the same suit wins. If you cannot follow suit, play any card, but only trump beats a different suit. Put only a winning response into your score pile (🏆). Losing responses and every statement go to the discard pile (🍂).</p><h3>Resolution and pauses</h3><p>Fully resolve each ability or response, then end the visit immediately if the hand or deck is empty. There is no extra opportunity to activate an ally. The score pile must exactly equal the target, not one higher or lower. Results pause after each trick for Next Dialogue and after each visit for Next Round. The last visit also pauses before confirming the game result.</p>"
          }
        },
        {
          id: "allies", label: { zh: "盟友与领主", en: "Allies & rulers" },
          html: {
            zh: "<h3>一次一个能力</h3><p>每墩翻开陈述之前，可使用一位未耗竭盟友的能力，每墩至多一次。每位盟友每次出访限用一次，下一次出访恢复。不能在看到陈述后再用能力。</p><h3>借用友好领主</h3><p>选择领地后、正式开始对话前，可以将任意数量的友好领主临时换入四个盟友位置。先选绿色领地，再选要替换的盟友并确认。开始前可以归还。出访开始后不能调整。借用的领主无论有没有发动能力，结算后都离开游戏，已获得的星星(⭐)仍然保留。永久盟友会在下一次出访回归。</p><h3>必须完整执行</h3><p>能力存在合法执行方式就必须完整执行，不能只挑有利部分。若没有合法方式则不产生效果并耗竭。要求从牌堆抽牌或移牌时，牌不足则尽量执行。可以随时查看弃牌堆与得分堆，但不能重排。多张牌按点击顺序移入，最后一张在最上方。</p><h3>配置与胜利</h3><p>教学配置使用四位侍从，对手为四位王后和四位国王。标准配置从每种花色六位角色中随机选一位盟友与两位领主。总分最多二十颗星，默认十六星获胜，也可选择十八或二十星目标。本实现为基础游戏，不包含挑战剧本。</p>",
            en: "<h3>One ability before each statement</h3><p>You may activate one ready ally before revealing a statement. Each ally acts at most once per visit and refreshes next visit. You cannot activate abilities after seeing the statement.</p><h3>Borrow friendly rulers</h3><p>After choosing a fief but before starting dialogue, any friendly rulers may temporarily replace an equal number of your four allies. Select a green fief, select the ally to replace, then confirm. You may return guests before starting. Once the visit begins the team is fixed. Every guest leaves the game at settlement, even if unused, but you keep earned stars (⭐). Permanent allies return next visit.</p><h3>Resolve in full</h3><p>Whenever a legal execution exists, perform the entire ability. If none exists, it does nothing and the ally is still exhausted. When drawing or moving cards from piles, take as many as available. Inspect discard and score piles freely, without rearranging them. Cards move in selection order, last selected on top.</p><h3>Setup and victory</h3><p>Introductory setup uses the four Jacks as allies and the four Queens and Kings as rulers. Standard setup randomly chooses one ally and two rulers from each suit's six characters. There are 20 stars available and the default goal is 16, with optional goals of 18 or 20. This implementation covers the base game, not the challenge scenarios.</p>"
          }
        },
        {
          id: "characters", label: { zh: "全部角色能力", en: "24 abilities" },
          html: {
            zh: "<h3>利爪(🐾)</h3><p>侍从将手牌补到八张。王后从牌库、弃牌堆、得分堆各取一张顶牌。国王将手中所有最大点数牌计分。王子至少抽一张，可逐张继续，抽到王牌必须停止。夫人弃一张最小牌，再抽取等同其点数的牌。男爵选择一张手牌，将牌库内同点数牌全部抽出后洗牌。</p><h3>繁花(🌸)</h3><p>侍从弃掉所有当前王牌。王后将得分堆顶放回牌库顶。国王弃掉恰好两张合计九的手牌。王子使每种点数只留一张，弃掉所有重复牌。夫人弃掉一张点数等于当前手牌数量的牌。男爵弃掉所有点数一、二、三的手牌。</p><h3>慧眼(👁)</h3><p>侍从抽二再弃二。王后查看牌库顶三张，不改变顺序。国王先指定任意花色，再抽二并弃掉手中该花色的全部牌。王子弃一抽一，每有另一耗竭盟友就再重复一次，可以弃刚抽的牌。夫人抽二，再弃掉点数总和等于所抽牌总和的任意张牌。男爵使下一张回应在打出后按奇偶触发，偶数抽一，奇数弃一，最后才检查空手。</p><h3>枝叶(🍃)</h3><p>侍从将当前领主与距离一或二的未访问领主交换，不改变当前领地目标，也不首尾环绕。王后完整复制当前领主能力。国王查看牌库顶，必须用一张原有手牌交换。王子移到左侧或右侧最近的未访问领地，目标与王牌随之改变，原领地仍未访问。夫人抽一，然后必须重置另一耗竭盟友，不能重置自己，没有其他目标时只抽牌。男爵可用同点数手牌交换弃牌堆顶，然后可与得分堆顶做相同交换。</p>",
            en: "<h3>Claws (🐾)</h3><p>Jack refills the hand to eight. Queen draws the top card of the deck, discard and score piles. King scores every highest-valued hand card. Prince draws at least one card, then draws one at a time until drawing trump or choosing to stop. Lady discards one lowest card, then draws its value in cards. Baron chooses a hand card, draws all cards of that value from the deck, then shuffles.</p><h3>Flowers (🌸)</h3><p>Jack discards every current trump. Queen puts the score top on the deck. King discards exactly two cards totalling nine. Prince keeps one card of every value and discards all duplicates. Lady discards a card equal to the current hand size. Baron discards all ones, twos and threes.</p><h3>Eyes (👁)</h3><p>Jack draws two then discards two. Queen views the top three deck cards without changing order. King names any suit before drawing two, then discards every hand card of that suit. Prince discards one and draws one, repeating once for each other exhausted ally, and may discard newly drawn cards. Lady draws two then discards any number of cards totalling their combined values. Baron makes the next response draw a card if even or discard a card if odd, before checking for an empty hand.</p><h3>Leaves (🍃)</h3><p>Jack swaps the current ruler with an unvisited ruler one or two fiefs away, without wrapping or changing target. Queen copies the current ruler's complete ability. King looks at the deck top and must exchange an original hand card for it. Prince moves the visit to the nearest unvisited fief on either side, changing target and trump while leaving the original fief unvisited. Lady draws one then must refresh another exhausted ally if any exist, never herself. Baron may swap a hand card with the discard top of the same value, then do the same with the score top.</p>"
          }
        }
      ]
    };

    const help = typeof window.obgCreateHelp === "function" ? window.obgCreateHelp(NORTHWOOD_HELP) : null;
    const explain = typeof window.obgCreateExplain === "function" ? window.obgCreateExplain({
      gameId: GAME_ID,
      attribute: "data-for-northwood-explain",
      explanations: explanations,
      button: byId("ExplainBtn"),
      root: () => panel,
      bypass: ["#forNorthwoodHelpBtn", "#forNorthwoodExplainBtn", "#forNorthwoodPileCloseBtn"]
    }) : null;

    const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    const can = (type) => Boolean(view?.legal_actions?.includes(type) && !inFlight);
    const lang = () => window.obgHelpLang() === "en" ? "en" : "zh";
    const suitIcon = (suit) => view.suits[suit].icon;
    const cardLabel = (card) => `${suitIcon(view.cards[card].suit)} ${view.cards[card].value} ${view.suits[view.cards[card].suit].name}`;
    const characterLabel = (character) => `${suitIcon(view.characters[character].suit)} ${view.characters[character].name}`;
    const actionButton = (text, callback, primary = true, key = "confirm") => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = primary ? "nw-primary" : "nw-cancel";
      button.textContent = text;
      button.setAttribute(ATTRIBUTE, key);
      button.disabled = inFlight;
      button.addEventListener("click", callback);
      return button;
    };

    function describe(node, key, content, tip = false) {
      explanations[key] = content;
      node.setAttribute(ATTRIBUTE, key);
      if (tip) {
        node.dataset.nwTip = key;
        node.tabIndex = 0;
      }
    }

    function cardNode(card, interactive = false) {
      const node = document.createElement(interactive ? "button" : "div");
      if (interactive) node.type = "button";
      if (!card) {
        node.className = "nw-card nw-empty";
        node.textContent = "—";
        node.setAttribute("aria-label", "No card yet");
        return node;
      }
      const entry = view.cards[card];
      node.className = `nw-card nw-suit-${entry.suit}`;
      node.dataset.nwCard = card;
      node.setAttribute("aria-label", cardLabel(card));
      node.innerHTML = `<span class="nw-card-value">${entry.value}</span><span class="nw-card-icon" aria-hidden="true">${suitIcon(entry.suit)}</span><span class="nw-card-suit">${view.suits[entry.suit].name}</span><span class="nw-card-order"></span>`;
      const key = `card_${card}`;
      describe(node, key, {
        zh: `${view.suits[entry.suit].name_zh}(${suitIcon(entry.suit)})，点数 ${entry.value}。${entry.suit === view.trump ? "这是当前王牌。" : "这不是当前王牌。"}回应时有同花色必须跟随，点数比陈述更大才赢墩。`,
        en: `${cardLabel(card)}. ${entry.suit === view.trump ? "This is trump." : "This is not trump."} Follow the statement's suit if able. A higher card of the same suit wins the trick.`
      }, !interactive);
      return node;
    }

    function resetSelection() {
      selectedCards = [];
      selectedFief = null;
      selectedAlly = null;
      selectedSuit = null;
    }

    function hideTooltip() {
      clearTimeout(tooltipTimer);
      byId("Tooltip").classList.add("hidden");
    }

    function send(type, fields = {}) {
      if (!can(type)) return;
      hideTooltip();
      inFlight = true;
      resetSelection();
      render();
      clearTimeout(requestTimer);
      requestTimer = setTimeout(() => { inFlight = false; render(); }, 6000);
      sendAction({ type, ...fields });
    }

    function showConfirm(suffix, text, label, callback, valid = true) {
      const container = byId(suffix);
      container.classList.remove("hidden");
      const message = document.createElement("p");
      message.textContent = text;
      const confirm = actionButton(label, callback);
      confirm.disabled = !valid || inFlight;
      container.replaceChildren(message, confirm, actionButton("Cancel", () => { resetSelection(); updateSelection(); }, false));
    }

    function renderFiefs() {
      const container = byId("Fiefs");
      container.replaceChildren();
      view.fiefs.forEach((fief, index) => {
        const character = view.characters[fief.ruler];
        const isCurrent = index === view.current_fief;
        const guestAvailable = can("substitute") && fief.status === "friendly" && !fief.spent && !view.borrowed.includes(index);
        const enabled = (can("choose_fief") && fief.status === "unvisited") || guestAvailable
          || (can("ability_fief") && view.pending.fiefs.includes(index));
        const button = document.createElement("button");
        button.type = "button";
        button.className = `nw-fief nw-${fief.status}${isCurrent ? " nw-current" : ""}${fief.spent ? " nw-spent" : ""}`;
        button.dataset.nwFief = String(index);
        button.disabled = !enabled;
        button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", `Fief ${index}, ${view.star_values[index]} stars, ${character.name}, ${fief.status}${isCurrent ? ", current visit" : ""}`);
        const status = isCurrent && !["visit_review", "game_over"].includes(view.phase) ? "Visiting" : ({ unvisited: "Unvisited", friendly: fief.spent ? "Friendly · spent" : "Friendly", lost: "Lost" })[fief.status];
        button.innerHTML = `<span class="nw-fief-top"><span>${suitIcon(character.suit)}</span><span class="nw-fief-stars">★ ${view.star_values[index]}</span></span><span class="nw-animal" aria-hidden="true">${character.animal}</span><span class="nw-rank">${esc(character.rank[0].toUpperCase() + character.rank.slice(1))}</span><span class="nw-fief-target"><strong>${index}</strong><small>tricks</small></span><span class="nw-fief-status">${status}</span>`;
        const key = `fief_${index}`;
        describe(button, key, {
          zh: `领地 ${index} 需要最终得分恰为 ${index}，价值 ${view.star_values[index]} 颗星星(⭐)。领主是${character.name_zh}，王牌为${view.suits[character.suit].name_zh}(${suitIcon(character.suit)})。此领主能力：${character.ability_zh} ${fief.spent ? "这位友好领主已经借用过，不能再借用。" : "赢得领地后，可以在未来一次出访中借用该领主。"}`,
          en: `Fief ${index} requires exactly ${index} score cards and awards ${view.star_values[index]} stars (⭐). Its ruler is ${character.name}, making ${view.suits[character.suit].name} (${suitIcon(character.suit)}) trump. Ruler ability: ${character.ability} ${fief.spent ? "This friendly ruler has already been borrowed and cannot join again." : "After befriending this ruler, you may borrow them for one future visit."}`
        }, !enabled);
        button.addEventListener("click", () => {
          selectedFief = selectedFief === index ? null : index;
          selectedCards = [];
          if (!guestAvailable) selectedAlly = null;
          updateSelection();
        });
        container.appendChild(button);
      });
    }

    function renderAllies() {
      byId("AllyCount").textContent = `${view.active_allies.filter((ally) => !ally.exhausted).length} / 4 ready`;
      byId("Allies").replaceChildren();
      view.active_allies.forEach((ally, index) => {
        const character = view.characters[ally.character];
        const enabled = (can("use_ability") && !ally.exhausted) || can("substitute")
          || (can("ability_ally") && view.pending.slots.includes(index));
        const button = document.createElement("button");
        button.type = "button";
        button.disabled = !enabled;
        button.className = `nw-ally${ally.exhausted ? " nw-exhausted" : ""}`;
        button.dataset.nwAlly = String(index);
        button.setAttribute("aria-label", `${character.name}, ${ally.exhausted ? "exhausted" : "ready"}${ally.borrowed_from !== null ? ", guest" : ""}`);
        button.setAttribute("aria-pressed", "false");
        button.innerHTML = `<span class="nw-animal" aria-hidden="true">${character.animal}</span><span class="nw-ally-name">${suitIcon(character.suit)} ${esc(character.rank[0].toUpperCase() + character.rank.slice(1))}</span><span class="nw-ally-state">${ally.borrowed_from !== null ? "Guest · " : ""}${ally.exhausted ? "Exhausted" : "Ready"}</span>`;
        describe(button, `ally_${index}`, {
          zh: `${character.name_zh}(${suitIcon(character.suit)})：${character.ability_zh} ${ally.exhausted ? "此盟友已耗竭。" : "此盟友尚未使用。"}${ally.borrowed_from !== null ? "这是本次出访的临时领主，结算后离开，无论是否发动能力。" : "永久盟友在每次出访开始时恢复。"}`,
          en: `${character.name} (${suitIcon(character.suit)}): ${character.ability} ${ally.exhausted ? "This ally is exhausted." : "This ally is ready."}${ally.borrowed_from !== null ? " This guest leaves after the visit, whether used or not." : " This permanent ally refreshes next visit."}`
        }, !enabled);
        button.addEventListener("click", () => {
          selectedAlly = selectedAlly === index ? null : index;
          selectedCards = [];
          updateSelection();
        });
        byId("Allies").appendChild(button);
      });
    }

    function renderHand() {
      byId("HandCount").textContent = `· ${view.hand_count}`;
      byId("HandHint").textContent = view.phase === "respond" ? `Follow ${suitIcon(view.cards[view.statement].suit)} if able` : view.phase === "ability" ? "Select in pile order" : "Choose your moment";
      const container = byId("Hand");
      container.replaceChildren();
      if (!view.is_owner) {
        container.textContent = `Spectating · ${view.hand_count} hidden cards`;
        return;
      }
      const sorted = view.hand.slice().sort((first, second) => {
        const suits = Object.keys(view.suits);
        return suits.indexOf(view.cards[first].suit) - suits.indexOf(view.cards[second].suit) || view.cards[first].value - view.cards[second].value;
      });
      sorted.forEach((card) => {
        const node = cardNode(card, true);
        const enabled = (can("play") && view.legal_cards.includes(card))
          || (can("ability_cards") && view.pending.eligible.includes(card));
        node.disabled = !enabled && (view.phase === "respond" || Boolean(view.pending?.eligible) || inFlight);
        if (!enabled) node.setAttribute("aria-disabled", "true");
        node.setAttribute("aria-pressed", "false");
        if (!enabled) node.dataset.nwTip = `card_${card}`;
        node.addEventListener("click", () => {
          if (!enabled) return;
          const found = selectedCards.indexOf(card);
          if (found >= 0) selectedCards.splice(found, 1);
          else if (can("play") || view.pending?.count === 1) selectedCards = [card];
          else if (!view.pending?.count || selectedCards.length < view.pending.count) selectedCards.push(card);
          selectedAlly = null;
          selectedFief = null;
          updateSelection();
        });
        container.appendChild(node);
      });
    }

    function renderDialogue() {
      const current = view.current_fief;
      const reviewing = ["trick_review", "visit_review", "game_over"].includes(view.phase);
      const last = view.last_trick;
      byId("DialogueTitle").textContent = current === null ? "Choose your destination" : `Fief ${current} · Dialogue ${view.trick}`;
      byId("Trump").textContent = view.trump ? `${suitIcon(view.trump)} trump` : "";
      byId("Statement").replaceChildren(cardNode(view.statement));
      byId("Response").replaceChildren(cardNode(reviewing && view.statement ? last?.response : selectedCards.length === 1 && view.phase === "respond" ? selectedCards[0] : null));
      byId("Target").innerHTML = `<strong>${view.score.length}<span> / </span>${current === null ? "–" : current}</strong><span>score / target</span>`;
      const messages = {
        choose_fief: "Inspect your hand, then choose an unvisited fief.",
        prepare: "Invite friendly rulers, or begin with these allies.",
        before_trick: view.ability_used ? "Ability resolved. Reveal the next statement." : "Use one ready ally, or reveal the next statement.",
        respond: "Choose your response. Follow suit if you can.",
        ability: "Resolve the highlighted ally's ability.",
        trick_review: last ? `${last.won ? "You won" : "The ruler won"} this dialogue. Score ${view.score.length} / ${current}.` : "Dialogue complete.",
        visit_review: "",
        game_over: `${view.winner.length ? "Northwood is united!" : "The forest awaits another envoy."} ${view.stars} / ${view.config.goal} stars.`
      };
      const message = byId("Message");
      message.className = "nw-message";
      if (view.phase === "visit_review") {
        const result = view.history.at(-1);
        message.textContent = `${result.success ? `A new friend! +${result.stars} stars.` : "Not quite this time."} Fief ${result.fief}: ${result.score} / ${result.target} score.`;
        message.classList.add(result.success ? "nw-success" : "nw-failure");
      } else {
        message.textContent = inFlight ? "Resolving…" : messages[view.phase] || "";
      }
      byId("DeckBtn").textContent = `🌲 Deck · ${view.deck_count}${can("reveal") ? " · Reveal" : ""}`;
      byId("DeckBtn").disabled = !can("reveal");
      byId("DeckBtn").toggleAttribute("data-nw-tip", !can("reveal"));
      if (!can("reveal")) byId("DeckBtn").dataset.nwTip = "deck";
      byId("DiscardBtn").textContent = `🍂 Discard · ${view.discard.length}`;
      byId("ScoreBtn").textContent = `🏆 Score · ${view.score.length}`;
      const controls = byId("DialogueControls");
      controls.replaceChildren();
      if (can("start_visit")) controls.appendChild(actionButton("Begin Visit", () => send("start_visit")));
      if (can("next_trick")) controls.appendChild(actionButton("Next Dialogue →", () => send("next_trick"), true, "advance"));
      if (can("next_round")) controls.appendChild(actionButton(view.history.length === 8 ? "Next Round · Final Results →" : "Next Round →", () => send("next_round"), true, "advance"));
      const known = byId("Known");
      known.classList.toggle("hidden", !view.known_top.length);
      known.textContent = view.known_top.length ? `Known next: ${view.known_top.map(cardLabel).join(" → ")}` : "";
      known.dataset.nwTip = "known";
    }

    function selectionValid() {
      const pending = view.pending;
      if (!pending || !selectedCards.length) return false;
      if (pending.count !== undefined && selectedCards.length !== pending.count) return false;
      if (pending.total !== undefined && selectedCards.reduce((total, card) => total + view.cards[card].value, 0) !== pending.total) return false;
      if (pending.kind === "duplicates") {
        const remaining = view.hand.filter((card) => !selectedCards.includes(card));
          if (new Set(remaining.map((card) => view.cards[card].value)).size !== remaining.length
              || new Set(remaining.map((card) => view.cards[card].value)).size !== new Set(view.hand.map((card) => view.cards[card].value)).size) return false;
      }
      return true;
    }

    function updateSelection() {
      ["FiefConfirm", "AllyConfirm", "HandConfirm"].forEach((suffix) => byId(suffix).classList.add("hidden"));
      panel.querySelectorAll("[data-nw-fief]").forEach((node) => {
        const chosen = Number(node.dataset.nwFief) === selectedFief;
        node.classList.toggle("nw-selected", chosen);
        node.setAttribute("aria-pressed", String(chosen));
      });
      panel.querySelectorAll("[data-nw-ally]").forEach((node) => {
        const chosen = Number(node.dataset.nwAlly) === selectedAlly;
        node.classList.toggle("nw-selected", chosen);
        node.setAttribute("aria-pressed", String(chosen));
      });
      byId("Hand").querySelectorAll("[data-nw-card]").forEach((node) => {
        const index = selectedCards.indexOf(node.dataset.nwCard);
        node.classList.toggle("nw-selected", index >= 0);
        node.setAttribute("aria-pressed", String(index >= 0));
        node.querySelector(".nw-card-order").textContent = index >= 0 ? String(index + 1) : "";
      });
      if (selectedFief !== null) {
        const fief = selectedFief;
        if (can("choose_fief")) showConfirm("FiefConfirm", `Visit fief ${fief} · ${view.star_values[fief]} stars · ${characterLabel(view.fiefs[fief].ruler)}`, "Visit", () => send("choose_fief", { fief }));
        else if (can("ability_fief")) showConfirm("FiefConfirm", `${view.pending.kind === "swap_ruler" ? "Swap rulers with" : "Move this visit to"} fief ${fief}?`, "Confirm", () => send("ability_fief", { fief }));
        else if (can("substitute") && selectedAlly === null) {
          const character = view.characters[view.fiefs[fief].ruler];
          showConfirm("FiefConfirm", `${character.name}: ${character.ability} Choose an ally to replace.`, "Invite", () => {}, false);
        }
      }
      if (selectedAlly !== null) {
        const slot = selectedAlly;
        const ally = view.active_allies[slot];
        const character = view.characters[ally.character];
        if (can("use_ability")) showConfirm("AllyConfirm", `${character.name}: ${character.ability}`, "Use Ability", () => send("use_ability", { slot }));
        else if (can("ability_ally")) showConfirm("AllyConfirm", `Refresh ${character.name}?`, "Refresh", () => send("ability_ally", { slot }));
        else if (can("substitute")) {
          if (selectedFief !== null) showConfirm("AllyConfirm", `Replace ${character.name} with ${characterLabel(view.fiefs[selectedFief].ruler)}? This guest can join only one visit.`, "Invite", () => send("substitute", { slot, fief: selectedFief }), ally.borrowed_from === null);
          else if (ally.borrowed_from !== null) showConfirm("AllyConfirm", `${character.name}: ${character.ability} Return this guest before starting?`, "Return Ally", () => send("return_ally", { slot }));
          else showConfirm("AllyConfirm", `${character.name}: ${character.ability} Select a friendly ruler to replace this ally.`, "Invite", () => {}, false);
        }
      }
      if (selectedCards.length) {
        if (can("play")) {
          const card = selectedCards[0];
          const response = view.cards[card];
          const statement = view.cards[view.statement];
          const won = response.suit === statement.suit ? response.value > statement.value : response.suit === view.trump;
          showConfirm("HandConfirm", `${cardLabel(card)} · ${won ? "Win" : "Lose"} this trick · score ${view.score.length} → ${view.score.length + Number(won)}`, "Play", () => send("play", { card }));
        } else if (can("ability_cards")) {
          const pending = view.pending;
          const total = selectedCards.reduce((sum, card) => sum + view.cards[card].value, 0);
          const requirement = pending.total !== undefined ? `total ${total} / ${pending.total}` : `${selectedCards.length} / ${pending.count} cards`;
          const verb = ["search", "exchange_top", "baron_swap"].includes(pending.kind) ? "Choose" : pending.pile === "score" ? "Score" : "Discard";
          showConfirm("HandConfirm", `${verb} · ${requirement}. Last selected goes on top.`, "Confirm", () => send("ability_cards", { cards: selectedCards.slice() }), selectionValid());
        }
      }
      renderAbilityChoice();
      if (view.phase === "respond") byId("Response").replaceChildren(cardNode(selectedCards[0] || null));
    }

    function renderAbilityChoice() {
      const box = byId("AbilityChoice");
      box.replaceChildren();
      box.classList.toggle("hidden", !view.pending);
      if (!view.pending) return;
      const pending = view.pending;
      const hints = {
        forced: `Select all ${pending.count} highlighted cards in the order to move them.`,
        lowest: "Choose one of your lowest cards to discard, then draw its value.",
        search: "Choose a hand card. Draw every matching value from the deck, then shuffle.",
        sum_nine: "Choose two cards totalling exactly nine.",
        duplicates: "Choose duplicates to discard. Keep exactly one card of every value.",
        hand_size: "Choose a card whose value equals your hand size.",
        discard_two: "Choose two cards to discard, in pile order.",
        cycle: `Discard one, then draw one. ${pending.remaining} exchange${pending.remaining === 1 ? "" : "s"} remaining.`,
        sum_drawn: `Discard any number of cards totalling exactly ${pending.total}.`,
        exchange_top: `The deck's top card was ${pending.revealed ? cardLabel(pending.revealed) : "revealed"}. Choose an original hand card to put on top.`,
        baron_swap: `Optionally exchange a hand card of the same value with the ${pending.pile} top.`,
        parity_discard: "Your response was odd. Discard one more card before the visit can end.",
        swap_ruler: "Select a highlighted fief to swap rulers. Your target stays the same.",
        move_visit: "Select the nearest unvisited fief on either side. Your target will change.",
        refresh: "Select another exhausted ally to refresh.",
        name_suit: "Name a suit before drawing two cards.",
        draw_until: `Drew ${pending.last_draw ? cardLabel(pending.last_draw) : "a card"}. Draw another or stop?`
      };
      const hint = document.createElement("p");
      hint.textContent = hints[pending.kind] || "Complete the ability.";
      box.appendChild(hint);
      if (pending.kind === "name_suit") {
        pending.suits.forEach((suit) => {
          const button = actionButton(`${suitIcon(suit)} ${view.suits[suit].name}`, () => { selectedSuit = suit; renderAbilityChoice(); }, false);
          button.classList.toggle("nw-selected", selectedSuit === suit);
          box.appendChild(button);
        });
        if (selectedSuit) box.appendChild(actionButton("Confirm suit", () => send("ability_suit", { suit: selectedSuit })));
      } else if (pending.kind === "draw_until") {
        box.append(actionButton("Draw another", () => send("ability_decision", { decision: "draw" })), actionButton("Stop drawing", () => send("ability_decision", { decision: "stop" }), false));
      } else if (pending.optional) box.appendChild(actionButton("Skip this pile", () => send("ability_decision", { decision: "skip" }), false));
    }

    function renderJournal() {
      byId("HistoryCount").textContent = `· ${view.history.length} / 8`;
      byId("History").replaceChildren();
      view.history.forEach((entry) => {
        const item = document.createElement("div");
        item.className = "nw-history-entry";
        item.textContent = `${entry.success ? "✓" : "×"} Fief ${entry.fief} · ${entry.score} / ${entry.target} · +${entry.stars} ★`;
        byId("History").appendChild(item);
      });
      byId("Log").replaceChildren();
      view.log.forEach((entry) => {
        const line = document.createElement("li");
        line.textContent = entry;
        byId("Log").appendChild(line);
      });
    }

    function updateCharacterReference() {
      const section = NORTHWOOD_HELP.sections.find((entry) => entry.id === "characters");
      for (const language of ["zh", "en"]) {
        section.html[language] = Object.entries(view.suits).map(([suit, detail]) => {
          const characters = Object.values(view.characters).filter((character) => character.suit === suit);
          return `<h3>${esc(language === "zh" ? detail.name_zh : detail.name)}(${detail.icon})</h3><dl>${characters.map((character) => `<dt><strong>${esc(language === "zh" ? character.name_zh : character.name)}</strong></dt><dd>${esc(language === "zh" ? character.ability_zh : character.ability)}</dd>`).join("")}</dl>`;
        }).join("") + (language === "zh" ? "<p>枝叶王后复制当前领主的完整能力，但仍只计作本墩的一个能力。慧眼王子的交换次数包含自己耗竭后的一次。枝叶夫人不能重置自己。先完整执行能力，再检查牌库或手牌是否为空。</p>" : "<p>The Queen of Leaves copies the current ruler's full ability and still counts as only one ability this trick. The Prince of Eyes includes his own activation in the number of exchanges. The Lady of Leaves cannot refresh herself. Finish resolving an ability before checking for an empty hand or deck.</p>");
      }
    }

    function render() {
      if (!view) return;
      byId("Lobby").classList.add("hidden");
      byId("Table").classList.remove("hidden");
      byId("Visit").textContent = `Visit ${view.visit} / 8`;
      byId("Stars").textContent = `⭐ ${view.stars} / ${view.config.goal}`;
      byId("Phase").textContent = ({ choose_fief: "Choose a fief", prepare: "Prepare", before_trick: "Before dialogue", respond: "Your response", ability: "Ally ability", trick_review: "Dialogue result", visit_review: "Visit result", game_over: "Final results" })[view.phase];
      renderFiefs();
      renderAllies();
      renderHand();
      renderDialogue();
      renderJournal();
      updateSelection();
      explain?.refresh();
    }

    function showPile(pile) {
      if (!view) return;
      byId("PileTitle").textContent = `${pile === "score" ? "Score pile" : "Discard pile"} · ${view[pile].length}`;
      const container = byId("PileCards");
      container.replaceChildren();
      view[pile].slice().reverse().forEach((card) => container.appendChild(cardNode(card)));
      if (!view[pile].length) container.textContent = "This pile is empty.";
      byId("PileDialog").showModal();
    }

    function showTooltip(node) {
      const text = explanations[node?.dataset.nwTip]?.[lang()];
      if (!text || explain?.isActive()) return;
      const tooltip = byId("Tooltip");
      (node.closest("dialog") || panel).appendChild(tooltip);
      tooltip.textContent = text;
      tooltip.classList.remove("hidden");
      const bounds = node.getBoundingClientRect();
      const box = tooltip.getBoundingClientRect();
      tooltip.style.left = `${Math.max(10, Math.min(innerWidth - box.width - 10, bounds.left))}px`;
      tooltip.style.top = `${Math.max(10, Math.min(innerHeight - box.height - 10, bounds.bottom + 6))}px`;
      clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(hideTooltip, 3000);
    }

    function syncRoom(room) {
      const lobby = room?.game_type === GAME_ID && room.status === "lobby";
      byId("ConfigBox").classList.toggle("hidden", !lobby);
      byId("ConfigBox").setAttribute("aria-hidden", String(!lobby));
      if (room?.game_type !== GAME_ID) {
        explain?.exit();
        help?.close();
        hideTooltip();
        byId("PileDialog").close();
        return;
      }
      if (room.room_id !== activeRoom || room.status === "lobby") {
        const changed = room.room_id !== activeRoom;
        if (changed) {
          byId("Setup").value = room.game_config?.setup || "introductory";
          byId("Goal").value = String(room.game_config?.goal || 16);
        }
        activeRoom = room.room_id;
        view = null;
        inFlight = false;
        resetSelection();
        byId("Lobby").classList.remove("hidden");
        byId("Table").classList.add("hidden");
      }
    }

    function renderState(data) {
      if (!data?.view || data.game_type !== GAME_ID) return;
      if (typeof currentRoomState !== "undefined" && currentRoomState?.room_id && data.room_id !== currentRoomState.room_id) return;
      activeRoom = data.room_id;
      byId("ConfigBox").classList.add("hidden");
      byId("ConfigBox").setAttribute("aria-hidden", "true");
      clearTimeout(requestTimer);
      inFlight = false;
      resetSelection();
      hideTooltip();
      view = data.view;
      byId("Setup").value = view.config.setup;
      byId("Goal").value = String(view.config.goal);
      updateCharacterReference();
      render();
    }

    byId("HelpBtn").addEventListener("click", () => { explain?.exit(); hideTooltip(); help?.open(); });
    byId("ExplainBtn").addEventListener("click", () => { hideTooltip(); explain?.toggle(); });
    byId("DeckBtn").addEventListener("click", () => send("reveal"));
    byId("DiscardBtn").addEventListener("click", () => showPile("discard"));
    byId("ScoreBtn").addEventListener("click", () => showPile("score"));
    byId("PileCloseBtn").addEventListener("click", () => byId("PileDialog").close());
    byId("PileDialog").addEventListener("click", (event) => {
      if (event.target === byId("PileDialog")) {
        const bounds = event.target.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.target.close();
      }
    });
    panel.querySelectorAll(`[${ATTRIBUTE}][tabindex]`).forEach((node) => { node.dataset.nwTip = node.getAttribute(ATTRIBUTE); });
    panel.addEventListener("pointerover", (event) => {
      if (event.pointerType === "mouse") {
        const node = event.target.closest("[data-nw-tip]");
        if (node && !node.contains(event.relatedTarget)) showTooltip(node);
      }
    });
    panel.addEventListener("pointerout", (event) => {
      const node = event.target.closest("[data-nw-tip]");
      if (node && !node.contains(event.relatedTarget)) hideTooltip();
    });
    panel.addEventListener("focusin", (event) => {
      const node = event.target.closest("[data-nw-tip]");
      if (node) showTooltip(node);
    });
    panel.addEventListener("focusout", hideTooltip);
    panel.addEventListener("click", (event) => {
      if (!view || event.target.closest("button,select,label,summary,dialog,[data-nw-tip],.nw-local-confirm")) return;
      resetSelection();
      updateSelection();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!panel.contains(event.target) || explain?.isActive()) return;
      suppressClick = false;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, touch: event.pointerType === "touch" };
    }, true);
    document.addEventListener("pointermove", (event) => {
      if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 9) gesture.moved = true;
    }, true);
    document.addEventListener("pointerup", (event) => {
      if (gesture?.id !== event.pointerId) return;
      suppressClick = gesture.moved;
      if (!gesture.moved && gesture.touch) {
        const node = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-nw-tip]");
        if (node && panel.contains(node)) showTooltip(node);
      }
      gesture = null;
    }, true);
    document.addEventListener("pointercancel", () => { suppressClick = Boolean(gesture?.moved); gesture = null; }, true);
    document.addEventListener("click", (event) => {
      if (!suppressClick || !panel.contains(event.target)) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideTooltip();
        resetSelection();
        if (view) updateSelection();
      }
    });
    window.addEventListener("scroll", hideTooltip, true);
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => {
      if (!inFlight) return;
      clearTimeout(requestTimer);
      inFlight = false;
      render();
    });
    window.getForNorthwoodConfig = () => ({ setup: byId("Setup").value, goal: Number(byId("Goal").value) });
    window.renderForNorthwoodGameState = renderState;
    window.showForNorthwoodHeaderActions = (show) => {
      byId("HeaderActions").style.display = show ? "flex" : "none";
      if (!show) {
        byId("ConfigBox").classList.add("hidden");
        byId("ConfigBox").setAttribute("aria-hidden", "true");
        explain?.exit();
        help?.close();
        byId("PileDialog").close();
        hideTooltip();
      }
    };
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && typeof currentRoomState !== "undefined"
        && lastGameStatePayload?.room_id === currentRoomState?.room_id && currentRoomState?.status !== "lobby") renderState(lastGameStatePayload);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
