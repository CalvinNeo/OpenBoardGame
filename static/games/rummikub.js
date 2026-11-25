(function () {
  "use strict";

  const panel = document.getElementById("rummikubPanel");
  const header = document.getElementById("rummikubHeaderActions");
  const element = (suffix) => document.getElementById("rummikub" + suffix);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const colors = ["red", "blue", "orange", "black", "joker"];
  const marks = { red: "●", blue: "◆", orange: "▲", black: "■", joker: "★" };
  const helpConfig = {
    gameId: "rummikub",
    title: { zh: "拉密", en: "Rummikub" },
    basic: {
      win: { zh: "率先出完手牌就赢得本轮，多轮比赛以累计分数最高者获胜。", en: "Empty your rack first to win the round, and finish with the highest total score to win a multi-round match." },
      turn: { zh: "每回合从手牌组成新牌组或重排桌面，全部合法后结束回合，否则摸一张牌并结束回合。", en: "Build melds from your rack or rearrange the table and end with every meld legal, or draw one tile and end your turn." },
      key: { zh: "先用自己的牌凑足 30 点破冰，再利用桌面的组合尽可能多地出牌。", en: "Open with 30 points from your own rack, then use the table to shed as many tiles as possible." }
    },
    sections: [
      { id: "melds", label: { zh: "牌组与开局", en: "Melds & opening" }, html: {
        zh: "<p>2–4 人游玩。106 张牌包括红、蓝、橙、黑四色的 1–13，各两张，以及两张百搭牌(★)。每人 14 张，剩余作为牌池。首轮从第一座位开始，之后各轮起始座位依次轮换。</p><p>同数牌组需要 3–4 张数字相同、颜色不同的牌。顺子需要同色的 3–13 个连续数字，1 只能最小，不能在 13 后面接 1。花色同时用圆、菱形、三角和方形标记，方便辨色。</p><p>首次出牌必须完全使用自己手牌，合计至少 30 点，百搭牌计作替代的数字。破冰回合不能添加、拆分或借用桌面的牌。可以同时提交多个新牌组。</p>",
        en: "<p>Play with 2–4 players. There are 106 tiles: two copies of 1–13 in red, blue, orange and black, plus two jokers (★). Deal 14 tiles to each rack and keep the rest in the pool. Seat one starts the first round, and the starting seat rotates each round.</p><p>A group has 3–4 tiles of the same number in different colors. A run has 3–13 consecutive numbers in one color. One is always low and never follows 13. Circles, diamonds, triangles and squares also identify colors.</p><p>Your initial melds must use only your rack and total at least 30 points. A joker counts as the number it represents. You cannot extend, split or borrow from the table on your opening turn. Several new melds may be submitted together.</p>"
      } },
      { id: "joker", label: { zh: "重排与百搭", en: "Rearrange & jokers" }, html: {
        zh: "<p>破冰后可以添加、拆分、合并和重新组合桌面牌组，但原来桌面上的牌一张也不能拿回手牌，而且每回合至少放下一张手牌。结束时所有牌组都必须合法。</p><p>开局前可在 Room Control 选择百搭牌(★)规则，默认 Classic replacement（经典替换）。经典规则下，保留原牌组并保持百搭牌含义时可以延长牌组。若要取出百搭牌，必须用它代表的实体牌替换，保留原牌组其余实体牌，并立即将百搭牌与至少两张自己的手牌组成合法新组。四张同数组不能直接抽走百搭牌。</p><p>Free rearrangement（自由重排）下，破冰后可自由移动百搭牌并改变其代表值，无须先用实体牌替换，也不要求与两张手牌成组。所有原桌面牌仍须留在桌面，最终各组合法且至少打出一张手牌。两种规则都不能把桌面百搭牌收进手牌。当前规则显示在 Table 标题旁。</p><p>没有倒计时和超时罚牌。试摆可以反复撤销，不能完成时 Reset 恢复本回合，或摸一张结束。摸到的牌本回合不能再打出。牌池为空时按钮变成 Pass，所有人连续跳过后本轮结束。</p>",
        en: "<p>After opening, extend, split, merge and rebuild the table. Every existing table tile must remain on the table, and you must add at least one rack tile each turn. All final melds must be legal.</p><p>Choose the joker (★) rule in Room Control before starting. Classic replacement is the default. Extend a joker meld without changing its meaning or separating its natural tiles. To retrieve a joker, replace it with the natural tile it represents, keep the original natural tiles together, and immediately reuse the joker with at least two rack tiles. You cannot simply remove it from a four-tile group.</p><p>With Free rearrangement, after opening you may move table jokers and change their represented values without a natural replacement or two rack tiles. Keep every existing table tile on the table, leave all melds legal, and play at least one rack tile. Neither rule allows taking a table joker back to your rack. The current rule appears beside the Table heading.</p><p>There is no turn timer or time penalty. Experiment freely, reset the turn, or draw one tile and finish if you cannot complete your move. A drawn tile cannot be played that turn. With an empty pool, draw becomes Pass and a full cycle of consecutive passes ends the round.</p>"
      } },
      { id: "highlights", label: { zh: "变化高亮", en: "Highlights" }, html: {
        zh: "<p>金色手牌是自己最近摸到的牌。排序、折叠和对手行动不会清除标记，下次摸牌或这张牌打出时才会更新。</p><p>桌面金色标记本次新增的牌，蓝色虚线标记被移组、拆组或改变百搭含义的牌。试摆相对本回合开始的正式桌面累计比较，提交后保留标记，直到下一次桌面变化。悬停或用 Explain 点牌可查看原牌组和位置。撤销和重置会同步恢复对应标记。换轮、换房或换身份时会清空旧标记。</p>",
        en: "<p>Gold on your rack marks your most recently drawn tile. Sorting, hiding the rack and other players’ turns keep the mark until your next draw or that tile is played.</p><p>On the table, gold marks newly added tiles and blue dashed borders mark regrouped tiles or changed joker values. Trial layouts are compared with the committed table at the start of the turn. Marks remain after committing until the next table change. Hover or use Explain on a tile to see its previous meld and position. Undo and Reset restore the corresponding marks. A new round, room or viewer clears old marks.</p>"
      } },
      { id: "controls", label: { zh: "操作与计分", en: "Controls & scoring" }, html: {
        zh: "<p>手牌和紧凑按钮默认展开并固定在屏幕底部。Hide rack 收起为窄条，Show rack 重新展开，不会出牌、取消选牌或结束回合。桌面随页面展开，不需要内部拖动。点选牌后点 New meld 组成新组，或点已有牌组的 Add 按钮。破冰后也能移动桌面牌。To rack 只退回本回合自己的手牌。点击空白或按 Esc 取消选择。Undo 撤销一步，Reset 撤销本回合。Draw 摸一张并结束回合。</p><p>试摆公开给其他玩家观看，但其他手牌和牌池顺序始终隐藏。End turn 由服务器检查所有牌组。Help 支持中英文切换，Explain 解释控件而不会执行行动。</p><p>有人出完牌时，其他人按手牌数字扣分，百搭牌每张扣 30 分，赢家加上所有对手扣分之和。堵局时最低手牌点数者赢，各输家扣除与最低点数的差额，赢家分享这些分数，除不尽时按座位分配多出的 1 分。结算时公开所有手牌。非最终轮等待每位玩家点击 Next Round，机器人自动确认。可在房间配置中设置 1–8 轮。</p>",
        en: "<p>Your rack and compact controls start open and stay docked at the bottom. Hide rack folds them into a narrow bar, and Show rack opens them again without playing tiles, clearing selections or ending your turn. The table expands with the page instead of scrolling inside the board. Select tiles, then choose New meld or a meld’s Add button. After opening you may also move table tiles. To rack returns only tiles from your current-turn rack. Tap empty space or press Esc to deselect. Undo reverses one edit and Reset reverses the whole turn. Draw takes one tile and ends your turn.</p><p>Your trial layout is public so others can follow your turn, but other racks and the pool order stay hidden. End turn asks the server to validate all melds. Help switches between English and Chinese, and Explain describes controls without performing actions.</p><p>When someone goes out, opponents lose the sum of their rack numbers, counting each joker as 30. The winner gains all opponents’ losses. In a blocked round, the lowest rack total wins. Others lose the difference from that total, shared among tied winners with spare points assigned in seat order. All racks are revealed at settlement. Before another round, every player presses Next Round and bots confirm automatically. Room configuration supports 1–8 rounds.</p>"
      } }
    ]
  };
  const explanations = {
    rule: { zh: "本局的百搭牌规则在开局前选择，开始后不可更改。", en: "The joker rule is chosen before starting and cannot be changed during play." },
    pool: { zh: "牌池中剩余的暗牌张数。摸一张后立即结束回合，牌池为空则跳过。", en: "Number of hidden tiles left in the pool. Draw one and end your turn, or pass when it is empty." },
    new: { zh: "将选中的牌组成新牌组。最终需要 3–4 张不同色同数牌，或至少 3 张同色连续数字。", en: "Move selected tiles into a new meld. End with 3–4 different colors of one number or at least 3 consecutive numbers in one color." },
    return: { zh: "将选中的本回合手牌退回牌架。原本在桌面上的牌不能退回。", en: "Return selected tiles from your current-turn rack to the rack. Existing table tiles cannot be taken back." },
    undo: { zh: "撤销最近一次试摆。不会结束回合。", en: "Undo the most recent layout edit without ending your turn." },
    reset: { zh: "撤销本回合全部试摆，恢复原桌面和手牌。", en: "Discard all trial edits this turn and restore the original table and rack." },
    commit: { zh: "确认整个牌桌并结束回合。首次出牌必须用自己的牌达到 30 点。之后至少出一张手牌，全部牌组都要合法。", en: "Validate the entire table and end your turn. Initially play 30 points from your rack. Later add at least one rack tile and leave every meld legal." },
    draw: { zh: "撤销试摆，摸一张暗牌并结束回合。牌池为空则跳过。", en: "Discard the trial layout, draw one hidden tile and end your turn. Pass if the pool is empty." },
    sort: { zh: "仅调整自己牌架的显示顺序，不会透露手牌或消耗回合。", en: "Sort only your own rack display without revealing tiles or spending a turn." },
    rackToggle: { zh: "折叠或打开底部手牌与按钮，默认打开。不会改变选牌、试摆或回合。", en: "Hide or show the bottom rack and controls. Starts open and preserves selections, trial layouts and your turn." },
    tile: { zh: "数字牌用颜色和形状共同标记。点选后可以组新组或添加到其他牌组。百搭牌(★)可代替一个数字。", en: "Tiles use both color and shape. Select tiles to create or extend melds. A joker (★) can represent a missing number." },
    add: { zh: "将选中的牌移动到此牌组。可先试摆，再统一检查并结束回合。", en: "Move selected tiles into this meld. Experiment first, then validate the whole table with End turn." },
    next: { zh: "确认已看完结算。所有人都确认后才发下一轮，机器人自动确认。", en: "Confirm that you have reviewed the result. The next round starts only after everyone confirms. Bots confirm automatically." },
    player: { zh: "玩家的剩余手牌数、累计分数及是否完成 30 点破冰。金色底标记当前行动者。", en: "A player’s rack count, cumulative score and opening status. Gold marks the current player." }
  };
  let view = null;
  let table = [];
  let signature = "";
  let selected = new Set();
  let undo = [];
  let sortMode = "color";
  let pending = false;
  let pendingTimer = null;
  let tooltipTimer = null;
  let pointer = null;
  let suppressClick = false;
  let help = null;
  let explain = null;
  let activeRoom = null;
  let requestTurn = null;
  let requestKind = null;
  let requestTable = null;
  let passiveTile = null;
  let rackCollapsed = false;
  let rackScrollTop = 0;
  let rackOwner = "";
  let highlightScope = "";
  let highlightSnapshot = null;
  let drawnTiles = new Set();
  let committedChanges = new Map();
  let tableChanges = new Map();

  function resetHighlights() {
    highlightScope = "";
    highlightSnapshot = null;
    drawnTiles.clear();
    committedChanges.clear();
    tableChanges.clear();
  }

  function meldLocations(layout) {
    const locations = new Map();
    layout.forEach((meld, meldIndex) => {
      const ordered = orderedMeld(meld);
      const natural = meld.map(tileInfo).filter((tile) => tile.color !== "joker");
      const valid = meldValid(meld);
      const run = valid && new Set(natural.map((tile) => tile.number)).size > 1;
      const start = run ? Math.max(1, Math.max(...natural.map((tile) => tile.number)) - meld.length + 1) : 0;
      ordered.forEach((tile, tileIndex) => locations.set(tile, {
        meld: meldIndex + 1, position: tileIndex + 1, members: [...meld].sort().join(","),
        jokerValue: tileInfo(tile).color !== "joker" || !valid ? "" : run ? `${natural[0].color} ${start + tileIndex}` : String(natural[0].number)
      }));
    });
    return locations;
  }

  function tableDiff(before, after) {
    const previous = meldLocations(before);
    const current = meldLocations(after);
    const changes = new Map();
    after.forEach((meld) => {
      const retained = meld.filter((tile) => previous.has(tile)).sort().join(",");
      meld.forEach((tile) => {
        const origin = previous.get(tile), destination = current.get(tile);
        if (!origin) {
          changes.set(tile, { kind: "added", zh: `本次新增到桌面，位于牌组 ${destination.meld} 的第 ${destination.position} 张。`, en: `New on table · Meld ${destination.meld}, position ${destination.position}.` });
        } else if (origin.members !== retained || origin.jokerValue !== destination.jokerValue) {
          changes.set(tile, { kind: "changed", zh: `牌组或百搭含义发生变化，原为牌组 ${origin.meld} 的第 ${origin.position} 张，现为牌组 ${destination.meld} 的第 ${destination.position} 张。`, en: `Regrouped or joker value changed · was Meld ${origin.meld}, position ${origin.position}; now Meld ${destination.meld}, position ${destination.position}.` });
        }
      });
    });
    return changes;
  }

  function updateHighlights(next, scope) {
    if (highlightScope !== scope) { resetHighlights(); highlightScope = scope; }
    const hand = next.players.find((player) => player.player_id === next.you)?.hand || [];
    if (highlightSnapshot) {
      const previousHand = new Set(highlightSnapshot.hand);
      const added = hand.filter((tile) => !previousHand.has(tile));
      if (next.phase === "play" && highlightSnapshot.phase === "play" && added.length) drawnTiles = new Set(added);
      else drawnTiles = new Set([...drawnTiles].filter((tile) => hand.includes(tile)));
      const layoutKey = (layout) => JSON.stringify(layout.map((meld) => [...meld].sort()).sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second))));
      if (layoutKey(highlightSnapshot.table) !== layoutKey(next.table)) committedChanges = tableDiff(highlightSnapshot.table, next.table);
    }
    highlightSnapshot = { hand: [...hand], table: next.table.map((meld) => [...meld]), phase: next.phase };
  }

  function initWidgets() {
    if (help || typeof window.obgCreateHelp !== "function") return;
    help = window.obgCreateHelp(helpConfig);
    explain = window.obgCreateExplain({ gameId: "rummikub", attribute: "data-rummikub-explain", explanations: explanations,
      button: element("ExplainBtn"), root: () => panel, bypass: ["#rummikubHelpBtn", "#rummikubExplainBtn"] });
  }

  function tileInfo(tile) {
    const parts = tile.split("_");
    return { color: parts[0], number: parts[0] === "joker" ? 0 : Number(parts[1]) };
  }

  function sortTiles(tiles) {
    return [...tiles].sort((first, second) => {
      const left = tileInfo(first), right = tileInfo(second);
      const color = colors.indexOf(left.color) - colors.indexOf(right.color);
      const number = left.number - right.number;
      return (sortMode === "color" ? color || number : number || color) || first.localeCompare(second);
    });
  }

  function meldValid(meld) {
    if (meld.length < 3 || meld.length > 13) return false;
    const natural = meld.map(tileInfo).filter((tile) => tile.color !== "joker");
    if (!natural.length) return false;
    const numbers = new Set(natural.map((tile) => tile.number));
    const hues = new Set(natural.map((tile) => tile.color));
    if (meld.length <= 4 && numbers.size === 1 && hues.size === natural.length) return true;
    return hues.size === 1 && numbers.size === natural.length && Math.max(...numbers) - Math.min(...numbers) < meld.length;
  }

  function orderedMeld(meld) {
    const natural = meld.filter((tile) => tileInfo(tile).color !== "joker");
    const jokers = meld.filter((tile) => tileInfo(tile).color === "joker");
    if (!meldValid(meld) || new Set(natural.map((tile) => tileInfo(tile).number)).size === 1) return sortTiles(meld);
    const start = Math.max(1, Math.max(...natural.map((tile) => tileInfo(tile).number)) - meld.length + 1);
    return Array.from({ length: meld.length }, (_, index) => natural.find((tile) => tileInfo(tile).number === start + index) || jokers.shift());
  }

  function me() { return view?.players.find((player) => player.player_id === view.you); }
  function editable() { return !!view?.legal_actions.includes("commit") && !pending; }
  function tableEditable() { return editable() && !!me()?.opened; }
  function freeJokers() { return view?.joker_rule === "free"; }
  function syncDock() {
    const area = element("RackArea");
    const docked = view?.phase === "play" && !!me() && panel.getClientRects().length > 0;
    area.classList.toggle("is-docked", docked);
    area.classList.toggle("hidden", !!view && !me());
    const collapsed = docked && rackCollapsed;
    area.classList.toggle("is-collapsed", collapsed);
    element("RackBody").hidden = collapsed;
    element("RackToggle").hidden = !docked;
    element("RackToggle").textContent = collapsed ? "Show rack" : "Hide rack";
    element("RackToggle").setAttribute("aria-expanded", String(!collapsed));
    if (docked) {
      const bounds = panel.getBoundingClientRect();
      panel.style.setProperty("--rk-dock-left", Math.round(bounds.left) + "px");
      panel.style.setProperty("--rk-dock-width", Math.floor(bounds.width) + "px");
      panel.style.setProperty("--rk-dock-space", Math.ceil(area.getBoundingClientRect().height + 12) + "px");
    } else {
      panel.style.removeProperty("--rk-dock-space");
    }
  }
  function tileHTML(tile, interactive, fresh = false, change = null) {
    const info = tileInfo(tile);
    const label = info.color === "joker" ? "Joker" : info.color + " " + info.number;
    const explanationKey = "tile_" + tile;
    const colorName = { red: "红色", blue: "蓝色", orange: "橙色", black: "黑色" }[info.color];
    explanations[explanationKey] = info.color === "joker" ? {
      zh: "百搭牌(★)代替缺少的数字，破冰按代表数字计分，留在手里扣 30 分。" + (freeJokers() ? "当前自由重排：破冰后可自由移动并改变代表值，最终各组合法且至少出一张手牌。" : "当前经典替换：替换桌面百搭牌后，必须立即与至少两张本回合手牌重新成组。"),
      en: "Joker (★) represents a missing number for opening and costs 30 penalty points on your rack. " + (freeJokers() ? "Free rearrangement: after opening, move it freely and change its value. Leave all melds legal and play at least one rack tile." : "Classic replacement: replace a table joker with its natural tile, then reuse it with at least two rack tiles.")
    } : {
      zh: `${colorName} ${info.number}，以${marks[info.color]}辅助识别花色，留在手里扣 ${info.number} 分。可以组成不同色同数牌组或同色连续顺子。点选后使用 New meld 或 Add。`,
      en: `${label}, also marked ${marks[info.color]} for color identification. Worth ${info.number} penalty points on a rack. Combine it with different colors of the same number or consecutive numbers of this color. Select it, then use New meld or Add.`
    };
    if (change) {
      explanations[explanationKey].zh += " " + change.zh;
      explanations[explanationKey].en += " " + change.en;
    }
    const title = `${label} · ${change ? change.en : info.color === "joker" ? "Replaces a missing tile. Worth 30 penalty points on a rack." : "Number is its value. Shape also identifies its color."}`;
    return `<button type="button" class="rummikub-tile${selected.has(tile) ? " is-selected" : ""}${fresh ? " is-new" : ""}${change ? " is-" + change.kind : ""}" data-tile="${tile}" data-color="${info.color}" data-rummikub-explain="${explanationKey}" aria-label="${esc(label + (change ? " · " + change.en : ""))}" aria-pressed="${selected.has(tile)}" title="${esc(title)}" ${interactive ? "" : "disabled"}><span>${info.number || "★"}</span><small aria-hidden="true">${marks[info.color]}</small></button>`;
  }

  function render() {
    if (!view) return;
    tableChanges = (pending && requestKind === "reset") ? committedChanges
      : view.draft !== null || (pending && requestKind === "preview") ? tableDiff(view.table, table) : committedChanges;
    const positions = ["Rack", "Log"].map((suffix) => [suffix, suffix === "Rack" && rackCollapsed ? rackScrollTop : element(suffix).scrollTop]);
    const focusTile = panel.contains(document.activeElement) ? document.activeElement.dataset.tile : null;
    const active = view.players.find((player) => player.player_id === view.current_player);
    element("Status").textContent = view.phase === "play"
      ? `Round ${view.round}/${view.rounds} · ${view.you === view.current_player ? "Your turn" : (active?.name || "Player") + "’s turn"}${me() && !me().opened ? " · Opening: 30 points" : ""}`
      : view.game_over ? "Match complete" : `Round ${view.round} complete · Review the result`;
    element("Players").innerHTML = view.players.map((player) => `<div class="rummikub-player${player.player_id === view.current_player ? " is-current" : ""}" data-rummikub-explain="player" tabindex="0" title="${esc(player.name)}: ${player.count} tiles, ${player.score} points, ${player.opened ? "opened" : "not opened"}"><strong>${esc(player.name)}${player.player_id === view.you ? " · You" : ""}</strong><span>${player.count} tiles · ${player.score} pts · ${player.opened ? "Opened" : "Not opened"}</span></div>`).join("");
    element("Pool").textContent = `Pool · ${view.pool_count}`;
    element("Pool").title = `${view.pool_count} hidden tiles remain in the pool`;
    element("Rule").textContent = freeJokers() ? "Joker · Free" : "Joker · Classic";
    explanations.rule = freeJokers()
      ? { zh: "本局为自由重排。破冰后百搭牌可自由移动、改变代表值，无须实体替换或两张手牌配合。原桌面牌必须保留，最终各组合法且至少出一张手牌。", en: "Free rearrangement: after opening, move jokers and change their values without a replacement or two rack tiles. Keep all table tiles, leave every meld legal and play at least one rack tile." }
      : { zh: "本局为经典替换。取出桌面百搭牌须以代表的实体牌替换，原组其余牌保持在一起，再立即与至少两张手牌成组。", en: "Classic replacement: replace a table joker with its represented natural tile, keep the original natural tiles together, then immediately reuse it with at least two rack tiles." };
    element("Rule").title = explanations.rule.en;
    element("DraftLabel").textContent = view.draft !== null ? "· Trial layout" : "";
    const rack = new Set(me()?.hand || []);
    element("Melds").innerHTML = table.length ? table.map((meld, index) => `<div class="rummikub-meld${meldValid(meld) ? "" : " is-invalid"}"><div class="rummikub-meld-meta"><span>Meld ${index + 1} · ${meldValid(meld) ? "Valid" : "Incomplete"}</span><button type="button" data-add="${index}" data-rummikub-explain="add" ${editable() && selected.size && (tableEditable() || !meld.some((tile) => !rack.has(tile))) ? "" : "disabled"}>Add</button></div><div class="rummikub-meld-tiles">${orderedMeld(meld).map((tile) => tileHTML(tile, editable() && (rack.has(tile) || tableEditable()), rack.has(tile), tableChanges.get(tile))).join("")}</div></div>`).join("") : '<div class="rummikub-empty">Build your first meld<br><small>Groups of one number · Runs of one color</small></div>';
    const addedCount = [...tableChanges.values()].filter((change) => change.kind === "added").length;
    const changedCount = tableChanges.size - addedCount;
    element("Changes").classList.toggle("hidden", !tableChanges.size);
    element("Changes").innerHTML = `${addedCount ? `<span class="rummikub-change-added">Gold: ${addedCount} added</span>` : ""}${changedCount ? `<span class="rummikub-change-changed">Blue dashed: ${changedCount} regrouped</span>` : ""}`;
    const used = new Set(table.flat());
    const available = (me()?.hand || []).filter((tile) => !used.has(tile));
    element("Rack").innerHTML = sortTiles(available).map((tile) => tileHTML(tile, editable(), false, drawnTiles.has(tile) ? { kind: "drawn", zh: "这是你最近摸到的牌，金色标记会保留到下次摸牌或这张牌离开手牌。", en: "Most recently drawn tile. Gold stays until your next draw or this tile leaves your rack." } : null)).join("") || `<span class="rummikub-selection">${me() ? "No tiles left on your rack." : "Spectating · racks are private."}</span>`;
    element("RackTitle").textContent = `Your rack${me() ? " · " + available.length + " tiles" : ""}`;
    element("Selection").textContent = view.phase !== "play" ? "Round settled · all racks revealed" : selected.size ? `${selected.size} selected → New meld / Add / To rack` : "Select tiles → New meld / Add";
    element("New").disabled = !editable() || !selected.size;
    element("Return").disabled = !editable() || !selected.size || [...selected].some((tile) => !rack.has(tile)) || ![...selected].some((tile) => used.has(tile));
    element("Undo").disabled = !editable() || !undo.length;
    element("Reset").disabled = !editable() || JSON.stringify(table) === JSON.stringify(view.table);
    element("Commit").disabled = !editable() || !table.every(meldValid) || !table.flat().some((tile) => rack.has(tile));
    element("Draw").disabled = !editable();
    element("Draw").textContent = view.pool_count ? "Draw" : "Pass";
    element("Tools").classList.toggle("hidden", view.phase !== "play");
    element("Validation").textContent = view.draft_error || (pending ? "Sending…" : view.draft !== null ? "Trial layout shared. End turn to validate and commit." : "");
    element("Validation").classList.toggle("is-error", !!view.draft_error);
    element("Log").innerHTML = view.log.slice().reverse().map((text) => `<li>${esc(text)}</li>`).join("");
    renderResult();
    syncDock();
    positions.forEach(([suffix, top]) => { element(suffix).scrollTop = top; });
    if (focusTile) panel.querySelector(`[data-tile="${focusTile}"]`)?.focus({ preventScroll: true });
    explain?.refresh();
  }

  function renderResult() {
    const result = element("Result");
    result.classList.toggle("hidden", !view.round_result);
    if (!view.round_result) { result.innerHTML = ""; return; }
    const names = (ids) => ids.map((pid) => view.players.find((player) => player.player_id === pid)?.name || "Player").join(", ");
    result.innerHTML = `<h3>${view.game_over ? "Match winner: " + esc(names(view.winner)) : "Round winner: " + esc(names(view.round_result.winners))}</h3><p>${view.round_result.blocked ? "Blocked round · lowest rack total wins." : "Rack cleared."}</p>`
      + view.players.map((player) => `<div class="rummikub-result-row"><strong>${esc(player.name)}</strong> · ${view.round_result.changes[player.player_id] >= 0 ? "+" : ""}${view.round_result.changes[player.player_id]} pts · Total ${player.score}<div class="rummikub-result-rack">${(player.hand || []).map((tile) => tileHTML(tile, false)).join("")}</div></div>`).join("")
      + (view.game_over ? "" : `<button type="button" id="rummikubNext" data-rummikub-explain="next" ${view.legal_actions.includes("next_round") && !pending ? "" : "disabled"}>${view.ready.includes(view.you) ? "Waiting for players…" : "Next Round"}</button><p>${view.ready.length}/${view.players.length} ready</p>`);
  }

  function send(kind, layout) {
    const action = { type: kind, turn: view.turn };
    if (layout) action.table = layout;
    if (typeof sendAction !== "function") return;
    pending = true;
    requestTurn = view.turn;
    requestKind = kind;
    requestTable = layout ? JSON.stringify(layout) : null;
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => { pending = false; render(); }, 8000);
    sendAction(action);
  }

  function edit(target) {
    if (!editable() || !selected.size) return;
    undo.push(table.map((meld) => [...meld]));
    const picked = [...selected];
    const next = table.map((meld, index) => {
      const remaining = meld.filter((tile) => !selected.has(tile));
      return index === target ? [...remaining, ...picked] : remaining;
    });
    if (target === "new") next.push(picked);
    table = next.filter((meld) => meld.length);
    selected = new Set();
    send("preview", table);
    render();
  }

  function tooltip(node) {
    const text = node.title;
    if (!text) return;
    element("Tooltip").textContent = text;
    element("Tooltip").classList.remove("hidden");
    window.clearTimeout(tooltipTimer);
    tooltipTimer = window.setTimeout(() => element("Tooltip").classList.add("hidden"), 3000);
  }

  panel.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    suppressClick = false;
  });
  document.addEventListener("pointermove", (event) => {
    if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) suppressClick = true;
  });
  document.addEventListener("pointerup", () => { pointer = null; });
  document.addEventListener("pointercancel", () => { pointer = null; suppressClick = true; });
  document.addEventListener("pointerdown", (event) => {
    passiveTile = !explain?.isActive() ? event.target.closest("#rummikubPanel .rummikub-tile:disabled[title]") : null;
  }, true);
  document.addEventListener("pointerup", () => {
    if (passiveTile && !suppressClick && !explain?.isActive()) tooltip(passiveTile);
    passiveTile = null;
  });
  document.addEventListener("pointercancel", () => { passiveTile = null; });
  panel.addEventListener("click", (event) => {
    if (suppressClick) { suppressClick = false; return; }
    if (!view || explain?.isActive()) return;
    const button = event.target.closest("button");
    if (!button) {
      const described = event.target.closest("[title]");
      if (described) tooltip(described);
      if (selected.size) { selected.clear(); render(); }
      return;
    }
    if (button.disabled) return;
    if (button.id === "rummikubRackToggle") {
      if (!rackCollapsed) rackScrollTop = element("Rack").scrollTop;
      rackCollapsed = !rackCollapsed;
      syncDock();
      if (!rackCollapsed) element("Rack").scrollTop = rackScrollTop;
    } else if (button.dataset.tile) {
      const tile = button.dataset.tile;
      if (selected.has(tile)) selected.delete(tile); else selected.add(tile);
      render();
    } else if (button.dataset.add !== undefined) edit(Number(button.dataset.add));
    else if (button.id === "rummikubNew") edit("new");
    else if (button.id === "rummikubReturn") edit("rack");
    else if (button.id === "rummikubUndo" && undo.length) { table = undo.pop(); selected.clear(); send("preview", table); render(); }
    else if (button.id === "rummikubReset") { table = view.table.map((meld) => [...meld]); undo = []; selected.clear(); send("reset"); render(); }
    else if (button.id === "rummikubCommit") { send("commit", table); render(); }
    else if (button.id === "rummikubDraw") { send("draw"); render(); }
    else if (button.id === "rummikubNext") { send("next_round"); render(); }
    else if (button.id === "rummikubSortColor" || button.id === "rummikubSortNumber") { sortMode = button.id.endsWith("Color") ? "color" : "number"; render(); }
  });
  element("HelpBtn").addEventListener("click", () => { initWidgets(); explain?.exit(); help?.open(); });
  element("ExplainBtn").addEventListener("click", () => { initWidgets(); explain?.toggle(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { selected.clear(); element("Tooltip").classList.add("hidden"); if (view) render(); }
  });
  window.renderRummikubGameState = (data) => {
    const next = data?.view || data;
    if (next?.game_id !== "rummikub") return;
    if (typeof currentRoomState !== "undefined" && currentRoomState?.room_id && data.room_id && data.room_id !== currentRoomState.room_id) return;
    const nextOwner = JSON.stringify([data.room_id, next.you]);
    if (rackOwner !== nextOwner) { rackCollapsed = false; rackScrollTop = 0; rackOwner = nextOwner; }
    const nextSignature = JSON.stringify([data.room_id, next.turn, next.phase, next.you]);
    const sameTurn = pending && requestTurn === next.turn && signature === nextSignature;
    const acknowledged = !sameTurn
      || (requestKind === "preview" && JSON.stringify(next.draft) === requestTable)
      || (requestKind === "reset" && next.draft === null)
      || (requestKind === "next_round" && next.ready.includes(next.you));
    if (pending && !acknowledged) return;
    updateHighlights(next, JSON.stringify([data.room_id, next.round, next.you]));
    if (signature !== nextSignature) { selected.clear(); undo = []; }
    signature = nextSignature;
    view = next;
    table = (next.draft || next.table).map((meld) => [...meld]);
    pending = false;
    window.clearTimeout(pendingTimer);
    initWidgets();
    render();
  };
  window.showRummikubHeaderActions = (visible) => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) { view = null; signature = ""; selected.clear(); undo = []; pending = false; resetHighlights(); explain?.exit(); help?.close(); window.clearTimeout(pendingTimer); element("ConfigBox").classList.add("hidden"); element("Tooltip").classList.add("hidden"); }
    syncDock();
  };
  window.getRummikubConfig = () => ({ rounds: Number(element("Rounds").value), joker_rule: element("JokerRule").value });
  function syncRoom(room) {
    const visible = room?.game_type === "rummikub" && room.status === "lobby";
    element("ConfigBox").classList.toggle("hidden", !visible);
    element("ConfigBox").setAttribute("aria-hidden", String(!visible));
    if (room?.game_type !== "rummikub") return;
    if (activeRoom !== room.room_id) {
      element("Rounds").value = String(room.game_config?.rounds || 1);
      element("JokerRule").value = room.game_config?.joker_rule || "classic";
      activeRoom = room.room_id;
    }
    if (visible) {
      view = null;
      resetHighlights();
      rackCollapsed = false;
      rackScrollTop = 0;
      pending = false;
      signature = "";
      undo = [];
      selected.clear();
      window.clearTimeout(pendingTimer);
      element("Status").textContent = "Waiting to start · 2–4 players";
      element("Players").replaceChildren();
      element("Rack").replaceChildren();
      element("Melds").innerHTML = '<div class="rummikub-empty">Rummikub · Make every tile count</div>';
      element("Tools").classList.add("hidden");
      element("Result").classList.add("hidden");
      element("Selection").textContent = "Ready up, then start in Room Control.";
      element("Validation").textContent = "";
      element("Pool").textContent = "";
      element("Rule").textContent = "";
      element("DraftLabel").textContent = "";
      element("Changes").classList.add("hidden");
      element("Log").replaceChildren();
      element("RackTitle").textContent = "Your rack";
      syncDock();
    }
  }
  function connect() {
    initWidgets();
    if (typeof socket !== "undefined") {
      socket.on("room:state", syncRoom);
      socket.on("system:error", (data) => {
        if (!view) return;
        pending = false;
        window.clearTimeout(pendingTimer);
        render();
        element("Validation").textContent = data?.message || data?.error || "Action rejected. Check your melds and try again.";
        element("Validation").classList.add("is-error");
      });
    }
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload && typeof currentRoomState !== "undefined" && currentRoomState?.status !== "lobby") window.renderRummikubGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", connect, { once: true });
  else connect();
  window.addEventListener("resize", syncDock);
  if (typeof ResizeObserver === "function") {
    const dockObserver = new ResizeObserver(syncDock);
    dockObserver.observe(element("RackArea"));
    dockObserver.observe(panel);
  }
})();
