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
  const explanations = {
    season: ["Season · 赛季", "3–6 人共 4 赛季，总分最高者胜；2 人先赢 3 赛季者胜。2–4 人各发 15 张、5 人各 12 张、6 人各 10 张。每赛季重洗全部 60 张牌并清空强弱关系。未发牌暗置，不会再抽牌。上季末名首出。"],
    round: ["Round · 小轮", "轮流出牌或 Pass（🏳️）。Pass 后本小轮不能再出牌。仅剩一位未 Pass 且有手牌的玩家时，暂停展示结果；全员 Next Round 后由该玩家领出，所有 Pass 状态清空。面具的强弱关系保留到赛季结束。"],
    strength: ["Strength · 强弱关系", "每行列出该面具已知胜过谁。关系可以传递：蓝面具（🔵）胜橙面具（🟠），橙面具胜绿面具（🟢），则蓝面具也胜绿面具。两个都胜绿色的面具之间仍可能未知。✓ 行胜列，× 行负列，? 未确定，— 同种。未知并不等于同样强，也不根据排列位置判断。"],
    hand: ["Cards（🂠）· 手牌", "六种面具各 10 张，手牌只向本人显示，其他人只能看剩余张数。卡牌上的 ×N 是你持有的数量，不是强度。点选面具，再选合法张数并 Play；灰色表示当前无法出牌。"],
    score: ["Score（🏅）· 积分", "赛季按出完手牌先后排名：第一 +2，第二 +1，末名 −1，其他 0。两人时胜者 +2、负者 −1，但胜负按先赢 3 季判断。显示的累计分在赛季结束时更新。🏆 是赛季冠军次数。"],
    play: ["Play · 出牌", "一手只能出一种面具，最多 3 张。领出时：本季首次出现只能 1 张，已出现可 1–3 张。接牌时：已知更强出相同张数；强弱未知恰好多 1 张并确立关系。同种、较弱或超过 3 张均不能出。点击空白或 Esc 取消选择。"],
    pass: ["Pass（🏳️）· 弃权", "不出牌并退出当前小轮，之后不能重新加入，直到全员 Next Round。即使有合法牌也可以 Pass；空桌首出不能 Pass。"],
    next: ["Next Round / Next Season", "确认已看完当前结果，无需二次确认。所有玩家都点击后才继续，AI 只确认自己，断线真人需重连确认。Next Round 清空桌面；Next Season 重新发牌并重置强弱关系。"],
  };
  const help = `
    <h3>目标与牌组</h3><p>尽快出完手牌。六种面具各 10 张：橙面具（🟠）、粉面具（🩷）、灰面具（⚪）、蓝面具（🔵）、紫面具（🟣）、绿面具（🟢），共 60 张。颜色和额头图案只用于区分面具，没有预设大小。Cards（🂠）是剩余手牌，×N 表示同种牌数量。</p>
    <p>2–4 人各发 15 张，5 人各 12 张，6 人各 10 张。未发牌暗置，本季不使用，不补牌。首季随机首家；下一季由上季末名首出。</p>
    <h3>领出与接牌</h3><p>每次只能出同一种面具，最多 3 张。空桌首出时，若该面具本季还没出现过，只能出 1 张；已经出现过的面具，可以出 1–3 张。</p>
    <ul><li>已知更强：必须与桌面最后一手<strong>相同张数</strong>。</li><li>相对强弱未知：必须<strong>恰好多出 1 张</strong>，并确定新面具更强。</li><li>同种或已知更弱不能接牌；不能出超过 3 张。</li></ul>
    <p class="maskmen-example">🔵 ×1 → 🩷 ×2 → 🟢 ×3<br>确立 🟢 胜 🩷、🩷 胜 🔵，所以 🟢 也胜 🔵。<br>下一小轮若 🔵 ×1，🟢 ×1 就能压过。</p>
    <h3>Strength · 强弱关系</h3><p>关系具有传递性。若 🟠 和 🟢 都胜 🩷，还不能判断 🟠 与 🟢 谁强。Strength board 每行只列出已知较弱的面具；Compare all masks 的 ✓ 表示行胜列，× 表示行负列，? 表示未知，— 表示同种。行的排列不表示排名。所有关系在赛季结束后重置。</p>
    <h3>Pass（🏳️）与小轮结束</h3><p>不能或不想出牌都可以 Pass，之后退出本小轮。空桌首出不能 Pass。只剩一位未 Pass 且仍有牌的玩家时本小轮结束，由其下一轮领出。若最后出牌者已出完、其他有牌玩家也都 Pass，则顺时针下一位有牌者领出。出完牌的玩家退出本赛季出牌，但仍参与结果确认。</p>
    <h3>Score（🏅）与赛季冠军（🏆）</h3><p>按出完手牌顺序排名，直到只剩一人有牌：第一 +2，第二 +1，最后 −1，其他 0。累计分在赛季结算时更新。3–6 人打 4 赛季，总分最高者胜。同分先看冠军数，再看谁最近赢过赛季；如果并列者都没赢过赛季，按最后赛季的出完顺序决定。</p><p><strong>2 人模式：</strong>先赢 3 赛季就结束（最多 5 季）。界面同时显示胜场与积分，胜负依据胜场。</p>
    <h3>线上操作与约定</h3><p>点选手牌，选合法张数，再 Play。点击空白或 Esc 取消。每小轮保留桌面，所有人 Next Round 后清场；每赛季所有人 Next Season 后再发牌。AI 自动确认自己，断线真人不会被跳过。最终结果保留。</p><p>本版采用 60 张规则。出完牌后的首家递补、完全未夺冠时的破平为明确的线上边界约定。AI 根据自己的牌和公开信息评估清牌、保留组合、强弱关系和对手接牌概率，不读取其他玩家的手牌。</p><p>Help 集中规则。点击 Explain 后点有虚线的对象可解释，禁用按钮也支持；Esc 退出。静态指标可悬停或聚焦查看提示，手机点按显示 3 秒。</p>
    <p><a href="https://oinkgames.com/en/games/analog/maskmen/" target="_blank" rel="noopener noreferrer">Oink Games</a> · <a href="https://content.cmpl.org/bg/Maskmen.pdf" target="_blank" rel="noopener noreferrer">Game Manual v1.1</a></p>`;
  let view = null, selected = null, count = null, pending = false, explaining = false;
  let pendingTimer, tipTimer, suppressTimer, suppressClick = false, focusBeforeDialog = null, signature = null;

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
    if (!target || explaining || dialog.open) return;
    clearTimeout(tipTimer); tooltip.textContent = target.dataset.mmTip; tooltip.classList.remove("hidden");
    const r = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(r.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${r.bottom + box.height + 15 < innerHeight ? r.bottom + 6 : Math.max(12, r.top - box.height - 6)}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function setExplain(value) {
    explaining = value; panel.classList.toggle("maskmen-explaining", value);
    byId("ExplainBtn").setAttribute("aria-pressed", String(value)); hideTip();
  }
  function showDialog(title, body, html = false) {
    hideTip(); focusBeforeDialog = document.activeElement; text("DialogTitle", title);
    if (html) byId("DialogBody").innerHTML = body;
    else byId("DialogBody").replaceChildren(el("p", "", body));
    if (!dialog.open) dialog.showModal(); byId("DialogClose").focus();
  }
  function explain(target) {
    const key = target?.dataset.mmExplain;
    let entry = explanations[key];
    if (masks[key]) {
      const beats = view?.strength[key] || [];
      const moves = view?.legal_plays.filter(move => move.mask === key) || [];
      entry = [`${masks[key][2]} · ${label(key)}`, `每种面具共 10 张，没有固定强度。${view?.introduced.includes(key) ? "本季已经亮相，领出可选 1–3 张。" : "本季尚未亮相，领出只能 1 张。"}已知胜过：${beats.length ? beats.map(label).join("、") : "暂无"}。${moves.length ? `你现在可出 ${moves.map(move => move.count).join(" / ")} 张。` : "你现在不能出这张牌（可能未轮到你、已 Pass、牌数不够或无法压过桌面）。"} ${explanations.play[1]}`];
    }
    if (!entry) return;
    setExplain(false); showDialog(...entry);
  }
  function clearSelection() { selected = null; count = null; renderHand(); }
  function dispatch(kind, fields = {}) {
    if (explaining || !can(kind)) return;
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
      node.disabled = !can("play") || !moves.length;
      node.classList.toggle("is-selected", selected === mask); node.setAttribute("aria-pressed", String(selected === mask));
      node.addEventListener("click", () => {
        if (!can("play") || explaining) return;
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
  byId("HelpBtn").addEventListener("click", () => { setExplain(false); showDialog("Maskmen · Game Rules", help, true); });
  byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
  byId("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus(); });
  dialog.addEventListener("click", event => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
  });
  const exempt = target => target.closest("#maskmenHelpBtn, #maskmenExplainBtn, #maskmenDialog");
  document.addEventListener("pointerdown", event => {
    suppressClick = false;
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const target = event.target.closest("[data-mm-explain]") || [...panel.querySelectorAll("[data-mm-explain]")].find(node => {
      const r = node.getBoundingClientRect();
      return r.width && r.height && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    });
    suppressClick = true; clearTimeout(suppressTimer); suppressTimer = setTimeout(() => { suppressClick = false; }, 700);
    explain(target);
  }, true);
  document.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-mm-explain]"));
  }, true);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { setExplain(false); hideTip(); clearSelection(); }
    if (!explaining || exempt(event.target) || !["Enter", " "].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-mm-explain]"));
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
    view = null; signature = null; selected = null; count = null; pending = false; suppressClick = false;
    clearTimeout(pendingTimer); clearTimeout(suppressTimer); setExplain(false); hideTip(); if (dialog.open) dialog.close();
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once:true}); else sync();
})();
