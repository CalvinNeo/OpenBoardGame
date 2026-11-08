const ETERNAL_DECKS_HELP_CONFIG = {
  gameId: "eternal_decks",
  title: { zh: "永恒牌 · Eternal Decks", en: "Eternal Decks" },
  basic: {
    win: {
      zh: "全队一起取得任意四颗星(⭐)就算共同获胜，只要有玩家再也做不出主行动、或者生命之河(🌊)发出 Game Over，全队就一起失败。",
      en: "The team wins together by collecting any four stars (⭐), and loses together the moment a player has no main action left or the river of life (🌊) hands out a Game Over."
    },
    turn: {
      zh: "轮到你时从三种主行动里选一种：把一张牌放进场地或生命之河(🌊)、用手牌生成一颗宝石(💎)、或者花掉一颗共享心(❤️)把一张牌暗中交给队友。",
      en: "On your turn you take one of three main actions: place a card on a field or in the river of life (🌊), generate a jewel (💎) out of cards in your hand, or spend one shared heart (❤️) to pass a card secretly to a teammate."
    },
    key: {
      zh: "这个游戏的重点，是在绝不透露普通牌数字和颜色的前提下，用交流圆片和公开讨论把全队的牌序一点点拼出来。",
      en: "The key to the game is piecing the team's card order together through communication discs and open discussion, while never revealing the number or the colour of an ordinary card."
    }
  },
  sections: [
    {
      id: "turn",
      label: { zh: "回合与行动", en: "Turns and actions" },
      html: {
        zh: "<p>每位玩家开局持有自己颜色的 1 到 5 各一张，洗牌之后抽三张进手牌。两人局还会在牌库底各加入两张随机副色牌。</p>"
          + "<p>全员按下 Ready 之后，由大家选定的起始玩家开始轮流行动。每个回合结束时只有刚刚行动的人从自己的牌库补牌补到三张，手牌超额不用弃掉，牌库空了也不会重洗。</p>"
          + "<p>三种主行动分别是放牌或使用能力、生成宝石(💎)、以及花一颗共享心(❤️)给队友一张牌。移动交流圆片不消耗回合。</p>",
        en: "<p>Every player starts with one card of each value from 1 to 5 in their own colour, shuffles them, and draws three. In a two-player game two random off-colour cards are also shuffled to the bottom of each deck.</p>"
          + "<p>Once everyone has pressed Ready, the chosen first explorer starts and play goes around the table. At the end of a turn only the player who acted refills to three cards from their own deck. Extra cards are never discarded and an empty deck is never reshuffled.</p>"
          + "<p>The three main actions are placing a card or using an ability, generating a jewel (💎), and spending one shared heart (❤️) to give a teammate a card. Moving a communication disc costs no turn.</p>"
      }
    },
    {
      id: "fields",
      label: { zh: "场地与放牌", en: "Fields and placement" },
      html: {
        zh: "<p>三块场地各有七格，牌只能从左往右放进下一个空格。相邻的两张牌必须颜色不同、数字也不同，山地要求数字递增，洞穴要求数字递减。</p>"
          + "<p>双色牌的左右半色分别约束左右两侧的邻牌，放下之前可以翻转方向，放下之后方向就固定下来。</p>"
          + "<p>稀有牌(🌈)落位的这一次会跳过数字、颜色和升降序的全部限制，但女巫的诅咒仍然能禁止它。</p>",
        en: "<p>Each of the three fields has seven spaces and cards may only go into the next empty space from left to right. Neighbouring cards must differ in both colour and number, the mountain requires rising numbers and the cave requires falling numbers.</p>"
          + "<p>On a dual-colour card the left and right halves constrain the neighbours on their own side. You may flip the card before placing it, and the orientation is locked once it lands.</p>"
          + "<p>A rare card (🌈) ignores every number, colour and ordering restriction for this placement, although the witch's curse can still forbid it.</p>"
      }
    },
    {
      id: "eternals",
      label: { zh: "永恒族与复苏", en: "Eternals and revival" },
      html: {
        zh: "<p>每一行的前三圈分别要填满四张、五张、六张牌，填满之后可以选择唤醒这一行沉睡的一位永恒族。他的八张牌会加入你的牌库底，这一行已经放下的牌全部弃掉。</p>"
          + "<p>永恒族的诅咒立刻对全队生效，只有把对应的宝石(💎)献给他才能解除。点击角色可以查看他的能力、诅咒和公开的牌组构成。</p>"
          + "<p>第四圈填满七张牌之后这一行关闭。上行会把另一条还没关闭的场地改成营地(⛺)，中行恢复全部三颗共享心(❤️)，下行直接获得一颗星(⭐)。</p>",
        en: "<p>The first three laps of a row need four, then five, then six cards. Once a lap is full you may awaken one eternal sleeping in that row, whose eight cards go to the bottom of your personal deck while the cards already in the row are discarded.</p>"
          + "<p>The eternal's curse takes effect for the whole team at once, and only offering the matching jewel (💎) lifts it. Click a character to read its ability, its curse and its public deck list.</p>"
          + "<p>After the fourth lap fills all seven spaces the row closes. The top row turns another open field into a camp (⛺), the middle row restores all three shared hearts (❤️), and the bottom row grants a star (⭐).</p>"
      }
    },
    {
      id: "jewels",
      label: { zh: "宝石与河流", en: "Jewels and the river" },
      html: {
        zh: "<p>每个宝石(💎)配方只能使用一次，并且必须献给一位还没有拿到宝石(💎)的复苏者。先点配方，再选手牌和目标，最后按 Generate 生成。</p>"
          + "<p>被消耗的牌会进入生命之河(🌊)。稀有牌(🌈)可以替代任意颜色或数字，双色牌可以任选其中一色，能力牌只适用于任意两张或任意三张的配方。</p>"
          + "<p>生命之河(🌊)里任何手牌都能放进去，凑到五张就全部弃掉并且只领取一次奖励。前三份奖励通常是稀有牌(🌈)，再下一次就是 Game Over。</p>",
        en: "<p>Every jewel (💎) recipe may be used once and must be given to a revived eternal that has no jewel (💎) yet. Open the recipe, choose the hand cards and the target, then press Generate.</p>"
          + "<p>The spent cards go into the river of life (🌊). A rare card (🌈) may stand in for any colour or number, a dual-colour card may use either of its halves, and ability cards only fit the recipes that ask for any two or any three cards.</p>"
          + "<p>Any hand card can enter the river of life (🌊). At five cards the river is cleared and hands out a single reward. The first three rewards are usually rare cards (🌈) and the next one is a Game Over.</p>"
      }
    },
    {
      id: "stars",
      label: { zh: "星与胜负", en: "Stars and winning" },
      html: {
        zh: "<p>一共有六条拿星(⭐)的路线，分别是前三位复苏者全部获得宝石(💎)、第四到第六位全部获得宝石(💎)、复苏全部九位永恒族、完成 1／5／9 配方、下行第四圈、以及使用三张 A 系能力牌。</p>"
          + "<p>每条路线只计一次，拿到任意四颗星(⭐)就共同获胜。同一回合同时满足胜负条件时，胜利优先于失败。</p>",
        en: "<p>There are six ways to earn a star (⭐): every one of the first three revived eternals receives a jewel (💎), the fourth through sixth revived eternals all receive a jewel (💎), all nine eternals are revived, a 1, 5 and 9 recipe set is completed, the bottom row finishes its fourth lap, and three A-series ability cards are used.</p>"
          + "<p>Each route scores only once and any four stars (⭐) win the game together. When a win and a loss would happen in the same turn, the win takes priority.</p>"
      }
    },
    {
      id: "talk",
      label: { zh: "交流与圆片", en: "Table talk and discs" },
      html: {
        zh: "<p>你不能说出普通牌的数字、颜色、自己缺什么牌或者手里拿着双色牌，但是可以自由讨论稀有牌(🌈)、能力牌和所有公开的场面信息。</p>"
          + "<p>每人有两个交流圆片，可以免费放到场地或河流的任意格子上表达意图。圆片只是提示，不保证那张牌真的放得下去。</p>"
          + "<p>每一整圈以及复苏、奖励、第四圈结算之后都会暂停，全员各自确认 Next Round 才继续。已经清空的场地和河流仍然会在回顾里保留。</p>",
        en: "<p>You may never say the number or the colour of an ordinary card, what you are missing, or that you hold a dual-colour card. Rare cards (🌈), ability cards and all public board information are free to discuss.</p>"
          + "<p>Everyone owns two communication discs that can be placed on any field or river space for free to signal an intention. A disc is only a hint and never guarantees that the card can legally go there.</p>"
          + "<p>The game pauses after each full lap and after every revival, reward or fourth-lap payout. Every seat confirms Next Round before play continues, and emptied fields and river cards stay visible in the review.</p>"
      }
    }
  ]
};

const ETERNAL_DECKS_EXPLAIN = {
  card: {
    zh: "底部的手牌入口(🃏)可以展开或收起你的手牌。先点场地或生命之河(🌊)的下一个空格，再选牌并确认，也可以从这里打开宝石(💎)配方或 Give ❤️。",
    en: "The hand dock (🃏) at the bottom expands or collapses your hand. Tap the next empty space on a field or in the river of life (🌊), then pick a card and confirm, or open a jewel (💎) recipe or Give ❤️ from here."
  },
  field: {
    zh: "点格子可以选出牌或者放交流圆片。牌只能从左向右放进下一个空格，相邻的牌必须不同色也不同数字，山地递增而洞穴递减。稀有牌(🌈)这一次落位跳过全部限制，女巫的诅咒仍然能禁止它。",
    en: "Tap a space to place a card or a communication disc. Cards only go into the next empty space from left to right, neighbours must differ in colour and number, the mountain rises and the cave falls. A rare card (🌈) skips every restriction this time, but the witch's curse can still forbid it."
  },
  eternal: {
    zh: "沉睡角色的牌组构成公开但顺序隐藏。复苏时你会获得八张牌到个人牌库底，并立刻激活他的诅咒，献上宝石(💎)才能解除。点击可以查看角色能力和测试牌表。",
    en: "A sleeping character's deck list is public but its order is hidden. Reviving it puts eight cards at the bottom of your personal deck and activates its curse at once, which only a jewel (💎) can lift. Click to read the character and its prototype card list."
  },
  jewel: {
    zh: "点宝石(💎)打开配方，再在抽屉里选择手牌和一位还没有宝石(💎)的复苏者。消耗掉的牌进入生命之河(🌊)，双色牌可以任选一色，稀有牌(🌈)可以替代，能力牌只能用于任意两张或三张。",
    en: "Tap the jewel (💎) to open the recipes, then pick hand cards and a revived eternal that has no jewel (💎) yet. The spent cards enter the river of life (🌊). A dual-colour card may use either half, a rare card (🌈) may stand in for anything, and ability cards only fit the any-two or any-three recipes."
  },
  river: {
    zh: "任何手牌都可以放进生命之河(🌊)。凑到五张就全部弃掉并且只领取一次奖励，前三份是稀有牌(🌈)，之后就是 Game Over，美杜莎能把稀有牌(🌈)放回奖励顶。",
    en: "Any hand card may enter the river of life (🌊). At five cards the river is cleared and hands out one reward only. The first three are rare cards (🌈) and the next is a Game Over, while Medusa can put a rare card (🌈) back on top of the rewards."
  },
  give: {
    zh: "消耗一颗共享心(❤️)，把一张手牌暗中交给队友。接收者的手牌可以超过三张，只有你在回合结束时补牌。",
    en: "Spend one shared heart (❤️) to hand a card secretly to a teammate. The receiver may go above three cards and only you refill at the end of the turn."
  },
  ability: {
    zh: "先选择手中的能力牌，再点 Use Ability，选择目标并确认。具体效果会显示在行动区域里。",
    en: "Select an ability card in your hand, press Use Ability, then choose a target and confirm. The exact effect is spelled out in the action area."
  },
  confirm: {
    zh: "这个按钮只会提交服务器验证过的行动。先完成选牌、选目标和必要的选项，按钮变灰时请检查轮次、诅咒、场地条件、剩余资源以及宝石(💎)配方。",
    en: "This button only submits a move the server has already validated. Finish the card, target and any required options first. When it is greyed out, check the turn order, curses, field conditions, remaining resources and the jewel (💎) recipes."
  },
  disc: {
    zh: "每人有两个交流圆片。点场地或河流的任意格子，选 Discs，再选要放的圆片，已经有牌的格子也能放，Return 可以收回。放圆片不消耗回合，也不保证那张牌真的放得下去。",
    en: "Everyone has two communication discs. Tap any field or river space, choose Discs, then pick the disc to place. Spaces that already hold a card are fine and Return takes a disc back. Placing a disc costs no turn and never guarantees the card fits."
  },
  next: {
    zh: "每一整圈和重要结算之后都会暂停，所有席位分别确认才继续，掉线的玩家也需要回来确认。已经清空的场地和河流仍然会在回顾里保留。",
    en: "The game pauses after each full lap and after every important payout. Every seat confirms separately before play continues and a disconnected player still has to come back. Emptied fields and river cards stay visible in the review."
  },
  ready: {
    zh: "先商量起始玩家和路线。改变起始玩家会清空所有人的确认，全员 Ready 之后游戏开始。",
    en: "Agree on the first explorer and on a route first. Changing the first explorer clears every confirmation, and the game starts once all players are Ready."
  },
  rotate: {
    zh: "双色牌的左右半色分别约束左邻牌和右邻牌。翻转只改变方向，不改变数字，提交之后方向就固定了。",
    en: "The left and right halves of a dual-colour card constrain the neighbours on their own side. Flipping only changes the orientation and never the number, and the orientation is locked once you submit."
  },
  discussion: {
    zh: "幽灵会暂时公开全员手牌，大家可以自由讨论。所有玩家确认 End Discussion 之后手牌恢复私密，游戏继续。",
    en: "The ghost reveals every hand for a while so the table can talk freely. Once all players confirm End Discussion the hands become private again and play continues."
  },
  help: {
    zh: "打开永恒牌的完整规则说明，包含目标、回合结构、三种主行动、永恒族与复苏、宝石(💎)与河流、以及交流限制。",
    en: "Open the full Eternal Decks rules: the goal, the turn structure, the three main actions, eternals and revival, jewels (💎) and the river, and the table-talk limits."
  },
  explain: {
    zh: "打开解释模式之后再点界面上的任意控件，就会显示这个控件的说明。解释模式下不会执行任何游戏动作，按 Esc 可以退出。",
    en: "Turn on explain mode and then tap any control to read what it does. No game action is ever performed in explain mode and Esc leaves it."
  }
};

let eternalDecksHelpWidget = null;
let eternalDecksExplainWidget = null;

(() => {
  "use strict";
  const panel = document.getElementById("eternalDecksPanel");
  const header = document.getElementById("eternalDecksHeaderActions");
  const helpButton = document.getElementById("eternalDecksHelpBtn");
  const explainButton = document.getElementById("eternalDecksExplainBtn");
  const dialog = document.getElementById("eternalDecksDialog");
  const dialogTitle = document.getElementById("eternalDecksDialogTitle");
  const dialogBody = document.getElementById("eternalDecksDialogBody");
  const dialogClose = document.getElementById("eternalDecksDialogClose");
  const icons = {red: "🔴", blue: "🔵", green: "🟢", yellow: "🟡", purple: "🟣"};
  const colorNames = {red: "红色", blue: "蓝色", green: "绿色", yellow: "黄色", purple: "紫色"};
  let view = null;
  let signature = null;
  let selectedCards = [];
  let selectedRow = null;
  let selectedTarget = null;
  let selectedRecipe = null;
  let selectedOption = null;
  let selectedPosition = null;
  let orientation = "normal";
  let mode = "browse";
  let drawerOpen = false;
  let pending = false;
  let pendingTimer = null;
  let tipTimer = null;
  let returnFocus = null;
  const openDetails = new Set();
  const dockObserver = new ResizeObserver(entries => {
    if (!entries[0].target.isConnected) return;
    panel.style.setProperty("--ed-dock-height", `${Math.ceil(entries[0].target.getBoundingClientRect().height) + 16}px`);
    window.requestAnimationFrame(keepSpaceVisible);
  });

  function initEternalDecksHelpExplain() {
    if (eternalDecksHelpWidget || typeof window.obgCreateHelp !== "function") return;
    eternalDecksHelpWidget = window.obgCreateHelp(ETERNAL_DECKS_HELP_CONFIG);
    eternalDecksExplainWidget = window.obgCreateExplain({
      gameId: "eternal_decks",
      attribute: "data-ed-explain",
      explanations: ETERNAL_DECKS_EXPLAIN,
      button: explainButton,
      root: () => panel,
      bypass: ["#eternalDecksHelpBtn", "#eternalDecksExplainBtn"],
      onChange: active => { if (active) hideTip(); }
    });
    helpButton?.addEventListener("click", () => {
      eternalDecksExplainWidget?.exit();
      eternalDecksHelpWidget.open();
    });
    explainButton?.addEventListener("click", () => eternalDecksExplainWidget?.toggle());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEternalDecksHelpExplain);
  } else {
    initEternalDecksHelpExplain();
  }

  const explaining = () => Boolean(eternalDecksExplainWidget?.isActive());
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const own = () => view?.players.find(player => player.player_id === view.you);
  const name = pid => view.players.find(player => player.player_id === pid)?.name || "—";
  const available = type => !pending && view?.legal_actions.includes(type);
  const button = (label, action, key, disabled = false, attrs = "") => `<button type="button" data-ed-action="${action}" data-ed-explain="${key}" ${disabled ? "disabled" : ""} ${attrs}>${label}</button>`;
  const sameIds = (a, b) => a.length === b.length && a.every(id => b.includes(id));
  const selectedCard = () => own()?.hand.find(card => card.id === selectedCards[0]);

  function cardLabel(card) {
    if (card.kind === "rare" || card.as_rare) return "🌈 Rare";
    if (card.kind === "ability") return `${view.eternals[card.source].icon} ${view.eternals[card.source].name}`;
    const colors = card.colors.slice();
    if (card.orientation === "rotated") colors.reverse();
    return `${colors.map(color => icons[color]).join(" / ")} ${card.number}`;
  }

  function cardDescription(card) {
    if (card.kind === "rare" || card.as_rare) return "🌈 Rare（稀有牌）：放入场地时忽略数字、颜色和升降序限制；女巫诅咒仍可禁止它。生成宝石时可替代任意数字或颜色。";
    if (card.kind === "ability") {
      const eternal = view.eternals[card.source];
      const effect = card.ability === "reveal" ? "暂时公开全员手牌，所有人确认 End Discussion 后恢复隐藏。" : eternal.effect;
      return `${eternal.icon} ${eternal.name} · 能力牌：${effect}`;
    }
    const colors = card.colors.slice();
    if (card.orientation === "rotated") colors.reverse();
    if (colors.length === 2) return `${colors.map(color => `${icons[color]} ${colorNames[color]}`).join(" / ")} · 数字 ${card.number}（双色牌）。左右半色分别约束相邻牌；出牌前可翻转，生成宝石时可任选其中一色。`;
    return `${icons[colors[0]]} ${colorNames[colors[0]]} · 数字 ${card.number}（普通牌）。用于场地排列或宝石配方；相邻牌须不同色、不同数，并遵守场地与诅咒限制。`;
  }

  function cardHTML(card, hand = false) {
    const rare = card.kind === "rare" || card.as_rare;
    const ability = card.kind === "ability" && !rare;
    const colors = card.colors.slice();
    if (card.orientation === "rotated" || (hand && selectedCards.includes(card.id) && orientation === "rotated")) colors.reverse();
    const colorClass = rare ? "rare" : ability ? "ability" : colors.join("-");
    const symbol = rare ? "✦" : ability ? view.eternals[card.source].icon : card.number;
    const footer = rare ? "RARE" : ability ? view.eternals[card.source].name : colors.map(color => icons[color]).join(" ");
    const content = `<span class="eternal-decks-card-value">${symbol}</span><span class="eternal-decks-card-color">${footer}</span>`;
    const blocked = hand && mode === "play" && !view.field_checks.some(check => check.card_id === card.id && check.row === selectedRow && check.legal);
    const attrs = `class="eternal-decks-card eternal-decks-${colorClass}${selectedCards.includes(card.id) && hand ? " is-selected" : ""}${blocked ? " is-unavailable" : ""}" aria-label="${esc(cardLabel(card))}${blocked ? " · Cannot play here" : ""}"`;
    return hand ? `<button type="button" ${attrs} data-ed-action="card" data-ed-explain="card" data-card="${card.id}" aria-pressed="${selectedCards.includes(card.id)}">${content}</button>` : `<span ${attrs} tabindex="0" data-ed-tip="${esc(cardDescription(card))}">${content}</span>`;
  }

  function discsAt(position) {
    return view.players.flatMap(player => player.discs.map((disc, index) => {
      const label = `${player.name} · Communication disc ${index + 1}`;
      return disc.position === position ? `<span title="${esc(label)}" data-ed-tip="${esc(label)}" tabindex="0" aria-label="${esc(label)}">${icons[player.color]}</span>` : "";
    })).join("");
  }

  function fieldHTML(row, index) {
    const field = view.fields[row.field];
    const capacity = 7 - row.sleeping.length;
    const cells = Array.from({length: 7}, (_, slot) => {
      const sleeping = row.sleeping[slot - capacity];
      const sleeperLabel = sleeping ? `${sleeping} · ${view.eternals[sleeping].name} is sleeping here.` : "";
      const content = row.cards[slot] ? cardHTML(row.cards[slot]) : sleeping ? `<span class="eternal-decks-sleeper" title="${esc(sleeperLabel)}" data-ed-tip="${esc(sleeperLabel)}">💤<small>${sleeping}</small></span>` : `<span class="eternal-decks-empty">${slot + 1}</span>`;
      const next = slot === row.cards.length && slot < capacity && !row.closed;
      return button(`${content}<span class="eternal-decks-disc-markers">${discsAt(index * 7 + slot)}</span>`, "slot", "field", false,
        `class="eternal-decks-slot ${next ? "is-next" : ""} ${selectedPosition === index * 7 + slot ? "is-selected" : ""}" data-row="${index}" data-position="${index * 7 + slot}" aria-label="Row ${index + 1}, slot ${slot + 1}${next ? ", next space" : ""}"`);
    }).join("");
    return `<section class="eternal-decks-field ${selectedRow === index ? "is-selected" : ""} ${row.closed ? "is-closed" : ""}">
      <div class="eternal-decks-field-heading"><h3 data-ed-tip="${esc(field.rule)}" tabindex="0">${field.icon} ${field.name}</h3><span>${row.closed ? "✓ Closed" : `Lap ${row.lap}/4 · ${row.cards.length}/${capacity}`}</span></div>
      <div class="eternal-decks-seven">${cells}</div><p class="eternal-decks-field-rule">${esc(field.rule)}</p>
      <div class="eternal-decks-field-footer"><div class="eternal-decks-sleeping">${row.sleeping.map(eid => button(`${view.eternals[eid].icon} ${view.eternals[eid].name}`, "eternal", "eternal", false, `data-eternal="${eid}"`)).join("")}</div><span data-ed-tip="${["⛺ 营地：第四圈完成后，把另一条未关闭的场地改成营地。", "❤️ 心：第四圈完成后，恢复全部三颗共享心。", "⭐ 星星：第四圈完成后，获得一颗星。"][index]}" tabindex="0">${["⛺", "❤️", "⭐"][index]} Lap 4</span></div></section>`;
  }

  function riverHTML() {
    return `<section class="eternal-decks-river"><div class="eternal-decks-field-heading"><h3>🌊 生命之河</h3><span class="${view.river_reward_count ? "" : "eternal-decks-danger"}">Next: ${view.river_reward_count ? `🌈 Rare · ${view.river_reward_count} left` : "⚠ Game Over"}</span></div>
      <div class="eternal-decks-five">${Array.from({length: 5}, (_, i) => button(`${view.river[i] ? cardHTML(view.river[i]) : `<span class="eternal-decks-empty">${i + 1}</span>`}<span class="eternal-decks-disc-markers">${discsAt(21 + i)}</span>`, "river-slot", "river", false, `class="eternal-decks-slot ${i === view.river.length ? "is-next" : ""} ${selectedPosition === 21 + i ? "is-selected" : ""}" data-position="${21 + i}" aria-label="River slot ${i + 1}"`)).join("")}</div></section>`;
  }

  function revivalHTML() {
    return `<section class="eternal-decks-revival"><div class="eternal-decks-field-heading"><h3>✧ 复苏区</h3><span>${view.revived.length}/9</span></div>
      ${view.revived.length ? `<div class="eternal-decks-eternals">${view.revived.map((item, i) => {
        const eternal = view.eternals[item.id];
        return button(`<span>${i + 1} · ${eternal.icon} ${eternal.name} ${item.jewel ? "💎" : ""}</span><small>${item.jewel ? "诅咒已解除" : eternal.curse}</small>`, "revived", "eternal", false, `class="${item.jewel ? "is-blessed" : "is-cursed"} ${selectedTarget === item.id ? "is-selected" : ""}" data-eternal="${item.id}"`);
      }).join("")}</div>` : '<p class="eternal-decks-muted">填满任一场地，唤醒第一位永恒族。</p>'}</section>`;
  }

  function candidate() {
    if (!view || pending) return null;
    if (mode === "ability") {
      const move = view.moves[selectedOption];
      return move?.type === "ability" && move.card_id === selectedCards[0] ? move : null;
    }
    return view.moves.find(move => {
      if (mode === "jewel") return move.type === "generate" && move.recipe === selectedRecipe && move.target === selectedTarget && sameIds(move.card_ids, selectedCards);
      if (mode === "give") return move.type === "give" && move.card_id === selectedCards[0] && move.target === selectedTarget;
      if (mode === "river") return canPlayAtPosition() && move.type === "river" && move.card_id === selectedCards[0];
      return mode === "play" && canPlayAtPosition() && move.type === "place" && move.card_id === selectedCards[0] && move.row === selectedRow && move.orientation === orientation;
    });
  }

  function abilityLabel(move) {
    const opt = move.options;
    if (opt.recipe) return `💎 ${view.recipes[opt.recipe].name} → ${view.eternals[opt.target].name}`;
    if (opt.row !== undefined) return `Row ${opt.row + 1} · Slot ${opt.slot + 1} · ${cardLabel(view.rows[opt.row].cards[opt.slot])}`;
    if (opt.card_ids) return opt.card_ids.length ? opt.card_ids.map(id => cardLabel(view.river.find(card => card.id === id))).join(" + ") : "Take no cards";
    if (opt.card_id) return `Recycle ${cardLabel(view.discard.find(card => card.id === opt.card_id))}`;
    return "Activate";
  }

  function reviewHTML() {
    return `<section class="eternal-decks-review"><h3>${view.result ? (view.result.success ? "🏆 Together, victorious" : "🌙 Journey ended") : "⏸ Review together"}</h3>
      ${view.result ? `<p>${esc(view.result.reason)}</p>` : ""}
      ${view.review_notes.map(note => `<p>${esc(note)}</p>`).join("")}
      ${view.review_cards.map(pile => `<div><span>${esc(pile.label)}</span><div class="eternal-decks-mini-hand">${pile.cards.map(card => cardHTML(card)).join("")}</div></div>`).join("")}
      ${view.game_over ? "" : `${button(`Next Round · ${view.next_ready.length}/${view.players.length}`, "next", "next", !available("next_round"), 'class="eternal-decks-primary"')}<p class="eternal-decks-muted">Waiting: ${view.players.filter(player => !view.next_ready.includes(player.player_id)).map(player => esc(player.name)).join(", ") || "—"}</p>`}</section>`;
  }

  function phaseHTML() {
    const player = own();
    if (!player) return '<section class="eternal-decks-action-box"><h3>Spectator</h3><p>Hidden hands stay private.</p></section>';
    let controls = "";
    if (view.phase === "setup") {
      controls = `<h3>Choose the first explorer</h3><div class="eternal-decks-choice-grid">${view.players.map(item => button(`${icons[item.color]} ${esc(item.name)}`, "start", "ready", !available("choose_start"), `data-player="${item.player_id}" aria-pressed="${view.start_player === item.player_id}"`)).join("")}</div>${button(`Ready · ${view.ready.length}/${view.players.length}`, "ready", "ready", !available("ready"), 'class="eternal-decks-primary"')}`;
    } else if (view.phase === "revival") {
      controls = `<h3>✨ 选择复苏者</h3><p>牌库加入你的牌库底；诅咒立即生效。</p><div class="eternal-decks-choice-grid">${view.rows[view.pending_row].sleeping.map(eid => button(`${view.eternals[eid].icon} ${view.eternals[eid].name}<small>${view.eternals[eid].curse}</small>`, "revive", "eternal", !available("revive"), `data-eternal="${eid}"`)).join("")}</div>`;
    } else if (view.phase === "camp_choice") {
      controls = `<h3>⛺ 营地奖励</h3><p>把另一条未关闭的场地改成营地。</p>${view.rows.map((row, index) => index && !row.closed ? button(`Row ${index + 1}`, "camp", "field", !available("camp"), `data-row="${index}"`) : "").join("")}`;
    } else if (view.phase === "discussion") {
      controls = `<h3>👻 公开讨论</h3><p>全员手牌暂时公开。所有人确认后恢复私密。</p>${button(`End Discussion · ${view.discussion_ready.length}/${view.players.length}`, "discussion", "discussion", !available("end_discussion"), 'class="eternal-decks-primary"')}`;
    }
    return controls ? `<section class="eternal-decks-action-box">${controls}</section>` : "";
  }

  function positionLabel(position) {
    if (position < 0) return "Not placed";
    if (position >= 21) return `🌊 生命之河 · Slot ${position - 20}`;
    const field = view.fields[view.rows[Math.floor(position / 7)].field];
    return `${field.icon} ${field.name} · Row ${Math.floor(position / 7) + 1} · Slot ${position % 7 + 1}`;
  }

  function canPlayAtPosition() {
    if (selectedPosition === null) return false;
    if (selectedPosition >= 21) return selectedPosition - 21 === view.river.length && available("river");
    const row = view.rows[Math.floor(selectedPosition / 7)];
    return !row.closed && selectedPosition % 7 === row.cards.length && row.cards.length < 7 - row.sleeping.length && available("place");
  }

  function recipesHTML() {
    return `<div class="eternal-decks-jewels">${Object.entries(view.recipes).map(([id, recipe]) => button(`${view.jewels[id] ? "💎" : "✓"} ${recipe.name}`, "recipe", "jewel", !view.jewels[id] || !available("generate"), `data-recipe="${id}"`)).join("")}</div>`;
  }

  function drawerBodyHTML() {
    const player = own();
    const card = selectedCard();
    if (mode === "recipes") return `${recipesHTML()}${!view.revived.some(item => !item.jewel) ? '<p class="eternal-decks-selection">先复苏一位永恒族，再为其生成宝石。</p>' : ""}`;
    let controls = "";
    if (selectedPosition !== null) {
      const playMode = selectedPosition >= 21 ? "river" : "play";
      controls += `<div class="eternal-decks-action-tabs">${button("🃏 Play card", "mode", playMode === "river" ? "river" : "field", !canPlayAtPosition(), `data-mode="${playMode}" aria-pressed="${mode === playMode}"`)}${button(`${icons[player.color]} Discs`, "mode", "disc", !available("move_disc"), `data-mode="disc" aria-pressed="${mode === "disc"}"`)}</div>`;
    }
    if (mode === "disc") {
      return `${controls}<p class="eternal-decks-muted">Communication discs · No turn cost</p><div class="eternal-decks-disc-list">${player.discs.map((disc, index) => `<div class="eternal-decks-disc-choice"><span><strong>${icons[player.color]} ${index + 1}</strong><small>${esc(positionLabel(disc.position))}</small></span><div>${button(disc.position === selectedPosition ? "✓ Here" : "Place here", "disc", "disc", !available("move_disc") || disc.position === selectedPosition, `data-disc="${index}"`)}${button("Return", "return-disc", "disc", !available("move_disc") || disc.position < 0, `data-disc="${index}"`)}</div></div>`).join("")}</div>`;
    }
    if (mode === "jewel") controls += `<div class="eternal-decks-drawer-subheading"><span>${esc(view.recipes[selectedRecipe].name)} · ${selectedCards.length}/${view.recipes[selectedRecipe].count}</span>${button("Change recipe", "jewels", "jewel")}</div>`;
    controls += `<div class="eternal-decks-hand">${player.hand.map(item => cardHTML(item, true)).join("") || '<span class="eternal-decks-muted">No cards</span>'}</div>`;
    if (mode === "browse") {
      controls += '<p class="eternal-decks-selection">Tap a field or river space to play.</p>';
      if (card?.kind === "ability" && !card.as_rare) controls += `<p class="eternal-decks-selection">${esc(cardDescription(card))}</p>${button("Use Ability ✦", "mode", "ability", !available("ability"), 'data-mode="ability" class="eternal-decks-primary"')}`;
      return controls;
    }
    let hint = "Select a card.";
    if (mode === "give") {
      controls += `<div class="eternal-decks-choice-grid">${view.players.filter(item => item.player_id !== view.you).map(item => button(`${icons[item.color]} ${esc(item.name)}`, "target", "give", !available("give"), `data-target="${item.player_id}" aria-pressed="${selectedTarget === item.player_id}"`)).join("")}</div>`;
      hint = "Choose a card and a teammate · Costs 1 ❤️";
    } else if (mode === "jewel") {
      controls += `<div class="eternal-decks-choice-grid">${view.revived.filter(item => !item.jewel).map(item => button(`${view.eternals[item.id].icon} ${view.eternals[item.id].name}`, "target", "jewel", false, `data-target="${item.id}" aria-pressed="${selectedTarget === item.id}"`)).join("")}</div>`;
      hint = "Choose cards and an Eternal to receive 💎.";
    } else if (mode === "ability") {
      controls += card?.kind === "ability" ? `<div class="eternal-decks-ability-options">${view.moves.map((move, index) => move.type === "ability" && move.card_id === card.id ? button(esc(abilityLabel(move)), "option", "ability", false, `data-option="${index}" aria-pressed="${selectedOption === index}"`) : "").join("")}</div>` : "";
      hint = card?.kind === "ability" ? cardDescription(card) : "Select an ability card.";
    } else if (mode === "play") {
      const check = view.field_checks.find(item => item.card_id === card?.id && item.row === selectedRow && item.orientation === orientation);
      hint = check?.reason || "Choose a card for this space.";
      if (card?.colors.length === 2) controls += button(`↔ ${orientation === "normal" ? "Normal" : "Rotated"}`, "rotate", "rotate");
    } else if (mode === "river") {
      hint = view.river.length === 4 && !view.river_reward_count ? "⚠ 这张牌将填满河流，领取 Game Over。" : "Choose a card for the river.";
    }
    const chosen = candidate();
    const labels = {play: "Play card", river: "Place in river", give: "Give ❤️", jewel: "Generate 💎", ability: "Use Ability ✦"};
    return `${controls}<p class="eternal-decks-selection" aria-live="polite">${esc(hint)}</p>${button(pending ? "Sending…" : labels[mode], "confirm", "confirm", !chosen, `class="eternal-decks-primary"`)}`;
  }

  function drawerHTML() {
    const player = own();
    if (!player) return "";
    const title = selectedPosition !== null ? positionLabel(selectedPosition) : {recipes: "💎 宝石配方", jewel: "💎 生成宝石", give: "Give ❤️", ability: "Ability ✦"}[mode] || `🃏 ${player.hand_count} cards`;
    return `<section class="eternal-decks-dock ${drawerOpen ? "is-open" : ""}" aria-label="Cards and actions">
      ${button(`<span class="eternal-decks-dock-grip" aria-hidden="true"></span><span class="eternal-decks-dock-label"><strong id="eternalDecksDrawerTitle">${esc(drawerOpen ? title : `🃏 ${player.hand_count} cards`)}</strong><span>${drawerOpen ? `${player.hand_count} cards · ` : ""}${player.deck_count} in deck</span></span><span class="eternal-decks-dock-toggle-label">${drawerOpen ? "Close ↓" : "Open ↑"}</span>`, "drawer", "card", false, `class="eternal-decks-dock-toggle" aria-expanded="${drawerOpen}" aria-controls="eternalDecksDrawerBody"`)}
      <div id="eternalDecksDrawerBody" class="eternal-decks-drawer-body" role="region" aria-labelledby="eternalDecksDrawerTitle" ${drawerOpen ? "" : "hidden"}>${drawerOpen ? drawerBodyHTML() : ""}</div>
    </section>`;
  }

  function playersHTML() {
    return view.players.map(player => `<div class="eternal-decks-player ${view.current_turn === player.player_id ? "is-current" : ""}"><div><strong>${icons[player.color]} ${esc(player.name)}${player.player_id === view.you ? " · You" : ""}</strong><span>${player.hand_count} cards · ${player.deck_count} in deck</span></div>${view.hands_revealed && player.player_id !== view.you ? `<div class="eternal-decks-mini-hand">${player.hand.map(card => cardHTML(card)).join("")}</div>` : ""}</div>`).join("");
  }

  function render() {
    if (!view) return;
    const player = own();
    const focused = panel.contains(document.activeElement) ? document.activeElement.dataset : null;
    const focusInDock = Boolean(document.activeElement.closest(".eternal-decks-dock"));
    const drawerScroll = panel.querySelector(".eternal-decks-drawer-body")?.scrollTop || 0;
    dockObserver.disconnect();
    const status = view.game_over ? (view.result.success ? "The stars are yours" : "The journey rests") : view.phase === "setup" ? "Prepare together" : view.phase === "round_end" ? "Review · Waiting for everyone" : view.phase === "discussion" ? "Ghost · Open discussion" : `${view.current_turn === view.you ? "Your turn" : name(view.current_turn) + "’s turn"}`;
    panel.innerHTML = `<div class="eternal-decks-shell"><div class="eternal-decks-title"><span class="eternal-decks-subtitle">Stage A · First Encounter · Beginner</span><div class="eternal-decks-counters"><strong title="Team stars: ${view.stars.length} of 4" data-ed-tip="Collect any four stars to win together." tabindex="0">⭐ ${view.stars.length}<small>/4</small></strong><span title="Shared hearts: ${view.hearts} of 3" data-ed-tip="Shared hearts pay for giving a hidden card to a teammate." tabindex="0">❤️ ${view.hearts}/3</span></div></div>
      <div class="eternal-decks-status"><strong role="status">${esc(status)}</strong><span>Turn ${view.turn_count + 1}</span></div>
      <p class="eternal-decks-notice" title="Prototype card list for 2 or 4 seats; not a complete retail reproduction." data-ed-tip="Prototype card list for 2 or 4 seats; not a complete retail reproduction." tabindex="0">Stage A · Beginner · Prototype</p>
      <div class="eternal-decks-layout"><div class="eternal-decks-table">${view.rows.map(fieldHTML).join("")}${riverHTML()}</div>
      <aside class="eternal-decks-sidebar">${phaseHTML()}
      ${view.phase === "round_end" || view.game_over ? reviewHTML() : ""}
      ${player ? `<div class="eternal-decks-resources">${button(`<span>💎 宝石</span><small>${Object.values(view.jewels).filter(Boolean).length}/8</small>`, "jewels", "jewel", false, `aria-expanded="${drawerOpen && ["recipes", "jewel"].includes(mode)}" aria-controls="eternalDecksDrawerBody"`)}${button(`<span>Give ❤️</span><small>${view.hearts}/3</small>`, "give", "give", !available("give"), `aria-expanded="${drawerOpen && mode === "give"}" aria-controls="eternalDecksDrawerBody"`)}</div>` : ""}
      ${revivalHTML()}</aside></div>
      <div class="eternal-decks-player-list">${playersHTML()}</div>
      <div class="eternal-decks-table-talk" aria-label="Table-talk reminders"><button type="button" class="eternal-decks-rule-chip" title="Do not reveal the number, color, dual-color information, or missing cards from an ordinary hand." data-ed-tip="Do not reveal the number, color, dual-color information, or missing cards from an ordinary hand.">🤫 Hand privacy</button><button type="button" class="eternal-decks-rule-chip" title="Rare cards, ability cards, and all public board information may be discussed." data-ed-tip="Rare cards, ability cards, and all public board information may be discussed.">🌈 Public talk OK</button></div>
      <div class="eternal-decks-details-grid"><details data-ed-detail="stars" ${openDetails.has("stars") ? "open" : ""}><summary>⭐ Star objectives · ${view.stars.length}/4</summary><ul>${Object.entries(view.star_goals).map(([id, goal]) => `<li>${view.stars.includes(id) ? "✅" : "☆"} ${esc(goal)}</li>`).join("")}</ul><p>A 系能力牌：${view.stage_card_count}/3</p></details>
      <details data-ed-detail="discard" ${openDetails.has("discard") ? "open" : ""}><summary>Discard · ${view.discard_count}${view.strict_discard ? " · Hidden" : ""}</summary><div class="eternal-decks-discard">${view.discard.map(card => cardHTML(card)).join("")}</div></details>
      <details data-ed-detail="log" ${openDetails.has("log") ? "open" : ""}><summary>Activity</summary><ol class="eternal-decks-log">${view.log.slice().reverse().map(item => `<li>${esc(item)}</li>`).join("")}</ol></details></div>${drawerHTML()}<div class="eternal-decks-toast" role="status" aria-live="polite"></div></div>`;
    panel.classList.toggle("eternal-decks-has-dock", Boolean(player));
    panel.querySelectorAll("details").forEach(element => element.addEventListener("toggle", () => element.open ? openDetails.add(element.dataset.edDetail) : openDetails.delete(element.dataset.edDetail)));
    const dock = panel.querySelector(".eternal-decks-dock");
    if (dock) dockObserver.observe(dock);
    if (drawerOpen) panel.querySelector(".eternal-decks-drawer-body").scrollTop = drawerScroll;
    if (focused?.edAction) {
      const keys = ["edAction", "card", "position", "mode", "target", "recipe", "option", "disc", "player", "eternal", "row"];
      const replacement = Array.from(panel.querySelectorAll("[data-ed-action]")).find(element => keys.every(key => element.dataset[key] === focused[key]));
      (replacement || (focusInDock ? panel.querySelector(".eternal-decks-dock-toggle") : null))?.focus({preventScroll: true});
    }
  }

  function resetSelection() {
    selectedCards = []; selectedRow = null; selectedTarget = null; selectedRecipe = null;
    selectedOption = null; selectedPosition = null; orientation = "normal"; mode = "browse"; drawerOpen = false;
  }
  function openDialog(title, body, html = false) {
    hideTip();
    returnFocus = document.activeElement;
    dialogTitle.textContent = title;
    if (html) dialogBody.innerHTML = body; else dialogBody.textContent = body;
    if (!dialog.open) dialog.showModal();
    dialogClose.focus();
  }
  function showEternal(id) {
    const eternal = view.eternals[id];
    openDialog(`${eternal.icon} ${eternal.name} · ${id}`, `<p><strong>诅咒：</strong>${esc(eternal.curse)}</p><p><strong>能力：</strong>${esc(eternal.effect)}</p><p>Prototype card data · Public composition, shuffled order hidden.</p><div class="eternal-decks-mini-hand">${eternal.deck.map(card => cardHTML(card)).join("")}</div>`, true);
  }
  function submit(action) {
    if (!action || pending) return;
    pending = true;
    resetSelection();
    render();
    sendAction(action);
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => { pending = false; render(); }, 5000);
  }
  function moveDisc(index, position) {
    if (!available("move_disc") || !own()?.discs[index] || position === null) return;
    submit({type: "move_disc", disc: index, position, seq: own().discs[index].seq + 1});
  }

  function hideTip() {
    window.clearTimeout(tipTimer);
    [panel, dialog].forEach(root => root.querySelector(".eternal-decks-toast")?.classList.remove("is-visible"));
  }

  function showTip(text, anchor, autoHide = true) {
    const root = dialog.open && dialog.contains(anchor) ? dialog : panel;
    const toast = root.querySelector(".eternal-decks-toast");
    if (!toast || !text) return;
    hideTip();
    toast.textContent = text;
    if (anchor?.isConnected) {
      const rect = anchor.getBoundingClientRect();
      const tip = toast.getBoundingClientRect();
      const center = Math.max(tip.width / 2 + 12, Math.min(window.innerWidth - tip.width / 2 - 12, rect.left + rect.width / 2));
      const top = rect.bottom + tip.height + 12 < window.innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - tip.height - 8);
      toast.style.left = `${center}px`;
      toast.style.top = `${top}px`;
      toast.style.bottom = "auto";
    }
    toast.classList.add("is-visible");
    if (autoHide) tipTimer = window.setTimeout(hideTip, 3000);
  }

  function openSpace(position) {
    if (!own()) return;
    resetSelection();
    selectedPosition = position;
    selectedRow = position < 21 ? Math.floor(position / 7) : null;
    mode = canPlayAtPosition() ? (position >= 21 ? "river" : "play") : "disc";
    drawerOpen = true;
    render();
    panel.querySelector(".eternal-decks-dock-toggle")?.focus({preventScroll: true});
  }

  function keepSpaceVisible() {
    if (!drawerOpen || selectedPosition === null || dialog.open) return;
    const space = panel.querySelector(`[data-position="${selectedPosition}"]`);
    const dock = panel.querySelector(".eternal-decks-dock");
    if (!space || !dock) return;
    const rect = space.getBoundingClientRect();
    const dockTop = dock.getBoundingClientRect().top;
    if (rect.bottom > dockTop - 16) window.scrollBy({top: rect.bottom - dockTop + 24, behavior: "smooth"});
  }

  function selectOnlyAbilityOption() {
    const options = view.moves.map((move, index) => ({move, index})).filter(item => item.move.type === "ability" && item.move.card_id === selectedCards[0]);
    selectedOption = options.length === 1 ? options[0].index : null;
  }

  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-ed-action]");
    if (!target || target.disabled || explaining() || !view) return;
    const data = target.dataset;
    switch (data.edAction) {
      case "card":
        if (mode === "jewel") {
          if (selectedCards.includes(data.card)) selectedCards = selectedCards.filter(id => id !== data.card);
          else if (selectedCards.length < view.recipes[selectedRecipe].count) selectedCards.push(data.card);
        }
        else selectedCards = selectedCards[0] === data.card ? [] : [data.card];
        selectedOption = null; orientation = "normal";
        if (mode === "ability") selectOnlyAbilityOption();
        if (mode === "play") orientation = view.field_checks.find(check => check.card_id === selectedCards[0] && check.row === selectedRow && check.legal)?.orientation || "normal";
        break;
      case "slot":
      case "river-slot":
        openSpace(Number(data.position)); return;
      case "drawer":
        if (drawerOpen) resetSelection();
        else drawerOpen = true;
        break;
      case "mode":
        mode = data.mode; selectedCards = selectedCards.slice(0, 1); selectedTarget = null; selectedOption = null;
        if (mode === "ability") selectOnlyAbilityOption();
        break;
      case "rotate": orientation = orientation === "normal" ? "rotated" : "normal"; break;
      case "jewels": resetSelection(); mode = "recipes"; drawerOpen = true; break;
      case "give":
        resetSelection(); mode = "give"; drawerOpen = true;
        if (view.players.length === 2) selectedTarget = view.players.find(player => player.player_id !== view.you).player_id;
        break;
      case "recipe": {
        mode = "jewel"; selectedRecipe = data.recipe; selectedCards = [];
        const targets = view.revived.filter(item => !item.jewel);
        selectedTarget = targets.length === 1 ? targets[0].id : null;
        break;
      }
      case "target": selectedTarget = data.target; break;
      case "revived":
        if (mode === "jewel" && !view.revived.find(item => item.id === data.eternal).jewel) selectedTarget = data.eternal;
        else { showEternal(data.eternal); return; }
        break;
      case "eternal": showEternal(data.eternal); return;
      case "option": selectedOption = Number(data.option); break;
      case "confirm": submit(candidate()); return;
      case "start": submit({type: "choose_start", player_id: data.player}); return;
      case "ready": submit({type: "ready"}); return;
      case "next": submit({type: "next_round"}); return;
      case "revive": submit({type: "revive", eternal_id: data.eternal}); return;
      case "camp": submit({type: "camp", row: Number(data.row)}); return;
      case "discussion": submit({type: "end_discussion"}); return;
      case "disc": moveDisc(Number(data.disc), selectedPosition); return;
      case "return-disc": moveDisc(Number(data.disc), -1); return;
    }
    render();
  });

  [panel, dialog].forEach(root => {
    root.addEventListener("click", event => {
      const target = event.target.closest("[data-ed-tip]");
      if (!target || target.closest("[data-ed-action]") || explaining()) return;
      showTip(target.dataset.edTip, target);
    });
    root.addEventListener("pointerover", event => {
      const target = event.target.closest("[data-ed-tip]");
      if (!target || target.contains(event.relatedTarget) || explaining() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      showTip(target.dataset.edTip, target, false);
    });
    root.addEventListener("pointerout", event => {
      const target = event.target.closest("[data-ed-tip]");
      if (target && !target.contains(event.relatedTarget) && event.pointerType !== "touch") hideTip();
    });
    root.addEventListener("focusin", event => {
      if (event.target.matches("[data-ed-tip]")) showTip(event.target.dataset.edTip, event.target);
    });
    root.addEventListener("focusout", event => {
      if (event.target.matches("[data-ed-tip]")) hideTip();
    });
  });

  dialogClose.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { hideTip(); if (returnFocus?.isConnected) returnFocus.focus(); });
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  document.addEventListener("pointerdown", event => {
    if (!view || explaining() || !panel.contains(event.target) || event.target.closest("button, input, select, summary, a, dialog, [data-ed-tip]")) return;
    resetSelection(); render();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || panel.classList.contains("hidden")) return;
    hideTip();
    if (dialog.open) return;
    resetSelection(); render();
  });

  function clearState() {
    view = null; signature = null; pending = false;
    resetSelection(); openDetails.clear();
    dockObserver.disconnect(); hideTip();
    panel.classList.remove("eternal-decks-has-dock");
    panel.style.removeProperty("--ed-dock-height");
    window.clearTimeout(pendingTimer); window.clearTimeout(tipTimer);
    if (dialog.open) dialog.close();
    panel.innerHTML = "";
  }
  window.renderEternalDecksGameState = data => {
    if (!data?.view) return;
    const next = data.view;
    const nextSignature = JSON.stringify([data.room_id, next.phase, next.current_turn, next.turn_count, next.players.map(player => player.hand.map(card => card.id))]);
    if (signature !== nextSignature) resetSelection();
    signature = nextSignature; view = next; pending = false;
    window.clearTimeout(pendingTimer); render();
  };
  window.showEternalDecksHeaderActions = visible => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };
  window.clearEternalDecksState = clearState;
  window.getEternalDecksConfig = () => ({strict_discard: document.getElementById("eternalDecksStrictDiscard").checked});
  window.updateEternalDecksConfigRow = () => {
    const visible = currentGameType === "eternal_decks" && currentRoomState?.status === "lobby";
    const box = document.getElementById("eternalDecksConfigBox");
    box.classList.toggle("hidden", !visible); box.setAttribute("aria-hidden", String(!visible));
  };
  if (typeof socket !== "undefined") socket.on("system:error", () => { if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); } });
})();
