(function () {
  "use strict";
  const byId = suffix => document.getElementById(`bohnanza${suffix}`);
  const panel = byId("Panel");
  let view = null;
  let selected = null;
  let harvestField = null;
  let pending = false;
  let pendingTimer = null;
  let tipTimer = null;
  let gesture = null;
  let suppressClickUntil = 0;
  let offerSeen = null;
  let give = new Set();
  let payment = new Set();
  let want = {};
  let roomId = null;
  const markers = ["●", "◆", "▲", "■", "★"];
  const explanations = {
    hand: { zh: "手牌不能排序。种植时必须从最左侧开始，最多种两张。交易时可选择手牌中的任意位置，新抽到的牌依序加到最右侧。", en: "Never reorder your hand. Plant the leftmost card first and at most two cards. Trade from any position. Newly drawn cards join the right end in order." },
    market: { zh: "翻开的两张豆子属于当前玩家，可以交易或赠送。没有送出的豆子在交易结束后必须种下，不能加入手牌。", en: "The two revealed beans belong to the active farmer. Trade or donate them. Any left over must be planted after trading, never added to your hand." },
    field: { zh: "每块田只能种一种豆子，同种豆子可以分种在不同田里。收获会清空整块田，按收益表把部分牌作为金币，其余牌进入弃牌堆。", en: "Each field grows one bean type. The same type may grow in several fields. Harvest the whole field, keeping payout cards as gold and discarding the rest." },
    harvest: { zh: "收获整块田。若其他田有两张以上豆子，一张豆子的田受到保护，不能收获。收益可以为零。", en: "Harvest the entire field. A one-bean field is protected while another field contains multiple beans. A harvest may pay zero gold." },
    plant: { zh: "将已选豆子种到这块田。只有空田或者相同豆种的田可以接收，需要换种时先收获。", en: "Plant the selected bean here. Choose an empty field or one growing the same type. Harvest first to change crops." },
    reveal: { zh: "必须先种手牌第一张，第二张可选，然后翻开两张牌，进入交易。", en: "Plant your first hand card, optionally a second, then reveal two beans and begin trading." },
    trade: { zh: "任何交易都必须包括当前玩家。任意数量可以换任意数量，也可以赠送，但双方必须同意。成交后收到的牌不能再交易，也不能加入手牌。", en: "Every trade involves the active farmer. Exchange any quantities, or give a gift, with both players consenting. Received beans cannot be traded again or added to a hand." },
    finish: { zh: "结束所有交易，所有玩家种下成交收到的豆子。当前玩家还要种下市场中剩余的豆子，可以自行决定顺序。", en: "End trading. Everyone plants their received beans in any order, and the active farmer also plants the remaining market beans." },
    draw: { zh: "依序抽三张牌加入手牌末尾，回合结束。牌库第三次耗尽时停止抽牌，收获所有田并结算。", en: "Draw three cards onto the end of your hand and end your turn. Stop drawing on the third deck exhaustion, then harvest all fields and score." },
    deck: { zh: "显示牌库剩余数、弃牌数和牌库耗尽次数。金币不回到牌库。第三次耗尽触发终局，若在翻牌阶段发生则先完成交易和种植。", en: "Shows cards left, discards and deck exhaustions. Gold never returns to the deck. The third exhaustion ends play, after trading and planting if it happens during a reveal." },
    gold: { zh: "金币是从收获牌中保留的牌，每张一分。你的金币只对自己可见，终局公开所有分数。", en: "Gold consists of cards retained from harvests, one point each. Only you see your gold total until final scoring." },
    review: { zh: "所有玩家完成一圈后暂停，保留田地、金币和手牌。所有真人点击 Next Round 后继续，机器人自动确认。这是电子版查看状态的暂停，不是重新发牌。", en: "Pause after a full circuit without resetting fields, gold or hands. Everyone presses Next Round to continue, with bots confirming automatically. This digital review does not redeal cards." }
  };
  const BOHNANZA_HELP = {
    gameId: "bohnanza",
    title: { zh: "种豆得金（纸牌版）", en: "Bohnanza · Classic card game" },
    basic: {
      win: { zh: "三次耗尽牌库后收获所有豆田，金币(💰)最多的人获胜。", en: "After the third deck exhaustion, harvest every field and win with the most gold(💰)." },
      turn: { zh: "先种第一张手牌，再选择种第二张，接着翻两张牌并交易，种下收到的豆子，最后抽三张牌。", en: "Plant your first hand card and optionally a second, reveal two beans and trade, plant received beans, then draw three cards." },
      key: { zh: "手牌永远不能排序，通过交易移走挡路的豆子，并让同种豆子长到高收益。", en: "Never reorder your hand. Trade away obstructing beans and grow matching crops to reach better payouts." }
    },
    sections: [
      { id: "growing", label: { zh: "种植与收获", en: "Grow & harvest" }, html: {
        zh: "<p>采用 AMIGO 2016 经典八豆种版，三人每人三块田，四至五人每人两块田，没有购买第三块田。每人五张手牌，按座位由第一位玩家先行。</p><p>每块田只放一种豆子，同种可以种到不同田。手牌最左边是下一张必种牌，种第二张是可选的。没有手牌时直接翻牌。交易得到的豆子放在待种区，不加入手牌，可以任意顺序种植。</p><p>任何玩家可以随时收获整块田，收益可为零。但只要自己另有一块田有至少两张豆子，就不能收获只有一张豆子的田。收获时按收益表保留对应数量的牌作为金币(💰)，其余弃掉。田里不能留牌。</p>" ,
        en: "<p>This is the AMIGO 2016 classic eight-bean edition. Three farmers have three fields each. Four or five farmers have two each. There is no third-field purchase. Deal five cards each and start with the first seat.</p><p>Grow one type per field. The same type may occupy different fields. The leftmost hand card must be planted first, with a second optional. Skip straight to revealing if your hand is empty. Received beans go to a separate planting area in any order, never to your hand.</p><p>Anyone may harvest a whole field at any time, even for zero gold(💰). You cannot harvest a one-bean field while another of your fields has at least two beans. Keep payout cards as gold and discard the rest, leaving the field empty.</p>"
      } },
      { id: "deals", label: { zh: "交易与赠送", en: "Trading" }, html: {
        zh: "<p>只有当前玩家可以和其他人交易，其他人不能互相交易。当前玩家可拿出市场翻牌和任意位置的手牌，其他人只可拿出手牌。可以多换一，也可以不索取回报，但收礼人必须同意。</p><p>点对方的 Trade 选择要给的牌，用加减按钮选择索取的豆种和数量。对方可接受或拒绝。接受时可以自行选择支付的具体手牌，避免自动移走不想送出的副本。发起人可以撤回。交易牌成交前仍留在原处。一次只协商一个提案，也可以索取一份礼物。</p><p>收到的豆子不能转送，田里的豆子和金币不能交易。当前玩家结束交易后，所有人必须种完待种区的豆子，当前玩家还要种完市场剩余牌。对话框可通过 Dock 或 Esc 暂存，查看主牌桌后点 View trade 返回。</p>",
        en: "<p>Every deal must include the active farmer. Other farmers cannot trade among themselves. The active farmer can offer revealed beans or cards anywhere in their hand, while others can offer hand cards only. Exchange any quantities, donate beans or request a gift. Both farmers must agree.</p><p>Press another farmer’s Trade button, choose cards to give and use the counters to request bean types. The recipient may accept or reject, choosing the exact payment cards to preserve useful duplicates. The sender can withdraw. Cards stay in place until accepted. Negotiate one offer at a time.</p><p>Received beans cannot be traded again. Fields and gold are never tradable. After End trading, everyone must plant received beans and the active farmer must also plant the remaining market. Dock or Esc temporarily closes an offer so you can inspect the table, then View trade returns to it.</p>"
      } },
      { id: "beans", label: { zh: "豆种与收益", en: "Bean guide" }, html: {
        zh: "<p>花园豆(🌿)、红豆(🔴)、黑眼豆(👁️)、大豆(🟣)、绿豆(🟢)、臭豆(💨)、辣椒豆(🌶️)、蓝豆(🔵)各有不同收益表。牌角数字是整副牌中这种豆子的张数，不是价格。底部上排是所需豆子数，下排是对应金币(💰)。未达到第一档收益就是零。</p><p>花园豆六张，二张得二金、三张得三金，没有一金或四金档。红豆八张，二、三、四、五张分别得一至四金。黑眼豆十张，对应二、四、五、六张。大豆十二张，对应二、四、六、七张。绿豆十四张，对应三、五、六、七张。臭豆十六张，对应三、五、七、八张。辣椒豆十八张，对应三、六、八、九张。蓝豆二十张，对应四、六、八、十张。</p>",
        en: "<p>Garden Bean(🌿), Red Bean(🔴), Black-eyed Bean(👁️), Soy Bean(🟣), Green Bean(🟢), Stink Bean(💨), Chili Bean(🌶️) and Blue Bean(🔵) each have their own payout. The corner number is that type’s total deck population, not a price. The bottom meter shows beans required above their gold(💰) reward. Below the first threshold you earn zero.</p><p>Garden: six cards, two beans pay two gold and three pay three, with no one-gold or four-gold reward. Red: eight cards, thresholds 2/3/4/5 for one to four gold. Black-eyed: ten cards, 2/4/5/6. Soy: twelve, 2/4/6/7. Green: fourteen, 3/5/6/7. Stink: sixteen, 3/5/7/8. Chili: eighteen, 3/6/8/9. Blue: twenty, 4/6/8/10.</p>"
      } },
      { id: "ending", label: { zh: "终局与操作", en: "Ending & online" }, html: {
        zh: "<p>抽到牌库最后一张时立即计一次耗尽，前两次将弃牌堆洗成新牌库。第三次耗尽若发生在翻牌阶段，只翻剩余可用的牌，完成交易和种植后终局。若在抽三张时耗尽则立即终局。若没有弃牌可补充，完成当前阶段后同样结算。</p><p>所有豆田最终自动收获，此时不受单豆保护限制。手牌不计分，金币最多者获胜。平分时从起始玩家顺时针数，座位最远的平分玩家获胜。结束保留最终田地和得分。</p><p>每完成一圈暂停供查看，所有人点 Next Round 继续，不重置任何牌。电脑悬停看提示，手机点击无操作的状态显示三秒提示。Explain 后点任意有虚线的元素查看含义，灰色按钮也支持。Esc 退出解释或关闭窗口。AI 根据自己的手牌和公开田地评估收益、收获代价和交易，不读取牌库、别人手牌或隐藏金币。不需要额外模型。</p>",
        en: "<p>Drawing the last card counts as one exhaustion immediately. On the first two, shuffle the discard pile into a new deck. On the third during a reveal, reveal only available cards and finish trading and planting before ending. On the third during the three-card draw, stop immediately. If there are no discards to replenish a deck, finish the current stage and score.</p><p>Harvest all fields automatically, ignoring the single-bean protection at final scoring. Hand cards score nothing. Most gold wins. Break ties in favor of the tied seat furthest clockwise from the starting farmer. Final fields and scores stay visible.</p><p>Pause after every full circuit until everyone chooses Next Round, without resetting any cards. Hover for tips on desktop or tap passive information for three seconds on mobile. Explain describes dashed elements and disabled buttons. Esc exits Explain or closes a window. Bots evaluate crops, harvest costs and trades using only their own hand and public information, never the deck, opponents’ hands or hidden gold. No model setup is needed.</p>"
      } }
    ]
  };
  const help = window.obgCreateHelp(BOHNANZA_HELP);
  const explain = window.obgCreateExplain({
    gameId: "bohnanza", attribute: "data-bohnanza-explain", explanations: explanations,
    button: byId("ExplainBtn"), root: () => panel,
    bypass: ["#bohnanzaHelpBtn", "#bohnanzaExplainBtn", "#bohnanzaTradeClose", "#bohnanzaOfferDock"]
  });
  const own = () => view?.players.find(player => player.player_id === view.you);
  const can = type => Boolean(view?.legal_actions.includes(type) && !pending && socket.connected);
  const bean = card => view.beans.find(item => item.id === card.split(":")[0]);
  const name = playerId => view?.players.find(player => player.player_id === playerId)?.name || "Farmer";
  const active = () => view?.current_turn === view?.you;
  const localized = value => value[window.obgHelpLang() === "en" ? "en" : "zh"];
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function describe(node, key, text, passive = true) {
    if (text) explanations[key] = typeof text === "string" ? { zh: text, en: text } : text;
    node.setAttribute("data-bohnanza-explain", key);
    if (passive) { node.dataset.bnTip = key; node.tabIndex = 0; }
    return node;
  }
  function button(text, type, fields = {}, enabled = can(type), key = type) {
    const node = element("button", "", text);
    node.type = "button";
    node.disabled = !enabled;
    if (explanations[key]) describe(node, key, null, false);
    node.addEventListener("click", () => send(type, fields));
    return node;
  }
  function hideTip() { clearTimeout(tipTimer); byId("Tooltip").classList.add("hidden"); }
  function showTip(node) {
    if (!node || explain.isActive() || help.isOpen()) return;
    const tooltip = byId("Tooltip");
    tooltip.textContent = localized(explanations[node.dataset.bnTip]);
    tooltip.classList.remove("hidden");
    const rect = node.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - tooltip.offsetWidth - 12))}px`;
    tooltip.style.top = `${Math.max(10, Math.min(innerHeight - tooltip.offsetHeight - 12, rect.bottom + 6))}px`;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 3000);
  }
  function send(type, fields = {}) {
    if (!can(type)) return;
    pending = true;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; render(); }, 5000);
    socket.emit("game:action", { action: { type, revision: view.revision, ...fields } });
    render();
  }
  function cardNode(card, position = null, selectable = false, onSelect = null) {
    const info = bean(card);
    const node = element(selectable ? "button" : "div", "bn-card");
    node.style.setProperty("--bean-color", info.color);
    node.dataset.card = card;
    const top = element("span", "bn-card-top");
    top.append(element("span", "", position == null ? "" : position === 0 ? "NEXT" : `#${position + 1}`), element("span", "", `×${info.count}`));
    node.append(top, element("span", "bn-icon", info.icon), element("span", "bn-bean-name", info.en));
    const meter = element("span", "bn-meter");
    info.thresholds.forEach((threshold, index) => {
      const cell = element("span", "", threshold == null ? "—" : threshold);
      cell.append(element("small", "", `${index + 1}💰`));
      meter.append(cell);
    });
    node.append(meter);
    describe(node, `bean-${info.id}`, {
      zh: `${info.zh}(${info.icon})共${info.count}张。收益：${info.thresholds.map((threshold, index) => threshold == null ? "" : `${threshold}张得${index + 1}金币`).filter(Boolean).join("，")}。手牌不能排序。`,
      en: `${info.en}(${info.icon}), ${info.count} in the deck. Harvest: ${info.thresholds.map((threshold, index) => threshold == null ? "" : `${threshold} beans pay ${index + 1} gold`).filter(Boolean).join(", ")}. Never reorder your hand.`
    }, !selectable);
    if (selectable) {
      node.type = "button";
      node.setAttribute("aria-pressed", String(selected === card));
      node.classList.toggle("is-selected", selected === card);
      node.addEventListener("click", () => {
        if (onSelect) onSelect(node);
        else { selected = selected === card ? null : card; harvestField = null; renderSelection(); }
      });
    }
    return node;
  }
  function renderSelection() {
    ["Hand", "Pending", "Market"].forEach(suffix => byId(suffix).querySelectorAll(".bn-card").forEach(node => {
      node.classList.toggle("is-selected", node.dataset.card === selected);
      if (node.tagName === "BUTTON") node.setAttribute("aria-pressed", String(node.dataset.card === selected));
    }));
    renderFields();
  }
  function renderFields() {
    const box = byId("Fields");
    box.replaceChildren();
    const player = own();
    box.classList.toggle("bn-three", player?.fields.length === 3);
    if (!player) return;
    player.fields.forEach((field, index) => {
      const final = player.final_fields[index];
      const finalScore = view.final_scores.find(row => row.player_id === player.player_id)?.fields[index];
      const kind = field.bean || final?.[0];
      const info = kind ? bean(kind) : null;
      const node = describe(element("div", "bn-field"), "field");
      node.append(element("span", "bn-field-index", `FIELD ${index + 1}`), element("span", "bn-icon", info?.icon || "🌱"),
        element("strong", "", info?.en || "Open soil"), element("span", "bn-yield", kind ? `${field.count || final?.length} beans · ${finalScore?.gold ?? field.gold}💰` : "Ready to grow"));
      if (selected && can("plant") && (!kind || kind === bean(selected).id)) {
        const plant = button("Plant here", "plant", { card: selected, field: index }, true, "plant");
        plant.className = "bn-primary";
        node.append(plant);
      } else if (!view.game_over && view.phase !== "final_review") {
        const harvest = element("button", "", `Harvest ${field.gold}💰`);
        harvest.type = "button";
        harvest.disabled = !can("harvest") || !field.harvestable;
        describe(harvest, "harvest", null, false);
        harvest.addEventListener("click", () => { harvestField = index; renderFields(); });
        node.append(harvest);
      }
      if (harvestField === index && !view.game_over) {
        const confirm = element("div", "bn-confirm");
        confirm.append(element("strong", "", `Harvest for ${field.gold}💰?`), button("Harvest", "harvest", { field: index }));
        const cancel = element("button", "", "Cancel");
        cancel.type = "button";
        cancel.addEventListener("click", () => { harvestField = null; renderFields(); });
        confirm.append(cancel);
        node.append(confirm);
      }
      box.append(node);
    });
  }
  function openTrade(target) {
    if (!can("offer")) return;
    give = new Set(); want = {};
    byId("Target").replaceChildren();
    view.players.filter(player => player.player_id !== view.you && (active() || player.player_id === view.current_turn)).forEach(player => {
      const option = element("option", "", player.name);
      option.value = player.player_id;
      byId("Target").append(option);
    });
    byId("Target").value = target;
    const cards = own().hand.concat(active() ? view.market : []);
    byId("Give").replaceChildren(...cards.map((card, index) => {
      const node = cardNode(card, index < own().hand.length ? index : null, true, cardElement => {
        if (give.has(card)) give.delete(card); else give.add(card);
        cardElement.classList.toggle("is-selected", give.has(card));
        cardElement.setAttribute("aria-pressed", String(give.has(card)));
        updateCompose();
      });
      node.classList.remove("is-selected");
      node.setAttribute("aria-pressed", "false");
      return node;
    }));
    byId("Want").replaceChildren(...view.beans.map(info => {
      const row = element("div", "bn-counter");
      row.append(element("span", "", `${info.icon} ${info.en}`));
      const value = element("span", "", "0");
      const minus = element("button", "", "−");
      const plus = element("button", "", "+");
      minus.type = plus.type = "button";
      minus.setAttribute("aria-label", `Request fewer ${info.en}`);
      plus.setAttribute("aria-label", `Request more ${info.en}`);
      minus.disabled = true;
      function adjust(delta) {
        want[info.id] = Math.max(0, Math.min(info.count, (want[info.id] || 0) + delta));
        value.textContent = want[info.id];
        minus.disabled = want[info.id] === 0;
        plus.disabled = want[info.id] === info.count;
        updateCompose();
      }
      minus.addEventListener("click", () => adjust(-1));
      plus.addEventListener("click", () => adjust(1));
      row.append(minus, value, plus);
      return row;
    }));
    updateCompose();
    byId("TradeDialog").showModal();
  }
  function updateCompose() {
    const requested = Object.values(want).reduce((sum, count) => sum + count, 0);
    byId("GiveCount").textContent = `(${give.size})`;
    byId("SendOffer").disabled = !(give.size + requested) || !can("offer");
    byId("TradeHint").textContent = give.size && !requested ? "A gift. They must accept." : !give.size && requested ? "Ask for a gift. They can refuse." : "Both farmers must agree.";
  }
  function beanList(cards, raw = false) {
    const list = element("div", "bn-offer-list");
    if (!cards.length) list.append(element("span", "", "Nothing · a gift"));
    cards.forEach(card => {
      const info = bean(raw ? card : card.split(":")[0]);
      const node = element("span", "bn-offer-bean", `${info.icon} ${info.en}`);
      node.style.setProperty("--bean-color", info.color);
      list.append(node);
    });
    return list;
  }
  function renderOffer() {
    const offer = view.offer;
    const involved = offer && [offer.from, offer.to].includes(view.you);
    byId("OfferReturn").classList.toggle("hidden", !involved);
    if (!involved) {
      if (byId("OfferDialog").open) byId("OfferDialog").close();
      offerSeen = null;
      return;
    }
    const signature = JSON.stringify(offer);
    const incoming = offer.to === view.you;
    byId("OfferTitle").textContent = `${name(offer.from)} → ${name(offer.to)}`;
    const body = byId("OfferBody");
    body.replaceChildren(element("h4", "", `${name(offer.from)} gives`), beanList(offer.give), element("h4", "", `${name(offer.to)} gives`), beanList(offer.want, true));
    const buttons = byId("OfferButtons");
    buttons.replaceChildren();
    if (incoming) {
      if (signature !== offerSeen) payment = new Set();
      const cards = own().hand.concat(active() ? view.market : []);
      const paymentCards = cards.filter(card => offer.want.includes(bean(card).id));
      body.append(element("h4", "", "Choose the exact cards you give"));
      const choices = element("div", "bn-trade-cards");
      const accept = element("button", "bn-primary", "Accept");
      accept.type = "button";
      describe(accept, "trade", null, false);
      function updatePayment() {
        const required = [...offer.want].sort().join(",");
        const actual = [...payment].map(card => bean(card).id).sort().join(",");
        accept.disabled = !can("accept") || required !== actual;
      }
      paymentCards.forEach(card => {
        const node = cardNode(card, cards.indexOf(card), true, current => {
          if (payment.has(card)) payment.delete(card); else payment.add(card);
          current.classList.toggle("is-selected", payment.has(card));
          current.setAttribute("aria-pressed", String(payment.has(card)));
          updatePayment();
        });
        node.classList.toggle("is-selected", payment.has(card));
        node.setAttribute("aria-pressed", String(payment.has(card)));
        choices.append(node);
      });
      body.append(choices);
      buttons.append(button("Reject", "reject", {}, can("reject"), "trade"), accept);
      accept.addEventListener("click", () => send("accept", { give: [...payment] }));
      updatePayment();
    } else {
      buttons.append(element("span", "", "Waiting for their decision"), button("Withdraw", "cancel", {}, can("cancel"), "trade"));
    }
    if (signature !== offerSeen) {
      offerSeen = signature;
      if (byId("TradeDialog").open) byId("TradeDialog").close();
      if (!byId("OfferDialog").open) byId("OfferDialog").showModal();
    }
  }
  function renderPlayers() {
    byId("Players").replaceChildren(...view.players.filter(player => player.player_id !== view.you).map(player => {
      const index = view.players.indexOf(player);
      const node = element("div", `bn-opponent${player.player_id === view.current_turn ? " is-active" : ""}`);
      const header = element("div", "bn-player-header");
      header.append(describe(element("strong", "bn-player-name", `${markers[index]} ${player.name}`), `name-${index}`, player.name),
        describe(element("span", "", `🂠 ${player.hand_count} · 💰 ${player.gold ?? "?"}`), `stats-${index}`, `${player.name}: ${player.hand_count} hand cards. Gold is private until the end.`));
      node.append(header);
      const fields = element("div", "bn-small-fields");
      player.fields.forEach((field, fieldIndex) => {
        const final = player.final_fields[fieldIndex];
        const kind = field.bean || final?.[0];
        const info = kind ? bean(kind) : null;
        const text = kind ? `${info.icon} ${info.en} ×${field.count || final?.length}` : "🌱 Empty";
        fields.append(describe(element("span", "bn-small-field", text), `other-field-${index}-${fieldIndex}`,
          `${player.name}: ${text}. Current harvest ${field.gold} gold. ${field.harvestable ? "Can harvest." : "Empty or protected."}`));
      });
      node.append(fields);
      if (player.pending.length) node.append(describe(element("div", "bn-small-field", `${player.pending.length} beans to plant`), `pending-${index}`, player.pending.map(card => bean(card).en).join(", ")));
      if (view.phase === "trade" && own() && (active() || player.player_id === view.current_turn)) {
        const trade = element("button", "", "Trade");
        trade.type = "button"; trade.disabled = !can("offer");
        describe(trade, "trade", null, false);
        trade.addEventListener("click", () => openTrade(player.player_id));
        node.append(trade);
      }
      return node;
    }));
  }
  function renderReview() {
    const box = byId("Review");
    const summary = view.phase === "round_summary";
    const final = view.phase === "final_review" || view.game_over;
    box.classList.toggle("hidden", !summary && !final);
    box.replaceChildren();
    if (summary) {
      box.append(element("h3", "", "A moment in the garden"), element("p", "", `Round ${view.round_number} complete · ${view.next_round_ready.length}/${view.players.length} ready`),
        button(view.next_round_ready.includes(view.you) ? "Waiting for everyone" : "Next Round", "next_round", {}, can("next_round"), "review"));
    } else if (final) {
      box.append(element("h3", "", `${name(view.winner_ids[0])} wins`));
      [...view.final_scores].sort((first, second) => second.total - first.total).forEach(row => {
        const fields = row.fields.filter(field => field.bean).map(field => `${bean(field.bean).icon} ${bean(field.bean).en} ×${field.count} = ${field.gold}💰`).join(" + ") || "No remaining crops";
        box.append(element("p", "", `${name(row.player_id)} · ${row.previous_gold}💰 saved + ${fields} → ${row.total}💰`));
      });
      if (!view.game_over) box.append(element("p", "", `${view.final_ready.length}/${view.players.length} confirmed`),
        button(view.final_ready.includes(view.you) ? "Waiting for everyone" : "Confirm results", "confirm", {}, can("confirm"), "review"));
      else box.append(button("Play Again", "play_again", {}, can("play_again"), "review"));
    }
  }
  function render() {
    if (!view) return;
    const player = own();
    const scroll = byId("Hand").scrollLeft;
    const otherScroll = byId("Players").scrollTop;
    byId("Lobby").classList.add("hidden"); byId("Table").classList.remove("hidden");
    byId("Deck").textContent = `🂠 ${view.deck_count} left · ${view.discard_count} discarded · ${Math.min(3, view.exhaustions + 1)}/3 decks`;
    describe(byId("Deck"), "deck");
    const stage = { plant_hand: 0, reveal: 0, trade: 1, plant_traded: 2, draw: 3 }[view.phase];
    byId("Phases").replaceChildren(...["1 · Plant", "2 · Trade", "3 · Grow", "4 · Draw"].map((label, index) => describe(element("span", index === stage ? "is-current" : "", label), ["hand", "trade", "plant", "draw"][index])));
    const instructions = {
      plant_hand: active() ? `Plant your ${view.planted ? "optional second" : "first"} bean` : `${name(view.current_turn)} is planting`,
      reveal: active() ? "Reveal two beans" : `Waiting for ${name(view.current_turn)}`,
      trade: view.offer ? "A deal is on the table" : active() ? "Trade, donate, or keep your beans" : `Trade with ${name(view.current_turn)}`,
      plant_traded: player?.pending.length ? "Choose a bean, then a field" : "Waiting for the received beans to be planted",
      draw: active() ? "Draw three to finish your turn" : `${name(view.current_turn)} is drawing`,
      round_summary: "Review the fields before the next round", final_review: "Review and confirm the final harvest", game_over: "The harvest is in"
    };
    byId("Status").textContent = instructions[view.phase] || "";
    byId("MarketNote").textContent = view.phase === "trade" ? `${name(view.current_turn)}'s reveal` : "";
    describe(byId("MarketNote"), "market");
    byId("Market").replaceChildren(...view.market.map(card => cardNode(card)));
    byId("MarketButtons").replaceChildren();
    if (view.phase === "reveal" || view.phase === "plant_hand") byId("MarketButtons").append(button("Reveal 2", "reveal", {}, can("reveal"), "reveal"));
    if (view.phase === "trade") byId("MarketButtons").append(button("End trading", "finish_trade", {}, can("finish_trade"), "finish"));
    byId("PersonalTitle").textContent = player ? "Your fields" : "Spectator";
    byId("Gold").textContent = player ? `${player.gold}💰` : "";
    describe(byId("Gold"), "gold");
    byId("HandCount").textContent = player ? `(${player.hand_count}) · Plant left to right` : "";
    byId("HandSection").classList.toggle("hidden", !player);
    byId("Hand").replaceChildren(...(player?.hand || []).map((card, index) => cardNode(card, index, can("plant") && view.phase === "plant_hand" && index === 0)));
    byId("Hand").scrollLeft = scroll;
    byId("HandButtons").replaceChildren();
    if (view.phase === "draw") byId("HandButtons").append(button("Draw 3", "end_turn", {}, can("end_turn"), "draw"));
    byId("PendingSection").classList.toggle("hidden", !player?.pending.length);
    byId("Pending").replaceChildren(...(player?.pending || []).map(card => cardNode(card, null, can("plant") && view.phase === "plant_traded")));
    renderFields(); renderPlayers(); renderReview(); renderOffer();
    byId("Players").scrollTop = otherScroll;
    byId("Log").replaceChildren(...view.history.slice().reverse().map(record => element("li", "", `${name(record.player_id)} · ${record.type.replaceAll("_", " ")}${record.bean ? ` · ${bean(record.bean).en}` : ""}${record.gold != null ? ` · ${record.gold}💰` : ""}`)));
    explain.refresh?.();
  }
  function clearState() {
    view = null; selected = null; harvestField = null; offerSeen = null; pending = false;
    clearTimeout(pendingTimer); hideTip(); explain.exit(); help.close();
    ["TradeDialog", "OfferDialog"].forEach(suffix => { if (byId(suffix).open) byId(suffix).close(); });
    byId("OfferReturn").classList.add("hidden");
    byId("Table").classList.add("hidden"); byId("Lobby").classList.remove("hidden");
    ["Hand", "Pending", "Players", "Fields", "Market", "Log", "Review", "Give", "Want", "OfferBody"].forEach(suffix => byId(suffix).replaceChildren());
  }
  byId("HelpBtn").addEventListener("click", () => { explain.exit(); hideTip(); help.open(); });
  byId("ExplainBtn").addEventListener("click", () => { hideTip(); explain.toggle(); });
  byId("TradeClose").addEventListener("click", () => byId("TradeDialog").close());
  byId("SendOffer").addEventListener("click", () => {
    const requested = Object.entries(want).flatMap(([kind, count]) => Array(count).fill(kind));
    send("offer", { target: byId("Target").value, give: [...give], want: requested });
    byId("TradeDialog").close();
  });
  byId("OfferDock").addEventListener("click", () => byId("OfferDialog").close());
  byId("OfferReturn").addEventListener("click", () => { if (!byId("OfferDialog").open) byId("OfferDialog").showModal(); });
  ["TradeDialog", "OfferDialog"].forEach(suffix => byId(suffix).addEventListener("click", event => {
    const rect = byId(suffix).getBoundingClientRect();
    if (event.target === byId(suffix) && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) byId(suffix).close();
  }));
  panel.addEventListener("pointerdown", event => { gesture = { x: event.clientX, y: event.clientY }; });
  panel.addEventListener("pointermove", event => {
    if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) { suppressClickUntil = Date.now() + 400; hideTip(); }
  });
  document.addEventListener("pointerup", () => { gesture = null; });
  document.addEventListener("pointercancel", () => { gesture = null; });
  panel.addEventListener("click", event => {
    if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!event.target.closest("button, select, .bn-card, .bn-confirm, .bn-counter")) {
      selected = null; harvestField = null; if (view) renderSelection();
      showTip(event.target.closest("[data-bn-tip]"));
    }
  }, true);
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse" && !event.target.closest("button")) showTip(event.target.closest("[data-bn-tip]")); });
  panel.addEventListener("pointerout", hideTip);
  panel.addEventListener("click", event => { if (!event.target.closest("button")) showTip(event.target.closest("[data-bn-tip]")); });
  panel.addEventListener("focusin", event => { if (!event.target.closest("button")) showTip(event.target.closest("[data-bn-tip]")); });
  document.addEventListener("scroll", hideTip, true);
  window.addEventListener("resize", hideTip);
  document.addEventListener("keydown", event => { if (event.key === "Escape") { hideTip(); selected = null; harvestField = null; if (view) renderSelection(); } });
  window.renderBohnanzaGameState = data => {
    if (data?.view?.game_id !== "bohnanza" || currentGameType !== "bohnanza") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const changed = view?.revision !== data.view.revision;
    if (changed) {
      pending = false; clearTimeout(pendingTimer); selected = null; harvestField = null; hideTip();
      if (byId("TradeDialog").open) byId("TradeDialog").close();
    }
    view = data.view; render();
  };
  window.clearBohnanzaState = clearState;
  window.showBohnanzaHeaderActions = visible => {
    byId("HeaderActions").style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };
  function syncRoom(state) {
    if (state?.game_type !== "bohnanza" || state.status === "lobby" || (roomId && roomId !== state.room_id)) clearState();
    roomId = state?.room_id;
  }
  function initialize() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); if (view) render(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); if (view) render(); hideTip(); });
    socket.on("connect", () => { if (view) render(); });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "bohnanza") window.renderBohnanzaGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
