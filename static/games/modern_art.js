(function () {
  "use strict";

  function init() {
    const byId = suffix => document.getElementById(`modernArt${suffix}`);
    const panel = byId("Panel");
    if (!panel || panel.dataset.maReady) return;
    panel.dataset.maReady = "true";
    const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    const kinds = { open: "Open", once: "Once around", sealed: "Sealed", fixed: "Fixed price", double: "Double" };
    let view = null;
    let activeRoom = null;
    let selection = [];
    let pending = false;
    let pendingTimer = null;
    let tooltipTimer = null;
    let gesture = null;
    let suppressClickUntil = 0;
    const explanations = {
      cash: { zh: "现金(💰)以千元 K 计。每人起始 100K，其他玩家看不到你的余额。最终财富等于 100K 加拍卖收入与四轮售画收入，再减去所有买画支出。未出手的手牌不计分。", en: "Cash (💰) is in thousands, K. You start with 100K and other players cannot see your balance. Final wealth is 100K plus auction receipts and four seasons of bank sales, minus purchases. Unplayed cards are worthless." },
      market: { zh: "五列顺序也是人气同分的优先顺序，从左到右。圆点显示本轮已展示的画作数，第五幅也计入，但不拍卖并立即结束本轮。前三名增加 30／20／10K 价值，只有本轮进入前三名的艺术家才能按历轮累计价值售画。", en: "Columns break popularity ties from left to right. Dots count paintings offered this season, including the fifth, which ends the season without being sold. The top three gain 30/20/10K. Only this season's top three sell for their accumulated value." },
      auction: { zh: "拍卖区展示实际待售的画，卡牌底部是拍卖方式。公开拍可随时加价，所有其他玩家明确让价后成交。一圈拍每人一次，拍卖师最后报价。暗拍所有人秘密提交一次。定价拍由拍卖师定价，其他人依次购买或放弃。双拍拍出同艺术家的两幅画，第二张决定方式。", en: "The lot shows the actual paintings, with auction type below each image. Open bids may be raised freely and close when everyone else declines. Once-around gives each player one chance, auctioneer last. Sealed bids are submitted privately. Fixed-price offers go around the table. Double lots pair two paintings by one artist and use the second card's auction type." },
      galleries: { zh: "画廊内是已买到的公开藏品，色彩与形状对应艺术家。手牌张数公开，内容和现金私密。每轮结束所有藏品卖给银行，未进本轮前三的画作一文不值。玩家始终以姓名而不是座位代号显示。", en: "Galleries are public purchased paintings, grouped by artist color and symbol. Hand counts are public but cards and cash are private. All gallery paintings sell to the bank at season end, for zero if outside this season's top three. Players are identified by name." },
      hand: { zh: "只有你能看到收藏手牌。轮到你时点选一幅，再在手牌旁确认上拍。双拍可再选一张同艺术家、非双拍的画一起上拍，也可单独上拍让其他人依次补牌。点击空白或 Cancel 取消选择，滑动浏览不选牌。", en: "Only you can see these cards. Select a painting on your turn and confirm beside the hand. A Double may be paired with your own matching non-Double, or offered alone for other players to add a card in order. Click blank space or Cancel to deselect. Scrolling does not select cards." },
      bid: { zh: "输入以千元 K 为单位的整数。报价是总价而非追加金额，且不能超过现金。暗拍可投 0，提交后不可更改，其他人看不到金额。同价时拍卖师优先，其次按拍卖师之后的座次。定价不能超过拍卖师的现金，无人购买时拍卖师必须按此价向银行买入。", en: "Enter a whole number of thousands, K. This is a total bid, not an increment, and cannot exceed your cash. Sealed bids may be zero and cannot be changed or seen by others. Ties favor the auctioneer, then clockwise order. Fixed prices must be affordable by the auctioneer, who buys from the bank if everyone declines." },
      confirm: { zh: "确认将所选画作公开上拍，或把配牌加入当前双拍。选择两张时第一张必须为双拍，第二张必须同艺术家且不是双拍。第五幅一经展示立即结束本轮，不再拍卖。", en: "Confirm the selected public lot or add a companion to a Double. Two-card lots must start with a Double and end with a matching non-Double. Revealing the fifth painting immediately ends the season without an auction." },
      pass: { zh: "放弃这次报价、购买或补牌机会。公开拍让价后仍可在有人加价时重新参与，一圈拍和定价拍则不能回头。无人报价时由拍卖师免费取得，定价拍例外，必须支付标价。", en: "Decline this bid, purchase or companion opportunity. An open-auction decline does not prevent re-entry after a raise. Once-around and fixed-price opportunities do not return. With no bids the auctioneer keeps the lot free, except fixed-price lots must be paid for." },
      next: { zh: "确认你已看过这次成交或轮末结算，所有人都确认后才继续。最终轮也先展示每人的完整收支明细，全部确认后才结束游戏并允许 Play Again，不会再弹出一次确认。", en: "Confirm that you have reviewed this sale or season result. Play waits for everyone. The final season shows a complete income and spending ledger before all players confirm and Play Again becomes available. There is no extra confirmation dialog." },
      results: { zh: "结算显示本轮人气、累计单价和每人的售画收入。终局额外公开起始现金、四轮售画、拍卖收入、买画支出与最终财富。同财富并列获胜，所有玩家确认后才结束。", en: "Settlement shows popularity, accumulated per-painting prices and each player's bank income. The final ledger reveals starting cash, four season incomes, auction receipts, purchase spending and final wealth. Wealth ties share victory. Everyone confirms before the game ends." },
      play_again: { zh: "所有人确认终局结果后，才可用相同玩家开始一局全新的游戏。重新洗牌、发牌并恢复每人 100K，不保留本局财富。", en: "After everyone confirms the final ledger, start a fresh game with the same players, a reshuffled deck and 100K each. Wealth does not carry over." },
      cancel: { zh: "取消尚未提交的手牌选择，不会影响其他玩家。", en: "Cancel the unsubmitted hand selection without changing the game." }
    };
    const help = window.obgCreateHelp({
      gameId: "modern_art", title: { zh: "现代艺术 · 经典基础版", en: "Modern Art · Classic edition" },
      basic: {
        win: { zh: "四轮结束后现金(💰)最多者获胜，同分并列。", en: "The most cash (💰) after four seasons wins, with shared ties." },
        turn: { zh: "轮到你时选择手牌上拍，其他人按卡牌方式竞价，买下的画在本轮结束卖给银行。", en: "On your turn offer a painting from your hand, auction it using its printed format and sell purchased paintings to the bank at season end." },
        key: { zh: "低买高卖并控制人气，任何艺术家的第五幅画一出现就结束本轮。", en: "Buy low, sell high and control popularity, because the fifth painting by any artist ends the season." }
      },
      sections: [
        { id: "market", label: { zh: "准备与市场", en: "Setup & market" }, html: {
          zh: "<p>经典基础版支持 3–5 人，每人现金(💰)100K，K 表示千元。70 张画作按从左到右的艺术家顺序分别为 12、13、14、15、16 张。三人前三轮每人发 10／6／6 张，四人为 9／4／4 张，五人为 8／3／3 张。第四轮不发新牌，未用手牌保留。</p><p>第一座位开始，此后按座次轮流上拍。手牌用完的人跳过，但仍能竞价。任何艺术家的第五幅画一出现，立即结束本轮，这幅画不拍卖但计入人气。人气相同从左到右优先，前三名获得 30／20／10K 价值。只有本轮前三名的画按历轮累计价值卖给银行，其余为零。所有画廊清空，手牌保留。下一轮从结束本轮玩家的下一位开始。</p>",
          en: "<p>The classic base game supports 3–5 players, each starting with cash (💰) of 100K, where K means thousands. The 70 paintings are distributed 12/13/14/15/16 in left-to-right artist order. Deal 10/6/6 per player over the first three seasons with three players, 9/4/4 with four, or 8/3/3 with five. Deal nothing in season four and keep unused cards.</p><p>The first seat starts and sellers rotate clockwise. Empty-handed sellers are skipped but can still bid. Offering any artist's fifth painting ends the season immediately. That card counts for popularity but is not auctioned. Popularity ties favor the leftmost artist. The top three gain 30/20/10K. Only the current top three sell for their cumulative historical value, everyone else for zero. Clear galleries but keep hands. The next season starts after the player who ended this one.</p>"
        } },
        { id: "auctions", label: { zh: "五种拍卖", en: "Five auctions" }, html: {
          zh: "<p><b>公开拍 Open：</b>所有人包括拍卖师均可随时加价。其他玩家明确让价后成交，让价不阻止之后加价。</p><p><b>一圈拍 Once around：</b>从拍卖师下一位开始，每人一次高于当前价的报价或放弃机会，拍卖师最后行动。</p><p><b>暗拍 Sealed：</b>所有人秘密提交整数，允许 0，最后同时揭晓。同价拍卖师优先，然后顺时针。提交不可更改。</p><p><b>定价拍 Fixed price：</b>拍卖师定一个自己付得起的价格，其他人依次买或放弃，无人买则拍卖师向银行付此价买下。</p><p><b>双拍 Double：</b>两幅同艺术家作品合售，第二幅不可为双拍，并决定拍卖方式。可自己出两张，或单出双拍，让后续玩家依次补一张。补牌者主持拍卖、获得全部拍卖收入，并在成交后由其下一位继续，不与原卖家平分。无人补牌，原卖家免费取得双拍。拍卖师自己买下整组时向银行付款。若双拍中途出现第五幅，已展示的牌不拍卖，未展示的配牌仍在手中。</p>",
          en: "<p><b>Open:</b> Anyone including the auctioneer can raise at any time. The lot closes after everyone else explicitly declines. Declining does not prevent a later raise.</p><p><b>Once around:</b> Starting after the auctioneer, everyone gets one raise above the current high bid or passes. The auctioneer acts last.</p><p><b>Sealed:</b> Everyone submits a private whole-number bid, including zero, and bids reveal together. Ties favor the auctioneer, then clockwise order. Submissions cannot change.</p><p><b>Fixed price:</b> The auctioneer sets an affordable price. Other players buy or decline in order. If all decline, the auctioneer pays the bank and keeps it.</p><p><b>Double:</b> Sell two paintings by one artist using the non-Double companion's format. Supply both yourself or offer the Double alone for others to add a companion in order. The contributor conducts the auction, receives all proceeds and play resumes after them. Proceeds are not split with the first seller. Without a companion the original seller keeps it free. An auctioneer buying their own lot pays the bank. If a fifth painting interrupts a Double, offered cards are not sold and any unoffered companion stays in hand.</p>"
        } },
        { id: "settlement", label: { zh: "资金与结算", en: "Money & results" }, html: {
          zh: `<p>${explanations.cash.zh}</p><p>普通拍卖由赢家付给卖家，卖家自己买则付给银行，无人竞价时免费取得。定价拍规则另计。现金不能为负，禁止借贷。手牌与现金不向旁观者公开，暗标金额只在揭晓后公开。</p><p>如果所有玩家在一轮内出完手牌，则游戏提前结束。最后展示的画计入人气，但不拍卖，也不作为藏品售卖，按当前人气完成最后一次结算。</p><p>${explanations.next.zh}</p><p>画廊(🎨)展示公开收藏。圆形(●)、菱形(◆)、三角(▲)、方形(■)和星形(✦)依次代表五位艺术家。手牌(🃏)为私密未上拍的画，锁(🔒)表示他人私密余额。画作使用原创程序图形，不使用商业画作素材。</p>`,
          en: `<p>${explanations.cash.en}</p><p>Normally the buyer pays the seller. Sellers buying their own lot pay the bank, or keep it free if nobody bids. Fixed-price rules are the exception. No debt is allowed. Hands and cash are hidden from spectators and sealed amounts reveal only after all submissions.</p><p>If every player runs out of cards during a season, the game ends early. The final offered painting counts for popularity but is not auctioned or sold to the bank. Settle the final season using current popularity.</p><p>${explanations.next.en}</p><p>Galleries (🎨) contain public collections. Circle (●), diamond (◆), triangle (▲), square (■) and star (✦) identify the five artists in order. Hand (🃏) means private unoffered paintings and lock (🔒) marks another player's private cash. Artwork is original procedural graphics, not commercial assets.</p>`
        } }
      ]
    });
    const explain = window.obgCreateExplain({
      gameId: "modern_art", root: () => document, attribute: "data-ma-explain", explanations: explanations,
      bypass: ["#modernArtHelpBtn", "#modernArtExplainBtn", ".obg-help-dialog"],
      onChange: active => byId("ExplainBtn").setAttribute("aria-pressed", String(active))
    });
    const name = playerId => view?.players.find(player => player.player_id === playerId)?.name || "Spectator";
    const artist = artistId => view.artists.find(entry => entry.id === artistId);
    const allowed = action => !pending && view?.legal_actions.includes(action);

    function describe(node, key, passive = false) {
      node.setAttribute("data-ma-explain", key);
      if (passive) {
        node.dataset.maTip = key;
        node.title = typeof explanations[key] === "string" ? explanations[key] : explanations[key].en;
        node.tabIndex = 0;
      }
      return node;
    }

    function artwork(cardId) {
      const card = view.card_catalog[cardId];
      const painter = artist(card.artist);
      const position = view.artists.indexOf(painter);
      const offset = Number(cardId.split("-").at(-1)) * 9;
      const motifs = [
        `<circle cx="${34 + offset}" cy="38" r="24" fill="${painter.color}"/><path d="M0 84 60 40 120 94v26H0Z" fill="#36565a"/>`,
        `<path d="M0 15h120v15H0Zm0 42h120v15H0Zm0 42h120v15H0Z" fill="${painter.color}"/><circle cx="${64 + offset}" cy="60" r="33" fill="#252f46" opacity=".8"/>`,
        `<path d="m${30 + offset} 8 70 95H4Z" fill="${painter.color}"/><path d="m80 5 37 65H42Z" fill="#263f51"/><circle cx="87" cy="94" r="18" fill="#c6a75f"/>`,
        `<path d="M0 30h120M0 60h120M0 90h120M30 0v120M60 0v120M90 0v120" stroke="#355246" stroke-width="3"/><path d="M${offset + 5} 32h52v52H5Z" fill="${painter.color}"/><path d="M63 63h50v50H63Z" fill="#d4af61"/>`,
        `<ellipse cx="${42 + offset}" cy="62" rx="32" ry="47" fill="${painter.color}"/><path d="M0 92 120 22v30L0 120Z" fill="#3a4b66"/><circle cx="88" cy="27" r="14" fill="#dbaf61"/>`
      ];
      return `<svg class="ma-artwork" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="120" height="120" fill="#dfd1b4"/>${motifs[position]}</svg>`;
    }

    function paintingExplanation(cardId) {
      const card = view.card_catalog[cardId];
      const painter = artist(card.artist);
      const key = `painting-${cardId}`;
      explanations[key] = {
        zh: `${painter.name} 的画作。拍卖方式为 ${kinds[card.kind]}，当前人气 ${view.counts[card.artist]}。${explanations.auction.zh}`,
        en: `${painter.name}. Auction: ${kinds[card.kind]}. Popularity this season: ${view.counts[card.artist]}. ${explanations.auction.en}`
      };
      return key;
    }

    function painting(cardId, interactive = false) {
      const card = view.card_catalog[cardId];
      const painter = artist(card.artist);
      const node = document.createElement(interactive ? "button" : "div");
      node.className = `ma-painting${selection.includes(cardId) ? " ma-selected" : ""}`;
      node.innerHTML = `${artwork(cardId)}<span class="ma-painting-name">${esc(painter.symbol)} ${esc(painter.name)}</span><span class="ma-painting-kind">${esc(kinds[card.kind])}</span>`;
      describe(node, paintingExplanation(cardId), !interactive);
      if (interactive) {
        node.type = "button";
        node.dataset.maCard = cardId;
        node.setAttribute("aria-pressed", String(selection.includes(cardId)));
        node.setAttribute("aria-label", `${painter.name}, ${kinds[card.kind]}`);
        node.disabled = !allowed("offer") && !allowed("add");
        node.addEventListener("click", () => selectCard(cardId));
      }
      return node;
    }

    function button(label, action, key, fields = {}) {
      const node = document.createElement("button");
      node.type = "button";
      node.textContent = label;
      node.disabled = !allowed(action);
      describe(node, key);
      node.addEventListener("click", () => send(action, fields));
      return node;
    }

    function send(type, fields = {}) {
      if (!allowed(type) || !view || explain.isActive()) return;
      pending = true;
      sendAction({ type, game_token: view.game_token, round: view.round, step: view.step, ...fields });
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => { pending = false; render(); }, 5000);
      render();
    }

    function selectCard(cardId) {
      if (Date.now() < suppressClickUntil || (!allowed("offer") && !allowed("add"))) return;
      if (selection.includes(cardId)) selection = [];
      else if (allowed("add")) {
        const first = view.card_catalog[view.auction.cards[0]];
        const card = view.card_catalog[cardId];
        if (card.artist !== first.artist || card.kind === "double") return;
        selection = [cardId];
      } else if (selection.length === 1 && view.card_catalog[selection[0]].kind === "double"
                 && view.card_catalog[cardId].artist === view.card_catalog[selection[0]].artist
                 && view.card_catalog[cardId].kind !== "double") selection.push(cardId);
      else selection = [cardId];
      renderHand();
      explain.refresh();
    }

    function renderHand() {
      const hand = byId("Hand");
      const controls = byId("Selection");
      let cards = [...hand.querySelectorAll("[data-ma-card]")];
      const anchor = cards.find(card => {
        const bounds = card.getBoundingClientRect();
        return bounds.bottom > 0 && bounds.top < window.innerHeight;
      });
      const anchorTop = anchor?.getBoundingClientRect().top;
      const focusedId = controls.contains(document.activeElement) ? document.activeElement.id : null;
      if (cards.length !== view.hand.length || cards.some((card, index) => card.dataset.maCard !== view.hand[index])) {
        cards = view.hand.map(cardId => painting(cardId, true));
        hand.replaceChildren(...cards, controls);
      }
      for (const card of cards) {
        paintingExplanation(card.dataset.maCard);
        const selected = selection.includes(card.dataset.maCard);
        card.classList.toggle("ma-selected", selected);
        card.setAttribute("aria-pressed", String(selected));
        card.disabled = !allowed("offer") && !allowed("add");
      }
      byId("HandCount").textContent = `${view.hand.length} private paintings`;
      controls.replaceChildren();
      controls.classList.toggle("hidden", !selection.length);
      if (selection.length) {
        const label = document.createElement("span");
        label.textContent = `${selection.length} selected${view.card_catalog[selection[0]].kind === "double" && selection.length === 1 ? " · Add a companion, or offer alone" : ""}`;
        const confirm = button(allowed("add") ? "Add painting" : "Offer lot", allowed("add") ? "add" : "offer", "confirm",
          allowed("add") ? { card: selection[0] } : { cards: [...selection] });
        confirm.id = "modernArtConfirmBtn";
        confirm.classList.add("ma-primary");
        const cancel = document.createElement("button");
        cancel.id = "modernArtCancelBtn";
        cancel.type = "button";
        cancel.textContent = "Cancel";
        describe(cancel, "cancel");
        cancel.addEventListener("click", () => { selection = []; renderHand(); explain.refresh(); });
        controls.append(label, confirm, cancel);
        const columns = getComputedStyle(hand).gridTemplateColumns.split(" ").length;
        const selectedIndex = view.hand.indexOf(selection[selection.length - 1]);
        const rowEnd = Math.min(cards.length - 1, Math.floor(selectedIndex / columns) * columns + columns - 1);
        hand.insertBefore(controls, cards[rowEnd].nextSibling);
      }
      if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
      if (anchor?.isConnected) window.scrollBy(0, anchor.getBoundingClientRect().top - anchorTop);
    }

    function renderMarket() {
      const rank = [...view.artists].sort((first, second) => view.counts[second.id] - view.counts[first.id] || view.artists.indexOf(first) - view.artists.indexOf(second));
      byId("Market").replaceChildren(...view.artists.map(painter => {
        const node = document.createElement("div");
        node.className = "ma-artist";
        node.style.setProperty("--artist", painter.color);
        const bonuses = view.values[painter.id];
        const position = rank.indexOf(painter);
        const settled = view.phase === "round_end" || view.game_over;
        const currentBonus = position < 3 && view.counts[painter.id] ? [30, 20, 10][position] : 0;
        const currentValue = settled ? view.round_summary?.values[painter.id] || 0 : currentBonus ? bonuses.reduce((total, value) => total + value, 0) + currentBonus : 0;
        node.innerHTML = `<span class="ma-artist-name">${esc(painter.symbol)} ${esc(painter.name)}</span><div class="ma-popularity">${Array.from({ length: 5 }, (_, index) => `<span class="${index < view.counts[painter.id] ? "ma-filled" : ""}"></span>`).join("")}</div><div class="ma-value-history">${Array.from({ length: 4 }, (_, index) => `<span>${bonuses[index] ?? "·"}</span>`).join("")}</div><strong class="ma-artist-value">${currentValue}K ${settled ? "" : "est."}</strong>`;
        const key = `artist-${painter.id}`;
        explanations[key] = { zh: `${painter.name}，当前 ${view.counts[painter.id]} 幅，${settled ? "结算" : "预计"}单价 ${currentValue}K。${explanations.market.zh}`, en: `${painter.name}, ${view.counts[painter.id]} paintings, ${settled ? "settled" : "projected"} value ${currentValue}K. ${explanations.market.en}` };
        return describe(node, key, true);
      }));
    }

    function renderPlayers() {
      byId("Players").replaceChildren(...view.players.map((player, index) => {
        const node = document.createElement("div");
        node.className = `ma-player${player.player_id === view.you ? " ma-you" : ""}`;
        const ready = view.next_ready.includes(player.player_id) ? " · Ready" : "";
        const submitted = view.auction?.submitted?.includes(player.player_id) ? " · Submitted" : "";
        const holdings = view.artists.map(painter => {
          const count = player.gallery.filter(cardId => view.card_catalog[cardId].artist === painter.id).length;
          return count ? `<span class="ma-gallery-count" style="--artist:${painter.color}">${esc(painter.symbol)} ${count}</span>` : "";
        }).join("");
        node.innerHTML = `<div class="ma-player-top"><span class="ma-player-name">${["●", "◆", "▲", "■", "✦"][index]} ${esc(player.name)}${player.player_id === view.you ? " · You" : ""}</span><span class="ma-player-meta">${player.hand_count} cards${ready}${submitted}</span></div><div class="ma-player-gallery">${holdings || '<span class="ma-muted">No paintings yet</span>'}</div>`;
        const key = `gallery-${player.player_id}`;
        explanations[key] = { zh: `${player.name}，${player.hand_count} 张手牌，画廊 ${player.gallery.length} 幅。${explanations.galleries.zh}`, en: `${player.name}, ${player.hand_count} cards in hand and ${player.gallery.length} paintings. ${explanations.galleries.en}` };
        return describe(node, key, true);
      }));
    }

    function renderAuction() {
      const auction = view.auction;
      const reviewed = ["auction_end", "round_end", "game_over"].includes(view.phase);
      byId("AuctionKind").textContent = auction ? kinds[auction.kind] || "Double" : "";
      byId("Lot").replaceChildren();
      if (auction) byId("Lot").append(...auction.cards.map(cardId => painting(cardId)));
      else {
        const empty = document.createElement("div");
        empty.className = "ma-empty-lot";
        empty.textContent = allowed("offer") ? "Choose the next masterpiece." : "A new masterpiece is on its way.";
        byId("Lot").append(empty);
      }
      let text = "";
      if (auction && view.phase === "auction_end") {
        text = `${name(auction.buyer)} acquired the lot for ${auction.paid}K.`;
        if (auction.owners.length === 2) text += ` All proceeds ${auction.paid}K ${auction.auctioneer === auction.buyer ? "to the bank" : `to ${name(auction.auctioneer)}`}.`;
        text += " Review before continuing.";
      }
      else if (auction && view.phase === "double") text = `${name(auction.origin)} offers a Double. ${name(view.current_turn)} may add a matching painting.`;
      else if (auction && view.phase === "price") text = `${name(auction.auctioneer)} sets the price.`;
      else if (auction && view.phase === "fixed") text = `${name(auction.auctioneer)} asks ${auction.price}K · ${name(view.current_turn)} has first refusal.`;
      else if (auction && view.phase === "sealed") text = `${name(auction.auctioneer)} conducts a sealed auction. ${auction.submitted.length}/${view.players.length} bids submitted.${view.your_bid !== null && view.your_bid !== undefined ? ` Your locked bid: ${view.your_bid}K.` : ""}`;
      else if (auction && !reviewed) text = `${name(auction.auctioneer)} conducts the auction · High bid ${auction.high_bid}K by ${name(auction.high_bidder)}.${auction.passed?.length ? ` Declined: ${auction.passed.map(name).join(", ")}.` : ""}`;
      else if (view.phase === "offer") text = `${name(view.current_turn)} is choosing a painting.`;
      else if (reviewed) text = view.final_results.length ? "Final ledger · review the results below." : "Season closed · review the results below.";
      byId("AuctionInfo").textContent = text;
      if (auction?.kind === "sealed" && view.phase === "auction_end") {
        const revealed = document.createElement("div");
        revealed.className = "ma-revealed-bids";
        view.players.forEach(player => {
          const bid = document.createElement("span");
          bid.className = player.player_id === view.you ? "ma-you" : "";
          bid.textContent = `${player.name}${player.player_id === view.you ? " · You" : ""}: ${auction.bids[player.player_id]}K`;
          revealed.append(bid);
        });
        byId("AuctionInfo").append(revealed);
      }
      const canBid = allowed("bid");
      const canPrice = allowed("set_price");
      byId("BidForm").classList.toggle("hidden", !canBid && !canPrice);
      const minimum = canPrice || view.phase === "sealed" ? 0 : (auction?.high_bid || 0) + 1;
      byId("Amount").min = String(minimum);
      byId("Amount").max = String(view.cash ?? 0);
      const current = Number(byId("Amount").value);
      if (!byId("Amount").value || current < minimum || current > view.cash) byId("Amount").value = String(Math.min(view.cash ?? minimum, minimum));
      byId("BidBtn").textContent = canPrice ? "Set price" : view.phase === "sealed" ? "Seal bid" : "Raise bid";
      byId("BidBtn").disabled = !canBid && !canPrice;
      byId("AuctionButtons").replaceChildren();
      if (view.legal_actions.includes("buy")) byId("AuctionButtons").append(button(`Buy · ${auction.price}K`, "buy", "bid"));
      if (view.legal_actions.includes("pass")) byId("AuctionButtons").append(button("Pass", "pass", "pass"));
      if (view.legal_actions.includes("next_round")) {
        const next = button(view.phase === "auction_end" ? "Continue" : view.final_results.length ? "Confirm results" : "Next Round", "next_round", "next");
        next.id = "modernArtNextBtn";
        next.classList.add("ma-primary");
        byId("AuctionButtons").append(next);
      }
    }

    function renderResults() {
      const result = byId("Results");
      result.replaceChildren();
      const summary = view.round_summary;
      result.classList.toggle("hidden", !summary);
      if (!summary) return;
      const heading = document.createElement("h3");
      heading.className = "ma-caption";
      heading.textContent = view.final_results.length ? "Final ledger · all amounts in K" : `Season ${view.round} · bank sales`;
      result.append(heading);
      const rows = view.final_results.length ? view.final_results : summary.rows;
      rows.forEach(row => {
        const node = document.createElement("div");
        node.className = `ma-result-row${row.player_id === view.you ? " ma-you" : ""}`;
        node.innerHTML = view.final_results.length
          ? `<strong>${esc(name(row.player_id))}${view.winner.includes(row.player_id) ? " · Winner" : ""} · ${row.total}K</strong><br>Start ${row.initial} + bank ${row.income} + auctions ${row.sales} − purchases ${row.spent}<br><span class="ma-muted">Seasons: ${row.round_income.join(" / ")}K</span>`
          : `<strong>${esc(name(row.player_id))} · +${row.income}K</strong><br><span class="ma-muted">${row.cards.length} paintings sold${row.cards.length ? ` · ${view.artists.map(painter => { const count = row.cards.filter(cardId => view.card_catalog[cardId].artist === painter.id).length; return count ? `${painter.name} ${count} × ${summary.values[painter.id]}K` : ""; }).filter(Boolean).join(", ")}` : ""}</span>`;
        result.append(node);
      });
      if (view.game_over && view.players.some(player => player.player_id === view.you)) {
        const again = document.createElement("button");
        again.type = "button";
        again.id = "modernArtPlayAgainBtn";
        again.textContent = "Play Again";
        again.className = "ma-primary";
        again.disabled = pending;
        describe(again, "play_again");
        again.addEventListener("click", () => {
          if (pending || !view.game_over || explain.isActive()) return;
          pending = true;
          socket.emit("room:start", { config: {} });
          clearTimeout(pendingTimer);
          pendingTimer = setTimeout(() => { pending = false; render(); }, 5000);
          render();
        });
        result.append(again);
      }
    }

    function render() {
      if (!view) return;
      byId("Lobby").classList.add("hidden");
      byId("Table").classList.remove("hidden");
      byId("Season").textContent = `SEASON ${view.round} / 4`;
      byId("Cash").textContent = view.cash === null ? "Spectator" : `💰 ${view.cash}K`;
      describe(byId("Cash"), "cash", true);
      byId("Status").textContent = view.game_over ? "Game over" : pending ? "Sending…" : view.legal_actions.length ? "Your decision" : view.next_ready.includes(view.you) ? "Confirmed · waiting for the table" : view.phase === "sealed" && view.auction?.submitted.includes(view.you) ? "Bid sealed · waiting for the table" : view.current_turn ? `Waiting for ${name(view.current_turn)}` : "Waiting for the table";
      renderMarket();
      renderPlayers();
      renderAuction();
      renderHand();
      renderResults();
      byId("Log").replaceChildren(...view.log.slice(-70).reverse().map(entry => {
        const node = document.createElement("li");
        node.textContent = `Season ${entry.round} · ${entry.text}`;
        return node;
      }));
      explain.refresh();
    }

    function hideTip() {
      clearTimeout(tooltipTimer);
      byId("Tooltip").classList.add("hidden");
    }

    function showTip(node) {
      if (explain.isActive() || help.isOpen()) return;
      const entry = explanations[node.dataset.maTip];
      if (!entry) return;
      hideTip();
      const tip = byId("Tooltip");
      tip.textContent = typeof entry === "string" ? entry : entry[window.obgHelpLang?.() || "en"] || entry.en;
      tip.classList.remove("hidden");
      const rect = node.getBoundingClientRect();
      const bounds = tip.getBoundingClientRect();
      tip.style.left = `${Math.max(10, Math.min(innerWidth - bounds.width - 10, rect.left))}px`;
      tip.style.top = `${Math.max(10, Math.min(innerHeight - bounds.height - 10, rect.bottom + 6))}px`;
      tooltipTimer = setTimeout(hideTip, 3000);
    }

    function reset() {
      view = null;
      activeRoom = null;
      selection = [];
      pending = false;
      clearTimeout(pendingTimer);
      help.close();
      explain.exit();
      hideTip();
      byId("Lobby").classList.remove("hidden");
      byId("Table").classList.add("hidden");
    }

    function renderState(data) {
      if (data?.game_type !== "modern_art" || !data.view) return;
      if (typeof currentRoomState !== "undefined" && currentRoomState?.room_id && currentRoomState.room_id !== data.room_id) return;
      const changed = activeRoom !== data.room_id || view?.you !== data.view.you || view?.game_token !== data.view.game_token || view?.step !== data.view.step;
      activeRoom = data.room_id;
      view = data.view;
      pending = false;
      clearTimeout(pendingTimer);
      if (changed) { selection = []; byId("Amount").value = ""; }
      hideTip();
      render();
    }

    function syncRoom(room) {
      if (!room || room.game_type !== "modern_art" || room.status === "lobby") reset();
    }

    byId("HelpBtn").addEventListener("click", () => { hideTip(); explain.exit(); help.open(); });
    byId("ExplainBtn").addEventListener("click", () => { hideTip(); explain.toggle(); });
    byId("BidForm").addEventListener("submit", event => {
      event.preventDefault();
      if (explain.isActive()) return;
      const amount = Number(byId("Amount").value);
      if (byId("Amount").value.trim() && Number.isSafeInteger(amount) && amount >= 0) send(allowed("set_price") ? "set_price" : "bid", { amount });
    });
    panel.addEventListener("pointerdown", event => { gesture = { x: event.clientX, y: event.clientY, moved: false }; });
    panel.addEventListener("pointermove", event => {
      if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) { gesture.moved = true; suppressClickUntil = Date.now() + 400; }
    });
    window.addEventListener("pointerup", () => { if (gesture?.moved) suppressClickUntil = Date.now() + 400; gesture = null; });
    window.addEventListener("pointercancel", () => { gesture = null; suppressClickUntil = Date.now() + 400; });
    panel.addEventListener("click", event => {
      if (Date.now() < suppressClickUntil) return;
      const passive = event.target.closest("[data-ma-tip]");
      if (passive && !event.target.closest("button,input,select")) { showTip(passive); return; }
      if (event.target.closest("button,input,select,summary,.ma-selection")) return;
      if (selection.length) { selection = []; renderHand(); explain.refresh(); }
    });
    panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") { const node = event.target.closest("[data-ma-tip]"); if (node) showTip(node); } });
    panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") { hideTip(); selection = []; if (view) { renderHand(); explain.refresh(); } }
    });
    window.addEventListener("scroll", hideTip, true);
    window.addEventListener("resize", () => {
      hideTip();
      if (view) { renderHand(); explain.refresh(); }
    });
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { if (pending) { pending = false; clearTimeout(pendingTimer); render(); } });
    window.renderModernArtGameState = renderState;
    window.showModernArtHeaderActions = visible => { byId("HeaderActions").style.display = visible ? "flex" : "none"; if (!visible) reset(); };
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && typeof currentRoomState !== "undefined"
        && lastGameStatePayload?.room_id === currentRoomState?.room_id && currentRoomState?.status !== "lobby") renderState(lastGameStatePayload);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
