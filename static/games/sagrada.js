(function () {
  "use strict";

  let sagradaView = null;
  let sagradaSelectedDie = null;
  let sagradaSelectedCell = null;
  let sagradaExplainMode = false;
  let sagradaTipTimer = null;
  let sagradaTipTarget = null;

  const panel = () => document.getElementById("sagradaGamePanel");
  const $ = (id) => document.getElementById(id);
  const colors = {
    red: ["Red", "🟥"], yellow: ["Yellow", "🟨"], green: ["Green", "🟩"],
    blue: ["Blue", "🟦"], purple: ["Purple", "🟪"], white: ["White", "⬜"],
  };
  const helpText = `<h3>Goal</h3><p>Build the most beautiful stained glass window 🪟 over 10 rounds.</p>
    <h3>Turn</h3><ol><li>Choose one die 🎲 from the pool.</li><li>Choose an empty cell next to a placed die. The first die must touch the border.</li><li>Orthogonally adjacent dice cannot share a color or value. Diagonal neighbors have no color or value restriction.</li></ol>
    <h3>Scoring</h3><p>Public objectives reward rows, columns and color variety. Your secret color goal scores the pip total of that color. Each unused Favor Token (🔹) is worth 1 point. Empty window cells are −1 point each at the end.</p>
    <h3>Round pause</h3><p>When the pool is empty, the round pauses so everyone can inspect the result. Every player must click Next Round before the next pool is dealt.</p>
    <p>Colors: Red (🟥), Yellow (🟨), Green (🟩), Blue (🟦), Purple (🟪).</p>`;

  function dieLabel(die) {
    const color = colors[die && die.color] || [die && die.color || "Unknown", "🎲"];
    return `${color[0]} (${color[1]}) ${die && die.value != null ? die.value : "?"}`;
  }

  function getSelf(view) {
    return (view && Array.isArray(view.players) ? view.players : []).find((p) => p.player_id === view.you) || null;
  }

  function getGrid(player) {
    const grid = player && (player.grid || player.window || player.board);
    if (Array.isArray(grid) && grid.length === 4 && Array.isArray(grid[0])) return grid;
    return Array.from({ length: 4 }, () => Array(5).fill(null));
  }

  function dieAt(grid, row, col) {
    const cell = grid && grid[row] && grid[row][col];
    if (!cell) return null;
    if (cell.die) return cell.die;
    if (cell.color || cell.value != null) return cell;
    return null;
  }

  function isCellSelectable(row, col) {
    const self = getSelf(sagradaView);
    if (!self || !sagradaView || sagradaView.current_turn !== sagradaView.you || sagradaView.phase !== "drafting") return false;
    const grid = getGrid(self);
    const pool = Array.isArray(sagradaView.pool) ? sagradaView.pool : (sagradaView.dice_pool || []);
    const selected = pool.find((die, index) => (die.id ?? index) === sagradaSelectedDie);
    if (dieAt(grid, row, col)) return false;
    const placed = [];
    for (let r = 0; r < 4; r += 1) for (let c = 0; c < 5; c += 1) if (dieAt(grid, r, c)) placed.push([r, c]);
    const cell = grid[row] && grid[row][col];
    const restriction = cell && cell.restriction;
    if (selected && restriction && ((restriction.color && restriction.color !== selected.color) || (restriction.value != null && restriction.value !== selected.value))) return false;
    if (!placed.length) return row === 0 || row === 3 || col === 0 || col === 4;
    if (!placed.some(([r, c]) => Math.max(Math.abs(r - row), Math.abs(c - col)) === 1)) return false;
    if (!selected) return true;
    for (const [r, c] of placed) {
      const neighbour = dieAt(grid, r, c); const dr = Math.abs(r - row); const dc = Math.abs(c - col);
      if (dr === 0 || dc === 0) {
        if (neighbour.color === selected.color || neighbour.value === selected.value) return false;
      }
    }
    return true;
  }

  function clearSelection() {
    sagradaSelectedDie = null;
    sagradaSelectedCell = null;
    renderSagrada();
  }

  function showTip(target, message) {
    hideTip();
    if (!message) return;
    let tip = $("sagradaTip");
    if (!tip) { tip = document.createElement("div"); tip.id = "sagradaTip"; tip.className = "sagrada-tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    tip.textContent = message; tip.hidden = false; sagradaTipTarget = target;
    const rect = target.getBoundingClientRect(); const box = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(10, Math.min(window.innerWidth - box.width - 10, rect.left))}px`;
    tip.style.top = `${Math.max(10, Math.min(window.innerHeight - box.height - 10, rect.top - box.height - 8))}px`;
    sagradaTipTimer = window.setTimeout(hideTip, 3000);
  }

  function hideTip() {
    window.clearTimeout(sagradaTipTimer); sagradaTipTimer = null;
    const tip = $("sagradaTip"); if (tip) tip.hidden = true; sagradaTipTarget = null;
  }

  function openExplain(title, text) {
    const body = $("sagradaExplainContent"); if (!body) return;
    body.replaceChildren(Object.assign(document.createElement("h3"), { textContent: title }), Object.assign(document.createElement("p"), { textContent: text }));
    if (typeof setModalVisible === "function") setModalVisible($("sagradaExplainModal"), true); else $("sagradaExplainModal")?.classList.remove("hidden");
  }

  function setExplainMode(enabled) {
    sagradaExplainMode = Boolean(enabled); panel()?.classList.toggle("sagrada-explain-mode", sagradaExplainMode); $("sagradaExplainBtn")?.setAttribute("aria-pressed", String(sagradaExplainMode));
    if (!sagradaExplainMode) hideTip();
  }

  function renderPool(view) {
    const root = $("sagradaPool"); if (!root) return; root.replaceChildren();
    const pool = Array.isArray(view.dice_pool) ? view.dice_pool : (Array.isArray(view.pool) ? view.pool : []);
    if (!pool.length) { const empty = document.createElement("span"); empty.className = "hint"; empty.textContent = "Pool empty — waiting for the round pause."; root.appendChild(empty); return; }
    pool.forEach((die, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = `sagrada-die ${die.color || ""}`; button.textContent = die.value ?? "?";
      button.dataset.sagradaTip = `${dieLabel(die)}: choose this die, then choose a highlighted cell.`; button.title = button.dataset.sagradaTip;
      button.setAttribute("aria-label", dieLabel(die)); button.setAttribute("aria-pressed", String(sagradaSelectedDie === (die.id ?? index)));
      if (sagradaSelectedDie === (die.id ?? index)) button.classList.add("selected");
      button.addEventListener("click", () => { if (sagradaExplainMode) return openExplain("Dice pool 🎲", button.dataset.sagradaTip); if (window.matchMedia("(hover: none)").matches) showTip(button, button.dataset.sagradaTip); sagradaSelectedDie = die.id ?? index; renderSagrada(); });
      root.appendChild(button);
    });
  }

  function renderBoard(view) {
    const root = $("sagradaBoard"); if (!root) return; root.replaceChildren();
    const self = getSelf(view); const grid = getGrid(self);
    for (let row = 0; row < 4; row += 1) for (let col = 0; col < 5; col += 1) {
      const cell = document.createElement("button"); cell.type = "button"; cell.className = "sagrada-cell"; cell.dataset.row = row; cell.dataset.col = col;
      const die = dieAt(grid, row, col); const selectable = isCellSelectable(row, col);
      const restriction = grid[row] && grid[row][col] && grid[row][col].restriction;
      if (die) { cell.classList.add("filled", die.color || ""); cell.textContent = die.value ?? "?"; cell.dataset.sagradaTip = `${dieLabel(die)} in row ${row + 1}, column ${col + 1}.`; }
      else { cell.classList.add(selectable ? "available" : "blocked"); cell.textContent = restriction ? (restriction.color ? (colors[restriction.color]?.[1] || "🎨") : `${restriction.value}`) : "·"; cell.dataset.sagradaTip = restriction ? `${selectable ? "Available" : "Restricted"} cell: ${restriction.color ? `${colors[restriction.color]?.[0] || restriction.color} ${colors[restriction.color]?.[1] || "🎨"}` : `value ${restriction.value}`}.` : (selectable ? `Empty cell, row ${row + 1}, column ${col + 1}. Place the selected die here.` : "This cell is not legal for the current selection."); }
      cell.title = cell.dataset.sagradaTip; cell.setAttribute("aria-label", cell.dataset.sagradaTip); cell.disabled = Boolean(die) || !selectable;
      if (sagradaSelectedCell && sagradaSelectedCell.row === row && sagradaSelectedCell.col === col) cell.classList.add("selected");
      cell.addEventListener("click", () => { if (sagradaExplainMode) return openExplain("Window cell 🪟", cell.dataset.sagradaTip); if (window.matchMedia("(hover: none)").matches) showTip(cell, cell.dataset.sagradaTip); if (!cell.disabled) { sagradaSelectedCell = { row, col }; renderSagrada(); } });
      root.appendChild(cell);
    }
  }

  function renderObjectives(view) {
    const root = $("sagradaObjectives"); if (!root) return; root.replaceChildren();
    const objectives = view.objectives || view.public_objectives || [];
    if (Array.isArray(objectives)) objectives.forEach((obj) => { const el = document.createElement("div"); el.className = "sagrada-objective"; el.textContent = typeof obj === "string" ? obj : `${obj.name || obj.title || "Objective"}: ${obj.description || obj.points || ""}`; root.appendChild(el); });
    const self = getSelf(view); const token = self && (self.favor_tokens ?? self.tokens ?? 0); const tokenEl = document.createElement("div"); tokenEl.className = "sagrada-resource"; tokenEl.textContent = `Favor Tokens 🔹: ${token}`; root.appendChild(tokenEl);
  }

  function renderPlayers(view) {
    const root = $("sagradaPlayers"); if (!root) return; root.replaceChildren();
    (view.players || []).forEach((player) => { const card = document.createElement("div"); card.className = "sagrada-player"; if (player.player_id === view.you) card.classList.add("self"); if (player.player_id === view.current_turn) card.classList.add("current"); const name = player.name || player.player_id; const score = view.game_over ? (player.score ?? 0) : (player.score_preview ?? player.score ?? 0); const nameEl = document.createElement("strong"); nameEl.textContent = name; const stats = document.createElement("span"); stats.textContent = `${score} pts · 🔹 ${player.favor_tokens ?? player.tokens ?? 0}`; card.append(nameEl, stats); root.appendChild(card); });
  }

  function renderSagrada() {
    const view = sagradaView; if (!view) return;
    const self = getSelf(view); const pool = Array.isArray(view.dice_pool) ? view.dice_pool : (view.pool || []);
    $("sagradaRound").textContent = view.round ?? "-"; $("sagradaDiceCount").textContent = pool.length; $("sagradaPhase").textContent = view.phase || "-";
    const current = (view.players || []).find((p) => p.player_id === view.current_turn); $("sagradaTurn").textContent = current?.name || view.current_turn || "-";
    const goal = self && (self.secret_color || self.private_color || self.private_goal || self.secret_goal || view.private_color); $("sagradaSecretGoal").textContent = goal ? `Secret goal: ${colors[goal]?.[0] || goal} ${colors[goal]?.[1] || "🎨"}` : "";
    const selectedDie = pool.find((die, index) => (die.id ?? index) === sagradaSelectedDie); $("sagradaSelection").textContent = selectedDie ? `Selected ${dieLabel(selectedDie)}${sagradaSelectedCell ? ` → row ${sagradaSelectedCell.row + 1}, column ${sagradaSelectedCell.col + 1}` : " · choose a cell"}` : "Select a die, then an empty window cell.";
    const canAct = view.current_turn === view.you && view.phase === "drafting"; $("sagradaPlaceBtn").disabled = !(canAct && selectedDie && sagradaSelectedCell); $("sagradaSkipBtn").disabled = !(canAct && selectedDie);
    const next = $("sagradaNextRoundBtn"); const ready = Array.isArray(view.ready) && view.ready.includes(view.you); next.disabled = view.phase !== "round_end" || ready; next.textContent = view.phase === "game_over" ? "Game over" : (view.phase === "round_end" ? (ready ? "Ready ✓" : "Next Round") : "Round in progress");
    const winner = $("sagradaWinnerStatus"); winner.classList.toggle("hidden", !view.game_over); const winnerIds = Array.isArray(view.winner) ? view.winner : []; const winnerNames = Array.isArray(view.winner_names) ? view.winner_names : winnerIds.map((id) => (view.players || []).find((player) => player.player_id === id)?.name || id); $("sagradaWinner").textContent = winnerNames.join(", ") || "-";
    renderPool(view); renderBoard(view); renderObjectives(view); renderPlayers(view);
    const summary = $("sagradaRoundSummary"); if (summary) { const entries = Array.isArray(view.round_summary) ? view.round_summary : []; summary.classList.toggle("hidden", !(view.phase === "round_end" && entries.length)); summary.replaceChildren(); entries.forEach((entry) => { const line = document.createElement("div"); if (entry.player_id === view.you) line.className = "self"; const actor = (view.players || []).find((p) => p.player_id === entry.player_id); const die = entry.die || {}; line.textContent = `${actor?.name || entry.player_id} · ${dieLabel(die)}${entry.skipped ? " · skipped" : ` · row ${(entry.row ?? 0) + 1}, column ${(entry.col ?? 0) + 1}`}`; summary.appendChild(line); }); }
    const log = $("sagradaLog"); if (log) { log.replaceChildren(); (view.log || []).slice(-30).forEach((line) => { const row = document.createElement("div"); row.textContent = line; log.appendChild(row); }); }
  }

  function sendSagradaAction(action) { if (typeof sendAction === "function") sendAction(action); else if (window.socket) window.socket.emit("game:action", { action }); }

  window.renderSagradaGameState = function (data) { if (!data || !data.view) return; sagradaView = data.view; if (sagradaSelectedDie != null && !(sagradaView.dice_pool || sagradaView.pool || []).some((die, index) => (die.id ?? index) === sagradaSelectedDie)) sagradaSelectedDie = null; renderSagrada(); };
  window.showSagradaHeaderActions = function (show) { const header = $("sagradaHeaderActions"); if (header) header.style.display = show ? "flex" : "none"; if (!show) { setExplainMode(false); hideTip(); } };

  $("sagradaPlaceBtn")?.addEventListener("click", () => { const pool = sagradaView && (sagradaView.dice_pool || sagradaView.pool || []); const index = pool.findIndex((die, idx) => (die.id ?? idx) === sagradaSelectedDie); if (index < 0 || !sagradaSelectedCell) return; const die = pool[index]; sendSagradaAction({ type: "place_die", die_id: die.id, row: sagradaSelectedCell.row, col: sagradaSelectedCell.col }); sagradaSelectedDie = null; sagradaSelectedCell = null; });
  $("sagradaSkipBtn")?.addEventListener("click", () => { const pool = sagradaView && (sagradaView.dice_pool || sagradaView.pool || []); const index = pool.findIndex((die, idx) => (die.id ?? idx) === sagradaSelectedDie); if (index < 0) return; sendSagradaAction({ type: "skip_die", die_id: pool[index].id }); sagradaSelectedDie = null; sagradaSelectedCell = null; });
  $("sagradaNextRoundBtn")?.addEventListener("click", () => sendSagradaAction({ type: "next_round" }));
  $("sagradaHelpBtn")?.addEventListener("click", () => { $("sagradaHelpContent").innerHTML = helpText; if (typeof setModalVisible === "function") setModalVisible($("sagradaHelpModal"), true); });
  $("sagradaHelpClose")?.addEventListener("click", () => typeof setModalVisible === "function" && setModalVisible($("sagradaHelpModal"), false));
  $("sagradaExplainBtn")?.addEventListener("click", () => setExplainMode(!sagradaExplainMode));
  $("sagradaExplainClose")?.addEventListener("click", () => typeof setModalVisible === "function" && setModalVisible($("sagradaExplainModal"), false));
  panel()?.addEventListener("pointerover", (event) => { if (event.pointerType === "mouse" && !sagradaExplainMode) { const target = event.target.closest("[data-sagrada-tip]"); if (target) showTip(target, target.dataset.sagradaTip); } });
  panel()?.addEventListener("pointerout", (event) => { if (event.pointerType === "mouse" && sagradaTipTarget && !sagradaTipTarget.contains(event.relatedTarget)) hideTip(); });
  panel()?.addEventListener("click", (event) => { const tipTarget = event.target.closest?.("[data-sagrada-tip]"); if (tipTarget && window.matchMedia("(hover: none)").matches && !sagradaExplainMode) showTip(tipTarget, tipTarget.dataset.sagradaTip); if (!event.target.closest("button,[data-sagrada-tip],summary") && !sagradaExplainMode) { clearSelection(); hideTip(); } if (sagradaExplainMode) { const target = event.target.closest("[data-sagrada-tip]"); if (target) { openExplain(target.tagName === "BUTTON" ? "Sagrada control" : "Window", target.dataset.sagradaTip); setExplainMode(false); } } });
  // Disabled controls do not dispatch click events. Resolve Explain targets
  // from pointer coordinates so blocked cells and unavailable actions remain
  // inspectable, as required by task40.
  document.addEventListener("pointerdown", (event) => {
    if (!sagradaExplainMode) return;
    const root = panel();
    if (!root || !root.contains(event.target)) return;
    let target = event.target.closest?.("[data-sagrada-tip]") || null;
    if (!target || target.disabled) {
      target = Array.from(root.querySelectorAll("[data-sagrada-tip]")).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      }) || null;
    }
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    openExplain(target.tagName === "BUTTON" ? "Sagrada control" : "Window", target.dataset.sagradaTip);
    setExplainMode(false);
  }, true);
  document.addEventListener("keydown", (event) => { if (event.key !== "Escape") return; setExplainMode(false); hideTip(); if (typeof setModalVisible === "function") { setModalVisible($("sagradaHelpModal"), false); setModalVisible($("sagradaExplainModal"), false); } else { $("sagradaHelpModal")?.classList.add("hidden"); $("sagradaExplainModal")?.classList.add("hidden"); } });
})();
