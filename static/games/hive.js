// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const HIVE_HELP_CONFIG = {
  gameId: "hive",
  title: { zh: "蜂群 · Hive", en: "Hive" },
  basic: {
    win: {
      zh: "把对方蜂后(🐝)周围的六个格子全部占满，你就赢下这一局。",
      en: "You win by filling all six hexes around the opposing Queen Bee (🐝)."
    },
    turn: {
      zh: "轮到你时，你要么从库存放一枚新棋子，要么移动一枚已经在场的己方棋子。",
      en: "On your turn you either place a new insect from your reserve or move one of your own insects already on the board."
    },
    key: {
      zh: "任何棋子被提起时，剩下的蜂群都必须保持连成一整块，所以每一步都同时在进攻和自保。",
      en: "Whenever an insect is lifted the rest of the hive must stay connected as a single piece, so every move is at once an attack and a defence."
    }
  },
  sections: [
    {
      id: "pieces",
      label: { zh: "棋子与胜负", en: "Pieces and goal" },
      html: {
        zh: "<p>每人 11 枚棋子：蜂后 Queen Bee(🐝) 一枚、甲虫 Beetle(🐞) 两枚、蚱蜢 Grasshopper(🦗) 三枚、蜘蛛 Spider(🕷️) 两枚、兵蚁 Soldier Ant(🐜) 三枚。白方 White(⚪) 先手，黑方 Black(⚫) 后手。</p>"
          + "<p>蜂后(🐝)周围的六个格子一旦被任意颜色的棋子占满，这位玩家立刻判负，哪怕压在它上面的是甲虫(🐞)。一步棋同时围住双方蜂后(🐝)则算和棋。</p>"
          + "<p>蜂后(🐝)必须在自己的第四回合或更早落地，在它落地之前你不能移动场上的任何棋子。</p>",
        en: "<p>Each player owns eleven insects: one Queen Bee (🐝), two Beetles (🐞), three Grasshoppers (🦗), two Spiders (🕷️) and three Soldier Ants (🐜). White (⚪) moves first and Black (⚫) second.</p>"
          + "<p>A Queen Bee (🐝) loses the moment all six neighbouring hexes are occupied by insects of any colour, even when a Beetle (🐞) is sitting on top of her. Surrounding both queens in one move is a draw.</p>"
          + "<p>Your Queen Bee (🐝) must reach the board on or before your fourth turn, and no insect may move until she is placed.</p>"
      }
    },
    {
      id: "placement",
      label: { zh: "放置规则", en: "Placing insects" },
      html: {
        zh: "<p>双方的第一枚棋子可以放在任意位置，也可以贴着对手落子。此后每一枚新棋子只能邻接自己的棋子，并且不能邻接任何敌方棋子。</p>"
          + "<p>新棋子只能放在地面，不能直接叠到别的棋子上，但可以直接放进一个符合颜色条件的封闭空格。</p>"
          + "<p>Classic 允许第一回合直接放蜂后(🐝)，Tournament Opening 则禁止双方在第一回合放蜂后(🐝)。房间配置里会写明当前使用哪一种开局。</p>",
        en: "<p>The very first insect of each player may go anywhere and may touch the opponent. Every later placement must touch at least one friendly insect and must not touch any enemy insect.</p>"
          + "<p>A new insect always lands on the ground. It can never be placed on top of a stack, but it may be dropped into an enclosed empty hex as long as the colour rule is satisfied.</p>"
          + "<p>Classic allows a Queen Bee (🐝) on the very first turn, while Tournament Opening forbids both players from opening with her. The room configuration states which opening is in use.</p>"
      }
    },
    {
      id: "movement",
      label: { zh: "五种移动", en: "The five moves" },
      html: {
        zh: "<ul>"
          + "<li>蜂后 Queen Bee(🐝)：沿蜂群边缘滑动一步。</li>"
          + "<li>甲虫 Beetle(🐞)：移动一步，可以爬上或爬下棋群，被它压住的棋子不能移动，一叠棋子的归属由最上面那枚决定。</li>"
          + "<li>蚱蜢 Grasshopper(🦗)：沿一条直线跳过至少一枚连续相邻的棋子，落在同一条直线上的第一个空格。</li>"
          + "<li>蜘蛛 Spider(🕷️)：沿蜂群边缘恰好滑动三步，不能重访走过的格子，全程都要贴着蜂群。</li>"
          + "<li>兵蚁 Soldier Ant(🐜)：沿蜂群边缘滑动任意步数，既不能穿过夹缝，也不能让蜂群断开。</li>"
          + "</ul>",
        en: "<ul>"
          + "<li>Queen Bee (🐝) slides exactly one step along the edge of the hive.</li>"
          + "<li>Beetle (🐞) moves one step and may climb onto or off the hive. An insect under a beetle cannot move, and the topmost insect decides who owns a stack.</li>"
          + "<li>Grasshopper (🦗) jumps in a straight line over at least one adjacent insect and lands on the first empty hex along that line.</li>"
          + "<li>Spider (🕷️) slides exactly three steps around the hive, never revisiting a hex and staying in contact the whole way.</li>"
          + "<li>Soldier Ant (🐜) slides any number of steps around the hive without squeezing through a gate or breaking the hive apart.</li>"
          + "</ul>"
      }
    },
    {
      id: "gates",
      label: { zh: "连通与通道", en: "Connection and gates" },
      html: {
        zh: "<p>提起一枚棋子之后，剩下的蜂群必须仍然连成一整块，不能先把它拆开、落下之后再接回去。</p>"
          + "<p>在地面移动的棋子必须始终贴着蜂群滑行，两侧都被堵住的夹缝无法穿过。</p>"
          + "<p>甲虫(🐞)按起点与终点中较高的那一层检查通道，当两侧的叠层都达到这个高度时它同样过不去。</p>"
          + "<p>蚱蜢(🦗)是唯一可以跳进封闭空格的棋子。</p>",
        en: "<p>Once an insect is lifted, the remaining hive must still form one connected piece. You may not break it apart and reconnect it after landing.</p>"
          + "<p>An insect moving on the ground must slide while staying in contact with the hive, and it cannot pass through a gate that is blocked on both sides.</p>"
          + "<p>A Beetle (🐞) checks the gate at the higher of its start and destination levels, so it is blocked when both flanks have reached that height.</p>"
          + "<p>The Grasshopper (🦗) is the only insect that can land inside an enclosed empty hex.</p>"
      }
    },
    {
      id: "ending",
      label: { zh: "结束与和棋", en: "Ending and draws" },
      html: {
        zh: "<p>只有在你既没有合法放置也没有合法移动时才可以 Pass，自愿跳过回合是不允许的。</p>"
          + "<p>双方连续两个回合都没有合法动作、同一局面第三次出现，或者双方通过 Offer Draw 与 Accept Draw 达成一致，都会判和。</p>"
          + "<p>对方提出和棋之后，你可以按 Decline 拒绝，也可以直接走出下一步来无视这个请求。</p>"
          + "<p>终局会保留棋盘供双方复盘，不会自动开始新的一局。</p>",
        en: "<p>Pass is only available when you have no legal placement and no legal move. Skipping voluntarily is not allowed.</p>"
          + "<p>The game is drawn when both players pass in a row, when the same position appears for the third time, or when one side offers a draw and the other accepts it.</p>"
          + "<p>After a draw offer you may press Decline to refuse it, or simply make your next move and ignore the request.</p>"
          + "<p>The final board is kept on screen for review and a new game never starts on its own.</p>"
      }
    },
    {
      id: "controls",
      label: { zh: "操作与标记", en: "Controls and markers" },
      html: {
        zh: "<p>先在库存里选一种棋子，或者点选一枚己方可以移动的棋子，再点一个虚线落点查看预览，最后按 Confirm 提交。</p>"
          + "<p>点击棋盘空白处或按 Esc 可以取消当前选择。棋盘支持拖动平移，加号与减号按钮控制缩放，Fit 把整个蜂群和所有落点一起收进画面。</p>"
          + "<p>金色轮廓表示选中的棋子，浅绿色轮廓表示最后一步的落点，左上角的金色小点表示这一叠里有蜂后(🐝)，右上角的乘号数字表示叠了几层。</p>"
          + "<p>在电脑上悬停棋子可以看到从底层到顶层的完整叠层说明，在手机上点一下也会弹出同样的说明。</p>",
        en: "<p>Pick an insect in your reserve or select one of your movable insects, then tap a dashed hex to preview the move and press Confirm to submit it.</p>"
          + "<p>Clicking empty space on the board or pressing Esc clears the current selection. Drag the board to pan, use the plus and minus buttons to zoom, and press Fit to frame the whole hive with every legal destination.</p>"
          + "<p>A golden outline marks the selected insect, a pale green outline marks the last landing hex, a small golden dot in the corner means a Queen Bee (🐝) is buried in that stack, and the number in the other corner counts the layers.</p>"
          + "<p>Hover an insect on a desktop, or tap it on a phone, to read the full stack from bottom to top.</p>"
      }
    }
  ]
};

const HIVE_EXPLAIN = {
  turn: {
    zh: "当前轮到谁行动，以及这是全局的第几手。",
    en: "Whose turn it is right now and which ply of the game is being played."
  },
  result: {
    zh: "本局的结果和结束原因。终局棋盘会保留下来供双方复盘。",
    en: "The result of this game and the reason it ended. The final board stays on screen for review."
  },
  queen_status: {
    zh: "蜂后(🐝)周围已经被占据的格子数。六个格子全部被占满时，这位玩家立刻判负。",
    en: "How many hexes around this Queen Bee (🐝) are already occupied. Filling all six loses the game at once."
  },
  destination: {
    zh: "这是一个合法落点。选中它之后按 Confirm 才会真正落子。",
    en: "This highlighted hex is a legal destination. Press Confirm to actually make the move."
  },
  piece_queen: {
    zh: "蜂后 Queen Bee(🐝)：沿蜂群边缘滑动一步。它周围的六个格子被占满时你就输掉本局。",
    en: "Queen Bee (🐝) slides one step along the edge of the hive. If all six hexes around her fill up, you lose the game."
  },
  piece_beetle: {
    zh: "甲虫 Beetle(🐞)：移动一步，可以爬上或爬下棋群。被它压住的棋子不能移动，一叠棋子的归属由最上面那枚决定。",
    en: "Beetle (🐞) moves one step and may climb onto or off the hive. Covered insects cannot move and the topmost insect decides who owns a stack."
  },
  piece_grasshopper: {
    zh: "蚱蜢 Grasshopper(🦗)：沿直线跳过至少一枚连续相邻的棋子，落在同一条直线上的第一个空格。",
    en: "Grasshopper (🦗) jumps in a straight line over at least one adjacent insect and lands on the first empty hex beyond it."
  },
  piece_spider: {
    zh: "蜘蛛 Spider(🕷️)：沿蜂群边缘恰好滑动三步，不能重访走过的格子，全程都要贴着蜂群。",
    en: "Spider (🕷️) slides exactly three steps around the hive without revisiting a hex and stays in contact the whole way."
  },
  piece_ant: {
    zh: "兵蚁 Soldier Ant(🐜)：沿蜂群边缘滑动任意步数，既不能穿过夹缝，也不能让蜂群断开。",
    en: "Soldier Ant (🐜) slides any number of steps around the hive without squeezing through a gate or breaking the hive apart."
  },
  reserve_count: {
    zh: "库存里还剩多少枚棋子可以放置，一整套棋子共 11 枚。",
    en: "How many insects are still waiting in the reserve. A complete set has eleven pieces."
  },
  hint: {
    zh: "针对当前局面给出的操作提示。",
    en: "A short hint about what to do in the current position."
  },
  selection: {
    zh: "你当前选中的棋子，以及它此刻有多少个合法落点。",
    en: "The insect you have selected and how many legal destinations it has right now."
  },
  confirm: {
    zh: "提交预览中的放置或移动。在你按下确认之前，棋盘不会有任何变化。",
    en: "Commit the previewed placement or move. Nothing changes on the board until you confirm."
  },
  pass: {
    zh: "只有在你既没有合法放置也没有合法移动时才能 Pass，不能自愿跳过回合。",
    en: "Pass is only legal when you have no legal placement and no legal move. You cannot skip voluntarily."
  },
  offer_draw: {
    zh: "向对手提出和棋。只有对方接受，本局才会以和棋结束。",
    en: "Offer a draw to your opponent. The game only ends in a draw if they accept."
  },
  accept_draw: {
    zh: "接受对方的和棋请求，本局立即以和棋结束。",
    en: "Accept the offered draw and end this game immediately."
  },
  decline_draw: {
    zh: "拒绝对方的和棋请求，对局继续进行。",
    en: "Decline the draw offer and keep playing."
  },
  zoom_in: {
    zh: "放大棋盘，方便看清单个棋子与叠层。",
    en: "Zoom in to inspect individual insects and stacks."
  },
  zoom_out: {
    zh: "缩小棋盘，让蜂群周围留出更多空间。",
    en: "Zoom out to see more space around the hive."
  },
  fit: {
    zh: "把整个蜂群和当前所有高亮落点一起收进棋盘画面。",
    en: "Fit the whole hive and every highlighted destination inside the board."
  },
  log: {
    zh: "按顺序记录双方的每一次落子与和棋交涉。",
    en: "A chronological record of every placement, move and draw negotiation."
  }
};

let hiveHelpWidget = null;
let hiveExplainWidget = null;

function initHiveHelpExplain() {
  if (hiveHelpWidget || typeof window.obgCreateHelp !== "function") return;
  hiveHelpWidget = window.obgCreateHelp(HIVE_HELP_CONFIG);
  hiveExplainWidget = window.obgCreateExplain({
    gameId: "hive",
    attribute: "data-hive-explain",
    explanations: HIVE_EXPLAIN,
    button: document.getElementById("hiveExplainBtn"),
    root: () => document.getElementById("hivePanel"),
    bypass: ["#hiveHelpBtn", "#hiveExplainBtn"]
  });
  document.getElementById("hiveHelpBtn")?.addEventListener("click", () => {
    hiveExplainWidget?.exit();
    hiveHelpWidget.open();
  });
  document.getElementById("hiveExplainBtn")?.addEventListener("click", () => hiveExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHiveHelpExplain);
} else {
  initHiveHelpExplain();
}

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
        svg += `<g transform="translate(${x} ${y})" data-hive-cell="${key}" role="button" tabindex="0" aria-label="Preview hex ${q}, ${r}" data-hive-explain="destination"><polygon points="${hex}" class="hive-target ${same(preview?.to, [q, r]) ? "hive-preview" : ""}"/>${same(preview?.to, [q, r]) ? '<circle r="5" class="hive-landing"/>' : ""}</g>`;
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
      svg += `<g transform="translate(${x} ${y})" class="hive-tile hive-tile-${top.color} ${selectable ? "hive-selectable" : ""} ${isSelected ? "hive-selected" : isLast ? "hive-last" : ""}" data-hive-cell="${key}" data-hive-explain="piece_${top.kind}" data-hive-tip="${description}" role="button" tabindex="0" aria-label="${description}">
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
        <div class="hive-player-stats"><span class="${player.queen_neighbors >= 4 ? "hive-danger" : ""}" tabindex="0" data-hive-explain="queen_status" data-hive-tip="${player.queen_position ? "Occupied hexes around this Queen Bee（🐝）, regardless of color." : "Place Queen Bee（🐝）by your fourth turn. No insects may move until she is placed."}">${queenStatus}</span></div>
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
      return `<button type="button" class="hive-reserve-piece" data-hive-piece="${kind}" data-hive-explain="piece_${kind}" aria-label="${view.piece_info[kind].name} ${names[kind]}, ${displayPlayer.reserve[kind]} remaining" aria-pressed="${selected?.type === "place" && selected.piece === kind}" ${enabled ? "" : "disabled"}><span class="hive-reserve-icon">${icons[kind]}</span><span class="hive-reserve-name">${names[kind]}</span><span class="hive-reserve-number">×${displayPlayer.reserve[kind]}</span></button>`;
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
    offer.innerHTML = view.draw_offer ? `<span>${escape(playerName(view.draw_offer))} offered a draw.</span>${available("accept_draw") ? '<div class="hive-tools"><button type="button" data-hive-draw="accept_draw" data-hive-explain="accept_draw">Accept</button><button type="button" data-hive-draw="decline_draw" data-hive-explain="decline_draw">Decline</button></div>' : ""}` : "";
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
    if (!target || target.contains(event.relatedTarget) || pan?.moved || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    showTip(target.dataset.hiveTip, target, false);
  });
  panel.addEventListener("pointerout", event => {
    const target = event.target.closest("[data-hive-tip]");
    if (target && !target.contains(event.relatedTarget) && event.pointerType !== "touch") hideTip();
  });
  panel.addEventListener("focusin", event => {
    if (event.target.dataset.hiveTip) showTip(event.target.dataset.hiveTip, event.target);
  });
  panel.addEventListener("focusout", hideTip);
  board.addEventListener("keydown", event => {
    const target = event.target.closest("[data-hive-cell]");
    if (target && ["Enter", " "].includes(event.key)) { event.preventDefault(); target.dispatchEvent(new MouseEvent("click", {bubbles: true})); }
  });
  board.addEventListener("pointerdown", event => {
    if (!camera || !event.isPrimary || event.button !== 0) return;
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
    zoom(event.deltaY > 0 ? 1.12 : 1 / 1.12);
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
  // Help and Explain now live in the shared widgets above.
  document.getElementById("hiveDialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const action = event.target.closest("[data-hive-dialog-action]");
    if (action) { dialog.close(); submit({type: action.dataset.hiveDialogAction}); return; }
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });
  // A fresh gesture is never the synthetic click that follows a board drag.
  document.addEventListener("pointerdown", () => { suppressClick = false; }, true);
  document.addEventListener("click", event => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden") || event.key !== "Escape") return;
    hideTip();
    if (dialog.open) return;
    endPan(); resetSelection(); render();
  });
  new ResizeObserver(() => { if (view && !panel.classList.contains("hidden")) fit(); }).observe(board);

  function clear() {
    endPan(); resetSelection();
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
