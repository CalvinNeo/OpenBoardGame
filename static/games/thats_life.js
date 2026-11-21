(() => {
  "use strict";
  const byId = suffix => document.getElementById(`thatsLife${suffix}`);
  const colors = ["#be4b43", "#326ba1", "#b78613", "#6b529d", "#278568", "#b15083"];
  const explanations = {
    settings: { zh: "经典守卫版支持 2–6 人。标准路线为 −1 至 −8、六块幸运板块(🍀)、+8 至 +1、−1 至 −10。随机路线只打乱板块，不改变守卫配置。多局累计得分。", en: "Classic guards edition for 2–6 players. The standard track is −1 to −8, six lucky tiles (🍀), +8 to +1, then −1 to −10. Shuffled changes only tile order. Multiple rounds use cumulative scores." },
    roll: { zh: "骰子(🎲)：先掷一次六面骰，再选自己的一个棋子或可移动的守卫(◆)前进该步数。到终点(🏁)即停止，无须刚好掷出。由服务器掷骰，不能重掷。", en: "Die (🎲): roll once, then move one of your pawns or an eligible guard (◆) that many remaining tiles. Stop at the finish (🏁) even with steps left. The server rolls and there are no rerolls." },
    track: { zh: "路线：按箭头(→)和位置编号从左到右、从上到下前进。收集离开的板块，不是落脚的板块。最后一个棋子离开时必须拿走板块，即使是负分。还有棋子或守卫(◆)时不拿。移除后合拢，后续只数剩余板块。", en: "Track: follow arrows (→) and position numbers, left to right then top to bottom. Collect the tile you LEAVE, not the landing tile, only when it becomes empty. Negative tiles are mandatory too. Any pawn or guard (◆) prevents collection. Gaps close, so later moves count only remaining tiles." },
    pawn: { zh: "棋子(●)：选择自己未到终点的一枚。相同玩家同格的棋子合并为数量(×)，移动任一枚结果相同。预览落点后原地点击 Move，点击空白取消。全部棋子到终点的玩家跳过回合。", en: "Pawn (●): choose one of your unfinished pawns. Your identical pawns on the same tile are grouped with a count (×). Preview the destination, confirm with Move beside the source tile, or tap blank space to cancel. Finished players skip turns." },
    guard: { zh: "守卫(◆)：八枚中立棋子，起始保护六块幸运板块(🍀)及 +7、+8。仅当同格还有至少一枚玩家棋子(●)时，当前玩家才可移动它，代替自己的棋子。守卫单独留在格上或到终点(🏁)后不能移动。", en: "Guard (◆): eight neutral pieces initially protect the six lucky tiles (🍀), +7 and +8. Any active player may move a guard instead of a pawn, but only when its tile also holds a player's pawn (●). A guard alone or at the finish (🏁) cannot move." },
    score: { zh: "得分(★)：正分相加、负分相减。每块幸运板块(🍀)把一块负分翻成等值正分，系统优先转换绝对值最大的负分。多余幸运板块为零分。最高分获胜，同分时幸运板块较少者胜，仍相同则并列。", en: "Score (★): add positive and negative tile values. Each lucky tile (🍀) converts one negative to an equal positive. The most negative tiles are converted first. Spare lucky tiles score zero. Highest score wins, with fewer lucky tiles breaking ties, then shared victory." },
    round: { zh: "局数：每局所有玩家棋子到终点(🏁)后结算。多局累计得分，同分累计幸运板块较少者获胜。局间暂停，全员点击 Next Round 后才开始下一局。", en: "Round: score when every player's pawns reach the finish (🏁). Multiple rounds add scores and use total lucky tiles to break ties. Everyone must press Next Round before play resumes." },
    next: { zh: "Next Round：确认已查看结算。全员确认后才开下一局，不再弹确认窗口。", en: "Next Round: acknowledge the result. The next round starts only after every player is ready, without an extra confirmation dialog." },
    pile: { zh: "收集板块：查看该玩家所有板块和幸运转换明细。当前分数包含本局幸运转换，累计得分只包含已结算的局。", en: "Collected tiles: inspect this player's tiles and lucky conversions. Current score includes this round's conversions, while total score includes completed rounds only." },
    confirm: { zh: "Move：确认这枚棋子的移动和预览的落点。若离开后原板块变空，就必须收集它。", en: "Move: confirm this piece and the previewed destination. Collect the source tile if it becomes empty." },
    cancel: { zh: "Cancel：取消预览而不消耗回合。也可以点击棋盘空白或按 Escape。", en: "Cancel: dismiss the preview without spending your turn. You may also tap blank space or press Escape." }
  };
  let view = null;
  let selection = null;
  let pending = false;
  let pendingTimer = null;
  let tipTimer = null;
  let gesture = null;
  let suppressClick = false;
  let activeRoom = null;
  let help = null;
  let explain = null;
  const text = value => typeof value === "string" ? value : value[window.obgHelpLang()];
  const signed = value => value > 0 ? `+${value}` : String(value).replace("-", "−");
  const tileLabel = tile => tile.kind === "lucky" ? "🍀" : tile.kind === "start" ? "Start" : tile.kind === "finish" ? "🏁 Finish" : signed(tile.value);
  const name = playerId => view?.players.find(player => player.player_id === playerId)?.name || playerId;
  const color = playerId => colors[Math.max(0, view.players.findIndex(player => player.player_id === playerId)) % colors.length];
  function node(tag, className, content) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (content != null) item.textContent = content;
    return item;
  }
  function describe(item, key, message) {
    item.setAttribute("data-thats-life-explain", key);
    if (message) {
      item.dataset.tlTip = message;
      item.title = message;
      item.tabIndex = 0;
    }
    return item;
  }
  function button(label, key, action) {
    const item = describe(node("button", "", label), key);
    item.type = "button";
    item.addEventListener("click", action);
    return item;
  }
  function hideTip() {
    clearTimeout(tipTimer);
    byId("Tooltip").classList.add("hidden");
  }
  function showTip(item) {
    hideTip();
    byId("Tooltip").textContent = item.dataset.tlTip;
    byId("Tooltip").classList.remove("hidden");
    tipTimer = setTimeout(hideTip, 3000);
  }
  function send(action) {
    if (pending) return;
    pending = true;
    selection = null;
    hideTip();
    sendAction(action);
    render();
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; render(); }, 8000);
  }
  function tileNode(tile, index) {
    const item = node("div", `tl-tile ${tile.kind === "lucky" ? "tl-lucky" : tile.value > 0 ? "tl-plus" : ""}`);
    item.dataset.tileId = tile.id;
    const top = node("div", "tl-tile-head");
    top.append(describe(node("span", "tl-value", tileLabel(tile)), tile.kind === "lucky" ? "score" : "track",
      tile.kind === "lucky" ? "🍀 Lucky tile · turns one negative tile positive" : `${signed(tile.value)} points · collected when leaving alone`));
    if (index != null) top.append(describe(node("span", "tl-order", `${index} →`), "track", `Position ${index} · continue in reading order`));
    item.append(top);
    return item;
  }
  function occupants(container, position) {
    const groups = new Map();
    view.pieces.filter(piece => piece.position === position).forEach(piece => {
      const key = piece.owner || "guards";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(piece);
    });
    const list = node("div", "tl-occupants");
    for (const pieces of groups.values()) {
      const piece = pieces[0];
      const option = view.move_options.find(option => pieces.some(candidate => candidate.id === option.piece_id));
      const key = piece.kind === "guard" ? "guard" : "pawn";
      const label = piece.kind === "guard" ? `◆${pieces.length > 1 ? ` ×${pieces.length}` : ""}` : `● ×${pieces.length}`;
      const item = option ? button(label, key, () => { selection = option.piece_id; renderBoard(); }) : describe(node("span", "tl-piece", label), key,
        piece.kind === "guard" ? "◆ Guard · movable only alongside a player's pawn" : `${name(piece.owner)} · ${pieces.length} pawn(s)`);
      item.classList.add("tl-piece");
      if (piece.owner) {
        item.style.setProperty("--tl-player", color(piece.owner));
        item.prepend(node("span", "tl-dot"));
      }
      if (option) {
        item.disabled = pending;
        item.dataset.pieceId = option.piece_id;
        item.setAttribute("aria-label", `${piece.kind === "guard" ? "Guard" : name(piece.owner)} at ${position}`);
        item.setAttribute("aria-pressed", String(selection === option.piece_id));
      }
      list.append(item);
    }
    container.append(list);
  }
  function confirmation(option) {
    const box = node("div", "tl-confirm");
    const target = view.track.find(tile => tile.id === option.to);
    box.append(node("span", "", `→ ${tileLabel(target)} · ${option.collect ? `take ${tileLabel(option.collect)}` : "no tile collected"}`));
    const buttons = node("div", "tl-confirm-buttons");
    const move = button("Move", "confirm", () => send({ type: "move", piece_id: selection }));
    move.disabled = pending;
    buttons.append(move, button("Cancel", "cancel", () => { selection = null; renderBoard(); }));
    box.append(buttons);
    return box;
  }
  function renderBoard() {
    const option = view.move_options.find(option => option.piece_id === selection);
    const track = byId("Track");
    track.replaceChildren();
    for (const [index, tile] of view.track.entries()) {
      const terminal = tile.kind === "start" || tile.kind === "finish";
      const item = terminal ? byId(tile.kind === "start" ? "Start" : "Finish") : tileNode(tile, index);
      if (terminal) {
        item.replaceChildren(describe(node("strong", "", tileLabel(tile)), "track", tile.kind === "start" ? "Start · never collected" : "🏁 Finish · pawns stop and cannot move again"));
        item.classList.toggle("tl-destination", option?.to === tile.id);
      }
      occupants(item, tile.id);
      if (!terminal) {
        item.classList.toggle("tl-destination", option?.to === tile.id);
        item.classList.toggle("tl-origin", option?.from === tile.id);
        track.append(item);
      }
      if (option?.from === tile.id) {
        if (terminal) item.append(confirmation(option));
        else track.append(confirmation(option));
      }
    }
    explain?.refresh?.();
  }
  function openPile(player) {
    byId("PileTitle").textContent = `${player.name} · collected tiles`;
    byId("PileScore").textContent = `${signed(player.raw)} + ${player.bonus} lucky bonus = ${signed(player.score)} ★`;
    byId("Pile").replaceChildren();
    player.tiles.forEach(tile => {
      const item = tileNode(tile);
      if (player.converted_ids.includes(tile.id)) item.append(node("small", "", `🍀 → +${-tile.value}`));
      byId("Pile").append(item);
    });
    if (!player.tiles.length) byId("Pile").append(node("p", "", "No tiles yet."));
    byId("PileDialog").showModal();
  }
  function moveMessage(move) {
    if (!move) return "";
    return `${name(move.player_id)} · ${move.piece_kind === "guard" ? "◆" : "●"} moved ${move.die}${move.collect ? ` · took ${tileLabel(move.collect)}` : " · no tile collected"}`;
  }
  function render() {
    if (!view) return;
    byId("Lobby").classList.add("hidden");
    byId("Table").classList.remove("hidden");
    byId("Round").textContent = `ROUND ${view.round_number} / ${view.config.rounds} · TURN ${view.turn_number}`;
    byId("Die").textContent = `🎲 ${view.die || "—"}`;
    byId("Roll").disabled = pending || !view.legal_actions.includes("roll");
    byId("Status").textContent = view.game_over ? `${view.winner_ids.map(name).join(" & ")} wins!` : view.phase === "round_summary" ? "Round complete" : `${view.current_turn === view.you ? "Your turn" : name(view.current_turn)} · ${view.phase === "roll" ? "roll the die" : "choose a piece"}`;
    byId("LastMove").textContent = moveMessage(view.last_move) || "Follow → in reading order. Choose a piece after rolling.";
    renderBoard();
    byId("Players").replaceChildren();
    for (const player of view.players) {
      const item = node("div", `tl-player${player.player_id === view.current_turn ? " is-current" : ""}`);
      item.style.setProperty("--tl-player", color(player.player_id));
      const top = node("div", "tl-player-top");
      const title = node("span", "tl-player-name", `${player.name}${player.player_id === view.you ? " · You" : ""}`);
      title.title = player.name;
      top.append(node("span", "tl-dot"), title, describe(node("span", "tl-player-score", signed(player.score)), "score", "★ Current round score, including lucky conversions"));
      const finished = view.pieces.filter(piece => piece.owner === player.player_id && piece.position === "finish").length;
      const count = view.pieces.filter(piece => piece.owner === player.player_id).length;
      item.append(top, describe(node("div", "tl-player-meta", `🏁 ${finished}/${count} · 🍀 ${player.lucky_count} · Total ${signed(player.total_score)}`), "round", "🏁 Finished pawns · 🍀 Lucky tiles · Total from completed rounds"), button(`Tiles (${player.tiles.length})`, "pile", () => openPile(player)));
      byId("Players").append(item);
    }
    const summary = view.game_over || view.phase === "round_summary";
    byId("Summary").classList.toggle("hidden", !summary);
    byId("Results").replaceChildren();
    view.round_summary.forEach(result => byId("Results").append(node("p", "", `${name(result.player_id)}: ${signed(result.score)} ★ · Total ${signed(result.total_score)}`)));
    byId("Next").classList.toggle("hidden", view.game_over);
    byId("Next").disabled = pending || !view.legal_actions.includes("next_round");
    byId("Next").textContent = view.ready.includes(view.you) ? `Waiting (${view.ready.length}/${view.players.length})` : `Next Round (${view.ready.length}/${view.players.length})`;
    byId("History").replaceChildren(...view.history.slice().reverse().map(move => node("li", "", moveMessage(move))));
  }
  function init() {
    const panel = byId("Panel");
    help = window.obgCreateHelp({
      gameId: "thats_life", title: { zh: "糟了个糕！ · 经典守卫版", en: "That's Life! · Classic guards" },
      basic: {
        win: { zh: "所有棋子到终点(🏁)后，板块总分(★)最高者获胜。", en: "When all pawns reach the finish (🏁), the highest tile score (★) wins." },
        turn: { zh: "掷骰(🎲)，移动自己的一枚棋子(●)或与玩家棋子同格的守卫(◆)，离开空格时拿走原板块。", en: "Roll the die (🎲), move your pawn (●) or an eligible guard (◆), and take the source tile if you leave it empty." },
        key: { zh: "争取正分和幸运板块(🍀)，让对手被迫带走负分。", en: "Collect positives and lucky tiles (🍀) while leaving negatives to your opponents." }
      },
      sections: [
        { id: "movement", label: { zh: "路线与守卫", en: "Track & guards" }, html: {
          zh: `<p>${explanations.settings.zh}</p><p>2–4 人各三枚棋子(●)，5–6 人各两枚。由第一座位先手，顺时针轮流。</p><p>${explanations.roll.zh}</p><p>${explanations.track.zh}</p><p>${explanations.guard.zh}</p><p>${explanations.pawn.zh}</p>`,
          en: `<p>${explanations.settings.en}</p><p>Each player has three pawns (●) with 2–4 players, or two with 5–6. The first seat starts and turns follow seat order.</p><p>${explanations.roll.en}</p><p>${explanations.track.en}</p><p>${explanations.guard.en}</p><p>${explanations.pawn.en}</p>`
        } },
        { id: "scoring", label: { zh: "计分与版本", en: "Scoring & edition" }, html: {
          zh: `<p>${explanations.score.zh}</p><p>例如 −8、−3、+5 和一块幸运板块(🍀)，得分为 +8−3+5＝10。</p><p>${explanations.round.zh}</p><p>本实现为经典守卫玩法，可选随机路线和 1–3 局累计赛。不包含新版赠送／偷取行动板块，也不包含幸运板块只影响下方一块的计分变体。</p>`,
          en: `<p>${explanations.score.en}</p><p>For example, −8, −3, +5 and one lucky tile (🍀) score +8−3+5 = 10.</p><p>${explanations.round.en}</p><p>This is the classic guards game with optional shuffled track and 1–3 cumulative rounds. Gift/Steal action tiles and the tower-order scoring variant are not included.</p>`
        } }
      ]
    });
    explain = window.obgCreateExplain({ gameId: "thats_life", root: () => document,
      attribute: "data-thats-life-explain", explanations,
      bypass: ["#thatsLifeHelpBtn", "#thatsLifeExplainBtn", ".obg-help-dialog", "#thatsLifePileClose"],
      onChange: active => byId("ExplainBtn").setAttribute("aria-pressed", String(active)) });
    byId("HelpBtn").addEventListener("click", () => { explain.exit(); help.open(); });
    byId("ExplainBtn").addEventListener("click", () => { hideTip(); explain.toggle(); });
    byId("Roll").addEventListener("click", () => send({ type: "roll" }));
    byId("Next").addEventListener("click", () => send({ type: "next_round" }));
    byId("PileClose").addEventListener("click", () => byId("PileDialog").close());
    byId("PileDialog").addEventListener("click", event => { if (event.target === byId("PileDialog")) byId("PileDialog").close(); });
    panel.addEventListener("click", event => {
      if (event.target.closest("button,select,label,summary,dialog,[data-tl-tip]")) return;
      selection = null;
      if (view) renderBoard();
    });
    panel.addEventListener("pointerover", event => {
      const item = event.target.closest("[data-tl-tip]");
      if (event.pointerType === "mouse" && item && !explain.isActive()) showTip(item);
    });
    panel.addEventListener("pointerout", hideTip);
    panel.addEventListener("focusin", event => {
      const item = event.target.closest("[data-tl-tip]");
      if (item && !explain.isActive()) showTip(item);
    });
    panel.addEventListener("focusout", hideTip);
    document.addEventListener("pointerdown", event => {
      if (!panel.contains(event.target) || explain.isActive()) return;
      suppressClick = false;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, touch: event.pointerType === "touch", moved: false };
    }, true);
    document.addEventListener("pointermove", event => {
      if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) gesture.moved = true;
    }, true);
    document.addEventListener("pointerup", event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      suppressClick = gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10;
      if (!suppressClick && gesture.touch) {
        const item = event.target.closest("[data-tl-tip]");
        if (item) showTip(item);
      }
      gesture = null;
    }, true);
    document.addEventListener("pointercancel", () => { suppressClick = true; gesture = null; }, true);
    document.addEventListener("click", event => {
      if (!suppressClick || !panel.contains(event.target)) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      hideTip();
      selection = null;
      if (view) renderBoard();
    });
    window.addEventListener("scroll", hideTip, true);
    function syncRoom(room) {
      if (room?.game_type !== "thats_life") {
        explain.exit(); help.close(); byId("PileDialog").close(); hideTip();
        return;
      }
      if (room.room_id !== activeRoom || room.status === "lobby") {
        if (room.room_id !== activeRoom) {
          byId("Setup").value = room.game_config?.setup || "standard";
          byId("Rounds").value = String(room.game_config?.rounds || 1);
        }
        activeRoom = room.room_id;
        view = null; pending = false; selection = null;
        byId("Lobby").classList.remove("hidden");
        byId("Table").classList.add("hidden");
      }
    }
    function renderState(data) {
      if (!data?.view || data.game_type !== "thats_life") return;
      if (currentRoomState?.room_id && currentRoomState.room_id !== data.room_id) return;
      clearTimeout(pendingTimer);
      activeRoom = data.room_id;
      view = data.view; pending = false; selection = null;
      hideTip(); render();
    }
    window.getThatsLifeConfig = () => ({ setup: byId("Setup").value, rounds: Number(byId("Rounds").value) });
    window.renderThatsLifeGameState = renderState;
    window.showThatsLifeHeaderActions = show => {
      byId("HeaderActions").style.display = show ? "flex" : "none";
      if (!show) { explain.exit(); help.close(); byId("PileDialog").close(); hideTip(); }
    };
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { if (pending) { clearTimeout(pendingTimer); pending = false; render(); } });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.room_id === currentRoomState?.room_id
        && currentRoomState?.status !== "lobby") renderState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
