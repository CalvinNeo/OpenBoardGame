/* Bubble Shooter (泡泡龙) — client for game/bubble_shooter.py.
 *
 * The server owns the rules. This file only
 *   1. mirrors the shot geometry so the aim line and the landing ghost agree
 *      with what the server will actually do,
 *   2. replays the authoritative `last_shot` payload as an animation,
 *   3. sends `shoot` / `use_item` / `new_game` / `play_again` actions.
 *
 * Everybody plays their own board at the same time, so the layout gives the
 * whole centre to one board and keeps every score in the thin strip along the
 * top edge. Those score chips are also the spectator controls: click anyone and
 * the centre switches to their board, replaying their shots as they happen.
 * Click your own chip, or the back button, to return.
 *
 * Board coordinates are bubble diameters, exactly like the server: the board
 * element keeps an 11 / 14 aspect ratio, so x / 11 and y / 14 are percentages.
 */
(function () {
  "use strict";

  const GAME_ID = "bubble_shooter";
  const PANEL_ID = "bubbleShooterPanel";

  /* Geometry fallbacks; the real numbers always come from view.geometry. */
  const FALLBACK_GEO = {
    cols: 11,
    row_height: Math.sqrt(3) / 2,
    max_rows: 16,
    board_width: 11,
    board_height: 14,
    death_line_y: 11.6,
    shooter: [5.5, 12.95],
    max_angle: 82
  };

  const RAY_STEP = 0.06;
  const MAX_RAY_STEPS = 900;
  const COLLIDE_DIST = 0.94;
  const SNAP_SEARCH_ROWS = 3;
  const SHORT_AIM_UNITS = 2.4;
  const FLY_MS_PER_UNIT = 58;
  // A fast opponent can fire several shots between two renders. Replaying a
  // backlog would leave the spectator permanently behind, so past this gap we
  // snap straight to the authoritative board instead.
  const MAX_REPLAY_GAP = 2;

  const SYMBOLS = {
    red: "✕",
    orange: "▲",
    yellow: "★",
    green: "✚",
    blue: "●",
    purple: "◆",
    bomb: "💣",
    rainbow: "🌈"
  };

  const NEIGHBOR_DELTAS = {
    0: [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]],
    1: [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
  };

  const reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  /* ------------------------------------------------------------------ *
   * DOM
   * ------------------------------------------------------------------ */

  const el = (id) => document.getElementById(id);

  const bsHelpBtn = el("bubbleShooterHelpBtn");
  const bsExplainBtn = el("bubbleShooterExplainBtn");
  const headerActions = el("bubbleShooterHeaderActions");
  const board = el("bsBoard");
  const layer = el("bsLayer");
  const aimPath = el("bsAimPath");
  const ghost = el("bsGhost");
  const shooter = el("bsShooter");
  const watchTag = el("bsWatchTag");
  const flyEl = el("bsFly");
  const overlay = el("bsOverlay");
  const scoresBox = el("bsScores");
  const statsLabel = el("bsStatsLabel");
  const statsBox = el("bsStats");
  const backBtn = el("bsBackBtn");
  const queueBox = el("bsQueue");
  const hammerBtn = el("bsHammerBtn");
  const hammerCount = el("bsHammerCount");
  const aimBtn = el("bsAimBtn");
  const aimCount = el("bsAimCount");
  const angleValue = el("bsAngleValue");
  const restartBtn = el("bsRestartBtn");
  const statusBox = el("bsStatus");
  const lastShotBox = el("bsLastShot");
  const tipBox = el("bsTip");

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  let view = null;
  let activeId = null;          // whose board is on screen
  let displayGrid = null;       // what the layer currently paints for activeId
  let displayParity = 0;
  let lastShotId = 0;
  let animating = false;
  let pendingView = null;
  let angle = 0;
  let hammerArmed = false;
  let pointerActive = false;
  let activePointerId = null;
  let pendingAim = null;
  let aimFrame = 0;
  let helpWidget = null;
  let explainWidget = null;

  // Each board keeps its own painted snapshot, so switching between players
  // does not throw away what was already on screen for them.
  const painted = new Map();
  const cellEls = new Map();
  const cellKey = (row, col) => row + "," + col;

  const geo = () => (view && view.geometry) || FALLBACK_GEO;

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, reduceMotion.matches ? 0 : ms));
  }

  /* ------------------------------------------------------------------ *
   * Whose board is on screen
   * ------------------------------------------------------------------ */

  function fallbackBoard(source) {
    return {
      grid: source.grid || [],
      top_parity: source.top_parity || 0,
      queue: source.queue || [],
      items: source.items || {},
      aim_left: source.aim_left || 0,
      score: source.score || 0,
      combo: source.combo || 0,
      best_combo: source.best_combo || 0,
      shots: source.shots || 0,
      wave: source.wave || 0,
      push_countdown: source.push_countdown || 0,
      push_interval: source.push_interval || 0,
      popped_total: source.popped_total || 0,
      dropped_total: source.dropped_total || 0,
      last_shot: source.last_shot || null,
      shot_id: source.shot_id || 0,
      board_out: Boolean(source.board_out),
    };
  }

  function activeBoard() {
    if (!view) return null;
    const boards = view.boards;
    if (boards && activeId && boards[activeId]) return boards[activeId];
    return fallbackBoard(view);
  }

  const isMine = () => Boolean(view) && activeId === view.you;

  function playerLabel(pid) {
    const row = (view?.ranking || []).find((entry) => entry.player_id === pid);
    if (!row) return "Player";
    if (row.name) return row.name;
    if (row.seat != null) return "Seat " + (row.seat + 1);
    return "Player";
  }

  function loadPainted() {
    const entry = painted.get(activeId);
    displayGrid = entry ? entry.grid : null;
    displayParity = entry ? entry.parity : 0;
    lastShotId = entry ? entry.shotId : 0;
  }

  function savePainted() {
    if (!activeId) return;
    painted.set(activeId, { grid: displayGrid, parity: displayParity, shotId: lastShotId });
  }

  function switchTo(pid) {
    if (!view || !pid || pid === activeId) return;
    const boards = view.boards || {};
    if (!boards[pid]) return;
    activeId = pid;
    hammerArmed = false;
    animating = false;
    pendingView = null;
    pointerActive = false;
    activePointerId = null;
    pendingAim = null;
    if (flyEl) flyEl.hidden = true;
    if (board) board.classList.remove("is-shake");
    loadPainted();
    renderChrome(view);
    const snapshot = activeBoard();
    paintGrid(snapshot ? snapshot.grid : [], snapshot ? snapshot.top_parity : 0);
    savePainted();
    renderAim();
  }

  /* ------------------------------------------------------------------ *
   * Geometry mirrored from the server
   * ------------------------------------------------------------------ */

  const parityOf = (row, topParity) => (row + topParity) % 2;

  function rowWidth(row, topParity) {
    return parityOf(row, topParity) === 0 ? geo().cols : geo().cols - 1;
  }

  function center(row, col, topParity) {
    const offset = parityOf(row, topParity) ? 0.5 : 0;
    return [col + 0.5 + offset, (row + 0.5) * geo().row_height];
  }

  function neighbors(row, col, topParity) {
    const out = [];
    for (const [dRow, dCol] of NEIGHBOR_DELTAS[parityOf(row, topParity)]) {
      const r = row + dRow;
      const c = col + dCol;
      if (r >= 0 && r < geo().max_rows && c >= 0 && c < rowWidth(r, topParity)) out.push([r, c]);
    }
    return out;
  }

  function occupied(grid, topParity) {
    const cells = [];
    if (!grid) return cells;
    for (let row = 0; row < grid.length; row += 1) {
      for (let col = 0; col < grid[row].length; col += 1) {
        if (grid[row][col] == null) continue;
        const [x, y] = center(row, col, topParity);
        cells.push({ row, col, x, y });
      }
    }
    return cells;
  }

  function collides(cells, x, y) {
    const limit = COLLIDE_DIST * COLLIDE_DIST;
    for (const cell of cells) {
      if (Math.abs(cell.y - y) > COLLIDE_DIST) continue;
      const dx = cell.x - x;
      const dy = cell.y - y;
      if (dx * dx + dy * dy < limit) return cell;
    }
    return null;
  }

  function simulate(cells, angleDeg) {
    const g = geo();
    const radians = (angleDeg * Math.PI) / 180;
    let vx = Math.sin(radians);
    let vy = -Math.cos(radians);
    let x = g.shooter[0];
    let y = g.shooter[1];
    const left = 0.5;
    const right = g.board_width - 0.5;
    const path = [[x, y]];
    for (let step = 0; step < MAX_RAY_STEPS; step += 1) {
      x += vx * RAY_STEP;
      y += vy * RAY_STEP;
      if (x < left) {
        x = 1.0 - x;
        vx = -vx;
        path.push([x, y]);
      } else if (x > right) {
        x = 2.0 * right - x;
        vx = -vx;
        path.push([x, y]);
      }
      if (y <= 0.5) {
        y = 0.5;
        path.push([x, y]);
        break;
      }
      if (collides(cells, x, y)) {
        path.push([x, y]);
        break;
      }
    }
    return { path, x, y };
  }

  function snapCell(grid, topParity, x, y) {
    if (!grid || !grid.length) return null;
    const g = geo();
    const anchor = Math.floor(y / g.row_height);
    const start = Math.max(0, anchor - SNAP_SEARCH_ROWS);
    const stop = Math.min(g.max_rows, anchor + SNAP_SEARCH_ROWS + 2);
    let best = null;
    let bestDistance = null;
    for (let row = start; row < stop; row += 1) {
      const width = rowWidth(row, topParity);
      for (let col = 0; col < width; col += 1) {
        if (grid[row] && grid[row][col] != null) continue;
        if (row !== 0 && !neighbors(row, col, topParity).some(
          ([r, c]) => grid[r] && grid[r][c] != null
        )) continue;
        const [cx, cy] = center(row, col, topParity);
        const distance = (cx - x) ** 2 + (cy - y) ** 2;
        if (bestDistance === null || distance < bestDistance) {
          bestDistance = distance;
          best = [row, col];
        }
      }
    }
    return best;
  }

  /* ------------------------------------------------------------------ *
   * Painting
   * ------------------------------------------------------------------ */

  const colorClass = (value) => "is-" + value;

  function place(node, x, y) {
    const g = geo();
    node.style.left = (x / g.board_width) * 100 + "%";
    node.style.top = (y / g.board_height) * 100 + "%";
  }

  function makeBubble(row, col, value, topParity) {
    const node = document.createElement("div");
    node.className = "bs-bubble " + colorClass(value);
    node.textContent = SYMBOLS[value] || "";
    node.dataset.bsRow = String(row);
    node.dataset.bsCol = String(col);
    const [x, y] = center(row, col, topParity);
    place(node, x, y);
    return node;
  }

  function paintGrid(grid, topParity) {
    displayGrid = grid ? grid.map((row) => row.slice()) : null;
    displayParity = topParity;
    cellEls.clear();
    const frag = document.createDocumentFragment();
    if (grid) {
      for (let row = 0; row < grid.length; row += 1) {
        for (let col = 0; col < grid[row].length; col += 1) {
          const value = grid[row][col];
          if (value == null) continue;
          const node = makeBubble(row, col, value, topParity);
          cellEls.set(cellKey(row, col), node);
          frag.appendChild(node);
        }
      }
    }
    if (layer) layer.replaceChildren(frag);
  }

  function addBubble(row, col, value, topParity, extraClass) {
    const node = makeBubble(row, col, value, topParity);
    if (extraClass) node.classList.add(extraClass);
    cellEls.set(cellKey(row, col), node);
    if (layer) layer.appendChild(node);
    return node;
  }

  function retire(cells, className) {
    const nodes = [];
    for (const [row, col] of cells) {
      const key = cellKey(row, col);
      const node = cellEls.get(key);
      if (!node) continue;
      cellEls.delete(key);
      node.classList.add(className);
      nodes.push(node);
    }
    return nodes;
  }

  function dropNodes(nodes, delay) {
    window.setTimeout(() => nodes.forEach((node) => node.remove()), delay);
  }

  /* ------------------------------------------------------------------ *
   * Flight animation
   * ------------------------------------------------------------------ */

  function fly(path, value) {
    return new Promise((resolve) => {
      if (!flyEl || !path || path.length === 0 || reduceMotion.matches) {
        resolve();
        return;
      }
      flyEl.className = "bs-fly " + colorClass(value);
      flyEl.textContent = SYMBOLS[value] || "";
      flyEl.hidden = false;

      const segments = [];
      let total = 0;
      for (let i = 1; i < path.length; i += 1) {
        const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
        segments.push(d);
        total += d;
      }
      const duration = Math.max(170, Math.min(700, total * FLY_MS_PER_UNIT));
      const started = performance.now();

      function frame(now) {
        const t = Math.min(1, (now - started) / duration);
        const travelled = t * total;
        let acc = 0;
        let index = 0;
        while (index < segments.length && acc + segments[index] < travelled) {
          acc += segments[index];
          index += 1;
        }
        const from = path[Math.min(index, path.length - 1)];
        const to = path[Math.min(index + 1, path.length - 1)];
        const span = segments[index] || 0;
        const local = span ? (travelled - acc) / span : 0;
        place(flyEl, from[0] + (to[0] - from[0]) * local, from[1] + (to[1] - from[1]) * local);
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          flyEl.hidden = true;
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  /* ------------------------------------------------------------------ *
   * Shot replay
   * ------------------------------------------------------------------ */

  async function replay(next, snapshot, shot) {
    animating = true;
    renderChrome(next);
    const startedFor = activeId;

    if (shot.kind === "shoot") {
      await fly(shot.path, shot.color);
      if (activeId !== startedFor) {
        animating = false;
        return;
      }
      if (shot.cell) {
        addBubble(shot.cell[0], shot.cell[1], shot.color, displayParity, "is-landing");
      }
      await wait(130);
    }

    if (activeId !== startedFor) {
      animating = false;
      return;
    }

    const popped = (shot.popped || []).concat(shot.exploded || []);
    const poppedNodes = retire(popped, "is-pop");
    const droppedNodes = retire(shot.dropped || [], "is-fall");
    dropNodes(poppedNodes, 320);
    dropNodes(droppedNodes, 600);

    await wait(shot.pushed ? 520 : 470);

    if (activeId !== startedFor) {
      animating = false;
      return;
    }

    if (shot.pushed && board) {
      board.classList.add("is-shake");
      window.setTimeout(() => board.classList.remove("is-shake"), 300);
    }

    lastShotId = shot.id;
    paintGrid(snapshot.grid, snapshot.top_parity);
    savePainted();
    animating = false;
    renderChrome(next);
    renderAim();

    if (pendingView) {
      const queued = pendingView;
      pendingView = null;
      applyView(queued);
    }
  }

  /* ------------------------------------------------------------------ *
   * Aim line
   * ------------------------------------------------------------------ */

  function renderAim() {
    if (!view || !aimPath) return;
    if (shooter) shooter.style.setProperty("--bs-angle", angle - 90 + "deg");
    if (!canAct() || !displayGrid || !displayGrid.length) {
      aimPath.setAttribute("points", "");
      if (ghost) ghost.hidden = true;
      return;
    }

    const trace = simulate(occupied(displayGrid, displayParity), angle);
    const mine = activeBoard();
    const full = ((mine && mine.aim_left) || 0) > 0;

    let points = trace.path;
    if (!full) {
      const clipped = [points[0]];
      let travelled = 0;
      for (let i = 1; i < points.length; i += 1) {
        const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        if (travelled + d >= SHORT_AIM_UNITS) {
          const local = d ? (SHORT_AIM_UNITS - travelled) / d : 0;
          clipped.push([
            points[i - 1][0] + (points[i][0] - points[i - 1][0]) * local,
            points[i - 1][1] + (points[i][1] - points[i - 1][1]) * local
          ]);
          break;
        }
        travelled += d;
        clipped.push(points[i]);
      }
      points = clipped;
    }

    aimPath.setAttribute("points", points.map((p) => p[0].toFixed(3) + "," + p[1].toFixed(3)).join(" "));
    aimPath.classList.toggle("is-full", full);

    const landing = full ? snapCell(displayGrid, displayParity, trace.x, trace.y) : null;
    if (ghost) {
      if (landing) {
        const [x, y] = center(landing[0], landing[1], displayParity);
        place(ghost, x, y);
        ghost.hidden = false;
      } else {
        ghost.hidden = true;
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Chrome
   * ------------------------------------------------------------------ */

  function can(action) {
    return Boolean(view && Array.isArray(view.legal_actions) && view.legal_actions.includes(action));
  }

  // You can only aim, shoot and spend items on your own board.
  function canAct() {
    return isMine() && can("shoot") && !animating;
  }

  function span(className, text) {
    const node = document.createElement("span");
    node.className = className;
    node.textContent = text;
    return node;
  }

  /* The edge strip is the only place other people's numbers appear, and each
     chip doubles as the button that puts that player's board on screen. */
  function renderScores() {
    if (!scoresBox || !view) return;
    const ranking = Array.isArray(view.ranking) ? view.ranking : [];
    if (!ranking.length) {
      scoresBox.replaceChildren(span("bs-score-empty", "Waiting for players…"));
      return;
    }
    const nodes = ranking.map((row) => {
      const chip = document.createElement("button");
      const mine = row.player_id === view.you;
      const watching = row.player_id === activeId;
      chip.type = "button";
      chip.className = "bs-score"
        + (mine ? " is-you" : "")
        + (watching ? " is-watching" : "")
        + (row.out ? " is-out" : "")
        + (row.rank === 1 ? " is-leader" : "");
      chip.setAttribute("aria-pressed", String(watching));
      const label = mine ? "You" : playerLabel(row.player_id);
      chip.append(
        span("bs-score-rank", "#" + row.rank),
        span("bs-score-name", row.is_bot ? "🤖 " + label : label),
        span("bs-score-value", String(row.score)),
        span("bs-score-meta", row.out ? "OUT" : "W" + row.wave)
      );
      chip.addEventListener("click", () => switchTo(row.player_id));
      return chip;
    });
    if ((view.player_count || ranking.length) < 2) {
      nodes.push(span("bs-score-empty", "Solo run · share the room so others race the same seed"));
    }
    scoresBox.replaceChildren(...nodes);
  }

  function renderStats() {
    if (!statsBox || !view) return;
    const snapshot = activeBoard();
    if (!snapshot) return;
    if (statsLabel) statsLabel.textContent = isMine() ? "Your run" : "Watching " + playerLabel(activeId);
    const nodes = [span("bs-stat", "♾️ Wave " + snapshot.wave)];
    nodes.push(span("bs-stat is-big", "⭐ " + snapshot.score));
    if (snapshot.combo > 1) nodes.push(span("bs-stat is-hot", "🔥 x" + Math.min(snapshot.combo, 5)));
    if (snapshot.push_interval > 0) {
      const left = snapshot.push_countdown;
      nodes.push(span("bs-stat" + (left <= 2 ? " is-alert" : ""), "⬇️ Push in " + left));
    }
    nodes.push(span("bs-stat", "🎯 " + snapshot.shots + " shots"));
    statsBox.replaceChildren(...nodes);
  }

  function renderShooter() {
    if (!shooter || !view) return;
    const snapshot = activeBoard();
    const value = snapshot && snapshot.queue ? snapshot.queue[0] : null;
    shooter.className = "bs-shooter" + (value ? " " + colorClass(value) : "");
    shooter.textContent = value ? SYMBOLS[value] || "" : "";
  }

  function renderQueue() {
    if (!queueBox || !view) return;
    const snapshot = activeBoard();
    const queue = (snapshot && snapshot.queue) || [];
    const nodes = [];
    for (let i = 0; i < 3; i += 1) {
      const value = queue[i];
      const node = document.createElement("div");
      if (value == null) {
        node.className = "bs-queue-slot is-empty";
        node.textContent = "·";
      } else {
        node.className = "bs-queue-slot " + colorClass(value) + (i === 0 ? "" : " is-soon");
        node.textContent = SYMBOLS[value] || "";
      }
      nodes.push(node);
    }
    queueBox.replaceChildren(...nodes);
  }

  function renderItems() {
    if (!view) return;
    const snapshot = activeBoard();
    const items = (snapshot && snapshot.items) || {};
    const playable = canAct();
    if (hammerCount) hammerCount.textContent = String(items.hammer || 0);
    if (aimCount) aimCount.textContent = String(items.aim || 0);
    if (hammerBtn) {
      hammerBtn.disabled = !playable || (items.hammer || 0) <= 0;
      hammerBtn.classList.toggle("is-armed", hammerArmed);
    }
    if (aimBtn) {
      aimBtn.disabled = !playable || (items.aim || 0) <= 0;
      aimBtn.classList.toggle("is-active", ((snapshot && snapshot.aim_left) || 0) > 0);
    }
    if (board) {
      board.classList.toggle("is-hammer", hammerArmed);
      board.classList.toggle("is-watching", !isMine());
      board.classList.toggle("is-locked", isMine() && !playable && !hammerArmed);
    }
    if (watchTag) {
      watchTag.hidden = isMine();
      if (!isMine()) watchTag.textContent = "👁 " + playerLabel(activeId);
    }
    if (backBtn) backBtn.hidden = isMine();
  }

  function renderControls() {
    if (angleValue) {
      angleValue.textContent = isMine()
        ? (angle > 0 ? "+" : "") + angle.toFixed(0) + "°"
        : "—";
    }
    if (restartBtn) restartBtn.disabled = false;
  }

  function renderStatus() {
    if (!statusBox || !view) return;
    const snapshot = activeBoard();
    let text;
    if (view.game_over) {
      text = (view.winner_ids || []).includes(view.you)
        ? "🏆 Race over — you finished on top."
        : "🏁 Race over. The final standings are on the board.";
    } else if (!isMine()) {
      text = snapshot && snapshot.board_out
        ? "👁 " + playerLabel(activeId) + " is out. Pick someone else from the strip above."
        : "👁 Watching " + playerLabel(activeId) + ". Their shots replay here as they happen.";
    } else if (snapshot && snapshot.board_out) {
      text = "💥 Your stack crossed the line. Tap anyone above to watch them, or restart the match.";
    } else if (animating) {
      text = "…";
    } else if (hammerArmed) {
      text = "🔨 Hammer armed — tap a bubble to smash it.";
    } else if (snapshot && snapshot.aim_left > 0) {
      text = "🎯 Full trajectory on for " + snapshot.aim_left + " more shot(s).";
    } else if (snapshot && snapshot.push_interval > 0) {
      text = "Ceiling drops in " + snapshot.push_countdown + " shot(s). Move to aim, click to shoot.";
    } else {
      text = "Move the pointer over the board to aim, click to shoot.";
    }
    statusBox.textContent = text;
  }

  function renderLastShot() {
    if (!lastShotBox || !view) return;
    const snapshot = activeBoard();
    const shot = snapshot ? snapshot.last_shot : null;
    if (!shot) {
      lastShotBox.textContent = "No shot yet.";
      return;
    }
    const parts = [];
    if (shot.kind === "aim") {
      parts.push("🎯 Aim line extended for " + shot.aim_left + " shots.");
    } else if (shot.kind === "hammer") {
      parts.push("🔨 Hammer used.");
    } else {
      parts.push("Angle " + (shot.angle > 0 ? "+" : "") + shot.angle + "°.");
    }
    const popped = (shot.popped || []).length + (shot.exploded || []).length;
    if (popped) parts.push("Popped " + popped + ".");
    if ((shot.dropped || []).length) parts.push("Dropped " + shot.dropped.length + ".");
    if (shot.gain) parts.push("+" + shot.gain + " pts.");
    if (shot.combo > 1) parts.push("Combo x" + Math.min(shot.combo, 5) + ".");
    if (shot.pushed) parts.push("⬇️ The ceiling dropped a row.");
    if (!popped && !shot.gain && shot.kind === "shoot") parts.push("No match.");

    const bold = document.createElement("b");
    bold.textContent = "#" + shot.id + " ";
    lastShotBox.replaceChildren(bold, document.createTextNode(parts.join(" ")));
  }

  function overlayButton(label, primary, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (primary) button.classList.add("is-primary");
    button.addEventListener("click", onClick);
    return button;
  }

  function rankingList() {
    const list = document.createElement("div");
    list.className = "bs-overlay-list";
    const ranking = Array.isArray(view.ranking) ? view.ranking : [];
    const winners = new Set(view.winner_ids || []);
    ranking.forEach((row) => {
      const mine = row.player_id === view.you;
      const item = document.createElement("div");
      item.className = "bs-overlay-row"
        + (mine ? " is-you" : "")
        + (winners.has(row.player_id) ? " is-winner" : "");
      item.append(
        span("bs-overlay-rank", "#" + row.rank),
        span("bs-overlay-name", mine ? "You" : playerLabel(row.player_id)),
        span("bs-overlay-tag", row.out ? "OUT" : "Wave " + row.wave),
        span("bs-overlay-score", String(row.score))
      );
      list.appendChild(item);
    });
    return list;
  }

  function renderOverlay() {
    if (!overlay || !view) return;
    const snapshot = activeBoard();
    const out = Boolean(snapshot && snapshot.board_out);
    // Never cover somebody else's board with your own result panel.
    const show = Boolean(view.game_over || (isMine() && out));
    overlay.hidden = !show;
    if (!show) {
      overlay.replaceChildren();
      return;
    }

    const card = document.createElement("div");
    card.className = "bs-overlay-card";
    const emoji = document.createElement("div");
    emoji.className = "bs-overlay-emoji";
    const title = document.createElement("div");
    title.className = "bs-overlay-title";
    const body = document.createElement("div");
    body.className = "bs-overlay-body";
    const actions = document.createElement("div");
    actions.className = "bs-overlay-actions";

    if (view.game_over) {
      const won = (view.winner_ids || []).includes(view.you);
      emoji.textContent = won ? "🏆" : "🏁";
      title.textContent = won ? "You win the race!" : "Race over";
      body.textContent = "Final score " + view.score + " · wave " + view.wave
        + " · " + view.popped_total + " popped, " + view.dropped_total + " dropped.";
      actions.append(
        overlayButton("↺ Play again", true, () => sendAction({ type: "play_again" }))
      );
    } else {
      emoji.textContent = "💥";
      title.textContent = "Your board is out";
      body.textContent = "You reached wave " + view.wave + " with " + view.score
        + " points. Tap anyone in the strip above to watch them finish.";
      actions.append(
        overlayButton("↺ Restart match", true, () => sendAction({ type: "new_game" }))
      );
    }

    card.append(emoji, title, body, rankingList(), actions);
    overlay.replaceChildren(card);
  }

  function renderChrome(next) {
    view = next;
    renderScores();
    renderStats();
    renderQueue();
    renderShooter();
    renderItems();
    renderControls();
    renderStatus();
    renderLastShot();
    renderOverlay();
  }

  /* ------------------------------------------------------------------ *
   * View application
   * ------------------------------------------------------------------ */

  function applyView(next) {
    const boards = next.boards || {};
    if (!activeId || !boards[activeId]) {
      const fallback = next.you && boards[next.you]
        ? next.you
        : (next.ranking && next.ranking[0] ? next.ranking[0].player_id : next.you);
      activeId = fallback;
      loadPainted();
    }

    const snapshot = activeBoard();
    const shot = snapshot ? snapshot.last_shot : null;
    const shotId = snapshot ? snapshot.shot_id || 0 : 0;

    if (shotId < lastShotId) {
      // A restart rewound the counter for this board.
      displayGrid = null;
      lastShotId = 0;
    }

    const gap = shot ? shot.id - lastShotId : 0;
    const fresh = Boolean(shot && displayGrid && gap > 0 && gap <= MAX_REPLAY_GAP);

    if (!fresh) {
      lastShotId = shotId;
      pendingView = null;
      animating = false;
      renderChrome(next);
      paintGrid(snapshot ? snapshot.grid : [], snapshot ? snapshot.top_parity : 0);
      savePainted();
      renderAim();
      return;
    }

    if (animating) {
      pendingView = next;
      renderChrome(next);
      return;
    }

    if (shot.kind === "aim") {
      lastShotId = shot.id;
      renderChrome(next);
      paintGrid(snapshot.grid, snapshot.top_parity);
      savePainted();
      renderAim();
      return;
    }

    replay(next, snapshot, shot);
  }

  function renderGameState(data) {
    const next = data && data.view;
    if (!next) return;
    if (typeof currentGameType !== "undefined" && currentGameType !== GAME_ID) {
      currentGameType = GAME_ID;
      setGamePanelVisibility(GAME_ID);
    }
    applyView(next);
  }

  function showHeaderActions(visible) {
    if (headerActions) headerActions.style.display = visible ? "flex" : "none";
    if (!visible) {
      explainWidget?.exit();
      helpWidget?.close();
      hammerArmed = false;
      pointerActive = false;
      activePointerId = null;
    }
  }

  /* ------------------------------------------------------------------ *
   * Input
   * ------------------------------------------------------------------ */

  function toast(text) {
    if (!tipBox) return;
    tipBox.textContent = text;
    tipBox.hidden = false;
    tipBox.style.left = "50%";
    tipBox.style.top = "84px";
    tipBox.style.transform = "translateX(-50%)";
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => { tipBox.hidden = true; }, 2200);
  }

  function clampAngle(value) {
    const max = geo().max_angle;
    return Math.max(-max, Math.min(max, value));
  }

  function boardPoint(event) {
    const rect = board.getBoundingClientRect();
    const g = geo();
    return [
      ((event.clientX - rect.left) / rect.width) * g.board_width,
      ((event.clientY - rect.top) / rect.height) * g.board_height
    ];
  }

  function applyAim(px, py) {
    const g = geo();
    const dx = px - g.shooter[0];
    const dy = py - g.shooter[1];
    angle = clampAngle((Math.atan2(dx, -dy) * 180) / Math.PI);
    renderControls();
    renderAim();
  }

  function scheduleAim(event) {
    const rect = board.getBoundingClientRect();
    const g = geo();
    pendingAim = [
      ((event.clientX - rect.left) / rect.width) * g.board_width,
      ((event.clientY - rect.top) / rect.height) * g.board_height
    ];
    if (aimFrame) return;
    aimFrame = requestAnimationFrame(() => {
      aimFrame = 0;
      if (!pendingAim) return;
      applyAim(pendingAim[0], pendingAim[1]);
      pendingAim = null;
    });
  }

  function flushAim() {
    if (aimFrame) {
      cancelAnimationFrame(aimFrame);
      aimFrame = 0;
    }
    if (!pendingAim) return;
    applyAim(pendingAim[0], pendingAim[1]);
    pendingAim = null;
  }

  function onBoardChrome(event) {
    const target = event.target;
    return target instanceof Element && Boolean(target.closest(".bs-board-items"));
  }

  function insideBoard(event) {
    const rect = board.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  function cellAt(px, py) {
    const g = geo();
    const snapshot = activeBoard();
    const parity = snapshot ? snapshot.top_parity : 0;
    let best = null;
    let bestDistance = null;
    for (let row = 0; row < g.max_rows; row += 1) {
      const width = rowWidth(row, parity);
      for (let col = 0; col < width; col += 1) {
        const [cx, cy] = center(row, col, parity);
        const distance = (cx - px) ** 2 + (cy - py) ** 2;
        if (bestDistance === null || distance < bestDistance) {
          bestDistance = distance;
          best = [row, col];
        }
      }
    }
    return bestDistance !== null && bestDistance <= 0.36 ? best : null;
  }

  function shoot() {
    if (!canAct()) return;
    sendAction({ type: "shoot", angle: Math.round(angle * 100) / 100 });
  }

  function useHammerAt(event) {
    const [px, py] = boardPoint(event);
    const target = cellAt(px, py);
    if (!target) {
      toast("Tap a bubble to smash it.");
      return;
    }
    const [row, col] = target;
    const snapshot = activeBoard();
    const grid = snapshot && snapshot.grid;
    if (!grid || !grid[row] || grid[row][col] == null) {
      toast("That cell is empty.");
      return;
    }
    hammerArmed = false;
    renderItems();
    renderStatus();
    sendAction({ type: "use_item", item: "hammer", row, col });
  }

  if (board) {
    // A mouse aims while it merely hovers; touch and pen aim while pressed.
    // Either way the shot leaves on release inside the board, and releasing
    // outside the board cancels instead of firing.
    board.addEventListener("pointermove", (event) => {
      if (!view || onBoardChrome(event)) return;
      if (event.pointerType !== "mouse" && !pointerActive) return;
      if (!canAct()) return;
      scheduleAim(event);
    });

    board.addEventListener("pointerdown", (event) => {
      if (!view || !event.isPrimary) return;
      if (event.button !== undefined && event.button !== 0) return;
      if (onBoardChrome(event)) return;
      if (!isMine()) return;
      pointerActive = true;
      activePointerId = event.pointerId;
      board.setPointerCapture?.(event.pointerId);
      if (hammerArmed) {
        pointerActive = false;
        activePointerId = null;
        useHammerAt(event);
        return;
      }
      if (canAct()) scheduleAim(event);
      event.preventDefault();
    });

    board.addEventListener("pointerup", (event) => {
      if (!pointerActive || event.pointerId !== activePointerId) return;
      if (onBoardChrome(event)) return;
      pointerActive = false;
      activePointerId = null;
      board.releasePointerCapture?.(event.pointerId);
      if (hammerArmed || !insideBoard(event) || !canAct()) return;
      scheduleAim(event);
      flushAim();
      shoot();
    });

    board.addEventListener("pointercancel", () => {
      pointerActive = false;
      activePointerId = null;
    });

    board.addEventListener("keydown", (event) => {
      if (!view) return;
      if (!canAct()) return;
      const step = event.shiftKey ? 0.5 : 2;
      if (event.key === "ArrowLeft") {
        angle = clampAngle(angle - step);
        renderControls();
        renderAim();
        event.preventDefault();
      } else if (event.key === "ArrowRight") {
        angle = clampAngle(angle + step);
        renderControls();
        renderAim();
        event.preventDefault();
      } else if (event.key === " " || event.key === "Enter") {
        shoot();
        event.preventDefault();
      } else if (event.key === "Escape" && hammerArmed) {
        hammerArmed = false;
        renderItems();
        renderStatus();
      }
    });
  }

  hammerBtn?.addEventListener("click", () => {
    if (!canAct()) return;
    const snapshot = activeBoard();
    if (((snapshot && snapshot.items) || {}).hammer <= 0) {
      toast("No hammer charges left.");
      return;
    }
    hammerArmed = !hammerArmed;
    renderItems();
    renderStatus();
  });

  aimBtn?.addEventListener("click", () => {
    if (!canAct()) return;
    const snapshot = activeBoard();
    if (((snapshot && snapshot.items) || {}).aim <= 0) {
      toast("No aim charges left.");
      return;
    }
    sendAction({ type: "use_item", item: "aim" });
  });

  backBtn?.addEventListener("click", () => switchTo(view?.you));

  restartBtn?.addEventListener("click", () => {
    sendAction({ type: "new_game" });
  });

  /* ------------------------------------------------------------------ *
   * Help & Explain
   * ------------------------------------------------------------------ */

  const HELP_CONFIG = {
    gameId: GAME_ID,
    title: { zh: "泡泡龙 · Bubble Shooter", en: "Bubble Shooter" },
    basic: {
      win: {
        zh: "每个人打自己的板，同时进行。全员压线出局后按总分排名，最高分获胜，同分并列。",
        en: "Everybody plays their own board at the same time. Once every board is out, the highest score wins and equal scores share the win."
      },
      turn: {
        zh: "鼠标移到棋盘上就跟着瞄准，点击发射。触摸时按住拖动瞄准，松手发射，在棋盘外松手可以取消。",
        en: "A mouse aims as it moves over the board and fires on click. On touch, press and drag to aim, release to fire, or release outside the board to cancel."
      },
      key: {
        zh: "所有人用同一个种子，所以地图、泡泡序列和天花板下压完全一致，比的是谁打得更好。关键是把泡泡送到同色堆里凑够三颗，让上方失去连接的泡泡整片掉下来。",
        en: "Everyone shares one seed, so the map, the bubble queue and the ceiling pushes are identical and only skill decides the winner. The key is landing a bubble so three or more of the same colour connect, which drops everything that loses its anchor."
      }
    },
    sections: [
      {
        id: "flow",
        label: { zh: "消除与掉落", en: "Clearing and drops" },
        html: {
          zh: "<p>泡泡从底部发射器射出，会在左右墙上反弹，撞到泡泡堆或顶部就停下并吸附到最近的空位。</p>"
            + "<p>落点与同色泡泡相连达到三颗或更多时，这一整片同色泡泡一起爆掉。</p>"
            + "<p>爆掉之后，所有不再与顶部相连的泡泡都会掉出棋盘。掉落每颗 25 分，消球每颗 10 分。</p>"
            + "<p>连续成功消除会累积连击，倍率最高五倍。空放一枪则连击归零。</p>"
            + "<p>清空整块板会立刻补上更厚的一波，并额外奖励 300 分。</p>",
          en: "<p>A bubble leaves the shooter at the bottom, bounces off the side walls and stops when it touches the stack or the ceiling, snapping into the nearest free cell.</p>"
            + "<p>If the landing spot connects three or more bubbles of the same colour, that whole connected group pops.</p>"
            + "<p>After a pop, every bubble no longer connected to the ceiling falls off the board. A dropped bubble is worth 25 points, a popped one 10.</p>"
            + "<p>Consecutive clears build a combo worth up to five times the score, and a shot that clears nothing resets it.</p>"
            + "<p>Clearing the whole board immediately brings a thicker wave and a 300 point bonus.</p>"
        }
      },
      {
        id: "race",
        label: { zh: "多人比赛", en: "The race" },
        html: {
          zh: "<p>每个人有自己的棋盘、自己的队列和自己的道具次数，谁也挡不住谁，所有板同时推进。</p>"
            + "<p>同一个种子决定了每一波的布局、泡泡序列和天花板下压，因此所有人面对的地图完全相同。</p>"
            + "<p>顶部边缘的细条是唯一的记分板，按名次排列所有人，你自己的那条会高亮。</p>"
            + "<p>点一下细条里任何一个人的名字，中央就会切换成他的棋盘，他的每一发都会照样播出来。点自己的名字或按返回键就回到自己的板。</p>"
            + "<p>观战时不能瞄准也不能用道具，那块板完全属于正在打的人。</p>"
            + "<p>你的板压线之后你就出局了，但比赛继续，直到最后一个人也出局才结算。</p>",
          en: "<p>Every player has their own board, queue and item charges. Nobody can block anybody, and all boards advance at once.</p>"
            + "<p>One seed decides every wave, the bubble queue and the ceiling pushes, so everybody faces exactly the same map.</p>"
            + "<p>The thin strip along the top edge is the only scoreboard. It lists everyone by rank, with your own entry highlighted.</p>"
            + "<p>Tap anyone in that strip and the centre switches to their board, replaying their shots as they happen. Tap your own name, or the back button, to return.</p>"
            + "<p>While watching you cannot aim or spend items, because that board belongs to whoever is playing it.</p>"
            + "<p>When your stack crosses the line you are out, but the race continues until the last board falls.</p>"
        }
      },
      {
        id: "specials",
        label: { zh: "特殊泡泡", en: "Special bubbles" },
        html: {
          zh: "<p>炸弹(💣)落点即爆，会炸掉周围一整圈泡泡，不用凑三连。</p>"
            + "<p>彩虹(🌈)是万能色，会自动当成周围最多的那种颜色参与消除。</p>"
            + "<p>特殊泡泡会混在发射队列里，看队列就知道下一颗是什么。</p>",
          en: "<p>A bomb(💣) explodes where it lands and takes out a whole ring of neighbours, no match needed.</p>"
            + "<p>A rainbow(🌈) is wild and counts as whichever neighbouring colour is most common.</p>"
            + "<p>Specials appear in the firing queue, so check the queue to see what is coming.</p>"
        }
      },
      {
        id: "items",
        label: { zh: "道具", en: "Items" },
        html: {
          zh: "<p>锤子(🔨)：按一下进入待发状态，再点棋盘上任意一颗泡泡直接敲掉它，上方失去连接的泡泡会跟着掉下来。</p>"
            + "<p>瞄准线(🎯)：按一下之后，接下来三发都会显示完整反弹轨迹和落点虚线圈。</p>"
            + "<p>道具按钮就在棋盘左下角，和棋盘在同一屏内，所以锤子可以按完立刻点目标。</p>"
            + "<p>次数在开局时发放，用完不再补充。</p>",
          en: "<p>Hammer(🔨): press it to arm, then tap any bubble on the board to smash it outright, and anything above that loses its anchor falls too.</p>"
            + "<p>Aim line(🎯): press it and the next three shots show the full bouncing trajectory plus a dashed circle on the landing cell.</p>"
            + "<p>The item chips sit in the bottom left corner of the board, on the same screen as the board, so the hammer is always one tap from its target.</p>"
            + "<p>Charges are granted at the start of the match and never come back.</p>"
        }
      },
      {
        id: "pressure",
        label: { zh: "压迫与结束", en: "Pressure and ending" },
        html: {
          zh: "<p>棋盘上有一条红色警戒线。任何一颗泡泡越过这条线，你的这一局立刻结束。</p>"
            + "<p>每若干发之后天花板会整体下压一行，右上角会提示还剩几发。间隔可以在开局设置里调整，也可以关掉。</p>"
            + "<p>出局之后棋盘会停住并盖上结算面板，你可以点别人继续观战，也可以重开整场比赛。</p>",
          en: "<p>A red warning line runs across the board. As soon as any bubble sits below it, your run ends immediately.</p>"
            + "<p>Every few shots the ceiling pushes down a row, and the counter shows how many shots are left. The interval is configurable at setup and can be switched off.</p>"
            + "<p>After you are out your board freezes behind a summary panel, so you can tap someone else to keep watching, or restart the whole match.</p>"
        }
      }
    ]
  };

  const EXPLAIN = {
    scoreboard: {
      zh: "边缘记分板，也是观战入口。所有人的分数只在这里出现，按名次排列。点任何一个人的名字，中央就切换成他的棋盘并实时播放他的操作。",
      en: "The edge scoreboard, and the way in to spectating. Every score appears here and nowhere else, ordered by rank. Tap anyone's name to put their board in the centre and watch their moves live."
    },
    board: {
      zh: "当前显示的棋盘。是你自己的板时可以瞄准发射；观战时只播放别人的操作，不能操作。泡泡会在左右墙上反弹。",
      en: "The board on screen. On your own board you can aim and fire, while spectating it only replays someone else's moves. Bubbles bounce off the side walls."
    },
    death_line: {
      zh: "警戒线。任何一颗泡泡越过这条线，这一局就结束了。",
      en: "The warning line. As soon as any bubble crosses it, that run is over."
    },
    shooter: {
      zh: "发射器。炮管指向当前角度，射出的泡泡就是队列里的第一颗。",
      en: "The shooter. The barrel points at the current angle, and it fires the first bubble shown in the queue."
    },
    items: {
      zh: "道具按钮，就在棋盘左下角，和目标泡泡在同一屏内。观战时会显示被观看者的剩余次数但不能点击。",
      en: "The item chips, in the bottom left of the board so they share the screen with their targets. While spectating they show the watched player's charges but cannot be pressed."
    },
    hammer: {
      zh: "锤子(🔨)。按一下进入待发状态，再点棋盘上任意一颗泡泡把它直接敲掉，上方失去连接的泡泡会跟着掉落。",
      en: "Hammer(🔨). Press to arm it, then tap any bubble on the board to smash it. Anything above that loses its anchor falls as well."
    },
    aim: {
      zh: "瞄准线(🎯)。按一下之后接下来三发会显示完整反弹轨迹和落点虚线圈。",
      en: "Aim line(🎯). Press it and the next three shots show the full bouncing trajectory plus a dashed circle on the landing cell."
    },
    mine: {
      zh: "当前这块板的数据：波数、总分、连击倍率、距离天花板下压还有几发、已经打了多少发。看自己的板时标题是 Your run，观战时会变成 Watching 加对方名字。",
      en: "The numbers for the board on screen: the wave, the score, the combo multiplier, how many shots until the ceiling pushes, and how many shots have been fired. The heading reads Your run on your own board and Watching plus a name while spectating."
    },
    back: {
      zh: "回到自己的棋盘。观战时随时可以点这个，或者直接点记分板里自己的名字。",
      en: "Return to your own board. Press this any time while spectating, or just tap your own name in the scoreboard."
    },
    queue: {
      zh: "发射队列。最大的一颗是当前要射的，后面两颗是接下来两颗，其中可能混有炸弹(💣)和彩虹(🌈)。",
      en: "The firing queue. The large one is loaded now and the two smaller ones come next, and they may include bombs(💣) and rainbows(🌈)."
    },
    angle: {
      zh: "当前角度读数。0° 是正上方，正数偏右，负数偏左。角度完全由指针在棋盘上的位置决定，观战时显示为一条横线。",
      en: "The current angle readout. 0° is straight up, positive angles lean right and negative angles lean left. The angle follows the pointer on the board, and shows a dash while spectating."
    },
    restart: {
      zh: "重开整场比赛。所有人的棋盘都会用同一个种子重新开始。",
      en: "Restart the whole match. Every board starts over from the same seed."
    },
    last_shot: {
      zh: "当前这块板上一发的结果：角度、消掉几颗、掉落几颗、得了多少分，以及天花板有没有下压。观战时这里就是对方最近一发的战报。",
      en: "The result of the previous shot on the board on screen: the angle, how many popped, how many dropped, the points gained, and whether the ceiling pushed. While spectating this is the other player's latest shot."
    }
  };

  function initHelpExplain() {
    if (helpWidget || typeof window.obgCreateHelp !== "function") return;
    helpWidget = window.obgCreateHelp(HELP_CONFIG);
    explainWidget = window.obgCreateExplain({
      gameId: GAME_ID,
      attribute: "data-bs-explain",
      explanations: EXPLAIN,
      button: bsExplainBtn,
      root: () => document.getElementById(PANEL_ID),
      bypass: ["#bubbleShooterHelpBtn", "#bubbleShooterExplainBtn"]
    });
    bsHelpBtn?.addEventListener("click", () => {
      explainWidget?.exit();
      helpWidget.open();
    });
    bsExplainBtn?.addEventListener("click", () => explainWidget?.toggle());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHelpExplain);
  } else {
    initHelpExplain();
  }

  window.renderBubbleShooterGameState = renderGameState;
  window.showBubbleShooterHeaderActions = showHeaderActions;
})();
