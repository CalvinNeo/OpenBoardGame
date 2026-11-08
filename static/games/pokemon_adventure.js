// --- Help & Explain (designs/task185.md) ------------------------------
const pokemonAdventureHelpButton = document.getElementById("pokemonAdventureHelpBtn");
const pokemonAdventureExplainButton = document.getElementById("pokemonAdventureExplainBtn");

const POKEMON_ADVENTURE_HELP_CONFIG = {
  gameId: "pokemon_adventure",
  title: { zh: "宝可梦奇遇 · Pokémon Paper Safari", en: "Pokémon Paper Safari" },
  basic: {
    win: {
      zh: "每一小局结束时三列总分最低的训练家赢得该小局并获得一枚精灵球代币(🔴)，先攒够目标数量代币的训练家赢得整场。",
      en: "At the end of a round the trainer with the lowest total across the three columns wins that round and takes one Poké Ball token (🔴), and the first trainer to reach the target number of tokens wins the match."
    },
    turn: {
      zh: "轮到你时先从牌库或弃牌堆抽一张牌，再决定把它公开换入自己的某个位置还是直接弃掉，抽到的特殊牌换入后还会立刻发动能力。",
      en: "On your turn you first draw one card from the deck or the discard pile, then decide whether to swap it face up into one of your own slots or discard it, and a special card you swap in fires its ability right away."
    },
    key: {
      zh: "玩这个游戏的重点是让上排和下排同一列的两张牌数字相同，因为相同的列记 0 分，你的总分才会足够低。",
      en: "The key to the game is making the two cards in the same column match, because a matched column scores 0 and only that keeps your total low enough."
    }
  },
  sections: [
    {
      id: "setup",
      label: { zh: "准备与目标", en: "Setup and goal" },
      html: {
        zh: "<p>每位训练家面前摆六张牌，上排三张、下排三张，全部背面朝上。每一小局开始时，所有人先从自己的六张暗牌里选一张公开。</p>"
          + "<p>牌库共 56 张宝可梦牌。牌库摸空时，弃牌堆的顶牌会留在原处，其余弃牌洗回牌库。</p>"
          + "<p>每一小局的最低分者得到一枚精灵球代币(🔴)。先攒够目标数量代币的训练家赢得整场，默认目标是 3 枚。</p>",
        en: "<p>Every trainer lays out six cards, three on the top row and three on the bottom row, all face down. At the start of a round everyone first picks one of their own six cards to reveal.</p>"
          + "<p>The deck holds 56 Pokémon cards. When the deck runs out the top card of the discard pile stays in place and the remaining discards are shuffled back into the deck.</p>"
          + "<p>The lowest score of a round earns one Poké Ball token (🔴). The first trainer to reach the target number of tokens wins the match, and the default target is 3.</p>"
      }
    },
    {
      id: "flow",
      label: { zh: "回合流程", en: "Your turn" },
      html: {
        zh: "<p>轮到你时先从牌库(牌背)抽一张，或者拿走弃牌堆的公开顶牌。从牌库抽到的牌只有你自己能看见。</p>"
          + "<p>抽到牌以后，选择自己的一个位置把它公开换入，被换掉的旧牌公开弃掉。如果是从牌库抽到的普通牌，你也可以直接弃掉它来结束回合。</p>"
          + "<p>从弃牌堆拿到的牌必须使用，不能直接弃掉。闪电鸟(⚡)、梦幻(✨)和火箭队(🚀)即使从牌库抽到也必须使用。</p>"
          + "<p>只要有人把自己的六张牌全部公开，这一小局就在当前行动与它的能力结算完之后立刻结束。</p>",
        en: "<p>On your turn you either draw one card from the deck (the card back) or take the face-up top card of the discard pile. A card drawn from the deck is visible to you alone.</p>"
          + "<p>After drawing, pick one of your own slots to swap the card in face up, and the card you replace goes to the discard pile face up. A plain card drawn from the deck may instead be discarded outright to end your turn.</p>"
          + "<p>A card taken from the discard pile must be used and can never be discarded directly. Zapdos (⚡), Mew (✨) and Team Rocket (🚀) must be used even when they come from the deck.</p>"
          + "<p>As soon as any trainer has all six of their cards face up, the round ends once the current action and its ability have finished resolving.</p>"
      }
    },
    {
      id: "abilities",
      label: { zh: "六种能力", en: "The six abilities" },
      html: {
        zh: "<table><thead><tr><th>卡牌</th><th>能力</th></tr></thead><tbody>"
          + "<tr><td>喷火龙(🐲) · 10</td><td>换入后可以窥视自己的一张暗牌，只有你自己知道这张牌，也可以跳过。</td></tr>"
          + "<tr><td>卡比兽(💤) · 10</td><td>换入后可以交换自己任意两个位置的牌，公开状态跟着牌一起移动，也可以跳过。</td></tr>"
          + "<tr><td>闪电鸟(⚡) · 10</td><td>必须使用。选一个位置，沿回合顺序把每个人该位置的旧牌依次交给下一位，所有换入的牌都公开，最后交出的那张牌放到弃牌堆底。</td></tr>"
          + "<tr><td>梦幻(✨) · 2</td><td>必须使用。先选对手的一张明牌，再选自己的接收位置。梦幻进入对手的该位置，夺到的明牌公开换入你的位置，你原来的牌弃掉。</td></tr>"
          + "<tr><td>百变怪(🔮) · 0</td><td>结算时复制同一排左侧或右侧相邻牌的数字。边缘位置自动复制唯一的邻居，中间位置由持有者选择方向，互相复制形成的环按 0 计。</td></tr>"
          + "<tr><td>火箭队(🚀) · 12</td><td>必须使用。选好自己的位置后投币，喵喵面按普通牌换入，皮卡丘面让全员弃掉该位置的旧牌并弃掉火箭队，再从当前玩家起依次补入公开新牌。</td></tr>"
          + "</tbody></table>"
          + "<p>只有你主动抽到并换入的特殊牌才会发动能力。开局翻开的牌、被闪电鸟传递的牌、被梦幻夺走的牌和火箭队补入的新牌都不会连锁发动。</p>",
        en: "<table><thead><tr><th>Card</th><th>Ability</th></tr></thead><tbody>"
          + "<tr><td>Charizard (🐲) · 10</td><td>After it enters you may peek at one of your own face-down cards, and only you learn what it is. You may also skip.</td></tr>"
          + "<tr><td>Snorlax (💤) · 10</td><td>After it enters you may swap any two of your own slots, and the face-up state travels with the card. You may also skip.</td></tr>"
          + "<tr><td>Zapdos (⚡) · 10</td><td>Must be used. Choose a slot, then every player in turn order hands the old card in that slot to the next player, every incoming card is face up, and the last card handed out goes to the bottom of the discard pile.</td></tr>"
          + "<tr><td>Mew (✨) · 2</td><td>Must be used. First pick a face-up card of an opponent, then pick your own receiving slot. Mew lands in that opponent slot, the stolen card enters your slot face up, and your old card is discarded.</td></tr>"
          + "<tr><td>Ditto (🔮) · 0</td><td>At scoring it copies the number of the card to its left or right in the same row. An edge slot copies its only neighbour automatically, a middle slot is chosen by its owner, and a loop of mutual copies counts as 0.</td></tr>"
          + "<tr><td>Team Rocket (🚀) · 12</td><td>Must be used. After you pick your own slot a coin is flipped. Meowth enters like a normal card, while Pikachu makes every player discard the card in that slot, discards Team Rocket itself, and then deals a new face-up card to each player in turn order starting from you.</td></tr>"
          + "</tbody></table>"
          + "<p>Only a special card that you draw and swap in yourself fires its ability. Cards revealed at setup, passed by Zapdos, stolen by Mew, or refilled by Team Rocket never trigger a chain.</p>"
      }
    },
    {
      id: "scoring",
      label: { zh: "计分与小局结束", en: "Scoring and round end" },
      html: {
        zh: "<p>把上排和下排同一列的两张有效数字相比，相同则这一列记 0 分，不同则把两个数字相加。三列分数加起来就是你这一小局的总分，总分越低越好。</p>"
          + "<p>总分最低的训练家赢得这一小局并得到一枚精灵球代币(🔴)，下一小局由他先手。同分时把六张牌的有效数字从大到小排列，首个不同的数字较大者获胜，仍完全相同则座位靠前者获胜。</p>"
          + "<p>如果牌库彻底摸空且无法补牌，这一小局直接进入结算。结算前如果还有百变怪(🔮)需要选方向，先选完再显示分数。</p>"
          + "<p>所有人看完结果并点击 Next Round 之后才会重新发牌，机器人会自动确认。</p>",
        en: "<p>Compare the two effective numbers in the same column of the top and the bottom row. A matching pair scores 0 for that column, and a different pair scores the sum of the two numbers. The three columns added together are your round total, and lower is better.</p>"
          + "<p>The trainer with the lowest total wins the round, takes one Poké Ball token (🔴), and starts the next round. On a tie the six effective numbers are sorted from high to low and the first number that differs decides in favour of the higher one, while a perfect tie is settled by seat order.</p>"
          + "<p>If the deck is completely empty and no card can be drawn, the round goes straight to scoring. When a Ditto (🔮) still needs a direction, that choice is made before the scores appear.</p>"
          + "<p>New cards are only dealt after everyone has read the result and pressed Next Round, and bots confirm on their own.</p>"
      }
    },
    {
      id: "online",
      label: { zh: "线上操作", en: "Playing online" },
      html: {
        zh: "<p>绿色描边表示当前可以点的位置，金色表示已经选中。点击周围空白或按 Esc 可以取消选择。</p>"
          + "<p>锁形标记(🔒)表示这张暗牌只有你自己记住了，其他训练家依然看不到。Log 默认折叠，可以展开查看行动记录。</p>"
          + "<p>Explain 可以解释灰色或暂时不可点的控件，解释模式不会执行任何游戏行动。电脑上悬停可以看图标提示，手机上轻触的提示会在 3 秒后消失。</p>",
        en: "<p>A green outline marks the slots you may click right now, and gold marks the slot you have selected. Click the empty space around the table or press Esc to cancel a selection.</p>"
          + "<p>A padlock (🔒) marks a face-down card that only you have memorised, and the other trainers still cannot see it. The log is collapsed by default and can be expanded to review the actions.</p>"
          + "<p>Explain describes greyed out or currently unclickable controls, and explain mode never performs a game action. On a desktop you can hover for icon tips, and on a phone a tap shows a tip that fades after 3 seconds.</p>"
      }
    }
  ]
};

const POKEMON_ADVENTURE_EXPLAIN = {
  deck: { zh: "牌库。点它抽一张牌，只有你能看见。抽到的普通牌可以换入自己的一个位置，也可以直接弃掉。", en: "The deck. Tap it to draw one card that only you can see. A plain card drawn here can be swapped into one of your slots or discarded outright." },
  discard: { zh: "弃牌堆。拿走公开的顶牌，这张牌必须使用，不能直接弃掉。", en: "The discard pile. Take its face-up top card, which must be used and can never be discarded directly." },
  drawn: { zh: "你刚抽到的牌。从牌库抽的牌别人看不见，点自己的一个位置后在原地确认换入。", en: "The card you just drew. A card from the deck stays hidden from everyone else. Pick one of your own slots and confirm in place to swap it in." },
  discard_drawn: { zh: "弃掉刚从牌库抽到的牌并结束回合。来自弃牌堆的牌以及闪电鸟(⚡)、梦幻(✨)、火箭队(🚀)不能这样弃掉。", en: "Discard the card you just drew from the deck and end your turn. Cards from the discard pile, plus Zapdos (⚡), Mew (✨) and Team Rocket (🚀), cannot be discarded this way." },
  skip: { zh: "跳过喷火龙(🐲)的窥视或卡比兽(💤)的交换。跳过后保留刚换入的牌，当前回合结束。", en: "Skip the peek from Charizard (🐲) or the swap from Snorlax (💤). You keep the card you just swapped in and your turn ends." },
  next_round: { zh: "确认已经看完这一小局的结果。所有真人都确认后才会重新发牌，机器人自动确认。", en: "Confirm that you have read the result of this round. New cards are dealt once every human has confirmed, and bots confirm automatically." },
  tokens: { zh: "精灵球代币(🔴)。每一小局的最低分者得到一枚，先达到目标数量的训练家赢得整场。", en: "Poké Ball tokens (🔴). The lowest score of a round earns one, and the first trainer to reach the target number wins the match." },
  columns: { zh: "按列计分。同一列上下两张牌的有效数字相同记 0 分，不同则相加。三列合计就是你这一小局的分数。", en: "Column scoring. A column whose top and bottom effective numbers match scores 0, otherwise the two numbers are added. The three columns together are your round score." },
  card: { zh: "一张宝可梦牌。数字是它的分值，牌面下方是它的能力。点选后在牌旁确认当前行动。", en: "One Pokémon card. The number is its value and the line underneath is its ability. Select it and confirm the current action next to the card." },
  confirm: { zh: "确认对选中位置执行当前行动。点击周围空白或按 Esc 可以取消选择。", en: "Confirm the current action on the selected slot. Click the empty space around the table or press Esc to cancel the selection." },
  ditto: { zh: "为百变怪(🔮)选择复制方向。只能复制同一排左边或右边的邻居，选完在对应卡牌旁确认。", en: "Choose which direction Ditto (🔮) copies. It can only copy its left or right neighbour in the same row, and you confirm next to that card." }
};

let pokemonAdventureHelpWidget = null;
let pokemonAdventureExplainWidget = null;

function initPokemonAdventureHelpExplain() {
  if (pokemonAdventureHelpWidget || typeof window.obgCreateHelp !== "function") return;
  pokemonAdventureHelpWidget = window.obgCreateHelp(POKEMON_ADVENTURE_HELP_CONFIG);
  pokemonAdventureExplainWidget = window.obgCreateExplain({
    gameId: "pokemon_adventure",
    attribute: "data-pa-explain",
    explanations: POKEMON_ADVENTURE_EXPLAIN,
    button: pokemonAdventureExplainButton,
    root: () => document.getElementById("pokemonAdventurePanel"),
    bypass: ["#pokemonAdventureHelpBtn", "#pokemonAdventureExplainBtn"]
  });
  pokemonAdventureHelpButton?.addEventListener("click", () => {
    pokemonAdventureExplainWidget?.exit();
    pokemonAdventureHelpWidget.open();
  });
  pokemonAdventureExplainButton?.addEventListener("click", () => pokemonAdventureExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPokemonAdventureHelpExplain);
} else {
  initPokemonAdventureHelpExplain();
}

(() => {
  "use strict";

  const byId = suffix => document.getElementById(`pokemonAdventure${suffix}`);
  const panel = byId("Panel");
  const tooltip = byId("Tooltip");
  const abilityLabels = {charizard: "窥视", snorlax: "交换", zapdos: "传递", mew: "夺取", ditto: "复制", rocket: "投币", team_rocket: "投币"};
  const cardColors = {pink: "#f2dae5", brown: "#e6d6ba", yellow: "#f2e6ac", green: "#d1e8ca", blue: "#cfe3ed", orange: "#f2d7b4", purple: "#ded5ee", gray: "#dedfd7"};
  let view = null;
  let signature = null;
  let selection = {};
  let pending = false;
  let pendingTimer = null;
  let tipTimer = null;
  let tipAnchor = null;
  let gesture = null;
  let suppressClickUntil = 0;

  const active = () => panel && !panel.classList.contains("hidden") && (typeof currentGameType === "undefined" || currentGameType === "pokemon_adventure");
  const players = () => Array.isArray(view?.players) ? view.players : [];
  const ownPlayer = () => players().find(player => player.player_id === view?.you);
  const playerName = id => players().find(player => player.player_id === id)?.name || "Trainer";
  const connected = () => typeof socket === "undefined" || socket.connected;
  const can = type => !pending && connected() && !!view?.legal_actions?.includes(type);
  const slotLabel = slot => `${slot < 3 ? "上" : "下"}${slot % 3 + 1}`;
  const cardName = card => card?.name_zh || card?.name || card?.species || "宝可梦";
  const ownDittoChoices = () => (view?.ditto_choices || []).filter(choice => choice.player_id === view?.you);

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined && content !== null) node.textContent = content;
    return node;
  }
  function text(suffix, content) { byId(suffix).textContent = content; }
  function feedback(message = "") { text("Feedback", message); byId("Feedback").classList.toggle("hidden", !message); }
  function resetSelection() { selection = {}; }
  function cardDescription(card) {
    if (!card) return "暗牌，身份尚未公开。";
    const ability = {charizard: "入场后可窥视自己一张暗牌，其他人看不到。", snorlax: "入场后可交换自己的两个位置，朝向随牌移动。", zapdos: "必须使用；选同一位置沿回合顺序传递，每人的新牌都公开，末张旧牌放弃牌堆底。", mew: "必须使用；选择对手一张明牌，将梦幻放到该位置，把夺到的明牌换入自己。", ditto: "结算时复制左右相邻牌的数字；边缘位置自动复制唯一邻居。", rocket: "必须使用；投币决定正常换入，或让全员同位置弃牌并补牌。", team_rocket: "必须使用；投币决定正常换入，或让全员同位置弃牌并补牌。"};
    return `${cardName(card)}（${card.emoji || "⭐"}），${card.value} 分。${ability[card.ability] || "普通牌；争取让同列上下数字相等，消去这一列的分数。"}`;
  }

  function paintCard(node, item, position = null) {
    const card = item?.card || null;
    node.replaceChildren();
    node.classList.toggle("pa-back", !card);
    node.classList.remove("pa-empty");
    node.classList.toggle("private", !!card && item?.face_up === false);
    node.style.removeProperty("--pa-card-color");
    node.dataset.paTip = cardDescription(card);
    node.dataset.paExplain = "card";
    if (!card) {
      node.append(element("span", "pa-back-ball"), element("span", "pa-back-label", position === null ? "牌背" : slotLabel(position)));
      node.setAttribute("aria-label", `${position === null ? "" : `${slotLabel(position)}，`}暗牌`);
      return;
    }
    if (cardColors[card.color]) node.style.setProperty("--pa-card-color", cardColors[card.color]);
    const heading = element("span", "pa-card-head");
    heading.append(element("span", "pa-card-value", card.effective_value ?? card.value), element("span", "pa-card-position", position === null ? "" : slotLabel(position)));
    const footer = element("span", "pa-card-footer");
    footer.append(element("span", "pa-card-name", cardName(card)));
    const abilityText = card.ability === "ditto" && card.effective_value !== undefined ? `复制 → ${card.effective_value}` : abilityLabels[card.ability] || "普通牌";
    footer.append(element("span", item?.face_up === false ? "pa-card-ability pa-private-mark" : "pa-card-ability", item?.face_up === false ? "🔒 仅你可见" : abilityText));
    node.append(heading, element("span", "pa-card-emoji", card.emoji || "⭐"), footer);
    node.setAttribute("aria-label", `${position === null ? "" : `${slotLabel(position)}，`}${cardDescription(card)}${item?.face_up === false ? " 这是你记住的暗牌。" : ""}`);
  }

  function selectable(playerId, slot) {
    if (!view || pending || !connected()) return false;
    if (playerId !== view.you) return can("steal_card") && !!players().find(player => player.player_id === playerId)?.hand?.[slot]?.face_up;
    if (can("initial_reveal")) return !ownPlayer()?.hand?.[slot]?.face_up;
    if (can("replace_card")) return true;
    if (can("peek_card")) return (view.pending_ability?.slots || []).includes(slot);
    if (can("swap_cards")) return (view.pending_ability?.slots || [0, 1, 2, 3, 4, 5]).includes(slot);
    if (can("steal_card")) return !!selection.target;
    if (can("choose_ditto")) {
      const choice = ownDittoChoices().find(entry => entry.slot === selection.dittoSlot);
      return ownDittoChoices().some(entry => entry.slot === slot) || !!choice?.neighbors?.includes(slot);
    }
    return false;
  }

  function selectSlot(playerId, slot) {
    if (!selectable(playerId, slot)) return;
    hideTip();
    if (playerId !== view.you) selection = {target: {playerId, slot}};
    else if (can("swap_cards")) {
      const previous = selection.swapSlots || [];
      selection.swapSlots = previous.includes(slot) ? previous.filter(value => value !== slot) : [...previous.slice(-1), slot];
    } else if (can("choose_ditto")) {
      const choice = ownDittoChoices().find(entry => entry.slot === selection.dittoSlot);
      if (choice?.neighbors?.includes(slot)) selection.neighborSlot = slot;
      else { selection.dittoSlot = slot; delete selection.neighborSlot; }
    } else selection.slot = selection.slot === slot ? undefined : slot;
    renderTable();
    renderActions();
  }

  function confirmationFor(playerId, slot) {
    if (playerId !== view?.you) return null;
    if (can("swap_cards") && selection.swapSlots?.length === 2 && selection.swapSlots[1] === slot) return {label: "确认交换", action: {type: "swap_cards", slots: selection.swapSlots}};
    if (can("choose_ditto") && selection.neighborSlot === slot) return {label: "复制此值", action: {type: "choose_ditto", slot: selection.dittoSlot, neighbor_slot: slot}};
    if (selection.slot !== slot) return null;
    if (can("initial_reveal")) return {label: "翻开此牌", action: {type: "initial_reveal", slot}};
    if (can("replace_card")) return {label: "确认换入", action: {type: "replace_card", slot}};
    if (can("peek_card")) return {label: "窥视此牌", action: {type: "peek_card", slot}};
    if (can("steal_card") && selection.target) return {label: "夺取并换入", action: {type: "steal_card", target_player_id: selection.target.playerId, target_slot: selection.target.slot, slot}};
    return null;
  }

  function handCard(player, item, slot) {
    const wrapper = element("div", "pa-slot");
    const button = element("button", "pa-card");
    button.type = "button";
    button.dataset.paPlayer = player.player_id;
    button.dataset.paSlot = slot;
    paintCard(button, item, slot);
    button.classList.toggle("selectable", selectable(player.player_id, slot));
    button.setAttribute("aria-disabled", String(!selectable(player.player_id, slot)));
    const selected = player.player_id === view.you
      ? selection.slot === slot || selection.swapSlots?.includes(slot) || selection.dittoSlot === slot || selection.neighborSlot === slot
      : selection.target?.playerId === player.player_id && selection.target.slot === slot;
    button.classList.toggle("selected", !!selected);
    button.setAttribute("aria-pressed", String(!!selected));
    wrapper.append(button);
    const confirmation = confirmationFor(player.player_id, slot);
    if (confirmation) {
      const confirmButton = element("button", "pa-slot-confirm pa-primary", confirmation.label);
      confirmButton.type = "button";
      confirmButton.dataset.paExplain = "confirm";
      confirmButton.dataset.paTip = "确认对选中的位置执行当前行动。点击周围空白或按 Esc 可以取消选择。";
      confirmButton.addEventListener("click", () => dispatch(confirmation.action));
      wrapper.append(confirmButton);
    }
    return wrapper;
  }

  function mewReceiver() {
    const box = element("div", "pa-mew-receive");
    box.append(element("strong", "", `夺取${slotLabel(selection.target.slot)}：放入你的哪个位置？`));
    const slots = element("div", "pa-mew-receive-slots");
    (ownPlayer()?.hand || []).forEach((item, slot) => {
      const button = element("button", "", `${slotLabel(slot)} · ${item.known ? item.card.value : "?"}`);
      button.type = "button";
      button.dataset.paReceive = slot;
      button.dataset.paExplain = "drawn";
      button.setAttribute("aria-pressed", String(selection.slot === slot));
      button.addEventListener("click", event => { event.stopPropagation(); selectSlot(view.you, slot); });
      slots.append(button);
    });
    box.append(slots);
    if (Number.isInteger(selection.slot)) {
      const button = element("button", "pa-primary pa-mew-confirm", `确认夺取 → 你的${slotLabel(selection.slot)}`);
      button.type = "button";
      button.dataset.paExplain = "confirm";
      button.addEventListener("click", event => {
        event.stopPropagation();
        dispatch({type: "steal_card", target_player_id: selection.target.playerId, target_slot: selection.target.slot, slot: selection.slot});
      });
      box.append(button);
    }
    return box;
  }

  function renderTable() {
    const own = ownPlayer();
    text("YouName", own ? `${own.name} · 你的六牌` : "Spectating");
    text("Tokens", own ? `🔴 ${own.tokens || 0} / ${view?.config?.target_tokens || 3}` : "");
    byId("Tokens").dataset.paExplain = "tokens";
    byId("Tokens").dataset.paTip = POKEMON_ADVENTURE_EXPLAIN.tokens.zh;
    byId("Tokens").tabIndex = 0;
    const hand = byId("Hand");
    hand.replaceChildren();
    if (own) (own.hand || []).forEach((item, slot) => hand.append(handCard(own, item, slot)));
    else hand.append(element("p", "pa-observer-note", "观看其他训练家的六牌桌面。"));
    const columnScores = byId("Columns");
    columnScores.replaceChildren();
    const ownSummary = view?.phase === "round_end" ? view?.last_round_summary?.players?.find(player => player.player_id === view.you) : null;
    if (ownSummary?.columns) ownSummary.columns.forEach((score, index) => {
      const label = element("span", "", `第 ${index + 1} 列：${typeof score === "object" ? score.score : score} 分`);
      label.dataset.paExplain = "columns";
      label.dataset.paTip = POKEMON_ADVENTURE_EXPLAIN.columns.zh;
      label.tabIndex = 0;
      columnScores.append(label);
    });
    const others = players().filter(player => player.player_id !== view?.you);
    text("PlayerCount", `${players().length} 人`);
    const opponents = byId("Players");
    opponents.replaceChildren();
    others.forEach(player => {
      const article = element("article", "pa-opponent");
      article.classList.toggle("acting", player.player_id === view.current_turn && view.phase !== "round_end");
      const heading = element("div", "pa-opponent-head");
      heading.append(element("strong", "", `${player.player_id === view.current_turn && view.phase !== "round_end" ? "▶ " : ""}${player.name}`), element("span", "", `🔴 ${player.tokens || 0}`));
      const otherHand = element("div", "pa-hand");
      (player.hand || []).forEach((item, slot) => otherHand.append(handCard(player, item, slot)));
      const meta = element("div", "pa-opponent-meta");
      meta.append(element("span", "", `已公开 ${player.revealed_count ?? player.hand?.filter(item => item.face_up).length ?? 0}/6`));
      if (view.phase === "initial_reveal") meta.append(element("span", "", player.initial_reveal_done ? "已翻牌 ✓" : "选择首张"));
      if (view.phase === "round_end") meta.append(element("span", "", `${player.round_score ?? "—"} 分${player.round_ready ? " · Ready ✓" : ""}`));
      article.append(heading, otherHand, meta);
      if (can("steal_card") && selection.target?.playerId === player.player_id) article.append(mewReceiver());
      opponents.append(article);
    });
  }

  function prompt() {
    if (!view) return ["Waiting for the game state.", ""];
    if (pending) return ["Submitting…", "等待服务器更新。"];
    if (!connected()) return ["Disconnected", "Reconnecting…"];
    if (view.game_over) return ["整场结束", "可在 Room Controls 中开始新一场。"];
    if (can("initial_reveal")) return ["翻开你的第一张牌", "点选一个位置，再在牌旁确认。"];
    if (view.phase === "initial_reveal") return ["等待所有训练家翻牌", "你已公开第一张牌。"];
    if (view.phase === "round_end") return ["查看本局结果", ownPlayer()?.round_ready ? "Ready ✓ · 等待其他训练家。" : "查看牌面后点击 Next Round。"];
    if (can("choose_ditto")) return ["选择百变怪复制的数字", selection.dittoSlot !== undefined ? "点选同一排左侧或右侧的邻居，再原地确认。" : "点选需要决定的百变怪。"];
    if (can("peek_card")) return ["🔥 喷火龙 · 窥视", "点选自己一张暗牌。结果仅你可见，也可跳过。"];
    if (can("swap_cards")) return ["💤 卡比兽 · 交换", selection.swapSlots?.length === 1 ? `已选${slotLabel(selection.swapSlots[0])}，再选择第二个位置。` : "点选自己两个位置，朝向随牌移动。"];
    if (can("steal_card")) return ["✨ 梦幻 · 夺取", selection.target ? `已选 ${playerName(selection.target.playerId)} 的${slotLabel(selection.target.slot)}，再选自己的接收位置。` : "先选对手的一张明牌，再选自己的接收位置。"];
    if (can("replace_card")) return ["选择换入的位置", view.drawn?.card?.ability === "zapdos" ? "⚡ 闪电鸟将沿顺序传递此位置的旧牌。" : ["rocket", "team_rocket"].includes(view.drawn?.card?.ability) ? "投币后，正常换入或重置所有人同一位置。" : "点选自己的牌并原地确认；可弃抽牌时也可直接弃掉。"];
    if (can("draw_deck") || can("draw_discard")) return ["从牌库或弃牌堆抽一张", "换入低分牌，或让上下同列的数字相同。"];
    return [`${playerName(view.current_turn)} 正在行动`, "公开牌与行动日志会随操作更新。"];
  }

  function renderActions() {
    const [main, note] = prompt();
    text("Prompt", main);
    text("ActionNote", note);
    text("Round", view ? `第 ${view.round} 局` : "");
    const phases = {initial_reveal: "首张翻牌", turn: "抽牌", drawn: "选择换牌", ability: "特殊能力", ditto_choice: "百变怪结算", round_end: "小局结算"};
    text("Phase", phases[view?.phase] || "");
    text("Turn", view?.game_over ? "🏆 整场结束" : view?.legal_actions?.length ? "轮到你行动" : view ? `${playerName(view.current_turn)} 的回合` : "Waiting to start");
    const needsAction = !!view?.legal_actions?.length && !view.game_over;
    byId("Status").classList.toggle("your-turn", needsAction);
    document.body.classList.toggle("pa-your-turn", active() && needsAction);
    byId("DrawDeckBtn").disabled = !can("draw_deck");
    byId("DrawDiscardBtn").disabled = !can("draw_discard");
    byId("DiscardBtn").disabled = !can("discard_drawn");
    byId("DiscardBtn").classList.toggle("hidden", !["turn", "drawn"].includes(view?.phase));
    byId("Piles").classList.toggle("hidden", !["turn", "drawn"].includes(view?.phase));
    byId("SkipBtn").disabled = !can("skip_ability");
    byId("SkipBtn").classList.toggle("hidden", !view?.pending_ability);
    byId("NextRoundBtn").classList.toggle("hidden", view?.phase !== "round_end" || !!view?.game_over);
    byId("Review").classList.toggle("hidden", view?.phase !== "round_end" || !!view?.game_over);
    byId("NextRoundBtn").disabled = !can("next_round");
    text("NextRoundBtn", ownPlayer()?.round_ready ? "Ready ✓" : "Next Round");
    text("DeckCount", view ? `· ${view.deck_count} 张` : "");
    if (view?.discard_top) paintCard(byId("DrawDiscardBtn"), {card: view.discard_top, face_up: true});
    else { byId("DrawDiscardBtn").replaceChildren(element("span", "", "暂无弃牌")); byId("DrawDiscardBtn").classList.add("pa-empty"); }
    byId("DrawDiscardBtn").dataset.paExplain = "discard";
    if (view?.drawn && view.drawn.player_id === view.you && view.drawn.card) paintCard(byId("Drawn"), {card: view.drawn.card, face_up: true});
    else if (view?.drawn) paintCard(byId("Drawn"), {card: null});
    else { byId("Drawn").replaceChildren(element("span", "", "尚未抽牌")); byId("Drawn").className = "pa-card pa-empty"; }
    byId("Drawn").dataset.paExplain = "drawn";
    renderChoice();
  }

  function renderChoice() {
    const box = byId("Choice");
    box.replaceChildren();
    const choice = ownDittoChoices().find(entry => entry.slot === selection.dittoSlot);
    box.classList.toggle("hidden", !can("choose_ditto"));
    if (!can("choose_ditto")) return;
    box.append(element("strong", "", choice ? `${slotLabel(choice.slot)} 百变怪：复制哪一张？` : "结算前，为百变怪选择相邻数字。"));
    const controls = element("div", "pa-choice-controls");
    if (choice) choice.neighbors.forEach(neighborSlot => {
      const card = ownPlayer()?.hand?.[neighborSlot]?.card;
      const button = element("button", "", `${slotLabel(neighborSlot)} · ${cardName(card)} ${card?.value ?? "?"}`);
      button.type = "button";
      button.dataset.paExplain = "ditto";
      button.dataset.paTip = "点选这个邻居后，在对应卡牌旁确认复制。";
      button.addEventListener("click", () => { selection.neighborSlot = neighborSlot; renderTable(); });
      controls.append(button);
    });
    else ownDittoChoices().forEach(entry => {
      const button = element("button", "", `${slotLabel(entry.slot)} 百变怪`);
      button.type = "button";
      button.dataset.paExplain = "ditto";
      button.dataset.paTip = "选择此百变怪，再决定复制同排左侧还是右侧的邻居。";
      button.addEventListener("click", () => { selection.dittoSlot = entry.slot; renderTable(); renderChoice(); });
      controls.append(button);
    });
    box.append(controls);
  }

  function renderResult() {
    const result = byId("Result");
    const summary = view?.last_round_summary;
    const visible = view?.phase === "round_end" && !!summary;
    result.classList.toggle("hidden", !visible);
    result.replaceChildren();
    if (!visible) return;
    const winners = view.game_over ? view.winner || [] : summary.winner ? [summary.winner] : [];
    const names = winners.map(playerName).join("、");
    result.append(element("h3", "", view.game_over ? `🏆 ${names || "训练家"} 获得整场胜利` : `第 ${summary.round} 局 · ${names || "结算完成"}${names ? " 获得 🔴" : ""}`));
    (summary.players || []).forEach(player => {
      const row = element("div", `pa-result-row${player.player_id === view.you ? " own" : ""}`);
      row.append(element("span", "", `${player.player_id === view.you ? "你 · " : ""}${player.name || playerName(player.player_id)}`), element("span", "", `${player.score} 分`), element("span", "", `🔴 ${player.tokens ?? players().find(entry => entry.player_id === player.player_id)?.tokens ?? 0}`));
      result.append(row);
    });
    if (summary.tie_break) result.append(element("p", "", typeof summary.tie_break === "string" ? summary.tie_break : "同分比较降序有效数字，较高者胜；仍相同按座位顺序决定。"));
    const me = (summary.players || []).find(player => player.player_id === view.you);
    if (me?.columns) result.append(element("p", "", `你的三列：${me.columns.map(score => typeof score === "object" ? score.score : score).join(" + ")} = ${me.score} 分`));
    if (!view.game_over) result.append(element("p", "", "牌面保留供所有人查看。每人点击 Next Round 后继续。"));
  }

  function renderLog() {
    const entries = Array.isArray(view?.log) ? view.log : [];
    const list = byId("Log");
    const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 20;
    list.replaceChildren();
    entries.slice(-60).forEach(entry => list.append(element("li", "", typeof entry === "string" ? entry : entry.text || entry.message || "行动已完成")));
    text("LogCount", entries.length ? `· ${entries.length}` : "");
    if (atBottom) list.scrollTop = list.scrollHeight;
  }

  function render() { renderTable(); renderActions(); renderResult(); renderLog(); }

  function dispatch(action) {
    if (!can(action.type) || typeof sendAction !== "function") return;
    hideTip(); feedback(); pending = true;
    resetSelection();
    renderTable(); renderActions();
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; if (active()) render(); }, 5000);
    sendAction(action);
  }

  function hideTip() { clearTimeout(tipTimer); tipAnchor = null; tooltip.classList.add("hidden"); }
  function showTip(target, autoHide = false) {
    if (!target || !active()) return;
    const message = target.dataset.paTip;
    if (!message) return;
    clearTimeout(tipTimer);
    tipAnchor = target;
    tooltip.textContent = message;
    tooltip.classList.remove("hidden");
    const rect = target.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(10, Math.min(innerWidth - box.width - 10, rect.left))}px`;
    tooltip.style.top = `${Math.max(10, Math.min(innerHeight - box.height - 10, rect.bottom + 7))}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  byId("DrawDeckBtn").addEventListener("click", () => dispatch({type: "draw_deck"}));
  byId("DrawDiscardBtn").addEventListener("click", () => dispatch({type: "draw_discard"}));
  byId("DiscardBtn").addEventListener("click", () => dispatch({type: "discard_drawn"}));
  byId("SkipBtn").addEventListener("click", () => dispatch({type: "skip_ability"}));
  byId("NextRoundBtn").addEventListener("click", () => dispatch({type: "next_round"}));

  panel.addEventListener("click", event => {
    if (!active()) return;
    const card = event.target.closest("[data-pa-player]");
    if (card) {
      const playerId = card.dataset.paPlayer;
      const slot = Number(card.dataset.paSlot);
      if (selectable(playerId, slot)) selectSlot(playerId, slot);
      else if (gesture?.pointerType !== "mouse") showTip(card, true);
      return;
    }
    if (!event.target.closest("button, a, summary, [data-pa-tip], .pa-choice")) { resetSelection(); renderTable(); renderActions(); }
    const staticTip = event.target.closest("[data-pa-tip]");
    if (staticTip && !event.target.closest("button") && gesture?.pointerType !== "mouse") showTip(staticTip, true);
  });
  panel.addEventListener("pointerover", event => {
    if (event.pointerType !== "mouse" || !active()) return;
    const target = event.target.closest("[data-pa-tip]");
    if (target && (!target.matches("button") || target.getAttribute("aria-disabled") === "true")) showTip(target);
  });
  panel.addEventListener("pointerout", event => { if (tipAnchor && !tipAnchor.contains(event.relatedTarget)) hideTip(); });
  panel.addEventListener("focusin", event => { const target = event.target.closest("[data-pa-tip]"); if (target && !target.matches("button")) showTip(target); });
  panel.addEventListener("focusout", hideTip);

  document.addEventListener("pointerdown", event => {
    if (!active()) return;
    if (panel.contains(event.target)) gesture = {pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, pointerType: event.pointerType};
  }, true);
  document.addEventListener("pointermove", event => {
    if (gesture?.pointerId === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 9) gesture.moved = true;
  }, {capture: true, passive: true});
  document.addEventListener("pointerup", event => {
    if (gesture?.pointerId === event.pointerId && gesture.moved) suppressClickUntil = performance.now() + 550;
  }, true);
  document.addEventListener("pointercancel", event => {
    if (gesture?.pointerId === event.pointerId) { gesture = null; suppressClickUntil = performance.now() + 550; }
  }, true);
  document.addEventListener("click", event => {
    if (!active()) return;
    if (performance.now() < suppressClickUntil && panel.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener("keydown", event => {
    if (!active() || event.key !== "Escape") return;
    hideTip();
    resetSelection(); renderTable(); renderActions();
  }, true);

  function clear() {
    view = null; signature = null; pending = false;
    clearTimeout(pendingTimer);
    resetSelection(); hideTip(); pokemonAdventureExplainWidget?.exit();
    document.body.classList.remove("pa-your-turn");
    render();
    feedback();
  }
  window.renderPokemonAdventureGameState = data => {
    if (!active() || data?.game_type && data.game_type !== "pokemon_adventure") return;
    if (data?.room_id && typeof currentRoomState !== "undefined" && data.room_id !== currentRoomState?.room_id) return;
    const next = data?.view || data;
    if (!next || next.game_id && next.game_id !== "pokemon_adventure") return;
    const nextSignature = JSON.stringify([data.room_id, next.you, next.round, next.turn, next.phase, next.current_turn, next.drawn?.card?.id, next.pending_ability, next.ditto_choices]);
    if (signature !== nextSignature) resetSelection();
    if (view && view.you !== next.you) { hideTip(); pokemonAdventureExplainWidget?.exit(); }
    signature = nextSignature; view = next;
    pending = false; clearTimeout(pendingTimer); feedback();
    render();
  };
  window.clearPokemonAdventureState = clear;
  window.showPokemonAdventureHeaderActions = visible => {
    byId("HeaderActions").style.display = visible ? "flex" : "none";
    if (!visible) clear();
  };
  window.getPokemonAdventureConfig = () => ({target_tokens: 3});

  function syncRoom(state) {
    if (state?.game_type !== "pokemon_adventure" || state.status === "lobby") clear();
    if (state?.game_type === "pokemon_adventure") byId("HeaderActions").style.display = "flex";
  }
  function initialize() {
    if (typeof socket !== "undefined") {
      socket.on("room:state", syncRoom);
      socket.on("system:error", error => { if (!active() || !pending) return; pending = false; clearTimeout(pendingTimer); feedback(typeof error === "string" ? error : error?.message || "Action failed. Please try again."); render(); });
      socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); hideTip(); if (active()) render(); });
      socket.on("connect", () => { if (active()) render(); });
    }
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "pokemon_adventure") window.renderPokemonAdventureGameState(lastGameStatePayload);
    else render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, {once: true});
  else initialize();
})();
