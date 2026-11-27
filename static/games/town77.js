(function () {
  "use strict";

  function init() {
    const byId = (suffix) => document.getElementById(`town77${suffix}`);
    const panel = byId("Panel");
    if (!panel || panel.dataset.town77Ready) return;
    panel.dataset.town77Ready = "true";
    let view = null;
    let activeRoom = null;
    let selected = null;
    let position = null;
    let exchangeGroup = null;
    let pending = false;
    let requestTimer = null;
    let tooltipTimer = null;
    let gesture = null;
    let ignoreClick = false;
    const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    const explanations = {
      board: { zh: "七乘七的城镇。新房必须与旧房共边，同一整行及整列都不能出现相同颜色或屋顶，隔着空格也要检查。金框只是预览，虚线格是所选牌的合法位置。", en: "A seven-by-seven town. Build beside an existing house. Neither its color nor roof may repeat anywhere in its entire row or column, even across gaps. Gold is a preview. Dashed squares are legal for your selected tile." },
      supply: { zh: "袋中牌(▧)只公开数量，不公开顺序。放牌后若手牌仍非空，必须补一枚，然后可退回一枚。单人模式显示三堆余量，只能用堆顶。", en: "The bag (▧) reveals only its size, not its order. After building, draw if your hand is not empty, then optionally return one tile. Solo play instead uses the three visible stack tops." },
      place: { zh: "先选手牌，再点虚线格预览。只有点击 Build here 才正式建造。房屋是固定朝向的单格牌，旋转不改变颜色、屋顶或合法性。", en: "Choose a tile, then a dashed square to preview it. Only Build here commits. Houses are fixed-orientation single-square tiles. Rotation cannot change their roof, color, or legality." },
      cancel: { zh: "取消当前预览，不提交行动。点击空白或按 Escape 也可取消。", en: "Cancel the preview without taking an action. Blank space or Escape also cancels." },
      move: { zh: "把预览移动一格，红框表示非法，不能提交。方向按钮不提交行动。", en: "Shift the preview one square. Red means illegal and cannot be built. Direction buttons never submit a move." },
      keep: { zh: "保留补牌后的所有手牌并结束回合，手牌总数与回合开始时相同。", en: "Keep every tile after drawing and end your turn. Your hand stays the same size as at the start of the turn." },
      discard: { zh: "把选中的手牌秘密放回袋中并混洗，手牌永久减少一枚。可选择刚补到的牌。只有点击 Return tile 才提交。", en: "Secretly return the selected tile to the bag and shuffle. Your hand permanently shrinks by one. You may return the tile you just drew. Only Return tile commits." },
      retire: { zh: "没有合法放置时退出，余牌保留用于排名。不能用它跳过仍可进行的建造，仍可先使用三枚换牌挽救手牌。", en: "Retire when no tile can be placed. Your remaining tiles count for ranking. You cannot skip a legal build. You may still exchange three matching tiles first if eligible." },
      exchange: { zh: "回合开始可公开三枚同色或同形手牌，放回袋中混洗再抽三枚。手牌有四枚符合条件时任选三枚，换后仍满足条件可再次换。", en: "At the start of your turn, reveal three tiles sharing a color or roof, return them to the bag, shuffle, and draw three. With four matching tiles, choose which three. You may repeat if still eligible." },
      players: { zh: "对手只公开手牌背面的颜色与纹理，不公开屋顶形状。姓名边的标记和完整姓名用于区分玩家。已退出者仍参与最终排名。", en: "Opponents reveal only the colors and patterns on their tile backs, never roof shapes. A marker and full name identify each neighbor. Retired players still participate in the final ranking." },
      results: { zh: "先比较余牌数，越少越好。相同时越晚退出排名越高，先空手并不立即获胜。单人成绩为全部已建房屋数，含先驱房屋。所有玩家确认后才可重玩。", en: "Fewer remaining tiles rank higher. Ties favor the player who retired later. Emptying your hand first is not an immediate victory. The solo score counts every built house, including the pioneer. Everyone confirms before replay becomes available." }
    };
    const tips = {
      board: { zh: "七乘七城镇，整行整列不能同色或同形，房屋须共边。", en: "A seven-by-seven town. No repeated color or roof in a row or column. Houses must touch an edge." },
      supply: { zh: "袋中余牌数。单人只能选择三堆堆顶，不能看堆底。", en: "Tiles still in the bag. Solo play uses only visible stack tops, never buried tiles." },
      players: { zh: "对手只公开颜色背面，不公开屋顶。", en: "Opponents reveal tile-back colors, never roof shapes." },
      results: { zh: "余牌越少越好，平手时越晚退出越好。", en: "Fewer tiles rank higher. Ties favor later retirement." }
    };
    const TOWN77_HELP = {
      gameId: "town77", title: { zh: "Town 77 · 七彩小镇", en: "Town 77" },
      basic: {
        win: { zh: "结束时手牌最少者获胜，平手时越晚退出越好，单人则追求建造更多房屋。", en: "Finish with the fewest tiles, breaking ties in favor of later retirement, or build as many houses as possible in solo play." },
        turn: { zh: "先可换三枚同色或同形牌，再建一间房，未空手则补牌并可退回一枚。", en: "Optionally exchange three matching tiles, build one house, then draw if not empty and optionally return one tile." },
        key: { zh: "在减少手牌与保留选择之间取舍，并确保保留的屋顶和颜色仍有地方建。", en: "Balance shrinking your hand against retaining options, and preserve places for the colors and roofs you keep." }
      },
      sections: [
        { id: "town", label: { zh: "建造", en: "Building" }, html: {
          zh: "<p>49 枚房屋牌是七种颜色与七种屋顶的一一组合。多人每人四枚手牌，另抽一枚先驱房屋放在左上角。所有人共享七乘七城镇。每次新房必须与旧房共边，整行及整列都不允许颜色或屋顶重复，即使中间隔着空格。</p><p>点手牌后点虚线格，查看金框预览并点击 Build here。可用箭头微调，红框不能提交。房屋单格固定朝向，无需旋转。点空白、Cancel 或按 Escape 取消，不会耗掉回合。</p><p>颜色按珊瑚红(●)、琥珀黄(◆)、青柠绿(✚)、青碧色(≋)、天蓝色(║)、紫罗兰(×)、象牙白(·)以颜色和纹理双重区分。七种屋顶为尖顶、圆顶、双峰顶、三齿顶、凹顶、斜顶、阶梯顶，颜色纹理与屋顶形状是独立属性。</p>",
          en: "<p>The 49 houses combine seven colors and seven roofs exactly once. Each player starts with four tiles. A separate pioneer starts the shared seven-by-seven town at the upper-left corner. Every new house must share an edge with an existing house. Its color and roof must both be absent from its entire row and column, even across gaps.</p><p>Choose a tile, tap a dashed square, inspect the gold preview, then Build here. Arrows shift the preview. Red positions cannot be submitted. Single-square houses have a fixed orientation. Blank space, Cancel, or Escape cancels without spending a turn.</p><p>Color patterns are Coral (●), Amber (◆), Lime (✚), Teal (≋), Blue (║), Violet (×), and Ivory (·). Roofs are Gable, Dome, Twin, Crown, Valley, Shed, and Steps. Patterns identify color independently of roof shape.</p>"
        } },
        { id: "hand", label: { zh: "手牌与换牌", en: "Hand & exchanges" }, html: {
          zh: "<p>回合开始可公开三枚同色或同形牌，放回袋中混洗并抽三枚，仍符合条件就可再换。四枚符合时任选三枚。</p><p>放牌后空手就退出，不再补牌。否则袋中牌(▧)足够时必须补一枚，再决定 Keep all 或选一枚 Return tile。退回哪一枚是秘密，也可退回刚补到的牌。手牌总数不能增加，缩手不可逆。袋空时跳过补牌和弃牌。</p><p>无法建造时点击 Retire 退出，不能有牌可放却跳过。对手可看见手牌颜色背面，但看不到屋顶。换出的三枚牌必须公开，弃回的牌不公开。</p>",
          en: "<p>At the start of a turn, you may reveal three tiles sharing a color or roof, return them to the bag, shuffle, and draw three. Repeat if eligible. With four matching tiles, choose three.</p><p>If building empties your hand, retire without drawing. Otherwise, draw from the bag (▧), then Keep all or select one tile to Return tile. The returned tile is secret and may be the tile you just drew. Your hand cannot grow, and shrinking is irreversible. If the bag is empty, skip drawing and returning.</p><p>Retire when unable to build. You cannot skip a legal placement. Opponents see your tile-back colors but not your roofs. Exchanged triples are public. Returned tiles are secret.</p>"
        } },
        { id: "ending", label: { zh: "排名", en: "Ranking" }, html: {
          zh: "<p>即使有人手牌清空，其他人仍继续。所有人都退出后，余牌少者优先，余牌相同则退出更晚者优先。因此先打光并不立即获胜。结算列出余牌、建造数、退出先后与剩余牌面。所有人确认后才开放重玩。</p><p>这是一局连续的轮流建造游戏，没有需要自动切换的新一轮。Town journal 可折叠并独立滚动。机器人使用专门的机动性、封锁与两步搜索策略，不读取隐藏屋顶或袋中顺序。</p>",
          en: "<p>Even after one player empties their hand, everyone else continues. Once everyone has retired, rank by fewer tiles, then later retirement. Emptying first does not win immediately. Results show remaining tiles, houses built, retirement order, and remaining faces. Everyone confirms before replay.</p><p>This is one continuous turn-based game with no automatically resetting rounds. The Town journal is collapsible and scrollable. Bots use mobility, blocking, and two-step search without reading hidden roofs or bag order.</p>"
        } },
        { id: "solo", label: { zh: "单人", en: "Solo" }, html: {
          zh: "<p>单人自动使用独立规则，不使用手牌或袋子。将全部49枚约等分成17、16、16三堆，选择任一堆顶放在左上角作为先驱。以后只能选择堆顶建造，不能重排堆底或移动已建房屋。</p><p>全部建完或所有堆顶均无合法位置时结束，成绩就是城镇中的房屋总数，包含先驱。三堆采用官方勘误的约等分，不采用旧版误印的每堆十二枚。单人使用相同的行、列与共边相邻限制。</p>",
          en: "<p>One player automatically uses the dedicated solo puzzle with no hand or bag. Split all 49 tiles into three roughly equal face-up stacks of 17, 16, and 16. Choose any visible top as the pioneer at the upper left. Then build only from stack tops. Never reorder a stack or move built houses.</p><p>Finish when every tile has been built or no stack top can be placed. Your score is the total town size, including the pioneer. This follows the publisher's corrected roughly equal stacks, not the misprinted twelve tiles per stack. Row, column, and edge-adjacency restrictions still apply.</p>"
        } }
      ]
    };
    const help = typeof window.obgCreateHelp === "function" ? window.obgCreateHelp(TOWN77_HELP) : { open() {}, close() {} };
    const explain = typeof window.obgCreateExplain === "function" ? window.obgCreateExplain({
      gameId: "town77", attribute: "data-town77-explain", explanations: explanations,
      root: () => panel, button: byId("ExplainBtn"), bypass: ["#town77HelpBtn", "#town77ExplainBtn"]
    }) : { exit() {}, toggle() {}, refresh() {}, isActive: () => false };
    const can = (action) => Boolean(view?.legal_actions.includes(action) && !pending);
    const playerName = (playerId) => view?.players.find((player) => player.player_id === playerId)?.name || "Neighbor";
    const cellName = (column, row) => `${String.fromCharCode(65 + column)}${row + 1}`;
    const nameTile = (tile) => `${view.catalog.colors[Math.floor(tile / 7)].name} ${view.catalog.shapes[tile % 7].name}`;
    const validPosition = () => position && selected !== null && view.legal_placements.some((move) => move.tile === selected && move.x === position[0] && move.y === position[1]);

    function house(tile) {
      const color = view.catalog.colors[Math.floor(tile / 7)];
      const roof = view.catalog.shapes[tile % 7];
      return `<svg class="town77-house" viewBox="0 0 80 80" aria-hidden="true"><path d="${roof.path}" fill="${color.hex}"/><path d="M12 51 H68 V66 H12 Z" fill="#faf4df"/><path d="M23 59 V64 M34 59 V64 M46 59 V64 M57 59 V64" stroke="#254a42" stroke-width="2"/><text x="40" y="45" text-anchor="middle" fill="#254a42" font-size="13" font-family="Arial,sans-serif">${color.symbol}</text></svg>`;
    }

    function describe(node, key, text) {
      node.dataset.town77Explain = key;
      if (text) explanations[key] = { zh: text, en: text };
    }

    function hideTooltip() {
      clearTimeout(tooltipTimer);
      byId("Tooltip").classList.add("hidden");
    }

    function showTooltip(node) {
      if (!node || explain.isActive()) return;
      const key = node.dataset.town77Tip;
      const text = (tips[key] || explanations[key])?.[window.obgHelpLang() === "en" ? "en" : "zh"];
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

    function clearSelection() {
      selected = null;
      position = null;
      exchangeGroup = null;
      hideTooltip();
    }

    function send(type, fields = {}) {
      if (!can(type)) return;
      pending = true;
      clearTimeout(requestTimer);
      requestTimer = setTimeout(() => { pending = false; render(); }, 6000);
      sendAction({ type, ...fields });
      render();
    }

    function renderBoard() {
      const board = byId("Board");
      board.replaceChildren();
      for (let row = 0; row < 7; row += 1) {
        for (let column = 0; column < 7; column += 1) {
          const tile = view.board[row][column];
          const node = document.createElement("button");
          const preview = position && position[0] === column && position[1] === row;
          const legal = selected !== null && view.legal_placements.some((move) => move.tile === selected && move.x === column && move.y === row);
          node.type = "button";
          node.className = `town77-cell${tile !== null ? " is-built" : ""}${legal ? " is-legal" : ""}${preview ? ` is-preview${validPosition() ? "" : " is-invalid"}` : ""}`;
          node.dataset.town77Cell = `${column},${row}`;
          node.setAttribute("aria-label", `${cellName(column, row)}: ${tile !== null ? nameTile(tile) : legal ? "Build preview" : "Empty"}`);
          node.innerHTML = tile !== null ? house(tile) : preview ? house(selected) : `<span class="town77-cell-label">${cellName(column, row)}</span>`;
          if (tile !== null) {
            const color = view.catalog.colors[Math.floor(tile / 7)];
            const roof = view.catalog.shapes[tile % 7];
            const key = `built-${tile}`;
            describe(node, key, `${cellName(column, row)} · ${color.name} (${color.symbol}) ${roof.name} / ${color.zh} ${roof.zh}. ${explanations.board.en}`);
            tips[key] = { zh: `${cellName(column, row)} · ${color.zh}(${color.symbol}) ${roof.zh}`, en: `${cellName(column, row)} · ${color.name} (${color.symbol}) ${roof.name}` };
            node.dataset.town77Tip = key;
          } else {
            describe(node, "board");
          }
          node.addEventListener("click", () => {
            if (ignoreClick) return;
            if (tile !== null) { showTooltip(node); return; }
            if (legal && can("place")) {
              position = preview ? null : [column, row];
              renderBoard();
              renderPreview();
              explain.refresh();
            } else { clearSelection(); render(); }
          });
          board.appendChild(node);
        }
      }
    }

    function renderPreview() {
      byId("Preview").classList.toggle("hidden", !position || !can("place"));
      if (position) byId("PreviewLabel").textContent = `${nameTile(selected)} · ${cellName(...position)}`;
      byId("Place").disabled = !can("place") || !validPosition();
    }

    function renderRack() {
      const rack = byId("Rack");
      rack.classList.toggle("is-solo", view.solo);
      rack.replaceChildren();
      const tiles = view.solo ? view.piles.map((pile) => pile.top) : view.hand;
      tiles.forEach((tile, index) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className = `town77-tile${tile === selected ? " is-selected" : ""}`;
        node.disabled = tile === null || (!can("place") && !can("discard"));
        if (tile !== null) {
          const key = `hand-${tile}`;
          const color = view.catalog.colors[Math.floor(tile / 7)];
          const roof = view.catalog.shapes[tile % 7];
          node.dataset.town77Tile = tile;
          node.setAttribute("aria-label", nameTile(tile));
          node.setAttribute("aria-pressed", String(tile === selected));
          describe(node, key, `${color.name} (${color.symbol}) ${roof.name} / ${color.zh} ${roof.zh}. ${can("discard") ? explanations.discard.en : explanations.place.en}`);
          node.innerHTML = house(tile) + (view.solo ? `<span class="town77-pile-count">${view.piles[index].count} left</span>` : "");
          node.addEventListener("click", () => {
            if (ignoreClick || pending) return;
            selected = selected === tile ? null : tile;
            position = null;
            exchangeGroup = null;
            render();
          });
        } else {
          node.setAttribute("aria-label", "Empty stack");
          node.innerHTML = '<span class="town77-pile-count">Empty</span>';
          describe(node, "supply");
        }
        rack.appendChild(node);
      });
      byId("RackTitle").textContent = view.solo ? "Three rooftops to choose from" : "Your rooftops";
      byId("Keep").classList.toggle("hidden", !view.legal_actions.includes("keep"));
      byId("Keep").disabled = !can("keep");
      byId("Retire").classList.toggle("hidden", !view.legal_actions.includes("pass"));
      byId("Retire").disabled = !can("pass");
      byId("DiscardPreview").classList.toggle("hidden", selected === null || !can("discard"));
      if (selected !== null) byId("DiscardLabel").textContent = `Return ${nameTile(selected)} to the bag?`;
      byId("Discard").disabled = !can("discard") || selected === null;
    }

    function renderPlayers() {
      byId("Players").replaceChildren();
      view.players.forEach((player, index) => {
        const node = document.createElement("div");
        node.className = `town77-player${view.current_turn === player.player_id ? " is-current" : ""}`;
        node.tabIndex = 0;
        describe(node, "players");
        node.dataset.town77Tip = "players";
        const backs = player.colors.map((colorIndex) => {
          const color = view.catalog.colors[colorIndex];
          return `<span class="town77-back" style="background:${color.hex}">${color.symbol}</span>`;
        }).join("");
        node.innerHTML = `<span class="town77-player-name">${["●", "◆", "▲", "■", "✚"][index]} ${escapeHtml(player.name)}${player.player_id === view.you ? " · you" : ""}</span><span class="town77-backs" aria-label="${player.remaining} tiles">${backs}</span><span class="town77-player-status">${player.retired ? "Retired" : "Building"} · ${player.placed} built${view.solo ? "" : ` · ${player.remaining} left`}</span>`;
        byId("Players").appendChild(node);
      });
    }

    function renderExchanges() {
      byId("ExchangeBox").classList.toggle("hidden", !view.legal_actions.includes("exchange"));
      const groups = byId("ExchangeGroups");
      groups.replaceChildren();
      view.exchange_groups.forEach((group, index) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "town77-exchange-option";
        node.dataset.town77Group = index;
        node.disabled = !can("exchange");
        node.setAttribute("aria-pressed", String(exchangeGroup === index));
        node.setAttribute("aria-label", `Exchange ${group.map(nameTile).join(", ")}`);
        describe(node, "exchange");
        node.innerHTML = group.map(house).join("");
        node.addEventListener("click", () => {
          if (ignoreClick) return;
          exchangeGroup = exchangeGroup === index ? null : index;
          selected = null;
          position = null;
          render();
        });
        groups.appendChild(node);
      });
      byId("ExchangeConfirm").classList.toggle("hidden", exchangeGroup === null);
      byId("Exchange").disabled = !can("exchange") || exchangeGroup === null;
    }

    function renderResults() {
      const finished = ["final_review", "game_over"].includes(view.phase);
      const results = byId("Results");
      results.classList.toggle("hidden", !finished);
      results.replaceChildren();
      if (!finished) return;
      const heading = document.createElement("h3");
      heading.textContent = view.solo ? `Your town · ${view.score} / 49 houses` : `${playerName(view.winner[0])} wins`;
      results.appendChild(heading);
      view.ranking.forEach((playerId, index) => {
        const player = view.players.find((item) => item.player_id === playerId);
        const node = document.createElement("div");
        node.className = "town77-result-row";
        node.tabIndex = 0;
        describe(node, "results");
        node.dataset.town77Tip = "results";
        const order = [...view.players].sort((first, second) => first.finished_at - second.finished_at).findIndex((item) => item.player_id === playerId) + 1;
        node.innerHTML = `<strong>${index + 1}. ${escapeHtml(player.name)}</strong><span>${view.solo ? `${view.score} built · ${49 - view.score} unbuilt` : `${player.remaining} left · ${player.placed} built · retired ${order} of ${view.players.length}`}</span>${player.hand?.length ? `<div class="town77-result-tiles">${player.hand.map(house).join("")}</div>` : ""}`;
        results.appendChild(node);
      });
      const button = document.createElement("button");
      button.type = "button";
      button.className = "town77-primary";
      button.disabled = !can("acknowledge");
      button.textContent = view.results_ready ? "Results confirmed · Play Again in Room Control" : can("acknowledge") ? "Confirm results" : "Waiting for everyone to confirm";
      describe(button, "results");
      button.addEventListener("click", () => send("acknowledge"));
      results.appendChild(button);
    }

    function render() {
      if (!view) return;
      byId("Lobby").classList.add("hidden");
      byId("Table").classList.remove("hidden");
      const reviewing = ["final_review", "game_over"].includes(view.phase);
      byId("Turn").textContent = reviewing ? "A neighborhood, complete." : `${view.current_turn === view.you ? "Your turn" : `${playerName(view.current_turn)}'s turn`} · ${view.phase === "discard" ? "Keep or return a tile" : "Build a house"}`;
      byId("Supply").textContent = view.solo ? `${view.piles.reduce((count, pile) => count + pile.count, 0)} in stacks` : `▧ ${view.bag_count} in bag`;
      byId("Built").textContent = `${view.score} / 49 built`;
      byId("Hint").textContent = pending ? "Sending…" : reviewing ? "Review the final town and confirm the results." : can("discard") ? "Choose a tile to return, or keep them all." : can("pass") ? "No house fits. Exchange if eligible, or retire." : can("place") ? selected !== null ? "Choose a dashed square, then build." : view.solo && !view.score ? "Choose a stack top for the first house." : "Choose a rooftop to see where it fits." : "Your neighbors are building.";
      renderBoard();
      renderRack();
      renderPreview();
      renderExchanges();
      renderPlayers();
      renderResults();
      byId("Log").innerHTML = view.history.slice().reverse().map((entry) => `<li>${escapeHtml(playerName(entry.player_id))} ${entry.type === "place" ? `built ${nameTile(entry.tile)} at ${cellName(entry.x, entry.y)}` : entry.type === "exchange" ? `exchanged ${entry.tiles.map(nameTile).join(", ")}` : entry.type === "discard" ? "returned a secret tile" : entry.type === "pass" ? "retired" : "kept all tiles"}.</li>`).join("");
      explain.refresh();
    }

    byId("HelpBtn").addEventListener("click", () => { explain.exit(); hideTooltip(); help.open(); });
    byId("ExplainBtn").addEventListener("click", () => { hideTooltip(); explain.toggle(); });
    byId("Place").addEventListener("click", () => { if (validPosition()) send("place", { tile: selected, x: position[0], y: position[1] }); });
    byId("Keep").addEventListener("click", () => send("keep"));
    byId("Retire").addEventListener("click", () => send("pass"));
    byId("Discard").addEventListener("click", () => { if (selected !== null) send("discard", { tile: selected }); });
    byId("Exchange").addEventListener("click", () => { if (exchangeGroup !== null) send("exchange", { tiles: view.exchange_groups[exchangeGroup] }); });
    ["Cancel", "DiscardCancel"].forEach((suffix) => byId(suffix).addEventListener("click", () => { clearSelection(); render(); }));
    panel.querySelectorAll("[data-town77-move]").forEach((button) => button.addEventListener("click", () => {
      if (!position || !can("place")) return;
      const [deltaX, deltaY] = button.dataset.town77Move.split(",").map(Number);
      position = [Math.max(0, Math.min(6, position[0] + deltaX)), Math.max(0, Math.min(6, position[1] + deltaY))];
      renderBoard(); renderPreview(); explain.refresh();
    }));
    panel.addEventListener("pointerdown", (event) => {
      gesture = { x: event.clientX, y: event.clientY, id: event.pointerId };
      ignoreClick = false;
    });
    document.addEventListener("pointermove", (event) => {
      if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 9) ignoreClick = true;
    });
    document.addEventListener("pointerup", () => { gesture = null; });
    document.addEventListener("pointercancel", () => { gesture = null; ignoreClick = true; });
    panel.addEventListener("click", (event) => {
      if (ignoreClick) return;
      const tip = event.target.closest("[data-town77-tip]");
      if (tip) { showTooltip(tip); return; }
      if (!event.target.closest("button, summary, details")) { clearSelection(); if (view) render(); }
    });
    panel.addEventListener("pointerover", (event) => { if (event.pointerType === "mouse") showTooltip(event.target.closest("[data-town77-tip]")); });
    panel.addEventListener("pointerout", hideTooltip);
    panel.addEventListener("focusin", (event) => showTooltip(event.target.closest("[data-town77-tip]")));
    window.addEventListener("scroll", hideTooltip, true);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") { clearSelection(); if (view) render(); } });

    function syncRoom(room) {
      if (room?.game_type !== "town77") { explain.exit(); help.close(); hideTooltip(); return; }
      if (room.room_id !== activeRoom || room.status === "lobby") {
        activeRoom = room.room_id;
        view = null;
        pending = false;
        clearTimeout(requestTimer);
        clearSelection();
        byId("Lobby").classList.remove("hidden");
        byId("Table").classList.add("hidden");
      }
    }

    window.renderTown77GameState = (data) => {
      if (data?.game_type !== "town77" || !data.view) return;
      if (typeof currentRoomState !== "undefined" && currentRoomState?.room_id !== data.room_id) return;
      activeRoom = data.room_id;
      clearTimeout(requestTimer);
      view = data.view;
      pending = false;
      clearSelection();
      render();
    };
    window.showTown77HeaderActions = (show) => {
      byId("HeaderActions").style.display = show ? "flex" : "none";
      if (!show) { explain.exit(); help.close(); hideTooltip(); }
    };
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { if (pending) { clearTimeout(requestTimer); pending = false; render(); } });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "town77" && lastGameStatePayload.room_id === activeRoom && currentRoomState?.status !== "lobby") window.renderTown77GameState(lastGameStatePayload);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
