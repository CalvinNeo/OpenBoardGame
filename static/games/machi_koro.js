(function () {
  "use strict";

  function init() {
    const GAME_ID = "machi_koro";
    const byId = (suffix) => document.getElementById(`machiKoro${suffix}`);
    const panel = byId("Panel");
    if (!panel || panel.dataset.mkReady) return;
    panel.dataset.mkReady = "true";
    const icons = { grain: "🌾", animal: "🐄", shop: "🍞", restaurant: "☕", resource: "⚙", factory: "🏭", market: "🍎", boat: "⚓", company: "▤", major: "🏢" };
    const landmarkIcons = { train_station: "🚂", shopping_mall: "🛍", amusement_park: "🎡", radio_tower: "📡", harbor: "⚓", airport: "✈" };
    const dieFaces = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    const payouts = {
      wheat_field: "+1", ranch: "+1", bakery: "+1", cafe: "Take 1", convenience_store: "+3", forest: "+1", mine: "+5",
      family_restaurant: "Take 2", apple_orchard: "+3", stadium: "Take 2 / rival", tv_station: "Take 5", business_center: "Exchange",
      cheese_factory: "3 × 🐄", furniture_factory: "3 × ⚙", produce_market: "2 × 🌾", sushi_bar: "Take 3 · ⚓",
      flower_garden: "+1", flower_shop: "1 × garden", pizza_joint: "Take 1", hamburger_stand: "Take 1", mackerel_boat: "+3 · ⚓",
      tuna_boat: "+2 dice · ⚓", food_warehouse: "2 × ☕", publisher: "🍞 + ☕ tax", tax_office: "Half tax",
      corn_field: "+1 early", general_store: "+2 early", vineyard: "+3", demolition_company: "Demolish +8", loan_office: "Pay 2",
      moving_company: "Gift +4", winery: "6 × vineyard", soda_bottling_plant: "All ☕", french_restaurant: "Take 5 late",
      private_club: "Take all late", exhibit_hall: "Activate", park: "Equal shares", renovation_company: "Close + tax", tech_startup: "Invest / tax"
    };
    let view = null;
    let activeRoom = null;
    let selected = null;
    let filter = "all";
    let cityOwner = null;
    let inFlight = false;
    let requestTimer = null;
    let tooltipTimer = null;
    let gesture = null;
    let suppressClick = false;
    let lobbyRoom = null;
    const explanations = {
      settings: { zh: "可选择原版、港口、豪华街，或同时加入两套扩展。可变市场保持十种设施，抽到重复类型时叠放。全设施市场是另一种可选设置。", en: "Choose Base, Harbor, Millionaire's Row, or both expansions. The variable market draws until ten different establishment types are available, stacking duplicates. The full market is an alternative setup." },
      dice: { zh: "骰子(🎲)的合计点数决定设施触发。蓝色在任何人的回合触发，绿色和紫色仅在自己的回合触发，红色仅在对手回合收费。港口可能使触发总和增加二，但不会改变骰子本身或对子。", en: "Dice (🎲) determine activation. Blue works on anyone's turn, green and purple on your turn, and red on opponents' turns. Harbor can add two to the activation total, but never changes the dice or doubles." },
      landmarks: { zh: "地标(★)不限建造顺序。率先完成全部地标立即获胜。含港口扩展需要六座，否则需要四座。市政厅不是地标，不计入玉米田、杂货店或餐厅的门槛。", en: "Landmarks (★) may be built in any order. Complete all of them to win immediately: six with Harbor, otherwise four. City Hall is not a landmark and never counts toward establishment thresholds." },
      market: { zh: "每回合可以购买一张设施或建造一座地标，也可跳过。金币(💰)支付费用。紫色重要设施每种每人限一张。贷款公司价格为负五，建造时反而获得五金币。", en: "Each turn, buy one establishment or build one landmark, or pass. Pay its price in coins (💰). Each city may own only one purple Major of each type. Loan Office costs minus five, so building it earns five coins." },
      roll: { zh: "掷一颗骰子(🎲)。已建火车站时也可以选择掷两颗，点数相加。", en: "Roll one die (🎲), or choose two dice if you have built your Train Station. Add their values together." },
      reroll: { zh: "广播塔可以重掷全部骰子一次。最终骰点用于触发及判定游乐园的对子额外回合。", en: "Radio Tower rerolls all dice once. The final dice determine income and any doubles extra turn from Amusement Park." },
      keep: { zh: "保留当前骰点，继续处理港口和设施收益。", en: "Keep these dice and continue to Harbor and income resolution." },
      harbor: { zh: "骰点总和至少十且已建港口时，可以选择将触发总和加二，或保留原点数。", en: "With a Harbor and a dice total of at least ten, choose whether to add two to the activation total." },
      pass: { zh: "本回合不建造，直接结束建造步骤。若已建机场，获得十金币，然后仍可投资科技公司。", en: "Build nothing this turn. A built Airport pays ten coins. You may still invest in Tech Startup afterward." },
      invest: { zh: "可以向科技公司投资一金币，或不投资。累计投资不可用于建造，科技公司触发时向每位对手收取等额金币。", en: "Invest exactly one coin in Tech Startup or skip. Invested coins cannot buy anything. When the Startup activates, take your invested amount from every opponent." },
      next: { zh: "一轮所有玩家及其额外回合结束后暂停展示结算，所有玩家点击 Next Round 后继续。", en: "After all players and their extra turns finish, the game pauses for a round review. Continue only after everyone selects Next Round." },
      city: { zh: "查看这座城市的金币(💰)、已建地标(★)和设施。投资(↗)为科技公司累积的不可花费金币。条纹设施正在装修，下次符合触发条件时只移除装修标记而不产生效果。点击玩家可查看其城市。", en: "Inspect this city's coins (💰), built landmarks (★), and establishments. Investment (↗) is the Tech Startup's unspendable capital. Striped cards are closed for renovation. Their next activation reopens them without an effect. Select a player to inspect their city." },
      activate: { zh: "同阶段的多张设施可以选择结算顺序。先结算红色收费，再处理蓝色和绿色，最后紫色。已结算的卡不会因为后来交换到新主人而再次触发。", en: "Choose the order of simultaneous effects within a stage. Red charges first, then blue and green, then purple. A card never activates again just because its owner changes." },
      choose: { zh: "在卡牌附近选择目标并确认。此处只列出服务器允许的选项。装修状态随交换或赠送的设施一起转移。", en: "Choose an allowed target and confirm here. Options come from the server. Renovation tokens travel with exchanged or gifted establishments." }
    };
    const MACHI_KORO_HELP = {
      gameId: GAME_ID,
      title: { zh: "骰子街 · 原版与扩展", en: "Machi Koro · Base & Expansions" },
      basic: {
        win: { zh: "率先建成全部地标(★)获胜，港口版需要六座，其他版本需要四座。", en: "Win by completing all landmarks (★), six with Harbor or four without it." },
        turn: { zh: "每回合掷骰子(🎲)、按点数结算设施收益，再用金币(💰)购买一张设施或建造一座地标，也可以不建造。", en: "Each turn roll dice (🎲), resolve establishments, then spend coins (💰) to buy one establishment or build one landmark, or build nothing." },
        key: { zh: "围绕常见骰点与连锁收益发展城市，同时留意餐厅收费和地标竞速。", en: "Build a reliable income engine around likely dice totals while watching restaurant fees and the landmark race." }
      },
      sections: [
        { id: "flow", label: { zh: "回合与图标", en: "Flow & icons" }, html: {
          zh: "<p>每人以三金币、一张麦田和一张面包店开局。火车站建成后可以选择一骰或两骰。多人按顺时针轮流，每轮结束等待所有人点击 Next Round。</p><p>先支付红色餐饮设施，再处理蓝色与绿色设施，最后处理紫色重要设施。同阶段多张设施由当前玩家选择顺序。红色收费按逆时针座次支付，余额不足只付现有金额，不会欠债，也不会用之后获得的收入补付。</p><p>农作物(🌾)、畜牧(🐄)、商店(🍞)、餐饮(☕)、资源(⚙)、工厂(🏭)、市场(🍎)、船只(⚓)、公司(▤)和重要设施(🏢)代表设施类别。颜色同时以文字标示。购物中心只为商店和餐饮每张额外增加一金币。</p>",
          en: "<p>Start with three coins, a Wheat Field and a Bakery. A built Train Station lets you roll one or two dice. Play clockwise and review each complete round before everyone selects Next Round.</p><p>Resolve red restaurant charges first, then blue and green establishments, then purple Majors. Choose the order of your simultaneous effects. Pay restaurant owners counter-clockwise. Never go below zero, and never repay missed charges with income received later.</p><p>Grain (🌾), animal (🐄), shop (🍞), restaurant (☕), resource (⚙), factory (🏭), market (🍎), boat (⚓), company (▤), and Major (🏢) identify categories. Colors also have text labels. Shopping Mall adds one coin per shop or restaurant card.</p>"
        } },
        { id: "landmarks", label: { zh: "地标与港口", en: "Landmarks & Harbor" }, html: {
          zh: "<p>火车(🚂)代表火车站，购物袋(🛍)代表购物中心，摩天轮(🎡)代表游乐园，天线(📡)代表广播塔，船锚(⚓)代表港口，飞机(✈)代表机场。地标可以任意顺序建造，效果立刻生效。游乐园在最终两骰相同时提供额外回合。广播塔每回合可以重掷全部骰子一次。</p><p>港口扩展加入港口和机场，因此需要建成六座地标。骰点至少十时，港口可选增加二点。寿司店、鲭鱼船和金枪鱼船要求其所有者已建港口。金枪鱼船额外投掷两骰，所有玩家的船共用该次额外骰点，不触发其他设施、港口、广播塔或游乐园。</p><p>市政厅从开局生效，收益结算后当前玩家仍为零金币时补一金币。市政厅不是地标或设施。机场在不建造的回合支付十金币。出版社按每名对手的商店及餐饮数量收费，税务局向至少十金币的对手收取一半，向下取整。花店按每张花田获得一金币，有购物中心时每张花田获得二金币。</p>",
          en: "<p>Train (🚂), bag (🛍), wheel (🎡), antenna (📡), anchor (⚓), and airplane (✈) represent Train Station, Shopping Mall, Amusement Park, Radio Tower, Harbor, and Airport. Build in any order and use their effects immediately. Amusement Park grants an extra turn on final doubles. Radio Tower may reroll all dice once per turn.</p><p>Harbor adds two landmarks, so you need six. On totals of ten or more you may add two. Sushi Bar, Mackerel Boat, and Tuna Boat require their owner to have a Harbor. Every active Tuna Boat uses the same separate two-dice roll. This extra roll never triggers other establishments, Harbor, Radio Tower, or Amusement Park.</p><p>City Hall is active from the start and grants one coin if the active player has none after income. It is neither a landmark nor an establishment. Airport pays ten coins when you build nothing. Publisher taxes opponents for their shops and restaurants. Tax Office takes half, rounded down, from opponents with at least ten coins. Flower Shop earns one per Flower Garden, or two per garden with Shopping Mall.</p>"
        } },
        { id: "millionaires", label: { zh: "豪华街与市场", en: "Millionaire's Row" }, html: {
          zh: "<p>豪华街加入十四种设施。玉米田和杂货店要求少于两座已建地标，法国餐厅要求付款者至少两座，私人俱乐部要求至少三座。拆迁公司有地标可拆时必须拆除一座并获得八金币。贷款公司建造时给五金币，触发时支付两金币。</p><p>搬家公司必须赠送一张非紫色设施并获得四金币，可以赠送自身。酿酒厂每张葡萄园获得六金币后停业，下次触发只复业。装修公司选择一种非紫色设施，全体玩家该类设施停业，并按对手新停业的张数收费。装修中的设施仍用于类别计数，装修标记随卡转移。</p><p>展览馆可以退回市场来额外触发一张自有非紫色设施，也可以放弃。汽水工厂按全体玩家的餐饮数量获利。公园汇集全体金币后平均分配，向上取整，银行补足差额。科技公司每回合结束可以投资一金币，触发时向每位对手收取累计投资额。</p><p>可变市场洗混所有已启用设施，抽到十种不同设施为止，重复牌叠放。买空一堆后补回十种，牌库耗尽后不再补充。全设施市场可在开局选择。紫色每种每人最多一张。点击市场牌或地标后原地确认，点击空白或按 Escape 取消。Help 和 Explain 中可查看完整牌效。</p>",
          en: "<p>Millionaire's Row adds fourteen types. Corn Field and General Store require fewer than two built landmarks. French Restaurant requires the payer to have two or more, and Private Club requires three. Demolition Company must demolish one built landmark if possible and gains eight coins. Building Loan Office gives five coins, but activating it costs two.</p><p>Moving Company gives a non-Major establishment to an opponent and earns four coins. It may give itself. Winery earns six per Vineyard, then closes for renovation. Its next activation only reopens it. Renovation Company closes everyone's cards of one non-Major type and charges opponents per newly closed card. Closed establishments still count for combinations, and renovation tokens travel with cards.</p><p>Exhibit Hall may return itself to the market to activate one owned non-Major establishment, or skip. Soda Bottling Plant counts everyone's restaurants. Park pools all coins and splits them equally, rounding each share up with bank coins. Tech Startup may accept one coin at each turn end and takes its total investment from each opponent when activated.</p><p>The variable market draws until ten different types are available and stacks duplicates. Refill when a stack empties until the deck runs out. Alternatively select the full market before starting. Each city may own at most one of each purple Major. Select a market card or landmark and confirm in place. Tap blank space or press Escape to cancel. Help and Explain provide full effects.</p>"
        } }
      ]
    };
    const help = typeof window.obgCreateHelp === "function" ? window.obgCreateHelp(MACHI_KORO_HELP) : { open() {}, close() {} };
    const explain = typeof window.obgCreateExplain === "function" ? window.obgCreateExplain({ gameId: GAME_ID, attribute: "data-machi-koro-explain", explanations: explanations,
      root: () => panel, button: byId("ExplainBtn"), bypass: ["#machiKoroHelpBtn", "#machiKoroExplainBtn"] }) : { exit() {}, toggle() {}, refresh() {}, isActive: () => false };
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    const own = () => view?.players.find((player) => player.player_id === view.you);
    const can = (type) => Boolean(view?.legal_actions.includes(type) && !inFlight);
    const playerName = (playerId) => view?.players.find((player) => player.player_id === playerId)?.name || "Spectator";
    const describeCard = (cardId) => {
      const card = view.catalog[cardId];
      const key = `card-${cardId}`;
      explanations[key] = { zh: `${card.name_zh} · ${card.rolls.join('/')} · 💰 ${card.cost}。${card.effect_zh}`, en: `${card.name} · ${card.rolls.join('/')} · 💰 ${card.cost}. ${card.effect}` };
      return key;
    };
    function hideTooltip() {
      clearTimeout(tooltipTimer);
      byId("Tooltip").classList.add("hidden");
    }
    function showTooltip(node) {
      if (!node || explain.isActive() || node.closest("button, select, label")) return;
      const description = explanations[node.dataset.mkTip];
      if (!description) return;
      const tooltip = byId("Tooltip");
      tooltip.textContent = description[window.obgHelpLang() === "zh" ? "zh" : "en"];
      tooltip.classList.remove("hidden");
      const bounds = node.getBoundingClientRect();
      tooltip.style.left = `${Math.max(12, Math.min(innerWidth - tooltip.offsetWidth - 12, bounds.left))}px`;
      tooltip.style.top = `${Math.max(12, Math.min(innerHeight - tooltip.offsetHeight - 12, bounds.bottom + 6))}px`;
      clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(hideTooltip, 3000);
    }
    function send(type, fields = {}) {
      if (!can(type)) return;
      inFlight = true;
      selected = null;
      hideTooltip();
      clearTimeout(requestTimer);
      requestTimer = setTimeout(() => { inFlight = false; render(); }, 6000);
      sendAction({ type, ...fields });
      render();
    }
    function button(text, type, fields = {}, key = type) {
      const node = document.createElement("button");
      node.type = "button";
      node.textContent = text;
      node.dataset.machiKoroExplain = key;
      node.disabled = !can(type);
      node.addEventListener("click", () => send(type, fields));
      return node;
    }
    function confirmation(container, title, type, fields) {
      const overlay = document.createElement("div");
      overlay.className = "mk-confirm";
      const name = document.createElement("strong");
      name.textContent = title;
      overlay.append(name, button("Buy", type, fields, type === "buy" ? "market" : "landmarks"));
      overlay.querySelector("button").className = "mk-primary";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => { selected = null; renderCards(); renderLandmarks(); });
      overlay.append(cancel);
      container.append(overlay);
    }
    function renderPlayers() {
      byId("Players").replaceChildren();
      view.players.forEach((player) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className = `mk-player${player.player_id === view.current_turn ? " is-current" : ""}${player.player_id === cityOwner ? " is-viewed" : ""}`;
        node.dataset.machiKoroExplain = "city";
        node.innerHTML = `<strong>${escapeHtml(player.name)}${player.player_id === view.you ? " · you" : ""}</strong><span class="mk-player-stats"><span>💰 ${player.coins}</span><span>★ ${player.landmarks.length}/${view.landmark_ids.length}</span>${player.investment ? `<span>↗ ${player.investment}</span>` : ""}</span>`;
        node.addEventListener("click", () => { cityOwner = player.player_id; byId("City").open = true; renderPlayers(); renderCity(); });
        byId("Players").append(node);
      });
    }
    function renderLandmarks() {
      const player = own() || view.players[0];
      byId("Landmarks").replaceChildren();
      byId("Goal").textContent = `${player.landmarks.length} / ${view.landmark_ids.length} built`;
      view.landmark_ids.forEach((landmarkId) => {
        const landmark = view.landmarks[landmarkId];
        const built = player.landmarks.includes(landmarkId);
        const key = `landmark-${landmarkId}`;
        explanations[key] = { zh: `${landmark.name_zh} · 💰 ${landmark.cost}。${landmark.effect_zh}`, en: `${landmark.name} · 💰 ${landmark.cost}. ${landmark.effect}` };
        const node = document.createElement("div");
        node.className = `mk-landmark${built ? " is-built" : ""}`;
        const action = document.createElement("button");
        action.type = "button";
        action.dataset.machiKoroExplain = key;
        action.dataset.mkLandmark = landmarkId;
        action.disabled = built || !can("build") || player.coins < landmark.cost;
        action.innerHTML = `<span class="mk-landmark-symbol" aria-hidden="true">${landmarkIcons[landmarkId]}</span><span class="mk-landmark-name">${escapeHtml(landmark.name_zh)}</span><span class="mk-landmark-cost">${built ? "✓ Built" : `💰 ${landmark.cost}`}</span>`;
        action.addEventListener("click", () => { selected = { type: "build", id: landmarkId }; renderLandmarks(); renderCards(); });
        node.append(action);
        if (selected?.type === "build" && selected.id === landmarkId) confirmation(node, landmark.name_zh, "build", { landmark: landmarkId });
        byId("Landmarks").append(node);
      });
    }
    function renderCards() {
      const grid = byId("MarketGrid");
      const scrollTop = window.scrollY;
      const marketScroll = grid.scrollTop;
      grid.replaceChildren();
      const player = own();
      Object.keys(view.supply).sort((first, second) => view.catalog[first].rolls[0] - view.catalog[second].rolls[0] || first.localeCompare(second)).forEach((cardId) => {
        const card = view.catalog[cardId];
        if (filter !== "all" && (filter === "affordable" ? !player || card.cost > player.coins : card.color !== filter)) return;
        const node = document.createElement("div");
        node.className = "mk-card";
        node.dataset.color = card.color;
        const action = document.createElement("button");
        action.type = "button";
        action.dataset.machiKoroExplain = describeCard(cardId);
        action.dataset.mkCard = cardId;
        action.disabled = !can("buy") || !player || card.cost > player.coins || (card.color === "purple" && player.cards.some((owned) => owned.id === cardId));
        action.innerHTML = `<span class="mk-card-head"><span>${card.rolls.join(" · ")}</span><span>${card.color[0].toUpperCase()}${card.color.slice(1)}</span></span><span class="mk-card-main"><span class="mk-card-icon" aria-hidden="true">${icons[card.category]}</span><span class="mk-card-name">${escapeHtml(card.name_zh)}<span class="mk-card-en">${escapeHtml(card.name)}</span></span></span><span class="mk-card-footer"><span>💰 ${card.cost}</span><span>${escapeHtml(payouts[cardId])}</span></span>`;
        action.setAttribute("aria-label", `${card.name}, rolls ${card.rolls.join(" or ")}, cost ${card.cost}, ${card.effect}, ${view.supply[cardId]} remaining`);
        action.addEventListener("click", () => { selected = { type: "buy", id: cardId }; renderCards(); renderLandmarks(); });
        action.querySelector(".mk-card-en").append(` · ×${view.supply[cardId]}`);
        node.append(action);
        if (selected?.type === "buy" && selected.id === cardId) confirmation(node, `${card.name_zh} · 💰 ${card.cost}`, "buy", { card: cardId });
        grid.append(node);
      });
      if (!grid.childElementCount) grid.textContent = "No establishments match this filter.";
      grid.scrollTop = marketScroll;
      if (Math.abs(window.scrollY - scrollTop) > 1) window.scrollTo(0, scrollTop);
    }
    function instanceLabel(uid, ownerId) {
      for (const player of view.players) {
        if (ownerId && player.player_id !== ownerId) continue;
        const card = player.cards.find((item) => item.uid === uid);
        if (card) return `${view.catalog[card.id].name_zh} · ${view.catalog[card.id].name}${card.closed ? " · Closed" : ""} #${uid}`;
      }
      return "";
    }
    function renderChoices() {
      const choiceBox = byId("Choice");
      const host = byId("ChoiceContent");
      host.replaceChildren();
      choiceBox.classList.toggle("hidden", !["income", "choose"].includes(view.phase));
      if (view.phase === "income") {
        byId("ChoiceTitle").textContent = "Resolve income · choose order";
        const row = document.createElement("div");
        row.className = "mk-choice-buttons";
        view.income_choices.forEach((uid) => {
          const card = view.players.find((player) => player.player_id === view.current_turn).cards.find((item) => item.uid === uid);
          row.append(button(instanceLabel(uid), "activate", { uid }, describeCard(card.id)));
        });
        host.append(row);
      } else if (view.phase === "choose" && view.pending) {
        const kind = view.pending.kind;
        byId("ChoiceTitle").textContent = view.catalog[kind].name;
        const info = document.createElement("p");
        info.className = "mk-choice-info";
        info.textContent = view.catalog[kind].effect;
        host.append(info);
        const choices = view.pending.choices;
        const fields = ({ tv_station: ["target"], demolition_company: ["landmark"], moving_company: ["give", "target"], business_center: ["give", "target", "take"], renovation_company: ["card"], exhibit_hall: ["uid"] })[kind];
        const values = {};
        const labels = { target: "Opponent", give: "Give", take: "Receive", landmark: "Demolish", card: "Close type", uid: "Activate" };
        const controls = document.createElement("div");
        const confirm = button("Confirm", "choose", { choice: 0 }, "choose");
        confirm.className = "mk-primary";
        function updateSelects() {
          controls.replaceChildren();
          let candidates = choices.map((choice, index) => ({ choice, index })).filter((entry) => !entry.choice.skip);
          fields.forEach((field) => {
            const options = [...new Set(candidates.map((entry) => entry.choice[field]))];
            if (!options.includes(values[field])) values[field] = options[0];
            const label = document.createElement("label");
            label.textContent = labels[field];
            const select = document.createElement("select");
            select.disabled = !can("choose");
            options.forEach((value) => {
              const option = document.createElement("option");
              option.value = String(value);
              option.textContent = field === "target" ? playerName(value) : field === "landmark" ? view.landmarks[value].name : field === "card" ? view.catalog[value].name : instanceLabel(value);
              option.selected = values[field] === value;
              select.append(option);
            });
            select.addEventListener("change", () => { values[field] = ["give", "take", "uid"].includes(field) ? Number(select.value) : select.value; updateSelects(); });
            label.append(select);
            controls.append(label);
            candidates = candidates.filter((entry) => entry.choice[field] === values[field]);
          });
          confirm.disabled = !can("choose") || !candidates.length;
          confirm.onclick = () => { if (candidates.length) send("choose", { choice: candidates[0].index }); };
        }
        updateSelects();
        host.append(controls, confirm);
        const skip = choices.findIndex((choice) => choice.skip);
        if (skip >= 0) host.append(button("Skip effect", "choose", { choice: skip }, "choose"));
      }
    }
    function renderCity() {
      const player = view.players.find((person) => person.player_id === cityOwner) || own() || view.players[0];
      byId("CityTitle").textContent = `${player.name}'s city · ${player.cards.length} establishments${player.investment ? ` · ↗ ${player.investment} invested` : ""}`;
      byId("CityCards").replaceChildren();
      const groups = new Map();
      player.cards.forEach((card) => {
        const key = `${card.id}-${card.closed}`;
        if (!groups.has(key)) groups.set(key, { ...card, count: 0 });
        groups.get(key).count += 1;
      });
      groups.forEach((card) => {
        const node = document.createElement("span");
        node.className = `mk-city-card${card.closed ? " is-closed" : ""}`;
        node.tabIndex = 0;
        node.dataset.machiKoroExplain = describeCard(card.id);
        node.dataset.mkTip = describeCard(card.id);
        node.textContent = `${icons[view.catalog[card.id].category]} ${view.catalog[card.id].name_zh} ×${card.count}${card.closed ? " · Closed" : ""}`;
        byId("CityCards").append(node);
      });
      const built = document.createElement("span");
      built.className = "mk-city-card";
      built.dataset.machiKoroExplain = "city";
      built.dataset.mkTip = "city";
      built.tabIndex = 0;
      built.textContent = `★ ${player.landmarks.map((landmark) => view.landmarks[landmark].name_zh).join(" · ") || "No landmarks built"}`;
      byId("CityCards").append(built);
    }
    function render() {
      if (!view) return;
      byId("Lobby").classList.add("hidden");
      byId("Table").classList.remove("hidden");
      byId("Turn").textContent = view.game_over ? `${view.winner.map(playerName).join(" & ")} wins!` : `${playerName(view.current_turn)}${view.current_turn === view.you ? " · your turn" : "'s turn"}`;
      byId("Round").textContent = `Round ${view.round_number} · ${view.config.edition === "all" ? "Both expansions" : view.config.edition}`;
      renderPlayers();
      byId("Dice").classList.toggle("hidden", !view.dice.length);
      byId("Dice").innerHTML = `${view.dice.map((die) => `<span class="mk-die">${dieFaces[die]}</span>`).join("")}<span class="mk-total">${view.total === null ? "" : `= ${view.total}`}</span>`;
      byId("Message").textContent = view.game_over ? "All landmarks complete. A city worth celebrating." : ({ roll: "Choose your dice.", reroll: "Keep this roll or use Radio Tower.", harbor: "Use your Harbor bonus?", income: "Resolve your establishments.", choose: "Choose a target for this effect.", build: "Build one establishment or landmark.", invest: "Invest in your Tech Startup?", round_summary: "Round complete. Review everyone's cities." })[view.phase];
      if (!view.game_over && !view.legal_actions.length && view.phase !== "round_summary") byId("Message").textContent = `Waiting for ${playerName(view.current_turn)} · ${view.phase}.`;
      byId("Message").classList.toggle("mk-visually-hidden", Boolean(view.legal_actions.length && ["roll", "reroll", "harbor", "invest"].includes(view.phase)));
      const controls = byId("TurnButtons");
      const headerRoll = view.phase === "roll" && view.legal_actions.includes("roll");
      byId(headerRoll ? "RollSlot" : "TurnControls").append(controls);
      byId("RollSlot").classList.toggle("hidden", !headerRoll);
      byId("DiceRow").classList.toggle("hidden", headerRoll);
      controls.classList.toggle("hidden", !view.legal_actions.length);
      controls.replaceChildren();
      if (["roll", "reroll"].includes(view.phase)) {
        const type = view.phase;
        controls.append(button(type === "roll" ? "🎲 Roll 1" : "Reroll 1", type, { dice: 1 }));
        if (view.players.find((player) => player.player_id === view.current_turn).landmarks.includes("train_station")) controls.append(button(type === "roll" ? "🎲 Roll 2" : "Reroll 2", type, { dice: 2 }));
        if (type === "reroll") controls.append(button("Keep roll", "keep"));
      }
      if (view.phase === "harbor") controls.append(button(`⚓ Add 2 → ${view.total + 2}`, "harbor", { add: true }), button(`Keep ${view.total}`, "harbor", { add: false }));
      if (view.phase === "build") controls.append(button(own()?.landmarks.includes("airport") ? "Build nothing · +10 💰" : "Build nothing", "pass"));
      if (view.phase === "invest") controls.append(button("Invest 1 💰", "invest", { invest: true }), button("Skip investment", "invest", { invest: false }));
      const summary = byId("Summary");
      summary.classList.toggle("hidden", view.phase !== "round_summary");
      summary.replaceChildren();
      if (view.phase === "round_summary") {
        view.round_summary.forEach((entry) => {
          const line = document.createElement("p");
          line.textContent = `${playerName(entry.player_id)}${entry.player_id === view.you ? " · you" : ""}: 💰 ${entry.coins} (${entry.change >= 0 ? "+" : ""}${entry.change}) · ★ ${entry.landmarks} · ${(entry.builds || []).join(", ")}`;
          if (entry.player_id === view.you) line.style.fontWeight = "700";
          summary.append(line);
        });
        summary.append(button(`Next Round · ${view.ready.length}/${view.players.length} ready`, "next_round", {}, "next"));
      }
      byId("MarketCount").textContent = `${Object.keys(view.supply).length} types · ${view.deck_count} in deck`;
      renderLandmarks(); renderCards(); renderChoices(); renderCity();
      byId("Log").innerHTML = [...view.history].reverse().map((entry) => `<li>Turn ${entry.turn} · ${escapeHtml(entry.message)}</li>`).join("");
      explain.refresh();
    }
    const filterOptions = [["all", "All"], ["affordable", "Affordable"], ["blue", "Blue"], ["green", "Green"], ["red", "Red"], ["purple", "Purple"]];
    filterOptions.forEach(([value, label]) => {
      const node = document.createElement("button");
      node.type = "button";
      node.textContent = label;
      node.setAttribute("aria-pressed", String(value === filter));
      node.addEventListener("click", () => {
        filter = value; selected = null;
        byId("Filters").querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === node)));
        if (view) { renderCards(); renderLandmarks(); }
      });
      byId("Filters").append(node);
    });
    byId("HelpBtn").addEventListener("click", () => { explain.exit(); hideTooltip(); help.open(); });
    byId("ExplainBtn").addEventListener("click", () => { hideTooltip(); explain.toggle(); });
    panel.addEventListener("pointerdown", (event) => { gesture = { id: event.pointerId, x: event.clientX, y: event.clientY }; suppressClick = false; });
    panel.addEventListener("pointermove", (event) => { if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) suppressClick = true; });
    document.addEventListener("pointerup", () => { gesture = null; });
    document.addEventListener("pointercancel", () => { gesture = null; suppressClick = true; });
    panel.addEventListener("click", (event) => {
      if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; return; }
      if (explain.isActive()) return;
      const passive = event.target.closest("[data-mk-tip]");
      if (passive) showTooltip(passive);
      if (selected && !event.target.closest("button, .mk-confirm, select, label")) { selected = null; renderCards(); renderLandmarks(); }
    }, true);
    panel.addEventListener("pointerover", (event) => { if (event.pointerType === "mouse") showTooltip(event.target.closest("[data-mk-tip]")); });
    panel.addEventListener("pointerout", hideTooltip);
    panel.addEventListener("focusin", (event) => showTooltip(event.target.closest("[data-mk-tip]")));
    window.addEventListener("scroll", hideTooltip, true);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") { selected = null; hideTooltip(); if (view) { renderCards(); renderLandmarks(); } } });
    function syncRoom(room) {
      const lobby = room?.game_type === GAME_ID && room.status === "lobby";
      byId("ConfigBox").classList.toggle("hidden", !lobby);
      byId("ConfigBox").setAttribute("aria-hidden", String(!lobby));
      if (room?.game_type !== GAME_ID) { explain.exit(); help.close(); hideTooltip(); return; }
      if (lobby) {
        activeRoom = room.room_id;
        view = null; selected = null; inFlight = false;
        clearTimeout(requestTimer);
        byId("Lobby").classList.remove("hidden");
        byId("Table").classList.add("hidden");
        if (lobbyRoom !== room.room_id) {
          lobbyRoom = room.room_id;
          byId("Edition").value = room.game_config?.edition || "all";
          byId("Market").value = room.game_config?.market || "variable";
        }
      }
      const host = room.players?.[0];
      const locked = !lobby || Boolean(host && host.player_id !== (typeof playerId !== "undefined" ? playerId : null));
      byId("Edition").disabled = locked;
      byId("Market").disabled = locked;
    }
    byId("Edition").addEventListener("change", () => { byId("Market").value = byId("Edition").value === "base" ? "all" : "variable"; });
    window.getMachiKoroConfig = () => ({ edition: byId("Edition").value, market: byId("Market").value });
    window.renderMachiKoroGameState = (data) => {
      if (data?.game_type !== GAME_ID || !data.view || (typeof currentRoomState !== "undefined" && currentRoomState?.room_id && currentRoomState.room_id !== data.room_id)) return;
      activeRoom = data.room_id;
      byId("ConfigBox").classList.add("hidden");
      byId("ConfigBox").setAttribute("aria-hidden", "true");
      clearTimeout(requestTimer);
      inFlight = false; selected = null;
      view = data.view;
      byId("Edition").value = view.config.edition;
      byId("Market").value = view.config.market;
      if (!view.players.some((player) => player.player_id === cityOwner)) cityOwner = view.you;
      hideTooltip(); render();
    };
    window.showMachiKoroHeaderActions = (show) => {
      byId("HeaderActions").style.display = show ? "flex" : "none";
      if (!show) { byId("ConfigBox").classList.add("hidden"); byId("ConfigBox").setAttribute("aria-hidden", "true"); explain.exit(); help.close(); hideTooltip(); }
    };
    socket.on("room:state", syncRoom);
    socket.on("system:info", (data) => {
      if (data.player_id && data.room_id === currentRoomState?.room_id) syncRoom(currentRoomState);
    });
    socket.on("system:error", () => { if (inFlight) { clearTimeout(requestTimer); inFlight = false; if (view) render(); } });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === GAME_ID && lastGameStatePayload.room_id === activeRoom && currentRoomState?.status !== "lobby") window.renderMachiKoroGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
