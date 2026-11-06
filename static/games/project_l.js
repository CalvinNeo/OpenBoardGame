(() => {
    const byId = (suffix) => document.getElementById(`projectL${suffix}`);
    const panel = byId("Panel");
    const selectionHome = byId("SelectionHome");
    const marketConfirmation = byId("MarketConfirmation");
    const placementConfirmation = byId("PlacementConfirmation");
    const tooltip = byId("Tooltip");
    const modalNames = ["Upgrade", "Help", "Explain"];
    const state = {
        view: null, market: null, pieceId: null, puzzleId: null, origin: null,
        anchor: null, rotation: 0, flip: false, queue: [], explain: false,
    };
    let gesture = null;
    let suppressClick = false;
    let tooltipTimer = null;
    let tooltipTarget = null;
    let modalReturnFocus = null;
    let marketSelectedAt = 0;

    const explanations = {
        TakeMarketBtn: ["Take a puzzle", "Take this face-up puzzle into your workbench. You can hold at most 4 active puzzles.", "1 AP"],
        DrawWhiteBtn: ["Draw a white puzzle (⚪)", "Take an unknown puzzle from the white deck. White puzzles usually help build your inventory.", "1 AP"],
        DrawBlackBtn: ["Draw a black puzzle (⚫)", "Take an unknown puzzle from the black deck. Emptying this deck triggers the final round.", "1 AP"],
        TakeLevel1Btn: ["Take a level-1 piece", "Add one yellow square to your inventory. This action may be repeated while you have action points.", "1 AP"],
        UpgradeBtn: ["Upgrade a piece (↑)", "Select a piece, then choose a shape one level higher. Level-3 and level-4 pieces can also change to a different shape at the same level.", "1 AP"],
        RotateLeftBtn: ["Rotate left (↶)", "Turn the selected piece 90° counter-clockwise around its center. The preview shows whether it fits.", "Free"],
        RotateRightBtn: ["Rotate right (↷)", "Turn the selected piece 90° clockwise around its center. The preview shows whether it fits.", "Free"],
        FlipBtn: ["Flip (↔)", "Mirror the piece horizontally before applying rotation. Its center stays anchored to the selected position.", "Free"],
        PlaceBtn: ["Place a piece", "Confirm the preview on this puzzle. Green is valid; red means the piece overlaps, lies outside the puzzle, or covers an unavailable cell.", "1 AP"],
        QueueMasterBtn: ["Add to Master plan (✦)", "Reserve this piece and position. A Master plan may contain one placement per puzzle. Remove a planned placement before changing it.", "Free to plan"],
        UseMasterBtn: ["Master Action (✦)", "Execute the planned placements together, using one piece per chosen puzzle. You may use Master Action only once per turn.", "1 AP"],
        FinishingPlaceBtn: ["Finishing placement", "Place a piece during finishing touches. Completed puzzles return used pieces but do not grant a reward piece. Every finishing placement deducts one point.", "−1 point"],
        FinishingDoneBtn: ["Finish", "Finish your placements. Final results appear when every player is done. Unfinished puzzles score no points.", "End finishing touches"],
        CancelMarketBtn: ["Cancel", "Close this preview without taking the puzzle.", "Free"],
        CancelPlacementBtn: ["Cancel", "Cancel this position without spending a piece. You can also click blank space to deselect.", "Free"],
    };
    ["RotateLeftBtn", "RotateRightBtn", "FlipBtn"].forEach((suffix) => {
        explanations[`Placement${suffix}`] = explanations[suffix];
    });

    const helpText = `
        <h3>Build, complete, repeat</h3>
        <p>Fill puzzle spaces to earn their points (★) and reward pieces (+). All pieces used on a completed puzzle return to your inventory, together with its reward.</p>
        <h3>Your turn</h3>
        <p>Start with one level-1 square and one level-2 bar. Each turn gives you 3 action points (⚡ AP). Each action below costs 1 AP; actions may be repeated except Master Action.</p>
        <ul>
            <li><strong>Take a puzzle:</strong> select a market card and confirm Take, or draw an unknown card from a deck. Hold up to 4 active puzzles.</li>
            <li><strong>+ Lv 1:</strong> take one yellow square.</li>
            <li><strong>Upgrade (↑):</strong> select an inventory piece and choose a shape one level higher. Level-3 and level-4 pieces can also change shape within the same level.</li>
            <li><strong>Place:</strong> select a piece, tap a puzzle cell, then confirm next to that puzzle.</li>
            <li><strong>Master Action (✦):</strong> place one piece on each of any number of your puzzles for 1 AP, once per turn.</li>
        </ul>
        <h3>Pieces and previews</h3>
        <p>Lv means level: 1–4 squares. Shape letters identify the outline: I is a bar, V is a corner, O is a square, and T, L and Z match their letters. Color and the drawn shape identify every piece.</p>
        <p>Rotate left (↶), rotate right (↷), or mirror (↔) for free. Rotation keeps the selected piece centered. Light dots mark valid origins; green previews fit, red previews do not. An origin is the top-left of the piece's bounding rectangle, including any empty corner. Tapping blank space or pressing Escape cancels a selection. Scrolling never selects or places a piece.</p>
        <h3>Master plan</h3>
        <p>Choose a valid placement and press + Master plan. Its piece is reserved and its puzzle locked until you remove that entry. Repeat on other puzzles, then press Use Master. The inventory shows available pieces after reservations. Planning costs nothing and is cleared when your turn or your pieces change.</p>
        <h3>Markets and finishing touches</h3>
        <p>White (⚪) puzzles are usually easier; black (⚫) puzzles are harder and worth more points. Emptying the black deck triggers the final round, which continues through the player before the starting player.</p>
        <p>Then everyone may place remaining pieces, losing 1 point per placement. Completed puzzles return used pieces but no longer grant a reward piece. Press Finish when done. Final score is completed puzzle points minus finishing penalties. Ties favor more completed puzzles, then more pieces in inventory.</p>
        <h3>Reading the board</h3>
        <p>Points (★) appear above each puzzle; its reward (+) appears below. The Players section shows public progress and placed pieces. Completed puzzles and player details can be collapsed. Hover or tap non-interactive symbols for a short explanation. Explain highlights controls and lets you inspect them without acting, including disabled controls. Escape closes dialogs or leaves Explain.</p>`;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function setTip(node, text) {
        node.dataset.projectLTip = text;
        node.tabIndex = 0;
        node.classList.toggle("project-l-has-explanation", state.explain);
        return node;
    }

    function setExplanation(node, title, description, cost = "Free") {
        node.dataset.projectLExplain = JSON.stringify([title, description, cost]);
        node.classList.toggle("project-l-has-explanation", state.explain);
        return node;
    }

    function you(view = state.view) {
        return view?.players?.find((player) => player.player_id === view.you);
    }

    function available(action) {
        return !!state.view?.legal_actions?.includes(action);
    }

    function pieceName(pieceId) {
        const definition = state.view?.piece_defs?.[pieceId];
        return definition ? `Lv ${definition.level} · ${pieceId.split("_")[1]}` : pieceId;
    }

    function counts(pieceIds) {
        const result = {};
        (pieceIds || []).forEach((pieceId) => { result[pieceId] = (result[pieceId] || 0) + 1; });
        return result;
    }

    function remaining(pieceId) {
        return (counts(you()?.inventory)[pieceId] || 0) - state.queue.filter((entry) => entry.piece_id === pieceId).length;
    }

    function transform(matrix, rotation = state.rotation, flip = state.flip) {
        let result = matrix.map((row) => flip ? row.slice().reverse() : row.slice());
        for (let turn = 0; turn < rotation / 90; turn += 1) {
            const previous = result;
            result = previous[0].map((unused, column) => previous.map((row) => row[column]).reverse());
        }
        return result;
    }

    function cells(matrix) {
        return matrix.flatMap((row, rowIndex) => row.flatMap((value, column) => value ? [[rowIndex, column]] : []));
    }

    function placedCells(puzzle) {
        const result = new Map();
        (puzzle.placed || []).forEach((placement) => {
            const piece = state.view.piece_defs[placement.piece_id];
            if (!piece) return;
            cells(transform(piece.shape, placement.rotation, placement.flip)).forEach(([row, column]) => {
                result.set(`${row + placement.row},${column + placement.col}`, piece.color);
            });
        });
        return result;
    }

    function validate(puzzleId, pieceId, origin, rotation = state.rotation, flip = state.flip) {
        const puzzle = you()?.active_puzzles?.find((entry) => entry.card_id === puzzleId);
        const definition = state.view?.puzzle_defs?.[puzzleId];
        const piece = state.view?.piece_defs?.[pieceId];
        if (!puzzle || !definition || !piece || !origin) return "Choose a piece and position.";
        const shape = transform(piece.shape, rotation, flip);
        if (origin.row < 0 || origin.col < 0 || origin.row + shape.length > definition.height || origin.col + shape[0].length > definition.width) return "Outside the puzzle. Choose another position.";
        const occupied = placedCells(puzzle);
        for (const [row, column] of cells(shape)) {
            const targetRow = row + origin.row;
            const targetColumn = column + origin.col;
            if (!definition.grid[targetRow]?.[targetColumn]) return "The piece must fit inside the puzzle spaces.";
            if (occupied.has(`${targetRow},${targetColumn}`)) return "This position overlaps a placed piece.";
        }
        return "";
    }

    function selection() {
        if (!state.pieceId || !state.origin || state.puzzleId === null) return null;
        const puzzleIndex = you()?.active_puzzles?.findIndex((entry) => entry.card_id === state.puzzleId);
        if (!(puzzleIndex >= 0)) return null;
        return {
            puzzle_index: puzzleIndex, piece_id: state.pieceId, row: state.origin.row,
            col: state.origin.col, rotation: state.rotation, flip: state.flip,
        };
    }

    function validSelection() {
        return !!selection() && remaining(state.pieceId) > 0
            && !state.queue.some((entry) => entry.cardId === state.puzzleId)
            && !validate(state.puzzleId, state.pieceId, state.origin);
    }

    function clearPosition() {
        state.puzzleId = null;
        state.origin = null;
        state.anchor = null;
    }

    function clearSelection() {
        state.market = null;
        state.pieceId = null;
        state.rotation = 0;
        state.flip = false;
        clearPosition();
        render();
    }

    function centroid(shape) {
        const occupied = cells(shape);
        return {
            row: occupied.reduce((total, [row]) => total + row, 0) / occupied.length,
            col: occupied.reduce((total, [, column]) => total + column, 0) / occupied.length,
        };
    }

    function selectOrigin(puzzleId, row, column) {
        state.market = null;
        state.puzzleId = puzzleId;
        state.origin = { row, col: column };
        const piece = state.view.piece_defs[state.pieceId];
        const center = piece ? centroid(transform(piece.shape)) : { row: 0, col: 0 };
        state.anchor = { row: row + center.row, col: column + center.col };
        render();
    }

    function changeOrientation(rotation, flip) {
        if (!state.pieceId) return;
        state.rotation = (rotation + 360) % 360;
        state.flip = flip;
        if (state.anchor) {
            const center = centroid(transform(state.view.piece_defs[state.pieceId].shape));
            state.origin = { row: Math.round(state.anchor.row - center.row), col: Math.round(state.anchor.col - center.col) };
        }
        render();
    }

    function shapeGrid(shape, color, size, className = "project-l-piece-grid") {
        const grid = element("span", className);
        grid.style.gridTemplateColumns = `repeat(${shape[0].length}, ${size}px)`;
        grid.style.gridAutoRows = `${size}px`;
        grid.style.setProperty("--piece-color", color);
        grid.setAttribute("aria-hidden", "true");
        shape.forEach((row) => row.forEach((value) => grid.appendChild(element("span", value ? "project-l-piece-cell" : ""))));
        return grid;
    }

    function reward(definition, interactive = false) {
        const piece = state.view.piece_defs[definition.reward_piece_id];
        const row = element("div", "project-l-reward-row");
        if (!interactive && state.view.phase === "finishing") {
            row.textContent = "No reward";
            return setTip(row, "Finishing touches: completed puzzles return their used pieces, but do not grant a reward piece.");
        }
        row.append(element("span", "", "+"), shapeGrid(piece.shape, piece.color, 7));
        if (!interactive) setTip(row, `Reward (+): ${pieceName(definition.reward_piece_id)}. You also recover all pieces used on this puzzle.`);
        return row;
    }

    function miniGrid(definition, occupied = new Map(), size = 8) {
        const grid = element("div", "project-l-mini-grid");
        grid.style.gridTemplateColumns = `repeat(${definition.width}, ${size}px)`;
        grid.style.gridAutoRows = `${size}px`;
        grid.setAttribute("aria-hidden", "true");
        definition.grid.forEach((row, rowIndex) => row.forEach((value, column) => {
            const square = element("span", `project-l-mini-cell${value ? "" : " off"}`);
            if (occupied.has(`${rowIndex},${column}`)) square.style.background = occupied.get(`${rowIndex},${column}`);
            grid.appendChild(square);
        }));
        return grid;
    }

    function renderMarket() {
        selectionHome.appendChild(marketConfirmation);
        ["white", "black"].forEach((deck) => {
            const container = byId(deck === "white" ? "MarketWhite" : "MarketBlack");
            container.replaceChildren();
            (state.view.market?.[deck] || []).forEach((cardId, index) => {
                const definition = state.view.puzzle_defs[cardId];
                const card = element("div", "project-l-card");
                const face = element("button", "project-l-card-face");
                face.type = "button";
                face.dataset.projectLKey = `market-${deck}-${index}`;
                if (!definition) {
                    face.disabled = true;
                    face.textContent = "Empty";
                } else {
                    const header = element("span", "project-l-card-header");
                    header.append(element("span", "", `#${cardId}`), element("span", "", `★ ${definition.points}`));
                    const diagram = element("span", "project-l-mini-wrap");
                    diagram.appendChild(miniGrid(definition));
                    face.append(header, diagram, reward(definition, true));
                    face.disabled = !available("take_puzzle");
                    face.setAttribute("aria-label", `${deck} puzzle #${cardId}, ${definition.points} points, reward ${pieceName(definition.reward_piece_id)}`);
                    face.setAttribute("aria-pressed", String(state.market?.deck === deck && state.market.index === index));
                    setExplanation(face, `Puzzle #${cardId}`, `${definition.points} points (★). Reward (+): ${pieceName(definition.reward_piece_id)}. Select this card, then confirm Take.`, "1 AP to take");
                    face.addEventListener("click", () => {
                        if (!available("take_puzzle")) return;
                        clearPosition();
                        state.market = { deck, index, cardId };
                        marketSelectedAt = performance.now();
                        render();
                    });
                }
                card.appendChild(face);
                container.appendChild(card);
                if (state.market?.deck === deck && state.market.index === index) {
                    byId("SelectedMarket").textContent = `Puzzle #${cardId}`;
                    card.appendChild(marketConfirmation);
                }
            });
        });
    }

    function renderInventory() {
        const container = byId("Inventory");
        container.replaceChildren();
        const inventory = counts(you()?.inventory);
        const pieceIds = Object.keys(inventory).sort((first, second) => state.view.piece_defs[first].level - state.view.piece_defs[second].level || first.localeCompare(second));
        pieceIds.forEach((pieceId) => {
            const definition = state.view.piece_defs[pieceId];
            const button = element("button", `project-l-piece${state.pieceId === pieceId ? " selected" : ""}`);
            button.type = "button";
            button.dataset.projectLKey = `piece-${pieceId}`;
            button.dataset.pieceId = pieceId;
            button.disabled = remaining(pieceId) <= 0 || state.view.game_over;
            button.setAttribute("aria-pressed", String(state.pieceId === pieceId));
            button.setAttribute("aria-label", `${pieceName(pieceId)}, ${remaining(pieceId)} available, ${inventory[pieceId] - remaining(pieceId)} planned`);
            button.append(shapeGrid(definition.shape, definition.color, 10), element("span", "project-l-piece-count", `×${remaining(pieceId)}`), element("span", "project-l-piece-label", pieceName(pieceId)));
            setExplanation(button, pieceName(pieceId), `${definition.level} squares. ${remaining(pieceId)} available; ${inventory[pieceId] - remaining(pieceId)} reserved for Master Action. Select it to place or upgrade.`, "Free to select");
            button.addEventListener("click", () => {
                state.pieceId = state.pieceId === pieceId ? null : pieceId;
                state.market = null;
                state.rotation = 0;
                state.flip = false;
                clearPosition();
                render();
            });
            container.appendChild(button);
        });
        if (!pieceIds.length) container.appendChild(element("div", "project-l-empty", you() ? "No available pieces. Take a level-1 piece." : "Spectating · follow the players below."));
        const preview = byId("SelectedPiecePreview");
        preview.replaceChildren();
        if (state.pieceId) {
            const definition = state.view.piece_defs[state.pieceId];
            preview.appendChild(shapeGrid(transform(definition.shape), definition.color, 9));
        }
        byId("SelectedPiece").textContent = state.pieceId ? `${pieceName(state.pieceId)} · ${state.rotation}°${state.flip ? " · mirrored" : ""}` : "Choose a piece";
        setTip(byId("SelectedPiece"), state.pieceId ? `Selected ${pieceName(state.pieceId)}: ${state.view.piece_defs[state.pieceId].level} squares, rotated ${state.rotation} degrees${state.flip ? " and mirrored" : ""}. The preview shows its current orientation.` : "Select an inventory piece to preview, rotate, flip, place or upgrade it.");
    }

    function renderPuzzleGrid(puzzle, definition, queued) {
        const grid = element("div", "project-l-puzzle-grid");
        grid.style.setProperty("--project-l-columns", definition.width);
        grid.style.setProperty("--project-l-rows", definition.height);
        grid.setAttribute("role", "group");
        grid.setAttribute("aria-label", `Puzzle #${definition.id}`);
        const occupied = placedCells(puzzle);
        const selected = state.puzzleId === puzzle.card_id && state.origin && state.pieceId;
        const draft = queued || (selected ? selection() : null);
        const ghost = new Set();
        const invalid = selected && !!validate(puzzle.card_id, state.pieceId, state.origin);
        if (draft) {
            const definition = state.view.piece_defs[draft.piece_id];
            grid.style.setProperty("--project-l-preview-color", definition.color);
            cells(transform(definition.shape, draft.rotation, draft.flip)).forEach(([row, column]) => ghost.add(`${row + draft.row},${column + draft.col}`));
        }
        definition.grid.forEach((row, rowIndex) => row.forEach((value, column) => {
            const key = `${rowIndex},${column}`;
            const validOrigin = state.pieceId && !queued && remaining(state.pieceId) > 0
                && !validate(puzzle.card_id, state.pieceId, { row: rowIndex, col: column });
            if (!value && !ghost.has(key) && !validOrigin) return;
            const selectable = value || validOrigin;
            const square = element(selectable ? "button" : "span", "project-l-cell");
            if (!value && validOrigin) square.classList.add("off-origin");
            square.style.setProperty("--row", rowIndex);
            square.style.setProperty("--col", column);
            if (occupied.has(key)) square.style.backgroundColor = occupied.get(key);
            if (ghost.has(key)) square.classList.add("ghost");
            if (ghost.has(key) && invalid) square.classList.add("invalid");
            if (selectable) {
                square.type = "button";
                square.disabled = !!queued || state.view.game_over;
                square.dataset.projectLKey = `cell-${definition.id}-${rowIndex}-${column}`;
                square.dataset.row = rowIndex;
                square.dataset.column = column;
                square.setAttribute("aria-label", `Puzzle #${definition.id}, row ${rowIndex + 1}, column ${column + 1}${occupied.has(key) ? ", occupied" : ""}`);
                square.setAttribute("aria-pressed", String(selected && state.origin.row === rowIndex && state.origin.col === column));
                if (validOrigin) square.classList.add("valid-origin");
                setExplanation(square, `Puzzle #${definition.id}`, queued ? "This puzzle already has a Master placement planned. Remove that entry to edit it." : "Choose the top-left origin of a piece here. Light dots indicate valid positions. Confirm a green preview to place it; red previews cannot be placed.");
                square.addEventListener("click", () => selectOrigin(puzzle.card_id, rowIndex, column));
            }
            grid.appendChild(square);
        }));
        return grid;
    }

    function renderPuzzles() {
        selectionHome.appendChild(placementConfirmation);
        const container = byId("ActivePuzzles");
        container.replaceChildren();
        const puzzles = you()?.active_puzzles || [];
        byId("PuzzleCount").textContent = `${puzzles.length} / 4`;
        puzzles.forEach((puzzle) => {
            const definition = state.view.puzzle_defs[puzzle.card_id];
            const queued = state.queue.find((entry) => entry.cardId === puzzle.card_id);
            const card = element("div", `project-l-puzzle-card${state.puzzleId === puzzle.card_id ? " selected" : ""}${queued ? " queued" : ""}`);
            card.dataset.cardId = puzzle.card_id;
            const header = element("div", "project-l-card-header");
            header.append(element("span", "", `#${definition.id}`), setTip(element("span", "", `★ ${definition.points}`), `Points (★): earn ${definition.points} when this puzzle is complete.`));
            card.append(header, renderPuzzleGrid(puzzle, definition, queued), reward(definition));
            if (queued) card.appendChild(setTip(element("span", "project-l-muted", "✦ Planned · remove to edit"), "This puzzle has a Master placement reserved. Remove its entry in Master plan to edit it."));
            container.appendChild(card);
            if (state.puzzleId === puzzle.card_id && state.origin && !queued) card.appendChild(placementConfirmation);
        });
        if (!puzzles.length) container.appendChild(element("div", "project-l-empty", you() ? "Take a puzzle from the market to get started." : "Player boards are shown below."));
    }

    function renderQueue() {
        byId("MasterSection").classList.toggle("hidden", !state.queue.length);
        const container = byId("MasterQueue");
        const scrollTop = container.scrollTop;
        container.replaceChildren();
        state.queue.forEach((entry) => {
            const row = element("div", "project-l-queue-item");
            row.appendChild(element("span", "", `#${entry.cardId} · ${pieceName(entry.piece_id)} · ${entry.rotation}°${entry.flip ? " mirrored" : ""}`));
            const remove = element("button", "project-l-queue-remove", "Remove");
            remove.type = "button";
            remove.dataset.projectLKey = `remove-${entry.cardId}`;
            remove.setAttribute("aria-label", `Remove planned placement on puzzle #${entry.cardId}`);
            setExplanation(remove, "Remove planned placement", "Release this piece and unlock its puzzle without spending an action point.");
            remove.addEventListener("click", () => {
                state.queue = state.queue.filter((placement) => placement !== entry);
                render();
            });
            row.appendChild(remove);
            container.appendChild(row);
        });
        container.scrollTop = scrollTop;
    }

    function renderPlayers() {
        const container = byId("Players");
        const scrollTop = container.scrollTop;
        container.replaceChildren();
        byId("PlayerCount").textContent = `(${state.view.players.length})`;
        state.view.players.forEach((player) => {
            const card = element("div", `project-l-player${player.player_id === state.view.current_turn ? " current" : ""}`);
            const header = element("div", "project-l-player-heading");
            const score = state.view.game_over ? state.view.scores?.[player.player_id] ?? player.score - player.finishing_placed : player.score;
            header.append(element("strong", "", `${player.name || player.player_id}${player.player_id === state.view.you ? " · You" : ""}${player.is_bot ? " · Bot" : ""}`), setTip(element("span", "", `★ ${score}`), state.view.game_over ? "Final score after finishing penalties." : "Points earned from completed puzzles, before finishing penalties."));
            const stats = element("div", "project-l-muted", `${player.completed_puzzles.length} completed · ${player.inventory.length} pieces${state.view.phase !== "main" ? ` · −${player.finishing_placed} penalty${player.finishing_done ? " · Finished" : ""}` : ""}`);
            card.append(header, stats);
            if (player.player_id !== state.view.you) {
                const puzzles = element("div", "project-l-opponent-puzzles");
                player.active_puzzles.forEach((puzzle) => {
                    const definition = state.view.puzzle_defs[puzzle.card_id];
                    const occupied = placedCells(puzzle);
                    const preview = element("div", "project-l-opponent-puzzle");
                    preview.append(miniGrid(definition, occupied, 8), element("span", "", `#${puzzle.card_id} · ${occupied.size}/${cells(definition.grid).length}`));
                    setTip(preview, `Puzzle #${puzzle.card_id}: ${definition.points} points; ${occupied.size} of ${cells(definition.grid).length} spaces filled. Reward: ${pieceName(definition.reward_piece_id)}.`);
                    puzzles.appendChild(preview);
                });
                card.appendChild(puzzles);
            }
            container.appendChild(card);
        });
        container.scrollTop = scrollTop;
        const completed = you()?.completed_puzzles || [];
        byId("CompletedCount").textContent = completed.length;
        const completedContainer = byId("CompletedPuzzles");
        const completedScroll = completedContainer.scrollTop;
        completedContainer.replaceChildren();
        completed.forEach((cardId) => {
            const definition = state.view.puzzle_defs[cardId];
            completedContainer.appendChild(setTip(element("span", "project-l-completed-chip", `#${cardId} · ★ ${definition.points}`), `Completed puzzle #${cardId}, worth ${definition.points} points.`));
        });
        if (!completed.length) completedContainer.textContent = "No completed puzzles yet.";
        completedContainer.scrollTop = completedScroll;
    }

    function enable(suffix, enabled) {
        const button = byId(suffix);
        button.disabled = !enabled;
        button.classList.toggle("action-allowed", !!enabled);
    }

    function updateControls() {
        const valid = validSelection();
        enable("CancelMarketBtn", true);
        enable("CancelPlacementBtn", true);
        enable("TakeMarketBtn", available("take_puzzle") && !!state.market);
        enable("DrawWhiteBtn", available("take_puzzle") && state.view.white_remaining > 0);
        enable("DrawBlackBtn", available("take_puzzle") && state.view.black_remaining > 0);
        enable("TakeLevel1Btn", available("take_level1"));
        enable("UpgradeBtn", available("upgrade_piece") && !!state.pieceId && remaining(state.pieceId) > 0);
        ["RotateLeftBtn", "RotateRightBtn", "FlipBtn", "PlacementRotateLeftBtn", "PlacementRotateRightBtn", "PlacementFlipBtn"].forEach((suffix) => enable(suffix, !!state.pieceId && !state.view.game_over));
        byId("FlipBtn").setAttribute("aria-pressed", String(state.flip));
        byId("PlacementFlipBtn").setAttribute("aria-pressed", String(state.flip));
        enable("PlaceBtn", available("place_piece") && valid);
        enable("QueueMasterBtn", available("master_action") && valid);
        enable("FinishingPlaceBtn", available("finishing_place") && valid);
        enable("FinishingDoneBtn", available("finishing_done"));
        const validQueue = state.queue.length > 0 && state.queue.every((entry) => remaining(entry.piece_id) >= 0 && !validate(entry.cardId, entry.piece_id, { row: entry.row, col: entry.col }, entry.rotation, entry.flip));
        enable("UseMasterBtn", available("master_action") && validQueue);
        const finishing = state.view.phase === "finishing";
        byId("PlaceBtn").classList.toggle("hidden", finishing);
        byId("QueueMasterBtn").classList.toggle("hidden", finishing);
        byId("FinishingPlaceBtn").classList.toggle("hidden", !finishing);
        byId("FinishingActions").classList.toggle("hidden", !finishing || !you());
        const message = !state.pieceId ? "Choose an inventory piece." : remaining(state.pieceId) <= 0 ? "This piece is reserved for Master Action." : validate(state.puzzleId, state.pieceId, state.origin);
        byId("PlacementHint").textContent = message || "Fits · confirm this placement";
        byId("PlacementHint").classList.toggle("invalid", !!state.pieceId && !!message);
        document.body.classList.toggle("project-l-turn-active", currentGameType === "project_l" && !!you() && !!state.view.legal_actions?.length);
    }

    function render() {
        if (!state.view) return;
        const active = document.activeElement;
        const focusKey = active?.dataset?.projectLKey;
        const scrollPosition = { left: scrollX, top: scrollY };
        hideTooltip();
        const currentPlayer = state.view.players.find((player) => player.player_id === state.view.current_turn);
        const finishing = state.view.phase === "finishing";
        byId("Turn").textContent = state.view.game_over ? "Game complete" : finishing ? (you()?.finishing_done ? "Finished · waiting for other players" : you() ? "Your finishing touches" : "Players are finishing") : state.view.current_turn === state.view.you ? "Your turn · build something great" : `${currentPlayer?.name || "Another player"}'s turn`;
        byId("Phase").textContent = state.view.game_over ? "Results" : finishing ? "Finishing" : "Main";
        byId("Ap").textContent = state.view.phase === "main" ? state.view.ap_remaining : "–";
        byId("MasterUsed").textContent = state.view.master_used ? "Used" : "Ready";
        byId("WhiteRemaining").textContent = state.view.white_remaining;
        byId("BlackRemaining").textContent = state.view.black_remaining;
        byId("EndTriggered").classList.toggle("hidden", !state.view.end_triggered || state.view.phase !== "main");
        byId("Winner").classList.toggle("hidden", !state.view.game_over);
        byId("Winner").textContent = state.view.game_over ? `Winner: ${(state.view.winner || []).map((playerId) => state.view.players.find((player) => player.player_id === playerId)?.name || playerId).join(", ") || "No winner"}` : "";
        renderInventory();
        renderPuzzles();
        renderMarket();
        renderQueue();
        renderPlayers();
        updateControls();
        if (state.explain) setExplain(true);
        if (focusKey) panel.querySelector(`[data-project-l-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
        else if (active?.isConnected && !active.closest(".hidden")) active.focus({ preventScroll: true });
        window.scrollTo(scrollPosition);
    }

    function renderState(data) {
        if (!data?.view) return;
        const before = state.view;
        const previousPlayer = you(before);
        const next = data.view;
        const nextPlayer = you(next);
        const draftKey = (view, player) => JSON.stringify([view?.you, view?.phase, view?.current_turn, view?.ap_remaining, view?.master_used, player?.inventory, player?.active_puzzles, player?.finishing_done]);
        if (draftKey(before, previousPlayer) !== draftKey(next, nextPlayer)) {
            state.queue = [];
            clearPosition();
            closeModal("Upgrade");
        }
        state.view = next;
        if (!nextPlayer?.inventory.includes(state.pieceId)) state.pieceId = null;
        if (state.market && (next.market?.[state.market.deck]?.[state.market.index] !== state.market.cardId || !available("take_puzzle"))) state.market = null;
        if (currentGameType !== "project_l") {
            currentGameType = "project_l";
            setGamePanelVisibility("project_l");
        }
        render();
        logGameEvents(data);
    }

    function clearState() {
        modalNames.forEach((name) => closeModal(name));
        setExplain(false);
        hideTooltip();
        state.view = null;
        state.market = null;
        state.pieceId = null;
        state.rotation = 0;
        state.flip = false;
        state.queue = [];
        clearPosition();
        selectionHome.append(marketConfirmation, placementConfirmation);
        ["Inventory", "ActivePuzzles", "MarketWhite", "MarketBlack", "MasterQueue", "Players", "CompletedPuzzles", "SelectedPiecePreview"].forEach((suffix) => byId(suffix).replaceChildren());
        ["MasterSection", "FinishingActions", "Winner", "EndTriggered"].forEach((suffix) => byId(suffix).classList.add("hidden"));
        panel.querySelectorAll("button").forEach((button) => { button.disabled = true; });
        byId("Turn").textContent = "Waiting for players";
        document.body.classList.remove("project-l-turn-active");
    }

    function send(type, payload = {}) {
        if (!available(type)) return false;
        hideTooltip();
        sendAction({ type, ...payload });
        return true;
    }

    byId("TakeMarketBtn").addEventListener("click", (event) => {
        if (!state.market || event.detail > 1 || performance.now() - marketSelectedAt < 300) return;
        const { deck, index } = state.market;
        if (send("take_puzzle", { source: "market", deck, index })) {
            state.market = null;
            render();
        }
    });
    byId("CancelMarketBtn").addEventListener("click", () => { state.market = null; render(); });
    byId("CancelPlacementBtn").addEventListener("click", () => { clearPosition(); render(); });
    byId("DrawWhiteBtn").addEventListener("click", () => { if (state.view?.white_remaining) send("take_puzzle", { source: "deck", deck: "white" }); });
    byId("DrawBlackBtn").addEventListener("click", () => { if (state.view?.black_remaining) send("take_puzzle", { source: "deck", deck: "black" }); });
    byId("TakeLevel1Btn").addEventListener("click", () => send("take_level1"));
    ["", "Placement"].forEach((prefix) => {
        byId(`${prefix}RotateLeftBtn`).addEventListener("click", () => changeOrientation(state.rotation - 90, state.flip));
        byId(`${prefix}RotateRightBtn`).addEventListener("click", () => changeOrientation(state.rotation + 90, state.flip));
        byId(`${prefix}FlipBtn`).addEventListener("click", () => changeOrientation(state.rotation, !state.flip));
    });
    ["PlaceBtn", "FinishingPlaceBtn"].forEach((suffix) => byId(suffix).addEventListener("click", () => {
        if (!validSelection()) return;
        if (send(suffix === "PlaceBtn" ? "place_piece" : "finishing_place", selection())) {
            clearPosition();
            render();
        }
    }));
    byId("QueueMasterBtn").addEventListener("click", () => {
        if (!available("master_action") || !validSelection()) return;
        state.queue.push({ ...selection(), cardId: state.puzzleId });
        clearPosition();
        if (remaining(state.pieceId) <= 0) state.pieceId = null;
        render();
    });
    byId("UseMasterBtn").addEventListener("click", () => {
        updateControls();
        if (byId("UseMasterBtn").disabled) return;
        const placements = state.queue.map(({ cardId, ...entry }) => ({ ...entry, puzzle_index: you().active_puzzles.findIndex((puzzle) => puzzle.card_id === cardId) }));
        if (send("master_action", { placements })) {
            state.queue = [];
            clearPosition();
            render();
        }
    });
    byId("FinishingDoneBtn").addEventListener("click", () => send("finishing_done"));

    function openModal(name, returnFocus = document.activeElement) {
        hideTooltip();
        modalNames.forEach((other) => setModalVisible(byId(`${other}Modal`), false));
        modalReturnFocus = returnFocus;
        setModalVisible(byId(`${name}Modal`), true);
        byId(`${name}ModalCloseBtn`).focus({ preventScroll: true });
    }

    function closeModal(name) {
        const modal = byId(`${name}Modal`);
        if (modal.classList.contains("hidden")) return;
        setModalVisible(modal, false);
        if (modalReturnFocus?.isConnected && !modalReturnFocus.disabled) modalReturnFocus.focus({ preventScroll: true });
        modalReturnFocus = null;
    }

    modalNames.forEach((name) => {
        byId(`${name}ModalCloseBtn`).addEventListener("click", () => closeModal(name));
        byId(`${name}Modal`).addEventListener("click", (event) => { if (event.target === byId(`${name}Modal`)) closeModal(name); });
    });
    byId("UpgradeBtn").addEventListener("click", () => {
        if (!available("upgrade_piece") || !state.pieceId || remaining(state.pieceId) <= 0) return;
        const fromPiece = state.pieceId;
        const fromLevel = state.view.piece_defs[fromPiece].level;
        byId("UpgradeFromLabel").textContent = `From ${pieceName(fromPiece)} · choose a new shape`;
        const container = byId("UpgradeOptions");
        container.replaceChildren();
        Object.entries(state.view.piece_defs).forEach(([pieceId, definition]) => {
            if (pieceId === fromPiece || !(definition.level === fromLevel + 1 || fromLevel >= 3 && definition.level === fromLevel)) return;
            const button = element("button", "project-l-upgrade-piece");
            button.type = "button";
            button.dataset.pieceId = pieceId;
            button.append(shapeGrid(definition.shape, definition.color, 14), element("span", "", pieceName(pieceId)));
            setExplanation(button, `Upgrade to ${pieceName(pieceId)}`, `Return ${pieceName(fromPiece)} and take this piece.`, "1 AP");
            button.addEventListener("click", () => {
                if (remaining(fromPiece) > 0 && send("upgrade_piece", { from_piece_id: fromPiece, to_piece_id: pieceId })) {
                    closeModal("Upgrade");
                    state.pieceId = null;
                    clearPosition();
                    render();
                }
            });
            container.appendChild(button);
        });
        openModal("Upgrade");
    });
    byId("HelpBtn").addEventListener("click", () => {
        setExplain(false);
        byId("HelpModal").querySelector(".project-l-help-content").innerHTML = helpText;
        openModal("Help", byId("HelpBtn"));
    });

    function setExplain(enabled) {
        state.explain = enabled;
        hideTooltip();
        document.body.classList.toggle("project-l-explain-mode", enabled);
        byId("ExplainBtn").classList.toggle("active", enabled);
        byId("ExplainBtn").setAttribute("aria-pressed", String(enabled));
        document.querySelectorAll("[data-project-l-explain], #projectLPanel [data-project-l-tip]").forEach((node) => node.classList.toggle("project-l-has-explanation", enabled));
    }

    Object.entries(explanations).forEach(([suffix, explanation]) => setExplanation(byId(suffix), ...explanation));
    byId("ExplainBtn").addEventListener("click", () => setExplain(!state.explain));

    function explainTarget(target) {
        return target?.closest?.("[data-project-l-explain], #projectLPanel [data-project-l-tip]");
    }

    function explainExempt(target) {
        const button = target?.closest?.("button");
        return [byId("HelpBtn"), byId("ExplainBtn"), ...modalNames.map((name) => byId(`${name}ModalCloseBtn`))].includes(button);
    }

    function showExplanation(target) {
        const explanation = target.dataset.projectLExplain ? JSON.parse(target.dataset.projectLExplain) : ["Board information", target.dataset.projectLTip, ""];
        const content = byId("ExplainContent");
        content.replaceChildren(element("h4", "", explanation[0]), element("p", "", explanation[1]));
        if (explanation[2]) content.appendChild(element("span", "explain-cost", explanation[2]));
        setExplain(false);
        openModal("Explain", byId("ExplainBtn"));
    }

    function inScope(target) {
        return target instanceof Element && !!target.closest("#projectLPanel, .project-l-modal");
    }

    document.addEventListener("pointerdown", (event) => {
        suppressClick = false;
        if (!inScope(event.target) && !state.explain) { gesture = null; return; }
        gesture = { pointerId: event.pointerId, target: event.target, left: event.clientX, top: event.clientY, moved: false };
    }, true);
    document.addEventListener("pointermove", (event) => {
        if (gesture?.pointerId === event.pointerId && Math.hypot(event.clientX - gesture.left, event.clientY - gesture.top) > 10) gesture.moved = true;
    }, true);
    document.addEventListener("pointercancel", () => {
        if (gesture) suppressClick = true;
        gesture = null;
    }, true);
    document.addEventListener("pointerup", (event) => {
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        const previous = gesture;
        gesture = null;
        if (previous.moved) { suppressClick = true; return; }
        if (!state.explain || explainExempt(event.target)) return;
        const target = explainTarget(document.elementFromPoint(event.clientX, event.clientY));
        if (target && target === explainTarget(previous.target)) {
            suppressClick = true;
            event.preventDefault();
            event.stopImmediatePropagation();
            showExplanation(target);
        }
    }, true);
    document.addEventListener("click", (event) => {
        if (suppressClick && event.detail !== 0 && (inScope(event.target) || state.explain)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (!state.explain || explainExempt(event.target)) return;
        const target = explainTarget(event.target);
        if (target || event.target.closest("button, input, select, textarea, summary")) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (target) showExplanation(target);
        }
    }, true);

    function hideTooltip() {
        clearTimeout(tooltipTimer);
        tooltip.classList.add("hidden");
        tooltipTarget?.removeAttribute("aria-describedby");
        tooltipTarget = null;
    }

    function showTooltip(target) {
        if (state.explain || target.closest("button, a, input, select, summary")) return;
        hideTooltip();
        tooltipTarget = target;
        tooltip.textContent = target.dataset.projectLTip;
        tooltip.classList.remove("hidden");
        target.setAttribute("aria-describedby", tooltip.id);
        const anchor = target.getBoundingClientRect();
        const box = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - box.width - 12))}px`;
        tooltip.style.top = `${anchor.bottom + box.height + 8 < innerHeight ? anchor.bottom + 5 : Math.max(12, anchor.top - box.height - 5)}px`;
        tooltipTimer = setTimeout(hideTooltip, 3000);
    }

    panel.addEventListener("pointerover", (event) => {
        const target = event.target.closest("[data-project-l-tip]");
        if (target && event.pointerType === "mouse") showTooltip(target);
    });
    panel.addEventListener("pointerout", (event) => {
        if (tooltipTarget && !tooltipTarget.contains(event.relatedTarget)) hideTooltip();
    });
    panel.addEventListener("focusin", (event) => {
        if (event.target.matches("[data-project-l-tip]")) showTooltip(event.target);
    });
    panel.addEventListener("focusout", hideTooltip);
    panel.addEventListener("click", (event) => {
        if (state.explain) return;
        const target = event.target.closest("[data-project-l-tip]");
        if (target && !target.closest("button")) { showTooltip(target); return; }
        hideTooltip();
        if (event.target.closest("button, summary, input, select, .project-l-puzzle-card, .project-l-card, .project-l-placement-confirmation")) return;
        clearSelection();
    });
    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);
    window.addEventListener("blur", () => { gesture = null; suppressClick = true; hideTooltip(); });
    document.addEventListener("keydown", (event) => {
        if (currentGameType !== "project_l") return;
        const openName = modalNames.find((name) => !byId(`${name}Modal`).classList.contains("hidden"));
        if (event.key === "Escape") {
            if (openName) closeModal(openName);
            else if (state.explain) setExplain(false);
            else clearSelection();
            hideTooltip();
            event.preventDefault();
        }
        if (event.key === "Tab" && openName) {
            const focusable = [...byId(`${openName}Modal`).querySelectorAll("button:not(:disabled), [tabindex='0']")].filter((node) => node.getClientRects().length);
            const first = focusable[0];
            const last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });

    window.renderProjectLGameState = renderState;
    window.clearProjectLState = clearState;
    window.showProjectLHeaderActions = (show) => {
        byId("HeaderActions").style.display = show ? "flex" : "none";
        if (!show) {
            setExplain(false);
            modalNames.forEach(closeModal);
            document.body.classList.remove("project-l-turn-active");
        } else if (state.view) updateControls();
    };
    if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "project_l"
            && typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "project_l"
            && lastGameStatePayload.room_id === currentRoomState.room_id) renderState(lastGameStatePayload);
})();
