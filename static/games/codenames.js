(() => {
  "use strict";
  const element = suffix => document.getElementById(`codenames${suffix}`);
  const panel = element("Panel");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[character]);
  const teamName = team => team === "red" ? "◆ Red" : "● Blue";
  const identityName = identity => ({red: "◆ Red agent", blue: "● Blue agent", neutral: "○ Bystander", assassin: "✕ Assassin"})[identity] || "Unidentified";
  let view = null;
  let roomKey = null;
  let selected = null;
  let pending = false;
  let pendingTimer = null;
  let gesture = null;
  let suppressClick = false;
  let tipTimer = null;
  let composing = false;
  let explain = null;
  const connected = () => socket.connected && roomSessionReady;
  const can = kind => Boolean(view && view.legal_actions.includes(kind) && connected() && !pending);
  const helpConfig = {
    gameId: "codenames",
    title: {zh: "行动代号 · Codenames", en: "Codenames"},
    basic: {
      win: {zh: "先找出己方全部特工的一队获胜，碰到刺客的一队立即失败。", en: "Find every agent of your team first to win, but contacting the assassin immediately loses the game."},
      turn: {zh: "情报员给出一个词和一个数字，队员讨论后逐个确认猜词，也可以在至少猜一次之后结束回合。", en: "Your spymaster gives one word and a number, then operatives discuss and confirm guesses one at a time, stopping after at least one guess if they wish."},
      key: {zh: "把一个线索关联到多个己方词语，同时避开对手、路人和刺客，是获胜的关键。", en: "Connect several friendly words with one clue while avoiding opponents, bystanders, and the assassin."}
    },
    sections: [
      {id: "teams", label: {zh: "组队与身份", en: "Teams and identities"}, html: {
        zh: "<p>经典模式支持 4–8 人。Start 后进入独立设置页，每队至少两人且恰有一位情报员，房主选择中文或英文词库后点击 Begin mission。相邻座位默认分到不同队。</p><p>只有两位情报员能看到未揭晓词卡的身份。红方特工(◆)与蓝方特工(●)分别属于两队，路人(○)会结束回合，刺客(✕)会导致立即失败。先手随机决定，先手有 9 位特工，后手有 8 位，另有 7 位路人和 1 位刺客。</p>",
        en: "<p>Classic mode supports 4–8 players. Start opens a separate setup screen. Each team needs at least two people and exactly one spymaster. The host chooses a Chinese or English deck and clicks Begin mission. Consecutive seats default to opposite teams.</p><p>Only the two spymasters see unrevealed identities. Red agents (◆) and Blue agents (●) belong to the two teams, a Bystander (○) ends the turn, and the Assassin (✕) loses the game immediately. A random starting team has 9 agents, the other has 8, with 7 bystanders and 1 assassin.</p>"}},
      {id: "clues", label: {zh: "合法线索", en: "Giving clues"}, html: {
        zh: "<p>线索必须是一个连续的词，只能含文字，不含空格、数字或标点。数字说明关联了多少个词。线索必须与词义有关，不能利用卡片位置、颜色、拼写、字母数量、谐音、翻译或表情暗示。情报员给出线索后不能再补充暗示。</p><p>任何未揭晓词卡的完整词或其中一部分都不能作为线索，反过来包含词卡的线索也不合法。服务器检查字面重合，词义、词形变化、专有名词等边界由玩家共同裁定。已揭晓的词不再限制线索。</p><p>普通数字为 1–9，最多猜数字加一次。数字零表示线索不关联任何己方词，仍可不限次数猜测。无限(∞)表示不告知关联数量，也不限次数。两者都必须至少猜一次，猜错仍会结束回合。</p>",
        en: "<p>A clue is one continuous word containing letters only, with no spaces, numbers, or punctuation. Its number indicates how many words it connects. Clues must refer to meaning, not position, color, spelling, letter count, soundalikes, translations, or gestures. The spymaster stays silent afterwards.</p><p>You cannot use an unrevealed word, part of it, or a clue containing it. The server checks literal overlaps. Players adjudicate meaning, related word forms, and proper names together. Revealed words no longer restrict clues.</p><p>Normal counts are 1–9 and allow at most that many guesses plus one. Zero means no friendly words relate to the clue and allows unlimited guesses. Unlimited (∞) hides the intended count and also allows unlimited guesses. Both still require at least one guess, and a wrong guess still ends the turn.</p>"}},
      {id: "resolution", label: {zh: "猜词与结算", en: "Guessing and results"}, html: {
        zh: "<p>队员先点击词卡，再在棋盘下方原地确认。点空白处、Cancel 或 Esc 可取消，滑动不会选中卡片。任何一位己方队员确认即可代表全队提交。猜中己方特工可以继续，猜中对方特工会帮助对方并结束回合，路人也会结束回合。</p><p>任意一队最后一位特工被揭晓时，该队立即获胜，即使是被对手猜出的。刺客优先判负。回合结束后保留棋盘和线索，所有人点击 Next Round 后才切换队伍。终局公开全部身份，并显示双方已找到及剩余人数与胜负原因，所有人 Confirm result 后 Room Control 才开放 Play Again。</p><p>练习机器人使用本地原创词库的语义标签选择线索和猜词，不依赖模型服务。队员机器人只能读取自己的公开视角，不能偷看身份。它不能理解任意真人线索，必要时会盲猜，请优先与真人一起体验。</p>",
        en: "<p>Tap a word, then confirm just below the grid. Blank space, Cancel, or Esc cancels selection, and scrolling never selects a card. Any friendly operative may submit the team's choice. A friendly agent lets you continue, an opponent agent helps the other team and ends your turn, and a bystander also ends it.</p><p>A team wins immediately when its last agent is revealed, even by an opponent. The assassin takes priority and loses the game. At turn end the board and clue stay visible until everyone clicks Next Round. The final result reveals the full key, both teams' found and remaining counts, and the reason for victory. Everyone must Confirm result before Room Control offers Play Again.</p><p>Practice bots use semantic tags from this original local word deck, without a model service. Operative bots only use their public view, never secret identities. They cannot understand arbitrary human clues and may guess blindly, so human teams are recommended.</p>"}}
    ]
  };
  const explanations = {
    roles: {zh: "选择红方(◆)或蓝方(●)的身份。情报员能看全部身份，只能给线索。队员看不到未揭晓身份，负责猜词。每队需要一位情报员和至少一位队员。", en: "Choose Red (◆) or Blue (●), as spymaster or operative. Spymasters see the key and give clues. Operatives cannot see hidden identities and make guesses. Each team needs one spymaster and at least one operative."},
    language: {zh: "只在独立开局设置页选择中文或英文原创词库，开始任务后不可更改。", en: "The host chooses the original Chinese or English word deck only on this separate setup screen. It cannot change during a mission."},
    begin: {zh: "两队各有一位情报员和至少一位队员后，房主可以生成 25 张词卡及随机身份板。先手随机，先手 9 位特工，后手 8 位。", en: "The host deals 25 words and a random key once each team has one spymaster and at least one operative. The random starting team has 9 agents and the other has 8."},
    scores: {zh: "红方(◆)和蓝方(●)的大数字表示尚未找出的己方特工人数。先降到零的一队获胜。", en: "The large Red (◆) and Blue (●) numbers show agents still to find. The first team to reach zero wins."},
    clue: {zh: "情报员只能给一个与词义相关的词和一个数字。线索不能与未揭晓词卡有字面重合。队员根据这个公开线索逐个猜词，情报员之后保持沉默。", en: "The spymaster gives one meaning-based word and a number. It cannot overlap an unrevealed board word. Operatives guess from this public clue while the spymaster remains silent."},
    number: {zh: "数字 1–9 允许最多数字加一次猜测。零和无限(∞)没有次数上限。至少猜一次才可主动结束回合。", en: "A count of 1–9 permits that many guesses plus one. Zero and Unlimited (∞) remove the cap. You must guess at least once before ending your turn."},
    key: {zh: "情报员看到私密身份板，队员与旁观者只看已揭晓身份。终局才公开全部身份。实色表示所属身份，虚线及删除线表示已揭晓。", en: "Spymasters see the secret key. Operatives and spectators see only revealed identities until the result. Color indicates identity, while dashed borders and struck words mark revealed cards."},
    card: {zh: "词卡身份包括红方特工(◆)、蓝方特工(●)、路人(○)和刺客(✕)。己方特工允许继续，对方特工和路人结束回合，刺客立即判负。点卡后还需确认，不会直接揭晓。", en: "Identities are Red agent (◆), Blue agent (●), Bystander (○), and Assassin (✕). Friendly agents allow another guess, opposing agents and bystanders end the turn, and the assassin loses immediately. Selecting a card still requires confirmation."},
    guess: {zh: "确认选中词，代表全队正式接触该身份。所有玩家会同时看到结果。情报员不能猜词，其他队伍不能代猜。", en: "Commit the selected word for your whole team. Everyone sees the identity together. Spymasters and the opposing team cannot guess for you."},
    end: {zh: "至少猜一次后，队员可以放弃剩余次数。保留当前线索和揭晓结果，所有人确认后才换对手回合。", en: "After at least one guess, operatives may forfeit remaining guesses. The clue and reveals stay visible until everyone confirms the turn end."},
    next: {zh: "Next Round 确认看过本回合结果，所有人确认后才切换队伍。Confirm result 确认终局结算，全部确认后才可 Play Again，不再弹出额外确认框。", en: "Next Round acknowledges this turn's reveals. Everyone must confirm before teams switch. Confirm result acknowledges final scoring. Play Again becomes available only after everyone confirms, without another confirmation dialog."},
    result: {zh: "终局显示胜方、原因、两队找到和剩余的特工人数，并公开所有身份。找到最后一位特工立即获胜，碰到刺客立即失败。", en: "The result shows the winning team, reason, agents found and remaining for both teams, and the complete key. Finding the last agent wins immediately. Contacting the assassin loses immediately."},
    history: {zh: "可折叠并滚动的公开记录，只包含已经公布的线索与已经揭晓的词卡。不会显示隐藏身份或机器人思考。", en: "This collapsible, scrollable public log contains announced clues and revealed words only. It never includes hidden identities or bot reasoning."}
  };

  function setError(message = "") {
    element("Error").textContent = message;
    element("Error").hidden = !message;
  }
  function clearPending() {
    pending = false;
    clearTimeout(pendingTimer);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    element("Tooltip").hidden = true;
  }
  function showTip(target) {
    if (!target?.dataset.cnTip) return;
    const tooltip = element("Tooltip");
    tooltip.textContent = target.dataset.cnTip;
    tooltip.hidden = false;
    const bounds = target.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(bounds.left, innerWidth - tooltip.offsetWidth - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(bounds.bottom + 6, innerHeight - tooltip.offsetHeight - 12))}px`;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 3000);
  }
  function submit(type, fields = {}) {
    if (!can(type)) return;
    pending = true;
    setError();
    socket.emit("game:action", {action: {type, game_token: view.game_token, revision: view.revision, ...fields}});
    renderControls();
    pendingTimer = setTimeout(() => { clearPending(); setError("No response yet. Reconnect before retrying if the connection was lost."); renderControls(); }, 8000);
  }
  function renderSelection() {
    element("Selection").hidden = selected === null || !can("guess");
    element("SelectedWord").textContent = selected === null ? "" : view.board[selected].word;
    panel.querySelectorAll("[data-cn-index]").forEach(card => {
      const active = Number(card.dataset.cnIndex) === selected;
      card.classList.toggle("cn-selected", active);
      card.setAttribute("aria-pressed", String(active));
    });
  }
  function renderControls() {
    if (!view) return;
    element("Language").disabled = !can("language");
    element("Begin").disabled = !can("begin") || !view.teams_valid;
    element("ClueWord").disabled = !can("clue");
    element("ClueNumber").disabled = !can("clue");
    element("SendClue").disabled = !can("clue");
    element("EndTurn").hidden = !view.legal_actions.includes("guess");
    element("EndTurn").disabled = !can("end_turn");
    const reviewing = ["turn_end", "result", "game_over"].includes(view.phase);
    element("Next").hidden = !reviewing;
    const confirmed = view.confirmations.includes(view.you);
    element("Next").textContent = confirmed ? "Confirmed ✓" : view.phase === "turn_end" ? "Next Round" : "Confirm result";
    element("Next").disabled = !can(view.phase === "turn_end" ? "next_round" : "confirm_result");
    panel.querySelectorAll("[data-cn-team]").forEach(button => { button.disabled = !can("choose_role") || button.dataset.cnOccupied === "true"; });
    panel.querySelectorAll("[data-cn-index]").forEach(button => {
      button.setAttribute("aria-disabled", String(!can("guess") || view.board[Number(button.dataset.cnIndex)].revealed));
    });
    document.body.classList.toggle("cn-needs-action", connected() && view.phase !== "setup" && view.legal_actions.length > 0);
    renderSelection();
  }
  function render() {
    if (!view) return;
    const setup = view.phase === "setup";
    const finished = ["result", "game_over"].includes(view.phase);
    const own = view.players.find(member => member.player_id === view.you);
    element("Waiting").hidden = true;
    element("Content").hidden = false;
    element("Setup").hidden = !setup;
    element("Mission").hidden = setup;
    element("Turn").textContent = setup ? "PRE-FLIGHT" : `TURN ${String(view.turn).padStart(2, "0")}`;
    element("Headline").textContent = setup ? "Build your intelligence team." : finished ? "Mission debrief." : `${view.active_team === "red" ? "Red" : "Blue"} team, make contact.`;
    element("Teams").innerHTML = ["red", "blue"].map(team => `<section class="cn-team cn-${team}"><h4>${teamName(team)}</h4>${view.players.filter(member => member.team === team).map(member => `<p title="${escapeHtml(member.name)}">${escapeHtml(member.name)}${member.player_id === view.you ? " · You" : ""}<br><small>${member.role === "spymaster" ? "Spymaster" : "Operative"}${member.is_bot ? " · Bot" : ""}</small></p>`).join("")}</section>`).join("");
    if (setup) {
      element("Board").replaceChildren();
      element("ResultTeams").replaceChildren();
      element("ClueDisplay").textContent = "";
      element("Language").value = view.language;
      element("RoleChoices").innerHTML = ["red", "blue"].map(team => `<div class="cn-role-team" data-team="${team}">${["spymaster", "operative"].map(role => {
        const occupied = role === "spymaster" && view.players.some(member => member.team === team && member.role === role && member.player_id !== view.you);
        return `<button type="button" data-cn-team="${team}" data-cn-role="${role}" data-cn-occupied="${occupied}" aria-pressed="${own?.team === team && own?.role === role}">${teamName(team)} · ${role === "spymaster" ? "Spymaster" : "Operative"}${occupied ? " · Taken" : ""}</button>`;
      }).join("")}</div>`).join("");
      const host = view.players.find(member => member.player_id === view.host);
      element("SetupStatus").textContent = view.teams_valid ? `Teams ready. ${host.name} can begin the mission.` : "Each team needs one spymaster and at least one operative.";
    } else {
      element("Scores").innerHTML = ["red", "blue"].map(team => `<div class="cn-score cn-${team}${view.active_team === team ? " cn-active" : ""}" data-cn-tip="Agents still to find. Reach zero to win." tabindex="0"><span>${teamName(team)}<small>${view.starting_team === team ? "Starting team · 9 agents" : "8 agents"}</small></span><strong>${view.remaining[team]}</strong></div>`).join("");
      element("Role").textContent = own ? `${teamName(own.team)} · ${own.role === "spymaster" ? "Spymaster" : "Operative"}` : "Spectator";
      element("Phase").textContent = ({clue: "Awaiting clue", guess: "Make contact", turn_end: "Turn complete", result: "Confirm debrief", game_over: "Mission complete"})[view.phase];
      element("ClueForm").hidden = !view.legal_actions.includes("clue");
      element("ClueDisplay").hidden = view.phase === "clue" && own?.role === "spymaster" && own.team === view.active_team;
      element("ClueDisplay").innerHTML = view.clue ? `${escapeHtml(view.clue.word)} <b>${view.clue.number === "unlimited" ? "∞" : view.clue.number}</b>` : "Waiting for your next lead…";
      element("KeyLabel").textContent = finished ? "Full key revealed" : own?.role === "spymaster" ? "Private spymaster key" : "Identities hidden";
      element("KeyLabel").dataset.cnTip = "Only spymasters see unrevealed identities. Dashed cards are already revealed.";
      element("Board").innerHTML = view.board.map((card, index) => `<button type="button" class="cn-card${card.revealed ? " cn-revealed" : ""}" data-cn-index="${index}" data-cn-explain="card" data-identity="${card.identity || "hidden"}"${!view.legal_actions.includes("guess") || card.revealed ? ` data-cn-tip="${identityName(card.identity)}${card.revealed ? " · Already revealed" : card.identity ? " · Not yet revealed" : " · Only spymasters see the key"}"` : ""} aria-label="${escapeHtml(card.word)} · ${identityName(card.identity)}${card.revealed ? " · Revealed" : ""}"><span class="cn-card-word">${escapeHtml(card.word)}</span><span class="cn-card-label">${card.revealed ? "✓ " : ""}${card.identity ? identityName(card.identity).replace(" agent", "") : String(index + 1).padStart(2, "0")}</span></button>`).join("");
      element("Status").textContent = !connected() ? "Disconnected. Use Reconnect." : ["turn_end", "result", "game_over"].includes(view.phase) ? `${view.confirmations.length} / ${view.players.length} confirmed` : view.phase === "guess" ? `${view.guesses} guessed · ${view.guess_limit === null ? "No guess limit" : `${Math.max(0, view.guess_limit - view.guesses)} guesses left`}` : "Spymaster is preparing a clue.";
      element("Result").hidden = !finished;
      if (finished) {
        element("ResultTitle").textContent = `${teamName(view.winning_team)} wins`;
        element("ResultReason").textContent = view.end_reason === "assassin" ? `${teamName(view.active_team)} contacted the assassin (✕).` : "All winning team's agents have been found.";
        element("ResultTeams").innerHTML = ["red", "blue"].map(team => {
          const total = view.starting_team === team ? 9 : 8;
          return `<p class="cn-${team}"><strong>${teamName(team)}</strong> · ${total - view.remaining[team]} / ${total} found · ${view.remaining[team]} remaining<br>${view.players.filter(member => member.team === team).map(member => escapeHtml(member.name)).join(", ")}</p>`;
        }).join("");
      }
    }
    const historyScroll = element("HistoryRows").scrollTop;
    element("HistoryRows").innerHTML = [...view.history].reverse().map(entry => `<li><span class="cn-${entry.team}">T${entry.turn} ${teamName(entry.team)}</span> · ${entry.type === "clue" ? `Clue: <strong>${escapeHtml(entry.word)}</strong> / ${entry.number === "unlimited" ? "∞" : entry.number}` : entry.type === "guess" ? `${escapeHtml(entry.word)} → ${identityName(entry.identity)}` : "Ended turn"}</li>`).join("");
    element("HistoryRows").scrollTop = historyScroll;
    renderControls();
  }
  function clearState() {
    clearPending();
    hideTip();
    explain?.exit();
    view = null;
    roomKey = null;
    selected = null;
    gesture = null;
    element("Board").replaceChildren();
    element("RoleChoices").replaceChildren();
    element("ResultTeams").replaceChildren();
    element("ClueDisplay").textContent = "";
    element("Teams").replaceChildren();
    element("HistoryRows").replaceChildren();
    element("Content").hidden = true;
    element("Waiting").hidden = false;
    element("ClueWord").value = "";
    setError();
    document.body.classList.remove("cn-needs-action");
  }
  window.renderCodenamesGameState = data => {
    if (data.game_type !== "codenames" || currentGameType !== "codenames" || data.room_id !== roomId || !data.view) return;
    if (view && roomKey === data.room_id && view.game_token === data.view.game_token && data.view.revision < view.revision) return;
    const changed = !view || view.game_token !== data.view.game_token || view.revision !== data.view.revision;
    if (changed) { selected = null; clearPending(); hideTip(); setError(); }
    if (!view || view.game_token !== data.view.game_token || view.turn !== data.view.turn) element("ClueWord").value = "";
    roomKey = data.room_id;
    view = data.view;
    render();
  };
  window.showCodenamesHeaderActions = visible => {
    element("HeaderActions").style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };
  function initialize() {
    if (typeof window.obgCreateHelp === "function" && typeof window.obgCreateExplain === "function") {
      const help = window.obgCreateHelp(helpConfig);
      explain = window.obgCreateExplain({gameId: "codenames", attribute: "data-cn-explain", explanations: explanations,
        button: element("ExplainBtn"), root: () => panel, bypass: ["#codenamesHelpBtn", "#codenamesExplainBtn"]});
      element("HelpBtn").addEventListener("click", () => { explain.exit(); help.open(); });
      element("ExplainBtn").addEventListener("click", () => { selected = null; renderSelection(); explain.toggle(); });
    }
    document.addEventListener("pointerdown", event => {
      if (!panel.contains(event.target)) return;
      gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, moved: false,
        touch: event.pointerType !== "mouse", tip: event.target.closest?.("[data-cn-tip]")};
      suppressClick = false;
    }, true);
    document.addEventListener("pointermove", event => { if (gesture && gesture.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.moved = true; }, true);
    document.addEventListener("pointerup", event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      suppressClick = gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8;
      if (!suppressClick && gesture.touch) showTip(gesture.tip);
      gesture = null;
    }, true);
    document.addEventListener("pointercancel", () => { gesture = null; suppressClick = true; }, true);
    document.addEventListener("scroll", () => { hideTip(); if (gesture) gesture.moved = true; }, true);
    window.addEventListener("resize", hideTip);
    window.addEventListener("blur", () => { gesture = null; hideTip(); });
    panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest?.("[data-cn-tip]")); });
    panel.addEventListener("pointerout", hideTip);
    panel.addEventListener("focusin", event => showTip(event.target.closest?.("[data-cn-tip]")));
    panel.addEventListener("focusout", hideTip);
    panel.addEventListener("click", event => {
      if (suppressClick && event.detail) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; }
    }, true);
    panel.addEventListener("click", event => {
      const card = event.target.closest("[data-cn-index]");
      if (card && can("guess") && !view.board[Number(card.dataset.cnIndex)].revealed) {
        selected = selected === Number(card.dataset.cnIndex) ? null : Number(card.dataset.cnIndex);
        renderSelection();
      }
      const role = event.target.closest("[data-cn-team]");
      if (role && !role.disabled) submit("choose_role", {team: role.dataset.cnTeam, role: role.dataset.cnRole});
    });
    document.addEventListener("click", event => {
      if (selected !== null && !event.target.closest("#codenamesBoard, #codenamesSelection")) { selected = null; renderSelection(); }
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") { selected = null; if (view) renderSelection(); hideTip(); } });
    element("ClueWord").addEventListener("compositionstart", () => { composing = true; });
    element("ClueWord").addEventListener("compositionend", () => { composing = false; });
    element("ClueForm").addEventListener("submit", event => {
      event.preventDefault();
      if (composing) return;
      const word = element("ClueWord").value.normalize("NFKC").trim();
      if (!/^\p{L}+$/u.test(word) || Array.from(word).length > 32) { setError("Use one word, with letters or Chinese characters only."); return; }
      const raw = element("ClueNumber").value;
      submit("clue", {word, number: raw === "unlimited" ? raw : Number(raw)});
    });
    element("Language").addEventListener("change", () => submit("language", {language: element("Language").value}));
    element("Begin").addEventListener("click", () => submit("begin"));
    element("EndTurn").addEventListener("click", () => submit("end_turn"));
    element("Next").addEventListener("click", () => submit(view.phase === "turn_end" ? "next_round" : "confirm_result"));
    element("ConfirmGuess").addEventListener("click", () => { if (selected !== null) submit("guess", {index: selected}); });
    element("CancelGuess").addEventListener("click", () => { selected = null; renderSelection(); });
    const syncRoom = state => { if (state?.game_type !== "codenames" || state.status === "lobby" || roomKey && roomKey !== state.room_id) clearState(); };
    socket.on("room:state", syncRoom);
    socket.on("system:error", data => { if (view && currentGameType === "codenames") { clearPending(); setError(data.message || "Action rejected."); renderControls(); } });
    socket.on("disconnect", () => { clearPending(); selected = null; hideTip(); if (view) render(); });
    socket.on("connect", () => { if (view) render(); });
    socket.on("system:info", () => { if (view) render(); });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "codenames") window.renderCodenamesGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, {once: true});
  else initialize();
})();
