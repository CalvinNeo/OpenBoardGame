// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const MOSHIMO_YUSHA_HELP_CONFIG = {
  gameId: "moshimo_yusha",
  title: { zh: "如果勇者在的话就好了 · If You Have a Brave", en: "If You Have a Brave" },
  basic: {
    win: {
      zh: "有人先攒到 2 点胜利点(🏆)时本局结束，此时累计胜利点最高的玩家获胜，并列者共同获胜。",
      en: "The game ends as soon as somebody reaches two victory points (🏆), and the highest total at that moment wins, with tied players sharing the victory."
    },
    turn: {
      zh: "准备阶段先秘密弃掉两张牌，之后每轮所有人同时选一张牌打出并一起揭示，第四轮结束后留下的最后一张就是你的最终目标。",
      en: "During setup you secretly discard two cards, then every round everyone plays one card at the same time and reveals them together, and the single card left after the fourth round becomes your final objective."
    },
    key: {
      zh: "前四轮打的牌只影响筹码多少，真正决定得分的是最后一张牌的目标，所以你必须一边赚筹码一边把能达成的角色留到最后。",
      en: "The four played rounds only move chips around, while the card you keep to the end decides your score, so you must earn chips and still save a role whose objective you can actually meet."
    }
  },
  sections: [
    {
      id: "roles",
      label: { zh: "七张角色牌", en: "The seven roles" },
      html: {
        zh: "<p>每人拿到相同的七种角色。角色牌上的数字是结算顺序，从 1 到 7 依次生效。某一号牌只有一个人打出时用单独效果(👤)，两人或更多人打出时用多人效果(👥)。</p>"
          + "<ul>"
          + "<li>异世界勇者 Otherworldly Hero(🗡️)：本回合所有王族(👑)行动无效。单独效果(👤)是在场上有王族(👑)时获得 2 枚攻击(⚔️)，多人效果(👥)是在场上有王族(👑)时每位勇者获得 1 枚攻击(⚔️)。它没有最终目标，所以务必在最后一张之前用掉或传出去。</li>"
          + "<li>哀怜的奴隶 Miserable Slave(⛓️)：单独效果(👤)获得 2 枚信仰(✝️)，多人效果(👥)每人获得 1 枚攻击(⚔️)。最终目标是全场攻击(⚔️)总数不少于总席位数，元老院(🏛️)也算席位。</li>"
          + "<li>和平的市民 Peaceful Citizen(🏡)：单独效果(👤)获得 2 枚金币(🪙)，多人效果(👥)每人获得 1 枚信仰(✝️)。最终目标是金币(🪙)严格多于每一位其他玩家，并列不算达成。</li>"
          + "<li>强欲的商人 Greedy Merchant(💰)：单独效果(👤)获得 3 枚金币(🪙)，多人效果(👥)每人获得 1 枚金币(🪙)。最终目标是三类筹码总数严格多于每一位其他玩家。</li>"
          + "<li>温厚的大司教 Gentle Archbishop(⛪)：单独效果(👤)获得 1 枚信仰(✝️)，多人效果(👥)每人获得 2 枚信仰(✝️)。他只保护自己，免受本回合王族(👑)的掠夺与清空。最终目标是信仰(✝️)严格多于每一位其他玩家。</li>"
          + "<li>傲慢的王族 Arrogant Royal(👑)：单独效果(👤)夺走其他未受保护玩家的全部三类筹码，多人效果(👥)让除王族(👑)与大司教(⛪)之外的所有人清空三类筹码。最终目标是全场攻击(⚔️)总数为 0。有勇者(🗡️)在场时本回合王族行动无效，胜利点(🏆)永远不受影响。</li>"
          + "<li>愉快的道化师 Cheerful Jester(🎭)：单独效果(👤)让所有普通席位同时秘密选一张手牌传给左邻并跳过元老院(🏛️)，多人效果(👥)让每位道化师获得 1 枚金币(🪙)且不传牌。最终目标是没有其他角色达成目标时所有道化师获胜。第四轮也会传牌，所以最终目标可能因此改变，同号牌可以同时留在手里。</li>"
          + "</ul>",
        en: "<p>Everyone receives the same seven roles. The number on a role is its resolution order, running from one to seven. A role played by exactly one person uses its single effect (👤), while a role played by two or more people uses its multiple effect (👥).</p>"
          + "<ul>"
          + "<li>Otherworldly Hero (🗡️) nullifies every Royal (👑) action this round. Its single effect (👤) gains two Attack (⚔️) when a Royal (👑) is present, and its multiple effect (👥) gives each Hero one Attack (⚔️) when a Royal (👑) is present. It has no final objective, so make sure you use it or pass it away before the last card.</li>"
          + "<li>Miserable Slave (⛓️) gains two Faith (✝️) as a single effect (👤) and one Attack (⚔️) each as a multiple effect (👥). Its final objective is a table total of Attack (⚔️) at least equal to the number of seats, and the Senate (🏛️) counts as a seat.</li>"
          + "<li>Peaceful Citizen (🏡) gains two Gold (🪙) as a single effect (👤) and one Faith (✝️) each as a multiple effect (👥). Its final objective is strictly more Gold (🪙) than every other player, and a tie does not count.</li>"
          + "<li>Greedy Merchant (💰) gains three Gold (🪙) as a single effect (👤) and one Gold (🪙) each as a multiple effect (👥). Its final objective is strictly more chips in total than every other player.</li>"
          + "<li>Gentle Archbishop (⛪) gains one Faith (✝️) as a single effect (👤) and two Faith (✝️) each as a multiple effect (👥). He protects only himself from the plundering and clearing of a Royal (👑). His final objective is strictly more Faith (✝️) than every other player.</li>"
          + "<li>Arrogant Royal (👑) takes every chip from all unprotected players as a single effect (👤), and makes everyone except Royals (👑) and the Archbishop (⛪) discard all chips as a multiple effect (👥). Its final objective is a table total of zero Attack (⚔️). A Hero (🗡️) cancels the Royal action for that round, and victory points (🏆) are never affected.</li>"
          + "<li>Cheerful Jester (🎭) makes every ordinary seat secretly pass one hand card to the left, skipping the Senate (🏛️), as a single effect (👤), while its multiple effect (👥) gives each Jester one Gold (🪙) and passes nothing. Its final objective is that every Jester wins when no other role meets its objective. The fourth round still passes cards, so your final objective can change, and two copies of the same role may sit in one hand.</li>"
          + "</ul>"
      }
    },
    {
      id: "chips",
      label: { zh: "筹码与胜利点", en: "Chips and victory points" },
      html: {
        zh: "<p>金币 Gold(🪙)、攻击 Attack(⚔️) 和信仰 Faith(✝️) 三类筹码全部公开，任何人都能看到别人有多少。</p>"
          + "<p>胜利点 Victory points(🏆) 单独累计，王族(👑)既不会夺取也不会清空它。每局结束时筹码会清零，胜利点(🏆)则会保留到下一局。</p>"
          + "<p>角色牌旁边的数字是行动顺序，手牌(🂠)和已提交的选择(🔒)在揭示之前对其他人保密。</p>",
        en: "<p>Gold (🪙), Attack (⚔️) and Faith (✝️) are all public, so everyone can see how many chips each player holds.</p>"
          + "<p>Victory points (🏆) are tracked separately and a Royal (👑) can never take or clear them. Chips reset at the end of a match while victory points (🏆) carry over to the next one.</p>"
          + "<p>The number beside a role is its action order, and your hand (🂠) and locked choice (🔒) stay hidden from everyone else until the reveal.</p>"
      }
    },
    {
      id: "final",
      label: { zh: "最后一张与计分", en: "The final card" },
      html: {
        zh: "<p>四轮出牌之后先看第四轮回顾，全员点 Next Round 之后才揭示最后一张。</p>"
          + "<p>按所有席位（包含元老院(🏛️)）的筹码判断每个人最后一张牌的目标是否达成，最后一张本身不执行任何出牌效果。</p>"
          + "<p>唯一达成目标的人得 2 点胜利点(🏆)，多人同时达成各得 1 点，没有人达成就都不得分。没有任何角色达成时，所有道化师(🎭)获胜。</p>"
          + "<p>有人达到 2 点胜利点(🏆)时本局结束，累计最高的玩家共同获胜。否则所有人确认计分回顾后开始下一局。</p>",
        en: "<p>After the fourth round everyone reviews that round first, and the final cards are revealed only once all players press Next Round.</p>"
          + "<p>Objectives are checked against the chips of every seat including the Senate (🏛️), and the final card itself never triggers a play effect.</p>"
          + "<p>The only player to meet an objective gains two victory points (🏆), several players meeting one gain a point each, and nobody gains anything when no objective is met. When no role succeeds at all, every Jester (🎭) wins instead.</p>"
          + "<p>As soon as somebody reaches two victory points (🏆) the game ends and the highest totals share the win. Otherwise everyone confirms the score review and a new match begins.</p>"
      }
    },
    {
      id: "senate",
      label: { zh: "低人数与元老院", en: "Small tables and the Senate" },
      html: {
        zh: "<p>房间支持 1 到 7 个席位。不足 3 席时线上会自动补充元老院 Senate(🏛️) 直到 3 席，单人局加两席，双人局加一席。</p>"
          + "<p>元老院(🏛️)随机弃牌并依序翻牌，参与筹码计算和胜负判定，但会被传牌跳过，也会自动确认。</p>"
          + "<p>房间里的 Bot 是完整玩家，和你一样参与传牌。</p>",
        en: "<p>A room supports one to seven seats. Below three seats the online game adds Senate (🏛️) seats up to three, so a solo game adds two and a two player game adds one.</p>"
          + "<p>The Senate (🏛️) discards at random and flips its cards in order. It takes part in chip totals and in deciding winners, but it is skipped when cards are passed and it confirms automatically.</p>"
          + "<p>A room bot is a full player and takes part in the card passing just like you.</p>"
      }
    },
    {
      id: "review",
      label: { zh: "回顾与操作", en: "Review and controls" },
      html: {
        zh: "<p>每次公开弃牌、结算出牌和揭示最终目标之后都会暂停，所有真人点 Next Round 之后才继续。</p>"
          + "<p>离线玩家不会被替真人自动确认，重连之后可以接着操作。</p>"
          + "<p>点击手牌选中，再按 Confirm 提交。准备阶段要选两张牌，出牌和传牌阶段各选一张。点击空白处或按 Esc 可以取消选择。</p>"
          + "<p>静态图标在电脑上悬停会显示提示，在手机上点一下会显示 3 秒提示。</p>",
        en: "<p>The game pauses after the discards are revealed, after each round is resolved and after the final objectives are shown, and it continues only once every human presses Next Round.</p>"
          + "<p>Offline players are never confirmed on behalf of a human, so you simply continue after reconnecting.</p>"
          + "<p>Tap a card in your hand to select it and press Confirm to submit. Setup asks for two cards, while playing and passing each ask for one. Clicking empty space or pressing Esc clears the selection.</p>"
          + "<p>Static icons show a tooltip on hover on a desktop and a three second tooltip on tap on a phone.</p>"
      }
    }
  ]
};

const MOSHIMO_YUSHA_EXPLAIN = {
  confirm: {
    zh: "提交当前选牌。准备阶段选两张，出牌与传牌阶段各选一张。提交后锁定并等待其他人，不会提前揭示。",
    en: "Submit the current selection. Setup needs two cards while playing and passing need one each. Your choice locks in and waits for the others without revealing early."
  },
  next: {
    zh: "确认已经看完当前结果。所有房间席位都确认后才继续，机器人与元老院只替自己确认。",
    en: "Confirm that you have read the current result. Play continues once every room seat confirms, and bots and the Senate only confirm for themselves."
  },
  discard: {
    zh: "公开牌区(🂠 / 🃏)。每一格显示该角色的初始匿名弃牌数和已出牌数，初始弃牌不会关联到任何玩家。",
    en: "The public card pool (🂠 / 🃏). Each cell shows how many copies of that role were discarded anonymously at setup and how many have been played, and setup discards are never linked to a player."
  },
  player: {
    zh: "玩家状态。公开显示三类筹码、胜利点(🏆)、剩余手牌数(🂠)与提交进度(🔒)。元老院(🏛️)不参加传牌，其余席位都参加。",
    en: "Player status. It shows the three chip counts, victory points (🏆), remaining hand size (🂠) and submission progress (🔒) in public. The Senate (🏛️) is skipped when passing cards while every other seat takes part."
  },
  gold: {
    zh: "金币 Gold(🪙)。市民比较金币数量，商人把它计入三类筹码总数。",
    en: "Gold (🪙). The Citizen compares gold counts while the Merchant counts it toward the total of all three chips."
  },
  attack: {
    zh: "攻击 Attack(⚔️)。奴隶要求全场总数不少于总席位数，王族要求全场总数为 0。",
    en: "Attack (⚔️). The Slave needs a table total at least equal to the number of seats, while the Royal needs that total to be zero."
  },
  faith: {
    zh: "信仰 Faith(✝️)。大司教比较信仰数量，商人把它计入三类筹码总数。",
    en: "Faith (✝️). The Archbishop compares faith counts while the Merchant counts it toward the total of all three chips."
  },
  score: {
    zh: "胜利点 Victory points(🏆)。独自达成最终目标得 2 分，多人达成各得 1 分。有人达到 2 分时，累计最高者获胜。",
    en: "Victory points (🏆). Meeting a final objective alone is worth two points and meeting it alongside others is worth one each. The game ends when somebody reaches two, and the highest total wins."
  },
  "card:1": {
    zh: "异世界勇者 Otherworldly Hero(🗡️)。本回合所有王族(👑)行动无效。单独效果(👤)是在场上有王族(👑)时获得 2 枚攻击(⚔️)，多人效果(👥)是每位勇者获得 1 枚攻击(⚔️)。它没有最终目标。",
    en: "Otherworldly Hero (🗡️). Every Royal (👑) action is cancelled this round. The single effect (👤) gains two Attack (⚔️) when a Royal (👑) is present and the multiple effect (👥) gives each Hero one Attack (⚔️). This role has no final objective."
  },
  "card:2": {
    zh: "哀怜的奴隶 Miserable Slave(⛓️)。单独效果(👤)获得 2 枚信仰(✝️)，多人效果(👥)每人获得 1 枚攻击(⚔️)。最终目标是全场攻击(⚔️)总数不少于总席位数。",
    en: "Miserable Slave (⛓️). The single effect (👤) gains two Faith (✝️) and the multiple effect (👥) gives one Attack (⚔️) each. The final objective is a table total of Attack (⚔️) at least equal to the number of seats."
  },
  "card:3": {
    zh: "和平的市民 Peaceful Citizen(🏡)。单独效果(👤)获得 2 枚金币(🪙)，多人效果(👥)每人获得 1 枚信仰(✝️)。最终目标是金币(🪙)严格多于每一位其他玩家。",
    en: "Peaceful Citizen (🏡). The single effect (👤) gains two Gold (🪙) and the multiple effect (👥) gives one Faith (✝️) each. The final objective is strictly more Gold (🪙) than every other player."
  },
  "card:4": {
    zh: "强欲的商人 Greedy Merchant(💰)。单独效果(👤)获得 3 枚金币(🪙)，多人效果(👥)每人获得 1 枚金币(🪙)。最终目标是三类筹码总数严格多于每一位其他玩家。",
    en: "Greedy Merchant (💰). The single effect (👤) gains three Gold (🪙) and the multiple effect (👥) gives one Gold (🪙) each. The final objective is strictly more chips in total than every other player."
  },
  "card:5": {
    zh: "温厚的大司教 Gentle Archbishop(⛪)。单独效果(👤)获得 1 枚信仰(✝️)，多人效果(👥)每人获得 2 枚信仰(✝️)。他只保护自己免受王族(👑)掠夺，最终目标是信仰(✝️)严格多于每一位其他玩家。",
    en: "Gentle Archbishop (⛪). The single effect (👤) gains one Faith (✝️) and the multiple effect (👥) gives two Faith (✝️) each. He protects only himself from a Royal (👑), and his final objective is strictly more Faith (✝️) than every other player."
  },
  "card:6": {
    zh: "傲慢的王族 Arrogant Royal(👑)。单独效果(👤)夺走其他未受保护玩家的全部三类筹码，多人效果(👥)让王族与大司教之外的所有人清空筹码。最终目标是全场攻击(⚔️)总数为 0，有勇者(🗡️)在场时行动无效。",
    en: "Arrogant Royal (👑). The single effect (👤) takes every chip from unprotected players and the multiple effect (👥) clears the chips of everyone except Royals and the Archbishop. The final objective is a table total of zero Attack (⚔️), and a Hero (🗡️) cancels the action."
  },
  "card:7": {
    zh: "愉快的道化师 Cheerful Jester(🎭)。单独效果(👤)让所有普通席位秘密传一张手牌给左邻并跳过元老院(🏛️)，多人效果(👥)让每位道化师获得 1 枚金币(🪙)。最终目标是没有其他角色达成目标时所有道化师获胜。",
    en: "Cheerful Jester (🎭). The single effect (👤) makes every ordinary seat secretly pass one hand card to the left while skipping the Senate (🏛️), and the multiple effect (👥) gives each Jester one Gold (🪙). The final objective makes every Jester win when no other role meets its objective."
  }
};

let moshimoYushaHelpWidget = null;
let moshimoYushaExplainWidget = null;

function initMoshimoYushaHelpExplain() {
  if (moshimoYushaHelpWidget || typeof window.obgCreateHelp !== "function") return;
  moshimoYushaHelpWidget = window.obgCreateHelp(MOSHIMO_YUSHA_HELP_CONFIG);
  moshimoYushaExplainWidget = window.obgCreateExplain({
    gameId: "moshimo_yusha",
    attribute: "data-my-explain",
    explanations: MOSHIMO_YUSHA_EXPLAIN,
    button: document.getElementById("moshimoYushaExplainBtn"),
    root: () => document.getElementById("moshimoYushaPanel"),
    bypass: ["#moshimoYushaHelpBtn", "#moshimoYushaExplainBtn"]
  });
  document.getElementById("moshimoYushaHelpBtn")?.addEventListener("click", () => {
    moshimoYushaExplainWidget?.exit();
    moshimoYushaHelpWidget.open();
  });
  document.getElementById("moshimoYushaExplainBtn")?.addEventListener("click", () => moshimoYushaExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMoshimoYushaHelpExplain);
} else {
  initMoshimoYushaHelpExplain();
}

(() => {
    "use strict";
    const panel = document.getElementById("moshimoYushaPanel");
    const header = document.getElementById("moshimoYushaHeaderActions");
    const $ = (suffix) => document.getElementById(`my${suffix}`);
    const tooltip = $("Tooltip");
    const colors = {
        1: "#569696",
        2: "#908480",
        3: "#83a375",
        4: "#c89a45",
        5: "#8197bc",
        6: "#b96f71",
        7: "#987dba",
    };
    const chipInfo = {
        gold: ["🪙", "Gold · 金币"],
        attack: ["⚔️", "Attack · 攻击"],
        faith: ["✝️", "Faith · 信仰"],
        score: ["🏆", "Victory points · 胜利点"],
    };
    const rules = {
        1: [
            "若有王族，获得 2 枚攻击（⚔️）。",
            "若有王族，每位勇者获得 1 枚攻击（⚔️）。",
            "无胜利条件；务必在最后一张前使用或传出。",
            "勇者（🗡️）使本回合所有王族（👑）行动无效。",
        ],
        2: [
            "获得 2 枚信仰（✝️）。",
            "每人获得 1 枚攻击（⚔️）。",
            "全场攻击（⚔️）总数 ≥ 总席位数，包含元老院。",
            "",
        ],
        3: [
            "获得 2 枚金币（🪙）。",
            "每人获得 1 枚信仰（✝️）。",
            "金币（🪙）严格多于每一位其他玩家；并列不满足。",
            "",
        ],
        4: [
            "获得 3 枚金币（🪙）。",
            "每人获得 1 枚金币（🪙）。",
            "三类筹码总数严格最多；并列不满足。",
            "",
        ],
        5: [
            "获得 1 枚信仰（✝️）。",
            "每人获得 2 枚信仰（✝️）。",
            "信仰（✝️）严格多于每一位其他玩家；并列不满足。",
            "大司教（⛪）只保护自己，免受本回合王族（👑）的掠夺或清空。",
        ],
        6: [
            "夺走其他未受保护玩家的全部三类筹码。",
            "除王族与大司教外，所有人清空三类筹码。",
            "全场攻击（⚔️）总数为 0。",
            "有勇者（🗡️）时无效；大司教（⛪）保留筹码。胜利点（🏆）不受影响。",
        ],
        7: [
            "所有普通席位同时秘密选一张剩余手牌，传给左邻（跳过元老院）。",
            "每位道化师获得 1 枚金币（🪙）；不传牌。",
            "没有其他角色满足其最后一张胜利条件时，所有道化师获胜。",
            "第四轮也要传牌，所以最终目标可能改变。同号牌可以同时留在手中。",
        ],
    };
    const short = {
        1: ["👤 王族在场 +2 ⚔️", "👥 王族在场 +1 ⚔️", "无最终目标"],
        2: ["👤 +2 ✝️", "👥 +1 ⚔️", "全场 ⚔️ ≥ 席位数"],
        3: ["👤 +2 🪙", "👥 +1 ✝️", "🪙 独自最多"],
        4: ["👤 +3 🪙", "👥 +1 🪙", "筹码总数独自最多"],
        5: ["👤 +1 ✝️", "👥 +2 ✝️", "✝️ 独自最多"],
        6: ["👤 掠夺筹码", "👥 清空非王族筹码", "全场没有 ⚔️"],
        7: ["👤 向左传一张牌", "👥 +1 🪙", "其他角色均未获胜"],
    };
    const roleNames = [
        null,
        ["🗡️", "异世界勇者"],
        ["⛓️", "哀怜的奴隶"],
        ["🏡", "和平的市民"],
        ["💰", "强欲的商人"],
        ["⛪", "温厚的大司教"],
        ["👑", "傲慢的王族"],
        ["🎭", "愉快的道化师"],
    ];
    let view = null,
        selected = [],
        handSignature = "",
        windowKey = "",
        pending = false;
    let busyTimer, tipTimer;
    const node = (tag, cls, value) => {
        const el = document.createElement(tag);
        if (cls) el.className = cls;
        if (value != null) el.textContent = value;
        return el;
    };
    const text = (suffix, value) => {
        $(suffix).textContent = value;
    };
    const card = (id) =>
        view?.cards.find((c) => c.id === id) || {
            id,
            emoji: roleNames[id]?.[0],
            name_zh: roleNames[id]?.[1],
        };
    const name = (id) => view?.players.find((p) => p.player_id === id)?.name || "—";
    const active = () => currentGameType === "moshimo_yusha" && !panel.classList.contains("hidden");
    const can = (kind) =>
        Boolean(!pending && socket.connected && view?.legal_actions.includes(kind));
    const tip = (el, message, explain) => {
        el.dataset.myTip = message;
        el.tabIndex = 0;
        if (explain) el.dataset.myExplain = explain;
        return el;
    };
    function hideTip() {
        clearTimeout(tipTimer);
        tooltip.classList.add("hidden");
    }
    function showTip(target, autoHide = false) {
        if (!target?.dataset.myTip) return;
        clearTimeout(tipTimer);
        tooltip.textContent = target.dataset.myTip;
        tooltip.classList.remove("hidden");
        const r = target.getBoundingClientRect(),
            b = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(12, Math.min(r.left, innerWidth - b.width - 12))}px`;
        tooltip.style.top = `${Math.max(12, Math.min(r.bottom + 7, innerHeight - b.height - 12))}px`;
        if (autoHide) tipTimer = setTimeout(hideTip, 3000);
    }
    // Help and Explain now live in the shared widgets above.
    function chipsRow(chips, score) {
        const row = node("div", "my-resources");
        for (const kind of ["gold", "attack", "faith", ...(score == null ? [] : ["score"])]) {
            const [emoji, label] = chipInfo[kind];
            row.append(
                tip(
                    node(
                        "span",
                        `my-resource my-${kind}`,
                        `${emoji} ${kind === "score" ? score : chips[kind]}`,
                    ),
                    `${label}（${emoji}）`,
                    kind,
                ),
            );
        }
        return row;
    }
    function renderHand() {
        const signature = JSON.stringify([view.my_hand.map((c) => c.id), view.phase]);
        if (signature !== handSignature) {
            const choosing = ["setup_discard", "playing", "pass_cards"].includes(view.phase);
            $("HandDetails").open = choosing;
            $("HandSummary").classList.toggle("hidden", choosing);
            text("HandSummary", `Remaining hand · private (${view.my_hand.length})`);
            const scroll = $("Hand").scrollTop;
            $("Hand").replaceChildren();
            view.my_hand.forEach((c, i) => {
                const b = node("button", "my-card");
                b.type = "button";
                b.dataset.myCard = String(i);
                b.dataset.myExplain = `card:${c.id}`;
                b.style.setProperty("--my-card-color", colors[c.id]);
                const top = node("div", "my-card-top");
                top.append(node("span", "", `NO. ${c.id}`), node("span", "my-check", ""));
                b.append(
                    top,
                    node("span", "my-card-emoji", c.emoji),
                    node("strong", "", c.name_zh),
                    node("small", "", short[c.id][0]),
                    node("small", "", short[c.id][1]),
                    node("small", "", `最后：${short[c.id][2]}`),
                );
                b.setAttribute("aria-label", `${c.id} ${c.name_zh}`);
                $("Hand").append(b);
            });
            if (!view.my_hand.length)
                $("Hand").append(node("p", "my-caption", "Watching this table."));
            $("Hand").scrollTop = scroll;
            handSignature = signature;
        }
        updateSelection();
    }
    function updateSelection() {
        const kind = view?.legal_actions[0];
        const choosing = ["discard", "play", "pass_card"].includes(kind);
        $("Hand")
            .querySelectorAll("[data-my-card]")
            .forEach((b) => {
                const yes = selected.includes(Number(b.dataset.myCard));
                b.classList.toggle("is-selected", yes);
                b.setAttribute("aria-pressed", String(yes));
                b.querySelector(".my-check").textContent = yes ? "✓" : "";
                b.disabled = !choosing || !can(kind);
            });
        $("Confirm").classList.toggle(
            "hidden",
            !["setup_discard", "playing", "pass_cards"].includes(view?.phase),
        );
        $("Confirm").disabled =
            !choosing || !can(kind) || selected.length !== (kind === "discard" ? 2 : 1);
        text(
            "Confirm",
            pending
                ? "Submitting…"
                : kind === "discard"
                  ? "Confirm discard"
                  : kind === "pass_card"
                    ? "Pass card"
                    : "Confirm play",
        );
        $("Next").classList.toggle(
            "hidden",
            !["setup_review", "round_review", "match_review"].includes(view?.phase),
        );
        $("Next").disabled = !can("next_round");
        text("Next", view?.next_round_ready.includes(view.you) ? "Ready ✓" : "Next Round");
        text(
            "Selected",
            selected.length
                ? selected
                      .map((i) => view.my_hand[i]?.name_zh)
                      .filter(Boolean)
                      .join(" · ")
                : view?.my_submission != null
                  ? "Selection locked 🔒"
                  : "",
        );
        document.body.classList.toggle(
            "my-needs-action",
            Boolean(active() && view?.legal_actions.length && socket.connected),
        );
    }
    function renderPlayers() {
        const container = $("Players"),
            scroll = container.scrollTop;
        container.replaceChildren();
        view.players.forEach((p) => {
            const el = node("article", `my-player ${p.player_id === view.you ? "my-self" : ""}`);
            const heading = node("div", "my-player-heading");
            heading.append(
                node("strong", "", `${p.name}${p.player_id === view.you ? " · You" : ""}`),
            );
            const review = ["setup_review", "round_review", "match_review"].includes(view.phase);
            const status = p.is_senate ? "🏛️ Senate" : p.is_bot ? "Bot" : "";
            heading.append(
                tip(
                    node(
                        "small",
                        "",
                        `${status} ${review ? (view.next_round_ready.includes(p.player_id) || p.is_senate ? "✓ Ready" : "Reviewing") : p.submitted ? "🔒 Submitted" : ""}`,
                    ),
                    "🏛️ Senate 为元老院；🔒 Submitted 表示已提交隐藏选择。",
                    "player",
                ),
            );
            el.append(
                heading,
                chipsRow(p.chips, p.score),
                tip(
                    node("span", "my-card-count", `🂠 ${p.card_count} cards`),
                    "手牌（🂠）：未打出的角色牌数量。",
                    "player",
                ),
            );
            container.append(el);
        });
        container.scrollTop = scroll;
    }
    function renderReview() {
        const record = view.last_resolution;
        $("Review").classList.toggle("hidden", !record || Boolean(view.last_match_summary));
        $("ReviewRows").replaceChildren();
        $("Effects").replaceChildren();
        if (record) {
            text("ReviewTitle", `Round ${record.round} · revealed`);
            text("ReviewStatus", view.phase === "pass_cards" ? "Exchange in progress" : "Resolved");
            record.cards.forEach((r) => {
                const c = card(r.card_id),
                    el = node(
                        "article",
                        `my-review-row ${r.player_id === view.you ? "my-self" : ""}`,
                    ),
                    head = node("div", "my-row-head");
                const count = record.cards.filter((x) => x.card_id === r.card_id).length;
                head.append(
                    node(
                        "strong",
                        "",
                        `${name(r.player_id)}${r.player_id === view.you ? " · You" : ""}`,
                    ),
                    tip(
                        node("span", "", `${c.id} ${c.emoji} ${c.name_zh}`),
                        `${c.name_zh} · ${count > 1 ? "多人效果 👥" : "单独效果 👤"}`,
                        `card:${c.id}`,
                    ),
                );
                el.append(head);
                const after = record.after[r.player_id];
                if (after) {
                    const changes = Object.keys(chipInfo)
                        .filter((k) => k !== "score")
                        .map((k) => {
                            const delta = after[k] - record.before[r.player_id][k];
                            return `${chipInfo[k][0]} ${record.before[r.player_id][k]} → ${after[k]} (${delta > 0 ? "+" : ""}${delta})`;
                        });
                    el.append(node("p", "", changes.join(" · ")));
                }
                $("ReviewRows").append(el);
            });
            record.effects.forEach((e) =>
                $("Effects").append(
                    node("li", e.affected?.includes(view.you) ? "my-own-effect" : "", e.text),
                ),
            );
        }
        const summary = view.last_match_summary;
        $("Final").classList.toggle("hidden", !summary);
        $("FinalRows").replaceChildren();
        if (summary) {
            text(
                "FinalTitle",
                view.game_over
                    ? `🏆 ${view.winner_ids.map(name).join(" & ")}`
                    : `Match ${summary.match} · final objectives`,
            );
            view.players.forEach((p) => {
                const c = summary.final_cards[p.player_id];
                if (!c) return;
                const won = summary.winners.includes(p.player_id);
                const el = node(
                    "article",
                    `my-review-row ${p.player_id === view.you ? "my-self" : ""}`,
                );
                el.append(
                    tip(
                        node(
                            "strong",
                            "",
                            `${p.name}${p.player_id === view.you ? " · You" : ""} · ${c.emoji} ${c.name_zh}`,
                        ),
                        `${c.name_zh}（${c.emoji}）：${rules[c.id][2]}`,
                        `card:${c.id}`,
                    ),
                    node(
                        "p",
                        "",
                        `${won ? `✓ +${summary.victory_points_gained} 🏆` : "— Goal not met"} · Total ${summary.scores[p.player_id]} 🏆`,
                    ),
                    node("p", "", rules[c.id][2]),
                );
                $("FinalRows").append(el);
            });
        }
    }
    function renderPool() {
        $("Discard").replaceChildren();
        view.cards.forEach((c) => {
            const d = view.discarded.filter((x) => x.id === c.id).length,
                p = view.played.filter((x) => x.card_id === c.id).length;
            const el = tip(
                node("div", "my-pool", `${c.id} ${c.emoji}`),
                `${c.name_zh}：初始匿名弃牌 ${d} 张（🂠），已出牌 ${p} 张（🃏）。`,
                `card:${c.id}`,
            );
            el.append(node("small", "", `${d} / ${p}`));
            $("Discard").append(el);
        });
    }
    function render() {
        if (!view) return;
        const phase = view.phase,
            legal = view.legal_actions[0];
        text(
            "Round",
            `Match ${view.match_number} · ${view.play_round ? `Round ${view.play_round} / 4` : "Preparation"}`,
        );
        const labels = {
            setup_discard: "Choose two cards to discard",
            setup_review: "Anonymous discards revealed",
            playing: "Choose one card to play",
            pass_cards: "Pass one card to your left",
            round_review: "Round complete · review the table",
            match_review: "Final objectives revealed",
            game_over: "Game complete",
        };
        text("Status", socket.connected ? labels[phase] : "Disconnected · reconnecting…");
        text(
            "HandTitle",
            phase === "setup_discard"
                ? "Your seven roles"
                : phase === "pass_cards"
                  ? "Choose a card to pass"
                  : "Your hand · private",
        );
        const review = ["setup_review", "round_review", "match_review"].includes(phase);
        const done = review
            ? view.next_round_ready.length
            : view.submitted.filter((pid) => view.turn_order.includes(pid)).length;
        text(
            "Progress",
            phase === "game_over"
                ? "Final card"
                : `${done} / ${view.turn_order.length} ${review ? "ready" : "submitted"}`,
        );
        const instruction =
            phase === "game_over"
                ? "Final results are kept here. Use Reopen in Room Controls to play again."
                : review
                  ? phase === "round_review" && view.play_round === 4
                      ? "Review this round. Next Round reveals the final objectives."
                      : "Everyone confirms before the next step."
                  : !legal
                    ? "Your selection is locked. Waiting for the other players…"
                    : phase === "setup_discard"
                      ? "Select two cards; the remaining five form your hand."
                      : phase === "pass_cards"
                        ? `Choose one card for ${name(view.turn_order[(view.turn_order.indexOf(view.you) + 1) % view.turn_order.length])}.`
                        : "Select a role. Your last card becomes your final objective.";
        text(
            "Instruction",
            view.turn_order.includes(view.you)
                ? instruction
                : "Spectating · private cards are hidden.",
        );
        text("TableCount", `${view.players.length} seats`);
        renderHand();
        renderPlayers();
        renderReview();
        renderPool();
        $("Exchange").classList.toggle("hidden", !view.my_exchange);
        if (view.my_exchange) {
            const e = view.my_exchange;
            text(
                "Exchange",
                `🔒 Sent ${card(e.sent).emoji} ${card(e.sent).name_zh} → ${name(e.to)} · Received ${card(e.received).emoji} ${card(e.received).name_zh} ← ${name(e.from)}`,
            );
        }
        const scroll = $("Log").scrollTop;
        $("Log").replaceChildren(...[...view.history].reverse().map((t) => node("li", "", t)));
        $("Log").scrollTop = scroll;
    }
    function submit(kind) {
        if (!can(kind)) return;
        let fields = {};
        const ids = selected.map((i) => view.my_hand[i]?.id);
        if (kind === "discard") {
            if (ids.length !== 2) return;
            fields = { card_ids: ids };
        }
        if (kind === "play" || kind === "pass_card") {
            if (ids.length !== 1) return;
            fields = { card_id: ids[0] };
        }
        pending = true;
        updateSelection();
        clearTimeout(busyTimer);
        busyTimer = setTimeout(() => {
            pending = false;
            updateSelection();
        }, 5000);
        sendAction({
            type: kind,
            ...fields,
            game_instance_id: view.game_instance_id,
            window_id: view.window_id,
        });
    }
    $("Hand").addEventListener("click", (event) => {
        const b = event.target.closest("[data-my-card]");
        if (!b || b.disabled) return;
        const i = Number(b.dataset.myCard),
            max = view.legal_actions[0] === "discard" ? 2 : 1;
        if (selected.includes(i)) selected = selected.filter((x) => x !== i);
        else if (max === 1) selected = [i];
        else if (selected.length < max) selected.push(i);
        updateSelection();
    });
    $("Confirm").addEventListener("click", () => submit(view?.legal_actions[0]));
    $("Next").addEventListener("click", () => submit("next_round"));
    panel.addEventListener("click", (event) => {
        const t = event.target.closest("[data-my-tip]");
        if (t) showTip(t, true);
        else hideTip();
        if (!event.target.closest("button,[data-my-tip],a,input,summary") && selected.length) {
            selected = [];
            updateSelection();
        }
    });
    panel.addEventListener("pointerover", (event) => {
        if (event.pointerType === "mouse") showTip(event.target.closest("[data-my-tip]"));
    });
    panel.addEventListener("pointerout", (event) => {
        if (event.pointerType === "mouse") hideTip();
    });
    panel.addEventListener("focusin", (event) => showTip(event.target.closest("[data-my-tip]")));
    panel.addEventListener("focusout", hideTip);
    document.addEventListener(
        "keydown",
        (event) => {
            if (!active() || event.key !== "Escape") return;
            hideTip();
            selected = [];
            updateSelection();
        },
        true,
    );
    document.addEventListener("scroll", hideTip, true);
    window.addEventListener("resize", hideTip);
    window.addEventListener("blur", hideTip);
    function clear() {
        view = null;
        pending = false;
        selected = [];
        windowKey = "";
        handSignature = "";
        clearTimeout(busyTimer);
        hideTip();
        document.body.classList.remove("my-needs-action");
        ["Hand", "Players", "ReviewRows", "FinalRows", "Discard", "Log"].forEach((s) =>
            $(s).replaceChildren(),
        );
        ["Review", "Final", "Exchange"].forEach((s) => $(s).classList.add("hidden"));
        text("Status", "Waiting to start");
        text("Round", "");
        text("HandTitle", "Your hand");
        text("Progress", "");
        text("TableCount", "");
        text("Instruction", "Waiting to start");
        $("HandDetails").open = true;
        $("HandSummary").classList.add("hidden");
        updateSelection();
    }
    window.renderMoshimoYushaGameState = (data) => {
        if (
            data?.view?.game_id !== "moshimo_yusha" ||
            currentGameType !== "moshimo_yusha" ||
            (data.room_id && data.room_id !== currentRoomState?.room_id)
        )
            return;
        const key = `${data.room_id}:${data.view.game_instance_id}:${data.view.window_id}:${data.view.you}`;
        if (key !== windowKey) {
            selected = [];
            pending = false;
            clearTimeout(busyTimer);
            hideTip();
        } else if (
            data.view.my_submission != null ||
            data.view.next_round_ready.includes(data.view.you)
        ) {
            selected = [];
            pending = false;
            clearTimeout(busyTimer);
        }
        windowKey = key;
        view = data.view;
        render();
    };
    window.showMoshimoYushaHeaderActions = (visible) => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) clear();
        else updateSelection();
    };
    function syncRoom(state) {
        if (state?.game_type !== "moshimo_yusha" || state.status === "lobby") clear();
    }
    function sync() {
        socket.on("room:state", syncRoom);
        socket.on("system:error", () => {
            pending = false;
            clearTimeout(busyTimer);
            if (view) updateSelection();
        });
        socket.on("disconnect", () => {
            pending = false;
            if (view) render();
        });
        socket.on("connect", () => {
            if (view) render();
        });
        if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
        if (
            typeof lastGameStatePayload !== "undefined" &&
            lastGameStatePayload?.game_type === "moshimo_yusha"
        )
            window.renderMoshimoYushaGameState(lastGameStatePayload);
    }
    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", sync, { once: true });
    else sync();
})();
