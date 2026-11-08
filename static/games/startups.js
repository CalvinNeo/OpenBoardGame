(() => {
  "use strict";
  const byId = suffix => document.getElementById(`startups${suffix}`);
  const panel = byId("Panel"), header = byId("HeaderActions"), configBox = byId("ConfigBox");
  const tooltip = byId("Tooltip");
  let view = null, selection = null, pending = false;
  let pendingTimer, tipTimer;
  let configSignature = null, renderSignature = null;
  let pointerGesture = null;
  const STARTUPS_EXPLAIN = {
    round: {
      zh: "当前是第几局。单局赛只打一局，四局赛每局按财富排名发放积分。",
      en: "Which round is being played. A single-round match ends after one round, while a four-round match awards points every round."
    },
    deck: {
      zh: "牌堆(🂠)里还剩多少张股份，不含手牌、市场和公开投资。抽走最后一张的玩家仍须放一张牌，随后本局立刻结算。",
      en: "How many shares are left in the deck (🂠), excluding hands, the market and public investments. Whoever takes the last card still places a share, and the round then settles at once."
    },
    company: {
      zh: "这家公司整副牌的发行量，不是分值。每张股份都算一股，发行量越大越容易堆出多数。",
      en: "How many shares of this company exist in the whole deck. It is not a score. Every share counts as one, and a bigger supply makes majorities easier to build."
    },
    marker: {
      zh: "反垄断标记(🚫)由公开持股最多者持有。首张公开投资即可取得，只有别人严格超过你才会转移。它让你免付这家公司的抽牌费用，也禁止你从市场拿这家公司的股份。",
      en: "The anti-monopoly marker (🚫) belongs to the largest public holder. The first public investment takes it, and it only moves when someone strictly passes you. It frees you from that company's draw fees and blocks you from taking its market shares."
    },
    player: {
      zh: "玩家座位号，与公司反垄断标记(🚫)上的编号一致。You 是你自己，Turn 表示现在轮到谁行动。",
      en: "The seat number of a player, matching the number printed on the anti-monopoly marker (🚫). You marks yourself and Turn marks whoever is acting."
    },
    capital: {
      zh: "资本(💰)。每局从 10 枚开始，抽牌时按市场里需要付费的牌逐张支付，从市场拿牌则收走牌上的全部资本。结算时每枚没花掉的资本值 1 分。",
      en: "Capital (💰). You start every round with 10, pay one coin per chargeable market card when you draw, and collect every coin on a card when you take it. Each unspent coin is worth 1 point at settlement."
    },
    draw: {
      zh: "从牌堆抽 1 张。先给市场中每张未被自己反垄断标记(🚫)豁免的牌支付 1 枚资本(💰)，这些资本会留在牌上。资本不够就不能抽。",
      en: "Draw one card from the deck. First pay 1 capital (💰) for every market card not exempted by your own anti-monopoly marker (🚫), and those coins stay on the cards. You cannot draw without enough capital."
    },
    take: {
      zh: "从市场拿走选中的股份，连同牌上的全部资本(💰)。自己持有反垄断标记(🚫)的公司不能拿。",
      en: "Take the selected share from the market together with every coin on it. You may not take a company whose anti-monopoly marker (🚫) you hold."
    },
    hand: {
      zh: "隐藏手牌(🃏)。拿到牌后手里有四张，放一张后回到三张。别人只看得到数量。结算时手牌全部公开并计入最终持股。",
      en: "Your hidden hand (🃏). After taking a share you hold four cards and place one to return to three. Others only see the count. Every hand card is revealed and counted at settlement."
    },
    invest: {
      zh: "把选中的股份公开投资到自己面前。公开持股(📊)参与反垄断标记(🚫)的争夺，已投资的牌不能收回。",
      en: "Invest the selected share face up in front of you. Public holdings (📊) compete for the anti-monopoly marker (🚫), and invested cards can never be taken back."
    },
    discard: {
      zh: "把选中的股份弃到公共市场，牌上的资本(💰)从 0 开始。本回合从市场拿过股份后，不能把同公司的任何手牌放回市场。",
      en: "Send the selected share to the public market with its capital (💰) reset to 0. After taking a share from the market this turn you may not return any hand card of that same company."
    },
    portfolio: {
      zh: "公开持股(📊)。游戏中只显示已投资的股份，不含隐藏手牌(🃏)。结算时手牌会自动加上，每家公司的唯一最大股东收款。",
      en: "Public holdings (📊). During play only invested shares are shown, never the hidden hand (🃏). Hands are added at settlement, and the single largest holder of each company collects."
    },
    wealth: {
      zh: "最终财富(💰)，等于结算前的资本减去付出的筹码数，再加上 3 倍收入筹码数。资本不够可以负债。",
      en: "Final wealth (💰): capital before settlement minus chips paid plus three times the chips collected. Going into debt is allowed."
    },
    income: {
      zh: "收入筹码(🪙)。每家公司的唯一最大股东从其他股东手里每张股份收 1 枚，收到后每枚计 3 分。",
      en: "Income chips (🪙). The single largest holder of a company collects 1 chip per share from every other holder, and each collected chip is worth 3 points."
    },
    points: {
      zh: "比赛积分(🏆)。四局赛每局第一名 +2、第二名 +1、最后一名 −1，其余 0。最终先比累计积分。",
      en: "Match points (🏆). Every round of a four-round match gives +2 to the winner, +1 to second, −1 to last and 0 to everyone else. Total points decide the match."
    },
    next: {
      zh: "确认看完结算并开始下一局。所有玩家都确认后才开局，上一局的最后一名先手。",
      en: "Confirm the settlement and start the next round. The round begins once every player has confirmed, and the last player of the previous round goes first."
    },
    cancel: {
      zh: "取消当前选牌，不执行任何游戏动作。点击空白处或按 Esc 同样可以取消。",
      en: "Cancel the current selection without taking any game action. Clicking empty space or pressing Esc does the same."
    },
    settlement: {
      zh: "逐公司展开查看谁向谁支付了多少筹码(🪙)。并列最高的公司没有任何收付。",
      en: "Expand to see who paid how many chips (🪙) to whom, company by company. A tied company produces no payments at all."
    },
    history: {
      zh: "本局与历局的行动记录和分数，用来复盘谁在什么时候拿走了哪张股份。",
      en: "Action and score history for this round and earlier rounds, useful to retrace who took which share and when."
    }
  };
  const STARTUPS_HELP_CONFIG = {
    gameId: "startups",
    title: { zh: "初创公司 · Startups", en: "Startups" },
    basic: {
      win: {
        zh: "一局结束时最终财富(💰)最高的人获胜，财富等于结算前的资本减去付出的筹码，再加上 3 倍收到的筹码。",
        en: "The player with the highest final wealth (💰) wins the round. Wealth is your capital before settlement minus the chips you paid plus three times the chips you collected."
      },
      turn: {
        zh: "轮到你时先拿一张股份，可以付资本从牌堆(🂠)抽一张，也可以从市场拿走一张现成的股份，然后必须从手牌里放一张出去。",
        en: "On your turn you first take one share, either by paying capital to draw from the deck (🂠) or by taking a ready-made share from the market, and then you must place one card from your hand."
      },
      key: {
        zh: "每家公司只有唯一最大股东才能收钱，所以真正的胜负藏在你那三张别人看不见的手牌(🃏)里。",
        en: "Only the single largest holder of a company collects money, so the real outcome hides inside the three hand cards (🃏) that nobody else can see."
      }
    },
    sections: [
      {
        id: "setup",
        label: { zh: "准备", en: "Setup" },
        html: {
          zh: "<p>3 到 7 人同场。每局从 45 张股份里暗移除 5 张，其余洗成牌堆(🂠)，每人发 3 张隐藏手牌(🃏)和 10 枚资本(💰)，市场从空开始。</p>"
            + "<p>六家公司的发行量分别是长颈鹿啤酒(🦒) 5 张、汪汪游戏(🐶) 6 张、火烈鸟软件(🦩) 7 张、章鱼咖啡(🐙) 8 张、河马动力(🦛) 9 张、大象火星旅行(🐘) 10 张。牌上的数字是整副牌的发行量，不是分值，每一张都算一股。</p>",
          en: "<p>Three to seven players. Every round removes 5 of the 45 shares face down and shuffles the rest into the deck (🂠). Each player receives 3 hidden hand cards (🃏) and 10 capital (💰), and the market starts empty.</p>"
            + "<p>The six companies issue Giraffe Beer (🦒) with 5 shares, Bowwow Games (🐶) with 6, Flamingo Soft (🦩) with 7, Octo Coffee (🐙) with 8, Hippo Powertech (🦛) with 9 and Elephant Mars Travel (🐘) with 10. The number on a card is its print run rather than a score, and every card counts as one share.</p>"
        }
      },
      {
        id: "turn",
        label: { zh: "每回合", en: "Your turn" },
        html: {
          zh: "<p>轮到你时先拿一张股份。选 Draw 就要给市场里每张需要付费的牌付 1 枚资本(💰)，这些资本留在牌上，然后秘密抽 1 张。选 Take Card 就拿走市场里的一张股份和它上面的全部资本(💰)。自己持有反垄断标记(🚫)的公司不能从市场拿。</p>"
            + "<p>拿到牌后手里有四张，必须放一张出去。Invest 把它公开放到自己面前，计入公开持股(📊)。To Market 把它弃到市场，牌上的资本从 0 开始重新累积。</p>"
            + "<p>如果这回合是从市场拿的牌，就不能把同公司的任何手牌放回市场，哪怕不是刚拿到的那一张。放完牌手里重新保持三张，轮到下一位。</p>",
          en: "<p>Your turn starts by taking one share. Draw pays 1 capital (💰) for every chargeable card in the market, leaves those coins on the cards and then draws one card in secret. Take Card instead removes one market share and every coin sitting on it. You may never take a company whose anti-monopoly marker (🚫) you hold.</p>"
            + "<p>After taking a share you hold four cards and must place one. Invest puts it face up in front of you and adds it to your public holdings (📊). To Market sends it to the market, where its capital starts again from 0.</p>"
            + "<p>If you took your share from the market this turn, you may not return any hand card of that same company, even a different copy of it. Placing a card brings your hand back to three and play passes on.</p>"
        }
      },
      {
        id: "marker",
        label: { zh: "反垄断标记", en: "Anti-Monopoly marker" },
        html: {
          zh: "<p>第一位公开投资某家公司的玩家立即取得该公司的反垄断标记(🚫)。之后只有别人的公开持股严格超过你时标记才会转移，追平时原持有者保留。隐藏手牌(🃏)在争夺标记时不参与比较。</p>"
            + "<p>标记带来两个效果。你抽牌时不必为市场上这家公司的牌付资本(💰)，但你也不能从市场拿走这家公司的股份。结算时它并不破平，最高并列的公司所有人都没有收付。</p>",
          en: "<p>The first player to invest publicly in a company takes that company's anti-monopoly marker (🚫). From then on it only moves when another player's public holding strictly passes yours, so a tie leaves it with the current holder. Hidden hand cards (🃏) never count in this contest.</p>"
            + "<p>The marker has two effects. You skip the draw fee for that company's market cards, and you may not take that company's shares from the market. It breaks no tie at settlement, where a tied company simply produces no payments.</p>"
        }
      },
      {
        id: "scoring",
        label: { zh: "结算与财富", en: "Settlement" },
        html: {
          zh: "<p>抽走牌堆(🂠)最后一张的人仍须完成放牌，随后本局立刻结束，其他人不再行动。所有手牌同时公开，和公开持股(📊)一起算作最终持股，市场上的牌和暗移除的牌不计入。</p>"
            + "<p>每家公司若存在唯一最大股东，其他股东每持有 1 张该公司的股份就要付给他 1 枚筹码(🪙)。收到的筹码每枚计 3 分，付出的每枚只扣 1 分。最高并列时这家公司没有任何收付。</p>"
            + "<p>最终财富(💰)等于结算前的资本减去付出的筹码数，再加上 3 倍收到的筹码数。资本不够可以负债。财富相同先比收入筹码数，仍相同则最近完成回合的人优先。</p>",
          en: "<p>The player who takes the last card of the deck (🂠) still finishes placing a share, and the round then ends at once without anyone else acting. Every hand is revealed and counted together with the public holdings (📊). Market cards and the removed cards never count.</p>"
            + "<p>When a company has a single largest holder, every other holder pays that player 1 chip (🪙) for each share of that company they own. A collected chip is worth 3 points while a paid chip costs only 1 point. A tied company pays nothing at all.</p>"
            + "<p>Final wealth (💰) is your capital before settlement minus the chips you paid plus three times the chips you collected. Running out of capital only means debt. Ties break first on income chips and then on who completed their turn most recently.</p>"
        }
      },
      {
        id: "match",
        label: { zh: "四局赛", en: "Four-round match" },
        html: {
          zh: "<p>开局前可以把 Match 选成 Four-round match。每局第一名 +2、第二名 +1、最后一名 −1，其余 0，累加为比赛积分(🏆)。</p>"
            + "<p>所有人按下 Next Round 之后回收全部牌重新准备，上一局的最后一名先手。四局打完先比累计积分，再比第一名次数、第二名次数，最后看第四局的排名。单局赛直接比较最终财富(💰)。</p>",
          en: "<p>Before the game starts you may switch Match to a four-round match. Every round gives +2 to the winner, +1 to second place, −1 to last place and 0 to everyone else, and these add up to your match points (🏆).</p>"
            + "<p>Once everyone presses Next Round the cards are collected and a fresh round is dealt, started by the last player of the previous round. After four rounds the totals decide the match, then the number of first places, then second places, and finally the ranking of round four. A single-round match simply compares final wealth (💰).</p>"
        }
      },
      {
        id: "controls",
        label: { zh: "操作", en: "Controls" },
        html: {
          zh: "<p>点市场或手牌里的股份会在牌区弹出确认层，再点 Take Card、Invest 或 To Market 执行。点空白处、Cancel 或按 Esc 都能取消选择。Draw 与 Next Round 直接执行。</p>"
            + "<p>Help 汇总全部规则，Explain 打开后再点牌面、指标或按钮可以逐项解释，灰色不可用的按钮同样能解释，按 Esc 退出解释。带说明的图标可以悬停查看，手机上点一下会显示三秒。机器人只使用自己的手牌和公开信息，是练习级对手。</p>",
          en: "<p>Tapping a share in the market or in your hand opens a confirmation layer over the card area, where Take Card, Invest or To Market performs the move. Click empty space, press Cancel or hit Esc to drop the selection. Draw and Next Round act immediately.</p>"
            + "<p>Help gathers every rule, and once Explain is on you can tap any card, indicator or button for a single explanation, including greyed-out buttons, with Esc leaving explain mode. Annotated icons show a hint on hover, or for three seconds when tapped on a phone. Bots only use their own hand and public information, so they are practice-level opponents.</p>"
        }
      }
    ]
  };

  let startupsHelpWidget = null;
  let startupsExplainWidget = null;

  function initStartupsHelpExplain() {
    if (startupsHelpWidget || typeof window.obgCreateHelp !== "function") return;
    startupsHelpWidget = window.obgCreateHelp(STARTUPS_HELP_CONFIG);
    startupsExplainWidget = window.obgCreateExplain({
      gameId: "startups",
      attribute: "data-su-explain",
      explanations: STARTUPS_EXPLAIN,
      button: byId("ExplainBtn"),
      root: () => document.getElementById("startupsPanel"),
      bypass: ["#startupsHelpBtn", "#startupsExplainBtn"]
    });
    byId("HelpBtn")?.addEventListener("click", () => {
      startupsExplainWidget?.exit();
      startupsHelpWidget.open();
    });
    byId("ExplainBtn")?.addEventListener("click", () => startupsExplainWidget?.toggle());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStartupsHelpExplain);
  } else {
    initStartupsHelpExplain();
  }

  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }
  function text(suffix, value) { byId(suffix).textContent = value; }
  function company(id) { return view.companies.find(item => item.id === id); }
  function name(id) { return view?.players.find(player => player.player_id === id)?.name || id || "—"; }
  function label(id) { const c = company(id); return `${c.emoji} ${c.name}`; }
  function can(kind) { return !!view && !pending && socket.connected && view.legal_actions.includes(kind); }
  function explainText(key) {
    const entry = STARTUPS_EXPLAIN[key];
    if (!entry) return "";
    return (window.obgHelpLang?.() === "en" ? entry.en : entry.zh) || entry.zh;
  }
  function tip(node, key, message) {
    node.dataset.suExplain = key;
    node.dataset.suTip = message || explainText(key);
    if (node.tagName !== "BUTTON") node.tabIndex = 0;
    return node;
  }
  function makeCard(card, area, coins = 0) {
    const c = company(card.company), node = el("button", `startups-card su-${c.id}`);
    node.type = "button"; node.dataset.cardId = card.id; node.dataset.area = area;
    const blocked = area === "market" && view.anti_monopoly[c.id] === view.you;
    node.disabled = area === "market" ? !can("take_market") || blocked : !can("invest");
    node.classList.toggle("is-blocked", blocked);
    node.classList.toggle("is-selected", selection?.id === card.id && selection?.area === area);
    node.setAttribute("aria-pressed", String(selection?.id === card.id && selection?.area === area));
    node.setAttribute("aria-label", `${c.name}, ${c.supply} total shares${area === "market" ? `, ${coins} capital${blocked ? ", blocked by your anti-monopoly marker" : ""}` : ""}`);
    const top = el("span", "startups-card-top");
    top.append(el("span", "", `${c.supply}×`), el("span", blocked ? "" : "startups-card-kind", blocked ? "🚫" : "SHARE"));
    const cardName = el("span", "startups-card-name");
    cardName.append(el("span", "startups-card-full-name", c.name), el("span", "startups-card-short-name", c.name.split(" ")[0]));
    node.append(top, el("span", "startups-card-icon", c.emoji), cardName);
    if (area === "market") node.append(el("span", "startups-card-coins", `💰 +${coins}`));
    tip(node, area === "market" ? blocked ? "marker" : "take" : "hand",
      `${label(c.id)}：全牌组 ${c.supply} 股。${area === "market" ? `拿牌可获得 ${coins} 枚资本（💰）。${blocked ? "你的反垄断标记（🚫）阻止拿取。" : ""}` : "你的隐藏股份，结算时也会计入持股。"}`);
    return node;
  }
  function renderCompanies() {
    const container = byId("Companies"); container.replaceChildren();
    for (const c of view.companies) {
      const node = tip(el("div", `startups-company su-${c.id}`), "marker",
        `${label(c.id)}：发行 ${c.supply} 股。反垄断标记（🚫）：${view.anti_monopoly[c.id] ? name(view.anti_monopoly[c.id]) : "无人持有"}。`);
      const top = el("div", "startups-company-top");
      top.append(el("span", "", c.emoji), tip(el("span", "", `${c.supply}×`), "company", `${label(c.id)}：整副牌中有 ${c.supply} 张股份，不是分值。`));
      const holder = view.anti_monopoly[c.id];
      const marker = el("span", "startups-marker-name");
      marker.append(el("span", "startups-marker-owner", holder ? `🚫 ${name(holder)}` : "— Open"),
        el("span", "startups-marker-seat", holder ? `🚫#${view.players.findIndex(player => player.player_id === holder) + 1}` : "Open"));
      node.append(top, el("strong", "", c.name), marker);
      container.append(node);
    }
  }
  function renderMarket() {
    const container = byId("Market"), scroll = container.scrollTop;
    container.replaceChildren();
    view.market.forEach(entry => container.append(makeCard(entry.card, "market", entry.coins)));
    if (!view.market.length) {
      const empty = el("div", "startups-empty");
      empty.append(el("span", "", "↗"), el("div", "", "No shares on the market")); container.append(empty);
    }
    container.scrollTop = scroll;
    byId("Draw").disabled = !can("draw");
    text("Draw", `Draw · 💰 ${view.draw_cost ?? "—"}`);
    let hint = "";
    if (!view.hands_revealed && view.you === view.current_turn && view.phase === "take" && !view.legal_actions.includes("draw")) hint = "Not enough capital to draw. Take an available market share.";
    if (view.phase === "place" && view.you === view.current_turn && view.taken_company) hint = `${label(view.taken_company)} cannot be returned this turn.`;
    text("MarketHint", hint);
    byId("MarketHint").classList.toggle("hidden", !hint);
    const chosen = selection?.area === "market" ? view.market.find(entry => entry.card.id === selection.id) : null;
    byId("MarketSelection").classList.toggle("hidden", !chosen);
    container.inert = !!chosen;
    if (chosen) text("MarketLabel", `${label(chosen.card.company)} · 💰 +${chosen.coins}`);
    byId("Take").disabled = !chosen || !can("take_market");
  }
  function renderHand() {
    const container = byId("Hand"); container.replaceChildren();
    container.dataset.count = String(view.hand.length);
    view.hand.forEach(card => container.append(makeCard(card, "hand")));
    if (!view.hand.length) container.append(el("div", "startups-empty", "No private hand"));
    const own = view.players.find(player => player.player_id === view.you);
    text("Capital", own ? `💰 ${own.capital}` : "💰 —");
    text("HandTitle", view.hands_revealed ? "Revealed hand" : "Your hand");
    text("HandHint", view.hands_revealed ? "Included in the final holdings." : "");
    byId("HandHint").classList.toggle("hidden", !view.hands_revealed);
    const chosen = selection?.area === "hand" ? view.hand.find(card => card.id === selection.id) : null;
    byId("HandSelection").classList.toggle("hidden", !chosen);
    container.inert = !!chosen;
    if (chosen) text("HandLabel", label(chosen.company));
    byId("Invest").disabled = !chosen || !can("invest");
    byId("Discard").disabled = !chosen || !can("discard") || !view.legal_discard_ids.includes(chosen.id);
  }
  function renderPlayers() {
    const container = byId("Players"); container.replaceChildren();
    for (const [index, player] of view.players.entries()) {
      const node = el("article", "startups-player");
      node.classList.toggle("is-current", player.player_id === view.current_turn);
      node.classList.toggle("is-winner", view.winner_ids.includes(player.player_id));
      const heading = el("div", "startups-player-heading");
      const playerName = `#${index + 1} ${player.name || player.player_id}`;
      heading.append(tip(el("strong", "", playerName), "player", playerName), el("small", "", [player.player_id === view.you ? "You" : "", player.is_bot ? "Bot" : "", view.ready.includes(player.player_id) ? "Ready ✓" : player.player_id === view.current_turn ? "Turn" : ""].filter(Boolean).join(" · ")));
      const stats = el("div", "startups-player-stats");
      const handCount = tip(el("span", "", `🃏 ${player.hand_count}`), "hand", view.hands_revealed ? `Hand（🃏）：${player.hand.map(card => label(card.company)).join(" · ")}` : explainText("hand"));
      handCount.append(el("span", "startups-hand-visibility", view.hands_revealed ? " revealed" : " hidden"));
      stats.append(tip(el("span", "", `💰 ${view.hands_revealed ? player.round_score : player.capital}`), view.hands_revealed ? "wealth" : "capital"),
        handCount);
      if (view.config.rounds === 4) stats.append(tip(el("span", "", `🏆 ${player.match_points}`), "points"));
      const shares = el("div", "startups-shares");
      for (const c of view.companies) {
        const holder = view.anti_monopoly[c.id] === player.player_id;
        const count = player.shares[c.id], cell = tip(el("div", `startups-share su-${c.id}${count ? "" : " is-zero"}`, `${c.emoji} ${count}`), "portfolio", `${label(c.id)}：${count} 股${view.hands_revealed ? "（含手牌）" : "公开投资"}。${holder ? "持有反垄断标记（🚫）。" : ""}`);
        cell.append(el("span", "", holder ? " 🚫" : "")); shares.append(cell);
      }
      node.append(heading, stats, shares); container.append(node);
    }
  }
  function renderReview() {
    const summary = view.round_summary;
    byId("Review").classList.toggle("hidden", !summary);
    if (!summary) return;
    text("ReviewTitle", view.game_over ? "Final results" : `Round ${view.round_number} · Settlement`);
    text("Ready", view.game_over ? `Winner: ${view.winner_ids.map(name).join(" · ")}` : `${view.ready.length} / ${view.players.length} ready · Next round starts after everyone confirms.`);
    byId("Next").classList.toggle("hidden", view.game_over);
    byId("Next").disabled = !can("next_round");
    text("Next", view.ready.includes(view.you) ? "Ready ✓" : "Next Round");
    const container = byId("Scores"); container.replaceChildren();
    const rows = view.game_over && view.config.rounds === 4 ? view.final_ranking.map(id => summary.players.find(row => row.player_id === id)) : summary.players;
    for (const [index, row] of rows.entries()) {
      const node = el("article", "startups-score");
      const rank = view.game_over && view.config.rounds === 4 ? index + 1 : row.rank;
      node.append(el("strong", "", `${view.winner_ids.includes(row.player_id) ? "🏆 " : `#${rank} `}${name(row.player_id)}`),
        tip(el("span", "startups-score-total", view.config.rounds === 4 ? `${row.match_points} pts` : `${row.wealth}`), view.config.rounds === 4 ? "points" : "wealth"),
        tip(el("span", "", `💰 ${row.capital} − ${row.paid_chips} + ${row.income_chips} × 3 = ${row.wealth}`), "wealth"),
        tip(el("span", "", `🪙 ${row.income_chips} received · ${row.paid_chips} paid`), "income"));
      if (view.config.rounds === 4) node.append(tip(el("span", "", `Round #${row.rank} · ${row.award > 0 ? "+" : ""}${row.award} pts`), "points"));
      container.append(node);
    }
    const settlements = byId("Settlements"), scroll = settlements.scrollTop; settlements.replaceChildren();
    for (const row of summary.companies) {
      const node = el("div", ""); node.append(el("strong", "", label(row.company)));
      node.append(el("p", "", Object.entries(row.holdings).map(([id, count]) => `${name(id)} ${count}`).join(" · ")));
      node.append(el("p", "", row.winner_id ? `${name(row.winner_id)}: +${row.payments.reduce((sum, payment) => sum + payment.chips * 3, 0)} · ${row.payments.map(payment => `${name(payment.from)} pays ${payment.chips}`).join(" / ") || "No minority shareholders"}` : row.tied_ids.length ? "Tied majority · No payments" : "No shareholders · No payments"));
      settlements.append(node);
    }
    settlements.scrollTop = scroll;
  }
  function renderHistory() {
    const container = byId("History"), scroll = container.scrollTop; container.replaceChildren();
    for (const record of [...view.history].reverse()) {
      const action = record.type === "draw" ? `drew a hidden share · 💰 −${record.cost}` : record.type === "take_market" ? `took ${label(record.company)} · 💰 +${record.coins}` : `${record.type === "invest" ? "invested in" : "sent to market:"} ${label(record.company)}`;
      container.append(el("li", "", `${name(record.player_id)} ${action}`));
    }
    container.scrollTop = scroll;
    const scores = byId("ScoreHistory"), scoreScroll = scores.scrollTop; scores.replaceChildren();
    for (const round of view.score_history) {
      const node = el("div", ""); node.append(el("strong", "", `Round ${round.round_number}`));
      round.players.forEach(row => node.append(el("div", "", `${name(row.player_id)}: ${row.wealth}${view.config.rounds === 4 ? ` · ${row.award > 0 ? "+" : ""}${row.award} pts` : ""}`)));
      scores.append(node);
    }
    if (!view.score_history.length) scores.append(el("div", "", "No settled rounds yet."));
    scores.scrollTop = scoreScroll;
  }
  function render() {
    if (!view) return;
    text("Round", `Round ${view.round_number} / ${view.config.rounds}`); text("Deck", `🂠 ${view.deck_count}`);
    let status = view.you === view.current_turn ? `Your turn · ${view.phase === "take" ? "Take a share" : "Invest or send to market"}` : `${name(view.current_turn)} · ${view.phase === "take" ? "Taking a share" : "Placing a share"}`;
    if (view.phase === "round_review") status = "Round complete · Review the settlement";
    if (view.game_over) status = `Winner: ${view.winner_ids.map(name).join(" · ")}`;
    if (!socket.connected) status = "Disconnected · Reconnecting…";
    text("Status", status);
    document.body.classList.toggle("startups-needs-action", !view.game_over && view.you === view.current_turn && view.legal_actions.length > 0);
    renderCompanies(); renderMarket(); renderHand(); renderPlayers(); renderReview(); renderHistory();
  }
  function deselect() {
    if (!selection) return;
    const previous = selection, restoreFocus = document.activeElement?.closest(".startups-selection");
    selection = null;
    if (view) { renderMarket(); renderHand(); }
    if (restoreFocus) {
      const cards = byId(previous.area === "market" ? "Market" : "Hand").querySelectorAll("button");
      [...cards].find(card => card.dataset.cardId === previous.id)?.focus({preventScroll: true});
      hideTip();
    }
  }
  function dispatch(kind, extra = {}) {
    if (!can(kind)) return;
    const context = {game_token: view.game_token, round_number: view.round_number, turn_number: view.turn_number};
    pending = true; clearTimeout(pendingTimer); hideTip();
    pendingTimer = setTimeout(() => { pending = false; render(); }, 2500);
    render(); sendAction({type: kind, ...context, ...extra});
  }
  ["Market", "Hand"].forEach(suffix => byId(suffix).addEventListener("click", event => {
    const card = event.target.closest("button[data-card-id]");
    if (!card || card.disabled || (event.detail && pointerGesture?.moved)) return;
    selection = selection?.id === card.dataset.cardId ? null : {id: card.dataset.cardId, area: card.dataset.area};
    hideTip(); renderMarket(); renderHand();
    if (selection) byId(selection.area === "market" ? "Take" : "Invest").focus({preventScroll: true});
  }));
  byId("Draw").addEventListener("click", () => dispatch("draw"));
  byId("Take").addEventListener("click", () => { if (selection?.area === "market") dispatch("take_market", {card_id: selection.id}); });
  byId("Invest").addEventListener("click", () => { if (selection?.area === "hand") dispatch("invest", {card_id: selection.id}); });
  byId("Discard").addEventListener("click", () => { if (selection?.area === "hand") dispatch("discard", {card_id: selection.id}); });
  ["MarketCancel", "HandCancel"].forEach(suffix => byId(suffix).addEventListener("click", deselect));
  byId("Next").addEventListener("click", () => dispatch("next_round"));

  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function showTip(target, autoHide = false) {
    if (!target) return;
    clearTimeout(tipTimer); tooltip.textContent = target.dataset.suTip; tooltip.classList.remove("hidden");
    const rect = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${rect.bottom + box.height + 18 < innerHeight ? rect.bottom + 7 : Math.max(12, rect.top - box.height - 7)}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  document.addEventListener("pointerdown", event => {
    pointerGesture = {id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, active: true};
  }, true);
  document.addEventListener("pointermove", event => {
    if (pointerGesture?.id === event.pointerId && Math.hypot(event.clientX - pointerGesture.x, event.clientY - pointerGesture.y) > 8) pointerGesture.moved = true;
  }, {capture: true, passive: true});
  document.addEventListener("pointerup", () => { if (pointerGesture) pointerGesture.active = false; }, true);
  document.addEventListener("pointercancel", () => {
    if (pointerGesture) { pointerGesture.moved = true; pointerGesture.active = false; }
  }, true);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { hideTip(); deselect(); }
  }, true);
  document.addEventListener("click", event => {
    if (event.detail && pointerGesture?.moved) return;
    if (!panel.classList.contains("hidden") && !event.target.closest("button, input, select, dialog, summary, a")) deselect();
  });
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-su-tip]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-su-tip]")));
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("pointerdown", event => {
    const target = event.target.closest("button:disabled[data-su-tip]");
    if (target && event.pointerType !== "mouse") showTip(target, true);
  });
  panel.addEventListener("click", event => {
    // Actionable cards already have a selection panel; static information uses tips.
    const target = event.target.closest("[data-su-tip]");
    if (target && !target.closest("button")) showTip(target, true); else hideTip();
  });
  document.addEventListener("scroll", () => {
    if (pointerGesture?.active) pointerGesture.moved = true;
    hideTip();
  }, true);
  window.addEventListener("resize", hideTip); window.addEventListener("blur", hideTip);

  function clearState() {
    view = null; selection = null; pending = false; renderSignature = null; pointerGesture = null;
    document.body.classList.remove("startups-needs-action");
    ["Market", "Hand"].forEach(suffix => { byId(suffix).inert = false; });
    clearTimeout(pendingTimer);
    hideTip(); startupsExplainWidget?.exit(); startupsHelpWidget?.close();
    ["Companies", "Market", "Hand", "Players", "Scores", "Settlements", "History", "ScoreHistory"].forEach(suffix => byId(suffix).replaceChildren());
    ["MarketSelection", "HandSelection", "Review"].forEach(suffix => byId(suffix).classList.add("hidden"));
    ["Draw", "Take", "Invest", "Discard", "Next"].forEach(suffix => { byId(suffix).disabled = true; });
    text("Status", "Waiting to start"); text("Round", "Round —"); text("Deck", "🂠 —"); text("Capital", "💰 —");
    text("MarketHint", "The market starts empty."); text("HandHint", "Your shares will appear here.");
  }
  function syncConfig(state) {
    const visible = state?.game_type === "startups" && state.status === "lobby";
    configBox.classList.toggle("hidden", !visible); configBox.setAttribute("aria-hidden", String(!visible));
    if (state?.game_type !== "startups") return;
    const signature = JSON.stringify([state.room_id, state.game_config]);
    if (signature !== configSignature) { byId("Rounds").value = String(state.game_config?.rounds || 1); configSignature = signature; }
    if (visible && view) clearState();
  }
  window.getStartupsConfig = () => view && currentRoomState?.status !== "lobby" ? {...view.config} : {rounds: Number(byId("Rounds").value)};
  window.renderStartupsGameState = data => {
    if (data?.view?.game_id !== "startups" || currentGameType !== "startups") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const incoming = data.view;
    const signature = JSON.stringify([data.room_id, incoming.game_token, incoming.revision, incoming.you]);
    if (signature === renderSignature) return;
    if (!view || view.game_token !== incoming.game_token || view.round_number !== incoming.round_number || view.turn_number !== incoming.turn_number || view.phase !== incoming.phase) selection = null;
    pending = false; clearTimeout(pendingTimer); hideTip(); renderSignature = signature; view = incoming; render();
  };
  window.clearStartupsState = clearState;
  window.showStartupsHeaderActions = visible => {
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
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "startups") window.renderStartupsGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
