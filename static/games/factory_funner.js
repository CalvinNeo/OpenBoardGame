(() => {
    const GAME_ID = "factory_funner";
    const byId = (suffix) => document.getElementById(`factoryFunner${suffix}`);
    const panel = byId("Panel");
    const tooltip = byId("Tooltip");

    const DELTA = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    const OPPOSITE = [2, 3, 0, 1];
    const EDGE_LABEL = { zh: ["上", "右", "下", "左"], en: ["top", "right", "bottom", "left"] };
    const MATERIAL_COLOR = { red: "#ef4444", blue: "#3b82f6", yellow: "#eab308", green: "#22c55e" };
    const MATERIAL_EMOJI = { red: "🔴", blue: "🔵", yellow: "🟡", green: "🟢" };

    const state = { view: null, sel: null, rotation: 0, round: null, phase: null };
    let gesture = null;
    let suppressClick = false;
    let tooltipTimer = null;
    let tooltipTarget = null;

    /* ----------------------------------------------------------- helpers */

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function setTip(node, text) {
        node.dataset.factoryFunnerTip = text;
        if (!node.hasAttribute("tabindex") && !node.closest("button")) node.tabIndex = 0;
        return node;
    }

    function setExplanation(node, key) {
        node.setAttribute("data-factory-funner-explain", key);
        return node;
    }

    function you(view = state.view) {
        return view?.players?.find((player) => player.player_id === view.you) || null;
    }

    function available(action) {
        return !!state.view?.legal_actions?.includes(action);
    }

    function machineList() {
        return state.view?.machines || {};
    }

    function rotationOf(cell) {
        return (((Number(cell.rotation) / 90) % 4) + 4) % 4;
    }

    function portOnEdge(machine, rotation, edge) {
        return machine.ports.find((port) => (port.edge + rotation) % 4 === edge) || null;
    }

    function neighbourPort(board, row, col, edge) {
        const size = state.view.board_size;
        const nextRow = row + DELTA[edge][0];
        const nextCol = col + DELTA[edge][1];
        if (nextRow < 0 || nextCol < 0 || nextRow >= size || nextCol >= size) return null;
        const cell = board[nextRow][nextCol];
        if (!cell) return null;
        const machine = machineList()[cell.machine_id];
        if (!machine) return null;
        return portOnEdge(machine, rotationOf(cell), OPPOSITE[edge]);
    }

    // Mirrors game/factory_funner.py so the preview matches the server result.
    function cellInfo(board, row, col) {
        const cell = board[row][col];
        const machine = machineList()[cell.machine_id];
        const scoring = state.view.scoring;
        const rotation = rotationOf(cell);
        let matched = 0;
        let unfed = 0;
        let unused = 0;
        const links = [];
        machine.ports.forEach((port) => {
            const edge = (port.edge + rotation) % 4;
            const partner = neighbourPort(board, row, col, edge);
            if (partner && partner.kind !== port.kind && partner.color === port.color) {
                matched += 1;
                links.push(edge);
            } else if (port.kind === "in") {
                unfed += 1;
            } else {
                unused += 1;
            }
        });
        return {
            value: machine.value,
            matched,
            unfed,
            unused,
            links,
            score: machine.value + scoring.match_bonus * matched
                - scoring.unfed_input_cost * unfed - scoring.unused_output_cost * unused,
        };
    }

    function boardMoney(board) {
        const size = state.view.board_size;
        let total = 0;
        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                if (board[row][col]) total += cellInfo(board, row, col).score;
            }
        }
        return total;
    }

    function previewBoard() {
        const me = you();
        if (!me || !state.sel) return null;
        const board = me.board.map((row) => row.slice());
        board[state.sel.row][state.sel.col] = {
            machine_id: state.view.current_machine,
            rotation: state.rotation,
        };
        return board;
    }

    function previewInfo() {
        const board = previewBoard();
        if (!board) return null;
        return cellInfo(board, state.sel.row, state.sel.col);
    }

    /* ---------------------------------------------------------- explain */

    const FACTORY_FUNNER_EXPLAIN = {
        round: {
            zh: "轮次：每一轮会公开一台机器，所有玩家都要在自己工厂里安装同一台机器。",
            en: "Round: each round reveals one machine, and every player installs that same machine in their own factory.",
        },
        money: {
            zh: "你的钱(💰)：工厂里所有机器当前收益的总和。每放下一次机器都会重新结算整座工厂，所以旧机器也可能变多。",
            en: "Your money (💰): the sum of what every machine in your factory currently produces. Each placement re-settles the whole factory, so older machines can improve too.",
        },
        phase: {
            zh: "阶段：放置阶段等待所有人安装机器；结算阶段展示本轮结果，全员点击 Next Round 后进入下一轮。",
            en: "Phase: during placing the game waits for everyone to install the machine; during review the round results are shown and the next round starts once everyone presses Next Round.",
        },
        machine: {
            zh: "本轮机器：所有人都要安装这一台。它的基础收益和四个边上的端口决定了放在哪里最划算。",
            en: "This round's machine: everyone installs this one. Its base value and the ports on its four edges decide where it is worth placing.",
        },
        machine_value: {
            zh: "基础收益(💰)：这台机器自身带来的钱，端口的加减会在此基础上叠加。",
            en: "Base value (💰): the money this machine brings on its own, before port adjustments are applied.",
        },
        machine_ports: {
            zh: "端口列表：空心方块是需要原料的进料口，实心方块是产出成品的出料口，颜色代表材料种类。",
            en: "Port list: hollow chips are input ports that need a material, solid chips are output ports that produce one, and the colour is the material.",
        },
        empty_cell: {
            zh: "空位：点一下可以预览把本轮机器放在这里的效果，确认栏会显示这次放置能赚多少钱。",
            en: "Empty cell: tap it to preview the current machine here. The confirmation bar shows how much money this placement earns.",
        },
        rotate_left: {
            zh: "向左旋转(↺)：把预览中的机器绕中心逆时针转 90 度，端口随之转到别的边。旋转免费，且不会改变已选中的格子。",
            en: "Rotate left (↺): turn the previewed machine 90° counter-clockwise around its centre, moving its ports to different edges. Rotating is free and keeps the selected cell.",
        },
        rotate_right: {
            zh: "向右旋转(↻)：把预览中的机器绕中心顺时针转 90 度，端口随之转到别的边。旋转免费，且不会改变已选中的格子。",
            en: "Rotate right (↻): turn the previewed machine 90° clockwise around its centre, moving its ports to different edges. Rotating is free and keeps the selected cell.",
        },
        place: {
            zh: "放置：确认把机器装进选中的格子。机器放下后不能移动或拆除，所以位置一旦确认就定了。",
            en: "Place: confirm installing the machine in the selected cell. A machine can never be moved or removed afterwards, so the position is final.",
        },
        cancel: {
            zh: "取消：放弃这个预览而不放置机器。点击工厂外的空白处也可以取消选择。",
            en: "Cancel: drop this preview without placing. Tapping blank space outside the factory also cancels the selection.",
        },
        pass: {
            zh: "放弃本轮(Pass)：把这台机器直接丢掉，不花钱也不赚钱。当工厂里没有好位置时这是保底选择。",
            en: "Pass: discard this round's machine without gaining or losing money. It is the safe option when no cell looks good.",
        },
        next_round: {
            zh: "Next Round：看完本轮所有人的结果后点击继续。所有人都点击之后才会开始下一轮。",
            en: "Next Round: continue after reading what everyone did this round. The next round starts once every player has pressed it.",
        },
        summary: {
            zh: "本轮结果：每位玩家这一轮把机器放在了哪里、赚了多少。和你自己相关的那一行会高亮显示。",
            en: "Round results: where each player installed the machine and how much it earned. Your own row is highlighted.",
        },
        players: {
            zh: "Players：所有玩家的钱和工厂缩略图。缩略图里绿色格子表示这台机器当前赚钱，红色表示亏钱。",
            en: "Players: everyone's money and a thumbnail of their factory. Green cells are machines currently making money, red ones are losing money.",
        },
        result: {
            zh: "最终排名：全部轮次结束后按钱的多少排名，钱最多的玩家获胜。",
            en: "Final ranking: after the last round the players are ranked by money, and the richest player wins.",
        },
    };

    function resetDynamicExplain() {
        Object.keys(FACTORY_FUNNER_EXPLAIN).forEach((key) => {
            if (key.startsWith("dyn_")) delete FACTORY_FUNNER_EXPLAIN[key];
        });
    }

    function describeMachine(machine, rotation) {
        const scoring = state.view.scoring;
        const parts = machine.ports.map((port) => {
            const edge = (port.edge + rotation) % 4;
            const emoji = MATERIAL_EMOJI[port.color] || "";
            const kindZh = port.kind === "in" ? "进料口" : "出料口";
            const kindEn = port.kind === "in" ? "input" : "output";
            return {
                zh: `${EDGE_LABEL.zh[edge]}边 ${kindZh}（${emoji}）`,
                en: `${EDGE_LABEL.en[edge]} edge ${kindEn} (${emoji})`,
            };
        });
        const zh = `本轮机器：基础收益 💰${machine.value}。` + (parts.length
            ? "端口：" + parts.map((part) => part.zh).join("、") + "。"
            : "这台机器没有端口，放哪都一样。");
        const en = `This round's machine: base value 💰${machine.value}. ` + (parts.length
            ? "Ports: " + parts.map((part) => part.en).join(", ") + "."
            : "This machine has no ports, so any cell works.");
        return { zh, en, scoring };
    }

    /* ------------------------------------------------------------- help */

    const FACTORY_FUNNER_HELP = {
        gameId: GAME_ID,
        title: { zh: "工厂乐翻天 · Factory Funner", en: "Factory Funner" },
        basic: {
            win: {
                zh: "每一轮所有人安装同一台机器，全部轮次结束后工厂里钱(💰)最多的玩家获胜。",
                en: "Every round everyone installs the same machine, and after the final round the player whose factory is worth the most money (💰) wins.",
            },
            turn: {
                zh: "轮到你时，点工厂里一个空位预览这台机器，用 ↺ ↻ 旋转端口，确认后按 Place 放下。实在没有好位置就按 Pass 丢掉这台机器。",
                en: "On your turn, tap an empty cell to preview the machine, rotate its ports with ↺ and ↻, then press Place to install it. Press Pass to discard the machine when no cell looks good.",
            },
            key: {
                zh: "钱是按整座工厂实时结算的：把新机器贴到旧机器旁边，会让旧机器一起升值，所以真正的重点是提前规划管道走向，而不是只顾眼前这一台。",
                en: "Money is settled across the whole factory every time: placing a new machine next to an old one raises the old machine's income too, so the real skill is planning the pipe layout ahead instead of only optimising the machine in front of you.",
            },
        },
        sections: [
            {
                id: "machine",
                label: { zh: "机器与端口", en: "Machines and ports" },
                html: {
                    zh: "<p>每台机器占一格，中央数字是它的基础收益(💰)。四条边上可能有端口。<strong>空心方块是进料口</strong>，需要别人送来原料。<strong>实心方块是出料口</strong>，会把成品送出去。颜色代表材料种类，共有 🔴 红、🔵 蓝、🟡 黄、🟢 绿四种。</p><p>机器可以旋转 90 度，端口会跟着转到别的边。旋转是免费的，选中的格子也不会变，所以可以先选位置再慢慢试朝向。</p>",
                    en: "<p>Each machine occupies one cell and the number in the middle is its base value (💰). Its edges may carry ports: a <strong>hollow chip is an input</strong> that needs a material delivered, and a <strong>solid chip is an output</strong> that ships one out. Colours are the four materials: 🔴 red, 🔵 blue, 🟡 yellow and 🟢 green.</p><p>A machine can be rotated in 90° steps and its ports move with it. Rotating is free and keeps the selected cell, so choose a spot first and then try orientations.</p>",
                },
            },
            {
                id: "scoring",
                label: { zh: "收益结算", en: "How money is settled" },
                html: {
                    zh: "<p>两个相邻格子的端口如果<strong>面对面、同颜色、且一个是进料口一个是出料口</strong>，就形成一次对接。你的钱 = 工厂里每台机器的当前收益之和，而每台机器的收益按下面的方式算：</p><ul><li>基础收益：机器中央的 💰 数值。</li><li>每个对接上的端口 +1。</li><li>每个没接上的进料口 −2（要外购原料）。</li><li>每个没人接的出料口 −1（要处理废料）。</li></ul><p>因为每次放置都会重新结算整座工厂，早先放下的机器会因为后来接上的邻居而升值，这也是分数不断变动的来源。</p>",
                    en: "<p>Two ports on neighbouring cells form a link when they <strong>face each other, share a colour, and one is an input while the other is an output</strong>. Your money is the sum of what every machine currently produces, and each machine is settled like this:</p><ul><li>Base value: the 💰 number printed on the machine.</li><li>+1 for every port that is linked.</li><li>−2 for every input port left unfed (you must buy the raw material).</li><li>−1 for every output port nobody consumes (waste handling).</li></ul><p>Because the whole factory is re-settled after every placement, an early machine becomes more valuable once a neighbour links to it, which is why the numbers keep moving.</p>",
                },
            },
            {
                id: "round",
                label: { zh: "每轮流程", en: "Round flow" },
                html: {
                    zh: "<p>一轮开始时公开一台新机器，所有玩家<strong>同时</strong>在自己工厂里安装它，互相看不到对方选的位置。所有人都完成（或 Pass）之后进入结算阶段，界面会列出每个人这一轮把机器放在哪、赚了多少，和你相关的那一行会高亮。</p><p>看完结果后点击 Next Round，所有玩家都点击之后才会开始下一轮。最后一轮结算完毕即进入最终排名。</p>",
                    en: "<p>A round reveals one new machine and every player installs it <strong>at the same time</strong> in their own factory, without seeing each other's choice. Once everyone has placed (or passed) the round enters review, listing where each player put the machine and how much it earned, with your own row highlighted.</p><p>Press Next Round after reading the results; the next round only begins once every player has pressed it. The final ranking appears after the last round.</p>",
                },
            },
            {
                id: "ui",
                label: { zh: "读懂界面", en: "Reading the board" },
                html: {
                    zh: "<p>工厂里已安装的机器会显示它<strong>当前</strong>的收益，绿色是赚钱、红色是亏钱，接上的端口会带一圈绿色高亮。选中空位后，格子里会显示这次放置的收益增减，下方确认栏也会重复一次，并给出 ↺ ↻ 旋转、Place 放置和 Cancel 取消。</p><p>Players 面板列出每个人的钱和工厂缩略图。把鼠标悬停在非交互符号上，或在手机上轻点它，可以看到简短说明。Explain 会高亮可解释的控件并让你查看而不触发操作。按 Esc 可以取消选择或退出 Explain。</p>",
                    en: "<p>An installed machine shows its <strong>current</strong> income, green when it earns and red when it loses, and linked ports get a green ring. Once you select an empty cell the preview shows the money change, and the confirmation bar repeats it next to the ↺ ↻ rotate, Place and Cancel buttons.</p><p>The Players panel lists everyone's money and a thumbnail of their factory. Hover a non-interactive symbol, or tap it on a phone, for a short note. Explain highlights the controls it can describe and lets you inspect them without acting. Escape cancels a selection or leaves Explain.</p>",
                },
            },
        ],
    };

    let helpWidget = null;
    let explainWidget = null;

    function initHelpExplain() {
        if (helpWidget || typeof window.obgCreateHelp !== "function") return;
        helpWidget = window.obgCreateHelp(FACTORY_FUNNER_HELP);
        explainWidget = window.obgCreateExplain({
            gameId: GAME_ID,
            attribute: "data-factory-funner-explain",
            explanations: FACTORY_FUNNER_EXPLAIN,
            button: byId("ExplainBtn"),
            root: () => panel,
            bypass: ["#factoryFunnerHelpBtn", "#factoryFunnerExplainBtn"],
        });
        byId("HelpBtn")?.addEventListener("click", () => {
            explainWidget?.exit();
            helpWidget.open();
        });
        byId("ExplainBtn")?.addEventListener("click", () => explainWidget?.toggle());
    }

    /* ------------------------------------------------------------ render */

    function renderPorts(container, machine, rotation, linkedEdges) {
        machine.ports.forEach((port) => {
            const edge = (port.edge + rotation) % 4;
            const bar = element("span", `ff-port ff-${port.kind === "in" ? "in" : "out"}`
                + (linkedEdges && linkedEdges.has(edge) ? " ff-linked" : ""));
            bar.dataset.edge = String(edge);
            bar.style.setProperty("--c", MATERIAL_COLOR[port.color] || "#64748b");
            container.appendChild(bar);
        });
    }

    function renderMachineCard() {
        const view = state.view;
        const machine = machineList()[view.current_machine];
        const tile = byId("MachineTile");
        tile.replaceChildren();
        if (!machine) {
            byId("MachineValue").textContent = "–";
            byId("MachineId").textContent = "";
            byId("MachinePorts").replaceChildren();
            return;
        }
        const score = element("span", "ff-score", String(machine.value));
        tile.appendChild(score);
        renderPorts(tile, machine, state.rotation, null);
        tile.setAttribute("aria-label", `Machine worth ${machine.value}`);
        byId("MachineValue").textContent = String(machine.value);
        byId("MachineId").textContent = `#${view.round} · ${machine.id.toUpperCase()}`;
        setExplanation(tile, "dyn_machine");

        const list = byId("MachinePorts");
        list.replaceChildren();
        const preview = previewInfo();
        machine.ports.forEach((port) => {
            const edge = (port.edge + state.rotation) % 4;
            const item = element("li");
            const swatch = element("span", `ff-swatch${port.kind === "in" ? " ff-hollow" : ""}`);
            swatch.style.setProperty("--c", MATERIAL_COLOR[port.color] || "#64748b");
            const emoji = MATERIAL_EMOJI[port.color] || "";
            item.append(swatch, element("span", "", `${emoji} ${EDGE_LABEL.en[edge]} ${port.kind === "in" ? "in" : "out"}`));
            setTip(item, `${port.kind === "in" ? "Input" : "Output"} port on the ${EDGE_LABEL.en[edge]} edge, ${port.color} material ${emoji}.`);
            list.appendChild(item);
        });
        if (!machine.ports.length) {
            const item = element("li", "ff-muted", "No ports");
            list.appendChild(item);
        }
        setExplanation(list, "machine_ports");
    }

    function renderBoard() {
        const board = byId("Board");
        board.replaceChildren();
        const view = state.view;
        const me = you();
        const size = view.board_size;
        board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        if (!me) {
            board.appendChild(element("div", "ff-muted", "Spectating."));
            return;
        }
        const canPlace = available("place_machine");
        const machine = machineList()[view.current_machine];
        const preview = previewBoard();
        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                const cellData = me.board[row][col];
                const selected = !!state.sel && state.sel.row === row && state.sel.col === col;
                if (cellData) {
                    const node = element("div", "ff-cell ff-filled");
                    const info = cellInfo(me.board, row, col);
                    const score = element("span", `ff-score ${info.score < 0 ? "ff-neg" : "ff-pos"}`, String(info.score));
                    node.appendChild(score);
                    renderPorts(node, machineList()[cellData.machine_id], rotationOf(cellData), new Set(info.links));
                    node.setAttribute("aria-label", `Row ${row + 1} column ${col + 1}, machine earning ${info.score}`);
                    setTip(node, `Row ${row + 1}, column ${col + 1}: ${info.score} money — base ${info.value}, `
                        + `${info.matched} linked, ${info.unfed} unfed input, ${info.unused} unused output.`);
                    setExplanation(node, `dyn_cell_${row}_${col}`);
                    board.appendChild(node);
                } else {
                    const node = element("button", `ff-cell ff-empty${selected ? " ff-selected ff-preview" : ""}`);
                    node.type = "button";
                    node.disabled = !canPlace;
                    node.dataset.factoryFunnerKey = `cell-${row}-${col}`;
                    if (selected && machine && preview) {
                        const info = cellInfo(preview, row, col);
                        const delta = boardMoney(preview) - me.money;
                        const score = element("span", `ff-score ${delta < 0 ? "ff-neg" : "ff-pos"}`,
                            `${delta > 0 ? "+" : ""}${delta}`);
                        node.appendChild(score);
                        renderPorts(node, machine, state.rotation, new Set(info.links));
                    }
                    node.setAttribute("aria-label", `Empty cell, row ${row + 1} column ${col + 1}`);
                    node.setAttribute("aria-pressed", String(selected));
                    setExplanation(node, "empty_cell");
                    node.addEventListener("click", () => selectCell(row, col));
                    board.appendChild(node);
                }
            }
        }
    }

    function renderConfirm() {
        const box = byId("Confirm");
        const hint = byId("ConfirmHint");
        const canPlace = available("place_machine");
        if (!state.sel || !canPlace) {
            box.classList.add("hidden");
            return;
        }
        const me = you();
        const preview = previewBoard();
        const info = cellInfo(preview, state.sel.row, state.sel.col);
        const delta = boardMoney(preview) - me.money;
        box.classList.remove("hidden");
        hint.textContent = `R${state.sel.row + 1}C${state.sel.col + 1} · ${delta > 0 ? "+" : ""}${delta} 💰`
            + ` · ${info.matched} link${info.matched === 1 ? "" : "s"}`;
        hint.className = `ff-confirm-hint ff-delta ${delta > 0 ? "ff-pos" : delta < 0 ? "ff-neg" : "ff-zero"}`;
        byId("PlaceBtn").disabled = false;
    }

    function renderSummary() {
        const box = byId("Summary");
        const view = state.view;
        if (view.phase !== "review" || !view.round_summary?.length) {
            box.classList.add("hidden");
            return;
        }
        box.classList.remove("hidden");
        byId("SummaryRound").textContent = String(view.round);
        const list = byId("SummaryList");
        list.replaceChildren();
        view.round_summary.forEach((entry) => {
            const player = view.players.find((item) => item.player_id === entry.player_id);
            const row = element("div", `ff-summary-row${entry.player_id === view.you ? " ff-you" : ""}`);
            const name = element("span", "", `${player?.name || entry.player_id}`
                + ` · ${entry.action === "pass" ? "Passed" : `R${entry.row + 1}C${entry.col + 1}`}`);
            const delta = element("span", `ff-delta ${entry.delta > 0 ? "ff-pos" : entry.delta < 0 ? "ff-neg" : "ff-zero"}`,
                `${entry.delta > 0 ? "+" : ""}${entry.delta} 💰 · ${entry.money}`);
            row.append(name, delta);
            setTip(row, `${player?.name || entry.player_id}: `
                + `${entry.action === "pass" ? "discarded the machine" : `installed it at row ${entry.row + 1}, column ${entry.col + 1}`}`
                + `, now holding ${entry.money} money.`);
            list.appendChild(row);
        });
        setExplanation(list, "summary");
        const waiting = view.players.filter((player) => !player.ready).length;
        const button = byId("NextRoundBtn");
        button.disabled = !available("next_round");
        button.textContent = view.round >= view.total_rounds ? "Finish" : "Next Round";
        byId("SummaryWait").textContent = available("next_round")
            ? ""
            : `Waiting for ${waiting} player${waiting === 1 ? "" : "s"}`;
    }

    function renderPlayers() {
        const view = state.view;
        const container = byId("Players");
        container.replaceChildren();
        byId("PlayerCount").textContent = `(${view.players.length})`;
        view.players.forEach((player) => {
            const card = element("div", `ff-player${player.player_id === view.you ? " ff-you" : ""}`);
            const main = element("div", "ff-player-main");
            const name = element("div", "ff-player-name",
                `${player.name || player.player_id}${player.is_bot ? " · Bot" : ""}`);
            let status = "Waiting";
            if (view.game_over) status = `Final ${player.money} 💰`;
            else if (view.phase === "review") status = player.ready ? "Ready" : "Reading results";
            else status = player.acted ? "Placed" : "Choosing";
            const meta = element("div", "ff-player-meta", `💰 ${player.money} · ${status}`);
            main.append(name, meta);
            card.appendChild(main);

            const mini = element("div", "ff-mini");
            for (let row = 0; row < view.board_size; row += 1) {
                for (let col = 0; col < view.board_size; col += 1) {
                    const cellData = player.board[row][col];
                    const square = element("span", "ff-mini-cell");
                    if (cellData) {
                        const info = cellInfo(player.board, row, col);
                        square.classList.add("ff-on", info.score < 0 ? "ff-neg" : "ff-pos");
                    }
                    mini.appendChild(square);
                }
            }
            card.appendChild(mini);
            setTip(card, `${player.name || player.player_id}: ${player.money} money. `
                + "Green cells are machines making money, red ones are losing money.");
            setExplanation(card, "players");
            container.appendChild(card);
        });
    }

    function renderResult() {
        const box = byId("Result");
        const view = state.view;
        if (!view.game_over) {
            box.classList.add("hidden");
            box.replaceChildren();
            return;
        }
        box.replaceChildren();
        box.classList.remove("hidden");
        const ranked = [...view.players].sort((a, b) => (view.scores[b.player_id] ?? b.money) - (view.scores[a.player_id] ?? a.money));
        const winners = view.winner || [];
        box.appendChild(element("h3", "", winners.length > 1
            ? "Draw · " + winners.map((id) => view.players.find((p) => p.player_id === id)?.name || id).join(", ")
            : `Winner · ${view.players.find((p) => p.player_id === winners[0])?.name || winners[0] || "—"}`));
        const list = element("ol");
        ranked.forEach((player) => {
            const item = element("li", "", `${player.name || player.player_id} — 💰 ${view.scores[player.player_id] ?? player.money}`);
            list.appendChild(item);
        });
        box.appendChild(list);
        setExplanation(box, "result");
    }

    function render() {
        const view = state.view;
        if (!view) return;
        hideTooltip();
        const me = you();
        byId("Round").textContent = String(view.round ?? "–");
        byId("TotalRounds").textContent = String(view.total_rounds ?? "–");
        byId("Money").textContent = String(me ? me.money : 0);
        const phase = byId("Phase");
        if (view.game_over) phase.textContent = "Results";
        else if (view.phase === "review") phase.textContent = available("next_round") ? "Review · your move" : "Review";
        else if (available("place_machine")) phase.textContent = "Placing · your move";
        else phase.textContent = me?.acted ? "Placing · waiting" : "Placing";

        renderMachineCard();
        renderBoard();
        renderConfirm();
        renderSummary();
        renderPlayers();
        renderResult();

        byId("PassBtn").disabled = !available("pass_machine");
        document.body.classList.toggle("ff-turn-active",
            typeof currentGameType !== "undefined" && currentGameType === GAME_ID
            && !!me && view.legal_actions.length > 0 && !view.game_over);
        explainWidget?.refresh();
    }

    /* ------------------------------------------------------------ actions */

    function selectCell(row, col) {
        if (!available("place_machine")) return;
        state.sel = { row, col };
        render();
    }

    function clearSelection() {
        if (!state.sel) return;
        state.sel = null;
        render();
    }

    function send(type, payload = {}) {
        if (!available(type)) return false;
        hideTooltip();
        sendAction({ type, ...payload });
        return true;
    }

    byId("RotateLeftBtn").addEventListener("click", () => {
        if (!available("place_machine")) return;
        state.rotation = (state.rotation + 270) % 360;
        render();
    });
    byId("RotateRightBtn").addEventListener("click", () => {
        if (!available("place_machine")) return;
        state.rotation = (state.rotation + 90) % 360;
        render();
    });
    byId("PlaceBtn").addEventListener("click", () => {
        if (!state.sel) return;
        if (send("place_machine", { row: state.sel.row, col: state.sel.col, rotation: state.rotation })) {
            state.sel = null;
            render();
        }
    });
    byId("CancelBtn").addEventListener("click", clearSelection);
    byId("PassBtn").addEventListener("click", () => {
        state.sel = null;
        send("pass_machine");
    });
    byId("NextRoundBtn").addEventListener("click", () => send("next_round"));

    /* ----------------------------------------------------- tooltip + input */

    function hideTooltip() {
        clearTimeout(tooltipTimer);
        tooltip.classList.add("hidden");
        tooltipTarget?.removeAttribute("aria-describedby");
        tooltipTarget = null;
    }

    function showTooltip(target) {
        if (explainWidget?.isActive() || target.closest("button, a, input, select, summary")) return;
        hideTooltip();
        tooltipTarget = target;
        tooltip.textContent = target.dataset.factoryFunnerTip;
        tooltip.classList.remove("hidden");
        target.setAttribute("aria-describedby", tooltip.id);
        const anchor = target.getBoundingClientRect();
        const box = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - box.width - 12))}px`;
        tooltip.style.top = `${anchor.bottom + box.height + 8 < innerHeight
            ? anchor.bottom + 5
            : Math.max(12, anchor.top - box.height - 5)}px`;
        tooltipTimer = setTimeout(hideTooltip, 3000);
    }

    panel.addEventListener("pointerover", (event) => {
        const target = event.target.closest("[data-factory-funner-tip]");
        if (target && event.pointerType === "mouse") showTooltip(target);
    });
    panel.addEventListener("pointerout", (event) => {
        if (tooltipTarget && !tooltipTarget.contains(event.relatedTarget)) hideTooltip();
    });
    panel.addEventListener("focusin", (event) => {
        if (event.target.matches("[data-factory-funner-tip]")) showTooltip(event.target);
    });
    panel.addEventListener("focusout", hideTooltip);
    panel.addEventListener("click", (event) => {
        const target = event.target.closest("[data-factory-funner-tip]");
        if (target && !target.closest("button")) { showTooltip(target); return; }
        hideTooltip();
        if (event.target.closest("button, summary, .ff-board, .ff-confirm, .ff-summary, .ff-details")) return;
        clearSelection();
    });

    function inScope(target) {
        return target instanceof Element && !!target.closest("#factoryFunnerPanel");
    }

    // A press only counts as a tap when the finger stays put, so scrolling the
    // page never selects a cell or presses a button. Every press resets the
    // flag first: a stale `true` from an earlier drag would otherwise swallow
    // real taps, which is far worse than letting one drag-through click past.
    document.addEventListener("pointerdown", (event) => {
        suppressClick = false;
        if (!inScope(event.target)) { gesture = null; return; }
        gesture = { pointerId: event.pointerId, left: event.clientX, top: event.clientY, moved: false };
    }, true);
    document.addEventListener("mousedown", () => { suppressClick = false; }, true);
    document.addEventListener("touchstart", () => { suppressClick = false; }, true);
    document.addEventListener("pointermove", (event) => {
        if (gesture?.pointerId === event.pointerId
            && Math.hypot(event.clientX - gesture.left, event.clientY - gesture.top) > 10) {
            gesture.moved = true;
        }
    }, true);
    document.addEventListener("pointercancel", () => {
        suppressClick = true;
        gesture = null;
    }, true);
    document.addEventListener("pointerup", (event) => {
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        const previous = gesture;
        gesture = null;
        if (previous.moved) suppressClick = true;
    }, true);
    document.addEventListener("click", (event) => {
        if (suppressClick && event.detail !== 0 && inScope(event.target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);
    window.addEventListener("blur", () => { gesture = null; hideTooltip(); });
    document.addEventListener("keydown", (event) => {
        if (typeof currentGameType !== "undefined" && currentGameType !== GAME_ID) return;
        if (event.key !== "Escape") return;
        if (explainWidget?.isActive()) explainWidget.exit();
        else clearSelection();
        hideTooltip();
    });

    /* ------------------------------------------------------- state plumbing */

    function renderState(data) {
        // room.js forwards the whole game:state envelope; the public view is nested.
        if (!data?.view) return;
        const view = data.view;
        if (typeof currentGameType !== "undefined" && currentGameType !== GAME_ID) {
            currentGameType = GAME_ID;
            if (typeof setGamePanelVisibility === "function") setGamePanelVisibility(GAME_ID);
        }
        resetDynamicExplain();
        const previousRound = state.round;
        const previousPhase = state.phase;
        state.view = view;
        state.round = view.round;
        state.phase = view.phase;
        if (view.round !== previousRound || view.phase !== previousPhase) state.sel = null;
        if (view.round !== previousRound) state.rotation = 0;
        if (!view.legal_actions?.includes("place_machine")) state.sel = null;

        const machine = machineList()[view.current_machine];
        if (machine) {
            const described = describeMachine(machine, state.rotation);
            FACTORY_FUNNER_EXPLAIN.dyn_machine = { zh: described.zh, en: described.en };
        }
        const me = you(view);
        if (me) {
            for (let row = 0; row < view.board_size; row += 1) {
                for (let col = 0; col < view.board_size; col += 1) {
                    if (!me.board[row][col]) continue;
                    const info = cellInfo(me.board, row, col);
                    const scoring = view.scoring;
                    FACTORY_FUNNER_EXPLAIN[`dyn_cell_${row}_${col}`] = {
                        zh: `第 ${row + 1} 行第 ${col + 1} 列的机器：基础收益 💰${info.value}，`
                            + `${info.matched} 个端口已对接(+${scoring.match_bonus * info.matched})，`
                            + `${info.unfed} 个进料口空着(−${scoring.unfed_input_cost * info.unfed})，`
                            + `${info.unused} 个出料口没人接(−${scoring.unused_output_cost * info.unused})，`
                            + `当前收益 💰${info.score}。`,
                        en: `Machine at row ${row + 1}, column ${col + 1}: base value 💰${info.value}, `
                            + `${info.matched} linked port(s) (+${scoring.match_bonus * info.matched}), `
                            + `${info.unfed} unfed input(s) (−${scoring.unfed_input_cost * info.unfed}), `
                            + `${info.unused} unused output(s) (−${scoring.unused_output_cost * info.unused}), `
                            + `currently producing 💰${info.score}.`,
                    };
                }
            }
        }
        render();
        if (typeof logGameEvents === "function") logGameEvents(data);
    }

    function clearState() {
        explainWidget?.exit();
        hideTooltip();
        state.view = null;
        state.sel = null;
        state.rotation = 0;
        state.round = null;
        state.phase = null;
        ["Board", "Players", "SummaryList", "MachinePorts", "MachineTile", "Result"].forEach((suffix) => {
            byId(suffix)?.replaceChildren();
        });
        byId("Confirm").classList.add("hidden");
        byId("Summary").classList.add("hidden");
        byId("Result").classList.add("hidden");
        byId("Round").textContent = "–";
        byId("TotalRounds").textContent = "–";
        byId("Money").textContent = "0";
        byId("Phase").textContent = "Waiting";
        byId("MachineValue").textContent = "–";
        byId("MachineId").textContent = "";
        byId("PlayerCount").textContent = "";
        byId("PassBtn").disabled = true;
        byId("NextRoundBtn").disabled = true;
        document.body.classList.remove("ff-turn-active");
    }

    window.renderFactoryFunnerGameState = renderState;
    window.clearFactoryFunnerState = clearState;
    window.showFactoryFunnerHeaderActions = (show) => {
        byId("HeaderActions").style.display = show ? "flex" : "none";
        if (!show) {
            explainWidget?.exit();
            hideTooltip();
            document.body.classList.remove("ff-turn-active");
        } else if (state.view) {
            render();
        }
    };

    if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === GAME_ID
            && typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === GAME_ID
            && lastGameStatePayload.room_id === currentRoomState.room_id) {
        renderState(lastGameStatePayload);
    }
    initHelpExplain();
})();
