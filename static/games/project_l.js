(() => {
    const byId = (suffix) => document.getElementById(`projectL${suffix}`);
    const panel = byId("Panel");
    const selectionHome = byId("SelectionHome");
    const marketConfirmation = byId("MarketConfirmation");
    const placementConfirmation = byId("PlacementConfirmation");
    const tooltip = byId("Tooltip");
    const modalNames = ["Upgrade"];
    const state = {
        view: null, market: null, pieceId: null, puzzleId: null, origin: null,
        anchor: null, rotation: 0, flip: false, queue: [],
    };
    let gesture = null;
    let suppressClick = false;
    let tooltipTimer = null;
    let tooltipTarget = null;
    let modalReturnFocus = null;
    let marketSelectedAt = 0;

    const PROJECT_L_EXPLAIN = {
        take_market: {
            zh: "拿走一张拼图(1 AP)：把这张面朝上的拼图收进你的工作台。你最多同时持有四张进行中的拼图。",
            en: "Take a puzzle (1 AP): move this face-up puzzle into your workbench. You can hold at most 4 active puzzles."
        },
        draw_white: {
            zh: "抽一张白拼图(⚪)(1 AP)：从白色牌库抽一张未知拼图。白拼图通常帮你积累零件。",
            en: "Draw a white puzzle (⚪) (1 AP): take an unknown puzzle from the white deck. White puzzles usually help build your inventory."
        },
        draw_black: {
            zh: "抽一张黑拼图(⚫)(1 AP)：从黑色牌库抽一张未知拼图。黑色牌库抽空会触发最后一轮。",
            en: "Draw a black puzzle (⚫) (1 AP): take an unknown puzzle from the black deck. Emptying this deck triggers the final round."
        },
        take_level1: {
            zh: "拿一块一级零件(1 AP)：往库存里加一个黄色方块。只要还有行动点，这个动作可以重复。",
            en: "Take a level-1 piece (1 AP): add one yellow square to your inventory. This action may be repeated while you have action points."
        },
        upgrade: {
            zh: "升级零件(↑)(1 AP)：先选中一块零件，再选一个高一级的形状。三级和四级零件还可以在同级内换成别的形状。",
            en: "Upgrade a piece (↑) (1 AP): select a piece, then choose a shape one level higher. Level-3 and level-4 pieces can also change to a different shape at the same level."
        },
        rotate_left: {
            zh: "向左旋转(↶)(免费)：把选中的零件绕中心逆时针转 90 度。预览会告诉你它是否放得下。",
            en: "Rotate left (↶) (Free): turn the selected piece 90° counter-clockwise around its center. The preview shows whether it fits."
        },
        rotate_right: {
            zh: "向右旋转(↷)(免费)：把选中的零件绕中心顺时针转 90 度。预览会告诉你它是否放得下。",
            en: "Rotate right (↷) (Free): turn the selected piece 90° clockwise around its center. The preview shows whether it fits."
        },
        flip: {
            zh: "镜像翻转(↔)(免费)：在旋转之前先水平镜像这块零件，它的中心仍然锚定在选中的位置上。",
            en: "Flip (↔) (Free): mirror the piece horizontally before applying rotation. Its center stays anchored to the selected position."
        },
        placement_rotate_left: {
            zh: "向左旋转(↶)(免费)：把预览中的零件绕中心逆时针转 90 度，再确认放置。",
            en: "Rotate left (↶) (Free): turn the previewed piece 90° counter-clockwise around its center before confirming the placement."
        },
        placement_rotate_right: {
            zh: "向右旋转(↷)(免费)：把预览中的零件绕中心顺时针转 90 度，再确认放置。",
            en: "Rotate right (↷) (Free): turn the previewed piece 90° clockwise around its center before confirming the placement."
        },
        placement_flip: {
            zh: "镜像翻转(↔)(免费)：在确认放置之前先水平镜像预览中的零件。",
            en: "Flip (↔) (Free): mirror the previewed piece horizontally before confirming the placement."
        },
        place: {
            zh: "放置零件(1 AP)：确认这块拼图上的预览。绿色表示合法，红色表示零件重叠、超出拼图范围或者盖住了不可用的格子。",
            en: "Place a piece (1 AP): confirm the preview on this puzzle. Green is valid, while red means the piece overlaps, lies outside the puzzle, or covers an unavailable cell."
        },
        queue_master: {
            zh: "加入大师计划(✦)(计划免费)：预订这块零件和这个位置。每张拼图只能有一条计划，要修改就先移除原来的计划。",
            en: "Add to Master plan (✦) (Free to plan): reserve this piece and position. A Master plan may contain one placement per puzzle, so remove a planned placement before changing it."
        },
        use_master: {
            zh: "大师行动(✦)(1 AP)：一次性执行计划中的所有放置，每张选中的拼图放一块零件。每回合只能使用一次大师行动。",
            en: "Master Action (✦) (1 AP): execute the planned placements together, using one piece per chosen puzzle. You may use Master Action only once per turn."
        },
        finishing_place: {
            zh: "收尾放置(−1 分)：在收尾阶段放置一块零件。已完成的拼图会归还用过的零件，但不再给奖励零件。每一次收尾放置扣一分。",
            en: "Finishing placement (−1 point): place a piece during finishing touches. Completed puzzles return used pieces but do not grant a reward piece, and every finishing placement deducts one point."
        },
        finishing_done: {
            zh: "完成(结束收尾)：结束你的放置。所有玩家都完成之后才显示最终结果，没有完成的拼图不计分。",
            en: "Finish (End finishing touches): finish your placements. Final results appear when every player is done, and unfinished puzzles score no points."
        },
        cancel_market: {
            zh: "取消(免费)：关闭这个预览而不拿走拼图。",
            en: "Cancel (Free): close this preview without taking the puzzle."
        },
        cancel_placement: {
            zh: "取消(免费)：放弃这个位置而不消耗零件。点击空白处也可以取消选择。",
            en: "Cancel (Free): cancel this position without spending a piece. You can also click blank space to deselect."
        },
        upgrade_option: {
            zh: "升级到这个零件(1 AP)：交回你选中的那块零件，换成这一块。",
            en: "Upgrade to this piece (1 AP): return the piece you selected and take this one instead."
        },
        ap: {
            zh: "行动点(⚡)：每回合有三点，每个动作消耗一点，大师行动每回合只能用一次。",
            en: "Action points (⚡): you get 3 per turn, each action costs 1 AP, and Master Action can be used only once per turn."
        },
        master_action: {
            zh: "大师行动(✦)：花一点行动点，在任意多张自己的拼图上各放一块零件，每回合一次。",
            en: "Master Action (✦): for 1 AP, place one piece on each of any number of your puzzles, once per turn."
        },
        white_deck: {
            zh: "白拼图(⚪)：通常比较容易，适合用来积累零件。",
            en: "White puzzles (⚪): usually easier, and good for building up your inventory."
        },
        black_deck: {
            zh: "黑拼图(⚫)：更难但分数更高。黑色牌库抽空会触发最后一轮。",
            en: "Black puzzles (⚫): harder and worth more points. Emptying the black deck triggers the final round."
        },
        puzzle_limit: {
            zh: "你最多同时进行四张拼图。",
            en: "You can work on up to 4 puzzles at once."
        },
        dialog_close: {
            zh: "关闭当前对话框并回到工作台。",
            en: "Close the current dialog and return to the workbench."
        }
    };

    const PROJECT_L_EXPLAIN_BUTTONS = {
        TakeMarketBtn: "take_market",
        DrawWhiteBtn: "draw_white",
        DrawBlackBtn: "draw_black",
        TakeLevel1Btn: "take_level1",
        UpgradeBtn: "upgrade",
        RotateLeftBtn: "rotate_left",
        RotateRightBtn: "rotate_right",
        FlipBtn: "flip",
        PlaceBtn: "place",
        QueueMasterBtn: "queue_master",
        UseMasterBtn: "use_master",
        FinishingPlaceBtn: "finishing_place",
        FinishingDoneBtn: "finishing_done",
        CancelMarketBtn: "cancel_market",
        CancelPlacementBtn: "cancel_placement",
        PlacementRotateLeftBtn: "placement_rotate_left",
        PlacementRotateRightBtn: "placement_rotate_right",
        PlacementFlipBtn: "placement_flip"
    };

    const PROJECT_L_HELP_CONFIG = {
        gameId: "project_l",
        title: { zh: "项目L · Project L", en: "Project L" },
        basic: {
            win: {
                zh: "用零件填满拼图空格就能拿到它的分数(★)和奖励零件(+)，终局时完成拼图的分数减去收尾罚分最高的玩家获胜。",
                en: "Filling a puzzle's spaces earns its points (★) and reward pieces (+), and at the end the player with the highest completed puzzle score minus finishing penalties wins."
            },
            turn: {
                zh: "每回合有三点行动点(⚡)，你可以拿拼图、拿一级零件、升级零件、放置零件，或者花一点行动点执行大师行动(✦)。",
                en: "Each turn gives you 3 action points (⚡), which you spend on taking a puzzle, taking a level-1 piece, upgrading a piece, placing a piece, or running the Master Action (✦) for 1 AP."
            },
            key: {
                zh: "所有放在已完成拼图上的零件都会回到你的库存，所以真正的效率在于让同一批零件反复填满更多拼图，而不是把好零件锁死在一张拼图上。",
                en: "Every piece used on a completed puzzle returns to your inventory, so real efficiency comes from recycling the same pieces through as many puzzles as possible instead of locking good ones into a single puzzle."
            }
        },
        sections: [
            {
                id: "build",
                label: { zh: "拼图与奖励", en: "Build and complete" },
                html: {
                    zh: "<p>填满拼图的空格就能得到它的分数(★)与奖励零件(+)。所有用在一张已完成拼图上的零件都会回到你的库存，奖励零件也一并到手。</p>",
                    en: "<p>Fill puzzle spaces to earn their points (★) and reward pieces (+). All pieces used on a completed puzzle return to your inventory, together with its reward.</p>"
                }
            },
            {
                id: "turn",
                label: { zh: "你的回合", en: "Your turn" },
                html: {
                    zh: "<p>你开局有一块一级方块和一块二级长条。每回合给你三点行动点(⚡)，下面每个动作消耗一点行动点，除大师行动外都可以重复。</p><ul><li><strong>Take a puzzle：</strong>选中一张市场牌并确认 Take，或者从牌库抽一张未知牌。最多同时持有四张进行中的拼图。</li><li><strong>+ Lv 1：</strong>拿一个黄色方块。</li><li><strong>Upgrade (↑)：</strong>选中库存零件，再选一个高一级的形状。三级和四级零件还可以在同级内换形状。</li><li><strong>Place：</strong>选中零件，点一个拼图格，再在那张拼图旁确认。</li><li><strong>Master Action (✦)：</strong>花一点行动点，在任意多张自己的拼图上各放一块零件，每回合一次。</li></ul>",
                    en: "<p>You start with one level-1 square and one level-2 bar. Each turn gives you 3 action points (⚡), each action below costs 1 AP, and actions may be repeated except Master Action.</p><ul><li><strong>Take a puzzle:</strong> select a market card and confirm Take, or draw an unknown card from a deck. Hold up to 4 active puzzles.</li><li><strong>+ Lv 1:</strong> take one yellow square.</li><li><strong>Upgrade (↑):</strong> select an inventory piece and choose a shape one level higher. Level-3 and level-4 pieces can also change shape within the same level.</li><li><strong>Place:</strong> select a piece, tap a puzzle cell, then confirm next to that puzzle.</li><li><strong>Master Action (✦):</strong> place one piece on each of any number of your puzzles for 1 AP, once per turn.</li></ul>"
                }
            },
            {
                id: "pieces",
                label: { zh: "零件与预览", en: "Pieces and previews" },
                html: {
                    zh: "<p>Lv 表示等级，一到四级都是方块。形状字母标识轮廓，I 是长条，V 是拐角，O 是正方形，T、L 和 Z 与字母形状一致。颜色和画出来的形状共同标识每一块零件。</p><p>向左旋转(↶)、向右旋转(↷)和镜像(↔)都免费。旋转时选中的零件保持居中。浅色圆点标出合法的起点，绿色预览表示放得下，红色表示放不下。起点是零件外接矩形的左上角，包含空缺的那一角。点击空白处或按 Esc 取消选择，滚动页面永远不会选中或放置零件。</p>",
                    en: "<p>Lv means level, from 1 to 4. Shape letters identify the outline, where I is a bar, V is a corner, O is a square, and T, L and Z match their letters. Colour and the drawn shape identify every piece.</p><p>Rotate left (↶), rotate right (↷), or mirror (↔) for free. Rotation keeps the selected piece centered. Light dots mark valid origins, green previews fit and red previews do not. An origin is the top-left of the piece's bounding rectangle, including any empty corner. Tapping blank space or pressing Escape cancels a selection, and scrolling never selects or places a piece.</p>"
                }
            },
            {
                id: "master",
                label: { zh: "大师计划", en: "Master plan" },
                html: {
                    zh: "<p>选好一个合法放置后按 + Master plan。这块零件会被预订，对应拼图也会锁定，直到你移除这条计划。在其他拼图上重复这个操作，然后按 Use Master。库存显示的是扣除预订之后仍然可用的零件。计划本身不花任何东西，并在你的回合或零件发生变化时清空。</p>",
                    en: "<p>Choose a valid placement and press + Master plan. Its piece is reserved and its puzzle locked until you remove that entry. Repeat on other puzzles, then press Use Master. The inventory shows available pieces after reservations. Planning costs nothing and is cleared when your turn or your pieces change.</p>"
                }
            },
            {
                id: "market",
                label: { zh: "市场与收尾", en: "Markets and finishing" },
                html: {
                    zh: "<p>白拼图(⚪)通常比较容易，黑拼图(⚫)更难但分数更高。黑色牌库抽空会触发最后一轮，游戏会一直进行到起始玩家的前一位。</p><p>之后每个人都可以继续放置剩余零件，每放一块扣一分。已完成的拼图会归还用过的零件，但不再给奖励零件。放完就按 Finish。最终分数是完成拼图的分数减去收尾罚分，平分时先比完成的拼图数量，再比库存零件数量。</p>",
                    en: "<p>White (⚪) puzzles are usually easier while black (⚫) puzzles are harder and worth more points. Emptying the black deck triggers the final round, which continues through the player before the starting player.</p><p>Then everyone may place remaining pieces, losing 1 point per placement. Completed puzzles return used pieces but no longer grant a reward piece. Press Finish when done. Final score is completed puzzle points minus finishing penalties, and ties favor more completed puzzles, then more pieces in inventory.</p>"
                }
            },
            {
                id: "board",
                label: { zh: "读懂界面", en: "Reading the board" },
                html: {
                    zh: "<p>分数(★)显示在每张拼图上方，奖励(+)显示在下方。Players 区域展示公开进度和已放置的零件。已完成的拼图和玩家详情都可以折叠。</p><p>把鼠标悬停在非交互符号上或轻点它可以看到简短说明。Explain 会高亮控件并让你查看它们而不触发操作，已禁用的控件也可以查看。按 Esc 关闭对话框或退出 Explain。</p>",
                    en: "<p>Points (★) appear above each puzzle and its reward (+) appears below. The Players section shows public progress and placed pieces, and completed puzzles and player details can be collapsed.</p><p>Hover or tap non-interactive symbols for a short explanation. Explain highlights controls and lets you inspect them without acting, including disabled controls. Escape closes dialogs or leaves Explain.</p>"
                }
            }
        ]
    };

    let projectLHelpWidget = null;
    let projectLExplainWidget = null;

    function initProjectLHelpExplain() {
        if (projectLHelpWidget || typeof window.obgCreateHelp !== "function") return;
        projectLHelpWidget = window.obgCreateHelp(PROJECT_L_HELP_CONFIG);
        projectLExplainWidget = window.obgCreateExplain({
            gameId: "project_l",
            attribute: "data-project-l-explain",
            explanations: PROJECT_L_EXPLAIN,
            button: byId("ExplainBtn"),
            root: () => panel,
            bypass: ["#projectLHelpBtn", "#projectLExplainBtn"]
        });
        byId("HelpBtn")?.addEventListener("click", () => {
            projectLExplainWidget?.exit();
            projectLHelpWidget.open();
        });
        byId("ExplainBtn")?.addEventListener("click", () => projectLExplainWidget?.toggle());
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function setTip(node, text) {
        node.dataset.projectLTip = text;
        node.tabIndex = 0;
        return node;
    }

    function setExplanation(node, key) {
        node.dataset.projectLExplain = key;
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
        projectLExplainWidget?.refresh();
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
        projectLExplainWidget?.exit();
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
            setExplanation(button, "upgrade_option");
            setTip(button, `Return ${pieceName(fromPiece)} and take ${pieceName(pieceId)} for 1 AP.`);
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
    Object.entries(PROJECT_L_EXPLAIN_BUTTONS).forEach(([suffix, key]) => setExplanation(byId(suffix), key));

    function inScope(target) {
        return target instanceof Element && !!target.closest("#projectLPanel, .project-l-modal");
    }

    document.addEventListener("pointerdown", (event) => {
        suppressClick = false;
        if (!inScope(event.target)) { gesture = null; return; }
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
    }, true);
    document.addEventListener("click", (event) => {
        if (suppressClick && event.detail !== 0 && inScope(event.target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    function hideTooltip() {
        clearTimeout(tooltipTimer);
        tooltip.classList.add("hidden");
        tooltipTarget?.removeAttribute("aria-describedby");
        tooltipTarget = null;
    }

    function showTooltip(target) {
        if (projectLExplainWidget?.isActive() || target.closest("button, a, input, select, summary")) return;
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
            else if (projectLExplainWidget?.isActive()) projectLExplainWidget.exit();
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
            projectLExplainWidget?.exit();
            modalNames.forEach(closeModal);
            document.body.classList.remove("project-l-turn-active");
        } else if (state.view) updateControls();
    };
    if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "project_l"
            && typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "project_l"
            && lastGameStatePayload.room_id === currentRoomState.room_id) renderState(lastGameStatePayload);
    initProjectLHelpExplain();
})();
