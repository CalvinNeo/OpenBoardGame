(function () {
  "use strict";

  function init() {
    const GAME_ID = "marrakech";
    const byId = (suffix) => document.getElementById(`marrakech${suffix}`);
    const panel = byId("Panel");
    if (!panel || panel.dataset.marrakechReady) return;
    panel.dataset.marrakechReady = "true";
    const palette = { coral: "#bd5143", gold: "#bc8b23", teal: "#297f80", violet: "#7b6196" };
    const patterns = { coral: "◇", gold: "✦", teal: "≋", violet: "✧" };
    const arrows = ["↑", "→", "↓", "←"];
    const names = ["North", "East", "South", "West"];
    let view = null;
    let activeRoom = null;
    let selection = null;
    let anchor = null;
    let selectedDirection = null;
    let inFlight = false;
    let requestTimer = null;
    let tooltipTimer = null;
    let boardWidth = null;
    let fitBoard = true;
    let gesture = null;
    let suppressClick = false;
    const explanations = {
      board: { zh: "市场为七乘七格。图案和颜色区分地毯，地毯中线连接同一张毯子的两半。阿萨姆(↑)朝箭头方向移动。边缘弯线连接退出格与重新进入格，不消耗额外步数。", en: "The market is seven by seven. Colors and woven symbols distinguish rugs. Joined halves belong to one rug. Assam (↑) faces the arrow. Border loops connect an exit to its next square without costing an extra step." },
      orient: { zh: "掷骰前选择朝向：直行、左转或右转九十度，不能掉头。选中后点击 Confirm，朝向即锁定，再掷骰。", en: "Before rolling, choose straight ahead or a 90-degree turn left or right. You cannot reverse. Confirm locks the direction before you roll." },
      roll: { zh: "骰子(🎲)六面为一、二、二、三、三、四步。锁定朝向后掷骰并自动移动和付款，然后才能铺毯。", en: "The die (🎲) has faces 1, 2, 2, 3, 3 and 4. After locking your direction, roll to move and automatically pay any landing fee before placing a rug." },
      place: { zh: "预览后确认铺毯。两格必须相邻，至少一格与阿萨姆所在格共边，不能盖住阿萨姆，也不能一次完整覆盖同一张毯子。", en: "Confirm the preview to place your rug. Its two squares must share an edge, at least one must border Assam, and neither may cover Assam. You cannot completely cover a single existing rug in one placement." },
      shift: { zh: "将预览地毯移动一格，红框表示非法位置。按钮只调整预览，不会提交。", en: "Move the rug preview one square. Red outlines indicate an illegal placement. These buttons never submit the move." },
      rotate: { zh: "围绕地毯几何中心旋转九十度，再吸附到最近的棋盘格。格点中心不兼容时优先选择最近的合法位置，确认前仍可移动。", en: "Rotate 90 degrees around the rug's geometric center, then snap to the nearest grid-aligned position. Prefer a legal placement when grid parity requires a half-square adjustment. You can still move before confirming." },
      cancel: { zh: "取消未确认的预览，也可以点击棋盘外的空白或按 Escape。不会撤销已提交的行动。", en: "Cancel an unconfirmed preview. You can also tap blank space outside the board or press Escape. Submitted moves cannot be undone." },
      zoom: { zh: "加减按钮缩放棋盘，Fit 显示完整棋盘，Origin 恢复六百像素原始尺寸。放大后可拖动，棋盘外仍可正常滚动页面。", en: "Zoom in or out, use Fit to show the whole board, or Origin for its 600-pixel native size. Drag to pan after zooming. Page scrolling still works outside the board." },
      payment: { zh: "落在对手地毯上，要按该格所在的同色共边连通区域格数支付金币(💰)，落点也计算。不同颜色即使同属一人也不连通。不能付清时交出全部余额并出局，恰好付清到零元不会出局。", en: "Landing on an opponent's rug costs dirhams (💰) equal to its edge-connected region of the same color, including the landing square. Different colors never merge, even with the same owner. If you cannot pay in full, pay your remaining coins and leave the game. Paying exactly down to zero does not eliminate you." },
      score: { zh: "分数(★)为金币(💰)加可见半毯格数(◇)。毯子(▰)显示剩余数量。双人时每人两种颜色。总分平手比较金币，仍相同则并列获胜。", en: "Score (★) is dirhams (💰) plus visible rug squares (◇). Rugs (▰) shows the remaining supply. In two-player games each merchant owns two colors. Break score ties with coins, then share victory if still tied." }
    };
    const MARRAKECH_HELP = {
      gameId: GAME_ID,
      title: { zh: "马拉喀什 · Marrakech", en: "Marrakech" },
      basic: {
        win: { zh: "所有地毯铺完后，金币(💰)加可见半毯格数(◇)最高者获胜，平手时金币更多者胜出。", en: "When all rugs are laid, win with the most dirhams (💰) plus visible rug squares (◇), breaking ties with coins." },
        turn: { zh: "每回合先选定阿萨姆(↑)朝向，再掷骰子(🎲)移动并支付落点费用，最后在他旁边铺一张两格地毯。", en: "Each turn, orient Assam (↑), roll the die (🎲) to move and pay any landing fee, then lay a two-square rug beside him." },
        key: { zh: "躲避对手的同色大区域，同时连接自己的地毯并覆盖对手的可见格。", en: "Avoid large opposing regions while connecting your own rugs and covering your opponents' visible squares." }
      },
      sections: [
        { id: "movement", label: { zh: "移动与收费", en: "Movement & fees" }, html: {
          zh: "<h3>先定方向再掷骰</h3><p>每人起始有三十金币(💰)，阿萨姆(↑)从中央朝北出发。只能保持方向、左转或右转九十度，不能掉头。骰子(🎲)六面为一、二、二、三、三、四步。离开棋盘时沿边缘弯线进入相邻入口，弯线本身不占步数。</p><h3>按同色区域支付</h3><p>落在空格或自己的地毯上不用付款。落在对手地毯上，按该落点所在的同色共边连通区域格数支付金币，落点本身也计算，斜角不相连。只有最终落点收费，经过的格子不收费。</p>",
          en: "<h3>Choose before rolling</h3><p>Each merchant starts with 30 dirhams (💰). Assam (↑) starts in the center facing north. Keep his direction or turn 90 degrees left or right, never reverse. The die (🎲) has faces 1, 2, 2, 3, 3 and 4. Follow the border loops when leaving the board. The loop itself costs no step.</p><h3>Pay for a connected color</h3><p>Landing on empty ground or your own rugs is free. On an opponent's rug, pay one coin for each square in its edge-connected region of that exact color, including the landing square. Diagonals do not connect. Only the final landing square triggers payment.</p>"
        } },
        { id: "rugs", label: { zh: "铺毯与操作", en: "Rugs & controls" }, html: {
          zh: "<h3>铺放两格地毯</h3><p>至少一格要与阿萨姆所在格共边，不能盖住他。可覆盖空格、单张旧毯的一半，或两张不同旧毯各一半。不能一次完整盖住同一张旧毯，无论旧毯属于谁。</p><h3>预览再确认</h3><p>点击格子预览，再点相邻格调整方向。也可用方向按钮和 Rotate 围绕中心旋转并吸附到棋盘。点击 Place rug 才提交，红框表示非法。点击空白、Cancel 或 Escape 可取消预览。缩放后拖动棋盘查看，Fit 恢复全图。</p>",
          en: "<h3>Lay two squares</h3><p>At least one half of the new rug must share an edge with Assam's square. Never cover Assam. Cover empty squares, one half of an old rug, or halves of two different old rugs. Never cover both halves of the same old rug in one move, even your own.</p><h3>Preview, then confirm</h3><p>Tap a square to preview, then a neighboring square to adjust. Direction buttons move the preview. Rotate turns around its center and snaps to the grid. Only Place rug submits. Red means illegal. Tap blank space, Cancel, or Escape to cancel a preview. Drag a zoomed board to pan and use Fit to restore the full view.</p>"
        } },
        { id: "ending", label: { zh: "人数与结算", en: "Setup & ending" }, html: {
          zh: "<h3>地毯供应</h3><p>三人时每人十五张同色毯，四人时每人十二张。双人时每人两种颜色各十二张，混洗为固定顺序的二十四张供应堆，每次只能使用顶端颜色。双人两种颜色分别计算连通费用，不能混色连成大区域。</p><h3>破产与最终得分</h3><p>不能付清时先交出全部金币(💰)，随后出局，不再铺毯。其余地毯保留在棋盘但不再收取费用。恰好付清到零元不会出局。所有存活玩家的毯子铺完，或仅余一人时结束。分数(★)为金币加可见半毯格数(◇)，总分相同时金币更多者获胜，仍平手则共享胜利。毯子(▰)表示剩余供应。本游戏是连续轮流行动的一局，没有自动清盘的新一轮。</p>",
          en: "<h3>Rug supplies</h3><p>Three merchants receive 15 rugs each in one color. Four receive 12 each. With two players, each owns 12 rugs in each of two colors, shuffled into a fixed 24-rug stack. Always play the top color. The two colors remain separate for connected-area fees.</p><h3>Bankruptcy and scoring</h3><p>If you cannot pay in full, give up your remaining dirhams (💰) and leave without laying a rug. Your rugs stay on the board but no longer collect fees. Paying exactly down to zero does not eliminate you. Finish when every surviving merchant runs out of rugs, or only one survives. Score (★) is coins plus visible rug squares (◇). Break ties with coins, then share victory if still tied. Rugs (▰) indicates the remaining supply. This is one continuous turn-based game, not a series of automatically resetting rounds.</p>"
        } }
      ]
    };
    const help = window.obgCreateHelp(MARRAKECH_HELP);
    const explain = window.obgCreateExplain({
      gameId: GAME_ID, attribute: "data-marrakech-explain", explanations: explanations,
      root: () => panel, button: byId("ExplainBtn"), bypass: ["#marrakechHelpBtn", "#marrakechExplainBtn"]
    });
    const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    const can = (type) => Boolean(view?.legal_actions.includes(type) && !inFlight);
    const playerName = (playerId) => view?.players.find((player) => player.player_id === playerId)?.name || playerId;
    const sortedCells = (cells) => [...cells].sort((first, second) => first[1] - second[1] || first[0] - second[0]);
    const sameCells = (first, second) => JSON.stringify(sortedCells(first)) === JSON.stringify(sortedCells(second));
    const validSelection = () => Boolean(selection && view.legal_placements.some((cells) => sameCells(cells, selection)));
    const describe = (node, key, text) => { node.dataset.marrakechExplain = key; if (text) explanations[key] = { zh: text, en: text }; };

    function hideTooltip() {
      clearTimeout(tooltipTimer);
      byId("Tooltip").classList.add("hidden");
    }

    function showTooltip(node) {
      if (explain.isActive() || !node) return;
      const text = explanations[node.dataset.marrakechTip]?.[window.obgHelpLang() === "en" ? "en" : "zh"];
      if (!text) return;
      const tooltip = byId("Tooltip");
      tooltip.textContent = text;
      tooltip.classList.remove("hidden");
      const bounds = node.getBoundingClientRect();
      tooltip.style.left = `${Math.max(12, Math.min(innerWidth - tooltip.offsetWidth - 12, bounds.left))}px`;
      tooltip.style.top = `${Math.max(12, Math.min(innerHeight - tooltip.offsetHeight - 12, bounds.bottom + 5))}px`;
      clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(hideTooltip, 3000);
    }

    function send(type, fields = {}) {
      if (!can(type)) return;
      inFlight = true;
      hideTooltip();
      clearTimeout(requestTimer);
      requestTimer = setTimeout(() => { inFlight = false; render(); }, 6000);
      sendAction({ type, ...fields });
      render();
    }

    function renderPlayers() {
      byId("Players").innerHTML = view.players.map((player) => `<div class="marrakech-player ${player.player_id === view.current_turn ? "is-current" : ""} ${player.eliminated ? "is-out" : ""}" data-marrakech-explain="score" data-marrakech-tip="score" tabindex="0">
        <div class="marrakech-player-name">${player.colors.map((color) => `<span class="marrakech-swatch" style="--rug-color:${palette[color]}" aria-hidden="true"></span>`).join("")}<strong>${escapeHtml(player.name)}${player.player_id === view.you ? " · you" : ""}</strong></div>
        <div class="marrakech-player-stats"><span>💰 ${player.coins}</span><span>◇ ${player.visible}</span><span>▰ ${player.rugs_left}</span><span>★ ${player.total}${player.eliminated ? " · out" : ""}</span></div></div>`).join("");
      byId("Players").style.gridTemplateColumns = view.players.length === 2 ? "repeat(2,minmax(0,1fr))" : "";
    }

    function drawRoutes() {
      const paths = [];
      for (let index = 0; index < 6; index += 2) {
        const start = 100 + index * 100;
        paths.push(`M ${start} 50 C ${start} 5 ${start + 100} 5 ${start + 100} 50`);
        paths.push(`M 50 ${start} C 5 ${start} 5 ${start + 100} 50 ${start + 100}`);
        paths.push(`M ${start + 100} 750 C ${start + 100} 795 ${start + 200} 795 ${start + 200} 750`);
        paths.push(`M 750 ${start + 100} C 795 ${start + 100} 795 ${start + 200} 750 ${start + 200}`);
      }
      paths.push("M 700 50 C 700 0 800 0 800 50 Q 800 100 750 100", "M 100 750 C 100 800 0 800 0 750 Q 0 700 50 700");
      byId("Routes").innerHTML = paths.map((path) => `<path d="${path}" fill="none" stroke="#8d7652" stroke-width="4"/>`).join("");
    }

    function renderBoard() {
      const board = byId("Board");
      const paid = view.last_move?.payment.area || [];
      const valid = validSelection();
      const neighbors = new Set(view.legal_placements.flat().map((cell) => cell.join(",")));
      board.replaceChildren();
      view.board.forEach((row, rowIndex) => row.forEach((tile, column) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "marrakech-cell";
        cell.dataset.marrakechCell = `${column},${rowIndex}`;
        const isAssam = column === view.assam.x && rowIndex === view.assam.y;
        const preview = selection?.some((point) => point[0] === column && point[1] === rowIndex);
        if (tile) {
          cell.classList.add("has-rug");
          cell.style.setProperty("--rug-color", palette[tile.color]);
          cell.innerHTML = `<span class="marrakech-rug-pattern">${patterns[tile.color]}</span>`;
          if (view.board[rowIndex][column + 1]?.rug_id === tile.rug_id) cell.classList.add("same-right");
          if (view.board[rowIndex + 1]?.[column]?.rug_id === tile.rug_id) cell.classList.add("same-down");
        }
        if (preview) {
          cell.classList.add("is-preview");
          cell.classList.toggle("is-invalid", !valid);
          cell.style.setProperty("--preview-color", palette[view.next_color]);
        } else if (can("place") && neighbors.has(`${column},${rowIndex}`)) cell.classList.add("is-neighbor");
        if (paid.some((point) => point[0] === column && point[1] === rowIndex)) cell.classList.add("is-paid");
        if (isAssam) cell.innerHTML += `<span class="marrakech-assam">${arrows[view.assam.direction]}</span>`;
        const detail = `${String.fromCharCode(65 + column)}${rowIndex + 1}. ${tile ? `${tile.color} rug of ${playerName(tile.owner)}.` : "Empty square."} ${isAssam ? `Assam faces ${names[view.assam.direction]}.` : ""}`;
        cell.setAttribute("aria-label", detail);
        describe(cell, `cell_${column}_${rowIndex}`, `${detail} ${explanations.board.en} ${explanations.place.en}`);
        if (!can("place")) cell.dataset.marrakechTip = `cell_${column}_${rowIndex}`;
        cell.addEventListener("click", () => selectCell(column, rowIndex));
        board.appendChild(cell);
      }));
      byId("Place").disabled = !can("place") || !valid;
      byId("Rotate").disabled = !can("place") || !selection;
      byId("Cancel").disabled = !selection;
      panel.querySelectorAll("[data-marrakech-shift]").forEach((button) => { button.disabled = !can("place") || !selection; });
      byId("PlacementHint").textContent = selection ? valid ? "Ready to weave" : "Choose a legal position" : "Tap a square to preview";
      explain.refresh();
    }

    function selectCell(column, row) {
      if (!can("place")) return;
      const point = [column, row];
      if (anchor && Math.abs(anchor[0] - column) + Math.abs(anchor[1] - row) === 1) {
        selection = [anchor, point];
      } else {
        const candidate = view.legal_placements.find((cells) => cells.some((cell) => cell[0] === column && cell[1] === row));
        if (!candidate) { selection = null; anchor = null; renderBoard(); return; }
        anchor = point;
        selection = candidate.map((cell) => [...cell]);
      }
      renderBoard();
    }

    function rotateSelection() {
      if (!selection || !can("place")) return;
      const center = [(selection[0][0] + selection[1][0]) / 2, (selection[0][1] + selection[1][1]) / 2];
      const horizontal = selection[0][1] === selection[1][1];
      const candidates = [];
      for (let row = 0; row < 7; row += 1) for (let column = 0; column < 7; column += 1) {
        const cells = [[column, row], [column + (horizontal ? 0 : 1), row + (horizontal ? 1 : 0)]];
        if (cells[1][0] > 6 || cells[1][1] > 6) continue;
        const distance = ((cells[0][0] + cells[1][0]) / 2 - center[0]) ** 2 + ((cells[0][1] + cells[1][1]) / 2 - center[1]) ** 2;
        const legal = view.legal_placements.some((candidate) => sameCells(candidate, cells));
        candidates.push({ cells, value: distance + (legal ? 0 : 0.01) });
      }
      candidates.sort((first, second) => first.value - second.value);
      selection = candidates[0].cells;
      anchor = selection[0];
      renderBoard();
    }

    function resizeBoard() {
      const viewport = byId("Viewport");
      const width = Math.max(180, viewport.clientWidth);
      if (fitBoard || boardWidth === null) boardWidth = width;
      byId("World").style.width = `${boardWidth}px`;
    }

    function render() {
      if (!view) return;
      byId("Lobby").classList.add("hidden");
      byId("Table").classList.remove("hidden");
      byId("Turn").textContent = view.game_over ? "The market is closed" : `${playerName(view.current_turn)}${view.current_turn === view.you ? " · your turn" : "'s turn"}`;
      byId("Phase").textContent = view.game_over ? "Final scores" : `Turn ${view.turn_number} · ${{ orient: "Orient", roll: "Roll", place: "Weave" }[view.phase]}`;
      renderPlayers();
      byId("Placement").classList.toggle("hidden", !view.legal_actions.includes("place"));
      byId("RugLabel").textContent = `${patterns[view.next_color] || "◇"} ${view.next_color || ""} rug`;
      const active = view.current_turn === view.you && !view.game_over;
      byId("AssamControls").classList.toggle("hidden", !active || view.phase === "place");
      const orient = byId("Orient");
      orient.replaceChildren();
      if (view.phase === "orient" && active) {
        view.directions.forEach((direction) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `marrakech-direction${selectedDirection === direction ? " is-selected" : ""}`;
          button.textContent = `${arrows[direction]} ${names[direction]}`;
          button.disabled = inFlight;
          describe(button, "orient");
          button.addEventListener("click", () => { selectedDirection = direction; render(); });
          orient.appendChild(button);
        });
      }
      byId("Roll").textContent = view.phase === "orient" ? "Confirm" : "🎲 Roll die";
      byId("Roll").dataset.marrakechExplain = view.phase === "orient" ? "orient" : "roll";
      byId("Roll").disabled = inFlight || (view.phase === "orient" ? selectedDirection === null : !can("roll"));
      byId("Message").textContent = view.game_over ? "Coins + visible squares. Ties go to the richer merchant." : active ? ({ orient: "Choose Assam's direction.", roll: "Direction locked. Roll to move.", place: "Lay your next rug beside Assam." })[view.phase] : `Waiting for ${playerName(view.current_turn)} to ${view.phase === "place" ? "lay a rug" : view.phase === "roll" ? "roll" : "choose a direction"}.`;
      const move = view.last_move;
      byId("LastMove").textContent = move ? `🎲 ${playerName(move.player_id)} moved ${move.roll}. ${move.payment.due ? `Paid 💰 ${move.payment.paid} to ${playerName(move.payment.owner)}${move.payment.paid < move.payment.due ? ` of ${move.payment.due} due · bankrupt` : ""}.` : "No payment."}` : "";
      byId("Results").classList.toggle("hidden", !view.game_over);
      if (view.game_over) byId("Results").innerHTML = `<h3>Market winners</h3><p>${escapeHtml(view.winner.map(playerName).join(" & "))}</p>${[...view.players].sort((first, second) => Number(first.eliminated) - Number(second.eliminated) || second.total - first.total || second.coins - first.coins).map((player) => `<p>${escapeHtml(player.name)} · ${player.total} pts${player.eliminated ? " · eliminated" : ""}</p>`).join("")}`;
      byId("Log").innerHTML = [...view.history].reverse().map((entry) => `<li>${escapeHtml(playerName(entry.player_id))} ${entry.type === "place" ? `laid ${entry.color} at ${entry.cells.map((cell) => `${String.fromCharCode(65 + cell[0])}${cell[1] + 1}`).join("–")}` : `rolled ${entry.roll}${entry.payment.due ? `, paid ${entry.payment.paid}/${entry.payment.due}` : ", no fee"}`}.</li>`).join("");
      renderBoard();
      resizeBoard();
    }

    byId("HelpBtn").addEventListener("click", () => { explain.exit(); hideTooltip(); help.open(); });
    byId("ExplainBtn").addEventListener("click", () => { hideTooltip(); explain.toggle(); });
    byId("Roll").addEventListener("click", () => view.phase === "orient" ? send("orient", { direction: selectedDirection }) : send("roll"));
    byId("Place").addEventListener("click", () => { if (validSelection()) send("place", { cells: selection }); });
    byId("Rotate").addEventListener("click", rotateSelection);
    byId("Cancel").addEventListener("click", () => { selection = null; anchor = null; renderBoard(); });
    panel.querySelectorAll("[data-marrakech-shift]").forEach((button) => button.addEventListener("click", () => {
      if (!selection || !can("place")) return;
      const [deltaX, deltaY] = button.dataset.marrakechShift.split(",").map(Number);
      const shifted = selection.map(([column, row]) => [column + deltaX, row + deltaY]);
      if (shifted.some(([column, row]) => column < 0 || column > 6 || row < 0 || row > 6)) return;
      selection = shifted;
      anchor = shifted[0];
      renderBoard();
    }));
    byId("ZoomIn").addEventListener("click", () => { fitBoard = false; boardWidth = Math.min(1400, boardWidth * 1.25); resizeBoard(); });
    byId("ZoomOut").addEventListener("click", () => { fitBoard = false; boardWidth = Math.max(byId("Viewport").clientWidth, boardWidth / 1.25); resizeBoard(); });
    byId("Fit").addEventListener("click", () => { fitBoard = true; resizeBoard(); byId("Viewport").scrollTo(0, 0); });
    byId("Origin").addEventListener("click", () => { fitBoard = false; boardWidth = 600; resizeBoard(); });

    document.addEventListener("pointerdown", (event) => {
      if (!panel.contains(event.target) || explain.isActive()) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, touch: event.pointerType === "touch", board: byId("Viewport").contains(event.target), left: byId("Viewport").scrollLeft, top: byId("Viewport").scrollTop };
      suppressClick = false;
    }, true);
    document.addEventListener("pointermove", (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.moved = true;
      if (gesture.moved && gesture.board) {
        byId("Viewport").setPointerCapture(event.pointerId);
        byId("Viewport").scrollLeft = gesture.left - (event.clientX - gesture.x);
        byId("Viewport").scrollTop = gesture.top - (event.clientY - gesture.y);
      }
    }, true);
    document.addEventListener("pointerup", (event) => {
      if (gesture?.id !== event.pointerId) return;
      suppressClick = gesture.moved;
      if (!gesture.moved && gesture.touch) showTooltip(event.target.closest("[data-marrakech-tip]"));
      if (byId("Viewport").hasPointerCapture(event.pointerId)) byId("Viewport").releasePointerCapture(event.pointerId);
      gesture = null;
    }, true);
    document.addEventListener("pointercancel", () => { suppressClick = Boolean(gesture?.moved); gesture = null; }, true);
    document.addEventListener("click", (event) => {
      if (!panel.contains(event.target)) return;
      if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; return; }
      if (!event.target.closest("button, .marrakech-board, .marrakech-placement-tools") && selection && !explain.isActive()) {
        selection = null; anchor = null; renderBoard();
      }
    }, true);
    panel.addEventListener("pointerover", (event) => { if (event.pointerType === "mouse") showTooltip(event.target.closest("[data-marrakech-tip]")); });
    panel.addEventListener("pointerout", hideTooltip);
    panel.addEventListener("focusin", (event) => showTooltip(event.target.closest("[data-marrakech-tip]")));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { selection = null; anchor = null; selectedDirection = null; hideTooltip(); if (view) render(); }
    });
    window.addEventListener("scroll", hideTooltip, true);
    new ResizeObserver(resizeBoard).observe(byId("Viewport"));

    function syncRoom(room) {
      if (room?.game_type !== GAME_ID) { explain.exit(); help.close(); hideTooltip(); return; }
      if (room.room_id !== activeRoom || room.status === "lobby") {
        activeRoom = room.room_id;
        view = null; selection = null; anchor = null; selectedDirection = null; inFlight = false;
        clearTimeout(requestTimer);
        byId("Lobby").classList.remove("hidden");
        byId("Table").classList.add("hidden");
      }
    }

    window.renderMarrakechGameState = (data) => {
      if (data?.game_type !== GAME_ID || !data.view) return;
      if (typeof currentRoomState !== "undefined" && currentRoomState?.room_id && currentRoomState.room_id !== data.room_id) return;
      activeRoom = data.room_id;
      clearTimeout(requestTimer);
      view = data.view; inFlight = false; selection = null; anchor = null; selectedDirection = null;
      hideTooltip(); render();
    };
    window.showMarrakechHeaderActions = (show) => {
      byId("HeaderActions").style.display = show ? "flex" : "none";
      if (!show) { explain.exit(); help.close(); hideTooltip(); }
    };
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { if (inFlight) { clearTimeout(requestTimer); inFlight = false; render(); } });
    drawRoutes();
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === GAME_ID && lastGameStatePayload.room_id === activeRoom && currentRoomState?.status !== "lobby") window.renderMarrakechGameState(lastGameStatePayload);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
