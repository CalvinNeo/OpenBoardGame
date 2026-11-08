// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const SKULL_KING_HELP_CONFIG = {
  gameId: "skull_king",
  title: { zh: "骷髅王 · Skull King", en: "Skull King" },
  basic: {
    win: {
      zh: "全部轮次结束后累计分最高的玩家获胜，出现并列时这些人共同获胜。",
      en: "Once every round is scored the player with the highest running total wins, and several players share the victory when they tie."
    },
    turn: {
      zh: "每轮先秘密叫墩(🎯)报出你预计能赢的墩数，之后每墩轮到你时打出一张牌，最强的那张赢下这一墩。",
      en: "Each round opens with a secret bid (🎯) for how many tricks you expect, and then on every trick you play one card when it is your turn, with the strongest card taking the trick."
    },
    key: {
      zh: "只有叫墩数与实际赢墩数完全一致才能拿到分数，所以这个游戏的重点是准确预测自己，而不是尽量多赢。",
      en: "You only score when your bid matches your tricks exactly, so the whole game is about predicting yourself accurately rather than winning as much as possible."
    }
  },
  sections: [
    {
      id: "deck",
      label: { zh: "牌组与轮次", en: "Deck and rounds" },
      html: {
        zh: "<p>牌组共 70 张：绿鹦鹉 Parrot(🦜)、黄宝箱 Treasure(💰)、紫地图 Map(🗺️) 和黑海盗旗 Trump(🏴‍☠️) 各有 1 到 14，再加逃跑 Escape(🏳️) 五张、海盗 Pirate(⚔️) 五张、美人鱼 Mermaid(🧜) 两张、虎女 Tigress(🐯) 一张和骷髅王 Skull King(💀) 一张。</p>"
          + "<p>Standard 一共 10 轮，第几轮就发几张牌。8 人局因为牌不够，第 9 轮和第 10 轮仍然各发 8 张。</p>"
          + "<p>Quick 是官方短局变体，固定 5 轮，每轮发 5 张。每轮都会重新洗全部 70 张牌，没发出去的牌保持隐藏。</p>"
          + "<p>第一轮的首家随机决定，之后每一轮的首家按座位顺延。</p>",
        en: "<p>The deck holds seventy cards. Parrot (🦜), Treasure (💰), Map (🗺️) and Trump (🏴‍☠️) each run from one to fourteen, joined by five Escapes (🏳️), five Pirates (⚔️), two Mermaids (🧜), one Tigress (🐯) and one Skull King (💀).</p>"
          + "<p>Standard lasts ten rounds and deals as many cards as the round number. With eight players the deck runs short, so rounds nine and ten still deal eight cards each.</p>"
          + "<p>Quick is the official short variant with five rounds of five cards. Every round reshuffles all seventy cards and the undealt cards stay hidden.</p>"
          + "<p>The first leader of the opening round is chosen at random, and the lead then moves one seat along each round.</p>"
      }
    },
    {
      id: "bidding",
      label: { zh: "叫墩与出牌", en: "Bidding and play" },
      html: {
        zh: "<p>叫墩(🎯)从 0 到本轮发牌数，锁定之后不能修改。所有人锁定后同时公开，锁定(🔒)表示已经提交但还没公开，省略号表示还没提交。叫墩总和不要求等于本轮墩数。</p>"
          + "<p>每一墩由每人各出一张牌组成，最强牌的玩家赢下这墩并领下一墩。每墩结束后所有人点 Next Trick 才继续。</p>"
          + "<p>首引花色决定跟色要求。数字牌必须跟首引花色，手里没有这一色才可以出别的数字牌。特殊牌随时都可以打出。</p>"
          + "<p>逃跑(🏳️)首引时定色权顺延给后面的第一张非逃跑牌。角色牌首引时这一墩完全不限制花色。角色牌在中途出现也不会解除已经建立的跟色要求。</p>",
        en: "<p>A bid (🎯) runs from zero up to the number of cards dealt and cannot be changed once locked. Every bid is revealed at the same time after all players lock in, where the lock (🔒) means submitted but still hidden and the ellipsis means not submitted yet. The bids never have to add up to the number of tricks.</p>"
          + "<p>A trick is one card from each player, and the strongest card takes it and leads the next one. After every trick everyone presses Next Trick before play continues.</p>"
          + "<p>The lead card sets the suit to follow. Numbered cards must follow that suit, and only a hand without it may play a numbered card of another suit. Special cards can be played at any time.</p>"
          + "<p>An Escape (🏳️) in the lead passes the suit decision to the first non-escape card behind it. A character card in the lead removes the suit restriction for that trick. A character card played later never cancels a restriction that is already in force.</p>"
      }
    },
    {
      id: "specials",
      label: { zh: "特殊牌", en: "Special cards" },
      html: {
        zh: "<ul>"
          + "<li>逃跑 Escape(🏳️)：通常输给所有其他牌。如果整墩全是逃跑，第一张逃跑赢下这一墩。</li>"
          + "<li>海盗 Pirate(⚔️)：胜过所有数字牌和美人鱼(🧜)，输给骷髅王(💀)。同墩出现多张海盗时先出者胜。</li>"
          + "<li>美人鱼 Mermaid(🧜)：胜过所有数字牌，通常输给海盗(⚔️)。只要同墩出现骷髅王(💀)，美人鱼就赢，哪怕场上还有海盗。多张美人鱼时先出者胜。</li>"
          + "<li>骷髅王 Skull King(💀)：胜过所有数字牌和海盗(⚔️)，但同墩有美人鱼(🧜)时由美人鱼获胜。</li>"
          + "<li>虎女 Tigress(🐯)：出牌时必须明确选择海盗(⚔️)或逃跑(🏳️)，本墩按所选身份处理。</li>"
          + "</ul>"
          + "<p>黑海盗旗(🏴‍☠️)是数字王牌花色，任意黑牌都胜过普通数字花色，黑牌之间仍然比较数字。手上有首引花色时依然不能改出黑牌。</p>",
        en: "<ul>"
          + "<li>Escape (🏳️) normally loses to every other card. When the whole trick is escapes, the first escape played takes it.</li>"
          + "<li>Pirate (⚔️) beats every numbered card and the Mermaid (🧜) but loses to the Skull King (💀). With several pirates in a trick the earliest one wins.</li>"
          + "<li>Mermaid (🧜) beats every numbered card and normally loses to a Pirate (⚔️). As soon as a Skull King (💀) appears in the trick the Mermaid wins, even alongside pirates. With several mermaids the earliest one wins.</li>"
          + "<li>Skull King (💀) beats every numbered card and every Pirate (⚔️), but a Mermaid (🧜) in the same trick takes the trick instead.</li>"
          + "<li>Tigress (🐯) must be declared as either a Pirate (⚔️) or an Escape (🏳️) when played and behaves as that card for the rest of the trick.</li>"
          + "</ul>"
          + "<p>Trump (🏴‍☠️) is the numbered trump suit. Any black card beats the ordinary suits, and black cards still compare by rank against each other. Holding the led suit still forbids switching to a black card.</p>"
      }
    },
    {
      id: "scoring",
      label: { zh: "计分与奖励", en: "Scoring and bonus" },
      html: {
        zh: "<p>正数叫墩并且完全准确时，每叫一墩得 20 分。不准确时每差一墩扣 10 分。</p>"
          + "<p>叫 0 成功时得到本轮发牌数乘以 10 分，失败时扣掉同样的分数。叫 3 赢 3 得 60 分，叫 2 赢 4 扣 20 分，发 8 张时叫 0 没赢墩得 80 分，赢了任何一墩则扣 80 分。</p>"
          + "<p>奖励(✨)只有在叫墩准确时才兑现。赢家收走普通花色的 14 每张加 10 分，黑海盗旗(🏴‍☠️)的 14 加 20 分。海盗(⚔️)吃掉的每张美人鱼(🧜)加 20 分，骷髅王(💀)吃掉的每张海盗(⚔️)加 30 分，其中包含海盗模式的虎女(🐯)，美人鱼(🧜)吃掉骷髅王(💀)加 40 分。</p>"
          + "<p>奖励只算实际赢家的捕获，数字 14 的奖励可以叠加。界面把叫墩分、兑现奖励和累计分分开显示。</p>",
        en: "<p>A positive bid that lands exactly pays twenty points for every trick bid. Missing the bid costs ten points for each trick of difference.</p>"
          + "<p>A successful zero bid pays the number of cards dealt times ten, and a failed zero bid loses the same amount. Bidding three and winning three pays sixty, bidding two and winning four loses twenty, and with eight cards a zero bid pays eighty when you win nothing and loses eighty the moment you take a trick.</p>"
          + "<p>Bonus (✨) is only paid out when the bid was exact. Each ordinary fourteen the winner collects is worth ten points and the black fourteen (🏴‍☠️) is worth twenty. Every Mermaid (🧜) captured by a Pirate (⚔️) is worth twenty, every Pirate (⚔️) captured by the Skull King (💀) is worth thirty including a Tigress (🐯) played as a pirate, and a Skull King (💀) captured by a Mermaid (🧜) is worth forty.</p>"
          + "<p>Only the actual winner of the trick collects these captures, and the fourteen bonuses stack. The interface shows the bid score, the earned bonus and the running total separately.</p>"
      }
    },
    {
      id: "graybeard",
      label: { zh: "双人与灰胡子", en: "Two players and Graybeard" },
      html: {
        zh: "<p>双人局会额外发一手暗牌给灰胡子 Graybeard(👻)，补足第三个出牌位置。</p>"
          + "<p>灰胡子(👻)自动翻开自己牌堆的顶牌，不需要跟色，他的虎女(🐯)固定当作逃跑(🏳️)。他不叫墩也不计总分。</p>"
          + "<p>真人领墩时灰胡子第二个出牌。灰胡子赢墩时下一墩由他先出，其余两人按上一墩的顺序轮转。每一轮的第一墩在两位真人之间交替领牌。</p>"
          + "<p>灰胡子是规则里的幽灵席位，和房间里的练习机器人是两回事。</p>",
        en: "<p>A two player game deals an extra face-down hand to Graybeard (👻) so that a third seat always exists.</p>"
          + "<p>Graybeard (👻) flips the top card of his pile automatically, never has to follow suit, and always treats his Tigress (🐯) as an Escape (🏳️). He never bids and never scores.</p>"
          + "<p>When a human leads, Graybeard plays second. When Graybeard wins a trick he leads the next one, and the other two seats keep the order from the previous trick. The first trick of each round alternates between the two humans.</p>"
          + "<p>Graybeard is a ghost seat from the rules and has nothing to do with the practice bots in the room.</p>"
      }
    },
    {
      id: "controls",
      label: { zh: "线上操作", en: "Playing online" },
      html: {
        zh: "<p>点选手牌再按 Play Card 出牌，打出虎女(🐯)时要另外选择海盗(⚔️)或逃跑(🏳️)。点击面板空白处或按 Esc 可以取消选牌。</p>"
          + "<p>灰色的牌当前不能打出，通常是因为还没轮到你，或者你必须跟首引花色。</p>"
          + "<p>每墩结束后桌面会保留下来，全员点 Next Trick 才继续。最后一墩结束直接展示本轮计分，全员点 Next Round 才发下一轮的牌。</p>"
          + "<p>断线的真人不会被自动确认，重连之后可以继续。游戏结束后结果会一直保留在界面上。</p>",
        en: "<p>Select a card in your hand and press Play Card. Playing the Tigress (🐯) also asks you to choose Pirate (⚔️) or Escape (🏳️). Clicking empty space on the panel or pressing Esc clears the selection.</p>"
          + "<p>A greyed out card cannot be played right now, usually because it is not your turn or because you must follow the led suit.</p>"
          + "<p>The table stays visible after each trick and play resumes only once everyone presses Next Trick. The last trick leads straight into the round scores, and the next round is dealt only after everyone presses Next Round.</p>"
          + "<p>Disconnected humans are never confirmed automatically and simply continue after reconnecting. The final result stays on screen once the game ends.</p>"
      }
    }
  ]
};

const SKULL_KING_EXPLAIN = {
  round: {
    zh: "当前是第几轮。每轮重新洗全部 70 张牌，Standard 共 10 轮，每轮发 1 到 10 张，Quick 是 5 轮每轮 5 张。",
    en: "Which round is being played. All seventy cards are reshuffled every round. Standard runs ten rounds dealing one to ten cards, and Quick runs five rounds of five cards."
  },
  trick: {
    zh: "当前是本轮的第几墩。每位玩家依次出一张牌组成一墩，最强牌的玩家赢下这墩并领下一墩。",
    en: "Which trick of the round is being played. Every player contributes one card and the strongest card takes the trick and leads the next one."
  },
  lead: {
    zh: "首引花色。数字牌必须跟这一色，手里没有才能出别的数字牌，特殊牌则随时可以出。",
    en: "The led suit. Numbered cards must follow it and only a hand without it may play another suit, while special cards can be played at any time."
  },
  bid: {
    zh: "叫墩(🎯)。选择你预计本轮能赢的墩数再按 Confirm Bid 锁定，所有人锁定后同时公开，锁定后不能修改。",
    en: "Your bid (🎯). Choose how many tricks you expect to win and press Confirm Bid to lock it. Every bid is revealed together once all are locked and cannot be changed afterwards."
  },
  target: {
    zh: "Won 与 Bid 是已赢墩数和叫墩目标，尽量刚好完成，多赢或少赢都算失败。手牌(🂠)是剩余的牌数。",
    en: "Won and Bid show tricks taken against the bid target. Aim to hit it exactly, since overshooting and undershooting both fail. The hand icon (🂠) counts your remaining cards."
  },
  score: {
    zh: "总分(🏆)。总分只包含已经结算的轮次，正叫准确每墩 20 分，叫 0 成功则得本轮发牌数乘以 10 分。",
    en: "Total score (🏆). Only finished rounds count. An exact positive bid pays twenty per trick and a successful zero bid pays the number of cards dealt times ten."
  },
  bonus: {
    zh: "奖励(✨)。本轮捕获到的待兑现奖励，只有叫墩准确时才真正计入分数。",
    en: "Bonus (✨). The captures waiting to be paid out this round. They only reach your score when your bid turns out exact."
  },
  play: {
    zh: "打出选中的手牌。灰色的牌当前不能出，通常因为还没轮到你，或者你必须跟首引花色。",
    en: "Play the selected card. A greyed out card cannot be played right now, usually because it is not your turn or because you must follow the led suit."
  },
  cancel: {
    zh: "取消当前选牌。也可以点击周围空白或按 Esc，都不会消耗卡牌。",
    en: "Clear the selected card. Clicking empty space or pressing Esc does the same, and no card is spent."
  },
  tigress: {
    zh: "虎女(🐯)。出牌时必须选择海盗(⚔️)或逃跑(🏳️)，本墩按所选身份处理，被骷髅王(💀)吃掉的海盗模式虎女贡献 30 奖励分。",
    en: "Tigress (🐯). Declare her as a Pirate (⚔️) or an Escape (🏳️) when playing, and she behaves as that card for the trick. A pirate mode Tigress captured by the Skull King (💀) is worth thirty bonus points."
  },
  next: {
    zh: "确认已经看完本墩或本轮的结果。所有玩家都确认后才继续，不会再问一次。",
    en: "Confirm that you have read the trick or round result. Play continues once every player confirms and you are never asked twice."
  },
  ghost: {
    zh: "灰胡子(👻)。双人局的幽灵第三手，自动翻暗牌顶牌且无需跟色，不叫墩也不计总分。",
    en: "Graybeard (👻), the ghost third hand in a two player game. He flips his top card automatically, never follows suit, never bids and never scores."
  },
  green: {
    zh: "绿鹦鹉 Parrot(🦜)。绿色数字花色，从 1 到 14，同色数字大者胜。14 被赢家收走时提供 10 奖励分。",
    en: "Parrot (🦜), the green numbered suit running from one to fourteen where the higher rank wins. A fourteen collected by the winner is worth ten bonus points."
  },
  yellow: {
    zh: "黄宝箱 Treasure(💰)。黄色数字花色，从 1 到 14，它是花色而不是货币。14 提供 10 奖励分。",
    en: "Treasure (💰), the yellow numbered suit running from one to fourteen. It is a suit and not a currency. A fourteen is worth ten bonus points."
  },
  purple: {
    zh: "紫地图 Map(🗺️)。紫色数字花色，从 1 到 14，同色数字大者胜。14 提供 10 奖励分。",
    en: "Map (🗺️), the purple numbered suit running from one to fourteen where the higher rank wins. A fourteen is worth ten bonus points."
  },
  black: {
    zh: "黑海盗旗 Trump(🏴‍☠️)。黑色是数字王牌花色，任意黑牌胜过普通花色，黑牌之间比较数字。14 提供 20 奖励分。",
    en: "Trump (🏴‍☠️), the black numbered suit. Any black card beats the ordinary suits and black cards compare by rank among themselves. A fourteen is worth twenty bonus points."
  },
  escape: {
    zh: "逃跑 Escape(🏳️)。可以随时打出，通常输给所有其他牌。全员都出逃跑时第一张逃跑赢墩，首引时定色权顺延。",
    en: "Escape (🏳️) can be played at any time and normally loses to everything. When every card in the trick is an escape the first one wins, and an escape in the lead passes the suit decision along."
  },
  pirate: {
    zh: "海盗 Pirate(⚔️)。胜过数字牌和美人鱼(🧜)，输给骷髅王(💀)，多张海盗时先出者胜。吃到的每张美人鱼(🧜)有 20 奖励分。",
    en: "Pirate (⚔️) beats numbered cards and the Mermaid (🧜) but loses to the Skull King (💀), and the earliest of several pirates wins. Each captured Mermaid (🧜) is worth twenty bonus points."
  },
  mermaid: {
    zh: "美人鱼 Mermaid(🧜)。胜过所有数字牌，通常输给海盗(⚔️)，但同墩出现骷髅王(💀)时一定由美人鱼获胜。吃掉骷髅王(💀)有 40 奖励分。",
    en: "Mermaid (🧜) beats every numbered card and normally loses to a Pirate (⚔️), yet she always wins a trick that contains the Skull King (💀). Capturing him is worth forty bonus points."
  },
  skull_king: {
    zh: "骷髅王 Skull King(💀)。胜过所有数字牌和海盗(⚔️)，但同墩有美人鱼(🧜)时由美人鱼获胜。吃到的每张海盗(⚔️)有 30 奖励分。",
    en: "Skull King (💀) beats every numbered card and every Pirate (⚔️), but a Mermaid (🧜) in the same trick takes it instead. Each captured Pirate (⚔️) is worth thirty bonus points."
  }
};

let skullKingHelpWidget = null;
let skullKingExplainWidget = null;

function initSkullKingHelpExplain() {
  if (skullKingHelpWidget || typeof window.obgCreateHelp !== "function") return;
  skullKingHelpWidget = window.obgCreateHelp(SKULL_KING_HELP_CONFIG);
  skullKingExplainWidget = window.obgCreateExplain({
    gameId: "skull_king",
    attribute: "data-sk-explain",
    explanations: SKULL_KING_EXPLAIN,
    button: document.getElementById("skullKingExplainBtn"),
    root: () => document.getElementById("skullKingPanel"),
    bypass: ["#skullKingHelpBtn", "#skullKingExplainBtn"]
  });
  document.getElementById("skullKingHelpBtn")?.addEventListener("click", () => {
    skullKingExplainWidget?.exit();
    skullKingHelpWidget.open();
  });
  document.getElementById("skullKingExplainBtn")?.addEventListener("click", () => skullKingExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSkullKingHelpExplain);
} else {
  initSkullKingHelpExplain();
}

(() => {
    "use strict";
    const byId = suffix => document.getElementById(`skullKing${suffix}`);
    const panel = byId("Panel"), header = byId("HeaderActions"), configBox = byId("ConfigBox");
    const tooltip = byId("Tooltip");
    const suits = {
        green: ["🦜", "鹦鹉", "Parrot"], yellow: ["💰", "宝箱", "Treasure"],
        purple: ["🗺️", "地图", "Map"], black: ["🏴‍☠️", "海盗旗", "Trump"],
    };
    const specials = {
        escape: ["🏳️", "逃跑", "Escape"], pirate: ["⚔️", "海盗", "Pirate"],
        mermaid: ["🧜", "美人鱼", "Mermaid"], tigress: ["🐯", "虎女", "Tigress"],
        skull_king: ["💀", "骷髅王", "Skull King"],
    };
    let view = null, selectedCard = null, selectedBid = null, pending = false;
    let pendingTimer = null, tipTimer = null, configSignature = null, renderSignature = null;
    // Help and Explain now live in the shared widgets above.
    function text(suffix, value) { byId(suffix).textContent = value; }
    function el(tag, className, value) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (value != null) node.textContent = value;
        return node;
    }
    function tip(node, key, custom) {
        node.dataset.skExplain = key; node.dataset.skTip = custom || SKULL_KING_EXPLAIN[key].zh; node.tabIndex = 0;
        return node;
    }
    function playerLabel(tag, className, pid) {
        const node = el(tag, className, name(pid));
        node.dataset.skTip = name(pid); node.tabIndex = 0;
        return node;
    }
    function name(pid) { return view?.ghost?.player_id === pid ? "Graybeard 👻" : view?.players.find(p => p.player_id === pid)?.name || pid || "—"; }
    function own() { return view?.players.find(p => p.player_id === view.you); }
    function can(kind) { return !!(!pending && socket.connected && view?.legal_actions.includes(kind)); }
    function cardInfo(card) { return card.kind === "number" ? suits[card.suit] : specials[card.kind]; }
    function cardLabel(card, mode) {
        const info = cardInfo(card);
        return `${info[0]} ${info[1]}${card.rank ? ` ${card.rank}` : ""}${mode ? ` · ${specials[mode][1]}` : ""}`;
    }
    function cardNode(card, interactive = false, mode = null) {
        const key = card.suit || card.kind, info = cardInfo(card);
        const node = el(interactive ? "button" : "div", `skull-king-card sk-${key}`);
        node.dataset.skExplain = key;
        if (interactive) {
            node.type = "button"; node.dataset.cardId = card.id;
            node.setAttribute("aria-label", cardLabel(card));
            node.setAttribute("aria-pressed", String(selectedCard === card.id));
            node.disabled = !can("play") || !view.legal_card_ids.includes(card.id);
            node.classList.toggle("is-selected", selectedCard === card.id);
            node.classList.toggle("is-illegal", view.phase === "playing" && view.current_turn === view.you && !view.legal_card_ids.includes(card.id));
            node.dataset.skTip = `${cardLabel(card)}：${SKULL_KING_EXPLAIN[key].zh}`;
        } else tip(node, key, `${cardLabel(card, mode)}：${SKULL_KING_EXPLAIN[key].zh}`);
        const top = el("span", "skull-king-card-top");
        top.append(el("span", "", card.rank || info[0]), el("span", "", card.rank === 14 ? "✨" : ""));
        node.append(top, el("span", "skull-king-card-icon", info[0]),
            el("strong", "skull-king-card-value", card.rank || ""), el("span", "skull-king-card-label", mode ? specials[mode][1] : info[1]));
        return node;
    }
    function renderPlayers() {
        const container = byId("Players"); container.replaceChildren();
        const rows = [...view.players, ...(view.ghost ? [{...view.ghost, ghost: true}] : [])];
        rows.forEach(player => {
            const node = el("article", "skull-king-player");
            node.classList.toggle("is-current", player.player_id === view.current_turn);
            node.classList.toggle("is-winner", view.winner_ids.includes(player.player_id));
            const heading = el("div", "skull-king-player-heading");
            heading.append(playerLabel("strong", "", player.player_id));
            const labels = [];
            if (player.player_id === view.you) labels.push("You");
            if (player.is_bot) labels.push("Bot");
            if (view.ready.includes(player.player_id)) labels.push("Ready ✓");
            if (view.winner_ids.includes(player.player_id)) labels.push("Winner");
            heading.append(el("small", "", labels.join(" · ")));
            const stats = el("div", "skull-king-player-stats");
            if (player.ghost) stats.append(tip(el("span", "", `${player.won} won`), "ghost"));
            else {
                const bid = player.bid ?? (player.bid_locked ? "🔒" : "…");
                stats.append(tip(el("span", "", `🎯 ${player.won} / ${bid}`), "target", `Won / Bid（🎯）：已赢 ${player.won} 墩，叫墩 ${bid}。`));
                stats.append(tip(el("span", "", `🏆 ${player.total_score}`), "score"));
                const bonus = view.round_summary?.players.find(p => p.player_id === player.player_id)?.bonus ?? player.bonus;
                if (bonus) stats.append(tip(el("span", "", `✨ +${bonus}`), "bonus"));
            }
            stats.append(tip(el("span", "", `🂠 ${player.hand_count}`), player.ghost ? "ghost" : "target", `Hand（🂠）：剩余 ${player.hand_count} 张暗牌。`));
            node.append(heading, stats); container.append(node);
        });
    }
    function renderTrick() {
        const container = byId("TrickCards"); container.replaceChildren();
        const order = view.trick_order.length ? view.trick_order : [...view.players.map(p => p.player_id), ...(view.ghost ? [view.ghost.player_id] : [])];
        container.style.setProperty("--sk-mobile-seats", Math.min(order.length, 4));
        order.forEach(pid => {
            const slot = el("div", "skull-king-trick-slot");
            slot.classList.toggle("is-winner", view.trick_result?.winner_id === pid);
            const play = view.trick.find(p => p.player_id === pid);
            if (play) slot.append(cardNode(play.card, false, play.mode));
            else {
                const back = el("div", "skull-king-card sk-back");
                back.append(el("span", "skull-king-card-icon", "⚓"), el("span", "skull-king-card-label", view.phase === "bidding" ? "Bid first" : pid === view.current_turn ? "Playing…" : "Waiting"));
                slot.append(tip(back, "trick"));
            }
            slot.append(playerLabel("span", "skull-king-trick-name", pid)); container.append(slot);
        });
        byId("TrickResult").classList.toggle("hidden", !view.trick_result);
        if (view.trick_result) {
            const result = view.trick_result;
            const scored = view.round_summary?.players.find(p => p.player_id === result.winner_id);
            const bonusState = scored ? (scored.exact ? "earned" : "lost") : "pending";
            const bonus = result.bonus && result.winner_id !== view.ghost?.player_id ? ` · ✨ ${result.bonus} ${bonusState}` : "";
            text("TrickResult", `${name(result.winner_id)} wins the trick${bonus}`);
            tip(byId("TrickResult"), "bonus");
        }
    }
    function renderBids() {
        const bidding = view.phase === "bidding";
        byId("BidBox").classList.toggle("hidden", !bidding);
        const container = byId("Bids"); container.replaceChildren();
        if (!bidding) return;
        const me = own();
        text("BidProgress", `${view.players.filter(p => p.bid_locked).length} / ${view.players.length} locked`);
        if (me?.bid != null) selectedBid = me.bid;
        for (let bid = 0; bid <= view.cards_dealt; bid++) {
            const button = el("button", "", bid); button.type = "button"; button.dataset.bid = bid;
            button.dataset.skExplain = "bid"; button.setAttribute("aria-label", `Bid ${bid}`);
            button.setAttribute("aria-pressed", String(selectedBid === bid)); button.disabled = !can("bid");
            container.append(button);
        }
        byId("ConfirmBid").disabled = !can("bid") || selectedBid == null;
        text("ConfirmBid", me?.bid_locked ? "Locked ✓" : "Confirm Bid");
        text("BidHint", !me ? "Waiting for the crew to bid." : me.bid_locked ? `Your bid: ${me.bid}. Waiting for the crew.` : "Choose how many tricks you will win.");
    }
    function renderHand() {
        const container = byId("Hand"); container.replaceChildren();
        view.hand.forEach(card => container.append(cardNode(card, true)));
        text("HandTitle", own() ? "Your hand" : "Spectating");
        const me = own();
        text("Target", me ? `🎯 ${me.won} / ${me.bid ?? "—"}` : "🎯 —");
        text("HandHint", !me ? "Hands stay private." : view.phase === "bidding" ? `${view.hand.length} cards · Study your hand, then bid.` :
            can("play") ? "Select a card, then confirm." : view.phase === "playing" ? `Waiting for ${name(view.current_turn)}.` : "Review the result before continuing.");
        renderSelection();
    }
    function renderSelection() {
        const card = view?.hand.find(c => c.id === selectedCard);
        byId("Selection").classList.toggle("hidden", !card);
        if (!card) return;
        text("SelectedLabel", cardLabel(card));
        const tigress = card.kind === "tigress";
        byId("Play").classList.toggle("hidden", tigress);
        byId("Pirate").classList.toggle("hidden", !tigress); byId("Escape").classList.toggle("hidden", !tigress);
        ["Play", "Pirate", "Escape"].forEach(s => { byId(s).disabled = !can("play"); });
    }
    function renderScores() {
        byId("RoundSummary").classList.toggle("hidden", !view.round_summary);
        const container = byId("ScoreRows"); container.replaceChildren();
        if (!view.round_summary) return;
        text("SummaryTitle", `Round ${view.round_number} · Scores`);
        view.round_summary.players.forEach(row => {
            const node = el("div", `skull-king-score-row ${row.exact ? "is-exact" : "is-miss"}`);
            node.append(el("strong", "", name(row.player_id)),
                tip(el("span", "", `🎯 ${row.won} / ${row.bid} · ${row.exact ? "Exact" : "Missed"}`), "target"),
                tip(el("span", "", `Base ${row.base} + Bonus ${row.bonus} = ${row.round_score}`), "score"),
                tip(el("span", "", `🏆 Total ${row.total_score}${row.bonus_available && !row.exact ? ` · ${row.bonus_available} bonus lost` : ""}`), "bonus"));
            container.append(node);
        });
    }
    function renderHistory() {
        const history = byId("History"), scroll = history.scrollTop;
        history.replaceChildren();
        [...view.trick_history].reverse().forEach(trick => {
            const node = el("li", "", `Trick ${trick.trick_number}: ${name(trick.winner_id)} won. `);
            node.append(el("span", "", trick.cards.map(p => `${name(p.player_id)}: ${cardLabel(p.card, p.mode)}`).join(" · ")));
            history.append(node);
        });
        if (!view.trick_history.length) history.append(el("li", "", "No completed tricks yet."));
        history.scrollTop = scroll;
        const scores = byId("ScoreHistory"), scoreScroll = scores.scrollTop; scores.replaceChildren();
        view.score_history.forEach(round => {
            const row = el("div", ""); row.append(el("strong", "", `Round ${round.round_number} · ${round.cards_dealt} cards`));
            round.players.forEach(p => row.append(el("div", "", `${name(p.player_id)}: ${p.round_score > 0 ? "+" : ""}${p.round_score} → ${p.total_score}`)));
            scores.append(row);
        });
        if (!view.score_history.length) scores.append(el("div", "", "No scored rounds yet."));
        scores.scrollTop = scoreScroll;
    }
    function render() {
        if (!view) return;
        text("Round", `Round ${view.round_number} / ${view.total_rounds}`);
        text("Trick", `Trick ${view.trick_number} / ${view.cards_dealt}`);
        text("Lead", view.led_suit ? `Lead ${suits[view.led_suit][0]} ${suits[view.led_suit][1]}` : "Lead · Open");
        let status = "Lock in your bid";
        if (view.phase === "playing") status = view.current_turn === view.you ? "Your turn · Choose a card" : `${name(view.current_turn)} is playing`;
        if (view.phase === "trick_review") status = "Trick complete · Review the table";
        if (view.phase === "round_review") status = "Round complete · Scores are in";
        if (view.game_over) status = `Winner${view.winner_ids.length > 1 ? "s" : ""}: ${view.winner_ids.map(name).join(" · ")}`;
        if (!socket.connected) status = "Disconnected · Reconnecting…";
        text("Status", status);
        const review = ["trick_review", "round_review", "game_over"].includes(view.phase);
        byId("Review").classList.toggle("hidden", !review);
        text("ReviewTitle", view.game_over ? "Voyage complete" : view.phase === "trick_review" ? "Trick complete" : "Round complete");
        text("Ready", view.game_over ? "Final scores are below." : `${view.ready.length} / ${view.players.length} ready`);
        byId("Next").classList.toggle("hidden", view.game_over);
        text("Next", view.ready.includes(view.you) ? "Ready ✓" : view.phase === "trick_review" ? "Next Trick" : "Next Round");
        byId("Next").disabled = !can(view.phase === "trick_review" ? "next_trick" : "next_round");
        renderPlayers(); renderTrick(); renderBids(); renderHand(); renderScores(); renderHistory();
    }
    function dispatch(kind, fields = {}) {
        if (!can(kind)) return;
        pending = true; clearTimeout(pendingTimer);
        const context = Object.fromEntries(["game_token", "round_number", "trick_number"].map(key => [key, view[key]]));
        pendingTimer = setTimeout(() => { pending = false; render(); }, 3000);
        render(); sendAction({type: kind, ...context, ...fields});
    }
    function deselect() {
        selectedCard = null;
        panel.querySelectorAll("[data-card-id]").forEach(node => { node.classList.remove("is-selected"); node.setAttribute("aria-pressed", "false"); });
        renderSelection();
    }
    byId("Bids").addEventListener("click", event => {
        const button = event.target.closest("[data-bid]");
        if (!button || !can("bid")) return;
        selectedBid = Number(button.dataset.bid); renderBids();
    });
    byId("ConfirmBid").addEventListener("click", () => { if (selectedBid != null) dispatch("bid", {bid: selectedBid}); });
    byId("Hand").addEventListener("click", event => {
        const button = event.target.closest("[data-card-id]");
        if (!button || !can("play") || !view.legal_card_ids.includes(button.dataset.cardId)) return;
        selectedCard = selectedCard === button.dataset.cardId ? null : button.dataset.cardId;
        renderHand();
    });
    function play(mode) { if (selectedCard) dispatch("play", {card_id: selectedCard, ...(mode ? {mode} : {})}); }
    byId("Play").addEventListener("click", () => play());
    byId("Pirate").addEventListener("click", () => play("pirate"));
    byId("Escape").addEventListener("click", () => play("escape"));
    byId("Cancel").addEventListener("click", deselect);
    byId("Next").addEventListener("click", () => dispatch(view?.phase === "trick_review" ? "next_trick" : "next_round"));

    function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
    function showTip(target, autoHide = false) {
        if (!target) return;
        clearTimeout(tipTimer); tooltip.textContent = target.dataset.skTip; tooltip.classList.remove("hidden");
        const rect = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
        tooltip.style.top = `${rect.bottom + box.height + 18 < innerHeight ? rect.bottom + 7 : Math.max(12, rect.top - box.height - 7)}px`;
        if (autoHide) tipTimer = setTimeout(hideTip, 3000);
    }
    document.addEventListener("keydown", event => {
        if (panel.classList.contains("hidden") || event.key !== "Escape") return;
        hideTip(); deselect();
    }, true);
    document.addEventListener("click", event => {
        if (!panel.classList.contains("hidden") && !event.target.closest("button, input, select, dialog, summary, a")) deselect();
    });
    panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-sk-tip]")); });
    panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
    panel.addEventListener("focusin", event => showTip(event.target.closest("[data-sk-tip]")));
    panel.addEventListener("focusout", hideTip);
    panel.addEventListener("pointerdown", event => {
        const target = event.target.closest("button:disabled[data-sk-tip]");
        if (target && event.pointerType !== "mouse") showTip(target, true);
    });
    panel.addEventListener("click", event => {
        const target = event.target.closest("[data-sk-tip]");
        if (target) showTip(target, true); else hideTip();
    });
    document.addEventListener("scroll", hideTip, true); window.addEventListener("resize", hideTip); window.addEventListener("blur", hideTip);

    function clearState() {
        view = null; selectedCard = null; selectedBid = null; pending = false; renderSignature = null;
        clearTimeout(pendingTimer); hideTip();
        ["Hand", "Players", "TrickCards", "Bids", "ScoreRows", "History", "ScoreHistory"].forEach(s => byId(s).replaceChildren());
        ["BidBox", "Review", "RoundSummary", "TrickResult", "Selection"].forEach(s => byId(s).classList.add("hidden"));
        ["ConfirmBid", "Next", "Play", "Pirate", "Escape"].forEach(s => { byId(s).disabled = true; });
        text("Status", "Waiting to start"); text("Round", "Round —"); text("Trick", "Trick —");
        text("Lead", "Lead —"); text("Target", "🎯 —"); text("HandHint", "Your cards will appear here.");
    }
    function syncConfig(state) {
        const visible = state?.game_type === "skull_king" && state.status === "lobby";
        configBox.classList.toggle("hidden", !visible); configBox.setAttribute("aria-hidden", String(!visible));
        if (state?.game_type !== "skull_king") return;
        const signature = JSON.stringify([state.room_id, state.game_config]);
        if (signature !== configSignature) { byId("Schedule").value = state.game_config?.schedule || "standard"; configSignature = signature; }
        if (visible && view) clearState();
    }
    window.getSkullKingConfig = () => view && currentRoomState?.status !== "lobby" ? {...view.config} : {schedule: byId("Schedule").value};
    window.renderSkullKingGameState = data => {
        if (data?.view?.game_id !== "skull_king" || currentGameType !== "skull_king") return;
        if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
        const incoming = data.view;
        const signature = JSON.stringify([data.room_id, incoming.game_token, incoming.revision, incoming.you]);
        if (signature === renderSignature) return;
        if (!view || view.game_token !== incoming.game_token || view.round_number !== incoming.round_number) selectedBid = null;
        if (!view || view.game_token !== incoming.game_token || view.trick_number !== incoming.trick_number || view.round_number !== incoming.round_number || !incoming.legal_card_ids.includes(selectedCard)) selectedCard = null;
        pending = false; clearTimeout(pendingTimer); hideTip(); renderSignature = signature; view = incoming; render();
    };
    window.clearSkullKingState = clearState;
    window.showSkullKingHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) { clearState(); configBox.classList.add("hidden"); configBox.setAttribute("aria-hidden", "true"); }
        else if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
    };
    function sync() {
        socket.on("room:state", syncConfig);
        socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); render(); });
        socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); hideTip(); render(); });
        socket.on("connect", render);
        if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
        if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "skull_king") window.renderSkullKingGameState(lastGameStatePayload);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
    else sync();
})();
