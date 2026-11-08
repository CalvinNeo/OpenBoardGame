const PONZI_SCHEME_HELP_CONFIG = {
  gameId: "ponzi_scheme",
  title: { zh: "庞氏骗局 · Ponzi Scheme", en: "Ponzi Scheme" },
  basic: {
    win: {
      zh: "赢法是不要破产：有人付不起利息时，当轮所有破产者立刻落败，活下来的玩家再按行业分和财富分（进阶模式改算奢侈品(💎)分）比出胜负。",
      en: "You win by staying solvent: as soon as somebody cannot pay their interest every player who went bankrupt that round loses at once, and the survivors are ranked by industry points plus wealth points, or luxury (💎) points in the advanced mode."
    },
    turn: {
      zh: "每一轮按顺序做四件事：所有人依次募资或 Pass，各自可以发起一次暗盘交易，新的起始玩家移除一张市场资金牌，最后时间前进并且全员一起付息。",
      en: "Every round runs in four steps: each player in turn funds an industry or passes, everyone may open one backroom trade, the new start player removes one fund card from the market, and finally time moves forward while everybody pays interest at the same time."
    },
    key: {
      zh: "重点是管住现金流，每张资金牌都会永久按周期收租，你要算准下一次付息之前手里还剩多少现金，并且尽量把债务周期错开。",
      en: "The key is managing cash flow, because every fund card charges rent forever on its own period. Work out how much cash you will still hold before the next payment and spread your debts across different periods."
    }
  },
  sections: [
    {
      id: "funding",
      label: { zh: "募资", en: "Funding" },
      html: {
        zh: "<p>开局时你没有现金也没有行业。按起始玩家顺序，每人要么取得一个行业加一张资金牌，要么 Pass。</p>"
          + "<p>取得之后同类行业有几个就只能拿市场第几行的资金牌，一个拿第 1 行，两个拿第 2 行，三个拿第 3 行。同类行业已经有三个或更多时不能再募资。</p>"
          + "<p>资金牌的本金立即进入你的私人金库并且只收一次，之后这张牌会按它的周期永远向你收利息。市场每被取走一张牌就立刻补到九张，并按本金从小到大重新排序。</p>",
        en: "<p>You start with no cash and no industries. In start-player order each player either takes one industry together with one fund card, or passes.</p>"
          + "<p>The row you may take from depends on how many industries of that type you will own afterwards: one takes row 1, two take row 2 and three take row 3. Once you already own three or more of a type you can no longer fund it.</p>"
          + "<p>The principal lands in your private vault immediately and is collected only once. From then on the card charges you interest forever on its own period. Whenever a card leaves the market it is refilled to nine cards and re-sorted by principal from low to high.</p>"
      }
    },
    {
      id: "trade",
      label: { zh: "暗盘交易", en: "Backroom trades" },
      html: {
        zh: "<p>每人每轮有一次发起暗盘交易的机会，也可以 Pass。你选择的行业必须是双方都拥有的，然后给出一个秘密的整数报价，零元同样合法。</p>"
          + "<p>报价会先从你的可用现金里托管进信封。接收者只有两个选择：卖出自己的一个该行业并收下这笔钱，或者按同样的价格反向买下你的一个该行业。没有拒绝，也没有还价。</p>"
          + "<p>卖出时钱归接收者，反买时托管的钱退还给你而接收者另付同额。行业会转移，但对应的债务留在原持有人身上，交易换来的行业也不受三个的上限约束。</p>",
        en: "<p>Each player may open one backroom trade per round, or pass. The industry you pick must be owned by both sides, and you name a secret whole-number offer, where zero is perfectly legal.</p>"
          + "<p>The offer is held in an envelope straight out of your available cash. The receiver has exactly two options: sell one of their own industries of that type and take the money, or buy one of yours at the same price. There is no refusing and no haggling.</p>"
          + "<p>Selling pays the receiver, while buying returns the held money to you and the receiver pays the same amount separately. The industry moves but its debts stay with the original owner, and industries gained by trade ignore the limit of three.</p>"
      }
    },
    {
      id: "market",
      label: { zh: "市场与崩盘", en: "Market and crash" },
      html: {
        zh: "<p>交易阶段结束后起始标记顺移一位，新的起始玩家从市场移除任意一张资金牌，然后补齐并重排。起始资金牌被移除后永久出局，其他牌进入弃牌堆。</p>"
          + "<p>如果调整之后市场里的熊牌(🐻)数量达到玩家人数，本轮就崩盘一次。市场里的熊牌、弃牌堆和剩余牌库混洗后重新补满市场，并且不会立刻再次崩盘。</p>"
          + "<p>崩盘时从新的起始玩家开始，每人归还一个自己数量最多的行业，并列时可以自选，没有行业就跳过。崩盘会让本轮时间前进两格。</p>",
        en: "<p>After the trading step the start marker passes to the next seat and the new start player removes any one fund card from the market before it is refilled and re-sorted. A starting fund card is out of the game for good, and every other card goes to the discard pile.</p>"
          + "<p>If the market then holds as many bear cards (🐻) as there are players, the round crashes once. The bear cards in the market, the discard pile and the rest of the deck are shuffled together to refill the market, and this cannot trigger a second crash right away.</p>"
          + "<p>On a crash, beginning with the new start player, everybody returns one industry of which they own the most, choosing freely on a tie and skipping if they own none. A crash also pushes time forward by two spaces this round.</p>"
      }
    },
    {
      id: "interest",
      label: { zh: "付息与破产", en: "Interest and bankruptcy" },
      html: {
        zh: "<p>通常时间前进一格，崩盘时前进两格。所有到期或者越过到期点的资金牌都只支付一次利息，所有玩家同时结算。</p>"
          + "<p>付得起的玩家扣掉现金，债务回到原来的周期继续循环，付不起的玩家破产。资金牌永远留在你手里，既不能提前付息，也不能偿清本金。</p>"
          + "<p>所有人的资金牌、利息、周期和到期位置都是公开信息，只有现金是秘密。破产的玩家失去获胜资格。</p>",
        en: "<p>Time normally moves forward one space and two spaces after a crash. Every fund card that is due or passed over pays its interest exactly once, and all players settle at the same time.</p>"
          + "<p>A player who can pay loses the cash and the debt returns to its original period to keep cycling, while a player who cannot pay goes bankrupt. Fund cards stay in your hands forever, and you can neither pay early nor clear the principal.</p>"
          + "<p>Everyone's fund cards, interest, periods and due positions are public information, and only cash is secret. A bankrupt player can no longer win.</p>"
      }
    },
    {
      id: "scoring",
      label: { zh: "计分与进阶", en: "Scoring and advanced" },
      html: {
        zh: "<p>每个行业的 n 个按 n(n+1)/2 计分，0 到 6 个分别对应 0、1、3、6、10、15、21 分，四类行业分别计算之后相加。</p>"
          + "<p>基础模式下剩余现金 0 到 29、30 到 55、56 到 77、78 到 95、96 以上分别得 0、1、2、3、4 分。同分时持有本金最大的资金牌者胜，再同分就共享胜利。</p>"
          + "<p>进阶模式下现金不计分，改为用一次发起交易的机会购买奢侈品(💎)。戒指(💍) 30 元 1 分，跑车(🚘) 56 元 2 分，游艇(🛥️) 78 元 3 分，城市(🏙️) 96 元 4 分，每件唯一而且不能转卖。</p>",
        en: "<p>Each industry scores n(n+1)/2 for the n you own, so zero to six are worth 0, 1, 3, 6, 10, 15 and 21 points, and the four industries are counted separately and added up.</p>"
          + "<p>In the basic mode leftover cash of 0 to 29, 30 to 55, 56 to 77, 78 to 95 and 96 or more scores 0, 1, 2, 3 and 4 points. Ties are broken by the highest principal fund card you hold, and a remaining tie shares the win.</p>"
          + "<p>In the advanced mode cash scores nothing and you may spend one trade opportunity on a luxury (💎) instead. The ring (💍) costs 30 for 1 point, the car (🚘) 56 for 2 points, the yacht (🛥️) 78 for 3 points and the city (🏙️) 96 for 4 points. Each one is unique and cannot be resold.</p>"
      }
    },
    {
      id: "round",
      label: { zh: "轮次流程", en: "Round flow" },
      html: {
        zh: "<p>一轮的完整流程是募资、暗盘交易、市场调整、崩盘检查、付息结算。每轮结算之后游戏暂停，所有席位分别点击 Next Round 才继续，掉线的人不会自动确认。</p>"
          + "<p>公共日志只记录行业的流向，不公开秘密报价。Private trades 只显示你本人参与过的金额，Debts 可以展开查看每一张债务的利息和到期位置。</p>",
        en: "<p>A full round is funding, backroom trading, market adjustment, the crash check and the interest settlement. After the settlement the game pauses and every seat confirms Next Round separately before play continues, so a disconnected player never confirms automatically.</p>"
          + "<p>The public log records only which industries moved and never the secret offers. Private trades shows just the amounts of deals you took part in, and Debts expands to list the interest and due position of every single debt.</p>"
      }
    }
  ]
};

const PONZI_SCHEME_EXPLAIN = {
  fund: {
    zh: "同时选择一个行业和一张资金牌。取得后该行业有 1、2、3 个时必须取市场第 1、2、3 行。立即收本金，之后永久按周期付息。同类已有三个或更多就不能再募资取得。",
    en: "Pick an industry and a fund card together. Owning 1, 2 or 3 of that industry after the deal forces you to take row 1, 2 or 3 of the market. The principal arrives at once and the card charges interest forever on its period. You cannot fund a type you already own three or more of."
  },
  market: {
    zh: "市场按本金从小到大排列，三行各三张，每取走一张就立即补充并重排。蓝色起始牌被移除时永久出局。红色熊牌仍然可以募资，但会计入市场崩盘数量。",
    en: "The market is sorted by principal from low to high in three rows of three, and any card taken away is replaced and re-sorted at once. A blue starting card removed from the market leaves the game for good. A red bear card can still be funded but it counts towards the crash."
  },
  industry: {
    zh: "各行业分别按数量计分，1、2、3、4、5 个分别是 1、3、6、10、15 分。交易可以突破三个的募资上限。行业有独立颜色和图标，功能完全相同。",
    en: "Each industry scores on its own count, where 1, 2, 3, 4 and 5 are worth 1, 3, 6, 10 and 15 points. Trading can push you past the funding limit of three. The industries have their own colours and icons but work identically."
  },
  trade: {
    zh: "双方必须都拥有所选行业。报价只给参与者看，发起时就放入信封托管。对方必须卖出一个该行业，或者以相同价格反向买入你的一个该行业，不能拒绝也不能改价。零元报价合法。",
    en: "Both sides must own the industry you choose. The offer is visible only to the two of you and is held in an envelope from the moment it is made. The other player must sell one industry of that type or buy one of yours at the same price, with no refusing and no counter-offer. An offer of zero is legal."
  },
  sell: {
    zh: "收下信封里的钱，交出一个约定的行业。该行业对应的债务仍然留在原持有人处，不会跟着行业转移。",
    en: "Take the money in the envelope and hand over one industry of the agreed type. The debts tied to that industry stay with the original owner and never travel with it."
  },
  buy: {
    zh: "另外支付与报价相同的钱买入对方的一个行业。原信封里的钱也会退还给对方，对方净收一次报价。余额不足时你只能选择卖出。",
    en: "Pay the same amount as the offer to buy one of the other player's industries. The money in the envelope is returned to them as well, so they receive the offer exactly once. If you cannot afford it, selling is your only option."
  },
  remove: {
    zh: "你刚收到起始标记。选择任意一张市场资金牌移除，再补牌，随后检查崩盘。移除起始牌会让它永久出局，其他牌进入弃牌堆。",
    en: "You have just received the start marker. Remove any one fund card from the market, refill it, and then check for a crash. A removed starting card leaves the game for good and every other card goes to the discard pile."
  },
  crash: {
    zh: "市场熊牌达到玩家人数时本轮崩盘一次，市场熊牌、弃牌堆和剩余牌库混洗。按照新起始玩家的顺序，各人归还一个自己数量最多的行业，并列时自选。时间前进两格，越过到期点的债务也要付款一次。",
    en: "When the market holds as many bear cards as there are players the round crashes once and the market bears, the discard pile and the rest of the deck are shuffled. In new start-player order everybody returns one industry they own the most of, choosing freely on a tie. Time moves forward two spaces and any debt passed over still pays once."
  },
  luxury: {
    zh: "进阶模式中，可以用一次发起交易的机会购买一件市场奢侈品。每件唯一，不能转卖，结束时增加所示分数。进阶模式的现金不计分。",
    en: "In the advanced mode you may spend one opportunity to open a trade on a luxury instead. Each one is unique, cannot be resold and adds the points shown at the end. Cash scores nothing in the advanced mode."
  },
  pass: {
    zh: "只跳过本次募资或发起交易的机会。你的债务仍然存在，市场调整之后会照常推进时间与付息。收到暗盘报价之后不能 Pass。",
    en: "This only skips your chance to fund or to open a trade. Your debts stay in place and time still advances and charges interest after the market adjustment. You cannot pass once you have received a backroom offer."
  },
  confirm: {
    zh: "确认当前选择并交给服务器验证。按钮变灰时请先选择合法的行业、卡牌或交易对象，并检查现在是否轮到你。",
    en: "Confirm the current selection and hand it to the server for validation. When the button is greyed out, choose a legal industry, card or trading partner first and check that it is actually your turn."
  },
  next: {
    zh: "本轮付息之后暂停供全员回顾。每个席位各自点击 Next Round，所有人确认之后才继续。掉线的人不会自动确认。",
    en: "The game pauses after the interest payment so everyone can review. Each seat presses Next Round separately and play resumes only once everybody has confirmed. A disconnected player never confirms automatically."
  },
  debt: {
    zh: "所有人的资金牌、利息、周期和到期位置都是公开的。1 格内和 2 格内分别表示正常推进与崩盘时要支付的总额。付息之后回到原周期，不会偿清本金也不会消除债务。",
    en: "Everyone's fund cards, interest, periods and due positions are public. Within 1 space and within 2 spaces show what you owe on a normal advance and on a crash. After paying, the debt returns to its original period, and the principal is never cleared."
  },
  history: {
    zh: "公共日志只记录行业流向，不公开秘密报价。Private trades 只显示你本人参与过的金额。现金只有本人可见。",
    en: "The public log records only which industries moved and never the secret offers. Private trades shows just the deals you were involved in, and cash is visible to its owner alone."
  },
  help: {
    zh: "打开庞氏骗局的完整规则说明，包含募资、暗盘交易、市场崩盘、付息破产和计分方式。",
    en: "Open the full Ponzi Scheme rules: funding, backroom trades, market crashes, interest and bankruptcy, and how the final score is counted."
  },
  explain: {
    zh: "打开解释模式之后再点界面上的任意控件，就会显示这个控件的说明。解释模式下不会执行任何游戏动作，按 Esc 可以退出。",
    en: "Turn on explain mode and then tap any control to read what it does. No game action is ever performed in explain mode and Esc leaves it."
  }
};

let ponziSchemeHelpWidget = null;
let ponziSchemeExplainWidget = null;

(() => {
    "use strict";
    const panel = document.getElementById("ponziSchemePanel");
    const header = document.getElementById("ponziSchemeHeaderActions");
    const helpButton = document.getElementById("ponziSchemeHelpBtn");
    const explainButton = document.getElementById("ponziSchemeExplainBtn");
    const dialog = document.getElementById("ponziSchemeDialog");
    const dialogTitle = document.getElementById("ponziSchemeDialogTitle");
    const dialogBody = document.getElementById("ponziSchemeDialogBody");
    const dialogClose = document.getElementById("ponziSchemeDialogClose");
    const phaseNames = {funding: "募资", trading: "暗盘交易", trade_response: "打开信封", market_remove: "调整市场", crash_discard: "市场崩盘", round_end: "本轮结算", game_over: "最终结算"};
    let view = null;
    let signature = null;
    let selectedIndustry = null;
    let selectedCard = null;
    let selectedTarget = null;
    let amount = "0";
    let pending = false;
    let pendingTimer = null;
    let returnFocus = null;
    const immediateTip = document.createElement("div");
    immediateTip.id = "ponziSchemeImmediateTip";
    immediateTip.className = "ponzi-scheme-immediate-tip";
    immediateTip.hidden = true;
    document.body.appendChild(immediateTip);
    let tipAnchor = null;
    let tipTimer = null;
    let tipHideTimer = null;
    let touchStart = null;
    let selectionPointer = null;
    let inputKind = "mouse";
    const openDetails = new Set();
    const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
    const own = () => view?.players.find(player => player.player_id === view.you);
    const name = pid => view.players.find(player => player.player_id === pid)?.name || "—";
    const available = type => !pending && view?.legal_actions.includes(type);
    const industryLabel = key => `${view.industry_defs[key].icon} ${view.industry_defs[key].name}`;
    const button = (label, action, explain, disabled = false, attributes = "") => `<button type="button" data-ps-action="${action}" data-ps-explain="${explain}" ${disabled ? "disabled" : ""} ${attributes}>${label}</button>`;

    function initPonziSchemeHelpExplain() {
        if (ponziSchemeHelpWidget || typeof window.obgCreateHelp !== "function") return;
        ponziSchemeHelpWidget = window.obgCreateHelp(PONZI_SCHEME_HELP_CONFIG);
        ponziSchemeExplainWidget = window.obgCreateExplain({
            gameId: "ponzi_scheme",
            attribute: "data-ps-explain",
            explanations: PONZI_SCHEME_EXPLAIN,
            button: explainButton,
            root: () => panel,
            bypass: ["#ponziSchemeHelpBtn", "#ponziSchemeExplainBtn"],
            onChange: active => { if (active) hideImmediateTip(); }
        });
        helpButton?.addEventListener("click", () => {
            ponziSchemeExplainWidget?.exit();
            ponziSchemeHelpWidget.open();
        });
        explainButton?.addEventListener("click", () => ponziSchemeExplainWidget?.toggle());
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPonziSchemeHelpExplain);
    } else {
        initPonziSchemeHelpExplain();
    }

    const explaining = () => Boolean(ponziSchemeExplainWidget?.isActive());

    function resetSelection() {
        selectedIndustry = null; selectedCard = null; selectedTarget = null; amount = "0";
    }

    function candidate() {
        if (available("fund")) return view.fund_options.find(option => option.industry === selectedIndustry && option.card_id === selectedCard) || null;
        if (available("remove_fund") && selectedCard) return {type: "remove_fund", card_id: selectedCard};
        if (available("discard_industry") && view.crash_choices.includes(selectedIndustry)) return {type: "discard_industry", industry: selectedIndustry};
        if (available("offer_trade") && selectedTarget && selectedIndustry && /^\d+$/.test(amount)) {
            const value = Number(amount);
            const legalTarget = view.trade_targets.some(target => target.target === selectedTarget && target.industry === selectedIndustry);
            if (legalTarget && Number.isSafeInteger(value) && value <= own().cash) return {type: "offer_trade", target: selectedTarget, industry: selectedIndustry, amount: value};
        }
        return null;
    }

    function confirmLabel() {
        const action = candidate();
        if (!action) return pending ? "Sending…" : "Confirm";
        if (action.type === "fund") {
            const card = view.market.find(item => item.id === action.card_id);
            return `募资 💵 ${card.principal} · ${industryLabel(action.industry)}`;
        }
        if (action.type === "offer_trade") return `Send offer · 💵 ${action.amount}`;
        if (action.type === "remove_fund") return `移除 💵 ${view.market.find(card => card.id === selectedCard).principal}`;
        return `归还 ${industryLabel(action.industry)} ×1`;
    }

    function cardHTML(card, index) {
        const canFund = available("fund") && view.fund_options.some(option => option.card_id === card.id && (!selectedIndustry || option.industry === selectedIndustry));
        const canSelect = canFund || available("remove_fund");
        return button(`<span class="ponzi-scheme-card-kind">${card.bear ? "🐻 熊市" : card.starting ? "起始资金" : "资金"}</span>
            <strong class="ponzi-scheme-principal">${card.principal}</strong><span class="ponzi-scheme-card-caption">💵 立即获得</span>
            <span class="ponzi-scheme-card-terms"><span>利息 <b>${card.interest}</b></span><span>⏳ 每 ${card.period} 格</span></span>`,
            "card", "market", !canSelect,
            `class="ponzi-scheme-fund ${card.bear ? "is-bear" : card.starting ? "is-starting" : ""} ${selectedCard === card.id ? "is-selected" : ""}" data-card="${card.id}" data-row="${Math.floor(index / 3) + 1}" aria-pressed="${selectedCard === card.id}" aria-label="资金 ${card.principal}，每 ${card.period} 格付息 ${card.interest}${card.bear ? '，熊牌' : ''}"`);
    }

    function marketHTML() {
        return `<section class="ponzi-scheme-market ponzi-scheme-box"><div class="ponzi-scheme-section-head"><h3>📈 资金市场</h3><span>本金 ↑ · ${view.deck_count} cards left</span></div>
            <div class="ponzi-scheme-market-rows">${[0, 1, 2].map(row => `<div class="ponzi-scheme-market-row ${selectedIndustry && own()?.industries[selectedIndustry] === row && available("fund") ? "is-eligible" : ""}">
                <div class="ponzi-scheme-row-title"><b>${row + 1}</b><span>第 ${row + 1} 个<br />同类行业</span></div>
                <div class="ponzi-scheme-market-cards">${view.market.slice(row * 3, row * 3 + 3).map((card, i) => cardHTML(card, row * 3 + i)).join("")}</div></div>`).join("")}</div>
            <p class="ponzi-scheme-hint">先选行业，再选对应行资金牌；本金只收一次，利息循环支付。</p>
            <div class="ponzi-scheme-supply">${Object.entries(view.industry_defs).map(([key, spec]) => `<span class="ponzi-scheme-chip ponzi-scheme-${spec.color}">${spec.icon} ${spec.name} <b>${view.supply[key]}</b></span>`).join("")}</div></section>`;
    }

    function industryChoices(keys, mode) {
        return `<div class="ponzi-scheme-industry-choices">${keys.map(key => {
            const spec = view.industry_defs[key];
            const count = own()?.industries[key] || 0;
            const enabled = mode !== "fund" || view.fund_options.some(option => option.industry === key);
            return button(`<span>${spec.icon} ${spec.name}</span><small>${mode === "fund" ? `${count} → ${count + 1} 个${count >= 3 ? ' · 已达上限' : ` · 第 ${count + 1} 行`}` : `持有 ${count} 个`}</small>`, "industry", mode === "crash" ? "crash" : "industry", !enabled || pending,
                `class="ponzi-scheme-industry ponzi-scheme-${spec.color} ${selectedIndustry === key ? "is-selected" : ""}" data-industry="${key}" aria-pressed="${selectedIndustry === key}"`);
        }).join("")}</div>`;
    }

    function tradeHTML() {
        const targets = [...new Set(view.trade_targets.map(option => option.target))];
        const keys = [...new Set(view.trade_targets.filter(option => option.target === selectedTarget).map(option => option.industry))];
        return `<p class="ponzi-scheme-hint">选择交易对象与共同拥有的行业。报价对方必须接受或同价反买。</p>
            <div class="ponzi-scheme-targets">${targets.map(pid => button(esc(name(pid)), "target", "trade", pending, `class="${selectedTarget === pid ? "is-selected" : ""}" data-target="${esc(pid)}" aria-pressed="${selectedTarget === pid}"`)).join("")}</div>
            ${keys.length ? industryChoices(keys, "trade") : ""}
            <label class="ponzi-scheme-price" for="ponziSchemeOfferAmount"><span>💵 秘密报价</span><input id="ponziSchemeOfferAmount" type="number" inputmode="numeric" min="0" max="${own().cash}" step="1" value="${esc(amount)}" ${pending ? "disabled" : ""} /></label>
            <div class="ponzi-scheme-price-buttons">${[-5, -1, 1, 5].map(delta => button(delta > 0 ? `+${delta}` : String(delta), "amount", "trade", pending, `data-delta="${delta}"`)).join("")}</div>
            <p class="ponzi-scheme-hint ponzi-scheme-trade-budget">可用 💵 ${own().cash} · 报价先托管，只有双方可见。</p>`;
    }

    function offerHTML() {
        const offer = view.offer;
        if (!offer) return "";
        const involved = Object.hasOwn(offer, "amount");
        const responding = available("respond_trade");
        return `<div class="ponzi-scheme-envelope"><span class="ponzi-scheme-envelope-icon">✉️</span><strong>${esc(name(offer.source))} → ${esc(name(offer.target))}</strong>
            <span>${industryLabel(offer.industry)} ×1</span><b class="ponzi-scheme-offer-value">${involved ? `💵 ${offer.amount}` : "🔒 Secret offer"}</b>
            <p>${responding ? "选择卖出你的行业，或按同价反买对方行业。" : `Waiting for ${esc(name(offer.target))}`}</p>
            ${responding ? `<div class="ponzi-scheme-two-buttons">${button(`Sell · +${offer.amount}`, "sell", "sell")}${button(`Buy · −${offer.amount}`, "buy", "buy", own().cash < offer.amount)}</div>
                ${own().cash < offer.amount ? '<small>现金不足以反买，请选择 Sell。</small>' : ""}` : ""}
            ${offer.source === view.you ? `<small>💵 ${offer.amount} 已放入信封，未计入可用现金。</small>` : ""}</div>`;
    }

    function luxuryHTML() {
        if (!view.advanced) return `<p class="ponzi-scheme-hint ponzi-scheme-wealth">💎 现金计分：30 / 56 / 78 / 96 → 1 / 2 / 3 / 4 分</p>`;
        return `<div class="ponzi-scheme-luxuries"><h4>💎 奢侈品</h4><div class="ponzi-scheme-luxury-grid">${Object.entries(view.luxury_defs).map(([key, spec]) => {
            const sold = !view.luxuries.includes(key);
            return button(`<span>${spec.icon} ${spec.name}</span><small>${sold ? "Sold" : `💵 ${spec.cost} · ${spec.points} 分`}</small>`, "luxury", "luxury", sold || !available("buy_luxury") || own().cash < spec.cost, `data-luxury="${key}"`);
        }).join("")}</div></div>`;
    }

    function actionHTML() {
        let content = "";
        if (available("fund")) content = industryChoices(Object.keys(view.industry_defs), "fund");
        else if (available("offer_trade")) content = tradeHTML();
        else if (available("remove_fund")) content = '<p>从左侧市场点选一张资金牌，确认移除。</p>';
        else if (available("discard_industry")) content = `<p>归还一个数量最多的行业：</p>${industryChoices(view.crash_choices, "crash")}`;
        else if (view.phase === "round_end") {
            const ready = view.next_ready.includes(view.you);
            content = `<p>请回顾本轮结算，所有人确认后继续。</p>${button(ready ? "✓ Ready" : "Next Round", "next", "next", !available("next_round"), 'class="ponzi-scheme-primary"')}
                <p class="ponzi-scheme-hint">${view.next_ready.length} / ${view.players.length} ready<br />Waiting: ${view.players.filter(player => !view.next_ready.includes(player.player_id)).map(player => esc(player.name)).join(" · ") || "—"}</p>`;
        } else if (view.game_over) content = '<p>本局结束。胜者由存活玩家的行业和财富／奢侈品总分决定。</p>';
        else if (view.phase !== "trade_response") content = `<p>Waiting for ${esc(name(view.current_turn))}</p>`;
        const selecting = ["fund", "offer_trade", "remove_fund", "discard_industry"].some(type => view.legal_actions.includes(type));
        return `<section class="ponzi-scheme-box ponzi-scheme-action"><div class="ponzi-scheme-section-head"><h3>${view.current_turn === view.you ? "Your turn" : "Action"}</h3><span>${phaseNames[view.phase]}</span></div>
            ${view.phase === "trade_response" ? offerHTML() : content}
            ${selecting ? button(confirmLabel(), "confirm", "confirm", !candidate(), 'id="ponziSchemeConfirm" class="ponzi-scheme-primary"') : ""}
            ${view.legal_actions.includes("pass") ? button("Pass", "pass", "pass", pending, 'class="ponzi-scheme-pass"') : ""}
            ${view.phase === "trading" && !view.trade_targets.length && view.current_turn === view.you ? '<p class="ponzi-scheme-hint">没有可交易的共同行业。</p>' : ""}
            ${luxuryHTML()}</section>`;
    }

    function cashHTML() {
        const player = own();
        if (!player) return "";
        return `<section class="ponzi-scheme-cash"><div><span>🔒 私人金库</span><strong>💵 ${player.cash}</strong></div>
            <div class="ponzi-scheme-pressure"><span>正常付息 <b class="${player.cash < player.due_next ? "is-danger" : ""}">${player.due_next}</b></span><span>若崩盘 <b class="${player.cash < player.due_crash ? "is-danger" : ""}">${player.due_crash}</b></span></div>
            <small>${player.cash < player.due_next ? "⚠ 现金不足以支付下一次正常到期利息" : "⏳ 当前债务预测 · 未包含尚未取得的资金牌"}</small></section>`;
    }

    function debtsHTML(player) {
        return `<div class="ponzi-scheme-debt-track">${[1, 2, 3, 4, 5].map(step => {
            const cards = player.debts.filter(card => card.remaining === step);
            return `<div class="${step <= 2 && cards.length ? "is-due" : ""}"><small>${step} 格</small><b>${cards.reduce((sum, card) => sum + card.interest, 0)}</b></div>`;
        }).join("")}</div><details data-ps-details="debt-${esc(player.player_id)}" ${openDetails.has(`debt-${player.player_id}`) ? "open" : ""}>
            <summary data-ps-explain="debt">Debts · ${player.debts.length} cards</summary><div class="ponzi-scheme-debt-list">${player.debts.length ? player.debts.map(card => `<div><span>${card.bear ? "🐻" : "💵"} ${card.principal}</span><span>利息 ${card.interest} / ${card.period} 格</span><b>${card.remaining === 0 ? "到期" : `${card.remaining} 格后`}</b></div>`).join("") : '<p class="ponzi-scheme-hint">暂无债务</p>'}</div></details>`;
    }

    function playersHTML() {
        return `<section class="ponzi-scheme-portfolios"><div class="ponzi-scheme-section-head"><h3>🏢 产业与债务</h3><span>行业和债务公开 · 现金保密</span></div>
            <div class="ponzi-scheme-players">${view.players.map(player => `<article class="ponzi-scheme-player ${player.player_id === view.current_turn ? "is-active" : ""} ${player.bankrupt ? "is-bankrupt" : ""}">
                <div class="ponzi-scheme-player-heading"><h4>${esc(player.name)} ${player.player_id === view.you ? '<small>You</small>' : ""}</h4><span>${player.bankrupt ? "💥" : player.player_id === view.start_player ? "🖋️" : player.is_bot ? "🤖" : ""}</span></div>
                <div class="ponzi-scheme-portfolio-value"><strong>${player.industry_points} <small>行业分</small></strong><span>${player.player_id === view.you ? `💵 ${player.cash}` : "🔒 Private"}</span></div>
                <div class="ponzi-scheme-player-industries">${Object.entries(view.industry_defs).map(([key, spec]) => `<span class="ponzi-scheme-chip ponzi-scheme-${spec.color}">${spec.icon} ${spec.name} <b>${player.industries[key]}</b></span>`).join("")}</div>
                ${player.luxuries.length ? `<div class="ponzi-scheme-owned-luxuries">${player.luxuries.map(lid => `${view.luxury_defs[lid].icon} +${view.luxury_defs[lid].points}`).join(" · ")}</div>` : ""}
                ${debtsHTML(player)}</article>`).join("")}</div></section>`;
    }

    function reviewHTML() {
        if (!["round_end", "game_over"].includes(view.phase) || !view.last_round) return "";
        const summary = view.last_round;
        return `<section class="ponzi-scheme-box ponzi-scheme-review"><div class="ponzi-scheme-section-head"><h3>${view.game_over ? "🏁 最终结算" : "⏸ 本轮结算"}</h3><span>${summary.crashed ? "🐻 崩盘 · 前进 2 格" : "⏳ 前进 1 格"}</span></div>
            ${view.game_over ? `<p class="ponzi-scheme-winner">${view.winner.length ? `🏆 ${view.winner.map(pid => esc(name(pid))).join(" · ")}` : "全员破产 · 无人获胜"}</p><div class="ponzi-scheme-scoreboard">${view.results.map(result => `<div class="ponzi-scheme-result ${result.bankrupt ? "is-bankrupt" : ""}"><strong>${esc(name(result.player_id))}</strong><span>${result.bankrupt ? "💥 破产" : `⭐ ${result.total} 分`}</span><small>行业 ${result.industry_points} + ${view.advanced ? `奢侈品 ${result.luxury_points}` : `财富 ${result.wealth_points}`} · 最大资金 ${result.highest_fund}</small></div>`).join("")}</div>` : ""}
            <div class="ponzi-scheme-payments">${summary.payments.map(payment => `<span>${esc(name(payment.player_id))}<b>${payment.bankrupt ? "💥 无法支付" : "✓ 已付"} 💵 ${payment.due}</b></span>`).join("")}</div>
            <details data-ps-details="review" ${openDetails.has("review") ? "open" : ""}><summary>Round details</summary><ol class="ponzi-scheme-log">${summary.notes.map(note => `<li>${esc(note)}</li>`).join("")}</ol></details></section>`;
    }

    function historyHTML() {
        return `<section class="ponzi-scheme-box ponzi-scheme-history"><details data-ps-details="history" ${openDetails.has("history") ? "open" : ""}><summary data-ps-explain="history">Activity · ${view.log.length}</summary>
            <ol class="ponzi-scheme-log">${view.log.slice().reverse().map(line => `<li>${esc(line)}</li>`).join("")}</ol></details>
            <details data-ps-details="private" ${openDetails.has("private") ? "open" : ""}><summary data-ps-explain="history"><span class="ponzi-scheme-private-lock">🔒</span> Private trades · ${view.private_trades.length}</summary><ul class="ponzi-scheme-log">${view.private_trades.slice().reverse().map(trade => `<li>Round ${trade.round} · ${esc(name(trade.seller))} → ${esc(name(trade.buyer))}<br />${industryLabel(trade.industry)} · 💵 ${trade.amount}</li>`).join("") || '<li>暂无记录</li>'}</ul></details></section>`;
    }

    function render() {
        if (!view) return;
        hideImmediateTip();
        panel.innerHTML = `<div class="ponzi-scheme-shell">
            <div class="ponzi-scheme-masthead"><span class="ponzi-scheme-eyebrow">${view.advanced ? "ADVANCED" : "BASIC"}</span><div class="ponzi-scheme-round"><span>Round</span><strong>${view.round}</strong></div></div>
            <div class="ponzi-scheme-status" role="status"><div><b>${phaseNames[view.phase]}</b><span>${view.current_turn ? `${view.current_turn === view.you ? "Your turn" : "Waiting for"} · ${esc(name(view.current_turn))}` : view.game_over ? "Game over" : `${view.next_ready.length} / ${view.players.length} ready`}</span></div><span class="ponzi-scheme-bears ${view.bear_count >= view.players.length ? "is-danger" : ""}">🐻 ${view.bear_count} / ${view.players.length} 崩盘</span></div>
            ${reviewHTML()}<div class="ponzi-scheme-layout"><div>${marketHTML()}</div><aside class="ponzi-scheme-sidebar">${cashHTML()}${actionHTML()}${historyHTML()}</aside></div>${playersHTML()}
            <p class="ponzi-scheme-footer">72 张资金牌 · 16 张熊牌 · ${view.first_round_trading ? "首轮可交易" : "首轮跳过交易"} · ${view.advanced ? "进阶：现金不计分" : "基础：现金最多 4 分"}</p></div>`;
        decorateTips();
    }

    function describeCard(card) {
        return `${card.bear ? "熊市资金牌" : card.starting ? "起始资金牌" : "资金牌"}：本金 ${card.principal} 单位现金立即到账，此后每 ${card.period} 格支付 ${card.interest} 单位利息。${card.bear ? "留在市场的熊牌计入崩盘数量。" : card.starting ? "从市场移除后永久出局。" : "付息后债务继续循环。"}`;
    }

    function addTip(target, text) {
        if (!target) return;
        target.dataset.psTip = text;
        target.setAttribute("tabindex", "0");
        target.setAttribute("aria-label", text);
        if (target.tagName !== "BUTTON") target.setAttribute("role", "button");
    }

    function decorateTips() {
        const mark = (selector, text) => panel.querySelectorAll(selector).forEach(target => addTip(target, text));
        mark(".ponzi-scheme-round", "轮数：当前进行的完整轮次。每轮募资、交易、调整市场并支付到期利息，直到出现破产。 ");
        mark(".ponzi-scheme-bears", "熊市预警：前一个数字是市场熊牌张数，后一个是玩家人数。调整市场后达到人数就崩盘，本轮时间会前进两格。");
        mark(".ponzi-scheme-status > div > b", `当前阶段：${phaseNames[view.phase]}。${({funding: PONZI_SCHEME_EXPLAIN.fund.zh, trading: PONZI_SCHEME_EXPLAIN.trade.zh, trade_response: PONZI_SCHEME_EXPLAIN.trade.zh, market_remove: PONZI_SCHEME_EXPLAIN.remove.zh, crash_discard: PONZI_SCHEME_EXPLAIN.crash.zh, round_end: PONZI_SCHEME_EXPLAIN.next.zh, game_over: "破产者出局，存活者按行业及财富／奢侈品计分。"})[view.phase]}`);
        mark(".ponzi-scheme-market h3", "资金市场：九张公开资金牌，按本金从小到大排成三行。根据取得行业后的数量选择对应行。");
        mark(".ponzi-scheme-cash > div:first-child > span, .ponzi-scheme-cash strong", "私人现金：只有你能看到的可用余额，单位为现金。用于暗盘交易、购买奢侈品及支付利息；已放入信封的金额暂不计入余额。");
        panel.querySelectorAll(".ponzi-scheme-pressure > span").forEach((target, index) => addTip(target,
            index ? "崩盘付息预测：当前债务在时间前进两格时要支付的现金总额。包括越过到期点的牌，每张只付一次。" : "正常付息预测：当前债务在时间前进一格时要支付的现金总额，零表示没有当前到期债务。"));
        mark(".ponzi-scheme-cash > small", "债务预测：根据当前已取得的资金牌计算。尚未募资的新牌不包含在内；交易与新募资会改变你的支付能力。");
        mark(".ponzi-scheme-wealth", "基础财富分：结束时剩余现金达到 30／56／78／96，分别得 1／2／3／4 分；最多 4 分。破产玩家不能获胜。");
        mark(".ponzi-scheme-price > span", "秘密报价：单位为现金，允许零元。加减按钮仅调整金额，点击 Send offer 才发送。发起时先托管，只有交易双方看到金额。");
        mark(".ponzi-scheme-trade-budget, .ponzi-scheme-envelope > small", "交易可用现金：放入信封的报价暂不计入可用余额。卖出时接收者拿到报价；反买时原报价退给发起者，接收者另付相同金额。");
        mark(".ponzi-scheme-private-lock", PONZI_SCHEME_EXPLAIN.history.zh);
        mark(".ponzi-scheme-envelope > span:not(.ponzi-scheme-envelope-icon)", view.offer ? `${view.industry_defs[view.offer.industry].name}产业：本次信封交易一个该行业。${PONZI_SCHEME_EXPLAIN.trade.zh}` : "");
        mark(".ponzi-scheme-market .ponzi-scheme-section-head > span, .ponzi-scheme-row-title", "市场排序与行号：本金从小到大排列。取得后的同类行业数量决定可选的第 1／2／3 行；cards left 表示尚未抽出的牌库张数。");
        mark(".ponzi-scheme-portfolios h3", "产业与公开债务：展示每名玩家的行业数量及循环利息，现金和暗盘价格保密。");
        mark(".ponzi-scheme-luxuries h4", PONZI_SCHEME_EXPLAIN.luxury.zh);
        mark(".ponzi-scheme-envelope-icon, .ponzi-scheme-offer-value", "秘密交易信封：显示双方约定的现金报价，只有参与者能看到金额；其他人只看到交易对象及行业。");
        mark(".ponzi-scheme-review h3, .ponzi-scheme-review .ponzi-scheme-section-head > span", "本轮结算：崩盘时推进两格，否则推进一格。所有人同时付息后在此回顾结果，全员 Next Round 才继续。");
        mark(".ponzi-scheme-winner", "获胜玩家：未破产玩家中总分最高者胜，同分比较持有资金牌的最高本金。全员破产时无人获胜。");
        const keys = Object.keys(view.industry_defs);
        panel.querySelectorAll(".ponzi-scheme-supply .ponzi-scheme-chip").forEach((target, index) => addTip(target,
            `${view.industry_defs[keys[index]].name}行业库存：${view.supply[keys[index]]} 个可供募资。每人同类行业不满三个时可取得一个，崩盘弃置会回到库存。`));
        panel.querySelectorAll(".ponzi-scheme-player").forEach((target, index) => {
            const player = view.players[index];
            const status = target.querySelector(".ponzi-scheme-player-heading > span");
            if (status.textContent) addTip(status, player.bankrupt ? "破产：无法全额支付本轮利息，失去获胜资格。" : player.player_id === view.start_player ? "起始玩家标记：本轮从该玩家开始。交易结束后交给下一位，由新持有人移除一张市场资金牌。" : "机器人玩家：只依据公开局面和自己的私人信息进行操作。");
            addTip(target.querySelector(".ponzi-scheme-portfolio-value > strong"), "行业分：四类行业分别按 n(n+1)/2 计分后相加，尚未包含财富或奢侈品分数。");
            addTip(target.querySelector(".ponzi-scheme-portfolio-value > span"), player.player_id === view.you ? "你的私人现金：可用于报价、反买和付息，其他玩家看不到这个余额。" : "私人现金已隐藏：其他玩家的现金数额属于秘密信息。");
            target.querySelectorAll(".ponzi-scheme-player-industries > span").forEach((chip, i) => addTip(chip, `${view.industry_defs[keys[i]].name}产业：持有 ${player.industries[keys[i]]} 个。${PONZI_SCHEME_EXPLAIN.industry.zh}`));
            addTip(target.querySelector(".ponzi-scheme-owned-luxuries"), `已购奢侈品：${player.luxuries.map(lid => `${view.luxury_defs[lid].name} ${view.luxury_defs[lid].points} 分`).join("、")}。这些资产公开且不可转卖。`);
            target.querySelectorAll(".ponzi-scheme-debt-track > div").forEach((slot, i) => addTip(slot, `债务到期位置：还需前进 ${i + 1} 格。大数字是该位置所有债务的利息总额，单位现金；零表示这里没有债务。`));
            target.querySelectorAll(".ponzi-scheme-debt-list > div").forEach((row, i) => addTip(row, `${describeCard(player.debts[i])} 当前${player.debts[i].remaining === 0 ? "已经到期" : `还需前进 ${player.debts[i].remaining} 格到期`}。`));
        });
        panel.querySelectorAll(".ponzi-scheme-payments > span").forEach((target, i) => {
            const payment = view.last_round.payments[i];
            addTip(target, `本轮付息：${name(payment.player_id)} 应付 ${payment.due} 单位现金，${payment.bankrupt ? "现金不足，已破产" : "已成功支付"}。`);
        });
        panel.querySelectorAll(".ponzi-scheme-result").forEach((target, i) => {
            const result = view.results[i];
            addTip(target, `最终得分：${name(result.player_id)}${result.bankrupt ? "破产，不参与排名" : `总计 ${result.total} 分`}。行业分加上${view.advanced ? "奢侈品分" : "剩余现金对应的财富分"}；最大资金本金用于同分决胜。`);
        });
        panel.querySelectorAll(".ponzi-scheme-log li").forEach(target => addTip(target, `事件记录：${target.textContent} 金额单位为现金，行业图标表示对应产业；秘密交易价格仅参与者可见。`));
    }

    function hideImmediateTip() {
        window.clearTimeout(tipTimer);
        window.clearTimeout(tipHideTimer);
        if (tipAnchor) tipAnchor.removeAttribute("aria-describedby");
        tipAnchor = null;
        immediateTip.hidden = true;
        immediateTip.textContent = "";
    }

    function showImmediateTip(target, touch = false) {
        if (!target?.dataset.psTip || explaining() || dialog.open || panel.classList.contains("hidden")) return;
        hideImmediateTip();
        tipAnchor = target;
        immediateTip.setAttribute("role", touch ? "status" : "tooltip");
        immediateTip.setAttribute("aria-live", touch ? "polite" : "off");
        immediateTip.classList.toggle("is-touch", touch);
        immediateTip.textContent = target.dataset.psTip;
        immediateTip.hidden = false;
        target.setAttribute("aria-describedby", immediateTip.id);
        const anchor = target.getBoundingClientRect();
        const rect = immediateTip.getBoundingClientRect();
        const viewport = window.visualViewport;
        const width = viewport?.width || window.innerWidth;
        const height = viewport?.height || window.innerHeight;
        const topOffset = viewport?.offsetTop || 0;
        const leftOffset = viewport?.offsetLeft || 0;
        const left = touch ? (width - rect.width) / 2 : Math.min(width - rect.width - 10, Math.max(10, anchor.left));
        const preferTop = touch ? anchor.top > height / 2 : anchor.top > rect.height + 18;
        const top = touch ? (preferTop ? 12 : height - rect.height - 16) : (preferTop ? anchor.top - rect.height - 8 : anchor.bottom + 8);
        immediateTip.style.left = `${leftOffset + Math.max(10, left)}px`;
        immediateTip.style.top = `${topOffset + Math.max(10, Math.min(height - rect.height - 10, top))}px`;
        if (touch) tipTimer = window.setTimeout(hideImmediateTip, 3000);
    }

    function submit(action) {
        if (!action || pending || !available(action.type)) return;
        pending = true;
        render();
        sendAction(action);
        window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => { pending = false; render(); }, 6000);
    }

    function openDialog(title, content, html = false) {
        hideImmediateTip();
        returnFocus = document.activeElement;
        dialog.dataset.psKind = title === "Confirm purchase" ? "purchase" : "reference";
        dialogTitle.textContent = title;
        if (html) dialogBody.innerHTML = content;
        else dialogBody.textContent = content;
        if (!dialog.open) dialog.showModal();
    }

    panel.addEventListener("toggle", event => {
        const key = event.target.dataset?.psDetails;
        if (key) event.target.open ? openDetails.add(key) : openDetails.delete(key);
    }, true);
    panel.addEventListener("input", event => {
        if (event.target.id !== "ponziSchemeOfferAmount") return;
        amount = event.target.value;
        const confirm = document.getElementById("ponziSchemeConfirm");
        if (confirm) { confirm.disabled = !candidate(); confirm.textContent = confirmLabel(); }
    });
    panel.addEventListener("click", event => {
        const target = event.target.closest("button[data-ps-action]");
        if (!target || target.disabled || pending) return;
        const data = target.dataset;
        switch (data.psAction) {
            case "industry":
                selectedIndustry = selectedIndustry === data.industry ? null : data.industry;
                if (selectedCard && available("fund") && !view.fund_options.some(option => option.industry === selectedIndustry && option.card_id === selectedCard)) selectedCard = null;
                break;
            case "card": selectedCard = selectedCard === data.card ? null : data.card; break;
            case "target":
                selectedTarget = selectedTarget === data.target ? null : data.target;
                selectedIndustry = null;
                break;
            case "amount": amount = String(Math.max(0, Math.min(own().cash, (Number(amount) || 0) + Number(data.delta)))); break;
            case "confirm": submit(candidate()); return;
            case "pass": submit({type: "pass"}); return;
            case "sell": submit({type: "respond_trade", response: "sell"}); return;
            case "buy": submit({type: "respond_trade", response: "buy"}); return;
            case "next": submit({type: "next_round"}); return;
            case "luxury": {
                const spec = view.luxury_defs[data.luxury];
                openDialog("Confirm purchase", `<p>${spec.icon} ${spec.name} · 💵 ${spec.cost} → ${spec.points} 分</p><p>本轮发起交易机会将用于购买这件奢侈品。</p>${button("Buy", "confirm-luxury", "luxury", false, `data-luxury="${data.luxury}"`)}`, true);
                return;
            }
        }
        render();
    });
    dialog.addEventListener("click", event => {
        const purchase = event.target.closest('[data-ps-action="confirm-luxury"]');
        if (purchase) { dialog.close(); submit({type: "buy_luxury", luxury: purchase.dataset.luxury}); return; }
        const rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });

    const isInteractiveSelectionTarget = target => target?.closest?.("button, input, select, summary, a, dialog, label, [data-ps-tip]");
    panel.addEventListener("pointerdown", event => {
        if (!view || explaining() || pending || !(selectedCard || selectedIndustry || selectedTarget) || isInteractiveSelectionTarget(event.target)) return;
        // Defer clearing until pointerup. A touch that moves is a scroll gesture,
        // while a short, stationary tap is an intentional blank-area click.
        selectionPointer = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            time: Date.now(),
            pointerType: event.pointerType,
            moved: false,
            tipDismissed: Boolean(event.ponziTipDismissed),
        };
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Tab") inputKind = "keyboard";
        if ((event.key === "Enter" || event.key === " ") && event.target.closest("[data-ps-tip]") && !explaining()) {
            event.preventDefault(); showImmediateTip(event.target.closest("[data-ps-tip]")); return;
        }
        if (event.key === "Escape" && !immediateTip.hidden) { hideImmediateTip(); event.preventDefault(); return; }
        if (dialog.open) return;
        if (event.key === "Escape" && !panel.classList.contains("hidden")) { resetSelection(); render(); }
    });

    document.addEventListener("pointerover", event => {
        if (event.pointerType === "touch" || event.pointerType === "pen" || explaining()) return;
        if (immediateTip.contains(event.target) || tipAnchor?.contains(event.target)) window.clearTimeout(tipHideTimer);
        const target = event.target.closest("#ponziSchemePanel [data-ps-tip]");
        if (target && target !== tipAnchor) { inputKind = "mouse"; showImmediateTip(target); }
    });
    document.addEventListener("pointerout", event => {
        if (inputKind === "touch" || !tipAnchor) return;
        if ((tipAnchor.contains(event.target) || immediateTip.contains(event.target)) &&
            !tipAnchor.contains(event.relatedTarget) && !immediateTip.contains(event.relatedTarget)) tipHideTimer = window.setTimeout(hideImmediateTip, 160);
    });
    document.addEventListener("focusin", event => {
        const target = event.target.closest("#ponziSchemePanel [data-ps-tip]");
        if (target && inputKind !== "touch" && !explaining()) showImmediateTip(target);
    });
    document.addEventListener("focusout", event => {
        if (inputKind !== "touch" && tipAnchor?.contains(event.target) && !immediateTip.contains(event.relatedTarget)) hideImmediateTip();
    });
    document.addEventListener("pointerdown", event => {
        if (explaining() || panel.classList.contains("hidden")) return;
        const target = event.target.closest("#ponziSchemePanel [data-ps-tip]");
        inputKind = event.pointerType === "touch" || event.pointerType === "pen" ? "touch" : "mouse";
        if (target && inputKind === "touch") touchStart = {id: event.pointerId, target, x: event.clientX, y: event.clientY, time: Date.now(), moved: false};
        else if (!target && !immediateTip.contains(event.target) && !immediateTip.hidden) {
            event.ponziTipDismissed = true; hideImmediateTip();
        }
    }, true);
    document.addEventListener("pointermove", event => {
        if (selectionPointer?.id === event.pointerId) {
            const threshold = selectionPointer.pointerType === "mouse" ? 4 : 10;
            if (Math.hypot(event.clientX - selectionPointer.x, event.clientY - selectionPointer.y) > threshold) selectionPointer.moved = true;
        }
        if (touchStart?.id === event.pointerId && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 10) { touchStart.moved = true; hideImmediateTip(); }
    }, true);
    document.addEventListener("pointerup", event => {
        if (selectionPointer?.id === event.pointerId) {
            const start = selectionPointer;
            selectionPointer = null;
            const intentionalTap = !start.moved && !start.tipDismissed && Date.now() - start.time < 700;
            if (intentionalTap && panel.contains(event.target) && !isInteractiveSelectionTarget(event.target) && view && !explaining() && !pending) {
                resetSelection();
                render();
            }
        }
        if (!touchStart || touchStart.id !== event.pointerId) return;
        const start = touchStart; touchStart = null;
        if (!start.moved && Date.now() - start.time < 700 && start.target.isConnected && !explaining()) {
            event.preventDefault(); event.stopImmediatePropagation(); showImmediateTip(start.target, true);
        }
    }, true);
    document.addEventListener("pointercancel", () => { touchStart = null; selectionPointer = null; }, true);
    document.addEventListener("click", event => {
        const target = event.target.closest("#ponziSchemePanel [data-ps-tip]");
        if (!target || explaining()) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (inputKind !== "touch") showImmediateTip(target);
    }, true);
    window.addEventListener("resize", hideImmediateTip);
    document.addEventListener("scroll", () => { if (inputKind !== "touch") hideImmediateTip(); }, true);

    function clearState() {
        hideImmediateTip(); touchStart = null; selectionPointer = null;
        view = null; signature = null; pending = false;
        resetSelection(); openDetails.clear(); ponziSchemeExplainWidget?.exit(); window.clearTimeout(pendingTimer);
        if (dialog.open) dialog.close();
        panel.innerHTML = "";
    }
    window.renderPonziSchemeGameState = data => {
        if (!data?.view) return;
        const next = data.view;
        const nextSignature = JSON.stringify([data.room_id, next.phase, next.round, next.current_turn, next.market.map(card => card.id)]);
        if (signature !== nextSignature) { resetSelection(); if (dialog.open && dialog.dataset.psKind === "purchase") dialog.close(); }
        signature = nextSignature; view = next; pending = false; window.clearTimeout(pendingTimer); render();
    };
    window.showPonziSchemeHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) clearState();
    };
    window.clearPonziSchemeState = clearState;
    window.getPonziSchemeConfig = () => ({advanced: document.getElementById("ponziSchemeAdvanced").checked, first_round_trading: document.getElementById("ponziSchemeFirstTrade").checked});
    window.updatePonziSchemeConfigRow = () => {
        const box = document.getElementById("ponziSchemeConfigBox");
        const visible = currentGameType === "ponzi_scheme" && currentRoomState?.status === "lobby";
        box.classList.toggle("hidden", !visible); box.setAttribute("aria-hidden", String(!visible));
    };
    function connectEvents() {
        socket.on("system:error", () => { if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); } });
    }
    if (document.readyState === "loading" || typeof socket === "undefined") {
        window.addEventListener("DOMContentLoaded", connectEvents, {once: true});
    } else {
        connectEvents();
    }
})();
