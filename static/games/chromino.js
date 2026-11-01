(() => {
  const panel = document.getElementById("chrominoPanel");
  const board = document.getElementById("chrominoBoard");
  const pieces = document.getElementById("chrominoPieces");
  const targets = document.getElementById("chrominoTargets");
  const ghost = document.getElementById("chrominoPreview");
  const hand = document.getElementById("chrominoHand");
  const dialog = document.getElementById("chrominoDialog");
  const tooltip = document.getElementById("chrominoTooltip");
  const colors = {
    red: {name: "Red 红色", symbol: "●", fill: "#c94350", ink: "#fff"},
    yellow: {name: "Yellow 黄色", symbol: "◆", fill: "#e6be3d", ink: "#493e16"},
    green: {name: "Green 绿色", symbol: "✚", fill: "#3c9260", ink: "#fff"},
    blue: {name: "Blue 蓝色", symbol: "■", fill: "#3379bd", ink: "#fff"},
    purple: {name: "Purple 紫色", symbol: "▲", fill: "#805bb2", ink: "#fff"},
    wild: {name: "Chameleon 变色龙", symbol: "★", fill: "#faf4df", ink: "#665239"},
  };
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let view = null;
  let signature = null;
  let selected = null;
  let rotation = 0;
  let preview = null;
  let pending = false;
  let pendingTimer = null;
  let tipTimer = null;
  let explaining = false;
  let blockedClick = null;
  let camera = null;
  let manualCamera = false;
  let pan = null;
  let handGesture = null;
  let returnFocus = null;

  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
  const active = () => !panel.classList.contains("hidden") && currentGameType === "chromino";
  const available = type => !pending && !!view?.legal_actions.includes(type);
  const playerName = playerId => view?.players.find(player => player.player_id === playerId)?.name || "Player";
  const selectedTile = () => view?.hand.find(tile => tile.tile_id === selected);
  const describeTile = tile => tile.colors.map(color => `${colors[color].name} (${colors[color].symbol})`).join(" / ");
  const tileHtml = tile => `<span class="chromino-tile" aria-hidden="true">${tile.colors.map(color => `<span class="chromino-square chromino-color-${color}">${colors[color].symbol}</span>`).join("")}</span>`;

  function candidates() {
    const tile = selectedTile();
    if (!tile) return [];
    const symmetric = tile.colors[0] === tile.colors[2];
    const effectiveRotation = symmetric ? rotation % 180 : rotation;
    return view.legal_placements.filter(move => move.tile_id === selected && move.rotation === effectiveRotation);
  }

  function hideTip() {
    clearTimeout(tipTimer);
    tooltip.classList.add("hidden");
  }

  function showTip(element, text) {
    hideTip();
    if (explaining || dialog.open || !element || !active()) return;
    tooltip.textContent = text || element.dataset.chrominoTip;
    if (!tooltip.textContent) return;
    tooltip.classList.remove("hidden");
    const bounds = element.getBoundingClientRect();
    const tipBounds = tooltip.getBoundingClientRect();
    const left = Math.max(10, Math.min(innerWidth - tipBounds.width - 10, bounds.left + bounds.width / 2 - tipBounds.width / 2));
    const top = bounds.top - tipBounds.height - 8;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top >= 8 ? top : Math.min(innerHeight - tipBounds.height - 8, bounds.bottom + 8)}px`;
    tipTimer = setTimeout(hideTip, 3000);
  }

  function resetSelection() {
    selected = null;
    preview = null;
    rotation = 0;
  }

  function setExplain(enabled) {
    explaining = enabled;
    hideTip();
    endPan();
    panel.classList.toggle("chromino-explaining", enabled);
    document.getElementById("chrominoExplainBtn").setAttribute("aria-pressed", String(enabled));
  }

  function openDialog(title, content, html = false) {
    hideTip();
    returnFocus = document.activeElement;
    document.getElementById("chrominoDialogTitle").textContent = title;
    const body = document.getElementById("chrominoDialogBody");
    if (html) body.innerHTML = content;
    else body.textContent = content;
    if (!dialog.open) dialog.showModal();
    document.getElementById("chrominoDialogClose").focus();
  }

  function tileSvg(tile, tileRotation, centerX, centerY, outlineClass = "") {
    const [deltaX, deltaY] = directions[tileRotation / 90];
    const vertical = deltaY !== 0;
    const outline = `<rect class="chromino-piece-outline ${outlineClass}" x="${centerX - (vertical ? 19 : 59)}" y="${centerY - (vertical ? 59 : 19)}" width="${vertical ? 38 : 118}" height="${vertical ? 118 : 38}" rx="7" />`;
    return outline + tile.colors.map((color, index) => {
      const cellX = centerX + (index - 1) * deltaX * 40;
      const cellY = centerY + (index - 1) * deltaY * 40;
      return `<rect x="${cellX - 16}" y="${cellY - 16}" width="32" height="32" rx="4" fill="${colors[color].fill}" /><text class="chromino-board-symbol" x="${cellX}" y="${cellY}" style="fill:${colors[color].ink}">${colors[color].symbol}</text>`;
    }).join("");
  }

  function applyCamera() {
    if (!camera) return;
    board.setAttribute("viewBox", `${camera.x} ${camera.y} ${camera.width} ${camera.height}`);
  }

  function fit() {
    if (!view || !board.clientWidth || !board.clientHeight) return;
    const positions = [];
    for (const tile of view.placed_tiles) {
      const [deltaX, deltaY] = directions[tile.rotation / 90];
      for (const offset of [-1, 0, 1]) positions.push([(tile.x + offset * deltaX) * 40, (tile.y + offset * deltaY) * 40]);
    }
    for (const move of candidates()) {
      const [deltaX, deltaY] = directions[move.rotation / 90];
      for (const offset of [-1, 0, 1]) positions.push([(move.x + offset * deltaX) * 40, (move.y + offset * deltaY) * 40]);
    }
    if (!positions.length) positions.push([0, 0]);
    const minX = Math.min(...positions.map(position => position[0])) - 44;
    const maxX = Math.max(...positions.map(position => position[0])) + 44;
    const minY = Math.min(...positions.map(position => position[1])) - 44;
    const maxY = Math.max(...positions.map(position => position[1])) + 44;
    const aspect = board.clientWidth / board.clientHeight;
    const height = Math.max(240, maxY - minY, (maxX - minX) / aspect);
    const width = height * aspect;
    camera = {x: (minX + maxX - width) / 2, y: (minY + maxY - height) / 2, width, height};
    manualCamera = false;
    applyCamera();
  }

  function zoom(factor) {
    if (!camera || explaining) return;
    const width = Math.max(120, Math.min(40000, camera.width * factor));
    const height = width * board.clientHeight / board.clientWidth;
    camera = {x: camera.x + (camera.width - width) / 2, y: camera.y + (camera.height - height) / 2, width, height};
    manualCamera = true;
    applyCamera();
    hideTip();
  }

  function renderBoard() {
    if (!view) return;
    const lastTile = view.placed_tiles[view.placed_tiles.length - 1];
    pieces.innerHTML = view.placed_tiles.map(tile => `<g data-chromino-tip="${escape(describeTile(tile))}" data-chromino-explain="${escape(`Placed Chromino: ${describeTile(tile)}. Every edge touching another tile must match. The Chameleon (★) matches each neighbour independently.`)}" aria-label="${escape(describeTile(tile))}">${tileSvg(tile, tile.rotation, tile.x * 40, tile.y * 40, lastTile === tile && tile.player_id ? "chromino-last-outline" : "")}</g>`).join("");
    targets.innerHTML = candidates().map(move => `<g role="button" tabindex="0" data-chromino-center="${move.x},${move.y}" data-chromino-explain="Preview the selected tile with its middle at this highlighted square. Confirm sends the move; selecting a destination alone does not place the tile." aria-label="Preview tile at ${move.x}, ${move.y}"><rect class="chromino-target${preview?.x === move.x && preview?.y === move.y ? " chromino-selected-target" : ""}" x="${move.x * 40 - 17}" y="${move.y * 40 - 17}" width="34" height="34" rx="7" /><text class="chromino-target-cross" x="${move.x * 40}" y="${move.y * 40}">+</text></g>`).join("");
    ghost.innerHTML = preview && selectedTile() ? tileSvg(selectedTile(), rotation, preview.x * 40, preview.y * 40, "chromino-preview-outline") : "";
    if (!camera || !manualCamera) fit();
  }

  function renderPlayers() {
    document.getElementById("chrominoPlayers").innerHTML = view.players.map(player => {
      const isCurrent = player.player_id === view.current_turn;
      const tip = player.finished ? "This player has emptied their hand. Finish the current round to check for joint winners." : `${player.hand_count} tile${player.hand_count === 1 ? "" : "s"} remaining. The last tile is revealed to everyone.`;
      return `<div class="chromino-player${isCurrent ? " is-current" : ""}${player.player_id === view.you ? " is-you" : ""}"${isCurrent ? ' aria-current="step"' : ""}><span class="chromino-player-name">${escape(player.name)}${player.is_bot ? " · AI" : ""}</span><div class="chromino-player-meta"><span tabindex="0" data-chromino-tip="${escape(tip)}">${player.finished ? "✓ Finished" : `${player.hand_count} tiles`}</span>${player.last_tile ? `<span tabindex="0" data-chromino-tip="${escape(`Revealed last tile: ${describeTile(player.last_tile)}`)}">${tileHtml(player.last_tile)}</span>` : `<span>${isCurrent ? "● Playing" : player.turns ? `${player.turns} turns` : "Ready"}</span>`}</div></div>`;
    }).join("");
  }

  function renderHand() {
    const scrollTop = hand.scrollTop;
    const playable = new Set(view.legal_placements.map(move => move.tile_id));
    hand.innerHTML = view.hand.map(tile => {
      const enabled = available("place") && playable.has(tile.tile_id);
      const isDrawn = tile.tile_id === view.drawn_tile_id;
      const label = view.game_over ? "Remaining" : isDrawn ? "Just drawn" : view.current_turn !== view.you ? "In hand" : playable.has(tile.tile_id) ? "Ready to place" : tile.chameleon && view.hand.length === 1 ? "Draw first" : "No fit";
      return `<button type="button" class="chromino-hand-tile${selected === tile.tile_id ? " is-selected" : ""}${isDrawn ? " is-drawn" : ""}" data-chromino-tile="${tile.tile_id}" data-chromino-explain="${escape(`Chromino: ${describeTile(tile)}. Select this tile, rotate around its middle, and choose a highlighted destination. A Chameleon (★) cannot be your last tile.`)}" aria-label="${escape(`${describeTile(tile)}. ${label}`)}" aria-pressed="${selected === tile.tile_id}"${enabled ? "" : " disabled"}>${tileHtml(tile)}<span class="chromino-hand-label">${label}</span></button>`;
    }).join("") || `<span class="chromino-hand-label">${view.players.some(player => player.player_id === view.you) ? "All tiles placed" : "Spectating · hands are private"}</span>`;
    hand.scrollTop = scrollTop;
  }

  function renderControls() {
    const ownTurn = view.current_turn === view.you;
    const status = view.game_over ? "Game finished" : ownTurn ? "Your turn" : `${playerName(view.current_turn)}'s turn`;
    document.getElementById("chrominoTurn").textContent = `${view.finishing_round && !view.game_over ? "Final round" : `Round ${view.round}`} · ${status}`;
    document.getElementById("chrominoBag").textContent = `${view.bag_count} in bag`;
    document.getElementById("chrominoRotate").disabled = !selected || !available("place");
    document.getElementById("chrominoConfirm").disabled = !preview || !available("place");
    document.getElementById("chrominoDraw").disabled = !available("draw");
    document.getElementById("chrominoDraw").classList.toggle("hidden", view.phase === "drawn" || view.legal_actions.includes("pass"));
    document.getElementById("chrominoKeep").classList.toggle("hidden", !view.legal_actions.includes("keep"));
    document.getElementById("chrominoKeep").disabled = !available("keep");
    document.getElementById("chrominoPass").classList.toggle("hidden", !view.legal_actions.includes("pass"));
    document.getElementById("chrominoPass").disabled = !available("pass");
    document.getElementById("chrominoSelection").textContent = pending ? "Sending move…" : preview ? `${rotation}° · Preview (${preview.x}, ${preview.y})` : selected ? `${rotation}° · ${candidates().length} destinations` : view.game_over ? "Final board" : "Choose a tile, then a centre.";
    document.getElementById("chrominoHint").textContent = view.game_over ? "The final board stays here." : !ownTurn ? "Watch the board while you wait." : view.phase === "drawn" ? "Place the new tile, or keep it." : available("draw") ? "No fit · draw one tile." : available("pass") ? "No fit · the bag is empty." : view.finishing_round ? "Last chance to share the win." : "Match at least two edges.";
  }

  function renderResult() {
    const result = document.getElementById("chrominoResult");
    result.classList.toggle("hidden", !view.game_over);
    if (!view.game_over) { result.replaceChildren(); return; }
    const title = view.winner.length ? `${view.winner.map(playerName).join(" & ")} ${view.winner.length > 1 ? "win together" : "wins"}!` : "Practice complete";
    const description = view.result_reason === "blocked" ? (view.players.length === 1 ? "No placement remains. Your hand was not cleared; try another practice game." : "Blocked board · online tie-break: the fewest remaining tiles wins.") : "The final round is complete. All players who emptied their hand this round share the win.";
    result.innerHTML = `<strong>${escape(title)}</strong><span>${description}</span><details class="chromino-history"><summary>Remaining tiles</summary>${view.players.map(player => `<p>${escape(player.name)} · ${player.hand_count} tiles</p><div class="chromino-revealed-hand">${player.revealed_hand.map(tile => `<span tabindex="0" data-chromino-tip="${escape(describeTile(tile))}">${tileHtml(tile)}</span>`).join("") || "✓"}</div>`).join("")}</details>`;
  }

  function renderHistory() {
    const log = document.getElementById("chrominoLog");
    const previousScroll = log.scrollTop;
    const wasAtBottom = log.scrollHeight - log.clientHeight - previousScroll < 12;
    const descriptions = {place: "placed a tile", draw: "drew a tile", keep: "kept the draw", pass: "passed"};
    log.innerHTML = view.history.map(entry => `<li class="${entry.player_id === view.you ? "is-you" : ""}">R${entry.round} · ${escape(playerName(entry.player_id))} ${descriptions[entry.type] || escape(entry.type)}${entry.type === "place" ? ` (${entry.x}, ${entry.y})` : ""}</li>`).join("");
    log.scrollTop = wasAtBottom ? log.scrollHeight : previousScroll;
  }

  function render() {
    if (!view) return;
    renderPlayers();
    renderHand();
    renderControls();
    renderBoard();
    renderResult();
    renderHistory();
  }

  function selectTile(tileId) {
    if (!available("place") || explaining) return;
    if (tileId === selected) resetSelection();
    else {
      const firstMove = view.legal_placements.find(move => move.tile_id === tileId);
      if (!firstMove) return;
      selected = tileId;
      rotation = firstMove.rotation;
      preview = null;
    }
    hideTip();
    renderHand(); renderControls(); renderBoard();
  }

  function selectCenter(center) {
    if (!available("place") || explaining) return;
    const match = candidates().find(move => `${move.x},${move.y}` === center);
    if (!match) return;
    preview = {...match};
    renderBoard(); renderControls();
  }

  function rotate() {
    if (!selected || !available("place") || explaining) return;
    rotation = (rotation + 90) % 360;
    preview = preview ? candidates().find(move => move.x === preview.x && move.y === preview.y) || null : null;
    renderBoard(); renderControls();
  }

  function submit(action) {
    if (!action || !available(action.type) || explaining || typeof sendAction !== "function") return;
    pending = true;
    hideTip();
    renderHand(); renderControls();
    sendAction({...action});
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; if (view) render(); }, 6000);
  }

  function endPan(event) {
    if (!pan || (event && event.pointerId !== pan.pointerId)) return;
    const ended = pan;
    pan = null;
    board.classList.remove("chromino-panning");
    if (board.hasPointerCapture(ended.pointerId)) board.releasePointerCapture(ended.pointerId);
    if (!event || event.type !== "pointerup" || ended.moved) return;
    const bounds = board.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    if (ended.center) selectCenter(ended.center);
    else if (ended.tip) showTip(ended.tip);
    else if (selected && !pending) { resetSelection(); renderHand(); renderControls(); renderBoard(); }
  }

  board.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !event.isPrimary || !camera || explaining) return;
    hideTip();
    pan = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, camera: {...camera}, moved: false,
      center: event.target.closest("[data-chromino-center]")?.dataset.chrominoCenter,
      tip: event.target.closest("[data-chromino-tip]"),
    };
    board.setPointerCapture(event.pointerId);
  });
  board.addEventListener("pointermove", event => {
    if (!pan || event.pointerId !== pan.pointerId) return;
    const offsetX = event.clientX - pan.startX;
    const offsetY = event.clientY - pan.startY;
    if (!pan.moved && Math.hypot(offsetX, offsetY) < 7) return;
    pan.moved = true;
    board.classList.add("chromino-panning");
    hideTip();
    camera = {...pan.camera, x: pan.camera.x - offsetX * pan.camera.width / board.clientWidth, y: pan.camera.y - offsetY * pan.camera.height / board.clientHeight};
    manualCamera = true;
    applyCamera();
  });
  window.addEventListener("pointerup", endPan);
  window.addEventListener("pointercancel", endPan);
  board.addEventListener("lostpointercapture", endPan);
  board.addEventListener("wheel", event => {
    if (!active()) return;
    event.preventDefault();
    zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15);
  }, {passive: false});
  board.addEventListener("keydown", event => {
    const target = event.target.closest("[data-chromino-center]");
    if (!target || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    selectCenter(target.dataset.chrominoCenter);
  });
  hand.addEventListener("pointerdown", event => {
    handGesture = {pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false};
  });
  hand.addEventListener("pointermove", event => {
    if (handGesture?.pointerId === event.pointerId && Math.hypot(event.clientX - handGesture.startX, event.clientY - handGesture.startY) > 8) handGesture.moved = true;
  });
  hand.addEventListener("click", event => {
    if (handGesture?.moved) return;
    const tile = event.target.closest("[data-chromino-tile]");
    if (tile && !tile.disabled) selectTile(tile.dataset.chrominoTile);
  });
  document.getElementById("chrominoRotate").addEventListener("click", rotate);
  document.getElementById("chrominoConfirm").addEventListener("click", () => submit(preview));
  document.getElementById("chrominoDraw").addEventListener("click", () => submit({type: "draw"}));
  document.getElementById("chrominoKeep").addEventListener("click", () => submit({type: "keep"}));
  document.getElementById("chrominoPass").addEventListener("click", () => submit({type: "pass"}));
  document.getElementById("chrominoZoomIn").addEventListener("click", () => zoom(.8));
  document.getElementById("chrominoZoomOut").addEventListener("click", () => zoom(1.25));
  document.getElementById("chrominoFit").addEventListener("click", () => { if (!explaining) fit(); });
  document.getElementById("chrominoExplainBtn").addEventListener("click", () => setExplain(!explaining));
  document.getElementById("chrominoHelp").addEventListener("click", () => {
    setExplain(false);
    openDialog("Chromino · Classic Help", `
      <h3>目标与准备</h3><p>本游戏采用 BGA 经典规则版，不使用新版规则书的变体。先出完手中的三格牌。标准套装共 80 枚：75 种普通牌和 5 枚 Chameleon 变色龙牌（★）。随机选 1 枚变色龙放在中央，每人获得 8 枚隐藏手牌，随机先手后按座次轮流行动。1 人可按相同规则练习。</p>
      <h3>颜色与符号</h3><p>${Object.values(colors).map(color => `${color.name}（${color.symbol}）`).join("、")}。颜色与几何符号同时显示，避免只靠颜色辨认。</p>
      <h3>放牌</h3><p>每回合放 1 枚牌，可绕中格旋转，不能重叠。新牌与已放的牌至少形成 2 条正交接触边；两条边可以接触同一枚旧牌。所有额外接触也必须同色，对角接触不计。变色龙中央的万能格（★）能在每条边分别匹配不同颜色，不会永久变色；两端仍须按印色匹配。</p>
      <h3>抽牌与跳过</h3><p>只有全部现有手牌都无处可放时，才可 Draw 1 枚。若新牌可放，可以立刻打出，或用 Keep &amp; Pass 保留并结束回合；此时不能改出旧手牌。若新牌不可放，自动保留并换人。牌袋空且没有合法落点时才可以 Pass。</p>
      <h3>末牌与获胜</h3><p>只剩 1 枚时，牌面向所有人公开。变色龙（★）不能作为最后一枚打出：只剩变色龙时必须抽牌，袋空则跳过。首位出完牌者触发末轮，继续到当前轮最后一席；这轮出完手牌的玩家并列获胜，不会给本轮已经行动的人额外回合。</p>
      <h3>线上死局约定</h3><p>牌袋空，且连续所有席位都没有放牌时结束，以剩余牌最少者获胜，可并列；保留可出的新牌不会错误触发死局。单人无法清空手牌则视为练习未完成。此为防止线上对局卡住的约定，不是 Expert 计分规则。</p>
      <h3>操作与标记</h3><p>选手牌 → Rotate 或 R 旋转 → 点虚线中点预览 → Confirm。预览中金色边框表示待放的牌，绿色边框表示最后落子。点棋盘空白或 Esc 取消。拖动棋盘平移，＋／− 缩放，Fit 查看全局。你的手牌过多时可以在手牌区滚动，滑动不会选牌。非交互图标可悬停或轻触查看提示；Explain 后点控件查看说明，禁用控件亦可解释。对局结束后保留棋盘，重新开局使用 Room Control。</p>
    `, true);
  });
  document.getElementById("chrominoDialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (returnFocus?.isConnected && active()) returnFocus.focus({preventScroll: true}); });

  const isExplainControl = target => !!target.closest("#chrominoHelp, #chrominoExplainBtn, #chrominoDialog");
  function explanationAt(event) {
    const direct = event.target.closest("[data-chromino-explain]");
    if (direct && panel.contains(direct)) return direct;
    return [...panel.querySelectorAll("[data-chromino-explain]")].filter(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.width && bounds.height && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    }).sort((first, second) => first.getBoundingClientRect().width * first.getBoundingClientRect().height - second.getBoundingClientRect().width * second.getBoundingClientRect().height)[0];
  }
  document.addEventListener("pointerdown", event => {
    if (!active() || !explaining || isExplainControl(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    blockedClick = {x: event.clientX, y: event.clientY, until: Date.now() + 700};
    const element = explanationAt(event);
    if (element) { setExplain(false); openDialog("Explain", element.dataset.chrominoExplain); }
  }, true);
  document.addEventListener("click", event => {
    if (!active()) return;
    if (blockedClick && Date.now() < blockedClick.until && Math.hypot(event.clientX - blockedClick.x, event.clientY - blockedClick.y) < 8) {
      blockedClick = null;
      event.preventDefault(); event.stopImmediatePropagation();
      return;
    }
    if (!explaining || isExplainControl(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const element = explanationAt(event);
    if (element) { setExplain(false); openDialog("Explain", element.dataset.chrominoExplain); }
  }, true);
  panel.addEventListener("pointerover", event => {
    if (event.pointerType === "touch" || pan?.moved) return;
    const target = event.target.closest("[data-chromino-tip]");
    if (target && !target.closest("button, [role=button]")) showTip(target);
  });
  panel.addEventListener("pointerout", event => {
    const target = event.target.closest("[data-chromino-tip]");
    if (target && !target.contains(event.relatedTarget)) hideTip();
  });
  panel.addEventListener("focusin", event => {
    if (event.target.dataset.chrominoTip) showTip(event.target);
  });
  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-chromino-tip]");
    if (target && !target.closest("button, [role=button]") && !board.contains(target)) showTip(target);
  });
  document.addEventListener("keydown", event => {
    if (!active() || dialog.open) return;
    if (event.key === "Escape") {
      hideTip(); setExplain(false); endPan(); resetSelection(); renderHand(); renderControls(); renderBoard();
    } else if (explaining && ["Enter", " "].includes(event.key) && !isExplainControl(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation();
      const element = event.target.closest("[data-chromino-explain]");
      if (element) { setExplain(false); openDialog("Explain", element.dataset.chrominoExplain); }
    } else if (!explaining && event.key.toLowerCase() === "r" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest("input, textarea, select, [contenteditable]")) {
      if (selected) { event.preventDefault(); rotate(); }
    }
  }, true);
  new ResizeObserver(() => {
    if (!view || !active()) return;
    if (!manualCamera || !camera) fit();
    else {
      const width = camera.height * board.clientWidth / board.clientHeight;
      camera = {...camera, x: camera.x + (camera.width - width) / 2, width};
      applyCamera();
    }
  }).observe(board);

  function clear() {
    endPan(); resetSelection(); setExplain(false); hideTip();
    clearTimeout(pendingTimer);
    pending = false; view = null; signature = null; camera = null; manualCamera = false; handGesture = null; blockedClick = null;
    if (dialog.open) dialog.close();
    pieces.replaceChildren(); targets.replaceChildren(); ghost.replaceChildren(); hand.replaceChildren();
    ["chrominoPlayers", "chrominoLog", "chrominoResult"].forEach(id => document.getElementById(id).replaceChildren());
    document.getElementById("chrominoResult").classList.add("hidden");
    ["chrominoConfirm", "chrominoRotate", "chrominoDraw", "chrominoKeep", "chrominoPass"].forEach(id => { document.getElementById(id).disabled = true; });
    ["chrominoKeep", "chrominoPass"].forEach(id => document.getElementById(id).classList.add("hidden"));
    document.getElementById("chrominoDraw").classList.remove("hidden");
    document.getElementById("chrominoTurn").textContent = "Waiting to start";
    document.getElementById("chrominoSelection").textContent = "Choose a tile.";
    document.getElementById("chrominoBag").textContent = "";
    document.getElementById("chrominoHint").textContent = "";
  }

  window.renderChrominoGameState = data => {
    if (!data?.view || currentGameType !== "chromino" || (data.room_id && data.room_id !== currentRoomState?.room_id)) return;
    const next = data.view;
    const nextSignature = JSON.stringify([data.room_id, next.you, next.revision]);
    if (signature !== nextSignature) {
      endPan(); resetSelection(); hideTip();
      if (next.phase === "drawn" && next.current_turn === next.you) {
        selected = next.drawn_tile_id;
        rotation = next.legal_placements.find(move => move.tile_id === selected)?.rotation || 0;
      }
    }
    if (!view || (signature && JSON.parse(signature)[0] !== data.room_id)) { camera = null; manualCamera = false; }
    signature = nextSignature; view = next; pending = false;
    clearTimeout(pendingTimer);
    render();
  };
  window.showChrominoHeaderActions = visible => { if (!visible) clear(); };
  window.clearChrominoState = clear;
  document.getElementById("chrominoLegend").innerHTML = Object.entries(colors).map(([color, info]) => `<span class="chromino-legend-item" tabindex="0" data-chromino-tip="${escape(`${info.name} (${info.symbol})${color === "wild" ? ": matches each neighbouring colour independently; cannot be the last tile played." : ": must touch the same colour or a Chameleon (★)."}`)}"><span class="chromino-square chromino-color-${color}">${info.symbol}</span>${info.name.split(" ")[0]}</span>`).join("");
  if (typeof socket !== "undefined") {
    socket.on("system:error", () => { if (pending) { pending = false; clearTimeout(pendingTimer); if (view) render(); } });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); endPan(); resetSelection(); if (view) render(); });
    socket.on("room:state", room => { if (room.game_type !== "chromino" || room.status === "lobby" || (signature && JSON.parse(signature)[0] !== room.room_id)) clear(); });
  }
  function sync() {
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "chromino" && currentRoomState?.room_id === lastGameStatePayload.room_id) window.renderChrominoGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
