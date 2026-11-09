// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const hanabiHelpButton = document.getElementById("hanabiHelpBtn");
const hanabiExplainButton = document.getElementById("hanabiExplainBtn");

const HANABI_HELP_CONFIG = {
  gameId: "hanabi",
  title: { zh: "烟花 · Hanabi", en: "Hanabi" },
  basic: {
    win: {
      zh: "这是一款合作游戏，团队要把五堆烟花(🎆)从 1 依次叠到 5，让总分(⭐)尽量接近满分 25。",
      en: "This is a cooperative game. Your team wins by stacking all five fireworks (🎆) from 1 up to 5, pushing the score (⭐) as close to 25 as possible."
    },
    turn: {
      zh: "轮到你时只做一件事，打出一张牌(🎆 Play)，弃掉一张牌(♻️ Discard)，或者花掉一个线索标记(💡)告诉队友一个颜色或数字。",
      en: "On your turn you take exactly one action. Play a card (🎆 Play), discard a card (♻️ Discard), or spend one clue token (💡) to tell a teammate a color or a number."
    },
    key: {
      zh: "你看不到自己的手牌，只能靠队友给的提示推断它们是什么，所以提示给得准、给得省，比抢着出牌更重要。",
      en: "You never see your own hand and must reason it out from the clues your teammates give, so spending clues wisely matters more than playing fast."
    }
  },
  sections: [
    {
      id: "cards",
      label: { zh: "牌与分数", en: "Cards and score" },
      html: {
        zh: "<p>牌有五种颜色，红色(🔴)、黄色(🟡)、绿色(🟢)、蓝色(🔵)、白色(⚪)，每种颜色都有数字 1 到 5。</p>"
          + "<p>每种颜色的 1 有三张，2、3、4 各两张，5 只有一张，所以数字越大的牌越少见。</p>"
          + "<p>两位或三位玩家开局各拿五张牌，四位或五位玩家各拿四张牌。</p>"
          + "<p>总分(⭐)等于五堆烟花(🎆)的高度之和，每成功打出一张牌就加 1 分，满分 25 分。</p>",
        en: "<p>The deck has five colors, red (🔴), yellow (🟡), green (🟢), blue (🔵) and white (⚪), and each color runs from 1 to 5.</p>"
          + "<p>Every color holds three 1s, two each of 2, 3 and 4, and a single 5, so the high numbers are the scarce ones.</p>"
          + "<p>Two or three players start with five cards each, while four or five players start with four cards each.</p>"
          + "<p>The score (⭐) is the total height of the five fireworks (🎆). Every card played successfully adds one point, up to a maximum of 25.</p>"
      }
    },
    {
      id: "actions",
      label: { zh: "回合动作", en: "Your turn" },
      html: {
        zh: "<p>打出(🎆 Play)：选中的牌必须正好是它那个颜色烟花的下一个数字，该颜色还没开始时必须先打 1。</p>"
          + "<p>打对了就把牌叠上去，打错了这张牌进弃牌堆(♻️)，并且扣掉一个引信(❤️)。</p>"
          + "<p>弃牌(♻️ Discard)：把一张牌丢进弃牌堆(♻️)，换回一个线索标记(💡)。八个线索标记都在手上时不能弃牌。</p>"
          + "<p>给提示(💡 Give Clue)：花掉一个线索标记(💡)，告诉一位队友一个颜色或一个数字。你选的值必须真的出现在他手里。</p>"
          + "<p>打出或弃牌之后，只要牌库(🃏)还有牌，你就补摸一张。</p>",
        en: "<p>Play (🎆 Play): the chosen card must be exactly the next number of its own color, and a color that has not started yet must begin with a 1.</p>"
          + "<p>A correct play stacks the card. A wrong play sends it to the discards (♻️) and costs one fuse (❤️).</p>"
          + "<p>Discard (♻️ Discard): throw one card into the discards (♻️) to get one clue token (💡) back. You cannot discard while all eight clue tokens are available.</p>"
          + "<p>Give Clue (💡 Give Clue): spend one clue token (💡) to name a color or a number for one teammate. The value you pick must really appear in their hand.</p>"
          + "<p>After playing or discarding you draw one replacement card as long as the deck (🃏) still has cards.</p>"
      }
    },
    {
      id: "clues",
      label: { zh: "线索与推理", en: "Clues and deduction" },
      html: {
        zh: "<p>一次提示只会指向队友手里真实存在的牌。所有符合条件的牌都会被标记，其余的牌则排除这个值。</p>"
          + "<p>例如你告诉队友他的第 2 张和第 4 张是红色(🔴)，那他的第 1 张和第 3 张就不是红色(🔴)，这同样是信息。</p>"
          + "<p>你最多存八个线索标记(💡)。给一次提示花掉一个，弃一张牌或成功打出数字 5 各能补回一个。</p>"
          + "<p>牌面下方的五个小圆点按红色(🔴)、黄色(🟡)、绿色(🟢)、蓝色(🔵)、白色(⚪)排列，变淡的空心点和被划掉的小数字表示已经排除。</p>",
        en: "<p>A clue only ever points at cards that really exist in the teammate's hand. Every matching card gets marked, and every other card rules that value out.</p>"
          + "<p>If you tell a teammate that their cards 2 and 4 are red (🔴), then their cards 1 and 3 are not red (🔴), and that is information too.</p>"
          + "<p>You can hold at most eight clue tokens (💡). Giving a clue spends one, while discarding a card or successfully playing a 5 each give one back.</p>"
          + "<p>The five small dots under a card follow red (🔴), yellow (🟡), green (🟢), blue (🔵) and white (⚪). Faded hollow dots and crossed-out numbers are ruled out.</p>"
      }
    },
    {
      id: "reading",
      label: { zh: "读牌与界面", en: "Reading the board" },
      html: {
        zh: "<p>你看得见所有人的牌，唯独看不见自己的。自己的牌只显示已经确认的提示，问号表示还不知道。</p>"
          + "<p>别人的牌下方那排小圆点和小数字，显示的是他自己从提示里知道了什么，而不是你看见的牌面。</p>"
          + "<p>牌位从 1 开始编号，和游戏日志(📜)里说的第几张对得上。</p>"
          + "<p>在提示区选中队友后，他的牌会出现在提示控件旁边，命中的牌带金色描边。弃牌堆(♻️)里每格记录该颜色该数字被弃掉的数量，整格变红说明这张牌已经全部用光。</p>",
        en: "<p>You can see everyone's cards except your own. Your cards only show the clues you have received, and a question mark means still unknown.</p>"
          + "<p>The dots and numbers under another player's card show what that player knows from clues, not what you can see on the face.</p>"
          + "<p>Card positions are numbered from 1, which matches the positions named in the game log (📜).</p>"
          + "<p>Pick a teammate in the clue area to show their hand beside the clue controls, where matching cards get a gold outline. Each cell in the discards (♻️) counts how many copies of that color and number are gone, and a fully red cell means every copy is lost.</p>"
      }
    },
    {
      id: "ending",
      label: { zh: "结束条件", en: "Endings" },
      html: {
        zh: "<p>三个引信(❤️)全部扣光时游戏立刻结束，标准计分为 0 分，界面会同时显示当前牌面的实际分数。</p>"
          + "<p>五堆烟花(🎆)全部叠到 5 就是完美通关，拿到满分 25 分。</p>"
          + "<p>最后回合倒计时(⏳)是房间里的可选规则，默认关闭。开启后，摸走牌库(🃏)最后一张牌就开始倒数，其他玩家各走完一回合后游戏结束。关闭时，牌库摸空不会自动结束游戏。</p>"
          + "<p>游戏结束后所有人的牌都会翻开，正好用来复盘谁算错了什么。</p>",
        en: "<p>Losing all three fuses (❤️) ends the game at once. The standard score is then zero, and the actual board score is shown next to it.</p>"
          + "<p>Stacking all five fireworks (🎆) up to 5 is a perfect game worth the full 25 points.</p>"
          + "<p>The Final Turns countdown (⏳) is an optional room rule and is off by default. When it is on, drawing the last card of the deck (🃏) starts the countdown, and the game ends once every other player has taken one more turn. With it off, an empty deck never ends the game by itself.</p>"
          + "<p>When the game ends every hand is revealed, which is the perfect moment to review who miscounted what.</p>"
      }
    }
  ]
};

const HANABI_EXPLAIN = {
  clues: { zh: "线索标记(💡)。给队友一个提示要花掉一个，手上最多存八个。弃一张牌或成功打出数字 5 各能补回一个。", en: "Clue tokens (💡). Giving a teammate a clue costs one and you can hold at most eight. Discarding a card or successfully playing a 5 each give one back." },
  fuses: { zh: "引信(❤️)。每次打错牌扣掉一个，扣光三个游戏立刻结束，此时标准计分为 0 分。", en: "Fuses (❤️). Every failed play costs one. Losing all three ends the game immediately and the standard score becomes zero." },
  deck: { zh: "牌库(🃏)剩余张数。每次打出或弃牌后，只要牌库还有牌就补摸一张。", en: "Cards left in the deck (🃏). After you play or discard you draw one card as long as the deck is not empty." },
  score: { zh: "总分(⭐)。每张成功打出的牌记 1 分，等于五堆烟花的高度之和，最高 25 分。", en: "Score (⭐). Each successfully played card is worth one point, equal to the total height of the five fireworks, up to 25." },
  final: { zh: "最后回合(⏳)倒计时。这是房间可选规则，默认关闭。开启后摸走最后一张牌就开始倒数，归零时游戏结束。", en: "Final Turns (⏳) countdown. This optional room rule is off by default. When on, drawing the last card starts the countdown and the game ends when it reaches zero." },
  play: { zh: "打出选中的牌(🎆 Play)。它必须正好是该颜色烟花的下一个数字，从 1 开始。打错扣一个引信(❤️)，成功打出数字 5 补回一个线索标记(💡)。只有轮到你并且选好牌时才能按。", en: "Play the selected card (🎆 Play). It must be exactly the next number of its color, starting at 1. A wrong play costs one fuse (❤️) and a successful 5 returns one clue token (💡). The button works only on your turn with a card selected." },
  discard: { zh: "弃掉选中的牌(♻️ Discard)。弃牌换回一个线索标记(💡)，并在牌库有牌时补摸一张。八个线索标记都在手上时不能弃牌。", en: "Discard the selected card (♻️ Discard). It returns one clue token (💡) and you draw a replacement if the deck still has cards. You cannot discard while all eight clue tokens are available." },
  target: { zh: "选择要提示的队友。选中后他的牌会显示在提示区旁边。你不能给自己提示。", en: "Choose the teammate you want to clue. Their hand then appears beside the clue controls. You can never clue yourself." },
  clue: { zh: "给队友提示(💡 Give Clue)。先选队友，再选颜色或数字，最后选一个他手里确实存在的值，金色描边会预览所有命中的牌。给提示要花掉一个线索标记(💡)。", en: "Give a clue (💡 Give Clue). Pick a teammate, then a color or a number, then a value that really exists in their hand. Gold outlines preview every matching card. Giving the clue spends one clue token (💡)." },
  players: { zh: "其他玩家的手牌。你能看到他们的牌面，下方的小圆点和小数字表示这名玩家自己从提示里知道了什么。", en: "The other players' hands. You can see their card faces, while the small dots and numbers below show what that player knows from clues." },
  discards: { zh: "弃牌堆(♻️)统计。每格记录该颜色该数字被弃掉的数量，打错的牌也算在内。每种颜色有三张 1，两张 2、3、4 和一张 5，整格变红表示这张牌已经全部用光。", en: "Discard pile (♻️) statistics. Each cell counts how many copies of that color and number are gone, failed plays included. Every color has three 1s, two each of 2, 3 and 4, and one 5, and a fully red cell means every copy is lost." },
  log: { zh: "游戏日志(📜)。最新的行动排在最上面，可以往回翻看之前的记录。", en: "Game log (📜). The newest action is listed first and you can scroll back through earlier entries." },
  card: { zh: "一张牌。大符号和数字表示可见的牌，或者你自己已经确认的提示，问号表示未知。下方五个小圆点按红色(🔴)、黄色(🟡)、绿色(🟢)、蓝色(🔵)、白色(⚪)排列，变淡的空心点和被划掉的小数字表示已经排除。", en: "One card. The large symbol and number show a visible card or the clues you have confirmed about your own, and a question mark means unknown. The five dots below follow red (🔴), yellow (🟡), green (🟢), blue (🔵) and white (⚪), while faded hollow dots and crossed-out numbers are ruled out." },
  stack: { zh: "一堆烟花(🎆)。中间的数字表示这堆已经叠到几，右边写着下一个必须打出的数字，叠到 5 就完成。", en: "One firework (🎆). The number in the middle is how high the stack already is, the right side names the next number you must play, and reaching 5 completes it." }
};

let hanabiHelpWidget = null;
let hanabiExplainWidget = null;

function initHanabiHelpExplain() {
  if (hanabiHelpWidget || typeof window.obgCreateHelp !== "function") return;
  hanabiHelpWidget = window.obgCreateHelp(HANABI_HELP_CONFIG);
  hanabiExplainWidget = window.obgCreateExplain({
    gameId: "hanabi",
    attribute: "data-hanabi-explain",
    explanations: HANABI_EXPLAIN,
    button: hanabiExplainButton,
    root: () => document.getElementById("hanabiPanel"),
    bypass: ["#hanabiHelpBtn", "#hanabiExplainBtn"]
  });
  hanabiHelpButton?.addEventListener("click", () => {
    hanabiExplainWidget?.exit();
    hanabiHelpWidget.open();
  });
  hanabiExplainButton?.addEventListener("click", () => hanabiExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHanabiHelpExplain);
} else {
  initHanabiHelpExplain();
}

const hanabiFinalRoundToggle = document.getElementById("hanabiFinalRoundToggle");

(() => {
  const colors = ["red", "yellow", "green", "blue", "white"];
  const ranks = [1, 2, 3, 4, 5];
  const copies = { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1 };
  const symbols = { red: "🔴", yellow: "🟡", green: "🟢", blue: "🔵", white: "⚪" };
  const labels = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue", white: "White" };
  const $ = (id) => document.getElementById(`hanabi${id}`);
  const panel = $("Panel");
  const dialog = $("Dialog");
  const tooltip = $("Tooltip");
  let view = null;
  let selectedCard = null;
  let clueType = "color";
  let clueValue = null;
  let pending = false;
  let pendingTimer;
  let tipTimer;
  let tipTarget = null;
  let returnFocus = null;

  // Help and Explain now come from the shared widgets in static/games/shared_help.js.

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function colorName(color) { return color ? `${labels[color]} (${symbols[color]})` : "Unknown color (?)"; }
  function ownPlayer() { return view?.players.find((player) => player.player_id === view.you); }
  function targetPlayer() { return view?.players.find((player) => player.player_id === $("TargetSelect").value); }
  function possibleColors(card) { return card.known_color ? [card.known_color] : colors.filter((color) => !(card.not_colors || []).includes(color)); }
  function possibleRanks(card) { return Number.isInteger(card.known_rank) ? [card.known_rank] : ranks.filter((rank) => !(card.not_ranks || []).includes(rank)); }
  function cardDescription(card, index) {
    const face = card.color ? `${colorName(card.color)} ${card.rank}.` : "Hidden card.";
    return `Card ${index + 1}: ${face} Known: ${colorName(card.known_color)}, number ${card.known_rank ?? "?"}. Possible colors: ${possibleColors(card).map(colorName).join(", ")}. Possible numbers: ${possibleRanks(card).join(", ")}.`;
  }
  function setTip(node, text) {
    node.dataset.hanabiTip = text;
    node.tabIndex = 0;
  }
  function createCard(card, index, own = false) {
    const node = element(own ? "button" : "div", "hanabi-card");
    const color = card.color || card.known_color;
    if (color) node.dataset.color = color;
    const description = cardDescription(card, index);
    node.dataset.hanabiExplain = "card";
    node.dataset.cardIndex = index;
    node.setAttribute("aria-label", description);
    if (own) {
      node.type = "button";
      node.setAttribute("aria-pressed", String(selectedCard === index));
      node.classList.toggle("selected", selectedCard === index);
      node.addEventListener("click", () => {
        selectedCard = selectedCard === index ? null : index;
        updateSelection();
      });
    } else {
      setTip(node, description);
    }
    const face = element("span", "hanabi-card-face");
    face.append(element("span", "", symbols[color] || "?"), element("span", "hanabi-card-rank", card.rank ?? card.known_rank ?? "?"));
    const knowledge = element("span", "hanabi-card-knowledge");
    knowledge.setAttribute("aria-hidden", "true");
    const dots = element("span", "hanabi-possible-colors");
    const numbers = element("span", "hanabi-possible-ranks");
    colors.forEach((candidate) => {
      const dot = element("span", "hanabi-color-dot");
      dot.dataset.color = candidate;
      dot.classList.toggle("hanabi-ruled-out", !possibleColors(card).includes(candidate));
      dots.appendChild(dot);
    });
    ranks.forEach((rank) => {
      const number = element("span", "", rank);
      number.classList.toggle("hanabi-ruled-out", !possibleRanks(card).includes(rank));
      numbers.appendChild(number);
    });
    knowledge.append(dots, numbers);
    node.append(element("span", "hanabi-card-index", `#${index + 1}`), face, knowledge);
    return node;
  }
  function renderHand(container, player, own = false) {
    container.replaceChildren();
    container.style.setProperty("--hanabi-hand-size", Math.max(player?.hand.length || 0, 1));
    if (!player?.hand.length) {
      container.append(element("span", "hanabi-muted", "No cards"));
      return;
    }
    player.hand.forEach((card, index) => container.appendChild(createCard(card, index, own)));
  }
  function updateSelection() {
    const card = ownPlayer()?.hand[selectedCard];
    $("Hand").querySelectorAll(".hanabi-card").forEach((node) => {
      const selected = Number(node.dataset.cardIndex) === selectedCard;
      node.classList.toggle("selected", selected);
      node.setAttribute("aria-pressed", String(selected));
    });
    $("SelectedCard").textContent = card
      ? `Card ${selectedCard + 1} · ${colorName(card.known_color)} · ${card.known_rank ?? "?"}`
      : view?.game_over ? "Game over · Cards revealed" : "Select a card";
    updateActions();
  }
  function updateActions() {
    const legal = pending ? [] : view?.legal_actions || [];
    const selected = selectedCard !== null && !!ownPlayer()?.hand[selectedCard];
    [["PlayBtn", "play", selected], ["DiscardBtn", "discard", selected], ["ClueBtn", "give_clue", !!targetPlayer() && clueValue !== null]].forEach(([id, action, valid]) => {
      const allowed = legal.includes(action) && valid;
      $(id).disabled = !allowed;
      $(id).classList.toggle("action-allowed", allowed);
    });
  }
  function updateCluePreview() {
    const target = targetPlayer();
    let count = 0;
    $("TargetHand").querySelectorAll(".hanabi-card").forEach((node, index) => {
      const match = clueValue !== null && String(target.hand[index][clueType]) === String(clueValue);
      node.classList.toggle("hanabi-clue-match", match);
      if (match) count++;
    });
    $("CluePreview").textContent = count ? `${count} matching ${count === 1 ? "card" : "cards"}` : "No matching cards";
    updateActions();
  }
  function renderClueValues() {
    const target = targetPlayer();
    const available = new Set((target?.hand || []).map((card) => card[clueType]));
    const values = (clueType === "color" ? colors : ranks).filter((value) => available.has(value));
    if (!values.some((value) => String(value) === String(clueValue))) clueValue = values[0] ?? null;
    $("ClueValueGroup").replaceChildren();
    values.forEach((value) => {
      const label = element("label", "hanabi-clue-value");
      const input = element("input");
      input.type = "radio";
      input.name = "hanabiClueValue";
      input.value = value;
      input.checked = String(value) === String(clueValue);
      input.setAttribute("aria-label", clueType === "color" ? colorName(value) : `Number ${value}`);
      label.append(input, element("span", "hanabi-clue-value-symbol", clueType === "color" ? symbols[value] : value));
      if (clueType === "color") {
        label.dataset.color = value;
        label.appendChild(element("span", "", labels[value]));
      }
      $("ClueValueGroup").appendChild(label);
    });
    if (!values.length) $("ClueValueGroup").append(element("span", "hanabi-muted", "No clues available"));
    updateCluePreview();
  }
  function renderPlayers() {
    const target = targetPlayer();
    renderHand($("TargetHand"), target);
    const others = (view?.players || []).filter((player) => player.player_id !== view.you && player.player_id !== target?.player_id);
    $("OtherHands").hidden = !others.length;
    $("OtherCount").textContent = others.length;
    $("Players").replaceChildren();
    others.forEach((player) => {
      const section = element("section", "hanabi-player");
      const heading = element("div", "hanabi-player-heading");
      heading.appendChild(element("strong", "", player.name));
      if (player.is_bot) heading.appendChild(element("span", "", "Bot"));
      if (player.player_id === view.current_turn) heading.appendChild(element("span", "", "Turn"));
      const hand = element("div", "hanabi-hand");
      renderHand(hand, player);
      section.append(heading, hand);
      $("Players").appendChild(section);
    });
    renderClueValues();
  }
  function renderTableau() {
    $("Tableau").replaceChildren();
    colors.forEach((color) => {
      const value = view.tableau[color] || 0;
      const stack = element("div", "hanabi-stack");
      stack.dataset.color = color;
      stack.dataset.hanabiExplain = "stack";
      const description = `${colorName(color)} firework: ${value}/5. ${value < 5 ? `Play a ${value + 1} next.` : "Complete!"}`;
      setTip(stack, description);
      const name = element("span", "hanabi-stack-color");
      name.append(element("span", "", symbols[color]), element("span", "", labels[color]));
      stack.append(name, element("strong", "", value), element("span", "hanabi-stack-next", value < 5 ? `Next ${value + 1}` : "Done"));
      $("Tableau").appendChild(stack);
    });
  }
  function renderDiscards() {
    const table = element("table", "hanabi-discard-table");
    table.setAttribute("aria-label", "Discarded cards by color and number");
    const header = element("tr");
    ["Color", ...ranks].forEach((value) => {
      const cell = element("th", "", value);
      cell.scope = "col";
      header.appendChild(cell);
    });
    const head = element("thead");
    head.appendChild(header);
    const body = element("tbody");
    let total = 0;
    colors.forEach((color) => {
      const row = element("tr");
      const name = element("th", "", `${symbols[color]} ${labels[color]}`);
      name.scope = "row";
      row.appendChild(name);
      ranks.forEach((rank) => {
        const count = view.discard_stats?.[color]?.[rank] || 0;
        total += count;
        const cell = element("td", count === copies[rank] ? "hanabi-discard-lost" : "", count);
        setTip(cell, `${colorName(color)} ${rank}: ${count} of ${copies[rank]} copies discarded.`);
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    table.append(head, body);
    $("DiscardStats").replaceChildren(table);
    $("DiscardCount").textContent = total;
  }
  function render(data) {
    if (!data?.view) return;
    if (dialog.open && !$("ConfirmActions").hidden) dialog.close();
    hideTip();
    view = data.view;
    pending = false;
    window.clearTimeout(pendingTimer);
    selectedCard = null;
    const current = view.players.find((player) => player.player_id === view.current_turn);
    $("Turn").textContent = view.game_over ? "Game over" : view.current_turn === view.you ? "Your turn" : `Turn: ${current?.name || "–"}`;
    $("Turn").classList.toggle("hanabi-your-turn", !view.game_over && view.current_turn === view.you);
    $("Clues").textContent = `${view.clue_tokens}/${view.max_clue_tokens}`;
    $("Fuses").textContent = `${view.fuse_tokens}/${view.max_fuse_tokens}`;
    $("Deck").textContent = view.deck_count;
    $("Score").textContent = `${view.score_standard ?? view.score}/25`;
    $("FinalTurns").hidden = !Number.isInteger(view.final_rounds_remaining);
    $("FinalTurns").textContent = `⏳ Final turns: ${view.final_rounds_remaining}`;
    $("Result").hidden = !view.game_over;
    const endings = { defeat: "No fuses left", perfect: "Perfect fireworks!", deck_exhausted: "Final turns complete" };
    $("Result").textContent = view.game_over ? `${endings[view.end_reason] || "Game over"} · ${view.score_display}` : "";
    $("OwnSection").hidden = !ownPlayer();
    panel.classList.toggle("hanabi-spectator", !ownPlayer());
    $("HandNote").textContent = view.game_over ? "Revealed" : "Clues only";
    $("HandNote").dataset.hanabiTip = view.game_over ? "All cards are revealed when the game ends." : "Your cards face away from you. Only received clues are shown.";
    renderHand($("Hand"), ownPlayer(), !view.game_over);
    const previousTarget = $("TargetSelect").value;
    const targets = view.players.filter((player) => player.player_id !== view.you);
    $("TargetSelect").replaceChildren();
    targets.forEach((player) => {
      const option = element("option", "", `${player.name}${player.player_id === view.current_turn ? " · Turn" : ""}${player.is_bot ? " · Bot" : ""}`);
      option.value = player.player_id;
      $("TargetSelect").appendChild(option);
    });
    if (targets.some((player) => player.player_id === previousTarget)) $("TargetSelect").value = previousTarget;
    $("TargetSelect").disabled = !targets.length;
    renderPlayers();
    renderTableau();
    renderDiscards();
    $("Log").replaceChildren();
    const entries = [...(view.log || [])].reverse();
    entries.forEach((entry) => $("Log").appendChild(element("div", "hanabi-log-entry", entry)));
    if (!entries.length) $("Log").textContent = "No actions yet";
    updateSelection();
    logGameEvents(data);
  }

  function hideTip() {
    window.clearTimeout(tipTimer);
    tooltip.hidden = true;
    tipTarget?.removeAttribute("aria-describedby");
    tipTarget = null;
  }
  function showTip(target, timed = false) {
    if (!target || hanabiExplainWidget?.isActive() || dialog.open) return;
    hideTip();
    tipTarget = target;
    tooltip.textContent = target.dataset.hanabiTip;
    tooltip.hidden = false;
    target.setAttribute("aria-describedby", tooltip.id);
    const rect = target.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    const left = Math.min(Math.max(12, rect.left + (rect.width - bounds.width) / 2), innerWidth - bounds.width - 12);
    const top = rect.bottom + 8 + bounds.height < innerHeight - 12 ? rect.bottom + 8 : Math.max(12, rect.top - bounds.height - 8);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    if (timed) tipTimer = window.setTimeout(hideTip, 3000);
  }
  function openDialog(title, body, html = false) {
    hideTip();
    returnFocus = document.activeElement;
    $("DialogTitle").textContent = title;
    if (html) $("DialogBody").innerHTML = body;
    else $("DialogBody").textContent = body;
    $("ConfirmActions").hidden = true;
    if (!dialog.open) dialog.showModal();
    $("DialogClose").focus();
  }
  function submit(action) {
    if (pending || !view?.legal_actions.includes(action.type)) return;
    pending = true;
    selectedCard = null;
    updateSelection();
    sendAction(action);
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => { pending = false; updateActions(); }, 5000);
  }
  function playSelected() {
    if (selectedCard === null || !ownPlayer()?.hand[selectedCard]) return;
    const cardIndex = selectedCard;
    dialog.close();
    submit({ type: "play", card_index: cardIndex });
  }
  $("PlayBtn").addEventListener("click", () => {
    const card = ownPlayer()?.hand[selectedCard];
    if (!card || $("PlayBtn").disabled) return;
    const possible = possibleColors(card).some((color) => possibleRanks(card).includes((view.tableau[color] || 0) + 1));
    if (!possible && possibleColors(card).length && possibleRanks(card).length) {
      openDialog("This play will fail", "The received clues rule out every card that could be played now. Playing this card will cost one fuse (❤️).");
      $("ConfirmActions").hidden = false;
      $("CancelPlay").focus();
    } else playSelected();
  });
  $("DiscardBtn").addEventListener("click", () => {
    if (selectedCard !== null) submit({ type: "discard", card_index: selectedCard });
  });
  $("ClueBtn").addEventListener("click", () => {
    if (!targetPlayer() || clueValue === null) return;
    submit({ type: "give_clue", target_player_id: $("TargetSelect").value, clue_type: clueType, value: clueType === "rank" ? Number(clueValue) : clueValue });
  });
  $("TargetSelect").addEventListener("change", () => { hideTip(); renderPlayers(); });
  $("ClueTypeGroup").addEventListener("change", (event) => {
    clueType = event.target.value;
    clueValue = null;
    renderClueValues();
  });
  $("ClueValueGroup").addEventListener("change", (event) => {
    clueValue = event.target.value;
    updateCluePreview();
  });
  $("DialogClose").addEventListener("click", () => dialog.close());
  $("ConfirmPlay").addEventListener("click", playSelected);
  $("CancelPlay").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (returnFocus?.isConnected && !panel.classList.contains("hidden")) returnFocus.focus({ preventScroll: true }); });
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  panel.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const target = event.target.closest("[data-hanabi-tip]");
    if (target && !target.contains(event.relatedTarget)) showTip(target);
  });
  panel.addEventListener("pointerout", (event) => {
    const target = event.target.closest("[data-hanabi-tip]");
    if (event.pointerType === "mouse" && target && !target.contains(event.relatedTarget)) hideTip();
  });
  panel.addEventListener("focusin", (event) => {
    if (event.target.matches("[data-hanabi-tip]")) showTip(event.target, true);
  });
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("click", (event) => {
    const target = event.target.closest("[data-hanabi-tip]");
    if (target) showTip(target, true);
    else hideTip();
    if (event.target.closest("button, input, select, label, summary, dialog, [data-hanabi-tip]")) return;
    selectedCard = null;
    updateSelection();
  });
  document.addEventListener("keydown", (event) => {
    if (panel.classList.contains("hidden")) return;
    if (event.key !== "Escape") return;
    hideTip();
    if (dialog.open || document.querySelector(".obg-help-dialog[open]")) return;
    hanabiExplainWidget?.exit();
    selectedCard = null;
    updateSelection();
  }, true);
  window.addEventListener("scroll", hideTip, true);
  window.addEventListener("resize", hideTip);

  function clearState() {
    view = null;
    selectedCard = null;
    clueType = "color";
    clueValue = null;
    pending = false;
    window.clearTimeout(pendingTimer);
    hanabiExplainWidget?.exit();
    if (dialog.open) dialog.close();
    $("Turn").textContent = "Waiting for the game to start";
    $("Turn").classList.remove("hanabi-your-turn");
    ["Clues", "Fuses", "Deck", "Score"].forEach((id) => { $(id).textContent = "–"; });
    ["Tableau", "Hand", "TargetHand", "Players", "TargetSelect", "ClueValueGroup", "DiscardStats", "Log"].forEach((id) => $(id).replaceChildren());
    ["Result", "FinalTurns", "OtherHands"].forEach((id) => { $(id).hidden = true; });
    $("OwnSection").hidden = false;
    panel.classList.remove("hanabi-spectator");
    $("HandNote").textContent = "Clues only";
    $("CluePreview").textContent = "";
    $("DiscardCount").textContent = "0";
    $("ClueTypeGroup").querySelector('input[value="color"]').checked = true;
    panel.querySelectorAll("details").forEach((details) => { details.open = false; });
    $("OtherHands").open = window.matchMedia("(min-width: 1101px)").matches;
    updateSelection();
  }
  window.renderHanabiGameState = render;
  window.clearHanabiState = clearState;
  window.showHanabiHeaderActions = (visible) => {
    $("HeaderActions").hidden = !visible;
    if (!visible) {
      hanabiExplainWidget?.exit();
      if (dialog.open) dialog.close();
    }
  };
  window.updateHanabiConfigRow = () => {
    const visible = currentGameType === "hanabi" && currentRoomState?.status === "lobby";
    [$("ConfigBox"), $("FinalRoundRow")].forEach((node) => {
      if (!node) return;
      node.classList.toggle("hidden", !visible);
      node.setAttribute("aria-hidden", String(!visible));
    });
  };
  if (typeof socket !== "undefined") socket.on("system:error", () => {
    pending = false;
    window.clearTimeout(pendingTimer);
    updateActions();
  });
  function initialize() {
    clearState();
    window.updateHanabiConfigRow();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
