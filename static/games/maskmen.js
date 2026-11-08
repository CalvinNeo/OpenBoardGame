(() => {
  "use strict";
  const byId = suffix => document.getElementById(`maskmen${suffix}`);
  const panel = byId("Panel"), header = byId("HeaderActions"), dialog = byId("Dialog"), tooltip = byId("Tooltip");
  const masks = {
    orange: ["🟠", "橙面具", "Orange", "◆"], pink: ["🩷", "粉面具", "Pink", "♥"],
    grey: ["⚪", "灰面具", "Grey", "▲"], blue: ["🔵", "蓝面具", "Blue", "≈"],
    purple: ["🟣", "紫面具", "Purple", "★"], green: ["🟢", "绿面具", "Green", "◇"],
  };
  const label = mask => masks[mask] ? `${masks[mask][0]} ${masks[mask][1]}` : "—";
  const reasons = {debut:"Debut · 1 card", lead:"Lead · choose 1–3", stronger:"Stronger · same count", establish:"Unknown · one extra"};
  const MASKMEN_EXPLAIN = {
    season: {
      zh: "Season · 赛季：3 到 6 人共 4 赛季，总分最高者胜，2 人先赢 3 赛季者胜。2 到 4 人各发 15 张、5 人各 12 张、6 人各 10 张。每赛季重洗全部 60 张牌并清空强弱关系，未发出的牌暗置且不会再抽。",
      en: "Season: 3 to 6 players play 4 seasons and the highest total wins, while 2 players race to 3 season wins. You are dealt 15 cards with 2 to 4 players, 12 with 5 and 10 with 6. Every season reshuffles all 60 cards and clears the strength relations, and undealt cards stay face down and are never drawn."
    },
    round: {
      zh: "Round · 小轮：轮流出牌或 Pass(🏳️)，Pass 后本小轮不能再出牌。仅剩一位未 Pass 且有手牌的玩家时暂停展示结果，全员 Next Round 后由该玩家领出并清空所有 Pass 状态。面具的强弱关系保留到赛季结束。",
      en: "Round: players take turns playing or passing (🏳️), and once you pass you cannot play again this round. When only one player with cards has not passed the round pauses for review, and after everyone presses Next Round that player leads and all pass states clear. Mask strengths persist until the season ends."
    },
    strength: {
      zh: "Strength · 强弱关系：每行列出该面具已知胜过谁。关系可以传递，蓝面具(🔵)胜橙面具(🟠)、橙面具胜绿面具(🟢)，则蓝面具也胜绿面具。两个都胜绿色的面具之间仍可能未知。比较表里 ✓ 表示行胜列，× 表示行负列，? 表示未确定，— 表示同种。未知不等于同样强，也不按排列位置判断。",
      en: "Strength: each row lists the masks that mask is known to beat. Relations are transitive, so if blue (🔵) beats orange (🟠) and orange beats green (🟢) then blue also beats green. Two masks that both beat green may still be unknown to each other. In the comparison table ✓ means the row beats the column, × means it loses, ? means unknown and — means the same mask. Unknown never means equally strong, and the row order is not a ranking."
    },
    hand: {
      zh: "Cards(🂠) · 手牌：六种面具各 10 张，手牌只向本人显示，其他人只能看剩余张数。卡牌上的 ×N 是你持有的数量，不是强度。点选面具，再选合法张数并 Play，灰色表示当前无法出牌。",
      en: "Cards (🂠): there are 10 of each of the six masks, your hand is visible only to you and others just see the count. The ×N on a card is how many you hold, not its strength. Select a mask, choose a legal count and press Play, and a greyed card cannot be played right now."
    },
    score: {
      zh: "Score(🏅) · 积分：赛季按出完手牌先后排名，第一 +2、第二 +1、末名 −1、其他 0。两人时胜者 +2、负者 −1，但胜负按先赢 3 季判断。显示的累计分在赛季结束时更新，奖杯(🏆)是赛季冠军次数。",
      en: "Score (🏅): each season ranks players by the order they empty their hands, giving +2 for first, +1 for second, −1 for last and 0 otherwise. With two players the winner gets +2 and the loser −1, but the match is decided by who reaches 3 season wins first. The running total updates when a season ends and the trophy (🏆) counts season wins."
    },
    play: {
      zh: "Play · 出牌：一手只能出一种面具，最多 3 张。领出时本季首次出现的面具只能出 1 张，已出现的可以出 1 到 3 张。接牌时已知更强的必须出相同张数，强弱未知的必须恰好多出 1 张并确立关系。同种、较弱或超过 3 张都不能出。点击空白或按 Esc 取消选择。",
      en: "Play: a single play uses one mask only and at most 3 cards. When leading, a mask appearing for the first time this season must be played as a single card, while a mask already seen may be played as 1 to 3. When following, a known stronger mask must match the count exactly and an unknown mask must use exactly one more card and establish the relation. You can never play the same mask, a weaker one, or more than 3 cards. Click blank space or press Esc to cancel."
    },
    pass: {
      zh: "Pass(🏳️) · 弃权：不出牌并退出当前小轮，之后不能重新加入，直到全员 Next Round。即使有合法牌也可以 Pass，但空桌首出不能 Pass。",
      en: "Pass (🏳️): skip your play and drop out of the current round, and you cannot rejoin until everyone presses Next Round. You may pass even with a legal play, but you cannot pass when leading an empty table."
    },
    next: {
      zh: "Next Round / Next Season：确认已看完当前结果，无需二次确认。所有玩家都点击后才继续，AI 只确认自己，断线真人需重连确认。Next Round 清空桌面，Next Season 重新发牌并重置强弱关系。",
      en: "Next Round / Next Season: confirm that you have read the result, with no second confirmation. Play continues only after every player presses it, AI confirms only for itself and a disconnected human must reconnect. Next Round clears the table while Next Season redeals and resets the strength relations."
    },
    orange: {
      zh: "橙面具(🟠)：每种面具各 10 张，没有任何固定强度。本季是否已经亮相决定你领出时只能出 1 张还是可以出 1 到 3 张。",
      en: "Orange mask (🟠): there are 10 of each mask and none has a fixed strength. Whether it has already appeared this season decides if you may lead with only 1 card or with 1 to 3."
    },
    pink: {
      zh: "粉面具(🩷)：每种面具各 10 张，没有任何固定强度。本季是否已经亮相决定你领出时只能出 1 张还是可以出 1 到 3 张。",
      en: "Pink mask (🩷): there are 10 of each mask and none has a fixed strength. Whether it has already appeared this season decides if you may lead with only 1 card or with 1 to 3."
    },
    grey: {
      zh: "灰面具(⚪)：每种面具各 10 张，没有任何固定强度。本季是否已经亮相决定你领出时只能出 1 张还是可以出 1 到 3 张。",
      en: "Grey mask (⚪): there are 10 of each mask and none has a fixed strength. Whether it has already appeared this season decides if you may lead with only 1 card or with 1 to 3."
    },
    blue: {
      zh: "蓝面具(🔵)：每种面具各 10 张，没有任何固定强度。本季是否已经亮相决定你领出时只能出 1 张还是可以出 1 到 3 张。",
      en: "Blue mask (🔵): there are 10 of each mask and none has a fixed strength. Whether it has already appeared this season decides if you may lead with only 1 card or with 1 to 3."
    },
    purple: {
      zh: "紫面具(🟣)：每种面具各 10 张，没有任何固定强度。本季是否已经亮相决定你领出时只能出 1 张还是可以出 1 到 3 张。",
      en: "Purple mask (🟣): there are 10 of each mask and none has a fixed strength. Whether it has already appeared this season decides if you may lead with only 1 card or with 1 to 3."
    },
    green: {
      zh: "绿面具(🟢)：每种面具各 10 张，没有任何固定强度。本季是否已经亮相决定你领出时只能出 1 张还是可以出 1 到 3 张。",
      en: "Green mask (🟢): there are 10 of each mask and none has a fixed strength. Whether it has already appeared this season decides if you may lead with only 1 card or with 1 to 3."
    },
    dialog_close: {
      zh: "关闭当前对话框并回到牌桌。",
      en: "Close the current dialog and return to the table."
    }
  };

  const MASKMEN_HELP_CONFIG = {
    gameId: "maskmen",
    title: { zh: "面具人 · Maskmen", en: "Maskmen" },
    basic: {
      win: {
        zh: "尽快出完手牌。3 到 6 人打 4 个赛季，按出完顺序计分后总分最高者获胜，2 人则是先赢 3 个赛季者获胜。",
        en: "Empty your hand as fast as you can. With 3 to 6 players you play 4 seasons, score by the order you finish and the highest total wins, while with 2 players the first to win 3 seasons takes the match."
      },
      turn: {
        zh: "轮到你时出一手同种面具的牌，或者 Pass(🏳️)退出本小轮。领出空桌时首次亮相的面具只能出 1 张，接牌时必须用已知更强的同张数或未知面具恰好多 1 张。",
        en: "On your turn you either play one mask in a single play or pass (🏳️) out of the round. Leading an empty table with a mask that has not appeared yet allows only 1 card, and following requires either a known stronger mask at the same count or an unknown mask at exactly one card more."
      },
      key: {
        zh: "每次接牌都在给全场建立强弱关系，而关系可以传递，所以真正要算的是这一手会替对手铺好多少条压制链，而不是眼前能不能出完。",
        en: "Every follow builds a strength relation for the whole table and those relations are transitive, so the real calculation is how many domination chains this play hands to your opponents rather than whether you can shed a card right now."
      }
    },
    sections: [
      {
        id: "goal",
        label: { zh: "目标与牌组", en: "Goal and deck" },
        html: {
          zh: "<p>尽快出完手牌。六种面具各 10 张，分别是橙面具(🟠)、粉面具(🩷)、灰面具(⚪)、蓝面具(🔵)、紫面具(🟣)和绿面具(🟢)，共 60 张。颜色和额头图案只用于区分面具，没有预设大小。手牌(🂠)显示剩余张数，×N 表示同种牌的数量。</p><p>2 到 4 人各发 15 张，5 人各 12 张，6 人各 10 张。未发出的牌暗置，本季不使用也不补牌。首季随机首家，下一季由上季末名首出。</p>",
          en: "<p>Empty your hand as fast as you can. There are 10 of each of the six masks, orange (🟠), pink (🩷), grey (⚪), blue (🔵), purple (🟣) and green (🟢), for 60 cards in total. Colours and forehead marks only tell masks apart and carry no built in ranking. Cards (🂠) shows what is left and ×N is how many of that mask you hold.</p><p>You are dealt 15 cards with 2 to 4 players, 12 with 5 and 10 with 6. Undealt cards stay face down, are not used this season and are never redrawn. The first season starts with a random leader and the next season is led by last season's last place.</p>"
        }
      },
      {
        id: "play",
        label: { zh: "领出与接牌", en: "Leading and following" },
        html: {
          zh: "<p>每次只能出同一种面具，最多 3 张。空桌首出时，若该面具本季还没出现过只能出 1 张，已经出现过的面具可以出 1 到 3 张。</p><ul><li>已知更强：必须与桌面最后一手<strong>相同张数</strong>。</li><li>相对强弱未知：必须<strong>恰好多出 1 张</strong>，并确定新面具更强。</li><li>同种或已知更弱不能接牌，也不能出超过 3 张。</li></ul><p class='maskmen-example'>🔵 ×1 → 🩷 ×2 → 🟢 ×3<br>确立 🟢 胜 🩷、🩷 胜 🔵，所以 🟢 也胜 🔵。<br>下一小轮若 🔵 ×1，🟢 ×1 就能压过。</p>",
          en: "<p>A single play uses one mask only and at most 3 cards. When leading an empty table, a mask that has not appeared this season must be played as a single card while a mask already seen may be played as 1 to 3.</p><ul><li>Known stronger: you must match the <strong>same count</strong> as the last play on the table.</li><li>Unknown relation: you must play <strong>exactly one card more</strong> and establish the new mask as stronger.</li><li>You cannot follow with the same mask or a known weaker one, and never with more than 3 cards.</li></ul><p class='maskmen-example'>🔵 ×1 → 🩷 ×2 → 🟢 ×3<br>This sets 🟢 over 🩷 and 🩷 over 🔵, so 🟢 also beats 🔵.<br>Next round a 🔵 ×1 can be beaten by 🟢 ×1.</p>"
        }
      },
      {
        id: "strength",
        label: { zh: "强弱关系", en: "Strength" },
        html: {
          zh: "<p>关系具有传递性。若橙面具(🟠)和绿面具(🟢)都胜粉面具(🩷)，还不能判断橙与绿谁强。强弱板每行只列出已知较弱的面具，比较表里 ✓ 表示行胜列、× 表示行负列、? 表示未知、— 表示同种，行的排列不表示排名。所有关系在赛季结束后重置。</p>",
          en: "<p>Relations are transitive. If orange (🟠) and green (🟢) both beat pink (🩷) you still cannot tell which of orange and green is stronger. The strength board lists only the masks known to be weaker on each row, and in the comparison table ✓ means the row beats the column, × means it loses, ? means unknown and — means the same mask, while the row order is not a ranking. Every relation resets when the season ends.</p>"
        }
      },
      {
        id: "pass",
        label: { zh: "弃权与小轮结束", en: "Passing and round end" },
        html: {
          zh: "<p>不能或不想出牌都可以 Pass(🏳️)，之后退出本小轮，空桌首出不能 Pass。只剩一位未 Pass 且仍有牌的玩家时本小轮结束，由其下一轮领出。若最后出牌者已出完、其他有牌玩家也都 Pass，则顺时针下一位有牌者领出。出完牌的玩家退出本赛季出牌，但仍参与结果确认。</p>",
          en: "<p>You may pass (🏳️) whether or not you can play, after which you are out of the round, and you cannot pass when leading an empty table. The round ends when only one player with cards has not passed, and that player leads the next round. If the last player to play has finished and every other player with cards has passed, the next player clockwise who still holds cards leads instead. Players who empty their hands stop playing for the season but still confirm the results.</p>"
        }
      },
      {
        id: "score",
        label: { zh: "积分与赛季冠军", en: "Score and season wins" },
        html: {
          zh: "<p>按出完手牌顺序排名，直到只剩一人有牌：第一 +2、第二 +1、最后 −1、其他 0。累计分在赛季结算时更新。3 到 6 人打 4 赛季，总分最高者胜。同分先看冠军数(🏆)，再看谁最近赢过赛季，如果并列者都没赢过赛季则按最后赛季的出完顺序决定。</p><p><strong>2 人模式：</strong>先赢 3 赛季就结束，最多打 5 季。界面同时显示胜场与积分，胜负依据胜场。</p>",
          en: "<p>Players are ranked by the order they empty their hands until only one player still holds cards, scoring +2 for first, +1 for second, −1 for last and 0 otherwise. Totals update when a season is scored. With 3 to 6 players you play 4 seasons and the highest total wins. Ties go first to the season win count (🏆), then to whoever won a season most recently, and if nobody in the tie has won a season the finishing order of the last season decides.</p><p><strong>Two player mode:</strong> the match ends as soon as someone wins 3 seasons, after at most 5. The screen shows both wins and points, and the result follows the wins.</p>"
        }
      },
      {
        id: "online",
        label: { zh: "线上操作与约定", en: "Online notes" },
        html: {
          zh: "<p>点选手牌，选合法张数，再 Play。点击空白或按 Esc 取消。每小轮保留桌面，所有人 Next Round 后清场，每赛季所有人 Next Season 后再发牌。AI 自动确认自己，断线真人不会被跳过。</p><p>本版采用 60 张规则。出完牌后的首家递补、完全未夺冠时的破平为明确的线上边界约定。AI 根据自己的牌和公开信息评估清牌、保留组合、强弱关系和对手接牌概率，不读取其他玩家的手牌。</p><p>点击 Explain 后点有虚线的对象即可查看解释，禁用按钮也支持，按 Esc 退出。静态指标可悬停或聚焦查看提示，手机点按显示 3 秒。</p>",
          en: "<p>Select a card, choose a legal count, then press Play. Click blank space or press Esc to cancel. Each round keeps the table until everyone presses Next Round, and each season redeals once everyone presses Next Season. AI confirms for itself and a disconnected human is never skipped.</p><p>This build uses the 60 card rules. Passing the lead on after a player finishes and breaking a tie where nobody has won a season are explicit online conventions. The AI evaluates hand clearing, kept combinations, strength relations and the chance of opponents following using only its own cards and public information, and never reads another player's hand.</p><p>Press Explain and then tap any outlined object to read its rule, disabled buttons included, and press Esc to leave. Static figures can be hovered or focused for a tip, and a tap on a phone shows one for 3 seconds.</p>"
        }
      }
    ]
  };

  let maskmenHelpWidget = null;
  let maskmenExplainWidget = null;

  function initMaskmenHelpExplain() {
    if (maskmenHelpWidget || typeof window.obgCreateHelp !== "function") return;
    maskmenHelpWidget = window.obgCreateHelp(MASKMEN_HELP_CONFIG);
    maskmenExplainWidget = window.obgCreateExplain({
      gameId: "maskmen",
      attribute: "data-mm-explain",
      explanations: MASKMEN_EXPLAIN,
      button: byId("ExplainBtn"),
      root: () => panel,
      bypass: ["#maskmenHelpBtn", "#maskmenExplainBtn", "#maskmenDialogClose"]
    });
    byId("HelpBtn")?.addEventListener("click", () => {
      maskmenExplainWidget?.exit();
      maskmenHelpWidget.open();
    });
    byId("ExplainBtn")?.addEventListener("click", () => maskmenExplainWidget?.toggle());
  }
  let view = null, selected = null, count = null, pending = false;
  let pendingTimer, tipTimer, focusBeforeDialog = null, signature = null;

  function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    return node;
  }
  function text(suffix, value) { byId(suffix).textContent = value; }
  function name(pid) { return view?.players.find(p => p.player_id === pid)?.name || pid || "—"; }
  function tip(node, message, key) {
    node.dataset.mmTip = message; node.tabIndex = 0;
    if (key) node.dataset.mmExplain = key;
    return node;
  }
  function face(mask) {
    const node = el("span", "maskmen-face");
    node.setAttribute("aria-hidden", "true");
    node.append(el("span", "maskmen-face-mark", masks[mask][3]));
    return node;
  }
  function card(mask, copies, interactive = false) {
    const node = el(interactive ? "button" : "div", `maskmen-card maskmen-color-${mask}`);
    node.dataset.mask = mask; node.dataset.mmExplain = mask;
    if (interactive) node.type = "button";
    else tip(node, `${label(mask)} ×${copies}：桌面最近一次出牌。`, mask);
    node.setAttribute("aria-label", `${label(mask)}, ${copies} cards`);
    node.append(face(mask), el("span", "maskmen-card-label", masks[mask][1]), el("span", "maskmen-card-count", `×${copies}`));
    return node;
  }
  function can(kind) { return !!view && !pending && socket.connected && view.legal_actions.includes(kind); }
  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function showTip(target, autoHide = false) {
    if (!target || maskmenExplainWidget?.isActive() || maskmenHelpWidget?.isOpen() || dialog.open) return;
    clearTimeout(tipTimer); tooltip.textContent = target.dataset.mmTip; tooltip.classList.remove("hidden");
    const r = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(r.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${r.bottom + box.height + 15 < innerHeight ? r.bottom + 6 : Math.max(12, r.top - box.height - 6)}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function clearSelection() { selected = null; count = null; renderHand(); }
  function dispatch(kind, fields = {}) {
    if (!can(kind)) return;
    pending = true; clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; renderHand(); renderActions(); }, 2500);
    const context = Object.fromEntries(["game_token", "season", "bout", "turn_number"].map(key => [key, view[key]]));
    sendAction({type:kind, ...fields, ...context}); renderHand(); renderActions();
  }
  function renderActions() {
    byId("Pass").disabled = !can("pass");
    const next = view?.phase === "round_review" ? "next_round" : "next_season";
    byId("Next").disabled = !can(next);
    text("Next", view?.ready.includes(view.you) ? "Ready ✓" : next === "next_round" ? "Next Round" : "Next Season");
  }
  function renderHand() {
    const hand = byId("Hand"); hand.replaceChildren();
    if (!view) { byId("Selection").classList.add("hidden"); return; }
    const own = view.players.find(p => p.player_id === view.you);
    text("HandTitle", own ? "Your hand" : "Spectating"); text("HandCount", own ? `🂠 ${own.card_count}` : "");
    Object.keys(masks).forEach(mask => {
      if (!view.your_hand[mask]) return;
      const node = card(mask, view.your_hand[mask], true);
      const moves = view.legal_plays.filter(move => move.mask === mask);
      const beats = view.strength[mask] || [];
      tip(node, `${label(mask)}：${view.introduced.includes(mask) ? "本季已亮相，领出可选 1–3 张。" : "本季尚未亮相，领出只能 1 张。"}已知胜过：${beats.length ? beats.map(label).join("、") : "暂无"}。${moves.length ? `你现在可出 ${moves.map(move => move.count).join(" / ")} 张。` : "当前无法出这张牌。"}`);
      node.disabled = !can("play") || !moves.length;
      node.classList.toggle("is-selected", selected === mask); node.setAttribute("aria-pressed", String(selected === mask));
      node.addEventListener("click", () => {
        if (!can("play")) return;
        if (selected === mask) { clearSelection(); return; }
        selected = mask; count = moves[moves.length - 1].count; renderHand();
      });
      hand.append(node);
    });
    if (!hand.children.length) hand.append(el("span", "maskmen-unknown", own ? "All cards played ✓" : "Hands are private."));
    byId("Selection").classList.toggle("hidden", !selected);
    if (selected) {
      const moves = view.legal_plays.filter(move => move.mask === selected);
      text("SelectedLabel", `${label(selected)} · ${reasons[moves[0]?.reason] || ""}`);
      const counts = byId("Counts"); counts.replaceChildren();
      for (const move of moves) {
        const button = el("button", "", move.count); button.type = "button";
        button.dataset.mmExplain = "play"; button.dataset.count = move.count;
        button.setAttribute("aria-label", `Play ${move.count} cards`); button.setAttribute("aria-pressed", String(count === move.count));
        button.disabled = !can("play"); button.addEventListener("click", () => { count = move.count; renderHand(); }); counts.append(button);
      }
      text("Play", `Play ×${count}`); byId("Play").disabled = !can("play") || !moves.some(move => move.count === count);
    }
  }
  function renderPlayers() {
    const box = byId("Players"); box.replaceChildren();
    for (const p of view.players) {
      const node = el("article", "maskmen-player");
      node.classList.toggle("is-current", view.current_turn === p.player_id); node.classList.toggle("is-winner", view.winner_ids.includes(p.player_id));
      node.append(el("strong", "maskmen-player-name", p.name));
      const flags = [p.player_id === view.you ? "You" : "", p.is_bot ? "Bot" : "", p.place ? `#${p.place}` : p.passed ? "Passed" : view.current_turn === p.player_id ? "Turn" : "", p.ready ? "Ready ✓" : ""].filter(Boolean);
      node.append(tip(el("div", "maskmen-player-flags", flags.join(" · ")), "# 是本赛季名次；Passed 表示本小轮已弃权；Ready ✓ 表示已确认结果。", "round"));
      const stats = el("div", "maskmen-player-stats");
      stats.append(tip(el("span", "", `🂠 ${p.card_count}`), "Cards（🂠）：剩余手牌张数。", "hand"));
      stats.append(tip(el("span", "", `🏅 ${p.score}`), "Score（🏅）：已结算赛季的累计积分。", "score"));
      stats.append(tip(el("span", "", `🏆 ${p.wins}`), "Wins（🏆）：获得赛季第一名的次数；2 人先赢 3 季。", "score"));
      node.append(stats); box.append(node);
    }
  }
  function renderMat() {
    const mat = byId("Mat"), trail = byId("Trail"); mat.replaceChildren(); trail.replaceChildren();
    text("TopLabel", view.top ? "Last play" : "Open round");
    if (!view.top) mat.append(el("div", "maskmen-mat-empty", view.current_turn === view.you ? "Choose your opening mask." : `Waiting for ${name(view.current_turn)} to lead.`));
    else {
      mat.append(card(view.top.mask, view.top.count));
      const caption = el("div", "maskmen-mat-caption");
      caption.append(el("span", "", name(view.top.player_id)), el("strong", "", `×${view.top.count}`), el("small", "", `${label(view.top.mask)}\n${view.top.count === 3 ? "Only known stronger masks can follow." : "Same count if stronger. +1 if unknown."}`));
      mat.append(caption);
    }
    view.bout_plays.forEach(play => trail.append(tip(el("span", "maskmen-trail-item", `${masks[play.mask][0]} ×${play.count}`), `${name(play.player_id)}：${label(play.mask)} ×${play.count}`, play.mask)));
  }
  function renderStrength() {
    const board = byId("Strength"), matrix = byId("Matrix"); board.replaceChildren(); matrix.replaceChildren();
    for (const mask of Object.keys(masks)) {
      const row = el("div", "maskmen-strength-row");
      row.append(tip(el("strong", "", label(mask)), `${label(mask)}：${view.introduced.includes(mask) ? "本季已亮相" : "尚未亮相"}。`, mask), tip(el("span", "", "→"), "左边面具胜过右边列出的面具。", "strength"));
      const targets = el("div", "maskmen-defeats");
      if (!view.strength[mask].length) targets.append(el("span", "maskmen-unknown", view.introduced.includes(mask) ? "No known wins" : "Not debuted"));
      view.strength[mask].forEach(weak => targets.append(tip(el("span", "maskmen-token", label(weak)), `${label(mask)} 已知强于 ${label(weak)}，相同张数即可压过。`, "strength")));
      row.append(targets); board.append(row);
    }
    matrix.append(tip(el("span", "", "↘"), "读法：行面具与列面具比较。", "strength"));
    for (const mask of Object.keys(masks)) matrix.append(tip(el("span", "", masks[mask][0]), label(mask), mask));
    for (const mask of Object.keys(masks)) {
      matrix.append(tip(el("span", "", masks[mask][0]), label(mask), mask));
      for (const other of Object.keys(masks)) {
        const win = view.strength[mask].includes(other), lose = view.strength[other].includes(mask);
        const value = mask === other ? "—" : win ? "✓" : lose ? "×" : "?";
        matrix.append(tip(el("span", win ? "is-win" : lose ? "is-loss" : "", value), `${label(mask)} 对 ${label(other)}：${mask === other ? "同种" : win ? "更强" : lose ? "更弱" : "未知"}`, "strength"));
      }
    }
  }
  function renderReview() {
    const review = view.phase !== "playing";
    byId("Review").classList.toggle("hidden", !review);
    byId("Next").classList.toggle("hidden", view.game_over);
    const scores = byId("Scores"); scores.replaceChildren();
    if (view.phase === "round_review") text("ResultTitle", `Round complete · ${name(view.bout_result.next_leader)} leads next`);
    else if (review) {
      text("ResultTitle", view.game_over ? `🏆 ${view.winner_ids.map(name).join(" & ")} wins!` : `Season ${view.season} complete`);
      view.season_result?.players.forEach(p => scores.append(tip(el("div", "maskmen-score-row", `#${p.place} ${name(p.player_id)} · ${p.points > 0 ? "+" : ""}${p.points} 🏅 · Total ${p.score}${view.two_player ? ` · ${p.wins}/3 wins` : ""}`), "#：本季名次；🏅：本季得分；Total：累计分；wins：赛季胜场。", "score")));
    }
    byId("ResultTitle").dataset.mmTip = view.game_over ? "🏆 Winner：最终胜者；多人按总分和破平条件，两人先赢 3 季。" : view.phase === "round_review" ? "本小轮已结束，所有人确认后由指定玩家首出。" : "本赛季已结算，所有人确认后重新发牌。";
    byId("ResultTitle").dataset.mmExplain = view.phase === "round_review" ? "round" : "score";
    text("Ready", view.game_over ? "Final results" : `${view.ready.length} / ${view.players.length} ready`);
  }
  function renderLog() {
    const box = byId("Log"), scroll = box.scrollTop; box.replaceChildren();
    [...view.history].reverse().forEach(row => box.append(el("li", "", row.type === "pass" ? `R${row.bout} · ${name(row.player_id)} passed.` : `R${row.bout} · ${name(row.player_id)}: ${label(row.mask)} ×${row.count}${row.new_relation ? ` · ${label(row.new_relation[0])} > ${label(row.new_relation[1])}` : ""}${row.place ? ` · Finished #${row.place}` : ""}`)));
    box.scrollTop = scroll;
    byId("ScoreHistory").classList.toggle("hidden", !view.score_history.length);
    const history = byId("History"); history.replaceChildren();
    view.score_history.forEach(season => history.append(el("p", "", `Season ${season.season} · ${season.players.map(p => `${name(p.player_id)} ${p.points > 0 ? "+" : ""}${p.points}`).join(" / ")}`)));
  }
  function render() {
    if (!view) return;
    text("Season", view.two_player ? `Season ${view.season} · First to 3` : `Season ${view.season} / 4`);
    text("Bout", `Round ${view.bout}`);
    text("Status", view.game_over ? "Match complete" : view.phase !== "playing" ? "Review the result" : view.current_turn === view.you ? "Your turn" : `Waiting for ${name(view.current_turn)}`);
    const own = view.players.find(p => p.player_id === view.you);
    text("Hint", view.game_over ? "Final result. Start a new match from room controls." : view.phase !== "playing" ? "The table stays until everyone is ready." : !own ? "Watching this match." : own.place ? `Finished #${own.place}. Watch the remaining players.` : own.passed ? "Passed. Return next round." : view.current_turn !== view.you ? "Waiting for your turn." : !view.legal_plays.length ? "No legal play. Pass this round." : "Choose a mask to play.");
    renderPlayers(); renderMat(); renderHand(); renderStrength(); renderReview(); renderLog(); renderActions();
  }

  byId("Play").addEventListener("click", () => { if (selected && count) dispatch("play", {mask:selected, count}); });
  byId("Pass").addEventListener("click", () => dispatch("pass"));
  byId("Next").addEventListener("click", () => dispatch(view?.phase === "round_review" ? "next_round" : "next_season"));
  byId("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus(); });
  dialog.addEventListener("click", event => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
  });
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { maskmenExplainWidget?.exit(); hideTip(); clearSelection(); }
  }, true);
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-mm-tip]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-mm-tip]")));
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-mm-tip]"); if (target) showTip(target, true); else hideTip();
    if (!event.target.closest("button, #maskmenSelection, dialog") && selected) clearSelection();
  });
  document.addEventListener("scroll", hideTip, true); window.addEventListener("resize", hideTip); window.addEventListener("blur", hideTip);

  function clearState() {
    view = null; signature = null; selected = null; count = null; pending = false;
    clearTimeout(pendingTimer); maskmenExplainWidget?.exit(); hideTip(); if (dialog.open) dialog.close();
    ["Players", "Mat", "Hand", "Strength", "Matrix", "Log", "History", "Scores", "Trail"].forEach(suffix => byId(suffix).replaceChildren());
    ["Review", "Selection", "ScoreHistory"].forEach(suffix => byId(suffix).classList.add("hidden"));
    text("Status", "Waiting to start"); text("Season", "Season —"); text("Bout", "Round —"); renderActions();
  }
  window.renderMaskmenGameState = data => {
    if (data?.view?.game_id !== "maskmen" || currentGameType !== "maskmen" || (data.room_id && currentRoomState?.room_id !== data.room_id)) return;
    const incoming = JSON.stringify([data.room_id, data.view.game_token, data.view.season, data.view.bout, data.view.turn_number, data.view.you]);
    if (signature !== incoming) { selected = null; count = null; hideTip(); }
    if (signature !== incoming || view?.revision !== data.view.revision) { pending = false; clearTimeout(pendingTimer); }
    signature = incoming; view = data.view; render();
  };
  window.clearMaskmenState = clearState;
  window.showMaskmenHeaderActions = visible => { header.style.display = visible ? "flex" : "none"; if (!visible) clearState(); };
  function syncRoom(state) { if (state?.game_type !== "maskmen" || state.status === "lobby") clearState(); }
  function sync() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); renderHand(); renderActions(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); renderHand(); renderActions(); hideTip(); });
    socket.on("connect", () => { renderHand(); renderActions(); });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "maskmen") window.renderMaskmenGameState(lastGameStatePayload);
  }
  initMaskmenHelpExplain();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once:true}); else sync();
})();
