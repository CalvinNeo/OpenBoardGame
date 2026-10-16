(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const panel = () => $("sagradaGamePanel");
  const colors = { red: ["Red", "🟥"], yellow: ["Yellow", "🟨"], green: ["Green", "🟩"], blue: ["Blue", "🟦"], purple: ["Purple", "🟪"] };
  const pips = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const dieFaces = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
  const toolInfo = {
    grozing_pliers: ["Grozing Pliers", "Adjust a drafted die by +1 or −1, then place it. A 1 cannot become 6, and a 6 cannot become 1."],
    eglomise_brush: ["Eglomise Brush", "Move one die in your window, ignoring its destination's color restriction. Obey all other placement rules."],
    copper_foil_burnisher: ["Copper Foil Burnisher", "Move one die in your window, ignoring its destination's value restriction. Obey all other placement rules."],
    lathekin: ["Lathekin", "Move exactly two dice in your window, obeying all placement rules. Choose a source and destination for each move."],
    lens_cutter: ["Lens Cutter", "Exchange a drafted die with a round-track die, then place the received die."],
    flux_brush: ["Flux Brush", "Reroll a drafted die, then choose a legal destination for its new value. Return it to the pool only if it cannot be placed."],
    glazing_hammer: ["Glazing Hammer", "Reroll every die in the pool. Use this on your second turn, before drafting a die."],
    running_pliers: ["Running Pliers", "End your first turn and immediately take your second draft. Skip your second turn this round."],
    cork_backed_straightedge: ["Cork-backed Straightedge", "Draft a die and place it in a cell that touches no other die, ignoring the adjacency requirement. Obey the window restriction."],
    grinding_stone: ["Grinding Stone", "Flip a drafted die to its opposite face, then place it: 1 ↔ 6, 2 ↔ 5, 3 ↔ 4."],
    flux_remover: ["Flux Remover", "Return a drafted die to the bag and draw a replacement. Choose its value, then place it following all restrictions."],
    tap_wheel: ["Tap Wheel", "Move one or two window dice of a single color represented on the round track. Obey all placement rules."],
  };
  let view = null;
  let selectedDie = null;
  let selectedCell = null;
  let selectedPattern = null;
  let selectedTool = null;
  let toolMoves = [];
  let toolSource = null;
  let trackDie = null;
  let toolValue = null;
  let explainMode = false;
  let tipTimer = null;
  let pending = false;
  let blockedClickUntil = 0;
  let blockedClickTarget = null;
  let lastTurnKey = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function setTip(node, text) {
    if (!text) return node;
    node.dataset.sagradaTip = text;
    node.title = text;
    return node;
  }
  function colorLabel(color) { return colors[color] ? `${colors[color][0]} (${colors[color][1]})` : "Hidden 🔒"; }
  function dieLabel(die) { return die ? `${colorLabel(die.color)} ${die.value == null ? "· choose value" : die.value}` : "Unknown die"; }
  function selfPlayer() { return (view?.players || []).find((player) => player.player_id === view.you); }
  function playerName(id) { return (view?.players || []).find((player) => player.player_id === id)?.name || id || "–"; }
  function poolDice() { return view?.pool || view?.dice_pool || []; }
  function pendingTool() { const tool = view?.pending_tool; return tool && (!tool.player_id || tool.player_id === view.you) ? tool : null; }
  function chosenDie() { return pendingTool()?.die || poolDice().find((die) => die.id === selectedDie); }
  function gridFor(player) { return player?.grid || Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => ({ restriction: null, die: null }))); }
  function cellDie(cell) { return cell?.die || (cell?.value != null && cell?.color ? cell : null); }
  function hasAction(type) { return Boolean(view && !pending && (view.legal_actions || []).includes(type)); }
  function dieButton(die, small) {
    const button = element("button", `sagrada-die ${die.color || ""}`);
    paintDie(button, die);
    button.type = "button";
    button.setAttribute("aria-label", dieLabel(die));
    setTip(button, dieLabel(die));
    if (small) button.classList.add("small");
    return button;
  }
  function paintDie(node, die) {
    node.replaceChildren();
    const face = element("span", "sagrada-pips"); face.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 9; index += 1) face.append(element("span", dieFaces[die.value]?.includes(index) ? "pip" : ""));
    node.append(face);
  }
  function placementReason(grid, die, row, col, options) {
    const opts = options || {};
    if (cellDie(grid[row]?.[col])) return "This cell already contains a die.";
    if (!die) return "Choose a pool die first.";
    const restriction = grid[row]?.[col]?.restriction;
    if (!opts.ignoreColor && restriction?.color && restriction.color !== die.color) return `This cell requires ${colorLabel(restriction.color)}.`;
    if (!opts.ignoreValue && restriction?.value != null && restriction.value !== die.value) return `This cell requires value ${restriction.value}.`;
    let count = 0;
    let touches = false;
    for (let r = 0; r < 4; r += 1) for (let c = 0; c < 5; c += 1) {
      const neighbour = cellDie(grid[r]?.[c]);
      if (!neighbour) continue;
      count += 1;
      const dr = Math.abs(r - row); const dc = Math.abs(c - col);
      if (Math.max(dr, dc) === 1) touches = true;
      if (dr + dc === 1 && (neighbour.color === die.color || neighbour.value === die.value)) return "Orthogonally adjacent dice cannot share a color or value.";
    }
    if (!count && row !== 0 && row !== 3 && col !== 0 && col !== 4) return "The first die must be on the window edge.";
    if (opts.nonAdjacent) return touches ? "This tool requires a cell touching no other dice." : "";
    if (count && !touches) return "The die must touch an existing die, diagonally or orthogonally.";
    return "";
  }
  function restrictionLabel(cell) {
    const rule = cell?.restriction;
    return rule?.color ? `Requires ${colorLabel(rule.color)}.` : rule?.value != null ? `Requires value ${rule.value}.` : "No printed restriction.";
  }
  function clearSelection(render) {
    selectedDie = null; selectedCell = null; selectedTool = null; toolMoves = []; toolSource = null; trackDie = null; toolValue = null; selectedPattern = null;
    if (render !== false) renderSagrada();
  }
  function showTip(target, message) {
    hideTip();
    if (!target || !message) return;
    let tip = $("sagradaTip");
    if (!tip) { tip = element("div", "sagrada-tip"); tip.id = "sagradaTip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    tip.textContent = message; tip.hidden = false;
    const rect = target.getBoundingClientRect(); const box = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(10, Math.min(innerWidth - box.width - 10, rect.left))}px`;
    tip.style.top = `${Math.max(10, Math.min(innerHeight - box.height - 10, rect.top - box.height - 8))}px`;
    tipTimer = window.setTimeout(hideTip, 3000);
  }
  function hideTip() { clearTimeout(tipTimer); const tip = $("sagradaTip"); if (tip) tip.hidden = true; }
  function modal(id, show) {
    const root = $(id); if (!root) return;
    if (typeof setModalVisible === "function") setModalVisible(root, show);
    else { root.classList.toggle("hidden", !show); root.setAttribute("aria-hidden", String(!show)); }
  }
  function setExplainMode(enabled) {
    explainMode = Boolean(enabled); panel()?.classList.toggle("sagrada-explain-mode", explainMode);
    $("sagradaExplainBtn")?.setAttribute("aria-pressed", String(explainMode)); hideTip();
  }
  function openExplain(text) {
    $("sagradaExplainContent").replaceChildren(element("p", "", text)); modal("sagradaExplainModal", true); setExplainMode(false);
  }
  function send(action) {
    if (!view || pending) return;
    if (Number.isInteger(view.revision)) action.revision = view.revision;
    pending = true; renderSagrada();
    if (typeof sendAction === "function") sendAction(action);
    else if (typeof socket !== "undefined") socket.emit("game:action", { room_id: typeof roomId !== "undefined" ? roomId : null, action });
  }

  function renderPatterns() {
    const setup = $("sagradaSetup"); const selecting = view.phase === "pattern_select";
    setup.classList.toggle("hidden", !selecting);
    const root = $("sagradaPatterns"); root.replaceChildren();
    if (!selecting) return;
    const options = view.patterns || selfPlayer()?.patterns || [];
    const ownPattern = selfPlayer()?.pattern_id;
    $("sagradaSetupStatus").textContent = ownPattern ? "Window chosen. Waiting for the other players…" : selfPlayer() ? "Select a window, then confirm on its card." : "Waiting for players to choose their windows…";
    options.forEach((pattern) => {
      const card = element("div", `sagrada-pattern${selectedPattern === pattern.id ? " selected" : ""}`);
      card.setAttribute("role", "button"); card.tabIndex = 0;
      card.setAttribute("aria-label", `${pattern.name}, difficulty ${pattern.difficulty}`);
      setTip(card, `${pattern.name}: difficulty ${pattern.difficulty}, providing ${pattern.difficulty} Favor Tokens (🔹). Match the printed cell colors and values when placing dice.`);
      const heading = element("div", "sagrada-pattern-heading"); heading.append(element("strong", "", pattern.name), setTip(element("span", "", `🔹 ${pattern.difficulty}`), `${pattern.difficulty} starting Favor Tokens (🔹). Each unused token scores 1 point.`));
      card.append(heading, miniatureGrid(pattern.grid || pattern.restrictions));
      function selectPattern() { if (!hasAction("choose_pattern")) return; selectedPattern = pattern.id; renderPatterns(); }
      card.addEventListener("click", selectPattern);
      card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPattern(); } });
      if (selectedPattern === pattern.id) {
        const confirm = element("button", "sagrada-pattern-confirm", "Choose window"); confirm.type = "button"; confirm.disabled = !hasAction("choose_pattern");
        setTip(confirm, `Choose ${pattern.name} and begin with ${pattern.difficulty} Favor Tokens (🔹).`);
        confirm.addEventListener("click", (event) => { event.stopPropagation(); send({ type: "choose_pattern", pattern_id: pattern.id }); }); card.append(confirm);
      }
      root.append(card);
    });
  }
  function miniatureGrid(grid) {
    const board = element("div", "sagrada-board sagrada-mini-board");
    const actual = Array.isArray(grid) && grid.length === 4 ? grid : gridFor(null);
    actual.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      const die = cellDie(cell); const restriction = cell?.restriction || (cell?.color || cell?.value != null ? cell : null);
      const color = die?.color || restriction?.color || "";
      const node = element("span", `sagrada-cell ${color}${die ? " filled" : ""}`, die ? null : restriction?.value || "·"); if (die) paintDie(node, die);
      node.tabIndex = 0; setTip(node, `Row ${rowIndex + 1}, column ${colIndex + 1}. ${die ? dieLabel(die) : restrictionLabel({ restriction })}`); board.append(node);
    }));
    return board;
  }
  function renderPool() {
    const root = $("sagradaPool"); root.replaceChildren();
    const pendingDie = pendingTool()?.die;
    const dice = pendingDie ? [pendingDie, ...poolDice().filter((die) => die.id !== pendingDie.id)] : poolDice();
    $("sagradaDiceCount").textContent = `${dice.length} dice`;
    if (!dice.length) root.append(element("span", "hint", view.phase === "pattern_select" ? "Choose windows to begin." : "No dice in the pool."));
    dice.forEach((die) => {
      const button = dieButton(die); button.classList.toggle("selected", selectedDie === die.id);
      button.setAttribute("aria-pressed", String(selectedDie === die.id));
      button.disabled = Boolean(pendingDie) || (!hasAction("place_die") && !hasAction("use_tool"));
      button.addEventListener("click", () => { selectedDie = selectedDie === die.id ? null : die.id; selectedCell = null; toolValue = null; hideTip(); renderSagrada(); });
      root.append(button);
    });
    const turn = view.current_turn === view.you;
    const turnState = view.current_turn_state || {};
    $("sagradaPoolHint").textContent = pendingDie ? `Tool result: ${dieLabel(pendingDie)}. ${pendingTool().tool_id === "flux_remover" ? "Choose its value, then a legal cell." : "Choose a highlighted destination."}` : view.phase === "drafting" ? (turn ? (turnState.drafted ? "Draft complete. Use a tool or end your turn." : "Your turn · choose a die and a highlighted cell.") : `${playerName(view.current_turn)} is building their window.`) : "";
  }
  function moveTool() { return ["eglomise_brush", "copper_foil_burnisher", "lathekin", "tap_wheel"].includes(selectedTool); }
  function placementTool() { return ["grozing_pliers", "lens_cutter", "running_pliers", "cork_backed_straightedge", "grinding_stone"].includes(selectedTool); }
  function transformedDie() {
    const die = chosenDie();
    if (pendingTool()?.tool_id === "flux_remover") return die && toolValue != null ? { ...die, value: toolValue } : null;
    if (!selectedTool) return die;
    if (selectedTool === "lens_cutter") return roundTrack().flat().find((candidate) => candidate.id === trackDie);
    if (selectedTool === "grozing_pliers") return die && toolValue != null ? { ...die, value: toolValue } : null;
    if (selectedTool === "grinding_stone") return die ? { ...die, value: 7 - die.value } : null;
    return die;
  }
  function toolGrid() {
    const copy = JSON.parse(JSON.stringify(gridFor(selfPlayer())));
    for (const move of toolMoves) { const die = copy[move.from_row][move.from_col].die; copy[move.from_row][move.from_col].die = null; copy[move.to_row][move.to_col].die = die; }
    return copy;
  }
  function movedDice() {
    const grid = JSON.parse(JSON.stringify(gridFor(selfPlayer()))); const moved = [];
    for (const move of toolMoves) { const die = grid[move.from_row][move.from_col].die; moved.push(die); grid[move.from_row][move.from_col].die = null; grid[move.to_row][move.to_col].die = die; }
    return moved;
  }
  function renderBoard() {
    const root = $("sagradaBoard"); root.replaceChildren();
    const self = selfPlayer(); const grid = moveTool() ? toolGrid() : gridFor(self);
    $("sagradaWindowTitle").textContent = self ? (self.pattern_name || "Your stained glass 🪟") : "Watching the table 🪟";
    const goal = self?.private_color || self?.secret_color;
    const goalRoot = $("sagradaSecretGoal"); goalRoot.textContent = self ? `🔒 ${colorLabel(goal)}` : "Spectator";
    setTip(goalRoot, self ? `Private objective: score the sum of all ${colorLabel(goal)} dice values in your window. Opponents cannot see this color until the end.` : "Spectators can inspect every public window, but cannot take actions.");
    const die = transformedDie();
    for (let row = 0; row < 4; row += 1) for (let col = 0; col < 5; col += 1) {
      const cell = grid[row][col]; const placed = cellDie(cell); const restriction = cell?.restriction;
      const button = element("button", "sagrada-cell"); button.type = "button"; button.dataset.row = row; button.dataset.col = col;
      if (placed) { button.classList.add("filled", placed.color); paintDie(button, placed); }
      else { if (restriction?.color) button.classList.add(restriction.color, "restricted-color"); button.textContent = restriction?.value || "·"; }
      let reason = placementReason(grid, die, row, col, { nonAdjacent: selectedTool === "cork_backed_straightedge" });
      let selectable = Boolean(self && hasAction("place_die") && die && !reason && !selectedTool);
      if (pendingTool()) selectable = Boolean(hasAction("resolve_tool") && die && !reason);
      if (placementTool()) selectable = Boolean(hasAction("use_tool") && die && !reason);
      if (moveTool()) {
        if (!toolSource) {
          const limit = ["lathekin", "tap_wheel"].includes(selectedTool) ? 2 : 1; const moved = movedDice();
          const trackColors = new Set(roundTrack().flat().map((candidate) => candidate.color));
          const tapAllowed = selectedTool !== "tap_wheel" || (trackColors.has(placed?.color) && (!moved.length || moved[0].color === placed?.color));
          selectable = Boolean(placed && hasAction("use_tool") && toolMoves.length < limit && !moved.some((candidate) => candidate?.id === placed.id) && tapAllowed);
          reason = placed ? `Move ${dieLabel(placed)}.` : "Choose an existing die to move first.";
        }
        else {
          const moving = cellDie(grid[toolSource.row]?.[toolSource.col]);
          const preview = JSON.parse(JSON.stringify(grid)); preview[toolSource.row][toolSource.col].die = null;
          reason = placementReason(preview, moving, row, col, { ignoreColor: selectedTool === "eglomise_brush", ignoreValue: selectedTool === "copper_foil_burnisher" });
          selectable = Boolean(!reason && hasAction("use_tool"));
          if (row === toolSource.row && col === toolSource.col) selectable = true;
        }
      }
      button.disabled = !selectable; button.classList.add(selectable ? "available" : "blocked");
      button.classList.toggle("selected", Boolean((selectedCell?.row === row && selectedCell?.col === col) || (toolSource?.row === row && toolSource?.col === col)));
      const text = placed ? `${dieLabel(placed)} at row ${row + 1}, column ${col + 1}. ${restrictionLabel(cell)}` : `Row ${row + 1}, column ${col + 1}. ${restrictionLabel(cell)} ${reason || "Legal placement."}`;
      setTip(button, text); button.setAttribute("aria-label", text);
      button.addEventListener("click", () => {
        if (moveTool()) {
          if (!toolSource) toolSource = { row, col };
          else if (row === toolSource.row && col === toolSource.col) toolSource = null;
          else { toolMoves.push({ from_row: toolSource.row, from_col: toolSource.col, to_row: row, to_col: col }); toolSource = null; }
        } else selectedCell = selectedCell?.row === row && selectedCell?.col === col ? null : { row, col };
        hideTip(); renderSagrada();
      });
      root.append(button);
    }
    const selection = $("sagradaSelection");
    if (moveTool()) selection.textContent = toolSource ? "Choose a highlighted destination in your window." : `Choose a die in your window to move. ${toolMoves.length} move(s) selected.`;
    else selection.textContent = die ? `${dieLabel(die)}${selectedCell ? ` → row ${selectedCell.row + 1}, column ${selectedCell.col + 1}` : " · choose a highlighted cell"}` : "Select a pool die, then a highlighted window cell.";
    $("sagradaPlaceBtn").textContent = pendingTool() ? "Place tool die" : "Place die";
    $("sagradaPlaceBtn").disabled = !((pendingTool() ? hasAction("resolve_tool") : hasAction("place_die") && !selectedTool) && die && selectedCell && !placementReason(grid, die, selectedCell.row, selectedCell.col));
    $("sagradaSkipBtn").disabled = !hasAction("end_turn") && !hasAction("skip_die");
  }
  function renderObjectives() {
    const root = $("sagradaObjectives"); root.replaceChildren();
    (view.objectives || view.public_objectives || []).forEach((objective) => {
      const card = element("div", "sagrada-objective"); card.tabIndex = 0;
      card.append(element("strong", "", objective.name || objective.title || "Public objective"), element("span", "", objective.description || ""));
      setTip(card, `${objective.name}: ${objective.description}`); root.append(card);
    });
  }
  function toolTimingReason(id) {
    const second = Number(view.draft_index || 0) >= (view.players || []).length;
    const drafted = Boolean(view.current_turn_state?.drafted);
    if (id === "glazing_hammer" && (!second || drafted)) return "Available only on your second turn, before drafting.";
    if (id === "running_pliers" && second) return "Available only on your first turn of the round.";
    if (!["eglomise_brush", "copper_foil_burnisher", "lathekin", "tap_wheel", "running_pliers", "glazing_hammer"].includes(id) && drafted) return "This tool replaces your normal draft; use it before drafting.";
    if (id === "lens_cutter" && !roundTrack().flat().length) return "Requires a die on the round track from a completed round.";
    if (id === "tap_wheel" && !roundTrack().flat().length) return "Requires a matching color on the round track from a completed round.";
    return "";
  }
  function renderTools() {
    const root = $("sagradaTools"); root.replaceChildren();
    $("sagradaFavor").textContent = `🔹 ${selfPlayer()?.favor_tokens ?? "–"}`;
    (view.tools || []).forEach((tool) => {
      const id = typeof tool === "string" ? tool : tool.id;
      const info = toolInfo[id] || [tool.name || id, tool.description || "Use this tool's special ability."];
      const uses = Number(tool.uses || tool.tokens || 0); const cost = tool.cost || (uses ? 2 : 1);
      const button = element("button", `sagrada-tool${selectedTool === id ? " selected" : ""}`); button.type = "button";
      const title = element("div", "sagrada-tool-title"); title.append(element("span", "", info[0]), element("span", "", `🔹 ${cost}`)); button.append(title, element("small", "", tool.description || info[1]));
      const timing = toolTimingReason(id);
      setTip(button, `${info[0]}: ${tool.description || info[1]} Cost: ${cost} Favor Token(s) (🔹).${timing ? ` ${timing}` : ""}`);
      button.disabled = !hasAction("use_tool") || (selfPlayer()?.favor_tokens || 0) < cost || Boolean(timing);
      button.setAttribute("aria-pressed", String(selectedTool === id));
      button.addEventListener("click", () => { selectedTool = selectedTool === id ? null : id; selectedCell = null; toolMoves = []; toolSource = null; trackDie = null; toolValue = null; renderSagrada(); }); root.append(button);
    });
    if (!(view.tools || []).length) root.append(element("span", "hint", "Tools appear after setup."));
    renderToolControls();
  }
  function toolReady() {
    if (pendingTool()) return Boolean(hasAction("resolve_tool") && transformedDie() && selectedCell && !placementReason(gridFor(selfPlayer()), transformedDie(), selectedCell.row, selectedCell.col));
    if (!selectedTool || !hasAction("use_tool")) return false;
    if (moveTool()) return !toolSource && toolMoves.length >= (selectedTool === "lathekin" ? 2 : 1) && toolMoves.length <= (selectedTool === "lathekin" || selectedTool === "tap_wheel" ? 2 : 1);
    if (placementTool()) return Boolean(chosenDie() && transformedDie() && selectedCell && !placementReason(gridFor(selfPlayer()), transformedDie(), selectedCell.row, selectedCell.col, { nonAdjacent: selectedTool === "cork_backed_straightedge" }));
    if (selectedTool === "glazing_hammer") return true;
    return Boolean(chosenDie());
  }
  function hasPlacement(die) {
    if (!die) return false;
    const grid = gridFor(selfPlayer());
    for (let row = 0; row < 4; row += 1) for (let col = 0; col < 5; col += 1) if (!placementReason(grid, die, row, col)) return true;
    return false;
  }
  function renderToolControls() {
    const root = $("sagradaToolControls"); root.replaceChildren(); root.classList.toggle("hidden", !selectedTool);
    if (!selectedTool) return;
    let instruction = toolInfo[selectedTool]?.[1] || "Choose this tool's targets.";
    if (pendingTool()) instruction = `Tool result: ${colorLabel(chosenDie()?.color)}.${selectedTool === "flux_remover" ? " Choose the replacement die's value, then a highlighted destination." : ` New value: ${chosenDie()?.value}. Choose a highlighted destination.`}`;
    if (!pendingTool()) {
      if (moveTool()) instruction += ` ${toolMoves.length} move(s) selected. Click a window die, then its destination.`;
      else if (selectedTool === "lens_cutter") instruction += " Select a pool die, a track die, then a highlighted destination.";
      else if (placementTool()) instruction += " Select a pool die, then a highlighted window cell.";
      else if (selectedTool !== "glazing_hammer") instruction += " Select a pool die.";
    }
    root.append(element("p", "", instruction));
    if ((selectedTool === "grozing_pliers" || pendingTool()?.tool_id === "flux_remover") && chosenDie()) {
      const label = element("label", "", selectedTool === "grozing_pliers" ? "New value" : "Replacement value"); const select = element("select");
      const placeholder = element("option", "", "Choose…"); placeholder.value = ""; select.append(placeholder);
      for (let value = 1; value <= 6; value += 1) { if (selectedTool === "grozing_pliers" && Math.abs(value - chosenDie().value) !== 1) continue; const legal = hasPlacement({ ...chosenDie(), value }); const option = element("option", "", `${pips[value]} ${value}${legal ? "" : " · no legal cell"}`); option.value = value; option.disabled = !legal; select.append(option); }
      select.value = toolValue == null ? "" : String(toolValue); select.addEventListener("change", () => { if (explainMode) return; toolValue = select.value ? Number(select.value) : null; selectedCell = null; renderSagrada(); }); label.append(select); root.append(label);
    }
    toolMoves.forEach((move, index) => root.append(element("p", "", `${index + 1}. (${move.from_row + 1}, ${move.from_col + 1}) → (${move.to_row + 1}, ${move.to_col + 1})`)));
    if (pendingTool()) {
      const canPlace = selectedTool === "flux_remover" ? [1, 2, 3, 4, 5, 6].some((value) => hasPlacement({ ...chosenDie(), value })) : hasPlacement(chosenDie());
      if (canPlace) root.append(element("p", "", "Choose the destination in your window and click Place tool die."));
      else { root.append(element("p", "", "This die has no legal placement.")); const giveBack = element("button", "secondary", "Return die to pool"); giveBack.type = "button"; giveBack.disabled = !hasAction("resolve_tool"); giveBack.addEventListener("click", () => send({ type: "resolve_tool", return_die: true, ...(selectedTool === "flux_remover" ? { value: 1 } : {}) })); root.append(giveBack); }
      return;
    }
    const actions = element("div", "sagrada-actions"); const use = element("button", "", "Use tool"); use.type = "button"; use.disabled = !toolReady(); use.addEventListener("click", useSelectedTool); const cancel = element("button", "secondary", "Cancel"); cancel.type = "button"; cancel.addEventListener("click", () => { clearSelection(); }); actions.append(use, cancel); root.append(actions);
    if (toolMoves.length) { const undo = element("button", "secondary", "Undo move"); undo.type = "button"; undo.addEventListener("click", () => { toolMoves.pop(); toolSource = null; renderSagrada(); }); actions.append(undo); }
  }
  function useSelectedTool() {
    if (!toolReady()) return;
    const action = { type: "use_tool", tool_id: selectedTool };
    if (chosenDie() && !moveTool() && selectedTool !== "glazing_hammer") action.die_id = chosenDie().id;
    if (toolValue != null && selectedTool === "grozing_pliers") action.delta = toolValue - chosenDie().value;
    if (trackDie) action.track_die_id = trackDie;
    if (selectedCell) Object.assign(action, selectedCell);
    if (toolMoves.length) action.moves = toolMoves.slice();
    send(action);
  }
  function roundTrack() {
    const track = view.round_track || [];
    return Array.from({ length: 10 }, (_, index) => {
      const entry = track[index];
      if (Array.isArray(entry)) return entry;
      if (entry?.dice) return entry.dice;
      if (entry?.die) return [entry.die];
      return entry?.color ? [entry] : [];
    });
  }
  function renderRoundTrack() {
    const root = $("sagradaRoundTrack"); root.replaceChildren();
    roundTrack().forEach((dice, index) => {
      const slot = element("div", `sagrada-track-slot${index + 1 === view.round ? " current" : ""}`); slot.append(element("strong", "", `${index + 1}`));
      const diceRoot = element("div", "sagrada-track-dice");
      dice.forEach((die) => { const button = dieButton(die, true); button.classList.toggle("selected", trackDie === die.id); button.disabled = selectedTool !== "lens_cutter"; button.addEventListener("click", () => { trackDie = trackDie === die.id ? null : die.id; renderSagrada(); }); diceRoot.append(button); });
      if (!dice.length) diceRoot.append(element("span", "hint", "·")); slot.append(diceRoot); root.append(slot);
    });
  }
  function renderPlayers() {
    const root = $("sagradaPlayers"); root.replaceChildren();
    (view.players || []).forEach((player) => {
      const own = player.player_id === view.you; const card = element("div", `sagrada-player${own ? " self" : ""}${player.player_id === view.current_turn ? " current" : ""}`);
      const header = element("div", "sagrada-player-header"); const score = view.game_over ? player.score : player.score_preview;
      header.append(element("strong", "", `${player.name || player.player_id}${own ? " · You" : ""}`), setTip(element("span", "", `🔹 ${player.favor_tokens ?? 0} · ${score ?? "–"} pts${player.ready ? " · ✓" : ""}`), "Live points are provisional. Opponent totals hide their private objective until final scoring."));
      card.append(header, miniatureGrid(player.grid)); const privateColor = player.private_color || player.secret_color;
      card.append(setTip(element("div", "sagrada-player-goal", privateColor ? `🔒 ${colorLabel(privateColor)}` : "🔒 Private objective"), privateColor ? `Score the sum of all ${colorLabel(privateColor)} dice in this window.` : "Only this player can see their private color objective until the game ends.")); root.append(card);
    });
  }
  function summaryText(entry) {
    if (typeof entry === "string") return entry;
    const actor = playerName(entry.player_id);
    if (entry.tool_id) return `${actor} · 🛠️ ${toolInfo[entry.tool_id]?.[0] || entry.tool_id}`;
    if (entry.skipped || entry.type === "end_turn") return `${actor} · ended turn`;
    if (entry.die && entry.row != null) return `${actor} · ${dieLabel(entry.die)} → (${entry.row + 1}, ${entry.col + 1})`;
    return entry.message || entry.text || `${actor} · ${entry.type || "action"}`;
  }
  function renderReview() {
    const review = view.phase === "round_end";
    $("sagradaReview").classList.toggle("hidden", !review);
    const ready = view.ready || []; const ownReady = ready.includes(view.you) || selfPlayer()?.ready;
    $("sagradaNextRoundBtn").disabled = !hasAction("next_round");
    $("sagradaNextRoundBtn").textContent = ownReady ? "Ready ✓" : view.round === 10 ? "Final scoring" : "Next Round";
    $("sagradaReady").textContent = `${ready.length}/${(view.players || []).length} ready${ownReady ? " · waiting for the table" : " · review the windows, then continue"}`;
    const root = $("sagradaRoundSummary"); root.replaceChildren();
    (view.round_summary || []).forEach((entry) => root.append(element("div", `sagrada-summary-row${entry.player_id === view.you ? " self" : ""}`, summaryText(entry))));
    const log = $("sagradaLog"); log.replaceChildren();
    const entries = view.log || view.round_summary || [];
    entries.slice(-40).forEach((entry) => log.append(element("div", `sagrada-summary-row${entry.player_id === view.you ? " self" : ""}`, summaryText(entry))));
  }
  function renderResults() {
    $("sagradaResults").classList.toggle("hidden", !view.game_over);
    const root = $("sagradaScores"); root.replaceChildren(); if (!view.game_over) return;
    const heading = element("div", "sagrada-score-row header"); ["Player", "Public 🎯", "Private 🔒", "Favor 🔹", "Empty −", "Total"].forEach((text) => heading.append(element("span", "", text))); root.append(heading);
    [...view.players].sort((a, b) => view.ranking?.length ? view.ranking.indexOf(a.player_id) - view.ranking.indexOf(b.player_id) : b.score - a.score).forEach((player) => {
      const row = element("div", `sagrada-score-row${player.player_id === view.you ? " self" : ""}`);
      const empty = player.empty_penalty ?? gridFor(player).flat().filter((cell) => !cellDie(cell)).length;
      [player.name || player.player_id, player.objective_score ?? player.public_score ?? "–", player.private_score ?? "–", player.favor_tokens ?? 0, `−${empty}`, player.score].forEach((text) => row.append(element("span", "", text))); root.append(row);
    });
  }
  function renderSagrada() {
    if (!view || !$("sagradaBoard")) return;
    document.body.classList.toggle("sagrada-needs-action", !view.game_over && Boolean(view.legal_actions?.length));
    if (pendingTool()) { selectedTool = pendingTool().tool_id; selectedDie = pendingTool().die?.id; }
    $("sagradaRound").textContent = view.round || "–";
    $("sagradaTurn").textContent = view.phase === "pattern_select" ? "Choose windows" : playerName(view.current_turn);
    $("sagradaPhase").textContent = { pattern_select: "Window selection", drafting: "Drafting", round_end: "Round review", game_over: "Complete" }[view.phase] || "Waiting";
    $("sagradaWinnerStatus").classList.toggle("hidden", !view.game_over);
    $("sagradaWinner").textContent = (view.winner || []).map(playerName).join(", ");
    $("sagradaPlayArea").classList.toggle("hidden", view.phase === "pattern_select");
    renderPatterns(); renderPool(); renderBoard(); renderObjectives(); renderTools(); renderRoundTrack(); renderPlayers(); renderReview(); renderResults();
  }

  const help = `<h3>Classic base game (2017) · Build a stained glass window 🪟</h3><p>Choose one of four window patterns. Its difficulty is your starting Favor Tokens (🔹). The game lasts 10 rounds; each player normally has two turns per round. Score the most points to win.</p><h3>Draft and place 🎲</h3><p>Each round has two dice per player, plus one extra. Turns go clockwise from the start player, then reverse: the last player takes two consecutive turns. Choose a pool die, select a highlighted cell and click <b>Place die</b>. You may use one tool on your turn, before or after placing. Click <b>End turn</b> when finished; you may pass without drafting. Leftover dice go to the round track (🕰️), and the start player rotates.</p><h3>Placement rules</h3><p>The first die must be on an edge or corner. Later dice must touch a placed die, orthogonally or diagonally. Orthogonal neighbors cannot share either color or value. Diagonal neighbors may match. Match any printed color or value in the destination cell; one die per cell. Colors are Red (🟥), Yellow (🟨), Green (🟩), Blue (🟦), and Purple (🟪). The die symbols ⚀–⚅ mean values 1–6.</p><h3>Tools 🛠️ and Favor Tokens 🔹</h3><p>Three shared tools change dice, move dice, or alter your draft. The first use of a tool costs 1 Favor Token (🔹); subsequent uses cost 2. You may use at most one tool per turn. Select a tool to see its instructions and choose targets directly in the window, pool, or round track. Tools only ignore the restrictions they explicitly mention.</p><h3>Scoring 🎯</h3><p>Three public objective cards score every player's window. Your private color objective (🔒) scores the sum of all dice values of that color. Every unused Favor Token (🔹) scores 1 point; every empty cell loses 1 point. Final ties use private-objective points, then remaining Favor Tokens, then the last round's reverse player order.</p><h3>Round review</h3><p>Every round pauses to show everyone's placements and tool use. All players must click <b>Next Round</b> to continue. Round 10 continues to final scoring after everyone confirms.</p><h3>Controls</h3><p>Click empty space to cancel a selection. <b>Explain</b> then any highlighted item explains it, including disabled buttons. Hover over icons or tap them on a phone for a brief tooltip. Press <b>Esc</b> to close Help, Explain, or cancel a selection.</p>`;

  window.renderSagradaGameState = function (data) {
    if (!data?.view) return;
    const previous = view; const actionWasPending = pending; view = data.view; pending = false;
    const key = `${view.phase}:${view.round}:${view.current_turn}:${view.draft_index ?? view.current_turn_state?.turn_index ?? ""}`;
    if (actionWasPending || key !== lastTurnKey || previous?.game_over !== view.game_over) clearSelection(false);
    lastTurnKey = key; renderSagrada();
  };
  window.showSagradaHeaderActions = function (show) {
    const header = $("sagradaHeaderActions"); if (header) header.style.display = show ? "flex" : "none";
    if (!show) { setExplainMode(false); modal("sagradaHelpModal", false); modal("sagradaExplainModal", false); hideTip(); clearSelection(false); document.body.classList.remove("sagrada-needs-action"); }
  };
  $("sagradaPlaceBtn")?.addEventListener("click", () => {
    if (!chosenDie() || !selectedCell) return;
    if (pendingTool() && toolReady()) {
      const action = { type: "resolve_tool", ...selectedCell }; if (pendingTool().tool_id === "flux_remover") action.value = toolValue; send(action);
    } else if (hasAction("place_die")) send({ type: "place_die", die_id: selectedDie, ...selectedCell });
  });
  $("sagradaSkipBtn")?.addEventListener("click", () => { if (hasAction("end_turn")) send({ type: "end_turn" }); else if (hasAction("skip_die") && chosenDie()) send({ type: "skip_die", die_id: selectedDie }); });
  $("sagradaNextRoundBtn")?.addEventListener("click", () => { if (hasAction("next_round")) send({ type: "next_round" }); });
  $("sagradaHelpBtn")?.addEventListener("click", () => { setExplainMode(false); $("sagradaHelpContent").innerHTML = help; modal("sagradaHelpModal", true); });
  $("sagradaHelpClose")?.addEventListener("click", () => modal("sagradaHelpModal", false));
  $("sagradaExplainBtn")?.addEventListener("click", () => setExplainMode(!explainMode));
  $("sagradaExplainClose")?.addEventListener("click", () => modal("sagradaExplainModal", false));
  ["sagradaHelpModal", "sagradaExplainModal"].forEach((id) => $(id)?.addEventListener("click", (event) => { if (event.target === $(id)) modal(id, false); }));
  panel()?.addEventListener("pointerover", (event) => { if (event.pointerType === "mouse" && !explainMode) { const target = event.target.closest?.("[data-sagrada-tip]"); if (target) showTip(target, target.dataset.sagradaTip); } });
  panel()?.addEventListener("pointerout", (event) => { if (event.pointerType === "mouse") hideTip(); });
  panel()?.addEventListener("click", (event) => {
    const target = event.target.closest?.("[data-sagrada-tip]");
    if (target && matchMedia("(hover: none)").matches && !target.closest("button,[role='button']")) showTip(target, target.dataset.sagradaTip);
    if (!event.target.closest("button,[role='button'],[data-sagrada-tip],select,input,label,summary") && !explainMode) { clearSelection(); hideTip(); }
  });
  function explainTarget(event) {
    const root = panel(); if (!root) return null;
    let target = event.target.closest?.("[data-sagrada-tip]");
    if (target && root.contains(target)) return target;
    if (event.clientX == null) return null;
    return Array.from(root.querySelectorAll("[data-sagrada-tip]")).find((candidate) => { const box = candidate.getBoundingClientRect(); return box.width && box.height && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom; }) || null;
  }
  document.addEventListener("pointerdown", (event) => {
    if (!panel()?.contains(event.target)) return;
    if (!explainMode) {
      if (event.pointerType === "touch" || matchMedia("(hover: none)").matches) {
        const target = explainTarget(event);
        if (target && (target.disabled || !target.closest("button,[role='button'],select,input"))) showTip(target, target.dataset.sagradaTip);
      }
      return;
    }
    const target = explainTarget(event);
    event.preventDefault(); event.stopImmediatePropagation(); blockedClickUntil = performance.now() + 800; blockedClickTarget = target || event.target;
    if (target) openExplain(target.dataset.sagradaTip);
  }, true);
  document.addEventListener("keydown", (event) => {
    if (!explainMode || !panel()?.contains(event.target) || event.key === "Escape" || event.key === "Tab") return;
    const interactive = event.target.closest?.("button,[role='button'],input,select,textarea,summary");
    if (!interactive) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key === "Enter" || event.key === " ") { const target = explainTarget(event); if (target) openExplain(target.dataset.sagradaTip); }
  }, true);
  ["input", "change"].forEach((type) => document.addEventListener(type, (event) => {
    if (explainMode && panel()?.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true));
  document.addEventListener("click", (event) => {
    const inGame = panel()?.contains(event.target);
    const blocked = performance.now() <= blockedClickUntil && (blockedClickTarget === event.target || blockedClickTarget?.contains(event.target));
    if (!inGame || (!explainMode && !blocked)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (explainMode) { const target = explainTarget(event); if (target) openExplain(target.dataset.sagradaTip); }
  }, true);
  document.addEventListener("keydown", (event) => { if (event.key !== "Escape") return; setExplainMode(false); hideTip(); clearSelection(); modal("sagradaHelpModal", false); modal("sagradaExplainModal", false); });
  if (typeof socket !== "undefined") socket.on("system:error", () => { if (pending) { pending = false; renderSagrada(); } });
  // Assets are inserted after DOMContentLoaded, so bind immediately and restore
  // any state received while the markup and script were loading.
  if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "sagrada") window.renderSagradaGameState(lastGameStatePayload);
})();
