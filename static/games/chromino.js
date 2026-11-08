(() => {
  const panel = document.getElementById("chrominoPanel");
  const board = document.getElementById("chrominoBoard");
  const pieces = document.getElementById("chrominoPieces");
  const targets = document.getElementById("chrominoTargets");
  const ghost = document.getElementById("chrominoPreview");
  const hand = document.getElementById("chrominoHand");
  const tooltip = document.getElementById("chrominoTooltip");
  // --- Help & Explain (designs/task40.md, designs/task185.md) -------------
  const chrominoHelpButton = document.getElementById("chrominoHelpBtn");
  const chrominoExplainButton = document.getElementById("chrominoExplainBtn");

  const CHROMINO_HELP_CONFIG = {
    gameId: "chromino",
    title: { zh: "三色拼图 Chromino", en: "Chromino" },
    basic: {
      win: {
        zh: "最先把手上的牌全部放上棋盘的玩家获胜。末轮里所有清空手牌的人并列获胜。",
        en: "The first player to place every tile from their hand wins. Everyone who empties their hand during the final round shares the win."
      },
      turn: {
        zh: "轮到你时放一枚三格牌到棋盘上，或者在无处可放时抽一枚牌。",
        en: "On your turn you place one three-square tile on the board, or draw one tile when none of your tiles fits."
      },
      key: {
        zh: "每条与相邻牌接触的边都必须同色，而且至少要有两条这样的接触边，所以要提前想好下一枚牌接在哪里。",
        en: "Every edge touching a neighbouring tile must match in colour, and you need at least two such contacts, so plan where your next tile will connect."
      }
    },
    sections: [
      {
        id: "setup",
        label: { zh: "准备与目标", en: "Setup and goal" },
        html: {
          zh: "<p>标准套装共 80 枚三格牌，其中 75 枚普通牌和 5 枚变色龙(★)。开局随机取一枚变色龙(★)放在棋盘中央，每人发 8 枚暗牌，其余的牌留在牌袋里。</p>"
            + "<p>先手玩家随机决定，之后按座次轮流行动。1 人也可以按同样规则练习。</p>",
          en: "<p>The standard set has 80 three-square tiles, made of 75 ordinary tiles and 5 Chameleon (★) tiles. One random Chameleon (★) starts in the middle of the board, every player receives 8 hidden tiles, and the rest stay in the bag.</p>"
            + "<p>The first player is chosen at random and play then follows the seating order. A single player can practise under the same rules.</p>"
        }
      },
      {
        id: "colours",
        label: { zh: "颜色与符号", en: "Colours and symbols" },
        html: {
          zh: "<p>五种颜色各配一个几何符号，颜色和符号同时显示，避免只靠颜色辨认。红色(●)、黄色(◆)、绿色(✚)、蓝色(■)、紫色(▲)。</p>"
            + "<p>变色龙(★)是牌中央的万能格，它两端的格子仍然是印好的普通颜色。</p>",
          en: "<p>Each of the five colours carries a geometric symbol, and both are shown so the board never relies on colour alone. Red (●), Yellow (◆), Green (✚), Blue (■) and Purple (▲).</p>"
            + "<p>The Chameleon (★) is the wild square in the middle of a tile. The two end squares keep their printed colours.</p>"
        }
      },
      {
        id: "placing",
        label: { zh: "放牌规则", en: "Placing a tile" },
        html: {
          zh: "<p>每回合放 1 枚牌，可以绕中间那格旋转，但不能和棋盘上已有的牌重叠。</p>"
            + "<p>新牌必须与已有的牌形成至少 2 条正交接触边，这两条边允许接触同一枚旧牌。</p>"
            + "<p>每一条接触边都必须同色，多出来的接触边同样要同色，对角接触不算。</p>",
          en: "<p>Each turn you place one tile. You may rotate it around its middle square, but it may never overlap a tile already on the board.</p>"
            + "<p>The new tile must form at least 2 orthogonal edge contacts with the board, and both contacts may touch the same existing tile.</p>"
            + "<p>Every touching edge must match in colour, including any extra contacts. Diagonal contact does not count.</p>"
        }
      },
      {
        id: "chameleon",
        label: { zh: "变色龙(★)", en: "Chameleon (★)" },
        html: {
          zh: "<p>变色龙(★)位于牌的中间一格，它在每条边上分别匹配相邻的颜色，因此可以同时满足两个不同颜色的邻居。</p>"
            + "<p>它不会永久变成某种颜色，下一次接触时仍然按万能格计算。</p>"
            + "<p>牌的两端必须按印好的颜色匹配，变色龙(★)只负责中间那一格。</p>"
            + "<p>变色龙(★)不能作为最后一枚牌打出。手上只剩它时你必须抽牌，牌袋空了则只能跳过。</p>",
          en: "<p>The Chameleon (★) sits in the middle square of a tile. It matches each neighbouring colour separately, so it can satisfy two neighbours of different colours at once.</p>"
            + "<p>It never becomes a permanent colour. The next contact still treats it as a wild square.</p>"
            + "<p>The two ends of the tile must match their printed colours. The Chameleon (★) only covers the middle square.</p>"
            + "<p>A Chameleon (★) cannot be played as your last tile. Holding only that tile forces you to draw, or to pass once the bag is empty.</p>"
        }
      },
      {
        id: "draw",
        label: { zh: "抽牌与跳过", en: "Drawing and passing" },
        html: {
          zh: "<p>只有当你手上所有牌都无处可放时，才可以按 Draw 抽 1 枚。</p>"
            + "<p>抽到的牌如果放得下，你可以立刻打出，也可以按 Keep &amp; Pass 把它留在手上并结束回合。抽牌之后不能再打出旧手牌。</p>"
            + "<p>抽到的牌如果放不下，会自动留在手上并轮到下一位玩家。</p>"
            + "<p>牌袋空了而且你没有合法落点时，才可以按 Pass 跳过。</p>",
          en: "<p>You may press Draw for one tile only when none of the tiles in your hand can be placed.</p>"
            + "<p>If the drawn tile fits, you either play it at once or press Keep &amp; Pass to keep it and end your turn. After drawing you can no longer play an older tile.</p>"
            + "<p>If the drawn tile does not fit, it is kept automatically and play moves on.</p>"
            + "<p>Pass becomes available only when the bag is empty and you have no legal placement.</p>"
        }
      },
      {
        id: "ending",
        label: { zh: "末牌与获胜", en: "Last tile and victory" },
        html: {
          zh: "<p>手上只剩 1 枚牌时，这枚牌会对所有人公开。</p>"
            + "<p>第一位清空手牌的玩家触发末轮，本轮继续进行到当前轮的最后一位玩家。</p>"
            + "<p>末轮里所有把手牌放完的玩家并列获胜，已经在这一轮行动过的人不会得到额外回合。</p>",
          en: "<p>When you hold a single tile, that tile is revealed to everyone.</p>"
            + "<p>The first player to empty their hand triggers the final round, and the round continues to the last seat in turn order.</p>"
            + "<p>Every player who empties their hand during that final round shares the win. Nobody receives an extra turn for having already acted.</p>"
        }
      },
      {
        id: "blocked",
        label: { zh: "线上死局约定", en: "Online blocked rule" },
        html: {
          zh: "<p>牌袋空了以后，如果连续一轮里所有玩家都没有放牌，对局立即结束。</p>"
            + "<p>结束时手里剩余牌最少的玩家获胜，人数可以并列。</p>"
            + "<p>把一张放得下的新牌留在手上不会错误触发这个判定。单人练习如果没能清空手牌，就算练习未完成。</p>"
            + "<p>这是为了避免线上对局卡死而采用的约定，不是官方 Expert 计分规则。</p>",
          en: "<p>Once the bag is empty, the game ends immediately if a full round passes with nobody placing a tile.</p>"
            + "<p>The player holding the fewest remaining tiles then wins, and ties share the win.</p>"
            + "<p>Keeping a drawn tile that could have been placed never triggers this check by mistake. A solo practice that fails to clear the hand counts as unfinished practice.</p>"
            + "<p>This is an online convention that keeps games from stalling. It is not the official Expert scoring rule.</p>"
        }
      }
    ]
  };

  const CHROMINO_EXPLAIN = {
    rotate: { zh: "把选中的牌绕中间那格顺时针旋转 90 度，中间格的位置不变。也可以按 R 键。", en: "Rotate the selected tile clockwise by 90 degrees around its middle square. The middle stays in the same place. You can also press R." },
    confirm: { zh: "放下预览中的牌。先选一枚手牌，再点棋盘上高亮的中点，选好之后按这里才会真正落子。", en: "Place the previewed tile. First select a tile, then a highlighted centre on the board. No move is sent until you confirm." },
    zoom_out: { zh: "缩小视图，看到更大范围的棋盘。", en: "Zoom out to see more of the board." },
    fit: { zh: "把整个棋盘和当前选中牌的所有合法落点收进可视区域。", en: "Fit the whole board and the selected tile's legal destinations into the visible area." },
    zoom_in: { zh: "放大视图，看清每个色块。拖动棋盘可以平移。", en: "Zoom in to inspect the coloured squares. Drag the board to pan." },
    hand_tile: { zh: "你手上的一枚三格牌。选中它之后可以旋转，再点棋盘上高亮的中点决定落点。变色龙(★)不能作为最后一枚牌。", en: "One three-square tile in your hand. Select it, rotate around its middle, then choose a highlighted destination. A Chameleon (★) cannot be your last tile." },
    placed_tile: { zh: "已经放在棋盘上的牌。每一条和相邻牌接触的边都必须同色，中间的变色龙(★)对每条边分别匹配。", en: "A tile already on the board. Every edge touching another tile must match. The Chameleon (★) in the middle matches each neighbour independently." },
    target_center: { zh: "把选中的牌以这一格为中点预览。只有按 Confirm 才会落子，光选落点不会放牌。", en: "Preview the selected tile with its middle at this highlighted square. Confirm sends the move, while selecting a destination alone does not place the tile." },
    draw: { zh: "只有手上所有牌都无处可放时才可以抽 1 枚。手上只剩变色龙(★)时不能打出，所以必须抽牌。抽到的牌放得下就可以立刻打出或者保留，放不下会自动保留。", en: "Draw one tile only if none of your current tiles can be placed. A last Chameleon (★) cannot be played, so you must draw. A playable draw can be placed or kept, while an unplayable draw is kept automatically." },
    keep: { zh: "留下刚抽到的牌并结束回合，即使它本来放得下。抽牌之后不能再打出旧手牌。", en: "Keep the tile you just drew and end your turn, even if it could be placed. You cannot play an older tile after drawing." },
    pass: { zh: "只有牌袋空了而且你没有合法落点时才能跳过。手上有牌放得下时不能主动跳过。", en: "Pass only when the bag is empty and you have no legal placement. You cannot pass voluntarily while a tile can be played." }
  };

  let chrominoHelpWidget = null;
  let chrominoExplainWidget = null;

  function initChrominoHelpExplain() {
    if (chrominoHelpWidget || typeof window.obgCreateHelp !== "function") return;
    chrominoHelpWidget = window.obgCreateHelp(CHROMINO_HELP_CONFIG);
    chrominoExplainWidget = window.obgCreateExplain({
      gameId: "chromino",
      attribute: "data-chromino-explain",
      explanations: CHROMINO_EXPLAIN,
      button: chrominoExplainButton,
      root: () => panel,
      bypass: ["#chrominoHelpBtn", "#chrominoExplainBtn"]
    });
    chrominoHelpButton?.addEventListener("click", () => {
      chrominoExplainWidget?.exit();
      chrominoHelpWidget.open();
    });
    chrominoExplainButton?.addEventListener("click", () => chrominoExplainWidget?.toggle());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChrominoHelpExplain);
  } else {
    initChrominoHelpExplain();
  }
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
  let camera = null;
  let manualCamera = false;
  let pan = null;
  let handGesture = null;

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
    if (chrominoExplainWidget?.isActive() || !element || !active()) return;
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
    if (!camera) return;
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
    pieces.innerHTML = view.placed_tiles.map(tile => `<g data-chromino-tip="${escape(describeTile(tile))}" data-chromino-explain="placed_tile" aria-label="${escape(describeTile(tile))}">${tileSvg(tile, tile.rotation, tile.x * 40, tile.y * 40, lastTile === tile && tile.player_id ? "chromino-last-outline" : "")}</g>`).join("");
    targets.innerHTML = candidates().map(move => `<g role="button" tabindex="0" data-chromino-center="${move.x},${move.y}" data-chromino-explain="target_center" aria-label="Preview tile at ${move.x}, ${move.y}"><rect class="chromino-target${preview?.x === move.x && preview?.y === move.y ? " chromino-selected-target" : ""}" x="${move.x * 40 - 17}" y="${move.y * 40 - 17}" width="34" height="34" rx="7" /><text class="chromino-target-cross" x="${move.x * 40}" y="${move.y * 40}">+</text></g>`).join("");
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
      return `<button type="button" class="chromino-hand-tile${selected === tile.tile_id ? " is-selected" : ""}${isDrawn ? " is-drawn" : ""}" data-chromino-tile="${tile.tile_id}" data-chromino-explain="hand_tile" aria-label="${escape(`${describeTile(tile)}. ${label}`)}" aria-pressed="${selected === tile.tile_id}"${enabled ? "" : " disabled"}>${tileHtml(tile)}<span class="chromino-hand-label">${label}</span></button>`;
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
    if (!available("place")) return;
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
    if (!available("place")) return;
    const match = candidates().find(move => `${move.x},${move.y}` === center);
    if (!match) return;
    preview = {...match};
    renderBoard(); renderControls();
  }

  function rotate() {
    if (!selected || !available("place")) return;
    rotation = (rotation + 90) % 360;
    preview = preview ? candidates().find(move => move.x === preview.x && move.y === preview.y) || null : null;
    renderBoard(); renderControls();
  }

  function submit(action) {
    if (!action || !available(action.type) || typeof sendAction !== "function") return;
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
    if (event.button !== 0 || !event.isPrimary || !camera) return;
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
  document.getElementById("chrominoFit").addEventListener("click", () => fit());

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
    if (!active()) return;
    if (event.key === "Escape") {
      hideTip(); endPan(); resetSelection(); renderHand(); renderControls(); renderBoard();
    } else if (event.key.toLowerCase() === "r" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest("input, textarea, select, [contenteditable]")) {
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
    endPan(); resetSelection(); hideTip();
    clearTimeout(pendingTimer);
    pending = false; view = null; signature = null; camera = null; manualCamera = false; handGesture = null;
    pieces.replaceChildren(); targets.replaceChildren(); ghost.replaceChildren(); hand.replaceChildren();
    ["chrominoPlayers", "chrominoLog", "chrominoResult"].forEach(id => document.getElementById(id).replaceChildren());
    document.getElementById("chrominoResult").classList.add("hidden");
    ["chrominoConfirm", "chrominoRotate", "chrominoDraw", "chrominoKeep", "chrominoPass"].forEach(id => { document.getElementById(id).disabled = true; });
    ["chrominoKeep", "chrominoPass"].forEach(id => document.getElementById(id).classList.add("hidden"));
    document.getElementById("chrominoDraw").classList.remove("hidden");
    document.getElementById("chrominoTurn").textContent = "Waiting to start";
    document.getElementById("chrominoSelection").textContent = "Choose a tile.";
    document.getElementById("chrominoBag").textContent = "";
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
  window.showChrominoHeaderActions = visible => {
    document.getElementById("chrominoHeaderActions").style.display = visible ? "flex" : "none";
    if (!visible) clear();
  };
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
