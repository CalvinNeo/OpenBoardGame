(() => {
  "use strict";

  const panel = document.getElementById("hivePanel");
  const board = document.getElementById("hiveBoard");
  const tiles = document.getElementById("hiveTiles");
  const dialog = document.getElementById("hiveDialog");
  const tooltip = document.getElementById("hiveTooltip");
  const rules = {
    queen: "Queen Bee 蜂后（🐝）：沿蜂群边缘滑动一步。最迟在自己的第四回合放置；放后才能移动其他棋子。",
    beetle: "Beetle 甲虫（🐞）：移动一步，可以爬上或爬下棋群。压住的棋子不能移动，叠层的颜色由最上方棋子决定。",
    grasshopper: "Grasshopper 蚱蜢（🦗）：沿直线跳过至少一枚连续相邻的棋子，落在这条线上的第一个空格。",
    spider: "Spider 蜘蛛（🕷️）：沿蜂群边缘恰好滑动三步，不能重访格子，全程保持接触。",
    ant: "Soldier Ant 兵蚁（🐜）：沿蜂群边缘滑动任意正步数，不能穿过夹缝或断开蜂群。",
  };
  const names = { queen: "蜂后", beetle: "甲虫", grasshopper: "蚱蜢", spider: "蜘蛛", ant: "兵蚁" };
  const icons = { queen: "🐝", beetle: "🐞", grasshopper: "🦗", spider: "🕷️", ant: "🐜" };
  const reasons = {
    queen_surrounded: "蜂后周围六格已被占满。",
    both_queens_surrounded: "双方蜂后同时被包围，和棋。",
    threefold_repetition: "同一局面出现三次，按线上约定和棋。",
    no_moves: "双方连续没有合法行动，和棋。",
    draw_agreed: "双方同意和棋。",
  };
  const directions = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const hex = Array.from({length: 6}, (_, i) => {
    const angle = (60 * i - 30) * Math.PI / 180;
    return `${(32 * Math.cos(angle)).toFixed(2)},${(32 * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
  let view = null;
  let signature = null;
  let selected = null;
  let preview = null;
  let pending = false;
  let pendingTimer = null;
  let tipTimer = null;
  let explaining = false;
  let suppressClick = false;
  let suppressTimer = null;
  let pan = null;
  let camera = null;
  let manualCamera = false;
  let configRoom = null;
  let returnFocus = null;

  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const point = (q, r) => [Math.sqrt(3) * 34 * (q + r / 2), 51 * r];
  const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
  const mine = () => view?.players.find(player => player.player_id === view.you);
  const playerName = id => view?.players.find(player => player.player_id === id)?.name || "Player";
  const available = type => !pending && view?.legal_actions.includes(type);
  const moves = () => (view?.legal_moves || []).filter(action => selected?.type === "place"
    ? action.type === "place" && action.piece === selected.piece
    : selected?.type === "move" && action.type === "move" && action.piece_id === selected.piece_id);

  function hideTip() {
    clearTimeout(tipTimer);
    tooltip.classList.add("hidden");
  }

  function showTip(text, target, timed = true) {
    hideTip();
    if (!text || dialog.open) return;
    tooltip.textContent = text;
    tooltip.classList.remove("hidden");
    const anchor = target.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(innerWidth - box.width - 12, anchor.left + anchor.width / 2 - box.width / 2))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(innerHeight - box.height - 12, anchor.bottom + 8))}px`;
    if (timed) tipTimer = setTimeout(hideTip, 3000);
  }

  function setExplain(value) {
    explaining = value;
    hideTip();
    panel.classList.toggle("hive-explaining", value);
    document.getElementById("hiveExplain").setAttribute("aria-pressed", String(value));
    if (value) endPan();
  }

  function openDialog(title, content, html = false) {
    hideTip();
    returnFocus = document.activeElement;
    document.getElementById("hiveDialogTitle").textContent = title;
    const body = document.getElementById("hiveDialogBody");
    if (html) body.innerHTML = content;
    else body.textContent = content;
    if (!dialog.open) dialog.showModal();
    document.getElementById("hiveDialogClose").focus();
  }

  function explainElement(target) {
    if (!target?.dataset.hiveExplain) return;
    setExplain(false);
    openDialog("Explain", target.dataset.hiveExplain);
  }

  function swallowClick() {
    suppressClick = true;
    clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => { suppressClick = false; }, 650);
  }

  function resetSelection() {
    selected = null;
    preview = null;
    hideTip();
  }

  function submit(action) {
    if (!action || pending || !view || !view.legal_actions.includes(action.type)) return;
    pending = true;
    hideTip();
    render();
    sendAction(action);
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; if (view) render(); }, 6500);
  }

  function applyCamera() {
    if (camera) board.setAttribute("viewBox", `${camera.x} ${camera.y} ${camera.w} ${camera.h}`);
  }

  function fit() {
    if (!view) return;
    const coords = view.board.map(cell => [cell.q, cell.r]).concat(moves().map(action => action.to));
    if (!coords.length) coords.push([0, 0]);
    const points = coords.map(([q, r]) => point(q, r));
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const minX = Math.min(...xs) - 55, maxX = Math.max(...xs) + 55;
    const minY = Math.min(...ys) - 55, maxY = Math.max(...ys) + 55;
    const ratio = (board.clientWidth || 480) / (board.clientHeight || 360);
    let w = Math.max(310, maxX - minX), h = Math.max(235, maxY - minY);
    if (w / h < ratio) w = h * ratio;
    else h = w / ratio;
    camera = {x: (minX + maxX - w) / 2, y: (minY + maxY - h) / 2, w, h};
    manualCamera = false;
    applyCamera();
  }

  function zoom(factor) {
    if (!camera) return;
    const w = Math.max(170, Math.min(5000, camera.w * factor));
    const h = camera.h * w / camera.w;
    camera = {x: camera.x + (camera.w - w) / 2, y: camera.y + (camera.h - h) / 2, w, h};
    manualCamera = true;
    hideTip(); applyCamera();
  }

  function stackDescription(cell) {
    const descriptions = cell.stack.map(piece => `${piece.color === "white" ? "White ⚪" : "Black ⚫"} ${names[piece.kind]} ${icons[piece.kind]} #${piece.number}`);
    const top = cell.stack[cell.stack.length - 1];
    return `${descriptions.join(" → ")}\n${cell.stack.length > 1 ? "Stack: bottom → top. Only the top insect can move.\n" : ""}${rules[top.kind]}\nHex (${cell.q}, ${cell.r})`;
  }

  function renderBoard() {
    if (!view) return;
    const legal = moves();
    const targets = new Set(legal.map(action => action.to.join(",")));
    const occupied = new Set(view.board.map(cell => `${cell.q},${cell.r}`));
    const cells = new Set(view.board.map(cell => `${cell.q},${cell.r}`));
    view.board.forEach(cell => directions.forEach(([dq, dr]) => cells.add(`${cell.q + dq},${cell.r + dr}`)));
    if (!cells.size) cells.add("0,0");
    targets.forEach(key => cells.add(key));
    let svg = "";
    for (const key of cells) {
      if (occupied.has(key)) continue;
      const [q, r] = key.split(",").map(Number);
      const [x, y] = point(q, r);
      if (targets.has(key)) {
        svg += `<g transform="translate(${x} ${y})" data-hive-cell="${key}" role="button" tabindex="0" aria-label="Preview hex ${q}, ${r}" data-hive-explain="This highlighted hex is a legal destination. Select it, then Confirm to commit."><polygon points="${hex}" class="hive-target ${same(preview?.to, [q, r]) ? "hive-preview" : ""}"/>${same(preview?.to, [q, r]) ? '<circle r="5" class="hive-landing"/>' : ""}</g>`;
      } else {
        svg += `<polygon transform="translate(${x} ${y})" points="${hex}" fill="none" stroke="#8cbea315" stroke-width="1"/>`;
      }
    }
    for (const cell of view.board) {
      const key = `${cell.q},${cell.r}`;
      const top = cell.stack[cell.stack.length - 1];
      const selectable = !pending && view.legal_moves.some(action => action.type === "move" && action.piece_id === top.id);
      const [x, y] = point(cell.q, cell.r);
      const isSelected = selected?.piece_id === top.id;
      const isLast = same(view.last_move?.to, [cell.q, cell.r]);
      const description = escape(stackDescription(cell));
      const hasQueen = cell.stack.some(piece => piece.kind === "queen");
      svg += `<g transform="translate(${x} ${y})" class="hive-tile hive-tile-${top.color} ${selectable ? "hive-selectable" : ""} ${isSelected ? "hive-selected" : isLast ? "hive-last" : ""}" data-hive-cell="${key}" data-hive-explain="${description}" data-hive-tip="${description}" role="button" tabindex="0" aria-label="${description}">
        <polygon class="hive-hex" points="${hex}"/>
        ${hasQueen ? '<circle cx="-18" cy="-15" r="4" data-hive-queen="true"/>' : ""}
        <text class="hive-insect" y="-5">${icons[top.kind]}</text><text class="hive-piece-label" y="17">${names[top.kind]}</text>
        ${cell.stack.length > 1 ? `<text x="18" y="-19" class="hive-stack-count">×${cell.stack.length}</text>` : ""}
        ${targets.has(key) ? `<polygon points="${hex}" class="hive-target ${same(preview?.to, [cell.q, cell.r]) ? "hive-preview" : ""}"/><circle cx="0" cy="-23" r="4" class="hive-landing"/>` : ""}
      </g>`;
    }
    if (!view.board.length && !selected) svg += '<text x="0" y="-55" fill="#a6c3af" font-size="13" text-anchor="middle">Choose your first insect below</text>';
    tiles.innerHTML = svg;
    if (!manualCamera || !camera) fit();
  }

  function renderPlayers() {
    document.getElementById("hivePlayers").innerHTML = view.players.map(player => {
      const queenStatus = player.queen_position ? `🐝 ${player.queen_neighbors}/6 surrounded` : `🐝 Due by turn 4 · ${player.turns + 1}/4`;
      return `<div class="hive-player ${!view.game_over && player.player_id === view.current_turn ? "hive-active" : ""}">
        <div class="hive-player-name"><span class="hive-side hive-side-${player.color}" data-hive-tip="${player.color === "white" ? "White · first player" : "Black · second player"}" tabindex="0"></span><strong title="${escape(player.name)}">${escape(player.name)}</strong><small>${player.player_id === view.you ? "YOU" : player.is_bot ? "AI" : player.color.toUpperCase()}</small></div>
        <div class="hive-player-stats"><span class="${player.queen_neighbors >= 4 ? "hive-danger" : ""}" tabindex="0" data-hive-explain="A Queen Bee（🐝）loses when all six neighboring hexes are occupied, even if a Beetle（🐞）covers her." data-hive-tip="${player.queen_position ? "Occupied hexes around this Queen Bee（🐝）, regardless of color." : "Place Queen Bee（🐝）by your fourth turn. No insects may move until she is placed."}">${queenStatus}</span></div>
        <div class="hive-player-stock">${Object.keys(icons).map(kind => `<span tabindex="0" data-hive-tip="${escape(rules[kind])} Reserve: ${player.reserve[kind]}">${icons[kind]} ${player.reserve[kind]}</span>`).join("")}</div></div>`;
    }).join("");
  }

  function render() {
    if (!view) return;
    renderPlayers();
    const me = mine();
    const acting = me && view.current_turn === view.you && !view.game_over;
    const displayPlayer = me || view.players.find(player => player.player_id === view.current_turn);
    document.getElementById("hiveTurn").textContent = view.game_over ? "Game complete" : `${acting ? "Your turn" : `${playerName(view.current_turn)}’s turn`} · ${view.ply + 1}`;
    document.getElementById("hiveReserveTitle").textContent = me ? "Your insects" : "Current reserve";
    document.getElementById("hiveReserveCount").textContent = `${Object.values(displayPlayer.reserve).reduce((a, b) => a + b, 0)} / 11`;
    document.getElementById("hiveReserve").innerHTML = Object.keys(icons).map(kind => {
      const enabled = !pending && view.legal_moves.some(action => action.type === "place" && action.piece === kind);
      return `<button type="button" class="hive-reserve-piece" data-hive-piece="${kind}" data-hive-explain="${escape(rules[kind])}" aria-label="${view.piece_info[kind].name} ${names[kind]}, ${displayPlayer.reserve[kind]} remaining" aria-pressed="${selected?.type === "place" && selected.piece === kind}" ${enabled ? "" : "disabled"}><span class="hive-reserve-icon">${icons[kind]}</span><span class="hive-reserve-name">${names[kind]}</span><span class="hive-reserve-number">×${displayPlayer.reserve[kind]}</span></button>`;
    }).join("");
    let hint = "Select an insect, then a highlighted hex.";
    if (!me) hint = "Spectating · inspect any insect or stack.";
    else if (view.game_over) hint = "Final position · use the room controls to start another game.";
    else if (!acting) hint = "Waiting for your opponent. Inspect any insect or stack.";
    else if (me.reserve.queen && me.turns >= 3) hint = "🐝 Place your Queen Bee this turn.";
    else if (me.reserve.queen) hint = "🐝 Place your Queen Bee by turn 4 to unlock movement.";
    if (available("pass")) hint = "No legal moves or placements. Pass to continue.";
    document.getElementById("hiveHint").textContent = hint;
    document.getElementById("hiveConfirm").disabled = !preview || pending;
    document.getElementById("hivePass").disabled = !available("pass");
    document.getElementById("hiveOfferDraw").disabled = !available("offer_draw");
    let selectionText = pending ? "Sending…" : "Choose an insect.";
    if (!pending && selected) {
      const kind = selected.piece || view.board.flatMap(cell => cell.stack).find(piece => piece.id === selected.piece_id)?.kind;
      selectionText = preview ? `${icons[kind]} ${names[kind]} → (${preview.to.join(", ")})` : `${icons[kind]} ${names[kind]} · ${moves().length} legal destinations`;
    }
    if (view.game_over) selectionText = "Final position";
    document.getElementById("hiveSelection").textContent = selectionText;
    const result = document.getElementById("hiveResult");
    result.classList.toggle("hidden", !view.game_over);
    if (view.game_over) result.innerHTML = `<strong>${view.winner.length ? `🏆 ${escape(playerName(view.winner[0]))} wins` : "🤝 Draw"}</strong><p>${reasons[view.result_reason] || "Game complete."} Final board is preserved.</p>`;
    const offer = document.getElementById("hiveDrawOffer");
    offer.classList.toggle("hidden", !view.draw_offer || view.game_over);
    offer.innerHTML = view.draw_offer ? `<span>${escape(playerName(view.draw_offer))} offered a draw.</span>${available("accept_draw") ? '<div class="hive-tools"><button type="button" data-hive-draw="accept_draw" data-hive-explain="Accept the offered draw and end this game.">Accept</button><button type="button" data-hive-draw="decline_draw" data-hive-explain="Decline the draw and continue playing.">Decline</button></div>' : ""}` : "";
    document.getElementById("hiveLog").innerHTML = [...view.activity].reverse().map(entry => `<li value="${entry.sequence}">${escape(entry.message)}</li>`).join("");
    renderBoard();
  }

  function chooseCell(key, target) {
    if (pending || !view) return;
    const coord = key.split(",").map(Number);
    const action = moves().find(candidate => same(candidate.to, coord));
    if (action) { preview = action; hideTip(); render(); return; }
    const cell = view.board.find(item => item.q === coord[0] && item.r === coord[1]);
    if (!cell) { resetSelection(); render(); return; }
    const piece = cell.stack[cell.stack.length - 1];
    const canMove = view.legal_moves.some(candidate => candidate.type === "move" && candidate.piece_id === piece.id);
    if (canMove) {
      selected = selected?.piece_id === piece.id ? null : {type: "move", piece_id: piece.id};
      preview = null; hideTip(); render();
    } else {
      showTip(stackDescription(cell) + (piece.owner === view.you && !view.game_over ? "\nNo legal move for this insect right now." : ""), target);
    }
  }

  panel.addEventListener("click", event => {
    if (explaining) return;
    const reserve = event.target.closest("[data-hive-piece]");
    if (reserve && !reserve.disabled && !pending) {
      selected = selected?.type === "place" && selected.piece === reserve.dataset.hivePiece ? null : {type: "place", piece: reserve.dataset.hivePiece};
      preview = null; hideTip(); render(); return;
    }
    const cell = event.target.closest("[data-hive-cell]");
    if (cell) { chooseCell(cell.dataset.hiveCell, cell); return; }
    const draw = event.target.closest("[data-hive-draw]");
    if (draw) {
      if (draw.dataset.hiveDraw === "decline_draw") submit({type: "decline_draw"});
      else confirmDraw("accept_draw");
      return;
    }
    const tip = event.target.closest("[data-hive-tip]");
    if (tip) { showTip(tip.dataset.hiveTip, tip); return; }
    if (!event.target.closest("button, input, select, summary, dialog, a")) { resetSelection(); render(); }
  });
  panel.addEventListener("pointerover", event => {
    const target = event.target.closest("[data-hive-tip]");
    if (!target || target.contains(event.relatedTarget) || explaining || pan?.moved || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    showTip(target.dataset.hiveTip, target, false);
  });
  panel.addEventListener("pointerout", event => {
    const target = event.target.closest("[data-hive-tip]");
    if (target && !target.contains(event.relatedTarget) && event.pointerType !== "touch") hideTip();
  });
  panel.addEventListener("focusin", event => {
    if (event.target.dataset.hiveTip && !explaining) showTip(event.target.dataset.hiveTip, event.target);
  });
  panel.addEventListener("focusout", hideTip);
  board.addEventListener("keydown", event => {
    const target = event.target.closest("[data-hive-cell]");
    if (target && ["Enter", " "].includes(event.key)) { event.preventDefault(); target.dispatchEvent(new MouseEvent("click", {bubbles: true})); }
  });
  board.addEventListener("pointerdown", event => {
    if (explaining || !camera || !event.isPrimary || event.button !== 0) return;
    pan = {id: event.pointerId, x: event.clientX, y: event.clientY, start: {...camera}, moved: false};
    // Capture only after crossing the drag threshold; a tap keeps its hex as
    // the click target, while a drag still receives pointerup outside the SVG.
  });
  board.addEventListener("pointermove", event => {
    if (!pan || pan.id !== event.pointerId) return;
    const dx = event.clientX - pan.x, dy = event.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 6) return;
    if (!pan.moved) board.setPointerCapture(event.pointerId);
    pan.moved = true;
    board.classList.add("hive-panning");
    hideTip();
    const scale = Math.max(pan.start.w / board.clientWidth, pan.start.h / board.clientHeight);
    camera = {...pan.start, x: pan.start.x - dx * scale, y: pan.start.y - dy * scale};
    manualCamera = true; applyCamera();
  });
  function endPan(event) {
    if (!pan || (event && event.pointerId !== pan.id)) return;
    const finished = pan;
    pan = null;
    if (finished.moved || event?.type === "pointercancel") swallowClick();
    if (board.hasPointerCapture(finished.id)) board.releasePointerCapture(finished.id);
    board.classList.remove("hive-panning");
  }
  window.addEventListener("pointerup", endPan);
  window.addEventListener("pointercancel", endPan);
  board.addEventListener("lostpointercapture", endPan);
  board.addEventListener("wheel", event => {
    if (panel.classList.contains("hidden")) return;
    event.preventDefault();
    if (!explaining) zoom(event.deltaY > 0 ? 1.12 : 1 / 1.12);
  }, {passive: false});
  document.getElementById("hiveFit").addEventListener("click", fit);
  document.getElementById("hiveZoomIn").addEventListener("click", () => zoom(0.8));
  document.getElementById("hiveZoomOut").addEventListener("click", () => zoom(1.25));
  document.getElementById("hiveConfirm").addEventListener("click", () => submit(preview));
  document.getElementById("hivePass").addEventListener("click", () => submit({type: "pass"}));

  function confirmDraw(type) {
    if (!available(type)) return;
    openDialog(type === "accept_draw" ? "Accept Draw" : "Offer Draw", `<p>${type === "accept_draw" ? "End this game in a draw?" : "Offer your opponent a draw? Play continues until they accept."}</p><button type="button" data-hive-dialog-action="${type}">Confirm</button>`, true);
  }
  document.getElementById("hiveOfferDraw").addEventListener("click", () => confirmDraw("offer_draw"));
  document.getElementById("hiveExplain").addEventListener("click", () => setExplain(!explaining));
  document.getElementById("hiveHelp").addEventListener("click", () => {
    setExplain(false);
    openDialog("Hive · Help", `
      <h3>🐝 目标与棋子</h3><p>围住对方的蜂后 Queen Bee（🐝）：周围六格被任意颜色棋子占据即输，被甲虫压住的蜂后也会输。一步同时围住双方蜂后则和棋。</p>
      <p>每人 11 枚：蜂后（🐝）×1、甲虫（🐞）×2、蚱蜢（🦗）×3、蜘蛛（🕷️）×2、兵蚁（🐜）×3。白方 White（⚪）先手，黑方 Black（⚫）后手。</p>
      <h3>放置与回合</h3><p>每回合从库存放一枚棋子，或移动一枚己方棋子。各自的首枚允许接触对手；之后只能邻接己方，不能邻接敌方。叠层以顶层棋子的颜色决定归属。新棋子不能放到叠层上，但可以直接放入符合颜色条件的封闭空格。</p>
      <p>蜂后（🐝）须在自己的第四回合或之前落地；未落蜂后不能移动棋子。Classic 允许首手放蜂后，Tournament Opening 禁止双方首手放蜂后。当前：<strong>${view?.config.tournament_opening ? "Tournament Opening" : "Classic"}</strong>。</p>
      <h3>五种移动</h3><ul>${Object.values(rules).map(rule => `<li>${rule}</li>`).join("")}</ul>
      <h3>连通与通道</h3><p>提起棋子时，剩余蜂群也必须保持一个整体；不能先拆开、落下后再接回。地面移动始终沿共同接触的棋子滑行，不能穿过两侧都被堵住的夹缝。甲虫（🐞）按起点与终点的较高层检查通道，两侧叠层均达到该高度时也不能通过。被覆盖的棋子不能动。蚱蜢（🦗）可跳入封闭空格。</p>
      <h3>操作与标记</h3><p>选择库存或己方可移动棋子，再点虚线落点查看预览，Confirm 后提交。空白处或 Esc 取消选择。棋盘可拖动，＋／− 缩放，Fit 显示全局。金色轮廓是选中棋子，浅绿色轮廓是最后落子；金色小点表示叠层中有蜂后（🐝），×N 表示层数。悬停或点击棋子查看从下到上的完整叠层。</p>
      <p>Explain 开启点选解释；此时按钮不执行原动作，灰色按钮也可解释。查看后自动退出，Esc 退出或关闭弹窗。电脑悬停状态标记、手机点击可查看提示，手机提示 3 秒消失。</p>
      <h3>结束与线上和棋约定</h3><p>没有任何合法放置和移动时才可 Pass。双方连续无合法动作、同一局面第三次出现，或双方同意 Offer Draw／Accept Draw 时和棋；前两项是本实现的线上约定。Decline 或走下一步可拒绝对方和棋请求。终局保留棋盘，不自动重开。</p>
      <p>基础版，不含蚊子、瓢虫、鼠妇扩展。AI 使用本地战术搜索，无需额外模型。<a href="https://www.gen42.com/wp-content/uploads/Hive-rules.pdf" target="_blank" rel="noopener noreferrer">Gen42 official rules</a></p>`, true);
  });
  document.getElementById("hiveDialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const action = event.target.closest("[data-hive-dialog-action]");
    if (action) { dialog.close(); submit({type: action.dataset.hiveDialogAction}); return; }
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });
  const isExplainControl = target => target.closest("#hiveHelp, #hiveExplain, #hiveDialog");
  document.addEventListener("pointerdown", event => {
    // A fresh gesture is not the synthetic click following the previous drag.
    suppressClick = false;
    if (isExplainControl(event.target)) return;
    if (!explaining || panel.classList.contains("hidden") || isExplainControl(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const direct = event.target.closest("[data-hive-explain]");
    const target = (direct && panel.contains(direct) ? direct : null) || [...panel.querySelectorAll("[data-hive-explain]")].find(element => {
      const r = element.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    });
    swallowClick();
    explainElement(target);
  }, true);
  document.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!explaining || panel.classList.contains("hidden") || isExplainControl(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    explainElement(event.target.closest("[data-hive-explain]"));
  }, true);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden") || event.key !== "Escape") return;
    hideTip();
    if (dialog.open) return;
    setExplain(false); endPan(); resetSelection(); render();
  });
  new ResizeObserver(() => { if (view && !panel.classList.contains("hidden")) fit(); }).observe(board);

  function clear() {
    endPan(); resetSelection(); setExplain(false);
    clearTimeout(pendingTimer); clearTimeout(suppressTimer);
    suppressClick = false; pending = false; view = null; signature = null; camera = null; manualCamera = false;
    if (dialog.open) dialog.close();
    tiles.replaceChildren();
    ["hivePlayers", "hiveReserve", "hiveLog"].forEach(id => document.getElementById(id).replaceChildren());
    ["hiveResult", "hiveDrawOffer"].forEach(id => document.getElementById(id).classList.add("hidden"));
    ["hiveConfirm", "hivePass", "hiveOfferDraw"].forEach(id => { document.getElementById(id).disabled = true; });
    document.getElementById("hiveTurn").textContent = "Waiting to start";
    document.getElementById("hiveSelection").textContent = "Choose an insect.";
  }
  window.renderHiveGameState = data => {
    if (!data?.view) return;
    if (currentGameType !== "hive" || (data.room_id && currentRoomState?.room_id !== data.room_id)) return;
    const next = data.view;
    const nextSignature = JSON.stringify([data.room_id, next.you, next.ply, next.phase]);
    if (signature !== nextSignature) { endPan(); resetSelection(); }
    if (!view || (signature && JSON.parse(signature)[0] !== data.room_id)) { camera = null; manualCamera = false; }
    signature = nextSignature; view = next; pending = false;
    clearTimeout(pendingTimer); render();
  };
  window.showHiveHeaderActions = visible => { if (!visible) clear(); };
  window.clearHiveState = clear;
  window.getHiveConfig = () => {
    if (currentRoomState?.status !== "lobby" && view) return {...view.config};
    return {tournament_opening: document.getElementById("hiveTournament").checked, ai_difficulty: document.getElementById("hiveDifficulty").value};
  };
  window.updateHiveConfigRow = () => {
    if (signature && JSON.parse(signature)[0] !== currentRoomState?.room_id) clear();
    const visible = currentGameType === "hive" && currentRoomState?.status === "lobby";
    const box = document.getElementById("hiveConfigBox");
    box.classList.toggle("hidden", !visible); box.setAttribute("aria-hidden", String(!visible));
    if (visible && configRoom !== currentRoomState.room_id) {
      configRoom = currentRoomState.room_id;
      document.getElementById("hiveTournament").checked = !!currentRoomState.game_config?.tournament_opening;
      document.getElementById("hiveDifficulty").value = currentRoomState.game_config?.ai_difficulty || "normal";
    }
  };
  if (typeof socket !== "undefined") {
    socket.on("system:error", () => { if (pending) { pending = false; clearTimeout(pendingTimer); render(); } });
    socket.on("disconnect", () => { pending = false; endPan(); resetSelection(); if (view) render(); });
  }
  function sync() {
    window.updateHiveConfigRow();
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "hive" && currentRoomState?.room_id === lastGameStatePayload.room_id) window.renderHiveGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
