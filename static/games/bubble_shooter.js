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
  const FLY_MS_PER_UNIT = 34;
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
  const panel = el(PANEL_ID);
  const board = el("bsBoard");
  const layer = el("bsLayer");
  const aimPath = el("bsAimPath");
  const ghost = el("bsGhost");
  const shooter = el("bsShooter");
  const launcher = el("bsLauncher");
  const effects = el("bsEffects");
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
  const soundBtn = el("bsSoundBtn");
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
  let replayVersion = 0;
  let flightActive = false;
  let pendingAction = null;
  let actionTimer = 0;
  let pointerStart = null;
  let activeRoomId = null;
  let audioContext = null;
  let soundEnabled = false;

  try {
    soundEnabled = window.localStorage.getItem("bsSoundEnabled") === "true";
  } catch {}

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

  // Always take the source explicitly. Reading the module-level `view` here
  // would hand back the *previous* state while a new one is being applied,
  // which made the board and the replayed shot lag one update behind and fired
  // a different bubble than the shooter was showing.
  function boardOf(source, pid) {
    if (!source) return null;
    const boards = source.boards;
    if (boards && pid && boards[pid]) return boards[pid];
    return fallbackBoard(source);
  }

  function activeBoard() {
    return boardOf(view, activeId);
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
    cancelReplay();
    cancelPointer();
    activeId = pid;
    hammerArmed = false;
    loadPainted();
    renderChrome(view);
    const snapshot = activeBoard();
    lastShotId = snapshot ? snapshot.shot_id || 0 : 0;
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
      if (className === "is-fall") {
        node.style.setProperty("--bs-drift", ((col % 3) - 1) * 5 + "cqw");
        node.style.animationDelay = Math.min(nodes.length * 12, 90) + "ms";
      }
      node.classList.add(className);
      nodes.push(node);
    }
    return nodes;
  }

  function dropNodes(nodes, delay) {
    window.setTimeout(() => nodes.forEach((node) => node.remove()), delay);
  }

  function cancelReplay() {
    replayVersion += 1;
    animating = false;
    flightActive = false;
    pendingView = null;
    if (flyEl) flyEl.hidden = true;
    if (shooter) shooter.hidden = false;
    effects?.replaceChildren();
    launcher?.classList.remove("is-firing");
    board?.classList.remove("is-shake");
  }

  function effect(className, position, value, lifetime) {
    if (!effects || reduceMotion.matches || effects.childElementCount >= 96) return null;
    const node = document.createElement("div");
    node.className = className + " " + colorClass(value || "blue");
    place(node, position[0], position[1]);
    effects.appendChild(node);
    window.setTimeout(() => node.remove(), lifetime);
    return node;
  }

  function burst(position, value, count = 8) {
    for (let index = 0; index < count; index += 1) {
      const particle = effect("bs-spark", position, value, 470);
      if (!particle) break;
      const direction = (index / count) * Math.PI * 2;
      const distance = 3 + (index % 3) * 1.4;
      particle.style.setProperty("--bs-dx", Math.cos(direction) * distance + "cqw");
      particle.style.setProperty("--bs-dy", Math.sin(direction) * distance + "cqw");
    }
  }

  function impact(position, value, kind = "") {
    effect("bs-impact " + kind, position, value, 460);
    burst(position, value, kind === "is-wall" ? 5 : 8);
  }

  function bumpNeighbors(cell) {
    if (reduceMotion.matches) return;
    const origin = center(cell[0], cell[1], displayParity);
    for (const [row, col] of neighbors(cell[0], cell[1], displayParity)) {
      const node = cellEls.get(cellKey(row, col));
      if (!node) continue;
      const position = center(row, col, displayParity);
      node.style.setProperty("--bs-kick-x", (position[0] - origin[0]) * 1.4 + "cqw");
      node.style.setProperty("--bs-kick-y", (position[1] - origin[1]) * 1.4 + "cqw");
      node.classList.add("is-bump");
      window.setTimeout(() => node.classList.remove("is-bump"), 290);
    }
  }

  function launchFeedback(shot) {
    const radians = (shot.angle * Math.PI) / 180;
    if (launcher) {
      launcher.style.setProperty("--bs-angle", shot.angle - 90 + "deg");
      launcher.style.setProperty("--bs-recoil-x", -Math.sin(radians) * 1.5 + "cqw");
      launcher.style.setProperty("--bs-recoil-y", Math.cos(radians) * 1.5 + "cqw");
      launcher.classList.add("is-firing");
    }
    const origin = geo().shooter;
    effect("bs-impact is-wall", [origin[0] + Math.sin(radians), origin[1] - Math.cos(radians)], shot.color, 380);
    playSound("launch");
  }

  function ensureAudio() {
    if (!soundEnabled) return false;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      if (!audioContext) audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  function playSound(kind, strength = 1) {
    if (!soundEnabled || !audioContext || audioContext.state !== "running") return;
    const tones = {
      launch: [420, 100, .12],
      wall: [760, 380, .07],
      impact: [180, 65, .11],
      pop: [500 + Math.min(strength, 8) * 55, 350, .16],
      drop: [320, 65, .24]
    };
    const [start, end, duration] = tones[kind];
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = kind === "impact" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.linearRampToValueAtTime(.045, now + .008);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  function renderSound() {
    if (!soundBtn) return;
    soundBtn.textContent = soundEnabled ? "Sound on" : "Sound off";
    soundBtn.setAttribute("aria-pressed", String(soundEnabled));
  }

  /* ------------------------------------------------------------------ *
   * Flight animation
   * ------------------------------------------------------------------ */

  function fly(path, value, version) {
    return new Promise((resolve) => {
      if (!flyEl || !path || path.length < 2 || reduceMotion.matches) {
        resolve();
        return;
      }
      flyEl.className = "bs-fly " + colorClass(value);
      flyEl.textContent = SYMBOLS[value] || "";
      place(flyEl, path[0][0], path[0][1]);
      flyEl.hidden = false;

      const segments = [];
      let total = 0;
      for (let index = 1; index < path.length; index += 1) {
        const distance = Math.hypot(path[index][0] - path[index - 1][0], path[index][1] - path[index - 1][1]);
        segments.push(distance);
        total += distance;
      }
      const duration = Math.max(160, Math.min(540, total * FLY_MS_PER_UNIT));
      const started = performance.now();
      let lastTrailAt = 0;
      let bounceIndex = 0;

      function frame(now) {
        if (version !== replayVersion) {
          resolve();
          return;
        }
        const progress = reduceMotion.matches ? 1 : Math.min(1, (now - started) / duration);
        const travelled = progress * total;
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
        const position = [from[0] + (to[0] - from[0]) * local, from[1] + (to[1] - from[1]) * local];
        const direction = Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI + "deg";
        place(flyEl, position[0], position[1]);
        flyEl.style.setProperty("--bs-flight-angle", direction);
        while (bounceIndex < index && bounceIndex < segments.length - 1) {
          impact(path[bounceIndex + 1], value, "is-wall");
          playSound("wall");
          bounceIndex += 1;
        }
        if (now - lastTrailAt >= 28 && progress < 1) {
          const trail = effect("bs-trail", position, value, 200);
          trail?.style.setProperty("--bs-flight-angle", direction);
          lastTrailAt = now;
        }
        if (progress < 1) {
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
    const version = ++replayVersion;
    animating = true;
    flightActive = shot.kind === "shoot";
    cancelPointer();
    renderChrome(next);
    renderAim();

    if (shot.kind === "shoot") {
      launchFeedback(shot);
      await fly(shot.path, shot.color, version);
      if (version !== replayVersion) return;
      flightActive = false;
      renderShooter();
      if (shot.cell) {
        addBubble(shot.cell[0], shot.cell[1], shot.color, displayParity, "is-landing");
        impact(center(shot.cell[0], shot.cell[1], displayParity), shot.color,
          shot.color === "bomb" ? "is-blast" : "");
        bumpNeighbors(shot.cell);
      }
      playSound("impact");
      await wait(85);
    }

    if (version !== replayVersion) return;

    const popped = (shot.popped || []).concat(shot.exploded || []);
    for (const [row, col] of popped.slice(0, 14)) {
      const value = displayGrid?.[row]?.[col] || shot.color;
      burst(center(row, col, displayParity), value, 5);
    }
    if (shot.kind === "hammer" && shot.cell) {
      impact(center(shot.cell[0], shot.cell[1], displayParity), "yellow");
      bumpNeighbors(shot.cell);
    }
    if (popped.length) playSound("pop", popped.length);
    if (shot.gain) {
      const badge = effect("bs-score-float", [geo().board_width / 2, geo().death_line_y - 1.2], "green", 900);
      if (badge) badge.textContent = "+" + shot.gain + (shot.combo > 1 ? " · ×" + Math.min(shot.combo, 5) : "");
    }
    const poppedNodes = retire(popped, "is-pop");
    const droppedNodes = retire(shot.dropped || [], "is-fall");
    dropNodes(poppedNodes, 320);
    dropNodes(droppedNodes, 710);
    if (droppedNodes.length) playSound("drop");

    await wait(droppedNodes.length ? 700 : poppedNodes.length ? 300 : 180);

    if (version !== replayVersion) return;

    if (shot.pushed && board) {
      board.classList.add("is-shake");
      window.setTimeout(() => {
        if (version === replayVersion) board.classList.remove("is-shake");
      }, 300);
    }

    lastShotId = shot.id;
    launcher?.classList.remove("is-firing");
    paintGrid(snapshot.grid, snapshot.top_parity);
    savePainted();
    animating = false;
    if (pendingView) {
      const queued = pendingView;
      pendingView = null;
      applyView(queued);
    } else {
      renderChrome(next);
      renderAim();
    }
  }

  /* ------------------------------------------------------------------ *
   * Aim line
   * ------------------------------------------------------------------ */

  function renderAim() {
    if (!view || !aimPath) return;
    if (launcher && !animating) {
      const direction = isMine() ? angle : activeBoard()?.last_shot?.angle || 0;
      launcher.style.setProperty("--bs-angle", direction - 90 + "deg");
    }
    if (!canAct() || hammerArmed || !displayGrid || !displayGrid.length) {
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
    return isMine() && can("shoot") && !animating && !pendingAction && !explainWidget?.isActive() && !helpWidget?.isOpen();
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
    shooter.hidden = flightActive;
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
    } else if (animating || pendingAction) {
      text = "Resolving shot…";
    } else if (hammerArmed) {
      text = "🔨 Hammer armed — tap a bubble to smash it.";
    } else if (snapshot && snapshot.aim_left > 0) {
      text = "🎯 Full trajectory on for " + snapshot.aim_left + " more shot(s).";
    } else if (snapshot && snapshot.push_interval > 0) {
      text = "Ceiling drops in " + snapshot.push_countdown + " shot(s).";
    } else {
      text = "Aim on the board · click or release to shoot.";
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
    const show = !animating && Boolean(view.game_over || (isMine() && out));
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
    renderStatus();
    renderLastShot();
    renderOverlay();
  }

  /* ------------------------------------------------------------------ *
   * View application
   * ------------------------------------------------------------------ */

  function applyView(next) {
    const ownBoard = boardOf(next, next.you);
    if (pendingAction && ((ownBoard?.shot_id || 0) !== pendingAction.shotId || next.game_over)) {
      clearPendingAction();
    }
    const boards = next.boards || {};
    if (!activeId || !boards[activeId]) {
      cancelReplay();
      cancelPointer();
      const fallback = next.you && boards[next.you]
        ? next.you
        : (next.ranking && next.ranking[0] ? next.ranking[0].player_id : next.you);
      activeId = fallback;
      loadPainted();
    }

    // Read the incoming state, not whatever was last painted.
    const snapshot = boardOf(next, activeId);
    const shot = snapshot ? snapshot.last_shot : null;
    const shotId = snapshot ? snapshot.shot_id || 0 : 0;

    const previousShotId = activeBoard()?.shot_id || 0;
    if (shotId < lastShotId || shotId < previousShotId) {
      // A restart rewound the counter for this board.
      cancelReplay();
      cancelPointer();
      clearPendingAction();
      painted.clear();
      hammerArmed = false;
      displayGrid = null;
      lastShotId = 0;
    }

    const gap = shot ? shot.id - lastShotId : 0;
    const fresh = Boolean(shot && displayGrid && gap > 0 && gap <= MAX_REPLAY_GAP);

    if (animating && gap <= MAX_REPLAY_GAP) {
      pendingView = next;
      renderChrome(next);
      return;
    }

    if (!fresh) {
      if (animating) cancelReplay();
      lastShotId = shotId;
      pendingView = null;
      animating = false;
      renderChrome(next);
      paintGrid(snapshot ? snapshot.grid : [], snapshot ? snapshot.top_parity : 0);
      savePainted();
      renderAim();
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
    if (activeRoomId && data.room_id && activeRoomId !== data.room_id) {
      cancelReplay();
      cancelPointer();
      clearPendingAction();
      painted.clear();
      activeId = null;
      displayGrid = null;
      lastShotId = 0;
      hammerArmed = false;
      angle = 0;
    }
    if (data.room_id) activeRoomId = data.room_id;
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
      cancelPointer();
      cancelReplay();
      clearPendingAction();
      if (tipBox) tipBox.hidden = true;
      audioContext?.suspend().catch(() => {});
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
    toast.timer = window.setTimeout(() => { tipBox.hidden = true; }, 3000);
  }

  function refreshInput() {
    renderItems();
    renderStatus();
    renderAim();
  }

  function clearPendingAction() {
    pendingAction = null;
    window.clearTimeout(actionTimer);
    actionTimer = 0;
  }

  function requestBoardAction(action) {
    if (!canAct()) return;
    if (typeof ensureRoomConnection === "function" && !ensureRoomConnection()) return;
    ensureAudio();
    pendingAction = { shotId: boardOf(view, view.you)?.shot_id || 0 };
    cancelPointer();
    refreshInput();
    actionTimer = window.setTimeout(() => {
      clearPendingAction();
      refreshInput();
      toast("No update yet. Reconnect if the shot did not resolve.");
    }, 5000);
    sendAction(action);
  }

  function cancelPointer() {
    const pointerId = activePointerId;
    pointerActive = false;
    activePointerId = null;
    pointerStart = null;
    pendingAim = null;
    if (aimFrame) cancelAnimationFrame(aimFrame);
    aimFrame = 0;
    if (pointerId !== null && board?.hasPointerCapture?.(pointerId)) {
      board.releasePointerCapture(pointerId);
    }
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
    if (py >= g.shooter[1] - .15) return;
    angle = clampAngle((Math.atan2(dx, -dy) * 180) / Math.PI);
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
      if (!pendingAim || !canAct() || hammerArmed) {
        pendingAim = null;
        return;
      }
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
    return target instanceof Element && Boolean(target.closest(".bs-overlay"));
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
    if (!canAct() || hammerArmed) return;
    flushAim();
    requestBoardAction({ type: "shoot", angle: Math.round(angle * 100) / 100 });
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
    requestBoardAction({ type: "use_item", item: "hammer", row, col });
  }

  if (board) {
    // A mouse aims while it merely hovers; touch and pen aim while pressed.
    // Either way the shot leaves on release inside the board, and releasing
    // outside the board cancels instead of firing.
    board.addEventListener("pointermove", (event) => {
      if (!view || onBoardChrome(event)) return;
      if (event.pointerType !== "mouse" && !pointerActive) return;
      if (pointerActive && event.pointerId !== activePointerId) return;
      if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 10) {
        pointerStart.moved = true;
      }
      if (!canAct() || hammerArmed) return;
      scheduleAim(event);
    });

    board.addEventListener("pointerdown", (event) => {
      if (!view || !event.isPrimary) return;
      if (event.button !== undefined && event.button !== 0) return;
      if (onBoardChrome(event)) return;
      if (!canAct()) return;
      cancelPointer();
      pointerActive = true;
      activePointerId = event.pointerId;
      pointerStart = { x: event.clientX, y: event.clientY, moved: false };
      board.setPointerCapture?.(event.pointerId);
      board.focus({ preventScroll: true });
      ensureAudio();
      if (!hammerArmed) scheduleAim(event);
      event.preventDefault();
    });

    board.addEventListener("pointerup", (event) => {
      if (!pointerActive || event.pointerId !== activePointerId) return;
      const wasDragged = pointerStart?.moved
        || Math.hypot(event.clientX - (pointerStart?.x || 0), event.clientY - (pointerStart?.y || 0)) > 10;
      const inside = insideBoard(event);
      cancelPointer();
      if (onBoardChrome(event) || !inside || !canAct()) return;
      if (hammerArmed) {
        if (!wasDragged) useHammerAt(event);
        return;
      }
      if (boardPoint(event)[1] >= geo().shooter[1] - .15) return;
      scheduleAim(event);
      flushAim();
      shoot();
    });

    board.addEventListener("pointercancel", cancelPointer);
    board.addEventListener("lostpointercapture", cancelPointer);

    board.addEventListener("keydown", (event) => {
      if (!view) return;
      if (event.key === "Escape") {
        cancelPointer();
        hammerArmed = false;
        refreshInput();
        return;
      }
      if (event.target !== board) return;
      if (!canAct()) return;
      if (hammerArmed) return;
      const step = event.shiftKey ? 0.5 : 2;
      if (event.key === "ArrowLeft") {
        angle = clampAngle(angle - step);
        renderAim();
        event.preventDefault();
      } else if (event.key === "ArrowRight") {
        angle = clampAngle(angle + step);
        renderAim();
        event.preventDefault();
      } else if (event.key === " " || event.key === "Enter") {
        if (!event.repeat) shoot();
        event.preventDefault();
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
    cancelPointer();
    refreshInput();
  });

  aimBtn?.addEventListener("click", () => {
    if (!canAct()) return;
    const snapshot = activeBoard();
    if (((snapshot && snapshot.items) || {}).aim <= 0) {
      toast("No aim charges left.");
      return;
    }
    hammerArmed = false;
    requestBoardAction({ type: "use_item", item: "aim" });
  });

  soundBtn?.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled && !ensureAudio()) {
      soundEnabled = false;
      toast("Sound is not available in this browser.");
    }
    if (!soundEnabled) audioContext?.suspend().catch(() => {});
    try { window.localStorage.setItem("bsSoundEnabled", String(soundEnabled)); } catch {}
    renderSound();
  });
  launcher?.addEventListener("animationend", () => launcher.classList.remove("is-firing"));

  panel?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    cancelPointer();
    hammerArmed = false;
    refreshInput();
  });
  window.addEventListener("blur", cancelPointer);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelPointer();
      audioContext?.suspend().catch(() => {});
    }
  });

  if (typeof socket !== "undefined") {
    socket.on("system:error", () => {
      if (!pendingAction) return;
      clearPendingAction();
      refreshInput();
    });
    socket.on("disconnect", () => {
      clearPendingAction();
      cancelPointer();
      if (view) refreshInput();
    });
  }

  renderSound();

  backBtn?.addEventListener("click", () => switchTo(view?.you));

  restartBtn?.addEventListener("click", () => {
    cancelPointer();
    hammerArmed = false;
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
        zh: "直接在棋盘上控制方向和发射。鼠标移动瞄准、点击发射，触摸时按住拖动瞄准，在棋盘内松手发射，移出棋盘松手取消。",
        en: "Aim and fire directly on the board. Move the mouse to aim and click to fire. On touch, press and drag to aim, release inside the board to fire, or release outside to cancel."
      },
      key: {
        zh: "所有人用同一个种子，所以地图、泡泡序列和天花板下压完全一致，比的是谁打得更好。关键是把泡泡送到同色堆里凑够三颗，让上方失去连接的泡泡整片掉下来。",
        en: "Everyone shares one seed, so the map, the bubble queue and the ceiling pushes are identical and only skill decides the winner. The key is landing a bubble so three or more of the same colour connect, which drops everything that loses its anchor."
      }
    },
    sections: [
      {
        id: "controls",
        label: { zh: "操作与反馈", en: "Controls" },
        html: {
          zh: "<p>瞄准和发射都直接在棋盘上完成，没有独立的方向按钮、滑杆或发射按钮。鼠标移动时炮管跟随指针，点击即可发射。手机上按住拖动瞄准，在棋盘内松手发射，移到棋盘外松手取消。</p>"
            + "<p>键盘聚焦棋盘后，左右方向键每次调整 2°，按住 Shift 时调整 0.5°，Space 或 Enter 发射。按 Escape 取消拖动或收起待用的锤子(🔨)。</p>"
            + "<p>飞行、墙面反弹和命中反馈都重放服务器确认的轨迹，不改变命中判定或计分。等待结果时发射与道具会暂时锁定，防止误连发。</p>"
            + "<p>Sound 可开启合成音效，默认关闭。系统启用减少动态效果时，不播放飞行、震动和粒子动画。</p>"
            + "<p>统计中的总分(⭐)、波次(♾️)、连击(🔥)、下压倒计时(⬇️)和发射次数(🎯)都对应当前观看的棋盘。普通泡泡的颜色符号是红色(✕)、橙色(▲)、黄色(★)、绿色(✚)、蓝色(●)和紫色(◆)。</p>",
          en: "<p>Aim and fire directly on the board without a separate control bar. Move the mouse to aim and click to fire. On a phone, press and drag to aim, release inside the board to fire, or release outside to cancel.</p>"
            + "<p>Focus the board to aim with the left and right keys in 2° steps, or 0.5° while holding Shift. Space or Enter fires. Escape cancels a drag or disarms the hammer(🔨).</p>"
            + "<p>Flight, wall bounces and impact effects replay the server-confirmed path without changing collisions or scoring. Shooting and items briefly lock while awaiting the result to prevent accidental double shots.</p>"
            + "<p>Sound enables synthesized effects and is off by default. The system reduced-motion setting skips flight, shake and particle animations.</p>"
            + "<p>Score(⭐), wave(♾️), combo(🔥), push countdown(⬇️) and shot count(🎯) describe the board you are watching. Bubble symbols identify red(✕), orange(▲), yellow(★), green(✚), blue(●) and purple(◆) without relying on colour alone.</p>"
        }
      },
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
            + "<p>道具按钮在棋盘旁边，手机端紧贴棋盘下方。按锤子后轻点目标，拖动或移出棋盘松手都不会消耗锤子。</p>"
            + "<p>次数在开局时发放，用完不再补充。</p>",
          en: "<p>Hammer(🔨): press it to arm, then tap any bubble on the board to smash it outright, and anything above that loses its anchor falls too.</p>"
            + "<p>Aim line(🎯): press it and the next three shots show the full bouncing trajectory plus a dashed circle on the landing cell.</p>"
            + "<p>Items sit beside the board, or directly below it on phones. After arming the hammer, tap a target. Dragging or releasing outside the board never spends a charge.</p>"
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
      zh: "道具在棋盘旁边，手机端紧贴棋盘下方，不遮挡瞄准与发射区域。观战时显示对方剩余次数，但不能使用。",
      en: "Items sit beside the board, or directly below it on phones, without covering the aiming area. While spectating they show the watched player's charges but cannot be used."
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
    sound: {
      zh: "开启或关闭本机合成的发射、反弹、命中和消球音效，默认关闭。这个设置不会影响其他玩家。",
      en: "Toggle locally synthesized launch, bounce, impact and pop sounds. Off by default. This setting never changes another player's sound."
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
      bypass: ["#bubbleShooterHelpBtn", "#bubbleShooterExplainBtn"],
      onChange: () => {
        cancelPointer();
        if (view) refreshInput();
      }
    });
    bsHelpBtn?.addEventListener("click", () => {
      explainWidget?.exit();
      cancelPointer();
      helpWidget.open();
      if (view) refreshInput();
      helpWidget.element()?.addEventListener("close", () => {
        if (view) refreshInput();
      }, { once: true });
    });
    bsExplainBtn?.addEventListener("click", () => explainWidget?.toggle());
    const description = (node) => {
      const language = window.obgHelpLang?.() || "en";
      return EXPLAIN[node.dataset.bsExplain]?.[language] || "";
    };
    const passiveTarget = (target) => {
      if (!(target instanceof Element) || target.closest("button, input, label, summary, #bsBoard")) return null;
      const node = target.closest("[data-bs-explain]");
      return node && !node.querySelector("button, input") ? node : null;
    };
    panel?.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse") return;
      const node = passiveTarget(event.target);
      if (node) node.title = description(node);
    });
    let tipGesture = null;
    panel?.addEventListener("pointerdown", (event) => {
      const target = passiveTarget(event.target);
      tipGesture = event.pointerType !== "mouse" && target
        ? { target, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
        : null;
    });
    panel?.addEventListener("pointermove", (event) => {
      if (tipGesture && Math.hypot(event.clientX - tipGesture.x, event.clientY - tipGesture.y) > 10) tipGesture.moved = true;
    });
    panel?.addEventListener("pointerup", (event) => {
      const gesture = tipGesture;
      tipGesture = null;
      if (!gesture || gesture.pointerId !== event.pointerId || gesture.moved || explainWidget?.isActive()) return;
      if (passiveTarget(event.target) === gesture.target) toast(description(gesture.target));
    });
    panel?.addEventListener("pointercancel", () => { tipGesture = null; });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHelpExplain);
  } else {
    initHelpExplain();
  }

  window.renderBubbleShooterGameState = renderGameState;
  window.showBubbleShooterHeaderActions = showHeaderActions;
})();
