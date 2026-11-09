// 似帽非帽 / That's Not a Hat — browser client.
// Help & Explain follow designs/task40.md via the shared widgets.

// --- Help & Explain -------------------------------------------------------
const notAHatHelpButton = document.getElementById("notAHatHelpBtn");
const notAHatExplainButton = document.getElementById("notAHatExplainBtn");

const NOT_A_HAT_HELP_CONFIG = {
  gameId: "not_a_hat",
  title: { zh: "似帽非帽 · That's Not a Hat", en: "That's Not a Hat" },
  basic: {
    win: {
      zh: "谁收到的惩罚牌最少谁就赢，而一旦有人拿到第三张惩罚牌，整局立刻结束。",
      en: "The player holding the fewest penalty cards wins, and the game stops the instant somebody picks up a third one."
    },
    turn: {
      zh: "轮到你送礼时，你要说出最上面那张扣着的礼物是什么，收到礼物的人则要决定收下还是当场质疑。",
      en: "On your turn you announce what the face-down gift you are handing over actually is, and the player receiving it decides whether to accept it or call you out."
    },
    key: {
      zh: "礼帽(🎩)也好香蕉(🍌)也好，每张牌只公开亮过一次，之后全靠你记住它现在在谁手里，记不住就只能面不改色地吹牛。",
      en: "Whether it is a top hat (🎩) or a banana (🍌), every card is shown exactly once, so after that it is all memory, and once your memory slips you have to bluff with a straight face."
    }
  },
  sections: [
    {
      id: "setup",
      label: { zh: "开局与牌库", en: "Setup and deck" },
      html: {
        zh: "<p>牌库里有 110 张礼物牌，每张牌正面是一件日常物品，背面则印着一个箭头和一种底色，箭头指向左(⬅️)或右(➡️)，底色分为浅色和深色两半。</p>"
          + "<p>开局时每位玩家面前放一张正面朝上的礼物牌，所有人都能看清每一张牌，这正是你唯一一次免费记住全场的机会。</p>"
          + "<p>剩下的牌正面朝上叠成牌堆，这就是礼物商店(🎁)，牌堆顶上的那一张所有人都看得见。</p>"
          + "<p>所有人都按下 Ready 之后游戏才开始，此时起始玩家从礼物商店抽一张牌并展示给全场。</p>",
        en: "<p>The deck holds 110 gift cards. The front of each card is one everyday object, while the back carries an arrow pointing left (⬅️) or right (➡️) plus either a light or a dark background.</p>"
          + "<p>Every player starts with a single face-up gift in front of them, and the whole table can read all of them, which is your one free chance to memorise the board.</p>"
          + "<p>The remaining cards form a face-up pile called the gift shop (🎁), and everyone can see the card sitting on top of it.</p>"
          + "<p>Play only begins once everybody has pressed Ready, at which point the starting player draws one card from the gift shop and shows it to the table.</p>"
      }
    },
    {
      id: "giving",
      label: { zh: "送礼与收礼", en: "Giving and receiving" },
      html: {
        zh: "<p>轮到你送礼时，系统会指出你送出的是哪一张牌，那永远是你最老的那张礼物，也就是牌叠最下面那一张。</p>"
          + "<p>这张牌在递出去的一瞬间被翻成背面朝上，所以你也未必还记得它是什么。</p>"
          + "<p>你要从礼物清单里挑一件东西说出来，可以说实话，也可以吹牛。说出的名字所有人都听得到。</p>"
          + "<p>箭头决定这份礼物递给左邻还是右邻，界面上会直接把收礼人的名字写出来。</p>"
          + "<p>收到礼物的人有两个选择：道谢收下，或者喊出「这不是…」当场质疑。</p>",
        en: "<p>When it is your turn to give, the interface points at the exact card you are handing over, and it is always your oldest gift, meaning the card at the bottom of your stack.</p>"
          + "<p>That card is turned face down the moment it is offered, so even you may no longer remember what is on it.</p>"
          + "<p>You then pick an object from the gift list and say it out loud. You may tell the truth or you may bluff, and the whole table hears the name you chose.</p>"
          + "<p>The arrow decides whether the gift travels to your left or your right neighbour, and the interface spells out the receiver by name.</p>"
          + "<p>The receiver has exactly two options: thank you and accept it, or shout “That's not a ...” and challenge you on the spot.</p>"
      }
    },
    {
      id: "accept",
      label: { zh: "收下的连锁", en: "The accept chain" },
      html: {
        zh: "<p>收下礼物时，你把新收到的牌背面朝上叠在自己原有礼物的上面，于是你面前有两张牌。</p>"
          + "<p>但一个人同时只能持有一份礼物，所以立刻轮到你送礼，而且不能把刚收到的礼物转手，必须送出最下面那张旧礼物。</p>"
          + "<p>连锁就是这样一圈一圈传下去的，直到有人选择质疑为止。</p>"
          + "<p>从礼物商店抽到的牌永远不会留在自己手里，必须马上送出去。</p>",
        en: "<p>Accepting stacks the new card face down on top of the gift you already had, so you now hold two cards.</p>"
          + "<p>Since you may only hold one gift at a time, it immediately becomes your turn to give, and re-gifting the brand new card would be rude, so you hand over the old card at the bottom instead.</p>"
          + "<p>The chain keeps travelling around the table this way until somebody decides to challenge.</p>"
          + "<p>A card drawn from the gift shop is never kept either, it always goes straight back out to a neighbour.</p>"
      }
    },
    {
      id: "refuse",
      label: { zh: "质疑与惩罚", en: "Challenges and penalties" },
      html: {
        zh: "<p>质疑时你不需要说出正确的物品，只要喊「这不是…」并把牌翻开就行。</p>"
          + "<p>如果翻出来的牌和送礼人说的不一样，送礼人判断错误，这张牌就正面朝上进入他的惩罚堆。</p>"
          + "<p>如果翻出来的牌正是送礼人说的那个，质疑的人判断错误，这张牌进入质疑者的惩罚堆。</p>"
          + "<p>换句话说，质疑一个诚实的人会让你自己受罚，所以不能逢牌必疑。</p>"
          + "<p>翻牌之后所有人都会看到结果并按下 Continue，然后受罚的人从礼物商店抽一张新牌，展示后立刻送出去，游戏继续。</p>",
        en: "<p>Challenging does not require you to name the real object, you simply say “That's not a ...” and turn the card over.</p>"
          + "<p>If the revealed card differs from what the giver announced, the giver was wrong and takes that card face up into their own penalty pile.</p>"
          + "<p>If the revealed card is exactly what the giver announced, the challenger was wrong and takes the card instead.</p>"
          + "<p>In other words doubting an honest player costs you a penalty, so you cannot simply challenge every single pass.</p>"
          + "<p>After the reveal the whole table reviews the result and presses Continue, then the punished player draws a fresh card from the gift shop, shows it, and immediately passes it on.</p>"
      }
    },
    {
      id: "memory",
      label: { zh: "记性与吹牛", en: "Memory and bluffing" },
      html: {
        zh: "<p>一张牌一旦被翻成背面朝上，谁都不许再偷看，包括持有它的人。</p>"
          + "<p>牌叠上的箭头和底色是公开信息，所以你能算出礼物会往哪边走，但也仅此而已。</p>"
          + "<p>Gift Log 会记录每一次公开的亮牌和每一句说出口的礼物名，因为现实中这些话本来就是当场说给所有人听的。</p>"
          + "<p>日志永远不会告诉你那句声明是真是假，判断真伪就是你自己的功课。</p>"
          + "<p>记不清的时候可以反向操作：你确信自己没记错时故意显得心虚，引诱别人质疑你，让他替你受罚。</p>",
        en: "<p>Once a card has been turned face down nobody may peek at it again, not even the player holding it.</p>"
          + "<p>The arrow and the back colour stay public, so you can work out where a gift will travel, but that is the limit of what the board tells you.</p>"
          + "<p>The Gift Log records every public reveal and every announced gift name, because in the physical game all of that is spoken aloud for the table to hear.</p>"
          + "<p>The log never tells you whether a claim was true, working that out is your own job.</p>"
          + "<p>When your memory is shaky you can also play it backwards: sound deliberately unsure while you are certain, bait somebody into challenging you, and let them take the penalty.</p>"
      }
    }
  ]
};

const NOT_A_HAT_EXPLAIN = {
  shop: { zh: "礼物商店里还剩多少张牌。商店里的牌被抽走后必须立刻送出去，永远不会留在自己手里。", en: "How many cards are left in the gift shop. A card taken from the shop must be given away at once and is never kept." },
  shop_top: { zh: "礼物商店最上面的一张牌。牌堆是正面朝上叠放的，所以这张牌所有人都看得见，它就是下一次抽牌会拿到的礼物。", en: "The card on top of the gift shop. The pile sits face up, so the whole table can read this card, and it is exactly what the next draw will produce." },
  limit: { zh: "惩罚上限，默认三张。只要有人拿到第三张惩罚牌，整局立刻结束。", en: "The penalty limit, three by default. The moment anybody takes a third penalty card the game ends at once." },
  banner: { zh: "当前局势提示，说明现在轮到谁做什么。", en: "A status line naming whose turn it is and what they are about to do." },
  board: { zh: "牌桌全景。每位玩家显示姓名、惩罚牌和面前的礼物叠。礼物叠从左到右是由旧到新，最左边那张最老，也是下次要送出去的那张。", en: "The whole table. Each seat shows a name, the penalty cards and the gift stack. A stack reads oldest to newest from left to right, and the leftmost card is the one that will be handed over next." },
  action: { zh: "当前需要你操作的区域。轮到你送礼时这里会出现礼物清单，轮到你收礼时会出现收下和质疑两个按钮。", en: "The area where you act. It shows the gift list when you are giving and the accept and challenge buttons when you are receiving." },
  log: { zh: "Gift Log 记录每一次公开亮牌和每一句说出口的礼物名，但不会记录那句声明是真是假。", en: "The Gift Log lists every public reveal and every announced gift name, but never whether a claim was true." },
  card_face_up: { zh: "一张正面朝上的礼物牌，所有人都能看清上面的物品。开局时每张牌都是这样，一旦送出去就再也不会翻回正面。", en: "A face-up gift card, so the whole table can read the object on it. Every card starts like this and never returns to face up once it has been given away." },
  card_face_down: { zh: "一张背面朝上的礼物牌。箭头指出它会递给左邻还是右邻，底色是浅是深，但物品本身对所有人保密，只有翻牌质疑时才会揭晓。", en: "A face-down gift card. The arrow shows whether it travels to the left or the right neighbour and the back is light or dark, but the object itself is hidden from everyone until a challenge reveals it." },
  penalty_card: { zh: "已经落到这位玩家手里的惩罚牌，它们是正面朝上的，所以全场都看得见。这些牌不会再参与游戏。", en: "Penalty cards this player has already collected. They lie face up so the whole table can see them, and they never re-enter play." }
};

let notAHatHelpWidget = null;
let notAHatExplainWidget = null;

function initNotAHatHelpExplain() {
  if (notAHatHelpWidget || typeof window.obgCreateHelp !== "function") return;
  notAHatHelpWidget = window.obgCreateHelp(NOT_A_HAT_HELP_CONFIG);
  notAHatExplainWidget = window.obgCreateExplain({
    gameId: "not_a_hat",
    attribute: "data-nah-explain",
    explanations: NOT_A_HAT_EXPLAIN,
    button: notAHatExplainButton,
    root: () => document.getElementById("notAHatPanel"),
    bypass: ["#notAHatHelpBtn", "#notAHatExplainBtn"]
  });
  notAHatHelpButton?.addEventListener("click", () => {
    notAHatExplainWidget?.exit();
    notAHatHelpWidget.open();
  });
  notAHatExplainButton?.addEventListener("click", () => notAHatExplainWidget?.toggle());
}

// --- DOM handles ----------------------------------------------------------
const notAHatHeaderActions = document.getElementById("notAHatHeaderActions");
const notAHatShopCount = document.getElementById("notAHatShopCount");
const notAHatShopTop = document.getElementById("notAHatShopTop");
const notAHatLimit = document.getElementById("notAHatLimit");
const notAHatBanner = document.getElementById("notAHatBanner");
const notAHatBoard = document.getElementById("notAHatBoard");
const notAHatAction = document.getElementById("notAHatAction");
const notAHatLog = document.getElementById("notAHatLog");

let currentNotAHatView = null;
let notAHatGivePanel = null;
let notAHatPickedKey = null;
let notAHatPickerQuery = "";
let notAHatPickerCategory = "all";
let notAHatPickerSignature = "";

function notAHatLang() {
  return typeof window.obgHelpLang === "function" && window.obgHelpLang() === "en" ? "en" : "zh";
}

function notAHatItemName(view, key) {
  const item = (view?.items || []).find((entry) => entry.key === key);
  if (!item) return key || "-";
  return item[notAHatLang()] || item.zh;
}

function notAHatItemText(view, key) {
  const item = (view?.items || []).find((entry) => entry.key === key);
  if (!item) return key || "-";
  return `${item.emoji} ${notAHatItemName(view, key)}`;
}

function notAHatPlayer(view, playerId) {
  return (view?.players || []).find((entry) => entry.player_id === playerId) || null;
}

function notAHatPlayerName(view, playerId) {
  const player = notAHatPlayer(view, playerId);
  return player ? player.name : playerId || "-";
}

function notAHatReceiverOf(view, giverId, card) {
  const order = view?.turn_order || [];
  if (!card || !giverId || order.length < 2) return null;
  const index = order.indexOf(giverId);
  if (index < 0) return null;
  const step = card.dir === "left" ? -1 : 1;
  return order[(index + step + order.length) % order.length];
}

function notAHatOfferedCard(view) {
  if (!view || view.you !== view.giver) return null;
  if (view.pending) return view.pending;
  const me = notAHatPlayer(view, view.you);
  return me && me.stack && me.stack.length ? me.stack[0] : null;
}

// --- board ----------------------------------------------------------------
function notAHatRenderCard(view, card, role) {
  const node = document.createElement("div");
  node.className = "nah-card " + (card.face_up ? "is-up" : "is-down");
  if (card.face_up) {
    node.dataset.nahExplain = "card_face_up";
    const emoji = document.createElement("span");
    emoji.className = "nah-card-emoji";
    const item = (view.items || []).find((entry) => entry.key === card.item);
    emoji.textContent = item ? item.emoji : "❔";
    const name = document.createElement("span");
    name.className = "nah-card-name";
    name.textContent = notAHatItemName(view, card.item);
    node.append(emoji, name);
  } else {
    node.dataset.nahExplain = "card_face_down";
    node.classList.add(card.back === "dark" ? "back-dark" : "back-light");
    const arrow = document.createElement("span");
    arrow.className = "nah-card-arrow";
    arrow.textContent = card.dir === "left" ? "⬅️" : "➡️";
    node.append(arrow);
  }
  if (role === "oldest") node.classList.add("is-oldest");
  node.title = card.face_up
    ? notAHatItemText(view, card.item)
    : (card.dir === "left" ? "passes left" : "passes right");
  return node;
}

function notAHatRenderBoard(view) {
  if (!notAHatBoard) return;
  notAHatBoard.innerHTML = "";
  const seats = [...(view.players || [])].sort((a, b) => a.seat_index - b.seat_index);
  seats.forEach((player) => {
    const seat = document.createElement("div");
    seat.className = "nah-seat";
    if (player.is_giver) seat.classList.add("is-giver");
    if (player.is_receiver) seat.classList.add("is-receiver");
    if (player.is_you) seat.classList.add("is-you");

    const head = document.createElement("div");
    head.className = "nah-seat-head";
    const name = document.createElement("span");
    name.className = "nah-seat-name";
    name.textContent = player.name;
    name.title = player.name;
    head.appendChild(name);
    if (player.is_you) {
      const you = document.createElement("span");
      you.className = "nah-seat-tag";
      you.textContent = "You";
      head.appendChild(you);
    } else if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "nah-seat-tag is-bot";
      bot.textContent = "Bot";
      head.appendChild(bot);
    }
    seat.appendChild(head);

    const cards = document.createElement("div");
    cards.className = "nah-seat-cards";
    (player.stack || []).forEach((card, index) => {
      cards.appendChild(notAHatRenderCard(view, card, index === 0 ? "oldest" : "newest"));
    });
    seat.appendChild(cards);

    const pen = document.createElement("div");
    pen.className = "nah-seat-pen";
    if (player.penalty_count) {
      pen.dataset.nahExplain = "penalty_card";
      (player.penalties || []).forEach((key) => {
        const chip = document.createElement("span");
        chip.className = "nah-pen-chip";
        const item = (view.items || []).find((entry) => entry.key === key);
        chip.textContent = item ? item.emoji : "❔";
        chip.title = notAHatItemText(view, key);
        pen.appendChild(chip);
      });
      const count = document.createElement("span");
      count.className = "nah-pen-count";
      count.textContent = `${player.penalty_count}/${view.config.max_penalties}`;
      pen.appendChild(count);
    } else {
      pen.classList.add("is-clean");
      pen.textContent = "no penalties";
    }
    seat.appendChild(pen);

    notAHatBoard.appendChild(seat);
  });
}

// --- gift picker ----------------------------------------------------------
function notAHatBuildGivePanel(view) {
  const panel = document.createElement("div");
  panel.className = "nah-give";

  const head = document.createElement("div");
  head.className = "nah-give-head";
  head.id = "notAHatGiveHead";
  panel.appendChild(head);

  const search = document.createElement("input");
  search.type = "search";
  search.className = "nah-picker-search";
  search.id = "notAHatPickerSearch";
  search.placeholder = "Search gifts";
  search.autocomplete = "off";
  search.addEventListener("input", () => {
    notAHatPickerQuery = search.value.trim().toLowerCase();
    notAHatApplyPickerFilter();
  });
  panel.appendChild(search);

  const cats = document.createElement("div");
  cats.className = "nah-picker-cats";
  cats.id = "notAHatPickerCats";
  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "nah-cat is-active";
  allChip.dataset.category = "all";
  allChip.textContent = "All";
  cats.appendChild(allChip);
  (view.categories || []).forEach((category) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "nah-cat";
    chip.dataset.category = category.key;
    chip.textContent = `${category.emoji} ${category[notAHatLang()] || category.zh}`;
    cats.appendChild(chip);
  });
  cats.addEventListener("click", (event) => {
    const chip = event.target.closest(".nah-cat");
    if (!chip) return;
    notAHatPickerCategory = chip.dataset.category;
    cats.querySelectorAll(".nah-cat").forEach((node) => {
      node.classList.toggle("is-active", node === chip);
    });
    notAHatApplyPickerFilter();
  });
  panel.appendChild(cats);

  const grid = document.createElement("div");
  grid.className = "nah-picker-grid";
  grid.id = "notAHatPickerGrid";
  (view.items || []).forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nah-item";
    button.dataset.item = item.key;
    button.dataset.category = item.category;
    button.dataset.search = `${item.zh} ${item.en} ${item.key}`.toLowerCase();
    const emoji = document.createElement("span");
    emoji.className = "nah-item-emoji";
    emoji.textContent = item.emoji;
    const label = document.createElement("span");
    label.className = "nah-item-name";
    label.textContent = item[notAHatLang()] || item.zh;
    button.append(emoji, label);
    grid.appendChild(button);
  });
  grid.addEventListener("click", (event) => {
    const button = event.target.closest(".nah-item");
    if (!button) return;
    notAHatPickedKey = notAHatPickedKey === button.dataset.item ? null : button.dataset.item;
    notAHatApplyPickerSelection();
  });
  panel.appendChild(grid);

  const foot = document.createElement("div");
  foot.className = "nah-give-foot";
  const picked = document.createElement("span");
  picked.className = "nah-picked";
  picked.id = "notAHatPicked";
  foot.appendChild(picked);
  const give = document.createElement("button");
  give.type = "button";
  give.className = "nah-give-btn";
  give.id = "notAHatGiveBtn";
  give.textContent = "🎁 Give";
  give.addEventListener("click", () => {
    if (!notAHatPickedKey) return;
    sendAction({ type: "give", item: notAHatPickedKey });
    notAHatPickedKey = null;
    notAHatApplyPickerSelection();
  });
  foot.appendChild(give);
  panel.appendChild(foot);

  // Tapping the empty board area clears the pick instead of a Clear button.
  panel.addEventListener("click", (event) => {
    if (event.target !== panel) return;
    notAHatPickedKey = null;
    notAHatApplyPickerSelection();
  });

  return panel;
}

function notAHatApplyPickerFilter() {
  const grid = document.getElementById("notAHatPickerGrid");
  if (!grid) return;
  grid.querySelectorAll(".nah-item").forEach((node) => {
    const matchesCategory = notAHatPickerCategory === "all" || node.dataset.category === notAHatPickerCategory;
    const matchesQuery = !notAHatPickerQuery || node.dataset.search.includes(notAHatPickerQuery);
    node.classList.toggle("is-filtered", !(matchesCategory && matchesQuery));
  });
}

function notAHatApplyPickerSelection() {
  const grid = document.getElementById("notAHatPickerGrid");
  if (grid) {
    grid.querySelectorAll(".nah-item").forEach((node) => {
      node.classList.toggle("is-picked", node.dataset.item === notAHatPickedKey);
    });
  }
  const picked = document.getElementById("notAHatPicked");
  const give = document.getElementById("notAHatGiveBtn");
  if (picked) {
    picked.textContent = notAHatPickedKey
      ? notAHatItemText(currentNotAHatView, notAHatPickedKey)
      : "Pick the gift you are announcing";
    picked.classList.toggle("is-empty", !notAHatPickedKey);
  }
  if (give) {
    give.disabled = !notAHatPickedKey;
    give.classList.toggle("action-allowed", !!notAHatPickedKey);
  }
}

function notAHatEnsureGivePanel(view) {
  const signature = (view.items || []).map((item) => item.key).join(",");
  if (!notAHatGivePanel || notAHatPickerSignature !== signature) {
    notAHatGivePanel = notAHatBuildGivePanel(view);
    notAHatPickerSignature = signature;
    notAHatPickedKey = null;
  }
  return notAHatGivePanel;
}

// --- action area ----------------------------------------------------------
function notAHatReadyRow(view, actionType, label) {
  const row = document.createElement("div");
  row.className = "nah-ready-row";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nah-btn primary action-allowed";
  button.textContent = label;
  button.addEventListener("click", () => sendAction({ type: actionType }));
  row.appendChild(button);
  const progress = document.createElement("span");
  progress.className = "nah-ready-count";
  progress.textContent = `${(view.ready || []).length}/${(view.players || []).length} ready`;
  row.appendChild(progress);
  return row;
}

function notAHatRenderAction(view) {
  if (!notAHatAction) return;
  notAHatAction.innerHTML = "";
  const legal = view.legal_actions || [];
  const phase = view.phase;

  if (view.game_over) {
    const box = document.createElement("div");
    box.className = "nah-over";
    const title = document.createElement("div");
    title.className = "nah-over-title";
    const winners = (view.winners || []).map((pid) => notAHatPlayerName(view, pid));
    title.textContent = winners.length ? `🏆 ${winners.join(", ")} win` : "Game over";
    box.appendChild(title);
    const list = document.createElement("div");
    list.className = "nah-over-list";
    [...(view.players || [])]
      .sort((a, b) => (view.scores[a.player_id] ?? 0) - (view.scores[b.player_id] ?? 0))
      .forEach((player) => {
        const row = document.createElement("div");
        row.className = "nah-over-row";
        if ((view.winners || []).includes(player.player_id)) row.classList.add("is-winner");
        const name = document.createElement("span");
        name.textContent = player.name;
        const score = document.createElement("span");
        score.className = "nah-over-score";
        score.textContent = `${view.scores[player.player_id] ?? 0} penalties`;
        row.append(name, score);
        list.appendChild(row);
      });
    box.appendChild(list);
    const again = document.createElement("button");
    again.type = "button";
    again.className = "nah-btn primary action-allowed";
    again.textContent = "Play Again";
    again.addEventListener("click", () => emitRoomStart());
    box.appendChild(again);
    notAHatAction.appendChild(box);
    return;
  }

  if (phase === "memorize") {
    const box = document.createElement("div");
    box.className = "nah-note";
    box.textContent = "Memorize every face-up gift on the table before they all turn over.";
    notAHatAction.appendChild(box);
    if (legal.includes("ready")) {
      notAHatAction.appendChild(notAHatReadyRow(view, "ready", "I'm ready"));
    } else {
      const waiting = document.createElement("div");
      waiting.className = "nah-note is-muted";
      waiting.textContent = `Waiting for the others (${(view.ready || []).length}/${(view.players || []).length}).`;
      notAHatAction.appendChild(waiting);
    }
    return;
  }

  if (phase === "giving") {
    if (legal.includes("give")) {
      const card = notAHatOfferedCard(view);
      const receiverId = notAHatReceiverOf(view, view.you, card);
      const panel = notAHatEnsureGivePanel(view);
      const head = panel.querySelector("#notAHatGiveHead");
      if (head) {
        const source = view.pending
          ? `the shop gift ${notAHatItemText(view, view.pending.item)}`
          : "your oldest gift";
        head.textContent = `You hand ${source} to ${notAHatPlayerName(view, receiverId)}. What is it?`;
      }
      notAHatAction.appendChild(panel);
      notAHatApplyPickerFilter();
      notAHatApplyPickerSelection();
      return;
    }
    const waiting = document.createElement("div");
    waiting.className = "nah-note is-muted";
    waiting.textContent = `${notAHatPlayerName(view, view.giver)} is choosing what to announce.`;
    notAHatAction.appendChild(waiting);
    return;
  }

  if (phase === "receiving") {
    const claim = document.createElement("div");
    claim.className = "nah-claim";
    const from = document.createElement("span");
    from.className = "nah-claim-from";
    from.textContent = `${notAHatPlayerName(view, view.giver)} says`;
    const item = document.createElement("span");
    item.className = "nah-claim-item";
    item.textContent = notAHatItemText(view, view.announced);
    claim.append(from, item);
    notAHatAction.appendChild(claim);

    if (legal.includes("accept")) {
      const row = document.createElement("div");
      row.className = "nah-choice";
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "nah-btn accept action-allowed";
      accept.textContent = "👍 Thank you!";
      accept.addEventListener("click", () => sendAction({ type: "accept" }));
      const refuse = document.createElement("button");
      refuse.type = "button";
      refuse.className = "nah-btn refuse action-allowed";
      const announced = (view.items || []).find((entry) => entry.key === view.announced);
      refuse.textContent = `🚫 That's not a ${announced ? announced.emoji : "gift"}!`;
      refuse.addEventListener("click", () => sendAction({ type: "refuse" }));
      row.append(accept, refuse);
      notAHatAction.appendChild(row);
      return;
    }
    const waiting = document.createElement("div");
    waiting.className = "nah-note is-muted";
    waiting.textContent = `${notAHatPlayerName(view, view.receiver)} is deciding whether to accept.`;
    notAHatAction.appendChild(waiting);
    return;
  }

  if (phase === "review") {
    const refusal = view.last_refusal;
    if (refusal) {
      const box = document.createElement("div");
      box.className = "nah-review" + (refusal.honest ? " is-honest" : " is-bluff");
      const card = document.createElement("div");
      card.className = "nah-review-card";
      const actual = (view.items || []).find((entry) => entry.key === refusal.actual);
      card.textContent = actual ? actual.emoji : "❔";
      box.appendChild(card);
      const text = document.createElement("div");
      text.className = "nah-review-text";
      text.textContent = refusal.honest
        ? `${notAHatPlayerName(view, refusal.giver)} really did give ${notAHatItemText(view, refusal.actual)}, so ${notAHatPlayerName(view, refusal.loser)} takes the penalty.`
        : `${notAHatPlayerName(view, refusal.giver)} announced ${notAHatItemText(view, refusal.announced)} but it was ${notAHatItemText(view, refusal.actual)}, so ${notAHatPlayerName(view, refusal.loser)} takes the penalty.`;
      box.appendChild(text);
      notAHatAction.appendChild(box);
    }
    if (legal.includes("continue")) {
      notAHatAction.appendChild(notAHatReadyRow(view, "continue", "Continue"));
    } else {
      const waiting = document.createElement("div");
      waiting.className = "nah-note is-muted";
      waiting.textContent = `Waiting for the others (${(view.ready || []).length}/${(view.players || []).length}).`;
      notAHatAction.appendChild(waiting);
    }
    return;
  }

  const idle = document.createElement("div");
  idle.className = "nah-note is-muted";
  idle.textContent = "Waiting for the table.";
  notAHatAction.appendChild(idle);
}

// --- banner and log -------------------------------------------------------
function notAHatRenderBanner(view) {
  if (!notAHatBanner) return;
  let text = "";
  if (view.game_over) {
    text = "The game is over. Fewest penalties wins.";
  } else if (view.phase === "memorize") {
    text = "Everyone is memorising the starting gifts.";
  } else if (view.phase === "giving") {
    text = view.you === view.giver
      ? "Your turn to give a gift."
      : `${notAHatPlayerName(view, view.giver)} is giving a gift.`;
  } else if (view.phase === "receiving") {
    text = view.you === view.receiver
      ? `${notAHatPlayerName(view, view.giver)} offers you ${notAHatItemText(view, view.announced)}.`
      : `${notAHatPlayerName(view, view.receiver)} is deciding on ${notAHatItemText(view, view.announced)}.`;
  } else if (view.phase === "review") {
    text = "A gift was refused. Check the reveal.";
  }
  notAHatBanner.textContent = text;
  notAHatBanner.classList.toggle("is-hidden", !text);
}

function notAHatRenderLog(view) {
  if (!notAHatLog) return;
  notAHatLog.innerHTML = "";
  const entries = [...(view.log || [])].reverse();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "nah-log-row is-muted";
    empty.textContent = "Nothing has been given yet.";
    notAHatLog.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "nah-log-row";
    const text = document.createElement("span");
    if (entry.kind === "shop") {
      text.textContent = `🎁 ${notAHatPlayerName(view, entry.player)} drew ${notAHatItemText(view, entry.item)}`;
    } else {
      text.textContent = `${notAHatPlayerName(view, entry.giver)} → ${notAHatPlayerName(view, entry.receiver)}: ${notAHatItemText(view, entry.item)}`;
    }
    row.appendChild(text);
    if (entry.kind === "pass") {
      const badge = document.createElement("span");
      badge.className = "nah-log-badge";
      if (entry.outcome === "accepted") {
        badge.classList.add("is-accepted");
        badge.textContent = "accepted";
      } else if (entry.outcome === "refused") {
        badge.classList.add("is-refused");
        badge.textContent = `refused · was ${notAHatItemText(view, entry.actual)}`;
      } else {
        badge.classList.add("is-pending");
        badge.textContent = "deciding";
      }
      row.appendChild(badge);
    }
    notAHatLog.appendChild(row);
  });
}

// --- entry point ----------------------------------------------------------
function clearNotAHatState() {
  currentNotAHatView = null;
  notAHatPickedKey = null;
  notAHatPickerQuery = "";
  notAHatPickerCategory = "all";
  if (notAHatShopCount) notAHatShopCount.textContent = "-";
  if (notAHatShopTop) notAHatShopTop.textContent = "-";
  if (notAHatLimit) notAHatLimit.textContent = "-";
  if (notAHatBanner) notAHatBanner.textContent = "";
  if (notAHatBoard) notAHatBoard.innerHTML = "";
  if (notAHatAction) notAHatAction.innerHTML = "";
  if (notAHatLog) notAHatLog.innerHTML = "";
  notAHatSetTurnAttention(false);
}

function notAHatSetTurnAttention(active) {
  const dock = document.getElementById("roomControlsPanel");
  if (!dock) return;
  const connected = typeof socket === "undefined" || !socket || socket.connected;
  dock.classList.toggle("not-a-hat-turn", Boolean(active && connected));
}

function renderNotAHatGameState(data) {
  const view = data.view;
  if (!view) return;
  const previous = currentNotAHatView;
  currentNotAHatView = view;
  if (currentGameType !== "not_a_hat") {
    currentGameType = "not_a_hat";
    setGamePanelVisibility("not_a_hat");
  }
  // Only the giver acts during "giving", so any change of giver or seq means a
  // brand new offer and whatever was picked for the last one is stale.
  const offerChanged = !previous || previous.giver !== view.giver || previous.seq !== view.seq;
  if (offerChanged || view.phase !== "giving") notAHatPickedKey = null;

  if (notAHatShopCount) notAHatShopCount.textContent = String(view.shop_count ?? "-");
  if (notAHatShopTop) {
    notAHatShopTop.textContent = view.shop_top_label
      ? `${view.shop_top_label.emoji} ${notAHatItemName(view, view.shop_top)}`
      : "-";
  }
  if (notAHatLimit) notAHatLimit.textContent = String(view.config?.max_penalties ?? "-");

  notAHatRenderBanner(view);
  notAHatRenderBoard(view);
  notAHatRenderAction(view);
  notAHatRenderLog(view);
  notAHatSetTurnAttention((view.legal_actions || []).length > 0);
  logGameEvents(data);
}

function showNotAHatHeaderActions(show) {
  if (notAHatHeaderActions) {
    notAHatHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    notAHatExplainWidget?.exit();
    notAHatHelpWidget?.close();
    notAHatSetTurnAttention(false);
  }
}

document.addEventListener("obg:help-lang", () => {
  if (currentNotAHatView) renderNotAHatGameState({ view: currentNotAHatView, events: [] });
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNotAHatHelpExplain);
} else {
  initNotAHatHelpExplain();
}
